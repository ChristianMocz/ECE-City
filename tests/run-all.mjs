// tests/run-all.mjs
//
// Runs every unit test file (tests/*.test.mjs) one after another and prints
// a total. These test the game's rules and the circuit solver, no browser.
//
// Run: node tests/run-all.mjs   (or: npm test)
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE).filter(f => f.endsWith('.test.mjs')).sort();
let passed = 0, failed = 0;
for (const f of files) {
  const run = spawnSync(process.execPath, [path.join(HERE, f)], { encoding: 'utf8' });
  const out = run.stdout + run.stderr;
  const m = out.match(/(\d+) passed, (\d+) failed/);
  const p = m ? +m[1] : 0, x = m ? +m[2] : 1;
  passed += p; failed += x;
  console.log(`${x || run.status ? 'FAIL' : 'ok  '}  ${f.padEnd(24)} ${p} passed, ${x} failed`);
  if (x || run.status) console.log(out.split('\n').filter(l => /FAIL|Error/.test(l)).join('\n'));
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
