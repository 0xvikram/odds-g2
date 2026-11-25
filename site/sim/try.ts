// /try: the real Odds app in the browser. Buttons map to the G2 ring; typed commands take the same path as speech.
import { sim, type Action } from './sdk'

import { fit } from '../fit'

const screen = document.getElementById('lens')!
fit(screen)
sim.el = screen
const note = document.getElementById('mic-note')!
sim.onMicError = () => { note.textContent = 'Microphone blocked. Use the tour or type a command instead.'; note.hidden = false }
sim.onClose = () => {
  screen.innerHTML = '<div class="g-closed">Odds closed (double-tap on the watchlist exits).<br><button type="button" id="restart">Open again</button></div>'
  document.getElementById('restart')!.onclick = () => location.reload()
}

document.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => (b.onclick = () => sim.input(b.dataset.act as Action)))

// Hold to talk: pointer, or hold the space bar.
const talk = document.getElementById('talk')!
let holding = false
const press = () => { if (!holding) { holding = true; talk.classList.add('on'); sim.input('long_press') } }
const release = () => { if (holding) { holding = false; talk.classList.remove('on'); sim.input('long_press_release') } }
talk.addEventListener('pointerdown', (e) => { e.preventDefault(); talk.setPointerCapture(e.pointerId); press() })
talk.addEventListener('pointerup', release)
talk.addEventListener('pointercancel', release)
talk.addEventListener('contextmenu', (e) => e.preventDefault())
// Keys drive the ring unless the user is typing, or pressing Enter/Space on a focused button (that button wins).
const typing = () => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLButtonElement
addEventListener('keydown', (e) => {
  if (typing()) return
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) press() }
  else if (e.key === 'ArrowUp') sim.input('up')
  else if (e.key === 'ArrowDown') sim.input('down')
  else if (e.key === 'Enter') sim.input('click')
  else if (e.key === 'Escape' || e.key === 'Backspace') sim.input('double_click')
})
addEventListener('keyup', (e) => { if (e.code === 'Space' && !typing()) release() })

// Typed commands.
const form = document.getElementById('say') as HTMLFormElement
const field = form.querySelector('input')!
const say = (text: string) => {
  const fn = (globalThis as { oddsSay?: (t: string) => Promise<void> }).oddsSay
  if (fn && text.trim()) void fn(text.trim())
}
form.onsubmit = (e) => { e.preventDefault(); say(field.value); field.value = ''; field.blur() }
document.querySelectorAll<HTMLButtonElement>('button[data-say]').forEach((b) => (b.onclick = () => say(b.dataset.say!)))

// Guided tour: one step is current; its button runs the real command, then the next step lights up.
const steps = [...document.querySelectorAll<HTMLLIElement>('#tour li')]
function setStep(i: number) {
  steps.forEach((li, j) => { li.classList.toggle('now', j === i); li.classList.toggle('done', j < i) })
}
steps.forEach((li, i) => {
  li.querySelector('button')!.onclick = () => {
    if (li.dataset.stepAct) sim.input(li.dataset.stepAct as Action)
    else say(li.dataset.stepSay!)
    setStep(Math.min(i + 1, steps.length))
  }
  li.onclick = (e) => { if (!(e.target as HTMLElement).closest('button')) setStep(i) }
})
setStep(0)

await import('../../src/main')
