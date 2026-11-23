// GET /api/event?id=770450  →  { id, title, endDate, markets: [...] } (open, priced markets, highest price first)
import { GAMMA, getJson, json, preflight, slimMarket } from './_lib.js'

export function OPTIONS() { return preflight() }

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^\d{1,12}$/.test(id)) return json({ error: 'id must be a number' }, 400)
  try {
    const e = await getJson(`${GAMMA}/events/${id}`)
    const markets = (e.markets ?? []).map(slimMarket).filter(Boolean).sort((a: any, b: any) => b.prices[0] - a.prices[0])
    return json({ id: String(e.id), title: String(e.title), endDate: e.endDate ?? null, markets, at: Date.now() }, 200, { 'cache-control': 's-maxage=10, stale-while-revalidate=20' })
  } catch (e) {
    return json({ error: 'Polymarket did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}
