// Civilian traffic: cars that follow the road graph on the right-hand side,
// stop at red lights, brake for the player on foot and for the car ahead, and
// park along the curbs. Parked cars are the ones the player steals.

import { CAR, MODELS, ROADS, ROAD_HALF } from './config.js';
import { createCar, driveCar } from './vehicles.js';

const TRAFFIC_COUNT = 13;
const PARKED_COUNT = 12;
const LANE_OFFSET = 15;

// Traffic-light state for one intersection: a 14-second cycle, offset by
// phase so neighbouring lights alternate. North-south moves first.
export function lightState(phase, time) {
  const cycle = (time + phase * 7) % 14;
  if (cycle < 6) return 'ns';
  if (cycle < 7) return 'nsYellow';
  if (cycle < 13) return 'ew';
  return 'ewYellow';
}

function nearestRoadIndex(value) {
  let best = 0;
  for (let i = 1; i < ROADS.length; i += 1) {
    if (Math.abs(ROADS[i] - value) < Math.abs(ROADS[best] - value)) best = i;
  }
  return best;
}

function randomRoute(rng) {
  return routeFrom(rng, Math.floor(rng() * 8), Math.floor(rng() * 8));
}

function routeFrom(rng, startX, startY) {
  const points = [];
  let cx = startX;
  let cy = startY;
  points.push({ x: ROADS[cx], y: ROADS[cy] });
  for (let i = 0; i < 5; i += 1) {
    if (rng() < 0.5) cx = Math.max(0, Math.min(7, cx + (rng() < 0.5 ? -1 : 1)));
    else cy = Math.max(0, Math.min(7, cy + (rng() < 0.5 ? -1 : 1)));
    points.push({ x: ROADS[cx], y: ROADS[cy] });
  }
  return points;
}

export function spawnTraffic(game) {
  const rng = game.rng;
  const models = ['sedan', 'hatch', 'van', 'coupe', 'muscle', 'taxi'];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const model = models[Math.floor(rng() * models.length)];
    const route = randomRoute(rng);
    const start = route[0];
    const paint = MODELS[model].paints[Math.floor(rng() * MODELS[model].paints.length)];
    const car = createCar(model, start.x, start.y, rng() * Math.PI * 2, 'traffic', paint);
    car.route = route;
    car.routeIndex = 1;
    game.cars.push(car);
  }
  // Parked cars along curbs, with two guaranteed near Vince's garage so the
  // first theft is a short walk.
  const guaranteed = [
    { x: ROADS[1] - ROAD_HALF + 12, y: 1520, angle: Math.PI / 2 },
    { x: ROADS[1] + ROAD_HALF - 12, y: 1740, angle: -Math.PI / 2 },
  ];
  for (const spot of guaranteed) {
    const model = models[Math.floor(rng() * models.length)];
    const paint = MODELS[model].paints[Math.floor(rng() * MODELS[model].paints.length)];
    game.cars.push(createCar(model, spot.x, spot.y, spot.angle, 'parked', paint));
  }
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const vertical = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * 8)];
    const along = 260 + rng() * 3200;
    const side = rng() < 0.5 ? 1 : -1;
    const x = vertical ? road + side * (ROAD_HALF - 12) : along;
    const y = vertical ? along : road + side * (ROAD_HALF - 12);
    if (game.city.pointBlocked(x, y, CAR.radius)) continue;
    const model = models[Math.floor(rng() * models.length)];
    const paint = MODELS[model].paints[Math.floor(rng() * MODELS[model].paints.length)];
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    game.cars.push(createCar(model, x, y, angle, 'parked', paint));
  }
}

function carAhead(game, car, lookAhead) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = Infinity;
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > lookAhead) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 30 && along < nearest) nearest = along;
  }
  return nearest;
}

function playerAhead(game, car, lookAhead) {
  const player = game.player;
  if (!player.onFoot) return false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const along = dx * fx + dy * fy;
  if (along < 0 || along > lookAhead) return false;
  return Math.abs(-dx * fy + dy * fx) < 34;
}

// Is the car about to cross an intersection against its light?
function redLightAhead(game, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const ahead = 46;
  const px = car.x + fx * ahead;
  const py = car.y + fy * ahead;
  for (let i = 0; i < ROADS.length; i += 1) {
    for (let j = 0; j < ROADS.length; j += 1) {
      const ix = ROADS[i];
      const iy = ROADS[j];
      if (Math.abs(px - ix) < 34 && Math.abs(py - iy) < 34) {
        const movingVertical = Math.abs(fy) > Math.abs(fx);
        const state = lightState((i + j) % 2, game.time);
        if (movingVertical) return state === 'ew' || state === 'ewYellow';
        return state === 'ns' || state === 'nsYellow';
      }
    }
  }
  return false;
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    if (!car.route || car.routeIndex >= car.route.length) {
      car.route = routeFrom(game.rng, nearestRoadIndex(car.x), nearestRoadIndex(car.y));
      car.routeIndex = 1;
    }
    const target = car.route[car.routeIndex];
    // Drive on the right-hand side: shift the waypoint to the right of the
    // direction of travel, measured from the leg's start point.
    const legFrom = car.route[car.routeIndex - 1] || { x: car.x, y: car.y };
    const legDx = target.x - legFrom.x;
    const legDy = target.y - legFrom.y;
    const legLen = Math.hypot(legDx, legDy) || 1;
    const aimX = target.x + (-legDy / legLen) * LANE_OFFSET;
    const aimY = target.y + (legDx / legLen) * LANE_OFFSET;
    const dx = aimX - car.x;
    const dy = aimY - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      car.routeIndex += 1;
      continue;
    }
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const blocked = carAhead(game, car, 90) < 90 || playerAhead(game, car, 110) || redLightAhead(game, car);
    const throttle = blocked ? 0 : 0.62;
    const steer = diff < -0.12 ? -1 : diff > 0.12 ? 1 : 0;
    const moved = driveCar(car, throttle, steer, false, dt, game.city);
    if (throttle > 0 && moved < 2 * dt * 60 * 0.2 && Math.abs(car.speed) < 12) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 2.5) {
        car.route = routeFrom(game.rng, nearestRoadIndex(car.x), nearestRoadIndex(car.y));
        car.routeIndex = 1;
        car.stuckTimer = 0;
      }
    } else {
      car.stuckTimer = 0;
    }
  }
}
