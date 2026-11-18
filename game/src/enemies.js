// Hostile characters: bank guards, the Veloce GT's minders, and the getaway
// pursuers. Guards hold a post until the player comes close or makes noise,
// then shoot with long pauses and loose aim; pursuers drive after the player
// and ram, but never pin. Enemies are mission dressing, spawned by missions
// and cleared when the mission ends.

import { driveCar } from './vehicles.js';

let guardCount = 0;

export function createGuard(x, y, post) {
  guardCount += 1;
  return {
    x, y,
    homeX: x, homeY: y,
    post: post || { x, y },
    angle: 0,
    health: 60,
    dead: false,
    deadTimer: 0,
    alerted: false,
    shootTimer: 1 + ((guardCount * 0.37) % 0.8),
    strafeDir: 1,
    strafeTimer: 0,
    walkPhase: (guardCount * 1.71) % 6.28,
  };
}

export function spawnGuards(game, points) {
  for (const p of points) game.enemies.push(createGuard(p.x, p.y, p));
}

// Noise (a shot, an explosion) wakes every guard in earshot.
export function alertEnemies(game, x, y, radius) {
  for (const foe of game.enemies) {
    if (!foe.dead && Math.hypot(foe.x - x, foe.y - y) < radius) foe.alerted = true;
  }
}

export function updateEnemies(game, dt) {
  const player = game.player;
  for (const foe of game.enemies) {
    if (foe.dead) {
      foe.deadTimer += dt;
      continue;
    }
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const dist = Math.hypot(dx, dy);
    if (!foe.alerted && dist < 300) foe.alerted = true;
    if (!foe.alerted) {
      // Idle: drift back to the post and look around.
      const hx = foe.post.x - foe.x;
      const hy = foe.post.y - foe.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 12) {
        foe.x += (hx / hd) * 42 * dt;
        foe.y += (hy / hd) * 42 * dt;
        foe.angle = Math.atan2(hy, hx);
      } else {
        foe.angle += Math.sin(game.time * 0.5 + foe.walkPhase) * dt * 0.6;
      }
      foe.walkPhase += dt * 2;
      continue;
    }
    foe.angle = Math.atan2(dy, dx);
    // Strafe sideways to feel alive, and close in when too far to shoot.
    foe.strafeTimer -= dt;
    if (foe.strafeTimer <= 0) {
      foe.strafeTimer = 1.2 + game.rng() * 1.4;
      foe.strafeDir = game.rng() < 0.5 ? -1 : 1;
    }
    let mx = 0;
    let my = 0;
    if (dist > 330) {
      mx = (dx / dist) * 105;
      my = (dy / dist) * 105;
    } else if (dist < 130) {
      mx = (-dx / dist) * 60;
      my = (-dy / dist) * 60;
    }
    mx += -Math.sin(foe.angle) * 42 * foe.strafeDir;
    my += Math.cos(foe.angle) * 42 * foe.strafeDir;
    const nx = foe.x + mx * dt;
    const ny = foe.y + my * dt;
    const fixed = game.city.collideCircle(nx, ny, 12);
    foe.x = fixed.x;
    foe.y = fixed.y;
    foe.walkPhase += dt * 8;

    foe.shootTimer -= dt;
    if (foe.shootTimer <= 0 && dist < 430) {
      foe.shootTimer = 1.15 + game.rng() * 0.7;
      const spread = (game.rng() - 0.5) * 0.24;
      const angle = foe.angle + spread;
      game.bullets.push({
        x: foe.x + Math.cos(angle) * 18,
        y: foe.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * 880,
        vy: Math.sin(angle) * 880,
        life: 0.55, damage: 7, from: 'enemy',
      });
      game.audio.shoot(false);
    }
  }
  // The dead fade from the world after a while.
  game.enemies = game.enemies.filter((foe) => !foe.dead || foe.deadTimer < 6);
}

// Enemy pursuit cars (mission 2): chase the player and ram, using the same
// road routing as the police but without the bust rules.
export function updateEnemyDrivers(game, dt) {
  for (const car of game.cars) {
    if (car.driver !== 'enemy' || car.dead) continue;
    const player = game.player;
    car.repathTimer = (car.repathTimer || 0) - dt;
    if (car.repathTimer <= 0 || !car.route) {
      car.route = game.city.routeWaypoints(car.x, car.y, player.x, player.y);
      car.routeIndex = 1;
      car.repathTimer = 1.8;
    }
    let aim = { x: player.x, y: player.y };
    if (car.route && car.routeIndex < car.route.length) {
      aim = car.route[car.routeIndex];
      if (Math.hypot(aim.x - car.x, aim.y - car.y) < 40) car.routeIndex += 1;
      if (Math.hypot(player.x - car.x, player.y - car.y) < 240) aim = { x: player.x, y: player.y };
    }
    const dx = aim.x - car.x;
    const dy = aim.y - car.y;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = diff < -0.14 ? -1 : diff > 0.14 ? 1 : 0;
    driveCar(car, 0.88, steer, false, dt, game.city);
  }
}
