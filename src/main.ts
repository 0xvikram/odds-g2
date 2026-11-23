// Odds: live Polymarket odds on G2, by voice. Hold to speak anywhere; tap to open or confirm;
// swipe to move; double-tap goes back (and exits from the watchlist).
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { PushToTalk, transcribe } from './voice'
import { mountUi, setStatus, setTranscript } from './ui'
import { parse, matchOutcome, type Intent } from './parse'
import { getEvent, cachedEvent, search, getHistory, getNews, type EventData, type SearchHit, type Headline } from './api'
import * as store from './store'
import { card, confirmText, positionsText, watchRow, header, lead, nameOf, cut, RULE } from './screens'

mountUi()
const bridge = await waitForEvenAppBridge()

type Screen =
  | { name: 'home' }
  | { name: 'search'; query: string; hits: SearchHit[] }
  | { name: 'card'; id: string }
  | { name: 'confirm'; eventId: string; stake: number; marketIdx: number; outcomeIdx: number; price: number; label: string; back: string }
  | { name: 'positions' }

let screen: Screen = { name: 'home' }
let listItems: string[] = [] // what the current list shows, to map a tap back to an action
let headerText = ''
let lastInput = 0
/** Headlines for the open card: shown when it moves past the alert line, or when asked "why". */
let news: { id: string; items: Headline[] | null } | null = null

// ───────────────────────────── page building ─────────────────────────────

const textBox = (content: string, capture: boolean, y = 0, h = 288) =>
  new TextContainerProperty({ xPosition: 0, yPosition: y, width: 576, height: h, borderWidth: 0, borderColor: 5, paddingLength: 8,
    containerID: 1, containerName: 'main', content, isEventCapture: capture ? 1 : 0 })

const listBox = (items: string[], y: number) =>
  new ListContainerProperty({ xPosition: 0, yPosition: y, width: 576, height: 288 - y, borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 2, containerName: 'list', isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({ itemCount: items.length, itemWidth: 568, isItemSelectBorderEn: 1, itemName: items.map((s) => cut(s, 62)) }) })

let started = false
async function page(textObject: TextContainerProperty[], listObject: ListContainerProperty[] = []) {
  const containerTotalNum = textObject.length + listObject.length
  if (!started) {
    started = true
    const r = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum, textObject, listObject }))
    if (r !== 0) setStatus('error', `createStartUpPageContainer failed: ${r}`)
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer({ containerTotalNum, textObject, listObject }))
  }
}

async function textPage(content: string) {
  listItems = []
  headerText = content
  await page([textBox(content, true)])
}

async function listPage(head: string, items: string[]) {
  listItems = items
  headerText = head
  const lines = head.split('\n').length
  const h = Math.min(120, 14 + lines * 30)
  await page([textBox(head, false, 0, h)], [listBox(items, h)])
}

/** Rewrites the text container in place (no flicker): live numbers, overlays, notes. */
async function upgrade(content: string) {
  headerText = content
  await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'main', content }))
}

// ───────────────────────────── screens ─────────────────────────────

async function showHome(note = '') {
  screen = { name: 'home' }
  const watch = store.getWatch()
  if (!watch.length) return textPage(['ODDS', RULE, 'Nothing watched yet.', '', 'Hold and say:', '"follow the Fed decision"', '"what\'s bitcoin doing"', '', note].join('\n'))
  await Promise.allSettled(watch.map((w) => getEvent(w.id)))
  const rows = watch.map((w) => watchRow(w.title, cachedEvent(w.id)))
  await listPage(note || header(`ODDS · ${watch.length} watching`), rows)
}

async function showSearch(query: string, hits: SearchHit[]) {
  screen = { name: 'search', query, hits }
  await listPage(`Pick one · "${cut(query, 24)}"`, hits.map((h) => `${cut(h.title, 40)} ${Math.round(h.top.price * 100)}%`))
}

async function showCard(id: string, note = '') {
  screen = { name: 'card', id }
  const cached = cachedEvent(id)
  if (!cached) await textPage('Loading…')
  let e: EventData
  try { e = await getEvent(id) } catch { return textPage('Polymarket did not answer.\nTry again in a moment.\n\nDouble-tap: back') }
  if (screen.name !== 'card' || screen.id !== id) return
  const m = lead(e)
  const hist = m?.yesToken ? await getHistory(m.yesToken).catch(() => null) : null
  if (screen.name !== 'card' || screen.id !== id) return
  const moved = m?.change1h != null && Math.abs(m.change1h * 100) >= store.getAlertPts()
  if (moved && news?.id !== id) void loadNews(id, e.title)
  const text = card(e, hist, store.getAlertPts(), note, news?.id === id ? news.items : undefined)
  if (listItems.length || !cached || headerText === 'Loading…') await textPage(text)
  else await upgrade(text)
}

async function loadNews(id: string, title: string) {
  news = { id, items: null }
  const items = await getNews(title).catch(() => [] as Headline[])
  if (news?.id !== id) return
  news = { id, items }
  console.log('[odds] news', title, items[0]?.title ?? '(none)')
  if (screen.name === 'card' && screen.id === id) await showCard(id)
}

async function showConfirm(c: Extract<Screen, { name: 'confirm' }>) {
  screen = c
  await listPage(confirmText(c.stake, c.label, c.price), ['Yes, place it', 'No'])
}

async function showPositions() {
  screen = { name: 'positions' }
  const open = store.openPositions()
  await Promise.allSettled([...new Set(open.map((p) => p.eventId))].map((id) => getEvent(id)))
  await textPage(positionsText(open, priceOf))
}

function priceOf(p: store.Position): number | null {
  const m = cachedEvent(p.eventId)?.markets.find((x) => x.id === p.marketId)
  return m ? m.prices[p.outcomeIndex] ?? null : null
}

/** A temporary line on whatever screen is showing. */
async function flash(text: string, ms = 2600) {
  const before = screen
  if (screen.name === 'card') await showCard(screen.id, text)
  else await upgrade(listItems.length ? text : `${text}\n\n${headerText}`)
  setTimeout(() => { if (screen === before) void redraw() }, ms)
}

async function redraw() {
  switch (screen.name) {
    case 'home': return showHome()
    case 'search': return showSearch(screen.query, screen.hits)
    case 'card': return showCard(screen.id)
    case 'confirm': return showConfirm(screen)
    case 'positions': return showPositions()
  }
}

// ───────────────────────────── actions ─────────────────────────────

async function openSelected(index: number) {
  if (screen.name === 'home') {
    const w = store.getWatch()[index]
    if (w) await showCard(w.id)
  } else if (screen.name === 'search') {
    const h = screen.hits[index]
    if (!h) return
    store.follow({ id: h.id, title: h.title })
    await showCard(h.id)
  } else if (screen.name === 'confirm') {
    if (index === 0) await placeBet(screen)
    else await showCard(screen.eventId, 'Cancelled. Nothing placed.')
  }
}

async function placeBet(c: Extract<Screen, { name: 'confirm' }>) {
  const e = cachedEvent(c.eventId)
  const m = e?.markets[c.marketIdx]
  if (!e || !m) return showCard(c.eventId, 'Market changed. Nothing placed.')
  store.openPosition({ eventId: e.id, eventTitle: e.title, marketId: m.id, label: c.label, outcomeIndex: c.outcomeIdx, stake: c.stake, entry: c.price })
  console.log('[odds] paper bet', c.stake, c.label, c.price)
  await showPositions()
}

function swipe(dir: 1 | -1) {
  if (screen.name !== 'card') return // lists scroll natively
  const watch = store.getWatch()
  const i = watch.findIndex((w) => w.id === (screen as { id: string }).id)
  if (i < 0 || watch.length < 2) return
  void showCard(watch[(i + dir + watch.length) % watch.length].id)
}

function back() {
  if (screen.name === 'home') { bridge.shutDownPageContainer(1); return }
  if (screen.name === 'confirm') { void showCard(screen.eventId, 'Cancelled. Nothing placed.'); return }
  void showHome()
}

async function act(intent: Intent, heard: string) {
  switch (intent.kind) {
    case 'home': return showHome()
    case 'positions': return showPositions()
    case 'follow': {
      await upgrade(`Searching "${cut(intent.query, 28)}"…`)
      let hits: SearchHit[] = []
      try { hits = await search(intent.query) } catch { return flash('Polymarket did not answer. Try again.') }
      if (!hits.length) return flash(`No open market for "${cut(intent.query, 22)}".`)
      return showSearch(intent.query, hits)
    }
    case 'why': {
      if (screen.name !== 'card') return flash('Open an event, then ask "why".')
      const e = cachedEvent(screen.id)
      if (!e) return flash('Polymarket did not answer. Try again.')
      void loadNews(screen.id, e.title)
      return showCard(screen.id)
    }
    case 'unfollow': {
      if (screen.name !== 'card') return flash('Open an event first.')
      store.unfollow(screen.id)
      return showHome('Removed from your watchlist.')
    }
    case 'alert': {
      store.setAlertPts(intent.points)
      return flash(`Alert when it moves ${store.getAlertPts()} pts in 1h.`)
    }
    case 'bet': {
      if (screen.name !== 'card') return flash('Open an event, then say "20 on <outcome>".')
      const e = cachedEvent(screen.id) ?? (await getEvent(screen.id).catch(() => null))
      if (!e) return flash('Polymarket did not answer. Try again.')
      if (intent.amount < 1 || intent.amount > 1000) return flash('Paper bets go from $1 to $1,000.')
      const names = e.markets.map((m) => ({ label: nameOf(e, m), outcomes: m.outcomes }))
      const hit = matchOutcome(intent.outcome, names)
      if (!hit) return flash(`No outcome called "${cut(intent.outcome, 18)}" here.`)
      const m = e.markets[hit.market]
      const price = m.prices[hit.outcome]
      if (!(price > 0 && price < 1)) return flash('No live price for that outcome.')
      const label = e.markets.length === 1 ? m.outcomes[hit.outcome] : m.label
      return showConfirm({ name: 'confirm', eventId: e.id, stake: intent.amount, marketIdx: hit.market, outcomeIdx: hit.outcome, price, label, back: e.id })
    }
    case 'yes': return screen.name === 'confirm' ? placeBet(screen) : flash('Nothing to confirm.')
    case 'no': return screen.name === 'confirm' ? showCard(screen.eventId, 'Cancelled. Nothing placed.') : redraw()
    case 'close': {
      if (screen.name !== 'card') return flash('Open the event you want to close.')
      const id = screen.id
      await getEvent(id, true).catch(() => null)
      const n = store.closeOnEvent(id, priceOf)
      return n ? showPositions() : flash('No open bet on this event.')
    }
    case 'unknown':
      return flash(heard ? `Didn't catch "${cut(heard, 20)}". Try "follow bitcoin".` : "Didn't catch that.")
  }
}

// ───────────────────────────── push-to-talk ─────────────────────────────

const ptt = new PushToTalk()
let press = 0

async function startTalking() {
  if (ptt.recording) return
  const my = ++press
  ptt.start()
  await bridge.audioControl(true)
  if (my === press && ptt.recording) { await upgrade('● Listening…'); setStatus('listening', 'Listening… release to send') }
}

async function stopTalking() {
  if (!ptt.recording) return
  press++ // any "Listening…" still on its way is now stale
  await bridge.audioControl(false)
  const clip = ptt.stop()
  if (clip === 'short') return redraw()
  if (clip === 'silent') return flash("Didn't hear anything. Hold, speak, let go.")
  await upgrade('○ Thinking…')
  try {
    const text = await transcribe(clip)
    console.log('[odds] heard:', text)
    setTranscript(text, '')
    setStatus('paused', 'Hold to speak')
    const intent = parse(text)
    console.log('[odds] intent:', JSON.stringify(intent))
    await act(intent, text)
  } catch (e) {
    console.error('[odds] voice failed', e)
    await flash('Speech service unavailable. Try again.')
  }
}

// The browser simulator on the product site types commands; they take the same path as speech.
;(globalThis as { oddsSay?: (text: string) => Promise<void> }).oddsSay = async (text: string) => {
  setTranscript(text, '')
  await act(parse(text), text)
}

// ───────────────────────────── input ─────────────────────────────

const typeOf = (env?: { eventType?: OsEventTypeList }) => (env ? env.eventType ?? OsEventTypeList.CLICK_EVENT : null)

const unsubscribe = bridge.onEvenHubEvent((event) => {
  const pcm = event.audioEvent?.audioPcm
  if (pcm) { ptt.push(pcm); return }
  const types = [typeOf(event.sysEvent), typeOf(event.textEvent), typeOf(event.listEvent)]
  const is = (t: OsEventTypeList) => types.includes(t)
  lastInput = Date.now()
  if (is(OsEventTypeList.LONG_PRESS_EVENT)) { void startTalking(); return }
  if (is(OsEventTypeList.LONG_PRESS_RELEASE_EVENT)) { void stopTalking(); return }
  if (is(OsEventTypeList.DOUBLE_CLICK_EVENT)) { back(); return }
  if (is(OsEventTypeList.SCROLL_BOTTOM_EVENT)) { swipe(1); return }
  if (is(OsEventTypeList.SCROLL_TOP_EVENT)) { swipe(-1); return }
  if (is(OsEventTypeList.CLICK_EVENT)) {
    if (event.listEvent) void openSelected(event.listEvent.currentSelectItemIndex ?? 0)
    return
  }
  if (is(OsEventTypeList.SYSTEM_EXIT_EVENT) || is(OsEventTypeList.ABNORMAL_EXIT_EVENT)) cleanup()
})

// Live numbers: the open card every 15 s; the watchlist and positions when idle (rebuilding a list resets its selection).
const timer = window.setInterval(() => {
  if (ptt.recording) return
  if (screen.name === 'card') void getEvent(screen.id, true).then(() => showCard((screen as { id: string }).id)).catch(() => {})
  else if ((screen.name === 'home' || screen.name === 'positions') && Date.now() - lastInput > 20000) void redraw()
}, 15000)

let cleaned = false
function cleanup() {
  if (cleaned) return
  cleaned = true
  clearInterval(timer)
  void bridge.audioControl(false)
  unsubscribe()
}
window.addEventListener('beforeunload', cleanup)

setStatus('paused', 'Hold the touchpad or ring to speak · double-tap to go back')
await showHome()
