const Sounds = (() => {
  let ctx = null;
  let on = true;

  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  };

  const setOn = (b) => {
    on = b;
  };

  const isOn = () => on;

  const toggle = () => {
    on = !on;
    return on;
  };

  const play = (name) => {
    if (!on) return;
    const c = ensure();
    if (!c) return;

    const now = c.currentTime;

    if (name === 'tap') {
      // 700Hz square blip 0.05s, gain 0.12
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 700;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (name === 'stroke') {
      // Chirp 500→900Hz sine 0.12s
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (name === 'correct') {
      // 3 ascending notes C5 E5 G5 sine 0.09s each
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.09;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.09);
      }
    } else if (name === 'wrong') {
      // Descending sweep 280→170Hz triangle 0.25s soft
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(170, now + 0.25);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (name === 'hint') {
      // Two gentle notes A4→E5 0.12s each
      const notes = [440, 659.25]; // A4, E5
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.12;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      }
    } else if (name === 'fanfare') {
      // Happy fanfare: C5 E5 G5 C6 + final chord, triangle+sine mix, ~1s total
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const duration = 0.15;
      for (let i = 0; i < 4; i++) {
        const t = now + i * duration;
        const osc = c.createOscillator();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = notes[i];
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + duration);
      }
      // Final chord: G5 C6 E6
      const chordNotes = [783.99, 1046.5, 1318.51]; // G5, C6, E6
      const ct = now + 4 * duration;
      for (let i = 0; i < 3; i++) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = chordNotes[i];
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.12, ct);
        gain.gain.exponentialRampToValueAtTime(0.01, ct + 0.25);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(ct);
        osc.stop(ct + 0.25);
      }
    }
  };

  return {
    ensure,
    setOn,
    isOn,
    toggle,
    play,
  };
})();
