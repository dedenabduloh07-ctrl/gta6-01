// The orchestrator: one fixed step advances the player, every car, the
// pedestrians, the police, the enemies, the bullets and the mission, then
// resolves the collisions between them and the crimes the player commits.

import { PLAYER_CFG, WANTED_CFG, WORLD_H, WORLD_W, districtAt } from './config.js';
import { generateCity } from './city.js';
import { createRandom, pick } from './random.js';
import { createEffects } from './effects.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions, currentMission, failMission, missionMarker, missionObjective, onMissionPickup, startMission, updateMissions } from './missions.js';
import { createPlayer, damagePlayer, playerPunch, updatePlayerOnFoot } from './player.js';
import { CAR_MODELS, carSpeed, damageCar, driveCar } from './vehicles.js';
import { WEAPONS, fireBullet, updateBullets } from './weapons.js';
import { damageEnemy, updateEnemies } from './enemies.js';
import { ACT_ENTER_CAR, ACT_HORN, ACT_MELEE, ACT_WEAPON_1, ACT_WEAPON_2 } from './input.js';

export function createGame(seed, saveData, audio) {
  const rng = createRandom(seed);
  const city = generateCity(seed);
  const effects = createEffects();
  const garage = city.locationById('garage');
  const startX = saveData && saveData.x ? saveData.x : garage.x;
  const startY = saveData && saveData.y ? saveData.y : garage.y + 130;
  const player = createPlayer(startX, startY);
  if (saveData) {
    player.money = saveData.money;
    player.health = saveData.health;
    player.weapon = saveData.weapon;
    player.rifleOwned = saveData.rifleOwned;
  }
  const g = {
    seed,
    rng,
    city,
    effects,
    audio,
    time: 0,
    player,
    cars: [],
    enemies: [],
    bullets: [],
    pickups: [],
    passenger: null,
    toasts: [],
    prompt: null,
    district: districtAt(startX, startY),
    districtTimer: 0,
    camera: { x: startX, y: startY, zoom: 1 },
    markers: [],
    saveData,
    stats: saveData.stats,
    missions: createMissions(saveData),
    pendingOverlay: null,
    onSave: null,
    enterCooldown: 0,
    lastShotHeat: -10,
    healthSpawns: [],
  };
  g.police = createPolice(city, rng);
  g.pedestrians = createPedestrians(city, rng);
  g.peds = g.pedestrians.peds;
  g.policeFoot = g.police.state.foot;
  g.traffic = createTraffic(city, rng);

  g.onBusted = () => {
    g.pendingOverlay = { type: 'busted' };
  };

  g.traffic.init(g.cars, player.x, player.y);
  g.pedestrians.init();

  // Cash stashes (unfound ones) + health spawns.
  for (const stash of city.stashes) {
    if (saveData.stashes.includes(stash.id)) {
      stash.found = true;
      continue;
    }
    g.pickups.push({ kind: 'stash', x: stash.x, y: stash.y, value: 100, stashId: stash.id, missionTag: null });
  }
  for (const locId of ['diner', 'hospital']) {
    const loc = city.locationById(locId);
    const pk = { kind: 'health', x: loc.x + 50, y: loc.y + 20, value: 40, missionTag: null, respawn: 0, home: { x: loc.x + 50, y: loc.y + 20 } };
    g.pickups.push(pk);
  }
  return g;
}

function toast(g, text, color) {
  g.toasts.push({ text, color: color || '#f2c14e', life: 2.6, max: 2.6 });
}

function witnessedByCop(g, radius) {
  return g.cars.some((c) => c.driver === 'police' && !c.dead && Math.hypot(c.x - g.player.x, c.y - g.player.y) < radius);
}

function witnessed(g) {
  if (g.police.stars > 0) return true;
  if (witnessedByCop(g, 600)) return true;
  return g.peds.some((p) => !p.down && Math.hypot(p.x - g.player.x, p.y - g.player.y) < 260);
}

function nearestCar(g, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of g.cars) {
    if (car.dead || car.burnt) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(g, car) {
  const player = g.player;
  if (car.driver === 'police') return false;
  if (car.driver === 'traffic') {
    // Carjack: the driver bails out and runs.
    const driver = {
      x: car.x + 18, y: car.y + 12, angle: 0, moving: true, phase: Math.random() * 6,
      jacket: '#5a5f66', pants: '#2e3a4a', skin: '#e8b98f', hair: '#3a2a1c',
      cap: null, down: false, alive: true, aim: null, armed: false, radius: 13,
      state: 'flee', fleeTimer: 4, threatX: player.x, threatY: player.y,
      bx: 0, by: 0, edge: 0, t: 0, speed: 60, downTimer: 0,
    };
    g.peds.push(driver);
    g.stats.carsStolen += 1;
    if (witnessed(g)) g.police.addHeat(g, 1, 'Car stolen!');
    else toast(g, 'Nice and quiet…', '#8fd08a');
  } else if (car.driver === 'none' && car.model === 'police') {
    g.stats.carsStolen += 1;
    g.police.addHeat(g, 2, 'You stole a police car!');
  } else if (car.parkedSpot) {
    car.parkedSpot.taken = false;
    car.parkedSpot = null;
    g.stats.carsStolen += 1;
    if (witnessedByCop(g, 420)) g.police.addHeat(g, 1, 'Car stolen!');
  }
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  g.enterCooldown = 0.4;
  g.audio.click();
  return true;
}

function exitCar(g) {
  const player = g.player;
  const car = player.car;
  if (!car) return;
  car.driver = 'none';
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = car.x + side * 26;
  player.y = car.y + sideY * 26;
  const fixed = g.city.collideCircle(player.x, player.y, PLAYER_CFG.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.vx = 0;
  player.vy = 0;
  player.car = null;
  player.onFoot = true;
  g.enterCooldown = 0.4;
}

function explodeCar(g, car) {
  if (car.exploded) return;
  car.exploded = true;
  car.burnt = true;
  car.despawnTimer = 30;
  g.effects.explosion(car.x, car.y);
  g.audio.explosion();
  g.pedestrians.alert(car.x, car.y, 520);
  const wasPlayerCar = car === g.player.car;
  if (wasPlayerCar) {
    const player = g.player;
    player.car = null;
    player.onFoot = true;
    player.x = car.x + 30;
    player.y = car.y;
    damagePlayer(player, 25, g);
  }
  for (const other of g.cars) {
    if (other === car || other.dead) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 120 && damageCar(other, 55)) explodeCar(g, other);
  }
  const hurt = (person, amount) => {
    const d = Math.hypot(person.x - car.x, person.y - car.y);
    if (d > 120) return;
    if (person === g.player) damagePlayer(person, amount, g);
    else if (person.isEnemy) damageEnemy(person, amount, g);
    else if (person.isCop) {
      person.health -= amount;
      if (person.health <= 0) {
        person.alive = false;
        person.down = true;
        person.downTimer = 8;
      }
    } else g.pedestrians.knockDown(person, car.x, car.y);
  };
  hurt(g.player, 40);
  for (const e of g.enemies) hurt(e, 45);
  for (const c of g.policeFoot) hurt(c, 45);
  for (const p of g.peds) hurt(p, 0);
  if (car.model === 'police') g.police.addHeat(g, 1, 'Police car destroyed!');
  if (car.missionTag === 'veloce') {
    // The repo job fails when its prize burns; missions update catches it.
  }
}

function handleCarCollisions(g, dt) {
  const cars = g.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > 52 || Math.abs(dy) > 52) continue;
      const d = Math.hypot(dx, dy);
      const min = 42;
      if (d >= min || d < 0.01) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const rel = rvx * nx + rvy * ny;
      if (rel < 0) {
        const impact = -rel;
        const ma = CAR_MODELS[a.model].mass;
        const mb = CAR_MODELS[b.model].mass;
        const impulse = (impact * 1.4) / (ma + mb);
        a.vx -= nx * impulse * mb * 0.9;
        a.vy -= ny * impulse * mb * 0.9;
        b.vx += nx * impulse * ma * 0.9;
        b.vy += ny * impulse * ma * 0.9;
        if (impact > 70) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          g.effects.sparks(mx, my, 6);
          if (Math.hypot(mx - g.player.x, my - g.player.y) < 520) g.audio.crash(impact / 420);
          const dmg = impact * 0.09;
          if (damageCar(a, dmg)) explodeCar(g, a);
          if (damageCar(b, dmg)) explodeCar(g, b);
          const playerInvolved = a.driver === 'player' || b.driver === 'player';
          const policeInvolved = a.driver === 'police' || b.driver === 'police';
          if (playerInvolved && policeInvolved && impact > 120) g.police.addHeat(g, 1, 'You rammed a cop!');
          else if (playerInvolved && impact > 190 && witnessedByCop(g, 450)) g.police.addHeat(g, 1, 'Reckless driving!');
          if (playerInvolved) g.effects.shake(Math.min(0.5, impact / 700));
        }
      }
    }
  }
  void dt;
}

function handleCarPedCollisions(g) {
  for (const car of g.cars) {
    const speed = carSpeed(car);
    if (speed < 55) continue;
    const check = (person, isPed) => {
      if (person.down || !person.alive) return;
      const dx = person.x - car.x;
      const dy = person.y - car.y;
      if (Math.abs(dx) > 34 || Math.abs(dy) > 34) return;
      const d = Math.hypot(dx, dy);
      if (d > 30) return;
      if (isPed) {
        if (g.pedestrians.knockDown(person, car.x, car.y)) {
          g.effects.hitPuff(person.x, person.y);
          g.effects.dust(person.x, person.y, 6);
          if (car.driver === 'player') {
            if (witnessed(g)) g.police.addHeat(g, 1, 'Pedestrian hit!');
            g.effects.shake(0.25);
          }
        }
      } else if (person.isEnemy) {
        if (damageEnemy(person, 65, g)) {
          g.effects.hitPuff(person.x, person.y);
        }
      } else if (person.isCop) {
        person.health -= 65;
        if (person.health <= 0) {
          person.alive = false;
          person.down = true;
          person.downTimer = 8;
        }
        if (car.driver === 'player') g.police.addHeat(g, 1, 'You ran over a cop!');
      }
    };
    for (const p of g.peds) check(p, true);
    for (const e of g.enemies) check(e, false);
    for (const c of g.policeFoot) check(c, false);
    // The player on foot vs. traffic: traffic brakes, but a speeding car hurts.
    if (g.player.onFoot && car.driver !== 'player') {
      const dx = g.player.x - car.x;
      const dy = g.player.y - car.y;
      if (Math.hypot(dx, dy) < 30 && speed > 120) {
        damagePlayer(g.player, 18, g);
        g.effects.hitPuff(g.player.x, g.player.y);
        g.effects.shake(0.3);
      }
    }
  }
}

function handlePickups(g, dt) {
  const player = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i -= 1) {
    const pk = g.pickups[i];
    const d = Math.hypot(player.x - pk.x, player.y - pk.y);
    if (d > 30) continue;
    if (pk.kind === 'stash' && !player.onFoot) continue;
    if (pk.kind === 'health' && player.health >= player.maxHealth) continue;
    g.pickups.splice(i, 1);
    if (pk.kind === 'stash') {
      player.money += pk.value;
      g.saveData.stashes.push(pk.stashId);
      g.effects.addText(pk.x, pk.y - 18, `+$${pk.value}`, '#f2c14e');
      g.audio.cash();
      toast(g, `Cash stash found! (${g.saveData.stashes.length}/12)`, '#f2c14e');
    } else if (pk.kind === 'health') {
      player.health = Math.min(player.maxHealth, player.health + pk.value);
      g.audio.health();
      toast(g, 'Health restored', '#8fd08a');
      if (pk.home) {
        pk.respawn = 25;
        g.healthSpawns.push(pk);
      }
    } else if (pk.kind === 'weapon') {
      player.rifleOwned = true;
      player.weapon = 'rifle';
      g.saveData.rifleOwned = true;
      g.audio.pickup();
      toast(g, 'Rifle acquired!', '#f2c14e');
    } else if (pk.kind === 'cashbag') {
      if (pk.missionTag) {
        onMissionPickup(g.missions, g, pk);
        g.audio.cash();
      } else {
        player.money += pk.value;
        g.effects.addText(pk.x, pk.y - 18, `+$${pk.value}`, '#f2c14e');
        g.audio.cash();
      }
    }
  }
  // Respawn collected health pickups.
  for (let i = g.healthSpawns.length - 1; i >= 0; i -= 1) {
    const pk = g.healthSpawns[i];
    if (!pk.respawn) continue;
    pk.respawn -= dt;
    if (pk.respawn <= 0) {
      pk.respawn = 0;
      g.pickups.push(pk);
      g.healthSpawns.splice(i, 1);
    }
  }
}

function handleZones(g, actions) {
  const player = g.player;
  const paint = g.city.locationById('paint');
  const safe = g.city.locationById('safehouse');
  const garage = g.city.locationById('garage');
  g.prompt = null;

  const nearV = !g.missions.active && currentMission(g.missions) && player.onFoot &&
    Math.hypot(player.x - garage.x, player.y - garage.y) < 80;
  const nearPaint = !player.onFoot && g.police.stars > 0 &&
    Math.hypot(player.x - paint.x, player.y - paint.y) < 85;
  const nearSafe = player.onFoot && Math.hypot(player.x - safe.x, player.y - safe.y) < 80;

  if (nearV) {
    g.prompt = 'E — Talk to Vince';
    if (actions & ACT_ENTER_CAR) {
      g.pendingOverlay = { type: 'missionIntro', mission: currentMission(g.missions) };
      g.audio.click();
    }
    return;
  }
  if (nearPaint) {
    if (player.money >= WANTED_CFG.paintCost) {
      g.prompt = `E — Repaint $${WANTED_CFG.paintCost} (clears wanted)`;
      if (actions & ACT_ENTER_CAR) {
        player.money -= WANTED_CFG.paintCost;
        player.car.color = pick(g.rng, CAR_MODELS[player.car.model].colors);
        g.police.clearWanted(g);
        g.effects.dust(player.car.x, player.car.y, 10);
        g.audio.cash();
      }
    } else {
      g.prompt = `Need $${WANTED_CFG.paintCost} for a repaint`;
    }
    return;
  }
  if (nearSafe) {
    g.prompt = 'E — Save game';
    if (actions & ACT_ENTER_CAR) {
      if (g.onSave) g.onSave();
      toast(g, 'Game saved', '#8fd08a');
      g.audio.pickup();
    }
    return;
  }
  if (player.onFoot) {
    const car = nearestCar(g, player.x, player.y, 58);
    if (car) {
      g.prompt = car.driver === 'traffic' ? 'E — Carjack' : 'E — Get in';
      if ((actions & ACT_ENTER_CAR) && g.enterCooldown <= 0) enterCar(g, car);
    }
  } else if (actions & ACT_ENTER_CAR && g.enterCooldown <= 0) {
    exitCar(g);
  }
}

function updateDriving(g, input, aimWorld, dt) {
  const player = g.player;
  const car = player.car;
  const move = input.moveVector();
  const control = {
    throttle: move.y !== 0 ? -move.y : 0,
    steer: move.x,
    handbrake: input.held.brake,
  };
  // W/S drive, A/D steer: moveVector y is down-positive, so invert.
  const result = driveCar(car, control, dt, g.city);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aim = car.angle;
  player.vx = car.vx;
  player.vy = car.vy;
  player.moving = false;
  const speed = carSpeed(car);
  g.stats.distanceDriven += speed * dt;
  if (result.crashed && result.impact > 90) {
    g.effects.sparks(car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, 5);
    g.audio.crash(result.impact / 420);
    g.effects.shake(Math.min(0.45, result.impact / 800));
    if (damageCar(car, result.impact * 0.07)) explodeCar(g, car);
  }
  if (car.skidding) {
    const bx = car.x - Math.cos(car.angle) * 16;
    const by = car.y - Math.sin(car.angle) * 16;
    const px = -Math.sin(car.angle) * 9;
    const py = Math.cos(car.angle) * 9;
    g.effects.addSkid(bx + px, by + py, bx + px - car.vx * dt, by + py - car.vy * dt);
    g.effects.addSkid(bx - px, by - py, bx - px - car.vx * dt, by - py - car.vy * dt);
    if (Math.random() < dt * 6) g.audio.skid();
  }
  // Smoke / fire as the car falls apart.
  if (car.health < 60 && !car.dead) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.health < 30 ? 0.05 : 0.16;
      const hx = car.x + Math.cos(car.angle) * 18;
      const hy = car.y + Math.sin(car.angle) * 18;
      if (car.health < 30) g.effects.fire(hx, hy);
      g.effects.smoke(hx, hy, car.health < 30);
    }
  }
  // Drive-by shooting.
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (input.isFiring() && player.fireCooldown <= 0) {
    const weapon = WEAPONS[player.weapon];
    const a = Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x);
    fireBullet(g.bullets, player.x + Math.cos(a) * 20, player.y + Math.sin(a) * 20, a, player.weapon, true, 0.9);
    g.effects.muzzle(player.x, player.y, a);
    g.audio.gunshot();
    g.stats.shotsFired += 1;
    player.fireCooldown = weapon.rate * 1.25;
    g.pedestrians.alert(player.x, player.y, 420);
    if (g.time - g.lastShotHeat > 6 && witnessedByCop(g, 550)) {
      g.lastShotHeat = g.time;
      g.police.addHeat(g, 1, 'Shots fired!');
    }
  }
  g.audio.update(dt, speed, true, g.police.stars > 0);
}

function updateCamera(g, dt) {
  const player = g.player;
  const lookX = player.x + (player.vx || 0) * 0.28;
  const lookY = player.y + (player.vy || 0) * 0.28;
  const k = Math.min(1, dt * 4.5);
  g.camera.x += (lookX - g.camera.x) * k;
  g.camera.y += (lookY - g.camera.y) * k;
  const speed = player.onFoot ? Math.hypot(player.vx, player.vy) : carSpeed(player.car || { vx: 0, vy: 0 });
  const targetZoom = player.onFoot ? 1 : 1 - Math.min(0.14, speed / 2600);
  g.camera.zoom += (targetZoom - g.camera.zoom) * Math.min(1, dt * 2.5);
  const halfW = 640 / g.camera.zoom;
  const halfH = 360 / g.camera.zoom;
  g.camera.x = Math.max(halfW - 80, Math.min(WORLD_W - halfW + 80, g.camera.x));
  g.camera.y = Math.max(halfH - 80, Math.min(WORLD_H - halfH + 80, g.camera.y));
}

/** One fixed step of the whole game. actions are this frame's one-shot flags. */
export function updateGame(g, dt, input, actions, aimWorld) {
  g.time += dt;
  g.stats.timePlayed += dt;
  g.enterCooldown = Math.max(0, g.enterCooldown - dt);

  if (actions & ACT_HORN && !g.player.onFoot) g.audio.horn();
  if (actions & ACT_WEAPON_1) {
    g.player.weapon = 'pistol';
    g.audio.click();
  }
  if ((actions & ACT_WEAPON_2) && g.player.rifleOwned) {
    g.player.weapon = 'rifle';
    g.audio.click();
  }
  if (actions & ACT_MELEE && g.player.onFoot && g.player.alive) {
    const people = [...g.enemies.filter((e) => e.alive), ...g.policeFoot.filter((c) => c.alive), ...g.peds.filter((p) => !p.down)];
    const victim = playerPunch(g.player, people, g);
    if (victim) {
      if (victim.isEnemy) damageEnemy(victim, PLAYER_CFG.punchDamage, g);
      else if (victim.isCop) {
        victim.health -= PLAYER_CFG.punchDamage;
        if (victim.health <= 0) {
          victim.alive = false;
          victim.down = true;
          victim.downTimer = 8;
        }
        g.police.addHeat(g, 1, 'You hit a cop!');
      } else {
        victim.state = 'flee';
        victim.fleeTimer = 4;
        victim.threatX = g.player.x;
        victim.threatY = g.player.y;
        if (witnessedByCop(g, 420)) g.police.addHeat(g, 1, 'Assault!');
      }
    }
  }

  handleZones(g, actions);

  if (g.player.alive) {
    if (g.player.onFoot) {
      const events = updatePlayerOnFoot(g.player, input, aimWorld, dt, g.city, g);
      if (events.fired && g.time - g.lastShotHeat > 6 && witnessedByCop(g, 550)) {
        g.lastShotHeat = g.time;
        g.police.addHeat(g, 1, 'Shots fired!');
      }
      g.audio.update(dt, 0, false, g.police.stars > 0);
    } else if (g.player.car && !g.player.car.dead) {
      updateDriving(g, input, aimWorld, dt);
    } else if (g.player.car && g.player.car.dead) {
      explodeCar(g, g.player.car);
    }
  }

  g.traffic.update(dt, g.time, g);
  g.pedestrians.update(dt, g);
  g.police.update(dt, g);
  updateEnemies(g.enemies, dt, g);
  handleCarCollisions(g, dt);
  handleCarPedCollisions(g);

  // Bullets vs the world.
  const people = [];
  if (g.player.alive) people.push(g.player);
  for (const e of g.enemies) if (e.alive) people.push(e);
  for (const c of g.policeFoot) if (c.alive) people.push(c);
  for (const p of g.peds) {
    if (!p.down) {
      p.alive = true;
      people.push(p);
    }
  }
  updateBullets(g.bullets, dt, {
    city: g.city,
    cars: g.cars,
    people,
    effects: g.effects,
    onCarHit(car, b) {
      if (b.fromPlayer && car === g.player.car) return false;
      if (damageCar(car, b.damage)) explodeCar(g, car);
      if (b.fromPlayer && car.driver === 'police') g.police.addHeat(g, 1, 'You shot at the police!');
      return true;
    },
    onPersonHit(person, b) {
      if (b.fromPlayer && person === g.player) return false;
      if (!b.fromPlayer && (person.isEnemy || person.isCop)) return false;
      if (person === g.player) {
        damagePlayer(person, b.damage, g);
        g.effects.shake(0.15);
      } else if (person.isEnemy) {
        damageEnemy(person, b.damage, g);
      } else if (person.isCop) {
        person.health -= b.damage;
        if (person.health <= 0) {
          person.alive = false;
          person.down = true;
          person.downTimer = 8;
        }
        if (b.fromPlayer) g.police.addHeat(g, 1, 'You shot a cop!');
      } else {
        g.pedestrians.knockDown(person, b.x, b.y);
        if (b.fromPlayer && witnessed(g)) g.police.addHeat(g, 1, 'Pedestrian shot!');
      }
      return true;
    },
  });

  // Dead enemies stay down; remove them after a while.
  for (let i = g.enemies.length - 1; i >= 0; i -= 1) {
    const e = g.enemies[i];
    if (!e.alive && !e.missionTag) g.enemies.splice(i, 1);
    else if (!e.alive && e.missionTag) {
      e.goneTimer = (e.goneTimer || 0) + dt;
      if (e.goneTimer > 14) g.enemies.splice(i, 1);
    }
  }
  // Burnt wrecks get towed eventually.
  for (let i = g.cars.length - 1; i >= 0; i -= 1) {
    const car = g.cars[i];
    if (car.dead && !car.missionTag) {
      car.despawnTimer -= dt;
      if (car.despawnTimer <= 0) {
        if (car.parkedSpot) car.parkedSpot.taken = false;
        g.cars.splice(i, 1);
      }
    }
  }

  handlePickups(g, dt);
  updateMissions(g.missions, dt, g);
  g.effects.update(dt);

  for (let i = g.toasts.length - 1; i >= 0; i -= 1) {
    g.toasts[i].life -= dt;
    if (g.toasts[i].life <= 0) g.toasts.splice(i, 1);
  }

  const district = districtAt(g.player.x, g.player.y);
  if (district !== g.district) {
    g.district = district;
    g.districtTimer = 3.2;
  }
  g.districtTimer = Math.max(0, g.districtTimer - dt);

  // Markers: the mission objective, plus the paint shop while wanted.
  g.markers = [];
  const mm = missionMarker(g.missions, g);
  if (mm) g.markers.push(mm);
  if (g.police.stars > 0) {
    const paint = g.city.locationById('paint');
    g.markers.push({ x: paint.x, y: paint.y, color: '#b46ae0', label: 'PAINT' });
  }

  updateCamera(g, dt);

  if (!g.player.alive && !g.pendingOverlay) {
    g.pendingOverlay = { type: 'wasted' };
  }
}

/** Ambient-only update for the title screen backdrop: traffic and strollers. */
export function updateAmbient(g, dt) {
  g.time += dt;
  g.traffic.update(dt, g.time, g);
  g.pedestrians.update(dt, g);
  g.effects.update(dt);
}

/** Apply the wasted penalty and respawn at the hospital. */
export function respawnAfterWasted(g) {
  const hospital = g.city.locationById('hospital');
  const player = g.player;
  if (g.missions.active) failMission(g.missions, g, 'You got wasted.');
  player.alive = true;
  player.health = player.maxHealth;
  player.money = Math.max(0, player.money - 200);
  player.onFoot = true;
  player.car = null;
  player.x = hospital.x;
  player.y = hospital.y + 120;
  player.vx = 0;
  player.vy = 0;
  g.stats.timesWasted += 1;
  g.police.clearWanted(g);
  g.camera.x = player.x;
  g.camera.y = player.y;
  g.pendingOverlay = null;
}

/** Apply the busted penalty and respawn at Police HQ. */
export function respawnAfterBusted(g) {
  const hq = g.city.locationById('police');
  const player = g.player;
  if (g.missions.active) failMission(g.missions, g, 'You got busted.');
  player.alive = true;
  player.health = player.maxHealth;
  player.money = Math.max(0, player.money - 200);
  player.onFoot = true;
  player.car = null;
  player.x = hq.x;
  player.y = hq.y + 130;
  player.vx = 0;
  player.vy = 0;
  g.stats.timesBusted += 1;
  g.police.clearWanted(g);
  for (const cop of g.policeFoot) {
    cop.alive = false;
    cop.gone = true;
  }
  g.camera.x = player.x;
  g.camera.y = player.y;
  g.pendingOverlay = null;
}

/** Snapshot the progress fields into saveData (called before writing). */
export function snapshotSave(g) {
  const s = g.saveData;
  s.money = g.player.money;
  s.health = Math.max(1, Math.round(g.player.health));
  s.x = Math.round(g.player.x);
  s.y = Math.round(g.player.y);
  s.weapon = g.player.weapon;
  s.rifleOwned = g.player.rifleOwned;
  s.missionIndex = g.missions.index;
  s.missionsDone = [...g.missions.done];
  s.stats = g.stats;
  return s;
}
