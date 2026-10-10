// src/rules/emergencies.js
//
// Emergencies: short, optional, timed events in your town ("The hospital is
// losing power, 40 seconds"). Nothing changes unless the player accepts.
// Fix it in time for coins and XP; running out of time costs nothing.
//
// Each emergency has:
//   plan(state, profile, rng): null if it doesn't fit this town, else
//     { target, text, actions, env, ... }. `actions` are board changes:
//     { cut: [[a, b]], add: [[a, b]], off: [ids], pop: [ids], drain: [ids] }.
//     `env` overrides physics while it lasts ({ loadScale, solarFactor }).
//   check(state, plan, dt): true when fixed. `dt` counts time for "keep it lit" ones.
// tests/emergencies.test.mjs fixes every one on test towns.
//
// Main pieces: EMERGENCIES, pickEmergency(), checkEmergency(), applyEmergencyActions().
// Uses: circuit helpers from src/rules/campaign.js (loads after it).
// Used by: src/scene/town.js, src/scene/power.js.

const EMERGENCY_REWARD = { coins: 30, xp: 20 };
const IMPORTANCE = { hospital: 5, school: 4, icecream: 3, bakery: 2, park: 1, house: 0 };

const emLoads = (state) => [...state.nodes.values()].filter(n => n.type === "HOUSE" || n.type === "LED");
const emLit = (state) => emLoads(state).filter(n => isOn(state, n.id)).map(n => n.id);
const sameWire = (w, a, b) => (w.a === a && w.b === b) || (w.a === b && w.b === a);
function wireAmps(state, w) { return Math.abs(state.wireMetrics?.get([w.a, w.b].sort().join("|"))?.Iab ?? 0); }
function busyWires(state) {
  return state.wires.filter(w => !(sameWire(w, "GEN", "GND")) && wireAmps(state, w) >= 0.05);
}
// Wires whose cut would darken something that's lit now.
function vitalWires(state) {
  const lit = emLit(state);
  return busyWires(state).filter(w => {
    const s = cloneCircuit(state);
    s.wires = s.wires.filter(x => !sameWire(x, w.a, w.b));
    try { computePower(s, 0); } catch (e) { return false; }
    return lit.some(id => !isOn(s, id));
  });
}
function buildingKey(state, id) { return state.nodes.get(id)?.data?.building || "house"; }
function niceName(state, id) {
  const n = state.nodes.get(id);
  if (!n) return id;
  if (n.type === "LED") return `LED ${id}`;
  const b = n.data?.building;
  return b && b !== "house" && typeof BUILDINGS !== "undefined" && BUILDINGS[b] ? `the ${BUILDINGS[b].name.toLowerCase()} (${id})` : `house ${id}`;
}
// Would `id` light up wired alone straight to GEN and GND, with these physics overrides?
function litAlone(state, id, env = {}) {
  const s = cloneCircuit(state);
  Object.assign(s, env);
  const n = s.nodes.get(id);
  if (!n) return false;
  s.wires = [{ a: "GEN", b: id }, { a: n.data.pairId, b: "GND" }];
  try { computePower(s, 0); } catch (e) { return false; }
  return isOn(s, id);
}
// Make the plan's board changes (on a copy when checking a plan).
function applyEmergencyActions(s, actions) {
  for (const [a, b] of actions.cut || []) s.wires = s.wires.filter(w => !sameWire(w, a, b));
  for (const [a, b] of actions.add || []) if (!s.wires.some(w => sameWire(w, a, b))) s.wires.push({ a, b });
  for (const id of actions.off || []) { const n = s.nodes.get(id); if (n) n.data.on = false; }
  for (const id of actions.pop || []) { const n = s.nodes.get(id); if (n) n.data.burned = true; }
  for (const id of actions.drain || []) { const n = s.nodes.get(id); if (n) n.data.Vprev = 0; }
}
function undoEmergencyActions(s, actions) {
  for (const [a, b] of actions.add || []) s.wires = s.wires.filter(w => !sameWire(w, a, b));
  for (const [a, b] of actions.cut || []) if (!s.wires.some(w => sameWire(w, a, b))) s.wires.push({ a, b });
  for (const id of actions.off || []) { const n = s.nodes.get(id); if (n) n.data.on = true; }
  for (const id of actions.pop || []) { const n = s.nodes.get(id); if (n) n.data.burned = false; }
}

const EMERGENCIES = {
  hospital: {
    name: "Hospital blackout", icon: "bld_hospital", seconds: 40,
    plan(state) {
      const h = emLoads(state).find(n => n.type === "HOUSE" && n.data.building === "hospital" && isOn(state, n.id));
      if (!h) return null;
      const w = state.wires.find(x => (x.a === h.id || x.b === h.id) && wireAmps(state, x) >= 0.05);
      if (!w) return null;
      return { target: h.id, text: `The hospital is losing power! Get ${h.id} bright again!`, actions: { cut: [[w.a, w.b]] } };
    },
    check: (state, p) => isOn(state, p.target),
  },
  squirrel: {
    name: "Hungry squirrel", icon: "squirrel", seconds: 45,
    plan(state, profile, rng) {
      const vital = vitalWires(state);
      if (!vital.length) return null;
      const w = vital[Math.floor(rng() * vital.length) % vital.length];
      return { lit: emLit(state), text: `A squirrel chewed through the wire between ${w.a} and ${w.b}! Get every light back on.`, actions: { cut: [[w.a, w.b]] }, at: [w.a, w.b] };
    },
    check: (state, p) => p.lit.every(id => isOn(state, id)),
  },
  tree: {
    name: "Fallen tree", icon: "scn_log", seconds: 60,
    plan(state, profile, rng) {
      const vital = vitalWires(state), busy = busyWires(state);
      if (!vital.length || busy.length < 2) return null;
      const w1 = vital[Math.floor(rng() * vital.length) % vital.length];
      const others = busy.filter(w => w !== w1);
      const w2 = others[Math.floor(rng() * others.length) % others.length];
      return { lit: emLit(state), text: `A tree fell on two power lines (${w1.a}–${w1.b} and ${w2.a}–${w2.b})! Get every light back on.`, actions: { cut: [[w1.a, w1.b], [w2.a, w2.b]] }, at: [w1.a, w1.b] };
    },
    check: (state, p) => p.lit.every(id => isOn(state, id)),
  },
  heatspike: {
    name: "Heat spike", icon: "wx_heat", seconds: 45, hold: 15,
    plan(state) {
      const blds = emLoads(state).filter(n => n.type === "HOUSE" && isOn(state, n.id));
      if (!blds.length) return null;
      blds.sort((a, b) => (IMPORTANCE[buildingKey(state, b.id)] || 0) - (IMPORTANCE[buildingKey(state, a.id)] || 0));
      const t = blds[0];
      const env = { loadScale: Math.min(state.loadScale ?? 1, 0.75) };
      if (!litAlone(state, t.id, env)) return null;
      return { target: t.id, env, progress: 0, text: `Heat spike! Every air conditioner is on. Keep ${niceName(state, t.id)} bright for 15 seconds — unplug other buildings if you have to.`, actions: {} };
    },
    check(state, p, dt) {
      if (isOn(state, p.target)) p.progress += dt || 0; else p.progress = 0;
      return p.progress >= this.hold;
    },
  },
  surge: {
    name: "Power surge", icon: "led_burned", seconds: 45,
    plan(state) {
      const leds = emLoads(state).filter(n => n.type === "LED" && isOn(state, n.id)).map(n => n.id);
      if (!leds.length) return null;
      return { lit: leds, text: `A power surge popped ${leds.length === 1 ? "an LED" : `${leds.length} LEDs`}! Tap each popped LED to fit a new one.`, actions: { pop: leds } };
    },
    check: (state, p) => p.lit.every(id => isOn(state, id)),
  },
  stuckswitch: {
    name: "Stuck switch", icon: "switch_off", seconds: 30,
    plan(state) {
      for (const n of state.nodes.values()) {
        if (n.type !== "TRANS" || !n.data.on) continue;
        const s = cloneCircuit(state); s.nodes.get(n.id).data.on = false;
        try { computePower(s, 0); } catch (e) { continue; }
        const lit = emLit(state);
        if (lit.some(id => !isOn(s, id))) return { target: n.id, lit, text: `A gust of wind knocked switch ${n.id} OFF! Flip it back on.`, actions: { off: [n.id] } };
      }
      return null;
    },
    check: (state, p) => p.lit.every(id => isOn(state, id)),
  },
  shortcut: {
    name: "Sneaky shortcut", icon: "captain", seconds: 35,
    plan(state, profile, rng) {
      const blds = emLoads(state).filter(n => n.type === "HOUSE" && isOn(state, n.id));
      if (!blds.length) return null;
      const t = blds[Math.floor(rng() * blds.length) % blds.length];
      return { target: t.id, lit: emLit(state), wire: [t.id, t.data.pairId], text: `Captain Short Circuit sneaked a shortcut wire across ${niceName(state, t.id)}! DELETE it.`, actions: { add: [[t.id, t.data.pairId]] } };
    },
    check: (state, p) => !state.wires.some(w => sameWire(w, p.wire[0], p.wire[1])) && p.lit.every(id => isOn(state, id)),
  },
  overheat: {
    name: "Overheating generator", icon: "gen", seconds: 35,
    plan(state) {
      const a = genAmps(state);
      if (!(a >= 0.6) || state.solverError) return null;
      const limit = Math.round(a * 0.7 * 100) / 100;
      return { limit, text: `The generator is overheating! Get it under ${limit.toFixed(2)} A (it's at ${a.toFixed(2)} A) — but keep at least one building bright.`, actions: {} };
    },
    check: (state, p) => genAmps(state) <= p.limit && emLoads(state).some(n => n.type === "HOUSE" && isOn(state, n.id)),
  },
  sciencefair: {
    name: "Science fair rush", icon: "led_on", seconds: 75,
    plan(state, profile) {
      if (levelForXp(profile.xp) < PARTS.LED.level) return null;
      const now = emLoads(state).filter(n => n.type === "LED" && isOn(state, n.id)).length;
      const want = now + 1;
      return { want, text: `The science fair starts soon! Light ${want} LED${want > 1 ? "s" : ""} at once (you have ${now}). Don't forget the resistors!`, actions: {} };
    },
    check: (state, p) => emLoads(state).filter(n => n.type === "LED" && isOn(state, n.id)).length >= p.want,
  },
  gremlin: {
    name: "Wire gremlin", icon: "led_off", seconds: 45,
    plan(state) {
      for (const n of emLoads(state)) {
        if (n.type !== "LED" || !isOn(state, n.id)) continue;
        const into = state.wires.filter(w => w.a === n.id || w.b === n.id);
        const out = state.wires.filter(w => w.a === n.data.pairId || w.b === n.data.pairId);
        if (into.length !== 1 || out.length !== 1) continue;
        const x = into[0].a === n.id ? into[0].b : into[0].a, y = out[0].a === n.data.pairId ? out[0].b : out[0].a;
        if (x === n.data.pairId || y === n.id) continue;
        return { target: n.id, text: `A gremlin turned LED ${n.id} round the wrong way! Wire it the right way again.`, actions: { cut: [[x, n.id], [n.data.pairId, y]], add: [[x, n.data.pairId], [n.id, y]] } };
      }
      return null;
    },
    check: (state, p) => isOn(state, p.target),
  },
  drained: {
    name: "Drained battery", icon: "battery", seconds: 70,
    plan(state) {
      const b = [...state.nodes.values()].find(n => n.type === "BAT");
      if (!b) return null;
      return { target: b.id, text: `A raccoon left battery ${b.id}'s lights on all night — it's empty! Charge it to half full (6 V).`, actions: { drain: [b.id] } };
    },
    check: (state, p) => Math.abs(state.nodes.get(p.target)?.data?.Vprev ?? 0) >= 6,
  },
  eclipse: {
    name: "Solar eclipse", icon: "moon", seconds: 50, hold: 10,
    plan(state) {
      if (!((state.solarFactor ?? 0) > 0) || !emLoads(state).length) return null;
      if (![...state.nodes.values()].some(n => n.type === "SOLAR")) return null;
      // A building that only shines thanks to the sun.
      const dark = cloneCircuit(state); dark.solarFactor = 0;
      try { computePower(dark, 0); } catch (e) { return null; }
      const t = emLoads(state).find(n => n.type === "HOUSE" && isOn(state, n.id) && !isOn(dark, n.id));
      if (!t || !litAlone(state, t.id, { solarFactor: 0 })) return null;
      return { target: t.id, env: { solarFactor: 0 }, progress: 0, text: `Solar eclipse! The Moon is hiding the Sun. Keep ${niceName(state, t.id)} bright for 10 seconds some other way.`, actions: {} };
    },
    check(state, p, dt) {
      if (isOn(state, p.target)) p.progress += dt || 0; else p.progress = 0;
      return p.progress >= this.hold;
    },
  },
};
const EMERGENCY_KEYS = Object.keys(EMERGENCIES);

// Pick an emergency that fits this town right now, or null.
// A plan is only used if it really breaks something (or needs doing).
function pickEmergency(state, profile, rng = Math.random, only = null) {
  const keys = only ? [only] : EMERGENCY_KEYS.slice();
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  for (const key of keys) for (let attempt = 0; attempt < 3; attempt++) {
    const E = EMERGENCIES[key];
    let plan;
    try { plan = E.plan(state, profile, rng); } catch (e) { plan = null; }
    if (!plan) break;
    plan.key = key;
    plan.seconds = E.seconds;
    // Broken (or not yet done) right after it starts?
    const s = cloneCircuit(state);
    applyEmergencyActions(s, plan.actions);
    if (plan.env) Object.assign(s, plan.env);
    try { computePower(s, 0); } catch (e) { continue; }
    const probe = JSON.parse(JSON.stringify(plan));
    if (E.check.call(E, s, probe, 0) && !E.hold) continue;
    return plan;
  }
  return null;
}
function checkEmergency(state, plan, dt) {
  const E = EMERGENCIES[plan.key];
  try { return !!E.check.call(E, state, plan, dt); } catch (e) { return false; }
}
