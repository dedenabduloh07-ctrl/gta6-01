// Cars: arcade physics, damage, fire and explosions. A car is a heading plus a
// forward speed with lateral grip, so it drifts when the handbrake breaks the
// grip and slides a little on every hard turn. Damage comes from impacts; a
// wrecked car smokes, burns, then explodes and can set off its neighbours.

import { CAR, MODELS } from './config.js';
import { addShake, floatText, spawnBurst, spawnFire, spawnSmoke } from './effects.js';

let nextCarId = 1;

export function createCar(modelKey, x, y, angle, driver, paint) {
  const model = MODELS[modelKey];
  return {
    id: nextCarId,
    model: modelKey,
    label: model.label,
    w: model.w,
    l: model.l,
    top: model.top,
    pep: model.pep,
    color: paint || model.paints[0],
    x, y,
    angle,
    speed: 0,
    slide: 0,
    health: CAR.health,
    driver: driver || 'none',
    dead: false,
    burning: 0,
    smokeTimer: 0,
    fireTimer: 0,
    route: null,
    routeIndex: 0,
    waitTimer: 0,
    stuckTimer: 0,
    sirenPhase: (nextCarId * 2.39) % 6.28,
    hornTimer: 0,
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

// Advance one car along its heading with throttle/steer inputs in -1..1.
// Returns the distance travelled, for skid and sound decisions.
export function driveCar(car, throttle, steer, handbrake, dt, city) {
  if (car.dead) return 0;
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  if (throttle > 0) {
    car.speed += CAR.accel * car.pep * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 30) car.speed -= CAR.brake * dt;
    else car.speed = Math.max(-CAR.reverseMax, car.speed + CAR.accel * 0.6 * throttle * dt);
  }
  // Rolling drag and the handbrake's extra drag.
  car.speed -= car.speed * CAR.drag * dt;
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  const top = car.top * (handbrake ? 0.92 : 1);
  if (car.speed > top) car.speed = top;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;

  // Steering bites harder at speed, less at a standstill; reversing flips it.
  const grip = handbrake ? 2.2 : CAR.grip;
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 130);
  car.angle += steer * CAR.turn * steerAuthority * (car.speed >= 0 ? 1 : -1) * dt;
  // Lateral slide: the car keeps a little of its old sideways motion.
  const side = { x: -forward.y, y: forward.x };
  const slideTarget = handbrake ? steer * car.speed * 0.35 : 0;
  car.slide += (slideTarget - car.slide) * Math.min(1, grip * dt);

  const nx = car.x + (forward.x * car.speed + side.x * car.slide) * dt;
  const ny = car.y + (forward.y * car.speed + side.y * car.slide) * dt;
  const fixed = city.collideCircle(nx, ny, CAR.radius);
  const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 190) damageCar(car, (impact - 190) * 0.045, null);
    car.speed *= 0.45;
    car.slide *= 0.3;
  }
  const moved = Math.hypot(fixed.x - car.x, fixed.y - car.y);
  car.x = fixed.x;
  car.y = fixed.y;
  return moved;
}

// Circle collision between two cars: separate them and trade a little speed
// and damage. Returns true when they touched.
export function collideCars(a, b, game) {
  if (a.dead || b.dead) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = CAR.radius * 2 - 4;
  if (dist === 0 || dist >= min) return false;
  const push = (min - dist) / 2;
  const ux = dx / dist;
  const uy = dy / dist;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const closing = Math.abs(a.speed - b.speed);
  if (closing > 120) {
    damageCar(a, (closing - 120) * 0.02, game);
    damageCar(b, (closing - 120) * 0.02, game);
    if (game && closing > 260) {
      game.audio.crash();
      spawnBurst(game.effects, (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 8, color: '#f2c94c', speed: 120, life: 0.4, size: 3 });
    }
  }
  // Trade momentum so a ram slows the target but never welds the two cars
  // together: the anti-pin rule keeps every pile-up escapable.
  const exchange = (a.speed - b.speed) * 0.35;
  a.speed -= exchange;
  b.speed += exchange;
  return true;
}

export function damageCar(car, amount, game) {
  if (car.dead || amount <= 0) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    explodeCar(car, game);
  }
}

export function explodeCar(car, game) {
  if (car.dead) return;
  car.dead = true;
  car.speed = 0;
  if (!game) return;
  spawnBurst(game.effects, car.x, car.y, { count: 26, color: '#ff7a2e', speed: 260, life: 0.6, size: 7 });
  spawnBurst(game.effects, car.x, car.y, { count: 16, color: '#3a3a3e', speed: 150, life: 1.1, size: 10 });
  addShake(game.effects, 10);
  game.audio.explosion();
  // Chain reactions and area damage.
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 110) damageCar(other, 55 - d * 0.4, game);
  }
  const player = game.player;
  if (player.onFoot) {
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 110) hurtPlayer(game, 40 - d * 0.25, 'explosion');
  } else if (player.car === car) {
    ejectPlayer(game, 25);
  }
  for (const ped of game.peds) {
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 100 && !ped.down) knockPed(game, ped, 2.2);
  }
  for (const foe of game.enemies) {
    const d = Math.hypot(foe.x - car.x, foe.y - car.y);
    if (d < 110) hurtEnemy(game, foe, 60);
  }
}

// The player takes damage; at zero health the wasted flow starts. The hurt
// helpers live here because explosions and crashes reach them from cars.
export function hurtPlayer(game, amount, source) {
  const player = game.player;
  if (player.health <= 0 || game.pendingOverlay) return;
  player.health = Math.max(0, player.health - amount);
  player.lastHurt = game.time;
  if (player.health <= 0) {
    startWasted(game, source);
  }
}

export function ejectPlayer(game, damage) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  player.car = null;
  player.onFoot = true;
  player.x = car.x - Math.sin(car.angle) * 30;
  player.y = car.y + Math.cos(car.angle) * 30;
  const fixed = game.city.collideCircle(player.x, player.y, 13);
  player.x = fixed.x;
  player.y = fixed.y;
  car.driver = 'none';
  if (damage) hurtPlayer(game, damage, 'crash');
}

export function knockPed(game, ped, seconds) {
  if (ped.down) return;
  ped.down = true;
  ped.downTimer = seconds;
  ped.fleeTimer = 3;
  spawnBurst(game.effects, ped.x, ped.y, { count: 6, color: '#e8e4d6', speed: 90, life: 0.4, size: 3 });
}

export function hurtEnemy(game, foe, amount) {
  if (foe.dead) return;
  foe.health -= amount;
  foe.alerted = true;
  foe.lastHurt = game.time;
  if (foe.health <= 0) {
    foe.dead = true;
    foe.deadTimer = 0;
    spawnBurst(game.effects, foe.x, foe.y, { count: 10, color: '#c94f43', speed: 130, life: 0.5, size: 4 });
    game.audio.cash();
    const reward = 20 + Math.floor(game.rng() * 4) * 10;
    game.player.money += reward;
    floatText(game.effects, foe.x, foe.y - 18, `+$${reward}`, '#7ed07e');
  }
}

export function startWasted(game, source) {
  void source;
  game.pendingOverlay = {
    type: 'wasted',
    title: 'WASTED',
    lines: ['Jax was taken to Solmar General Hospital.', 'The mission resets. The debt remains.'],
  };
  game.audio.busted();
}

export function updateCarHealth(car, game, dt) {
  if (car.dead) return;
  if (car.health < 60) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      spawnSmoke(game.effects, car.x + Math.cos(car.angle) * 16, car.y + Math.sin(car.angle) * 16);
    }
  }
  if (car.health < 30) {
    car.fireTimer -= dt;
    if (car.fireTimer <= 0) {
      car.fireTimer = 0.09;
      spawnFire(game.effects, car.x + Math.cos(car.angle) * 14, car.y + Math.sin(car.angle) * 14);
    }
    car.burning += dt;
    if (car.burning > 6) explodeCar(car, game);
  }
}
