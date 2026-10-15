#!/usr/bin/env node
/**
 * eval-taas-factory.cjs — the robot factory's pacing and shape (pure node, opt-in, ~5 s).
 *
 * drive-taas-factory.cjs proves the rules whatever the numbers. This plays personas through
 * the shipped engine, walking and all (every action is a tap the avatar has to walk to, the
 * robot's page included), and prices the milestones in minutes, so a retune can be judged
 * against something. Since the storefront (the CD, 2026-10-15) nothing is sold by hand: the
 * planer's planks have to be carried from its output bin round to the counter, where customers
 * buy them for $4 times customer satisfaction and cost 0.1% a second each while they wait.
 *   hands-on       does everything itself until it can hire: presses the planer, carries what it
 *                  makes to the counter, recycles the rest out of its arms; then hires a stocker
 *                  first (it keeps pressing the planer itself, never wrong) and an operator next,
 *                  cleans every jam the moment it happens, refills the stall itself whenever it
 *                  runs low, and gives each robot the instruction for each mistake as soon as the
 *                  mistake has shown it (buying a slot when it needs one)
 *   supervisor     the same, but once both robots are on staff only steps in to clean a jam, 10 s
 *                  late, and to instruct
 *   walks away     hires both robots and leaves: nobody cleans
 *   uninstructed   the supervisor, never giving an instruction
 *   crossed        the supervisor, giving each robot the OTHER job's instructions
 *   stocker only   the supervisor, giving the stocker all its instructions and the operator none
 *   stock planks   the supervisor, giving the stocker only "only stock medium planks" (a bin
 *                  filling up, as in the CD's third-brief playtest)
 *   operator first hands-on, but its first robot goes on the planer (as in the first builds);
 *                  after two minutes of money falling it moves that robot to stocking
 * A persona that instructs works to one PLAN, an optimal path through the instructions as they
 * join the list (it skips the ones that prevent nothing, and "Put medium logs in recycle bin",
 * which on a plank line throws the good logs away); once a robot holds its whole plan it resets
 * that robot's evals, as the CD does to see fresh data. Money is counted net of what the machines
 * cost to run.
 *
 * Then it asserts the shape the mode exists to teach (the first robot comes quickly, robots alone
 * stall on their first jam, instructions pay, an uninstructed stocker wears customer satisfaction
 * down while an instructed one keeps it, an instruction about another job is worth nothing, agents
 * without instructions are not free speed, a line left alone fills the shop with waiting customers)
 * and that **a valid optimal path exists and works**: every kind of trouble the floor can make has
 * an instruction that fixes it and that instruction joins the list in real play; the plan, followed,
 * leaves no junk piling up in the output bin, hardly anyone waiting and evals that are almost all
 * green; and wherever a persona's bin does fill up, the instructions that would empty it were on
 * its list (the dead end was the persona's, not the game's: "NO WAY OUT" otherwise). Every number
 * is a first-draft guess; change a row only if the CD changes the design it describes.
 *
 * Usage: node .claude/tests/eval-taas-factory.cjs      Final line: TAAS-FACTORY-EVAL: GREEN | RED
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const src = fs.readFileSync(PAGE, 'utf8');
const a = src.indexOf('const FACTORY = (function'), b = src.indexOf("if (typeof module !== 'undefined') module.exports = FACTORY;", a);
const F = new Function(src.slice(a, b) + '\nreturn FACTORY;')();
const C = F.CFG, WANT = C.stalls[0].want;

let checks = 0, failed = 0;
function ok(cond, name, detail) { checks++; if (cond) console.log('PASS ' + name); else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' (' + detail + ')' : '')); } }

// the optimal path: per job, the instructions a player who knows the floor would use, in order of
// preference as they join the list ("Only input medium logs" covers small and large logs both)
const PLAN = { operate: ['sappy', 'gnarled', 'medium', 'output'], stock: ['stockOnly', 'smallOut', 'largeOut', 'roughOut'] };
const other = job => job === 'operate' ? 'stock' : 'operate';
const junkOf = s => s.bin.filter(k => k !== WANT).length;
const count = (arr, k) => arr.filter(x => x === k).length;

function persona(kind, minutes, seed) {
  const s = F.newGame(seed || 1), DT = 0.05, END = minutes * 60;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastNet = 0, page = null, bought = 0, swap = false;
  const perMin = [], junkMin = [], waitMin = [], satMin = [];
  let waitSum = 0, waitN = 0;
  const resetAt = {};
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = (k, id) => s.avatar.task && s.avatar.task.kind === k && (id === undefined || s.avatar.task.id === id) && (s.avatar.path.length || s.avatar.act);
  const want = (k, id) => { if (!busyWith(k, id)) F.tap(s, id === undefined ? { kind: k } : { kind: k, id }); };
  const instructs = ['hands-on', 'supervisor', 'crossed', 'stocker only', 'stock planks', 'operator first'].indexOf(kind) >= 0;
  const handsOn = kind === 'hands-on' || kind === 'operator first';
  const planFor = r => {
    if (!instructs || !r.job || (kind === 'stocker only' || kind === 'stock planks') && r.job !== 'stock') return [];
    if (kind === 'stock planks') return ['stockOnly'];
    return PLAN[kind === 'crossed' ? other(r.job) : r.job];
  };
  const nextFor = r => planFor(r).find(id => s.seen[id] && r.rules.indexOf(id) < 0) || null;
  const afford = r => r.rules.indexOf(null) >= 0 || (F.slotPrice(s, r.id) !== null && s.money >= F.slotPrice(s, r.id));
  const room = () => C.stallCap - s.stalls[0].stock.length;
  while (s.t < END) {
    F.step(s, DT);
    s.events.forEach(e => { if (e.kind === 'notes') page = e.id; if (e.kind === 'hired' || e.kind === 'slot') bought += e.price; });
    s.events = [];
    satLow = Math.min(satLow, s.satisfaction);
    waitSum += F.waitingNow(s); waitN++;
    if (s.money >= 20) at('$20');
    if (s.hired >= 1) at('robot 1');
    if (s.hired >= 2) at('robot 2');
    if (s.robots.some(r => r.rules.some(Boolean))) at('first rule');
    const op = s.robots.find(r => r.job === 'operate'), sk = s.robots.find(r => r.job === 'stock');
    if (op && PLAN.operate.every(id => op.rules.indexOf(id) >= 0)) at('op4');
    if (sk && PLAN.stock.every(id => sk.rules.indexOf(id) >= 0)) at('stock4');
    if (Math.floor(s.t / 60) > perMin.length) {
      const net = s.earned - s.spent;
      perMin.push(net - lastNet); lastNet = net; junkMin.push(junkOf(s)); waitMin.push(waitSum / waitN); satMin.push(s.satisfaction); waitSum = 0; waitN = 0;
    }
    s.robots.forEach(r => { const plan = planFor(r); if (plan.length && resetAt[r.id] === undefined && plan.every(id => r.rules.indexOf(id) >= 0)) { F.resetEvals(s, r.id); resetAt[r.id] = s.t; } });
    const m = s.machine, bub = F.bubbleOpen(s), a = s.avatar;
    if (m.phase === 'jam') { if (jamSeen < 0) jamSeen = s.t; } else jamSeen = -1;
    if (page !== null) {
      const r = s.robots[page];
      for (let id = nextFor(r); id && afford(r); id = nextFor(r)) {
        if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id);
        F.setRule(s, r.id, r.rules.indexOf(null), id);
      }
      page = null;
      continue;
    }
    if (bub) {
      if (bub.kind === 'recycle') { let o; while ((o = F.options(s).find(x => x.enabled && x.group === 'put'))) F.choose(s, o.id); s.bubble = null; continue; }
      if (bub.kind === 'dock') { if (F.choose(s, 'hire')) { F.choose(s, (s.hired === 1) === (kind !== 'operator first') ? 'job:stock' : 'job:operate'); } s.bubble = null; continue; }
      if (bub.kind === 'robot') { if (swap) { F.choose(s, 'job:stock'); swap = false; at('swapped'); } else F.choose(s, 'notes'); continue; }
      s.bubble = null;
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const late = handsOn || s.hired < 2 ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    const hp = F.hirePrice(s);
    if (hp !== null && s.money >= hp) { want('dock'); continue; }
    if (F.slotsOpen(s)) { const r = s.robots.find(x => nextFor(x) && afford(x)); if (r) { want('robot', r.id); continue; } }
    // the way out of an operator hired first: once money has fallen two minutes running, move it to stocking
    if (kind === 'operator first' && s.hired === 1 && op && perMin.length >= 3 && perMin.slice(-2).every(v => v < 0)) { swap = true; want('robot', op.id); continue; }
    if (!handsOn && s.hired >= 2) continue;   // supervisors only clean, hire and instruct
    // your arms: medium planks to the counter, anything else to the recycle bin
    if (count(a.inv, WANT) && room() > 0) { want('counter'); continue; }
    if (a.inv.some(k => k !== WANT)) { want('recycle'); continue; }
    // the output bin: always yours until there is a stocker; then only when the stall runs low
    const binPlanks = count(s.bin, WANT);
    if (binPlanks && room() > 0 && (!sk || (handsOn && s.stalls[0].stock.length <= 1))) { want('bin'); continue; }
    if (!sk && s.bin.length > 3) { want('bin'); continue; }   // clear the junk before it buries the planks
    if (!op && F.ready(s)) { want('machine'); continue; }
  }
  const fmt = k => mark[k] === undefined ? '-' : (mark[k] / 60).toFixed(1) + 'm';
  const last5 = perMin.slice(-5).reduce((x, y) => x + y, 0) / 5;
  return { kind, s, mark, fmt, satLow, perMin, last5, junkMin, waitMin, satMin, resetAt, bought };
}

const DEBUG = process.env.EVAL_DEBUG;
const runs = ['hands-on', 'supervisor', 'walks away', 'uninstructed', 'crossed', 'stocker only', 'stock planks', 'operator first'].map(k => persona(k, 30, 7));
const stocker = r => r.s.robots.find(x => x.job === 'stock');
const stocked = r => { const x = stocker(r); return x ? (x.record.stock || 0) + Object.keys(x.record).filter(k => /^misstock/.test(k)).reduce((n, k) => n + x.record[k], 0) : 0; };
const looked = r => { const x = stocker(r); return x ? (x.record.looking || 0) + (x.record['looking!'] || 0) : 0; };
const evals = (r, job) => { const x = r.s.robots.find(q => q.job === job); if (!x) return null; const n = x.tally.good + x.tally.soso + x.tally.bad; return { n, green: n ? +(x.tally.good / n).toFixed(2) : 0, red: x.tally.bad }; };
const avg = (arr, n) => { const v = arr.slice(-n); return v.reduce((x, y) => x + y, 0) / Math.max(1, v.length); };
console.log('persona        $20    robot1  robot2  rule1  op x4  stk x4  earned  costs  $/min net(last5)  sat end/min  served/wrong  waiting(last10)  stocked/looking  junk');
runs.forEach(r => console.log(r.kind.padEnd(13) + ['$20', 'robot 1', 'robot 2', 'first rule', 'op4', 'stock4'].map(k => r.fmt(k).padStart(7)).join(' ') + String(r.s.earned).padStart(8) + String(r.s.spent).padStart(7) + r.last5.toFixed(1).padStart(17)
  + ('  ' + Math.round(r.s.satisfaction) + '/' + Math.round(r.satLow)).padStart(13) + (r.s.shop.served + '/' + r.s.shop.wrong).padStart(14) + avg(r.waitMin, 10).toFixed(2).padStart(17) + (stocked(r) + '/' + looked(r)).padStart(17) + String(junkOf(r.s)).padStart(6)));
if (DEBUG) runs.forEach(r => console.log(r.kind, JSON.stringify(r.s.seen), r.s.robots.map(x => x.name + ':' + x.job + ':' + JSON.stringify(x.rules) + JSON.stringify(x.record)).join(' | '), 'sat/min ' + r.satMin.map(Math.round).join(','), 'wait/min ' + r.waitMin.map(v => v.toFixed(1)).join(',')));
const R = Object.fromEntries(runs.map(r => [r.kind, r]));
const ho = R['hands-on'], sup = R['supervisor'], un = R['uninstructed'];

ok(ho.mark['$20'] < 150, 'the first $20 (seven planks carried to the counter and bought, less their logs) comes inside two and a half minutes', ho.fmt('$20'));
ok(ho.mark['robot 2'] < 7 * 60, 'both robots are on staff inside seven minutes of attentive play', ho.fmt('robot 2'));
ok(ho.mark['op4'] < 18 * 60 && ho.mark['stock4'] < 18 * 60, 'attentive play has each robot holding all four of its useful instructions inside 18 minutes (eight slots, $100 of them)', ho.fmt('op4') + ' / ' + ho.fmt('stock4'));
const before = ho.satMin.slice(0, Math.max(1, Math.floor(ho.mark['robot 1'] / 60)));
ok(Math.min.apply(null, before) >= 80, 'working alone, a person can keep up with the customers: customer satisfaction stays above 80% until the first robot arrives', before.map(Math.round).join(','));
const wa = R['walks away'];
ok(wa.last5 < 1 && wa.s.machine.phase === 'jam', 'robots left alone stall: the first sap jam stops the line and nobody fixes it', wa.last5.toFixed(1) + ' $/min, planer ' + wa.s.machine.phase);
ok(avg(wa.waitMin, 5) > C.shop.max - 1 && wa.s.satisfaction <= C.satMin + 1, 'and the shop fills with customers waiting at an empty stall, which takes customer satisfaction to the floor', avg(wa.waitMin, 5).toFixed(1) + ' waiting, ' + Math.round(wa.s.satisfaction) + '%');
ok(sup.last5 > 2 * Math.max(1, un.last5), 'instructions pay: the instructed line earns over twice the uninstructed one by the end', sup.last5.toFixed(1) + ' vs ' + un.last5.toFixed(1));
ok(un.s.satisfaction < 60 && sup.s.satisfaction > un.s.satisfaction + 30 && un.s.shop.wrong > 20, 'an uninstructed stocker puts everything in the medium plank stall and wears customer satisfaction down; an instructed one keeps it', Math.round(un.s.satisfaction) + '% (' + un.s.shop.wrong + ' sold something else) vs ' + Math.round(sup.s.satisfaction) + '%');
ok(Math.abs(R['crossed'].last5 - un.last5) <= Math.max(1.5, 0.25 * Math.abs(un.last5)) && R['crossed'].last5 < sup.last5 / 2, 'an instruction about the other robot\'s job is worth nothing: crossed wires earn like no instructions at all', R['crossed'].last5.toFixed(1) + ' vs ' + un.last5.toFixed(1));
const pre = ho.perMin.slice(1, 3).reduce((x, y) => x + y, 0) / 2;
ok(un.last5 < pre * 1.6, 'uninstructed robots barely beat a person working alone (agents are not free speed)', un.last5.toFixed(1) + ' vs ' + pre.toFixed(1) + ' $/min by hand');
const sp = R['stock planks'];
ok(junkOf(sp.s) >= 30 && looked(sp) > 2 * stocked(sp) && looked(sp) / Math.max(1, stocked(sp)) > 5 * (looked(ho) + 1) / Math.max(1, stocked(ho)), 'a stocker told only to stock medium planks, behind an operator told nothing, hunts a bin filling with everything else; with its whole plan, behind an instructed operator, it hardly looks at all',
  'stock planks: ' + junkOf(sp.s) + ' other things in the bin, stocked ' + stocked(sp) + ' / looking ' + looked(sp) + '; hands-on: stocked ' + stocked(ho) + ' / looking ' + looked(ho));
ok(sp.s.shop.wrong < un.s.shop.wrong / 3 && avg(sp.waitMin, 10) > avg(sup.waitMin, 10) + 1 && sp.s.satisfaction < sup.s.satisfaction - 30 && sp.last5 < sup.last5, 'it sells hardly anything wrong, but hunting through the junk it restocks slowly: customers wait at the stall and customer satisfaction falls anyway, and it earns less than a line whose operator is instructed too',
  'wrong ' + sp.s.shop.wrong + ' vs ' + un.s.shop.wrong + ', waiting ' + avg(sp.waitMin, 10).toFixed(1) + ' vs ' + avg(sup.waitMin, 10).toFixed(1) + ', ' + Math.round(sp.s.satisfaction) + '% vs ' + Math.round(sup.s.satisfaction) + '%, ' + sp.last5.toFixed(1) + ' vs ' + sup.last5.toFixed(1) + ' $/min');

// the order robots are hired in matters now: an operator first presses every log while one person
// still carries every plank, so money falls; moving it to stocking is the way out
const of = R['operator first'], sw = of.mark.swapped;
const beforeSwap = sw === undefined ? [] : of.perMin.slice(Math.ceil(of.mark['robot 1'] / 60), Math.floor(sw / 60)), afterSwap = sw === undefined ? [] : of.perMin.slice(Math.ceil(sw / 60) + 1, Math.ceil(sw / 60) + 4);
ok(sw !== undefined && beforeSwap.length >= 2 && beforeSwap.every(v => v < 0) && afterSwap.reduce((x, y) => x + y, 0) > 0 && of.mark['robot 2'] !== undefined && of.mark['robot 2'] < 15 * 60 && of.s.satisfaction >= 90,
  'a robot put on the planer first loses money (it presses every log while you still carry every plank); moved to stocking, the money comes back, the second robot follows, and the line ends healthy',
  'swapped at ' + of.fmt('swapped') + ', $/min before ' + beforeSwap.join(',') + ', after ' + afterSwap.join(',') + '; robot 2 at ' + of.fmt('robot 2') + ', ' + Math.round(of.s.satisfaction) + '%');

/* ---------- a valid optimal path exists, and works ---------- */
const recyclers = k => F.RULES.filter(q => q.job === 'stock' && q.recycles && (!q.recycles.kind || q.recycles.kind.indexOf(F.kindOf(k)) >= 0) && (!q.recycles.size || q.recycles.size.indexOf(F.sizeOf(k)) >= 0));
const fixes = F.LOGS.filter(k => k !== 'log.m').map(k => [k, F.keepers(k)])
  .concat(F.PRODUCTS.filter(k => k !== WANT).map(k => [k, recyclers(k).map(q => q.id)]));
const seenUn = un.s.seen, missing = fixes.filter(([k, ids]) => !ids.length || !ids.some(id => seenUn[id])).map(([k, ids]) => k + (ids.length ? ' (' + ids.join('/') + ' never joined the list)' : ' (nothing fixes it)'));
ok(!missing.length && PLAN.operate.concat(PLAN.stock).every(id => seenUn[id]), 'a valid path exists: every log but a normal medium one and every product but a medium plank has an instruction that deals with it, and every one of them joins the list in real play',
  missing.join(', ') || fixes.map(([k, ids]) => k + ':' + ids.join('/')).join(' '));
const late = sup.junkMin.slice(-10);
ok(sup.mark.stock4 !== undefined && sup.mark.op4 !== undefined && Math.max.apply(null, late) <= 4 && junkOf(sup.s) <= 2 && sup.s.satisfaction >= 90 && avg(sup.waitMin, 10) < 1, 'followed, the plan clears the floor: in the supervisor\'s last ten minutes the output bin never holds more than four other things, hardly anyone waits, and customers stay happy',
  'junk by minute ' + sup.junkMin.join(',') + '; waiting ' + avg(sup.waitMin, 10).toFixed(2) + '; satisfaction ' + Math.round(sup.s.satisfaction));
const eo = evals(sup, 'operate'), es = evals(sup, 'stock');
ok(eo && es && eo.n > 50 && es.n > 30 && eo.green >= 0.6 && es.green >= 0.8 && es.red === 0, 'and once each robot holds its plan and its evals are reset, they come back mostly green (the operator\'s yellow is stopping to think, which nothing covers) and the stocker\'s with no red at all',
  'operator ' + JSON.stringify(eo) + ', stocker ' + JSON.stringify(es));
const fills = runs.filter(r => junkOf(r.s) >= 20);
const stuck = fills.filter(r => r.s.bin.some(k => k !== WANT && !recyclers(k).some(q => r.s.seen[q.id])));
ok(fills.some(r => r.kind === 'stock planks') && !stuck.length, 'where an output bin fills up (the stocker told only "only stock medium planks"), every kind of thing filling it has a recycle instruction already on that persona\'s list',
  'filled: ' + fills.map(r => r.kind + ' (' + junkOf(r.s) + ')').join(', ') + (stuck.length ? '; NO WAY OUT for ' + stuck.map(r => r.kind).join(', ') : ''));
const so = R['stocker only'];
ok(junkOf(so.s) <= 3 && Math.max.apply(null, so.junkMin.slice(-10)) <= 5 && so.s.satisfaction >= 90, 'and a stocker given its whole plan keeps the bin clear even behind an operator told nothing (it recycles what it cannot stock), though that line pays for every junk log', junkOf(so.s) + ' left; by minute ' + so.junkMin.join(','));
// the books balance: money is what was earned, less what the machines cost and what was bought
ok(runs.every(r => r.s.money === r.s.earned - r.s.spent - r.bought), 'every persona\'s money is what it earned, less the running costs and its purchases', runs.map(r => r.kind + ':' + r.s.money).join(' '));

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY-EVAL: ' + (failed ? 'RED' : 'GREEN'));
process.exit(failed ? 1 : 0);
