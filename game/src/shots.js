// The four deterministic staged scenes the screenshots are captured from.
// Each one sets the world up, then runs the real simulation for a fixed
// number of fixed steps with scripted input — what the camera sees is the
// game actually playing, not a posed diorama.

import { STEP } from './config.js';
import { spawnGuards } from './enemies.js';
import { stepGame } from './game.js';
import { createCar } from './vehicles.js';

function noActions() {
  return { interact: 0, confirm: 0, pause: 0, mute: 0, weapon: 0, horn: 0, punch: 0 };
}

function runSteps(game, count) {
  for (let i = 0; i < count; i += 1) stepGame(game, STEP, noActions());
}

function settleCamera(game) {
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.zoom = 1;
  game.routeTimer = 0;
  game.markers = game.missions.markers(game);
}

// A three-star chase down Ocean Drive: the player's coupe with two
// interceptors closing in behind it.
function stageChase(game) {
  const car = createCar('coupe', 2108, 3560, 0, 'player', '#b03a30');
  game.cars.push(car);
  const player = game.player;
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  game.police.setStars(game, 3);
  const cop1 = createCar('police', 1900, 3560, 0, 'police');
  const cop2 = createCar('police', 1730, 3530, 0, 'police');
  cop1.contactTimer = 0;
  cop1.backoffTimer = 0;
  cop2.contactTimer = 0;
  cop2.backoffTimer = 0;
  game.cars.push(cop1, cop2);
  game.input.held.add('w');
  runSteps(game, 110);
  game.input.held.delete('w');
  settleCamera(game);
}

// A calm drive down Solmar Blvd: avenues, lane arrows, street labels,
// traffic, and the GPS route running ahead to Vince.
function stageDrive(game) {
  const car = createCar('coupe', 1140, 2950, -Math.PI / 2, 'player', '#2e4a6a');
  game.cars.push(car);
  const player = game.player;
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  game.input.held.add('w');
  runSteps(game, 130);
  game.input.held.delete('w');
  settleCamera(game);
}

// A firefight outside the First Bank of Solmar: Jax on foot, guards
// alerted, bullets in the air.
function stageCombat(game) {
  const player = game.player;
  player.x = 1624;
  player.y = 1866;
  player.onFoot = true;
  player.car = null;
  spawnGuards(game, [
    { x: 1720, y: 1800 },
    { x: 1720, y: 1930 },
    { x: 1980, y: 1866 },
    { x: 1866, y: 1970 },
  ]);
  for (const foe of game.enemies) foe.alerted = true;
  game.camera.x = player.x;
  game.camera.y = player.y;
  // Aim at the nearest guard through the same view math the player uses.
  const target = game.enemies[0];
  game.input.mouse.x = (target.x - game.camera.x) * game.camera.zoom + 640;
  game.input.mouse.y = (target.y - game.camera.y) * game.camera.zoom + 360;
  game.input.mouse.down = true;
  runSteps(game, 46);
  game.input.mouse.down = false;
  settleCamera(game);
}

// The opening: Jax on the sidewalk by Vince's garage, the job marker up,
// a parked car waiting to be stolen.
function stageStart(game) {
  const player = game.player;
  player.x = 1196;
  player.y = 1462;
  runSteps(game, 30);
  settleCamera(game);
}

export function stageShot(game, name) {
  if (name === 'chase') stageChase(game);
  else if (name === 'drive') stageDrive(game);
  else if (name === 'combat') stageCombat(game);
  else stageStart(game);
  // One last quiet step so the prompt, markers and route match the frame.
  runSteps(game, 1);
  settleCamera(game);
}
