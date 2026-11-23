/** Scales a 576×288 lens to the width of its box. */
export function fit(lens: HTMLElement) {
  const box = lens.parentElement!
  const apply = () => { lens.style.transform = `scale(${box.clientWidth / 576})` }
  new ResizeObserver(apply).observe(box)
  apply()
}
