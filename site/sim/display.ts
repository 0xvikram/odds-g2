// Draws Even Hub page containers (text + list) onto a 576×288 element, the way the G2 shows them.
export interface TextBox { containerID: number; xPosition: number; yPosition: number; width: number; height: number; paddingLength?: number; content: string }
export interface ListBox { xPosition: number; yPosition: number; width: number; height: number; items: string[] }

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

export function draw(el: HTMLElement, texts: TextBox[], list: ListBox | null, sel = 0) {
  const parts = texts.map((t) =>
    `<div class="g-text" style="left:${t.xPosition}px;top:${t.yPosition}px;width:${t.width}px;height:${t.height}px;padding:${t.paddingLength ?? 0}px">${esc(t.content)}</div>`)
  if (list) {
    const rows = list.items.map((s, i) => `<div class="g-item${i === sel ? ' on' : ''}">${esc(s)}</div>`).join('')
    parts.push(`<div class="g-list" style="left:${list.xPosition}px;top:${list.yPosition}px;width:${list.width}px;height:${list.height}px">${rows}</div>`)
  }
  el.innerHTML = parts.join('')
  el.querySelector('.g-item.on')?.scrollIntoView({ block: 'nearest' })
}
