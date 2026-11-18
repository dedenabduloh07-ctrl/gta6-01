// Drawing the world: ground, roads and their markings, buildings with
// height, every beach prop, cars, people, the GPS route and markers. All art
// is drawn in code — no images anywhere. The camera transform lives here;
// the HUD, minimap and menus live in hud.js.

import {
  BEACH_TOP, FONT, HIGHWAY_ROW, PALETTE, ROADS, ROAD_HALF, SIDEWALK,
  VIEW, WATER_TOP, WORLD, roadClass, roadName,
} from './config.js';
import { lightState } from './traffic.js';
import { drawEffects } from './effects.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawWorld(ctx, game) {
  const { camera, time } = game;
  const zoom = camera.zoom;
  ctx.save();
  // Logical view, then the camera, then screen shake.
  ctx.translate(VIEW.width / 2, VIEW.height / 2);
  ctx.scale(zoom, zoom);
  const shake = game.effects.shake;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(-camera.x + sx, -camera.y + sy);

  const vw = VIEW.width / zoom;
  const vh = VIEW.height / zoom;
  const vx0 = camera.x - vw / 2 - 60;
  const vy0 = camera.y - vh / 2 - 60;
  const vx1 = camera.x + vw / 2 + 60;
  const vy1 = camera.y + vh / 2 + 60;
  const inView = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  drawGround(ctx, game, vx0, vy0, vx1, vy1);
  drawRoads(ctx, game, vx0, vy0, vx1, vy1);
  drawRoute(ctx, game);
  for (const prop of game.city.props) {
    if (inView(prop.x ?? prop.x0 ?? 0, prop.y ?? prop.y0 ?? 0, 80)) drawProp(ctx, game, prop, time);
  }
  for (const stash of game.city.stashes) {
    if (!stash.taken && inView(stash.x, stash.y, 30)) drawStash(ctx, stash, time);
  }
  for (const pack of game.healthPacks) {
    if (!pack.taken && inView(pack.x, pack.y, 30)) drawHealthPack(ctx, pack, time);
  }
  // Buildings, cars and people sort by their feet so nearer things overlap.
  const drawables = [];
  for (const b of game.city.buildings) {
    if (inView(b.x + b.w / 2, b.y + b.h / 2, 160)) drawables.push({ y: b.y + b.h, draw: () => drawBuilding(ctx, b) });
  }
  for (const car of game.cars) {
    if (!car.dead && inView(car.x, car.y, 60)) drawables.push({ y: car.y, draw: () => drawCar(ctx, game, car, time) });
    else if (car.dead && inView(car.x, car.y, 60)) drawables.push({ y: car.y, draw: () => drawWreck(ctx, car) });
  }
  for (const ped of game.peds) {
    if (inView(ped.x, ped.y, 30)) drawables.push({ y: ped.y, draw: () => drawPed(ctx, ped) });
  }
  for (const foe of game.enemies) {
    if (inView(foe.x, foe.y, 30)) drawables.push({ y: foe.y, draw: () => drawEnemy(ctx, foe) });
  }
  const garage = game.city.locationById('garage');
  if (inView(garage.x, garage.y, 40)) drawables.push({ y: garage.y, draw: () => drawVince(ctx, game, garage) });
  if (game.player.onFoot && inView(game.player.x, game.player.y, 30)) {
    drawables.push({ y: game.player.y, draw: () => drawPlayer(ctx, game) });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawBullets(ctx, game);
  drawMarkers(ctx, game, time);
  drawEffects(ctx, game.effects, camera);
  ctx.restore();
}

function drawGround(ctx, game, vx0, vy0, vx1, vy1) {
  void game;
  if (vy0 < BEACH_TOP) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(vx0, vy0, vx1 - vx0, Math.min(vy1, BEACH_TOP) - vy0);
    // Mown stripes for the grass, cheap and cheerful.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    for (let y = Math.floor(vy0 / stripe) * stripe; y < Math.min(vy1, BEACH_TOP); y += stripe * 2) {
      ctx.fillRect(vx0, y, vx1 - vx0, stripe);
    }
  }
  if (vy1 > BEACH_TOP) {
    ctx.fillStyle = PALETTE.boardwalk;
    ctx.fillRect(vx0, BEACH_TOP, vx1 - vx0, 80);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = Math.floor(vx0 / 46) * 46; x < vx1; x += 46) {
      ctx.fillRect(x, BEACH_TOP, 2, 80);
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vx0, BEACH_TOP + 80, vx1 - vx0, WATER_TOP - BEACH_TOP - 80);
    ctx.fillStyle = PALETTE.sandDark;
    for (let i = 0; i < 30; i += 1) {
      const x = Math.floor(vx0 / 300) * 300 + i * 97 % 300;
      const y = BEACH_TOP + 100 + ((i * 53) % 220);
      if (x > vx0 && x < vx1 && y > vy0 && y < vy1) ctx.fillRect(x, y, 26, 4);
    }
  }
  if (vy1 > WATER_TOP) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(vx0, WATER_TOP, vx1 - vx0, vy1 - WATER_TOP);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const t = game.time;
    for (let row = 0; row < 5; row += 1) {
      const y = WATER_TOP + 24 + row * 56;
      if (y < vy0 || y > vy1) continue;
      for (let x = Math.floor(vx0 / 180) * 180; x < vx1; x += 180) {
        const wobble = Math.sin(t * 1.2 + row * 2 + x * 0.01) * 6;
        ctx.fillRect(x + wobble, y, 60, 3);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(vx0, WATER_TOP, vx1 - vx0, 3);
  }
}

function drawRoads(ctx, game, vx0, vy0, vx1, vy1) {
  // Sidewalk aprons under the roads (vertical ones stop at the water).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS) {
    if (rx > vx0 - 80 && rx < vx1 + 80) ctx.fillRect(rx - ROAD_HALF - SIDEWALK, vy0, (ROAD_HALF + SIDEWALK) * 2, Math.min(vy1, WATER_TOP) - vy0);
  }
  for (const ry of ROADS) {
    if (ry > vy0 - 80 && ry < vy1 + 80) ctx.fillRect(vx0, ry - ROAD_HALF - SIDEWALK, vx1 - vx0, (ROAD_HALF + SIDEWALK) * 2);
  }
  // Asphalt.
  for (const rx of ROADS) {
    if (rx > vx0 - 80 && rx < vx1 + 80) {
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(rx - ROAD_HALF, vy0, ROAD_HALF * 2, Math.min(vy1, BEACH_TOP + 40) - vy0);
    }
  }
  for (let j = 0; j < ROADS.length; j += 1) {
    const ry = ROADS[j];
    if (ry < vy0 - 80 || ry > vy1 + 80) continue;
    ctx.fillStyle = j === HIGHWAY_ROW ? PALETTE.asphaltDark : PALETTE.asphalt;
    ctx.fillRect(vx0, ry - ROAD_HALF, vx1 - vx0, ROAD_HALF * 2);
  }
  // Centre markings by class.
  for (let i = 0; i < ROADS.length; i += 1) {
    const rx = ROADS[i];
    if (rx < vx0 - 80 || rx > vx1 + 80) continue;
    drawCentreLine(ctx, true, i, rx, vy0, Math.min(vy1, BEACH_TOP + 40));
  }
  for (let j = 0; j < ROADS.length; j += 1) {
    const ry = ROADS[j];
    if (ry < vy0 - 80 || ry > vy1 + 80) continue;
    drawCentreLine(ctx, false, j, ry, vx0, vx1);
  }
  // Highway edge lines.
  const highwayY = ROADS[HIGHWAY_ROW];
  if (highwayY > vy0 - 80 && highwayY < vy1 + 80) {
    ctx.fillStyle = PALETTE.line;
    ctx.fillRect(vx0, highwayY - ROAD_HALF + 6, vx1 - vx0, 3);
    ctx.fillRect(vx0, highwayY + ROAD_HALF - 9, vx1 - vx0, 3);
  }
  // Stop lines and crosswalks at every intersection in view.
  ctx.fillStyle = PALETTE.line;
  for (const rx of ROADS) {
    for (const ry of ROADS) {
      if (rx < vx0 - 90 || rx > vx1 + 90 || ry < vy0 - 90 || ry > vy1 + 90) continue;
      ctx.fillRect(rx - ROAD_HALF, ry - ROAD_HALF - 4, ROAD_HALF * 2, 4);
      ctx.fillRect(rx - ROAD_HALF, ry + ROAD_HALF, ROAD_HALF * 2, 4);
      ctx.fillRect(rx - ROAD_HALF - 4, ry - ROAD_HALF, 4, ROAD_HALF * 2);
      ctx.fillRect(rx + ROAD_HALF, ry - ROAD_HALF, 4, ROAD_HALF * 2);
      ctx.fillStyle = 'rgba(232,228,214,0.55)';
      for (let k = -2; k <= 2; k += 1) {
        ctx.fillRect(rx - ROAD_HALF + 6 + k * 17, ry - ROAD_HALF - 14, 8, 10);
        ctx.fillRect(rx - ROAD_HALF + 6 + k * 17, ry + ROAD_HALF + 4, 8, 10);
      }
      ctx.fillStyle = PALETTE.line;
    }
  }
  // Lane arrows on avenues and the highway, and street-name labels.
  ctx.save();
  ctx.fillStyle = 'rgba(232,228,214,0.75)';
  for (let i = 0; i < ROADS.length; i += 1) {
    if (roadClass(true, i) === 'street') continue;
    const rx = ROADS[i];
    if (rx < vx0 - 80 || rx > vx1 + 80) continue;
    for (let y = 340; y < BEACH_TOP; y += 484) {
      if (y < vy0 - 40 || y > vy1 + 40) continue;
      drawArrow(ctx, rx, y, Math.PI / 2);
      drawArrow(ctx, rx, y + 242, -Math.PI / 2);
    }
  }
  const hy = ROADS[HIGHWAY_ROW];
  if (hy > vy0 - 80 && hy < vy1 + 80) {
    for (let x = 340; x < WORLD.width; x += 484) {
      if (x < vx0 - 40 || x > vx1 + 40) continue;
      drawArrow(ctx, x, hy, 0);
      drawArrow(ctx, x + 242, hy, Math.PI);
    }
  }
  ctx.restore();
  drawStreetLabels(ctx, vx0, vy0, vx1, vy1);
}

function drawCentreLine(ctx, vertical, index, pos, from, to) {
  const cls = roadClass(vertical, index);
  ctx.save();
  if (cls === 'highway') {
    ctx.fillStyle = PALETTE.yellow;
    if (vertical) {
      ctx.fillRect(pos - 5, from, 3, to - from);
      ctx.fillRect(pos + 2, from, 3, to - from);
    } else {
      ctx.fillRect(from, pos - 5, to - from, 3);
      ctx.fillRect(from, pos + 2, to - from, 3);
    }
  } else if (cls === 'avenue') {
    ctx.fillStyle = PALETTE.line;
    if (vertical) {
      ctx.fillRect(pos - 5, from, 3, to - from);
      ctx.fillRect(pos + 2, from, 3, to - from);
    } else {
      ctx.fillRect(from, pos - 5, to - from, 3);
      ctx.fillRect(from, pos + 2, to - from, 3);
    }
  } else {
    ctx.fillStyle = PALETTE.line;
    ctx.setLineDash([26, 30]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(pos, from);
      ctx.lineTo(pos, to);
    } else {
      ctx.moveTo(from, pos);
      ctx.lineTo(to, pos);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawArrow(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-4, -7);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-12, -3);
  ctx.lineTo(-12, 3);
  ctx.lineTo(-4, 3);
  ctx.lineTo(-4, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStreetLabels(ctx, vx0, vy0, vx1, vy1) {
  ctx.save();
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232,228,214,0.6)';
  for (let i = 0; i < ROADS.length; i += 1) {
    const rx = ROADS[i];
    if (rx < vx0 - 60 || rx > vx1 + 60) continue;
    for (let y = 420; y < BEACH_TOP; y += 968) {
      if (y < vy0 - 40 || y > vy1 + 40) continue;
      ctx.save();
      ctx.translate(rx, y);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(roadName(true, i).toUpperCase(), 0, 0);
      ctx.restore();
    }
  }
  for (let j = 0; j < ROADS.length; j += 1) {
    const ry = ROADS[j];
    if (ry < vy0 - 60 || ry > vy1 + 60) continue;
    for (let x = 420; x < WORLD.width; x += 968) {
      if (x < vx0 - 60 || x > vx1 + 60) continue;
      ctx.fillText(roadName(false, j).toUpperCase(), x, ry);
    }
  }
  ctx.restore();
}

function drawRoute(ctx, game) {
  const route = game.route;
  if (!route || route.length < 2) return;
  const combat = game.routeCombat;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([20, 15]);
  ctx.lineDashOffset = -game.time * 46;
  ctx.strokeStyle = combat ? 'rgba(255,90,78,0.35)' : 'rgba(180,107,255,0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(route[0].x, route[0].y);
  for (let i = 1; i < route.length; i += 1) ctx.lineTo(route[i].x, route[i].y);
  ctx.stroke();
  ctx.strokeStyle = combat ? PALETTE.routeCombat : PALETTE.route;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawBuilding(ctx, b) {
  const ox = b.hgt * 0.22;
  const oy = b.hgt * 0.55;
  const rx = b.x - ox;
  const ry = b.y - oy;
  ctx.fillStyle = 'rgba(40,30,20,0.22)';
  ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
  ctx.fillStyle = shade(b.wall, -26);
  ctx.beginPath();
  ctx.moveTo(rx, ry + b.h);
  ctx.lineTo(rx + b.w, ry + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(b.wall, -44);
  ctx.beginPath();
  ctx.moveTo(rx + b.w, ry);
  ctx.lineTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(rx + b.w, ry + b.h);
  ctx.closePath();
  ctx.fill();
  const wallH = oy;
  if (wallH > 12) {
    const cols = Math.max(2, Math.floor(b.w / 20));
    const rows = Math.max(1, Math.floor(wallH / 17));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const t = (cy + 0.5) / rows;
        const wx = rx + ((cx + 0.5) / cols) * b.w + ox * t - 5;
        const wy = ry + b.h + t * (b.y - ry) - 5;
        const lit = hash2(b.x + cx * 7, b.y + cy * 13) < 0.28;
        ctx.fillStyle = lit ? '#ffe9a8' : shade(b.wall, -58);
        ctx.fillRect(wx, wy, 10, 9);
      }
    }
  }
  ctx.fillStyle = b.roof;
  ctx.fillRect(rx, ry, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(rx + 3, ry + 3, b.w - 6, b.h - 6);
  const nUnits = b.style === 'tower' ? 3 : b.style === 'house' ? 1 : 2;
  for (let i = 0; i < nUnits; i += 1) {
    const ux = rx + 14 + hash2(b.x + i * 31, b.y) * (b.w - 44);
    const uy = ry + 12 + hash2(b.x, b.y + i * 17) * (b.h - 40);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(ux + 2, uy + 2, 16, 12);
    ctx.fillStyle = shade(b.roof, -30);
    ctx.fillRect(ux, uy, 16, 12);
  }
  if (b.style === 'house') {
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(rx + b.w - 22, ry + 12, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(rx + 12, ry + b.h - 22, 18, 10);
  }
  if (b.kind === 'hospital') {
    ctx.fillStyle = '#c23b32';
    const cx = rx + b.w / 2;
    const cy = ry + b.h / 2;
    ctx.fillRect(cx - 16, cy - 5, 32, 10);
    ctx.fillRect(cx - 5, cy - 16, 10, 32);
  }
  if (b.kind === 'bank') {
    ctx.fillStyle = '#e8e4d6';
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(rx + 18 + i * ((b.w - 36) / 3) - 4, ry + b.h - 16, 8, 12);
    }
    ctx.fillStyle = '#c9a83e';
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BANK', rx + b.w / 2, ry + 24);
  }
  if (b.kind === 'garage') {
    ctx.fillStyle = '#3a3a3e';
    ctx.fillRect(rx + 14, ry + b.h - 34, b.w - 28, 26);
    ctx.fillStyle = '#5a5a5e';
    for (let i = 1; i < 5; i += 1) ctx.fillRect(rx + 14, ry + b.h - 34 + i * 5, b.w - 28, 2);
  }
  if (b.kind === 'stadium') {
    ctx.strokeStyle = '#e8e4d6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(rx + b.w / 2, ry + b.h / 2, b.w / 2 - 24, b.h / 2 - 24, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawProp(ctx, game, p, time) {
  const t = time;
  if (p.kind === 'palm') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(p.x + 4, p.y + 5, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + 3, p.y - 10, p.x + 5, p.y - 18);
    ctx.stroke();
    ctx.fillStyle = '#4a8a3a';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + p.seed * 3 + Math.sin(t * 0.8 + p.seed * 9) * 0.05;
      ctx.save();
      ctx.translate(p.x + 5, p.y - 18);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(10, 0, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (p.kind === 'bench') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(-14, -5, 28, 10);
    ctx.fillStyle = '#5a4028';
    ctx.fillRect(-14, -8, 28, 3);
    ctx.restore();
  } else if (p.kind === 'fountain') {
    ctx.fillStyle = '#9a948a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fb3c9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,248,250,0.85)';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + t * 0.6;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * (p.r - 12), p.y + Math.sin(a) * (p.r - 12), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === 'hydrant') {
    ctx.fillStyle = '#c23b32';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4d6';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 3, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3a3e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2e8b8';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'light') {
    const state = lightState(p.phase, game.time);
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(p.x + ROAD_HALF - 2, p.y - ROAD_HALF - 16, 7, 20);
    ctx.fillStyle = state === 'ns' || state === 'nsYellow' ? '#6ac86a' : '#e0483e';
    ctx.beginPath();
    ctx.arc(p.x + ROAD_HALF + 1.5, p.y - ROAD_HALF - 11, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(p.x + 3, p.y + 4, p.w, p.h);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let x = p.x + 8; x < p.x + p.w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.lineTo(x, p.y + p.h);
      ctx.stroke();
    }
  } else if (p.kind === 'crate') {
    ctx.fillStyle = '#a8814e';
    ctx.fillRect(p.x, p.y, p.s, p.s);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(p.x, p.y, p.s, p.s);
  } else if (p.kind === 'flag') {
    ctx.fillStyle = '#8a8f96';
    ctx.fillRect(p.x - 1, p.y - 26, 2, 26);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(p.x + 1, p.y - 26);
    ctx.lineTo(p.x + 18 + Math.sin(t * 3 + p.x) * 2, p.y - 21);
    ctx.lineTo(p.x + 1, p.y - 16);
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === 'neon') {
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(p.x - 34, p.y - 8, 68, 16);
    ctx.fillStyle = p.color;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', p.x, p.y + 1);
  } else if (p.kind === 'helipad') {
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4d6';
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', p.x, p.y + 1);
  } else if (p.kind === 'fence') {
    ctx.strokeStyle = 'rgba(90,80,60,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    ctx.setLineDash([]);
  } else if (p.kind === 'crane') {
    ctx.strokeStyle = '#c98a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 60);
    ctx.lineTo(p.x + 44, p.y - 60);
    ctx.stroke();
    ctx.strokeStyle = '#3a3a3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 36, p.y - 60);
    ctx.lineTo(p.x + 36, p.y - 30);
    ctx.stroke();
    ctx.fillStyle = '#3a3a3e';
    ctx.fillRect(p.x + 28, p.y - 30, 16, 12);
  } else if (p.kind === 'umbrella') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(p.x + 4, p.y + 5, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + p.seed;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8e4d6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'sunbather') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.seed * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(-14, -7, 28, 14);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(10, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-10, -3, 16, 6);
    ctx.restore();
  } else if (p.kind === 'sandcastle') {
    ctx.fillStyle = '#d9bd82';
    ctx.beginPath();
    ctx.moveTo(p.x - 14, p.y + 8);
    ctx.lineTo(p.x - 8, p.y - 10);
    ctx.lineTo(p.x + 8, p.y - 10);
    ctx.lineTo(p.x + 14, p.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a869';
    ctx.fillRect(p.x - 4, p.y - 18, 8, 10);
    ctx.fillStyle = '#e0483e';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 18);
    ctx.lineTo(p.x + 8, p.y - 15);
    ctx.lineTo(p.x, p.y - 12);
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === 'surfboard') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(0.5 + p.seed);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-4, -6, 8, 12);
    ctx.restore();
  } else if (p.kind === 'beachBall') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 3, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'frisbee') {
    const phase = (t * 0.5 + p.seed * 7) % 2;
    const dir = phase < 1 ? phase : 2 - phase;
    const ax = p.x - 34 + dir * 68;
    const ay = p.y - 8 - Math.sin(dir * Math.PI) * 26;
    drawBeachPerson(ctx, p.x - 40, p.y, '#3a6fd8', t + p.seed);
    drawBeachPerson(ctx, p.x + 40, p.y, '#e0483e', t + p.seed + 2);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.ellipse(ax, ay, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'volleyball') {
    ctx.strokeStyle = '#f2efe6';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 52, p.y - 36, 104, 72);
    ctx.fillStyle = '#d9bd82';
    ctx.fillRect(p.x - 2, p.y - 44, 4, 88);
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(p.x - 2, p.y - 46, 4, 4);
    ctx.fillRect(p.x - 2, p.y + 42, 4, 4);
    const cycle = (t * 0.45 + p.seed * 5) % 2;
    const dir = cycle < 1 ? cycle : 2 - cycle;
    const ballX = p.x - 34 + dir * 68;
    const ballY = p.y - 14 - Math.sin(dir * Math.PI) * 30;
    drawBeachPerson(ctx, p.x - 30, p.y - 18, '#e0483e', t + p.seed);
    drawBeachPerson(ctx, p.x + 30, p.y + 20, '#3a6fd8', t + p.seed + 1);
    drawBeachPerson(ctx, p.x - 28, p.y + 22, '#4a9a5a', t + p.seed + 2);
    drawBeachPerson(ctx, p.x + 32, p.y - 20, '#f2c94c', t + p.seed + 3);
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a6fd8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6, 0.4, 2.2);
    ctx.stroke();
  } else if (p.kind === 'vendorStall') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(p.x - 34, p.y - 14, 68, 40);
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(p.x - 36, p.y - 20, 72, 36);
    ctx.fillStyle = '#e0483e';
    for (let i = 0; i < 6; i += 1) {
      if (i % 2 === 0) ctx.fillRect(p.x - 36 + i * 12, p.y - 26, 12, 8);
    }
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(p.x - 36, p.y - 26, 72, 3);
    ctx.fillStyle = '#2b2b30';
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.food, p.x, p.y - 2);
    drawBeachPerson(ctx, p.x, p.y + 24, '#e8b98a', t);
  } else if (p.kind === 'lifeguardTower') {
    ctx.fillStyle = '#e8e4d6';
    ctx.fillRect(p.x - 10, p.y - 14, 20, 20);
    ctx.fillStyle = '#e0483e';
    ctx.beginPath();
    ctx.moveTo(p.x - 13, p.y - 14);
    ctx.lineTo(p.x + 13, p.y - 14);
    ctx.lineTo(p.x, p.y - 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(p.x - 8, p.y + 6, 3, 12);
    ctx.fillRect(p.x + 5, p.y + 6, 3, 12);
  } else if (p.kind === 'lifeguard') {
    ctx.fillStyle = '#e0483e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'swimmer') {
    const bob = Math.sin(t * 1.4 + p.phase) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'surfer') {
    const glide = Math.sin(t * 0.35 + p.phase) * 40;
    const bob = Math.sin(t * 1.1 + p.phase) * 3;
    ctx.save();
    ctx.translate(p.x + glide, p.y + bob);
    ctx.rotate(0.2);
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(-3, -12, 6, 12);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -14, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'boat') {
    const bob = Math.sin(t * 0.9 + p.phase) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.angle + Math.sin(t * 0.6 + p.phase) * 0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4d6';
    rr(ctx, -32, -10, 64, 20, 9);
    ctx.fill();
    ctx.fillStyle = p.seed > 0.5 ? '#3a6fd8' : '#e0483e';
    rr(ctx, -12, -7, 24, 14, 4);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'boatDry') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(0.15);
    ctx.fillStyle = '#d8d3c4';
    rr(ctx, -30, -9, 60, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#3a6fd8';
    rr(ctx, -10, -6, 20, 12, 3);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'wreck') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#5a5a5e';
    rr(ctx, -22, -10, 44, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#3a3a3e';
    rr(ctx, -8, -8, 16, 16, 3);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'towel') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-14, -7, 28, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-14, -7, 28, 4);
    ctx.restore();
  }
}

function drawBeachPerson(ctx, x, y, shirt, t) {
  const bob = Math.sin(t * 2.2) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(x, y + bob, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(x, y + bob - 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStash(ctx, stash, time) {
  const pulse = 1 + Math.sin(time * 3 + stash.x) * 0.15;
  ctx.save();
  ctx.translate(stash.x, stash.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#2e6b34';
  rr(ctx, -9, -6, 18, 12, 2);
  ctx.fill();
  ctx.fillStyle = '#7ed07e';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 1);
  ctx.restore();
}

function drawHealthPack(ctx, pack, time) {
  const pulse = 1 + Math.sin(time * 3 + pack.x) * 0.12;
  ctx.save();
  ctx.translate(pack.x, pack.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#f2efe6';
  rr(ctx, -10, -10, 20, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#e0483e';
  ctx.fillRect(-7, -2.5, 14, 5);
  ctx.fillRect(-2.5, -7, 5, 14);
  ctx.restore();
}

function drawCar(ctx, game, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, -car.l / 2 + 3, -car.w / 2 + 4, car.l, car.w, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1c1c22';
  const wl = car.l / 2 - 10;
  const ww = car.w / 2 - 1;
  ctx.fillRect(-wl - 5, -ww - 2, 11, 5);
  ctx.fillRect(-wl - 5, ww - 3, 11, 5);
  ctx.fillRect(wl - 6, -ww - 2, 11, 5);
  ctx.fillRect(wl - 6, ww - 3, 11, 5);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 8);
  ctx.fill();
  ctx.fillStyle = shade(car.color, 18);
  rr(ctx, -car.l / 2 + 3, -car.w / 2 + 3, car.l - 6, car.w - 6, 6);
  ctx.fill();
  if (car.driver === 'police') {
    ctx.fillStyle = '#e8e4d6';
    ctx.fillRect(-car.l / 2 + 8, -car.w / 2 + 3, car.l - 16, car.w - 6);
    ctx.fillStyle = '#1d2a38';
    ctx.fillRect(-car.l / 2 + 8, -car.w / 2 + 3, 14, car.w - 6);
    ctx.fillRect(car.l / 2 - 22, -car.w / 2 + 3, 14, car.w - 6);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#1c1c22';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-car.l / 2 + 8 + i * 7, -car.w / 2 + 3, 4, 4);
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#1c1c22';
    ctx.font = '700 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  // Cabin and glass.
  ctx.fillStyle = '#22303c';
  rr(ctx, -car.l * 0.18, -car.w / 2 + 5, car.l * 0.36, car.w - 10, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.5)';
  rr(ctx, car.l * 0.1, -car.w / 2 + 6, car.l * 0.08, car.w - 12, 2);
  ctx.fill();
  if (car.model === 'veloce') {
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(-car.l / 2 + 4, -2, car.l - 8, 4);
  }
  // Lights.
  ctx.fillStyle = '#fff8d8';
  ctx.fillRect(car.l / 2 - 4, -car.w / 2 + 3, 4, 6);
  ctx.fillRect(car.l / 2 - 4, car.w / 2 - 9, 4, 6);
  ctx.fillStyle = '#c23b32';
  ctx.fillRect(-car.l / 2, -car.w / 2 + 3, 4, 6);
  ctx.fillRect(-car.l / 2, car.w / 2 - 9, 4, 6);
  if (car.driver === 'police') {
    const phase = Math.sin(time * 9 + car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#3a6fd8';
    ctx.fillRect(-4, -car.w / 2 + 2, 8, 6);
    ctx.fillStyle = phase ? '#3a6fd8' : '#ff3b30';
    ctx.fillRect(-4, car.w / 2 - 8, 8, 6);
  }
  // Damage: dents show as dark patches as health falls.
  if (car.health < 70) {
    ctx.fillStyle = 'rgba(20,20,24,0.35)';
    ctx.beginPath();
    ctx.arc(-car.l * 0.25, -car.w * 0.2, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 40) {
    ctx.fillStyle = 'rgba(20,20,24,0.4)';
    ctx.beginPath();
    ctx.arc(car.l * 0.3, car.w * 0.2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.driver === 'player' && game.player.car === car) {
    // A soft ring so the player's car reads at a glance in a crowd.
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(time * 3) * 0.08;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.x, car.y, car.l * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWreck(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#2e2e33';
  rr(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 8);
  ctx.fill();
  ctx.fillStyle = '#1c1c22';
  rr(ctx, -car.l * 0.18, -car.w / 2 + 5, car.l * 0.36, car.w - 10, 4);
  ctx.fill();
  ctx.restore();
}

function drawPersonShape(ctx, x, y, angle, shirt, pants, skin, hair, walkPhase, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    rr(ctx, -13, -6, 26, 12, 5);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(15, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const step = Math.sin(walkPhase) * 4;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Legs stepping.
  ctx.strokeStyle = pants;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-2 - step * 0.6, 10);
  ctx.moveTo(2, 2);
  ctx.lineTo(2 + step * 0.6, 10);
  ctx.stroke();
  // Body and head.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(3, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(1, -1, 5.5, Math.PI * 0.6, Math.PI * 1.7);
  ctx.fill();
  ctx.restore();
}

function drawPed(ctx, ped) {
  drawPersonShape(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.skin, ped.hair, ped.walkPhase, ped.down);
}

function drawEnemy(ctx, foe) {
  if (foe.dead) {
    drawPersonShape(ctx, foe.x, foe.y, foe.angle, '#3a3a3e', '#2a2a2e', '#c98a5a', '#2a2a2e', 0, true);
    return;
  }
  drawPersonShape(ctx, foe.x, foe.y, foe.angle, '#2e3a4a', '#2a2a2e', '#c98a5a', '#1c1c22', foe.walkPhase, false);
  // Vest and gun.
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.rotate(foe.angle);
  ctx.fillStyle = '#c9a83e';
  ctx.fillRect(-4, -6, 8, 3);
  ctx.strokeStyle = '#1c1c22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 3);
  ctx.lineTo(18, 3);
  ctx.stroke();
  ctx.restore();
  // Health bar when hurt.
  if (foe.health < 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(foe.x - 14, foe.y - 22, 28, 4);
    ctx.fillStyle = '#e0483e';
    ctx.fillRect(foe.x - 14, foe.y - 22, 28 * Math.max(0, foe.health / 60), 4);
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  drawPersonShape(ctx, player.x, player.y, player.aimAngle, '#e8e4d6', '#2e3a4a', '#e8b98a', '#2a2a2e', player.walkPhase, false);
  // Jax's jacket stripe and gun.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aimAngle);
  ctx.fillStyle = '#e0483e';
  ctx.fillRect(-6, -8, 12, 3);
  ctx.strokeStyle = '#1c1c22';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.lineTo(player.weapon === 'rifle' ? 24 : 17, 4);
  ctx.stroke();
  ctx.restore();
}

function drawVince(ctx, game, garage) {
  drawPersonShape(ctx, garage.x, garage.y, Math.PI / 2, '#3a6fd8', '#2a2a2e', '#c98a5a', '#c9c9c9', 0, false);
  ctx.fillStyle = '#2b2b30';
  ctx.beginPath();
  ctx.arc(garage.x, garage.y - 3, 6, Math.PI, 0);
  ctx.fill();
  if (!game.missions.active && game.missions.hasNext()) {
    const bounce = Math.sin(game.time * 3) * 3;
    ctx.fillStyle = '#ffd34d';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', garage.x, garage.y - 22 + bounce);
  }
  ctx.fillStyle = 'rgba(12,16,24,0.7)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = 'VINCE';
  const w = ctx.measureText(label).width + 10;
  rr(ctx, garage.x - w / 2, garage.y + 14, w, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#f2efe6';
  ctx.fillText(label, garage.x, garage.y + 26);
}

function drawBullets(ctx, game) {
  ctx.save();
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const b of game.bullets) {
    const len = Math.hypot(b.vx, b.vy) * 0.016;
    const nx = b.vx / Math.hypot(b.vx, b.vy);
    const ny = b.vy / Math.hypot(b.vx, b.vy);
    ctx.beginPath();
    ctx.moveTo(b.x - nx * len, b.y - ny * len);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarkers(ctx, game, time) {
  for (const marker of game.markers) {
    const pulse = 1 + Math.sin(time * 4) * 0.18;
    const isPaint = marker.label === 'PAINT';
    const color = isPaint ? '#7ed07e' : marker.combat ? PALETTE.routeCombat : PALETTE.route;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    const s = 9 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12,16,24,0.72)';
    const label = marker.label || '';
    const w = ctx.measureText(label).width + 12;
    rr(ctx, marker.x - w / 2, marker.y - 52, w, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#f2efe6';
    ctx.fillText(label, marker.x, marker.y - 39);
    ctx.restore();
  }
}
