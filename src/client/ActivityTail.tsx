/** Public turnTail entry: one activity summary and one native-row controller per Turn. */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { OutputInjected } from './Assistant.tsx'
import { TurnActivity, TurnToolVisibility } from './Edits.tsx'
import { finalTrusted, latestTurn, parseTurnView, pendingApplies, turnView, type TurnSnapshotView } from './turn-view.ts'

type Props = PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<'missher.output-renderer'> & InjectFace<OutputInjected>

/**
 * The Turn's public tail, used for both the summary and the visibility controller. The shipped host
 * publishes this node only on `turn/end`, so a Turn that is still running or tool-only has no tail
 * yet and is covered by `ActivityDock` until this tail appears. Other layouts render nothing and
 * therefore never hide anything.
 * @param props - Turn owner currency, Chat selector hook, session identity, preferences and copy.
 * @returns the Turn's summary, or null outside concise chat.
 */
export function ActivityTail({ turn, openFile, useChat, useSessionStatus, sessionId, useOutputPreferences, outputText }: Props) {
  const layout = useOutputPreferences(state => state.value.layout)
  if (layout !== 'cards') return null
  // No summary without the Turn readers, and no hiding controller either: native stays readable.
  if (typeof useChat !== 'function' || typeof useSessionStatus !== 'function') return null
  // The dev contract types the owner as TurnLocation, while the currently installed Chat build passes
  // the Turn number itself. Accept both; an unusable Turn renders nothing rather than hiding rows.
  const raw: unknown = turn
  const turnNumber = typeof raw === 'number' ? raw
    : raw !== null && typeof raw === 'object' && typeof (raw as { turn?: unknown }).turn === 'number'
      ? (raw as { turn: number }).turn : undefined
  if (turnNumber === undefined || !Number.isInteger(turnNumber) || turnNumber < 0) return null
  return <TailBody useChat={useChat} useSessionStatus={useSessionStatus} sessionId={sessionId} turn={turnNumber} outputText={outputText} openFile={openFile} />
}

function TailBody({ useChat, useSessionStatus, sessionId, turn, outputText, openFile }: {
  useChat: Props['useChat']; useSessionStatus: Props['useSessionStatus']; sessionId: Props['sessionId']; turn: number
  outputText: Props['outputText']; openFile: Props['openFile']
}) {
  const rawPending = useSessionStatus(snapshot => snapshot.get(sessionId)?.pendingInteraction !== undefined)
  const latest = useChat(snapshot => latestTurn(snapshot as TurnSnapshotView))
  const pending = pendingApplies(rawPending, latest, turn)
  const view = useChat(snapshot => turnView(snapshot as TurnSnapshotView, turn))
  const parsed = parseTurnView(view)
  const done = finalTrusted(parsed, pending)
  // The controller (and therefore the retired native rows) must outlive the summary.
  return <>
    <TurnToolVisibility useChat={useChat} turn={turn} finalOnly={done} />
    {done ? null
      : <TurnActivity useChat={useChat} sessionId={sessionId} turn={turn} text={outputText} openFile={openFile} />}
  </>
}
