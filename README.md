# DSH 输出外观

独立、可卸载的 DeepSeek Harness Bundle。适配 **DSH 0.1.7-rc.2**。

安装后进入 **设置 → 输出外观**，布局和动效可以独立选择并自动保存。

| 布局 | 效果 |
| --- | --- |
| A · 简洁阅读 | 连续排版，弱化过程的视觉干扰 |
| B · 分区卡片 | 思考、执行、回复分区显示 |
| C · 执行时间线 | 按执行顺序显示过程和回复 |
| D · 左右分栏 | 左侧过程、右侧回复；窄窗口自动改为上下排列 |

- **刷新率同步**：用 `requestAnimationFrame` 消化收到的文本，按显示帧更新，无固定 30/60 fps 上限；停止或结束立即显示已收到的完整文字。
- **新增文字淡入**：仅新文字使用 200 ms 淡入，旧内容保持稳定；重播按钮可直接试效果。
- 思考全文始终可见；工具详情继续独立展开。代码、表格、图片、文件链接复用 DSH 原生组件。
- 遵循系统“减少动态效果”，页面进入后台时收束缓冲。

刷新率同步改善显示节奏，不提高模型生成速度。实际帧率仍取决于屏幕、浏览器负载、Markdown 复杂度和宿主数据更新；没有恒定硬件 120/240 fps 的保证。

## 安装与移除

桌面版：进入 **插件 → 添加插件**，在“包名或地址”中粘贴本地 `missher-dsh-output-renderer-0.1.0.tgz` 的完整路径，然后点“安装”。安装后进入 **设置 → 输出外观**。桌面版的 `desktop` profile 由 Electron 专管，不能通过 CLI 安装。

Web 或自建 profile 也可以用目标 DSH 的官方 CLI：

```sh
dsh plugin --profile <目标配置名称> add /完整路径/missher-dsh-output-renderer-0.1.0.tgz
dsh plugin --profile <目标配置名称> remove @missher/dsh-output-renderer
```

使用独立命名空间 `output-renderer` 保存设置，默认“简洁阅读 + 新增文字淡入”。移除后恢复原生渲染，不删除会话、附件或其他插件设置。

这是针对 0.1.7-rc.2 的实现，升级宿主前应重新验证聊天布局的数据属性与公开插槽。包不携带测试模型、API 凭据或运行数据。

## 开发

```sh
node scripts/link-dev.mjs /完整路径/已构建的DSH源码
npm run typecheck
npm run build
npm test
npm run pack:bundle
```

`scripts/launch-isolated.mjs` 使用本目录下的隔离 HOME/DSH_HOME；需设置 `DSH_SOURCE_DIR`。可通过 `DSH_OUTPUT_TEST_FIXTURE=1` 启用仅本地的合成流验证。该测试入口和测试适配器不进入安装包。

验证范围与限制见 [VALIDATION.md](./VALIDATION.md)。
