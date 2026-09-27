# 交付记录

2026-09-27 · @missher/dsh-output-renderer 0.1.0

四种布局和两种动效已实现，设置入口为“设置 → 输出外观”。完整验证记录见 VALIDATION.md；安装包校验见 dist 下同名 .sha256 文件。

最终安装包 SHA-256：`0e1bdaeff620734928795884a940d64541053f518a4dabfd3e8443129ba7457c`。最终包在隔离 profile 中的两个运行文件与本地构建哈希一致。已另外检查浅色/深色设置页，并恢复跟随系统。

本轮在 Codex 浏览器保留了实际设置页预览（隔离 Host `http://127.0.0.1:58398/`）。对应进程记录在 `verification/runtime-package/pid.json`，不是日常 DSH；停止这个测试进程只会关闭预览。

## 在日常 DSH 安装

进入 **插件 → 添加插件**，将下面完整路径粘贴到 **包名或地址**，然后点 **安装**：

```text
/Users/missher/Documents/Projects/04-Harness-Plugins/dsh-output-renderer/dist/missher-dsh-output-renderer-0.1.0.tgz
```

安装后在设置里选择 A/B/C/D 以及“刷新率同步”或“新增文字淡入”。默认 A + 淡入，可直接点击“重播输出”预览。

## 当前边界

- 独立包已构建，实际安装版 DSH 运行时的隔离 profile 安装、真实流式 UI、设置写入、热卸载恢复和会话保留验证通过。
- 日常 profile **尚未安装**。官方 CLI 拒绝操作 `desktop`，要求 Electron 应用管理；当前浏览器入口也无法访问该桌面页面，原生应用操控能力未开放。没有绕过这些入口。
- 日常 profile 清单与安装前备份逐字节一致，CLI 在修改前拒绝；没有重启正在运行的 DSH 或修改宿主源码。
- `verification/daily-backup/` 为只在本机保留的配置备份，不属于交付包，不要上传或公开。
- 合成流不调用真实模型；刷新率调度测试不等于高刷硬件持续帧率实测。

删除插件即可恢复原生输出，不删除会话。开发辅助脚本与模型适配器均不进入安装包。
