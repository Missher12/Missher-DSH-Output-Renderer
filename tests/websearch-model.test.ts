import { expect, test } from 'vitest'
import { readWebSearch, type WebSearchBlock } from '../src/client/websearch.ts'

const url = 'https://react.dev/reference/react/use'

function result(overrides: Partial<WebSearchBlock> = {}): WebSearchBlock {
  return {
    kind: 'tool-result',
    name: 'web_search',
    call: { name: 'web_search', argsRaw: JSON.stringify({ queries: ['React 19 use()', 'server components'] }) },
    ...overrides,
  }
}

function meta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { sources: [{ url, title: 'use – React' }], truncated: false, ...overrides }
}

test('preparing keeps the query empty and exposes no sources', () => {
  const model = readWebSearch('preparing', { name: 'web_search', phase: 'preparing' })
  expect(model).toMatchObject({ phase: 'preparing', query: '', sources: [], valid: false, isError: false, isChild: false })
})

test('start parses the joined queries and never claims a valid result', () => {
  const model = readWebSearch('start', {
    name: 'web_search',
    phase: 'start',
    argsRaw: JSON.stringify({ queries: ['React 19', 'server components'] }),
  })
  expect(model).toMatchObject({ phase: 'start', query: 'React 19 · server components', valid: false })
})

test('a complete result projects sources, domains, letters, safe hrefs and truncation', () => {
  const model = readWebSearch('result', result({ meta: meta({
    sources: [
      { url: 'https://www.react.dev/reference/react/use', title: 'use – React', snippet: 'Read a Promise.' },
      { url: 'https://nextjs.org/docs/app', title: 'Server Components · Next.js', publishedAt: '2026-10-01' },
    ],
    truncated: true,
  }) }))
  expect(model.phase).toBe('result')
  expect(model.valid).toBe(true)
  expect(model.truncated).toBe(true)
  expect(model.query).toBe('React 19 use() · server components')
  expect(model.sources).toHaveLength(2)
  expect(model.sources[0]).toMatchObject({ url: 'https://www.react.dev/reference/react/use',
    href: 'https://www.react.dev/reference/react/use', domain: 'react.dev', letter: 'R', title: 'use – React' })
  expect(model.sources[0]!.hue).toBeGreaterThanOrEqual(0)
  expect(model.sources[0]!.hue).toBeLessThan(360)
  expect(model.sources[1]).toMatchObject({ domain: 'nextjs.org', publishedAt: '2026-10-01' })
  expect(model.sources[1]!.hue).toBeGreaterThanOrEqual(0)
  expect(model.sources[1]!.hue).toBeLessThan(360)
})

test('an empty source list is a valid empty result rather than malformed metadata', () => {
  const model = readWebSearch('result', result({ meta: meta({ sources: [] }) }))
  expect(model).toMatchObject({ valid: true, sources: [], truncated: false, isError: false })
})

test('non-http source URLs are kept as data but never exposed as an external target', () => {
  const model = readWebSearch('result', result({ meta: meta({ sources: [{ url: 'javascript:alert(1)', title: 'Unsafe' }] }) }))
  expect(model.valid).toBe(true)
  expect(model.sources[0]!.href).toBeUndefined()
  expect(model.sources[0]!.domain).toBe('')
})

test('malformed metadata falls back instead of inventing sources', () => {
  for (const value of [
    undefined,
    { sources: [] },
    { sources: [{ url: 1 }], truncated: false },
    { sources: [{ url }], truncated: 'no' },
    { sources: [{ url }], truncated: false, answer: 12 },
  ]) {
    const model = readWebSearch('result', result({ meta: value }))
    expect(model.valid).toBe(false)
    expect(model.sources).toEqual([])
  }
})

test('blank optional strings remain valid optional fields', () => {
  const model = readWebSearch('result', result({ meta: meta({ sources: [{ url, title: '  ', snippet: ' ', publishedAt: '' }] }) }))
  expect(model.valid).toBe(true)
  expect(model.sources[0]!.title).toBeUndefined()
  expect(model.sources[0]!.snippet).toBeUndefined()
  expect(model.sources[0]!.publishedAt).toBeUndefined()
})

test('a settled failure exposes only a trimmed, capped reason and the flattened output', () => {
  const model = readWebSearch('result', result({
    isError: true,
    error: { reason: `  ${'x'.repeat(300)}  ` },
    content: [{ type: 'text', text: 'provider detail' }],
    meta: meta(),
  }))
  expect(model.isError).toBe(true)
  expect(model.valid).toBe(false)
  expect(model.errorDetail).toHaveLength(241)
  expect(model.errorDetail?.endsWith('…')).toBe(true)
  expect(model.output).toBe('provider detail')
})

test('a result with a missing call head keeps sources and leaves the query empty', () => {
  const model = readWebSearch('result', result({ call: null, meta: meta() }))
  expect(model.valid).toBe(true)
  expect(model.query).toBe('')
  expect(model.sources).toHaveLength(1)
})

test('a PTC child is marked so the view can keep the compact row', () => {
  const model = readWebSearch('result', result({ parentCallId: 'parent', meta: meta() }))
  expect(model.isChild).toBe(true)
  expect(model.valid).toBe(true)
})

test('malformed argument JSON and non-object arguments never throw', () => {
  expect(readWebSearch('start', { name: 'web_search', phase: 'start', argsRaw: '{' }).query).toBe('')
  expect(readWebSearch('start', { name: 'web_search', phase: 'start', argsRaw: '[]' }).query).toBe('')
})

test('flattened fallback output is capped', () => {
  const model = readWebSearch('result', result({ meta: undefined, content: [{ type: 'text', text: 'x'.repeat(5000) }] }))
  expect(model.output).toHaveLength(4001)
  expect(model.output.endsWith('…')).toBe(true)
})
