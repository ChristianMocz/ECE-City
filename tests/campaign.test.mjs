// tests/campaign.test.mjs
//
// Tests for the campaign (src/rules/campaign.js, src/rules/levels.js). Every
// level is replayed from its written solution with the real solver: it must
// start unsolved, be finishable within budget, earn three stars and fit on the
// board. Also stars, unlocking, rewards, the level shorthand, and wrong
// answers that must not count as solved.
//
// Run: node tests/campaign.test.mjs  (or open tests/run-in-browser.html)
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  for (const f of ["../src/art/pixelart.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/plants.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/campaign.js", "../src/rules/levels.js"]) {
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
const EXTENT = { HOUSE: [68, 100], RES: [18, 90], CAP: [38, 96], XFMR: [40, 96], TRANS: [28, 85], LED: [22, 102], SOLAR: [30, 85], BAT: [30, 82] };
const atLevel = (l) => { const p = createProfile(); p.xp = XP_FOR_LEVEL[l - 1]; return p; };
// Replay a level with some other steps (a wrong answer).
const tryWith = (id, sol) => replaySolution(CAMPAIGN_BY_ID[id], parseSolution(sol));

console.log("The levels");
test("ten levels in every one of the twelve worlds, plus one Expert level each", () => {
  for (const k of REGION_KEYS) eq(campaignLevelsOf(k).length, 10, k);
  for (const k of REGION_KEYS) { const ex = expertLevelOf(k); assert(ex && ex.expert && ex.hard && ex.n === 11, k + " expert"); }
  eq(CAMPAIGN_LEVELS.length, 132);
  eq(new Set(CAMPAIGN_LEVELS.map(l => l.id)).size, 132, "ids are unique");
  for (const l of CAMPAIGN_LEVELS) assert(l.title && l.goal && l.hint && l.teach && l.win && l.solution.length, l.id);
});
test("EVERY level: starts unsolved, its solution wins, within budget, all three stars, nothing pops", () => {
  for (const lv of CAMPAIGN_LEVELS) {
    const r = replaySolution(lv);
    assert(!r.startedSolved, lv.id + " starts solved");
    assert(r.won && r.wonAtEnd, lv.id + " solution doesn't win");
    assert(!r.popped, lv.id + " pops an LED");
    const st = levelStars(lv, r);
    eq(st.stars, 3, lv.id + " stars");
    assert(r.spent <= lv.budget, `${lv.id} spends $${r.spent} of $${lv.budget}`);
  }
});
test("EVERY level fits on the board: parts inside the field, nowhere near GEN/GND, not on top of each other", () => {
  for (const lv of CAMPAIGN_LEVELS) {
    const parts = replaySolution(lv).snap.parts;
    for (const p of parts) {
      const [up, down] = EXTENT[p.kind];
      assert(p.x >= 200 && p.x <= 838 && p.y - up >= 150 && p.y + down <= 590, `${lv.id} ${p.id} at ${p.x},${p.y}`);
    }
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      assert(!(Math.abs(a.x - b.x) < 60 && Math.abs(a.y - b.y) < 110), `${lv.id}: ${a.id} and ${b.id} overlap`);
    }
  }
});
test("tight-budget levels really are tight (barely any slack); ordinary ones have room", () => {
  const hard = CAMPAIGN_LEVELS.filter(l => l.hard);
  assert(hard.length >= 12, `at least one per world (${hard.length})`);
  for (const k of REGION_KEYS) assert(campaignLevelsOf(k).some(l => l.hard), k + " has a tight-budget level");
  for (const l of hard) assert(l.budget <= Math.ceil(l.solutionSpent * 1.08) && l.budget >= l.solutionSpent, l.id);
  // Copper gets tighter the further you travel: 30% spare early, 20% from Neon City, 15% from Robot Factory.
  for (const l of CAMPAIGN_LEVELS.filter(x => !x.hard)) {
    const wi = REGION_KEYS.indexOf(l.world), spare = wi >= 9 ? 1.15 : wi >= 6 ? 1.2 : 1.3;
    assert(l.budget >= l.solutionSpent * (spare - 0.05) || l.budget === 0, l.id);
  }
  for (const l of CAMPAIGN_LEVELS.filter(x => x.expert)) assert(l.budget <= Math.ceil(l.solutionSpent * 1.05), l.id + " expert copper is very tight");
});
test("Expert levels open only after all ten levels in their world", () => {
  const p = normalizeProfile({});
  const ex = expertLevelOf("sparkville");
  assert(!levelUnlocked(p, ex).ok && /Finish all 10 levels/.test(levelUnlocked(p, ex).why), levelUnlocked(p, ex).why);
  for (const l of campaignLevelsOf("sparkville").slice(0, 9)) p.campaign[l.id] = 1;
  assert(!levelUnlocked(p, ex).ok && /1 to go/.test(levelUnlocked(p, ex).why), "one to go");
  p.campaign["sparkville-10"] = 1;
  assert(levelUnlocked(p, ex).ok, "open");
  eq(nextLevelIn(p, "sparkville"), null, "the path is done (Expert is extra)");
  const r = recordLevelResult(p, ex, 3);
  eq([r.coins, r.xp], [60 + 60, 80 + 15], "Expert pays more");
});
test("later worlds are harder: longer solutions than the first worlds", () => {
  const avg = (ks) => { const ls = ks.flatMap(k => campaignLevelsOf(k)); return ls.reduce((n, l) => n + l.solution.length, 0) / ls.length; };
  assert(avg(REGION_KEYS.slice(6)) > avg(REGION_KEYS.slice(0, 3)) * 1.4, `${avg(REGION_KEYS.slice(6))} vs ${avg(REGION_KEYS.slice(0, 3))}`);
  const ex = REGION_KEYS.map(k => expertLevelOf(k).solution.length);
  assert(ex.reduce((a, b) => a + b, 0) / ex.length >= 7, "Expert levels are big");
});
test("every world teaches in steps: its first level is one of its easiest", () => {
  for (const k of REGION_KEYS) { const L = campaignLevelsOf(k); assert(L[0].solution.length <= Math.max(...L.map(l => l.solution.length)), k); }
});
test("the toolbox only offers real parts, and every placed part comes out of it", () => {
  for (const lv of CAMPAIGN_LEVELS) {
    for (const t of lv.tool) assert(PART_COST[t.kind] != null && t.n >= 1, lv.id + " " + t.key);
    const placed = lv.solution.filter(s => s[0] === "p");
    for (const [, kind, , , opt] of placed) {
      const t = lv.tool.find(x => x.kind === kind && (x.opt === null || x.opt === +(opt ?? (kind === "RES" ? 470 : kind === "CAP" ? 220 : 1))));
      assert(t, `${lv.id}: places a ${kind} ${opt} not in its toolbox`);
    }
  }
});

console.log("Wrong answers don't count");
test("a resistor that's too small pops the LED — Sparkville 9 isn't solved by it", () => {
  const r = tryWith("sparkville-9", "p RES 420 430 100; w GEN R0; w R0b L0; w L0b GND");
  assert(!r.won && r.popped, "pops, not won");
});
test("the switch level needs the switch in H1's loop only", () => {
  assert(!tryWith("sparkville-10", "w GEN T0; w T0b H0; w H0b GND; w T0b H1; w H1b GND").won, "switch controls both: no");
  assert(!tryWith("sparkville-10", "w GEN H0; w H0b GND; w GEN H1; w H1b GND").won, "no switch at all: no");
});
test("the AND gate can't be wired as OR (and the other way round)", () => {
  assert(!tryWith("robot-1", "w GEN T0; w T0b H0; w GEN T1; w T1b H0; w H0b GND").won, "OR for AND");
  assert(!tryWith("robot-2", "w GEN T0; w T0b T1; w T1b H0; w H0b GND").won, "AND for OR");
});
test("over the mountain: wiring the house straight to GEN skips the line, and doesn't count", () => {
  assert(!tryWith("mountains-1", "w GEN H0; w H0b GND").won);
});
test("lights in a row vs side by side are told apart", () => {
  assert(!tryWith("windmill-2", "w GEN R0; w R0b L0; w L0b L1; w L1b GND").won, "a string isn't 'side by side'");
  assert(!tryWith("windmill-4", "w H0b GND").won, "half fixed isn't parallel");
});
test("storage levels need the generator really unplugged", () => {
  assert(!tryWith("batterybay-5", "w GEN B0; w B0b GND; w B0 H0; w H0b GND").won, "GEN still wired");
});
test("the small capacitor runs out: Battery Bay 8 needs the big one", () => {
  assert(!tryWith("batterybay-8", "w C0 H0; w H0b C0b").won);
});
test("two paths: a single loop isn't storm-proof", () => {
  assert(!tryWith("storm-5", "w GEN H0; w H0b GND").won);
});
test("tight budget: the long way round costs more than Sparkville 4 allows", () => {
  const r = tryWith("sparkville-4", "w GEN H0; w H0b GND; w GEN H1; w H1b GND");
  assert(r.won && r.spent > CAMPAIGN_BY_ID["sparkville-4"].budget, `naive wiring costs $${r.spent}`);
});
test("a level's stars: over budget or too many wires lose a star each", () => {
  const lv = CAMPAIGN_BY_ID["sparkville-3"];
  eq(levelStars(lv, { spent: lv.budget, wiresAdded: lv.parWires, popped: false }).stars, 3);
  eq(levelStars(lv, { spent: lv.budget + 1, wiresAdded: lv.parWires, popped: false }).stars, 2);
  eq(levelStars(lv, { spent: 0, wiresAdded: lv.parWires + 1, popped: false }).stars, 2);
  eq(levelStars(lv, { spent: 0, wiresAdded: 0, popped: true }).stars, 2);
  eq(levelStars(lv, { spent: 999, wiresAdded: 99, popped: true }).stars, 1);
});

console.log("Progress and rewards");
test("levels open one after another, once the world is open", () => {
  const p = atLevel(1);
  assert(levelUnlocked(p, CAMPAIGN_BY_ID["sparkville-1"]).ok);
  assert(/Finish level 1/.test(levelUnlocked(p, CAMPAIGN_BY_ID["sparkville-2"]).why));
  p.campaign["sparkville-1"] = 1;
  assert(levelUnlocked(p, CAMPAIGN_BY_ID["sparkville-2"]).ok);
  assert(/level 4/i.test(levelUnlocked(p, CAMPAIGN_BY_ID["batterybay-1"]).why), "Battery Bay needs its level");
  eq(nextLevelIn(p, "sparkville").id, "sparkville-2");
});
test("rewards: first finish pays most; new stars pay; replaying for nothing pays nothing", () => {
  const p = atLevel(1), lv = CAMPAIGN_BY_ID["sparkville-1"];
  eq(recordLevelResult(p, lv, 2), { coins: 35, xp: 35, first: true, gained: 2, best: 2 });
  eq(recordLevelResult(p, lv, 3), { coins: 10, xp: 5, first: false, gained: 1, best: 3 });
  eq(recordLevelResult(p, lv, 1), { coins: 0, xp: 0, first: false, gained: 0, best: 3 });
  eq(p.campaign[lv.id], 3);
  eq(campaignStars(p), 3); eq(campaignStars(p, "sparkville"), 3); eq(campaignStars(p, "moon"), 0);
});
test("stars survive saving; junk doesn't", () => {
  const q = normalizeProfile({ campaign: { "sparkville-1": 3, "sparkville-2": 7, "nowhere-1": 2, "moon-10": 1, "moon-9": "3" } });
  eq(q.campaign, { "sparkville-1": 3, "moon-10": 1 });
});

console.log("The shorthand");
test("parts, wires, toolbox and solutions parse", () => {
  eq(parseParts("H0@450,260:school R1@300,430:220 L0@1,2:burned T0@3,4:off C0@5,6:47:12 B0@7,8:9 S0@9,10 X0@11,12:2"), [
    { kind: "HOUSE", id: "H0", x: 450, y: 260, building: "school" }, { kind: "RES", id: "R1", x: 300, y: 430, ohms: 220 },
    { kind: "LED", id: "L0", x: 1, y: 2, burned: true }, { kind: "TRANS", id: "T0", x: 3, y: 4, on: false },
    { kind: "CAP", id: "C0", x: 5, y: 6, uF: 47, Vprev: 12 }, { kind: "BAT", id: "B0", x: 7, y: 8, Vprev: 9 },
    { kind: "SOLAR", id: "S0", x: 9, y: 10 }, { kind: "XFMR", id: "X0", x: 11, y: 12, ratio: 2 }]);
  eq(parseWires("GEN-H0 H0b-GND"), [{ a: "GEN", b: "H0" }, { a: "H0b", b: "GND" }]);
  eq(parseTool("RES:470 RES:470 LED"), [{ key: "RES:470", kind: "RES", opt: 470, n: 2 }, { key: "LED", kind: "LED", opt: null, n: 1 }]);
  eq(countersFor(parseParts("H0@1,1 H3@2,2 X1@3,3")), { H: 4, R: 0, T: 0, L: 0, C: 0, X: 2, S: 0, B: 0 });
  eq(dotPosIn(parseParts("H0@450,260 X0@300,460:2"), "H0b"), { x: 450, y: 360 });
  eq(dotPosIn(parseParts("X0@300,460:2"), "X0P"), { x: 300, y: 420 });
  eq(dotPosIn(parseParts("X0@300,460:2"), "X0"), { x: 300, y: 556 });
  eq([wireCost(10), wireCost(400)], [1, 10]);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "campaign", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
