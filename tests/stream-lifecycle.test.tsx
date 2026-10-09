// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { StreamMarkdown } from '../src/client/stream.tsx'

const markdownFixture = vi.hoisted(() => ({ nestedCode: false }))

// Native Markdown owns text rendering; this fixture only exercises fade resources.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  MarkdownText: ({ text }: { text: string }) => {
    if (!markdownFixture.nestedCode) return <p>{text}</p>
    const [toolbar = '', body = ''] = text.split('|', 2)
    return <ul><li>
      <div data-code-block-banner><span>{toolbar}</span></div>
      <button type="button">{toolbar} copy</button>
      <span role="button">{toolbar} wrap</span>
      <span aria-hidden="true">{toolbar} decoration</span>
      <pre><code>{body}</code></pre>
    </li></ul>
  },
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
  markdownFixture.nestedCode = false
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

test.each(['完全修正后的答复', '原本'])('replacing streamed text with %s removes obsolete fade masks immediately', async replacement => {
  await render('原本较长的答复内容')
  expect(animations.size).toBeGreaterThan(0)
  expect(mount.querySelector('.dsh-output-fade-layer')?.childElementCount).toBeGreaterThan(0)
  const previousMeasurements = measuredText.length

  await render(replacement)
  expect(mount.querySelector('[data-output-text]')?.textContent).toBe(replacement)
  expect(animations.size).toBe(0)
  expect(mount.querySelector('.dsh-output-fade-layer')?.childElementCount).toBe(0)
  expect(frames.size).toBe(0)
  expect(measuredText).toHaveLength(previousMeasurements)

  await render(replacement + '新增正文')
  await advanceFrame()
  expect(measuredText.slice(previousMeasurements)).toEqual(['新增正文'])
  expect(animations.size).toBeGreaterThan(0)
})

test('nested code banners and controls stay outside the fading text', async () => {
  markdownFixture.nestedCode = true
  await render('TypeScript|初始代码')
  expect(measuredText).toEqual(['初始代码'])
  await visibility(true)
  await visibility(false)
  const previousMeasurements = measuredText.length

  await render('JavaScript|初始代码')
  await advanceFrame()
  expect(measuredText).toHaveLength(previousMeasurements)
  expect(animations.size).toBe(0)
  expect(mount.querySelector('.dsh-output-fade-layer')?.childElementCount).toBe(0)

  await render('JavaScript|初始代码新增代码')
  await advanceFrame()
  expect(measuredText.slice(previousMeasurements)).toEqual(['新增代码'])
  expect(animations.size).toBeGreaterThan(0)
})
