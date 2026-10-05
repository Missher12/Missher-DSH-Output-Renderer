# Missher DSH Output Renderer · 输出外观

[English](./README.en.md) · [下载预构建包](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) · [桌面端](https://github.com/Missher12/Missher-DeepseekHarness-Desktop) · [问题反馈](https://github.com/Missher12/Missher-DSH-Output-Renderer/issues)

为 DeepSeek Harness 提供四种助手输出布局、完整思考展示，以及刷新率同步或新增文字淡入效果。包名为 `@missher/dsh-output-renderer`，本次发行候选版本 **0.1.3-rc.4**。这是可卸载的界面插件，需要已有 DSH 宿主。

rc.4 补齐公开发行的中英文说明、上游许可证和打包检查；运行代码与已验收的 rc.3 完全一致。

## 功能

| 布局 | 呈现方式 |
| --- | --- |
| 清晰阅读 | 连续单列正文，弱化工具区域的视觉干扰 |
| 柔和卡片 | 思考和正文用柔和背景分组 |
| 深想简答 | 完整展示过程，末尾答复独立收尾 |
| 任务清单 | 按实际助手步骤编号，显示输出中、输出完成或已停止 |

在 **设置 → 输出外观** 选择布局、14/16 px 字号、舒适/紧凑间距和动效，修改自动保存。四张选项卡片等高排列，窄窗口自动转为单列；可用“重播输出”查看动效。

- 思考全文保持展开。含思考的过程组不再折叠，工具条目和纯工具组仍可独立展开/收起。
- 代码、表格、图片和文件操作复用宿主组件。深想简答不自动摘要或截断正文；任务清单的“输出完成”不表示工具或任务执行成功。
- 刷新率同步使用 `requestAnimationFrame`，没有固定 30/60 fps 上限；新增文字淡入只作用于新到达的文字。遵循系统“减少动态效果”，停止、结束和后台切换会清理缓冲及动画。
- 布局不改变提示词、模型参数或生成速度。实际帧率受硬件、浏览器和 Markdown 复杂度影响，不承诺持续满帧。

## 安装、启停与卸载

推荐使用 [Releases](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) 中的预构建 `.tgz`，版本以实际发布资产为准。rc.4 文件名为 `missher-dsh-output-renderer-0.1.3-rc.4.tgz`，校验文件为同名 `.tgz.sha256`。下列安装流程使用下载的 tgz 文件，不依赖 npm 包名解析。

1. 下载所需版本的 tgz 和校验文件。可运行 `shasum -a 256 -c missher-dsh-output-renderer-0.1.3-rc.4.tgz.sha256` 核对下载字节。
2. 桌面版进入 **插件 → 添加插件**，填入下载文件的完整路径，安装并启用本插件。按宿主提示重新加载后，进入 **设置 → 输出外观**。
3. 在插件管理中关闭本插件的启用开关即可停用；重新打开可启用。停用后恢复宿主原生输出。
4. 在插件管理中选择本插件并点击 **卸载** 可移除。0.2.0-rc.2 升级已有包时可能要求先卸载再安装；先备份当前 profile 配置，并保留原版本 tgz。重装后的偏好保留行为由宿主管理，不保证卸载后仍保留。

Web/自建 profile 使用目标宿主的正式 CLI，替换下面的 profile 和文件路径：

```sh
dsh plugin --profile my-web add /path/to/missher-dsh-output-renderer-0.1.3-rc.4.tgz
dsh plugin --profile my-web remove @missher/dsh-output-renderer
```

桌面 `desktop` profile 由 Electron 管理，请使用桌面插件界面。安装 Release 包不需要 Node/pnpm 开发环境或本地源码；不需要额外兼容包。

## 数据与权限

插件通过宿主 ConfigForm 在 `output-renderer` 命名空间保存布局、动效、间距和字号；默认清晰阅读、新增文字淡入、舒适间距和 14 px。旧 `split`、`timeline`、`compact` 值只读映射为清晰阅读，不在读取时覆写原值。

插件读取已有助手内容用于显示，不创建独立会话库、不改写回复或附件，不调用模型服务，不新增遥测或 API 凭据配置。图片、文件和链接仍使用宿主的访问控制与原生操作。停用或卸载会清理本插件样式和订阅，不删除会话、附件或其他插件设置；插件偏好本身的清理由宿主决定。

## 宿主与平台范围

| 检查范围 | 证据与限制 |
| --- | --- |
| macOS Intel，DSH 0.2.0-rc.2 | rc.4 已完成应用正式 CLI 全新隔离安装、配置合成和 Host 启动，运行文件与 rc.3 一致；设置保存、合成流、工具/文件操作、停止及历史重载沿用 rc.3 的历史 Web 验收 |
| 0.2.0-rc.1 | 较早版本的历史验收基线，不代表 rc.4 本轮重新实测 |
| 官方 rc.2 接口 | 静态对照上游 `dsh-v0.2.0-rc.2`：所用公开插槽、ConfigForm、助手属性及聊天 DOM 标记存在；没有发现必须依赖 Missher 专属接口的代码。纯官方发行版的运行验收未单独完成 |
| Windows / Linux | 本插件未完成平台运行验收；桌面应用发布这些平台不等于插件已验收 |
| 其他宿主版本 | 未实测，包括 0.2.1-alpha.1。宽松版本准入不是兼容性保证 |

插件依赖 `conversation.chat.node` 的 `assistant-step`、`settings.section`、原生 Markdown/图片/文件回调和 rc.2 聊天 DOM 标记。React、Schemastery 及 DSH 客户端模块由宿主提供；开发 SDK 链接不会进入运行包。升级宿主后需重新核验这些接口，若设置页不出现，检查插件启用状态和宿主加载错误。

完整证据见 [VALIDATION.md](./VALIDATION.md)。41 项逻辑测试、7 组受控 DOM 和历史 Web 检查属于不同层级；原生 Electron 点击、真实模型/图片端到端、完整本轮 Loader RPC 清单和持续硬件帧率未据此宣称通过。

## 开发与署名

当前独立源码仓库为 [Missher-DSH-Output-Renderer](https://github.com/Missher12/Missher-DSH-Output-Renderer)。克隆已带预构建 lib；开发 SDK 通过 `node scripts/link-harness.mjs /path/to/built-harness` 显式连接已构建的 0.2.0-rc.2 源码，随后用 pnpm 11 安装锁定开发依赖。构建环境要求以该 SDK 的 Node 要求为准。开发链接 `harness-sdk`、工作区 override 和测试适配器均不进入 tgz。

执行 `pnpm typecheck`，并以 `pnpm test --maxWorkers=1` 串行运行测试。`pnpm build` 会写当前副本的 lib，因此维护时须在隔离副本构建；`pnpm pack:bundle` 只打包已准备好的 lib，并拒绝覆盖已有同名包。不要重建日常安装链接指向的目录。

本插件使用 [MIT License](./LICENSE)，包含 DeepSeek Harness 的 workspace-path 辅助代码；原版权声明与完整许可见 [NOTICE.md](./NOTICE.md) 和 [上游 MIT 原文](./licenses/deepseek-harness-MIT.txt)。反馈请附宿主/插件版本、复现步骤和脱敏错误，不提交真实会话或凭据。
