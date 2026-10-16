/** Accepted Host settings and error-aware edits shared by all output seats. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { preferences, type Preferences } from '../preferences.ts'

/** One namespace snapshot as either supported Host delivers it. */
type FormSnapshot = ReturnType<ConfigForm<Preferences>['getSnapshot']>

/**
 * Read the retired `mode` discriminator without asserting it exists. rc.2 snapshots carry it;
 * official alpha.5 dropped the field and let `writable` speak for itself, so an absent value is
 * the new contract rather than a missing capability. `loading` stays a normal status either way.
 * @param snapshot - namespace snapshot from whichever host is running.
 * @returns the declared transport mode, or undefined on the newer contract.
 */
function declaredMode(snapshot: unknown): unknown {
  return (snapshot as { mode?: unknown } | null | undefined)?.mode
}

/**
 * Decide whether this seat may write. Absent `mode` follows the Host's own `writable`; a declared
 * `mode` is only writable as `host`, so a process-local `memory` snapshot — or any unrecognized
 * value — stays read-only instead of promising persistence it cannot keep.
 * @param snapshot - namespace snapshot to classify.
 * @returns whether a settings write may be attempted.
 */
function acceptsWrites(snapshot: FormSnapshot): boolean {
  const declared = declaredMode(snapshot)
  return snapshot.writable && (declared === undefined ? true : declared === 'host')
}

export function createPreferences(form: ConfigForm<Preferences>) {
  const initial = form.getSnapshot()
  const store = createSnapshotStore({ value: preferences(initial.value), saving: false, error: false,
    status: initial.status, ready: initial.status === 'ready', writable: acceptsWrites(initial) })
  let disposed = false
  const sync = () => {
    if (disposed) return
    const snap = form.getSnapshot()
    const current = store.getSnapshot()
    store.set({ ...current, value: current.saving ? current.value : preferences(snap.value),
      status: snap.status, ready: snap.status === 'ready', writable: acceptsWrites(snap) })
  }
  const unsubscribe = form.subscribe(sync)
  return {
    store,
    async set<Key extends keyof Preferences>(key: Key, value: Preferences[Key]): Promise<void> {
      const before = store.getSnapshot()
      if (disposed || before.saving || !before.ready || !before.writable) return
      store.set({ ...before, value: { ...before.value, [key]: value }, saving: true, error: false })
      let accepted = false
      try { accepted = await form.set(key, value) }
      catch (_error) { /* The visible error below accompanies rollback to the Host snapshot. */ }
      if (disposed) return
      const snap = form.getSnapshot()
      store.set({ value: preferences(snap.value), saving: false, error: !accepted,
        status: snap.status, ready: snap.status === 'ready', writable: acceptsWrites(snap) })
    },
    dispose() { disposed = true; unsubscribe() },
  }
}
export type PreferencesController = ReturnType<typeof createPreferences>
