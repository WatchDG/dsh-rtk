// Settings routes: the Settings → RTK section reads status, gain, verify,
// and reset over authenticated Host routes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  GAIN_PATH,
  RESET_PATH,
  STATUS_PATH,
  VERIFY_PATH,
  mount,
  statusView,
} from '../lib/plugin.js'
import { GAIN_VIEWS, createRtkRunner } from '../lib/runner.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')

/** Fake runner with controllable answers for every boundary. */
function makeRunner(overrides = {}) {
  return {
    isAvailable: async () => true,
    getVersion: async () => 'rtk 0.50.0',
    rewrite: async () => null,
    getGain: async () => ({ ok: true, kind: 'json', data: { summary: { total_commands: 7 } } }),
    verifyRtk: async () => ({ ok: true, text: '154/154 tests passed' }),
    resetGain: async () => ({ ok: true, text: 'reset done' }),
    cacheSize: () => 3,
    ...overrides,
  }
}

/**
 * Mount with a fake context that captures every registered route and the
 * pre-execute hook.
 */
function mountRoutes({ config = {}, runner = makeRunner(), rejection } = {}) {
  const routes = new Map()
  const listeners = new Map()
  const sections = []
  const settingsCalls = []
  const ctx = {
    logger: { warn: () => {} },
    fiber: {},
    systemPrompt: {
      section: (section) => {
        sections.push(section)
        return () => {}
      },
      getSectionOrder: () => 1010,
    },
    on: (event, listener) => {
      listeners.set(event, listener)
      return () => {}
    },
    inject(deps, callback) {
      if (deps[0] === 'settings') {
        settingsCalls.push(deps)
        callback({
          effect: (fn) => fn(),
          settings: { configure: () => {} },
        })
      } else if (deps[0] === 'webServer') {
        callback({
          effect: (fn) => fn(),
          connection: { requestRejection: () => rejection },
          webServer: {
            register(registered) {
              routes.set(registered.path, registered)
              return () => {}
            },
          },
        })
      }
    },
  }
  mount(ctx, config, runner)
  return { routes, listeners, sections, settingsCalls }
}

async function exchange(route, { method = 'GET', url = '/' } = {}) {
  let statusCode = 0
  const headers = {}
  let body = ''
  const res = {
    set statusCode(value) {
      statusCode = value
    },
    setHeader(name, value) {
      headers[name] = value
    },
    writeHead(code, nextHeaders) {
      statusCode = code
      Object.assign(headers, nextHeaders)
    },
    end(text) {
      body = text ?? ''
    },
  }
  await route.handler({ method, url, headers: {} }, res)
  return { statusCode, headers, body: body ? JSON.parse(body) : body }
}

test('route paths are the documented settings channels', () => {
  assert.equal(STATUS_PATH, '/rtk/status')
  assert.equal(GAIN_PATH, '/rtk/gain')
  assert.equal(VERIFY_PATH, '/rtk/verify')
  assert.equal(RESET_PATH, '/rtk/gain/reset')
  assert.ok(GAIN_VIEWS.includes('summary'))
  assert.ok(GAIN_VIEWS.includes('failures'))
})

test('statusView keeps the extended settings payload shape', () => {
  const full = statusView({
    available: true,
    version: 'rtk 0.50.0',
    settings: {
      hook: 'off',
      rules: true,
      tools: new Set(['bash']),
      exclude: new Set(['make']),
      timeoutMs: 5000,
    },
    stats: { evaluated: 2, rewritten: 1, denied: 1, byHead: { docker: 1, git: 2, cargo: 1 } },
    cacheSize: 4,
  })
  assert.deepEqual(full, {
    available: true,
    version: 'rtk 0.50.0',
    hook: 'off',
    rules: true,
    tools: ['bash'],
    exclude: ['make'],
    timeoutMs: 5000,
    stats: {
      evaluated: 2,
      rewritten: 1,
      denied: 1,
      topHeads: [
        ['git', 2],
        ['docker', 1],
        ['cargo', 1],
      ],
    },
    cacheSize: 4,
  })
  assert.deepEqual(statusView({ available: false, version: 42 }), {
    available: false,
    version: null,
    hook: 'deny',
    rules: true,
    tools: ['pwsh', 'bash'],
    exclude: [],
    timeoutMs: 4000,
    stats: { evaluated: 0, rewritten: 0, denied: 0, topHeads: [] },
    cacheSize: 0,
  })
})

test('a missing executable reports no version instead of throwing', async () => {
  const runner = createRtkRunner({
    timeoutMs: 2000,
    executable: `dsh-rtk-missing-${process.pid}`,
  })
  assert.equal(await runner.getVersion(), null)
  assert.equal(await runner.isAvailable(), false)
  assert.deepEqual(await runner.getGain(), { ok: false })
  assert.deepEqual(await runner.verifyRtk(), { ok: false, text: '' })
})

test('the status route answers the settings page', async () => {
  const { routes } = mountRoutes({})
  const route = routes.get('/rtk/status')
  assert.equal(route.kind, 'exact')

  const ok = await exchange(route)
  assert.equal(ok.statusCode, 200)
  assert.match(ok.headers['content-type'], /application\/json/)
  assert.equal(ok.body.available, true)
  assert.equal(ok.body.version, 'rtk 0.50.0')
  assert.equal(ok.body.hook, 'deny')
  assert.deepEqual(ok.body.tools, ['pwsh', 'bash'])
  assert.deepEqual(ok.body.stats, { evaluated: 0, rewritten: 0, denied: 0, topHeads: [] })
  assert.equal(ok.body.cacheSize, 3)
})

test('hook counters grow on the status channel', async () => {
  const { routes, listeners } = mountRoutes({
    runner: makeRunner({ rewrite: async () => 'rtk git status' }),
  })
  const hook = listeners.get('tools/pre-execute')
  let proceeded = false
  const decision = await hook(
    { name: 'pwsh', arguments: { command: 'git status' }, signal: new AbortController().signal },
    async () => {
      proceeded = true
      return { kind: 'allow' }
    },
  )
  assert.equal(decision.kind, 'deny')
  assert.equal(proceeded, false)

  const ok = await exchange(routes.get('/rtk/status'))
  assert.deepEqual(ok.body.stats, { evaluated: 1, rewritten: 1, denied: 1, topHeads: [['git', 1]] })
})

test('top rewritten heads are ranked on the status channel', async () => {
  const { routes, listeners } = mountRoutes({
    runner: makeRunner({
      rewrite: async (command) => (command.startsWith('git') ? 'rtk git status' : `rtk ${command}`),
    }),
  })
  const hook = listeners.get('tools/pre-execute')
  const run = (command) =>
    hook(
      { name: 'pwsh', arguments: { command }, signal: new AbortController().signal },
      async () => ({ kind: 'allow' }),
    )
  await run('git status')
  await run('docker ps')
  await run('git diff')
  await run('git status')

  const ok = await exchange(routes.get('/rtk/status'))
  assert.deepEqual(ok.body.stats.topHeads, [
    ['git', 3],
    ['docker', 1],
  ])
})

test('the gain route serves summary JSON', async () => {
  const seen = []
  const { routes } = mountRoutes({
    runner: makeRunner({
      getGain: async (query) => {
        seen.push(query)
        return { ok: true, kind: 'json', data: { summary: { total_commands: 7 } } }
      },
    }),
  })
  const ok = await exchange(routes.get('/rtk/gain'), { url: '/rtk/gain?view=summary&scope=global' })
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(ok.body, { ok: true, kind: 'json', data: { summary: { total_commands: 7 } } })
  assert.deepEqual(seen, [{ view: 'summary', project: false, projectPath: '' }])
})

test('the gain route forwards project scope and text views', async () => {
  const seen = []
  const { routes } = mountRoutes({
    runner: makeRunner({
      getGain: async (query) => {
        seen.push(query)
        return { ok: true, kind: 'text', text: 'daily table' }
      },
    }),
  })
  const ok = await exchange(routes.get('/rtk/gain'), {
    url: '/rtk/gain?view=daily&scope=project&path=F%3A%5Cproj',
  })
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.body.text, 'daily table')
  assert.deepEqual(seen, [{ view: 'daily', project: true, projectPath: 'F:\\proj' }])
})

test('the gain route rejects unknown views and scopes', async () => {
  const { routes } = mountRoutes({})
  const badView = await exchange(routes.get('/rtk/gain'), { url: '/rtk/gain?view=nope' })
  assert.equal(badView.statusCode, 400)
  const badScope = await exchange(routes.get('/rtk/gain'), { url: '/rtk/gain?view=top&scope=nope' })
  assert.equal(badScope.statusCode, 400)
})

test('the gain route reports a missing boundary as 501', async () => {
  const { routes } = mountRoutes({ runner: { isAvailable: async () => true, rewrite: async () => null } })
  const ok = await exchange(routes.get('/rtk/gain'), { url: '/rtk/gain' })
  assert.equal(ok.statusCode, 501)
})

test('the verify route serves the filter check', async () => {
  const { routes } = mountRoutes({})
  const ok = await exchange(routes.get('/rtk/verify'))
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(ok.body, { ok: true, text: '154/154 tests passed' })
})

test('the reset route requires POST and serves the reset', async () => {
  const { routes } = mountRoutes({})
  const wrongMethod = await exchange(routes.get('/rtk/gain/reset'), { method: 'GET' })
  assert.equal(wrongMethod.statusCode, 405)
  const ok = await exchange(routes.get('/rtk/gain/reset'), { method: 'POST' })
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(ok.body, { ok: true, text: 'reset done' })
})

test('settings routes refuse rejected browser callers', async () => {
  const { routes } = mountRoutes({ rejection: 403 })
  for (const route of routes.values()) {
    const refused = await exchange(route, { method: route.path === RESET_PATH ? 'POST' : 'GET' })
    assert.equal(refused.statusCode, 403)
  }
})

test('the plugin owns its settings page instead of a generic form', () => {
  const { settingsCalls, sections } = mountRoutes({})
  assert.deepEqual(settingsCalls, [['settings']])
  assert.equal(sections.length, 1)
})

test('mount works without a webServer scope (legacy fake contexts)', () => {
  const ctx = {
    logger: { warn: () => {} },
    systemPrompt: { section: () => () => {}, getSectionOrder: () => 1010 },
    on: () => () => {},
  }
  mount(ctx, {}, makeRunner())
})

test('the web client registers savings, config, and diagnostics', () => {
  const client = read('client.js')
  assert.match(client, /id:\s*['"]dsh-rtk['"]/)
  assert.match(client, /settings\.section/)
  assert.match(client, /\/rtk\/status/)
  assert.match(client, /\/rtk\/gain/)
  assert.match(client, /\/rtk\/verify/)
  assert.match(client, /\/rtk\/gain\/reset/)
  assert.match(client, /topHeads|topHeadsLabel/)
  assert.match(client, /copyYaml|Copy patch YAML/)
  assert.match(client, /resetDefaults|Reset to defaults/)
  assert.match(client, /view\.graph|Daily graph/)
  assert.match(client, /configForms/)
  assert.match(client, /savingsTitle|Token savings/)
  assert.match(client, /verifyRun|Run verify/)
})
