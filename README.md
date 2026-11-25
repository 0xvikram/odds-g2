# Odds

**Live prediction-market odds on Even Realities G2 glasses, by voice.**

Big events move markets while you're walking. Odds puts the live number in front of your eyes: follow an
event by voice, glance at its odds and 24-hour trend, see the headline behind a big move, and place a paper bet
with one tap to confirm. Paper bets settle themselves when the market resolves, and big moves reach your phone
through a Telegram bot while Odds is closed (G2 shows one app at a time).

Built for the DoraHacks "Heads Up: Even Realities G2" hackathon, track **02 Crypto & DeFi** (Polymarket,
read-only data and paper trading only).

**Try it without glasses: https://odds-g2.vercel.app/try** (the real app code on a simulated 576×288 display).
Product site: https://odds-g2.vercel.app

## How it works

```
 G2 glasses (Even Hub WebView app)            Odds backend (Vercel, US)              Upstream
 ───────────────────────────────              ─────────────────────────              ────────
 hold touchpad/ring → mic PCM 16 kHz ──WAV──▶ /api/stt ─────────────────────────────▶ Groq Whisper
 voice intent → follow / bet / positions      /api/search, /api/event ──────────────▶ Polymarket Gamma
 glanceable cards, live every 15 s     ◀────  /api/history (24 h sparkline) ────────▶ Polymarket CLOB
 "why did it move?" / move ≥ alert line       /api/news (headlines, last 24 h) ──────▶ Google News RSS
 paper ledger on the device                   /api/sync (link code, watchlist copy) ─▶ Upstash Redis
 "connect Telegram" → code + t.me link        /api/tg (bot webhook: /start CODE) ◀──── Telegram
                                              /api/tick (every 5 min, GitHub Actions) ─▶ Telegram messages
```

- Site: `npm run dev:site` / `npm run build:site` (Vercel builds this). The glasses package is still `npm run pack`.
  On `/try`, `src/main.ts` runs unchanged against `site/sim/sdk.ts`, a stand-in for the Even Hub SDK.
- No API keys on the glasses: speech-to-text runs on the backend.
- Read-only market data; bets are paper only. They stay on the device unless you link Telegram alerts, which copies
  the watchlist, alert line and open bets to the backend (see /privacy). /stop or "disconnect Telegram" deletes them.
- Paper bets settle from Polymarket's result: `/api/event` returns closed markets with the winning outcome once final.
- The backend proxies Polymarket because its hosts are unreliable or blocked in some regions.

## Run it

```bash
npm install
npm run dev            # app on http://127.0.0.1:5191
npm run simulate       # Even Hub simulator 0.9.5+, automation API on :9898
```

Backend: deploy this repo to Vercel and set `GROQ_API_KEY`. Routes live in `api/`.

Telegram alerts (optional): create a bot with @BotFather, add an Upstash Redis database to the Vercel project
(it sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`), and set `TG_BOT_TOKEN`, `TG_BOT_NAME` (without @),
`TG_WEBHOOK_SECRET` and `TICK_SECRET` (any long random strings). Deploy, then point the bot at the backend once:

```bash
curl -H "authorization: Bearer $TICK_SECRET" https://<your-app>.vercel.app/api/tg?setup=1
```

Add `TICK_SECRET` as a GitHub Actions secret; `.github/workflows/tick.yml` calls `/api/tick` every 5 minutes.

## Prior work and credits

- `PREP.md`: planning notes written before the coding window opened (screens, commands, demo markets).
  No code was written before 23 Nov 2026 13:30 IST.
- The app shell starts from the official `asr` template in
  [even-realities/evenhub-templates](https://github.com/even-realities/evenhub-templates) (MIT,
  see `LICENSE-evenhub-templates`).

## License

MIT
