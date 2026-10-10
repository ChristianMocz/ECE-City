// tests/browser/power.e2e.mjs
//
// Power plants and power lines, through the real game screen.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, m, tol = 1e-6) => { if (Math.abs(a - b) > tol) throw new Error(`${m}: got ${a} want ${b}`); };

const allBosses = Object.fromEntries(['sparkville', 'batterybay', 'solardesert', 'mountains', 'windmill', 'waterfall', 'neon', 'tundra', 'volcano', 'robot', 'storm', 'moon'].map(k => [k, { easy: true }]));
const h = await open({ seed: { xp: 11800, coins: 20000, bossWins: allBosses } });
const P = (fn, arg) => h.api(fn, arg);
const texts = () => h.S(sc => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const c of sc.children.list.filter(o => o.type === 'Container' && o.depth >= 500 && o.active)) w(c.list); return out; });
const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
const gen = () => h.S((sc, st) => ({ scale: st.genScale, R: st.R_GEN, tex: st.nodes.get('GEN').visual.base.texture.key, label: st.nodes.get('GEN').visual.plantLabel.text, off: !!st.genOff }));
const wireAll = async (ids) => { await h.btn('WIRE'); for (const id of ids) { if (!(await h.S((sc, st, id) => st.wires.some(w => (w.a === 'GEN' && w.b === id) || (w.b === 'GEN' && w.a === id)), id))) await h.wireIt('GEN', id); if (!(await h.S((sc, st, id) => st.wires.some(w => (w.a === id + 'b' && w.b === 'GND') || (w.b === id + 'b' && w.a === 'GND')), id))) await h.wireIt(id + 'b', 'GND'); } };

console.log('Power plants');
await t('the SHOP has a Power plants tab with all ten', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:plant');
  for (const k of ['generator', 'solarfarm', 'wind', 'hydro', 'coal', 'nuclear', 'geothermal', 'biogas', 'tidal', 'fusion']) ok(await h.tagPos('shop:plant:' + k), k);
  ok((await texts()).join(' ').includes('powering this town'), 'the little generator powers it now');
});
await t('a plant\'s card says what it\'s good at and its catch; buying it powers this town', async () => {
  await h.tap('shop:plant:hydro');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('Hydro dam') && tx.includes('Good:') && tx.includes('Catch:') && tx.includes('Buy · 260'), tx);
  const c0 = await P(a => a.profile.coins);
  await h.tap('plant:buy'); await h.page.waitForTimeout(200);
  eq(await P(a => [a.profile.coins, a.profile.owned.plants, a.profile.plantIn.sparkville]), [c0 - 260 + 10, ['hydro'], 'hydro'], 'bought (the new sticker pays 10)');
  const g = await gen();
  eq([g.tex, g.scale], ['plant_hydro', 1], 'the GEN is a hydro dam now'); near(g.R, 0.7, 'R');
  ok(g.label.startsWith('Hydro dam: 100%'), g.label);
  ok(await P(a => !!a.profile.stickers.power_tycoon), 'Power Tycoon sticker');
});
await t('the bigger plant really lights more: five houses', async () => {
  await P(a => { a.state.weatherOverride = 'normal'; });
  for (const [x, y] of [[300, 470], [450, 470]]) { await h.btn('HOUSE'); await h.click(x, y); }
  const ids = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'HOUSE').map(n => n.id));
  eq(ids.length, 5, 'five houses');
  await wireAll(ids);
  for (const id of ids) eq(await lv(id), 'ON', id);
  // the same five on the little generator
  await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:generator'); await h.tap('plant:use'); await h.page.waitForTimeout(150);
  eq((await gen()).R, 1.5, 'back on the little generator');
  ok((await lv(ids[0])) !== 'ON', 'too many for it');
});
await t('wind turbine: blades turn; a storm puts the brakes on', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:wind'); await h.tap('plant:buy'); await h.page.waitForTimeout(150);
  const g = await gen();
  eq(g.tex, 'plant_wind', 'wind'); near(g.R, 0.9, 'R');
  const a0 = await h.S((sc, st) => st.nodes.get('GEN').visual.blades.angle);
  await h.gameWait(300);
  ok((await h.S((sc, st) => st.nodes.get('GEN').visual.blades.angle)) !== a0, 'blades turn');
  ok(await h.S((sc, st) => st.nodes.get('GEN').visual.blades.visible), 'blades shown');
  await P(a => a.setWeather('storm'));
  near((await gen()).scale, 0.3, 'storm brakes');
  ok((await gen()).label.includes('brakes on'), (await gen()).label);
  await P(a => a.setWeather('normal'));
});
await t('solar farm sleeps at night — and the valve stops a battery draining into it', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:solarfarm'); await h.tap('plant:buy'); await h.page.waitForTimeout(150);
  eq((await gen()).scale, 1, 'day');
  await h.btn('BAT'); await h.click(760, 470);
  const B = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'BAT').pop().id);
  await h.btn('WIRE'); await h.wireIt('GEN', B); await h.wireIt(B + 'b', 'GND');
  await h.S((sc, st, B) => { st.nodes.get(B).data.Vprev = 12; }, B);
  await h.btn('SKIP'); await h.page.waitForTimeout(300);
  eq((await gen()).scale, 0, 'night: no sun');
  ok((await gen()).off, 'valve shut');
  const v0 = await h.S((sc, st, B) => st.nodes.get(B).data.Vprev, B);
  await h.gameWait(1000);
  const v1 = await h.S((sc, st, B) => st.nodes.get(B).data.Vprev, B);
  ok(v1 > 9 && v0 - v1 < 0.6, `the battery runs the town, not backwards into the plant (${v0.toFixed(2)} → ${v1.toFixed(2)})`);
  await h.btn('SKIP'); await h.page.waitForTimeout(300);
});
await t('coal: 4 coins of coal every morning', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:coal'); await h.tap('plant:buy'); await h.page.waitForTimeout(200);
  const c0 = await P(a => a.profile.coins);
  await h.btn('SKIP'); await h.page.waitForTimeout(200); await h.btn('SKIP'); await h.page.waitForTimeout(300); // night, then morning
  eq(await P(a => a.profile.coins), c0 - 4, 'paid for coal');
  eq((await gen()).tex, 'plant_coal', 'coal plant');
});
await t('nuclear: warms up after you arrive', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:nuclear'); await h.tap('plant:buy'); await h.page.waitForTimeout(100);
  const s0 = (await gen()).scale;
  ok(s0 < 0.5, 'cold at first: ' + s0);
  await P(a => a.setArrived(-1e9));
  await h.page.waitForTimeout(150);
  eq((await gen()).scale, 1, 'warm');
});
await t('every plant can be put to work, and each looks different', async () => {
  for (const k of ['geothermal', 'biogas', 'tidal', 'fusion']) {
    await h.btn('SHOP'); await h.tap('shoptab:plant'); await h.tap('shop:plant:' + k); await h.tap('plant:buy'); await h.page.waitForTimeout(100);
    eq((await gen()).tex, 'plant_' + k, k);
  }
  near((await gen()).R, 0.25, 'fusion');
  eq(await P(a => a.profile.owned.plants.length), 9, 'nine bought');
  ok((await gen()).label.startsWith('Fusion reactor: 100%'), 'label');
});
await t('a tidal plant does nothing away from the sea', async () => {
  await P(a => { a.profile.plantIn.sparkville = 'tidal'; });
  await h.page.waitForTimeout(150);
  eq((await gen()).scale, 0, 'no sea in Sparkville');
  ok((await gen()).label.includes('no sea'), (await gen()).label);
  await P(a => { a.profile.plantIn.sparkville = 'fusion'; });
});

console.log('Power lines');
await t('MAP → Power lines: tap two neighbours, pick a transformer, build it', async () => {
  await P(a => { a.profile.plantIn.sparkville = 'generator'; });
  await h.btn('MAP'); await h.tap('map:lines');
  await h.tap('lines:sparkville'); await h.tap('lines:solardesert');
  ok((await texts()).join(' ').includes('next to each other'), 'not neighbours');
  await h.tap('lines:sparkville'); await h.tap('lines:batterybay');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('Power lost on the way: 57%') && tx.includes('Power lost on the way: 1%'), tx);
  const c0 = await P(a => a.profile.coins);
  await h.tap('line:10'); await h.page.waitForTimeout(150);
  eq(await P(a => a.profile.lines), [{ a: 'sparkville', b: 'batterybay', ratio: 10 }], 'built');
  eq(await P(a => a.profile.coins), c0 - 240 + 10, 'paid (the new sticker pays 10)');
  ok(await P(a => !!a.profile.stickers.line_worker), 'sticker');
  ok(await h.tagPos('lines:back'), 'back on the lines map');
  await h.tap('lines:back'); await h.tap('close');
});
await t('the joined towns share power: the GEN gets stronger', async () => {
  const g = await gen();
  ok(g.R < 0.8, `two generators in parallel (R ${g.R})`);
  ok((await lv('H0')) === 'ON', 'lit');
});
await t("a neighbour's plant keeps a town going at night", async () => {
  await P(a => { a.profile.plantIn.sparkville = 'solarfarm'; a.profile.plantIn.batterybay = 'hydro'; });
  await h.btn('SKIP'); await h.page.waitForTimeout(250);
  ok((await gen()).scale > 0.9, 'Battery Bay\'s dam covers the night: ' + (await gen()).scale);
  await h.btn('SKIP'); await h.page.waitForTimeout(250);
});
await t('the lines show on the world map', async () => {
  await h.btn('MAP');
  ok(await h.S(sc => { let n = 0; const w = (l) => { for (const o of l) { if (o.texture?.key === 'pylon') n++; if (o.list) w(o.list); } }; w(sc.children.list); return n; }) >= 1, 'a pylon');
  await h.tap('close');
});
await t('plants and lines are saved', async () => {
  await P(a => a.save());
  const saved = await h.page.evaluate(() => JSON.parse(localStorage.getItem('ececity.save.v1')));
  eq([saved.owned.plants.length, saved.lines.length, saved.plantIn.sparkville], [9, 1, 'solarfarm'], 'saved');
});
await t('levels and bosses always use the plain little generator', async () => {
  await P(a => a.startBoss('sparkville', 'easy', 1));
  eq([(await gen()).R, (await gen()).scale, (await gen()).tex], [1.5, 1, 'gen'], 'boss');
  await P(a => a.backToTown());
  ok((await gen()).R < 1.5, 'back home: shared power again');
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
