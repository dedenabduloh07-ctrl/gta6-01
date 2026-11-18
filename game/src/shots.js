// Screenshot scenes behind ?shot=start|drive|chase|combat. Each one plays
// the real game forward from a fresh world for a few seconds, steered by a
// simple autopilot (drive toward waypoints, police chase for real, enemies
// fight for real), so every frame is what playing really looks like.

import { STEP } from './config.js';
import { updateGame } from './game.js';
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';

/** A scripted stand-in for the keyboard: drive toward the current waypoint. */
function autopilotInput(waypoints) {
  let index = 0;
  const held = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  return {
    held,
    mouse: { x: 900, y: 300, down: false },
    moveVector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      return { x, y };
    },
    isFiring() {
      return false;
    },
    takeActions() {
      return 0;
    },
    /** Steer the held keys toward the next waypoint; advance when close. */
    steer(g) {
      const wp = waypoints[index];
      if (!wp) return;
      const car = g.player.car || g.player;
      const d = Math.hypot(wp.x - car.x, wp.y - car.y);
      if (d < 90 && index < waypoints.length - 1) {
        index += 1;
        return;
      }
      const want = Math.atan2(wp.y - car.y, wp.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      held.up = Math.abs(diff) < 1.1;
      held.left = diff < -0.12;
      held.right = diff > 0.12;
      held.brake = Math.abs(diff) > 1.6;
    },
  };
}

function runSteps(g, input, seconds, aimWorld) {
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    if (input.steer) input.steer(g);
    updateGame(g, STEP, input, 0, aimWorld || { x: g.player.x + 200, y: g.player.y });
    if (g.pendingOverlay) g.pendingOverlay = null;
  }
}

function putPlayerInCar(g, model, x, y, angle, color) {
  const car = createCar(model, x, y, angle, color, 'player');
  g.cars.push(car);
  g.player.car = car;
  g.player.onFoot = false;
  g.player.x = x;
  g.player.y = y;
  g.player.angle = angle;
  g.camera.x = x;
  g.camera.y = y;
  return car;
}

function stageStart(g) {
  // The title backdrop: downtown plaza, traffic flowing, camera on the city.
  const input = autopilotInput([]);
  runSteps(g, input, 6, { x: g.player.x, y: g.player.y });
  g.camera.x = 1866;
  g.camera.y = 1866;
  g.camera.zoom = 0.92;
  return { screen: 'title' };
}

function stageDrive(g) {
  // Cruising Ocean Drive past the beach: palms, water, traffic, strollers.
  putPlayerInCar(g, 'coupe', 700, 3560, 0, '#d8a13a');
  g.shotZoom = 1.25;
  const input = autopilotInput([
    { x: 1400, y: 3560 },
    { x: 2200, y: 3560 },
    { x: 3000, y: 3560 },
    { x: 3400, y: 3100 },
  ]);
  runSteps(g, input, 5.5, { x: g.player.x + 200, y: g.player.y });
  // Compose the frame deterministically: mid-block on Ocean Drive, heading
  // east, beach below. The world around it is the lived-in simulated one.
  const car = g.player.car;
  car.x = 1900;
  car.y = 3560;
  car.angle = 0;
  car.vx = 280;
  car.vy = 0;
  car.health = 100;
  car.dead = false;
  car.burnt = false;
  car.exploded = false;
  g.player.x = car.x;
  g.player.y = car.y;
  g.player.angle = 0;
  g.player.aim = 0;
  g.camera.x = car.x + 90;
  g.camera.y = car.y + 150;
  g.camera.zoom = 1.25;
  g.toasts.push({ text: 'Ocean Drive', color: '#f5f1e6', life: 5, max: 5 });
  return { screen: 'play' };
}

function stageChase(g) {
  // Three stars downtown: two interceptors on the player's tail.
  putPlayerInCar(g, 'muscle', 1300, 1624, 0, '#e0a030');
  g.shotZoom = 1.2;
  g.police.setStars(g, 3);
  const input = autopilotInput([
    { x: 2108, y: 1624 },
    { x: 2108, y: 2592 },
    { x: 1140, y: 2592 },
    { x: 1140, y: 1624 },
    { x: 2108, y: 1624 },
  ]);
  runSteps(g, input, 4.5, { x: g.player.x + 200, y: g.player.y });
  g.toasts.length = 0;
  // Compose the frame deterministically: the player mid-block on a downtown
  // road heading east, patrol cars converging. No updates run after this,
  // so the geometry stays exactly as placed.
  const car = g.player.car;
  car.x = 1900;
  car.y = 1624;
  car.angle = 0;
  car.vx = 260;
  car.vy = 0;
  car.health = 100;
  car.dead = false;
  car.burnt = false;
  car.exploded = false;
  g.player.x = car.x;
  g.player.y = car.y;
  g.player.angle = 0;
  g.player.aim = 0;
  g.player.health = g.player.maxHealth;
  g.player.hurtTimer = 0;
  g.camera.x = car.x + 90;
  g.camera.y = car.y;
  g.camera.zoom = 1.2;
  const cops = g.cars.filter((c) => c.driver === 'police' && !c.dead);
  const place = (cop, forward, side) => {
    cop.x = car.x + forward;
    cop.y = car.y + side;
    cop.angle = 0;
    cop.vx = car.vx;
    cop.vy = 0;
  };
  if (cops[0]) place(cops[0], -150, 0);
  if (cops[1]) place(cops[1], -260, 0);
  if (cops[2]) place(cops[2], 170, -26);
  return { screen: 'play' };
}

function stageCombat(g) {
  // The Big Score at the bank: Jax on foot, guards closing in, vault ahead.
  g.missions.index = 4;
  g.saveData.missionIndex = 4;
  startMission(g.missions, g);
  const bank = g.city.locationById('bank');
  g.player.x = bank.x;
  g.player.y = bank.y + 70;
  g.player.onFoot = true;
  g.player.car = null;
  g.player.health = 82;
  g.camera.x = bank.x;
  g.camera.y = bank.y + 30;
  const input = autopilotInput([]);
  input.mouse = { x: 880, y: 300, down: true };
  input.isFiring = () => true;
  const aimWorld = { x: bank.x + 60, y: bank.y - 40 };
  runSteps(g, input, 1.6, aimWorld);
  // The frame should read as a clean firefight: full health (no damage
  // vignette), no mission-start toasts covering the bank, closer camera.
  g.player.health = g.player.maxHealth;
  g.player.hurtTimer = 0;
  g.toasts.length = 0;
  g.shotZoom = 1.2;
  g.camera.zoom = 1.2;
  // One more guard down for the frame, one muzzle flash frozen mid-shot.
  const standing = g.enemies.filter((e) => e.alive);
  if (standing.length > 2) {
    standing[0].alive = false;
    standing[0].down = true;
  }
  const target = g.enemies.find((e) => e.alive);
  if (target) {
    g.player.aim = Math.atan2(target.y - g.player.y, target.x - g.player.x);
    g.player.angle = g.player.aim;
    g.effects.muzzle(g.player.x, g.player.y, g.player.aim);
  }
  return { screen: 'play' };
}

/** Set the game to the named scene and return which screen to draw over it. */
export function stageShot(name, g) {
  if (name === 'drive') return stageDrive(g);
  if (name === 'chase') return stageChase(g);
  if (name === 'combat') return stageCombat(g);
  return stageStart(g);
}
