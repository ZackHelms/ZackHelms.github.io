#!/usr/bin/env node
/**
 * eval-taas-factory.cjs — the robot factory's pacing and shape (pure node, opt-in, ~2 s).
 *
 * drive-taas-factory.cjs proves the rules whatever the numbers. This plays personas through
 * the shipped engine, walking and all (every action is a tap the avatar has to walk to), and
 * prices the milestones in minutes, so a retune can be judged against something:
 *   hands-on     does everything itself until it can hire, then hires, assigns, cleans every
 *                jam the moment it happens, sells by hand when the seller is idle, and buys
 *                prompt engineering as soon as it can
 *   supervisor   the same, but only steps in to clean a jam, 10 s late
 *   walks away   hires both robots and leaves: nobody cleans
 *   no prompt    the supervisor, never buying prompt engineering
 * Then it asserts the shape the mode exists to teach: the first robot comes quickly, robots
 * alone stall on their first jam, prompt engineering pays for itself, and a bad seller erodes
 * customer satisfaction while a prompted one does not. Every number is a first-draft guess; change
 * a row only if the CD changes the design it describes.
 *
 * Usage: node .claude/tests/eval-taas-factory.cjs [--eval]      Final line: TAAS-FACTORY-EVAL: GREEN | RED
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

function persona(kind, minutes, seed) {
  const s = F.newGame(seed || 1), DT = 0.05, END = minutes * 60;
  const mark = {}, at = (k) => { if (mark[k] === undefined) mark[k] = s.t; };
  let jamSeen = -1, satLow = 100, lastEarned = 0, perMin = [];
  const idle = () => !s.avatar.path.length && !s.avatar.act;
  const busyWith = k => s.avatar.task && s.avatar.task.kind === k && (s.avatar.path.length || s.avatar.act);
  const want = (k) => { if (!busyWith(k)) F.tap(s, { kind: k }); };
  while (s.t < END) {
    F.step(s, DT);
    s.events = [];
    satLow = Math.min(satLow, s.satisfaction);
    if (s.money >= 20) at('$20');
    if (s.hired >= 1) at('robot 1');
    if (s.hired >= 2) at('robot 2');
    for (let l = 1; l <= s.prompt; l++) at('prompt ' + l);
    if (Math.floor(s.t / 60) > perMin.length) { perMin.push(s.earned - lastEarned); lastEarned = s.earned; }
    const m = s.machine, b = F.bubbleOpen(s);
    if (m.phase === 'jam') { if (jamSeen < 0) jamSeen = s.t; } else jamSeen = -1;
    // use whatever bubble is open
    if (b) {
      if (b.kind === 'bin') { while (F.options(s).some(o => o.enabled && o.id.indexOf('sell:') === 0)) F.choose(s, F.options(s).find(o => o.enabled).id); s.bubble = null; continue; }
      if (b.kind === 'dock') { if (F.choose(s, 'hire')) { F.choose(s, s.hired === 1 ? 'job:operate' : 'job:sell'); } s.bubble = null; continue; }
      if (b.kind === 'terminal') { F.choose(s, 'prompt'); s.bubble = null; continue; }
    }
    if (!idle()) continue;
    if (kind === 'walks away' && s.hired >= 2) continue;
    const late = kind === 'hands-on' ? 0 : 10;
    if (m.phase === 'jam' && s.t - jamSeen >= late) { want('machine'); continue; }
    const hp = F.hirePrice(s), pp = F.promptPrice(s);
    if (hp !== null && s.money >= hp) { want('dock'); continue; }
    if (kind !== 'no prompt' && s.hired >= 2 && pp !== null && s.money >= pp) { want('terminal'); continue; }
    const seller = s.robots.some(r => r.job === 'sell'), operator = s.robots.some(r => r.job === 'operate');
    if (kind !== 'hands-on' && s.hired >= 2) continue;   // supervisors only clean and buy
    if (!operator && F.ready(s)) { want('machine'); continue; }
    if (s.bin.length && (!seller || kind === 'hands-on' && s.robots.find(r => r.job === 'sell').state === 'idle' && s.bin.length > 2)) { want('bin'); continue; }
  }
  const fmt = k => mark[k] === undefined ? '-' : (mark[k] / 60).toFixed(1) + 'm';
  return { kind, s, mark, fmt, satLow, perMin, last5: perMin.slice(-5).reduce((x, y) => x + y, 0) / 5 };
}

const runs = ['hands-on', 'supervisor', 'walks away', 'no prompt'].map(k => persona(k, 30, 7));
console.log('persona       $20    robot1  robot2  prompt1 prompt2 prompt3  earned  $/min(last5)  satisfaction(end/min)');
runs.forEach(r => console.log(r.kind.padEnd(12) + ['$20', 'robot 1', 'robot 2', 'prompt 1', 'prompt 2', 'prompt 3'].map(k => r.fmt(k).padStart(7)).join(' ') + String(r.s.earned).padStart(8) + r.last5.toFixed(1).padStart(13) + ('  ' + Math.round(r.s.satisfaction) + '/' + Math.round(r.satLow)).padStart(14)));
const R = Object.fromEntries(runs.map(r => [r.kind, r]));

ok(R['hands-on'].mark['$20'] < 90, 'the first $20 (four planks by hand) comes inside a minute and a half', R['hands-on'].fmt('$20'));
ok(R['hands-on'].mark['robot 2'] < 5 * 60, 'both robots are on staff inside five minutes of attentive play', R['hands-on'].fmt('robot 2'));
ok(R['hands-on'].mark['prompt 3'] < 25 * 60, 'attentive play reaches the top prompt level inside 25 minutes', R['hands-on'].fmt('prompt 3'));
const wa = R['walks away'];
ok(wa.last5 < 2 && wa.s.machine.phase === 'jam', 'robots left alone stall: the first sap jam stops the line and nobody fixes it', wa.last5.toFixed(1) + ' $/min, machine ' + wa.s.machine.phase);
ok(R['supervisor'].last5 > 3 * R['no prompt'].last5 && R['supervisor'].s.prompt === 3, 'prompt engineering pays: the prompted line earns over 3x the unprompted one by the end', R['supervisor'].last5.toFixed(1) + ' vs ' + R['no prompt'].last5.toFixed(1));
ok(R['no prompt'].s.satisfaction < 70 && R['supervisor'].s.satisfaction > R['no prompt'].s.satisfaction + 20, 'an unprompted seller wears customer satisfaction down; a prompted one wins it back', R['no prompt'].s.satisfaction + ' vs ' + R['supervisor'].s.satisfaction);
const pre = R['hands-on'].perMin.slice(0, 2).reduce((x, y) => x + y, 0) / 2;
ok(R['no prompt'].last5 < pre * 1.6, 'unprompted robots barely beat a person working alone (agents are not free speed)', R['no prompt'].last5.toFixed(1) + ' vs ' + pre.toFixed(1) + ' $/min by hand');

console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
console.log('TAAS-FACTORY-EVAL: ' + (failed ? 'RED' : 'GREEN'));
process.exit(failed ? 1 : 0);
