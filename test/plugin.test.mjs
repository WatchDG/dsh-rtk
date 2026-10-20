// Plugin wiring tests with a fake plugin context and a fake rtk client.
// No Harness and no `rtk` binary are required.
import test from 'node:test'
import assert from 'node:assert/strict'

import { RULES_SECTION } from '../lib/config.js'
import { mount } from '../lib/plugin.js'

/**
 * Build a plugin context plus a controllable rtk client.
 *
 * @param {{
 *   config?: unknown,
 *   available?: boolean,
 *   rewrite?: (command: string) => Promise<string | null>,
 * }} [options]
 */
function createHarness({ config, available = true, rewrite = async () => null } = {}) {
  const sections = []
  const listeners = new Map()
  const warnings = []
  const calls = []

  const ctx = {
    logger: { warn: (message) => warnings.push(message) },
    systemPrompt: {
      section: (section) => {
        sections.push(section)
        return () => {}
      },
      getSectionOrder: (name) => (name === 'TOOL_PWSH' ? 1010 : undefined),
    },
    on: (event, listener) => {
      listeners.set(event, listener)
      return () => {}
    },
  }

  const runner = {
    isAvailable: async () => available,
    rewrite: async (command) => {
      calls.push(command)
      return rewrite(command)
    },
  }

  mount(ctx, config ?? {}, runner)

  const hook = listeners.get('tools/pre-execute')

  const run = async (name, command, { aborted = false } = {}) => {
    const controller = new AbortController()
    if (aborted) controller.abort()
    let proceeded = false
    const decision = await hook(
      { name, arguments: { command }, signal: controller.signal },
      async () => {
        proceeded = true
        return { kind: 'allow' }
      },
    )
    return { decision, proceeded }
  }

  return { sections, listeners, warnings, calls, hook, run }
}

test('registers one rules section after the shell tools guidance', () => {
  const harness = createHarness()
  assert.equal(harness.sections.length, 1)
  assert.equal(harness.sections[0].name, RULES_SECTION)
  assert.equal(harness.sections[0].order, 1015)
  assert.match(harness.sections[0].text(), /rtk git status/)
  assert.match(harness.sections[0].text(), /RTK hook rejects/)
})

test('denies a command that rtk can rewrite', async () => {
  const harness = createHarness({
    rewrite: async (command) => (command === 'git status' ? 'rtk git status' : null),
  })
  const { decision, proceeded } = await harness.run('pwsh', 'git status')
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /rtk git status/)
  assert.equal(proceeded, false)
  assert.deepEqual(harness.calls, ['git status'])
})

test('denies a full && chain with both segments rewritten', async () => {
  const harness = createHarness({
    rewrite: async () => 'rtk git status && rtk git diff',
  })
  const { decision, proceeded } = await harness.run('pwsh', 'git status && git diff')
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /rtk git status && rtk git diff/)
  assert.equal(proceeded, false)
})

test('passes through command lines that stay raw', async () => {
  const cases = [
    ['already rtk', 'pwsh', 'rtk git status'],
    ['quoted argument', 'pwsh', 'git commit -m "fix: x"'],
    ['pipe', 'pwsh', 'git log | Select-Object -First 3'],
    ['variable', 'pwsh', 'git status $env:X'],
    ['other tool', 'read', 'git status'],
    ['no rtk filter', 'pwsh', 'Get-ChildItem'],
    ['empty command', 'pwsh', ''],
    ['overlong command', 'pwsh', `git ${'a'.repeat(4000)}`],
  ]

  const harness = createHarness({
    rewrite: async (command) => (command === 'git status' ? 'rtk git status' : null),
  })

  for (const [label, name, command] of cases) {
    const result = await harness.run(name, command)
    assert.equal(result.decision.kind, 'allow', `${label} must pass through`)
    assert.equal(result.proceeded, true, `${label} must call next()`)
  }

  assert.deepEqual(harness.calls, ['Get-ChildItem'], 'only the command without a filter reaches rtk')
})

test('passes through an excluded command head', async () => {
  const harness = createHarness({
    config: { exclude: ['make'] },
    rewrite: async () => 'rtk make build',
  })
  const { decision, proceeded } = await harness.run('pwsh', 'make build')
  assert.equal(decision.kind, 'allow')
  assert.equal(proceeded, true)
  assert.deepEqual(harness.calls, [])
})

test('passes through Windows POSIX-proxy commands when excluded', async () => {
  const harness = createHarness({ config: { exclude: ['ls'] } })
  const { decision } = await harness.run('pwsh', 'ls -la')
  assert.equal(decision.kind, 'allow')
  assert.deepEqual(harness.calls, [])
})

test('passes through when the tool arguments carry no command', async () => {
  const harness = createHarness()
  let proceeded = false
  const decision = await harness.hook({ name: 'pwsh', arguments: {}, signal: new AbortController().signal }, async () => {
    proceeded = true
    return { kind: 'allow' }
  })
  assert.equal(decision.kind, 'allow')
  assert.equal(proceeded, true)
})

test('passes through when the call is aborted', async () => {
  const harness = createHarness({
    rewrite: async () => 'rtk git status',
  })
  const { decision, proceeded } = await harness.run('pwsh', 'git status', { aborted: true })
  assert.equal(decision.kind, 'allow')
  assert.equal(proceeded, true)
})

test('passes through and warns once when rtk is unavailable', async () => {
  const harness = createHarness({ available: false, rewrite: async () => 'rtk git status' })

  for (let call = 0; call < 2; call += 1) {
    const { decision, proceeded } = await harness.run('pwsh', 'git status')
    assert.equal(decision.kind, 'allow')
    assert.equal(proceeded, true)
  }

  assert.equal(harness.warnings.length, 1)
  assert.match(harness.warnings[0], /not found/)
  assert.deepEqual(harness.calls, [], 'rtk is never invoked when the probe failed')
})

test('passes through when the rtk client throws', async () => {
  const harness = createHarness({
    rewrite: async () => {
      throw new Error('rtk exploded')
    },
  })
  const { decision, proceeded } = await harness.run('pwsh', 'git status')
  assert.equal(decision.kind, 'allow')
  assert.equal(proceeded, true)
})

test('watches only the configured shell tools', async () => {
  const harness = createHarness({
    config: { tools: ['bash'] },
    rewrite: async () => 'rtk git status',
  })

  const pwsh = await harness.run('pwsh', 'git status')
  assert.equal(pwsh.decision.kind, 'allow')

  const bash = await harness.run('bash', 'git status')
  assert.equal(bash.decision.kind, 'deny')
})

test('hook: off keeps the rules and lets every command through', async () => {
  const harness = createHarness({
    config: { hook: 'off' },
    rewrite: async () => 'rtk git status',
  })
  assert.equal(harness.sections.length, 1)
  assert.doesNotMatch(harness.sections[0].text(), /RTK hook rejects/)
  // The listener stays registered but reads config live, so flipping the
  // setting back on needs no remount.
  assert.equal(harness.listeners.has('tools/pre-execute'), true)
  const { decision, proceeded } = await harness.run('pwsh', 'git status')
  assert.equal(decision.kind, 'allow')
  assert.equal(proceeded, true)
  assert.deepEqual(harness.calls, [], 'the hook never reaches rtk while off')
})

test('rules: false keeps the hook and registers no section', () => {
  const harness = createHarness({ config: { rules: false } })
  assert.equal(harness.sections.length, 0)
  assert.equal(typeof harness.hook, 'function')
})

test('volatile config references apply without remounting', async () => {
  let hook = 'deny'
  const harness = createHarness({
    config: { hook: { get: () => hook } },
    rewrite: async () => 'rtk git status',
  })
  const denied = await harness.run('pwsh', 'git status')
  assert.equal(denied.decision.kind, 'deny')

  hook = 'off'
  const allowed = await harness.run('pwsh', 'git status')
  assert.equal(allowed.decision.kind, 'allow')
  assert.equal(allowed.proceeded, true)
})

test('the unavailable warning points at the RTK installation', async () => {
  const harness = createHarness({ available: false })
  await harness.run('pwsh', 'git status')
  assert.equal(harness.warnings.length, 1)
  assert.match(harness.warnings[0], /rtk-ai\.app/)
})
