// brain.js — what each settler decides to do: their needs, the leader's assignments,
// lessons learned by trial and error, refusals, and the player's orders (controls A and B).
import { TUNE, BUILDINGS, GOALS, LESSONS, REFUSALS, LEARNED, TOOLS, hhmm } from './data.js';
import { nearestPassable } from './nav.js';
import { COVER, coverAt } from './island.js';
import { hourOf, dayOf, event, say, site, built, goalDone, goalOpen, mealUnits, foodTarget, foodCount, preempt, carryCap, dropCarry } from './sim.js';

const HOUR = 3600, DAYS = 86400;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ------------------------------ lessons ------------------------------ */
export function lessonParam(s, key) { return s.lessons[key] ? s.lessons[key].v : LESSONS[key].start; }
export const learned = (s, key) => !!s.lessons[key];
export function learnChance(s) { return clamp(0.15 + 0.04 * ((s.attrs.INT + s.attrs.WIS) / 2 - 10), 0.1, 0.6); }
export function learnEvent(sim, s, key) {
  const L = LESSONS[key]; if (!L) return false;
  s.exp[key] = (s.exp[key] || 0) + 1;
  if (sim.R.learn.next() >= learnChance(s)) return false;
  const cur = lessonParam(s, key), v = cur + 0.6 * (L.target - cur);
  const first = !s.lessons[key];
  s.lessons[key] = { v, times: (s.lessons[key] ? s.lessons[key].times : 0) + 1, day: dayOf(sim) };
  s.stats.learned++;
  event(sim, s, 'learn', s.name + (first ? ' learned: ' : ' refined: ') + L.label + ' (' + L.fmt(v) + ').');
  if (first) say(sim, s, LEARNED[key], 'learn');
  return true;
}

/* ------------------------------ needs ------------------------------ */
// Returns the most pressing need: {kind, urgent, lesson}. Urgent needs interrupt work.
export function needOf(sim, s, softToo = true) {
  const m = s.m, h = hourOf(sim), delayed = (k) => s.delay && s.delay[k] > sim.t;
  if (m.bladder < TUNE.peeAt) return { kind: 'pee', urgent: true };
  if (m.bowel < TUNE.pooAt) return { kind: 'poo', urgent: true };
  if (m.energy < lessonParam(s, 'overwork')) return { kind: 'sleep', urgent: true, lesson: 'overwork', why: 'energy' };
  if (m.hunger < lessonParam(s, 'skipMeal')) return { kind: 'eat', urgent: true, lesson: 'skipMeal' };
  if (!softToo) return null;
  const bed = lessonParam(s, 'lateNight');
  if ((h >= bed || h < 4.5) && !delayed('sleep')) return { kind: 'sleep', urgent: false, lesson: 'lateNight', why: 'bedtime' };
  const meal = (h >= 6.8 && h < 8.2) || (h >= 18.7 && h < 20.2) || (h >= 12.2 && h < 13 && m.hunger < 55);
  if (meal && m.hunger < 72 && mealUnits(sim) >= 1 && dist(s, sim.lay.fire) < 120 && !delayed('eat')) return { kind: 'eat', urgent: false, lesson: 'skipMeal' };
  if (m.clean < lessonParam(s, 'hygiene') && h > 7 && h < 18 && !delayed('bathe')) return { kind: 'bathe', urgent: false, lesson: 'hygiene' };
  if ((m.mood < 32 || m.health < 35) && !delayed('rest')) return { kind: 'rest', urgent: false };
  return null;
}
const NEED_KINDS = new Set(['pee', 'poo', 'sleep', 'eat', 'bathe', 'rest', 'collapse', 'persevere', 'home']);

export function think(sim, s) {
  const n = needOf(sim, s);
  let T = null;
  if (n) T = makeTask(sim, s, n.kind, { need: n });
  if (!T) {
    while (s.plan.length && !T) {
      const it = s.plan[0];
      if (it.steps) { T = s.plan.shift(); break; }                       // a preempted task resumes
      if (it.owner === 'player' || it.pinned) { s.plan.shift(); T = makeTask(sim, s, it.kind, it.opts || {}); if (T) { T.pinned = !!it.pinned; T.owner = 'player'; } continue; }
      break;
    }
  }
  if (!T) { const k = nextWork(sim, s); if (k) T = makeTask(sim, s, k.kind, k.opts || {}); }
  if (!T) T = makeTask(sim, s, 'idle');
  T.started = sim.t; s.task = T;
  forecast(sim, s);
}

// Keep a short "what I plan to do next" list: the player's own items stay put, the leader's are refreshed.
function forecast(sim, s) {
  s.plan = s.plan.filter((it) => it.steps || it.owner === 'player' || it.pinned);
  const k1 = nextWork(sim, s, { dry: true, skip: s.task && s.task.kind });
  if (k1) s.plan.push({ id: sim.nextId++, kind: k1.kind, label: LABEL[k1.kind] || k1.kind, owner: 'leader', opts: k1.opts });
  const k2 = nextWork(sim, s, { dry: true, skip: k1 && k1.kind, skip2: s.task && s.task.kind });
  if (k2 && (!k1 || k2.kind !== k1.kind)) s.plan.push({ id: sim.nextId++, kind: k2.kind, label: LABEL[k2.kind] || k2.kind, owner: 'leader', opts: k2.opts });
  if (s.plan.length > 8) s.plan.length = 8;
}

// Called every 5 game minutes: urgent needs interrupt work, unless the player pinned it.
export function checkInterrupts(sim, s) {
  const T = s.task; if (!T || NEED_KINDS.has(T.kind)) return;
  // out late, far from camp
  if (dist(s, sim.lay.fire) > 110 && hourOf(sim) >= lessonParam(s, 'farAtDusk') && hourOf(sim) < 23 && !T.pinned && T.kind !== 'explore') {
    if (T.kind === 'explore' && !learned(s, 'farAtDusk')) return;
    preempt(sim, s, makeTask(sim, s, 'home')); return;
  }
  const n = needOf(sim, s, false);
  if (!n) return;
  if (T.pinned) {
    if (n.lesson && learned(s, n.lesson)) { refuse(sim, s, n.lesson); T.pinned = false; preempt(sim, s, makeTask(sim, s, n.kind, { need: n })); }
    return;                                                    // obeying the player: pushing through
  }
  preempt(sim, s, makeTask(sim, s, n.kind, { need: n }));
}

function refuse(sim, s, key) {
  s.stats.refusals++;
  say(sim, s, REFUSALS[key], 'refuse');
  event(sim, s, 'refuse', s.name + ' refused: ' + REFUSALS[key]);
}

/* ------------------------------ the leader ------------------------------ */
// Sites for the first open build goals, in the order of the goals board.
function ensureSites(sim) {
  let opened = 0;
  for (const g of sim.goals) {
    const G = GOALS[g]; if (!G || G.food || goalDone(sim, g)) continue;
    if (!goalOpen(sim, g)) continue;
    const have = sim.sites.filter((x) => x.goal === g);
    const want = {}; for (const b of G.builds) want[b] = (want[b] || 0) + 1;
    for (const b in want) {
      let n = have.filter((x) => x.type === b).length;
      while (n < want[b]) {
        const B = BUILDINGS[b];
        let pos;
        if (b === 'bed') { const used = sim.sites.filter((x) => x.type === 'bed').length; pos = sim.lay.beds[used % sim.lay.beds.length]; }
        else pos = sim.lay.slots[b];
        sim.sites.push({ id: sim.nextId++, type: b, goal: g, x: pos.x, z: pos.z, yaw: pos.yaw, need: { ...B.cost }, have: { wood: 0, stone: 0 }, prog: 0, hours: B.hours, done: false });
        n++;
      }
    }
    if (++opened >= 2) break;
  }
}
export const activeSites = (sim) => sim.sites.filter((x) => !x.done).sort((a, b) => sim.goals.indexOf(a.goal) - sim.goals.indexOf(b.goal));
function shortfall(sim) {
  const act = activeSites(sim);
  const need = { wood: 0, stone: 0 };
  for (const x of act) { need.wood += x.need.wood - x.have.wood; need.stone += x.need.stone - x.have.stone; }
  // look one goal ahead so the gatherer is never idle at a hand-over
  const next = sim.goals.find((g) => GOALS[g] && !GOALS[g].food && !goalDone(sim, g) && !sim.sites.some((x) => x.goal === g));
  if (next) for (const b of GOALS[next].builds) { need.wood += BUILDINGS[b].cost.wood; need.stone += BUILDINGS[b].cost.stone; }
  const piles = sim.piles.reduce((a, p) => { a[p.item] = (a[p.item] || 0) + p.n; return a; }, {});
  return { wood: need.wood - sim.stock.wood - (piles.wood || 0), stone: need.stone - sim.stock.stone - (piles.stone || 0) };
}
export function leaderTick(sim) {
  ensureSites(sim);
  for (const s of sim.settlers) if (s.delay) for (const k in s.delay) if (s.delay[k] <= sim.t) delete s.delay[k];
}

export const buildable = (sim) => activeSites(sim).filter((x) => {
  const frac = Math.min(x.have.wood / Math.max(1, x.need.wood), x.need.stone ? x.have.stone / x.need.stone : 1);
  return frac * x.hours > x.prog + 0.05;
});
const deliverable = (sim) => activeSites(sim).find((x) => (x.need.wood > x.have.wood && sim.stock.wood > 0) || (x.need.stone > x.have.stone && sim.stock.stone > 0));
const toolFree = (sim, k, s) => sim.tools[k].by == null || sim.tools[k].by === s.id;
const anyPile = (sim) => sim.piles.some((p) => !sim.world.reserved['p' + p.id]);
const trapsReady = (sim) => sim.traps.some((t) => t.catch || sim.t - (t.checked || t.set) > 20 * HOUR);
const rawFood = (sim) => foodCount(sim, 'meat') + foodCount(sim, 'fish');

export function nextWork(sim, s, o = {}) {
  const skip = (k) => o.skip === k || o.skip2 === k;
  const sh = shortfall(sim), food = mealUnits(sim), target = foodTarget(sim), h = hourOf(sim), N = sim.settlers.length;
  const B = buildable(sim), D = deliverable(sim);
  const pick = (...opts) => { for (const [cond, kind] of opts) if (cond && !skip(kind)) return { kind }; return null; };
  const foodJob = () => {
    if (trapsReady(sim)) return 'checktraps';
    if (sim.traps.length < 4) return 'trap';
    if (toolFree(sim, 'spear', s) && h < 17.5) return 'fish';
    return 'forage';
  };
  const lowTool = TOOLS.some((k) => sim.tools[k].cond < Math.max(55, lessonParam(s, 'dullTools')));
  if (s.role === 'leader') {
    const sad = sim.settlers.find((o2) => o2 !== s && o2.m.mood < 50 && o2.act !== 'sleep');
    return pick(
      [((h >= 6 && h < 7.5) || (h >= 17.6 && h < 19.2) || (h >= 11.5 && h < 12.3)) && (rawFood(sim) > 0 || (foodCount(sim, 'meal') < N && foodCount(sim, 'berries') >= 3)), 'cook'],
      [built(sim, 'dryrack') && rawFood(sim) > 2 && foodCount(sim, 'meal') >= N * 2, 'dry'],
      [sad && s.m.mood > 55, 'cheer'],
      [s.m.mood < 70 && h > 14, 'rest'],
      [built(sim, 'toolbench') && lowTool, 'maintain'],
      [anyPile(sim), 'tidy'],
      [D, 'deliver'],
      [B.length && !sim.settlers.some((o2) => o2.role === 'architect' && o2.task && o2.task.kind === 'build' && o2.task.site === B[0].id) , 'build'],
      [food < target * 0.6, 'forage'],
      [sh.stone > 0, 'gather'],
      [true, 'rest'],
    );
  }
  if (s.role === 'hunter') {
    const explore = !sim.discovered.pond && food >= N * 4 && h >= 6 && h < 8.5 && dayOf(sim) >= 2;
    return pick(
      [explore, 'explore'],
      [food < target + 4, foodJob()],
      [sh.stone > 0, 'gather'],
      [D, 'deliver'],
      [sh.wood > 0 && toolFree(sim, 'axe', s), 'chop'],
      [B.length, 'build'],
      [true, foodJob()],
    );
  }
  if (s.role === 'gatherer') {
    return pick(
      [sh.wood > 0 && toolFree(sim, 'axe', s), 'chop'],
      [sh.stone > 0, 'gather'],
      [anyPile(sim), 'tidy'],
      [D, 'deliver'],
      [B.length, 'build'],
      [sim.stock.wood < 12 && toolFree(sim, 'axe', s), 'chop'],
      [food < target, foodJob()],
      [true, 'gather'],
    );
  }
  // architect
  return pick(
    [B.length, 'build'],
    [D, 'deliver'],
    [built(sim, 'toolbench') && lowTool, 'maintain'],
    [sh.stone > 0, 'gather'],
    [anyPile(sim), 'tidy'],
    [sh.wood > 0 && toolFree(sim, 'axe', s), 'chop'],
    [food < target * 0.7, 'forage'],
    [true, 'rest'],
  );
}

/* ------------------------------ tasks ------------------------------ */
export const LABEL = {
  sleep: 'Sleep', collapse: 'Collapsed', persevere: 'Get back to camp', eat: 'Eat', pee: 'Pee', poo: 'Bathroom',
  bathe: 'Wash', rest: 'Rest by the fire', chop: 'Chop a tree', gather: 'Gather stone', forage: 'Forage berries',
  fish: 'Fish from the shore', trap: 'Set a snare', checktraps: 'Check the snares', cook: 'Cook', dry: 'Dry meat and fish',
  deliver: 'Bring materials to a build', build: 'Build', tidy: 'Tidy up loose materials', cheer: 'Talk with someone',
  maintain: 'Sharpen the tools', explore: 'Scout inland', home: 'Head back to camp', idle: 'Take a breather',
};
const go = (to, label, extra) => ({ do: 'go', to: { x: to.x, z: to.z }, label, ...extra });
const work = (act, mins, label, extra) => ({ do: 'work', act, mins, label, ...extra });
const nearest = (arr, p, ok) => { let best = null, bd = 1e9; for (const o of arr) { if (!ok(o)) continue; const d = dist(o, p); if (d < bd) { bd = d; best = o; } } return best; };

function sleepSpot(sim, s) {
  const lay = sim.lay;
  const beds = sim.sites.filter((x) => x.type === 'bed' && x.done);
  if (s.bed != null && !beds.some((b) => b.id === s.bed)) s.bed = null;
  if (s.bed == null) { const taken = new Set(sim.settlers.map((o) => o.bed)); const b = beds.find((x) => !taken.has(x.id)); if (b) s.bed = b.id; }
  if (s.bed != null) { const b = site(sim, s.bed); return { at: b, place: 'bed' }; }
  for (const hk of ['hut1', 'hut2']) {
    const hut = sim.sites.find((x) => x.type === hk && x.done);
    if (!hut) continue;
    const users = sim.settlers.filter((o) => o !== s && o.sleep && o.sleep.slot === hk && o.act === 'sleep').length;
    if (users < BUILDINGS[hk].sleeps) { const k = sim.settlers.indexOf(s); return { at: { x: hut.x + Math.cos(k * 1.7) * 1.2, z: hut.z + Math.sin(k * 1.7) * 1.2 }, place: 'hut', slot: hk }; }
  }
  const lean = sim.sites.find((x) => x.type === 'leanto' && x.done);
  if (lean) { const k = sim.settlers.indexOf(s); return { at: sim.lay.at(BUILDINGS.leanto.f + 0.3, BUILDINGS.leanto.r - 1.8 + k * 1.2), place: 'leanto', slot: 'leanto' }; }
  return { at: lay.ground[sim.settlers.indexOf(s) % lay.ground.length], place: 'ground', slot: 'ground' };
}
function bathroomSpot(sim, s) {
  const lat = sim.sites.find((x) => x.type === 'latrine' && x.done);
  if (dist(s, sim.lay.fire) < 70) {
    if (lat) return lat;
    return nearestPassable(sim.nav, sim.lay.at(26 + (s.id % 2) * 4, -24 + s.id * 14));
  }
  return nearestPassable(sim.nav, { x: s.x + 7 * Math.cos(s.id * 2.1), z: s.z + 7 * Math.sin(s.id * 2.1) });
}

export function makeTask(sim, s, kind, opts = {}) {
  const lay = sim.lay, fire = lay.fire, seat = lay.seats[sim.settlers.indexOf(s) % lay.seats.length];
  const T = { id: sim.nextId++, kind, label: LABEL[kind] || kind, steps: [], i: 0, started: sim.t, owner: opts.owner || 'self' };
  const S = T.steps;
  switch (kind) {
    case 'sleep': {
      const sp = sleepSpot(sim, s);
      T.label = sp.place === 'bed' ? 'Sleep in bed' : sp.place === 'hut' ? 'Sleep in the hut' : sp.place === 'leanto' ? 'Sleep under the lean-to' : 'Sleep by the fire';
      S.push(go(sp.at, 'walk to bed'), work('sleep', 480, 'sleep', { place: sp.place, slot: sp.slot, start: 'sleepStart', until: 'rested', fx: 'wake', outdoor: false, meters: [] }));
      break;
    }
    case 'collapse':
      S.push(work('collapsed', 600, 'out cold', { start: 'collapseStart', until: 'recovered', outdoor: false, meters: [] }));
      break;
    case 'persevere':
      S.push(go(fire, 'drag themselves home'), work('sit', 60, 'recover at the fire', { each: 'restEach', fx: 'rest', outdoor: false, meters: [] }));
      if (s.m.hunger < 30) S.push(work('eat', 25, 'eat', { fx: 'eat', outdoor: false, meters: [] }));
      break;
    case 'home':
      S.push(go(fire, 'walk back to camp'));
      break;
    case 'eat': {
      if (mealUnits(sim) >= 0.34 && dist(s, fire) < 150) {
        S.push(go(seat, 'walk to the fire'), work('eat', 25, 'eat', { fx: 'eat', outdoor: false, meters: [] }));
      } else {
        const bush = nearest(sim.isl.bushes, s, (b) => (sim.world.bushes[b.id] ?? b.berries) >= 2 && !sim.world.reserved['b' + b.id]);
        if (!bush) return null;
        T.label = 'Eat berries off a bush';
        S.push(go(nearestPassable(sim.nav, bush), 'walk to a berry bush'), work('forage', 15, 'eat berries', { fx: 'eatBerries', bush: bush.id, face: bush, meters: [] }));
      }
      break;
    }
    case 'pee': case 'poo': {
      const sp = bathroomSpot(sim, s);
      S.push(go(sp, kind === 'pee' ? 'find a private spot' : 'head for the latrine'), work('squat', kind === 'pee' ? 3 : 8, kind, { fx: kind, outdoor: false, meters: [] }));
      break;
    }
    case 'bathe': {
      S.push(go(lay.bath, 'walk down to the sea'), work('bathe', 30, 'wash in the sea', { fx: 'bathe', outdoor: false, meters: [] }), go(fire, 'walk back up'));
      break;
    }
    case 'rest':
      S.push(go(seat, 'walk to the fire'), work('sit', 45, 'sit and rest', { each: 'restEach', fx: 'rest', outdoor: false, meters: [] }));
      break;
    case 'idle':
      S.push(go(seat, 'wander to the fire'), work('sit', 10, 'catch their breath', { fx: 'idle', outdoor: false, meters: [] }));
      break;
    case 'chop': {
      if (!toolFree(sim, 'axe', s)) return null;
      const tr = nearest(sim.isl.trees, lay.pile, (t) => !sim.world.felled[t.id] && !sim.world.reserved['t' + t.id] && dist(t, fire) < 160);
      if (!tr) return null;
      sim.world.reserved['t' + tr.id] = s.id;
      const stand = nearestPassable(sim.nav, { x: tr.x - 1.3, z: tr.z + 0.4 });
      S.push(go(stand, 'walk to a tree'), work('chop', 40, 'chop it down', { tool: 'axe', attr: 'STR', fx: 'fell', tree: tr.id, face: tr, heavy: true, role: 'gatherer' }),
        go(lay.pile, 'carry logs to storage'), work('drop', 1, 'stack them', { fx: 'dropStock', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'gather': {
      const big = toolFree(sim, 'pick', s);
      const rk = nearest(sim.isl.rocks, lay.pile, (r) => (sim.world.rocks[r.id] ?? r.n) > 0 && !sim.world.reserved['r' + r.id] && (big || r.s <= 0.5) && dist(r, fire) < 220);
      if (!rk) return null;
      sim.world.reserved['r' + rk.id] = s.id;
      const mine = rk.s > 0.5;
      S.push(go(nearestPassable(sim.nav, { x: rk.x - 0.9, z: rk.z }), 'walk to loose rock'),
        work(mine ? 'mine' : 'pick', mine ? 22 : 9, mine ? 'break stone off' : 'pick up stones', { tool: mine ? 'pick' : null, attr: 'STR', fx: 'takeRock', rock: rk.id, face: rk, heavy: true, role: 'gatherer' }),
        go(lay.pile, 'carry stone to storage'), work('drop', 1, 'stack it', { fx: 'dropStock', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'tidy': {
      const p = nearest(sim.piles, s, (q) => !sim.world.reserved['p' + q.id]);
      if (!p) return null;
      sim.world.reserved['p' + p.id] = s.id;
      S.push(go(p, 'walk to loose ' + p.item), work('pick', 1, 'pick it up', { fx: 'pickPile', pile: p.id, outdoor: false, meters: [] }),
        go(lay.pile, 'carry it to storage'), work('drop', 1, 'stack it', { fx: 'dropStock', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'forage': {
      const bush = nearest(sim.isl.bushes, fire, (b) => (sim.world.bushes[b.id] ?? b.berries) >= 2 && !sim.world.reserved['b' + b.id] && dist(b, fire) < 260);
      if (!bush) return null;
      sim.world.reserved['b' + bush.id] = s.id;
      S.push(go(nearestPassable(sim.nav, bush), 'walk to a berry bush'), work('forage', 20, 'pick berries', { tool: toolFree(sim, 'knife', s) ? 'knife' : null, optTool: true, attr: 'DEX', fx: 'pickBerries', bush: bush.id, face: bush, role: 'hunter' }),
        go(lay.food, 'carry them to the food store'), work('drop', 1, 'store them', { fx: 'dropFood', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'fish': {
      if (!toolFree(sim, 'spear', s)) return null;
      const spots = lay.fishing.slice().sort((a, b) => dist(a, fire) - dist(b, fire));
      const sp = spots[(sim.tick >> 6) % Math.min(3, spots.length)] || lay.bath;
      S.push(go(nearestPassable(sim.nav, sp), 'walk to the shore'), work('fish', 75, 'fish with the spear', { tool: 'spear', attr: 'DEX', each: 'fishEach', fx: 'fishDone', face: { x: sp.x + (sp.x - fire.x), z: sp.z + (sp.z - fire.z) }, role: 'hunter' }),
        go(lay.food, 'carry the catch home'), work('drop', 1, 'store it', { fx: 'dropFood', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'trap': {
      const near = (p) => sim.traps.some((t) => dist(t, p) < 45);
      const tr = nearest(sim.isl.trees, fire, (t) => dist(t, fire) > 70 && dist(t, fire) < 220 && !near(t) && coverAt(sim.isl, t.x, t.z) === COVER.FOREST);
      if (!tr) return null;
      const at = nearestPassable(sim.nav, { x: tr.x + 1.6, z: tr.z });
      S.push(go(at, 'walk into the woods'), work('trap', 30, 'set a snare', { tool: toolFree(sim, 'knife', s) ? 'knife' : null, optTool: true, attr: 'DEX', fx: 'setTrap', at, face: tr, role: 'hunter' }));
      break;
    }
    case 'checktraps': {
      const list = sim.traps.filter((t) => t.catch || sim.t - (t.checked || t.set) > 20 * HOUR).sort((a, b) => dist(a, fire) - dist(b, fire)).slice(0, 4);
      if (!list.length) return null;
      for (const t of list) S.push(go(t, 'walk to a snare'), work('trap', 6, 'check the snare', { fx: 'checkTrap', trap: t.id, attr: 'DEX', role: 'hunter' }));
      S.push(go(lay.food, 'carry any catch home'), work('drop', 1, 'store it', { fx: 'dropFood', outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'cook':
      S.push(go(seat, 'walk to the fire'), work('cook', 35, 'cook a meal', { fx: 'cook', tool: toolFree(sim, 'knife', s) ? 'knife' : null, optTool: true, outdoor: false, meters: ['energy'] }));
      break;
    case 'dry': {
      const r = sim.sites.find((x) => x.type === 'dryrack' && x.done); if (!r) return null;
      S.push(go(r, 'walk to the drying rack'), work('cook', 25, 'hang meat and fish to dry', { fx: 'dryFood', outdoor: false, meters: [] }));
      break;
    }
    case 'deliver': {
      const x = activeSites(sim).find((q) => (q.need.wood > q.have.wood && sim.stock.wood > 0) || (q.need.stone > q.have.stone && sim.stock.stone > 0));
      if (!x) return null;
      const item = x.need.wood > x.have.wood && sim.stock.wood > 0 ? 'wood' : 'stone';
      T.site = x.id; T.label = 'Bring ' + item + ' to the ' + BUILDINGS[x.type].label.toLowerCase();
      S.push(go(lay.pile, 'walk to storage'), work('pick', 1, 'load up ' + item, { fx: 'takeStock', site: x.id, item, outdoor: false, meters: [] }),
        go(x, 'carry it to the site'), work('drop', 1, 'set it down', { fx: 'toSite', site: x.id, outdoor: false, meters: [] }));
      T.keepCarry = true;
      break;
    }
    case 'build': {
      const x = (opts.site && site(sim, opts.site)) || buildable(sim)[0];
      if (!x || x.done) return null;
      T.site = x.id; T.label = 'Build the ' + BUILDINGS[x.type].label.toLowerCase();
      S.push(go(nearestPassable(sim.nav, { x: x.x + 1.5, z: x.z + 1.5 }), 'walk to the site'),
        work('build', 90, 'build', { tool: toolFree(sim, 'hammer', s) ? 'hammer' : null, optTool: true, attr: 'DEX', each: 'buildEach', until: 'siteDone', site: x.id, face: x, heavy: true, role: 'architect' }));
      break;
    }
    case 'cheer': {
      const o = sim.settlers.filter((q) => q !== s && q.act !== 'sleep' && q.act !== 'collapsed').sort((a, b) => a.m.mood - b.m.mood)[0];
      if (!o) return null;
      T.label = 'Talk with ' + o.name;
      S.push(go(o, 'go and find ' + o.name, { toId: o.id }), work('talk', 15, 'talk it through', { fx: 'cheer', toId: o.id, face: o, outdoor: false, meters: ['mood'] }));
      break;
    }
    case 'maintain': {
      const b = sim.sites.find((x) => x.type === 'toolbench' && x.done); if (!b) return null;
      S.push(go(b, 'walk to the tool bench'), work('maintain', 90, 'sharpen and oil the tools', { each: 'fixEach', until: 'fixed', attr: 'DEX', outdoor: false, face: b }));
      break;
    }
    case 'explore': {
      const p = sim.isl.pond, toward = nearestPassable(sim.nav, { x: p.x + (fire.x - p.x) * 0.06, z: p.z + (fire.z - p.z) * 0.06 });
      S.push(go(toward, 'head inland toward the sound of water'), work('look', 15, 'look around', { fx: 'look', outdoor: true, meters: [] }),
        work('bathe', 30, 'swim in the pond', { fx: 'bathe', pond: true, outdoor: false, meters: [] }), go(fire, 'walk back to camp'));
      break;
    }
    default: return null;
  }
  return T;
}

/* ------------------------------ the player's orders ------------------------------ */
export function applyPlayerInput(sim, rec) {
  const s = rec.sid != null ? sim.settlers[rec.sid] : null;
  switch (rec.type) {
    case 'goalMove': {
      const i = sim.goals.indexOf(rec.id); if (i < 0) return false;
      sim.goals.splice(i, 1); sim.goals.splice(clamp(rec.to, 0, sim.goals.length), 0, rec.id); return true;
    }
    case 'goalAdd': if (!GOALS[rec.id] || sim.goals.includes(rec.id)) return false; sim.goals.push(rec.id); return true;
    case 'goalRemove': { const i = sim.goals.indexOf(rec.id); if (i < 0) return false; sim.goals.splice(i, 1); return true; }
    case 'reorder': {
      if (!s) return false;
      const it = s.plan[rec.from]; if (!it) return false;
      s.plan.splice(rec.from, 1); it.owner = 'player'; s.plan.splice(clamp(rec.to, 0, s.plan.length), 0, it); return true;
    }
    case 'doNow': {
      if (!s) return false;
      const it = s.plan[rec.idx]; if (!it) return false;
      s.plan.splice(rec.idx, 1);
      const n = needOf(sim, s);
      const T = it.steps ? it : makeTask(sim, s, it.kind, { ...(it.opts || {}), owner: 'player' });
      if (!T) { say(sim, s, "I can't do that right now.", 'refuse'); return false; }
      T.pinned = true; T.owner = 'player';
      if (n && n.lesson && learned(s, n.lesson) && (n.urgent || n.why === 'bedtime' || n.kind === 'eat')) {
        refuse(sim, s, n.lesson); T.pinned = false; s.plan.unshift(T);
        preempt(sim, s, makeTask(sim, s, n.kind, { need: n })); return 'refused';
      }
      preempt(sim, s, T); return true;
    }
    case 'later': {
      if (!s) return false;
      const n = needOf(sim, s);
      const key = rec.need === 'sleep' ? 'lateNight' : rec.need === 'eat' ? 'skipMeal' : rec.need === 'bathe' ? 'hygiene' : null;
      if (key && learned(s, key) && n && n.kind === rec.need) { refuse(sim, s, key); return 'refused'; }
      s.delay = s.delay || {}; s.delay[rec.need] = sim.t + (rec.hours || 1) * HOUR;
      if (s.task && s.task.kind === rec.need && s.task.steps[s.task.i] && s.task.steps[s.task.i].do === 'go') { s.task = null; }
      return true;
    }
  }
  return false;
}
export function forecastNeeds(sim, s) {
  const out = [], h = hourOf(sim);
  const bed = lessonParam(s, 'lateNight');
  out.push({ kind: 'sleep', at: bed, label: 'Sleep around ' + hhmm(bed) });
  const nextMeal = h < 7 ? 7 : h < 19 ? 19 : 31;
  out.push({ kind: 'eat', at: nextMeal, label: 'Eat at ' + hhmm(nextMeal % 24) });
  return out;
}
