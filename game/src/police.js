// The wanted system and the Solmar PD. Stars rise when crimes are seen,
// police cars chase and ram, cops on foot run the player down and bust them,
// and breaking line of sight lets the heat cool off star by star.

import { WANTED_CFG } from './config.js';
import { carForwardSpeed, carSpeed, createCar, driveCar } from './vehicles.js';
import { pick } from './random.js';

const COP_SKINS = ['#e8b98f', '#c98a5e', '#8a5a38'];

export function createPolice(city, rng) {
  const state = {
    stars: 0,
    evadeTimer: 0,
    bustProgress: 0,
    seen: false,
    foot: [],
    spawnCooldown: 0,
  };

  function toast(g, text, color) {
    g.toasts.push({ text, color: color || '#f2c14e', life: 2.6, max: 2.6 });
  }

  function addHeat(g, amount, reason) {
    if (state.stars >= WANTED_CFG.maxStars) return;
    const before = state.stars;
    state.stars = Math.min(WANTED_CFG.maxStars, state.stars + amount);
    state.evadeTimer = 0;
    if (state.stars > before) {
      g.audio.wantedUp();
      toast(g, reason || 'Wanted level up!', '#ff8a5a');
    }
  }

  function setStars(g, n) {
    const before = state.stars;
    state.stars = Math.max(0, Math.min(WANTED_CFG.maxStars, n));
    state.evadeTimer = 0;
    if (state.stars > before) {
      g.audio.wantedUp();
      toast(g, 'The police are onto you!', '#ff8a5a');
    }
  }

  function clearWanted(g) {
    if (state.stars === 0) return;
    state.stars = 0;
    state.evadeTimer = 0;
    state.bustProgress = 0;
    toast(g, 'You lost the cops.', '#8fd08a');
  }

  function spawnPointNear(g) {
    // A road point in a ring around the player: close enough to join fast,
    // far enough to arrive from off-screen.
    for (let tries = 0; tries < 30; tries += 1) {
      const a = rng() * Math.PI * 2;
      const d = 720 + rng() * 320;
      const x = g.player.x + Math.cos(a) * d;
      const y = g.player.y + Math.sin(a) * d;
      const road = city.nearestRoadPoint(x, y);
      if (!road) continue;
      const dd = Math.hypot(road.x - g.player.x, road.y - g.player.y);
      if (dd > 620 && dd < 1150) return road;
    }
    return null;
  }

  function spawnCar(g) {
    const at = spawnPointNear(g);
    if (!at) return null;
    const car = createCar('police', at.x, at.y, Math.atan2(g.player.y - at.y, g.player.x - at.x), '#22242c', 'police');
    car.sirenPhase = rng() * 2;
    g.cars.push(car);
    return car;
  }

  function policeCars(g) {
    return g.cars.filter((c) => c.driver === 'police' && !c.dead);
  }

  function probeBlocked(g, car, angle, dist) {
    const px = car.x + Math.cos(angle) * dist;
    const py = car.y + Math.sin(angle) * dist;
    return city.collideCircle(px, py, 14).hit;
  }

  function updateCarChase(car, dt, g) {
    const player = g.player;
    const targetX = player.x + (player.vx || 0) * 0.35;
    const targetY = player.y + (player.vy || 0) * 0.35;
    const distToPlayer = Math.hypot(targetX - car.x, targetY - car.y);
    // On foot, cops pull up short of the player and get out — they do not
    // run the player down at full speed.
    const standoff = player.onFoot ? 62 : 0;
    const aimX = standoff && distToPlayer > 1 ? targetX - ((targetX - car.x) / distToPlayer) * standoff : targetX;
    const aimY = standoff && distToPlayer > 1 ? targetY - ((targetY - car.y) / distToPlayer) * standoff : targetY;
    const want = Math.atan2(aimY - car.y, aimX - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    let steer = Math.max(-1, Math.min(1, diff * 2.4));
    // Steer around walls: probe ahead, pick the freer side.
    if (probeBlocked(g, car, car.angle, 74)) {
      const leftFree = !probeBlocked(g, car, car.angle - 0.7, 80);
      const rightFree = !probeBlocked(g, car, car.angle + 0.7, 80);
      if (leftFree && !rightFree) steer = -1;
      else if (rightFree && !leftFree) steer = 1;
      else if (leftFree && rightFree) steer = diff > 0 ? 1 : -1;
      else steer = 1;
    }
    const dist = Math.hypot(aimX - car.x, aimY - car.y);
    const speed = carForwardSpeed(car);
    let throttle = 1;
    if (player.onFoot && distToPlayer < 170) throttle = speed > 60 ? -1 : 0.15;
    if (!player.onFoot && dist < 46) throttle = 1; // ram
    const result = driveCar(car, { throttle, steer, handbrake: false }, dt, city);
    if (result.crashed && result.impact > 120) {
      g.effects.sparks(car.x, car.y, 5);
      if (Math.hypot(car.x - player.x, car.y - player.y) < 500) g.audio.crash(result.impact / 500);
    }
    // A cop gets out when the player is on foot and the car is close + slow.
    if (player.onFoot && dist < 105 && Math.abs(speed) < 70 && state.foot.length < 3 && Math.random() < dt * 1.4) {
      exitCop(g, car);
    }
  }

  function exitCop(g, car) {
    const side = Math.random() < 0.5 ? 1 : -1;
    const x = car.x + Math.cos(car.angle + side * Math.PI / 2) * 20;
    const y = car.y + Math.sin(car.angle + side * Math.PI / 2) * 20;
    const cop = {
      x, y,
      angle: Math.atan2(g.player.y - y, g.player.x - x),
      jacket: '#2b3a5a', pants: '#22242c', skin: pick(rng, COP_SKINS), hair: '#1c1c20',
      cap: '#1e2a44', phase: Math.random() * 6.28, moving: true,
      health: 50, maxHealth: 50, alive: true, down: false, downTimer: 0,
      aim: null, armed: false, showHealth: false, radius: 13,
      isCop: true, vx: 0, vy: 0,
    };
    state.foot.push(cop);
    car.driver = 'none';
    car.parkedSpot = null;
  }

  function updateFootCop(cop, dt, g) {
    if (!cop.alive) {
      cop.downTimer -= dt;
      return;
    }
    const player = g.player;
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (dist > 620) {
      cop.alive = false;
      cop.gone = true;
      return;
    }
    const want = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = want;
    cop.moving = true;
    const speed = 238;
    const nx = cop.x + Math.cos(want) * speed * dt;
    const ny = cop.y + Math.sin(want) * speed * dt;
    const fixed = city.collideCircle(nx, ny, 12);
    cop.x = fixed.x;
    cop.y = fixed.y;
    if (dist < 30 && player.onFoot) {
      state.bustProgress += dt;
      cop.moving = false;
    }
  }

  function anyCopSees(g) {
    const player = g.player;
    for (const car of policeCars(g)) {
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < WANTED_CFG.sightRange && !city.segmentBlocked(car.x, car.y, player.x, player.y)) return true;
    }
    for (const cop of state.foot) {
      if (!cop.alive) continue;
      const d = Math.hypot(cop.x - player.x, cop.y - player.y);
      if (d < WANTED_CFG.sightRange * 0.8 && !city.segmentBlocked(cop.x, cop.y, player.x, player.y)) return true;
    }
    return false;
  }

  function update(dt, g) {
    state.spawnCooldown = Math.max(0, state.spawnCooldown - dt);
    // Keep the chase staffed.
    const wanted = state.stars === 0 ? 0 : Math.min(5, state.stars + 1);
    const cars = policeCars(g);
    if (cars.length < wanted && state.spawnCooldown <= 0) {
      if (spawnCar(g)) state.spawnCooldown = 1.6;
    }
    // Unwanted cars cruise off and despawn far away.
    for (const car of [...g.cars]) {
      if (car.driver !== 'police' || car.dead) continue;
      if (state.stars === 0) {
        const d = Math.hypot(car.x - g.player.x, car.y - g.player.y);
        if (d > 900) {
          g.cars.splice(g.cars.indexOf(car), 1);
          continue;
        }
        // Drive away down the road.
        const away = Math.atan2(car.y - g.player.y, car.x - g.player.x);
        let diff = away - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        driveCar(car, { throttle: 0.7, steer: Math.max(-1, Math.min(1, diff * 2)), handbrake: false }, dt, city);
      } else {
        updateCarChase(car, dt, g);
      }
    }
    for (const cop of state.foot) updateFootCop(cop, dt, g);
    for (let i = state.foot.length - 1; i >= 0; i -= 1) {
      const cop = state.foot[i];
      if ((cop.gone) || (!cop.alive && cop.downTimer <= 0)) state.foot.splice(i, 1);
    }

    // Bust: cornered on foot, or boxed in while stopped in a car.
    const player = g.player;
    let busting = false;
    if (state.stars > 0 && player.onFoot) {
      busting = state.foot.some((c) => c.alive && Math.hypot(c.x - player.x, c.y - player.y) < 30);
    } else if (state.stars > 0 && !player.onFoot && carSpeed(player.car) < 25) {
      busting = policeCars(g).some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 125);
    }
    if (busting) {
      state.bustProgress += dt * (player.onFoot ? 0.6 : 1);
      const limit = player.onFoot ? WANTED_CFG.bustTouchTime : WANTED_CFG.bustCarTime;
      if (state.bustProgress >= limit) {
        state.bustProgress = 0;
        if (g.onBusted) g.onBusted();
      }
    } else {
      state.bustProgress = Math.max(0, state.bustProgress - dt * 1.4);
    }

    // Evade: unseen for long enough and a star drops off.
    if (state.stars > 0) {
      state.seen = anyCopSees(g);
      if (!state.seen) {
        state.evadeTimer += dt;
        const need = WANTED_CFG.evadeBase + state.stars * WANTED_CFG.evadePerStar;
        if (state.evadeTimer >= need) {
          state.evadeTimer = 0;
          state.stars -= 1;
          if (state.stars === 0) {
            toast(g, 'You lost the cops.', '#8fd08a');
            for (const cop of state.foot) {
              cop.alive = false;
              cop.gone = true;
            }
          } else {
            toast(g, 'The heat is cooling off…', '#f2c14e');
          }
        }
      } else {
        state.evadeTimer = 0;
      }
    }
  }

  return {
    state,
    addHeat,
    setStars,
    clearWanted,
    update,
    policeCars,
    get stars() {
      return state.stars;
    },
    get evading() {
      return state.stars > 0 && !state.seen;
    },
    get bustProgress() {
      return state.bustProgress;
    },
  };
}
