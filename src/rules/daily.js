// src/rules/daily.js
//
// Hand-made daily puzzles. One a day, picked by date, so everyone gets the
// same puzzle on the same day (see puzzleIndexFor in src/rules/game.js).
// Every part is already placed, so each puzzle can be solved with just the
// WIRE and DELETE tools and switch taps, at any level.
//
// Same shape as a mission: { title, goal, hint, setup, check(state, ctx) }.
// `solution` is the list of steps tests/game.test.mjs replays to prove each
// puzzle is solvable (and not already solved at the start):
//   ["wire", a, b]  ["unwire", a, b]  ["flip", switchId]
//
// Main pieces: DAILY_PUZZLES.
// Used by: src/scene/training.js, src/scene/menus.js.

function pzLit(state, id) { return state.powered?.get(id)?.level === "ON"; }
function pzGen(state) { return genAmps(state); }

const DAILY_PUZZLES = [
  {
    title: "Two houses, one generator",
    goal: "Make BOTH houses bright.",
    hint: "Each house needs its own loop: orange dot to GEN, blue dot to GND.",
    setup: { counters: { H: 2, R: 0, T: 0, L: 0, C: 0, X: 0 }, parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 650, y: 260 }], wires: [] },
    check: (s) => pzLit(s, "H0") && pzLit(s, "H1"),
    solution: [["wire", "GEN", "H0"], ["wire", "H0b", "GND"], ["wire", "GEN", "H1"], ["wire", "H1b", "GND"]],
  },
  {
    title: "Chain trouble",
    goal: "These houses are wired in a chain and both are dim. Make both bright!",
    hint: "In a chain, the houses share the voltage. Give each house its own path to GEN and GND.",
    setup: { counters: { H: 2, R: 0, T: 0, L: 0, C: 0, X: 0 }, parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 650, y: 260 }],
      wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "H1" }, { a: "H1b", b: "GND" }] },
    check: (s) => pzLit(s, "H0") && pzLit(s, "H1"),
    solution: [["unwire", "H0b", "H1"], ["wire", "H0b", "GND"], ["wire", "GEN", "H1"]],
  },
  {
    title: "Pick the right resistor",
    goal: "Make the LED shine brightly without popping it.",
    hint: "Too small a resistor lets too much through. Too big makes it dim. Try the middle one!",
    setup: { counters: { H: 0, R: 3, T: 0, L: 1, C: 0, X: 0 }, parts: [
      { kind: "RES", id: "R0", x: 330, y: 220, ohms: 100 }, { kind: "RES", id: "R1", x: 480, y: 220, ohms: 470 },
      { kind: "RES", id: "R2", x: 630, y: 220, ohms: 1000 }, { kind: "LED", id: "L0", x: 560, y: 430 }], wires: [] },
    check: (s) => pzLit(s, "L0"),
    solution: [["wire", "GEN", "R1"], ["wire", "R1b", "L0"], ["wire", "L0b", "GND"]],
  },
  {
    title: "Flip it",
    goal: "Everything is wired, but the house is dark. Light it up!",
    hint: "Look at the switch. Is its blade up or down?",
    setup: { counters: { H: 1, R: 0, T: 1, L: 0, C: 0, X: 0 }, parts: [
      { kind: "TRANS", id: "T0", x: 400, y: 280, on: false }, { kind: "HOUSE", id: "H0", x: 650, y: 280 }],
      wires: [{ a: "GEN", b: "T0" }, { a: "T0b", b: "H0" }, { a: "H0b", b: "GND" }] },
    check: (s) => pzLit(s, "H0"),
    solution: [["flip", "T0"]],
  },
  {
    title: "Backwards!",
    goal: "This LED has a resistor buddy but still won't light. Fix it!",
    hint: "LEDs only work one way round: orange dot toward GEN, blue dot toward GND.",
    setup: { counters: { H: 0, R: 1, T: 0, L: 1, C: 0, X: 0 }, parts: [
      { kind: "RES", id: "R0", x: 400, y: 220, ohms: 470 }, { kind: "LED", id: "L0", x: 600, y: 420 }],
      wires: [{ a: "GEN", b: "R0" }, { a: "R0b", b: "L0b" }, { a: "L0", b: "GND" }] },
    check: (s) => pzLit(s, "L0"),
    solution: [["unwire", "R0b", "L0b"], ["unwire", "L0", "GND"], ["wire", "R0b", "L0"], ["wire", "L0b", "GND"]],
  },
  {
    title: "The shortcut",
    goal: "Both houses are wired right, but they're dark. Find the problem!",
    hint: "Is there a wire that goes straight from GEN to GND? Electricity takes the easy way.",
    setup: { counters: { H: 2, R: 0, T: 0, L: 0, C: 0, X: 0 }, parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 650, y: 260 }],
      wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }, { a: "GEN", b: "H1" }, { a: "H1b", b: "GND" }, { a: "GEN", b: "GND" }] },
    check: (s) => pzLit(s, "H0") && pzLit(s, "H1"),
    solution: [["unwire", "GEN", "GND"]],
  },
  {
    title: "Too many houses",
    goal: "Five houses share one generator and they're all dim. Get 3 houses bright!",
    hint: "The generator can only do so much. Unplug a couple of houses.",
    setup: { counters: { H: 5, R: 0, T: 0, L: 0, C: 0, X: 0 }, parts: [
      { kind: "HOUSE", id: "H0", x: 330, y: 230 }, { kind: "HOUSE", id: "H1", x: 500, y: 230 }, { kind: "HOUSE", id: "H2", x: 670, y: 230 },
      { kind: "HOUSE", id: "H3", x: 420, y: 470 }, { kind: "HOUSE", id: "H4", x: 620, y: 470 }],
      wires: ["H0", "H1", "H2", "H3", "H4"].flatMap(h => [{ a: "GEN", b: h }, { a: h + "b", b: "GND" }]) },
    check: (s) => ["H0", "H1", "H2", "H3", "H4"].filter(h => pzLit(s, h)).length >= 3,
    solution: [["unwire", "GEN", "H3"], ["unwire", "GEN", "H4"]],
  },
  {
    title: "Not enough volts",
    goal: "A step-down transformer gives this house only half the voltage. Make it bright!",
    hint: "You don't always need a transformer. What if the house went straight to GEN?",
    setup: { counters: { H: 1, R: 0, T: 0, L: 0, C: 0, X: 1 }, parts: [
      { kind: "XFMR", id: "X0", x: 420, y: 250, ratio: 0.5 }, { kind: "HOUSE", id: "H0", x: 680, y: 260 }],
      wires: [{ a: "GEN", b: "X0P" }, { a: "X0", b: "H0" }, { a: "H0b", b: "GND" }] },
    check: (s) => pzLit(s, "H0"),
    solution: [["unwire", "X0", "H0"], ["wire", "GEN", "H0"]],
  },
  {
    title: "Stored power",
    goal: "This capacitor is already charged. Light the house with NO generator!",
    hint: "Make a loop: capacitor's orange dot to the house's orange dot, and blue to blue.",
    setup: { counters: { H: 1, R: 0, T: 0, L: 0, C: 1, X: 0 }, parts: [
      { kind: "CAP", id: "C0", x: 420, y: 280, uF: 1000, Vprev: 12 }, { kind: "HOUSE", id: "H0", x: 660, y: 280 }], wires: [] },
    check: (s) => pzLit(s, "H0") && pzGen(s) < 0.001,
    solution: [["wire", "C0", "H0"], ["wire", "H0b", "C0b"]],
  },
  {
    title: "The school needs more",
    goal: "The school needs 10 volts but it's dim. Make the school bright!",
    hint: "Every house on the same generator lowers the voltage a little. The school is the most important!",
    setup: { counters: { H: 3, R: 0, T: 0, L: 0, C: 0, X: 0 }, parts: [
      { kind: "HOUSE", id: "H0", x: 650, y: 240, building: "school" },
      { kind: "HOUSE", id: "H1", x: 430, y: 240 }, { kind: "HOUSE", id: "H2", x: 650, y: 470 }],
      wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }, { a: "GEN", b: "H1" }, { a: "H1b", b: "GND" }, { a: "GEN", b: "H2" }, { a: "H2b", b: "GND" }] },
    check: (s) => pzLit(s, "H0"),
    solution: [["unwire", "GEN", "H1"], ["unwire", "GEN", "H2"]],
  },
  {
    title: "Sunshine power",
    goal: "Light the house using only the solar panel.",
    hint: "A solar panel is a little generator of its own: make a loop from its orange dot, through the house, back to its blue dot.",
    setup: { counters: { H: 1, R: 0, T: 0, L: 0, C: 0, X: 0, S: 1 }, parts: [
      { kind: "SOLAR", id: "S0", x: 420, y: 260 }, { kind: "HOUSE", id: "H0", x: 660, y: 260 }], wires: [] },
    check: (s) => pzLit(s, "H0") && pzGen(s) < 0.001,
    solution: [["wire", "S0", "H0"], ["wire", "H0b", "S0b"]],
  },
  {
    title: "Two LEDs, one resistor",
    goal: "Make BOTH LEDs bright using just one resistor.",
    hint: "Put them in a line: GEN → resistor → LED → LED → GND.",
    setup: { counters: { H: 0, R: 1, T: 0, L: 2, C: 0, X: 0 }, parts: [
      { kind: "RES", id: "R0", x: 330, y: 220, ohms: 470 }, { kind: "LED", id: "L0", x: 520, y: 230 }, { kind: "LED", id: "L1", x: 700, y: 400 }], wires: [] },
    check: (s) => pzLit(s, "L0") && pzLit(s, "L1"),
    solution: [["wire", "GEN", "R0"], ["wire", "R0b", "L0"], ["wire", "L0b", "L1"], ["wire", "L1b", "GND"]],
  },
];
