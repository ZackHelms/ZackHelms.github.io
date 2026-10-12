#!/usr/bin/env node
/**
 * drive-taas.cjs — rules gate for games/taas/index.html (pure node, ~0.2 s).
 *
 * TAAS keeps its whole simulation in one DOM-free block (`const TAAS = (function
 * () { ... })()`), so the rules are checked here against that block, lifted out
 * of the page, with no browser. RULES only: what the engine promises whatever
 * its numbers are (a forecast is the result, a refusal changes nothing, skills
 * pay next quarter, one level a quarter, the year-1 budget cut, the score
 * formula). BALANCE (does investing pay, does over-investing lose) lives in
 * eval-taas.cjs, so a deliberate retune never turns this gate red.
 *
 * Usage:
 *   node .claude/tests/drive-taas.cjs
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas.cjs   # negtest-copies
 *
 * Final line: TAAS: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');

function loadEngine(page) {
  const src = fs.readFileSync(page, 'utf8');
  const a = src.indexOf('const TAAS = (function');
  const end = "if (typeof module !== 'undefined') module.exports = TAAS;";
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('engine block not found in ' + page);
  return new Function(src.slice(a, b) + '\nreturn TAAS;')();
}

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' (' + detail + ')' : '')); }
}

let T;
try { T = loadEngine(PAGE); } catch (e) { console.log('FAIL engine loads (' + e.message + ')'); console.log('TAAS: RED'); process.exit(1); }
const C = T.CFG;

// seeded PRNG so the random sweeps are the same sweep every run
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function randomPlan(s, r) {
  const plan = { opp: r() < 0.8, inv: {} };
  const avail = T.unlocked(s);
  const n = Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const it = avail[Math.floor(r() * avail.length)];
    const next = (plan.inv[it.id] || 0) + C.investStep;
    if (next > C.investMax) continue;
    const trial = { opp: plan.opp, inv: Object.assign({}, plan.inv, { [it.id]: next }) };
    if (T.forecast(s, trial).valid) plan.inv = trial.inv;
  }
  return plan;
}
function play(planFor) {
  let s = T.newGame();
  const frames = [];
  while (s.q < 8) {
    const plan = planFor(s);
    const f = T.forecast(s, plan);
    const next = T.commit(s, plan);
    frames.push({ s, plan, f, next });
    s = next;
  }
  return { s, frames };
}

/* ---------- 1. the tables ---------- */
ok(C.quarters.length === 8 && T.OPPS.length === 8, 'eight quarters, one scripted opportunity each', C.quarters.length + '/' + T.OPPS.length);
ok(T.LEVELS.length === 7 && T.LEVELS.map(l => l.id).join() === 'L0,L1,L2,L3a,L3b,L4,L5', 'the ladder is L0 L1 L2 L3a L3b L4 L5', T.LEVELS.map(l => l.id).join());
ok(C.sp * 4 === C.yearGoal, 'with no AI, 60 SP a quarter ships exactly the yearly goal', C.sp * 4 + ' vs ' + C.yearGoal);
const statKeys = new Set(T.STATS);
const badKeys = [];
T.OPPS.forEach(o => Object.keys(o.gain).forEach(k => { if (!statKeys.has(k)) badKeys.push(o.id + '.' + k); }));
T.INVESTS.forEach(i => Object.keys(i.rate).forEach(k => { if (!statKeys.has(k)) badKeys.push(i.id + '.' + k); }));
T.LEVELS.forEach(l => Object.keys(l.req).forEach(k => { if (!statKeys.has(k)) badKeys.push(l.id + '.' + k); }));
ok(!badKeys.length, 'every gain, rate and requirement names a real stat', badKeys.join(', '));
ok(T.OPPS.every(o => o.minLevel >= 0 && o.minLevel < 7) && T.INVESTS.every(i => i.unlock >= 0 && i.unlock < 7), 'every readiness and unlock level is on the ladder');
ok(T.OPPS.every(o => o.sp <= C.sp && o.aic <= C.aic && o.short && o.title && o.pitch && o.basis), 'every opportunity is affordable alone and has its copy');
const mono = [];
for (let i = 1; i < T.LEVELS.length; i++) {
  const lo = T.LEVELS[i - 1], hi = T.LEVELS[i];
  Object.keys(hi.req).forEach(k => { if (lo.req[k] !== undefined && hi.req[k] < lo.req[k]) mono.push(hi.id + '.' + k); });
  if (hi.mult < lo.mult || hi.burn < lo.burn) mono.push(hi.id + ' speedup/burn');
}
ok(!mono.length, 'each level asks at least as much as the one below, and gives and costs more', mono.join(', '));

/* ---------- 2. the traditional run ---------- */
{
  const { s } = play(() => T.emptyPlan());
  const m = T.summary(s);
  ok(s.history.every(h => h.units === 60), 'the traditional run ships 60 units every quarter', s.history.map(h => h.units).join());
  ok(m.y1 === 240 && m.y2 === 240 && m.total === 480, 'and exactly 240 a year', m.y1 + '/' + m.y2);
  ok(s.level === 0 && m.score === 0 && m.grade === 'Traditional' && m.exit === 60, 'and scores 0 at L0, graded Traditional', [s.level, m.score, m.grade, m.exit].join());
}

/* ---------- 3. preview is the result, and the bounds hold, over a seeded sweep ---------- */
{
  const r = rng(20261012);
  let mismatch = '', bound = '', ladder = '', runs = 0;
  for (let n = 0; n < 400; n++) {
    const { frames } = play(s => randomPlan(s, r));
    runs++;
    for (const { s, f, next } of frames) {
      const h = next.history[next.history.length - 1];
      if (!mismatch && (h.units !== f.out.units || JSON.stringify(next.stats) !== JSON.stringify(f.after) || next.level !== f.nextLevel))
        mismatch = 'run ' + n + ' ' + f.quarter;
      if (!bound && (f.aicUsed > f.budget + 1e-6 || h.units < 0 || T.STATS.some(k => next.stats[k] < 0 || next.stats[k] > 100) || !(next.burnFactor > 0 && next.burnFactor <= 1)))
        bound = 'run ' + n + ' ' + f.quarter + ' aic ' + f.aicUsed + '/' + f.budget;
      if (!ladder && (next.level < s.level || next.level > s.level + 1)) ladder = 'run ' + n + ' ' + f.quarter + ' ' + s.level + '->' + next.level;
    }
  }
  ok(!mismatch, 'the forecast on screen is exactly what running the quarter does (' + runs + ' seeded runs)', mismatch);
  ok(!bound, 'credits never overspend, units never go negative, stats stay 0-100', bound);
  ok(!ladder, 'the team never drops a level and climbs at most one a quarter', ladder);
}

/* ---------- 4. refusals change nothing ---------- */
{
  const s = T.newGame();
  const tooMuchSp = { opp: true, inv: { train: 60 } };
  const f = T.forecast(s, tooMuchSp);
  ok(!f.valid && T.commit(s, tooMuchSp) === s, 'a plan that spends more than 60 SP is refused and changes nothing', f.deliverySp);
  let st = s;
  for (let q = 0; q < 6; q++) st = T.commit(st, { opp: true, inv: { train: 2 } });
  const unlocked = T.unlocked(st).map(i => i.id);
  const pricey = unlocked.includes('agents') ? { opp: true, inv: { agents: 12, evals: 12, shared: 12, personal: 12 } } : null;
  if (!pricey) ok(false, 'an over-budget plan can be built for the AIC refusal row', 'agents not unlocked by Y2Q3: ' + unlocked.join());
  else {
    const cut = Object.assign({}, st, { budgetCut: true });   // year 2 on the cut budget
    const g = T.forecast(cut, pricey);
    ok(g.deliverySp >= 0 && g.aicLeft < 0 && !g.valid && T.commit(cut, pricey) === cut, 'a plan that spends more AI credits than the budget is refused', 'sp ' + g.deliverySp + ' aic ' + g.aicLeft);
  }
}

/* ---------- 5. timing: what you buy this quarter pays next quarter ---------- */
{
  const s1 = T.commit(T.newGame(), { opp: true, inv: {} });
  const a = T.forecast(s1, { opp: true, inv: { train: 4 } }), b = T.forecast(s1, { opp: true, inv: { demo: 4 } });
  ok(a.valid && b.valid && a.out.units === b.out.units && a.after.knowledge !== b.after.knowledge,
    'two plans with the same delivery SP ship the same units this quarter, whatever the skills bought', a.out.units + ' vs ' + b.out.units);
  const s2a = T.commit(s1, { opp: true, inv: { train: 4 } }), s2b = T.commit(s1, { opp: true, inv: { demo: 4 } });
  ok(T.forecast(s2a, T.emptyPlan()).out.units !== T.forecast(s2b, T.emptyPlan()).out.units, 'and different units the quarter after');
}

/* ---------- 6. readiness, learning dip, upkeep, drift ---------- */
{
  let s = T.commit(T.commit(T.newGame(), T.emptyPlan()), T.emptyPlan());   // L0 at Y1Q3
  const opp = T.OPPS[2];
  const f = T.forecast(s, { opp: true, inv: {} });
  ok(!f.ready && Math.abs(f.after.context - opp.gain.context / 2) < 1e-9, 'an opportunity the team is not ready for gives half its gain', f.after.context + ' vs ' + opp.gain.context);

  const line = [{ opp: true, inv: {} }, { opp: true, inv: {} }, { opp: true, inv: {} }, { opp: true, inv: {} }];
  let st = T.newGame(); const dips = [];
  for (const p of line) { const g = T.forecast(st, p); dips.push([st.leveledUp, g.out.dip]); st = T.commit(st, p); }
  ok(dips.every(([up, dip]) => dip === (up ? C.transitionTax : 0)) && dips.some(([up]) => up),
    'the learning dip lands in exactly the quarters after a level-up', JSON.stringify(dips));

  // st is L3a at Y2Q1: no context work means context rot; shared upkeep stops it
  ok(st.level === 3, 'funding the year-1 opportunities reaches L3a', T.LEVELS[st.level].id);
  const rot = T.forecast(st, { opp: false, inv: {} }), kept = T.forecast(st, { opp: false, inv: { shared: 2 } });
  ok(rot.drift.context === -C.contextRot && kept.drift.context === 0, 'from L3a, context rots without upkeep and holds with it', rot.drift.context + ' / ' + kept.drift.context);
  ok(rot.out.gain - rot.out.rework > 0.03 ? rot.drift.trust === C.trustUp : true, 'a clearly positive measured gain raises trust', rot.drift.trust);

  // not ready for deterministic-first: the burn saving is halved too
  let early = T.newGame();
  for (let q = 0; q < 4; q++) early = T.commit(early, T.emptyPlan());
  const half = T.commit(early, { opp: true, inv: {} });
  ok(Math.abs(half.burnFactor - (1 + T.OPPS[4].burnFactor) / 2) < 1e-9, 'an unready deterministic-first push saves half the AI credits', half.burnFactor);
  ok(half.agentUnits === 0, 'no lasting bonus from an opportunity the team was not ready for');
}

/* ---------- 7. year 1 and the budget cut ---------- */
{
  const heavy = play(s => ({ opp: true, inv: s.q < 4 ? { train: 12 } : {} })).s;
  const light = play(s => ({ opp: s.q < 4, inv: {} })).s;
  const y1h = T.yearUnits(heavy, 0), y1l = T.yearUnits(light, 0), line = C.yearGoal * C.budgetCutThreshold;
  ok(y1h < line && heavy.budgetCut && T.budget(Object.assign({}, heavy, { q: 5 })) === C.budgetCutAic,
    'a year 1 more than 10% short cuts the year 2 budget', y1h + ' < ' + line);
  ok(y1l >= line && y1l < C.yearGoal && !light.budgetCut, 'a year 1 short by less than 10% keeps it', y1l);
  ok(T.budget(Object.assign({}, heavy, { q: 2 })) === C.aic, 'the cut never reaches back into year 1');
}

/* ---------- 8. score and determinism ---------- */
{
  const r = rng(7);
  let bad = '';
  for (let n = 0; n < 60 && !bad; n++) {
    const { s } = play(st => randomPlan(st, r));
    const m = T.summary(s);
    const want = Math.round((m.total - 480) - (m.short1 + m.short2) + 2 * (m.exit - 60));
    if (m.score !== want) bad = 'run ' + n + ': ' + m.score + ' vs ' + want;
  }
  ok(!bad, 'score = units over 480 - shortfalls + 2 x (exit rate - 60)', bad);
  const plans = [];
  const r2 = rng(99);
  const a = play(st => { const p = randomPlan(st, r2); plans.push(p); return p; }).s;
  const b = play(st => plans[st.q]).s;
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same plans always give the same two years');
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
