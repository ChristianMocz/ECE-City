// src/audio/sound.js
//
// 8-bit sound effects made live with Web Audio (square and triangle waves
// plus noise), so there are no sound files. Browsers only allow audio after
// a tap, so the audio context is created on the first play. Mute is saved in
// localStorage. If Web Audio is missing or blocked, the game just stays silent.
//
// Main pieces: Sfx (play(name), muted, setMuted(), context()).
// Used by: src/audio/music.js (shares the audio context), most src/ui/ and src/scene/ files.

const Sfx = (() => {
  const KEY = "ececity.muted";
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked: default to sound on */ }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // One note: frequency in Hz, start offset and length in seconds, optional pitch slide.
  function tone(freq, at, len, { type = "square", vol = 0.05, slideTo = null } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  function noise(at, len, vol = 0.08) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * len)), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    const gain = a.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(a.destination);
    src.start(t);
  }

  const SOUNDS = {
    tap:    () => tone(880, 0, 0.035, { vol: 0.025 }),
    place:  () => { tone(330, 0, 0.06); tone(495, 0.05, 0.08); },
    wire:   () => { tone(660, 0, 0.05); tone(990, 0.05, 0.07); },
    delete: () => tone(440, 0, 0.14, { slideTo: 110, vol: 0.04 }),
    click:  () => { noise(0, 0.02, 0.12); tone(1200, 0, 0.02, { vol: 0.03 }); },
    light:  () => { tone(523, 0, 0.07, { type: "triangle", vol: 0.08 }); tone(784, 0.07, 0.12, { type: "triangle", vol: 0.08 }); },
    pop:    () => { noise(0, 0.25, 0.14); tone(300, 0, 0.2, { slideTo: 60, vol: 0.05 }); },
    blip:   () => tone(587, 0, 0.06, { type: "triangle", vol: 0.07 }),
    undo:   () => tone(392, 0, 0.07, { slideTo: 330, vol: 0.035 }),
    coin:   () => { tone(988, 0, 0.05, { vol: 0.04 }); tone(1319, 0.05, 0.12, { vol: 0.04 }); },
    wrong:  () => tone(330, 0, 0.16, { type: "triangle", slideTo: 247, vol: 0.06 }),
    thunder:() => { noise(0, 0.9, 0.2); tone(70, 0, 0.8, { slideTo: 40, vol: 0.06 }); },
    gift:   () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.1, { type: "triangle", vol: 0.07 })),
    win:    () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.09, i === 5 ? 0.3 : 0.1, { vol: 0.05 })),
  };

  return {
    // The shared audio context (music uses it too), or null if there is none.
    // create = false only returns an existing one without waking it, so music
    // can check every frame without browser warnings.

    context(create = true) { try { return create ? audio() : ctx; } catch (e) { return null; } },
    play(name) {
      if (muted) return;
      try { SOUNDS[name]?.(); } catch (e) { /* no audio available: stay silent */ }
    },
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* not remembered, still works */ }
    },
  };
})();
