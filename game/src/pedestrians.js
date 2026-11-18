// Pedestrians: sidewalk walkers, beach strollers, witnesses and victims.
// They stroll the sidewalk edges, turn at intersections, flee from gunfire
// and explosions, and get knocked down by cars. A pedestrian who sees a crime
// is what makes the wanted system real.

import { BEACH_TOP, ROADS, ROAD_HALF, SIDEWALK, WATER_TOP, WORLD } from './config.js';
import { knockPed } from './vehicles.js';
import { reportCrime } from './police.js';

const SHIRTS = ['#c94f43', '#3a6fd8', '#e0a83e', '#4a9a5a', '#8a4a6a', '#e8e4d6', '#5a5a5e', '#3e7a6a'];
const PANTS = ['#2e3a4a', '#5a4a3a', '#3a3a3e', '#6a6a72', '#2a4a5a'];

function makePed(x, y, rng, beach) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 42 + rng() * 30,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    skin: ['#e8b98a', '#c98a5a', '#8a5a3a', '#f2d0a8'][Math.floor(rng() * 4)],
    hair: ['#2a2a2e', '#5a3a1a', '#c9c9c9', '#8a5a2a'][Math.floor(rng() * 4)],
    beach: !!beach,
    down: false,
    downTimer: 0,
    fleeTimer: 0,
    fleeX: 0,
    fleeY: 0,
    targetX: x,
    targetY: y,
    pauseTimer: rng() * 3,
    walkPhase: rng() * 6.28,
    queueSpot: -1,
  };
}

export function spawnPeds(game) {
  const rng = game.rng;
  // Sidewalk walkers: pick a road edge and a spot along it.
  for (let i = 0; i < 42; i += 1) {
    const vertical = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * 8)];
    const along = 120 + rng() * 3400;
    const side = rng() < 0.5 ? 1 : -1;
    const x = vertical ? road + side * (ROAD_HALF + SIDEWALK * 0.6) : along;
    const y = vertical ? along : road + side * (ROAD_HALF + SIDEWALK * 0.6);
    if (y > BEACH_TOP - 20) continue;
    const ped = makePed(x, y, rng, false);
    ped.targetX = x + (rng() - 0.5) * 500;
    ped.targetY = y + (rng() - 0.5) * 500;
    game.peds.push(ped);
  }
  // Beach strollers: half on the boardwalk, half on the sand.
  for (let i = 0; i < 12; i += 1) {
    const onBoardwalk = i % 2 === 0;
    const x = 100 + rng() * (WORLD.width - 200);
    const y = onBoardwalk ? BEACH_TOP + 40 : BEACH_TOP + 130 + rng() * 180;
    const ped = makePed(x, y, rng, true);
    ped.targetX = x + (rng() - 0.5) * 600;
    ped.targetY = y + (rng() - 0.5) * 60;
    game.peds.push(ped);
  }
  // Vendor queues: a few customers waiting at each stall.
  for (const prop of game.city.props) {
    if (prop.kind !== 'vendorStall') continue;
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i += 1) {
      const ped = makePed(prop.x - 20 + i * 16, prop.y + 42, rng, true);
      ped.queueSpot = i;
      ped.queueX = prop.x;
      ped.queueY = prop.y;
      ped.pauseTimer = 999;
      game.peds.push(ped);
    }
  }
}

// Pedestrians near a loud event run away from it.
export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.fleeTimer = 2.5 + game.rng() * 1.5;
      ped.fleeX = ped.x + (ped.x - x);
      ped.fleeY = ped.y + (ped.y - y);
    }
  }
}

function pickStrollTarget(game, ped) {
  const rng = game.rng;
  if (ped.beach) {
    ped.targetX = Math.max(60, Math.min(WORLD.width - 60, ped.x + (rng() - 0.5) * 700));
    ped.targetY = ped.y < BEACH_TOP + 80
      ? BEACH_TOP + 40 + rng() * 20
      : BEACH_TOP + 110 + rng() * 220;
    return;
  }
  // Walk along the sidewalks: pick a nearby road edge point.
  const vertical = rng() < 0.5;
  const road = ROADS[Math.floor(rng() * 8)];
  const side = rng() < 0.5 ? 1 : -1;
  const along = Math.max(100, Math.min(3600, (vertical ? ped.y : ped.x) + (rng() - 0.5) * 700));
  ped.targetX = vertical ? road + side * (ROAD_HALF + SIDEWALK * 0.6) : along;
  ped.targetY = vertical ? along : road + side * (ROAD_HALF + SIDEWALK * 0.6);
  ped.targetY = Math.min(ped.targetY, BEACH_TOP - 30);
}

export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.fleeTimer = 2;
      }
      continue;
    }
    if (ped.queueSpot >= 0) {
      // Queuers shuffle in place; they never leave the stall.
      ped.walkPhase += dt * 2;
      ped.x = ped.queueX - 20 + ped.queueSpot * 16 + Math.sin(game.time * 0.8 + ped.queueSpot) * 2;
      ped.y = ped.queueY + 42 + Math.cos(game.time * 0.6 + ped.queueSpot) * 1.5;
      ped.angle = -Math.PI / 2;
      continue;
    }
    let speed = ped.speed;
    let tx = ped.targetX;
    let ty = ped.targetY;
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      speed = ped.speed * 2.6;
      tx = ped.fleeX;
      ty = ped.fleeY;
    } else if (ped.pauseTimer > 0) {
      ped.pauseTimer -= dt;
      ped.walkPhase += dt * 1.5;
      continue;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) {
      if (ped.fleeTimer > 0) {
        ped.fleeTimer = 0;
      } else {
        pickStrollTarget(game, ped);
        ped.pauseTimer = game.rng() * 2.5;
      }
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / dist) * speed * dt;
    const ny = ped.y + (dy / dist) * speed * dt;
    const fixed = game.city.collideCircle(nx, ny, 11);
    if (Math.abs(fixed.x - nx) > 1 || Math.abs(fixed.y - ny) > 1) {
      // Blocked: slide along the obstacle by steering sideways.
      const side = Math.sin(game.time * 2 + ped.walkPhase) > 0 ? 1 : -1;
      const sx = ped.x + (-dy / dist) * side * speed * dt;
      const sy = ped.y + (dx / dist) * side * speed * dt;
      const fixedSide = game.city.collideCircle(sx, sy, 11);
      ped.x = fixedSide.x;
      ped.y = fixedSide.y;
    } else {
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
    ped.walkPhase += dt * (speed / 26);
  }

  // Cars knock pedestrians down. A hit at speed is a witnessed crime.
  for (const car of game.cars) {
    if (car.dead || Math.abs(car.speed) < 60) continue;
    for (const ped of game.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26) {
        knockPed(game, ped, 2.5 + Math.abs(car.speed) * 0.004);
        game.audio.crash();
        if (car.driver === 'player') {
          reportCrime(game, 'pedHit', ped.x, ped.y);
        }
      }
    }
  }
}
