// Telegram alerts end to end against fakes for Redis (Upstash REST), Telegram and Polymarket:
// link with a code → app sends its watchlist and bets → a market moves → a bet resolves → app opens on the alert.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.KV_REST_API_URL = 'https://kv.test'
process.env.KV_REST_API_TOKEN = 'kv-token'
process.env.TG_BOT_TOKEN = 'bot-token'
process.env.TG_BOT_NAME = 'OddsAlertsBot'
process.env.TG_WEBHOOK_SECRET = 'hook-secret'
process.env.TICK_SECRET = 'tick-secret'

// ── fakes ──
const db = new Map<string, string>()
const sets = new Map<string, Set<string>>()
const sent: { chat: number; text: string }[] = []
const gamma: Record<string, any> = {}

function redis(cmd: string[]): unknown {
  const [op, key, ...rest] = cmd
  switch (op) {
    case 'GET': return db.get(key) ?? null
    case 'GETDEL': { const v = db.get(key) ?? null; db.delete(key); return v }
    case 'SET': db.set(key, rest[0]); return 'OK'
    case 'DEL': return db.delete(key) ? 1 : 0
    case 'SADD': { const s = sets.get(key) ?? new Set(); s.add(rest[0]); sets.set(key, s); return 1 }
    case 'SREM': sets.get(key)?.delete(rest[0]); return 1
    case 'SMEMBERS': return [...(sets.get(key) ?? [])]
  }
  throw new Error('fake redis: ' + op)
}

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input)
  const body = init?.body ? JSON.parse(String(init.body)) : null
  if (url === 'https://kv.test') return Response.json({ result: redis(body) })
  if (url.startsWith('https://api.telegram.org/botbot-token/')) {
    if (url.endsWith('/sendMessage')) sent.push({ chat: body.chat_id, text: body.text })
    return Response.json({ ok: true, result: {} })
  }
  const ev = url.match(/gamma-api\.polymarket\.com\/events\/(\d+)$/)
  if (ev) return gamma[ev[1]] ? Response.json(gamma[ev[1]]) : new Response('{}', { status: 404 })
  throw new Error('unexpected fetch ' + url)
}) as typeof fetch

const market = (id: string, label: string, yes: number, extra: object = {}) => ({
  id, groupItemTitle: label, outcomes: '["Yes","No"]', outcomePrices: JSON.stringify([String(yes), String(1 - yes)]), closed: false, volume24hr: 1000, ...extra,
})

const sync = await import('../api/sync.ts')
const tgHook = await import('../api/tg.ts')
const tick = await import('../api/tick.ts')

const DEVICE = 'abcdef0123456789abcdef0123456789'
const CHAT = 4242
const post = (h: any, body: object, headers: Record<string, string> = {}) =>
  h.POST(new Request('https://odds-g2.vercel.app/api/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })).then((r: Response) => r.json())
const runTick = (auth = 'Bearer tick-secret') => tick.GET(new Request('https://odds-g2.vercel.app/api/tick', { headers: { authorization: auth } }))
const telegram = (text: string, secret = 'hook-secret') =>
  tgHook.POST(new Request('https://odds-g2.vercel.app/api/tg', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify({ message: { chat: { id: CHAT, type: 'private' }, text } }) }))

test('nothing is stored before linking', async () => {
  const r = await post(sync, { device: DEVICE, action: 'state', watch: [{ id: '770450', title: 'Fed' }], alertPts: 5, bets: [] })
  assert.deepEqual(r, { linked: false })
  assert.equal(db.size, 0)
})

test('the bot refuses updates without the webhook secret, and ticks without the admin secret', async () => {
  assert.equal((await telegram('/start ABCDEF', 'wrong')).status, 401)
  assert.equal((await runTick('Bearer nope')).status, 401)
})

test('link: code from the app, /start CODE in Telegram', async () => {
  const { code, url } = await post(sync, { device: DEVICE, action: 'link' })
  assert.match(code, /^[A-Z2-9]{6}$/)
  assert.equal(url, `https://t.me/OddsAlertsBot?start=${code}`)
  await telegram(`/start ${code}`)
  assert.match(sent.at(-1)!.text, /^Linked to your glasses/)
  const st = await (await sync.GET(new Request(`https://x/api/sync?device=${DEVICE}`))).json()
  assert.equal(st.linked, true)
  await telegram(`/start ${code}`) // a code works once
  assert.match(sent.at(-1)!.text, /expired or was already used/)
})

test('a move past the alert line messages once, and the app then opens on that market', async () => {
  gamma['770450'] = { id: '770450', title: 'Fed Decision in December?', markets: [market('501', '25 bps increase', 0.6), market('502', 'No change', 0.38)] }
  gamma['89502'] = { id: '89502', title: 'Bitcoin above 100k?', markets: [market('601', 'Yes', 0.3)] }
  await post(sync, { device: DEVICE, action: 'state', alertPts: 5,
    watch: [{ id: '770450', title: 'Fed Decision in December?' }, { id: '89502', title: 'Bitcoin above 100k?' }],
    bets: [{ id: 'bet1', eventId: '89502', marketId: '601', label: 'Yes', outcomeIndex: 0, stake: 20, entry: 0.4 }] })

  const before = sent.length
  await runTick() // first look: records where each market is, sends nothing
  assert.equal(sent.length, before)

  gamma['770450'].markets[0] = market('501', '25 bps increase', 0.63) // +3: under the line
  await runTick()
  assert.equal(sent.length, before)

  gamma['770450'].markets[0] = market('501', '25 bps increase', 0.68) // +8 from 60%
  await runTick()
  assert.equal(sent.length, before + 1)
  assert.match(sent.at(-1)!.text, /25 bps increase: 60% → 68%, up 8 pts/)

  await runTick() // same price: no repeat
  assert.equal(sent.length, before + 1)

  const st = await (await sync.GET(new Request(`https://x/api/sync?device=${DEVICE}`))).json()
  assert.equal(st.pending, '770450')
  const again = await (await sync.GET(new Request(`https://x/api/sync?device=${DEVICE}`))).json()
  assert.equal(again.pending, null) // read once
})

test('a resolved market settles the paper bet in Telegram, once', async () => {
  gamma['89502'].markets[0] = market('601', 'Yes', 0.3, { closed: true, outcomePrices: '["1","0"]', resolutionStatus: 'resolved' })
  const before = sent.length
  await runTick()
  assert.equal(sent.length, before + 1)
  assert.match(sent.at(-1)!.text, /Paper bet settled: WON/)
  assert.match(sent.at(-1)!.text, /\$20 on Yes at 40¢ → paid \$50\.00 \(\+\$30\.00\)/)
  await runTick()
  assert.equal(sent.length, before + 1)
})

test('/stop unlinks and removes what was stored', async () => {
  await telegram('/stop')
  assert.match(sent.at(-1)!.text, /^Unlinked/)
  assert.equal(db.get(`dev:${DEVICE}`), undefined)
  assert.equal(sets.get('devices')?.has(DEVICE), false)
})
