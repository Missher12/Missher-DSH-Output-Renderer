import { expect, test } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULTS, preferences, type Preferences } from '../src/preferences.ts'
import { createPreferences } from '../src/client/settings.ts'
import { Config } from '../src/index.ts'

function form(accept = true, initial: Partial<ConfigFormSnapshot<Preferences>> = {}) {
  let snapshot: ConfigFormSnapshot<Preferences> = { value: { ...DEFAULTS }, base: DEFAULTS, user: {}, revision: 0, writable: true, status: 'ready', mode: 'host', ...initial }
  const subscribers = new Set<() => void>()
  const writes: [string, unknown][] = []
  const api: ConfigForm<Preferences> = {
    getSnapshot: () => snapshot,
    subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener) },
    async set(key, value) {
      writes.push([key, value])
      if (accept) snapshot = { ...snapshot, value: { ...snapshot.value!, [key]: value }, revision: snapshot.revision! + 1 }
      subscribers.forEach(listener => listener())
      return accept
    },
    async mutate() { return false }, async unset() { return false },
  }
  return { api, writes, subscribers,
    sync: (value: Partial<ConfigFormSnapshot<Preferences>>) => { snapshot = { ...snapshot, ...value }; subscribers.forEach(fn => fn()) },
    readOnly: () => { snapshot = { ...snapshot, writable: false }; subscribers.forEach(fn => fn()) },
  }
}
test('layout, motion, spacing and type size persist independently through the native namespace', async () => {
  const host = form()
  const control = createPreferences(host.api)
  await control.set('layout', 'cards')
  await control.set('motion', 'smooth')
  await control.set('density', 'tight')
  await control.set('textSize', 'large')
  const saved = { layout: 'cards', motion: 'smooth', density: 'tight', textSize: 'large' }
  expect(control.store.getSnapshot().value).toEqual(saved)
  expect(host.writes).toEqual([['layout', 'cards'], ['motion', 'smooth'], ['density', 'tight'], ['textSize', 'large']])
  control.dispose()
  const reloaded = createPreferences(host.api)
  expect(reloaded.store.getSnapshot().value).toEqual(saved)
  reloaded.dispose()
  expect(host.subscribers.size).toBe(0)
})
test('a refused write restores accepted appearance and exposes failure', async () => {
  const host = form(false)
  const control = createPreferences(host.api)
  await control.set('layout', 'cards')
  expect(control.store.getSnapshot()).toMatchObject({ value: DEFAULTS, error: true, saving: false })
  control.dispose()
})
test.each(['process', 'checklist'] as const)('%s is accepted by the Host and survives settings reload', async layout => {
  expect(Config({ layout }).layout.get()).toBe(layout)
  const host = form()
  const control = createPreferences(host.api)
  await control.set('motion', 'smooth')
  await control.set('density', 'tight')
  await control.set('textSize', 'large')
  await control.set('layout', layout)
  control.dispose()
  const reloaded = createPreferences(host.api)
  expect(reloaded.store.getSnapshot().value).toEqual({ layout, motion: 'smooth', density: 'tight', textSize: 'large' })
  reloaded.dispose()
})
test('read-only settings do not make promises about persistence', async () => {
  const host = form()
  const control = createPreferences(host.api)
  host.readOnly()
  await control.set('motion', 'smooth')
  expect(host.writes).toEqual([])
  expect(control.store.getSnapshot().writable).toBe(false)
  control.dispose()
})
test.each(['host', 'memory'] as const)('unavailable %s settings remain distinct from loading and refuse writes', async mode => {
  const host = form(true, { value: undefined, status: 'unavailable', writable: false, mode })
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot()).toMatchObject({ status: 'unavailable', ready: false, writable: false })
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([])
  control.dispose()
})
test('a missing namespace ends loading and a later accepted snapshot restores saving', async () => {
  const host = form(true, { value: undefined, status: 'loading', writable: false })
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot().status).toBe('loading')
  host.sync({ status: 'unavailable' })
  expect(control.store.getSnapshot().status).toBe('unavailable')
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([])
  host.sync({ value: DEFAULTS, status: 'ready', writable: true })
  await control.set('layout', 'cards')
  expect(control.store.getSnapshot()).toMatchObject({ status: 'ready', ready: true, value: { layout: 'cards' } })
  control.dispose()
})
test('malformed persisted values fall back inside the owning namespace', () => {
  expect(preferences({ layout: 'unknown', motion: [], density: 0, textSize: 'huge' })).toEqual(DEFAULTS)
  expect(preferences(null)).toEqual(DEFAULTS)
})
test.each(['split', 'timeline', 'compact'] as const)('legacy %s loads in the Host and reads as reader without changing saved values', layout => {
  const stored = { layout, motion: 'smooth', density: 'tight', textSize: 'large' } as const
  const accepted = Config(stored)
  expect(preferences(stored)).toEqual({ layout: 'reader', motion: 'smooth', density: 'tight', textSize: 'large' })
  expect(stored.layout).toBe(layout)
  expect(accepted.layout.get()).toBe(layout)
  expect(accepted.motion.get()).toBe('smooth')
  expect(accepted.density.get()).toBe('tight')
  expect(accepted.textSize.get()).toBe('large')
})

/** Legacy hosts may send a discriminator outside the union this build knows about. */
const legacyMode = (value: string) => value as ConfigFormSnapshot<Preferences>['mode']

type NewerSnapshot = Omit<ConfigFormSnapshot<Preferences>, 'mode'>

/**
 * Official alpha.5 snapshot shape: `mode` is gone, so `writable` is the whole contract. The
 * pinned rc.2 development SDK still declares the field, hence the cast — the point of these
 * cases is that an absent field is the newer contract, not a missing capability.
 */
function newerForm(accept = true, initial: Partial<NewerSnapshot> = {}) {
  let snapshot: NewerSnapshot = { value: { ...DEFAULTS }, base: DEFAULTS, user: {}, revision: 0,
    writable: true, status: 'ready', ...initial }
  const subscribers = new Set<() => void>()
  const writes: [string, unknown][] = []
  const api = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener) } },
    async set(field: string, value: unknown) {
      writes.push([field, value])
      if (accept) snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value } as Preferences, revision: (snapshot.revision ?? 0) + 1 }
      subscribers.forEach(listener => listener())
      return accept
    },
    async mutate() { return false }, async unset() { return false },
  } as unknown as ConfigForm<Preferences>
  return { api, writes,
    sync: (value: Partial<NewerSnapshot>) => { snapshot = { ...snapshot, ...value }; subscribers.forEach(listener => listener()) } }
}

test('an alpha.5 snapshot without mode follows the Host writable flag', async () => {
  const host = newerForm()
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot()).toMatchObject({ status: 'ready', ready: true, writable: true })
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([['layout', 'cards']])
  expect(control.store.getSnapshot()).toMatchObject({ value: { layout: 'cards' }, error: false, saving: false })
  control.dispose()
})

test('an alpha.5 snapshot without mode still refuses writes when the Host read-only flag is set', async () => {
  const host = newerForm(true, { writable: false })
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot()).toMatchObject({ ready: true, writable: false })
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([])
  control.dispose()
})

test('a refused alpha.5 write restores accepted appearance and exposes failure', async () => {
  const host = newerForm(false)
  const control = createPreferences(host.api)
  await control.set('layout', 'cards')
  expect(control.store.getSnapshot()).toMatchObject({ value: DEFAULTS, error: true, saving: false })
  control.dispose()
})

test('an alpha.5 snapshot that arrives after loading starts saving again', async () => {
  const host = newerForm(true, { value: undefined, status: 'loading', writable: false })
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot()).toMatchObject({ status: 'loading', ready: false, writable: false })
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([])
  host.sync({ value: DEFAULTS, status: 'ready', writable: true })
  await control.set('layout', 'cards')
  expect(control.store.getSnapshot()).toMatchObject({ status: 'ready', ready: true, value: { layout: 'cards' } })
  control.dispose()
})

test.each(['memory', 'host ', '', 'remote'])('a declared non-host legacy mode %j stays read-only even when the flag claims writable', async mode => {
  const host = form(true, { writable: true, mode: legacyMode(mode) })
  const control = createPreferences(host.api)
  expect(control.store.getSnapshot()).toMatchObject({ ready: true, writable: false })
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([])
  control.dispose()
})

test('a declared host mode keeps writing while the flag stays writable', async () => {
  const host = form(true, { writable: true, mode: 'host' })
  const control = createPreferences(host.api)
  await control.set('layout', 'cards')
  expect(host.writes).toEqual([['layout', 'cards']])
  control.dispose()
})
