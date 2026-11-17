# Output Renderer 1.0.6

2026-11-17：修复 DSH 0.2.2-rc.3 中含工具调用的最终步骤不进入结论态的问题。Turn 关闭后按最后一个 assistant-step 与宿主 `finalNode` 回退，完成态隐藏工具、思考和其他步骤，只保留最终答复；sessionId 注入确保会话/Turn 作用域 CSS 生效。

安装包 SHA-256：`2e6bb9dd0bd9923e65748317d49a4eb5d1f343537d9276398ce7c6b34fb0db51`，55,449 bytes；运行件 `lib/client.js` SHA-256 `cd74221446ec517dd2ff8058a47eba80215663f7eb3e993da24435bee4f0bdee`，102,630 bytes。桌面 profile 已安装 1.0.6，旧 1.0.5 备份在 `~/.dsh/backups/output-renderer-1.0.5-20261117-181218`。

验证：双端 TypeScript 检查、11 个测试文件 147 项、构建通过；新增测试覆盖 `answerStep=null` 的含工具最终步骤。真实 DSH 0.2.2-rc.3 页面需重载后复核；旧布局证据和未验证边界见 [VALIDATION.md](./VALIDATION.md)。
