/** Local-only adapter for the real Agent loop; excluded from the installable Bundle. */
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
export const inject = ['llm']
export async function apply(ctx) {
  const { LlmAdapter } = await import(pathToFileURL(process.env.DSH_OUTPUT_TEST_LLM ?? resolve(process.env.DSH_OUTPUT_TEST_SOURCE, 'packages/llm/llm/lib/index.js')).href)
  let called = false
  class Preview extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'local-render', name: '仅本地输出验证' }] }
    async *stream(options) {
      const titleOnly = !options.tools?.length
      if (titleOnly) {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: '输出渲染验证' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '输出渲染验证' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      }
      const reasoning = '这是隔离环境中的本地合成输出，用来验证思考全文、工具原生交互和流式渲染。\n\n'
        + '先查看演示文件，再检查 Markdown、中文、组合字符 é 和 emoji 👩🏽‍💻 的完整性。\n\n'
        + '所有内容只用于界面验证，不会请求真实模型。'.repeat(8)
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(reasoning)].map(part => part.segment)
      for (let i = 0; i < graphemes.length; i += 6) {
        options.signal?.throwIfAborted()
        yield { type: 'reasoning-delta', index: 0, text: graphemes.slice(i, i + 6).join('') }
        await delay(28, undefined, { signal: options.signal })
      }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: reasoning } }
      const read = options.tools.find(tool => tool.name === 'read')
      const run = options.tools.find(tool => tool.name === 'run_code')
      if (!called && (read || run)) {
        called = true
        const name = read ? 'read' : 'run_code'
        const args = read ? { file_path: resolve('output-sample.txt') } : { code: 'return "OUTPUT_RENDERER_LOCAL_FIXTURE";', description: '返回本地演示结果' }
        const block = { type: 'tool-call', id: 'output-renderer-local-call', name, arguments: JSON.stringify(args) }
        yield { type: 'block-start', index: 1, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index: 1, id: block.id, name, argumentsDelta: block.arguments }
        yield { type: 'block-end', index: 1, block }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
        return
      }
      const text = '## 四种布局，内容一致\n\n这里只改变呈现方式。**思考全文显示**，工具和文件继续使用 DSH 的原生能力。\n\n'
        + '```ts\nconst result = await loadSessions({\n  limit: 30,\n  cursor: nextCursor,\n});\n```\n\n'
        + '| 方案 | 用途 |\n| --- | --- |\n| 简洁阅读 | 连续阅读 |\n| 分区卡片 | 分区对照 |\n| 执行时间线 | 查看过程 |\n| 左右分栏 | 同时查看过程与结果 |\n\n'
        + `[查看本地演示文件](${resolve('output-sample.txt')})\n\n`
        + '完整性标记：中文、é、👩🏽‍💻、结尾 END_RENDER_OK。'
      yield { type: 'block-start', index: 1, blockType: 'text' }
      const chars = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(part => part.segment)
      for (let i = 0; i < chars.length; i += 7) {
        options.signal?.throwIfAborted()
        yield { type: 'text-delta', index: 1, text: chars.slice(i, i + 7).join('') }
        await delay(28, undefined, { signal: options.signal })
      }
      yield { type: 'block-end', index: 1, block: { type: 'text', text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['output-preview'], new Preview()))
}
