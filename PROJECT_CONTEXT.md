# DSH 输出渲染

更新：2026-10-05，MARKET-20261005。当前唯一维护入口是独立仓库 `Missher12/Missher-DSH-Output-Renderer`。旧统一仓库 plugins 子目录已退出维护，不回写或重新创建副本。包名保持 `@missher/dsh-output-renderer`；本轮准备 `0.1.3-rc.4`，只修订包装、许可证、元数据和中英文说明，rc.4 的固定提交与运行包保持已验收 rc.3 的运行字节；用户另行要求的 UI 复核与排版修订作为 rc.5 独立候选，不纳入 rc.4。

本插件只负责助手输出布局、完整思考、工具区域呈现、流式动效和本插件设置。不接管输入附件、模型能力、上下文、统计、会话身份或持久学习。四款布局 reader/cards/process/checklist 保持，旧 split/timeline/compact 只读映射 reader；密度、字号和 smooth/fade 独立选择，配置继续使用 output-renderer 命名空间。

process 保留模型完整回复，不摘要或截短。checklist 使用实际 assistant step/status，输出完成不等于工具或任务成功。公开扩展点为 conversation.chat.node/assistant-step 和 settings.section，原生 Markdown、文件和图片回调仍由宿主提供。完整思考展开含思考的过程组，工具条目和纯工具组仍独立折叠。CSS 使用版本相关的聊天 DOM 标记。

静态对照上游 dsh-v0.2.0-rc.2 的所需接口和 DOM 标记，未发现必须依赖 Missher 专属接口；不将此对照当作纯官方发行版的运行验收。运行验证基线是 macOS Intel 上实际 0.2.0-rc.2 应用 CLI/隔离 Web 与本地合成流。Windows、Linux、真实模型/图片端到端、原生 Electron 点击和持续硬件帧率仍按 VALIDATION.md 分层说明。保持宽松宿主准入，未实测版本不作兼容承诺，不升级至 alpha.1。

开发使用显式的 harness-sdk 链接与本插件 Host/Client tsconfig。SDK/宿主源码只读；任何构建在独立副本输出，不覆盖日常链接的 lib 或既有包。测试并发最多 1。本轮可沿用冻结验收并核对运行字节，无须为文档和打包修订重跑全部 UI/逻辑测试。

本会话只写独立源码及自己的协调回执，可提交/推送本仓库。Release、市场目录 PR、共享宿主与日常安装由协调者单写。上架计划为协调目录 coordination/2026-10-05/marketplace/PLAN.md，交接为同目录 render.md / render.json。不改其他插件、共享索引、用户 profile、会话或数据，不新增兼容包。

包必须携带中英文 README、原 MIT 许可证及 DeepSeek 上游署名；运行入口不依赖本机路径或开发 SDK。当前精确交付和历史记录见 DELIVERY.md / VALIDATION.md。历史“未发布/未安装”只代表当时状态，不覆盖后续协调安装回执。
