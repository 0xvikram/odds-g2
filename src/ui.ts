type Status = 'connecting' | 'listening' | 'paused' | 'error'

let statusEl: HTMLDivElement
let finalEl: HTMLSpanElement
let interimEl: HTMLSpanElement

export function mountUi() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <main class="panel">
      <header>
        <h1>Odds</h1>
        <div id="status" class="status status-connecting">Connecting…</div>
      </header>
      <section class="transcript" aria-live="polite">
        <span id="final"></span><span id="interim" class="interim"></span>
      </section>
      <section id="tg" class="tg" hidden></section>
      <footer>Hold the touchpad or ring to speak · double-tap to go back.</footer>
    </main>
  `
  statusEl = app.querySelector<HTMLDivElement>('#status')!
  finalEl = app.querySelector<HTMLSpanElement>('#final')!
  interimEl = app.querySelector<HTMLSpanElement>('#interim')!
  injectStyles()
}

/** The phone side of linking Telegram: one tap opens the bot with the code filled in. Null hides it. */
export function setTelegram(state: { code: string; url: string; bot: string } | { linked: true } | null) {
  const el = document.querySelector<HTMLElement>('#tg')
  if (!el) return
  el.hidden = !state
  if (!state) { el.innerHTML = ''; return }
  if ('linked' in state) { el.innerHTML = '<p class="tg-ok">Telegram linked. Alerts arrive in your chat with the Odds bot.</p>'; return }
  el.innerHTML = `
    <p>Get alerts when Odds is closed.</p>
    <a class="tg-btn" href="${state.url}" target="_blank" rel="noopener">Open @${state.bot} in Telegram</a>
    <p class="tg-code">or send it this code: <b>${state.code}</b></p>`
}

export function setStatus(kind: Status, text: string) {
  if (!statusEl) return
  statusEl.className = `status status-${kind}`
  statusEl.textContent = text
}

export function setTranscript(finalText: string, interimText: string) {
  if (!finalEl) return
  finalEl.textContent = finalText
  interimEl.textContent = interimText
}

function injectStyles() {
  // ER brand dark-theme surfaces: #232323 / #2E2E2E / #3E3E3E.
  // ER OS green (#3CFA44) + signal red (#FF453A) for state chips.
  const css = `
    :root { color-scheme: dark; }
    html, body { margin: 0; height: 100%; background: #232323; color: #E5E5E5;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif;
      touch-action: manipulation; -webkit-text-size-adjust: 100%;
      overscroll-behavior: none; }
    #app { display: flex; height: 100%; }
    .panel { display: flex; flex-direction: column; gap: 16px;
      width: 100%; max-width: 640px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
    header { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 18px; font-weight: 600; margin: 0; letter-spacing: 0.02em; }
    .status { font-size: 12px; padding: 4px 10px; border-radius: 999px;
      border: 1px solid transparent; letter-spacing: 0.04em; text-transform: uppercase; }
    .status-connecting { color: #A7A7A7; border-color: #3E3E3E; }
    .status-listening  { color: #3CFA44; border-color: #3CFA44; background: rgba(60,250,68,0.08); }
    .status-paused     { color: #E5E5E5; border-color: #7B7B7B; background: rgba(229,229,229,0.06); }
    .status-error      { color: #FF453A; border-color: #FF453A; background: rgba(255,69,58,0.08); }
    .transcript { flex: 1; overflow: auto; background: #2E2E2E; border: 1px solid #3E3E3E;
      color: #E5E5E5;
      border-radius: 12px; padding: 20px; font-size: 18px; line-height: 1.5;
      min-height: 180px; white-space: pre-wrap; word-break: break-word; }
    .interim { color: #919191; }
    .tg { background: #2E2E2E; border: 1px solid #3E3E3E; border-radius: 12px; padding: 16px; font-size: 15px; }
    .tg p { margin: 0 0 10px; }
    .tg-btn { display: block; text-align: center; padding: 12px; border-radius: 10px; background: #2AABEE; color: #fff;
      font-weight: 600; text-decoration: none; }
    .tg-code { margin: 10px 0 0 !important; color: #A7A7A7; font-size: 13px; }
    .tg-code b { color: #E5E5E5; letter-spacing: 0.12em; }
    .tg-ok { color: #3CFA44; margin: 0 !important; }
    footer { font-size: 12px; color: #7B7B7B; text-align: center; }
  `
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}
