import { parseUserRule } from './rules'
import { TEXTS } from './texts'
import type { Category, Config, DeepPartial, Rule, Texts, UserConfig } from './types'
import { OPTIONAL } from './types'

const POSITIONS = ['bar', 'box', 'center'] as const

function merge<T>(base: T, extra: DeepPartial<T> | undefined): T {
  if (!extra) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === '') continue
    const current = out[key]
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? merge(current, value as DeepPartial<typeof current>)
        : value
  }
  return out as T
}

/** Checks and completes whatever the site owner passed in, so the rest of the code can trust it. */
export function buildConfig(user: UserConfig = {}): Config {
  const htmlLang = document.documentElement.lang?.toLowerCase() ?? ''
  const lang = user.lang === 'en' || user.lang === 'es' ? user.lang : htmlLang.startsWith('es') ? 'es' : 'en'

  const categories = Array.isArray(user.categories)
    ? OPTIONAL.filter(c => user.categories!.includes(c))
    : [...OPTIONAL]

  const rules: Rule[] = (Array.isArray(user.rules) ? user.rules : [])
    .filter(r => r && ['necessary', ...OPTIONAL].includes(r.category as Category))
    .map(parseUserRule)
    .filter((r): r is Rule => !!r)

  const texts: Texts = merge(TEXTS[lang], user.texts?.[lang])
  const accent = typeof user.accent === 'string' && /^#[0-9a-f]{3,8}$/i.test(user.accent) ? user.accent : '#2563eb'

  return {
    categories,
    rules,
    lang,
    texts,
    policyUrl: typeof user.policyUrl === 'string' ? user.policyUrl : '',
    revision: Number.isInteger(user.revision) ? user.revision! : 1,
    position: POSITIONS.includes(user.position as never) ? user.position! : 'bar',
    floatingButton: user.floatingButton !== false,
    accent,
    googleConsentMode: user.googleConsentMode === true,
    scan: user.scan === true || /[?&]cookie-scan\b/.test(location.search),
    cookieName: typeof user.cookieName === 'string' && /^[\w-]+$/.test(user.cookieName) ? user.cookieName : 'cc_consent',
    expiresDays: typeof user.expiresDays === 'number' && user.expiresDays > 0 ? Math.min(user.expiresDays, 730) : 365,
  }
}
