// Jax Rivera on foot: run, sprint, aim with the mouse, shoot, punch, and
// get in and out of cars. Driving itself lives in vehicles.js; entering a
// car (including carjacking its driver) is the game's job.

import { PLAYER_CFG } from './config.js';
import { WEAPONS, fireBullet } from './weapons.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    aim: 0,
    vx: 0, vy: 0,
    moving: false,
    phase: 0,
    health: PLAYER_CFG.health,
    maxHealth: PLAYER_CFG.health,
    money: 250,
    weapon: 'pistol',
    rifleOwned: false,
    onFoot: true,
    car: null,
    jacket: '#e8643c',
    pants: '#2e3a4a',
    skin: '#e8b98f',
    hair: '#3a2a1c',
    cap: null,
    down: false,
    alive: true,
    radius: PLAYER_CFG.radius,
    armed: true,
    punchCooldown: 0,
    fireCooldown: 0,
    hurtTimer: 0,
    aimHeld: 0,
  };
}

/**
 * One on-foot step. input gives the move vector and firing state; aimWorld is
 * the mouse in world coordinates. Returns events for the game to react to.
 */
export function updatePlayerOnFoot(p, input, aimWorld, dt, city, g) {
  const events = { fired: false, punched: null };
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);

  const move = input.moveVector();
  const speed = input.held.sprint ? PLAYER_CFG.sprint : PLAYER_CFG.walk;
  const tx = move.x * speed;
  const ty = move.y * speed;
  const k = Math.min(1, dt * 12);
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  const fixed = city.collideCircle(nx, ny, PLAYER_CFG.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.moving = Math.hypot(p.vx, p.vy) > 20;
  if (p.moving) p.phase += dt * 10;

  // Face the mouse while aiming or firing, else the direction of travel.
  const aimAngle = Math.atan2(aimWorld.y - p.y, aimWorld.x - p.x);
  if (input.isFiring()) p.aimHeld = 0.6;
  else p.aimHeld = Math.max(0, p.aimHeld - dt);
  if (p.aimHeld > 0 || Math.hypot(aimWorld.x - p.x, aimWorld.y - p.y) < 320) {
    p.aim = aimAngle;
    p.angle = aimAngle;
  } else if (p.moving) {
    p.angle = Math.atan2(p.vy, p.vx);
    p.aim = p.angle;
  }

  const weapon = WEAPONS[p.weapon];
  if (input.isFiring() && p.fireCooldown <= 0) {
    fireBullet(g.bullets, p.x + Math.cos(p.aim) * 16, p.y + Math.sin(p.aim) * 16, p.aim, p.weapon, true, 1);
    g.effects.muzzle(p.x, p.y, p.aim);
    g.audio.gunshot();
    g.stats.shotsFired += 1;
    p.fireCooldown = weapon.rate;
    p.aimHeld = 0.6;
    events.fired = true;
    g.pedestrians.alert(p.x, p.y, 420);
  }
  return events;
}

/** Punch: hit the nearest person in front within reach. Returns the victim. */
export function playerPunch(p, people, g) {
  if (p.punchCooldown > 0) return null;
  p.punchCooldown = PLAYER_CFG.punchCooldown;
  g.audio.punch();
  let best = null;
  let bestD = PLAYER_CFG.punchRange;
  for (const person of people) {
    if (!person.alive || person === p) continue;
    const dx = person.x - p.x;
    const dy = person.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    const facing = (dx * Math.cos(p.angle) + dy * Math.sin(p.angle)) / (d || 1);
    if (facing < 0.3) continue;
    best = person;
    bestD = d;
  }
  if (best) {
    g.effects.hitPuff(best.x, best.y);
    const push = 190;
    best.x += Math.cos(p.angle) * 6;
    best.y += Math.sin(p.angle) * 6;
    if (best.vx !== undefined) {
      best.vx += Math.cos(p.angle) * push;
      best.vy += Math.sin(p.angle) * push;
    }
  }
  return best;
}

export function damagePlayer(p, amount, g) {
  if (!p.alive) return;
  p.health -= amount;
  p.hurtTimer = 0.4;
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
  }
  void g;
}
