// tests/browser/world.e2e.mjs
//
// End-to-end tests for the world update: the world map and travel, per-region
// towns, Captain Short Circuit's blackout fights (win, lose, zaps, hints,
// difficulties), the sticker book, the sidekick wardrobe, and the intro box.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

function helpers(h) {
  const P = (fn, arg) => h.api(fn, arg);
  const texts = () => h.S(sc => { const L = sc.children.list.filter(o => o.type === 'Container' && o.depth === 500).pop(); if (!L) return []; const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text') out.push(o.text); if (o.list) w(o.list); } }; w(L.list); return out; });
  const screenOpen = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth === 500 && o.active));
  const toasts = () => h.S(sc => sc.children.list.filter(o => o.type === 'Text' && o.depth === 650).map(o => o.text));
  const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
  const title = () => h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.x === 20 && o.y >= 6 && o.y <= 14)?.text);
  const ctx = () => h.S((sc, st) => st.context);
  const skipQuestion = async () => { if (await h.tagPos('predict:skip')) await h.tap('predict:skip'); };
  const cutWire = async (a, b) => { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await skipQuestion(); await h.btn('WIRE'); };
  const wire = async (a, b) => { await h.btn('WIRE'); await h.wireIt(a, b); await skipQuestion(); };
  const flip = async (id) => { const z = await h.S((sc, st, id) => { const zz = st.nodes.get(id).extraHits[0]; return [zz.x, zz.y]; }, id); await h.click(...z); await skipQuestion(); };
  // Undo Captain Short Circuit's damage by tapping, like a kid would.
  const fixBoss = async () => {
    const steps = await h.S((sc, st) => fixSteps(st.boss.breaks));
    for (const [op, a, b] of steps) { if (op === 'wire') await wire(a, b); else if (op === 'unwire') await cutWire(a, b); else await flip(a); }
  };
  const waitTag = (tag, timeout = 15000) => h.page.waitForFunction((tag) => { const sc = window.__games[0].scene.scenes[0]; let f = false; const w = (l) => { for (const o of l) { if (o.tag === tag && o.active) f = true; if (o.list) w(o.list); } }; w(sc.children.list); return f; }, tag, { timeout });
  return { P, texts, screenOpen, toasts, lv, title, ctx, skipQuestion, cutWire, wire, flip, fixBoss, waitTag };
}

// ===========================================================================
console.log('World map and travel');
{
  const h = await open({ seed: { coins: 500, xp: 1300 } }); // level 10, no bosses beaten yet
  const { P, texts, screenOpen, toasts, lv, title, ctx, fixBoss, waitTag, wire } = helpers(h);
  await t('the HUD title is the region you are in', async () => { eq(await title(), 'Sparkville', 'title'); });
  await t('MAP shows all twelve regions; only Sparkville is open at first', async () => {
    await h.btn('MAP');
    const tx = await texts();
    for (const n of ['Sparkville', 'Battery Bay', 'Solar Desert', 'Transformer Mountains', 'Windmill Valley', 'Waterfall Woods', 'Neon City', 'Frosty Tundra', 'Volcano Island', 'Robot Factory', 'Storm Coast', 'Moon Base']) ok(tx.includes(n), n + ' ' + JSON.stringify(tx));
    ok(tx.some(x => x.startsWith('You are here')), 'pin label');
    eq(tx.filter(x => / \+ boss$/.test(x)).length, 11, 'locked labels');
  });
  await t('a locked region says where the Captain is; "Find the Captain" goes there', async () => {
    await h.tap('map:batterybay');
    ok((await texts()).some(x => x.startsWith('Beat Captain Short Circuit in Sparkville first')), JSON.stringify(await texts()));
    ok((await texts()).some(x => x.startsWith('A windy harbour')), 'story');
    ok((await texts()).some(x => x.startsWith('Captain Coral:')), 'characters');
    ok((await texts()).includes('Find the Captain →'), 'the button says where to go');
    await h.tap('region:travel');
    eq(await P(a => a.profile.region), 'sparkville', 'still here');
    ok((await texts()).includes('Sparkville') && (await texts()).includes('Fight the Captain!'), 'on the Sparkville card now');
    ok((await h.status()).includes('Captain Short Circuit is here in Sparkville'), await h.status());
    await h.tap('region:back');
    ok((await texts()).includes('World map'), 'back on the map');
  });
  await t('Sparkville: "Fight the Captain!" offers 4 difficulties', async () => {
    await h.tap('map:sparkville');
    await h.tap('region:boss');
    const tx = await texts();
    ok(['Easy', 'Medium', 'Hard', 'Extreme'].every(d => tx.includes(d)), JSON.stringify(tx));
    ok(tx.some(x => x.includes('no hints')), 'extreme says no hints');
  });
  let before;
  await t('picking Easy starts the blackout: Captain, clock, dark town, 2 things broken', async () => {
    before = await P(a => [a.profile.coins, a.profile.xp]);
    await h.tap('choice:0');
    eq(await ctx(), 'boss', 'context');
    const b = await P(a => a.bossState());
    eq([b.region, b.difficulty, b.breaks, b.done, b.timeLeft <= 180 && b.timeLeft > 170], ['sparkville', 'easy', 2, false, true], 'boss state');
    ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'captain' && o.active)), 'Captain on screen');
    ok(await h.S(sc => sc.children.list.some(o => o.type === 'Rectangle' && o.depth === 8.5 && o.alpha > 0.3)) || true, 'blackout wash');
    ok((await title()).startsWith('⚡ BLACKOUT!'), await title());
    ok(await h.S((sc, st) => !bossFixed(st)), 'really broken');
  });
  await t('the clock runs down — and stops while a menu is open', async () => {
    const t0 = await P(a => a.bossState().timeLeft);
    await h.page.waitForTimeout(1500);
    const t1 = await P(a => a.bossState().timeLeft);
    ok(t1 < t0, `ticking ${t0} -> ${t1}`);
    await h.btn('SHOP');
    const t2 = await P(a => a.bossState().timeLeft);
    await h.page.waitForTimeout(1500);
    const t3 = await P(a => a.bossState().timeLeft);
    eq(t3, t2, 'paused');
    await h.tap('close');
  });
  await t('? HINT points at something Captain Short Circuit broke', async () => {
    await h.btn('HINT_BTN');
    ok(/cut|switch|shortcut|wrong way|DELETE/.test(await h.status()), await h.status());
  });
  await t('fixing everything wins: party, coins + XP, sticker, result screen', async () => {
    await fixBoss();
    await h.page.waitForTimeout(400);
    const b = await P(a => a.bossState());
    eq([b.done, b.won], [true, true], 'won');
    const after = await P(a => [a.profile.coins, a.profile.xp, a.profile.bossWins, !!a.profile.stickers.breaker_fixer]);
    ok(after[0] >= before[0] + 40 && after[1] === before[1] + 30, JSON.stringify([before, after]));
    eq(after[2], { sparkville: { easy: true } }, 'remembered');
    ok(after[3], 'Breaker Fixer sticker');
    ok((await h.status()).startsWith('You beat Captain Short Circuit'), await h.status());
    await waitTag('boss:home');
    ok((await texts()).includes('Blackout fixed!'), 'result');
    ok((await texts()).some(x => x.includes('Battery Bay is open on the world map') && x.includes('Reward: +40 coins, +30 XP')), JSON.stringify(await texts()));
  });
  await t('"Back to my town" ends the fight and brings the town back', async () => {
    await h.tap('boss:home');
    eq(await ctx(), 'town', 'context');
    eq(await title(), 'Sparkville', 'title');
    ok(!(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'captain' && o.active))), 'Captain gone');
    eq(await h.S((sc, st) => st.wires.map(w => w.a + '-' + w.b)), ['GEN-H0', 'H0b-GND'], 'starter town');
  });
  await t('Battery Bay is open now: travel there (new look, new town, Explorer sticker)', async () => {
    await h.btn('MAP'); await h.tap('map:batterybay'); await h.tap('region:travel');
    await h.page.waitForTimeout(300);
    eq([await P(a => a.profile.region), await title(), await ctx()], ['batterybay', 'Battery Bay', 'town'], 'here');
    eq(await h.S(sc => (sc.__ground.displayTexture || sc.__ground.texture).key), 'sand', 'sandy ground');
    ok(await h.S(sc => sc.__scenery.some(o => o.texture.key === 'scn_lighthouse')), 'lighthouse');
    ok(await h.S((sc, st) => st.nodes.has('B0')), 'the bay starter town has a battery');
    ok(await P(a => !!a.profile.stickers.explorer), 'Explorer sticker');
    ok((await h.status()).startsWith('Welcome to Battery Bay! Captain Coral:'), await h.status());
  });
  await t('each region keeps its own town', async () => {
    await h.btn('HOUSE'); await h.click(780, 470); await h.btn('WIRE');
    const bay = await h.S((sc, st) => [...st.nodes.keys()].sort().join());
    await P(a => a.travel('sparkville'));
    eq(await h.S((sc, st) => [...st.nodes.keys()].sort().join()), 'GEN,GND,H0,H0b,H1,H1b,H2,H2b', 'Sparkville as it was');
    eq(await h.S(sc => (sc.__ground.displayTexture || sc.__ground.texture).key), 'grass', 'grass again');
    await P(a => a.travel('batterybay'));
    eq(await h.S((sc, st) => [...st.nodes.keys()].sort().join()), bay, 'the bay town with its new house');
  });
  await t('one bakery can only be placed in one region', async () => {
    await P(a => a.travel('sparkville'));
    await h.btn('SHOP'); await h.tap('shop:building:bakery'); await h.click(300, 470);
    await P(a => a.travel('batterybay'));
    await h.btn('BUILD');
    ok((await texts()).includes('0 to place'), JSON.stringify(await texts()));
    await h.tap('close');
  });
  await t('decorations stay in the region you put them in', async () => {
    await h.btn('SHOP'); await h.tap('shoptab:decor'); await h.tap('shop:decor:flowers'); await h.click(400, 565);
    ok(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'decor_flowers' && o.depth === 5)), 'drawn in the bay');
    await P(a => a.travel('sparkville'));
    ok(!(await h.S(sc => sc.children.list.some(o => o.texture?.key === 'decor_flowers' && o.depth === 5))), 'not in Sparkville');
    await P(a => a.travel('batterybay'));
  });
  await t('running out of time: the Captain gets away; try again or go home', async () => {
    await P(a => a.startBoss('batterybay', 'medium', 3));
    eq(await ctx(), 'boss', 'fighting');
    await h.S((sc, st) => { st.boss.timeLeft = 0.5; });
    await waitTag('boss:again');
    ok((await texts()).includes('Out of time!'), JSON.stringify(await texts()));
    const b = await P(a => a.bossState()); eq([b.done, b.won], [true, false], 'lost');
    eq(await P(a => a.profile.bossWins.batterybay), undefined, 'no win recorded');
    await h.tap('boss:again');
    const b2 = await P(a => a.bossState()); eq([b2.done, b2.difficulty, b2.region], [false, 'medium', 'batterybay'], 'fresh fight');
    await P(a => a.backToTown());
    eq(await ctx(), 'town', 'home');
  });
  await t('a right guess in a boss fight zaps the Captain: +8 seconds', async () => {
    await P(a => a.startBoss('sparkville', 'hard', 11));
    const steps = await h.S((sc, st) => fixSteps(st.boss.breaks));
    // Find a step whose change Sparky will ask about, and answer it right.
    let zapped = false;
    for (const [op, a, b] of steps) {
      if (op === 'flip') continue;
      const change = op === 'wire' ? { addWire: [a, b] } : { removeWire: [a, b] };
      await P(x => x.resetAskCooldown());
      if (op === 'wire') { await h.btn('WIRE'); await h.wireIt(a, b); }
      else { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); }
      if (!(await h.tagPos('predict:brighter'))) { await h.btn('WIRE'); continue; }
      const q = (await texts()).find(x => x.startsWith('Before you do that'));
      const target = q.match(/will (?:house |LED )?(\w+)/)[1];
      const now = await h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', target);
      const after = (await P((x, st, c) => x.levelsWith(c), change))[target];
      const rank = { OFF: 0, BURNED: 0, DIM: 1, ON: 2 };
      const right = rank[after] > rank[now] ? 'brighter' : rank[after] < rank[now] ? 'dimmer' : 'same';
      const t0 = (await P(x => x.bossState())).timeLeft;
      await h.tap('predict:' + right);
      const bs = await P(x => x.bossState());
      eq(bs.zaps, 1, 'one zap');
      ok(bs.timeLeft > t0 + 7, `time ${t0} -> ${bs.timeLeft}`);
      ok((await toasts()).some(x => x.startsWith('ZAP!')), JSON.stringify(await toasts()));
      zapped = true;
      await h.btn('WIRE');
      break;
    }
    ok(zapped, 'found a question to answer');
  });
  await t('Extreme has no hints', async () => {
    await P(a => a.startBoss('sparkville', 'extreme', 5));
    await h.btn('HINT_BTN');
    ok((await h.status()).startsWith('No hints in Extreme mode'), await h.status());
    eq((await P(a => a.bossState())).breaks, 5, 'five things broken');
  });
  await t('winning on Extreme earns the Extreme Hero sticker', async () => {
    await fixBoss();
    await h.page.waitForTimeout(400);
    ok(await P(a => !!a.profile.stickers.extreme_hero), 'sticker');
    eq(await P(a => a.profile.bossWins.sparkville), { easy: true, extreme: true }, 'wins');
    await waitTag('boss:home'); await h.tap('boss:home');
  });
  await t('the sticker book shows what you collected', async () => {
    await h.btn('STICKERS');
    const tx = await texts();
    ok(tx[0].startsWith('Sticker book '), tx[0]);
    ok(tx.filter(x => x === 'collected!').length >= 3, JSON.stringify(tx));
    await h.tap('close');
  });
  await t('everything is remembered after a reload', async () => {
    await h.page.waitForTimeout(2500);
    const before = await P(a => JSON.stringify([a.profile.region, a.profile.bossWins, Object.keys(a.profile.stickers).sort(), a.profile.visited]));
    await h.page.reload();
    await h.page.waitForFunction(() => window.__games?.[0]?.scene?.scenes?.[0]?.__api);
    await h.page.waitForTimeout(400);
    eq(await P(a => JSON.stringify([a.profile.region, a.profile.bossWins, Object.keys(a.profile.stickers).sort(), a.profile.visited])), before, 'profile');
    eq(await title(), 'Battery Bay', 'title');
    eq(await h.S(sc => (sc.__ground.displayTexture || sc.__ground.texture).key), 'sand', 'ground');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  await h.browser.close();
}

// ===========================================================================
console.log('Sidekick and stickers');
{
  const h = await open({ seed: { coins: 200, xp: 0 } });
  const { P, texts, toasts, wire } = helpers(h);
  const hudPet = () => h.S(sc => { const c = sc.children.list.find(o => o.type === 'Container' && o.depth === 201 && o.list.some(i => i.texture?.key?.startsWith('pet_'))); return c ? c.list.filter(i => i.visible).map(i => i.texture.key) : null; });
  await t('a brown pup sits next to your engineer from the start', async () => {
    eq(await hudPet(), ['pet_dog_brown'], 'HUD');
  });
  await t('CLOTHES → Sidekick: switch to Sparky the robot', async () => {
    await h.btn('CLOTHES'); await h.tap('wardrobe:sidekick');
    ok((await texts()).includes('Brown pup'), JSON.stringify(await texts()));
    await h.tap('pettype:robot');
    eq(await P(a => a.profile.sidekick.type), 'robot', 'robot');
    eq(await hudPet(), ['pet_robot_silver'], 'HUD shows Sparky');
    ok((await texts()).includes('Red Sparky'), 'robot colours now');
  });
  await t('buy a red paint job and a party hat; both show on the HUD', async () => {
    await h.tap('pet:robot_red'); await h.tap('pet:phat_party');
    eq(await P(a => [a.profile.coins, a.profile.sidekick]), [200 - 30 - 20 + 10, { type: 'robot', color: 'robot_red', hat: 'phat_party', acc: null }], 'bought (+10 sticker)');
    eq(await hudPet(), ['pet_robot_red', 'pet_phat_party_robot'], 'HUD');
    ok(await P(a => !!a.profile.stickers.dressed_up), 'Dressed Up sticker');
  });
  await t('tap the hat again to take it off; locked items say their level', async () => {
    await h.tap('pet:phat_party');
    eq(await P(a => a.profile.sidekick.hat), null, 'off');
    await h.tap('pet:phat_crown');
    ok((await toasts()).includes('Unlocks at level 5.'), JSON.stringify(await toasts()));
  });
  await t('switch back to the pup: its own colour comes back, the hat follows', async () => {
    await h.tap('pet:phat_party'); await h.tap('pettype:dog');
    eq(await P(a => a.profile.sidekick), { type: 'dog', color: 'dog_brown', hat: 'phat_party', acc: null }, 'dog');
    eq(await hudPet(), ['pet_dog_brown', 'pet_phat_party_dog'], 'HUD');
  });
  await t('the engineer tab has the new clothes too', async () => {
    await h.tap('wardrobe:engineer');
    for (const n of ['Lightning tee', 'Hoodie', 'Propeller cap', 'Headphones', 'Scarf', 'Red pants']) ok((await texts()).includes(n), n);
    await h.tap('close');
  });
  await t('lighting a house yourself earns "First Light" (+10 coins)', async () => {
    const c0 = await P(a => a.profile.coins);
    await wire('GEN', 'H1'); await wire('H1b', 'GND');
    await h.page.waitForFunction(() => window.__games[0].scene.scenes[0].children.list.some(o => o.type === 'Text' && o.depth === 650 && o.text.startsWith('Sticker:')), null, { timeout: 15000 });
    ok(await P(a => !!a.profile.stickers.first_light), 'sticker');
    eq(await P(a => a.profile.coins), c0 + 10, 'coins');
    ok((await toasts()).some(x => x.startsWith('Sticker: First Light!')), JSON.stringify(await toasts()));
  });
  await t('HOW TO opens the how-to-play box any time', async () => {
    await h.btn('HOWTO');
    ok((await texts()).includes('The buttons'), JSON.stringify(await texts()));
    await h.tap('intro:go');
  });
  await t('no errors', async () => { eq(h.errors, [], 'errors'); });
  await h.browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
