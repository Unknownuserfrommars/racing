# Daily Browser Racer (Streamlit)

Daily Browser Racer is now a **Python + Streamlit** application with a Supabase-backed daily leaderboard.

## What changed

- Removed the Node.js/GitHub Pages-oriented workflow.
- Moved the app entrypoint to `app.py`.
- Leaderboard reads/writes directly to Supabase using `st.connection()` + `st-supabase-connection`.
- Daily map identity is based on the current UTC date (`YYYY-MM-DD`) so it matches the archive cron job.

## Supabase schema

The app expects the `runs` table:

```sql
CREATE TABLE runs (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT,
    display_name TEXT,
    map_id TEXT,
    time_ms INTEGER,
    replay_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all inserts"
ON runs
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "allow all selects"
ON runs
FOR SELECT
TO anon
USING (true);
```

To show archived daily results in the Streamlit frontend, also create a `history` table:

```sql
CREATE TABLE history (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT,
    display_name TEXT,
    map_id TEXT,
    time_ms INTEGER,
    rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all history selects"
ON history
FOR SELECT
TO anon
USING (true);
```

## Local setup

### 1) Install dependencies

```bash
pip install -r requirements.txt
```

### 2) Configure Streamlit secrets

Create `.streamlit/secrets.toml` in the repo root:

```toml
SUPABASE_URL = "https://lywbtrnhkazekyljhkft.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"

[connections.supabase]
SUPABASE_URL = "https://lywbtrnhkazekyljhkft.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

> Keep secrets local only. Do **not** commit this file.

### 3) Run the app

```bash
streamlit run app.py
```

## App behavior

- Generates/keeps a local player id in Streamlit session state.
- Lets players enter a display name.
- Uses a stopwatch flow (`Start run` → `Finish run`) to capture run time.
- Submits to Supabase and renders a top-20 leaderboard with one best run per player.
- Shows archived daily top runs from the `history` table.
