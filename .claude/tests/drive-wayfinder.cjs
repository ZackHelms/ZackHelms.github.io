/**
 * Wayfinder drive suite — 82 checks at the iPhone 13 viewport.
 *
 * Kept IN THE REPO (unlike most drive suites, which are scratchpad throwaways)
 * because it encodes the gates that protect the level design, and those are
 * expensive to re-derive: a BFS walkability gate, a final-leg gate proving each
 * route the lessons actually instruct is walkable, and a cheat gate asserting
 * every lesson refuses to complete without its technique. Re-run it after ANY
 * change to the terrain, the movement model, or the lesson table.
 *
 *   npm install playwright-core          # once, any directory
 *   NODE_PATH=<that dir>/node_modules node .claude/tests/drive-wayfinder.cjs
 *
 * Exits 0/1 and prints "WAYFINDER DRIVE: N passed, M failed" as its last line.
 * Needs Chromium (see .claude/zmh/producer.md § Environment); it launches with
 * SwiftShader so it runs without a GPU. Background on the harness patterns and
 * the trap list: .claude/notes/20260724-headless-mobile-game-testing.md
 */
// Exercises the GPU-independent sim layer, so it passes with or without WebGL.
const { chromium } = require('playwright-core');
const path = '/home/user/ZackHelms.github.io/games/wayfinder/index.html';
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } }
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await c.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path);
  await page.waitForTimeout(900);

  // ---- 1. terrain sanity ----
  const t = await page.evaluate(() => {
    let min = 1e9, max = -1e9;
    for (const v of HGT) { if (v < min) min = v; if (v > max) max = v; }
    const counts = {}; for (const v of LANDG) counts[v] = (counts[v] || 0) + 1;
    // river must fall continuously from source to mouth
    let mono = true, prev = 1e9;
    for (let s = 0; s <= 1.0001; s += 0.02) { const b = riverBed(s); if (b > prev + 0.001) mono = false; prev = b; }
    // the summit really is Beacon Hill
    let bx = 0, bz = 0, bh = -1;
    for (let j = 0; j <= NC; j++) for (let i = 0; i <= NC; i++) {
      const h = HGT[j * (NC + 1) + i]; if (h > bh) { bh = h; bx = i * GRID; bz = j * GRID; }
    }
    return { min, max, counts, mono, bx, bz, bh, cells: LANDG.length };
  });
  ok('heightfield spans a real relief (5–160 m)', t.min > 0 && t.min < 15 && t.max > 120 && t.max < 165, [t.min, t.max]);
  ok('summit is Beacon Hill', Math.hypot(t.bx - 770, t.bz - 270) < 60, [t.bx, t.bz, t.bh]);
  ok('river bed falls monotonically to the mouth', t.mono);
  ok('all six land types present', Object.keys(t.counts).length >= 6, t.counts);
  ok('water is a real feature, not a rounding error', t.counts[3] > 300, t.counts[3]);
  ok('forest dominates but does not swallow the map',
    t.counts[1] > 0.2 * t.cells && t.counts[1] < 0.65 * t.cells, t.counts[1] / t.cells);
  ok('trails exist', t.counts[5] > 200, t.counts[5]);

  // ---- 2. the reentrant the contour lesson teaches actually exists ----
  const re = await page.evaluate(() => {
    const L = LESSONS.find(l => l.id === 'contour'), c = L.control;
    // cross-section across the gully: the control should sit in a hollow
    const b = bearingTo(770, 270, c.x, c.z);          // downhill direction from summit
    const perp = (b + 90) * Math.PI / 180;
    const at = (d) => heightAt(c.x + Math.sin(perp) * d, c.z - Math.cos(perp) * d);
    const mid = at(0), left = at(-26), right = at(26);
    // and it should fall away downhill (a reentrant drains)
    const rad = b * Math.PI / 180;
    const below = heightAt(c.x + Math.sin(rad) * 30, c.z - Math.cos(rad) * 30);
    const above = heightAt(c.x - Math.sin(rad) * 30, c.z + Math.cos(rad) * 30);
    return { mid, left, right, below, above };
  });
  ok('contour lesson sits in a genuine reentrant (hollow across the slope)',
    re.mid < re.left - 2 && re.mid < re.right - 2, re);
  ok('the reentrant drains downhill', re.below < re.mid && re.above > re.mid, re);

  // ---- 3. bearing / declination maths ----
  const nav = await page.evaluate(() => {
    const north = bearingTo(500, 500, 500, 400);       // -z is north
    const east = bearingTo(500, 500, 600, 500);
    const south = bearingTo(500, 500, 500, 600);
    const west = bearingTo(500, 500, 400, 500);
    const rt = [0, 47, 180, 359].map(b => +(magToTrue(trueToMag(b)) - b).toFixed(6));
    return { north, east, south, west, rt, dec: DECLINATION, t2m: trueToMag(100), diff: angDiff(350, 10) };
  });
  ok('bearings: N/E/S/W map to 0/90/180/270', nav.north === 0 && nav.east === 90 && nav.south === 180 && nav.west === 270, nav);
  ok('true<->magnetic round-trips exactly', nav.rt.every(v => Math.abs(v) < 1e-9), nav.rt);
  ok('declination shifts the compass reading', Math.abs(nav.t2m - (100 - nav.dec)) < 1e-9, nav.t2m);
  ok('angle difference wraps the short way', nav.diff === -20, nav.diff);

  // ---- 4. BFS FAIRNESS GATE: every control is walkable from the start ----
  const bfs = await page.evaluate(() => {
    // passable in the same terms the movement code uses
    const passable = (i, j) => {
      const x = i * GRID + 2, z = j * GRID + 2;
      if (x < 4 || z < 4 || x > WORLD - 4 || z > WORLD - 4) return false;
      return waterDepthAt(x, z) < 1.15;
    };
    const stepOK = (i, j, i2, j2) => {
      const h1 = heightAt(i * GRID + 2, j * GRID + 2), h2 = heightAt(i2 * GRID + 2, j2 * GRID + 2);
      return Math.abs(h2 - h1) / GRID < 1.25;
    };
    const seen = new Uint8Array(NC * NC);
    const si = (POI.start.x / GRID) | 0, sj = (POI.start.z / GRID) | 0;
    const q = [[si, sj]]; seen[sj * NC + si] = 1;
    while (q.length) {
      const [i, j] = q.shift();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i2 = i + di, j2 = j + dj;
        if (i2 < 0 || j2 < 0 || i2 >= NC || j2 >= NC) continue;
        if (seen[j2 * NC + i2]) continue;
        if (!passable(i2, j2) || !stepOK(i, j, i2, j2)) continue;
        seen[j2 * NC + i2] = 1; q.push([i2, j2]);
      }
    }
    const reach = (p) => !!seen[(((p.z / GRID) | 0)) * NC + (((p.x / GRID) | 0))];
    const out = [];
    for (let k = 0; k < LESSONS.length; k++) {
      const L = LESSONS[k];
      questIdx = k; roam = false;
      const tgt = questTargetPos();
      out.push({ id: L.id, reachable: tgt ? reach(tgt) : true, tgt });
    }
    let open = 0; for (const v of seen) open += v;
    return { out, openPct: +(100 * open / (NC * NC)).toFixed(1), summit: reach({ x: 770, z: 270 }), bridge: reach(POI.bridge) };
  });
  for (const r of bfs.out) ok('lesson "' + r.id + '" control is walkable from the start', r.reachable, r);
  ok('the summit of Beacon Hill is climbable', bfs.summit);
  ok('the footbridge is reachable', bfs.bridge);
  ok('most of the valley is open ground (>70%)', bfs.openPct > 70, bfs.openPct);

  // ---- 4b. FINAL-LEG GATE: the route each lesson TELLS you to take must work ----
  // Reachability from the start is not enough: a control can be reachable the
  // long way round while the leg the lesson teaches is blocked by a cliff.
  const legs = await page.evaluate(() => {
    const canWalk = (from, to, maxSec) => {
      game = 'play'; roam = true; questState = { phase: 'run' };
      player.x = from.x; player.z = from.z; player.y = heightAt(from.x, from.z); player.vSpeed = 0;
      let best = 1e9, stall = 0, jit = 0;
      for (let i = 0; i < (maxSec || 90) * 60; i++) {
        const d = Math.hypot(to.x - player.x, to.z - player.z);
        if (d < 10) { moveVec.y = 0; return { ok: true, best: 0 }; }
        if (d < best - 0.5) { best = d; stall = 0; jit = 0; }
        else if (++stall > 40) { stall = 0; jit = jit ? -jit - 20 : 30; }
        player.yaw = (bearingTo(player.x, player.z, to.x, to.z) + jit + 360) % 360;
        moveVec.x = 0; moveVec.y = 1; stepSim(1 / 60);
      }
      moveVec.y = 0; return { ok: false, best: +best.toFixed(0) };
    };
    const out = [];
    // the attack-point leg: you must be able to walk attack -> control
    const atk = LESSONS.find(l => l.attack);
    out.push({ leg: 'boulder->control', ...canWalk(atk.attack, atk.control, 90) });
    // aiming off: hitting the Beck downstream, then following it to the flag
    const ao = LESSONS.find(l => l.id === 'aimoff');
    out.push({ leg: 'beck->aimoff control', ...canWalk(BECK[3], ao.control, 90) });
    // the reentrant, approached from the boulder side of the hill
    const co = LESSONS.find(l => l.id === 'contour');
    out.push({ leg: 'flank->reentrant', ...canWalk({ x: 600, z: 300 }, co.control, 90) });
    // steepness along each intended leg, sampled the way the mover sees it
    const worst = [];
    for (const [a, b, name] of [[atk.attack, atk.control, 'boulder->control'],
      [BECK[3], ao.control, 'beck->aimoff'], [{ x: 600, z: 300 }, co.control, 'flank->reentrant']]) {
      let mx = 0;
      for (let t = 0; t <= 1.001; t += 0.05) {
        const s = slopeAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (s > mx) mx = s;
      }
      worst.push({ name, maxSlope: +mx.toFixed(2) });
    }
    return { out, worst };
  });
  for (const l of legs.out) ok('intended leg is walkable: ' + l.leg, l.ok, l);
  ok('no intended leg crosses ground the mover refuses (>1.25)',
    legs.worst.every(w => w.maxSlope <= 1.25), legs.worst);

  // ---- 5. movement model ----
  const mv = await page.evaluate(() => {
    const walk = (secs, yaw, x, z) => {
      player.x = x; player.z = z; player.yaw = yaw; player.y = heightAt(x, z);
      game = 'play'; roam = true; questState = { phase: 'run' };
      moveVec.x = 0; moveVec.y = 1;
      const t0 = { x: player.x, z: player.z };
      for (let i = 0; i < secs * 60; i++) stepSim(1 / 60);
      moveVec.y = 0;
      return Math.hypot(player.x - t0.x, player.z - t0.z);
    };
    // flat-ish trail vs dense forest, same duration
    const onTrail = walk(4, 90, 180, 612);
    const inDense = (() => {
      // find a dense cell
      for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++)
        if (LANDG[j * NC + i] === 2) return walk(4, 90, i * GRID + 2, j * GRID + 2);
      return 0;
    })();
    // cannot walk into the deep river
    player.x = 355; player.z = 300; player.y = heightAt(355, 300);
    const nearRiver = polyNear(RIVER, player.x, player.z).d;
    let blocked = true;
    for (let i = 0; i < 400; i++) { player.yaw = bearingTo(player.x, player.z, 312, 300); moveVec.y = 1; stepSim(1 / 60); }
    moveVec.y = 0;
    const depth = waterDepthAt(player.x, player.z);
    // bounds
    player.x = 6; player.z = 6; player.yaw = 225;
    moveVec.y = 1; for (let i = 0; i < 600; i++) stepSim(1 / 60); moveVec.y = 0;
    const inBounds = player.x > 0 && player.z > 0 && player.x < WORLD && player.z < WORLD;
    return { onTrail, inDense, depth, inBounds, nearRiver };
  });
  ok('walking moves you a sensible distance (trail, 4 s)', mv.onTrail > 6 && mv.onTrail < 30, mv.onTrail);
  ok('dense forest is markedly slower than a trail', mv.inDense < mv.onTrail * 0.75, [mv.onTrail, mv.inDense]);
  ok('you cannot wade into deep water', mv.depth < 1.15, mv.depth);
  ok('you cannot walk off the map', mv.inBounds, mv);

  // ---- 6. pace counting ----
  const pace = await page.evaluate(() => {
    game = 'play'; roam = true; questState = { phase: 'run' };
    player.x = 180; player.z = 612; player.y = heightAt(180, 612); player.yaw = 90;
    paceOn = true; paceCount = 0; paceMetres = 0;
    moveVec.x = 0; moveVec.y = 1;
    for (let i = 0; i < 60 * 20; i++) stepSim(1 / 60);
    moveVec.y = 0;
    return { m: paceMetres, n: paceCount, expect: Math.floor(paceMetres / PACE_M), PACE_M };
  });
  ok('pace counter tracks distance walked', pace.m > 20, pace.m);
  ok('double-paces = metres / 1.62', pace.n === pace.expect, pace);

  // ---- 7. day / night cycle ----
  const day = await page.evaluate(() => {
    const at = (frac) => { clock = DAY_SECONDS * frac; return { el: +sunElevation().toFixed(1), night: isNight(), t: clockString() }; };
    return { noon: at(0.5), midnight: at(0.0), dawn: at(0.25), dusk: at(0.75), period: DAY_SECONDS };
  });
  ok('a full day is 24 minutes', day.period === 1440, day.period);
  ok('noon is high sun, midnight is night', day.noon.el > 55 && !day.noon.night && day.midnight.night, day);
  ok('sun is on the horizon at dawn and dusk', Math.abs(day.dawn.el) < 1 && Math.abs(day.dusk.el) < 1, day);
  ok('clock reads 12:00 at noon', day.noon.t === '12:00', day.noon.t);

  // ---- 8. lesson 1: orienting the map ----
  const orient = await page.evaluate(() => {
    save = { done: [], best: {} };
    startLesson(0); beginRun();
    player.yaw = 90;
    mapRot = 0; const wrong = (() => { mapConfirm(); return questState.phase; })();
    mapRot = -90; mapConfirm();
    return { wrong, phase: questState.phase, done: save.done.slice() };
  });
  ok('a map left north-up is rejected', orient.wrong === 'run', orient);
  ok('rotating the map to the ground completes lesson 1', orient.phase === 'over' && orient.done.includes('orient'), orient);

  // ---- 9. lesson 4: taking a bearing ----
  const bear = await page.evaluate(() => {
    startLesson(3); beginRun();
    thumb.x = POI.bridge.x; thumb.z = POI.bridge.z;
    mapArm = 'bearing';
    // "tap" the cairn on the map
    const t = bearingTo(thumb.x, thumb.z, POI.cairn.x, POI.cairn.z);
    bearingSet = trueToMag(t);
    questState.bearingTarget = { x: POI.cairn.x, z: POI.cairn.z };   // as mapTap would record
    const shedAt = (yaw) => { player.yaw = yaw; return Math.abs(angDiff(trueToMag(player.yaw), bearingSet)) < 4; };
    const good = shedAt(t), bad = shedAt((t + 40) % 360);
    // walk it in, holding the line so the on-line tracker sees it
    questState.moveSamples = 100; questState.onLine = 100;
    player.x = POI.cairn.x + 4; player.z = POI.cairn.z + 4; player.y = heightAt(player.x, player.z);
    questUpdate(0.016);
    return { set: Math.round(bearingSet), truth: Math.round(t), good, bad, phase: questState.phase };
  });
  ok('bearing taken from the map is the magnetic bearing', Math.abs(bear.set - ((bear.truth - 11.5 + 360) % 360)) < 1, bear);
  ok('"red in the shed" only when heading matches the bearing', bear.good && !bear.bad, bear);
  ok('reaching the cairn completes the bearing lesson', bear.phase === 'over', bear);

  // ---- 10. lesson 3: thumbing is scored on accuracy ----
  const thumbL = await page.evaluate(() => {
    startLesson(2); beginRun();
    const L = LESSONS[2], out = [];
    for (let k = 0; k < L.checkpoints.length; k++) {
      const cp = L.checkpoints[k];
      player.x = cp.x; player.z = cp.z; player.y = heightAt(cp.x, cp.z);
      questUpdate(0.016);                              // triggers the prompt
      // alternate an accurate and a wild guess
      thumb.x = cp.x + (k === 1 ? 200 : 12); thumb.z = cp.z + 5;
      mapConfirm();
      out.push(questState.hits[questState.hits.length - 1]);
    }
    return { hits: out, phase: questState.phase };
  });
  ok('thumb error is measured at each checkpoint', thumbL.hits.length === 3 && thumbL.hits[0] < 30 && thumbL.hits[1] > 150, thumbL);
  ok('finishing the checkpoints completes the thumbing lesson', thumbL.phase === 'over', thumbL);

  // ---- 11. lesson 9: night relocation ----
  const reloc = await page.evaluate(() => {
    startLesson(8); beginRun();
    const night = isNight();
    const dropped = { x: player.x, z: player.z };
    thumb.x = player.x + 300; thumb.z = player.z;      // badly wrong
    mapConfirm();
    const rejected = !questState.confirmed;
    thumb.x = player.x + 20; thumb.z = player.z + 10;  // close enough
    mapConfirm();
    const accepted = questState.confirmed;
    player.x = POI.start.x; player.z = POI.start.z; player.y = heightAt(player.x, player.z);
    questUpdate(0.016);
    return { night, dropped, rejected, accepted, phase: questState.phase, err: questState.relocErr };
  });
  ok('the relocation lesson starts at night, away from the start', reloc.night && Math.hypot(reloc.dropped.x - 300, reloc.dropped.z - 660) > 200, reloc);
  ok('a wild position guess is rejected', reloc.rejected);
  ok('a close guess is accepted, then walking home finishes it', reloc.accepted && reloc.phase === 'over', reloc);

  // ---- 12. every lesson is completable, but ONLY by doing the technique ----
  const all = await page.evaluate(() => {
    save = { done: [], best: {}, marks: [] };
    // walk a straight line to a point, honestly through stepSim, so the
    // technique trackers (handrail %, bearing-on-line %, pacing) see real travel
    // Straight-line steering wedges against steep ground, so back off and try a
    // flanking angle when progress stalls — a scripted walker, not a solver.
    const walkTo = (tx, tz, maxSec) => {
      game = 'play';
      let best = 1e9, stall = 0, jitter = 0;
      for (let i = 0; i < (maxSec || 240) * 60; i++) {
        const d = Math.hypot(tx - player.x, tz - player.z);
        if (d < 6) break;
        if (d < best - 0.5) { best = d; stall = 0; jitter = 0; }
        else if (++stall > 45) { stall = 0; jitter = jitter ? -jitter - 18 : 34; }
        player.yaw = (bearingTo(player.x, player.z, tx, tz) + jitter + 360) % 360;
        moveVec.x = 0; moveVec.y = 1;
        stepSim(1 / 60);
      }
      moveVec.y = 0;
    };
    const res = [];
    for (let k = 0; k < LESSONS.length; k++) {
      const L = LESSONS[k];
      startLesson(k); beginRun();
      if (L.check === 'orient') { player.yaw = 40; mapRot = -40; mapConfirm(); }
      else if (L.check === 'thumb') {
        for (const cp of L.checkpoints) {
          walkTo(cp.x, cp.z, 90);
          player.x = cp.x; player.z = cp.z; player.y = heightAt(cp.x, cp.z);
          questUpdate(0.016); thumb.x = cp.x; thumb.z = cp.z; mapConfirm();
        }
      } else if (L.check === 'relocate') {
        thumb.x = player.x; thumb.z = player.z; mapConfirm();
        player.x = POI.start.x; player.z = POI.start.z; player.y = heightAt(player.x, player.z);
        questUpdate(0.016);
      } else if (L.check === 'bearing') {
        // take the bearing AT the cairn, then hold it while walking
        thumb.x = player.x; thumb.z = player.z;
        mapArm = 'bearing'; mapTap(...(() => { const p = mapToScreen(POI.cairn.x, POI.cairn.z); return [p[0] / dpr, p[1] / dpr]; })());
        walkTo(POI.cairn.x, POI.cairn.z, 400);
        questUpdate(0.016);
      } else if (L.check === 'pace') {
        paceOn = false;                              // arrive at the wall uncounted
        walkTo(L.from.x, L.from.z, 400);
        paceOn = true; paceCount = 0; paceMetres = 0; questState.paceRef = null;
        player.x = L.from.x; player.z = L.from.z; questUpdate(0.016);
        const tgt = questTargetPos();
        walkTo(tgt.x, tgt.z, 200);
        questUpdate(0.016);
      } else if (L.check === 'aimoff') {
        // hit the Beck well DOWNSTREAM of the control, then follow it up —
        // that is what aiming off means; touching it at the flag proves nothing
        walkTo(BECK[3].x, BECK[3].z, 400);
        questUpdate(0.016);
        walkTo(L.control.x, L.control.z, 200);
        questUpdate(0.016);
      } else if (L.check === 'attack') {
        walkTo(L.attack.x, L.attack.z, 400);        // via the boulder
        questUpdate(0.016);
        walkTo(L.control.x, L.control.z, 200);
        questUpdate(0.016);
      } else if (L.id === 'handrail') {
        // follow the stream north, sampling the handrail honestly
        for (const p of [{ x: 330, z: 700 }, { x: 355, z: 640 }, L.control]) walkTo(p.x, p.z, 300);
        questUpdate(0.016);
      } else {
        walkTo(L.control.x, L.control.z, 500);
        questUpdate(0.016);
      }
      res.push({ id: L.id, done: questState.phase === 'over', why: techniqueFailure() });
    }
    return { res, saved: save.done.length, stored: JSON.parse(localStorage.getItem('wayfinder') || '{}') };
  });
  for (const r of all.res) ok('lesson "' + r.id + '" completes when the technique IS used', r.done, r);
  ok('all 9 lessons recorded in the save', all.saved === 9, all.saved);
  ok('progress persisted to localStorage', all.stored.done && all.stored.done.length === 9, all.stored.done && all.stored.done.length);

  // ---- 12b. TECHNIQUE GATE: arriving without the skill does NOT pass ----
  const cheat = await page.evaluate(() => {
    const out = [];
    // vSpeed must be cleared or a stale value from an earlier walk makes the
    // technique trackers think this teleport was travel
    const teleportTo = (p) => {
      player.x = p.x; player.z = p.z; player.y = heightAt(p.x, p.z);
      player.vSpeed = 0; moveVec.x = 0; moveVec.y = 0;
      questUpdate(0.016);
    };
    // handrail: teleport straight to the bridge without ever touching the water
    startLesson(1); beginRun(); teleportTo(POI.bridge);
    out.push({ id: 'handrail', passed: questState.phase === 'over', why: !!techniqueFailure() });
    // bearing: walk in without ever dialling one
    startLesson(3); beginRun(); bearingSet = null; teleportTo(POI.cairn);
    out.push({ id: 'bearing', passed: questState.phase === 'over', why: !!techniqueFailure() });
    // pace: arrive with the counter off
    startLesson(4); beginRun(); paceOn = false; teleportTo(questTargetPos());
    out.push({ id: 'pace', passed: questState.phase === 'over', why: !!techniqueFailure() });
    // aim off: straight at it, never touching the beck
    startLesson(5); beginRun(); teleportTo(LESSONS[5].control);
    out.push({ id: 'aimoff', passed: questState.phase === 'over', why: !!techniqueFailure() });
    // attack point: skip the boulder
    startLesson(7); beginRun(); teleportTo(LESSONS[7].control);
    out.push({ id: 'attack', passed: questState.phase === 'over', why: !!techniqueFailure() });
    // thumbing: three wild guesses
    startLesson(2); beginRun();
    for (const cp of LESSONS[2].checkpoints) {
      teleportTo(cp); thumb.x = cp.x + 400; thumb.z = cp.z; mapConfirm();
    }
    out.push({ id: 'thumb', passed: questState.phase === 'over', why: !!techniqueFailure() });
    return out;
  });
  for (const r of cheat) {
    ok('lesson "' + r.id + '" REFUSES a pass without the technique', !r.passed && r.why, r);
  }

  // ---- 12c. the coach names a technique without revealing position ----
  const coach = await page.evaluate(() => {
    startLesson(1); beginRun();
    const before = questState.hintIdx;
    for (let i = 0; i < 60 * 70; i++) questUpdate(1 / 60);      // stand still and stew
    const txt = document.getElementById('toast').textContent;
    return { before, after: questState.hintIdx, txt, shown: document.getElementById('toast').style.display };
  });
  ok('standing lost eventually triggers a coach hint', coach.after > coach.before, coach);
  ok('the hint names a technique, not your position',
    /handrail|stream|upstream|water/i.test(coach.txt) && !/you are at|your position|\d+\s*m east/i.test(coach.txt), coach.txt);

  // ---- 12d. map marks add + remove + persist ----
  const mk = await page.evaluate(() => {
    marks = []; save.marks = [];
    startLesson(1); beginRun(); openMap();
    mapArm = 'mark';
    const scr = (x, z) => { const p = mapToScreen(x, z); return [p[0] / dpr, p[1] / dpr]; };
    mapTap(...scr(400, 500));
    mapTap(...scr(600, 300));
    const added = marks.length;
    mapTap(...scr(400, 500));                                    // tap it again to rub out
    const afterRemove = marks.length;
    closeMap();
    return { added, afterRemove, stored: (JSON.parse(localStorage.getItem('wayfinder') || '{}').marks || []).length };
  });
  ok('marks can be pencilled onto the map', mk.added === 2, mk);
  ok('tapping a mark again rubs it out', mk.afterRemove === 1, mk);
  ok('marks persist', mk.stored === 1, mk);

  // ---- 13. map is built and honest ----
  const map = await page.evaluate(() => {
    const g = mapTex.getContext('2d');
    // sample a known water pixel and a known open pixel
    const at = (x, z) => { const d = g.getImageData(x, z, 1, 1).data; return d[0] + ',' + d[1] + ',' + d[2]; };
    let brown = 0;
    const img = g.getImageData(0, 0, WORLD, WORLD).data;
    for (let i = 0; i < img.length; i += 4 * 97) {
      if (img[i] > 140 && img[i] < 215 && img[i + 1] > 90 && img[i + 1] < 160 && img[i + 2] < 110) brown++;
    }
    return { w: mapTex.width, h: mapTex.height, river: at(RIVER[4].x | 0, RIVER[4].z | 0), brown };
  });
  ok('map raster is 1 px per metre over the whole world', map.w === 1024 && map.h === 1024, map);
  ok('contours are drawn on the map', map.brown > 200, map.brown);

  // ---- 14. persistence across reload + audio + mute ----
  await page.reload(); await page.waitForTimeout(700);
  const re2 = await page.evaluate(() => ({ done: save.done.length, txt: document.getElementById('menu-progress').textContent }));
  ok('save survives reload', re2.done === 9, re2);
  ok('menu shows lesson progress', /9\s*\/\s*9/.test(re2.txt), re2.txt);
  await page.evaluate(() => audioInit());
  await page.waitForTimeout(250);
  const au = await page.evaluate(() => ({ ac: !!AC, st: AC && AC.state, noise: !!noiseBuf, wind: !!windSrc, timer: musicTimer !== null }));
  ok('audio: context, shared noise buffer, wind bed and music scheduler', au.ac && au.st === 'running' && au.noise && au.wind && au.timer, au);
  await page.tap('#mute-btn'); await page.waitForTimeout(150);
  const mute = await page.evaluate(() => ({ m: muted, ls: localStorage.getItem('wayfinder-mute'), s: sfxGain.gain.value, mg: musicGain.gain.value, icon: document.getElementById('mute-btn').textContent }));
  ok('mute zeroes masters + persists', mute.m && mute.ls === '1' && mute.s === 0 && mute.mg === 0 && mute.icon === '🔇', mute);
  await page.tap('#mute-btn');

  // ---- 15. real touch input drives look + walk ----
  const touch = await page.evaluate(async () => {
    game = 'play'; roam = true; questState = { phase: 'run' };
    player.x = 300; player.z = 660; player.yaw = 90;
    const el = document.getElementById('ui');
    const mk = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    // look drag on the right half
    let t = mk(1, 300, 300);
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    t = mk(1, 360, 300);
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    const yawMoved = player.yaw;
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
    // joystick on the lower-left
    let j = mk(2, 80, 700);
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [j], changedTouches: [j], bubbles: true, cancelable: true }));
    j = mk(2, 80, 660);
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [j], changedTouches: [j], bubbles: true, cancelable: true }));
    const active = joy.active, mv = { x: moveVec.x, y: moveVec.y };
    const p0 = { x: player.x, z: player.z };
    for (let i = 0; i < 90; i++) stepSim(1 / 60);
    const moved = Math.hypot(player.x - p0.x, player.z - p0.z);
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [j], bubbles: true, cancelable: true }));
    return { yawMoved, active, mv, moved, stopped: moveVec.y };
  });
  ok('dragging the right half turns the view', Math.abs(touch.yawMoved - 90) > 8, touch.yawMoved);
  ok('the lower-left acts as a walk joystick', touch.active && touch.mv.y > 0.5, touch.mv);
  ok('holding the joystick actually walks', touch.moved > 3, touch.moved);
  ok('releasing the joystick stops you', touch.stopped === 0, touch.stopped);

  const real = errors.filter(e => !/fonts\.g|net::ERR|Failed to load resource|WebGL|SwiftShader|GroupMarker/i.test(e));
  ok('no console errors', real.length === 0, real);
  console.log('\nWAYFINDER DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
