#!/usr/bin/env node
/**
 * eval-taas-factory.cjs — the robot factory's pacing and shape (pure node, opt-in, about a minute).
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
 *                  beside the supervisor played for the same hour, on seeds 1-12.
 * The growing personas (taasstalls step 4, 2026-10-17; assumed players, section "growing the
 * factory" below): the paced one that, once both robots hold their plans, buys stalls, sets them,
 * hires robots for them and for slots 02-04, takes out instructions that would work against a new
 * stall, and carries what no robot carries; seven ways (a second stall of the same thing, the saw
 * line, four stalls of medium planks and 2x4s, the one stall switched to 2x4s, large planks, a stall
 * set before it is staffed, everything), two hours each on seeds 7-12, beside the paced line that
 * never grows. The slider rule, once growing, also shortens the wait when a customer waits at any
 * empty stall.
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
 * between the operator's logs ends that and pays on most seeds, though the 5 s it starts at starves
 * the line on some; all of this over twelve seeds, since seed 7 alone once carried a claim that held
 * on no other)
 * and that **a valid optimal path exists and works**: every kind of trouble the floor can make has
 * an instruction that fixes it and that instruction joins the list in real play; the plan, followed,
 * leaves no junk piling up in the output bin, hardly anyone waiting and evals that are almost all
 * green; and wherever a persona's bin does fill up, the instructions that would empty it were on
 * its list (the dead end was the persona's, not the game's: "NO WAY OUT" otherwise); and the economy
 * of growing (customers come no faster for more stalls, so a stall pays only by selling something
 * worth more and only while it is kept supplied; a scarce thing's stall, a stall nobody stocks and a
 * far-fetching robot serving every customer all lock the shop; buying everything does not pay). Every number
 * is a first-draft guess; change a row only if the CD changes the design it describes.
 *
 * Usage: node .claude/tests/eval-taas-factory.cjs      Final line: TAAS-FACTORY-EVAL: GREEN | RED
 *        EVAL_WAITS=1 adds a sweep (not asserted): the paced persona with the slider left at 2, 3, 4
 *        and 5 s, against the supervisor, over seeds 1-8, an hour each (~10 s more).
 *        EVAL_SEEDS=1,2,... and EVAL_GROW_SEEDS=7,8,... choose the seeds of the delay's and the
 *        growth's sections (defaults 1-12 and 7-12).
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

// G, a growth plan (taasstalls step 4; assumed players): once the first two robots hold their plans
// the persona works through G.steps in order, each when it can pay for it and keep G.reserve:
// { buy: i } buys stall i (which sells nothing, so nobody comes for it, until it is set), { hire:
// job } hires the next robot onto that job, { sell: i, item } sets what stall i sells. From then on G.plans replaces PLAN for the jobs it names (and
// gives the new stalls' robots theirs), and whatever a robot holds that is not in its plan (the
// delay apart) is taken out of its slot. G.cut is the saw robot's cut. G.haul is what the person
// carries that no robot does: { saw: plank } feeds the table saw that plank from the planer's bin,
// extract carries sap logs out of the recycle bin to the extractor and its clean logs back to the
// planer's input bin, bench carries gnarled wood out of the recycle bin to the bench. A persona
// with G.haul keeps working after its robots are on staff, as the hands-on one does.
function persona(kind, minutes, seed, fixedWait, G) {
  const s = F.newGame(seed || 1), DT = 0.05, END = minutes * 60;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastNet = 0, page = null, bought = 0, swap = false;
  const perMin = [], junkMin = [], waitMin = [], satMin = [];
  let waitSum = 0, waitN = 0;
  const resetAt = {};
  const plankMin = [], waits = [];
  let paceAsk = false, paceTo = null, lookAt = 0, lastPlanks = 0;
  let growing = false, next = 0, hireAs = null;
  const growBought = { stalls: 0, robots: 0, slots: 0 };
  const servedMin = [], earnedMin = [], moneyMin = [];
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = (k, id) => s.avatar.task && s.avatar.task.kind === k && (id === undefined || s.avatar.task.id === id || s.avatar.task.i === id) && (s.avatar.path.length || s.avatar.act);
  const want = (k, id) => { if (!busyWith(k, id)) F.tap(s, k === 'stall' ? { kind: k, i: id || 0 } : id === undefined ? { kind: k } : { kind: k, id }); };
  const instructs = ['paced', 'hands-on', 'supervisor', 'crossed', 'stocker only', 'stock planks', 'operator first'].indexOf(kind) >= 0;
  const handsOn = kind === 'hands-on' || kind === 'operator first';
  const planFor = r => {
    if (!instructs || !r.job || (kind === 'stocker only' || kind === 'stock planks') && r.job !== 'stock:0') return [];
    if (kind === 'stock planks') return ['stockOnly'];
    const P = growing && G.plans && G.plans[r.job] ? G.plans : PLAN;
    return P[kind === 'crossed' ? other(r.job) : r.job] || [];
  };
  const nextFor = r => planFor(r).find(id => s.seen[id] && r.rules.indexOf(id) < 0) || null;
  // an instruction a growing persona takes out: one its robot holds that its new plan has not
  const extraFor = r => growing && G.plans && G.plans[r.job] ? r.rules.find(id => id && id !== 'delay' && planFor(r).indexOf(id) < 0) || null : null;
  const recut = r => growing && G.cut && r.job === 'saw' && r.cut !== G.cut;
  const afford = r => r.rules.indexOf(null) >= 0 || (F.slotPrice(s, r.id) !== null && s.money >= F.slotPrice(s, r.id));
  const room = (i) => C.stallCap - s.stalls[i || 0].stock.length;   // the one-line personas' stall is the first
  // what a hauling persona does with a thing in its arms: a stall that sells it, the bin that uses it, or the recycle bin
  const H = G && G.haul || {};
  const sellAt = item => s.stalls.findIndex((st, i) => st.bought && st.want === item && room(i) > 0);
  const sold = item => s.stalls.some(st => st.bought && st.want === item);
  const sawRoom = () => s.saw.in.length + s.saw.out.length < C.stallCap;   // feed the saw only what its stall can use
  const dest = item => item === H.saw ? (sawRoom() ? 'sawIn' : null) : H.extract && F.kindOf(item) === 'sappy' ? 'extractIn' : H.extract && F.kindOf(item) === 'log' ? 'rack'
    : H.bench && (F.kindOf(item) === 'gnarled' || F.kindOf(item) === 'rough') ? 'benchIn' : null;
  const keep = item => sold(item) || item === H.saw || !!dest(item);   // what a hauling persona never recycles
  const fetchable = item => (H.extract && F.kindOf(item) === 'sappy') || (H.bench && (F.kindOf(item) === 'gnarled' || F.kindOf(item) === 'rough'));
  while (s.t < END) {
    F.step(s, DT);
    s.events.forEach(e => {
      if (e.kind === 'notes') page = e.id;
      if (e.kind === 'hired' || e.kind === 'slot' || e.kind === 'stallbought') {
        bought += e.price;
        if (growing) growBought[e.kind === 'hired' ? 'robots' : e.kind === 'slot' ? 'slots' : 'stalls'] += e.price;
      }
    });
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
    if (G && !growing && mark.op4 !== undefined && mark.stock4 !== undefined) { growing = true; at('grow'); }
    if (G && growing && next >= G.steps.length) at('grown');
    if (Math.floor(s.t / 60) > perMin.length) {
      const net = s.earned - s.spent;
      perMin.push(net - lastNet); lastNet = net; junkMin.push(junkOf(s)); waitMin.push(waitSum / waitN); satMin.push(s.satisfaction); plankMin.push(count(s.bin, WANT)); waitSum = 0; waitN = 0;
      servedMin.push(s.shop.served); earnedMin.push(s.earned); moneyMin.push(s.money);
    }
    s.robots.forEach(r => { const plan = planFor(r); if (plan.length && resetAt[r.id] === undefined && plan.every(id => r.rules.indexOf(id) >= 0)) { F.resetEvals(s, r.id); resetAt[r.id] = s.t; } });
    const m = s.machine, bub = F.bubbleOpen(s), a = s.avatar;
    if (m.phase === 'jam') { if (jamSeen < 0) jamSeen = s.t; } else jamSeen = -1;
    if (page !== null) {
      const r = s.robots[page];
      // the paced persona's delay goes in before the rest of the operator's plan
      if (paceAsk && r.job === 'operate' && r.rules.indexOf('delay') < 0 && afford(r)) { if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id); F.setRule(s, r.id, r.rules.indexOf(null), 'delay'); }
      for (let id = extraFor(r); id; id = extraFor(r)) F.setRule(s, r.id, r.rules.indexOf(id), null);
      if (recut(r)) F.setCut(s, r.id, G.cut);
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
      if (bub.kind === 'recycle') {
        let o;
        while ((o = F.options(s).find(x => x.enabled && x.group === 'put' && !(growing && G.haul && keep(x.item))))) F.choose(s, o.id);
        if (growing) while ((o = F.options(s).find(x => x.group === 'take' && fetchable(x.item)))) F.choose(s, o.id);
        s.bubble = null; continue;
      }
      if (bub.kind === 'dock') { if (F.choose(s, 'hire')) { F.choose(s, hireAs ? 'job:' + hireAs : (s.hired === 1) === (kind !== 'operator first') ? 'job:stock:0' : 'job:operate'); hireAs = null; } s.bubble = null; continue; }
      if (bub.kind === 'robot') { if (swap) { F.choose(s, 'job:stock:0'); swap = false; at('swapped'); } else F.choose(s, 'notes'); continue; }
      if (bub.kind === 'stall' && growing && G.steps[next] && (G.steps[next].buy === bub.i || G.steps[next].sell === bub.i)) {
        const g = G.steps[next];
        if (g.buy !== undefined) F.choose(s, 'buystall'); else F.choose(s, 'sell:' + g.item);
        s.bubble = null; continue;
      }
      if (growing && F.ACCEPTS[bub.kind]) { let o; while ((o = F.options(s).find(x => x.group === 'put' && dest(x.item) === bub.kind))) F.choose(s, o.id); s.bubble = null; continue; }
      s.bubble = null;
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const late = handsOn || s.hired < 2 ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    const hp = F.hirePrice(s);
    if (hp !== null && s.money >= hp && s.hired < 2) { want('dock'); continue; }
    if (F.slotsOpen(s)) { const r = s.robots.find(x => (nextFor(x) && afford(x)) || extraFor(x) || recut(x)); if (r) { want('robot', r.id); continue; } }
    // growing: the next step, once it can be paid for with the reserve kept
    if (growing && next < G.steps.length) {
      const g = G.steps[next], keep = G.reserve || 0;
      if (g.buy !== undefined) {
        const p = F.stallPrice(s);
        if (s.stalls[g.buy].bought) next++;
        else if (p !== null && s.money >= p + keep) { want('stall', g.buy); continue; }
      } else if (g.sell !== undefined) {
        if (s.stalls[g.sell].want === g.item) next++;
        else { want('stall', g.sell); continue; }
      } else if (g.hire) {
        if (s.robots.some(r => r.job === g.hire)) next++;
        else if (hp !== null && s.money >= hp + keep) { hireAs = g.hire; want('dock'); continue; }
      }
    }
    // the way out of an operator hired first: once money has fallen two minutes running, move it to stocking
    if (kind === 'operator first' && s.hired === 1 && op && perMin.length >= 3 && perMin.slice(-2).every(v => v < 0)) { swap = true; want('robot', op.id); continue; }
    // the paced supervisor: the delay goes in once planks pile up behind a full stall, then the slider is tuned by the bin
    if (kind === 'paced' && op && mark.paced === undefined && afford(op)) { paceAsk = true; want('robot', op.id); continue; }
    if (kind === 'paced' && op && mark.paced !== undefined && fixedWait === undefined && s.t >= lookAt) {
      // short: a customer waits at an empty stall (the first stall's, or once growing any open one's)
      const empty = growing ? s.shop.people.some(c => c.state === 'wait' && c.at === 'stall' && !s.stalls[c.stall].stock.length) : F.waitingNow(s) > 0 && !s.stalls[0].stock.length;
      const planks = count(s.bin, WANT), short = empty;
      let to = planks < 2 || short ? op.wait - 1 : planks > C.stallCap && planks >= lastPlanks ? op.wait + 1 : op.wait;
      to = Math.max(C.wait.min, Math.min(C.wait.max, to));
      lookAt = s.t + 60; lastPlanks = planks;
      if (to !== op.wait) { paceAsk = true; paceTo = to; want('robot', op.id); continue; }
    }
    // a hauling persona, growing: its arms first (a stall, the bin that uses the thing, the recycle bin), then what to fetch
    if (growing && G.haul) {
      const kinds = F.kindsIn(a.inv).map(q => q.item);
      const toStall = kinds.find(k => sellAt(k) >= 0), toBin = kinds.find(k => dest(k));
      if (toStall) { want('stall', sellAt(toStall)); continue; }
      if (toBin) { want(dest(toBin)); continue; }
      if (kinds.some(k => !keep(k))) { want('recycle'); continue; }
      if (H.saw && sawRoom() && !count(a.inv, H.saw) && count(s.bin, H.saw) >= 2) { want('bin'); continue; }
      if (H.extract && s.extract.out.some(k => F.kindOf(k) === 'log')) { want('extractOut'); continue; }
      if ((H.extract && !s.extract.in.length) || (H.bench && !s.bench.in.length)) {
        if (s.recycle.some(k => fetchable(k) && (F.kindOf(k) === 'sappy' ? !s.extract.in.length : !s.bench.in.length))) { want('recycle'); continue; }
      }
      continue;
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
  return { kind, s, mark, fmt, satLow, perMin, last5, junkMin, waitMin, satMin, resetAt, bought, plankMin, waits, growBought, servedMin, earnedMin, moneyMin, G };
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
const PC = hour[0];
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

/* ---------- the delay between tasks (the CD, 2026-10-16): overproduction, and its cure, over twelve seeds ---------- */
// Seed 7 alone once said the delay brings the plans "over twice" as fast; on seeds 1-12 that held on
// seed 7 only (taasstalls step 4, 2026-10-17), so every claim about the delay is made over the twelve.
const bins = r => r.plankMin.join(','), tail = (r, n) => r.plankMin.slice(-n);
const SEEDS = process.env.EVAL_SEEDS ? process.env.EVAL_SEEDS.split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const pairs = SEEDS.map(sd => sd === 7 ? { sd, pc: hour[0], sh: hour[1] } : { sd, pc: persona('paced', 60, sd), sh: persona('supervisor', 60, sd) });
const lowAfter = r => r.mark.paced === undefined ? 0 : Math.min.apply(null, r.satMin.slice(Math.ceil(r.mark.paced / 60)).concat([100]));
const most = (n, of) => n >= Math.ceil(0.75 * of);   // three seeds in four
const mins = r => (r.mark.op4 === undefined ? '-' : (r.mark.op4 / 60).toFixed(0)) + '/' + (r.mark.stock4 === undefined ? '-' : (r.mark.stock4 / 60).toFixed(0));
console.log('delay, 1h, seed: paced (delay in at, plans op/stock in minutes, bin at 1h, lowest satisfaction after the delay, money)  vs  supervisor (plans, bin, money)');
pairs.forEach(({ sd, pc, sh }) => console.log('  ' + String(sd).padStart(2) + ': ' + pc.fmt('paced') + ' ' + mins(pc) + ' ' + tail(pc, 1)[0] + ' ' + Math.round(lowAfter(pc)) + '% $' + pc.s.money.toFixed(0) + '  vs  ' + mins(sh) + ' ' + tail(sh, 1)[0] + ' $' + sh.s.money.toFixed(0)));
const climbs = r => tail(r, 1)[0] >= 10 * C.stallCap && tail(r, 20).every((v, k, a) => !k || v >= a[k - 1] - 2) && tail(r, 1)[0] > tail(r, 20)[0] + 2 * C.stallCap;
ok(pairs.every(p => climbs(p.sh)),
  'a line that makes more than it sells fills its output bin with medium planks once the stall is stocked: on every seed the supervisor\'s holds ten stalls\' worth at the hour and is still climbing, each one a log paid for and never sold',
  pairs.map(p => p.sd + ':' + tail(p.sh, 20)[0] + '->' + tail(p.sh, 1)[0]).join(' '));
ok(pairs.every(p => p.pc.mark.paced !== undefined && Math.max.apply(null, tail(p.pc, 20)) <= 3 * C.stallCap && tail(p.pc, 1)[0] < tail(p.sh, 1)[0] / 4),
  'told to wait between tasks, and the slider tuned by what piles up, the operator stops it: on every seed the paced hour\'s bin never holds more than three stalls\' worth in its last twenty minutes',
  pairs.map(p => p.sd + ':' + Math.max.apply(null, tail(p.pc, 20))).join(' '));
ok(pairs.every(p => p.pc.s.spent < p.sh.s.spent), 'so it buys fewer logs: the paced line spends less on every seed', pairs.map(p => p.sd + ':' + p.pc.s.spent.toFixed(0) + '/' + p.sh.s.spent.toFixed(0)).join(' '));
const pays = pairs.filter(p => p.pc.s.money - p.sh.s.money > C.slots[C.slots.length - 1]), poorer = pairs.filter(p => pays.indexOf(p) < 0);
ok(most(pays.length, pairs.length) && poorer.every(p => lowAfter(p.pc) < 50),
  'and it pays on most seeds (more money at the hour than the slot it took cost); where it does not, the 5 s the slider starts at had starved the line (customer satisfaction under 50% after the delay went in)',
  'pays on ' + pays.length + '/' + pairs.length + '; not on ' + (poorer.map(p => p.sd + ' (lowest ' + Math.round(lowAfter(p.pc)) + '%)').join(', ') || 'none'));
const starved = pairs.filter(p => lowAfter(p.pc) < 50);
ok(starved.length >= 1, 'the 5 s the slider starts at is too long on some seeds: an operator holding its whole plan and told to wait 5 s leaves customers standing at an empty stall until the slider comes down (open question 10)',
  'under 50% after the delay on ' + (starved.map(p => p.sd + ' (' + Math.round(lowAfter(p.pc)) + '%)').join(', ') || 'none'));
const whole = r => r.mark.op4 !== undefined && r.mark.stock4 !== undefined;
ok(most(pairs.filter(p => whole(p.pc)).length, pairs.length),
  'on the optimal path (the delay first) both robots hold all four of their useful instructions inside the hour on most seeds (how long it takes, with the delay or without, varies too much from seed to seed to claim more)',
  pairs.filter(p => whole(p.pc)).length + '/' + pairs.length + ' (paced ' + pairs.map(p => mins(p.pc)).join(' ') + '; supervisor ' + pairs.map(p => mins(p.sh)).join(' ') + ')');

/* ---------- growing the factory (taasstalls step 4, 2026-10-17): stalls, and robots for them and for slots 02-04 ---------- */
// Each persona below is the paced one (the optimal one-line path) that, once both of its robots hold
// their plans, grows the factory one way (assumed players). Customers still come one every 8-16 s
// whatever is on the counter, each for one of the stalls that sell something, all equally likely
// (the CD, 2026-10-16), so a stall can only change what a customer pays, never how many come.
// Played for two hours on seeds 7-12 and set beside the paced line that never grows.
const GROW = {
  // a second stall selling what the first sells, and its robot
  'second stall': { steps: [{ buy: 1 }, { hire: 'stock:1' }, { sell: 1, item: 'plank.m' }], plans: { 'stock:1': ['stockOnly', 'smallOut', 'largeOut', 'roughOut'] }, reserve: 20 },
  // a second stall for medium 2x4s ($6): a robot on the table saw, the stall's robot fetching from
  // the saw's output bin, and the person carrying medium planks from the planer's bin to the saw
  'saw line': { steps: [{ buy: 1 }, { hire: 'saw' }, { hire: 'stock:1' }, { sell: 1, item: 'b2x4.m' }], plans: { 'stock:1': ['only:b2x4.m'] }, haul: { saw: 'plank.m' }, reserve: 20 },
  // all four stalls, three of them medium 2x4s
  'all medium': { steps: [{ buy: 1 }, { hire: 'saw' }, { hire: 'stock:1' }, { sell: 1, item: 'b2x4.m' }, { buy: 2 }, { hire: 'stock:2' }, { sell: 2, item: 'b2x4.m' }, { buy: 3 }, { hire: 'stock:3' }, { sell: 3, item: 'b2x4.m' }],
    plans: { 'stock:1': ['only:b2x4.m'], 'stock:2': ['only:b2x4.m'], 'stock:3': ['only:b2x4.m'] }, haul: { saw: 'plank.m' }, reserve: 20 },
  // no new stall: the first switched to medium 2x4s, with a robot on the saw
  'cut stall': { steps: [{ hire: 'saw' }, { sell: 0, item: 'b2x4.m' }], plans: { 'stock:0': ['only:b2x4.m'] }, haul: { saw: 'plank.m' }, reserve: 20 },
  // a second stall for large planks ($8), and the instructions that would throw them away taken out
  'large planks': { steps: [{ buy: 1 }, { hire: 'stock:1' }, { sell: 1, item: 'plank.l' }], plans: { operate: ['sappy', 'gnarled', 'smallLog'], 'stock:0': ['stockOnly', 'smallOut', 'roughOut'], 'stock:1': ['only:plank.l', 'smallOut', 'roughOut'] }, reserve: 20 },
  // a second stall set to sell before anyone is there to stock it
  'set first': { steps: [{ buy: 1 }, { sell: 1, item: 'plank.m' }, { hire: 'stock:1' }], plans: { 'stock:1': ['stockOnly', 'smallOut', 'largeOut', 'roughOut'] }, reserve: 20 },
  // everything: four stalls (medium planks, two of medium 2x4s, sap) and all eight robots, the
  // person carrying planks to the saw, sap logs to the extractor (its clean logs back to the planer)
  // and gnarled wood to the bench
  'full house': { steps: [{ buy: 1 }, { hire: 'saw' }, { hire: 'stock:1' }, { sell: 1, item: 'b2x4.m' }, { buy: 2 }, { hire: 'stock:2' }, { sell: 2, item: 'b2x4.m' }, { buy: 3 }, { hire: 'extract' }, { hire: 'stock:3' }, { sell: 3, item: 'sap' }, { hire: 'carve' }],
    plans: { 'stock:1': ['only:b2x4.m'], 'stock:2': ['only:b2x4.m'], 'stock:3': ['only:sap'] }, haul: { saw: 'plank.m', extract: true, bench: true }, reserve: 20 }
};
const GSEEDS = process.env.EVAL_GROW_SEEDS ? process.env.EVAL_GROW_SEEDS.split(',').map(Number) : [7, 8, 9, 10, 11, 12], GMIN = 120;
const gbase = GSEEDS.map(sd => persona('paced', GMIN, sd));
const grows = Object.fromEntries(Object.keys(GROW).map(k => [k, GSEEDS.map(sd => { const r = persona('paced', GMIN, sd, undefined, GROW[k]); r.kind = k + ' ' + sd; return r; })]));
// the last twenty minutes: customers served, what each paid on average, net money a minute, customers waiting
const last20 = r => { const n = r.servedMin.length, sv = r.servedMin[n - 1] - r.servedMin[n - 21], ea = r.earnedMin[n - 1] - r.earnedMin[n - 21]; return { served: sv, per: sv ? ea / sv : 0, net: avg(r.perMin, 20), wait: avg(r.waitMin, 20) }; };
console.log('growth, 2h, seeds ' + GSEEDS.join(',') + ': grew at, all bought at, invested, money vs the line that never grows / $ a customer, net $ a minute, served, waiting (last 20 min) / satisfaction at 2h');
Object.keys(grows).forEach(k => { console.log('  ' + k); grows[k].forEach((r, i) => { const b = gbase[i], L = last20(r), LB = last20(b);
  console.log('    ' + String(GSEEDS[i]).padStart(2) + ': ' + r.fmt('grow') + ' ' + r.fmt('grown') + ' $' + (r.growBought.stalls + r.growBought.robots + r.growBought.slots) + ' $' + r.s.money.toFixed(0) + ' vs $' + b.s.money.toFixed(0) + ' / $' + L.per.toFixed(2) + ' vs $' + LB.per.toFixed(2) + ', ' + L.net.toFixed(1) + ' vs ' + LB.net.toFixed(1) + ' $/min, ' + L.served + ' vs ' + LB.served + ' served, ' + L.wait.toFixed(1) + ' waiting / ' + Math.round(r.s.satisfaction) + '%'); }); });
// the seeds on which the line's plans came, so the factory grew (the same seeds for every persona: until then each plays as the line)
const grew = GSEEDS.map((sd, i) => i).filter(i => grows['second stall'][i].mark.grow !== undefined);
const each = (k, f) => grew.every(i => f(grows[k][i], gbase[i], i));
const show = (k, f) => grew.map(i => GSEEDS[i] + ':' + f(grows[k][i], gbase[i], i)).join(' ');
ok(grew.length >= 4 && Object.keys(grows).every(k => grew.every(i => grows[k][i].mark.grow !== undefined)), 'the line\'s plans come in time to grow on most seeds (every growing persona plays as the line until they do)', grew.length + '/' + GSEEDS.length);
ok(each('second stall', (r, b) => r.mark.grown !== undefined && Math.abs(last20(r).per - last20(b).per) < 0.05 && r.s.money < b.s.money),
  'a second stall selling what the first sells brings no more customers (they come one every 8 to 16 s whatever is on the counter) and each still pays the same, so with its robot it never pays its way',
  show('second stall', (r, b) => '$' + last20(r).per.toFixed(2) + ' $' + (r.s.money - b.s.money).toFixed(0)));
ok(each('saw line', (r, b) => r.mark.grown !== undefined && last20(r).per >= 1.15 * last20(b).per && last20(r).net > last20(b).net) && grew.filter(i => grows['saw line'][i].s.money > gbase[i].s.money).length >= Math.ceil(2 * grew.length / 3),
  'a stall that sells something worth more pays when it is kept supplied: medium 2x4s from the table saw raise what a customer pays by a fifth and the money a minute with it, and the factory is ahead of the one that never grew within two hours on most seeds',
  show('saw line', (r, b) => '$' + last20(r).per.toFixed(2) + ' ' + last20(r).net.toFixed(1) + '/min $' + (r.s.money - b.s.money).toFixed(0)));
ok(each('all medium', (r, b, i) => r.mark.grown !== undefined && last20(r).per > last20(grows['saw line'][i]).per + 0.25 && last20(r).net > last20(grows['saw line'][i]).net && r.s.money < b.s.money),
  'four stalls, three of them medium 2x4s, earn the most a minute of any factory here, but cost too much to pay back inside two hours',
  show('all medium', (r, b) => '$' + last20(r).per.toFixed(2) + ' ' + last20(r).net.toFixed(1) + '/min $' + (r.s.money - b.s.money).toFixed(0)));
ok(each('cut stall', r => r.mark.grown !== undefined && r.s.satisfaction <= 20 && last20(r).wait >= 4),
  'switching the one stall to 2x4s starves it: every customer now wants a thing its robot fetches one at a time from the saw\'s output bin, about ten metres there and back, and one robot cannot keep up with every customer',
  show('cut stall', r => Math.round(r.s.satisfaction) + '% ' + last20(r).wait.toFixed(1) + ' waiting'));
ok(each('large planks', (r, b) => r.mark.grown !== undefined && last20(r).served < last20(b).served && last20(r).wait >= 4 && r.s.satisfaction <= 20 && r.s.money < b.s.money),
  'a stall whose thing is scarce takes the shop with it: large planks come from about one log in nine, half the customers come for them, and they fill the shop and wait while fewer of the others get in, which takes customer satisfaction to the floor',
  show('large planks', (r, b) => last20(r).served + '/' + last20(b).served + ' served, ' + last20(r).wait.toFixed(1) + ' waiting, ' + Math.round(r.s.satisfaction) + '%'));
ok(each('set first', r => last20(r).served === 0 && last20(r).wait > C.shop.max - 0.5),
  'a stall set to sell before anyone is there to stock it locks the shop: its customers fill it and stay, nobody else is served, and with no money coming in its robot is never hired',
  show('set first', r => last20(r).served + ' served, ' + last20(r).wait.toFixed(1) + ' waiting, hired ' + r.s.hired));
const allIn = grew.filter(i => grows['full house'][i].mark.grown !== undefined);
ok(allIn.length >= Math.ceil(2 * grew.length / 3) && allIn.every(i => grows['full house'][i].s.hired === C.hire.length && grows['full house'][i].s.stalls.every(st => st.bought && st.want))
  && each('full house', (r, b, i) => r.s.money < b.s.money && last20(r).per < last20(grows['saw line'][i]).per)
  && allIn.every(i => grows['full house'][i].s.robots.some(x => x.job === 'carve' && Object.keys(x.record).some(q => /^carved/.test(q)))) && F.SELLS.every(item => F.kindOf(item) !== 'carving'),
  'buying everything does not pay: with four stalls and all eight robots a customer pays less than with the saw line alone (sap at $1 takes customers from the $4 and $6 stalls), the bench\'s robot carves what no stall can sell, and the factory ends two hours behind the one that never grew',
  show('full house', (r, b, i) => 'hired ' + r.s.hired + ' $' + last20(r).per.toFixed(2) + ' vs $' + last20(grows['saw line'][i]).per.toFixed(2) + ' $' + (r.s.money - b.s.money).toFixed(0)));

// the books balance: money is what was earned, less what the machines cost and what was bought
const allRuns = runs.concat(hour, pairs.map(p => p.pc), pairs.map(p => p.sh), gbase, [].concat.apply([], Object.values(grows)));
ok(allRuns.every(r => F.cents(r.s.money) === r.s.money && Math.abs(r.s.money - (r.s.earned - r.s.spent - r.bought)) < 1e-6), 'every persona\'s money is what it earned, less the running costs and its purchases (robots, slots and stalls)',
  allRuns.filter(r => F.cents(r.s.money) !== r.s.money || Math.abs(r.s.money - (r.s.earned - r.s.spent - r.bought)) >= 1e-6).map(r => r.kind + ':' + r.s.money).join(' ') || allRuns.length + ' runs');

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
