/** Shared pure Turn-state helpers: one place decides what a finished Turn may show. */

/** Structural face of a block; only the discriminant and text matter here. */
interface BlockLike { kind?: string; text?: string; attachment?: unknown; block?: unknown }
/** Structural face of the `assistant-step` data published on a Step. */
export interface AssistantStepView { status?: string; blocks?: readonly BlockLike[]; finalNode?: unknown }
interface StepView { step: number; data?: { get?: (key: string) => unknown } }
/** Structural face of a Turn location; callers pass the public `TurnLocation`. */
export interface TurnLocationView {
  turn?: number
  status?: string
  end?: { data?: { reason?: { kind?: string } } }
  steps?: readonly StepView[]
}

/** How one Turn currently stands for the concise view. */
export type TurnPhase = 'active' | 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unavailable'

/** @param blocks - the step's blocks. @returns whether they carry a real reply (text, image, other). */
export function hasReplyContent(blocks: readonly BlockLike[] | undefined): boolean {
  if (blocks === undefined) return false
  return blocks.some(block => {
    if (block.kind === 'text') return (block.text ?? '').trim() !== ''
    if (block.kind === 'image') return block.attachment !== undefined
    return block.kind !== undefined && block.kind !== 'reasoning' && block.kind !== 'tool-call'
  })
}

/** @param blocks - the step's blocks. @returns whether a tool call is present. */
function hasToolCall(blocks: readonly BlockLike[] | undefined): boolean {
  return blocks?.some(block => block.kind === 'tool-call') === true
}

/** @param location - turn location. @returns the last actual step, for identity only. */
export function latestStep(location: TurnLocationView | undefined): StepView | undefined {
  const steps = location?.steps
  return steps === undefined || steps.length === 0 ? undefined : steps[steps.length - 1]
}

/** @param location - turn location. @returns the last step's assistant data, when readable. */
export function latestAssistantData(location: TurnLocationView | undefined): AssistantStepView | undefined {
  const last = latestStep(location)
  if (typeof last?.data?.get !== 'function') return undefined
  return last.data.get('assistant-step') as AssistantStepView | undefined
}

/** @param data - `assistant-step` data. @returns whether it is a settled reply with no tool call. */
function isFinalReplyData(data: AssistantStepView | undefined): boolean {
  return data !== undefined && data.status === 'settled' && data.finalNode !== undefined
    && hasToolCall(data.blocks) === false && hasReplyContent(data.blocks)
}

/** @param location - turn location. @returns the last step number when it is a trusted final reply. */
export function finalReplyIdentity(location: TurnLocationView | undefined): { step: number; seq: number } | undefined {
  if (turnPhase(location) !== 'completed') return undefined
  const last = latestStep(location)
  const data = latestAssistantData(location)
  if (last === undefined || !isFinalReplyData(data)) return undefined
  const finalNode = data?.finalNode as { seq?: unknown } | undefined
  const seq = finalNode?.seq
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return undefined
  return { step: last.step, seq }
}

/** @param location - turn location. @returns the last step number when it is a trusted final reply. */
export function finalReplyStep(location: TurnLocationView | undefined): number | undefined {
  return finalReplyIdentity(location)?.step
}

/** @param reason - end reason kind. @returns the phase a closed Turn maps to. */
function closedPhase(reason: string | undefined): TurnPhase {
  if (reason === 'completed') return 'completed'
  if (reason === 'failed' || reason === 'error') return 'failed'
  if (reason === 'cancelled' || reason === 'aborted') return 'cancelled'
  return 'incomplete'
}

/**
 * @param location - turn location.
 * @returns `active` only while the Turn is really open and has no end; a closed or unknown location
 *   without an end is `incomplete`, never `active`.
 */
export function turnPhase(location: TurnLocationView | undefined): TurnPhase {
  if (location === undefined) return 'unavailable'
  if (location.end !== undefined) return closedPhase(location.end.data?.reason?.kind)
  return location.status === 'open' ? 'active' : 'incomplete'
}

/** @param blocks - latest step blocks. @returns the ordinary text preview, ignoring non-text. */
export function previewText(blocks: readonly BlockLike[] | undefined): string {
  if (blocks === undefined) return ''
  return blocks.filter(block => block.kind === 'text' && (block.text ?? '').trim() !== '')
    .map(block => block.text as string).join('\n').trim()
}

/** Stable view signature: phase, latest step identity and the final step when trusted. */
export type TurnView = string

/**
 * @param location - turn location.
 * @returns `${phase}:${latestStep}:${finalStep}:${hasOrdinaryText}:${finalSeq}`. Text presence is a
 *   boolean, not a length, so streaming tokens do not wake settled seats.
 */
export function turnViewOf(location: TurnLocationView | undefined): TurnView {
  const phase = turnPhase(location)
  const latest = latestStep(location)
  const identity = finalReplyIdentity(location)
  const hasText = previewText(latestAssistantData(location)?.blocks) !== ''
  return `${phase}:${latest?.step ?? -1}:${identity?.step ?? -1}:${hasText ? 1 : 0}:${identity?.seq ?? -1}`
}

/** Snapshot face the Turn lookup needs. */
export interface TurnSnapshotView {
  timeline?: {
    turnOrder?: readonly number[]
    turns?: { get?: (turn: number) => TurnLocationView | undefined }
  }
}

/** @param snapshot - Chat snapshot. @returns the public latest Turn number, when known. */
export function latestTurn(snapshot: TurnSnapshotView | undefined): number | undefined {
  const order = snapshot?.timeline?.turnOrder
  if (!Array.isArray(order) || order.length === 0) return undefined
  const turn = order[order.length - 1]
  return typeof turn === 'number' && Number.isInteger(turn) ? turn : undefined
}

/**
 * @param pending - whether the session reports a pending interaction.
 * @param latest - the public latest Turn, when known.
 * @param turn - the Turn being rendered.
 * @returns whether the pending interaction belongs to this Turn. Without a public identity the
 *   caller keeps the readable fallback instead of pretending the Turn succeeded.
 */
export function pendingApplies(pending: boolean, latest: number | undefined, turn: number): boolean {
  if (!pending) return false
  return latest === undefined ? true : latest === turn
}

/** @param snapshot - Chat snapshot. @param turn - Turn number. @returns the stable Turn view. */
export function turnView(snapshot: TurnSnapshotView | undefined, turn: number): TurnView | undefined {
  const turns = snapshot?.timeline?.turns
  if (typeof turns?.get !== 'function') return undefined
  return turnViewOf(turns.get(turn))
}

/** Parsed Turn view. */
export interface ParsedTurnView { phase: TurnPhase; latest: number; final: number; finalSeq: number; hasText: boolean }
/** @param view - Turn view. @returns parsed fields, or undefined when unavailable. */
export function parseTurnView(view: TurnView | undefined): ParsedTurnView | undefined {
  if (view === undefined) return undefined
  const [phase, latestText, finalText, hasText, finalSeqText] = view.split(':')
  if (phase === undefined) return undefined
  const number = (text: string | undefined): number => (Number.isInteger(Number(text)) ? Number(text) : -1)
  return {
    phase: phase as TurnPhase,
    latest: number(latestText),
    final: number(finalText),
    finalSeq: number(finalSeqText),
    hasText: hasText === '1',
  }
}

/** @param phase - Turn phase. @returns whether a trusted final reply may drive final-only hiding. */
export function finalTrusted(parsed: ParsedTurnView | undefined, pending: boolean): boolean {
  return parsed !== undefined && !pending && parsed.phase === 'completed' && parsed.final >= 0
}
