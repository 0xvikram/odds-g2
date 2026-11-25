// Stand-in for src/ui.ts on the product site: the phone-side status and transcript go into the simulator panel.
export function mountUi() {}
export function setStatus(kind: string, text: string) {
  const el = document.getElementById('sim-status')
  if (el) { el.dataset.kind = kind; el.textContent = text }
}
export function setTranscript(finalText: string, _interim: string) {
  const el = document.getElementById('sim-heard')
  if (el && finalText) el.textContent = `Heard “${finalText}”`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const TG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 4.3 2.9 11.5c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5ZM8.6 14.2l9.4-5.9c.5-.3.9-.1.5.2l-8 7.3-.3 3.4-1.6-5Z"/></svg>'

/** Phone side of linking Telegram: on G2 this is the Even app on your phone; here it sits next to the tour. */
export function setTelegram(state: { code: string; url: string; bot: string } | { linked: true } | null) {
  const el = document.getElementById('phone-side')
  if (!el) return
  el.hidden = !state
  if (!state) { el.innerHTML = ''; return }
  if ('linked' in state) { el.innerHTML = '<p class="label">On your phone</p><p class="ok">Telegram linked. Alerts arrive in your chat with the Odds bot.</p>'; return }
  el.innerHTML = `<p class="label">On your phone (the Even app)</p>
    <a class="tg-btn" href="${esc(state.url)}" target="_blank" rel="noopener">${TG}Open @${esc(state.bot)} in Telegram</a>
    <p class="code">or send it the code <b>${esc(state.code)}</b></p>`
}
