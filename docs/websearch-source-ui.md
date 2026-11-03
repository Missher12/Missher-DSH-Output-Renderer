# Web 搜索来源界面 · 设计需求（草案）

- 日期：2026-11-02
- 状态：方案 A 已实现；2026-11-03 按用户反馈改为**默认折叠**（保留卡片网格作为展开内容），0.2.3 生效
- 关联 Demo：`docs/websearch-demo.html`
- 关联插件：`@missher/dsh-output-renderer` 0.1.5

## 1. 背景与问题

用户希望 DSH 在需要使用浏览器搜索时，输出能接近 [Rare UI Web Search](https://www.rareui.com/components/websearch) 的形态：搜索胶囊、来源卡片、流式回答、回答内引用。

现状：

- 本插件只接管 `conversation.chat.node` 的 `assistant-step` 座位，负责思考/正文/图片，工具行完全不接管。
- DSH 0.2.1-rc.4 已内置 `web_search` / `web_fetch` 工具行（WebRow）：显示 “Searching the web”“Searched the web”，展开后可看结果。
- 因此现在有搜索结果，但没有“来源卡片”这种一眼可见的呈现。

## 2. 已核对的宿主事实（0.2.1-rc.4）

从本机安装包 `@deepseek-ai/dsh-client-ui-tool` / `web-toolview` 核对：

| 事实 | 内容 |
| --- | --- |
| 扩展点 | keyed 插槽 `tool.call.toolview`，按 wire 工具名分发，`scope: session` |
| 内置注册 | `web_search`、`web_fetch` 两个 key 已由宿主注册为 WebRow |
| 搜索数据 | `block.meta.sources: { url, title?, snippet?, publishedAt? }[]`、`meta.answer?: string`、`meta.truncated: boolean` |
| 调用参数 | `web_search` 参数含 `queries: string[]`；`web_fetch` 参数含 `url` |
| 状态 | 工具行按 preparing / start / result 阶段渲染，失败与中断有独立状态 |
| 历史 | 结果元数据随 transcript 持久化，回放应能恢复卡片（需实测） |

本插件现有的助手座位接管使用 `priority: -10` 覆盖原生座位。`tool.call.toolview` 是否允许同 key 的优先级覆盖，**尚未在 rc.4 实机验证**，是实现的第 1 个技术风险。

## 3. 目标与非目标

### 目标

1. 仅在内置 `web_search` 调用处，用更清晰的来源界面替代原生 WebRow。
2. 搜索中、完成、无结果、失败、中断、结果截断都有明确而克制的呈现。
3. 来源标题、域名、序号可扫读；来源可打开；窄屏不溢出。
4. 不增加搜索后端、不抓取 favicon、不改变模型提示词或生成逻辑。
5. 其他工具行、四种输出布局、现有设置与停用回退不受影响。

### 非目标

- 不覆盖自定义 MCP 搜索工具或其他供应商的搜索工具（没有这份 meta）。
- 不合并或改写 `meta.answer` 为助手回答，不伪造搜索结果。
- 不在本轮做 `web_fetch` 的正文阅读页（可后续复用同一套视觉）。
- 不做真实 favicon 网络请求；用域名首字母色块（Rare UI 自身的 fallback 也是字母）。
- 不做回答内联引用的强制注入；列在方案 C，作为后续增量。

## 4. 三个候选方案

### 方案 A · 卡片置顶（推荐）

```text
┌──────────────────────────────────────────────┐
│ 🌐 已搜索 6 个站点   [R][M][N]            ⌃  │
├──────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ React 19 │ │ Server   │ │ Next.js  │      │
│ │ 正式发布…│ │ Components│ │ 服务端…  │      │
│ │ R react 1│ │ M mdn 2  │ │ N next 3 │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│ ┌──────────┐                                 │
│ │ 还有 3 个来源 │                            │
│ └──────────┘                                 │
└──────────────────────────────────────────────┘
回答正文……（可含普通链接）
```

- 默认展开；点胶囊或右侧箭头收起。
- 3 张来源卡片 + “还有 N 个来源”入口；展开后显示全部来源。
- 最接近 Rare UI，信息密度高，适合把“查了什么”作为本轮输出的重要部分。
- 代价：每次搜索都占一块垂直空间，长对话中可能显重。

### 方案 B · 折叠胶囊

```text
┌──────────────────────────────────────────────┐
│ 🌐 已搜索 6 个站点   [R][M][N]            ⌄  │
└──────────────────────────────────────────────┘
（点开后）
┌──────────────────────────────────────────────┐
│ React 19 正式发布 — react.dev                │
│ use()、Actions 与服务器组件……                │
│ Server Components — developer.mozilla.org    │
│ …                                            │
└──────────────────────────────────────────────┘
```

- 默认收起，只保留一行胶囊；点开是竖向来源列表。
- 最不打断阅读，适合高频搜索、长对话；视觉存在感最弱。
- 代价：不展开时看不到来源，和原生行差异最小。

### 方案 C · 引用联动

- 方案 A 的来源卡片 + 回答正文中的内联引用 chip。
- chip 与卡片一一对应：悬停高亮对应卡片，点击滚动并聚焦到该来源。
- 最接近 Rare UI 的“答案与来源互相指认”体验，适合调研/报告型回答。
- 实现成本最高：需要把回答 Markdown 里的链接映射到同一次搜索的 sources，并处理无匹配、同 URL 多引用、流式输出时 chip 晚到等情况。
- 建议作为 A 之后的第二阶段，而不是首版必选。

**已选定**：首版做 A（卡片置顶）后，按用户反馈采用“A 的卡片 + B 的默认收起”：默认只显示搜索胶囊，点击展开卡片网格；首版不新增设置项，停用插件即可恢复原生 WebRow。C 留作第二阶段。

## 5. 数据映射

| 界面元素 | 数据来源 | 缺失/异常处理 |
| --- | --- | --- |
| 搜索中标签 | `block.args.queries` 拼接，首个查询优先 | 无参数时用“正在搜索网页” |
| 完成标签 | `meta.sources.length` | 0 个来源用“搜索完成，没有找到来源” |
| 来源卡片 | `meta.sources`，最多显示前 3 个 | 字段缺失时用域名/“未命名来源”兜底 |
| 域名 | `new URL(url).hostname` 去 `www.` | 非法 URL 不渲染为链接 |
| 来源图标 | 域名首字母 + 稳定色相 | 不请求外部 favicon |
| 序号 | 数组顺序 1..N | 与内联引用 chip 共用 |
| 更多入口 | `sources.length - 3` | ≤3 时不显示 |
| 回答内引用（C） | 回答 Markdown 链接 URL 与 `sources[].url` 匹配 | 无匹配保持普通链接 |
| 截断提示 | `meta.truncated` | 展开全部来源时显示“结果已截断” |
| 失败 | `block.isError` / 工具行错误摘要 | 显示短错误，不提供假重试按钮 |

## 6. 状态与交互

### 状态

- **搜索中**：胶囊标签轻微 shimmer；方案 A/C 显示 3 个骨架卡片；不逐秒播报。
- **完成**：胶囊显示“已搜索 N 个站点”+ 图标堆叠；默认折叠，点击展开卡片。
- **无结果**：不渲染空卡片网格；一行“没有找到来源”，保留查询。
- **失败**：显示“搜索失败”+ 截断后的错误原因；不自动重试。
- **中断**：工具块本身没有独立的 interrupted 阶段；若宿主保留 start 且没有 result，本组件沿用原生 running 语义，不自行判断已停止。
- **截断**：来源数后可加“结果已截断”提示；详情中显示。
- **回放**：历史消息只读展示，不重新搜索；默认折叠，展开状态按轮次记录。

### 交互

- 整个胶囊是按钮：`aria-expanded`、`aria-controls`；Enter/Space 可切换；初始 `aria-expanded=false`，body hidden。
- 来源卡片是真实链接：新标签打开，`rel="noreferrer noopener"`。
- “还有 N 个来源”展开全部，再点“收起”恢复前 3 个。
- 方案 C 的 chip：`aria-label="来源 3：developer.mozilla.org"`；悬停/聚焦高亮；点击滚动到卡片。
- 悬停只增强，不承载唯一信息；触屏与键盘都能完成同样操作。
- 长标题 3 行截断，展开列表显示完整标题；长域名省略中间；不依赖 tooltip 展示关键信息。
- 窄屏：卡片 1 列；胶囊允许换行；图标堆叠最多 4 个。
- 始终遵循 `prefers-reduced-motion`；不给来源卡片加持续动画。

## 7. 设置在设置页中的位置（待定）

如果用户希望保留紧凑/关闭选项，建议新增一个独立分组：

```text
搜索来源
Web 搜索来源            [卡片] [胶囊] [关闭]
回答内引用              [关闭] [开启]        （仅方案 C 落地时）
```

- 每组一个标题；一项设置一行，名称在左、控件在右；组间距大于组内间距（沿用现有设置页规范）。
- 默认 `卡片`；`关闭` 时不注册 `tool.call.toolview`，原生 WebRow 恢复。
- 若不做设置，则默认固定为方案 A，行为更简单，但用户无法退回原生行。

## 8. 实现设计（选定方案后）

1. **模型层** `src/client/websearch.ts`：把 `block` 归一化为 `WebSearchModel`（phase、query、sources、truncated、error）；URL 只接受 `http:` / `https:`；所有文本按纯文本处理。
2. **组件** `src/client/WebSearch.tsx`：渲染胶囊、卡片/列表、展开状态；使用本地结构 Props 类型；与现有 `Assistant.tsx` 一样不依赖新增宿主包。
3. **注册**：`ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'web_search', priority: -10, locale: NS }, WebSearchRow))`。
   - 同 key 覆盖若被宿主拒绝，**停止实现并报告**，不做 DOM 劫持/DOM 注入的降级。
   - 宿主没有该插槽时注册不会触发，原生行保持，不报错。
4. **偏好**（若做设置）：`preferences.ts` 新增 `webSearch: 'cards' | 'compact' | 'off'`，默认 `cards`；Host schema、归一化、设置页、测试同步。
5. **样式**：只使用本插件类名与 `--dsw-alias-*` 主题变量；不覆盖其他工具行；窄屏用容器查询；motion 用 CSS。
6. **文案**：`locales.ts` 中英双语；不硬编码中文。
7. **回退**：模型无法解析或 meta 形状异常时，渲染紧凑的普通行（工具名 + 状态），绝不空白。

## 9. 安全、隐私与无障碍

- 来源标题/snippet/URL 全部是外部不可信数据：按文本渲染，禁止 `dangerouslySetInnerHTML`，不执行来源内容中的任何指令。
- 仅允许 http(s) 链接；不加载远程 favicon、图片或字体，避免额外网络请求与跟踪。
- 不上报来源、查询或点击；不写入 Session 之外的位置。
- 颜色对比度沿用 DSH 主题变量；焦点可见；状态文本不只靠颜色区分。
- 骨架卡片 `aria-hidden`；状态变化用克制的 `role="status"`，避免读屏反复播报。

## 10. 验收标准

### 功能

- [ ] 运行中、完成、无结果、失败、中断、截断六种状态均有明确呈现。
- [ ] 0 / 1 / 3 / 4 / 6 个来源时布局正确；“还有 N 个”数量正确。
- [ ] 长标题、长域名、长 snippet、窄屏（390 px）不溢出、不遮挡。
- [ ] 展开/收起、全部来源展开、键盘操作、外链打开正常。
- [ ] 历史回放显示持久化来源；停用插件或选择“关闭”恢复原生 WebRow。
- [ ] 其他工具的 WebRow、四种布局与现有设置无变化。

### 质量

- [ ] 新增模型与组件测试覆盖上述状态、键盘与恶意 URL；现有测试全绿。
- [ ] 两端 typecheck、构建、包内容检查通过并留存回执。
- [ ] 在 0.2.1-rc.4 真实 Web 界面做一次运行中/完成/窄屏的实机核对。
- [ ] 若实现方案 C：引用匹配单测覆盖无匹配、重复 URL、流式晚到。

## 11. 已确定的首版边界

1. 选定 A 的卡片 + B 的默认收起；默认只显示胶囊，点击展开 3 张来源卡片 + “还有 N 个来源”，再展开显示全部。
2. 不做新设置项；插件启用即接管 `web_search`，停用即恢复原生 WebRow。
3. 只处理根调用；PTC 子调用保持通用紧凑行。`web_fetch` 继续用原生行。
4. C 的内联引用留到第二阶段，不进入首版。

## 12. Demo 交付与已验证项

Demo：`docs/websearch-demo.html`（单文件，无外部依赖，直接双击打开）。

- 可切换 A/B/C；A 默认展开 3 张卡片 + “还有 N 个来源”，展开后 6 张。
- B 默认收起，点胶囊展开竖向来源列表；再点“还有 3 个来源”展开全部。
- C 在回答内显示引用 chip；悬停/聚焦高亮对应卡片，点击展开定位。
- 支持暗/亮、宽屏/390 px 窄屏、搜索中/完成/无结果/失败、结果截断。
- 已验证：胶囊 Enter/Space 开合、键盘焦点在重渲染后回到新控件、窄屏 1 列且无横向溢出、三方案切换无控制台错误。
- 截图：`images/websearch-demo-a.png`、`images/websearch-demo-b.png`、`images/websearch-demo-c.png`。
- Demo 使用合成来源与合成回答；不代表 DSH 真实搜索结果，也不代表插件已接入宿主。

实施状态：首版 A 已实现；2026-11-03 按用户反馈把默认状态改为 B（收起），卡片网格保留；0.2.3 已实现并加入结论态保留，C 留作第二阶段。

## 13. 源码实现结果（2026-11-02）

按方案 A 完成插件源码，未安装到日常 profile、未重启 DSH：

- `src/client/websearch.ts`：纯投影，校验 `meta.sources` / `truncated` / `answer`，只把 http(s) 暴露为外链；域名、首字母色块、稳定色相均由 URL 派生。
- `src/client/WebSearch.tsx`：0.2.3 起默认折叠；点击胶囊展开 3 张卡片 + “还有 N 个来源”，展开全部、收起、焦点随控件移动；搜索中骨架、准备中、失败、空结果、截断、PTC 子调用与畸形 meta 回退。
- `src/client/index.ts`：在 `tool.call.toolview` 注册 `web_search`，`priority: -10`（内置 WebRow 为默认 0；ui-slots 规则为同 key 最低 priority 渲染），`locale: NS`。
- `src/client/locales.ts`、`src/client/styles.css`：中英文案与 DSH 主题变量样式；窄容器 1 列。
- `tests/websearch-model.test.ts`、`tests/websearch-view.test.tsx`、`tests/client-lifecycle.test.ts`：新增投影、渲染、键盘焦点、危险 URL、回退与注册生命周期覆盖。

已执行检查：

- `tsc -p tsconfig.client.json`、`tsc -p tsconfig.host.json`：通过。
- `vitest run --maxWorkers=1`：11 个测试文件、123 项通过（含原有 98 项）。
- 隔离副本 `scripts/build.mjs`：通过；`lib/client.js` 92,313 bytes，SHA-256 `7642b104…`；未改写仓库 `lib/`。
- 真实组件在隔离预览页中按 760 px / 360 px 渲染检查：4 栏、单栏、展开 6 张、截断、焦点均正常；截图 `images/websearch-implemented.png`（隔离预览，宿主主题变量为近似值）。

尚未完成：把构建产物安装到日常 profile 并在真实 0.2.1-rc.4 Web UI 中做运行中/历史回放/停用回退复核；安装与重启 DSH 需要额外操作。
