// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WebSearchRow } from '../src/client/WebSearch.tsx'
import { zh } from '../src/client/locales.ts'
import type { WebSearchBlock } from '../src/client/websearch.ts'

type Props = ComponentProps<typeof WebSearchRow>

const t: Props['t'] = (key, params) => {
  let text = zh[key as keyof typeof zh] ?? String(key)
  for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value))
  return text
}

const source = (index: number) => ({
  url: `https://example${index}.test/page`,
  title: `来源 ${index}`,
  snippet: `摘要 ${index}`,
})

function result(meta: Record<string, unknown> | undefined = { sources: [source(1), source(2), source(3), source(4)], truncated: false },
  overrides: Partial<WebSearchBlock> = {}): WebSearchBlock {
  return {
    kind: 'tool-result',
    name: 'web_search',
    call: { name: 'web_search', argsRaw: JSON.stringify({ queries: ['React 19'] }) },
    meta,
    content: [{ type: 'text', text: '搜索原文' }],
    ...overrides,
  }
}

function view(block: WebSearchBlock = result(), phase: Props['phase'] = 'result') {
  return <WebSearchRow callId="call-1" toolName="web_search" phase={phase} block={block} t={t} />
}

const cards = (root: HTMLElement) => root.querySelectorAll('.dsh-output-websearch-card')
const pill = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.dsh-output-websearch-pill')!
const body = (root: HTMLElement) => root.querySelector<HTMLElement>('.dsh-output-websearch-body')!

afterEach(cleanup)

test('a completed search opens with three cards, the more control and all metadata', () => {
  const { container } = render(view(result({ sources: [source(1), source(2), source(3), source(4), source(5), source(6)], truncated: false })))
  expect(pill(container).getAttribute('aria-expanded')).toBe('true')
  expect(pill(container).getAttribute('aria-controls')).toBe(body(container).id)
  expect(screen.getByText('已搜索 6 个站点')).toBeTruthy()
  expect(screen.getByText('“React 19”')).toBeTruthy()
  expect(cards(container)).toHaveLength(3)
  expect(screen.getByRole('button', { name: /还有 3 个来源/ })).toBeTruthy()
  expect(container.querySelectorAll('.dsh-output-websearch-stack .dsh-output-websearch-fav')).toHaveLength(4)
  for (const link of Array.from(container.querySelectorAll<HTMLAnchorElement>('a.dsh-output-websearch-card'))) {
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer noopener')
    expect(link.getAttribute('href')).toMatch(/^https:\/\//u)
  }
})

test('the pill collapses and reopens the body, and closing resets the expanded list', () => {
  const { container } = render(view())
  fireEvent.click(screen.getByRole('button', { name: /还有 1 个来源/ }))
  expect(cards(container)).toHaveLength(4)
  expect(document.activeElement).toBe(container.querySelector('.dsh-output-websearch-action'))
  fireEvent.click(pill(container))
  expect(pill(container).getAttribute('aria-expanded')).toBe('false')
  expect(body(container).hasAttribute('hidden')).toBe(true)
  fireEvent.click(pill(container))
  expect(cards(container)).toHaveLength(3)
  expect(body(container).hasAttribute('hidden')).toBe(false)
})

test('expanding all sources and collapsing restores the compact set with focus', () => {
  const { container } = render(view(result({ sources: [source(1), source(2), source(3), source(4), source(5), source(6)], truncated: false })))
  const more = screen.getByRole('button', { name: /还有 3 个来源/ })
  fireEvent.click(more)
  expect(cards(container)).toHaveLength(6)
  expect(container.querySelector('.dsh-output-websearch-more')).toBeNull()
  const collapse = container.querySelector<HTMLButtonElement>('.dsh-output-websearch-action')!
  expect(document.activeElement).toBe(collapse)
  fireEvent.click(collapse)
  expect(cards(container)).toHaveLength(3)
  expect(document.activeElement).toBe(container.querySelector('.dsh-output-websearch-more'))
})

test('a single source uses the singular label and no more control', () => {
  const { container } = render(view(result({ sources: [source(1)], truncated: false })))
  expect(screen.getByText('已搜索 1 个站点')).toBeTruthy()
  expect(cards(container)).toHaveLength(1)
  expect(container.querySelector('.dsh-output-websearch-more')).toBeNull()
})

test('truncation is shown even while the compact set is displayed', () => {
  const { container } = render(view(result({ sources: [source(1), source(2), source(3), source(4)], truncated: true })))
  expect(container.querySelector('.dsh-output-websearch-truncated')?.textContent).toBe('结果已截断')
  fireEvent.click(container.querySelector('.dsh-output-websearch-pill')!)
  expect(container.querySelector('.dsh-output-websearch-truncated')).not.toBeNull()
})

test('an empty source list is a completed, quiet empty state', () => {
  const { container } = render(view(result({ sources: [], truncated: false })))
  expect(screen.getByText('搜索完成 · 没有找到来源')).toBeTruthy()
  expect(cards(container)).toHaveLength(0)
  expect(container.textContent).toContain('没有可展示的来源。')
})

test('a failed result shows its reason and never renders a retry control', () => {
  const { container } = render(view(result(undefined, { isError: true, error: { reason: 'rate limited' }, meta: undefined })))
  expect(screen.getByText('搜索失败')).toBeTruthy()
  expect(screen.getByText('rate limited')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /重试|retry/iu })).toBeNull()
})

test('non-http sources stay textual cards rather than external links', () => {
  const { container } = render(view(result({ sources: [{ url: 'javascript:alert(1)', title: 'Unsafe' }], truncated: false })))
  expect(cards(container)).toHaveLength(1)
  expect(cards(container)[0]!.tagName).toBe('DIV')
  expect(container.querySelector('a.dsh-output-websearch-card')).toBeNull()
  expect(container.textContent).toContain('Unsafe')
})

test('malformed settled metadata falls back to the flattened result text', () => {
  const { container } = render(view(result({ answer: 12, sources: [] }, { meta: { answer: 12, sources: [] } })))
  expect(screen.getByText('Web 搜索')).toBeTruthy()
  expect(container.querySelector('.dsh-output-websearch-output')?.textContent).toBe('搜索原文')
})

test('a PTC child keeps the compact generic row instead of a source grid', () => {
  const { container } = render(view(result({ sources: [source(1), source(2)], truncated: false }, { parentCallId: 'parent' })))
  expect(screen.getByText('Web 搜索')).toBeTruthy()
  expect(cards(container)).toHaveLength(0)
  expect(container.querySelector('.dsh-output-websearch-output')?.textContent).toBe('搜索原文')
})

test('searching shows three skeletons and the query from the start arguments', () => {
  const block: WebSearchBlock = { name: 'web_search', phase: 'start', argsRaw: JSON.stringify({ queries: ['React 19', 'RSC'] }) }
  const { container } = render(view(block, 'start'))
  expect(screen.getByText('正在搜索网页…')).toBeTruthy()
  expect(screen.getByText('“React 19 · RSC”')).toBeTruthy()
  expect(container.querySelectorAll('.dsh-output-websearch-skeleton')).toHaveLength(3)
  expect(container.querySelector('.dsh-output-websearch-more')).toBeNull()
})

test('preparing has a stable disclosure and an explicit waiting hint', () => {
  const { container } = render(view({ name: 'web_search', phase: 'preparing' }, 'preparing'))
  expect(screen.getByText('正在准备搜索')).toBeTruthy()
  expect(container.textContent).toContain('等待搜索参数…')
  expect(container.querySelectorAll('.dsh-output-websearch-card')).toHaveLength(0)
})
