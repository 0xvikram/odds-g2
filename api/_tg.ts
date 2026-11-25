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

export const send = (chatId: number, text: string) => tg('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } })
