# 简洁对话 · 结论模式

## 1. 目标

`简洁对话`（`layout: cards`）在最终答案步骤 settle 之后，默认只显示最终答复，把同一组的思考、普通工具行和其他中间步骤收进一条“查看过程”。展开后可回看完整过程，再次收起恢复结论视图。视觉与交互参考 Codex 桌面版：默认答案干净，过程可回看。

## 2. 非目标

- 不改模型输出、不删除会话记录、不改变工具执行。
- 不改其他布局（清晰阅读、深想简答、任务清单）。
- 运行中、中断状态不强制收起；用户需要看到正在发生什么，以及为什么停下。
- 不改宿主原生工具组件，也不做 DOM 劫持；只通过插件自己的根状态和 CSS 分组选择器控制可见性。

## 3. 触发条件

同时满足：

1. `layout === "cards"`；
2. Assistant 步骤 `status === "settled"`；
3. 当前步骤有最终正文（`hasResponse`）；
4. 当前步骤是 Turn 的最终答案步骤（`useTurnData('turn-process').answerStep === data.step`；宿主不提供该投影时保持现有简洁行为，不猜测最终答案）；
5. 存在可回看的过程（推理、工具调用、Turn 的 `toolCallCount`/`messageCount`/`inlineReasoning` 之一）。

中断（`interrupted`）不进入结论模式，保留停止原因和过程，避免把失败包装成“干净结论”。

## 4. 行为

- 收起态：只显示最终答复 + 一条“查看过程”按钮；同组工具行、同组其他 assistant-step 隐藏；组头隐藏，组体强制可见。
- 展开态：显示“收起过程”；同组工具行恢复（包括 web_search 来源卡片），同组其他步骤恢复；当前步骤的思考正文渲染在按钮下方。
- 状态保存在 Assistant 内，按 session/turn/step 复位；不写入偏好，不新增设置项。
- 切换布局、停用插件或离开卡片布局后，根标记消失，原生过程行按宿主规则恢复。
- 运行中维持当前行为：折叠的思考行 + 原生工具行；settle 后自动进入结论模式。

## 5. 实现

- `Assistant.tsx`：读取 `turn-process` 投影，计算 `conclusion`、`hasProcess`、`finalAnswer`；在根节点写 `data-output-conclusion` / `data-output-process-open`；收起态用新的过程按钮替代原思考行。
- 复用 `dsh-output-thinking-toggle` 的按钮与箭头样式；过程正文复用 `dsh-output-reasoning`、`data-reasoning-full`。
- `styles.css`：
  - `[data-chat-group-key]:has(.dsh-output-assistant[data-output-conclusion])` 隐藏组头、强制组体可见。
  - `:not([data-output-process-open])` 时隐藏同组 `[data-chat-flow-kind="tool-call"]` 和非最终 `[data-chat-flow-kind="assistant-step"]`。
  - 选择器使用宿主已有的分组锚点，不查询或改写 DOM。
- `locales.ts`：`processShow`、`processHide` 中英文案。
- 不新增宿主依赖；`turn-process` 是已有 Chat 投影，旧宿主没有时保持现有简洁行为。

## 6. 无障碍

- 原生 `<button>`，`aria-expanded` 反映过程开合；有思考正文时用 `aria-controls` 指向正文。
- 收起的内容用 `display: none`，不进入可访问树；展开后恢复可读。
- 按钮保持焦点，不因展开/收起被卸载。
- 保留最终答复的文本选择和屏幕阅读顺序。

## 7. 验收

- 单步 Turn：settle 后只剩答案 + “查看过程”；展开出现思考/工具/来源；收起恢复。
- 多步 Turn：只保留 `answerStep` 的最终答案；展开后其他步骤和工具可回看。
- 纯文本答案：没有可收起过程时不出现“查看过程”。
- 运行中/中断/非 cards 布局：行为不变。
- 切换布局、停用插件：原生工具/步骤恢复。
- 组件级 jsdom 测试验证根标记、按钮、展开状态；浏览器静态 DOM 验证 CSS 分组隐藏/恢复；真实 DSH rc.4 复核待安装后执行。

当前验证：130 项测试通过；浏览器 mock 分组 DOM 中，收起态工具行/中间步骤/组头均隐藏，展开态恢复，切到 process 布局后规则不再生效。隔离副本构建通过，`lib/client.js` 95,898 bytes，SHA-256 `a9bdfa7e…`；未安装到日常 profile，真实 rc.4 分组 DOM 待安装后复核。

## 8. 风险

- 宿主分组 DOM 是版本契约；若工具行不在同一 `[data-chat-group-key]` 内，CSS 不会误删但会保留原生行。此时停止继续扩展，改为插件渲染替代行，不做 DOM 劫持。
- `:has()` 需要宿主 Chromium；DSH Web 已使用该选择器。
- 隐藏过程后若没有任何可回看入口，属实现错误；触发条件必须包含 `hasProcess`。
