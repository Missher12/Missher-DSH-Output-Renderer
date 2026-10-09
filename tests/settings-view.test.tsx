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
