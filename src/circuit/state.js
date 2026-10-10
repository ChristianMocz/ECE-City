// src/circuit/state.js
//
// The game state for one circuit board: parts, wires, undo history, the
// solver's latest results, and every electrical constant (volts, ohms, amps)
// the physics uses. Numbers are tuned against a 12 V generator.
//
// Main pieces: createGameState().
// Used by: src/scene/setup.js. Read by src/circuit/solver.js and diagnose.js.

function createGameState() {
  return {
    // graph
    nodes: new Map(),   // id -> node
    wires: [],          // {a,b,line,labelText?}

    // wiring tool
    wireStart: null,
    previewLine: null,
    wireDepth: 10,

    // undo/redo snapshots (see serializeBuild in src/scene/board.js)
    undoStack: [],
    redoStack: [],
    historyLimit: 50,

    // counters
    counters: { H: 0, R: 0, T: 0, L: 0, C: 0, X: 0, S: 0, B: 0 },

    // solver outputs, rewritten on every solve
    nodeVoltages: new Map(),
    powered: new Map(),        // loadId -> {V, I, level}
    wireMetrics: new Map(),    // "A|B" -> {R, Iab, Vab}
    solverError: false,        // true when the last solve hit a singular matrix

    // tool mode
    mode: Mode.WIRE,

    // --- Electrical constants ---
    V: 12.0,           // GEN's push with no load (volts)
    R_WIRE: 0.03,       // resistance of one wire (ohms)

    // GEN is a 12 V source behind this internal resistance, so its voltage sags
    // as you add load. GND is an ideal 0 V return.
    // 1.5 ohms: one house sags GEN to ~11.1 V, four houses hit the 9 V ON/DIM
    // line, and ~10 houses brown out to OFF.
    R_GEN: 1.5,

    // A house is a plain resistor to its return dot (many small loads add up to
    // something close to linear). It only draws current in a closed loop.
    R_HOUSE: 18,       // ohms

    // --- LED model ---
    // An LED is a diode, not a resistor: it drops a fixed ~2 V once conducting
    // and blocks below that. So a series resistor's job is to limit the current.
    V_LED_F: 2.0,        // forward voltage drop (volts)
    R_LED_INTERNAL: 10,  // small internal resistance (ohms), keeps the maths well-behaved
    I_LED_GLOW: 0.003,   // 3 mA: starts to glow (DIM)
    I_LED_BRIGHT: 0.012, // 12 mA: fully bright (ON)
    I_LED_MAX: 0.025,    // 25 mA: burns out (real 5 mm LEDs are rated ~20 mA)

    // Resistor presets, against 12 V and one LED (10 V left after the LED's drop):
    //   Small 100 ohm  -> ~86 mA, LED pops
    //   Medium 470 ohm -> ~21 mA, bright and safe
    //   Large 1000 ohm -> ~10 mA, safe but dimmer
    // Advanced mode still allows a typed value.
    RES_PRESETS: [
      { label: "Small", ohms: 100, tip: "pops an LED!" },
      { label: "Medium", ohms: 470, tip: "best for an LED" },
      { label: "Large", ohms: 1000, tip: "makes an LED dim" },
    ],
    RES_DEFAULT_OHMS: 470,
    placeResOhms: 470,

    // capacitor tool (value in µF)
    CAP_PRESETS: [
      { label: "Small", uF: 47 },
      { label: "Medium", uF: 220 },
      { label: "Large", uF: 1000 },
    ],
    CAP_DEFAULT_UF: 220,
    placeCapUF: 220,

    // Stretches capacitor charge time so you can watch it (real RC times here
    // are under a millisecond). A 220 µF cap on GEN: τ = 1.5 x 220e-6 x 9000 ≈ 3 s.
    // More series resistance makes it slower, like a real RC circuit.
    CAP_TIME_SCALE: 9000,

    // --- Solar panel and battery ---
    // A solar panel is a small source (V_SOLAR behind R_SOLAR). solarFactor is
    // the light level: 0 at night, 1 on a normal day, more when sunny. Set by
    // the game. One panel on one house in normal light gives 12 x 18/22 = 9.8 V.
    V_SOLAR: 12,
    R_SOLAR: 4,
    solarFactor: 1,
    // A battery is a very big capacitor: charges from GEN in ~30 s (1.5 x 20)
    // and keeps a cottage lit for minutes (discharge τ = 18 x 0.6 x 20 = 216 s).
    BAT_C: 20,

    // Multiplies every building's resistance. Below 1 at night and in a heat
    // wave (lights, air conditioning), so they draw more. Set by the game.
    loadScale: 1,

    // transformer tool
    XFMR_PRESETS: [
      { label: "Step down ×0.5", ratio: 0.5 },
      { label: "1:1", ratio: 1.0 },
      { label: "Step up ×2", ratio: 2.0 },
    ],
    XFMR_DEFAULT_RATIO: 0.5, // step-down by default (12V -> 6V)
    placeXfmrRatio: 0.5,

    // House brightness is judged by voltage (volts); LEDs are judged by current.
    V_HOUSE_ON: 9.0,
    V_HOUSE_DIM: 7.0,

    // --- Display toggles ---
    // Numbers start hidden: kids read the circuit by what it does first.
    // "Show Numbers" reveals V/I readouts; resistance and wire detail have their own toggles.
    showVoltage: false,
    showCurrent: false,
    showResistance: false,
    advancedWireCurrent: false, // starts OFF (simple mode)
    night: false,               // dark sky, glowing windows (see applyNight in src/scene/night.js)

    // Wire colour thresholds (amps), cosmetic only. One house draws well under 1 A,
    // so 0.6 A means several loads share a wire.
    WIRE_WARM_I: 0.6,
    WIRE_HOT_I: 1.2,

    // --- Timing ---
    dt: 1 / 30,
    dirty: true, // set on any change; the solve only runs when dirty
  };
}
