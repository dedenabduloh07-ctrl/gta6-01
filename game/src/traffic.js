// Ambient traffic: cars that follow the road graph on the correct side,
// stop at red lights, brake for the car ahead and for crossing pedestrians,
// and respawn around the player so the streets never feel empty. Parked cars
// fill the curb spots and wait to be stolen.

import { N_ROADS, ROAD, roadCenter } from './config.js';
import { CAR_MODELS, carForwardSpeed, createCar, driveCar } from './vehicles.js';
import { pick, randInt } from './random.js';

const TRAFFIC_COUNT = 14;
const PARKED_COUNT = 30;
const LANE = ROAD / 4;

const TRAFFIC_MODELS = ['sedan', 'sedan', 'coupe', 'muscle', 'van', 'pickup', 'taxi', 'hauler'];

/** Lane point for travel from node A to node B, at the B end of the edge. */
function lanePoint(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Right-hand traffic: offset to the right of the travel direction.
  const ox = -uy * LANE;
  const oy = ux * LANE;
  return { x: bx + ox - ux * 8, y: by + oy - uy * 8 };
}

function nodePos(i, j) {
  return { x: roadCenter(i), y: roadCenter(j) };
}

export function createTraffic(city, rng) {
  function randomNode() {
    return { i: randInt(rng, 0, N_ROADS - 1), j: randInt(rng, 0, N_ROADS - 1) };
  }

  function pickNext(from, at) {
    const options = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of dirs) {
      const ni = at.i + di;
      const nj = at.j + dj;
      if (ni < 0 || ni >= N_ROADS || nj < 0 || nj >= N_ROADS) continue;
      if (ni === from.i && nj === from.j) continue;
      options.push({ i: ni, j: nj, straight: di === at.i - from.i && dj === at.j - from.j });
    }
    if (options.length === 0) return from;
    const straight = options.filter((o) => o.straight);
    if (straight.length && rng() < 0.62) return pick(rng, straight);
    return pick(rng, options);
  }

  function placeOnRoad(car, nearX, nearY) {
    // Pick a road point 600-1100px from the reference, on the graph.
    for (let tries = 0; tries < 24; tries += 1) {
      const a = randomNode();
      const b = pickNext(a, a);
      const pa = nodePos(a.i, a.j);
      const pb = nodePos(b.i, b.j);
      const t = rng();
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = pa.x + dx * t + (-dy / len) * LANE;
      const py = pa.y + dy * t + (dx / len) * LANE;
      const d = Math.hypot(px - nearX, py - nearY);
      if (d > 550 && d < 1150) {
        car.x = px;
        car.y = py;
        car.angle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        car.from = a;
        car.at = b;
        car.waypoint = lanePoint(pa.x, pa.y, pb.x, pb.y);
        return true;
      }
    }
    return false;
  }

  function spawnTrafficCar(cars, nearX, nearY) {
    const model = pick(rng, TRAFFIC_MODELS);
    const spec = CAR_MODELS[model];
    const car = createCar(model, 0, 0, 0, pick(rng, spec.colors), 'traffic');
    car.cruise = 120 + rng() * 55;
    car.from = { i: 0, j: 0 };
    car.at = { i: 1, j: 0 };
    car.waypoint = { x: 0, y: 0 };
    if (!placeOnRoad(car, nearX, nearY)) return null;
    cars.push(car);
    return car;
  }

  function spawnParkedCar(cars, spot) {
    const model = pick(rng, TRAFFIC_MODELS);
    const spec = CAR_MODELS[model];
    const car = createCar(model, spot.x, spot.y, spot.angle, pick(rng, spec.colors), 'parked');
    car.parkedSpot = spot;
    spot.taken = true;
    cars.push(car);
    return car;
  }

  function init(cars, playerX, playerY) {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar(cars, playerX, playerY);
    const spots = [...city.parking];
    for (let i = spots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const t = spots[i];
      spots[i] = spots[j];
      spots[j] = t;
    }
    let placed = 0;
    for (const spot of spots) {
      if (placed >= PARKED_COUNT) break;
      if (Math.hypot(spot.x - playerX, spot.y - playerY) < 260) continue;
      spawnParkedCar(cars, spot);
      placed += 1;
    }
  }

  function steerToward(car, tx, ty) {
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return { diff, steer: Math.max(-1, Math.min(1, diff * 2.2)) };
  }

  function updateCar(car, dt, time, g) {
    const wp = car.waypoint;
    const dist = Math.hypot(wp.x - car.x, wp.y - car.y);
    if (dist < 34) {
      const next = pickNext(car.from, car.at);
      const pa = nodePos(car.at.i, car.at.j);
      const pb = nodePos(next.i, next.j);
      car.from = car.at;
      car.at = next;
      car.waypoint = lanePoint(pa.x, pa.y, pb.x, pb.y);
      return;
    }
    const { diff, steer } = steerToward(car, wp.x, wp.y);
    let desired = car.cruise;
    // Slow for sharp turns.
    desired *= 1 - Math.min(0.55, Math.abs(diff) * 0.5);
    // Red light: stop before the intersection.
    const pa = nodePos(car.from.i, car.from.j);
    const pb = nodePos(car.at.i, car.at.j);
    const axis = pa.x === pb.x ? 'ns' : 'ew';
    const state = city.lightState(car.at.i, car.at.j, time, axis);
    if ((car.at.i + car.at.j) % 2 === 0 && state !== 'green') {
      const travelX = Math.sign(pb.x - pa.x);
      const travelY = Math.sign(pb.y - pa.y);
      const stopX = pb.x - travelX * (ROAD / 2 + 16) + (axis === 'ns' ? (travelY > 0 ? -LANE : LANE) : 0);
      const stopY = pb.y - travelY * (ROAD / 2 + 16) + (axis === 'ew' ? (travelX > 0 ? LANE : -LANE) : 0);
      const toStop = (stopX - car.x) * travelX + (stopY - car.y) * travelY;
      if (toStop > -6 && toStop < 130) {
        desired = Math.min(desired, Math.max(0, toStop * 1.4 - 6));
        if (state === 'red' && toStop < 26) desired = 0;
      }
    }
    // Brake for the car ahead (parked cars hug the curb, out of the lane).
    for (const other of g.cars) {
      if (other === car || other.dead || other.driver === 'parked' || other.driver === 'none') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d > 95 || d < 1) continue;
      const ahead = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
      if (ahead < 0.86) continue;
      const lateral = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (lateral > 22) continue;
      desired = Math.min(desired, Math.max(0, (d - 34) * 1.6));
    }
    // Brake for pedestrians crossing ahead.
    for (const p of g.peds) {
      if (p.state !== 'cross' && p.state !== 'flee') continue;
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d > 80 || d < 1) continue;
      const ahead = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
      if (ahead > 0.8) desired = Math.min(desired, Math.max(0, (d - 30) * 1.4));
    }
    const speed = carForwardSpeed(car);
    const throttle = desired > speed + 4 ? 1 : desired < speed - 4 ? -0.7 : 0;
    const result = driveCar(car, { throttle, steer, handbrake: false }, dt, city);
    if (result.crashed && result.impact > 90) {
      g.effects.sparks(car.x, car.y, 5);
      g.audio.crash(result.impact / 400);
    }
  }

  return {
    init,
    spawnTrafficCar,
    spawnParkedCar,
    update(dt, time, g) {
      let traffic = 0;
      for (const car of g.cars) {
        if (car.driver !== 'traffic' || car.dead) continue;
        traffic += 1;
        // Recycle cars that drifted far from the player.
        if (Math.hypot(car.x - g.player.x, car.y - g.player.y) > 1700) {
          if (!placeOnRoad(car, g.player.x, g.player.y)) continue;
        }
        updateCar(car, dt, time, g);
      }
      // Top the traffic back up (stolen / wrecked cars get replaced).
      if (traffic < TRAFFIC_COUNT && Math.random() < dt * 0.7) {
        spawnTrafficCar(g.cars, g.player.x, g.player.y);
      }
      // Parked cars slowly refill free spots near the player.
      if (Math.random() < dt * 0.25) {
        const free = city.parking.filter((s) => !s.taken && Math.hypot(s.x - g.player.x, s.y - g.player.y) > 500 && Math.hypot(s.x - g.player.x, s.y - g.player.y) < 1300);
        if (free.length) spawnParkedCar(g.cars, pick(rng, free));
      }
    },
  };
}
