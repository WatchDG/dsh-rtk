/**
 * dsh-rtk — the `rtk` subprocess boundary.
 *
 * `rtk rewrite` is the single source of truth for the command mapping, so the
 * plugin picks up new rtk filters without a release. Commands are passed as a
 * single argv element to `execFile` (never through a shell), and rewrite
 * answers are memoized because shell command lines repeat constantly.
 *
 * The Settings page reads savings through this boundary too: the Host process
 * is not sandboxed, so `rtk gain` works here even when it fails inside an
 * agent session whose tracking database is outside the session workspace.
 */

import { execFile } from 'node:child_process'

import { CACHE_LIMIT } from './config.js'
import { normalizeRewritten } from './command.js'

const MAX_STDOUT_BYTES = 4 * 1024 * 1024

/** Detail views served by `GET /rtk/gain`, mapped to `rtk gain` flags. */
export const GAIN_VIEWS = [
  'summary',
  'top',
  'history',
  'daily',
  'weekly',
  'monthly',
  'recalls',
  'failures',
  'graph',
]

/**
 * Run `rtk` once.
 *
 * `rtk rewrite` exits with status 3 when it rewrites, so a non-zero exit is
 * still a usable answer while stdout is present. A timeout, a buffer overflow,
 * or a missing executable has a non-numeric `error.code` and is a failure.
 *
 * @param {string} executable
 * @param {string[]} args
 * @param {{ timeoutMs: number, cwd?: string }} options
 * @returns {Promise<{ ok: boolean, code: number | null, stdout?: string, error?: NodeJS.ErrnoException }>}
 */
function runRtk(executable, args, { timeoutMs, cwd }) {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: MAX_STDOUT_BYTES,
        ...(cwd ? { cwd } : {}),
      },
      (error, stdout) => {
        const text = typeof stdout === 'string' ? stdout.trim() : ''
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : null
        const usable = text.length > 0 && code !== null
        if (usable) resolve({ ok: true, code, stdout: text })
        else resolve({ ok: false, code, error })
      },
    )
  })
}

/**
 * Create the rtk client used by the plugin.
 *
 * @param {{ timeoutMs?: number, getTimeoutMs?: () => number, executable?: string }} options
 * @returns {{
 *   isAvailable: () => Promise<boolean>,
 *   getVersion: () => Promise<string | null>,
 *   rewrite: (command: string) => Promise<string | null>,
 *   getGain: (query?: { view?: string, project?: boolean, projectPath?: string }) => Promise<{ ok: boolean, kind?: 'json' | 'text', data?: unknown, text?: string }>,
 *   verifyRtk: () => Promise<{ ok: boolean, text: string }>,
 *   resetGain: () => Promise<{ ok: boolean, text: string }>,
 *   cacheSize: () => number,
 * }}
 */
export function createRtkRunner({ timeoutMs = 4000, getTimeoutMs, executable = 'rtk' } = {}) {
  /** @type {Map<string, string | null>} */
  const cache = new Map()
  /** @type {Promise<string | null> | undefined} */
  let version

  const timeout = () =>
    typeof getTimeoutMs === 'function' ? getTimeoutMs() : timeoutMs

  const exec = (args, options = {}) =>
    runRtk(executable, args, { timeoutMs: options.timeoutMs ?? timeout(), cwd: options.cwd })

  const getVersion = () => {
    if (version === undefined) {
      version = exec(['--version']).then((result) => (result.ok ? result.stdout.trim() : null))
    }
    return version
  }

  const isAvailable = async () => (await getVersion()) !== null

  const remember = (command, rewritten) => {
    if (cache.size >= CACHE_LIMIT) cache.clear()
    cache.set(command, rewritten)
  }

  const rewrite = async (command) => {
    const cached = cache.get(command)
    if (cached !== undefined) return cached
    const result = await exec(['rewrite', command])
    const rewritten = result.ok ? normalizeRewritten(result.stdout, command) : null
    remember(command, rewritten)
    return rewritten
  }

  /**
   * Read the savings dashboard. `summary` returns parsed JSON, every other
   * view returns the text table rtk prints. `project` scopes the numbers to
   * `projectPath` by running rtk with that working directory.
   */
  const getGain = async ({ view = 'summary', project = false, projectPath = '' } = {}) => {
    const name = GAIN_VIEWS.includes(view) ? view : 'top'
    const args = ['gain']
    if (name === 'summary') args.push('--format', 'json')
    else if (name !== 'top') args.push(`--${name}`)
    if (project) args.push('--project')
    const cwd = project && typeof projectPath === 'string' && projectPath.trim() !== '' ? projectPath.trim() : undefined
    // History tables scan the whole tracking database; give them headroom.
    const result = await exec(args, { cwd, timeoutMs: Math.max(timeout(), 15_000) })
    if (!result.ok) return { ok: false }
    if (name === 'summary') {
      try {
        return { ok: true, kind: 'json', data: JSON.parse(result.stdout) }
      } catch {
        return { ok: false }
      }
    }
    return { ok: true, kind: 'text', text: result.stdout }
  }

  /** Run `rtk verify` (hook integrity and filter inline tests). */
  const verifyRtk = async () => {
    const result = await exec(['verify'])
    if (result.ok) return { ok: result.code === 0, text: result.stdout }
    return { ok: false, text: '' }
  }

  /** Reset token savings and recall stats. The caller confirms first. */
  const resetGain = async () => {
    const result = await exec(['gain', '--reset', '--yes'])
    if (!result.ok) return { ok: false, text: '' }
    return { ok: true, text: result.stdout }
  }

  const cacheSize = () => cache.size

  return { isAvailable, getVersion, rewrite, getGain, verifyRtk, resetGain, cacheSize }
}
