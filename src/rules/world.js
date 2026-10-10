// src/rules/world.js
//
// The world around your town: the twelve map regions (each with its own
// story, people and parts), Captain Short Circuit's blackout boss fights,
// the sticker book, and your sidekick (a dog or Sparky the robot) and its
// clothes. Pure logic, no Phaser. Tested by tests/world.test.mjs.
//
// Main pieces: REGIONS, regionStatus(), travelTo(), BOSSES, pickBreaks(),
// applyBreaks(), bossReward(), STICKERS, awardSticker(), PET_ITEMS,
// nextCaptain().
// Used by: src/scene/worldmap.js, src/scene/boss.js, src/scene/contexts.js,
// src/scene/rewards.js, src/ui/map.js, src/ui/shop.js.

// --- Regions ---
// Each region keeps its own saved town. A region opens at a level, and only
// after you beat Captain Short Circuit in the region before it.

const REGIONS = {
  sparkville: {
    name: "Sparkville",
    level: 1, needsBoss: null, bossLevel: 3,
    parts: ["HOUSE", "RES", "LED", "TRANS"], plant: "generator",
    learn: "Loops: power goes out of GEN, through a building, and home to GND.",
    story: "Sparkville is where it all begins: a sleepy town with one power station and a lot of dark windows. Mayor Volt needs a new town engineer — that's you!",
    characters: [
      { name: "Mayor Volt", line: "Every house deserves a complete loop!" },
      { name: "Grandma Rosa", line: "My lamp needs a resistor buddy, dear." },
    ],
    residents: ["Grandma Rosa", "Mr. Patel", "Little Sam", "The Nguyens", "Ms. Bell", "Uncle Theo", "Mia and Max"],
    ground: "grass",
  },
  batterybay: {
    name: "Battery Bay",
    level: 4, needsBoss: "sparkville", bossLevel: 5,
    parts: ["CAP", "BAT"], plant: "generator",
    learn: "Storing power: fill capacitors and batteries by day, use them at night.",
    story: "A windy harbour where the lighthouse must shine all night. The generator can't keep up after dark, so the harbour stores power in capacitors and batteries during the day.",
    characters: [
      { name: "Captain Coral", line: "Charge it by day, shine it by night!" },
      { name: "Fisher Finn", line: "My boat lights need a battery that lasts." },
    ],
    residents: ["Captain Coral", "Fisher Finn", "Old Salty", "Pearl", "The Harbour Twins"],
    ground: "sand",
  },
  solardesert: {
    name: "Solar Desert",
    level: 6, needsBoss: "batterybay", bossLevel: 7,
    parts: ["SOLAR"], plant: "solarfarm",
    learn: "Sunshine power: a solar panel is a little generator that needs light.",
    story: "No power lines reach the desert, but the sun shines almost every day. Professor Sunny is building a town that runs on sunshine.",
    characters: [
      { name: "Professor Sunny", line: "Sunlight in, electricity out!" },
      { name: "Cactus Carl", line: "Even a cactus needs a fan out here." },
    ],
    residents: ["Professor Sunny", "Cactus Carl", "Dune Dana", "Rattle Ray", "Oasis Olu"],
    ground: "dune",
    // It almost never rains here: clouds become sun, storms become heat.
    weatherMap: { normal: "sunny", cloudy: "sunny", storm: "heat" },
  },
  mountains: {
    name: "Transformer Mountains",
    level: 8, needsBoss: "solardesert", bossLevel: 9,
    parts: ["XFMR"], plant: "generator",
    learn: "Transformers: step the voltage up to travel, down to use.",
    story: "Power from the big dam has to travel over the peaks. Engineer Ella uses transformers to step the voltage up for the long trip, and back down for the homes.",
    characters: [
      { name: "Engineer Ella", line: "Step it up to travel, step it down to use!" },
      { name: "Yeti Yuri", line: "Even my cave wants lights." },
    ],
    residents: ["Engineer Ella", "Yeti Yuri", "Goat Herder Gus", "Skier Sky", "Ranger Rae"],
    ground: "rocky",
  },
  windmill: {
    name: "Windmill Valley",
    level: 10, needsBoss: "mountains", bossLevel: 11,
    parts: ["LED", "RES"], plant: "wind",
    learn: "Series and parallel: lights in a row share the push; lights side by side each get it all.",
    story: "Rolling green hills where the wind never stops. Farmer Fern wants wind turbines — and strings of lights for the harvest festival.",
    characters: [
      { name: "Farmer Fern", line: "The wind is free power — when it blows!" },
      { name: "Miller Mo", line: "Two bulbs in a row glow dimmer. Side by side, they both shine!" },
    ],
    residents: ["Farmer Fern", "Miller Mo", "Hay-bale Hal", "Shepherd Shay", "Tulip Tess"],
    ground: "meadow",
    weatherMap: { heat: "normal" },
  },
  waterfall: {
    name: "Waterfall Woods",
    level: 12, needsBoss: "windmill", bossLevel: 13,
    parts: ["RES"], plant: "hydro",
    learn: "Resistance: a bigger resistor lets less current through.",
    story: "A misty forest around a roaring waterfall. Ranger Rivers wants a hydro dam — and the cabins need just the right resistors.",
    characters: [
      { name: "Ranger Rivers", line: "Falling water spins the turbine, rain or shine!" },
      { name: "Beaver Bo", line: "I build dams too, you know." },
    ],
    residents: ["Ranger Rivers", "Beaver Bo", "Owl Olive", "Logger Lou", "Moss Mia"],
    ground: "forest",
  },
  neon: {
    name: "Neon City",
    level: 14, needsBoss: "waterfall", bossLevel: 15,
    parts: ["LED"], plant: "coal",
    learn: "LEDs everywhere: every LED needs its resistor buddy, and strings share one.",
    story: "A big city that never sleeps. The billboards and signs are made of thousands of LEDs, and DJ Diode wants them all glowing.",
    characters: [
      { name: "DJ Diode", line: "One way only, baby — orange to GEN!" },
      { name: "Sign-maker Sal", line: "No resistor? No sign. That's the rule." },
    ],
    residents: ["DJ Diode", "Sign-maker Sal", "Taxi Tina", "Chef Neo", "The Pixel Twins"],
    ground: "pavement",
  },
  tundra: {
    name: "Frosty Tundra",
    level: 16, needsBoss: "neon", bossLevel: 17,
    parts: ["BAT", "CAP"], plant: "nuclear",
    learn: "Storing power: long nights need full batteries.",
    story: "Snow and ice as far as you can see. Nights are long, so Professor Polar's research camp lives on batteries.",
    characters: [
      { name: "Professor Polar", line: "Charge everything while the sun is up!" },
      { name: "Penny Penguin", line: "Brrr! Keep my igloo lights on!" },
    ],
    residents: ["Professor Polar", "Penny Penguin", "Husky Hank", "Iceberg Ivy", "Snowy Sven"],
    ground: "snow",
    weatherMap: { sunny: "cloudy", heat: "normal" },
  },
  volcano: {
    name: "Volcano Island",
    level: 18, needsBoss: "tundra", bossLevel: 19,
    parts: ["HOUSE"], plant: "geothermal",
    learn: "Big loads: every building takes a share of the generator's power.",
    story: "A smoking volcano in a warm sea. The heat underground can make power, and Dr. Magma's lab needs lots of it.",
    characters: [
      { name: "Dr. Magma", line: "The earth itself is a power station!" },
      { name: "Lava Larry", line: "Too many big buildings on one generator? Everything goes dim." },
    ],
    residents: ["Dr. Magma", "Lava Larry", "Coconut Cora", "Ash Ari", "Pele the Parrot"],
    ground: "ash",
    weatherMap: { cloudy: "heat", normal: "sunny" },
  },
  robot: {
    name: "Robot Factory",
    level: 20, needsBoss: "volcano", bossLevel: 21,
    parts: ["TRANS"], plant: "biogas",
    learn: "Switch logic: two switches in a row make AND; side by side make OR.",
    story: "Clanking conveyor belts and blinking robots. Robo-Boss 3000 runs the factory with switches — lots of switches.",
    characters: [
      { name: "Robo-Boss 3000", line: "BOTH SWITCHES ON = AND. EITHER SWITCH ON = OR. BEEP." },
      { name: "Gizmo", line: "I'm a little robot with a big job!" },
    ],
    residents: ["Robo-Boss 3000", "Gizmo", "Widget", "Cog Cassie", "Bolt Bea"],
    ground: "metal",
  },
  storm: {
    name: "Storm Coast",
    level: 22, needsBoss: "robot", bossLevel: 23,
    parts: ["XFMR", "BAT"], plant: "tidal",
    learn: "Tough grids: backup power and fixing lines fast.",
    story: "Wild waves and thunderclouds. The tide rises and falls twice a day — Captain Gale wants to catch that power.",
    characters: [
      { name: "Captain Gale", line: "The sea never stops moving. Neither should your power!" },
      { name: "Surfer Sid", line: "Big wave, big watts, dude." },
    ],
    residents: ["Captain Gale", "Surfer Sid", "Seagull Sam", "Crabby Kay", "Diver Dee"],
    ground: "cliff",
    weatherMap: { sunny: "storm", heat: "cloudy" },
  },
  moon: {
    name: "Moon Base",
    level: 24, needsBoss: "storm", bossLevel: 25,
    parts: ["SOLAR", "BAT", "XFMR"], plant: "fusion",
    learn: "Everything you know — the final exam!",
    story: "The first town on the Moon! No air, no wind, no water. Commander Luna needs the best engineer in the world: you.",
    characters: [
      { name: "Commander Luna", line: "One small wire for an engineer, one giant leap for ECE City!" },
      { name: "Rover Rex", line: "Beep boop. My batteries are low." },
    ],
    residents: ["Commander Luna", "Rover Rex", "Astro Ana", "Cosmo Kai", "Orbit Ollie"],
    ground: "moon",
    // No weather on the Moon: always clear.
    weatherMap: { cloudy: "normal", heat: "normal", storm: "normal" },
  },
};
const REGION_KEYS = Object.keys(REGIONS);

// Can you travel there? Returns { ok, why }.
function regionStatus(profile, key) {
  const r = REGIONS[key];
  if (!r) return { ok: false, why: "That place isn't on the map." };
  const lvl = levelForXp(profile.xp);
  if (lvl < r.level) return { ok: false, why: `Reach level ${r.level} to travel here.` };
  if (r.needsBoss && !bossBeaten(profile, r.needsBoss)) return { ok: false, needsBoss: r.needsBoss, why: `Beat Captain Short Circuit in ${REGIONS[r.needsBoss].name} first to open this world. He's waiting there — tap "Find the Captain".` };
  return { ok: true, why: null };
}
function bossBeaten(profile, key) {
  const w = profile.bossWins?.[key];
  return !!w && Object.values(w).some(Boolean);
}
// Can you fight this region's boss? Returns { ok, why }.
function bossStatus(profile, key) {
  const r = REGIONS[key];
  const reg = regionStatus(profile, key);
  if (!reg.ok) return reg;
  if (levelForXp(profile.xp) < r.bossLevel) return { ok: false, why: `Captain Short Circuit shows up here at level ${r.bossLevel} (you're level ${levelForXp(profile.xp)}). Earn XP with LEVELS ★ and orders.` };
  return { ok: true, why: null };
}
// Today's weather as it looks in this region (see weatherMap above).
function regionWeather(weather, key) {
  const map = REGIONS[key]?.weatherMap;
  const k = map?.[weather.key];
  return k && WEATHER[k] ? { key: k, ...WEATHER[k] } : weather;
}

// Each region's first town board (the same format as a saved town).
const REGION_STARTERS = {
  sparkville: null, // uses STARTER_TOWN from src/rules/missions.js
  batterybay: {
    counters: { H: 2, B: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 },
      { kind: "HOUSE", id: "H1", x: 650, y: 260 },
      { kind: "BAT", id: "B0", x: 560, y: 460, Vprev: 0 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  solardesert: {
    counters: { H: 2, S: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 },
      { kind: "SOLAR", id: "S0", x: 560, y: 450 },
      { kind: "HOUSE", id: "H1", x: 700, y: 260 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  mountains: {
    counters: { H: 2, X: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 },
      { kind: "XFMR", id: "X0", x: 560, y: 440, ratio: 1 },
      { kind: "HOUSE", id: "H1", x: 700, y: 260 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  windmill: {
    counters: { H: 2, R: 1, L: 2 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 700, y: 260 },
      { kind: "RES", id: "R0", x: 420, y: 430, ohms: 330 }, { kind: "LED", id: "L0", x: 540, y: 440 }, { kind: "LED", id: "L1", x: 660, y: 440 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  waterfall: {
    counters: { H: 2, R: 2, L: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 700, y: 260 },
      { kind: "RES", id: "R0", x: 430, y: 430, ohms: 1000 }, { kind: "RES", id: "R1", x: 540, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 660, y: 440 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  neon: {
    counters: { H: 1, R: 2, L: 3 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 },
      { kind: "RES", id: "R0", x: 560, y: 240, ohms: 470 }, { kind: "LED", id: "L0", x: 680, y: 250 },
      { kind: "RES", id: "R1", x: 430, y: 430, ohms: 330 }, { kind: "LED", id: "L1", x: 560, y: 440 }, { kind: "LED", id: "L2", x: 680, y: 440 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  tundra: {
    counters: { H: 2, B: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 700, y: 260 },
      { kind: "BAT", id: "B0", x: 560, y: 460, Vprev: 0 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  volcano: {
    counters: { H: 3 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 650, y: 260 }, { kind: "HOUSE", id: "H2", x: 650, y: 450 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  robot: {
    counters: { H: 2, T: 2 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 },
      { kind: "TRANS", id: "T0", x: 420, y: 470, on: true }, { kind: "TRANS", id: "T1", x: 560, y: 470, on: true },
      { kind: "HOUSE", id: "H1", x: 700, y: 260 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  storm: {
    counters: { H: 2, X: 1, B: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 700, y: 260 },
      { kind: "XFMR", id: "X0", x: 560, y: 440, ratio: 1 }, { kind: "BAT", id: "B0", x: 700, y: 470, Vprev: 0 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
  moon: {
    counters: { H: 2, S: 1, B: 1 },
    parts: [
      { kind: "HOUSE", id: "H0", x: 430, y: 260 }, { kind: "HOUSE", id: "H1", x: 700, y: 260 },
      { kind: "SOLAR", id: "S0", x: 560, y: 450 }, { kind: "BAT", id: "B0", x: 700, y: 470, Vprev: 0 },
    ],
    wires: [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }],
  },
};

// Travel: remember the region and mark it visited. The town board itself is
// saved and loaded by the scene. Orders and storm repairs belong to the town
// you left, so they are cleared.
function travelTo(profile, key, now) {
  const regionInfo = regionStatus(profile, key);
  if (!regionInfo.ok) return { ok: false, why: regionInfo.why };
  const first = !profile.visited.includes(key);
  profile.region = key;
  if (first) profile.visited.push(key);
  profile.orders = [null, null, null];
  profile.refillAt = [now + 2000, now + 2000, now + 2000];
  profile.repair = null;
  return { ok: true, first };
}

// --- Blackout bosses ---
// Captain Short Circuit blacks out the town by breaking a big circuit. Fix it
// before the clock runs out. Each right guess for Sparky "zaps" him: more
// time on the clock and bonus coins.
//
// Each boss has a solved board and a list of `breaks`. Each break is undone
// by adding a wire, deleting one or flipping a switch. A fight picks some of
// them, more on harder difficulties.
//   break = { remove: [[a, b]...], add: [[a, b]...], off: [switch ids] }

const DIFFICULTIES = {
  easy:    { name: "Easy",    breaks: 2, seconds: 180, hints: true,  coins: 40,  xp: 30 },
  medium:  { name: "Medium",  breaks: 3, seconds: 150, hints: true,  coins: 70,  xp: 45 },
  hard:    { name: "Hard",    breaks: 4, seconds: 120, hints: true,  coins: 110, xp: 65 },
  extreme: { name: "Extreme", breaks: 5, seconds: 90,  hints: false, coins: 160, xp: 90 },
};
const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);
const ZAP_SECONDS = 8;     // each zap puts this much time back on the clock
const ZAP_COINS = 5;
const MAX_ZAPS = 5;        // per fight

const W = (a, b) => ({ a, b });
const BOSSES = {
  sparkville: {
    title: "Blackout on Main Street",
    taunts: ["Ha! Not one light left in Sparkville!", "I snipped your wires and flipped your switch!", "You'll never fix it in time!"],
    board: {
      counters: { H: 3, R: 1, L: 1, T: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 400, y: 240 }, { kind: "HOUSE", id: "H1", x: 560, y: 240 }, { kind: "HOUSE", id: "H2", x: 720, y: 240 },
        { kind: "TRANS", id: "T0", x: 400, y: 470, on: true },
        { kind: "RES", id: "R0", x: 560, y: 420, ohms: 470 }, { kind: "LED", id: "L0", x: 700, y: 420 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "H1"), W("H1b", "GND"), W("GEN", "T0"), W("T0b", "H2"), W("H2b", "GND"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { remove: [["GEN", "H0"]] },
      { remove: [["H1b", "GND"]] },
      { off: ["T0"] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] }, // LED turned backwards
      { add: [["GEN", "GND"]] },                                                         // a shortcut
      { remove: [["GEN", "R0"]] },
    ],
  },
  batterybay: {
    title: "The Lighthouse Goes Dark",
    taunts: ["The harbour is mine! Not a single light!", "Your battery can't save you now!", "Tick tock, engineer!"],
    board: {
      counters: { H: 2, R: 1, L: 1, T: 1, B: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 420, y: 240 }, { kind: "HOUSE", id: "H1", x: 640, y: 240 },
        { kind: "TRANS", id: "T0", x: 300, y: 470, on: true },
        { kind: "BAT", id: "B0", x: 770, y: 300, Vprev: 12 },
        { kind: "RES", id: "R0", x: 480, y: 420, ohms: 470 }, { kind: "LED", id: "L0", x: 640, y: 430 },
      ],
      wires: [W("GEN", "T0"), W("T0b", "H0"), W("H0b", "GND"), W("GEN", "B0"), W("B0b", "GND"), W("B0", "H1"), W("H1b", "GND"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { off: ["T0"] },
      { remove: [["H0b", "GND"]] },
      { remove: [["H1b", "GND"]] },
      { remove: [["B0", "H1"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { remove: [["GEN", "R0"]] },
    ],
  },
  solardesert: {
    title: "Sandstorm Blackout",
    taunts: ["I buried your sunshine in sand!", "No sun, no fun, no power!", "Try fixing THIS, engineer!"],
    board: {
      counters: { H: 3, S: 2, R: 1, L: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 380, y: 240 },
        { kind: "SOLAR", id: "S0", x: 540, y: 250 }, { kind: "HOUSE", id: "H1", x: 720, y: 240 },
        { kind: "SOLAR", id: "S1", x: 540, y: 450 }, { kind: "HOUSE", id: "H2", x: 720, y: 450 },
        { kind: "RES", id: "R0", x: 290, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 390, y: 450 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("S0", "H1"), W("H1b", "S0b"), W("S1", "H2"), W("H2b", "S1b"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { remove: [["GEN", "H0"]] },
      { remove: [["H1b", "S0b"]] },
      { remove: [["S1", "H2"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { add: [["GEN", "GND"]] },
      { add: [["S0", "S0b"]] }, // shorts out a solar panel
    ],
  },
  mountains: {
    title: "Avalanche Overload",
    taunts: ["Your power will never cross my mountains!", "I swapped your transformers — good luck!", "Brrr, it's dark up here!"],
    board: {
      counters: { H: 3, R: 1, L: 1, X: 2 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 380, y: 240 },
        { kind: "XFMR", id: "X0", x: 550, y: 250, ratio: 1 }, { kind: "HOUSE", id: "H1", x: 730, y: 240 },
        { kind: "XFMR", id: "X1", x: 550, y: 450, ratio: 0.5 }, { kind: "HOUSE", id: "H2", x: 730, y: 450 },
        { kind: "RES", id: "R0", x: 290, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 390, y: 450 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "X0P"), W("X0", "H1"), W("H1b", "GND"), W("X0", "H2"), W("H2b", "GND"),
        W("GEN", "X1P"), W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { remove: [["GEN", "H0"]] },
      { remove: [["X0", "H1"]], add: [["X1", "H1"]] }, // H1 now on the step-DOWN transformer
      { remove: [["H2b", "GND"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { add: [["GEN", "GND"]] },
      { remove: [["GEN", "X0P"]] },
    ],
  },
  windmill: {
    title: "The Harvest Festival Blackout",
    taunts: ["No wind, no lights, no festival!", "I broke your string of lights — one gap and they ALL go out!", "Blow all you like, engineer!"],
    board: {
      counters: { H: 3, R: 1, L: 2, T: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 330, y: 240 }, { kind: "HOUSE", id: "H1", x: 470, y: 240 },
        { kind: "TRANS", id: "T0", x: 610, y: 250, on: true }, { kind: "HOUSE", id: "H2", x: 740, y: 240 },
        { kind: "RES", id: "R0", x: 300, y: 430, ohms: 430 }, { kind: "LED", id: "L0", x: 430, y: 440 }, { kind: "LED", id: "L1", x: 560, y: 440 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "H1"), W("H1b", "GND"), W("GEN", "T0"), W("T0b", "H2"), W("H2b", "GND"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "L1"), W("L1b", "GND")],
    },
    breaks: [
      { remove: [["GEN", "H1"]] },
      { off: ["T0"] },
      { remove: [["R0b", "L0"], ["L0b", "L1"]], add: [["R0b", "L0b"], ["L0", "L1"]] }, // first light of the string turned backwards
      { remove: [["L1b", "GND"]] },
      { add: [["H0", "H0b"]] },                                                    // a shortcut across a house
      { remove: [["H2b", "GND"]] },
    ],
  },
  waterfall: {
    title: "The Great Log Jam",
    taunts: ["I jammed your rivers and your wires!", "Your cabins are as dark as the forest!", "Timber! Ha ha ha!"],
    board: {
      counters: { H: 3, R: 2, L: 2 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 330, y: 240 }, { kind: "HOUSE", id: "H1", x: 480, y: 240 }, { kind: "HOUSE", id: "H2", x: 630, y: 240 },
        { kind: "RES", id: "R0", x: 300, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 400, y: 440 },
        { kind: "RES", id: "R1", x: 540, y: 430, ohms: 470 }, { kind: "LED", id: "L1", x: 640, y: 440 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "H1"), W("H1b", "GND"), W("GEN", "H2"), W("H2b", "GND"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND"), W("GEN", "R1"), W("R1b", "L1"), W("L1b", "GND")],
    },
    breaks: [
      { remove: [["GEN", "H0"]] },
      { remove: [["H2b", "GND"]] },
      { remove: [["R1b", "L1"], ["L1b", "GND"]], add: [["R1b", "L1b"], ["L1", "GND"]] },
      { remove: [["R0b", "L0"]] },
      { add: [["GEN", "GND"]] },
      { remove: [["GEN", "H1"]] },
    ],
  },
  neon: {
    title: "Lights Out on Broadway",
    taunts: ["Not one blinking sign in Neon City!", "I flipped your LEDs the wrong way round!", "The show is OVER, engineer!"],
    board: {
      counters: { H: 2, R: 2, L: 3, T: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 330, y: 240 }, { kind: "TRANS", id: "T0", x: 500, y: 250, on: true }, { kind: "HOUSE", id: "H1", x: 650, y: 240 },
        { kind: "RES", id: "R0", x: 290, y: 420, ohms: 430 }, { kind: "LED", id: "L0", x: 380, y: 430 }, { kind: "LED", id: "L1", x: 470, y: 430 },
        { kind: "RES", id: "R1", x: 580, y: 420, ohms: 470 }, { kind: "LED", id: "L2", x: 680, y: 430 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "T0"), W("T0b", "H1"), W("H1b", "GND"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "L1"), W("L1b", "GND"), W("GEN", "R1"), W("R1b", "L2"), W("L2b", "GND")],
    },
    breaks: [
      { off: ["T0"] },
      { remove: [["R1b", "L2"], ["L2b", "GND"]], add: [["R1b", "L2b"], ["L2", "GND"]] },
      { remove: [["R0b", "L0"], ["L0b", "L1"]], add: [["R0b", "L0b"], ["L0", "L1"]] },
      { remove: [["L1b", "GND"]] },
      { remove: [["GEN", "R1"]] },
      { add: [["GEN", "GND"]] },
    ],
  },
  tundra: {
    title: "The Long Freeze",
    taunts: ["Brrr! I froze every wire in the tundra!", "Your batteries can't save you from ME!", "Enjoy the long, dark night!"],
    board: {
      counters: { H: 3, R: 1, L: 1, T: 1, B: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 320, y: 240 }, { kind: "BAT", id: "B0", x: 440, y: 300, Vprev: 12 }, { kind: "HOUSE", id: "H1", x: 560, y: 240 },
        { kind: "TRANS", id: "T0", x: 440, y: 480, on: true }, { kind: "HOUSE", id: "H2", x: 590, y: 450 },
        { kind: "RES", id: "R0", x: 700, y: 250, ohms: 470 }, { kind: "LED", id: "L0", x: 770, y: 260 },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "B0"), W("B0b", "GND"), W("B0", "H1"), W("H1b", "GND"),
        W("GEN", "T0"), W("T0b", "H2"), W("H2b", "GND"), W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { remove: [["B0", "H1"]] },
      { remove: [["H0b", "GND"]] },
      { off: ["T0"] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { remove: [["GEN", "R0"]] },   // no shortcut break here: it would drain the battery on the GEN dot
      { remove: [["H2b", "GND"]] },
    ],
  },
  volcano: {
    title: "Eruption Overload",
    taunts: ["My volcano blew your fuses!", "Too much heat, not enough light!", "Ha! Even the bakery is dark!"],
    board: {
      counters: { H: 3, R: 1, L: 1, T: 1, S: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 330, y: 240 }, { kind: "HOUSE", id: "H1", x: 480, y: 240, building: "bakery" },
        { kind: "SOLAR", id: "S0", x: 620, y: 260 }, { kind: "HOUSE", id: "H2", x: 740, y: 240 },
        { kind: "TRANS", id: "T0", x: 330, y: 470, on: true },
        { kind: "RES", id: "R0", x: 500, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 620, y: 440 },
      ],
      wires: [W("GEN", "T0"), W("T0b", "H0"), W("H0b", "GND"), W("GEN", "H1"), W("H1b", "GND"), W("S0", "H2"), W("H2b", "S0b"),
        W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { off: ["T0"] },
      { remove: [["H1b", "GND"]] },
      { remove: [["S0", "H2"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { add: [["GEN", "GND"]] },
      { add: [["S0", "S0b"]] },
    ],
  },
  robot: {
    title: "Factory Shutdown",
    taunts: ["BEEP BOOP! I switched off your whole factory!", "AND, OR... I say NOT!", "Your robots are sleeping forever!"],
    board: {
      counters: { H: 3, R: 1, L: 1, T: 4 },
      parts: [
        { kind: "TRANS", id: "T0", x: 300, y: 250, on: true }, { kind: "TRANS", id: "T1", x: 420, y: 250, on: true }, { kind: "HOUSE", id: "H0", x: 560, y: 240 },
        { kind: "TRANS", id: "T2", x: 300, y: 450, on: true }, { kind: "TRANS", id: "T3", x: 420, y: 450, on: true }, { kind: "HOUSE", id: "H1", x: 560, y: 450 },
        { kind: "HOUSE", id: "H2", x: 700, y: 240 },
        { kind: "RES", id: "R0", x: 690, y: 420, ohms: 470 }, { kind: "LED", id: "L0", x: 780, y: 440 },
      ],
      wires: [W("GEN", "T0"), W("T0b", "T1"), W("T1b", "H0"), W("H0b", "GND"),
        W("GEN", "T2"), W("GEN", "T3"), W("T2b", "H1"), W("T3b", "H1"), W("H1b", "GND"),
        W("GEN", "H2"), W("H2b", "GND"), W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { off: ["T0"] },
      { off: ["T1"] },
      { off: ["T2", "T3"] },            // an OR gate only goes dark when BOTH are off
      { remove: [["T0b", "T1"]] },
      { remove: [["H2b", "GND"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
    ],
  },
  storm: {
    title: "Thunder on the Coast",
    taunts: ["Thunder and lightning — and darkness!", "I tangled your transformers in the storm!", "Not even your battery can beat me!"],
    board: {
      counters: { H: 3, X: 2, B: 1, T: 1 },
      parts: [
        { kind: "HOUSE", id: "H0", x: 330, y: 240 },
        { kind: "XFMR", id: "X0", x: 470, y: 250, ratio: 1 }, { kind: "HOUSE", id: "H1", x: 600, y: 240 },
        { kind: "XFMR", id: "X1", x: 470, y: 450, ratio: 0.5 }, { kind: "HOUSE", id: "H2", x: 620, y: 450 },
        { kind: "BAT", id: "B0", x: 750, y: 300, Vprev: 12 }, { kind: "TRANS", id: "T0", x: 330, y: 470, on: true },
      ],
      wires: [W("GEN", "H0"), W("H0b", "GND"), W("GEN", "T0"), W("T0b", "X0P"), W("X0", "H1"), W("H1b", "GND"), W("GEN", "X1P"),
        W("GEN", "B0"), W("B0b", "GND"), W("B0", "H2"), W("H2b", "GND")],
    },
    // No shortcut breaks here: they would drain the battery on the GEN dot.
    breaks: [
      { remove: [["X0", "H1"]], add: [["X1", "H1"]] }, // H1 moved to the step-DOWN transformer
      { remove: [["GEN", "H0"]] },
      { remove: [["B0", "H2"]] },
      { off: ["T0"] },
      { remove: [["H1b", "GND"]] },
      { remove: [["T0b", "X0P"]] },
    ],
  },
  moon: {
    title: "Lunar Blackout",
    taunts: ["In space, no one can see your lights!", "I'm the final boss, engineer — the very last one!", "Houston, YOU have a problem!"],
    board: {
      counters: { H: 3, R: 1, L: 1, T: 1, S: 1, X: 1 },
      parts: [
        { kind: "TRANS", id: "T0", x: 300, y: 250, on: true }, { kind: "HOUSE", id: "H0", x: 430, y: 240 },
        { kind: "SOLAR", id: "S0", x: 570, y: 260 }, { kind: "HOUSE", id: "H1", x: 720, y: 240 },
        { kind: "XFMR", id: "X0", x: 330, y: 450, ratio: 1 }, { kind: "HOUSE", id: "H2", x: 470, y: 450 },
        { kind: "RES", id: "R0", x: 600, y: 420, ohms: 470 }, { kind: "LED", id: "L0", x: 720, y: 440 },
      ],
      wires: [W("GEN", "T0"), W("T0b", "H0"), W("H0b", "GND"), W("S0", "H1"), W("H1b", "S0b"),
        W("GEN", "X0P"), W("X0", "H2"), W("H2b", "GND"), W("GEN", "R0"), W("R0b", "L0"), W("L0b", "GND")],
    },
    breaks: [
      { off: ["T0"] },
      { remove: [["H1b", "S0b"]] },
      { remove: [["GEN", "X0P"]] },
      { remove: [["R0b", "L0"], ["L0b", "GND"]], add: [["R0b", "L0b"], ["L0", "GND"]] },
      { add: [["GEN", "GND"]] },
      { add: [["S0", "S0b"]] },
    ],
  },
};

// Is the blackout fixed? Every building and LED on the board is bright.
function bossFixed(state) {
  let any = false;
  for (const n of state.nodes.values()) {
    if (n.type !== "HOUSE" && n.type !== "LED") continue;
    any = true;
    if (state.powered?.get(n.id)?.level !== "ON") return false;
  }
  return any;
}

// Pick `n` breaks at random. Pass a seeded rng for repeatable fights.
function pickBreaks(boss, n, rng = Math.random) {
  const idx = boss.breaks.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, Math.min(n, idx.length)).sort((a, b) => a - b).map(i => boss.breaks[i]);
}

// A copy of the solved board with the breaks applied.
function applyBreaks(board, breaks) {
  const b = JSON.parse(JSON.stringify(board));
  const same = (w, [a, c]) => (w.a === a && w.b === c) || (w.a === c && w.b === a);
  for (const br of breaks) {
    for (const r of br.remove || []) b.wires = b.wires.filter(w => !same(w, r));
    for (const [a, c] of br.add || []) if (!b.wires.some(w => same(w, [a, c]))) b.wires.push({ a, b: c });
    for (const id of br.off || []) { const p = b.parts.find(x => x.id === id); if (p) p.on = false; }
  }
  return b;
}

// The steps that undo `breaks` (used by tests and for hints):
// ["wire", a, b] / ["unwire", a, b] / ["flip", id]
function fixSteps(breaks) {
  const steps = [];
  for (const br of breaks) {
    for (const [a, b] of br.add || []) steps.push(["unwire", a, b]);
    for (const [a, b] of br.remove || []) steps.push(["wire", a, b]);
    for (const id of br.off || []) steps.push(["flip", id]);
  }
  return steps;
}

// Which breaks are still not fixed? `wires` are {a, b}; isOff(id) says
// whether a switch is open.
function breaksLeft(breaks, wires, isOff) {
  const has = ([a, b]) => wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  return breaks.filter(br => (br.remove || []).some(r => !has(r)) || (br.add || []).some(r => has(r)) || (br.off || []).some(id => isOff(id)));
}

// A hint for the first thing still broken.
function bossHint(breaks) {
  const br = breaks[0];
  if (!br) return "Look for a building that's still dark and tap it.";
  if (br.off?.length) return `Captain Short Circuit flipped switch ${br.off[0]} OFF. Tap it to turn it back on!`;
  if (br.add?.some(([a, b]) => (a === "GEN" && b === "GND") || (a === "GND" && b === "GEN"))) return "There's a shortcut wire straight from GEN to GND! Use DELETE on it.";
  if (br.add?.length && br.remove?.length) return "Something's wired the wrong way round or to the wrong part. Tap a dark light to see why.";
  if (br.add?.length) return `A sneaky shortcut wire joins ${br.add[0][0]} and ${br.add[0][1]}. DELETE it!`;
  return `A wire between ${br.remove[0][0]} and ${br.remove[0][1]} was cut. Wire it back up!`;
}

// Rewards for a win: full pay the first time you beat a difficulty, a quarter
// after that so replays can't be farmed.
function bossReward(profile, region, difficulty, zaps) {
  const d = DIFFICULTIES[difficulty];
  const first = !profile.bossWins?.[region]?.[difficulty];
  const share = first ? 1 : 0.25;
  const coins = Math.round(d.coins * share) + Math.min(zaps, MAX_ZAPS) * ZAP_COINS;
  const xp = Math.round(d.xp * share);
  (profile.bossWins[region] = profile.bossWins[region] || {})[difficulty] = true;
  return { coins, xp, first };
}

// --- Sticker book ---

const STICKERS = {
  first_light:   { name: "First Light", how: "Light a building", icon: "house", color: "4" },
  led_saver:     { name: "LED Saver", how: "Make an LED shine", icon: "led_on", color: "2" },
  sharp_guesser: { name: "Sharp Guesser", how: "3 right guesses", icon: "sparky", color: "B" },
  night_owl:     { name: "Night Owl", how: "Lit up at night", icon: "moon", color: "8" },
  storm_chaser:  { name: "Storm Chaser", how: "Fix a storm", icon: "wx_storm", color: "E" },
  sun_catcher:   { name: "Sun Catcher", how: "Use sunshine power", icon: "solar", color: "3" },
  puzzle_pro:    { name: "Puzzle Pro", how: "Solve a daily puzzle", icon: "star", color: "5" },
  order_up:      { name: "Order Up!", how: "Finish 10 orders", icon: "coin", color: "g" },
  town_builder:  { name: "Town Builder", how: "Buy a building", icon: "bld_bakery", color: "b" },
  dressed_up:    { name: "Dressed Up", how: "Buy some clothes", icon: "fit_hat_cap", color: "p" },
  explorer:      { name: "Explorer", how: "Visit a new region", icon: "map_pin", color: "6" },
  breaker_fixer: { name: "Breaker Fixer", how: "Beat the Captain", icon: "captain", color: "9" },
  extreme_hero:  { name: "Extreme Hero", how: "Win on Extreme", icon: "zap", color: "1" },
  three_stars:   { name: "Three Stars", how: "★★★ on a level", icon: "star_big", color: "4" },
  star_student:  { name: "Star Student", how: "10 level stars", icon: "star_big", color: "A" },
  power_tycoon:  { name: "Power Tycoon", how: "Buy a power plant", icon: "plant_coal", color: "3" },
  line_worker:   { name: "Line Worker", how: "Build a power line", icon: "pylon", color: "5" },
  hero:          { name: "Hero of the Hour", how: "Fix an emergency", icon: "alarm", color: "2" },
  growing_town:  { name: "Growing Town", how: "50 people in a town", icon: "people", color: "6" },
  world_tour:    { name: "World Tour", how: "Visit 6 worlds", icon: "map_pin", color: "B" },
  moonwalker:    { name: "Moonwalker", how: "Reach Moon Base", icon: "scn_rocket", color: "8" },
  expert:        { name: "Expert Engineer", how: "Beat an Expert level", icon: "ico_trophy", color: "2" },
  speedy:        { name: "Speedy Sparks", how: "Set a time trial record", icon: "ico_clock", color: "A" },
  no_undo:       { name: "Steady Hands", how: "5 no-undo wins", icon: "switch_on", color: "1" },
  puzzle_maker:  { name: "Puzzle Maker", how: "Share your own puzzle", icon: "ico_tools", color: "5" },
};
const STICKER_COINS = 10;

// Give a sticker (only once) plus a few coins. Returns true if it's new.
function awardSticker(profile, id, now) {
  if (!STICKERS[id] || profile.stickers[id]) return false;
  profile.stickers[id] = dayKey(now);
  profile.coins += STICKER_COINS;
  return true;
}

// --- Sidekick ---
// A dog or Sparky the robot, with colours, hats and extras.

const PET_ITEMS = {
  dog_brown:     { slot: "dogcolor", name: "Brown pup", price: 0, level: 1 },
  dog_golden:    { slot: "dogcolor", name: "Golden pup", price: 20, level: 1 },
  dog_black:     { slot: "dogcolor", name: "Black pup", price: 30, level: 1 },
  dog_spotty:    { slot: "dogcolor", name: "Spotty pup", price: 40, level: 2 },
  robot_silver:  { slot: "robotcolor", name: "Silver Sparky", price: 0, level: 1 },
  robot_red:     { slot: "robotcolor", name: "Red Sparky", price: 30, level: 1 },
  robot_green:   { slot: "robotcolor", name: "Green Sparky", price: 40, level: 2 },
  robot_gold:    { slot: "robotcolor", name: "Gold Sparky", price: 80, level: 4 },
  phat_cap:      { slot: "pethat", name: "Tiny cap", price: 15, level: 1 },
  phat_party:    { slot: "pethat", name: "Party hat", price: 20, level: 1 },
  phat_wizard:   { slot: "pethat", name: "Wizard hat", price: 90, level: 4 },
  phat_crown:    { slot: "pethat", name: "Tiny crown", price: 120, level: 5 },
  pacc_bandana:  { slot: "petacc", name: "Bandana", price: 15, level: 1 },
  pacc_bowtie:   { slot: "petacc", name: "Bow tie", price: 20, level: 1 },
  pacc_goggles:  { slot: "petacc", name: "Goggles", price: 40, level: 3 },
  pacc_cape:     { slot: "petacc", name: "Hero cape", price: 70, level: 4 },
};
const PET_TYPES = { dog: "Dog", robot: "Sparky" };

// Put on (or select) an owned item. Colours only fit their own type.
function equipPetItem(profile, key) {
  const it = PET_ITEMS[key];
  if (!it || !profile.owned.pet.includes(key)) return false;
  if (it.slot === "dogcolor") { profile.sidekick.type = "dog"; profile.sidekick.color = key; }
  else if (it.slot === "robotcolor") { profile.sidekick.type = "robot"; profile.sidekick.color = key; }
  else if (it.slot === "pethat") profile.sidekick.hat = key;
  else profile.sidekick.acc = key;
  return true;
}
// Tap an owned item: a colour gets selected; a hat or extra goes on, or comes
// off if already worn.
function togglePetItem(profile, key) {
  const it = PET_ITEMS[key];
  if (!it || !profile.owned.pet.includes(key)) return false;
  if (it.slot === "pethat" && profile.sidekick.hat === key) { profile.sidekick.hat = null; return true; }
  if (it.slot === "petacc" && profile.sidekick.acc === key) { profile.sidekick.acc = null; return true; }
  return equipPetItem(profile, key);
}
// Switch between the dog and Sparky. Resets to the default colour if the
// current one belongs to the other type.
function setSidekickType(profile, type) {
  if (!PET_TYPES[type]) return false;
  profile.sidekick.type = type;
  const slot = type === "dog" ? "dogcolor" : "robotcolor";
  if (PET_ITEMS[profile.sidekick.color]?.slot !== slot) profile.sidekick.color = type === "dog" ? "dog_brown" : "robot_silver";
  return true;
}

// --- Progress ---

// The next Captain to beat on the way to the next world, and whether you can
// fight him now. null once all are beaten.
function nextCaptain(profile) {
  for (const key of REGION_KEYS) {
    if (bossBeaten(profile, key)) continue;
    const bossInfo = bossStatus(profile, key);
    const next = REGION_KEYS.find(k => REGIONS[k].needsBoss === key);
    return { key, ready: bossInfo.ok, why: bossInfo.why, unlocks: next || null };
  }
  return null;
}
