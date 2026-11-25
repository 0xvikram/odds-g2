// Stand-in for src/ui.ts on the product site: the phone-side status and transcript go into the simulator panel.
export function mountUi() {}
export function setStatus(kind: string, text: string) {
  const el = document.getElementById('sim-status')
  if (el) { el.dataset.kind = kind; el.textContent = text }
}
export function setTranscript(finalText: string, _interim: string) {
  const el = document.getElementById('sim-heard')
  if (el && finalText) el.textContent = `Heard: “${finalText}”`
}
/** Phone side of linking Telegram, shown under the simulated display. */
export function setTelegram(state: { code: string; url: string; bot: string } | { linked: true } | null) {
  const el = document.getElementById('sim-note')
  if (!el) return
  el.hidden = !state
  if (!state) { el.textContent = ''; return }
  if ('linked' in state) { el.textContent = 'Telegram linked. Alerts arrive in your chat with the Odds bot.'; return }
  el.innerHTML = `Phone side: <a href="${state.url}" target="_blank" rel="noopener">open @${state.bot} in Telegram</a>, or send it <b>${state.code}</b>.`
}
