#!/usr/bin/env node
/**
 * drive-taas-factory.cjs — rules gate for TAAS's robot factory mode (pure node, ~3 s).
 *
 * The factory keeps its whole simulation in one DOM-free block in games/taas/index.html
 * (`const FACTORY = (function () { ... })()`), so the rules are checked here against that
 * block, lifted out of the page, with no browser: the floor and its paths, the manual loop
 * the CD described (tap the button, the avatar walks over and presses, four seconds, a plank
 * in the bin, sell it for $5), $1 a log whoever presses, and the logs you toss yourself, hiring
 * at $20 and $40, the two jobs, every mistake a robot can make and what it does, the seller
 * that only sells what is in the bin and hunts it for planks when told to, the robots'
 * instructions (the CD's seven, each robot's own slots at $5-$25, the list that grows with the
 * mistakes seen, each instruction preventing its mistake, the one that now prevents nothing,
 * the 1-in-20 slip, an instruction about another job doing nothing), the rates as MEASURED
 * over real play, customer satisfaction and prices, and saving.
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
const SELLERS = ['sellOnly', 'dowelsOut', 'roughOut', 'largeOut'];
// the dice, made quiet: good logs, no thinking (each queue is what the next rolls of that name come up)
const calm = () => ({ log: many('log'), think: many(false) });
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
// the CD's words: 1"x4"x4' became "medium" in the fourth brief, which added the size and recycle ones
const RULE_TEXT = {
  sap: 'Never put sap on input log', sappy: 'Put sap logs in recycle bin', gnarled: 'Put gnarled logs in recycle bin',
  medium: 'Only input medium logs', smallLog: 'Put small logs in recycle bin', largeLog: 'Put large logs in recycle bin', mediumLog: 'Put medium logs in recycle bin',
  output: 'Only output medium wood planks', sellOnly: 'Only sell medium wood planks', price: 'Sell medium wood planks for $5',
  dowelsOut: 'Put dowel rods in recycle bin', largeOut: 'Put large planks in recycle bin', roughOut: 'Put gnarled planks in recycle bin'
};

/* ---------- 1. the tables ---------- */
{
  ok(C.hire.length === 2 && C.hire[0] === 20 && C.hire[1] === 40, 'two robots, at $20 and $40 (the CD\'s numbers)', C.hire.join());
  ok(C.processSec === 4 && C.price.plank === 5, 'a plank takes 4 s and sells for $5 (the CD\'s numbers)');
  ok(C.price.dowels <= 1 && C.price.rough < C.price.plank && C.price.largePlank < C.price.plank && C.mislabel === C.price.plank && C.cheapPlank < C.price.plank, 'dowels sell for $1 at most, a gnarled or a large plank for less than a medium plank; passed off as a medium plank they ask its price');
  ok(C.logCost === 1, 'machine01 costs $1 for every log it processes (the CD\'s number)', C.logCost);
  ok(JSON.stringify(C.slots) === '[5,10,15,20,25]' && C.slots.reduce((a, b) => a + b, 0) * C.hire.length === 150, 'instruction slots cost $5 / $10 / $15 / $20 / $25 for each robot: $150 for all five on both (the CD\'s numbers)', C.slots.join());
  ok(F.RULES.length === 13 && F.RULES.every(q => RULE_TEXT[q.id] === q.text), 'the instruction pool is the CD\'s thirteen, word for word ("medium" where 1"x4"x4\' was)', F.RULES.map(q => q.text).join(' | '));
  ok(F.RULES.filter(q => q.job === 'operate').map(q => q.id).join() === 'sap,sappy,gnarled,medium,smallLog,largeLog,mediumLog,output' && F.RULES.filter(q => q.job === 'sell').map(q => q.id).join() === 'sellOnly,price,dowelsOut,largeOut,roughOut', 'eight are about running machine 01, five about selling');
  // a valid path exists: every bad log has an operator instruction that keeps it out, and every
  // thing that can land in the sale bin but a medium plank has a seller instruction that clears it
  const bad = F.LOGS.filter(k => k !== 'log'), junk = F.ITEMS.filter(k => k !== 'plank');
  const kept = bad.filter(k => F.RULES.some(q => q.job === 'operate' && q.rejects && q.rejects.indexOf(k) >= 0 && !q.joins));
  const cleared = junk.filter(k => F.RULES.some(q => q.job === 'sell' && q.recycles === k));
  const made = F.LOGS.map(k => F.MAKES[k]).filter(k => k !== 'sap');
  ok(kept.length === bad.length && cleared.length === junk.length && made.every(k => F.ITEMS.indexOf(k) >= 0), 'every bad log has an operator instruction that keeps it out of machine01, and everything a press can put in the sale bin but a medium plank has a seller instruction that takes it out',
    'kept out: ' + kept.join() + ' of ' + bad.join() + '; cleared: ' + cleared.join() + ' of ' + junk.join());
  ok(F.BASE.operate === 'Use machine01 to refine raw materials.' && F.BASE.sell === 'Sell the items in this bin.', 'the base prompts are the CD\'s: "use machine01 to refine raw materials" and "sell the items in this bin"');
  ok(C.slip > 0 && C.slip <= 0.1 && C.names.length >= C.hire.length && new Set(C.names).size === C.names.length, 'a robot slips on an instruction rarely (' + C.slip + '), and the robots start with names of their own');
  const L0 = C.logs.gnarled + C.logs.small + C.logs.large + C.logs.sappy;
  ok(C.logs.sappy > 0 && C.logs.large > 0 && L0 > 0 && L0 <= 0.5 && Object.keys(U).every(k => U[k] > 0 && U[k] < 1), 'some logs off the rack are gnarled, small, large or sappy, at least half are good medium logs; every uninstructed mistake is a chance, not a certainty');
  ok(U.sap === undefined && !L.SOLID.barrel && !SP.sap && F.LOGS.indexOf('sappy') >= 0, 'the sap barrel is gone (the CD, 2026-10-14): no robot pours sap; it comes in on the logs');
}

/* ---------- 2. the floor ---------- */
{
  const s = F.newGame();
  const spots = ['start', 'press', 'operate', 'sell', 'bin', 'dock'].map(k => Object.assign({ k }, SP[k]));
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
  ok(s.money === -C.logCost && s.spent === C.logCost && take(s, 'press')[0].cost === C.logCost, 'the press cost $' + C.logCost + ' for the log: money goes below zero, $0 to -$' + C.logCost, s.money);

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
  const m0 = s.money;
  F.choose(s, 'sell:plank');
  ok(m0 === -2 * C.logCost && s.money === m0 + 5 && s.bin.length === 1, 'one tap sells exactly one plank: $5 more (two logs in, -$' + (2 * C.logCost) + ' to $' + (5 - 2 * C.logCost) + ')', m0 + ' > ' + s.money + ' / ' + s.bin.length);
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
  ok(s.money === 20 - 4 * C.logCost && s.spent === 4 * C.logCost && s.earned === 20 && s.tally.player.sold === 4, 'four planks sold by hand is $20, less $' + (4 * C.logCost) + ' for their logs', s.money);

  // you never get it wrong: a gnarled or a small log goes in the recycle bin, and you press the next good one
  const g = F.newGame(); g.force.log = ['small', 'large', 'log'];
  g.machine.log = 'gnarled';
  F.tap(g, { kind: 'machine' });
  until(g, x => x.machine.phase === 'run', 20);
  const rec = take(g, 'recycled');
  ok(rec.length === 3 && rec.map(e => e.item).join() === 'gnarled,small,large' && rec.every(e => e.by === 'player' && e.from === 'in') && g.machine.log === 'log' && g.machine.by === 'player' && g.tally.player.tossed === 3,
    'tapping the button with a gnarled log on the belt: you toss it in the recycle bin, then the small and the large ones after it, and press on the good log', rec.map(e => e.item).join());
  until(g, x => x.bin.length > 0, 10);
  ok(g.bin.join() === 'plank' && g.recycled.join() === 'gnarled,small,large' && g.recycledN === 3 && !F.known(g).length && g.spent === C.logCost, 'so your plank is a medium plank, the three bad logs are in the recycle bin (a toss costs nothing: only the log pressed is paid for), and no instruction joins the list (you made no mistake)', g.spent);
  const sp = F.newGame(); sp.force.log = ['log']; sp.machine.log = 'sappy';
  F.tap(sp, { kind: 'machine' }); until(sp, x => x.machine.phase === 'run', 20); run(sp, 2);
  ok(take(sp, 'recycled').length === 1 && take(sp, 'recycled')[0].item === 'sappy' && sp.machine.phase === 'run' && !take(sp, 'jam').length, 'a sap log goes in the recycle bin too: your press never jams the machine');
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
  ok(s.bin.join() === 'rough' && s.robots[0].tally.soso === 1 && s.robots[0].record.rough === 1 && rule1.length && rule1[0].id === 'gnarled' && rule1[0].by === 0 && s.spent === C.logCost,
    'with no instruction a gnarled log goes in (for $' + C.logCost + ') and a plank with holes comes out (so-so), and "' + RULE_TEXT.gnarled + '" joins the list', s.bin.join() + ' / ' + F.known(s).map(q => q.id).join());
  ok(F.known(s).map(q => q.id).join() === 'gnarled,output', 'and once the plank with holes lands in the bin, "' + RULE_TEXT.output + '" joins it: those two and no others', F.known(s).map(q => q.id).join());

  s = opCycle('small');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'dowels' && s.robots[0].tally.soso === 1 && s.robots[0].record.dowels === 1 && s.seen.medium && s.seen.smallLog && take(s, 'rule').filter(e => e.ids.indexOf('medium') >= 0).length === 1,
    'a small log goes in and dowel rods come out (yellow: wasteful, not a blocker), and "' + RULE_TEXT.medium + '" and "' + RULE_TEXT.smallLog + '" join the list (one announcement)', s.bin.join() + ' / ' + F.known(s).map(q => q.id).join());
  ok(s.seen.mediumLog && !s.seen.largeLog, 'and "' + RULE_TEXT.mediumLog + '" rides in with them (for a factory that wants dowels); the large-log one waits for a large log');
  s = opCycle('large');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'largePlank' && s.robots[0].tally.soso === 1 && s.robots[0].record.largePlank === 1 && s.seen.medium && s.seen.largeLog,
    'a large log goes in and a large plank comes out (yellow), and "' + RULE_TEXT.largeLog + '" joins the list', s.bin.join());

  s = opCycle('sappy');
  until(s, x => x.machine.phase === 'jam', 20);
  run(s, 60);
  ok(s.machine.phase === 'jam' && !s.bin.length && !take(s, 'made').length && s.robots[0].tally.bad === 1 && s.robots[0].record.sap === 1 && s.seen.sappy && take(s, 'rule').length === 1 && take(s, 'rule')[0].id === 'sappy',
    'a sap log: with no instruction it goes in, the machine gums up and stays jammed (60 s later no robot has fixed it), and "' + RULE_TEXT.sappy + '" joins the list', s.machine.phase);
  ok(F.known(s).map(q => q.id).join() === 'sap,sappy' && s.spent === C.logCost, 'and "' + RULE_TEXT.sap + '" joins it, an instruction that sounds right and now prevents nothing; the jammed log still cost $' + C.logCost, F.known(s).map(q => q.id).join());
  ok(s.robots[0].mood === 'stuck' && s.robots[0].state === 'idle', 'and the operator just stands there, stuck');
  F.tap(s, { kind: 'machine' });
  until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c0 = s.t;
  until(s, x => x.machine.phase !== 'jam', 10);
  ok(s.machine.phase === 'ready' && Math.abs(s.t - c0 - C.cleanSec) < 0.11 && take(s, 'cleaned').length === 1, 'tapping the machine walks you over to scrub it clean, which takes ' + C.cleanSec + ' s', (s.t - c0).toFixed(2));
  s = opCycle('sappy'); until(s, x => x.machine.phase === 'jam', 20);
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
  ok(r.paid === 0 && r.e.sale === 'free' && r.dt === 0 && r.s.robots[1].tally.soso === 1 && r.s.seen.price, 'yellow: a good plank given away for $0 (wasteful, but no customer was let down)', r.paid);
  r = sale('dowels', { mislabel: [true] });
  ok(r.paid === 5 && r.dt <= -C.satHit + 0.5 && r.dt > -C.satHit - 0.01 && r.e.sale === 'mislabel' && r.s.robots[1].tally.bad === 1 && r.s.robots[1].record['mislabel:dowels'] === 1 && F.known(r.s).map(q => q.id).join() === 'sellOnly,dowelsOut',
    'red: dowel rods sold as a medium plank for $5, customer satisfaction drops ' + C.satHit + ', and "' + RULE_TEXT.sellOnly + '" joins the list, with "' + RULE_TEXT.dowelsOut + '" (it met dowels)', r.paid + ' / ' + r.dt.toFixed(2) + ' / ' + F.known(r.s).map(q => q.id).join());
  r = sale('rough', { mislabel: [true] });
  ok(r.paid === 5 && r.e.sale === 'mislabel', 'a gnarled plank passed off as a medium plank goes the same way', r.paid);
  r = sale('dowels', { mislabel: [false] });
  ok(r.paid === C.price.dowels && r.e.sale === 'fair' && r.s.robots[1].record['honest:dowels'] === 1 && r.s.robots[1].tally.good === 1 && F.known(r.s).map(q => q.id).join() === 'dowelsOut' && !r.s.robots[1].record.looking,
    'or it sells dowels honestly, at their own price ($' + C.price.dowels + '): green, what "sell the items in this bin" asks; only the recycle instruction joins the list (and with no instruction it never hunts: it sells what comes next)', r.paid + ' / ' + F.known(r.s).map(q => q.id).join());
  r = sale('rough', { mislabel: [false] });
  ok(r.paid === C.price.rough && r.s.seen.roughOut, 'and a gnarled plank at its own price, $' + C.price.rough, r.paid);
  r = sale('largePlank', { mislabel: [false] });
  ok(r.paid === C.price.largePlank && r.s.seen.largeOut, 'and a large plank at its own price, $' + C.price.largePlank, r.paid);
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
  ok(r1 && r1.item === 'gnarled' && r1.from === 'in' && r1.by === 0 && s.bin.join() === 'plank' && s.robots[0].record['reject:gnarled'] === 1 && !s.robots[0].record.rough,
    '"' + RULE_TEXT.gnarled + '": the operator puts the gnarled log in the recycle bin, waits for the next, and makes a plank', s.bin.join());
  for (const [log, rule] of [['small', 'medium'], ['large', 'medium'], ['small', 'smallLog'], ['large', 'largeLog']]) {
    s = opCycle(log, { slip: [false] }, [rule]);
    until(s, x => x.bin.length > 0, 20);
    ok(take(s, 'recycled').length === 1 && take(s, 'recycled')[0].item === log && s.bin.join() === 'plank' && s.robots[0].record['reject:' + log] === 1, '"' + RULE_TEXT[rule] + '": the ' + log + ' log goes in the recycle bin, not the machine');
  }
  s = opCycle('small', { slip: [false] }, ['largeLog']);
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'dowels' && s.force.slip.length === 1, '"' + RULE_TEXT.largeLog + '" says nothing about a small log: in it goes, and the instruction is never consulted', s.bin.join());
  s = opCycle('log', { slip: [false] }, ['mediumLog']);
  until(s, x => take(x, 'recycled').length > 0, 20);
  const tossed = take(s, 'recycled')[0];
  ok(tossed && tossed.item === 'log' && s.robots[0].record['reject:log'] === 1 && s.robots[0].tally.good === 1 && !s.bin.length, '"' + RULE_TEXT.mediumLog + '" throws a good medium log away: done as told, so green in its evals (whether it was wise is the player\'s call)');
  s = opCycle('gnarled', { slip: [true, false] }, ['mediumLog', 'gnarled']);
  until(s, x => take(x, 'recycled').length > 0, 20);
  ok(take(s, 'recycled')[0].item === 'gnarled' && s.force.slip.length === 0, 'two instructions about the same log each get their chance: a slip on one is caught by the other');
  s = opCycle('sappy', { slip: [false] }, ['sappy']);
  until(s, x => x.bin.length > 0, 20);
  ok(take(s, 'recycled').length === 1 && take(s, 'recycled')[0].item === 'sappy' && !take(s, 'jam').length && s.bin.join() === 'plank' && s.spent === C.logCost,
    '"' + RULE_TEXT.sappy + '": the sap log goes in the recycle bin, not the machine (no jam, and only the good log after it is paid for)', s.spent);
  s = opCycle('sappy', { slip: [false] }, ['sap']);
  until(s, x => x.machine.phase === 'jam', 20);
  ok(s.machine.phase === 'jam' && s.force.slip.length === 1, '"' + RULE_TEXT.sap + '" prevents nothing now: the sap log goes in and jams the machine, and the instruction is never even consulted (its slip die is never rolled)');
  s = opCycle('gnarled', { slip: [false] }, ['output']);
  until(s, x => take(x, 'recycled').length > 0, 20); run(s, 3);
  const r2 = take(s, 'recycled')[0];
  ok(r2 && r2.item === 'rough' && r2.from === 'out' && !s.bin.length && !take(s, 'binned').length && s.robots[0].record['caught:rough'] === 1 && s.robots[0].record.rough === 1,
    '"' + RULE_TEXT.output + '": the gnarled log still goes in (that is another instruction), but the gnarled plank goes in the recycle bin, not the sale bin', r2 && r2.item);
  // "only sell planks": the seller only ever sells what is in the bin, so everything else stays
  // there and it has to hunt for a plank
  const hunt = (bin, force, done, rules) => {
    const t = staffed(13, [null, 'sell']); instruct(t, 1, rules || ['sellOnly']);
    until(t, x => x.robots[1].state === 'idle' && dist(x.robots[1], SP.sell) < 0.07, 20);
    t.events = []; bin.forEach(k => t.bin.push(k));
    Object.keys(force).forEach(k => { t.force[k] = force[k].slice(); });
    const m0 = t.money, sat0 = t.satisfaction;
    until(t, done, 12);
    return { t, m0, sat0, r: t.robots[1] };
  };
  let h = hunt(['dowels', 'rough'], { slip: [false] }, x => x.t > 1e9);
  const joined = take(h.t, 'rule').map(e => e.ids.join('+')).sort().join();
  ok(!take(h.t, 'sold').length && !take(h.t, 'recycled').length && h.t.bin.join() === 'dowels,rough' && h.r.record.looking >= 6 && take(h.t, 'looking').length === h.r.record.looking && h.t.money === h.m0,
    '"' + RULE_TEXT.sellOnly + '": with only dowels and a gnarled plank in the bin, the seller sells nothing and takes nothing out; it keeps reaching, and each reach is a "looking for plank" in its evals', h.t.bin.join() + ' / looking ' + h.r.record.looking);
  ok(joined === 'dowelsOut,roughOut' && take(h.t, 'looking').some(e => e.item === 'dowels') && take(h.t, 'looking').some(e => e.item === 'rough'), 'and what it keeps turning up puts the instruction that would clear it on the list: "' + RULE_TEXT.dowelsOut + '" and "' + RULE_TEXT.roughOut + '" (a way out of a bin full of junk)', joined);
  h = hunt(['dowels', 'rough', 'plank', 'dowels'], { slip: [false, true, true], find: [false, false, true], price: ['fair'] }, x => take(x, 'sold').length > 0);
  ok(h.r.record.looking === 2 && take(h.t, 'sold').length === 1 && take(h.t, 'sold')[0].item === 'plank' && h.t.bin.join() === 'dowels,rough,dowels' && h.t.force.slip.join() === 'true,true' && !h.t.force.find.length,
    'two reaches turn up something else, the third a plank, which it sells; the rest stay where they are, and it decided once for that sale whether to follow the instruction (one slip die for the whole hunt, not one a reach)', 'looking ' + h.r.record.looking + ', bin ' + h.t.bin.join() + ', slip left ' + h.t.force.slip.join());
  // the seller's recycle instructions: what it turns up goes in the recycle bin, never back
  h = hunt(['dowels', 'rough', 'largePlank'], { slip: [false, false, false, false], turnup: ['rough', 'dowels'] }, x => !x.bin.length && x.robots[1].state === 'idle', SELLERS);
  const outs = take(h.t, 'recycled');
  ok(!h.t.bin.length && outs.map(e => e.item).join() === 'rough,dowels,largePlank' && outs.every(e => e.from === 'bin' && e.by === 1) && !take(h.t, 'looking').length && !take(h.t, 'sold').length && h.r.tally.good === 3 && h.r.record['recycle:dowels'] === 1 && !h.t.force.slip.length && h.t.money === h.m0,
    'told to put dowel rods, gnarled planks and large planks in the recycle bin, a seller hunting for planks clears each thing it turns up instead of putting it back: the sale bin empties, all green', outs.map(e => e.item).join() + ' / bin ' + h.t.bin.join());
  h = hunt(['dowels', 'plank'], { slip: [false], price: ['fair'] }, x => take(x, 'sold').length > 0, ['dowelsOut']);
  ok(take(h.t, 'recycled').length === 1 && take(h.t, 'recycled')[0].item === 'dowels' && take(h.t, 'sold')[0].item === 'plank' && !h.t.force.slip.length, 'without "only sell" it takes the next thing as always, and the dowels it is told to recycle go in the recycle bin, not to a customer');
  h = hunt(['dowels'], { slip: [false, true, false] }, x => take(x, 'recycled').length > 0, ['sellOnly', 'dowelsOut']);
  ok(h.r.record['looking!'] === 1 && h.r.record['recycle:dowels'] === 1 && F.gradeOf('looking!') === 'soso', 'a slip on a recycle instruction puts the thing back (a "looking for plank" against its instructions), and the next reach clears it');
  let r = sale('plank', { slip: [false], price: ['free'] }, undefined, ['price']);
  ok(r.paid === 5 && r.e.sale === 'fair', '"' + RULE_TEXT.price + '": a plank goes for $5 even on a day the seller would have given it away');
  // the slip: 1 time in 20 it does what it would have done anyway
  s = opCycle('gnarled', { slip: [true] }, ['gnarled']);
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'rough' && !take(s, 'recycled').length && s.robots[0].record['rough!'] === 1 && !s.robots[0].record.rough, 'on a slip the instruction is ignored: the gnarled log goes in anyway, and its evals say it was against its instructions', JSON.stringify(s.robots[0].record));
  r = sale('rough', { slip: [true], mislabel: [true] }, undefined, ['sellOnly']);
  ok(r.e && r.e.sale === 'mislabel' && !r.s.robots[1].record.looking && r.s.robots[1].record['mislabel:rough!'] === 1 && r.s.robots[1].tally.bad === 1,
    'and a slipping seller does not hunt: it sells what comes next, can pass a gnarled plank off as a medium plank, and its evals say it did so against its instructions (red stays red)', JSON.stringify(r.s.robots[1].record));
  r = sale('rough', { slip: [true], mislabel: [false] }, undefined, ['sellOnly']);
  ok(r.s.robots[1].record['honest:rough!'] === 1 && r.s.robots[1].tally.soso === 1 && F.gradeOf('honest:rough') === 'good',
    'sold honestly on a slip it is a line of its own, yellow: "sold a gnarled plank" is green under the base prompt, and yellow once it was told to sell only medium planks (the CD\'s example)', JSON.stringify(r.s.robots[1].record));
  // the evals' colours (the CD, fourth brief): red only for a blocker or a hit to customer
  // satisfaction, yellow for anything unexpected or wasteful, green for what was asked; done
  // against its own instructions a green thing is yellow and a red thing stays red
  const reds = Object.keys(F.GRADE).filter(k => F.GRADE[k] === 'bad').sort().join();
  const G = k => F.gradeOf(k);
  ok(reds === 'mislabel,sap' && G('sap') === 'bad' && G('sap!') === 'bad' && G('mislabel:dowels') === 'bad' && G('free') === 'soso' && G('dowels') === 'soso' && G('largePlank') === 'soso' && G('looking') === 'soso' &&
    G('reject:small') === 'good' && G('recycle:rough') === 'good' && G('honest:rough') === 'good' && G('honest:rough!') === 'soso' && G('plank!') === 'soso', 'red only for a jam and for something passed off as a medium plank; giving a plank away, dowels and large planks yellow; done against its instructions, green turns yellow', reds);
  // resetting a robot's evals starts its counts again
  s = staffed(37, ['operate', 'sell']); run(s, 60);
  const before = Object.keys(s.robots[0].record).length;
  const reset = F.resetEvals(s, 0);
  ok(before > 0 && reset && !Object.keys(s.robots[0].record).length && s.robots[0].tally.good + s.robots[0].tally.soso + s.robots[0].tally.bad === 0 && s.robots[0].since === s.t && Object.keys(s.robots[1].record).length > 0 && take(s, 'evalsReset').length === 1 && !F.resetEvals(s, 7),
    'resetting a robot\'s evals empties its counts and starts its clock, and leaves the other robot\'s alone');
  run(s, 30);
  ok(Object.keys(s.robots[0].record).length > 0, 'and they fill again from there');
  // an instruction about another job does nothing: same dice, same day, exactly
  const day = rules => {
    const t = staffed(31, ['operate', 'sell']);
    if (rules) { instruct(t, 0, rules[0]); instruct(t, 1, rules[1]); }
    const log = [];
    for (let k = 0; k < 6000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'outcome' || e.kind === 'sold' || e.kind === 'recycled' || e.kind === 'looking') log.push(e.kind + ':' + (e.what || e.sale || e.item || '')); }); t.events = []; if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; } }
    return { log: log.join(), money: t.money, earned: t.earned, seed: t.seed };
  };
  const OPS = ['sappy', 'gnarled', 'medium', 'output'], SELLS = ['sellOnly', 'price', 'dowelsOut', 'largeOut', 'roughOut'];
  const plain = day(null), crossed = day([SELLS, OPS.concat('sap')]), right = day([OPS, SELLS]);
  ok(plain.log.length > 200 && crossed.log === plain.log && crossed.money === plain.money && crossed.seed === plain.seed, 'an instruction about the other robot\'s job does nothing: crossed wires play the same day as no instructions, roll for roll', plain.money + ' vs ' + crossed.money);
  const decoy = day([['sap'], []]);
  ok(decoy.log === plain.log && decoy.seed === plain.seed, 'and so does "' + RULE_TEXT.sap + '" on the operator: an instruction that prevents nothing plays the same day as none, roll for roll');
  ok(right.money > plain.money * 2, 'and the right instructions on the right robots keep over twice as much (with every jam cleaned the moment it happens)', right.money + ' vs ' + plain.money + ' kept, ' + right.earned + ' vs ' + plain.earned + ' earned');
  // an upstream instruction can keep a downstream mistake from ever happening: an operator told
  // about every bad log hands the seller nothing but planks, so the seller's "only sell planks"
  // never joins the list (no slips here, so the property is the instructions' and not the dice's)
  const upstream = rules => {
    const t = staffed(35, ['operate', 'sell']); if (rules) instruct(t, 0, rules);
    t.force.slip = many(false, 5000);
    let junk = 0, sold = 0;
    for (let k = 0; k < 12000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'binned' && e.item !== 'plank') junk++; if (e.kind === 'sold') sold++; }); t.events = []; if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; } }
    return { t, junk, sold };
  };
  const told = upstream(['sappy', 'gnarled', 'medium', 'output']), untold = upstream(null);
  ok(!told.junk && told.sold > 50 && !told.t.seen.sellOnly && untold.junk > 20 && untold.t.seen.sellOnly, 'an operator told about every bad log hands the seller only planks, so "' + RULE_TEXT.sellOnly + '" never joins the list; untold, it does within ten minutes', 'told: ' + told.junk + ' non-planks binned, ' + told.sold + ' sold; untold: ' + untold.junk + ' non-planks');
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
        if (e.kind === 'made') { const k = { plank: 'log', rough: 'gnarled', dowels: 'small', largePlank: 'large' }[e.item]; n.logs[k] = (n.logs[k] || 0) + 1; }
        if (e.kind === 'jam') n.logs.sappy = (n.logs.sappy || 0) + 1;
        if (e.kind === 'sold' && e.item === 'plank' && n.price[e.sale] !== undefined) { n.price[e.sale]++; if (lastOp) n.pairs.push([lastOp, e.sale]); }
      });
      s.events = [];
    }
    return n;
  };
  const within = (got, n, p) => Math.abs(got / n - p) <= 3.5 * Math.sqrt(p * (1 - p) / n) + 0.005;
  const a = measure(101, 3600);
  const logsN = F.LOGS.reduce((n, k) => n + (a.logs[k] || 0), 0);
  ok(logsN > 400 && ['gnarled', 'small', 'large', 'sappy'].every(k => within(a.logs[k] || 0, logsN, C.logs[k])), 'over real play the rack sends gnarled, small, large and sap logs at their rates', JSON.stringify(a.logs));
  const planks = a.price.fair + a.price.cheap + a.price.free;
  ok(planks > 1500 && within(a.price.free, planks, U.free) && within(a.price.cheap, planks, U.cheap), 'an uninstructed seller gives planks away and lets them go cheap at its rates', JSON.stringify(a.price));
  const pg = a.pairs.filter(p => p[0] === 'good'), pb = a.pairs.filter(p => p[0] === 'bad');
  const f1 = pg.filter(p => p[1] === 'fair').length / pg.length, f2 = pb.filter(p => p[1] === 'fair').length / pb.length;
  ok(pg.length > 100 && pb.length > 100 && Math.abs(f1 - f2) < 0.12, 'and the two robots roll their own dice: a plank sells as fairly after a good operator as after a bad one', (f1 * 100).toFixed(0) + '% vs ' + (f2 * 100).toFixed(0) + '%');
  // the slip, measured: an operator told to recycle gnarled logs feeds about 1 in 20 of them anyway
  // with the instruction, a gnarled log fed in shows up as a rough plank
  const fedRate = (() => {
    const s = staffed(107, ['operate', 'sell']); instruct(s, 0, ['gnarled', 'medium', 'sappy']);
    let fedN = 0, tossedN = 0;
    for (let t = 0; t < 7200; t += 0.05) {
      F.step(s, 0.05);
      if (s.machine.phase === 'jam') { s.machine.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0 }; }
      s.events.forEach(e => { if (e.kind === 'made' && e.item === 'rough') fedN++; if (e.kind === 'recycled' && e.from === 'in' && e.item === 'gnarled') tossedN++; });
      s.events = []; s.bin.length = 0;
    }
    return { fedN, n: fedN + tossedN };
  })();
  ok(fedRate.n > 150 && within(fedRate.fedN, fedRate.n, C.slip), 'over real play, an operator told to recycle gnarled logs still feeds ' + Math.round(C.slip * 100) + '% of them in (it slips)', fedRate.fedN + ' of ' + fedRate.n);
  // the hunt, measured: with one plank in four things, a reach finds a plank one time in four
  const findRate = (() => {
    const s = staffed(109, [null, 'sell']); instruct(s, 1, ['sellOnly']);
    let found = 0, looked = 0;
    for (let t = 0; t < 3600; t += 0.05) {
      if (s.bin.length !== 4 || s.bin.filter(k => k === 'plank').length !== 1) { s.bin.length = 0; s.bin.push('dowels', 'rough', 'plank', 'dowels'); }
      F.step(s, 0.05);
      s.events.forEach(e => { if (e.kind === 'looking') looked++; if (e.kind === 'sold' && e.item === 'plank') found++; });
      s.events = [];
    }
    return { found, n: found + looked };
  })();
  ok(findRate.n > 1000 && within(findRate.found, findRate.n, 0.25), 'over real play, a seller told to sell only planks finds one in a bin of four things with one plank in it one reach in four (planks / everything in the bin)', findRate.found + ' of ' + findRate.n);
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
    const bought = x.events.reduce((n, e) => n + (e.kind === 'hired' || e.kind === 'slot' ? e.price : 0), 0);
    if (!Number.isInteger(x.money) || x.money !== x.earned - x.spent - bought) worst = 'money ' + x.money + ' is not earned ' + x.earned + ' less logs ' + x.spent + ' and purchases ' + bought;
    else if (x.satisfaction < C.satMin || x.satisfaction > 100) worst = 'satisfaction ' + x.satisfaction;
    else if (!F.free(x, x.avatar.x, x.avatar.y)) worst = 'avatar inside something at ' + x.avatar.x.toFixed(2) + ',' + x.avatar.y.toFixed(2);
    else if (x.robots.some(r => !F.free(x, r.x, r.y))) worst = 'a robot inside something';
    else if (x.bin.some(k => F.ITEMS.indexOf(k) < 0)) worst = 'bin holds ' + x.bin.join();
    else if (['ready', 'run', 'jam'].indexOf(x.machine.phase) < 0 || F.LOGS.indexOf(x.machine.log) < 0) worst = 'machine ' + x.machine.phase + ' ' + x.machine.log;
    else if (x.robots.some(r => r.slots > C.slots.length || r.rules.length !== r.slots || r.rules.some(id => id !== null && !x.seen[id]) || new Set(r.rules.filter(Boolean)).size !== r.rules.filter(Boolean).length)) worst = 'a robot\'s instructions ' + JSON.stringify(x.robots.map(r => r.rules));
  });
  ok(!worst && s.robots.length >= 1 && s.spent > 0, 'over 300 random taps and page visits: money is always what was earned less what the logs, robots and slots cost, satisfaction in bounds, nobody walks into anything, the bin holds only things, instructions only ever seen ones, once each', worst || (s.robots.length + ' robots, $' + s.money + ', ' + JSON.stringify(s.robots.map(r => r.rules))));

  const a = play(F.newGame(8), 60), text = F.save(a), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(b && strip(a) === strip(b), 'a save loads back to the same factory, names and instructions included');
  run(a, 30); run(b, 30);
  ok(strip(a) === strip(b), 'and both carry on identically, robot luck included (the dice live in the save)');
  ok(F.load('{}') === null && F.load('nonsense') === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: C.version + 1 }))) === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: 1 }))) === null,
    'a save from another version (the prompt-lab factory included), or garbage, is not loaded');
  const h = staffed(41); instruct(h, 0, ['sap']);
  const raw = JSON.parse(F.save(h));
  Object.assign(raw, { money: 'lots', spent: -9, satisfaction: 400, seen: { bogus: true } });
  raw.robots[0].slots = 9; raw.robots[0].rules = ['sap', 'sap', 'nonsense', 'price']; raw.robots[0].name = 'x'.repeat(40);
  raw.machine.log = 'stone';
  const hacked = F.load(JSON.stringify(raw));
  ok(hacked && hacked.money === 0 && hacked.spent === 0 && hacked.satisfaction === 100 && hacked.robots[0].slots === 5 && hacked.robots[0].rules.join() === 'sap,,,price,' && hacked.robots[0].name.length === C.nameMax &&
    hacked.seen.price && !hacked.seen.bogus && hacked.machine.log === 'log',
    'a hand-edited save is clamped: money, what was spent, satisfaction, slots, a repeated or unknown instruction, a long name, an unknown log', hacked && JSON.stringify([hacked.money, hacked.spent, hacked.satisfaction, hacked.robots[0].slots, hacked.robots[0].rules, hacked.robots[0].name.length, hacked.seen, hacked.machine.log]));
  raw.money = -37;
  ok(F.load(JSON.stringify(raw)).money === -37, 'and money below zero is kept: logs cost money');
  // a save from before the sap barrel went: an operator out fetching sap, sap on the log, a seller
  // about to drop dowels in the recycle bin (a state this build has again)
  const old = staffed(43);
  const o = JSON.parse(F.save(old));
  Object.assign(o.robots[0], { state: 'sapGo', carry: 'sap', path: [{ x: 2, y: 4.6 }], rules: ['small', null], slots: 2 });
  Object.assign(o.robots[1], { state: 'drop', carry: 'dowels', sale: 'recycle' });
  Object.assign(o.machine, { phase: 'ready', staged: 1, log: 'log', sap: true });
  o.seen = { small: true, sap: true };
  delete o.spent; o.bin = ['plank'];
  delete o.robots[0].since;
  const back = F.load(JSON.stringify(o));
  ok(back && back.robots[0].state === 'idle' && !back.robots[0].carry && !back.robots[0].path.length && back.robots[1].state === 'drop' && back.robots[1].carry === 'dowels' && back.bin.join() === 'plank' && back.machine.log === 'sappy' && !('sap' in back.machine) && back.spent === 0 && back.robots[0].since === 0,
    'a save from before the barrel went loads: an operator caught mid-sap stands idle, a seller mid-drop finishes the drop, and a log with sap poured on it is a sap log', back && JSON.stringify([back.robots.map(r => r.state + ':' + r.carry), back.bin, back.machine.log]));
  o.robots[0].rules = [null, null];
  const listed = F.load(JSON.stringify(o));
  ok(back.robots[0].rules.join() === 'medium,' && back.seen.medium && !back.seen.small && back.seen.sap && listed.seen.medium && !listed.seen.small,
    'and an instruction from before "medium" (the bigger-than-1"x4"x4\' one) comes back as "' + RULE_TEXT.medium + '", in its slot and on the list (on the list even when no robot holds it)', JSON.stringify([back.robots[0].rules, back.seen, listed.seen]));
  until(back, x => x.machine.phase === 'jam', 30);
  ok(back.machine.phase === 'jam' && back.events.some(e => e.kind === 'press' && e.by === 0) && back.events.some(e => e.kind === 'recycled' && e.item === 'dowels' && e.by === 1), 'and it carries on from there: the dowels go in the recycle bin, and the operator ("only medium logs" says nothing about sap) feeds the sap log in and jams the machine', back.machine.phase);
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
