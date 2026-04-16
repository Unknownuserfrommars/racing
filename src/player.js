import { STORAGE_KEYS } from './config.js';
import { uuid } from './utils.js';

export function getOrCreatePlayerId() {
  let playerId = localStorage.getItem(STORAGE_KEYS.playerId);
  if (!playerId) {
    playerId = uuid();
    localStorage.setItem(STORAGE_KEYS.playerId, playerId);
  }
  return playerId;
}

export function getDisplayName() {
  return localStorage.getItem(STORAGE_KEYS.displayName) || '';
}

export function setDisplayName(name) {
  localStorage.setItem(STORAGE_KEYS.displayName, name.trim());
}
