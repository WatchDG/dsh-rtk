/**
 * dsh-rtk — the system-prompt rules section.
 *
 * The text is generated from the normalized config so it never advertises a
 * behavior the user disabled (`hook: off`).
 */

/**
 * @param {{ hook: 'deny' | 'off' }} config
 * @returns {string}
 */
export function rulesText(config) {
  const lines = [
    '## RTK terminal output',
    '',
    '`rtk` condenses command output before it reaches you — typically 60–90% fewer tokens — while keeping every signal. Run VCS, build, test, lint, and package-manager commands through it:',
    '',
    '- `rtk git status`, `rtk git diff`, `rtk git log -5`, `rtk git add -A`, `rtk git commit -m "…"`, `rtk git push`',
    '- `rtk cargo test`, `rtk dotnet build`, `rtk pytest`, `rtk pnpm test`, `rtk npm run build`, `rtk tsc --noEmit`, `rtk lint .`',
    '- `rtk docker ps`, `rtk kubectl get pods`, `rtk curl <url>`, `rtk err <cmd>`, `rtk summary <cmd>`',
    '',
    '`rtk rewrite "<command line>"` prints the rtk form of the whole line, or nothing when rtk has no filter for it.',
    '',
    'If `rtk` is missing, run commands raw and tell the user to install RTK (https://www.rtk-ai.app/).',
    '',
    '- Keep the harness file tools (`read`, `write`, `edit`, `glob`, `grep`) for file work: they give line numbers, diffs, and edit-observation checks that `rtk read` cannot.',
    '- Chain related commands in one call (`rtk git status && rtk git diff`).',
    '- Condensed output is the complete result; do not re-run a command to "see more". When output is elided it names a recovery hash — `rtk recall <hash>`. Use `rtk proxy <cmd>` (raw execution, still tracked) only when a condensed result is unusable: empty when output was expected, contradicting its exit code, or garbled.',
    '- Commands that need interactive input are not rtk commands; run them raw.',
  ]
  if (config.hook === 'deny') {
    lines.push(
      '- The RTK hook rejects a shell command that has an rtk form and returns the exact rewritten command: run that form instead.',
    )
  }
  lines.push('- `rtk gain` reports cumulative savings; run it only when the user asks about token savings.')
  return lines.join('\n')
}

/**
 * Place the rules section right after the shell tools' guidance, so it reads
 * as part of how to run terminal commands rather than as a separate policy.
 *
 * @param {{ getSectionOrder?: (name: string) => number | undefined } | undefined} systemPrompt
 * @returns {number}
 */
export function rulesOrder(systemPrompt) {
  const shellOrder = systemPrompt?.getSectionOrder?.('TOOL_PWSH')
  return Number.isFinite(shellOrder) ? shellOrder + 5 : 1015
}
