// tests/browser/run-all.mjs
//
// Runs every browser suite (tests/browser/*.e2e.mjs) one after another.
// Each one opens the real game in headless Chromium and plays it by tapping
// the screen. Slow (about 15 minutes in all), so run one suite while you work:
//   node tests/browser/game.e2e.mjs
//
// Run all: node tests/browser/run-all.mjs   (or: npm run test:browser)
// Needs Playwright: npm install, then npx playwright install chromium.
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = readdirSync(HERE).filter(f => f.endsWith('.e2e.mjs') && (!only.length || only.some(o => f.startsWith(o)))).sort();
let passed = 0, failed = 0;
for (const f of files) {
  console.log(`== ${f}`);
  const run = spawnSync(process.execPath, [path.join(HERE, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = run.stdout.split('\n');
  for (const l of lines) if (!l.startsWith('  ok')) console.log(l);
  const m = run.stdout.match(/(\d+) passed, (\d+) failed/);
  passed += m ? +m[1] : 0; failed += m ? +m[2] : 1;
}
console.log(`\nAll suites: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
