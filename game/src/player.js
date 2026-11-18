// Jax on foot and behind the wheel: walking, sprinting, aiming at the mouse,
// entering and stealing cars, and every contextual interaction — talking to
// Vince, saving at the safehouse, repainting, picking things up. The prompt
// line the HUD shows is computed here, in priority order, so the nearest
// sensible action always wins.

import { PLAYER, WANTED } from './config.js';
import { floatText } from './effects.js';
import { reportCrime } from './police.js';
import { driveCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    aimAngle: 0,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    maxHealth: PLAYER.health,
    money: PLAYER.startMoney,
    weapon: 'pistol',
    rifleUnlocked: false,
    fireCooldown: 0,
    moving: false,
    walkPhase: 0,
    lastHurt: -99,
    hornCooldown: 0,
  };
}

function nearestCar(game, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of game.cars) {
    if (car.dead || car.driver === 'police' || car.driver === 'enemy') continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

// The contextual action available right now, or null. Priority: mission
// pickups, Vince, the safehouse, the paint shop, then the nearest car.
export function computePrompt(game) {
  const player = game.player;
  const active = game.missions.active;
  if (player.onFoot && active) {
    const step = active.mission.steps[active.stepIndex];
    if (step && (step.kind === 'pickup' || step.kind === 'collect')) {
      const d = Math.hypot(player.x - step.x, player.y - step.y);
      if (d < 90) return { text: step.prompt, action: 'missionUse' };
    }
  }
  const garage = game.city.locationById('garage');
  if (player.onFoot && Math.hypot(player.x - garage.x, player.y - garage.y) < 95) {
    if (game.missions.done.length >= 5) return { text: 'Vince: the debt is paid. Solmar is yours.', action: 'none' };
    if (!active) return { text: 'Talk to Vince (E)', action: 'vince' };
  }
  const safe = game.city.locationById('safehouse');
  if (player.onFoot && Math.hypot(player.x - safe.x, player.y - safe.y) < 85) {
    return { text: 'Save game (E)', action: 'save' };
  }
  const paint = game.city.locationById('paint');
  if (Math.hypot(player.x - paint.x, player.y - paint.y) < 95 && game.police.stars > 0 && player.money >= WANTED.repaintCost) {
    return { text: `Repaint — $${WANTED.repaintCost} (E)`, action: 'repaint' };
  }
  if (player.onFoot) {
    const car = nearestCar(game, 48);
    if (car) {
      const occupied = car.driver === 'traffic';
      return { text: occupied ? 'Carjack (E)' : 'Get in (E)', action: 'enterCar', car };
    }
  }
  return null;
}

export function doInteract(game) {
  const player = game.player;
  const prompt = game.promptAction;
  if (!prompt) {
    // In a car with nothing to do: step out.
    if (!player.onFoot) exitCar(game);
    return;
  }
  if (prompt.action === 'none') return;
  if (prompt.action === 'vince') {
    game.missions.offered = game.missions.nextId();
    game.pendingOverlay = {
      type: 'missionIntro',
      title: game.missions.offered.title,
      lines: game.missions.offered.brief,
      missionId: game.missions.offered.id,
    };
    game.audio.click();
    return;
  }
  if (prompt.action === 'save') {
    game.saveGame('safehouse');
    floatText(game.effects, player.x, player.y - 26, 'Game saved', '#7ed07e');
    game.audio.cash();
    return;
  }
  if (prompt.action === 'repaint') {
    player.money -= WANTED.repaintCost;
    game.police.setStars(game, 0);
    floatText(game.effects, player.x, player.y - 26, 'Fresh paint — heat cleared', '#7ed07e');
    game.audio.cash();
    return;
  }
  if (prompt.action === 'missionUse') {
    game.missions.useStep(game);
    return;
  }
  if (prompt.action === 'enterCar' && prompt.car) {
    enterCar(game, prompt.car);
  }
}

export function enterCar(game, car) {
  const player = game.player;
  const wasTraffic = car.driver === 'traffic';
  const wasParked = car.driver === 'parked' || car.driver === 'none';
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  player.angle = car.angle;
  game.audio.click();
  if (wasTraffic) {
    // The driver flees on foot.
    const angle = car.angle + Math.PI / 2;
    game.peds.push({
      x: car.x + Math.cos(angle) * 26, y: car.y + Math.sin(angle) * 26,
      angle, speed: 60, shirt: '#c94f43', pants: '#2e3a4a', skin: '#e8b98a', hair: '#2a2a2e',
      beach: false, down: false, downTimer: 0, fleeTimer: 3, fleeX: car.x + Math.cos(angle) * 300,
      fleeY: car.y + Math.sin(angle) * 300, targetX: car.x, targetY: car.y, pauseTimer: 0,
      walkPhase: 0, queueSpot: -1,
    });
  }
  // Stealing is only a crime when someone sees it happen, and only ever
  // worth one star. An unwatched theft is free.
  if (wasTraffic || wasParked) {
    reportCrime(game, 'theft', car.x, car.y);
  }
  game.missions.onEnterCar(game);
}

export function exitCar(game) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 32;
  player.y = car.y + Math.sin(side) * 32;
  const fixed = game.city.collideCircle(player.x, player.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.onFoot = true;
  player.car = null;
  player.angle = car.angle;
  car.driver = 'none';
  car.speed = 0;
  game.audio.click();
}

export function updatePlayer(game, dt, input, actions) {
  const player = game.player;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.hornCooldown = Math.max(0, player.hornCooldown - dt);

  // Aim follows the mouse in world space, on foot and in the car.
  const aim = input.viewToWorld(input.mouse.x, input.mouse.y, game.camera);
  player.aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);

  if (actions.horn > 0 && !player.onFoot && player.hornCooldown <= 0) {
    player.hornCooldown = 0.5;
    game.audio.horn();
  }
  if (actions.interact > 0) doInteract(game);

  if (player.onFoot) {
    let mx = input.moveX();
    let my = input.moveY();
    const len = Math.hypot(mx, my);
    player.moving = len > 0;
    if (len > 0) {
      mx /= len;
      my /= len;
      const speed = input.sprinting() ? PLAYER.sprint : PLAYER.walk;
      const nx = player.x + mx * speed * dt;
      const ny = player.y + my * speed * dt;
      const fixed = game.city.collideCircle(nx, ny, PLAYER.radius);
      player.x = fixed.x;
      player.y = fixed.y;
      player.walkPhase += dt * (speed / 24);
    }
    player.angle = player.aimAngle;
    if (input.mouse.down) game.weapons.fire(game);
    if (actions.punch > 0) game.weapons.punch(game);
  } else if (player.car) {
    const car = player.car;
    const throttle = input.moveY() * -1;
    const steer = input.moveX();
    const moved = driveCar(car, throttle, steer, input.handbrake(), dt, game.city);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.moving = Math.abs(car.speed) > 20;
    if (input.handbrake() && Math.abs(car.speed) > 120 && moved > 0) {
      game.effects.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 4 });
    }
    // Drive-by: shooting from the window, aimed at the mouse.
    if (input.mouse.down) game.weapons.fire(game);
  }

  // Pickups: cash stashes and health, collected by touch.
  for (const stash of game.city.stashes) {
    if (stash.taken) continue;
    if (Math.hypot(player.x - stash.x, player.y - stash.y) < 30) {
      stash.taken = true;
      player.money += stash.amount;
      floatText(game.effects, stash.x, stash.y - 16, `+$${stash.amount}`, '#7ed07e');
      game.audio.cash();
    }
  }
  for (const pack of game.healthPacks) {
    if (pack.taken) continue;
    if (Math.hypot(player.x - pack.x, player.y - pack.y) < 30) {
      pack.taken = true;
      player.health = Math.min(player.maxHealth, player.health + 40);
      floatText(game.effects, pack.x, pack.y - 16, '+40 HP', '#6ac86a');
      game.audio.pickup();
    }
  }
}
