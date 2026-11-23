// Shared helpers for the Odds backend (Vercel functions, US region).
// Every route is read-only except /api/stt, and no route stores anything.

export const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS, ...extra } })
}

export const preflight = () => new Response(null, { status: 204, headers: CORS })

/** fetch with a timeout and one retry (Polymarket hosts drop some connections). */
export async function getJson(url: string, timeoutMs = 6000): Promise<any> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json', 'user-agent': 'odds-g2/0.1' } })
      if (!r.ok) throw new Error(`upstream ${r.status}`)
      return await r.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

export const GAMMA = 'https://gamma-api.polymarket.com'
export const CLOB = 'https://clob.polymarket.com'

const num = (x: unknown) => (x == null || x === '' ? null : Number(x))
const arr = (x: unknown): string[] => {
  if (Array.isArray(x)) return x.map(String)
  try { return JSON.parse(String(x ?? '[]')).map(String) } catch { return [] }
}

/** One market reduced to what the glasses need. Null when resolved or unpriced. */
export function slimMarket(m: any) {
  const outcomes = arr(m.outcomes)
  const prices = arr(m.outcomePrices).map(Number)
  const tokens = arr(m.clobTokenIds)
  const yes = prices[0]
  if (m.closed || !outcomes.length || yes == null || Number.isNaN(yes) || yes <= 0 || yes >= 1) return null
  return {
    id: String(m.id),
    question: String(m.question ?? ''),
    label: String(m.groupItemTitle || outcomes[0] || m.question || ''),
    outcomes,
    prices,
    yesToken: tokens[0] ?? null,
    change1h: num(m.oneHourPriceChange),
    change1d: num(m.oneDayPriceChange),
    volume24h: num(m.volume24hr),
  }
}
