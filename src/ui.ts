import type { ScanRow } from './scan'
import { PANEL_CSS, PLACEHOLDER_CSS } from './styles'
import type { Category, Config, Rule } from './types'

export interface UIHandlers {
  acceptAll(): void
  rejectAll(): void
  save(categories: Category[]): void
  /** Categories allowed right now, to fill in the settings switches. */
  current(): ReadonlySet<Category>
}

type Child = Node | string | null | false | undefined

/** Tiny DOM helper. Text always goes in as text, never as HTML. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value)
    else if (value === true) el.setAttribute(key, '')
    else if (value !== false) el.setAttribute(key, value)
  }
  for (const c of children) if (c) el.append(c)
  return el
}

const COOKIE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.3A9 9 0 1 1 11.7 3a3 3 0 0 0 3.8 3.8 3 3 0 0 0 3.7 3.7 3 3 0 0 0 1.8 1.8z"/><circle cx="8.5" cy="10.5" r=".6" fill="currentColor"/><circle cx="12" cy="15.5" r=".6" fill="currentColor"/><circle cx="15.5" cy="13" r=".6" fill="currentColor"/><circle cx="8" cy="15" r=".6" fill="currentColor"/></svg>'

export class UI {
  private root!: ShadowRoot
  private banner?: HTMLElement
  private backdrop?: HTMLElement
  private dialog?: HTMLDialogElement
  private floating?: HTMLButtonElement

  constructor(
    private readonly cfg: Config,
    private readonly on: UIHandlers,
  ) {}

  /** Adds the shadow host and the placeholder styles. Call once the body exists. */
  mount(): void {
    if (this.root) return
    const host = h('div', { id: 'cc-root', 'data-cc-ignore': true })
    host.style.setProperty('--cc-accent', this.cfg.accent)
    this.root = host.attachShadow({ mode: 'open' })
    this.root.append(h('style', {}, PANEL_CSS), h('div', { class: 'wrap' }))
    document.body.append(host)
    const style = h('style', { id: 'cc-placeholder-style' }, PLACEHOLDER_CSS)
    document.head.append(style)
    document.documentElement.style.setProperty('--cc-accent', this.cfg.accent)
  }

  private get wrap(): HTMLElement {
    return this.root.querySelector('.wrap') as HTMLElement
  }

  showBanner(): void {
    this.mount()
    if (this.banner) return
    const t = this.cfg.texts
    const { position } = this.cfg
    const policy = this.cfg.policyUrl ? h('a', { href: this.cfg.policyUrl }, t.policy) : null

    this.banner = h(
      'section',
      { class: `banner ${position}`, role: 'dialog', 'aria-modal': String(position === 'center'), 'aria-labelledby': 'cc-title' },
      h(
        'div',
        {},
        h('h2', { id: 'cc-title' }, t.title),
        h('p', {}, t.message, policy ? ' ' : '', policy),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: 'choice', onclick: () => this.on.rejectAll() }, t.reject),
        h('button', { type: 'button', class: 'choice', onclick: () => this.on.acceptAll() }, t.accept),
        h('button', { type: 'button', class: 'secondary', onclick: () => this.openSettings() }, t.settings),
      ),
    )
    if (position === 'center') {
      this.backdrop = h('div', { class: 'backdrop' })
      this.wrap.append(this.backdrop)
    }
    this.wrap.append(this.banner)
    this.hideFloating()
  }

  hideBanner(): void {
    this.banner?.remove()
    this.backdrop?.remove()
    this.banner = this.backdrop = undefined
  }

  openSettings(): void {
    this.mount()
    this.dialog?.remove()
    const t = this.cfg.texts
    const current = this.on.current()
    const switches = new Map<Category, HTMLInputElement>()

    const row = (cat: Category) => {
      const texts = t.categories[cat]
      const id = `cc-cat-${cat}`
      let control: HTMLElement
      if (cat === 'necessary') {
        control = h('span', { class: 'always' }, t.alwaysOn)
      } else {
        // Nothing is pre-ticked: a switch is only on if the visitor turned it on before.
        const input = h('input', { type: 'checkbox', id, role: 'switch', checked: current.has(cat) })
        switches.set(cat, input)
        control = h('label', { class: 'switch' }, input, h('span', {}))
        control.setAttribute('aria-label', texts.title)
      }
      return h('div', { class: 'cat' }, h('strong', {}, texts.title), control, h('p', {}, texts.description))
    }

    const close = () => this.dialog?.close()
    this.dialog = h(
      'dialog',
      { 'aria-labelledby': 'cc-settings-title' },
      h(
        'div',
        { class: 'dlg' },
        h(
          'header',
          {},
          h('h2', { id: 'cc-settings-title' }, t.settingsTitle),
          h('button', { type: 'button', class: 'x', 'aria-label': t.close, onclick: close }, '×'),
        ),
        h('div', { class: 'body' }, h('p', {}, t.settingsIntro), row('necessary'), ...this.cfg.categories.map(row)),
        h(
          'footer',
          {},
          h('button', { type: 'button', class: 'choice', onclick: () => this.on.rejectAll() }, t.reject),
          h('button', { type: 'button', class: 'choice', onclick: () => this.on.acceptAll() }, t.accept),
          h(
            'button',
            {
              type: 'button',
              class: 'secondary',
              onclick: () => this.on.save([...switches].filter(([, input]) => input.checked).map(([cat]) => cat)),
            },
            t.save,
          ),
        ),
      ),
    )
    this.dialog.addEventListener('close', () => {
      this.dialog?.remove()
      this.dialog = undefined
    })
    this.wrap.append(this.dialog)
    this.dialog.showModal()
  }

  closeSettings(): void {
    this.dialog?.close()
  }

  showFloating(): void {
    if (!this.cfg.floatingButton) return
    this.mount()
    if (this.floating) return
    const t = this.cfg.texts
    this.floating = h('button', { type: 'button', class: 'floating', 'aria-label': t.floating, title: t.floating, onclick: () => this.openSettings() })
    this.floating.innerHTML = COOKIE_ICON // fixed SVG of our own, no user text
    this.wrap.append(this.floating)
  }

  hideFloating(): void {
    this.floating?.remove()
    this.floating = undefined
  }

  /** Shown in place of a blocked iframe, with a one-click way to allow it. */
  placeholder(frame: HTMLIFrameElement, rule: Rule): void {
    const t = this.cfg.texts
    const category = t.categories[rule.category].title.toLowerCase()
    const fill = (s: string) => s.replace('{service}', rule.name).replace('{category}', category)
    const box = h(
      'div',
      { class: 'cc-placeholder', 'data-cc-ignore': true, 'data-cc-for': frame.dataset.ccId ?? '' },
      h('span', {}, fill(t.placeholder)),
      h('button', { type: 'button', onclick: () => this.on.save([...this.on.current(), rule.category]) }, fill(t.placeholderButton)),
    )
    const w = frame.getAttribute('width')
    const ht = frame.getAttribute('height')
    if (w) box.style.width = /^\d+$/.test(w) ? `${w}px` : w
    if (ht) box.style.minHeight = /^\d+$/.test(ht) ? `${ht}px` : ht
    box.style.maxWidth = '100%'
    frame.before(box)
  }

  /** Scan mode panel: everything is passed in already worked out. */
  showScan(sections: Array<{ title: string; rows: ScanRow[] }>, stateLabels: Record<string, string>): void {
    this.mount()
    const panel = h(
      'div',
      { class: 'scan', role: 'region', 'aria-label': this.cfg.texts.scanTitle },
      h('h2', {}, this.cfg.texts.scanTitle),
      ...sections.map(s =>
        h(
          'div',
          {},
          h('h3', {}, `${s.title} (${s.rows.length})`),
          h(
            'table',
            {},
            h(
              'tbody',
              {},
              ...s.rows.map(([a, b, state]) =>
                h('tr', {}, h('td', {}, a), h('td', {}, b), h('td', {}, state ? h('span', { class: `tag ${state}` }, stateLabels[state] ?? state) : '')),
              ),
            ),
          ),
        ),
      ),
    )
    this.wrap.append(panel)
  }
}
