[project-ops-ready-v1]: <data:application/json;base64,eyJwbGFuSGFzaCI6IjdlYTg4MjM4MTgwOTg3M2FiNDRlNDVhZjQ0ZmE3ZDg3ZDE1YmNhZjc4ZmYzZGUzMmI2NTYyOTNiZGY1YTNiZWYiLCJyZXBvcnRIYXNoIjoiYzFhNGM5OGRmMjc2MmFiNTE3NTdhMDJlNTM5MzU1ZjJmZDlhMzhkMmVjOTQ3MDY3NmQ5ZWMzZTczYTNkNTZmNiIsInZlcmlmaWNhdGlvbiI6IuacqumqjOivge+8muacquaPkOS+m+WPr+aguOmqjOeahOWOn+eUnyBQcm9qZWN0IE9wcyDlm57miafvvJvpqozmlLbmloflrZfku4XkuLrkvJror53miqXlkYrjgIIiLCJib2R5SGFzaCI6IjFkZmFmOGJiYmZlZjdjYzI4ZjBmZjA4ODQ4ZjEwNGVkMDI5MTQ3NzM1ZDM4NjE3MmIyZDlmYWE2YjlhYWNlMGMifQ==>

# Project Ops · 0.2.2 GitHub Release · 交付记录

任务：2026-11-03-release-0-2-2-66018eb6d87da4d9
会话：session-d27bd610-9f29-4727-a309-ce15b00ce6a7
关联方案修订：1
[查看方案](./PLAN.md)

本记录由当前开发会话显式提交；不是回复结束或命令退出自动判定。验收文字为会话报告，原生回执验证另列。文档生成不代表已发布、已安装或所有平台已通过。

## 实现

把当前 HEAD 9f9f882 作为 0.2.2 发布：版本号与文档升到 0.2.2，重建 lib，生成 tgz 与 sha256，安装到 desktop profile，提交 main、打 v0.2.2 tag，使用 GitHub REST API 创建正式 Release 并上传 tgz/sha256。

## 验收报告

- 0.2.2 源码版本、lib 与打包清单一致：reported-pass
  证据：package.json 0.2.2；tgz package/package.json 0.2.2；lib/client.js db33f1af...；lib/index.js 5a68...
- 130 项测试、双端 typecheck 和隔离构建通过：reported-pass
  证据：vitest 11 files/130 tests passed；tsc client/host exit 0；隔离构建成功
- tgz 与 .sha256 生成并安装到本机 desktop profile 验证：reported-pass
  证据：tgz 49,708 bytes SHA-256 fd24c6cd...；sha256 104 bytes f5b09ae0...；desktop profile 0.2.2 安装后 client 哈希 db33f1af...
- Git main 与 v0.2.2 tag 已推送：reported-pass
  证据：release commit 46359b2；tag v0.2.2；git push main/tag 输出 9f9f882..46359b2 和 new tag
- GitHub Release v0.2.2 创建，tgz 和 sha256 资产上传并可下载：reported-pass
  证据：release id 432314812，draft=false，prerelease=false；资产 id 704447195/704447303；公共 URL 重新下载 tgz SHA-256 与 fd24... 一致
- README/README.en/VALIDATION/DELIVERY/SHA256SUMS/GIT_DELIVERY 记录发布事实与未验证边界：reported-pass
  证据：README/EN 增加 Release 与直接下载链接；VALIDATION 0.2.2 记录；DELIVERY/SHA256SUMS 更新；GIT_DELIVERY releaseCommit/assets/releaseVerification

## 原生回执验证

未验证：未提供可核验的原生 Project Ops 回执；验收文字仅为会话报告。

## 产物

- dist/missher-dsh-output-renderer-0.2.2.tgz
- dist/missher-dsh-output-renderer-0.2.2.tgz.sha256
- lib/client.js
- src/client/Assistant.tsx
- README.md
- VALIDATION.md
- DELIVERY.md
- GIT_DELIVERY.json

## Git

46359b2 release: 0.2.2; tag v0.2.2; pushed main and tag to origin

## 发布

GitHub Release v0.2.2 published (draft=false, prerelease=false); assets tgz and sha256 uploaded and public re-download verified.

## 安装

desktop profile 已从 0.2.1 升到 0.2.2；安装后 client 哈希 db33f1af...；旧 0.2.1 备份在 ~/.dsh/backups/output-renderer-0.2.1-20261103-133405。宿主进程未重启。

## 未完成项与限制

- 0.2.2 未单独在真实页面复测；实际页面行为证据来自 0.2.1。
- 旧版 alpha.5/rc.2 未用 0.2.2 重新实机复测，不能声称任何 DSH。
- 设置保存失败曾在 rc.4 出现一次通用回滚提示，原始宿主异常未保留，根因未定位。
- Project Ops task_run 仍无可用回执；验证以原生命令、Release API 响应和公共下载哈希为证据。

## 使用与回退

安装旧包 ~/.dsh/plugin-packages/or-0.2.1.tgz，或从 ~/.dsh/backups/output-renderer-0.2.1-20261103-133405 恢复 profile；删除 Release/tag 需另行授权。
