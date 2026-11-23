// GET /api/history?token=<clobTokenId>  →  { points: [{ t, p }] } hourly over the last 24 h
import { CLOB, getJson, json, preflight } from './_lib.js'

export function OPTIONS() { return preflight() }

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^\d{10,90}$/.test(token)) return json({ error: 'token must be a CLOB token id' }, 400)
  try {
    const d = await getJson(`${CLOB}/prices-history?market=${token}&interval=1d&fidelity=60`)
    const points = (d.history ?? []).map((x: any) => ({ t: Number(x.t), p: Number(x.p) }))
    return json({ points }, 200, { 'cache-control': 's-maxage=120, stale-while-revalidate=300' })
  } catch (e) {
    return json({ error: 'Polymarket did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}
