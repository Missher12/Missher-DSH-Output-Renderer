# Output Renderer 0.2.2

正式发布，2026-11-03。[下载与校验](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases/tag/v0.2.2)。安装包 SHA-256：`fd24c6cd2d9bc07c53e164a9bbc3ba8e465b1fe5ae51a9853bb64d854bbf8bc4`，49,708 bytes。

0.2.2 在 0.2.1 的“只留结论 + 运行中单已思考 + web_search 来源卡片”基础上，合入 9f9f882 的 Assistant 类型安全修正。双端 TypeScript 检查、11 个测试文件 130 项测试、隔离构建和 mock 分组 DOM 检查通过；构建 `lib/client.js` 93,987 bytes，SHA-256 `db33f1af…`。

0.2.1 的实际页面行为已在 DSH 0.2.1-rc.4 desktop profile 确认；0.2.2 仅做类型安全修正，未单独重做真实页面验收。实际宿主 DOM 分组细节、旧版 alpha.5/rc.2、设置保存失败根因及正式发布之外的平台均未据此宣称通过。

Git 标签固定源码，运行包单独校验；安装包与源码包用途不同，普通用户选择 `.tgz` 运行包并核对同名 `.sha256`。
