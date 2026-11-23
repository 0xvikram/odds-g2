// Push-to-talk: collect G2 mic PCM (s16le, 16 kHz, mono) while the press is held,
// then send it once as a WAV to the Odds backend for transcription.
export const API = (import.meta.env.VITE_API as string | undefined) ?? 'https://odds-g2.vercel.app'

const RATE = 16000
const MAX_SECONDS = 25

export class PushToTalk {
  private chunks: Uint8Array[] = []
  private bytes = 0
  recording = false

  start() {
    this.chunks = []
    this.bytes = 0
    this.recording = true
  }

  push(pcm: Uint8Array) {
    if (!this.recording || this.bytes >= RATE * 2 * MAX_SECONDS) return
    this.chunks.push(pcm.slice())
    this.bytes += pcm.byteLength
  }

  /** Stops recording. Returns the clip as a WAV, 'short' for an accidental press, or 'silent' if nothing was said. */
  stop(): Blob | 'short' | 'silent' {
    this.recording = false
    if (this.bytes < RATE * 2 * 0.3) return 'short'
    if (loudest(this.chunks) < 250) return 'silent' // never send silence: Whisper hallucinates words from it
    return wav(this.chunks, this.bytes)
  }
}

function wav(chunks: Uint8Array[], dataBytes: number): Blob {
  const h = new DataView(new ArrayBuffer(44))
  const str = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); h.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE')
  str(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true)
  h.setUint32(24, RATE, true); h.setUint32(28, RATE * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true)
  str(36, 'data'); h.setUint32(40, dataBytes, true)
  return new Blob([h.buffer, ...chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer)], { type: 'audio/wav' })
}

export async function transcribe(clip: Blob): Promise<string> {
  const r = await fetch(`${API}/api/stt`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: clip })
  const d = (await r.json()) as { text?: string; error?: string }
  if (!r.ok) throw new Error(d.error ?? `speech service ${r.status}`)
  return d.text ?? ''
}

/** RMS of the loudest chunk (each chunk is ~100 ms of s16le). */
function loudest(chunks: Uint8Array[]): number {
  let best = 0
  for (const c of chunks) {
    const v = new DataView(c.buffer, c.byteOffset, c.byteLength)
    let sum = 0, n = 0
    for (let i = 0; i + 1 < c.byteLength; i += 2) { const x = v.getInt16(i, true); sum += x * x; n++ }
    if (n) best = Math.max(best, Math.sqrt(sum / n))
  }
  return best
}
