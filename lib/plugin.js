/**
 * dsh-rtk — plugin mounting.
 *
 * Kept separate from `index.js` so the wiring can be unit-tested with a fake
 * rtk client and a fake plugin context, without a running Harness.
 *
 * Config is read live: `snapshot()` unwraps volatile references on every use,
 * so the Settings page can flip `hook`, `tools`, `exclude` and `timeoutMs`
 * without remounting the plugin. Only the rules section's presence is decided
 * once, at activation.
 */

import { RULES_SECTION, normalizeConfig, snapshot } from './config.js'
import { denyReason, hasSafeSyntax, isExcluded, mentionsRtk } from './command.js'
import { rulesOrder, rulesText } from './rules.js'
import { GAIN_VIEWS } from './runner.js'

/**
 * Normalized plugin settings produced by `normalizeConfig`/`snapshot`.
 *
 * @typedef {object} RtkSettings
 * @property {boolean} rules
 * @property {'deny' | 'off'} hook
 * @property {Set<string>} tools
 * @property {Set<string>} exclude
 * @property {number} timeoutMs
 * @property {number} maxCommandLength
 */

/** Authenticated HTTP route the Settings page reads the RTK version from. */
export const STATUS_PATH = '/rtk/status'

/** Authenticated HTTP route the Settings page reads savings through. */
export const GAIN_PATH = '/rtk/gain'

/** Authenticated HTTP route the Settings page verifies filters through. */
export const VERIFY_PATH = '/rtk/verify'

/** Authenticated HTTP route the Settings page resets savings through. */
export const RESET_PATH = '/rtk/gain/reset'

/**
 * Build the payload the Settings page reads over the status channel.
 *
 * @param {object} input
 * @param {boolean} input.available
 * @param {string | null} input.version
 * @param {RtkSettings} [input.settings]
 * @param {{ evaluated: number, rewritten: number, denied: number }} [input.stats]
 * @param {number} [input.cacheSize]
 */
export function statusView({ available, version, settings, stats, cacheSize }) {
  return {
    available: available === true,
    version: typeof version === 'string' ? version : null,
    hook: settings?.hook ?? 'deny',
    rules: settings?.rules ?? true,
    tools: settings ? [...settings.tools] : ['pwsh', 'bash'],
    exclude: settings ? [...settings.exclude] : [],
    timeoutMs: settings?.timeoutMs ?? 4000,
    stats: {
      evaluated: stats?.evaluated ?? 0,
      rewritten: stats?.rewritten ?? 0,
      denied: stats?.denied ?? 0,
    },
    cacheSize: cacheSize ?? 0,
  }
}

/**
 * Shared gate for the settings routes: browser-trust rejection, then method.
 *
 * @returns {boolean} true when the request was answered here.
 */
function gate(child, req, res, methods) {
  const rejection = child.connection.requestRejection(req)
  if (rejection !== undefined) {
    res.statusCode = rejection
    res.end()
    return true
  }
  if (!methods.includes(req.method)) {
    res.statusCode = 405
    res.setHeader('allow', methods.join(', '))
    res.end()
    return true
  }
  return false
}

/** Send a JSON payload with no-store caching. */
function json(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

/**
 * Register the rules section, the pre-execution hook, and the settings routes.
 *
 * @param {{
 *   logger?: { warn: (message: string) => void },
 *   systemPrompt: { section: (section: unknown) => unknown, getSectionOrder?: (name: string) => number | undefined },
 *   on: (event: string, listener: (exec: unknown, next: () => unknown) => unknown) => unknown,
 *   inject?: (deps: string[], callback: (child: unknown) => unknown) => unknown,
 *   fiber?: unknown,
 * }} ctx
 * @param {unknown} rawConfig Bundle row config, possibly with volatile references.
 * @param {{
 *   isAvailable: () => Promise<boolean>,
 *   getVersion?: () => Promise<string | null>,
 *   rewrite: (command: string) => Promise<string | null>,
 *   getGain?: (query?: object) => Promise<object>,
 *   verifyRtk?: () => Promise<{ ok: boolean, text: string }>,
 *   resetGain?: () => Promise<{ ok: boolean, text: string }>,
 *   cacheSize?: () => number,
 * }} runner
 */
export function mount(ctx, rawConfig, runner) {
  /** Live snapshot: the Settings page may replace a field at any moment. */
  const readSettings = () => snapshot(rawConfig)
  const initial = readSettings()

  /** Hook counters served over the status channel. */
  const stats = { evaluated: 0, rewritten: 0, denied: 0 }

  /** Probe once per activation; a missing rtk binary disables rewriting, not the plugin. */
  let availability
  const ensureAvailable = () => {
    if (availability === undefined) {
      availability = Promise.resolve()
        .then(() => runner.isAvailable())
        .catch(() => false)
        .then((ok) => {
          if (!ok) {
            ctx.logger?.warn(
              'dsh-rtk: `rtk` executable not found on PATH — install it from https://www.rtk-ai.app/; the RTK hook is inactive',
            )
          }
          return ok
        })
    }
    return availability
  }

  const readVersion = async () => {
    let version = null
    try {
      version = typeof runner.getVersion === 'function' ? await runner.getVersion() : null
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
    return { available, version }
  }

  if (initial.rules) {
    ctx.systemPrompt.section({
      name: RULES_SECTION,
      order: rulesOrder(ctx.systemPrompt),
      text: () => rulesText(readSettings()),
    })
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (child) => {
      if (ctx.fiber === undefined) return
      child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), 'rtk: own settings page')
    })

    ctx.inject(['webServer', 'connection'], (child) => {
      const routes = [
        {
          path: STATUS_PATH,
          methods: ['GET'],
          handler: async (req, res) => {
            const { available, version } = await readVersion()
            json(
              res,
              200,
              statusView({
                available,
                version,
                settings: readSettings(),
                stats,
                cacheSize: typeof runner.cacheSize === 'function' ? runner.cacheSize() : 0,
              }),
            )
          },
        },
        {
          path: GAIN_PATH,
          methods: ['GET'],
          handler: async (req, res) => {
            if (typeof runner.getGain !== 'function') {
              json(res, 501, { ok: false, error: 'gain is not supported by this runner' })
              return
            }
            const url = new URL(req.url, 'http://localhost')
            const view = url.searchParams.get('view') ?? 'summary'
            if (!GAIN_VIEWS.includes(view)) {
              json(res, 400, { ok: false, error: `unknown view (one of: ${GAIN_VIEWS.join(', ')})` })
              return
            }
            const scope = url.searchParams.get('scope') ?? 'global'
            if (scope !== 'global' && scope !== 'project') {
              json(res, 400, { ok: false, error: 'unknown scope (one of: global, project)' })
              return
            }
            try {
              json(
                res,
                200,
                await runner.getGain({
                  view,
                  project: scope === 'project',
                  projectPath: url.searchParams.get('path') ?? '',
                }),
              )
            } catch {
              json(res, 500, { ok: false, error: 'rtk gain failed' })
            }
          },
        },
        {
          path: VERIFY_PATH,
          methods: ['GET'],
          handler: async (req, res) => {
            if (typeof runner.verifyRtk !== 'function') {
              json(res, 501, { ok: false, error: 'verify is not supported by this runner' })
              return
            }
            try {
              json(res, 200, await runner.verifyRtk())
            } catch {
              json(res, 500, { ok: false, text: '' })
            }
          },
        },
        {
          path: RESET_PATH,
          methods: ['POST'],
          handler: async (req, res) => {
            if (typeof runner.resetGain !== 'function') {
              json(res, 501, { ok: false, error: 'reset is not supported by this runner' })
              return
            }
            try {
              json(res, 200, await runner.resetGain())
            } catch {
              json(res, 500, { ok: false, text: '' })
            }
          },
        },
      ]
      for (const route of routes) {
        child.effect(
          () =>
            child.webServer.register({
              kind: 'exact',
              path: route.path,
              handler: async (req, res) => {
                if (gate(child, req, res, route.methods)) return
                await route.handler(req, res)
              },
            }),
          `dsh-rtk: ${route.methods.join('/')} ${route.path}`,
        )
      }
    })
  }

  ctx.on('tools/pre-execute', async (exec, next) => {
    const settings = readSettings()
    if (settings.hook === 'off') return next()
    if (!settings.tools.has(exec.name)) return next()

    const args = exec.arguments
    const rawCommand =
      args !== null && typeof args === 'object' && typeof args.command === 'string' ? args.command : ''
    const command = rawCommand.trim()
    if (command.length === 0 || command.length > settings.maxCommandLength) return next()
    if (!hasSafeSyntax(command) || mentionsRtk(command) || isExcluded(command, settings)) return next()
    if (!(await ensureAvailable())) return next()

    stats.evaluated += 1
    /** @type {string | null} */
    let rewritten = null
    try {
      rewritten = await runner.rewrite(command)
    } catch {
      rewritten = null
    }
    if (!rewritten || exec.signal?.aborted) return next()

    stats.rewritten += 1
    stats.denied += 1
    return { kind: 'deny', reason: denyReason(command, rewritten) }
  })
}

// Re-exported for callers that pass an already-normalized config.
export { normalizeConfig }
