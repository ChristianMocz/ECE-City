// tests/browser/title.e2e.mjs
//
// The title screen, the three save files, settings, the MENU and music.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

// Over HTTP-like file:// with a seeded save in slot 1.
const h = await open({ title: true, seed: { coins: 321, xp: 400, wearing: { hat: "hat_cap" }, owned: { outfits: ["hat_cap"] } } });
const game = () => h.page.evaluate(() => window.__games[0].scene.scenes[0]);
const titleUp = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth === 900 && o.active && !o.isClosing));
const texts = (minDepth = 900) => h.S((sc, st, d) => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const c of sc.children.list.filter(o => o.type === 'Container' && o.depth >= d && o.active)) w(c.list); return out; }, minDepth);
const P = (fn, arg) => h.api(fn, arg);
const waitFresh = async () => { await h.page.waitForFunction(() => window.__games?.[0]?.scene?.scenes?.[0]?.__api && window.__games[0].scene.scenes[0].sys.isActive(), null, { timeout: 30000 }); await h.page.waitForTimeout(300); };

console.log('Title screen');
await t('the game opens on the title screen: logo, your engineer, CONTINUE / SAVE FILES / SETTINGS', async () => {
  ok(await titleUp(), 'title up');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('ECE CITY') && tx.includes('CONTINUE') && tx.includes('SAVE FILES') && tx.includes('SETTINGS'), tx);
  ok(tx.includes('File 1 · Level 6'), 'shows the save: ' + tx);
  ok(await h.S(sc => { let hat = false; const w = (l) => { for (const o of l) { if (o.type === 'Image' && o.texture?.key === 'fit_hat_cap' && o.visible) hat = true; if (o.list) w(o.list); } }; w(sc.children.list.filter(o => o.depth === 900)); return hat; }), 'your engineer, in your red cap');
  eq(await h.S((sc, st) => st.paused), true, 'the world waits behind it');
});
await t('taps on the title never reach the board', async () => {
  const n = await h.S((sc, st) => st.nodes.size);
  await h.click(450, 400); await h.click(600, 560);
  eq(await h.S((sc, st) => st.nodes.size), n, 'nothing placed');
});
await t('CONTINUE closes it and the game goes on', async () => {
  await h.tap('title:continue'); await h.page.waitForTimeout(500);
  ok(!(await titleUp()), 'title gone'); eq(await h.S((sc, st) => st.paused), false, 'running');
  eq(await P(a => a.profile.coins), 321, 'your save');
});
await t('PHONE → Settings → Save & title brings it back', async () => {
  await h.btn('TITLE'); await h.page.waitForTimeout(300);
  ok(await titleUp(), 'title up'); eq(await h.S((sc, st) => st.paused), true, 'paused');
});
await t('music: the title song on the title screen, the world\'s song in town', async () => {
  eq(await h.page.evaluate(() => Music.playing), 'title', 'title song');
  await h.tap('title:continue'); await h.page.waitForTimeout(300);
  eq(await h.page.evaluate(() => Music.playing), 'sparkville', 'Sparkville song');
});

console.log('Save files');
await t('SAVE FILES lists three: file 1 (playing) and two empty ones', async () => {
  await h.btn('TITLE'); await h.page.waitForTimeout(300);
  await h.tap('title:play');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('File 1  (playing)') && (tx.match(/empty/g) || []).length === 2, tx);
});
await t('an empty file starts a brand-new game (and file 1 is kept)', async () => {
  await h.tap('slot:2');
  await waitFresh();
  eq(await P(a => a.slot), 2, 'slot 2');
  eq(await P(a => [a.profile.coins, a.profile.xp, a.profile.seenIntro]), [50, 0, false], 'new game');
  eq(await h.page.evaluate(() => localStorage.getItem('ececity.slot')), '2', 'remembered');
  ok(await h.page.evaluate(() => JSON.parse(localStorage.getItem('ececity.save.v1')).coins === 321), 'file 1 untouched');
  // A new player sees the how-to box.
  await h.waitTag('intro:go'); await h.tap('intro:go');
  // ...and a moment later the daily gift chest.
  await h.waitTag('gift:open'); await h.tap('gift:open'); await h.tap('gift:open');
  for (let i = 0; i < 20 && await h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth >= 500 && o.active && !o.isClosing)); i++) await h.page.waitForTimeout(100);
});
await t('after a restart every button works exactly once (no doubled listeners)', async () => {
  // (a brand-new file: finish the first levels so the phone and tools are there)
  await P(a => { for (let i = 1; i <= 6; i++) a.profile.campaign['sparkville-' + i] = 1; a.profile.announced = [...FEATURE_KEYS]; a.refreshBadges(); });
  await h.page.waitForTimeout(500);
  await h.btn('SHOP'); await h.page.waitForTimeout(100);
  eq(await h.S(sc => sc.children.list.filter(o => o.type === 'Container' && o.depth === 500 && o.active).length), 1, 'one shop screen');
  await h.tap('close');
  await h.btn('WIRE'); await h.wireIt('GEN', 'H1');
  const undoBefore = await h.S((sc, st) => st.undoStack.length);
  await h.btn('UNDO');
  eq(await h.S((sc, st) => st.undoStack.length), undoBefore - 1, 'one undo');
});
await t('play a bit in file 2, then switch back to file 1', async () => {
  await P(a => { a.profile.coins = 77; a.save(); });
  await h.btn('TITLE'); await h.page.waitForTimeout(300);
  await h.tap('title:play'); await h.tap('slot:1');
  await waitFresh();
  eq(await P(a => [a.slot, a.profile.coins]), [1, 321], 'file 1 again');
  ok(!(await titleUp()), 'straight into the game');
});
await t('erase a file (with a "are you sure?")', async () => {
  await h.btn('TITLE'); await h.page.waitForTimeout(300);
  await h.tap('title:play');
  ok((await texts()).join(' ').includes('File 2'), 'file 2 has a save');
  await h.tap('erase:2');
  await h.tap('confirm:yes'); await h.page.waitForTimeout(300);
  eq(await h.page.evaluate(() => localStorage.getItem('ececity.save.v1.slot2')), null, 'gone');
  ok(await titleUp(), 'title still up');
  ok(await h.page.evaluate(() => JSON.parse(localStorage.getItem('ececity.save.v1')).coins === 321), 'file 1 untouched');
});

console.log('Settings');
await t('settings from the title: music, sound, Sparky, emergencies', async () => {
  await h.tap('title:settings');
  for (const k of ['music', 'sound', 'sparky', 'emergencies']) ok(await h.tagPos('setting:' + k), k);
  await h.tap('setting:music');
  eq(await h.page.evaluate(() => [Music.enabled, localStorage.getItem('ececity.music')]), [false, '0'], 'music off, remembered');
  await h.tap('setting:emergencies');
  eq(await P(a => a.profile.settings.emergencies), false, 'emergencies off');
  const sp = await P(a => a.profile.settings.sparky);
  await h.tap('setting:sparky');
  eq(await P(a => a.profile.settings.sparky), !sp, 'Sparky flipped');
  await h.tap('setting:sparky');
  await h.tap('setting:sound');
  eq(await h.page.evaluate(() => Sfx.muted), true, 'sound off');
  await h.tap('setting:sound'); await h.tap('setting:music'); await h.tap('setting:emergencies');
  eq(await h.page.evaluate(() => [Music.enabled, Sfx.muted]), [true, false], 'back on');
  await h.tap('close');
});
await t('sound and music live in PHONE → Settings, and are remembered', async () => {
  await h.tap('title:continue'); await h.page.waitForTimeout(300);
  await h.btn('SETTINGS');
  await h.tap('setting:music'); eq(await h.page.evaluate(() => [Music.enabled, localStorage.getItem('ececity.music')]), [false, '0'], 'music off');
  await h.tap('setting:sound'); eq(await h.page.evaluate(() => Sfx.muted), true, 'sound off');
  await h.tap('setting:sound'); await h.tap('setting:music');
  eq(await h.page.evaluate(() => [Music.enabled, Sfx.muted]), [true, false], 'back on');
  await h.tap('close');
});
await t('PHONE → How to play / Settings', async () => {
  await h.btn('HOWTO');
  ok((await texts(500)).join(' ').includes('LEVELS'), 'how-to mentions LEVELS');
  await h.tap('intro:go');
  await h.btn('SETTINGS');
  ok(await h.tagPos('setting:music'), 'settings'); await h.tap('close');
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
