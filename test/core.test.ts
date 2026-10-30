import { BLOCKED_TYPE, Blocker } from '../src/blocker'
import { buildConfig } from '../src/config'
import { deleteCookies, domainVariants, readConsent, writeConsent } from '../src/consent'
import { KNOWN_RULES, matchRule, parseUserRule } from '../src/rules'
import { scanPage } from '../src/scan'
import type { Category, Rule } from '../src/types'

const tick = () => new Promise(r => setTimeout(r, 0))

describe('rules', () => {
  it('recognises common trackers by URL', () => {
    expect(matchRule('https://www.googletagmanager.com/gtag/js?id=G-123', 'url', KNOWN_RULES)?.name).toBe('Google Analytics')
    expect(matchRule('https://connect.facebook.net/en_US/fbevents.js', 'url', KNOWN_RULES)?.category).toBe('marketing')
    expect(matchRule('https://www.youtube-nocookie.com/embed/abc', 'url', KNOWN_RULES)?.name).toBe('YouTube')
    expect(matchRule('https://www.google.com/maps/embed?pb=1', 'url', KNOWN_RULES)?.category).toBe('media')
    expect(matchRule('https://cdn.example.com/app.js', 'url', KNOWN_RULES)).toBeNull()
  })

  it('recognises inline snippets, but only where it makes sense', () => {
    expect(matchRule("gtag('config', 'G-123');", 'inline', KNOWN_RULES)?.name).toBe('Google Analytics')
    expect(matchRule("fbq('init', '123');", 'inline', KNOWN_RULES)?.name).toBe('Meta Pixel')
    // A consent-mode call is not analytics by itself.
    expect(matchRule("gtag('consent', 'default', {})", 'inline', KNOWN_RULES)).toBeNull()
    // Inline-only rules don't apply to URLs.
    expect(matchRule('https://example.com/_hjSettings.js', 'url', KNOWN_RULES)).toBeNull()
  })

  it('reads owner rules written as text, including /regex/', () => {
    expect(parseUserRule({ category: 'analytics', pattern: '/stats\\.example\\.(com|net)/i' })?.pattern).toEqual(/stats\.example\.(com|net)/i)
    expect(parseUserRule({ category: 'analytics', pattern: '  plausible.io ' })?.pattern).toBe('plausible.io')
    expect(parseUserRule({ category: 'analytics', pattern: '/[unclosed/' })).toBeNull()
    expect(parseUserRule({ category: 'analytics', pattern: '' })).toBeNull()
  })
})

describe('config', () => {
  it('fills in safe defaults and ignores junk', () => {
    const cfg = buildConfig({ position: 'nowhere' as never, accent: 'red;}', categories: ['media', 'bogus' as Category], revision: 2.5 })
    expect(cfg.position).toBe('bar')
    expect(cfg.accent).toBe('#2563eb')
    expect(cfg.categories).toEqual(['media'])
    expect(cfg.revision).toBe(1)
    expect(cfg.expiresDays).toBe(365)
  })

  it('picks the language from <html lang> and merges custom texts', () => {
    document.documentElement.lang = 'es-ES'
    const cfg = buildConfig({ texts: { es: { title: 'Cookies, sí', categories: { media: { title: 'Vídeos' } } } } })
    expect(cfg.lang).toBe('es')
    expect(cfg.texts.title).toBe('Cookies, sí')
    expect(cfg.texts.reject).toBe('Rechazar todas')
    expect(cfg.texts.categories.media.title).toBe('Vídeos')
    expect(cfg.texts.categories.media.description).toContain('YouTube')
    document.documentElement.lang = 'en'
  })
})

describe('consent cookie', () => {
  beforeEach(() => {
    document.cookie = 'cc_consent=; Max-Age=0; Path=/'
  })

  it('round-trips and is ignored after a new revision', () => {
    writeConsent('cc_consent', { v: 1, revision: 3, categories: ['analytics'], date: '2026-10-29T10:00:00Z' }, 365)
    expect(readConsent('cc_consent', 3)?.categories).toEqual(['analytics'])
    expect(readConsent('cc_consent', 4)).toBeNull()
  })

  it('survives broken values', () => {
    document.cookie = 'cc_consent=%7Bnot-json; Path=/'
    expect(readConsent('cc_consent', 1)).toBeNull()
  })

  it('deletes only the cookies of withdrawn categories', () => {
    document.cookie = '_ga=GA1.1.1; Path=/'
    document.cookie = '_fbp=fb.1; Path=/'
    document.cookie = 'session=keep; Path=/'
    expect(deleteCookies(['analytics'])).toEqual(['_ga'])
    expect(document.cookie).not.toContain('_ga=')
    expect(document.cookie).toContain('_fbp=')
    expect(document.cookie).toContain('session=keep')
  })

  it('lists parent domains to clear', () => {
    expect(domainVariants('www.shop.example.com')).toEqual(['www.shop.example.com', 'shop.example.com', 'example.com'])
  })
})

describe('blocker', () => {
  let allowed: Set<Category>
  let blocker: Blocker
  let framed: Array<[HTMLIFrameElement, Rule]>
  const ownRules: Rule[] = [{ name: 'Own CDN', category: 'necessary', pattern: 'cdn.mysite.com/analytics' }]

  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.querySelectorAll('script').forEach(s => s.remove())
    allowed = new Set()
    framed = []
    blocker = new Blocker({
      rules: [...ownRules, ...KNOWN_RULES],
      isAllowed: c => allowed.has(c),
      onBlockedFrame: (f, r) => {
        framed.push([f, r])
        // what the UI does: a placeholder right before the iframe
        const ph = document.createElement('div')
        ph.className = 'cc-placeholder'
        ph.dataset.ccFor = f.dataset.ccId
        f.before(ph)
      },
    })
    blocker.start()
  })
  afterEach(() => blocker.stop())

  it('blocks tracker scripts added to the page', async () => {
    document.body.insertAdjacentHTML('beforeend', '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>')
    await tick()
    const s = document.querySelector('script')!
    expect(s.type).toBe(BLOCKED_TYPE)
    expect(s.dataset.ccCategory).toBe('analytics')
  })

  it('blocks scripts created from JavaScript before they are appended', () => {
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    expect(s.type).toBe(BLOCKED_TYPE)
    // and doesn't let the type be switched back
    s.type = 'text/javascript'
    s.setAttribute('type', 'text/javascript')
    expect(s.type).toBe(BLOCKED_TYPE)
    expect(s.dataset.ccType).toBe('text/javascript')
  })

  it('blocks inline snippets created from JavaScript', () => {
    const s = document.createElement('script')
    s.text = "fbq('init', '123');"
    expect(s.type).toBe(BLOCKED_TYPE)
  })

  it('leaves unknown, ignored, non-JS and whitelisted scripts alone', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<script src="https://cdn.example.com/app.js"></script>
       <script data-cc-ignore src="https://www.google-analytics.com/analytics.js"></script>
       <script type="application/ld+json">{"gtag('config'":1}</script>
       <script src="https://cdn.mysite.com/analytics.js"></script>`,
    )
    await tick()
    const types = Array.from(document.querySelectorAll('script')).map(s => s.type)
    expect(types).not.toContain(BLOCKED_TYPE)
  })

  it('does not block categories already allowed', async () => {
    allowed.add('analytics')
    document.body.insertAdjacentHTML('beforeend', '<script src="https://static.hotjar.com/c/hotjar-1.js"></script>')
    await tick()
    expect(document.querySelector('script')!.type).toBe('')
  })

  it('holds back iframes and asks for a placeholder', async () => {
    document.body.insertAdjacentHTML('beforeend', '<iframe src="https://www.youtube.com/embed/abc" width="560"></iframe>')
    await tick()
    const f = document.querySelector('iframe')!
    expect(f.hasAttribute('src')).toBe(false)
    expect(f.dataset.ccSrc).toBe('https://www.youtube.com/embed/abc')
    expect(f.style.display).toBe('none')
    expect(framed[0][1].name).toBe('YouTube')
  })

  it('releases scripts and iframes once allowed', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<script src="https://www.googletagmanager.com/gtag/js?id=G-1" async></script>
       <script type="text/plain" data-cc-category="analytics">window.__ran = 1</script>
       <iframe src="https://player.vimeo.com/video/1"></iframe>`,
    )
    await tick()
    expect(document.querySelectorAll('.cc-placeholder')).toHaveLength(1)
    // moving a held-back iframe must not add a second placeholder
    document.body.append(document.querySelector('iframe')!)
    await tick()
    expect(document.querySelectorAll('.cc-placeholder')).toHaveLength(1)
    allowed.add('analytics').add('media')
    blocker.release(new Set<Category>(['analytics', 'media']))

    const scripts = Array.from(document.querySelectorAll('script'))
    expect(scripts.every(s => s.hasAttribute('data-cc-done'))).toBe(true)
    expect(scripts.every(s => s.type === '')).toBe(true)
    expect(scripts[0].async).toBe(true)
    expect(scripts[1].text).toBe('window.__ran = 1')

    const f = document.querySelector('iframe')!
    expect(f.getAttribute('src')).toBe('https://player.vimeo.com/video/1')
    expect(f.style.display).toBe('')
    expect(document.querySelector('.cc-placeholder')).toBeNull()
  })

  it('runs held-back markup straight away when its category was already allowed', async () => {
    allowed.add('analytics').add('media')
    document.body.insertAdjacentHTML(
      'beforeend',
      `<script type="text/plain" data-cc-category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
       <script type="text/plain" data-cc-category="marketing">window.__fb = 1</script>
       <iframe data-cc-src="https://www.youtube.com/embed/x" data-cc-category="media"></iframe>`,
    )
    await tick()
    const [ga, fb] = Array.from(document.querySelectorAll('script'))
    expect(ga.hasAttribute('data-cc-done')).toBe(true)
    expect(ga.type).toBe('')
    expect(fb.type).toBe('text/plain') // marketing not allowed
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe('https://www.youtube.com/embed/x')
    expect(framed).toHaveLength(0)
  })

  it('only releases the categories asked for', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<script src="https://www.google-analytics.com/analytics.js"></script>
       <script src="https://connect.facebook.net/en_US/fbevents.js"></script>`,
    )
    await tick()
    blocker.release(new Set<Category>(['analytics']))
    const [ga, fb] = Array.from(document.querySelectorAll('script'))
    expect(ga.hasAttribute('data-cc-done')).toBe(true)
    expect(fb.type).toBe(BLOCKED_TYPE)
  })
})

describe('scan', () => {
  it('lists cookies and flags unknown ones', () => {
    document.cookie = '_ga=1; Path=/'
    document.cookie = 'mystery=1; Path=/'
    document.cookie = 'cc_consent=x; Path=/'
    const result = scanPage(KNOWN_RULES, { isAllowed: c => c === 'analytics', ownCookie: 'cc_consent' })
    const byName = Object.fromEntries(result.cookies.map(([n, c, s]) => [n, [c, s]]))
    expect(byName['_ga']).toEqual(['analytics', 'allowed'])
    expect(byName['mystery']).toEqual(['?', 'unknown'])
    expect(byName['cc_consent']).toEqual(['cookie consent', 'necessary'])
  })

  it('names blocked scripts and frames, and the site\'s own scripts', async () => {
    document.body.innerHTML = `
      <script type="javascript/blocked" data-cc-category="marketing" data-cc-service="Meta Pixel" src="https://connect.facebook.net/x.js"></script>
      <script src="/wp-includes/js/app.js"></script>
      <script src="https://cdn.unknown-tracker.io/t.js"></script>`
    const r = scanPage(KNOWN_RULES, { isAllowed: () => false, ownCookie: 'cc_consent' })
    expect(r.scripts.map(s => s[2])).toEqual(['blocked', 'first-party', 'unknown'])
    expect(r.scripts[0][1]).toBe('Meta Pixel (marketing)')
  })
})
