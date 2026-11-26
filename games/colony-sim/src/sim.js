// sim.js — the colony simulation. DOM-free, render-free, seeded: the same seed and the
// same inputs always play out the same. A tick is 10 game seconds. Settlers know where
// they are, how fast they move and what they are doing; joints are the renderer's business.
import { makeRng, hashState } from './rng.js';
import { genIsland, heightAt, coverAt, COVER } from './island.js';
import { makeNav, findPath, nearestPassable, WALK } from './nav.js';
import { TUNE, FOUNDERS, TOOLS, BUILDINGS, GOALS, DEFAULT_GOALS, PHASE1_BUILDS, LESSONS, LEARNED } from './data.js';
import { think, checkInterrupts, leaderTick, makeTask, lessonParam, learnEvent, applyPlayerInput } from './brain.js';

export const TICK = 10;
const HOUR = 3600, DAYS = 86400;
export const DAY = DAYS;

export function eff(v) { return v < 50 ? Math.max(0, v) / 50 : v <= 80 ? 1 : 1 + 0.2 * (Math.min(100, v) - 80) / 20; }
export const hourOf = (sim) => (sim.t % DAYS) / HOUR;
export const dayOf = (sim) => Math.floor(sim.t / DAYS) + 1;
export function clockOf(sim) { const s = sim.t % DAYS; return { day: dayOf(sim), hour: Math.floor(s / HOUR), minute: Math.floor((s % HOUR) / 60) }; }
export const isDark = (sim) => { const h = hourOf(sim); return h < 5.9 || h > 19.6; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ------------------------------ camp layout ------------------------------ */
export function layoutOf(isl) {
  const c = isl.camp, L = isl.landing, dl = Math.hypot(c.x - L.x, c.z - L.z) || 1;
  const fwd = { x: (c.x - L.x) / dl, z: (c.z - L.z) / dl }, right = { x: -fwd.z, z: fwd.x };
  const at = (f, r) => ({ x: c.x + fwd.x * f + right.x * r, z: c.z + fwd.z * f + right.z * r });
  const yaw = Math.atan2(fwd.z, fwd.x);
  const slots = {};
  for (const k in BUILDINGS) if (BUILDINGS[k].f !== undefined) slots[k] = { ...at(BUILDINGS[k].f, BUILDINGS[k].r), yaw };
  // beds inside the huts: three in the first, two (room for three) in the second
  const beds = [];
  for (const [hk, n] of [['hut1', 3], ['hut2', 3]]) {
    const b = BUILDINGS[hk];
    for (let i = 0; i < n; i++) beds.push({ ...at(b.f + 0.9, b.r - 1.7 + i * 1.7), yaw: yaw + Math.PI / 2, hut: hk });
  }
  const seats = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; seats.push(at(Math.cos(a) * 2.6, Math.sin(a) * 2.6)); }
  const ground = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ground.push(at(Math.cos(a) * 4.2 + 1, Math.sin(a) * 4.2)); }
  // a bathing spot: the beach just above the waterline, straight down from camp
  let bx = L.x, bz = L.z; for (let s = 0; s < 40; s++) { const x = L.x + fwd.x * -s, z = L.z + fwd.z * -s; if (heightAt(isl, x, z) < 0.3) break; bx = x; bz = z; }
  // fishing spots along the shore within 160 m of the landing
  const fishing = [];
  for (let a = 0; a < 48; a++) {
    const ang = a / 48 * Math.PI * 2;
    for (let r = 30; r < 170; r += 10) {
      const x = L.x + Math.cos(ang) * r, z = L.z + Math.sin(ang) * r, k = coverAt(isl, x, z);
      if ((k === COVER.SAND || k === COVER.ROCKY) && coverAt(isl, x + Math.cos(ang) * 4, z + Math.sin(ang) * 4) === COVER.SEA) { fishing.push({ x, z }); break; }
    }
  }
  return { fwd, right, at, yaw, slots, beds, seats, ground, bath: { x: bx, z: bz }, fishing, fire: at(0, 0), pile: at(BUILDINGS.storage.f, BUILDINGS.storage.r), food: at(BUILDINGS.foodstore.f, BUILDINGS.foodstore.r) };
}

/* ------------------------------ creation ------------------------------ */
export function createSim(seed, opts = {}) {
  const isl = genIsland(seed), nav = makeNav(isl), lay = layoutOf(isl), root = makeRng(seed);
  const sim = {
    v: 1, seed, tick: 0, t: 6 * HOUR, isl, nav, lay,
    R: { life: root.stream('life'), work: root.stream('work'), learn: root.stream('learn'), food: root.stream('food'), social: root.stream('social') },
    settlers: [], stock: { wood: 0, stone: 0 }, food: [], piles: [], sites: [], traps: [],
    world: { felled: {}, rocks: {}, bushes: {}, reserved: {} },
    goals: DEFAULT_GOALS.slice(), tools: {}, inputs: [], events: [], bubbles: [], seen: {}, discovered: {},
    phase1: null, okSince: null, nextId: 1, speedHint: 1,
  };
  for (const k of TOOLS) sim.tools[k] = { cond: 100, by: null };
  addFood(sim, 'meal', TUNE.startMeals);
  FOUNDERS.forEach((f, i) => {
    const a = (i - 1.5) * 1.6;
    const p = nearestPassable(nav, { x: isl.landing.x + lay.right.x * a - lay.fwd.x * 0, z: isl.landing.z + lay.right.z * a });
    sim.settlers.push({
      id: f.id, name: f.name, role: f.role, title: f.title, attrs: { ...f.attrs }, look: f.look, founder: true,
      x: p.x, z: p.z, yaw: Math.atan2(lay.fwd.z, lay.fwd.x), speed: 0, act: 'idle', face: null,
      m: { health: 100, energy: 88, hunger: 82, mood: 78, bladder: 92, bowel: 86, clean: 92 },
      carry: null, task: null, plan: [], lessons: {}, exp: {}, rel: {}, log: [],
      sleep: null, ateHot: -1e9, bathT: 0, persevere: false,
      stats: { pee: 0, poo: 0, baths: 0, injuries: 0, collapses: 0, refusals: 0, meals: 0, accidents: 0, learned: 0, lowest: 100, lowWhat: '' },
    });
  });
  for (const s of sim.settlers) for (const o of sim.settlers) if (o !== s) s.rel[o.id] = 40 + Math.floor(sim.R.social.next() * 21);
  event(sim, null, 'landed', 'The four come ashore with one crate of rations and one set of tools.');
  return sim;
}

/* ------------------------------ helpers ------------------------------ */
export function event(sim, s, type, text) {
  sim.events.push({ t: sim.t, sid: s ? s.id : null, type, text });
  if (sim.events.length > 400) sim.events.splice(0, sim.events.length - 400);
  if (s && text) { s.log.push({ t: sim.t, text }); if (s.log.length > 40) s.log.shift(); }
}
export function say(sim, s, text, kind = 'say') {
  sim.bubbles.push({ id: sim.nextId++, sid: s.id, t: sim.t, text, kind });
  if (sim.bubbles.length > 30) sim.bubbles.shift();
}
export const site = (sim, id) => sim.sites.find((x) => x.id === id);
export const built = (sim, type) => sim.sites.some((x) => x.type === type && x.done);
export function goalDone(sim, g) {
  const G = GOALS[g];
  if (G.food) return mealUnits(sim) >= foodTarget(sim);
  const need = {}; for (const b of G.builds) need[b] = (need[b] || 0) + 1;
  for (const b in need) if (sim.sites.filter((x) => x.type === b && x.done && x.goal === g).length < need[b]) return false;
  return true;
}
export const goalOpen = (sim, g) => GOALS[g].prereq.every((p) => goalDone(sim, p)) && !goalDone(sim, g);

/* food: batches with an expiry; the food store keeps them longer */
export function addFood(sim, kind, n) {
  if (n <= 0) return;
  const stored = built(sim, 'foodstore') || (kind === 'dried');
  const days = (stored ? TUNE.spoilStored : TUNE.spoil)[kind];
  sim.food.push({ kind, n, exp: sim.t + days * DAYS });
}
export const foodCount = (sim, kind) => sim.food.reduce((a, b) => a + (b.kind === kind ? b.n : 0), 0);
export function takeFood(sim, kind, n) {
  let got = 0;
  sim.food.sort((a, b) => a.exp - b.exp);
  for (const b of sim.food) { if (b.kind !== kind || got >= n) continue; const k = Math.min(b.n, n - got); b.n -= k; got += k; }
  sim.food = sim.food.filter((b) => b.n > 1e-9);
  return got;
}
export const mealUnits = (sim) => foodCount(sim, 'meal') + foodCount(sim, 'dried') + foodCount(sim, 'meat') * 2 + foodCount(sim, 'fish') * 1.5 + foodCount(sim, 'berries') / 3;
export const foodTarget = (sim) => TUNE.foodGoalDays * (sim.settlers.length + 1) * TUNE.mealsPerDay;

export function toolEff(sim, name) { return name ? sim.tools[name].cond / 100 : 1; }

/* ------------------------------ needs ------------------------------ */
const HEAVY = new Set(['chop', 'mine', 'build', 'carry']);
const LIGHT = new Set(['forage', 'cook', 'trap', 'fish', 'tidy', 'bathe', 'talk', 'maintain', 'pick', 'walk', 'run', 'look']);
const DIRTY = new Set(['chop', 'mine', 'build', 'trap', 'forage', 'carry']);

export function moodTarget(sim, s) {
  let t = 62;
  if (s.sleep && s.sleep.place && s.sleep.place !== 'wild') t += s.sleep.place === 'bed' ? 10 : s.sleep.place === 'ground' ? 2 : 6;
  if (sim.t - s.ateHot < 10 * HOUR) t += 6;
  const rels = Object.values(s.rel).sort((a, b) => b - a).slice(0, 2);
  t += (rels.reduce((a, b) => a + b, 0) / Math.max(1, rels.length) - 50) / 4;
  if (s.cheerUntil > sim.t) t += 10;
  if (s.pondUntil > sim.t) t += 8;
  for (const k of ['health', 'energy', 'hunger', 'clean']) if (s.m[k] < 25) t -= 12;
  if (sim.stock && built(sim, 'latrine')) t += 2;
  if (s.role === 'leader' && s.act === 'sit') t += 8;
  return clamp(t, 5, 100);
}

function drain(sim, s, dt) {
  const h = dt / HOUR, m = s.m, asleep = s.act === 'sleep' || s.act === 'collapsed';
  const act = s.act, heavy = HEAVY.has(act) || (s.carry && (act === 'walk' || act === 'run')), light = LIGHT.has(act);
  const con = 1 - 0.03 * (s.attrs.CON - 10);
  if (asleep) {
    const [rate, cap] = TUNE.sleep[s.sleep ? s.sleep.place : 'ground'];
    if (m.energy < cap) m.energy = Math.min(cap, m.energy + rate * h);
  } else m.energy -= (heavy ? TUNE.energyWork : light ? TUNE.energyLight : TUNE.energyIdle) * h * con * (act === 'run' ? 1.6 : 1);
  m.hunger -= (asleep ? TUNE.hungerSleep : TUNE.hungerAwake * (heavy ? 1.25 : 1)) * h;
  m.bladder -= (asleep ? TUNE.bladderSleep : TUNE.bladderAwake) * h;
  m.bowel -= (asleep ? TUNE.bowelSleep : TUNE.bowelAwake) * h;
  m.clean -= (asleep ? TUNE.cleanSleep : DIRTY.has(act) ? TUNE.cleanDirty : TUNE.cleanAwake) * h;
  m.health += (asleep ? TUNE.healSleep : heavy ? TUNE.healWork : TUNE.healIdle) * h * (m.hunger > 20 ? 1 : 0.2);
  const mt = moodTarget(sim, s);
  m.mood += clamp(mt - m.mood, -TUNE.moodRate * h, TUNE.moodRate * h);
  for (const k in m) m[k] = clamp(m[k], 0, 100);
  for (const k of ['health', 'energy', 'hunger', 'mood', 'clean']) {
    if (m[k] < s.stats.lowest) { s.stats.lowest = m[k]; s.stats.lowWhat = k; }
    if (!s.dayMin) s.dayMin = {};
    if (!(s.dayMin[k] <= m[k])) s.dayMin[k] = m[k];
  }

  // things that happen at zero
  if (m.bladder <= 0 || m.bowel <= 0) {
    const k = m.bladder <= 0 ? 'bladder' : 'bowel';
    m[k] = 100; m.clean = Math.max(0, m.clean - 40); m.mood = Math.max(0, m.mood - 15); s.stats.accidents++;
    event(sim, s, 'accident', s.name + ' had an accident.'); say(sim, s, 'Oh no. That was humiliating.', 'refuse');
  }
  if (!asleep && m.energy <= 0) {
    s.stats.collapses++; event(sim, s, 'collapse', s.name + ' collapsed from exhaustion and slept where they fell.');
    learnEvent(sim, s, 'overwork');
    if (s.sleep && s.sleep.lateStart) learnEvent(sim, s, 'lateNight');
    replaceTask(sim, s, makeTask(sim, s, 'collapse'));
  } else if (!s.persevere && !(s.persevereUntil > sim.t) && (m.hunger <= 0 || m.health <= 0)) {
    const why = m.hunger <= 0 ? 'hunger' : 'injury';
    s.stats.collapses++; s.persevere = true; s.persevereUntil = sim.t + 6 * HOUR;
    event(sim, s, 'collapse', s.name + ' collapsed (' + why + ') and is dragging themselves back to camp.');
    say(sim, s, why === 'hunger' ? "Can't... think. Need food. Back to camp." : 'I need to get back to camp.', 'refuse');
    if (why === 'hunger') learnEvent(sim, s, 'skipMeal'); else learnEvent(sim, s, 'overwork');
    replaceTask(sim, s, makeTask(sim, s, 'persevere'));
  }
}

/* ------------------------------ movement ------------------------------ */
function moveAlong(sim, s, step, dt) {
  if (!step.path) {
    const to = step.toId != null ? sim.settlers[step.toId] : step.to;
    step.path = findPath(sim.nav, s, to) || null;
    step.pi = 0;
    if (!step.path) return 'fail';
  }
  const terrain = sim.nav.costAt(s.x, s.z);
  const mob = Math.max(0.45, Math.min(1, eff(s.m.energy) * 0.5 + 0.5) * Math.min(1, eff(s.m.health) * 0.6 + 0.4));
  let sp = (step.run ? 2.2 : 1) * WALK * mob / (Number.isFinite(terrain) ? terrain : 2.5) * (s.carry ? 0.85 : 1) * (s.persevere ? 0.5 : 1);
  if (isDark(sim)) sp *= 0.85;
  let left = sp * dt, moved = 0;
  while (left > 1e-6 && step.pi < step.path.length) {
    const q = step.path[step.pi], dx = q.x - s.x, dz = q.z - s.z, d = Math.hypot(dx, dz);
    if (d <= left) { s.x = q.x; s.z = q.z; left -= d; moved += d; step.pi++; }
    else { s.x += dx / d * left; s.z += dz / d * left; moved += left; left = 0; }
    if (d > 1e-4) s.yaw = Math.atan2(dz, dx);
  }
  s.speed = moved / dt;
  s.act = step.run ? 'run' : 'walk';
  if (step.pi >= step.path.length) { s.speed = 0; return 'done'; }
  return 'go';
}

/* ------------------------------ steps ------------------------------ */
function workRate(sim, s, st) {
  let r = 1;
  for (const k of st.meters || ['energy', 'health']) r *= eff(s.m[k]);
  r *= 0.85 + 0.15 * Math.min(1.2, eff(s.m.mood));
  if (st.attr) r *= 0.75 + 0.05 * (s.attrs[st.attr] - 10);
  if (st.tool) r *= toolEff(sim, st.tool);
  if (st.outdoor !== false && isDark(sim) && st.act !== 'sleep' && st.act !== 'collapsed') r *= 0.6;
  if (st.role && st.role !== s.role) r *= 0.75;
  if (st.slow) r *= st.slow;
  return Math.max(0.05, r);
}

function execStep(sim, s, dt) {
  const T = s.task, st = T.steps[T.i];
  if (!st) return 'done';
  if (st.do === 'go') {
    const r = moveAlong(sim, s, st, dt);
    if (r === 'fail') return 'fail';
    return r === 'done' ? 'next' : 'busy';
  }
  if (st.do === 'work') {
    s.speed = 0; s.act = st.act; if (st.face) s.yaw = Math.atan2(st.face.z - s.z, st.face.x - s.x);
    if (st.tool && sim.tools[st.tool].by !== s.id) {
      if (sim.tools[st.tool].by != null) { if (!st.optTool) return 'fail'; st.tool = null; st.slow = 0.6; }
      else sim.tools[st.tool].by = s.id;
    }
    if (!st.began) { st.began = sim.t; if (st.start && FX[st.start](sim, s, st, T) === false) return 'fail'; }
    const rate = workRate(sim, s, st);
    st.done = (st.done || 0) + dt * rate;
    if (st.each && FX[st.each](sim, s, st, T, dt, rate) === false) return 'fail';
    if (st.tool) sim.tools[st.tool].cond = Math.max(TUNE.toolFloor, sim.tools[st.tool].cond - TUNE.toolWear * dt / HOUR);
    if (st.heavy || HEAVY.has(st.act)) maybeInjure(sim, s, st, dt);
    const finished = st.until ? UNTIL[st.until](sim, s, st) : st.done >= st.mins * 60;
    if (finished) {
      if (st.tool && sim.tools[st.tool].by === s.id) sim.tools[st.tool].by = null;
      if (st.fx && FX[st.fx](sim, s, st, T) === false) return 'fail';
      return 'next';
    }
    return 'busy';
  }
  return 'next';
}

function maybeInjure(sim, s, st, dt) {
  const p = TUNE.injuryPerHour * dt / HOUR * (1 + 3 * (1 - Math.min(1, eff(s.m.energy))) + (isDark(sim) ? 2 : 0) + (s.attrs.DEX < 12 ? 0.3 : 0));
  if (sim.R.life.next() < p) {
    const dmg = 8 + sim.R.life.next() * 20;
    s.m.health = Math.max(0, s.m.health - dmg); s.stats.injuries++;
    event(sim, s, 'injury', s.name + ' was hurt while working (' + st.act + ', -' + dmg.toFixed(0) + ' health).');
    say(sim, s, s.m.energy < 30 ? 'Argh! My hands are shaking, I should have stopped.' : 'Ouch! That one hurt.', 'refuse');
    if (s.m.energy < 30) learnEvent(sim, s, 'overwork');
    if (isDark(sim)) learnEvent(sim, s, 'farAtDusk');
    if (st.tool && sim.tools[st.tool].cond < 65) learnEvent(sim, sim.settlers.find((x) => x.role === 'leader') || s, 'dullTools');
  }
}

export function dropCarry(sim, s) {
  if (!s.carry) return;
  if (s.carry.food) addFood(sim, s.carry.item, s.carry.n);
  else sim.piles.push({ id: sim.nextId++, x: s.x, z: s.z, item: s.carry.item, n: s.carry.n });
  s.carry = null;
}

function releaseTask(sim, s, T) {
  if (!T) return;
  for (const k in sim.tools) if (sim.tools[k].by === s.id) sim.tools[k].by = null;
  for (const k in sim.world.reserved) if (sim.world.reserved[k] === s.id) delete sim.world.reserved[k];
}

function runSettler(sim, s, dt) {
  if (!s.task) { think(sim, s); if (!s.task) return; }
  if (sim.tick % 30 === s.id % 30) checkInterrupts(sim, s);
  const r = execStep(sim, s, dt);
  if (r === 'next') { s.task.i++; if (s.task.i >= s.task.steps.length) { finishTask(sim, s, true); } }
  else if (r === 'fail') finishTask(sim, s, false);
  else if (r === 'done') finishTask(sim, s, true);
  else if (sim.t - s.task.started > 12 * HOUR && s.task.kind !== 'sleep' && s.task.kind !== 'collapse') {
    event(sim, s, 'abandon', s.name + ' gave up on "' + s.task.label + '" (too long).'); finishTask(sim, s, false);
  }
}
function finishTask(sim, s, ok) {
  const T = s.task;
  releaseTask(sim, s, T);
  if (!ok) { dropCarry(sim, s); if (T) event(sim, s, 'fail', null); }
  if (T && T.kind === 'sleep' || T && T.kind === 'collapse') { s.sleep = s.sleep ? { ...s.sleep, end: sim.t } : null; }
  if (T && T.kind === 'persevere') s.persevere = false;
  s.task = null; s.act = 'idle';
}
export function replaceTask(sim, s, T2) {
  if (s.task) { releaseTask(sim, s, s.task); dropCarry(sim, s); }
  s.task = T2; T2.started = sim.t;
}
export function preempt(sim, s, T2) {
  const T = s.task;
  if (T && T.kind !== 'collapse' && T.kind !== 'persevere') {
    releaseTask(sim, s, T);
    const st = T.steps[T.i]; if (st && st.do === 'go') st.path = null;
    if (!s.carry || T.keepCarry) s.plan.unshift(T); else { dropCarry(sim, s); }
  }
  s.task = T2; T2.started = sim.t;
}

/* ------------------------------ effects ------------------------------ */
const UNTIL = {
  rested(sim, s, st) {
    const h = hourOf(sim), cap = TUNE.sleep[s.sleep ? s.sleep.place : 'ground'][1];
    if (h >= TUNE.latestWake && h < 18) return true;
    if (h >= TUNE.wakeHour && h < 18 && s.m.energy >= Math.min(cap - 1, 60)) return true;
    const full = s.m.energy >= cap - 0.5, slept = s.sleep ? sim.t - s.sleep.start : 0;
    if (full && (slept >= 10 * HOUR || (h >= 4.5 && h < 18))) return true;
    return false;
  },
  recovered(sim, s) { return s.m.energy >= TUNE.sleep.wild[1] - 0.01; },
  napped(sim, s, st) { return st.done >= st.mins * 60 || s.m.energy >= 70; },
  siteDone(sim, s, st) { const x = site(sim, st.site); return !x || x.done || st.done >= st.mins * 60; },
  fixed(sim, s, st) { return TOOLS.every((k) => sim.tools[k].cond >= 98 || (sim.tools[k].by != null && sim.tools[k].by !== s.id)) || st.done >= st.mins * 60; },
};

export const FX = {
  sleepStart(sim, s, st) {
    const h = hourOf(sim);
    s.sleep = { place: st.place, slot: st.slot, start: sim.t, lateStart: h >= 23.25 || h < 4, startEnergy: s.m.energy };
    if (s.sleep.lateStart) s.exp.lateStarts = (s.exp.lateStarts || 0) + 1;
  },
  wake(sim, s) {
    const sl = s.sleep;
    if (sl && sl.lateStart && s.m.energy < 72) { event(sim, s, 'badnight', s.name + ' slept badly after a late night.'); say(sim, s, 'Ugh. Too late to bed again.', 'say'); learnEvent(sim, s, 'lateNight'); }
  },
  collapseStart(sim, s, st) { s.sleep = { place: 'wild', start: sim.t, lateStart: false, startEnergy: s.m.energy }; say(sim, s, 'Can’t... keep... going...', 'refuse'); },
  eat(sim, s) {
    let got = 0, hot = false;
    if (takeFood(sim, 'meal', 1)) { got = TUNE.meal; hot = true; }
    else if (takeFood(sim, 'dried', 1)) got = TUNE.meal;
    else { const b = takeFood(sim, 'berries', 4); got = b * TUNE.berry; if (!b) { const f = takeFood(sim, 'fish', 1); got = f * TUNE.rawFish; } }
    if (!got) { say(sim, s, 'Nothing to eat at camp.', 'refuse'); return; }
    s.m.hunger = Math.min(100, s.m.hunger + got); s.stats.meals++; s.ateAt = sim.t;
    // heading out for the day: pack a lunch if the store can spare it
    if (hourOf(sim) < 9.5 && !(s.packed > 0) && s.role !== 'leader' && foodCount(sim, 'meal') + foodCount(sim, 'dried') >= sim.settlers.length + 1) {
      if (takeFood(sim, 'meal', 1) || takeFood(sim, 'dried', 1)) s.packed = 1;
    }
    if (hot) s.ateHot = sim.t;
    for (const o of sim.settlers) if (o !== s && o.act === 'eat' && dist(o, s) < 8) { s.rel[o.id] = Math.min(100, s.rel[o.id] + 2); }
  },
  eatCarry(sim, s) {
    if (!s.carry || !s.carry.food) return;
    const per = s.carry.item === 'fish' ? TUNE.rawFish : TUNE.berry, k = Math.min(s.carry.n, s.carry.item === 'fish' ? 1 : 4);
    s.carry.n -= k; s.m.hunger = Math.min(100, s.m.hunger + k * per); s.stats.meals++; s.ateAt = sim.t;
    if (s.carry.n <= 0) s.carry = null;
  },
  eatPacked(sim, s) { if (s.packed > 0) { s.packed--; s.m.hunger = Math.min(100, s.m.hunger + TUNE.meal); s.stats.meals++; s.ateAt = sim.t; } },
  eatBerries(sim, s, st) {
    const b = sim.world.bushes[st.bush] ?? sim.isl.bushes[st.bush].berries;
    const k = Math.min(b, 4); sim.world.bushes[st.bush] = b - k;
    if (b - k <= 0) sim.world.bushes['r' + st.bush] = sim.t + TUNE.bushRegrowDays * DAYS;
    s.m.hunger = Math.min(100, s.m.hunger + k * TUNE.berry); if (k) s.stats.meals++;
  },
  pee(sim, s) { s.m.bladder = 100; s.stats.pee++; if (!built(sim, 'latrine')) s.m.mood = Math.max(0, s.m.mood - 1); },
  poo(sim, s) { s.m.bowel = 100; s.stats.poo++; if (!built(sim, 'latrine')) { s.m.mood = Math.max(0, s.m.mood - 2); s.m.clean = Math.max(0, s.m.clean - 3); } },
  bathe(sim, s, st) {
    const cap = st.pond ? 100 : 70;
    s.m.clean = Math.max(s.m.clean, Math.min(cap, s.m.clean + 70)); s.stats.baths++; s.bathT = sim.t;
    s.m.mood = Math.min(100, s.m.mood + (st.pond ? 8 : 3));
    if (st.pond) s.pondUntil = sim.t + 12 * HOUR;
  },
  fell(sim, s, st) {
    const tr = sim.isl.trees[st.tree];
    sim.world.felled[tr.id] = sim.t;
    delete sim.world.reserved['t' + tr.id];
    const n = 3, take = Math.min(n, carryCap(s, 'wood'));
    s.carry = { item: 'wood', n: take };
    if (n - take > 0) sim.piles.push({ id: sim.nextId++, x: tr.x + 1, z: tr.z, item: 'wood', n: n - take });
    event(sim, s, 'fell', null);
  },
  takeRock(sim, s, st) {
    const rk = sim.isl.rocks[st.rock], left = sim.world.rocks[rk.id] ?? rk.n;
    const take = Math.min(left, carryCap(s, 'stone'));
    sim.world.rocks[rk.id] = left - take; delete sim.world.reserved['r' + rk.id];
    s.carry = { item: 'stone', n: take };
  },
  pickPile(sim, s, st) {
    const p = sim.piles.find((x) => x.id === st.pile); if (!p) return false;
    const take = Math.min(p.n, carryCap(s, p.item)); p.n -= take; s.carry = { item: p.item, n: take };
    if (p.n <= 0) sim.piles = sim.piles.filter((x) => x !== p);
    delete sim.world.reserved['p' + p.id];
  },
  dropStock(sim, s) { if (s.carry && !s.carry.food) { sim.stock[s.carry.item] = (sim.stock[s.carry.item] || 0) + s.carry.n; s.carry = null; } },
  dropFood(sim, s) { if (s.carry && s.carry.food) { addFood(sim, s.carry.item, s.carry.n); s.carry = null; } },
  pickBerries(sim, s, st) {
    const b = sim.world.bushes[st.bush] ?? sim.isl.bushes[st.bush].berries;
    const k = Math.min(b, 4); sim.world.bushes[st.bush] = b - k;
    if (b - k <= 0) sim.world.bushes['r' + st.bush] = sim.t + TUNE.bushRegrowDays * DAYS;
    delete sim.world.reserved['b' + st.bush];
    if (s.carry && s.carry.item === 'berries') s.carry.n += k; else if (k) s.carry = { item: 'berries', n: k, food: true };
  },
  fishEach(sim, s, st, T, dt, rate) {
    if (sim.R.food.next() < TUNE.fishPerHour * dt / HOUR * rate) st.caught = (st.caught || 0) + 1;
  },
  fishDone(sim, s, st) {
    if (st.caught) { s.carry = { item: 'fish', n: st.caught, food: true }; event(sim, s, 'fish', s.name + ' caught ' + st.caught + ' fish.'); }
    else event(sim, s, 'fish', s.name + ' caught nothing.');
  },
  setTrap(sim, s, st) { sim.traps.push({ id: sim.nextId++, x: st.at.x, z: st.at.z, set: sim.t, catch: 0, owner: s.id }); },
  checkTrap(sim, s, st) {
    const tr = sim.traps.find((x) => x.id === st.trap); if (!tr) return;
    if (tr.catch) { if (s.carry && s.carry.item === 'meat') s.carry.n += tr.catch; else s.carry = { item: 'meat', n: tr.catch, food: true }; event(sim, s, 'trap', s.name + ' found a rabbit in a trap.'); tr.catch = 0; }
    tr.checked = sim.t;
  },
  cook(sim, s) {
    const meat = takeFood(sim, 'meat', 99), fish = takeFood(sim, 'fish', 99);
    const meals = meat * 2 + Math.floor(fish * 1.5);
    let ber = 0; if (meals < 4) { ber = takeFood(sim, 'berries', Math.floor(foodCount(sim, 'berries') / 3) * 3); }
    const total = meals + ber / 3;
    if (total) { addFood(sim, 'meal', total); event(sim, s, 'cook', s.name + ' cooked ' + total.toFixed(0) + ' meals.'); }
  },
  dryFood(sim, s) {
    const meat = takeFood(sim, 'meat', 4), fish = takeFood(sim, 'fish', 4);
    const n = meat * 2 + fish * 1.5; if (n) addFood(sim, 'dried', n);
  },
  takeStock(sim, s, st) {
    const x = site(sim, st.site); if (!x) return false;
    const item = st.item, want = Math.min(carryCap(s, item), x.need[item] - x.have[item], sim.stock[item]);
    if (want <= 0) return false;
    sim.stock[item] -= want; s.carry = { item, n: want };
  },
  toSite(sim, s, st) {
    const x = site(sim, st.site);
    if (!x || !s.carry) { dropCarry(sim, s); return; }
    const room = x.need[s.carry.item] - x.have[s.carry.item], put = Math.min(room, s.carry.n);
    x.have[s.carry.item] += put; s.carry.n -= put;
    if (s.carry.n > 0) sim.stock[s.carry.item] += s.carry.n;
    s.carry = null;
  },
  buildEach(sim, s, st, T, dt, rate) {
    const x = site(sim, st.site); if (!x || x.done) return;
    const frac = Math.min(x.have.wood / Math.max(1, x.need.wood), x.need.stone ? x.have.stone / x.need.stone : 1);
    const allowed = frac * x.hours + 1e-9;
    if (x.prog >= allowed) { st.done = st.mins * 60; return; }
    x.prog = Math.min(allowed, x.prog + dt * rate * (s.role === 'architect' ? 1 : 0.6) / HOUR);
    if (x.prog >= x.hours - 1e-9) completeSite(sim, x, s);
  },
  rest(sim, s) { s.m.mood = Math.min(100, s.m.mood + 4); },
  restEach(sim, s, st, T, dt) { s.m.energy = Math.min(85, s.m.energy + 3 * dt / HOUR); },
  cheer(sim, s, st) {
    const o = sim.settlers[st.toId]; if (!o) return;
    const lift = 6 + (s.attrs.CHA - 10) * 1.2;
    o.m.mood = Math.min(100, o.m.mood + lift); o.cheerUntil = sim.t + 8 * HOUR;
    o.rel[s.id] = Math.min(100, (o.rel[s.id] || 50) + 5); s.rel[o.id] = Math.min(100, (s.rel[o.id] || 50) + 3);
    event(sim, s, 'cheer', s.name + ' talked things through with ' + o.name + '.');
  },
  fixEach(sim, s, st, T, dt, rate) {
    const k = TOOLS.filter((t) => sim.tools[t].by == null || sim.tools[t].by === s.id).sort((a, b) => sim.tools[a].cond - sim.tools[b].cond)[0];
    if (k) sim.tools[k].cond = Math.min(100, sim.tools[k].cond + TUNE.toolFix * rate * dt / HOUR);
  },
  look(sim, s) { discover(sim, s); },
  idle() {},
};

export function carryCap(s, item) { return (TUNE.carry[item] || 4) + (item === 'wood' && s.attrs.STR >= 15 ? 1 : 0) + (item === 'stone' && s.attrs.STR >= 15 ? 1 : 0); }

export function completeSite(sim, x, s) {
  x.done = true; x.prog = x.hours; x.doneT = sim.t;
  event(sim, s, 'built', (BUILDINGS[x.type].label) + ' finished.');
  say(sim, s, BUILDINGS[x.type].label + ' is done!', 'say');
  if (x.type === 'foodstore') for (const b of sim.food) b.exp = Math.max(b.exp, b.exp + (TUNE.spoilStored[b.kind] - TUNE.spoil[b.kind]) * DAYS);
  for (const o of sim.settlers) o.m.mood = Math.min(100, o.m.mood + 2);
}

/* ------------------------------ the world ticking ------------------------------ */
// Each evening a settler looks back on the day: a meter that fell out of the normal
// range (below 50) is a chance to learn the habit that would have kept it there.
const REVIEW = { energy: 'lateNight', hunger: 'skipMeal', clean: 'hygiene', health: 'overwork' };
function nightlyReview(sim) {
  for (const s of sim.settlers) {
    for (const k in REVIEW) if (s.dayMin && s.dayMin[k] < 50) learnEvent(sim, s, REVIEW[k]);
    s.dayMin = {};
  }
}
function worldHourly(sim) {
  if (Math.abs(hourOf(sim) - 21) < 1e-6) nightlyReview(sim);
  // spoilage
  const before = mealUnits(sim);
  sim.food = sim.food.filter((b) => b.exp > sim.t);
  const lost = before - mealUnits(sim);
  if (lost > 0.5) event(sim, null, 'spoil', lost.toFixed(1) + ' meals worth of food spoiled.');
  // bushes regrow
  for (const k in sim.world.bushes) if (k[0] === 'r' && sim.world.bushes[k] <= sim.t) { const id = +k.slice(1); delete sim.world.bushes[k]; sim.world.bushes[id] = sim.isl.bushes[id].berries; }
  // traps catch
  for (const tr of sim.traps) if (!tr.catch && sim.R.food.next() < TUNE.trapCatchPerDay / 24 * trapRichness(sim, tr)) tr.catch = 1;
}
function trapRichness(sim, tr) {
  const d = Math.hypot(tr.x - sim.isl.camp.x, tr.z - sim.isl.camp.z);
  const crowd = sim.traps.filter((o) => o !== tr && Math.hypot(o.x - tr.x, o.z - tr.z) < 40).length;
  return Math.min(1.4, 0.4 + d / 200) / (1 + crowd * 0.5);
}
export function discover(sim, s) {
  const isl = sim.isl;
  if (!sim.discovered.pond && Math.hypot(s.x - isl.pond.x, s.z - isl.pond.z) < 48) {
    sim.discovered.pond = sim.t;
    event(sim, s, 'discover', s.name + ' found a waterfall falling into a clear pond. Fresh water, and safe to swim.');
    say(sim, s, 'A waterfall! And a pond you could swim in!', 'say');
    s.m.mood = Math.min(100, s.m.mood + 15);
  }
}
function markSeen(sim, s) {
  const k = Math.floor(s.x / 16) + ',' + Math.floor(s.z / 16);
  if (!sim.seen[k]) sim.seen[k] = 1;
}

function social(sim) {
  const S = sim.settlers;
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const a = S[i], b = S[j];
    if (a.act === 'sleep' || b.act === 'sleep') continue;
    if (dist(a, b) < 15) { a.rel[b.id] = Math.min(100, a.rel[b.id] + 0.5 / 60); b.rel[a.id] = Math.min(100, b.rel[a.id] + 0.5 / 60); }
  }
}

function phase1Check(sim) {
  if (sim.phase1) return;
  const builtAll = PHASE1_BUILDS.every((b) => built(sim, b)) && sim.sites.filter((x) => x.type === 'bed' && x.done).length >= 5;
  const food = mealUnits(sim) >= foodTarget(sim);
  const ok = sim.settlers.every((s) => ['health', 'energy', 'hunger', 'mood', 'clean'].every((k) => s.m[k] >= 50));
  if (!ok) {
    sim.okSince = null;
    if (builtAll) { const b = sim.settlers.flatMap((s) => ['health', 'energy', 'hunger', 'mood', 'clean'].filter((k) => s.m[k] < 50).map((k) => s.name + ' ' + k)); sim.breakers = sim.breakers || {}; for (const k of b) sim.breakers[k] = (sim.breakers[k] || 0) + 1; }
  } else if (sim.okSince == null) sim.okSince = sim.t;
  sim.p1 = { builtAll, food, okHours: sim.okSince == null ? 0 : (sim.t - sim.okSince) / HOUR };
  if (builtAll && food && sim.okSince != null && sim.t - sim.okSince >= 48 * HOUR) {
    sim.phase1 = { done: true, t: sim.t, day: dayOf(sim) };
    event(sim, null, 'phase1', 'Phase 1 complete: the camp can take a fifth settler.');
  }
}

/* ------------------------------ the tick ------------------------------ */
export function step(sim) {
  sim.tick++; sim.t += TICK;
  for (const s of sim.settlers) drain(sim, s, TICK);
  for (const s of sim.settlers) runSettler(sim, s, TICK);
  if (sim.tick % 6 === 0) { social(sim); for (const s of sim.settlers) { markSeen(sim, s); discover(sim, s); } }
  if (sim.tick % 60 === 0) leaderTick(sim);
  if (sim.tick % 360 === 0) { worldHourly(sim); phase1Check(sim); }
  // the hour as ticks: pin any player input to the tick it arrived on
}
export function runFor(sim, secs) { const n = Math.round(secs / TICK); for (let i = 0; i < n; i++) step(sim); }

export function applyInput(sim, input) {
  const rec = { ...input, tick: sim.tick };
  sim.inputs.push(rec);
  return applyPlayerInput(sim, rec);
}
export function assignTask(sim, s, kind, opts = {}) {
  const T = makeTask(sim, s, kind, opts);
  if (!T) return null;
  if (opts.pinned) T.pinned = true;
  preempt(sim, s, T);
  return T;
}

// Re-run a game from its seed, applying each recorded input on the tick it arrived.
export function replay(seed, inputs, toTick) {
  const sim = createSim(seed);
  let k = 0;
  while (sim.tick < toTick || (k < inputs.length && inputs[k].tick <= sim.tick)) {
    while (k < inputs.length && inputs[k].tick === sim.tick) { const rec = inputs[k++]; sim.inputs.push(rec); applyPlayerInput(sim, rec); }
    if (sim.tick >= toTick) break;
    step(sim);
  }
  return sim;
}

/* ------------------------------ save / load ------------------------------ */
export function snapshot(sim) {
  const o = {};
  for (const k in sim) if (k !== 'isl' && k !== 'nav' && k !== 'lay' && k !== 'R') o[k] = sim[k];
  o.R = {}; for (const k in sim.R) o.R[k] = sim.R[k].save();
  return JSON.parse(JSON.stringify(o));
}
export function restore(snap) {
  const sim = createSim(snap.seed);
  for (const k in snap) if (k !== 'R') sim[k] = snap[k];
  for (const k in snap.R) sim.R[k].load(snap.R[k]);
  for (const s of sim.settlers) s.look = FOUNDERS[s.id] ? FOUNDERS[s.id].look : s.look;
  return sim;
}
export function simHash(sim) { return hashState(snapshot(sim)); }
