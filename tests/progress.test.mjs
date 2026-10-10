// tests/progress.test.mjs
//
// Tests for src/rules/progress.js (buttons that unlock as you go, the Today
// board, the Engineer's Notebook, time trial and no-undo records, overall
// progress) and src/rules/maker.js (the Puzzle maker's share codes).
//
// Run: node tests/progress.test.mjs  (or open tests/run-in-browser.html)
(async () => {
if (typeof featureUnlocked === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  globalThis.Mode ??= { WIRE: "WIRE" };
  for (const f of ["../src/art/pixelart.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/plants.js", "../src/circuit/state.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/campaign.js", "../src/rules/levels.js", "../src/rules/emergencies.js", "../src/rules/progress.js", "../src/rules/maker.js"]) {
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
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || "not equal"}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
const fresh = () => normalizeProfile({});
const finish = (p, ...ids) => { for (const id of ids) p.campaign[id] = 3; };
const xpFor = (lvl) => XP_FOR_LEVEL[lvl - 1];

console.log("Buttons appear as you go");
test("a brand-new player has every toolbar button", () => {
  const t = toolbarFor(fresh());
  assert(Object.values(t).every(Boolean), JSON.stringify(t));
  eq(Object.keys(t).sort(), ["build", "delete", "hint", "levels", "phone", "redo", "today", "undo", "wire"]);
});
test("or by reaching a level (orders and the daily puzzle also give XP)", () => {
  const p = fresh(); p.xp = xpFor(3);
  const t = toolbarFor(p);
  assert(Object.values(t).every(Boolean), JSON.stringify(t));
});
test("a level always shows the tools it needs", () => {
  const p = fresh();
  const t = toolbarFor(p, { needs: levelNeeds(CAMPAIGN_BY_ID["sparkville-5"]) });
  assert(t.delete, "level 5 needs DELETE (unplug two houses)");
  const t8 = toolbarFor(p, { needs: levelNeeds(CAMPAIGN_BY_ID["sparkville-8"]) });
  assert(t8.build, "a level with a toolbox needs + BUILD");
  for (const lv of CAMPAIGN_LEVELS) {
    const n = levelNeeds(lv), ops = new Set(lv.solution.map(s => s[0]));
    if (ops.has("u")) assert(n.delete, lv.id + " needs delete");
    if (ops.has("p")) assert(n.build, lv.id + " needs build");
  }
});
test("phone apps unlock by level; New! until tapped; announced once", () => {
  const p = fresh();
  assert(!featureUnlocked(p, "shop") && featureUnlocked(p, "settings"), "settings always, shop later");
  p.xp = xpFor(2);
  assert(featureUnlocked(p, "shop") && featureUnlocked(p, "clothes") && !featureUnlocked(p, "map"), "level 2");
  assert(featureIsNew(p, "shop"), "New!");
  markFeatureSeen(p, "shop"); assert(!featureIsNew(p, "shop"), "seen");
  const first = newlyUnlocked(p);
  assert(first.includes("shop") && first.includes("phone"), JSON.stringify(first));
  eq(newlyUnlocked(p), [], "announced only once");
  p.xp = xpFor(3); assert(featureUnlocked(p, "map") && featureUnlocked(p, "daily"), "level 3: map and daily");
  p.xp = xpFor(5); assert(featureUnlocked(p, "maker"), "level 5: puzzle maker");
});
test("an older save: everything it already had counts as seen; only brand-new features say New!", () => {
  const p = normalizeProfile({ xp: 5000, coins: 100 });
  for (const k of ["shop", "orders", "map", "daily", "delete", "build", "undo"]) assert(!featureIsNew(p, k), k + " is not New for an old player");
  for (const k of ["today", "phone", "maker"]) assert(featureIsNew(p, k), k + " is New");
  assert(!newlyUnlocked(p).includes("shop"), "the shop isn't announced again");
  // ...and a new save keeps its lists.
  const q = normalizeProfile(JSON.parse(JSON.stringify(p)));
  eq(q.seenFeatures, p.seenFeatures, "kept");
});
test("every feature has a name; phone apps have an icon and a real tab", () => {
  const tabs = PHONE_TABS.map(t => t[0]);
  for (const [k, f] of Object.entries(FEATURES)) {
    assert(f.name && typeof f.unlock === "function", k);
    if (f.where === "phone") assert(f.icon && tabs.includes(f.tab), k);
  }
});

console.log("Today board");
test("a new player: the next level first, and where the Captain will be", () => {
  const items = todayItems(fresh(), { puzzleDone: true });
  eq(items[0].key, "level"); eq(items[0].level, "sparkville-1");
  const cap = items.find(i => i.key === "captain");
  assert(cap && !cap.action && /level 3/.test(cap.text), cap?.text);
});
test("the Captain, once he's there, says where and what he unlocks", () => {
  const p = fresh(); p.xp = xpFor(3);
  const cap = todayItems(p, {}).find(i => i.key === "captain");
  assert(cap.action === "captain" && cap.region === "sparkville" && /Battery Bay/.test(cap.text) && cap.urgent, cap.text);
  p.bossWins.sparkville = { easy: true }; p.xp = xpFor(5);
  const c2 = todayItems(p, {}).find(i => i.key === "captain");
  eq(c2.region, "batterybay", "then the next Captain");
});
test("emergencies come first; gift, daily, orders and notebook show when there's something", () => {
  const p = fresh(); p.xp = xpFor(3); finish(p, "sparkville-1");
  const items = todayItems(p, { emergency: { name: "Squirrel!", secondsLeft: 20 }, giftWaiting: true, puzzleDone: false, ordersReady: 2 });
  eq(items[0].key, "emergency");
  for (const k of ["gift", "daily", "orders", "notebook"]) assert(items.some(i => i.key === k), k);
});
test("finished a world's path: the Expert level shows up, and the next world's level", () => {
  const p = fresh(); p.xp = xpFor(6); p.bossWins.sparkville = { easy: true };
  for (const lv of campaignLevelsOf("sparkville")) p.campaign[lv.id] = 1;
  const items = todayItems(p, {});
  assert(items.some(i => i.key === "expert" && i.level === "sparkville-11"), "expert");
  assert(items.some(i => i.key === "level" && i.level === "batterybay-1"), "next world");
});
test("all caught up still says something useful", () => {
  const p = fresh(); for (const lv of CAMPAIGN_LEVELS) p.campaign[lv.id] = 3;
  for (const k of REGION_KEYS) p.bossWins[k] = { easy: true };
  p.xp = xpFor(25); markCardsSeen(p);
  const items = todayItems(p, { puzzleDone: true });
  eq(items.map(i => i.key), ["free", "orders"], "all caught up, and the orders row is always there");
});
test("orders live on the Today board (not in the phone), always with a Go button", () => {
  const p = fresh(); p.xp = xpFor(2);
  eq(FEATURES.orders.where, "today");
  const none = todayItems(p, {}).find(i => i.key === "orders");
  assert(none && none.action === "orders" && /none right now/.test(none.text), none?.text);
  const two = todayItems(p, { ordersReady: 2 }).find(i => i.key === "orders");
  assert(/2 waiting/.test(two.text), two.text);
  assert(!todayItems(fresh(), {}).some(i => i.key === "orders"), "not before they unlock");
});

console.log("Engineer's Notebook");
test("cards unlock as you finish the levels that teach them", () => {
  const p = fresh();
  eq(notebookCards(p).length, 0);
  finish(p, "sparkville-1"); eq(notebookCards(p).map(c => c.key), ["loop"]);
  finish(p, "robot-1", "robot-2"); assert(notebookCards(p).some(c => c.key === "and") && notebookCards(p).some(c => c.key === "or"), "logic cards");
  p.owned.plants.push("hydro"); assert(notebookCards(p).some(c => c.key === "plants"), "plants card");
});
test("every card's level exists and every card has a picture and one line", () => {
  for (const c of NOTEBOOK) {
    assert(c.title && c.text && c.pic && c.text.length < 120, c.key);
    const src = c.when.toString(), ids = [...src.matchAll(/"([a-z]+-\d+)"/g)].map(m => m[1]);
    for (const id of ids) assert(CAMPAIGN_BY_ID[id], `${c.key}: ${id}`);
  }
  eq(new Set(NOTEBOOK.map(c => c.key)).size, NOTEBOOK.length, "unique");
});
test("a full campaign fills the notebook (except the cards earned by buying)", () => {
  const p = fresh(); for (const lv of CAMPAIGN_LEVELS) p.campaign[lv.id] = 1;
  eq(notebookCards(p).length, NOTEBOOK.length - 2);
  markCardsSeen(p); eq(p.seenCards.length, NOTEBOOK.length - 2);
});

console.log("Time trials and the no-undo challenge");
test("a first time trial pays; a better time is a new record; a slower one isn't", () => {
  const p = fresh();
  const a = recordChallenge(p, "sparkville-3", "time", 42.34);
  assert(a.newBest && a.coins === TIME_TRIAL_REWARD.coins, JSON.stringify(a)); eq(p.records["sparkville-3"].time, 42.3);
  const b = recordChallenge(p, "sparkville-3", "time", 50); assert(!b.newBest && b.coins === 0, "slower");
  const c = recordChallenge(p, "sparkville-3", "time", 30.06); assert(c.newBest && c.prev === 42.3 && c.coins === 5, JSON.stringify(c)); eq(p.records["sparkville-3"].time, 30.1);
});
test("the no-undo challenge pays once", () => {
  const p = fresh();
  const a = recordChallenge(p, "neon-2", "noundo", 99); assert(a.firstNoUndo && a.coins === NO_UNDO_REWARD.coins);
  const b = recordChallenge(p, "neon-2", "noundo", 80); assert(!b.firstNoUndo && b.coins === 0);
  assert(p.records["neon-2"].noUndo && p.records["neon-2"].time == null, "no time recorded in no-undo");
});
test("records survive a save; junk is dropped", () => {
  const p = normalizeProfile({ records: { "sparkville-3": { time: 12.34, noUndo: true }, "bad id": { time: 3 }, "neon-1": { time: -5 }, "moon-2": "x" } });
  eq(p.records, { "sparkville-3": { time: 12.3, noUndo: true } });
});
test("formatTime", () => { eq(formatTime(5.25), "0:05.3"); eq(formatTime(75), "1:15.0"); eq(formatTime(null), "—"); });
test("game progress: 0% at the start, 100% when everything's done", () => {
  eq(gameProgress(fresh()).percent, 0);
  const p = fresh();
  for (const lv of CAMPAIGN_LEVELS) p.campaign[lv.id] = 3;
  for (const k of REGION_KEYS) p.bossWins[k] = { easy: true };
  for (const k of Object.keys(STICKERS)) p.stickers[k] = "2026-01-01";
  for (let i = 0; i < 20; i++) p.records["sparkville-" + (i % 10 + 1) + (i >= 10 ? "x" : "")] = { noUndo: true };
  p.records = Object.fromEntries(CAMPAIGN_LEVELS.slice(0, 20).map(l => [l.id, { noUndo: true }]));
  p.owned.plants = PLANT_KEYS.filter(k => k !== "generator");
  p.owned.outfits = Object.keys(OUTFITS);
  p.lines = [{ a: "sparkville", b: "batterybay", ratio: 10 }];
  eq(gameProgress(p).percent, 100);
});

console.log("Puzzle maker");
const sample = () => ({
  name: "Two & a switch", world: "neon",
  parts: [{ kind: "HOUSE", id: "H0", x: 400, y: 260 }, { kind: "HOUSE", id: "H1", x: 620, y: 260, building: "bakery" }, { kind: "TRANS", id: "T0", x: 300, y: 250, on: false }, { kind: "RES", id: "R0", x: 520, y: 430, ohms: 470 }, { kind: "LED", id: "L0", x: 650, y: 440 }],
  wires: [{ a: "GEN", b: "T0" }],
  goal: { lit: ["H0", "L0"], dark: ["H1"] }, budget: 40, tight: true, par: 6,
});
test("a puzzle survives the trip through its share code", () => {
  const pz = sample(), code = encodePuzzle(pz);
  assert(/^ECE-[A-Za-z0-9_-]+-[0-9a-z]{3}$/.test(code), code);
  assert(code.length < 400, "short enough to send: " + code.length);
  const r = decodePuzzle(code);
  assert(r.ok, r.why);
  eq(r.puzzle, pz);
  assert(decodePuzzle("  " + code + "\n").ok, "spaces around it are fine");
});
test("a typo, a junk code or a broken puzzle is caught with a friendly message", () => {
  const code = encodePuzzle(sample());
  const typo = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  assert(/typo/.test(decodePuzzle(typo).why), decodePuzzle(typo).why);
  assert(/ECE-/.test(decodePuzzle("hello").why), "not a code");
  assert(!decodePuzzle("").ok && !decodePuzzle(null).ok, "empty");
  const bad = (change) => { const pz = sample(); change(pz); return validatePuzzle(pz); };
  assert(!bad(p => { p.parts[0].x = 5; }).ok, "off the board");
  assert(!bad(p => { p.wires.push({ a: "GEN", b: "T0" }); }).ok, "same wire twice");
  assert(!bad(p => { p.wires.push({ a: "GEN", b: "Z9" }); }).ok, "a wire to nowhere");
  assert(!bad(p => { p.goal.lit = []; }).ok, "no goal");
  assert(!bad(p => { p.goal.dark.push("H0"); }).ok, "bright and dark");
  assert(!bad(p => { p.goal.lit.push("R0"); }).ok, "a resistor isn't a light");
  assert(!bad(p => { p.budget = 0; }).ok, "budget");
  assert(!bad(p => { p.parts = Array.from({ length: 17 }, (_, i) => ({ kind: "HOUSE", id: "H" + i, x: 300, y: 260 })); }).ok, "too many parts");
  // A hand-made code with an unknown part.
  const evil = (obj) => { const body = btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); return `ECE-${body}-${makerChecksum(body)}`; };
  assert(!decodePuzzle(evil({ n: "x", p: [["Q0", 200, 130, 0]], w: "", l: "Q0", $: 5, s: 1 })).ok, "unknown part");
  assert(!decodePuzzle(evil({ n: "x", p: "nope" })).ok, "junk parts");
});
test("a shared puzzle plays as a level: starts unsolved, and the maker's solution wins with three stars", () => {
  const pz = sample(), lv = puzzleToLevel(pz, encodePuzzle(pz));
  assert(lv.custom && lv.hard && lv.budget === 40, "level fields");
  const sol = parseSolution("f T0; w T0b H0; w H0b GND; w GEN R0; w R0b L0; w L0b GND");
  const r = replaySolution(lv, sol);
  assert(!r.startedSolved && r.wonAtEnd, "solvable");
  const st = levelStars(lv, { spent: r.spent, wiresAdded: r.wiresAdded, popped: r.popped });
  assert(r.spent <= 40 && st.stars === 3, `spent ${r.spent}, stars ${st.stars}`);
  // Lighting the bakery breaks the "keep H1 dark" goal.
  const r2 = replaySolution(lv, parseSolution("f T0; w T0b H0; w H0b GND; w GEN R0; w R0b L0; w L0b GND; w T0b H1; w H1b GND"));
  assert(!r2.wonAtEnd, "H1 must stay dark");
  eq(makerGoalText(pz.goal), "Light H0 and L0, but keep H1 dark.");
});
test("my puzzles are saved (at most 12, names trimmed)", () => {
  const list = Array.from({ length: 15 }, (_, i) => ({ name: "P" + i + "x".repeat(40), code: "ECE-a-000" }));
  const p = normalizeProfile({ myPuzzles: [...list, { name: 3 }, null] });
  eq(p.myPuzzles.length, 12); assert(p.myPuzzles[0].name.length <= 30, "trimmed");
});
test("budget suggestion leaves room (or very little when tight)", () => {
  eq(suggestBudget(20, false), 30); eq(suggestBudget(20, true), 21); eq(suggestBudget(0, false), 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "progress", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
