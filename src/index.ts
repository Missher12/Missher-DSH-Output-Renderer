/** Register removable, durable display settings; no session or model writes. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { DEFAULTS, ENTRY_ID, LAYOUTS, LEGACY_LAYOUTS, MOTIONS, DENSITIES, TEXT_SIZES, PACKAGE_ID } from './preferences.ts'

export const Config = z.object({
  layout: z.union([...LAYOUTS, ...LEGACY_LAYOUTS]).default(DEFAULTS.layout).volatile(),
  motion: z.union([...MOTIONS]).default(DEFAULTS.motion).volatile(),
  density: z.union([...DENSITIES]).default(DEFAULTS.density).volatile(),
  textSize: z.union([...TEXT_SIZES]).default(DEFAULTS.textSize).volatile(),
})

export function apply(ctx: Context): void {
  // `ctx.inject` already waits for the settings service; the concrete method is checked before the
  // side effect so a host without the durable-config face is named instead of throwing inside an
  // effect. Ownership stays with `ctx.fiber` either way, so plugin unload still retracts the entry.
  ctx.inject(['settings'], scope => {
    if (typeof scope.settings.configure !== 'function') {
      console.error(`[${PACKAGE_ID}] host settings service does not expose configure(); "${ENTRY_ID}" keeps Host defaults.`)
      return
    }
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber))
  })
}
