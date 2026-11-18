// Missions and the step engine: five story jobs from Vince, each a list of
// steps — go somewhere, get in a car, deliver, pick up, fight. One engine
// runs them all: markers, the GPS route and the objective banner all follow
// the current step. Failing (busted or wasted) resets the mission; the debt
// only clears when all five are done.

import { MISSIONS } from './config.js';
import { floatText } from './effects.js';
import { spawnGuards } from './enemies.js';
import { createCar } from './vehicles.js';

function defs() {
  return [
    {
      ...MISSIONS[0],
      brief: [
        'Vince: "Back behind the wheel, Jax. Steal any car and',
        'bring it to the Chop Shop. No heroes, no noise."',
      ],
      steps: [
        { kind: 'enterCar', instruction: 'Steal a car', label: 'CAR' },
        { kind: 'deliver', x: 3318, y: 3318, radius: 80, instruction: 'Deliver the car to the Chop Shop', label: 'DROP-OFF' },
      ],
    },
    {
      ...MISSIONS[1],
      brief: [
        'Vince: "A package is waiting at the Port docks. Grab it',
        'and get it back here fast — and expect company."',
      ],
      steps: [
        { kind: 'go', x: 3440, y: 1300, radius: 85, instruction: 'Go to the Port Cargo Docks', label: 'DOCKS' },
        {
          kind: 'pickup', x: 3440, y: 1300, radius: 90, prompt: 'Pick up the package (E)',
          instruction: 'Pick up the package', label: 'PACKAGE',
          onUse(game) {
            game.missionTimer = 75;
            spawnPursuers(game);
            floatText(game.effects, game.player.x, game.player.y - 30, '75 seconds — move!', '#ffd34d');
          },
        },
        { kind: 'deliver', x: 1196, y: 1382, radius: 85, instruction: 'Deliver the package to Vince', label: 'VINCE' },
      ],
    },
    {
      ...MISSIONS[2],
      brief: [
        'Vince: "Three drops, one clock. Galleria, Stadium, Motel.',
        'Do it clean and the rifle is yours."',
      ],
      startTimer: 130,
      steps: [
        { kind: 'deliver', x: 2164, y: 1866, radius: 85, instruction: 'Drop 1 of 3: Solmar Galleria', label: 'DROP 1' },
        { kind: 'deliver', x: 3132, y: 898, radius: 85, instruction: 'Drop 2 of 3: Solmar Stadium', label: 'DROP 2' },
        { kind: 'deliver', x: 1196, y: 2834, radius: 85, instruction: 'Drop 3 of 3: Palm Court Motel', label: 'DROP 3' },
      ],
      onComplete(game) {
        game.player.rifleUnlocked = true;
        floatText(game.effects, game.player.x, game.player.y - 30, 'Rifle unlocked — press 2', '#ffd34d');
      },
    },
    {
      ...MISSIONS[3],
      brief: [
        'Vince: "A Veloce GT is sitting in a Marina Bay lot with',
        'friends watching it. Take it. Bring it here."',
      ],
      onStart(game) {
        const veloce = createCar('veloce', 2834, 2350, Math.PI / 2, 'parked');
        veloce.missionSpawn = true;
        game.cars.push(veloce);
        spawnGuards(game, [
          { x: 2730, y: 2240 }, { x: 2940, y: 2240 },
          { x: 2730, y: 2460 }, { x: 2940, y: 2460 },
        ]);
        for (const foe of game.enemies) foe.missionSpawn = true;
      },
      steps: [
        { kind: 'go', x: 2834, y: 2350, radius: 100, instruction: 'Find the Veloce GT in Marina Bay', label: 'VELOCE' },
        { kind: 'enterCar', carModel: 'veloce', instruction: 'Steal the Veloce GT', label: 'VELOCE' },
        { kind: 'deliver', x: 1196, y: 1382, radius: 85, instruction: 'Deliver the Veloce to Vince', label: 'VINCE' },
      ],
    },
    {
      ...MISSIONS[4],
      brief: [
        'Vince: "The Big Score. First Bank of Solmar. The guards',
        'are paid to be brave. Be braver. Then run."',
      ],
      onStart(game) {
        spawnGuards(game, [
          { x: 1720, y: 1800 }, { x: 1720, y: 1930 },
          { x: 1720, y: 1760 }, { x: 1980, y: 1866 },
          { x: 1866, y: 1970 }, { x: 2000, y: 1950 },
        ]);
        for (const foe of game.enemies) foe.missionSpawn = true;
      },
      steps: [
        { kind: 'go', x: 1680, y: 1866, radius: 100, instruction: 'Get to the First Bank of Solmar', label: 'BANK' },
        { kind: 'combat', x: 1866, y: 1866, radius: 120, instruction: 'Take out the bank guards', label: 'BANK', combat: true },
        {
          kind: 'collect', x: 1720, y: 1866, radius: 90, prompt: 'Grab the cash (E)',
          instruction: 'Grab the cash', label: 'VAULT',
        },
        { kind: 'go', x: 656, y: 3560, radius: 90, instruction: 'Escape to Ocean Drive', label: 'ESCAPE' },
      ],
    },
  ];
}

function spawnPursuers(game) {
  const spots = [
    { x: 3076, y: 1866, angle: 0 },
    { x: 3560, y: 2108, angle: Math.PI },
  ];
  for (const spot of spots) {
    const car = createCar('muscle', spot.x, spot.y, spot.angle, 'enemy');
    car.missionSpawn = true;
    game.cars.push(car);
  }
}

export function createMissions() {
  const all = defs();
  return {
    all,
    done: [],
    active: null,
    offered: null,
    nextId() {
      return all.find((m) => !this.done.includes(m.id)) || null;
    },
    hasNext() {
      return !!this.nextId();
    },
    startOffered(game) {
      const mission = this.offered || this.nextId();
      if (!mission) return;
      this.offered = null;
      this.active = { mission, stepIndex: 0, spawned: [] };
      game.missionTimer = mission.startTimer || null;
      if (mission.onStart) mission.onStart(game);
      game.saveGame('mission');
    },
    useStep(game) {
      const active = this.active;
      if (!active) return;
      const step = active.mission.steps[active.stepIndex];
      if (!step || (step.kind !== 'pickup' && step.kind !== 'collect')) return;
      const d = Math.hypot(game.player.x - step.x, game.player.y - step.y);
      if (d > step.radius) return;
      if (step.onUse) step.onUse(game);
      game.audio.pickup();
      this.advance(game);
    },
    onEnterCar(game) {
      const active = this.active;
      if (!active) return;
      const step = active.mission.steps[active.stepIndex];
      if (!step || step.kind !== 'enterCar') return;
      if (step.carModel && game.player.car.model !== step.carModel) return;
      this.advance(game);
    },
    advance(game) {
      const active = this.active;
      if (!active) return;
      active.stepIndex += 1;
      if (active.stepIndex >= active.mission.steps.length) {
        this.complete(game);
      } else {
        game.audio.click();
      }
    },
    complete(game) {
      const active = this.active;
      if (!active) return;
      const mission = active.mission;
      this.done.push(mission.id);
      game.player.money += mission.payout;
      game.missionTimer = null;
      if (mission.onComplete) mission.onComplete(game);
      this.cleanupSpawns(game, true);
      this.active = null;
      game.saveGame('mission');
      game.audio.missionDone();
      game.pendingOverlay = {
        type: 'missionDone',
        title: 'JOB DONE',
        lines: [`${mission.title} — $${mission.payout}.`, `Debt left: $${Math.max(0, 5000 - this.earned(game))}.`],
        missionId: mission.id,
        allDone: this.done.length >= all.length,
      };
    },
    earned(game) {
      void game;
      return this.done.reduce((sum, id) => {
        const m = all.find((d) => d.id === id);
        return sum + (m ? m.payout : 0);
      }, 0);
    },
    fail(game, reason) {
      if (!this.active) return;
      this.active = null;
      game.missionTimer = null;
      this.cleanupSpawns(game, false);
      void reason;
    },
    cleanupSpawns(game, completed) {
      game.enemies = game.enemies.filter((foe) => !foe.missionSpawn);
      game.cars = game.cars.filter((car) => {
        if (!car.missionSpawn) return true;
        if (completed && car === game.player.car) {
          car.missionSpawn = false;
          return true;
        }
        return false;
      });
    },
    update(game, dt) {
      const active = this.active;
      if (!active) return;
      if (game.missionTimer !== null) {
        game.missionTimer -= dt;
        if (game.missionTimer <= 0) {
          game.missionTimer = null;
          const title = active.mission.title;
          this.fail(game, 'time');
          game.pendingOverlay = {
            type: 'failed',
            title: 'TOO SLOW',
            lines: [`${title} ran out of time.`, 'Vince will give you another shot.'],
          };
          return;
        }
      }
      const step = active.mission.steps[active.stepIndex];
      if (!step) return;
      const player = game.player;
      if (step.kind === 'go') {
        if (Math.hypot(player.x - step.x, player.y - step.y) < step.radius) this.advance(game);
      } else if (step.kind === 'deliver') {
        if (!player.onFoot && Math.hypot(player.x - step.x, player.y - step.y) < step.radius) this.advance(game);
      } else if (step.kind === 'combat') {
        const alive = game.enemies.filter((foe) => !foe.dead && foe.missionSpawn).length;
        if (alive === 0) this.advance(game);
      }
    },
    // Markers for the world and the minimap: the current objective first,
    // then the paint shop, then Vince when no job is running.
    markers(game) {
      const list = [];
      const active = this.active;
      if (active) {
        const step = active.mission.steps[active.stepIndex];
        if (step) {
          if (step.kind === 'enterCar') {
            let best = null;
            let bestDist = Infinity;
            for (const car of game.cars) {
              if (car.dead || car.driver === 'police' || car.driver === 'enemy') continue;
              if (step.carModel && car.model !== step.carModel) continue;
              const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
              if (d < bestDist) { bestDist = d; best = car; }
            }
            if (best) list.push({ x: best.x, y: best.y, label: step.label || 'CAR', combat: false });
          } else if (step.x !== undefined) {
            list.push({ x: step.x, y: step.y, label: step.label || 'GO', combat: !!step.combat });
          }
        }
      } else if (this.hasNext()) {
        const garage = game.city.locationById('garage');
        list.push({ x: garage.x, y: garage.y, label: 'VINCE', combat: false });
      }
      const paint = game.city.locationById('paint');
      list.push({ x: paint.x, y: paint.y, label: 'PAINT', combat: false });
      return list;
    },
    objective(game) {
      const active = this.active;
      const district = game.city.districtAt(game.player.x, game.player.y);
      if (!active) {
        return {
          district,
          instruction: this.hasNext() ? 'Visit Vince for work' : 'Debt paid — Solmar is yours',
          distance: null,
          timer: null,
        };
      }
      const step = active.mission.steps[active.stepIndex];
      let distance = null;
      if (step && step.x !== undefined) {
        distance = Math.max(0, Math.round(Math.hypot(game.player.x - step.x, game.player.y - step.y) / 10));
      }
      return {
        district,
        instruction: step ? step.instruction : '',
        distance,
        timer: game.missionTimer,
      };
    },
  };
}
