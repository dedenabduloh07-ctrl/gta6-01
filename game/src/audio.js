// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// One-shots (shots, pickups, UI) plus two loops: the engine hum, whose pitch
// follows speed, and the police siren. Created lazily on the first gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Short filtered noise burst: the raw material of shots, skids, crashes. */
  function noiseBurst(duration, freq, gainValue, type) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function tone(freq, duration, gainValue, type, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }

  return {
    /** Call from any user gesture; safe to call every frame. */
    unlock() {
      if (ensure()) {
        startEngine();
        startSiren();
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Per-frame loop update: engine pitch by speed, siren wail by chase. */
    update(dt, speed, driving, chasing) {
      if (!ctx) return;
      if (engineGain) {
        const target = driving ? 0.05 + Math.min(0.09, Math.abs(speed) / 4200) : 0;
        engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 6);
        engineOsc.frequency.value = 48 + Math.abs(speed) * 0.32;
        engineFilter.frequency.value = 240 + Math.abs(speed) * 1.4;
      }
      if (sirenGain) {
        const target = chasing ? 0.045 : 0;
        sirenGain.gain.value += (target - sirenGain.gain.value) * Math.min(1, dt * 4);
        if (chasing) {
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setValueAtTime(sirenHigh ? 880 : 660, ctx.currentTime);
          }
        }
      }
    },
    gunshot() {
      if (!ensure()) return;
      noiseBurst(0.14, 1800, 0.5, 'lowpass');
      tone(120, 0.1, 0.3, 'sine', 50);
    },
    enemyShot() {
      if (!ensure()) return;
      noiseBurst(0.11, 1400, 0.28, 'lowpass');
    },
    punch() {
      if (!ensure()) return;
      noiseBurst(0.08, 500, 0.4, 'lowpass');
    },
    crash(strength) {
      if (!ensure()) return;
      noiseBurst(0.22, 700, Math.min(0.6, 0.2 + strength * 0.5), 'lowpass');
      tone(90, 0.18, 0.25, 'sine', 40);
    },
    skid() {
      if (!ensure()) return;
      noiseBurst(0.16, 2600, 0.1, 'bandpass');
    },
    explosion() {
      if (!ensure()) return;
      noiseBurst(0.7, 400, 0.7, 'lowpass');
      tone(70, 0.6, 0.5, 'sine', 28);
    },
    horn() {
      if (!ensure()) return;
      tone(370, 0.28, 0.16, 'square');
      tone(466, 0.28, 0.12, 'square');
    },
    pickup() {
      if (!ensure()) return;
      tone(880, 0.09, 0.22, 'sine');
      setTimeout(() => tone(1320, 0.12, 0.22, 'sine'), 70);
    },
    cash() {
      if (!ensure()) return;
      tone(1046, 0.08, 0.2, 'triangle');
      setTimeout(() => tone(1318, 0.08, 0.2, 'triangle'), 80);
      setTimeout(() => tone(1568, 0.14, 0.2, 'triangle'), 160);
    },
    click() {
      if (!ensure()) return;
      tone(660, 0.05, 0.14, 'triangle');
    },
    denied() {
      if (!ensure()) return;
      tone(180, 0.16, 0.2, 'sawtooth', 120);
    },
    wantedUp() {
      if (!ensure()) return;
      tone(520, 0.12, 0.2, 'square');
      setTimeout(() => tone(392, 0.18, 0.2, 'square'), 110);
    },
    missionDone() {
      if (!ensure()) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 0.24, 'triangle'), i * 110));
    },
    missionFail() {
      if (!ensure()) return;
      const notes = [392, 330, 262, 196];
      notes.forEach((n, i) => setTimeout(() => tone(n, 0.24, 0.2, 'triangle'), i * 130));
    },
    health() {
      if (!ensure()) return;
      tone(740, 0.1, 0.2, 'sine');
      setTimeout(() => tone(988, 0.16, 0.2, 'sine'), 90);
    },
  };
}
