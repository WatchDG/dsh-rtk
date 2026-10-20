/**
 * dsh-rtk — plugin mounting.
 *
 * Kept separate from `index.js` so the wiring can be unit-tested with a fake
 * rtk client and a fake plugin context, without a running Harness.
 */

import { RULES_SECTION } from './config.js'
import { denyReason, hasSafeSyntax, isExcluded, mentionsRtk } from './command.js'
import { rulesOrder, rulesText } from './rules.js'

/**
 * Normalized plugin settings produced by `normalizeConfig` in `config.js`.
 *
 * @typedef {object} RtkSettings
 * @property {boolean} rules
 * @property {'deny' | 'off'} hook
 * @property {Set<string>} tools
 * @property {Set<string>} exclude
 * @property {number} timeoutMs
 * @property {number} maxCommandLength
 */

/**
 * Authenticated HTTP route the Settings page reads the RTK version from.
 */
export const STATUS_PATH = '/rtk/status'

/**
 * Build the payload the Settings page reads over the status channel.
 *
 * @param {{ available: boolean, version: string | null }} input
 * @returns {{ available: boolean, version: string | null }}
 */
export function statusView({ available, version }) {
  return {
    available: available === true,
    version: typeof version === 'string' ? version : null,
  }
}

/**
 * Register the rules section and the pre-execution hook on the plugin context.
 *
 * @param {{
 *   logger?: { warn: (message: string) => void },
 *   systemPrompt: { section: (section: unknown) => unknown, getSectionOrder?: (name: string) => number | undefined },
 *   on: (event: string, listener: (exec: unknown, next: () => unknown) => unknown) => unknown,
 *   inject?: (deps: string[], callback: (child: unknown) => unknown) => unknown,
 * }} ctx
 * @param {RtkSettings} settings
 * @param {{
 *   isAvailable: () => Promise<boolean>,
 *   getVersion?: () => Promise<string | null>,
 *   rewrite: (command: string) => Promise<string | null>,
 * }} runner
 */
export function mount(ctx, settings, runner) {
  /** @type {Promise<boolean> | undefined} */
  let availability

  /** Probe once per activation; a missing rtk binary disables rewriting, not the plugin. */
  const ensureAvailable = () => {
    if (availability === undefined) {
      availability = Promise.resolve()
        .then(() => runner.isAvailable())
        .catch(() => false)
        .then((ok) => {
          if (!ok) {
            ctx.logger?.warn('dsh-rtk: `rtk` executable not found on PATH; the RTK hook is inactive')
          }
          return ok
        })
    }
    return availability
  }

  if (settings.rules) {
    ctx.systemPrompt.section({
      name: RULES_SECTION,
      order: rulesOrder(ctx.systemPrompt),
      text: rulesText(settings),
    })
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer', 'connection'], (child) => {
      child.effect(
        () =>
          child.webServer.register({
            kind: 'exact',
            path: STATUS_PATH,
            handler: async (req, res) => {
              const rejection = child.connection.requestRejection(req)
              if (rejection !== undefined) {
                res.statusCode = rejection
                res.end()
                return
              }
              if (req.method !== 'GET') {
                res.statusCode = 405
                res.setHeader('allow', 'GET')
                res.end()
                return
              }
              let version = null
              try {
                version =
                  typeof runner.getVersion === 'function'
                    ? await runner.getVersion()
                    : null
              } catch {
                version = null
              }
              let available = version !== null
              if (!available) {
                try {
                  available = await runner.isAvailable()
                } catch {
                  available = false
                }
              }
              const body = JSON.stringify(statusView({ available, version }))
              res.writeHead(200, {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
              })
              res.end(body)
            },
          }),
        `dsh-rtk: GET ${STATUS_PATH}`,
      )
    })
  }

  if (settings.hook === 'off') return

  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!settings.tools.has(exec.name)) return next()

    const args = exec.arguments
    const rawCommand =
      args !== null && typeof args === 'object' && typeof args.command === 'string' ? args.command : ''
    const command = rawCommand.trim()
    if (command.length === 0 || command.length > settings.maxCommandLength) return next()
    if (!hasSafeSyntax(command) || mentionsRtk(command) || isExcluded(command, settings)) return next()
    if (!(await ensureAvailable())) return next()

    /** @type {string | null} */
    let rewritten = null
    try {
      rewritten = await runner.rewrite(command)
    } catch {
      rewritten = null
    }
    if (!rewritten || exec.signal?.aborted) return next()

    return { kind: 'deny', reason: denyReason(command, rewritten) }
  })
}
