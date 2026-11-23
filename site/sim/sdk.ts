// Stand-in for @evenrealities/even_hub_sdk on the product site. The real Odds app (src/main.ts) runs
// unchanged against it: page containers are drawn on a 576×288 display, the buttons send the same
// events the glasses send, and the browser microphone streams 16 kHz s16le PCM like the G2 mic.
import { draw, type TextBox, type ListBox } from './display'

export enum OsEventTypeList {
  CLICK_EVENT = 0, SCROLL_TOP_EVENT = 1, SCROLL_BOTTOM_EVENT = 2, DOUBLE_CLICK_EVENT = 3,
  FOREGROUND_ENTER_EVENT = 4, FOREGROUND_EXIT_EVENT = 5, ABNORMAL_EXIT_EVENT = 6, SYSTEM_EXIT_EVENT = 7,
  IMU_DATA_REPORT = 8, LONG_PRESS_EVENT = 9, LONG_PRESS_RELEASE_EVENT = 10,
}

class Props { constructor(o: object) { Object.assign(this, o) } }
export class TextContainerProperty extends Props {}
export class ListItemContainerProperty extends Props {}
export class ListContainerProperty extends Props {}
export class CreateStartUpPageContainer extends Props {}
export class RebuildPageContainer extends Props {}
export class TextContainerUpgrade extends Props {}

type Page = { textObject?: any[]; listObject?: any[] }
type Listener = (e: any) => void
export type Action = 'up' | 'down' | 'click' | 'double_click' | 'long_press' | 'long_press_release'

class Mic {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: ScriptProcessorNode | null = null
  async start(onPcm: (pcm: Uint8Array) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    this.ctx = new AudioContext()
    const src = this.ctx.createMediaStreamSource(this.stream)
    this.node = this.ctx.createScriptProcessor(4096, 1, 1)
    const ratio = this.ctx.sampleRate / 16000
    this.node.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0)
      const n = Math.floor(input.length / ratio)
      const out = new DataView(new ArrayBuffer(n * 2))
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio))
        let s = 0
        for (let j = a; j < b; j++) s += input[j]
        const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)))
        out.setInt16(i * 2, v * 32767, true)
      }
      onPcm(new Uint8Array(out.buffer))
    }
    src.connect(this.node)
    this.node.connect(this.ctx.destination)
  }
  stop() {
    this.node?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.node = null; this.stream = null; this.ctx = null
  }
}

class SimBridge {
  private listeners: Listener[] = []
  private texts: TextBox[] = []
  private list: ListBox | null = null
  private sel = 0
  private mic = new Mic()
  closed = false
  el: HTMLElement | null = null
  onMicError: (e: unknown) => void = () => {}
  onClose: () => void = () => {}

  private set(page: Page) {
    this.texts = (page.textObject ?? []).map((t) => ({ ...t }))
    const l = page.listObject?.[0]
    this.list = l ? { ...l, items: [...(l.itemContainer?.itemName ?? [])] } : null
    this.sel = 0
    this.paint()
  }
  private paint() { if (this.el && !this.closed) draw(this.el, this.texts, this.list, this.sel) }
  private emit(e: any) { for (const l of this.listeners) l(e) }

  async createStartUpPageContainer(c: Page) { this.set(c); return 0 }
  async rebuildPageContainer(c: Page) { this.set(c); return true }
  async textContainerUpgrade(u: { containerID: number; content: string }) {
    const t = this.texts.find((x) => x.containerID === u.containerID)
    if (t) { t.content = u.content; this.paint() }
    return true
  }
  async audioControl(on: boolean) {
    if (on) await this.mic.start((pcm) => this.emit({ audioEvent: { audioPcm: pcm } })).catch((e) => this.onMicError(e))
    else this.mic.stop()
    return true
  }
  shutDownPageContainer() { this.closed = true; this.mic.stop(); this.onClose() }
  onEvenHubEvent(cb: Listener) { this.listeners.push(cb); return () => { this.listeners = this.listeners.filter((x) => x !== cb) } }

  /** The ring / temple input, as the simulator's automation API names it. */
  input(a: Action) {
    if (this.closed) return
    const capture = this.list ? 'list' : 'text'
    switch (a) {
      case 'up':
      case 'down':
        if (this.list) { this.sel = Math.max(0, Math.min(this.list.items.length - 1, this.sel + (a === 'down' ? 1 : -1))); this.paint() }
        else this.emit({ textEvent: { eventType: a === 'up' ? 1 : 2 } })
        return
      case 'click':
        return this.emit(capture === 'list' ? { listEvent: { currentSelectItemIndex: this.sel } } : { textEvent: {} })
      case 'double_click': return this.emit({ sysEvent: { eventType: 3 } })
      case 'long_press': return this.emit({ sysEvent: { eventType: 9 } })
      case 'long_press_release': return this.emit({ sysEvent: { eventType: 10 } })
    }
  }
}

export const sim = new SimBridge()
export const waitForEvenAppBridge = async () => sim
