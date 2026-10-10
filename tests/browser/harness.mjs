// tests/browser/harness.mjs
//
// Opens the real game in a headless Chromium (Playwright) and gives the
// browser suites short helpers: click, tap a tagged button, wire two dots,
// read the game state, and call the game's own test API (scene.__api).
//
// Settings (environment variables, all optional):
//   ROOT    the game folder (default: this repo)
//   PAGE    the page to open (default: index.html; try ece-city-play.html)
//   CHROME  a Chromium to use instead of Playwright's own
//   NO_CDN  block the CDN copy of Phaser, so lib/phaser.min.js must load
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ROOT || path.resolve(HERE, '../..');
const phaser = fs.readFileSync(path.join(ROOT, 'lib/phaser.min.js'), 'utf8');

// opts.seed: profile fields to write into localStorage before the game
// loads (only if no save exists yet). Default: a max-level, rich player with
// Sparky off and today's gift already opened, so old tests see a plain board.
// opts.seed === null: no seeding (a brand-new player).
export async function open(opts = {}) {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const context = await browser.newContext({ viewport: { width: 900, height: 640 } });
  const page = await context.newPage();
  const errors = [];
  await page.addInitScript(() => {
    let P; window.__games = [];
    Object.defineProperty(window, 'Phaser', { configurable: true, get() { return P; }, set(v) {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__games.push(g); return g; }; v.Game.prototype = G.prototype; P = v; } });
  });
  // Skip the title screen unless a test is about it.
  if (!opts.title) await page.addInitScript(() => { window.ECE_SKIP_TITLE = true; });
  const seed = opts.seed === undefined ? {} : opts.seed;
  if (seed !== null) {
    await page.addInitScript((seed) => {
      try {
        if (localStorage.getItem('ececity.save.v1')) return;
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ALL = ['wire','levels','hint','undo','today','phone','delete','build','settings','howto','title','shop','orders','clothes','clear','count','notebook','records','daily','map','stickers','skip','lines','maker','playcode'];
        // Levels 1-6 done unlocks every toolbar button and the starter phone apps (tests that
        // are about unlocking seed their own campaign).
        const base = { campaign: { 'sparkville-1': 1, 'sparkville-2': 1, 'sparkville-3': 1, 'sparkville-4': 1, 'sparkville-5': 1, 'sparkville-6': 1 }, seenFeatures: ALL, announced: ALL, coins: 99999, xp: 5000, seenIntro: true, settings: { sparky: false }, daily: { giftDay: today, lastLoginDay: today, loginStreak: 1 }, orders: [null, null, null], refillAt: [9e15, 9e15, 9e15],
          // A new town is empty; most tests start from three houses (the old starter town).
          towns: { sparkville: { counters: { H: 3 }, parts: [{ kind: 'HOUSE', id: 'H0', x: 430, y: 260 }, { kind: 'HOUSE', id: 'H1', x: 650, y: 260 }, { kind: 'HOUSE', id: 'H2', x: 650, y: 440 }], wires: [{ a: 'GEN', b: 'H0' }, { a: 'H0b', b: 'GND' }] } } };
        localStorage.setItem('ececity.save.v1', JSON.stringify({ ...base, ...seed, settings: { ...base.settings, ...(seed.settings || {}) }, daily: { ...base.daily, ...(seed.daily || {}) } }));
      } catch (e) {}
    }, seed);
  }
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const cdnHits = []; await page.route('https://cdn.jsdelivr.net/**', r => { cdnHits.push(r.request().url()); return process.env.NO_CDN ? r.abort() : r.fulfill({ body: phaser, contentType: 'application/javascript' }); });
  await page.goto((process.env.BASEURL || 'file://' + ROOT.split(path.sep).join('/')) + '/' + (process.env.PAGE || 'index.html'));
  if (process.env.NO_WAIT) return { browser, page, errors, cdnHits };
  await page.waitForFunction(() => window.__games?.[0]?.scene?.scenes?.[0]?.__api);
  // Deterministic world: clock stopped in the daytime, fair weather.
  if (opts.live !== true) await page.evaluate(() => { const sc = window.__games[0].scene.scenes[0]; sc.__state.clockFrozen = true; sc.__api.setWeather('normal'); });
  await page.waitForTimeout(300);
  const S = (fn, arg) => page.evaluate(([f, a]) => { const sc = window.__games[0].scene.scenes[0]; return eval(f)(sc, sc.__state, a); }, [fn.toString(), arg]);
  const click = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(80); };
  const dot = (id) => S((sc, st, id) => { const n = st.nodes.get(id); return n ? [n.hit.x, n.hit.y] : null; }, id);
  const wireIt = async (a, b) => { const pa = await dot(a), pb = await dot(b); await click(...pa); await click(...pb); };
  const levels = () => S((sc, st) => Object.fromEntries([...st.powered].map(([k, v]) => [k, v.level + ' ' + v.V.toFixed(2) + 'V ' + v.I.toFixed(4) + 'A'])));
  const status = () => S((sc) => sc.__status.text);
  const supply = () => S((sc, st) => st.nodes.get('GEN').visual.supplyLabel.text);
  const shot = (n) => { fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true }); return page.screenshot({ path: path.join(HERE, 'shots', n + '.png') }); };
  // Find a tagged, live, interactive thing (buttons and tiles carry .tag).
  const tagPos = (tag) => S((sc, st, tag) => {
    let found = null;
    const walk = (list) => { for (const o of list) { if (o.tag === tag && o.active && o.input) { o.parentContainer?.__scrollInto?.(o); found = [o.x + (o.parentContainer?.x || 0), o.y + (o.parentContainer?.y || 0)]; } if (o.list) walk(o.list); } };
    walk(sc.children.list);
    return found;
  }, tag);
  const tap = async (tag) => { const p = await tagPos(tag); if (!p) throw new Error('no tag ' + tag); await click(...p); };
  // Wait until a tagged thing is on screen (game time runs slowly headless).
  const waitTag = (tag, timeout = 20000) => page.waitForFunction((tag) => { const sc = window.__games[0].scene.scenes[0]; let f = false; const w = (l) => { for (const o of l) { if (o.tag === tag && o.active && o.input) f = true; if (o.list) w(o.list); } }; w(sc.children.list); return f; }, tag, { timeout, polling: 100 });
  const gameWait = (ms) => page.waitForFunction((ms) => { const sc = window.__games[0].scene.scenes[0]; window.__gw0 ??= sc.time.now; if (sc.time.now - window.__gw0 >= ms) { window.__gw0 = undefined; return true; } return false; }, ms, { polling: 50, timeout: 120000 });
  // Toolbar: two rows (see src/ui/hud.js); everything else is an app in the PHONE.
  const BTN = {
    WIRE:[360,34], BUILD:[456,34], DELETE:[552,34], UNDO:[648,34], REDO:[742,34],
    LEVELS:[371,92], TODAY:[489,92], PHONE:[627,92], HINT_BTN:[746,92],
    ENGINEER:[843,60], NUMS:[60,77], DETAILS:[60,96], SPARKY:[60,115],
  };
  const APPS = { SHOP: ['town', 'shop'], DAILY: ['town', 'daily'], SKIP: ['town', 'skip'], CLEAR: ['town', 'clear'], RUN: ['town', 'count'],
    MAP: ['world', 'map'], LINES: ['world', 'lines'], STICKERS: ['me', 'stickers'], CLOTHES: ['me', 'clothes'], NOTEBOOK: ['me', 'notebook'], RECORDS: ['me', 'records'],
    MAKER: ['make', 'maker'], PLAYCODE: ['make', 'playcode'], SETTINGS: ['settings', 'settings'], HOWTO: ['settings', 'howto'], TITLE: ['settings', 'title'] };
  // Parts are in the BUILD menu now.
  const PARTS_VIA_BUILD = { HOUSE: 'HOUSE', LED: 'LED', XFMR: 'XFMR', RES: 'RES', SWITCH: 'TRANS', CAP: 'CAP', SOLAR: 'SOLAR', BAT: 'BAT' };
  const app = async (tab, key) => { await click(...BTN.PHONE); await tap('phonetab:' + tab); await tap('app:' + key); };
  const btn = async (k) => {
    if (PARTS_VIA_BUILD[k]) { await click(...BTN.BUILD); await tap('build:' + PARTS_VIA_BUILD[k]); return; }
    // MISSIONS now live in LEVELS → Training.
    if (k === 'MISSIONS_BTN') { await click(...BTN.LEVELS); await tap('levels:training'); return; }
    if (k === 'MENU') { await click(...BTN.PHONE); await tap('phonetab:settings'); return; }
    if (k === 'ORDERS') { await click(...BTN.TODAY); await tap('today:orders'); return; } // orders live on the Today board
    if (APPS[k]) { await app(...APPS[k]); return; }
    await click(...BTN[k]);
  };
  const api = (fn, arg) => page.evaluate(([f, a]) => { const sc = window.__games[0].scene.scenes[0]; return eval(f)(sc.__api, sc.__state, a); }, [fn.toString(), arg]);
  return { browser, context, page, errors, cdnHits, S, click, dot, wireIt, levels, status, supply, shot, btn, app, tap, tagPos, api, BTN, APPS, waitTag, gameWait };
}
