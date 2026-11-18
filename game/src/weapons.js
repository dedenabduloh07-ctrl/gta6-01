// Shooting: weapon stats, bullet flight and hits. Bullets stop at walls,
// dent cars, and hurt people; the game supplies the targets and hears about
// kills through callbacks so this file stays free of rules.

export const WEAPONS = {
  pistol: { label: 'Pistol', damage: 34, rate: 0.26, range: 540, spread: 0.035, speed: 950, auto: false, kick: 0.5 },
  rifle: { label: 'Rifle', damage: 24, rate: 0.095, range: 640, spread: 0.07, speed: 1050, auto: true, kick: 0.3 },
  thug: { label: 'Pistol', damage: 9, rate: 0.8, range: 420, spread: 0.09, speed: 850, auto: false, kick: 0 },
};

export function fireBullet(bullets, x, y, angle, weaponKey, fromPlayer, damageScale) {
  const w = WEAPONS[weaponKey];
  const a = angle + (Math.random() - 0.5) * 2 * w.spread;
  bullets.push({
    x, y,
    vx: Math.cos(a) * w.speed,
    vy: Math.sin(a) * w.speed,
    life: w.range / w.speed,
    damage: w.damage * (damageScale || 1),
    fromPlayer,
  });
}

function pointInCar(x, y, car) {
  const dx = x - car.x;
  const dy = y - car.y;
  const c = Math.cos(-car.angle);
  const s = Math.sin(-car.angle);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) < 25 && Math.abs(ly) < 13;
}

/**
 * Move bullets and resolve hits. ctx: {city, cars, people, effects, audio,
 * onCarHit(car, bullet), onPersonHit(person, bullet), onWallHit(x, y)}.
 * people entries carry {x, y, radius, alive} plus whatever the callback needs.
 */
export function updateBullets(bullets, dt, ctx) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    const steps = 2;
    let dead = b.life <= 0;
    for (let s = 0; s < steps && !dead; s += 1) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      const wall = ctx.city.collideCircle(b.x, b.y, 2);
      if (wall.hit) {
        ctx.effects.sparks(b.x, b.y, 3);
        if (ctx.onWallHit) ctx.onWallHit(b.x, b.y);
        dead = true;
        break;
      }
      for (const car of ctx.cars) {
        if (car.dead) continue;
        if (pointInCar(b.x, b.y, car)) {
          ctx.effects.sparks(b.x, b.y, 4);
          if (!ctx.onCarHit || ctx.onCarHit(car, b) !== false) dead = true;
          break;
        }
      }
      if (dead) break;
      for (const person of ctx.people) {
        if (!person.alive) continue;
        const dx = b.x - person.x;
        const dy = b.y - person.y;
        const r = person.radius || 13;
        if (dx * dx + dy * dy < r * r) {
          ctx.effects.hitPuff(b.x, b.y);
          if (!ctx.onPersonHit || ctx.onPersonHit(person, b) !== false) dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}
