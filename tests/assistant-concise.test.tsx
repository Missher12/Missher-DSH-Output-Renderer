// @vitest-environment jsdom
import { act } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Assistant } from '../src/client/Assistant.tsx'
import { DEFAULTS, type Layout } from '../src/preferences.ts'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/stream.tsx', () => ({ StreamMarkdown: ({ text }: { text: string }) => <p>{text}</p> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ JsonBlock: ({ label }: { label: string }) => <pre>{label}</pre> }))

type Props = ComponentProps<typeof Assistant>
type Data = Props['node']['data']
type Blocks = Data['blocks']

function unused(): never { throw new Error('Assistant requested an unrelated host capability') }

function props(options: {
  blocks: Blocks
  layout?: Layout
  status?: Data['status']
  step?: number
  sessionId?: string
  renderMessageImages?: Props['renderMessageImages']
}): Props {
  const { blocks, layout = 'cards', status = 'settled', step = 2, sessionId = 'synthetic-concise',
    renderMessageImages } = options
  const finalNode = { kind: 'assistant' as const, seq: 10, time: 100, turn: 1, step, blocks,
    ...(status === 'interrupted' ? { interrupted: true as const } : {}) }
  const data = { status, turn: 1, step, blocks, time: 100, ...(status === 'running' ? {} : { finalNode }) }
  // This fixture publishes only turn-tail; other merged keys have no value.
  const useTurnData = (() => undefined) as Props['useTurnData']
  return {
    node: {
      key: 'assistant-step:1:2', id: '1:2', kind: 'assistant-step', target: 'chat', anchorSeq: 2,
      visibility: 'visible', data,
      location: { kind: 'turn', turn: {
        turn: 1, start: undefined, end: undefined, status: 'open', steps: [],
        data: { get: useTurnData, source: unused },
      } },
    },
    useTurnData,
    useOutputPreferences: selector => selector({ value: { ...DEFAULTS, layout }, status: 'ready', ready: true, writable: true, saving: false, error: false }),
    outputText: key => zh[key], t: key => key,
    openFile: vi.fn(), openSkill: unused, inspectCall: undefined, forkAt: unused,
    fileMentions: vi.fn(() => undefined),
    renderMessageImages: renderMessageImages ?? vi.fn(() => null), loadImage: unused,
    useDisclosure: unused, useChat: unused, useConversation: unused, useInput: unused,
    useWorkspaces: unused, useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused,
    useSession: unused, useProjection: unused, sessionId: sessionId as Props['sessionId'],
    inputActions: { captureInsertion: unused, insertText: unused, setDraft: unused, addAttachments: unused,
      removeAttachment: unused, pruneAttachments: unused, submit: unused },
  } as Props
}

let root: Root | undefined
let mount: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mount = document.createElement('div')
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(async () => {
  if (root) await act(async () => { root?.unmount() })
  root = undefined
  mount.remove()
  vi.unstubAllGlobals()
})

async function render(element: ReactElement) {
  await act(async () => { root?.render(element) })
}

const control = () => mount.querySelector<HTMLButtonElement>('.dsh-output-thinking-toggle')
const fold = () => mount.querySelector<HTMLElement>('.dsh-output-thinking-body')

test('concise chat folds the reasoning by default and exposes a real disclosure control', async () => {
  await render(<Assistant {...props({ blocks: [{ kind: 'reasoning', text: '折叠的思考。' }, { kind: 'text', text: '可见的答复。' }] })} />)
  const toggle = control()!
  expect(toggle.tagName).toBe('BUTTON')
  expect(toggle.getAttribute('type')).toBe('button')
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(toggle.getAttribute('aria-controls')).toBe(fold()!.id)
  expect(fold()!.hasAttribute('hidden')).toBe(true)
  expect(fold()!.textContent).toContain('折叠的思考。')
  // Collapsed means hidden, not absent: the client never re-decides visibility from HTML text.
  expect(fold()!.getAttribute('hidden')).not.toBeNull()
})

test('the same control expands and collapses the body', async () => {
  await render(<Assistant {...props({ blocks: [{ kind: 'reasoning', text: '可展开的思考。' }, { kind: 'text', text: '答复。' }] })} />)
  await act(async () => { control()!.click() })
  expect(control()!.getAttribute('aria-expanded')).toBe('true')
  expect(fold()!.hasAttribute('hidden')).toBe(false)
  await act(async () => { control()!.click() })
  expect(control()!.getAttribute('aria-expanded')).toBe('false')
  expect(fold()!.hasAttribute('hidden')).toBe(true)
})

test('streaming, new blocks and settling keep the open choice, another step starts collapsed', async () => {
  await render(<Assistant {...props({ status: 'running', blocks: [{ kind: 'reasoning', text: '思考一。' }] })} />)
  await act(async () => { control()!.click() })
  expect(control()!.getAttribute('aria-expanded')).toBe('true')

  // Appended reasoning plus a first answer: same seat, so the choice must survive.
  await render(<Assistant {...props({ status: 'settled', blocks: [
    { kind: 'reasoning', text: '思考一。思考二。' }, { kind: 'text', text: '答复。' }] })} />)
  expect(control()!.getAttribute('aria-expanded')).toBe('true')

  // An interrupted settle is still the same seat.
  await render(<Assistant {...props({ status: 'interrupted', blocks: [
    { kind: 'reasoning', text: '思考一。思考二。' }, { kind: 'text', text: '部分答复。' }] })} />)
  expect(control()!.getAttribute('aria-expanded')).toBe('true')

  // Another recorded step starts collapsed.
  await render(<Assistant {...props({ step: 3, blocks: [{ kind: 'reasoning', text: '下一步思考。' }] })} />)
  expect(control()!.getAttribute('aria-expanded')).toBe('false')

  // Another session starts collapsed as well.
  await render(<Assistant {...props({ sessionId: 'another-session', blocks: [{ kind: 'reasoning', text: '别的会话。' }] })} />)
  expect(control()!.getAttribute('aria-expanded')).toBe('false')
})

test('the fold wraps only the reasoning, so answers and images stay outside it', async () => {
  const renderMessageImages = vi.fn(() => <span data-gallery="1" />)
  await render(<Assistant {...props({ renderMessageImages, blocks: [
    { kind: 'reasoning', text: '折叠的思考。' },
    { kind: 'text', text: '可见的答复。' },
    { kind: 'image', attachment: { id: 'img-1' } },
  ] })} />)
  expect(fold()!.textContent).toContain('折叠的思考。')
  expect(fold()!.textContent).not.toContain('可见的答复。')
  expect(fold()!.querySelector('[data-gallery]')).toBeNull()
  expect(mount.querySelector('.dsh-output-answer')?.textContent).toContain('可见的答复。')
  expect(mount.querySelector('[data-gallery]')).not.toBeNull()
})

test('a reply without reasoning offers no fold control at all', async () => {
  await render(<Assistant {...props({ blocks: [{ kind: 'text', text: '只有正文。' }] })} />)
  expect(control()).toBeNull()
  expect(mount.querySelector('.dsh-output-answer')?.textContent).toContain('只有正文。')
})

test.each(['reader', 'process', 'checklist'] as const)('%s keeps the reasoning fully expanded and offers no fold', layout => {
  const html = renderToStaticMarkup(<Assistant
    {...props({ layout, blocks: [{ kind: 'reasoning', text: '完整思考。' }] })} groupPart="reasoning" />)
  expect(html).toContain('完整思考。')
  expect(html).not.toContain('dsh-output-thinking-toggle')
  expect(html).not.toContain('hidden=""')
})

test('a running step that already appended text never claims the thinking is still running', async () => {
  await render(<Assistant {...props({ status: 'running', blocks: [
    { kind: 'reasoning', text: '已完成的思考。' }, { kind: 'text', text: '正在生成的答复。' }] })} />)
  expect(control()!.textContent).toBe(zh.thinkingSettled)
  expect(control()!.textContent).not.toBe(zh.thinkingRunning)
})

test('a running step whose reasoning is still the growing block reports it as running', async () => {
  await render(<Assistant {...props({ status: 'running', blocks: [{ kind: 'reasoning', text: '还在思考。' }] })} />)
  expect(control()!.textContent).toBe(zh.thinkingRunning)
})

test('the settled row describes the reasoning, never step or task success', async () => {
  await render(<Assistant {...props({ status: 'settled', blocks: [
    { kind: 'reasoning', text: '完整思考。' }, { kind: 'text', text: '答复。' }] })} />)
  expect(control()!.textContent).toBe(zh.thinkingSettled)
  expect(control()!.textContent).not.toContain(zh.stepSettled)
})

test('reasoning interrupted at its own block: the row owns the only interruption notice', () => {
  const shared = props({ status: 'interrupted', blocks: [{ kind: 'reasoning', text: '被中断的思考。' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(0)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(1)
})

test('an answer interrupted after the thinking closed keeps one stopped label on the answer seat', () => {
  const shared = props({ status: 'interrupted', blocks: [
    { kind: 'reasoning', text: '完整思考。' }, { kind: 'text', text: '部分答复。' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(1)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(0)
  // The fold row still names the finished process; the answer seat owns the interruption.
  expect(html).toContain(zh.thinkingSettled)
})

test('a reply with no reasoning still reports the interruption exactly once', () => {
  const shared = props({ status: 'interrupted', blocks: [{ kind: 'text', text: '只有部分正文。' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(1)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(0)
  expect(html).not.toContain('dsh-output-thinking-toggle')
})

test('a step stopped after a tool call has closed its reasoning, so the row stays settled', () => {
  const shared = props({ status: 'interrupted', blocks: [
    { kind: 'reasoning', text: '完整思考。' }, { kind: 'tool-call' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html).toContain(zh.thinkingSettled)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(0)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(1)
})

test('a step stopped on an empty text block has closed its reasoning too', () => {
  const shared = props({ status: 'interrupted', blocks: [
    { kind: 'reasoning', text: '完整思考。' }, { kind: 'text', text: '' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html).toContain(zh.thinkingSettled)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(0)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(1)
})

test('a trailing interrupted reasoning block owns the notice even when text came first', () => {
  const shared = props({ status: 'interrupted', blocks: [
    { kind: 'text', text: '先输出的正文。' }, { kind: 'reasoning', text: '随后被中断的思考。' }] })
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html.match(/思考中断/gu) ?? []).toHaveLength(1)
  expect(html.match(/已停止/gu) ?? []).toHaveLength(0)
})
