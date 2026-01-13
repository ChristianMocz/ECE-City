// src/sim.js
// KCL-based DC resistive network solver (node-voltage method)
//
// Fixes:
// - Only solves the GEN-reachable conducting network (floating parts do nothing)
// - Transistor OFF opens (edge removed)
// - Resistors have per-part values: node.data.ohms
// - ON/DIM/OFF is decided by VOLTAGE targets:
//   House: ON at 9V, LED: ON at 3V

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

function edgeResistance(state, fromNode, toNode) {
  let R = state.R_WIRE;

  // Resistor behaves like a series element when you wire through it:
  // GEN -> RES -> HOUSE
  if (toNode.type === "RES") R += (toNode.data?.ohms ?? state.RES_DEFAULT_OHMS);
  if (fromNode.type === "RES") R += (fromNode.data?.ohms ?? state.RES_DEFAULT_OHMS);

  // Transistor ON behaves like a small extra resistance (closed switch)
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

    // OPEN switch: remove edges entirely
    if (isTransistor(a) && !transistorOn(a)) continue;
    if (isTransistor(b) && !transistorOn(b)) continue;

    const Rab = edgeResistance(state, a, b);
    const Rba = edgeResistance(state, b, a);

    adj.get(w.a).push({ to: w.b, R: Rab });
    adj.get(w.b).push({ to: w.a, R: Rba });
  }

  return adj;
}

function reachableFromGEN(adj) {
  const reachable = new Set();
  if (!adj.has("GEN")) return reachable;

  const stack = ["GEN"];
  reachable.add("GEN");

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

export function computePower(state) {
  const adj = buildAdj(state);
  const reachable = reachableFromGEN(adj);

  // default everything to 0V
  const Vmap = new Map();
  for (const id of state.nodes.keys()) Vmap.set(id, 0);

  // GEN fixed
  if (state.nodes.has("GEN")) Vmap.set("GEN", state.V);

  // unknowns: GEN-reachable nodes except GEN
  const unknownIds = [];
  for (const id of state.nodes.keys()) {
    if (id === "GEN") continue;
    if (!reachable.has(id)) continue;
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
      const edges = adj.get(id) || [];

      for (const e of edges) {
        const G = 1 / e.R;
        sumG += G;

        if (e.to === "GEN") {
          b[i] += G * state.V;
        } else if (indexOf.has(e.to)) {
          const j = indexOf.get(e.to);
          A[i][j] -= G;
        }
      }

      // load-to-ground
      const Rload = getLoadResistance(state, node);
      if (Rload != null) sumG += 1 / Rload;

      A[i][i] += sumG;
    }

    const Vunknown = solveLinear(A, b);
    for (let i = 0; i < N; i++) Vmap.set(unknownIds[i], Vunknown[i]);
  }

  state.nodeVoltages = Vmap;

  // compute “powered” info for loads
  state.powered = new Map();
  for (const node of state.nodes.values()) {
    if (node.type !== "HOUSE" && node.type !== "LED") continue;

    if (!reachable.has(node.id)) {
      state.powered.set(node.id, { V: 0, level: "OFF" });
      continue;
    }

    const Vn = Vmap.get(node.id) ?? 0;
    const level = levelByVoltage(state, node.type, Vn);
    state.powered.set(node.id, { V: Vn, level });
  }

  return state.powered;
}
