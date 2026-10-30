import type { Category, Rule } from './types'

/**
 * Known services that set cookies or track visitors.
 * URL patterns catch <script src> and <iframe src>; inline patterns catch the
 * copy-paste snippets that load them (gtag('config'), fbq('init')...).
 */
export const KNOWN_RULES: Rule[] = [
  // Analytics
  { name: 'Google Analytics', category: 'analytics', pattern: 'googletagmanager.com/gtag/js' },
  { name: 'Google Analytics', category: 'analytics', pattern: 'google-analytics.com' },
  { name: 'Google Analytics', category: 'analytics', pattern: /\bgtag\(\s*['"](config|js)['"]/, on: 'inline' },
  { name: 'Google Tag Manager', category: 'analytics', pattern: 'googletagmanager.com/gtm.js' },
  { name: 'Google Tag Manager', category: 'analytics', pattern: 'googletagmanager.com/ns.html' },
  { name: 'Hotjar', category: 'analytics', pattern: 'hotjar.com' },
  { name: 'Hotjar', category: 'analytics', pattern: '_hjSettings', on: 'inline' },
  { name: 'Microsoft Clarity', category: 'analytics', pattern: 'clarity.ms' },
  { name: 'Matomo', category: 'analytics', pattern: /\/(matomo|piwik)\.(js|php)/ },
  { name: 'Yandex Metrica', category: 'analytics', pattern: 'mc.yandex.ru' },

  // Marketing
  { name: 'Meta Pixel', category: 'marketing', pattern: 'connect.facebook.net' },
  { name: 'Meta Pixel', category: 'marketing', pattern: /\bfbq\(\s*['"]init['"]/, on: 'inline' },
  { name: 'TikTok Pixel', category: 'marketing', pattern: 'analytics.tiktok.com' },
  { name: 'LinkedIn Insight Tag', category: 'marketing', pattern: 'snap.licdn.com' },
  { name: 'LinkedIn Insight Tag', category: 'marketing', pattern: '_linkedin_partner_id', on: 'inline' },
  { name: 'Google Ads', category: 'marketing', pattern: 'googleadservices.com' },
  { name: 'Google Ads', category: 'marketing', pattern: 'doubleclick.net' },
  { name: 'Google AdSense', category: 'marketing', pattern: 'pagead2.googlesyndication.com' },
  { name: 'Pinterest Tag', category: 'marketing', pattern: 's.pinimg.com/ct' },
  { name: 'X (Twitter) Ads', category: 'marketing', pattern: 'static.ads-twitter.com' },
  { name: 'Microsoft Ads', category: 'marketing', pattern: 'bat.bing.com' },

  // Media embeds
  { name: 'YouTube', category: 'media', pattern: /youtube(-nocookie)?\.com\/embed/ },
  { name: 'Vimeo', category: 'media', pattern: 'player.vimeo.com' },
  { name: 'Google Maps', category: 'media', pattern: /google\.[a-z.]+\/maps|maps\.google\.|maps\.googleapis\.com/ },
  { name: 'Spotify', category: 'media', pattern: 'open.spotify.com/embed' },
  { name: 'Instagram', category: 'media', pattern: 'instagram.com/embed' },
  { name: 'X (Twitter) embed', category: 'media', pattern: 'platform.twitter.com' },
  { name: 'SoundCloud', category: 'media', pattern: 'w.soundcloud.com/player' },
]

/** Cookie names each category usually leaves behind, deleted when consent is withdrawn. */
export const KNOWN_COOKIES: Record<Exclude<Category, 'necessary'>, RegExp[]> = {
  analytics: [/^_ga/, /^_gid$/, /^_gat/, /^_hj/, /^_clck$/, /^_clsk$/, /^_pk_/, /^_ym/],
  marketing: [/^_fbp$/, /^_fbc$/, /^_ttp$/, /^_tt_/, /^li_/, /^_gcl/, /^_pin_/, /^_uet/, /^IDE$/],
  media: [],
}

/** Which category a cookie name probably belongs to (for scan mode). */
export function cookieCategory(name: string): Category | null {
  for (const [category, patterns] of Object.entries(KNOWN_COOKIES)) {
    if (patterns.some(p => p.test(name))) return category as Category
  }
  return null
}

function test(pattern: string | RegExp, text: string): boolean {
  return typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)
}

/** First rule that matches a URL or inline code. Site rules come first, so they can override ours. */
export function matchRule(text: string, kind: 'url' | 'inline', rules: readonly Rule[]): Rule | null {
  if (!text) return null
  for (const rule of rules) {
    const on = rule.on ?? 'both'
    if ((on === 'both' || on === kind) && test(rule.pattern, text)) return rule
  }
  return null
}

/**
 * Turns the owner's rules into Rule objects. Strings that look like /regex/flags become RegExps,
 * so they can be written in a plain text box in WordPress.
 */
export function parseUserRule(rule: { name?: string; category: Category; pattern: string | RegExp; on?: Rule['on'] }): Rule | null {
  let pattern = rule.pattern
  if (typeof pattern === 'string') {
    pattern = pattern.trim()
    if (!pattern) return null
    const re = /^\/(.+)\/([gimsuy]*)$/.exec(pattern)
    if (re) {
      try {
        pattern = new RegExp(re[1], re[2].replace('g', ''))
      } catch {
        return null
      }
    }
  }
  return { name: rule.name || String(rule.pattern), category: rule.category, pattern, on: rule.on }
}
