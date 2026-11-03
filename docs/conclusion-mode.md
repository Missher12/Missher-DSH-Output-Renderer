# 简洁对话 · 结论模式

## 1. 目标

`简洁对话`（`layout: cards`）在最终答案步骤 settle 之后，只显示最终答复：不保留“查看过程”按钮，也不提供过程回看入口。视觉与交互参考 Codex 桌面版：完成后答案干净，过程不重复占位。唯一的例外是 `web_search` 来源胶囊：它默认折叠保留，点击可展开来源网页，方便核对。

运行中仍显示过程；同一组内只允许出现一个“已思考”折叠行，避免多步 Turn 为每个 assistant-step 各渲染一行。

## 2. 非目标

- 不改模型输出、不删除会话记录、不改变工具执行。
- 不改其他布局（清晰阅读、深想简答、任务清单）。
- 运行中、中断状态不强制收起；用户需要看到正在发生什么，以及为什么停下。
- 不提供完成后的过程回看入口；`web_search` 来源胶囊是唯一例外，默认折叠、点击展开，不作为“查看过程”入口。
- 不改宿主原生工具组件，也不做 DOM 劫持；只通过插件自己的根状态和 CSS 分组选择器控制可见性。

## 3. 触发条件

同时满足：

1. `layout === "cards"`；
2. Assistant 步骤 `status === "settled"`；
3. 当前步骤有最终正文（`hasResponse`）；
4. 当前步骤是 Turn 的最终答案步骤（`useTurnData('turn-process').answerStep === data.step`；宿主不提供该投影时保持现有简洁行为，不猜测最终答案）。

中断（`interrupted`）不进入结论模式，保留停止原因和过程，避免把失败包装成“干净结论”。

结论模式不再要求存在可回看过程：即使没有推理/工具，最终答案自身就是结论，结果不变。

## 4. 行为

- 完成态：只显示最终答复；同组工具行、同组其他 assistant-step 隐藏；组头隐藏，组体强制可见；没有“查看过程/收起过程”按钮，也没有额外的思考行。包含 `.dsh-output-websearch` 的 tool-call 是唯一保留项，搜索胶囊默认折叠，点击展开来源卡片。
- 运行中：维持现有折叠思考行 + 原生工具行；同一组内只显示一个 `.dsh-output-thinking`，即最新 assistant-step 的思考行。更早步骤的思考行隐藏，但它们的答复和工具仍按宿主规则显示。
- 中断态：不进入结论模式；仍显示一个思考行，停止提示按原有归属显示。
- 不保存额外状态，不写入偏好，不新增设置项。
- 切换布局、停用插件或离开卡片布局后，根标记消失，原生过程行按宿主规则恢复。
- 多步 Turn：`answerStep` 的最终答案保留；其他步骤和工具由 CSS 隐藏；web_search 胶囊保留并折叠。

## 5. 实现

- `Assistant.tsx`：读取 `turn-process` 投影，计算 `conclusion`、`finalAnswer`；在根节点只写 `data-output-conclusion`。结论态不渲染思考行或过程按钮；运行/中断态继续渲染原有 `ThinkingDisclosure`。
- `styles.css`：
  - `[data-chat-group-key]:has(.dsh-output-assistant[data-output-conclusion])` 隐藏组头、强制组体可见，并隐藏同组 `[data-chat-flow-kind="tool-call"]` 与非最终 `[data-chat-flow-kind="assistant-step"]`。
  - 在隐藏规则后追加例外：`[data-chat-flow-kind="tool-call"]:has(.dsh-output-websearch)` 恢复 `display: block`；只恢复搜索行，其他工具继续隐藏。WebSearchRow 自身默认 `open=false`，所以恢复的只是胶囊，不自动展开。
  - 运行态去重：隐藏前面 assistant-step 的 `.dsh-output-thinking`，保留最新一步；同一 step 的 reasoning/response 拆分通过 `data-chat-group-part="response"` 排除，避免把本步思考行误判为重复。
  - 选择器使用宿主已有的分组锚点，不查询或改写 DOM。
- `locales.ts`：不再需要 `processShow`/`processHide`。
- 不新增宿主依赖；`turn-process` 是已有 Chat 投影，旧宿主没有时保持现有简洁行为。

## 6. 无障碍

- 没有过程按钮，因此没有额外的 `aria-expanded`/`aria-controls` 状态。
- 被隐藏的工具、其他步骤和重复思考行使用 `display: none`，不进入可访问树。
- 最终答复保持可选中、可读出；运行中的唯一思考行仍使用原生按钮、键盘可操作。
- 隐藏是纯视觉行为，不卸载最终答复或宿主订阅。

## 7. 验收

- 单步 Turn：settle 后只剩答复；不出现“查看过程/已思考”行；普通工具行隐藏；web_search 胶囊保留且默认折叠，点击可展开来源。
- 多步 Turn：只保留 `answerStep` 的最终答案；其他步骤和普通工具隐藏，且没有过程按钮；web_search 胶囊保留。
- 运行中：同一组只出现一个“已思考”行；中断：仍显示一个思考行，不进入结论态。
- 非 cards 布局：行为不变，思考完整展示。
- 切换布局、停用插件：原生工具/步骤恢复。
- 组件级 jsdom 测试验证根标记、无过程按钮/思考行、运行/中断/非最终/非 cards 分支；浏览器静态 DOM 验证分组隐藏、单思考行去重和布局切换。

当前验证：0.2.3 的 131 项测试、双端 typecheck、隔离构建和浏览器 mock 分组 DOM 通过；结论态组头 none、组体 block、web_search 行 block、普通工具 none、非最终步骤 none、最终答复 block，胶囊初始 `aria-expanded=false` 且 body hidden。0.2.1 的实际页面结论行为已由用户确认；0.2.3 的搜索默认折叠/结论保留来源仍需真实页面复核。

## 8. 风险

- 宿主分组 DOM 是版本契约；若工具行不在同一 `[data-chat-group-key]` 内，CSS 不会误删但会保留原生行。
- 去重选择器依赖 `data-chat-group-part="response"` 区分同一步的 reasoning/response；若宿主省略该属性，拆分步骤可能没有思考行（不会重复，但会少一行）。实际 rc.4 需复核。
- `:has()` 需要宿主 Chromium；DSH Web 已使用该选择器。
- 这是“只留结论”的产品选择；如果以后要恢复过程回看，需要重新增加显式入口，不能用隐藏状态假装可访问。
- 旧宿主没有 `turn-process` 投影时保持原简洁行为，不猜测最终答案。
