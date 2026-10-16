import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { Assistant } from '../src/client/Assistant.tsx'
import { DEFAULTS } from '../src/preferences.ts'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/stream.tsx', () => ({ StreamMarkdown: ({ text }: { text: string }) => <p>{text}</p> }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ JsonBlock: ({ label }: { label: string }) => <pre>{label}</pre> }))

type Props = ComponentProps<typeof Assistant>
type Blocks = Props['node']['data']['blocks']

/** Seat surface under test: rc.2 hands down a closure, official alpha.5 a Content Factory. */
interface Seat {
  renderMessageImages?: unknown
  renderFactorySlot?: unknown
  loadImage?: unknown
}

function unused(): never { throw new Error('Assistant requested an unrelated host capability') }

const group: Blocks = [
  { kind: 'image', attachment: { id: 'local-image-1', name: 'demo-1.png' } },
  { kind: 'image', attachment: { id: 'local-image-2', name: 'demo-2.png' } },
] as Blocks

function props(seat: Seat, blocks: Blocks): Props {
  const data = { status: 'settled' as const, turn: 1, step: 2, blocks, time: 100,
    finalNode: { kind: 'assistant' as const, seq: 10, time: 100, turn: 1, step: 2, blocks } }
  const useTurnData = (() => undefined) as Props['useTurnData']
  return {
    node: {
      key: 'assistant-step:1:2', id: '1:2', kind: 'assistant-step', target: 'chat', anchorSeq: 2,
      visibility: 'visible', data,
      location: { kind: 'turn', turn: {
        turn: 1, start: undefined, end: undefined, status: 'closed', steps: [],
        data: { get: useTurnData, source: unused },
      } },
    },
    useTurnData,
    useOutputPreferences: (selector: (state: unknown) => unknown) =>
      selector({ value: { ...DEFAULTS }, status: 'ready', ready: true, writable: true, saving: false, error: false }),
    outputText: (key: keyof typeof zh) => zh[key], t: (key: string) => key,
    openFile: vi.fn(), openSkill: unused, inspectCall: undefined, forkAt: unused,
    fileMentions: vi.fn(() => undefined),
    renderMessageImages: seat.renderMessageImages, renderFactorySlot: seat.renderFactorySlot, loadImage: seat.loadImage,
    useDisclosure: unused, useChat: unused, useConversation: unused, useInput: unused,
    useWorkspaces: unused, useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused,
    useSession: unused, useProjection: unused, sessionId: 'synthetic-output-images' as Props['sessionId'],
    inputActions: { captureInsertion: unused, insertText: unused, setDraft: unused, addAttachments: unused,
      removeAttachment: unused, pruneAttachments: unused, submit: unused },
  } as unknown as Props
}

test('the rc.2 chat closure receives the whole adjacent image group unchanged', () => {
  const renderMessageImages = vi.fn((owner: { images: readonly { attachment: { id: string } }[]; align: string }) =>
    <ul data-gallery={owner.align}>{owner.images.map(image => <li key={image.attachment.id}>{image.attachment.id}</li>)}</ul>)
  const html = renderToStaticMarkup(<Assistant {...props({ renderMessageImages }, group)} groupPart="response" />)
  expect(renderMessageImages).toHaveBeenCalledOnce()
  expect(renderMessageImages.mock.calls[0]![0]).toMatchObject({ align: 'start' })
  expect(renderMessageImages.mock.calls[0]![0].images).toHaveLength(2)
  expect(html).toContain('data-gallery="start"')
  expect(html).toContain('local-image-1')
  expect(html).toContain('local-image-2')
})

test('a host without the chat closure is served by the shared images Factory', () => {
  const loadImage = vi.fn(async () => 'blob:isolated')
  const renderFactorySlot = vi.fn((name: string, input: { images: readonly unknown[]; align: string }) =>
    <ul data-factory={name} data-align={input.align}>{input.images.length}</ul>)
  const html = renderToStaticMarkup(<Assistant {...props({ renderFactorySlot, loadImage }, group)} groupPart="response" />)
  expect(renderFactorySlot).toHaveBeenCalledOnce()
  expect(renderFactorySlot.mock.calls[0]![0]).toBe('conversation.images.content')
  expect(renderFactorySlot.mock.calls[0]![1]).toMatchObject({ align: 'start', loadImage })
  expect(renderFactorySlot.mock.calls[0]![1].images).toHaveLength(2)
  expect(html).toContain('data-factory="conversation.images.content"')
  expect(html).not.toContain(zh.imagesUnavailable)
})

test('every Factory call carries a fallback, because the seat exists without the name being registered', () => {
  const loadImage = vi.fn(async () => 'blob:isolated')
  const renderFactorySlot = vi.fn(() => <ul data-gallery="registered" />)
  renderToStaticMarkup(<Assistant {...props({ renderFactorySlot, loadImage }, group)} groupPart="response" />)
  expect(renderFactorySlot.mock.calls[0]![2]).toMatchObject({ fallback: expect.anything() })
})

test('an unregistered gallery keeps a visible note because the Factory arm passed a fallback', () => {
  // Mirrors the renderer's own outlet: an unregistered name answers with `fallback ?? null` and nothing else.
  const renderFactorySlot = vi.fn((_name: string, _input: unknown, options?: { fallback?: unknown }) =>
    <>{options?.fallback ?? null}</>)
  const loadImage = vi.fn(async () => 'blob:isolated')
  const html = renderToStaticMarkup(<Assistant {...props({ renderFactorySlot, loadImage }, group)} groupPart="response" />)
  expect(renderFactorySlot).toHaveBeenCalledOnce()
  expect(html).toContain(zh.imagesUnavailable)
})

test('the rc.2 closure keeps priority when a host publishes both galleries', () => {
  const renderMessageImages = vi.fn(() => <ul data-gallery="closure" />)
  const renderFactorySlot = vi.fn(() => <ul data-gallery="factory" />)
  const html = renderToStaticMarkup(<Assistant
    {...props({ renderMessageImages, renderFactorySlot, loadImage: vi.fn() }, group)} groupPart="response" />)
  expect(html).toContain('data-gallery="closure"')
  expect(renderFactorySlot).not.toHaveBeenCalled()
})

test('a Factory published without an authorized loader is reported instead of called', () => {
  const renderFactorySlot = vi.fn(() => <ul data-gallery="factory" />)
  const html = renderToStaticMarkup(<Assistant {...props({ renderFactorySlot }, group)} groupPart="response" />)
  expect(renderFactorySlot).not.toHaveBeenCalled()
  expect(html).toContain(zh.imagesUnavailable)
})

test('an image block on a host with no gallery is reported visibly, never dropped silently', () => {
  const html = renderToStaticMarkup(<Assistant {...props({}, group)} groupPart="response" />)
  expect(html).toContain(zh.imagesUnavailable)
  expect(html).toContain('class="dsh-output-answer"')
})

test('one image block renders one group without consuming the text block that follows', () => {
  const renderMessageImages = vi.fn((owner: { images: readonly unknown[] }) => <ul data-gallery={owner.images.length} />)
  const blocks = [group[0]!, { kind: 'text', text: '图片之后的正文。' }] as Blocks
  const html = renderToStaticMarkup(<Assistant {...props({ renderMessageImages }, blocks)} groupPart="response" />)
  expect(renderMessageImages).toHaveBeenCalledOnce()
  expect(html).toContain('data-gallery="1"')
  expect(html).toContain('图片之后的正文。')
})
