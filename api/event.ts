// GET /api/event?id=770450  →  { id, title, endDate, markets: [...], settled: [...] }
// markets: open, priced, highest price first. settled: closed markets with the winning outcome once final.
import { GAMMA, getJson, json, preflight, slimMarket, settledMarket } from './_lib.js'

export function OPTIONS() { return preflight() }

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^\d{1,12}$/.test(id)) return json({ error: 'id must be a number' }, 400)
  try {
    const e = await getJson(`${GAMMA}/events/${id}`)
    const markets = (e.markets ?? []).map(slimMarket).filter(Boolean).sort((a: any, b: any) => b.prices[0] - a.prices[0])
    const settled = (e.markets ?? []).map(settledMarket).filter(Boolean)
    return json({ id: String(e.id), title: String(e.title), endDate: e.endDate ?? null, closed: !!e.closed, markets, settled, at: Date.now() }, 200, { 'cache-control': 's-maxage=10, stale-while-revalidate=20' })
  } catch (e) {
    return json({ error: 'Polymarket did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}
