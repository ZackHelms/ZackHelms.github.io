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
 * about another job doing nothing, the rates as MEASURED over real play, saving, the delay
 * between tasks (the CD, 2026-10-16: an instruction for every robot, on the list from the start,
 * holding 0-60 whole seconds), the planer's input bin of bought logs, and the counter's four stalls
 * (the CD, 2026-10-16: bought for $50 / $100 / $150, each set to sell any thing with a price, unsold
 * stock back into your arms, customers picking a stall at random and waiting there), and eight robots
 * (the same day: $20 to $160, a robot for each stall fetching its thing from the bin it comes out of
 * and told "Only stock X" for each thing, and robots on slots 02-04 that make no mistakes yet).
 * Since the goals (the CD, 2026-10-20): a new factory has only slot 01 and its one stall; three
 * goals on the wall unlock slots 02-04 (the sap extractor, the bench, the table saw, the machines
 * moved into that order), and a robot and a stall each cost a flat $1, set per factory (section 16).
 * Rows that use slots 02-04 open them on purpose (`open3`, every goal met), as every row written
 * before the goals assumed, and the prices of the stalls arc are restated at the flat price.
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
const STOCKERS = ['stockOnly', 'smallOut', 'largeOut', 'roughOut'];   // the first stall's robot's, on medium planks
// the dice, made quiet: normal medium logs, no thinking, no customers (each queue is what the
// next rolls of that name come up)
const calm = () => ({ log: many('log.m'), think: many(false) });
const shut = s => { s.shop.next = 1e9; return s; };   // nobody comes in
// every goal met: slots 02-04 open, as every factory had them before the goals (2026-10-20)
const open3 = s => { s.goal = C.goals.length; return s; };
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
  const list = jobs || ['operate', 'stock:0'];
  s.money = list.length * s.flat.robot;   // a flat price each (2026-10-20)
  if (list.some(j => F.SLOT_JOBS.indexOf(j) >= 0)) open3(s);
  list.forEach(job => {
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
  delay: 'Wait between tasks',   // the delay (the CD, 2026-10-16; the wording assumed)
  // one for each thing a stall can sell (the CD, 2026-10-16: "Only stock small planks, Only stock
  // 2x4s, ..."; the sizes and the wording of the rest assumed)
  'only:plank.s': 'Only stock small planks', 'only:plank.l': 'Only stock large planks', 'only:sap': 'Only stock sap',
  'only:b2x4.s': 'Only stock small 2x4s', 'only:b2x4.m': 'Only stock medium 2x4s', 'only:b2x4.l': 'Only stock large 2x4s',
  'only:b2x2.s': 'Only stock small 2x2s', 'only:b2x2.m': 'Only stock medium 2x2s', 'only:b2x2.l': 'Only stock large 2x2s',
  'only:dowels.s': 'Only stock small dowel rods', 'only:dowels.m': 'Only stock medium dowel rods', 'only:dowels.l': 'Only stock large dowel rods'
};
// the instructions on the list that a mistake put there (the delay is on it from the start)
const learnt = s => F.known(s).filter(q => !q.start).map(q => q.id).join();
// customers standing in the shop, as if they had walked in: the first at the stall's place, the
// rest in the line along the back wall (all of them for the first stall unless told otherwise)
function queue(s, n, stall) {
  const i = stall || 0;
  for (let k = 0; k < n; k++) {
    const first = k === 0 && !s.shop.people.some(c => c.state !== 'out' && c.stall === i);
    const inLine = s.shop.people.filter(c => c.state !== 'out' && c.at === 'line').length;
    s.shop.people.push({ id: s.shop.n++, x: first ? L.SHOP.places[i] : L.SHOP.x0 - inLine * P.gap, y: first ? L.SHOP.lineY : L.SHOP.backY, state: 'in', t: 0, stall: i, at: first ? 'stall' : 'line', item: null, by: null, wrong: false });
  }
  return s;
}

/* ---------- 1. the tables ---------- */
{
  ok(C.flat.robot === 1 && C.flat.stall === 1 && C.flat.min === 0 && C.flat.max === 200 && C.hire === undefined && C.names.length === 8, 'eight robots, each a flat $1 until set otherwise (the CD, 2026-10-20: it was $20 to $160), the price whole dollars from $0 to $200 (the bounds assumed)', JSON.stringify(C.flat));
  ok(C.processSec === 4 && F.priceOf('plank.m') === 4, 'a plank takes 4 s and a medium plank sells for $4 (the CD, 2026-10-15: down from $5)', F.priceOf('plank.m'));
  const cut = z => ['b2x4', 'b2x2', 'dowels'].map(c => F.priceOf(c + '.' + z));
  ok(F.priceOf('plank.s') === 2 && F.priceOf('plank.l') === 8 && F.priceOf('sap') === 1 && cut('s').join() === '3,3,3' && cut('m').join() === '6,6,6' && cut('l').join() === '12,12,12',
    'the CD\'s prices: planks $2 / $4 / $8 by length, sap $1, and two 2"x4"s, four 2"x2"s or sixteen dowel rods $3 / $6 / $12 by the length they came from', [F.priceOf('plank.s'), F.priceOf('plank.l'), F.priceOf('sap')].concat(cut('s'), cut('l')).join());
  ok(C.stalls.n === 4 && C.stalls.start === 'plank.m' && C.stalls.prices === undefined, 'the counter has room for four stalls: the first sells medium planks from the start, and each of the other three costs the flat price for a stall, $1 (the CD, 2026-10-20: it was $50, $100 and $150)', JSON.stringify(C.stalls));
  ok(F.SELLS.join() === 'plank.s,plank.m,plank.l,sap,b2x4.s,b2x4.m,b2x4.l,b2x2.s,b2x2.m,b2x2.l,dowels.s,dowels.m,dowels.l' && F.SELLS.every(k => F.priceOf(k) !== null) && F.ITEMS.filter(k => F.SELLS.indexOf(k) < 0).every(k => F.priceOf(k) === null),
    'a stall can sell anything with a price: the three planks, sap and the nine cuts; logs, gnarled planks and carvings have no price, so no stall sells them (assumed)', F.SELLS.join());
  ok(C.logCost === 0.1 && C.fixCost === 5 && C.sawCost === 0.1 && C.extractCost === 0.1, 'every machine costs $0.10 for each thing it processes, the planer, the table saw and the sap extractor (electricity and wear, the CD 2026-10-16), and fixing a sap jam $5', [C.logCost, C.fixCost, C.sawCost, C.extractCost].join());
  const fl = ['log.s', 'sappy.l', 'plank.s', 'plank.l', 'rough.m', 'b2x4.s', 'dowels.l', 'sap', 'carving.owl'].map(F.floorOf);
  ok(fl.join() === '1,1,1.1,1.1,1.1,1.2,1.2,0.1,1' && C.floor.plank === F.cents(C.floor.log + C.logCost) && C.floor.cut === F.cents(C.floor.plank + C.sawCost),
    'what each thing cost to make, the least it ever sells for: a log $1, any plank $1.10 and any cut $1.20 (the CD\'s numbers: a log and the machines\' runs), sap $0.10, a carving $1', fl.join());
  ok(C.satWait === 0.1 && C.shop.max >= 4, 'each customer waiting costs 0.1% of customer satisfaction a second (the CD\'s number), and the shop holds a line of ' + P.max);
  ok(JSON.stringify(C.slots) === '[5,10,15,20,25]' && C.slotsAt === 2, 'instruction slots cost $5 / $10 / $15 / $20 / $25 for each robot (the CD\'s numbers), once two robots are on staff', C.slots.join() + ' at ' + C.slotsAt);
  ok(F.RULES.length === 26 && F.RULES.every(q => RULE_TEXT[q.id] === q.text) && Object.keys(RULE_TEXT).length === 26, 'the instruction pool is twenty-six, word for word', F.RULES.map(q => q.text).join(' | '));
  const ONLY_IDS = 'only:plank.s,stockOnly,only:plank.l,only:sap,only:b2x4.s,only:b2x4.m,only:b2x4.l,only:b2x2.s,only:b2x2.m,only:b2x2.l,only:dowels.s,only:dowels.m,only:dowels.l';
  ok(F.RULES.filter(q => q.job === 'operate').map(q => q.id).join() === 'sap,sappy,gnarled,medium,smallLog,largeLog,mediumLog,output' && F.RULES.filter(q => q.job === 'stock').map(q => q.id).join() === ONLY_IDS + ',price,smallOut,largeOut,roughOut' && F.RULES.filter(q => q.job !== 'operate' && q.job !== 'stock').map(q => q.id).join() === 'delay',
    'eight are about running the planer, seventeen about stocking a stall, and one, the delay, about every job');
  ok(F.SELLS.every(k => F.ONLY[k] && F.RULES.find(q => q.id === F.ONLY[k]).only === k) && F.RULES.filter(q => q.only).length === F.SELLS.length && F.ONLY['plank.m'] === 'stockOnly',
    'one "Only stock X" for each of the thirteen things a stall can sell (the CD, 2026-10-16: "rules per item"), "Only stock medium planks" among them as it always was', F.SELLS.map(k => F.ONLY[k]).join());
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
  ok(F.BASE.operate === 'Use the planer to refine raw materials.' && F.BASE.stock === 'Stock the sales counter with the items in this bin.', 'the base prompts: "use the planer to refine raw materials" and, for every stall\'s robot alike (the CD), "stock the sales counter with the items in this bin"');
  ok(F.SLOT_JOBS.join() === 'extract,carve,saw' && F.SLOT_JOBS.every(j => typeof F.BASE[j] === 'string' && F.BASE[j].length > 10) && Object.keys(F.BASE).length === 5, 'slots 02 to 04 have a job each, in slot order (2026-10-20): the sap extractor, the bench and the table saw, each with a base prompt (the wording assumed)', F.SLOT_JOBS.join());
  ok(C.slip > 0 && C.slip <= 0.1 && C.names.length === 8 && new Set(C.names).size === C.names.length, 'a robot slips on an instruction rarely (' + C.slip + '), and the robots start with names of their own');
}

/* ---------- 2. the floor ---------- */
{
  const s = open3(F.newGame());   // every slot's machine in place (section 16 walks each unlock)
  const keys = Object.keys(SP).filter(k => ['rest', 'stalls', 'stallBots', 'fetch'].indexOf(k) < 0);
  const spots = keys.map(k => Object.assign({ k }, SP[k])).concat(SP.stalls.slice(1).map((p, i) => Object.assign({ k: 'stall' + (i + 2) }, p)),
    SP.stallBots.slice(1).map((p, i) => Object.assign({ k: 'stallBot' + (i + 2) }, p)),
    [].concat.apply([], Object.keys(SP.fetch).map(b => SP.fetch[b].map((p, i) => Object.assign({ k: b + '@' + (i + 1) }, p)))).filter(p => p.k !== 'bin@1'));
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
  const rows = [L.ROW.planer, L.ROW.extract, L.ROW.bench, L.ROW.saw];
  ok(rows.every((y, i) => !i || y > rows[i - 1] + 2) && L.STALL.y1 <= L.SOLID.counter[3] && L.SHOP.lineY < L.SOLID.counter[1] && L.ROW.planer > L.SOLID.counter[3] + 1, 'from the back: the shop, the counter, the walkway, then slots 01 to 04 one under another: the planer, the sap extractor, the bench, the table saw (2026-10-20)', rows.join());
  // the counter's four stalls (the CD, 2026-10-16), and the shop's three rows behind it (assumed)
  const S4 = L.STALLS, ct = L.SOLID.counter, sh = L.SHOP;
  ok(S4.length === C.stalls.n && S4[0] === L.STALL && S4.every((q, i) => q.x0 >= ct[0] && q.x1 <= ct[2] && q.y0 >= ct[1] && q.y1 <= ct[3] && (!i || q.x1 < S4[i - 1].x0)) && SP.stalls[0] === SP.counter &&
    SP.stalls.every((p, i) => p.x > S4[i].x1 && p.x - S4[i].x1 < 0.3 && p.y > ct[3] && p.face === SP.counter.face) && sh.places.every((x, i) => x > S4[i].x0 && x < S4[i].x1) && sh.places[0] === sh.x0,
    'four stalls along the counter, side by side east to west, the first where the one stall always stood; each is stocked standing just east of it on the walkway, and its customer waits across the counter from it', S4.map(q => q.x0 + '-' + q.x1).join(' '));
  ok(L.SOLID.wall[3] < sh.backY - 0.2 && sh.backY < sh.laneY && sh.laneY < sh.lineY && sh.lineY < ct[1] - 0.2 && sh.door.y === sh.laneY && sh.x0 - (P.max - 2) * P.gap > 0.3,
    'the shop behind it, from the back wall: the line, the walk (in from the door and back out), then the places at the stalls; and a line of everyone but one fits along the wall', [sh.backY, sh.laneY, sh.lineY].join());
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
  F.tap(s, { kind: 'stall', i: 0 });
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
  until(two, x => x.shop.people[0].state === 'pay' && x.shop.people[1].state === 'wait', 5); F.step(two, 0.05);
  const sec = two.shop.people[1];
  ok(two.shop.people[0].state === 'pay' && sec.state === 'wait' && sec.at === 'line' && sec.x === L.SHOP.x0 && sec.y === L.SHOP.backY && two.stalls[0].stock.length === 1, 'with a plank left for the second customer, it still waits its turn, in the line along the back wall behind the first', sec.at + ' ' + sec.x + ',' + sec.y);
  // the line moves up
  until(s, x => x.shop.people[0].state === 'out', 10);
  const left = s.t, next = s.shop.people.find(p => p.state !== 'out');
  until(s, x => Math.abs(next.x - L.SHOP.x0) < 0.02 && next.state === 'wait', 5);
  ok(Math.abs(next.x - L.SHOP.x0) < 0.02 && next.y === L.SHOP.lineY && next.at === 'stall' && s.t - left < P.gap / P.speed + 0.2, 'and when the first is served, the next steps up from the line to the stall', next.x.toFixed(2) + ',' + next.y + ' after ' + (s.t - left).toFixed(2) + ' s');
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
  F.tap(s, { kind: 'stall', i: 0 }); until(s, x => !x.avatar.act && x.avatar.task.arrived, 20);
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
  // (the stalls arc's $19 / $20 / $40 / $60-$160 rows, restated at the flat $1: 2026-10-20)
  const s = open3(shut(F.newGame()));
  s.money = 0.99;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 20);
  const poor = F.options(s)[0];
  ok(poor.id === 'hire' && !poor.enabled && poor.price === 1 && !F.choose(s, 'hire') && s.money === 0.99 && !s.robots.length, 'at $0.99 the dock shows the $1 robot greyed, and refuses');
  s.money = 1;
  ok(F.choose(s, 'hire') && s.money === 0 && s.robots.length === 1 && s.robots[0].state === 'unbox' && s.robots[0].name === C.names[0], 'at $1 a robot is hired, climbs out of its crate, and has a name');
  const after = F.options(s);
  ok(F.bubbleOpen(s).kind === 'robot' && after.map(x => x.id).join() === 'job:operate,job:stock:0,job:extract,job:carve,job:saw,job:rest,notes', 'the bubble turns straight to the new robot: the planer, stocking the one stall, with every goal met the sap extractor, the bench and the table saw (in slot order), rest, and its clipboard', after.map(x => x.id).join());
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 5);
  ok(F.options(s)[0].price === 1, 'the second robot costs $1 too, the same flat price', F.options(s)[0].price);
  s.money = 1; F.choose(s, 'hire');
  const paidFor = [];
  for (let k = 2; k < C.names.length; k++) {
    F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 10);
    const o = F.options(s)[0];
    s.money = o.price; paidFor.push(o.price);
    F.choose(s, 'hire');
  }
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 10);
  const out = F.options(s)[0];
  ok(paidFor.join() === '1,1,1,1,1,1' && s.robots.length === 8 && s.robots.map(r => r.name).join() === C.names.join() && !out.enabled && out.soldOut && out.price === null && (s.money = 999) && !F.choose(s, 'hire') && s.robots.length === 8,
    'the third to the eighth cost $1 each, each with a name of its own, and after eight there are no more to hire, whatever the money', paidFor.join());
  const t = staffed(3, ['operate', 'stock:0'], calm()); shut(t);
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
  ok(st.job === 'operate' && op.job === 'stock:0', 'giving a robot a job someone has swaps them', op.job + '/' + st.job);
  const u = staffed(5, [null, 'stock:0']); shut(u);
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
  const s = staffed(13, [null, 'stock:0']); shut(s);
  if (rules) instruct(s, 1, rules);
  until(s, x => x.robots[1].state === 'idle' && dist(x.robots[1], SP.stock) < 0.07, 40);
  s.events = []; bin.forEach(k => s.bin.push(k));
  Object.keys(force || {}).forEach(k => { s.force[k] = force[k].slice(); });
  return s;
}
{
  let s = stockCycle(['plank.m']);
  until(s, x => x.stalls[0].stock.length > 0, 10);
  ok(s.stalls[0].stock[0].item === 'plank.m' && s.robots[1].record['stock:plank.m'] === 1 && s.robots[1].tally.good === 1 && !s.bin.length, 'a medium plank: into the stall, green');
  for (const item of ['plank.s', 'plank.l', 'rough.m', 'rough.l']) {
    s = stockCycle([item]);
    until(s, x => x.stalls[0].stock.length > 0, 10);
    const out = item === 'plank.s' ? 'smallOut' : item === 'plank.l' ? 'largeOut' : 'roughOut';
    ok(s.stalls[0].stock[0].item === item && s.robots[1].record['misstock:' + item + '@plank.m'] === 1 && s.robots[1].tally.bad === 1 && s.seen.stockOnly && s.seen.price && s.seen[out],
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
  const b = staffed(22, ['operate', 'stock:0']); instruct(b, 0, ['sap']);
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
    until(s, x => x.bin.length > 0 || x.machine.phase === 'jam', 30);
    const r = take(s, 'recycled')[0];
    if (!(r && r.item === log && r.from === 'in' && s.bin.join() === 'plank.m' && s.robots[0].record['reject:' + log] === 1 && !take(s, 'jam').length && s.spent === C.logCost)) missed.push(log + '/' + rule);
  });
  ok(!missed.length, 'each operator instruction keeps out the logs it names, by quality or by size: the log goes in the recycle bin, the next one is cut, and only that one is paid for (sap logs too: no jam)', missed.join());
  const lets = [['log.s', 'largeLog'], ['gnarled.m', 'medium'], ['sappy.m', 'smallLog'], ['log.l', 'gnarled']];
  const leaked = [];
  lets.forEach(([log, rule]) => {
    const s = opCycle(log, { slip: [false] }, [rule]);
    until(s, x => x.bin.length > 0 || x.machine.phase === 'jam', 30);
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
  ok(!h.stalls[0].stock.length && !take(h, 'recycled').length && h.bin.join() === 'plank.s,rough.m' && h.robots[1].record['looking:plank.m'] >= 6 && take(h, 'looking').length === h.robots[1].record['looking:plank.m'],
    '"' + RULE_TEXT.stockOnly + '": with only a small plank and a gnarled one in the bin, the stocker stocks nothing and takes nothing out; each reach is a "looking for plank"', h.bin.join() + ' / looking ' + h.robots[1].record['looking:plank.m']);
  ok(joined === 'roughOut,smallOut', 'and what it keeps turning up puts the instruction that would clear it on the list (a way out of a bin full of junk)', joined);
  h = stockCycle(['plank.s', 'rough.m', 'plank.m', 'plank.l'], { slip: [false, true, true], find: [false, false, true] }, ['stockOnly']);
  until(h, x => x.stalls[0].stock.length > 0, 12);
  ok(h.robots[1].record['looking:plank.m'] === 2 && h.stalls[0].stock[0].item === 'plank.m' && h.bin.join() === 'plank.s,rough.m,plank.l' && h.force.slip.join() === 'true,true' && !h.force.find.length,
    'two reaches turn up something else, the third a medium plank, which it stocks; it decided once for that stocking whether to follow the instruction (one slip die for the whole hunt)', 'looking ' + h.robots[1].record['looking:plank.m'] + ', bin ' + h.bin.join());
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
  ok(h.robots[1].record['looking:plank.m!'] === 1 && h.robots[1].record['recycle:plank.s'] === 1, 'a slip on a recycle instruction puts the thing back (a "looking for plank" against its instructions), and the next reach clears it');
  // the slip
  s = opCycle('gnarled.m', { slip: [true] }, ['gnarled']);
  until(s, x => x.bin.length > 0, 20);
  ok(s.bin.join() === 'rough.m' && s.robots[0].record['cut:gnarled.m!'] === 1, 'on a slip the instruction is ignored: the gnarled log goes in anyway, and its evals say it was against its instructions');
  h = stockCycle(['rough.m'], { slip: [true] }, ['stockOnly']);
  until(h, x => x.stalls[0].stock.length > 0, 12);
  ok(h.robots[1].record['misstock:rough.m@plank.m!'] === 1 && h.robots[1].tally.bad === 1 && !h.robots[1].record['looking:plank.m'], 'and a slipping stocker does not hunt: it stocks what comes next, red against its instructions (red stays red)', JSON.stringify(h.robots[1].record));
  const reds = Object.keys(F.GRADE).filter(k => F.GRADE[k] === 'bad').sort().join(), G = k => F.gradeOf(k);
  ok(reds === 'jam,misstock' && G('jam:sappy.m!') === 'bad' && G('misstock:plank.s') === 'bad' && G('cut:log.s') === 'soso' && G('looking') === 'soso' && G('think') === 'soso' &&
    G('reject:log.s') === 'good' && G('recycle:rough.m') === 'good' && G('stock') === 'good' && G('stock!') === 'soso' && G('plank!') === 'soso', 'red only for a jam and for something else put in the medium plank stall; done against its instructions, green turns yellow', reds);
  s = staffed(37, ['operate', 'stock:0']); run(s, 60);
  const before = Object.keys(s.robots[0].record).length;
  ok(before > 0 && F.resetEvals(s, 0) && !Object.keys(s.robots[0].record).length && s.robots[0].since === s.t && Object.keys(s.robots[1].record).length > 0 && !F.resetEvals(s, 7), 'resetting a robot\'s evals empties its counts and starts its clock, and leaves the other robot\'s alone');
  // an instruction about another job does nothing: same dice, same day, exactly
  const day = rules => {
    const t = staffed(31, ['operate', 'stock:0']);
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
    const t = staffed(35, ['operate', 'stock:0']); if (rules) instruct(t, 0, rules);
    t.force.slip = many(false, 5000);
    let junk = 0, stocked = 0;
    for (let k = 0; k < 12000; k++) { F.step(t, 0.05); t.events.forEach(e => { if (e.kind === 'binned' && e.item !== 'plank.m') junk++; if (e.kind === 'stocked') stocked++; }); t.events = []; if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; } }
    return { t, junk, stocked };
  };
  const told = upstream(['sappy', 'gnarled', 'medium', 'output']), untold = upstream(null);
  ok(!told.junk && told.stocked > 40 && !told.t.seen.stockOnly && untold.junk > 20 && untold.t.seen.stockOnly, 'an operator told about every bad log hands the stocker only medium planks, so "' + RULE_TEXT.stockOnly + '" never joins the list; untold, it does within ten minutes', 'told: ' + told.junk + ' junk binned, ' + told.stocked + ' stocked; untold: ' + untold.junk);
  s = staffed(33, ['operate', 'stock:0']); instruct(s, 0, ['gnarled']);
  F.tap(s, { kind: 'robot', id: 1 }); until(s, x => !!F.bubbleOpen(x), 30); F.choose(s, 'job:operate');
  ok(s.robots[1].job === 'operate' && s.robots[0].job === 'stock:0' && s.robots[0].rules.join() === 'gnarled' && !s.robots[1].rules.length, 'swap the robots\' jobs and each keeps its own instructions');
}

/* ---------- 9. slots 02-04: the table saw, the sap extractor, the bench ---------- */
{
  const s = open3(shut(F.newGame()));
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
  ok(F.priceOf('carving.bird') === null && F.priceOf('rough.m') === null && s.stalls.every((q, i) => i ? !q.bought && q.want === null : q.want === 'plank.m'), 'carvings and gnarled planks have no price yet, and the one stall a factory starts with sells medium planks');
  const t = open3(staffed(41, ['operate', 'stock:0']));
  F.tap(t, { kind: 'robot', id: 0 }); until(t, x => !!F.bubbleOpen(x), 30);
  ok(['job:saw', 'job:extract', 'job:carve'].every(id => F.options(t).some(o => o.id === id && o.enabled)), 'and a robot can be put on any of slots 02-04 (the CD, 2026-10-16; section 15 has what each does)', F.options(t).map(o => o.id).join());
}

/* ---------- 10. the rates, measured over real play ---------- */
{
  const within = (got, n, p) => Math.abs(got / n - p) <= 3.5 * Math.sqrt(p * (1 - p) / n) + 0.005;
  const s = staffed(101, ['operate', 'stock:0']);
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
    const t = staffed(107, ['operate', 'stock:0']); instruct(t, 0, ['gnarled', 'medium', 'sappy']);
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
    const t = staffed(109, [null, 'stock:0']); instruct(t, 1, ['stockOnly']); shut(t);
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
  const TAPS = ['machine', 'bin', 'stall', 'stall', 'recycle', 'rack', 'dock', 'floor', 'robot', 'robot', 'saw', 'sawIn', 'sawOut', 'extract', 'extractIn', 'extractOut', 'bench', 'benchIn', 'benchOut'];
  const play = (s, n, choices) => {
    for (let i = 0; i < n; i++) {
      const k = TAPS[Math.floor(rnd() * TAPS.length)];
      if (k === 'robot') { if (s.robots.length) F.tap(s, { kind: 'robot', id: Math.floor(rnd() * s.robots.length) }); }
      else if (k === 'floor') F.tap(s, { kind: 'floor', x: rnd() * 6, y: rnd() * 17 });
      else if (k === 'stall') F.tap(s, { kind: 'stall', i: Math.floor(rnd() * 4) });
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
  const all = x => [x.bin, x.rack, x.recycle, x.avatar.inv, x.saw.in, x.saw.out, x.extract.in, x.extract.out, x.bench.in, x.bench.out].concat(x.stalls.map(st => st.stock.map(g => g.item)));
  const s = open3(F.newGame(4));   // (slots 02-04 open: section 16 has the goals)
  s.money = 200;   // so the random player can hire and buy
  let bought = 0;
  play(s, 400, x => {
    if (worst) return;
    x.events.forEach(e => { if (e.kind === 'hired' || e.kind === 'slot' || e.kind === 'stallbought') bought += e.price; });
    x.events = [];
    const inside = x.shop.people.filter(c => c.state !== 'out').length;
    if (F.cents(x.money) !== x.money || Math.abs(x.money - (200 + x.earned - x.spent - bought)) > 1e-6) worst = 'money ' + x.money + ' is not earned ' + x.earned + ' less running costs ' + x.spent + ' and purchases ' + bought;
    else if (Math.abs(x.spent - (x.costs.logs + x.costs.fixes + x.costs.saw + x.costs.extract + x.costs.bought)) > 1e-6) worst = 'spent ' + x.spent + ' is not its parts ' + JSON.stringify(x.costs);
    else if (x.satisfaction < C.satMin || x.satisfaction > 100) worst = 'satisfaction ' + x.satisfaction;
    else if (!F.free(x, x.avatar.x, x.avatar.y)) worst = 'avatar inside something at ' + x.avatar.x.toFixed(2) + ',' + x.avatar.y.toFixed(2);
    else if (x.robots.some(r => !F.free(x, r.x, r.y))) worst = 'a robot inside something';
    else if (all(x).some(a => a.some(k => !F.isItem(k)))) worst = 'something that is not a thing in a bin';
    else if (x.stalls.some(st => st.stock.length > C.stallCap) || inside > P.max) worst = 'stalls ' + x.stalls.map(st => st.stock.length) + ', inside ' + inside;
    else if (!x.stalls[0].bought || !x.stalls[0].want || x.stalls.some(st => st.bought ? st.want !== null && F.SELLS.indexOf(st.want) < 0 : st.want !== null || st.stock.length)) worst = 'a stall ' + JSON.stringify(x.stalls.map(st => [st.bought, st.want]));
    else if (x.shop.people.some(c => c.state !== 'out' && !(x.stalls[c.stall].bought && x.stalls[c.stall].want))) worst = 'a customer at a stall that sells nothing';
    else if (x.shop.people.some(c => c.y < L.SOLID.wall[3] || c.y > L.SOLID.counter[1])) worst = 'a customer outside the shop';
    else if (['ready', 'run', 'jam'].indexOf(x.machine.phase) < 0 || F.LOGS.indexOf(x.machine.log) < 0) worst = 'planer ' + x.machine.phase + ' ' + x.machine.log;
    else if (x.robots.some(r => r.slots > C.slots.length || r.rules.length !== r.slots || r.rules.some(id => id !== null && !x.seen[id]) || new Set(r.rules.filter(Boolean)).size !== r.rules.filter(Boolean).length)) worst = 'a robot\'s instructions ' + JSON.stringify(x.robots.map(r => r.rules));
  });
  const tl = s.tally.player;
  ok(!worst && s.robots.length >= 1 && s.spent > 0 && tl.stocked + tl.sawn + tl.extracted + tl.carved > 0 && s.stalls.filter(st => st.bought).length > 1, 'over 400 random taps and page visits: money is always whole cents and what was earned less the running costs (logs pressed and bought, fixes, cuts) and purchases (robots, slots, stalls), satisfaction in bounds, nobody walks into anything, every bin and your arms hold only things, no stall and not the shop ever overfills, a stall sells only a thing with a price and one not bought sells nothing, customers stay in the shop and only come for a stall that sells something, instructions only ever seen ones',
    worst || (s.robots.length + ' robots, ' + s.stalls.filter(st => st.bought).length + ' stalls, $' + s.money + ', ' + JSON.stringify(tl)));
  const a = play(open3(F.newGame(8)), 80), text = F.save(a), b = F.load(text);
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
  raw.stalls = [{ want: 'rough.m', stock: Array(9).fill({ item: 'plank.m', by: 0 }) }, { bought: true, want: 'carving.owl', stock: [] }, { want: 'plank.s', stock: [{ item: 'plank.s', by: 'player' }] }, 'stall'];
  raw.shop = { people: [{ id: 1, x: 2, y: 1.15, state: 'dance' }, { id: 2, x: 3, y: 1.15, state: 'wait' }], next: 'soon', n: 3 };
  const hacked = F.load(JSON.stringify(raw));
  ok(hacked && hacked.money === 0 && hacked.spent === 0 && hacked.satisfaction === 100 && hacked.robots[0].slots === 5 && hacked.robots[0].rules.join() === 'sap,,,price,' && hacked.robots[0].name.length === C.nameMax && hacked.robots[1].job === null &&
    hacked.seen.price && !hacked.seen.bogus && hacked.machine.log === 'log.m' && hacked.bin.join() === 'plank.m' && hacked.avatar.inv.join() === 'sap' && hacked.rack.join() === 'sappy.m,log.s' && hacked.rackMine === 2 &&
    hacked.stalls[0].want === 'plank.m' && hacked.stalls[0].stock.length === C.stallCap && JSON.stringify(hacked.stalls.slice(1)) === '[{"bought":true,"want":null,"stock":[]},{"bought":false,"want":null,"stock":[]},{"bought":false,"want":null,"stock":[]}]' &&
    hacked.shop.people.length === 1 && Number.isFinite(hacked.shop.next),
    'a hand-edited save is clamped: money, what was spent, satisfaction, slots, instructions, a long name, an old job, an unknown log or thing, a stone or a plank in the planer\'s input bin and more of it yours than it holds, an overfull stall, a stall selling something with no price, a stall not bought holding things, a customer doing something else', hacked && JSON.stringify([hacked.money, hacked.robots[0].rules, hacked.bin, hacked.avatar.inv, hacked.rack, hacked.stalls, hacked.shop.people.length]));
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
  s = staffed(61, ['operate', 'stock:0']);
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
    const t = staffed(31, ['operate', 'stock:0']);
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
  let s = staffed(63, ['operate', 'stock:0'], { slip: many(false, 40) }); shut(s);
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
    const s = staffed(51, ['operate', 'stock:0']);
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
  // (relative, not a count: 12 or more held on this seed only by luck; main itself left 11 on seed
  // 53, and the dock of eight's longer first walks left 11 here, with the paced bin at 2)
  const without = tenMin(0), withIt = tenMin(3);
  ok(without.end > C.stallCap && without.end >= 4 * Math.max(1, withIt.most) && withIt.most <= 3, 'overproduction: without a wait the output bin piles up with medium planks nobody buys; told to wait 3 s a log (about the customers\' pace) the operator keeps it to a handful',
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
  const w = open3(shut(F.newGame(8)));
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
  F.tap(w, { kind: 'stall', i: 0 }); until(w, x => !x.avatar.act && x.avatar.task && x.avatar.task.arrived, 30);
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

/* ---------- 14. the counter's four stalls (the CD, 2026-10-16) ---------- */
{
  // walk to a stall (or an empty place on the counter) and wait for its bubble and any stocking
  const at = (s, i) => { F.tap(s, { kind: 'stall', i }); until(s, x => !!F.bubbleOpen(x) && !x.avatar.act, 30); return F.options(s); };
  // a customer at the door, come for stall i
  const door = (s, i) => { const c = { id: s.shop.n++, x: L.SHOP.door.x, y: L.SHOP.laneY, state: 'in', t: 0, stall: i, at: null, item: null, by: null, wrong: false }; s.shop.people.push(c); return c; };
  const settle = s => until(s, x => x.shop.people.every(c => c.state === 'wait' || c.state === 'pay' || c.state === 'out'), 20);
  const s = shut(F.newGame(14));
  ok(s.stalls.length === 4 && s.stalls[0].bought && s.stalls[0].want === 'plank.m' && s.stalls.slice(1).every(q => !q.bought && q.want === null && !q.stock.length) && F.openStalls(s).join() === '0' && F.stallPrice(s) === 1,
    'a new factory has the one stall, selling medium planks, and three empty places along the counter; the next stall costs the flat $1 (2026-10-20)', JSON.stringify(s.stalls));
  let o = at(s, 2);
  ok(dist(s.avatar, SP.stalls[2]) < 0.05 && o.length === 1 && o[0].id === 'buystall' && o[0].price === 1 && !o[0].enabled && !F.choose(s, 'buystall') && !s.stalls[2].bought && s.money === 0,
    'a tap on an empty place on the counter walks you round to it, and its bubble offers a stall for $1, out of reach with $0', JSON.stringify(o));
  s.money = 1.5;
  ok(F.options(s)[0].enabled && F.choose(s, 'buystall') && s.money === 0.5 && s.stalls[2].bought && s.stalls[2].want === null && take(s, 'stallbought').map(e => e.i + ':' + e.price).join() === '2:1',
    'with $1.50 it is $1: the place is yours, a stall that sells nothing yet', s.money);
  o = F.options(s);
  ok(o.length === F.SELLS.length && o.every((x, k) => x.id === 'sell:' + F.SELLS[k] && x.enabled && !x.on && x.price === F.priceNow(s, F.SELLS[k])) && F.openStalls(s).join() === '0',
    'and its bubble now offers everything a stall can sell, each with what a customer would pay for it now; customers still come only for the first stall', o.map(x => x.id + '$' + x.price).join());
  s.money = 1000;
  at(s, 1); F.choose(s, 'buystall');
  const third = 1000 - s.money, last = at(s, 3)[0].price;
  F.choose(s, 'buystall');
  const full = at(s, 0);
  ok(third === 1 && last === 1 && s.money === 998 && F.stallPrice(s) === null && s.stalls.every(q => q.bought) && full.every(x => x.id.indexOf('sell:') === 0),
    'the next costs $1 and so does the last, whichever place each goes in; then all four are stalls and nothing is left to buy (the CD, 2026-10-20: a flat price)', [third, last, s.money].join());
  // what a stall sells: anything unsold comes back into your arms, and in go the new things you carry
  const t = shut(F.newGame(15));
  t.stalls[0].stock.push({ item: 'plank.m', by: 'player' }, { item: 'plank.m', by: 'player' }, { item: 'plank.s', by: 0 });
  t.avatar.inv.push('b2x4.m', 'b2x4.m', 'plank.l');
  o = at(t, 0);
  ok(t.stalls[0].stock.length === 3 && o.filter(x => x.on).map(x => x.id).join() === 'sell:plank.m', 'at the first stall the bubble marks what it sells now, medium planks', o.filter(x => x.on).map(x => x.id).join());
  F.choose(t, 'sell:b2x4.m'); until(t, x => !x.avatar.act, 5);
  const set = take(t, 'stallset')[0];
  ok(t.stalls[0].want === 'b2x4.m' && t.stalls[0].stock.map(g => g.item).join() === 'b2x4.m,b2x4.m' && t.stalls[0].stock.every(g => g.by === 'player') && t.avatar.inv.slice().sort().join() === 'plank.l,plank.m,plank.m,plank.s' &&
    set && set.was === 'plank.m' && set.back.join() === 'plank.m,plank.m,plank.s' && F.options(t).filter(x => x.on).map(x => x.id).join() === 'sell:b2x4.m',
    'choosing medium 2x4s instead: everything unsold in it comes back into your arms (the CD), the small plank a robot put there too, and the 2x4s you carry go in', t.avatar.inv.join() + ' / ' + t.stalls[0].stock.map(g => g.item).join());
  F.choose(t, 'sell:b2x4.m');
  ok(t.stalls[0].stock.length === 2 && take(t, 'stallset').length === 1 && !F.choose(t, 'sell:rough.m') && !F.choose(t, 'sell:carving.owl') && !F.choose(t, 'sell:plank.x') && t.stalls[0].want === 'b2x4.m',
    'choosing what it already sells changes nothing, and nothing without a price can be chosen');
  t.avatar.inv.push('b2x4.m', 'b2x4.m', 'b2x4.m', 'b2x4.m', 'b2x4.m', 'b2x4.m');
  at(t, 0);
  ok(t.stalls[0].stock.length === C.stallCap && count(t.avatar.inv, 'b2x4.m') === 2, 'a tap on it stocks it with what it sells, up to ' + C.stallCap + ', like the one stall always was; what does not fit stays in your arms', t.stalls[0].stock.length);
  // a stall bought but selling nothing gets no customers, and no die is rolled to choose
  const u = F.newGame(16); u.money = 50; at(u, 1); F.choose(u, 'buystall');
  u.avatar.inv.push('plank.m'); at(u, 1);
  u.force.stall = [1, 1, 1]; u.force.arrive = many(8, 40); u.events = [];
  run(u, 50);
  let cs = take(u, 'customer');
  ok(cs.length >= 4 && cs.every(e => e.stall === 0) && u.force.stall.length === 3 && !u.stalls[1].stock.length && count(u.avatar.inv, 'plank.m') === 1,
    'a stall bought but selling nothing: a tap on it stocks nothing, every customer comes for the first stall, and with only one stall to choose no die is rolled', cs.map(e => e.stall).join());
  // with more than one, each customer picks a stall that sells something, all equally likely (the CD)
  const r = F.newGame(17); r.money = 1000;
  [1, 3].forEach(i => { at(r, i); F.choose(r, 'buystall'); F.choose(r, 'sell:sap'); });
  r.force.arrive = many(8, 400); r.events = [];
  const per = [0, 0, 0, 0];
  for (let k = 0; k < 2400 * 20; k++) {
    F.step(r, 0.05);
    r.stalls.forEach(q => { if (q.want) while (q.stock.length < C.stallCap) q.stock.push({ item: q.want, by: 'player' }); });
    r.events.forEach(e => { if (e.kind === 'customer') per[e.stall]++; }); r.events = [];
  }
  const n = per.reduce((a, b) => a + b, 0);
  ok(n > 250 && !per[2] && [0, 1, 3].every(i => per[i] / n > 0.27 && per[i] / n < 0.4), 'with three stalls selling, each customer picks one of them at random, all equally likely, and never the place with no stall (the CD)', per.join(' / ') + ' of ' + n);
  // one customer waits at each stall, the rest in the line along the back, first come first served
  const q = shut(F.newGame(18)); q.money = 50; at(q, 1); F.choose(q, 'buystall'); F.choose(q, 'sell:b2x4.m'); until(q, x => !x.avatar.act, 5);
  const A = door(q, 0), B = door(q, 0), Cc = door(q, 1);
  settle(q);
  ok(A.at === 'stall' && A.x === L.SHOP.places[0] && A.y === L.SHOP.lineY && B.at === 'line' && B.x === L.SHOP.x0 && B.y === L.SHOP.backY && Cc.at === 'stall' && Cc.x === L.SHOP.places[1] && Cc.y === L.SHOP.lineY && F.waitingNow(q) === 3,
    'each customer waits at its own stall, across the counter from it; a second for the same stall waits in the line along the back wall; all three cost satisfaction while they wait', [A, B, Cc].map(c => c.at + '@' + c.x + ',' + c.y).join(' '));
  q.satisfaction = 100;
  q.stalls[1].stock.push({ item: 'b2x4.m', by: 'player' });
  until(q, x => take(x, 'sold').length > 0, 10);
  let sold = take(q, 'sold')[0];
  ok(sold.at === 1 && sold.item === 'b2x4.m' && sold.sale === 'fair' && Math.abs(sold.paid - F.priceOf('b2x4.m') * q.satisfaction / 100) < 0.06 && A.state === 'wait' && B.state === 'wait',
    'a medium 2x4 in the second stall: its customer pays the 2x4\'s $6 times customer satisfaction, while the first stall\'s two go on waiting', sold.at + ' $' + sold.paid);
  until(q, x => x.shop.people.indexOf(Cc) < 0, 20);
  const D = door(q, 1); settle(q);
  ok(D.at === 'stall' && D.x === L.SHOP.places[1] && B.at === 'line', 'a customer for a free stall walks straight to it, past one who came earlier for a stall still taken', D.at + ' / ' + B.at);
  q.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  until(q, x => A.state === 'out', 10); until(q, x => B.at === 'stall' && B.state === 'wait', 5);
  ok(B.at === 'stall' && B.x === L.SHOP.places[0] && B.y === L.SHOP.lineY && B.state === 'wait', 'and when the first stall\'s customer is served, the next for it steps up from the line', B.at + '@' + B.x + ',' + B.y);
  // what a customer pays, stall by stall: its thing's price times satisfaction, never below what that cost to make
  const pay = (item, sat) => { const v = shut(F.newGame(19)); v.money = 50; at(v, 1); F.choose(v, 'buystall'); F.choose(v, 'sell:' + item); queue(v, 1, 1); v.stalls[1].stock.push({ item, by: 'player' }); until(v, x => x.shop.people[0].state === 'pay' && x.shop.people[0].t > P.paySec - 0.05, 10); v.satisfaction = sat; until(v, x => take(x, 'sold').length > 0, 5); return take(v, 'sold')[0].paid; };
  const prices = [['b2x4.s', 50], ['sap', 50], ['plank.l', 50], ['b2x4.s', 10], ['sap', 10], ['dowels.s', 10]].map(([i, v]) => pay(i, v));
  ok(prices.join() === '1.5,0.5,4,1.2,0.1,1.2', 'every stall prices its own thing: at 50% a small 2x4 sells for $1.50, sap for $0.50 and a large plank for $4; at 10% the 2x4 and the small dowels for their $1.20 floor and sap for its $0.10 (the CD, 2026-10-16)', prices.join());
  // anything else in a stall still sells, as the stall's thing, and costs satisfaction
  const w = shut(F.newGame(20)); w.money = 50; at(w, 1); F.choose(w, 'buystall'); F.choose(w, 'sell:b2x4.m'); queue(w, 1, 1); w.satisfaction = 100;
  w.stalls[1].stock.push({ item: 'dowels.m', by: 0 });
  until(w, x => take(x, 'sold').length > 0, 10);
  sold = take(w, 'sold')[0];
  ok(sold.item === 'dowels.m' && sold.want === 'b2x4.m' && sold.sale === 'wrong' && sold.paid === 6 && w.satisfaction < 100 - C.satHit + 0.5 && w.shop.wrong === 1, 'dowels in the 2x4 stall sell as 2x4s, at $6, and cost customer satisfaction ' + C.satHit, sold.paid + ' / ' + w.satisfaction.toFixed(1));
  // a customer waiting when the stall changes what it sells buys the new thing
  const x2 = shut(F.newGame(21)); x2.money = 50; at(x2, 2); F.choose(x2, 'buystall'); F.choose(x2, 'sell:sap'); queue(x2, 1, 2); settle(x2);
  x2.avatar.inv.push('plank.l'); x2.satisfaction = 100;
  at(x2, 2); F.choose(x2, 'sell:plank.l');
  until(x2, x => take(x, 'sold').length > 0, 10);
  sold = take(x2, 'sold')[0];
  ok(sold && sold.item === 'plank.l' && sold.sale === 'fair' && Math.abs(sold.paid - 8) < 0.05, 'a customer waiting at a stall when you change what it sells buys the new thing, at its price', sold && sold.item + ' $' + sold.paid);
  // an empty stall fills the shop: its customers wait while the others are served, until all six are its
  const e = F.newGame(22); e.money = 50; at(e, 1); F.choose(e, 'buystall'); F.choose(e, 'sell:sap');
  e.force.arrive = many(8, 200); e.events = [];
  for (let k = 0; k < 20 * 400; k++) { F.step(e, 0.05); while (e.stalls[0].stock.length < C.stallCap) e.stalls[0].stock.push({ item: 'plank.m', by: 'player' }); }
  const inside = e.shop.people.filter(c => c.state !== 'out');
  ok(inside.length === P.max && inside.every(c => c.stall === 1 && c.state === 'wait') && inside.filter(c => c.at === 'stall').length === 1 && e.satisfaction < 50,
    'a stall that sells something you never stock: its customers wait while the first stall\'s are served, until all ' + P.max + ' in the shop are its, nobody else comes in, and satisfaction drains (the CD\'s rule: they wait there)', inside.map(c => c.stall + c.at).join() + ' ' + e.satisfaction.toFixed(1) + '%');
  // nobody walks through anybody: over a busy shop with four stalls
  const b = F.newGame(23); b.money = 1000;
  [1, 2, 3].forEach(i => { at(b, i); F.choose(b, 'buystall'); F.choose(b, 'sell:' + ['sap', 'b2x4.m', 'plank.s'][i - 1]); });
  b.force.arrive = many(8, 400); b.force.stall = []; b.events = [];
  const rr = (sd => () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; })(7);
  let bad = '', seenLine = 0, seenStall = 0, served = 0;
  const walking = {};
  for (let k = 0; k < 20 * 900 && !bad; k++) {
    F.step(b, 0.05);
    if (rr() < 0.01) { const st = b.stalls[Math.floor(rr() * 4)]; if (st.stock.length < C.stallCap) st.stock.push({ item: st.want, by: 'player' }); }
    served += take(b, 'sold').length; b.events = [];
    const ppl = b.shop.people, stand = ppl.filter(c => c.state === 'wait' || c.state === 'pay');
    ppl.forEach(c => { walking[c.id] = c.state === 'in' ? (walking[c.id] || 0) + 0.05 : 0; if (walking[c.id] > 12) bad = 'customer ' + c.id + ' still walking after 12 s, at ' + c.x.toFixed(2) + ',' + c.y.toFixed(2); });
    seenLine = Math.max(seenLine, ppl.filter(c => c.at === 'line' && c.state === 'wait').length); seenStall = Math.max(seenStall, ppl.filter(c => c.at === 'stall' && c.state === 'wait').length);
    stand.forEach(c => stand.forEach(d => { if (c !== d && dist(c, d) < 0.39) bad = 'two customers standing ' + dist(c, d).toFixed(2) + ' m apart'; }));
    ppl.forEach(c => {
      if (c.y > L.SHOP.laneY + 1e-6 && Math.abs(c.x - L.SHOP.places[c.stall]) > 0.31) bad = 'customer ' + c.id + ' (' + c.state + ') off the walk at ' + c.x.toFixed(2) + ',' + c.y.toFixed(2) + ', away from its stall';
      if (c.y < L.SOLID.wall[3] + 0.2 || c.y > L.SOLID.counter[1] - 0.2) bad = 'customer ' + c.id + ' at the wall or the counter';
    });
    for (let i = 0; i < 4; i++) { const mine = ppl.filter(c => c.state !== 'out' && c.stall === i); if (mine.length && mine[0].at !== 'stall') bad = 'the first customer for stall ' + (i + 1) + ' is not at it'; }
  }
  ok(!bad && seenLine >= 2 && seenStall >= 2 && served > 60, 'over a busy quarter of an hour at four stalls: everyone who walks somewhere gets there, the first customer for each stall is always the one at it, nobody standing ever stands in anyone\'s place, and nobody crosses the stalls\' row except at their own stall (they come and go along the walk behind it)', bad || ('up to ' + seenStall + ' at the stalls, ' + seenLine + ' in the line, ' + served + ' served'));
  // a bad tap does nothing
  const g = shut(F.newGame(24)), before = JSON.stringify(g.avatar);
  [{ kind: 'stall' }, { kind: 'stall', i: 4 }, { kind: 'stall', i: -1 }, { kind: 'stall', i: 1.5 }, { kind: 'stall', i: '1' }, { kind: 'counter' }].forEach(tk => F.tap(g, tk));
  ok(JSON.stringify(g.avatar) === before && !g.bubble, 'a tap on a stall that is not one of the four, or on the old counter, does nothing');
  // saves
  const sv = F.load(F.save(r));
  ok(sv && JSON.stringify(sv.stalls) === JSON.stringify(r.stalls) && JSON.stringify(sv.shop.people) === JSON.stringify(r.shop.people), 'a save keeps the four stalls (which are bought, what each sells, what is in each) and who waits where');
  const old = JSON.parse(F.save(shut(F.newGame(25))));
  old.stalls = [{ want: 'plank.m', stock: [{ item: 'plank.m', by: 'player' }] }];
  old.avatar.task = { kind: 'counter', arrived: true, spot: SP.counter }; old.avatar.act = { kind: 'stock', t: 0.1, done: false }; old.bubble = { kind: 'counter' };
  old.shop.people = [{ id: 0, x: 4.8, y: 1.15, state: 'wait', t: 2, stall: 0, item: null, by: null, wrong: false }, { id: 1, x: 2, y: 0.8, state: 'out', t: 1, stall: 0, item: 'plank.m', by: 'player', wrong: false }, { id: 2, x: 3, y: 1.15, state: 'wait', t: 0, stall: 3, item: null, by: null, wrong: false }];
  const was = F.load(JSON.stringify(old));
  ok(was && JSON.stringify(was.stalls) === '[{"bought":true,"want":"plank.m","stock":[{"item":"plank.m","by":"player"}]},{"bought":false,"want":null,"stock":[]},{"bought":false,"want":null,"stock":[]},{"bought":false,"want":null,"stock":[]}]' &&
    was.avatar.task.kind === 'stall' && was.avatar.task.i === 0 && was.avatar.act.i === 0 && was.bubble === null && was.shop.people.map(c => c.stall).join() === '0,0,0' && was.version === C.version,
    'a save from before the four stalls loads as it was: its stall the first, three empty places, a walk to the counter a walk to the first stall, a customer for a stall that sells nothing back at the first (no version bump)', was && JSON.stringify([was.stalls.map(q => q.bought), was.avatar.task, was.shop.people.map(c => c.stall)]));
  run(was, 10);
  ok(was.stalls[0].stock.length === 0 && take(was, 'sold').length === 1, 'and carries on: its customer buys the plank');
}

/* ---------- 15. eight robots: one for each stall, and for slots 02-04 (the CD, 2026-10-16) ---------- */
// a factory with its stalls set as given (index by stall: a thing, bought and set to sell it; null,
// bought and selling nothing; undefined, left as a new factory has it) and robots hired by the real
// route, one for each job in the list (null: left resting)
function crew(seed, wants, jobs, force) {
  const s = open3(shut(F.newGame(seed)));   // the eight's jobs include slots 02-04
  if (force) Object.keys(force).forEach(k => { if (k === 'log') feed(s, force.log); else s.force[k] = force[k].slice(); });
  wants.forEach((w, i) => { if (w === undefined) return; s.stalls[i].bought = true; s.stalls[i].want = w; });
  s.money = jobs.length * s.flat.robot;
  jobs.forEach(job => {
    F.tap(s, { kind: 'dock' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'dock', 30);
    F.choose(s, 'hire'); if (job) F.choose(s, 'job:' + job);
  });
  return s;
}
const robotOn = (s, job) => s.robots.find(r => r.job === job);
const atHome = (s, r) => r.state === 'idle' && dist(r, F.homeOf(s, r)) < 0.07;
{
  // the dock of eight
  const cs = L.CRATES, inside = (c, d) => c[0] < d[2] && d[0] < c[2] && c[1] < d[3] && d[1] < c[3];
  ok(cs.length === 8 && SP.rest.length === 8 && C.names.length === 8 && cs.every((c, i) => c[0] > 0.25 && c[2] < L.W - 0.25 && c[3] < L.H - 0.25 && dist(SP.rest[i], { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 }) < 1e-6 && cs.every((d, j) => i === j || !inside(c, d))),
    'the dock has eight crates, side by side in two rows of four, and each robot\'s charging pad is where its crate stood', cs.map(c => c.join('/')).join(' '));
  const posts = [['operate', SP.operate], ['saw', SP.sawBot], ['extract', SP.extractBot], ['bench', SP.benchBot], ['dock', SP.dock]].concat(SP.stallBots.map((p, i) => ['stall' + (i + 1), p]),
    [].concat.apply([], Object.keys(SP.fetch).map(b => SP.fetch[b].map((p, i) => [b + '@' + (i + 1), p]))));
  const boxed = [];
  for (let n = 1; n <= 8; n++) {
    const s = open3(F.newGame()); s.hired = n;
    for (let k = 0; k < n; k++) posts.forEach(([name, q]) => {
      const p = F.path(s, SP.rest[k], q);
      if (!p.length || dist(p[p.length - 1], q) > 0.15 || !segFree(s, SP.rest[k], p)) boxed.push(n + ' hired: pad ' + (k + 1) + '>' + name);
    });
  }
  ok(!boxed.length, 'however many robots are still packed in their crates, every robot unpacked can walk from its pad to every post, and back (one cell of floor between any two crates)', boxed.slice(0, 5).join(', '));
  // the robots waiting at one output bin stand a robot's width apart (2026-10-17: at 0.4 m two
  // stall robots at the planer's bin were drawn one over the other)
  const close = [];
  Object.keys(SP.fetch).forEach(b => SP.fetch[b].forEach((p, i) => SP.fetch[b].forEach((q, j) => { if (i < j && dist(p, q) < 0.75) close.push(b + ' ' + (i + 1) + '/' + (j + 1) + ' ' + dist(p, q).toFixed(2)); })));
  ok(!close.length, 'at each output bin the four stalls\' robots wait at least 0.75 m apart, a robot\'s width', close.join(', '));
  ok(posts.every(([name, q]) => F.free(open3(F.newGame()), q.x, q.y)) && [0, 8].every(n => { const s = open3(F.newGame()); s.hired = n; const p = F.path(s, SP.start, SP.dock); return p.length && dist(p[p.length - 1], SP.dock) < 0.15 && segFree(s, SP.start, p); }),
    'every post stands on free floor, and the dock is reached with every crate packed or none');
  // instruction slots open once two robots are on staff, not only once all are
  const one = staffed(71, [null]); one.money = 5;
  const two = staffed(71, [null, null]); two.money = 5;
  ok(!F.slotsOpen(one) && !F.buySlot(one, 0) && one.money === 5 && F.slotsOpen(two) && F.buySlot(two, 0) && two.money === 0, 'with one robot no instruction slot can be bought; with two, slots open (the plan: "once two robots are on staff")');
  // a job for each stall bought
  const s = open3(staffed(72, [null, null]));
  F.tap(s, { kind: 'robot', id: 0 }); until(s, x => !!F.bubbleOpen(x), 30);
  const before = F.options(s).map(o => o.id).join();
  s.stalls[2].bought = true;
  const after = F.options(s).map(o => o.id).join();
  ok(before === 'job:operate,job:stock:0,job:extract,job:carve,job:saw,job:rest,notes' && after === 'job:operate,job:stock:0,job:stock:2,job:extract,job:carve,job:saw,job:rest,notes' && !F.choose(s, 'job:stock:1') && !s.robots[0].job,
    'a robot can stock any stall that has been bought, one job for each; a place on the counter with no stall has none', after);
  F.choose(s, 'job:stock:2');
  F.tap(s, { kind: 'robot', id: 1 }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).id === 1, 30);
  F.choose(s, 'job:stock:2');
  ok(s.robots[1].job === 'stock:2' && s.robots[0].job === null && F.options(s).length === 0, 'one robot to a stall: giving one a stall someone has swaps them', s.robots.map(r => r.job).join());
  ok(F.jobKind('stock:3') === 'stock' && F.stallOfJob('stock:3') === 3 && F.stallOfJob('saw') === -1 && F.jobKind(null) === null && F.srcOf('plank.l') === 'bin' && F.srcOf('dowels.s') === 'sawOut' && F.srcOf('sap') === 'extractOut' && F.srcOf('rough.m') === null,
    'planks come from the planer\'s output bin, the cuts from the saw\'s and sap from the extractor\'s');
}
{
  // each stall's robot fetches its thing from the bin it comes out of, and carries it to its stall
  const s = crew(73, ['plank.m', 'plank.l', 'sap', 'b2x4.m'], [null, 'stock:1', 'stock:2', 'stock:3']);
  const [_, r1, r2, r3] = s.robots;
  until(s, x => [r1, r2, r3].every(r => atHome(x, r)), 60);
  ok([[r1, SP.fetch.bin[1]], [r2, SP.fetch.extractOut[2]], [r3, SP.fetch.sawOut[3]]].every(([r, q]) => dist(r, q) < 0.07), 'each waits at the output bin its stall\'s thing comes out of: large planks at the planer\'s, sap at the extractor\'s, 2"x4"s at the saw\'s',
    [r1, r2, r3].map(r => r.x.toFixed(2) + ',' + r.y.toFixed(2)).join(' '));
  s.bin.push('plank.l'); s.extract.out.push('sap'); s.saw.out.push('b2x4.m');
  s.events = [];
  const where = {}, walked = [r1, r2, r3].map(r => r.dist);
  for (let t = 0; t < 40 && s.stalls.slice(1).some(st => !st.stock.length); t += 0.05) {
    F.step(s, 0.05);
    s.events.forEach(e => { if (e.kind === 'stocked' && typeof e.by === 'number') where[e.at] = dist(s.robots[e.by], SP.stallBots[e.at]); });
    s.events = [];
  }
  ok(s.stalls.slice(1).map(st => st.stock.map(g => g.item + '/' + g.by).join()).join() === 'plank.l/1,sap/2,b2x4.m/3' && !s.stalls[0].stock.length && !s.bin.length && !s.extract.out.length && !s.saw.out.length &&
    [1, 2, 3].every(i => where[i] < 0.07) && r1.record['stock:plank.l'] === 1 && r2.record['stock:sap'] === 1 && r3.record['stock:b2x4.m'] === 1 && [r1, r2, r3].every(r => r.tally.good === 1),
    'each reaches in, carries the thing across the floor and puts it in its own stall, standing at it: green', JSON.stringify(where));
  ok([r1, r2, r3].every((r, k) => r.dist - walked[k] >= dist(F.homeOf(s, r), SP.stallBots[k + 1]) - 0.06), 'each walks there (the CD: "These robots will travel to specific bin to fetch an item and put it in the stall")', [r1, r2, r3].map((r, k) => (r.dist - walked[k]).toFixed(1)).join());
  until(s, x => [r1, r2, r3].every(r => atHome(x, r)), 40);
  ok([r1, r2, r3].every(r => atHome(s, r)), 'and goes back to its bin to wait for the next');
  // the first stall's robot, on medium planks, stands where the stocker always stood and never walks
  const t = crew(74, ['plank.m'], ['stock:0']);
  const r0 = t.robots[0];
  until(t, x => atHome(x, r0), 40);
  const d0 = r0.dist;
  t.bin.push('plank.m', 'plank.m');
  until(t, x => x.stalls[0].stock.length === 2, 20);
  ok(dist(F.homeOf(t, r0), SP.stock) < 1e-9 && SP.stallBots[0] === SP.stock && SP.fetch.bin[0] === SP.stock && r0.dist === d0 && r0.record['stock:plank.m'] === 2, 'the first stall\'s robot on planks has the bin behind it and the stall in front, as the stocker always had: it never takes a step');
}
{
  // without its instruction a stall's robot takes the next thing, whatever it is
  let s = crew(75, ['plank.m', undefined, 'sap'], [null, null, 'stock:2']);
  const r = s.robots[2];
  until(s, x => atHome(x, r), 60);
  s.extract.out.push('log.m', 'sap'); s.events = [];
  until(s, x => x.stalls[2].stock.length > 0, 30);
  ok(s.stalls[2].stock[0].item === 'log.m' && r.record['misstock:log.m@sap'] === 1 && r.tally.bad === 1 && learnt(s) === 'only:sap' && take(s, 'rule')[0].ids.join() === 'only:sap',
    'the sap stall\'s robot, untold, takes the clean log the extractor gave back and puts it in the sap stall: red, and "' + RULE_TEXT['only:sap'] + '" joins the list (no recycle instruction: there is none for a log)', JSON.stringify(r.record) + ' ' + learnt(s));
  s = crew(75, ['plank.m', undefined, 'sap'], [null, null, 'stock:2'], { slip: [false], find: [false, true] });
  instruct(s, 2, ['only:sap']);
  until(s, x => atHome(x, s.robots[2]), 60);
  s.extract.out.push('log.m', 'sap'); s.events = [];
  until(s, x => x.stalls[2].stock.length > 0, 30);
  const h = s.robots[2];
  ok(s.stalls[2].stock[0].item === 'sap' && s.extract.out.join() === 'log.m' && h.record['looking:sap'] === 1 && h.record['stock:sap'] === 1 && !s.force.slip.length && !s.force.find.length,
    'told "' + RULE_TEXT['only:sap'] + '", it hunts the extractor\'s bin for sap, puts the log back (a "looking for sap"), and stocks the sap; one slip die for the stocking', JSON.stringify(h.record) + ' ' + s.extract.out.join());
  s = crew(75, ['plank.m', undefined, 'sap'], [null, null, 'stock:2'], { slip: [false, false] });
  instruct(s, 2, ['stockOnly', 'only:plank.l']);
  until(s, x => atHome(x, s.robots[2]), 60);
  s.extract.out.push('log.m', 'sap'); s.events = [];
  until(s, x => x.stalls[2].stock.length > 0, 30);
  ok(s.stalls[2].stock[0].item === 'log.m' && s.force.slip.length === 2 && !take(s, 'looking').length, '"Only stock" about another thing is never consulted: the sap stall\'s robot holding "' + RULE_TEXT.stockOnly + '" and "' + RULE_TEXT['only:plank.l'] + '" does just what it would untold (its slip dice untouched)', s.stalls[2].stock[0].item);
  // a recycle instruction never takes a stall's own thing
  s = crew(76, ['plank.m', 'plank.l'], [null, 'stock:1'], { slip: [false, false] });
  until(s, x => atHome(x, s.robots[1]), 60);
  s.bin.push('plank.l'); s.events = [];
  until(s, x => x.stalls[1].stock.length > 0, 30);
  const untold = !s.seen.largeOut;
  s = crew(76, ['plank.m', 'plank.l'], [null, 'stock:1'], { slip: [false, false] });
  instruct(s, 1, ['largeOut', 'smallOut']);
  until(s, x => atHome(x, s.robots[1]), 60);
  s.bin.push('plank.s', 'plank.l'); s.events = [];
  until(s, x => x.stalls[1].stock.length > 0, 40);
  ok(untold && s.stalls[1].stock.map(g => g.item).join() === 'plank.l' && take(s, 'recycled').map(e => e.item).join() === 'plank.s' && s.force.slip.length === 1,
    'the large plank stall\'s robot never recycles a large plank, even told "' + RULE_TEXT.largeOut + '" (that joins the list only from another stall\'s robot); the small plank it is told to recycle goes in the recycle bin', take(s, 'recycled').map(e => e.item).join());
}
{
  // what a stall sells changes while its robot is fetching for it
  const s = crew(77, ['plank.m', 'plank.l'], [null, 'stock:1']);
  const r = s.robots[1];
  until(s, x => atHome(x, r), 60);
  F.tap(s, { kind: 'stall', i: 1 }); until(s, x => !!F.bubbleOpen(x) && !x.avatar.act, 30);
  s.bin.push('plank.l');
  until(s, x => r.state === 'carry', 20);
  const held = r.carry;
  F.choose(s, 'sell:sap');
  ok(held === 'plank.l' && !r.carry && s.bin.join() === 'plank.l' && !s.stalls[1].stock.length && dist(F.homeOf(s, r), SP.fetch.extractOut[1]) < 1e-9 && !Object.keys(r.record).some(k => /^misstock/.test(k)),
    'set the stall to sell something else while its robot carries the old thing across, and the thing goes back in the bin it came from, nothing goes in the stall, and the robot heads for the new thing\'s bin', held + ' / ' + s.bin.join());
  s.extract.out.push('sap');
  until(s, x => x.stalls[1].stock.length > 0, 40);
  ok(s.stalls[1].stock[0].item === 'sap' && r.record['stock:sap'] === 1, 'and stocks the new thing from there');
  // two stalls' robots share the planer's output bin
  const t = crew(78, ['plank.m', 'plank.l'], ['stock:0', 'stock:1'], { slip: many(false, 99) });
  instruct(t, 0, ['stockOnly']); instruct(t, 1, ['only:plank.l']);
  until(t, x => x.robots.every(q => atHome(x, q)), 60);
  t.bin.push('plank.l', 'plank.m', 'plank.l', 'plank.m', 'plank.m', 'plank.l');
  until(t, x => !x.bin.length && x.robots.every(q => !q.carry), 90);
  ok(t.stalls[0].stock.map(g => g.item).join() === 'plank.m,plank.m,plank.m' && t.stalls[1].stock.map(g => g.item).join() === 'plank.l,plank.l,plank.l' && t.robots.every(q => q.tally.bad === 0),
    'two stalls\' robots share the planer\'s output bin, each told only to stock its own thing: each stall gets its own, and nothing is lost or put in twice', t.stalls.slice(0, 2).map(st => st.stock.map(g => g.item).join('+')).join(' | '));
  // a stall that sells nothing
  const u = crew(79, ['plank.m', null], [null, 'stock:1']);
  const q = u.robots[1];
  u.bin.push('plank.l'); u.saw.out.push('dowels.m'); u.extract.out.push('sap');
  run(u, 40);
  ok(dist(q, SP.stallBots[1]) < 0.07 && q.state === 'idle' && !take(u, 'stocked').length && u.bin.length === 1, 'a robot on a stall that sells nothing yet waits at the stall and fetches nothing');
}
{
  // slot 02: the table saw
  const s = crew(80, ['plank.m'], ['saw']);
  const r = s.robots[0];
  ok(r.cut === 'b2x4' && !F.setCut(s, 0, 'planks') && !F.setCut(s, 9, 'dowels') && F.setCut(s, 0, 'dowels') && r.cut === 'dowels' && take(s, 'cutset').length === 1, 'a robot cuts 2"x4"s until told otherwise on its page; only the three cuts can be set');
  until(s, x => atHome(x, r), 60);
  ok(dist(r, SP.sawBot) < 0.07, 'the saw\'s robot stands by the saw\'s console');
  s.saw.in.push('plank.m', 'plank.s', 'plank.l', 'plank.m'); s.events = [];
  const m0 = s.money;
  until(s, x => x.saw.out.length === 4, 40);
  const presses = take(s, 'press').filter(e => e.at === 'saw'), gaps = presses.slice(1).map((e, k) => e.t - presses[k].t);
  ok(s.saw.out.join() === 'dowels.m,dowels.s,dowels.l,dowels.m' && presses.length === 4 && presses.every(e => e.by === 0 && e.cut === 'dowels') && gaps.every(g => g >= C.sawSec - 1e-6) && Math.abs(m0 - s.money - 4 * C.sawCost) < 1e-9 &&
    r.record['sawn:plank.m'] === 2 && r.tally.good === 4 && !r.tally.bad && !r.tally.soso,
    'it presses the saw on the first plank in its input bin whenever the saw is idle, making the cut set on its page ($' + C.sawCost + ' a run); never a running saw; every run green (the CD: nothing goes wrong there yet)', gaps.map(g => g.toFixed(2)).join());
  // slot 03: the sap extractor
  const e = crew(81, ['plank.m'], ['extract']);
  until(e, x => atHome(x, e.robots[0]), 60);
  ok(dist(e.robots[0], SP.extractBot) < 0.07, 'the extractor\'s robot stands by its console');
  e.extract.in.push('sappy.l', 'sappy.s');
  until(e, x => x.extract.out.length === 7, 40);
  ok(e.extract.out.join() === 'log.l,sap,sap,sap,sap,log.s,sap' && e.robots[0].record['extracted:sappy.l'] === 1 && e.robots[0].record['extracted:sappy.s'] === 1 && e.costs.extract === F.cents(2 * C.extractCost),
    'it runs the extractor on each sap log in turn: the sap and a clean log of the same size, green', e.extract.out.join());
}
{
  // slot 04: the bench, one pair of hands at a time
  const s = crew(82, ['plank.m'], ['carve'], { carve: ['owl', 'bowl', 'bird', 'spoon'] });
  const r = s.robots[0];
  until(s, x => atHome(x, r), 60);
  ok(dist(r, SP.benchBot) < 0.07, 'the bench\'s robot stands at the bench, west of where you do');
  s.bench.in.push('gnarled.s', 'rough.m');
  until(s, x => x.bench.out.length === 2, 2 * C.carveSec + 3);
  ok(s.bench.out.join() === 'carving.owl,carving.bowl' && r.record['carved:carving.owl'] === 1 && r.record['carved:carving.bowl'] === 1 && !s.tally.player.carved, 'it carves the gnarled wood in the bench\'s input bin, one piece after another, each a design of its own: green', s.bench.out.join());
  F.tap(s, { kind: 'bench' }); until(s, x => x.avatar.task && x.avatar.task.arrived, 20);
  s.bench.in.push('gnarled.m'); s.events = [];
  until(s, x => r.state === 'carve' && x.bench.t > 0.5, 5);
  const t0 = s.t - s.bench.t;
  F.tap(s, { kind: 'bench' });
  const yours = !!s.avatar.act;
  until(s, x => x.bench.out.length === 3, C.carveSec + 2);
  const took = take(s, 'carved')[0].t - t0;
  ok(!yours && take(s, 'carved').length === 1 && take(s, 'carved')[0].by === 0 && Math.abs(took - C.carveSec) < 0.11 && !s.tally.player.carved, 'a tap on the bench while the robot carves does nothing: one pair of hands at a time, at one pair\'s pace', took.toFixed(2));
  // you carving: a robot given the job waits; a piece you walk away from, it finishes
  const u = crew(83, ['plank.m'], [null], { carve: ['owl', 'bird'] });
  const q = u.robots[0];
  u.bench.in.push('gnarled.s', 'gnarled.m');
  F.tap(u, { kind: 'bench' }); until(u, x => x.avatar.act && x.avatar.act.kind === 'carve' && x.bench.t > 0.2, 20);
  q.job = 'carve'; q.x = SP.benchBot.x; q.y = SP.benchBot.y;   // (given the job, and standing at the bench, while you carve)
  const mid = u.bench.t; run(u, 0.5);
  ok(q.state === 'idle' && u.bench.by === 'player' && Math.abs(u.bench.t - mid - 0.5) < 0.06, 'while you carve, the bench\'s robot waits beside you', q.state + ' ' + (u.bench.t - mid).toFixed(2));
  F.tap(u, { kind: 'floor', x: 4.5, y: 14.0 }); run(u, 0.2);
  const left = u.bench.t;
  until(u, x => x.bench.out.length === 1, C.carveSec);
  ok(left > 0.5 && left < C.carveSec && u.bench.out.join() === 'carving.owl' && q.record['carved:carving.owl'] === 1 && !u.tally.player.carved, 'walk away from a carving half done and the robot finishes it', left.toFixed(2));
}
{
  // no mistakes on slots 02-04, and the delay
  const s = crew(84, ['plank.m'], ['saw', 'extract', 'carve'], { slip: many(false, 5) });
  s.saw.in.push.apply(s.saw.in, many('plank.m', 12)); s.extract.in.push.apply(s.extract.in, many('sappy.m', 8)); s.bench.in.push.apply(s.bench.in, many('gnarled.m', 6));
  run(s, 90);
  ok(s.force.slip.length === 5 && s.robots.every(r => r.tally.good > 2 && !r.tally.bad && !r.tally.soso) && learnt(s) === '', 'over a minute and a half on slots 02-04 the robots make no mistake, roll no slip die and put nothing on the list (the CD: "nothing yet")', s.robots.map(r => r.tally.good).join());
  const d = crew(85, ['plank.m'], ['saw', null], { slip: many(false, 20) });
  instruct(d, 0, ['delay']); F.setWait(d, 0, 10);
  d.saw.in.push.apply(d.saw.in, many('plank.m', 6));
  until(d, x => atHome(x, d.robots[0]) || take(x, 'press').length, 60);
  d.events = []; run(d, 40);
  const pr = take(d, 'press'), pa = take(d, 'paused').filter(e => e.by === 0), gp = pr.slice(1).map((e, k) => e.t - pr[k].t);
  ok(pr.length >= 2 && pa.length >= 2 && gp.every(g => g >= 10 + C.sawSec - 1e-6), 'and a slot\'s robot that holds "' + RULE_TEXT.delay + '" waits that long after each run', gp.map(g => g.toFixed(1)).join());
}
{
  // saves: new fields kept, old saves moved on
  const s = crew(86, ['plank.m', 'plank.l', 'sap', 'b2x4.m'], ['operate', 'stock:0', 'stock:1', 'stock:2', 'stock:3', 'saw', 'extract', 'carve'], { log: many('log.l', 30).concat(many('log.m', 30)) });
  F.setCut(s, 5, 'b2x2'); instruct(s, 1, ['stockOnly']);
  s.saw.in.push('plank.m', 'plank.l'); s.extract.in.push('sappy.m'); s.bench.in.push.apply(s.bench.in, many('gnarled.s', 8));
  until(s, x => x.robots[2].state === 'carry' && x.bench.by === 7, 120);
  const text = F.save(s), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(s.robots[2].state === 'carry' && b && strip(s) === strip(b) && b.robots.map(r => r.job).join() === 'operate,stock:0,stock:1,stock:2,stock:3,saw,extract,carve' && b.robots[5].cut === 'b2x2' && b.bench.by === 7,
    'a save keeps every robot\'s job, the saw robot\'s cut, a robot carrying something across the floor and a carving under way', b && b.robots.map(r => r.job + ':' + r.state).join());
  run(s, 30); run(b, 30);
  ok(strip(s) === strip(b), 'and the eight carry on identically');
  const raw = JSON.parse(text);
  raw.robots[1].job = 'stock'; raw.robots[2].job = 'stock:3'; raw.robots[3].job = 'operate'; raw.robots[4].job = 'stock:9'; raw.robots[5].cut = 'planks'; delete raw.robots[6].cut;
  raw.robots[2].carry = null; raw.robots[2].src = 'nowhere'; raw.robots[7].src = 'shelf';
  raw.stalls[3].bought = false; raw.bench.by = 42;
  const o = F.load(JSON.stringify(raw));
  ok(o && o.robots.map(r => r.job).join() === 'operate,stock:0,,,,saw,extract,carve' && o.robots[5].cut === 'b2x4' && o.robots[6].cut === 'b2x4' && o.robots[2].state === 'idle' && o.robots[2].src === null && o.robots[7].src === null && o.bench.by === null,
    'an older or hand-edited save: a stocker from before the four stalls stocks the first, a second robot on one job rests, a job for a stall not bought or none at all rests, a bad cut is a 2"x4", a carry with nothing carried is let go, a carver who is nobody is cleared', o && JSON.stringify(o.robots.map(r => [r.job, r.cut, r.state, r.src])));
}
{
  // a quarter hour with all eight at work
  const s = crew(87, ['plank.m', 'plank.l', 'sap', 'b2x4.m'], ['operate', 'stock:0', 'stock:1', 'stock:2', 'stock:3', 'saw', 'extract', 'carve'], { slip: many(false, 9999) });
  instruct(s, 0, ['sappy', 'gnarled', 'smallLog']); instruct(s, 1, ['stockOnly', 'roughOut', 'smallOut']); instruct(s, 2, ['only:plank.l', 'roughOut', 'smallOut']); instruct(s, 3, ['only:sap']); instruct(s, 4, ['only:b2x4.m']);
  F.setCut(s, 5, 'b2x4');
  s.saw.in.push.apply(s.saw.in, many('plank.m', 30)); s.extract.in.push.apply(s.extract.in, many('sappy.m', 20)); s.bench.in.push.apply(s.bench.in, many('gnarled.m', 10));
  s.shop.next = s.t + 5;
  let bad = '';
  const seenAt = s.robots.map(r => ({ x: r.x, y: r.y, t: s.t })), soldAt = [0, 0, 0, 0];
  for (let t = 0; t < 900 && !bad; t += 0.05) {
    F.step(s, 0.05);
    s.events.forEach(e => {
      if (e.kind === 'stocked' && typeof e.by === 'number' && e.item !== s.stalls[e.at].want) bad = 'robot ' + e.by + ' put ' + e.item + ' in stall ' + (e.at + 1);
      if (e.kind === 'sold') soldAt[e.at]++;
    });
    s.events = [];
    // (geometry, as section 2 walks: 0.1 m clear of every footprint; the pathing grid's padded cells
    // can be clipped at a corner between two string-pulled waypoints)
    s.robots.forEach(r => { if (!bad && F.rects(s).some(q => r.x > q[0] - 0.1 && r.x < q[2] + 0.1 && r.y > q[1] - 0.1 && r.y < q[3] + 0.1)) bad = r.name + ' (' + r.job + ', ' + r.state + ') inside something at ' + r.x.toFixed(2) + ',' + r.y.toFixed(2); });
    s.robots.forEach((r, k) => { if (dist(r, seenAt[k]) > 0.01 || ['idle', 'pause', 'carve', 'wait', 'place'].indexOf(r.state) >= 0) seenAt[k] = { x: r.x, y: r.y, t: s.t }; else if (s.t - seenAt[k].t > 20) bad = bad || r.name + ' stuck in ' + r.state; });
  }
  ok(!bad && s.robots.every(r => r.tally.good > 0 && !r.tally.bad) && soldAt.every(n => n > 3) && !s.shop.wrong,
    'a quarter hour with all eight at work, each stall\'s robot told its "Only stock": nothing wrong in any stall, nobody walks into anything or stands stuck, every robot has done good work, and every stall sells (' + soldAt.join(' / ') + ')', bad || s.robots.map(r => r.name + ' ' + r.tally.good).join(', ') + '; sold ' + soldAt.join('/'));
}

/* ---------- 16. the goals, the slots they unlock, and flat prices (the CD, 2026-10-20) ---------- */
// "start with only one sales stall set to sell medium planks, and slot01 with the planer"; goal 1
// "Sell 50 medium planks" (the sap extractor, slot 02); goal 2 ">$50 & >90% customer satisfaction for
// 10 minutes", counting down while both hold and starting over when either fails (the bench, slot
// 03); goal 3 "Sell 25 sap" (the table saw, slot 04: drafted by Claude); robots and stalls a flat $1
const SLOT_PLACES = { extract: ['extractIn', 'extract', 'extractOut'], carve: ['benchIn', 'bench', 'benchOut'], saw: ['sawIn', 'saw', 'sawOut'] };
const BODY = { extract: 'extract', carve: 'bench', saw: 'saw' };
const slotPosts = j => SLOT_PLACES[j].map(k => [k, SP[k]]).concat([[BODY[j] + 'Bot', SP[BODY[j] + 'Bot']]],
  (SP.fetch[j === 'extract' ? 'extractOut' : j === 'saw' ? 'sawOut' : ''] || []).map((p, i) => [j + 'Fetch' + (i + 1), p]));
const mid = q => ({ x: (q[0] + q[2]) / 2, y: (q[1] + q[3]) / 2 });
// a customer for stall i buys one of this thing, through the shop (the stall set to sell `want`)
function sell(s, item, i, want) {
  const st = s.stalls[i || 0];
  st.bought = true; if (want !== undefined) st.want = want;
  queue(s, 1, i || 0); st.stock.push({ item, by: 'player' });
  const n = take(s, 'sold').length;
  until(s, x => take(x, 'sold').length > n, 20);
  return take(s, 'sold').slice(-1)[0];
}
{
  // the tables
  const G = C.goals;
  ok(G.length === 3 && JSON.stringify(G[0]) === '{"id":"planks","item":"plank.m","n":50,"unlocks":"extract"}' && JSON.stringify(G[1]) === '{"id":"steady","money":50,"sat":90,"sec":600,"unlocks":"carve"}' && JSON.stringify(G[2]) === '{"id":"sap","item":"sap","n":25,"unlocks":"saw"}',
    'three goals, one at a time: sell 50 medium planks (the sap extractor), over $50 and over 90% for 600 s (the bench), sell 25 sap (the table saw; goal 3 drafted by Claude)', JSON.stringify(G));
  ok(G.map(g => g.unlocks).join() === F.SLOT_JOBS.join() && F.SLOT_JOBS.every(j => F.unlocked({ goal: 3 }, j)) && L.ROW.extract < L.ROW.bench && L.ROW.bench < L.ROW.saw,
    'each goal unlocks the next slot down: 02, 03, 04 (the machines moved into the order the goals unlock them, not the numbers)', G.map(g => g.unlocks).join());
  // the start
  const s = shut(F.newGame(160));
  ok(s.goal === 0 && s.goalN === 0 && s.goalT === 600 && JSON.stringify(s.flat) === '{"robot":1,"stall":1}' && s.stalls[0].bought && s.stalls[0].want === 'plank.m' && s.stalls.slice(1).every(q => !q.bought) &&
    F.SLOT_JOBS.every(j => !F.unlocked(s, j)) && F.jobsOpen(s).join() === 'operate,stock:0' && F.unlocked(s, 'operate') && F.unlocked(s, 'stock:2'),
    'a new factory: one stall, selling medium planks, and slot 01\'s planer and nothing else; no goal met, goal 2\'s countdown full, robots and stalls $1', JSON.stringify([s.goal, s.goalN, s.goalT, s.flat, F.jobsOpen(s)]));
  const gn = F.goalNow(s);
  ok(gn.i === 0 && gn.goal.id === 'planks' && gn.left === 50 && gn.t === null && !gn.done && !gn.counting, 'the goal now: sell 50 medium planks, 50 to go (for the wall)', JSON.stringify(gn));
  // a slot not yet unlocked is an empty bay: no machine, no bins, no post; floor you can walk on
  const empty = F.SLOT_JOBS.filter(j => F.free(s, mid(L.SOLID[BODY[j]]).x, mid(L.SOLID[BODY[j]]).y) && SLOT_PLACES[j].every(k => !F.placeOpen(s, k) && !F.rects(s).some(q => q === L.SOLID[k])));
  ok(empty.length === 3, 'slots 02-04 are empty floor: none of their machines, bins or belts stands in the walk', empty.join());
  const before = JSON.stringify(s.avatar), refused = [];
  [].concat.apply([], F.SLOT_JOBS.map(j => SLOT_PLACES[j])).forEach(k => { F.tap(s, { kind: k }); F.step(s, 0.05); if (JSON.stringify(s.avatar) !== before || s.bubble) refused.push(k); });
  ok(!refused.length && ['machine', 'rack', 'recycle', 'dock', 'bin'].every(k => F.placeOpen(s, k)), 'a tap on any of their places does nothing (the planer, its bins, the recycle bin and the dock answer as ever)', refused.join());
  F.tap(s, { kind: 'floor', x: 2.5, y: L.ROW.bench }); until(s, x => !x.avatar.path.length, 20);
  ok(dist(s.avatar, { x: 2.5, y: L.ROW.bench }) < 0.05, 'a tap in the empty bay walks you there: it is floor', s.avatar.x.toFixed(2) + ',' + s.avatar.y.toFixed(2));
  const h = shut(F.newGame(161)); h.money = 1;
  F.tap(h, { kind: 'dock' }); until(h, x => !!F.bubbleOpen(x), 30); F.choose(h, 'hire');
  ok(F.options(h).map(o => o.id).join() === 'job:operate,job:stock:0,job:rest,notes' && F.SLOT_JOBS.every(j => !F.choose(h, 'job:' + j)) && h.robots[0].job === null,
    'a robot can be given the planer or the stall, and no slot whose machine has not arrived', F.options(h).map(o => o.id).join());
}
{
  // goal 1: medium planks carried away, whatever stall they were in
  const s = shut(F.newGame(162));
  F.step(s, 0.05);
  const n0 = s.goalN;
  queue(s, 1); s.stalls[0].stock.push({ item: 'plank.m', by: 'player' });
  until(s, x => x.shop.people[0].state === 'pay', 10);
  const paying = s.goalN;
  until(s, x => take(x, 'sold').length > 0, 10);
  const one = s.goalN;
  sell(s, 'plank.s', 0);
  const small = s.goalN;
  sell(s, 'plank.m', 1, 'b2x4.m');
  ok(!n0 && !paying && one === 1 && small === 1 && s.goalN === 2 && F.goalNow(s).left === 48,
    'a medium plank counts toward "Sell 50 medium planks" when its customer pays and carries it away (not when it is stocked or being paid for), a small plank does not, and a medium plank sold from a 2x4 stall does (assumed: every one carried away)', [n0, paying, one, small, s.goalN].join());
  s.goalN = 48; sell(s, 'plank.m', 0);
  ok(s.goal === 0 && s.goalN === 49 && F.goalNow(s).left === 1 && !take(s, 'goal').length && !F.unlocked(s, 'extract'), 'at 49 the goal is still on the wall, one to go');
  s.events = [];
  sell(s, 'plank.m', 0); F.step(s, 0.05);
  const ge = take(s, 'goal');
  ok(s.goal === 1 && s.goalN === 0 && ge.length === 1 && ge[0].n === 1 && ge[0].id === 'planks' && ge[0].unlocks === 'extract' && F.unlocked(s, 'extract') && !F.unlocked(s, 'carve') && !F.unlocked(s, 'saw') && F.goalNow(s).goal.id === 'steady',
    'the 50th met it: a \'goal\' event (goal 1, the sap extractor), the count back to 0, the extractor unlocked and goal 2 on the wall', JSON.stringify(ge));
  // the extractor arrives: its job, its places, its footprint, its posts
  ok(F.jobsOpen(s).join() === 'operate,stock:0,stock:1,extract' && SLOT_PLACES.extract.every(k => F.placeOpen(s, k)) && !F.free(s, mid(L.SOLID.extract).x, mid(L.SOLID.extract).y) && F.rects(s).indexOf(L.SOLID.extractIn) >= 0 &&
    SLOT_PLACES.carve.concat(SLOT_PLACES.saw).every(k => !F.placeOpen(s, k)) && F.free(s, mid(L.SOLID.bench).x, mid(L.SOLID.bench).y),
    'the sap extractor is there: a job for a robot, its bins and its button answer taps, and it stands in the walk; the bench and the saw are still empty bays', F.jobsOpen(s).join());
  s.avatar.inv.push('sappy.m');
  F.tap(s, { kind: 'extractIn' }); until(s, x => !!F.bubbleOpen(x), 30); F.choose(s, 'put:sappy.m');
  F.tap(s, { kind: 'extract' }); until(s, x => x.extract.out.length === 1 + C.sapUnits.m, 30);
  ok(s.extract.out.filter(k => k === 'sap').length === C.sapUnits.m && s.tally.player.extracted === 1, 'and works: a sap log in, its sap out', s.extract.out.join());
  // a sap sold now (goal 2 on the wall) never counts toward goal 3 (assumed)
  sell(s, 'sap', 1, 'sap'); sell(s, 'plank.m', 0);
  ok(s.goal === 1 && s.goalN === 0, 'a sap or a medium plank sold while goal 2 is on the wall counts toward nothing: each goal counts from when it starts (assumed)', s.goalN);
}
{
  // goal 2: over $50 and over 90% (as the wall shows it), counting down, starting over when either fails
  const g = () => { const s = shut(F.newGame(163)); s.goal = 1; s.money = 51; s.satisfaction = 100; return s; };
  let s = g();
  run(s, 10);
  const ten = s.goalT;
  s.money = 50; F.step(s, 0.05);
  const fifty = s.goalT;
  s.money = 51; run(s, 5); s.satisfaction = 90.4; F.step(s, 0.05);
  const at90 = s.goalT;
  s.satisfaction = 90.6; run(s, 1);
  const at91 = s.goalT;
  ok(Math.abs(ten - 590) < 0.06 && fifty === 600 && at90 === 600 && Math.abs(at91 - 599) < 0.06,
    'over $50 and over 90% it counts down in real (engine) seconds; money at $50 starts it over; satisfaction the wall shows as 90% (90.4) starts it over; 91% (90.6) counts (assumed: what you see is what counts)', [ten, fifty, at90, at91].map(v => v.toFixed(2)).join());
  ok(F.goalNow(s).counting && F.goalNow(s).t === s.goalT && F.goalNow(s).left === null, 'the goal now says it is counting, and how far', JSON.stringify(F.goalNow(s)));
  s = g(); s.satisfaction = 89; run(s, 10);
  ok(s.goalT === 600 && !F.goalNow(s).counting, 'below 90% it does not count at all', s.goalT);
  s = g(); s.money = -5; run(s, 10);
  ok(s.goalT === 600, 'nor at $50 or less', s.goalT);
  s = g(); run(s, 300); s.money = 50; F.step(s, 0.05); s.money = 51; run(s, 599);
  ok(s.goal === 1 && s.goalT > 0.5 && s.goalT < 1.1, 'one step at $50 after five minutes and the whole 10 minutes start again', s.goalT.toFixed(2));
  s = g(); run(s, 400); s.satisfaction = 90; F.step(s, 0.05); s.satisfaction = 100; run(s, 599);
  ok(s.goal === 1 && s.goalT > 0.5 && s.goalT < 1.1, 'and so does one step at 90%', s.goalT.toFixed(2));
  s = g(); s.events = [];
  until(s, x => x.goal === 2, 700);
  const ge = take(s, 'goal');
  ok(s.goal === 2 && Math.abs(s.t - 600) < 0.11 && ge.length === 1 && ge[0].n === 2 && ge[0].id === 'steady' && ge[0].unlocks === 'carve' && F.unlocked(s, 'carve') && !F.unlocked(s, 'saw') && s.goalT === 600 && F.goalNow(s).goal.id === 'sap' && F.goalNow(s).left === 25,
    'held for 600 s, it is met: the bench unlocked (slot 03), and goal 3, sell 25 sap, on the wall', s.t.toFixed(2) + ' ' + JSON.stringify(ge));
  ok(F.jobsOpen(s).join() === 'operate,stock:0,extract,carve' && SLOT_PLACES.carve.every(k => F.placeOpen(s, k)) && !F.free(s, mid(L.SOLID.bench).x, mid(L.SOLID.bench).y) && F.free(s, mid(L.SOLID.saw).x, mid(L.SOLID.saw).y),
    'the bench is there, a job for a robot, its bins answering taps; the saw\'s bay still empty', F.jobsOpen(s).join());
  // the countdown runs only while goal 2 is on the wall
  const z = shut(F.newGame(164)); z.money = 500; run(z, 30);
  ok(z.goalT === 600 && z.goal === 0, 'goal 2\'s countdown does not run while goal 1 is on the wall', z.goalT);
}
{
  // goal 3, and all goals met
  const s = shut(F.newGame(165)); s.goal = 2;
  for (let k = 0; k < 3; k++) sell(s, 'sap', 1, 'sap');
  sell(s, 'plank.m', 0);
  ok(s.goalN === 3 && F.goalNow(s).left === 22, 'sap sold counts toward "Sell 25 sap"; a medium plank does not', s.goalN);
  s.goalN = 24; s.events = []; sell(s, 'sap', 1); F.step(s, 0.05);
  const ge = take(s, 'goal'), gn = F.goalNow(s);
  ok(s.goal === 3 && ge.length === 1 && ge[0].n === 3 && ge[0].id === 'sap' && ge[0].unlocks === 'saw' && F.SLOT_JOBS.every(j => F.unlocked(s, j)) && gn.done && gn.goal === null && gn.left === null && gn.t === null,
    'the 25th meets goal 3: the table saw unlocked (slot 04), and every goal met', JSON.stringify(gn));
  ok(F.jobsOpen(s).join() === 'operate,stock:0,stock:1,extract,carve,saw' && F.SLOT_JOBS.every(j => SLOT_PLACES[j].every(k => F.placeOpen(s, k))), 'all three slots\' jobs and places are open', F.jobsOpen(s).join());
  s.money = 500; s.events = [];
  for (let k = 0; k < 3; k++) sell(s, 'sap', 1);
  sell(s, 'plank.m', 0); run(s, 700);
  ok(s.goal === 3 && s.goalN === 0 && s.goalT === 600 && !take(s, 'goal').length, 'with all goals met nothing more counts and no goal is met again', JSON.stringify([s.goal, s.goalN, s.goalT]));
}
{
  // each unlock: its robot posts reachable from every charging pad, one robot unpacked or all eight
  const bad = [];
  [1, 2, 3].forEach(k => [1, 8].forEach(n => {
    const s = F.newGame(); s.goal = k; s.hired = n;
    F.SLOT_JOBS.slice(0, k).forEach(j => slotPosts(j).forEach(([name, q]) => {
      if (!F.free(s, q.x, q.y)) bad.push('goal ' + k + ': ' + name + ' not on free floor');
      for (let i = 0; i < n; i++) { const p = F.path(s, SP.rest[i], q); if (!p.length || dist(p[p.length - 1], q) > 0.15 || !segFree(s, SP.rest[i], p)) bad.push('goal ' + k + ', ' + n + ' hired: pad ' + (i + 1) + '>' + name); }
    }));
  }));
  ok(!bad.length, 'after each goal, every post of every slot unlocked so far (its bins, its button, its robot\'s place, the stall robots\' places at its output bin) stands on free floor and is reached from every charging pad, with one robot unpacked or all eight', bad.slice(0, 5).join(', '));
  // a robot given the new job walks to it and works
  const s = shut(F.newGame(166)); s.goal = 1; s.money = 1;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 30); F.choose(s, 'hire');
  ok(F.choose(s, 'job:extract') && s.robots[0].job === 'extract', 'once the extractor is there a robot can be given it');
  until(s, x => atHome(x, x.robots[0]), 60);
  s.extract.in.push('sappy.s'); until(s, x => x.extract.out.length === 2, 20);
  ok(dist(s.robots[0], SP.extractBot) < 0.07 && s.robots[0].record['extracted:sappy.s'] === 1, 'and it walks to the extractor and runs it');
  // the walk: a machine arriving under your feet, or across your path
  const w = shut(F.newGame(167)); w.goalN = 50;
  const b = L.SOLID.extract; w.avatar.x = mid(b).x; w.avatar.y = mid(b).y; w.avatar.path = [];
  F.step(w, 0.05);
  ok(w.goal === 1 && F.free(w, w.avatar.x, w.avatar.y) && dist(w.avatar, mid(b)) < 1.2, 'standing in the bay when the extractor arrives, you step out to the nearest free floor', w.avatar.x.toFixed(2) + ',' + w.avatar.y.toFixed(2));
  const v = shut(F.newGame(168));
  v.avatar.x = 2.4; v.avatar.y = 5.9;
  F.tap(v, { kind: 'floor', x: 2.4, y: 9.2 });
  const straight = v.avatar.path.length === 1;
  F.step(v, 0.05); v.goalN = 50;
  let inside = '';
  for (let k = 0; k < 200; k++) { F.step(v, 0.05); if (!inside && F.rects(v).some(q => v.avatar.x > q[0] - 0.05 && v.avatar.x < q[2] + 0.05 && v.avatar.y > q[1] - 0.05 && v.avatar.y < q[3] + 0.05)) inside = v.avatar.x.toFixed(2) + ',' + v.avatar.y.toFixed(2); }
  ok(straight && v.goal === 1 && !inside && dist(v.avatar, { x: 2.4, y: 9.2 }) < 0.05, 'walking straight across the empty bay when the extractor arrives, you go round it instead, and get there (the walk\'s grid is rebuilt for the new machine)', inside || (v.avatar.x.toFixed(2) + ',' + v.avatar.y.toFixed(2)));
  const r = shut(F.newGame(169)); r.money = 1;
  F.tap(r, { kind: 'dock' }); until(r, x => !!F.bubbleOpen(x), 30); F.choose(r, 'hire'); F.choose(r, 'job:operate');
  until(r, x => x.robots[0].state === 'move' && x.robots[0].y < 12, 30);
  const crossing = r.robots[0].path.length > 0 && r.robots[0].y > L.SOLID.extract[3];
  r.goalN = 50;
  let hit = '';
  for (let k = 0; k < 400; k++) { F.step(r, 0.05); const q = r.robots[0]; if (!hit && F.rects(r).some(f => q.x > f[0] - 0.05 && q.x < f[2] + 0.05 && q.y > f[1] - 0.05 && q.y < f[3] + 0.05)) hit = q.x.toFixed(2) + ',' + q.y.toFixed(2); }
  ok(crossing && r.goal === 1 && !hit && dist(r.robots[0], SP.operate) < 0.07, 'and so does a robot walking up through the bays to the planer when the extractor arrives, and gets to its button', hit || r.robots[0].state);
}
{
  // flat prices
  const s = shut(F.newGame(170));
  ok(F.hirePrice(s) === 1 && F.stallPrice(s) === 1, 'a robot and a stall each cost $1 to begin with');
  ok(F.setFlat(s, 'robot', 7) && F.setFlat(s, 'stall', 12) && F.hirePrice(s) === 7 && F.stallPrice(s) === 12 && take(s, 'flatset').map(e => e.what + e.price).join() === 'robot7,stall12', 'set in the menu, each has its own flat price', JSON.stringify(s.flat));
  const tries = [[-5, 0], [250, 200], [2.6, 3], [0, 0], [200, 200]], off = tries.filter(([v, want]) => !F.setFlat(s, 'robot', v) || s.flat.robot !== want);
  const no = [['robot', 'x'], ['robot', NaN], ['robot', Infinity], ['robot', null], ['robot', undefined], ['wage', 5], [undefined, 5]].filter(([w, v]) => { const was = JSON.stringify(s.flat); return F.setFlat(s, w, v) || JSON.stringify(s.flat) !== was; });
  ok(!off.length && !no.length, 'whole dollars from $0 to $200: -5 is $0, 250 is $200, 2.6 is $3 (rounded, clamped: assumed), and anything not a number, or not a robot or a stall, is refused and changes nothing', off.concat(no).map(x => String(x[0]) + '/' + String(x[1])).join());
  F.setFlat(s, 'robot', 3); s.money = 3;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 30);
  ok(F.options(s)[0].price === 3 && F.choose(s, 'hire') && s.money === 0 && take(s, 'hired')[0].price === 3, 'the dock asks the price set, and that is what a robot costs');
  s.money = 11.99; F.tap(s, { kind: 'stall', i: 1 }); until(s, x => !!F.bubbleOpen(x) && !x.avatar.act, 30);
  ok(F.options(s)[0].price === 12 && !F.options(s)[0].enabled && !F.choose(s, 'buystall') && (s.money = 12) && F.choose(s, 'buystall') && s.money === 0 && s.stalls[1].bought, 'and the counter the stall price: out of reach at $11.99, bought at $12');
  F.setFlat(s, 'robot', 0); s.money = -3;
  F.tap(s, { kind: 'dock' }); until(s, x => !!F.bubbleOpen(x), 30);
  ok(F.options(s)[0].price === 0 && F.options(s)[0].enabled && F.choose(s, 'hire') && s.money === -3 && s.robots.length === 2, 'at $0 a robot is free, even with money below zero (assumed)', s.money);
  s.money = 1e6; F.setFlat(s, 'stall', 1);
  [2, 3].forEach(i => { F.tap(s, { kind: 'stall', i }); until(s, x => !!F.bubbleOpen(x) && !x.avatar.act, 30); F.choose(s, 'buystall'); });
  ok(F.stallPrice(s) === null && s.stalls.every(q => q.bought), 'once all four places are stalls there is no stall price');
  // a new factory with the prices carried over (Start over keeps them: a setting, not progress)
  const n = F.newGame(171, s.flat), d = F.newGame(171), junk = F.newGame(171, { robot: 'free', stall: 999 }), cut = F.newGame(171, { robot: 4.4, stall: -2 });
  ok(JSON.stringify(n.flat) === '{"robot":0,"stall":1}' && n.flat !== s.flat && n.goal === 0 && n.stalls.filter(q => q.bought).length === 1 && !n.robots.length && JSON.stringify(d.flat) === '{"robot":1,"stall":1}' &&
    JSON.stringify(junk.flat) === '{"robot":1,"stall":200}' && JSON.stringify(cut.flat) === '{"robot":4,"stall":0}' && JSON.stringify(Object.assign({}, n, { flat: null })) === JSON.stringify(Object.assign({}, d, { flat: null })),
    'newGame(seed, flat) starts a new factory with those prices and nothing else carried over; with none, or nonsense, $1 each (clamped as set)', JSON.stringify([n.flat, junk.flat, cut.flat]));
}
{
  // saves: new ones round-trip; one from before the goals has every goal met
  const s = crew(172, ['plank.m', 'sap'], ['operate', 'stock:0', 'stock:1', 'extract']);
  s.goal = 1; s.goalT = 412.35; s.goalN = 0; F.setFlat(s, 'robot', 3); F.setFlat(s, 'stall', 7); s.money = 80; s.events = []; s.force = {};
  run(s, 3);
  const text = F.save(s), b = F.load(text);
  const strip = x => JSON.stringify(Object.assign({}, x, { events: [] }));
  ok(b && strip(b) === strip(s) && b.goal === 1 && Math.abs(b.goalT - s.goalT) < 1e-9 && JSON.stringify(b.flat) === '{"robot":3,"stall":7}' && b.robots[3].job === 'extract', 'a save keeps the goals met, goal 2\'s countdown part run, the count, and the flat prices', b && JSON.stringify([b.goal, b.goalT, b.goalN, b.flat]));
  run(s, 30); run(b, 30);
  ok(strip(s) === strip(b) && s.goalT < 400, 'and both carry on counting down identically', s.goalT.toFixed(2));
  const g1 = shut(F.newGame(173)); g1.goalN = 31;
  const back1 = F.load(F.save(g1));
  ok(back1 && back1.goal === 0 && back1.goalN === 31 && F.SLOT_JOBS.every(j => !F.unlocked(back1, j)), 'and a count part way to 50, with the slots still locked');
  const old = JSON.parse(F.save(s));
  ['goal', 'goalN', 'goalT', 'flat'].forEach(k => delete old[k]);
  old.saw.in = ['plank.l']; old.bench.in = ['gnarled.s']; old.robots[2].job = 'saw';
  const was = F.load(JSON.stringify(old));
  ok(was && was.version === C.version && was.goal === 3 && was.goalN === 0 && was.goalT === 600 && JSON.stringify(was.flat) === '{"robot":1,"stall":1}' && F.SLOT_JOBS.every(j => F.unlocked(was, j)) && was.robots[2].job === 'saw' && was.robots[3].job === 'extract' && was.saw.in.join() === 'plank.l' && was.bench.in.join() === 'gnarled.s',
    'a save from before the goals loads with all three met (no version bump): every slot, its robots and whatever is in its bins kept; goal 2\'s countdown full; robots and stalls $1 (assumed)', was && JSON.stringify([was.goal, was.flat, was.robots.map(r => r.job)]));
  const hack = JSON.parse(F.save(s));
  const tries = [[{ goal: 7 }, 3], [{ goal: -2 }, 0], [{ goal: 1.7 }, 1], [{ goal: 'x' }, 3], [{ goal: null }, 3]];
  const offG = tries.filter(([o, want]) => { const l = F.load(JSON.stringify(Object.assign({}, hack, o))); return !l || l.goal !== want; });
  const l1 = F.load(JSON.stringify(Object.assign({}, hack, { goal: 0, goalN: 999, goalT: 'x', flat: { robot: 'free', stall: 999 } })));
  const l2 = F.load(JSON.stringify(Object.assign({}, hack, { goal: 0, goalN: -4 }))), l3 = F.load(JSON.stringify(Object.assign({}, hack, { goal: 1, goalT: 9999 })));
  ok(!offG.length && l1 && l1.goalN === 50 && l1.goalT === 600 && JSON.stringify(l1.flat) === '{"robot":1,"stall":200}' && l2.goalN === 0 && l3.goalT === 600 && l1.robots[3].job === null,
    'a hand-edited save is clamped: a goal past the last is all met, below the first none, a fraction rounded down; a count to the goal\'s own, a countdown to its length, prices to whole dollars in bounds; and a robot on a slot not yet unlocked rests', JSON.stringify(offG) + ' ' + (l1 && JSON.stringify([l1.goalN, l1.goalT, l1.flat, l1.robots[3].job])));
  run(l1, 0.1);
  ok(l1.goal === 1 && F.unlocked(l1, 'extract'), 'and a count already at 50 meets the goal on the next step');
}
{
  // a goal rolls nothing: the same day, one twin a sale short of goal 1, the other far from it
  const day = n => {
    const t = staffed(174, ['operate', 'stock:0']); t.goalN = n; t.events = [];
    const log = [];
    for (let k = 0; k < 6000; k++) {
      F.step(t, 0.05);
      t.events.forEach(e => { if (e.kind === 'outcome' || e.kind === 'sold' || e.kind === 'recycled' || e.kind === 'looking' || e.kind === 'customer' || e.kind === 'goal') log.push(e.kind + ':' + (e.what || e.sale || e.item || e.id || '')); });
      t.events = [];
      if (t.machine.phase === 'jam') { t.machine.dirt = 0.001; t.avatar.act = { kind: 'clean', t: 0 }; }
    }
    return { log: log.filter(x => x.indexOf('goal:') !== 0).join(), goals: log.filter(x => x.indexOf('goal:') === 0).join(), seed: t.seed, money: t.money, goal: t.goal };
  };
  const far = day(0), near = day(49);
  ok(far.log.length > 200 && near.goals === 'goal:planks' && far.goals === '' && near.goal === 1 && far.goal === 0 && near.log === far.log && near.seed === far.seed && near.money === far.money,
    'a goal rolls no die: a day that meets goal 1 at its first sale (the extractor arriving, off the robots\' way) is the same day as one that does not, roll for roll', near.goals + ' / ' + far.money + ' vs ' + near.money);
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
