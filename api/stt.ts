// POST /api/stt  body: audio/wav (16 kHz mono PCM, up to ~30 s)  →  { text }
// The Groq key stays here; the glasses app never sees it.
import { CORS, json, preflight } from './_lib.js'

export const config = { maxDuration: 30 }
const MAX_BYTES = 16000 * 2 * 30 + 44 // 30 s of 16 kHz s16 mono plus a WAV header

export function OPTIONS() { return preflight() }

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY
  if (!key) return json({ error: 'server not configured' }, 500)
  const buf = await req.arrayBuffer()
  if (buf.byteLength < 44 + 3200) return json({ error: 'audio too short' }, 400)
  if (buf.byteLength > MAX_BYTES) return json({ error: 'audio too long (max 30 s)' }, 413)
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, 4))
  if (head !== 'RIFF') return json({ error: 'expected a WAV file' }, 415)

  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'audio/wav' }), 'speech.wav')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'en')
  form.append('response_format', 'json')
  form.append('temperature', '0')
  // Bias Whisper toward the words people say to Odds.
  form.append('prompt', 'Polymarket odds. Follow the Fed decision. Twenty on hold. Ten dollars on yes. Positions. Bitcoin. Champions League.')

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) return json({ error: `speech service ${r.status}` }, 502)
  const out = (await r.json()) as { text?: string }
  return json({ text: (out.text ?? '').trim() }, 200, { 'cache-control': 'no-store', ...CORS })
}
