window.__ModuleLoader__.load({
  id: 'dsh-rtk',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'settings.rtk'
    /** Host Loader row id; the settings namespace is the row's patch id. */
    const HOST_ENTRY = 'rtk'
    /** Tolerate a Loader that namespaces the inserted row. */
    const NAMESPACES = [HOST_ENTRY, `include:${HOST_ENTRY}`, 'dsh-rtk']

    /** Authenticated Host routes registered by lib/plugin.js. */
    const STATUS_PATH = '/rtk/status'
    const GAIN_PATH = '/rtk/gain'
    const VERIFY_PATH = '/rtk/verify'
    const RESET_PATH = '/rtk/gain/reset'

    const GAIN_VIEWS = ['summary', 'top', 'history', 'daily', 'weekly', 'monthly', 'recalls', 'failures']

    /** English copy. */
    const en = {
      nav: 'RTK',
      title: 'RTK version',
      intro:
        'The plugin uses the external RTK binary installed on this Host. The version below is read live with `rtk --version`. The savings dashboard is read the same way, so it works even when `rtk gain` fails inside a sandboxed session.',
      versionLabel: 'Installed version',
      loading: 'Checking RTK…',
      loadFailed: 'Could not check the RTK version right now.',
      available: 'RTK is available on PATH.',
      notInstalled: 'RTK is not found on PATH.',
      installHint: 'Install it from https://www.rtk-ai.app/ , then open a new shell (or restart DSH) so PATH is refreshed.',
      refresh: 'Recheck',
      note: 'Full savings stay in the terminal: run `rtk gain` there. Statistics are global to RTK, not specific to this plugin.',
      savingsTitle: 'Token savings',
      savingsIntro: 'Read from the Host tracking database. Switch scope to see one project, pick a breakdown below.',
      scopeLabel: 'Scope',
      scopeGlobal: 'Global',
      scopeProject: 'Project',
      projectPathLabel: 'Project directory',
      projectPathHint: 'Empty means the Host working directory. Point it at a project to filter its statistics.',
      viewLabel: 'Breakdown',
      'view.summary': 'Summary',
      'view.top': 'Top commands',
      'view.history': 'History',
      'view.daily': 'Daily',
      'view.weekly': 'Weekly',
      'view.monthly': 'Monthly',
      'view.recalls': 'Recall efficiency',
      'view.failures': 'Parse failures',
      gainLoading: 'Loading savings…',
      gainFailed: 'Could not load savings.',
      gainEmpty: 'No statistics yet — run some commands through rtk first.',
      statCommands: 'Commands',
      statInput: 'Input tokens',
      statOutput: 'Output tokens',
      statSaved: 'Tokens saved',
      statRate: 'Savings rate',
      statTime: 'Total time',
      resetLabel: 'Reset statistics',
      resetHint: 'Zeroes token savings and recall stats for every project. This cannot be undone.',
      resetArm: 'Click again to confirm reset',
      resetDone: 'Statistics were reset.',
      resetFailed: 'Reset was rejected.',
      configTitle: 'Behavior',
      configIntro: 'Applies immediately, without a restart. The prompt rules section itself is registered once when the plugin loads.',
      hookLabel: 'Pre-execution hook',
      hookHint: '“Deny” reroutes raw commands through their rtk form; “Off” keeps only the prompt rules.',
      'hook.deny': 'Deny raw commands with an rtk form',
      'hook.off': 'Off (rules only)',
      rulesLabel: 'Prompt rules',
      rulesHint: 'Register the `rtk:rules` section in the system prompt.',
      rulesOn: 'Enabled',
      toolsLabel: 'Watched shell tools',
      toolsHint: 'Comma-separated tool names, e.g. pwsh, bash.',
      excludeLabel: 'Excluded command heads',
      excludeHint: 'Comma-separated heads that never rewrite, e.g. make, msbuild.',
      timeoutLabel: 'RTK timeout (ms)',
      timeoutHint: 'Per-invocation timeout, capped at 60000.',
      applying: 'Applying…',
      applied: 'Applied.',
      failed: 'The Host did not accept this value; the selection was left unchanged.',
      readonly: 'This profile stores settings read-only.',
      unavailable: 'This plugin’s configuration is not served by the Host.',
      diagTitle: 'Diagnostics',
      diagIntro: 'Hook state on this Host and a one-click filter check.',
      hookStateLabel: 'Hook',
      stateActive: 'active — raw commands are rerouted',
      stateOff: 'off by configuration',
      stateInactive: 'inactive — RTK binary not found',
      countersLabel: 'This activation',
      countersEvaluated: 'checked',
      countersRewritten: 'rewritten',
      countersDenied: 'denied',
      cacheLabel: 'rewrite cache',
      cacheEntries: 'entries',
      verifyLabel: 'Filter check',
      verifyHint: 'Runs `rtk verify`: hook integrity and filter inline tests.',
      verifyRun: 'Run verify',
      verifyLoading: 'Verifying…',
      verifyFailed: 'Verify did not pass.',
      verifyPassed: 'Verify passed.',
    }

    /** Russian copy. */
    const ru = {
      nav: 'RTK',
      title: 'Версия RTK',
      intro:
        'Плагин использует внешний бинарник RTK, установленный на этом хосте. Версия ниже запрашивается вживую через `rtk --version`. Панель экономии читается так же, поэтому работает, даже когда `rtk gain` падает внутри песочницы сессии.',
      versionLabel: 'Установленная версия',
      loading: 'Проверяю RTK…',
      loadFailed: 'Не удалось проверить версию RTK.',
      available: 'RTK найден в PATH.',
      notInstalled: 'RTK не найден в PATH.',
      installHint: 'Установите его с https://www.rtk-ai.app/ , затем откройте новый шелл (или перезапустите DSH), чтобы обновился PATH.',
      refresh: 'Проверить снова',
      note: 'Полная статистика остаётся в терминале: выполните там `rtk gain`. Статистика общая для RTK, а не только для этого плагина.',
      savingsTitle: 'Экономия токенов',
      savingsIntro: 'Читается из базы трекинга хоста. Переключите охват на проект и выберите разбивку ниже.',
      scopeLabel: 'Охват',
      scopeGlobal: 'Глобально',
      scopeProject: 'Проект',
      projectPathLabel: 'Каталог проекта',
      projectPathHint: 'Пусто — рабочий каталог хоста. Укажите проект, чтобы отфильтровать его статистику.',
      viewLabel: 'Разбивка',
      'view.summary': 'Сводка',
      'view.top': 'Топ команд',
      'view.history': 'История',
      'view.daily': 'По дням',
      'view.weekly': 'По неделям',
      'view.monthly': 'По месяцам',
      'view.recalls': 'Эффективность recall',
      'view.failures': 'Ошибки парсинга',
      gainLoading: 'Загружаю экономию…',
      gainFailed: 'Не удалось загрузить экономию.',
      gainEmpty: 'Статистики пока нет — сначала выполните команды через rtk.',
      statCommands: 'Команд',
      statInput: 'Входных токенов',
      statOutput: 'Выходных токенов',
      statSaved: 'Сэкономлено',
      statRate: 'Доля экономии',
      statTime: 'Общее время',
      resetLabel: 'Сбросить статистику',
      resetHint: 'Обнуляет экономию и recall-статистику для всех проектов. Отменить нельзя.',
      resetArm: 'Нажмите ещё раз для подтверждения сброса',
      resetDone: 'Статистика сброшена.',
      resetFailed: 'Сброс отклонён.',
      configTitle: 'Поведение',
      configIntro: 'Применяется сразу, без перезапуска. Сама секция правил регистрируется один раз при загрузке плагина.',
      hookLabel: 'Хук перед выполнением',
      hookHint: '«Deny» проводит сырые команды через rtk-форму; «Off» оставляет только правила в промпте.',
      'hook.deny': 'Отклонять сырые команды с rtk-формой',
      'hook.off': 'Выкл (только правила)',
      rulesLabel: 'Правила в промпте',
      rulesHint: 'Регистрировать секцию `rtk:rules` в системном промпте.',
      rulesOn: 'Включены',
      toolsLabel: 'Отслеживаемые шеллы',
      toolsHint: 'Имена инструментов через запятую, например pwsh, bash.',
      excludeLabel: 'Исключённые команды',
      excludeHint: '«Головы» команд через запятую, которые не переписываются, например make, msbuild.',
      timeoutLabel: 'Таймаут RTK (мс)',
      timeoutHint: 'Таймаут одного вызова, не больше 60000.',
      applying: 'Применяю…',
      applied: 'Применено.',
      failed: 'Хост не принял значение; выбор остался прежним.',
      readonly: 'В этом профиле настройки доступны только для чтения.',
      unavailable: 'Хост не отдаёт конфигурацию этого плагина.',
      diagTitle: 'Диагностика',
      diagIntro: 'Состояние хука на этом хосте и проверка фильтров в один клик.',
      hookStateLabel: 'Хук',
      stateActive: 'активен — сырые команды проводятся через rtk',
      stateOff: 'выключен настройкой',
      stateInactive: 'неактивен — бинарник RTK не найден',
      countersLabel: 'За эту загрузку',
      countersEvaluated: 'проверено',
      countersRewritten: 'переписано',
      countersDenied: 'отклонено',
      cacheLabel: 'кэш rewrite',
      cacheEntries: 'записей',
      verifyLabel: 'Проверка фильтров',
      verifyHint: 'Запускает `rtk verify`: целостность хука и встроенные тесты фильтров.',
      verifyRun: 'Проверить',
      verifyLoading: 'Проверяю…',
      verifyFailed: 'Проверка не пройдена.',
      verifyPassed: 'Проверка пройдена.',
    }

    /** Page-local styles; tokens only, so light/dark follows the host theme. */
    const CSS = `
.rtk-section{display:flex;flex-direction:column;gap:20px;width:100%;max-width:640px;padding:4px 0 24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}
.rtk-title{margin:0;font-size:16px;font-weight:600}
.rtk-sub{margin:24px 0 0;padding-top:16px;border-top:.5px solid var(--dsw-alias-border-l1);font-size:16px;font-weight:600}
.rtk-intro{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:19px}
.rtk-card{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:18px}
.rtk-version{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}
.rtk-version code{font-family:var(--dsw-font-mono,monospace)}
.rtk-status{color:var(--dsw-alias-label-secondary)}
.rtk-error{color:var(--dsw-alias-state-error-primary)}
.rtk-row{display:flex;flex-direction:column;gap:6px}
.rtk-label{font-size:13px;font-weight:500}
.rtk-input,.rtk-select{height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit}
.rtk-input:focus-visible,.rtk-select:focus-visible,.rtk-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.rtk-input:disabled,.rtk-select:disabled{color:var(--dsw-alias-label-secondary);cursor:not-allowed}
.rtk-check{display:flex;align-items:center;gap:8px;font-size:13px}
.rtk-check input{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary)}
.rtk-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.rtk-actions{display:flex;gap:8px;flex-wrap:wrap}
.rtk-button{height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer}
.rtk-button:disabled{color:var(--dsw-alias-label-secondary);cursor:not-allowed}
.rtk-button.danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.rtk-note{margin:4px 0 0;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.rtk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.rtk-stat{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.rtk-stat b{font-size:15px;font-weight:600}
.rtk-stat span{font-size:11px;color:var(--dsw-alias-label-secondary)}
.rtk-pre{margin:0;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:16px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto}
`

    /** Compact token count: 1659155 -> "1.7M". */
    function fmtTokens(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
      if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
      if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
      return String(Math.round(n))
    }

    /** Compact duration: 4097839ms -> "68m4s". */
    function fmtMs(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
      const s = Math.round(ms / 1000)
      if (s < 60) return `${s}s`
      const m = Math.floor(s / 60)
      if (m < 60) return `${m}m${s % 60}s`
      const hh = Math.floor(m / 60)
      if (hh < 48) return `${hh}h${m % 60}m`
      return `${Math.floor(hh / 24)}d${hh % 24}h`
    }

    async function getJson(path, query) {
      const response = await fetch(query ? `${path}?${query}` : path, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`rtk: status HTTP ${response.status}`)
      return response.json()
    }

    /** One labeled form row. */
    function Field(props) {
      const { id, label, hint, children } = props
      return h(
        'div',
        { className: 'rtk-row' },
        h('label', { className: 'rtk-label', htmlFor: id }, label),
        children,
        hint ? h('div', { className: 'rtk-hint', id: `${id}-hint` }, hint) : null,
      )
    }

    /** Version card. */
    function VersionCard(props) {
      const { t, status } = props
      if (status === null) return h('div', { className: 'rtk-status' }, t('loading'))
      if (status === false) {
        return h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('loadFailed'))
      }
      return h(
        'div',
        { className: 'rtk-card' },
        h(
          'div',
          { className: 'rtk-version' },
          `${t('versionLabel')}: `,
          status.version !== null && status.version !== undefined
            ? h('code', null, String(status.version))
            : h('span', { className: 'rtk-status' }, '—'),
        ),
        h(
          'div',
          { className: status.available ? 'rtk-status' : 'rtk-status rtk-error' },
          status.available ? t('available') : t('notInstalled'),
        ),
        status.available ? null : h('div', { className: 'rtk-hint' }, t('installHint')),
      )
    }

    /** Savings dashboard. */
    function Savings(props) {
      const { t, fetchGain, resetGain } = props
      const [scope, setScope] = React.useState('global')
      const [path, setPath] = React.useState('')
      const [view, setView] = React.useState('summary')
      const [state, setState] = React.useState({ status: 'idle', payload: null })
      const [reset, setReset] = React.useState({ armed: false, status: 'idle' })

      const load = React.useCallback(() => {
        setState({ status: 'loading', payload: null })
        fetchGain({ view, scope, path: scope === 'project' ? path.trim() : '' })
          .then((payload) => setState({ status: 'ready', payload }))
          .catch(() => setState({ status: 'failed', payload: null }))
      }, [fetchGain, view, scope, path])

      React.useEffect(() => {
        load()
      }, [load])

      const doReset = () => {
        if (!reset.armed) {
          setReset({ armed: true, status: 'idle' })
          return
        }
        setReset({ armed: false, status: 'loading' })
        resetGain()
          .then((result) => {
            if (result && result.ok) {
              setReset({ armed: false, status: 'done' })
              load()
            } else setReset({ armed: false, status: 'failed' })
          })
          .catch(() => setReset({ armed: false, status: 'failed' }))
      }

      let body = null
      if (state.status === 'loading' || state.status === 'idle') {
        body = h('div', { className: 'rtk-status' }, t('gainLoading'))
      } else if (state.status === 'failed' || !state.payload || state.payload.ok === false) {
        body = h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('gainFailed'))
      } else if (state.payload.kind === 'json' && state.payload.data && state.payload.data.summary) {
        const s = state.payload.data.summary
        const cells = [
          [s.total_commands, t('statCommands'), String(s.total_commands ?? '—')],
          [s.total_input, t('statInput'), fmtTokens(s.total_input)],
          [s.total_output, t('statOutput'), fmtTokens(s.total_output)],
          [s.total_saved, t('statSaved'), fmtTokens(s.total_saved)],
          [
            s.avg_savings_pct,
            t('statRate'),
            typeof s.avg_savings_pct === 'number' ? `${s.avg_savings_pct.toFixed(1)}%` : '—',
          ],
          [s.total_time_ms, t('statTime'), fmtMs(s.total_time_ms)],
        ]
        body = h(
          'div',
          { className: 'rtk-grid' },
          cells.map(([raw, label, text], index) =>
            raw === null || raw === undefined
              ? null
              : h('div', { className: 'rtk-stat', key: index }, h('b', null, text), h('span', null, label)),
          ),
        )
      } else if (state.payload.kind === 'text' && state.payload.text) {
        body = h('pre', { className: 'rtk-pre' }, state.payload.text)
      } else {
        body = h('div', { className: 'rtk-status' }, t('gainEmpty'))
      }

      return h(
        React.Fragment,
        null,
        h('h2', { className: 'rtk-sub' }, t('savingsTitle')),
        h('p', { className: 'rtk-intro' }, t('savingsIntro')),
        h(
          Field,
          { id: 'rtk-scope', label: t('scopeLabel') },
          h(
            'select',
            {
              id: 'rtk-scope',
              className: 'rtk-select',
              value: scope,
              onChange: (event) => setScope(event.target.value),
            },
            h('option', { value: 'global' }, t('scopeGlobal')),
            h('option', { value: 'project' }, t('scopeProject')),
          ),
        ),
        scope === 'project'
          ? h(
              Field,
              { id: 'rtk-path', label: t('projectPathLabel'), hint: t('projectPathHint') },
              h('input', {
                id: 'rtk-path',
                className: 'rtk-input',
                value: path,
                placeholder: 'F:\\git\\…',
                onChange: (event) => setPath(event.target.value),
              }),
            )
          : null,
        h(
          Field,
          { id: 'rtk-view', label: t('viewLabel') },
          h(
            'select',
            {
              id: 'rtk-view',
              className: 'rtk-select',
              value: view,
              onChange: (event) => setView(event.target.value),
            },
            GAIN_VIEWS.map((name) => h('option', { key: name, value: name }, t(`view.${name}`))),
          ),
        ),
        body,
        h(
          'div',
          { className: 'rtk-actions' },
          h('button', { type: 'button', className: 'rtk-button', onClick: load }, t('refresh')),
          h(
            'button',
            {
              type: 'button',
              className: 'rtk-button danger',
              title: t('resetHint'),
              disabled: reset.status === 'loading',
              onClick: doReset,
            },
            reset.status === 'loading' ? t('gainLoading') : reset.armed ? t('resetArm') : t('resetLabel'),
          ),
        ),
        reset.status === 'done'
          ? h('div', { className: 'rtk-status', role: 'status' }, t('resetDone'))
          : reset.status === 'failed'
            ? h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('resetFailed'))
            : null,
      )
    }

    /**
     * Behavior form backed by the Host configForms service: the slot system
     * turns `hooks: { env: form }` into the `useEnv` prop, like the Terminal
     * settings page does.
     */
    function Behavior(props) {
      const { t, form } = props
      const useEnv = typeof props.useEnv === 'function' ? props.useEnv : () => ({ status: 'unavailable' })
      const state = useEnv((snapshot) => snapshot) ?? { status: 'unavailable' }
      const [pending, setPending] = React.useState('')
      const [failed, setFailed] = React.useState(false)
      const [saved, setSaved] = React.useState(false)

      if (!form) {
        return h(
          React.Fragment,
          null,
          h('h2', { className: 'rtk-sub' }, t('configTitle')),
          h('div', { className: 'rtk-status' }, t('unavailable')),
        )
      }
      if (state.status === 'loading') {
        return h(
          React.Fragment,
          null,
          h('h2', { className: 'rtk-sub' }, t('configTitle')),
          h('div', { className: 'rtk-status' }, t('loading')),
        )
      }
      if (state.status === 'unavailable' || state.value === null || typeof state.value !== 'object') {
        return h(
          React.Fragment,
          null,
          h('h2', { className: 'rtk-sub' }, t('configTitle')),
          h('div', { className: 'rtk-status' }, t('unavailable')),
        )
      }

      const writable = state.writable === true && typeof props.setField === 'function'
      const disabled = !writable || pending !== ''
      const value = state.value

      const write = (field, next) => {
        if (typeof props.setField !== 'function') return
        setFailed(false)
        setSaved(false)
        setPending(field)
        props
          .setField(field, next)
          .then((accepted) => {
            if (accepted) setSaved(true)
            else setFailed(true)
          })
          .catch(() => setFailed(true))
          .finally(() => setPending(''))
      }

      const listToText = (list) => (Array.isArray(list) ? list.join(', ') : '')
      const textToList = (text) =>
        String(text ?? '')
          .split(/[,\s]+/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0)

      return h(
        React.Fragment,
        null,
        h('h2', { className: 'rtk-sub' }, t('configTitle')),
        h('p', { className: 'rtk-intro' }, t('configIntro')),
        h(
          Field,
          { id: 'rtk-hook', label: t('hookLabel'), hint: t('hookHint') },
          h(
            'select',
            {
              id: 'rtk-hook',
              className: 'rtk-select',
              value: value.hook ?? 'deny',
              disabled,
              'aria-describedby': 'rtk-hook-hint',
              onChange: (event) => write('hook', event.target.value),
            },
            h('option', { value: 'deny' }, t('hook.deny')),
            h('option', { value: 'off' }, t('hook.off')),
          ),
        ),
        h(
          'div',
          { className: 'rtk-row' },
          h('span', { className: 'rtk-label', id: 'rtk-rules-label' }, t('rulesLabel')),
          h(
            'label',
            { className: 'rtk-check' },
            h('input', {
              type: 'checkbox',
              checked: value.rules !== false,
              disabled,
              'aria-labelledby': 'rtk-rules-label',
              onChange: (event) => write('rules', event.target.checked),
            }),
            t('rulesOn'),
          ),
          h('div', { className: 'rtk-hint' }, t('rulesHint')),
        ),
        h(
          Field,
          { id: 'rtk-tools', label: t('toolsLabel'), hint: t('toolsHint') },
          h('input', {
            id: 'rtk-tools',
            className: 'rtk-input',
            value: listToText(value.tools),
            disabled,
            'aria-describedby': 'rtk-tools-hint',
            onChange: (event) => write('tools', textToList(event.target.value)),
          }),
        ),
        h(
          Field,
          { id: 'rtk-exclude', label: t('excludeLabel'), hint: t('excludeHint') },
          h('input', {
            id: 'rtk-exclude',
            className: 'rtk-input',
            value: listToText(value.exclude),
            disabled,
            placeholder: 'make, msbuild',
            'aria-describedby': 'rtk-exclude-hint',
            onChange: (event) => write('exclude', textToList(event.target.value)),
          }),
        ),
        h(
          Field,
          { id: 'rtk-timeout', label: t('timeoutLabel'), hint: t('timeoutHint') },
          h('input', {
            id: 'rtk-timeout',
            className: 'rtk-input',
            type: 'number',
            min: 1,
            max: 60000,
            step: 500,
            value: value.timeoutMs ?? 4000,
            disabled,
            'aria-describedby': 'rtk-timeout-hint',
            onChange: (event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next) && next > 0) write('timeoutMs', Math.min(Math.round(next), 60000))
            },
          }),
        ),
        failed
          ? h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('failed'))
          : pending !== ''
            ? h('div', { className: 'rtk-status', role: 'status' }, t('applying'))
            : saved
              ? h('div', { className: 'rtk-status', role: 'status' }, t('applied'))
              : !writable
                ? h('div', { className: 'rtk-status' }, t('readonly'))
                : null,
      )
    }

    /** Diagnostics: hook state, counters, verify. */
    function Diagnostics(props) {
      const { t, status, fetchVerify } = props
      const [verify, setVerify] = React.useState({ status: 'idle', payload: null })

      const runVerify = () => {
        setVerify({ status: 'loading', payload: null })
        fetchVerify()
          .then((payload) => setVerify({ status: 'ready', payload }))
          .catch(() => setVerify({ status: 'failed', payload: null }))
      }

      const hookState =
        status === null || status === false
          ? '—'
          : status.hook === 'off'
            ? t('stateOff')
            : status.available
              ? t('stateActive')
              : t('stateInactive')
      const counters =
        status && status !== false && status.stats
          ? `${status.stats.evaluated} ${t('countersEvaluated')} · ${status.stats.rewritten} ${t('countersRewritten')} · ${status.stats.denied} ${t('countersDenied')}`
          : '—'
      const cache =
        status && status !== false && typeof status.cacheSize === 'number'
          ? `${status.cacheSize} ${t('cacheEntries')}`
          : '—'

      return h(
        React.Fragment,
        null,
        h('h2', { className: 'rtk-sub' }, t('diagTitle')),
        h('p', { className: 'rtk-intro' }, t('diagIntro')),
        h(
          'div',
          { className: 'rtk-card' },
          h('div', null, `${t('hookStateLabel')}: `, h('b', null, hookState)),
          h('div', { className: 'rtk-status' }, `${t('countersLabel')}: ${counters}`),
          h('div', { className: 'rtk-status' }, `${t('cacheLabel')}: ${cache}`),
        ),
        h(
          'div',
          { className: 'rtk-row' },
          h('span', { className: 'rtk-label' }, t('verifyLabel')),
          h('div', { className: 'rtk-hint' }, t('verifyHint')),
          h(
            'div',
            { className: 'rtk-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'rtk-button',
                disabled: verify.status === 'loading',
                onClick: runVerify,
              },
              verify.status === 'loading' ? t('verifyLoading') : t('verifyRun'),
            ),
          ),
        ),
        verify.status === 'ready' && verify.payload
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                {
                  className: verify.payload.ok ? 'rtk-status' : 'rtk-status rtk-error',
                  role: verify.payload.ok ? 'status' : 'alert',
                },
                verify.payload.ok ? t('verifyPassed') : t('verifyFailed'),
              ),
              verify.payload.text ? h('pre', { className: 'rtk-pre' }, verify.payload.text) : null,
            )
          : verify.status === 'failed'
            ? h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('verifyFailed'))
            : null,
      )
    }

    /** The Settings → RTK section. */
    function Section(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => en[key] ?? key
      const [status, setStatus] = React.useState(null)
      const [nonce, setNonce] = React.useState(0)

      React.useEffect(() => {
        let alive = true
        setStatus(null)
        props
          .fetchStatus()
          .then((payload) => {
            if (alive) setStatus(payload)
          })
          .catch(() => {
            if (alive) setStatus(false)
          })
        return () => {
          alive = false
        }
      }, [nonce])

      return h(
        'div',
        { className: 'rtk-section' },
        h('style', { key: 'styles' }, CSS),
        h('h2', { className: 'rtk-title' }, t('title')),
        h('p', { className: 'rtk-intro' }, t('intro')),
        h(VersionCard, { t, status }),
        h(
          'div',
          { className: 'rtk-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'rtk-button',
              disabled: status === null,
              onClick: () => setNonce((value) => value + 1),
            },
            t('refresh'),
          ),
        ),
        h(Savings, { t, fetchGain: props.fetchGain, resetGain: props.resetGain }),
        h(Behavior, { t, form: props.form ?? null, useEnv: props.useEnv, setField: props.setField }),
        h(Diagnostics, { t, status, fetchVerify: props.fetchVerify }),
        h('p', { className: 'rtk-note' }, t('note')),
      )
    }

    /** Required services. `configForms` is provided by the Settings plugin. */
    const inject = ['slots', 'locale', 'configForms']

    /**
     * Register the dictionaries and the section while the Host serves its
     * configuration namespace.
     * @param {object} ctx - browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'rtk: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () =>
          ctx.configForms.whileServed(NAMESPACES, (served) => {
            const namespace = NAMESPACES.find((candidate) => served.has(candidate))
            if (namespace === undefined) return () => {}
            const form = ctx.configForms.get(namespace)
            return ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'rtk',
                  order: 18,
                  label: () => t('nav'),
                  locale: NS,
                  inject: () => ({
                    hooks: { env: form },
                    setField: (field, next) => form.set(field, next),
                    fetchStatus: async () => {
                      const response = await fetch(STATUS_PATH, {
                        method: 'GET',
                        headers: { accept: 'application/json' },
                        cache: 'no-store',
                      })
                      if (!response.ok) throw new Error(`rtk: status HTTP ${response.status}`)
                      return response.json()
                    },
                    fetchGain: async ({ view, scope, path }) => {
                      const params = new URLSearchParams({ view, scope })
                      if (scope === 'project' && path) params.set('path', path)
                      const response = await fetch(`${GAIN_PATH}?${params.toString()}`, {
                        method: 'GET',
                        headers: { accept: 'application/json' },
                        cache: 'no-store',
                      })
                      if (!response.ok) throw new Error(`rtk: gain HTTP ${response.status}`)
                      return response.json()
                    },
                    resetGain: async () => {
                      const response = await fetch(RESET_PATH, {
                        method: 'POST',
                        headers: { accept: 'application/json' },
                        cache: 'no-store',
                      })
                      if (!response.ok) throw new Error(`rtk: reset HTTP ${response.status}`)
                      return response.json()
                    },
                    fetchVerify: async () => {
                      const response = await fetch(VERIFY_PATH, {
                        method: 'GET',
                        headers: { accept: 'application/json' },
                        cache: 'no-store',
                      })
                      if (!response.ok) throw new Error(`rtk: verify HTTP ${response.status}`)
                      return response.json()
                    },
                    form,
                  }),
                },
                Section,
              ),
            )
          }),
        'rtk: settings page',
      )
    }

    return { inject, apply }
  },
})
