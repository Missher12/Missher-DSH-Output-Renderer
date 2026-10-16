// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { DEFAULTS, PACKAGE_ID } from '../src/preferences.ts'
import { apply } from '../src/client/index.ts'

vi.mock('../src/client/styles.css', () => ({ default: '/* inert during this lifecycle unit */' }))
vi.mock('../src/client/Assistant.tsx', () => ({ Assistant: () => null }))
vi.mock('../src/client/Settings.tsx', () => ({ Settings: () => null }))

const MARKER = 'data-dsh-output-renderer'
const CSS = 'style[data-plugin-css="output-renderer"]'

/**
 * What one slot-injection callback may return, exactly as the registry documents it: a single
 * disposer or an iterable of them. Both arms exist in production, so both must be normalized.
 */
type SlotInjectionEffect = (() => void) | Iterable<() => void>

interface Overrides {
  slots?: unknown
  locale?: unknown
  configForms?: unknown
  /** Replaces what `configForms.get()` resolves, including `undefined` for "no form at all". */
  form?: unknown
}

/**
 * Minimal client context that owns real resources: a Cordis-style fiber effect ledger, slot
 * declarations with their active contributions, registrations that can be withdrawn, and the
 * namespace subscription. Every resource is revoked by an explicit disposer, so unloading the
 * fiber is observable instead of being papered over by deleting DOM nodes afterwards.
 *
 * It models the not-yet-declared path of `slots.inject`, which is what every case here exercises.
 */
function host(overrides: Overrides = {}) {
  let snapshot = { value: { ...DEFAULTS }, base: DEFAULTS, user: {}, revision: 0,
    writable: true, status: 'ready', mode: 'host' }
  const subscribers = new Set<() => void>()
  const effects: (() => void)[] = []
  const waits = new Map<string, () => SlotInjectionEffect>()
  const contributions = new Map<string, (() => void)[]>()
  const registered: string[] = []
  let unloaded = false

  const form = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener) } },
    set: async () => true, mutate: async () => false, unset: async () => false,
  }

  /** Install one fiber effect; its cleanup joins the ledger Cordis unwinds on fiber unload. */
  const installEffect = (create: () => unknown): (() => void) => {
    const cleanup = create()
    const run = typeof cleanup === 'function' ? cleanup as () => void : (): void => {}
    let done = false
    const dispose = (): void => { if (done) return; done = true; run() }
    effects.push(dispose)
    return dispose
  }

  /** Normalize one injection result the way the registry does before it tears a declaration down. */
  const injectedDisposers = (effect: SlotInjectionEffect): (() => void)[] =>
    typeof effect === 'function' ? [effect] : [...effect]

  /** Reverse order, each disposer once: the declared teardown for an iterable injection effect. */
  const releaseContribution = (key: string): void => {
    const disposers = contributions.get(key)
    if (disposers === undefined) return
    contributions.delete(key)
    for (const dispose of [...disposers].reverse()) dispose()
  }

  const slots = {
    inject: (key: string, callback: () => SlotInjectionEffect): (() => void) => {
      if (unloaded) throw new Error(`slots.inject(${key}) after fiber unload`)
      waits.set(key, callback)
      let stopped = false
      const dispose = (): void => {
        if (stopped) return
        stopped = true
        waits.delete(key)
        releaseContribution(key)
      }
      effects.push(dispose)
      return dispose
    },
    register: (options: { name: string }) => {
      registered.push(options.name)
      let live = true
      return () => {
        if (!live) return
        live = false
        const at = registered.indexOf(options.name)
        if (at >= 0) registered.splice(at, 1)
      }
    },
  }

  const faces: Record<string, unknown> = {
    effect: installEffect,
    slots,
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    configForms: { get: () => 'form' in overrides ? overrides.form : form },
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'form') continue
    faces[key] = value
  }
  return {
    ctx: faces, waits, registered, subscribers, effects,
    sync: (value: Partial<typeof snapshot>) => { snapshot = { ...snapshot, ...value }; subscribers.forEach(listener => listener()) },
    /** Declare a slot the way the owning package would, installing its contribution once. */
    declare: (key: string): void => {
      const callback = waits.get(key)
      if (callback === undefined) throw new Error(`no pending slots.inject(${key}) to declare`)
      waits.delete(key)
      contributions.set(key, injectedDisposers(callback()))
    },
    /** Collapse that declaration the way the registry does: reverse order, once. */
    collapse: (key: string): void => { releaseContribution(key) },
    /** Unload the plugin fiber: every effect in reverse order, once, and idempotently. */
    dispose: (): void => {
      if (unloaded) return
      unloaded = true
      for (const dispose of [...effects].reverse()) dispose()
      effects.length = 0
    },
  }
}

const booted: ReturnType<typeof host>[] = []

const boot = (overrides: Overrides = {}) => {
  const created = host(overrides)
  booted.push(created)
  apply(created.ctx as unknown as Parameters<typeof apply>[0])
  return created
}

/** A resolved form that only exposes the methods listed. */
const partialForm = (...methods: readonly ('getSnapshot' | 'subscribe' | 'set')[]) => Object.fromEntries(methods.map(method => [method, method === 'set' ? async () => true : () => () => {}]))

afterEach(() => {
  const hosts = booted.splice(0)
  for (const created of hosts) created.dispose()
  vi.restoreAllMocks()
  // Unloading the fiber — not deleting nodes here — is what must restore every resource.
  for (const created of hosts) {
    expect(created.effects).toEqual([])
    expect(created.waits.size).toBe(0)
    expect(created.registered).toEqual([])
    expect(created.subscribers.size).toBe(0)
  }
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
})

test('native takeover starts only once the assistant seat is really registered and ends with it', () => {
  const created = boot()
  expect([...created.waits.keys()].sort()).toEqual(['conversation.chat.node', 'settings.section'])
  expect(created.registered).toEqual([])
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
  expect(document.head.querySelectorAll(CSS)).toHaveLength(1)

  created.declare('conversation.chat.node')
  expect(created.registered).toEqual(['conversation.chat.node'])
  expect(document.documentElement.getAttribute(MARKER)).toBe(DEFAULTS.layout)

  created.collapse('conversation.chat.node')
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
  expect(created.registered).toEqual([])
})

test('the marker follows the accepted layout for as long as the seat is live', () => {
  const created = boot()
  created.declare('conversation.chat.node')
  expect(document.documentElement.getAttribute(MARKER)).toBe('reader')
  created.sync({ value: { ...DEFAULTS, layout: 'cards' } })
  expect(document.documentElement.getAttribute(MARKER)).toBe('cards')
})

test('a preset document value is restored instead of assumed absent', () => {
  document.documentElement.setAttribute(MARKER, 'previous-owner')
  const created = boot()
  created.declare('conversation.chat.node')
  expect(document.documentElement.getAttribute(MARKER)).toBe('reader')
  created.collapse('conversation.chat.node')
  expect(document.documentElement.getAttribute(MARKER)).toBe('previous-owner')
  document.documentElement.removeAttribute(MARKER)
})

test('a declaration that never arrives leaves every native row in place', () => {
  const created = boot()
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
  expect(created.registered).toEqual([])
  created.declare('settings.section')
  created.collapse('settings.section')
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
})

test('the settings page registers on its own without a chat declaration', () => {
  const created = boot()
  created.declare('settings.section')
  expect(created.registered).toEqual(['settings.section'])
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
})

test('a host missing a required face is named and left completely untouched', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const created = boot({ locale: { register: () => () => {} } })
  expect(created.waits.size).toBe(0)
  expect(created.registered).toEqual([])
  expect(created.effects).toEqual([])
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
  expect(error).toHaveBeenCalledOnce()
  expect(String(error.mock.calls[0]![0])).toContain(PACKAGE_ID)
  expect(String(error.mock.calls[0]![0])).toContain('locale.register/bind')
})

test('a host with no client services at all is diagnosed instead of throwing', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const created = boot({ slots: undefined, locale: undefined, configForms: undefined })
  expect(created.registered).toEqual([])
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(error).toHaveBeenCalledOnce()
  const message = String(error.mock.calls[0]![0])
  expect(message).toContain('slots.inject/register')
  expect(message).toContain('locale.register/bind')
  expect(message).toContain('configForms.get')
})

test.each(['getSnapshot', 'subscribe', 'set'] as const)('a resolved form without %s is named and left untouched', missingMethod => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const methods = (['getSnapshot', 'subscribe', 'set'] as const).filter(method => method !== missingMethod)
  const created = boot({ form: partialForm(...methods) })
  expect(created.waits.size).toBe(0)
  expect(created.registered).toEqual([])
  expect(created.effects).toEqual([])
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
  expect(error).toHaveBeenCalledOnce()
  const message = String(error.mock.calls[0]![0])
  expect(message).toContain(`configForms.get().${missingMethod}`)
  expect(message).not.toContain('loading')
})

test('a config service that resolves no form at all is reported once, not per method', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const created = boot({ form: undefined })
  expect(created.waits.size).toBe(0)
  expect(created.effects).toEqual([])
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(error).toHaveBeenCalledOnce()
  const message = String(error.mock.calls[0]![0])
  expect(message).toContain('configForms.get()')
  expect(message).not.toContain('getSnapshot')
  expect(message).not.toContain('subscribe')
})

test('a form still waiting for its first accepted section is installed, not treated as missing', () => {
  const created = boot({ form: {
    getSnapshot: () => ({ value: undefined, base: undefined, user: undefined, revision: undefined,
      writable: false, status: 'loading' }),
    subscribe: () => () => {},
    set: async () => false,
  } })
  expect([...created.waits.keys()].sort()).toEqual(['conversation.chat.node', 'settings.section'])
  expect(document.head.querySelectorAll(CSS)).toHaveLength(1)
  created.declare('conversation.chat.node')
  expect(created.registered).toEqual(['conversation.chat.node'])
  expect(document.documentElement.getAttribute(MARKER)).toBe(DEFAULTS.layout)
})

test('unloading the plugin fiber clears pending waits, registrations, subscriptions, style and marker', () => {
  const created = boot()
  created.declare('conversation.chat.node')
  expect(created.registered).toEqual(['conversation.chat.node'])
  expect(created.subscribers.size).toBe(1)
  expect(document.documentElement.getAttribute(MARKER)).toBe(DEFAULTS.layout)
  expect(document.head.querySelectorAll(CSS)).toHaveLength(1)

  created.dispose()

  expect(created.waits.size).toBe(0)
  expect(created.registered).toEqual([])
  expect(created.subscribers.size).toBe(0)
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)

  // A declaration arriving after unload has no pending injection left to run.
  expect(() => created.declare('settings.section')).toThrow()
  // Unloading again must not run a second teardown pass.
  created.dispose()
  expect(created.registered).toEqual([])
  expect(created.subscribers.size).toBe(0)
  expect(document.head.querySelectorAll(CSS)).toHaveLength(0)
  expect(document.documentElement.hasAttribute(MARKER)).toBe(false)
})
