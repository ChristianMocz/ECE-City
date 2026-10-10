// src/rules/missions.js
//
// Five short training missions. Each gives the player a clear goal and
// teaches one idea. Pure data and checks, no Phaser. The board starts from
// `setup` (the same snapshot format undo/redo uses), and `check(state, ctx)`
// runs after every solve.
//
//   ctx.genCurrent    amps the generator is supplying right now
//   ctx.switchCycled  a switch flip turned a house OFF and a later flip turned
//                     it back ON (so the switch really controls it)
//
// Main pieces: MISSIONS.
// Used by: src/scene/training.js, src/scene/menus.js.

// The starting board for the first two missions: three houses, one wired.
const STARTER_TOWN = {
  counters: { H: 3, R: 0, T: 0, L: 0, C: 0, X: 0 },
  parts: [
    { kind: "HOUSE", id: "H0", x: 430, y: 260 },
    { kind: "HOUSE", id: "H1", x: 650, y: 260 },
    { kind: "HOUSE", id: "H2", x: 650, y: 440 },
  ],
  wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
};

function missionLevel(state, id) { return state.powered?.get(id)?.level ?? "OFF"; }
function missionNodesOfType(state, type) { return [...state.nodes.values()].filter(n => n.type === type); }

const MISSIONS = [
  {
    title: "Light it up!",
    goal: "House H1 is dark. Wire it up so it glows too!",
    hint: "Tap GEN's orange dot, then H1's orange dot. Then wire H1's blue dot to GND. Power needs a loop: out of GEN and back home to GND!",
    setup: STARTER_TOWN,
    check: (state) => missionLevel(state, "H1") === "ON",
  },
  {
    title: "The whole street",
    goal: "Light up ALL three houses at the same time!",
    hint: "Every house needs its own loop: its orange dot to GEN, its blue dot to GND. Tap a dark house to see what it's missing.",
    setup: STARTER_TOWN,
    check: (state) => {
      const houses = missionNodesOfType(state, "HOUSE");
      return houses.length >= 3 && houses.every(h => missionLevel(state, h.id) === "ON");
    },
  },
  {
    title: "Save the LED",
    goal: "Make an LED shine brightly — without it popping!",
    hint: "LEDs are delicate! Put a resistor in front: GEN → resistor → LED → GND. Try the Medium resistor. (If it pops, fix the circuit and tap the LED to fit a new one.)",
    setup: {
      counters: { H: 0, R: 0, T: 0, L: 1, C: 0, X: 0 },
      parts: [{ kind: "LED", id: "L0", x: 560, y: 300 }],
      wires: [],
    },
    check: (state) => missionNodesOfType(state, "LED").some(n => missionLevel(state, n.id) === "ON"),
  },
  {
    title: "Light switch",
    goal: "Wire the switch so it turns the house OFF — and back ON again.",
    hint: "Put the switch in the loop: GEN → switch → house → GND. Then tap the switch's body to flip it off and on.",
    setup: {
      counters: { H: 1, R: 0, T: 1, L: 0, C: 0, X: 0 },
      parts: [
        { kind: "TRANS", id: "T0", x: 400, y: 280, on: true },
        { kind: "HOUSE", id: "H0", x: 650, y: 280 },
      ],
      wires: [],
    },
    check: (state, ctx) => !!ctx.switchCycled,
  },
  {
    title: "Capacitor power",
    goal: "Keep a house lit with ONLY a charged capacitor — no generator!",
    hint: "Wire GEN → capacitor → GND to fill it up, and wire the capacitor to the house too. When it's full, use DELETE on the wire from GEN!",
    setup: {
      counters: { H: 1, R: 0, T: 0, L: 0, C: 1, X: 0 },
      parts: [
        { kind: "CAP", id: "C0", x: 400, y: 280, uF: 220 },
        { kind: "HOUSE", id: "H0", x: 650, y: 280 },
      ],
      wires: [],
    },
    check: (state, ctx) =>
      ctx.genCurrent < 0.001 &&
      missionNodesOfType(state, "CAP").length > 0 &&
      missionNodesOfType(state, "HOUSE").some(h => missionLevel(state, h.id) === "ON"),
  },
];
