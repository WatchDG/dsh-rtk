# Contributing

Thanks for considering a contribution to `dsh-rtk`.

## Before you start

- Read the [README](README.md) to understand the bundle and its requirements.
- The plugin targets [DeepSeek Harness](https://www.deepseek.com/en/harness/)
  0.2.x and relies on `systemPrompt` and `tools/pre-execute`.
- [RTK](https://www.rtk-ai.app/) is an external prerequisite; it is never bundled.

## Development

The package has no runtime or development dependencies and no build step.

```bash
npm test                 # unit + manifest tests, integration tests when rtk exists
npm run test:unit        # no rtk binary required
npm run test:integration # skipped without rtk on PATH
npm run pack:check       # inspect the files npm would publish
```

Requirements: Node.js 20 or newer. Install RTK from
https://www.rtk-ai.app/docs/getting-started/installation/ if you want the
integration suite to run.

Run the tests before opening a pull request. CI runs them on Linux and Windows
with Node.js 20, 22, and 24.

## Bundle checklist

This repository is a DSH plugin bundle, so keep these invariants:

- `package.json` declares `dsh.bundle.patch` and the patch inserts exactly one
  `rtk` row pointing at the package name.
- Runtime modules live in `lib/` and are covered by the `files` array
  (`lib/*.js`). The manifest test fails when a module is missing from it.
- `locale/en.json` and `locale/ru.json` keep meaningful `meta.title` and
  `meta.description`; the icon stays a valid SVG below 256 KiB.
- The plugin remains dependency-free. `rtk` is invoked only through `execFile`
  with an argument array, never through a shell.
- Configuration stays backward compatible: unknown fields are ignored and all
  fields remain optional.
- Documentation links to both https://www.deepseek.com/en/harness/ and
  https://www.rtk-ai.app/.

## Code style

- ES modules, 2-space indentation, no semicolons, single quotes.
- Pure logic goes in `lib/config.js`, `lib/command.js`, or `lib/rules.js` so it
  can be tested without a process or a Harness.
- Process I/O stays in `lib/runner.js`; context wiring stays in `lib/plugin.js`.
- Add or update tests with every behavior change.

## Reporting issues

Open an issue at https://github.com/WatchDG/dsh-rtk/issues with the DSH version,
`rtk --version`, the operating system, the affected command, and the relevant
log or denial reason.

Please report RTK defects to the RTK project: https://github.com/rtk-ai/rtk.

## License

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, as described in [LICENSE](LICENSE).
