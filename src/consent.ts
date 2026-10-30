import { KNOWN_COOKIES } from './rules'
import type { Category, Consent } from './types'
import { OPTIONAL } from './types'

export function readConsent(name: string, revision: number): Consent | null {
  const raw = document.cookie
    .split('; ')
    .find(c => c.startsWith(name + '='))
    ?.slice(name.length + 1)
  if (!raw) return null
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Consent
    if (data?.v !== 1 || data.revision !== revision || !Array.isArray(data.categories)) return null
    return { ...data, categories: data.categories.filter(c => OPTIONAL.includes(c)) }
  } catch {
    return null
  }
}

export function writeConsent(name: string, consent: Consent, days: number): void {
  const value = encodeURIComponent(JSON.stringify(consent))
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${value}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`
}

/** "www.shop.example.com" → ["www.shop.example.com", "shop.example.com", "example.com"]. */
export function domainVariants(hostname: string): string[] {
  const parts = hostname.split('.')
  const out: string[] = []
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'))
  return out.length ? out : [hostname]
}

/**
 * Deletes the cookies known to belong to these categories. Trackers usually set them
 * on the parent domain, so we try every variant.
 */
export function deleteCookies(categories: Iterable<Category>): string[] {
  const patterns = [...categories].flatMap(c => (c === 'necessary' ? [] : KNOWN_COOKIES[c]))
  const names = document.cookie
    .split('; ')
    .map(c => c.split('=')[0])
    .filter(n => n && patterns.some(p => p.test(n)))
  const expire = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'
  for (const n of names) {
    document.cookie = `${n}=; ${expire}`
    for (const d of domainVariants(location.hostname)) {
      document.cookie = `${n}=; ${expire}; Domain=${d}`
      document.cookie = `${n}=; ${expire}; Domain=.${d}`
    }
  }
  return names
}
