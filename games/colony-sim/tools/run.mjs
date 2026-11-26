#!/usr/bin/env node
// Colony Sim — headless runs for tuning (CD: phase 1 always succeeds; the number of days varies).
//   node games/colony-sim/tools/run.mjs [--seeds 30] [--from 1] [--days 30] [--bad] [--quiet]
// One line per seed, then the aggregate. Exit 1 if any seed fails to finish phase 1 in time.
import { createSim, step, applyInput, mealUnits, foodTarget, TICK, DAY, hourOf, dayOf } from '../src/sim.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? +process.argv[i + 1] : true); };
const N = arg('seeds', 30), FROM = arg('from', 1), DAYS = arg('days', 30), BAD = !!arg('bad', false), QUIET = !!arg('quiet', false);

// A player who micromanages badly: every evening for three nights, orders everyone to keep working.
function badPlayer(sim) {
  const d = dayOf(sim), h = hourOf(sim);
  if (d === 1 && Math.abs(h - 9) < 1e-6) applyInput(sim, { type: 'goalMove', id: 'toolbench', to: 99 });
  if (d >= 2 && d <= 4 && Math.abs(h - 22.5) < 1e-6) {
    for (const s of sim.settlers) {
      const i = s.plan.findIndex((it) => !it.steps && it.kind !== 'sleep');
      if (i >= 0) applyInput(sim, { type: 'doNow', sid: s.id, idx: i });
      applyInput(sim, { type: 'later', sid: s.id, need: 'sleep', hours: 3 });
    }
  }
}

const rows = [];
const t0 = Date.now();
for (let seed = FROM; seed < FROM + N; seed++) {
  const sim = createSim(seed);
  let struggle = 100, minFood = 1e9;
  const end = DAYS * DAY / TICK;
  for (let k = 0; k < end && !sim.phase1; k++) {
    step(sim);
    if (BAD) badPlayer(sim);
    if (k % 60 === 0) { for (const s of sim.settlers) for (const m of ['health', 'energy', 'hunger', 'mood', 'clean']) struggle = Math.min(struggle, s.m[m]); if (sim.t > 2 * DAY) minFood = Math.min(minFood, mealUnits(sim)); }
  }
  const S = sim.settlers;
  const low = S.map((s) => ({ n: s.name, v: s.stats.lowest, w: s.stats.lowWhat })).sort((a, b) => a.v - b.v)[0];
  const lessons = S.flatMap((s) => Object.entries(s.lessons).map(([k, l]) => s.name[0] + ':' + k + '@d' + l.day));
  const r = {
    seed, done: !!sim.phase1, day: sim.phase1 ? (sim.phase1.t / DAY).toFixed(1) : '-',
    low: low.n + ' ' + low.w + ' ' + low.v.toFixed(0), struggle,
    collapses: S.reduce((a, s) => a + s.stats.collapses, 0), injuries: S.reduce((a, s) => a + s.stats.injuries, 0),
    accidents: S.reduce((a, s) => a + s.stats.accidents, 0), refusals: S.reduce((a, s) => a + s.stats.refusals, 0),
    lessons, pond: sim.discovered.pond ? (sim.discovered.pond / DAY).toFixed(1) : '-',
    food: mealUnits(sim).toFixed(0) + '/' + foodTarget(sim), p1: sim.p1, minFood,
  };
  rows.push(r);
  if (!QUIET) console.log(`seed ${String(seed).padStart(3)}  ${r.done ? 'DONE day ' + r.day.padStart(5) : 'NOT DONE    '}  low ${r.low.padEnd(16)} coll ${r.collapses} inj ${r.injuries} acc ${r.accidents} ref ${r.refusals}  pond ${r.pond}  food ${r.food}  lessons ${lessons.length}: ${lessons.join(' ')}${r.done ? '' : '  ' + JSON.stringify(r.p1)}`);
}
const done = rows.filter((r) => r.done), days = done.map((r) => +r.day).sort((a, b) => a - b);
const med = days.length ? days[Math.floor(days.length / 2)] : NaN;
const struggled = rows.filter((r) => r.struggle < 30).length;
const lessonMed = rows.map((r) => r.lessons.length).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log(`\n${BAD ? 'BAD PLAYER  ' : ''}finished ${done.length}/${rows.length}  median day ${med}  range ${days[0]}-${days[days.length - 1]}  struggle(<30) ${struggled}/${rows.length}  median lessons ${lessonMed}  collapses ${rows.reduce((a, r) => a + r.collapses, 0)}  injuries ${rows.reduce((a, r) => a + r.injuries, 0)}  accidents ${rows.reduce((a, r) => a + r.accidents, 0)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(done.length === rows.length ? 0 : 1);
