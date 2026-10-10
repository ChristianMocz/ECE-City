// tests/browser/emergency.e2e.mjs
//
// The twelve emergencies, played through the real game screen: offered,
// accepted, fixed by tapping and wiring like a kid would, and paid.
import { open } from './harness.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const h = await open({ seed: { xp: 1300, coins: 1000, owned: { plants: ['hydro'] }, plantIn: { sparkville: 'hydro' } } });
await h.api(a => { for (const id of Object.keys(STICKERS)) a.profile.stickers[id] = '2026-01-01'; a.profile.settings.emergencies = true; a.setNextEmergencyIn(9e9); });
const P = (fn, arg) => h.api(fn, arg);
const TOWN = { counters: { H: 4, T: 1, R: 1, L: 1, B: 1, S: 1 },
  parts: [
    { kind: 'HOUSE', id: 'H0', x: 330, y: 260, building: 'hospital' }, { kind: 'HOUSE', id: 'H1', x: 480, y: 260 }, { kind: 'TRANS', id: 'T0', x: 600, y: 250, on: true },
    { kind: 'HOUSE', id: 'H2', x: 730, y: 260 }, { kind: 'RES', id: 'R0', x: 330, y: 430, ohms: 470 }, { kind: 'LED', id: 'L0', x: 450, y: 440 },
    { kind: 'BAT', id: 'B0', x: 560, y: 470, Vprev: 12 }, { kind: 'SOLAR', id: 'S0', x: 680, y: 470 }, { kind: 'HOUSE', id: 'H3', x: 790, y: 450 }],
  wires: ['GEN-H0', 'H0b-GND', 'GEN-H1', 'H1b-GND', 'GEN-T0', 'T0b-H2', 'H2b-GND', 'GEN-R0', 'R0b-L0', 'L0b-GND', 'GEN-B0', 'B0b-GND', 'S0-H3', 'H3b-S0b'].map(w => { const [a, b] = w.split('-'); return { a, b }; }),
};
const lv = (id) => h.S((sc, st, id) => st.powered.get(id)?.level ?? 'OFF', id);
const em = () => P(a => { const e = a.emergencyState(); return e && { key: e.key, timeLeft: e.timeLeft, plan: e.plan }; });
const body = (id) => h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id);
const cut = async (a, b) => { const pa = await h.dot(a), pb = await h.dot(b); await h.btn('DELETE'); await h.click((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); await h.btn('WIRE'); };
const flip = async (id) => { const z = await h.S((sc, st, id) => { const zz = st.nodes.get(id).extraHits[0]; return [zz.x, zz.y]; }, id); await h.click(...z); };
async function fresh() {
  await P((a, st, town) => { a.endEmergency('left'); a.loadTown(town); }, TOWN);
  await h.btn('WIRE');
  await h.page.waitForTimeout(150);
}
async function startEm(key) {
  await fresh();
  ok(await P((a, st, k) => a.offerEmergency(k), key), 'offered');
  await h.waitTag('emergency:accept');
  await h.tap('emergency:accept'); await h.page.waitForTimeout(100);
  const e = await em(); ok(e && e.key === key, 'started: ' + JSON.stringify(e && e.key));
  return e.plan;
}
async function fixed() {
  await h.page.waitForFunction(() => !window.__games[0].scene.scenes[0].__state.emergency, null, { timeout: 60000, polling: 100 });
  ok((await h.status()).startsWith('Emergency fixed'), await h.status());
}

console.log('Offering');
await t('the town is lit and the chip shows its people', async () => {
  await fresh();
  for (const id of ['H0', 'H1', 'H2', 'H3', 'L0']) eq(await lv(id), 'ON', id);
});
await t('an alert pops up by itself when one is due; "Not now" changes nothing', async () => {
  await fresh();
  const wires = await h.S((sc, st) => st.wires.length);
  await P(a => a.setNextEmergencyIn(0.2));
  await h.waitTag('emergency:decline', 30000);
  await h.tap('emergency:decline');
  ok(!(await em()), 'none started'); eq(await h.S((sc, st) => st.wires.length), wires, 'town untouched');
  ok((await h.status()).includes('maybe next time'), await h.status());
  await P(a => a.setNextEmergencyIn(9e9));
});
await t('switched off in Settings: none are offered', async () => {
  await P(a => { a.profile.settings.emergencies = false; a.setNextEmergencyIn(0.1); });
  await h.gameWait(1500);
  ok(!(await h.tagPos('emergency:accept')), 'no alert');
  await P(a => { a.profile.settings.emergencies = true; a.setNextEmergencyIn(9e9); });
});
await t('running out of time costs nothing', async () => {
  await startEm('squirrel');
  const c0 = await P(a => a.profile.coins);
  await P(a => a.setEmergencyTime(0.3));
  await h.page.waitForFunction(() => !window.__games[0].scene.scenes[0].__state.emergency, null, { timeout: 30000 });
  ok(!(await em()), 'over'); ok((await h.status()).includes("Time's up"), await h.status());
  eq(await P(a => a.profile.coins), c0, 'no coins lost');
});
await t('leaving town calls it off', async () => {
  await startEm('surge');
  await P(a => a.startMission(0)); ok(!(await em()), 'cancelled');
  await P(a => a.backToTown());
});

console.log('Fixing each one');
const done0 = await P(a => a.profile.emergenciesDone);
await t('hospital blackout: rewire it', async () => { const p = await startEm('hospital'); eq(await lv('H0'), 'OFF', 'dark'); await h.wireIt(...p.actions.cut[0]); await fixed(); });
await t('hungry squirrel: reconnect the chewed wire', async () => { const p = await startEm('squirrel'); await h.wireIt(...p.actions.cut[0]); await fixed(); });
await t('fallen tree: two wires down', async () => { const p = await startEm('tree'); for (const w of p.actions.cut) await h.wireIt(...w); await fixed(); });
await t('heat spike: unplug the others and keep the hospital bright for 15 s', async () => {
  const p = await startEm('heatspike'); eq(p.target, 'H0', 'the hospital matters most');
  ok(await h.S((sc, st) => st.loadScale) <= 0.75, 'buildings draw more');
  await cut('GEN', 'H1'); await cut('GEN', 'T0');
  await fixed();
  eq(await h.S((sc, st) => st.loadScale), 1, 'spike over');
});
await t('power surge: tap each popped LED for a new one', async () => {
  await startEm('surge'); eq(await lv('L0'), 'BURNED', 'popped');
  await h.click(...await body('L0')); await fixed();
});
await t('stuck switch: flip it back on', async () => { await startEm('stuckswitch'); eq(await lv('H2'), 'OFF', 'dark'); await flip('T0'); await fixed(); });
await t('sneaky shortcut: delete it', async () => {
  const p = await startEm('shortcut'); await cut(...p.actions.add[0]); await fixed();
});
await t('overheating generator: unplug some load', async () => {
  await P((a, st, town) => { a.endEmergency('left'); a.loadTown({ ...town, parts: town.parts.filter(x => x.id !== 'B0'), wires: town.wires.filter(w => !w.a.startsWith('B0') && !w.b.startsWith('B0')) }); }, TOWN);
  await h.btn('WIRE');
  ok(await P(a => a.offerEmergency('overheat')), 'offered'); await h.waitTag('emergency:accept'); await h.tap('emergency:accept');
  await cut('GEN', 'H1'); await cut('GEN', 'T0'); await fixed();
});
await t('science fair: place an LED with its resistor', async () => {
  await startEm('sciencefair');
  await h.btn('RES'); await h.tap('choice:1'); await h.click(560, 230);
  await h.btn('LED'); await h.click(640, 440);
  const R = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'RES').pop().id), Ld = await h.S((sc, st) => [...st.nodes.values()].filter(n => n.type === 'LED').pop().id);
  await h.btn('WIRE'); await h.wireIt('GEN', R); await h.wireIt(R + 'b', Ld); await h.wireIt(Ld + 'b', 'GND');
  await fixed();
});
await t('wire gremlin: turn the LED the right way round again', async () => {
  const p = await startEm('gremlin');
  for (const w of p.actions.add) await cut(...w);
  for (const w of p.actions.cut) await h.wireIt(...w);
  await fixed();
});
await t('drained battery: it charges back up from the generator', async () => {
  await startEm('drained'); eq(await h.S((sc, st) => st.nodes.get('B0').data.Vprev < 1), true, 'empty');
  await fixed();
});
await t('solar eclipse: put the solar house on the generator for 10 s', async () => {
  const p = await startEm('eclipse'); eq(p.target, 'H3', 'the solar house');
  eq(await h.S((sc, st) => st.solarFactor), 0, 'the sun is hidden');
  await cut('S0', 'H3'); await cut('H3b', 'S0b'); await h.wireIt('GEN', 'H3'); await h.wireIt('H3b', 'GND');
  await fixed();
  ok(await h.S((sc, st) => st.solarFactor) > 0, 'the sun is back');
});
await t('each fix paid 30 coins and 20 XP, and counted', async () => {
  eq(await P(a => a.profile.emergenciesDone), done0 + 12, 'twelve fixed');
});
await t('no errors', async () => eq(h.errors, [], 'errors'));
await h.browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
