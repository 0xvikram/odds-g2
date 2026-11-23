// GET /api/search?q=fed+december  →  { events: [{ id, title, endDate, top: {label, price} }] } (max 3, active only)
import { GAMMA, getJson, isPlaceholder, json, preflight, slimMarket } from './_lib.js'

export function OPTIONS() { return preflight() }

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return json({ error: 'q is required' }, 400)
  try {
    const d = await getJson(`${GAMMA}/public-search?q=${encodeURIComponent(q)}&limit_per_type=8&events_status=active`)
    const events = (d.events ?? [])
      .filter((e: any) => e.active && !e.closed)
      .map((e: any) => {
        const markets = (e.markets ?? []).map(slimMarket).filter(Boolean) as ReturnType<typeof slimMarket>[]
        const real = markets.filter((m) => !isPlaceholder(m!))
        const top = (real.length ? real : markets).sort((a, b) => b!.prices[0] - a!.prices[0])[0]
        return top ? { id: String(e.id), title: String(e.title), endDate: e.endDate ?? null, top: { label: top.label, price: top.prices[0] } } : null
      })
      .filter(Boolean)
      .slice(0, 3)
    return json({ events }, 200, { 'cache-control': 's-maxage=30, stale-while-revalidate=60' })
  } catch (e) {
    return json({ error: 'Polymarket did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}
