// The Gulls: Solmar's rival crew. They guard their turf, open fire when the
// player comes close or shoots first, advance to shooting range, and break
// and run when badly hurt. Mission scripts spawn them; this file runs them.

import { WEAPONS, fireBullet } from './weapons.js';
import { pick } from './random.js';

const GULL_SKINS = ['#e8b98f', '#c98a5e', '#8a5a38', '#f0d0a8'];

export function spawnEnemy(x, y, opts) {
  const o = opts || {};
  return {
    x, y,
    angle: o.angle || 0,
    aim: o.angle || 0,
    jacket: o.jacket || '#7a2e35',
    pants: o.pants || '#2b2b30',
    skin: pick(Math.random, GULL_SKINS),
    hair: '#1c1c20',
    cap: o.cap || null,
    phase: Math.random() * 6.28,
    moving: false,
    health: o.health || 70,
    maxHealth: o.health || 70,
    alive: true,
    down: false,
    armed: true,
    showHealth: true,
    radius: 13,
    state: o.alerted ? 'chase' : 'guard',
    guardX: x,
    guardY: y,
    fireCooldown: 0.4 + Math.random() * 0.6,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    fleeing: false,
    missionTag: o.missionTag || null,
    isEnemy: true,
    vx: 0, vy: 0,
  };
}

function enemyShoot(e, g) {
  const player = g.player;
  const dist = Math.hypot(player.x - e.x, player.y - e.y);
  if (dist > WEAPONS.thug.range) return;
  if (g.city.segmentBlocked(e.x, e.y, player.x, player.y)) return;
  e.aim = Math.atan2(player.y - e.y, player.x - e.x);
  fireBullet(g.bullets, e.x + Math.cos(e.aim) * 16, e.y + Math.sin(e.aim) * 16, e.aim, 'thug', false, 1);
  g.effects.muzzle(e.x, e.y, e.aim);
  g.audio.enemyShot();
  e.fireCooldown = WEAPONS.thug.rate * (0.85 + Math.random() * 0.5);
}

export function updateEnemies(enemies, dt, g) {
  const player = g.player;
  for (const e of enemies) {
    if (!e.alive) continue;
    e.fireCooldown = Math.max(0, e.fireCooldown - dt);
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    // Aggro: proximity, or the player shooting nearby, or taking damage.
    if (e.state === 'guard' && (dist < 330 || e.alerted)) {
      e.state = 'chase';
    }
    if (e.state === 'guard') {
      e.moving = false;
      e.angle += Math.sin(g.time * 0.4 + e.phase) * dt * 0.4;
      e.aim = e.angle;
      continue;
    }
    // Badly hurt: some break and run.
    if (!e.fleeing && e.health < e.maxHealth * 0.28 && Math.random() < dt * 0.5) {
      e.fleeing = true;
    }
    if (e.fleeing) {
      const away = Math.atan2(e.y - player.y, e.x - player.x);
      e.angle = away;
      e.aim = away;
      e.moving = true;
      e.fleeTime = (e.fleeTime || 0) + dt;
      const nx = e.x + Math.cos(away) * 215 * dt;
      const ny = e.y + Math.sin(away) * 215 * dt;
      const fixed = g.city.collideCircle(nx, ny, 12);
      e.x = fixed.x;
      e.y = fixed.y;
      if (dist > 520 || e.fleeTime > 6) e.alive = false;
      continue;
    }
    // Combat: close to range, then strafe and shoot.
    const want = Math.atan2(player.y - e.y, player.x - e.x);
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = 0.8 + Math.random() * 1.2;
      e.strafeDir = Math.random() < 0.5 ? 1 : -1;
    }
    let moveAngle = want;
    let speed = 0;
    if (dist > 300) {
      speed = 165;
    } else if (dist < 130) {
      moveAngle = want + Math.PI;
      speed = 90;
    } else {
      moveAngle = want + (Math.PI / 2) * e.strafeDir;
      speed = 80;
    }
    e.moving = speed > 0;
    const nx = e.x + Math.cos(moveAngle) * speed * dt;
    const ny = e.y + Math.sin(moveAngle) * speed * dt;
    const fixed = g.city.collideCircle(nx, ny, 12);
    e.x = fixed.x;
    e.y = fixed.y;
    e.angle = want;
    e.aim = want;
    if (e.fireCooldown <= 0 && dist < WEAPONS.thug.range) enemyShoot(e, g);
  }
}

/** Damage an enemy; returns true when it just went down. */
export function damageEnemy(e, amount, g) {
  if (!e.alive) return false;
  e.health -= amount;
  e.alerted = true;
  if (e.state === 'guard') e.state = 'chase';
  if (e.health <= 0) {
    e.alive = false;
    e.down = true;
    e.moving = false;
    // Half of them drop a little cash.
    if (Math.random() < 0.5) {
      g.pickups.push({ kind: 'cashbag', x: e.x + 14, y: e.y + 10, value: 40, missionTag: null });
    }
    return true;
  }
  return false;
}
