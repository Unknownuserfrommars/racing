import { createServer } from 'node:http';
import { stat, readFileSync } from 'node:fs';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFromFile(path.join(__dirname, '.env.local'));

const PORT = Number(process.env.PORT || 4173);
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
const LOCAL_RUNS = new Map();

function loadEnvFromFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = String(readFileSync(filePath)).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function bestPerPlayer(runs) {
  const byPlayer = new Map();
  for (const run of runs) {
    if (!run?.player_id || !Number.isFinite(run?.time_ms)) continue;
    const prev = byPlayer.get(run.player_id);
    if (!prev || run.time_ms < prev.time_ms) byPlayer.set(run.player_id, run);
  }
  return [...byPlayer.values()].sort((a, b) => a.time_ms - b.time_ms);
}

function top20WithReplayRule(runs) {
  return bestPerPlayer(runs).slice(0, 20).map((run, idx) => ({
    ...run,
    replay: idx < 20 ? run.replay || null : null,
  }));
}

const RUN_VALIDATION = {
  minTimeMs: 1,
  maxTimeMs: 60 * 60 * 1000,
};

function validateRunPayload(run) {
  if (!run?.map_id || typeof run.map_id !== 'string') return 'map_id is required';
  if (!run?.player_id || typeof run.player_id !== 'string') return 'player_id is required';
  if (!Number.isFinite(run?.time_ms)) return 'time_ms must be finite';
  if (run.time_ms < RUN_VALIDATION.minTimeMs || run.time_ms > RUN_VALIDATION.maxTimeMs) {
    return 'time_ms outside allowed bounds';
  }
  return null;
}

async function supabaseFetch(pathname, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${pathname}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${msg}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function fetchLeaderboard(mapId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return top20WithReplayRule(LOCAL_RUNS.get(mapId) || []);
  }

  const query = `runs?map_id=eq.${encodeURIComponent(mapId)}&select=player_id,display_name,map_id,time_ms,replay,created_at,is_valid&order=time_ms.asc&limit=200`;
  const runs = await supabaseFetch(query, { method: 'GET' });
  return top20WithReplayRule(runs || []);
}

async function submitRun(run) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const runs = LOCAL_RUNS.get(run.map_id) || [];
    runs.push(run);
    LOCAL_RUNS.set(run.map_id, runs);
    return top20WithReplayRule(runs);
  }

  const bestQuery = `runs?map_id=eq.${encodeURIComponent(run.map_id)}&player_id=eq.${encodeURIComponent(run.player_id)}&select=time_ms&order=time_ms.asc&limit=1`;
  const existing = await supabaseFetch(bestQuery, { method: 'GET' });
  if (!existing?.length || run.time_ms < existing[0].time_ms) {
    await supabaseFetch('runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(run),
    });
  }

  return fetchLeaderboard(run.map_id);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/api/health') {
      return json(res, 200, { mode: SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'local' });
    }

    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const mapId = String(url.searchParams.get('mapId') || '');
      if (!mapId) return json(res, 400, { error: 'mapId is required' });
      const runs = await fetchLeaderboard(mapId);
      return json(res, 200, { runs });
    }

    if (url.pathname === '/api/submit-run' && req.method === 'POST') {
      const run = await readBody(req);
      const validationError = validateRunPayload(run);
      if (validationError) {
        return json(res, 400, { error: validationError });
      }
      const runs = await submitRun(run);
      return json(res, 200, { runs });
    }

    const relativePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = path.normalize(relativePath).replace(/^\.+/, '');
    const filePath = path.join(__dirname, safePath);

    stat(filePath, (err, fileInfo) => {
      if (err || !fileInfo.isFile()) {
        return json(res, 404, { error: 'Not found' });
      }

      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    json(res, 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
