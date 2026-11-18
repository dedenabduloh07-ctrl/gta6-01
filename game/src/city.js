// Solmar: a seeded grid city. Blocks hold buildings, trees and props; roads
// carry the traffic graph; intersections carry lights and crosswalks. The
// generator also owns collision queries and the named locations missions use.

import {
  BEACH_BAND, BEACH_TOP, BLOCK, MARGIN, N_ROADS, PITCH, ROAD, SAND_TOP,
  WATER_TOP, WORLD_H, WORLD_W, blockRect, roadCenter,
} from './config.js';
import { createRandom, pick, randInt, shuffle } from './random.js';

export const LIGHT_CYCLE = 14;
const SIDEWALK = 26;

const SHOP_SIGNS = ['TACOS', 'MART', 'CAFE', 'GYM', 'BAR', 'PIZZA', 'DONUTS', 'SURF', 'BOOKS', 'FLOWERS', 'BAKERY', 'DELI'];
const ROOFS = ['#c4704a', '#d9c193', '#e9e4d6', '#5f9c8e', '#6d7c8c', '#b85c4e', '#d8b25c'];

export function blockKind(bx, by) {
  if (bx === 3 && by === 3) return 'plaza';
  if (bx === 3 && by === 2) return 'bank';
  if (bx === 5 && by === 0) return 'park';
  if (bx === 6 && by === 4) return 'chop';
  if (bx === 6 && by >= 2 && by <= 5) return 'port';
  if (bx === 1 && by === 5) return 'garage';
  if (bx === 0 && by === 0) return 'safehouse';
  if (bx === 1 && by === 2) return 'hospital';
  if (bx === 4 && by === 1) return 'police';
  if (bx === 5 && by === 2) return 'diner';
  if (bx === 5 && by === 5) return 'paint';
  if (bx === 3 && by === 6) return 'hotel';
  if (bx === 6 && by === 6) return 'marina';
  if (bx >= 2 && bx <= 4 && by >= 2 && by <= 4) return 'tower';
  if (by === 6) return 'beach';
  if (bx <= 1) return 'houses';
  return 'mixed';
}

export function generateCity(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const trees = [];
  const props = [];
  const rects = [];
  const circles = [];
  const parking = [];
  const locations = [];
  const stashes = [];

  function addBuilding(b) {
    buildings.push(b);
    rects.push({ x: b.x - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 });
    return b;
  }
  function addTree(x, y, kind) {
    const t = { x, y, r: kind === 'palm' ? 15 : 17 + rng() * 8, kind, phase: rng() * 6.28, seed: rng() };
    trees.push(t);
    circles.push({ x, y, r: 6 });
    return t;
  }
  function addProp(p) {
    props.push(p);
    return p;
  }
  function addRectCollider(x, y, w, h) {
    rects.push({ x, y, w, h });
  }
  function addCircleCollider(x, y, r) {
    circles.push({ x, y, r });
  }

  function scatterTrees(rect, count, inset) {
    for (let i = 0; i < count; i += 1) {
      const x = rect.x + inset + rng() * (rect.w - inset * 2);
      const y = rect.y + inset + rng() * (rect.h - inset * 2);
      if (buildings.some((b) => x > b.x - 26 && x < b.x + b.w + 26 && y > b.y - 26 && y < b.y + b.h + 26)) continue;
      addTree(x, y, rng() < 0.25 ? 'palm' : 'oak');
    }
  }

  function yardTrees(rect) {
    // A loose ring of trees just inside the sidewalk, clear of the ped loop.
    const n = 6 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i += 1) {
      const edge = Math.floor(rng() * 4);
      const t = rng();
      const inset = 46 + rng() * 14;
      let x = rect.x + inset;
      let y = rect.y + inset;
      if (edge === 0) { x = rect.x + inset + t * (rect.w - inset * 2); y = rect.y + inset; }
      if (edge === 1) { x = rect.x + rect.w - inset; y = rect.y + inset + t * (rect.h - inset * 2); }
      if (edge === 2) { x = rect.x + inset + t * (rect.w - inset * 2); y = rect.y + rect.h - inset; }
      if (edge === 3) { x = rect.x + inset; y = rect.y + inset + t * (rect.h - inset * 2); }
      if (buildings.some((b) => x > b.x - 24 && x < b.x + b.w + 24 && y > b.y - 24 && y < b.y + b.h + 24)) continue;
      addTree(x, y, rng() < 0.3 ? 'palm' : 'oak');
    }
  }

  function buildTowerBlock(rect) {
    const n = rng() < 0.5 ? 1 : 2;
    if (n === 1) {
      const w = 210 + rng() * 60;
      const h = 200 + rng() * 60;
      addBuilding({
        x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h,
        hgt: 70 + rng() * 70, style: 'tower', roof: rng() < 0.5 ? '#86aec9' : pick(rng, ROOFS),
        wall: '#7d8894', seed: rng(), kind: 'tower',
      });
    } else {
      const w = 130 + rng() * 40;
      const h = 150 + rng() * 50;
      const gap = 46;
      addBuilding({
        x: rect.x + 52, y: rect.y + (rect.h - h) / 2, w, h,
        hgt: 60 + rng() * 60, style: 'tower', roof: pick(rng, ROOFS), wall: '#8a8478', seed: rng(), kind: 'tower',
      });
      addBuilding({
        x: rect.x + rect.w - 52 - w, y: rect.y + (rect.h - h) / 2 + (rng() < 0.5 ? -20 : 20), w, h: h - 20,
        hgt: 46 + rng() * 50, style: 'tower', roof: '#86aec9', wall: '#7d8894', seed: rng(), kind: 'tower',
      });
      void gap;
    }
    yardTrees(rect);
  }

  function buildHouses(rect) {
    const cols = 2;
    const rows = 2;
    const cw = rect.w / cols;
    const ch = rect.h / rows;
    for (let ix = 0; ix < cols; ix += 1) {
      for (let iy = 0; iy < rows; iy += 1) {
        const w = 88 + rng() * 30;
        const h = 76 + rng() * 26;
        const x = rect.x + ix * cw + (cw - w) / 2 + (rng() - 0.5) * 20;
        const y = rect.y + iy * ch + (ch - h) / 2 + (rng() - 0.5) * 20;
        addBuilding({
          x, y, w, h, hgt: 16 + rng() * 12, style: 'house',
          roof: pick(rng, ['#c4704a', '#b85c4e', '#8a6f4d', '#6d7c8c', '#a8584a']),
          wall: pick(rng, ['#e9dfc8', '#f0e9d8', '#dccfae', '#e6d3b3']), seed: rng(), kind: 'house',
        });
        if (rng() < 0.8) addTree(x + w + 26 + rng() * 14, y + h / 2, rng() < 0.4 ? 'palm' : 'oak');
        addProp({ kind: 'driveway', x: x + w / 2 - 16, y: y + h, w: 32, h: 26 });
      }
    }
  }

  function buildShops(rect, signs) {
    const n = 2 + (rng() < 0.5 ? 1 : 0);
    const slots = shuffle(rng, [0, 1, 2, 3]).slice(0, n);
    for (const edge of slots) {
      const w = edge < 2 ? 150 + rng() * 60 : 110 + rng() * 40;
      const h = edge < 2 ? 96 + rng() * 30 : 130 + rng() * 40;
      let x = rect.x + 44;
      let y = rect.y + 44;
      if (edge === 0) { x = rect.x + (rect.w - w) / 2; y = rect.y + 44; }
      if (edge === 1) { x = rect.x + rect.w - w - 44; y = rect.y + (rect.h - h) / 2; }
      if (edge === 2) { x = rect.x + (rect.w - w) / 2; y = rect.y + rect.h - h - 44; }
      if (edge === 3) { x = rect.x + 44; y = rect.y + (rect.h - h) / 2; }
      const sign = signs.length ? signs.splice(Math.floor(rng() * signs.length), 1)[0] : pick(rng, SHOP_SIGNS);
      addBuilding({
        x, y, w, h, hgt: 20 + rng() * 14, style: 'shop', roof: pick(rng, ROOFS),
        wall: pick(rng, ['#ddd3ba', '#e6ddc8', '#cfc4a8']), seed: rng(), kind: 'shop',
        sign, signColor: pick(rng, ['#e0483e', '#2b7a4b', '#3a6fd8', '#d88a1e', '#7a4ba0']),
      });
    }
    yardTrees(rect);
  }

  function buildPortBlock(rect) {
    const w = 240 + rng() * 40;
    const h = 130 + rng() * 40;
    addBuilding({
      x: rect.x + (rect.w - w) / 2, y: rect.y + 60, w, h, hgt: 26, style: 'shed',
      roof: '#9a948a', wall: '#b0a894', seed: rng(), kind: 'shed',
    });
    const n = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i += 1) {
      const cw = 52;
      const ch = 22;
      const x = rect.x + 44 + rng() * (rect.w - 88 - cw);
      const y = rect.y + rect.h - 120 + rng() * 60;
      if (buildings.some((b) => x < b.x + b.w + 8 && x + cw > b.x - 8 && y < b.y + b.h + 8 && y + ch > b.y - 8)) continue;
      addProp({ kind: 'container', x, y, w: cw, h: ch, color: pick(rng, ['#c65a3a', '#3a7ab8', '#4d9a4d', '#c9a13a', '#7a6a9a']), seed: rng() });
      addRectCollider(x, y, cw, ch);
    }
    for (let i = 0; i < 4; i += 1) {
      addProp({ kind: 'crate', x: rect.x + 40 + rng() * (rect.w - 80), y: rect.y + rect.h - 60 + rng() * 20, s: 16 + rng() * 8, seed: rng() });
    }
  }

  function buildPark(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    addProp({ kind: 'pond', x: cx, y: cy, rx: 74, ry: 52 });
    addCircleCollider(cx, cy, 62);
    addProp({ kind: 'path', x: rect.x + 40, y: cy - 8, w: rect.w - 80, h: 16 });
    addProp({ kind: 'path', x: cx - 8, y: rect.y + 40, w: 16, h: rect.h - 80 });
    for (let i = 0; i < 16; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = 110 + rng() * 60;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.82;
      if (x < rect.x + 34 || x > rect.x + rect.w - 34 || y < rect.y + 34 || y > rect.y + rect.h - 34) continue;
      addTree(x, y, rng() < 0.2 ? 'palm' : 'oak');
    }
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      addProp({ kind: 'bench', x: cx + Math.cos(a) * 96, y: cy + Math.sin(a) * 78, angle: a + Math.PI / 2 });
    }
    addProp({ kind: 'fountainSmall', x: cx, y: cy });
  }

  function buildPlaza(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    addProp({ kind: 'plazaFloor', x: rect.x + 30, y: rect.y + 30, w: rect.w - 60, h: rect.h - 60 });
    addProp({ kind: 'fountain', x: cx, y: cy, r: 34 });
    addCircleCollider(cx, cy, 36);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      addProp({ kind: 'flag', x: cx + Math.cos(a) * 120, y: cy + Math.sin(a) * 120, color: pick(rng, ['#e0483e', '#3a6fd8', '#f2c14e', '#2b7a4b']) });
      addCircleCollider(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, 4);
      addProp({ kind: 'bench', x: cx + Math.cos(a + 0.5) * 88, y: cy + Math.sin(a + 0.5) * 88, angle: a + 0.5 + Math.PI / 2 });
    }
    for (let i = 0; i < 6; i += 1) {
      const a = rng() * Math.PI * 2;
      addTree(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, 'palm');
    }
  }

  function buildSpecial(rect, kind) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (kind === 'bank') {
      addBuilding({
        x: cx - 120, y: cy - 90, w: 240, h: 180, hgt: 34, style: 'bank',
        roof: '#e9e4d6', wall: '#ddd2b8', seed: rng(), kind: 'bank', sign: 'BANK',
        signColor: '#2b4a6b',
      });
      addProp({ kind: 'steps', x: cx - 70, y: cy + 90, w: 140, h: 26 });
      addTree(cx - 150, cy - 110, 'palm');
      addTree(cx + 150, cy - 110, 'palm');
      addTree(cx - 150, cy + 110, 'palm');
      addTree(cx + 150, cy + 110, 'palm');
    } else if (kind === 'hospital') {
      addBuilding({
        x: cx - 110, y: cy - 80, w: 220, h: 160, hgt: 30, style: 'office',
        roof: '#f0ece2', wall: '#e2dccb', seed: rng(), kind: 'hospital', sign: 'HOSPITAL',
        signColor: '#c23b32',
      });
      addProp({ kind: 'helipad', x: cx + 130, y: cy - 40, r: 30 });
      yardTrees(rect);
    } else if (kind === 'police') {
      addBuilding({
        x: cx - 110, y: cy - 70, w: 220, h: 140, hgt: 28, style: 'office',
        roof: '#7d8894', wall: '#c8c0ae', seed: rng(), kind: 'police', sign: 'POLICE HQ',
        signColor: '#2b4a8f',
      });
      addProp({ kind: 'flag', x: cx, y: cy + 110, color: '#3a6fd8' });
      addCircleCollider(cx, cy + 110, 4);
      yardTrees(rect);
    } else if (kind === 'diner') {
      addBuilding({
        x: cx - 90, y: cy - 60, w: 180, h: 120, hgt: 18, style: 'shop',
        roof: '#c65a3a', wall: '#f0e6cf', seed: rng(), kind: 'diner', sign: 'SUNSET DINER',
        signColor: '#e0483e',
      });
      addProp({ kind: 'neon', x: cx, y: cy - 84 });
      addTree(cx - 140, cy + 90, 'palm');
      addTree(cx + 140, cy + 90, 'palm');
    } else if (kind === 'garage') {
      addBuilding({
        x: cx - 120, y: cy - 70, w: 240, h: 140, hgt: 22, style: 'shed',
        roof: '#8a8478', wall: '#b7a98f', seed: rng(), kind: 'garage', sign: "VINCE'S GARAGE",
        signColor: '#d88a1e',
      });
      addProp({ kind: 'lot', x: cx - 120, y: cy + 70, w: 240, h: 70 });
      addTree(cx - 160, cy - 100, 'oak');
      addTree(cx + 160, cy - 100, 'oak');
    } else if (kind === 'paint') {
      addBuilding({
        x: cx - 100, y: cy - 60, w: 200, h: 120, hgt: 20, style: 'shop',
        roof: '#5f9c8e', wall: '#e6ddc8', seed: rng(), kind: 'paint', sign: "LUCKY'S PAINT",
        signColor: '#7a4ba0',
      });
      addProp({ kind: 'lot', x: cx - 100, y: cy + 60, w: 200, h: 60 });
    } else if (kind === 'hotel') {
      addBuilding({
        x: cx - 130, y: cy - 80, w: 260, h: 150, hgt: 44, style: 'hotel',
        roof: '#e9e4d6', wall: '#e0d3ae', seed: rng(), kind: 'hotel', sign: 'PALM HOTEL',
        signColor: '#2b7a6b',
      });
      addProp({ kind: 'pool', x: cx - 60, y: cy + 96, w: 120, h: 44 });
      addRectCollider(cx - 60, cy + 96, 120, 44);
      for (let i = 0; i < 5; i += 1) addTree(rect.x + 50 + i * 70, rect.y + rect.h - 40, 'palm');
    } else if (kind === 'marina') {
      addBuilding({
        x: cx - 90, y: cy - 110, w: 180, h: 100, hgt: 20, style: 'shop',
        roof: '#6d7c8c', wall: '#ddd3ba', seed: rng(), kind: 'marina', sign: 'MARINA',
        signColor: '#2b6a8f',
      });
      addProp({ kind: 'lot', x: cx - 130, y: cy + 10, w: 260, h: 130 });
      addProp({ kind: 'boatDry', x: cx - 60, y: cy + 60 });
      addProp({ kind: 'boatDry', x: cx + 40, y: cy + 90 });
    } else if (kind === 'chop') {
      addBuilding({
        x: cx - 120, y: cy - 60, w: 240, h: 120, hgt: 24, style: 'shed',
        roof: '#7a7468', wall: '#a89e88', seed: rng(), kind: 'chop', sign: 'CHOP SHOP',
        signColor: '#8f2f26',
      });
      addProp({ kind: 'lot', x: cx - 120, y: cy + 60, w: 240, h: 80 });
      for (let i = 0; i < 3; i += 1) {
        addProp({ kind: 'wreck', x: cx - 90 + i * 80, y: cy + 96, angle: (rng() - 0.5) * 0.6, seed: rng() });
      }
    } else if (kind === 'safehouse') {
      addBuilding({
        x: cx - 70, y: cy - 55, w: 140, h: 110, hgt: 20, style: 'house',
        roof: '#c4704a', wall: '#f0e9d8', seed: rng(), kind: 'safehouse',
      });
      addProp({ kind: 'driveway', x: cx - 16, y: cy + 55, w: 32, h: 30 });
      addTree(cx - 120, cy - 80, 'oak');
      addTree(cx + 120, cy - 80, 'palm');
      addTree(cx + 120, cy + 90, 'oak');
    }
  }

  function buildBeachBlock(rect) {
    buildShops(rect, ['SURF', 'TACOS', 'JUICE', 'HOTEL']);
    for (let i = 0; i < 4; i += 1) addTree(rect.x + 40 + i * 90 + rng() * 30, rect.y + rect.h - 36, 'palm');
  }

  // --- Blocks -------------------------------------------------------------
  for (let bx = 0; bx < N_ROADS - 1; bx += 1) {
    for (let by = 0; by < N_ROADS - 1; by += 1) {
      const rect = blockRect(bx, by);
      const kind = blockKind(bx, by);
      if (kind === 'tower') buildTowerBlock(rect);
      else if (kind === 'houses') buildHouses(rect);
      else if (kind === 'mixed') buildShops(rect, [...SHOP_SIGNS]);
      else if (kind === 'port') buildPortBlock(rect);
      else if (kind === 'park') buildPark(rect);
      else if (kind === 'plaza') buildPlaza(rect);
      else if (kind === 'beach') buildBeachBlock(rect);
      else buildSpecial(rect, kind);
    }
  }

  // --- Beach band: promenade palms, umbrellas, boats -----------------------
  for (let x = 90; x < WORLD_W - 60; x += 170) {
    addTree(x + randInt(rng, -20, 20), BEACH_TOP + 30, 'palm');
  }
  for (let i = 0; i < 14; i += 1) {
    const x = 140 + rng() * (WORLD_W - 280);
    const y = SAND_TOP + 40 + rng() * 110;
    addProp({ kind: 'umbrella', x, y, color: pick(rng, ['#e0483e', '#f2c14e', '#3a6fd8', '#2b7a4b', '#e8843c']), seed: rng() });
    addCircleCollider(x, y, 5);
    if (rng() < 0.7) addProp({ kind: 'towel', x: x + 24, y: y + 14, angle: rng() * 3.14, color: pick(rng, ['#e8843c', '#3a6fd8', '#e0483e', '#f2c14e']) });
  }
  addProp({ kind: 'lifeguard', x: 700, y: SAND_TOP + 60 });
  addCircleCollider(700, SAND_TOP + 60, 12);
  addProp({ kind: 'lifeguard', x: WORLD_W - 700, y: SAND_TOP + 60 });
  addCircleCollider(WORLD_W - 700, SAND_TOP + 60, 12);
  for (let i = 0; i < 5; i += 1) {
    addProp({ kind: 'boat', x: 260 + i * 640 + rng() * 200, y: WATER_TOP + 70 + rng() * 90, angle: (rng() - 0.5) * 0.8, phase: rng() * 6.28, seed: rng() });
  }
  addRectCollider(-60, WATER_TOP + 8, WORLD_W + 120, BEACH_BAND);

  // --- Street furniture: lamps at intersections, hydrants, bus stops ------
  for (let i = 0; i < N_ROADS; i += 1) {
    for (let j = 0; j < N_ROADS; j += 1) {
      const cx = roadCenter(i);
      const cy = roadCenter(j);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + dx * (ROAD / 2 + 8);
        const y = cy + dy * (ROAD / 2 + 8);
        addProp({ kind: 'lamp', x, y });
        addCircleCollider(x, y, 4);
      }
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const vertical = rng() < 0.5;
    const road = Math.floor(rng() * N_ROADS);
    const along = MARGIN + rng() * (WORLD_W - MARGIN * 2);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? roadCenter(road) + side * (ROAD / 2 + 10) : along;
    const y = vertical ? along : roadCenter(road) + side * (ROAD / 2 + 10);
    addProp({ kind: 'hydrant', x, y });
    addCircleCollider(x, y, 4);
  }

  // --- Parking spots along the roads ---------------------------------------
  for (let i = 0; i < N_ROADS; i += 1) {
    for (let j = 0; j < N_ROADS - 1; j += 1) {
      const a = roadCenter(j) + ROAD / 2 + 30;
      const b = roadCenter(j + 1) - ROAD / 2 - 30;
      for (let t = a; t < b; t += 150) {
        if (rng() < 0.55) parking.push({ x: roadCenter(i) - ROAD / 2 + 11, y: t + randInt(rng, 0, 40), angle: Math.PI / 2 });
        if (rng() < 0.55) parking.push({ x: roadCenter(i) + ROAD / 2 - 11, y: t + 60 + randInt(rng, 0, 40), angle: -Math.PI / 2 });
      }
      const c = roadCenter(j) + ROAD / 2 + 30;
      const d = roadCenter(j + 1) - ROAD / 2 - 30;
      for (let t = c; t < d; t += 150) {
        if (rng() < 0.55) parking.push({ x: t + randInt(rng, 0, 40), y: roadCenter(i) - ROAD / 2 + 11, angle: 0 });
        if (rng() < 0.55) parking.push({ x: t + 60 + randInt(rng, 0, 40), y: roadCenter(i) + ROAD / 2 - 11, angle: Math.PI });
      }
    }
  }

  // --- Named locations ------------------------------------------------------
  function loc(id, name, bx, by, dx, dy, kind) {
    const r = blockRect(bx, by);
    locations.push({ id, name, x: r.x + r.w / 2 + (dx || 0), y: r.y + r.h / 2 + (dy || 0), kind });
  }
  loc('garage', "Vince's Garage", 1, 5, 0, 110, 'mission');
  loc('safehouse', 'Safehouse', 0, 0, 0, 80, 'safehouse');
  loc('hospital', 'Solmar General', 1, 2, 0, 100, 'health');
  loc('police', 'Police HQ', 4, 1, 0, 110, 'police');
  loc('bank', 'Solmar National Bank', 3, 2, 0, 120, 'bank');
  loc('diner', 'Sunset Diner', 5, 2, 0, 90, 'diner');
  loc('paint', "Lucky's Auto Paint", 5, 5, 0, 100, 'paint');
  loc('chop', 'Chop Shop', 6, 4, 0, 110, 'chop');
  loc('marina', 'Marina Bay', 6, 6, 0, 60, 'marina');
  loc('hotel', 'Palm Hotel', 3, 6, 0, 90, 'hotel');
  loc('plaza', 'Founder Plaza', 3, 3, 0, 0, 'plaza');
  loc('park', 'Jacaranda Park', 5, 0, 0, 0, 'park');

  // --- Cash stashes: tucked-away briefcases --------------------------------
  const stashSpots = [
    [5, 0, -90, -70], [6, 3, 120, 90], [3, 6, -140, 40], [2, 3, 150, 150],
    [1, 5, -150, -60], [1, 2, 150, -90], [6, 6, -130, -40], [3, 3, 130, 130],
    [0, 4, 120, 120], [4, 5, -130, -120], [5, 2, -150, 90], [2, 0, 90, 130],
  ];
  stashSpots.forEach(([bx, by, dx, dy], index) => {
    const r = blockRect(bx, by);
    stashes.push({ id: index, x: r.x + r.w / 2 + dx, y: r.y + r.h / 2 + dy, found: false });
  });

  // --- Spatial index for colliders -----------------------------------------
  const cell = 420;
  const pad = 16;
  const grid = new Map();
  function cellKey(cx, cy) {
    return cx + ',' + cy;
  }
  function indexRect(r) {
    const x0 = Math.floor((r.x - pad) / cell);
    const x1 = Math.floor((r.x + r.w + pad) / cell);
    const y0 = Math.floor((r.y - pad) / cell);
    const y1 = Math.floor((r.y + r.h + pad) / cell);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = cellKey(cx, cy);
        if (!grid.has(key)) grid.set(key, { rects: [], circles: [] });
        grid.get(key).rects.push(r);
      }
    }
  }
  function indexCircle(c) {
    const x0 = Math.floor((c.x - c.r - pad) / cell);
    const x1 = Math.floor((c.x + c.r + pad) / cell);
    const y0 = Math.floor((c.y - c.r - pad) / cell);
    const y1 = Math.floor((c.y + c.r + pad) / cell);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = cellKey(cx, cy);
        if (!grid.has(key)) grid.set(key, { rects: [], circles: [] });
        grid.get(key).circles.push(c);
      }
    }
  }
  rects.forEach(indexRect);
  circles.forEach(indexCircle);

  function nearby(x, y) {
    const key = cellKey(Math.floor(x / cell), Math.floor(y / cell));
    return grid.get(key) || { rects: [], circles: [] };
  }

  /** Push a circle out of static colliders; returns {x, y, hit}. */
  function collideCircle(x, y, r) {
    let hit = false;
    for (let pass = 0; pass < 2; pass += 1) {
      const near = nearby(x, y);
      for (const rc of near.rects) {
        const nx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
        const ny = Math.max(rc.y, Math.min(y, rc.y + rc.h));
        const dx = x - nx;
        const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 < 0.0001) {
          // Centre inside the rect: push out along the smallest overlap.
          const left = x - rc.x;
          const right = rc.x + rc.w - x;
          const top = y - rc.y;
          const bottom = rc.y + rc.h - y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = rc.x - r;
          else if (m === right) x = rc.x + rc.w + r;
          else if (m === top) y = rc.y - r;
          else y = rc.y + rc.h + r;
        } else {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        }
      }
      for (const c of near.circles) {
        const dx = x - c.x;
        const dy = y - c.y;
        const d = Math.hypot(dx, dy);
        const min = r + c.r;
        if (d >= min) continue;
        hit = true;
        if (d < 0.0001) {
          x = c.x + min;
        } else {
          x = c.x + (dx / d) * min;
          y = c.y + (dy / d) * min;
        }
      }
    }
    return { x, y, hit };
  }

  /** True when the segment crosses a building rect (sampled; for sight lines). */
  function segmentBlocked(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 26));
    for (let i = 1; i < steps; i += 1) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const y = y1 + ((y2 - y1) * i) / steps;
      const near = nearby(x, y);
      for (const rc of near.rects) {
        if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return true;
      }
    }
    return false;
  }

  /** Traffic-light state at intersection (i,j) for an axis: 'green'|'yellow'|'red'. */
  function lightState(i, j, time, axis) {
    const phase = (time + (i * 7 + j * 13) * 1.31) % LIGHT_CYCLE;
    const nsGreen = phase < 6;
    const nsYellow = phase >= 6 && phase < 7;
    const ewYellow = phase >= 13;
    if (axis === 'ns') return nsGreen ? 'green' : nsYellow ? 'yellow' : 'red';
    return !nsGreen && !nsYellow && !ewYellow ? 'green' : ewYellow ? 'yellow' : 'red';
  }

  function isOnRoad(x, y) {
    for (let i = 0; i < N_ROADS; i += 1) {
      if (Math.abs(x - roadCenter(i)) < ROAD / 2) return true;
      if (Math.abs(y - roadCenter(i)) < ROAD / 2) return true;
    }
    return false;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < N_ROADS; i += 1) {
      const c = roadCenter(i);
      const dv = Math.abs(x - c);
      if (dv < bestD) { bestD = dv; best = { x: c, y }; }
      const dh = Math.abs(y - c);
      if (dh < bestD) { bestD = dh; best = { x, y: c }; }
    }
    return best;
  }

  /** Sidewalk loop corners for block (bx,by), clockwise from top-left. */
  function sidewalkLoop(bx, by) {
    const r = blockRect(bx, by);
    const s = 13;
    return [
      { x: r.x + s, y: r.y + s },
      { x: r.x + r.w - s, y: r.y + s },
      { x: r.x + r.w - s, y: r.y + r.h - s },
      { x: r.x + s, y: r.y + r.h - s },
    ];
  }

  return {
    seed,
    buildings,
    trees,
    props,
    rects,
    circles,
    parking,
    locations,
    stashes,
    collideCircle,
    segmentBlocked,
    lightState,
    isOnRoad,
    nearestRoadPoint,
    sidewalkLoop,
    locationById(id) {
      return locations.find((l) => l.id === id);
    },
  };
}

/** Deterministic 0..1 hash of two numbers: stable decoration without storage. */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export { BEACH_TOP, BLOCK, MARGIN, N_ROADS, PITCH, ROAD, SAND_TOP, WATER_TOP, WORLD_H, WORLD_W, blockRect, roadCenter };
