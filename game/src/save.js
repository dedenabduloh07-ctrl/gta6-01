// Save / load through localStorage: money, mission progress, the player's
// position and health, collectibles and lifetime stats. Saving never throws:
// a full or blocked store just means progress lasts this visit only.

import { SAVE_KEY, SETTINGS_KEY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    money: 250,
    debtPaid: 0,
    missionIndex: 0,
    missionsDone: [],
    health: 100,
    x: 0,
    y: 0,
    weapon: 'pistol',
    rifleOwned: false,
    stashes: [],
    stats: {
      timePlayed: 0,
      carsStolen: 0,
      distanceDriven: 0,
      shotsFired: 0,
      timesBusted: 0,
      timesWasted: 0,
      missionsDone: 0,
    },
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data.money !== 'number') return null;
    const merged = defaultSave();
    Object.assign(merged, data);
    merged.stats = Object.assign(defaultSave().stats, data.stats || {});
    return merged;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing stored: nothing to clear.
  }
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { muted: false };
    const data = JSON.parse(raw);
    return { muted: !!data.muted };
  } catch {
    return { muted: false };
  }
}

export function writeSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are a nicety; a blocked store keeps the default.
  }
}
