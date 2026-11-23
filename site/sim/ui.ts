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
