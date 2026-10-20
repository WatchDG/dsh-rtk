/**
 * dsh-rtk — RTK (Rust Token Killer) integration for DeepSeek Harness.
 *
 * Two contributions, both owned by this plugin's context:
 *
 * 1. **Rules** — one system-prompt section (`rtk:rules`) placed right after
 *    the shell tools' guidance: which commands go through `rtk`, how to find
 *    an equivalent with `rtk rewrite`, why file work stays with the harness
 *    file tools, and how to recover output rtk elided.
 * 2. **Hook** — a `tools/pre-execute` listener on the shell tools. For a
 *    command line that has an rtk form, it denies the call and returns the
 *    exact rewritten command as the reason, so the model re-runs it through
 *    rtk. `rtk rewrite` is the single source of truth for the mapping, so the
 *    plugin stays correct as rtk learns new filters.
 *
 * Why deny instead of rewrite: `ToolExecution.arguments` is immutable in the
 * dispatch contract (`tools/execute` wrappers may change only `exec.signal`),
 * so no listener can replace a command before the shell sees it. A denial is
 * the only way to route a command through rtk proactively.
 *
 * Config (all optional, read from the bundle row):
 *
 *   rules       boolean            register the prompt section (default true)
 *   hook        'deny' | 'off'     pre-execution behavior (default 'deny')
 *   tools       string[]           shell tools to watch (default [pwsh, bash])
 *   exclude     string[]           extra command heads never rewritten
 *   timeoutMs   number             per `rtk` invocation (default 4000)
 *
 * `rtk` is an external prerequisite: the user installs it (https://www.rtk-ai.app/)
 * and it must be on PATH. This plugin does not install or bundle it.
 */

import { normalizeConfig } from './lib/config.js'
import { mount } from './lib/plugin.js'
import { createRtkRunner } from './lib/runner.js'

/**
 * Activate the plugin for one profile context.
 *
 * @param {object} ctx Plugin context supplied by the DSH loader.
 * @param {unknown} config Bundle row config.
 */
export function apply(ctx, config) {
  const settings = normalizeConfig(config)
  mount(ctx, settings, createRtkRunner({ timeoutMs: settings.timeoutMs }))
}

export const name = 'rtk'
export const inject = ['systemPrompt']
