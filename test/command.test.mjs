// Unit tests for configuration, command analysis, and prompt rules.
// These tests start no processes, so they run everywhere, including CI
// machines without RTK installed.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  Config,
  DEFAULT_MAX_COMMAND_LENGTH,
  DEFAULT_TIMEOUT_MS,
  RULES_SECTION,
  normalizeConfig,
  snapshot,
} from '../lib/config.js'
import {
  denyReason,
  hasSafeSyntax,
  isExcluded,
  mentionsRtk,
  normalizeRewritten,
} from '../lib/command.js'
import { rulesOrder, rulesText } from '../lib/rules.js'

test('RULES_SECTION is the documented section name', () => {
  assert.equal(RULES_SECTION, 'rtk:rules')
})

test('normalizeConfig applies defaults', () => {
  const config = normalizeConfig(undefined)
  assert.equal(config.rules, true)
  assert.equal(config.hook, 'deny')
  assert.deepEqual([...config.tools], ['pwsh', 'bash'])
  assert.equal(config.timeoutMs, DEFAULT_TIMEOUT_MS)
  assert.equal(config.maxCommandLength, DEFAULT_MAX_COMMAND_LENGTH)
  if (process.platform === 'win32') {
    assert.ok(config.exclude.has('ls'), 'POSIX proxy commands are excluded on win32')
  } else {
    assert.equal(config.exclude.size, 0)
  }
})

test('normalizeConfig tolerates non-object values', () => {
  for (const raw of [null, 42, 'config', []]) {
    const config = normalizeConfig(raw)
    assert.equal(config.hook, 'deny')
    assert.equal(config.rules, true)
  }
})

test('normalizeConfig reads every documented field', () => {
  const config = normalizeConfig({
    rules: false,
    hook: 'off',
    tools: ['bash', 42],
    exclude: ['MAKE', 7],
    timeoutMs: 999_999,
  })
  assert.equal(config.rules, false)
  assert.equal(config.hook, 'off')
  assert.deepEqual([...config.tools], ['bash'])
  assert.ok(config.exclude.has('make'), 'exclude heads are lowercased')
  assert.equal(config.timeoutMs, 60_000, 'timeout is capped at 60 s')
})

test('normalizeConfig falls back for invalid tools and timeouts', () => {
  const emptyTools = normalizeConfig({ tools: [] })
  assert.deepEqual([...emptyTools.tools], ['pwsh', 'bash'])

  const invalidTools = normalizeConfig({ tools: [42, null] })
  assert.deepEqual([...invalidTools.tools], ['pwsh', 'bash'])

  for (const timeoutMs of [0, -1, Number.NaN, '4000']) {
    assert.equal(normalizeConfig({ timeoutMs }).timeoutMs, DEFAULT_TIMEOUT_MS)
  }
})

test('normalizeRewritten keeps the first usable rtk line', () => {
  assert.equal(normalizeRewritten('rtk git status\n', 'git status'), 'rtk git status')
  assert.equal(normalizeRewritten('\n  rtk git log -5  \nnoise', 'git log -5'), 'rtk git log -5')
  assert.equal(normalizeRewritten('rtk.exe git status', 'git status'), 'rtk.exe git status')
  assert.equal(normalizeRewritten('RTK git status', 'git status'), 'RTK git status')
})

test('normalizeRewritten rejects answers that are not a rewrite', () => {
  assert.equal(normalizeRewritten('', 'git status'), null)
  assert.equal(normalizeRewritten(undefined, 'git status'), null)
  assert.equal(normalizeRewritten('git status', 'git status'), null)
  assert.equal(normalizeRewritten('rtk git status', 'rtk git status'), null)
  assert.equal(normalizeRewritten('rtkfoo git status', 'git status'), null)
  assert.equal(normalizeRewritten('rtk', 'git status'), null, 'the rtk word alone has no arguments')
})

test('hasSafeSyntax accepts plain commands and && chains', () => {
  for (const command of ['git status', 'git status && git diff', 'cargo test -p app', 'rtk gain']) {
    assert.equal(hasSafeSyntax(command), true, command)
  }
})

test('hasSafeSyntax rejects syntax rtk does not reproduce faithfully', () => {
  const unsafe = [
    'git commit -m "fix: x"',
    "git commit -m 'fix: x'",
    'git log | head',
    'git status > out',
    'cat < in',
    'git status; git diff',
    'echo `date`',
    'git status $env:X',
    'echo %PATH%',
    'echo hi!',
    'echo @file',
    '$(Get-Date)',
    'echo (x)',
    'echo {x}',
    'echo ~',
    'git status &',
    'git status\r\nls',
  ]
  for (const command of unsafe) {
    assert.equal(hasSafeSyntax(command), false, command)
  }
})

test('mentionsRtk detects rtk at the head of any && segment', () => {
  for (const command of ['rtk', 'rtk git status', 'RTK.EXE status', '& rtk git status', 'git status && rtk diff']) {
    assert.equal(mentionsRtk(command), true, command)
  }
  for (const command of ['git status', 'git rtk status', 'rtkfoo status', 'rtkx']) {
    assert.equal(mentionsRtk(command), false, command)
  }
})

test('isExcluded matches command heads, paths, and .exe suffixes', () => {
  const config = { exclude: new Set(['make']) }
  for (const command of ['make', 'make build', 'MAKE build', 'C:\\tools\\make.exe build', 'git status && make build']) {
    assert.equal(isExcluded(command, config), true, command)
  }
  for (const command of ['makefile build', 'msbuild', 'git status']) {
    assert.equal(isExcluded(command, config), false, command)
  }
})

test('denyReason names the original command, the rewrite, and the escape hatch', () => {
  const reason = denyReason('git status', 'rtk git status')
  assert.match(reason, /`git status`/)
  assert.match(reason, /`rtk git status`/)
  assert.match(reason, /rtk proxy git status/)
})

test('rulesText describes rules and the hook mode', () => {
  const deny = rulesText({ hook: 'deny' })
  assert.match(deny, /^## RTK terminal output/)
  assert.match(deny, /rtk git status/)
  assert.match(deny, /rtk rewrite/)
  assert.match(deny, /rtk recall/)
  assert.match(deny, /rtk gain/)
  assert.match(deny, /rtk gain --project/)
  assert.match(deny, /Settings → RTK/)
  assert.match(deny, /rtk-ai\.app/)
  assert.match(deny, /RTK hook rejects/)

  const off = rulesText({ hook: 'off' })
  assert.match(off, /rtk git status/)
  assert.doesNotMatch(off, /RTK hook rejects/)
})

test('rulesOrder follows the shell tools guidance with a fallback', () => {  assert.equal(rulesOrder({ getSectionOrder: (name) => (name === 'TOOL_PWSH' ? 1010 : undefined) }), 1015)
  assert.equal(rulesOrder({ getSectionOrder: () => undefined }), 1015)
  assert.equal(rulesOrder({ getSectionOrder: () => Number.NaN }), 1015)
  assert.equal(rulesOrder({}), 1015)
  assert.equal(rulesOrder(undefined), 1015)
  assert.equal(rulesOrder({ getSectionOrder: () => 0 }), 5)
})

test('Config exposes five volatile fields with defaults', () => {
  assert.equal(Config.type, 'object')
  assert.deepEqual(Object.keys(Config.dict).sort(), ['exclude', 'hook', 'rules', 'timeoutMs', 'tools'])
  for (const field of ['rules', 'hook', 'tools', 'exclude', 'timeoutMs']) {
    assert.equal(Config.dict[field].meta.volatile, true, `${field} is volatile`)
  }
})

test('snapshot unwraps volatile references and tolerates plain values', () => {
  let hook = 'off'
  const live = snapshot({ hook: { get: () => hook }, tools: ['bash'] })
  assert.equal(live.hook, 'off')
  assert.deepEqual([...live.tools], ['bash'])
  hook = 'deny'
  assert.equal(snapshot({ hook: { get: () => hook } }).hook, 'deny')
  assert.equal(snapshot(undefined).hook, 'deny')
})

test('snapshot round-trips an already-normalized config', () => {
  const once = normalizeConfig({ tools: ['bash'], exclude: ['MAKE'] })
  const twice = snapshot(once)
  assert.deepEqual([...twice.tools], ['bash'])
  assert.ok(twice.exclude.has('make'))
})
