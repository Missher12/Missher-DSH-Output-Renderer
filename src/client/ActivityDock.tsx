/** Live-Turn activity entry shown above the composer until the real turn-tail is published. */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { OutputInjected } from './Assistant.tsx'
import { TurnActivity, TurnToolVisibility } from './Edits.tsx'
import { finalTrusted, parseTurnView, turnView, type TurnSnapshotView } from './turn-view.ts'
import { NS } from './locales.ts'

/** Business face of the dock entry: the session-scoped file opener and whether it can work. */
export interface ActivityDockInjected extends OutputInjected {
  openFile: (sessionId: string, path: string) => void
  canOpenFile: boolean
}

type Props = PropsRuntime<'conversation.input.dock'> & PropsLocale<typeof NS> & InjectFace<ActivityDockInjected>

/**
 * Describe the latest Turn and whether the host already published its real Turn tail. The tail is
 * published only on `turn/end`, so a running or tool-only Turn has none yet.
 * @param snapshot - current Chat snapshot.
 * @returns `${turn}:${tailPublished ? 1 : 0}`, or undefined when the readers are unavailable.
 */
export function liveTurnState(snapshot: Partial<ChatSnapshot>): string | undefined {
  const timeline = snapshot.timeline
  const locations = snapshot.locations
  const nodes = snapshot.nodes
  if (timeline === undefined || locations === undefined || nodes === undefined) return undefined
  if (!Array.isArray(timeline.turnOrder)) return undefined
  const turn = timeline.turnOrder[timeline.turnOrder.length - 1]
  if (typeof turn !== 'number') return undefined
  if (typeof locations.getTurn !== 'function' || typeof nodes.get !== 'function') return undefined
  const published = locations.getTurn(turn).some(key => {
    const node = nodes.get(key)
    return node !== undefined && (node as { kind?: unknown }).kind === 'turn-tail'
  })
  return `${turn}:${published ? 1 : 0}`
}

/** Loose face of the session-status selector: the dock only reads one boolean fact. */
type StatusSelector = (selector: (snapshot: ReadonlyMap<string, { pendingInteraction?: unknown }>) => boolean) => boolean

/** Props the ready child actually reads; the shell passes only these. */
type ReadyProps = Pick<Props, 'useChat' | 'useSessionStatus' | 'sessionId' | 'outputText' | 'openFile'>

/**
 * Activity entry for the latest Turn while its real tail does not exist yet. The shell checks the
 * host capabilities first and mounts {@link ReadyDock} only when every hook and the file opener are
 * present, so the ready child always calls its hooks unconditionally. A capability that disappears
 * unmounts the child, which also removes its rules; a later one remounts it from the shared fold.
 * @param props - owner currency, Chat selector hooks, session identity, preferences, copy and the
 *   session-scoped file opener.
 * @returns the live Turn's summary, or null when the tail owns it or a capability is missing.
 */
export function ActivityDock({ useChat, useSessionStatus, sessionId, useOutputPreferences, outputText, openFile, canOpenFile }: Props) {
  const layout = useOutputPreferences(state => state.value.layout)
  const ready = typeof useChat === 'function' && typeof useSessionStatus === 'function'
  if (!ready || layout !== 'cards' || !canOpenFile) return null
  return <ReadyDock useChat={useChat} useSessionStatus={useSessionStatus} sessionId={sessionId}
    outputText={outputText} openFile={openFile} />
}

/**
 * The capability-checked body of the dock. Both public hooks run unconditionally here; the shell is
 * the only place that decides whether this component exists.
 * @param props - the same public hooks and interactions.
 * @returns the latest Turn's summary, or null when the tail owns it.
 */
function ReadyDock({ useChat, useSessionStatus, sessionId, outputText, openFile }: ReadyProps) {
  const live = useChat(snapshot => liveTurnState(snapshot as Partial<ChatSnapshot>))
  const pending = (useSessionStatus as unknown as StatusSelector)(
    snapshot => snapshot.get(sessionId)?.pendingInteraction !== undefined)
  if (pending === true || live === undefined) return null
  const [turnText, published] = live.split(':')
  if (published !== '0') return null
  const turn = Number(turnText)
  if (!Number.isInteger(turn) || turn < 0) return null
  return <DockBody useChat={useChat} sessionId={sessionId} turn={turn} outputText={outputText} openFile={openFile} />
}

/**
 * Capability-checked body: both public hooks run unconditionally here.
 * @param props - the Turn identity plus the shared summary/controller pieces.
 * @returns the summary, or the real running status when the latest step has no ordinary text.
 */
function DockBody({ useChat, sessionId, turn, outputText, openFile }: {
  useChat: Props['useChat']; sessionId: Props['sessionId']; turn: number
  outputText: Props['outputText']; openFile: Props['openFile']
}) {
  const view = useChat(snapshot => turnView(snapshot as TurnSnapshotView, turn))
  const parsed = parseTurnView(view)
  const done = finalTrusted(parsed, false)
  return <div className="dsh-output-activity-dock">
    <TurnToolVisibility useChat={useChat} turn={turn} finalOnly={done} />
    {done ? null
      : <><TurnActivity useChat={useChat} sessionId={sessionId} turn={turn} text={outputText} openFile={path => openFile(sessionId, path)} />
        {parsed?.phase === 'active' && !parsed.hasText
          && <p className="dsh-output-activity-status">{outputText('stepRunning')}</p>}</>}
  </div>
}
