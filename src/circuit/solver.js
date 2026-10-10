// src/circuit/solver.js
//
// The circuit physics (nodal analysis). Every part has two dots: an orange
// "hot" dot and a blue return dot. The solver writes one current-balance
// equation per dot (current in = current out) and solves them all at once
// for the voltages. A part with no wire path back to GND gets no current.
// GEN is a 12 V source with a small internal resistance, so it sags under load.
// LEDs are diodes (one way only, ~2 V drop). Capacitors and batteries remember
// their charge between frames. A transformer adds one extra unknown (its current).
//
// Main pieces: computePower(), solveNetwork(), branchParams(), genEmf(), genAmps().
// Used by: src/scene/power.js, src/circuit/diagnose.js, src/rules/game.js and others.

// GEN's push right now: 12 V times state.genScale (set by power plants, see
// src/rules/plants.js). 1 by default.
function genEmf(state) {
  return state.V * (state.genScale ?? 1);
}
// Amps GEN supplies right now (0 while its one-way valve has it switched off).
function genAmps(state) {
  if (state.genOff) return 0;
  const R = state.R_GEN;
  return Math.max(0, (genEmf(state) - (state.nodeVoltages?.get("GEN") ?? genEmf(state))) / R);
}

function transistorOn(node) {
  return !!node?.data?.on;
}

const TWO_TERMINAL_TYPES = new Set(["RES", "TRANS", "HOUSE", "LED", "CAP", "SOLAR", "BAT"]);

// A building's resistance right now. Each building type sets data.R (see
// BUILDINGS in src/rules/game.js); loadScale < 1 at night or in a heat wave means more current.
function houseR(state, node) {
  return (node.data?.R ?? state.R_HOUSE) * (state.loadScale ?? 1);
}

// Is there any sunlight? (solarFactor: 0 at night, 1 normal day, more when sunny.)
function solarActive(state) {
  return (state.solarFactor ?? 0) > 0;
}

// The inside of a two-dot part as { G, bias }, or null when it is open (no current).
// G is conductance (1/ohms). bias is a fixed current pushed from the return
// dot to the hot dot: how an LED's 2 V drop or a capacitor's charge enters the equations.
// ledOff: LEDs that are blocking this solve (open, like a burned one).
function branchParams(state, hotNode, dt, ledOff) {
  switch (hotNode.type) {
    case "RES": {
      const ohms = hotNode.data?.ohms ?? state.RES_DEFAULT_OHMS;
      return { G: 1 / ohms, bias: 0 };
    }
    case "TRANS": {
      if (!transistorOn(hotNode)) return null; // open switch
      return { G: 1 / 0.5, bias: 0 }; // 0.5 ohm when ON
    }
    case "HOUSE": {
      return { G: 1 / houseR(state, hotNode), bias: 0 };
    }
    case "SOLAR": {
      // A small source like GEN: V_SOLAR behind a resistance that shrinks in
      // brighter light. Open in the dark.
      if (!solarActive(state)) return null;
      const G = state.solarFactor / state.R_SOLAR;
      return { G, bias: G * state.V_SOLAR };
    }
    case "LED": {
      if (hotNode.data?.burned) return null; // burned out: open
      if (ledOff && ledOff.has(hotNode.id)) return null; // blocking this solve
      const G = 1 / state.R_LED_INTERNAL;
      return { G, bias: G * state.V_LED_F };
    }
    case "CAP":
    case "BAT": {
      // Backward-Euler step: conductance C/dt plus a current from the stored
      // charge (Vprev = voltage across it last frame). A battery is a big capacitor (BAT_C).
      const C = hotNode.data?.C ?? (hotNode.type === "BAT" ? state.BAT_C : 0);
      const dtCap = Math.max(1e-5, dt);
      const G = C / dtCap;
      const Vprev = hotNode.data?.Vprev ?? 0;
      return { G, bias: G * Vprev };
    }
    default:
      return null;
  }
}

function buildAdj(state) {
  const adj = new Map();
  for (const id of state.nodes.keys()) adj.set(id, []);
  for (const w of state.wires) {
    if (!state.nodes.has(w.a) || !state.nodes.has(w.b)) continue;
    adj.get(w.a).push({ to: w.b, R: state.R_WIRE });
    adj.get(w.b).push({ to: w.a, R: state.R_WIRE });
  }
  return adj;
}

// Links across the inside of each part (and transformer in <-> out), so the
// reachability search can cross parts. Open parts (switch OFF, burned LED) don't link.
function buildComponentBridges(state, dt, ledOff) {
  const links = new Map();
  const add = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    links.get(a).push(b);
  };
  for (const node of state.nodes.values()) {
    if (node.type === "XFMR_SEC") {
      const priId = node.data?.pairId;
      if (priId && state.nodes.has(priId)) { add(node.id, priId); add(priId, node.id); }
      continue;
    }
    if (!TWO_TERMINAL_TYPES.has(node.type)) continue;
    const bId = node.data?.pairId;
    if (!bId || !state.nodes.has(bId)) continue;
    if (branchParams(state, node, dt, ledOff)) { add(node.id, bId); add(bId, node.id); }
  }
  return links;
}

function reachableFrom(startId, adj, bridges = new Map()) {
  const reachable = new Set();
  if (!adj.has(startId) && !bridges.has(startId)) return reachable;

  const stack = [startId];
  reachable.add(startId);

  while (stack.length) {
    const u = stack.pop();
    for (const e of (adj.get(u) || [])) {
      if (!reachable.has(e.to)) { reachable.add(e.to); stack.push(e.to); }
    }
    for (const v of (bridges.get(u) || [])) {
      if (!reachable.has(v)) { reachable.add(v); stack.push(v); }
    }
  }
  return reachable;
}

// Gaussian elimination. Throws on a singular matrix rather than returning
// zeros, so "can't solve" (state.solverError) isn't mistaken for "unpowered".
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.slice().concat([b[i]]));

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-9) {
      throw new Error("Singular or ill-conditioned circuit matrix");
    }
    if (pivot !== col) { const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp; }

    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map(row => row[n]);
}

function levelByVoltage(state, Vn, data) {
  if (Vn >= (data?.vOn ?? state.V_HOUSE_ON)) return "ON";
  if (Vn >= (data?.vDim ?? state.V_HOUSE_DIM)) return "DIM";
  return "OFF";
}
function levelByCurrentLED(state, I) {
  if (I >= state.I_LED_BRIGHT) return "ON";
  if (I >= state.I_LED_GLOW) return "DIM";
  return "OFF";
}

// One linear solve with a fixed set of blocking LEDs. Writes nothing to state;
// returns { Vmap, error, unknowns, solved }.
function solveNetwork(state, dt, ledOff, genOff = false) {
  const adj = buildAdj(state);
  const bridges = buildComponentBridges(state, dt, ledOff);

  // With the valve shut (genOff), GEN is just a dot, solved only if another source reaches it.
  const solved = genOff ? new Set() : reachableFrom("GEN", adj, bridges);

  // Dots fixed at 0 V: GND, plus the source's return dot for any island that
  // never touches GND (voltage needs a reference point).
  const known0 = new Set(["GND"]);

  // Charged capacitors, charged batteries and sunlit solar panels are sources
  // too: solve their islands even when not wired to GEN.
  for (const node of state.nodes.values()) {
    if (solved.has(node.id)) continue;
    const isStore = node.type === "CAP" || node.type === "BAT";
    if (isStore && Math.abs(node.data?.Vprev ?? 0) < 1e-9) continue;
    if (!isStore && !(node.type === "SOLAR" && solarActive(state))) continue;
    const island = reachableFrom(node.id, adj, bridges);
    if (!island.has("GND")) known0.add(node.data?.pairId ?? node.id);
    for (const id of island) solved.add(id);
  }

  const unknownIds = [...solved].filter(id => !known0.has(id));
  const unknownSet = new Set(unknownIds);

  const xfmrPairs = [];
  for (const node of state.nodes.values()) {
    if (node.type !== "XFMR_SEC") continue;
    const priId = node.data?.pairId;
    if (!priId) continue;
    xfmrPairs.push({ priId, secId: node.id, ratio: node.data?.ratio ?? state.XFMR_DEFAULT_RATIO });
  }
  const activeXfmrPairs = xfmrPairs.filter(p => unknownSet.has(p.priId) && unknownSet.has(p.secId));

  const N = unknownIds.length;
  const K = activeXfmrPairs.length;
  const M = N + K;

  const Vmap = new Map();
  for (const id of state.nodes.keys()) Vmap.set(id, 0);
  Vmap.set("GND", 0);
  let error = false;

  if (M > 0) {
    const indexOf = new Map();
    unknownIds.forEach((id, i) => indexOf.set(id, i));

    const A = Array.from({ length: M }, () => new Array(M).fill(0));
    const b = new Array(M).fill(0);

    // One row per dot: GEN's internal source, then the wires.
    for (let i = 0; i < N; i++) {
      const id = unknownIds[i];
      let sumG = 0;

      if (id === "GEN" && !genOff) {
        const g = 1 / state.R_GEN;
        sumG += g;
        b[i] += g * genEmf(state);
      }

      for (const e of (adj.get(id) || [])) {
        const G = 1 / e.R;
        sumG += G;
        if (indexOf.has(e.to)) A[i][indexOf.get(e.to)] -= G;
        // a wire to GND adds nothing to b (GND is 0 V)
      }

      A[i][i] += sumG;
    }

    // The inside of each two-dot part.
    for (const node of state.nodes.values()) {
      if (!TWO_TERMINAL_TYPES.has(node.type)) continue;
      const bId = node.data?.pairId;
      if (!bId) continue;
      // Each dot must be an unknown or a fixed 0 V dot; otherwise skip the part.
      const hi = indexOf.get(node.id);
      const gi = indexOf.get(bId);
      if (hi === undefined && gi === undefined) continue;
      if (hi === undefined && !known0.has(node.id)) continue;
      if (gi === undefined && !known0.has(bId)) continue;
      const bp = branchParams(state, node, dt, ledOff);
      if (!bp) continue;

      if (hi !== undefined) {
        A[hi][hi] += bp.G;
        b[hi] += bp.bias;
        if (gi !== undefined) A[hi][gi] -= bp.G;
      }
      if (gi !== undefined) {
        A[gi][gi] += bp.G;
        b[gi] -= bp.bias;
        if (hi !== undefined) A[gi][hi] -= bp.G;
      }
    }

    // Ideal transformer: one extra unknown (its current) per transformer.
    // Forces Vsec = ratio x Vpri, and power in equals power out.
    activeXfmrPairs.forEach((p, k) => {
      const col = N + k;
      const pi = indexOf.get(p.priId);
      const si = indexOf.get(p.secId);
      A[pi][col] += p.ratio;
      A[si][col] += -1;
      A[col][pi] += p.ratio;
      A[col][si] += -1;
      b[col] = 0;
    });

    let X;
    try {
      X = solveLinear(A, b);
      if (!X.every(Number.isFinite)) throw new Error("non-finite solution");
    } catch (e) {
      error = true;
      X = new Array(M).fill(0);
    }
    for (let i = 0; i < N; i++) Vmap.set(unknownIds[i], X[i]);
  }

  return { Vmap, error, unknowns: unknownSet, solved };
}

// Full solve. LEDs are diodes, so solve repeatedly, starting with all LEDs on:
//   - an LED with negative current switches to blocking;
//   - a blocking LED with more than V_LED_F across it switches back on;
//   - once settled, any LED over I_LED_MAX burns and we solve again, so all
//     readouts show the circuit after the pop.
const MAX_DIODE_ITERATIONS = 40;

// GEN has a one-way valve (like a power station's reverse-power relay): if a
// charged battery or capacitor would push current back into it, GEN switches
// off (state.genOff) until it can push again.
function computePower(state, dt = state.dt) {
  const ledOff = new Set();
  const leds = [...state.nodes.values()].filter(n => n.type === "LED");
  let sol;
  let genOff = false;

  for (let iter = 0; iter < MAX_DIODE_ITERATIONS; iter++) {
    sol = solveNetwork(state, dt, ledOff, genOff);
    if (sol.error) break;

    // GEN valve: shut on backflow, reopen when the network is below GEN's push.
    if (!genOff && sol.unknowns.has("GEN")) {
      const Ig = (genEmf(state) - (sol.Vmap.get("GEN") ?? 0)) / state.R_GEN;
      if (Ig < -1e-6) { genOff = true; continue; }
    } else if (genOff) {
      const Vg = sol.solved.has("GEN") ? (sol.Vmap.get("GEN") ?? 0) : 0;
      if (Vg < genEmf(state) - 1e-6 && genEmf(state) > 0) { genOff = false; continue; }
    }

    const ledI = (node) => {
      const bId = node.data?.pairId;
      const Vacross = (sol.Vmap.get(node.id) ?? 0) - (bId ? (sol.Vmap.get(bId) ?? 0) : 0);
      return { Vacross, I: (Vacross - state.V_LED_F) / state.R_LED_INTERNAL };
    };

    let changed = false;
    for (const node of leds) {
      if (node.data?.burned) continue;
      const { Vacross, I } = ledI(node);
      if (!ledOff.has(node.id)) {
        if (I < -1e-9) { ledOff.add(node.id); changed = true; }
      } else if (Vacross > state.V_LED_F + 1e-9 && sol.unknowns.has(node.id)) {
        ledOff.delete(node.id); changed = true;
      }
    }
    if (changed) continue;

    // Diodes settled: now check for burnout.
    for (const node of leds) {
      if (node.data?.burned || ledOff.has(node.id)) continue;
      if (!sol.unknowns.has(node.id)) continue;
      if (ledI(node).I > state.I_LED_MAX) {
        node.data.burned = true;
        node.data.justBurned = true;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const Vmap = sol.Vmap;
  state.solverError = sol.error;
  state.nodeVoltages = Vmap;
  state.genOff = genOff;

  // Capacitor memory: store the voltage across it (hot minus return) for next frame.
  // On a solver error it keeps its old charge.
  for (const node of state.nodes.values()) {
    if (node.type !== "CAP" && node.type !== "BAT") continue;
    if (state.solverError) continue;
    // Not in any solved island: nothing changed it.
    if (!sol.solved.has(node.id)) continue;
    const bId = node.data?.pairId;
    node.data.Vprev = bId ? (Vmap.get(node.id) ?? 0) - (Vmap.get(bId) ?? 0) : 0;
  }

  // Load / device readouts.
  state.powered = new Map();
  for (const node of state.nodes.values()) {
    if (node.type !== "HOUSE" && node.type !== "LED") continue;

    const bId = node.data?.pairId;
    const Vhot = Vmap.get(node.id) ?? 0;
    const Vgnd = bId ? (Vmap.get(bId) ?? 0) : 0;

    if (node.type === "HOUSE") {
      // Brightness uses the voltage ACROSS the house, so a house with no return
      // wire shows a real V but stays OFF. Its size, not sign: a resistor works
      // wired either way round. Buildings can set their own data.vOn / data.vDim.
      const I = state.solverError ? 0 : Math.abs(Vhot - Vgnd) / houseR(state, node);
      const level = state.solverError ? "OFF" : levelByVoltage(state, Math.abs(Vhot - Vgnd), node.data);
      state.powered.set(node.id, { V: state.solverError ? 0 : Vhot, I, level });
      continue;
    }

    // LED
    if (node.data?.burned) {
      state.powered.set(node.id, { V: 0, I: 0, level: "BURNED" });
      continue;
    }
    if (state.solverError) {
      state.powered.set(node.id, { V: 0, I: 0, level: "OFF" });
      continue;
    }
    const I = ledOff.has(node.id) ? 0 : Math.max(0, (Vhot - Vgnd - state.V_LED_F) / state.R_LED_INTERNAL);
    state.powered.set(node.id, { V: Vhot, I, level: levelByCurrentLED(state, I) });
  }

  computeWireMetrics(state);
  return state.powered;
}

function computeWireMetrics(state) {
  const Vmap = state.nodeVoltages || new Map();
  const metrics = new Map();
  function wireKey(a, b) { return [a, b].sort().join("|"); }

  for (const w of state.wires) {
    if (!state.nodes.has(w.a) || !state.nodes.has(w.b)) continue;
    const Va = Vmap.get(w.a) ?? 0;
    const Vb = Vmap.get(w.b) ?? 0;
    const Vab = Va - Vb;
    const Iab = state.R_WIRE > 0 ? Vab / state.R_WIRE : 0;
    metrics.set(wireKey(w.a, w.b), { R: state.R_WIRE, Iab, Vab });
  }

  state.wireMetrics = metrics;
  return metrics;
}
