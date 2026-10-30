import { Blocker } from './blocker'
import { buildConfig } from './config'
import { deleteCookies, readConsent, writeConsent } from './consent'
import { KNOWN_RULES } from './rules'
import { scanPage } from './scan'
import type { Category, Consent, UserConfig } from './types'
import { OPTIONAL } from './types'
import { UI } from './ui'

declare const __VERSION__: string

declare global {
  interface Window {
    cookieConsentConfig?: UserConfig
    CookieConsent?: CookieConsentApi
    dataLayer?: unknown[]
  }
}

export interface CookieConsentApi {
  /** Opens the settings panel (for "Cookie settings" links in the footer). */
  open(): void
  acceptAll(): void
  rejectAll(): void
  /** Allows exactly these categories. */
  set(categories: Category[]): void
  /** The stored choice, or null if the visitor hasn't chosen yet. */
  get(): Consent | null
  has(category: Category): boolean
  /** Lists cookies, storage and outside scripts on this page. */
  scan(): ReturnType<typeof scanPage>
  version: string
}

function start(): void {
  if (window.CookieConsent) return // loaded twice
  const cfg = buildConfig(window.cookieConsentConfig)
  const rules = [...cfg.rules, ...KNOWN_RULES]
  let consent = readConsent(cfg.cookieName, cfg.revision)
  let allowed = new Set<Category>(consent?.categories.filter(c => cfg.categories.includes(c)) ?? [])

  // Same as Google's snippet: it must push the `arguments` object, not an array.
  function gtag(..._args: unknown[]): void {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(arguments)
  }
  const consentModeState = () => {
    const a = allowed.has('analytics') ? 'granted' : 'denied'
    const m = allowed.has('marketing') ? 'granted' : 'denied'
    return { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m }
  }
  if (cfg.googleConsentMode) {
    gtag('consent', 'default', { ...consentModeState(), wait_for_update: 500 })
  }

  const ui = new UI(cfg, {
    acceptAll: () => choose(cfg.categories),
    rejectAll: () => choose([]),
    save: cats => choose(cats),
    current: () => allowed,
  })

  const blocker = new Blocker({
    rules,
    isAllowed: c => allowed.has(c),
    onBlockedFrame: (frame, rule) => whenReady(() => ui.placeholder(frame, rule)),
  })
  blocker.start()

  const scan = () => scanPage(rules, { isAllowed: c => allowed.has(c), ownCookie: cfg.cookieName })

  function choose(categories: Category[]): void {
    const next = new Set(categories.filter(c => cfg.categories.includes(c)))
    const revoked = [...allowed].filter(c => !next.has(c))
    const granted = [...next].filter(c => !allowed.has(c))
    allowed = next
    consent = { v: 1, revision: cfg.revision, categories: [...next], date: new Date().toISOString() }
    writeConsent(cfg.cookieName, consent, cfg.expiresDays)

    if (cfg.googleConsentMode) gtag('consent', 'update', consentModeState())
    ui.hideBanner()
    ui.closeSettings()
    ui.showFloating()
    window.dispatchEvent(new CustomEvent('cookieconsent:change', { detail: { consent, granted, revoked } }))

    if (revoked.length) {
      // Scripts that already ran can't be "un-run": clear their cookies and start the page again.
      deleteCookies(revoked)
      location.reload()
      return
    }
    if (granted.length) blocker.release(new Set(granted))
  }

  window.CookieConsent = {
    open: () => whenReady(() => ui.openSettings()),
    acceptAll: () => choose(cfg.categories),
    rejectAll: () => choose([]),
    set: cats => choose(cats.filter(c => OPTIONAL.includes(c))),
    get: () => consent,
    has: c => c === 'necessary' || allowed.has(c),
    scan: () => scan(),
    version: __VERSION__,
  }

  whenReady(() => {
    if (!consent) ui.showBanner()
    else ui.showFloating()

    // Any element with data-cc-open opens the settings, e.g. a footer link.
    document.addEventListener('click', e => {
      const target = (e.target as Element | null)?.closest?.('[data-cc-open]')
      if (target) {
        e.preventDefault()
        ui.openSettings()
      }
    })

    if (cfg.scan) {
      // Wait for the page to finish loading so every resource has been seen.
      const run = () => {
        const r = scan()
        const es = cfg.lang === 'es'
        ui.showScan(
          [
            { title: 'Cookies', rows: r.cookies },
            { title: es ? 'Almacenamiento' : 'Storage', rows: r.storage },
            { title: 'Scripts', rows: r.scripts },
            { title: 'Iframes', rows: r.frames },
            { title: es ? 'Otros dominios' : 'Other domains', rows: r.thirdParty },
          ],
          es
            ? { blocked: 'bloqueado', allowed: 'permitido', unknown: 'desconocido', necessary: 'necesaria', 'first-party': 'propio' }
            : { blocked: 'blocked', allowed: 'allowed', unknown: 'unknown', necessary: 'necessary', 'first-party': 'this site' },
        )
        console.table?.([...r.cookies, ...r.scripts, ...r.frames, ...r.thirdParty])
      }
      if (document.readyState === 'complete') setTimeout(run, 500)
      else window.addEventListener('load', () => setTimeout(run, 500))
    }
  })
}

function whenReady(fn: () => void): void {
  if (document.body) fn()
  else document.addEventListener('DOMContentLoaded', fn, { once: true })
}

start()
