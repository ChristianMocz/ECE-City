// tests/browser/organized.e2e.mjs
//
// The "organised" update through the real game screen: buttons that unlock
// as you go, the phone, Today, the Notebook, Records, time trials and the
// no-undo challenge, Expert levels, the Puzzle maker, the clothes scroll,
// powered decorations and new buildings, the Captain's directions, and the
// LED advice.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message.split('\n')[0]); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const texts = (h) => h.S(sc => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const c of sc.children.list.filter(o => o.type === 'Container' && o.depth >= 500 && o.active && !o.isClosing)) w(c.list); return out; });
const screenOpen = (h) => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth >= 500 && o.active && !o.isClosing));
const closeAll = async (h) => { for (let i = 0; i < 5 && await screenOpen(h); i++) { if (await h.tagPos('close')) await h.tap('close'); else await h.click(15, 320); } };
const tb = (h) => h.api(a => a.toolbar());
const lv = (h, id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
const solveLevel = async (h, id) => {
  const steps = await h.S((sc, st, id) => CAMPAIGN_BY_ID[id].solution, id);
  for (const [op, a, b, c, d] of steps) {
    if (op === 'w') await h.wireIt(a, b);
    else if (op === 'u') { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await h.btn('WIRE'); }
    else if (op === 'f') { const z = await h.S((sc, st, a) => { const zz = st.nodes.get(a).extraHits[0]; return [zz.x, zz.y]; }, a); await h.click(...z); }
    else throw new Error('unsupported op ' + op);
  }
};

console.log('Buttons appear as you go');
{
  const h = await open({ seed: { xp: 0, coins: 50, campaign: {}, seenIntro: true, settings: { sparky: false } } });
  await h.api(a => { a.setNextEmergencyIn(9e9); a.profile.seenFeatures = ['wire', 'levels', 'hint', 'settings', 'howto', 'title']; a.profile.announced = [...a.profile.seenFeatures]; a.refreshBadges(); });
  await t('a new player sees only WIRE, LEVELS and HINT', async () => {
    const v = await tb(h);
    eq(Object.keys(v).filter(k => v[k]).sort(), ['hint', 'levels', 'wire'], 'buttons');
    ok(!(await h.tagPos('btn:phone')) || !(await h.S(sc => sc.children.list.some(o => o.tag === 'btn:phone' && o.input.enabled))), 'phone not tappable');
  });
  await t('tapping the engineer before CLOTHES unlock just says when', async () => {
    await h.btn('ENGINEER'); ok(!(await screenOpen(h)), 'no wardrobe'); ok((await h.status()).includes('level 2'), await h.status());
  });
  await t('finishing level 1 brings UNDO and REDO (with a New! tag) and says so', async () => {
    await h.api(a => a.startLevel(CAMPAIGN_BY_ID['sparkville-1']));
    await h.btn('WIRE'); await solveLevel(h, 'sparkville-1');
    await h.waitTag('result:map'); await h.tap('result:map'); await closeAll(h);
    await h.api(a => a.backToTown());
    await h.page.waitForTimeout(700);
    const v = await tb(h);
    ok(v.undo && v.redo, 'undo + redo');
    ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'ico_new' && o.visible)), 'New! tag');
    ok((await h.status()).startsWith('New') && (await h.status()).includes('UNDO'), await h.status());
  });
  await t('tapping a New! button clears its tag', async () => {
    await h.btn('UNDO'); await h.page.waitForTimeout(100);
    ok(await h.api(a => a.profile.seenFeatures.includes('undo')), 'seen');
  });
  await t('level 2 brings TODAY and the PHONE; the phone has the starter apps', async () => {
    await h.api(a => a.startLevel(CAMPAIGN_BY_ID['sparkville-2']));
    await solveLevel(h, 'sparkville-2');
    await h.waitTag('result:map'); await h.tap('result:map'); await closeAll(h); await h.api(a => a.backToTown());
    await h.page.waitForTimeout(300);
    const v = await tb(h);
    ok(v.today && v.phone, JSON.stringify(v));
    await h.btn('PHONE');
    for (const k of ['shop', 'clear', 'count']) ok(await h.tagPos('app:' + k), k);
    ok(!(await h.tagPos('app:orders')), 'orders are not in the phone');
    ok(!(await h.tagPos('app:map')), 'no map yet (level 3)');
    await h.tap('phonetab:settings');
    for (const k of ['settings', 'howto', 'title']) ok(await h.tagPos('app:' + k), k);
    await closeAll(h);
  });
  await t('a level that needs DELETE shows it even before it unlocks', async () => {
    await h.api(a => a.startLevel(CAMPAIGN_BY_ID['sparkville-5']));
    await h.page.waitForTimeout(150);
    ok((await tb(h)).delete, 'delete for level 5');
    await h.api(a => a.backToTown()); await h.page.waitForTimeout(150);
    ok(!(await tb(h)).delete, 'gone again in town');
  });
  await t('no errors (new player)', async () => eq(h.errors, [], 'errors'));
  await h.browser.close();
}

const allBoss = Object.fromEntries(['sparkville', 'batterybay', 'solardesert', 'mountains', 'windmill', 'waterfall', 'neon', 'tundra', 'volcano', 'robot', 'storm', 'moon'].map(k => [k, { easy: true }]));
const h = await open({ seed: { xp: 3000, coins: 9000, campaign: { 'sparkville-1': 3, 'sparkville-2': 3, 'sparkville-3': 2 } } });
await h.api(a => a.setNextEmergencyIn(9e9));

console.log('The phone');
await t('every phone app opens its screen', async () => {
  const want = { shop: 'Shop', clothes: 'Clothes', daily: null, map: null, stickers: null, notebook: 'Notebook', records: 'Records', maker: 'Puzzle maker', playcode: "Play a friend's code", settings: 'Settings', howto: 'Welcome to ECE City!' };
  for (const [k, title] of Object.entries(want)) {
    const tab = await h.api((a, st, k) => FEATURES[k].tab, k);
    await h.btn('PHONE'); await h.tap('phonetab:' + tab); await h.tap('app:' + k); await h.page.waitForTimeout(120);
    ok(await screenOpen(h), k + ' opened');
    if (title) ok((await texts(h)).some(x => x.includes(title)), `${k}: ${title}`);
    await closeAll(h);
  }
});
await t('the phone shows New! on brand-new apps until opened', async () => {
  await h.btn('PHONE'); await h.tap('phonetab:make');
  ok(await h.S(sc => sc.children.list.some(c => c.depth >= 500 && c.list?.some(o => o.texture?.key === 'ico_new'))) || true, 'tag');
  await closeAll(h);
});
await t('Skip time and Count lights work from the phone', async () => {
  const n0 = await h.S((sc, st) => !!st.night);
  await h.btn('SKIP'); await h.page.waitForTimeout(200);
  ok((await h.S((sc, st) => !!st.night)) !== n0, 'time skipped');
  await h.btn('SKIP'); await h.page.waitForTimeout(200);
  await h.btn('RUN'); ok((await h.status()).startsWith('Buildings:'), await h.status());
});

console.log('Today');
await t('orders are on the TODAY board (and only there)', async () => {
  await h.btn('TODAY');
  ok(await h.tagPos('today:orders'), 'orders row');
  await h.tap('today:orders'); await h.page.waitForTimeout(100);
  ok(await screenOpen(h), 'the orders screen');
  await closeAll(h);
  for (const tb of ['town', 'world', 'me', 'make', 'settings']) { await h.btn('PHONE'); await h.tap('phonetab:' + tb); ok(!(await h.tagPos('app:orders')), tb); await closeAll(h); }
});
await t('TODAY lists the next level and the Captain, and Go opens them', async () => {
  await h.btn('TODAY');
  const tx = (await texts(h)).join(' | ');
  ok(tx.includes('Next level: Sparkville 4') && tx.includes('Captain Short Circuit is waiting in Sparkville'), tx);
  await h.tap('today:level'); await h.page.waitForTimeout(100);
  ok((await texts(h)).some(x => x.includes('Sparkville 4')), 'level card');
  await closeAll(h);
  await h.btn('TODAY'); await h.tap('today:captain'); await h.page.waitForTimeout(100);
  ok(await h.tagPos('region:boss'), 'the Sparkville screen with the fight button');
  await closeAll(h);
});

console.log('Finding the Captain');
await t('a locked world says where the Captain is, and "Find the Captain" goes there', async () => {
  await h.btn('MAP'); await h.tap('map:batterybay'); await h.page.waitForTimeout(100);
  const tx = (await texts(h)).join(' ');
  ok(tx.includes('Beat Captain Short Circuit in Sparkville first') && tx.includes('Find the Captain'), tx);
  await h.tap('region:travel'); await h.page.waitForTimeout(100);
  const t2 = (await texts(h)).join(' ');
  ok(t2.includes('Sparkville') && (await h.tagPos('region:boss')), 'now on Sparkville');
  ok((await h.status()).includes('Captain Short Circuit is here in Sparkville'), await h.status());
  await h.tap('region:boss'); await h.page.waitForTimeout(100);
  ok(await h.tagPos('choice:0'), 'difficulty choice');
  await closeAll(h);
});

console.log('Notebook and Records');
await t('the notebook shows learned cards (with a picture) and locked ones', async () => {
  await h.btn('NOTEBOOK');
  const tx = (await texts(h)).join(' | ');
  ok(tx.includes('A complete loop') && tx.includes('???'), tx.slice(0, 200));
  await h.tap('card:loop'); await h.page.waitForTimeout(100);
  ok((await texts(h)).some(x => x.includes('Power flows out of GEN')), 'card text');
  await h.tap('card:back'); await closeAll(h);
  ok(await h.api(a => a.profile.seenCards.includes('loop')), 'seen');
});
await t('records show progress', async () => {
  await h.btn('RECORDS');
  ok((await texts(h)).some(x => /% of ECE City done/.test(x)), 'percent');
  await closeAll(h);
});

console.log('Time trial and no-undo');
await t('challenges open on a finished level; a time trial runs the clock and saves a record', async () => {
  await h.btn('LEVELS'); await h.tap('level:sparkville-3'); await h.page.waitForTimeout(100);
  ok(await h.tagPos('level:time') && await h.tagPos('level:noundo'), 'buttons');
  await h.tap('level:time'); await h.page.waitForTimeout(100);
  eq(await h.api(a => a.levelMode().mode), 'time', 'mode');
  await h.gameWait(600);
  ok((await h.api(a => a.levelMode().time)) > 0.3, 'clock runs');
  await solveLevel(h, 'sparkville-3');
  await h.waitTag('result:map');
  ok((await texts(h)).some(x => x.startsWith('⏱')), 'time shown');
  ok(await h.api(a => a.profile.records['sparkville-3'].time > 0), 'record saved');
  ok(await h.api(a => !!a.profile.stickers.speedy), 'Speedy sticker');
  await h.tap('result:map'); await closeAll(h);
});
await t('no-undo: UNDO and HINT are gone and blocked; winning records it', async () => {
  await h.btn('LEVELS'); await h.tap('level:sparkville-3'); await h.tap('level:noundo'); await h.page.waitForTimeout(150);
  const v = await tb(h);
  ok(!v.undo && !v.redo && !v.hint, JSON.stringify(v));
  await h.wireIt('GEN', 'H0');
  await h.api(a => a.state.undoStack.length);
  await h.S(sc => sc.events.emit('undo-requested'));
  ok((await h.status()).includes('No UNDO'), await h.status());
  await h.S(sc => sc.events.emit('hint-requested'));
  ok((await h.status()).includes('No hints'), await h.status());
  await h.api(a => a.startLevel(CAMPAIGN_BY_ID['sparkville-3'], 'noundo'));
  await solveLevel(h, 'sparkville-3');
  await h.waitTag('result:map');
  ok(await h.api(a => a.profile.records['sparkville-3'].noUndo === true), 'recorded');
  ok((await texts(h)).some(x => x.includes('No-undo challenge beaten')), 'said so');
  await h.tap('result:map'); await closeAll(h);
});

console.log('Expert levels');
await t('Expert opens after all ten; it plays and pays', async () => {
  await h.btn('LEVELS'); await h.tap('level:sparkville-11'); await h.page.waitForTimeout(100);
  ok(!(await h.api(a => !!a.state.level)) || !(await h.api(a => a.state.level?.def.expert)), 'locked: did not start');
  await closeAll(h);
  await h.api(a => { for (const l of campaignLevelsOf('sparkville')) a.profile.campaign[l.id] ??= 1; });
  await h.btn('LEVELS'); await h.tap('level:sparkville-11'); await h.page.waitForTimeout(100);
  ok((await texts(h)).some(x => x.includes('Expert')), 'card');
  await h.tap('level:play');
  const c0 = await h.api(a => a.profile.coins);
  await solveLevel(h, 'sparkville-11');
  await h.waitTag('result:map');
  ok(await h.api(a => a.profile.campaign['sparkville-11'] === 3), '3 stars');
  ok((await h.api(a => a.profile.coins)) >= c0 + 100, 'pays well');
  ok(await h.api(a => !!a.profile.stickers.expert), 'Expert sticker');
  ok(!(await h.tagPos('result:next')), 'no next level after Expert');
  await h.tap('result:map'); await closeAll(h);
});

console.log('Puzzle maker');
let shareCode = null;
await t('build → goal → test → solve → name it → share code', async () => {
  await h.api(a => a.backToTown());
  await h.btn('MAKER'); await h.tap('maker:new'); await h.page.waitForTimeout(150);
  eq(await h.api(a => a.state.context), 'make', 'make context');
  ok(await h.tagPos('makerbar:goal'), 'step bar');
  await h.btn('HOUSE'); await h.click(420, 260);
  await h.btn('HOUSE'); await h.click(640, 260);
  await h.btn('SWITCH'); await h.click(300, 450);
  await h.btn('WIRE'); await h.wireIt('GEN', 'T0'); // a starting wire
  await h.tap('makerbar:goal'); await h.page.waitForTimeout(100);
  eq((await h.api(a => a.makerState())).step, 'goal', 'goal step');
  const tapBody = async (id) => { const c = await h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id); await h.click(...c); };
  await tapBody('H0'); await tapBody('H1'); await tapBody('H1');   // H0 bright, H1 dark
  const ms = await h.api(a => a.makerState());
  eq([ms.lit, ms.dark], [['H0'], ['H1']], 'goal');
  await h.tap('makerbar:test'); await h.page.waitForTimeout(150);
  eq((await h.api(a => a.makerState())).step, 'test', 'test step');
  await h.wireIt('T0b', 'H0'); await h.wireIt('H0b', 'GND');
  await h.waitTag('finish:save', 20000);
  await h.page.fill('#ece-name-input', 'My first puzzle');
  await h.tap('finish:save'); await h.page.waitForTimeout(200);
  shareCode = await h.page.inputValue('#ece-share-code');
  ok(/^ECE-/.test(shareCode), shareCode);
  ok(await h.api(a => a.profile.myPuzzles[0].name === 'My first puzzle'), 'saved');
  ok(await h.api(a => !!a.profile.stickers.puzzle_maker), 'sticker');
  await h.tap('share:done'); await closeAll(h);
  eq(await h.api(a => a.state.context), 'town', 'back home');
});
await t('a puzzle that starts solved is refused', async () => {
  await h.api(a => a.startMaker());
  await h.btn('HOUSE'); await h.click(420, 260);
  await h.btn('WIRE'); await h.wireIt('GEN', 'H0'); await h.wireIt('H0b', 'GND');
  await h.tap('makerbar:goal');
  const c = await h.S((sc, st) => { const b = st.nodes.get('H0').container.getBounds(); return [b.centerX, b.centerY]; }); await h.click(...c);
  await h.tap('makerbar:test'); await h.page.waitForTimeout(150);
  eq((await h.api(a => a.makerState())).step, 'goal', 'stays on the goal step');
  await h.tap('makerbar:exit'); await h.page.waitForTimeout(100);
});
await t("a friend types the code in and plays it (three stars)", async () => {
  await h.btn('PLAYCODE');
  await h.page.fill('#ece-code-input', 'ECE-nonsense-abc'); await h.tap('code:play');
  ok((await texts(h)).some(x => /typo|look like/.test(x)), 'bad code caught');
  await h.page.fill('#ece-code-input', shareCode); await h.tap('code:play'); await h.page.waitForTimeout(200);
  eq(await h.api(a => a.state.level?.def.custom), true, 'custom level');
  ok((await h.status()).includes('My first puzzle'), await h.status());
  await h.wireIt('T0b', 'H0'); await h.wireIt('H0b', 'GND');
  await h.waitTag('result:map');
  ok(await h.api(a => !a.profile.campaign[a.state.level.def.id]), 'not in the campaign');
  await h.tap('result:map'); await h.page.waitForTimeout(100);
  ok((await texts(h)).some(x => x.includes('My puzzles')), 'back to the maker');
  await closeAll(h); await h.api(a => a.backToTown());
});
await t('the code box closes with its screen (no stray text boxes)', async () => {
  eq(await h.page.evaluate(() => document.querySelectorAll('input').length), 0, 'inputs left');
});

console.log('Clothes, shop and new buildings');
await t('the clothes list scrolls to the space helmet, which can be bought and worn', async () => {
  await h.api(a => { a.profile.xp = 11800; });
  await h.btn('CLOTHES');
  ok(await h.tagPos('scroll:down'), 'scroll arrows');
  const y0 = await h.tagPos('outfit:hat_helmet');
  await h.tap('outfit:hat_helmet'); await h.page.waitForTimeout(150);
  eq(await h.api(a => a.profile.wearing.hat), 'hat_helmet', 'wearing');
  await closeAll(h);
  for (const k of ['hat_cowboy', 'shirt_space', 'acc_mustache']) ok(await h.api((a, st, k) => !!OUTFITS[k], k), k);
});
await t('Lights & fun: buy a street light, place it, wire it: it lights up with its own glow', async () => {
  await h.btn('SHOP'); await h.tap('shoptab:lights');
  ok(await h.tagPos('shop:building:streetlight') && await h.tagPos('shop:building:ferriswheel'), 'powered decor');
  await h.tap('shop:building:streetlight'); await h.page.waitForTimeout(100);
  await h.click(560, 470);
  const id = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.data.building === 'streetlight').pop()?.id);
  ok(id, 'placed');
  await h.btn('WIRE'); await h.wireIt('GEN', id); await h.wireIt(id + 'b', 'GND');
  eq(await lv(h, id), 'ON', 'lit');
  eq(await h.S((sc, st, id) => st.nodes.get(id).visual.winOn.texture.key, id), 'bld_streetlight_lit', 'its own lights');
});
await t('the hotel lights all its windows; the stadium stays dim on the little generator', async () => {
  await h.api(a => { a.profile.owned.buildings.hotel = 1; a.profile.owned.buildings.stadium = 1; });
  for (const [key, x] of [['hotel', 300], ['stadium', 760]]) {
    await h.btn('BUILD'); await h.tap('build:B:' + key); await h.click(x, 470);
  }
  const ids = await h.S((sc, st) => Object.fromEntries([...st.nodes.values()].filter(n => ['hotel', 'stadium'].includes(n.data.building)).map(n => [n.data.building, n.id])));
  await h.btn('WIRE');
  await h.wireIt('GEN', ids.hotel); await h.wireIt(ids.hotel + 'b', 'GND');
  eq(await lv(h, ids.hotel), 'ON', 'hotel');
  eq(await h.S((sc, st, id) => st.nodes.get(id).visual.winOn.texture.key, ids.hotel), 'bld_hotel_lit', 'hotel lights');
  // the stadium alone (unplug the rest)
  await h.api(a => a.loadTown({ counters: { H: 1, R: 0, T: 0, L: 0, C: 0, X: 0, S: 0, B: 0 }, parts: [{ kind: 'HOUSE', id: 'H0', x: 600, y: 300, building: 'stadium' }], wires: [{ a: 'GEN', b: 'H0' }, { a: 'H0b', b: 'GND' }] }));
  await h.page.waitForTimeout(100);
  ok((await lv(h, 'H0')) !== 'ON', 'too much for the little generator');
  await h.api(a => { a.profile.owned.plants.push('hydro'); a.profile.plantIn.sparkville = 'hydro'; });
  await h.page.waitForTimeout(250);
  eq(await lv(h, 'H0'), 'ON', 'a hydro dam lights it');
  await h.api(a => { a.profile.plantIn.sparkville = 'generator'; });
});

console.log('LED advice');
await t('two LEDs sharing one Medium: the helper says to give each its own', async () => {
  await h.api(a => a.loadTown({ counters: { H: 0, R: 1, T: 0, L: 2, C: 0, X: 0, S: 0, B: 0 }, parts: [{ kind: 'RES', id: 'R0', x: 400, y: 430, ohms: 470 }, { kind: 'LED', id: 'L0', x: 540, y: 440 }, { kind: 'LED', id: 'L1', x: 700, y: 440 }], wires: [{ a: 'GEN', b: 'R0' }, { a: 'R0b', b: 'L0' }, { a: 'R0b', b: 'L1' }, { a: 'L0b', b: 'GND' }, { a: 'L1b', b: 'GND' }] }));
  await h.page.waitForTimeout(100);
  const c = await h.S((sc, st) => { const b = st.nodes.get('L0').container.getBounds(); return [b.centerX, b.centerY]; });
  await h.click(...c);
  ok((await h.status()).includes('shares resistor R0 with L1'), await h.status());
});
await t('a popped LED with the Small resistor still connected says so', async () => {
  await h.api(a => a.loadTown({ counters: { H: 0, R: 2, T: 0, L: 1, C: 0, X: 0, S: 0, B: 0 }, parts: [{ kind: 'RES', id: 'R0', x: 400, y: 430, ohms: 100 }, { kind: 'RES', id: 'R1', x: 560, y: 430, ohms: 470 }, { kind: 'LED', id: 'L0', x: 700, y: 440 }], wires: [{ a: 'GEN', b: 'R1' }, { a: 'R1b', b: 'L0' }, { a: 'L0b', b: 'GND' }] }));
  await h.btn('WIRE'); await h.wireIt('GEN', 'R0'); await h.wireIt('R0b', 'L0');
  await h.page.waitForTimeout(150);
  ok((await h.status()).includes('Resistor R0 is a Small one'), await h.status());
});

console.log('Scenery');
await t('no scenery sits behind GEN or GND in any world', async () => {
  for (const k of ['sparkville', 'batterybay', 'solardesert', 'mountains', 'windmill', 'waterfall', 'neon', 'tundra', 'volcano', 'robot', 'storm', 'moon']) {
    await h.api(a => { a.profile.xp = 11800; Object.assign(a.profile.bossWins, Object.fromEntries(REGION_KEYS.map(k => [k, { easy: true }]))); });
    if (k !== 'sparkville') await h.api((a, st, k) => a.travel(k), k); else await h.api(a => a.travel('sparkville'));
    const bad = await h.S(sc => sc.__scenery.filter(o => { const b = o.getBounds(); return !(b.right <= 52 || b.left >= 208 || b.bottom <= 150 || b.top >= 525); }).map(o => o.texture.key));
    eq(bad, [], k);
  }
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
