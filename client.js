window.__ModuleLoader__.load({
  id: 'dsh-rtk',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'settings.rtk'

    /** Authenticated Host route registered by lib/plugin.js. */
    const STATUS_PATH = '/rtk/status'

    /** English copy. */
    const en = {
      nav: 'RTK',
      title: 'RTK version',
      intro:
        'The plugin uses the external RTK binary installed on this Host. The version below is read live with `rtk --version`.',
      versionLabel: 'Installed version',
      loading: 'Checking RTK…',
      loadFailed: 'Could not check the RTK version right now.',
      available: 'RTK is available on PATH.',
      notInstalled: 'RTK is not found on PATH.',
      installHint: 'Install it from https://www.rtk-ai.app/ , then open a new shell (or restart DSH) so PATH is refreshed.',
      refresh: 'Recheck',
      note: 'Full savings stay in the terminal: run `rtk gain` there. Statistics are global to RTK, not specific to this plugin.',
    }

    /** Russian copy. */
    const ru = {
      nav: 'RTK',
      title: 'Версия RTK',
      intro:
        'Плагин использует внешний бинарник RTK, установленный на этом хосте. Версия ниже запрашивается вживую через `rtk --version`.',
      versionLabel: 'Установленная версия',
      loading: 'Проверяю RTK…',
      loadFailed: 'Не удалось проверить версию RTK.',
      available: 'RTK найден в PATH.',
      notInstalled: 'RTK не найден в PATH.',
      installHint: 'Установите его с https://www.rtk-ai.app/ , затем откройте новый шелл (или перезапустите DSH), чтобы обновился PATH.',
      refresh: 'Проверить снова',
      note: 'Полная статистика остаётся в терминале: выполните там `rtk gain`. Статистика общая для RTK, а не только для этого плагина.',
    }

    /** Page-local styles; tokens only, so light/dark follows the host theme. */
    const CSS = `
.rtk-section{display:flex;flex-direction:column;gap:20px;width:100%;max-width:640px;padding:4px 0 24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}
.rtk-title{margin:0;font-size:16px;font-weight:600}
.rtk-intro{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:19px}
.rtk-card{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:18px}
.rtk-version{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}
.rtk-version code{font-family:var(--dsw-font-mono,monospace)}
.rtk-status{color:var(--dsw-alias-label-secondary)}
.rtk-error{color:var(--dsw-alias-state-error-primary)}
.rtk-link{color:var(--dsw-alias-brand-primary);text-decoration:none;overflow-wrap:anywhere}
.rtk-actions{display:flex;gap:8px}
.rtk-button{height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer}
.rtk-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.rtk-button:disabled{color:var(--dsw-alias-label-secondary);cursor:not-allowed}
.rtk-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.rtk-note{margin:4px 0 0;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
`

    /**
     * The Settings → RTK section. Read-only: shows the live `rtk --version`.
     * @param {object} props - slot props: locale binder and status fetcher.
     * @returns {object} React element.
     */
    function Section(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => en[key] ?? key
      const [state, setState] = React.useState({ status: 'loading', payload: null })
      const [nonce, setNonce] = React.useState(0)

      React.useEffect(() => {
        let alive = true
        setState({ status: 'loading', payload: null })
        const fetchStatus =
          typeof props.fetchStatus === 'function'
            ? props.fetchStatus
            : async () => {
                const response = await fetch(STATUS_PATH, {
                  method: 'GET',
                  headers: { accept: 'application/json' },
                  cache: 'no-store',
                })
                if (!response.ok) throw new Error(`rtk: status HTTP ${response.status}`)
                return response.json()
              }
        fetchStatus()
          .then((payload) => {
            if (alive) setState({ status: 'ready', payload })
          })
          .catch(() => {
            if (alive) setState({ status: 'failed', payload: null })
          })
        return () => {
          alive = false
        }
      }, [nonce])

      const body =
        state.status === 'loading'
          ? h('div', { className: 'rtk-status' }, t('loading'))
          : state.status === 'failed' || state.payload === null || typeof state.payload !== 'object'
            ? h('div', { className: 'rtk-status rtk-error', role: 'alert' }, t('loadFailed'))
            : h(
                'div',
                { className: 'rtk-card' },
                h(
                  'div',
                  { className: 'rtk-version' },
                  `${t('versionLabel')}: `,
                  state.payload.version !== null && state.payload.version !== undefined
                    ? h('code', null, String(state.payload.version))
                    : h('span', { className: 'rtk-status' }, '—'),
                ),
                h(
                  'div',
                  { className: state.payload.available ? 'rtk-status' : 'rtk-status rtk-error' },
                  state.payload.available ? t('available') : t('notInstalled'),
                ),
                state.payload.available
                  ? null
                  : h('div', { className: 'rtk-hint' }, t('installHint')),
              )

      return h(
        'div',
        { className: 'rtk-section' },
        h('style', { key: 'styles' }, CSS),
        h('h2', { className: 'rtk-title' }, t('title')),
        h('p', { className: 'rtk-intro' }, t('intro')),
        body,
        h(
          'div',
          { className: 'rtk-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'rtk-button',
              disabled: state.status === 'loading',
              onClick: () => setNonce((value) => value + 1),
            },
            t('refresh'),
          ),
        ),
        h('p', { className: 'rtk-note' }, t('note')),
      )
    }

    /** Required services. */
    const inject = ['slots', 'locale']

    /**
     * Register the dictionaries and the section.
     * @param {object} ctx - browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'rtk: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'rtk',
                order: 18,
                label: () => t('nav'),
                locale: NS,
                inject: () => ({
                  fetchStatus: async () => {
                    const response = await fetch(STATUS_PATH, {
                      method: 'GET',
                      headers: { accept: 'application/json' },
                      cache: 'no-store',
                    })
                    if (!response.ok) throw new Error(`rtk: status HTTP ${response.status}`)
                    return response.json()
                  },
                }),
              },
              Section,
            ),
          ),
        'rtk: settings page',
      )
    }

    return { inject, apply }
  },
})
