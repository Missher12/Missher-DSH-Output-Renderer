/** Register one settings page and a reversible assistant renderer shadow. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { ENTRY_ID, PACKAGE_ID, type Preferences } from '../preferences.ts'
import { createPreferences } from './settings.ts'
import { Assistant, type OutputInjected } from './Assistant.tsx'
import { Settings, type SettingsInjected } from './Settings.tsx'
import { NS, en, zh } from './locales.ts'
import styles from './styles.css'

export const inject = ['slots', 'locale', 'configForms']

export function apply(ctx: Context): void {
  const controller = createPreferences(ctx.configForms.get<Preferences>(ENTRY_ID))
  ctx.effect(() => () => controller.dispose())
  ctx.effect(() => ctx.locale.register(NS, { en, zh }))
  const outputText = ctx.locale.bind(NS)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = PACKAGE_ID
    style.dataset.pluginCss = 'output-renderer'
    style.textContent = styles
    document.head.append(style)
    const root = document.documentElement
    const previous = root.getAttribute('data-dsh-output-renderer')
    let installed = ''
    const update = () => {
      installed = controller.store.getSnapshot().value.layout
      root.setAttribute('data-dsh-output-renderer', installed)
    }
    update()
    const stop = controller.store.subscribe(update)
    return () => {
      stop()
      style.remove()
      if (root.getAttribute('data-dsh-output-renderer') === installed) {
        if (previous === null) root.removeAttribute('data-dsh-output-renderer')
        else root.setAttribute('data-dsh-output-renderer', previous)
      }
    }
  })
  const injectOutput = (): OutputInjected => ({ hooks: { outputPreferences: controller.store }, outputText })
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'assistant-step', priority: -10, locale: 'chat', inject: injectOutput,
  }, Assistant))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: ENTRY_ID, order: 14, label: () => outputText('section'), locale: NS,
    inject: (): SettingsInjected => ({ ...injectOutput(), setPreference: controller.set }),
  }, Settings))
}
