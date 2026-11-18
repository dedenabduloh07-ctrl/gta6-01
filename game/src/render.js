// Drawing only: the city, its people and cars, effects and light. The world
// is drawn procedurally every frame with viewport culling; buildings get a
// 2.5D extrusion (roof lifted, walls and lit windows on the south face) so
// the city reads as a place, not a flat map.

import {
  BEACH_TOP, BLOCK, MARGIN, N_ROADS, PALETTE, PITCH, ROAD, SAND_TOP,
  VIEW_H, VIEW_W, WATER_TOP, WORLD_H, WORLD_W, blockRect, roadCenter,
} from './config.js';
import { blockKind, hash2 } from './city.js';
import { CAR_MODELS } from './vehicles.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.dpr = dpr;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    view.scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    view.ox = (window.innerWidth - VIEW_W * view.scale) / 2;
    view.oy = (window.innerHeight - VIEW_H * view.scale) / 2;
  }

  function screenToWorld(sx, sy, camera) {
    const lx = (sx - view.ox) / view.scale;
    const ly = (sy - view.oy) / view.scale;
    return {
      x: (lx - VIEW_W / 2) / camera.zoom + camera.x,
      y: (ly - VIEW_H / 2) / camera.zoom + camera.y,
    };
  }

  function drawGround(city, time, vb) {
    // Base grass.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0);
    // Grass tufts: deterministic per 46px cell.
    const cell = 46;
    const cx0 = Math.floor(vb.x0 / cell);
    const cx1 = Math.floor(vb.x1 / cell);
    const cy0 = Math.floor(vb.y0 / cell);
    const cy1 = Math.floor(vb.y1 / cell);
    ctx.strokeStyle = PALETTE.grassDry;
    ctx.lineWidth = 2;
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (let cy = cy0; cy <= cy1; cy += 1) {
        const h = hash2(cx, cy);
        if (h < 0.45) continue;
        const x = cx * cell + 10 + h * 22;
        const y = cy * cell + 12 + hash2(cy, cx) * 22;
        if (y > SAND_TOP) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y - 6);
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + 7, y - 7);
        ctx.stroke();
      }
    }

    // Beach band: promenade, sand, water.
    if (vb.y1 > BEACH_TOP) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(vb.x0, BEACH_TOP, vb.x1 - vb.x0, SAND_TOP - BEACH_TOP);
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(vb.x0, SAND_TOP, vb.x1 - vb.x0, WATER_TOP - SAND_TOP);
      ctx.fillStyle = PALETTE.sandWet;
      ctx.fillRect(vb.x0, WATER_TOP - 16, vb.x1 - vb.x0, 16);
      const grad = ctx.createLinearGradient(0, WATER_TOP, 0, WORLD_H);
      grad.addColorStop(0, PALETTE.water);
      grad.addColorStop(1, PALETTE.waterDeep);
      ctx.fillStyle = grad;
      ctx.fillRect(vb.x0, WATER_TOP, vb.x1 - vb.x0, WORLD_H - WATER_TOP);
      // Rolling foam + wave glints.
      ctx.strokeStyle = 'rgba(234,246,244,0.75)';
      ctx.lineWidth = 3;
      for (let x = Math.floor(vb.x0 / 90) * 90; x < vb.x1; x += 90) {
        const wob = Math.sin(time * 1.1 + x * 0.013) * 6;
        ctx.beginPath();
        ctx.moveTo(x, WATER_TOP + 4 + wob);
        ctx.quadraticCurveTo(x + 45, WATER_TOP - 4 + wob, x + 90, WATER_TOP + 4 + wob);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 3; row += 1) {
        const y = WATER_TOP + 44 + row * 46;
        for (let x = Math.floor(vb.x0 / 130) * 130; x < vb.x1; x += 130) {
          const off = Math.sin(time * 0.8 + row * 2 + x * 0.01) * 14;
          ctx.beginPath();
          ctx.moveTo(x + off, y);
          ctx.lineTo(x + off + 34, y);
          ctx.stroke();
        }
      }
      // Boardwalk planks.
      ctx.strokeStyle = 'rgba(120,105,80,0.5)';
      ctx.lineWidth = 1;
      for (let x = Math.floor(vb.x0 / 34) * 34; x < vb.x1; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, BEACH_TOP + 4);
        ctx.lineTo(x, SAND_TOP - 4);
        ctx.stroke();
      }
    }

    // Roads: asphalt bands + markings.
    ctx.fillStyle = PALETTE.asphalt;
    for (let i = 0; i < N_ROADS; i += 1) {
      const c = roadCenter(i);
      const vy0 = Math.max(vb.y0, 0);
      const vy1 = Math.min(vb.y1, WORLD_W);
      const hx0 = Math.max(vb.x0, 0);
      const hx1 = Math.min(vb.x1, WORLD_W);
      if (c + ROAD / 2 > vb.x0 && c - ROAD / 2 < vb.x1 && vy1 > vy0) ctx.fillRect(c - ROAD / 2, vy0, ROAD, vy1 - vy0);
      if (c + ROAD / 2 > vb.y0 && c - ROAD / 2 < vb.y1 && hx1 > hx0) ctx.fillRect(hx0, c - ROAD / 2, hx1 - hx0, ROAD);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (let i = 0; i < N_ROADS; i += 1) {
      const c = roadCenter(i);
      for (let t = MARGIN; t < WORLD_W - MARGIN; t += 56) {
        const onIntersection = ((t - MARGIN) % PITCH) < ROAD + 8;
        if (onIntersection) continue;
        if (c > vb.y0 - 4 && c < vb.y1 + 4) ctx.fillRect(t, c - 2, 30, 4);
        if (c > vb.x0 - 4 && c < vb.x1 + 4) ctx.fillRect(c - 2, t, 4, 30);
      }
    }
    // Crosswalks + stop lines at every intersection.
    ctx.fillStyle = 'rgba(233,228,210,0.85)';
    for (let i = 0; i < N_ROADS; i += 1) {
      for (let j = 0; j < N_ROADS; j += 1) {
        const cx = roadCenter(i);
        const cy = roadCenter(j);
        if (cx < vb.x0 - 80 || cx > vb.x1 + 80 || cy < vb.y0 - 80 || cy > vb.y1 + 80) continue;
        for (let s = -3; s <= 3; s += 1) {
          ctx.fillRect(cx + s * 13 - 4, cy - ROAD / 2 + 6, 8, 16);
          ctx.fillRect(cx + s * 13 - 4, cy + ROAD / 2 - 22, 8, 16);
          ctx.fillRect(cx - ROAD / 2 + 6, cy + s * 13 - 4, 16, 8);
          ctx.fillRect(cx + ROAD / 2 - 22, cy + s * 13 - 4, 16, 8);
        }
      }
    }
    // Manholes.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < N_ROADS; i += 1) {
      for (let j = 0; j < N_ROADS - 1; j += 1) {
        const mid = (roadCenter(j) + roadCenter(j + 1)) / 2;
        const h = hash2(i, j);
        if (h < 0.4) continue;
        ctx.beginPath();
        ctx.arc(roadCenter(i) + (h - 0.5) * 30, mid, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mid, roadCenter(i) + (hash2(j, i) - 0.5) * 30, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Blocks: sidewalk ring + inner ground.
    for (let bx = 0; bx < N_ROADS - 1; bx += 1) {
      for (let by = 0; by < N_ROADS - 1; by += 1) {
        const r = blockRect(bx, by);
        if (r.x > vb.x1 || r.x + r.w < vb.x0 || r.y > vb.y1 || r.y + r.h < vb.y0) continue;
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        const kind = blockKind(bx, by);
        let inner = '#8aa765';
        if (kind === 'tower' || kind === 'bank' || kind === 'police' || kind === 'hospital') inner = '#b5ac96';
        else if (kind === 'port' || kind === 'chop') inner = '#a89a7e';
        else if (kind === 'park') inner = PALETTE.park;
        else if (kind === 'plaza') inner = PALETTE.plaza;
        else if (kind === 'beach' || kind === 'hotel' || kind === 'marina') inner = '#d9c493';
        ctx.fillStyle = inner;
        ctx.fillRect(r.x + 26, r.y + 26, r.w - 52, r.h - 52);
        ctx.strokeStyle = PALETTE.curb;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      }
    }
    // World edge: keep the city fenced in.
    ctx.strokeStyle = 'rgba(60,50,35,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, WORLD_W - 16, WORLD_H - 16);
  }

  function drawProps(city, time, vb) {
    for (const p of city.props) {
      if (p.x < vb.x0 - 90 || p.x > vb.x1 + 90 || p.y < vb.y0 - 90 || p.y > vb.y1 + 90) continue;
      if (p.kind === 'driveway') {
        ctx.fillStyle = '#9a948a';
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else if (p.kind === 'lot') {
        ctx.fillStyle = '#8f8a80';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(233,228,210,0.5)';
        ctx.lineWidth = 2;
        for (let x = p.x + 24; x < p.x + p.w - 10; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, p.y + 6);
          ctx.lineTo(x, p.y + p.h - 6);
          ctx.stroke();
        }
      } else if (p.kind === 'path') {
        ctx.fillStyle = '#c2b493';
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else if (p.kind === 'plazaFloor') {
        ctx.fillStyle = '#b7ab8f';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(90,80,60,0.35)';
        ctx.lineWidth = 1;
        for (let x = p.x; x < p.x + p.w; x += 42) {
          ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
        }
        for (let y = p.y; y < p.y + p.h; y += 42) {
          ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
        }
      } else if (p.kind === 'pond') {
        ctx.fillStyle = PALETTE.water;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx - 16, p.ry - 12, 0, 0.4 + Math.sin(time * 0.7) * 0.2, 2.4);
        ctx.stroke();
      } else if (p.kind === 'pool') {
        ctx.fillStyle = '#3fb3c9';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 8, p.y + p.h / 2 + Math.sin(time * 1.4) * 3);
        ctx.lineTo(p.x + p.w - 8, p.y + p.h / 2 + Math.sin(time * 1.4 + 1) * 3);
        ctx.stroke();
        ctx.strokeStyle = '#e8e4d6';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
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
      } else if (p.kind === 'steps') {
        ctx.fillStyle = '#c8c0ae';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(90,80,60,0.4)';
        for (let y = p.y + 8; y < p.y + p.h; y += 8) {
          ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
        }
      } else if (p.kind === 'container') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(p.x + 3, p.y + 4, p.w, p.h);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        for (let x = p.x + 8; x < p.x + p.w; x += 8) {
          ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
        }
      } else if (p.kind === 'crate') {
        ctx.fillStyle = '#a8814e';
        ctx.fillRect(p.x, p.y, p.s, p.s);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(p.x, p.y, p.s, p.s);
      } else if (p.kind === 'bench') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#7a5a3c';
        ctx.fillRect(-14, -5, 28, 10);
        ctx.fillStyle = '#5a4028';
        ctx.fillRect(-14, -8, 28, 3);
        ctx.restore();
      } else if (p.kind === 'flag') {
        ctx.fillStyle = '#8a8f96';
        ctx.fillRect(p.x - 1, p.y - 26, 2, 26);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x + 1, p.y - 26);
        ctx.lineTo(p.x + 18 + Math.sin(time * 3 + p.x) * 2, p.y - 21);
        ctx.lineTo(p.x + 1, p.y - 16);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'fountain' || p.kind === 'fountainSmall') {
        const r = p.kind === 'fountain' ? p.r : 12;
        ctx.fillStyle = '#9a948a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4fb3c9';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r - 5, 0, Math.PI * 2);
        ctx.fill();
        const jets = p.kind === 'fountain' ? 5 : 3;
        ctx.fillStyle = 'rgba(230,248,250,0.85)';
        for (let i = 0; i < jets; i += 1) {
          const a = (i / jets) * Math.PI * 2 + time * 0.6;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * (r - 12), p.y + Math.sin(a) * (r - 12), 3, 0, Math.PI * 2);
          ctx.fill();
        }
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
      } else if (p.kind === 'towel') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-14, -7, 28, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-14, -7, 28, 4);
        ctx.restore();
      } else if (p.kind === 'lifeguard') {
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
      } else if (p.kind === 'boat') {
        const bob = Math.sin(time * 0.9 + p.phase) * 3;
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.rotate(p.angle + Math.sin(time * 0.6 + p.phase) * 0.03);
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
      } else if (p.kind === 'hydrant') {
        ctx.fillStyle = '#c23b32';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8e4d6';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 1, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'neon') {
        ctx.fillStyle = '#2b2b30';
        ctx.fillRect(p.x - 34, p.y - 8, 68, 16);
        ctx.fillStyle = '#ff5a4e';
        ctx.font = `700 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OPEN', p.x, p.y + 1);
      }
    }
  }

  function drawBuilding(b) {
    const ox = b.hgt * 0.22;
    const oy = b.hgt * 0.55;
    const rx = b.x - ox;
    const ry = b.y - oy;
    // Shadow.
    ctx.fillStyle = 'rgba(40,30,20,0.22)';
    ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    ctx.fillStyle = 'rgba(40,30,20,0.10)';
    ctx.fillRect(b.x + 16, b.y + 19, b.w, b.h);
    // South + east walls.
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
    // Windows on the south wall.
    const wallH = oy;
    if (wallH > 12) {
      const cols = Math.max(2, Math.floor(b.w / 20));
      const rows = Math.max(1, Math.floor(wallH / 17));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const t = (cy + 0.5) / rows;
          const wx = rx + ((cx + 0.5) / cols) * b.w + ox * t - 5;
          const wy = ry + b.h + t * (b.y + b.h - ry - b.h) - 5;
          const lit = hash2(b.x + cx * 7, b.y + cy * 13) < 0.28;
          ctx.fillStyle = lit ? '#ffe9a8' : shade(b.wall, -58);
          ctx.fillRect(wx, wy, 10, 9);
        }
      }
    }
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx + 3, ry + 3, b.w - 6, b.h - 6);
    // Roof details: AC units, vents, skylights.
    const h1 = hash2(b.x, b.y);
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
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(rx + 18 + i * ((b.w - 36) / 5) - 3, ry + b.h - 26, 6, 26);
      }
    }
    // Sign band on the south wall.
    if (b.sign && wallH > 10) {
      const bandH = Math.min(18, wallH - 2);
      const bandY = ry + b.h + (wallH - bandH) / 2;
      ctx.fillStyle = b.signColor || '#333';
      ctx.fillRect(rx + 8, bandY, b.w - 16, bandH);
      ctx.fillStyle = '#f5f1e6';
      ctx.font = `700 ${Math.min(13, bandH - 4)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, rx + b.w / 2, bandY + bandH / 2 + 1, b.w - 20);
    }
    void h1;
  }

  function drawTree(t, time) {
    if (t.kind === 'palm') {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(t.x + 6, t.y + 6, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.trunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y + 4);
      ctx.quadraticCurveTo(t.x + 3, t.y - 6, t.x + 1, t.y - 12);
      ctx.stroke();
      const sway = Math.sin(time * 0.9 + t.phase) * 0.06;
      ctx.strokeStyle = PALETTE.palm;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2 + t.phase + sway;
        ctx.beginPath();
        ctx.moveTo(t.x + 1, t.y - 12);
        ctx.quadraticCurveTo(
          t.x + 1 + Math.cos(a) * 12, t.y - 12 + Math.sin(a) * 12 - 4,
          t.x + 1 + Math.cos(a) * 22, t.y - 12 + Math.sin(a) * 22 + 3,
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#6b4a26';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 10, 2.5, 0, Math.PI * 2);
      ctx.arc(t.x + 3, t.y - 9, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.trunk;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.leafDark;
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 4, t.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.leaf;
      ctx.beginPath();
      ctx.arc(t.x + 3, t.y - 6, t.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 9, t.r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, time) {
    const spec = CAR_MODELS[car.model];
    const w = spec.w;
    const h = spec.h;
    ctx.save();
    ctx.translate(car.x, car.y);
    // Shadow (unrotated, offset).
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7);
    ctx.fill();
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#1c1c20';
    const wy = h / 2 - 2;
    const wx = w / 2 - 11;
    for (const [x, y, front] of [[wx, -wy, true], [wx, wy, true], [-wx, -wy, false], [-wx, wy, false]]) {
      ctx.save();
      ctx.translate(x, y);
      if (front) ctx.rotate(car.steerVis);
      rr(ctx, -6, -3.5, 12, 7, 3);
      ctx.fill();
      ctx.restore();
    }
    // Body.
    const body = car.burnt ? '#333336' : car.color;
    ctx.fillStyle = body;
    rr(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    rr(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.stroke();
    if (car.model === 'police' && !car.burnt) {
      ctx.fillStyle = '#e8e4d6';
      ctx.fillRect(-6, -h / 2 + 1, 14, h - 2);
    }
    if ((car.model === 'muscle' || car.model === 'veloce') && !car.burnt) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-w / 2 + 4, -3, w - 8, 6);
    }
    if (car.model === 'hauler') {
      ctx.fillStyle = shade(body, 18);
      rr(ctx, -w / 2, -h / 2 + 1, w * 0.62, h - 2, 4);
      ctx.fill();
      ctx.fillStyle = shade(body, -20);
      ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w * 0.62 - 8, h - 8);
    }
    if (car.model === 'pickup') {
      ctx.fillStyle = shade(body, -24);
      rr(ctx, -w / 2 + 3, -h / 2 + 3, w * 0.4, h - 6, 3);
      ctx.fill();
    }
    // Glass.
    ctx.fillStyle = car.burnt ? '#222226' : '#a8c8d8';
    const gw = w * 0.24;
    rr(ctx, w * 0.08, -h / 2 + 3, gw, h - 6, 3);
    ctx.fill();
    ctx.fillStyle = car.burnt ? '#222226' : '#8fb2c4';
    rr(ctx, -w * 0.32, -h / 2 + 3, gw * 0.8, h - 6, 3);
    ctx.fill();
    // Roof.
    ctx.fillStyle = car.burnt ? '#2c2c30' : shade(body, 12);
    rr(ctx, -w * 0.12, -h / 2 + 4, w * 0.26, h - 8, 4);
    ctx.fill();
    // Lights.
    ctx.fillStyle = '#fff6cf';
    ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
    ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
    ctx.fillStyle = car.brakeLight ? '#ff5a4e' : '#a83a34';
    ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
    ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
    // Taxi sign / police bar + roof text.
    if (car.model === 'taxi' && !car.burnt) {
      ctx.fillStyle = '#2b2b30';
      ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#f2c14e';
      ctx.font = `700 6px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TAXI', 0, 0);
    }
    if (car.model === 'police' && !car.burnt) {
      const phase = Math.floor(time * 6 + car.sirenPhase) % 2;
      ctx.fillStyle = phase === 0 ? '#ff4a3e' : '#3a6fd8';
      ctx.fillRect(-8, -h / 2 + 2, 7, 5);
      ctx.fillStyle = phase === 0 ? '#3a6fd8' : '#ff4a3e';
      ctx.fillRect(1, -h / 2 + 2, 7, 5);
      ctx.fillStyle = '#1c1c20';
      ctx.font = `700 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POLICE', 0, 1);
    }
    // Damage: dents + cracked glass.
    if (car.health < 62 && !car.burnt) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(-w * 0.25, -h * 0.2, 7, 0, Math.PI * 2);
      ctx.arc(w * 0.3, h * 0.25, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(p, time) {
    const bob = p.moving ? Math.sin(time * 11 + (p.phase || 0)) * 1.6 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.down) {
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.jacket;
      rr(ctx, -12, -6, 24, 12, 5);
      ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(15, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(p.angle);
    // Legs: two feet stepping.
    const step = p.moving ? Math.sin(time * 11 + (p.phase || 0)) * 4 : 0;
    ctx.fillStyle = p.pants;
    rr(ctx, -8 + step * 0.4, -7, 12, 5, 2);
    ctx.fill();
    rr(ctx, -8 - step * 0.4, 2, 12, 5, 2);
    ctx.fill();
    // Torso.
    ctx.fillStyle = p.jacket;
    rr(ctx, -9, -8, 18, 16, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-9, 4, 18, 4);
    // Arm + gun toward aim.
    if (p.aim !== undefined && p.aim !== null) {
      ctx.save();
      ctx.rotate(p.aim - p.angle);
      ctx.fillStyle = p.jacket;
      ctx.fillRect(4, -3, 10, 5);
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(14, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      if (p.armed) {
        ctx.fillStyle = '#2b2b30';
        ctx.fillRect(12, -1.5, 10, 3);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(8, -8, 3, 0, Math.PI * 2);
      ctx.arc(8, 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Head.
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(1, 0 + bob * 0.3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(-1, 0 + bob * 0.3, 6.5, Math.PI * 0.6, Math.PI * 1.45);
    ctx.arc(1, 0 + bob * 0.3, 6.5, Math.PI * 1.45, Math.PI * 0.6, true);
    ctx.fill();
    if (p.cap) {
      ctx.fillStyle = p.cap;
      ctx.beginPath();
      ctx.arc(1, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(5, -6, 5, 12);
    }
    ctx.restore();
    // Health pip for hurt hostiles.
    if (p.showHealth && p.health !== undefined && p.health < p.maxHealth) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - 13, p.y - 22, 26, 4);
      ctx.fillStyle = '#e0483e';
      ctx.fillRect(p.x - 13, p.y - 22, 26 * Math.max(0, p.health / p.maxHealth), 4);
    }
  }

  function drawMarker(m, time) {
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    // Ground ring.
    ctx.strokeStyle = m.color || '#f2c14e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 30 * pulse, 14 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242,193,78,0.14)';
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 30 * pulse, 14 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    // Light beacon.
    const grad = ctx.createLinearGradient(0, m.y - 110, 0, m.y);
    grad.addColorStop(0, 'rgba(242,193,78,0)');
    grad.addColorStop(1, 'rgba(242,193,78,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 7, m.y - 110, 14, 110);
    // Floating diamond.
    const dy = Math.sin(time * 3) * 5;
    ctx.save();
    ctx.translate(m.x, m.y - 96 + dy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = m.color || '#f2c14e';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-9, -9, 18, 7);
    ctx.restore();
    if (m.label) {
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(m.label, m.x + 1, m.y - 116 + dy + 1);
      ctx.fillStyle = '#fff6dd';
      ctx.fillText(m.label, m.x, m.y - 116 + dy);
    }
  }

  function drawPickup(pk, time) {
    const bob = Math.sin(time * 3 + pk.x * 0.01) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(255,240,180,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 16 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
    if (pk.kind === 'stash') {
      ctx.fillStyle = '#7a5a3c';
      rr(ctx, -11, -7, 22, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(-11, -1, 22, 2);
      ctx.strokeStyle = '#3a2a18';
      ctx.strokeRect(-4, -10, 8, 4);
      ctx.fillStyle = '#f2c14e';
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#f0ece2';
      rr(ctx, -10, -10, 20, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#c23b32';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillRect(-7, -3, 14, 6);
    } else if (pk.kind === 'weapon') {
      ctx.fillStyle = '#2b2b30';
      rr(ctx, -13, -3, 26, 6, 2);
      ctx.fill();
      ctx.fillRect(2, 3, 5, 7);
    } else if (pk.kind === 'cashbag') {
      ctx.fillStyle = '#3f7a4a';
      ctx.beginPath();
      ctx.arc(0, 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b5a34';
      ctx.fillRect(-4, -12, 8, 6);
      ctx.fillStyle = '#f2c14e';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 3);
    }
    ctx.restore();
  }

  function drawEffects(effects, vb) {
    // Skid marks under everything dynamic.
    for (const s of effects.skids) {
      if (s.x1 < vb.x0 - 40 || s.x1 > vb.x1 + 40 || s.y1 < vb.y0 - 40 || s.y1 > vb.y1 + 40) continue;
      ctx.strokeStyle = `rgba(20,20,24,${Math.min(0.55, s.life / 7 * 0.55)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
  }

  function drawParticles(effects, vb) {
    for (const p of effects.particles) {
      if (p.x < vb.x0 - 30 || p.x > vb.x1 + 30 || p.y < vb.y0 - 30 || p.y > vb.y1 + 30) continue;
      const a = p.fade ? Math.max(0, p.life / p.max) : 1;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of effects.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.max);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of effects.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawCloudShadows(time, vb) {
    ctx.fillStyle = 'rgba(30,40,60,0.07)';
    for (let i = 0; i < 3; i += 1) {
      const speed = 12 + i * 5;
      const span = WORLD_W + 900;
      const x = ((time * speed + i * 1400) % span) - 450;
      const y = 500 + i * 1100 + Math.sin(time * 0.1 + i) * 60;
      ctx.beginPath();
      ctx.ellipse(x, y, 340, 150, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    void vb;
  }

  function drawLighting() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, 'rgba(255,214,140,0.05)');
    grad.addColorStop(1, 'rgba(255,170,80,0.09)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    vg.addColorStop(0, 'rgba(20,10,0,0)');
    vg.addColorStop(1, 'rgba(20,10,0,0.26)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Paint one frame of the world. g holds city/entities; camera + time drive the view. */
  function draw(g, camera, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    const halfW = VIEW_W / 2 / camera.zoom;
    const halfH = VIEW_H / 2 / camera.zoom;
    const vb = { x0: camera.x - halfW - 60, y0: camera.y - halfH - 60, x1: camera.x + halfW + 60, y1: camera.y + halfH + 60 };

    drawGround(g.city, time, vb);
    drawProps(g.city, time, vb);
    // Buildings, southmost last (their walls overlap the row below).
    const visible = g.city.buildings.filter((b) => b.x + b.w > vb.x0 && b.x < vb.x1 && b.y + b.h > vb.y0 - 160 && b.y < vb.y1);
    visible.sort((a, b2) => a.y - b2.y);
    for (const b of visible) drawBuilding(b);
    drawEffects(g.effects, vb);
    for (const t of g.city.trees) {
      if (t.x < vb.x0 - 40 || t.x > vb.x1 + 40 || t.y < vb.y0 - 40 || t.y > vb.y1 + 40) continue;
      drawTree(t, time);
    }
    // Traffic lights on their poles, at lit intersections.
    for (let i = 0; i < N_ROADS; i += 1) {
      for (let j = 0; j < N_ROADS; j += 1) {
        if ((i + j) % 2 !== 0) continue;
        const cx = roadCenter(i);
        const cy = roadCenter(j);
        if (cx < vb.x0 - 60 || cx > vb.x1 + 60 || cy < vb.y0 - 60 || cy > vb.y1 + 60) continue;
        const ns = g.city.lightState(i, j, time, 'ns');
        const ew = g.city.lightState(i, j, time, 'ew');
        const px = cx + ROAD / 2 + 4;
        const py = cy - ROAD / 2 - 4;
        ctx.fillStyle = '#2b2b30';
        ctx.fillRect(px - 3, py - 14, 6, 14);
        ctx.fillStyle = ns === 'green' ? '#3fae5a' : ns === 'yellow' ? '#e8b820' : '#c23b32';
        ctx.beginPath();
        ctx.arc(px, py - 16, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2b2b30';
        ctx.fillRect(cx - ROAD / 2 - 4, cy + ROAD / 2 + 1, 6, 3);
        ctx.fillStyle = ew === 'green' ? '#3fae5a' : ew === 'yellow' ? '#e8b820' : '#c23b32';
        ctx.beginPath();
        ctx.arc(cx - ROAD / 2 - 1, cy + ROAD / 2 + 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Entities, painter-sorted by y.
    const drawables = [];
    for (const car of g.cars) drawables.push({ y: car.y, kind: 'car', ref: car });
    for (const p of g.peds) drawables.push({ y: p.y, kind: 'person', ref: p });
    for (const c of g.policeFoot) drawables.push({ y: c.y, kind: 'person', ref: c });
    for (const e of g.enemies) drawables.push({ y: e.y, kind: 'person', ref: e });
    if (g.passenger && g.passenger.state !== 'inCar') drawables.push({ y: g.passenger.y, kind: 'person', ref: g.passenger });
    if (g.player.onFoot) drawables.push({ y: g.player.y, kind: 'person', ref: g.player });
    for (const pk of g.pickups) drawables.push({ y: pk.y, kind: 'pickup', ref: pk });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.ref.x < vb.x0 - 80 || d.ref.x > vb.x1 + 80 || d.ref.y < vb.y0 - 80 || d.ref.y > vb.y1 + 80) continue;
      if (d.kind === 'car') drawCar(d.ref, time);
      else if (d.kind === 'person') drawPerson(d.ref, time);
      else drawPickup(d.ref, time);
    }
    // Bullets: short tracers.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
      ctx.stroke();
    }
    for (const m of g.markers) drawMarker(m, time);
    drawParticles(g.effects, vb);
    drawCloudShadows(time, vb);
    ctx.restore();
    drawLighting();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, screenToWorld, view };
}
