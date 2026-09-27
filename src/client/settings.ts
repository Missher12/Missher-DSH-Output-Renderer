/** Accepted Host settings and error-aware edits shared by all output seats. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { preferences, type Preferences } from '../preferences.ts'

export function createPreferences(form: ConfigForm<Preferences>) {
  const initial = form.getSnapshot()
  const store = createSnapshotStore({ value: preferences(initial.value), saving: false, error: false,
    ready: initial.status === 'ready', writable: initial.writable && initial.mode === 'host' })
  let disposed = false
  const sync = () => {
    if (disposed) return
    const snap = form.getSnapshot()
    const current = store.getSnapshot()
    store.set({ ...current, value: current.saving ? current.value : preferences(snap.value),
      ready: snap.status === 'ready', writable: snap.writable && snap.mode === 'host' })
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
        ready: snap.status === 'ready', writable: snap.writable && snap.mode === 'host' })
    },
    dispose() { disposed = true; unsubscribe() },
  }
}
export type PreferencesController = ReturnType<typeof createPreferences>
