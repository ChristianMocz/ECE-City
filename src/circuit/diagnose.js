// src/circuit/diagnose.js
//
// The "Why is it dark?" helper. Tap a house or LED and this explains, in
// kid language, why it is or isn't lit, which wires make its loop, and where
// the loop is broken. Also the "What is this?" cards for other parts.
// No Phaser: reads the state and the last solve, returns plain objects.
//
// Main pieces: diagnosePart(), describePart(), poppedLEDsTouched().
// Used by: src/scene/touch.js, src/scene/editing.js. Tested in tests/features.test.mjs.
//
// diagnosePart result: {
//   id, lit,            // the part asked about, and whether it's glowing
//   code,               // machine-readable reason (see the cases below)
//   message,            // what to tell the kid
//   path: ["A|B", ...], // wire keys of the loop (or the part of it that exists)
//   marks: [{ nodeId, kind: "gap" | "block" }],  // where to draw the warning
// }

function helperWireKey(a, b) { return [a, b].sort().join("|"); }

// Every path current could take: wires plus the inside of each part.
// Open parts (switch OFF, popped LED) stay in, tagged `blocker`, so we can
// say "the path is there, but this part blocks it".
function helperGraph(state) {
  const adj = new Map();
  const link = (a, b, via) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, via });
    adj.get(b).push({ to: a, via });
  };
  for (const w of state.wires) {
    if (!state.nodes.has(w.a) || !state.nodes.has(w.b)) continue;
    link(w.a, w.b, { kind: "wire", key: helperWireKey(w.a, w.b) });
  }
  for (const node of state.nodes.values()) {
    const other = node.data?.pairId;
    if (!other || !state.nodes.has(other)) continue;
    if (node.type === "XFMR_SEC") { link(node.id, other, { kind: "part", id: node.id, type: "XFMR", blocker: null }); continue; }
    if (!TWO_TERMINAL_TYPES.has(node.type)) continue;
    let blocker = null;
    if (node.type === "TRANS" && !node.data.on) blocker = "switch-off";
    if (node.type === "LED" && node.data.burned) blocker = "popped";
    link(node.id, other, { kind: "part", id: node.id, type: node.type, blocker });
  }
  return adj;
}

// Shortest path from `start` to `goal` as a list of steps ({via}), or null.
//   avoid:         a dot the path may not cross (GND on the supply side, GEN on the return side)
//   skipPart:      the part being diagnosed; its own inside doesn't count
//   allowBlockers: also walk through open switches / popped LEDs
//   wiresOnly:     ignore part insides (used to spot shortcuts)
function helperPath(adj, start, goal, { avoid = null, skipPart = null, allowBlockers = false, wiresOnly = false } = {}) {
  if (start === goal) return [];
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    for (const e of adj.get(u) || []) {
      if (prev.has(e.to)) continue;
      if (e.to === avoid && e.to !== goal) continue;
      if (e.via.kind === "part") {
        if (wiresOnly || e.via.id === skipPart) continue;
        if (e.via.blocker && !allowBlockers) continue;
      }
      prev.set(e.to, { from: u, via: e.via });
      if (e.to === goal) {
        const steps = [];
        for (let n = goal; prev.get(n); n = prev.get(n).from) steps.unshift(prev.get(n));
        return steps;
      }
      queue.push(e.to);
    }
  }
  return null;
}

const wiresOf = (steps) => (steps || []).filter(s => s.via.kind === "wire").map(s => s.via.key);
const partsOf = (steps) => (steps || []).filter(s => s.via.kind === "part").map(s => s.via);

function diagnosePart(state, id) {
  const node = state.nodes.get(id);
  if (!node || (node.type !== "HOUSE" && node.type !== "LED")) return null;
  const isLED = node.type === "LED";
  const bId = node.data.pairId;
  const V = (n) => state.nodeVoltages?.get(n) ?? 0;
  const p = state.powered?.get(id) || { level: "OFF", V: 0, I: 0 };
  const Vacross = V(id) - V(bId);
  const bKey = node.data?.building;
  const bName = !isLED && bKey && bKey !== "house" && typeof BUILDINGS !== "undefined" && BUILDINGS[bKey] ? BUILDINGS[bKey].name : null;
  const what = isLED ? `LED ${id}` : bName ? `The ${bName.toLowerCase()} (${id})` : `House ${id}`;
  const result = (lit, code, message, path = [], marks = []) => ({ id, lit, code, message, path, marks });

  if (state.solverError) {
    return result(false, "solver-error", "This circuit is too tricky for the game to work out. Try removing the last thing you added (UNDO).");
  }
  if (isLED && node.data.burned) {
    const cause = ledPopCause(state, id);
    return result(false, "popped", `${what} popped from too much power. ${cause.text} Then tap the LED to fit a new one.`, [], [{ nodeId: cause.at || id, kind: "block" }]);
  }

  const adj = helperGraph(state);
  const supply = helperPath(adj, "GEN", id, { avoid: "GND", skipPart: id });
  const ret = helperPath(adj, bId, "GND", { avoid: "GEN", skipPart: id });
  const loop = [...wiresOf(supply), ...wiresOf(ret)];

  // Is it on a loop with a solar panel, battery or capacitor instead of GEN?
  const store = (!supply || !ret) ? helperSourceLoop(state, adj, id, bId) : null;

  if (p.level === "ON") {
    if (store) {
      const src = store.node.type === "SOLAR" ? `solar panel ${store.node.id}` : store.node.type === "BAT" ? `battery ${store.node.id}` : `capacitor ${store.node.id}`;
      return result(true, "lit", `${what} is glowing! Power flows out of ${src}, through ${id}, and back again. That's a complete loop!`, store.path);
    }
    // A house also works wired backwards: highlight whichever way the loop runs.
    let litLoop = loop;
    if (!supply || !ret) {
      const s2 = helperPath(adj, "GEN", bId, { avoid: "GND", skipPart: id });
      const r2 = helperPath(adj, id, "GND", { avoid: "GEN", skipPart: id });
      litLoop = [...wiresOf(s2), ...wiresOf(r2)];
    }
    return result(true, "lit", `${what} is glowing! Power flows out of GEN, through ${id}, and back home to GND. That's a complete loop!`, litLoop);
  }

  // --- A side of the loop is missing ---
  if (store) {
    const n = store.node;
    const mark = [{ nodeId: n.id, kind: "block" }];
    if (n.type === "SOLAR") {
      const msg = !((state.solarFactor ?? 1) > 0)
        ? `${what} is wired to solar panel ${n.id}, but it's night — no sunshine, no power! A battery charged up during the day can keep it lit.`
        : `${what} is wired to solar panel ${n.id}, but the panel isn't making enough power${(state.solarFactor ?? 1) < 1 ? " (clouds are blocking the sun)" : ""}. Try a smaller load, or add the generator.`;
      return result(false, "solar-weak", msg, store.path, mark);
    }
    const pct = Math.round(Math.min(1, Math.abs(n.data?.Vprev ?? 0) / state.V) * 100);
    const kind = n.type === "BAT" ? "Battery" : "Capacitor";
    return result(false, "store-empty", `${what} is wired to ${kind.toLowerCase()} ${n.id}, but it's only ${pct}% full. Charge it first: wire it to GEN and GND for a while.`, store.path, mark);
  }
  if (!supply || !ret) {
    // Is the path there, but blocked by an open switch or a popped LED?
    const side = !supply
      ? helperPath(adj, "GEN", id, { avoid: "GND", skipPart: id, allowBlockers: true })
      : helperPath(adj, bId, "GND", { avoid: "GEN", skipPart: id, allowBlockers: true });
    const blocker = side && partsOf(side).find(v => v.blocker);
    if (blocker) {
      const path = [...wiresOf(side), ...wiresOf(supply || ret)];
      if (blocker.blocker === "switch-off") {
        return result(false, "switch-off", `Switch ${blocker.id} is OFF, so the loop is open. Tap the switch to turn it ON!`, path, [{ nodeId: blocker.id, kind: "block" }]);
      }
      return result(false, "blocked-by-popped", `LED ${blocker.id} is in the way and it has popped — a popped LED doesn't let power through. Tap it to fit a new one.`, path, [{ nodeId: blocker.id, kind: "block" }]);
    }
    if (isLED) {
      const flippedSupply = helperPath(adj, "GEN", bId, { avoid: "GND", skipPart: id });
      const flippedReturn = helperPath(adj, id, "GND", { avoid: "GEN", skipPart: id });
      if (flippedSupply && flippedReturn) {
        return result(false, "backwards", `${what} is wired backwards! LEDs only let power through one way: the ORANGE dot goes toward GEN, the BLUE dot toward GND. Swap its wires.`,
          [...wiresOf(flippedSupply), ...wiresOf(flippedReturn)], [{ nodeId: id, kind: "gap" }, { nodeId: bId, kind: "gap" }]);
      }
    }
    if (!supply && !ret) {
      return result(false, "not-wired", `${what} isn't connected yet. Power needs a loop: wire its ORANGE dot to GEN, and its BLUE dot to GND.`, [], [{ nodeId: id, kind: "gap" }, { nodeId: bId, kind: "gap" }]);
    }
    if (!supply) {
      return result(false, "no-power", `Power can't reach ${id}. Its ORANGE dot needs a wire path back to GEN (the generator).`, wiresOf(ret), [{ nodeId: id, kind: "gap" }]);
    }
    return result(false, "no-return", `Power gets to ${id} but has no way home! Wire its BLUE dot to GND so the loop is complete.`, wiresOf(supply), [{ nodeId: bId, kind: "gap" }]);
  }

  // --- The loop exists but isn't fully lit ---
  const seriesParts = [...partsOf(supply), ...partsOf(ret)];
  const cap = seriesParts.find(v => v.type === "CAP");
  if (cap && Math.abs(p.I) < (isLED ? state.I_LED_GLOW : 0.01)) {
    return result(false, "cap-in-the-way", `Capacitor ${cap.id} is in the loop. Once it fills up, it stops power flowing through — capacitors STORE power, they don't pass it along. Wire around it.`, loop, [{ nodeId: cap.id, kind: "block" }]);
  }
  if (Math.abs(Vacross) < 0.5 && (helperPath(adj, id, bId, { wiresOnly: true }) || helperPath(adj, id, "GND", { wiresOnly: true }))) {
    return result(false, "shorted", `Power is taking a shortcut around ${id}! A wire goes straight past it, so almost no power goes through. Remove the shortcut wire.`, loop, [{ nodeId: id, kind: "block" }]);
  }

  if (isLED) {
    const dimWhy = ledDimCause(state, id);
    if (dimWhy) return result(false, Vacross <= state.V_LED_F + 0.03 ? "led-low-voltage" : "led-dim", `${what} ${Vacross <= state.V_LED_F + 0.03 ? "isn't getting enough power" : "is only glowing a little"}. ${dimWhy.text}`, loop, dimWhy.at ? [{ nodeId: dimWhy.at, kind: "block" }] : []);
    if (Vacross <= state.V_LED_F + 0.03) {
      return result(false, "led-low-voltage", `${what} needs at least ${state.V_LED_F} volts to switch on, but only gets ${Math.max(0, Vacross).toFixed(1)}. Something in the loop is using up the voltage — try a smaller resistor.`, loop, [{ nodeId: id, kind: "block" }]);
    }
    return result(false, "led-dim", `${what} is glowing a little. Use a Medium (470Ω) resistor in front of it — that's just right for one LED.`, loop);
  }

  // House, connected but not bright.
  const res = seriesParts.find(v => v.type === "RES");
  const xfmr = seriesParts.find(v => v.type === "XFMR" && (state.nodes.get(v.id)?.data?.ratio ?? 1) < 1);
  const volts = Math.max(0, Vacross).toFixed(1);
  const need = node.data?.vOn ?? state.V_HOUSE_ON;
  let why;
  if (xfmr) why = `Transformer ${xfmr.id} steps the voltage DOWN, so there isn't enough left. Try a 1:1 or step-up transformer.`;
  else if (res) why = `Resistor ${res.id} is in the loop and uses up a lot of the voltage. Try wiring the house without it.`;
  else if ((state.loadScale ?? 1) < 1) why = "Every building needs extra power right now (night time, or a heat wave), so the generator can't keep up with all of them. Take a building or two off it, or help out with a charged battery.";
  else why = "The generator is working hard for a lot of parts at once, so the voltage drops. Try fewer houses, or take some off this generator.";
  return result(false, p.level === "DIM" ? "dim" : "low-voltage", `${what} is connected, but only gets ${volts} volts (it needs ${need} to be bright). ${why}`, loop,
    [res || xfmr ? { nodeId: (res || xfmr).id, kind: "block" } : null].filter(Boolean));
}

// A loop from a solar panel / battery / capacitor through the part and back,
// not using GEN or GND: { node, path } or null.
function helperSourceLoop(state, adj, id, bId) {
  for (const n of state.nodes.values()) {
    if (n.type !== "SOLAR" && n.type !== "BAT" && n.type !== "CAP") continue;
    const nb = n.data?.pairId;
    if (!nb) continue;
    for (const [a, b] of [[id, bId], [bId, id]]) {
      const s1 = helperPath(adj, n.id, a, { avoid: "GEN", skipPart: id });
      const s2 = s1 && helperPath(adj, b, nb, { avoid: "GEN", skipPart: id });
      if (s1 && s2 && !partsOf(s1).some(v => v.id === n.id) && !partsOf(s2).some(v => v.id === n.id)) {
        return { node: n, path: [...wiresOf(s1), ...wiresOf(s2)] };
      }
    }
  }
  return null;
}

// "What is this?" card text for parts other than houses and LEDs, using live
// details (colour code, charge, ratio, amps). null for unknown types.
function describePart(state, id) {
  const node = state.nodes.get(id);
  if (!node) return null;
  const d = node.data || {};
  switch (node.type) {
    case "RES": {
      const ohms = d.ohms ?? state.RES_DEFAULT_OHMS;
      const bands = typeof resistorBandNames === "function" ? ` Its stripes (${resistorBandNames(ohms)}) are a real colour code that spells ${ohms} ohms.` : "";
      return `Resistor ${id}: ${ohms} Ω. A resistor is like a skinny pipe — it slows down the electricity. LEDs need one so they don't get too much.${bands}`;
    }
    case "CAP": {
      const v = Math.abs(d.Vprev ?? 0);
      const pct = Math.round(Math.min(1, v / state.V) * 100);
      return `Capacitor ${id}: ${d.uF ?? "?"} µF, ${pct}% full (${v.toFixed(1)} V). It's a little bucket for electricity: it fills up, and can keep things running for a moment after the generator is gone. The grey stripe marks its minus side.`;
    }
    case "XFMR_SEC": {
      const r = d.ratio ?? state.XFMR_DEFAULT_RATIO;
      const what = r < 1 ? `steps the voltage DOWN to ${r}×` : r > 1 ? `steps the voltage UP to ${r}×` : "keeps the voltage the same (1:1)";
      return `Transformer ${id}: it ${what}. Power goes in the orange coil and comes out the blue one. Real ones sit on power poles, turning the very high voltage on the big lines into the safer voltage homes use.`;
    }
    case "TRANS":
      return `Switch ${id} is ${d.on ? "ON — the blade is down, so power can flow" : "OFF — the blade is up, so the loop is open"}. Tap it to flip it.`;
    case "GEN": {
      const amps = genAmps(state);
      return `Generator: it pushes electricity out of its orange dot at up to ${+genEmf(state).toFixed(1)} V. It's supplying ${amps.toFixed(2)} A right now — the more you plug in, the harder it works and the dimmer things get.`;
    }
    case "SOLAR": {
      const f = state.solarFactor ?? 1;
      const now = !(f > 0) ? "It's night, so it's resting — no sunlight, no power." : f >= 1.5 ? "It's sunny, so it's working extra hard!" : f < 1 ? "Clouds are blocking some sunshine, so it makes less power today." : "It's making power from today's sunshine.";
      return `Solar panel ${id}: it turns sunlight into electricity — a little generator with no fuel. ${now} Wire a loop from its orange dot, through a building, back to its blue dot.`;
    }
    case "BAT": {
      const v = Math.abs(d.Vprev ?? 0);
      const pct = Math.round(Math.min(1, v / state.V) * 100);
      return `Battery ${id}: ${pct}% full. Like a big capacitor, it stores power: charge it from GEN or the sun in the daytime, then it keeps buildings lit at night.`;
    }
    case "GND":
      return "Ground (GND): the way home. Every loop of electricity has to come back here, or nothing lights up.";
    default:
      return null;
  }
}

// A popped LED is replaced when a wire in its own group of parts changes (if
// still unsafe, it pops again). GEN and GND don't join groups, or everything would.
//   ids:   the dots the change touched (both ends of the wire)
//   wires: the wires to group by (include the changed wire)
// Returns the hot ids of the popped LEDs to replace.
function poppedLEDsTouched(state, ids, wires = state.wires) {
  const parent = new Map();
  const find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const hub = (id) => { const t = state.nodes.get(id)?.type; return t === "GEN" || t === "GND"; };
  for (const n of state.nodes.values()) if (n.data?.pairId && state.nodes.has(n.data.pairId)) join(n.id, n.data.pairId);
  for (const w of wires) if (!hub(w.a) && !hub(w.b)) join(w.a, w.b);
  const roots = new Set(ids.filter(id => id != null && !hub(id)).map(find));
  const out = [];
  for (const n of state.nodes.values()) {
    if (n.type === "LED" && n.data?.burned && roots.has(find(n.id))) out.push(n.id);
  }
  return out;
}

// --- LED troubleshooting ---
// A dot's "net" is every dot joined to it by wires alone.
function wireNets(state) {
  const parent = new Map();
  const find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
  for (const w of state.wires) { const a = find(w.a), b = find(w.b); if (a !== b) parent.set(a, b); }
  return find;
}
const PLANT_REST_TEXT = "Your power plant is hardly making any power right now (a storm on a wind turbine, night on a solar farm, a nuclear plant still warming up, or a tidal plant away from the sea). Wait, switch to another plant in SHOP → Power plants, or use a charged battery.";

// Why did this LED pop? { text, at }
function ledPopCause(state, id) {
  const find = wireNets(state);
  const net = find(id);
  const on = (nid) => state.nodes.has(nid) && find(nid) === net;
  if (on("GEN")) return { text: "Its orange dot is wired straight to GEN with nothing to slow the power down. Put a Medium (470Ω) resistor between GEN and the LED.", at: id };
  const small = [...state.nodes.values()].filter(n => n.type === "RES" && (n.data.ohms ?? 470) < 470 && (on(n.id) || on(n.data.pairId)));
  if (small.length) return { text: `Resistor ${small[0].id} is a Small one (${small[0].data.ohms}Ω) and it's still connected to the LED${small.length > 1 ? " (so are others)" : ""} — power takes that easy path. Delete it and use a Medium (470Ω) resistor.`, at: small[0].id };
  const src = [...state.nodes.values()].find(n => (n.type === "BAT" || n.type === "CAP" || n.type === "SOLAR") && (on(n.id) || on(n.data.pairId)));
  if (src) return { text: `It's wired straight to ${src.id} with no resistor. Put a Medium (470Ω) resistor in between.`, at: src.id };
  return { text: "Something let too much power through. Give it a Medium (470Ω) resistor right in front of its orange dot.", at: id };
}

// Why is this LED dim or dark even though its loop is complete? { text, at } or null.
function ledDimCause(state, id) {
  const find = wireNets(state);
  const net = find(id);
  // Two or more LEDs hanging off the same resistor share its current.
  const sharers = [...state.nodes.values()].filter(n => n.type === "LED" && n.id !== id && find(n.id) === net);
  if (sharers.length) {
    const feeder = [...state.nodes.values()].find(n => n.type === "RES" && (find(n.id) === net || find(n.data.pairId) === net));
    return { text: `${id} shares ${feeder ? "resistor " + feeder.id : "its power"} with ${sharers.map(n => n.id).join(", ")}, so each LED only gets part of it. Give each LED its own Medium (470Ω) resistor, or put the LEDs one after another in a row.`, at: feeder?.id };
  }
  if ((state.genScale ?? 1) < 0.6 && state.context !== "level") return { text: PLANT_REST_TEXT };
  const vGen = state.nodeVoltages?.get("GEN");
  if (vGen != null && vGen < 9 && (state.genScale ?? 1) >= 0.6) return { text: `The generator is worn out — it only pushes ${vGen.toFixed(1)} volts because lots of buildings are using it. Take a building or two off, or get a bigger power plant. (A smaller resistor would pop the LED!)` };
  const big = [...state.nodes.values()].find(n => n.type === "RES" && (n.data.ohms ?? 470) > 470 && (find(n.id) === net || find(n.data.pairId) === net));
  if (big) return { text: `Resistor ${big.id} is a Large one (${big.data.ohms}Ω), so only a little power gets through. Swap it for a Medium (470Ω).`, at: big.id };
  return null;
}
