// src/audio/music.js
//
// Chiptune background music: a looping song for the title screen and one for
// each world, played live with Web Audio (no music files). Songs are written
// as scale steps in a small text format, so each world has its own key,
// speed and mood. Music starts after the first tap, stops when muted, and
// can be turned off in Settings.
//
//   melody: one token per eighth note. Scale step 0-9 (a-e go higher, a=10),
//           "." rest, "-" hold the last note.
//   chords: one scale step per bar (8 eighth notes), played by the bass.
//   drums:  one token per eighth note: k kick, s snare, h hat, . nothing.
//
// In the game, music shuffles: it starts with the current world's song, then
// after a few loops moves on to another world's song, through all 12.
//
// Main pieces: SONGS, Music (play(key), shuffle(key), stop(), setEnabled(), unlock()).
// Uses: Sfx from src/audio/sound.js for the audio context and mute.
// Used by: src/ui/title.js, src/scene/start.js, src/scene/events.js, src/scene/contexts.js.

const MUSIC_SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 4, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], minpent: [0, 3, 5, 7, 10], whole: [0, 2, 4, 6, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const SONGS = {
  title: { bpm: 138, root: 60, scale: "major", lead: "square", vol: 0.7,
    melody: "4 . 4 5 7 - 5 4 | 2 . 2 4 5 - . . | 4 . 4 5 7 - 9 7 | 8 - 7 - 6 - . . | 4 . 4 5 7 - 5 4 | 2 . 4 5 7 - 9 a | b - a - 9 7 5 4 | 7 - - - . . . .",
    chords: "0 4 5 3 0 4 3 4", drums: "k . h . s . h h" },
  sparkville: { bpm: 126, root: 67, scale: "major", lead: "square",
    melody: "0 2 4 2 5 4 2 . | 0 2 4 7 6 4 2 . | 3 5 7 5 9 7 5 . | 4 2 0 1 2 - . . | 0 2 4 2 5 4 2 . | 0 2 4 7 9 8 7 . | 8 7 6 5 4 3 2 1 | 0 - - . . . . .",
    chords: "0 0 3 4 0 0 3 0", drums: "k . h . s . h . " },
  batterybay: { bpm: 112, root: 62, scale: "minor", lead: "triangle",
    melody: "0 . 2 3 4 . 3 2 | 4 . 5 6 7 - . . | 6 . 5 4 3 . 2 1 | 2 - 4 - 2 - . . | 0 . 2 3 4 . 3 2 | 4 . 5 6 7 - 9 7 | 6 5 4 3 4 . 1 . | 0 - - - . . . .",
    chords: "0 5 3 4 0 5 3 0", drums: "k . . h s . . h" },
  solardesert: { bpm: 104, root: 64, scale: "phrygian", lead: "square",
    melody: "0 1 2 1 0 . . . | 4 3 2 3 4 - . . | 5 4 3 2 1 2 3 . | 2 1 0 - . . . . | 7 6 5 6 7 - . . | 8 7 6 5 4 5 6 . | 5 4 3 2 1 2 1 . | 0 - - - . . . .",
    chords: "0 0 1 0 0 3 1 0", drums: "k . . k s . h ." },
  mountains: { bpm: 96, root: 57, scale: "minor", lead: "triangle",
    melody: "0 - 2 - 4 - 7 - | 6 - 4 - 5 - - . | 3 - 4 - 5 - 7 - | 4 - - - . . . . | 7 - 9 - 8 - 7 - | 5 - 4 - 5 - 6 - | 7 - 6 - 4 - 2 - | 0 - - - - - . .",
    chords: "0 5 2 4 0 3 6 0", drums: "k . . . s . . ." },
  windmill: { bpm: 132, root: 65, scale: "major", lead: "square",
    melody: "4 . 2 . 0 2 4 4 | 4 . . . 1 1 1 . | 2 . 4 . 7 7 7 . | 4 2 0 2 4 4 4 . | 4 1 1 2 1 0 . . | 4 . 2 . 0 2 4 4 | 4 4 1 1 2 1 0 . | 0 - - - . . . .",
    chords: "0 4 0 0 4 0 4 0", drums: "k h s h k h s h" },
  waterfall: { bpm: 108, root: 63, scale: "major", lead: "triangle",
    melody: "0 2 4 7 4 2 0 2 | 1 3 5 8 5 3 1 3 | 2 4 6 9 6 4 2 4 | 4 3 2 1 0 - . . | 0 2 4 7 9 7 4 2 | 3 5 7 a 7 5 3 5 | 4 6 8 b 8 6 4 2 | 0 - - - . . . .",
    chords: "0 1 5 3 0 3 4 0", drums: "k . h . . . h ." },
  neon: { bpm: 120, root: 57, scale: "minor", lead: "square",
    melody: "7 . 7 . 6 . 4 . | 3 . 4 - . . . . | 7 . 7 . 9 . 8 7 | 6 - . . . . . . | 4 4 6 4 7 4 9 4 | 8 7 6 4 3 - . . | 2 3 4 6 7 9 8 7 | 7 - - - . . . .",
    chords: "0 5 6 4 0 5 3 4", drums: "k h s h k k s h" },
  tundra: { bpm: 84, root: 76, scale: "minor", lead: "triangle",
    melody: "0 - . 4 - . 2 - | . . 0 - . . . . | 5 - . 4 - . 2 - | 1 - - - . . . . | 0 - . 4 - . 7 - | . . 6 - . 4 - . | 5 - 4 - 2 - 1 - | 0 - - - - - . .",
    chords: "0 5 3 4 0 5 3 0", drums: ". . . . h . . ." },
  volcano: { bpm: 140, root: 50, scale: "minor", lead: "square",
    melody: "0 0 . 0 2 . 3 . | 4 . 3 . 2 . 0 . | 0 0 . 0 2 . 3 . | 5 . 4 . 3 . 4 . | 7 7 . 7 6 . 4 . | 5 . 4 . 3 . 2 . | 0 2 3 4 5 4 3 2 | 0 - - . . . . .",
    chords: "0 0 5 4 0 0 3 4", drums: "k k s . k k s h" },
  robot: { bpm: 128, root: 60, scale: "minpent", lead: "square",
    melody: "0 . 0 . 2 . 0 . | 3 . 2 . 0 . . . | 0 . 0 . 2 . 4 . | 3 . 2 . 3 . . . | 5 . 5 . 4 . 3 . | 2 . 3 . 4 . . . | 0 2 0 3 0 4 0 3 | 0 . . . . . . .",
    chords: "0 0 3 2 0 0 3 0", drums: "k . s . k . s s" },
  storm: { bpm: 146, root: 59, scale: "dorian", lead: "square",
    melody: "0 2 3 4 3 2 0 . | 4 5 6 7 6 5 4 . | 7 . 6 . 4 . 3 . | 4 3 2 1 0 - . . | 0 2 3 4 3 2 0 . | 4 5 6 7 9 8 7 . | 9 8 7 6 4 3 2 1 | 0 - - - . . . .",
    chords: "0 3 4 0 0 3 6 0", drums: "k h s h k h s s" },
  moon: { bpm: 92, root: 64, scale: "whole", lead: "triangle",
    melody: "0 - 2 - 4 - 3 - | 5 - - - . . . . | 4 - 3 - 2 - 1 - | 0 - - - . . . . | 6 - 5 - 4 - 5 - | 7 - - - . . . . | 6 - 4 - 2 - 1 - | 0 - - - - - . .",
    chords: "0 2 1 0 3 4 2 0", drums: ". . . . s . . ." },
};
const SONG_KEYS = Object.keys(SONGS);
const WORLD_SONGS = SONG_KEYS.filter(k => k !== "title");
const LOOPS_PER_SONG = 4; // in shuffle, play each song this many times (about a minute)

// Parse a song's melody into lead notes: [{ step, len, midi }].
function songNotes(song) {
  const scale = MUSIC_SCALES[song.scale];
  const toks = song.melody.replace(/\|/g, " ").trim().split(/\s+/);
  const notes = [];
  toks.forEach((t, i) => {
    if (t === "-") { if (notes.length && notes[notes.length - 1].step + notes[notes.length - 1].len === i) notes[notes.length - 1].len++; return; }
    if (t === ".") return;
    const d = parseInt(t, 36);
    if (!Number.isFinite(d)) return;
    const oct = Math.floor(d / scale.length), deg = d % scale.length;
    notes.push({ step: i, len: 1, midi: song.root + 12 * oct + scale[deg] });
  });
  return { notes, steps: toks.length };
}
function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

const Music = (() => {
  let current = null, enabled = true, timer = null, nextTime = 0, stepIdx = 0, master = null, parsed = null;
  // Shuffle: `anchor` is the world we started from; `queue` is what plays next.
  let shuffling = false, anchor = null, queue = [];
  const KEY = "ececity.music";
  try { enabled = localStorage.getItem(KEY) !== "0"; } catch (e) { /* storage blocked: music on */ }
  const LOOKAHEAD = 0.35;

  function ctx() { return typeof Sfx !== "undefined" ? Sfx.context(false) : null; }
  function out(a) {
    if (!master || master.context !== a) { master = a.createGain(); master.gain.value = 0.22; master.connect(a.destination); }
    return master;
  }
  function voice(a, type, freq, t, len, vol) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, len - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out(a));
    o.start(t); o.stop(t + len + 0.02);
  }
  function drum(a, kind, t) {
    if (kind === "k") { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g).connect(out(a)); o.start(t); o.stop(t + 0.16); return; }
    const len = kind === "s" ? 0.12 : 0.03;
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * len)), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), g = a.createGain();
    g.gain.value = kind === "s" ? 0.22 : 0.08;
    src.buffer = buf; src.connect(g).connect(out(a)); src.start(t);
  }
  function schedule() {
    const a = ctx();
    if (!a || !current || !enabled || Sfx.muted || a.state !== "running") return;
    const song = SONGS[current];
    const stepLen = 60 / song.bpm / 2;
    if (nextTime < a.currentTime) nextTime = a.currentTime + 0.05;
    const scale = MUSIC_SCALES[song.scale];
    const chords = song.chords.trim().split(/\s+/).map(Number);
    const drums = song.drums.replace(/\s+/g, "");
    while (nextTime < a.currentTime + LOOKAHEAD) {
      if (shuffling && stepIdx >= parsed.steps * LOOPS_PER_SONG) { nextSong(); return; }
      const i = stepIdx % parsed.steps;
      for (const n of parsed.notes) if (n.step === i) voice(a, song.lead, midiHz(n.midi), nextTime, n.len * stepLen * 0.95, 0.09 * (song.vol ?? 1));
      const bar = Math.floor(i / 8) % chords.length;
      if (i % 2 === 0) {
        const deg = chords[bar], d = deg % scale.length;
        const bassMidi = song.root - 24 + scale[d] + 12 * Math.floor(deg / scale.length) + (i % 4 === 2 ? 7 : 0);
        voice(a, "triangle", midiHz(bassMidi), nextTime, stepLen * 1.8, 0.16);
      }
      const dk = drums[i % drums.length];
      if (dk && dk !== ".") drum(a, dk, nextTime);
      nextTime += stepLen;
      stepIdx++;
    }
  }
  // Start a song from its first note. Keeps nextTime so songs join smoothly.
  function start(key) {
    current = key; parsed = songNotes(SONGS[key]); stepIdx = 0;
    if (master) { try { master.gain.value = 0.22; } catch (e) {} }
    if (!timer && typeof setInterval === "function") timer = setInterval(() => { try { schedule(); } catch (e) { /* audio refused: stay silent */ } }, 100);
  }
  // Next song in the shuffle. A fresh random order once every song has played.
  function nextSong() {
    if (!queue.length) {
      queue = WORLD_SONGS.filter(k => k !== current);
      for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    }
    start(queue.shift());
  }
  return {
    // Play one song on repeat (the title screen).
    play(key) {
      if (!SONGS[key]) return;
      shuffling = false; anchor = null;
      if (current === key) return;
      nextTime = 0;
      start(key);
    },
    // Shuffle through the world songs, starting with `key`. Calling it again
    // with the same world keeps the music going.
    shuffle(key) {
      if (!SONGS[key]) key = WORLD_SONGS[0];
      if (shuffling && anchor === key) return;
      shuffling = true; anchor = key; queue = [];
      if (current === key) return;
      nextTime = 0;
      start(key);
    },
    stop() { current = null; shuffling = false; anchor = null; },
    get playing() { return current; },
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { /* not remembered, still works */ }
    },
    // Call from a tap: browsers only start audio after one.
    unlock() { const a = typeof Sfx !== "undefined" ? Sfx.context(true) : null; if (a && a.state === "suspended") a.resume().catch(() => {}); },
  };
})();
// The first tap or key press anywhere unlocks audio.

if (typeof document !== "undefined" && document.addEventListener) {
  const unlockOnce = () => { if (typeof Sfx !== "undefined" && !Sfx.muted) Music.unlock(); };
  document.addEventListener("pointerdown", unlockOnce, true);
  document.addEventListener("keydown", unlockOnce, true);
}
