// tests/world.test.mjs
//
// Tests for src/rules/world.js: world map regions (unlocking, travel,
// weather), Captain Short Circuit's boss fights (every board and difficulty,
// plus many random break combos that must start broken and be fixable), boss
// rewards, the sticker book, the sidekick wardrobe and loading old saves.
//
// Run: node tests/world.test.mjs  (or open tests/run-in-browser.html)
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  for (const f of ["../src/art/pixelart.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/missions.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/daily.js", "../src/audio/music.js"]) {
    const path = resolve(dirname(process.argv[1]), f);
    runInThisContext(readFileSync(path, "utf8"), { filename: path });
  }
}

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log(`FAIL  - ${name}`); console.log(`        ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${m || "not equal"}: got ${A}, want ${B}`); }

// Build a solver state from a board snapshot, the way placePart() in src/scene/board.js does.
function boardState(board, extra = {}) {
  const s = {
    nodes: new Map(), wires: [], V: 12, R_WIRE: 0.03, R_GEN: 1.5, R_HOUSE: 18, V_LED_F: 2, R_LED_INTERNAL: 10,
    I_LED_GLOW: 0.003, I_LED_BRIGHT: 0.012, I_LED_MAX: 0.025, V_HOUSE_ON: 9, V_HOUSE_DIM: 7, dt: 1 / 30,
    V_SOLAR: 12, R_SOLAR: 4, solarFactor: 1, BAT_C: 20, loadScale: 1, solverError: false, ...extra,
  };
  s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} }); s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
  for (const p of board.parts) {
    if (p.kind === "XFMR") {
      s.nodes.set(p.id + "P", { id: p.id + "P", type: "XFMR_PRI", data: { pairId: p.id } });
      s.nodes.set(p.id, { id: p.id, type: "XFMR_SEC", data: { pairId: p.id + "P", ratio: p.ratio } });
      continue;
    }
    const d = { pairId: p.id + "b", kind: p.kind, role: "primary" };
    if (p.kind === "RES") d.ohms = p.ohms;
    if (p.kind === "TRANS") d.on = p.on ?? true;
    if (p.kind === "BAT") { d.C = 20; d.Vprev = p.Vprev ?? 0; }
    if (p.kind === "HOUSE") { const b = p.building && BUILDINGS[p.building] ? p.building : "house"; Object.assign(d, { building: b, R: BUILDINGS[b].R, vOn: BUILDINGS[b].vOn, vDim: BUILDINGS[b].vDim }); }
    s.nodes.set(p.id, { id: p.id, type: p.kind, data: d });
    s.nodes.set(p.id + "b", { id: p.id + "b", type: p.kind + "_B", data: { pairId: p.id } });
  }
  s.wires = board.wires.map(w => ({ a: w.a, b: w.b }));
  return s;
}
const solve = (s, seconds = 0) => { computePower(s, 0); for (let i = 0; i < seconds * 30; i++) computePower(s, 1 / 30); return s; };
const atLevel = (lvl) => { const p = createProfile(); p.xp = XP_FOR_LEVEL[lvl - 1]; return p; };

console.log("Regions");
test("twelve regions, in map order; the first four each bring their own parts", () => {
  eq(REGION_KEYS, ["sparkville", "batterybay", "solardesert", "mountains", "windmill", "waterfall", "neon", "tundra", "volcano", "robot", "storm", "moon"]);
  eq(REGION_KEYS.slice(0, 4).map(k => REGIONS[k].parts), [["HOUSE", "RES", "LED", "TRANS"], ["CAP", "BAT"], ["SOLAR"], ["XFMR"]]);
  for (const k of REGION_KEYS.slice(0, 4)) for (const part of REGIONS[k].parts) assert(PARTS[part].level >= REGIONS[k].level && PARTS[part].level <= REGIONS[k].bossLevel, `${part} unlocks while you're in ${k}`);
  for (const k of REGION_KEYS) { const r = REGIONS[k]; assert(r.story && r.learn && r.characters.length >= 2 && r.residents.length >= 3 && r.bossLevel > r.level, k); }
  // Every region's parts are unlocked by the time you can reach it.
  for (const k of REGION_KEYS.slice(4)) for (const part of REGIONS[k].parts) assert(PARTS[part].level <= REGIONS[k].level, `${part} usable in ${k}`);
  // A new world every two levels, each needing the boss before it; all reachable by the top level.
  REGION_KEYS.forEach((k, i) => { if (i) { eq(REGIONS[k].needsBoss, REGION_KEYS[i - 1], k); assert(REGIONS[k].level > REGIONS[REGION_KEYS[i - 1]].level, k); } assert(REGIONS[k].bossLevel <= MAX_LEVEL, k); });
  // Each has its own ground, starter town and boss.
  for (const k of REGION_KEYS) { assert(REGIONS[k].ground, k); assert(k === "sparkville" || REGION_STARTERS[k], k + " starter"); assert(BOSSES[k], k + " boss"); }
});
test("a region opens at its level AND after beating the boss before it", () => {
  const p = atLevel(10);
  assert(regionStatus(p, "sparkville").ok, "Sparkville always");
  assert(/Beat Captain Short Circuit in Sparkville/.test(regionStatus(p, "batterybay").why), regionStatus(p, "batterybay").why);
  p.bossWins.sparkville = { easy: true };
  assert(regionStatus(p, "batterybay").ok, "open after the boss");
  assert(!regionStatus(p, "solardesert").ok, "the next one still needs its boss");
  const low = atLevel(3); low.bossWins.sparkville = { hard: true };
  assert(/level 4/.test(regionStatus(low, "batterybay").why), "and a level");
  assert(!regionStatus(p, "atlantis").ok, "unknown region");
});
test("the boss shows up at the region's boss level", () => {
  assert(/level 3/.test(bossStatus(atLevel(2), "sparkville").why));
  assert(bossStatus(atLevel(3), "sparkville").ok);
  const p = atLevel(10); assert(!bossStatus(p, "batterybay").ok, "region still locked");
});
test("travelling: region set, visit remembered, old orders and storm damage left behind", () => {
  const p = atLevel(5); p.bossWins.sparkville = { easy: true };
  p.orders = [{ kind: "light", target: "H1", coins: 1, xp: 1, id: 1, text: "x" }, null, null]; p.repair = { a: "GEN", b: "H0", coins: 25, xp: 15 };
  const r = travelTo(p, "batterybay", 1000);
  assert(r.ok && r.first, "first visit");
  eq([p.region, p.visited, p.orders, p.repair, p.refillAt], ["batterybay", ["sparkville", "batterybay"], [null, null, null], null, [3000, 3000, 3000]]);
  assert(travelTo(p, "sparkville", 5000).ok && !travelTo(p, "batterybay", 6000).first, "second visit isn't new");
  assert(!travelTo(p, "solardesert", 7000).ok && p.region === "batterybay", "locked: nothing changes");
});
test("Solar Desert weather: clouds turn to sun, storms to heat", () => {
  eq(regionWeather({ key: "cloudy", ...WEATHER.cloudy }, "solardesert").key, "sunny");
  eq(regionWeather({ key: "storm", ...WEATHER.storm }, "solardesert").key, "heat");
  eq(regionWeather({ key: "storm", ...WEATHER.storm }, "batterybay").key, "storm");
});
test("each region's starter town is a valid board with a lit house", () => {
  for (const k of REGION_KEYS) {
    const b = REGION_STARTERS[k] || STARTER_TOWN;
    const s = solve(boardState(b));
    eq(s.powered.get("H0").level, "ON", k);
  }
});
test("orders use the region's own people", () => {
  const p = atLevel(1); p.region = "solardesert";
  const s = solve(boardState({ counters: {}, parts: [{ kind: "HOUSE", id: "H0", x: 0, y: 0 }, { kind: "HOUSE", id: "H1", x: 0, y: 0 }], wires: [] }));
  const rng = seededRandom(3);
  for (let i = 0; i < 40; i++) { const o = generateOrder(p, s, rng); if (o.who) assert(REGIONS.solardesert.residents.includes(o.who), o.who); }
});
test("reaching a region's level lists it (and its boss) in the level-up party", () => {
  assert(unlocksAtLevel(4).includes("Battery Bay on the map"), JSON.stringify(unlocksAtLevel(4)));
  assert(unlocksAtLevel(3).includes("the Sparkville boss"));
  assert(unlocksAtLevel(8).includes("Transformer") && unlocksAtLevel(8).includes("Transformer Mountains on the map"));
});

console.log("Blackout bosses");
test("every boss board is fully lit when solved — and still lit after 3 minutes", () => {
  for (const k of REGION_KEYS) {
    assert(bossFixed(solve(boardState(BOSSES[k].board))), k + " solved");
    assert(bossFixed(solve(boardState(BOSSES[k].board), 180)), k + " after 180 s");
  }
});
test("every single break really breaks the circuit", () => {
  for (const k of REGION_KEYS) BOSSES[k].breaks.forEach((br, i) => assert(!bossFixed(solve(boardState(applyBreaks(BOSSES[k].board, [br])))), `${k} break ${i}`));
});
test("every difficulty: 300 random fights each start broken and the fix steps light everything", () => {
  for (const k of REGION_KEYS) for (const d of DIFFICULTY_KEYS) {
    for (let seed = 1; seed <= 300; seed++) {
      const brs = pickBreaks(BOSSES[k], DIFFICULTIES[d].breaks, seededRandom(seed * 31 + d.length));
      eq(brs.length, DIFFICULTIES[d].breaks, "break count");
      const broken = applyBreaks(BOSSES[k].board, brs);
      assert(!bossFixed(solve(boardState(broken))), `${k} ${d} ${seed} starts broken`);
      for (const [op, a, b] of fixSteps(brs)) {
        if (op === "wire") broken.wires.push({ a, b });
        else if (op === "unwire") broken.wires = broken.wires.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
        else broken.parts.find(p => p.id === a).on = true;
      }
      assert(bossFixed(solve(boardState(broken))), `${k} ${d} ${seed} fixable`);
    }
  }
});
test("harder means more breaks and less time; Extreme has no hints", () => {
  const d = DIFFICULTY_KEYS.map(k => DIFFICULTIES[k]);
  for (let i = 1; i < d.length; i++) assert(d[i].breaks > d[i - 1].breaks && d[i].seconds < d[i - 1].seconds && d[i].coins > d[i - 1].coins);
  eq(d.map(x => x.hints), [true, true, true, false]);
  for (const k of REGION_KEYS) assert(BOSSES[k].breaks.length >= DIFFICULTIES.extreme.breaks, k);
});
test("music: a song for the title and every world, all in tune and in time", () => {
  eq(SONG_KEYS.slice().sort(), ["title", ...REGION_KEYS].sort());
  for (const k of SONG_KEYS) {
    const song = SONGS[k], parsed = songNotes(song);
    eq(parsed.steps, 64, k + ": 8 bars of eighth notes");
    assert(parsed.notes.length >= 15, k + " has a tune");
    for (const n of parsed.notes) assert(n.midi >= 45 && n.midi <= 96 && n.len >= 1, `${k}: note ${n.midi}`);
    eq(song.chords.trim().split(/\s+/).length, 8, k + ": a chord per bar");
    assert(MUSIC_SCALES[song.scale] && song.bpm >= 70 && song.bpm <= 160, k);
    assert(/^[ksh.]+$/.test(song.drums.replace(/\s+/g, "")), k + " drums");
  }
});
test("EVERY combination of breaks, for every boss: starts broken, no LED ever pops, and fixing in any order works", () => {
  const apply = (t, [op, a, b]) => {
    if (op === "wire") t.wires.push({ a, b });
    else if (op === "unwire") t.wires = t.wires.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
    else t.nodes.get(a).data.on = !t.nodes.get(a).data.on;
  };
  const popped = (t) => [...t.nodes.values()].some(x => x.type === "LED" && x.data.burned);
  for (const k of REGION_KEYS) {
    const B = BOSSES[k], n = B.breaks.length;
    assert(n >= 5, k + " has enough breaks for Extreme");
    for (let m = 1; m < (1 << n); m++) {
      const brs = B.breaks.filter((_, i) => m & (1 << i));
      const s = solve(boardState(applyBreaks(B.board, brs)));
      assert(!popped(s), `${k} ${m}: no pop when broken`);
      assert(!bossFixed(s), `${k} ${m}: starts broken`);
      for (const order of [fixSteps(brs), fixSteps(brs).reverse()]) {
        const t = boardState(applyBreaks(B.board, brs));
        for (const st of order) { apply(t, st); computePower(t, 0); assert(!popped(t), `${k} ${m}: no pop while fixing`); }
        assert(bossFixed(t), `${k} ${m}: fixed`);
      }
    }
  }
});
test("a break left for a while doesn't spoil the fix (no battery drained by a shortcut, nothing popped)", () => {
  const apply = (t, [op, a, b]) => {
    if (op === "wire") t.wires.push({ a, b });
    else if (op === "unwire") t.wires = t.wires.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
    else t.nodes.get(a).data.on = !t.nodes.get(a).data.on;
  };
  for (const k of REGION_KEYS) {
    const B = BOSSES[k];
    for (const brs of [...B.breaks.map(b => [b]), B.breaks]) {
      const t = boardState(applyBreaks(B.board, brs));
      computePower(t, 0);
      for (let i = 0; i < 300; i++) computePower(t, 0.1);      // 30 seconds broken
      for (const st of fixSteps(brs)) apply(t, st);
      computePower(t, 0); for (let i = 0; i < 10; i++) computePower(t, 0.1);
      assert(bossFixed(t), `${k}: fixed right away after ${brs.length} break(s) left for 30 s`);
    }
  }
});
test("applyBreaks never changes the boss's own board", () => {
  const before = JSON.stringify(BOSSES.sparkville.board);
  applyBreaks(BOSSES.sparkville.board, BOSSES.sparkville.breaks);
  eq(JSON.stringify(BOSSES.sparkville.board), before);
});
test("hints name the right fix", () => {
  assert(/switch T0 OFF/.test(bossHint([{ off: ["T0"] }])));
  assert(/GEN to GND/.test(bossHint([{ add: [["GEN", "GND"]] }])));
  assert(/H1b and GND was cut/.test(bossHint([{ remove: [["H1b", "GND"]] }])));
  assert(/wrong way round/.test(bossHint([{ remove: [["R0b", "L0"]], add: [["R0b", "L0b"]] }])));
});
test("breaksLeft tracks what's still broken as the kid fixes things", () => {
  const boss = BOSSES.sparkville, brs = [boss.breaks[0], boss.breaks[2], boss.breaks[4]]; // cut GEN-H0, T0 off, GEN-GND short
  const b = applyBreaks(boss.board, brs);
  const off = new Set(["T0"]);
  eq(breaksLeft(brs, b.wires, id => off.has(id)).length, 3);
  b.wires.push({ a: "H0", b: "GEN" }); eq(breaksLeft(brs, b.wires, id => off.has(id)).length, 2, "rewired (either direction)");
  off.delete("T0"); eq(breaksLeft(brs, b.wires, id => off.has(id)), [brs[2]], "switch flipped");
  b.wires = b.wires.filter(w => !(w.a === "GEN" && w.b === "GND")); eq(breaksLeft(brs, b.wires, id => off.has(id)), [], "short deleted");
});
test("rewards: full the first time per difficulty, a quarter after; zaps add coins (max 5)", () => {
  const p = createProfile();
  eq(bossReward(p, "sparkville", "easy", 2), { coins: 40 + 10, xp: 30, first: true });
  eq(bossReward(p, "sparkville", "easy", 9), { coins: 10 + 25, xp: 8, first: false });
  eq(bossReward(p, "sparkville", "extreme", 0), { coins: 160, xp: 90, first: true });
  eq(p.bossWins.sparkville, { easy: true, extreme: true });
  assert(bossBeaten(p, "sparkville") && !bossBeaten(p, "batterybay"));
});

test("a bought building counts in every region's town (no placing one bakery twice)", () => {
  const p = atLevel(10); p.owned.buildings.bakery = 1;
  p.towns.sparkville = { counters: {}, parts: [{ kind: "HOUSE", id: "H3", x: 0, y: 0, building: "bakery" }], wires: [] };
  p.region = "batterybay";
  const here = boardState({ counters: {}, parts: [], wires: [] }); here.context = "town";
  eq(buildingsAvailable(p, "bakery", here), 0, "placed in Sparkville");
  p.region = "sparkville";
  const spark = boardState(p.towns.sparkville); spark.nodes.get("H3").data.building = "bakery"; spark.context = "town";
  eq(buildingsAvailable(p, "bakery", spark), 0, "on the board here (saved copy not counted twice)");
  delete p.towns.sparkville; spark.nodes.delete("H3"); spark.nodes.delete("H3b");
  eq(buildingsAvailable(p, "bakery", spark), 1, "deleted: back in the box");
});

console.log("Sticker book");
test("25 stickers, each with a name, how-to and icon; awarded once, +10 coins", () => {
  eq(Object.keys(STICKERS).length, 25);
  for (const s of Object.values(STICKERS)) assert(s.name && s.how && s.icon && PAL[s.color], s.name);
  const p = createProfile(), now = new Date(2026, 9, 5);
  assert(awardSticker(p, "first_light", now) && p.coins === 60 && p.stickers.first_light === "2026-10-05");
  assert(!awardSticker(p, "first_light", now) && p.coins === 60, "only once");
  assert(!awardSticker(p, "made_up", now), "unknown id");
});

console.log("Sidekick");
test("you start with a brown pup (and silver Sparky) for free", () => {
  const p = createProfile();
  eq(p.sidekick, { type: "dog", color: "dog_brown", hat: null, acc: null });
  assert(p.owned.pet.includes("dog_brown") && p.owned.pet.includes("robot_silver"));
});
test("switch between the dog and Sparky", () => {
  const p = createProfile();
  assert(setSidekickType(p, "robot")); eq([p.sidekick.type, p.sidekick.color], ["robot", "robot_silver"]);
  assert(setSidekickType(p, "dog")); eq([p.sidekick.type, p.sidekick.color], ["dog", "dog_brown"]);
  assert(!setSidekickType(p, "cat"));
});
test("buying sidekick things: costs coins, level locks, puts it on; colours switch type", () => {
  const p = createProfile(); p.coins = 500;
  assert(buy(p, "pet", "phat_party").ok && p.sidekick.hat === "phat_party" && p.coins === 480);
  assert(/already/.test(buy(p, "pet", "phat_party").why));
  assert(/level 5/.test(buy(p, "pet", "phat_crown").why), "locked");
  assert(buy(p, "pet", "robot_red").ok); eq([p.sidekick.type, p.sidekick.color, p.sidekick.hat], ["robot", "robot_red", "phat_party"], "hat stays on");
  p.coins = 5; assert(/more coins/.test(buy(p, "pet", "pacc_bandana").why));
});
test("tap an owned hat or extra to take it off, again to put it on; colours just select", () => {
  const p = createProfile(); p.coins = 100; buy(p, "pet", "pacc_bowtie");
  togglePetItem(p, "pacc_bowtie"); eq(p.sidekick.acc, null);
  togglePetItem(p, "pacc_bowtie"); eq(p.sidekick.acc, "pacc_bowtie");
  togglePetItem(p, "dog_brown"); eq(p.sidekick.color, "dog_brown");
  assert(!togglePetItem(p, "dog_golden"), "not owned");
});
test("the new engineer clothes are in the shop", () => {
  for (const k of ["shirt_bolt", "pants_red", "acc_scarf", "acc_headphones", "hat_propeller", "shirt_hoodie"]) assert(OUTFITS[k] && OUTFIT_SLOTS.includes(OUTFITS[k].slot), k);
  eq(Object.keys(OUTFITS).length, 38);
  for (const k of ["hat_straw", "acc_shades", "shirt_parka", "hat_helmet"]) assert(OUTFITS[k] && OUTFITS[k].level > 6, k + " is a later reward");
});

console.log("Saving");
test("old saves (one town) move into Sparkville; new fields get sensible defaults", () => {
  const town = { counters: { H: 1 }, parts: [{ kind: "HOUSE", id: "H0", x: 1, y: 2 }], wires: [] };
  const p = normalizeProfile({ coins: 10, town });
  eq([p.towns.sparkville, p.region, p.visited, p.bossWins, p.stickers, p.seenIntro], [town, "sparkville", ["sparkville"], {}, {}, false]);
});
test("junk in the new fields is cleaned up", () => {
  const p = normalizeProfile({
    region: "narnia", towns: { sparkville: { parts: "no" }, mountains: { counters: {}, parts: [], wires: [] }, mars: { counters: {}, parts: [], wires: [] } },
    visited: ["sparkville", "mars", "batterybay"], bossWins: { sparkville: { easy: true, silly: true, hard: "yes" }, mars: { easy: true } },
    stickers: { first_light: "2026-10-05", fake: "2026-10-05", led_saver: 7 }, zaps: -3,
    owned: { pet: ["dog_golden", "unicorn"] }, sidekick: { type: "robot", color: "dog_golden", hat: "phat_crown", acc: "nope" }, seenIntro: "true",
  });
  eq(p.region, "sparkville"); eq(Object.keys(p.towns), ["mountains"]); eq(p.visited, ["sparkville", "batterybay"]);
  eq(p.bossWins, { sparkville: { easy: true } }); eq(p.stickers, { first_light: "2026-10-05" }); eq(p.zaps, 0);
  eq(p.owned.pet, ["dog_brown", "robot_silver", "dog_golden"]);
  eq(p.sidekick, { type: "robot", color: "robot_silver", hat: null, acc: null }, "a dog colour can't go on Sparky; unowned hat dropped");
  eq(p.seenIntro, false);
});
test("a full round trip through JSON keeps everything", () => {
  const p = atLevel(6); p.bossWins.sparkville = { easy: true }; travelTo(p, "batterybay", 0);
  p.coins = 300; buy(p, "pet", "dog_spotty"); buy(p, "pet", "phat_cap"); awardSticker(p, "explorer", new Date(2026, 9, 5)); p.seenIntro = true; p.zaps = 4;
  p.towns.batterybay = { counters: { H: 1 }, parts: [{ kind: "HOUSE", id: "H0", x: 400, y: 300 }], wires: [{ a: "GEN", b: "H0" }] };
  eq(normalizeProfile(JSON.parse(JSON.stringify(p))), p);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "world", pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) });
})();
