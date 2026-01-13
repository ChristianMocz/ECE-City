function buildAdj(state) {
  const adj = new Map();
  for (const id of state.nodes.keys()) adj.set(id, []);
  for (const w of state.wires) {
    if (!adj.has(w.a)) adj.set(w.a, []);
    if (!adj.has(w.b)) adj.set(w.b, []);
    adj.get(w.a).push({ to: w.b, r: w.r });
    adj.get(w.b).push({ to: w.a, r: w.r });
  }
  return adj;
}

function extraR(state, node) {
  if (node.type === "RES") return state.R_RES;
  return 0;
}

function isOffTrans(node) {
  return node.type === "TRANS" && node.data && node.data.on === false;
}

export function computePower(state) {
  const adj = buildAdj(state);

  // Dijkstra where “distance” = resistance
  const dist = new Map();
  const visited = new Set();
  for (const id of state.nodes.keys()) dist.set(id, Infinity);
  dist.set("GEN", 0);

  while (true) {
    let u = null;
    let best = Infinity;
    for (const [id, d] of dist.entries()) {
      if (!visited.has(id) && d < best) { best = d; u = id; }
    }
    if (u === null) break;

    visited.add(u);
    const uNode = state.nodes.get(u);
    if (!uNode) continue;

    // transistor OFF blocks pass-through
    if (u !== "GEN" && isOffTrans(uNode)) continue;

    for (const e of (adj.get(u) || [])) {
      const v = e.to;
      const vNode = state.nodes.get(v);
      if (!vNode) continue;

      const cand = dist.get(u) + e.r + extraR(state, vNode);
      if (cand < dist.get(v)) dist.set(v, cand);
    }
  }

  state.powered = new Map();

  for (const node of state.nodes.values()) {
    if (node.type !== "HOUSE" && node.type !== "LED") continue;

    const Rpath = dist.get(node.id);
    if (!isFinite(Rpath)) {
      state.powered.set(node.id, { I: 0, level: "OFF" });
      continue;
    }

    const Rload = node.type === "HOUSE" ? state.R_HOUSE : state.R_LED;
    const I = state.V / (Rpath + Rload);

    let level = "OFF";
    if (I >= state.I_ON) level = "ON";
    else if (I >= state.I_DIM) level = "DIM";

    state.powered.set(node.id, { I, level });
  }

  return state.powered;
}

export function summarizePower(state) {
  const loads = [...state.nodes.values()].filter(n => n.type === "HOUSE" || n.type === "LED");
  if (loads.length === 0) return "Place a HOUSE or LED first.";

  let on = 0, dim = 0, off = 0;
  for (const n of loads) {
    const r = state.powered.get(n.id);
    const lvl = r ? r.level : "OFF";
    if (lvl === "ON") on++;
    else if (lvl === "DIM") dim++;
    else off++;
  }

  return `Power report: ON ${on}, DIM ${dim}, OFF ${off}. (Parallel paths help; long series chains add resistance.)`;
}
