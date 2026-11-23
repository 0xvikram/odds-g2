# Odds

**Live prediction-market odds on Even Realities G2 glasses, by voice.**

Big events move markets while you're walking. Odds puts the live number in front of your eyes: follow an
event by voice, glance at its odds and 24-hour trend, get a line when it moves, and place a paper bet
with one tap to confirm.

Built for the DoraHacks "Heads Up: Even Realities G2" hackathon, track **02 Crypto & DeFi** (Polymarket,
read-only data and paper trading only).

> Work in progress. Day 1: backend and push-to-talk.

## How it works

```
 G2 glasses (Even Hub WebView app)            Odds backend (Vercel, US)              Upstream
 ───────────────────────────────              ─────────────────────────              ────────
 hold touchpad/ring → mic PCM 16 kHz ──WAV──▶ /api/stt ─────────────────────────────▶ Groq Whisper
 voice intent → follow / bet / positions      /api/search, /api/event ──────────────▶ Polymarket Gamma
 glanceable cards, live every 15 s     ◀────  /api/history (24 h sparkline) ────────▶ Polymarket CLOB
 paper ledger on the device
```

- No API keys on the glasses: speech-to-text runs on the backend.
- Read-only market data; bets are paper only and never leave the device.
- The backend proxies Polymarket because its hosts are unreliable or blocked in some regions.

## Run it

```bash
npm install
npm run dev            # app on http://127.0.0.1:5191
npm run simulate       # Even Hub simulator 0.9.5+, automation API on :9898
```

Backend: deploy this repo to Vercel and set `GROQ_API_KEY`. Routes live in `api/`.

## Prior work and credits

- `PREP.md`: planning notes written before the coding window opened (screens, commands, demo markets).
  No code was written before 23 Nov 2026 13:30 IST.
- The app shell starts from the official `asr` template in
  [even-realities/evenhub-templates](https://github.com/even-realities/evenhub-templates) (MIT,
  see `LICENSE-evenhub-templates`).

## License

MIT
