// The game object and the fixed-step update: one shared state, one update
// order, every system in its turn. The camera, the GPS route, the prompt and
// the markers are all refreshed here, and the overlay flows (mission briefs,
// busts, wasted, the ending card) resolve here too.

import { SEED, VIEW, WANTED, WORLD } from './config.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createEffects, updateEffects } from './effects.js';
import { createInput } from './input.js';
import { createMissions } from './missions.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { computePrompt, createPlayer, updatePlayer } from './player.js';
import { createPolice, reportCrime, updatePolice } from './police.js';
import { createRandom } from './random.js';
import { applySave, readSave, writeSave } from './save.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { collideCars, resetCarIds, updateCarHealth } from './vehicles.js';
import { fireWeapon, punch, updateBullets } from './weapons.js';
import { updateEnemies, updateEnemyDrivers } from './enemies.js';

const SPAWN = { x: 1196, y: 1520 };

// The keyboard/mouse listeners and the audio context belong to the page, not
// to one run: starting a new game reuses them instead of stacking duplicates.
function sharedInput(canvas) {
  if (!canvas.__solmarInput) canvas.__solmarInput = createInput(canvas);
  return canvas.__solmarInput;
}

function sharedAudio(canvas) {
  if (!canvas.__solmarAudio) canvas.__solmarAudio = createAudio();
  return canvas.__solmarAudio;
}

export function createGame(canvas, seed) {
  resetCarIds();
  const rng = createRandom(seed || SEED);
  const game = {
    seed: seed || SEED,
    rng,
    time: 0,
    city: null,
    player: null,
    police: createPolice(),
    missions: createMissions(),
    effects: createEffects(),
    audio: sharedAudio(canvas),
    input: sharedInput(canvas),
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    healthPacks: [],
    camera: { x: SPAWN.x, y: SPAWN.y, zoom: 1 },
    stats: { shotsFired: 0 },
    toasts: [],
    prompt: null,
    promptAction: null,
    markers: [],
    route: [],
    routeCombat: false,
    routeTimer: 0,
    missionTimer: null,
    pendingOverlay: null,
    overlayTime: 0,
    weapons: { fire: fireWeapon, punch },
  };
  game.city = createCity(game.seed);
  game.player = createPlayer(SPAWN.x, SPAWN.y);
  spawnTraffic(game);
  spawnPeds(game);
  game.healthPacks = [
    { x: 612, y: 470, taken: false },
    { x: 1866, y: 2100, taken: false },
    { x: 3318, y: 3400, taken: false },
    { x: 900, y: 3780, taken: false },
  ];
  game.markers = game.missions.markers(game);
  game.route = computeRoute(game);

  game.toast = (text) => {
    game.toasts.push({ text, ttl: 3 });
    if (game.toasts.length > 3) game.toasts.shift();
  };
  game.saveGame = (reason) => {
    const ok = writeSave(game);
    if (reason === 'safehouse' && ok) game.toast('Game saved');
    return ok;
  };
  game.dismissOverlay = () => dismissOverlay(game);
  game.loadSave = () => {
    const record = readSave();
    if (record) applySave(game, record);
    return !!record;
  };
  return game;
}

function computeRoute(game) {
  const markers = game.markers;
  if (!markers || markers.length === 0) return [];
  const target = markers[0];
  const route = game.city.routeWaypoints(game.player.x, game.player.y, target.x, target.y);
  game.routeCombat = !!target.combat;
  return route;
}

function refreshObjective(game, dt) {
  game.promptAction = computePrompt(game);
  game.prompt = game.promptAction ? game.promptAction.text : null;
  game.markers = game.missions.markers(game);
  game.routeTimer -= dt;
  if (game.routeTimer <= 0) {
    game.routeTimer = 0.5;
    game.route = computeRoute(game);
  }
}

// Car-on-car contact: separate, trade momentum, and track how long each cop
// has been grinding against the player's car so the anti-pin back-off fires.
function carContactPass(game, dt) {
  const cars = game.cars;
  const touchingPlayer = new Set();
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      if (!collideCars(a, b, game)) continue;
      if (a.driver === 'police' && b.driver === 'player') touchingPlayer.add(a);
      if (b.driver === 'police' && a.driver === 'player') touchingPlayer.add(b);
      // Ramming a cop car at speed is a crime the cop always sees.
      const cop = a.driver === 'police' ? a : b.driver === 'police' ? b : null;
      const other = cop === a ? b : a;
      if (cop && other.driver === 'player' && Math.abs(other.speed) > 220) {
        reportCrime(game, 'ramCop', cop.x, cop.y);
      }
    }
  }
  for (const car of cars) {
    if (car.driver !== 'police') continue;
    if (touchingPlayer.has(car)) car.contactTimer = (car.contactTimer || 0) + dt;
    else car.contactTimer = 0;
  }
}

function updateCamera(game, dt) {
  const player = game.player;
  const lookX = player.onFoot ? 0 : Math.cos(player.angle) * 70;
  const lookY = player.onFoot ? 0 : Math.sin(player.angle) * 70;
  const targetX = player.x + lookX;
  const targetY = player.y + lookY;
  const k = Math.min(1, 5 * dt);
  game.camera.x += (targetX - game.camera.x) * k;
  game.camera.y += (targetY - game.camera.y) * k;
  const halfW = VIEW.width / 2 / game.camera.zoom;
  const halfH = VIEW.height / 2 / game.camera.zoom;
  game.camera.x = Math.min(Math.max(game.camera.x, halfW), WORLD.width - halfW);
  game.camera.y = Math.min(Math.max(game.camera.y, halfH), WORLD.height - halfH);
  game.camera.zoom = 1;
}

export function stepGame(game, dt, actions) {
  game.time += dt;
  game.overlayTime += dt;

  if (actions.mute > 0) game.audio.toggleMute();
  if (actions.weapon === 1) game.player.weapon = 'pistol';
  if (actions.weapon === 2 && game.player.rifleUnlocked) game.player.weapon = 'rifle';

  refreshObjective(game, dt);
  updatePlayer(game, dt, game.input, actions);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateEnemies(game, dt);
  updateEnemyDrivers(game, dt);
  updateBullets(game, dt);
  carContactPass(game, dt);
  for (const car of game.cars) updateCarHealth(car, game, dt);
  game.missions.update(game, dt);
  updateEffects(game.effects, dt);

  for (const toast of game.toasts) toast.ttl -= dt;
  game.toasts = game.toasts.filter((t) => t.ttl > 0);

  // The prompt can change because of what just happened (a car entered, a
  // step completed); refresh it so the HUD never shows a stale action.
  game.promptAction = computePrompt(game);
  game.prompt = game.promptAction ? game.promptAction.text : null;
  game.markers = game.missions.markers(game);

  updateCamera(game, dt);

  // Continuous sound follows the player's speed and the nearest siren.
  const player = game.player;
  const engineLevel = !player.onFoot && player.car ? Math.min(1, Math.abs(player.car.speed) / 420) : 0;
  let sirenLevel = 0;
  if (game.police.stars > 0) {
    let nearest = Infinity;
    for (const car of game.cars) {
      if (car.driver === 'police' && !car.dead) {
        nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.y - player.y));
      }
    }
    if (nearest < 900) sirenLevel = 1 - nearest / 900;
  }
  game.audio.update(engineLevel, sirenLevel);
}

function respawn(game, placeId, fine) {
  const player = game.player;
  const spot = game.city.locationById(placeId);
  if (player.car) {
    player.car.driver = 'none';
    player.car.speed = 0;
    player.car = null;
  }
  player.onFoot = true;
  player.x = spot.x;
  player.y = spot.y;
  player.health = player.maxHealth;
  player.angle = 0;
  player.aimAngle = 0;
  if (fine) player.money = Math.max(0, player.money - fine);
  game.police.setStars(game, 0);
  game.missions.fail(game, 'respawn');
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.saveGame('respawn');
}

function dismissOverlay(game) {
  const overlay = game.pendingOverlay;
  if (!overlay) return;
  game.pendingOverlay = null;
  game.overlayTime = 0;
  if (overlay.type === 'missionIntro') {
    game.missions.startOffered(game);
  } else if (overlay.type === 'missionDone') {
    if (overlay.allDone) {
      game.pendingOverlay = {
        type: 'ending',
        title: 'DEBT PAID',
        lines: [
          'Five jobs. Five thousand dollars. Vince tears up the marker.',
          'Solmar City is yours now, Jax. Drive safe. Mostly.',
        ],
      };
    }
  } else if (overlay.type === 'busted') {
    respawn(game, 'police', 0);
  } else if (overlay.type === 'wasted') {
    respawn(game, 'hospital', WANTED.wastedFine);
  }
  // 'failed' and 'ending' simply close.
}
