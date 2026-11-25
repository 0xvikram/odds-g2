// Telegram Bot API: send a message. The bot token lives only in Vercel's environment.

export const BOT = process.env.TG_BOT_NAME ?? ''
const TOKEN = process.env.TG_BOT_TOKEN ?? ''

export const tgReady = () => !!TOKEN && !!BOT

export async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000),
  })
  const d = await r.json().catch(() => ({}))
  if (!d.ok) throw new Error(`telegram ${method}: ${d.description ?? r.status}`)
  return d.result
}

/** Updates the bot receives. Bump HOOK_VERSION when this changes: /api/tick re-applies the webhook once. */
export const ALLOWED_UPDATES = ['message', 'edited_message']
export const HOOK_VERSION = 'v2'

/** Points the bot's webhook at this backend with the current settings, plus commands and description. */
export async function configureBot(origin: string, secret: string) {
  await tg('setWebhook', { url: `${origin}/api/tg`, secret_token: secret, allowed_updates: ALLOWED_UPDATES })
  await tg('setMyCommands', { commands: [
    { command: 'status', description: 'What I am watching for you' },
    { command: 'stop', description: 'Unlink and stop alerts' },
  ] })
  await tg('setMyDescription', { description: 'Alerts from Odds, the Polymarket app for Even Realities G2 glasses: big moves on markets you follow, and settled paper bets.' })
}

/**
 * The link code in a message: "/start K7Q2MX", "K7Q2MX", or a code inside a sentence ("my code is k7q2mx").
 * Inside a sentence it must contain a digit, so a six-letter word like "please" is not mistaken for one.
 */
export function findCode(text: string): string | null {
  const t = text.trim()
  const whole = t.match(/^(?:\/start\s+)?([A-Za-z0-9]{6})$/)?.[1]
  if (whole) return whole.toUpperCase()
  const inside = t.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{6})(?![A-Za-z0-9])/g)
    ?.map((x) => x.replace(/^[^A-Za-z0-9]/, ''))
    .find((x) => /\d/.test(x))
  return inside ? inside.toUpperCase() : null
}

export const send = (chatId: number, text: string) => tg('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } })
