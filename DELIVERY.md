# Output Renderer 0.2.3

正式发布，2026-11-03。[下载与校验](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases/tag/v0.2.3)。安装包 SHA-256：`df2dff9cef1daf3a1e3762ef1cf7bc354f34f8946728151d857e1a4d4ce4df37`，50,580 bytes。

0.2.3 把 `web_search` 来源胶囊改为默认折叠，点击展开来源卡片；简洁对话最终答案 settle 后仍保留搜索胶囊（默认折叠），其他工具行、非最终步骤和组头继续隐藏。来源数据仍来自宿主持久化的 `meta.sources`，不新增搜索后端或 favicon 请求。

验证：双端 TypeScript 检查、11 个测试文件 131 项、隔离构建和浏览器 mock 分组 DOM 通过；构建 `lib/client.js` 94,295 bytes，SHA-256 `e7fdfeb1…`。0.2.1 的结论行为已由用户在实际页面确认；0.2.3 的搜索默认折叠和结论保留来源未单独重做真实页面验收。旧版宿主、DOM 分组细节和设置保存失败的根因未据此宣称通过。

Git 标签固定源码，运行包单独校验；普通用户选择 `.tgz` 运行包并核对同名 `.sha256`。
