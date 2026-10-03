/** Values persisted only in this Bundle's Host configuration namespace. */
export const LAYOUTS = ['reader', 'cards', 'process', 'checklist'] as const
/** Accepted by the Host so existing installations can load before the next edit. */
export const LEGACY_LAYOUTS = ['timeline', 'split', 'compact'] as const
export const MOTIONS = ['smooth', 'fade'] as const
export const DENSITIES = ['comfortable', 'tight'] as const
export const TEXT_SIZES = ['standard', 'large'] as const
export type Layout = typeof LAYOUTS[number]
export type Motion = typeof MOTIONS[number]
export interface Preferences {
  layout: Layout
  motion: Motion
  density: typeof DENSITIES[number]
  textSize: typeof TEXT_SIZES[number]
}
export const DEFAULTS: Readonly<Preferences> = { layout: 'reader', motion: 'fade', density: 'comfortable', textSize: 'standard' }
export const ENTRY_ID = 'output-renderer'
export const PACKAGE_ID = '@missher/dsh-output-renderer'

/** Normalize synchronized settings without rewriting the saved document.
 * @param value Persisted configuration, including legacy layouts and missing fields.
 * @returns Supported single-column preferences; retired layouts read as reader.
 */
export function preferences(value: unknown): Preferences {
  if (value === null || typeof value !== 'object') return { ...DEFAULTS }
  const record = value as Record<string, unknown>
  return {
    layout: LAYOUTS.includes(record.layout as Layout) ? record.layout as Layout : DEFAULTS.layout,
    motion: MOTIONS.includes(record.motion as Motion) ? record.motion as Motion : DEFAULTS.motion,
    density: DENSITIES.includes(record.density as Preferences['density']) ? record.density as Preferences['density'] : DEFAULTS.density,
    textSize: TEXT_SIZES.includes(record.textSize as Preferences['textSize']) ? record.textSize as Preferences['textSize'] : DEFAULTS.textSize,
  }
}
