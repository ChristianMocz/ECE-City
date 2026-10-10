// tests/browser/features.e2e.mjs
//
// Dragging parts to move them, the "Why is it dark?" helper, and the
// training missions, through the real game screen.
import { open } from './harness.mjs';
const h = await open();
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const nodes = () => h.S((sc, st) => [...st.nodes.keys()]);
const lv = id => h.S((sc, st, id) => st.powered.get(id)?.level, id);
const center = id => h.S((sc, st, id) => { const b = st.nodes.get(id).container.getBounds(); return [b.centerX, b.centerY]; }, id);
const pos = id => h.S((sc, st, id) => [st.nodes.get(id).container.x, st.nodes.get(id).container.y], id);
const dragFrom = async (x, y, dx, dy) => { await h.page.mouse.move(x, y); await h.page.mouse.down(); await h.page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 }); await h.page.mouse.move(x + dx, y + dy, { steps: 5 }); await h.page.mouse.up(); await h.page.waitForTimeout(120); };
const wiresFollow = () => h.S((sc, st) => st.wires.every(w => { const a = st.nodes.get(w.a).hit, b = st.nodes.get(w.b).hit, g = w.line.geom; return Math.abs(g.x1 - a.x) < 0.5 && Math.abs(g.y1 - a.y) < 0.5 && Math.abs(g.x2 - b.x) < 0.5 && Math.abs(g.y2 - b.y) < 0.5; }));
const bubbleText = () => h.S(sc => { const b = sc.children.list.find(o => o.type === 'Container' && o.depth === 302 && o.active); return b ? (b.bubbleText ? b.bubbleText.text : null) : null; });
const missionPick = async (i) => { await h.btn('MISSIONS_BTN'); await h.tap('choice:' + i); };


console.log('Feature 1: drag to move');
await t('drag a house: it moves, its dots move, its wires follow', async () => {
  const [x, y] = await center('H0'); const p0 = await pos('H0'); const d0 = await h.dot('H0');
  await dragFrom(x, y, 0, 120);
  const p1 = await pos('H0'); const d1 = await h.dot('H0');
  ok(Math.abs(p1[1] - p0[1] - 120) < 1 && p1[0] === p0[0], `moved ${p0} -> ${p1}`);
  ok(Math.abs(d1[1] - d0[1] - 120) < 1, 'dot moved with it');
  ok(await wiresFollow(), 'every wire still ends exactly on its dots');
  eq(await lv('H0'), 'ON', 'still lit after moving');
  ok((await h.status()).startsWith('Moved H0'), await h.status());
});
await t('UNDO puts the dragged house back', async () => {
  const p1 = await pos('H0'); await h.btn('UNDO'); const p2 = await pos('H0');
  ok(Math.abs(p2[1] - (p1[1] - 120)) < 1, `${p1} -> ${p2}`); ok(await wiresFollow(), 'wires follow after undo');
});
await t('dragging past the edge keeps both dots on the field', async () => {
  const [x, y] = await center('H2'); await dragFrom(x, y, 0, 400);
  const top = await h.dot('H2'), bot = await h.dot('H2b');
  ok(bot[1] <= 590 && top[1] >= 150, `dots ${top[1]}..${bot[1]}`);
  await dragFrom(...(await center('H2')), 0, -600);
  ok((await h.dot('H2'))[1] >= 150, 'top dot below the toolbar');
  await h.btn('UNDO'); await h.btn('UNDO');
});
await t('a tiny wobble is a tap, not a drag', async () => {
  const p0 = await pos('H1'); const [x, y] = await center('H1'); await dragFrom(x, y, 3, 3);
  eq(await pos('H1'), p0, 'did not move'); ok((await bubbleText()) !== null, 'it was a tap: helper bubble shown');
});
await t('drag a switch moves it WITHOUT flipping it; a tap flips it', async () => {
  await h.btn('SWITCH'); await h.click(300, 460);
  const on0 = await h.S((sc, st) => st.nodes.get('T0').data.on);
  const z = await h.S((sc, st) => { const zz = st.nodes.get('T0').extraHits[0]; return [zz.x, zz.y]; });
  await dragFrom(z[0], z[1], 80, 0);
  eq(await h.S((sc, st) => st.nodes.get('T0').data.on), on0, 'drag did not flip');
  const z2 = await h.S((sc, st) => { const zz = st.nodes.get('T0').extraHits[0]; return [zz.x, zz.y]; });
  ok(Math.abs(z2[0] - z[0] - 80) < 1, 'tap zone moved with the switch');
  await h.click(...z2);
  eq(await h.S((sc, st) => st.nodes.get('T0').data.on), !on0, 'tap flipped');
  await h.btn('DELETE'); await h.click(...await h.dot('T0')); await h.btn('WIRE');
});
await t('in a PLACE tool, pressing on an existing part drags it instead of stacking a new one on top', async () => {
  await h.btn('HOUSE'); const n = (await nodes()).length; const [x, y] = await center('H1');
  await dragFrom(x, y, -60, 0); eq((await nodes()).length, n, 'no new part'); await h.btn('UNDO'); await h.btn('WIRE');
});

console.log('Feature 2: why is it dark?');
await t('tap an unwired house: tells you to wire both dots, marks them', async () => {
  const [x, y] = await center('H1'); await h.click(x, y);
  const msg = await h.status(); ok(msg.includes("isn't connected"), msg);
  ok((await bubbleText())?.includes("isn't connected"), 'bubble shown');
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Graphics' && o.depth === 22 && o.commandBuffer.length > 0)), 'gap marks drawn');
});
await t('wire only the orange dot: now it says power has no way home', async () => {
  await h.wireIt('GEN', 'H1'); const [x, y] = await center('H1'); await h.click(x, y);
  ok((await h.status()).includes('no way home'), await h.status());
});
await t('wiring something clears the old highlight', async () => {
  await h.wireIt('H1b', 'GND');
  ok(await h.S(sc => !sc.children.list.some(o => o.type === 'Graphics' && (o.depth === 22 || o.depth === 9) && o.commandBuffer.length > 0)), 'highlight cleared');
});
await t('tap a lit house: celebrates the complete loop, glows its wires green', async () => {
  const [x, y] = await center('H1'); await h.click(x, y);
  ok((await h.status()).includes('complete loop'), await h.status());
  ok(await h.S(sc => sc.children.list.some(o => o.type === 'Graphics' && o.depth === 9 && o.commandBuffer.length > 0)), 'loop glow drawn');
});
await t('the helper bubble goes away on its own', async () => {
  await h.page.waitForTimeout(8400); eq(await bubbleText(), null, 'bubble');
});
await t('? HINT in free build gives the general tip', async () => {
  await h.btn('HINT_BTN'); ok((await h.status()).includes('Tap a dark building'), await h.status());
});

console.log('Feature 3: missions');

await t('MISSIONS menu lists 5 missions (no "back to town" while in town)', async () => {
  await h.btn('MISSIONS_BTN');
  const labels = await h.S(sc => { const L = sc.children.list.find(o => o.type === 'Container' && o.depth === 500); return L.list.filter(o => o.type === 'Text').map(o => o.text); });
  ok(labels.some(l => l.startsWith('1. Light it up!')) && labels.some(l => l.startsWith('5. Capacitor power')) && !labels.includes('Back to my town'), JSON.stringify(labels));
  await h.click(120, 600 - 20); // dismiss? that's the status bar area under the dimmer -> closes
});
await t('Mission 1: board resets, banner shows the goal, wiring H1 wins with a celebration', async () => {
  await missionPick(0);
  eq((await nodes()).sort(), ['GEN', 'GND', 'H0', 'H0b', 'H1', 'H1b', 'H2', 'H2b'], 'starter town');
  ok((await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.y < 12 && o.x === 20)?.text || ''))?.includes('Mission 1/5'), 'banner');
  await h.btn('HINT_BTN'); ok((await h.status()).includes("GEN's orange dot"), 'mission hint');
  await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
  ok((await h.status()).startsWith('You did it!'), await h.status());
  ok(await h.S(sc => sc.children.list.some(o => o.depth === 401)), 'celebration banner on screen');
});
await t('a mission starts with nothing to UNDO (your town is saved, not undone)', async () => {
  await missionPick(1); await h.btn('UNDO'); eq(await h.status(), 'Nothing to undo yet.', 'status');
});
await t('Mission 1 now shows a ✓ in the list', async () => {
  await h.btn('MISSIONS_BTN');
  const labels = await h.S(sc => { const L = sc.children.list.find(o => o.type === 'Container' && o.depth === 500); return L.list.filter(o => o.type === 'Text').map(o => o.text); });
  ok(labels.includes('✓ 1. Light it up!') && labels.includes('Back to my town'), JSON.stringify(labels)); await h.tap('choice:1');
});
await t('Mission 2: two houses is not enough, three wins', async () => {
  await h.wireIt('GEN', 'H1'); await h.wireIt('H1b', 'GND');
  ok(!(await h.status()).startsWith('You did it'), 'not yet');
  await h.wireIt('GEN', 'H2'); await h.wireIt('H2b', 'GND');
  ok((await h.status()).startsWith('You did it!'), await h.status());
});
await t('Mission 3: unprotected LED pops (no win); Medium resistor wins', async () => {
  await missionPick(2);
  await h.wireIt('GEN', 'L0'); await h.wireIt('L0b', 'GND');
  eq(await lv('L0'), 'BURNED', 'popped'); ok(!(await h.status()).startsWith('You did it'), 'no win');
  await h.btn('LED'); await h.click(560, 470);
  await h.btn('RES'); await h.tap('choice:1'); await h.click(330, 230);
  const L = (await nodes()).filter(n => /^L\d+$/.test(n)).pop();
  await h.btn('WIRE'); await h.wireIt('GEN', 'R0'); await h.wireIt('R0b', L); await h.wireIt(L + 'b', 'GND');
  ok((await h.status()).startsWith('You did it!'), await h.status());
});
await t('Mission 4: the switch must turn the house off and back on', async () => {
  await missionPick(3);
  await h.wireIt('GEN', 'T0'); await h.wireIt('T0b', 'H0'); await h.wireIt('H0b', 'GND');
  eq(await lv('H0'), 'ON', 'lit'); ok(!(await h.status()).startsWith('You did it'), 'not yet');
  const z = await h.S((sc, st) => { const zz = st.nodes.get('T0').extraHits[0]; return [zz.x, zz.y]; });
  await h.click(...z); eq(await lv('H0'), 'OFF', 'off'); ok(!(await h.status()).startsWith('You did it'), 'not yet');
  await h.click(...z); ok((await h.status()).startsWith('You did it!'), await h.status());
});
await t('Mission 5: charge the capacitor, unplug GEN, house stays lit -> win', async () => {
  await missionPick(4);
  await h.wireIt('GEN', 'C0'); await h.wireIt('C0b', 'GND'); await h.wireIt('C0', 'H0'); await h.wireIt('H0b', 'GND');
  await h.page.waitForTimeout(8000);
  ok(!(await h.status()).startsWith('You did it'), 'not while GEN is connected');
  await h.btn('DELETE'); const [a, b] = [await h.dot('GEN'), await h.dot('C0')];
  await h.click(a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25);
  await h.page.waitForTimeout(300);
  ok((await h.status()).startsWith('You did it!'), await h.status());
  ok((await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.x === 20 && o.y < 12)?.text || '')).includes('complete'), 'banner says complete');
  await h.btn('WIRE');
});
await t('"Back to my town" ends the mission and restores the title', async () => {
  await missionPick(5);
  eq(await h.S(sc => sc.children.list.find(o => o.type === 'Text' && o.x === 20 && o.y === 10)?.text), 'Sparkville', 'title');
  eq(await h.S((sc, st) => st.context), 'town', 'context');
});
await t('progress is remembered after reloading the page', async () => {
  await h.page.reload(); await h.page.waitForFunction(() => window.__games?.[1]?.scene?.scenes?.[0]?.__state || window.__games?.[0]?.scene?.scenes?.[0]?.__state);
  await h.page.waitForTimeout(400);
  const labels = await h.page.evaluate(() => { const g = window.__games[window.__games.length - 1]; const sc = g.scene.scenes[0]; sc.events.emit('missions-requested'); const L = sc.children.list.find(o => o.type === 'Container' && o.depth === 500); return L.list.filter(o => o.type === 'Text').map(o => o.text); });
  ok(['✓ 1.', '✓ 2.', '✓ 3.', '✓ 4.', '✓ 5.'].every(p => labels.some(l => l.startsWith(p))), JSON.stringify(labels) + await h.page.evaluate(() => localStorage.getItem('ececity.missionsDone')));
});
await t('no console/page errors at any point', async () => { eq(h.errors, [], 'errors'); });
console.log(`\n${pass} passed, ${fail} failed`);
await h.browser.close();
process.exitCode = fail ? 1 : 0;
