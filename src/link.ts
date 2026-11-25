// Telegram alerts from the app's side. The glasses run one app at a time, so a market that moves while Odds is
// closed can only reach the user through their phone: the backend checks the watchlist every few minutes and
// messages a linked Telegram chat. Until a chat is linked, nothing about this device is stored anywhere.
import { API } from './voice'
import * as store from './store'

const KEY_DEVICE = 'odds.device.v1'

function deviceId(): string {
  try {
    const have = localStorage.getItem(KEY_DEVICE)
    if (have) return have
    const id = crypto.randomUUID().replace(/-/g, '')
    localStorage.setItem(KEY_DEVICE, id)
    return id
  } catch { return 'nostorage' + Math.random().toString(36).slice(2, 14) }
}
const device = deviceId()

export interface LinkStatus { ready: boolean; linked: boolean; bot: string | null; pending: string | null }
let linked = false
export const isLinked = () => linked

async function call<T>(method: 'GET' | 'POST', body?: object): Promise<T> {
  const url = method === 'GET' ? `${API}/api/sync?device=${device}` : `${API}/api/sync`
  const r = await fetch(url, {
    method, signal: AbortSignal.timeout(8000),
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device, ...body }) } : {}),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? `backend ${r.status}`)
  return d as T
}

/** Is a chat linked, and did an alert arrive since the app was last open? (pending is read once.) */
export async function status(): Promise<LinkStatus> {
  const s = await call<LinkStatus>('GET')
  linked = s.linked
  return s
}

/** A fresh 6-letter code (15 minutes) and the t.me link that sends it to the bot. */
export const requestCode = () => call<{ code: string; bot: string; url: string }>('POST', { action: 'link' })

export async function unlink() {
  await call('POST', { action: 'unlink' })
  linked = false
}

/** Sends what the alerts need: the watchlist, the alert line and the open paper bets. Only while linked. */
export async function pushState() {
  if (!linked) return
  const bets = store.openPositions().map(({ id, eventId, marketId, label, outcomeIndex, stake, entry }) => ({ id, eventId, marketId, label, outcomeIndex, stake, entry }))
  await call('POST', { action: 'state', watch: store.getWatch(), alertPts: store.getAlertPts(), bets }).catch(() => {})
}

let timer = 0
store.onChange(() => {
  clearTimeout(timer)
  timer = window.setTimeout(() => void pushState(), 1500)
})
