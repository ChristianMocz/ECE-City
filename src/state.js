// src/state.js
import { Mode } from "./ui.js";

export function createGameState() {
  return {
    // graph
    nodes: new Map(),   // id -> node
    wires: [],          // {a,b,line,labelText?}

    // wiring tool
    wireStart: null,
    previewLine: null,
    wireDepth: 10,

    // counters
    counters: { H: 0, R: 0, T: 0, L: 0, C: 0, X: 0 },

    // sim outputs
    nodeVoltages: new Map(),
    powered: new Map(),        // loadId -> {V, I, level}
    wireMetrics: new Map(),    // "A|B" -> {R, Iab, Vab}

    // tool mode
    mode: Mode.WIRE,

    // ---------- ELECTRICAL CONSTANTS ----------
    V: 12.0,           // GEN voltage (exactly 12V)
    R_WIRE: 0.03,      // small wire resistance

    // loads to ground (simple intro model)
    R_HOUSE: 18,       // house load to ground
    R_LED: 30,         // LED load to ground

    // resistor tool
    RES_DEFAULT_OHMS: 2.0,
    placeResOhms: 2.0,

    // capacitor tool (user enters µF)
    CAP_DEFAULT_UF: 220,
    placeCapUF: 220,

    // ✅ Makes capacitor charging visually slower (still capped)
    // Real RC with wires this small charges instantly. We scale C internally so it teaches "time".
    // Larger => slower charging/discharging.
    CAP_TIME_SCALE: 8000,

    // transformer tool
    XFMR_DEFAULT_RATIO: 0.5, // step-down by default (12V -> 6V)
    placeXfmrRatio: 0.5,

    // thresholds for “on/dim/off”
    V_HOUSE_ON: 9.0,
    V_HOUSE_DIM: 7.0,
    V_LED_ON: 3.0,
    V_LED_DIM: 2.2,

    // ---------- DISPLAY TOGGLES ----------
    showVoltage: true,
    showCurrent: true,
    showResistance: false,
    advancedWireCurrent: false, // starts OFF (simple mode)

    // ---------- SIM TIMING ----------
    dt: 1 / 30,
  };
}
