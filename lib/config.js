/**
 * dsh-rtk — configuration normalization and the settings schema.
 *
 * The bundle row's `config` is user-authored YAML, so every field is optional
 * and every value is validated here, at activation, instead of at each hook
 * invocation.
 *
 * `Config` is the same shape as a schema: the settings service serves only
 * volatile fields, so the Settings page can rewrite them while the plugin
 * stays loaded. `snapshot()` unwraps those live references back into the
 * plain values the hook and the status route consume.
 */

import z from '@deepseek-ai/schemastery'

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
 * Runtime configuration.
 *
 * `.volatile()` is what makes the Settings page work: the settings service
 * exposes only volatile fields, and a write replaces the reference in place
 * instead of remounting the plugin.
 */
export const Config = z.object({
  rules: z.boolean().default(true).volatile(),
  hook: z.union(['deny', 'off']).default('deny').volatile(),
  tools: z.array(z.string()).default([...DEFAULT_TOOLS]).volatile(),
  exclude: z.array(z.string()).default([]).volatile(),
  timeoutMs: z.number().default(DEFAULT_TIMEOUT_MS).volatile(),
})

/**
 * Read one Config field, tolerating a plain value when the schema is parsed
 * without the volatile wrapper (tests, older readers).
 *
 * @param {unknown} value Stored field value or volatile reference.
 * @param {unknown} fallback Value when nothing usable is stored.
 * @returns {unknown} the stored choice.
 */
function live(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      const current = value.get()
      return current === undefined ? fallback : current
    } catch {
      return fallback
    }
  }
  return value === undefined ? fallback : value
}

/**
 * Unwrap volatile Config references into a plain object `normalizeConfig`
 * accepts, then normalize. Call it on every use, not once at activation:
 * the Settings page may replace a field between two hook invocations.
 *
 * @param {unknown} raw Plugin Config with optional volatile references.
 * @returns {{ rules: boolean, hook: 'deny' | 'off', tools: Set<string>, exclude: Set<string>, timeoutMs: number, maxCommandLength: number }}
 */
export function snapshot(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  return normalizeConfig({
    rules: live(source.rules, true),
    hook: live(source.hook, 'deny'),
    tools: live(source.tools, undefined),
    exclude: live(source.exclude, undefined),
    timeoutMs: live(source.timeoutMs, undefined),
  })
}

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
  // snapshot() may feed an already-normalized config back in; accept Sets too.
  const asArray = (value) => (Array.isArray(value) ? value : value instanceof Set ? [...value] : [])
  const extraExcludes = asArray(source.exclude)
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase())
  const configuredTools = asArray(source.tools).filter((value) => typeof value === 'string')
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
