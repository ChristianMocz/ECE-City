// src/rules/maker.js
//
// The Puzzle maker: build a puzzle, prove it can be solved, and share it as
// a short code a friend can type in. The code is the puzzle as compact JSON in
// base64 with a checksum at the end, so a mistyped code is caught.
// Pure logic, no Phaser (tests/progress.test.mjs).
//
// A puzzle: {
//   name, world,                       // title, and which world it looks like
//   parts: [{ kind, id, x, y, ohms?, uF?, Vprev?, ratio?, on?, building? }],
//   wires: [{ a, b }],                 // wires already there at the start
//   goal: { lit: [ids], dark: [ids] }, // lights that must be bright / stay dark
//   budget, tight,                     // copper budget ($), and whether it's a hard limit
//   par,                               // wires the maker needed (for the third star)
// }
//
// Main pieces: encodePuzzle(), decodePuzzle(), validatePuzzle(), puzzleToLevel().
// Used by: src/scene/makerplay.js, src/ui/makerscreens.js.

const MAKER_MAX_PARTS = 16;
const MAKER_KIND_LETTER = { HOUSE: "H", RES: "R", LED: "L", TRANS: "T", CAP: "C", BAT: "B", SOLAR: "S", XFMR: "X" };
const MAKER_LETTER_KIND = Object.fromEntries(Object.entries(MAKER_KIND_LETTER).map(([k, v]) => [v, k]));
const MAKER_FIELD = { left: 200, right: 838, top: 150, bottom: 590 };

function makerChecksum(text) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 46656;
  return h.toString(36).padStart(3, "0");
}
function makerB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makerUnB64(code) {
  const b = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function encodePuzzle(pz) {
  const opt = (p) => p.kind === "RES" ? p.ohms : p.kind === "CAP" ? p.uF : p.kind === "BAT" ? p.Vprev : p.kind === "XFMR" ? p.ratio : p.kind === "TRANS" ? (p.on === false ? 0 : 1) : p.kind === "HOUSE" ? (p.building && p.building !== "house" ? p.building : 0) : 0;
  const c = {
    n: pz.name, m: pz.world || "sparkville",
    p: pz.parts.map(p => [MAKER_KIND_LETTER[p.kind] + p.id.replace(/^[A-Z]/, ""), Math.round(p.x / 2), Math.round(p.y / 2), opt(p)]),
    w: pz.wires.map(w => `${w.a}-${w.b}`).join(" "),
    l: pz.goal.lit.join(" "), d: (pz.goal.dark || []).join(" "),
    $: pz.budget, t: pz.tight ? 1 : 0, s: pz.par,
  };
  const body = makerB64(JSON.stringify(c));
  return `ECE-${body}-${makerChecksum(body)}`;
}

// Returns { ok, puzzle } or { ok: false, why }.
function decodePuzzle(code) {
  const raw = String(code || "").trim().replace(/\s+/g, "");
  const m = raw.match(/^ECE-([A-Za-z0-9_-]+)-([0-9a-z]{3})$/);
  if (!m) return { ok: false, why: "That doesn't look like a puzzle code. Codes start with ECE-." };
  if (makerChecksum(m[1]) !== m[2]) return { ok: false, why: "That code has a typo in it — check every letter." };
  let c;
  try { c = JSON.parse(makerUnB64(m[1])); } catch (e) { return { ok: false, why: "That code is broken — try copying it again." }; }
  const parts = [];
  for (const row of Array.isArray(c.p) ? c.p : []) {
    if (!Array.isArray(row)) return { ok: false, why: "That code is broken." };
    const [idt, hx, hy, o] = row;
    const kind = MAKER_LETTER_KIND[String(idt)[0]];
    if (!kind || !/^[A-Z]\d{1,2}$/.test(idt)) return { ok: false, why: "That code has a part I don't know." };
    const p = { kind, id: idt, x: hx * 2, y: hy * 2 };
    if (kind === "RES") p.ohms = +o;
    if (kind === "CAP") { p.uF = +o; p.Vprev = 0; }
    if (kind === "BAT") p.Vprev = +o;
    if (kind === "XFMR") p.ratio = +o;
    if (kind === "TRANS") p.on = o !== 0;
    if (kind === "HOUSE" && o) p.building = String(o);
    parts.push(p);
  }
  const wires = String(c.w || "").split(" ").filter(Boolean).map(t => { const [a, b] = t.split("-"); return { a, b }; });
  const pz = {
    name: String(c.n || "A puzzle").slice(0, 30), world: typeof REGIONS !== "undefined" && REGIONS[c.m] ? c.m : "sparkville",
    parts, wires,
    goal: { lit: String(c.l || "").split(" ").filter(Boolean), dark: String(c.d || "").split(" ").filter(Boolean) },
    budget: Math.round(+c.$), tight: c.t === 1, par: Math.round(+c.s),
  };
  const check = validatePuzzle(pz);
  return check.ok ? { ok: true, puzzle: pz } : { ok: false, why: check.why };
}

// Every dot a puzzle's wires may use.
function makerDots(parts) {
  const dots = new Set(["GEN", "GND"]);
  for (const p of parts) { if (p.kind === "XFMR") { dots.add(p.id + "P"); dots.add(p.id); } else { dots.add(p.id); dots.add(p.id + "b"); } }
  return dots;
}

function validatePuzzle(pz) {
  const bad = (why) => ({ ok: false, why });
  if (!pz || !Array.isArray(pz.parts) || !Array.isArray(pz.wires) || !pz.goal) return bad("That puzzle is broken.");
  if (!pz.parts.length) return bad("Place some parts first.");
  if (pz.parts.length > MAKER_MAX_PARTS) return bad(`At most ${MAKER_MAX_PARTS} parts in a puzzle.`);
  const ids = new Set();
  for (const p of pz.parts) {
    if (!MAKER_KIND_LETTER[p.kind] || p.id[0] !== MAKER_KIND_LETTER[p.kind] || ids.has(p.id)) return bad("Two parts have the same name.");
    ids.add(p.id);
    const off = DOT_OFFSETS[p.kind];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < MAKER_FIELD.left || p.x > MAKER_FIELD.right || p.y + off[0] < MAKER_FIELD.top - 12 || p.y + off[1] > MAKER_FIELD.bottom) return bad(`${p.id} is off the board.`);
    if (p.kind === "RES" && ![100, 330, 470, 1000].includes(p.ohms) && !(p.ohms >= 1 && p.ohms <= 5000)) return bad("A resistor in that code is a strange size.");
    if (p.kind === "CAP" && !(p.uF >= 1 && p.uF <= 5000)) return bad("A capacitor in that code is a strange size.");
    if (p.kind === "BAT" && !(p.Vprev >= 0 && p.Vprev <= 12)) return bad("A battery in that code is a strange charge.");
    if (p.kind === "XFMR" && ![0.25, 0.5, 1, 2, 4].includes(p.ratio)) return bad("A transformer in that code is a strange size.");
    if (p.kind === "HOUSE" && p.building && !BUILDINGS[p.building]) return bad("A building in that code isn't in the shop.");
  }
  const dots = makerDots(pz.parts);
  const seen = new Set();
  for (const w of pz.wires) {
    if (!dots.has(w.a) || !dots.has(w.b) || w.a === w.b) return bad("A wire in that puzzle goes nowhere.");
    const k = [w.a, w.b].sort().join("|");
    if (seen.has(k)) return bad("Two wires join the same dots."); seen.add(k);
  }
  const lights = (id) => pz.parts.some(p => p.id === id && (p.kind === "HOUSE" || p.kind === "LED"));
  if (!pz.goal.lit.length) return bad("Pick at least one light that must be bright (tap it in step 2).");
  if (![...pz.goal.lit, ...(pz.goal.dark || [])].every(lights)) return bad("The goal names a light that isn't there.");
  if (pz.goal.lit.some(id => (pz.goal.dark || []).includes(id))) return bad("A light can't be both bright and dark.");
  if (!(pz.budget >= 1 && pz.budget <= 999)) return bad("The budget must be between $1 and $999.");
  if (!(pz.par >= 1 && pz.par <= 60)) return bad("Solve your puzzle first (step 3).");
  return { ok: true };
}

function makerGoalText(goal) {
  const list = (ids) => ids.length === 1 ? ids[0] : ids.slice(0, -1).join(", ") + " and " + ids[ids.length - 1];
  return `Light ${list(goal.lit)}${goal.dark?.length ? `, but keep ${list(goal.dark)} dark` : ""}.`;
}

// Turn a puzzle into a level the campaign engine can play (src/rules/campaign.js).
function puzzleToLevel(pz, code = null) {
  const parts = pz.parts.map(p => ({ ...p }));
  return {
    id: "custom-" + makerChecksum(code || JSON.stringify(pz)), world: pz.world || "sparkville", n: "★", custom: true, code,
    title: pz.name, goal: makerGoalText(pz.goal), hint: "A home-made puzzle! Tap a dark light to see what it needs.", teach: null,
    env: {}, board: { counters: countersFor(parts), parts, wires: pz.wires.map(w => ({ ...w })) },
    tool: [], win: { lit: [...pz.goal.lit], ...(pz.goal.dark?.length ? { dark: [...pz.goal.dark] } : {}) },
    hard: !!pz.tight, expert: false, solution: [], budget: pz.budget, parWires: pz.par, solutionSpent: null,
  };
}

// A starting suggestion for the budget once the maker has solved it.
function suggestBudget(spent, tight) { return Math.max(1, tight ? Math.ceil(spent * 1.05) : Math.ceil(spent * 1.3 / 5) * 5); }
