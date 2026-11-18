// All sound is synthesised with the Web Audio API: no audio files, no network.
// Every call is guarded, so a browser without audio (or with it blocked) just
// plays silent instead of throwing. The context starts on the first user
// gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst({ duration, frequency, type, volume, slideTo }) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Silence is fine.
    }
  }

  function thump({ duration, volume, lowpass }) {
    if (!ensure()) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(duration);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(master);
      source.start();
      source.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // Silence is fine.
    }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    } catch {
      engineOsc = null;
    }
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain).connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      lfo.start();
    } catch {
      sirenOsc = null;
    }
  }

  return {
    unlock() {
      ensure();
      startEngine();
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot(rifle) {
      thump({ duration: rifle ? 0.14 : 0.1, volume: rifle ? 0.5 : 0.4, lowpass: rifle ? 2600 : 1800 });
    },
    punch() {
      thump({ duration: 0.08, volume: 0.3, lowpass: 700 });
    },
    explosion() {
      thump({ duration: 0.9, volume: 0.8, lowpass: 420 });
    },
    crash() {
      thump({ duration: 0.18, volume: 0.35, lowpass: 800 });
    },
    pickup() {
      burst({ duration: 0.12, frequency: 880, type: 'sine', volume: 0.25, slideTo: 1320 });
    },
    cash() {
      burst({ duration: 0.1, frequency: 1180, type: 'sine', volume: 0.25 });
      setTimeout(() => burst({ duration: 0.14, frequency: 1560, type: 'sine', volume: 0.25 }), 70);
    },
    click() {
      burst({ duration: 0.05, frequency: 660, type: 'sine', volume: 0.18 });
    },
    horn() {
      burst({ duration: 0.28, frequency: 392, type: 'square', volume: 0.16 });
    },
    missionDone() {
      burst({ duration: 0.12, frequency: 523, type: 'sine', volume: 0.3 });
      setTimeout(() => burst({ duration: 0.12, frequency: 659, type: 'sine', volume: 0.3 }), 110);
      setTimeout(() => burst({ duration: 0.22, frequency: 784, type: 'sine', volume: 0.3 }), 220);
    },
    busted() {
      burst({ duration: 0.4, frequency: 320, type: 'sawtooth', volume: 0.25, slideTo: 160 });
    },
    // Continuous engine hum follows the player's speed; the siren follows
    // the nearest pursuing cop. Called every frame with 0..1 levels.
    update(engineLevel, sirenLevel) {
      if (!ctx) return;
      startEngine();
      startSiren();
      try {
        if (engineGain) {
          engineGain.gain.value = muted ? 0 : engineLevel * 0.12;
          if (engineOsc) engineOsc.frequency.value = 50 + engineLevel * 90;
        }
        if (sirenGain) sirenGain.gain.value = muted ? 0 : sirenLevel * 0.05;
      } catch {
        // Silence is fine.
      }
    },
  };
}
