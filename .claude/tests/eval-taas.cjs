#!/usr/bin/env node
/**
 * eval-taas.cjs — balance eval for games/taas/index.html (pure node, ~2 s).
 *
 * Plays named strategies through the page's own engine block and prints the
 * table the CD tunes against, then asserts the SHAPE the design depends on:
 * the traditional run is exactly 480, funding year 1 dips below the goal (the
 * J-curve), the dip pays back, sequencing matters, over-investing loses, skill
 * beats coasting, and L5 stays on the horizon. Every number in the engine is a
 * first-draft guess, so these rows are expected to need revisiting when the CD
 * retunes; that is why they are an eval (gates.sh --eval) and not in the rules
 * gate, drive-taas.cjs. Rows marked (current tuning) pin a choice the CD has not
 * made yet; see .claude/taas.md § Open questions before "fixing" one.
 *
 * Usage:
 *   node .claude/tests/eval-taas.cjs             # table + shape checks
 *   node .claude/tests/eval-taas.cjs --search    # + seeded random search and hill climb (~10 s)
 *
 * Final line: TAAS-EVAL: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy (TAAS_PAGE).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const SEARCH = process.argv.includes('--search');

function loadEngine(page) {
  const src = fs.readFileSync(page, 'utf8');
  const a = src.indexOf('const TAAS = (function');
  const end = "if (typeof module !== 'undefined') module.exports = TAAS;";
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('engine block not found in ' + page);
  return new Function(src.slice(a, b) + '\nreturn TAAS;')();
}
const T = loadEngine(PAGE);

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' (' + detail + ')' : '')); }
}
function play(planFor) {
  let s = T.newGame();
  while (s.q < 8) {
    const p = planFor(s);
    if (!T.forecast(s, p).valid) throw new Error('strategy built an invalid plan at ' + T.CFG.quarters[s.q]);
    s = T.commit(s, p);
  }
  return s;
}

// A hand-played line that reaches L3b at Y2Q1 and L4 at Y2Q3 (2026-10-09 tuning).
const SKILLED = [{ opp: true, inv: {} }, { opp: true, inv: { demo: 2 } }, { opp: true, inv: {} }, { opp: true, inv: { evals: 6, train: 2 } },
  { opp: true, inv: { shared: 6, train: 4, demo: 2 } }, { opp: true, inv: { prompt: 4, habits: 2 } }, { opp: true, inv: { shared: 2, evals: 2 } }, { opp: true, inv: { shared: 2, evals: 2 } }];
// The same opportunities, with ongoing investment held back until year 2.
const CAUTIOUS = [{ opp: true, inv: {} }, { opp: true, inv: {} }, { opp: true, inv: {} }, { opp: true, inv: {} },
  { opp: true, inv: { evals: 2, train: 2 } }, { opp: true, inv: { shared: 6, train: 4, demo: 2 } }, { opp: true, inv: { shared: 2, evals: 2, prompt: 4 } }, { opp: true, inv: { shared: 2, evals: 2 } }];
// Opportunities plus 24 SP a quarter spread across whatever is unlocked.
function heavy(s) {
  const plan = { opp: true, inv: {} }; let left = 24;
  for (const i of T.unlocked(s)) {
    if (left < 4) break;
    const trial = { opp: true, inv: Object.assign({}, plan.inv, { [i.id]: 4 }) };
    if (T.forecast(s, trial).valid) { plan.inv = trial.inv; left -= 4; }
  }
  return plan;
}

const STRATS = {
  'traditional': () => T.emptyPlan(),
  'all 8 opportunities only': () => ({ opp: true, inv: {} }),
  'stance + workshop only': s => ({ opp: s.q < 2, inv: {} }),
  'year 1 opportunities, coast': s => ({ opp: s.q < 4, inv: {} }),
  'skip Q3+Q4, then year 2': s => ({ opp: s.q < 2 || s.q >= 4, inv: {} }),
  'hand-played skilled line': s => SKILLED[s.q],
  'cautious line': s => CAUTIOUS[s.q],
  'opportunities + 24 SP/quarter': heavy
};

const R = {};
console.log('strategy                         Y1      Y2   total   exit  score  level  grade');
for (const [name, fn] of Object.entries(STRATS)) {
  const s = play(fn), m = T.summary(s);
  R[name] = { s, m };
  console.log(name.padEnd(30) + String(m.y1).padStart(6) + String(m.y2).padStart(8) + String(m.total).padStart(8) + String(m.exit).padStart(7)
    + String(m.score).padStart(7) + '  ' + T.LEVELS[s.level].id.padEnd(5) + '  ' + m.grade + (s.budgetCut ? '  (Y2 budget cut)' : ''));
}
console.log('');

const g = n => R[n].m, lvl = n => R[n].s.level;
const cut = T.CFG.yearGoal * T.CFG.budgetCutThreshold;
ok(g('traditional').total === 480 && g('traditional').score === 0, 'the traditional run is exactly 480 and scores 0');
ok(g('all 8 opportunities only').y1 < 240 && g('all 8 opportunities only').y1 >= cut,
  'the J-curve: funding all four year-1 opportunities dips year 1 below 240 but not into the budget cut', g('all 8 opportunities only').y1);
ok(g('all 8 opportunities only').total >= 500 && g('all 8 opportunities only').score >= 60,
  'the dip pays back: the opportunities alone beat the traditional run inside two years', g('all 8 opportunities only').total + ', score ' + g('all 8 opportunities only').score);
ok(g('skip Q3+Q4, then year 2').total < g('all 8 opportunities only').total - 20,
  'sequencing matters: skipping the context steps leaves the team unready for year 2', g('skip Q3+Q4, then year 2').total);
ok(g('opportunities + 24 SP/quarter').total < 480, 'over-investing loses: 24 SP a quarter of ongoing work never pays back in time', g('opportunities + 24 SP/quarter').total);
ok(g('hand-played skilled line').score > g('all 8 opportunities only').score + 40 && lvl('hand-played skilled line') >= 5,
  'skill beats coasting: targeted ongoing investment reaches L4 and out-scores the opportunities alone',
  g('hand-played skilled line').score + ' vs ' + g('all 8 opportunities only').score + ', ' + T.LEVELS[lvl('hand-played skilled line')].id);
ok(g('hand-played skilled line').total > g('all 8 opportunities only').total, 'and ships more units, not only a better exit rate', g('hand-played skilled line').total);
ok(g('stance + workshop only').y1 >= 240, '(current tuning) a minimal year 1 can still meet the goal', g('stance + workshop only').y1);
ok(Object.values(R).every(r => r.s.level < 6), 'L5 stays on the horizon for every named line');

if (SEARCH) {
  let seed = 1;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const randomPlan = (s, k) => {
    const plan = { opp: rnd() < 0.9, inv: {} }; const av = T.unlocked(s);
    for (let i = 0, n = Math.floor(rnd() * (k + 1)); i < n; i++) {
      const it = av[Math.floor(rnd() * av.length)], v = (plan.inv[it.id] || 0) + 2;
      if (v > 12) continue;
      const trial = { opp: plan.opp, inv: Object.assign({}, plan.inv, { [it.id]: v }) };
      if (T.forecast(s, trial).valid) plan.inv = trial.inv;
    }
    return plan;
  };
  const totals = []; let best = null;
  for (let n = 0; n < 20000; n++) {
    const plans = []; const k = 1 + Math.floor(rnd() * 8);
    const s = play(st => { const p = randomPlan(st, k); plans.push(p); return p; });
    const m = T.summary(s); totals.push(m.total);
    if (!best || m.score > best.m.score) best = { m, plans, s };
  }
  totals.sort((a, b) => a - b);
  const pc = p => totals[Math.floor(totals.length * p)];
  console.log('\nrandom 20000: beat 480 ' + (totals.filter(t => t > 480).length / 200).toFixed(1) + '%  p10 ' + pc(0.1) + '  p50 ' + pc(0.5) + '  p90 ' + pc(0.9));
  let cur = best;
  for (let i = 0; i < 20000; i++) {
    const np = cur.plans.map(p => ({ opp: p.opp, inv: Object.assign({}, p.inv) }));
    const q = Math.floor(rnd() * 8);
    if (rnd() < 0.15) np[q].opp = !np[q].opp;
    else { const it = T.INVESTS[Math.floor(rnd() * T.INVESTS.length)], v = (np[q].inv[it.id] || 0) + (rnd() < 0.5 ? 2 : -2); if (v < 0 || v > 12) continue; if (v) np[q].inv[it.id] = v; else delete np[q].inv[it.id]; }
    let s;
    try { s = play(st => np[st.q]); } catch (e) { continue; }
    const m = T.summary(s);
    if (m.score >= cur.m.score) cur = { m, plans: np, s };
  }
  console.log('hill-climbed best: Y1 ' + cur.m.y1 + '  Y2 ' + cur.m.y2 + '  total ' + cur.m.total + '  exit ' + cur.m.exit + '  score ' + cur.m.score + '  ' + T.LEVELS[cur.s.level].id);
  console.log('  units ' + cur.s.history.map(h => h.units + '(' + T.LEVELS[h.levelBefore].id + ')').join(' '));
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-EVAL: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
