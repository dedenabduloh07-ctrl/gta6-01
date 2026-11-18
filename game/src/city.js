// Solmar, generated once from the fixed seed: the road grid, districts,
// buildings, named locations, the beach, and the routing graph every driver
// in the game follows. Nothing here changes after creation except the traffic
// lights, which cycle on game time.

import {
  BEACH_TOP, DISTRICTS, HIGHWAY_ROW, ROADS, ROAD_HALF, SIDEWALK, WATER_TOP,
  WORLD, roadClass, roadName,
} from './config.js';
import { createDice } from './random.js';

const WALLS = ['#e8dcc8', '#d9c9a8', '#c9b18a', '#b7c3c9', '#e0b89a', '#d4b8b0', '#c2cdb4'];
const ROOFS = ['#a8574a', '#7a6a58', '#5d7a8a', '#8a7a5a', '#94604a', '#6a7a6a'];

function blockRect(col, row) {
  return {
    x0: ROADS[col] + ROAD_HALF + SIDEWALK,
    y0: ROADS[row] + ROAD_HALF + SIDEWALK,
    x1: ROADS[col + 1] - ROAD_HALF - SIDEWALK,
    y1: ROADS[row + 1] - ROAD_HALF - SIDEWALK,
  };
}

export function createCity(seed) {
  const dice = createDice(seed);
  const buildings = [];
  const props = [];
  const stashes = [];
  const lots = [];

  // Named locations: id, display name, interaction point, and the block that
  // holds the building. Approaches are kept clear of obstacles.
  const locations = [
    { id: 'hospital', name: 'Solmar General Hospital', x: 612, y: 414, block: [0, 0], kind: 'hospital' },
    { id: 'police', name: 'Police HQ', x: 2648, y: 414, block: [5, 0], kind: 'police' },
    { id: 'garage', name: "Vince's Garage", x: 1196, y: 1382, block: [1, 1], kind: 'garage' },
    { id: 'safehouse', name: 'Safehouse', x: 1866, y: 2382, block: [3, 3], kind: 'safehouse' },
    { id: 'paint', name: 'Spray & Go Paint Shop', x: 3076, y: 2350, block: [6, 3], kind: 'paint' },
    { id: 'bank', name: 'First Bank of Solmar', x: 1680, y: 1866, block: [2, 2], kind: 'bank' },
    { id: 'chopshop', name: 'Chop Shop', x: 3318, y: 3318, block: [6, 6], kind: 'lot' },
    { id: 'mall', name: 'Solmar Galleria', x: 2164, y: 1866, block: [4, 2], kind: 'mall' },
    { id: 'stadium', name: 'Solmar Stadium', x: 3132, y: 898, block: [6, 1], kind: 'stadium' },
    { id: 'motel', name: 'Palm Court Motel', x: 1196, y: 2834, block: [1, 5], kind: 'motel' },
    { id: 'marina', name: 'Marina Bay Docks', x: 3200, y: 3850, block: null, kind: 'marina' },
    { id: 'docks', name: 'Port Cargo Docks', x: 3440, y: 1300, block: [6, 2], kind: 'docks' },
  ];
  const locationById = {};
  for (const loc of locations) locationById[loc.id] = loc;

  // The park block: grass, palms, a fountain, benches — no buildings.
  const PARK = [3, 0];
  const OPEN_LOTS = { '6,6': true, '5,4': true };

  function addBuilding(x, y, w, h, style, kind) {
    const b = {
      x, y, w, h,
      hgt: style === 'tower' ? dice.int(46, 78) : style === 'block' ? dice.int(26, 44) : dice.int(12, 22),
      style,
      kind: kind || 'plain',
      wall: dice.pick(WALLS),
      roof: dice.pick(ROOFS),
      seed: dice.next(),
    };
    buildings.push(b);
    return b;
  }

  // A proposed building must not cover a named location's interaction
  // point: every mission and menu target stays reachable on foot.
  function coversLocation(x, y, w, h) {
    for (const loc of locations) {
      if (x - 60 < loc.x && loc.x < x + w + 60 && y - 60 < loc.y && loc.y < y + h + 60) return true;
    }
    return false;
  }

  // Fill every block: location blocks get their landmark, the park stays
  // green, open lots stay drivable, the rest get houses and towers.
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const key = `${col},${row}`;
      const rect = blockRect(col, row);
      const landmark = locations.find((l) => l.block && l.block[0] === col && l.block[1] === row);
      if (PARK[0] === col && PARK[1] === row) {
        props.push({ kind: 'fountain', x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2, r: 34 });
        for (let i = 0; i < 8; i += 1) {
          props.push({ kind: 'palm', x: dice.range(rect.x0 + 30, rect.x1 - 30), y: dice.range(rect.y0 + 30, rect.y1 - 30), seed: dice.next() });
        }
        props.push({ kind: 'bench', x: rect.x0 + 60, y: rect.y0 + 60, angle: 0.4 });
        props.push({ kind: 'bench', x: rect.x1 - 60, y: rect.y1 - 60, angle: 0.4 + Math.PI });
        continue;
      }
      if (OPEN_LOTS[key]) {
        lots.push({ x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, key });
        props.push({ kind: 'fence', x0: rect.x0 + 8, y0: rect.y0 + 8, x1: rect.x1 - 8, y1: rect.y1 - 8 });
        continue;
      }
      if (landmark) {
        const cx = (rect.x0 + rect.x1) / 2;
        const cy = (rect.y0 + rect.y1) / 2;
        if (landmark.kind === 'paint') {
          addBuilding(rect.x1 - 190, rect.y0 + 60, 170, 130, 'block', 'paint');
        } else if (landmark.kind === 'docks') {
          addBuilding(rect.x0 + 30, rect.y0 + 30, 150, 110, 'block', 'warehouse');
          for (let i = 0; i < 5; i += 1) {
            props.push({ kind: 'container', x: dice.range(rect.x0 + 30, rect.x1 - 110), y: dice.range(rect.y0 + 170, rect.y1 - 50), w: 86, h: 34, color: dice.pick(['#b0483a', '#3a6a8a', '#c98a3a', '#4a7a4a']), solid: true });
          }
          props.push({ kind: 'crane', x: rect.x1 - 60, y: rect.y0 + 60 });
        } else if (landmark.kind === 'stadium') {
          addBuilding(rect.x0 + 40, rect.y0 + 40, rect.x1 - rect.x0 - 80, rect.y1 - rect.y0 - 80, 'block', 'stadium');
        } else if (landmark.kind === 'mall') {
          addBuilding(rect.x0 + 30, rect.y0 + 30, rect.x1 - rect.x0 - 60, rect.y1 - rect.y0 - 60, 'block', 'mall');
        } else if (landmark.kind === 'safehouse') {
          // House at the north of the block; the driveway column to the road
          // below stays empty so the approach is always walkable.
          addBuilding(cx - 80, rect.y0 + 30, 160, 120, 'house', 'safehouse');
          props.push({ kind: 'palm', x: cx - 120, y: rect.y0 + 60, seed: dice.next() });
          props.push({ kind: 'palm', x: cx + 120, y: rect.y0 + 60, seed: dice.next() });
        } else {
          const w = landmark.kind === 'bank' ? 220 : 180;
          const h = landmark.kind === 'bank' ? 150 : 130;
          const bx = landmark.kind === 'garage' ? rect.x0 + 90 : cx - w / 2;
          const by = landmark.kind === 'garage' ? cy - h / 2 : cy - h / 2;
          addBuilding(bx, by, w, h, landmark.kind === 'hospital' || landmark.kind === 'police' ? 'block' : 'house', landmark.kind);
          if (landmark.kind === 'hospital') props.push({ kind: 'helipad', x: rect.x1 - 70, y: rect.y1 - 70, r: 34 });
          if (landmark.kind === 'garage') props.push({ kind: 'neon', x: rect.x0 + 100, y: rect.y0 + 30, color: '#ff5a4e' });
        }
        continue;
      }
      // Ordinary block: one big building or a pair, plus dressing.
      const count = dice.chance(0.55) ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = dice.range(90, count === 1 ? 240 : 150);
        const h = dice.range(80, count === 1 ? 200 : 140);
        const x = count === 1 ? (rect.x0 + rect.x1) / 2 - w / 2 : rect.x0 + 20 + i * ((rect.x1 - rect.x0) / 2) + dice.range(0, 30);
        const y = (rect.y0 + rect.y1) / 2 - h / 2 + dice.range(-20, 20);
        const style = dice.chance(0.3) ? 'tower' : dice.chance(0.5) ? 'block' : 'house';
        if (!coversLocation(x, y, w, h)) addBuilding(x, y, w, h, style);
      }
      if (dice.chance(0.6)) props.push({ kind: 'palm', x: dice.range(rect.x0 + 20, rect.x1 - 20), y: dice.range(rect.y0 + 20, rect.y1 - 20), seed: dice.next() });
      if (dice.chance(0.4)) props.push({ kind: 'crate', x: dice.range(rect.x0 + 20, rect.x1 - 40), y: dice.range(rect.y0 + 20, rect.y1 - 40), s: 22 });
      if (dice.chance(0.3)) props.push({ kind: 'bench', x: dice.range(rect.x0 + 30, rect.x1 - 30), y: dice.range(rect.y0 + 30, rect.y1 - 30), angle: dice.range(0, Math.PI) });
    }
  }

  // Street furniture along the sidewalks: lamps at intersections, hydrants
  // and palms scattered, flags at the civic buildings.
  for (const rx of ROADS) {
    for (const ry of ROADS) {
      props.push({ kind: 'lamp', x: rx + ROAD_HALF + 8, y: ry - ROAD_HALF - 8 });
      props.push({ kind: 'light', x: rx, y: ry, phase: (ROADS.indexOf(rx) + ROADS.indexOf(ry)) % 2 });
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const vertical = dice.chance(0.5);
    const road = dice.pick(ROADS);
    const along = dice.range(100, 3600);
    const side = dice.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (ROAD_HALF + 10) : along;
    const y = vertical ? along : road + side * (ROAD_HALF + 10);
    props.push({ kind: dice.chance(0.5) ? 'hydrant' : 'palm', x, y, seed: dice.next() });
  }
  props.push({ kind: 'flag', x: 2648, y: 360, color: '#3a6fd8' });
  props.push({ kind: 'flag', x: 612, y: 360, color: '#e0483e' });

  // The beach: courts, stalls, umbrellas, players, swimmers, boats.
  const sandY0 = BEACH_TOP + 80;
  const sandY1 = WATER_TOP;
  function onSand(x, y) {
    return { x, y: Math.min(Math.max(y, sandY0 + 20), sandY1 - 20) };
  }
  const courts = [900, 2400];
  for (const cx of courts) {
    props.push({ kind: 'volleyball', x: cx, y: (sandY0 + sandY1) / 2, seed: dice.next() });
  }
  const stalls = [
    { food: 'TACOS', x: 700, y: sandY0 + 46 },
    { food: 'ICE CREAM', x: 1800, y: sandY0 + 46 },
    { food: 'JUICE', x: dice.range(2600, 3100), y: sandY0 + 46 },
    { food: 'HOT DOGS', x: dice.range(300, 550), y: sandY0 + 46 },
  ];
  for (const stall of stalls) {
    props.push({ kind: 'vendorStall', x: stall.x, y: stall.y, food: stall.food, seed: dice.next(), solid: true });
  }
  for (let i = 0; i < 20; i += 1) {
    const p = onSand(dice.range(80, WORLD.width - 80), dice.range(sandY0, sandY1));
    props.push({ kind: 'umbrella', x: p.x, y: p.y, color: dice.pick(['#e0483e', '#3a6fd8', '#f2c94c', '#4a9a5a', '#e08a3e']), seed: dice.next() });
  }
  for (let i = 0; i < 8; i += 1) {
    const p = onSand(dice.range(80, WORLD.width - 80), dice.range(sandY0, sandY1));
    props.push({ kind: 'sunbather', x: p.x, y: p.y, color: dice.pick(['#e0483e', '#3a6fd8', '#f2c94c']), seed: dice.next() });
  }
  for (let i = 0; i < 5; i += 1) {
    const p = onSand(dice.range(80, WORLD.width - 80), dice.range(sandY0, sandY1));
    props.push({ kind: 'sandcastle', x: p.x, y: p.y, seed: dice.next() });
  }
  for (let i = 0; i < 4; i += 1) {
    const p = onSand(dice.range(80, WORLD.width - 80), dice.range(sandY0, sandY1));
    props.push({ kind: 'surfboard', x: p.x, y: p.y, color: dice.pick(['#3a6fd8', '#e0483e', '#f2c94c']), seed: dice.next() });
  }
  for (let i = 0; i < 4; i += 1) {
    const p = onSand(dice.range(80, WORLD.width - 80), dice.range(sandY0, sandY1));
    props.push({ kind: 'beachBall', x: p.x, y: p.y, color: dice.pick(['#e0483e', '#3a6fd8', '#f2c94c']), seed: dice.next() });
  }
  for (let i = 0; i < 3; i += 1) {
    const p = onSand(dice.range(200, WORLD.width - 200), dice.range(sandY0, sandY1));
    props.push({ kind: 'frisbee', x: p.x, y: p.y, seed: dice.next() });
  }
  props.push({ kind: 'lifeguardTower', x: 1500, y: WATER_TOP - 30, solid: true });
  props.push({ kind: 'lifeguard', x: 2650, y: WATER_TOP - 24 });
  props.push({ kind: 'lifeguard', x: 500, y: WATER_TOP - 24 });
  for (let i = 0; i < 6; i += 1) {
    props.push({ kind: 'swimmer', x: dice.range(150, WORLD.width - 150), y: dice.range(WATER_TOP + 40, WORLD.height - 60), seed: dice.next(), phase: dice.range(0, 6.28) });
  }
  for (let i = 0; i < 2; i += 1) {
    props.push({ kind: 'surfer', x: dice.range(400, WORLD.width - 400), y: dice.range(WATER_TOP + 60, WORLD.height - 90), seed: dice.next(), phase: dice.range(0, 6.28) });
  }
  for (let i = 0; i < 4; i += 1) {
    props.push({ kind: 'boat', x: dice.range(200, WORLD.width - 200), y: dice.range(WATER_TOP + 90, WORLD.height - 40), angle: dice.range(-0.4, 0.4), seed: dice.next(), phase: dice.range(0, 6.28) });
  }
  props.push({ kind: 'boatDry', x: 3300, y: sandY1 - 30 });
  props.push({ kind: 'wreck', x: 240, y: WATER_TOP + 130, angle: 0.5 });
  for (let i = 0; i < 14; i += 1) {
    props.push({ kind: 'palm', x: 60 + i * 260 + dice.range(-30, 30), y: BEACH_TOP + 40, seed: dice.next() });
  }
  props.push({ kind: 'towel', x: 1200, y: sandY0 + 90, angle: 0.3, color: '#3a6fd8' });
  props.push({ kind: 'towel', x: 2050, y: sandY0 + 130, angle: -0.2, color: '#e0483e' });

  // Hidden cash stashes, tucked into blocks off the roads.
  for (let i = 0; i < 12; i += 1) {
    const col = dice.int(0, 6);
    const row = dice.int(0, 6);
    const rect = blockRect(col, row);
    stashes.push({
      x: dice.range(rect.x0 + 40, rect.x1 - 40),
      y: dice.range(rect.y0 + 40, rect.y1 - 40),
      amount: dice.int(4, 8) * 10,
      taken: false,
    });
  }

  // Collision solids: building footprints plus the solid props.
  const solids = buildings.map((b) => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }));
  for (const p of props) {
    if (p.kind === 'container') solids.push({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h });
    if (p.kind === 'fountain') solids.push({ x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r, circle: p });
    if (p.kind === 'vendorStall') solids.push({ x0: p.x - 34, y0: p.y - 20, x1: p.x + 34, y1: p.y + 20 });
    if (p.kind === 'lifeguardTower') solids.push({ x0: p.x - 16, y0: p.y - 14, x1: p.x + 16, y1: p.y + 14 });
    if (p.kind === 'volleyball') solids.push({ x0: p.x - 6, y0: p.y - 44, x1: p.x + 6, y1: p.y + 44 });
  }

  function nearestRoad(value) {
    let best = ROADS[0];
    for (const road of ROADS) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
    return best;
  }

  // Manhattan path through the grid: snap to the nearest road, travel along
  // roads to the target's nearest intersection, then the final leg. Used for
  // the GPS route line and for drivers that follow roads.
  function routeWaypoints(fx, fy, tx, ty) {
    const rx0 = nearestRoad(fx);
    const ry0 = nearestRoad(fy);
    const rxt = nearestRoad(tx);
    const ryt = nearestRoad(ty);
    const points = [{ x: fx, y: fy }];
    if (Math.abs(fx - rx0) <= Math.abs(fy - ry0)) {
      points.push({ x: rx0, y: fy }, { x: rx0, y: ryt }, { x: rxt, y: ryt });
    } else {
      points.push({ x: fx, y: ry0 }, { x: rxt, y: ry0 }, { x: rxt, y: ryt });
    }
    points.push({ x: tx, y: ty });
    const cleaned = [points[0]];
    for (let i = 1; i < points.length; i += 1) {
      const prev = cleaned[cleaned.length - 1];
      if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) > 30) cleaned.push(points[i]);
    }
    return cleaned;
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
    }
    return 'Solmar';
  }

  function isWater(x, y) {
    return y >= WATER_TOP;
  }

  // Push a circle out of solids, water and the world edge. Returns the
  // corrected position (a new object only when something moved).
  function collideCircle(x, y, radius) {
    let nx = Math.min(Math.max(x, radius), WORLD.width - radius);
    let ny = Math.min(Math.max(y, radius), WORLD.height - radius);
    if (ny + radius > WATER_TOP && ny < WATER_TOP + 40) ny = WATER_TOP - radius;
    if (ny >= WATER_TOP) ny = WATER_TOP - radius;
    for (const s of solids) {
      const cx = Math.min(Math.max(nx, s.x0), s.x1);
      const cy = Math.min(Math.max(ny, s.y0), s.y1);
      const dx = nx - cx;
      const dy = ny - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq >= radius * radius) continue;
      if (distSq === 0) {
        // Centre inside the rect: push out along the smallest penetration.
        const pushLeft = nx - s.x0 + radius;
        const pushRight = s.x1 - nx + radius;
        const pushUp = ny - s.y0 + radius;
        const pushDown = s.y1 - ny + radius;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) nx = s.x0 - radius;
        else if (min === pushRight) nx = s.x1 + radius;
        else if (min === pushUp) ny = s.y0 - radius;
        else ny = s.y1 + radius;
      } else {
        const dist = Math.sqrt(distSq);
        nx = cx + (dx / dist) * radius;
        ny = cy + (dy / dist) * radius;
      }
    }
    return { x: nx, y: ny };
  }

  function pointBlocked(x, y, radius) {
    const fixed = collideCircle(x, y, radius);
    return Math.abs(fixed.x - x) > 0.01 || Math.abs(fixed.y - y) > 0.01;
  }

  return {
    buildings,
    props,
    stashes,
    lots,
    solids,
    locations,
    locationById(id) {
      return locationById[id] || null;
    },
    districtAt,
    routeWaypoints,
    nearestRoad,
    isWater,
    collideCircle,
    pointBlocked,
    roadClass,
    roadName,
  };
}
