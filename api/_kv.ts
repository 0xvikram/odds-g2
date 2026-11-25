// Tiny Upstash Redis client over its REST API (no dependency). Used only for Telegram alerts:
// which device is linked to which chat, and what that device follows. Nothing else is stored.

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? ''
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ''

export const kvReady = () => !!URL_ && !!TOKEN

export async function kv<T = any>(...cmd: (string | number)[]): Promise<T> {
  const r = await fetch(URL_, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd.map(String)), signal: AbortSignal.timeout(5000) })
  const d = await r.json()
  if (!r.ok || d.error) throw new Error(`kv ${cmd[0]}: ${d.error ?? r.status}`)
  return d.result as T
}

export async function getJsonKey<T>(key: string): Promise<T | null> {
  const v = await kv<string | null>('GET', key)
  return v ? (JSON.parse(v) as T) : null
}
export const setJsonKey = (key: string, v: unknown, ttlSeconds?: number) =>
  ttlSeconds ? kv('SET', key, JSON.stringify(v), 'EX', ttlSeconds) : kv('SET', key, JSON.stringify(v))

/** A device id is a random 32-character id the app makes once; it is the only key to that device's alerts. */
export const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[a-z0-9]{16,40}$/.test(d)

export interface Bet { id: string; eventId: string; marketId: string; label: string; outcomeIndex: number; stake: number; entry: number }
/** What a linked device follows, kept up to date by the app. */
export interface DeviceState {
  chatId: number
  watch: { id: string; title: string }[]
  alertPts: number
  bets: Bet[]
  /** Price at the last alert (or first check) per event: alerts fire on a move from here, so one move alerts once. */
  base: Record<string, { marketId: string; price: number; at: number }>
  /** Bets already announced as settled. */
  told: string[]
  linkedAt: number
}

export const devKey = (device: string) => `dev:${device}`
