// The launch film under the hero. Loads only when near the screen, plays muted on a loop while visible and pauses
// when scrolled away (the Restocked pattern). "Sound on" unmutes and restarts from the top so the music lands on
// the cuts. Reduced motion: nothing plays until the viewer asks.
const box = document.getElementById('film-player')
const video = box?.querySelector('video')
const playBtn = box?.querySelector<HTMLButtonElement>('[data-film="play"]')
const soundBtn = box?.querySelector<HTMLButtonElement>('[data-film="sound"]')
const bar = box?.querySelector<HTMLElement>('.film-progress i')

if (box && video && playBtn && soundBtn && bar) {
  const SRC = '/film.mp4'
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  let visible = false
  let userPaused = calm
  const attach = () => { if (!video.getAttribute('src')) { video.src = SRC; video.load() } }
  const play = () => { attach(); video.play().catch(() => {}) }

  const label = () => {
    const on = !video.paused
    playBtn.querySelector('span')!.textContent = on ? 'Pause' : 'Play the film · 67 s'
    playBtn.querySelector('svg')!.innerHTML = on ? '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>' : '<path d="M7 4l13 8-13 8z" fill="currentColor"/>'
    playBtn.setAttribute('aria-label', on ? 'Pause the film' : 'Play the film')
    soundBtn.setAttribute('aria-pressed', String(!video.muted))
    soundBtn.querySelector('span')!.textContent = video.muted ? 'Sound off' : 'Sound on'
    soundBtn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off')
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible && !userPaused) play()
    else if (!visible) video.pause()
  }, { rootMargin: '200px 0px', threshold: 0.35 }).observe(box)

  const toggle = () => {
    if (video.paused) { userPaused = false; play() } else { userPaused = true; video.pause() }
  }
  video.addEventListener('click', toggle)
  playBtn.addEventListener('click', toggle)
  soundBtn.addEventListener('click', () => {
    if (video.muted) { video.muted = false; video.currentTime = 0; userPaused = false; play() }
    else video.muted = true
    label()
  })
  for (const ev of ['play', 'pause', 'volumechange']) video.addEventListener(ev, label)
  video.addEventListener('timeupdate', () => { bar.style.transform = `scaleX(${video.currentTime / (video.duration || 1)})` })
  label()
}
