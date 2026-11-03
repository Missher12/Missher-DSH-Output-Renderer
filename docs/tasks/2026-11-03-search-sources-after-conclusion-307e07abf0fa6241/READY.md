[project-ops-ready-v1]: <data:application/json;base64,eyJwbGFuSGFzaCI6IjEzZjVhMjEzOGNkZTk5MDEwYTQ4ZWFiOGRiOWIyZjYyZGNmMjJhZDQ2ZWZhMGRmOThiZDM1NGU1NmU1NDU5ZmMiLCJyZXBvcnRIYXNoIjoiZTVjYWM1YjE3YWEyM2I3MmM0NDEyZTJmMGQ5NzgxNDRjMWI4NWYwMGJjMmIyMDk2MThkN2IzMTA2M2JiOTljYiIsInZlcmlmaWNhdGlvbiI6IuacqumqjOivge+8muacquaPkOS+m+WPr+aguOmqjOeahOWOn+eUnyBQcm9qZWN0IE9wcyDlm57miafvvJvpqozmlLbmloflrZfku4XkuLrkvJror53miqXlkYrjgIIiLCJib2R5SGFzaCI6IjgxZjU4ZGMwZWVjY2U5NmJmZTk0YWI0MGM0ZjM1YzFhNTYwMTY3Mjc2NTJmNWFmMDgzYzhlNzA4NzE2MDI3OTUifQ==>

# Project Ops · 0.2.3 搜索默认折叠并在结论保留来源 · 交付记录

任务：2026-11-03-search-sources-after-conclusion-307e07abf0fa6241
会话：session-d27bd610-9f29-4727-a309-ce15b00ce6a7
关联方案修订：1
[查看方案](./PLAN.md)

本记录由当前开发会话显式提交；不是回复结束或命令退出自动判定。验收文字为会话报告，原生回执验证另列。文档生成不代表已发布、已安装或所有平台已通过。

## 实现

0.2.3 将 WebSearchRow 的初始 open 从 true 改为 false，保留来源数据和展开逻辑；结论模式在隐藏所有 tool-call 后增加例外，仅显示包含 .dsh-output-websearch 的 tool-call，普通工具、非最终步骤和组头继续隐藏。搜索胶囊在结论态默认折叠，点击展开来源卡片。

## 验收报告

- 搜索胶囊初始为折叠态（aria-expanded=false，body hidden），点击后展开来源网格，再点收起：reported-pass
  证据：WebSearchRow open 初始 false；jsdom 测试验证初始 aria-expanded=false/body hidden，点击展开 3 张卡片和更多来源，再点收起
- 简洁对话最终答复 settle 后仍显示当组的 web_search 搜索胶囊，点击可展开来源；其他工具行、非最终 assistant-step 和组头仍隐藏：reported-pass
  证据：CSS 在隐藏 tool-call 后增加 :has(.dsh-output-websearch) 例外；Chrome 无头 mock 分组 DOM 验证 web_search 行 block、普通工具 none、非最终步骤 none、组头 none、最终答复 block；静态胶囊 aria-expanded=false
- 其他布局、非 web_search 工具行、PTC 子调用/无 toolview 宿主保持原行为：reported-pass
  证据：CSS 例外仅限 cards 且 :has(.dsh-output-websearch)，未改其他布局或 toolview 注册；现有回退测试 131 项通过
- 组件测试、双端 typecheck、构建和浏览器分组 DOM 检查通过；0.2.3 打包安装：reported-pass
  证据：vitest 11 files/131 tests passed；tsc client/host exit 0；构建 lib/client.js 94,295 bytes e7fdfeb1...；tgz 50,580 bytes sha df2dff9c...；desktop 0.2.3 安装后 client 哈希 e7fdfeb1...
- Git 提交/标签/Release 0.2.3 可下载，文档记录验证边界：reported-pass
  证据：commit 87d61c9，tag v0.2.3 pushed；GitHub Release id 432583388，assets id 705293305/705293457；公共 URL 下载 tgz SHA-256 匹配 df2dff9c...

## 原生回执验证

未验证：未提供可核验的原生 Project Ops 回执；验收文字仅为会话报告。

## 产物

- src/client/WebSearch.tsx
- src/client/styles.css
- tests/websearch-view.test.tsx
- lib/client.js
- docs/conclusion-mode.md
- docs/websearch-source-ui.md
- README.md
- VALIDATION.md
- DELIVERY.md
- GIT_DELIVERY.json

## Git

87d61c9 release: 0.2.3; tag v0.2.3; pushed main and tag to origin

## 发布

GitHub Release v0.2.3 created (HTTP 201), tgz and sha256 uploaded; public tgz re-download SHA-256 matches df2dff9c..., size 50,580 bytes. A later release-metadata API check timed out; upload responses and public download are the evidence.

## 安装

desktop profile 已从 0.2.2 升到 0.2.3；安装后 client 哈希 e7fdfeb1...；旧 0.2.2 备份在 ~/.dsh/backups/output-renderer-0.2.2-20261103-190212。宿主进程未重启。

## 未完成项与限制

- 0.2.3 的搜索默认折叠与结论保留来源未在真实 DSH 页面单独复测；0.2.1 的结论行为已由用户确认。
- Chrome mock 使用静态 DOM，点击行为由 jsdom 覆盖，不等同于真实宿主分组结构。
- 旧版 alpha.5/rc.2 未用 0.2.3 复测；不能声称任何 DSH 通过。
- 设置保存失败曾在 rc.4 出现一次，根因未定位。

## 使用与回退

安装旧包 ~/.dsh/plugin-packages/or-0.2.2.tgz，或从 ~/.dsh/backups/output-renderer-0.2.2-20261103-190212 恢复；删除 Release/tag 需另行授权。
