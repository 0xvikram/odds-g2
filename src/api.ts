// Calls to the Odds backend (which proxies Polymarket and runs speech-to-text).
import { API } from './voice'

export interface Market {
  id: string
  question: string
  label: string
  outcomes: string[]
  prices: number[]
  yesToken: string | null
  change1h: number | null
  change1d: number | null
  volume24h: number | null
}
/** A closed market. winner is the outcome that paid $1, or null while the result is not final. */
export interface Settled { id: string; label: string; outcomes: string[]; winner: number | null }
export interface EventData { id: string; title: string; endDate: string | null; closed?: boolean; markets: Market[]; settled?: Settled[]; at: number }
export interface SearchHit { id: string; title: string; endDate: string | null; top: { label: string; price: number } }

async function get<T>(path: string, timeoutMs = 12000): Promise<T> {
  const r = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(timeoutMs) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? `backend ${r.status}`)
  return d as T
}

const events = new Map<string, EventData>()
/** Event with live prices; served from a 10 s cache so screens can re-render freely. */
export async function getEvent(id: string, fresh = false): Promise<EventData> {
  const hit = events.get(id)
  if (hit && !fresh && Date.now() - hit.at < 10000) return hit
  const d = await get<EventData>(`/api/event?id=${encodeURIComponent(id)}`)
  d.at = Date.now()
  events.set(id, d)
  return d
}
export const cachedEvent = (id: string) => events.get(id) ?? null

export const search = (q: string) => get<{ events: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((d) => d.events)

const histories = new Map<string, { at: number; points: number[] }>()
/** Hourly prices over the last 24 h (0–1), cached for 5 minutes. */
export async function getHistory(token: string): Promise<number[]> {
  const hit = histories.get(token)
  if (hit && Date.now() - hit.at < 300000) return hit.points
  const d = await get<{ points: { t: number; p: number }[] }>(`/api/history?token=${encodeURIComponent(token)}`)
  const points = d.points.map((x) => x.p)
  histories.set(token, { at: Date.now(), points })
  return points
}

export interface Headline { title: string; source: string; at: number }
const news = new Map<string, { at: number; items: Headline[] }>()
/** Up to 3 headlines from the last 24 h that mention this event, cached for 10 minutes. */
export async function getNews(title: string): Promise<Headline[]> {
  const hit = news.get(title)
  if (hit && Date.now() - hit.at < 600000) return hit.items
  const d = await get<{ items: Headline[] }>(`/api/news?title=${encodeURIComponent(title)}`)
  news.set(title, { at: Date.now(), items: d.items })
  return d.items
}
