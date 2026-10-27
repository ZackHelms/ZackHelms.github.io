#!/usr/bin/env node
/**
 * drive-taas-factory2.cjs - rules gate for TAAS's Robot factory v2 (pure node, a few seconds).
 *
 * v2 is its own page, games/taas/factory-v2.html (the CD, 2026-10-26), with its whole simulation in
 * one DOM-free block (`const FACTORY2 = (function () { ... })()`), checked here lifted out of the
 * page with no browser. What it holds to, from the CD's brief and the choices made for it (.claude/
 * taas.md section "Robot factory v2"): the planer and the sap extractor run by themselves from their
 * hoppers into their output bins; logs come from a raw materials bin that a dump truck fills, ten
 * for $10, whenever it is empty; robots are bought, called up and sent down by an elevator at a
 * terminal; a robot's main prompt is a source (any bin or stall) and a destination (any bin, stall,
 * the table saw or the bench); its instruction lines are four words each from fixed lists, read in
 * order, the first about a thing deciding it; a line that means nothing does nothing but add 5% to
 * how often the robot ignores every line for a trip; and a good set of lines reaches the first goal.
 * The same shop, wood, goals and stalls as the first factory, which drive-taas-factory.cjs keeps.
 * Numbers come from FACTORY2.CFG, so a retune never turns this red, except where the CD set them.
 * The page around the engine is drive-taas-factory2-ui.cjs.
 *
 * Usage:
 *   node .claude/tests/drive-taas-factory2.cjs
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas-factory2.cjs   # negtest-copies
 *
 * Final line: TAAS-FACTORY2: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'factory-v2.html');

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined && detail !== '' ? ' (' + detail + ')' : '')); }
}
function lift(page) {
  const src = fs.readFileSync(page, 'utf8');
  const a = src.indexOf('const FACTORY2 = (function');
  const end = "if (typeof module !== 'undefined') module.exports = FACTORY2;";
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('factory v2 engine block not found in ' + page);
  return new Function(src.slice(a, b) + '\nreturn FACTORY2;')();
}
let F;
try { F = lift(PAGE); } catch (e) { console.log('FAIL engine loads (' + e.message + ')'); console.log('TAAS-FACTORY2: RED'); process.exit(1); }
const C = F.CFG, L = F.LAYOUT, SP = L.SPOT;

const run = (s, sec, dt) => { const h = dt || 0.05; for (let t = 0; t < sec - 1e-9; t += h) F.step(s, h); return s; };
const until = (s, pred, max) => { for (let t = 0; t < (max || 60); t += 0.05) { if (pred(s)) return true; F.step(s, 0.05); } return pred(s); };
const take = (s, kind) => s.events.filter(x => x.kind === kind);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const many = (v, n) => Array(n || 60).fill(v);
const shut = s => { s.shop.next = 1e9; return s; };   // nobody comes in
const open3 = s => { s.goal = C.goals.length; return s; };   // every goal met: slots 02-04 open
// a factory with n robots on the floor, bought at the terminal and ridden up the elevator
function staffed(seed, n, prep) {
  const s = shut(F.newGame(seed || 1));
  if (prep) prep(s);
  s.money = (n || 1) * s.flat.robot;
  for (let i = 0; i < (n || 1); i++) F.buyRobot(s);
  until(s, x => x.robots.every(r => r.where === 'floor' && dist(r, SP.pads[r.id]) < 0.07), 60);   // up, and on its pad
  s.events.length = 0;
  return s;
}
const strip = s => { const o = JSON.parse(F.save(s)); return JSON.stringify(o); };

/* ---------- 1. the floor ---------- */
{
  const s = open3(F.newGame(1));
  const spots = [SP.start, SP.machine, SP.planerIn, SP.bin, SP.binN, SP.recycle, SP.terminal, SP.raw, SP.lift, SP.extract, SP.saw, SP.bench]
    .concat(SP.pads, SP.stalls, [].concat.apply([], Object.keys(L.BOT).map(k => L.BOT[k])));
  const bad = spots.filter(p => !F.free(s, p.x, p.y));
  ok(!bad.length, 'every spot you or a robot stands on is free floor, with every slot open', JSON.stringify(bad.slice(0, 3)));
  const lab = F.grid(s).lab, at = p => lab[Math.floor(p.y / F.CELL) * Math.round(L.W / F.CELL) + Math.floor(p.x / F.CELL)];
  ok(spots.every(p => at(p) === at(SP.start)), 'and every one of them is reachable from where you start (one piece of floor)');
  ok(F.SOURCES.every(k => L.BOT[k] && L.BOT[k].length) && ['saw', 'bench'].every(k => L.BOT[k].length), 'every source and destination has a spot for a robot');
  ok(['raw', 'planerIn', 'bin', 'recycle', 'stall0'].every(k => L.BOT[k].length >= 2), 'the busy places have room for two robots side by side');
  const fresh = F.newGame(1), lb = F.grid(fresh).lab;
  ok([SP.terminal, SP.raw, SP.lift, SP.planerIn, SP.bin].every(p => F.free(fresh, p.x, p.y)), 'with only slot 01, the terminal, the raw materials bin, the elevator and the planer\'s two bins are reachable');
  void lb;
  ok(L.LIFT.x0 < SP.lift.x && SP.lift.x < L.LIFT.x1 && L.LIFT.y0 < SP.lift.y && SP.lift.y < L.LIFT.y1, 'a robot riding the elevator stands on its platform');
  ok(SO_ok(), 'the robot row sits below slot 04 and inside the floor; the truck is outside its front edge');
  function SO_ok() { const S = L.SOLID; return S.terminal[1] > 14 && S.raw[3] < L.H && S.raw[0] > S.liftFrame[2] && L.TRUCK.y0 > L.H && L.TRUCK.x0 < S.raw[0] + 0.2 && L.TRUCK.x1 > S.raw[2] - 0.2; }
}

/* ---------- 2. a new factory ---------- */
{
  const s = F.newGame(7);
  ok(s.raw.length === C.startLogs && s.raw.every(F.isItem) && s.costs.bought === 0, 'a new factory\'s raw materials bin holds ' + C.startLogs + ' logs, free');
  ok(C.truck.n === 10 && C.truck.cost === 10 && C.startLogs === 10, 'the truck brings ten logs for $10, and a new bin starts with ten (the CD: "filled up with 10 items just like how the slot1 input bin used to behave")');
  ok(s.planer.in.length === C.startHopper && s.planer.in.every(x => x === 'log.m'), 'and the planer\'s hopper holds ' + C.startHopper + ' medium logs, so it runs from the start');
  ok(s.money === 0 && s.robots.length === 0 && s.goal === 0 && s.stalls[0].bought && s.stalls[0].want === 'plank.m' && !s.stalls[1].bought, 'no money, no robots, the first goal, one stall selling medium planks');
  ok(!F.unlocked(s, 'extract') && !F.unlocked(s, 'carve') && !F.unlocked(s, 'saw') && F.placeOpen(s, 'raw') && F.placeOpen(s, 'terminal'), 'slots 02-04 locked; the robot row is always there');
}

/* ---------- 3. the planer and the extractor run by themselves ---------- */
{
  const s = shut(F.newGame(3));
  F.step(s, 0.05);
  ok(s.planer.phase === 'run' && s.planer.by === 'auto' && take(s, 'press').length === 1 && s.costs.runs === C.runCost, 'the planer starts on its hopper with nobody pressing anything, ' + C.runCost + ' a run');
  until(s, x => x.planer.out.length >= C.startHopper, C.startHopper * (C.processSec + 2) + 5);
  ok(s.planer.out.length === C.startHopper && s.planer.out.every(x => x === 'plank.m') && s.planer.in.length === 0, 'all six logs become medium planks in the output bin on its right');
  ok(Math.abs(s.costs.runs - C.startHopper * C.runCost) < 1e-9 && s.planer.phase === 'idle', 'six runs paid for, and it stops when the hopper is empty');
  const j = shut(F.newGame(3)); j.planer.in = ['plank.m'];
  run(j, C.jamAt + 0.2);
  ok(j.planer.phase === 'jam' && take(j, 'jam').length === 1, 'a plank in the planer\'s hopper jams it');
  j.planer.in.push('log.m'); run(j, 6);
  ok(j.planer.phase === 'jam' && j.planer.in.length === 1, 'and a jammed planer runs nothing more until it is scrubbed');
  F.tap(j, { kind: 'machine' }); until(j, x => x.planer.phase !== 'jam', 30);
  ok(j.planer.phase !== 'jam' && j.costs.fixes === C.fixCost && j.recycle.join() === 'plank.m', 'tapping the planer scrubs it: $' + C.fixCost + ', the plank to the recycle bin, and it carries on');
  const g = shut(F.newGame(3)); g.planer.in = ['gnarled.l', 'sappy.s'];
  run(g, C.processSec + 2);
  ok(g.planer.out.indexOf('rough.l') >= 0 && g.planer.phase !== 'idle', 'a gnarled log makes a gnarled plank of its size; the sap log behind it jams it');
  const e = shut(open3(F.newGame(4))); e.planer.in = []; e.extract.in = ['sappy.m', 'log.s', 'plank.s'];
  until(e, x => x.extract.out.length >= 4, 20);
  ok(e.extract.out.filter(x => x === 'sap').length === C.sapUnits.m && e.extract.out.indexOf('log.m') >= 0, 'the extractor runs by itself too: a medium sap log gives ' + C.sapUnits.m + ' sap and a clean medium log');
  until(e, x => x.extract.out.indexOf('log.s') >= 0, 20);
  ok(e.extract.out.indexOf('log.s') >= 0 && take(e, 'milled').some(m => m.empty), 'a log with no sap runs empty and comes back');
  until(e, x => x.extract.phase === 'jam', 20);
  ok(e.extract.phase === 'jam', 'and a plank jams it');
  const l = shut(F.newGame(4)); l.planer.in = []; l.extract.in = ['sappy.m']; run(l, 6);
  ok(l.extract.phase === 'idle' && l.extract.in.length === 1, 'a locked extractor runs nothing');
  const w = shut(open3(F.newGame(5))); w.planer.in = []; w.saw.in = ['plank.m']; run(w, 5);
  ok(w.saw.phase === 'idle' && w.saw.in.length === 1, 'the table saw does not run by itself: it is pressed');
}

/* ---------- 4. the raw materials bin and the dump truck ---------- */
{
  const s = shut(F.newGame(9)); s.planer.in = [];
  s.raw = [];
  F.step(s, 0.05);
  ok(s.truck.phase === 'wait', 'an empty raw materials bin calls the truck');
  run(s, C.truck.delay + 0.1);
  ok(s.truck.phase === 'tip' && s.truck.load.length === C.truck.n && take(s, 'truck').length === 1 && s.raw.length === 0 && s.costs.bought === 0, 'it tips its bed with ' + C.truck.n + ' logs; nothing is paid until they land');
  run(s, C.truck.tipSec);
  ok(s.raw.length === C.truck.n && s.costs.bought === C.truck.cost && s.money === -C.truck.cost && take(s, 'restock').length === 1, 'they land in the bin, $' + C.truck.cost + ' (money may go below zero)');
  ok(s.truck.phase === 'lower', 'then it lowers its bed');
  run(s, C.truck.lowerSec + 0.1);
  ok(s.truck.phase === 'away', 'drives off for the next load');
  s.raw = []; run(s, 1);
  ok(s.truck.phase === 'away' && s.raw.length === 0, 'an empty bin while it is away waits for it');
  until(s, x => x.raw.length > 0, C.truck.awaySec + C.truck.delay + C.truck.tipSec + 2);
  ok(s.raw.length === C.truck.n && s.costs.bought === 2 * C.truck.cost, 'and it fills the bin once it is back');
  const c = shut(F.newGame(9)); c.planer.in = []; c.raw = [];
  F.step(c, 0.05); c.raw.push('log.m'); run(c, C.truck.delay + C.truck.tipSec + 1);
  ok(c.truck.phase === 'parked' && c.raw.length === 1 && c.costs.bought === 0, 'something put in the bin before it tips calls it off');
  const n = shut(F.newGame(9)); run(n, 30);
  ok(n.truck.phase === 'parked' && !take(n, 'truck').length, 'a bin with logs in it brings no truck');
  // the truck's logs come in every size alike (the CD, 2026-10-27: "Make the raw materials truck
  // deliveries uniformly random sizes"), the CD's number asserted as a literal
  ok(C.logs.size.s === 1 / 3 && C.logs.size.m === 1 / 3 && C.logs.size.l === 1 / 3, 'the truck\'s logs are small, medium and large, a third each');
  const u = shut(F.newGame(17)); u.planer.in = []; const sz = { s: 0, m: 0, l: 0 };
  for (let k = 0; k < 150; k++) { u.raw = []; until(u, x => x.raw.length > 0, 20); u.raw.forEach(id => sz[F.sizeOf(id)]++); }
  const tot = sz.s + sz.m + sz.l;
  ok(tot === 1500 && ['s', 'm', 'l'].every(z => sz[z] / tot > 0.29 && sz[z] / tot < 0.38), 'and 150 truckloads come out about a third of each size', JSON.stringify(sz));
}

/* ---------- 5. robots: the terminal and the elevator ---------- */
{
  const s = shut(F.newGame(11));
  ok(!F.buyRobot(s) && s.robots.length === 0, 'a robot costs $' + s.flat.robot + ': with no money, none');
  s.money = 3;
  const r = F.buyRobot(s);
  ok(r && s.money === 3 - s.flat.robot && r.where === 'queued' && take(s, 'hired').length === 1, 'bought: paid for, and waiting below for the elevator');
  F.step(s, 0.05);
  ok(r.where === 'up' && s.lift.by === r.id && s.lift.dir === 'up', 'the elevator brings it up');
  F.buyRobot(s); F.step(s, 0.05);
  ok(s.robots[1].where === 'queued' && s.lift.by === r.id, 'one ride at a time: the second waits');
  run(s, C.elevSec);
  ok(r.where === 'floor' && take(s, 'arrived').length >= 1, 'after ' + C.elevSec + ' s it steps off onto the floor');
  until(s, x => x.robots[1].where === 'floor', 10);
  until(s, x => dist(x.robots[0], SP.pads[0]) < 0.07 && dist(x.robots[1], SP.pads[1]) < 0.07, 20);
  ok(dist(s.robots[0], SP.pads[0]) < 0.07 && dist(s.robots[1], SP.pads[1]) < 0.07, 'a robot with no main prompt goes to its own charging pad');
  const m = staffed(12, 8);
  ok(m.robots.length === 8 && m.robots.every(x => x.where === 'floor') && F.hirePrice(m) === null && !F.buyRobot((m.money = 99, m)), 'up to ' + C.names.length + ' robots, then none');
  // down to storage and back up, keeping what it was told
  const d = staffed(13, 2);
  F.setPrompt(d, 0, 'raw', 'planerIn'); F.setLine(d, 0, 0, ['carry', '3', 'things', 'atime']);
  until(d, x => x.robots[0].carry.length > 0, 30);
  const held = d.robots[0].carry.length, rawBefore = d.raw.length;
  ok(F.sendDown(d, 0) && d.robots[0].carry.length === 0 && d.raw.length === rawBefore + held, 'sent down: it puts back what it carries where it came from');
  ok(!F.sendDown(d, 0), 'and it cannot be sent twice');
  until(d, x => x.robots[0].where === 'storage', 30);
  ok(d.robots[0].where === 'storage' && d.robots[0].src === 'raw' && d.robots[0].lines.length === 1 && take(d, 'stored').length === 1, 'it walks onto the platform, rides down, and keeps its main prompt and its lines in storage');
  const before = d.raw.length; run(d, 10);
  ok(d.raw.length === before, 'a robot in storage does nothing');
  ok(F.callUp(d, 0) && d.robots[0].where === 'queued' && !F.callUp(d, 1), 'a stored robot can be called up (one on the floor cannot)');
  until(d, x => x.robots[0].where === 'floor', 10);
  until(d, x => x.robots[0].carry.length > 0, 40);
  ok(d.robots[0].where === 'floor' && d.robots[0].carry.length > 0, 'and back on the floor it goes straight back to work');
  // a robot waiting to go down is taken before one waiting to come up
  const q = staffed(14, 1); q.money = 5;
  F.buyRobot(q); F.step(q, 0.05);   // robot 1 rides up, so the elevator is busy
  F.sendDown(q, 0); F.buyRobot(q);  // robot 0 walks onto the platform; robot 2 waits below
  until(q, x => x.robots[1].where === 'floor', 10); F.step(q, 0.05);
  ok(q.robots[0].state === 'onLift' && q.lift.by === 0 && q.lift.dir === 'down' && q.robots[2].where === 'queued', 'when the elevator comes free, a robot waiting on the platform to go down rides before one waiting below to come up', JSON.stringify([q.robots[0].state, q.lift]));
}

/* ---------- 6. the main prompt ---------- */
{
  const s = staffed(21, 1);
  ok(!F.setPrompt(s, 0, 'saw', 'bin') && !F.setPrompt(s, 0, 'raw', 'raw') && !F.setPrompt(s, 0, 'planer', 'bin'), 'a source is a bin or a stall, never a machine, and never its own destination');
  ok(!F.setPrompt(s, 0, 'raw', 'extractIn') && !F.setPrompt(s, 0, 'raw', 'saw') && !F.setPrompt(s, 0, 'raw', 'stall1'), 'a place in a locked slot, or a stall not bought, is not a choice');
  ok(F.setPrompt(s, 0, 'raw', 'planerIn') && s.robots[0].src === 'raw' && s.robots[0].dst === 'planerIn', 'from the raw materials bin to the planer\'s hopper');
  const raw0 = s.raw.length;
  until(s, x => take(x, 'moved').length >= 1, 60);
  const mv = take(s, 'moved')[0];
  ok(mv && mv.items.length === 1 && s.raw.length === raw0 - 1, 'it walks to its source, takes one thing, and puts it in its destination', JSON.stringify(mv));
  until(s, x => take(x, 'moved').length >= 3, 120);
  ok(take(s, 'moved').length >= 3 && take(s, 'moved').every(e => e.from === 'raw' && e.to === 'planerIn'), 'and goes back for the next, for as long as there is something to take');
  const t = staffed(22, 1, open3);
  ok(F.setPrompt(t, 0, 'bin', 'saw') && F.setPrompt(t, 0, 'bin', 'bench') && F.setPrompt(t, 0, 'stall0', 'recycle') && F.setPrompt(t, 0, 'recycle', 'raw'), 'a destination can be the saw or the bench; a stall and the recycle bin can be sources');
  ok(F.setPrompt(t, 0, null, null) && t.robots[0].src === null, 'and the prompt can be cleared');
}

/* ---------- 7. the words ---------- */
{
  const P = F.parse;
  ok(P(['only', 'medium', 'logs', 'none']).kind === 'filter' && P(['never', 'any', 'gplanks', 'none']).kind === 'filter' && P(['recycle', 'large', 'planks', 'none']).kind === 'filter', 'Only take / Never take / Recycle, a size or "any", a thing, no ending: a filter');
  ok(P(['wait', '5', 'seconds', 'trips']).sec === 5 && P(['wait', '10', 'seconds', 'none']).sec === 10, 'Wait n seconds (between trips)');
  ok(P(['carry', '3', 'things', 'atime']).n === 3 && P(['carry', '4', 'logs', 'none']).n === 4 && P(['carry', '60', 'things', 'atime']).n === C.carryMax, 'Carry n things (at a time), never more than ' + C.carryMax);
  ok(P(['stop', '2', 'things', 'dest']).n === 2 && P(['stop', '6', 'planks', 'none']).noun === 'planks', 'Stop at n things (in the destination)');
  const nonsense = [['wait', 'medium', 'planks', 'atime'], ['only', '5', 'logs', 'none'], ['recycle', 'small', 'sap', 'none'], ['carry', 'any', 'seconds', 'dest'], ['only', 'medium', 'seconds', 'none'], ['only', 'medium', 'logs', 'trips'], ['stop', '3', 'seconds', 'dest'], ['wait', '5', 'logs', 'trips']];
  ok(nonsense.every(l => P(l).kind === 'nonsense'), 'and the rest is nonsense (a size on sap, a number on a filter, seconds of logs, an ending that does not fit)', JSON.stringify(nonsense.filter(l => P(l).kind !== 'nonsense')));
  ok(F.lineText(['only', 'medium', 'logs', 'none']) === 'Only take medium logs' && F.lineText(['wait', '5', 'seconds', 'trips']) === 'Wait 5 seconds between trips' && F.lineText(['stop', '2', 'things', 'dest']) === 'Stop at 2 things in the destination', 'a line reads as a sentence');
  const s = staffed(31, 1);
  ok(!F.setLine(s, 0, 0, ['only', 'medium', 'logs']) && !F.setLine(s, 0, 0, ['only', 'medium', 'logs', 'bogus']) && !F.setLine(s, 0, 1, ['only', 'any', 'things', 'none']), 'a line is four words from the lists, added at the end');
  for (let k = 0; k < C.lines; k++) F.setLine(s, 0, k, ['wait', String([1, 2, 3, 4, 5, 6][k]), 'seconds', 'none']);
  ok(s.robots[0].lines.length === C.lines && !F.setLine(s, 0, C.lines, ['wait', '1', 'seconds', 'none']), 'up to ' + C.lines + ' lines');
  ok(F.moveLine(s, 0, 0, 1) && s.robots[0].lines[0][1] === '2' && s.robots[0].lines[1][1] === '1' && !F.moveLine(s, 0, 0, -1) && !F.moveLine(s, 0, C.lines - 1, 1), 'a line moves up or down, not off the ends');
  ok(F.removeLine(s, 0, 0) && s.robots[0].lines.length === C.lines - 1 && s.robots[0].lines[0][1] === '1', 'and is removed');
  ok(F.mind(s.robots[0]).wait === 1, 'with several Wait lines, the first one counts');
  // a word left blank (the CD, 2026-10-27: Done "should save it as is with nothing/blank for the
  // unspecified fields"): a blank size reads as "any"; any other blank leaves the line nonsense
  const B_ = F.BLANK;
  ok(B_.join() === '_,_,_,none' && P(['only', '_', 'logs', 'none']).kind === 'filter' && P(['only', '_', 'logs', 'none']).size === null && P(['recycle', '_', 'sap', 'none']).kind === 'filter', 'a blank size is any size: "Only take logs", "Recycle sap"');
  ok([['_', 'medium', 'logs', 'none'], ['only', 'medium', '_', 'none'], ['wait', '_', 'seconds', 'none'], ['carry', '_', 'things', 'atime'], ['stop', '_', 'planks', 'dest'], ['_', '_', 'seconds', 'trips']].every(l => P(l).kind === 'nonsense'), 'a blank verb, thing or number means nothing');
  ok(F.lineText(['only', '_', 'logs', 'none']) === 'Only take logs' && F.lineText(['_', 'medium', '_', 'none']) === 'medium', 'a blank word is left out of the sentence');
  const bl = staffed(32, 1);
  ok(F.setLine(bl, 0, 0, ['only', '_', 'planks', 'none']) && F.setLine(bl, 0, 1, ['_', 'large', '_', 'none']) && !F.setLine(bl, 0, 2, ['_', '_', '_', 'none']) && !F.setLine(bl, 0, 2, ['only', 'any', 'logs', '_']), 'a line with blanks is kept; an all-blank line, or a blank where the ending goes, is not');
  ok(F.mind(bl.robots[0]).nonsense === 1 && F.mind(bl.robots[0]).slip === C.slip + C.nonsense, 'the line that means nothing makes the robot slip 5% more, as any nonsense does');
  const blb = F.load(F.save(bl));
  ok(blb && JSON.stringify(blb.robots[0].lines) === JSON.stringify(bl.robots[0].lines), 'and a save keeps the blanks');
}

/* ---------- 8. order matters ---------- */
{
  const V = (lines, item) => F.verdict(lines.map(F.parse), item);
  const rec = ['recycle', 'any', 'slogs', 'none'], only = ['only', 'medium', 'logs', 'none'];
  ok(V([rec, only], 'sappy.m') === 'recycle' && V([only, rec], 'sappy.m') === 'take', 'a medium sap log: recycled under "Recycle sap logs" then "Only take medium logs", taken (and jams the planer) the other way round');
  ok(V([rec, only], 'log.s') === 'skip' && V([only], 'log.m') === 'take' && V([], 'plank.l') === 'take', '"Only take" leaves everything it does not name; with no lines it takes anything');
  ok(V([['never', 'any', 'glogs', 'none'], only], 'gnarled.m') === 'skip' && V([only, ['never', 'any', 'glogs', 'none']], 'gnarled.m') === 'take', '"Never take" under an "Only take" never gets a say');
  ok(V([['only', 'any', 'things', 'none'], rec], 'sappy.s') === 'take', '"Only take any things" decides every thing: nothing under it is read');
  ok(V([['recycle', 'small', 'things', 'none']], 'plank.s') === 'recycle' && V([['recycle', 'small', 'things', 'none']], 'sap') === 'take', 'a size on "things" matches any thing of that size (sap has none)');
}

/* ---------- 9. slips: one die a trip, and nonsense makes more of them ---------- */
{
  ok(F.mind({ lines: [] }).slip === 0 && F.mind({ lines: [['wait', '5', 'seconds', 'none']] }).slip === C.slip, 'a robot with no lines never slips; with lines, ' + Math.round(C.slip * 100) + '% of trips');
  const nn = ['wait', 'medium', 'planks', 'atime'];
  ok(Math.abs(F.mind({ lines: [nn, nn, ['wait', '5', 'seconds', 'none']] }).slip - (C.slip + 2 * C.nonsense)) < 1e-9, 'each line that means nothing adds ' + Math.round(C.nonsense * 100) + '% (the CD)');
  ok(F.mind({ lines: Array(C.lines).fill(nn) }).slip <= C.slipMax, 'never more than ' + Math.round(C.slipMax * 100) + '%');
  // no lines: no die. The slip queue is left as it was
  const s = staffed(41, 1); s.force.slip = [true];
  F.setPrompt(s, 0, 'raw', 'planerIn'); until(s, x => take(x, 'moved').length >= 2, 120);
  ok(s.force.slip.length === 1 && !s.robots[0].record.slipped, 'a robot with no lines rolls no slip die at all');
  // a slip: every line ignored for one trip, however many reaches it takes
  const t = staffed(42, 1); t.raw = ['sappy.m', 'sappy.m', 'sappy.m', 'log.m', 'log.m', 'log.m'];
  F.setPrompt(t, 0, 'raw', 'planerIn'); F.setLine(t, 0, 0, ['recycle', 'any', 'slogs', 'none']); F.setLine(t, 0, 1, ['carry', '3', 'things', 'atime']);
  t.force.slip = [true, false]; t.force.reach = [0, 0, 0];
  until(t, x => take(x, 'moved').length >= 1, 60);
  const mv = take(t, 'moved')[0], r = t.robots[0];
  ok(mv && mv.items.length === 1 && mv.items[0] === 'sappy.m', 'on a slip it ignores "Recycle sap logs" and "Carry 3": one sap log, into the hopper', JSON.stringify(mv));
  ok(r.record.slipped === 1 && r.record['feedjam:sappy.m@planerIn!'] === 1 && t.force.slip.length === 1, 'its evals show the slip and the jam it fed in against its lines (red); one die for the trip');
  until(t, x => take(x, 'recycled').length >= 1, 60);
  ok(take(t, 'recycled')[0] && take(t, 'recycled')[0].item === 'sappy.m' && t.force.slip.length === 0, 'the next trip follows its lines: the next sap log goes to the recycle bin');
  const u = staffed(43, 1); u.raw = many('log.m', 12);
  F.setPrompt(u, 0, 'raw', 'planerIn'); F.setLine(u, 0, 0, ['carry', '4', 'things', 'atime']);
  u.force.slip = many(false, 10);
  until(u, x => take(x, 'moved').length >= 2, 120);
  ok(take(u, 'moved').length === 2 && take(u, 'moved').every(e => e.items.length === 4) && u.force.slip.length === 8, 'four reaches a trip, one slip die a trip (a chance per job, not per try)', 10 - u.force.slip.length + ' dice for two trips');
}

/* ---------- 10. what the lines do ---------- */
{
  // Carry: more a trip, a little slower
  const a = staffed(51, 1); a.raw = many('log.m', 20);
  F.setPrompt(a, 0, 'raw', 'planerIn'); F.setLine(a, 0, 0, ['carry', '5', 'things', 'atime']);
  until(a, x => x.robots[0].carry.length === 5, 30);
  const p0 = { x: a.robots[0].x, y: a.robots[0].y }; run(a, 1);
  const sp5 = dist(a.robots[0], p0);
  ok(a.robots[0].carry.length === 5 && Math.abs(sp5 - C.robotSpeed / (1 + C.carrySlow * 4)) < 0.05, 'Carry 5: five on a trip, walking ' + Math.round(100 / (1 + C.carrySlow * 4)) + '% as fast', sp5.toFixed(3));
  // Never take: leaves it, and looks again
  const b = staffed(52, 1); b.raw = ['gnarled.m', 'log.m'];
  F.setPrompt(b, 0, 'raw', 'planerIn'); F.setLine(b, 0, 0, ['never', 'any', 'glogs', 'none']);
  b.force.reach = [0, 1];
  until(b, x => take(x, 'moved').length >= 1, 60);
  ok(take(b, 'looking').length === 1 && take(b, 'moved')[0].items.join() === 'log.m' && b.raw.join() === 'gnarled.m' && b.robots[0].record['skipped:gnarled.m'] === 1, '"Never take gnarled logs": it leaves the gnarled log in the bin (yellow) and takes the next');
  until(b, x => x.robots[0].state === 'look', 20);
  run(b, 20);
  ok(b.raw.join() === 'gnarled.m' && b.truck.phase === 'parked', 'and a bin left holding only what it will not take never empties, so the truck never comes');
  // Recycle: to the recycle bin, not the destination
  const c = staffed(53, 1); c.raw = ['sappy.l'];
  F.setPrompt(c, 0, 'raw', 'planerIn'); F.setLine(c, 0, 0, ['recycle', 'any', 'slogs', 'none']);
  until(c, x => x.recycle.length === 1, 60);
  ok(c.recycle.join() === 'sappy.l' && c.planer.in.indexOf('sappy.l') < 0 && c.robots[0].record['recycle:sappy.l'] === 1, '"Recycle sap logs": carried to the recycle bin (green)');
  // Stop at: waits at its source while the destination holds n
  const d = staffed(54, 1); d.planer.in = []; d.raw = many('log.m', 10); d.planer.phase = 'jam'; d.planer.item = 'plank.m'; d.planer.dirt = 1;
  F.setPrompt(d, 0, 'raw', 'planerIn'); F.setLine(d, 0, 0, ['stop', '2', 'things', 'dest']);
  run(d, 90);
  ok(d.planer.in.length === 2 && d.robots[0].waiting === 'full' && d.robots[0].state === 'reach', '"Stop at 2 things in the destination": two in the (jammed) planer\'s hopper, and it waits at its source');
  const e = staffed(55, 1); e.planer.in = []; e.raw = many('log.m', 10); e.planer.phase = 'jam'; e.planer.item = 'plank.m'; e.planer.dirt = 1;
  F.setPrompt(e, 0, 'raw', 'planerIn'); F.setLine(e, 0, 0, ['stop', '1', 'planks', 'dest']);
  run(e, 60);
  ok(e.planer.in.length >= 2, '"Stop at 1 planks" counts only planks at the destination: logs pile up in the (jammed) hopper', e.planer.in.length);
  // Wait: rests after every trip
  const f = staffed(56, 1); f.raw = many('log.m', 10);
  F.setPrompt(f, 0, 'raw', 'planerIn'); F.setLine(f, 0, 0, ['wait', '10', 'seconds', 'trips']);
  f.force.slip = many(false, 10);
  until(f, x => x.robots[0].state === 'pause', 60);
  const t0 = f.t; until(f, x => x.robots[0].state !== 'pause', 20);
  ok(Math.abs(f.t - t0 - 10) < 0.2 && f.robots[0].record.waited === 1 && take(f, 'paused').length === 1, '"Wait 10 seconds between trips": a 10 s rest after the trip', (f.t - t0).toFixed(2));
}

/* ---------- 11. destinations: a stall, the saw, the bench ---------- */
{
  const s = staffed(61, 1); s.planer.in = []; s.planer.out = ['plank.m', 'plank.s', 'plank.m', 'plank.m', 'plank.m', 'plank.m', 'plank.m', 'plank.m'];
  F.setPrompt(s, 0, 'bin', 'stall0'); F.setLine(s, 0, 0, ['carry', '4', 'things', 'atime']);
  s.force.reach = [0, 0, 0, 0, 0, 0, 0, 0]; s.force.slip = many(false, 5);
  until(s, x => x.stalls[0].stock.length === C.stallCap, 90);
  const st = s.stalls[0];
  ok(st.stock.length === C.stallCap && s.robots[0].record['stock:plank.m'] >= 5 && s.robots[0].record['misstock:plank.s@plank.m'] === 1, 'to a stall: as many as there is room for; the stall\'s own thing is green, anything else red');
  run(s, 5);
  ok(st.stock.length === C.stallCap && s.robots[0].carry.length > 0 && s.robots[0].waiting === 'full', 'a full stall: it waits there with the rest in its claws');
  s.shop.next = s.t; until(s, x => x.shop.served >= 1, 60);
  ok(s.shop.served >= 1, 'and customers buy what it stocked');
  const w = staffed(62, 1, open3); w.planer.in = []; w.planer.out = ['plank.l', 'log.m'];
  F.setPrompt(w, 0, 'bin', 'saw'); F.setCut(w, 0, 'b2x2'); w.force.reach = [0, 0];
  until(w, x => x.saw.out.length >= 1, 60);
  ok(w.saw.out.join() === 'b2x2.l' && w.robots[0].record['sawn:plank.l'] === 1 && w.costs.runs >= C.runCost, 'to the table saw: it runs each plank through with the cut on its page');
  until(w, x => x.saw.phase === 'jam', 60);
  ok(w.saw.phase === 'jam' && w.robots[0].record['jam:log.m'] === 1, 'and a log through the saw jams it (red)');
  run(w, 5);
  ok(w.robots[0].state === 'feed' && w.robots[0].mood === 'stuck', 'a robot at a jammed saw waits, stuck, until you scrub it');
  const b = staffed(63, 1, open3); b.planer.in = []; b.planer.out = ['rough.m', 'plank.m'];
  F.setPrompt(b, 0, 'bin', 'bench'); b.force.reach = [0, 0];
  until(b, x => x.bench.out.length >= 1, 60);
  ok(b.bench.out.length === 1 && /^carving\./.test(b.bench.out[0]) && b.robots[0].record['carved:' + b.bench.out[0]] === 1, 'to the bench: it carves a gnarled plank into something');
  until(b, x => x.bench.phase === 'jam', 60);
  ok(b.bench.phase === 'jam', 'and the chisel breaks on a plank that is not gnarled');
  const h = staffed(64, 1); h.planer.in = []; h.raw = ['plank.m', 'sappy.s', 'log.m'];
  F.setPrompt(h, 0, 'raw', 'planerIn'); F.setLine(h, 0, 0, ['carry', '3', 'things', 'atime']); h.force.reach = [0, 0, 0]; h.force.slip = [false];
  until(h, x => take(x, 'moved').length >= 1, 60);
  const rec = h.robots[0].record;
  ok(rec['feedjam:plank.m@planerIn'] === 1 && rec['feedjam:sappy.s@planerIn'] === 1 && rec['fed:log.m@planerIn'] === 1, 'into the planer\'s hopper, the evals say what each thing will do there: a plank or a sap log red, a log green');
}

/* ---------- 12. the goals, as in the first factory ---------- */
{
  const s = shut(F.newGame(71)); s.planer.in = [];
  s.goalN = C.goals[0].n - 1; s.stalls[0].stock = [{ item: 'plank.m', by: 'player' }];
  s.shop.next = s.t; until(s, x => x.goal === 1, 60);
  ok(s.goal === 1 && F.unlocked(s, 'extract') && take(s, 'goal').length === 1, 'the fiftieth medium plank sold brings the sap extractor (slot 02)');
  ok(F.setPrompt((s.money = 2, F.buyRobot(s), until(s, x => x.robots[0].where === 'floor', 10), s), 0, 'raw', 'extractIn'), 'and its hopper is then a destination');
  // goal 4 (the CD, 2026-10-27): "sell all 4 items (sap, small, med, large planks) at same time in
  // open stalls for 10 minutes while maintaining >90% customer satisfaction. No reward (yet)"
  const g4 = C.goals[3];
  ok(C.goals.length === 4 && g4.sells.slice().sort().join() === 'plank.l,plank.m,plank.s,sap' && g4.sat === 90 && g4.sec === 600 && !g4.unlocks && g4.money === undefined, 'a fourth goal: sap and small, medium and large planks on sale at once, over 90%, for 10 minutes, unlocking nothing');
  const q = shut(F.newGame(72)); q.goal = 3; q.goalT = g4.sec;
  const sellAll = x => x.stalls.forEach((st, i) => { st.bought = true; st.closed = false; st.want = ['sap', 'plank.s', 'plank.m', 'plank.l'][i]; });
  sellAll(q); run(q, 60);
  ok(q.goal === 3 && F.goalNow(q).counting && Math.abs(q.goalT - (g4.sec - 60)) < 0.2 && F.goalNow(q).missing.length === 0, 'with all four on sale and customers happy, its countdown runs', q.goalT.toFixed(1));
  q.stalls[2].closed = true; F.step(q, 0.05);
  ok(q.goalT === g4.sec && F.goalNow(q).missing.join() === 'plank.m', 'a stall closed starts it over (and the goal says what is missing)');
  sellAll(q); q.stalls[1].want = 'plank.m'; run(q, 5);
  ok(q.goalT === g4.sec, 'so does a stall set to something else, leaving one of the four off sale');
  sellAll(q); run(q, 5); q.satisfaction = 90; F.step(q, 0.05);
  ok(q.goalT === g4.sec, 'and customer satisfaction at 90% or less');
  sellAll(q); q.satisfaction = 100; q.money = -500; run(q, 5);
  ok(q.goalT < g4.sec, 'money does not come into it');
  run(q, g4.sec);
  ok(q.goal === 4 && F.goalNow(q).done && take(q, 'goal').some(e => e.id === 'all4' && !e.unlocks), 'held for 10 minutes, it is met; every goal is then met');
  ok(F.unlocked(q, 'extract') && F.unlocked(q, 'carve') && F.unlocked(q, 'saw'), 'and it unlocks nothing new: slots 02-04 are the first three goals\' rewards');
  // goal 3 met in play: goal 4 comes up with its whole 10 minutes, not met at once
  const g3 = shut(F.newGame(74)); g3.goal = 2; g3.goalN = C.goals[2].n; sellAll(g3); F.step(g3, 0.05);
  ok(g3.goal === 3 && g3.goalT > g4.sec - 0.2, 'goal 3 met: goal 4 comes up with its whole 10 minutes to run', g3.goal + ' ' + g3.goalT);
  const old = JSON.parse(F.save(shut(F.newGame(73)))); old.goal = 3; old.goalT = 600;
  const ob = F.load(JSON.stringify(old));
  ok(ob && ob.goal === 3 && F.goalNow(ob).goal.id === 'all4' && ob.goalT === g4.sec, 'a save from before it, with the three goals met, comes back working on the fourth');
}

/* ---------- 13. you: bubbles at the bins, the terminal, a robot ---------- */
{
  const s = shut(F.newGame(81)); s.money = 5;
  F.tap(s, { kind: 'raw' }); until(s, x => F.bubbleOpen(x), 30);
  const o = F.options(s);
  ok(F.bubbleOpen(s).kind === 'raw' && o.some(x => x.id.indexOf('take:') === 0), 'the raw materials bin has a put / take bubble');
  const n = s.raw.length; o.filter(x => x.group === 'take').forEach(x => F.choose(s, x.id));
  ok(s.raw.length === 0 && s.avatar.inv.length === n, 'and everything in it can come out into your arms');
  F.tap(s, { kind: 'planerIn' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'planerIn', 40);
  F.options(s).filter(x => x.group === 'put').forEach(x => F.choose(s, x.id));
  ok(s.avatar.inv.length === 0 && s.planer.in.length >= n - 1, 'and go into the planer\'s hopper');
  F.tap(s, { kind: 'terminal' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'terminal', 40);
  ok(F.options(s).map(x => x.id).join() === 'buy,configs', 'at the terminal: buy a robot, or open the configurations');
  s.money = 20; F.choose(s, 'buy'); until(s, x => x.robots[0].where === 'floor', 10);
  ok(F.options(s).some(x => x.id === 'down:0'), 'then send it down');
  F.choose(s, 'down:0'); until(s, x => x.robots[0].where === 'storage', 30);
  ok(F.options(s).some(x => x.id === 'up:0') && F.options(s).some(x => x.id === 'buy'), 'or call it back up, or buy another');
  ok(F.choose(s, 'configs') && take(s, 'configs').length === 1 && !s.bubble, 'the configurations close the bubble for their page');
  F.tap(s, { kind: 'terminal' }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'terminal', 40);
  F.choose(s, 'up:0'); until(s, x => x.robots[0].where === 'floor', 10);
  F.tap(s, { kind: 'robot', id: 0 }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'robot', 30);
  ok(F.options(s).map(x => x.id).join() === 'notes,down', 'a robot\'s bubble: its page, or down to storage');
  const j = shut(F.newGame(82)); j.planer.in = ['plank.s']; run(j, C.jamAt + 0.2);
  F.tap(j, { kind: 'machine' }); until(j, x => x.planer.phase !== 'jam', 30);
  ok(j.planer.phase !== 'jam' && j.tally.player.fixed === 1, 'at the planer you only ever scrub a jam');
  const k = shut(F.newGame(83)); F.tap(k, { kind: 'machine' }); until(k, x => x.avatar.task && x.avatar.task.arrived, 30);
  ok(!k.avatar.act && !F.bubbleOpen(k), 'and at a planer that is running fine, nothing');
  // the recycle bin's contents can be destroyed (the CD, 2026-10-27)
  const d = shut(F.newGame(84)); d.recycle = ['log.m', 'plank.s', 'plank.s', 'sap'];
  F.tap(d, { kind: 'recycle' }); until(d, x => F.bubbleOpen(x), 30);
  const des = F.options(d).find(x => x.id === 'destroy');
  ok(des && des.enabled && des.count === 4 && F.options(d).filter(x => x.group === 'take').length === 3, 'the recycle bin\'s bubble can destroy everything in it (4 things), beside taking them out');
  ok(F.choose(d, 'destroy') && d.recycle.length === 0 && take(d, 'destroyed').length === 1 && take(d, 'destroyed')[0].n === 4 && d.avatar.inv.length === 0 && d.money === 0, 'destroyed: gone, not into your arms, and free');
  ok(!F.options(d).find(x => x.id === 'destroy').enabled && !F.choose(d, 'destroy'), 'an empty recycle bin has nothing to destroy');
  F.tap(d, { kind: 'raw' }); until(d, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'raw', 40);
  ok(!F.options(d).some(x => x.id === 'destroy'), 'and no other bin can destroy');
}

/* ---------- 14. saving ---------- */
{
  const s = staffed(91, 3, open3);
  F.setPrompt(s, 0, 'raw', 'planerIn'); F.setLine(s, 0, 0, ['recycle', 'any', 'slogs', 'none']); F.setLine(s, 0, 1, ['wait', '2', 'seconds', 'trips']);
  F.setPrompt(s, 1, 'bin', 'stall0'); F.setCut(s, 2, 'dowels'); F.sendDown(s, 2);
  run(s, 25);
  const back = F.load(F.save(s));
  ok(back && back.robots.length === 3 && back.robots[0].lines.length === 2 && back.robots[1].dst === 'stall0' && back.robots[2].cut === 'dowels', 'a save keeps every robot, its prompt, its lines and its cut');
  run(s, 30); run(back, 30);
  ok(strip(back) === strip(s), 'and both carry on identically');
  const o = JSON.parse(F.save(s));
  o.robots[0].lines.push(['bogus', 'x', 'y', 'z']); o.robots[1].src = 'saw'; o.robots[2].where = 'down'; o.truck.phase = 'nowhere'; o.raw.push('nonsense');
  const b2 = F.load(JSON.stringify(o));
  ok(b2 && b2.robots[0].lines.length === 2 && b2.robots[1].src === null && b2.robots[2].where === 'storage' && b2.truck.phase === 'parked' && b2.raw.every(F.isItem), 'a bad save is cleaned: no bad line, no machine as a source, a ride down finished, the truck parked, no unknown thing');
  ok(F.load('{"version":0}') === null && F.load('nope') === null, 'and one from another version, or not a save, is refused');
}

/* ---------- 15. measured: good sets of lines reach the first goal, and the fourth ---------- */
// robots hired and told their lines, then played with a player who scrubs any jam ten seconds after
// it happens; returns when goal 1 and goal 4 were met (minutes), satisfaction on average, money
function played(seed, setup, prep, mins) {
  const s = F.newGame(seed);
  if (prep) prep(s);
  s.money = setup.length * s.flat.robot;
  setup.forEach(([src, dst, lines]) => { const r = F.buyRobot(s); F.setPrompt(s, r.id, src, dst); lines.forEach((l, k) => F.setLine(s, r.id, k, l)); });
  let t1 = null, t4 = null, sat = 0, n = 0;
  const jam = {};
  for (let k = 0; k < mins * 60 * 20; k++) {
    F.step(s, 0.05);
    F.MACHINES.forEach(key => {
      jam[key] = F.jammed(s, key) ? (jam[key] || 0) + 0.05 : 0;
      if (jam[key] > 10 && !s.avatar.act) { s[key].dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0, on: key }; jam[key] = 0; }
    });
    if (t1 === null && s.goal >= 1) t1 = s.t / 60;
    if (t4 === null && s.goal >= 4) t4 = s.t / 60;
    sat += s.satisfaction; n++;
    s.events.length = 0;
  }
  return { t1, t4, sat: sat / n, money: s.money };
}
const say = (r, t) => (r[t] === null ? 'never' : r[t].toFixed(1)) + ' min ' + Math.round(r.sat) + '% $' + Math.round(r.money);
{
  // the 2026-10-26 path (two haulers, one medium plank stall whose stocker recycles every other
  // plank) with the truck's sizes uniform (the CD, 2026-10-27): it still meets goal 1, but two planks
  // in three are recycled and the stall cannot be kept stocked
  const A = [['recycle', 'any', 'slogs', 'none'], ['carry', '6', 'things', 'atime'], ['stop', '4', 'things', 'dest']];
  const B = [['recycle', 'any', 'gplanks', 'none'], ['recycle', 'small', 'planks', 'none'], ['recycle', 'large', 'planks', 'none'], ['carry', '3', 'things', 'atime']];
  const old = [1, 2, 3].map(seed => played(seed, [['raw', 'planerIn', A], ['raw', 'planerIn', A], ['bin', 'stall0', B]], null, 30));
  ok(old.every(r => r.t1 !== null && r.sat < 50), 'one medium plank stall that recycles the other sizes meets goal 1 but leaves customers waiting', old.map(r => say(r, 't1')).join(' / '));
  // the valid path now: a stall for each size of plank ($1 each), two haulers and a stocker per stall
  const C3 = ['carry', '3', 'things', 'atime'];
  const three = [['raw', 'planerIn', A], ['raw', 'planerIn', A],
    ['bin', 'stall0', [['recycle', 'any', 'gplanks', 'none'], ['only', 'medium', 'planks', 'none'], C3]],
    ['bin', 'stall1', [['only', 'small', 'planks', 'none'], C3]], ['bin', 'stall2', [['only', 'large', 'planks', 'none'], C3]]];
  const stalls3 = s => { [1, 2].forEach(i => { s.stalls[i].bought = true; s.stalls[i].want = i === 1 ? 'plank.s' : 'plank.l'; }); };
  const res = [1, 2, 3].map(seed => played(seed, three, stalls3, 40));
  ok(res.every(r => r.t1 !== null && r.t1 < 40), 'three plank stalls, two haulers and three stockers meet the first goal inside 40 minutes on three seeds', res.map(r => say(r, 't1')).join(' / '));
  ok(res.every(r => r.sat > 80 && r.money > 0), 'with customer satisfaction over 80% on average and money in hand', res.map(r => Math.round(r.sat) + '% $' + Math.round(r.money)).join(' / '));
  const one = (() => { const s = F.newGame(1); s.money = 1; const r = F.buyRobot(s); F.setPrompt(s, r.id, 'raw', 'planerIn'); run(s, 600, 0.05); return s; })();
  ok(one.satisfaction < 50, 'one robot hauling logs with nobody stocking the stall leaves customers waiting (satisfaction ' + Math.round(one.satisfaction) + '%)');
  // the CD's layout (2026-10-27): three robots out of the raw materials bin (normal logs to the
  // planer, sap logs to the extractor, gnarled logs to the bench), one from the extractor's output
  // to the planer, a stocker for each of four stalls; the lines are guessed (assumed)
  const W = ['wait', '10', 'seconds', 'trips'], C6 = ['carry', '6', 'things', 'atime'], S4 = ['stop', '4', 'things', 'dest'];
  const cd = [['raw', 'planerIn', [['only', 'any', 'nlogs', 'none'], C6, S4, W]], ['raw', 'extractIn', [['only', 'any', 'slogs', 'none'], C6, S4, W]],
    ['raw', 'bench', [['only', 'any', 'glogs', 'none'], C6, W]], ['extractOut', 'planerIn', [['only', 'any', 'logs', 'none'], C3]],
    ['bin', 'stall0', [['only', 'medium', 'planks', 'none'], C3]], ['bin', 'stall1', [['only', 'small', 'planks', 'none'], C3]],
    ['bin', 'stall2', [['only', 'large', 'planks', 'none'], C3]], ['extractOut', 'stall3', [['only', 'any', 'sap', 'none'], C3]]];
  const all3 = s => { s.goal = 3; s.goalT = C.goals[3].sec; s.stalls.forEach((st, i) => { st.bought = true; st.want = ['plank.m', 'plank.s', 'plank.l', 'sap'][i]; }); };
  const four = [1, 2, 4].map(seed => played(seed, cd, all3, 60));
  ok(four.every(r => r.t4 !== null), 'the CD\'s eight robots meet goal 4 (all four things on sale, over 90%, for 10 minutes) inside an hour on three seeds', four.map(r => say(r, 't4')).join(' / '));
}

/* ---------- 16. configurations: the robots on the floor, saved and loaded at the terminal ---------- */
// (the CD, 2026-10-27: "save/load/delete a configuration for the current set of active robots,
// their names, their prompts and instructions"; delete and its "I am sure" are the page's)
{
  const s = staffed(101, 3, open3);
  F.rename(s, 0, 'Hauler'); F.setPrompt(s, 0, 'raw', 'planerIn'); F.setLine(s, 0, 0, ['recycle', 'any', 'slogs', 'none']); F.setLine(s, 0, 1, ['wait', '10', 'seconds', 'trips']);
  F.rename(s, 1, 'Seller'); F.setPrompt(s, 1, 'bin', 'stall0'); F.setLine(s, 1, 0, ['only', '_', 'planks', 'none']);
  F.setPrompt(s, 2, 'bin', 'saw'); F.setCut(s, 2, 'dowels');
  const all = F.snapshot(s, '  Morning   shift ');
  ok(all && all.name === 'Morning shift' && all.robots.length === 3 && all.robots[0].name === 'Hauler' && all.robots[0].src === 'raw' && all.robots[0].lines.length === 2 && all.robots[1].lines[0][1] === '_' && all.robots[2].cut === 'dowels',
    'a configuration keeps every robot on the floor: its name, its main prompt, its lines (blanks too) and its cut');
  F.sendDown(s, 2);
  const two = F.snapshot(s, 'Two');
  ok(two.robots.length === 2 && two.robots.every(r => r.name !== 'Widget'), 'a robot on its way down to storage is not on the floor, so not in it');
  ok(JSON.stringify(F.cleanConfig(JSON.parse(JSON.stringify(two)))) === JSON.stringify(two), 'and it comes back from JSON unchanged');
  ok(F.snapshot(F.newGame(1), 'Empty') === null, 'with no robots there is nothing to save');
  const bad = F.cleanConfig({ name: 'x', robots: [{ name: '', src: 'saw', dst: 'bin', lines: [['bogus', 'a', 'b', 'c'], ['wait', '5', 'seconds', 'none']], cut: 'nope' }, null, 5] });
  ok(bad && bad.robots.length === 1 && bad.robots[0].name === C.names[0] && bad.robots[0].src === null && bad.robots[0].lines.length === 1 && bad.robots[0].cut === F.CUTS[0], 'a bad one is cleaned: a name, no machine as a source, no bad line, a cut');
  ok(F.cleanConfig({ name: '', robots: [{ name: 'a' }] }) === null && F.cleanConfig({ name: 'n', robots: [] }) === null && F.cleanConfig('nope') === null, 'one with no name or no robots is not a configuration');

  // loaded into a new game: robots are bought for it, at the flat price, and ride up
  const n = shut(F.newGame(102)); n.goal = C.goals.length;
  const need = F.configNeeds(n, all);
  ok(need.buy === 3 && need.price === 3 * n.flat.robot && !need.ok && !F.loadConfig(n, all) && n.robots.length === 0, 'into a new game it needs 3 robots, $' + 3 * n.flat.robot + ': with no money it does not load, and nothing changes');
  n.money = 3 * n.flat.robot;
  ok(F.configNeeds(n, all).ok && F.loadConfig(n, all) && n.robots.length === 3 && n.money === 0 && n.robots.every(r => r.where === 'queued' || r.where === 'up'), 'with the money it buys them, and they wait for the elevator');
  until(n, x => x.robots.every(r => r.where === 'floor'), 30);
  ok(n.robots.map(r => r.name).join() === 'Hauler,Seller,Widget' && n.robots[0].src === 'raw' && n.robots[0].dst === 'planerIn' && (n.robots[1].lines[0] || []).join() === 'only,_,planks,none' && n.robots[2].dst === 'saw' && n.robots[2].cut === 'dowels', 'up on the floor, each has its name, prompt, lines and cut');
  ok(take(n, 'configLoaded').length === 1 && take(n, 'configLoaded')[0].bought === 3, 'and the load is told');
  // a prompt to a place not open in this game is dropped, the rest of the robot kept
  const lk = shut(F.newGame(103)); lk.money = 5;
  const nl = F.configNeeds(lk, all);
  ok(nl.dropped === 1 && F.loadConfig(lk, all) && lk.robots[2].src === null && lk.robots[2].cut === 'dowels' && lk.robots[0].src === 'raw' && take(lk, 'configLoaded')[0].dropped === 1, 'a prompt to the table saw, before its slot is open, is dropped; the rest loads');

  // loaded over robots already working: the same names take their parts, the rest go down
  const w = staffed(104, 4, open3);
  ['Seller', 'Hauler', 'Spare', 'Other'].forEach((nm, i) => F.rename(w, i, nm));
  F.setPrompt(w, 0, 'raw', 'stall0'); F.setLine(w, 0, 0, ['wait', '1', 'seconds', 'none']);
  F.setPrompt(w, 2, 'raw', 'planerIn'); F.setPrompt(w, 3, 'raw', 'planerIn');
  until(w, x => x.robots[2].carry.length > 0, 30);
  const m0 = w.money;
  ok(F.configNeeds(w, two).buy === 0 && F.loadConfig(w, two) && w.money === m0, 'over four robots, a configuration of two buys nothing');
  ok(w.robots[0].name === 'Seller' && w.robots[0].src === 'bin' && w.robots[0].dst === 'stall0' && w.robots[0].lines.length === 1 && (w.robots[0].lines[0] || [])[0] === 'only', 'the robot named Seller takes the Seller\'s part: its prompt and lines replaced');
  ok(w.robots[1].name === 'Hauler' && w.robots[1].src === 'raw' && w.robots[1].lines.length === 2, 'and Hauler the Hauler\'s');
  ok(w.robots[2].toLift && w.robots[3].toLift && w.robots[2].carry.length === 0, 'the two left over go down to storage, putting back what they carried');
  until(w, x => x.robots[2].where === 'storage' && x.robots[3].where === 'storage', 40);
  ok(w.robots[2].src === 'raw' && w.robots[2].where === 'storage', 'keeping their own prompts in storage');
  // and a robot in storage is called up before one is bought; one on its way down turns round
  const t = staffed(105, 3, open3);
  F.rename(t, 0, 'Hauler'); F.rename(t, 1, 'Seller'); F.rename(t, 2, 'Third');
  F.sendDown(t, 1); until(t, x => x.robots[1].where === 'storage', 40);
  F.sendDown(t, 0); until(t, x => x.robots[0].where === 'down', 40);
  const lt = t.lift.t, m1 = t.money;
  ok(F.loadConfig(t, two) && t.money === m1 && t.robots[0].where === 'up' && t.lift.dir === 'up' && Math.abs(t.lift.t - (C.elevSec - lt)) < 1e-9, 'Hauler, riding down, rides back up from where it was');
  ok(t.robots[1].where === 'queued' && t.robots[2].toLift, 'Seller is called up from storage; Third, not in it, goes down');
  until(t, x => x.robots[0].where === 'floor' && x.robots[1].where === 'floor' && x.robots[2].where === 'storage', 40);
  ok(t.robots[0].where === 'floor' && t.robots[1].where === 'floor' && t.robots[2].where === 'storage', 'and the floor ends up exactly the configuration');
  // the names in it beat the order of the robots: a configuration whose names match nobody takes robots in order
  const o = staffed(106, 2, open3);
  ok(F.loadConfig(o, two) && o.robots[0].name === 'Hauler' && o.robots[1].name === 'Seller', 'with no names in common it takes the robots on the floor in order, and renames them');
  // a robot on the floor takes a part before one in storage (no ride for nothing)
  const f = staffed(107, 2, open3);
  F.sendDown(f, 0); until(f, x => x.robots[0].where === 'storage', 40);
  ok(F.loadConfig(f, { name: 'One', robots: [{ name: 'Nobody', src: 'raw', dst: 'planerIn', lines: [] }] }) && f.robots[1].name === 'Nobody' && f.robots[1].where === 'floor' && !f.robots[1].toLift && f.robots[0].where === 'storage',
    'a part no robot is named for goes to a robot on the floor before one in storage', JSON.stringify(f.robots.map(r => r.name + ':' + r.where)));
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY2: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
