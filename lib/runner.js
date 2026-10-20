/**
 * dsh-rtk — the `rtk` subprocess boundary.
 *
 * `rtk rewrite` is the single source of truth for the command mapping, so the
 * plugin picks up new rtk filters without a release. Commands are passed as a
 * single argv element to `execFile` (never through a shell), and answers are
 * memoized because shell command lines repeat constantly.
 */

import { execFile } from 'node:child_process'

import { CACHE_LIMIT } from './config.js'
import { normalizeRewritten } from './command.js'

const MAX_STDOUT_BYTES = 4 * 1024 * 1024

/**
 * Run `rtk` once.
 *
 * `rtk rewrite` exits with status 3 when it rewrites, so a non-zero exit is
 * still a usable answer while stdout is present. A timeout, a buffer overflow,
 * or a missing executable has a non-numeric `error.code` and is a failure.
 *
 * @param {string} executable
 * @param {string[]} args
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: boolean, stdout?: string, error?: NodeJS.ErrnoException }>}
 */
function runRtk(executable, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: MAX_STDOUT_BYTES,
      },
      (error, stdout) => {
        const text = typeof stdout === 'string' ? stdout.trim() : ''
        const usable = text.length > 0 && (error === null || typeof error.code === 'number')
        if (usable) resolve({ ok: true, stdout: text })
        else resolve({ ok: false, error })
      },
    )
  })
}

/**
 * Create the rtk client used by the plugin.
 *
 * @param {{ timeoutMs: number, executable?: string }} options
 * @returns {{
 *   isAvailable: () => Promise<boolean>,
 *   rewrite: (command: string) => Promise<string | null>,
 * }}
 */
export function createRtkRunner({ timeoutMs, executable = 'rtk' }) {
  /** @type {Map<string, string | null>} */
  const cache = new Map()
  /** @type {Promise<boolean> | undefined} */
  let availability

  const exec = (args) => runRtk(executable, args, timeoutMs)

  const isAvailable = () => {
    if (availability === undefined) {
      availability = exec(['--version']).then((result) => result.ok)
    }
    return availability
  }

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

  return { isAvailable, rewrite }
}
