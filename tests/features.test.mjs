// tests/features.test.mjs
//
// Tests for the "Why is it dark?" helper (src/circuit/diagnose.js) and each
// mission's win check (src/rules/missions.js), including the helper's answers
// for shop buildings, solar panels and batteries. Every case builds a real
// circuit and solves it with the real solver before checking.
//
// Run: node tests/features.test.mjs  (or open tests/run-in-browser.html)

// Wrapped in one async function so it works as a Node module and a classic
// <script> (see tests/sim.test.mjs).
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  globalThis.Mode ??= { WIRE: "WIRE" }; // circuit/state.js starts in the WIRE tool (Mode lives in ui/hud.js)
  for (const f of ["../src/art/pixelart.js", "../src/rules/game.js", "../src/rules/plants.js", "../src/circuit/state.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/missions.js"]) {
    const path = resolve(dirname(process.argv[1]), f); // no import.meta in a classic script
    runInThisContext(readFileSync(path, "utf8"), { filename: path });
  }
}

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log(`FAIL  - ${name}`); console.log(`        ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || "not equal"}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

function makeState() {
  const s = {
    nodes: new Map(), wires: [], V: 12, R_WIRE: 0.03, R_GEN: 1.5, R_HOUSE: 18, V_LED_F: 2, R_LED_INTERNAL: 10,
    I_LED_GLOW: 0.003, I_LED_BRIGHT: 0.012, I_LED_MAX: 0.025, RES_DEFAULT_OHMS: 470, XFMR_DEFAULT_RATIO: 0.5,
    V_HOUSE_ON: 9, V_HOUSE_DIM: 7, dt: 1 / 30, solverError: false,
  };
  s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} });
  s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
  return s;
}
function part(s, id, type, data = {}) {
  s.nodes.set(id, { id, type, data: { pairId: id + "b", ...data } });
  s.nodes.set(id + "b", { id: id + "b", type: type + "_B", data: { pairId: id } });
}
function xfmr(s, id, ratio) {
  s.nodes.set(id + "P", { id: id + "P", type: "XFMR_PRI", data: { pairId: id } });
  s.nodes.set(id, { id, type: "XFMR_SEC", data: { pairId: id + "P", ratio } });
}
function wire(s, a, b) { s.wires.push({ a, b }); }
function diag(s, id) { computePower(s); return diagnosePart(s, id); }
const markAt = (d, nodeId, kind) => d.marks.some(m => m.nodeId === nodeId && (!kind || m.kind === kind));

console.log("Why is it dark? — houses");
test("a lit house is reported lit, with its whole loop highlighted", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  eq(d.code, "lit"); assert(d.lit); assert(d.path.includes("GEN|H0") && d.path.includes("GND|H0b"), "loop: " + d.path);
});
test("an unwired house: both dots marked", () => {
  const s = makeState(); part(s, "H0", "HOUSE");
  const d = diag(s, "H0");
  eq(d.code, "not-wired"); assert(markAt(d, "H0", "gap") && markAt(d, "H0b", "gap"));
});
test("power in but no way home: the BLUE dot is marked", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0");
  const d = diag(s, "H0");
  eq(d.code, "no-return"); assert(markAt(d, "H0b", "gap") && !markAt(d, "H0")); assert(d.path.includes("GEN|H0"));
});
test("way home but no power in: the ORANGE dot is marked", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  eq(d.code, "no-power"); assert(markAt(d, "H0", "gap"));
});
test("a house reached only THROUGH ground is not 'powered' (no-power)", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); part(s, "H1", "HOUSE");
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); wire(s, "GND", "H1"); // H1's orange dot is on GND
  const d = diag(s, "H1");
  eq(d.lit, false); assert(d.code === "not-wired" || d.code === "no-power", d.code);
});
test("an OFF switch in the loop is named and marked", () => {
  const s = makeState(); part(s, "T0", "TRANS", { on: false }); part(s, "H0", "HOUSE");
  wire(s, "GEN", "T0"); wire(s, "T0b", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  eq(d.code, "switch-off"); assert(markAt(d, "T0", "block")); assert(d.message.includes("T0"));
});
test("an OFF switch on the RETURN side is found too", () => {
  const s = makeState(); part(s, "T0", "TRANS", { on: false }); part(s, "H0", "HOUSE");
  wire(s, "GEN", "H0"); wire(s, "H0b", "T0"); wire(s, "T0b", "GND");
  eq(diag(s, "H0").code, "switch-off");
});
test("a house behind a big resistor: 'not enough volts', resistor marked", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 100 }); part(s, "H0", "HOUSE");
  wire(s, "GEN", "R0"); wire(s, "R0b", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  eq(d.code, "low-voltage"); assert(markAt(d, "R0", "block")); assert(d.message.includes("R0"));
});
test("a house after a step-down transformer: the transformer is blamed", () => {
  const s = makeState(); xfmr(s, "X0", 0.5); part(s, "H0", "HOUSE");
  wire(s, "GEN", "X0P"); wire(s, "X0", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  assert(d.code === "low-voltage" || d.code === "dim", d.code); assert(markAt(d, "X0", "block")); assert(/step/i.test(d.message));
});
test("too many houses: dim, and the generator is blamed", () => {
  const s = makeState();
  for (let i = 0; i < 5; i++) { part(s, "H" + i, "HOUSE"); wire(s, "GEN", "H" + i); wire(s, "H" + i + "b", "GND"); }
  const d = diag(s, "H0");
  assert(d.code === "dim" || d.code === "low-voltage", d.code); assert(/generator/i.test(d.message));
});
test("a shortcut wire across a house is spotted", () => {
  const s = makeState(); part(s, "H0", "HOUSE");
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); wire(s, "H0", "H0b");
  eq(diag(s, "H0").code, "shorted");
});
test("a capacitor in series blocks once full", () => {
  const s = makeState(); part(s, "C0", "CAP", { C: 0.01, Vprev: 0 }); part(s, "H0", "HOUSE");
  wire(s, "GEN", "C0"); wire(s, "C0b", "H0"); wire(s, "H0b", "GND");
  for (let i = 0; i < 300; i++) computePower(s, 1 / 30);
  const d = diagnosePart(s, "H0");
  eq(d.code, "cap-in-the-way"); assert(markAt(d, "C0", "block"));
});
test("a house wired 'backwards' still works (it's a resistor) and is reported lit", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0b"); wire(s, "H0", "GND");
  const d = diag(s, "H0");
  eq(d.code, "lit"); assert(d.path.length === 2, "loop highlighted: " + d.path);
});

console.log("Why is it dark? — LEDs");
test("a backwards LED is called out", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0b"); wire(s, "L0", "GND");
  const d = diag(s, "L0");
  eq(d.code, "backwards"); assert(/backwards/i.test(d.message));
});
test("a popped LED says so", () => {
  const s = makeState(); part(s, "L0", "LED"); wire(s, "GEN", "L0"); wire(s, "L0b", "GND");
  eq(diag(s, "L0").code, "popped");
});
test("a popped LED blocking a house is named", () => {
  const s = makeState(); part(s, "L0", "LED", { burned: true }); part(s, "H0", "HOUSE");
  wire(s, "GEN", "L0"); wire(s, "L0b", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  eq(d.code, "blocked-by-popped"); assert(markAt(d, "L0", "block"));
});
test("an LED with a Large resistor is dim, and the advice is to swap R0 for a Medium", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 1000 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND");
  const d = diag(s, "L0");
  eq(d.code, "led-dim"); assert(/R0/.test(d.message) && /Medium \(470Ω\)/.test(d.message), d.message);
  assert(!/smaller resistor would let/i.test(d.message), "never tells you to go smaller");
});
test("an LED below its turn-on voltage says it needs more volts", () => {
  const s = makeState(); xfmr(s, "X0", 0.1); part(s, "L0", "LED");
  wire(s, "GEN", "X0P"); wire(s, "X0", "L0"); wire(s, "L0b", "GND");
  eq(diag(s, "L0").code, "led-low-voltage");
});
test("a protected, bright LED is lit", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND");
  const d = diag(s, "L0");
  eq(d.code, "lit"); eq(d.path.length, 3, "3 wires in the loop");
});
test("asking about something that isn't a house or LED returns null (no crash)", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 10 }); computePower(s);
  eq(diagnosePart(s, "R0"), null); eq(diagnosePart(s, "GEN"), null); eq(diagnosePart(s, "nope"), null);
});

console.log("Missions");
function fromSetup(setup) {
  const s = makeState();
  for (const p of setup.parts) {
    const extra = {};
    if (p.kind === "CAP") { extra.C = (p.uF ?? 220) * 1e-6 * 9000; extra.Vprev = 0; }
    if (p.kind === "TRANS") extra.on = p.on ?? true;
    if (p.kind === "RES") extra.ohms = p.ohms;
    part(s, p.id, p.kind, extra);
  }
  for (const w of setup.wires) wire(s, w.a, w.b);
  return s;
}
const genI = (s) => (s.V - s.nodeVoltages.get("GEN")) / s.R_GEN;
const ctxOf = (s, extra = {}) => ({ genCurrent: genI(s), switchCycled: false, ...extra });

test("there are 5 missions, each with a title, goal, hint, setup and check", () => {
  eq(MISSIONS.length, 5);
  for (const m of MISSIONS) assert(m.title && m.goal && m.hint && m.setup && typeof m.check === "function", m.title);
});
test("every mission starts NOT complete", () => {
  for (const m of MISSIONS) { const s = fromSetup(m.setup); computePower(s); eq(m.check(s, ctxOf(s)), false, m.title); }
});
test("1 Light it up: wiring H1 wins", () => {
  const s = fromSetup(MISSIONS[0].setup); wire(s, "GEN", "H1"); wire(s, "H1b", "GND"); computePower(s);
  eq(MISSIONS[0].check(s, ctxOf(s)), true);
});
test("2 The whole street: two houses isn't enough, three wins", () => {
  const s = fromSetup(MISSIONS[1].setup); wire(s, "GEN", "H1"); wire(s, "H1b", "GND"); computePower(s);
  eq(MISSIONS[1].check(s, ctxOf(s)), false, "two");
  wire(s, "GEN", "H2"); wire(s, "H2b", "GND"); computePower(s);
  eq(MISSIONS[1].check(s, ctxOf(s)), true, "three");
});
test("3 Save the LED: unprotected pops (no win), Medium resistor wins", () => {
  let s = fromSetup(MISSIONS[2].setup); wire(s, "GEN", "L0"); wire(s, "L0b", "GND"); computePower(s);
  eq(MISSIONS[2].check(s, ctxOf(s)), false, "popped");
  s = fromSetup(MISSIONS[2].setup); part(s, "R0", "RES", { ohms: 470 });
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND"); computePower(s);
  eq(MISSIONS[2].check(s, ctxOf(s)), true, "protected");
});
test("4 Light switch: only wins once the switch has turned it off and on", () => {
  const s = fromSetup(MISSIONS[3].setup); computePower(s);
  eq(MISSIONS[3].check(s, ctxOf(s)), false); eq(MISSIONS[3].check(s, ctxOf(s, { switchCycled: true })), true);
});
test("5 Capacitor power: wins only when the generator supplies nothing", () => {
  const s = fromSetup(MISSIONS[4].setup);
  wire(s, "GEN", "C0"); wire(s, "C0b", "GND"); wire(s, "C0", "H0"); wire(s, "H0b", "GND");
  for (let i = 0; i < 300; i++) computePower(s, 1 / 30); // charge ~10 s
  eq(MISSIONS[4].check(s, ctxOf(s)), false, "generator still connected");
  s.wires = s.wires.filter(w => !(w.a === "GEN" && w.b === "C0"));
  computePower(s, 1 / 30);
  eq(MISSIONS[4].check(s, ctxOf(s)), true, "capacitor alone keeps the house lit");
  for (let i = 0; i < 30 * 120; i++) computePower(s, 1 / 30); // 2 minutes later, drained
  eq(MISSIONS[4].check(s, ctxOf(s)), false, "drained");
});

console.log("What is this? cards");
test("resistor card names its value and its real colour-code stripes", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 470 }); computePower(s);
  const t = describePart(s, "R0");
  assert(t.includes("470") && t.includes("yellow-violet-brown"), t);
});
test("capacitor card says how full it is right now", () => {
  const s = makeState(); part(s, "C0", "CAP", { uF: 220, C: 1.98, Vprev: 6 }); computePower(s);
  assert(describePart(s, "C0").includes("50% full"), describePart(s, "C0"));
});
test("transformer card says up, down or same", () => {
  const s = makeState(); xfmr(s, "X0", 0.5); xfmr(s, "X1", 2); xfmr(s, "X2", 1); computePower(s);
  assert(/DOWN/.test(describePart(s, "X0")) && /UP/.test(describePart(s, "X1")) && /same/.test(describePart(s, "X2")));
});
test("generator card reports the current it is supplying", () => {
  const s = makeState(); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); computePower(s);
  const amps = (s.V - s.nodeVoltages.get("GEN")) / s.R_GEN;
  assert(describePart(s, "GEN").includes(amps.toFixed(2) + " A"), describePart(s, "GEN"));
});
test("switch, ground, and unknown ids", () => {
  const s = makeState(); part(s, "T0", "TRANS", { on: false }); computePower(s);
  assert(/OFF/.test(describePart(s, "T0")) && /way home/.test(describePart(s, "GND")));
  eq(describePart(s, "nope"), null); eq(describePart(s, "T0b"), null);
});
test("resistor colour code matches the real standard for every preset", () => {
  eq(resistorBandNames(100), "brown-black-brown"); eq(resistorBandNames(470), "yellow-violet-brown"); eq(resistorBandNames(1000), "brown-black-red");
});


console.log("Why is it dark? — buildings, solar panels, batteries");
const sunState = (solarFactor = 1) => Object.assign(makeState(), { V_SOLAR: 12, R_SOLAR: 4, solarFactor, BAT_C: 20, loadScale: 1 });
const building = (s, id, key) => part(s, id, "HOUSE", { building: key, R: BUILDINGS[key].R, vOn: BUILDINGS[key].vOn, vDim: BUILDINGS[key].vDim });
test("a shop building is called by its name, and its own voltage need is quoted", () => {
  const s = sunState(); building(s, "H0", "school");
  part(s, "R0", "RES", { ohms: 2 }); wire(s, "GEN", "R0"); wire(s, "R0b", "H0"); wire(s, "H0b", "GND");
  const d = diag(s, "H0");
  assert(!d.lit && d.message.startsWith("The school (H0)") && d.message.includes("it needs 10 to be bright"), d.message);
});
test("a house lit by a solar panel says the power comes from the panel", () => {
  const s = sunState(); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "S0b");
  const d = diag(s, "H0");
  assert(d.lit && d.message.includes("solar panel S0"), d.message);
  assert(d.path.includes("H0|S0") && d.path.includes("H0b|S0b"), "loop: " + d.path);
});
test("at night the same house is dark, and the helper blames the missing sunshine", () => {
  const s = sunState(0); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "S0b");
  const d = diag(s, "H0");
  eq(d.code, "solar-weak"); assert(d.message.includes("night") && d.message.includes("battery"), d.message);
  assert(markAt(d, "S0", "block"), "panel marked");
});
test("an empty battery is named, with how full it is", () => {
  const s = sunState(); part(s, "B0", "BAT", { Vprev: 0 }); part(s, "H0", "HOUSE"); wire(s, "B0", "H0"); wire(s, "H0b", "B0b");
  const d = diag(s, "H0");
  eq(d.code, "store-empty"); assert(d.message.includes("battery B0") && d.message.includes("0% full"), d.message);
});
test("a charged battery lights the house and gets the credit", () => {
  const s = sunState(); part(s, "B0", "BAT", { Vprev: 12 }); part(s, "H0", "HOUSE"); wire(s, "B0", "H0"); wire(s, "H0b", "B0b");
  const d = diag(s, "H0");
  assert(d.lit && d.message.includes("battery B0"), d.message);
});
test("a solar loop through GND (sharing the ground rail) is found too", () => {
  const s = sunState(0); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "GND"); wire(s, "S0b", "GND");
  eq(diag(s, "H0").code, "solar-weak");
});
test("a GEN-powered house is unaffected by the new checks", () => {
  const s = sunState(); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0");
  eq(diag(s, "H0").code, "no-return");
});
test("at night (bigger load) an overloaded house's answer says buildings need more power now", () => {
  const s = sunState(); s.loadScale = 0.6;
  for (const id of ["H0", "H1", "H2"]) { part(s, id, "HOUSE"); wire(s, "GEN", id); wire(s, id + "b", "GND"); }
  const d = diag(s, "H0");
  eq(d.code, "dim"); assert(d.message.includes("extra power right now"), d.message);
  s.loadScale = 1; const d2 = diag(s, "H0"); eq(d2.code, "lit");
});
test("solar panel and battery cards", () => {
  const s = sunState(1.6); part(s, "S0", "SOLAR"); part(s, "B0", "BAT", { Vprev: 9 }); computePower(s);
  assert(describePart(s, "S0").includes("sunny"), describePart(s, "S0"));
  assert(describePart(s, "B0").includes("75% full"), describePart(s, "B0"));
  s.solarFactor = 0; assert(describePart(s, "S0").includes("night"), describePart(s, "S0"));
  s.solarFactor = 0.5; assert(describePart(s, "S0").includes("Clouds"), describePart(s, "S0"));
});


console.log("Popped LEDs can always be replaced, and every part works on its own");
const ledWith = (ohms) => { const s = makeState(); part(s, "R0", "RES", { ohms }); part(s, "L0", "LED"); wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND"); computePower(s); return s; };
test("each resistor preset with an LED: Small pops, Medium is bright, Large is dim", () => {
  eq(ledWith(100).powered.get("L0").level, "BURNED");
  eq(ledWith(470).powered.get("L0").level, "ON");
  eq(ledWith(1000).powered.get("L0").level, "DIM");
});
test("rewiring a popped LED's circuit fits a new one, and a safe circuit then lights it", () => {
  const s = ledWith(100); assert(s.nodes.get("L0").data.burned);
  // Swap the Small resistor for a Medium one: the wire into the LED is re-made.
  s.wires = s.wires.filter(w => w.a !== "R0b"); part(s, "R1", "RES", { ohms: 470 });
  wire(s, "GEN", "R1"); wire(s, "R1b", "L0");
  eq(poppedLEDsTouched(s, ["R1b", "L0"]).join(), "L0");
  s.nodes.get("L0").data.burned = false; computePower(s);
  eq(s.powered.get("L0").level, "ON");
});
test("a change two parts away along the same chain counts (GEN -> new resistor -> old wire -> LED)", () => {
  const s = ledWith(100);
  s.wires = s.wires.filter(w => !(w.a === "GEN" && w.b === "R0"));
  eq(poppedLEDsTouched(s, ["GEN", "R0"], [...s.wires, { a: "GEN", b: "R0" }]).join(), "L0");
});
test("a change on a different chain (only sharing GEN/GND) leaves a popped LED alone", () => {
  const s = ledWith(100); part(s, "H0", "HOUSE"); wire(s, "GEN", "H0");
  eq(poppedLEDsTouched(s, ["H0b", "GND"], [...s.wires, { a: "H0b", b: "GND" }]).length, 0);
});
test("an LED that isn't popped is never 'refitted'", () => {
  const s = ledWith(470); eq(poppedLEDsTouched(s, ["R0b", "L0"]).length, 0);
});
test("the popped message tells the kid how to get a new LED", () => {
  const d = diag(ledWith(100), "L0"); eq(d.code, "popped"); assert(/tap the LED/i.test(d.message), d.message);
});
test("popped: the message names the real cause", () => {
  // Straight to GEN, no resistor.
  let s = makeState(); part(s, "L0", "LED"); wire(s, "GEN", "L0"); wire(s, "L0b", "GND"); computePower(s);
  assert(/straight to GEN/.test(diag(s, "L0").message), diag(s, "L0").message);
  // A Small resistor still hooked up beside the new Medium one.
  s = makeState(); part(s, "R0", "RES", { ohms: 100 }); part(s, "R1", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "GEN", "R1"); wire(s, "R1b", "L0"); wire(s, "L0b", "GND"); computePower(s);
  eq(s.powered.get("L0").level, "BURNED", "the Small one still pops it");
  const m = diag(s, "L0").message; assert(/R0/.test(m) && /still connected/.test(m), m);
  eq(ledPopCause(s, "L0").at, "R0", "points at R0");
});
test("two LEDs sharing one resistor: dim, and the advice says they share (never 'go smaller')", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED"); part(s, "L1", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "R0b", "L1"); wire(s, "L0b", "GND"); wire(s, "L1b", "GND"); computePower(s);
  eq(s.powered.get("L0").level, "DIM", "shared current is dim");
  const m = diag(s, "L0").message; assert(/shares resistor R0 with L1/.test(m) && /its own Medium/.test(m), m);
  // And the fix works: give L1 its own Medium.
  const t = makeState(); part(t, "R0", "RES", { ohms: 470 }); part(t, "R1", "RES", { ohms: 470 }); part(t, "L0", "LED"); part(t, "L1", "LED");
  wire(t, "GEN", "R0"); wire(t, "R0b", "L0"); wire(t, "GEN", "R1"); wire(t, "R1b", "L1"); wire(t, "L0b", "GND"); wire(t, "L1b", "GND"); computePower(t);
  eq(t.powered.get("L0").level + "/" + t.powered.get("L1").level, "ON/ON", "each with its own Medium");
});
test("an LED dark because the power plant is resting says so", () => {
  const s = makeState(); s.genScale = 0.2; part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND"); computePower(s);
  assert(s.powered.get("L0").level !== "ON", "not bright");
  assert(/power plant is hardly making any power/.test(diag(s, "L0").message), diag(s, "L0").message);
});
test("an LED dim because the generator is worn out by buildings says so (not 'smaller resistor')", () => {
  const s = makeState(); s.loadScale = 1 / 0.7; part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND");
  for (let i = 0; i < 12; i++) { part(s, "H" + i, "HOUSE"); wire(s, "GEN", "H" + i); wire(s, "H" + i + "b", "GND"); }
  computePower(s);
  const p = s.powered.get("L0");
  assert(p.level !== "ON", "twelve buildings at night wear the little generator out: " + p.level);
  const m = diag(s, "L0").message; assert(/worn out/.test(m) && /pop/.test(m), m);
});
test("two LEDs in a row: Medium lights both, Small pops", () => {
  for (const [ohms, want] of [[470, "ON"], [100, "BURNED"]]) {
    const s = makeState(); part(s, "R0", "RES", { ohms }); part(s, "L0", "LED"); part(s, "L1", "LED");
    wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "L1"); wire(s, "L1b", "GND"); computePower(s);
    assert([s.powered.get("L0").level, s.powered.get("L1").level].includes(want), ohms + ": " + s.powered.get("L0").level + "/" + s.powered.get("L1").level);
  }
});
test("an LED wired backwards stays off (and is not damaged)", () => {
  const s = makeState(); part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED");
  wire(s, "GEN", "R0"); wire(s, "R0b", "L0b"); wire(s, "L0", "GND"); computePower(s);
  eq(s.powered.get("L0").level, "OFF"); assert(!s.nodes.get("L0").data.burned);
});
test("every shop building lights up on its own, wired straight to the generator", () => {
  for (const key of Object.keys(BUILDINGS).filter(k => !BUILDINGS[k].bigPlant)) {
    const s = sunState(); building(s, "H0", key); wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); computePower(s);
    eq(s.powered.get("H0").level, "ON", key);
  }
});
test("the stadium needs a big power plant, exactly as its shop card says", () => {
  const lit = (R, w, night) => { const s = Object.assign(sunState(), environmentFor(WEATHER[w], night)); s.R_GEN = R; building(s, "H0", "stadium"); wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); computePower(s); return s.powered.get("H0").level === "ON"; };
  assert(!lit(1.5, "normal", false), "not on the little generator");
  for (const w of Object.keys(WEATHER)) for (const night of [false, true]) {
    assert(!lit(1.5, w, night), `never on the little generator (${w}, ${night})`);
    // "a hydro dam or stronger keeps it bright day and night"
    for (const k of PLANT_KEYS.filter(k => PLANTS[k].R <= PLANTS.hydro.R)) assert(lit(PLANTS[k].R, w, night), `${k}, ${w}, ${night ? "night" : "day"}`);
  }
});
test("every shop building lights on its own in every weather, day and night", () => {
  for (const w of Object.keys(WEATHER)) for (const night of [false, true]) for (const key of Object.keys(BUILDINGS).filter(k => !BUILDINGS[k].bigPlant)) {
    const s = Object.assign(sunState(), environmentFor(WEATHER[w], night)); building(s, "H0", key); wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); computePower(s);
    eq(s.powered.get("H0").level, "ON", `${key}, ${w}, ${night ? "night" : "day"}`);
  }
});
test("a house through a switch: ON lights it, OFF darkens it", () => {
  for (const on of [true, false]) {
    const s = makeState(); part(s, "T0", "TRANS", { on }); part(s, "H0", "HOUSE");
    wire(s, "GEN", "T0"); wire(s, "T0b", "H0"); wire(s, "H0b", "GND"); computePower(s);
    eq(s.powered.get("H0").level, on ? "ON" : "OFF", "switch " + on);
  }
});
test("a solar panel lights a house by day, not at night; a charged battery carries it", () => {
  const s = sunState(1); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "S0b"); computePower(s);
  eq(s.powered.get("H0").level, "ON"); s.solarFactor = 0; computePower(s); eq(s.powered.get("H0").level, "OFF");
  const b = sunState(); part(b, "B0", "BAT", { Vprev: 12 }); part(b, "H0", "HOUSE"); wire(b, "B0", "H0"); wire(b, "H0b", "B0b"); computePower(b, 1 / 30);
  eq(b.powered.get("H0").level, "ON");
});


console.log("Every part works with every other part");
{
  // The game's real starting state (every constant), with just GEN and GND.
  const makeState = () => {
    const s = createGameState(); s.nodes = new Map(); s.wires = [];
    s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} }); s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
    return s;
  };
  const KINDS = ["HOUSE", "RES", "LED", "TRANS", "CAP", "XFMR", "SOLAR", "BAT"];
  const mk = (s, kind, id) => {
    if (kind === "XFMR") { xfmr(s, id, 1); return [id + "P", id]; }
    const data = kind === "RES" ? { ohms: 470 } : kind === "CAP" ? { uF: 220, C: 220e-6 * s.CAP_TIME_SCALE, Vprev: 0 } : kind === "TRANS" ? { on: true } : kind === "BAT" ? { C: s.BAT_C, Vprev: 6 } : {};
    part(s, id, kind, data); return [id, id + "b"];
  };
  const sane = (s, what) => {
    assert(!s.solverError, what + ": solver error " + s.solverError);
    for (const [k, v] of s.nodeVoltages) assert(Number.isFinite(v) && Math.abs(v) < 200, `${what}: ${k} = ${v}`);
    for (const n of s.nodes.values()) if ((n.type === "HOUSE" || n.type === "LED") && !s.powered.has(n.id)) throw new Error(what + ": no reading for " + n.id);
  };
  test("every pair of parts, one after the other (GEN → A → B → GND) and side by side, solves sensibly", () => {
    let n = 0;
    for (const a of KINDS) for (const b of KINDS) {
      // In a row.
      let s = makeState(); const [a1, a2] = mk(s, a, "A0"), [b1, b2] = mk(s, b, "B0");
      wire(s, "GEN", a1); wire(s, a2, b1); wire(s, b2, "GND");
      for (let t = 0; t < 5; t++) computePower(s, 0.1);
      sane(s, `${a}→${b} in a row`);
      // Side by side.
      s = makeState(); const [c1, c2] = mk(s, a, "A0"), [d1, d2] = mk(s, b, "B0");
      wire(s, "GEN", c1); wire(s, c2, "GND"); wire(s, "GEN", d1); wire(s, d2, "GND");
      for (let t = 0; t < 5; t++) computePower(s, 0.1);
      sane(s, `${a} ∥ ${b}`);
      n += 2;
    }
    eq(n, 128, "all 64 pairs, both ways");
  });
  test("each part does its job in a circuit (has a purpose)", () => {
    const lit = (s, id) => s.powered.get(id)?.level;
    // What each part should teach: resistor, switch, transformer, capacitor/battery, solar.
    let s = makeState(); part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED"); wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND"); computePower(s);
    eq(lit(s, "L0"), "ON", "resistor + LED");
    s = makeState(); part(s, "T0", "TRANS", { on: false }); part(s, "H0", "HOUSE"); wire(s, "GEN", "T0"); wire(s, "T0b", "H0"); wire(s, "H0b", "GND"); computePower(s);
    eq(lit(s, "H0"), "OFF", "switch off → dark"); s.nodes.get("T0").data.on = true; computePower(s); eq(lit(s, "H0"), "ON", "switch on → lit");
    s = makeState(); xfmr(s, "X0", 2); wire(s, "GEN", "X0P"); part(s, "H0", "HOUSE"); wire(s, "X0", "H0"); wire(s, "H0b", "GND"); computePower(s);
    assert(s.nodeVoltages.get("X0") > 15, "step-up doubles the voltage: " + s.nodeVoltages.get("X0"));
    s = makeState(); part(s, "S0", "SOLAR"); part(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "S0b"); computePower(s);
    eq(lit(s, "H0"), "ON", "solar by day");
    s = makeState(); part(s, "B0", "BAT", { C: s.BAT_C, Vprev: 12 }); part(s, "H0", "HOUSE"); wire(s, "B0", "H0"); wire(s, "H0b", "B0b"); computePower(s, 0.1);
    eq(lit(s, "H0"), "ON", "battery runs a house");
    s = makeState(); part(s, "C0", "CAP", { uF: 1000, C: 1000e-6 * s.CAP_TIME_SCALE, Vprev: 0 }); wire(s, "GEN", "C0"); wire(s, "C0b", "GND");
    for (let t = 0; t < 120; t++) computePower(s, 0.5); // a minute of game time
    assert(Math.abs(s.nodes.get("C0").data.Vprev) > 10, "capacitor charges: " + s.nodes.get("C0").data.Vprev);
  });
}
console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "features", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
