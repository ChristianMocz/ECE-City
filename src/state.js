import { Mode } from "./ui.js";

export function createGameState() {
  return {
    mode: Mode.WIRE,

    // nodes: Map(id -> {id,type,container,hit,visual,data})
    nodes: new Map(),

    // wires: Array({a,b,line,r})
    wires: [],

    // wiring interaction
    wireStart: null,     // node id or null
    previewLine: null,   // Phaser.GameObjects.Line or null

    // “ECE-ish” model (simple, stable)
    V: 10,
    R_WIRE: 1.0,
    R_RES: 8.0,
    R_HOUSE: 6.0,
    R_LED: 3.0,

    I_ON: 1.0,
    I_DIM: 0.6,

    powered: new Map(), // id -> {I, level}

    counters: { H: 0, R: 0, T: 0, L: 0 }
  };
}
