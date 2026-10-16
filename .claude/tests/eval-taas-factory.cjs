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
 *   paced          the supervisor, for an hour, but the moment its operator is on the planer it puts
 *                  "Wait between tasks" in the operator's first slot (buying it, before the rest of
 *                  its plan), leaves the slider where it starts, and once a minute nudges it a second:
 *                  longer while the bin holds more than a stall's worth and is not falling, shorter
 *                  when it holds fewer than two or a customer waits at an empty stall (the CD's delay,
 *                  2026-10-16). Since logs cost $1 each (the CD, 2026-10-16) this is the optimal
 *                  path: an operator faster than the customers buys logs it never sells. It is set
 *                  beside the supervisor played for the same hour.
 * Every persona presses the planer only while fewer than a stall's worth and two of medium planks
 * wait for the counter, since logs cost money (assumed player rule, 2026-10-16), and every persona
 * plays an hour (the economy is slower since logs cost money).
 * A persona that instructs works to one PLAN, an optimal path through the instructions as they
 * join the list (it skips the ones that prevent nothing, and "Put medium logs in recycle bin",
 * which on a plank line throws the good logs away); once a robot holds its whole plan it resets
 * that robot's evals, as the CD does to see fresh data. Money is counted net of what the machines
 * cost to run.
 *
 * Then it asserts the shape the mode exists to teach (the first robot comes quickly, robots alone
 * stall on their first jam, instructions pay, an uninstructed stocker wears customer satisfaction
 * down while an instructed one keeps it, an instruction about another job is worth nothing, agents
 * without instructions are not free speed, a line left alone fills the shop with waiting customers,
 * a line that makes more than it sells fills its output bin with planks it paid for, and a delay
 * between the operator's logs ends that without starving the customers, and pays)
 * and that **a valid optimal path exists and works**: every kind of trouble the floor can make has
 * an instruction that fixes it and that instruction joins the list in real play; the plan, followed,
 * leaves no junk piling up in the output bin, hardly anyone waiting and evals that are almost all
 * green; and wherever a persona's bin does fill up, the instructions that would empty it were on
 * its list (the dead end was the persona's, not the game's: "NO WAY OUT" otherwise). Every number
 * is a first-draft guess; change a row only if the CD changes the design it describes.
 *
 * Usage: node .claude/tests/eval-taas-factory.cjs      Final line: TAAS-FACTORY-EVAL: GREEN | RED
 *        EVAL_WAITS=1 adds a sweep (not asserted): the paced persona with the slider left at 2, 3, 4
 *        and 5 s, against the supervisor, over seeds 1-8, an hour each (~10 s more).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const src = fs.readFileSync(PAGE, 'utf8');
const a = src.indexOf('const FACTORY = (function'), b = src.indexOf("if (typeof module !== 'undefined') module.exports = FACTORY;", a);
const F = new Function(src.slice(a, b) + '\nreturn FACTORY;')();
const C = F.CFG, WANT = C.stalls.start;

let checks = 0, failed = 0;
function ok(cond, name, detail) { checks++; if (cond) console.log('PASS ' + name); else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' (' + detail + ')' : '')); } }

// the optimal path: per job, the instructions a player who knows the floor would use, in order of
// preference as they join the list ("Only input medium logs" covers small and large logs both)
const PLAN = { operate: ['sappy', 'gnarled', 'medium', 'output'], 'stock:0': ['stockOnly', 'smallOut', 'largeOut', 'roughOut'] };
const other = job => job === 'operate' ? 'stock:0' : 'operate';
const junkOf = s => s.bin.filter(k => k !== WANT).length;
const count = (arr, k) => arr.filter(x => x === k).length;

function persona(kind, minutes, seed, fixedWait) {
  const s = F.newGame(seed || 1), DT = 0.05, END = minutes * 60;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastNet = 0, page = null, bought = 0, swap = false;
  const perMin = [], junkMin = [], waitMin = [], satMin = [];
  let waitSum = 0, waitN = 0;
  const resetAt = {};
  const plankMin = [], waits = [];
  let paceAsk = false, paceTo = null, lookAt = 0, lastPlanks = 0;
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = (k, id) => s.avatar.task && s.avatar.task.kind === k && (id === undefined || s.avatar.task.id === id) && (s.avatar.path.length || s.avatar.act);
  const want = (k, id) => { if (!busyWith(k, id)) F.tap(s, k === 'stall' ? { kind: k, i: 0 } : id === undefined ? { kind: k } : { kind: k, id }); };
  const instructs = ['paced', 'hands-on', 'supervisor', 'crossed', 'stocker only', 'stock planks', 'operator first'].indexOf(kind) >= 0;
  const handsOn = kind === 'hands-on' || kind === 'operator first';
  const planFor = r => {
    if (!instructs || !r.job || (kind === 'stocker only' || kind === 'stock planks') && r.job !== 'stock:0') return [];
    if (kind === 'stock planks') return ['stockOnly'];
    return PLAN[kind === 'crossed' ? other(r.job) : r.job];
  };
  const nextFor = r => planFor(r).find(id => s.seen[id] && r.rules.indexOf(id) < 0) || null;
  const afford = r => r.rules.indexOf(null) >= 0 || (F.slotPrice(s, r.id) !== null && s.money >= F.slotPrice(s, r.id));
  const room = () => C.stallCap - s.stalls[0].stock.length;   // the first stall: the personas never buy another (taasstalls step 4)
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
    const op = s.robots.find(r => r.job === 'operate'), sk = s.robots.find(r => r.job === 'stock:0');
    if (op && PLAN.operate.every(id => op.rules.indexOf(id) >= 0)) at('op4');
    if (sk && PLAN['stock:0'].every(id => sk.rules.indexOf(id) >= 0)) at('stock4');
    if (Math.floor(s.t / 60) > perMin.length) {
      const net = s.earned - s.spent;
      perMin.push(net - lastNet); lastNet = net; junkMin.push(junkOf(s)); waitMin.push(waitSum / waitN); satMin.push(s.satisfaction); plankMin.push(count(s.bin, WANT)); waitSum = 0; waitN = 0;
    }
    s.robots.forEach(r => { const plan = planFor(r); if (plan.length && resetAt[r.id] === undefined && plan.every(id => r.rules.indexOf(id) >= 0)) { F.resetEvals(s, r.id); resetAt[r.id] = s.t; } });
    const m = s.machine, bub = F.bubbleOpen(s), a = s.avatar;
    if (m.phase === 'jam') { if (jamSeen < 0) jamSeen = s.t; } else jamSeen = -1;
    if (page !== null) {
      const r = s.robots[page];
      // the paced persona's delay goes in before the rest of the operator's plan
      if (paceAsk && r.job === 'operate' && r.rules.indexOf('delay') < 0 && afford(r)) { if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id); F.setRule(s, r.id, r.rules.indexOf(null), 'delay'); }
      for (let id = nextFor(r); id && afford(r); id = nextFor(r)) {
        if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id);
        F.setRule(s, r.id, r.rules.indexOf(null), id);
      }
      if (paceAsk && r.job === 'operate') {
        if (r.rules.indexOf('delay') < 0 && (r.rules.indexOf(null) >= 0 || F.buySlot(s, r.id))) F.setRule(s, r.id, r.rules.indexOf(null), 'delay');
        if (r.rules.indexOf('delay') >= 0) {
          if (paceTo !== null) F.setWait(s, r.id, paceTo); else if (fixedWait !== undefined) F.setWait(s, r.id, fixedWait);
          at('paced'); waits.push(r.wait); lookAt = s.t + 60; lastPlanks = count(s.bin, WANT);
        }
        paceAsk = false; paceTo = null;
      }
      page = null;
      continue;
    }
    if (bub) {
      if (bub.kind === 'recycle') { let o; while ((o = F.options(s).find(x => x.enabled && x.group === 'put'))) F.choose(s, o.id); s.bubble = null; continue; }
      if (bub.kind === 'dock') { if (F.choose(s, 'hire')) { F.choose(s, (s.hired === 1) === (kind !== 'operator first') ? 'job:stock:0' : 'job:operate'); } s.bubble = null; continue; }
      if (bub.kind === 'robot') { if (swap) { F.choose(s, 'job:stock:0'); swap = false; at('swapped'); } else F.choose(s, 'notes'); continue; }
      s.bubble = null;
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const late = handsOn || s.hired < 2 ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    // two robots, the planer's and the first stall's: the personas hire no more until they are
    // rebuilt for the stalls and the slots (taasstalls step 4)
    const hp = F.hirePrice(s);
    if (hp !== null && s.money >= hp && s.hired < 2) { want('dock'); continue; }
    if (F.slotsOpen(s)) { const r = s.robots.find(x => nextFor(x) && afford(x)); if (r) { want('robot', r.id); continue; } }
    // the way out of an operator hired first: once money has fallen two minutes running, move it to stocking
    if (kind === 'operator first' && s.hired === 1 && op && perMin.length >= 3 && perMin.slice(-2).every(v => v < 0)) { swap = true; want('robot', op.id); continue; }
    // the paced supervisor: the delay goes in once planks pile up behind a full stall, then the slider is tuned by the bin
    if (kind === 'paced' && op && mark.paced === undefined && afford(op)) { paceAsk = true; want('robot', op.id); continue; }
    if (kind === 'paced' && op && mark.paced !== undefined && fixedWait === undefined && s.t >= lookAt) {
      const planks = count(s.bin, WANT), short = F.waitingNow(s) > 0 && !s.stalls[0].stock.length;
      let to = planks < 2 || short ? op.wait - 1 : planks > C.stallCap && planks >= lastPlanks ? op.wait + 1 : op.wait;
      to = Math.max(C.wait.min, Math.min(C.wait.max, to));
      lookAt = s.t + 60; lastPlanks = planks;
      if (to !== op.wait) { paceAsk = true; paceTo = to; want('robot', op.id); continue; }
    }
    if (!handsOn && s.hired >= 2) continue;   // supervisors only clean, hire and instruct
    // your arms: medium planks to the counter, anything else to the recycle bin
    if (count(a.inv, WANT) && room() > 0) { want('stall'); continue; }
    if (a.inv.some(k => k !== WANT)) { want('recycle'); continue; }
    // the output bin: always yours until there is a stocker; then only when the stall runs low
    const binPlanks = count(s.bin, WANT);
    if (binPlanks && room() > 0 && (!sk || (handsOn && s.stalls[0].stock.length <= 1))) { want('bin'); continue; }
    if (!sk && s.bin.length > 3) { want('bin'); continue; }   // clear the junk before it buries the planks
    // logs cost money (the CD, 2026-10-16), so a person presses only while fewer than a stall's worth
    // and two of medium planks wait for the counter (assumed player rule)
    const queued = count(s.bin, WANT) + count(a.inv, WANT) + s.stalls[0].stock.length;
    if (!op && F.ready(s) && queued < C.stallCap + 2) { want('machine'); continue; }
  }
  const fmt = k => mark[k] === undefined ? '-' : (mark[k] / 60).toFixed(1) + 'm';
  const last5 = perMin.slice(-5).reduce((x, y) => x + y, 0) / 5;
  return { kind, s, mark, fmt, satLow, perMin, last5, junkMin, waitMin, satMin, resetAt, bought, plankMin, waits };
}

const DEBUG = process.env.EVAL_DEBUG;
const runs = ['hands-on', 'supervisor', 'walks away', 'uninstructed', 'crossed', 'stocker only', 'stock planks', 'operator first'].map(k => persona(k, 60, 7));
const hour = [persona('paced', 60, 7), persona('supervisor', 60, 7)];
hour.forEach(r => { r.kind += ' 1h'; });
const stocker = r => r.s.robots.find(x => x.job === 'stock:0');
const stocked = r => { const x = stocker(r); return x ? (x.record['stock:' + WANT] || 0) + Object.keys(x.record).filter(k => /^misstock/.test(k)).reduce((n, k) => n + x.record[k], 0) : 0; };
const looked = r => { const x = stocker(r); return x ? (x.record['looking:' + WANT] || 0) + (x.record['looking:' + WANT + '!'] || 0) : 0; };
const evals = (r, job) => { const x = r.s.robots.find(q => q.job === job); if (!x) return null; const n = x.tally.good + x.tally.soso + x.tally.bad; return { n, green: n ? +(x.tally.good / n).toFixed(2) : 0, red: x.tally.bad }; };
const avg = (arr, n) => { const v = arr.slice(-n); return v.reduce((x, y) => x + y, 0) / Math.max(1, v.length); };
console.log('persona        $20    robot1  robot2  rule1  op x4  stk x4  earned  costs  $/min net(last5)  sat end/min  served/wrong  waiting(last10)  stocked/looking  junk');
runs.concat(hour).forEach(r => console.log(r.kind.padEnd(13) + ['$20', 'robot 1', 'robot 2', 'first rule', 'op4', 'stock4'].map(k => r.fmt(k).padStart(7)).join(' ') + String(r.s.earned).padStart(8) + String(r.s.spent).padStart(7) + r.last5.toFixed(1).padStart(17)
  + ('  ' + Math.round(r.s.satisfaction) + '/' + Math.round(r.satLow)).padStart(13) + (r.s.shop.served + '/' + r.s.shop.wrong).padStart(14) + avg(r.waitMin, 10).toFixed(2).padStart(17) + (stocked(r) + '/' + looked(r)).padStart(17) + String(junkOf(r.s)).padStart(6)));
if (DEBUG) runs.concat(hour).forEach(r => console.log(r.kind, JSON.stringify(r.s.seen), r.s.robots.map(x => x.name + ':' + x.job + ':' + JSON.stringify(x.rules) + JSON.stringify(x.record)).join(' | '), 'sat/min ' + r.satMin.map(Math.round).join(','), 'wait/min ' + r.waitMin.map(v => v.toFixed(1)).join(',')));
const R = Object.fromEntries(runs.map(r => [r.kind, r]));
const ho = R['hands-on'], sup = R['supervisor'], un = R['uninstructed'];

ok(ho.mark['$20'] < 150, 'the first $20 (seven planks carried to the counter and bought, less their logs) comes inside two and a half minutes', ho.fmt('$20'));
ok(ho.mark['robot 2'] < 9 * 60, 'both robots are on staff inside nine minutes of attentive play (seven before logs cost $1 each)', ho.fmt('robot 2'));
const PC = hour[0], SH = hour[1];
ok(PC.mark['op4'] < 25 * 60 && PC.mark['stock4'] < 25 * 60, 'on the optimal path (the delay first) each robot holds all four of its useful instructions inside 25 minutes (eight slots, $100 of them)', PC.fmt('op4') + ' / ' + PC.fmt('stock4'));
ok(!(SH.mark['op4'] < 2 * PC.mark['op4']) && !(ho.mark['op4'] < 2 * PC.mark['op4']), 'without the delay it takes over twice as long, or never comes: an operator faster than the customers buys logs it never sells, so the money for the slots comes late (logs cost $1 each)', 'supervisor ' + SH.fmt('op4') + ', hands-on ' + ho.fmt('op4') + ' vs ' + PC.fmt('op4'));
const before = ho.satMin.slice(0, Math.max(1, Math.floor(ho.mark['robot 1'] / 60)));
ok(Math.min.apply(null, before) >= 80, 'working alone, a person can keep up with the customers: customer satisfaction stays above 80% until the first robot arrives', before.map(Math.round).join(','));
const wa = R['walks away'];
ok(wa.last5 < 1 && wa.s.machine.phase === 'jam', 'robots left alone stall: the first sap jam stops the line and nobody fixes it', wa.last5.toFixed(1) + ' $/min, planer ' + wa.s.machine.phase);
ok(avg(wa.waitMin, 5) > C.shop.max - 1 && wa.s.satisfaction <= C.satMin + 1, 'and the shop fills with customers waiting at an empty stall, which takes customer satisfaction to the floor', avg(wa.waitMin, 5).toFixed(1) + ' waiting, ' + Math.round(wa.s.satisfaction) + '%');
ok(sup.last5 > 2 * Math.max(1, un.last5), 'instructions pay: the instructed line earns over twice the uninstructed one by the end', sup.last5.toFixed(1) + ' vs ' + un.last5.toFixed(1));
ok(un.s.satisfaction < 60 && sup.s.satisfaction > un.s.satisfaction + 30 && un.s.shop.wrong > 20, 'an uninstructed stocker puts everything in the medium plank stall and wears customer satisfaction down; an instructed one keeps it', Math.round(un.s.satisfaction) + '% (' + un.s.shop.wrong + ' sold something else) vs ' + Math.round(sup.s.satisfaction) + '%');
// over the last ten minutes, not five: two lines at the satisfaction floor differ by a jam or two in
// any five minutes (the four stalls' shop moved this pair from 1.2 to 2.1 $/min apart over five, and
// 0.6 to 1.1 over ten, with nothing about instructions changed; 2026-10-16)
const cr10 = avg(R['crossed'].perMin, 10), un10 = avg(un.perMin, 10);
ok(Math.abs(cr10 - un10) <= Math.max(1.5, 0.25 * Math.abs(un10)) && R['crossed'].last5 < sup.last5 / 2, 'an instruction about the other robot\'s job is worth nothing: crossed wires earn like no instructions at all (the last ten minutes)', cr10.toFixed(1) + ' vs ' + un10.toFixed(1) + ' $/min');
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
ok(sw !== undefined && beforeSwap.length >= 2 && beforeSwap.reduce((x, y) => x + y, 0) < 0 && afterSwap.reduce((x, y) => x + y, 0) > 0 && of.mark['robot 2'] !== undefined && of.mark['robot 2'] < 15 * 60 && of.s.satisfaction >= 90,
  'a robot put on the planer first loses money (it presses every log while you still carry every plank); moved to stocking, the money comes back, the second robot follows, and the line ends healthy',
  'swapped at ' + of.fmt('swapped') + ', $/min before ' + beforeSwap.join(',') + ', after ' + afterSwap.join(',') + '; robot 2 at ' + of.fmt('robot 2') + ', ' + Math.round(of.s.satisfaction) + '%');

/* ---------- a valid optimal path exists, and works ---------- */
const recyclers = k => F.RULES.filter(q => q.job === 'stock' && q.recycles && (!q.recycles.kind || q.recycles.kind.indexOf(F.kindOf(k)) >= 0) && (!q.recycles.size || q.recycles.size.indexOf(F.sizeOf(k)) >= 0));
const fixes = F.LOGS.filter(k => k !== 'log.m').map(k => [k, F.keepers(k)])
  .concat(F.PRODUCTS.filter(k => k !== WANT).map(k => [k, recyclers(k).map(q => q.id)]));
const seenUn = un.s.seen, missing = fixes.filter(([k, ids]) => !ids.length || !ids.some(id => seenUn[id])).map(([k, ids]) => k + (ids.length ? ' (' + ids.join('/') + ' never joined the list)' : ' (nothing fixes it)'));
ok(!missing.length && PLAN.operate.concat(PLAN['stock:0']).every(id => seenUn[id]), 'a valid path exists: every log but a normal medium one and every product but a medium plank has an instruction that deals with it, and every one of them joins the list in real play',
  missing.join(', ') || fixes.map(([k, ids]) => k + ':' + ids.join('/')).join(' '));
const late = PC.junkMin.slice(-10);
ok(PC.mark.stock4 !== undefined && PC.mark.op4 !== undefined && Math.max.apply(null, late) <= 4 && junkOf(PC.s) <= 2 && PC.s.satisfaction >= 90 && avg(PC.waitMin, 10) < 1, 'followed, the plan clears the floor: in the optimal path\'s last ten minutes the output bin never holds more than four other things, hardly anyone waits, and customers stay happy',
  'junk by minute ' + PC.junkMin.join(',') + '; waiting ' + avg(PC.waitMin, 10).toFixed(2) + '; satisfaction ' + Math.round(PC.s.satisfaction));
const eo = evals(PC, 'operate'), es = evals(PC, 'stock:0');
ok(eo && es && eo.n > 50 && es.n > 30 && eo.green >= 0.6 && es.green >= 0.8 && es.red === 0, 'and once each robot holds its plan and its evals are reset, they come back mostly green (the operator\'s yellow is stopping to think, which nothing covers) and the stocker\'s with no red at all',
  'operator ' + JSON.stringify(eo) + ', stocker ' + JSON.stringify(es));
const fills = runs.filter(r => junkOf(r.s) >= 20);
const stuck = fills.filter(r => r.s.bin.some(k => k !== WANT && !recyclers(k).some(q => r.s.seen[q.id])));
ok(fills.some(r => r.kind === 'stock planks') && !stuck.length, 'where an output bin fills up (the stocker told only "only stock medium planks"), every kind of thing filling it has a recycle instruction already on that persona\'s list',
  'filled: ' + fills.map(r => r.kind + ' (' + junkOf(r.s) + ')').join(', ') + (stuck.length ? '; NO WAY OUT for ' + stuck.map(r => r.kind).join(', ') : ''));
const so = R['stocker only'];
ok(junkOf(so.s) <= 3 && Math.max.apply(null, so.junkMin.slice(-10)) <= 5 && so.s.costs.fixes > PC.s.costs.fixes, 'and a stocker given its whole plan keeps the bin clear even behind an operator told nothing (it recycles what it cannot stock), though that line pays for every junk log and every jam', junkOf(so.s) + ' left; by minute ' + so.junkMin.join(',') + '; jams $' + so.s.costs.fixes + ' vs $' + PC.s.costs.fixes);

/* ---------- the delay between tasks (the CD, 2026-10-16): overproduction, and its cure ---------- */
const [pc, sh] = hour, after = pc.mark.paced === undefined ? [] : pc.satMin.slice(Math.ceil(pc.mark.paced / 60));
const bins = r => r.plankMin.join(','), tail = (r, n) => r.plankMin.slice(-n);
console.log('paced 1h: delay put in at ' + pc.fmt('paced') + ', waits ' + pc.waits.join(',') + ' s; medium planks in the bin by minute ' + bins(pc) + ' (supervisor 1h: ' + bins(sh) + ')');
ok(tail(sh, 1)[0] >= 10 * C.stallCap && tail(sh, 20).every((v, k, a) => !k || v >= a[k - 1] - 2) && tail(sh, 1)[0] > tail(sh, 20)[0] + 2 * C.stallCap,
  'a line that makes more than it sells fills its output bin with medium planks once the stall is stocked: the supervisor\'s keeps climbing for its last twenty minutes, each one a log paid for and never sold',
  'by minute ' + bins(sh));
ok(pc.mark.paced !== undefined && Math.max.apply(null, tail(pc, 20)) <= 3 * C.stallCap && tail(pc, 1)[0] < tail(sh, 1)[0] / 4,
  'told to wait between tasks, and the slider tuned by what piles up, the operator stops it: in the paced hour\'s last twenty minutes the bin never holds more than three stalls\' worth',
  'put in at ' + pc.fmt('paced') + ', waits ' + pc.waits.join(',') + ' s; by minute ' + bins(pc));
ok(pc.s.satisfaction >= 90 && avg(pc.waitMin, 10) < 1 && pc.s.shop.served >= 0.95 * sh.s.shop.served && Math.min.apply(null, after.length ? after : [0]) >= 50,
  'without starving the customers: they are served as often as without the delay, hardly anyone waits at the end, and customer satisfaction ends where it was',
  'served ' + pc.s.shop.served + ' vs ' + sh.s.shop.served + ', waiting ' + avg(pc.waitMin, 10).toFixed(2) + ', satisfaction ' + Math.round(pc.s.satisfaction) + '% (lowest after the delay ' + Math.round(Math.min.apply(null, after.length ? after : [0])) + '%)');
ok(pc.s.spent < sh.s.spent && pc.s.money > sh.s.money && pc.s.money - sh.s.money > C.slots[C.slots.length - 1],
  'and it pays: fewer logs pressed for nothing leaves more money at the end of the hour than the slot it took cost',
  'money ' + pc.s.money + ' vs ' + sh.s.money + ', running costs ' + pc.s.spent + ' vs ' + sh.s.spent + ', bought ' + pc.bought + ' vs ' + sh.bought);

// the books balance: money is what was earned, less what the machines cost and what was bought
ok(runs.concat(hour).every(r => F.cents(r.s.money) === r.s.money && Math.abs(r.s.money - (r.s.earned - r.s.spent - r.bought)) < 1e-6), 'every persona\'s money is what it earned, less the running costs and its purchases', runs.concat(hour).map(r => r.kind + ':' + r.s.money).join(' '));

// not asserted: how a slider left at one value does, seed by seed (EVAL_WAITS=1)
if (process.env.EVAL_WAITS) {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8], base = seeds.map(sd => persona('supervisor', 60, sd));
  [undefined, 2, 3, 4, 5].forEach(w => {
    const rr = seeds.map(sd => persona('paced', 60, sd, w));
    console.log('WAITS ' + (w === undefined ? 'tuned' : w + ' s  ') + ' bin at 1h ' + rr.map(r => tail(r, 1)[0]).join('/') + ' (none: ' + base.map(r => tail(r, 1)[0]).join('/') + ')  satisfaction ' + rr.map(r => Math.round(r.s.satisfaction)).join('/') +
      '  money vs no delay ' + rr.map((r, k) => (r.s.money >= base[k].s.money ? '+' : '') + (r.s.money - base[k].s.money)).join('/'));
  });
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY-EVAL: ' + (failed ? 'RED' : process.env.TAAS_PAGE ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
