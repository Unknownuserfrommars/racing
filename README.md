# Daily Browser Racer

Daily Browser Racer is a lightweight arcade racing game that runs directly in the browser.
Players race a daily map, finish a lap, and submit their best time to a top-20 leaderboard.

## Project overview

- **Frontend gameplay loop** rendered on an HTML5 canvas.
- **Daily track identity** generated from the current date.
- **Ghost replay support** for the current leaderboard-best run.
- **Leaderboard deduplication by player** (best run per player is kept).
- **Two backend modes**:
  - **Supabase via Node API** (recommended for shared online leaderboard)
  - **Local in-memory fallback** (works without Supabase)

## How it works

1. The client initializes the racer and derives today’s map id.
2. Leaderboard data is fetched for that map.
3. When a lap is completed, the run is validated and submitted.
4. The server/client ranking logic keeps the fastest run per player and shows the top 20.

## Run locally

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Start the game (Node API mode)

```bash
npm start
```

Open `http://localhost:4173`.

## Environment configuration

Create `.env.local` (do not commit) if you want Supabase-backed leaderboards:

```env
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Client-side Next-style variables are also supported:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

If env vars are missing, the app falls back to local in-memory leaderboard behavior.

## Available scripts

- `npm start` — run the Node server (`server.js`)
- `npm run next:build` — build Next.js output
- `npm run next:export` — export static output

## Controls

- **W / S**: throttle / brake
- **A / D**: steer
- **Retry button**: restart current attempt
- **Ghost toggle**: show/hide ghost replay

## Current version labels

- Package version: `0.1.3`
- UI alpha label: `v0.2.1.019`
