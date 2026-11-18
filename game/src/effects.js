// Transient visual effects: particles, floating text, skid marks and screen
// shake. Effects never change the simulation; they only make it readable.
// Everything is pooled loosely by filtering dead entries each frame.

export function createEffects() {
  return {
    particles: [],
    texts: [],
    skids: [],
    shake: 0,
  };
}

export function spawnBurst(effects, x, y, { count, color, speed, life, size, gravity }) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    effects.particles.push({
      x, y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity: gravity || 0,
    });
  }
}

export function spawnSmoke(effects, x, y) {
  effects.particles.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20,
    vy: -30 - Math.random() * 25,
    life: 0.9 + Math.random() * 0.6,
    maxLife: 1.4,
    size: 9 + Math.random() * 8,
    color: 'smoke',
    gravity: -12,
  });
}

export function spawnFire(effects, x, y) {
  effects.particles.push({
    x: x + (Math.random() - 0.5) * 14,
    y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 24,
    vy: -45 - Math.random() * 30,
    life: 0.4 + Math.random() * 0.3,
    maxLife: 0.7,
    size: 8 + Math.random() * 7,
    color: Math.random() < 0.5 ? '#ff7a2e' : '#f2c94c',
    gravity: -30,
  });
}

export function floatText(effects, x, y, text, color) {
  effects.texts.push({ x, y, text, color: color || '#f2efe6', life: 1.4 });
}

export function addShake(effects, amount) {
  effects.shake = Math.min(18, effects.shake + amount);
}

export function addSkid(effects, x, y, angle) {
  effects.skids.push({ x, y, angle, life: 5 });
  if (effects.skids.length > 220) effects.skids.splice(0, effects.skids.length - 220);
}

export function updateEffects(effects, dt) {
  for (const p of effects.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 1.4 * dt;
  }
  effects.particles = effects.particles.filter((p) => p.life > 0);
  for (const t of effects.texts) {
    t.life -= dt;
    t.y -= 34 * dt;
  }
  effects.texts = effects.texts.filter((t) => t.life > 0);
  for (const s of effects.skids) s.life -= dt;
  effects.skids = effects.skids.filter((s) => s.life > 0);
  effects.shake = Math.max(0, effects.shake - 42 * dt);
}

export function drawEffects(ctx, effects, camera) {
  void camera;
  for (const s of effects.skids) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, s.life * 0.14);
    ctx.fillStyle = '#1c1c22';
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  for (const p of effects.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    if (p.color === 'smoke') {
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = '#5a5a5e';
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of effects.texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = '#11141b';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
