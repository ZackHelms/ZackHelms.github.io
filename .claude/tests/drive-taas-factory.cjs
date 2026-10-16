#!/usr/bin/env node
/**
 * drive-taas-factory.cjs — rules gate for TAAS's robot factory mode (pure node, ~5 s).
 *
 * The factory keeps its whole simulation in one DOM-free block in games/taas/index.html
 * (`const FACTORY = (function () { ... })()`), so the rules are checked here against that
 * block, lifted out of the page, with no browser. Since the storefront brief (the CD,
 * 2026-10-15): wood with a size and a quality, the planer (once machine01) and its output bin,
 * the sales counter that sells by itself to customers who walk in from the left, queue, pay
 * the stall's $4 times customer satisfaction and cost 0.1% a second each while they wait, your
 * arms (pick a bin up, stock the counter, put things in and take them out of the recycle bin),
 * the $5 to scrub a jam, the stocker robot and its instructions, slots 02-04 (the table saw,
 * the sap extractor, the hand crafting bench), hiring, the two jobs, every mistake a robot can
 * make and what it does, the instruction list and its slots, the 1-in-20 slip, an instruction
 * about another job doing nothing, the rates as MEASURED over real play, saving, and the delay
 * between tasks (the CD, 2026-10-16: an instruction for every robot, on the list from the start,
 * holding 0-60 whole seconds).
 * Numbers come from FACTORY.CFG, so a retune never turns this red, except where the CD set them.
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
const C = F.CFG, L = F.LAYOUT, SP = L.SPOT, U = C.uninstructed, P = C.shop;

const run = (s, sec, dt) => { const h = dt || 0.05; for (let t = 0; t < sec - 1e-9; t += h) F.step(s, h); return s; };
const until = (s, pred, max) => { for (let t = 0; t < (max || 60); t += 0.05) { if (pred(s)) return true; F.step(s, 0.05); } return pred(s); };
const take = (s, kind) => s.events.filter(x => x.kind === kind);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const many = (v, n) => Array(n || 60).fill(v);
const count = (arr, k) => arr.filter(x => x === k).length;
const STOCKERS = ['stockOnly', 'smallOut', 'largeOut', 'roughOut'];
// the dice, made quiet: normal medium logs, no thinking, no customers (each queue is what the
// next rolls of that name come up)
const calm = () => ({ log: many('log.m'), think: many(false) });
const shut = s => { s.shop.next = 1e9; return s; };   // nobody comes in
// the planer's input bin holds just these logs, none of them yours (the next to roll in first);
// once they are gone it restocks, and the restock's logs are the 'log' dice
const feed = (s, logs) => { s.rack = logs.slice(); s.rackMine = 0; return s; };
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
  if (force) Object.keys(force).forEach(k => { if (k === 'log') feed(s, force.log); else s.force[k] = (s.force[k] || []).concat(force[k]); });
  s.money = C.hire[0] + C.hire[1];
  (jobs || ['operate', 'stock']).forEach(job => {
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
// the CD's words: the fourth brief's, and with the storefront the stocker's
const RULE_TEXT = {
  sap: 'Never put sap on input log', sappy: 'Put sap logs in recycle bin', gnarled: 'Put gnarled logs in recycle bin',
  medium: 'Only input medium logs', smallLog: 'Put small logs in recycle bin', largeLog: 'Put large logs in recycle bin', mediumLog: 'Put medium logs in recycle bin',
  output: 'Only output medium wood planks', stockOnly: 'Only stock medium planks', price: 'Sell medium wood planks for $4',
  smallOut: 'Put small planks in recycle bin', largeOut: 'Put large planks in recycle bin', roughOut: 'Put gnarled planks in recycle bin',
  delay: 'Wait between tasks'   // the delay (the CD, 2026-10-16; the wording assumed)
};
// the instructions on the list that a mistake put there (the delay is on it from the start)
const learnt = s => F.known(s).filter(q => !q.start).map(q => q.id).join();
// customers standing in the shop, as if they had walked in: in line, place 0 at the stall
function queue(s, n) {
  for (let k = 0; k < n; k++) s.shop.people.push({ id: s.shop.n++, x: L.SHOP.x0 - k * P.gap, y: L.SHOP.lineY, state: 'in', t: 0, stall: 0, item: null, by: null, wrong: false });
  return s;
}

/* ---------- 1. the tables ---------- */
{
  ok(C.hire.length === 2 && C.hire[0] === 20 && C.hire[1] === 40, 'two robots, at $20 and $40 (the CD\'s numbers)', C.hire.join());
  ok(C.processSec === 4 && F.priceOf('plank.m') === 4, 'a plank takes 4 s and a medium plank sells for $4 (the CD, 2026-10-15: down from $5)', F.priceOf('plank.m'));
  const cut = z => ['b2x4', 'b2x2', 'dowels'].map(c => F.priceOf(c + '.' + z));
  ok(F.priceOf('plank.s') === 2 && F.priceOf('plank.l') === 8 && F.priceOf('sap') === 1 && cut('s').join() === '3,3,3' && cut('m').join() === '6,6,6' && cut('l').join() === '12,12,12',
    'the CD\'s prices: planks $2 / $4 / $8 by length, sap $1, and two 2"x4"s, four 2"x2"s or sixteen dowel rods $3 / $6 / $12 by the length they came from', [F.priceOf('plank.s'), F.priceOf('plank.l'), F.priceOf('sap')].concat(cut('s'), cut('l')).join());
  ok(C.stalls.length === 1 && C.stalls[0].want === 'plank.m', 'for now only medium planks are sold: the counter has one stall, for medium planks (the CD)');
  ok(C.logCost === 0.1 && C.fixCost === 5 && C.sawCost === 0.1 && C.extractCost === 0.1, 'every machine costs $0.10 for each thing it processes, the planer, the table saw and the sap extractor (electricity and wear, the CD 2026-10-16), and fixing a sap jam $5', [C.logCost, C.fixCost, C.sawCost, C.extractCost].join());
  const fl = ['log.s', 'sappy.l', 'plank.s', 'plank.l', 'rough.m', 'b2x4.s', 'dowels.l', 'sap', 'carving.owl'].map(F.floorOf);
  ok(fl.join() === '1,1,1.1,1.1,1.1,1.2,1.2,0.1,1' && C.floor.plank === F.cents(C.floor.log + C.logCost) && C.floor.cut === F.cents(C.floor.plank + C.sawCost),
    'what each thing cost to make, the least it ever sells for: a log $1, any plank $1.10 and any cut $1.20 (the CD\'s numbers: a log and the machines\' runs), sap $0.10, a carving $1', fl.join());
  ok(C.satWait === 0.1 && C.shop.max >= 4, 'each customer waiting costs 0.1% of customer satisfaction a second (the CD\'s number), and the shop holds a line of ' + P.max);
  ok(JSON.stringify(C.slots) === '[5,10,15,20,25]' && C.slots.reduce((a, b) => a + b, 0) * C.hire.length === 150, 'instruction slots cost $5 / $10 / $15 / $20 / $25 for each robot (the CD\'s numbers)', C.slots.join());
  ok(F.RULES.length === 14 && F.RULES.every(q => RULE_TEXT[q.id] === q.text), 'the instruction pool is fourteen, word for word', F.RULES.map(q => q.text).join(' | '));
  ok(F.RULES.filter(q => q.job === 'operate').map(q => q.id).join() === 'sap,sappy,gnarled,medium,smallLog,largeLog,mediumLog,output' && F.RULES.filter(q => q.job === 'stock').map(q => q.id).join() === 'stockOnly,price,smallOut,largeOut,roughOut' && F.RULES.filter(q => q.job !== 'operate' && q.job !== 'stock').map(q => q.id).join() === 'delay', 'eight are about running the planer, five about stocking the counter, and one, the delay, about every job');
  // wood has two dimensions (the CD): every size of every quality
  ok(F.LOGS.length === 9 && F.SIZES.join() === 's,m,l' && ['log', 'gnarled', 'sappy'].every(q => F.SIZES.every(z => F.LOGS.indexOf(q + '.' + z) >= 0)), 'a log has a size (small, medium, large) and a quality (normal, gnarled, sappy): nine kinds', F.LOGS.join());
  ok(F.SIZES.every(z => F.makes('log.' + z) === 'plank.' + z && F.makes('gnarled.' + z) === 'rough.' + z && F.makes('sappy.' + z) === 'jam'), 'the planer makes a normal log a plank of its size, a gnarled one a gnarled plank of its size, and any sap log jams it (the CD)');
  const sz = C.logs.size, ql = C.logs.quality;
  ok(Math.abs(sz.s + sz.m + sz.l - 1) < 1e-9 && Math.abs(ql.log + ql.gnarled + ql.sappy - 1) < 1e-9 && sz.m * ql.log >= 0.4 && ql.sappy > 0 && ql.gnarled > 0 && sz.s > 0 && sz.l > 0 && U.think > 0 && U.think < 1, 'every size and quality comes off the rack, and a good share of the logs are normal medium ones');
  // a valid path exists: every log but a normal medium one has an operator instruction that keeps
  // it out, and everything the planer can put in its output bin but a medium plank has a stocker
  // instruction that clears it
  const bad = F.LOGS.filter(k => k !== 'log.m'), junk = F.PRODUCTS.filter(k => k !== 'plank.m');
  const kept = bad.filter(k => F.keepers(k).length > 0);
  const cleared = junk.filter(k => F.RULES.some(q => q.job === 'stock' && q.recycles && (!q.recycles.kind || q.recycles.kind.indexOf(F.kindOf(k)) >= 0) && (!q.recycles.size || q.recycles.size.indexOf(F.sizeOf(k)) >= 0)));
  const made = F.LOGS.map(F.makes).filter(k => k !== 'jam');
  ok(kept.length === bad.length && cleared.length === junk.length && made.every(k => F.PRODUCTS.indexOf(k) >= 0) && !F.keepers('log.m').length, 'every log but a normal medium one has an operator instruction that keeps it out of the planer, and everything the planer can bin but a medium plank has a stocker instruction that takes it out',
    'kept out: ' + kept.join() + '; cleared: ' + cleared.join());
  ok(F.BASE.operate === 'Use the planer to refine raw materials.' && F.BASE.stock === 'Stock the sales counter with the items in this bin.', 'the base prompts: "use the planer to refine raw materials" and "stock the sales counter with the items in this bin"');
  ok(C.slip > 0 && C.slip <= 0.1 && C.names.length >= C.hire.length && new Set(C.names).size === C.names.length, 'a robot slips on an instruction rarely (' + C.slip + '), and the robots start with names of their own');
}

/* ---------- 2. the floor ---------- */
{
  const s = F.newGame();
  const keys = Object.keys(SP).filter(k => k !== 'rest');
  const spots = keys.map(k => Object.assign({ k }, SP[k]));
  ok(onFree(s, spots), 'every spot stands on free floor', spots.filter(p => !F.free(s, p.x, p.y)).map(p => p.k).join());
  const bad = [];
  spots.forEach(a => spots.forEach(b => {
    if (a === b) return;
    const p = F.path(s, a, b);
    if (!p.length && dist(a, b) > 1e-6) bad.push(a.k + '>' + b.k + ' none');
    else if (p.length && (dist(p[p.length - 1], b) > 0.15 || !segFree(s, a, p))) bad.push(a.k + '>' + b.k);
  }));
  ok(!bad.length, 'every spot can walk to every other without crossing anything solid (' + spots.length + ' spots)', bad.slice(0, 6).join(', '));
  const toCounter = F.path(s, SP.press, SP.counter);
  ok(toCounter.some(p => p.x > L.SOLID.bin[2]) && segFree(s, SP.press, toCounter), 'the walkway by the counter is reached round the east end of the planer\'s row');
  const shop = F.path(s, SP.start, { x: 2.5, y: L.SHOP.lineY });   // the shop, behind the counter
  const end = shop[shop.length - 1];
  ok(shop.length > 0 && end.y > L.SOLID.counter[3] && segFree(s, SP.start, shop), 'the shop behind the counter is the customers\' own: a tap there walks you to the counter\'s factory side', end ? end.x.toFixed(2) + ',' + end.y.toFixed(2) : 'no path');
  const R = L.SOLID.recycle, mid = { x: (R[0] + R[2]) / 2, y: (R[1] + R[3]) / 2 };
  ok(!F.free(s, mid.x, mid.y) && dist(L.RECYCLE, mid) < 0.1 && dist(SP.press, mid) < 1.3 && dist(SP.operate, mid) < 2 && dist(SP.bin, mid) < 1.3, 'the recycle bin stands in front of the planer\'s out-feed, within reach of its button and its output bin');
  const rows = [L.ROW.planer, L.ROW.saw, L.ROW.extract, L.ROW.bench];
  ok(rows.every((y, i) => !i || y > rows[i - 1] + 2) && L.STALL.y1 <= L.SOLID.counter[3] && L.SHOP.lineY < L.SOLID.counter[1] && L.ROW.planer > L.SOLID.counter[3] + 1, 'from the back: the shop, the counter, the walkway, then slots 01 to 04 one under another');
  const c = L.CRATES[0], cm = { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 };
  const t = staffed(1, [null]);
  ok(!F.free(s, cm.x, cm.y) && F.free(t, cm.x, cm.y), 'a robot\'s crate blocks the floor until it is hired and unpacked');
}

/* ---------- 3. the planer by hand, your arms, and the counter ---------- */
{
  const s = feed(shut(F.newGame()), many('log.m'));
  ok(s.money === 0 && s.satisfaction === 100 && F.ready(s) && s.machine.log === 'log.m' && !s.robots.length && !s.bin.length && !s.avatar.inv.length && learnt(s) === '' && F.known(s).map(q => q.id).join() === 'delay',
    'a new factory: $0, customer satisfaction at 100%, a normal medium log on the planer, empty arms, no robots, and only the delay on the instruction list');
  F.tap(s, { kind: 'machine' });
  const walked = s.avatar.path.length > 0;
  until(s, x => x.machine.phase === 'run', 10);
  const atBtn = dist(s.avatar, SP.press) < 0.05, pressT = s.t;
  let dark = true;
  while (s.machine.phase === 'run') { F.step(s, 0.05); if (F.ready(s)) dark = false; }
  ok(walked && atBtn && Math.abs(s.t - pressT - C.processSec) < 0.06 && dark, 'tapping the planer from afar walks the avatar over, it presses, and the planer runs ' + C.processSec + ' s with the button out of action', [walked, atBtn, (s.t - pressT).toFixed(2)].join());
  const r0 = s.t; until(s, x => F.ready(x), 5);
  ok(Math.abs(s.t - r0 - C.stageSec) < 0.12, 'the button lights again ' + C.stageSec + ' s later, when the next log has rolled in', (s.t - r0).toFixed(2));
  until(s, x => x.bin.length > 0, 5);
  ok(s.bin.join() === 'plank.m' && Math.abs(s.t - pressT - C.processSec - C.outSec - C.dropSec) < 0.1 && s.money === -C.logCost && s.spent === C.logCost && s.costs.logs === C.logCost,
    'one medium plank rides the out-feed and drops into the planer\'s output bin, and the log cost $' + C.logCost + ' (money below zero)', s.bin.join() + ' / ' + s.money);
  s.events = [];
  s.avatar.x = SP.press.x + 0.4;
  F.tap(s, { kind: 'machine' });
  ok(!s.avatar.path.length && s.avatar.act && s.avatar.act.kind === 'press', 'tapping the button from close by presses without a walk');
  until(s, x => x.machine.phase === 'run', 2);
  F.tap(s, { kind: 'machine' }); run(s, 1);
  ok(take(s, 'press').length === 1, 'tapping it again while it runs does nothing', take(s, 'press').length);
  until(s, x => x.machine.phase === 'ready' && x.bin.length === 2, 8);
  // your arms: a tap on the output bin takes everything in it
  s.bin.push('rough.m', 'plank.s');
  F.tap(s, { kind: 'bin' });
  const early = s.avatar.inv.length;
  until(s, x => !x.avatar.act && x.avatar.task && x.avatar.task.arrived, 10);
  ok(early === 0 && s.avatar.inv.slice().sort().join() === 'plank.m,plank.m,plank.s,rough.m' && !s.bin.length && !F.bubbleOpen(s) && take(s, 'picked').length === 1,
    'a tap on the planer\'s output bin walks you over and you take everything in it into your arms (no bubble to answer)', s.avatar.inv.join());
  F.tap(s, { kind: 'counter' });
  until(s, x => !x.avatar.act && x.avatar.task && x.avatar.task.arrived, 20);
  const near = shut(F.newGame()); near.avatar.x = SP.counter.x; near.avatar.y = SP.counter.y; F.tap(near, { kind: 'bin' });
  const fromWalk = near.avatar.task.spot; near.avatar.x = SP.press.x; near.avatar.y = SP.press.y; F.tap(near, { kind: 'bin' });
  ok(dist(fromWalk, SP.binN) < 0.01 && dist(near.avatar.task.spot, SP.bin) < 0.01, 'the output bin is reached from whichever side is nearer: the walkway side from the counter, the floor side from the planer');
  ok(s.stalls[0].stock.map(g => g.item).join() === 'plank.m,plank.m' && s.stalls[0].stock.every(g => g.by === 'player') && s.avatar.inv.slice().sort().join() === 'plank.s,rough.m' && s.tally.player.stocked === 2 && dist(s.avatar, SP.counter) < 0.05,
    'a tap on the counter: you walk round to it and stock the medium plank stall with your medium planks, and only those; the rest stay in your arms (you always get it right)', s.stalls[0].stock.length + ' stocked, holding ' + s.avatar.inv.join());
  // the recycle bin: in and out
  F.tap(s, { kind: 'recycle' });
  const notYet = F.options(s).length;
  until(s, x => !!F.bubbleOpen(x), 20);
  let o = F.options(s);
  ok(!notYet && o.map(x => x.id).join() === 'put:plank.s,put:rough.m' && o.every(x => x.enabled && x.group === 'put'), 'at the recycle bin, and only once there, the bubble offers to put in each kind of thing in your arms', o.map(x => x.id).join());
  F.choose(s, 'put:plank.s'); F.choose(s, 'put:rough.m');
  o = F.options(s);
  ok(!s.avatar.inv.length && s.recycle.join() === 'plank.s,rough.m' && take(s, 'recycled').filter(e => e.by === 'player').length === 2 && o.map(x => x.id).join() === 'take:plank.s,take:rough.m' && o.every(x => x.group === 'take'),
    'one tap a kind: they go in, and now it offers to take each kind back out', o.map(x => x.id).join());
  F.choose(s, 'take:plank.s');
  ok(s.avatar.inv.join() === 'plank.s' && s.recycle.join() === 'rough.m', 'and a tap takes them back out: anything put in the recycle bin can be had back (the CD)', s.avatar.inv.join());
  F.tap(s, { kind: 'floor', x: 3, y: 9 }); F.step(s, 0.05);
  ok(!F.bubbleOpen(s) && !F.options(s).length, 'walking away closes the bubble');
  // the empty recycle bin and an empty pair of arms: nothing to choose
  const e = shut(F.newGame());
  F.tap(e, { kind: 'recycle' }); until(e, x => !!F.bubbleOpen(x), 20);
  o = F.options(e);
  ok(!!F.bubbleOpen(e) && !o.length && !F.choose(e, 'none') && !F.choose(e, 'take:log.m') && !F.choose(e, 'put:log.m'), 'with nothing to put in and nothing in it, the recycle bin\'s bubble opens with nothing to choose, and nothing can be put in or taken out');

  // you at the planer always get it right
  const g = feed(shut(F.newGame()), ['log.s', 'sappy.m', 'log.l', 'log.m'].concat(many('log.m', 5)));
  g.machine.log = 'gnarled.m';
  F.tap(g, { kind: 'machine' });
  until(g, x => x.machine.phase === 'run', 20);
  const rec = take(g, 'recycled');
  ok(rec.map(e => e.item).join() === 'gnarled.m,log.s,sappy.m,log.l' && rec.every(e => e.by === 'player' && e.from === 'in') && g.machine.log === 'log.m' && g.machine.by === 'player' && g.tally.player.tossed === 4 && !take(g, 'jam').length,
    'with a gnarled log on the belt you toss it in the recycle bin, and the small, sap and large logs after it, and press on the normal medium log (a sap log never jams your press)', rec.map(e => e.item).join());
  until(g, x => x.bin.length > 0, 10);
  ok(g.bin.join() === 'plank.m' && g.spent === C.logCost && learnt(g) === '', 'so your plank is a medium plank, a toss costs nothing, and no instruction joins the list (you made no mistake)', g.spent);
  // the planer's input bin (its rack): logs you put there yourself roll in next, and you press them whatever their size
  const k = feed(shut(F.newGame()), many('gnarled.m', 3));
  k.avatar.inv.push('log.l', 'log.s', 'gnarled.s', 'sappy.m', 'plank.m');
  F.tap(k, { kind: 'rack' }); until(k, x => !!F.bubbleOpen(x), 20);
  o = F.options(k);
  ok(o.map(x => x.id + ':' + x.count).join() === 'put:log.s:1,put:log.l:1,put:gnarled.s:1,put:sappy.m:1,take:gnarled.m:3', 'at the planer\'s input bin the bubble offers every log in your arms, sap and gnarled ones too (any log, the CD), and each kind in the bin to take out', o.map(x => x.id).join());
  F.choose(k, 'put:log.l'); F.choose(k, 'put:log.s');
  const many3 = shut(F.newGame()); many3.avatar.inv.push('log.m', 'log.m', 'log.m', 'plank.m'); F.tap(many3, { kind: 'rack' }); until(many3, x => !!F.bubbleOpen(x), 20); F.choose(many3, 'put:log.m');
  ok(many3.rack.slice(0, 3).join() === 'log.m,log.m,log.m' && many3.rack.length === C.startLogs + 3 && many3.rackMine === 3 && many3.avatar.inv.join() === 'plank.m', 'one tap puts every one of that kind in, however many you carry, in front of the logs bought', many3.rack.join());
  ok(k.rack.join() === 'log.l,log.s,gnarled.m,gnarled.m,gnarled.m' && k.rackMine === 2 && k.avatar.inv.slice().sort().join() === 'gnarled.s,plank.m,sappy.m', 'they go in the bin, yours first, in the order you put them', k.rack.join());
  F.tap(k, { kind: 'machine' }); until(k, x => x.machine.phase === 'run', 10);
  until(k, x => x.machine.phase === 'ready' && x.machine.staged >= 1, 10);
  F.tap(k, { kind: 'machine' }); until(k, x => x.machine.phase === 'run', 10);
  until(k, x => x.bin.length === 2, 15);
  ok(k.bin.join() === 'plank.m,plank.l' && k.machine.log === 'log.s' && k.machine.mine, 'the log on the belt first, then yours: you press a large log you racked yourself (a large plank)', k.bin.join());
  until(k, x => x.machine.phase === 'ready' && x.machine.staged >= 1, 10);
  F.tap(k, { kind: 'machine' }); until(k, x => x.bin.length === 3, 15);
  ok(k.bin[2] === 'plank.s' && k.machine.log === 'gnarled.m' && !k.machine.mine && k.rackMine === 0, 'and the small one; then the logs bought again', k.bin.join());
}

/* ---------- 4. the counter's customers ---------- */
{
  // they come in at the door, queue, and buy what is in the stall
  let s = F.newGame(); s.force.arrive = many(10);
  until(s, x => x.shop.people.length > 0, P.first + 1);
  ok(Math.abs(s.t - P.first) < 0.06 && s.shop.people[0].x < 0.1 && take(s, 'customer').length === 1, 'the first customer walks in at the door on the left after ' + P.first + ' s', s.t.toFixed(2));
  until(s, x => x.shop.people[0].state === 'wait', 10);
  const c = s.shop.people[0];
  ok(Math.abs(c.x - L.SHOP.x0) < 0.02 && c.y === L.SHOP.lineY, 'and goes to stand at the stall');
  s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  const m0 = s.money;
  until(s, x => take(x, 'sold').length > 0, 10);
  const sold = take(s, 'sold')[0];
  ok(sold && sold.item === 'plank.m' && sold.sale === 'fair' && s.money - m0 === 4 && !s.stalls[0].stock.length && c.state === 'out' && Math.abs(sold.t - take(s, 'paying')[0].t - P.paySec) < 0.06,
    'with a medium plank in the stall it taps a card ' + P.paySec + ' s later, pays $4 and carries the plank away: nobody needs to be at the counter', sold && (sold.item + ' $' + sold.paid));
  until(s, x => !x.shop.people.some(p => p.id === c.id), 20);
  ok(!s.shop.people.some(p => p.id === c.id) && s.shop.served === 1, 'and walks back out the door');
  s = F.newGame(); s.force.arrive = many(7);
  until(s, x => x.shop.people.length === 3, 40);
  ok(Math.abs(s.t - P.first - 14) < 0.1, 'the next ones come in on their own schedule (one of ' + P.every.join(' / ') + ' s apart)', s.t.toFixed(2));
  // the CD's example: three waiting at 100%, four seconds later 99%
  s = shut(F.newGame()); queue(s, 3);
  until(s, x => F.waitingNow(x) === 3, 5);
  s.satisfaction = 100;
  run(s, 4);
  ok(F.waitingNow(s) === 3 && Math.round(s.satisfaction) === 99 && s.satisfaction > 98.8 - 1e-9 && s.satisfaction < 98.83, 'the CD\'s example: three customers waiting in line at 100%, and four seconds later customer satisfaction is round(100% - 0.1% x 3 x 4) = round(98.8%) = 99% (customers forgetting adds a hundredth)', s.satisfaction.toFixed(3));
  s = shut(F.newGame()); queue(s, 2);
  s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  until(s, x => x.shop.people[0].state === 'pay', 5);
  s.satisfaction = 100;
  let w = 0;
  for (let t = 0; t < 2; t += 0.05) { F.step(s, 0.05); w = Math.max(w, F.waitingNow(s)); }
  ok(w === 1 && s.satisfaction > 99.75, 'a customer paying is not waiting; the one behind is', w + ' / ' + s.satisfaction.toFixed(3));
  // walking in is not waiting; nor is the second in line while the first pays, even with stock left for it
  s = shut(F.newGame()); s.shop.people.push({ id: 0, x: L.SHOP.door.x, y: L.SHOP.lineY, state: 'in', t: 0, stall: 0, item: null, by: null, wrong: false }); s.shop.n = 1;
  let walkMax = 0;
  for (let t = 0; t < 2; t += 0.05) { F.step(s, 0.05); walkMax = Math.max(walkMax, F.waitingNow(s)); }
  ok(s.shop.people[0].state === 'in' && !walkMax && s.satisfaction === 100, 'a customer still walking in from the door is not waiting, and costs nothing', s.shop.people[0].state + ' / ' + s.satisfaction);
  const two = shut(F.newGame()); queue(two, 2); two.stalls[0].stock.push({ item: 'plank.m', by: 'player' }, { item: 'plank.m', by: 'player' });
  until(two, x => x.shop.people[0].state === 'pay', 5); F.step(two, 0.05);
  ok(two.shop.people[1].state === 'wait' && two.stalls[0].stock.length === 1, 'with a plank left for the second customer, it still waits its turn behind the first');
  // the line moves up
  until(s, x => x.shop.people[0].state === 'out', 10);
  const left = s.t, next = s.shop.people.find(p => p.state !== 'out');
  until(s, x => Math.abs(next.x - L.SHOP.x0) < 0.02 && next.state === 'wait', 5);
  ok(Math.abs(next.x - L.SHOP.x0) < 0.02 && s.t - left < P.gap / P.speed + 0.2, 'and when the first is served, the next steps up to the stall', next.x.toFixed(2) + ' after ' + (s.t - left).toFixed(2) + ' s');
  // the room fills up: nobody else comes in until someone leaves (the CD's answer)
  s = F.newGame(); s.force.arrive = many(6, 200);
  run(s, P.first + 6 * (P.max + 3));
  const inside = s.shop.people.filter(p => p.state !== 'out').length;
  ok(inside === P.max && take(s, 'customer').length === P.max && F.waitingNow(s) === P.max && s.satisfaction < 90, 'once ' + P.max + ' are inside, nobody else comes in; all of them wait, and customer satisfaction drains', inside + ' inside, ' + s.satisfaction.toFixed(1) + '%');
  s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  until(s, x => take(x, 'customer').length > P.max, 30);
  ok(take(s, 'customer').length === P.max + 1, 'when one is served and leaves, the next comes in');
  // anything but a medium plank in the stall still sells, as a medium plank, and costs satisfaction
  s = shut(F.newGame()); queue(s, 1); s.satisfaction = 100;
  s.stalls[0].stock.push({ item: 'plank.s', by: 0 });
  until(s, x => take(x, 'sold').length > 0, 10);
  const wrong = take(s, 'sold')[0];
  ok(wrong.item === 'plank.s' && wrong.sale === 'wrong' && wrong.paid === 4 && s.money === 4 && s.satisfaction <= 100 - C.satHit + 0.1 && s.satisfaction > 100 - C.satHit - 0.5 && s.shop.wrong === 1 && s.shop.people[0].wrong,
    'a small plank in the medium plank stall: the customer pays $4 for a medium plank, gets something else, and customer satisfaction drops ' + C.satHit, wrong.paid + ' / ' + s.satisfaction.toFixed(2));
  // what customers pay is the stall's price times customer satisfaction (the CD, 2026-10-15)
  const paidAt = sat => { const t = shut(F.newGame()); queue(t, 1); t.stalls[0].stock.push({ item: 'plank.m', by: 'player' }); until(t, x => x.shop.people[0].state === 'pay', 5); t.satisfaction = sat; until(t, x => take(x, 'sold').length > 0, 5); return take(t, 'sold')[0].paid; };
  const pays = [100, 85, 70, 50, 30, 20, 10].map(paidAt);
  ok(pays.slice(0, 5).every((p, i) => F.cents(p) === p && Math.abs(p - 4 * [100, 85, 70, 50, 30][i] / 100) <= 0.05) && pays[0] === 4 && pays.slice(5).join() === '1.1,1.1',
    'as customer satisfaction falls, so does what they pay, to the cent: $4 at 100%, about $3.40 at 85%, $2.80 at 70%, $2 at 50%, $1.20 at 30%; and never below what a plank cost to make: $1.10 at 20% and at 10% (the CD, 2026-10-16)', pays.join());
  s = shut(F.newGame()); queue(s, 1); s.stalls[0].stock.push({ item: 'plank.m', by: 'player' }); s.satisfaction = 70;
  until(s, x => take(x, 'sold').length > 0, 10);
  ok(s.satisfaction > 70 + C.satUp - 0.05 && s.satisfaction < 70 + C.satUp + 0.6, 'a fair sale wins a point back (and customers forget a little while it pays)', s.satisfaction.toFixed(2));
  s = shut(F.newGame()); queue(s, 1); s.stalls[0].stock.push({ item: 'rough.m', by: 0 }); s.satisfaction = C.satMin + 3;
  until(s, x => take(x, 'sold').length > 0, 10);
  ok(s.satisfaction >= C.satMin && s.satisfaction < C.satMin + 0.5, 'customer satisfaction never drops below ' + C.satMin + '%', s.satisfaction.toFixed(2));
  s = shut(F.newGame()); queue(s, 1); s.stalls[0].stock.push({ item: 'plank.m', by: 0 });
  until(s, x => take(x, 'sold').length > 0, 10);
  ok(s.satisfaction === 100, 'and never rises above 100%');
  const q = shut(F.newGame()); q.satisfaction = 40; run(q, 60);
  const want = 100 - 60 * Math.exp(-C.satHeal * 60);
  ok(Math.abs(q.satisfaction - want) < 0.5, 'customers forget: a minute with nobody waiting heals satisfaction from 40% toward 100%', q.satisfaction.toFixed(1) + ' vs ' + want.toFixed(1));
  // the stall holds a handful
  s = shut(F.newGame()); for (let i = 0; i < C.stallCap + 3; i++) s.avatar.inv.push('plank.m');
  F.tap(s, { kind: 'counter' }); until(s, x => !x.avatar.act && x.avatar.task.arrived, 20);
  ok(s.stalls[0].stock.length === C.stallCap && count(s.avatar.inv, 'plank.m') === 3, 'the stall holds ' + C.stallCap + '; what does not fit stays in your arms', s.stalls[0].stock.length + ' / ' + s.avatar.inv.length);
}

/* ---------- 5. the jam, and its fix ---------- */
{
  const s = staffed(11, ['operate', null], Object.assign(calm(), { log: ['log.m'] }));
  shut(s); s.machine.log = 'sappy.m'; s.events = [];
  until(s, x => x.machine.phase === 'jam', 20);
  run(s, 60);
  ok(s.machine.phase === 'jam' && !take(s, 'made').length && s.robots[0].mood === 'stuck' && s.robots[0].tally.bad === 1 && s.spent === C.logCost, 'a sap log fed in jams the planer, and no robot fixes it (60 s later it is still jammed, the operator stuck)', s.machine.phase);
  const m0 = s.money;
  F.tap(s, { kind: 'machine' });
  until(s, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c0 = s.t;
  until(s, x => x.machine.phase !== 'jam', 10);
  ok(s.machine.phase === 'ready' && Math.abs(s.t - c0 - C.cleanSec) < 0.11 && take(s, 'cleaned').length === 1 && take(s, 'cleaned')[0].cost === C.fixCost, 'tapping the planer walks you over to scrub it clean, which takes ' + C.cleanSec + ' s', (s.t - c0).toFixed(2));
  ok(m0 - s.money === C.fixCost && s.costs.fixes === C.fixCost && s.spent === C.logCost + C.fixCost && s.tally.player.fixed === 1, 'and fixing the jam costs $' + C.fixCost + ' (the CD, 2026-10-15)', (m0 - s.money) + '');
  const t = staffed(11, ['operate', null], calm()); shut(t); t.machine.log = 'sappy.m';
  until(t, x => x.machine.phase === 'jam', 20);
  F.tap(t, { kind: 'machine' }); until(t, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  run(t, C.cleanSec / 2);
  F.tap(t, { kind: 'floor', x: 3, y: 6.3 }); run(t, 2);
  const half = t.machine.dirt, paid0 = t.costs.fixes;
  F.tap(t, { kind: 'machine' }); until(t, x => x.avatar.act && x.avatar.act.kind === 'clean', 10);
  const c1 = t.t; until(t, x => x.machine.phase !== 'jam', 10);
  ok(half > 0.3 && half < 0.7 && t.t - c1 < C.cleanSec * 0.65 && paid0 === 0 && t.costs.fixes === C.fixCost, 'walking away mid-scrub keeps the half already done, and the fix is paid once, when it is done', half.toFixed(2));
}

/* ---------- 6. hiring and jobs ---------- */
{
  const s = shut(F.newGame());
  s.money = 19;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 20);
  const poor = F.options(s)[0];
  ok(poor.id === 'hire' && !poor.enabled && poor.price === 20 && !F.choose(s, 'hire') && s.money === 19 && !s.robots.length, 'at $19 the dock shows the $20 robot greyed, and refuses');
  s.money = 20;
  ok(F.choose(s, 'hire') && s.money === 0 && s.robots.length === 1 && s.robots[0].state === 'unbox' && s.robots[0].name === C.names[0], 'at $20 a robot is hired, climbs out of its crate, and has a name');
  const after = F.options(s);
  ok(F.bubbleOpen(s).kind === 'robot' && after.map(x => x.id).join() === 'job:operate,job:stock,job:rest,notes', 'the bubble turns straight to the new robot: the planer, stocking the counter, rest, and its clipboard (the CD: robots only on the planer and the counter for now)', after.map(x => x.id).join());
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  ok(F.options(s)[0].price === 40, 'the second robot costs $40', F.options(s)[0].price);
  s.money = 40; F.choose(s, 'hire');
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  const out = F.options(s)[0];
  ok(s.robots.length === 2 && !out.enabled && out.soldOut && (s.money = 999) && !F.choose(s, 'hire') && s.robots.length === 2, 'after two there are no more to hire, whatever the money');
  const t = staffed(3, ['operate', 'stock'], calm()); shut(t);
  const [op, st] = t.robots;
  until(t, x => dist(op, SP.operate) < 0.07 && dist(st, SP.stock) < 0.07, 40);
  ok(dist(op, SP.operate) < 0.07 && dist(st, SP.stock) < 0.07, 'robots go to their posts: the operator at the planer\'s button, the stocker on the walkway between the output bin and the stall', [op.x, op.y, st.x, st.y].map(v => v.toFixed(2)).join());
  until(t, x => x.stalls[0].stock.length > 0, 30);
  ok(take(t, 'press')[0].by === op.id && t.stalls[0].stock[0].by === st.id && t.stalls[0].stock[0].item === 'plank.m', 'the operator runs the planer, and the stocker carries its plank from the output bin to the stall');
  t.events = [];
  run(t, 30);
  const presses = take(t, 'press').length, madeN = take(t, 'made').length;
  ok(presses >= 4 && Math.abs(presses - madeN) <= 1, 'one press per cycle: a robot never presses a running planer', presses + ' presses, ' + madeN + ' made');
  F.tap(t, { kind: 'robot', id: st.id }); until(t, x => !!F.bubbleOpen(x), 30);
  F.choose(t, 'job:operate');
  ok(st.job === 'operate' && op.job === 'stock', 'giving a robot a job someone has swaps them', op.job + '/' + st.job);
  const u = staffed(5, [null, 'stock']); shut(u);
  const sk = u.robots[1];
  until(u, x => dist(sk, SP.stock) < 0.07, 40);
  F.tap(u, { kind: 'robot', id: sk.id }); until(u, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'robot', 30);
  u.bin.push('plank.m');
  until(u, x => sk.state === 'place', 10);
  const held = sk.carry;
  F.choose(u, 'job:rest');
  ok(held === 'plank.m' && !sk.carry && u.bin.join() === 'plank.m' && !u.stalls[0].stock.length, 'a stocker taken off the job mid-stocking puts the plank back in the output bin', held + ' / ' + u.bin.join());
  until(u, x => sk.state === 'idle' && dist(sk, SP.rest[sk.id]) < 0.07, 40);
  ok(dist(sk, SP.rest[sk.id]) < 0.07, 'a robot sent to rest goes back to its charging pad');
}

/* ---------- 7. what each mistake does (no instructions) ---------- */
// one operator at the button, with what is on the in-feed and its dice forced; the robot rolls
// the moment it reaches the button, so the dice are queued before it is hired
function opCycle(log, force, rules) {
  const s = staffed(11, ['operate', null], Object.assign(calm(), force || {}));
  shut(s);
  s.machine.log = log || 'log.m';
  if (rules) instruct(s, 0, rules);
  s.events = [];
  return s;
}
{
  let s = opCycle('log.m');
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'plank.m' && s.robots[0].tally.good === 1 && s.robots[0].record.plank === 1 && learnt(s) === '', 'a normal medium log: a medium plank, a green mark in the robot\'s evals, and nothing joins the list');
  s = opCycle('log.m', { think: [true] });
  until(s, x => dist(x.robots[0], SP.operate) < 0.07, 30);
  const t0 = s.t;
  until(s, x => take(x, 'press').length > 0, 10); until(s, x => x.bin.length > 0, 20);
  ok(take(s, 'press')[0].t - t0 >= C.dawdleSec && s.bin.join() === 'plank.m' && s.robots[0].record.think === 1, 'yellow: it stops and thinks ' + C.dawdleSec + ' s, then a plank');
  s = opCycle('log.m', { think: [true] });
  until(s, x => x.robots[0].state === 'dawdle', 30);
  s.avatar.x = SP.press.x; s.avatar.y = SP.press.y;
  F.tap(s, { kind: 'machine' });
  until(s, x => x.machine.phase === 'run', 2);
  const myRun = s.machine.t;
  until(s, x => x.robots[0].state !== 'dawdle' && x.robots[0].state !== 'press', 6);
  ok(take(s, 'press').length === 1 && s.machine.by === 'player' && s.machine.phase === 'run' && s.machine.t > myRun, 'a robot that presses a planer you already started does nothing to your cut', take(s, 'press').length + ' presses, by ' + s.machine.by);
  const cases = [
    ['gnarled.m', 'rough.m', 'gnarled'], ['log.s', 'plank.s', 'medium,smallLog'], ['log.l', 'plank.l', 'medium,largeLog'],
    ['gnarled.s', 'rough.s', 'gnarled,medium,smallLog'], ['gnarled.l', 'rough.l', 'gnarled,medium,largeLog']
  ];
  cases.forEach(([log, made, joined]) => {
    s = opCycle(log);
    until(s, x => x.bin.length > 0, 20);
    const ids = take(s, 'rule').map(e => e.ids.join(',')).join('|');
    ok(s.bin.join() === made && s.robots[0].tally.soso === 1 && s.robots[0].record['cut:' + log] === 1 && ids.split('|')[0] === joined && s.spent === C.logCost,
      'a ' + log + ' log goes in (for $' + C.logCost + ') and ' + made + ' comes out: yellow, and the instructions that would have kept it out join the list (' + joined + ')', s.bin.join() + ' / ' + ids);
  });
  s = opCycle('gnarled.m'); until(s, x => x.bin.length > 0, 20);
  ok(learnt(s) === 'gnarled,output', 'and once the gnarled plank lands in the bin, "' + RULE_TEXT.output + '" joins too', learnt(s));
  s = opCycle('log.s'); until(s, x => x.bin.length > 0, 20);
  ok(s.seen.mediumLog && !s.seen.largeLog, '"' + RULE_TEXT.mediumLog + '" rides in with the small-log one; the large-log one waits for a large log');
  for (const z of ['m', 's']) {
    s = opCycle('sappy.' + z);
    until(s, x => x.machine.phase === 'jam', 20);
    const ids = take(s, 'rule').map(e => e.ids.join(',')).join('|');
    ok(s.machine.phase === 'jam' && s.robots[0].tally.bad === 1 && s.robots[0].record['jam:sappy.' + z] === 1 && ids === (z === 'm' ? 'sappy' : 'sappy,medium,smallLog') && s.seen.sap,
      'a ' + (z === 'm' ? 'medium' : 'small') + ' sap log jams the planer whatever its size (red), and the instructions that would have kept it out join the list, with "' + RULE_TEXT.sap + '" riding in', ids);
  }
  s = staffed(11, ['operate', null], calm()); shut(s);
  s.machine.log = 'gnarled.m'; s.seen.gnarled = true; s.seen.output = true; s.events = [];
  until(s, x => x.bin.length > 0, 20);
  ok(!take(s, 'rule').length && s.bin.join() === 'rough.m', 'a mistake adds its instruction to the list once: seen again, nothing new joins');
}
// one stocker on the walkway with these things in the output bin
function stockCycle(bin, force, rules) {
  const s = staffed(13, [null, 'stock']); shut(s);
  if (rules) instruct(s, 1, rules);
  until(s, x => x.robots[1].state === 'idle' && dist(x.robots[1], SP.stock) < 0.07, 40);
  s.events = []; bin.forEach(k => s.bin.push(k));
  Object.keys(force || {}).forEach(k => { s.force[k] = force[k].slice(); });
  return s;
}
{
  let s = stockCycle(['plank.m']);
  until(s, x => x.stalls[0].stock.length > 0, 10);
  ok(s.stalls[0].stock[0].item === 'plank.m' && s.robots[1].record.stock === 1 && s.robots[1].tally.good === 1 && !s.bin.length, 'a medium plank: into the stall, green');
  for (const item of ['plank.s', 'plank.l', 'rough.m', 'rough.l']) {
    s = stockCycle([item]);
    until(s, x => x.stalls[0].stock.length > 0, 10);
    const out = item === 'plank.s' ? 'smallOut' : item === 'plank.l' ? 'largeOut' : 'roughOut';
    ok(s.stalls[0].stock[0].item === item && s.robots[1].record['misstock:' + item] === 1 && s.robots[1].tally.bad === 1 && s.seen.stockOnly && s.seen.price && s.seen[out],
      'with no instruction a stocker puts ' + item + ' in the medium plank stall: red (a customer will pay $4 for a medium plank and get something else), and "' + RULE_TEXT.stockOnly + '" and "' + RULE_TEXT[out] + '" join the list (with "' + RULE_TEXT.price + '")', F.known(s).map(q => q.id).join());
  }
  s = stockCycle(['plank.s', 'plank.m']); queue(s, 1);
  until(s, x => take(x, 'sold').length > 0, 20);
  ok(take(s, 'sold')[0].item === 'plank.s' && take(s, 'sold')[0].sale === 'wrong' && take(s, 'sold')[0].by === 1, 'and the next customer buys it as a medium plank');
  s = stockCycle(['plank.m', 'plank.m', 'plank.m']);
  for (let i = 0; i < C.stallCap; i++) s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  run(s, 5);
  ok(s.bin.length === 3 && s.robots[1].state === 'idle', 'with the stall full the stocker waits');
  s = stockCycle(['plank.m']);
  until(s, x => x.robots[1].state === 'place', 10);
  for (let i = 0; i < C.stallCap; i++) s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  run(s, 3);
  const held = s.robots[1].state === 'place' && s.robots[1].carry === 'plank.m' && s.stalls[0].stock.length === C.stallCap;
  s.stalls[0].stock.pop(); run(s, 1);
  ok(held && s.stalls[0].stock.length === C.stallCap && !s.robots[1].carry, 'and one already carrying a plank when the stall fills holds it until there is room, then puts it in');
}

/* ---------- 8. instructions ---------- */
{
  const one = staffed(21, ['operate']); one.money = 999; one.seen.sap = true;
  ok(!F.slotsOpen(one) && !F.buySlot(one, 0) && one.robots[0].slots === 0 && one.money === 999, 'with one robot on staff no slot can be bought, whatever the money');
  const s = staffed(21); s.money = 4;
  ok(F.slotsOpen(s) && F.slotPrice(s, 0) === 5 && !F.buySlot(s, 0) && s.money === 4, 'with both, the first slot asks $5 and waits for the money');
  s.money = 1000;
  const paid = [];
  for (let i = 0; i < 7; i++) { const m = s.money; if (F.buySlot(s, 0)) paid.push(m - s.money); }
  ok(paid.join() === C.slots.join() && s.robots[0].slots === 5 && F.slotPrice(s, 0) === null && s.robots[0].rules.every(x => x === null), 'slots cost ' + C.slots.map(p => '$' + p).join(' / ') + ' in order, five at most, each one empty', paid.join());
  ok(s.robots[1].slots === 0 && F.slotPrice(s, 1) === 5, 'and buying them for one robot buys nothing for the other');
  ok(learnt(s) === '' && !F.setRule(s, 0, 0, 'sap') && s.robots[0].rules[0] === null, 'no instruction can be given before its mistake has been seen');
  s.seen.sap = true; s.seen.gnarled = true;
  ok(learnt(s) === 'sap,gnarled' && F.setRule(s, 0, 0, 'sap') && s.robots[0].rules[0] === 'sap', 'once seen it is in the list, and it goes in a slot');
  ok(!F.setRule(s, 0, 1, 'sap') && F.setRule(s, 0, 1, 'gnarled') && !F.setRule(s, 0, 5, 'gnarled') && !F.setRule(s, 0, 0.5, 'gnarled') && !F.setRule(s, 0, 2, 'nonsense'), 'once per robot, only in a slot it has, and only from the pool', JSON.stringify(s.robots[0].rules));
  s.money = 5; F.buySlot(s, 1);
  ok(F.setRule(s, 1, 0, 'sap') && s.robots[1].rules[0] === 'sap', 'both robots may hold the same instruction');
  ok(F.setRule(s, 0, 0, null) && s.robots[0].rules[0] === null && s.robots[0].slots === 5, 'an instruction can be taken out again, and the slot stays bought');
  F.rename(s, 0, '   Plank   Boss  '); const trimmed = s.robots[0].name;
  F.rename(s, 0, 'Plankmaster General of the Line'); const long = s.robots[0].name;
  F.rename(s, 1, '   ');
  ok(trimmed === 'Plank Boss' && long === 'Plankmaster General of the Line'.slice(0, C.nameMax) && s.robots[1].name === C.names[1], 'a robot can be renamed (trimmed, ' + C.nameMax + ' characters at most); a blank name puts its own back');
  const b = staffed(22, ['operate', 'stock']); instruct(b, 0, ['sap']);
  F.tap(b, { kind: 'robot', id: 0 }); until(b, x => !!F.bubbleOpen(x), 30);
  const note = F.options(b).find(o => o.id === 'notes');
  ok(note && note.filled === 1 && note.slots === 1 && F.choose(b, 'notes') && take(b, 'notes').length === 1 && !F.bubbleOpen(b), 'the robot\'s clipboard shows how many of its slots are filled, and opens its page');
}
{
  // each operator instruction keeps out what it names, by quality or by size (no slip)
  const keeps = [['gnarled.l', 'gnarled'], ['gnarled.s', 'gnarled'], ['log.s', 'medium'], ['log.l', 'medium'], ['gnarled.s', 'medium'], ['sappy.l', 'medium'],
    ['log.s', 'smallLog'], ['sappy.s', 'smallLog'], ['log.l', 'largeLog'], ['sappy.m', 'sappy'], ['sappy.l', 'sappy']];
  const missed = [];
  keeps.forEach(([log, rule]) => {
    const s = opCycle(log, { slip: [false] }, [rule]);
    until(s, x => x.bin.length > 0 || x.machine.phase === 'jam', 20);
    const r = take(s, 'recycled')[0];
    if (!(r && r.item === log && r.from === 'in' && s.bin.join() === 'plank.m' && s.robots[0].record['reject:' + log] === 1 && !take(s, 'jam').length && s.spent === C.logCost)) missed.push(log + '/' + rule);
  });
  ok(!missed.length, 'each operator instruction keeps out the logs it names, by quality or by size: the log goes in the recycle bin, the next one is cut, and only that one is paid for (sap logs too: no jam)', missed.join());
  const lets = [['log.s', 'largeLog'], ['gnarled.m', 'medium'], ['sappy.m', 'smallLog'], ['log.l', 'gnarled']];
  const leaked = [];
  lets.forEach(([log, rule]) => {
    const s = opCycle(log, { slip: [false] }, [rule]);
    until(s, x => x.bin.length > 0 || x.machine.phase === 'jam', 20);
    if (take(s, 'recycled').length || s.force.slip.length !== 1) leaked.push(log + '/' + rule);
  });
  ok(!leaked.length, 'and says nothing about any other: a small log past "' + RULE_TEXT.largeLog + '", a medium gnarled one past "' + RULE_TEXT.medium + '", a medium sap log past "' + RULE_TEXT.smallLog + '" (each never even consulted: its slip die is never rolled)', leaked.join());
  let s = opCycle('log.m', { slip: [false] }, ['mediumLog']);
  until(s, x => take(x, 'recycled').length > 0, 20);
  ok(take(s, 'recycled')[0].item === 'log.m' && s.robots[0].tally.good === 1 && !s.bin.length, '"' + RULE_TEXT.mediumLog + '" throws a normal medium log away: done as told, so green (whether it was wise is the player\'s call)');
  s = opCycle('gnarled.s', { slip: [true, false] }, ['medium', 'gnarled']);
  until(s, x => take(x, 'recycled').length > 0, 20);
  ok(take(s, 'recycled').length && take(s, 'recycled')[0].item === 'gnarled.s' && s.force.slip.length === 0, 'two instructions about the same log each get their chance: a slip on one is caught by the other');
  s = opCycle('sappy.m', { slip: [false] }, ['sap']);
  until(s, x => x.machine.phase === 'jam', 20);
  ok(s.machine.phase === 'jam' && s.force.slip.length === 1, '"' + RULE_TEXT.sap + '" prevents nothing: the sap log goes in and jams the planer, and the instruction is never consulted');
  s = opCycle('gnarled.m', { slip: [false] }, ['output']);
  until(s, x => take(x, 'recycled').length > 0, 20); run(s, 3);
  const r2 = take(s, 'recycled')[0];
  ok(r2 && r2.item === 'rough.m' && r2.from === 'out' && !s.bin.length && s.robots[0].record['caught:rough.m'] === 1 && s.robots[0].record['cut:gnarled.m'] === 1,
    '"' + RULE_TEXT.output + '": the gnarled log still goes in, but the gnarled plank goes in the recycle bin, not the output bin');
  // "only stock medium planks": everything else stays in the bin and it has to hunt
  let h = stockCycle(['plank.s', 'rough.m'], { slip: [false] }, ['stockOnly']);
  run(h, 10);
  const joined = take(h, 'rule').map(e => e.ids.join('+')).sort().join();
  ok(!h.stalls[0].stock.length && !take(h, 'recycled').length && h.bin.join() === 'plank.s,rough.m' && h.robots[1].record.looking >= 6 && take(h, 'looking').length === h.robots[1].record.looking,
    '"' + RULE_TEXT.stockOnly + '": with only a small plank and a gnarled one in the bin, the stocker stocks nothing and takes nothing out; each reach is a "looking for plank"', h.bin.join() + ' / looking ' + h.robots[1].record.looking);
  ok(joined === 'roughOut,smallOut', 'and what it keeps turning up puts the instruction that would clear it on the list (a way out of a bin full of junk)', joined);
  h = stockCycle(['plank.s', 'rough.m', 'plank.m', 'plank.l'], { slip: [false, true, true], find: [false, false, true] }, ['stockOnly']);
  until(h, x => x.stalls[0].stock.length > 0, 12);
  ok(h.robots[1].record.looking === 2 && h.stalls[0].stock[0].item === 'plank.m' && h.bin.join() === 'plank.s,rough.m,plank.l' && h.force.slip.join() === 'true,true' && !h.force.find.length,
    'two reaches turn up something else, the third a medium plank, which it stocks; it decided once for that stocking whether to follow the instruction (one slip die for the whole hunt)', 'looking ' + h.robots[1].record.looking + ', bin ' + h.bin.join());
  h = stockCycle(['plank.s', 'rough.l', 'plank.l'], { slip: [false, false, false, false], turnup: ['rough.l', 'plank.s'] }, STOCKERS);
  until(h, x => !x.bin.length && x.robots[1].state === 'idle', 15);
  const outs = take(h, 'recycled');
  ok(!h.bin.length && outs.map(e => e.item).join() === 'rough.l,plank.s,plank.l' && outs.every(e => e.by === 1) && !take(h, 'looking').length && !h.stalls[0].stock.length && h.robots[1].tally.good === 3 && !h.force.slip.length,
    'told to recycle small, large and gnarled planks, a hunting stocker clears each thing it turns up instead of putting it back: the bin empties, all green', outs.map(e => e.item).join());
  h = stockCycle(['plank.s', 'plank.m'], { slip: [false] }, ['smallOut']);
  until(h, x => x.stalls[0].stock.length > 0, 12);
  ok(take(h, 'recycled').length === 1 && take(h, 'recycled')[0].item === 'plank.s' && h.stalls[0].stock[0].item === 'plank.m', 'without "only stock" it takes the next thing as always, and what it is told to recycle goes in the recycle bin, not the stall');
  h = stockCycle(['plank.s'], { slip: [false, true, false] }, ['stockOnly', 'smallOut']);
  until(h, x => take(x, 'recycled').length > 0, 12);
  ok(h.robots[1].record['looking!'] === 1 && h.robots[1].record['recycle:plank.s'] === 1, 'a slip on a recycle instruction puts the thing back (a "looking for plank" against its instructions), and the next reach clears it');
  // the slip
  s = opCycle('gnarled.m', { slip: [true] }, ['gnarled']);
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'rough.m' && s.robots[0].record['cut:gnarled.m!'] === 1, 'on a slip the instruction is ignored: the gnarled log goes in anyway, and its evals say it was against its instructions');
  h = stockCycle(['rough.m'], { slip: [true] }, ['stockOnly']);
  until(h, x => x.stalls[0].stock.length > 0, 12);
  ok(h.robots[1].record['misstock:rough.m!'] === 1 && h.robots[1].tally.bad === 1 && !h.robots[1].record.looking, 'and a slipping stocker does not hunt: it stocks what comes next, red against its instructions (red stays red)', JSON.stringify(h.robots[1].record));
  const reds = Object.keys(F.GRADE).filter(k => F.GRADE[k] === 'bad').sort().join(), G = k => F.gradeOf(k);
  ok(reds === 'jam,misstock' && G('jam:sappy.m!') === 'bad' && G('misstock:plank.s') === 'bad' && G('cut:log.s') === 'soso' && G('looking') === 'soso' && G('think') === 'soso' &&
    G('reject:log.s') === 'good' && G('recycle:rough.m') === 'good' && G('stock') === 'good' && G('stock!') === 'soso' && G('plank!') === 'soso', 'red only for a jam and for something else put in the medium plank stall; done against its instructions, green turns yellow', reds);
  s = staffed(37, ['operate', 'stock']); run(s, 60);
  const before = Object.keys(s.robots[0].record).length;
  ok(before > 0 && F.resetEvals(s, 0) && !Object.keys(s.robots[0].record).length && s.robots[0].since === s.t && Object.keys(s.robots[1].record).length > 0 && !F.resetEvals(s, 7), 'resetting a robot\'s evals empties its counts and starts its clock, and leaves the other robot\'s alone');
  // an instruction about another job does nothing: same dice, same day, exactly
  const day = rules => {
    const t = staffed(31, ['operate', 'stock']);
    if (rules) { instruct(t, 0, rules[0]); instruct(t, 1, rules[1]); }
    const log = [];
    for (let k = 0; k < 6000; k++) {
      F.step(t, 0.05);
      t.events.forEach(e => { if (e.kind === 'outcome' || e.kind === 'sold' || e.kind === 'recycled' || e.kind === 'looking' || e.kind === 'customer') log.push(e.kind + ':' + (e.what || e.sale || e.item || '')); });
      t.events = [];
      if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; }
    }
    return { log: log.join(), money: t.money, earned: t.earned, seed: t.seed, sat: t.satisfaction };
  };
  const OPS = ['sappy', 'gnarled', 'medium', 'output'], STOCKS = ['stockOnly', 'smallOut', 'largeOut', 'roughOut', 'price'];
  const plain = day(null), crossed = day([STOCKS, OPS.concat('sap')]), right = day([OPS, STOCKERS]);
  ok(plain.log.length > 200 && crossed.log === plain.log && crossed.money === plain.money && crossed.seed === plain.seed, 'an instruction about the other robot\'s job does nothing: crossed wires play the same day as no instructions, roll for roll', plain.money + ' vs ' + crossed.money);
  const decoy = day([['sap'], ['price']]);
  ok(decoy.log === plain.log && decoy.seed === plain.seed, 'and so do "' + RULE_TEXT.sap + '" on the operator and "' + RULE_TEXT.price + '" on the stocker (the stall sets the price): instructions that prevent nothing play the same day as none, roll for roll');
  ok(right.money > plain.money * 1.5 && right.sat > plain.sat + 30, 'and the right instructions on the right robots keep more money and far more customer satisfaction (every jam cleaned the moment it happens)', right.money + ' vs ' + plain.money + ', ' + right.sat.toFixed(0) + '% vs ' + plain.sat.toFixed(0) + '%');
  // an upstream instruction can keep a downstream mistake from ever happening
  const upstream = rules => {
    const t = staffed(35, ['operate', 'stock']); if (rules) instruct(t, 0, rules);
    t.force.slip = many(false, 5000);
    let junk = 0, stocked = 0;
    for (let k = 0; k < 12000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'binned' && e.item !== 'plank.m') junk++; if (e.kind === 'stocked') stocked++; }); t.events = []; if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; } }
    return { t, junk, stocked };
  };
  const told = upstream(['sappy', 'gnarled', 'medium', 'output']), untold = upstream(null);
  ok(!told.junk && told.stocked > 40 && !told.t.seen.stockOnly && untold.junk > 20 && untold.t.seen.stockOnly, 'an operator told about every bad log hands the stocker only medium planks, so "' + RULE_TEXT.stockOnly + '" never joins the list; untold, it does within ten minutes', 'told: ' + told.junk + ' junk binned, ' + told.stocked + ' stocked; untold: ' + untold.junk);
  s = staffed(33, ['operate', 'stock']); instruct(s, 0, ['gnarled']);
  F.tap(s, { kind: 'robot', id: 1 }); until(s, x => !!F.bubbleOpen(x), 30); F.choose(s, 'job:operate');
  ok(s.robots[1].job === 'operate' && s.robots[0].job === 'stock' && s.robots[0].rules.join() === 'gnarled' && !s.robots[1].rules.length, 'swap the robots\' jobs and each keeps its own instructions');
}

/* ---------- 9. slots 02-04: the table saw, the sap extractor, the bench ---------- */
{
  const s = shut(F.newGame());
  s.avatar.inv.push('plank.m', 'plank.l', 'rough.m', 'sappy.l');
  F.tap(s, { kind: 'saw' }); until(s, x => !!F.bubbleOpen(x), 30);
  let o = F.options(s);
  ok(o.map(x => x.id).join() === 'cut:b2x4,cut:b2x2,cut:dowels' && o.every(x => !x.enabled) && !F.choose(s, 'cut:b2x4'), 'the table saw offers its three cuts, greyed while its input bin is empty');
  F.tap(s, { kind: 'sawIn' }); until(s, x => !!F.bubbleOpen(x), 20);
  o = F.options(s);
  ok(o.map(x => x.id).join() === 'put:plank.m,put:plank.l', 'its input bin takes planks, and only planks (not the gnarled one)', o.map(x => x.id).join());
  F.choose(s, 'put:plank.l'); F.choose(s, 'put:plank.m');
  ok(s.saw.in.join() === 'plank.l,plank.m', 'in they go');
  F.tap(s, { kind: 'saw' }); until(s, x => !!F.bubbleOpen(x), 20);
  o = F.options(s);
  const m0 = s.money;
  ok(o.every(x => x.enabled) && o[0].item === 'b2x4.l', 'now the cuts light, for the first plank in (a large one)', o.map(x => x.item).join());
  F.choose(s, 'cut:dowels');
  until(s, x => x.saw.phase === 'run', 2);
  ok(s.money === m0 - C.sawCost && s.costs.saw === C.sawCost && s.saw.in.join() === 'plank.m' && F.options(s).every(x => !x.enabled), 'a cut costs $' + C.sawCost + ', takes the first plank in, and the cuts grey out while the blade runs');
  until(s, x => x.saw.out.length > 0, C.sawSec + 3);
  ok(s.saw.out.join() === 'dowels.l' && s.tally.player.sawn === 1, 'a large plank becomes sixteen large dowel rods (8\' long), in the saw\'s output bin', s.saw.out.join());
  until(s, x => F.options(x).some(o2 => o2.enabled), 3);
  F.choose(s, 'cut:b2x4'); until(s, x => x.saw.out.length > 1, C.sawSec + 3);
  ok(s.saw.out.join() === 'dowels.l,b2x4.m' && !s.saw.in.length, 'and the medium plank two medium 2"x4"s');
  F.tap(s, { kind: 'sawOut' }); until(s, x => !x.avatar.act && x.avatar.task.arrived, 20);
  ok(s.avatar.inv.indexOf('dowels.l') >= 0 && s.avatar.inv.indexOf('b2x4.m') >= 0 && !s.saw.out.length, 'and a tap on its output bin takes them into your arms');
  // the sap extractor
  s.avatar.inv.push('log.s');
  F.tap(s, { kind: 'extractIn' }); until(s, x => !!F.bubbleOpen(x), 20);
  ok(F.options(s).map(x => x.id).join() === 'put:sappy.l', 'the sap extractor\'s input bin takes sap logs, and only sap logs (not the clean one you carry)');
  s.avatar.inv.splice(s.avatar.inv.indexOf('log.s'), 1);
  F.choose(s, 'put:sappy.l');
  const m1 = s.money;
  F.tap(s, { kind: 'extract' }); until(s, x => x.extract.phase === 'run', 20);
  ok(F.cents(m1 - s.money) === C.extractCost && !s.extract.in.length, 'a tap on the extractor presses it: $' + C.extractCost);
  until(s, x => x.extract.out.length === 1 + C.sapUnits.l, C.extractSec + 4);
  ok(s.extract.out.slice().sort().join() === ['log.l'].concat(many('sap', C.sapUnits.l)).sort().join() && C.sapUnits.s === 1 && C.sapUnits.m === 2 && C.sapUnits.l === 4,
    'a large sap log gives up 4 units of sap and a clean large log (1 / 2 / 4 by size, the CD\'s numbers)', s.extract.out.join());
  F.tap(s, { kind: 'extractOut' }); until(s, x => !x.avatar.act && x.avatar.task.arrived, 20);
  F.tap(s, { kind: 'rack' }); until(s, x => !!F.bubbleOpen(x), 30);
  F.choose(s, 'put:log.l');
  ok(s.rack[0] === 'log.l' && s.rackMine === 1, 'the clean log can go in the planer\'s input bin, and rolls in next (the CD)', s.rack.join());
  // the bench
  F.tap(s, { kind: 'benchIn' }); until(s, x => !!F.bubbleOpen(x), 30);
  s.avatar.inv.push('gnarled.s');
  F.tap(s, { kind: 'benchIn' }); until(s, x => !!F.bubbleOpen(x), 5);
  o = F.options(s);
  ok(o.map(x => x.id).join() === 'put:gnarled.s,put:rough.m', 'the bench\'s input bin takes gnarled wood: logs and planks', o.map(x => x.id).join());
  F.choose(s, 'put:rough.m'); F.choose(s, 'put:gnarled.s');
  const m2 = s.money;
  s.force.carve = ['bird'];
  F.tap(s, { kind: 'bench' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'carve', 20);
  const c0 = s.t;
  until(s, x => x.bench.out.length > 0, C.carveSec + 2);
  ok(s.bench.out.join() === 'carving.bird' && Math.abs(s.t - c0 - C.carveSec) < 0.11 && s.money === m2 && s.bench.in.join() === 'gnarled.s' && s.tally.player.carved === 1,
    'at the bench you carve the first piece in by hand (' + C.carveSec + ' s, free) into something to keep', s.bench.out.join());
  s.force.carve = ['owl'];
  F.tap(s, { kind: 'bench' }); until(s, x => x.avatar.act && x.avatar.act.kind === 'carve', 5);
  run(s, C.carveSec / 2);
  F.tap(s, { kind: 'floor', x: 3, y: 11.6 }); run(s, 3);
  const kept = s.bench.item, prog = s.bench.t;
  F.tap(s, { kind: 'bench' }); until(s, x => x.bench.out.length > 1, C.carveSec + 6);
  ok(kept === 'gnarled.s' && prog > 2 && prog < 3 && s.bench.out[1] === 'carving.owl', 'walking away mid-carve leaves the piece on the bench, half done, and you finish it later');
  ok(F.priceOf('carving.bird') === null && F.priceOf('rough.m') === null && !s.stalls.some(q => q.want !== 'plank.m'), 'carvings and gnarled planks have no price yet, and only medium planks are sold');
  const t = staffed(41, ['operate', 'stock']);
  ok(!F.options(t).length && t.robots.every(r => r.job === 'operate' || r.job === 'stock'), 'and no robot can be put on slots 02-04: their jobs are the planer and the counter (the CD)');
}

/* ---------- 10. the rates, measured over real play ---------- */
{
  const within = (got, n, p) => Math.abs(got / n - p) <= 3.5 * Math.sqrt(p * (1 - p) / n) + 0.005;
  const s = staffed(101, ['operate', 'stock']);
  const logs = {};
  for (let t = 0; t < 3600; t += 0.05) {
    F.step(s, 0.05);
    if (s.machine.phase === 'jam') { s.machine.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0 }; }
    s.events.forEach(e => { if (e.kind === 'press' && e.at === 'planer') logs[e.log] = (logs[e.log] || 0) + 1; });
    s.events = [];
  }
  const n = F.LOGS.reduce((a, k) => a + (logs[k] || 0), 0), Z = C.logs.size, Q = C.logs.quality;
  const bySize = z => ['log', 'gnarled', 'sappy'].reduce((a, q) => a + (logs[q + '.' + z] || 0), 0), byQ = q => F.SIZES.reduce((a, z) => a + (logs[q + '.' + z] || 0), 0);
  ok(n > 400 && F.SIZES.every(z => within(bySize(z), n, Z[z])) && ['log', 'gnarled', 'sappy'].every(q => within(byQ(q), n, Q[q])), 'over real play the rack sends every size and quality at its rate', JSON.stringify(logs));
  const fedRate = (() => {
    const t = staffed(107, ['operate', 'stock']); instruct(t, 0, ['gnarled', 'medium', 'sappy']);
    let fedN = 0, tossedN = 0;
    for (let k = 0; k < 144000; k++) {
      F.step(t, 0.05);
      if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; }
      t.events.forEach(e => { if (e.kind === 'made' && e.item === 'rough.m') fedN++; if (e.kind === 'recycled' && e.from === 'in' && e.item === 'gnarled.m') tossedN++; });
      t.events = []; t.bin.length = 0;
    }
    return { fedN, n: fedN + tossedN };
  })();
  ok(fedRate.n > 150 && within(fedRate.fedN, fedRate.n, C.slip), 'over real play, an operator told to recycle gnarled logs still feeds ' + Math.round(C.slip * 100) + '% of them in (it slips)', fedRate.fedN + ' of ' + fedRate.n);
  const findRate = (() => {
    const t = staffed(109, [null, 'stock']); instruct(t, 1, ['stockOnly']); shut(t);
    let found = 0, looked = 0;
    for (let k = 0; k < 72000; k++) {
      if (t.bin.length !== 4 || count(t.bin, 'plank.m') !== 1) { t.bin.length = 0; t.bin.push('plank.s', 'rough.m', 'plank.m', 'plank.l'); }
      t.stalls[0].stock.length = 0;
      F.step(t, 0.05);
      t.events.forEach(e => { if (e.kind === 'looking') looked++; if (e.kind === 'stocked' && e.item === 'plank.m') found++; });
      t.events = [];
    }
    return { found, n: found + looked };
  })();
  ok(findRate.n > 1000 && within(findRate.found, findRate.n, 0.25), 'over real play, a stocker told to stock only medium planks finds one in a bin of four things with one in it one reach in four (medium planks / everything in the bin)', findRate.found + ' of ' + findRate.n);
}

/* ---------- 11. saving, determinism and the bounds, over seeded random play ---------- */
{
  const rnd = (seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })(99);
  const TAPS = ['machine', 'bin', 'counter', 'recycle', 'rack', 'dock', 'floor', 'robot', 'robot', 'saw', 'sawIn', 'sawOut', 'extract', 'extractIn', 'extractOut', 'bench', 'benchIn', 'benchOut'];
  const play = (s, n, choices) => {
    for (let i = 0; i < n; i++) {
      const k = TAPS[Math.floor(rnd() * TAPS.length)];
      if (k === 'robot') { if (s.robots.length) F.tap(s, { kind: 'robot', id: Math.floor(rnd() * s.robots.length) }); }
      else if (k === 'floor') F.tap(s, { kind: 'floor', x: rnd() * 6, y: rnd() * 17 });
      else F.tap(s, { kind: k });
      for (let t = 0; t < 4 + rnd() * 6; t += 0.05) {
        F.step(s, 0.05);
        const o = F.options(s).filter(x => x.enabled);
        if (o.length && rnd() < 0.3) F.choose(s, o[Math.floor(rnd() * o.length)].id);
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
  const all = x => [x.bin, x.rack, x.recycle, x.avatar.inv, x.saw.in, x.saw.out, x.extract.in, x.extract.out, x.bench.in, x.bench.out].concat([x.stalls[0].stock.map(g => g.item)]);
  const s = F.newGame(4);
  s.money = 200;   // so the random player can hire and buy
  let bought = 0;
  play(s, 400, x => {
    if (worst) return;
    x.events.forEach(e => { if (e.kind === 'hired' || e.kind === 'slot') bought += e.price; });
    x.events = [];
    const inside = x.shop.people.filter(c => c.state !== 'out').length;
    if (F.cents(x.money) !== x.money || Math.abs(x.money - (200 + x.earned - x.spent - bought)) > 1e-6) worst = 'money ' + x.money + ' is not earned ' + x.earned + ' less running costs ' + x.spent + ' and purchases ' + bought;
    else if (Math.abs(x.spent - (x.costs.logs + x.costs.fixes + x.costs.saw + x.costs.extract + x.costs.bought)) > 1e-6) worst = 'spent ' + x.spent + ' is not its parts ' + JSON.stringify(x.costs);
    else if (x.satisfaction < C.satMin || x.satisfaction > 100) worst = 'satisfaction ' + x.satisfaction;
    else if (!F.free(x, x.avatar.x, x.avatar.y)) worst = 'avatar inside something at ' + x.avatar.x.toFixed(2) + ',' + x.avatar.y.toFixed(2);
    else if (x.robots.some(r => !F.free(x, r.x, r.y))) worst = 'a robot inside something';
    else if (all(x).some(a => a.some(k => !F.isItem(k)))) worst = 'something that is not a thing in a bin';
    else if (x.stalls[0].stock.length > C.stallCap || inside > P.max) worst = 'stall ' + x.stalls[0].stock.length + ', inside ' + inside;
    else if (x.shop.people.some(c => c.y < L.SOLID.wall[3] || c.y > L.SOLID.counter[1])) worst = 'a customer outside the shop';
    else if (['ready', 'run', 'jam'].indexOf(x.machine.phase) < 0 || F.LOGS.indexOf(x.machine.log) < 0) worst = 'planer ' + x.machine.phase + ' ' + x.machine.log;
    else if (x.robots.some(r => r.slots > C.slots.length || r.rules.length !== r.slots || r.rules.some(id => id !== null && !x.seen[id]) || new Set(r.rules.filter(Boolean)).size !== r.rules.filter(Boolean).length)) worst = 'a robot\'s instructions ' + JSON.stringify(x.robots.map(r => r.rules));
  });
  const tl = s.tally.player;
  ok(!worst && s.robots.length >= 1 && s.spent > 0 && tl.stocked + tl.sawn + tl.extracted + tl.carved > 0, 'over 400 random taps and page visits: money is always whole cents and what was earned less the running costs (logs pressed and bought, fixes, cuts) and purchases, satisfaction in bounds, nobody walks into anything, every bin and your arms hold only things, the stall and the shop never overfill, customers stay in the shop, instructions only ever seen ones',
    worst || (s.robots.length + ' robots, $' + s.money + ', ' + JSON.stringify(tl)));
  const a = play(F.newGame(8), 80), text = F.save(a), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(b && strip(a) === strip(b), 'a save loads back to the same factory: your arms, every bin, the customers, names and instructions included');
  run(a, 30); run(b, 30);
  ok(strip(a) === strip(b), 'and both carry on identically, luck included (the dice live in the save)');
  ok(F.load('{}') === null && F.load('nonsense') === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: C.version + 1 }))) === null && F.load(JSON.stringify(Object.assign(F.newGame(), { version: 2 }))) === null,
    'a save from another version (the factory before the storefront included), or garbage, is not loaded');
  const h = staffed(41); instruct(h, 0, ['sap']);
  const raw = JSON.parse(F.save(h));
  Object.assign(raw, { money: 'lots', spent: -9, satisfaction: 400, seen: { bogus: true } });
  raw.robots[0].slots = 9; raw.robots[0].rules = ['sap', 'sap', 'nonsense', 'price']; raw.robots[0].name = 'x'.repeat(40); raw.robots[1].job = 'sell';
  raw.machine.log = 'stone'; raw.bin = ['plank.m', 'brick', 'plank']; raw.avatar.inv = ['sap', 7, 'carving.dragon']; raw.rack = ['sappy.m', 'stone', 'plank.m', 'log.s']; raw.rackMine = 9;
  raw.stalls = [{ want: 'plank.s', stock: Array(9).fill({ item: 'plank.m', by: 0 }) }];
  raw.shop = { people: [{ id: 1, x: 2, y: 1.15, state: 'dance' }, { id: 2, x: 3, y: 1.15, state: 'wait' }], next: 'soon', n: 3 };
  const hacked = F.load(JSON.stringify(raw));
  ok(hacked && hacked.money === 0 && hacked.spent === 0 && hacked.satisfaction === 100 && hacked.robots[0].slots === 5 && hacked.robots[0].rules.join() === 'sap,,,price,' && hacked.robots[0].name.length === C.nameMax && hacked.robots[1].job === null &&
    hacked.seen.price && !hacked.seen.bogus && hacked.machine.log === 'log.m' && hacked.bin.join() === 'plank.m' && hacked.avatar.inv.join() === 'sap' && hacked.rack.join() === 'sappy.m,log.s' && hacked.rackMine === 2 &&
    hacked.stalls[0].want === 'plank.m' && hacked.stalls[0].stock.length === C.stallCap && hacked.shop.people.length === 1 && Number.isFinite(hacked.shop.next),
    'a hand-edited save is clamped: money, what was spent, satisfaction, slots, instructions, a long name, an old job, an unknown log or thing, a stone or a plank in the planer\'s input bin and more of it yours than it holds, an overfull stall, a customer doing something else', hacked && JSON.stringify([hacked.money, hacked.robots[0].rules, hacked.bin, hacked.avatar.inv, hacked.rack, hacked.stalls[0].stock.length, hacked.shop.people.length]));
  raw.money = -37;
  ok(F.load(JSON.stringify(raw)).money === -37, 'and money below zero is kept: logs cost money');
}

/* ---------- 12. the delay between tasks (the CD, 2026-10-16) ---------- */
// "Add an instruction that lets me add a delay between iterations of its task ... a positive
// integer 0,1,2,...,60 seconds." Every robot can take it, it is on the list from the start, it slips
// 1 in 20, and an operator's iteration is every log it handles
{
  const D = F.RULES.find(q => q.id === 'delay'), W = C.wait;
  let s = F.newGame(61);
  ok(D && D.job === null && D.wait === true && s.seen.delay && W.min === 0 && W.max === 60, 'the delay is one instruction for every job, on the list in a new factory before any mistake, and holds whole seconds from 0 to 60 (the CD\'s numbers)', JSON.stringify(D));
  s = staffed(61, ['operate', 'stock']);
  ok(s.robots.every(r => r.wait === W.start) && [0, 1].every(id => { s.money += F.slotPrice(s, id); return F.buySlot(s, id) && F.setRule(s, id, 0, 'delay'); }) && s.robots.every(r => r.rules.join() === 'delay'),
    'every robot can take it, the operator and the stocker at once, with no mistake seen first; each robot starts at ' + W.start + ' s (assumed: 0 would look like it does nothing)', JSON.stringify(s.robots.map(r => [r.wait, r.rules])));
  const raw = JSON.parse(F.save(s));
  delete raw.seen.delay; raw.robots.forEach(r => { delete r.wait; });
  const old = F.load(JSON.stringify(raw)), bare = F.load(JSON.stringify(Object.assign(JSON.parse(F.save(F.newGame(62))), { seen: { gnarled: true } })));
  ok(old && old.seen.delay && old.robots.every(r => r.wait === W.start) && old.robots[0].rules.join() === 'delay' && bare && bare.seen.delay && bare.seen.gnarled,
    'a save made before the delay loads with it on the list (held by no robot too) and every robot at ' + W.start + ' s (no version bump: nobody loses a factory)');
  const tries = [[0, true], [60, true], [17, true], [-1, false], [61, false], [2.5, false], [NaN, false], [Infinity, false], ['5', false], [null, false], [undefined, false]];
  const wrong = tries.filter(([v, want]) => { const before = s.robots[0].wait, got = F.setWait(s, 0, v); return got !== want || s.robots[0].wait !== (want ? v : before); });
  ok(!wrong.length && !F.setWait(s, 7, 5) && take(s, 'waitset').length === 3, 'the wait takes a whole number of seconds from 0 to 60 and nothing else: -1, 61, 2.5, NaN, Infinity, \'5\', null and nothing are refused, not rounded, and leave it as it was', wrong.map(x => String(x[0])).join());
  F.setRule(s, 1, 0, null);
  ok(F.setWait(s, 1, 9) && s.robots[1].wait === 9 && F.setRule(s, 1, 0, 'delay') && s.robots[1].wait === 9, 'it can be set with the instruction in no slot: the robot keeps the number until the instruction goes back in');
  ok(F.gradeOf('waited') === 'good' && F.gradeOf('straight!') === 'soso', 'in the evals a wait is green, and going straight on against its instructions yellow');
}
{
  // an operator: every log it handles is one iteration, and the wait comes after it
  const gap = (log, rules, wait, slip) => {
    const s = opCycle(log, { slip: slip || many(false, 20) }, rules);
    if (wait !== undefined) F.setWait(s, 0, wait);
    until(s, x => take(x, 'press').length > 1 && x.robots[0].state !== 'press', 40);
    const p = take(s, 'press'), end = take(s, 'made').concat(take(s, 'recycled')).sort((a, b) => a.t - b.t)[0], first = log === 'log.m' ? p[1] : p[0];
    return { s, end: end && end.t, paused: take(s, 'paused')[0], press: first && first.t, r: s.robots[0] };
  };
  // the same gap give or take the 0.05 s steps it is counted in (a state ends on the step after)
  const near = (got, want) => got >= want - 0.06 && got <= want + 0.26;
  const plain = gap('log.m', null), told = gap('log.m', ['delay'], 3);
  ok(told.paused && told.paused.wait === 3 && near(told.paused.t, told.end + 0.05) && near(told.press - told.paused.t, 3 + C.pressSec) && near(plain.press - plain.end, C.stageSec + C.pressSec) && told.r.record.waited === 1,
    'told to wait 3 s, an operator waits 3 s once the cut is out and then presses the next log; without it, it presses as soon as the log has rolled in', 'told ' + (told.press - told.end).toFixed(2) + ' s, plain ' + (plain.press - plain.end).toFixed(2) + ' s');
  const toss = gap('gnarled.m', ['gnarled', 'delay'], 3), toss0 = gap('gnarled.m', ['gnarled']);
  ok(toss.paused && near(toss.paused.t, toss.end) && near(toss.press - toss.end, 3 + C.pressSec) && near(toss0.press - toss0.end, C.stageSec + C.pressSec) && toss.r.record['reject:gnarled.m'] === 1,
    'and after each log it tosses in the recycle bin (the next log rolls in while it waits)', 'told ' + (toss.press - toss.end).toFixed(2) + ' s, plain ' + (toss0.press - toss0.end).toFixed(2) + ' s');
  let s = opCycle('gnarled.m', { slip: many(false, 20) }, ['output', 'delay']); F.setWait(s, 0, 3);
  until(s, x => take(x, 'paused').length > 0, 20);
  const caught = take(s, 'recycled').find(e => e.from === 'out'), pz = take(s, 'paused')[0];
  ok(caught && pz && near(pz.t - caught.t, C.tossSec) && !take(s, 'press').slice(1).length, 'and after it flicks a bad cut off the out-feed into the recycle bin', caught && pz && (pz.t - caught.t).toFixed(2));
  const slip = gap('log.m', ['delay'], 3, [true, false]);
  ok(!take(slip.s, 'paused').length && take(slip.s, 'straight').length === 1 && slip.r.record['straight!'] === 1 && !slip.r.record.waited && near(slip.press - slip.end, C.stageSec + C.pressSec),
    'on a slip (1 in 20) it goes straight on: no wait, and a yellow line in its evals', JSON.stringify(slip.r.record));
  const zero = gap('log.m', ['delay'], 0, []);
  ok(!take(zero.s, 'paused').length && !take(zero.s, 'straight').length && near(zero.press - zero.end, C.stageSec + C.pressSec) && zero.s.force.slip.length === 0 && !zero.r.record.waited,
    'told to wait 0 s it goes straight on, with no line in its evals');
  s = opCycle('log.m', { slip: many(false, 20) }, ['delay']); F.setWait(s, 0, 30);
  until(s, x => x.robots[0].state === 'pause', 20); run(s, 2);
  F.setWait(s, 0, 1); F.step(s, 0.05);
  ok(s.robots[0].state === 'idle' || s.robots[0].state === 'press', 'a shorter wait set while it waits counts at once', s.robots[0].state);
  s = opCycle('log.m', { slip: many(false, 20) }, ['delay']); F.setWait(s, 0, 30);
  until(s, x => x.robots[0].state === 'pause', 20); run(s, 2);
  F.setRule(s, 0, 0, null); F.step(s, 0.05);
  ok(s.robots[0].state === 'idle' || s.robots[0].state === 'press', 'and taking the instruction out of its slot ends the wait', s.robots[0].state);
  s = opCycle('gnarled.m', { slip: many(false, 20) }, ['gnarled', 'delay']); F.setWait(s, 0, 3);
  until(s, x => x.robots[0].state === 'reject', 20);
  s.avatar.x = SP.press.x; s.avatar.y = SP.press.y; F.tap(s, { kind: 'machine' });
  until(s, x => x.robots[0].state !== 'reject', 3);
  const yours = take(s, 'recycled');
  ok(yours.length === 1 && yours[0].by === 'player' && s.robots[0].state === 'idle' && !take(s, 'paused').length && !s.robots[0].record.waited && !s.robots[0].record['reject:gnarled.m'],
    'a log you toss yourself while the robot is lifting it is a log it did not handle, so no wait follows', JSON.stringify(yours.map(e => e.by)) + ' ' + s.robots[0].state);
}
{
  // a stocker: one thing out of the bin, stocked or recycled, is one iteration; a look is not
  const at = (s, kind) => take(s, kind).map(e => e.t);
  const near = (got, want) => got >= want - 0.06 && got <= want + 0.26;
  let s = stockCycle(['plank.m', 'plank.m'], { slip: many(false, 20) }, ['delay']); F.setWait(s, 1, 4);
  until(s, x => x.stalls[0].stock.length === 2, 30);
  const st = at(s, 'stocked'), pz = take(s, 'paused');
  let p = stockCycle(['plank.m', 'plank.m'], {}); until(p, x => x.stalls[0].stock.length === 2, 30);
  const st0 = at(p, 'stocked'), cycle = C.coolSec + C.reachSec + C.placeSec;
  ok(pz.length >= 1 && near(st[1] - st[0], cycle + 4) && near(st0[1] - st0[0], cycle), 'told to wait 4 s, a stocker waits 4 s after each stocking', (st[1] - st[0]).toFixed(2) + ' s vs ' + (st0[1] - st0[0]).toFixed(2) + ' s');
  s = stockCycle(['plank.s', 'plank.m'], { slip: many(false, 20) }, ['smallOut', 'delay']); F.setWait(s, 1, 4);
  until(s, x => x.stalls[0].stock.length === 1, 30);
  const rc = take(s, 'recycled')[0], pr = take(s, 'paused')[0], sk = take(s, 'stocked')[0];
  ok(rc && pr && sk && pr.t > rc.t && pr.t < sk.t && near(sk.t - rc.t, C.coolSec + 4 + C.reachSec + C.placeSec), 'and after each thing it puts in the recycle bin', rc && sk && (sk.t - rc.t).toFixed(2));
  s = stockCycle(['plank.s', 'plank.m'], { slip: many(false, 20), find: [false, true] }, ['stockOnly', 'delay']); F.setWait(s, 1, 4);
  until(s, x => x.stalls[0].stock.length === 1, 30); run(s, 1);
  const lk = take(s, 'looking')[0], sk2 = take(s, 'stocked')[0], pz2 = take(s, 'paused');
  ok(lk && sk2 && pz2.length === 1 && pz2[0].t > sk2.t && near(sk2.t - lk.t, C.lookSec + C.reachSec + C.placeSec), 'but not after a "looking for plank": what it turned up went back, so its job is not done', lk && sk2 && (sk2.t - lk.t).toFixed(2) + ' s, ' + pz2.length + ' waits');
}
{
  // the wait changes when, never what
  const day = (wait, rules) => {
    const t = staffed(31, ['operate', 'stock']);
    if (wait !== null) { instruct(t, 0, ['delay']); instruct(t, 1, ['delay']); F.setWait(t, 0, wait); F.setWait(t, 1, wait); }
    if (rules) instruct(t, 0, rules);
    t.events = [];
    const log = [];
    for (let k = 0; k < 6000; k++) {
      F.step(t, 0.05);
      t.events.forEach(e => { if (e.kind === 'outcome' || e.kind === 'sold' || e.kind === 'recycled' || e.kind === 'looking' || e.kind === 'customer') log.push(e.kind + ':' + (e.what || e.sale || e.item || '')); });
      t.events = [];
      if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; }
    }
    return { log: log.join(), money: t.money, seed: t.seed, sat: t.satisfaction };
  };
  const none = day(null), zero = day(0), three = day(3);
  ok(none.log.length > 200 && zero.log === none.log && zero.money === none.money && zero.seed === none.seed && three.log !== none.log,
    'a wait of 0 s rolls no die: a day with both robots told to wait 0 s is the same day as one without the instruction, roll for roll (and at 3 s it is not)', none.money + ' vs ' + zero.money);
  // an operator alone, nobody in the shop, slips held off: the same logs in the same order, and the
  // same outcome for each, only later
  const alone = wait => {
    const t = opCycle('log.m', { slip: many(false, 5000) }, ['sappy', 'gnarled', 'medium'].concat(wait ? ['delay'] : []));
    feed(t, []); t.force.think = [];
    if (wait) F.setWait(t, 0, wait);
    const out = [];
    for (let k = 0; k < 12000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'outcome') out.push(e.what); }); t.events = []; t.bin.length = 0; }
    return out;
  };
  const fast = alone(0), slow = alone(4);
  ok(slow.length >= 40 && fast.length > slow.length * 1.5 && slow.join() === fast.slice(0, slow.length).join(), 'the wait changes when, never what: told to wait 4 s, an operator handles the same logs in the same order with the same outcomes, only fewer of them in ten minutes', slow.length + ' logs vs ' + fast.length);
}
{
  // taken off its job, sent to rest, saved and loaded while it waits
  let s = staffed(63, ['operate', 'stock'], { slip: many(false, 40) }); shut(s);
  instruct(s, 0, ['delay']); F.setWait(s, 0, 40);
  until(s, x => x.robots[0].state === 'pause', 40);
  const since = s.t;
  s.force = {};   // a save keeps the dice, never a test's queued rolls
  const text = F.save(s), back = F.load(text);
  ok(back && back.robots[0].state === 'pause' && Math.abs(back.robots[0].t - s.robots[0].t) < 1e-9 && back.robots[0].wait === 40, 'saved while it waits, it loads still waiting, as far through its wait as it was');
  run(s, 3); run(back, 3);
  ok(JSON.stringify(Object.assign({}, s, { events: [] })) === JSON.stringify(Object.assign({}, back, { events: [] })), 'and carries on identically');
  F.tap(s, { kind: 'robot', id: 0 }); until(s, x => !!F.bubbleOpen(x), 30);
  const waiting = s.robots[0].state === 'pause';
  F.choose(s, 'job:rest');
  const rested = s.robots[0].state;
  F.tap(s, { kind: 'robot', id: 0 }); until(s, x => !!F.bubbleOpen(x), 40);
  F.choose(s, 'job:operate'); F.step(s, 0.05);
  const back2 = s.robots[0].job === 'operate' && s.robots[0].state !== 'pause';
  s.events = [];
  until(s, x => take(x, 'press').some(e => e.by === 0), 40);
  const again = take(s, 'press').find(e => e.by === 0);
  ok(waiting && rested !== 'pause' && back2 && again && again.t < since + 40, 'sent to rest while it waits it stops waiting, and given its job back it starts on it before its 40 s wait would have run out (no robot stuck waiting)', rested + (again ? ', pressed ' + (again.t - since).toFixed(1) + ' s in' : ''));
  const raw = JSON.parse(text), bad = [[99, 60], [-3, 0], [2.6, 3], ['x', W0()], [null, W0()]];
  function W0() { return C.wait.start; }
  const off = bad.filter(([v, want]) => { raw.robots[0].wait = v; const l = F.load(JSON.stringify(raw)); return !l || l.robots[0].wait !== want; });
  ok(!off.length, 'a bad wait in a save is clamped to a whole number from 0 to 60, or set to ' + C.wait.start + ' s when it is not a number', off.map(x => String(x[0])).join());
}
{
  // overproduction (the CD's open question 2): an instructed operator and stocker, ten minutes
  const tenMin = wait => {
    const s = staffed(51, ['operate', 'stock']);
    instruct(s, 0, ['sappy', 'gnarled', 'medium'].concat(wait ? ['delay'] : []));
    instruct(s, 1, ['smallOut', 'largeOut', 'roughOut']);
    if (wait) F.setWait(s, 0, wait);
    let most = 0;
    for (let k = 0; k < 12000; k++) {
      F.step(s, 0.05); s.events = [];
      if (s.machine.phase === 'jam') { s.machine.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0 }; }
      most = Math.max(most, count(s.bin, 'plank.m'));
    }
    return { end: count(s.bin, 'plank.m'), most, sat: s.satisfaction };
  };
  const without = tenMin(0), withIt = tenMin(3);
  ok(without.end >= 12 && withIt.most <= 3, 'overproduction: without a wait the output bin piles up with medium planks nobody buys; told to wait 3 s a log (about the customers\' pace) the operator keeps it to a handful',
    'without: ' + without.end + ' at the end; with 3 s: ' + withIt.end + ' at the end, ' + withIt.most + ' at most (satisfaction ' + without.sat.toFixed(0) + '% vs ' + withIt.sat.toFixed(0) + '%)');
}

/* ---------- 13. the planer's input bin, and taking things back out (the CD, 2026-10-16) ---------- */
{
  // a new factory: 10 logs in the bin, free; the first log on the in-feed as always
  const s = shut(F.newGame(77));
  const ok10 = s.rack.length === C.startLogs && s.rack.every(k => F.LOGS.indexOf(k) >= 0) && s.rackMine === 0;
  ok(C.startLogs === 10 && C.restock.n === 10 && C.restock.cost === 10 && C.logCost === 0.1 && ok10 && s.money === 0 && s.spent === 0 && s.machine.log === 'log.m' && F.ready(s),
    'a new factory starts with 10 logs in the planer\'s input bin, none of them yours and none paid for, and a normal medium log on the in-feed (the CD: 10 to start, 10 more for $10, and $0.10 a press)', s.rack.join());
  const many5 = Array.from({ length: 300 }, (_, i) => F.newGame(1000 + i)).reduce((a, g) => a.concat(g.rack), []);
  const share = (pred) => many5.filter(pred).length / many5.length;
  ok(Math.abs(share(k => F.sizeOf(k) === 'm') - C.logs.size.m) < 0.04 && Math.abs(share(k => F.kindOf(k) === 'sappy') - C.logs.quality.sappy) < 0.03,
    'they are drawn the way logs are bought: about ' + Math.round(C.logs.size.m * 100) + '% medium and ' + Math.round(C.logs.quality.sappy * 100) + '% sap logs over 300 factories', share(k => F.sizeOf(k) === 'm').toFixed(3) + ' medium, ' + share(k => F.kindOf(k) === 'sappy').toFixed(3) + ' sappy');
  // when the planer needs a log and the bin is empty: 10 more, for $10, the 'log' dice
  const r = feed(shut(F.newGame(3)), []);
  r.force.log = ['log.s', 'log.l', 'gnarled.m', 'sappy.s', 'log.m', 'log.m', 'log.m', 'log.m', 'log.m', 'log.m', 'gnarled.l'];
  F.tap(r, { kind: 'machine' }); until(r, x => x.machine.phase === 'run', 10);
  const before = r.money;
  ok(!take(r, 'restock').length && r.rack.length === 0 && r.machine.log === 'log.m', 'with the bin empty and a log on the in-feed, pressing it buys nothing yet');
  until(r, x => x.machine.phase === 'ready', 10);
  const rs = take(r, 'restock');
  ok(rs.length === 1 && rs[0].n === 10 && rs[0].cost === 10 && rs[0].logs.join() === 'log.s,log.l,gnarled.m,sappy.s,log.m,log.m,log.m,log.m,log.m,log.m' && before - r.money === C.restock.cost && r.costs.bought === 10 && r.force.log.join() === 'gnarled.l' &&
    r.machine.log === 'log.s' && r.rack.length === 9 && r.rackMine === 0,
    'when the planer needs its next log and the bin is empty, 10 more arrive for $10 (ten \'log\' dice, no more) and the first of them rolls in', JSON.stringify(rs.map(e => e.logs)) + ' / $' + (before - r.money));
  // emptying it by hand costs nothing until the planer needs a log
  const h = shut(F.newGame(5));
  F.tap(h, { kind: 'rack' }); until(h, x => !!F.bubbleOpen(x), 20);
  F.options(h).filter(o => o.group === 'take').forEach(o => F.choose(h, o.id));
  ok(!h.rack.length && h.avatar.inv.length === C.startLogs && h.money === 0 && !take(h, 'restock').length && !F.options(h).some(o => o.group === 'take'),
    'every log can be taken out of the planer\'s input bin by hand (a tap a kind), and an empty bin buys nothing by itself', h.avatar.inv.length + ' in your arms, $' + h.money);
  h.machine.log = 'log.m'; F.tap(h, { kind: 'machine' }); until(h, x => x.machine.phase === 'run', 10); until(h, x => x.machine.phase === 'ready', 10);
  ok(take(h, 'restock').length === 1 && h.money === -C.logCost - C.restock.cost && h.rack.length === C.restock.n - 1, 'until the planer needs its next log: then it restocks, and a press and a restock cost $' + F.cents(C.logCost + C.restock.cost).toFixed(2), '$' + h.money);
  // logs you put in roll in before the ones bought; taking a kind out takes yours too
  const y = feed(shut(F.newGame(6)), ['log.m', 'log.l', 'log.m']);
  y.avatar.inv.push('log.s', 'log.s', 'gnarled.m');
  F.tap(y, { kind: 'rack' }); until(y, x => !!F.bubbleOpen(x), 20);
  F.choose(y, 'put:log.s'); F.choose(y, 'put:gnarled.m');
  const putIn = y.rack.join() + '/' + y.rackMine;
  F.choose(y, 'take:log.m');
  const tookM = y.rack.join() + '/' + y.rackMine + '/' + count(y.avatar.inv, 'log.m');
  F.choose(y, 'take:log.s');
  ok(putIn === 'log.s,log.s,gnarled.m,log.m,log.l,log.m/3' && tookM === 'log.s,log.s,gnarled.m,log.l/3/2' && y.rack.join() === 'gnarled.m,log.l' && y.rackMine === 1 && take(y, 'took').every(e => e.at === 'rack'),
    'logs you put in go in front of the ones bought; taking a kind out takes every one of it, yours and the bought ones alike', [putIn, tookM, y.rack.join() + '/' + y.rackMine].join(' | '));
  // the other input bins give things back too (the CD: a plank in the saw, then sell it)
  const w = shut(F.newGame(8));
  w.avatar.inv.push('plank.m', 'plank.s', 'sappy.l', 'rough.m');
  F.tap(w, { kind: 'sawIn' }); until(w, x => !!F.bubbleOpen(x), 30);
  F.choose(w, 'put:plank.m'); F.choose(w, 'put:plank.s');
  const sawOpts = F.options(w).map(o => o.id).join();
  F.choose(w, 'take:plank.m');
  const sawOk = sawOpts === 'take:plank.s,take:plank.m' && w.saw.in.join() === 'plank.s' && count(w.avatar.inv, 'plank.m') === 1;
  F.tap(w, { kind: 'extractIn' }); until(w, x => !!F.bubbleOpen(x), 30);
  F.choose(w, 'put:sappy.l'); F.choose(w, 'take:sappy.l');
  const exOk = !w.extract.in.length && count(w.avatar.inv, 'sappy.l') === 1;
  F.tap(w, { kind: 'benchIn' }); until(w, x => !!F.bubbleOpen(x), 30);
  F.choose(w, 'put:rough.m'); F.choose(w, 'take:rough.m');
  const beOk = !w.bench.in.length && count(w.avatar.inv, 'rough.m') === 1;
  ok(sawOk && exOk && beOk && take(w, 'took').map(e => e.at).join() === 'sawIn,extractIn,benchIn', 'what you put in the table saw\'s, the sap extractor\'s or the bench\'s input bin can be taken back out into your arms (the CD: change your mind and sell the plank)', [sawOpts, sawOk, exOk, beOk].join(' / '));
  F.tap(w, { kind: 'counter' }); until(w, x => !x.avatar.act && x.avatar.task && x.avatar.task.arrived, 30);
  ok(w.stalls[0].stock.length === 1 && w.stalls[0].stock[0].item === 'plank.m', 'and the plank taken back out of the saw\'s bin goes on the counter to sell');
  // no bin has a limit
  const big = shut(F.newGame(9));
  for (let i = 0; i < 40; i++) big.avatar.inv.push('log.m');
  for (let i = 0; i < 300; i++) big.avatar.inv.push('plank.s');
  F.tap(big, { kind: 'rack' }); until(big, x => !!F.bubbleOpen(x), 20); F.choose(big, 'put:log.m');
  F.tap(big, { kind: 'recycle' }); until(big, x => !!F.bubbleOpen(x), 20); F.choose(big, 'put:plank.s');
  ok(big.rack.length === C.startLogs + 40 && big.rackMine === 40 && big.recycle.length === 300 && !big.avatar.inv.length, 'no bin has a limit: 50 logs in the planer\'s input bin, 300 small planks in the recycle bin (the CD)', big.rack.length + ', ' + big.recycle.length);
  // a robot on the planer: the same bin, the same restocks
  const o = staffed(12, ['operate', null]); shut(o);
  feed(o, []);
  let restocks = 0, pulled = 0;
  for (let k = 0; k < 6000; k++) { F.step(o, 0.05); o.events.forEach(e => { if (e.kind === 'restock') restocks++; if (e.kind === 'press' && e.at === 'planer') pulled++; }); o.events = []; if (o.machine.phase === 'jam') { o.machine.dirt = 0.001; o.avatar.act = { kind: 'clean', t: 0 }; } o.bin.length = 0; o.recycle.length = 0; }
  ok(restocks >= 3 && o.costs.bought === restocks * C.restock.cost && o.costs.logs === F.cents(pulled * C.logCost) && o.rack.length < C.restock.n, 'a robot on the planer works through the same bin, and it restocks the same way: $10 for ten, and $0.10 a press on top', restocks + ' restocks, ' + pulled + ' presses');
  // saves: what is yours in the bin is kept; a save from before the bin gets its 10 logs
  const sv = feed(shut(F.newGame(10)), ['log.l', 'log.m', 'sappy.s']); sv.rackMine = 1;
  const back = F.load(F.save(sv));
  ok(back && back.rack.join() === 'log.l,log.m,sappy.s' && back.rackMine === 1, 'a save keeps the planer\'s input bin and which logs in it are yours');
  const old = JSON.parse(F.save(sv)); old.rack = ['log.s', 'log.l']; delete old.rackMine; delete old.costs.bought;
  const was = F.load(JSON.stringify(old));
  ok(was && was.rack.length === 2 + C.startLogs && was.rack.slice(0, 2).join() === 'log.s,log.l' && was.rackMine === 2 && was.costs.bought === 0 && was.money === sv.money,
    'a save made before the bin of bought logs keeps its rack as yours, gets the 10 a new factory starts with behind them, free (no version bump)', was && was.rack.join());
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
