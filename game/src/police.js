// The wanted system and the police, tuned to spec section 12. Stars rise ONLY
// from new witnessed crimes — never from time passing, proximity, or already
// being wanted. There is no feedback loop: a chase cannot make itself worse.
// Police spawn at a distance, approach over seconds, ram without pinning, and
// the bust meter needs sustained closeness plus a slow player, draining fast
// on escape. Breaking away and staying out of sight cools the heat down.

import { ROADS, WANTED } from './config.js';
import { createCar, driveCar, hurtPlayer } from './vehicles.js';

export function createPolice() {
  const police = {
    stars: 0,
    bustMeter: 0,
    heatCooldown: 0,
    unseenTimer: 0,
    decayTimer: 0,
    spawnTimer: 0,
    footCops: [],
    // The debug and script hook: set the wanted level directly.
    setStars(game, count) {
      police.stars = Math.max(0, Math.min(5, count));
      police.bustMeter = 0;
      police.unseenTimer = 0;
      police.decayTimer = 0;
      police.heatCooldown = 1.0;
      if (police.stars === 0) clearForce(game);
      void game;
    },
  };
  return police;
}

function clearForce(game) {
  game.cars = game.cars.filter((c) => c.driver !== 'police');
  game.police.footCops = [];
}

// Did anyone see the crime? Pedestrians on their feet and nearby police
// count as witnesses. Each kind has its own witness radius.
function witnessed(game, kind, x, y) {
  let radius = WANTED.shotWitness;
  if (kind === 'theft') radius = WANTED.theftWitness;
  if (kind === 'pedHit') radius = WANTED.hitWitness;
  if (kind === 'ramCop') return true;
  for (const ped of game.peds) {
    if (!ped.down && Math.hypot(ped.x - x, ped.y - y) < radius) return true;
  }
  for (const car of game.cars) {
    if (car.driver === 'police' && !car.dead && Math.hypot(car.x - x, car.y - y) < radius + 120) return true;
  }
  for (const cop of game.police.footCops) {
    if (Math.hypot(cop.x - x, cop.y - y) < radius) return true;
  }
  return false;
}

// A crime was committed. Stars rise by one, at most, and only when witnessed
// and the heat cooldown has expired — so a burst of crimes cannot stack stars
// in seconds. Unwitnessed crimes change nothing.
export function reportCrime(game, kind, x, y) {
  const police = game.police;
  if (police.stars >= 5) return;
  if (police.heatCooldown > 0) return;
  if (!witnessed(game, kind, x, y)) return;
  police.stars = Math.min(5, police.stars + 1);
  police.heatCooldown = WANTED.heatCooldown;
  police.unseenTimer = 0;
  police.decayTimer = 0;
}

// Pick a spawn point on a road at a distance from the player: never adjacent,
// always far enough that the approach takes a few seconds.
function spawnPoint(game, rng) {
  const player = game.player;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = WANTED.spawnMin + rng() * (WANTED.spawnMax - WANTED.spawnMin);
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    const vertical = Math.abs(x - game.city.nearestRoad(x)) < Math.abs(y - game.city.nearestRoad(y));
    const px = vertical ? game.city.nearestRoad(x) : x;
    const py = vertical ? y : game.city.nearestRoad(y);
    if (px < 60 || px > 3670 || py < 60 || py > 3600) continue;
    if (game.city.pointBlocked(px, py, 24)) continue;
    return { x: px, y: py };
  }
  return null;
}

function updateCopCar(game, car, dt) {
  const player = game.player;
  const target = { x: player.x, y: player.y };
  // Re-route along the road graph every so often, or when the player moved.
  car.repathTimer = (car.repathTimer || 0) - dt;
  const moved = car.lastTarget ? Math.hypot(target.x - car.lastTarget.x, target.y - car.lastTarget.y) : 9999;
  if (car.repathTimer <= 0 || moved > 420 || !car.route) {
    car.route = game.city.routeWaypoints(car.x, car.y, target.x, target.y);
    car.routeIndex = 1;
    car.repathTimer = 1.6;
    car.lastTarget = { ...target };
  }
  let aim = target;
  if (car.route && car.routeIndex < car.route.length) {
    aim = car.route[car.routeIndex];
    if (Math.hypot(aim.x - car.x, aim.y - car.y) < 40) car.routeIndex += 1;
    // Close in: abandon the route and drive straight at the player.
    if (Math.hypot(target.x - car.x, target.y - car.y) < 260) aim = target;
  }
  // Back-off: a cop that has been grinding against the player's car reverses
  // clear instead of pinning it forever.
  if (car.backoffTimer > 0) {
    car.backoffTimer -= dt;
    driveCar(car, -0.9, car.backoffSteer, false, dt, game.city);
    return;
  }
  if (car.contactTimer > 1.2) {
    car.contactTimer = 0;
    car.backoffTimer = 1.1;
    car.backoffSteer = game.rng() < 0.5 ? -1 : 1;
    driveCar(car, -0.9, car.backoffSteer, false, dt, game.city);
    return;
  }
  const dx = aim.x - car.x;
  const dy = aim.y - car.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff < -0.14 ? -1 : diff > 0.14 ? 1 : 0;
  let throttle = 0.92;
  if (Math.abs(diff) > 2.2) throttle = 0.25;
  if (car.stuckTimer > 0) {
    car.stuckTimer -= dt;
    driveCar(car, -0.8, -steer || 1, false, dt, game.city);
    return;
  }
  const movedDist = driveCar(car, throttle, steer, false, dt, game.city);
  if (throttle > 0.5 && movedDist < 3 && Math.abs(car.speed) < 20) {
    car.stillTimer = (car.stillTimer || 0) + dt;
    if (car.stillTimer > 1.4) {
      car.stuckTimer = 0.9;
      car.stillTimer = 0;
    }
  } else {
    car.stillTimer = 0;
  }
}

function updateFootCop(game, cop, dt) {
  const player = game.player;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  if (dist > 26) {
    const speed = 235;
    const nx = cop.x + (dx / dist) * speed * dt;
    const ny = cop.y + (dy / dist) * speed * dt;
    const fixed = game.city.collideCircle(nx, ny, 12);
    cop.x = fixed.x;
    cop.y = fixed.y;
    cop.walkPhase += dt * 9;
  }
  cop.attackTimer -= dt;
  if (dist < 40 && cop.attackTimer <= 0 && player.onFoot) {
    cop.attackTimer = 1.1;
    hurtPlayer(game, 5, 'cop');
  }
  // At four stars and above, foot cops shoot — slowly and inaccurately.
  if (game.police.stars >= 4 && dist < 380 && dist > 60 && cop.attackTimer <= 0) {
    cop.attackTimer = 1.7;
    const spread = (game.rng() - 0.5) * 0.3;
    game.bullets.push({
      x: cop.x, y: cop.y,
      vx: Math.cos(cop.angle + spread) * 900,
      vy: Math.sin(cop.angle + spread) * 900,
      life: 0.5, damage: 6, from: 'enemy',
    });
    game.audio.shoot(false);
  }
}

export function updatePolice(game, dt) {
  const police = game.police;
  police.heatCooldown = Math.max(0, police.heatCooldown - dt);

  if (police.stars === 0) {
    if (game.cars.some((c) => c.driver === 'police') || police.footCops.length > 0) {
      clearForce(game);
    }
    police.bustMeter = 0;
    return;
  }

  // Spawn the pursuit force, staggered, at a distance.
  const wanted = Math.min(police.stars, WANTED.maxCars);
  const have = game.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  police.spawnTimer -= dt;
  if (have < wanted && police.spawnTimer <= 0) {
    const spot = spawnPoint(game, game.rng);
    if (spot) {
      const car = createCar('police', spot.x, spot.y, Math.atan2(game.player.y - spot.y, game.player.x - spot.x), 'police');
      car.contactTimer = 0;
      car.backoffTimer = 0;
      game.cars.push(car);
    }
    police.spawnTimer = 1.4;
  }

  // Foot cops join at three stars.
  const wantFoot = police.stars >= 3 ? 2 : 0;
  while (police.footCops.length < wantFoot) {
    const angle = game.rng() * Math.PI * 2;
    const dist = 320 + game.rng() * 120;
    const x = game.player.x + Math.cos(angle) * dist;
    const y = game.player.y + Math.sin(angle) * dist;
    const fixed = game.city.collideCircle(x, y, 12);
    police.footCops.push({ x: fixed.x, y: fixed.y, angle: 0, attackTimer: 1, walkPhase: 0 });
  }
  if (police.footCops.length > wantFoot) police.footCops.length = wantFoot;

  for (const car of game.cars) {
    if (car.driver === 'police' && !car.dead) updateCopCar(game, car, dt);
  }
  for (const cop of police.footCops) updateFootCop(game, cop, dt);

  // The bust meter: only when an officer is very close AND the player is
  // slow. It drains several times faster than it fills.
  let nearest = Infinity;
  for (const car of game.cars) {
    if (car.driver === 'police' && !car.dead) {
      nearest = Math.min(nearest, Math.hypot(car.x - game.player.x, car.y - game.player.y));
    }
  }
  for (const cop of police.footCops) {
    nearest = Math.min(nearest, Math.hypot(cop.x - game.player.x, cop.y - game.player.y));
  }
  const player = game.player;
  const playerSpeed = player.onFoot ? (player.moving ? 240 : 0) : Math.abs(player.car ? player.car.speed : 0);
  if (nearest < WANTED.bustRadius && playerSpeed < WANTED.bustSlow) {
    police.bustMeter += WANTED.bustFill * dt;
  } else {
    police.bustMeter = Math.max(0, police.bustMeter - WANTED.bustDrain * dt);
  }
  if (police.bustMeter >= 1) {
    startBusted(game);
    return;
  }

  // Evade: staying out of sight with no new crime cools the heat down.
  if (nearest > WANTED.unseenRadius) {
    police.unseenTimer += dt;
    if (police.unseenTimer > WANTED.decayDelay) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decayEvery) {
        police.decayTimer = 0;
        police.stars = Math.max(0, police.stars - 1);
        if (police.stars === 0) clearForce(game);
      }
    }
  } else {
    police.unseenTimer = 0;
    police.decayTimer = 0;
  }
}

export function startBusted(game) {
  const police = game.police;
  const fine = Math.min(WANTED.bustFine, game.player.money);
  game.player.money -= fine;
  police.stars = 0;
  police.bustMeter = 0;
  clearForce(game);
  game.pendingOverlay = {
    type: 'busted',
    title: 'BUSTED',
    lines: [`The police took $${fine} and dropped Jax at HQ.`, 'The mission resets. The debt remains.'],
  };
  game.audio.busted();
}
