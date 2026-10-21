#!/usr/bin/env node
/**
 * eval-taas-factory.cjs - the robot factory's pacing and shape (pure node, opt-in, about a minute and a half).
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
 *                  (since robots cost $1, 2026-10-20, it hires only with the stocker's four slots, $50,
 *                  in hand: hiring with $2 it never paid for them behind an operator told nothing)
 *   stock planks   the supervisor, giving the stocker only "only stock medium planks" (a bin
 *                  filling up, as in the CD's third-brief playtest)
 *   operator first hands-on, but its first robot goes on the planer (as in the first builds);
 *                  after two minutes of money falling it moves that robot to stocking (at $1 a robot
 *                  the second is hired within the minute, so it never has to)
 *   alone          hands-on, and never hires: working by hand, measured for ten minutes (at $1 every
 *                  other persona has its first robot 30 s in)
 *   paced          the supervisor, for an hour, but once a stall's worth of medium planks has piled up
 *                  behind a full stall it puts "Wait between tasks" in the operator's next slot
 *                  (buying nothing else until it is in), leaves the slider where it starts, and once a
 *                  minute nudges it a second (until 2026-10-20 it went in the moment the operator was
 *                  hired; at $1 that is 30 s in, before the line runs, and 'paced early', which keeps
 *                  that rule, starves on every seed):
 *                  longer while the bin holds more than a stall's worth and is not falling, shorter
 *                  when it holds fewer than two or a customer waits at an empty stall (the CD's delay,
 *                  2026-10-16). Since logs cost $1 each (the CD, 2026-10-16) this is the optimal
 *                  path: an operator faster than the customers buys logs it never sells. It is set
 *                  beside the supervisor played for the same hour, on seeds 1-12.
 *   goals          from a new factory (only slot 01; the CD's goals, 2026-10-20) the paced line, and
 *                  once the sap extractor arrives a robot for it, the sap logs carried to it and its
 *                  sap kept for a second stall set to sap once the bench arrives; its way out of a line
 *                  that runs out of money is to rest the operator and press by hand (section "the
 *                  goals" below; seeds 1-12, an hour each)
 * Every persona but the goals one starts with all three goals met (slots 02-04 there) and plays at the
 * flat $1 a robot and a stall (taasgoals step 5, 2026-10-20), using the bins' and stalls' bubbles: an
 * output bin is emptied a kind a tap, a stall stocked through Re-stock and set through Re-assign.
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
 *        EVAL_SEEDS=1,2,..., EVAL_GROW_SEEDS=7,8,... and EVAL_GOAL_SEEDS=1,2,... choose the seeds of
 *        the delay's, the growth's and the goals' sections (defaults 1-12, 7-12 and 1-12).
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
const OUTS = ['bin', 'sawOut', 'extractOut', 'benchOut'];
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
  // since the goals (the CD, 2026-10-20) a new factory has only slot 01: every persona but the goals
  // one starts with all three goals met, so slots 02-04 are there as they were before (taasgoals step 5)
  const goals = kind === 'goals';
  if (!goals) s.goal = C.goals.length;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastNet = 0, page = null, bought = 0, swap = false;
  const perMin = [], junkMin = [], waitMin = [], satMin = [];
  let waitSum = 0, waitN = 0;
  const resetAt = {};
  const plankMin = [], waits = [];
  let paceAsk = false, paceTo = null, lookAt = 0, lastPlanks = 0;
  let growing = false, next = 0, hireAs = null;
  let goalT = s.goalT, resets = 0, starts = 0;
  // the goals persona's way out of a line that has run out of money (a sensible player, assumed): it
  // rests the operator and presses the planer itself, never wrong, until the operator's next slot is
  // paid for, then puts it back
  let rescue = null, bench = null, rescues = 0, emptyIt = false;
  const growBought = { stalls: 0, robots: 0, slots: 0 };
  const servedMin = [], earnedMin = [], moneyMin = [];
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = (k, id) => s.avatar.task && s.avatar.task.kind === k && (id === undefined || s.avatar.task.id === id || s.avatar.task.i === id) && (s.avatar.path.length || s.avatar.act);
  const want = (k, id) => { if (!busyWith(k, id)) F.tap(s, k === 'stall' ? { kind: k, i: id || 0 } : id === undefined ? { kind: k } : { kind: k, id }); };
  const paced = kind === 'paced' || kind === 'paced early' || goals;
  const instructs = ['paced', 'paced early', 'goals', 'hands-on', 'supervisor', 'crossed', 'stocker only', 'stock planks', 'operator first'].indexOf(kind) >= 0;
  const handsOn0 = kind === 'hands-on' || kind === 'operator first' || kind === 'alone';
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
  const slotFor = r => r.rules.indexOf(null) >= 0 || (F.slotPrice(s, r.id) !== null && s.money >= F.slotPrice(s, r.id));
  // a paced persona that has seen planks pile up keeps its money for the delay: no other instruction is
  // bought until the delay is in
  let pile = false;
  const afford = r => slotFor(r) && !(pile && mark.paced === undefined);
  const room = (i) => C.stallCap - s.stalls[i || 0].stock.length;   // the one-line personas' stall is the first
  // what a hauling persona does with a thing in its arms: a stall that sells it, the bin that uses it, or the recycle bin
  const H = G && G.haul || {};
  const sellAt = item => s.stalls.findIndex((st, i) => st.bought && st.want === item && room(i) > 0);
  const sold = item => s.stalls.some(st => st.bought && st.want === item);
  const sawRoom = () => s.saw.in.length + s.saw.out.length < C.stallCap;   // feed the saw only what its stall can use
  const dest = item => item === H.saw ? (sawRoom() ? 'sawIn' : null) : H.extract && F.kindOf(item) === 'sappy' ? 'extractIn' : H.extract && F.kindOf(item) === 'log' ? 'rack'
    : H.bench && (F.kindOf(item) === 'gnarled' || F.kindOf(item) === 'rough') ? 'benchIn' : null;
  const keep = item => sold(item) || item === H.saw || !!dest(item);   // what a hauling persona never recycles
  // what a hauling persona takes out of an output bin: the plank it feeds the saw, the clean logs the
  // extractor gives back (since 2026-10-20 a bin's bubble lets it leave the rest for the robots)
  const takes = item => item === H.saw || (H.extract && F.kindOf(item) === 'log');
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
    if (G && !growing && (G.start ? G.start(s) : mark.op4 !== undefined && mark.stock4 !== undefined)) { growing = true; at('grow'); }
    // the goals (the CD, 2026-10-20): when each is met, and how often goal 2's countdown started over
    for (let n = 1; n <= s.goal; n++) at('goal' + n);
    if (s.goal === 1 && C.goals[1].sec) {
      if (goalT < C.goals[1].sec && s.goalT === C.goals[1].sec) resets++;
      if (goalT === C.goals[1].sec && s.goalT < C.goals[1].sec) starts++;
    }
    goalT = s.goalT;
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
      if (paceAsk && r.job === 'operate' && r.rules.indexOf('delay') < 0 && slotFor(r)) { if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id); F.setRule(s, r.id, r.rules.indexOf(null), 'delay'); }
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
      if (bub.kind === 'robot') {
        if (swap) { F.choose(s, 'job:stock:0'); swap = false; at('swapped'); }
        else if (bench !== null) { F.choose(s, bench === 'rest' ? 'job:rest' : 'job:operate'); if (bench === 'rest') rescues++; else rescue = null; bench = null; }
        else F.choose(s, 'notes');
        continue;
      }
      // a stall (since 2026-10-20 nothing happens on arrival: Re-assign, Re-stock or Close): an empty
      // place bought, or what it sells set, when that is the growth plan's next step; then Re-stock,
      // with what it sells out of your arms, up to its room
      if (bub.kind === 'stall') {
        const st = s.stalls[bub.i], g = growing && G.steps[next];
        if (!st.bought) { if (g && g.buy === bub.i) F.choose(s, 'buystall'); s.bubble = null; continue; }
        if (g && g.sell === bub.i) { F.choose(s, 'assign'); F.choose(s, 'sell:' + g.item); }
        if (st.want && count(a.inv, st.want) && room(bub.i) > 0) { F.choose(s, 'restock'); F.choose(s, 'put:' + st.want); }
        s.bubble = null; continue;
      }
      if (F.ACCEPTS[bub.kind]) {
        let o;
        // a hauling persona puts in what this bin is for
        if (growing) while ((o = F.options(s).find(x => x.group === 'put' && dest(x.item) === bub.kind))) F.choose(s, o.id);
        // an output bin: a hauling persona takes out only what it carries somewhere; anyone else
        // empties it into its arms, as a tap did before 2026-10-20 (what it cannot sell then goes in
        // the recycle bin), a kind a tap
        if (OUTS.indexOf(bub.kind) >= 0) while ((o = F.options(s).find(x => x.group === 'take' && (!(growing && G.haul) || emptyIt || takes(x.item))))) F.choose(s, o.id);
        emptyIt = false;
        s.bubble = null; continue;
      }
      s.bubble = null;
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const handsOn = handsOn0 || rescue !== null;
    const late = handsOn || s.hired < 2 ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    // since 2026-10-20 the wrong thing jams slots 02-04 too: whoever cleans the planer cleans those (a tap scrubs it)
    const jamAt = ['extract', 'bench', 'saw'].find(k => F.jammed(s, k));
    if (jamAt) { want(jamAt); continue; }
    const hp = F.hirePrice(s);
    // (the stocker-only persona hires only with its stocker's four slots in hand, $50: at $1 its robots
    // would be on staff 30 s in with $2, and an operator told nothing then runs the money below zero
    // before the stocker's $15 and $20 slots are paid for, 2026-10-20)
    if (hp !== null && s.money >= hp + (kind === 'stocker only' ? 50 : 0) && s.hired < 2 && kind !== 'alone') { want('dock'); continue; }
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
      } else if (g.goal !== undefined) {   // wait for a goal to be met
        if (s.goal >= g.goal) next++;
      } else if (g.hire) {
        if (s.robots.some(r => r.job === g.hire)) next++;
        else if (hp !== null && s.money >= hp + keep) { hireAs = g.hire; want('dock'); continue; }
      }
    }
    // the way out of an operator hired first: once money has fallen two minutes running, move it to stocking
    if (kind === 'operator first' && s.hired === 1 && op && perMin.length >= 3 && perMin.slice(-2).every(v => v < 0)) { swap = true; want('robot', op.id); continue; }
    // the goals persona: money below zero two minutes running and the operator short of an instruction
    // it cannot pay for: rest it and press by hand; back on once the slot is paid for, with $5 over
    if (goals && op && rescue === null && moneyMin.length >= 2 && moneyMin.slice(-2).every(v => v < 0) && s.money < 0 && nextFor(op) && !slotFor(op)) { rescue = op.id; bench = 'rest'; want('robot', op.id); continue; }
    if (goals && rescue !== null && s.money >= (F.slotPrice(s, rescue) || 0) + 5) { bench = 'operate'; want('robot', rescue); continue; }
    // the paced supervisor: the delay goes in once planks pile up behind a full stall, then the slider is tuned by the bin
    // (at $1 a robot, 2026-10-20, the operator is on staff 30 s in with $2 in hand, and a 5 s wait put in
    // then starves the line for good: the delay waits for what it cures, a stall's worth piled up
    // behind a full stall)
    // ('paced early' keeps the rule from before 2026-10-20: the delay the moment the operator is hired)
    if (paced && op && mark.paced === undefined && (kind === 'paced early' || count(s.bin, WANT) >= C.stallCap && room() === 0)) pile = true;
    if (paced && op && mark.paced === undefined && pile && slotFor(op)) { paceAsk = true; want('robot', op.id); continue; }
    if (paced && op && mark.paced !== undefined && fixedWait === undefined && s.t >= lookAt) {
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
      // nothing to carry: a supervisor stands by (below); one working by hand carries on by hand
    }
    if (!handsOn && s.hired >= 2) continue;   // supervisors only clean, hire and instruct
    // your arms: medium planks to the counter, anything else to the recycle bin
    if (count(a.inv, WANT) && room() > 0) { want('stall'); continue; }
    if (a.inv.some(k => k !== WANT)) { want('recycle'); continue; }
    // the output bin: always yours until there is a stocker; then only when the stall runs low
    const binPlanks = count(s.bin, WANT);
    if (binPlanks && room() > 0 && (!sk || (handsOn && s.stalls[0].stock.length <= 1))) { emptyIt = true; want('bin'); continue; }
    if (!sk && s.bin.length > 3) { emptyIt = true; want('bin'); continue; }   // clear the junk before it buries the planks
    // logs cost money (the CD, 2026-10-16), so a person presses only while fewer than a stall's worth
    // and two of medium planks wait for the counter (assumed player rule)
    const queued = count(s.bin, WANT) + count(a.inv, WANT) + s.stalls[0].stock.length;
    if (!op && F.ready(s) && queued < C.stallCap + 2) { want('machine'); continue; }
  }
  const fmt = k => mark[k] === undefined ? '-' : (mark[k] / 60).toFixed(1) + 'm';
  const last5 = perMin.slice(-5).reduce((x, y) => x + y, 0) / 5;
  return { kind, s, mark, fmt, resets, starts, rescues, satLow, perMin, last5, junkMin, waitMin, satMin, resetAt, bought, plankMin, waits, growBought, servedMin, earnedMin, moneyMin, G };
}

const DEBUG = process.env.EVAL_DEBUG;
const runs = ['hands-on', 'supervisor', 'walks away', 'uninstructed', 'crossed', 'stocker only', 'stock planks', 'operator first'].map(k => persona(k, 60, 7));
const hour = [persona('paced', 60, 7), persona('supervisor', 60, 7)];
// a person who never hires (taasgoals step 5): at $1 a robot (the CD, 2026-10-20) every other persona has
// its first robot 30 s in, so working alone is measured here
const al = persona('alone', 10, 7);
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

// restated 2026-10-20 (taasgoals step 5): robots cost a flat $1, so the first comes with the first plank
// sold, not with the first $20, and the $20 is measured on the person who never hires
ok(al.mark['$20'] < 150 && ho.mark['robot 1'] < 60, 'by hand the first $20 (seven planks carried to the counter and bought, less their logs) comes inside two and a half minutes, and the first robot, at $1, inside a minute',
  al.fmt('$20') + ' by hand; robot 1 at ' + ho.fmt('robot 1'));
ok(ho.mark['robot 2'] < 60, 'both robots are on staff inside a minute of attentive play at $1 each (inside nine minutes at $20 and $40)', ho.fmt('robot 2'));
const PC = hour[0];
ok(Math.min.apply(null, al.satMin) >= 80, 'working alone, a person can keep up with the customers: customer satisfaction stays above 80% through ten minutes by hand', al.satMin.map(Math.round).join(','));
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
const pre = al.perMin.slice(1, 3).reduce((x, y) => x + y, 0) / 2;
ok(un.last5 < pre * 1.6, 'uninstructed robots barely beat a person working alone (agents are not free speed)', un.last5.toFixed(1) + ' vs ' + pre.toFixed(1) + ' $/min by hand');
const sp = R['stock planks'];
ok(junkOf(sp.s) >= 30 && looked(sp) > 2 * stocked(sp) && looked(sp) / Math.max(1, stocked(sp)) > 5 * (looked(ho) + 1) / Math.max(1, stocked(ho)), 'a stocker told only to stock medium planks, behind an operator told nothing, hunts a bin filling with everything else; with its whole plan, behind an instructed operator, it hardly looks at all',
  'stock planks: ' + junkOf(sp.s) + ' other things in the bin, stocked ' + stocked(sp) + ' / looking ' + looked(sp) + '; hands-on: stocked ' + stocked(ho) + ' / looking ' + looked(ho));
ok(sp.s.shop.wrong < un.s.shop.wrong / 3 && avg(sp.waitMin, 10) > avg(sup.waitMin, 10) + 1 && sp.s.satisfaction < sup.s.satisfaction - 30 && sp.last5 < sup.last5, 'it sells hardly anything wrong, but hunting through the junk it restocks slowly: customers wait at the stall and customer satisfaction falls anyway, and it earns less than a line whose operator is instructed too',
  'wrong ' + sp.s.shop.wrong + ' vs ' + un.s.shop.wrong + ', waiting ' + avg(sp.waitMin, 10).toFixed(1) + ' vs ' + avg(sup.waitMin, 10).toFixed(1) + ', ' + Math.round(sp.s.satisfaction) + '% vs ' + Math.round(sup.s.satisfaction) + '%, ' + sp.last5.toFixed(1) + ' vs ' + sup.last5.toFixed(1) + ' $/min');

// the order robots are hired in: from the storefront to the stalls (robots at $20, then $40) an operator
// hired first pressed every log for minutes while one person still carried every plank, so money fell,
// and moving it to stocking was the way out (swapped at 5.0 minutes on seed 7, the second robot at 10.4).
// At $1 a robot (the CD, 2026-10-20) the second robot is the next $1, so that stretch never comes: the
// trap is gone at this price (restated 2026-10-20, taasgoals step 5; the Tip still holds where a robot
// costs more than the first sales)
const of = R['operator first'], sw = of.mark.swapped;
ok(sw === undefined && of.mark['robot 2'] < 60 && of.s.satisfaction >= 90 && of.last5 > 0,
  'at $1 a robot hiring the operator first is no trap: the stocker is the next $1, on staff within the minute, so no stretch comes where one robot presses every log while you carry every plank, and the line ends healthy',
  (sw === undefined ? 'never swapped' : 'swapped at ' + of.fmt('swapped')) + '; robot 2 at ' + of.fmt('robot 2') + ', ' + Math.round(of.s.satisfaction) + '%, ' + of.last5.toFixed(1) + ' $/min at the end');

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
// restated 2026-10-20: ten stalls' worth (78-134 planks) became seven (45-143), and a minute may dip by
// three, not two: at $1 the supervisor of seed 9 never pays for its plans, and its untold robots make
// fewer medium planks and pull them unevenly (33 to 30 once)
const climbs = r => tail(r, 1)[0] >= 7 * C.stallCap && tail(r, 20).every((v, k, a) => !k || v >= a[k - 1] - 3) && tail(r, 1)[0] > tail(r, 20)[0] + 2 * C.stallCap;
ok(pairs.every(p => climbs(p.sh)),
  'a line that makes more than it sells fills its output bin with medium planks once the stall is stocked: on every seed the supervisor\'s holds seven stalls\' worth at the hour and is still climbing, each one a log paid for and never sold',
  pairs.map(p => p.sd + ':' + tail(p.sh, 20)[0] + '->' + tail(p.sh, 1)[0]).join(' '));
// restated 2026-10-20: the delay now goes in when the planks pile up (5.7-45.2 minutes in), not at the
// hire, so the window is from ten minutes after it went in, not the last twenty minutes
const settled = r => Math.max.apply(null, r.plankMin.slice(Math.ceil(r.mark.paced / 60) + 10).concat([0]));
ok(pairs.every(p => p.pc.mark.paced !== undefined && settled(p.pc) <= 3 * C.stallCap && tail(p.pc, 1)[0] < tail(p.sh, 1)[0] / 4),
  'told to wait between tasks, and the slider tuned by what piles up, the operator stops it: on every seed the paced hour\'s bin never holds more than three stalls\' worth from ten minutes after the delay went in',
  pairs.map(p => p.sd + ':' + settled(p.pc) + ' (in at ' + p.pc.fmt('paced') + ')').join(' '));
ok(pairs.every(p => p.pc.s.spent < p.sh.s.spent), 'so it buys fewer logs: the paced line spends less on every seed', pairs.map(p => p.sd + ':' + p.pc.s.spent.toFixed(0) + '/' + p.sh.s.spent.toFixed(0)).join(' '));
const pays = pairs.filter(p => p.pc.s.money - p.sh.s.money > C.slots[C.slots.length - 1]), poorer = pairs.filter(p => pays.indexOf(p) < 0);
ok(pays.length === pairs.length,
  'and it pays on every seed (more money at the hour than the slot it took cost; on 10 of 12 when the delay went in at the hire)',
  'pays on ' + pays.length + '/' + pairs.length + '; not on ' + (poorer.map(p => p.sd + ' (lowest ' + Math.round(lowAfter(p.pc)) + '%)').join(', ') || 'none'));
// restated 2026-10-20: the 5 s start starved 3 of 12 seeds when the delay went in at the hire with $20 and
// $40 robots. At $1 the hire is 30 s in: 'paced early' keeps that rule, and the paced persona waits for the pile
const early = SEEDS.map(sd => persona('paced early', 60, sd));
const starvedEarly = early.filter(r => lowAfter(r) < 50), starved = pairs.filter(p => lowAfter(p.pc) < 50);
ok(most(starvedEarly.length, early.length) && early.every(r => r.s.money < 0) && !starved.length && pairs.every(p => lowAfter(p.pc) >= 75),
  'the 5 s the slider starts at is too long for a line not yet running: put in the moment the operator is hired (30 s in at $1) it leaves customers standing at an empty stall and the line never recovers inside the hour; put in once a stall\'s worth has piled up behind a full stall, customer satisfaction stays above 75% (open question 10)',
  'at the hire: under 50% on ' + starvedEarly.length + '/' + early.length + ', money $' + Math.max.apply(null, early.map(r => r.s.money)).toFixed(0) + ' at best; on the pile: lowest ' + pairs.map(p => p.sd + ':' + Math.round(lowAfter(p.pc)) + '%').join(' '));
const whole = r => r.mark.op4 !== undefined && r.mark.stock4 !== undefined;
ok(most(pairs.filter(p => whole(p.pc)).length, pairs.length),
  'on the optimal path (the delay as soon as planks pile up) both robots hold all four of their useful instructions inside the hour on most seeds (how long it takes, with the delay or without, varies too much from seed to seed to claim more)',
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
// restated 2026-10-20 (taasgoals step 5): at $50-$150 a stall and $20-$160 a robot these cost $660 and two
// to four hours to pay back; at $1 each ($7 in all, the slots apart) they are ahead within two hours
ok(each('all medium', (r, b, i) => r.mark.grown !== undefined && last20(r).per > last20(grows['saw line'][i]).per + 0.25 && last20(r).net > last20(grows['saw line'][i]).net && r.s.money > b.s.money),
  'four stalls, three of them medium 2x4s, earn the most a minute of any factory here, and at $1 a stall and a robot they are ahead of the line that never grew within two hours on every seed',
  show('all medium', (r, b) => '$' + last20(r).per.toFixed(2) + ' ' + last20(r).net.toFixed(1) + '/min $' + (r.s.money - b.s.money).toFixed(0)));
ok(each('cut stall', r => r.mark.grown !== undefined && r.s.satisfaction <= 20 && last20(r).wait >= 4),
  'switching the one stall to 2x4s starves it: every customer now wants a thing its robot fetches one at a time from the saw\'s output bin, about ten metres there and back, and one robot cannot keep up with every customer',
  show('cut stall', r => Math.round(r.s.satisfaction) + '% ' + last20(r).wait.toFixed(1) + ' waiting'));
// restated 2026-10-20: 5.0-5.6 waiting and 10-13% became 3.9-5.6 and 10-25% (seed 11)
ok(each('large planks', (r, b) => r.mark.grown !== undefined && last20(r).served < last20(b).served && last20(r).wait >= 3.5 && r.s.satisfaction <= 30 && r.s.money < b.s.money),
  'a stall whose thing is scarce takes the shop with it: large planks come from about one log in nine, half the customers come for them, and they fill the shop and wait while fewer of the others get in, which takes customer satisfaction to 30% or under',
  show('large planks', (r, b) => last20(r).served + '/' + last20(b).served + ' served, ' + last20(r).wait.toFixed(1) + ' waiting, ' + Math.round(r.s.satisfaction) + '%'));
// restated 2026-10-20: at $50 a stall and $100 its robot the stall set first locked the shop for good (none
// served, six waiting, the robot never affordable); at $1 its robot is hired straight after, so the shop
// is never locked and it ends as the second stall does
ok(each('set first', (r, b) => r.s.hired === 3 && last20(r).wait < 1 && last20(r).served >= 0.9 * last20(b).served && r.s.money < b.s.money),
  'a stall set to sell before anyone is there to stock it no longer locks the shop at $1: its robot is the next $1, so its customers are served, and like any second stall of medium planks it never pays its way',
  show('set first', r => last20(r).served + ' served, ' + last20(r).wait.toFixed(1) + ' waiting, hired ' + r.s.hired));
const allIn = grew.filter(i => grows['full house'][i].mark.grown !== undefined);
ok(allIn.length >= Math.ceil(2 * grew.length / 3) && allIn.every(i => grows['full house'][i].s.hired === C.names.length && grows['full house'][i].s.stalls.every(st => st.bought && st.want))
  && each('full house', (r, b, i) => r.s.money > b.s.money && r.s.money < grows['all medium'][i].s.money && last20(r).per < last20(grows['saw line'][i]).per)
  && allIn.every(i => grows['full house'][i].s.robots.some(x => x.job === 'carve' && Object.keys(x.record).some(q => /^carved/.test(q)))) && F.SELLS.every(item => F.kindOf(item) !== 'carving'),
  'buying everything pays at $1 a stall and a robot, but less than buying what sells: with four stalls and all eight robots a customer pays less than with the saw line alone (sap at $1 takes customers from the $4 and $6 stalls), the bench\'s robot carves what no stall can sell, and the factory ends two hours ahead of the one that never grew but behind the four stalls of 2x4s',
  show('full house', (r, b, i) => 'hired ' + r.s.hired + ' $' + last20(r).per.toFixed(2) + ' vs $' + last20(grows['saw line'][i]).per.toFixed(2) + ' $' + (r.s.money - b.s.money).toFixed(0) + ' (all medium $' + (grows['all medium'][i].s.money - b.s.money).toFixed(0) + ')'));

/* ---------- the goals (the CD, 2026-10-20): from a new factory, through all three, over twelve seeds ---------- */
// The goals persona (taasgoals step 5; an assumed sensible player) starts from newGame() with only slot
// 01 and plays the paced line for goal 1 (sell 50 medium planks) and goal 2 (over $50 and over 90% for
// ten minutes). The moment the sap extractor arrives (goal 1) it hires a robot for it and carries the
// sap logs the operator recycles to it, and the clean logs it gives back to the planer's input bin, so
// sap piles up in the extractor's output bin while goal 2 counts; once the bench arrives (goal 2) it
// buys a second stall, hires its robot and sets it to sap, which the robot fetches from the extractor's
// output bin (goal 3, sell 25 sap; sap sold before goal 3 does not count). Its way out of a line that
// runs out of money is to rest the operator and press the planer itself until the next slot is paid for.
const GOAL_PLAN = { start: s => s.goal >= 1, steps: [{ hire: 'extract' }, { goal: 2 }, { buy: 1 }, { hire: 'stock:1' }, { sell: 1, item: 'sap' }], plans: { 'stock:1': ['only:sap'] }, haul: { extract: true }, reserve: 0 };
const GLSEEDS = process.env.EVAL_GOAL_SEEDS ? process.env.EVAL_GOAL_SEEDS.split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], GLMIN = 60;
const gls = GLSEEDS.map(sd => { const r = persona('goals', GLMIN, sd, undefined, GOAL_PLAN); r.kind = 'goals ' + sd; r.sd = sd; return r; });
const gm = (r, n) => r.mark['goal' + n];
console.log('goals, 1h from a new factory, seed: minutes to goal 1 / 2 / 3, goal 2 countdown started / started over, operator rested (out of money), plans op/stock, money and satisfaction at 1h');
gls.forEach(r => console.log('  ' + String(r.sd).padStart(2) + ': ' + [1, 2, 3].map(n => r.fmt('goal' + n)).join(' / ') + ', ' + r.starts + ' / ' + r.resets + ', ' + r.rescues + ', ' + mins(r) + ', $' + r.s.money.toFixed(0) + ' ' + Math.round(r.s.satisfaction) + '%'));
const reached = n => gls.filter(r => gm(r, n) !== undefined);
const span = n => { const v = reached(n).map(r => gm(r, n) / 60); return v.length ? Math.min.apply(null, v).toFixed(1) + '-' + Math.max.apply(null, v).toFixed(1) + ' min' : 'never'; };
ok([1, 2, 3].every(n => most(reached(n).length, gls.length)),
  'from a new factory every goal is reached inside the hour on most seeds: fifty medium planks bring the sap extractor, ten minutes over $50 and 90% the bench, and twenty-five sap the table saw',
  [1, 2, 3].map(n => 'goal ' + n + ' on ' + reached(n).length + '/' + gls.length + ' (' + span(n) + ')').join(', '));
const resetOn = gls.filter(r => r.resets > 0);
ok(resetOn.length >= 1 && gls.every(r => gm(r, 1) === undefined || gm(r, 2) !== undefined || r.starts === 0),
  'goal 2\'s countdown starts over in real play (customer satisfaction dips to 90% or money to $50 while it counts) and still completes: no seed is left with a countdown that started and never finished',
  'started over on ' + resetOn.length + '/' + gls.length + ' seeds (' + gls.map(r => r.sd + ':' + r.resets).join(' ') + ')');
// nothing dead-ends: every goal of things sold asks for a thing a stall can sell, made by a machine that
// is there before that goal begins; goal 2 asks for no more than the wall can show; and in play no seed
// is left stuck short of the last goal
const maker = item => F.kindOf(item) === 'plank' ? null : F.kindOf(item) === 'sap' ? 'extract' : F.CUTS.indexOf(F.kindOf(item)) >= 0 ? 'saw' : 'none';
const earlier = (job, i) => job === null || C.goals.findIndex(g => g.unlocks === job) < i;
const bad = C.goals.map((g, i) => g.item ? (F.SELLS.indexOf(g.item) >= 0 && earlier(maker(g.item), i) ? null : g.id) : (g.sat < 100 && g.sec > 0 ? null : g.id)).filter(Boolean);
const unlocksAll = F.SLOT_JOBS.every(j => C.goals.some(g => g.unlocks === j));
ok(!bad.length && unlocksAll && gls.every(r => r.s.goal === C.goals.length),
  'nothing dead-ends: every goal of things sold asks for a thing a stall can sell, made by a machine that is there before the goal begins, every slot\'s machine is some goal\'s reward, and on every seed the goals persona gets past the last goal (its way out, resting the operator and pressing by hand when the money runs out, used on some)',
  (bad.length ? 'NO WAY: ' + bad.join(', ') + '; ' : '') + (unlocksAll ? '' : 'a slot no goal unlocks; ') + gls.map(r => r.sd + ':' + r.s.goal + (r.rescues ? ' (rested ' + r.rescues + ')' : '')).join(' '));

// the books balance: money is what was earned, less what the machines cost and what was bought
const allRuns = runs.concat(hour, [al], pairs.map(p => p.pc), pairs.map(p => p.sh), early, gbase, [].concat.apply([], Object.values(grows)), gls);
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
