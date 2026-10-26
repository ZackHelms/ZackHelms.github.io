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
  ok(F.options(s).map(x => x.id).join() === 'buy', 'at the terminal: buy a robot');
  s.money = 20; F.choose(s, 'buy'); until(s, x => x.robots[0].where === 'floor', 10);
  ok(F.options(s).some(x => x.id === 'down:0'), 'then send it down');
  F.choose(s, 'down:0'); until(s, x => x.robots[0].where === 'storage', 30);
  ok(F.options(s).some(x => x.id === 'up:0') && F.options(s).some(x => x.id === 'buy'), 'or call it back up, or buy another');
  F.choose(s, 'up:0'); until(s, x => x.robots[0].where === 'floor', 10);
  F.tap(s, { kind: 'robot', id: 0 }); until(s, x => F.bubbleOpen(x) && F.bubbleOpen(x).kind === 'robot', 30);
  ok(F.options(s).map(x => x.id).join() === 'notes,down', 'a robot\'s bubble: its page, or down to storage');
  const j = shut(F.newGame(82)); j.planer.in = ['plank.s']; run(j, C.jamAt + 0.2);
  F.tap(j, { kind: 'machine' }); until(j, x => x.planer.phase !== 'jam', 30);
  ok(j.planer.phase !== 'jam' && j.tally.player.fixed === 1, 'at the planer you only ever scrub a jam');
  const k = shut(F.newGame(83)); F.tap(k, { kind: 'machine' }); until(k, x => x.avatar.task && x.avatar.task.arrived, 30);
  ok(!k.avatar.act && !F.bubbleOpen(k), 'and at a planer that is running fine, nothing');
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

/* ---------- 15. measured: a good set of lines reaches the first goal ---------- */
{
  // two robots hauling logs and one stocking the stall, with a player who scrubs any jam ten
  // seconds after it happens; three seeds, half an hour each (2026-10-26)
  const A = [['recycle', 'any', 'slogs', 'none'], ['carry', '6', 'things', 'atime'], ['stop', '4', 'things', 'dest']];
  const B = [['recycle', 'any', 'gplanks', 'none'], ['recycle', 'small', 'planks', 'none'], ['recycle', 'large', 'planks', 'none'], ['carry', '3', 'things', 'atime']];
  const res = [1, 2, 3].map(seed => {
    const s = F.newGame(seed); s.money = 3;
    [['raw', 'planerIn', A], ['raw', 'planerIn', A], ['bin', 'stall0', B]].forEach(([src, dst, lines]) => { const r = F.buyRobot(s); F.setPrompt(s, r.id, src, dst); lines.forEach((l, k) => F.setLine(s, r.id, k, l)); });
    let t1 = null, sat = 0, n = 0, jam = 0;
    for (let k = 0; k < 30 * 60 * 20; k++) {
      F.step(s, 0.05);
      jam = F.jammed(s, 'planer') ? jam + 0.05 : 0;
      if (jam > 10) { s.planer.dirt = 0.001; s.avatar.act = { kind: 'clean', t: 0, on: 'planer' }; jam = 0; }
      if (t1 === null && s.goal >= 1) t1 = s.t / 60;
      sat += s.satisfaction; n++;
      s.events.length = 0;
    }
    return { t1, sat: sat / n, money: s.money };
  });
  ok(res.every(r => r.t1 !== null && r.t1 < 20), 'three robots with good lines meet the first goal inside 20 minutes on three seeds', res.map(r => r.t1 && r.t1.toFixed(1)).join(' / '));
  ok(res.every(r => r.sat > 80 && r.money > 0), 'with customer satisfaction over 80% on average and money in hand', res.map(r => Math.round(r.sat) + '% $' + Math.round(r.money)).join(' / '));
  const one = (() => { const s = F.newGame(1); s.money = 1; const r = F.buyRobot(s); F.setPrompt(s, r.id, 'raw', 'planerIn'); run(s, 600, 0.05); return s; })();
  ok(one.satisfaction < 50, 'one robot hauling logs with nobody stocking the stall leaves customers waiting (satisfaction ' + Math.round(one.satisfaction) + '%)');
}

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY2: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
process.exit(failed ? 1 : 0);
