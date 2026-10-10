// tests/browser/worlds.e2e.mjs
//
// The twelve worlds (travel, looks, music, starter towns, every boss won
// through the screen), the living town, and the polish effects.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const KEYS = ['sparkville', 'batterybay', 'solardesert', 'mountains', 'windmill', 'waterfall', 'neon', 'tundra', 'volcano', 'robot', 'storm', 'moon'];
const GROUND = { sparkville: 'grass', batterybay: 'sand', solardesert: 'dune', mountains: 'rocky', windmill: 'meadow', waterfall: 'forest', neon: 'pavement', tundra: 'snow', volcano: 'ash', robot: 'metal', storm: 'cliff', moon: 'moondust' };
const h = await open({ seed: { xp: 11800, coins: 5000, bossWins: Object.fromEntries(KEYS.slice(0, 11).map(k => [k, { easy: true }])) } });
await h.api(a => { a.setNextEmergencyIn(9e9); });
const P = (fn, arg) => h.api(fn, arg);
const texts = () => h.S(sc => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const c of sc.children.list.filter(o => o.type === 'Container' && o.depth >= 500 && o.active)) w(c.list); return out; });
const screenOpen = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth >= 500 && o.active && !o.isClosing));
const closeAll = async () => { for (let i = 0; i < 4 && await screenOpen(); i++) { if (await h.tagPos('close')) await h.tap('close'); else if (await h.tagPos('boss:home')) await h.tap('boss:home'); else await h.click(15, 320); } };

console.log('Twelve worlds');
await t('the map shows twelve islands; all open at the top level (the last needs its boss)', async () => {
  await h.btn('MAP');
  const tx = await texts();
  for (const n of ['Windmill Valley', 'Waterfall Woods', 'Neon City', 'Frosty Tundra', 'Volcano Island', 'Robot Factory', 'Storm Coast', 'Moon Base']) ok(tx.includes(n), n);
  for (const k of KEYS) ok(await h.tagPos('map:' + k), k);
  await h.tap('map:neon');
  const r = (await texts()).join(' | ');
  ok(r.includes('DJ Diode') && r.includes("You'll learn:") && r.includes('Coal plant'), r);
  ok(await h.tagPos('region:levels'), 'levels button');
  await h.tap('region:levels');
  ok((await texts()).join(' ').includes('Neon City levels'), 'Neon City levels');
  await closeAll();
});
for (const k of KEYS) {
  await t(`travel to ${k}: its ground, scenery, song and starter town`, async () => {
    if (k !== 'sparkville') { ok(await P((a, st, k) => a.travel(k), k), 'travelled'); }
    await h.page.waitForTimeout(100);
    eq(await P(a => a.profile.region), k, 'region');
    eq(await h.S(sc => (sc.__ground.displayTexture || sc.__ground.texture).key), GROUND[k], 'ground');
    eq(await h.page.evaluate(() => Music.playing), k, 'song');
    ok(await h.S(sc => sc.__scenery.length >= 7 && sc.__scenery.every(o => o.texture.key !== '__MISSING')), 'scenery');
    eq(await h.S(sc => (sc.__sky.displayTexture || sc.__sky.texture).key), k === 'moon' ? 'sky_space' : 'sky', 'sky');
    ok(await h.S((sc, st) => st.nodes.has('H0') && st.wires.length >= 2), 'starter town');
    ok(await h.S((sc, st) => st.powered.get('H0')?.level === 'ON'), 'H0 lit');
  });
}
await t('visiting six worlds earns World Tour; the Moon earns Moonwalker', async () => {
  ok(await P(a => !!a.profile.stickers.world_tour), 'World Tour'); ok(await P(a => !!a.profile.stickers.moonwalker), 'Moonwalker');
});

console.log('Every boss, beaten through the screen');
const flip = async (id) => { const z = await h.S((sc, st, id) => { const zz = st.nodes.get(id).extraHits[0]; return [zz.x, zz.y]; }, id); await h.click(...z); };
const cutWire = async (a, b) => { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await h.btn('WIRE'); };
for (const k of KEYS.slice(4)) {
  await t(`${k}: Captain Short Circuit (hard) is beaten by fixing every break`, async () => {
    await P(a => { a.profile.settings.sparky = false; });
    await P((a, st, k) => a.startBoss(k, 'hard', 7), k);
    await h.btn('WIRE');
    const steps = await h.S((sc, st) => fixSteps(st.boss.breaks));
    ok(steps.length >= 4, 'several breaks');
    // In a boss fight Sparky asks every few seconds: skip his questions.
    const skipQ = async () => { await h.page.waitForTimeout(60); if (await h.tagPos('predict:skip')) await h.tap('predict:skip'); };
    for (const [op, a, b] of steps) { await skipQ(); if (op === 'wire') await h.wireIt(a, b); else if (op === 'unwire') await cutWire(a, b); else await flip(a); await skipQ(); }
    await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.boss?.won, null, { timeout: 20000 });
    ok(await P((a, st, k) => !!a.profile.bossWins[k].hard, k), 'remembered');
    eq(await h.S((sc, st) => st.nodes.get('GEN').visual.base.texture.key), 'gen', 'bosses use the little generator');
    await h.waitTag('boss:home'); await h.tap('boss:home');
  });
}

console.log('The living town');
await t('people move in while houses are lit, and stroll along the road', async () => {
  await P(a => a.travel('sparkville'));
  await P(a => { a.profile.population.sparkville = 0; a.state.clockFrozen = true; });
  for (let i = 0; i < 6; i++) await P(a => a.growTown(8.1));
  eq(await P(a => a.profile.population.sparkville), 6, 'six people');
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Text' && o.text === '6 people live here')), 'the chip');
  await P(a => { a.profile.population.sparkville = 40; });
  await h.gameWait(200);
  const n = await P(a => a.townLife.walkers.filter(w => w.visible).length);
  const c = await P(a => a.townLife.cars.filter(w => w.visible).length);
  ok(n >= 8 && c >= 3, `walkers ${n}, cars ${c}`);
  const x0 = await P(a => a.townLife.walkers[0].x); await h.gameWait(400);
  ok(Math.abs((await P(a => a.townLife.walkers[0].x)) - x0) > 1, 'they walk');
});
await t('no people move in while the town is dark', async () => {
  await P(a => { a.profile.population.sparkville = 3; });
  await cutWire('GEN', 'H0');
  for (let i = 0; i < 3; i++) await P(a => a.growTown(8.1));
  eq(await P(a => a.profile.population.sparkville), 3, 'still 3');
  await h.wireIt('GEN', 'H0');
});
await t('20 people: a party (+10 coins)', async () => {
  for (const id of ['H1', 'H2']) if (!(await h.S((sc, st, id) => st.wires.some(w => w.b === id), id))) { await h.wireIt('GEN', id); await h.wireIt(id + 'b', 'GND'); }
  await P(a => { a.profile.population.sparkville = 19; });
  const c0 = await P(a => a.profile.coins);
  await P(a => a.growTown(8.1));
  eq(await P(a => a.profile.population.sparkville), 20, '20');
  ok((await P(a => a.profile.coins)) >= c0 + 10, 'paid');
  ok((await h.status()).includes('20 people live in Sparkville'), await h.status());
});
await t('at night fewer people are out, cars have headlights, and lights flicker on at dusk', async () => {
  const day = await P(a => a.townLife.walkers.filter(w => w.visible).length);
  await h.btn('SKIP'); await h.gameWait(200);
  const night = await P(a => a.townLife.walkers.filter(w => w.visible).length);
  ok(night < day, `day ${day}, night ${night}`);
  ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'glow' && o.depth > 6 && o.depth < 7 && o.visible)), 'headlights');
  await P(a => a.flickerOnLights());
  eq(await h.S((sc, st) => st.nodes.get('H0').visual.winOn.alpha), 0, 'a window starts dark and flickers on');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.nodes.get('H0').visual.winOn.alpha === 1, null, { timeout: 20000 });
  await h.btn('SKIP');
});

console.log('Polish');
await t('wiring throws sparks at both dots', async () => {
  await cutWire('H0b', 'GND');
  await h.wireIt('H0b', 'GND');
  ok(await h.S(sc => sc.children.list.filter(o => o.type === 'Rectangle' && o.depth === 24 && o.width === 3).length >= 10), 'sparks');
});
await t('rewards fly up to the coin counter as coins', async () => {
  await P(a => a.startMission(0));
  await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].children.list.some(o => o.texture?.key === 'coin' && o.depth === 660), null, { timeout: 15000 });
  await P(a => a.backToTown());
});
await t('a popping LED shakes the screen', async () => {
  for (let i = 0; i < 3 && await screenOpen(); i++) await closeAll();
  await h.btn('RES'); await h.tap('choice:0'); await h.click(560, 440);
  await h.btn('LED'); await h.click(450, 470);
  const R = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'RES').pop().id), Ld = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'LED').pop().id);
  await h.btn('WIRE'); await h.wireIt('GEN', R); await h.wireIt(R + 'b', Ld); await h.wireIt(Ld + 'b', 'GND');
  ok(await h.S(sc => sc.cameras.main.shakeEffect.isRunning), 'shaking');
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
