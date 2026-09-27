# DSH 输出渲染

用户于 2026-09-27 授权将四种预览布局全部接入设置，并优先实现随显示刷新率更新的输出与新增文字淡入。布局为 reader/cards/timeline/split；思考全文可见，工具详情保留原生操作。

本目录是独立可卸载 Bundle，包名 @missher/dsh-output-renderer，仅此目录为本任务写入范围。权威宿主参考 /Users/missher/Documents/Deepseek- Harness-Inter，0.1.7-rc.2，已核验 HEAD e3409377ac873963595b76c0eb9afd8a8aa241af。该树的 Session Bridge/API/Workspace/module 等未提交工作属于其他任务，不修改、不构建、不覆盖。

实际日常 app 为 /Users/missher/Applications/DeepSeek Harness.app，0.1.7-rc.2；不在实现过程中改写 app.asar 或日常 profile。首先完成插件构建、离线测试、隔离 Host/profile 与真实 UI 验收，再交付安装包。核验记录写 VALIDATION.md，不将 rAF 调度等同于真实设备恒定 120/240 fps。

方案：使用公开 settings.section、configForms、conversation.chat.node 的优先级覆盖，仅替换 assistant-step 渲染，复用原生 Markdown、图片、路径与文件链接；原生工具/输入/权限不替换。CSS 以 data-dsh-output-renderer 限定，依赖此版本的数据属性，所有样式具有插件归属标记并随卸载恢复。设置独立持久化在 output-renderer 命名空间。

状态：四布局与两动效实现、13 项单元测试、实际 DSH 安装包运行时的隔离 UI 与卸载恢复均通过。日常安装被官方 CLI 的 desktop profile 专管规则拒绝；浏览器工具访问日常桌面监听地址也被阻止。未绕过入口，日常清单与安装前备份逐字节相同。需要用户从 DSH 内的“插件 → 添加插件”粘贴最终 tgz 完整路径安装。隔离预览已重新安装最终运行代码。具体交付记 DELIVERY.md。禁止打包 verification、测试适配器或任何运行数据。
