import { RacerGame } from './game.js';
import { fetchLeaderboard, leaderboardModeLabel, submitRun, usingSupabase } from './leaderboard.js';
import { getDisplayName, getOrCreatePlayerId, setDisplayName } from './player.js';
import { formatMs, todayMapId } from './utils.js';

const canvas = document.getElementById('game');
const timerEl = document.getElementById('timer');
const bestTimeEl = document.getElementById('best-time');
const mapIdEl = document.getElementById('map-id');
const leaderboardEl = document.getElementById('leaderboard');
const leaderboardStateEl = document.getElementById('leaderboard-state');
const retryBtn = document.getElementById('retry-btn');
const ghostToggle = document.getElementById('ghost-toggle');
const nameDialog = document.getElementById('name-dialog');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('display-name-input');

const game = new RacerGame(canvas);
const playerId = getOrCreatePlayerId();
const mapId = todayMapId();
mapIdEl.textContent = mapId;

let leaderboard = [];
let bestReplay = null;
let bestTime = Number.POSITIVE_INFINITY;
let prev = performance.now();

function renderLeaderboard() {
  leaderboardEl.innerHTML = '';
  leaderboard.forEach((entry, idx) => {
    const item = document.createElement('li');
    item.textContent = `${idx + 1}. ${entry.display_name} — ${formatMs(entry.time_ms)}`;
    leaderboardEl.append(item);
  });

  const personalBest = leaderboard.find((entry) => entry.player_id === playerId);
  if (personalBest) {
    bestTime = personalBest.time_ms;
    bestTimeEl.textContent = formatMs(bestTime);
  }

  const mode = usingSupabase() ? 'Supabase mode' : leaderboardModeLabel();
  leaderboardStateEl.textContent = `${mode}. Entries: ${leaderboard.length}`;
  bestReplay = leaderboard[0]?.replay || null;
}

async function refreshLeaderboard() {
  leaderboard = await fetchLeaderboard(mapId);
  renderLeaderboard();
}

function ensureName() {
  const saved = getDisplayName();
  if (saved) {
    return saved;
  }
  nameInput.value = '';
  nameDialog.showModal();
  return null;
}

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = String(nameInput.value || '').trim();
  if (value.length < 2) {
    return;
  }
  setDisplayName(value);
  nameDialog.close();
});

retryBtn.addEventListener('click', () => {
  game.reset();
  timerEl.textContent = '00:00.000';
});

async function trySubmitLap() {
  const displayName = ensureName();
  const shouldSubmit = Boolean(displayName && game.validateRun());

  if (shouldSubmit) {
    const run = {
      player_id: playerId,
      display_name: displayName,
      map_id: mapId,
      time_ms: game.timeMs,
      replay: game.replay,
      created_at: new Date().toISOString(),
      is_valid: true
    };

    leaderboard = await submitRun(run);
    renderLeaderboard();
  }

  game.reset();
  timerEl.textContent = '00:00.000';
}

function tick(now) {
  const dt = Math.min(0.03, (now - prev) / 1000);
  prev = now;

  game.update(dt, now);
  timerEl.textContent = formatMs(game.timeMs);
  game.draw(bestReplay, ghostToggle.checked);

  if (game.finishedLap) {
    game.finishedLap = false;
    trySubmitLap();
  }

  requestAnimationFrame(tick);
}

refreshLeaderboard();
requestAnimationFrame(tick);
