/** A demand-driven frame clock. No timers and no fixed 30/60 Hz cap. */
import type { Motion } from '../preferences.ts'

export interface FrameClock {
  request(callback: (time: number) => void): number
  cancel(id: number): void
}

/**
 * Coalesce incoming chunks on the next display frame. Smooth mode drains its
 * backlog in at most 96 ms of visible frame time, independently of refresh rate.
 * Only the changing suffix is segmented; the final open grapheme waits for the
 * next chunk or settlement. Stop/correction always publishes exact source text.
 */
export class FrameText {
  private target: string
  private shown: string
  private boundaries: number[] = []
  private openStart = 0
  private frame: number | undefined
  private lastTime: number | undefined
  private debtStart: number | undefined
  private disposed = false
  private running = false
  private motion: Motion = 'fade'
  private reduced = false
  private readonly segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  constructor(initial: string, private readonly clock: FrameClock, private readonly publish: (text: string) => void) {
    this.target = initial
    this.shown = initial
    this.segment(initial, false)
  }

  update(text: string, running: boolean, motion: Motion, reduced = false): void {
    if (this.disposed) return
    const appended = text.startsWith(this.target)
    this.segment(text, appended)
    this.target = text
    this.running = running
    this.motion = motion
    this.reduced = reduced
    if (!running || reduced || !appended) {
      this.flush()
      return
    }
    if (this.target !== this.shown && this.frame === undefined) this.frame = this.clock.request(this.tick)
  }

  /** Flush when a page is hidden, a turn stops, or its source is replaced. */
  flush(): void {
    if (this.frame !== undefined) this.clock.cancel(this.frame)
    this.frame = undefined
    this.lastTime = undefined
    this.debtStart = undefined
    this.emit(this.target)
  }

  dispose(): void {
    this.disposed = true
    if (this.frame !== undefined) this.clock.cancel(this.frame)
    this.frame = undefined
  }

  private emit(text: string): void {
    if (text === this.shown || this.disposed) return
    this.shown = text
    this.publish(text)
  }

  private segment(text: string, appended: boolean): void {
    const start = appended ? this.openStart : 0
    if (appended) { while ((this.boundaries.at(-1) ?? 0) > start) this.boundaries.pop() }
    else this.boundaries = []
    let last = start
    for (const part of this.segmenter.segment(text.slice(start))) {
      last = start + part.index
      this.boundaries.push(last + part.segment.length)
    }
    this.openStart = last
  }

  private readonly tick = (now: number): void => {
    this.frame = undefined
    if (this.disposed) return
    if (!this.running || this.reduced || this.motion === 'fade') { this.flush(); return }
    const available = this.openStart
    if (available <= this.shown.length) {
      this.lastTime = undefined
      this.debtStart = undefined
      return
    }
    this.debtStart ??= now
    const dt = this.lastTime === undefined ? 0 : Math.max(0, now - this.lastTime)
    this.lastTime = now
    const remainingTime = Math.max(1, 96 - (now - this.debtStart))
    const desired = remainingTime <= dt ? available : this.shown.length + Math.max(1, Math.ceil((available - this.shown.length) * dt / remainingTime))
    let low = 0
    let high = this.boundaries.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (this.boundaries[mid]! < desired) low = mid + 1
      else high = mid
    }
    const end = Math.min(available, this.boundaries[low] ?? available)
    this.emit(this.target.slice(0, end))
    if (end < available) this.frame = this.clock.request(this.tick)
    else { this.lastTime = undefined; this.debtStart = undefined }
  }
}
