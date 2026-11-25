// GET /api/tick with "authorization: Bearer $TICK_SECRET" — run every 5 minutes by a GitHub Actions schedule.
// For every linked device: message the chat when a followed market moved by the alert line since the last alert,
// and when a paper bet's market resolved. Returns what it sent (counts only).
import { GAMMA, getJson, json, slimMarket, settledMarket, isPlaceholder } from './_lib.js'
import { kv, kvReady, getJsonKey, setJsonKey, devKey, type DeviceState } from './_kv.js'
import { tgReady, send } from './_tg.js'

const ADMIN = process.env.TICK_SECRET ?? ''
const MAX_MESSAGES_PER_DEVICE = 5

export async function GET(req: Request) {
  if (!ADMIN || req.headers.get('authorization') !== `Bearer ${ADMIN}`) return json({ error: 'not allowed' }, 401)
  if (!kvReady() || !tgReady()) return json({ error: 'alerts not set up' }, 503)
  const devices = (await kv<string[]>('SMEMBERS', 'devices')) ?? []
  const events = new Map<string, Promise<any | null>>()
  const event = (id: string) => {
    if (!events.has(id)) events.set(id, getJson(`${GAMMA}/events/${id}`).catch(() => null))
    return events.get(id)!
  }
  let moves = 0, settled = 0, failed = 0
  for (const device of devices.slice(0, 200)) {
    try {
      const r = await checkDevice(device, event)
      moves += r.moves; settled += r.settled
    } catch (e) {
      failed++
      console.error('[tick] device failed', e)
    }
  }
  return json({ devices: devices.length, events: events.size, moves, settled, failed })
}

async function checkDevice(device: string, event: (id: string) => Promise<any | null>) {
  const dev = await getJsonKey<DeviceState>(devKey(device))
  if (!dev) { await kv('SREM', 'devices', device); return { moves: 0, settled: 0 } }
  const out: string[] = []
  let pendingId: string | null = null
  let moves = 0, settled = 0
  dev.base ??= {}
  dev.told ??= []

  for (const w of dev.watch) {
    const e = await event(w.id)
    if (!e) continue
    const markets = (e.markets ?? []).map(slimMarket).filter(Boolean) as NonNullable<ReturnType<typeof slimMarket>>[]
    if (!markets.length) continue
    const base = dev.base[w.id]
    const lead = [...markets].filter((m) => !isPlaceholder(m)).sort((a, b) => b.prices[0] - a.prices[0])[0] ?? markets[0]
    const m = (base && markets.find((x) => x.id === base.marketId)) || lead
    const price = m.prices[0]
    if (!base || base.marketId !== m.id) { dev.base[w.id] = { marketId: m.id, price, at: Date.now() }; continue }
    const pts = (price - base.price) * 100
    if (Math.abs(pts) < dev.alertPts) continue
    const name = markets.length === 1 ? m.outcomes[0] ?? 'Yes' : m.label
    out.push([
      String(e.title),
      `${name}: ${pct(base.price)} → ${pct(price)}, ${pts > 0 ? 'up' : 'down'} ${Math.round(Math.abs(pts))} pts since ${hhmm(base.at)} UTC.`,
      '',
      'Open Odds on your glasses: it starts on this market, with the chart and the latest headline.',
    ].join('\n'))
    dev.base[w.id] = { marketId: m.id, price, at: Date.now() }
    pendingId ??= w.id
    moves++
  }

  for (const b of dev.bets) {
    if (dev.told.includes(b.id)) continue
    const e = await event(b.eventId)
    const raw = e?.markets?.find((x: any) => String(x.id) === b.marketId)
    const s = raw ? settledMarket(raw) : null
    if (!s || s.winner == null) continue
    const won = s.winner === b.outcomeIndex
    const shares = b.entry > 0 ? b.stake / b.entry : 0
    const pnl = won ? shares - b.stake : -b.stake
    out.push([
      `Paper bet settled: ${won ? 'WON' : 'LOST'}`,
      `${e.title}`,
      `$${b.stake} on ${b.label} at ${Math.round(b.entry * 100)}¢ → ${won ? `paid $${shares.toFixed(2)}` : 'paid nothing'} (${pnl < 0 ? '-' : '+'}$${Math.abs(pnl).toFixed(2)}).`,
      '',
      'Paper money only. Odds never places real trades.',
    ].join('\n'))
    dev.told = [...dev.told, b.id].slice(-100)
    settled++
  }

  for (const text of out.slice(0, MAX_MESSAGES_PER_DEVICE)) await send(dev.chatId, text)
  if (out.length > MAX_MESSAGES_PER_DEVICE) await send(dev.chatId, `…and ${out.length - MAX_MESSAGES_PER_DEVICE} more. Open Odds to see them all.`)
  await setJsonKey(devKey(device), dev)
  if (pendingId) await kv('SET', `pending:${device}`, pendingId, 'EX', 86400)
  return { moves, settled }
}

const pct = (p: number) => `${Math.round(p * 100)}%`
const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16)
