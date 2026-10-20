/**
 * dsh-rtk — configuration normalization.
 *
 * The bundle row's `config` is user-authored YAML, so every field is optional
 * and every value is validated here once, at activation, instead of at each
 * hook invocation.
 */

/** System-prompt section name owned by this plugin. */
export const RULES_SECTION = 'rtk:rules'

/** Maximum number of remembered `rtk rewrite` answers. */
export const CACHE_LIMIT = 512

/** Default per-`rtk` invocation timeout. */
export const DEFAULT_TIMEOUT_MS = 4000

/** Commands longer than this are never inspected (shell tools have their own limits). */
export const DEFAULT_MAX_COMMAND_LENGTH = 4000

/** Shell tools watched by default. */
export const DEFAULT_TOOLS = ['pwsh', 'bash']

/**
 * Commands rtk implements by proxying to a POSIX binary that Windows lacks
 * (`ls`, `tree`, `find`, ...). Rewriting them on win32 would produce a command
 * that cannot start, so they stay raw there.
 */
const WIN32_PROXY_UNSAFE = [
  'ls',
  'dir',
  'tree',
  'find',
  'cat',
  'head',
  'tail',
  'grep',
  'sed',
  'awk',
  'which',
  'touch',
  'chmod',
  'chown',
  'du',
  'df',
]

const MAX_TIMEOUT_MS = 60_000

/**
 * Normalize the loader row's config.
 *
 * @param {unknown} raw Value from the bundle row (`config` in the patch layer).
 * @returns {{
 *   rules: boolean,
 *   hook: 'deny' | 'off',
 *   tools: Set<string>,
 *   exclude: Set<string>,
 *   timeoutMs: number,
 *   maxCommandLength: number,
 * }}
 */
export function normalizeConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const platformExcludes = process.platform === 'win32' ? WIN32_PROXY_UNSAFE : []
  const extraExcludes = Array.isArray(source.exclude)
    ? source.exclude
        .filter((value) => typeof value === 'string')
        .map((value) => value.toLowerCase())
    : []
  const configuredTools = Array.isArray(source.tools)
    ? source.tools.filter((value) => typeof value === 'string')
    : []
  const tools = configuredTools.length > 0 ? configuredTools : DEFAULT_TOOLS
  const timeoutMs =
    Number.isFinite(source.timeoutMs) && source.timeoutMs > 0
      ? Math.min(source.timeoutMs, MAX_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS
  return {
    rules: source.rules !== false,
    hook: source.hook === 'off' ? 'off' : 'deny',
    tools: new Set(tools),
    exclude: new Set([...platformExcludes, ...extraExcludes]),
    timeoutMs,
    maxCommandLength: DEFAULT_MAX_COMMAND_LENGTH,
  }
}
