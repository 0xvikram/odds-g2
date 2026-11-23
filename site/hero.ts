// The landing page lens: real Polymarket prices and headlines, drawn by the app's own screen code.
import { getEvent, getHistory, getNews, type Headline } from '../src/api'
import { card, lead } from '../src/screens'
import { draw } from './sim/display'
import { fit } from './fit'

const EVENTS = [
  { id: '770450', name: 'Fed decision' },
  { id: '89502', name: 'Bitcoin 2026' },
  { id: '659671', name: 'Champions League' },
]
const lens = document.getElementById('lens')!
const tabs = document.getElementById('tabs')!
const when = document.getElementById('when')!
fit(lens)
document.querySelectorAll<HTMLElement>('.lens.fit').forEach(fit)

let current = 0
let timer = 0
async function show(i: number, auto = false) {
  current = i
  tabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
  const { id } = EVENTS[i]
  try {
    const e = await getEvent(id)
    const m = lead(e)
    const [hist, news] = await Promise.all([
      m?.yesToken ? getHistory(m.yesToken).catch(() => null) : Promise.resolve(null),
      getNews(e.title).catch(() => [] as Headline[]),
    ])
    if (current !== i) return
    draw(lens, [{ containerID: 1, xPosition: 0, yPosition: 0, width: 576, height: 288, paddingLength: 8, content: card(e, hist, 5, '', news) }], null)
    when.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  } catch {
    if (!auto) draw(lens, [{ containerID: 1, xPosition: 0, yPosition: 0, width: 576, height: 288, paddingLength: 8, content: 'Polymarket did not answer.\nTry again in a moment.' }], null)
  }
}

tabs.innerHTML = EVENTS.map((e) => `<button type="button" aria-pressed="false">${e.name}</button>`).join('')
tabs.querySelectorAll('button').forEach((b, i) => (b.onclick = () => { clearInterval(timer); void show(i); timer = window.setInterval(() => void show(current, true), 15000) }))
void show(0)
timer = window.setInterval(() => void show((current + 1) % EVENTS.length, true), 9000)
