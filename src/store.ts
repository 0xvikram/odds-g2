// Watchlist and paper ledger, kept on the device. If the user links Telegram alerts, the watchlist, alert line and
// open bets are copied to the backend so it can message them while the app is closed (see link.ts).

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
  /** Set when the market resolved: the bet paid $1 a share (won) or nothing (lost). Absent for a manual close. */
  result?: 'won' | 'lost'
}

/** What settling needs from an event: its closed markets and, once final, the outcome that paid. */
export interface SettledLike { id: string; winner: number | null }

const KEY_WATCH = 'odds.watch.v1'
const KEY_POS = 'odds.positions.v1'
const KEY_ALERT = 'odds.alertPts.v1'
const KEY_SEEN = 'odds.seen.v1'

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
const listeners: (() => void)[] = []
/** Called after the watchlist, alert line or bets change (Telegram alerts keep their copy in step). */
export const onChange = (fn: () => void) => { listeners.push(fn) }

function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked: keep going in memory */ }
  for (const fn of listeners) fn()
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

/** The price each followed event showed the last time the user looked, for "since you last looked". */
export interface Seen { marketId: string; label: string; price: number; at: number }
let seen = read<Record<string, Seen>>(KEY_SEEN, {})
export const getSeen = () => seen
export function markSeen(eventId: string, s: Seen) {
  seen = { ...seen, [eventId]: s }
  try { localStorage.setItem(KEY_SEEN, JSON.stringify(seen)) } catch { /* storage blocked: keep going in memory */ }
}

export const getAlertPts = () => alertPts
export function setAlertPts(n: number) {
  alertPts = Math.min(50, Math.max(1, n))
  write(KEY_ALERT, alertPts)
}

export const openPositions = () => positions.filter((p) => p.closedAt == null)
export const allPositions = () => positions

/** Removes a bet as if it was never placed (the 10-second undo). Returns whether it existed and was still open. */
export function removePosition(id: string): boolean {
  const before = positions.length
  positions = positions.filter((p) => !(p.id === id && p.closedAt == null))
  if (positions.length === before) return false
  write(KEY_POS, positions)
  return true
}

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

/**
 * Settles every open bet on this event whose market has resolved. A won share pays $1, a lost one $0.
 * Returns the bets it settled (newest state), so the caller can say so.
 */
export function settleFrom(eventId: string, settled: SettledLike[] | undefined): Position[] {
  if (!settled?.length) return []
  const done: Position[] = []
  positions = positions.map((p) => {
    if (p.eventId !== eventId || p.closedAt != null) return p
    const m = settled.find((x) => x.id === p.marketId)
    if (!m || m.winner == null) return p
    const won = m.winner === p.outcomeIndex
    const q: Position = { ...p, closedAt: Date.now(), exit: won ? 1 : 0, result: won ? 'won' : 'lost' }
    done.push(q)
    return q
  })
  if (done.length) write(KEY_POS, positions)
  return done
}

/** True when the bet's market has stopped trading but the result is not final yet. */
export const awaiting = (p: Position, settled: SettledLike[] | undefined) =>
  p.closedAt == null && !!settled?.some((x) => x.id === p.marketId && x.winner == null)

/** Closed bets, newest first (settled by the market or closed by voice). */
export const closedPositions = () => positions.filter((p) => p.closedAt != null).sort((a, b) => b.closedAt! - a.closedAt!)

/** Profit or loss already locked in by closed bets. */
export const realized = () => closedPositions().reduce((t, p) => t + p.shares * (p.exit ?? 0) - p.stake, 0)

export const valueAt = (p: Position, price: number) => p.shares * price
export const pnlAt = (p: Position, price: number) => p.shares * price - p.stake
