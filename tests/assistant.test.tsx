import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { Assistant } from '../src/client/Assistant.tsx'
import { DEFAULTS, LAYOUTS, type Layout } from '../src/preferences.ts'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/stream.tsx', () => ({ StreamMarkdown: ({ text }: { text: string }) => <p>{text}</p> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ JsonBlock: ({ label }: { label: string }) => <pre>{label}</pre> }))

type Props = ComponentProps<typeof Assistant>
type Data = Props['node']['data']

function unused(): never { throw new Error('Assistant requested an unrelated host capability') }

function props(layout: Layout, blocks: Data['blocks'], status: Data['status'] = 'interrupted', closed = false): Props {
  const finalNode = { kind: 'assistant' as const, seq: 10, time: 100, turn: 1, step: 2, blocks,
    ...(status === 'interrupted' ? { interrupted: true as const } : {}),
  }
  const data = { status, turn: 1, step: 2, blocks, time: 100, ...(status === 'running' ? {} : { finalNode }) }
  const tail = { turn: 1, seq: 11, time: 101, closing: { ...data, finalNode }, branchUnavailable: false }
  // This fixture publishes only turn-tail; other merged keys have no value.
  const useTurnData = ((key: Parameters<Props['useTurnData']>[0]) => key === 'turn-tail' && closed ? tail : undefined) as Props['useTurnData']
  return {
    node: {
      key: 'assistant-step:1:2', id: '1:2', kind: 'assistant-step', target: 'chat', anchorSeq: 2,
      visibility: 'visible', data,
      location: { kind: 'turn', turn: {
        turn: 1, start: undefined, end: undefined, status: closed ? 'closed' : 'open', steps: [],
        data: { get: useTurnData, source: unused },
      } },
    },
    useTurnData,
    useOutputPreferences: selector => selector({ value: { ...DEFAULTS, layout }, status: 'ready', ready: true, writable: true, saving: false, error: false }),
    outputText: key => zh[key], t: key => key,
    openFile: vi.fn(), openSkill: unused, inspectCall: undefined, forkAt: unused,
    fileMentions: vi.fn(() => undefined), renderMessageImages: unused, loadImage: unused,
    useDisclosure: unused, useChat: unused, useConversation: unused, useInput: unused,
    useWorkspaces: unused, useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused,
    useSession: unused, useProjection: unused, sessionId: 'synthetic-output-test' as Props['sessionId'],
    inputActions: { captureInsertion: unused, insertText: unused, setDraft: unused, addAttachments: unused,
      removeAttachment: unused, pruneAttachments: unused, submit: unused },
  }
}

test.each(LAYOUTS)('%s identifies a reasoning-only interruption without inventing an answer card', layout => {
  const html = renderToStaticMarkup(<Assistant {...props(layout, [{ kind: 'reasoning', text: '保留已经收到的思考。' }])} groupPart="reasoning" />)
  expect(html).toContain('保留已经收到的思考。')
  expect(html.match(/已停止/gu)).toHaveLength(1)
  expect(html).not.toContain('class="dsh-output-answer"')
})

test.each(LAYOUTS)('%s reports one interruption across the reasoning and response seats', layout => {
  const shared = props(layout, [{ kind: 'reasoning', text: '检查过程。' }, { kind: 'text', text: '保留部分答复。' }])
  const html = renderToStaticMarkup(<><Assistant {...shared} groupPart="reasoning" /><Assistant {...shared} groupPart="response" /></>)
  expect(html).toContain('检查过程。')
  expect(html).toContain('保留部分答复。')
  expect(html.match(/已停止/gu)).toHaveLength(1)
})

test('a text-only checklist keeps its step heading when the final answer gains file ownership', () => {
  for (const [status, closed] of [['running', false], ['settled', false], ['settled', true]] as const) {
    const value = props('checklist', [{ kind: 'text', text: '完整答复。' }], status, closed)
    const html = renderToStaticMarkup(<Assistant {...value} groupPart="response" />)
    expect(html).toContain('dsh-output-checklist-step')
    expect(html).toContain('步骤 2')
    expect(html).toContain(status === 'running' ? '输出中' : '输出完成')
    if (closed) expect(value.fileMentions).toHaveBeenCalledOnce()
  }
})

test('blank reasoning cannot take the checklist heading away from a visible answer', () => {
  const html = renderToStaticMarkup(<Assistant {...props('checklist', [
    { kind: 'reasoning', text: ' \n ' }, { kind: 'text', text: '只有正文。' },
  ], 'settled', true)} groupPart="response" />)
  expect(html).toContain('步骤 2')
  expect(html).toContain('只有正文。')
})

test('an interrupted checklist placeholder shows one stopped step without an empty answer card', () => {
  const html = renderToStaticMarkup(<Assistant {...props('checklist', [])} />)
  expect(html).toContain('步骤 2')
  expect(html.match(/已停止/gu)).toHaveLength(1)
  expect(html).not.toContain('class="dsh-output-answer"')
})
