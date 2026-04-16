# Daily Browser Racer (MVP Scaffold)

A static browser racing prototype for a daily time-trial game.

## Current state

- Canvas-based top-down racer with arcade controls.
- Daily `map_id` based on date (`YYYY-MM-DD-track`).
- No-login player identity via `localStorage` UUID + display name.
- Top-20 leaderboard logic and replay retention model.
- Local-storage backend fallback implemented.

## Supabase integration note

This code intentionally does **not** connect to Supabase yet. To wire it up, set credentials in `src/config.js` and replace local methods in `src/leaderboard.js` with Supabase queries/edge functions.

> As requested, we should pause coding for backend integration once you have a Supabase Free Plan account ready.

## Run locally

Because this uses JS modules, serve files over HTTP:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
