// @vitest-environment jsdom
import { act } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Assistant } from '../src/client/Assistant.tsx'
import { ActivityTail } from '../src/client/ActivityTail.tsx'
import { ActivityDock } from '../src/client/ActivityDock.tsx'
import { activities, activitySegments, cleanTurnRules, toolVisibilitySignature } from '../src/client/Edits.tsx'
import type { ToolChatData } from '@deepseek-ai/dsh-client-ui-chat/client'
import { DEFAULTS, type Layout } from '../src/preferences.ts'
import { en, zh } from '../src/client/locales.ts'

vi.mock('../src/client/stream.tsx', () => ({ StreamMarkdown: ({ text }: { text: string }) => <p>{text}</p> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ JsonBlock: ({ label }: { label: string }) => <pre>{label}</pre> }))

type SeatProps = ComponentProps<typeof Assistant>
type TailProps = ComponentProps<typeof ActivityTail>
type DockProps = ComponentProps<typeof ActivityDock>
type Data = SeatProps['node']['data']

function unused(): never { throw new Error('Assistant requested an unrelated host capability') }

/** The result metadata a successful write/edit really reports. */
const wrote = (path: string, changed = true) => ({ path, diffs: changed ? [{ path, oldText: 'a', newText: 'b' }] : [] })

/** One settled tool node with a matched call head. */
function settled(callId: string, name: string, args: unknown, options: { isError?: boolean; meta?: unknown; content?: string } = {}): ToolChatData {
  return { root: { kind: 'tool-result', seq: 1, time: 1, callId, call: { name, argsRaw: JSON.stringify(args) },
    callTime: 1, content: options.content === undefined ? [] : [{ type: 'text', text: options.content }],
    isError: options.isError ?? false, meta: options.meta, subCalls: [] } } as ToolChatData
}

/** One dispatched tool node without a result yet. */
function started(callId: string, name: string, args: unknown): ToolChatData {
  return { root: { phase: 'start', callId, name, turn: 1, step: 1, time: 1, argsRaw: JSON.stringify(args), subCalls: [] } } as ToolChatData
}

/**
 * A Chat snapshot over an explicit Node list. `turnDataSource` is a class-style method that reads
 * `this`, exactly like the installed host, and the Location index returns the Turn's real node keys.
 */
function chatSnapshot(tools: readonly ToolChatData[], options: { noToolSource?: boolean; noNodeGet?: boolean } = {}) {
  const entries = tools.map((tool, index) => ({ key: `tool-${index}`, kind: 'tool-call', data: tool }))
  const byKey = new Map(entries.map(entry => [entry.key, entry]))
  const toolData = entries.map(entry => entry.data as ToolChatData)
  const source = { getSnapshot: () => toolData, subscribe: () => () => {} }
  const nodes: Record<string, unknown> = { values: () => entries }
  if (options.noNodeGet !== true) nodes.get = (key: string) => byKey.get(key)
  if (options.noToolSource !== true) {
    nodes.turnKind = function (turn: number, kind: string) { return { turn, kind, source: () => source } }
    nodes.turnDataSource = function (turn: number, kind: string) {
      const self = this as { turnKind: (t: number, k: string) => { source: () => typeof source } }
      return self.turnKind(turn, kind).source()
    }
  }
  return { locations: { getTurn: () => entries.map(entry => entry.key) }, nodes }
}

function preferences(layout: Layout) {
  return (selector: (value: unknown) => unknown) => selector({
    value: { ...DEFAULTS, layout }, status: 'ready', ready: true, writable: true, saving: false, error: false,
  })
}

/** Public Turn snapshot for one seat: open while running, closed with the given end otherwise. */
function turnSnapshotOf(status: Data['status'], step: number, data: Data) {
  const last = { step, data: { get: (key: string) => key === 'assistant-step' ? data : undefined } }
  const end = status === 'running' ? undefined
    : status === 'interrupted' ? { data: { reason: { kind: 'aborted' } } }
      : { data: { reason: { kind: 'completed' } } }
  return { timeline: { turnOrder: [1], turns: new Map([[1, {
    turn: 1, status: end === undefined ? 'open' : 'closed', end, steps: [last],
  }]]) } }
}

/** One Assistant seat, exactly as the host renders it inside the Turn flow. */
function seat(options: { blocks: Data['blocks']; layout?: Layout; status?: Data['status']; step?: number }): SeatProps {
  const { blocks, layout = 'cards', status = 'settled', step = 2 } = options
  const finalNode = { kind: 'assistant' as const, seq: 10, time: 100, turn: 1, step, blocks,
    ...(status === 'interrupted' ? { interrupted: true as const } : {}) }
  const data = { status, turn: 1, step, blocks, time: 100, ...(status === 'running' ? {} : { finalNode }) }
  const useTurnData = (() => undefined) as SeatProps['useTurnData']
  return {
    node: {
      key: `assistant-step:1:${step}`, id: `1:${step}`, kind: 'assistant-step', target: 'chat', anchorSeq: 2,
      visibility: 'visible', data,
      location: { kind: 'turn', turn: {
        turn: 1, start: undefined, end: undefined, status: 'open', steps: [],
        data: { get: useTurnData, source: unused },
      } },
    },
    useTurnData,
    useChat: ((selector: (value: unknown) => unknown) => selector(turnSnapshotOf(status, step, data))) as SeatProps['useChat'],
    useSessionStatus: ((selector: (value: unknown) => unknown) => selector(new Map())) as SeatProps['useSessionStatus'],
    useOutputPreferences: preferences(layout) as SeatProps['useOutputPreferences'],
    outputText: key => zh[key], t: key => key,
    openFile: vi.fn(), inspectCall: undefined,
    openSkill: unused, forkAt: unused, fileMentions: vi.fn(() => undefined),
    renderMessageImages: vi.fn(() => null), loadImage: unused,
    useDisclosure: unused, useChatNode: unused, useConversation: unused, useInput: unused,
    useWorkspaces: unused, useSessions: unused, useSessionRetainInfo: unused,
    useSession: unused, useProjection: unused, sessionId: 'synthetic-seat' as SeatProps['sessionId'],
    inputActions: { captureInsertion: unused, insertText: unused, setDraft: unused, addAttachments: unused,
      removeAttachment: unused, pruneAttachments: unused, submit: unused },
  } as unknown as SeatProps
}

/** One public Turn-tail entry, as the shipped Chat view renders it. */
function tail(options: {
  tools?: readonly ToolChatData[]
  layout?: Layout
  openFile?: TailProps['openFile']
  chat?: unknown
  sessionId?: string
  turn?: number
  /** Overrides the whole owner currency, so both host contracts can be exercised. */
  turnRaw?: unknown
} = {}): TailProps {
  const snapshot = options.chat ?? chatSnapshot(options.tools ?? [])
  return {
    // `undefined` means “object contract”; an explicit null stays null so invalid owners are testable.
    turn: options.turnRaw === undefined ? { turn: options.turn ?? 1 } : options.turnRaw,
    seq: 10,
    openFile: options.openFile ?? vi.fn(),
    useChat: ((selector: (value: unknown) => unknown) => selector(snapshot)) as TailProps['useChat'],
    useSessionStatus: ((selector: (value: unknown) => unknown) => selector(new Map())) as TailProps['useSessionStatus'],
    sessionId: (options.sessionId ?? currentSession) as TailProps['sessionId'],
    useOutputPreferences: preferences(options.layout ?? 'cards') as TailProps['useOutputPreferences'],
    outputText: (key: keyof typeof zh) => zh[key],
  } as unknown as TailProps
}

/** Snapshot for the dock: one latest Turn plus an optional published turn-tail node. */
function dockSnapshot(tools: readonly ToolChatData[], options: { published?: boolean; noNodeGet?: boolean; turn?: number; closed?: boolean } = {}) {
  const turn = options.turn ?? 5
  const entries = [
    ...tools.map((tool, index) => ({ key: `tool-${index}`, kind: 'tool-call', data: tool })),
    ...(options.published === true ? [{ key: 'tail-5', kind: 'turn-tail', data: {} }] : []),
  ]
  const byKey = new Map(entries.map(entry => [entry.key, entry]))
  const toolData = entries.filter(entry => entry.kind === 'tool-call').map(entry => entry.data as ToolChatData)
  const source = { getSnapshot: () => toolData, subscribe: () => () => {} }
  const nodes: Record<string, unknown> = { values: () => entries }
  if (options.noNodeGet !== true) nodes.get = (key: string) => byKey.get(key)
  nodes.turnKind = function (t: number, kind: string) { return { turn: t, kind, source: () => source } }
  nodes.turnDataSource = function (t: number, kind: string) {
    const self = this as { turnKind: (a: number, b: string) => { source: () => typeof source } }
    return self.turnKind(t, kind).source()
  }
  return {
    timeline: { turnOrder: [turn], turns: new Map([[turn, { turn, status: options.closed === true ? 'closed' : 'open' }]]) },
    locations: { getTurn: (t: number) => t === turn ? entries.map(entry => entry.key) : [] },
    nodes,
  }
}

/** One input-dock entry, as the shipped input zone renders it. */
function dock(options: {
  tools?: readonly ToolChatData[]
  published?: boolean
  layout?: Layout
  sessionId?: string
  canOpenFile?: boolean
  pending?: boolean
  chat?: unknown
  useSessionStatus?: unknown
  useChat?: unknown
  openFile?: DockProps['openFile']
} = {}): DockProps {
  const snapshot = options.chat ?? dockSnapshot(options.tools ?? [], { published: options.published })
  return {
    session: { sessionId: options.sessionId ?? currentSession },
    input: {},
    // Presence, not `??`: an explicit undefined must mean “this host lacks the hook”.
    useChat: 'useChat' in options ? options.useChat : ((selector: (value: unknown) => unknown) => selector(snapshot)),
    useSessionStatus: 'useSessionStatus' in options ? options.useSessionStatus : ((selector: (value: unknown) => unknown) => selector(
      new Map(options.pending === true ? [[options.sessionId ?? currentSession, { pendingInteraction: { kind: 'approval' } }]] : []))),
    sessionId: (options.sessionId ?? currentSession) as DockProps['sessionId'],
    useOutputPreferences: preferences(options.layout ?? 'cards') as DockProps['useOutputPreferences'],
    outputText: (key: keyof typeof zh) => zh[key],
    openFile: options.openFile ?? vi.fn(),
    canOpenFile: options.canOpenFile ?? true,
  } as unknown as DockProps
}

let root: Root | undefined
let mount: HTMLDivElement
let currentSession = ''
let sessionCounter = 0

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // A fresh session per test: the fold store is session keyed and survives mounts on purpose.
  currentSession = `synthetic-${++sessionCounter}`
  mount = document.createElement('div')
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(async () => {
  if (root) await act(async () => { root?.unmount() })
  root = undefined
  mount.remove()
  for (const style of document.head.querySelectorAll('style[data-output-clean-turn]')) style.remove()
  vi.unstubAllGlobals()
})

async function render(element: ReactElement) {
  await act(async () => { root?.render(element) })
}

const summary = () => mount.querySelector('.dsh-output-activity-toggle')
const body = () => mount.querySelector<HTMLElement>('.dsh-output-activity-body')
const rows = () => [...mount.querySelectorAll('.dsh-output-activity-row')]
/** Segment labels as rendered; the visual gap is drawn by CSS, not by text nodes. */
const labels = () => [...mount.querySelectorAll('.dsh-output-activity-segment-text')].map(node => node.textContent)
const accessible = () => summary()?.getAttribute('aria-label') ?? ''
const leading = () => mount.querySelectorAll('.dsh-output-activity-leading').length
const styles = () => [...document.head.querySelectorAll<HTMLStyleElement>('style[data-output-clean-turn]')]
const installed = () => styles().map(style => style.textContent ?? '').join('')

const editNode = settled('c1', 'edit', { file_path: '/repo/src/a.ts' }, { meta: wrote('/repo/src/a.ts') })
const readNode = settled('c2', 'read', { file_path: '/repo/docs/notes.md' })
const searchNode = settled('c3', 'grep', { pattern: '220', path: '/repo/src' })
const commandNode = settled('c4', 'bash', { command: 'npm test' }, { content: '(no output)' })
const mixed = [editNode, readNode, searchNode, commandNode]

test('a trusted finish retires settled history but never a live deep call or unreadable nodes', () => {
  const child = settled('c1', 'read', { file_path: '/repo/a.ts' })
  ;(child.root as unknown as { subCalls: unknown[] }).subCalls = [started('g1', 'bash', { command: 'x' })]
  const parent = settled('p1', 'run_code', {})
  ;(parent.root as unknown as { subCalls: unknown[] }).subCalls = [child]
  expect(toolVisibilitySignature(chatSnapshot([parent]), 1, true)).toBeUndefined()
  const retry = { locations: { getTurn: () => ['retry-1', 'error-1'] }, nodes: {
    get: (key: string) => key === 'retry-1' ? { kind: 'model-retry', data: {} }
      : key === 'error-1' ? { kind: 'turn-error', data: {} } : undefined,
    turnDataSource: () => ({ getSnapshot: () => [], subscribe: () => () => {} }),
  } }
  const signature = toolVisibilitySignature(retry as never, 3, true)
  expect(cleanTurnRules(3, signature)).toContain('retry-1')
  expect(cleanTurnRules(3, signature)).toContain('error-1')
})

test('cards previews the active latest step, then keeps only the trusted final seat', async () => {
  const runningSeat = seat({ status: 'running', step: 1, blocks: [{ kind: 'text', text: '中间预览。' }] })
  await render(<Assistant {...runningSeat} />)
  expect(mount.textContent).toContain('中间预览。')
  expect(mount.querySelector('[data-output-preview]')).not.toBeNull()
  // The Turn ends with a trusted final step: the preview and every earlier seat disappear.
  await render(<Assistant {...seat({ status: 'settled', step: 2, blocks: [{ kind: 'text', text: '最终答复。' }] })} />)
  expect(mount.textContent).toContain('最终答复。')
  expect(mount.textContent).not.toContain('中间预览。')
  expect(mount.querySelector('[data-output-preview]')).toBeNull()
})

test('search rows keep the full scope and distinct scopes count separately', async () => {
  const scoped = settled('s1', 'grep', { pattern: '220', path: '/repo/src' })
  const other = settled('s2', 'grep', { pattern: '220', path: '/repo/docs' })
  await render(<ActivityTail {...tail({ tools: [scoped, other] })} />)
  expect(labels()).toEqual([`${zh.activitySearchedTimes} 2 ${zh.activityTimes}`])
  await act(async () => { summary()!.click() })
  expect(rows()[0]?.textContent).toContain('/repo/src')
  expect(rows()[0]?.textContent).toContain('220')
  expect(rows()[1]?.textContent).toContain('/repo/docs')
})

test('a query-only search states one predicate in both running and done', async () => {
  await render(<ActivityTail {...tail({ tools: [settled('s1', 'grep', { pattern: '220' })] })} />)
  await act(async () => { summary()!.click() })
  expect(rows()[0]?.textContent).toContain(`${zh.rowSearched} ‘220’`)
})

test('the concise seat hides the thinking text and the tail carries the summary', async () => {
  await render(<>
    <Assistant {...seat({ blocks: [{ kind: 'reasoning', text: '不应出现的思考。' }, { kind: 'text', text: '可见的答复。' }] })} />
    <ActivityTail {...tail({ tools: [readNode] })} />
  </>)
  expect(mount.textContent).toContain('可见的答复。')
  expect(mount.textContent).not.toContain('不应出现的思考。')
  expect(mount.querySelector('.dsh-output-reasoning')).toBeNull()
  expect(labels()).toEqual([zh.shortRead])
  expect(accessible()).toContain('1')
  expect(styles()).toHaveLength(1)
})

test('the installed owner contract passes the Turn number itself', async () => {
  await render(<ActivityTail {...tail({ tools: [readNode], turnRaw: 1 })} />)
  expect(labels()).toEqual([zh.shortRead])
  expect(styles()).toHaveLength(1)
})

test('an unusable owner currency renders nothing and hides nothing', async () => {
  await render(<ActivityTail {...tail({ tools: mixed, turnRaw: { turn: Number.NaN } })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityTail {...tail({ tools: mixed, turnRaw: null })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('a tool-only Turn with no visible Assistant still gets one summary and one controller', async () => {
  await render(<ActivityTail {...tail({ tools: [readNode, searchNode] })} />)
  expect(mount.querySelector('.dsh-output-assistant')).toBeNull()
  expect(labels()).toEqual([`${zh.activityReadFiles} 1 ${zh.activityFile}`, `${zh.activitySearchedTimes} 1 ${zh.activityTime}`])
  expect(separators()).toBe(1)
  expect(styles()).toHaveLength(1)
})

test('a reasoning-only Seat renders no thinking and the tail still owns the summary', async () => {
  await render(<>
    <Assistant {...seat({ blocks: [{ kind: 'reasoning', text: '只有思考。' }] })} groupPart="reasoning" />
    <ActivityTail {...tail({ tools: [readNode] })} />
  </>)
  expect(mount.textContent).not.toContain('只有思考。')
  expect(summary()).not.toBeNull()
  expect(styles()).toHaveLength(1)
})

test('the seat alone no longer owns the summary or the controller', async () => {
  await render(<Assistant {...seat({ blocks: [{ kind: 'text', text: '答复。' }] })} />)
  expect(summary()).toBeNull()
  expect(styles()).toHaveLength(0)
})

test('the other layouts keep the fully expanded reasoning and the tail stays inert', async () => {
  await render(<>
    <Assistant {...seat({ layout: 'reader', blocks: [
      { kind: 'reasoning', text: '完整思考。' }, { kind: 'text', text: '答复。' }] })} />
    <ActivityTail {...tail({ layout: 'reader', tools: mixed })} />
  </>)
  expect(mount.querySelector('.dsh-output-reasoning')?.textContent).toContain('完整思考。')
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('activity of every kind becomes one collapsed summary line with counted verbs', async () => {
  await render(<ActivityTail {...tail({ tools: mixed })} />)
  expect(labels()).toEqual([zh.shortEdited, zh.shortRead, zh.shortSearched, zh.shortRan])
  expect(accessible()).toContain(zh.activityEditedFiles)
  expect(summary()?.getAttribute('aria-expanded')).toBe('false')
  expect(body()?.hasAttribute('hidden')).toBe(true)
  expect(summary()?.querySelectorAll('.dsh-output-activity-segment-text')).toHaveLength(4)
  expect(leading()).toBe(1)
  expect(summary()!.lastElementChild?.className).toContain('dsh-output-activity-arrow')
  const css = installed()
  for (let index = 0; index < mixed.length; index += 1) expect(css).toContain(`[data-chat-node-key="tool-${index}"]`)
})

test('expanding lists real activity; file rows open the file and query rows stay plain', async () => {
  const openFile = vi.fn()
  await render(<ActivityTail {...tail({ tools: mixed, openFile })} />)
  await act(async () => { summary()!.click() })
  expect(body()?.hasAttribute('hidden')).toBe(false)
  expect(rows().map(row => row.getAttribute('data-output-activity'))).toEqual(['edit', 'read', 'search', 'command'])
  expect(rows()[0]?.textContent).toContain(zh.rowEdited)
  expect(rows()[1]?.textContent).toContain('notes.md')
  expect(rows()[2]?.textContent).toContain('220')
  expect(rows()[3]?.textContent).toContain('npm test')
  // The tail owner face has no native detail opener, so file names stay clickable and other targets
  // are plain text rather than a dead control.
  expect(rows()[2]?.querySelector('button')).toBeNull()
  await act(async () => { (rows()[1]!.querySelector('button.dsh-output-activity-target') as HTMLButtonElement).click() })
  expect(openFile).toHaveBeenCalledWith('/repo/docs/notes.md')
})

test('counted verbs and plural nouns follow the count', () => {
  const twoReads = activities([readNode, settled('c9', 'read', { file_path: '/repo/two.md' })])
  expect(activitySegments(twoReads, key => en[key]).map(segment => segment.label)).toEqual(['Read 2 files'])
  expect(activitySegments(activities([readNode]), key => en[key]).map(segment => segment.label)).toEqual(['Read 1 file'])
  // A settled read without a path is not countable: it uses the category verb, never “1 files”.
  expect(activitySegments(activities([settled('r1', 'read', {})]), key => en[key]).map(segment => segment.label))
    .toEqual([en.activityRead])
  // A running call with no target is stated in progress instead.
  expect(activitySegments(activities([started('r2', 'read', {})]), key => en[key]).map(segment => segment.label))
    .toEqual([en.activityReading])
})

test('a running read is stated in progress', async () => {
  await render(<ActivityTail {...tail({ tools: [started('r1', 'read', { file_path: '/repo/a.ts' })] })} />)
  expect(labels()).toEqual([`${zh.activityReading} 1 ${zh.activityFile}`])
})

test('the same file edited twice still counts once', async () => {
  await render(<ActivityTail {...tail({ tools: [
    settled('c1', 'edit', { file_path: '/repo/a.ts' }, { meta: wrote('/repo/a.ts') }),
    settled('c2', 'edit', { file_path: '/repo/a.ts' }, { meta: wrote('/repo/a.ts') }),
  ] })} />)
  expect(labels()).toEqual([`${zh.activityEditedFiles} 1 ${zh.activityFile}`])
})

test('failures, interactive tools and unknown tools stay native and out of the summary', async () => {
  await render(<ActivityTail {...tail({ tools: [
    settled('c1', 'read', { file_path: '/repo/a.ts' }, { isError: true }),
    started('c2', 'ask_user_question', { question: '?' }),
    settled('c3', 'send_message', { text: 'hi' }),
  ] })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('a mixed Turn keeps the failing row and hides only the proven one', async () => {
  await render(<ActivityTail {...tail({ tools: [
    readNode,
    settled('c9', 'bash', { command: 'x' }, { content: 'boom\n[exit code: 2]' }),
  ] })} />)
  expect(labels()).toEqual([`${zh.activityReadFiles} 1 ${zh.activityFile}`])
  const css = installed()
  expect(css).toContain('[data-chat-node-key="tool-0"]')
  expect(css).not.toContain('[data-chat-node-key="tool-1"]')
})

test('a plain foreground shell success without any marker is clean, per the real tool contract', async () => {
  const plainBash = settled('t1', 'bash', { command: 'ls' }, { content: 'file-a\nfile-b' })
  await render(<ActivityTail {...tail({ tools: [plainBash] })} />)
  expect(labels()).toEqual([`${zh.activityRanCommands} 1 ${zh.activityCommand}`])
  expect(installed()).toContain('[data-chat-node-key="tool-0"]')
})

test('background, timeout, stopped, denied, persistent and non-zero runs are never claimed finished', () => {
  const state = (tools: readonly ToolChatData[]) => {
    const signature = toolVisibilitySignature(chatSnapshot(tools), 1)
    return JSON.parse(signature ?? '{}').rows?.[0]?.[1]
  }
  expect(state([settled('t', 'bash', { command: 'x' }, { content: '(no output)' })])).toBe('clean')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: 'started background job b-12' })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: 'work\n[timed out after 1000ms]' })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: 'work\n[stopped: user]' })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: '[sandbox: file access denied under workspace-write mode]' })])).toBe('attention')
  expect(state([settled('t', 'bash_persistent', { command: 'x' }, { content: '(no output)' })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: 'ok\n[exit code: 0]\nmore\n[exit code: 7]' })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: '[exit code: 0]\n[killed by signal: SIGKILL]', meta: { exitCode: 0 } })])).toBe('attention')
  expect(state([settled('t', 'bash', { command: 'x' }, { content: 'ran\n[exit code: null]' })])).toBe('attention')
})

test('the fold stays open across a real tail remount for the same session and Turn', async () => {
  await render(<ActivityTail key="first" {...tail({ tools: [readNode] })} />)
  await act(async () => { summary()!.click() })
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
  await render(<ActivityTail key="second" {...tail({ tools: [readNode] })} />)
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
})

test('a different Session or Turn starts collapsed', async () => {
  await render(<ActivityTail {...tail({ tools: [readNode] })} />)
  await act(async () => { summary()!.click() })
  await render(<ActivityTail {...tail({ tools: [readNode], sessionId: 'other-session' })} />)
  expect(summary()?.getAttribute('aria-expanded')).toBe('false')
})

test('a host lacking the Tool list reader hides nothing and shows no summary', async () => {
  await render(<ActivityTail {...tail({ tools: mixed, chat: chatSnapshot(mixed, { noToolSource: true }) })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('a host missing nodes.get but holding the Tool source keeps native rows without throwing', async () => {
  await render(<ActivityTail {...tail({ tools: mixed, chat: chatSnapshot(mixed, { noNodeGet: true }) })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('a host without any Chat reader shows no summary and installs no rules', async () => {
  await render(<ActivityTail {...tail({ tools: mixed, chat: {} })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('a re-render with unchanged tools keeps the same single stylesheet', async () => {
  await render(<ActivityTail {...tail({ tools: [readNode] })} />)
  const first = styles()[0]
  expect(first).toBeDefined()
  await render(<ActivityTail {...tail({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
  expect(styles()[0]).toBe(first)
})

test('unmounting the tail removes its rules and restores the native rows', async () => {
  await render(<ActivityTail {...tail({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
  await act(async () => { root!.unmount() })
  root = undefined
  expect(styles()).toHaveLength(0)
})

test('two sessions on Turn 1 do not share rules: node keys, not the Turn number, decide', () => {
  const cleanA = toolVisibilitySignature(chatSnapshot([readNode]), 1)
  const failedB = toolVisibilitySignature(chatSnapshot([settled('x', 'bash', { command: 'x' }, { content: '[exit code: 7]' })]), 1)
  expect(cleanTurnRules(1, cleanA)).toContain('[data-chat-node-key="tool-0"]')
  expect(cleanTurnRules(1, failedB)).toBe('')
  for (const rule of cleanTurnRules(1, cleanA).split('html[data-dsh-output-renderer="cards"] ').slice(1)) {
    if (rule.includes('[data-step-process]')) expect(rule).toContain('[data-chat-node-key="tool-0"]')
  }
})

test('activity classification follows the real tool names', () => {
  const records = activities([
    settled('e1', 'write', { file_path: '/repo/a.ts' }, { meta: wrote('/repo/a.ts') }),
    settled('v1', 'str_replace_editor', { command: 'view', path: '/repo/b.ts' }),
    settled('r1', 'read_image', { file_path: '/repo/c.png' }),
    settled('s1', 'glob', { pattern: '**/*.ts' }),
    started('q1', 'bash', { command: 'ls' }),
  ])
  expect(records.map(record => `${record.kind}:${record.status}:${record.path ?? record.query ?? record.command ?? '?'}`)).toEqual([
    'edit:done:/repo/a.ts',
    'read:done:/repo/b.ts',
    'read:done:/repo/c.png',
    'search:done:**/*.ts',
    'command:running:ls',
  ])
})

test('the dock carries the live Turn summary while no real tail exists', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  expect(mount.querySelector('.dsh-output-assistant')).toBeNull()
  expect(labels()).toEqual([`${zh.activityReadFiles} 1 ${zh.activityFile}`])
  expect(styles()).toHaveLength(1)
})

test('the dock survives the Turn closing and hands over only when the tail is published', async () => {
  // UI96 was a running tool-only Turn that never produced a tail; the dock covers that. The same
  // entry must also survive the `turn/end` state change until the tail node itself appears.
  await render(<ActivityDock {...dock({ chat: dockSnapshot([readNode], { turn: 5 }) })} />)
  expect(summary()).not.toBeNull()
  await render(<ActivityDock {...dock({ chat: dockSnapshot([readNode], { turn: 5, closed: true }) })} />)
  expect(summary()).not.toBeNull()
  const withTail = dockSnapshot([readNode], { turn: 5, closed: true, published: true })
  await render(<>
    <ActivityDock {...dock({ chat: withTail })} />
    <ActivityTail {...tail({ chat: withTail, turnRaw: { turn: 5 } })} />
  </>)
  expect(mount.querySelectorAll('.dsh-output-activity-toggle')).toHaveLength(1)
})

test('a pending interaction revoked only after rules exist unmounts and restores them', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode], pending: false })} />)
  expect(summary()).not.toBeNull()
  expect(styles()).toHaveLength(1)
  await render(<ActivityDock {...dock({ tools: [readNode], pending: true })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode], pending: false })} />)
  expect(summary()).not.toBeNull()
  expect(styles()).toHaveLength(1)
})

test('a capability that disappears and returns remounts one controller without leaking rules', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
  // The host loses `useChat`: the shell drops the ready child, its hooks and its rules.
  await render(<ActivityDock {...dock({ tools: [readNode], useChat: undefined })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode], useChat: undefined, useSessionStatus: undefined })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
})

test('publishing the real tail retires the dock and the tail keeps the same fold', async () => {
  const live = dockSnapshot([readNode], { published: false })
  await render(<ActivityDock {...dock({ chat: live, tools: [readNode] })} />)
  await act(async () => { summary()!.click() })
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
  // The documented order: the same Turn 5 gains its real tail node, so the dock gives the entry up.
  const closed = dockSnapshot([readNode], { published: true, closed: true })
  await render(<>
    <ActivityDock {...dock({ chat: closed, tools: [readNode] })} />
    <ActivityTail {...tail({ chat: closed, turnRaw: { turn: 5 } })} />
  </>)
  expect(mount.querySelectorAll('.dsh-output-activity-toggle')).toHaveLength(1)
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
  expect(styles()).toHaveLength(1)
})

test('a pending interaction unmounts the dock and its hiding rules', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode], pending: true })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('the dock fold is per Session and per Turn', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  await act(async () => { summary()!.click() })
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
  await render(<ActivityDock {...dock({ tools: [readNode], sessionId: 'other-session' })} />)
  expect(summary()?.getAttribute('aria-expanded')).toBe('false')
})

test('the dock fails open without its hooks, readers or file service', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode], canOpenFile: false })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode], useSessionStatus: undefined })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode], chat: { locations: {}, nodes: {} } })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode], chat: dockSnapshot([readNode], { noNodeGet: true }) })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
})

test('the dock retires on a layout switch or unmount and cleans its rules', async () => {
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
  await render(<ActivityDock {...dock({ tools: [readNode], layout: 'reader' })} />)
  expect(summary()).toBeNull()
  expect(installed()).toBe('')
  await render(<ActivityDock {...dock({ tools: [readNode] })} />)
  expect(styles()).toHaveLength(1)
  await act(async () => { root!.unmount() })
  root = undefined
  expect(styles()).toHaveLength(0)
})
