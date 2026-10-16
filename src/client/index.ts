/** Register one settings page and a reversible assistant renderer shadow. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { ENTRY_ID, PACKAGE_ID, type Preferences } from '../preferences.ts'
import { createPreferences, type PreferencesController } from './settings.ts'
import { Assistant, type OutputInjected } from './Assistant.tsx'
import { Settings, type SettingsInjected } from './Settings.tsx'
import { NS, en, zh } from './locales.ts'
import styles from './styles.css'

/** Assistant seat this Bundle shadows; declared by the shipped Chat package. */
const ASSISTANT_SLOT = 'conversation.chat.node'
/** Settings seat this Bundle adds; independent of every chat declaration. */
const SETTINGS_SLOT = 'settings.section'
/** Root marker every native-output takeover rule in styles.css is scoped by. */
const MARKER = 'data-dsh-output-renderer'
/** Methods a resolved namespace form is actually used through by {@link createPreferences}. */
const FORM_METHODS = ['getSnapshot', 'subscribe', 'set'] as const

export const inject = ['slots', 'locale', 'configForms']

/** Host faces this build resolved, plus the reason to stay inert when one is unusable. */
interface HostFaces {
  missing: string[]
  form: ConfigForm<Preferences> | undefined
}

/**
 * Name the usable methods a resolved namespace form does not provide. A form that is missing
 * entirely is reported once rather than three times.
 * @param form - namespace form returned by the host config service.
 * @returns the unusable member names, empty when the form can back {@link createPreferences}.
 */
function missingFormMethods(form: ConfigForm<Preferences> | null | undefined): string[] {
  const face = form as unknown as Record<string, unknown> | null | undefined
  if (face === null || face === undefined) return ['configForms.get()']
  return FORM_METHODS.filter(method => typeof face[method] !== 'function')
    .map(method => `configForms.get().${method}`)
}

/**
 * Resolve the host faces this build calls, so a shrunken host is diagnosed instead of failing
 * later inside a render effect. All three services stay required injections: each one is
 * load-bearing (the Chat seat declares a locale namespace, and preferences only exist through the
 * config form), so a missing face means this renderer must stay inert rather than half-installed.
 * Resolving the form is a read: the style, marker and slot registrations happen only after every
 * face exists. A form that has not received its first accepted section yet stays `loading`, which
 * is a normal status and never treated as a missing method.
 * @param ctx - client context carrying the declared services.
 * @returns the unusable face names and the form to drive preferences with.
 */
function resolveFaces(ctx: Context): HostFaces {
  const absent = (present: boolean, name: string): string | undefined => present ? undefined : name
  const missing = [
    absent(typeof ctx.slots?.inject === 'function' && typeof ctx.slots?.register === 'function', 'slots.inject/register'),
    absent(typeof ctx.locale?.register === 'function' && typeof ctx.locale?.bind === 'function', 'locale.register/bind'),
    absent(typeof ctx.configForms?.get === 'function', 'configForms.get'),
  ].filter((name): name is string => name !== undefined)
  if (missing.length > 0) return { missing, form: undefined }
  const form = ctx.configForms.get<Preferences>(ENTRY_ID)
  missing.push(...missingFormMethods(form))
  return { missing, form: missing.length === 0 ? form : undefined }
}

/**
 * Own the root marker for exactly one assistant declaration lifetime. Every rule that hides a
 * native row is scoped by this marker, so the marker must exist only while this renderer really
 * occupies the assistant seat; setting it earlier would suppress native output with nothing
 * replacing it. The previous document value is restored on the way out.
 * @param controller - preferences controller whose layout drives the marker value.
 * @returns disposer restoring the state this renderer found.
 */
function installTakeover(controller: PreferencesController): () => void {
  const root = document.documentElement
  const previous = root.getAttribute(MARKER)
  let installed = ''
  const update = (): void => {
    installed = controller.store.getSnapshot().value.layout
    root.setAttribute(MARKER, installed)
  }
  update()
  const stop = controller.store.subscribe(update)
  return () => {
    stop()
    if (root.getAttribute(MARKER) !== installed) return
    if (previous === null) root.removeAttribute(MARKER)
    else root.setAttribute(MARKER, previous)
  }
}

export function apply(ctx: Context): void {
  const { missing, form } = resolveFaces(ctx)
  if (missing.length > 0 || form === undefined) {
    // Accurate diagnosis, and native content keeps rendering: nothing is hidden without a replacement.
    console.error(`[${PACKAGE_ID}] host is missing ${missing.join(', ')}; the output renderer stays inert.`)
    return
  }
  const controller = createPreferences(form)
  ctx.effect(() => () => controller.dispose())
  ctx.effect(() => ctx.locale.register(NS, { en, zh }))
  const outputText = ctx.locale.bind(NS)
  // The stylesheet is inert by itself: it only names this Bundle's own classes plus rules scoped by
  // the marker below. So it may live for the whole plugin lifetime and also serve a settings page
  // in a host that never declares the assistant seat.
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = PACKAGE_ID
    style.dataset.pluginCss = 'output-renderer'
    style.textContent = styles
    document.head.append(style)
    return () => style.remove()
  })
  const injectOutput = (): OutputInjected => ({ hooks: { outputPreferences: controller.store }, outputText })
  // The takeover marker shares the assistant declaration's lifetime: `slots.inject` runs this once
  // the declaration exists and disposes it when that declaration collapses, so a host without the
  // seat — or one that unloads it — keeps rendering its own native turn-process row.
  ctx.slots.inject(ASSISTANT_SLOT, () => [
    ctx.slots.register({
      name: ASSISTANT_SLOT, key: 'assistant-step', priority: -10, locale: 'chat', inject: injectOutput,
    }, Assistant),
    installTakeover(controller),
  ])
  // The settings page never touches native output, so it keeps its own independent declaration.
  ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register({
    name: SETTINGS_SLOT, id: ENTRY_ID, order: 14, label: () => outputText('section'), locale: NS,
    inject: (): SettingsInjected => ({ ...injectOutput(), setPreference: controller.set }),
  }, Settings))
}
