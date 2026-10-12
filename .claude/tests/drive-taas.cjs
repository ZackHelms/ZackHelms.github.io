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
  // the precondition is asserted, not assumed: a row that is green whenever its premise fails can never fail
  ok(rot.out.gain - rot.out.rework > 0.03 && rot.drift.trust === C.trustUp, 'a clearly positive measured gain raises trust', (rot.out.gain - rot.out.rework).toFixed(3) + ' -> ' + rot.drift.trust);

  // not ready for deterministic-first: the burn saving is halved too
  let early = T.newGame();
  for (let q = 0; q < 4; q++) early = T.commit(early, T.emptyPlan());
  const half = T.commit(early, { opp: true, inv: {} });
  ok(Math.abs(half.burnFactor - (1 + T.OPPS[4].burnFactor) / 2) < 1e-9, 'an unready deterministic-first push saves half the AI credits', half.burnFactor);
  // (this row used to check agentUnits after Y2Q1, whose opportunity has no agent at all: it could not fail.
  //  The agent rows are in section 9, at the quarters that have one.)
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

  // the score row recomputes from m.exit, so it cannot see a wrong exit rate; these rows can.
  // Exit rate = what forecast() says a plain quarter would ship: all SP on delivery, no dip, the full budget
  // (the cut is year 2's only). A sweep end state plus a credit-bound one, since the sweep never binds at 9,000.
  const plain = s => T.forecast(Object.assign({}, s, { q: 7, leveledUp: false, budgetCut: false }), T.emptyPlan()).out.units;
  const r3 = rng(31);
  let exitBad = '', sawUp = false, grades = '', goals = '', sawNeg = 0, sawPos = 0;
  for (let n = 0; n < 120; n++) {
    const { s } = play(st => randomPlan(st, r3));
    const m = T.summary(s);
    if (s.leveledUp) sawUp = true;
    if (!exitBad && m.exit !== plain(s)) exitBad = 'run ' + n + ': ' + m.exit + ' vs ' + plain(s);
    const wantGoals = (m.y1 >= C.yearGoal ? 1 : 0) + (m.y2 >= C.yearGoal ? 1 : 0);
    if (!goals && m.goals !== wantGoals) goals = 'run ' + n + ': ' + m.goals + ' vs ' + wantGoals + ' (' + m.y1 + '/' + m.y2 + ')';
    const trad = s.level === 0 && m.total >= m.base;
    if (m.score < 0) sawNeg++; else if (!trad) sawPos++;
    if (!grades && (trad !== (m.grade === 'Traditional') || (!trad && (m.score < 0) !== (m.grade === 'Stalled pilot'))))
      grades = 'run ' + n + ': score ' + m.score + ' graded ' + m.grade;
  }
  const bound = Object.assign(T.newGame(), { q: 8, level: 5, leveledUp: true, budgetCut: true,
    stats: { knowledge: 90, context: 90, quality: 90, trust: 100, flow: 90 } });
  const boundExit = T.exitRate(bound);
  ok(!exitBad && sawUp && boundExit === plain(bound),
    'the exit rate is a plain quarter by forecast(): no learning dip, the full budget even after a cut',
    exitBad || (sawUp ? boundExit + ' vs ' + plain(bound) : 'no sweep run ended on a level-up'));
  ok(!goals, 'goals met counts the years that shipped 240', goals);
  ok(!grades && sawNeg > 0 && sawPos > 0, 'a negative score is graded Stalled pilot and nothing else is; Traditional means L0 and 480',
    grades || ('negative ' + sawNeg + ', non-negative ' + sawPos));
  const plans = [];
  const r2 = rng(99);
  const a = play(st => { const p = randomPlan(st, r2); plans.push(p); return p; }).s;
  const b = play(st => plans[st.q]).s;
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same plans always give the same two years');
}

/* ---------- 9. rules the seeded play cannot reach, on hand-built states ----------
 * Every row above plays real quarters, and some rules never come up in play: the
 * sweep never runs short of credits at 9,000, never rots a stat to 0, and never has
 * an agent's quarter arrive before the team is ready for it. These build the state
 * the rule is about. Each was written after a deliberate break of that rule passed
 * the rest of the suite (.claude/tests/README.md, negative tests). */
const ZERO = { knowledge: 0, context: 0, quality: 0, trust: 0, flow: 0 };
const at = (o) => Object.assign(T.newGame(), o, { stats: Object.assign({}, ZERO, o.stats) });
const MID = { knowledge: 50, context: 50, quality: 50, trust: 50, flow: 50 };
{
  // every quarter's opportunity gives exactly its table gain when ready, half when not
  const bad = [];
  T.OPPS.forEach((o, q) => {
    [o.minLevel, o.minLevel - 1].filter(l => l >= 0).forEach(level => {
      const s = at({ q, level, stats: MID });
      const a = T.forecast(s, { opp: true, inv: {} }), b = T.forecast(s, T.emptyPlan());
      const f = level >= o.minLevel ? 1 : 0.5;
      T.STATS.forEach(k => { if (Math.abs((a.gains[k] - b.gains[k]) - (o.gain[k] || 0) * f) > 1e-9) bad.push(o.id + '@' + T.LEVELS[level].id + '.' + k); });
    });
  });
  ok(!bad.length, 'every opportunity gives exactly its table gain when ready and half when not', bad.join(', '));

  // the agent quarters: a lasting bonus only when ready
  const agents = [];
  T.OPPS.forEach((o, q) => {
    if (!o.agentUnits) return;
    const ready = T.commit(at({ q, level: o.minLevel, stats: MID }), { opp: true, inv: {} });
    const early = T.commit(at({ q, level: o.minLevel - 1, stats: MID }), { opp: true, inv: {} });
    if (ready.agentUnits !== o.agentUnits || ready.agentAic !== o.agentAic || early.agentUnits !== 0 || early.agentAic !== 0)
      agents.push(o.id + ' ready ' + ready.agentUnits + ' early ' + early.agentUnits);
  });
  ok(T.OPPS.some(o => o.agentUnits) && !agents.length, 'an agent opportunity adds its units for good only if the team was ready', agents.join(', '));
}
{
  // the dip is the quarter after a level-up and no other
  const s = at({ q: 3, level: 2, stats: MID });
  const flat = T.forecast(s, T.emptyPlan()).out.dip, up = T.forecast(Object.assign({}, s, { leveledUp: true }), T.emptyPlan()).out.dip;
  ok(flat === 0 && up === C.transitionTax, 'at L2 with no fresh level-up there is no dip, and with one there is', flat + ' / ' + up);
}
{
  // which work counts as upkeep, and from which level each stat rots.
  // Stated here as the design says it (.claude/taas.md, the model: drift), so changing it is a decision.
  const CONTEXT_OPPS = ['context', 'lessons'], QUALITY_OPPS = ['determ', 'lessons'];
  const bad = [];
  [[2, 0, 0], [3, -C.contextRot, 0], [4, -C.contextRot, -C.evalRot], [5, -C.contextRot, -C.evalRot]].forEach(([level, c, qd]) => {
    const d = T.forecast(at({ q: 4, level, stats: MID }), T.emptyPlan()).drift;
    if (d.context !== c || d.quality !== qd) bad.push(T.LEVELS[level].id + ' rots ' + d.context + '/' + d.quality);
  });
  T.OPPS.forEach((o, q) => {
    const d = T.forecast(at({ q, level: 5, stats: MID }), { opp: true, inv: {} }).drift;
    if ((d.context === 0) !== CONTEXT_OPPS.includes(o.id)) bad.push(o.id + ' context ' + d.context);
    if ((d.quality === 0) !== QUALITY_OPPS.includes(o.id)) bad.push(o.id + ' quality ' + d.quality);
  });
  T.INVESTS.forEach(i => {
    const d = T.forecast(at({ q: 4, level: 5, stats: MID }), { opp: false, inv: { [i.id]: C.investStep } }).drift;
    if ((d.context === 0) !== (i.upkeep === 'context')) bad.push(i.id + ' context ' + d.context);
    if ((d.quality === 0) !== (i.upkeep === 'quality')) bad.push(i.id + ' quality ' + d.quality);
  });
  ok(!bad.length, 'context rots from L3a and quality from L3b, and only their own upkeep work stops it', bad.join(', '));

  const low = T.forecast(at({ q: 4, level: 4, stats: { knowledge: 50, context: 1, quality: 1, trust: 50, flow: 50 } }), T.emptyPlan()).after;
  ok(low.context === 0 && low.quality === 0, 'a stat rotting past 0 stops at 0', low.context + ' / ' + low.quality);
}
{
  // trust falls when rework outweighs the gain. No level in today's tables can get there
  // (gain / rework is at least 3.25 even at Flow, Quality and Context 0), so the row
  // borrows L1 with its rework risk raised, and puts the table back.
  const L1 = T.LEVELS[1], keep = L1.risk;
  L1.risk = 1;
  let d;
  try { d = T.forecast(at({ q: 2, level: 1, stats: { knowledge: 20, trust: 20 } }), T.emptyPlan()); } finally { L1.risk = keep; }
  ok(d.out.rework > d.out.gain && d.drift.trust === -C.trustDown, 'when rework outweighs the gain, trust falls', d.out.rework.toFixed(3) + ' vs ' + d.out.gain.toFixed(3) + ' -> ' + d.drift.trust);
}
{
  // investments: half return past fullRateSp, and nothing from one the team has not unlocked
  const s = T.newGame();
  const k = sp => T.forecast(s, { opp: false, inv: { train: sp } }).gains.knowledge;
  const step = C.investStep, full = C.fullRateSp;
  ok(Math.abs((k(full + step) - k(full)) - (k(step) / 2)) < 1e-9 && k(full) === full * k(step) / step,
    'an investment returns full rate up to ' + full + ' SP and half beyond', [k(step), k(full), k(full + step)].join(' / '));
  const locked = T.INVESTS.filter(i => i.unlock > s.level);
  const base = T.forecast(s, T.emptyPlan());
  const leak = locked.filter(i => JSON.stringify(T.forecast(s, { opp: false, inv: { [i.id]: step } })) !== JSON.stringify(base)).map(i => i.id);
  ok(locked.length > 0 && !leak.length, 'an investment the team has not unlocked buys nothing and costs nothing', leak.join(', '));
}
{
  // credits: spare ones buy nothing, short ones cost units (agents included), deterministic-first cuts the need
  const rich = at({ q: 4, level: 2, stats: MID }), richCut = Object.assign({}, rich, { budgetCut: true });
  const u = s => T.forecast(s, T.emptyPlan()).out;
  ok(u(rich).cover === 1 && u(richCut).cover === 1 && u(rich).units === u(richCut).units,
    'once the AI work is covered, more credits buy nothing', u(rich).units + ' vs ' + u(richCut).units);
  const hungry = at({ q: 4, level: 5, burnFactor: 1, agentUnits: 6, agentAic: 600, stats: Object.assign({}, MID, { trust: 100 }) });
  const full = u(hungry), cut = u(Object.assign({}, hungry, { budgetCut: true }));
  ok(full.cover < 1 && cut.cover < full.cover && cut.units < full.units && cut.agent < full.agent && full.agent < hungry.agentUnits,
    'credits short of the AI work cost units, and the agents ship less too', [full.cover.toFixed(2), cut.cover.toFixed(2), full.agent, cut.agent].join(' / '));
  const lean = u(Object.assign({}, rich, { burnFactor: T.OPPS[4].burnFactor }));
  ok(Math.abs(lean.aicNeed - u(rich).aicNeed * T.OPPS[4].burnFactor) <= 1, 'the deterministic-first saving cuts what AI-assisted delivery needs', lean.aicNeed + ' vs ' + u(rich).aicNeed);
}
{
  // direction of the model at every AI level: Quality and Context guard against rework, Flow lets more gain through,
  // and "Team says" is the speedup felt while prompting: it ignores Flow, Quality, Context and the credits.
  const bad = [];
  for (let level = 1; level < T.LEVELS.length; level++) {
    const s = at({ q: 4, level, stats: MID }), id = T.LEVELS[level].id;
    const o = T.forecast(s, T.emptyPlan()).out;
    const up = (k) => T.forecast(at({ q: 4, level, stats: Object.assign({}, MID, { [k]: 80 }) }), T.emptyPlan()).out;
    if (!(up('quality').rework < o.rework && up('context').rework < o.rework)) bad.push(id + ' guard');
    if (!(up('flow').gain > o.gain)) bad.push(id + ' flow');
    const shortOf = T.forecast(Object.assign({}, s, { budgetCut: true, burnFactor: 1, agentAic: 7000 }), T.emptyPlan()).out;
    if (['quality', 'context', 'flow'].some(k => up(k).reported !== o.reported) || shortOf.cover >= 1 || shortOf.reported !== o.reported) bad.push(id + ' team says');
    if (!(o.reported >= o.net)) bad.push(id + ' says < measured');
  }
  ok(!bad.length, 'Quality and Context cut rework, Flow lets gain through, and "Team says" ignores all three and the credits', bad.join(', '));
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
