#!/usr/bin/env node
// Colony Sim — headless tests over the DOM-free modules in ../src.
//   node games/colony-sim/tools/test-sim.mjs [section ...]
// Prints one line per check and SIM-TESTS: GREEN|RED last (exit 0/1).
const only = process.argv.slice(2);
let fails = 0, passes = 0;
export function check(name, cond, detail) {
  if (cond) { passes++; console.log('  ok   ' + name); }
  else { fails++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + detail : '')); }
}
const sections = [];
const section = (name, fn) => sections.push({ name, fn });

/* ---------------- rng ---------------- */
section('rng', async () => {
  const { makeRng, hashState } = await import('../src/rng.js');
  const a = makeRng(42), b = makeRng(42);
  let same = true;
  for (let i = 0; i < 1000; i++) if (a.next() !== b.next()) same = false;
  check('rng determinism: same seed, same 1000 values', same);
  const r = makeRng(7); let inRange = true;
  for (let i = 0; i < 10000; i++) { const v = r.next(); if (!(v >= 0 && v < 1)) inRange = false; }
  check('rng range: next() in [0,1)', inRange);
  const p = makeRng(9), sa = p.stream('a'), sb = p.stream('b');
  const A = [...Array(20)].map(() => sa.next()), B = [...Array(20)].map(() => sb.next());
  check('streams differ', A.join() !== B.join());
  const q = makeRng(9), qa = q.stream('a'), qb = q.stream('b');
  for (let i = 0; i < 500; i++) qb.next();          // drawing from b must not shift a
  const A2 = [...Array(20)].map(() => qa.next());
  check('streams independent', A.join() === A2.join());
  const ints = [...Array(2000)].map(() => r.int(3, 5));
  check('int inclusive range', ints.every(v => v >= 3 && v <= 5) && ints.includes(3) && ints.includes(5));
  check('hashState stable', hashState({ a: 1, b: [2, 3] }) === hashState({ a: 1, b: [2, 3] }) && hashState({ a: 1 }) !== hashState({ a: 2 }));
});

for (const s of sections) {
  if (only.length && !only.includes(s.name)) continue;
  console.log('[' + s.name + ']');
  try { await s.fn(); } catch (e) { fails++; console.log('  FAIL ' + s.name + ' threw: ' + (e && e.stack || e)); }
}
console.log((fails ? 'SIM-TESTS: RED' : 'SIM-TESTS: GREEN') + ` (${passes} passed, ${fails} failed)`);
process.exit(fails ? 1 : 0);
