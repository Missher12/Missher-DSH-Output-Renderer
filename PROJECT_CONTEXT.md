# DSH 输出渲染

更新：2026-10-03。当前权威源码为统一仓库 `plugins/dsh-output-renderer`，候选版本 `0.1.3-rc.3`。用户从 HTML 预览中仅选择新增 A「深想简答」与 C「任务清单」；不实施其余提案。随后用户明确移除“紧凑日志”。旧 `Projects/04-Harness-Plugins/dsh-output-renderer` 只保留历史与日常安装链接，不回写。协调入口为 `/Users/missher/Documents/Deepseek-harness-Cordis/PROJECT_GOVERNANCE.md`。

本插件是独立可卸载 Bundle，包名 `@missher/dsh-output-renderer`。只负责助手输出布局、完整思考、工具区域呈现及流式动效；已有图片交由宿主 `renderMessageImages`，不接管输入附件、模型能力、上下文压缩、用量统计、会话身份、媒体采集或持久学习。四种单列布局 reader/cards/process/checklist，间距 comfortable/tight、字号 standard/large 与 smooth/fade 独立选择，设置继续使用 `output-renderer` 命名空间，旧 split、timeline、compact 均映射 reader，读取不改写用户数据。

process 保留全文，以过程线与末尾正文分隔体现层次，不修改模型提示词或摘要正文。checklist 使用 assistant-step 的实际 step/status；输出完成不等于工具执行成功。原生工具状态、详情和事件处理由宿主继续拥有。

通过公开 `conversation.chat.node` 的 assistant-step 和 `settings.section` 插槽注册。原生工具/文件/图片操作保留；完整思考例外要求展开含思考的过程容器并移除其折叠入口，纯工具组及工具条目仍独立折叠。全局样式受插件根属性约束，卸载清理样式与订阅，并保护其他拥有者后来写入的属性。聊天数据属性已在 0.2.0-rc.1 的实际 Web UI 核验，后续升级仍需重新确认。

构建必须显式使用本插件的 Host/Client tsconfig，不能隐式继承统一仓库根 paths；独立包保留宿主提供的 Cordis/Schemastery，不新增兼容包。本轮修改输出布局、原生按钮设置页和局部字号/间距；思考全文与工具、附件操作保持。

只写本插件目录与专属回执。本轮隔离候选在 `verification/audit-20261003/`，SDK 与宿主只读。构建使用本插件忽略目录下的隔离候选；不编辑共享宿主、根 package/lockfile、其他插件、生产 profile，不更新或重启日常 app，不 commit/push/tag/release。候选由协调者统一审核安装。

本轮整理设置页两列排版与保存状态位置，修复纯思考停止提示、无思考清单收尾跳位、不可用设置持续加载和后台淡入清理；历史/淡入/减少动态模式跳过不需要的字符分段。当前验证状态见 VALIDATION.md；上一轮适配结果保留在其中的日期章节。浏览器操作不是原生 Electron 点击；真实供应商和硬件帧率未验证。详见 VALIDATION.md；包路径和 SHA-256 见 DELIVERY.md。历史记录不得冒充本轮或日常安装证据，测试适配器和运行数据不得入包。
