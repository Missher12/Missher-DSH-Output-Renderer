# Third-party notices

Missher DSH Output Renderer is distributed under the MIT license in [LICENSE](./LICENSE).

The client bundle includes workspace-path helpers, including `fileMediaUrl` and its path-resolution helpers, from **DeepSeek Harness**, copyright (c) 2026 DeepSeek, licensed under MIT.

- Upstream project: https://github.com/deepseek-ai/deepseek-harness
- Audited upstream baseline: `dsh-v0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`.
- Source component: `packages/util/workspace-path` (`@deepseek-ai/dsh-util-workspace-path`).
- Original license: [licenses/deepseek-harness-MIT.txt](./licenses/deepseek-harness-MIT.txt), retained without changing its text.

React, Schemastery and the DSH client store/UI modules are provided by the host and are not copied into this plugin package. The workspace-path helper code is the bundled upstream portion. Packaging and documentation changes in rc.4 retain the accepted rc.3 runtime bytes; their source repository, commit and hashes are recorded in `GIT_DELIVERY.json` in the source repository.
