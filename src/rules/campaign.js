// src/rules/campaign.js
//
// The campaign engine: hand-made puzzle levels played in order along each
// world's path. A level has some fixed parts, a toolbox, a copper budget and
// a goal. Stars: finish it; stay within budget; use no extra wires and pop
// nothing. Pure logic, no Phaser.
//
// Main pieces: L(), checkLevelWin(), levelStars(), levelUnlocked(),
// recordLevelResult(), replaySolution(), CAMPAIGN_LEVELS.
// Used by: src/rules/levels.js (the levels), src/scene/levelplay.js, src/ui/levelmap.js.

// [top dot dy, bottom dot dy] from where each part is placed.
// Must match the make* functions in src/scene/parts.js (the browser tests check this).
const DOT_OFFSETS = { HOUSE: [-68, 100], RES: [-18, 90], CAP: [-38, 96], XFMR: [-40, 96], TRANS: [-28, 85], LED: [-22, 102], SOLAR: [-30, 85], BAT: [-30, 82] };
const GEN_DOT = { x: 130, y: 360 };
const GND_DOT = { x: 130, y: 450 };
const KIND_OF_PREFIX = { H: "HOUSE", R: "RES", L: "LED", T: "TRANS", C: "CAP", B: "BAT", S: "SOLAR", X: "XFMR" };
const PREFIX_OF_KIND = { HOUSE: "H", RES: "R", LED: "L", TRANS: "T", CAP: "C", BAT: "B", SOLAR: "S", XFMR: "X" };

// What things cost in a level.
const COPPER_PER_PX = 1 / 40;   // a wire costs $1 for every 40 pixels (at least $1)
const PART_COST = { HOUSE: 6, RES: 3, LED: 2, TRANS: 4, CAP: 5, BAT: 8, SOLAR: 10, XFMR: 8 };
function wireCost(len) { return Math.max(1, Math.round(len * COPPER_PER_PX)); }

// --- Level shorthand ---
// parts: "ID@x,y[:opt]". H house (:building), R resistor (:ohms), L LED (:burned),
//        T switch (:off), C capacitor (:uF:volts), B battery (:volts), S solar, X transformer (:ratio).
//        e.g. "H0@450,260 H1@600,260:bakery R0@300,430:470 C0@450,460:220:12"
// wires: "GEN-H0 H0b-GND". A part's top dot is its id, the bottom dot adds "b".
//        A transformer's dots are X0P (primary) and X0 (secondary).
// tool:  parts the player may place, e.g. "RES:470 RES:470 LED CAP:220 XFMR:2".
// sol:   steps split by ";". w A B add wire, u A B remove wire, f T0 flip switch,
//        p KIND x y [opt] place part, t secs let time pass, tap L0 fix a popped LED.
// win:   see the Win checks list below.
function parseParts(text) {
  const parts = [];
  for (const tok of (text || "").trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([A-Z])(\d+)@(\d+),(\d+)(?::(.*))?$/);
    if (!m) throw new Error("bad part: " + tok);
    const kind = KIND_OF_PREFIX[m[1]];
    const p = { kind, id: m[1] + m[2], x: +m[3], y: +m[4] };
    const opt = m[5] ? m[5].split(":") : [];
    if (kind === "HOUSE" && opt[0]) p.building = opt[0];
    if (kind === "RES") p.ohms = +(opt[0] || 470);
    if (kind === "LED" && opt[0] === "burned") p.burned = true;
    if (kind === "TRANS") p.on = opt[0] !== "off";
    if (kind === "CAP") { p.uF = +(opt[0] || 220); p.Vprev = +(opt[1] || 0); }
    if (kind === "BAT") p.Vprev = +(opt[0] || 0);
    if (kind === "XFMR") p.ratio = +(opt[0] || 1);
    parts.push(p);
  }
  return parts;
}
function parseWires(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).map(t => { const [a, b] = t.split("-"); return { a, b }; });
}
function parseTool(text) {
  // Returns [{ key, kind, opt, n }], same parts grouped.
  const out = [];
  for (const tok of (text || "").trim().split(/\s+/).filter(Boolean)) {
    const [kind, o] = tok.split(":");
    const opt = o === undefined ? null : +o;
    const key = opt === null ? kind : `${kind}:${opt}`;
    const have = out.find(t => t.key === key);
    if (have) have.n++; else out.push({ key, kind, opt, n: 1 });
  }
  return out;
}
function parseSolution(text) {
  return (text || "").split(";").map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+/));
}
function countersFor(parts) {
  const c = { H: 0, R: 0, T: 0, L: 0, C: 0, X: 0, S: 0, B: 0 };
  for (const p of parts) { const pre = PREFIX_OF_KIND[p.kind]; c[pre] = Math.max(c[pre], parseInt(p.id.slice(1), 10) + 1); }
  return c;
}

const CAMPAIGN_LEVELS = [];
const CAMPAIGN_BY_ID = {};
// Define a level. If budget or parWires are not given, they come from replaying the solution.
function L(def) {
  const world = def.world;
  const n = CAMPAIGN_LEVELS.filter(l => l.world === world).length + 1;
  const parts = parseParts(def.parts);
  const lv = {
    id: `${world}-${n}`, world, n,
    title: def.title, goal: def.goal, hint: def.hint, teach: def.teach || null,
    env: def.env || {},
    board: { counters: countersFor(parts), parts, wires: parseWires(def.wires) },
    tool: parseTool(def.tool),
    win: def.win,
    hard: !!def.hard || !!def.expert,
    expert: !!def.expert,
    solution: parseSolution(def.sol),
    budget: def.budget ?? null,
    parWires: def.parWires ?? null,
  };
  const r = replaySolution(lv);
  // Copper gets tighter the further you travel: later worlds leave less spare.
  const wi = typeof REGION_KEYS !== "undefined" ? REGION_KEYS.indexOf(world) : 0;
  const spare = wi >= 9 ? 1.15 : wi >= 6 ? 1.2 : 1.3;
  if (lv.budget == null) lv.budget = lv.expert ? Math.ceil(r.spent * 1.05) : lv.hard ? Math.ceil(r.spent * 1.08) : Math.ceil((r.spent * spare) / 5) * 5;
  if (lv.parWires == null) lv.parWires = r.wiresAdded;
  lv.solutionSpent = r.spent;
  CAMPAIGN_LEVELS.push(lv);
  CAMPAIGN_BY_ID[lv.id] = lv;
  return lv;
}
// The ten levels on a world's path (Expert levels are extra, see below).
function campaignLevelsOf(world) { return CAMPAIGN_LEVELS.filter(l => l.world === world && !l.expert); }
// A world's Expert level: opens once every level on its path is finished.
function expertLevelOf(world) { return CAMPAIGN_LEVELS.find(l => l.world === world && l.expert) || null; }

// --- Board geometry and cost ---
// Works on a plain snapshot: { parts, wires }.
function dotPosIn(parts, id) {
  if (id === "GEN") return GEN_DOT;
  if (id === "GND") return GND_DOT;
  let base = id, which = 0;
  if (/b$/.test(id)) { base = id.slice(0, -1); which = 1; }
  else if (/^X\d+P$/.test(id)) { base = id.slice(0, -1); which = 0; }
  else if (/^X\d+$/.test(id)) which = 1;
  const p = parts.find(q => q.id === base);
  if (!p) return null;
  return { x: p.x, y: p.y + DOT_OFFSETS[p.kind][which] };
}
// What a board costs on top of the level's own parts and wires.
function snapshotSpent(level, snap) {
  const same = (w, v) => (w.a === v.a && w.b === v.b) || (w.a === v.b && w.b === v.a);
  let spent = 0, wiresAdded = 0;
  for (const w of snap.wires) {
    if (level.board.wires.some(v => same(w, v))) continue;
    const pa = dotPosIn(snap.parts, w.a), pb = dotPosIn(snap.parts, w.b);
    if (!pa || !pb) continue;
    spent += wireCost(Math.hypot(pa.x - pb.x, pa.y - pb.y));
    wiresAdded++;
  }
  for (const p of snap.parts) if (!level.board.parts.some(q => q.id === p.id)) spent += PART_COST[p.kind] || 0;
  return { spent, wiresAdded };
}

// --- Solver state ---
// Builds the same circuit shape the game uses, for win checks and tests.
const CIRCUIT_DEFAULTS = {
  V: 12, R_WIRE: 0.03, R_GEN: 1.5, R_HOUSE: 18, V_LED_F: 2, R_LED_INTERNAL: 10,
  I_LED_GLOW: 0.003, I_LED_BRIGHT: 0.012, I_LED_MAX: 0.025, V_HOUSE_ON: 9, V_HOUSE_DIM: 7, dt: 1 / 30,
  V_SOLAR: 12, R_SOLAR: 4, solarFactor: 1, BAT_C: 20, loadScale: 1, genScale: 1, CAP_TIME_SCALE: 9000,
  RES_DEFAULT_OHMS: 470, XFMR_DEFAULT_RATIO: 0.5, solverError: false,
};
function levelEnv(level) {
  const e = level.env || {};
  return {
    solarFactor: e.night ? 0 : (e.solarFactor ?? 1),
    loadScale: e.loadScale ?? (e.night ? 0.7 : 1),
    genScale: e.genScale ?? 1,
    R_GEN: e.R_GEN ?? (e.plant && typeof PLANTS !== "undefined" && PLANTS[e.plant] ? PLANTS[e.plant].R : 1.5),
    night: !!e.night,
  };
}
function addPartToCircuit(s, p) {
  if (p.kind === "XFMR") {
    s.nodes.set(p.id + "P", { id: p.id + "P", type: "XFMR_PRI", data: { kind: "XFMR", role: "secondary", pairId: p.id } });
    s.nodes.set(p.id, { id: p.id, type: "XFMR_SEC", data: { kind: "XFMR", role: "primary", pairId: p.id + "P", ratio: p.ratio ?? 1 } });
    return;
  }
  const d = { kind: p.kind, role: "primary", pairId: p.id + "b" };
  if (p.kind === "RES") d.ohms = p.ohms ?? 470;
  if (p.kind === "TRANS") d.on = p.on ?? true;
  if (p.kind === "LED") d.burned = !!p.burned;
  if (p.kind === "CAP") { d.uF = p.uF ?? 220; d.C = d.uF * 1e-6 * CIRCUIT_DEFAULTS.CAP_TIME_SCALE; d.Vprev = p.Vprev ?? 0; }
  if (p.kind === "BAT") { d.C = CIRCUIT_DEFAULTS.BAT_C; d.Vprev = p.Vprev ?? 0; }
  if (p.kind === "HOUSE") {
    const b = p.building && BUILDINGS[p.building] ? p.building : "house";
    Object.assign(d, { building: b, R: BUILDINGS[b].R, vOn: BUILDINGS[b].vOn, vDim: BUILDINGS[b].vDim });
  }
  s.nodes.set(p.id, { id: p.id, type: p.kind, data: d });
  s.nodes.set(p.id + "b", { id: p.id + "b", type: p.kind + "_B", data: { kind: p.kind, role: "secondary", pairId: p.id } });
}
function circuitFromSnapshot(snap, env) {
  const s = Object.assign({}, CIRCUIT_DEFAULTS, env || {});
  s.nodes = new Map();
  s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} });
  s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
  for (const p of snap.parts) addPartToCircuit(s, p);
  s.wires = snap.wires.map(w => ({ a: w.a, b: w.b }));
  s.nodeVoltages = new Map(); s.powered = new Map(); s.wireMetrics = new Map();
  return s;
}
// A copy of a circuit that can be changed and solved without touching the board.
function cloneCircuit(state) {
  const s = Object.assign({}, state);
  s.nodes = new Map();
  for (const [id, n] of state.nodes) s.nodes.set(id, { id, type: n.type, data: { ...n.data } });
  s.wires = state.wires.map(w => ({ a: w.a, b: w.b }));
  s.nodeVoltages = new Map(); s.powered = new Map(); s.wireMetrics = new Map(); s.solverError = false;
  return s;
}
const lvlOf = (s, id) => (s.solverError ? "OFF" : s.powered?.get(id)?.level ?? "OFF");
const isOn = (s, id) => lvlOf(s, id) === "ON";
function solveCopy(state, change) {
  const s = cloneCircuit(state);
  if (change) change(s);
  try { computePower(s, 0); } catch (e) { s.solverError = true; }
  return s;
}
// "Unscrew" a part so no current can flow through it.
function openPart(s, id) {
  const n = s.nodes.get(id);
  if (!n) return;
  if (n.type === "HOUSE") n.data.R = 1e9;
  else if (n.type === "LED") n.data.burned = true;
  else if (n.type === "TRANS") n.data.on = false;
  else if (n.type === "RES") n.data.ohms = 1e9;
  else if (n.type === "XFMR_SEC") s.wires = s.wires.filter(w => w.a !== id && w.b !== id);
}

// --- Win checks ---
// `win` is plain data; every key must hold.
//   lit: [ids]          these are bright (ON)
//   litAll: true        every building and LED is bright
//   dark: [ids]         these are NOT bright
//   dim: [ids]          these glow a little (DIM)
//   ledsOn: n           at least n LEDs bright
//   noGen: true         the generator supplies nothing (stored/solar power only)
//   genMax: amps        the generator supplies at most this
//   capAtLeast: {id: V} a capacitor/battery is charged to at least V volts
//   needs: {id: partId} unscrew partId and id goes dark (the power really goes through it)
//   parallel: [ids]     all bright, and unscrewing any one leaves the others bright
//   chain: [ids]        all bright, and unscrewing any one darkens all the others
//   truth: { switches: [ids], want: { "10": { H0: 1, H1: 0 }, ... } }
//                       for every switch setting (1 = on), what's bright
//   redundant: [ids]    stays bright whichever ONE wire is cut
//   backup: [ids]       stays bright even with every wire to GEN cut
//   lastSeconds: { ids, seconds }  still bright after that many seconds
function checkLevelWin(level, state) {
  const w = level.win || {};
  if (state.solverError) return false;
  const loads = [...state.nodes.values()].filter(n => n.type === "HOUSE" || n.type === "LED").map(n => n.id);
  if (w.lit && !w.lit.every(id => isOn(state, id))) return false;
  if (w.litAll && !loads.every(id => isOn(state, id))) return false;
  if (w.dark && w.dark.some(id => isOn(state, id))) return false;
  if (w.dim && !w.dim.every(id => lvlOf(state, id) === "DIM")) return false;
  if (w.ledsOn && loads.filter(id => state.nodes.get(id).type === "LED" && isOn(state, id)).length < w.ledsOn) return false;
  if (w.noGen && genAmps(state) >= 0.001) return false;
  if (w.genMax != null && genAmps(state) > w.genMax) return false;
  if (w.capAtLeast) for (const [id, v] of Object.entries(w.capAtLeast)) if (Math.abs(state.nodes.get(id)?.data?.Vprev ?? 0) < v) return false;
  for (const ids of [w.parallel, w.chain]) if (ids && !ids.every(id => isOn(state, id))) return false;
  if (w.redundant && !w.redundant.every(id => isOn(state, id))) return false;
  if (w.backup && !w.backup.every(id => isOn(state, id))) return false;
  // The checks below solve copies of the circuit.
  if (w.needs) for (const [id, part] of Object.entries(w.needs)) if (isOn(solveCopy(state, s => openPart(s, part)), id)) return false;
  if (w.parallel) for (const off of w.parallel) { const s = solveCopy(state, c => openPart(c, off)); if (!w.parallel.filter(x => x !== off).every(id => isOn(s, id))) return false; }
  if (w.chain) for (const off of w.chain) { const s = solveCopy(state, c => openPart(c, off)); if (w.chain.filter(x => x !== off).some(id => lvlOf(s, id) !== "OFF")) return false; }
  if (w.truth) {
    const sw = w.truth.switches;
    for (const [bits, want] of Object.entries(w.truth.want)) {
      const s = solveCopy(state, c => sw.forEach((id, i) => { const n = c.nodes.get(id); if (n) n.data.on = bits[i] === "1"; }));
      for (const [id, on] of Object.entries(want)) if (isOn(s, id) !== !!on) return false;
    }
  }
  if (w.redundant) {
    for (let i = 0; i < state.wires.length; i++) {
      const s = solveCopy(state, c => { c.wires.splice(i, 1); });
      if (!w.redundant.every(id => isOn(s, id))) return false;
    }
  }
  if (w.backup) {
    const s = solveCopy(state, c => { c.wires = c.wires.filter(x => x.a !== "GEN" && x.b !== "GEN"); });
    if (!w.backup.every(id => isOn(s, id))) return false;
  }
  if (w.lastSeconds) {
    const s = cloneCircuit(state);
    const steps = Math.ceil(w.lastSeconds.seconds * 10);
    for (let i = 0; i < steps; i++) {
      try { computePower(s, 0.1); } catch (e) { return false; }
      if (!w.lastSeconds.ids.every(id => isOn(s, id))) return false;
    }
  }
  return true;
}

// Stars for a finished level: { stars, budget: bool, neat: bool }.
function levelStars(level, { spent, wiresAdded, popped }) {
  const budget = spent <= level.budget;
  const neat = wiresAdded <= level.parWires && !popped;
  return { stars: 1 + (budget ? 1 : 0) + (neat ? 1 : 0), budget, neat };
}

// Can you play this level yet? { ok, why }
function levelUnlocked(profile, level) {
  const regionInfo = regionStatus(profile, level.world);
  if (!regionInfo.ok) return { ok: false, why: regionInfo.why };
  if (level.expert) {
    const left = campaignLevelsOf(level.world).filter(l => !(profile.campaign[l.id] >= 1)).length;
    if (left) return { ok: false, why: `Finish all ${campaignLevelsOf(level.world).length} levels here first (${left} to go).` };
    return { ok: true, why: null };
  }
  if (level.n > 1) {
    const prev = CAMPAIGN_BY_ID[`${level.world}-${level.n - 1}`];
    if (prev && !(profile.campaign[prev.id] >= 1)) return { ok: false, why: `Finish level ${level.n - 1} first.` };
  }
  return { ok: true, why: null };
}

// Save the best stars and pay out: coins per new star plus a first-time bonus, XP likewise.
function recordLevelResult(profile, level, stars) {
  const before = profile.campaign[level.id] || 0;
  const gained = Math.max(0, stars - before);
  if (stars > before) profile.campaign[level.id] = stars;
  const first = before === 0;
  const coins = gained * (level.expert ? 20 : 10) + (first ? (level.expert ? 60 : 15) : 0);
  const xp = (first ? (level.expert ? 80 : 25) : 0) + gained * 5;
  return { coins, xp, first, gained, best: Math.max(before, stars) };
}
function campaignStars(profile, world) {
  let n = 0;
  for (const lv of CAMPAIGN_LEVELS) if (!world || lv.world === world) n += profile.campaign[lv.id] || 0;
  return n;
}
// The next level to play in a world (the first one without a star), or null.
function nextLevelIn(profile, world) {
  return campaignLevelsOf(world).find(l => !(profile.campaign[l.id] >= 1)) || null;
}

// --- Replaying a solution ---
// Used by L() to work out the budget, and by tests.
// Returns { state, snap, spent, wiresAdded, won, wonAt, startedSolved, popped, wonAtEnd }.
function replaySolution(level, steps = level.solution) {
  const env = levelEnv(level);
  const snap = JSON.parse(JSON.stringify({ parts: level.board.parts, wires: level.board.wires }));
  const counters = { ...level.board.counters };
  const state = () => circuitFromSnapshot(snap, env);
  let s = state();
  // Carry charge (Vprev) and popped LEDs between rebuilds.
  const carry = (from) => { for (const p of snap.parts) { const n = from.nodes.get(p.id); if (!n) continue; if (p.kind === "CAP" || p.kind === "BAT") p.Vprev = n.data.Vprev; if (p.kind === "LED") p.burned = !!n.data.burned; if (p.kind === "TRANS") p.on = n.data.on; } };
  const solve = () => { try { computePower(s, 0); } catch (e) { s.solverError = true; } };
  solve();
  const startedSolved = checkLevelWin(level, s);
  let popped = [...s.nodes.values()].some(n => n.type === "LED" && n.data.burned) && false;
  let won = startedSolved, wonAt = startedSolved ? -1 : null;
  const anyBurned = () => [...s.nodes.values()].some(n => n.type === "LED" && n.data.burned);
  const startBurned = new Set([...s.nodes.values()].filter(n => n.type === "LED" && n.data.burned).map(n => n.id));
  steps.forEach((st, i) => {
    carry(s);
    const [op, a, b, c, d] = st;
    if (op === "w") snap.wires.push({ a, b });
    else if (op === "u") snap.wires = snap.wires.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
    else if (op === "f") { const p = snap.parts.find(q => q.id === a); p.on = !(p.on ?? true); }
    else if (op === "tap") { const p = snap.parts.find(q => q.id === a); p.burned = false; startBurned.delete(a); }
    else if (op === "p") {
      const kind = a, pre = PREFIX_OF_KIND[kind];
      const id = `${pre}${counters[pre]++}`;
      const p = { kind, id, x: +b, y: +c };
      if (kind === "RES") p.ohms = +(d ?? 470);
      if (kind === "CAP") p.uF = +(d ?? 220);
      if (kind === "XFMR") p.ratio = +(d ?? 1);
      if (kind === "TRANS") p.on = true;
      snap.parts.push(p);
    }
    s = state();
    if (op === "t") {
      solve();
      const n = Math.round(+a * 10);
      for (let k = 0; k < n; k++) { try { computePower(s, 0.1); } catch (e) { s.solverError = true; } if (!won && checkLevelWin(level, s)) { won = true; wonAt = i; } }
      carry(s);
    } else {
      // The game refits a popped LED when its chain is rewired.
      if (op === "w" || op === "u") for (const id of poppedLEDsTouched(s, [a, b], op === "u" ? [...s.wires, { a, b }] : s.wires)) { s.nodes.get(id).data.burned = false; const p = snap.parts.find(q => q.id === id); if (p) p.burned = false; }
      solve();
    }
    if ([...s.nodes.values()].some(n => n.type === "LED" && n.data.burned && !startBurned.has(n.id))) popped = true;
    if (!won && checkLevelWin(level, s)) { won = true; wonAt = i; }
  });
  carry(s);
  const cost = snapshotSpent(level, snap);
  return { state: s, snap, spent: cost.spent, wiresAdded: cost.wiresAdded, won, wonAt, startedSolved, popped, wonAtEnd: checkLevelWin(level, s) };
}
