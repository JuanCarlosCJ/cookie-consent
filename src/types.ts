export type Category = 'necessary' | 'analytics' | 'marketing' | 'media'

/** The categories a visitor can switch on or off. "necessary" is always on. */
export const OPTIONAL: readonly Category[] = ['analytics', 'marketing', 'media']

export interface Rule {
  /** Shown in placeholders and scan mode, e.g. "YouTube". */
  name: string
  category: Category
  /** Matched against a script's or iframe's URL, or an inline script's code. A string means "contains". */
  pattern: string | RegExp
  /** Where to look. Default: both URLs and inline code. */
  on?: 'url' | 'inline' | 'both'
}

export interface CategoryTexts {
  title: string
  description: string
}

export interface Texts {
  title: string
  message: string
  policy: string
  accept: string
  reject: string
  settings: string
  save: string
  close: string
  settingsTitle: string
  settingsIntro: string
  alwaysOn: string
  categories: Record<Category, CategoryTexts>
  /** "{service}" and "{category}" are replaced. */
  placeholder: string
  placeholderButton: string
  floating: string
  scanTitle: string
}

export type Position = 'bar' | 'box' | 'center'

export interface Config {
  /** Optional categories this site uses. Unused ones are hidden from visitors. */
  categories: Category[]
  /** Extra rules from the site owner. They are checked before the built-in ones. */
  rules: Rule[]
  lang: 'en' | 'es'
  texts: Texts
  policyUrl: string
  /** Increase it to ask everyone for consent again. */
  revision: number
  position: Position
  floatingButton: boolean
  accent: string
  googleConsentMode: boolean
  scan: boolean
  cookieName: string
  /** How long a choice is remembered. The AEPD suggests no more than 24 months. */
  expiresDays: number
}

/** What the site owner can pass in `window.cookieConsentConfig` (everything optional). */
export interface UserConfig extends Partial<Omit<Config, 'texts' | 'rules'>> {
  texts?: Partial<Record<'en' | 'es', DeepPartial<Texts>>>
  rules?: Array<Omit<Rule, 'pattern'> & { pattern: string | RegExp }>
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export interface Consent {
  v: 1
  revision: number
  categories: Category[]
  /** ISO date of the choice, useful as proof of consent. */
  date: string
}
