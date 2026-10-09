# Missher DSH Output Renderer

[简体中文](./README.md) · [Prebuilt downloads](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases) · [Desktop app](https://github.com/Missher12/Missher-DeepseekHarness-Desktop) · [Issues](https://github.com/Missher12/Missher-DSH-Output-Renderer/issues)

Four assistant output layouts with full reasoning, independent tool details, and frame-synchronized or fading text for DeepSeek Harness. The package is `@missher/dsh-output-renderer`; the current prerelease is **0.1.3-rc.5**. This removable UI plugin requires an existing DSH host.

rc.5 is an independent UI update. It adjusts heading hierarchy, label spacing and narrow settings rows, and fixes stale fade masks, toolbar text inclusion and connection-status priority. It inherits rc.4 packaging and licensing with changed runtime code. The 47 tests, type checks and isolated Host loading passed. Real-page visual acceptance, native interactions and sustained frame rates remain unverified, so this is a prerelease.

## Features

| Layout | Presentation |
| --- | --- |
| Clear reading | Continuous, single-column text with quiet tool details |
| Soft cards | Thinking and answers grouped with soft backgrounds |
| Deep process, simple reply | The full process followed by a distinct final answer |
| Task checklist | Actual assistant step numbers with running, output-complete or stopped states |

Use **Settings → Output appearance** to choose the layout, 14/16 px text, comfortable/compact spacing and streaming effect. Changes save automatically. Equal-height cards become a single column in a narrow panel; **Replay output** previews the effect.

- Reasoning remains fully expanded. Process groups containing reasoning stay open; individual tools and tool-only groups can still fold independently.
- Code, tables, images and file actions use native host components. The process layout does not summarize or truncate answers. A checklist's output-complete state does not mean that a tool or task succeeded.
- Frame-synchronized output uses `requestAnimationFrame` without a fixed 30/60 fps cap. Fade-in affects only arriving text. Reduced-motion settings are respected, and stopping, finishing or hiding the page clears buffers and animations.
- The plugin does not change prompts, model parameters or generation speed. Actual frame rate depends on hardware, browser load and Markdown complexity; sustained full-refresh performance is not guaranteed.

## Install, enable, disable and uninstall

Use a prebuilt `.tgz` from [Releases](https://github.com/Missher12/Missher-DSH-Output-Renderer/releases); available release assets determine what is published. The rc.5 filename is `missher-dsh-output-renderer-0.1.3-rc.5.tgz`, with a matching `.tgz.sha256` file. The installation steps below use the downloaded tgz directly and do not depend on npm package-name resolution.

1. Download the chosen tgz and checksum file. For rc.5, verify with `shasum -a 256 -c missher-dsh-output-renderer-0.1.3-rc.5.tgz.sha256`.
2. In the desktop app, open **Plugins → Add plugin**, enter the downloaded file's full path, then install and enable the plugin. Follow any reload prompt and open **Settings → Output appearance**.
3. Turn the plugin's enable switch off in plugin management to disable it, or on to enable it again. Disabling restores native output rendering.
4. Choose **Uninstall** on this plugin to remove it. To upgrade, use Update plugin in the current Missher desktop app and choose the new tgz. Back up the profile configuration and retain the old tgz first. Upgrade older desktop hosts that lack this update action; the host controls preference retention on uninstall.

For a Web or custom profile, use the target host's official CLI and replace the profile name and file path:

```sh
dsh plugin --profile my-web add /path/to/missher-dsh-output-renderer-0.1.3-rc.5.tgz
dsh plugin --profile my-web remove @missher/dsh-output-renderer
```

The Electron-managed `desktop` profile must use desktop plugin management. A Release package needs no Node/pnpm development setup or source checkout. No separate compatibility bundle is required.

## Data and permissions

The plugin saves layout, motion, spacing and text-size preferences through the host ConfigForm under `output-renderer`. Defaults are clear reading, new-text fade-in, comfortable spacing and 14 px. Legacy `split`, `timeline` and `compact` settings are read as clear reading without rewriting stored values on read.

It reads existing assistant content for display, creates no separate session database, and does not rewrite responses or attachments. It makes no model-service calls and adds no telemetry or API-credential configuration. Native host access controls and actions still handle images, files and links. Disabling or uninstalling removes plugin styles and subscriptions without deleting sessions, attachments or other plugins' settings; the host determines cleanup of this plugin's own preferences.

## Host and platform scope

| Scope | Evidence and limits |
| --- | --- |
| Intel macOS, DSH 0.2.0-rc.2 | rc.5 passed fresh isolated app CLI installation, configuration composition, Host startup and runtime hash checks; 47 tests and seven controlled DOM groups passed. Real-page visual acceptance was blocked in this run |
| 0.2.0-rc.1 | A historical baseline for earlier versions; not a new rc.5 platform run |
| Official rc.2 interfaces | Static comparison with upstream `dsh-v0.2.0-rc.2` confirms the required public slots, ConfigForm, assistant props and chat DOM markers. No required Missher-only interface was identified. A separate runtime acceptance test of the unmodified official distribution has not been completed |
| Windows / Linux | No plugin-specific runtime acceptance. Desktop downloads for those platforms do not establish plugin acceptance |
| Other host versions | Untested, including 0.2.1-alpha.1. Permissive version admission is not a compatibility guarantee |

The renderer uses `conversation.chat.node` / `assistant-step`, `settings.section`, native Markdown/image/file callbacks and version-related rc.2 chat DOM markers. The host supplies React, Schemastery and DSH client modules; development SDK links are excluded from the runtime package. Recheck these interfaces after host upgrades. If the settings entry is absent, check whether the plugin is enabled and inspect host loading errors.

See [VALIDATION.md](./VALIDATION.md) for dated evidence. The current 47 logic tests, seven controlled DOM groups and historical Web checks are separate evidence layers. They do not establish native Electron clicking, real-model/image end-to-end behavior, a full current Loader RPC inventory or sustained hardware frame rates.

## Development and attribution

The authoritative repository is [Missher-DSH-Output-Renderer](https://github.com/Missher12/Missher-DSH-Output-Renderer), which includes prebuilt lib files. For development, run `node scripts/link-harness.mjs /path/to/built-harness` with an explicitly built 0.2.0-rc.2 checkout, then use pnpm 11 to install the locked development dependencies. Follow that SDK's Node requirements. The `harness-sdk` link, workspace overrides and test adapter are excluded from the tgz.

Run `pnpm typecheck` and run tests serially with `pnpm test --maxWorkers=1`. `pnpm build` writes lib in the current copy, so use an isolated development copy. `pnpm pack:bundle` packages the prepared lib files and refuses to overwrite an existing package with the same name. Do not rebuild a directory referenced by a daily installation.

Licensed under [MIT](./LICENSE). The client includes workspace-path helpers from DeepSeek Harness; attribution and the complete upstream license are in [NOTICE.md](./NOTICE.md) and [the original MIT text](./licenses/deepseek-harness-MIT.txt). Issue reports should include host/plugin versions, reproduction steps and redacted errors, not private sessions or credentials.
