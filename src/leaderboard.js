import { API_CONFIG, STORAGE_KEYS } from './config.js';

const runningOnLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const hasExplicitApiBase = Boolean(API_CONFIG.baseUrl);

let backendMode = runningOnLocalhost || hasExplicitApiBase ? 'node-api' : 'local-fallback';

function localKey(mapId) {
  return `${STORAGE_KEYS.localRunsPrefix}${mapId}`;
}

function loadLocalRuns(mapId) {
  return JSON.parse(localStorage.getItem(localKey(mapId)) || '[]');
}

function saveLocalRuns(mapId, runs) {
  localStorage.setItem(localKey(mapId), JSON.stringify(runs));
}

function onlyBestPerPlayer(runs) {
  const byPlayer = new Map();
  for (const run of runs) {
    const prev = byPlayer.get(run.player_id);
    if (!prev || run.time_ms < prev.time_ms) {
      byPlayer.set(run.player_id, run);
    }
  }
  return [...byPlayer.values()].sort((a, b) => a.time_ms - b.time_ms);
}

function apiUrl(path) {
  return `${API_CONFIG.baseUrl}${path}`;
}


function shouldUseNodeApi() {
  return runningOnLocalhost || hasExplicitApiBase;
}

async function checkBackendMode() {
  if (!shouldUseNodeApi()) {
    backendMode = 'local-fallback';
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/health'));
    if (!response.ok) throw new Error('health check failed');
    const data = await response.json();
    backendMode = data.mode === 'supabase' ? 'supabase' : 'node-api';
  } catch {
    backendMode = 'local-fallback';
  }
}

export function usingSupabase() {
  return backendMode === 'supabase';
}

export async function fetchLeaderboard(mapId) {
  try {
    if (backendMode === 'node-api') {
      await checkBackendMode();
    }
    if (backendMode === 'supabase' || backendMode === 'node-api') {
      const response = await fetch(apiUrl(`/api/leaderboard?mapId=${encodeURIComponent(mapId)}`));
      if (!response.ok) {
        throw new Error('Failed leaderboard API request');
      }
      const data = await response.json();
      return data.runs || [];
    }
  } catch {
    backendMode = 'local-fallback';
  }

  const runs = loadLocalRuns(mapId);
  return onlyBestPerPlayer(runs).slice(0, 20);
}

export async function submitRun(run) {
  if (backendMode === 'node-api') {
    await checkBackendMode();
  }

  if (backendMode === 'supabase' || backendMode === 'node-api') {
    try {
      const response = await fetch(apiUrl('/api/submit-run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(run)
      });
      if (!response.ok) {
        throw new Error('Failed submit API request');
      }
      const data = await response.json();
      return data.runs || [];
    } catch {
      backendMode = 'local-fallback';
    }
  }

  const runs = loadLocalRuns(run.map_id);
  const filtered = runs.filter((entry) => entry.player_id !== run.player_id);
  filtered.push(run);
  const ranked = onlyBestPerPlayer(filtered);
  ranked.forEach((entry, idx) => {
    if (idx >= 20) {
      entry.replay = null;
    }
  });

  saveLocalRuns(run.map_id, ranked);
  return ranked.slice(0, 20);
}

export function leaderboardModeLabel() {
  if (backendMode === 'supabase') return 'Supabase via Node API';
  if (backendMode === 'node-api') return 'Node API mode';
  return 'Local fallback mode';
}
