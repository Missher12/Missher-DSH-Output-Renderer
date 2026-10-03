/** Register removable, durable display settings; no session or model writes. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { DEFAULTS, LAYOUTS, LEGACY_LAYOUTS, MOTIONS, DENSITIES, TEXT_SIZES } from './preferences.ts'

export const Config = z.object({
  layout: z.union([...LAYOUTS, ...LEGACY_LAYOUTS]).default(DEFAULTS.layout).volatile(),
  motion: z.union([...MOTIONS]).default(DEFAULTS.motion).volatile(),
  density: z.union([...DENSITIES]).default(DEFAULTS.density).volatile(),
  textSize: z.union([...TEXT_SIZES]).default(DEFAULTS.textSize).volatile(),
})

export function apply(ctx: Context): void {
  ctx.inject(['settings'], scope => {
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber))
  })
}
