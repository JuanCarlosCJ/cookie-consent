import { matchRule } from './rules'
import type { Category, Rule } from './types'

/** A type browsers don't run. Swapping it in is how a script is held back. */
export const BLOCKED_TYPE = 'javascript/blocked'
const JS_TYPES = ['', 'text/javascript', 'application/javascript', 'module', 'text/ecmascript']

export interface BlockerOptions {
  rules: readonly Rule[]
  /** Categories the visitor has allowed so far. */
  isAllowed: (category: Category) => boolean
  /** Called for every iframe we hold back, so the UI can show a placeholder. */
  onBlockedFrame?: (frame: HTMLIFrameElement, rule: Rule) => void
}

/** A property's native getter/setter, looked up the prototype chain (browsers differ in where they define them). */
function nativeProp(proto: object | null, name: string): PropertyDescriptor {
  for (let p = proto; p; p = Object.getPrototypeOf(p)) {
    const desc = Object.getOwnPropertyDescriptor(p, name)
    if (desc) return desc
  }
  throw new Error(`cookie-consent: no native "${name}" property`)
}
/** Sets a script's type through the browser's own setter, past our guard in watchScript(). */
const setNativeType = (s: HTMLScriptElement, value: string) =>
  nativeProp(HTMLScriptElement.prototype, 'type').set!.call(s, value)

const isScript = (n: Node): n is HTMLScriptElement => n.nodeName === 'SCRIPT'
const isFrame = (n: Node): n is HTMLIFrameElement => n.nodeName === 'IFRAME'
const stopFirefox = (e: Event) => e.preventDefault()
let frameCount = 0

/**
 * Holds back scripts and iframes from known trackers until their category is allowed.
 *
 * Three ways in, so nothing slips through:
 *  1. Scripts and iframes already on the page when we start.
 *  2. A MutationObserver for everything the HTML parser adds after us. Its callback
 *     runs before a parser-inserted script executes, so we can still change its type.
 *  3. A patched document.createElement, for scripts that other scripts create:
 *     we watch their `src` and `type` so they are blocked before they are appended.
 */
export class Blocker {
  private observer?: MutationObserver
  private readonly nativeCreate = document.createElement.bind(document)

  constructor(private readonly opts: BlockerOptions) {}

  start(): void {
    document.querySelectorAll('script, iframe').forEach(el => this.check(el))
    this.observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          this.check(node)
          if (node.nodeType === 1 && (node as Element).childElementCount) {
            ;(node as Element).querySelectorAll('script, iframe').forEach(el => this.check(el))
          }
        })
      }
    })
    this.observer.observe(document.documentElement, { childList: true, subtree: true })
    this.patchCreateElement()
  }

  stop(): void {
    this.observer?.disconnect()
    document.createElement = this.nativeCreate as typeof document.createElement
  }

  /** Lets everything in these categories run: scripts are re-created, iframes get their src back. */
  release(categories: ReadonlySet<Category>): void {
    document.querySelectorAll<HTMLScriptElement>('script[data-cc-category]').forEach(old => {
      if (categories.has(old.dataset.ccCategory as Category)) this.releaseScript(old)
    })
    document.querySelectorAll<HTMLIFrameElement>('iframe[data-cc-src]').forEach(frame => {
      if (categories.has(frame.dataset.ccCategory as Category)) this.releaseFrame(frame)
    })
  }

  private releaseScript(old: HTMLScriptElement): void {
    if (old.hasAttribute('data-cc-done') || !old.isConnected) return
    // A script whose type was changed never runs, even if we change it back: it must be re-created.
    const fresh = this.nativeCreate('script')
    for (const attr of Array.from(old.attributes)) {
      if (attr.name !== 'type' && !attr.name.startsWith('data-cc-')) fresh.setAttribute(attr.name, attr.value)
    }
    const type = old.dataset.ccType
    if (type) fresh.type = type
    if (old.hasAttribute('src')) fresh.async = old.hasAttribute('async') // keep page order unless it was async already
    fresh.text = old.text
    fresh.setAttribute('data-cc-done', '')
    old.replaceWith(fresh)
  }

  private releaseFrame(frame: HTMLIFrameElement): void {
    frame.src = frame.dataset.ccSrc!
    frame.removeAttribute('data-cc-src')
    frame.style.display = frame.dataset.ccDisplay ?? ''
    frame.removeAttribute('data-cc-display')
    frame.removeAttribute('data-cc-held')
    frame.setAttribute('data-cc-done', '')
    document.querySelectorAll(`.cc-placeholder[data-cc-for="${frame.dataset.ccId}"]`).forEach(ph => ph.remove())
  }

  /** Decides what to do with one node. Public so tests can call it directly. */
  check(node: Node): void {
    if (isScript(node)) this.checkScript(node)
    else if (isFrame(node)) this.checkFrame(node)
  }

  private shouldBlock(rule: Rule | null): rule is Rule {
    return !!rule && rule.category !== 'necessary' && !this.opts.isAllowed(rule.category)
  }

  private checkScript(script: HTMLScriptElement): void {
    if (script.hasAttribute('data-cc-ignore') || script.hasAttribute('data-cc-done')) return
    // Already held back: by us, by the WordPress plugin, or by hand (<script type="text/plain" data-cc-category="...">).
    // If the visitor already allowed that category on an earlier visit, let it run right away.
    if (script.dataset.ccCategory) {
      const held = script.type === BLOCKED_TYPE || script.type === 'text/plain'
      if (held && this.opts.isAllowed(script.dataset.ccCategory as Category)) this.releaseScript(script)
      return
    }
    const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
    if (!JS_TYPES.includes(type)) return

    const src = script.getAttribute('src')
    const rule = src ? matchRule(src, 'url', this.opts.rules) : matchRule(script.text, 'inline', this.opts.rules)
    if (!this.shouldBlock(rule)) return

    script.dataset.ccCategory = rule.category
    script.dataset.ccService = rule.name
    if (type) script.dataset.ccType = type
    setNativeType(script, BLOCKED_TYPE)
    // Old Firefox versions ran parser-inserted scripts anyway; this event stops them.
    script.addEventListener('beforescriptexecute', stopFirefox, { once: true })
  }

  private checkFrame(frame: HTMLIFrameElement): void {
    // Already released, or already held back by us (moving it in the page fires the observer again).
    if (frame.hasAttribute('data-cc-done') || frame.hasAttribute('data-cc-held')) return
    // Held back in the HTML (<iframe data-cc-src="..." data-cc-category="media">): load it if
    // the category is already allowed, otherwise it only needs a placeholder.
    const manual = frame.dataset.ccSrc && frame.dataset.ccCategory
    if (manual && this.opts.isAllowed(frame.dataset.ccCategory as Category)) {
      this.releaseFrame(frame)
      return
    }
    const src = manual ? frame.dataset.ccSrc! : frame.getAttribute('src')
    if (!src || src === 'about:blank') return

    const rule: Rule | null = manual
      ? { name: frame.dataset.ccService ?? new URL(src, location.href).hostname, category: frame.dataset.ccCategory as Category, pattern: '' }
      : matchRule(src, 'url', this.opts.rules)
    if (!this.shouldBlock(rule)) return

    frame.setAttribute('data-cc-held', '')
    frame.dataset.ccId = String(++frameCount) // links the iframe to its placeholder
    if (!manual) {
      frame.dataset.ccSrc = src
      frame.dataset.ccCategory = rule.category
      frame.dataset.ccService = rule.name
      frame.removeAttribute('src')
    }
    frame.dataset.ccDisplay = frame.style.display
    frame.style.display = 'none'
    this.opts.onBlockedFrame?.(frame, rule)
  }

  private patchCreateElement(): void {
    const blocker = this
    const native = this.nativeCreate
    document.createElement = function (tagName: string, options?: ElementCreationOptions) {
      const el = native(tagName, options)
      if (String(tagName).toLowerCase() === 'script') blocker.watchScript(el as HTMLScriptElement)
      return el
    } as typeof document.createElement
  }

  /**
   * For scripts created from JavaScript: re-check whenever `src`, `type` or the code is set,
   * and don't let anyone switch a blocked script's type back to JavaScript.
   * (Inline scripts added this way run the moment they're appended, before any
   * MutationObserver sees them, so they must be caught here.)
   */
  private watchScript(script: HTMLScriptElement): void {
    const typeDesc = nativeProp(HTMLScriptElement.prototype, 'type')
    const nativeSetAttribute = script.setAttribute.bind(script)
    const watched = (desc: PropertyDescriptor): PropertyDescriptor => ({
      configurable: true,
      get: () => desc.get!.call(script),
      set: (value: string) => {
        desc.set!.call(script, value)
        this.checkScript(script)
      },
    })

    Object.defineProperties(script, {
      src: watched(nativeProp(HTMLScriptElement.prototype, 'src')),
      text: watched(nativeProp(HTMLScriptElement.prototype, 'text')),
      textContent: watched(nativeProp(Node.prototype, 'textContent')),
      innerHTML: watched(nativeProp(Element.prototype, 'innerHTML')),
      type: {
        configurable: true,
        get: () => typeDesc.get!.call(script),
        set: (value: string) => {
          if (script.dataset.ccCategory && !script.hasAttribute('data-cc-done')) {
            script.dataset.ccType = value // remember it for later, stay blocked
            return
          }
          typeDesc.set!.call(script, value)
        },
      },
    })

    script.setAttribute = (name: string, value: string) => {
      const n = name.toLowerCase()
      if (n === 'src') script.src = value
      else if (n === 'type') script.type = value
      else nativeSetAttribute(name, value)
    }
  }
}
