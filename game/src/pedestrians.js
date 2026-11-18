// Pedestrians: sidewalk strollers who loop their block, cross at crosswalks,
// and flee gunshots, explosions and speeding cars. Getting knocked down by a
// car puts them on the ground for a while; they get up and run.

import { BEACH_TOP, N_ROADS, SAND_TOP } from './config.js';
import { pick, randInt } from './random.js';

const PED_COUNT = 34;
const BEACH_COUNT = 12;

const JACKETS = ['#4a6b8a', '#8a4a5a', '#4a7a5a', '#b8a13a', '#7a5a9a', '#c97b2e', '#3a8a8c', '#d8d3c4', '#5a5f66', '#a83a4a'];
const PANTS = ['#2e3a4a', '#4a3a2e', '#3a3a3e', '#5a5f66', '#2b4a3a'];
const SKINS = ['#e8b98f', '#c98a5e', '#8a5a38', '#f0d0a8', '#6b4426'];
const HAIRS = ['#2b2118', '#4a3520', '#6b6b6b', '#1c1c20', '#8a6f4d', '#c9a13a'];

function makePed(rng, x, y) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 52 + rng() * 30,
    jacket: pick(rng, JACKETS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKINS),
    hair: pick(rng, HAIRS),
    phase: rng() * 6.28,
    moving: true,
    state: 'walk',
    bx: 0, by: 0, edge: 0, t: 0,
    crossFrom: null, crossTo: null, crossT: 0,
    fleeTimer: 0, downTimer: 0,
    threatX: 0, threatY: 0,
    down: false,
    alive: true,
    aim: null,
    armed: false,
    strollMin: 0, strollMax: 0, strollDir: 1,
  };
}

export function createPedestrians(city, rng) {
  const peds = [];

  function randomBlock() {
    return { bx: randInt(rng, 0, N_ROADS - 2), by: randInt(rng, 0, N_ROADS - 2) };
  }

  function init() {
    for (let i = 0; i < PED_COUNT; i += 1) {
      const { bx, by } = randomBlock();
      const loop = city.sidewalkLoop(bx, by);
      const edge = randInt(rng, 0, 3);
      const t = rng();
      const a = loop[edge];
      const b = loop[(edge + 1) % 4];
      const p = makePed(rng, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      p.bx = bx;
      p.by = by;
      p.edge = edge;
      p.t = t;
      p.angle = Math.atan2(b.y - a.y, b.x - a.x);
      peds.push(p);
    }
    for (let i = 0; i < BEACH_COUNT; i += 1) {
      const x = 200 + rng() * 3200;
      // Half stroll the boardwalk, half wander the sand itself.
      const y = i % 2 === 0 ? BEACH_TOP + 30 : SAND_TOP + 110 + rng() * 60;
      const p = makePed(rng, x, y);
      p.state = 'stroll';
      p.strollMin = Math.max(120, x - 300 - rng() * 200);
      p.strollMax = Math.min(3600, x + 300 + rng() * 200);
      p.strollDir = rng() < 0.5 ? 1 : -1;
      peds.push(p);
    }
  }

  /** Scatter everyone near (x,y): gunshots and explosions scare the street. */
  function alert(x, y, radius) {
    for (const p of peds) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.state = 'flee';
        p.fleeTimer = 3 + Math.random() * 2;
        p.threatX = x;
        p.threatY = y;
      }
    }
  }

  function nearestLoopPoint(p) {
    let best = null;
    let bestD = Infinity;
    for (let bx = 0; bx < N_ROADS - 1; bx += 1) {
      for (let by = 0; by < N_ROADS - 1; by += 1) {
        const loop = city.sidewalkLoop(bx, by);
        for (let e = 0; e < 4; e += 1) {
          const a = loop[e];
          const b = loop[(e + 1) % 4];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
          const px = a.x + dx * t;
          const py = a.y + dy * t;
          const d = Math.hypot(p.x - px, p.y - py);
          if (d < bestD) {
            bestD = d;
            best = { bx, by, edge: e, t };
          }
        }
      }
    }
    return best;
  }

  function updateWalk(p, dt) {
    const loop = city.sidewalkLoop(p.bx, p.by);
    const a = loop[p.edge];
    const b = loop[(p.edge + 1) % 4];
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    p.t += (p.speed * dt) / edgeLen;
    p.moving = true;
    if (p.t >= 1) {
      // Reached a corner: maybe cross the street to the next block.
      const corner = (p.edge + 1) % 4;
      const cross = tryCross(p, corner);
      if (!cross) {
        p.edge = corner;
        p.t = 0;
      }
    }
    const na = loop[p.edge];
    const nb = loop[(p.edge + 1) % 4];
    p.x = na.x + (nb.x - na.x) * p.t;
    p.y = na.y + (nb.y - na.y) * p.t;
    p.angle = Math.atan2(nb.y - na.y, nb.x - na.x);
  }

  /** From corner c of p's block, cross to the neighbouring block, or false. */
  function tryCross(p, corner) {
    if (Math.random() > 0.3) return false;
    // Corner 0 TL, 1 TR, 2 BR, 3 BL. Crossing options per corner:
    // TL -> north (by-1, BL corner) or west (bx-1, TR corner); etc.
    const options = [];
    if (corner === 0) {
      if (p.by > 0) options.push({ bx: p.bx, by: p.by - 1, corner: 3 });
      if (p.bx > 0) options.push({ bx: p.bx - 1, by: p.by, corner: 1 });
    } else if (corner === 1) {
      if (p.by > 0) options.push({ bx: p.bx, by: p.by - 1, corner: 2 });
      if (p.bx < N_ROADS - 2) options.push({ bx: p.bx + 1, by: p.by, corner: 0 });
    } else if (corner === 2) {
      if (p.by < N_ROADS - 2) options.push({ bx: p.bx, by: p.by + 1, corner: 1 });
      if (p.bx < N_ROADS - 2) options.push({ bx: p.bx + 1, by: p.by, corner: 3 });
    } else {
      if (p.by < N_ROADS - 2) options.push({ bx: p.bx, by: p.by + 1, corner: 0 });
      if (p.bx > 0) options.push({ bx: p.bx - 1, by: p.by, corner: 2 });
    }
    if (options.length === 0) return false;
    const dest = pick(rng, options);
    const loop = city.sidewalkLoop(p.bx, p.by);
    const from = loop[corner];
    const toLoop = city.sidewalkLoop(dest.bx, dest.by);
    const to = toLoop[dest.corner];
    p.state = 'cross';
    p.crossFrom = { x: from.x, y: from.y };
    p.crossTo = { x: to.x, y: to.y };
    p.crossT = 0;
    p.destBlock = dest;
    p.angle = Math.atan2(to.y - from.y, to.x - from.x);
    return true;
  }

  function updateCross(p, dt) {
    const from = p.crossFrom;
    const to = p.crossTo;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    p.crossT += (p.speed * 1.35 * dt) / len;
    if (p.crossT >= 1) {
      p.bx = p.destBlock.bx;
      p.by = p.destBlock.by;
      p.edge = p.destBlock.corner;
      p.t = 0;
      p.state = 'walk';
      p.crossFrom = null;
      p.crossTo = null;
      return;
    }
    p.x = from.x + (to.x - from.x) * p.crossT;
    p.y = from.y + (to.y - from.y) * p.crossT;
    p.moving = true;
  }

  function updateFlee(p, dt) {
    p.fleeTimer -= dt;
    const away = Math.atan2(p.y - p.threatY, p.x - p.threatX) + Math.sin(p.phase * 7) * 0.4;
    p.angle = away;
    p.moving = true;
    const speed = 235;
    const nx = p.x + Math.cos(away) * speed * dt;
    const ny = p.y + Math.sin(away) * speed * dt;
    const fixed = city.collideCircle(nx, ny, 11);
    p.x = fixed.x;
    p.y = fixed.y;
    if (p.fleeTimer <= 0) {
      const spot = nearestLoopPoint(p);
      if (spot) {
        p.bx = spot.bx;
        p.by = spot.by;
        p.edge = spot.edge;
        p.t = spot.t;
        p.state = 'walk';
      } else {
        p.state = 'stroll';
      }
    }
  }

  function update(dt, g) {
    for (const p of peds) {
      if (p.down) {
        p.downTimer -= dt;
        p.moving = false;
        if (p.downTimer <= 0) {
          p.down = false;
          p.state = 'flee';
          p.fleeTimer = 4;
          p.threatX = g.player.x;
          p.threatY = g.player.y;
        }
        continue;
      }
      if (p.state === 'walk') updateWalk(p, dt);
      else if (p.state === 'cross') updateCross(p, dt);
      else if (p.state === 'flee') updateFlee(p, dt);
      else if (p.state === 'stroll') {
        p.x += p.strollDir * p.speed * dt;
        p.angle = p.strollDir > 0 ? 0 : Math.PI;
        p.moving = true;
        if (p.x < p.strollMin) p.strollDir = 1;
        if (p.x > p.strollMax) p.strollDir = -1;
      }
      // Recycle peds that ended up absurdly far from the player.
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) > 2000 && p.state !== 'flee') {
        const { bx, by } = randomBlock();
        const loop = city.sidewalkLoop(bx, by);
        const edge = randInt(rng, 0, 3);
        const t = rng();
        const a = loop[edge];
        const b = loop[(edge + 1) % 4];
        if (Math.hypot(a.x - g.player.x, a.y - g.player.y) > 500) {
          p.bx = bx;
          p.by = by;
          p.edge = edge;
          p.t = t;
          p.state = 'walk';
        }
      }
    }
  }

  /** Knock a pedestrian down (car hit): returns true if it was standing. */
  function knockDown(p, fromX, fromY) {
    if (p.down) return false;
    p.down = true;
    p.downTimer = 2.6;
    p.threatX = fromX;
    p.threatY = fromY;
    return true;
  }

  return { peds, init, update, alert, knockDown };
}
