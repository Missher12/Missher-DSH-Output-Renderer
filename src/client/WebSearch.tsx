/** Render the built-in web_search call as a default-collapsed source capsule; other tools stay native. */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SearchSources } from '../preferences.ts'
import type { OutputInjected } from './Assistant.tsx'
import { NS } from './locales.ts'
import { readWebSearch, type WebSearchModel, type WebSearchOwner, type WebSearchSource } from './websearch.ts'

/** Props the keyed Tool slot supplies once this entry declares the Bundle locale. */
type ToolProps = WebSearchOwner & PropsLocale<typeof NS>
/** Cards shown before the "more sources" control. */
const CARD_LIMIT = 3
/** Fallback result text is already capped by the model; this is only a render guard. */
const OUTPUT_RENDER_LIMIT = 4000

type Status = 'preparing' | 'searching' | 'done' | 'empty' | 'error' | 'fallback'

/**
 * Take over only the root `web_search` view. A PTC child, an older host without
 * `tool.call.toolview`, or malformed metadata keeps a compact text row instead of
 * rendering nothing; all non-web tools never reach this component.
 */
export function WebSearchRow({ useOutputPreferences, ...props }: ToolProps & InjectFace<Pick<OutputInjected, 'hooks'>>) {
  const mode = useOutputPreferences(state => state.value.layout === 'cards' ? state.value.searchSources : null)
  return <SearchDisclosure key={`${props.callId}:${mode ?? 'standard'}`} {...props} mode={mode} />
}

function SearchDisclosure({ phase, block, t, mode }: ToolProps & { mode: SearchSources | null }) {
  const model = useMemo(() => readWebSearch(phase, block), [phase, block])
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState(false)
  const focusIntent = useRef<'more' | 'collapse' | null>(null)
  const bodyId = useId()
  const moreRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const status = statusOf(model)
  const rich = !model.isChild && model.valid && !model.isError
  const hasSources = rich && model.sources.length > 0
  const open = userOpen ?? (mode === 'auto' && hasSources)
  const visible = expanded ? model.sources : model.sources.slice(0, CARD_LIMIT)
  const remaining = model.sources.length - CARD_LIMIT
  const more = rich && !expanded && remaining > 0
  const truncated = rich && model.truncated
  const showsFooter = rich && model.sources.length > 0 && (expanded || truncated)

  // Expanding replaces the clicked button with the footer action. Move focus with the control
  // instead of dropping it on <body>, and keep the same contract for the reverse action.
  useEffect(() => {
    if (focusIntent.current === 'more') moreRef.current?.focus()
    else if (focusIntent.current === 'collapse') collapseRef.current?.focus()
    focusIntent.current = null
  }, [expanded])

  const toggle = (): void => {
    if (open) setExpanded(false)
    setUserOpen(!open)
  }
  const expandAll = (): void => {
    focusIntent.current = 'collapse'
    setExpanded(true)
  }
  const collapseAll = (): void => {
    focusIntent.current = 'more'
    setExpanded(false)
  }

  if (mode === 'hidden' && hasSources) return <section className="dsh-output-websearch" hidden />
  const label = statusLabel(model, t)
  const stack = rich && model.sources.length > 0 ? model.sources.slice(0, 4) : []
  const extra = rich && model.sources.length > 4 ? model.sources.length - 4 : 0
  return <section className="dsh-output-websearch" data-websearch-status={status} data-websearch-phase={phase} data-concise={mode !== null || undefined}
    aria-label={t('webSearchLabel')}>
    <button type="button" className="dsh-output-websearch-pill" aria-expanded={open} aria-controls={bodyId}
      onClick={toggle}>
      <span className="dsh-output-websearch-globe" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 3.7 5.6 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" />
        </svg>
      </span>
      <span className="dsh-output-websearch-copy">
        <span className="dsh-output-websearch-label" aria-live="polite">{label}</span>
        {open || model.query === '' ? null : <span className="dsh-output-websearch-query">{`“${model.query}”`}</span>}
      </span>
      {stack.length === 0 ? null : <span className="dsh-output-websearch-stack" aria-hidden="true">
        {stack.map((source, index) => <Favicon key={`${source.url}:${index}`} source={source} />)}
        {extra === 0 ? null : <span className="dsh-output-websearch-extra">{`+${extra}`}</span>}
      </span>}
      <Chevron />
    </button>
    <div id={bodyId} className="dsh-output-websearch-body" hidden={!open}>
      {open && model.query && <p className="dsh-output-websearch-query-full">{`“${model.query}”`}</p>}
      {model.isError ? <p className="dsh-output-websearch-error">{model.errorDetail ?? t('webSearchFailedDetail')}</p>
        : model.isChild ? <Fallback model={model} text={t('webSearchNoDetails')} />
          : phase === 'preparing' ? <p className="dsh-output-websearch-muted">{t('webSearchPreparingHint')}</p>
            : phase === 'start' ? <Skeleton />
              : !model.valid ? <Fallback model={model} text={t('webSearchNoDetails')} />
                : model.sources.length === 0 ? <p className="dsh-output-websearch-muted">{t('webSearchEmptyDetail')}</p>
                  : <>
                  <div className="dsh-output-websearch-grid">
                    {visible.map((source, index) => <Card key={`${source.url}:${index}`} source={source} index={index} t={t} />)}
                    {more ? <MoreSources sources={model.sources.slice(CARD_LIMIT, CARD_LIMIT + 3)} remaining={remaining}
                      buttonRef={moreRef} onClick={expandAll} t={t} /> : null}
                  </div>
                  {showsFooter ? <div className="dsh-output-websearch-footer">
                    {truncated ? <span className="dsh-output-websearch-truncated">{t('webSearchTruncated')}</span> : null}
                    <span className="dsh-output-websearch-spacer" />
                    {expanded ? <button ref={collapseRef} type="button" className="dsh-output-websearch-action"
                      onClick={collapseAll}>{t('webSearchCollapse')}</button> : null}
                  </div> : null}
                </>}
    </div>
  </section>
}

function statusOf(model: WebSearchModel): Status {
  if (model.isError) return 'error'
  if (model.isChild) return 'fallback'
  if (model.phase === 'preparing') return 'preparing'
  if (model.phase === 'start') return 'searching'
  if (!model.valid) return 'fallback'
  return model.sources.length === 0 ? 'empty' : 'done'
}

function statusLabel(model: WebSearchModel, t: ToolProps['t']): string {
  if (model.isError) return t('webSearchFailed')
  if (model.isChild) return t('webSearchFallback')
  if (model.phase === 'preparing') return t('webSearchPreparing')
  if (model.phase === 'start') return t('webSearchSearching')
  if (!model.valid) return t('webSearchFallback')
  if (model.sources.length === 0) return t('webSearchEmpty')
  if (model.sources.length === 1) return t('webSearchSearchedOne')
  return t('webSearchSearched', { count: model.sources.length })
}

function Card({ source, index, t }: { source: WebSearchSource; index: number; t: ToolProps['t'] }) {
  const title = source.title ?? (source.domain || t('webSearchUntitled'))
  const content = <>
    <span className="dsh-output-websearch-card-title">{title}</span>
    <span className="dsh-output-websearch-card-foot">
      <Favicon source={source} />
      <span className="dsh-output-websearch-site">{source.domain || t('webSearchUntitled')}</span>
      <span className="dsh-output-websearch-index">{index + 1}</span>
    </span>
  </>
  return source.href === undefined
    ? <div className="dsh-output-websearch-card" data-websearch-source={index}>{content}</div>
    : <a className="dsh-output-websearch-card" data-websearch-source={index} href={source.href}
        target="_blank" rel="noreferrer noopener" aria-label={`${title} — ${source.domain || t('webSearchUntitled')}`}>{content}</a>
}

function Favicon({ source, small = false }: { source: WebSearchSource; small?: boolean }) {
  const style = { '--websearch-hue': source.hue } as CSSProperties
  return <span className={`dsh-output-websearch-fav${small ? ' dsh-output-websearch-fav-small' : ''}`}
    style={style} aria-hidden="true">{source.letter}</span>
}

function MoreSources({ sources, remaining, buttonRef, onClick, t }: {
  sources: readonly WebSearchSource[]
  remaining: number
  buttonRef: RefObject<HTMLButtonElement>
  onClick: () => void
  t: ToolProps['t']
}) {
  return <button ref={buttonRef} type="button" className="dsh-output-websearch-more" onClick={onClick}>
    <span className="dsh-output-websearch-more-favs" aria-hidden="true">
      {sources.map((source, index) => <Favicon key={`${source.url}:${index}`} source={source} small />)}
    </span>
    <strong>{remaining === 1 ? t('webSearchMoreOne') : t('webSearchMore', { count: remaining })}</strong>
    <span>{t('webSearchShowAll')}</span>
  </button>
}

function Skeleton() {
  return <div className="dsh-output-websearch-grid" aria-hidden="true">
    {[0, 1, 2].map(index => <div key={index} className="dsh-output-websearch-skeleton">
      <span className="dsh-output-websearch-bone dsh-output-websearch-bone-wide" />
      <span className="dsh-output-websearch-bone" />
      <span className="dsh-output-websearch-bone dsh-output-websearch-bone-short" />
      <span className="dsh-output-websearch-bone dsh-output-websearch-bone-foot" />
    </div>)}
  </div>
}

function Fallback({ model, text }: { model: WebSearchModel; text: string }) {
  const output = model.output.slice(0, OUTPUT_RENDER_LIMIT)
  return output === '' ? <p className="dsh-output-websearch-muted">{text}</p>
    : <pre className="dsh-output-websearch-output">{output}</pre>
}

function Chevron() {
  return <svg className="dsh-output-websearch-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
}
