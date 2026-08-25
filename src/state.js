// src/state.js

function createGameState() {
  return {
    // graph
    nodes: new Map(),   // id -> node
    wires: [],          // {a,b,line,labelText?}

    // wiring tool
    wireStart: null,
    previewLine: null,
    wireDepth: 10,

    // undo/redo (snapshot-based, see main.js#serializeBuild/loadBuild)
    undoStack: [],
    redoStack: [],
    historyLimit: 50,

    // counters
    counters: { H: 0, R: 0, T: 0, L: 0, C: 0, X: 0 },

    // sim outputs (recomputed every solve — never hand-author these)
    nodeVoltages: new Map(),
    powered: new Map(),        // loadId -> {V, I, level}
    wireMetrics: new Map(),    // "A|B" -> {R, Iab, Vab}
    solverError: false,        // true when the last solve hit a degenerate/singular matrix

    // tool mode
    mode: Mode.WIRE,

    // ---------- ELECTRICAL CONSTANTS ----------
    V: 12.0,           // GEN's ideal (no-load) EMF
    R_WIRE: 0.03,       // small wire resistance, per hop

    // GEN is modeled as a Thevenin source: an ideal 12V EMF behind an internal
    // resistance. This is *why* voltage sags as you add load — a real generator
    // isn't an infinite ideal source either. GND is treated as an ideal (zero
    // resistance) return rail: real ground/return conductors are thick and short
    // enough that their resistance is negligible next to everything else in this
    // sandbox, and giving GND its own sag would teach a second lesson at the same
    // time as the first one, which muddies rather than reinforces it.
    //
    // Value chosen by worked-example playtesting (see sim.js test suite for the
    // asserted numbers): with R_GEN = 1.5Ω, one house sags GEN from 12.00V to
    // ~11.08V (visible but clearly ON), four houses in parallel sags it to
    // exactly the ON/DIM boundary (9.00V) — a natural "aha, I'm overloading it"
    // moment — and it takes ~10 houses to fully brown out to OFF. That's a wide,
    // legible band to experiment in rather than a cliff-edge.
    R_GEN: 1.5,

    // loads to the GND rail (gated — see sim.js reachableGND: a load only draws
    // current if there's an actual wire path back to GND, i.e. a closed loop)
    R_HOUSE: 18,       // house load, plain resistor (a house is a lumped abstraction
                       // of many small loads, which really is well-approximated as
                       // linear/resistive in aggregate — unlike a single LED, see below)

    // ---------- LED MODEL ----------
    // A real LED is NOT a resistor — it has a roughly constant forward voltage
    // drop once conducting (varies ~1.8-3.3V by color/type in reality; we use one
    // representative value) plus a small internal/bulk resistance, and it does not
    // start conducting at all below that forward voltage. Modeling it as a plain
    // resistor (the old behavior) hides the entire reason a series resistor is
    // needed — with a diode, the resistor's job is genuinely to *limit current*,
    // because the LED itself has already "claimed" its ~2V and the rest of the
    // supply voltage drops across whatever resistance is in the loop. This is the
    // single most important lesson this component teaches, so it is worth getting
    // right rather than approximating away.
    V_LED_F: 2.0,        // forward voltage drop once conducting
    R_LED_INTERNAL: 10,  // small internal/bulk resistance (keeps the model well-posed,
                          // adds a touch of realism: current isn't perfectly current-limited
                          // by V_F alone)
    I_LED_GLOW: 0.003,   // 3mA — starts visibly glowing (DIM)
    I_LED_BRIGHT: 0.012, // 12mA — solid, healthy brightness (ON)
    I_LED_MAX: 0.025,    // 25mA — real 5mm LEDs are typically rated for continuous
                          // currents around 20mA with an absolute max in the
                          // ballpark of 25-30mA; above this it visibly burns out.

    // resistor tool — presets replace the old free-text prompt() (see ui.js).
    // Values picked as a deliberate teaching curve against a 12V supply and a
    // directly-wired LED (R_GEN 1.5Ω + R_LED_INTERNAL 10Ω + ~0.06Ω of wire already
    // in the loop, LED forward drop 2V, so (12-2)V drives the loop):
    //   Small  (100Ω) -> I ≈ 86mA  -> exceeds I_LED_MAX, LED still burns (not enough!)
    //   Medium (470Ω) -> I ≈ 20.8mA -> safely under I_LED_MAX, bright and healthy
    //   Large (1000Ω) -> I ≈ 9.9mA  -> safely under I_LED_MAX, dimmer but fine
    // so "the reasonable middle choice" is also the *correct* one, Small fails
    // informatively, and Large shows the safe-but-dimmer tradeoff continuum
    // instead of a hard pass/fail. Advanced mode still allows an exact typed value.
    RES_PRESETS: [
      { label: "Small", ohms: 100 },
      { label: "Medium", ohms: 470 },
      { label: "Large", ohms: 1000 },
    ],
    RES_DEFAULT_OHMS: 470,
    placeResOhms: 470,

    // capacitor tool (user enters µF, or picks a preset)
    CAP_PRESETS: [
      { label: "Small", uF: 47 },
      { label: "Medium", uF: 220 },
      { label: "Large", uF: 1000 },
    ],
    CAP_DEFAULT_UF: 220,
    placeCapUF: 220,

    // Scales the capacitor's effective capacitance so charging is slow enough to
    // *watch* — real RC charge times with milliohm-scale wire resistance are
    // sub-millisecond, which would look instantaneous and teach nothing about
    // "time" at all. This is the ONE knob for that (an earlier version of this
    // file had a second, undocumented knob here that did the same job and was
    // never wired up correctly — consolidated into just this one).
    // With R_GEN = 1.5Ω and a 220µF cap wired straight to GEN/GND, this gives a
    // time constant τ = R·C ≈ 1.5 × (220e-6 × 9000) ≈ 3.0 seconds — long enough
    // to visibly watch charge, short enough not to bore anyone. Adding series
    // resistance lengthens it further, same as a real RC circuit.
    CAP_TIME_SCALE: 9000,

    // transformer tool
    XFMR_PRESETS: [
      { label: "Step down ×0.5", ratio: 0.5 },
      { label: "1:1", ratio: 1.0 },
      { label: "Step up ×2", ratio: 2.0 },
    ],
    XFMR_DEFAULT_RATIO: 0.5, // step-down by default (12V -> 6V)
    placeXfmrRatio: 0.5,

    // thresholds for "on/dim/off" (houses are voltage-thresholded — a real house's
    // aggregate load doesn't have one clean current-based failure point the way a
    // single LED does, so voltage remains the honest signal there)
    V_HOUSE_ON: 9.0,
    V_HOUSE_DIM: 7.0,

    // ---------- DISPLAY TOGGLES ----------
    // Beginner-first: numbers start OFF. A kid should read a circuit by what it
    // *does* (lit / dim / dark, moving dots, wire color) before being handed
    // digits. "Show Numbers" is the one toggle that reveals V/I readouts and the
    // wire metric labels together; resistance labels and raw wire-current detail
    // stay behind their own sub-toggles once numbers are on, for a kid who wants
    // to go deeper.
    showVoltage: false,
    showCurrent: false,
    showResistance: false,
    advancedWireCurrent: false, // starts OFF (simple mode)

    // Wire load-coloring thresholds (Poly Bridge steal, see DESIGN.md) — purely
    // cosmetic, not a hard limit like I_LED_MAX. A single house direct on GEN
    // draws well under 1A with these constants, so anything crossing ~0.6A
    // means several loads are sharing one wire — a reasonable "getting busy"
    // cue, with ~1.2A as "quite loaded."
    WIRE_WARM_I: 0.6,
    WIRE_HOT_I: 1.2,

    // ---------- SIM TIMING ----------
    dt: 1 / 30,
    dirty: true, // set on any topology/parameter change; gates the expensive solve (see main.js)
  };
}
