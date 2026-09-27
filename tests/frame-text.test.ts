import { describe, expect, test } from 'vitest'
import { FrameText, type FrameClock } from '../src/client/frame-text.ts'

class Clock implements FrameClock {
  time = 0
  seq = 0
  callbacks = new Map<number, (time: number) => void>()
  requests = 0
  request(callback: (time: number) => void) { this.requests++; this.callbacks.set(++this.seq, callback); return this.seq }
  cancel(id: number) { this.callbacks.delete(id) }
  advance(ms: number) {
    this.time += ms
    const pending = [...this.callbacks.values()]
    this.callbacks.clear()
    pending.forEach(callback => callback(this.time))
  }
}
function fixture(initial = '') {
  const clock = new Clock()
  const output: string[] = []
  const stream = new FrameText(initial, clock, text => output.push(text))
  return { clock, output, stream }
}
describe('display frame scheduling', () => {
  for (const hz of [60, 120, 240]) test(`smooth output follows ${hz} Hz and drains within a short frame budget`, () => {
    const { stream, clock, output } = fixture()
    const text = '按显示帧更新。'.repeat(180)
    stream.update(text, true, 'smooth')
    for (let i = 0; i < Math.ceil(hz * .12); i++) clock.advance(1000 / hz)
    expect(output.length).toBeGreaterThanOrEqual(Math.floor(hz * .05))
    expect(output.at(-1)).toBe(text.slice(0, -1))
    expect(clock.callbacks.size).toBe(0)
    expect(output.every((value, i) => text.startsWith(value) && (i === 0 || value.startsWith(output[i - 1]!)))).toBe(true)
    stream.update(text, false, 'smooth')
    expect(output.at(-1)).toBe(text)
  })
  test('incoming burst renders once per display frame in fade mode', () => {
    const { stream, clock, output } = fixture()
    for (let i = 1; i <= 100; i++) stream.update('x'.repeat(i), true, 'fade')
    expect(clock.requests).toBe(1)
    expect(output).toEqual([])
    clock.advance(4.16)
    expect(output).toEqual(['x'.repeat(100)])
    expect(clock.callbacks.size).toBe(0)
  })
  test('settlement and cancellation publish the exact remaining source immediately', () => {
    const { stream, clock, output } = fixture()
    stream.update('完整 Markdown：**中文** 👩🏽‍💻', true, 'smooth')
    clock.advance(4)
    stream.update('完整 Markdown：**中文** 👩🏽‍💻', false, 'smooth')
    expect(output.at(-1)).toBe('完整 Markdown：**中文** 👩🏽‍💻')
    expect(clock.callbacks.size).toBe(0)
  })
  test('combining marks and ZWJ extensions are held at a grapheme boundary', () => {
    const { stream, clock, output } = fixture()
    for (const chunk of ['A👩', 'A👩🏽', 'A👩🏽‍', 'A👩🏽‍💻', 'A👩🏽‍💻e', 'A👩🏽‍💻é', 'A👩🏽‍💻é终']) {
      stream.update(chunk, true, 'smooth')
      for (let i = 0; i < 26; i++) clock.advance(1000 / 240)
    }
    expect(output.every(text => ['A', 'A👩🏽‍💻', 'A👩🏽‍💻é'].includes(text))).toBe(true)
    stream.update('A👩🏽‍💻é终', false, 'smooth')
    expect(output.at(-1)).toBe('A👩🏽‍💻é终')
  })
  test('replacing or shortening a source cannot replay the old reply', () => {
    const { stream, clock, output } = fixture('旧会话文字')
    stream.update('新的回复', true, 'smooth')
    expect(output).toEqual(['新的回复'])
    clock.advance(100)
    expect(output).toEqual(['新的回复'])
  })
  test('reduced motion and hidden-page flush schedule no background animation', () => {
    const { stream, clock, output } = fixture()
    stream.update('尊重减少动态效果', true, 'smooth', true)
    expect(clock.requests).toBe(0)
    stream.update('尊重减少动态效果，后台显示全文', true, 'smooth')
    stream.flush()
    expect(clock.callbacks.size).toBe(0)
    expect(output.at(-1)).toBe('尊重减少动态效果，后台显示全文')
  })
  test('dispose cancels pending callbacks and rejects subsequent updates', () => {
    const { stream, clock, output } = fixture()
    stream.update('旧会话', true, 'smooth')
    stream.dispose()
    stream.update('不再渲染', false, 'fade')
    clock.advance(100)
    expect(output).toEqual([])
    expect(clock.callbacks.size).toBe(0)
  })
})
