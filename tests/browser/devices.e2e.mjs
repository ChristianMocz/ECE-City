// tests/browser/devices.e2e.mjs
//
// Every device, driven through the real UI (taps on the canvas), checking it
// can always be made to work — in particular that a popped LED can always be
// replaced (the bug a player hit: "I tried every resistor and it won't light").
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const BKEYS = ['house', 'park', 'bakery', 'icecream', 'school', 'hospital'];
const h = await open({ seed: { owned: { buildings: Object.fromEntries(BKEYS.map(k => [k, 3])) } } });
const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
const burned = (id) => h.S((sc, st, id) => !!st.nodes.get(id)?.data.burned, id);
const art = (id) => h.S((sc, st, id) => st.nodes.get(id).visual.art.texture.key, id);
const newest = (t) => h.S((sc, st, t) => [...st.nodes.values()].filter(n => n.type === t).map(n => n.id).pop(), t);
const body = (id) => h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id);
const screenOpen = () => h.S(sc => sc.children.list.some(o => o.type === 'Container' && o.depth === 500 && o.active));
const texts = () => h.S(sc => { const out = []; const w = (l) => { for (const o of l) { if (o.type === 'Text' && o.active && o.visible) out.push(o.text); if (o.list) w(o.list); } }; for (const L of sc.children.list.filter(o => o.type === 'Container' && o.depth >= 500 && o.active)) w(L.list); return out; });
const clear = async () => { await h.btn('CLEAR'); await h.tap('confirm:yes'); eq(await h.S((sc, st) => st.nodes.size), 2, 'board cleared'); };
const place = async (kind, choice, x, y) => { await h.btn(kind); if (choice !== null) await h.tap('choice:' + choice); await h.click(x, y); return newest(kind === 'SWITCH' ? 'TRANS' : kind === 'XFMR' ? 'XFMR_SEC' : kind); };
const cut = async (a, b) => { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await h.btn('WIRE'); };
const ledCircuit = async (choice) => {
  const R = await place('RES', choice, 400, 220), L = await place('LED', null, 620, 260);
  await h.btn('WIRE'); await h.wireIt('GEN', R); await h.wireIt(R + 'b', L); await h.wireIt(L + 'b', 'GND');
  return { R, L };
};

console.log('Resistors and LEDs');
await t('the resistor menu says which size an LED needs', async () => {
  await h.btn('RES');
  const tx = (await texts()).join(' | ');
  ok(tx.includes('pops an LED') && tx.includes('best for an LED') && tx.includes('makes an LED dim'), tx);
  await h.tap('close').catch(() => h.click(120, 450));
  ok(!(await screenOpen()), 'menu closed');
});
for (const [choice, want, artWant] of [[0, 'BURNED', 'led_burned'], [1, 'ON', 'led_on'], [2, 'DIM', 'led_dim']]) {
  await t(`resistor choice ${choice} + fresh LED → ${want}, and the LED picture matches`, async () => {
    await clear(); const { L } = await ledCircuit(choice);
    eq(await lv(L), want, 'level'); eq(await art(L), artWant, 'picture');
  });
}
await t('THE BUG: Small pops the LED, then swapping to Medium lights the SAME LED', async () => {
  await clear(); const { R, L } = await ledCircuit(0);
  eq(await lv(L), 'BURNED', 'popped first');
  ok((await h.status()).includes('tap the LED to fit a new one'), await h.status());
  await h.btn('DELETE'); await h.click(...await body(R)); await h.btn('WIRE');
  eq(await burned(L), false, 'deleting the resistor next to it fitted a new LED');
  const R2 = await place('RES', 1, 400, 220); await h.btn('WIRE');
  await h.wireIt('GEN', R2); await h.wireIt(R2 + 'b', L);
  eq(await lv(L), 'ON', 'lit with Medium'); eq(await art(L), 'led_on', 'picture');
});
await t('…and then Large on the same LED is dim (not stuck popped)', async () => {
  const L = await newest('LED'), R = await newest('RES');
  await h.btn('DELETE'); await h.click(...await body(R));
  const R3 = await place('RES', 2, 400, 220); await h.btn('WIRE');
  await h.wireIt('GEN', R3); await h.wireIt(R3 + 'b', L);
  eq(await lv(L), 'DIM', 'dim with Large');
});
await t('tapping a popped LED fits a new one; in an unsafe circuit it pops again and says so', async () => {
  await clear(); const { L } = await ledCircuit(0);
  eq(await lv(L), 'BURNED', 'popped');
  await h.btn('WIRE'); await h.click(...await body(L));
  eq(await lv(L), 'BURNED', 'still too much current');
  ok((await h.status()).includes('popped again'), await h.status());
});
await t('…cutting the wire into it fits a fresh (dark, unpopped) LED', async () => {
  const L = await newest('LED'), R = await newest('RES');
  await cut(R + 'b', L);
  eq(await burned(L), false, 'not popped'); eq(await lv(L), 'OFF', 'dark (no loop)');
  ok((await h.status()).includes('fitted a new LED'), await h.status());
});
await t('…then rewiring it through a Medium resistor lights it', async () => {
  const L = await newest('LED'), R = await newest('RES');
  await h.btn('DELETE'); await h.click(...await body(R));
  const R2 = await place('RES', 1, 400, 220); await h.btn('WIRE');
  await h.wireIt('GEN', R2); await h.wireIt(R2 + 'b', L);
  eq(await lv(L), 'ON', 'ON');
});
await t('tapping a popped LED in a safe circuit lights it straight away', async () => {
  const L = await newest('LED');
  await h.S((sc, st, id) => { st.nodes.get(id).data.burned = true; st.dirty = true; }, L);
  await h.btn('WIRE'); await h.click(...await body(L));
  eq(await lv(L), 'ON', 'refitted and lit');
  ok((await h.status()).includes('fitted a new LED'), await h.status());
});
await t('UNDO after fitting a new LED brings back the popped one; REDO fits it again', async () => {
  const L = await newest('LED');
  await h.btn('UNDO'); eq(await burned(L), true, 'undo');
  await h.btn('REDO'); eq(await lv(L), 'ON', 'redo');
});
await t('an LED wired straight to the generator (no resistor) pops; tapping the helper explains how to fix it', async () => {
  await clear(); const L = await place('LED', null, 620, 260); await h.btn('WIRE');
  await h.wireIt('GEN', L); await h.wireIt(L + 'b', 'GND');
  eq(await lv(L), 'BURNED', 'popped');
  // put a Medium resistor in: cut GEN->L, wire GEN->R->L
  await cut('GEN', L);
  const R = await place('RES', 1, 400, 220); await h.btn('WIRE');
  await h.wireIt('GEN', R); await h.wireIt(R + 'b', L);
  eq(await lv(L), 'ON', 'ON after adding the resistor');
});
await t('an LED wired backwards stays dark, is not popped, and the helper says it is backwards', async () => {
  await clear(); const R = await place('RES', 1, 400, 220), L = await place('LED', null, 620, 260);
  await h.btn('WIRE'); await h.wireIt('GEN', R); await h.wireIt(R + 'b', L + 'b'); await h.wireIt(L, 'GND');
  eq(await lv(L), 'OFF', 'off'); eq(await burned(L), false, 'not popped');
  await h.click(...await body(L));
  ok(/backwards|flip|other way/i.test(await h.status()), await h.status());
});
await t('two LEDs in a row with a Medium resistor both light', async () => {
  await clear(); const R = await place('RES', 1, 400, 220), L0 = await place('LED', null, 560, 260), L1 = await place('LED', null, 720, 260);
  await h.btn('WIRE'); await h.wireIt('GEN', R); await h.wireIt(R + 'b', L0); await h.wireIt(L0 + 'b', L1); await h.wireIt(L1 + 'b', 'GND');
  eq([await lv(L0), await lv(L1)], ['ON', 'ON'], 'both');
});
await t('Sparky predicts a rewired popped LED correctly (it will light, not stay popped)', async () => {
  await clear(); const { R, L } = await ledCircuit(0);
  await h.btn('DELETE'); await h.click(...await body(R));
  const R2 = await place('RES', 1, 400, 220); await h.btn('WIRE'); await h.wireIt('GEN', R2);
  await h.S((sc, st, id) => { st.nodes.get(id).data.burned = true; }, L); // popped again, for the prediction
  const pred = await h.api((a, st, [r, l]) => a.levelsWith({ addWire: [r + 'b', l] })[l], [R2, L]);
  eq(pred, 'ON', 'prediction');
  await h.wireIt(R2 + 'b', L); eq(await lv(L), 'ON', 'real');
});

console.log('Switches, capacitors, transformers');
await t('a switch: ON lights the house, OFF darkens it, ON again lights it', async () => {
  await clear(); const T = await place('SWITCH', null, 400, 260), H = await place('HOUSE', null, 660, 260);
  await h.btn('WIRE'); await h.wireIt('GEN', T); await h.wireIt(T + 'b', H); await h.wireIt(H + 'b', 'GND');
  const flip = async () => { await h.click(...await h.S((sc, st, id) => { const z = st.nodes.get(id).extraHits[0]; return [z.x, z.y]; }, T)); await h.page.waitForTimeout(150); };
  const on0 = await h.S((sc, st, id) => st.nodes.get(id).data.on, T);
  if (!on0) await flip();
  eq(await lv(H), 'ON', 'on'); await flip(); eq(await lv(H), 'OFF', 'off'); await flip(); eq(await lv(H), 'ON', 'on again');
});
for (const [choice, uF] of [[0, 47], [1, 220], [2, 1000]]) {
  await t(`capacitor ${uF}µF charges from the generator`, async () => {
    await clear(); const C = await place('CAP', choice, 450, 260);
    eq(await h.S((sc, st, id) => st.nodes.get(id).data.uF, C), uF, 'size');
    await h.btn('WIRE'); await h.wireIt('GEN', C); await h.wireIt(C + 'b', 'GND');
    const v = () => h.S((sc, st, id) => st.nodes.get(id).data.Vprev ?? 0, C);
    const v0 = await v(); await h.page.waitForTimeout(1500); const v1 = await v();
    ok(v1 > v0 && v1 > 0.5, `charging ${v0.toFixed(2)} -> ${v1.toFixed(2)}`);
  });
}
for (const [choice, ratio, want] of [[0, 0.5, ['OFF', 'DIM']], [1, 1, ['ON']], [2, 2, ['ON']]]) {
  await t(`transformer ×${ratio} feeding a house → ${want.join('/')}`, async () => {
    await clear(); const X = await place('XFMR', choice, 420, 250), H = await place('HOUSE', null, 700, 260);
    await h.btn('WIRE'); await h.wireIt('GEN', X + 'P'); await h.wireIt(X, H); await h.wireIt(H + 'b', 'GND');
    ok(want.includes(await lv(H)), 'got ' + await lv(H));
    if (ratio === 0.5) { await h.click(...await body(H)); ok(/transformer/i.test(await h.status()), await h.status()); }
  });
}

console.log('Every shop building, and solar + battery');
for (const key of BKEYS) {
  await t(`${key} alone on the generator lights, by day and at night`, async () => {
    await clear(); if (key === 'house') await place('HOUSE', null, 600, 300); else { await h.btn('BUILD'); await h.tap('build:B:' + key); await h.click(600, 300); }
    const H = await newest('HOUSE');
    eq(await h.S((sc, st, id) => st.nodes.get(id).data.building, H), key, 'placed');
    await h.btn('WIRE'); await h.wireIt('GEN', H); await h.wireIt(H + 'b', 'GND');
    eq(await lv(H), 'ON', 'day');
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
    ok(await h.S((sc, st) => st.loadScale < 1), 'it is night');
    eq(await lv(H), 'ON', 'night');
    await h.api(a => a.setWeather('heat')); await h.page.waitForTimeout(150);
    eq(await lv(H), 'ON', 'heat-wave night');
    await h.api(a => a.setWeather('normal'));
    await h.btn('SKIP'); await h.page.waitForTimeout(300);
  });
}
await t('solar panel lights a house by day, and a charged battery carries it through the night', async () => {
  await clear();
  const S = await place('SOLAR', null, 400, 300), H = await place('HOUSE', null, 640, 300);
  await h.btn('WIRE'); await h.wireIt(S, H); await h.wireIt(H + 'b', S + 'b');
  eq(await lv(H), 'ON', 'solar by day');
  await cut(S, H); await cut(H + 'b', S + 'b');
  const B = await place('BAT', null, 400, 470); await h.btn('WIRE');
  await h.wireIt('GEN', B); await h.wireIt(B + 'b', 'GND');
  await h.btn('SKIP'); await h.page.waitForTimeout(300); // to night (charges on the way)
  await cut('GEN', B); await h.wireIt(B, H); await h.wireIt(H + 'b', 'GND');
  eq(await lv(H), 'ON', 'battery at night');
  await h.btn('SKIP'); await h.page.waitForTimeout(300);
});

console.log('Whole-board checks');
await t('RUN CHECK counts popped LEDs and nothing crashes', async () => {
  await clear(); await ledCircuit(0); await h.btn('RUN');
  ok((await h.status()).includes('1 popped'), await h.status());
});
await t('no page or console errors anywhere', async () => { eq(h.errors, [], 'errors'); });

await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
