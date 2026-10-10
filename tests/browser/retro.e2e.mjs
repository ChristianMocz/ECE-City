// tests/browser/retro.e2e.mjs
//
// The look of the game: pixel art, night time, "What is this?" cards, sound.
import { open } from './harness.mjs';
const h = await open();
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const center = id => h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id);
const bubbleText = () => h.S(sc => { const b = sc.children.list.find(o => o.type === 'Container' && o.depth === 302 && o.active); return b?.bubbleText?.text ?? null; });

console.log('Look');
await t('pixel font loaded and used by the HUD', async () => {
  ok(await h.page.evaluate(() => document.fonts.check('16px "Pixelify Sans"')), 'font loaded');
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Text' && o.text === 'Sparkville' && o.style.fontFamily.includes('Pixelify'))), 'title uses it');
});
await t('pixel-art textures exist and crisp scaling is on', async () => {
  const keys = ['house', 'house_win_on', 'gen', 'gnd', 'cap', 'xfmr', 'switch_on', 'switch_off', 'led_on', 'led_burned', 'tree', 'pine', 'grass', 'road', 'sky', 'glow'];
  eq(await h.S((sc, st, keys) => keys.filter(k => !sc.textures.exists(k)), keys), [], 'missing textures');
  ok(await h.S(sc => sc.game.config.antialias === false), 'pixelArt (no smoothing)');
});
await t('the starter house shows lit windows; unlit ones do not', async () => {
  eq(await h.S((sc, st) => [st.nodes.get('H0').visual.winOn.visible, st.nodes.get('H1').visual.winOn.visible]), [true, false], 'windows');
});
await t('resistors get real colour-code stripe textures per value', async () => {
  await h.btn('RES'); await h.click(450, 320 - 147 + 66 + 0 * 68 + 28); await h.click(330, 210);
  await h.btn('RES'); await h.click(450, 320 - 147 + 66 + 2 * 68 + 28); await h.click(780, 470);
  eq(await h.S((sc, st) => [st.nodes.get('R0').visual.base.texture.key, st.nodes.get('R1').visual.base.texture.key]), ['res_100', 'res_1000'], 'textures');
  await h.btn('UNDO'); await h.btn('UNDO'); await h.btn('WIRE');
});
await t('the generator smokes while supplying power', async () => {
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) { await h.page.waitForTimeout(150); seen = await h.S(sc => sc.children.list.some(o => o.type === 'Rectangle' && o.depth === 19 && o.active)); }
  ok(seen, 'smoke puff on screen');
});
await t('the switch art flips between closed and open', async () => {
  await h.btn('SWITCH'); await h.click(300, 470);
  const z = await h.S((sc, st) => { const zz = st.nodes.get('T0').extraHits[0]; return [zz.x, zz.y]; });
  eq(await h.S((sc, st) => st.nodes.get('T0').visual.base.texture.key), 'switch_on', 'closed');
  await h.click(...z);
  eq(await h.S((sc, st) => st.nodes.get('T0').visual.base.texture.key), 'switch_off', 'open');
  await h.btn('UNDO'); await h.btn('UNDO'); await h.btn('WIRE');
});

console.log('Night time');
await t('SKIP TIME to night darkens the town, tints unlit parts, makes lit windows glow', async () => {
  const dayGlow = await h.S((sc, st) => st.nodes.get('H0').visual.glows[0].alpha);
  await h.btn('SKIP'); await h.page.waitForTimeout(2500);
  ok(await h.S((sc, st) => st.night), 'it is night');
  ok(await h.status().then(s => s.startsWith("It's night!")), 'status');
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Rectangle' && o.depth === 8.5 && o.alpha > 0.5)), 'night wash on');
  ok(await h.S((sc, st) => st.nodes.get('H1').visual.body.isTinted && st.nodes.get('GEN').visual.base.isTinted), 'unlit parts tinted');
  const nightGlow = await h.S((sc, st) => st.nodes.get('H0').visual.glows[0].alpha);
  ok(nightGlow > dayGlow && nightGlow >= 0.7, `glow ${dayGlow} -> ${nightGlow}`);
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Rectangle' && o.depth === 9 && o.alpha > 0)), 'fireflies out');
});
await t('a part placed at night arrives tinted for night', async () => {
  await h.btn('HOUSE'); await h.click(300, 470);
  const id = await h.S((sc, st) => [...st.nodes.keys()].filter(k => /^H\d+$/.test(k)).pop());
  ok(await h.S((sc, st, id) => st.nodes.get(id).visual.body.isTinted, id), 'tinted');
  await h.btn('UNDO'); await h.btn('WIRE');
});
await t('SKIP TIME again brings the morning back', async () => {
  await h.btn('SKIP'); await h.page.waitForTimeout(2500);
  ok(await h.S((sc, st) => !st.night), 'day');
  ok(await h.S(sc => !sc.children.list.some(o => o.type === 'Rectangle' && o.depth === 8.5 && o.alpha > 0.01)), 'wash off');
  ok(await h.S((sc, st) => !st.nodes.get('H1').visual.body.isTinted), 'tint cleared');
});

console.log('What is this?');
await t('tapping the generator shows its card with the live current', async () => {
  const [x, y] = await center('GEN'); await h.click(x, y - 20);
  const txt = await bubbleText(); ok(txt && txt.includes('supplying 0.61 A'), txt);
});
await t('tapping a capacitor shows how full it is', async () => {
  await h.btn('CAP'); await h.click(450, 320 - 147 + 66 + 68 + 28); await h.click(780, 220);
  await h.btn('WIRE'); await h.wireIt('GEN', 'C0'); await h.wireIt('C0b', 'GND');
  await h.page.waitForTimeout(1500);
  await h.click(...await center('C0'));
  const txt = await bubbleText(); ok(txt && /Capacitor C0: 220 µF, \d+% full/.test(txt), txt);
});

console.log('Sound');
await t('Settings turns sound off, and the choice is remembered after reload', async () => {
  ok(!(await h.page.evaluate(() => Sfx.muted)), 'starts on');
  await h.btn('SETTINGS');
  await h.tap('setting:music'); ok(!(await h.page.evaluate(() => Music.enabled)), 'music off');
  await h.tap('setting:sound'); ok(await h.page.evaluate(() => Sfx.muted), 'muted');
  ok(await h.S(sc => sc.children.list.some(c => c.depth >= 500 && c.list?.some(o => o.type === 'Text' && o.text === 'OFF'))), 'shows OFF');
  await h.page.reload(); await h.page.waitForFunction(() => window.__games?.[window.__games.length - 1]?.scene?.scenes?.[0]?.__state);
  ok(await h.page.evaluate(() => Sfx.muted), 'still muted after reload');
  await h.page.evaluate(() => { Sfx.setMuted(false); Music.setEnabled(true); });
});
await t('sound effects play without errors when actions happen', async () => {
  const errs = await h.page.evaluate(() => { const bad = []; for (const n of ['tap', 'place', 'wire', 'delete', 'click', 'light', 'pop', 'blip', 'undo', 'win', 'no-such-sound']) { try { Sfx.play(n); } catch (e) { bad.push(n + ': ' + e.message); } } return bad; });
  eq(errs, [], 'sound errors');
});
await t('no console/page errors at any point', async () => { eq(h.errors, [], 'errors'); });
console.log(`\n${pass} passed, ${fail} failed`);
await h.browser.close();
process.exitCode = fail ? 1 : 0;
