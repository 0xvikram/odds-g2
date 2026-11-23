# Odds — prep notes (written 22 Nov, before the 23 Nov 13:30 IST code window)

Declared in the README as "planning notes written before the event; no code".

## Setup facts checked 22 Nov
- Simulator 0.9.5 installed globally. Untouched `minimal` template ran: "Page created: success", input events arrive.
- Automation API on `--automation-port 9898`: `POST /api/input {"action":"click"}` → `{"ok":true}`; `GET /api/console` returns app logs. Screenshot route not found yet (look in docs tomorrow).
- **Port 5173 is taken by the Double Agent dev server (PID 23335). Use 5191 for Odds.** Bind vite to 127.0.0.1.
- Template keeps the STT key in the browser (`VITE_STT_API_KEY`). We do NOT: audio goes to our backend, key stays server-side (`~/odds/.env`, already saved and verified, HTTP 200 from Groq).
- Polymarket Gamma API from India is flaky (first call drops, retry works) → always go through our backend on Vercel; backend retries once.
- Data shape: an **event** has several **markets** (e.g. "Fed Decision in December?" → No change 6.9%, 25 bps cut 0.6%, 50+ bps cut 0.45%). Each market: `outcomes`, `outcomePrices` (strings), `oneHourPriceChange`, `oneDayPriceChange`, `volume24hr`, `clobTokenIds`. Filter out resolved markets (price 0 or 1) and null prices. Price history: `clob.polymarket.com/prices-history?market=<tokenId>&interval=1d&fidelity=60`.

## Screens (576×288, one font, ~40–45 chars per line, ~9 lines; no emoji)
Glyphs allowed: ▲ ▼ ● ○ ━ ▁▂▃▄▅▆▇█ │ ─ ╭╮╯╰

1. **Watchlist** (list container, up to 20 items × 64 chars; swipe to move, tap to open)
```
ODDS · 3 watching                 14:02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Fed Dec: hold          93%  ▲2 /1h
○ BTC ≥95k in 2026        3%  ▼1 /1h
○ UCL final: Arsenal     41%  ━  /1h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hold: speak   Tap: open   2×tap: exit
```
2. **Event card** (text container, upgraded in place every 15 s)
```
FED DECISION IN DECEMBER
Hold                         93%  ▲2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▂▂▃▃▃▄▄▅▅▅▆▆▇▇▇▇█  24h
25 bps cut 6%   50+ cut 0.5%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
! Moved 5 pts in 1h                (alert line, only when |Δ1h| ≥ 5)
Hold: "20 on hold"   Swipe: next
```
3. **Confirm** (list with 2 items so a tap picks)
```
PAPER BET
$20 on HOLD @ 93¢
Pays $21.51 if it happens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> Yes, place it
  No
```
4. **Positions**
```
POSITIONS · paper              +$3.40
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fed hold     $20 @93¢ → 95¢    +$0.43
BTC ≥95k     $10 @3¢  → 4¢     +$3.33
UCL Arsenal  $15 @41¢ → 40¢    -$0.37
```
5. **Listening / thinking** overlays: `● Listening…` while long-press held; `Heard: "20 on hold"` for 1.5 s after.

Rules: one input container per page; use `textContainerUpgrade` for live numbers (flicker-free); rebuild page only on screen change; no images needed (sparkline is glyphs, avoids the 800 ms image refresh).

## Input map
- Long press (touchpad or R1): push-to-talk; release = send audio.
- Tap: open / confirm. Swipe up/down: move selection / next event. Double tap: back (system exit on watchlist).

## Voice commands (rules first; the model only maps an event name to a search query)
| Say | Does |
|---|---|
| "follow <event>" / "watch <event>" | search Polymarket, show top 3 matches as a list, tap one to add |
| "unfollow" / "stop watching" | remove the open event |
| "<amount> on <outcome>" e.g. "20 on hold", "ten dollars on yes" | open confirm screen (paper) |
| "close" / "sell" | close the paper position on the open event |
| "positions" / "my bets" | positions screen |
| "alert at <n> percent" | set per-event alert threshold (default 5 pts / 1h) |
| "back" / "home" | watchlist |
Numbers: parse digits and words (ten, twenty, fifty, a hundred). Outcome matched fuzzily against the open event's market names/outcomes. Unknown → "Didn't catch that. Try: follow the Fed decision".
Money never decided by the model: amount + outcome come from the parser and the live price.

## Paper ledger
`{eventId, marketId, outcome, stakeUsd, entryPrice, shares = stake/entryPrice, openedAt}` in localStorage on the device. Value = shares × current price. PnL = value − stake. Close = realise at current price. Payout shown on confirm = shares × $1.

## Backend (Vercel functions, CORS for the app origin)
- `POST /api/stt` (WAV/PCM body) → Groq `whisper-large-v3-turbo` → `{text}`
- `POST /api/intent {text, context}` → rules → `{intent, ...}`; only for "follow X" it may call Groq Llama to turn X into a short search query
- `GET /api/search?q=` → Gamma public-search (retry once) → top 3 active events
- `GET /api/event/:id` → markets with prices, 1h/1d change, filtered/sorted
- `GET /api/history/:tokenId` → 24 h hourly points → sparkline

## Demo video (≤ 3 min, simulator + macOS screen capture, scripted via automation API)
0:00 Hook: "Big events move markets while you're walking. Odds puts the live number in front of your eyes." (glasses view full screen)
0:15 Hold → "follow the Fed December decision" → 3 matches → tap → card shows Hold 93% ▲2 + sparkline
0:45 Watchlist: 3 events at a glance (usefulness at a glance, 30%)
1:05 Alert line appears: "Moved 5 pts in 1h"
1:20 Hold → "20 on hold" → confirm → tap Yes → positions with PnL (read + write by voice/tap, 25%)
1:50 Ring: same actions with the R1 ring (swipe, tap)
2:05 How it's built: Even Hub SDK, Groq Whisper, Polymarket public data, paper ledger, no keys on the glasses (technical 20%)
2:30 Safety: paper only, read-only data, nothing custodial; business: prediction-market and news users (10%)
2:50 End card with repo + site
Voice: AI voice is allowed here (only ETHGlobal demands a human voice) — but ask Vikram.

## Demo markets (checked 22 Nov; all stay open past judging on 3 Dec)
Chosen for global appeal, daily movement, and clear wording. Skipped: war/ceasefire markets, US election nominees, and anything about Anthropic (taste and conflict of interest), plus same-day sports.
| # | Event (Gamma id) | Ends | Shown outcome | 22 Nov price |
|---|---|---|---|---|
| 1 | Fed Decision in December? (770450) | 10 Dec | top outcome, others on card | ~90% top |
| 2 | What price will Bitcoin hit in 2026? (89502) | 1 Jan | "↓ 50,000" (moves daily, good for the alert line) | ~36% |
| 3 | UEFA Champions League 2027 Champion (659671) | Jun 2027 | Arsenal / PSG / Bayern | 13.5 / 18.5 / 12.5% |
| 4 | AI bubble burst by...? (85299) | Jul 2027 | "December 31, 2026" | ~54% |
| 5 | Largest Company end of December 2026? (79041) | 1 Jan | Apple | ~95% |
Voice demo lines: "20 on Arsenal", "what's bitcoin doing", "add Fed". Re-check prices on recording day; never hard-code them.

Reachability from India (22 Nov): gamma-api.polymarket.com answered 3 of 6 tries (3–4 s; the rest dropped instantly); clob.polymarket.com (price history) never answered: TLS connects, then the connection is cut. Both must go through our US-hosted backend. **First day-1 test: call both from the deployed backend.**

## API feature requests (submission asks for up to 5)
Final wording for the submission form. Each says what we hit, what we did instead, and what it would unlock.

1. **Even Hub: background alerts.** The WebView pauses when the app is closed, so a "market moved 5 points" alert only shows while Odds is open. Ask: a small background task or a server push that can show one line on the display. Unlocks: real glanceable alerts for odds, prices, and messages, the main reason to wear the glasses.
2. **Even Hub: a large headline style.** There is one fixed font size, so the most important number (the odds) looks the same as a footnote. Ask: one larger size or a bold weight for a single text container. Unlocks: numbers readable at a glance while walking.
3. **Even Hub: built-in speech-to-text.** Every voice app streams raw microphone audio to its own server and pays for transcription; we added a backend just for this. Ask: an SDK call that returns a transcript (with the audio staying on the phone where possible). Unlocks: voice apps with no server, lower latency, and better privacy.
4. **Even Hub: simulator recording and screenshots.** Demo videos need macOS screen capture, and the automation API has no documented screenshot route. Ask: record and screenshot routes on the automation port. Unlocks: scripted, repeatable demo videos and UI tests in CI.
5. **Polymarket: a public read API that works in every region, plus a paper-trading sandbox.** From India the price-history host is unreachable and the events host drops half the calls, so even read-only apps need a proxy. There is also no official sandbox for practice orders. Ask: CORS-enabled public read endpoints served everywhere, and a sandbox with fake balances. Unlocks: wearable and voice apps that show real order flow safely, without each one running its own proxy.

## Day 1 (23 Nov, 13:30) checklist
1. Repo `~/odds` (git init, branch build, `.env` already there and git-ignored), public `0xvikram/odds-g2`, push.
2. Copy the `asr` template structure (MIT) — note in README; app on port 5191.
3. Backend skeleton + `/api/stt` with Groq; long-press push-to-talk records PCM, wraps as WAV, sends on release.
4. Show transcript on glasses. Commit + push.
