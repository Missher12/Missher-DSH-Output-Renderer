/** Pure projection of one web_search Tool block into the source-card model. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Tool stages the host publishes for one atomic call. */
export type WebSearchPhase = 'preparing' | 'start' | 'result'

/** One source as the card needs it: the persisted fields plus display-safe derivations. */
export interface WebSearchSource {
  /** Provider URL, kept verbatim for diagnostics and duplicate keys. */
  url: string
  /** Safe external target; absent for a non-http(s) URL. */
  href?: string
  title?: string
  snippet?: string
  publishedAt?: string
  /** Hostname without `www.`, or empty when the URL cannot be parsed. */
  domain: string
  /** One-character letter mark; never a network favicon. */
  letter: string
  /** Stable brand hue derived from the domain, 0–359. */
  hue: number
}

/** Normalized view of one call, independent of React and the host locale. */
export interface WebSearchModel {
  phase: WebSearchPhase
  /** Joined search queries; empty while preparing or when the call head left the window. */
  query: string
  sources: readonly WebSearchSource[]
  truncated: boolean
  /** Whether a settled result carried the complete web_search meta contract. */
  valid: boolean
  isError: boolean
  /** A PTC dispatch child is kept on the generic compact row. */
  isChild: boolean
  /** Short settled failure reason, already trimmed and capped. */
  errorDetail?: string
  /** Flattened result text for the malformed-meta fallback; capped by the model. */
  output: string
}

/** The structural subset of a host Tool block this view reads. */
export interface WebSearchBlock {
  readonly kind?: string
  readonly phase?: 'preparing' | 'start'
  readonly name?: string
  readonly parentCallId?: string
  readonly argsRaw?: string
  readonly call?: { readonly name?: string; readonly argsRaw?: string } | null
  readonly meta?: unknown
  readonly isError?: boolean
  readonly error?: { readonly reason?: string }
  readonly content?: readonly unknown[]
}

/** Owner currency supplied to a registered keyed Tool view. */
export interface WebSearchOwner {
  readonly callId: string
  readonly toolName: string
  readonly phase: WebSearchPhase
  readonly block: WebSearchBlock
}

/**
 * Declare the keyed Tool slot our component shadows. The pinned rc.2 development SDK predates
 * this slot (the host declares it in ui-tool), so the minimal owner contract lives beside the
 * view that consumes it; the component still registers by the exact wire name the host uses.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'tool.call.toolview': {
      kind: 'keyed'
      scope: 'session'
      owner: WebSearchOwner
    }
  }
}

const OUTPUT_LIMIT = 4000
const ERROR_LIMIT = 240

/**
 * Read one web_search call head and its persisted result.
 * @param phase - owning Tool stage; the block itself is a union without a phase on results.
 * @param block - host Tool block at that stage.
 * @returns a display model that never throws on malformed provider metadata.
 */
export function readWebSearch(phase: WebSearchPhase, block: WebSearchBlock): WebSearchModel {
  const isChild = block.parentCallId !== undefined
  const query = phase === 'preparing' ? '' : readQuery(block, phase)
  if (phase === 'preparing') {
    return { phase, query, sources: [], truncated: false, valid: false, isError: false, isChild, output: '' }
  }
  if (phase === 'start') {
    return { phase, query, sources: [], truncated: false, valid: false, isError: false, isChild, output: '' }
  }
  const isError = block.isError === true
  const meta = isError ? undefined : readMeta(block.meta)
  const errorDetail = isError ? readError(block) : undefined
  return {
    phase,
    query,
    sources: meta?.sources ?? [],
    truncated: meta !== undefined && meta.truncated,
    valid: meta !== undefined,
    isError,
    isChild,
    ...(errorDetail === undefined ? {} : { errorDetail }),
    output: flattenContent(block.content),
  }
}

function readQuery(block: WebSearchBlock, phase: WebSearchPhase): string {
  const raw = phase === 'start' ? block.argsRaw : block.call?.argsRaw
  if (typeof raw !== 'string' || raw === '') return ''
  let value: unknown
  try { value = JSON.parse(raw) }
  catch (_error) { return '' }
  if (!isRecord(value)) return ''
  if (Array.isArray(value.queries)) {
    const queries = value.queries.filter((query): query is string => typeof query === 'string' && query.trim() !== '')
    if (queries.length > 0) return queries.map(query => query.trim()).join(' · ')
  }
  return typeof value.query === 'string' && value.query.trim() !== '' ? value.query.trim() : ''
}

interface MetaView { sources: WebSearchSource[]; truncated: boolean }

function readMeta(value: unknown): MetaView | undefined {
  if (!isRecord(value) || typeof value.truncated !== 'boolean') return undefined
  if (value.answer !== undefined && typeof value.answer !== 'string') return undefined
  const sources = readSources(value.sources)
  return sources === undefined ? undefined : { sources, truncated: value.truncated }
}

function readSources(value: unknown): WebSearchSource[] | undefined {
  if (!Array.isArray(value)) return undefined
  const sources: WebSearchSource[] = []
  for (const source of value) {
    if (!isRecord(source) || typeof source.url !== 'string') return undefined
    if (source.title !== undefined && typeof source.title !== 'string') return undefined
    if (source.snippet !== undefined && typeof source.snippet !== 'string') return undefined
    if (source.publishedAt !== undefined && typeof source.publishedAt !== 'string') return undefined
    sources.push(readSource(source.url, optionalText(source.title), optionalText(source.snippet),
      optionalText(source.publishedAt)))
  }
  return sources
}

function readSource(url: string, title: string | undefined, snippet: string | undefined,
  publishedAt: string | undefined): WebSearchSource {
  const href = safeHttpUrl(url)
  const domain = domainOf(url)
  const letter = firstCharacter(domain || title || url)
  return {
    url,
    ...(href === undefined ? {} : { href }),
    ...(title === undefined ? {} : { title }),
    ...(snippet === undefined ? {} : { snippet }),
    ...(publishedAt === undefined ? {} : { publishedAt }),
    domain,
    letter,
    hue: hueOf(domain || url),
  }
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text === '' ? undefined : text
}

function readError(block: WebSearchBlock): string | undefined {
  const reason = optionalText(block.error?.reason)
  if (reason === undefined) return undefined
  return reason.length > ERROR_LIMIT ? `${reason.slice(0, ERROR_LIMIT)}…` : reason
}

function flattenContent(content: readonly unknown[] | undefined): string {
  if (content === undefined) return ''
  const parts: string[] = []
  for (const block of content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else {
      try { parts.push(JSON.stringify(block, null, 2)) }
      catch (_error) { /* A non-serializable block contributes no fallback text. */ }
    }
  }
  const output = parts.join('\n')
  return output.length > OUTPUT_LIMIT ? `${output.slice(0, OUTPUT_LIMIT)}…` : output
}

/** Accept only an external URL the Browser can open without a script or local-file capability. */
function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined
  } catch (_error) { return undefined }
}

function domainOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./iu, '')
  } catch (_error) { return '' }
}

function firstCharacter(value: string): string {
  const first = Array.from(value.trim())[0]
  return first === undefined ? '?' : first.toUpperCase()
}

function hueOf(value: string): number {
  let hue = 0
  for (let index = 0; index < value.length; index++) hue = (hue * 31 + value.charCodeAt(index)) % 360
  return hue
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
