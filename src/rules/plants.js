// src/rules/plants.js
//
// Power plants and the power lines between towns. Each town has one plant
// (profile.plantIn[region], "generator" by default). On the board a plant is
// still the GEN dot, a Thevenin source: bigger plants have a smaller internal
// resistance R, so they sag less and more buildings stay bright. Each plant
// also has a catch that sets how hard it can push right now (avail, 0..1,
// times the usual 12 V). It never goes above 12 V, so a Medium resistor
// always keeps an LED safe.
//
// Power lines join neighbouring towns. A line has real resistance, so most
// power is lost on the way unless you step the voltage up at one end and
// back down at the other: the line's resistance, seen from the town, shrinks
// by the square of the ratio (8 ohms -> 0.32 at x5 -> 0.08 at x10). Joined
// towns share their plants, like extra generators in parallel.
//
// Main pieces: PLANTS, plantAvail(), buyPlant(), buildLine(), gridSupply().
// Uses: REGIONS and regionStatus() from src/rules/world.js, dayNumber() and
// seededRandom() from src/rules/game.js.
// Used by: src/scene/town.js (what powers the GEN), src/scene/worldmap.js
// (building lines). Tested by tests/plants.test.mjs.

const PLANTS = {
  generator: {
    name: "Little generator", price: 0, level: 1, R: 1.5, sprite: "gen",
    good: "Always on. Fine for a few houses.",
    catchText: "Small: more than three or four buildings make it sag.",
  },
  solarfarm: {
    name: "Solar farm", price: 150, level: 7, R: 0.8, sprite: "plant_solarfarm",
    good: "Clean power from sunshine — lots of it at noon.",
    catchText: "Sleeps at night, and clouds make it weak.",
  },
  wind: {
    name: "Wind turbine", price: 180, level: 10, R: 0.9, sprite: "plant_wind",
    good: "Free power whenever the wind blows.",
    catchText: "Weak on calm days, and it brakes in storms. No wind on the Moon!",
  },
  hydro: {
    name: "Hydro dam", price: 260, level: 12, R: 0.7, sprite: "plant_hydro",
    good: "Falling water: steady power, day and night.",
    catchText: "Needs a river — low in heat waves, useless in the desert or on the Moon.",
  },
  coal: {
    name: "Coal plant", price: 300, level: 14, R: 0.6, sprite: "plant_coal",
    good: "Big and steady, any weather.",
    catchText: "Burns 4 coins of coal every morning (half power if you can't pay), and its smoke slows down new people moving in.",
  },
  nuclear: {
    name: "Nuclear plant", price: 500, level: 16, R: 0.4, sprite: "plant_nuclear",
    good: "Huge, steady, clean power.",
    catchText: "Takes 45 seconds to warm up every time you arrive in town.",
  },
  geothermal: {
    name: "Geothermal plant", price: 420, level: 18, R: 0.6, sprite: "plant_geothermal",
    good: "Heat from deep underground, day and night.",
    catchText: "Full power only on Volcano Island — 60% anywhere else.",
  },
  biogas: {
    name: "Biogas plant", price: 380, level: 20, R: 0.8, sprite: "plant_biogas",
    good: "Turns the town's food scraps into power.",
    catchText: "Needs people: the more people live in town, the more it makes.",
  },
  tidal: {
    name: "Tidal plant", price: 450, level: 22, R: 0.5, sprite: "plant_tidal",
    good: "The tide never stops — strong power by the sea.",
    catchText: "Only by the sea (Battery Bay, Volcano Island, Storm Coast), and weaker between tides.",
  },
  fusion: {
    name: "Fusion reactor", price: 2000, level: 24, R: 0.25, sprite: "plant_fusion",
    good: "A tiny star in a box: the most power of all.",
    catchText: "Costs a fortune.",
  },
};
const PLANT_KEYS = Object.keys(PLANTS);
const SEA_REGIONS = ["batterybay", "volcano", "storm"];
const NO_RIVER = ["solardesert", "moon"];
const NUCLEAR_WARMUP = 45; // seconds
const COAL_FUEL = 4;       // coins each in-game morning

// Today's wind in a region, 0 (calm) to 1 (strong). Seeded by the day so
// everyone gets the same wind. Windier in Windmill Valley and on the coast.
function windFor(now, region) {
  if (region === "moon") return 0;
  const r = seededRandom(dayNumber(now) * 4243 + 97)();
  const bonus = region === "windmill" ? 0.35 : region === "storm" || region === "batterybay" ? 0.2 : 0;
  return Math.min(1, 0.25 + r * 0.75 + bonus);
}
function windName(w) { return w < 0.45 ? "calm" : w < 0.75 ? "breezy" : "windy"; }

// How hard a plant can push right now, 0..1.
//   env: { weatherKey, night, solarFactor, wind, tideT (0..1 through the day),
//          population, warm (seconds since arriving), region, coalPaid }
function plantAvail(key, env) {
  const e = env || {};
  switch (key) {
    case "solarfarm": return Math.max(0, Math.min(1, e.night ? 0 : (e.solarFactor ?? 1)));
    case "wind": {
      if (e.weatherKey === "storm") return 0.3;          // brakes on to stay safe
      const w = e.wind ?? 0.6;
      return Math.max(0, Math.min(1, w < 0.05 ? 0 : 0.25 + w * 0.75));
    }
    case "hydro": {
      if (NO_RIVER.includes(e.region)) return 0;
      return e.weatherKey === "heat" ? 0.7 : 1;
    }
    case "coal": return e.coalPaid === false ? 0.5 : 1;
    case "nuclear": return Math.max(0, Math.min(1, (e.warm ?? NUCLEAR_WARMUP) / NUCLEAR_WARMUP));
    case "geothermal": return e.region === "volcano" ? 1 : e.region === "moon" ? 0.3 : 0.6;
    case "biogas": return Math.max(0.3, Math.min(1, 0.3 + (e.population ?? 0) / 80));
    case "tidal": {
      if (!SEA_REGIONS.includes(e.region)) return 0;
      const t = e.tideT ?? 0.25;                          // two high tides a day
      return 0.55 + 0.45 * Math.abs(Math.cos(2 * Math.PI * 2 * t));
    }
    default: return 1;                                   // generator, fusion
  }
}

// A plain sentence about how a plant is doing right now.
function plantStatusText(key, env) {
  const a = Math.round(plantAvail(key, env) * 100);
  const P = PLANTS[key];
  const e = env || {};
  let why = "";
  if (key === "solarfarm") why = e.night ? " (night — no sun)" : (e.solarFactor ?? 1) < 1 ? " (clouds)" : "";
  if (key === "wind") why = e.weatherKey === "storm" ? " (storm — brakes on)" : ` (${windName(e.wind ?? 0.6)})`;
  if (key === "hydro") why = NO_RIVER.includes(e.region) ? " (no river here!)" : e.weatherKey === "heat" ? " (low water)" : "";
  if (key === "coal" && e.coalPaid === false) why = " (out of coal!)";
  if (key === "nuclear" && a < 100) why = " (warming up)";
  if (key === "geothermal" && e.region !== "volcano") why = " (not on Volcano Island)";
  if (key === "biogas") why = ` (${e.population ?? 0} people)`;
  if (key === "tidal") why = SEA_REGIONS.includes(e.region) ? (a > 80 ? " (high tide)" : " (low tide)") : " (no sea here!)";
  return `${P.name}: ${a}%${why}`;
}

// --- Owning plants ---
// Bought once, usable in every town.

function plantOwned(profile, key) {
  return key === "generator" || (profile.owned.plants || []).includes(key);
}
function cannotBuyPlant(profile, key) {
  const P = PLANTS[key];
  if (!P || key === "generator") return "That isn't for sale.";
  if (plantOwned(profile, key)) return "You already have it.";
  if (levelForXp(profile.xp) < P.level) return `Unlocks at level ${P.level}.`;
  if (profile.coins < P.price) return `You need ${P.price - profile.coins} more coins.`;
  return null;
}
function buyPlant(profile, key, region) {
  const why = cannotBuyPlant(profile, key);
  if (why) return { ok: false, why };
  profile.coins -= PLANTS[key].price;
  profile.owned.plants.push(key);
  if (region) profile.plantIn[region] = key;
  return { ok: true };
}
function usePlant(profile, key, region) {
  if (!PLANTS[key] || !plantOwned(profile, key)) return false;
  profile.plantIn[region] = key;
  return true;
}
function plantOf(profile, region) {
  const k = profile.plantIn?.[region];
  return k && PLANTS[k] && plantOwned(profile, k) ? k : "generator";
}

// --- Power lines ---

const LINE_R = 8;                    // ohms, one line between neighbours
const LINE_RATIOS = { 1: { name: "No transformers (12 V)", price: 80 }, 5: { name: "Step up ×5 (60 V)", price: 160 }, 10: { name: "Step up ×10 (120 V)", price: 240 } };
const LINE_REF_LOAD = 6;             // ohms: a typical busy town, for the "% lost" figure

// True when a and b are next to each other on the map route.
function lineNeighbours(a, b) {
  const i = REGION_KEYS.indexOf(a), j = REGION_KEYS.indexOf(b);
  return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
}
// The line's resistance as the town sees it (through the transformers).
function lineR(ratio) { return LINE_R / (ratio * ratio); }
// Out of every 100 units sent down the line, how many are lost as heat.
function lineLossPercent(ratio) {
  const r = lineR(ratio);
  return Math.round((r / (r + LINE_REF_LOAD)) * 100);
}
function findLine(profile, a, b) {
  return (profile.lines || []).find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || null;
}
// Why you can't build this line now, or null.
function cannotBuildLine(profile, a, b, ratio) {
  if (!lineNeighbours(a, b)) return "Lines only join towns next to each other on the map.";
  if (!LINE_RATIOS[ratio]) return "Pick a transformer.";
  for (const k of [a, b]) { const regionInfo = regionStatus(profile, k); if (!regionInfo.ok) return `${REGIONS[k].name} is still locked.`; }
  const old = findLine(profile, a, b);
  if (old && old.ratio === ratio) return "That line is already built.";
  const price = LINE_RATIOS[ratio].price;
  if (profile.coins < price) return `You need ${price - profile.coins} more coins.`;
  return null;
}
// Build (or upgrade) the line between a and b.
function buildLine(profile, a, b, ratio) {
  const why = cannotBuildLine(profile, a, b, ratio);
  if (why) return { ok: false, why };
  profile.coins -= LINE_RATIOS[ratio].price;
  const old = findLine(profile, a, b);
  if (old) old.ratio = ratio; else profile.lines.push({ a, b, ratio });
  return { ok: true };
}

// Every town this one is joined to (through any chain of lines), with the
// total line resistance on the way: [{ region, R }].
function linkedTowns(profile, region) {
  const best = new Map([[region, 0]]);
  const queue = [region];
  while (queue.length) {
    const u = queue.shift();
    for (const l of profile.lines || []) {
      const v = l.a === u ? l.b : l.b === u ? l.a : null;
      if (!v) continue;
      const r = best.get(u) + lineR(l.ratio);
      if (!best.has(v) || r < best.get(v) - 1e-12) { best.set(v, r); queue.push(v); }
    }
  }
  best.delete(region);
  return [...best].map(([k, R]) => ({ region: k, R }));
}

// What the GEN dot in `region` really is right now: its own plant plus every
// linked town's plant in parallel. Returns { genScale, R, parts } for the
// solver (state.genScale, state.R_GEN). `envFor(region)` gives a region's
// plant environment.
function gridSupply(profile, region, envFor) {
  const sources = [];
  const own = plantOf(profile, region);
  sources.push({ region, plant: own, avail: plantAvail(own, envFor(region)), R: PLANTS[own].R });
  for (const t of linkedTowns(profile, region)) {
    const k = plantOf(profile, t.region);
    sources.push({ region: t.region, plant: k, avail: plantAvail(k, envFor(t.region)), R: PLANTS[k].R + t.R });
  }
  // Thevenin sources in parallel. A plant that can't push at all is skipped:
  // its one-way valve stops it pulling current backwards (src/circuit/solver.js).
  let G = 0, I = 0;
  for (const s of sources) {
    if (s.avail <= 0) continue;
    G += 1 / s.R;
    I += s.avail / s.R;
  }
  if (G === 0) return { genScale: 0, R: PLANTS[own].R, parts: sources };
  return { genScale: Math.min(1, I / G), R: 1 / G, parts: sources };
}
