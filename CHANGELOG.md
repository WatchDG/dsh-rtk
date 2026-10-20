# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-20

### Added

- Initial production release of the DSH bundle for [DeepSeek Harness](https://www.deepseek.com/en/harness/).
- `rtk:rules` system-prompt section with RTK usage guidance, `rtk rewrite`,
  `rtk recall`, `rtk proxy`, and missing-RTK fallback.
- `tools/pre-execute` hook for `pwsh` and `bash` that denies a raw command and
  returns its exact [RTK](https://www.rtk-ai.app/) form.
- Configuration: `rules`, `hook`, `tools`, `exclude`, `timeoutMs`.
- Windows-safe exclusions for RTK commands that proxy to POSIX binaries.
- Rewrite cache (512 command lines) and one-time availability probe.
- Localized bundle metadata (English, Russian).
- Unit, manifest, and optional integration test suites with `node:test`.
- GitHub Actions CI on Linux and Windows with Node.js 20, 22, and 24.
- Documentation in English and Russian, changelog, contribution guide, and
  Apache-2.0 license.

### Changed

- Copyright holder and package author are now Baranov Grigoriy Vladimirovich.
- Replaced the funnel icon with an RTK wordmark on a black tile.

[1.0.0]: https://github.com/WatchDG/dsh-rtk/releases/tag/v1.0.0
