// src/sim.js
// KCL node-voltage solver + capacitor transient to ground + transformer source nodes.

function isTransistor(node) {
  return node && node.type === "TRANS";
}
function transistorOn(node) {
  return !!node?.data?.on;
}

function getLoadResistance(state, node) {
  if (node.type === "HOUSE") return state.R_HOUSE;
  if (node.type === "LED") return state.R_LED;
  return null;
}

// Edge resistance model
function edgeResistance(state, fromNode, toNode) {
  let R = state.R_WIRE;

  // treat RES as an inline resistor node: adds to any edge touching it
  if (toNode.type === "RES") R += (toNode.data?.ohms ?? state.RES_DEFAULT_OHMS);
  if (fromNode.type === "RES") R += (fromNode.data?.ohms ?? state.RES_DEFAULT_OHMS);

  // transistor ON adds small resistance; transistor OFF => edge removed elsewhere
  if (toNode.type === "TRANS" && transistorOn(toNode)) R += 0.5;
  if (fromNode.type === "TRANS" && transistorOn(fromNode)) R += 0.5;

  return R;
}

function buildAdj(state) {
  const adj = new Map();
  for (const id of state.nodes.keys()) adj.set(id, []);

  for (const w of state.wires) {
    const a = state.nodes.get(w.a);
    const b = state.nodes.get(w.b);
    if (!a || !b) continue;

    // OPEN switch: remove edge entirely
    if (isTransistor(a) && !transistorOn(a)) continue;
    if (isTransistor(b) && !transistorOn(b)) continue;

    const Rab = edgeResistance(state, a, b);
    const Rba = edgeResistance(state, b, a);

    adj.get(w.a).push({ to: w.b, R: Rab });
    adj.get(w.b).push({ to: w.a, R: Rba });
  }
  return adj;
}

function reachableFrom(startId, adj) {
  const reachable = new Set();
  if (!adj.has(startId)) return reachable;

  const stack = [startId];
  reachable.add(startId);

  while (stack.length) {
    const u = stack.pop();
    for (const e of (adj.get(u) || [])) {
      const v = e.to;
      if (!reachable.has(v)) {
        reachable.add(v);
        stack.push(v);
      }
    }
  }
  return reachable;
}

// Gaussian elimination (small networks)
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.slice().concat([b[i]]));

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return new Array(n).fill(0);

    if (pivot !== col) {
      const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp;
    }

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

function levelByVoltage(state, nodeType, Vn) {
  if (nodeType === "HOUSE") {
    if (Vn >= state.V_HOUSE_ON) return "ON";
    if (Vn >= state.V_HOUSE_DIM) return "DIM";
    return "OFF";
  }
  if (nodeType === "LED") {
    if (Vn >= state.V_LED_ON) return "ON";
    if (Vn >= state.V_LED_DIM) return "DIM";
    return "OFF";
  }
  return "OFF";
}

// Transformer model:
// If XFMR is GEN-reachable, treat it as a fixed-voltage source node:
// V(XFMR) = ratio * V(GEN)
function computeTransformerSources(state, reachableGEN) {
  const sources = new Map();
  sources.set("GEN", state.V);

  for (const node of state.nodes.values()) {
    if (node.type !== "XFMR") continue;
    if (!reachableGEN.has(node.id)) continue;

    const ratio = node.data?.ratio ?? state.XFMR_DEFAULT_RATIO;
    sources.set(node.id, ratio * state.V);
  }
  return sources;
}

/**
 * Capacitor to ground using Backward Euler “companion model”:
 * Gcap = C / dtCap and Ieq = Gcap * Vprev
 *
 * ✅ To make charging slower, we make dtCap SMALLER (bigger Gcap),
 * which forces the capacitor node to change voltage gradually (tracks Vprev).
 *
 * state.capSlowFactor controls that:
 * - 0.04  -> slow
 * - 0.20  -> faster
 */
function capacitorCompanion(state, node, dt) {
  const C = node.data?.C ?? 0; // Farads (stored when placed)
  const slow = Math.max(0.001, Math.min(1.0, state.capSlowFactor ?? 0.04));

  // smaller dtCap => larger G => stronger "memory" => slower voltage movement
  const dtCap = Math.max(1e-5, dt * slow);

  const G = C / dtCap;
  const Vprev = node.data?.Vprev ?? 0;
  const Ieq = G * Vprev;

  return { G, Ieq };
}

export function computePower(state, dt = state.dt) {
  const adj = buildAdj(state);

  // Only solve the GEN-connected conducting network.
  const reachableGEN = reachableFrom("GEN", adj);

  // Transformers become additional fixed-voltage sources.
  const fixedSources = computeTransformerSources(state, reachableGEN);

  // Default everything to 0V
  const Vmap = new Map();
  for (const id of state.nodes.keys()) Vmap.set(id, 0);

  // Set fixed source node voltages
  for (const [sid, v] of fixedSources.entries()) Vmap.set(sid, v);

  // Unknown nodes = GEN-reachable AND not fixed source nodes
  const unknownIds = [];
  for (const id of state.nodes.keys()) {
    if (!reachableGEN.has(id)) continue;
    if (fixedSources.has(id)) continue;
    unknownIds.push(id);
  }

  const N = unknownIds.length;

  if (N > 0) {
    const indexOf = new Map();
    unknownIds.forEach((id, i) => indexOf.set(id, i));

    const A = Array.from({ length: N }, () => new Array(N).fill(0));
    const b = new Array(N).fill(0);

    for (let i = 0; i < N; i++) {
      const id = unknownIds[i];
      const node = state.nodes.get(id);
      if (!node) continue;

      let sumG = 0;

      // Edges
      const edges = adj.get(id) || [];
      for (const e of edges) {
        const G = 1 / e.R;
        sumG += G;

        if (fixedSources.has(e.to)) {
          b[i] += G * fixedSources.get(e.to);
        } else if (indexOf.has(e.to)) {
          A[i][indexOf.get(e.to)] -= G;
        }
      }

      // Loads to ground
      const Rload = getLoadResistance(state, node);
      if (Rload != null) sumG += 1 / Rload;

      // Capacitor to ground (transient)
      if (node.type === "CAP") {
        const { G, Ieq } = capacitorCompanion(state, node, dt);
        sumG += G;
        b[i] += Ieq;
      }

      A[i][i] += sumG;
    }

    const Vunknown = solveLinear(A, b);
    for (let i = 0; i < N; i++) Vmap.set(unknownIds[i], Vunknown[i]);
  }

  // Save voltages
  state.nodeVoltages = Vmap;

  // Update capacitor memory (Vprev) = current voltage (capped naturally by the circuit)
  for (const node of state.nodes.values()) {
    if (node.type !== "CAP") continue;
    const vnow = (reachableGEN.has(node.id) ? (Vmap.get(node.id) ?? 0) : 0);
    node.data.Vprev = vnow;
  }

  // Load readouts (HOUSE/LED)
  state.powered = new Map();
  for (const node of state.nodes.values()) {
    if (node.type !== "HOUSE" && node.type !== "LED") continue;

    if (!reachableGEN.has(node.id)) {
      state.powered.set(node.id, { V: 0, I: 0, level: "OFF" });
      continue;
    }

    const Vn = Vmap.get(node.id) ?? 0;
    const Rload = getLoadResistance(state, node);
    const I = Rload ? (Vn / Rload) : 0;

    state.powered.set(node.id, {
      V: Vn,
      I,
      level: levelByVoltage(state, node.type, Vn),
    });
  }

  computeWireMetrics(state);
  return state.powered;
}

export function computeWireMetrics(state) {
  const Vmap = state.nodeVoltages || new Map();
  const metrics = new Map();

  function wireKey(a, b) {
    return [a, b].sort().join("|");
  }

  for (const w of state.wires) {
    const a = state.nodes.get(w.a);
    const b = state.nodes.get(w.b);
    if (!a || !b) continue;

    if (isTransistor(a) && !transistorOn(a)) continue;
    if (isTransistor(b) && !transistorOn(b)) continue;

    const Rab = edgeResistance(state, a, b);
    const Va = Vmap.get(w.a) ?? 0;
    const Vb = Vmap.get(w.b) ?? 0;

    const Vab = Va - Vb;
    const Iab = (Rab > 0) ? (Vab / Rab) : 0;

    metrics.set(wireKey(w.a, w.b), { R: Rab, Iab, Vab });
  }

  state.wireMetrics = metrics;
  return metrics;
}
