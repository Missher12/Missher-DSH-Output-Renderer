// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StreamMarkdown } from '../src/client/stream.tsx'

// Native Markdown owns text rendering; this fixture only exercises fade resources.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  MarkdownText: ({ text }: { text: string }) => <p>{text}</p>,
}))

interface FadeAnimation {
  onfinish: (() => void) | null
  oncancel: (() => void) | null
  cancel(): void
}

let root: Root | undefined
let mount: HTMLDivElement
let hidden = false
let serial = 0
const frames = new Map<number, FrameRequestCallback>()
const animations = new Set<FadeAnimation>()
const measuredText: string[] = []
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')

beforeEach(() => {
  hidden = false
  serial = 0
  frames.clear()
  animations.clear()
  measuredText.length = 0
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++serial, callback)
    return serial
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value(this: Range) {
      measuredText.push(this.toString())
      return [{ left: 0, top: 0, width: 80, height: 20 }]
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value() {
      const animation: FadeAnimation = {
        onfinish: null,
        oncancel: null,
        cancel() { animations.delete(animation); animation.oncancel?.() },
      }
      animations.add(animation)
      return animation
    },
  })
  mount = document.createElement('div')
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = undefined
  mount.remove()
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
  else Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  if (originalRects) Object.defineProperty(Range.prototype, 'getClientRects', originalRects)
  else Reflect.deleteProperty(Range.prototype, 'getClientRects')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function render(text: string) {
  await act(async () => root?.render(<StreamMarkdown text={text} running motion="fade"
    labels={{ code: { copyLabel: 'Copy', copiedLabel: 'Copied', toolbarLabels: { codeLabel: 'Code', wrapLabel: 'Wrap', unwrapLabel: 'Unwrap' } }, footnotes: 'Footnotes' }} />))
}

async function visibility(value: boolean) {
  await act(async () => {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

async function advanceFrame() {
  await act(async () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(callback => callback(16))
  })
}

test('background output stays complete without fade work and foreground resumes on the new suffix', async () => {
  await render('初始文字')
  expect(animations.size).toBeGreaterThan(0)
  expect(mount.querySelector('.dsh-output-fade-layer')?.childElementCount).toBeGreaterThan(0)

  await render('初始文字待显示')
  expect(frames.size).toBeGreaterThan(0)

  await visibility(true)
  expect(animations.size).toBe(0)
  expect(mount.querySelector('.dsh-output-fade-layer')?.childElementCount).toBe(0)
  expect(mount.querySelector('[data-output-text]')?.textContent).toBe('初始文字待显示')
  expect(frames.size).toBe(0)
  const previousMeasurements = measuredText.length

  await render('初始文字待显示后台追加')
  expect(mount.querySelector('[data-output-text]')?.textContent).toBe('初始文字待显示后台追加')
  expect(animations.size).toBe(0)
  expect(frames.size).toBe(0)
  expect(measuredText).toHaveLength(previousMeasurements)

  await visibility(false)
  expect(animations.size).toBe(0)
  await render('初始文字待显示后台追加前台新字')
  await advanceFrame()
  expect(measuredText.slice(previousMeasurements)).toEqual(['前台新字'])
  expect(animations.size).toBeGreaterThan(0)

  await act(async () => root?.unmount())
  root = undefined
  expect(animations.size).toBe(0)
  expect(frames.size).toBe(0)
})
