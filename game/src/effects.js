// Juice: particles (smoke, fire, sparks, dust), skid marks, shockwave rings,
// floating pickup texts and screen shake. Nothing here knows about rules; the
// systems feed it events and the renderer draws what it holds.

export function createEffects() {
  const particles = [];
  const skids = [];
  const rings = [];
  const texts = [];
  let trauma = 0;

  function spawn(x, y, vx, vy, life, size, color, opts) {
    if (particles.length > 420) particles.shift();
    particles.push({
      x, y, vx, vy, life, max: life, size, color,
      grow: (opts && opts.grow) || 0,
      drag: (opts && opts.drag) || 0,
      grav: (opts && opts.grav) || 0,
      fade: opts && opts.fade !== undefined ? opts.fade : true,
    });
  }

  return {
    particles,
    skids,
    rings,
    texts,
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    /** Current shake offset, recomputed per frame from decaying trauma. */
    shakeOffset(time) {
      const s = trauma * trauma * 16;
      return {
        x: Math.sin(time * 91.7) * s,
        y: Math.cos(time * 83.3) * s,
      };
    },
    addSkid(x1, y1, x2, y2) {
      if (skids.length > 500) skids.shift();
      skids.push({ x1, y1, x2, y2, life: 7 });
    },
    addRing(x, y, color, maxR) {
      rings.push({ x, y, color, r: 8, maxR: maxR || 90, life: 0.45, max: 0.45 });
    },
    addText(x, y, text, color) {
      texts.push({ x, y, text, color: color || '#f2c14e', life: 1.4, max: 1.4 });
    },
    dust(x, y, n) {
      for (let i = 0; i < (n || 4); i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 20 + Math.random() * 50;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 3 + Math.random() * 4, '#c9bd9e', { grow: 8, drag: 3 });
      }
    },
    smoke(x, y, dark) {
      spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14, -24 - Math.random() * 18, 0.9 + Math.random() * 0.7, 6 + Math.random() * 6, dark ? '#3a3a3e' : '#8a8a8e', { grow: 16, drag: 1 });
    },
    fire(x, y) {
      spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 20, -30 - Math.random() * 30, 0.3 + Math.random() * 0.25, 5 + Math.random() * 5, Math.random() < 0.5 ? '#f2802a' : '#f2c14e', { grow: 4 });
    },
    sparks(x, y, n) {
      for (let i = 0; i < (n || 8); i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 90 + Math.random() * 160;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.25, 1.5 + Math.random() * 1.5, '#ffd98a', { drag: 4, grav: 300 });
      }
    },
    explosion(x, y) {
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 220;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 6 + Math.random() * 9, ['#f2802a', '#f2c14e', '#e0483e'][i % 3], { grow: 10, drag: 2.5 });
      }
      for (let i = 0; i < 12; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 20 + Math.random() * 60;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 1.2 + Math.random() * 0.9, 10 + Math.random() * 10, '#4a4a4e', { grow: 22, drag: 1.5 });
      }
      this.addRing(x, y, '#ffd98a', 110);
      this.shake(0.7);
    },
    muzzle(x, y, angle) {
      spawn(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, Math.cos(angle) * 30, Math.sin(angle) * 30, 0.07, 7, '#ffe9a8', { fade: false });
    },
    hitPuff(x, y) {
      for (let i = 0; i < 5; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 30 + Math.random() * 60;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.2, 2.5 + Math.random() * 2, '#e8b8a0', { drag: 3 });
      }
    },
    splash(x, y) {
      for (let i = 0; i < 6; i += 1) {
        spawn(x, y, (Math.random() - 0.5) * 60, -40 - Math.random() * 50, 0.5, 2.5, '#bfe8f0', { grav: 320 });
      }
    },
    update(dt) {
      trauma = Math.max(0, trauma - dt * 1.6);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.grav * dt;
        const dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK;
        p.vy *= dragK;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.life -= dt;
        r.r += ((r.maxR - r.r) * dt * 9);
        if (r.life <= 0) rings.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 26 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
    },
  };
}
