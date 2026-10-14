#!/usr/bin/env node
/**
 * eval-taas-factory.cjs — the robot factory's pacing and shape (pure node, opt-in, ~3 s).
 *
 * drive-taas-factory.cjs proves the rules whatever the numbers. This plays personas through
 * the shipped engine, walking and all (every action is a tap the avatar has to walk to, the
 * robot's page included), and prices the milestones in minutes, so a retune can be judged
 * against something:
 *   hands-on       does everything itself until it can hire, then hires, assigns, cleans every
 *                  jam the moment it happens, sells by hand when the seller is idle, and gives
 *                  each robot the instruction for each mistake as soon as the mistake has shown
 *                  it (buying a slot when it needs one)
 *   supervisor     the same, but only steps in to clean a jam, 10 s late, and to instruct
 *   walks away     hires both robots and leaves: nobody cleans
 *   uninstructed   the supervisor, never giving an instruction
 *   crossed        the supervisor, giving each robot the OTHER job's instructions
 *   seller only    the supervisor, instructing the seller and never the operator
 * Every persona that instructs skips "Never put sap on input log", which prevents nothing since
 * the sap barrel went: it knows the floor. Money is counted net of the $1 a log machine01 costs.
 * Then it asserts the shape the mode exists to teach: the first robot comes quickly, robots
 * alone stall on their first jam, instructions pay for themselves, an uninstructed seller wears
 * customer satisfaction down while an instructed one wins it back, an instruction about another
 * job is worth nothing, agents without instructions are not free speed, and a seller told to
 * sell only planks behind an operator told nothing hunts a bin filling up with everything else.
 * Every number is a first-draft guess; change a row only if the CD changes the design it
 * describes.
 *
 * Usage: node .claude/tests/eval-taas-factory.cjs      Final line: TAAS-FACTORY-EVAL: GREEN | RED
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const src = fs.readFileSync(PAGE, 'utf8');
const a = src.indexOf('const FACTORY = (function'), b = src.indexOf("if (typeof module !== 'undefined') module.exports = FACTORY;", a);
const F = new Function(src.slice(a, b) + '\nreturn FACTORY;')();
const C = F.CFG;

let checks = 0, failed = 0;
function ok(cond, name, detail) { checks++; if (cond) console.log('PASS ' + name); else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' (' + detail + ')' : '')); } }

const DECOY = ['sap'];   // prevents nothing since the sap barrel went
const JOB_RULES = { operate: F.RULES.filter(q => q.job === 'operate' && DECOY.indexOf(q.id) < 0).map(q => q.id), sell: F.RULES.filter(q => q.job === 'sell').map(q => q.id) };
const other = job => job === 'operate' ? 'sell' : 'operate';

function persona(kind, minutes, seed) {
  const s = F.newGame(seed || 1), DT = 0.05, END = minutes * 60;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastEarned = 0, perMin = [], page = null;
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = (k, id) => s.avatar.task && s.avatar.task.kind === k && (id === undefined || s.avatar.task.id === id) && (s.avatar.path.length || s.avatar.act);
  const want = (k, id) => { if (!busyWith(k, id)) F.tap(s, id === undefined ? { kind: k } : { kind: k, id }); };
  const instructs = kind === 'hands-on' || kind === 'supervisor' || kind === 'crossed' || kind === 'seller only';
  // what this persona would put on robot r next, if anything: an instruction it has seen, for the
  // job it means to give it, that the robot does not have yet
  const nextFor = r => {
    if (!instructs || !r.job || kind === 'seller only' && r.job !== 'sell') return null;
    const pool = JOB_RULES[kind === 'crossed' ? other(r.job) : r.job];
    return pool.find(id => s.seen[id] && r.rules.indexOf(id) < 0) || null;
  };
  const afford = r => r.rules.indexOf(null) >= 0 || (F.slotPrice(s, r.id) !== null && s.money >= F.slotPrice(s, r.id));
  while (s.t < END) {
    F.step(s, DT);
    s.events.forEach(e => { if (e.kind === 'notes') page = e.id; });
    s.events = [];
    satLow = Math.min(satLow, s.satisfaction);
    if (s.money >= 20) at('$20');
    if (s.hired >= 1) at('robot 1');
    if (s.hired >= 2) at('robot 2');
    if (s.robots.some(r => r.rules.some(Boolean))) at('first rule');
    const op = s.robots.find(r => r.job === 'operate'), se = s.robots.find(r => r.job === 'sell');
    if (op && JOB_RULES.operate.every(id => op.rules.indexOf(id) >= 0)) at('op4');
    if (Math.floor(s.t / 60) > perMin.length) { perMin.push(s.earned - s.spent - lastEarned); lastEarned = s.earned - s.spent; }   // net of the logs
    const m = s.machine, bub = F.bubbleOpen(s);
    if (m.phase === 'jam') { if (jamSeen < 0) jamSeen = s.t; } else jamSeen = -1;
    // a robot's page is open: give it what it needs
    if (page !== null) {
      const r = s.robots[page];
      for (let id = nextFor(r); id && afford(r); id = nextFor(r)) {
        if (r.rules.indexOf(null) < 0) F.buySlot(s, r.id);
        F.setRule(s, r.id, r.rules.indexOf(null), id);
      }
      page = null;
      continue;
    }
    // use whatever bubble is open
    if (bub) {
      if (bub.kind === 'bin') { while (F.options(s).some(o => o.enabled && o.id.indexOf('sell:') === 0)) F.choose(s, F.options(s).find(o => o.enabled).id); s.bubble = null; continue; }
      if (bub.kind === 'dock') { if (F.choose(s, 'hire')) { F.choose(s, s.hired === 1 ? 'job:operate' : 'job:sell'); } s.bubble = null; continue; }
      if (bub.kind === 'robot') { F.choose(s, 'notes'); continue; }
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const late = kind === 'hands-on' ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    const hp = F.hirePrice(s);
    if (hp !== null && s.money >= hp) { want('dock'); continue; }
    if (F.slotsOpen(s)) { const r = s.robots.find(x => nextFor(x) && afford(x)); if (r) { want('robot', r.id); continue; } }
    if (kind !== 'hands-on' && s.hired >= 2) continue;   // supervisors only clean, hire and instruct
    if (!op && F.ready(s)) { want('machine'); continue; }
    if (s.bin.length && (!se || kind === 'hands-on' && se.state === 'idle' && s.bin.length > 2)) { want('bin'); continue; }
  }
  const fmt = k => mark[k] === undefined ? '-' : (mark[k] / 60).toFixed(1) + 'm';
  const last5 = perMin.slice(-5).reduce((x, y) => x + y, 0) / 5;
  return { kind, s, mark, fmt, satLow, perMin, last5 };
}

const DEBUG = process.env.EVAL_DEBUG;
const runs = ['hands-on', 'supervisor', 'walks away', 'uninstructed', 'crossed', 'seller only'].map(k => persona(k, 30, 7));
const sold = r => { const se = r.s.robots.find(x => x.job === 'sell'); return se ? se.tally.good + se.tally.soso + se.tally.bad : 0; };
const looked = r => { const se = r.s.robots.find(x => x.job === 'sell'); return se ? se.record.looking || 0 : 0; };
console.log('persona       $20    robot1  robot2  rule1   op x4   earned  logs  $/min net(last5)  satisfaction(end/min)  seller sold/looking  bin');
runs.forEach(r => console.log(r.kind.padEnd(12) + ['$20', 'robot 1', 'robot 2', 'first rule', 'op4'].map(k => r.fmt(k).padStart(7)).join(' ') + String(r.s.earned).padStart(8) + String(r.s.spent).padStart(6) + r.last5.toFixed(1).padStart(17) + ('  ' + Math.round(r.s.satisfaction) + '/' + Math.round(r.satLow)).padStart(23) + (sold(r) + '/' + looked(r)).padStart(21) + String(r.s.bin.length).padStart(5)));
if (DEBUG) runs.forEach(r => console.log(r.kind, JSON.stringify(r.s.seen), r.s.robots.map(x => x.name + ":" + x.job + ":" + JSON.stringify(x.rules) + JSON.stringify(x.record)).join(" | ")));
const R = Object.fromEntries(runs.map(r => [r.kind, r]));

ok(R['hands-on'].mark['$20'] < 90, 'the first $20 (five planks by hand, less their logs) comes inside a minute and a half', R['hands-on'].fmt('$20'));
ok(R['hands-on'].mark['robot 2'] < 5 * 60, 'both robots are on staff inside five minutes of attentive play', R['hands-on'].fmt('robot 2'));
ok(R['hands-on'].mark['op4'] < 10 * 60, 'attentive play has the operator holding all four of its useful instructions inside 10 minutes', R['hands-on'].fmt('op4'));
const wa = R['walks away'];
ok(wa.last5 < 2 && wa.s.machine.phase === 'jam', 'robots left alone stall: the first sap jam stops the line and nobody fixes it', wa.last5.toFixed(1) + ' $/min, machine ' + wa.s.machine.phase);
ok(R['supervisor'].last5 > 3 * Math.max(1, R['uninstructed'].last5), 'instructions pay: the instructed line earns over 3x the uninstructed one by the end', R['supervisor'].last5.toFixed(1) + ' vs ' + R['uninstructed'].last5.toFixed(1));
ok(R['uninstructed'].s.satisfaction < 70 && R['supervisor'].s.satisfaction > R['uninstructed'].s.satisfaction + 20, 'an uninstructed seller wears customer satisfaction down; an instructed one wins it back', Math.round(R['uninstructed'].s.satisfaction) + ' vs ' + Math.round(R['supervisor'].s.satisfaction));
ok(Math.abs(R['crossed'].last5 - R['uninstructed'].last5) <= Math.max(1.5, 0.25 * R['uninstructed'].last5) && R['crossed'].last5 < R['supervisor'].last5 / 2, 'an instruction about the other robot\'s job is worth nothing: crossed wires earn like no instructions at all', R['crossed'].last5.toFixed(1) + ' vs ' + R['uninstructed'].last5.toFixed(1));
const pre = R['hands-on'].perMin.slice(0, 2).reduce((x, y) => x + y, 0) / 2;
ok(R['uninstructed'].last5 < pre * 1.6, 'uninstructed robots barely beat a person working alone (agents are not free speed)', R['uninstructed'].last5.toFixed(1) + ' vs ' + pre.toFixed(1) + ' $/min by hand');
// the third brief (CD, 2026-10-14): a seller told to sell only planks leaves everything else in the bin
const so = R['seller only'], ho = R['hands-on'];
const junk = r => r.s.bin.filter(k => k !== 'plank').length;
ok(junk(so) >= 30 && looked(so) > 3 * sold(so) && looked(so) / sold(so) > 5 * looked(ho) / sold(ho), 'a seller told to sell only planks, behind an operator told nothing, hunts a bin filling with everything else (over three reaches looking for each sale); behind an instructed operator it looks far less',
  'seller only: ' + junk(so) + ' non-planks in the bin, sold ' + sold(so) + ' / looking ' + looked(so) + '; hands-on: sold ' + sold(ho) + ' / looking ' + looked(ho));
ok(so.s.satisfaction > R['uninstructed'].s.satisfaction + 20 && so.last5 < R['supervisor'].last5, 'it keeps customers happy, and earns less than a line whose operator is instructed too (the junk was paid for and sells for nothing)', so.last5.toFixed(1) + ' vs ' + R['supervisor'].last5.toFixed(1) + ' $/min');

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY-EVAL: ' + (failed ? 'RED' : 'GREEN'));
process.exit(failed ? 1 : 0);
