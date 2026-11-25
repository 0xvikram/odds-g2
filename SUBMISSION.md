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
- Even Hub package (v0.2.1): https://odds-g2.vercel.app/odds.ehpk (also odds.ehpk in the repo)
- Film (67 s, with sound): https://odds-g2.vercel.app/#film
- Earlier walkthrough: https://youtu.be/_knwOpd7hxc
- Even Hub: private app me.vikram.odds (builds 0.2.0, 0.2.1)
- Telegram alerts bot: @OddsG2AlertsBot

## Description (as on the BUIDL page, 25 Nov 2026)

Prediction markets price the world in real time: a rate decision in Washington, an election in Brazil, a final in Madrid. Checking one still means taking out a phone, opening an app, searching and scrolling. In a meeting, on a run or on a call, you don't. Odds puts the number in front of your eyes, and when a market moves while you're in another app, the move still finds you.

## Useful on G2: a glance, not a terminal
Hold the ring or touchpad and say any market in your own words: "watch the Champions League", "what's bitcoin doing?". Odds searches every open Polymarket event and offers the three best matches; one tap follows it. Most market apps show a fixed top list; Odds finds the one you mean.

Each card is built for a 576 × 288 glance: the leading outcome, its 1-hour change, a 24-hour line and the runners-up, refreshed every 15 seconds. Swipe between the markets you follow.

Why did it move? When a market moves past your alert line, or when you ask "why did it move?", the newest headline that names the market appears under the price, with the outlet and how long ago. No AI writes or picks the line; if nothing matches, it says "No news in 24h".

Alerts while Odds is closed. G2 shows one app at a time, so Odds can't watch markets in the background. Say "connect Telegram": the glasses show a 6-letter code and the Even app shows a one-tap link to @OddsG2AlertsBot. From then on the backend checks your watchlist every 5 minutes and messages you when a market moves past your line ("Fed Decision in December? 25 bps increase: 60% → 68%, up 8 pts") or a paper bet settles. The next time you open Odds, it starts on that market. Nothing to self-host: the bot is live now.

## Read and write, all by voice and one tap
- Read: follow, glance, ask why, check positions.
- Write: "20 on no change" shows stake, price and payout and waits for "Yes, place it". Then 10 seconds to tap or say "undo". "close it" sells at today's price.
- Settle: when Polymarket resolves a market, open bets close themselves: WON pays $1 a share, LOST pays nothing, and a market that stopped trading but has no final result says "closed, result soon". Positions show WON / LOST / SOLD and realised P&L.

## Display and voice
- One fixed font, ~42 characters a line: every screen is written for it (cut titles, ▲▼ changes, a block-character sparkline, a rule line).
- textContainerUpgrade for flicker-free live numbers; lists only where you choose.
- Push-to-talk on long press with the G2 mic (16 kHz PCM). Silent presses are dropped before speech-to-text, so Whisper can't invent a command from silence.
- Rules, not a model, turn words into actions: no exact outcome match, no bet.
- Built for an imperfect ring. Voice does the work, so the ring only needs one long press to talk. A stray tap can't place a bet: it takes a spoken amount and outcome, then "Yes, place it", and anything placed can be undone for 10 seconds.

## How it's built
- Glasses: Even Hub app (TypeScript, SDK 0.0.16), packaged as odds.ehpk (min app 2.2.10) and uploaded as a private Even Hub build. Tested in the official simulator 0.9.5.
- Backend (Vercel): /api/stt (Whisper large-v3-turbo on Groq, loudness guard), /api/search and /api/event (Polymarket Gamma; placeholder markets filtered; closed markets returned with the winning outcome once final), /api/history (CLOB, 24 h), /api/news (Google News RSS, last 24 h).
- Alerts: /api/sync (link code + watchlist copy, Upstash Redis, only for linked devices), /api/tg (bot webhook, checked by Telegram's secret header; accepts edited messages and codes inside a sentence), /api/tick (every 5 minutes from GitHub Actions; one move alerts once, then the baseline resets).
- Site simulator: /try runs the unchanged app code against a stand-in SDK, with a 5-step guided tour.
- Tests: 23 (voice parser, outcome matching, headlines, bet settlement, undo, and the whole Telegram flow end to end against fake Redis, Telegram and Polymarket).

## Who it's for, and the business
One thing, done well: the odds you care about, at a glance. For people who already follow prediction markets and can't keep a phone out: a handful of live questions checked between meetings, on a run, on a call, and the alert in the hour a market moves. Free covers following, paper bets and a few alerts a day. A Pro plan (unlimited alerts, a line per market, a morning brief) and, later, real orders confirmed on the phone would pay for it. The paid plan is not built yet.

## Safety
- Paper only, on purpose: a voice can't spend your money. Speech-to-text mishears, so Odds never lets a spoken sentence move real funds; the same flow could sit behind a phone confirmation later, not before.
- The ledger lives on the device. Linking Telegram copies only the watchlist, alert line and open bets; "disconnect Telegram" or /stop deletes them.
- Every bet needs a tap, and can be undone for 10 seconds.

## API feature requests
1. Even Hub: background alerts. The WebView pauses when the app is closed; we built a Telegram workaround, but it pulls the user to their phone. Ask: a small background task or server push that can show one line on the display. Unlocks: glanceable alerts for odds, prices and messages without the phone.
2. Even Hub: a large headline style. One fixed font size means the odds look the same as a footnote. Ask: one larger size or a bold weight for one text container. Unlocks: numbers readable while walking.
3. Even Hub: built-in speech-to-text. Every voice app streams raw audio to its own server and pays for transcription. Ask: an SDK call that returns a transcript. Unlocks: voice apps with no server, lower latency, better privacy.
4. Even Hub: simulator recording and documented automation routes. There is a glasses screenshot route we found by trial, but no way to record, and neither is documented. Ask: a documented record route next to /api/input and /api/screenshot. Unlocks: repeatable demo videos and visual tests in CI.
5. Polymarket: a public read API that works in every region, plus a paper-trading sandbox. From India the price-history host was unreachable and the events host dropped about half the calls. Ask: CORS-enabled public read endpoints served everywhere, and a sandbox with fake balances. Unlocks: wearable and voice apps that show real order flow safely.

## Prior work
PREP.md holds planning notes written on 22 Nov, before the code window; no code. The push-to-talk wiring started from the Even Hub ASR template (MIT, credited in the README).
