/** Product copy owned by the output renderer. */
export const NS = 'missher.output-renderer'
export const en = {
  section: 'Output appearance', layout: 'Response layout', motion: 'Streaming effect',
  reader: 'Simple reading', cards: 'Section cards', timeline: 'Execution timeline', split: 'Side by side',
  readerHint: 'Continuous text with quiet process details.', cardsHint: 'Separate thinking, actions and answers.',
  timelineHint: 'Follow the progress of each step.', splitHint: 'Process on the left, answers on the right. Narrow panes stack.',
  smooth: 'Frame-synchronized', fade: 'New text fade-in',
  smoothHint: 'Reveal buffered text on display frames, without a fixed frame-rate cap.',
  fadeHint: 'Fade in only arriving text. Previously displayed text stays unchanged.',
  note: 'Thinking stays fully visible. Code, links, images and tool actions use the built-in renderer.',
  rate: 'Display refresh and model generation speed are independent. Reduced-motion preferences are respected.',
  saving: 'Saving…', saved: 'Saved', loading: 'Loading settings…', unavailable: 'Settings cannot be saved on this connection.',
  failed: 'Could not save. The previous setting has been restored.',
  thinking: 'Thinking', answer: 'Response', stopped: 'Stopped', preview: 'Preview', replay: 'Replay output',
  sample: 'The four layouts share the same content. New text appears smoothly; code and tool actions remain available.',
  copy: 'Copy', copied: 'Copied', code: 'Code', wrap: 'Wrap', unwrap: 'Unwrap', footnotes: 'Footnotes',
}
export const zh: Record<keyof typeof en, string> = {
  section: '输出外观', layout: '回复布局', motion: '流式输出效果',
  reader: '简洁阅读', cards: '分区卡片', timeline: '执行时间线', split: '左右分栏',
  readerHint: '连续排版，降低过程信息的视觉干扰。', cardsHint: '思考、执行与回复分区呈现。',
  timelineHint: '沿时间线查看每一步进展。', splitHint: '左侧看过程，右侧读回复；窄窗口自动上下排列。',
  smooth: '刷新率同步', fade: '新增文字淡入',
  smoothHint: '按屏幕刷新节奏显示缓冲文字，不设固定帧率上限。',
  fadeHint: '仅新到达的文字渐显，已经读过的内容保持稳定。',
  note: '思考全文显示。代码、链接、图片和工具操作沿用原生能力。',
  rate: '显示刷新率与模型生成速度相互独立；遵循系统“减少动态效果”设置。',
  saving: '正在保存…', saved: '已保存', loading: '正在读取设置…', unavailable: '当前连接无法保存设置。',
  failed: '保存失败，已恢复此前的设置。',
  thinking: '思考过程', answer: '回复', stopped: '已停止', preview: '效果预览', replay: '重播输出',
  sample: '四种布局共用同一份内容。新增文字平滑出现，代码与工具操作保持可用。',
  copy: '复制', copied: '已复制', code: '代码', wrap: '自动换行', unwrap: '取消换行', footnotes: '脚注',
}
export type OutputKey = keyof typeof en
export type Translate = (key: OutputKey) => string
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'missher.output-renderer': OutputKey }
}
