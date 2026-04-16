# Daily Browser Racer (MVP Scaffold)

A browser racing prototype with a **Node.js main server**.

## Current state

- Canvas-based top-down racer with arcade controls.
- Daily `map_id` based on date (`YYYY-MM-DD-track`).
- No-login player identity via `localStorage` UUID + display name.
- Top-20 leaderboard logic and replay retention model.
- Frontend submits runs through a Node API (`/api/*`).
- Node API can use Supabase (when env vars are set) or local in-memory fallback.

## Setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Fill `.env.local`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_KEY
PORT=4173
```

3. Start server:

```bash
npm start
```

4. Open:

- `http://localhost:4173`

## Notes

- `.env.local` is ignored by git for safety.
- If Supabase env vars are missing or unreachable, app falls back to local mode automatically.
- Recommended Supabase table: `runs(player_id, display_name, map_id, time_ms, replay, created_at, is_valid)`.
