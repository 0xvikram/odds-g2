// Odds, day 1: hold the touchpad (or R1 ring) to speak; release to transcribe.
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { PushToTalk, transcribe } from './voice'
import { mountUi, setStatus, setTranscript } from './ui'

mountUi()
const bridge = await waitForEvenAppBridge()

const IDLE = 'ODDS\n\nHold to speak.\nTry: "follow the Fed decision"\n\nDouble-tap to exit.'
const screen = new TextContainerProperty({
  xPosition: 0, yPosition: 0, width: 576, height: 288,
  borderWidth: 0, borderColor: 5, paddingLength: 8,
  containerID: 1, containerName: 'main', content: IDLE, isEventCapture: 1,
})
const created = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [screen] }))
if (created !== 0) setStatus('error', `createStartUpPageContainer failed: ${created}`)

let shown = IDLE
async function show(text: string) {
  if (text === shown) return
  shown = text
  await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'main', content: text }))
}

const ptt = new PushToTalk()
setStatus('paused', 'Hold the touchpad or ring to speak · double-tap to exit')

async function startTalking() {
  if (ptt.recording) return
  ptt.start()
  await bridge.audioControl(true)
  await show('● Listening…')
  setStatus('listening', 'Listening… release to send')
  console.log('[odds] listening')
}

async function stopTalking() {
  if (!ptt.recording) return
  await bridge.audioControl(false)
  const clip = ptt.stop()
  if (clip === 'short') { await show(IDLE); setStatus('paused', 'Too short. Hold while you speak.'); return }
  if (clip === 'silent') { await show("Didn't hear anything.\nHold, speak, then let go."); setStatus('paused', 'No speech picked up by the mic'); return }
  await show('○ Thinking…')
  try {
    const text = await transcribe(clip)
    console.log('[odds] heard:', text)
    setTranscript(text, '')
    await show(text ? `Heard:\n"${text}"` : "Didn't catch that.\nTry: \"follow the Fed decision\"")
    setStatus('paused', 'Hold to speak again')
  } catch (e) {
    console.error('[odds] stt failed', e)
    await show('Speech service unavailable.\nTry again in a moment.')
    setStatus('error', String((e as Error).message ?? e))
  }
}

// CLICK_EVENT is 0 and protobuf drops zero values, so a present envelope with no eventType is a click.
const typeOf = (env?: { eventType?: OsEventTypeList }) => (env ? env.eventType ?? OsEventTypeList.CLICK_EVENT : null)

const unsubscribe = bridge.onEvenHubEvent((event) => {
  const pcm = event.audioEvent?.audioPcm
  if (pcm) { ptt.push(pcm); return }
  const types = [typeOf(event.sysEvent), typeOf(event.textEvent), typeOf(event.listEvent)]
  const is = (t: OsEventTypeList) => types.includes(t)
  if (is(OsEventTypeList.DOUBLE_CLICK_EVENT)) { bridge.shutDownPageContainer(1); return }
  if (is(OsEventTypeList.LONG_PRESS_EVENT)) { void startTalking(); return }
  if (is(OsEventTypeList.LONG_PRESS_RELEASE_EVENT)) { void stopTalking(); return }
  if (is(OsEventTypeList.SYSTEM_EXIT_EVENT) || is(OsEventTypeList.ABNORMAL_EXIT_EVENT)) cleanup()
})

let cleaned = false
function cleanup() {
  if (cleaned) return
  cleaned = true
  void bridge.audioControl(false)
  unsubscribe()
}
window.addEventListener('beforeunload', cleanup)
