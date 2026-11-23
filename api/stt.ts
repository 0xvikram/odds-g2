// POST /api/stt  body: audio/wav (16 kHz mono PCM, up to ~30 s)  →  { text }
// The Groq key stays here; the glasses app never sees it.
import { CORS, json, preflight } from './_lib.js'

export const config = { maxDuration: 30 }
const SILENCE_RMS = 250 // s16 units; quiet speech is ~1000+, mic hiss ~50
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

  // Whisper invents words from silence, so refuse clips with no speech-level energy.
  const pcm = new Int16Array(buf.slice(44, 44 + Math.floor((buf.byteLength - 44) / 2) * 2))
  if (loudestWindowRms(pcm) < SILENCE_RMS) return json({ text: '', silent: true }, 200, { 'cache-control': 'no-store', ...CORS })

  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'audio/wav' }), 'speech.wav')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'en')
  form.append('response_format', 'json')
  form.append('temperature', '0')

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) return json({ error: `speech service ${r.status}` }, 502)
  const out = (await r.json()) as { text?: string }
  return json({ text: (out.text ?? '').trim() }, 200, { 'cache-control': 'no-store', ...CORS })
}

/** RMS of the loudest 100 ms window. */
function loudestWindowRms(pcm: Int16Array): number {
  const win = 1600
  let best = 0
  for (let i = 0; i + win <= pcm.length; i += win) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += pcm[j] * pcm[j]
    best = Math.max(best, Math.sqrt(sum / win))
  }
  return best
}
