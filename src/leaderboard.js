import { STORAGE_KEYS, SUPABASE_CONFIG } from './config.js';

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

export function usingSupabase() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

export async function fetchLeaderboard(mapId) {
  // Placeholder until Supabase details are available.
  const runs = loadLocalRuns(mapId);
  return onlyBestPerPlayer(runs).slice(0, 20);
}

export async function submitRun(run) {
  // Local fallback implementation keeps MVP moving without backend credentials.
  const runs = loadLocalRuns(run.map_id);
  const filtered = runs.filter((entry) => entry.player_id !== run.player_id);
  filtered.push(run);
  const ranked = onlyBestPerPlayer(filtered);

  // Keep replay only for top 20 in local storage model.
  ranked.forEach((entry, idx) => {
    if (idx >= 20) {
      entry.replay = null;
    }
  });

  saveLocalRuns(run.map_id, ranked);
  return ranked.slice(0, 20);
}
