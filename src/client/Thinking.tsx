/** One collapsible reasoning block shared by the live assistant seat and the settings preview. */
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from './locales.ts'

/** Assistant output states this row may report. Never a synthesized summary or duration. */
export type ThinkingStatus = 'running' | 'settled' | 'interrupted'

/** Real state words, kept in the shared dictionary so both call sites read the same. */
const STATE_KEYS = {
  running: 'thinkingRunning', settled: 'thinkingSettled', interrupted: 'thinkingInterrupted',
} as const

/**
 * Keep one seat's expand choice across streaming. The state is keyed by seat identity instead of by
 * text, block count or status, so a delta cannot reset it and another node cannot inherit it. The
 * host's own disclosure hook is deliberately not used: it collapses with the native process row,
 * which this Bundle forces open.
 * @param identity - stable seat identity (session plus node).
 * @param initiallyOpen - value for a seat this state has not seen; new and historical seats start closed.
 * @returns the current open flag and its toggle.
 */
export function useThinkingOpen(identity: string, initiallyOpen = false): [boolean, () => void] {
  const [state, setState] = useState({ identity, open: initiallyOpen })
  const open = state.identity === identity ? state.open : initiallyOpen
  const toggle = useCallback(() => {
    setState(current => ({ identity, open: !(current.identity === identity ? current.open : initiallyOpen) }))
  }, [identity, initiallyOpen])
  return [open, toggle]
}

/**
 * Render the reasoning row and its body. The body stays mounted so expanding it never restarts
 * streaming or replays a fade; it is hidden with an explicit attribute, and the stylesheet keeps
 * that attribute effective against host display rules. A native button carries the keyboard and
 * focus behavior, and `aria-expanded`/`aria-controls` tie the row to its body.
 * @param props - stable element id, real assistant status, dictionary, open flag and toggle.
 * @returns an accessible disclosure with a single visible control.
 */
export function ThinkingDisclosure({ id, status, text, open, onToggle, children }: {
  id: string; status: ThinkingStatus; text: Translate; open: boolean; onToggle: () => void; children: ReactNode
}) {
  return <section className="dsh-output-thinking" data-output-thinking-status={status}>
    <button type="button" className="dsh-output-thinking-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span className="dsh-output-thinking-arrow" aria-hidden="true" />
      <span className="dsh-output-thinking-state">{text(STATE_KEYS[status])}</span>
    </button>
    <div id={id} className="dsh-output-thinking-body" hidden={!open}>
      {children}
    </div>
  </section>
}
