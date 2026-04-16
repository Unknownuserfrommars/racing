# Daily Browser Racer

This repo now includes **two runnable modes**:

1. **Static Next.js export (GitHub Pages-friendly)**
2. **Node API mode (local backend APIs for leaderboard submit/fetch)**

## 1) Next.js static export (for GitHub Pages)

Install dependencies:

```bash
npm install
```

Set `.env.local` (local only, do not commit):

```env
NEXT_PUBLIC_SUPABASE_URL=https://lywbtrnhkazekyljhkft.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_a8bSpkh5ZdK1v2NNmodz1A_RfzAPN5P
```

Build static output:

```bash
npm run next:build
npm run next:export
```

`next.config.js` uses `output: 'export'` so the app is generated as static output for GitHub Pages.

## 2) Node API mode (local development)

Run the local Node server:

```bash
npm start
```

Then open:

- `http://localhost:4173`

## Notes

- `.env.local` is ignored by git in `.gitignore`.
- Next.js middleware/proxy and API routes are not active on fully static hosting.
- Supabase helpers are included under `utils/supabase/*` for Next.js integration.
