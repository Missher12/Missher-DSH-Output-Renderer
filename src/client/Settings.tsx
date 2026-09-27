/** Settings choices persist through the native Host configuration form. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { OutputInjected } from './Assistant.tsx'
import type { PreferencesController } from './settings.ts'
import { LAYOUTS, MOTIONS } from '../preferences.ts'
import { StreamMarkdown } from './stream.tsx'

export interface SettingsInjected extends OutputInjected { setPreference: PreferencesController['set'] }
type Props = PropsRuntime<'settings.section'> & PropsLocale<'missher.output-renderer'> & InjectFace<SettingsInjected>

export function Settings({ useOutputPreferences, setPreference, t }: Props) {
  const state = useOutputPreferences(value => value)
  const [sample, setSample] = useState(t('sample'))
  const [playing, setPlaying] = useState(false)
  const frame = useRef(0)
  const sampleText = t('sample')
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
    <h2>{t('section')}</h2>
    <fieldset disabled={disabled}><legend>{t('layout')}</legend>
      <div className="dsh-output-options">
        {LAYOUTS.map((layout, index) => <button key={layout} type="button" aria-pressed={state.value.layout === layout}
          onClick={() => { void setPreference('layout', layout) }} className="dsh-output-choice" data-choice={layout}>
          <span className="dsh-output-mini" aria-hidden="true"><i /><i /><i /></span>
          <span className="dsh-output-choice-name">{String.fromCharCode(65 + index)} · {t(layout)}</span>
          <span className="dsh-output-description">{t(`${layout}Hint`)}</span>
        </button>)}
      </div>
    </fieldset>
    <fieldset disabled={disabled}><legend>{t('motion')}</legend>
      <div className="dsh-output-motions">
        {MOTIONS.map(motion => <button key={motion} type="button" aria-pressed={state.value.motion === motion}
          onClick={() => { void setPreference('motion', motion) }} className="dsh-output-choice">
          <span className="dsh-output-choice-name">{t(motion)}</span>
          <span className="dsh-output-description">{t(`${motion}Hint`)}</span>
        </button>)}
      </div>
    </fieldset>
    <div className="dsh-output-settings-status" role="status" data-error={state.error || undefined}>
      {state.error ? t('failed') : !state.ready ? t('loading') : !state.writable ? t('unavailable') : state.saving ? t('saving') : t('saved')}
    </div>
    <section className="dsh-output-preview" aria-label={t('preview')}>
      <div className="dsh-output-preview-header"><span>{t('preview')}</span><button type="button" onClick={replay}>{t('replay')}</button></div>
      <div className="dsh-output-assistant" data-output-layout={state.value.layout} data-output-both="true">
        <section className="dsh-output-reasoning"><div className="dsh-output-label">{t('thinking')}</div><p>{t('note')}</p></section>
        <section className="dsh-output-answer"><div className="dsh-output-label dsh-output-answer-label">{t('answer')}</div>
          <StreamMarkdown text={sample} running={playing} motion={state.value.motion} labels={labels} />
        </section>
      </div>
    </section>
    <p className="dsh-output-description">{t('rate')}</p>
  </div>
}
