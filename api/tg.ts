// Telegram bot webhook.
//   POST (from Telegram, checked by its secret header): /start CODE links this chat to the glasses that showed the code;
//        /status lists what is followed; /stop unlinks.
//   GET ?setup=1 with "authorization: Bearer $TICK_SECRET" points the bot's webhook here (run once after deploy).
import { json } from './_lib.js'
import { kv, kvReady, getJsonKey, setJsonKey, devKey, type DeviceState } from './_kv.js'
import { tg, tgReady, send } from './_tg.js'

const SECRET = process.env.TG_WEBHOOK_SECRET ?? ''
const ADMIN = process.env.TICK_SECRET ?? ''

const HELLO = [
  'Hi, I am the Odds bot.',
  '',
  'Odds shows live Polymarket odds on Even Realities G2 glasses. The glasses run one app at a time, so when a market you follow moves while Odds is closed, I message you here. I also tell you when a paper bet settles.',
  '',
  'To link: on your glasses, hold and say "connect Telegram", then tap the link in the Even app (or send me the code).',
].join('\n')

export async function GET(req: Request) {
  if (!ADMIN || req.headers.get('authorization') !== `Bearer ${ADMIN}`) return json({ error: 'not allowed' }, 401)
  if (!tgReady() || !SECRET) return json({ error: 'TG_BOT_TOKEN, TG_BOT_NAME and TG_WEBHOOK_SECRET must be set' }, 503)
  const url = `${new URL(req.url).origin}/api/tg`
  await tg('setWebhook', { url, secret_token: SECRET, allowed_updates: ['message'], drop_pending_updates: true })
  await tg('setMyCommands', { commands: [
    { command: 'status', description: 'What I am watching for you' },
    { command: 'stop', description: 'Unlink and stop alerts' },
  ] })
  await tg('setMyDescription', { description: 'Alerts from Odds, the Polymarket app for Even Realities G2 glasses: big moves on markets you follow, and settled paper bets.' })
  return json({ ok: true, webhook: url })
}

export async function POST(req: Request) {
  if (!SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return json({ error: 'not allowed' }, 401)
  if (!kvReady() || !tgReady()) return json({ ok: true })
  const update = await req.json().catch(() => null)
  const msg = update?.message
  const chatId: number | undefined = msg?.chat?.id
  const text = String(msg?.text ?? '').trim()
  if (!chatId || msg.chat.type !== 'private') return json({ ok: true })
  try {
    await handle(chatId, text)
  } catch (e) {
    console.error('[tg] failed', e)
    await send(chatId, 'Something went wrong on my side. Try again in a minute.').catch(() => {})
  }
  return json({ ok: true }) // always 200, or Telegram keeps retrying the same update
}

async function handle(chatId: number, text: string) {
  const code = (text.match(/^\/start\s+([A-Za-z0-9]{6})$/)?.[1] ?? text.match(/^([A-Za-z0-9]{6})$/)?.[1])?.toUpperCase()
  if (code) return link(chatId, code)
  const device = await kv<string | null>('GET', `chat:${chatId}`)
  if (/^\/stop\b/.test(text)) {
    if (!device) return send(chatId, 'This chat is not linked to any glasses.')
    await Promise.all([kv('DEL', devKey(device)), kv('SREM', 'devices', device), kv('DEL', `chat:${chatId}`)])
    return send(chatId, 'Unlinked. No more alerts. Say "connect Telegram" on your glasses to link again.')
  }
  if (/^\/status\b/.test(text) && device) {
    const dev = await getJsonKey<DeviceState>(devKey(device))
    if (dev) return send(chatId, statusText(dev))
  }
  return send(chatId, device ? 'Linked. I will message you here. /status shows what I watch, /stop unlinks.' : HELLO)
}

async function link(chatId: number, code: string) {
  const device = await kv<string | null>('GETDEL', `link:${code}`)
  if (!device) return send(chatId, 'That code has expired or was already used. On your glasses, say "connect Telegram" again for a new one.')
  const old = await kv<string | null>('GET', `chat:${chatId}`)
  if (old && old !== device) await Promise.all([kv('DEL', devKey(old)), kv('SREM', 'devices', old)]) // one pair of glasses per chat
  const prev = await getJsonKey<DeviceState>(devKey(device))
  const dev: DeviceState = prev ? { ...prev, chatId } : { chatId, watch: [], alertPts: 5, bets: [], base: {}, told: [], linkedAt: Date.now() }
  await Promise.all([setJsonKey(devKey(device), dev), kv('SADD', 'devices', device), kv('SET', `chat:${chatId}`, device)])
  return send(chatId, [
    'Linked to your glasses.',
    '',
    'I check your watchlist every few minutes. When a market moves by your alert line (5 pts unless you set another) I message you, and the next time you open Odds it starts on that market.',
    'When a paper bet settles, I tell you if it won or lost.',
    '',
    '/status shows what I watch, /stop unlinks.',
  ].join('\n'))
}

function statusText(d: DeviceState): string {
  const lines = [`Alert line: ${d.alertPts} pts`, '', d.watch.length ? 'Watching:' : 'Your watchlist is empty.']
  for (const w of d.watch.slice(0, 10)) {
    const b = d.base[w.id]
    lines.push(`• ${w.title}${b ? ` (last ${Math.round(b.price * 100)}%)` : ''}`)
  }
  if (d.bets.length) lines.push('', `Open paper bets: ${d.bets.length}`)
  return lines.join('\n')
}
