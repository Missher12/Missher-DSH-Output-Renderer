/** Replace only the public assistant-step seat; all other native seats remain. */
import { Fragment, memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { ChatNodeViewProps, TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { JsonBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { fileMediaUrl } from '@deepseek-ai/dsh-util-workspace-path'
import type { PreferencesController } from './settings.ts'
import type { Translate } from './locales.ts'
import { StreamMarkdown } from './stream.tsx'
import { StepLabel } from './StepLabel.tsx'

export interface OutputInjected {
  hooks: { outputPreferences: ObservableSnapshot<ReturnType<PreferencesController['store']['getSnapshot']>> }
  outputText: Translate
}
type Props = ChatNodeViewProps<'assistant-step'> & InjectFace<OutputInjected>

export const Assistant = memo(function Assistant({ node, groupPart, useTurnData, openFile, renderMessageImages,
  fileMentions, useOutputPreferences, outputText, t }: Props) {
  const { motion, layout, density, textSize } = useOutputPreferences(state => state.value)
  const data = node.data
  const running = data.status === 'running'
  const turn = node.location.kind === 'turn' || node.location.kind === 'step' ? node.location.turn : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || !data.finalNode || tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [turn, data.finalNode, tail, openFile])
  const mentions = useMemo(() => owner ? fileMentions(owner) : undefined, [owner, fileMentions])
  const labels = useMemo(() => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied'),
    toolbarLabels: { codeLabel: t('codeBlock.title'), wrapLabel: t('codeBlock.wrap'), unwrapLabel: t('codeBlock.unwrap') } },
    footnotes: t('markdown.footnotes') }), [t])
  const pathImages = useMemo(() => ({ resolve(value: string) {
    let path: string
    try { path = decodeURIComponent(value.split(/[?#]/u)[0] ?? '') }
    catch (_error) { return undefined }
    return fileMediaUrl(document.baseURI, path)
  } }), [])
  const reasoning: ReactNode[] = []
  const response: ReactNode[] = []
  for (let index = 0; index < data.blocks.length; index++) {
    const block = data.blocks[index]!
    if (block.kind === 'tool-call' || (groupPart === 'reasoning' && block.kind !== 'reasoning')
      || (groupPart === 'response' && block.kind === 'reasoning')) continue
    if (block.kind === 'reasoning') {
      if (!block.text.trim()) continue
      reasoning.push(<StreamMarkdown key={index} text={block.text} running={running && index === data.blocks.length - 1}
        motion={motion} labels={labels} compact />)
    } else if (block.kind === 'text') {
      if (!block.text.trim()) continue
      response.push(<StreamMarkdown key={index} text={block.text} running={running} motion={motion} labels={labels}
        mentions={mentions} pathImages={pathImages} />)
    } else if (block.kind === 'image') {
      const first = index
      const images = [{ attachment: block.attachment }]
      while (data.blocks[index + 1]?.kind === 'image') {
        const next = data.blocks[++index]!
        if (next.kind === 'image') images.push({ attachment: next.attachment })
      }
      response.push(<Fragment key={first}>{renderMessageImages({ images, align: 'start' })}</Fragment>)
    } else {
      response.push(<JsonBlock key={index} label={t('message.unknownBlock')} payload={block.block}
        truncatedLabel={total => t('json.truncated', { total })} />)
    }
  }
  const hasReasoning = data.blocks.some(block => block.kind === 'reasoning' && block.text.trim())
  const hasResponse = data.blocks.some(block => block.kind === 'text' ? block.text.trim()
    : block.kind !== 'reasoning' && block.kind !== 'tool-call')
  const interrupted = data.status === 'interrupted' && (groupPart !== 'reasoning' || !hasResponse)
  if (!reasoning.length && !response.length && !interrupted) return null
  const checklistStep = layout === 'checklist' && (reasoning.length > 0
    || !hasReasoning && (response.length > 0 || interrupted))
  const showStopped = interrupted && (layout !== 'checklist' || !hasReasoning && !checklistStep)
  return <div className={`dsh-output-assistant${checklistStep ? ' dsh-output-checklist-step' : ''}`} data-output-layout={layout} data-output-part={groupPart}
    data-output-density={density} data-output-text-size={textSize}
    data-output-both={reasoning.length > 0 && response.length > 0 || undefined} data-output-running={running || undefined}>
    {checklistStep && <StepLabel step={data.step} status={data.status} text={outputText} />}
    {reasoning.length > 0 && <section className="dsh-output-reasoning" aria-label={outputText('thinking')}>
      <div className="dsh-output-label">{outputText('thinking')}</div>
      <div data-reasoning-full>{reasoning}</div>
    </section>}
    {response.length > 0 && <section className="dsh-output-answer" aria-label={outputText('answer')}>
      <div className="dsh-output-label dsh-output-answer-label">{outputText('answer')}</div>
      {response}
    </section>}
    {showStopped && <span className="dsh-output-stopped">{outputText('stopped')}</span>}
  </div>
})
