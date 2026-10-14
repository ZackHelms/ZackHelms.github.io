#!/usr/bin/env node
/**
 * drive-taas-factory.cjs — rules gate for TAAS's robot factory mode (pure node, ~3 s).
 *
 * The factory keeps its whole simulation in one DOM-free block in games/taas/index.html
 * (`const FACTORY = (function () { ... })()`), so the rules are checked here against that
 * block, lifted out of the page, with no browser: the floor and its paths, the manual loop
 * the CD described (tap the button, the avatar walks over and presses, four seconds, a plank
 * in the bin, sell it for $5) and the logs you toss yourself, hiring at $20 and $40, the two
 * jobs, every mistake a robot can make and what it does, the robots' instructions (the CD's
 * six, each robot's own slots at $5-$25, the list that grows with the mistakes seen, each
 * instruction preventing its mistake, the 1-in-20 slip, an instruction about another job doing
 * nothing), the rates as MEASURED over real play, customer satisfaction and prices, and saving.
 * Numbers come from FACTORY.CFG, so a retune never turns this red.
 * The page around the engine is drive-taas-factory-ui.cjs.
 *
 * Usage:
 *   node .claude/tests/drive-taas-factory.cjs
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas-factory.cjs   # negtest-copies
 *
 * Final line: TAAS-FACTORY: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined && detail !== '' ? ' (' + detail + ')' : '')); }
}
function lift(page) {
  const src = fs.readFileSync(page, 'utf8');
  const a = src.indexOf('const FACTORY = (function');
  const end = "if (typeof module !== 'undefined') module.exports = FACTORY;";
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('factory engine block not found in ' + page);
  return new Function(src.slice(a, b) + '\nreturn FACTORY;')();
}
let F;
try { F = lift(PAGE); } catch (e) { console.log('FAIL engine loads (' + e.message + ')'); console.log('TAAS-FACTORY: RED'); process.exit(1); }
const C = F.CFG, L = F.LAYOUT, SP = L.SPOT, U = C.uninstructed;

const run = (s, sec, dt) => { const h = dt || 0.05; for (let t = 0; t < sec - 1e-9; t += h) F.step(s, h); return s; };
const until = (s, pred, max) => { for (let t = 0; t < (max || 60); t += 0.05) { if (pred(s)) return true; F.step(s, 0.05); } return pred(s); };
const take = (s, kind) => s.events.filter(x => x.kind === kind);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const many = (v, n) => Array(n || 60).fill(v);
// the dice, made quiet: good logs, no sap, no thinking (each queue is what the next rolls of that name come up)
const calm = () => ({ log: many('log'), sap: many(false), think: many(false) });
function onFree(s, pts) { return pts.every(p => F.free(s, p.x, p.y)); }
// geometry, not the pathing grid: a walked segment keeps 0.1 m clear of every solid footprint
function segFree(s, from, pts) {
  const rs = F.rects(s), m = 0.1;
  let a = from;
  for (const b of pts) {
    const n = Math.ceil(dist(a, b) / 0.02);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (rs.some(q => x > q[0] - m && x < q[2] + m && y > q[1] - m && y < q[3] + m)) return false;
    }
    a = b;
  }
  return true;
}
// a run that already has both robots, by the real route: earn it, walk to the dock, hire, assign
function staffed(seed, jobs, force) {
  const s = F.newGame(seed || 1);
  if (force) Object.keys(force).forEach(k => { s.force[k] = (s.force[k] || []).concat(force[k]); });
  s.money = C.hire[0] + C.hire[1];
  (jobs || ['operate', 'sell']).forEach(job => {
    F.tap(s, { kind: 'dock' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'dock', 30);
    F.choose(s, 'hire'); if (job) F.choose(s, 'job:' + job);
  });
  return s;
}
// give robot id these instructions the way a player would: each one seen, a slot bought, then set
function instruct(s, id, rules) {
  rules.forEach(rule => {
    s.seen[rule] = true;
    if (s.robots[id].rules.indexOf(null) < 0) { s.money += F.slotPrice(s, id); F.buySlot(s, id); }
    F.setRule(s, id, s.robots[id].rules.indexOf(null), rule);
  });
  s.events = [];
  return s;
}
const RULE_TEXT = {
  sap: 'Never put sap on input log', gnarled: 'Put gnarled logs in recycle bin', small: 'Only input logs bigger than 1"x4"x4\'',
  output: 'Only output 1"x4"x4\' wood planks', sellOnly: 'Only sell 1"x4"x4\' wood planks', price: 'Sell 1"x4"x4\' wood planks for $5'
};

/* ---------- 1. the tables ---------- */
{
  ok(C.hire.length === 2 && C.hire[0] === 20 && C.hire[1] === 40, 'two robots, at $20 and $40 (the CD\'s numbers)', C.hire.join());
  ok(C.processSec === 4 && C.price.plank === 5, 'a plank takes 4 s and sells for $5 (the CD\'s numbers)');
  ok(C.price.dowels <= 1 && C.price.rough < C.price.plank && C.mislabel === C.price.plank && C.cheapPlank < C.price.plank, 'dowels sell for $1 at most, a rough plank for less than a plank; passed off as a plank they ask a plank\'s price');
  ok(JSON.stringify(C.slots) === '[5,10,15,20,25]' && C.slots.reduce((a, b) => a + b, 0) * C.hire.length === 150, 'instruction slots cost $5 / $10 / $15 / $20 / $25 for each robot: $150 for all five on both (the CD\'s numbers)', C.slots.join());
  ok(F.RULES.length === 6 && F.RULES.every(q => RULE_TEXT[q.id] === q.text), 'the instruction pool is the CD\'s six, word for word', F.RULES.map(q => q.text).join(' | '));
  ok(F.RULES.filter(q => q.job === 'operate').map(q => q.id).join() === 'sap,gnarled,small,output' && F.RULES.filter(q => q.job === 'sell').map(q => q.id).join() === 'sellOnly,price', 'four are about running machine 01, two about selling');
  ok(F.BASE.operate === 'Use machine01 to refine raw materials.' && F.BASE.sell === 'Sell the items in this bin.', 'the base prompts are the CD\'s: "use machine01 to refine raw materials" and "sell the items in this bin"');
  ok(C.slip > 0 && C.slip <= 0.1 && C.names.length >= C.hire.length && new Set(C.names).size === C.names.length, 'a robot slips on an instruction rarely (' + C.slip + '), and the robots start with names of their own');
  const L0 = C.logs.gnarled + C.logs.small;
  ok(L0 > 0 && L0 < 0.7 && Object.keys(U).every(k => U[k] > 0 && U[k] < 1), 'some logs off the rack are gnarled or small, most are good; every uninstructed mistake is a chance, not a certainty');
}

/* ---------- 2. the floor ---------- */
{
  const s = F.newGame();
  const spots = ['start', 'press', 'operate', 'sap', 'sell', 'bin', 'dock'].map(k => Object.assign({ k }, SP[k]));
  ok(onFree(s, spots), 'every spot stands on free floor', spots.filter(p => !F.free(s, p.x, p.y)).map(p => p.k).join());
  const bad = [];
  spots.forEach(a => spots.forEach(b => {
    if (a === b) return;
    const p = F.path(s, a, b);
    if (!p.length && dist(a, b) > 1e-6) bad.push(a.k + '>' + b.k + ' none');
    else if (p.length && (dist(p[p.length - 1], b) > 0.15 || !segFree(s, a, p))) bad.push(a.k + '>' + b.k);
  }));
  ok(!bad.length, 'every spot can walk to every other without crossing anything solid', bad.slice(0, 6).join(', '));
  const R = L.SOLID.recycle, mid = { x: (R[0] + R[2]) / 2, y: (R[1] + R[3]) / 2 };
  ok(R && !F.free(s, mid.x, mid.y) && dist(L.RECYCLE, mid) < 0.1 && dist(SP.sell, mid) < 1 && dist(SP.press, mid) < 1.3, 'the recycle bin stands on the floor in front of the out-feed, within reach of the button and the seller');
  ok(!L.SOLID.desk && !SP.terminal && F.free(s, 4.4, 7.9), 'the prompt lab\'s desk is gone, and its floor is open');
  const inside = F.path(s, SP.start, { x: 2.8, y: 2.9 });   // the middle of machine 01
  const end = inside[inside.length - 1];
  ok(inside.length > 0 && F.free(s, end.x, end.y) && dist(end, { x: 2.8, y: 2.9 }) < 1.3 && segFree(s, SP.start, inside), 'a tap on a solid thing walks to the nearest free floor beside it', end ? end.x.toFixed(2) + ',' + end.y.toFixed(2) : 'no path');
  const behind = F.path(s, SP.start, { x: 3.0, y: 1.2 });   // the strip behind the line, closed at both ends
  ok(behind.length > 0 && behind[behind.length - 1].y > 3.3 && segFree(s, SP.start, behind), 'a tap on floor nobody can reach walks to the nearest floor that can be reached', behind.length ? behind[behind.length - 1].y.toFixed(2) : 'no path');
  const c = L.CRATES[0], cm = { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 };
  const t = staffed(1, [null]);
  ok(!F.free(s, cm.x, cm.y) && F.free(t, cm.x, cm.y), 'a robot\'s crate blocks the floor until it is hired and unpacked');
}

/* ---------- 3. the manual loop the CD described, and the logs you toss ---------- */
{
  const s = F.newGame();
  s.force.log = many('log');
  ok(s.money === 0 && s.satisfaction === 100 && F.ready(s) && s.machine.log === 'log' && !s.robots.length && !s.bin.length && !F.known(s).length,
    'a new factory: $0, customer satisfaction at 100%, a good log on machine 01, no robots, no instructions');
  F.tap(s, { kind: 'machine' });
  const walked = s.avatar.path.length > 0;
  until(s, x => x.machine.phase === 'run', 10);
  const atBtn = dist(s.avatar, SP.press) < 0.05;
  const pressT = s.t;
  let dark = true;
  while (s.machine.phase === 'run') { F.step(s, 0.05); if (F.ready(s)) dark = false; }
  const took = s.t - pressT;
  ok(walked && atBtn && Math.abs(took - C.processSec) < 0.06 && dark, 'tapping the button from afar walks the avatar over, it presses, and the machine runs ' + C.processSec + ' s with the button out of action', [walked, atBtn, took.toFixed(2)].join());
  ok(!F.ready(s) && s.machine.staged < 0.2, 'right after a cut the button stays dark while the next log rolls in', s.machine.staged.toFixed(2));
  const r0 = s.t; until(s, x => F.ready(x), 5);
  ok(Math.abs(s.t - r0 - C.stageSec) < 0.12, 'and lights after ' + C.stageSec + ' s', (s.t - r0).toFixed(2));
  const made = take(s, 'made');
  until(s, x => x.bin.length > 0, 5);
  ok(made.length === 1 && made[0].item === 'plank' && s.bin.join() === 'plank' && Math.abs(s.t - pressT - C.processSec - C.outSec - C.dropSec) < 0.1,
    'one smooth plank rides the out-feed belt and drops into the bin', s.bin.join() + ' at +' + (s.t - pressT).toFixed(2));

  s.events = [];
  s.avatar.x = SP.press.x + 0.4;   // near the button, not on its spot
  F.tap(s, { kind: 'machine' });
  ok(!s.avatar.path.length && s.avatar.act && s.avatar.act.kind === 'press' && s.avatar.x === SP.press.x + 0.4, 'tapping the button from close by presses without a walk');
  until(s, x => x.machine.phase === 'run', 2);
  F.tap(s, { kind: 'machine' }); run(s, 1);
  ok(take(s, 'press').length === 1, 'tapping it again while it runs does nothing (no second press, nothing queued)', take(s, 'press').length);

  until(s, x => x.machine.phase === 'ready' && x.bin.length === 2, 8);
  F.tap(s, { kind: 'bin' });
  const early = F.options(s).length;
  until(s, x => !!F.bubbleOpen(x), 10);
  const o = F.options(s);
  ok(early === 0 && o.length === 1 && o[0].id === 'sell:plank' && o[0].enabled && o[0].price === 5, 'at the bin, and only once there, the bubble offers one thing: sell a plank for $5', JSON.stringify(o));
  F.choose(s, 'sell:plank');
  ok(s.money === 5 && s.bin.length === 1, 'one tap sells exactly one plank: $0 to $5', s.money + ' / ' + s.bin.length);
  F.choose(s, 'sell:plank');
  const empty = F.options(s)[0];
  const before = JSON.stringify([s.money, s.bin, s.satisfaction]);
  ok(empty && !empty.enabled && !F.choose(s, 'sell:plank') && before === JSON.stringify([s.money, s.bin, s.satisfaction]), 'with the bin empty the bill is greyed and a tap on it changes nothing');
  F.tap(s, { kind: 'floor', x: 3, y: 9 }); F.step(s, 0.05);
  const walking = !F.bubbleOpen(s) && !F.options(s).length;
  until(s, x => !x.avatar.path.length, 10);
  ok(walking && !F.bubbleOpen(s) && !F.options(s).length, 'walking away closes the bubble, and it stays closed on arrival somewhere else');
  for (let i = 0; i < 2; i++) { F.tap(s, { kind: 'machine' }); until(s, x => x.machine.phase === 'ready' && x.machine.staged >= 1 && !x.belt.length && take(x, 'binned').length >= 3 + i, 20); }
  F.tap(s, { kind: 'bin' }); until(s, x => !!F.bubbleOpen(x), 10);
  while (F.choose(s, 'sell:plank'));
  ok(s.money === 20 && s.tally.player.sold === 4, 'four planks sold by hand is $20', s.money);

  // you never get it wrong: a gnarled or a small log goes in the recycle bin, and you press the next good one
  const g = F.newGame(); g.force.log = ['small', 'log'];
  g.machine.log = 'gnarled';
  F.tap(g, { kind: 'machine' });
  until(g, x => x.machine.phase === 'run', 20);
  const rec = take(g, 'recycled');
  ok(rec.length === 2 && rec[0].item === 'gnarled' && rec[1].item === 'small' && rec.every(e => e.by === 'player' && e.from === 'in') && g.machine.log === 'log' && g.machine.by === 'player' && g.tally.player.tossed === 2,
    'tapping the button with a gnarled log on the belt: you toss it in the recycle bin, then the small one after it, and press on the good log', rec.map(e => e.item).join());
  until(g, x => x.bin.length > 0, 10);
  ok(g.bin.join() === 'plank' && g.recycled.join() === 'gnarled,small' && g.recycledN === 2 && !F.known(g).length, 'so your plank is a plank, the two bad logs are in the recycle bin, and no instruction joins the list (you made no mistake)');
  const sp = F.newGame(); sp.force.log = ['log']; sp.machine.sap = true;
  F.tap(sp, { kind: 'machine' }); until(sp, x => x.machine.phase === 'run', 20); run(sp, 2);
  ok(take(sp, 'recycled').length === 1 && sp.machine.phase === 'run' && !take(sp, 'jam').length, 'a log with sap on it goes in the recycle bin too: your press never jams the machine');
}

/* ---------- 4. hiring ---------- */
{
  const s = F.newGame();
  s.money = 19;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 20);
  const poor = F.options(s)[0];
  ok(poor.id === 'hire' && !poor.enabled && poor.price === 20 && !F.choose(s, 'hire') && s.money === 19 && !s.robots.length, 'at $19 the dock shows the $20 robot greyed, and refuses');
  s.money = 20;
  ok(F.choose(s, 'hire') && s.money === 0 && s.robots.length === 1 && s.robots[0].state === 'unbox' && s.robots[0].name === C.names[0], 'at $20 a robot is hired, climbs out of its crate, and has a name');
  const after = F.options(s);
  ok(F.bubbleOpen(s).kind === 'robot' && after.map(x => x.id).join() === 'job:operate,job:sell,job:rest,notes', 'the bubble turns straight to the new robot: the button, selling, rest, and its clipboard', after.map(x => x.id).join());
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  ok(F.options(s)[0].price === 40, 'the second robot costs $40', F.options(s)[0].price);
  s.money = 40; F.choose(s, 'hire');
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  const out = F.options(s)[0];
  ok(s.robots.length === 2 && s.robots[1].name === C.names[1] && !out.enabled && out.soldOut && (s.money = 999) && !F.choose(s, 'hire') && s.robots.length === 2, 'after two there are no more to hire, whatever the money');
}

/* ---------- 5. jobs ---------- */
{
  const s = staffed(3, ['operate', null], calm());
  const [op, two] = s.robots;
  until(s, x => dist(op, SP.operate) < 0.07, 20);
  ok(dist(op, SP.operate) < 0.07, 'a robot sent to the button goes and stands at it', op.x.toFixed(2) + ',' + op.y.toFixed(2));
  until(s, x => take(x, 'made').length > 0, 20);
  ok(take(s, 'press')[0].by === op.id && take(s, 'made')[0].by === op.id, 'and runs machine 01 itself');
  s.events = [];
  run(s, 30);
  const presses = take(s, 'press').length, madeN = take(s, 'made').length;
  ok(presses >= 4 && Math.abs(presses - madeN) <= 1, 'one press per cycle: a robot never presses a running machine', presses + ' presses, ' + madeN + ' made');
  F.tap(s, { kind: 'robot', id: two.id }); until(s, x => !!F.bubbleOpen(x), 20);
  F.choose(s, 'job:operate');
  ok(two.job === 'operate' && op.job === null, 'giving a robot a job someone has swaps them (the other gets its old job)', op.job + '/' + two.job);
  until(s, x => op.state === 'idle' && dist(op, SP.rest[op.id]) < 0.07, 30);
  ok(dist(op, SP.rest[op.id]) < 0.07, 'a robot sent to rest goes back to its charging pad');
  const t = staffed(5, [null, 'sell']);
  const seller = t.robots[1];
  until(t, x => dist(seller, SP.sell) < 0.07, 30);
  F.tap(t, { kind: 'robot', id: seller.id }); until(t, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'robot', 20);
  t.bin.push('plank'); t.force.price = ['fair'];
  until(t, x => seller.state === 'pitch', 10);
  const held = seller.carry, bin0 = t.bin.length, money0 = t.money;
  F.choose(t, 'job:rest');
  ok(held === 'plank' && !seller.carry && t.bin.length === bin0 + 1 && t.money === money0, 'a seller taken off the job mid-sale puts the plank back in the bin', held + ' ' + bin0 + '>' + t.bin.length);
}

/* ---------- 6. what each mistake does (no instructions) ---------- */
// one operator at the button, with what is on the in-feed and its dice forced; the robot rolls
// the moment it reaches the button, so the dice are queued before it is hired
function opCycle(log, force, rules) {
  const s = staffed(11, ['operate', null], Object.assign(calm(), force || {}));
  s.machine.log = log || 'log';
  if (rules) instruct(s, 0, rules);
  s.events = [];
  return s;
}
{
  let s = opCycle('log');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'plank' && s.robots[0].tally.good === 1 && s.robots[0].record.plank === 1 && s.robots[0].mood === 'good' && !F.known(s).length, 'a good log, no slip-ups: a smooth plank, a good mark on the robot\'s record, and nothing joins the list');

  s = opCycle('log', { think: [true] });
  until(s, x => dist(x.robots[0], SP.operate) < 0.07, 20);
  const t0 = s.t;
  until(s, x => take(x, 'press').length > 0, 10);
  until(s, x => x.bin.length > 0, 20);
  const pressedAfter = take(s, 'press')[0].t - t0;
  ok(pressedAfter >= C.dawdleSec && s.bin.join() === 'plank' && s.robots[0].tally.soso === 1 && s.robots[0].record.think === 1, 'so-so: it stops and thinks ' + C.dawdleSec + ' s, then a plank', pressedAfter.toFixed(2));
  s = opCycle('log', { think: [true] });
  until(s, x => x.robots[0].state === 'dawdle', 20);
  s.avatar.x = SP.press.x; s.avatar.y = SP.press.y;
  F.tap(s, { kind: 'machine' });
  until(s, x => x.machine.phase === 'run', 2);
  const myRun = s.machine.t;
  until(s, x => x.robots[0].state !== 'dawdle' && x.robots[0].state !== 'press', 6);
  ok(take(s, 'press').length === 1 && s.machine.by === 'player' && s.machine.phase === 'run' && s.machine.t > myRun, 'a robot that presses a machine you already started does nothing to your cut', take(s, 'press').length + ' presses, by ' + s.machine.by);

  s = opCycle('gnarled');
  until(s, x => x.bin.length > 0, 20);
  const rule1 = take(s, 'rule');
  ok(s.bin.join() === 'rough' && s.robots[0].tally.soso === 1 && s.robots[0].record.rough === 1 && rule1.length && rule1[0].id === 'gnarled' && rule1[0].by === 0,
    'with no instruction a gnarled log goes in and a rough plank comes out (so-so), and "' + RULE_TEXT.gnarled + '" joins the list', s.bin.join() + ' / ' + F.known(s).map(q => q.id).join());
  ok(F.known(s).map(q => q.id).join() === 'gnarled,output', 'and once the rough plank lands in the bin, "' + RULE_TEXT.output + '" joins it: those two and no others', F.known(s).map(q => q.id).join());

  s = opCycle('small');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'dowels' && s.robots[0].tally.bad === 1 && s.robots[0].record.dowels === 1 && s.seen.small, 'a small log goes in and dowel rods come out (bad), and its instruction joins the list', s.bin.join());

  s = opCycle('log', { sap: [true] });
  const fetched = until(s, x => x.robots[0].carry === 'sap', 10);
  until(s, x => x.machine.phase === 'jam', 10);
  run(s, 60);
  ok(fetched && s.machine.phase === 'jam' && !s.bin.length && !take(s, 'made').length && s.robots[0].tally.bad === 1 && s.robots[0].record.sap === 1 && F.known(s).map(q => q.id).join() === 'sap',
    'sap: it fetches sap, pours it on the log, the machine gums up and stays jammed (60 s later no robot has fixed it), and "' + RULE_TEXT.sap + '" joins the list', s.machine.phase);
  ok(s.robots[0].mood === 'stuck' && s.robots[0].state === 'idle', 'and the operator just stands there, stuck');
  F.tap(s, { kind: 'machine' });
  until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c0 = s.t;
  until(s, x => x.machine.phase !== 'jam', 10);
  ok(s.machine.phase === 'ready' && Math.abs(s.t - c0 - C.cleanSec) < 0.11 && take(s, 'cleaned').length === 1 && !s.machine.sap, 'tapping the machine walks you over to scrub it clean, which takes ' + C.cleanSec + ' s', (s.t - c0).toFixed(2));
  s = opCycle('log', { sap: [true] }); until(s, x => x.machine.phase === 'jam', 20);
  F.tap(s, { kind: 'machine' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  run(s, C.cleanSec / 2);
  F.tap(s, { kind: 'floor', x: 3, y: 6 }); run(s, 2);
  const half = s.machine.dirt;
  F.tap(s, { kind: 'machine' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c1 = s.t; until(s, x => x.machine.phase !== 'jam', 10);
  ok(half > 0.3 && half < 0.7 && s.t - c1 < C.cleanSec * 0.65, 'walking away mid-scrub keeps the half already done', half.toFixed(2));
  s = staffed(11, ['operate', null], calm());
  s.machine.log = 'gnarled'; s.seen.gnarled = true; s.seen.output = true; s.events = [];
  until(s, x => x.bin.length > 0, 20);
  ok(!take(s, 'rule').length && s.bin.join() === 'rough', 'a mistake adds its instruction to the list once: seen again, nothing new joins');
}
function sale(item, force, sat, rules) {
  // satisfaction heals a little every second, so a row that sets it holds it there until the sale
  const s = staffed(13, [null, 'sell']);
  if (rules) instruct(s, 1, rules);
  if (sat !== undefined) s.satisfaction = sat;
  until(s, x => x.robots[1].state === 'idle' && dist(x.robots[1], SP.sell) < 0.07, 20);
  s.events = []; s.bin.push(item);
  Object.keys(force || {}).forEach(k => { s.force[k] = force[k].slice(); });
  const m0 = s.money, t0 = sat !== undefined ? sat : s.satisfaction;
  let satAt = s.satisfaction;
  until(s, x => { if (sat !== undefined && !take(x, 'sold').length) { x.satisfaction = sat; } satAt = x.satisfaction; return take(x, 'sold').length > 0 || take(x, 'recycled').length > 0; }, 10);
  run(s, 0.05);
  const e = take(s, 'sold')[0] || null;
  if (e) e.satAt = sat !== undefined ? sat : satAt;
  return { paid: s.money - m0, dt: s.satisfaction - t0, e, s, rec: take(s, 'recycled')[0] || null };
}
{
  let r = sale('plank', { price: ['fair'] });
  ok(r.paid === 5 && r.e.sale === 'fair' && !r.s.seen.price, 'a plank sold for its price ($5)', r.paid);
  r = sale('plank', { price: ['cheap'] });
  ok(r.paid === C.cheapPlank && r.e.sale === 'cheap' && r.s.robots[1].tally.soso === 1 && r.s.seen.price, 'so-so: a plank let go for $' + C.cheapPlank + ', and "' + RULE_TEXT.price + '" joins the list', r.paid);
  r = sale('plank', { price: ['free'] });
  ok(r.paid === 0 && r.e.sale === 'free' && r.dt === 0 && r.s.robots[1].tally.bad === 1 && r.s.seen.price, 'bad: a good plank given away for $0', r.paid);
  r = sale('dowels', { mislabel: [true] });
  ok(r.paid === 5 && r.dt <= -C.satHit + 0.5 && r.dt > -C.satHit - 0.01 && r.e.sale === 'mislabel' && r.s.seen.sellOnly && F.known(r.s).map(q => q.id).join() === 'sellOnly',
    'bad: dowel rods sold as a plank for $5, customer satisfaction drops ' + C.satHit + ', and "' + RULE_TEXT.sellOnly + '" joins the list', r.paid + ' / ' + r.dt.toFixed(2));
  r = sale('rough', { mislabel: [true] });
  ok(r.paid === 5 && r.e.sale === 'mislabel', 'a rough plank passed off as a plank goes the same way', r.paid);
  r = sale('dowels', { mislabel: [false] });
  ok(r.paid === C.price.dowels && r.e.sale === 'fair' && r.s.robots[1].record.honest === 1 && !F.known(r.s).length, 'or it sells dowels honestly, at their own price ($' + C.price.dowels + '): no mistake, nothing joins the list', r.paid);
  r = sale('rough', { mislabel: [false] });
  ok(r.paid === C.price.rough, 'and a rough plank at its own price, $' + C.price.rough, r.paid);
  r = sale('plank', { price: ['fair'] }, 70);
  ok(r.paid === Math.round(5 * r.e.satAt / 100) && r.paid === 4 && r.dt >= C.satUp && r.dt < C.satUp + 1, 'customer satisfaction sets the price: at 70% a plank fetches $4, and a fair sale wins a point back', r.paid + ' / ' + r.dt.toFixed(2));
  r = sale('dowels', { mislabel: [true] }, C.satMin + 3);
  ok(r.s.satisfaction >= C.satMin && r.s.satisfaction < C.satMin + 0.5, 'customer satisfaction never drops below ' + C.satMin + '%', r.s.satisfaction.toFixed(2));
  r = sale('plank', { price: ['fair'] }, 100);
  ok(r.s.satisfaction === 100, 'and never rises above 100%');
  const q = F.newGame(); q.satisfaction = 40; run(q, 60);
  const want = 100 - 60 * Math.exp(-C.satHeal * 60);
  ok(q.satisfaction > 40 && Math.abs(q.satisfaction - want) < 0.5, 'customers forget: a minute with no sales heals satisfaction from 40% toward 100%', q.satisfaction.toFixed(1) + ' vs ' + want.toFixed(1));
  const s = F.newGame(); s.bin.push('dowels', 'rough', 'plank'); s.satisfaction = 50;
  F.tap(s, { kind: 'bin' }); until(s, x => !!F.bubbleOpen(x), 10);
  const opts = F.options(s);
  const got = ['sell:dowels', 'sell:rough', 'sell:plank'].map(id => { const m = s.money; F.choose(s, id); return s.money - m; });
  ok(opts.map(o => o.id).join() === 'sell:plank,sell:rough,sell:dowels' && got.join() === [1, 3, 5].map(p => Math.round(p * 0.5)).join(),
    'selling by hand: one button per kind of thing in the bin, each at its fair price times customer satisfaction', opts.map(o => o.id + '=' + o.price).join() + ' got ' + got.join());
}

/* ---------- 7. instructions ---------- */
{
  // slots: each robot's own, bought in order, only once both robots are on staff
  const one = staffed(21, ['operate']); one.money = 999; one.seen.sap = true;
  ok(!F.slotsOpen(one) && !F.buySlot(one, 0) && one.robots[0].slots === 0 && one.money === 999, 'with one robot on staff no slot can be bought, whatever the money');
  const s = staffed(21); s.money = 4;
  ok(F.slotsOpen(s) && F.slotPrice(s, 0) === 5 && !F.buySlot(s, 0) && s.money === 4, 'with both, the first slot asks $5 and waits for the money');
  s.money = 1000;
  const paid = [];
  for (let i = 0; i < 7; i++) { const m = s.money; if (F.buySlot(s, 0)) paid.push(m - s.money); }
  ok(paid.join() === C.slots.join() && s.robots[0].slots === 5 && F.slotPrice(s, 0) === null && s.robots[0].rules.length === 5 && s.robots[0].rules.every(x => x === null),
    'slots cost ' + C.slots.map(p => '$' + p).join(' / ') + ' in order, five at most, each one empty', paid.join());
  ok(s.robots[1].slots === 0 && F.slotPrice(s, 1) === 5, 'and buying them for one robot buys nothing for the other: its first slot is still $5');
  // the list grows only with what has been seen
  ok(!F.known(s).length && !F.setRule(s, 0, 0, 'sap') && s.robots[0].rules[0] === null, 'no instruction can be given before its mistake has been seen');
  s.seen.sap = true; s.seen.gnarled = true;
  ok(F.known(s).map(q => q.id).join() === 'sap,gnarled' && F.setRule(s, 0, 0, 'sap') && s.robots[0].rules[0] === 'sap', 'once seen it is in the list, and it goes in a slot');
  ok(!F.setRule(s, 0, 1, 'sap') && F.setRule(s, 0, 1, 'gnarled') && !F.setRule(s, 0, 5, 'gnarled') && !F.setRule(s, 0, 0.5, 'gnarled') && !F.setRule(s, 0, 2, 'nonsense'),
    'once per robot, only in a slot it has, and only from the pool', JSON.stringify(s.robots[0].rules));
  s.money = 5; F.buySlot(s, 1);
  ok(F.setRule(s, 1, 0, 'sap') && s.robots[1].rules[0] === 'sap' && s.robots[0].rules.join() === 'sap,gnarled,,,', 'both robots may hold the same instruction: each has its own list');
  ok(F.setRule(s, 0, 0, null) && s.robots[0].rules[0] === null && s.robots[0].slots === 5, 'an instruction can be taken out again, and the slot stays bought');
  F.rename(s, 0, '   Plank   Boss  ');
  const trimmed = s.robots[0].name;
  F.rename(s, 0, 'Plankmaster General of the Line');
  const long = s.robots[0].name;
  F.rename(s, 1, '   ');
  ok(trimmed === 'Plank Boss' && long === 'Plankmaster General of the Line'.slice(0, C.nameMax) && s.robots[1].name === C.names[1], 'a robot can be renamed (trimmed, ' + C.nameMax + ' characters at most); a blank name puts its own back', [trimmed, long, s.robots[1].name].join(' / '));
  // the clipboard in the robot's bubble opens its page
  const b = staffed(22, ['operate', 'sell']); instruct(b, 0, ['sap']);
  F.tap(b, { kind: 'robot', id: 0 }); until(b, x => !!F.bubbleOpen(x), 20);
  const note = F.options(b).find(o => o.id === 'notes');
  ok(note && note.filled === 1 && note.slots === 1 && F.choose(b, 'notes') && take(b, 'notes').length === 1 && take(b, 'notes')[0].id === 0 && !F.bubbleOpen(b), 'the robot\'s clipboard shows how many of its slots are filled, and opens its page', JSON.stringify(note));
}
{
  // each instruction prevents its mistake (no slip)
  let s = opCycle('gnarled', { slip: [false] }, ['gnarled']);
  until(s, x => take(x, 'recycled').length > 0, 20);
  const r1 = take(s, 'recycled')[0];
  until(s, x => x.bin.length > 0, 20);
  ok(r1 && r1.item === 'gnarled' && r1.from === 'in' && r1.by === 0 && s.bin.join() === 'plank' && s.robots[0].record.reject === 1 && !s.robots[0].record.rough,
    '"' + RULE_TEXT.gnarled + '": the operator puts the gnarled log in the recycle bin, waits for the next, and makes a plank', s.bin.join());
  s = opCycle('small', { slip: [false] }, ['small']);
  until(s, x => x.bin.length > 0, 20);
  ok(take(s, 'recycled').length === 1 && take(s, 'recycled')[0].item === 'small' && s.bin.join() === 'plank', '"' + RULE_TEXT.small + '": the small log goes in the recycle bin, not the machine');
  s = opCycle('log', { slip: [false, false], sap: [true] }, ['sap']);
  until(s, x => x.bin.length > 0, 20);
  ok(!take(s, 'sapped').length && s.machine.phase !== 'jam' && s.bin.join() === 'plank' && s.force.sap.length === 1, '"' + RULE_TEXT.sap + '": no sap, no jam (it never even reaches for the barrel)');
  s = opCycle('gnarled', { slip: [false] }, ['output']);
  until(s, x => take(x, 'recycled').length > 0, 20); run(s, 3);
  const r2 = take(s, 'recycled')[0];
  ok(r2 && r2.item === 'rough' && r2.from === 'out' && !s.bin.length && !take(s, 'binned').length && s.robots[0].record.caught === 1 && s.robots[0].record.rough === 1,
    '"' + RULE_TEXT.output + '": the gnarled log still goes in (that is another instruction), but the rough plank goes in the recycle bin, not the sale bin', r2 && r2.item);
  let r = sale('dowels', { slip: [false], mislabel: [true] }, undefined, ['sellOnly']);
  ok(!r.e && r.rec && r.rec.item === 'dowels' && r.rec.from === 'bin' && r.paid === 0 && r.dt === 0 && r.s.robots[1].record.recycle === 1, '"' + RULE_TEXT.sellOnly + '": the seller puts dowels in the recycle bin instead of selling them, and satisfaction is untouched');
  r = sale('plank', { slip: [false], price: ['free'] }, undefined, ['price']);
  ok(r.paid === 5 && r.e.sale === 'fair', '"' + RULE_TEXT.price + '": a plank goes for $5 even on a day the seller would have given it away');
  // the slip: 1 time in 20 it does what it would have done anyway
  s = opCycle('gnarled', { slip: [true] }, ['gnarled']);
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'rough' && !take(s, 'recycled').length, 'on a slip the instruction is ignored: the gnarled log goes in anyway');
  r = sale('rough', { slip: [true], mislabel: [true] }, undefined, ['sellOnly']);
  ok(r.e && r.e.sale === 'mislabel', 'and a slipping seller can still pass a rough plank off as a plank');
  // an instruction about another job does nothing: same dice, same day, exactly
  const day = rules => {
    const t = staffed(31, ['operate', 'sell']);
    if (rules) { instruct(t, 0, rules[0]); instruct(t, 1, rules[1]); }
    const log = [];
    for (let k = 0; k < 6000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'outcome' || e.kind === 'sold' || e.kind === 'recycled') log.push(e.kind + ':' + (e.what || e.sale || e.item)); }); t.events = []; if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; } }
    return { log: log.join(), money: t.money, seed: t.seed };
  };
  const plain = day(null), crossed = day([['sellOnly', 'price'], ['sap', 'gnarled', 'small', 'output']]), right = day([['sap', 'gnarled', 'small', 'output'], ['sellOnly', 'price']]);
  ok(plain.log.length > 200 && crossed.log === plain.log && crossed.money === plain.money && crossed.seed === plain.seed, 'an instruction about the other robot\'s job does nothing: crossed wires play the same day as no instructions, roll for roll', plain.money + ' vs ' + crossed.money);
  ok(right.money > plain.money * 1.5, 'and the same instructions on the right robots earn over 1.5x as much (with every jam cleaned the moment it happens)', right.money + ' vs ' + plain.money);
  // instructions belong to the robot: swap their jobs and they go with it
  s = staffed(33, ['operate', 'sell']); instruct(s, 0, ['gnarled']);
  F.tap(s, { kind: 'robot', id: 1 }); until(s, x => !!F.bubbleOpen(x), 20); F.choose(s, 'job:operate');
  ok(s.robots[1].job === 'operate' && s.robots[0].job === 'sell' && s.robots[0].rules.join() === 'gnarled' && !s.robots[1].rules.length, 'swap the robots\' jobs and each keeps its own instructions: the new operator has none');
  s.force = Object.assign(calm(), { log: many('gnarled'), slip: many(false) }); s.events = [];
  if (F.ready(s)) s.machine.log = 'gnarled';
  until(s, x => take(x, 'made').some(e => e.by === 1), 40);
  const first = take(s, 'made').find(e => e.by === 1);
  ok(first && first.item === 'rough', 'so a gnarled log goes in: the instruction that would have stopped it is on the robot now selling');
}

/* ---------- 8. the rates, measured over real play ---------- */
{
  const measure = (seed, sec, rules) => {
    const s = staffed(seed, ['operate', 'sell']);
    if (rules) { instruct(s, 0, rules[0]); instruct(s, 1, rules[1]); }
    const n = { logs: {}, price: { fair: 0, cheap: 0, free: 0 }, pairs: [] };
    let lastOp = null;
    for (let t = 0; t < sec; t += 0.05) {
      F.step(s, 0.05);
      if (s.machine.phase === 'jam') { s.machine.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0 }; }   // an instant cleaner
      if (s.bin.length < 3) s.bin.push('plank');                                                       // the seller never runs dry
      s.events.forEach(e => {
        if (e.kind === 'outcome' && e.job === 'operate') lastOp = e.grade;
        if (e.kind === 'recycled' && e.from === 'in') n.logs[e.item] = (n.logs[e.item] || 0) + 1;
        if (e.kind === 'made') { const k = { plank: 'log', rough: 'gnarled', dowels: 'small' }[e.item]; n.logs[k] = (n.logs[k] || 0) + 1; }
        if (e.kind === 'sold' && e.item === 'plank' && n.price[e.sale] !== undefined) { n.price[e.sale]++; if (lastOp) n.pairs.push([lastOp, e.sale]); }
      });
      s.events = [];
    }
    return n;
  };
  const within = (got, n, p) => Math.abs(got / n - p) <= 3.5 * Math.sqrt(p * (1 - p) / n) + 0.005;
  const a = measure(101, 3600);
  const logsN = (a.logs.log || 0) + (a.logs.gnarled || 0) + (a.logs.small || 0);
  ok(logsN > 400 && within(a.logs.gnarled || 0, logsN, C.logs.gnarled) && within(a.logs.small || 0, logsN, C.logs.small), 'over real play the rack sends gnarled and small logs at their rates', JSON.stringify(a.logs));
  const planks = a.price.fair + a.price.cheap + a.price.free;
  ok(planks > 1500 && within(a.price.free, planks, U.free) && within(a.price.cheap, planks, U.cheap), 'an uninstructed seller gives planks away and lets them go cheap at its rates', JSON.stringify(a.price));
  const pg = a.pairs.filter(p => p[0] === 'good'), pb = a.pairs.filter(p => p[0] === 'bad');
  const f1 = pg.filter(p => p[1] === 'fair').length / pg.length, f2 = pb.filter(p => p[1] === 'fair').length / pb.length;
  ok(pg.length > 100 && pb.length > 100 && Math.abs(f1 - f2) < 0.12, 'and the two robots roll their own dice: a plank sells as fairly after a good operator as after a bad one', (f1 * 100).toFixed(0) + '% vs ' + (f2 * 100).toFixed(0) + '%');
  // the slip, measured: an operator told to recycle gnarled logs feeds about 1 in 20 of them anyway
  // with the instruction, a gnarled log fed in shows up as a rough plank
  const fedRate = (() => {
    const s = staffed(107, ['operate', 'sell']); instruct(s, 0, ['gnarled', 'small', 'sap']);
    let fedN = 0, tossedN = 0;
    for (let t = 0; t < 7200; t += 0.05) {
      F.step(s, 0.05);
      if (s.machine.phase === 'jam') { s.machine.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0 }; }
      s.events.forEach(e => { if (e.kind === 'made' && e.item === 'rough') fedN++; if (e.kind === 'recycled' && e.from === 'in' && e.item === 'gnarled') tossedN++; });
      s.events = []; s.bin.length = 0;
    }
    return { fedN, n: fedN + tossedN };
  })();
  ok(fedRate.n > 300 && within(fedRate.fedN, fedRate.n, C.slip), 'over real play, an operator told to recycle gnarled logs still feeds ' + Math.round(C.slip * 100) + '% of them in (it slips)', fedRate.fedN + ' of ' + fedRate.n);
}

/* ---------- 9. saving, determinism and the bounds, over seeded random play ---------- */
{
  const rnd = (seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })(99);
  const TAPS = ['machine', 'bin', 'dock', 'floor', 'robot', 'robot'];
  const play = (s, n, choices) => {
    for (let i = 0; i < n; i++) {
      const k = TAPS[Math.floor(rnd() * TAPS.length)];
      if (k === 'robot') { if (s.robots.length) F.tap(s, { kind: 'robot', id: Math.floor(rnd() * s.robots.length) }); }
      else if (k === 'floor') F.tap(s, { kind: 'floor', x: rnd() * 6, y: 4 + rnd() * 18 });
      else F.tap(s, { kind: k });
      for (let t = 0; t < 4 + rnd() * 6; t += 0.05) {
        F.step(s, 0.05);
        const o = F.options(s).filter(x => x.enabled);
        if (o.length && rnd() < 0.3) F.choose(s, o[Math.floor(rnd() * o.length)].id);
        // now and then, someone is on a robot's page
        if (s.robots.length && rnd() < 0.02) {
          const id = Math.floor(rnd() * s.robots.length), r = s.robots[id], known = F.known(s);
          if (rnd() < 0.5) F.buySlot(s, id);
          else if (r.slots && known.length) F.setRule(s, id, Math.floor(rnd() * r.slots), rnd() < 0.2 ? null : known[Math.floor(rnd() * known.length)].id);
          else F.rename(s, id, 'R' + Math.floor(rnd() * 100));
        }
      }
      if (choices) choices(s);
    }
    return s;
  };
  let worst = '';
  const s = F.newGame(4);
  play(s, 300, x => {
    if (worst) return;
    if (x.money < 0) worst = 'money ' + x.money;
    else if (x.satisfaction < C.satMin || x.satisfaction > 100) worst = 'satisfaction ' + x.satisfaction;
    else if (!F.free(x, x.avatar.x, x.avatar.y)) worst = 'avatar inside something at ' + x.avatar.x.toFixed(2) + ',' + x.avatar.y.toFixed(2);
    else if (x.robots.some(r => !F.free(x, r.x, r.y))) worst = 'a robot inside something';
    else if (x.bin.some(k => F.ITEMS.indexOf(k) < 0)) worst = 'bin holds ' + x.bin.join();
    else if (['ready', 'run', 'jam'].indexOf(x.machine.phase) < 0 || F.LOGS.indexOf(x.machine.log) < 0) worst = 'machine ' + x.machine.phase + ' ' + x.machine.log;
    else if (x.robots.some(r => r.slots > C.slots.length || r.rules.length !== r.slots || r.rules.some(id => id !== null && !x.seen[id]) || new Set(r.rules.filter(Boolean)).size !== r.rules.filter(Boolean).length)) worst = 'a robot\'s instructions ' + JSON.stringify(x.robots.map(r => r.rules));
  });
  ok(!worst && s.robots.length >= 1, 'over 300 random taps and page visits: money never negative, satisfaction in bounds, nobody walks into anything, the bin holds only things, instructions only ever seen ones, once each', worst || (s.robots.length + ' robots, $' + s.money + ', ' + JSON.stringify(s.robots.map(r => r.rules))));

  const a = play(F.newGame(8), 60), text = F.save(a), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(b && strip(a) === strip(b), 'a save loads back to the same factory, names and instructions included');
  run(a, 30); run(b, 30);
  ok(strip(a) === strip(b), 'and both carry on identically, robot luck included (the dice live in the save)');
  ok(F.load('{}') === null && F.load('nonsense') === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: C.version + 1 }))) === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: 1 }))) === null,
    'a save from another version (the prompt-lab factory included), or garbage, is not loaded');
  const h = staffed(41); instruct(h, 0, ['sap']);
  const raw = JSON.parse(F.save(h));
  Object.assign(raw, { money: -50, satisfaction: 400, seen: { bogus: true } });
  raw.robots[0].slots = 9; raw.robots[0].rules = ['sap', 'sap', 'nonsense', 'price']; raw.robots[0].name = 'x'.repeat(40);
  raw.machine.log = 'stone';
  const hacked = F.load(JSON.stringify(raw));
  ok(hacked && hacked.money === 0 && hacked.satisfaction === 100 && hacked.robots[0].slots === 5 && hacked.robots[0].rules.join() === 'sap,,,price,' && hacked.robots[0].name.length === C.nameMax &&
    hacked.seen.price && !hacked.seen.bogus && hacked.machine.log === 'log',
    'a hand-edited save is clamped: money, satisfaction, slots, a repeated or unknown instruction, a long name, an unknown log', hacked && JSON.stringify([hacked.money, hacked.satisfaction, hacked.robots[0].slots, hacked.robots[0].rules, hacked.robots[0].name.length, hacked.seen, hacked.machine.log]));
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
