// The story: Jax Rivera owes fixer Vince Kovac $5,000, and five jobs will
// square it. Missions are step lists — go somewhere, steal a car, pick
// someone up, fight, collect, escape — with timers, spawned crews and a
// reward at the end. The runtime tracks one active mission at a time.

import { MISSION_DEBT } from './config.js';
import { createCar } from './vehicles.js';
import { spawnEnemy } from './enemies.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Back Behind the Wheel',
    giver: 'Vince',
    brief: [
      'Jax. You owe me five grand, and your legs still work.',
      'Steal a car — any car — and bring it to the chop shop in the Port.',
      "Don't get fancy. Don't get caught.",
    ],
    reward: 300,
    steps: [
      { type: 'enterCar', text: 'Steal a car (E next to one)' },
      { type: 'gotoCar', loc: 'chop', radius: 70, text: 'Deliver the car to the Chop Shop' },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Vince',
    brief: [
      "Lena's waiting at the Sunset Diner and the cops are already sniffing around.",
      'Pick her up, lose the heat, and bring her to the safehouse.',
      'Drive like your rent depends on it. It does.',
    ],
    reward: 600,
    steps: [
      { type: 'goto', loc: 'diner', radius: 60, text: 'Go to the Sunset Diner', spawnPassenger: { loc: 'diner', dx: 40, dy: 30, name: 'Lena' } },
      { type: 'pickup', text: 'Pick up Lena (pull up beside her)', setStarsOnBoard: 2 },
      { type: 'deliver', loc: 'safehouse', radius: 80, text: 'Get Lena to the Safehouse', needsPassenger: true },
    ],
  },
  {
    id: 'delivery',
    title: 'Hot Delivery',
    giver: 'Vince',
    brief: [
      'Three drops, one afternoon, no questions.',
      "The Gulls have been watching the port drop. Expect company.",
      'The package goes to the diner, the docks and the Palm Hotel.',
    ],
    reward: 900,
    steps: [
      { type: 'goto', loc: 'garage', radius: 60, text: 'Collect the package at the garage', timeLimit: 150, spawnPickup: { kind: 'cashbag', loc: 'garage', dx: -40, dy: 20, tag: 'parcel', value: 0 } },
      { type: 'goto', loc: 'diner', radius: 55, text: 'Drop 1 of 3: Sunset Diner', timeLimit: 150 },
      { type: 'goto', loc: 'chop', radius: 55, text: 'Drop 2 of 3: the Port', timeLimit: 150, spawnEnemies: [{ loc: 'chop', dx: -60, dy: -40 }, { loc: 'chop', dx: 60, dy: -30 }, { loc: 'chop', dx: 0, dy: 60 }], alertOnSpawn: true },
      { type: 'eliminate', tag: 'm2', text: 'The Gulls found you — deal with them', timeLimit: 150 },
      { type: 'goto', loc: 'hotel', radius: 55, text: 'Drop 3 of 3: Palm Hotel', timeLimit: 150 },
    ],
  },
  {
    id: 'repo',
    title: 'Repo Man',
    giver: 'Vince',
    brief: [
      'A Veloce GT is sitting at the marina, and its owner stopped paying his dues.',
      'Take it. The Gulls guard it, and the owner calls the cops the second it moves.',
      'Bring it to my garage in one piece.',
    ],
    reward: 1200,
    steps: [
      { type: 'goto', loc: 'marina', radius: 90, text: 'Go to Marina Bay', spawnCar: { model: 'veloce', loc: 'marina', dx: -30, dy: 60, tag: 'veloce' }, spawnEnemies: [{ loc: 'marina', dx: -70, dy: 20 }, { loc: 'marina', dx: 30, dy: 90 }] },
      { type: 'stealTarget', tag: 'veloce', text: 'Steal the Veloce GT', setStarsOnSteal: 2 },
      { type: 'deliverCar', tag: 'veloce', loc: 'garage', radius: 80, text: 'Deliver the Veloce to the garage' },
    ],
  },
  {
    id: 'score',
    title: 'The Big Score',
    giver: 'Vince',
    brief: [
      'The Solmar National Bank keeps its Friday cash in the back vault.',
      'Hit it, grab the bags, and get clear.',
      'This is the one that squares us, Jax. Five grand, one job, no more debt.',
    ],
    reward: 2500,
    steps: [
      { type: 'goto', loc: 'bank', radius: 90, text: 'Get to the bank', spawnEnemies: [{ loc: 'bank', dx: -80, dy: -60 }, { loc: 'bank', dx: 80, dy: -60 }, { loc: 'bank', dx: -80, dy: 60 }, { loc: 'bank', dx: 80, dy: 60 }], alertOnSpawn: true },
      { type: 'eliminate', tag: 'm4', text: 'Take out the bank guards' },
      { type: 'collect', kind: 'cashbag', tag: 'vault', count: 3, text: 'Grab the cash bags (3)', spawnPickups: [{ kind: 'cashbag', loc: 'bank', dx: -30, dy: -120, tag: 'vault', value: 0 }, { kind: 'cashbag', loc: 'bank', dx: 30, dy: -120, tag: 'vault', value: 0 }, { kind: 'cashbag', loc: 'bank', dx: 0, dy: -150, tag: 'vault', value: 0 }], setStarsOnFirst: 4 },
      { type: 'goto', loc: 'safehouse', radius: 90, text: 'Escape to the Safehouse' },
    ],
  },
];

export function createMissions(save) {
  return {
    index: save ? save.missionIndex : 0,
    done: save ? [...save.missionsDone] : [],
    active: null,
  };
}

function stepPos(step, city) {
  if (step.pos) return step.pos;
  const loc = city.locationById(step.loc);
  return { x: loc.x, y: loc.y };
}

export function currentMission(rt) {
  if (rt.index >= MISSIONS.length) return null;
  return MISSIONS[rt.index];
}

export function missionMarker(rt, g) {
  if (!rt.active) {
    const next = currentMission(rt);
    if (!next) return null;
    const garage = g.city.locationById('garage');
    return { x: garage.x, y: garage.y, color: '#b46ae0', label: 'V' };
  }
  const step = rt.active.mission.steps[rt.active.stepIndex];
  if (!step) return null;
  if (step.type === 'enterCar' || step.type === 'stealTarget' || step.type === 'pickup' || step.type === 'eliminate') {
    if (step.type === 'pickup' && rt.active.passenger && rt.active.passenger.state !== 'inCar') {
      return { x: rt.active.passenger.x, y: rt.active.passenger.y, color: '#f2c14e', label: 'Lena' };
    }
    if (step.type === 'stealTarget' && rt.active.targetCar) {
      return { x: rt.active.targetCar.x, y: rt.active.targetCar.y, color: '#f2c14e', label: 'Veloce' };
    }
    if (step.type === 'eliminate') {
      const alive = g.enemies.find((e) => e.alive && e.missionTag === rt.active.tag);
      if (alive) return { x: alive.x, y: alive.y, color: '#e0483e', label: '!' };
      return null;
    }
    return null;
  }
  const pos = stepPos(step, g.city);
  return { x: pos.x, y: pos.y, color: '#f2c14e', label: '' };
}

export function missionObjective(rt) {
  if (!rt.active) {
    const next = currentMission(rt);
    if (!next) return { text: 'Solmar is yours. Free roam — find the 12 cash stashes.', timer: 0 };
    return { text: `Go to Vince's Garage (V) for: ${next.title}`, timer: 0 };
  }
  const step = rt.active.mission.steps[rt.active.stepIndex];
  return { text: step.text, timer: rt.active.timer };
}

function spawnStepEntities(rt, g, step) {
  const city = g.city;
  if (step.spawnEnemies) {
    for (const s of step.spawnEnemies) {
      const loc = city.locationById(s.loc);
      const e = spawnEnemy(loc.x + (s.dx || 0), loc.y + (s.dy || 0), { missionTag: rt.active.tag, alerted: !!step.alertOnSpawn });
      g.enemies.push(e);
      rt.active.spawned.enemies.push(e);
    }
  }
  if (step.spawnCar) {
    const loc = city.locationById(step.spawnCar.loc);
    const car = createCar(step.spawnCar.model, loc.x + (step.spawnCar.dx || 0), loc.y + (step.spawnCar.dy || 0), 0, '#c22e3e', 'none');
    car.missionTag = step.spawnCar.tag;
    g.cars.push(car);
    rt.active.targetCar = car;
    rt.active.spawned.cars.push(car);
  }
  if (step.spawnPickup) {
    const loc = city.locationById(step.spawnPickup.loc);
    const pk = { kind: step.spawnPickup.kind, x: loc.x + (step.spawnPickup.dx || 0), y: loc.y + (step.spawnPickup.dy || 0), value: step.spawnPickup.value || 0, missionTag: step.spawnPickup.tag };
    g.pickups.push(pk);
    rt.active.spawned.pickups.push(pk);
  }
  if (step.spawnPickups) {
    for (const s of step.spawnPickups) {
      const loc = city.locationById(s.loc);
      const pk = { kind: s.kind, x: loc.x + (s.dx || 0), y: loc.y + (s.dy || 0), value: s.value || 0, missionTag: s.tag };
      g.pickups.push(pk);
      rt.active.spawned.pickups.push(pk);
    }
  }
  if (step.spawnPassenger) {
    const loc = city.locationById(step.spawnPassenger.loc);
    rt.active.passenger = {
      x: loc.x + (step.spawnPassenger.dx || 0),
      y: loc.y + (step.spawnPassenger.dy || 0),
      angle: 0, moving: false, phase: 1,
      jacket: '#3a6fd8', pants: '#e8e4d6', skin: '#f0d0a8', hair: '#8a3a2a',
      cap: null, down: false, aim: null, armed: false, radius: 13,
      state: 'wait', name: step.spawnPassenger.name, alive: true,
    };
    g.passenger = rt.active.passenger;
  }
}

function enterStep(rt, g) {
  const step = rt.active.mission.steps[rt.active.stepIndex];
  if (!step) return;
  rt.active.timer = step.timeLimit || 0;
  rt.active.collected = 0;
  spawnStepEntities(rt, g, step);
  g.toasts.push({ text: step.text, color: '#f5f1e6', life: 3.2, max: 3.2 });
}

export function startMission(rt, g) {
  const mission = currentMission(rt);
  if (!mission || rt.active) return false;
  rt.active = {
    mission,
    stepIndex: 0,
    timer: 0,
    tag: mission.id === 'delivery' ? 'm2' : mission.id === 'score' ? 'm4' : mission.id,
    collected: 0,
    spawned: { enemies: [], cars: [], pickups: [] },
    passenger: null,
    targetCar: null,
    hadWanted: false,
  };
  g.toasts.push({ text: mission.title, color: '#f2c14e', life: 3.2, max: 3.2 });
  enterStep(rt, g);
  return true;
}

function cleanupMission(rt, g) {
  for (const e of rt.active.spawned.enemies) {
    const i = g.enemies.indexOf(e);
    if (i !== -1) g.enemies.splice(i, 1);
  }
  for (const pk of rt.active.spawned.pickups) {
    const i = g.pickups.indexOf(pk);
    if (i !== -1) g.pickups.splice(i, 1);
  }
  if (rt.active.passenger) {
    g.passenger = null;
  }
  // Mission cars stay in the world (a stolen Veloce is still a car).
  rt.active = null;
}

export function failMission(rt, g, reason) {
  if (!rt.active) return;
  const title = rt.active.mission.title;
  cleanupMission(rt, g);
  g.audio.missionFail();
  g.pendingOverlay = { type: 'missionFail', title, reason };
}

export function completeMission(rt, g) {
  const mission = rt.active.mission;
  cleanupMission(rt, g);
  rt.done.push(mission.id);
  rt.index += 1;
  g.player.money += mission.reward;
  g.saveData.debtPaid += mission.reward;
  g.saveData.missionsDone = [...rt.done];
  g.saveData.missionIndex = rt.index;
  g.stats.missionsDone += 1;
  g.audio.missionDone();
  if (mission.id === 'delivery') {
    g.player.rifleOwned = true;
    g.player.weapon = 'rifle';
    g.saveData.rifleOwned = true;
  }
  const debtLeft = Math.max(0, MISSION_DEBT - g.saveData.debtPaid);
  g.pendingOverlay = {
    type: rt.index >= MISSIONS.length ? 'ending' : 'missionDone',
    title: mission.title,
    reward: mission.reward,
    debtLeft,
  };
  if (g.onSave) g.onSave();
}

function advanceStep(rt, g) {
  rt.active.stepIndex += 1;
  if (rt.active.stepIndex >= rt.active.mission.steps.length) {
    completeMission(rt, g);
    return;
  }
  enterStep(rt, g);
}

function updatePassenger(rt, dt, g) {
  const p = rt.active.passenger;
  if (!p) return;
  const player = g.player;
  if (p.state === 'wait') {
    if (!player.onFoot && Math.hypot(player.x - p.x, player.y - p.y) < 70) {
      p.state = 'toCar';
    }
  } else if (p.state === 'toCar') {
    if (player.onFoot) {
      p.state = 'wait';
      return;
    }
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 26) {
      p.state = 'inCar';
      const step = rt.active.mission.steps[rt.active.stepIndex];
      if (step.type === 'pickup') {
        if (step.setStarsOnBoard) g.police.setStars(g, step.setStarsOnBoard);
        g.toasts.push({ text: 'Lena: "Drive! They saw us!"', color: '#8fc3f0', life: 3, max: 3 });
        advanceStep(rt, g);
      }
      return;
    }
    p.moving = true;
    p.angle = Math.atan2(dy, dx);
    const fixed = g.city.collideCircle(p.x + (dx / d) * 200 * dt, p.y + (dy / d) * 200 * dt, 12);
    p.x = fixed.x;
    p.y = fixed.y;
  } else if (p.state === 'inCar') {
    p.x = player.x;
    p.y = player.y;
    if (player.onFoot) {
      // She gets out and waits by the car.
      p.state = 'wait';
      p.x = player.x + 24;
      p.y = player.y + 10;
    }
  }
}

export function updateMissions(rt, dt, g) {
  if (!rt.active) return;
  const step = rt.active.mission.steps[rt.active.stepIndex];
  if (!step) return;
  if (rt.active.timer > 0) {
    rt.active.timer -= dt;
    if (rt.active.timer <= 0) {
      failMission(rt, g, 'Out of time.');
      return;
    }
  }
  if (rt.active.passenger) updatePassenger(rt, dt, g);
  const player = g.player;

  // Mission target car destroyed?
  if (rt.active.targetCar && rt.active.targetCar.dead) {
    failMission(rt, g, 'The target car was wrecked.');
    return;
  }

  switch (step.type) {
    case 'goto': {
      const pos = stepPos(step, g.city);
      if (Math.hypot(player.x - pos.x, player.y - pos.y) < step.radius) advanceStep(rt, g);
      break;
    }
    case 'gotoCar': {
      const pos = stepPos(step, g.city);
      if (!player.onFoot && Math.hypot(player.x - pos.x, player.y - pos.y) < step.radius) advanceStep(rt, g);
      break;
    }
    case 'enterCar': {
      if (!player.onFoot) advanceStep(rt, g);
      break;
    }
    case 'stealTarget': {
      if (!player.onFoot && player.car && player.car.missionTag === step.tag) {
        if (step.setStarsOnSteal) g.police.setStars(g, step.setStarsOnSteal);
        for (const e of g.enemies) {
          if (e.missionTag === rt.active.tag) e.alerted = true;
        }
        g.toasts.push({ text: 'The owner called the cops!', color: '#ff8a5a', life: 3, max: 3 });
        advanceStep(rt, g);
      }
      break;
    }
    case 'pickup': {
      // Resolved by updatePassenger when Lena boards.
      break;
    }
    case 'deliver': {
      const pos = stepPos(step, g.city);
      const hasPassenger = !step.needsPassenger || (rt.active.passenger && rt.active.passenger.state === 'inCar');
      if (!player.onFoot && hasPassenger && Math.hypot(player.x - pos.x, player.y - pos.y) < step.radius) advanceStep(rt, g);
      break;
    }
    case 'deliverCar': {
      const pos = stepPos(step, g.city);
      if (!player.onFoot && player.car && player.car.missionTag === step.tag && Math.hypot(player.x - pos.x, player.y - pos.y) < step.radius) advanceStep(rt, g);
      break;
    }
    case 'eliminate': {
      const left = g.enemies.filter((e) => e.alive && e.missionTag === rt.active.tag && !e.fleeing).length;
      const fled = g.enemies.filter((e) => e.missionTag === rt.active.tag && e.fleeing && e.alive).length;
      if (left === 0 && fled === 0) advanceStep(rt, g);
      break;
    }
    case 'collect': {
      if (rt.active.collected >= step.count) advanceStep(rt, g);
      break;
    }
    default:
      break;
  }
}

/** Called when the player picks up a mission-tagged item. */
export function onMissionPickup(rt, g, pickup) {
  if (!rt.active) return;
  const step = rt.active.mission.steps[rt.active.stepIndex];
  if (!step) return;
  if (step.type === 'collect' && pickup.missionTag === step.tag) {
    rt.active.collected += 1;
    g.toasts.push({ text: `Cash secured (${rt.active.collected}/${step.count})`, color: '#8fd08a', life: 2.4, max: 2.4 });
    if (step.setStarsOnFirst && rt.active.collected === 1) {
      g.police.setStars(g, step.setStarsOnFirst);
      g.toasts.push({ text: 'Silent alarm tripped!', color: '#ff8a5a', life: 3, max: 3 });
    }
  }
}

export { MISSION_DEBT };
