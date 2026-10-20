// Integration tests against a real `rtk` binary.
//
// They are skipped when `rtk` is not installed, so `npm test` stays green on
// machines that only run the plugin. Install RTK (https://www.rtk-ai.app/)
// to exercise them locally.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import { normalizeConfig } from '../lib/config.js'
import { mount } from '../lib/plugin.js'
import { createRtkRunner } from '../lib/runner.js'

const probe = spawnSync('rtk', ['--version'], { encoding: 'utf8', windowsHide: true })
const skip = probe.status === 0 ? false : 'rtk is not installed; integration test skipped'

test('a real rtk binary reports available', { skip }, async () => {
  const runner = createRtkRunner({ timeoutMs: 5000 })
  assert.equal(await runner.isAvailable(), true)
})

test('a real rtk rewrite returns the rtk form', { skip }, async () => {
  const runner = createRtkRunner({ timeoutMs: 5000 })
  assert.equal(await runner.rewrite('git status'), 'rtk git status')
  assert.equal(await runner.rewrite('git status && git diff'), 'rtk git status && rtk git diff')
})

test('a missing executable reports unavailable instead of throwing', async () => {
  const runner = createRtkRunner({
    timeoutMs: 2000,
    executable: `dsh-rtk-missing-${process.pid}`,
  })
  assert.equal(await runner.isAvailable(), false)
  assert.equal(await runner.rewrite('git status'), null)
})

test('the plugin denies a raw command through the real rtk binary', { skip }, async () => {
  const listeners = new Map()
  const ctx = {
    logger: { warn: () => {} },
    systemPrompt: { section: () => () => {}, getSectionOrder: () => 1010 },
    on: (event, listener) => {
      listeners.set(event, listener)
      return () => {}
    },
  }

  mount(ctx, normalizeConfig({ timeoutMs: 5000 }), createRtkRunner({ timeoutMs: 5000 }))

  let proceeded = false
  const decision = await listeners.get('tools/pre-execute')(
    { name: 'pwsh', arguments: { command: 'git status' }, signal: new AbortController().signal },
    async () => {
      proceeded = true
      return { kind: 'allow' }
    },
  )

  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /rtk git status/)
  assert.equal(proceeded, false)
})
