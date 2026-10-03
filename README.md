# DSH 输出外观

自家插件不再限制 DSH 宿主版本号；运行时按实际接口能力工作。开发依赖版本用于复现构建，不是安装门槛。既有验证基线为 0.2.0-rc.1 与 0.2.0-rc.2；本轮使用 0.2.0-rc.2，其他版本尚未验证。

独立、可卸载的 DeepSeek Harness Bundle。适配 **DSH 0.2.0-rc.1 / 0.2.0-rc.2**。

安装后进入 **设置 → 输出外观**，四款布局以两列排列，窄窗口自动改为单列。布局和动效可以独立选择并自动保存，保存状态显示在标题旁。

| 布局 | 效果 |
| --- | --- |
| 清晰阅读 | 连续排版，弱化过程的视觉干扰 |
| 柔和卡片 | 思考和正文以柔和背景分组，保持单列 |
| 深想简答 | 完整展开过程，正文以清晰的分隔独立收尾 |
| 任务清单 | 按会话中的实际步骤编号，显示输出中、输出完成或已停止 |

- **阅读选项**：内容间距可选舒适或紧凑，正文可选 14 px 或 16 px；只调整助手输出与设置预览。
- **刷新率同步**：用 `requestAnimationFrame` 消化收到的文本，按显示帧更新，无固定 30/60 fps 上限；停止或结束立即显示已收到的完整文字。
- **新增文字淡入**：仅新文字使用 200 ms 淡入，旧内容保持稳定；重播按钮可直接试效果。
- 思考全文始终可见；工具详情继续独立展开。代码、表格、图片、文件链接复用 DSH 原生组件。
- 深想简答保留模型回复全文，不自动摘要或截短；回答长度由模型实际输出决定。任务清单显示模型步骤的输出状态，工具的成功或失败仍由原生记录显示。
- 遵循系统“减少动态效果”，页面进入后台时显示已收全文并清理淡入遮罩；回到前台后只对新文字淡入。已完成回复和淡入模式省略不需要的字符分段。
- 四款均显示中断状态。任务清单的步骤标题在回复完成后保持位置；连接不可保存设置时显示不可用状态。

刷新率同步改善显示节奏，不提高模型生成速度。实际帧率仍取决于屏幕、浏览器负载、Markdown 复杂度和宿主数据更新；没有恒定硬件 120/240 fps 的保证。

## 职责边界

仅负责助手输出布局、思考与工具区域的呈现、流式动效及本插件设置。已有输出图片交给宿主原生回调；图片上传与限额、输入引用、模型能力配置、上下文数据及使用统计由各自组件负责。

思考全文始终显示，因此会展开含思考的过程容器并移除其折叠入口；纯工具组与工具条目的详情操作仍由宿主提供。此行为是已有产品要求，不能因职责划分恢复思考折叠。

旧 `split`、`timeline`、`compact` 配置均显示为清晰阅读；读取时不改写保存值。设置提供四种单列风格，布局、间距、字号和动效独立保存。

## 安装与移除

公共流程、独立测试 profile 和常见错误见[安装指南](https://github.com/Missher12/Missher-DSH-Inter/blob/main/docs/cookbook/install-cordis-plugins.zh.md)。

桌面版：进入 **插件 → 添加插件**，在“包名或地址”中粘贴本地 `missher-dsh-output-renderer-0.1.3-rc.3.tgz` 的完整路径，然后点“安装”。安装后进入 **设置 → 输出外观**。桌面版的 `desktop` profile 由 Electron 专管，不能通过 CLI 安装。

Web 或自建 profile 也可以用目标 DSH 的官方 CLI：

```sh
dsh plugin --profile <目标配置名称> add /完整路径/missher-dsh-output-renderer-0.1.3-rc.3.tgz
dsh plugin --profile <目标配置名称> remove @missher/dsh-output-renderer
```

使用独立命名空间 `output-renderer` 保存设置，默认“清晰阅读 + 新增文字淡入”。移除后恢复原生渲染，不删除会话、附件或其他插件设置。

这是针对 0.2.0-rc.1 / 0.2.0-rc.2 的实现，升级宿主前应重新验证聊天布局的数据属性与公开插槽。包不携带测试模型、API 凭据或运行数据。

## 开发

本目录在统一仓库中通过 `pnpm-workspace.yaml` 使用同仓库 SDK。按[开发指南](https://github.com/Missher12/Missher-DSH-Inter/blob/main/docs/cookbook/build-cordis-plugins.zh.md)先构建宿主，再完成本插件依赖安装、类型检查、构建、测试和打包。不要把原独立目录的运行链接当作新源码入口。

`scripts/launch-isolated.mjs` 使用本目录下的隔离 HOME/DSH_HOME；需设置 `DSH_SOURCE_DIR`。可通过 `DSH_OUTPUT_TEST_FIXTURE=1` 启用仅本地的合成流验证。该测试入口和测试适配器不进入安装包。

验证范围与限制见 [VALIDATION.md](./VALIDATION.md)。

## 独立源码开发

运行包已包含 lib，使用时不需要开发环境。修改源码需 Node 和本仓库 packageManager 指定的 pnpm；先运行 `node scripts/link-harness.mjs /绝对路径/已构建的Missher-DSH-Inter`，再执行 `pnpm install --frozen-lockfile`，随后使用 package.json 中的 typecheck、build 和 test。SDK 链接只写本插件开发目录；harness-sdk 不提交、不进入安装包。
