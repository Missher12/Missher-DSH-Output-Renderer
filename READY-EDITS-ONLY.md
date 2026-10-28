# READY · 0.1.6 简洁对话运行候选（R10 已接受）

状态：R10 运行候选已接受。当前正式已安装 `0.1.5`；意向 `0.1.6` 尚未版本化/导出/打包/Git/发布/安装。canonical `package.json` 仍为 `0.1.4`，canonical `lib` 未回填，已验证运行件在 `verification-r10`。窗口 98 client typecheck + 49 项受影响测试通过，101 为仅 CSS 变更的 build；103/107/108 真实 UI 覆盖宽窄对齐、文件打开、活动到结束保留展开、命令成功与 exit 7、布局切换、原生停用清理，107/108 自然退出 0 且 guard 完整。仅在现有 community `0.2.1-rc.2` Web 验收；官方宿主/native/跨平台/真实 provider 未验证。外部模型验收 0 不等于原生开发调用 0。代码与已验运行字节保持不变。

以下为实现与历史记录，按达到时的状态保留。

## 本轮用户澄清（覆盖此前「仅文件编辑」）

简洁对话（持久化值仍是 `cards`）中：思考原文完全不显示（含展开后）；正文照常阅读与流式；正文下方是**工具操作摘要**，默认折叠，覆盖编辑/新建、读取、搜索、运行命令。只有**没有任何实际工具活动**时才不显示入口；纯读取/搜索也必须有折叠项。

## 修改文件

| 文件 | 变更 |
| --- | --- |
| `src/client/Edits.tsx` | 活动模型与摘要披露（编辑/读取/搜索/命令）、可见性签名与按节点 key 的规则、Turn 级可见性驱动组件 |
| `src/client/ActivityTail.tsx` | 新增。公开 `conversation.chat.turnTail` 追加项：Turn 结束后的操作摘要 + 可见性控制器 |
| `src/client/ActivityDock.tsx` | 新增。公开 `conversation.input.dock` 追加项：真实 turn-tail 发布前的活动摘要 + 同一控制器 |
| `src/client/Assistant.tsx` | 简洁对话不渲染思考、保留正文；不再承担摘要/控制器 |
| `src/client/Settings.tsx` | 预览改为「回答 + 示例操作摘要」；提示文案改为「工具活动汇总」 |
| `src/client/locales.ts` | 操作摘要文案（分类动词、进行时、计数单位、行动词）；移除编辑专用文案 |
| `src/client/styles.css` | 删除思考折叠与编辑记录样式；新增操作摘要、图标、行样式、dock 限高与长目标省略 |
| `src/client/index.ts` | 新增 turnTail 与 input-dock 两个公开 slot 追加项；dock 在 `sidebarRight`+`sessions` 的公开服务生命周期内注册 |
| `src/client/Thinking.tsx` | 删除（折叠思考已不存在） |
| `tests/assistant-concise.test.tsx` | 重写：摘要组合、进行时、纯读取、无活动无入口、失败/交互/未知保留、节点 key 规则、跨会话、退出尾部、缺失接口 |
| `tests/assistant.test.tsx` | 简洁对话不再含思考正文；`已停止` 仍恰好一次；静态夹具的 `useChat` 改为安全桩 |
| `tests/settings-view.test.tsx` | 简洁预览：示例操作摘要、无思考、`thinkingHidden`；其余布局无摘要 |
| `tests/client-lifecycle.test.ts` | 新增 slot 的声明/注册/释放计数；dock 的公开服务晚到、撤销、恢复与部分能力用例 |

未改：`src/index.ts`、`src/preferences.ts`、`src/client/settings.ts`、`src/client/stream.tsx`、`package.json`、`pnpm-lock.yaml`、`lib/`、`dist/`、`docs/`、其他布局、Host/日常 profile、Git。

## 实现与公开接口

- **思考**：`cards` 下不渲染 reasoning（无折叠行、无正文、无入口）。其他三布局逐字保留原「全文显示」渲染。
- **不运行时导入 Chat 包**：宿主的 `@deepseek-ai/dsh-client-ui-chat/client` 导出是 `window.__ModuleLoader__.load(...)` 形式的浏览器 bundle，不是 ESM。本插件只做 **type-only** 导入，`isSettledTool` 改为本地类型守卫 `block.kind === 'tool-result'`；没有新增 Host 依赖，也没有把整包打进插件。
- **活动模型**：`write` / `edit` / `str_replace_editor`（`create|str_replace|insert`）= 编辑；`read` / `read_image` / `str_replace_editor view` = 读取；`grep` / `glob` = 搜索；`bash` / `pwsh` / `terminal` / `*_persistent` / `shell` = 运行命令。其余工具（含 `ask_user_question` 等交互工具）不进入摘要，保留原生行。
- **摘要一行**：每个真实类别一个小图标加短语，按固定顺序用「·」组合，尾部才是展开箭头，整行淡灰、无卡片背景。有计数时使用计数版动词与单复数名词（`Edited 1 file` / `Read 2 files` / `Searched 1 time` / `Ran 1 command`），没有可靠目标时退回类别动词（`Read files`）；有进行中的活动时该类别用进行时（「正在读取 2 个文件」）。计数只在该类别全部记录都有目标时给出，同一文件多次编辑只计 1 个。
- **展开行**：图标 + 淡灰小字；活动区限高 `min(32vh, 260px)` 并可滚动，长目标单行省略、保留完整 `title`，不会把输入框顶出视口；**只有真正有事可做时才渲染按钮**——文件行点击 `openFile`，其余行渲染纯文本，不出现点击无响应的按钮。turnTail 的 owner 面**没有** `ChatNodeOwnerProps.inspectCall`，本实现不假设它存在、也不伪造；因此摘要里的查询/命令目前只显示简短目标，原生详情能力缺失（失败/交互类调用不进摘要、保留原生行，详情仍可从原生行进入）。不展示 JSON 或原始工具日志；读取/搜索/命令不会被说成编辑。
- **可见性（按 Turn、按节点 key）**：从公开 `ChatSnapshot.locations.getTurn(turn)` 取本回合有序 node keys，再 `nodes.get(key)` 取节点；每条规则用 `[data-chat-node-key="<真实 key>"]` 精确限定，过程组规则额外由本回合自己的 key 锚定（`:has([data-chat-node-key="…"])`），不再用裸数字 turn 选择全局节点。Turn 出现 `turn-error`/`model-retry` 时不产生任何规则。
- **入口 owner 兼容**：开发 SDK 的 `TurnTailOwnerProps.turn` 是 `TurnLocation` 对象，而当前已安装的 Chat 构建直接传 turn 数字；`ActivityTail` 按 `typeof turn === 'number' ? turn : turn.turn` 解析，非数字对象/`NaN`/负数/非整数一律渲染空、不隐藏、不报错。测试同时覆盖对象契约、当前真实数字契约与非法值。
- **两个公开入口、一次交给**：真实的 `conversation.chat.turnTail` **只在 `turn/end` 发布**，所以运行中/纯工具回合没有 tail。为此新增 `conversation.input.dock` 追加项（`ctx.slots.inject` + `register({ id: 'output-activity', order: 0, locale })`）：它读取公开 `timeline.turnOrder`、`locations.getTurn`、`nodes.get`，找到最新回合，并在该回合的真实 tail 节点出现前显示同一个摘要与同一个可见性控制器；tail 一发布，dock 在同一快照里立即让位。两者共用 `sessionId:turn` 折叠状态，所以交接时展开状态不丢、摘要始终只有一份。宿主没有声明这两个 slot 时什么都不注册、不隐藏。
- **驱动时机与唯一控制**：`TurnToolVisibility` 不渲染任何 DOM，每回合同时只有**一个**挂载点——回合未结束时在 `conversation.input.dock`，`turn/end` 发布真实 tail 后交给 `conversation.chat.turnTail`；dock 在同一快照看到 tail 节点即退出，因此任何时刻每回合只有一个订阅、一份样式表，流式期间普通工具行即被收起，不必等最终回答。宿主在该回合即使没有正文/没有助手节点，dock 依然渲染；工具成员用 selector 等值比较、工具数据走 `turnDataSource` 的稳定 source，文本 token 不会重新扫描工具结果。卸载（含 pending 交互、能力撤销、布局切换、插件卸载）时移除样式表，恢复原生行。
- **交互期间的退让**：通过公开 `GlobalStandardProps.useSessionStatus` 订阅 `snapshot.get(sessionId)?.pendingInteraction`；存在待处理交互时 dock 的摘要与控制器一起卸载（不是 `display:none`），原生工具行与交互重新可见，错误/待确认始终保留。
- **能力检查在壳里，hook 在子组件里**：`ActivityDock` 只做能力判断（`useChat`/`useSessionStatus` 是函数、文件服务可用、layout 为 cards），齐备时才挂载 `ReadyDock`；`ReadyDock` 每次无条件调用两个公开 hook。能力撤销时整个子组件卸载，hook 与隐藏规则一起消失；能力恢复时重新挂载并复用 `sessionId:turn` 折叠态，不会出现 hook 数量不一致或规则残留。
- **服务生命周期注册**：dock 用 `ctx.inject(['sidebarRight','sessions'], scoped => …)` 注册——两个公开服务齐备且具备所需方法时才注册，服务晚到即出现，任一撤销或插件卸载时随 scoped fiber 自动移除（摘要、控制器、规则一起消失），不轮询、不读 DOM、不用私有 registry。
- **文件打开**：dock 没有 `openFile` owner，改用公开 `sidebarRight.openResource` + `@deepseek-ai/dsh-util-workspace-path` 的 `fileAddressFor(sessionId, cwd, path)`；`cwd` 在**每次打开时**从 `sessions.list` 读取，service 方法在注册时取已核验引用并 bind 原 service（避免跨闭包 narrowing 丢失，receiver 保留），不手拼资源 URI。服务缺失或不具备方法时不注册 dock，原生行保留。
- **降级**：隐藏的前提是**折叠列表本身可用**——`useChat`、`locations.getTurn`、`nodes.get`、`nodes.turnDataSource` 任一缺失时签名返回 `undefined`、规则为空、不安装样式表、不显示摘要，且不抛错；纯函数 `visibilityRows`、控制器入口和摘要列表**三处**共用同一能力守卫：部分能力缺失（例如只有 `turnDataSource`、没有 `nodes.get`）时既不隐藏也不显示摘要，不会出现“原生行 + 摘要重复”，也不抛错。
- **失败与交互保留 + 真实 shell 契约**：任一调用仍在运行（待回答的问题）、`isError`、正文出现 `[killed by signal: …]`、`[exit code: null]`、**任意位置的**非零 `[exit code: N]`、`[timed out after …]`、`[stopped: …]`、`[sandbox: … denied …]`、`started background job …`、编辑无 `meta.path`/`meta.diffs` 证据、未知工具名 —— 都不进入摘要、保留原生行。**普通前台 `bash` / `pwsh` 成功时按真实工具契约不打印任何标记**，因此“已结束、非错误、无任何上述标记”即视为干净；`bash_persistent` / `pwsh_persistent` / `terminal` / `shell` 等无证据时仍是未知结构，不误报完成。
- **折叠状态**：由模块级、有界的共享存储按 `sessionId:turn` 保存（最多 64 个 key，不跨会话、不跨回合），摘要组件真正卸载/重挂载后仍保持展开；流式新增活动只追加，不自动收起。测试每个用例使用独立 session id，避免共享状态互相污染。

## 兼容边界（未达目标的部分如实标注）

- 摘要依赖 `conversation.chat.turnTail`（结束回合）与 `conversation.input.dock`（进行中回合）两个公开声明；宿主若未声明它们，本插件不注册、不隐藏，原生行保留。
- 其他插件自定义的 composer takeover 若没有公开信号，本插件无法得知输入区被占用；dock 只保证在自己的 slot 生命周期内干净卸载。
- 本候选基于公开入口实现，**尚未在真实 Host 上验收**：UI96 的“运行中纯工具回合没有摘要入口”由 dock 入口覆盖，但这是新增代码，从未在真实宿主上跑过，不能标记为已验证或 UI 已接受。R7 冻结的是 57 文件候选，之后的 dock 与测试改动仍需受限窗口重新检查。
- 该入口只能拿到 `openFile`，没有 `inspectCall`，所以从摘要里无法再打开原生工具详情；失败/交互类调用本来就不进摘要并保留原生行，详情仍可从原生行进入。
- 规则只覆盖本插件能如实表述的类别；未知工具、失败、交互一律保留原生行，因此不会出现“摘要说有、原生又说失败”的矛盾。
- 过程标题的文案由宿主决定；只有本回合全部可替代时才隐藏对应过程组（且组内不能有本插件座位）。
- 工具结果被窗口截断（`call === null`）时无法证明，保留原生行；少报不误报。
- 升级注意：删除了 `noteConcise`、`thinkingRunning/Settled/Interrupted`、`collapsedDefault`、`edits*` 系列键；新增 `activity*` 与 `row*` 键；`data-output-tools` 属性与静态分组选择器已移除。

## 建议最小验证命令（本轮未运行）

```sh
node node_modules/typescript/bin/tsc -p tsconfig.host.json
node node_modules/typescript/bin/tsc -p tsconfig.client.json
node --no-experimental-webstorage node_modules/vitest/vitest.mjs run --maxWorkers=1 \
  tests/assistant-concise.test.tsx tests/assistant.test.tsx tests/settings-view.test.tsx
# 仅在隔离副本构建；会写 lib，产生 0.1.6 之前的新字节
node scripts/build.mjs
```

真实界面仍需覆盖：思考完全不出现；纯读取/搜索回合出现摘要且原生行收起；编辑 + 读取混合摘要与计数；流式中「正在…」；展开行文件打开与原生详情；失败/终端非零/信号/未知退出/待回答问题保留原生行；两个会话各自 turn 1 不串；无活动回合无入口；切会话/换 Turn 折叠状态隔离；其他三布局回退。

## 窗口 91 独立检查结果（r5 之后，已冻结）

窗口 91 在隔离环境执行了客户端 typecheck 与测试，未执行构建：

- Client `tsc` 通过。
- 测试共 65 项：60 通过、5 失败，失败**仅**在 `tests/assistant-concise.test.tsx`；其余 4 个测试文件通过。
- 5 项失败已在本轮按真实原因修正（owner 显式 `null` 被 helper 变成 1、摘要 DOM 无视觉分隔空格、搜索范围被误做成文件按钮、缺 `nodes.get` 时摘要仍显示、READY 措辞），**尚未重跑**。
- 未执行 build；资源 scope 已关闭。

## 未运行的检查（本轮之后）

本轮新增 dock 之后没有重新运行类型检查、测试、构建、打包、Host/Electron、浏览器真实界面、安装与发布；窗口 91 结果与 R6 的 65 项组件测试/tsc/build 属于**新增 dock 之前**的快照，不能覆盖本候选，也不能视为 UI 接受。
