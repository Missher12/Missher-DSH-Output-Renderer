# Missher DSH Output Renderer · 输出外观

[English](./README.en.md) · [下载预构建包](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) · [桌面端](https://github.com/Missher12/Missher-DeepseekHarness-Desktop) · [问题反馈](https://github.com/Missher12/Missher-DSH-Output-Renderer/issues)

为 DeepSeek Harness 提供四种助手输出布局、可展开的思考内容，以及刷新率同步或新增文字淡入效果。包名为 `@missher/dsh-output-renderer`，源码版本 **0.1.5**。这是可卸载的界面插件，需要已有 DSH 宿主。

`0.1.5` 将“柔和卡片”替换为“简洁对话”：单列回答，思考默认收起，点击即可查看；流式输出及完成时保留你的展开选择，回答、图片与原生工具仍可直接访问。旧的 `layout: cards` 设置自动采用这一外观，其他布局与偏好保持原行为。状态来自实际输出阶段，不编造思考时长或摘要。

0.1.5仅修正文档中的宿主来源与发布版本元数据，两份运行文件与已验0.1.4候选逐字节一致。已推送的v0.1.4仅保留源码历史，没有正式Release；此前“官方原样RC.2”表述不准确。

本次实现通过两端类型检查、35项相关组件测试、构建及本机社区发行版 `0.2.1-rc.2` 上的实际 Web 交互检查。390px宽度下聊天没有横向溢出；设置页受宿主侧栏挤压，内容区较窄、换行较多。完整证据及旧版兼容记录见 [VALIDATION.md](./VALIDATION.md)。包的发布情况以 [Releases](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) 为准，设备安装状态需另行核对。

下面两张图片保留自0.1.3，展示设置入口和“深想简答”布局；其中“柔和卡片”现已替换。

![官方 DSH 0.2.1-alpha.5 Web 页面上的输出外观设置（隔离 profile 中的合成测试内容）](https://raw.githubusercontent.com/Missher12/Missher-DSH-Output-Renderer/v0.1.3/docs/images/output-settings-alpha5.png)

上图与下图为官方 npm DSH `0.2.1-alpha.5` 真实 Web 页面截图，内容为**隔离 profile 中的合成测试数据**，使用本地确定性适配器产生，不是日常会话、不是真实用户内容，也不是外部模型生成。

![官方 DSH 0.2.1-alpha.5 Web 页面上的完整过程与答复（隔离 profile 中的合成测试内容）](https://raw.githubusercontent.com/Missher12/Missher-DSH-Output-Renderer/v0.1.3/docs/images/output-process-alpha5.png)

## 功能

| 布局 | 呈现方式 |
| --- | --- |
| 清晰阅读 | 连续单列正文，弱化工具区域的视觉干扰 |
| 简洁对话 | 单列回答，思考默认收起，按需展开，弱化卡片边框和背景 |
| 深想简答 | 完整展示过程，末尾答复独立收尾 |
| 任务清单 | 按实际助手步骤编号，显示输出中、输出完成或已停止 |

在 **设置 → 输出外观** 选择布局、14/16 px 字号、舒适/紧凑间距和动效，修改自动保存。四张选项卡片等高排列，窄窗口自动转为单列；可用“重播输出”查看动效。

- 简洁对话默认收起思考，按需展开完整内容；其他布局沿用原来的展示方式。工具条目和纯工具组可独立展开/收起。
- 代码、表格、图片和文件操作复用宿主组件。深想简答不自动摘要或截断正文；任务清单的“输出完成”不表示工具或任务执行成功。
- 刷新率同步使用 `requestAnimationFrame`，没有固定 30/60 fps 上限；新增文字淡入只作用于新到达的文字。遵循系统“减少动态效果”，停止、结束和后台切换会清理缓冲及动画。
- 布局不改变提示词、模型参数或生成速度。实际帧率受硬件、浏览器和 Markdown 复杂度影响，不承诺持续满帧。

## 安装、启停与卸载

推荐使用 [Releases](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) 中的预构建 `.tgz`，版本以实际发布资产为准。`0.1.5` 文件名为 `missher-dsh-output-renderer-0.1.5.tgz`，校验文件为同名 `.tgz.sha256`。下列安装流程使用下载的 tgz 文件，不依赖 npm 包名解析。各设备请核对已安装版本与所下载资产。

1. 下载所需版本的 tgz 和校验文件。可运行 `shasum -a 256 -c missher-dsh-output-renderer-0.1.5.tgz.sha256` 核对下载字节。
2. 桌面版进入 **插件 → 添加插件**，填入下载文件的完整路径，安装并启用本插件。按宿主提示重新加载后，进入 **设置 → 输出外观**。
3. 在插件管理中关闭本插件的启用开关即可停用；重新打开可启用。停用后恢复宿主原生输出。
4. 在插件管理中选择本插件并点击 **卸载** 可移除。升级请优先使用当前 Missher 桌面端的“更新插件”入口，选择新版 tgz；先备份 profile 配置并保留原版本 tgz。较早宿主若没有更新入口，可按该宿主支持的替换或重新安装流程操作，并保留配置备份；缺少更新按钮不表示插件只支持新宿主。卸载后的偏好保留行为由宿主管理。

Web/自建 profile 使用目标宿主的正式 CLI，替换下面的 profile 和文件路径：

```sh
dsh plugin --profile my-web add /path/to/missher-dsh-output-renderer-0.1.5.tgz
dsh plugin --profile my-web remove @missher/dsh-output-renderer
```

桌面 `desktop` profile 由 Electron 管理，请使用桌面插件界面。安装 Release 包不需要 Node/pnpm 开发环境或本地源码；不需要额外兼容包。

## 数据与权限

插件通过宿主 ConfigForm 在 `output-renderer` 命名空间保存布局、动效、间距和字号；默认清晰阅读、新增文字淡入、舒适间距和 14 px。旧 `split`、`timeline`、`compact` 值只读映射为清晰阅读，不在读取时覆写原值。宿主快照不再携带旧 `mode` 字段时以宿主自己的 `writable` 为准；仍然携带时只有 `host` 可写，`memory` 或未知值保持只读。

插件读取已有助手内容用于显示，不创建独立会话库、不改写回复或附件，不调用模型服务，不新增遥测或 API 凭据配置。图片、文件和链接仍使用宿主的访问控制与原生操作。停用或卸载会清理本插件样式和订阅，不删除会话、附件或其他插件设置；插件偏好本身的清理由宿主决定。

## 宿主与平台范围

| 检查范围 | 证据与限制 |
| --- | --- |
| 本机社区发行版 `0.2.1-rc.2` | 0.1.4已验：折叠与键盘操作、流中展开保持、实际状态和中断、正文/图片/原生工具、设置预览/保存/刷新/失败回退、暗色窄栏、停用恢复。浏览器使用隔离的本地合成数据。 |
| 官方 npm alpha.5（`0.2.1-alpha.5`，Cordis `4.0.5` / Schemastery `3.18.5`） | 0.1.3历史证据：已通过真实 Loader 与设置；服务场景含正常保存、缺少 settings、缺少 configure；真实前端 SlotRegistry 受控生命周期；真实 Web 页面复核四布局、图片、原生放大/工具展开、保存失败回退、停止保留、36 轮历史加载、流式淡入与滚离底部；390 px 设置面板与 1280 px 词语分行均复验 |
| Missher 社区扩展 rc.2（`0.2.0-rc.2`，Cordis `4.0.4` / Schemastery `3.18.4`） | 0.1.3历史证据：已通过同一组真实 Loader/设置场景、受控插槽生命周期与真实 Web 页面复核（四布局内容一致、刷新持久化、原生图片放大、窄屏与卸载） |
| Missher 社区 alpha.2（`0.2.1-alpha.2`） | 仅完成只读静态对照；本轮未做动态复验，该配套包的聊天折叠动画与本插件强制展开思考的样式交互仍未实测 |
| 0.2.0-rc.1 | 较早版本的历史验收基线，不代表任何当前候选重新实测 |
| Windows / 当前 macOS | 本轮未测。验收在 Linux 上的独立 Host 与真实 Web 浏览器中进行，未操作原生 Electron 日常界面 |
| 其他宿主版本 | 未实测。`peerDependencies` 的放宽只是准入声明，不是全量兼容保证 |

插件依赖 `conversation.chat.node` 的 `assistant-step`、`settings.section`、原生 Markdown 与文件回调，以及聊天 DOM 标记；图片优先使用 Chat 提供的 `renderMessageImages` 闭包，其次使用宿主发布的 `conversation.images.content` Factory，两者都不存在时在正文位置显示明确提示而不是丢图。调用宿主能力前会检查 `slots.inject/register`、`locale.register/bind` 与 `configForms.get` 是否存在，缺失时给出诊断并保持原生输出可见。React、Schemastery 及 DSH 客户端模块由宿主提供；开发 SDK 链接不会进入运行包。升级宿主后需重新核验这些接口，若设置页不出现，检查插件启用状态和宿主加载错误。

完整证据见 [VALIDATION.md](./VALIDATION.md)。历史 47 项逻辑测试、较早的受控 DOM/Web 检查与本次候选的验收属于不同层级，不合并计数。本次验收使用 Linux 独立 Host 与真实 Web 浏览器，**未**操作原生 Electron 日常界面；界面内容由**本地确定性适配器**产生（非外部模型或服务端生成图片），因此准确表述是"无外部模型调用"，不是"零模型调用"；原生桌面点击、Windows/当前 macOS 与持续硬件满帧率均未据此宣称通过。

## 开发与署名

当前独立源码仓库为 [Missher-DSH-Output-Renderer](https://github.com/Missher12/Missher-DSH-Output-Renderer)。克隆已带预构建 lib；开发 SDK 通过 `node scripts/link-harness.mjs /path/to/built-harness` 显式连接已构建的 0.2.0-rc.2 源码，随后用 pnpm 11 安装锁定开发依赖。构建环境要求以该 SDK 的 Node 要求为准。开发链接 `harness-sdk`、工作区 override 和测试适配器均不进入 tgz。

执行 `pnpm typecheck`，并以 `pnpm test --maxWorkers=1` 串行运行测试。`pnpm build` 会写当前副本的 lib，因此维护时须在隔离副本构建；`pnpm pack:bundle` 只打包已准备好的 lib，并拒绝覆盖已有同名包。不要重建日常安装链接指向的目录。

本插件使用 [MIT License](./LICENSE)，包含 DeepSeek Harness 的 workspace-path 辅助代码；原版权声明与完整许可见 [NOTICE.md](./NOTICE.md) 和 [上游 MIT 原文](./licenses/deepseek-harness-MIT.txt)。反馈请附宿主/插件版本、复现步骤和脱敏错误，不提交真实会话或凭据。
