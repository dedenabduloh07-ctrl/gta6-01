// Everything on top of the world: the HUD (health, money, wanted stars,
// objective, minimap, speed), prompts and toasts, and every menu and card
// (title, pause, how-to, mission briefs, wasted/busted). All screen space.

import { MISSION_DEBT, PALETTE, VIEW_H, VIEW_W, WATER_TOP, WORLD_H, WORLD_W, blockRect, roadCenter } from './config.js';
import { missionObjective } from './missions.js';
import { carSpeed } from './vehicles.js';
import { WEAPONS } from './weapons.js';

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

function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, 10);
  ctx.stroke();
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let minimapBase = null;

  function setView(view) {
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
  }

  function buildMinimapBase(city) {
    const mw = 200;
    const mh = Math.round((WORLD_H / WORLD_W) * mw);
    const c = document.createElement('canvas');
    c.width = mw;
    c.height = mh;
    const m = c.getContext('2d');
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    m.fillStyle = '#232833';
    m.fillRect(0, 0, mw, mh);
    m.fillStyle = '#c9b078';
    m.fillRect(0, WORLD_W * sy, mw, (WATER_TOP - WORLD_W) * sy);
    m.fillStyle = '#2e6b7a';
    m.fillRect(0, WATER_TOP * sy, mw, mh - WATER_TOP * sy);
    m.fillStyle = '#3a4152';
    for (let i = 0; i < 8; i += 1) {
      const cx = roadCenter(i) * sx;
      m.fillRect(cx - 2.5, 0, 5, WORLD_W * sy);
      const cy = roadCenter(i) * sy;
      m.fillRect(0, cy - 2.5, mw, 5);
    }
    const park = blockRect(5, 0);
    m.fillStyle = '#4a7a3a';
    m.fillRect(park.x * sx, park.y * sy, park.w * sx, park.h * sy);
    const plaza = blockRect(3, 3);
    m.fillStyle = '#8a8a92';
    m.fillRect(plaza.x * sx, plaza.y * sy, plaza.w * sx, plaza.h * sy);
    minimapBase = { canvas: c, w: mw, h: mh, sx, sy };
    void city;
  }

  function drawMinimap(g, time) {
    if (!minimapBase) buildMinimapBase(g.city);
    const { canvas: base, w: mw, h: mh, sx, sy } = minimapBase;
    const mx = 22;
    const my = VIEW_H - mh - 22;
    ctx.save();
    rr(ctx, mx, my, mw, mh, 10);
    ctx.clip();
    ctx.drawImage(base, mx, my);
    const blip = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    // Safehouse + paint shop + health.
    const safe = g.city.locationById('safehouse');
    blip(safe.x, safe.y, '#3fae5a', 4);
    if (g.police.stars > 0) {
      const paint = g.city.locationById('paint');
      blip(paint.x, paint.y, '#b46ae0', 4);
    }
    if (g.player.health < 60) {
      const hosp = g.city.locationById('hospital');
      blip(hosp.x, hosp.y, '#e8e4d6', 4);
    }
    // Mission enemies while hunting.
    if (g.missions.active) {
      for (const e of g.enemies) {
        if (e.alive && e.missionTag) blip(e.x, e.y, '#e0483e', 3);
      }
      if (g.passenger && g.passenger.state !== 'inCar') blip(g.passenger.x, g.passenger.y, '#3a6fd8', 4);
      if (g.missions.active.targetCar) blip(g.missions.active.targetCar.x, g.missions.active.targetCar.y, '#f2c14e', 4);
    }
    // Police: flashing dots.
    const flash = Math.floor(time * 5) % 2 === 0;
    for (const car of g.cars) {
      if (car.driver === 'police' && !car.dead) blip(car.x, car.y, flash ? '#3a6fd8' : '#e0483e', 4);
    }
    // Mission marker: pulsing diamond.
    for (const m of g.markers) {
      if (m.label === 'PAINT') continue;
      const px = mx + m.x * sx;
      const py = my + m.y * sy;
      const r = 5 + Math.sin(time * 4) * 1.2;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = m.color || '#f2c14e';
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    // Player arrow.
    const px = mx + g.player.x * sx;
    const py = my + g.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(g.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    rr(ctx, mx, my, mw, mh, 10);
    ctx.stroke();
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('N', mx + mw - 16, my + 6);
  }

  function drawObjective(g) {
    const obj = missionObjective(g.missions);
    const text = obj.text;
    ctx.font = `600 15px ${FONT}`;
    const tw = Math.min(360, ctx.measureText(text).width + 30);
    const w = Math.max(230, tw);
    const h = obj.timer > 0 ? 58 : 40;
    const x = VIEW_W - w - 22;
    const y = 22;
    panel(ctx, x, y, w, h);
    ctx.fillStyle = '#f2c14e';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const title = g.missions.active ? g.missions.active.mission.title.toUpperCase() : 'SOLMAR';
    ctx.fillText(title, x + 14, y + 8);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(text, x + 14, y + 24, w - 28);
    if (obj.timer > 0) {
      const mins = Math.floor(obj.timer / 60);
      const secs = Math.floor(obj.timer % 60);
      ctx.fillStyle = obj.timer < 30 ? '#ff8a5a' : '#f5f1e6';
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(`TIME ${mins}:${String(secs).padStart(2, '0')}`, x + 14, y + 40);
    }
    // Distance to the marker.
    const marker = g.markers.find((m) => m.label !== 'PAINT');
    if (marker && g.missions.active) {
      const d = Math.round(Math.hypot(marker.x - g.player.x, marker.y - g.player.y) * 0.06);
      ctx.fillStyle = '#b8b2a2';
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${d}m`, x + w - 14, y + 8);
      ctx.textAlign = 'left';
    }
  }

  function drawStatus(g, time) {
    const x = 22;
    const y = 22;
    panel(ctx, x, y, 250, 86);
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, x + 14, y + 14, 170, 15, 7);
    ctx.fill();
    const hp = Math.max(0, g.player.health / g.player.maxHealth);
    const hgrad = ctx.createLinearGradient(x + 14, 0, x + 184, 0);
    hgrad.addColorStop(0, '#5ac86a');
    hgrad.addColorStop(1, '#8fe08a');
    ctx.fillStyle = hp < 0.3 ? '#e0483e' : hgrad;
    if (hp > 0) {
      rr(ctx, x + 14, y + 14, 170 * hp, 15, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HP', x + 192, y + 22);
    // Money.
    ctx.fillStyle = '#8fe08a';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`$${Math.floor(g.player.money).toLocaleString('en-US')}`, x + 14, y + 48);
    // Wanted stars.
    const stars = g.police.stars;
    const blink = g.police.evading && Math.floor(time * 3) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      const sx = x + 16 + i * 24;
      const sy = y + 72;
      if (i < stars) {
        ctx.fillStyle = blink ? 'rgba(242,193,78,0.35)' : '#f2c14e';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        star(ctx, sx, sy, 9, true);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        star(ctx, sx, sy, 9, false);
      }
    }
  }

  function drawVehiclePanel(g) {
    if (g.player.onFoot || !g.player.car) return;
    const car = g.player.car;
    const speed = Math.round(carSpeed(car) * 0.12);
    const x = VIEW_W - 190;
    const y = VIEW_H - 92;
    panel(ctx, x, y, 168, 70);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const speedText = String(speed);
    const speedW = ctx.measureText(speedText).width;
    ctx.fillText(speedText, x + 14, y + 36);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = '#b8b2a2';
    ctx.fillText('MPH', x + 14 + speedW + 8, y + 36);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, x + 14, y + 46, 140, 9, 4);
    ctx.fill();
    const hp = Math.max(0, car.health / 100);
    ctx.fillStyle = hp < 0.3 ? '#e0483e' : '#e8b820';
    if (hp > 0) {
      rr(ctx, x + 14, y + 46, 140 * hp, 9, 4);
      ctx.fill();
    }
  }

  function drawWeaponBox(g) {
    const w = WEAPONS[g.player.weapon];
    const x = VIEW_W - 190;
    const y = VIEW_H - 172;
    panel(ctx, x, y, 168, 66);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(w.label.toUpperCase(), x + 14, y + 10);
    ctx.fillStyle = '#b8b2a2';
    ctx.font = `600 13px ${FONT}`;
    const hint = g.player.rifleOwned ? '1 Pistol · 2 Rifle' : 'Rifle unlocks later';
    ctx.fillText(hint, x + 14, y + 34, 140);
  }

  function drawOffscreenArrow(g, camera) {
    const marker = g.markers.find((m) => m.label !== 'PAINT');
    if (!marker) return;
    const sx = (marker.x - camera.x) * camera.zoom + VIEW_W / 2;
    const sy = (marker.y - camera.y) * camera.zoom + VIEW_H / 2;
    if (sx > 60 && sx < VIEW_W - 60 && sy > 60 && sy < VIEW_H - 60) return;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(ang) * 300;
    const ey = cy + Math.sin(ang) * 190;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = marker.color || '#f2c14e';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawToasts(g) {
    let y = 96;
    ctx.textAlign = 'center';
    for (const t of g.toasts) {
      const a = Math.min(1, t.life / 0.5);
      ctx.globalAlpha = a;
      ctx.font = `700 17px ${FONT}`;
      const w = ctx.measureText(t.text).width + 28;
      panel(ctx, VIEW_W / 2 - w / 2, y, w, 30);
      ctx.fillStyle = t.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, VIEW_W / 2, y + 16);
      y += 38;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawPrompt(g) {
    if (!g.prompt) return;
    ctx.font = `700 16px ${FONT}`;
    const w = ctx.measureText(g.prompt).width + 30;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 64, w, 34);
    ctx.fillStyle = '#fff6dd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.prompt, VIEW_W / 2, VIEW_H - 46);
    ctx.textAlign = 'left';
  }

  function drawDistrict(g) {
    if (g.districtTimer <= 0) return;
    const a = Math.min(1, g.districtTimer / 0.6);
    ctx.globalAlpha = a;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(g.district, 24, VIEW_H - 262);
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText(g.district, 22, VIEW_H - 264);
    ctx.globalAlpha = 1;
  }

  function drawDamage(g) {
    const low = g.player.health < 30 && g.player.alive;
    const a = Math.max(g.player.hurtTimer * 1.4, low ? 0.22 + Math.sin(g.time * 4) * 0.08 : 0);
    if (a <= 0) return;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(200,30,20,0)');
    grad.addColorStop(1, `rgba(200,30,20,${Math.min(0.55, a)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawBustMeter(g) {
    const p = g.police.bustProgress;
    if (p <= 0.05) return;
    const w = 280;
    const x = VIEW_W / 2 - w / 2;
    const y = 150;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, x, y, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#3a6fd8';
    rr(ctx, x + 3, y + 3, (w - 6) * Math.min(1, p / 1.15), 20, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUSTED?', VIEW_W / 2, y + 14);
    ctx.textAlign = 'left';
  }

  /** The in-game HUD over a rendered world. */
  function drawWorld(g, camera, time, view) {
    setView(view);
    drawStatus(g, time);
    drawObjective(g);
    drawMinimap(g, time);
    drawVehiclePanel(g);
    drawWeaponBox(g);
    drawOffscreenArrow(g, camera);
    drawToasts(g);
    drawPrompt(g);
    drawDistrict(g);
    drawBustMeter(g);
    drawDamage(g);
  }

  function drawMenuList(items, selected, cx, topY, lineH) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    items.forEach((item, i) => {
      const y = topY + i * lineH;
      const w = 320;
      if (i === selected) {
        ctx.fillStyle = 'rgba(242,193,78,0.92)';
        rr(ctx, cx - w / 2, y - 21, w, 42, 8);
        ctx.fill();
        ctx.fillStyle = '#241a10';
      } else {
        ctx.fillStyle = 'rgba(20,18,26,0.72)';
        rr(ctx, cx - w / 2, y - 21, w, 42, 8);
        ctx.fill();
        ctx.fillStyle = '#f5f1e6';
      }
      ctx.font = `700 ${i === selected ? 19 : 17}px ${FONT}`;
      ctx.fillText(item, cx, y + 1);
    });
    ctx.textAlign = 'left';
  }

  function drawLogo() {
    const cx = VIEW_W / 2;
    // Sun glow.
    const glow = ctx.createRadialGradient(cx, 168, 10, cx, 168, 210);
    glow.addColorStop(0, 'rgba(255,196,90,0.5)');
    glow.addColorStop(1, 'rgba(255,196,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 260, 0, 520, 380);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const grad = ctx.createLinearGradient(0, 96, 0, 190);
    grad.addColorStop(0, '#ffe9a8');
    grad.addColorStop(1, '#f2a14e');
    ctx.font = `900 96px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('SOLMAR', cx + 4, 186);
    ctx.fillStyle = grad;
    ctx.fillText('SOLMAR', cx, 182);
    ctx.font = `900 64px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('H E A T', cx + 3, 248);
    ctx.fillStyle = '#e8543c';
    ctx.fillText('H E A T', cx, 245);
    ctx.font = `600 19px ${FONT}`;
    ctx.fillStyle = '#fff6dd';
    ctx.fillText('An open-world crime story in a sun-soaked city', cx, 282);
    ctx.textAlign = 'left';
  }

  function drawTitle(menuItems, selected, view, hasSave, muted) {
    setView(view);
    ctx.fillStyle = 'rgba(12,10,18,0.42)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawLogo();
    drawMenuList(menuItems, selected, VIEW_W / 2, 380, 54);
    ctx.textAlign = 'center';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = 'rgba(245,241,230,0.85)';
    ctx.fillText('WASD drive & walk · Mouse aim · Click shoot · E enter / steal cars · Space punch / handbrake · P pause · M mute', VIEW_W / 2, 648);
    ctx.fillText(hasSave ? 'A saved game is waiting — Continue picks up where you left off.' : 'A wholly original game: its city, people, story and art were made for this bounty.', VIEW_W / 2, 676);
    ctx.fillText(muted ? 'Sound: OFF (M)' : 'Sound: ON (M)', VIEW_W / 2, 700 - 2);
    ctx.textAlign = 'left';
  }

  function drawPause(g, menuItems, selected, view, muted) {
    setView(view);
    ctx.fillStyle = 'rgba(12,10,18,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 560;
    const h = 470;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    panel(ctx, x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c14e';
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText('PAUSED', VIEW_W / 2, y + 52);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `600 16px ${FONT}`;
    const s = g.stats;
    const mins = Math.floor(s.timePlayed / 60);
    const debtLeft = Math.max(0, MISSION_DEBT - g.saveData.debtPaid);
    const lines = [
      `Money $${Math.floor(g.player.money).toLocaleString('en-US')}  ·  Debt left $${debtLeft.toLocaleString('en-US')}`,
      `Missions done ${s.missionsDone}/5  ·  Cash stashes ${g.saveData.stashes.length}/12`,
      `Cars stolen ${s.carsStolen}  ·  Distance driven ${(s.distanceDriven / 1000).toFixed(1)} km`,
      `Time played ${mins} min  ·  Busted ${s.timesBusted}  ·  Wasted ${s.timesWasted}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 92 + i * 26));
    ctx.fillStyle = '#b8b2a2';
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(muted ? 'Sound: OFF — press M' : 'Sound: ON — press M', VIEW_W / 2, y + 208);
    drawMenuList(menuItems, selected, VIEW_W / 2, y + 262, 50);
    ctx.textAlign = 'left';
  }

  function drawHowTo(view) {
    setView(view);
    ctx.fillStyle = 'rgba(12,10,18,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 640;
    const h = 520;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    panel(ctx, x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c14e';
    ctx.font = `900 30px ${FONT}`;
    ctx.fillText('HOW TO PLAY', VIEW_W / 2, y + 50);
    const rows = [
      ['W A S D / Arrows', 'Walk, or drive when in a car'],
      ['Mouse', 'Aim (on foot and drive-by)'],
      ['Left click', 'Shoot'],
      ['E or F', 'Get in / steal a car, talk, save, repaint'],
      ['Space', 'Punch on foot · handbrake while driving'],
      ['Shift', 'Sprint'],
      ['H', 'Horn'],
      ['1 / 2', 'Pistol / rifle (rifle unlocks in mission 3)'],
      ['P / Esc', 'Pause'],
      ['M', 'Mute'],
    ];
    ctx.textAlign = 'left';
    rows.forEach(([keys, desc], i) => {
      const ry = y + 92 + i * 30;
      ctx.fillStyle = '#f2c14e';
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(keys, x + 50, ry);
      ctx.fillStyle = '#f5f1e6';
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(desc, x + 260, ry);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b8b2a2';
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('Follow the yellow marker. Lose the cops by breaking line of sight,', VIEW_W / 2, y + 412);
    ctx.fillText("or pay for a repaint at Lucky's Auto Paint. Find all 12 cash stashes.", VIEW_W / 2, y + 436);
    ctx.fillStyle = '#f2c14e';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText('Press Enter or click to go back', VIEW_W / 2, y + 480);
    ctx.textAlign = 'left';
  }

  function drawCard(view, title, titleColor, lines, prompt, accent) {
    setView(view);
    ctx.fillStyle = 'rgba(12,10,18,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 620;
    const h = 150 + lines.length * 30 + 60;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    panel(ctx, x, y, w, h);
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, w, 5);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColor;
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText(title, VIEW_W / 2, y + 58);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = `600 17px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 100 + i * 30));
    ctx.fillStyle = '#f2c14e';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(prompt, VIEW_W / 2, y + h - 26);
    ctx.textAlign = 'left';
  }

  function drawOverlay(g, overlay, view) {
    if (!overlay) return;
    if (overlay.type === 'missionIntro') {
      const m = overlay.mission;
      drawCard(view, m.title.toUpperCase(), '#f2c14e', [...m.brief, '', `Reward: $${m.reward}`], 'Press Enter to begin', '#f2c14e');
    } else if (overlay.type === 'missionDone') {
      drawCard(view, 'MISSION COMPLETE', '#8fe08a', [overlay.title, '', `Reward: $${overlay.reward}`, `Debt left: $${overlay.debtLeft.toLocaleString('en-US')}`], 'Press Enter to continue', '#8fe08a');
    } else if (overlay.type === 'missionFail') {
      drawCard(view, 'MISSION FAILED', '#ff8a5a', [overlay.title, overlay.reason, '', 'Talk to Vince at the garage to try again.'], 'Press Enter to continue', '#ff8a5a');
    } else if (overlay.type === 'wasted') {
      drawCard(view, 'WASTED', '#e0483e', ['Jax wakes up at Solmar General.', 'Hospital bill: $200', 'Your mission, if any, has failed.'], 'Press Enter to continue', '#e0483e');
    } else if (overlay.type === 'busted') {
      drawCard(view, 'BUSTED', '#3a6fd8', ['The Solmar PD lets Jax go with a fine.', 'Fine: $200', 'Your mission, if any, has failed.'], 'Press Enter to continue', '#3a6fd8');
    } else if (overlay.type === 'ending') {
      drawCard(view, 'DEBT PAID', '#f2c14e', [
        'Five grand, one job, no more debt.',
        'Vince slides the ledger across the table and burns the page.',
        '"You drive for me now because you want to, Jax."',
        '',
        `Reward: $${overlay.reward}  ·  Solmar is yours. Free roam!`,
      ], 'Press Enter to keep playing', '#f2c14e');
    }
  }

  return { drawWorld, drawTitle, drawPause, drawHowTo, drawOverlay };
}
