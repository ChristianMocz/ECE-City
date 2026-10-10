// tests/browser/game.e2e.mjs
//
// End-to-end tests for the game layer: orders, coins/XP/levels, shop,
// wardrobe, daily gift + puzzle, Sparky's predictions, weather, storms,
// day/night with solar + batteries, saving, and level locks.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const allErrors = [];
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

function helpers(h) {
  const P = (fn, arg) => h.api(fn, arg);
  const coins = () => P(a => a.profile.coins);
  const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
  const nodes = () => h.S((sc, st) => [...st.nodes.keys()]);
  const screenOpen = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth === 500 && o.active));
  const texts = () => h.S(sc => { const L = sc.children.list.filter(o => o.type === 'Container' && o.depth === 500).pop(); if (!L) return []; const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text') out.push(o.text); if (o.list) w(o.list); } }; w(L.list); return out; });
  const toasts = () => h.S(sc => sc.children.list.filter(o => o.type === 'Text' && o.depth === 650).map(o => o.text));
  const closeScreen = async () => { if (await screenOpen()) await h.tap('close'); };
  // Delete the wire a-b with the DELETE tool (tap its middle).
  // (If Sparky asks, the WIRE tool is picked after the answer — tapping WIRE now would close the question.)
  const cutWire = async (a, b) => { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); if (!(await screenOpen())) await h.btn('WIRE'); };
  const flip = async (id) => { const z = await h.S((sc, st, id) => { const zz = st.nodes.get(id).extraHits[0]; return [zz.x, zz.y]; }, id); await h.click(...z); };
  const clearOrders = () => P(a => { a.profile.orders = [null, null, null]; a.profile.refillAt = [9e15, 9e15, 9e15]; });
  const setOrder = (i, o) => P((a, st, [i, o]) => { o.id = 1000 + i; o.text = 'test order'; a.profile.orders[i] = o; }, [i, o]);
  const gameWait = (ms) => h.page.waitForFunction((ms) => { const sc = window.__games[0].scene.scenes[0]; window.__gw0 ??= sc.time.now; if (sc.time.now - window.__gw0 >= ms) { window.__gw0 = undefined; return true; } return false; }, ms, { polling: 50, timeout: 60000 });
  return { clearOrders, P, coins, lv, nodes, screenOpen, texts, toasts, closeScreen, cutWire, flip, setOrder, gameWait };
}

// ===========================================================================
console.log('A new player');
{
  const h = await open({ seed: null });
  // Stickers pay +10 coins; mark them all collected so these coin sums stay exact (world_e2e tests stickers).
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, lv, texts, screenOpen, closeScreen, toasts, gameWait } = helpers(h);
  await t('starts with 50 coins, level 1, plain blue tee + jeans, Sparky on', async () => {
    eq(await P(a => [a.profile.coins, a.profile.xp, a.profile.wearing, a.profile.settings.sparky]), [50, 0, { hat: null, shirt: 'shirt_blue', pants: 'pants_jeans', acc: null }, true], 'profile');
    eq(await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.text.startsWith('Lv '))?.text), 'Lv 1', 'HUD level');
  });
  await t('the first time, a "how to play" box explains coins and levels', async () => {
    await h.page.waitForFunction(() => { const sc = window.__games[0].scene.scenes[0]; let f = false; const w = (l) => { for (const o of l) { if (o.tag === 'intro:go' && o.active) f = true; if (o.list) w(o.list); } }; w(sc.children.list); return f; }, null, { timeout: 15000 });
    const tx = (await texts()).join(' ');
    ok(tx.includes('Your first house') && tx.includes('LEVELS') && tx.includes('PHONE') && tx.includes('XP'), tx);
    await h.tap('intro:go');
    eq(await P(a => a.profile.seenIntro), true, 'remembered');
    eq(await h.page.evaluate(() => JSON.parse(localStorage.getItem('ececity.save.v1')).seenIntro), true, 'saved');
  });
  await t('the daily gift chest pops up by itself; opening it pays coins (or a decoration)', async () => {
    await h.page.waitForFunction(() => { const sc = window.__games[0].scene.scenes[0]; let f = false; const w = (l) => { for (const o of l) { if (o.tag === 'gift:open' && o.active) f = true; if (o.list) w(o.list); } }; w(sc.children.list); return f; }, null, { timeout: 15000 });
    ok(await h.tagPos('gift:open'), 'gift screen');
    const before = await coins();
    await h.tap('gift:open');
    const r = await P(a => [a.profile.coins, a.profile.daily.giftDay, Object.keys(a.profile.owned.decor)]);
    ok(r[1] === today, 'giftDay today');
    ok(r[0] === before + 20 || r[2].length === 1, 'reward: ' + JSON.stringify(r));
    await h.tap('gift:open'); // "Yay!" closes it
    ok(!(await screenOpen()), 'closed');
  });
  await t('the gift can only be opened once a day', async () => {
    const r = await P(a => { const before = a.profile.coins; a.openGiftScreen(); return before; });
    await h.tap('gift:open');
    eq(await coins(), r, 'no second gift');
    ok((await texts()).includes('Already opened today!'), JSON.stringify(await texts()));
    await closeScreen();
  });
  await t('a brand-new player has every toolbar button and an empty town', async () => {
    const v = await P(a => a.toolbar());
    ok(Object.values(v).every(Boolean), JSON.stringify(v));
    eq(await h.S((sc, st) => [...st.nodes.keys()].sort()), ['GEN', 'GND'], 'empty town');
    // Finish the first six levels (no XP, so we stay at level 1 for the tests below).
    await P(a => { for (let i = 1; i <= 6; i++) a.profile.campaign['sparkville-' + i] = 1; a.profile.announced = [...FEATURE_KEYS]; a.profile.seenFeatures = [...FEATURE_KEYS]; a.refreshBadges(); });
  });
  await t('three orders are waiting and none is already done', async () => {
    const o = await P(a => a.profile.orders.map(o => o && o.kind));
    ok(o.every(Boolean), JSON.stringify(o));
    const c = await coins(); await h.page.waitForTimeout(500); eq(await coins(), c, 'nothing paid out by itself');
  });
  await t('ORDERS screen lists them with their rewards and a Skip button', async () => {
    await h.btn('ORDERS');
    const tx = await texts();
    ok(tx.includes('Power orders') && tx.filter(t => t.includes('"')).length === 3, JSON.stringify(tx));
    ok(await h.tagPos('skip:0'), 'skip button');
    await h.tap('skip:0');
    ok((await texts()).some(t => t.startsWith('A new order arrives in')), JSON.stringify(await texts()));
    eq(await P(a => a.profile.orders[0]), null, 'slot 0 empty');
    await closeScreen();
  });
  await t('BUILD at level 1: houses yes; resistor locked with a level message', async () => {
    await h.btn('BUILD');
    await h.tap('build:RES');
    ok((await toasts()).some(t => t.includes('Resistor unlocks at level 2')), JSON.stringify(await toasts()));
    ok(await screenOpen(), 'menu stays open');
    await h.tap('build:HOUSE');
    eq(await h.S((sc, st) => st.mode), 'PLACE_HOUSE', 'mode');
    await h.btn('WIRE');
  });
  await t('MISSIONS at level 1: mission 3 is locked', async () => {
    await h.btn('MISSIONS_BTN');
    ok((await texts()).includes('Unlocks at level 2'), JSON.stringify(await texts()));
    await h.tap('choice:2');
    ok((await h.status()).startsWith('Mission 3 unlocks at level 2'), await h.status());
    eq(await h.S((sc, st) => st.context), 'town', 'still in town');
  });
  await t('a light order: wiring the building pays coins + XP and the slot refills later', async () => {
    await P(a => a.loadTown(STARTER_TOWN)); // three houses to light
    await helpers(h).clearOrders();
    await P(a => { a.profile.settings.sparky = false; });
    await helpers(h).setOrder(1, { kind: 'light', target: 'H1', name: 'house H1', who: 'Mr. Patel', coins: 12, xp: 10 });
    const before = await P(a => [a.profile.coins, a.profile.xp]);
    await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
    eq(await lv('H1'), 'ON', 'lit');
    const after = await P(a => [a.profile.coins, a.profile.xp, a.profile.orders[1], a.profile.refillAt[1] - Date.now(), a.profile.ordersDone]);
    eq([after[0] - before[0], after[1] - before[1], after[2], after[4]], [12, 10, null, 1], 'paid');
    ok(after[3] > 9000 && after[3] <= 12000, 'refill in ~12s: ' + after[3]);
    ok((await h.status()).startsWith('Order done! Mr. Patel says thank you'), await h.status());
    ok((await toasts()).some(t => t.startsWith('+12 coins')), JSON.stringify(await toasts()));
  });
  await t('reaching 40 XP levels up to 2 with a party naming the unlocks', async () => {
    await P(a => { a.profile.xp = 35; });
    await helpers(h).setOrder(2, { kind: 'light', target: 'H2', name: 'house H2', who: 'Ms. Bell', coins: 12, xp: 10 });
    await h.wireIt('GEN', 'H2'); await h.wireIt('H2b', 'GND');
    await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__status.text.startsWith('Level 2!'), null, { timeout: 20000 });
    eq(await P(a => levelForXp(a.profile.xp)), 2, 'level');
    ok((await h.status()).startsWith('Level 2! You unlocked: Resistor, LED, Park lights, Bakery, Twinkly tree, Mission 3'), await h.status());
    ok(await h.S(sc => sc.children.list.some(o => o.depth === 401 && o.bubbleText?.text.includes('Level 2'))), 'celebration');
    eq(await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.text.startsWith('Lv '))?.text), 'Lv 2', 'HUD');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log('Shop, buildings, decorations, clothes');
{
  const h = await open({ seed: { coins: 70, xp: 40 } }); // level 2
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, lv, texts, screenOpen, closeScreen, toasts, nodes } = helpers(h);
  await t('the shop shows prices and locks; a locked building says why', async () => {
    await h.btn('SHOP');
    ok((await texts()).includes('Bakery') && (await texts()).includes('Level 4'), JSON.stringify(await texts()));
    await h.tap('shop:building:school');
    ok((await toasts()).includes('Unlocks at level 4.'), JSON.stringify(await toasts()));
    eq(await coins(), 70, 'no charge');
  });
  await t('buying the bakery costs 60 and lets you place it on the grass', async () => {
    await h.tap('shop:building:bakery');
    eq(await coins(), 10, 'coins');
    eq(await h.S((sc, st) => [st.mode, st.placeBuilding]), ['PLACE_BUILDING', 'bakery'], 'mode');
    await h.click(300, 470);
    const b = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.data?.building === 'bakery').map(n => [n.id, n.data.R, n.data.vOn]));
    eq(b, [['H3', 9, 9]], 'bakery placed');
    eq(await h.S((sc, st) => st.mode), 'WIRE', 'back to WIRE (none left)');
    ok(await h.S((sc, st) => st.nodes.get('H3').visual.body.texture.key) === 'bld_bakery', 'bakery art');
  });
  await t('not enough coins: a clear message and nothing taken', async () => {
    await h.btn('SHOP'); await h.tap('shop:building:park');
    ok((await toasts()).includes('You need 40 more coins.'), JSON.stringify(await toasts()));
    eq(await coins(), 10, 'coins');
    await closeScreen();
  });
  await t('the bakery draws twice a cottage\'s power (bigger oven)', async () => {
    await h.wireIt('GEN', 'H3'); await h.wireIt('H3b', 'GND');
    const I = await h.S((sc, st) => [st.powered.get('H3').I, st.powered.get('H0').I]);
    ok(I[0] > 1.8 * I[1], JSON.stringify(I));
    eq(await lv('H3'), 'ON', 'bakery lit');
  });
  await t('deleting the bakery puts it back in your BUILD box', async () => {
    await h.btn('DELETE'); await h.click(300, 450);
    ok(!(await nodes()).includes('H3'), 'gone');
    ok((await h.status()).startsWith('The bakery went back in your BUILD box'), await h.status());
    await h.btn('BUILD');
    ok((await texts()).includes('1 to place'), JSON.stringify(await texts()));
    await h.tap('build:B:bakery');
    await h.click(300, 470);
    ok(await h.S((sc, st) => [...st.nodes.values()].some(n => n.data?.building === 'bakery')), 'placed again');
  });
  await t('decorations: buy flowers, place them, DELETE puts them back', async () => {
    await P(a => { a.profile.coins = 30; });
    await h.btn('SHOP'); await h.tap('shoptab:decor'); await h.tap('shop:decor:flowers');
    eq(await coins(), 20, 'coins');
    eq(await h.S((sc, st) => st.mode), 'PLACE_DECOR', 'mode');
    await h.click(560, 560);
    eq(await P(a => a.profile.decorPlaced), [{ key: 'flowers', x: 560, y: 560, region: 'sparkville' }], 'placed');
    ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'decor_flowers' && o.depth === 5)), 'drawn');
    await h.btn('DELETE'); await h.click(560, 560);
    eq(await P(a => a.profile.decorPlaced), [], 'removed');
    ok((await h.status()).includes('went back in your BUILD box'), await h.status());
    await h.btn('BUILD'); await h.tap('build:D:flowers'); await h.click(600, 560);
    eq(await P(a => a.profile.decorPlaced.length), 1, 'placed again');
  });
  await t('tapping the little engineer opens CLOTHES; buying a cap puts it on', async () => {
    await P(a => { a.profile.coins = 100; });
    await h.click(843, 60);
    ok((await texts()).includes('Clothes'), JSON.stringify(await texts()));
    await h.tap('outfit:hat_cap');
    eq(await P(a => [a.profile.coins, a.profile.wearing.hat, a.profile.owned.outfits.includes('hat_cap')]), [75, 'hat_cap', true], 'bought + wearing');
    ok(await h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth === 201 && o.list.some(i => i.texture?.key === 'fit_hat_cap' && i.visible))), 'HUD engineer wears it');
  });
  await t('tapping it again takes it off for free; again puts it back on', async () => {
    await h.tap('outfit:hat_cap');
    eq(await P(a => [a.profile.coins, a.profile.wearing.hat]), [75, null], 'off');
    await h.tap('outfit:hat_cap');
    eq(await P(a => [a.profile.coins, a.profile.wearing.hat]), [75, 'hat_cap'], 'on again');
  });
  await t('a locked outfit says which level, and costs nothing', async () => {
    await h.tap('outfit:hat_crown');
    ok((await toasts()).includes('Unlocks at level 6.'), JSON.stringify(await toasts()));
    eq(await coins(), 75, 'coins');
    await closeScreen();
  });
  await t('CLOTHES button opens the same wardrobe', async () => {
    await h.btn('CLOTHES'); ok((await texts()).includes('Clothes'), 'open'); await closeScreen();
  });
  await t('everything survives a reload: coins, clothes, bakery, wires, decor', async () => {
    await h.page.waitForTimeout(2500); // autosave
    const before = await h.S((sc, st) => JSON.stringify([st.wires.map(w => [w.a, w.b]).sort(), [...st.nodes.values()].filter(n => n.data?.role === 'primary').map(n => [n.id, n.data.building, Math.round(n.container.x), Math.round(n.container.y)])]));
    const prof = await P(a => JSON.stringify([a.profile.coins, a.profile.wearing, a.profile.decorPlaced]));
    await h.page.reload();
    await h.page.waitForFunction(() => window.__games?.[0]?.scene?.scenes?.[0]?.__api);
    await h.page.waitForTimeout(400);
    const after = await h.S((sc, st) => JSON.stringify([st.wires.map(w => [w.a, w.b]).sort(), [...st.nodes.values()].filter(n => n.data?.role === 'primary').map(n => [n.id, n.data.building, Math.round(n.container.x), Math.round(n.container.y)])]));
    eq(after, before, 'town');
    eq(await P(a => JSON.stringify([a.profile.coins, a.profile.wearing, a.profile.decorPlaced])), prof, 'profile');
    ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'decor_flowers')), 'decor drawn');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log("Sparky's predict-then-test");
{
  const h = await open({ seed: { coins: 0, xp: 0, settings: { sparky: true } } });
  // Stickers pay +10 coins; mark them all collected so these coin sums stay exact (world_e2e tests stickers).
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, lv, texts, screenOpen, cutWire, flip } = helpers(h);
  const reset = () => P(a => a.resetAskCooldown());
  await helpers(h).clearOrders();
  const rank = { OFF: 0, BURNED: 0, DIM: 1, ON: 2 };
  // The question on screen: which part, and the right answer for `change`.
  const question = async (change) => {
    const q = (await texts()).find(t => t.startsWith('Before you do that'));
    const m = q && q.match(/will (?:house |LED )?(\w+)/);
    if (!m) return null;
    const target = m[1];
    const now = await h.S((sc, st, t) => st.powered.get(t)?.level ?? 'OFF', target);
    const after = (await P((a, st, c) => a.levelsWith(c), change))[target];
    const right = rank[after] > rank[now] ? 'brighter' : rank[after] < rank[now] ? 'dimmer' : 'same';
    return { target, now, after, right, wrong: right === 'same' ? 'brighter' : 'same' };
  };
  await t('a wire that changes nothing visible gets no question', async () => {
    await h.wireIt('GEN', 'H1'); // H1 still has no way home
    ok(!(await screenOpen()), 'no question');
    eq(await h.S((sc, st) => st.wires.length), 3, 'wired at once');
  });
  let q1;
  await t('a wire that changes something: Sparky asks first, the wire waits', async () => {
    await h.wireIt('H1b', 'GND');
    q1 = await question({ addWire: ['H1b', 'GND'] });
    ok(q1, JSON.stringify(await texts()));
    ok(['H0', 'H1', 'H2'].includes(q1.target), q1.target); // a 'same' question may be about any building
    eq(await h.S((sc, st) => st.wires.length), 3, 'not wired yet');
    eq(await lv('H1'), 'OFF', 'still dark while asking');
  });
  await t('a right guess: the wire goes in, +5 coins, streak 1, and the real result matches', async () => {
    await h.tap('predict:' + q1.right);
    eq(await h.S((sc, st) => st.wires.length), 4, 'wired');
    eq(await lv('H1'), 'ON', 'H1 lit');
    eq(await lv(q1.target), q1.after, 'prediction matched reality');
    eq(await P(a => [a.profile.coins, a.profile.streak]), [5, 1], 'paid');
    ok((await h.status()).startsWith('Right! '), await h.status());
    ok(await h.S(sc => sc.children.list.some(o => o.depth === 302 && o.bubbleText?.text.startsWith('Right!'))), 'bubble');
  });
  await t('Sparky waits a while before asking again', async () => {
    await h.wireIt('GEN', 'H2');
    await h.wireIt('H2b', 'GND');
    ok(!(await screenOpen()), 'no question during cooldown');
    eq(await h.S((sc, st) => st.wires.length), 6, 'wired straight away');
  });
  await t('a wrong guess: one-line explanation, streak resets, no coins taken', async () => {
    await reset();
    await cutWire('H2b', 'GND');
    const q = await question({ removeWire: ['H2b', 'GND'] });
    ok(q, 'asked');
    await h.tap('predict:' + q.wrong); await h.btn('WIRE');
    eq(await P(a => [a.profile.coins, a.profile.streak]), [5, 0], 'no coins lost, streak reset');
    ok((await h.status()).startsWith('Not quite! '), await h.status());
    ok(/^Not quite! (Brighter|Dimmer|Same)( \(\d+\.\d V → \d+\.\d V\))? — /.test(await h.status()), 'explains the real answer');
    eq(await h.S((sc, st) => st.wires.length), 5, 'the change still happened');
  });
  await t('"skip question" still makes the change and keeps the streak', async () => {
    await P(a => { a.profile.streak = 2; }); await reset();
    await h.wireIt('H2b', 'GND');
    ok(await question({ addWire: ['H2b', 'GND'] }), 'asked');
    await h.tap('predict:skip');
    eq(await h.S((sc, st) => st.wires.length), 6, 'wired');
    eq(await P(a => a.profile.streak), 2, 'streak kept');
    ok((await h.status()).startsWith('No guess this time'), await h.status());
  });
  await t('tapping outside the question counts as a skip', async () => {
    await reset();
    await cutWire('H2b', 'GND');
    ok(await question({ removeWire: ['H2b', 'GND'] }), 'asked');
    await h.click(450, 610); await h.btn('WIRE');
    ok(!(await screenOpen()), 'closed');
    eq(await h.S((sc, st) => st.wires.length), 5, 'wire removed anyway');
  });
  await t('three right in a row doubles the coins (×2 on the HUD)', async () => {
    await P(a => { a.profile.coins = 0; }); await reset();
    await h.wireIt('H2b', 'GND');
    const q = await question({ addWire: ['H2b', 'GND'] });
    await h.tap('predict:' + q.right);
    eq(await P(a => [a.profile.streak, a.profile.coins]), [3, 10], '×2 coins');
    eq(await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.text === '×2')?.text), '×2', 'HUD multiplier');
  });
  await t('the streak multiplier also doubles order pay', async () => {
    await P(a => { a.profile.settings.sparky = false; a.profile.coins = 0; a.profile.orders[0] = { kind: 'lightN', n: 1, coins: 12, xp: 10, id: 999, text: 't' }; });
    await h.page.waitForTimeout(300);
    eq(await P(a => a.profile.coins), 24, 'doubled');
  });
  await t('the toggle turns Sparky off, and it is saved', async () => {
    await P(a => { a.profile.settings.sparky = true; a.resetAskCooldown(); });
    await h.click(60, 115);
    eq(await P(a => a.profile.settings.sparky), false, 'off');
    await cutWire('H2b', 'GND');
    ok(!(await screenOpen()), 'no question');
    eq(await h.page.evaluate(() => JSON.parse(localStorage.getItem('ececity.save.v1')).settings.sparky), false, 'saved');
    await h.wireIt('H2b', 'GND');
  });
  await t('flipping a switch is asked about too', async () => {
    await P(a => { a.profile.xp = 100; });
    await h.btn('SWITCH'); await h.click(300, 470); await h.btn('WIRE');
    await cutWire('GEN', 'H2');
    await h.wireIt('GEN', 'T0'); await h.wireIt('T0b', 'H2');
    eq(await lv('H2'), 'ON', 'lit through the switch');
    await h.click(60, 115); await reset();
    await flip('T0');
    const q = await question({ flip: 'T0' });
    ok(q, 'asked');
    eq(await h.S((sc, st) => st.nodes.get('T0').data.on), true, 'not flipped yet');
    await h.tap('predict:' + q.right);
    eq(await h.S((sc, st) => st.nodes.get('T0').data.on), false, 'flipped');
    eq(await lv(q.target), q.after, 'matched');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log('Daily puzzle');
{
  const h = await open({ seed: { coins: 0, xp: 0 } });
  // Stickers pay +10 coins; mark them all collected so these coin sums stay exact (world_e2e tests stickers).
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, texts, closeScreen, cutWire, flip } = helpers(h);
  const runSolution = async (sol) => { for (const [op, a, b] of sol) { if (op === 'wire') await h.wireIt(a, b); else if (op === 'unwire') await cutWire(a, b); else await flip(a); } };
  let townBefore;
  await t('DAILY shows weather, gift, today\'s puzzle and streaks', async () => {
    townBefore = await h.S((sc, st) => JSON.stringify(st.wires.map(w => [w.a, w.b])));
    await h.btn('DAILY');
    const tx = await texts();
    ok(tx.some(t => t.startsWith('Weather: ')) && tx.some(t => t.startsWith('Daily puzzle: ')) && tx.some(t => t.startsWith('Puzzle streak: 0 days')), JSON.stringify(tx));
  });
  await t('Play! loads today\'s puzzle (clock paused, banner shows the goal)', async () => {
    await h.tap('daily:play');
    eq(await h.S((sc, st) => st.context), 'daily', 'context');
    const idx = await h.S((sc, st) => st.daily.index);
    eq(idx, await h.page.evaluate(() => puzzleIndexFor(new Date(), DAILY_PUZZLES.length)), 'today');
    ok((await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.x === 20 && o.y === 6)?.text)).startsWith('☀ Daily puzzle: '), 'banner');
    ok((await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.text.includes('Clock paused')))) !== undefined, 'clock paused');
  });
  await t('? HINT gives the puzzle hint', async () => {
    await h.btn('HINT_BTN');
    eq(await h.status(), await h.page.evaluate(() => DAILY_PUZZLES[puzzleIndexFor(new Date(), DAILY_PUZZLES.length)].hint), 'hint');
  });
  await t('solving it pays 45 coins + 25 XP and starts a 1-day puzzle streak', async () => {
    await runSolution(await h.page.evaluate(() => DAILY_PUZZLES[puzzleIndexFor(new Date(), DAILY_PUZZLES.length)].solution));
    await h.page.waitForTimeout(300);
    eq(await P(a => [a.profile.coins, a.profile.xp, a.profile.daily.puzzleStreak, a.profile.daily.puzzleDay]), [45, 25, 1, today], 'reward');
    ok((await h.status()).startsWith("You solved today's puzzle! +45 coins"), await h.status());
  });
  await t('"Back to my town" brings your town back exactly', async () => {
    await h.btn('DAILY'); await h.tap('daily:back');
    eq(await h.S((sc, st) => st.context), 'town', 'context');
    eq(await h.S((sc, st) => JSON.stringify(st.wires.map(w => [w.a, w.b]))), townBefore, 'town');
  });
  await t('playing again today: fun, but no second reward', async () => {
    await h.btn('DAILY'); ok((await texts()).some(t => t.includes('solved today ✓')), 'marked solved');
    await h.tap('daily:play');
    await runSolution(await h.page.evaluate(() => DAILY_PUZZLES[puzzleIndexFor(new Date(), DAILY_PUZZLES.length)].solution));
    await h.page.waitForTimeout(300);
    eq(await coins(), 45, 'no extra coins');
    ok((await h.status()).startsWith('Solved again'), await h.status());
    await h.api(a => a.backToTown());
  });
  await t('every one of the 12 puzzles can be solved by tapping (UI), none starts solved', async () => {
    for (let i = 0; i < 12; i++) {
      await h.api((a, st, i) => a.startDaily(i), i);
      const pz = await h.page.evaluate((i) => ({ sol: DAILY_PUZZLES[i].solution, title: DAILY_PUZZLES[i].title }), i);
      eq(await h.S((sc, st) => st.daily.done), false, pz.title + ' starts unsolved');
      await runSolution(pz.sol);
      await h.page.waitForTimeout(200);
      eq(await h.S((sc, st) => st.daily.done), true, pz.title + ' solved by UI');
    }
    await h.api(a => a.backToTown());
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log('Weather, storms, day and night, solar and batteries');
{
  const h = await open({ seed: { coins: 0 } }); // level 10: everything unlocked
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, lv, texts, toasts, closeScreen, cutWire, setOrder } = helpers(h);
  await t('a storm knocks down a busy line: dashed red marker, badge, no UNDO', async () => {
    await P(a => a.setWeather('storm'));
    const r = await P(a => a.triggerStorm());
    eq(r, true, 'struck');
    const rep = await P(a => a.profile.repair);
    ok(rep && ['GEN', 'H0', 'H0b', 'GND'].includes(rep.a), JSON.stringify(rep));
    eq(await h.S((sc, st) => st.wires.length), 1, 'one wire left');
    eq(await lv('H0'), 'OFF', 'H0 went dark');
    ok((await h.status()).startsWith('⚡ Lightning knocked down the power line'), await h.status());
    await h.btn('UNDO'); eq(await h.status(), 'Nothing to undo yet.', 'undo blocked');
    await h.page.waitForTimeout(1500);
    ok((await P(a => a.badges())).today, 'a badge on TODAY (the storm repair)');
  });
  await t('only one storm strike per day', async () => {
    eq(await P(a => a.triggerStorm()), false, 'second strike blocked');
  });
  await t('the ORDERS screen and ? HINT explain the repair', async () => {
    await h.btn('ORDERS'); ok((await texts()).some(t => t.startsWith('Storm damage!')), JSON.stringify(await texts())); await closeScreen();
    await h.btn('HINT_BTN'); ok((await h.status()).startsWith('Storm damage!'), await h.status());
  });
  await t('reconnecting the same two dots fixes it: +25 coins, +15 XP', async () => {
    const rep = await P(a => a.profile.repair);
    await h.wireIt(rep.a, rep.b);
    eq(await P(a => [a.profile.repair, a.profile.coins]), [null, 25], 'paid');
    eq(await lv('H0'), 'ON', 'lit again');
    ok((await h.status()).startsWith('You fixed the storm damage!'), await h.status());
  });
  await t('rain falls on stormy days, and stops when the weather is fair', async () => {
    await h.page.waitForTimeout(500);
    ok(await h.S(sc => sc.children.list.filter(o => o.type === 'Rectangle' && o.width === 2 && o.height === 9 && o.alpha > 0).length > 30), 'rain');
    await P(a => a.setWeather('normal')); await h.page.waitForTimeout(500);
    ok(await h.S(sc => !sc.children.list.some(o => o.type === 'Rectangle' && o.width === 2 && o.height === 9 && o.alpha > 0)), 'no rain');
  });
  await t('the clock runs in town and night falls on its own', async () => {
    await P(a => { a.state.clockFrozen = false; a.state.clock = 159.5; });
    await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].__state.night, null, { timeout: 20000 });
    ok(await h.S(sc => sc.children.list.some(o => o.type === 'Text' && o.text.includes('Morning in'))), 'clock text');
    await P(a => { a.state.clockFrozen = true; });
  });
  await t('at night buildings draw more: 3 houses that were bright go dim', async () => {
    await P(a => { a.state.clock = 10; }); await h.page.waitForTimeout(400);
    await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND'); await h.wireIt('GEN', 'H2'); await h.wireIt('H2b', 'GND');
    eq([await lv('H0'), await lv('H1'), await lv('H2')], ['ON', 'ON', 'ON'], 'day');
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
    eq(await h.S((sc, st) => [st.night, st.loadScale]), [true, 0.7], 'night');
    eq([await lv('H0'), await lv('H1'), await lv('H2')], ['DIM', 'DIM', 'DIM'], 'night');
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
    eq(await lv('H0'), 'ON', 'morning');
  });
  await t('a heat wave raises demand too', async () => {
    await P(a => a.setWeather('heat'));
    eq(await h.S((sc, st) => st.loadScale), 0.8, 'loadScale');
    eq(await h.S((sc, st) => st.solarFactor), 1.3, 'solar');
    await P(a => a.setWeather('normal'));
  });
  await t('a solar panel lights a building on its own in the day — not at night', async () => {
    await cutWire('GEN', 'H2'); await cutWire('H2b', 'GND');
    await h.btn('SOLAR'); await h.click(560, 470); await h.btn('WIRE');
    await h.wireIt('S0', 'H2'); await h.wireIt('H2b', 'S0b');
    eq(await lv('H2'), 'ON', 'sunny day');
    ok(await h.S((sc, st) => st.nodes.get('S0').visual.sunLabel.text === '100% sun'), 'sun label');
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
    eq(await lv('H2'), 'OFF', 'night: no sun');
    ok(await h.S((sc, st) => st.nodes.get('S0').visual.sunLabel.text === 'no sun'), 'no-sun label');
    await h.click(...await h.S((sc, st) => { const b = st.nodes.get('H2').container.getBounds(); return [b.centerX, b.centerY]; }));
    await h.page.waitForTimeout(200);
    ok((await h.status()).includes("it's night — no sunshine"), await h.status());
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
  });
  await t('sunny weather boosts solar; clouds cut it', async () => {
    await P(a => a.setWeather('sunny')); eq(await h.S((sc, st) => st.solarFactor), 1.6, 'sunny');
    await P(a => a.setWeather('cloudy')); eq(await h.S((sc, st) => st.solarFactor), 0.5, 'cloudy');
    eq(await lv('H2'), 'DIM', 'dimmer under clouds');
    await P(a => a.setWeather('normal'));
  });
  await t('a battery charged in the day keeps a building lit at night (SKIP TIME charges it)', async () => {
    await h.btn('BAT'); await h.click(780, 470); await h.btn('WIRE');
    await h.wireIt('GEN', 'B0'); await h.wireIt('B0b', 'GND');
    await h.wireIt('B0', 'H1');
    const charge0 = await h.S((sc, st) => st.nodes.get('B0').data.Vprev);
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
    const charge1 = await h.S((sc, st) => st.nodes.get('B0').data.Vprev);
    ok(charge1 > 10 && charge1 > charge0, `charged ${charge0} -> ${charge1}`);
    ok(await h.S((sc, st) => st.nodes.get('B0').visual.voltLabel.text.endsWith('%')), 'battery % label');
    const c0 = await coins();
    // The battery could carry H1 alone now, so the order pays even with GEN still wired.
    await setOrder(0, { kind: 'nightBattery', target: 'H1', name: 'house H1', who: 'Dr. Reyes', coins: 50, xp: 40 });
    await h.page.waitForTimeout(300);
    eq((await coins()) - c0, 50, 'night-battery order paid');
    // unplug GEN from everything: the battery alone runs H1 (its blue dot reaches B0b through GND)
    await cutWire('GEN', 'B0'); await cutWire('GEN', 'H1'); await cutWire('GEN', 'H0');
    eq(await h.S((sc, st) => st.genAmps < 0.001), true, 'GEN idle');
    eq(await lv('H1'), 'ON', 'battery-powered at night');
  });
  await t('a battery drains over the night (it is real stored energy)', async () => {
    const v0 = await h.S((sc, st) => st.nodes.get('B0').data.Vprev);
    await P(a => { a.state.clockFrozen = true; });
    await h.page.waitForTimeout(3000);
    const v1 = await h.S((sc, st) => st.nodes.get('B0').data.Vprev);
    ok(v1 < v0, `${v0} -> ${v1}`);
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log('Storms on their own');
{
  const h = await open({ seed: { coins: 0 } });
  // Stickers pay +10 coins; mark them all collected so these coin sums stay exact (world_e2e tests stickers).
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, closeScreen } = helpers(h);
  await t('on a stormy day lightning waits while a menu is open...', async () => {
    await P(a => { a.setWeather('storm'); a.state.clock = 300; a.state.clockFrozen = false; });
    await h.btn('SHOP');
    await h.page.waitForTimeout(7000);
    eq(await P(a => a.profile.repair), null, 'no strike while the shop is open');
  });
  await t('...and strikes a busy line once things are calm', async () => {
    await closeScreen();
    await h.page.waitForFunction(() => !!window.__games[0].scene.scenes[0].__profile.repair, null, { timeout: 20000 });
    const r = await P(a => a.profile.repair);
    ok(['GEN', 'H0', 'H0b', 'GND'].includes(r.a), JSON.stringify(r));
  });
  await t('not again in the same day', async () => {
    const rep = await P(a => a.profile.repair);
    await h.wireIt(rep.a, rep.b);
    eq(await P(a => a.profile.repair), null, 'fixed');
    await h.page.waitForTimeout(8000);
    eq(await P(a => a.profile.repair), null, 'no second strike');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

// ===========================================================================
console.log('Missions and contexts');
{
  const h = await open({ seed: { coins: 0, xp: 0 } });
  // Stickers pay +10 coins; mark them all collected so these coin sums stay exact (world_e2e tests stickers).
  await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; });
  const { P, coins, texts, closeScreen } = helpers(h);
  await t('first-time mission win pays 30 coins + 30 XP; repeating pays nothing', async () => {
    await h.btn('MISSIONS_BTN'); await h.tap('choice:0');
    await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
    await h.page.waitForTimeout(400);
    eq(await P(a => [a.profile.coins, a.profile.xp]), [30, 30], 'reward');
    await h.btn('MISSIONS_BTN'); await h.tap('choice:0');
    await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
    await h.page.waitForTimeout(400);
    eq(await P(a => [a.profile.coins, a.profile.xp]), [30, 30], 'no repeat reward');
  });
  await t('orders do not progress (or pay) while you are in a mission', async () => {
    await P(a => { a.profile.orders[0] = { kind: 'lightN', n: 1, coins: 6, xp: 5, id: 77, text: 't' }; });
    await h.page.waitForTimeout(300);
    eq(await P(a => a.profile.orders[0]?.id), 77, 'still waiting');
    eq(await coins(), 30, 'unpaid');
  });
  await t('buying in a mission keeps the item for your town', async () => {
    await P(a => { a.profile.coins = 100; a.profile.xp = 40; });
    await h.btn('SHOP'); await h.tap('shop:building:bakery');
    ok((await h.status()).includes("waiting in + BUILD back in your town"), await h.status());
    eq(await h.S((sc, st) => st.mode), 'WIRE', 'no placement in a mission');
  });
  await t('back in town the order pays at once (a lit building was there all along)', async () => {
    await h.btn('MISSIONS_BTN'); await h.tap('choice:5');
    eq(await h.S((sc, st) => st.context), 'town', 'town');
    await h.page.waitForTimeout(300);
    eq(await coins(), 40 + 6, 'order paid');
  });
  await t('SKIP TIME outside the town explains why it does nothing', async () => {
    await h.btn('MISSIONS_BTN'); await h.tap('choice:1');
    await h.btn('SKIP'); ok((await h.status()).startsWith('Time only passes in your town'), await h.status());
    eq(await h.S((sc, st) => st.night), false, 'day');
    await h.btn('MISSIONS_BTN'); await h.tap('choice:5');
  });
  await t('a broken or junk save loads as a fresh game without errors', async () => {
    await h.page.addInitScript(() => { if (sessionStorage.getItem('junk')) return; sessionStorage.setItem('junk', '1'); localStorage.setItem('ececity.save.v1', '{"coins":"lots","town":{"parts":[{"kind":"NOPE","x":1,"y":2},{"kind":"HOUSE","id":"H9","x":400,"y":300}],"wires":[{"a":"GEN","b":"H9"},{"a":"GEN","b":"ZZZ"}],"counters":{}},"wearing":{"hat":"hat_crown"},"seenIntro":true}'); });
    await h.page.reload();
    await h.page.waitForFunction(() => window.__games?.[0]?.scene?.scenes?.[0]?.__api);
    await h.page.waitForTimeout(300);
    eq(await P(a => [a.profile.coins, a.profile.wearing.hat]), [50, null], 'sanitized');
    eq(await h.S((sc, st) => [[...st.nodes.keys()].sort(), st.wires.map(w => w.a + '-' + w.b)]), [['GEN', 'GND', 'H9', 'H9b'], ['GEN-H9']], 'good bits kept');
    // (a fresh game: + BUILD isn't unlocked yet, so place a house the way BUILD would)
    await P(a => a.openBuild()); await h.tap('build:HOUSE'); await h.click(700, 470);
    ok(await h.S((sc, st) => st.nodes.has('H0')), 'new ids continue fine');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  allErrors.push(...h.errors);
  await h.browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
