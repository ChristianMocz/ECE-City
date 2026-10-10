// tests/browser/levels.e2e.mjs
//
// Campaign levels through the real game screen: the level path, cards,
// playing, the toolbox, budgets (and tight budgets), fixed parts, stars,
// the result screen, next level, training missions, world switching.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const h = await open({ seed: { xp: 1300, coins: 500, campaign: {} } }); // level 10, nothing beaten
const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
const L = () => h.api(a => a.levelState());
const texts = () => h.S(sc => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const c of sc.children.list.filter(o => o.type === 'Container' && o.depth >= 500 && o.active)) w(c.list); return out; });
const screenOpen = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth >= 500 && o.active));
const play = async (id) => { await h.btn('LEVELS'); const w = id.split('-')[0]; for (let i = 0; i < 12 && !(await h.tagPos('level:' + id)); i++) await h.tap('levels:next'); await h.tap('level:' + id); await h.tap('level:play'); await h.page.waitForTimeout(150); };
const body = (id) => h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id);
const chip = () => h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.depth === 206)?.text || '');

console.log('The level path');
await t('LEVELS shows this world\'s ten levels; only level 1 is open', async () => {
  await h.btn('LEVELS');
  for (let n = 1; n <= 10; n++) ok(await h.tagPos('level:sparkville-' + n), 'level ' + n);
  const tx = (await texts()).join(' | ');
  ok(tx.includes('Sparkville levels') && tx.includes('0/30'), tx);
  await h.tap('level:sparkville-3');
  ok(await screenOpen(), 'a locked level keeps the path open');
  ok(await h.tagPos('level:sparkville-1'), 'still on the path');
});
await t('◀ ▶ switch worlds; locked worlds say why', async () => {
  await h.tap('levels:next');
  ok((await texts()).join(' ').includes('Battery Bay levels'), 'next world');
  ok((await texts()).join(' ').includes('Battery Bay is locked'), 'locked note');
  await h.tap('levels:prev');
  ok((await texts()).join(' ').includes('Sparkville levels'), 'back');
});
await t('Training opens the five old missions', async () => {
  await h.tap('levels:training');
  ok(await h.tagPos('choice:4'), 'missions list');
  await h.tap('close').catch(() => h.click(120, 450));
  await h.click(60, 600 - 60).catch(() => {});
  if (await screenOpen()) await h.click(20, 300);
});
await t('a level card shows the goal, budget and parts; Play starts it', async () => {
  await h.btn('LEVELS'); await h.tap('level:sparkville-1');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('First loop') && tx.includes('Goal: Light house H0') && /Budget: \$\d+/.test(tx), tx);
  await h.tap('level:play'); await h.page.waitForTimeout(150);
  eq(await h.S((sc, st) => st.context), 'level', 'in the level');
  eq(await h.S((sc, st) => [...st.nodes.keys()].sort()), ['GEN', 'GND', 'H0', 'H0b'], 'the level board');
  ok((await chip()).startsWith('Budget: $0'), await chip());
});

console.log('Playing');
await t('solving it: celebration, 3 stars, rewards, the result screen', async () => {
  const c0 = await h.api(a => a.profile.coins);
  await h.btn('WIRE'); await h.wireIt('GEN', 'H0'); await h.wireIt('H0b', 'GND');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  eq(await h.api(a => a.profile.campaign['sparkville-1']), 3, 'stars');
  await h.waitTag('result:next');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('Level complete!') && tx.includes('+45 coins'), tx);
  ok((await h.api(a => a.profile.coins)) >= c0 + 45, 'paid');
  ok(await h.api(a => !!a.profile.stickers.three_stars), 'Three Stars sticker');
});
await t('Next level ▶ starts level 2', async () => {
  await h.tap('result:next'); await h.page.waitForTimeout(150);
  eq((await L()).id, 'sparkville-2', 'level 2');
  ok(await h.S((sc, st) => st.wires.some(w => w.a === 'GEN' && w.b === 'H0')), 'its own wire');
});
await t('a level\'s own parts can\'t be deleted, but its wires can (and UNDO works)', async () => {
  await h.btn('DELETE'); await h.click(...await body('H0'));
  ok((await h.status()).includes('belongs to this level'), await h.status());
  ok(await h.S((sc, st) => st.nodes.has('H0')), 'still there');
  const [a, b] = [await h.dot('GEN'), await h.dot('H0')];
  await h.click((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  ok(!(await h.S((sc, st) => st.wires.length)), 'wire deleted');
  await h.btn('UNDO'); eq(await h.S((sc, st) => st.wires.length), 1, 'undo');
  ok(await h.S((sc, st) => st.nodes.get('H0').data.fixed), 'still fixed after undo');
  await h.btn('WIRE');
});
await t('? HINT gives the level\'s hint', async () => {
  await h.btn('HINT_BTN'); ok((await h.status()).includes("BLUE dot to GND"), await h.status());
});
await t('finishing level 2 (one wire)', async () => {
  await h.wireIt('H0b', 'GND');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  eq(await h.api(a => a.profile.campaign['sparkville-2']), 3, 'stars');
  await h.waitTag('result:map'); await h.tap('result:map');
  ok(await h.tagPos('level:sparkville-3'), 'back on the path, level 3 open');
});

console.log('Budgets and the toolbox');
await t('tight budget: a wire that costs too much is refused', async () => {
  await h.api(a => { for (let n = 1; n <= 9; n++) if (!a.profile.campaign['sparkville-' + n]) a.profile.campaign['sparkville-' + n] = 1; });
  await h.tap('close'); await play('sparkville-4');
  const budget = await h.api(a => a.state.level.def.budget);
  await h.wireIt('GEN', 'H0'); await h.wireIt('H0b', 'GND'); await h.wireIt('GEN', 'H1');
  // GEN-H1 (13) would leave too little for H1b-GND (12): the 4th, long wire is refused.
  const before = (await L()).spent;
  await h.wireIt('H1b', 'GND');
  const after = await L();
  ok(after.spent <= budget, `never over budget (${after.spent}/${budget})`);
  ok((await h.status()).includes('Not enough money'), await h.status());
  ok(!(await h.S((sc, st) => st.wires.some(w => (w.a === 'H1b' && w.b === 'GND') || (w.a === 'GND' && w.b === 'H1b')))), 'that wire is not there');
  eq(after.spent, before, 'nothing spent');
});
await t('…the clever way (sharing wires) fits', async () => {
  const [a, b] = [await h.dot('GEN'), await h.dot('H1')];
  await h.btn('DELETE'); await h.click(a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5); await h.btn('WIRE');
  await h.wireIt('H0', 'H1'); await h.wireIt('H1b', 'H0b');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  ok((await h.api(a => a.profile.campaign['sparkville-4'])) >= 2, 'won');
  await h.waitTag('result:map'); await h.tap('result:map'); await h.tap('close');
});
await t('the toolbox: BUILD shows only the level\'s parts, with counts', async () => {
  await play('sparkville-9');
  await h.btn('BUILD');
  for (const k of ['build:T:RES:100', 'build:T:RES:470', 'build:T:RES:1000']) ok(await h.tagPos(k), k);
  ok(!(await h.tagPos('build:HOUSE')), 'no ordinary parts');
  await h.tap('build:T:RES:100'); await h.click(420, 230);
  eq(await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'RES').map(n => n.data.ohms)), [100], 'placed the 100');
  eq(await h.S((sc, st) => st.mode), 'WIRE', 'none left: back to WIRE');
  ok((await chip()).startsWith('Budget: $3'), 'a part costs money: ' + await chip());
});
await t('a pop loses the "neat" star', async () => {
  await h.wireIt('GEN', 'R0'); await h.wireIt('R0b', 'L0'); await h.wireIt('L0b', 'GND');
  eq(await lv('L0'), 'BURNED', 'popped');
  eq((await L()).popped, true, 'remembered');
  // swap for the 470
  await h.btn('DELETE'); await h.click(...await body('R0'));
  await h.btn('BUILD'); await h.tap('build:T:RES:470'); await h.click(420, 230);
  await h.btn('WIRE'); await h.wireIt('GEN', 'R1'); await h.wireIt('R1b', 'L0');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  eq(await h.api(a => a.profile.campaign['sparkville-9']), 2, 'two stars (popped)');
  await h.waitTag('result:retry');
  ok((await texts()).join(' ').includes('something popped'), 'says why');
});
await t('Try again: a clean run earns all three', async () => {
  await h.tap('result:retry'); await h.page.waitForTimeout(150);
  eq((await L()).id, 'sparkville-9', 'same level'); eq((await L()).popped, false, 'fresh start');
  await h.btn('BUILD'); await h.tap('build:T:RES:470'); await h.click(420, 230); await h.btn('WIRE');
  await h.wireIt('GEN', 'R0'); await h.wireIt('R0b', 'L0'); await h.wireIt('L0b', 'GND');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  eq(await h.api(a => a.profile.campaign['sparkville-9']), 3, 'three stars now');
  await h.waitTag('result:map'); await h.tap('result:map'); await h.tap('close');
});
await t('a level with its own physics: the broken generator in Battery Bay 3', async () => {
  await h.api(a => { a.profile.bossWins.sparkville = { easy: true }; a.profile.campaign['batterybay-1'] = 1; a.profile.campaign['batterybay-2'] = 1; });
  await play('batterybay-3');
  eq(await h.S((sc, st) => [st.genScale, st.R_GEN]), [0, 1.5], 'physics');
  ok(await h.S((sc, st) => st.nodes.get('GEN').visual.plantLabel.text.includes('broken')), 'the GEN says so');
  await h.wireIt('B0', 'H0'); await h.wireIt('H0b', 'B0b');
  await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.level?.done, null, { timeout: 15000 });
  await h.waitTag('result:map'); await h.tap('result:map'); await h.tap('close');
});
await t('a night level is dark (and the clock box says so)', async () => {
  await h.api(a => { for (let n = 1; n <= 6; n++) a.profile.campaign['batterybay-' + n] = a.profile.campaign['batterybay-' + n] || 1; });
  await play('batterybay-7');
  eq(await h.S((sc, st) => [st.night, st.loadScale, st.solarFactor]), [true, 0.7, 0], 'night physics');
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Text' && /Night level/.test(o.text))), 'clock box');
});
await t('leaving a level: back to your town, just as you left it', async () => {
  await h.api(a => a.backToTown());
  eq(await h.S((sc, st) => st.context), 'town', 'town');
  ok(await h.S((sc, st) => st.nodes.has('H2')), 'the starter town');
  ok(!(await chip()).startsWith('Budget'), 'chip back to the town');
});
await t('LEVELS badge: a new level is waiting in this world', async () => {
  await h.api(a => a.refreshHud());
  eq((await h.api(a => a.badges())).levels, '!', 'badge on LEVELS');
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
