# Odds · DoraHacks submission text

Paste-ready. Hackathon: Heads Up: Even Realities G2 · Track 02 Crypto & DeFi.

## Name
Odds

## One-liner
Say any market, keep the odds in sight: live Polymarket odds on Even Realities G2, by voice.

## Links
- Product site: https://odds-g2.vercel.app
- Try it without glasses (the real app code in the browser): https://odds-g2.vercel.app/try
- Code (MIT): https://github.com/0xvikram/odds-g2
- Even Hub package (v0.2.0): https://odds-g2.vercel.app/odds.ehpk (also odds.ehpk in the repo)
- Demo video: https://youtu.be/_knwOpd7hxc

## Description
Prediction markets price the world in real time: a rate decision in Washington, an election in Brazil, a final in Madrid. Checking one still means taking out a phone, opening an app, searching and scrolling. In a meeting, on a run or on a call, you don't.

Odds puts live Polymarket odds on G2. Hold the ring or touchpad and say any market in your own words ("watch the Champions League", "what's bitcoin doing?"). Odds searches every open Polymarket event and shows the three best matches; one tap follows it.

Each card is built for a 576 × 288 glance: the leading outcome, its 1-hour change, a 24-hour line and the runners-up, refreshed every 15 seconds. Swipe to move between the markets you follow.

**Why did it move?** When a market moves past your alert line, or when you ask "why did it move?", Odds puts the newest headline that names the market under the price, with the outlet and how long ago. No AI writes or picks the line; if nothing matches, it says "No news in 24h".

**Paper bets by voice.** Say "20 on Barcelona": Odds shows stake, price and payout and waits for one tap. A paper portfolio tracks live P&L, and "close it" sells at today's price. When the market resolves, the bet settles itself: WON pays $1 a share, LOST pays nothing, and a market that has stopped trading but has no final result says "closed, result soon".

**Alerts when Odds is closed.** G2 shows one app at a time, so a market can move while you're in another app. Say "connect Telegram": the glasses show a code and the Even app shows a one-tap link to the Odds bot. From then on the backend checks your watchlist every 5 minutes and messages you when a market moves past your line, or when a paper bet settles. The next time you open Odds, it starts on that market.

**Who it's for.** People who already follow prediction markets and can't keep a phone out: the glance between meetings, on a run, on a call, and the alert in the hour a market moves. Free covers following, paper bets and a few alerts a day; a Pro plan (unlimited alerts, a line per market, a morning brief) and, later, real orders with the same tap to confirm would pay for it. The paid plan is not built yet.

## Safety
- Paper only: no wallet, no keys, no real orders. The ledger lives on the device; linking Telegram copies only the watchlist, alert line and open bets, and /stop deletes them.
- Rules, not a model, read the amount and the outcome. No exact outcome match, no bet.
- Every bet needs a tap on "Yes, place it".
- Silent presses are never sent to speech-to-text, so Whisper can't invent a command from silence.

## How it's built
- **Glasses:** Even Hub app (TypeScript, Even Hub SDK 0.0.16): list and text containers, `textContainerUpgrade` for flicker-free live numbers, long-press push-to-talk with the G2 mic (16 kHz PCM), double-tap back. Tested in the official Even Hub simulator 0.9.5.
- **Backend (Vercel):** `/api/stt` (Whisper large-v3-turbo on Groq, with a loudness guard), `/api/search` and `/api/event` (Polymarket Gamma; resolved and placeholder markets filtered), `/api/history` (Polymarket CLOB, 24 h hourly), `/api/news` (Google News RSS, last 24 h, ranked by market words). `/api/sync`, `/api/tg`, `/api/tick` (Telegram alerts: link code, bot webhook, 5-minute check from GitHub Actions; Upstash Redis holds only linked devices). No keys on the glasses.
- **Site simulator:** `/try` runs the unchanged app code against a stand-in SDK that draws the G2 display in the page, maps buttons to ring events and streams the browser mic as 16 kHz PCM.
- Tests: `npm test` (voice parser, outcome matching, headline matching, bet settlement, and the Telegram alert flow end to end against fakes).

## API feature requests
1. **Even Hub: background alerts.** The WebView pauses when the app is closed, so a "market moved 5 points" alert only shows while Odds is open. Ask: a small background task or a server push that can show one line on the display. Unlocks: real glanceable alerts for odds, prices and messages, the main reason to wear the glasses.
2. **Even Hub: a large headline style.** There is one fixed font size, so the most important number (the odds) looks the same as a footnote. Ask: one larger size or a bold weight for a single text container. Unlocks: numbers readable at a glance while walking.
3. **Even Hub: built-in speech-to-text.** Every voice app streams raw microphone audio to its own server and pays for transcription; we added a backend just for this. Ask: an SDK call that returns a transcript (with the audio staying on the phone where possible). Unlocks: voice apps with no server, lower latency and better privacy.
4. **Even Hub: simulator recording, and documented automation routes.** The automation port has a glasses screenshot route we found by trial, but no way to record, and neither is in the docs. Ask: a documented record route (frames or video) next to `/api/input` and `/api/screenshot`. Unlocks: scripted, repeatable demo videos and visual UI tests in CI.
5. **Polymarket: a public read API that works in every region, plus a paper-trading sandbox.** From India the price-history host was unreachable and the events host dropped about half the calls, so even read-only apps need a proxy. There is also no official sandbox for practice orders. Ask: CORS-enabled public read endpoints served everywhere, and a sandbox with fake balances. Unlocks: wearable and voice apps that show real order flow safely, without each one running its own proxy.

## Prior work
`PREP.md` holds planning notes written on 22 Nov, before the code window; no code. The push-to-talk wiring started from the Even Hub ASR template (MIT, credited in the README).
