import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { StepLabel } from '../src/client/StepLabel.tsx'
import { zh } from '../src/client/locales.ts'

test.each([
  ['running', '输出中', '·'],
  ['settled', '输出完成', '✓'],
  ['interrupted', '已停止', '−'],
] as const)('%s reports Assistant output status without claiming tool success', (status, label, mark) => {
  const html = renderToStaticMarkup(<StepLabel step={8} status={status} text={key => zh[key]} />)
  expect(html).toContain('步骤 8')
  expect(html).toContain(label)
  expect(html).toContain(`aria-hidden="true">${mark}`)
  expect(html).not.toContain('检查通过')
  if (status !== 'settled') expect(html).not.toContain('✓')
})
