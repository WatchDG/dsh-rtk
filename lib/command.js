/**
 * dsh-rtk — pure command-line analysis and model-facing messages.
 *
 * Nothing in this module starts a process, so it is fully unit-testable and
 * safe to call on every shell tool invocation.
 */

/** Rewritten command must be an actual rtk invocation. */
const RTK_INVOCATION = /^rtk(?:\.exe)?\s+/i

/** `rtk` at the head of a segment, with an optional PowerShell call operator. */
const RTK_AT_HEAD = /^(?:&\s*)?rtk(?:\.exe)?(?=\s|$)/i

/** Shell syntax rtk's parser does not reproduce faithfully (quotes, pipes, redirections, variables). */
const UNSAFE_SYNTAX = /[|<>;`'"#$@~(){}\r\n%!]/

/** A single `&` (backgrounding), unlike the `&&` chain rtk does support. */
const LONE_AMPERSAND = /(?<!&)&(?!&)/

/**
 * Reduce `rtk rewrite` output to the one usable line.
 *
 * @param {string | undefined} stdout Captured stdout.
 * @param {string} original Command the model asked for.
 * @returns {string | null} The rewritten command, or null when there is none.
 */
export function normalizeRewritten(stdout, original) {
  const line = String(stdout ?? '')
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0)
  if (!line || !RTK_INVOCATION.test(line) || line === original) return null
  return line
}

/**
 * rtk does not model quoting, pipes, redirections, variables, or backgrounding
 * faithfully, so such command lines stay raw.
 *
 * @param {string} command Trimmed command line.
 * @returns {boolean}
 */
export function hasSafeSyntax(command) {
  return !UNSAFE_SYNTAX.test(command) && !LONE_AMPERSAND.test(command)
}

/**
 * True when any `&&` segment already starts with rtk, including a chain that
 * mixes rtk and raw segments.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function mentionsRtk(command) {
  return command
    .split('&&')
    .map((segment) => segment.trim())
    .some((segment) => RTK_AT_HEAD.test(segment))
}

/**
 * First command head for statistics: the lowercased binary name of the first
 * `&&` segment, without directories or a `.exe` suffix.
 *
 * @param {string} command Trimmed command line.
 * @returns {string} head, or `''` when there is none.
 */
export function commandHead(command) {
  const token = String(command ?? '')
    .split('&&')[0]
    .trim()
    .split(/\s+/)[0]
  if (!token) return ''
  return token
    .replace(/^.*[\\/]/, '')
    .replace(/\.exe$/i, '')
    .toLowerCase()
}

/**
 * Skip command heads whose native binary does not exist on this platform
 * (or that the user excluded explicitly).
 *
 * @param {string} command
 * @param {{ exclude: Set<string> }} config
 * @returns {boolean}
 */
export function isExcluded(command, config) {
  return String(command ?? '')
    .split('&&')
    .map((segment) => commandHead(segment))
    .filter(Boolean)
    .some((head) => config.exclude.has(head))
}

/**
 * Model-facing rejection: the exact command to run instead, and a raw escape
 * hatch through rtk itself.
 *
 * @param {string} command Original command.
 * @param {string} rewritten rtk form.
 * @returns {string}
 */
export function denyReason(command, rewritten) {
  return [
    `RTK hook: \`${command}\` has an rtk form.`,
    `Re-run this call with command = \`${rewritten}\`; rtk condenses the output to save tokens, and the raw form stays rejected while RTK is enabled.`,
    `If the rtk form fails, execute the original raw with \`rtk proxy ${command}\`.`,
  ].join(' ')
}
