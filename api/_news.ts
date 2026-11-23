// Pure helpers for /api/news: build a search query from a market title, read Google News RSS,
// and keep only recent headlines that mention the market. No model writes or picks the headline.

export interface Headline { title: string; source: string; at: number }

const STOP = new Set(('what which who will the a an in of on by for to be is are at as and or vs ' +
  'price hit reach end before after during next new this that than above below over under more less ' +
  'winner champion win wins happen happens').split(' '))

/** "What price will Bitcoin hit in 2026?" → "bitcoin"; "Fed Decision in December?" → "fed decision december". */
export function newsQuery(title: string): string {
  const words = title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w && !STOP.has(w) && !/^(19|20)\d\d$/.test(w) && !/^\d+$/.test(w))
  return [...new Set(words)].slice(0, 5).join(' ')
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' }
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#\d+|[a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? (e[0] === '#' ? String.fromCharCode(Number(e.slice(1))) : m))
  .replace(/\s+/g, ' ').trim()

export function parseRss(xml: string): Headline[] {
  const out: Headline[] = []
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const tag = (n: string) => decode(it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1] ?? '')
    const source = tag('source')
    let title = tag('title')
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim()
    const at = Date.parse(tag('pubDate'))
    if (title && !Number.isNaN(at)) out.push({ title, source: source || 'News', at })
  }
  return out
}

const MOVE = /\b(surg|soar|jump|rall|climb|ris|gain|fall|fell|drop|slid|slump|plung|tumbl|sink|crash|whipsaw|swing|spike|hike|cut|pause|hold|lead|win|beat|lose|lost|injur|bets?|poll|vote|ruling|sues?|ban|approv|reject|announc|warn)/i

/** Recent headlines that name the market, best first: more market words, then a word for a move, then newest. */
export function pickHeadlines(items: Headline[], query: string, now: number, hours = 24, max = 3): Headline[] {
  const keys = query.split(' ').filter((w) => w.length > 2)
  const seen = new Set<string>()
  return items
    .filter((h) => h.at <= now + 600000 && now - h.at <= hours * 3600000)
    .map((h) => ({ h, score: keys.filter((k) => new RegExp(`\\b${k}`, 'i').test(h.title)).length }))
    .filter((x) => !keys.length || x.score > 0)
    .map((x) => ({ ...x, score: x.score + (MOVE.test(x.h.title) ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score || b.h.at - a.h.at)
    .map((x) => x.h)
    .filter((h) => { const k = h.title.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, max)
}
