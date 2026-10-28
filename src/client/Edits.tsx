/** One Turn's real Tool activity, shown as a low-key summary under the reply. */
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react'
import type { ChatSnapshot, OpenFileOptions, ToolCallBlock, ToolCallId, ToolChatData, ToolResultNode, UseChat } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { Translate } from './locales.ts'

/**
 * Recognize a settled Tool root from its own discriminant. The Chat package is a browser Bundle, not
 * an ESM module, so its runtime helpers are never imported; only its types are.
 * @param block - one Tool lifecycle value.
 * @returns whether the value carries its final result.
 */
function isSettledTool(block: ToolCallBlock): block is ToolResultNode {
  return (block as { kind?: unknown }).kind === 'tool-result'
}

/** Tool names that write a file. Reads, searches and shells are classified separately. */
const EDIT_TOOLS = new Set(['write', 'edit', 'str_replace_editor'])
/** `str_replace_editor` commands that change a file; `view` is a read. */
const EDIT_COMMANDS = new Set(['create', 'str_replace', 'insert'])
/** Tools that only look at a file. */
const READ_TOOLS = new Set(['read', 'read_image'])
/** Tools that search. */
const SEARCH_TOOLS = new Set(['grep', 'glob'])
/** Shell-like tools whose exit status lives in the result text, not only in `isError`. */
const TERMINAL_TOOLS = new Set(['bash', 'bash_persistent', 'pwsh', 'pwsh_persistent', 'terminal', 'run_terminal_cmd', 'shell'])
/**
 * Plain foreground shells. The shipped tools print no exit marker on success (`renderResult` only
 * appends markers for non-zero/signal/timeout/stop), so an empty marker set is the success contract.
 */
const FOREGROUND_SHELL = new Set(['bash', 'pwsh'])
/** Outcomes that are not a completed foreground run even without an exit marker. */
const UNCERTAIN_MARKER = /\[(?:timed out after [^\]]*|stopped: [^\]]*|sandbox: [^\]]*)\]|started background job/iu
/** Tools that wait for the user; their native row is the interaction itself. */
const INTERACTIVE_TOOLS = new Set(['ask_user_question'])
const SIGNAL_MARKER = /\[killed by signal: [^\]]+\]/u
const EXIT_MARKER = /\[exit code: ([^\]]+)\]/gu
const TAIL_EXIT_ZERO = /\[exit code: 0\]\s*$/u

/** Real activity categories the summary can state without guessing. */
export type ActivityKind = 'edit' | 'read' | 'search' | 'command'
/** Running activity is stated in progress; anything else is stated as done. */
export type ActivityStatus = 'running' | 'done'

/** One Tool call represented in the summary. */
export interface ActivityRecord {
  callId: string
  kind: ActivityKind
  /** Durable Tool-call name, kept so a row never relabels what happened. */
  tool: string
  /** File the call touched: edited path, read path, or search scope. */
  path?: string
  /** Search pattern, when the call searched. */
  query?: string
  /** Shell command text, when the call ran one. */
  command?: string
  status: ActivityStatus
}

/** Keep one seat disclosure choice across streaming; keyed by seat identity, not by content. */
export function useSeatDisclosure(identity: string, initiallyOpen = false): [boolean, () => void] {
  const [state, setState] = useState({ identity, open: initiallyOpen })
  const open = state.identity === identity ? state.open : initiallyOpen
  const toggle = useCallback(() => {
    setState(current => ({ identity, open: !(current.identity === identity ? current.open : initiallyOpen) }))
  }, [identity, initiallyOpen])
  return [open, toggle]
}

function argsObject(raw: string | undefined): Record<string, unknown> | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : undefined
  } catch (_error) { return undefined }
}

function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function objectField(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** @param name - durable Tool name. @param args - parsed arguments when available. @returns its category. */
function classify(name: string, args: Record<string, unknown> | undefined): ActivityKind | undefined {
  if (INTERACTIVE_TOOLS.has(name)) return undefined
  if (EDIT_TOOLS.has(name)) {
    if (name !== 'str_replace_editor') return 'edit'
    return EDIT_COMMANDS.has(String(args?.command)) ? 'edit' : 'read'
  }
  if (READ_TOOLS.has(name)) return 'read'
  if (SEARCH_TOOLS.has(name)) return 'search'
  if (TERMINAL_TOOLS.has(name)) return 'command'
  return undefined
}

/** @param block - settled Tool result. @returns its text content joined for footer parsing. */
function resultText(block: ToolResultNode): string {
  const parts: string[] = []
  for (const content of block.content) {
    const text = objectField(content)?.text
    if (typeof text === 'string') parts.push(text)
  }
  return parts.join('\n')
}

/**
 * Whether a settled Tool call proves a clean success. Every failure evidence in the result text wins
 * over a success marker: the native footer can print an early `[exit code: 0]` and still end with a
 * failing status, and a signal or a `null` exit is never a success. `isError` alone is not enough.
 * @param block - settled Tool result.
 * @param name - durable Tool-call name.
 * @returns true only when the result proves a clean, zero-exit completion.
 */
function provedClean(block: ToolResultNode, name: string): boolean {
  if (block.isError) return false
  const text = resultText(block)
  if (SIGNAL_MARKER.test(text)) return false
  EXIT_MARKER.lastIndex = 0
  let marker = EXIT_MARKER.exec(text)
  while (marker !== null) {
    if (marker[1] !== '0') return false
    marker = EXIT_MARKER.exec(text)
  }
  if (UNCERTAIN_MARKER.test(text)) return false
  const metaExit = objectField(block.meta)?.exitCode
  if (typeof metaExit === 'number') return metaExit === 0
  if (metaExit !== undefined) return false
  if (TAIL_EXIT_ZERO.test(text)) return true
  // A plain foreground shell prints nothing on success; a persistent/background terminal structure
  // with no evidence stays unknown instead of being claimed as finished.
  if (FOREGROUND_SHELL.has(name)) return true
  return !TERMINAL_TOOLS.has(name)
}

/**
 * Successful write/edit results report the real outcome in `meta`: the written path and the file
 * diffs (an empty diff list for a new file). Arguments only describe the request.
 * @param meta - Tool result metadata.
 * @returns whether the result proves a completed file write.
 */
function provedEdit(meta: unknown): { path?: string } | undefined {
  const record = objectField(meta)
  if (record === undefined) return undefined
  const path = textField(record.path)
  return path !== undefined || Array.isArray(record.diffs) ? { path } : undefined
}

/** @param kind - activity category. @param args - parsed call arguments. @returns its visible target. */
function targets(kind: ActivityKind, args: Record<string, unknown> | undefined): { path?: string; query?: string; command?: string } {
  if (args === undefined) return {}
  if (kind === 'edit') return { path: textField(args.file_path) ?? textField(args.path) }
  if (kind === 'read') return { path: textField(args.file_path) ?? textField(args.path) }
  if (kind === 'search') return { query: textField(args.pattern), path: textField(args.path) }
  return { command: textField(args.command) ?? textField(args.cmd) }
}

/**
 * @param block - one Tool lifecycle value.
 * @returns the activity this call can state, or undefined when it is not a proven, representable one.
 *   Interactive, failing, unknown-exit and unconfirmed-edit calls stay only on their native row.
 */
function activityFor(block: ToolCallBlock): ActivityRecord | undefined {
  if (!isSettledTool(block)) {
    if (block.phase === 'preparing') return undefined
    const args = argsObject(block.argsRaw)
    const kind = classify(block.name, args)
    if (kind === undefined) return undefined
    // A preparing editor cannot be told apart from a read yet, so it stays native.
    if (block.name === 'str_replace_editor' && args === undefined) return undefined
    return { callId: block.callId, kind, tool: block.name, ...targets(kind, args), status: 'running' }
  }
  if (block.call === null) return undefined
  const args = argsObject(block.call.argsRaw)
  const kind = classify(block.call.name, args)
  if (kind === undefined) return undefined
  if (!provedClean(block, block.call.name)) return undefined
  const proved = kind === 'edit' ? provedEdit(block.meta) : undefined
  // An edit whose result is unconfirmed is not a completed edit and keeps its native detail.
  if (kind === 'edit' && proved === undefined) return undefined
  return {
    callId: block.callId, kind, tool: block.call.name,
    ...targets(kind, args), ...(proved?.path === undefined ? {} : { path: proved.path }), status: 'done',
  }
}

/** @param tools - this Turn's Tool-call nodes, in anchor order. @returns representable activity. */
export function activities(tools: readonly ToolChatData[]): ActivityRecord[] {
  const records: ActivityRecord[] = []
  const seen = new Set<string>()
  const visit = (block: ToolCallBlock): void => {
    if (seen.has(block.callId)) return
    seen.add(block.callId)
    const record = activityFor(block)
    if (record !== undefined) records.push(record)
    for (const child of block.subCalls) visit(child)
  }
  for (const tool of tools) visit(tool.root)
  return records
}

/**
 * Whether one Tool node must keep its native row: an interaction, an unrepresentable tool, a failed
 * call, an unknown shell exit or an unconfirmed edit. Only a proven activity may be summarized away.
 * @param block - one Tool root lifecycle value.
 * @returns true when the native row and its interactions must remain.
 */
/** @param block - one Tool root. @returns whether any call in its tree is still unsettled. */
function hasUnsettledCall(block: ToolCallBlock): boolean {
  if (!isSettledTool(block)) return true
  return block.subCalls.some(hasUnsettledCall)
}

/**
 * @param block - one Tool root lifecycle value.
 * @param finalOnly - the caller already proved a trusted final completion for this Turn.
 * @returns true when the native row must remain. A trusted final retires settled history only when
 *   the whole call tree has settled; a running deep subcall always keeps its native entry.
 */
export function toolNeedsNativeRow(block: ToolCallBlock, finalOnly = false): boolean {
  // Any preparing/running call anywhere in the tree keeps its native entry, so a settled parent can
  // never retire a live deep call after the summary is gone.
  if (finalOnly && hasUnsettledCall(block)) return true
  if (finalOnly && isSettledTool(block)) return false
  if (activityFor(block) === undefined) return true
  return block.subCalls.some(child => toolNeedsNativeRow(child, finalOnly))
}

/** @param tools - this Turn's Tool-call nodes. @returns true when any native row must remain. */
export function toolsNeedNativeRows(tools: readonly ToolChatData[], finalOnly = false): boolean {
  return tools.some(tool => toolNeedsNativeRow(tool.root, finalOnly))
}

const SUMMARY_ORDER: readonly ActivityKind[] = ['edit', 'read', 'search', 'command']
const PAST_VERB: Record<ActivityKind, 'activityEdited' | 'activityRead' | 'activitySearched' | 'activityRan'> = {
  edit: 'activityEdited', read: 'activityRead', search: 'activitySearched', command: 'activityRan',
}
const PAST_COUNTED: Record<ActivityKind, 'activityEditedFiles' | 'activityReadFiles' | 'activitySearchedTimes' | 'activityRanCommands'> = {
  edit: 'activityEditedFiles', read: 'activityReadFiles', search: 'activitySearchedTimes', command: 'activityRanCommands',
}
const RUNNING_VERB: Record<ActivityKind, 'activityEditing' | 'activityReading' | 'activitySearching' | 'activityRunning'> = {
  edit: 'activityEditing', read: 'activityReading', search: 'activitySearching', command: 'activityRunning',
}
/** Short visible category verbs; the counted full phrase stays in the accessible text. */
const SHORT_VERB: Record<ActivityKind, 'shortEdited' | 'shortRead' | 'shortSearched' | 'shortRan'> = {
  edit: 'shortEdited', read: 'shortRead', search: 'shortSearched', command: 'shortRan',
}
const NOUN: Record<ActivityKind, 'activityFiles' | 'activityTimes' | 'activityCommands'> = {
  edit: 'activityFiles', read: 'activityFiles', search: 'activityTimes', command: 'activityCommands',
}
const NOUN_ONE: Record<ActivityKind, 'activityFile' | 'activityTime' | 'activityCommand'> = {
  edit: 'activityFile', read: 'activityFile', search: 'activityTime', command: 'activityCommand',
}

/** @param record - one activity. @returns the target value its category counts. */
function targetOf(record: ActivityRecord): string | undefined {
  if (record.kind === 'search') {
    if (record.path === undefined && record.query === undefined) return undefined
    // A structured tuple cannot collide: a path containing the query delimiter stays distinct.
    return JSON.stringify([record.path ?? null, record.query ?? null])
  }
  return record.kind === 'command' ? record.command : record.path
}

/** One summary line fragment: a real category, its full accessible phrase and its short visible one. */
export interface ActivitySegment { kind: ActivityKind; label: string; short: string }

/**
 * Compose the summary fragments from real categories only. A category with a count uses its counted
 * verb and a singular or plural noun; a category without reliable targets uses its plain verb. While
 * any call of the category runs, that category is stated in progress.
 * @param records - this Turn's activity.
 * @param text - Bundle dictionary.
 * @returns one fragment per category, in fixed order.
 */
export function activitySegments(records: readonly ActivityRecord[], text: Translate): ActivitySegment[] {
  const segments: ActivitySegment[] = []
  for (const kind of SUMMARY_ORDER) {
    const rows = records.filter(record => record.kind === kind)
    if (rows.length === 0) continue
    const known = new Set(rows.map(targetOf).filter(value => value !== undefined))
    const countable = known.size > 0 && rows.every(record => targetOf(record) !== undefined)
    const running = rows.some(record => record.status === 'running')
    const count = known.size
    const noun = count === 1 ? NOUN_ONE[kind] : NOUN[kind]
    const verb = running ? RUNNING_VERB[kind] : countable ? PAST_COUNTED[kind] : PAST_VERB[kind]
    segments.push({
      kind,
      label: countable ? `${text(verb)} ${count} ${text(noun)}` : text(verb),
      short: running ? text(RUNNING_VERB[kind]) : text(SHORT_VERB[kind]),
    })
  }
  return segments
}

/**
 * @param records - this Turn's activity.
 * @param text - Bundle dictionary.
 * @returns the one-line summary text.
 */
export function activitySummary(records: readonly ActivityRecord[], text: Translate): string {
  return activitySegments(records, text).map(segment => segment.label).join(' · ')
}

/** @param kind - activity category. @returns a tiny decorative icon for its row. */
function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 } as const
  if (kind === 'edit') return <svg {...common} aria-hidden="true"><path d="M2 10l1-3 5-5 2 2-5 5-3 1z" /><path d="M7.5 2.5l2 2" /></svg>
  if (kind === 'read') return <svg {...common} aria-hidden="true"><path d="M6 3.2C4.8 2.2 3.2 2 1.6 2.1v7.2C3.2 9.2 4.8 9.4 6 10.4" /><path d="M6 3.2C7.2 2.2 8.8 2 10.4 2.1v7.2C8.8 9.2 7.2 9.4 6 10.4" /><path d="M6 3.2v7.2" /></svg>
  if (kind === 'search') return <svg {...common} aria-hidden="true"><circle cx="5.2" cy="5.2" r="3.2" /><path d="M7.7 7.7L10.5 10.5" /></svg>
  return <svg {...common} aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="7" rx="1" /><path d="M3.5 5.5l1.5 1.5-1.5 1.5M6.5 8.5h2" /></svg>
}

const ROW_PAST: Record<ActivityKind, 'rowEdited' | 'rowRead' | 'rowSearched' | 'rowRan'> = {
  edit: 'rowEdited', read: 'rowRead', search: 'rowSearched', command: 'rowRan',
}
const ROW_RUNNING: Record<ActivityKind, 'activityEditing' | 'activityReading' | 'activitySearching' | 'activityRunning'> = {
  edit: 'activityEditing', read: 'activityReading', search: 'activitySearching', command: 'activityRunning',
}

/** @param path - absolute path. @returns its final segment for a row. */
function baseName(path: string): string {
  const parts = path.split(/[\\/]/u)
  return parts[parts.length - 1] || path
}

/** @param record - one activity. @param text - Bundle dictionary. @returns the short target text a row shows. */
function rowTarget(record: ActivityRecord, text: Translate): string {
  if (record.kind === 'search') {
    const scope = record.path
    const running = record.status === 'running'
    if (scope !== undefined && record.query !== undefined) {
      return `${text(running ? 'rowSearchRunningIn' : 'rowSearchIn')} ${scope} ${text(running ? 'rowSearchRunningFor' : 'rowSearchFor')} ‘${record.query}’`
    }
    if (scope !== undefined) return running ? `${text('activitySearching')} ${scope}` : `${text('rowSearchScope')} ${scope}`
    if (record.query === undefined) return text(running ? 'activitySearching' : 'activitySearched')
    return `${text(running ? 'rowSearching' : 'rowSearched')} ‘${record.query}’`
  }
  if (record.kind === 'command') return record.command === undefined ? '' : record.command
  return record.path === undefined ? '' : baseName(record.path)
}

/**
 * Render a row target. Only an edit or read that really names a file may become a file button; a
 * search scope is not a file to open, and a command is not either. Without an interaction the target
 * stays plain text, so no control can be clicked for nothing.
 * @param record - one activity row.
 * @returns the target element.
 */
function renderTarget(record: ActivityRecord, text: Translate, onOpenFile: ((path: string) => void) | undefined,
  onInspect: ((callId: ToolCallId) => void) | undefined) {
  const file = (record.kind === 'edit' || record.kind === 'read') && record.path !== undefined
  if (file && onOpenFile !== undefined) {
    return <button type="button" className="dsh-output-activity-target" title={record.path}
      onClick={() => onOpenFile(record.path as string)}>{rowTarget(record, text)}</button>
  }
  if (!file && onInspect !== undefined) {
    return <button type="button" className="dsh-output-activity-target" title={[record.path, record.query, record.command].filter(Boolean).join(' ') || undefined}
      onClick={() => onInspect(record.callId as ToolCallId)}>{rowTarget(record, text)}</button>
  }
  return <span className="dsh-output-activity-target" title={[record.path, record.query, record.command].filter(Boolean).join(' ') || undefined}>{rowTarget(record, text)}</span>
}

/**
 * Presentational disclosure: one low-key summary line, collapsed by default, listing the Turn's real
 * tool activity. It renders nothing when there is no activity, so a Turn without tools has no entry.
 * @param props - activity, dictionary, disclosure state and the two real interactions.
 * @returns the activity disclosure, or null.
 */
export function ActivityDisclosure({ id, records, text, open, onToggle, onOpenFile, onInspect }: {
  id: string; records: readonly ActivityRecord[]; text: Translate; open: boolean; onToggle: () => void
  onOpenFile?: (path: string) => void; onInspect?: (callId: ToolCallId) => void
}) {
  if (records.length === 0) return null
  const segments = activitySegments(records, text)
  const accessible = activitySummary(records, text)
  // One leading category icon (edit wins, else the first real category); the full counted phrase
  // stays in the accessible name and tooltip.
  const lead = segments.find(segment => segment.kind === 'edit') ?? segments[0]!
  return <section className="dsh-output-activity">
    <button type="button" className="dsh-output-activity-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}
      aria-label={accessible} title={accessible}>
      <span className="dsh-output-activity-leading" aria-hidden="true"><ActivityIcon kind={lead.kind} /></span>
      <span className="dsh-output-activity-summary">
        {segments.map(segment => <span key={segment.kind} className="dsh-output-activity-segment-text">{segment.short}</span>)}
      </span>
      <span className="dsh-output-activity-arrow" aria-hidden="true" />
    </button>
    <div id={id} className="dsh-output-activity-body" hidden={!open}>
      <ul className="dsh-output-activity-list">
        {records.map(record => <li key={record.callId} className="dsh-output-activity-row" data-output-activity={record.kind}
          data-output-activity-status={record.status}>
          <span className="dsh-output-activity-icon"><ActivityIcon kind={record.kind} /></span>
          {record.kind === 'search' ? null
            : <span className="dsh-output-activity-verb">{text(record.status === 'running' ? ROW_RUNNING[record.kind] : ROW_PAST[record.kind])}</span>}
          {renderTarget(record, text, onOpenFile, onInspect)}
        </li>)}
      </ul>
    </div>
  </section>
}

/** @param value - node key. @returns the value escaped for a CSS attribute selector. */
function cssString(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')
}

/** One row of the visibility signature: the node's own key and its proven state. */
type ActivityRow = readonly [key: string, state: 'clean' | 'attention']

/**
 * Build the rules for one Turn from its own node keys. Every selector is either the exact
 * `data-chat-node-key` or a process group anchored by such a key, so the same Turn number in another
 * session cannot match. Nothing is emitted for an unproven state, a Turn error, or a missing host
 * reader.
 * @param turn - owning Turn number.
 * @param signature - serialized rows from {@link toolVisibilitySignature}, undefined when unavailable.
 * @returns an empty string or a style-sheet fragment.
 */
export function cleanTurnRules(turn: number, signature: string | undefined): string {
  if (signature === undefined) return ''
  let parsed: { blocked?: unknown; rows?: unknown }
  try { parsed = JSON.parse(signature) as { blocked?: unknown; rows?: unknown } } catch (_error) { return '' }
  if (parsed.blocked === true || !Array.isArray(parsed.rows)) return ''
  const rows: ActivityRow[] = []
  for (const row of parsed.rows) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue
    rows.push([row[0], row[1] === 'clean' ? 'clean' : 'attention'])
  }
  const replaceable = rows.filter(row => row[1] === 'clean').map(row => row[0])
  if (replaceable.length === 0) return ''
  const anyAttention = rows.some(row => row[1] === 'attention')
  const root = 'html[data-dsh-output-renderer="cards"]'
  const rules: string[] = []
  for (const key of replaceable) {
    rules.push(`${root} [data-chat-node-key="${cssString(key)}"]{display:none!important}`)
  }
  // Only a Turn with nothing native-worthy may retire its process groups, and even then each group
  // is pinned to one of this Turn's own node keys.
  if (!anyAttention) {
    for (const key of replaceable) {
      const group = `${root} [data-step-process][data-chat-turn="${turn}"]:has([data-chat-node-key="${cssString(key)}"])`
      rules.push(`${group}:not(:has(.dsh-output-assistant)){display:none!important}`)
      rules.push(`${group}>div:has(>button[data-process-activity]){display:none}`)
    }
  }
  return rules.join('')
}

/**
 * Serialize this Turn's Tool nodes from the public Location index and Node store. Uses only the
 * Turn's own ordered node keys and their existing Nodes, so no internal key is constructed.
 * @param snapshot - current Chat snapshot.
 * @param turn - owning Turn number.
 * @returns the signature, or undefined when the host does not expose the readers.
 */
/** Minimal reader face the visibility rows need. */
interface NodeReader { get(key: string): { kind?: unknown; data?: unknown } | undefined }

/**
 * Pair this Turn's ordered node keys with its Tool node data. The keys decide identity (so another
 * session cannot match) and the Tool data decides whether a row may be replaced. A length mismatch
 * means the two readers disagree, which fails open.
 * @param keys - this Turn's ordered node keys.
 * @param tools - this Turn's Tool-call data, in anchor order.
 * @param nodes - node reader for the non-Tool kinds.
 * @returns serialized rows, or undefined when the readers do not line up.
 */
export function visibilityRows(keys: readonly string[], tools: readonly ToolChatData[], nodes: NodeReader, finalOnly = false): string | undefined {
  if (typeof nodes?.get !== 'function') return undefined
  const toolKeys = keys.filter(key => (nodes.get(key)?.kind) === 'tool-call')
  if (toolKeys.length !== tools.length) return undefined
  // A trusted completion retires history only when every node is readable and every call tree has
  // settled; otherwise no whole-Turn retirement rule is emitted at all.
  if (finalOnly) {
    if (keys.some(key => nodes.get(key) === undefined)) return undefined
    if (tools.some(tool => hasUnsettledCall(tool.root))) return undefined
  }
  const rows: ActivityRow[] = []
  let blocked = false
  for (const key of keys) {
    const node = nodes.get(key)
    if (node === undefined) continue
    if (node.kind === 'turn-error' || node.kind === 'model-retry') {
      if (finalOnly) rows.push([key, 'clean'])
      else blocked = true
    }
  }
  toolKeys.forEach((key, index) => {
    rows.push([key, toolNeedsNativeRow(tools[index]!.root, finalOnly) ? 'attention' : 'clean'])
  })
  return JSON.stringify({ blocked, rows })
}

/**
 * @param snapshot - current Chat snapshot.
 * @param turn - owning Turn number.
 * @returns the serialized rows, or undefined when any reader the summary list needs is missing.
 */
export function toolVisibilitySignature(snapshot: Partial<ChatSnapshot>, turn: number, finalOnly = false): string | undefined {
  const locations = snapshot.locations
  const nodes = snapshot.nodes
  // Hiding is allowed only when the fold list can list the same Turn: its reader must be present too.
  if (typeof locations?.getTurn !== 'function' || typeof nodes?.get !== 'function'
    || typeof nodes.turnDataSource !== 'function') return undefined
  const source = nodes.turnDataSource(turn, 'tool-call')
  const data = source.getSnapshot() as readonly ToolChatData[]
  return visibilityRows(locations.getTurn(turn), data, nodes, finalOnly)
}

/**
 * Compare two key lists by content, so a text token that leaves the Turn's membership unchanged does
 * not re-run the rule scan.
 * @param left - previous keys.
 * @param right - next keys.
 * @returns whether both lists hold the same keys in the same order.
 */
function sameKeys(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (left === right) return true
  if (left === undefined || right === undefined || left.length !== right.length) return false
  return left.every((key, index) => key === right[index])
}

/**
 * Drive one Turn's native Tool visibility. Exactly one instance is mounted per Turn (the host step's
 * seat), so one subscription and one stylesheet serve the whole Turn; it renders nothing, so a
 * tool-only or reasoning-only step adds no row and no gap. It uninstalls the rules when it unmounts.
 * @param props - Chat selector hook and owning Turn.
 */
export function TurnToolVisibility({ useChat, turn, finalOnly = false }: { useChat: UseChat; turn: number; finalOnly?: boolean }) {
  // Membership notifies on Turn structure, not on every text token.
  const keys = useChat(snapshot => {
    const locations = (snapshot as Partial<ChatSnapshot>).locations
    return typeof locations?.getTurn === 'function' ? locations.getTurn(turn) : undefined
  }, sameKeys)
  const nodes = useChat(snapshot => (snapshot as Partial<ChatSnapshot>).nodes)
  const source = typeof nodes?.turnDataSource === 'function' ? nodes.turnDataSource(turn, 'tool-call') : undefined
  // Stable subscription identities: a text-token render must not resubscribe the Tool source.
  const subscribe = useCallback((callback: () => void) => (source === undefined ? () => {} : source.subscribe(callback)), [source])
  const getSnapshot = useCallback(() => (source === undefined ? EMPTY_TOOLS : source.getSnapshot()), [source])
  const tools = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TOOLS)
  const signature = useMemo(() => {
    if (keys === undefined || nodes === undefined || source === undefined) return undefined
    // The same capability gate as the pure helper: a partial host keeps its native rows silently.
    if (typeof nodes.get !== 'function' || typeof nodes.turnDataSource !== 'function') return undefined
    return visibilityRows(keys, tools, nodes, finalOnly)
  }, [keys, nodes, source, tools, finalOnly])
  const css = useMemo(() => cleanTurnRules(turn, signature), [turn, signature])
  const id = `dsh-output-clean-${useId()}`.replace(/[^A-Za-z0-9_-]/gu, '-')
  useEffect(() => {
    const existing = document.getElementById(id)
    if (css === '') { existing?.remove(); return }
    const element = existing ?? document.createElement('style')
    if (existing === null) { element.id = id; document.head.append(element) }
    element.setAttribute('data-output-clean-turn', String(turn))
    element.textContent = css
    return () => { document.getElementById(id)?.remove() }
  }, [css, id, turn])
  return null
}

/**
 * Whether the Turn's activity fold is open, held outside the seat so moving from one host step to the
 * next keeps the user's choice. Keys are bounded and never shared across sessions or Turns.
 */
const OPEN_FOLDS = new Map<string, { open: boolean; listeners: Set<() => void> }>()
const OPEN_FOLDS_LIMIT = 64

function foldEntry(key: string): { open: boolean; listeners: Set<() => void> } {
  let entry = OPEN_FOLDS.get(key)
  if (entry === undefined) {
    entry = { open: false, listeners: new Set() }
    OPEN_FOLDS.set(key, entry)
    for (const oldest of OPEN_FOLDS.keys()) {
      if (OPEN_FOLDS.size <= OPEN_FOLDS_LIMIT) break
      if (oldest === key) break
      OPEN_FOLDS.delete(oldest)
    }
  }
  return entry
}

/**
 * @param identity - session and Turn identity.
 * @returns the open state and its toggle, shared across seats of the same Turn.
 */
export function useActivityOpen(identity: string): [boolean, () => void] {
  const entry = useMemo(() => foldEntry(identity), [identity])
  const open = useSyncExternalStore(
    useCallback((listener: () => void) => {
      entry.listeners.add(listener)
      return () => { entry.listeners.delete(listener) }
    }, [entry]),
    useCallback(() => entry.open, [entry]),
    useCallback(() => entry.open, [entry]))
  const toggle = useCallback(() => {
    entry.open = !entry.open
    for (const listener of entry.listeners) listener()
  }, [entry])
  return [open, toggle]
}

const EMPTY_TOOLS: readonly ToolChatData[] = []
const EMPTY_SOURCE: { getSnapshot: () => readonly ToolChatData[]; subscribe: (callback: () => void) => () => void }
  = { getSnapshot: () => EMPTY_TOOLS, subscribe: () => () => {} }

/**
 * Live activity for one Turn. The tool source is this Turn's Tool-call nodes only, so a token delta
 * does not scan history. A host without the public `turnDataSource` face degrades to no record
 * instead of throwing.
 * @param props - Chat selector hook, session and Turn identity, dictionary and open interactions.
 * @returns the Turn's activity disclosure.
 */
export function TurnActivity({ useChat, sessionId, turn, text, inspectCall, openFile }: {
  useChat: UseChat; sessionId: string; turn: number; text: Translate
  inspectCall?: ((callId: ToolCallId) => void) | undefined
  openFile: (path: string, options?: OpenFileOptions) => void
}) {
  // The host's reader is a class method that returns `this.turnKind(...)`, so the receiver must stay.
  // The list is shown only when the exact readers that make hiding possible are all present; a
  // partial host keeps native rows and shows no second summary of them.
  const source = useChat(snapshot => {
    const nodes = objectField((snapshot as Partial<ChatSnapshot>).nodes)
    const locations = objectField((snapshot as Partial<ChatSnapshot>).locations)
    const read = nodes?.turnDataSource
    if (nodes === undefined || typeof nodes.get !== 'function' || typeof read !== 'function'
      || typeof locations?.getTurn !== 'function') return undefined
    return (read as (turn: number, kind: string) => typeof EMPTY_SOURCE).call(nodes, turn, 'tool-call')
  })
  const subscribe = useCallback((callback: () => void) => (source ?? EMPTY_SOURCE).subscribe(callback), [source])
  const getSnapshot = useCallback(() => (source ?? EMPTY_SOURCE).getSnapshot(), [source])
  const tools = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TOOLS)
  const records = useMemo(() => activities(tools), [tools])
  const [open, toggle] = useActivityOpen(`activity:${sessionId}:${turn}`)
  const id = `dsh-output-activity-${sessionId}-${turn}`.replace(/[^A-Za-z0-9_-]/gu, '-')
  return <ActivityDisclosure id={id} records={records} text={text} open={open} onToggle={toggle}
    onOpenFile={path => openFile(path)} onInspect={inspectCall} />
}
