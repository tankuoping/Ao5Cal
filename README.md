# Ao5 Calculator — WCA Live Spectator Tool

A live Ao5 calculator for WCA speedcubing competitions. Enter solve times in centiseconds to instantly see Ao5, WPA (worst possible average), BPA (best possible average), and the minimum time required on the next solve to beat a target.

## Deploy to Vercel (5 minutes)

### Option A — Vercel CLI (recommended)
```bash
npm install -g vercel
npm install
vercel
```
Follow the prompts. Your app will be live at a `*.vercel.app` URL.

### Option B — GitHub + Vercel dashboard
1. Push this folder to a new GitHub repository
2. Go to https://vercel.com → New Project → Import your repo
3. Vercel auto-detects Vite — just click **Deploy**

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

## How it works
- Times are entered in **centiseconds** (e.g. 224 = 2.24s)
- **Ao5** — shown when all 5 solves are entered; drops best & worst
- **WPA** — worst possible Ao5 if solve 5 is a DNF (shown after 4 solves)
- **BPA** — best possible Ao5 if solve 5 is perfect (shown after 4 solves)
- **Min. required for Target** — exact cutoff needed on solve 5 to beat the target
