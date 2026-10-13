#!/usr/bin/env node
/**
 * drive-taas-factory.cjs — rules gate for TAAS's robot factory mode (pure node, ~2 s).
 *
 * The factory keeps its whole simulation in one DOM-free block in games/taas/index.html
 * (`const FACTORY = (function () { ... })()`), so the rules are checked here against that
 * block, lifted out of the page, with no browser: the floor and its paths, the manual loop
 * the CD described (tap the button, the avatar walks over and presses, four seconds, a plank
 * in the bin, sell it for $5), hiring at $20 and $40, the two jobs, every outcome a robot can
 * have and what it does, the odds at every prompt level as MEASURED over real play, trust and
 * prices, and saving. Numbers come from FACTORY.CFG, so a retune never turns this red.
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
const C = F.CFG, L = F.LAYOUT, SP = L.SPOT;

const run = (s, sec, dt) => { const h = dt || 0.05; for (let t = 0; t < sec - 1e-9; t += h) F.step(s, h); return s; };
const until = (s, pred, max) => { for (let t = 0; t < (max || 60); t += 0.05) { if (pred(s)) return true; F.step(s, 0.05); } return pred(s); };
const take = (s, kind) => { const e = s.events.filter(x => x.kind === kind); return e; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
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
  if (force) { s.force.operate.push.apply(s.force.operate, force.operate || []); s.force.sell.push.apply(s.force.sell, force.sell || []); }
  s.money = C.hire[0] + C.hire[1];
  (jobs || ['operate', 'sell']).forEach(job => {
    F.tap(s, { kind: 'dock' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'dock', 30);
    F.choose(s, 'hire'); if (job) F.choose(s, 'job:' + job);
  });
  return s;
}

/* ---------- 1. the tables ---------- */
{
  const ladder = [C.baseOdds].concat(C.prompt.map(p => p.odds));
  ok(ladder.every(o => o.length === 3 && o[0] + o[1] + o[2] === 100), 'every odds row is good / so-so / bad and adds to 100', JSON.stringify(ladder));
  ok(ladder.every((o, i) => i === 0 || (o[0] > ladder[i - 1][0] && o[2] < ladder[i - 1][2])), 'each prompt level raises the good share and cuts the bad one');
  ok(C.prompt.every((p, i) => i === 0 || p.price > C.prompt[i - 1].price), 'each prompt level costs more than the last', C.prompt.map(p => p.price).join());
  ok(C.hire.length === 2 && C.hire[0] === 20 && C.hire[1] === 40, 'two robots, at $20 and $40 (the CD\'s numbers)', C.hire.join());
  ok(C.processSec === 4 && C.price.plank === 5 && JSON.stringify(C.baseOdds) === '[25,35,40]', 'a plank takes 4 s and sells for $5, robots start 25 / 35 / 40 (the CD\'s numbers and answer)');
  ok(C.price.dowels <= 1 && C.price.rough < C.price.plank && C.mislabel === C.price.plank, 'dowels sell for $1 at most, a rough plank for less than a plank, dowels passed off as a plank at a plank\'s price');
}

/* ---------- 2. the floor ---------- */
{
  const s = F.newGame();
  const spots = ['start', 'press', 'operate', 'sap', 'sell', 'bin', 'dock', 'terminal'].map(k => Object.assign({ k }, SP[k]));
  ok(onFree(s, spots.filter(p => p.k !== 'sap').concat([])) && F.free(s, SP.sap.x, SP.sap.y), 'every spot stands on free floor', spots.filter(p => !F.free(s, p.x, p.y)).map(p => p.k).join());
  const bad = [];
  spots.forEach(a => spots.forEach(b => {
    if (a === b) return;
    const p = F.path(s, a, b);
    if (!p.length && dist(a, b) > 1e-6) bad.push(a.k + '>' + b.k + ' none');
    else if (p.length && (dist(p[p.length - 1], b) > 0.15 || !segFree(s, a, p))) bad.push(a.k + '>' + b.k);
  }));
  ok(!bad.length, 'every spot can walk to every other without crossing anything solid', bad.slice(0, 6).join(', '));
  const inside = F.path(s, SP.start, { x: 2.8, y: 2.9 });   // the middle of machine 01
  const end = inside[inside.length - 1];
  ok(inside.length > 0 && F.free(s, end.x, end.y) && dist(end, { x: 2.8, y: 2.9 }) < 1.3 && segFree(s, SP.start, inside), 'a tap on a solid thing walks to the nearest free floor beside it', end ? end.x.toFixed(2) + ',' + end.y.toFixed(2) : 'no path');
  const behind = F.path(s, SP.start, { x: 3.0, y: 1.2 });   // the strip behind the line, closed at both ends
  ok(behind.length > 0 && behind[behind.length - 1].y > 3.3 && segFree(s, SP.start, behind), 'a tap on floor nobody can reach walks to the nearest floor that can be reached', behind.length ? behind[behind.length - 1].y.toFixed(2) : 'no path');
  const c = L.CRATES[0], mid = { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 };
  const t = staffed(1, [null]);
  ok(!F.free(s, mid.x, mid.y) && F.free(t, mid.x, mid.y), 'a robot\'s crate blocks the floor until it is hired and unpacked');
}

/* ---------- 3. the manual loop the CD described ---------- */
{
  const s = F.newGame();
  ok(s.money === 0 && s.trust === 100 && F.ready(s) && !s.robots.length && !s.bin.length, 'a new factory: $0, full trust, machine 01 ready, no robots');
  F.tap(s, { kind: 'machine' });
  const walked = s.avatar.path.length > 0;
  until(s, x => x.machine.phase === 'run', 10);
  const atBtn = dist(s.avatar, SP.press) < 0.05;
  const pressT = s.t;
  let dark = true, t0 = s.t;
  while (s.machine.phase === 'run') { F.step(s, 0.05); if (F.ready(s)) dark = false; }
  const took = s.t - pressT;
  ok(walked && atBtn && Math.abs(took - C.processSec) < 0.06 && dark, 'tapping the button from afar walks the avatar over, it presses, and the machine runs ' + C.processSec + ' s with the button out of action', [walked, atBtn, took.toFixed(2)].join());
  // the next log rolls in from the rack before the button lights again
  ok(!F.ready(s) && s.machine.staged < 0.2, 'right after a cut the button stays dark while the next log rolls in', s.machine.staged.toFixed(2));
  const r0 = s.t; until(s, x => F.ready(x), 5);
  ok(Math.abs(s.t - r0 - C.stageSec) < 0.12, 'and lights after ' + C.stageSec + ' s', (s.t - r0).toFixed(2));
  const made = take(s, 'made');
  until(s, x => x.bin.length > 0, 5);
  ok(made.length === 1 && made[0].item === 'plank' && s.bin.join() === 'plank' && Math.abs(s.t - pressT - C.processSec - C.outSec - C.dropSec) < 0.1,
    'one smooth plank rides the out-feed belt and drops into the bin', s.bin.join() + ' at +' + (s.t - pressT).toFixed(2));

  // near the button: no walk, just a press
  s.events = [];
  s.avatar.x = SP.press.x + 0.4;   // near the button, not on its spot
  F.tap(s, { kind: 'machine' });
  ok(!s.avatar.path.length && s.avatar.act && s.avatar.act.kind === 'press' && s.avatar.x === SP.press.x + 0.4, 'tapping the button from close by presses without a walk');
  until(s, x => x.machine.phase === 'run', 2);
  F.tap(s, { kind: 'machine' }); run(s, 1);
  ok(take(s, 'press').length === 1, 'tapping it again while it runs does nothing (no second press, nothing queued)', take(s, 'press').length);

  // sell: the bin's chat bubble, one plank a tap
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
  const before = JSON.stringify([s.money, s.bin, s.trust]);
  ok(empty && !empty.enabled && !F.choose(s, 'sell:plank') && before === JSON.stringify([s.money, s.bin, s.trust]), 'with the bin empty the bill is greyed and a tap on it changes nothing');
  F.tap(s, { kind: 'floor', x: 3, y: 9 }); F.step(s, 0.05);
  const walking = !F.bubbleOpen(s) && !F.options(s).length;
  until(s, x => !x.avatar.path.length, 10);
  ok(walking && !F.bubbleOpen(s) && !F.options(s).length, 'walking away closes the bubble, and it stays closed on arrival somewhere else');
  // two more planks: $20, the price of the first robot
  for (let i = 0; i < 2; i++) { F.tap(s, { kind: 'machine' }); until(s, x => x.machine.phase === 'ready' && x.machine.staged >= 1 && !x.belt.length && take(x, 'binned').length >= 3 + i, 20); }
  F.tap(s, { kind: 'bin' }); until(s, x => !!F.bubbleOpen(x), 10);
  while (F.choose(s, 'sell:plank'));
  ok(s.money === 20 && s.tally.player.sold === 4, 'four planks sold by hand is $20', s.money);
}

/* ---------- 4. hiring ---------- */
{
  const s = F.newGame();
  s.money = 19;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 20);
  const poor = F.options(s)[0];
  ok(poor.id === 'hire' && !poor.enabled && poor.price === 20 && !F.choose(s, 'hire') && s.money === 19 && !s.robots.length, 'at $19 the dock shows the $20 robot greyed, and refuses');
  s.money = 20;
  ok(F.choose(s, 'hire') && s.money === 0 && s.robots.length === 1 && s.robots[0].state === 'unbox', 'at $20 a robot is hired and climbs out of its crate');
  const after = F.options(s);
  ok(F.bubbleOpen(s).kind === 'robot' && after.map(x => x.id).join() === 'job:operate,job:sell,job:rest', 'the bubble turns straight to the new robot\'s jobs: the button, selling, or rest', after.map(x => x.id).join());
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  ok(F.options(s)[0].price === 40, 'the second robot costs $40', F.options(s)[0].price);
  s.money = 40; F.choose(s, 'hire');
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  const out = F.options(s)[0];
  ok(s.robots.length === 2 && !out.enabled && out.soldOut && (s.money = 999) && !F.choose(s, 'hire') && s.robots.length === 2, 'after two there are no more to hire, whatever the money');
}

/* ---------- 5. jobs ---------- */
{
  const s = staffed(3, ['operate', null], { operate: ['plank'] });
  const [op, two] = s.robots;
  until(s, x => dist(op, SP.operate) < 0.07, 20);
  ok(dist(op, SP.operate) < 0.07, 'a robot sent to the button goes and stands at it', op.x.toFixed(2) + ',' + op.y.toFixed(2));
  until(s, x => take(x, 'made').length > 0, 20);
  ok(take(s, 'press')[0].by === op.id && take(s, 'made')[0].by === op.id, 'and runs machine 01 itself');
  // never a press on a running machine: count presses against cycles over a long run
  s.events = []; s.force.operate.push('plank', 'plank', 'plank', 'plank', 'plank', 'plank');
  run(s, 30);
  const presses = take(s, 'press').length, madeN = take(s, 'made').length;
  ok(presses >= 4 && Math.abs(presses - madeN) <= 1, 'one press per cycle: a robot never presses a running machine', presses + ' presses, ' + madeN + ' made');
  // swapping: the other robot takes the button, the first goes where the other was
  F.tap(s, { kind: 'robot', id: two.id }); until(s, x => !!F.bubbleOpen(x), 20);
  F.choose(s, 'job:operate');
  ok(two.job === 'operate' && op.job === null, 'giving a robot a job someone has swaps them (the other gets its old job)', op.job + '/' + two.job);
  until(s, x => op.state === 'idle' && dist(op, SP.rest[op.id]) < 0.07, 30);
  ok(dist(op, SP.rest[op.id]) < 0.07, 'a robot sent to rest goes back to its charging pad');
  // a seller pulled off the job mid-sale puts the thing back
  const t = staffed(5, [null, 'sell']);
  const seller = t.robots[1];
  until(t, x => dist(seller, SP.sell) < 0.07, 30);
  F.tap(t, { kind: 'robot', id: seller.id }); until(t, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'robot', 20);
  t.bin.push('plank');
  until(t, x => seller.state === 'pitch', 10);
  const held = seller.carry, bin0 = t.bin.length, money0 = t.money;
  F.choose(t, 'job:rest');
  ok(held === 'plank' && !seller.carry && t.bin.length === bin0 + 1 && t.money === money0, 'a seller taken off the job mid-sale puts the plank back in the bin', held + ' ' + bin0 + '>' + t.bin.length);
}

/* ---------- 6. what each outcome does ---------- */
// one operator cycle with its outcome forced (queued before the robot is hired: it rolls the
// moment it reaches the button)
function opCycle(plan) {
  const s = staffed(11, ['operate', null], { operate: [plan] });
  s.events = [];
  return s;
}
{
  let s = opCycle('plank');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'plank' && s.robots[0].tally.good === 1 && s.robots[0].mood === 'good', 'good operator: a smooth plank, and a good mark on its tally');

  s = opCycle('slow');
  until(s, x => dist(x.robots[0], SP.operate) < 0.07, 20);
  const t0 = s.t;
  until(s, x => take(x, 'press').length > 0, 10);
  until(s, x => x.bin.length > 0, 20);
  const pressedAfter = take(s, 'press')[0].t - t0;
  ok(pressedAfter >= C.dawdleSec && s.bin.join() === 'plank' && s.robots[0].tally.soso === 1, 'so-so operator (slow): stands and thinks ' + C.dawdleSec + ' s, then a plank', pressedAfter.toFixed(2));
  // while it thinks, you press: its own press must not restart your cut
  s = opCycle('slow');
  until(s, x => x.robots[0].state === 'dawdle', 20);
  s.avatar.x = SP.press.x; s.avatar.y = SP.press.y;
  F.tap(s, { kind: 'machine' });
  until(s, x => x.machine.phase === 'run', 2);
  const myRun = s.machine.t;
  until(s, x => x.robots[0].state !== 'dawdle' && x.robots[0].state !== 'press', 6);
  ok(take(s, 'press').length === 1 && s.machine.by === 'player' && s.machine.phase === 'run' && s.machine.t > myRun, 'a robot that presses a machine you already started does nothing to your cut', take(s, 'press').length + ' presses, by ' + s.machine.by);

  s = opCycle('rough');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'rough' && s.robots[0].tally.soso === 1, 'so-so operator (rough): a rough plank', s.bin.join());

  s = opCycle('dowels');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'dowels' && s.robots[0].tally.bad === 1, 'bad operator: a log in, dowel rods out', s.bin.join());

  s = opCycle('sap');
  const fetched = until(s, x => x.robots[0].carry === 'sap', 10);
  until(s, x => x.machine.phase === 'jam', 10);
  const jammedAt = s.t;
  run(s, 60);
  ok(fetched && s.machine.phase === 'jam' && !s.bin.length && !take(s, 'made').length && s.robots[0].tally.bad === 1,
    'bad operator (sap): fetches sap, pours it in, the machine gums up and stays jammed (60 s later, no robot has fixed it)', s.machine.phase);
  ok(s.robots[0].mood === 'stuck' && s.robots[0].state === 'idle', 'and the operator just stands there, stuck');
  F.tap(s, { kind: 'machine' });
  until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c0 = s.t;
  until(s, x => x.machine.phase !== 'jam', 10);
  ok(s.machine.phase === 'ready' && Math.abs(s.t - c0 - C.cleanSec) < 0.11 && take(s, 'cleaned').length === 1, 'tapping the machine walks you over to scrub it clean, which takes ' + C.cleanSec + ' s', (s.t - c0).toFixed(2));
  // an interrupted scrub keeps its progress
  s = opCycle('sap'); until(s, x => x.machine.phase === 'jam', 20);
  F.tap(s, { kind: 'machine' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  run(s, C.cleanSec / 2);
  F.tap(s, { kind: 'floor', x: 3, y: 6 }); run(s, 2);
  const half = s.machine.dirt;
  F.tap(s, { kind: 'machine' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c1 = s.t; until(s, x => x.machine.phase !== 'jam', 10);
  ok(half > 0.3 && half < 0.7 && s.t - c1 < C.cleanSec * 0.65, 'walking away mid-scrub keeps the half already done', half.toFixed(2));
  // the player's own press on a sapped belt jams too: the sap is in the machine, not in the hand
  s = opCycle('sap');
  until(s, x => x.machine.load === 'sap' || x.machine.phase === 'run', 20);
  ok(s.machine.load === 'sap', 'poured sap waits on the belt for whoever presses next');
}
function sale(item, grade, trust) {
  // trust heals a little every second, so a row that sets it holds it there until the sale
  const s = staffed(13, [null, 'sell']);
  if (trust !== undefined) s.trust = trust;
  until(s, x => x.robots[1].state === 'idle' && dist(x.robots[1], SP.sell) < 0.07, 20);
  s.events = []; s.bin.push(item); s.force.sell.push(grade);
  const m0 = s.money, t0 = trust !== undefined ? trust : s.trust;
  let trustAt = s.trust;
  until(s, x => { if (trust !== undefined && !take(x, 'sold').length) { x.trust = trust; } trustAt = x.trust; return take(x, 'sold').length > 0; }, 10);
  const e = take(s, 'sold')[0];
  e.trustAt = trust !== undefined ? trust : trustAt;
  return { paid: s.money - m0, dt: s.trust - t0, e, s };
}
{
  let r = sale('plank', 'good');
  ok(r.paid === 5 && r.e.sale === 'fair', 'good seller: a plank for full price', r.paid);
  r = sale('plank', 'soso');
  ok(r.paid === C.soso.plank && r.e.sale === 'cheap', 'so-so seller: lets a plank go for $' + C.soso.plank, r.paid);
  r = sale('plank', 'bad');
  ok(r.paid === 0 && r.e.sale === 'free' && r.dt === 0, 'bad seller: gives a good plank away for $0', r.paid);
  r = sale('dowels', 'bad');
  ok(r.paid === 5 && r.dt <= -C.trustHit + 0.5 && r.dt > -C.trustHit - 0.01 && r.e.sale === 'mislabel', 'bad seller: sells dowel rods as a plank for $5, and customer trust drops ' + C.trustHit, r.paid + ' / ' + r.dt.toFixed(2));
  r = sale('dowels', 'good');
  ok(r.paid === C.price.dowels, 'good seller: dowels at their own price, $' + C.price.dowels, r.paid);
  r = sale('rough', 'good');
  ok(r.paid === C.price.rough, 'good seller: a rough plank at its own price, $' + C.price.rough, r.paid);
  r = sale('plank', 'good', 70);
  ok(r.paid === Math.round(5 * r.e.trustAt / 100) && r.paid === 4 && r.dt >= C.trustUp && r.dt < C.trustUp + 1, 'trust sets the price: at 70% trust a plank fetches $4, and a fair sale wins a point back', r.paid + ' / ' + r.dt.toFixed(2));
  r = sale('dowels', 'bad', C.trustMin + 3);
  ok(r.s.trust >= C.trustMin && r.s.trust < C.trustMin + 0.5, 'trust never drops below ' + C.trustMin + '%', r.s.trust.toFixed(2));
  r = sale('plank', 'good', 100);
  ok(r.s.trust === 100, 'and never rises above 100%');
  const q = F.newGame(); q.trust = 40; run(q, 60);
  const want = 100 - 60 * Math.exp(-C.trustHeal * 60);
  ok(q.trust > 40 && Math.abs(q.trust - want) < 0.5, 'customers forget: a minute with no sales heals trust from 40% toward 100%', q.trust.toFixed(1) + ' vs ' + want.toFixed(1));
  // the player always sells fairly, whatever the odds, and at trust's price
  const s = F.newGame(); s.bin.push('dowels', 'rough', 'plank'); s.trust = 50;
  F.tap(s, { kind: 'bin' }); until(s, x => !!F.bubbleOpen(x), 10);
  const opts = F.options(s);
  const got = ['sell:dowels', 'sell:rough', 'sell:plank'].map(id => { const m = s.money; F.choose(s, id); return s.money - m; });
  ok(opts.map(o => o.id).join() === 'sell:plank,sell:rough,sell:dowels' && got.join() === [1, 3, 5].map(p => Math.round(p * 0.5)).join(),
    'selling by hand: one button per kind of thing in the bin, each at its fair price times trust', opts.map(o => o.id + '=' + o.price).join() + ' got ' + got.join());
}

/* ---------- 7. the odds, measured over real play at every prompt level ---------- */
{
  const measure = (level, n) => {
    const s = staffed(100 + level, ['operate', 'sell']);
    s.prompt = level;
    const tally = { operate: { good: 0, soso: 0, bad: 0 }, sell: { good: 0, soso: 0, bad: 0 } }, pairs = [];
    let lastOp = null;
    for (let t = 0; t < n; t += 0.05) {
      F.step(s, 0.05);
      if (s.machine.phase === 'jam') { s.machine.phase = 'ready'; s.machine.staged = 0; s.machine.load = 'log'; s.machine.dirt = 0; }   // an instant cleaner
      if (s.bin.length < 3) s.bin.push('plank');                                                                       // the seller never runs dry
      s.events.forEach(e => {
        if (e.kind !== 'outcome') return;
        tally[e.job][e.grade]++;
        if (e.job === 'operate') lastOp = e.grade; else if (lastOp) { pairs.push([lastOp, e.grade]); }
      });
      s.events = [];
    }
    return { tally, pairs };
  };
  const bad = [], seen = [];
  let pairsAll = [];
  [0, 1, 2, 3].forEach(level => {
    const want = level ? C.prompt[level - 1].odds : C.baseOdds;
    const r = measure(level, 6000);
    ['operate', 'sell'].forEach(job => {
      const t = r.tally[job], n = t.good + t.soso + t.bad;
      const got = ['good', 'soso', 'bad'].map(g => t[g] / n * 100);
      seen.push('L' + level + ' ' + job + ' n=' + n + ' ' + got.map(x => x.toFixed(0)).join('/'));
      got.forEach((g, i) => { const sd = 100 * Math.sqrt(want[i] / 100 * (1 - want[i] / 100) / n); if (Math.abs(g - want[i]) > Math.max(3.5 * sd, 1)) bad.push('L' + level + ' ' + job + ' ' + ['good', 'soso', 'bad'][i] + ' ' + g.toFixed(1) + ' vs ' + want[i]); });
    });
    if (level === 0) pairsAll = r.pairs;
  });
  if (process.env.TAAS_VERBOSE) console.log('  ' + seen.join('\n  '));
  ok(!bad.length, 'over real play, each robot\'s good / so-so / bad shares match the odds at every prompt level', bad.join('; ') || seen.join(' | '));
  // independence: the seller's grade does not lean on the operator's last one
  const pg = pairsAll.filter(p => p[0] === 'good'), pb = pairsAll.filter(p => p[0] === 'bad');
  const g1 = pg.filter(p => p[1] === 'good').length / pg.length, g2 = pb.filter(p => p[1] === 'good').length / pb.length;
  ok(pg.length > 100 && pb.length > 100 && Math.abs(g1 - g2) < 0.12, 'and the two robots\' chances are independent (a good seller is as likely after a good operator as after a bad one)', (g1 * 100).toFixed(0) + '% vs ' + (g2 * 100).toFixed(0) + '%');
}

/* ---------- 8. prompt engineering ---------- */
{
  const s = F.newGame(); s.money = 999;
  F.tap(s, { kind: 'terminal' }); until(s, x => !!F.bubbleOpen(x), 20);
  const locked = F.options(s)[0];
  ok(locked.id === 'prompt' && locked.locked && !locked.enabled && !F.choose(s, 'prompt') && s.prompt === 0, 'the prompt terminal is locked until both robots are on staff');
  const t = staffed(17); t.money = 0;
  F.tap(t, { kind: 'terminal' }); until(t, x => !!F.bubbleOpen(x), 20);
  const o = F.options(t)[0];
  ok(!o.locked && o.price === C.prompt[0].price && !o.enabled, 'with both hired it asks $' + C.prompt[0].price + ' and waits for the money', JSON.stringify(o));
  const paid = [];
  t.money = 10000;
  for (let i = 0; i < 4; i++) { const m = t.money; if (F.choose(t, 'prompt')) paid.push(m - t.money); }
  ok(paid.join() === C.prompt.map(p => p.price).join() && t.prompt === C.prompt.length && JSON.stringify(F.odds(t)) === JSON.stringify(C.prompt[C.prompt.length - 1].odds) && F.options(t)[0].max,
    'each level costs its price and replaces the odds, up to level ' + C.prompt.length + ', then no more', paid.join());
}

/* ---------- 9. saving, determinism and the bounds, over seeded random play ---------- */
{
  const rnd = (seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })(99);
  const TAPS = ['machine', 'bin', 'dock', 'terminal', 'floor', 'robot'];
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
    else if (x.trust < C.trustMin || x.trust > 100) worst = 'trust ' + x.trust;
    else if (!F.free(x, x.avatar.x, x.avatar.y)) worst = 'avatar inside something at ' + x.avatar.x.toFixed(2) + ',' + x.avatar.y.toFixed(2);
    else if (x.robots.some(r => !F.free(x, r.x, r.y))) worst = 'a robot inside something';
    else if (x.bin.some(k => F.ITEMS.indexOf(k) < 0)) worst = 'bin holds ' + x.bin.join();
    else if (['ready', 'run', 'jam'].indexOf(x.machine.phase) < 0) worst = 'machine ' + x.machine.phase;
  });
  ok(!worst && s.robots.length >= 1, 'over 300 random taps: money never negative, trust in bounds, nobody walks into anything, the bin holds only things', worst || (s.robots.length + ' robots, $' + s.money));

  const a = play(F.newGame(8), 40), text = F.save(a), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(b && strip(a) === strip(b), 'a save loads back to the same factory');
  run(a, 30); run(b, 30);
  ok(strip(a) === strip(b), 'and both carry on identically, robot luck included (the dice live in the save)');
  ok(F.load('{}') === null && F.load('nonsense') === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: C.version + 1 }))) === null, 'a save from another version, or garbage, is not loaded');
  const hacked = F.load(JSON.stringify(Object.assign(F.newGame(), { money: -50, prompt: 9, trust: 400 })));
  ok(hacked && hacked.money === 0 && hacked.prompt === C.prompt.length && hacked.trust === 100, 'a hand-edited save is clamped into range', hacked && [hacked.money, hacked.prompt, hacked.trust].join());
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
