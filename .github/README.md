<div align="center">

<h1>DSH Output Renderer · 输出外观</h1>

<p><img src="../docs/images/overview.svg" alt="Output Renderer 功能示意" width="100%"></p>

<p>让回答、思考过程和搜索来源各有清楚的位置。</p>

<p>
  <a href="https://github.com/Missher12/Missher-DSH-Output-Renderer/releases/tag/v1.0.2"><img src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-1.0.2-4D6BFE?style=flat-square" alt="版本: 1.0.2"></a>
  <a href="https://github.com/Missher12/Missher-DSH-Output-Renderer"><img src="https://img.shields.io/badge/%E6%96%87%E6%A1%A3-%E4%B8%AD%E6%96%87-4D6BFE?style=flat-square" alt="文档: 中文"></a>
</p>

<p><a href="#功能一览">功能一览</a> · <a href="#快速开始">快速开始</a> · <a href="#使用场景">使用场景</a> · <a href="#常见问题">常见问题</a> · <a href="#详细文档">详细文档</a> · <a href="../README.en.md">English</a></p>

</div>

---

<!-- current-source -->
当前开发源码：**1.0.2** · [分支 `main`](https://github.com/Missher12/Missher-DSH-Output-Renderer/tree/main)。安装包以实际 Release 为准。
<!-- /current-source -->

## 功能一览

| 能做什么 | 说明 |
| --- | --- |
| **四种阅读布局** | 清晰阅读、简洁对话、深想简答与任务清单。 |
| **思考与工具** | 按需展开过程，代码、图片和文件沿用宿主操作。 |
| **搜索来源** | 查看宿主已记录的网页来源，展开或收起来源卡片。 |
| **阅读偏好** | 调整字号、内容间距和流式文字效果，跟随深浅主题。 |

## 快速开始

1. 从 [Releases](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases/tag/v1.0.2) 下载对应版本的 `.tgz` 安装包。
2. 在 DSH **插件 → 添加插件** 中选择下载的文件，安装并启用；按宿主提示重新加载或正常重启。
3. 打开 **设置 → 输出外观**，选择适合自己的阅读布局。

## 使用前了解

- 这是显示层插件，布局不会改变模型参数、回答内容或模型生成速度。
- 搜索来源展示依赖宿主提供相应能力；详细兼容范围与历史截图见下方文档。


<!-- readme-expansion -->
## 使用场景

| 遇到的情况 | 怎样使用 |
| --- | --- |
| 长回答的正文和工具过程混在一起，不方便阅读 | 选择清晰阅读或简洁对话，让正文与过程有更清楚的层级。 |
| 希望保留完整思考和执行过程 | 使用深想简答或任务清单，按实际步骤查看过程与状态。 |
| 想核对搜索回答引用了哪些网页 | 展开宿主已记录的来源胶囊和卡片，再打开原始来源。 |

## 第一次使用

1. 打开“设置 → 输出外观”，选择一种布局。
2. 在预览区对比字号、舒适／紧凑间距和流式效果，点击“重播输出”观察变化。
3. 回到一段包含正文、工具和网页来源的对话，展开过程或来源，检查自己最常用的阅读方式。

### 一个具体例子

偏重结论时先试“简洁对话”；需要复核过程时试“深想简答”；连续开发时可以用“任务清单”观察实际步骤。设置改变显示方式，不替代对结果的核对。

## 常见问题

<details>
<summary>收起思考和工具，会删除原始对话吗？</summary>

这是阅读层面的折叠。代码、文件和宿主已有操作继续使用原生能力；会话数据仍由宿主保存。

</details>

<details>
<summary>动效越快，模型生成也会更快吗？</summary>

不会。显示刷新与模型生成速度相互独立；刷新率同步或新增文字淡入只决定已经到达的内容怎样呈现。

</details>

<details>
<summary>为什么有些搜索没有来源卡片？</summary>

来源来自宿主已有的结构化搜索记录，并依赖宿主展示能力。缺少对应能力或元数据时保留可用的原生展示，不额外抓取网页来补造来源。

</details>

## 搭配使用

配合 [推理强度](https://github.com/Missher12/Missher-DSH-Reasoning-Effort) 可以分别调整阅读方式和模型已声明的思考档位；这两项设置各自生效。

## 升级与数据

升级保留原会话与阅读偏好，先在预览区确认效果，再回到已有对话检查。历史截图会注明版本，当前布局以插件实际设置页为准。
<!-- /readme-expansion -->

## 详细文档

[项目原说明](../README.md) · [验证记录](../VALIDATION.md) · [来源与许可](../NOTICE.md) · [许可证](../LICENSE)

原有功能细节、配置、截图与验证记录保留在上述文档中，历史结论按其注明的版本理解。
