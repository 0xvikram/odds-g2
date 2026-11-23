// Watchlist and paper ledger, kept on the device. Nothing here ever leaves it.

export interface Watched { id: string; title: string }
export interface Position {
  id: string
  eventId: string
  eventTitle: string
  marketId: string
  label: string // what was bet on, e.g. "No change" or "Yes"
  outcomeIndex: number
  stake: number // USD (paper)
  entry: number // price paid per share, 0–1
  shares: number // stake / entry; each pays $1 if it happens
  openedAt: number
  closedAt?: number
  exit?: number
}

const KEY_WATCH = 'odds.watch.v1'
const KEY_POS = 'odds.positions.v1'
const KEY_ALERT = 'odds.alertPts.v1'

/** First run: three demo events with daily movement (picked 22 Nov; prices are always live). */
const DEFAULT_WATCH: Watched[] = [
  { id: '770450', title: 'Fed Decision in December?' },
  { id: '89502', title: 'What price will Bitcoin hit in 2026?' },
  { id: '659671', title: 'UEFA Champions League 2027 Champion' },
]

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked: keep going in memory */ }
}

let watch = read<Watched[]>(KEY_WATCH, DEFAULT_WATCH)
let positions = read<Position[]>(KEY_POS, [])
let alertPts = read<number>(KEY_ALERT, 5)

export const getWatch = () => watch
export function follow(w: Watched) {
  if (!watch.some((x) => x.id === w.id)) watch = [w, ...watch].slice(0, 20)
  write(KEY_WATCH, watch)
}
export function unfollow(id: string) {
  watch = watch.filter((x) => x.id !== id)
  write(KEY_WATCH, watch)
}

export const getAlertPts = () => alertPts
export function setAlertPts(n: number) {
  alertPts = Math.min(50, Math.max(1, n))
  write(KEY_ALERT, alertPts)
}

export const openPositions = () => positions.filter((p) => p.closedAt == null)
export const allPositions = () => positions

export function openPosition(p: Omit<Position, 'id' | 'shares' | 'openedAt'>): Position {
  const pos: Position = { ...p, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, shares: p.stake / p.entry, openedAt: Date.now() }
  positions = [pos, ...positions]
  write(KEY_POS, positions)
  return pos
}

/** Realises every open position on an event at the given prices. Returns how many were closed. */
export function closeOnEvent(eventId: string, priceOf: (p: Position) => number | null): number {
  let n = 0
  positions = positions.map((p) => {
    if (p.eventId !== eventId || p.closedAt != null) return p
    const exit = priceOf(p)
    if (exit == null) return p
    n++
    return { ...p, closedAt: Date.now(), exit }
  })
  write(KEY_POS, positions)
  return n
}

export const valueAt = (p: Position, price: number) => p.shares * price
export const pnlAt = (p: Position, price: number) => p.shares * price - p.stake
