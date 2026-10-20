// Status route and version probe: the Settings → RTK section reads GET /rtk/status.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { normalizeConfig } from '../lib/config.js'
import { STATUS_PATH, mount, statusView } from '../lib/plugin.js'
import { createRtkRunner } from '../lib/runner.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')

test('STATUS_PATH is the documented settings route', () => {
  assert.equal(STATUS_PATH, '/rtk/status')
})

test('statusView keeps the settings payload shape', () => {
  assert.deepEqual(statusView({ available: true, version: 'rtk 0.50.0' }), {
    available: true,
    version: 'rtk 0.50.0',
  })
  assert.deepEqual(statusView({ available: false, version: null }), {
    available: false,
    version: null,
  })
  assert.deepEqual(statusView({ available: true, version: 42 }), {
    available: true,
    version: null,
  })
})

test('a missing executable reports no version instead of throwing', async () => {
  const runner = createRtkRunner({
    timeoutMs: 2000,
    executable: `dsh-rtk-missing-${process.pid}`,
  })
  assert.equal(await runner.getVersion(), null)
  assert.equal(await runner.isAvailable(), false)
})

/**
 * Mount with a fake context that captures the webServer registration.
 */
function mountStatus({ runner, rejection } = {}) {
  let route
  const ctx = {
    logger: { warn: () => {} },
    systemPrompt: { section: () => () => {}, getSectionOrder: () => 1010 },
    on: () => () => {},
    inject(deps, callback) {
      if (deps[0] === 'webServer') {
        callback({
          effect: (fn) => fn(),
          connection: { requestRejection: () => rejection },
          webServer: {
            register(registered) {
              route = registered
              return () => {}
            },
          },
        })
      }
    },
  }
  mount(
    ctx,
    normalizeConfig({}),
    runner ?? { isAvailable: async () => true, getVersion: async () => 'rtk 0.50.0' },
  )
  return { route }
}

async function exchange(route, { method = 'GET' } = {}) {
  let statusCode = 0
  let headers = {}
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
      headers = { ...headers, ...nextHeaders }
    },
    end(text) {
      body = text ?? ''
    },
  }
  await route.handler({ method, headers: {} }, res)
  return { statusCode, headers, body }
}

test('the status route answers the settings page', async () => {
  const { route } = mountStatus({})
  assert.equal(route.kind, 'exact')
  assert.equal(route.path, '/rtk/status')

  const ok = await exchange(route)
  assert.equal(ok.statusCode, 200)
  assert.match(ok.headers['content-type'], /application\/json/)
  assert.deepEqual(JSON.parse(ok.body), { available: true, version: 'rtk 0.50.0' })

  const wrongMethod = await exchange(route, { method: 'POST' })
  assert.equal(wrongMethod.statusCode, 405)
})

test('the status route reports a missing binary', async () => {
  const { route } = mountStatus({
    runner: { isAvailable: async () => false, getVersion: async () => null },
  })
  const ok = await exchange(route)
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(JSON.parse(ok.body), { available: false, version: null })
})

test('the status route tolerates a legacy runner without getVersion', async () => {
  const { route } = mountStatus({ runner: { isAvailable: async () => true } })
  const ok = await exchange(route)
  assert.equal(ok.statusCode, 200)
  assert.deepEqual(JSON.parse(ok.body), { available: true, version: null })
})

test('the status route refuses rejected browser callers', async () => {
  const { route } = mountStatus({})
  const rejected = await (async () => {
    let statusCode = 0
    let body = 'unset'
    const res = {
      set statusCode(value) {
        statusCode = value
      },
      setHeader() {},
      writeHead(code) {
        statusCode = code
      },
      end(text) {
        body = text ?? ''
      },
    }
    await route.handler({ method: 'GET', headers: {} }, res)
    return { statusCode, body }
  })()
  assert.equal(rejected.statusCode, 200)

  const withRejection = (() => {
    let captured
    const ctx = {
      logger: { warn: () => {} },
      systemPrompt: { section: () => () => {}, getSectionOrder: () => 1010 },
      on: () => () => {},
      inject(deps, callback) {
        if (deps[0] === 'webServer') {
          callback({
            effect: (fn) => fn(),
            connection: { requestRejection: () => 403 },
            webServer: {
              register(registered) {
                captured = registered
                return () => {}
              },
            },
          })
        }
      },
    }
    mount(ctx, normalizeConfig({}), { isAvailable: async () => true, getVersion: async () => 'rtk 0.50.0' })
    return captured
  })()
  let statusCode = 0
  await withRejection.handler(
    { method: 'GET', headers: {} },
    {
      set statusCode(value) {
        statusCode = value
      },
      setHeader() {},
      writeHead(code) {
        statusCode = code
      },
      end() {},
    },
  )
  assert.equal(statusCode, 403)
})

test('mount works without a webServer scope (legacy fake contexts)', () => {
  const ctx = {
    logger: { warn: () => {} },
    systemPrompt: { section: () => () => {}, getSectionOrder: () => 1010 },
    on: () => () => {},
  }
  mount(ctx, normalizeConfig({}), { isAvailable: async () => true, getVersion: async () => 'rtk 0.50.0' })
})

test('the web client registers a Settings section that reads /rtk/status', () => {
  const client = read('client.js')
  assert.match(client, /id:\s*['"]dsh-rtk['"]/)
  assert.match(client, /settings\.section/)
  assert.match(client, /\/rtk\/status/)
  assert.match(client, /settings\.rtk/)
})
