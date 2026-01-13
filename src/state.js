// src/state.js
import { Mode } from "./ui.js";

export function createGameState() {
  return {
    // graph
    nodes: new Map(),
    wires: [],

    // wiring tool
    wireStart: null,
    previewLine: null,
    wireDepth: 10,

    // counters
    counters: { H: 0, R: 0, T: 0, L: 0 },

    // sim outputs
    nodeVoltages: new Map(),
    powered: new Map(),

    // tool mode
    mode: Mode.WIRE,

    // ---------- ELECTRICAL CONSTANTS ----------
    V: 12,          // Generator voltage

    // Make wire loss tiny so direct connections read ~12.00V
    R_WIRE: 0.03,

    R_HOUSE: 18,
    R_LED: 30,

    // placement default values
    RES_DEFAULT_OHMS: 2.0,
    placeResOhms: 2.0,

    // Voltage thresholds
    V_HOUSE_ON: 9.0,
    V_HOUSE_DIM: 7.0,

    V_LED_ON: 3.0,
    V_LED_DIM: 2.2,
  };
}
