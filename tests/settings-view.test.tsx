import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { Settings } from '../src/client/Settings.tsx'
import type { PreferencesController } from '../src/client/settings.ts'
import { DEFAULTS } from '../src/preferences.ts'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/stream.tsx', () => ({ StreamMarkdown: ({ text }: { text: string }) => <p>{text}</p> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => <button disabled={disabled}>{children}</button>,
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

type Props = ComponentProps<typeof Settings>
type State = ReturnType<PreferencesController['store']['getSnapshot']>

function unused(): never { throw new Error('Settings requested an unrelated host capability') }

function renderStatus(value: Partial<State>) {
  const state: State = { value: DEFAULTS, status: 'ready', ready: true, writable: true, saving: false, error: false, ...value }
  const props: Props = {
    close: unused, useOutputPreferences: selector => selector(state), setPreference: async () => {},
    t: key => zh[key], outputText: key => zh[key],
    useWorkspaces: unused, useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused,
  }
  const html = renderToStaticMarkup(<Settings {...props} />)
  const status = html.match(/<div class="dsh-output-settings-status"[^>]*>([^<]*)<\/div>/u)
  if (!status) throw new Error('Settings did not render its status region')
  return { text: status[1], error: status[0].includes('data-error="true"') }
}

test('connection state takes precedence over a previous save failure until reconnection finishes', () => {
  expect(renderStatus({ error: true })).toEqual({ text: zh.failed, error: true })
  expect(renderStatus({ status: 'unavailable', ready: false, writable: false, error: true }))
    .toEqual({ text: zh.unavailable, error: false })
  expect(renderStatus({ status: 'loading', ready: false, writable: false, error: true }))
    .toEqual({ text: zh.loading, error: false })
  expect(renderStatus({ status: 'ready', ready: true, writable: true, error: true }))
    .toEqual({ text: zh.failed, error: true })
  expect(renderStatus({ status: 'ready', ready: true, writable: true, error: false }))
    .toEqual({ text: zh.saved, error: false })
})

test('a read-only connection reports unavailable without stale failure styling', () => {
  expect(renderStatus({ writable: false, error: true })).toEqual({ text: zh.unavailable, error: false })
})

test('saving status remains neutral after retrying a failed change', () => {
  expect(renderStatus({ saving: true, error: false })).toEqual({ text: zh.saving, error: false })
  expect(renderStatus({ saving: false, error: false })).toEqual({ text: zh.saved, error: false })
})

/** Full settings markup, so the preview itself can be inspected. */
function renderSettings(value: Partial<State>) {
  const state: State = { value: DEFAULTS, status: 'ready', ready: true, writable: true, saving: false, error: false, ...value }
  const props: Props = {
    close: unused, useOutputPreferences: selector => selector(state), setPreference: async () => {},
    t: key => zh[key], outputText: key => zh[key],
    useWorkspaces: unused, useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused,
  }
  return renderToStaticMarkup(<Settings {...props} />)
}

test('the concise preview folds through the same shared control the live seat uses', () => {
  const html = renderSettings({ value: { ...DEFAULTS, layout: 'cards' } })
  expect(html).toContain('dsh-output-thinking-toggle')
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain(zh.previewSample)
  expect(html).toContain(zh.collapsedDefault)
  expect(html).not.toContain(zh.alwaysOpen)
  expect(html).toContain(zh.thinkingHintConcise)
  // The concise sample describes folding; it must not keep the fully-expanded note.
  expect(html).toContain(zh.noteConcise)
  expect(html).not.toContain(zh.note)
  // The preview is labelled sample content; it never claims a live thinking phase.
  expect(html).toContain(zh.thinkingSettled)
  expect(html).not.toContain(zh.thinkingRunning)
})

test.each(['reader', 'process', 'checklist'] as const)('%s still previews the reasoning fully expanded', layout => {
  const html = renderSettings({ value: { ...DEFAULTS, layout } })
  expect(html).not.toContain('dsh-output-thinking-toggle')
  expect(html).toContain(zh.thinkingHint)
  expect(html).toContain(zh.alwaysOpen)
  // Only the reader preview reuses the fully-expanded note. The process previews carry their own
  // two real sample notes, which is the evidence these layouts actually need.
  if (layout === 'reader') {
    expect(html).toContain(zh.note)
  } else {
    expect(html).toContain(zh.processNote)
    expect(html).toContain(zh.verificationNote)
    expect(html).not.toContain(zh.note)
  }
})
