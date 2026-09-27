/** Values persisted only in this Bundle's Host configuration namespace. */
export const LAYOUTS = ['reader', 'cards', 'timeline', 'split'] as const
export const MOTIONS = ['smooth', 'fade'] as const
export type Layout = typeof LAYOUTS[number]
export type Motion = typeof MOTIONS[number]
export interface Preferences { layout: Layout; motion: Motion }
export const DEFAULTS: Readonly<Preferences> = { layout: 'reader', motion: 'fade' }
export const ENTRY_ID = 'output-renderer'
export const PACKAGE_ID = '@missher/dsh-output-renderer'

/** Validate values received from configuration synchronization. */
export function preferences(value: unknown): Preferences {
  if (value === null || typeof value !== 'object') return { ...DEFAULTS }
  const record = value as Record<string, unknown>
  return {
    layout: LAYOUTS.includes(record.layout as Layout) ? record.layout as Layout : DEFAULTS.layout,
    motion: MOTIONS.includes(record.motion as Motion) ? record.motion as Motion : DEFAULTS.motion,
  }
}
