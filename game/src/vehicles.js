// Cars: arcade driving physics with drift, damage states and the model table.
// A car is steered by throttle/steer/handbrake; velocity splits into forward
// and lateral parts so handbrake turns slide and leave skid marks.

import { SAND_TOP, WATER_TOP } from './config.js';

export const CAR_MODELS = {
  sedan: { label: 'Sedan', w: 46, h: 22, accel: 265, maxSpeed: 335, reverse: 130, turn: 2.7, grip: 8.5, mass: 1.0, colors: ['#c94f43', '#4a6b8a', '#d8d3c4', '#5a5f66', '#7a8a4a', '#8a8f96'] },
  coupe: { label: 'Coupe', w: 44, h: 21, accel: 300, maxSpeed: 365, reverse: 135, turn: 2.9, grip: 9.0, mass: 0.9, colors: ['#d8a13a', '#3a7a8c', '#b8443c', '#e3ded0', '#4d4a55'] },
  muscle: { label: 'Muscle', w: 47, h: 22, accel: 340, maxSpeed: 355, reverse: 130, turn: 2.5, grip: 7.2, mass: 1.1, colors: ['#8f2f26', '#2b2b30', '#c97b2e', '#3f5a3a'] },
  taxi: { label: 'Taxi', w: 46, h: 22, accel: 265, maxSpeed: 335, reverse: 130, turn: 2.7, grip: 8.5, mass: 1.0, colors: ['#e8b820'] },
  van: { label: 'Van', w: 52, h: 24, accel: 210, maxSpeed: 290, reverse: 110, turn: 2.2, grip: 8.0, mass: 1.4, colors: ['#d8d3c4', '#6a7a8a', '#8a6f4d', '#4a6b5a'] },
  pickup: { label: 'Pickup', w: 50, h: 23, accel: 250, maxSpeed: 320, reverse: 125, turn: 2.5, grip: 8.2, mass: 1.2, colors: ['#7a4a2e', '#5a6b3a', '#8a8f96', '#3a4a5a'] },
  hauler: { label: 'Hauler', w: 62, h: 26, accel: 170, maxSpeed: 260, reverse: 100, turn: 1.9, grip: 7.6, mass: 1.9, colors: ['#b8b0a0', '#4a6b8a', '#8a7a3a'] },
  veloce: { label: 'Veloce GT', w: 45, h: 20, accel: 380, maxSpeed: 430, reverse: 140, turn: 3.1, grip: 9.5, mass: 0.85, colors: ['#c22e3e', '#e8b820', '#2b2b30'] },
  police: { label: 'Interceptor', w: 47, h: 22, accel: 330, maxSpeed: 400, reverse: 140, turn: 2.9, grip: 9.2, mass: 1.1, colors: ['#22242c'] },
};

let nextCarId = 1;

export function createCar(model, x, y, angle, color, driver) {
  const spec = CAR_MODELS[model];
  const id = nextCarId;
  nextCarId += 1;
  return {
    id,
    model,
    label: spec.label,
    x, y, angle,
    vx: 0, vy: 0,
    steerVis: 0,
    color: color || spec.colors[0],
    driver: driver || 'none',
    health: 100,
    dead: false,
    burnt: false,
    skidding: false,
    brakeLight: false,
    sirenPhase: 0,
    smokeTimer: 0,
    parkedSpot: null,
    missionTag: null,
    despawnTimer: 0,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function carForwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/**
 * Drive one step. control: {throttle -1..1, steer -1..1, handbrake}.
 * Returns {crashed, impact} for sound/sparks. Static collisions push the car
 * out at three sample circles (nose, middle, tail).
 */
export function driveCar(car, control, dt, city) {
  const spec = CAR_MODELS[car.model];
  if (car.dead) {
    car.vx *= Math.max(0, 1 - 4 * dt);
    car.vy *= Math.max(0, 1 - 4 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return { crashed: false, impact: 0 };
  }
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  let vf = car.vx * fx + car.vy * fy;
  let vr = car.vx * rx + car.vy * ry;

  const onRoad = city.isOnRoad(car.x, car.y);
  const onSand = car.y > SAND_TOP && car.y < WATER_TOP;
  const accelScale = onRoad ? 1 : onSand ? 0.55 : 0.72;
  const maxSpeed = spec.maxSpeed * (onRoad ? 1 : onSand ? 0.5 : 0.68);

  if (control.throttle > 0) {
    vf += spec.accel * control.throttle * accelScale * dt;
    if (vf > maxSpeed) vf = Math.max(maxSpeed, vf - spec.accel * dt);
  } else if (control.throttle < 0) {
    if (vf > 8) vf -= spec.accel * 1.9 * dt;
    else vf = Math.max(-spec.reverse, vf + spec.accel * 0.7 * control.throttle * dt);
  } else {
    vf -= vf * 0.55 * dt;
  }
  if (control.handbrake) vf -= vf * 2.4 * dt;

  const steerAuthority = Math.min(1, Math.abs(vf) / 80) * (vf < 0 ? -1 : 1);
  const turnRate = spec.turn * (1 - Math.min(0.45, Math.abs(vf) / 900));
  car.angle += control.steer * turnRate * steerAuthority * dt;
  car.steerVis += ((control.steer * 0.5) - car.steerVis) * Math.min(1, dt * 10);
  car.brakeLight = control.throttle < 0 && vf > 8;

  const grip = control.handbrake ? 2.4 : spec.grip;
  vr *= Math.max(0, 1 - grip * dt);
  car.skidding = Math.abs(vr) > 55 && Math.abs(vf) > 120;

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  const nrx = -nfy;
  const nry = nfx;
  car.vx = nfx * vf + nrx * vr;
  car.vy = nfy * vf + nry * vr;

  const prevX = car.x;
  const prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Three sample circles keep the body out of walls and trees.
  let crashed = false;
  let impact = 0;
  const half = spec.w / 2 - 6;
  const radius = spec.h / 2 + 1;
  for (const along of [half, 0, -half]) {
    const px = car.x + nfx * along;
    const py = car.y + nfy * along;
    const fixed = city.collideCircle(px, py, radius);
    if (fixed.hit) {
      const dx = fixed.x - px;
      const dy = fixed.y - py;
      car.x += dx;
      car.y += dy;
      const push = Math.hypot(dx, dy);
      if (push > 0.5) {
        const nx = dx / push;
        const ny = dy / push;
        const into = car.vx * nx + car.vy * ny;
        if (into < 0) {
          impact = Math.max(impact, -into);
          car.vx -= nx * into * 1.25;
          car.vy -= ny * into * 1.25;
          crashed = true;
        }
      }
    }
  }
  void prevX;
  void prevY;
  return { crashed, impact };
}

/** Damage a car; returns true when it just died (explosion time). */
export function damageCar(car, amount) {
  if (car.dead) return false;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    return true;
  }
  return false;
}
