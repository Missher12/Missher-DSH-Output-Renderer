# READY · 简洁对话 / 折叠思考（0.1.4 源码候选，未验证）

状态：**源码候选，未构建、未测试、未打包、未发布、未安装**。本文件不是验收记录。
任务：根会话要求移除「柔和卡片」，改为类似 Codex 的默认收起思考、简洁单列。
版本：**0.1.4**（`package.json` 已提升；不覆盖已发布的 `0.1.3`；`lib/` 与 `dist/` 仍是 `0.1.3` 的运行字节）。
作者：唯一实现者 `session-69652ff8-3ee3-476c-8b53-a743418796c1`（`deepseek-official / deepseek-flash / max`）。
cwd：`/home/missher/Projects/DSH-Recovery-20261012/Missher-DSH-Output-Renderer`，基线 HEAD `161ddeb5b4756a3504650ee9c91c959cfe3a8eea`。

## 修改文件（仅授权范围）

| 文件 | 变更 |
| --- | --- |
| `package.json` | 版本 `0.1.3` → `0.1.4`；peer 范围、devDependencies、`files` 白名单、lockfile 均未改 |
| `src/client/Thinking.tsx` | 新增。共享折叠组件 `ThinkingDisclosure` 与状态钩子 `useThinkingOpen`，实际座位与设置预览共用 |
| `src/client/Assistant.tsx` | cards 改用折叠层；新增 `reasoningLast` / `reasoningActive` 与单一中断归属推导；其余布局、图片/工具、流式逻辑不变 |
| `src/client/Settings.tsx` | 预览改用同一折叠组件；思考提示与标签按布局切换；预览标题标注「示例内容」；简洁预览使用 `noteConcise` |
| `src/client/styles.css` | 新增折叠行/箭头/焦点/隐藏守卫；删除 cards 卡片底纹、阴影、重复答复标签与旧缩略图；改为简洁示意 |
| `src/client/locales.ts` | `cards` →「简洁对话」；新增 `thinkingRunning/Settled/Interrupted`、`thinkingHintConcise`、`collapsedDefault`、`previewSample`、`noteConcise` |
| `tests/assistant-concise.test.tsx` | 新增草稿。默认折叠、aria 关联、展开/收起、流式与状态变化保持、身份隔离、正文/图片不在折叠层、无 reasoning 无入口、其余布局不折叠、思考阶段与中断归属 |
| `tests/assistant.test.tsx` | 调整 reasoning-only 中断用例：按布局断言唯一提示（cards 由折叠行承载，其余仍是 stopped） |
| `tests/settings-view.test.tsx` | 新增：cards 预览共用折叠控件、标注示例、`noteConcise` 取代 `note`、不声称进行中；其余布局仍完整展开 |
| `README.md` / `README.en.md` | 布局名与思考说明改为简洁对话语义；版本分为已发布 `0.1.3` 与未验证 `0.1.4`；截图与验收表明确仍属 `0.1.3` |
| `VALIDATION.md` | 新增「2026-10-22 · 0.1.4 简洁对话源码候选（未验证）」，并声明旧节属 `0.1.3` |
| `PROJECT_CONTEXT.md` | 增补 0.1.4 未验证源码候选状态 |

未改：`src/index.ts`、`src/preferences.ts`、`src/client/index.ts`、`src/client/settings.ts`、`src/client/stream.tsx`、`lib/`、`dist/`、`docs/images/`、`pnpm-lock.yaml`、其他插件、Host/日常 profile、Git/Release。

## 设计选择

1. **持久化值不变**：`cards` 仍是内部与存储值，只改显示名与呈现；旧 `layout: cards` 直接得到新样式，无迁移、无 key 改名。其余三布局、字号/间距/动效、保存控制器与兼容桥未动。
2. **一份折叠实现**：`useThinkingOpen` + `ThinkingDisclosure` 由实际座位与设置预览共用；未使用宿主 `useDisclosure`（它随原生过程行收起而重置，而本插件强制展开原生过程）。
3. **状态按身份隔离**：key 为 `sessionId:turn:step`。文本增量、块数量、`running→settled/interrupted` 都不改变选择；换会话或换步骤回到默认收起。历史节点首次渲染即为收起。
4. **正文常驻挂载**：只切换 `hidden`，不卸载正文，重新展开不会从头假流式或重复淡入；CSS 用 `.dsh-output-assistant .dsh-output-thinking-body[hidden] { display: none !important; }` 保证不被宿主/全局 `display` 规则覆盖。折叠层只包 reasoning，回答、图片与原生工具节点均为兄弟节点。
5. **思考阶段按实际 block 推导**：`reasoningLast = 最后一个实际 block 是 reasoning`，`reasoningActive = running && reasoningLast`。步骤已生成正文或调用工具时思考行显示「已思考」；只有 reasoning 仍是增长中的最后块才显示「正在思考」。「已思考」不表示步骤或任务成功。
6. **单一中断归属（按阶段，不按 hasResponse）**：`rowOwnsStop = cards && 有非空 reasoning && interrupted && reasoningLast`。行仅在思考确实停在中断点时显示「思考中断」并抑制 stopped；停在工具调用或空文本块时思考已结束，行保持「已思考」，提示回到座位职责：reasoning 座位只在它是唯一内容座位时承担，response 座位在 reasoning 座位不承担时承担，未拆分座位始终承担。非 cards 布局的 `interrupted` 表达式逐字未变。
7. **视觉**：删除 cards 的整块卡片底纹/边框/阴影、重复「回复」标签与 group 卡片规则；保留宿主字体/颜色/字号变量与用户字号、间距选择。折叠行紧凑灰字小箭头，原生 `button` 提供键盘与焦点行为，`aria-expanded`/`aria-controls` 关联正文；`prefers-reduced-motion` 下关闭箭头过渡。设置缩略图改为「一行状态 + 两行正文」示意。
8. **文案按布局区分**：cards 显示「默认收起 + 展开可查看完整思考」，其他布局保持「全文显示 / 始终展开」。预览标题追加「示例内容」；简洁预览折叠体使用 `noteConcise`（示例思考，展开后显示完整过程），不再复用「思考全文显示」的 `note`；其他布局保留 `note`。无虚构时长或摘要。

## 静态自查发现

- 语言词典 en/zh 键集合一致（各 58 键，`Record<keyof typeof en, string>` 约束未破）；新增 7 个键在两个词典中各出现两次。
- `styles.css` 花括号配平（128/128，共 153 行）；cards 专属规则只剩设置缩略图五条，正文不再有 `[data-output-layout="cards"]` 规则。
- 未新增 `overflow: hidden`；折叠隐藏是属性 + 明确 `display:none`，不裁剪正文。
- `Assistant` 公共 Props 未改（仍是 `ChatProps & { renderFactorySlot?: unknown }`），未引入新的槽位注册类型收窄。
- Hook 调用顺序不变且无条件；`reasoningLast`/`reasoningActive` 为普通常量，`rowOwnsStop`/`seatOwnsStop`/`thinkingStatus` 在早退之前计算，无新增 hook。
- 已按 rc.2 类型确认 `conversation.chat.node` 为 `scope: 'session'`，`sessionId` 来自 `SessionStandardProps`。
- 折叠层内部保留 `.dsh-output-reasoning` 作为哨兵，原生过程强制展开规则仍匹配；折叠只作用于本插件自己的 body，宿主节点规则未被放宽或删除。
- 逐案推演中断归属：`[reasoning]` → 行承担、0 个 stopped；`[reasoning, tool-call]` / `[reasoning, text:'']` → 行显示已思考、1 个 stopped；`[text, reasoning]` → 行显示思考中断、0 个 stopped；`[text]` / `[]` → 每个座位组合都恰好 1 个 stopped。
- 版本断言：仓库内没有测试或脚本硬编码 `0.1.3`；`GIT_DELIVERY.json` 是 `0.1.3` 的发布记录，本轮未改。

## 未验证与风险

- **未运行** typecheck / test / build / pack / 依赖安装 / Host / Electron / 浏览器 / 外部模型；以上均为静态推断。
- 新增的 `Thinking.tsx` 与新测试从未编译或执行；`tests/*.tsx` 本身也不进入两个 tsconfig。
- 真实 UI 待确认：折叠层与宿主原生过程强制展开规则并存时是否出现重复思考正文；宿主折叠动画（inline `height/opacity/overflow`）与本折叠层的交互；真实主题下焦点可见性；390 px 窄栏换行；设置预览展开/收起与重播、切换布局后的状态保持。
- `reasoning-only` 中断提示的落点取决于宿主是否渲染 reasoning 座位；需在真实宿主确认座位拆分方式。
- 当前 `lib/` 与 `package.json` 版本不一致（0.1.3 字节 / 0.1.4 声明），这是有意保留：不得为了表面一致而构建或打包。

## 最小后续验证命令（本轮未执行）

```sh
# 依赖已就绪时可直接运行；如需重装，用随项目记录的 pnpm 11.7.0 与项目内 store
node node_modules/typescript/bin/tsc -p tsconfig.host.json
node node_modules/typescript/bin/tsc -p tsconfig.client.json
node --no-experimental-webstorage node_modules/vitest/vitest.mjs run --maxWorkers=1 \
  tests/assistant-concise.test.tsx tests/assistant.test.tsx tests/settings-view.test.tsx
# 仅在隔离副本构建；会写 lib，产生 0.1.4 字节
node scripts/build.mjs
```

真实页面验收需要独立隔离 profile，覆盖：cards 默认收起/展开/键盘、流式中思考行阶段、`[reasoning, tool-call]` 与 `[text, reasoning]` 两种中断边界、无 reasoning 回合、工具与图片可达、设置预览一致、窄栏换行、停用卸载后的原生恢复。

## 窗口 73 独立验证（r1）与 r2 测试预期修正

窗口 `render-concise-targeted-20261022-73` 由 Codex 独立执行，状态 `failed_stop_no_rerun`，r1 已冻结保全，原业务源码未变：

- Host 类型检查 exit 0；Client 类型检查 exit 0。
- 三个受影响测试文件共 35 项：33 通过、2 失败，失败仅为 `tests/settings-view.test.tsx:86` 的新断言（`process` 与 `checklist` 两个参数用例）。
- 失败原因：断言统一要求 `zh.note`（“思考全文显示…”），但 process/checklist 的预览实际渲染 `zh.processNote` 与 `zh.verificationNote`。这是测试预期错误，不是产品缺陷。
- 首次 build 未执行。

r2 只修正该两处测试预期：reader 断言 `zh.note`；process/checklist 分别断言 `zh.processNote` 与 `zh.verificationNote`，并补 `not.toContain(zh.note)` 证明没有落回 reader 文案；`无折叠控件`、`thinkingHint`、`alwaysOpen` 等原有断言保留。**r2 尚未重跑**；后续窗口只跑 `tests/settings-view.test.tsx` 然后首次 build，两侧类型检查与另两份已通过测试复用。旧失败证据保留在窗口 73 的日志与 `OUTCOME.json`，未删除或改写。

## 边界声明

未提交 Git、未打包、未安装、未发布、未重新生成 `lib/` 或截图、未修改日常 profile、未改动其他插件或 Host、未调用外部模型。根已确认 public main 与 v0.1.3 存在、无 v0.1.4。任务止于本源码候选，等待根另行安排针对性验证窗口。
