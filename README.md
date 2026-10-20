# dsh-rtk

[![CI](https://github.com/WatchDG/dsh-rtk/actions/workflows/ci.yml/badge.svg)](https://github.com/WatchDG/dsh-rtk/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**English** | [Русский](README.ru.md)

RTK integration for [DeepSeek Harness](https://www.deepseek.com/en/harness/): a
system-prompt rules section plus a pre-execution hook that routes terminal
commands through [RTK (Rust Token Killer)](https://www.rtk-ai.app/). RTK
condenses command output before it reaches the model — typically 60–90% fewer
output tokens — while keeping the lines that matter.

> **RTK must be installed by you, before you enable this plugin.** The plugin
> does not install, bundle, or download RTK; it only runs the `rtk` executable
> found on `PATH`. Install it from **https://www.rtk-ai.app/** and verify with
> `rtk --version`. Without it the plugin still loads, but the hook stays
> inactive and logs a warning.

## Requirements

| Requirement | Details |
|---|---|
| [DeepSeek Harness](https://www.deepseek.com/en/harness/) | 0.2.x (tested with 0.2.1). The plugin uses the Host `systemPrompt` service and the `tools/pre-execute` event. |
| [RTK](https://www.rtk-ai.app/) | Installed by the user, available as `rtk` on `PATH`. Any recent release. |

### Install RTK first

```bash
# Windows
winget install rtk-ai.rtk

# macOS / Linux
brew install rtk

# Any platform (installer script)
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

Then confirm you installed RTK and not an unrelated package with the same name:

```bash
rtk --version   # any current version
rtk gain        # must print the savings dashboard
```

Full instructions, editions, and uninstall steps:
**https://www.rtk-ai.app/docs/getting-started/installation/**.

## Installation in DeepSeek Harness

The plugin is a bundle for the current DSH profile, so it applies to every
session of that profile.

1. Open the **Plugins** page in the DSH sidebar (the Plugin Manager).
2. Choose **Add plugin** / **Install bundle**, select this directory (the one
   containing `package.json`), and confirm.
3. Make sure **RTK Command Filter** is enabled in the plugin list.

The same step is available to an agent through the `plugin_manager` tool with
`action: install_bundle` and the absolute path to this directory. DSH records a
`link:` dependency on the directory in the profile's `package.json`; because the
directory is linked, restart DSH after updating the plugin's files so Host
JavaScript is loaded again.

To uninstall, remove the bundle from the Plugin Manager (or
`plugin_manager` `action: remove_bundle`). Removing the bundle does not touch
RTK.

## What the plugin does

### 1. Prompt rules

A `rtk:rules` system-prompt section is inserted right after the shell tools'
guidance. It tells the model to:

- run VCS, build, test, lint, and package-manager commands through `rtk`
  (`rtk git status`, `rtk cargo test`, `rtk pytest`, `rtk docker ps`, …);
- use `rtk rewrite "<command line>"` to find the rtk form of an arbitrary line;
- keep the harness file tools (`read`, `write`, `edit`, `glob`, `grep`) for file
  work — they provide line numbers, diffs, and the edit-observation check that
  `rtk read` does not;
- treat condensed output as the complete result and recover elided lines with
  `rtk recall <hash>`;
- use `rtk proxy <cmd>` only when a condensed result is unusable, and run
  interactive commands raw;
- use `rtk gain` only when the user asks about token savings;
- fall back to raw commands and point the user to RTK if the binary is missing.

### 2. Pre-execution hook

The plugin listens to `tools/pre-execute` for the configured shell tools
(`pwsh` and `bash` by default). When `rtk rewrite` returns an rtk form, the call
is **denied** with the exact replacement command:

```
RTK hook: `git status` has an rtk form. Re-run this call with command = `rtk git status`; …
If the rtk form fails, execute the original raw with `rtk proxy git status`.
```

The model re-runs the call through rtk. `rtk rewrite` is the single source of
truth for the mapping, so the plugin automatically picks up new filters when
RTK is upgraded.

### Why deny instead of rewriting

In the DSH dispatch contract, tool arguments are immutable: `tools/execute`
wrappers may change only `exec.signal`, and `tools/pre-execute` can allow, deny,
cancel, or ask — but cannot replace the arguments. A denial that names the exact
replacement is therefore the only way to route a raw command through rtk before
the shell sees it. This costs one extra model turn per raw command; with the
rules in place the model normally writes `rtk …` directly.

### 3. Settings page

**Settings → RTK** shows the live RTK version read from the Host with
`rtk --version` (`GET /rtk/status`). When the binary is missing, the section
says so and points to the installation guide instead of a version number.

## Configuration

Every field is optional. Override the `rtk` row in the profile's patch layer.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `rules` | boolean | `true` | Register the `rtk:rules` system-prompt section. |
| `hook` | `'deny' \| 'off'` | `'deny'` | Deny raw commands that have an rtk form, or only keep the rules. |
| `tools` | string[] | `['pwsh', 'bash']` | Shell tool names the hook watches. |
| `exclude` | string[] | `[]` | Extra command heads that are never rewritten (lowercased). |
| `timeoutMs` | number | `4000` | Timeout of one `rtk` invocation, capped at 60 s. |

```yaml
- id: rtk
  config:
    hook: off                  # keep the rules only
    rules: true
    tools: [pwsh, bash]
    exclude: [make, msbuild]   # never rewrite these command heads
    timeoutMs: 4000
```

`rtk rewrite` answers are cached for the lifetime of the plugin (up to 512
command lines). Set `hook: off` if you do not want any denials; the rules
section and the RTK usage guidance remain.

## When the hook stays out of the way

The hook intentionally passes a call through when:

- `rtk` is not on `PATH` (the plugin logs one warning and the hook stays idle);
- `rtk rewrite` has no filter for the command (`Get-ChildItem`, `docker ps` on
  an unsupported RTK version, …);
- the command line contains syntax RTK does not reproduce faithfully — quotes,
  `|`, `>`/`<`, `;`, `` ` ``, `$`, `%`, `!`, parentheses, braces, `@`, `~`, or a
  lone `&` (an `&&` chain is supported). For example, `git commit -m "fix: x"`
  would lose its quotes, so it stays raw;
- the command already starts with `rtk` in any `&&` segment;
- its command head is excluded by configuration;
- the call was cancelled (`exec.signal` aborted).

On Windows, commands that RTK implements through POSIX binaries missing from
the system are excluded automatically: `ls`, `dir`, `tree`, `find`, `cat`,
`head`, `tail`, `grep`, `sed`, `awk`, `which`, `touch`, `chmod`, `chown`, `du`,
`df`. Add more heads with `exclude`.

## Verification

1. `rtk --version` and `rtk gain` work in a terminal.
2. The **Plugins** page (and the read-only **Settings → Plugins** list) shows
   **RTK Command Filter** / **RTK: фильтр вывода команд**, and it is enabled.
3. **Settings → RTK** shows the same version as `rtk --version` in a terminal.
4. In a new session, ask the agent to run `git status`: the first `pwsh` call is
   rejected with a reason that contains `rtk git status`, and the retried call is
   `rtk git status`.
5. `rtk gain` shows the recorded savings. Statistics are global to RTK, not
   specific to this plugin.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Log says ``rtk` executable not found on PATH`` | Install RTK, open a new shell (or restart DSH) so `PATH` is refreshed. |
| `rtk` exists but the hook does nothing | The hook is disabled (`hook: off`), the command is excluded, or the command contains syntax that stays raw. |
| `rtk --version` works but behaves oddly | Another project named `rtk` may be installed; `rtk gain` must show the savings dashboard. |
| The model makes one extra call | Expected: arguments are immutable in DSH, so a raw command is denied once and retried through rtk. |
| A command should stay raw | Add its head to `exclude`, or disable the hook with `hook: off`. |
| `rtk` form fails | Run `rtk proxy <command>` (raw, still tracked) or fix/upgrade RTK. |

## Development

No dependencies and no build step.

```bash
npm test                 # unit tests + manifest checks; integration tests if rtk is installed
npm run test:unit        # no rtk binary required
npm run test:integration # skipped unless rtk is on PATH
npm run pack:check       # verify the npm package contents
```

Layout:

```
index.js              Host entry point: exports apply / name / inject
client.js             Settings → RTK page: live `rtk --version` (web client)
lib/config.js         config defaults and normalization
lib/command.js        pure command analysis and deny message
lib/rules.js          system-prompt rules text and section order
lib/runner.js         execFile boundary for `rtk`, availability probe, version, rewrite cache
lib/plugin.js         context wiring (prompt section + pre-execute listener + GET /rtk/status)
test/                 node:test suites (unit, manifest, integration)
```

When adding a runtime module, add it to `files` in `package.json`; the manifest
test fails otherwise. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security and privacy

- The plugin runs only the locally installed `rtk` executable and passes each
  command as a single `argv` element to `execFile` — never through a shell — so
  command text cannot inject shell syntax at this boundary.
- The plugin performs no network access, sends no telemetry, and stores no
  command history. RTK itself is third-party software; review its documentation
  at **https://www.rtk-ai.app/** for its behavior and privacy settings.

## Links

- **DeepSeek Harness** — https://www.deepseek.com/en/harness/
- **RTK** — https://www.rtk-ai.app/
- **RTK installation guide** — https://www.rtk-ai.app/docs/getting-started/installation/
- **RTK on GitHub** — https://github.com/rtk-ai/rtk
- **Plugin repository** — https://github.com/WatchDG/dsh-rtk

## License

[Apache-2.0](LICENSE), © 2026 Baranov Grigoriy Vladimirovich. RTK is licensed
separately by the RTK project; see the RTK repository for details.
