// Voice command parser. Rules only: no model ever decides an amount or an outcome.

export type Intent =
  | { kind: 'home' }
  | { kind: 'positions' }
  | { kind: 'unfollow' }
  | { kind: 'close' }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'follow'; query: string }
  | { kind: 'bet'; amount: number; outcome: string }
  | { kind: 'alert'; points: number }
  | { kind: 'unknown'; text: string }

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

/** Turns number words into digits: "twenty five" → "25", "a hundred" → "100", "two hundred fifty" → "250". */
export function wordsToDigits(text: string): string {
  const words = text.split(/\s+/)
  const out: string[] = []
  let i = 0
  while (i < words.length) {
    let w = words[i]
    let total = 0, current = 0, used = 0
    if ((w === 'a' || w === 'one') && words[i + 1] === 'hundred') { current = 1; i++; w = words[i]; used++ }
    for (; i < words.length; i++) {
      w = words[i]
      if (w in SMALL) current += SMALL[w]
      else if (w in TENS) current += TENS[w]
      else if (w === 'hundred' && (current > 0 || used)) current = Math.max(current, 1) * 100
      else if (w === 'thousand' && current > 0) { total += current * 1000; current = 0 }
      else if (w === 'and' && used && i + 1 < words.length && (words[i + 1] in SMALL || words[i + 1] in TENS)) continue
      else break
      used++
    }
    if (used) out.push(String(total + current))
    else { out.push(words[i]); i++ }
  }
  return out.join(' ')
}

export function normalize(raw: string): string {
  let t = raw.toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^a-z0-9$.%' ]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = wordsToDigits(t)
  return t.replace(/\$\s*(\d)/g, '$$$1').replace(/\s+/g, ' ').trim()
}

const strip = (s: string) => s.replace(/^(the|a|an|on)\s+/, '').replace(/\s+(please|now|thanks|thank you)$/, '').trim()

export function parse(raw: string): Intent {
  const t = normalize(raw)
  if (!t) return { kind: 'unknown', text: raw }

  if (/^(go )?(back|home|watch ?list|main menu|go home)$/.test(t)) return { kind: 'home' }
  if (/^(show )?(my )?(positions?|bets|portfolio|p ?n ?l|pnl)$/.test(t)) return { kind: 'positions' }
  if (/^(unfollow|stop (watching|following)|remove( this| it)?|forget (it|this))$/.test(t)) return { kind: 'unfollow' }
  if (/^(close|sell|cash out|exit)( (it|this|the position|my position|position))?$/.test(t)) return { kind: 'close' }
  if (/^(yes|yeah|yep|confirm|place it|do it|go ahead)( (please|place it|do it|confirm it|confirm))*$/.test(t)) return { kind: 'yes' }
  if (/^(no|nope|cancel|never ?mind|don't)( please)?$/.test(t)) return { kind: 'no' }

  let m = t.match(/^(?:set (?:an |the )?)?alert (?:at|to|for) (\d+(?:\.\d+)?) ?(?:%|percent|points?|pts)?$/)
  if (m) return { kind: 'alert', points: Number(m[1]) }

  // "$20 on hold", "put 20 dollars on yes", "bet ten on arsenal", "20 bucks on no"
  m = t.match(/^(?:(?:put|bet|place|buy) )?\$?(\d+(?:\.\d+)?) ?(?:dollars?|bucks|usd|usdc)? (?:on|for) (.+)$/)
  if (m) {
    const amount = Number(m[1])
    const outcome = strip(m[2])
    if (amount > 0 && outcome) return { kind: 'bet', amount, outcome }
  }

  m = t.match(/^(?:follow|watch|add|track|open|show(?: me)?|check)(?: the)? (.+)$/) ??
      t.match(/^what(?:'s| is) (.+?) doing$/) ??
      t.match(/^how(?:'s| is) (.+?) (?:doing|looking)$/)
  if (m) {
    const query = strip(m[1]).replace(/\b(market|odds|event|bet)s?$/, '').trim()
    if (query.length >= 2) return { kind: 'follow', query }
  }
  return { kind: 'unknown', text: raw }
}

export interface MarketLike { label: string; outcomes: string[] }

/**
 * Finds what the user meant by `said` inside an event.
 * Multi-market events ("Fed decision"): matches a market label and buys its first outcome (Yes).
 * Single binary markets: "yes"/"no" (or the outcome names) pick the outcome.
 */
export function matchOutcome(said: string, markets: MarketLike[]): { market: number; outcome: number } | null {
  const s = normalize(said)
  if (!s || !markets.length) return null
  const words = (x: string) => normalize(x).split(' ').filter((w) => w.length > 1 || /\d/.test(w))
  const sw = new Set(words(s))

  if (markets.length === 1) {
    const outs = markets[0].outcomes.map((o) => normalize(o))
    const i = outs.findIndex((o) => o === s || o === s.replace(/^it /, ''))
    if (i >= 0) return { market: 0, outcome: i }
    if (/^(yes|it happens|happens)$/.test(s)) return { market: 0, outcome: 0 }
    if (/^(no|it doesn't|doesn't happen)$/.test(s) && outs.length > 1) return { market: 0, outcome: 1 }
  }

  let best = -1, bestScore = 0
  markets.forEach((mk, idx) => {
    const lw = words(mk.label)
    if (!lw.length) return
    const hits = lw.filter((w) => sw.has(w) || [...sw].some((x) => x.length > 3 && (w.startsWith(x) || x.startsWith(w)))).length
    const score = hits / lw.length + (normalize(mk.label) === s ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = idx }
  })
  return best >= 0 && bestScore >= 0.5 ? { market: best, outcome: 0 } : null
}
