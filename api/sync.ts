// Telegram alerts, app side. Only a device that has linked a Telegram chat is stored.
//   GET  /api/sync?device=…                 → { ready, linked, bot, pending }  (pending: event id of the last alert, read once)
//   POST { device, action: 'link' }          → { code, bot, url }  (code lasts 15 minutes; send it to the bot)
//   POST { device, action: 'state', watch, alertPts, bets }  → { linked }  (ignored until linked)
//   POST { device, action: 'unlink' }        → { linked: false }
import { json, preflight } from './_lib.js'
import { kv, kvReady, getJsonKey, setJsonKey, validDevice, devKey, type DeviceState, type Bet } from './_kv.js'
import { BOT, tgReady, send } from './_tg.js'

export function OPTIONS() { return preflight() }

const ready = () => kvReady() && tgReady()
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L

export async function GET(req: Request) {
  const device = new URL(req.url).searchParams.get('device')
  if (!validDevice(device)) return json({ error: 'device is required' }, 400)
  if (!ready()) return json({ ready: false, linked: false, bot: BOT || null, pending: null })
  try {
    const [dev, pending] = await Promise.all([kv<string | null>('GET', devKey(device)), kv<string | null>('GETDEL', `pending:${device}`)])
    return json({ ready: true, linked: !!dev, bot: BOT, pending: pending ?? null })
  } catch (e) {
    return json({ error: 'alerts store did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return json({ error: 'send JSON' }, 400) }
  const device = body?.device
  if (!validDevice(device)) return json({ error: 'device is required' }, 400)
  if (!ready()) return json({ error: 'Telegram alerts are not set up on this server yet' }, 503)
  try {
    switch (body.action) {
      case 'link': {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
        await kv('SET', `link:${code}`, device, 'EX', 900)
        return json({ code, bot: BOT, url: `https://t.me/${BOT}?start=${code}` })
      }
      case 'state': {
        const dev = await getJsonKey<DeviceState>(devKey(device))
        if (!dev) return json({ linked: false })
        const watch = cleanWatch(body.watch)
        const ids = new Set(watch.map((w) => w.id))
        const next: DeviceState = {
          ...dev,
          watch,
          alertPts: Math.min(50, Math.max(1, Number(body.alertPts) || 5)),
          bets: cleanBets(body.bets),
          base: Object.fromEntries(Object.entries(dev.base ?? {}).filter(([id]) => ids.has(id))),
        }
        await setJsonKey(devKey(device), next)
        return json({ linked: true })
      }
      case 'unlink': {
        const dev = await getJsonKey<DeviceState>(devKey(device))
        await Promise.all([kv('DEL', devKey(device)), kv('SREM', 'devices', device), dev ? kv('DEL', `chat:${dev.chatId}`) : null])
        if (dev) await send(dev.chatId, 'Odds is unlinked. No more alerts from me. Say "connect Telegram" on your glasses to link again.').catch(() => {})
        return json({ linked: false })
      }
      default:
        return json({ error: 'unknown action' }, 400)
    }
  } catch (e) {
    return json({ error: 'alerts store did not answer', detail: String((e as Error).message ?? e) }, 502)
  }
}

const str = (x: unknown, n: number) => String(x ?? '').slice(0, n)
const isId = (x: unknown) => /^\d{1,12}$/.test(String(x))

function cleanWatch(x: unknown): DeviceState['watch'] {
  if (!Array.isArray(x)) return []
  return x.filter((w) => isId(w?.id)).slice(0, 20).map((w) => ({ id: String(w.id), title: str(w.title, 140) }))
}

function cleanBets(x: unknown): Bet[] {
  if (!Array.isArray(x)) return []
  return x.filter((b) => isId(b?.eventId) && isId(b?.marketId)).slice(0, 50).map((b) => ({
    id: str(b.id, 24), eventId: String(b.eventId), marketId: String(b.marketId), label: str(b.label, 60),
    outcomeIndex: Number(b.outcomeIndex) || 0, stake: Number(b.stake) || 0, entry: Number(b.entry) || 0,
  }))
}
