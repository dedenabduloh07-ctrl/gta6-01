// Saving to browser local storage: the safehouse, mission starts and
// mission completions all write the same record, and Continue restores it
// exactly — position, money, health, missions done, the rifle, and the heat.
// Storage can be unavailable (private windows); every access is guarded.

import { SAVE_KEY } from './config.js';

export function writeSave(game) {
  const player = game.player;
  const record = {
    version: 1,
    x: player.x,
    y: player.y,
    money: player.money,
    health: player.health,
    missionsDone: game.missions.done.slice(),
    rifleUnlocked: player.rifleUnlocked,
    stars: game.police.stars,
    time: game.time,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (typeof record.x !== 'number' || typeof record.y !== 'number') return null;
    return record;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function applySave(game, record) {
  const player = game.player;
  player.x = record.x;
  player.y = record.y;
  player.money = record.money;
  player.health = record.health;
  player.rifleUnlocked = !!record.rifleUnlocked;
  game.missions.done = (record.missionsDone || []).slice();
  game.police.setStars(game, record.stars || 0);
  game.time = record.time || 0;
  player.onFoot = true;
  player.car = null;
  game.camera.x = player.x;
  game.camera.y = player.y;
}
