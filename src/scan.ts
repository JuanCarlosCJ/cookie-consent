import { cookieCategory, matchRule } from './rules'
import type { Category, Rule } from './types'

export type ScanState = 'blocked' | 'allowed' | 'unknown' | 'necessary' | 'first-party' | ''
export type ScanRow = [item: string, detail: string, state: ScanState]

export interface ScanResult {
  cookies: ScanRow[]
  storage: ScanRow[]
  scripts: ScanRow[]
  frames: ScanRow[]
  thirdParty: ScanRow[]
}

export interface ScanOptions {
  isAllowed: (category: Category) => boolean
  /** Our own consent cookie, which is always necessary. */
  ownCookie: string
}

const label = (rule: Pick<Rule, 'name' | 'category'>) => `${rule.name} (${rule.category})`

/**
 * Lists what this page uses: cookies, storage, outside scripts and iframes, and every
 * other host it loaded something from. Anything our rules don't recognise is flagged
 * "unknown", so the site owner can add a rule for it.
 */
export function scanPage(rules: readonly Rule[], opts: ScanOptions): ScanResult {
  const here = location.hostname
  const hostOf = (url: string) => safe(() => new URL(url, location.href).hostname) ?? ''
  const stateFor = (category: Category): ScanState =>
    category === 'necessary' ? 'necessary' : opts.isAllowed(category) ? 'allowed' : 'blocked'
  /** Hosts we've already put a name to, from the scripts and iframes on the page. */
  const knownHosts = new Map<string, string>()

  const cookies = document.cookie
    .split('; ')
    .filter(Boolean)
    .map(c => c.split('=')[0])
    .map((name): ScanRow => {
      if (name === opts.ownCookie) return [name, 'cookie consent', 'necessary']
      const cat = cookieCategory(name)
      return [name, cat ?? '?', cat ? stateFor(cat) : 'unknown']
    })

  const storage: ScanRow[] = []
  for (const [where, store] of [
    ['localStorage', safe(() => localStorage)],
    ['sessionStorage', safe(() => sessionStorage)],
  ] as const) {
    if (!store) continue
    for (let i = 0; i < store.length; i++) storage.push([store.key(i) ?? '', where, ''])
  }

  const describe = (url: string, blockedService?: string, blockedCategory?: string): ScanRow => {
    const host = hostOf(url)
    if (blockedService) {
      knownHosts.set(host, `${blockedService} (${blockedCategory})`)
      return [url, `${blockedService} (${blockedCategory})`, 'blocked']
    }
    const rule = matchRule(url, 'url', rules)
    if (rule) {
      knownHosts.set(host, label(rule))
      return [url, label(rule), stateFor(rule.category)]
    }
    if (!host || host === here) return [url, '', 'first-party']
    return [url, host, 'unknown']
  }

  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'))
    .filter(s => !s.hasAttribute('data-cc-ignore') && (s.getAttribute('src') || s.dataset.ccCategory))
    .map((s): ScanRow => {
      const src = s.getAttribute('src')
      const blocked = s.type === 'javascript/blocked' || s.type === 'text/plain'
      if (!src) {
        const service = s.dataset.ccService ?? '?'
        return ['(inline)', `${service} (${s.dataset.ccCategory})`, blocked ? 'blocked' : 'allowed']
      }
      return blocked ? describe(src, s.dataset.ccService, s.dataset.ccCategory) : describe(src)
    })

  const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe')).map((f): ScanRow => {
    const held = f.dataset.ccSrc && f.hasAttribute('data-cc-held')
    const url = f.dataset.ccSrc || f.getAttribute('src') || '(empty)'
    return held ? describe(url, f.dataset.ccService, f.dataset.ccCategory) : describe(url)
  })

  const hosts = new Set<string>()
  for (const entry of safe(() => performance.getEntriesByType('resource')) ?? []) {
    const host = hostOf(entry.name)
    if (host && host !== here) hosts.add(host)
  }
  const thirdParty = [...hosts].sort().map((host): ScanRow => {
    const known = knownHosts.get(host)
    if (known) return [host, known, '']
    const rule = matchRule(`https://${host}/`, 'url', rules)
    return rule ? [host, label(rule), ''] : [host, '?', 'unknown']
  })

  return { cookies, storage, scripts, frames, thirdParty }
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}
