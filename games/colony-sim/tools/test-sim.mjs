#!/usr/bin/env node
// Colony Sim — headless tests over the DOM-free modules in ../src.
//   node games/colony-sim/tools/test-sim.mjs [section ...]
// Prints one line per check and SIM-TESTS: GREEN|RED last (exit 0/1).
const only = process.argv.slice(2);
let fails = 0, passes = 0;
export function check(name, cond, detail) {
  if (cond) { passes++; console.log('  ok   ' + name); }
  else { fails++; console.log('  FAIL ' + name + (detail !== undefined ? '  — ' + detail : '')); }
}
const sections = [];
const section = (name, fn) => sections.push({ name, fn });

/* ---------------- rng ---------------- */
section('rng', async () => {
  const { makeRng, hashState } = await import('../src/rng.js');
  const a = makeRng(42), b = makeRng(42);
  let same = true;
  for (let i = 0; i < 1000; i++) if (a.next() !== b.next()) same = false;
  check('rng determinism: same seed, same 1000 values', same);
  const r = makeRng(7); let inRange = true;
  for (let i = 0; i < 10000; i++) { const v = r.next(); if (!(v >= 0 && v < 1)) inRange = false; }
  check('rng range: next() in [0,1)', inRange);
  const p = makeRng(9), sa = p.stream('a'), sb = p.stream('b');
  const A = [...Array(20)].map(() => sa.next()), B = [...Array(20)].map(() => sb.next());
  check('streams differ', A.join() !== B.join());
  const q = makeRng(9), qa = q.stream('a'), qb = q.stream('b');
  for (let i = 0; i < 500; i++) qb.next();          // drawing from b must not shift a
  const A2 = [...Array(20)].map(() => qa.next());
  check('streams independent', A.join() === A2.join());
  const ints = [...Array(2000)].map(() => r.int(3, 5));
  check('int inclusive range', ints.every(v => v >= 3 && v <= 5) && ints.includes(3) && ints.includes(5));
  check('hashState stable', hashState({ a: 1, b: [2, 3] }) === hashState({ a: 1, b: [2, 3] }) && hashState({ a: 1 }) !== hashState({ a: 2 }));
});

/* ---------------- island ---------------- */
const islands = {};
export async function island(seed) {
  const { genIsland } = await import('../src/island.js');
  return islands[seed] || (islands[seed] = genIsland(seed));
}
section('island', async () => {
  const I = await import('../src/island.js');
  const { COVER, heightAt, coverAt, walkCost } = I;
  const t0 = Date.now(); await island(1); const ms = Date.now() - t0;
  check('generation under 1.5 s', ms < 1500, ms + ' ms');
  const bad = { flat: [], trees: [], rocks: [], falls: [], drop: [], cliff: [], rocky: [], river: [], bush: [] };
  for (let seed = 1; seed <= 20; seed++) {
    const isl = await island(seed), c = isl.camp;
    let lo = 1e9, hi = -1e9;
    for (let a = 0; a < 64; a++) for (let r = 0; r <= 30; r += 3) {
      const y = heightAt(isl, c.x + Math.cos(a / 64 * 6.283) * r, c.z + Math.sin(a / 64 * 6.283) * r);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (hi - lo > 0.6 || lo < 1.5) bad.flat.push(seed + ':' + lo.toFixed(2) + '..' + hi.toFixed(2));
    const near = (arr, r0, r1) => arr.filter(o => { const d = Math.hypot(o.x - c.x, o.z - c.z); return d >= r0 && d <= r1; }).length;
    if (near(isl.trees, 0, 60) < 40) bad.trees.push(seed + ':' + near(isl.trees, 0, 60));
    if (near(isl.trees, 0, 20) > 0) bad.trees.push(seed + ': tree inside camp');
    if (near(isl.rocks, 0, 60) < 25) bad.rocks.push(seed + ':' + near(isl.rocks, 0, 60));
    if (near(isl.bushes, 0, 150) < 25) bad.bush.push(seed + ':' + near(isl.bushes, 0, 150));
    const dp = Math.hypot(isl.pond.x - isl.landing.x, isl.pond.z - isl.landing.z);
    if (dp < 350 || dp > 550) bad.falls.push(seed + ':' + dp.toFixed(0));
    if (isl.falls.top.y - isl.falls.bottom.y < 12) bad.drop.push(seed + ':' + (isl.falls.top.y - isl.falls.bottom.y).toFixed(1));
    let land = 0, cliff = 0, rocky = 0, riverNear = 0;
    for (let i = 0; i < isl.cover.length; i++) {
      const k = isl.cover[i];
      if (k !== COVER.SEA) land++;
      if (k === COVER.CLIFF) cliff++;
      if (k === COVER.ROCKY) rocky++;
      if (k === COVER.RIVER) {
        const x = (i % isl.W + 0.5) * isl.CELL, z = (Math.floor(i / isl.W) + 0.5) * isl.CELL;
        if (Math.hypot(x - c.x, z - c.z) < 50) riverNear++;
      }
    }
    if (cliff / land < 0.01) bad.cliff.push(seed + ':' + (cliff / land * 100).toFixed(2) + '%');
    if (rocky < 200) bad.rocky.push(seed + ':' + rocky);
    if (riverNear) bad.river.push(seed + ':' + riverNear);
    if (coverAt(isl, isl.pond.x, isl.pond.z) !== COVER.POND) bad.falls.push(seed + ': pond centre not POND');
    if (walkCost(isl, c.x, c.z) !== 1) bad.flat.push(seed + ': camp centre cost ' + walkCost(isl, c.x, c.z));
  }
  check('landing site flat (±0.3 m over 30 m, above 1.5 m)', !bad.flat.length, bad.flat.join(' '));
  check('≥40 trees within 60 m of camp, none within 20 m', !bad.trees.length, bad.trees.join(' '));
  check('≥25 loose rocks within 60 m of camp', !bad.rocks.length, bad.rocks.join(' '));
  check('≥25 berry bushes within 150 m of camp', !bad.bush.length, bad.bush.join(' '));
  check('pond 350-550 m from landing', !bad.falls.length, bad.falls.join(' '));
  check('waterfall drop ≥ 12 m', !bad.drop.length, bad.drop.join(' '));
  check('cliffs ≥ 1% of land', !bad.cliff.length, bad.cliff.join(' '));
  check('rocky shore exists (≥200 cells)', !bad.rocky.length, bad.rocky.join(' '));
  check('no river within 50 m of camp', !bad.river.length, bad.river.join(' '));
  const isl = await island(1);
  check('walkCost: sea impassable', walkCost(isl, 2, 2) === Infinity);
  check('deterministic', JSON.stringify((await import('../src/island.js')).genIsland(3).trees.slice(0, 20)) === JSON.stringify((await island(3)).trees.slice(0, 20)));
});

/* ---------------- nav ---------------- */
section('nav', async () => {
  const { makeNav, findPath, pathTime, nearestPassable } = await import('../src/nav.js');
  const { COVER, coverAt } = await import('../src/island.js');
  const bad = { pond: [], cross: [], time: [] };
  for (let seed = 1; seed <= 20; seed++) {
    const isl = await island(seed), nav = makeNav(isl);
    const p = findPath(nav, isl.landing, isl.pond);
    if (!p) { bad.pond.push(seed + ': no path'); continue; }
    const end = p[p.length - 1];
    if (Math.hypot(end.x - isl.pond.x, end.z - isl.pond.z) > isl.pond.r + 8) bad.pond.push(seed + ': ends ' + Math.hypot(end.x - isl.pond.x, end.z - isl.pond.z).toFixed(0) + ' m out');
    const hrs = pathTime(nav, [isl.landing, ...p]) / 3600;
    if (hrs < 3 || hrs > 6) bad.time.push(seed + ':' + hrs.toFixed(2) + 'h');
    let prev = isl.landing;
    for (const q of p) {
      const L = Math.hypot(q.x - prev.x, q.z - prev.z);
      for (let s = 0; s <= L; s += 1) {
        const x = prev.x + (q.x - prev.x) * s / L, z = prev.z + (q.z - prev.z) * s / L, k = coverAt(isl, x, z);
        if (k === COVER.CLIFF || k === COVER.SEA) { bad.cross.push(seed + '@' + x.toFixed(0) + ',' + z.toFixed(0) + ' k' + k); break; }
      }
      prev = q;
    }
  }
  check('path landing→pond exists and reaches the pond edge (20 seeds)', !bad.pond.length, bad.pond.join(' '));
  check('landing→pond walk 3-6 game hours', !bad.time.length, bad.time.join(' '));
  check('paths never cross cliff or sea (1 m samples)', !bad.cross.length, bad.cross.slice(0, 5).join(' '));
  const isl = await island(1), nav = makeNav(isl);
  const top = isl.falls.top, foot = isl.falls.bottom;
  const up = findPath(nav, foot, { x: top.x + (top.x - foot.x), z: top.z + (top.z - foot.z) });
  const len = up ? up.reduce((a, q, i) => a + Math.hypot(q.x - (i ? up[i - 1] : foot).x, q.z - (i ? up[i - 1] : foot).z), 0) : 0;
  const straight = Math.hypot(2 * (top.x - foot.x), 2 * (top.z - foot.z));
  check('climbing the scarp detours round it (via a ramp)', up && len > straight * 2, up ? len.toFixed(0) + ' vs ' + straight.toFixed(0) : 'no path');
  const sea = findPath(nav, isl.camp, { x: isl.landing.x + (isl.landing.x - isl.camp.x), z: isl.landing.z + (isl.landing.z - isl.camp.z) });
  check('a path to the sea ends on passable ground', sea && Number.isFinite(nav.costAt(sea[sea.length - 1].x, sea[sea.length - 1].z)));
  const np = nearestPassable(nav, isl.pond);
  check('nearestPassable of pond centre is passable and near', Number.isFinite(nav.costAt(np.x, np.z)) && Math.hypot(np.x - isl.pond.x, np.z - isl.pond.z) < isl.pond.r + 8);
  const R = (await import('../src/rng.js')).makeRng(5);
  const pts = []; while (pts.length < 400) { const q = { x: R.range(0, 1000), z: R.range(0, 700) }; if (Number.isFinite(nav.costAt(q.x, q.z))) pts.push(q); }
  const t0 = Date.now(); for (let i = 0; i < 200; i++) findPath(nav, pts[i], pts[i + 200]); const ms = Date.now() - t0;
  check('200 random paths under 2 s', ms < 2000, ms + ' ms');
});

/* ---------------- sim core ---------------- */
const DAY = 86400;
section('sim', async () => {
  const S = await import('../src/sim.js');
  const { createSim, step, runFor, snapshot, restore, simHash, eff, clockOf } = S;
  const e = [0, 25, 50, 65, 80, 90, 100].map(eff), want = [0, 0.5, 1, 1, 1, 1.1, 1.2];
  check('eff at 0/25/50/65/80/90/100', e.every((v, i) => Math.abs(v - want[i]) < 1e-9), e.join(','));
  check('clock starts day 1 06:00', (() => { const c = clockOf(createSim(1)); return c.day === 1 && c.hour === 6 && c.minute === 0; })());

  const hashes = () => { const sim = createSim(7), out = []; for (let h = 0; h < 72; h++) { runFor(sim, 3600); out.push(simHash(sim)); } return out; };
  const A = hashes(), B = hashes();
  check('determinism: same seed, same hash every game hour for 3 days', A.join() === B.join(), A.findIndex((v, i) => v !== B[i]));

  const s1 = createSim(11); runFor(s1, DAY);
  const s2 = restore(JSON.parse(JSON.stringify(snapshot(s1))));
  runFor(s1, DAY); runFor(s2, DAY);
  check('snapshot/restore round trip replays identically', simHash(s1) === simHash(s2));

  const bad = [], cad = [], longT = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= 5; seed++) {
    const sim = createSim(seed);
    let maxTask = 0, pee0, poo0;
    for (let tk = 0; tk < 10 * DAY / S.TICK; tk++) {
      step(sim);
      if (tk === Math.round((DAY + 0) / S.TICK)) { pee0 = sim.settlers.map(s => s.stats.pee); poo0 = sim.settlers.map(s => s.stats.poo); }
      if (tk === Math.round(5 * DAY / S.TICK)) sim.settlers.forEach((s, i) => cad.push({ seed, n: s.name, pee: (s.stats.pee - pee0[i]) / 4, poo: (s.stats.poo - poo0[i]) / 4 }));
      if (tk % 60 === 0) for (const s of sim.settlers) {
        if (!Number.isFinite(s.x) || !Number.isFinite(s.z) || Object.values(s.m).some(v => !Number.isFinite(v))) bad.push(seed + ':' + s.name + '@' + tk);
        if (s.task) maxTask = Math.max(maxTask, sim.t - s.task.started);
      }
    }
    if (maxTask > 12 * 3600) longT.push(seed + ':' + (maxTask / 3600).toFixed(1) + 'h');
  }
  const secs = (Date.now() - t0) / 1000;
  check('no NaN in positions or meters (5 seeds x 10 days)', !bad.length, bad.slice(0, 5).join(' '));
  check('10 game days run in under 4 s per seed', secs / 5 < 4, (secs / 5).toFixed(2) + ' s');
  const offPee = cad.filter(c => c.pee < 1.5 || c.pee > 2.5), offPoo = cad.filter(c => c.poo < 0.7 || c.poo > 1.3);
  check('2 pees a day (1.5-2.5) days 2-6', !offPee.length, offPee.map(c => c.seed + c.n + ':' + c.pee).join(' '));
  check('1 poo a day (0.7-1.3) days 2-6', !offPoo.length, offPoo.map(c => c.seed + c.n + ':' + c.poo).join(' '));
  check('no task runs longer than 12 game hours', !longT.length, longT.join(' '));

  // ocean bath caps at 70
  const sb = createSim(2), sbs = sb.settlers[1];
  sbs.m.clean = 10; S.assignTask(sb, sbs, 'bathe', { pinned: true });
  let maxClean = 0; for (let i = 0; i < 6 * 3600 / S.TICK; i++) { step(sb); maxClean = Math.max(maxClean, sbs.m.clean); if (sbs.stats.baths) break; }
  check('ocean bath happened and cleanliness stayed ≤ 70', sbs.stats.baths >= 1 && maxClean <= 70.0001, 'baths ' + sbs.stats.baths + ' max ' + maxClean.toFixed(1));

  // collapse from exhaustion in the forest: sleeps there, wakes at ≤ 50
  const sc = createSim(3), sct = sc.settlers[2];
  const far = sc.isl.trees.find(t => Math.hypot(t.x - sc.isl.camp.x, t.z - sc.isl.camp.z) > 150);
  sct.x = far.x + 1.5; sct.z = far.z; sct.m.energy = 0.5; sct.m.hunger = 90; sct.task = null; sct.plan = [];
  let slept = false, woke = null;
  for (let i = 0; i < 16 * 3600 / S.TICK; i++) { step(sc); if (sct.act === 'collapsed') slept = true; if (slept && sct.act !== 'collapsed') { woke = sct.m.energy; break; } }
  check('exhausted settler sleeps where they fell', slept);
  check('…and wakes at ≤ 50% energy', woke !== null && woke <= 50.0001, woke);
});

/* ---------------- minds ---------------- */
section('minds', async () => {
  const S = await import('../src/sim.js'), B = await import('../src/brain.js');
  const { LESSONS } = await import('../src/data.js');
  const sim = S.createSim(3), bram = sim.settlers[1];
  let tries = 0; while (!bram.lessons.overwork && tries < 40) { B.learnEvent(sim, bram, 'overwork'); tries++; }
  check('a lesson is learned by repeating its mistake', !!bram.lessons.overwork, tries + ' tries');
  check('…and moves its number toward the target', bram.lessons.overwork && B.lessonParam(bram, 'overwork') > LESSONS.overwork.start);
  check('…and the settler says so', sim.bubbles.some(b => b.sid === bram.id && b.kind === 'learn'));
  const wise = { attrs: { INT: 16, WIS: 16 } }, slow = { attrs: { INT: 8, WIS: 8 } };
  check('INT/WIS set the learning speed', B.learnChance(wise) > B.learnChance(slow), B.learnChance(wise) + ' vs ' + B.learnChance(slow));

  // refusal: learned overwork, exhausted, ordered to chop now
  const r = S.createSim(5); S.runFor(r, 3600);
  const g = r.settlers[1]; g.lessons.overwork = { v: 30, times: 1, day: 1 };
  g.m.energy = 20; g.plan.unshift({ id: 999, kind: 'chop', label: 'Chop a tree', owner: 'leader' });
  const out = S.applyInput(r, { type: 'doNow', sid: g.id, idx: 0 });
  check('a learned lesson makes them refuse', out === 'refused' && g.task.kind === 'sleep', out + ' / ' + (g.task && g.task.kind));
  check('…with a speech bubble', r.bubbles.some(b => b.sid === g.id && b.kind === 'refuse'));
  check('…and the order waits behind the need', g.plan[0] && g.plan[0].kind === 'chop');
  check('…and the refusal is logged with the input', r.inputs.length === 1 && g.stats.refusals === 1);

  // before learning: they obey and push through
  const o = S.createSim(5); S.runFor(o, 3600);
  const g2 = o.settlers[1]; g2.m.energy = 6; g2.plan.unshift({ id: 998, kind: 'chop', label: 'Chop a tree', owner: 'leader' });
  const out2 = S.applyInput(o, { type: 'doNow', sid: g2.id, idx: 0 });
  check('without the lesson they obey', out2 === true && g2.task.kind === 'chop' && g2.task.pinned);
  let collapsed = false; for (let i = 0; i < 6 * 360 && !collapsed; i++) { S.step(o); if (g2.act === 'collapsed') collapsed = true; }
  check('…and pushing through ends in a collapse', collapsed);

  // goal order is respected
  const go = S.createSim(8);
  S.applyInput(go, { type: 'goalMove', id: 'toolbench', to: 0 });
  S.runFor(go, 8 * DAY);
  const order = go.sites.filter(x => x.done).sort((a, b) => a.doneT - b.doneT).map(x => x.type);
  check('the leader follows the goals board (tool bench moved first: built before the lean-to)', order.indexOf('toolbench') >= 0 && order.indexOf('toolbench') < order.indexOf('leanto'), order.join(','));

  // replay: seed + recorded inputs reproduce the run
  const live = S.createSim(9), R = (await import('../src/rng.js')).makeRng(77);
  for (let k = 0; k < 20; k++) {
    S.runFor(live, R.range(600, 12000));
    const s = live.settlers[R.int(0, 3)];
    if (s.plan.length > 1) S.applyInput(live, { type: 'reorder', sid: s.id, from: s.plan.length - 1, to: 0 });
    else S.applyInput(live, { type: 'goalMove', id: R.pick(live.goals), to: R.int(0, 5) });
  }
  const again = S.replay(9, JSON.parse(JSON.stringify(live.inputs)), live.tick);
  check('replaying seed + inputs reproduces the run', S.simHash(again) === S.simHash(live), live.inputs.length + ' inputs');
});

/* ---------------- economy ---------------- */
section('economy', async () => {
  const S = await import('../src/sim.js'), D = await import('../src/data.js');
  const forceBuilt = (sim, type, goal) => {
    const pos = sim.lay.slots[type] || sim.lay.beds[sim.sites.filter(x => x.type === 'bed').length];
    const B = D.BUILDINGS[type];
    sim.sites.push({ id: sim.nextId++, type, goal: goal || type, x: pos.x, z: pos.z, yaw: 0, need: { ...B.cost }, have: { ...B.cost }, prog: B.hours, hours: B.hours, done: true, doneT: sim.t });
  };
  const a = S.createSim(4); let lean = false;
  for (let i = 0; i < 6 * 8640 && !lean; i++) { S.step(a); lean = a.settlers.some(s => s.sleep && s.sleep.place === 'leanto' && s.act === 'sleep'); }
  check('the lean-to gets built and slept in', lean);

  const w = S.createSim(6); S.runFor(w, 20 * DAY);
  check('tools never wear below 50%', Object.values(w.tools).every(t => t.cond >= 50), JSON.stringify(Object.fromEntries(Object.entries(w.tools).map(([k, t]) => [k, t.cond.toFixed(0)]))));
  const wore = S.createSim(6); wore.tools.axe.cond = 50.2;
  const g = wore.settlers[1]; S.assignTask(wore, g, 'chop', { pinned: true });
  for (let i = 0; i < 400; i++) S.step(wore);
  check('a worn tool stops at exactly 50%', wore.tools.axe.cond === 50, wore.tools.axe.cond);

  const f = S.createSim(7); forceBuilt(f, 'campfire'); forceBuilt(f, 'toolbench');
  for (const k in f.tools) f.tools[k].cond = 50;
  const ines = f.settlers[3]; S.assignTask(f, ines, 'maintain', { pinned: true });
  for (let i = 0; i < 2 * 360; i++) S.step(f);
  check('the tool bench restores tools', Object.values(f.tools).some(t => t.cond > 70), JSON.stringify(Object.fromEntries(Object.entries(f.tools).map(([k, t]) => [k, t.cond.toFixed(0)]))));

  const sp = S.createSim(2); sp.settlers = []; sp.food = []; S.addFood(sp, 'meal', 5); S.runFor(sp, 2.2 * DAY);
  check('meals spoil after 2 days outside the food store', S.foodCount(sp, 'meal') === 0);
  const st = S.createSim(2); st.settlers = []; st.food = []; forceBuilt(st, 'foodstore'); S.addFood(st, 'meal', 5); S.runFor(st, 2.2 * DAY);
  check('…and keep inside it', S.foodCount(st, 'meal') === 5);

  const p = S.createSim(3);
  for (const b of D.PHASE1_BUILDS) forceBuilt(p, b, b);
  for (let i = 0; i < 5; i++) forceBuilt(p, 'bed', 'beds5');
  S.addFood(p, 'dried', 40);
  for (let i = 0; i < 60 * 360 && !p.phase1; i++) { S.step(p); for (const s of p.settlers) for (const k in s.m) s.m[k] = Math.max(s.m[k], 60); }
  check('the phase 1 finish line is recognised after 48 h at ≥ 50%', p.phase1 && p.phase1.done, JSON.stringify(p.p1));
  check('…and not before 48 h', p.phase1 && p.phase1.t - 6 * 3600 >= 48 * 3600 - 3600, p.phase1 && (p.phase1.t / 3600).toFixed(1));
});

/* ---------------- rig ---------------- */
section('rig', async () => {
  const R = await import('../src/rig.js'), I = await import('../src/island.js'), D = await import('../src/data.js');
  const isl = await island(1);
  const look = D.FOUNDERS[1].look, s = look.height;
  const LEN = [[13, 14, 0.45 * s], [14, 15, 0.44 * s], [17, 18, 0.45 * s], [18, 19, 0.44 * s], [5, 6, 0.29 * s], [6, 7, 0.26 * s], [9, 10, 0.29 * s], [10, 11, 0.26 * s]];
  const ACTS = ['idle', 'walk', 'run', 'chop', 'mine', 'pick', 'build', 'cook', 'forage', 'trap', 'eat', 'sit', 'sleep', 'collapsed', 'talk', 'bathe', 'squat', 'fish', 'look', 'maintain', 'drop'];
  let worst = 0, bad = [], nonFinite = [];
  for (const act of ACTS) {
    const st = { x: isl.camp.x, z: isl.camp.z, yaw: 0.3, speed: act === 'walk' ? 1.6 : act === 'run' ? 3.5 : 0, act, look, carry: act === 'walk' ? { item: 'wood', n: 2 } : null, face: { x: isl.camp.x + 2, z: isl.camp.z } };
    const rig = R.makeRig(st, isl);
    for (let i = 0; i < 100; i++) {
      if (st.speed) { st.x += Math.cos(st.yaw) * st.speed / 60; st.z += Math.sin(st.yaw) * st.speed / 60; }
      R.updateRig(rig, st, i === 0 ? 0 : (i % 7 ? 1 / 60 : 0.1), isl);
      const J = rig.J;
      if (i > 30) for (const [a, b, L] of LEN) { const d = Math.hypot(J[a].x - J[b].x, J[a].y - J[b].y, J[a].z - J[b].z); const e = Math.abs(d - L); if (e > worst) worst = e; if (e > 1e-6 && bad.length < 3) bad.push(act + ' ' + a + '-' + b + ' ' + e.toExponential(1)); }
      const caps = R.rigCapsules(rig);
      if (!caps.every(Number.isFinite)) nonFinite.push(act);
    }
  }
  check('IK bones keep their exact lengths in every activity (after blends settle)', worst < 1e-6, bad.join(' '));
  check('every capsule is finite at dt 0, 1/60 and 0.1', !nonFinite.length, [...new Set(nonFinite)].join(','));
  // walking up a slope: stance ankles sit on the ground
  const path = { x: isl.camp.x, z: isl.camp.z, yaw: Math.atan2(isl.pond.z - isl.camp.z, isl.pond.x - isl.camp.x), speed: 1.6, act: 'walk', look };
  const rig = R.makeRig(path, isl);
  let maxErr = 0, n = 0;
  for (let i = 0; i < 60 * 60; i++) {
    path.x += Math.cos(path.yaw) * 1.6 / 60; path.z += Math.sin(path.yaw) * 1.6 / 60;
    R.updateRig(rig, path, 1 / 60, isl);
    for (let f = 0; f < 2; f++) if (!rig.feet[f].sw) { const a = rig.J[f ? 19 : 15]; const e = Math.abs(a.y - 0.08 * look.height - I.heightAt(isl, a.x, a.z)); maxErr = Math.max(maxErr, e); n++; }
  }
  check('walking 60 s over the island: stance ankles within 0.1 m of the ground', maxErr < 0.1 && n > 1000, maxErr.toFixed(3) + ' over ' + n);
  const strides = rig.steps / 60;
  check('walking cadence is human (0.7-1.2 steps per foot per second)', strides / 2 > 0.7 && strides / 2 < 1.2, (strides / 2).toFixed(2));
});

for (const s of sections) {
  if (only.length && !only.includes(s.name)) continue;
  console.log('[' + s.name + ']');
  try { await s.fn(); } catch (e) { fails++; console.log('  FAIL ' + s.name + ' threw: ' + (e && e.stack || e)); }
}
console.log((fails ? 'SIM-TESTS: RED' : 'SIM-TESTS: GREEN') + ` (${passes} passed, ${fails} failed)`);
process.exit(fails ? 1 : 0);
