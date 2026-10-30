/** Styles for the banner and settings, inside a shadow root so the site's CSS can't break them. */
export const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2328; }
.banner { position: fixed; z-index: 2147483000; background: #fff; box-shadow: 0 8px 40px rgba(0,0,0,.18); padding: 20px; display: grid; gap: 14px; }
.banner.bar { left: 0; right: 0; bottom: 0; grid-template-columns: minmax(0,1fr) auto; align-items: center; padding: 18px max(20px, calc((100vw - 1180px) / 2)); }
.banner.box { left: 20px; bottom: 20px; width: min(420px, calc(100vw - 40px)); border-radius: 14px; }
.banner.center { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 32px)); border-radius: 16px; }
.backdrop { position: fixed; inset: 0; z-index: 2147482999; background: rgba(20,20,25,.45); }
h2 { margin: 0 0 4px; font-size: 17px; }
p { margin: 0; color: #4b525a; font-size: 14px; }
a { color: var(--cc-accent); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.bar .actions { justify-content: flex-end; }
button { font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 10px; padding: 10px 16px; border: 2px solid var(--cc-accent); }
/* Accept and Reject look exactly the same on purpose: rejecting must be as easy as accepting. */
.choice { background: var(--cc-accent); color: #fff; }
.choice:hover { filter: brightness(1.08); }
.secondary { background: #fff; color: var(--cc-accent); }
.box .actions button, .center .actions button { flex: 1 1 auto; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--cc-accent); outline-offset: 2px; }
dialog { border: 0; border-radius: 16px; padding: 0; width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 24px); box-shadow: 0 20px 60px rgba(0,0,0,.3); color: inherit; }
dialog::backdrop { background: rgba(20,20,25,.5); }
.dlg { display: flex; flex-direction: column; max-height: calc(100vh - 24px); }
.dlg header, .dlg footer { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dlg header { border-bottom: 1px solid #e6e8eb; }
.dlg footer { border-top: 1px solid #e6e8eb; flex-wrap: wrap; justify-content: flex-end; }
.dlg .body { padding: 16px 20px; overflow-y: auto; display: grid; gap: 12px; }
.x { border: 0; background: none; color: #4b525a; font-size: 22px; line-height: 1; padding: 4px 8px; }
.cat { border: 1px solid #e6e8eb; border-radius: 12px; padding: 12px 14px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 14px; align-items: center; }
.cat strong { font-size: 15px; }
.cat p { grid-column: 1 / -1; font-size: 13px; }
.always { font-size: 12px; font-weight: 700; color: #1a7f37; }
.switch { position: relative; width: 44px; height: 26px; }
.switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.switch span { position: absolute; inset: 0; border-radius: 99px; background: #c4c9cf; transition: background .15s; pointer-events: none; }
.switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .15s; }
.switch input:checked + span { background: var(--cc-accent); }
.switch input:checked + span::after { transform: translateX(18px); }
.switch input:focus-visible + span { outline: 3px solid var(--cc-accent); outline-offset: 2px; }
.floating { position: fixed; left: 16px; bottom: 16px; z-index: 2147482998; width: 46px; height: 46px; padding: 0; border-radius: 50%; border: 0; background: var(--cc-accent); color: #fff; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.floating svg { width: 24px; height: 24px; }
.scan { position: fixed; right: 16px; top: 16px; z-index: 2147483001; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; background: #fff; border-radius: 14px; box-shadow: 0 12px 50px rgba(0,0,0,.25); padding: 16px 18px; font-size: 13px; }
.scan h3 { margin: 14px 0 6px; font-size: 14px; }
.scan table { width: 100%; border-collapse: collapse; }
.scan td { padding: 5px 6px; border-top: 1px solid #eef0f2; vertical-align: top; word-break: break-all; }
.tag { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 11px; font-weight: 700; background: #eef0f2; white-space: nowrap; }
.tag.blocked { background: #ffebe9; color: #b42318; }
.tag.unknown { background: #fff4d6; color: #8a5a00; }
.tag.allowed, .tag.necessary { background: #dafbe1; color: #1a7f37; }
.tag.first-party { background: #eef0f2; color: #4b525a; }
.scan td:nth-child(3) { text-align: right; width: 1%; }
@media (max-width: 720px) {
  .banner.bar { grid-template-columns: 1fr; }
  .banner.bar .actions button { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`

/** Placeholders sit in the page itself (where the iframe was), so they get a small global style. */
export const PLACEHOLDER_CSS = `
.cc-placeholder { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; min-height: 180px; background: #f3f4f6; border: 1px dashed #c4c9cf; border-radius: 10px; text-align: center; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #374151; }
.cc-placeholder button { font: inherit; font-weight: 600; cursor: pointer; border-radius: 9px; padding: 8px 14px; border: 0; background: var(--cc-accent, #2563eb); color: #fff; }
`
