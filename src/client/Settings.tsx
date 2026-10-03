/** Settings choices persist through the native Host configuration form. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { OutputInjected } from './Assistant.tsx'
import type { PreferencesController } from './settings.ts'
import { LAYOUTS, MOTIONS, DENSITIES, TEXT_SIZES } from '../preferences.ts'
import { StreamMarkdown } from './stream.tsx'
import { StepLabel } from './StepLabel.tsx'

export interface SettingsInjected extends OutputInjected { setPreference: PreferencesController['set'] }
type Props = PropsRuntime<'settings.section'> & PropsLocale<'missher.output-renderer'> & InjectFace<SettingsInjected>

export function Settings({ useOutputPreferences, setPreference, t }: Props) {
  const state = useOutputPreferences(value => value)
  const processPreview = state.value.layout === 'process' || state.value.layout === 'checklist'
  const sampleText = t(processPreview ? 'processSample' : 'sample')
  const [sample, setSample] = useState(sampleText)
  const [playing, setPlaying] = useState(false)
  const frame = useRef(0)
  const labels = useMemo(() => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied'), toolbarLabels: { codeLabel: t('code'), wrapLabel: t('wrap'), unwrapLabel: t('unwrap') } }, footnotes: t('footnotes') }), [t])
  useEffect(() => {
    cancelAnimationFrame(frame.current)
    setSample(sampleText)
    setPlaying(false)
    return () => cancelAnimationFrame(frame.current)
  }, [sampleText])
  const replay = () => {
    cancelAnimationFrame(frame.current)
    setSample('')
    setPlaying(true)
    let started: number | undefined
    let lastChunk = -1
    const tick = (time: number) => {
      started ??= time
      const count = Math.floor((time - started) / 80) * 3
      if (count !== lastChunk) { lastChunk = count; setSample(sampleText.slice(0, count)) }
      if (count >= sampleText.length) { setSample(sampleText); setPlaying(false) }
      else frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }
  const disabled = state.saving || !state.ready || !state.writable
  return <div className="dsh-output-settings">
    <div className="dsh-output-settings-header">
      <h2>{t('section')}</h2>
      <div className="dsh-output-settings-status" role="status" data-error={state.error || undefined}>
        {state.error ? t('failed') : state.status === 'loading' ? t('loading') : !state.writable || state.status === 'unavailable' ? t('unavailable') : state.saving ? t('saving') : t('saved')}
      </div>
    </div>
    <p className="dsh-output-intro">{t('intro')}</p>
    <fieldset disabled={disabled}><legend>{t('layout')}</legend>
      <div className="dsh-output-options">
        {LAYOUTS.map(layout => <Button key={layout} variant="outline" aria-pressed={state.value.layout === layout}
          disabled={disabled} onClick={() => { void setPreference('layout', layout) }} className="dsh-output-choice" data-choice={layout}>
          <span className="dsh-output-mini" aria-hidden="true"><i /><i /><i /></span>
          <span className="dsh-output-choice-copy">
            <span className="dsh-output-choice-name">{t(layout)}</span>
            <span className="dsh-output-description">{t(`${layout}Hint`)}</span>
          </span>
        </Button>)}
      </div>
    </fieldset>
    <div className="dsh-output-fields">
      <div className="dsh-output-field"><div><span>{t('thinking')}</span><p className="dsh-output-description">{t('thinkingHint')}</p></div><Tag tone="neutral">{t('alwaysOpen')}</Tag></div>
      <fieldset className="dsh-output-field" disabled={disabled}>
        <legend>{t('density')}</legend>
        <div className="dsh-output-controls">
          {DENSITIES.map(density => <Button key={density} variant="outline" size="sm" disabled={disabled}
            aria-pressed={state.value.density === density} onClick={() => { void setPreference('density', density) }}>{t(density)}</Button>)}
        </div>
      </fieldset>
      <fieldset className="dsh-output-field" disabled={disabled}>
        <legend>{t('textSize')}</legend>
        <div className="dsh-output-controls">
          {TEXT_SIZES.map(size => <Button key={size} variant="outline" size="sm" disabled={disabled}
            aria-pressed={state.value.textSize === size} onClick={() => { void setPreference('textSize', size) }}>{t(size)}</Button>)}
        </div>
      </fieldset>
    </div>
    <fieldset disabled={disabled}><legend>{t('motion')}</legend>
      <div className="dsh-output-motions">
        {MOTIONS.map(motion => <Button key={motion} variant="outline" disabled={disabled} aria-pressed={state.value.motion === motion}
          onClick={() => { void setPreference('motion', motion) }} className="dsh-output-choice">
          <span className="dsh-output-choice-name">{t(motion)}</span>
          <span className="dsh-output-description">{t(`${motion}Hint`)}</span>
        </Button>)}
      </div>
    </fieldset>
    <section className="dsh-output-preview" aria-label={t('preview')}>
      <div className="dsh-output-preview-header"><span>{t('preview')}</span><Button variant="outline" size="sm" onClick={replay}>{t('replay')}</Button></div>
      {processPreview && <div className="dsh-output-preview-process" data-output-layout={state.value.layout}>
        {(['processNote', 'verificationNote'] as const).map((note, index) => <div key={note}>
          <div className={`dsh-output-assistant${state.value.layout === 'checklist' ? ' dsh-output-checklist-step' : ''}`}
            data-output-layout={state.value.layout} data-output-density={state.value.density} data-output-text-size={state.value.textSize}>
            {state.value.layout === 'checklist' && <StepLabel step={index + 1} status="settled" text={t} />}
            <section className="dsh-output-reasoning"><div className="dsh-output-label">{t('thinking')}</div><p>{t(note)}</p></section>
          </div>
          <details className="dsh-output-preview-tools"><summary>{t('previewTool')}</summary><p>{t('previewToolDetail')}</p></details>
        </div>)}
      </div>}
      <div className="dsh-output-assistant" data-output-layout={state.value.layout} data-output-both={!processPreview || undefined}
        data-output-density={state.value.density} data-output-text-size={state.value.textSize}>
        {!processPreview && <section className="dsh-output-reasoning"><div className="dsh-output-label">{t('thinking')}</div><p>{t('note')}</p></section>}
        <section className="dsh-output-answer"><div className="dsh-output-label dsh-output-answer-label">{t('answer')}</div>
          <StreamMarkdown text={sample} running={playing} motion={state.value.motion} labels={labels} />
        </section>
      </div>
    </section>
    <p className="dsh-output-description">{t('rate')}</p>
  </div>
}
