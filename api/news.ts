// GET /api/news?title=Fed+Decision+in+December  →  { query, items: [{ title, source, at }] }
// Up to 3 headlines from the last 24 h that mention the market (Google News RSS). Read-only, stores nothing.
import { json, preflight } from './_lib.js'
import { newsQuery, parseRss, pickHeadlines } from './_news.js'

export function OPTIONS() { return preflight() }

export async function GET(req: Request) {
  const title = (new URL(req.url).searchParams.get('title') ?? '').trim().slice(0, 160)
  const query = newsQuery(title)
  if (query.length < 2) return json({ error: 'title is required' }, 400)
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:1d')}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'odds-g2/0.1' } })
    if (!r.ok) throw new Error(`upstream ${r.status}`)
    const items = pickHeadlines(parseRss(await r.text()), query, Date.now())
    return json({ query, items }, 200, { 'cache-control': 's-maxage=600, stale-while-revalidate=600' })
  } catch (e) {
    return json({ error: 'News did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}
