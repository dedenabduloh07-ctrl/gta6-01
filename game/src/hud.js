// Screens and chrome: the HUD (money, debt, health, stars, weapon,
// objective, prompt, bust meter, toasts), the detailed minimap with district
// labels and the GPS route, and the title, pause, how-to and overlay panels.
// Buttons live at fixed coordinates so the scripted harness can click them.

import { DISTRICTS, FONT, PALETTE, ROADS, VIEW, WATER_TOP, WORLD } from './config.js';

const BTN_W = 280;
const BTN_H = 44;
const BTN_X = VIEW.width / 2 - BTN_W / 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function titleButtons(hasSave) {
  const rows = [{ id: 'new', label: 'NEW GAME' }];
  if (hasSave) rows.push({ id: 'continue', label: 'CONTINUE' });
  rows.push({ id: 'howto', label: 'HOW TO PLAY' });
  return rows.map((row, i) => ({ ...row, x: BTN_X, y: 358 + i * 54, w: BTN_W, h: BTN_H }));
}

export function pauseButtons() {
  return [
    { id: 'resume', label: 'RESUME', x: BTN_X, y: 358, w: BTN_W, h: BTN_H },
    { id: 'howto', label: 'HOW TO PLAY', x: BTN_X, y: 412, w: BTN_W, h: BTN_H },
    { id: 'quit', label: 'QUIT TO TITLE', x: BTN_X, y: 466, w: BTN_W, h: BTN_H },
  ];
}

export function howToButtons() {
  return [{ id: 'back', label: 'BACK', x: BTN_X, y: 592, w: BTN_W, h: BTN_H }];
}

function drawButton(ctx, btn, hover) {
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(255,211,77,0.95)' : 'rgba(12,16,24,0.88)';
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = hover ? '#141020' : '#f2efe6';
  ctx.font = `700 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  ctx.restore();
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawTitle(ctx, game, hasSave, hoverId) {
  ctx.save();
  // Darken the drifting world behind the panel.
  ctx.fillStyle = 'rgba(10,10,18,0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = 'rgba(12,16,24,0.55)';
  ctx.fillRect(0, 96, VIEW.width, 150);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `900 74px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 158);
  ctx.fillStyle = '#f2efe6';
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText('An open-world crime story in Solmar City', VIEW.width / 2, 206);
  ctx.font = `400 14px ${FONT}`;
  ctx.fillStyle = 'rgba(242,239,230,0.75)';
  ctx.fillText('Jax Rivera owes $5,000. Five jobs. One way out.', VIEW.width / 2, 232);
  for (const btn of titleButtons(hasSave)) drawButton(ctx, btn, hoverId === btn.id);
  ctx.fillStyle = 'rgba(242,239,230,0.55)';
  ctx.font = `400 12px ${FONT}`;
  ctx.fillText('Seed 20261117 · Fully offline · All art drawn in code · WASD drive, mouse aim, E interact', VIEW.width / 2, 672);
  ctx.restore();
}

export function drawHowTo(ctx, hoverId, fromPause) {
  void fromPause;
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,18,0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#f2efe6';
  ctx.font = `800 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', VIEW.width / 2, 72);
  const rows = [
    ['W A S D / Arrows', 'Walk, or drive when in a car'],
    ['Mouse', 'Aim · Click / hold to shoot'],
    ['E / F', 'Talk, get in a car, pick up, save'],
    ['Space', 'Punch on foot · Handbrake in a car'],
    ['Shift', 'Sprint'],
    ['1 / 2', 'Pistol / Rifle (unlocked in Job 3)'],
    ['H', 'Horn'],
    ['P / Esc', 'Pause'],
    ['M', 'Mute'],
    ['Enter', 'Dismiss messages'],
  ];
  ctx.font = `500 16px ${FONT}`;
  ctx.textAlign = 'left';
  const x0 = VIEW.width / 2 - 300;
  rows.forEach((row, i) => {
    const y = 122 + i * 42;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(row[0], x0, y);
    ctx.fillStyle = '#f2efe6';
    ctx.fillText(row[1], x0 + 190, y);
  });
  ctx.textAlign = 'center';
  ctx.font = `400 14px ${FONT}`;
  ctx.fillStyle = 'rgba(242,239,230,0.7)';
  ctx.fillText('Work the five jobs for Vince to clear the $5,000 debt. Lay low to lose the heat;', VIEW.width / 2, 556);
  ctx.fillText('a repaint at Pay & Spray clears your wanted level for $150.', VIEW.width / 2, 576);
  for (const btn of howToButtons()) drawButton(ctx, btn, hoverId === btn.id);
  ctx.restore();
}

export function drawPause(ctx, hoverId) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,18,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#f2efe6';
  ctx.font = `800 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW.width / 2, 268);
  for (const btn of pauseButtons()) drawButton(ctx, btn, hoverId === btn.id);
  ctx.restore();
}

export function drawOverlay(ctx, game) {
  const overlay = game.pendingOverlay;
  if (!overlay) return;
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,18,0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const w = 560;
  const h = 210 + (overlay.lines ? overlay.lines.length * 24 : 0);
  const x = VIEW.width / 2 - w / 2;
  const y = VIEW.height / 2 - h / 2;
  ctx.fillStyle = 'rgba(12,16,24,0.94)';
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = overlay.type === 'busted' || overlay.type === 'wasted' || overlay.type === 'failed' ? '#e0483e' : PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  const titleColor = overlay.type === 'busted' || overlay.type === 'wasted' ? '#e0483e' : overlay.type === 'missionIntro' ? PALETTE.gold : '#f2efe6';
  ctx.fillStyle = titleColor;
  ctx.font = `800 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(overlay.title, VIEW.width / 2, y + 52);
  ctx.fillStyle = '#f2efe6';
  ctx.font = `400 16px ${FONT}`;
  (overlay.lines || []).forEach((line, i) => {
    ctx.fillText(line, VIEW.width / 2, y + 96 + i * 24);
  });
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `600 14px ${FONT}`;
  const blink = Math.sin(game.overlayTime * 4) > -0.4;
  if (blink) ctx.fillText('PRESS ENTER', VIEW.width / 2, y + h - 26);
  ctx.restore();
}

const MM_W = 180;
const MM_H = 205;
const MM_X = VIEW.width - MM_W - 16;
const MM_Y = 16;
const MM_SCALE = Math.min(MM_W / WORLD.width, MM_H / WORLD.height);

function mmX(x) { return MM_X + x * MM_SCALE; }
function mmY(y) { return MM_Y + y * MM_SCALE; }

export function drawHUD(ctx, game) {
  const player = game.player;
  ctx.save();
  // Money, debt, health — top left.
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  rr(ctx, 16, 16, 218, 96, 8);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#7ed07e';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 30, 46);
  const debtLeft = Math.max(0, 5000 - game.missions.earned(game));
  ctx.fillStyle = debtLeft > 0 ? '#ff8a7a' : '#7ed07e';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(debtLeft > 0 ? `DEBT $${debtLeft.toLocaleString('en-US')}` : 'DEBT PAID', 30, 66);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(30, 78, 190, 8);
  ctx.fillStyle = player.health > 30 ? '#7ed07e' : '#e0483e';
  ctx.fillRect(30, 78, 190 * Math.max(0, player.health / 100), 8);
  ctx.fillStyle = 'rgba(242,239,230,0.75)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('HEALTH', 30, 102);

  // Wanted stars — top left, under the money box.
  const stars = game.police.stars;
  if (stars > 0) {
    const flash = stars >= 4 && Math.sin(game.time * 6) > 0;
    ctx.fillStyle = 'rgba(12,16,24,0.72)';
    rr(ctx, 16, 122, 158, 34, 8);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      starPath(ctx, 36 + i * 28, 139, 11);
      ctx.fillStyle = i < stars ? (flash ? '#ff6a5e' : PALETTE.gold) : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
  }

  // Weapon — bottom left.
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  rr(ctx, 16, VIEW.height - 58, 168, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#f2efe6';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(player.weapon === 'rifle' ? 'RIFLE' : 'PISTOL', 30, VIEW.height - 40);
  ctx.fillStyle = 'rgba(242,239,230,0.6)';
  ctx.font = `400 12px ${FONT}`;
  ctx.fillText(player.rifleUnlocked ? '1 / 2 to switch' : 'Rifle: finish Job 3', 30, VIEW.height - 24);

  // Speed — bottom right when driving.
  if (!player.onFoot && player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.09);
    ctx.fillStyle = 'rgba(12,16,24,0.72)';
    rr(ctx, VIEW.width - 116, VIEW.height - 58, 100, 42, 8);
    ctx.fill();
    ctx.fillStyle = '#f2efe6';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${mph}`, VIEW.width - 52, VIEW.height - 30);
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = 'rgba(242,239,230,0.6)';
    ctx.fillText('MPH', VIEW.width - 30, VIEW.height - 30);
    ctx.textAlign = 'left';
  }

  // Objective banner — bottom centre.
  const objective = game.missions.objective(game);
  const lines = [objective.instruction];
  if (objective.distance !== null) lines[0] += `  ·  ${objective.distance}m`;
  const bannerW = 520;
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  rr(ctx, VIEW.width / 2 - bannerW / 2, VIEW.height - 58, bannerW, 42, 8);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(objective.district.toUpperCase(), VIEW.width / 2, VIEW.height - 40);
  ctx.fillStyle = '#f2efe6';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(lines[0], VIEW.width / 2, VIEW.height - 22);
  ctx.textAlign = 'left';

  // Mission timer.
  if (objective.timer !== null && objective.timer !== undefined) {
    const secs = Math.max(0, Math.ceil(objective.timer));
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');
    ctx.fillStyle = secs < 15 ? '#ff6a5e' : '#f2efe6';
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${mm}:${ss}`, VIEW.width / 2, 48);
    ctx.textAlign = 'left';
  }

  // Prompt pill — above the objective banner.
  if (game.prompt) {
    ctx.font = `600 15px ${FONT}`;
    const w = ctx.measureText(game.prompt).width + 32;
    ctx.fillStyle = 'rgba(255,211,77,0.94)';
    rr(ctx, VIEW.width / 2 - w / 2, VIEW.height - 112, w, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#141020';
    ctx.textAlign = 'center';
    ctx.fillText(game.prompt, VIEW.width / 2, VIEW.height - 89);
    ctx.textAlign = 'left';
  }

  // Bust meter.
  if (game.police.bustMeter > 0.02) {
    const w = 240;
    ctx.fillStyle = 'rgba(12,16,24,0.8)';
    rr(ctx, VIEW.width / 2 - w / 2, 66, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#e0483e';
    ctx.fillRect(VIEW.width / 2 - w / 2 + 6, 72, (w - 12) * Math.min(1, game.police.bustMeter), 14);
    ctx.fillStyle = '#f2efe6';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', VIEW.width / 2, 83);
    ctx.textAlign = 'left';
  }

  // Toasts — top centre, under the timer.
  ctx.textAlign = 'center';
  game.toasts.forEach((toast, i) => {
    const alpha = Math.min(1, toast.ttl);
    ctx.globalAlpha = alpha;
    ctx.font = `600 15px ${FONT}`;
    const w = ctx.measureText(toast.text).width + 28;
    ctx.fillStyle = 'rgba(12,16,24,0.8)';
    rr(ctx, VIEW.width / 2 - w / 2, 100 + i * 30, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#f2efe6';
    ctx.fillText(toast.text, VIEW.width / 2, 118 + i * 30);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left';

  // Mute hint — bottom right corner, small.
  ctx.fillStyle = 'rgba(242,239,230,0.5)';
  ctx.font = `400 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(game.audio.isMuted() ? 'M — UNMUTE' : 'M — MUTE', VIEW.width - 16, VIEW.height - 66);
  ctx.textAlign = 'left';

  drawMinimap(ctx, game);
  ctx.restore();
}

function drawMinimap(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(12,16,24,0.78)';
  rr(ctx, MM_X - 4, MM_Y - 4, MM_W + 8, MM_H + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(MM_X, MM_Y, MM_W, MM_H);
  ctx.clip();
  // Land, beach, water.
  ctx.fillStyle = '#3f6b35';
  ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);
  ctx.fillStyle = '#d9bd82';
  ctx.fillRect(MM_X, mmY(3656), MM_W, mmY(WATER_TOP) - mmY(3656));
  ctx.fillStyle = '#2f6f8e';
  ctx.fillRect(MM_X, mmY(WATER_TOP), MM_W, MM_H - (mmY(WATER_TOP) - MM_Y));
  // Roads.
  ctx.strokeStyle = '#6a6a72';
  ctx.lineWidth = 3;
  for (const rx of ROADS) {
    ctx.beginPath();
    ctx.moveTo(mmX(rx), MM_Y);
    ctx.lineTo(mmX(rx), mmY(3700));
    ctx.stroke();
  }
  for (const ry of ROADS) {
    ctx.beginPath();
    ctx.moveTo(MM_X, mmY(ry));
    ctx.lineTo(MM_X + MM_W, mmY(ry));
    ctx.stroke();
  }
  // District labels.
  ctx.fillStyle = 'rgba(242,239,230,0.55)';
  ctx.font = '600 7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    ctx.fillText(d.name.toUpperCase(), mmX((d.x0 + d.x1) / 2), mmY((d.y0 + d.y1) / 2));
  }
  // Route line.
  if (game.route && game.route.length > 1) {
    ctx.strokeStyle = game.routeCombat ? PALETTE.routeCombat : PALETTE.route;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(mmX(game.route[0].x), mmY(game.route[0].y));
    for (let i = 1; i < game.route.length; i += 1) ctx.lineTo(mmX(game.route[i].x), mmY(game.route[i].y));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Markers.
  for (const marker of game.markers) {
    ctx.fillStyle = marker.label === 'PAINT' ? '#7ed07e' : marker.combat ? PALETTE.routeCombat : PALETTE.route;
    ctx.beginPath();
    ctx.arc(mmX(marker.x), mmY(marker.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots.
  if (game.police.stars > 0) {
    ctx.fillStyle = '#5aa0ff';
    for (const car of game.cars) {
      if (car.driver === 'police' && !car.dead) {
        ctx.beginPath();
        ctx.arc(mmX(car.x), mmY(car.y), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Player arrow.
  const player = game.player;
  ctx.save();
  ctx.translate(mmX(player.x), mmY(player.y));
  ctx.rotate(player.onFoot ? player.aimAngle : player.car.angle);
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#f2efe6';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', MM_X + 6, MM_Y + 14);
  ctx.beginPath();
  ctx.moveTo(MM_X + 10, MM_Y + 26);
  ctx.lineTo(MM_X + 6, MM_Y + 18);
  ctx.lineTo(MM_X + 14, MM_Y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
