// src/sim.js
//
// Modified-nodal-analysis KCL solver for the whole grid, plus a capacitor
// transient (backward-Euler companion model) and an ideal-transformer stamp.
//
// The core idea: every real component has two leads. GEN is a Thevenin
// source (ideal 12V EMF behind an internal resistance R_GEN) — not the
// player-facing "GEN" node directly, but folded into that node's own KCL
// row, so it behaves as if there were a hidden internal resistor between an
// ideal battery and the terminal you actually wire to. GND is a true fixed
// 0V reference. Every other placeable device (RES, TRANS, HOUSE, LED, CAP)
// is modeled as a pair of graph nodes — a "hot" terminal and a "b" (return)
// terminal — joined by one internal two-terminal branch (a conductance,
// optionally with a bias current representing an internal EMF or stored
// charge). Both terminals are real, independently-wireable nodes.
//
// This matters: it is what makes the closed-loop requirement (no current
// without a real path back to GND) an *emergent property of ordinary nodal
// analysis* rather than a special-cased rule. A component whose "b" terminal
// never actually reaches GND through any chain of wires simply has nowhere
// for current to go — the whole reachable island floats at a uniform,
// current-free voltage, exactly like touching a voltmeter to an open switch.
// No gating logic needed, no risk of a bolted-on shortcut silently bypassing
// the resistance of whatever's actually in the return path.
//
// The transformer is the one exception that needs a genuine extra unknown:
// see computeTransformerStamps for why (it's a real coupling, not just a
// conductance, so it gets a proper MNA stamp with an auxiliary branch
// current, which is also what makes power conservation fall out for free
// instead of needing to be separately enforced).

function transistorOn(node) {
  return !!node?.data?.on;
}

const TWO_TERMINAL_TYPES = new Set(["RES", "TRANS", "HOUSE", "LED", "CAP"]);

// Returns { G, bias } for the internal branch of a two-terminal component,
// or null if the branch is open (switch off, LED already burned out — same
// as a blown fuse: no conductance at all, not even a resistor's worth).
// `bias` is an extra constant current pushed from the "b" terminal toward
// the "hot" terminal — this is how an internal EMF (LED forward-voltage
// drop) or remembered charge (capacitor) enters the linear system.
function branchParams(state, hotNode, dt) {
  switch (hotNode.type) {
    case "RES": {
      const ohms = hotNode.data?.ohms ?? state.RES_DEFAULT_OHMS;
      return { G: 1 / ohms, bias: 0 };
    }
    case "TRANS": {
      if (!transistorOn(hotNode)) return null; // open switch — no branch at all
      return { G: 1 / 0.5, bias: 0 }; // small, real ON resistance
    }
    case "HOUSE": {
      return { G: 1 / state.R_HOUSE, bias: 0 };
    }
    case "LED": {
      if (hotNode.data?.burned) return null; // blown — open circuit, like a real dead LED
      const G = 1 / state.R_LED_INTERNAL;
      return { G, bias: G * state.V_LED_F };
    }
    case "CAP": {
      // Backward-Euler companion model: a conductance G = C/dt in parallel
      // with a current source representing the charge already stored
      // (Vprev is the voltage *across* the capacitor from the last solve).
      const C = hotNode.data?.C ?? 0;
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

// Component-internal connections (a resistor's two leads, a transformer's
// primary<->secondary coupling) aren't wires, but reachability still needs
// to hop across them — otherwise a device's "far" terminal would always
// look unreachable even when it's clearly part of the energized network.
// Bridges are only added when the branch is actually closed (an open
// transistor or a burned LED does NOT bridge — the far side is genuinely
// cut off, which is the whole point of a switch/fuse).
function buildComponentBridges(state, dt) {
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
    if (branchParams(state, node, dt)) { add(node.id, bId); add(bId, node.id); }
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

// Gaussian elimination (small networks). Throws on a singular/near-singular
// matrix instead of silently returning zeros — a solver that can't find an
// answer and a circuit that's genuinely unpowered are different situations,
// and reporting them identically ("everything OFF") hides real problems.
// See computePower for how the caller turns this into state.solverError.
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

function levelByVoltage(state, Vn) {
  if (Vn >= state.V_HOUSE_ON) return "ON";
  if (Vn >= state.V_HOUSE_DIM) return "DIM";
  return "OFF";
}
function levelByCurrentLED(state, I) {
  if (I >= state.I_LED_BRIGHT) return "ON";
  if (I >= state.I_LED_GLOW) return "DIM";
  return "OFF";
}

export function computePower(state, dt = state.dt) {
  const adj = buildAdj(state);
  const bridges = buildComponentBridges(state, dt);

  const reachableGEN = reachableFrom("GEN", adj, bridges);
  const unknownIds = [...reachableGEN].filter(id => id !== "GND");

  const xfmrPairs = [];
  for (const node of state.nodes.values()) {
    if (node.type !== "XFMR_SEC") continue;
    const priId = node.data?.pairId;
    if (!priId) continue;
    xfmrPairs.push({ priId, secId: node.id, ratio: node.data?.ratio ?? state.XFMR_DEFAULT_RATIO });
  }
  const activeXfmrPairs = xfmrPairs.filter(p => unknownIds.includes(p.priId) && unknownIds.includes(p.secId));

  const N = unknownIds.length;
  const K = activeXfmrPairs.length;
  const M = N + K;

  const Vmap = new Map();
  for (const id of state.nodes.keys()) Vmap.set(id, 0);
  Vmap.set("GND", 0);

  state.solverError = false;

  if (M > 0) {
    const indexOf = new Map();
    unknownIds.forEach((id, i) => indexOf.set(id, i));

    const A = Array.from({ length: M }, () => new Array(M).fill(0));
    const b = new Array(M).fill(0);

    // Base rows: GEN's internal source, plain wire conductances.
    for (let i = 0; i < N; i++) {
      const id = unknownIds[i];
      let sumG = 0;

      if (id === "GEN") {
        const g = 1 / state.R_GEN;
        sumG += g;
        b[i] += g * state.V;
      }

      for (const e of (adj.get(id) || [])) {
        const G = 1 / e.R;
        sumG += G;
        if (indexOf.has(e.to)) A[i][indexOf.get(e.to)] -= G;
        // (an edge to GND contributes G*0 to b — nothing to add)
      }

      A[i][i] += sumG;
    }

    // Two-terminal component branches (resistor, switch, house, LED, cap).
    for (const node of state.nodes.values()) {
      if (!TWO_TERMINAL_TYPES.has(node.type)) continue;
      const bId = node.data?.pairId;
      if (!bId || !indexOf.has(node.id) || !indexOf.has(bId)) continue;
      const bp = branchParams(state, node, dt);
      if (!bp) continue;

      const hi = indexOf.get(node.id);
      const gi = indexOf.get(bId);
      A[hi][hi] += bp.G;
      A[gi][gi] += bp.G;
      A[hi][gi] -= bp.G;
      A[gi][hi] -= bp.G;
      b[hi] += bp.bias;
      b[gi] -= bp.bias;
    }

    // Ideal transformer stamps (see header comment for the physical
    // reasoning). One auxiliary unknown i_k per active transformer.
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
    } catch (e) {
      state.solverError = true;
      X = new Array(M).fill(0);
    }
    for (let i = 0; i < N; i++) Vmap.set(unknownIds[i], X[i]);
  }

  state.nodeVoltages = Vmap;

  // Capacitor memory: remember the voltage ACROSS the cap (hot minus its
  // own return terminal), not just its hot-side voltage in isolation.
  for (const node of state.nodes.values()) {
    if (node.type !== "CAP") continue;
    const bId = node.data?.pairId;
    const vnow = (!state.solverError && bId) ? (Vmap.get(node.id) ?? 0) - (Vmap.get(bId) ?? 0) : 0;
    node.data.Vprev = vnow;
  }

  // Load / device readouts.
  state.powered = new Map();
  for (const node of state.nodes.values()) {
    if (node.type !== "HOUSE" && node.type !== "LED") continue;

    const bId = node.data?.pairId;
    const Vhot = Vmap.get(node.id) ?? 0;
    const Vgnd = bId ? (Vmap.get(bId) ?? 0) : 0;

    if (node.type === "HOUSE") {
      // Level (ON/DIM/OFF) is driven by the voltage actually ACROSS the
      // house (Vhot - Vgnd) — the thing that actually pushes current through
      // it — not the raw hot-terminal voltage. Those two are the same
      // number in a properly closed loop, but they diverge for a dangling
      // house (no return wire): Vhot can sit at the full source voltage
      // with nothing on the other side to drop it across, which is exactly
      // the "voltage without current" case this game wants a kid to be able
      // to see (V reads real, but the house still correctly reads OFF).
      const I = state.solverError ? 0 : (Vhot - Vgnd) / state.R_HOUSE;
      const level = state.solverError ? "OFF" : levelByVoltage(state, Vhot - Vgnd);
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
    const I = Math.max(0, (Vhot - Vgnd - state.V_LED_F) / state.R_LED_INTERNAL);
    if (I > state.I_LED_MAX) {
      node.data.burned = true;
      node.data.justBurned = true;
      state.powered.set(node.id, { V: 0, I: 0, level: "BURNED" });
      continue;
    }
    state.powered.set(node.id, { V: Vhot, I, level: levelByCurrentLED(state, I) });
  }

  computeWireMetrics(state);
  return state.powered;
}

export function computeWireMetrics(state) {
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
