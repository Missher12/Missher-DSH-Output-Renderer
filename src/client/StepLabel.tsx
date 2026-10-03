/** Label the recorded Assistant step; settled output does not imply tool success. */
import type { Translate } from './locales.ts'

/**
 * @param props Recorded step number, Assistant output status and localized text.
 * @returns An accessible output-status label without inferring task or tool success.
 */
export function StepLabel({ step, status, text }: {
  step: number; status: 'running' | 'settled' | 'interrupted'; text: Translate
}) {
  const labels = { running: 'stepRunning', settled: 'stepSettled', interrupted: 'stopped' } as const
  const marks = { running: '·', settled: '✓', interrupted: '−' } as const
  return <div className="dsh-output-step-heading" data-output-step-status={status}>
    <span className="dsh-output-step-mark" aria-hidden="true">{marks[status]}</span>
    <span>{text('step')} {step}</span>
    <span className="dsh-output-step-state">{text(labels[status])}</span>
  </div>
}
