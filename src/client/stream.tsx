/** Stream presentation leaves Markdown DOM ownership with the native renderer. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownFileMentions, MarkdownLabels, MarkdownPathImages } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Motion } from '../preferences.ts'
import { FrameText } from './frame-text.ts'

function useReducedMotion(): boolean {
  const query = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const [reduced, setReduced] = useState(query.matches)
  useLayoutEffect(() => {
    const change = () => setReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [query])
  return reduced
}

/** Find only readable Markdown content, excluding toolbar and overlay text. */
function readableNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let item
  while ((item = walker.nextNode())) {
    if (item.parentElement?.closest('p,li,h1,h2,h3,h4,h5,h6,pre code,td,th')) nodes.push(item as Text)
  }
  return nodes
}

function backgroundAt(node: HTMLElement): string {
  let current: HTMLElement | null = node
  while (current) {
    const color = getComputedStyle(current).backgroundColor
    if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
    current = current.parentElement
  }
  return getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim() || 'Canvas'
}

/**
 * Compositor opacity layers cover only newly appended glyph rectangles. No text
 * node splitting, HTML mutation, or reanimation of already-read paragraphs.
 * Ranges are measured once per received/rendered chunk, never per animation frame.
 */
export function StreamMarkdown({ text, running, motion, labels, mentions, pathImages, compact = false }: {
  text: string; running: boolean; motion: Motion; labels: MarkdownLabels
  mentions?: MarkdownFileMentions | undefined; pathImages?: MarkdownPathImages | undefined; compact?: boolean
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(text)
  const controller = useRef<FrameText | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const previous = useRef(running ? '' : null as string | null)
  const active = useRef(new Set<Animation>())
  const clearFade = useCallback(() => {
    for (const animation of active.current) animation.cancel()
    active.current.clear()
    overlay.current?.replaceChildren()
  }, [])

  useLayoutEffect(() => {
    const buffer = new FrameText(text, {
      request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
    }, setShown)
    controller.current = buffer
    return () => {
      buffer.dispose()
      controller.current = null
    }
  }, [])
  useLayoutEffect(() => {
    const visibility = () => {
      if (!document.hidden) {
        if (running && !reduced && motion === 'fade' && content.current) {
          previous.current = readableNodes(content.current).map(node => node.data).join('')
        }
        return
      }
      previous.current = null
      clearFade()
      controller.current?.flush()
    }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [running, motion, reduced, clearFade])
  useLayoutEffect(() => {
    controller.current?.update(text, running, motion, reduced || document.hidden)
  }, [text, running, motion, reduced])

  useLayoutEffect(() => {
    const body = content.current
    const layer = overlay.current
    if (!body || !layer) return
    if (!running || reduced || document.hidden || motion !== 'fade') {
      previous.current = null
      clearFade()
      return
    }
    const nodes = readableNodes(body)
    const next = nodes.map(node => node.data).join('')
    const old = previous.current
    previous.current = next
    if (old === null || next === old || !next.startsWith(old) || typeof layer.animate !== 'function') return
    const from = Math.max(old.length, next.length - 640)
    const rect = layer.getBoundingClientRect()
    let offset = 0
    let count = 0
    for (const node of nodes) {
      const end = offset + node.length
      if (end > from) {
        const background = backgroundAt(node.parentElement ?? body)
        const range = document.createRange()
        range.setStart(node, Math.max(0, from - offset))
        range.setEnd(node, node.length)
        for (const part of range.getClientRects()) {
          if (part.width <= 0 || part.height <= 0 || count++ >= 64) break
          const shade = document.createElement('span')
          Object.assign(shade.style, { position: 'absolute', left: `${part.left - rect.left}px`,
            top: `${part.top - rect.top}px`, width: `${part.width}px`, height: `${part.height}px`, background })
          layer.append(shade)
          const animation = shade.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' })
          active.current.add(animation)
          const clear = () => { shade.remove(); active.current.delete(animation) }
          animation.onfinish = clear
          animation.oncancel = clear
          if (active.current.size > 96) active.current.values().next().value?.cancel()
        }
        range.detach()
      }
      offset = end
      if (count >= 64) break
    }
  }, [shown, running, motion, reduced, clearFade])
  useLayoutEffect(() => {
    const animations = active.current
    const layer = overlay.current
    let width = content.current?.getBoundingClientRect().width
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next === width) return
      width = next
      for (const animation of animations) animation.cancel()
      animations.clear()
      layer?.replaceChildren()
    })
    if (content.current) resize?.observe(content.current)
    return () => { resize?.disconnect(); for (const animation of animations) animation.cancel(); animations.clear() }
  }, [])
  return <div className="dsh-output-stream" data-output-motion={motion}>
    <div ref={content} data-output-text>
      <MarkdownText text={running && !reduced ? shown : text} streaming={running} labels={labels}
        fileMentions={mentions} pathImages={pathImages} variant={compact ? 'compact' : 'body'} />
    </div>
    <div ref={overlay} className="dsh-output-fade-layer" aria-hidden="true" />
  </div>
}
