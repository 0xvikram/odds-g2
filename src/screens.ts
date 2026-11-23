// Text for each glasses screen. 576×288 display, one font, ~42 characters a line, no emoji.
import type { EventData, Market, Headline } from './api'
import type { Position } from './store'
import { pnlAt } from './store'

export const RULE = '━━━━━━━━━━━━━━━━━━━━━━━━'
const BLOCKS = '▁▂▃▄▅▆▇█'

export function cut(s: string, n: number): string {
  s = s.replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

export function pct(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '–'
  const v = p * 100
  if (v >= 99.5) return '>99%'
  if (v < 0.5) return '<1%'
  return (v < 10 && Math.round(v) !== v ? v.toFixed(1) : String(Math.round(v))) + '%'
}

/** Price change over the last hour as ▲2 / ▼1 / ━ (in percentage points). */
export function delta(ch: number | null | undefined): string {
  if (ch == null) return '━'
  const pts = ch * 100
  if (Math.abs(pts) < 0.5) return '━'
  return `${pts > 0 ? '▲' : '▼'}${Math.abs(pts) < 10 ? Math.round(Math.abs(pts) * 10) / 10 : Math.round(Math.abs(pts))}`
}

export function spark(points: number[], width = 24): string {
  if (points.length < 2) return ''
  const step = points.length / width
  const pick = points.length <= width ? points : Array.from({ length: width }, (_, i) => points[Math.floor(i * step)])
  const lo = Math.min(...pick), hi = Math.max(...pick)
  if (hi - lo < 0.005) return BLOCKS[3].repeat(pick.length) // flat: draw a level line
  return pick.map((p) => BLOCKS[Math.round(((p - lo) / (hi - lo)) * (BLOCKS.length - 1))]).join('')
}

/** The market people care about: the leading one, or the only one. */
/** Polymarket keeps unpriced slots ("Other", "Team H" at 50%) on some events: never lead with them. */
export const isPlaceholder = (m: Market) => /^(other|team [a-z])$/i.test(m.label.trim()) || (m.prices[0] === 0.5 && !m.volume24h)
export const lead = (e: EventData): Market | null => e.markets.find((m) => !isPlaceholder(m)) ?? e.markets[0] ?? null

/** For a single yes/no market show "Yes"; for a multi-market event show the market's name. */
export const nameOf = (e: EventData, m: Market) => (e.markets.length === 1 ? m.outcomes[0] ?? 'Yes' : m.label)

export function shortTitle(t: string, n = 24): string {
  return cut(t.replace(/\?$/, '').replace(/^(what|which|who|will) /i, '').replace(/\b(price will|will hit)\b/i, ''), n)
}

/** One watchlist row (list items hold up to 64 characters). */
export function watchRow(title: string, e: EventData | null): string {
  if (!e) return `${shortTitle(title, 30)}  …`
  const m = lead(e)
  if (!m) return `${shortTitle(title, 30)}  closed`
  return cut(`${shortTitle(e.title, 22)}: ${cut(nameOf(e, m), 14)} ${pct(m.prices[0])} ${delta(m.change1h)}`, 62)
}

export function header(left: string, right = ''): string {
  const t = new Date()
  const clock = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  return `${cut(left, 30)}${right ? '  ' + right : ''}   ${clock}`
}

/** "2h ago", "35m ago" */
export function ago(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60000))
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

/** Splits text into at most `lines` lines of `width` characters, the last one cut with "…". */
export function wrap(text: string, width: number, lines: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of text.replace(/\s+/g, ' ').trim().split(' ')) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w
    else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  if (out.length > lines) { out.length = lines; out[lines - 1] = cut(out[lines - 1] + ' …', width) }
  return out.map((l) => cut(l, width))
}

/** news: undefined = not asked, null = loading, [] = nothing found, else the newest headline is shown. */
export function card(e: EventData, history: number[] | null, alertPts: number, note = '', news?: Headline[] | null): string {
  const m = lead(e)
  const lines = [cut(e.title.toUpperCase(), 40)]
  if (!m) return [...lines, '', 'This market has closed.', '', 'Double-tap: back'].join('\n')
  lines.push(`${cut(nameOf(e, m), 26)}   ${pct(m.prices[0])}  ${delta(m.change1h)} 1h`)
  lines.push(RULE)
  const sp = history ? spark(history) : ''
  lines.push(sp ? `${sp}  24h` : history ? 'No trades in the last 24h' : 'Loading 24h…')
  const others = e.markets.filter((x) => x !== m && !isPlaceholder(x)).slice(0, 3).map((x) => `${cut(x.label, 14)} ${pct(x.prices[0])}`)
  if (e.markets.length === 1 && m.outcomes[1]) others.push(`${m.outcomes[1]} ${pct(m.prices[1] ?? 1 - m.prices[0])}`)
  if (others.length) lines.push(cut(others.join(' · '), 44))
  lines.push(RULE)
  const moved = m.change1h != null && Math.abs(m.change1h * 100) >= alertPts
  const status = moved ? `! Moved ${Math.round(Math.abs(m.change1h! * 100))} pts in 1h` : `Alert at ${alertPts} pts in 1h`
  if (note) lines.push(note)
  else if (news === undefined) lines.push(status)
  else if (news === null) lines.push(`${status} · Checking news…`)
  else if (!news.length) lines.push(`${status} · No news in 24h`)
  else {
    const h = news[0]
    lines.push(cut(`${moved ? status + ' · ' : 'NEWS · '}${h.source}, ${ago(h.at)}`, 44))
    lines.push(...wrap(`"${h.title}"`, 42, 2))
    return lines.join('\n') // the headline takes the help line's place
  }
  lines.push('Hold: speak · Swipe: next · 2×tap: back')
  return lines.join('\n')
}

export function confirmText(stake: number, name: string, price: number): string {
  const shares = stake / price
  return [
    'PAPER BET',
    `$${stake % 1 ? stake.toFixed(2) : stake} on ${cut(name, 24).toUpperCase()} @ ${Math.round(price * 100)}¢`,
    `Pays $${shares.toFixed(2)} if it happens`,
  ].join('\n')
}

export function positionsText(open: Position[], priceOf: (p: Position) => number | null): string {
  if (!open.length) return ['POSITIONS · paper', RULE, 'No open bets.', '', 'Open an event and say', '"20 on <outcome>".', '', 'Double-tap: back'].join('\n')
  let total = 0, known = true
  const rows = open.slice(0, 6).map((p) => {
    const now = priceOf(p)
    if (now == null) { known = false; return `${cut(p.label, 14)}  $${p.stake} @${Math.round(p.entry * 100)}¢ → …` }
    const pnl = pnlAt(p, now)
    total += pnl
    return `${cut(p.label, 14)}  $${p.stake} @${Math.round(p.entry * 100)}¢→${Math.round(now * 100)}¢  ${money(pnl)}`
  })
  return [`POSITIONS · paper   ${known ? money(total) : '…'}`, RULE, ...rows, RULE, 'Hold: "close" on an event to sell'].join('\n')
}

export const money = (x: number) => `${x < 0 ? '-' : '+'}$${Math.abs(x).toFixed(2)}`
