// Guns, bullets and fists. The player aims with the mouse and holds the
// button to fire; bullets fly straight until their range ends, and hitting
// people, cars or walls is all resolved here. Firing near witnesses is a
// crime; hitting a pedestrian is a worse one. Both go through the same
// witnessed-crime gate as everything else, so shooting cannot spiral.

import { WEAPONS } from './config.js';
import { spawnBurst } from './effects.js';
import { alertEnemies } from './enemies.js';
import { scarePeds } from './pedestrians.js';
import { reportCrime } from './police.js';
import { damageCar, hurtEnemy, hurtPlayer, knockPed } from './vehicles.js';

export function fireWeapon(game) {
  const player = game.player;
  const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;
  if (player.fireCooldown > 0) return false;
  player.fireCooldown = weapon.interval;
  const spread = (game.rng() - 0.5) * 2 * weapon.spread;
  const angle = player.aimAngle + spread;
  const muzzle = 20;
  game.bullets.push({
    x: player.x + Math.cos(angle) * muzzle,
    y: player.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * weapon.speed,
    vy: Math.sin(angle) * weapon.speed,
    life: weapon.range / weapon.speed,
    damage: weapon.damage,
    from: 'player',
  });
  game.stats.shotsFired += 1;
  game.audio.shoot(player.weapon === 'rifle');
  spawnBurst(game.effects, player.x + Math.cos(angle) * 24, player.y + Math.sin(angle) * 24, {
    count: 3, color: '#f2c94c', speed: 60, life: 0.12, size: 3,
  });
  scarePeds(game, player.x, player.y, 320);
  alertEnemies(game, player.x, player.y, 520);
  reportCrime(game, 'shot', player.x, player.y);
  return true;
}

export function punch(game) {
  const player = game.player;
  if (!player.onFoot || player.fireCooldown > 0) return;
  player.fireCooldown = 0.4;
  game.audio.punch();
  const reach = 34;
  const px = player.x + Math.cos(player.aimAngle) * reach;
  const py = player.y + Math.sin(player.aimAngle) * reach;
  for (const ped of game.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 22) {
      knockPed(game, ped, 1.6);
      reportCrime(game, 'pedHit', ped.x, ped.y);
      return;
    }
  }
  for (const foe of game.enemies) {
    if (foe.dead) continue;
    if (Math.hypot(foe.x - px, foe.y - py) < 24) {
      hurtEnemy(game, foe, 14);
      return;
    }
  }
}

function bulletHitsWall(game, x, y) {
  return game.city.pointBlocked(x, y, 2);
}

export function updateBullets(game, dt) {
  for (const bullet of game.bullets) {
    bullet.life -= dt;
    const steps = 2;
    for (let s = 0; s < steps && bullet.life > 0; s += 1) {
      bullet.x += (bullet.vx * dt) / steps;
      bullet.y += (bullet.vy * dt) / steps;
      if (bulletHitsWall(game, bullet.x, bullet.y)) {
        spawnBurst(game.effects, bullet.x, bullet.y, { count: 4, color: '#d8d3c4', speed: 90, life: 0.3, size: 2 });
        bullet.life = 0;
        break;
      }
      if (bullet.from === 'player') {
        let consumed = false;
        for (const foe of game.enemies) {
          if (foe.dead) continue;
          if (Math.hypot(foe.x - bullet.x, foe.y - bullet.y) < 15) {
            hurtEnemy(game, foe, bullet.damage);
            spawnBurst(game.effects, bullet.x, bullet.y, { count: 5, color: '#c94f43', speed: 110, life: 0.35, size: 3 });
            consumed = true;
            break;
          }
        }
        if (consumed) { bullet.life = 0; break; }
        for (const ped of game.peds) {
          if (ped.down) continue;
          if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 13) {
            knockPed(game, ped, 3.5);
            scarePeds(game, ped.x, ped.y, 300);
            reportCrime(game, 'pedHit', ped.x, ped.y);
            spawnBurst(game.effects, bullet.x, bullet.y, { count: 5, color: '#c94f43', speed: 110, life: 0.35, size: 3 });
            consumed = true;
            break;
          }
        }
        if (consumed) { bullet.life = 0; break; }
        for (const car of game.cars) {
          if (car.dead || car === game.player.car) continue;
          const dx = bullet.x - car.x;
          const dy = bullet.y - car.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < car.l / 2 + 2 && Math.abs(localY) < car.w / 2 + 2) {
            damageCar(car, bullet.damage, game);
            if (car.driver === 'police') reportCrime(game, 'ramCop', car.x, car.y);
            spawnBurst(game.effects, bullet.x, bullet.y, { count: 4, color: '#f2c94c', speed: 100, life: 0.3, size: 2 });
            consumed = true;
            break;
          }
        }
        if (consumed) { bullet.life = 0; break; }
      } else {
        // Enemy fire: only the player on foot can be hit.
        const player = game.player;
        if (player.onFoot && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 14) {
          hurtPlayer(game, bullet.damage, 'shot');
          spawnBurst(game.effects, bullet.x, bullet.y, { count: 4, color: '#c94f43', speed: 100, life: 0.3, size: 3 });
          bullet.life = 0;
          break;
        }
        if (!player.onFoot && player.car && Math.hypot(player.car.x - bullet.x, player.car.y - bullet.y) < 24) {
          damageCar(player.car, bullet.damage * 0.5, game);
          bullet.life = 0;
          break;
        }
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}
