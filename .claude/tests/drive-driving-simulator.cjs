/**
 * Driving Simulator drive suite.
 *
 * Kept in the repo because it encodes the road's design invariants (classes,
 * tapers as long as MUTCD asks, signs before every lane drop, a centreline
 * that never doubles back), the clock the CD specified (a 24-hour day in 2.4
 * minutes, configurable), the car's physics against real-world figures, and the
 * traffic's lane discipline. The simulation is stepped directly through
 * `__DS.tick(dt)` with the live loop paused, so every number is deterministic.
 *
 *   .claude/scripts/gates.sh games/driving-simulator/index.html
 *
 * Exits 0/1 and prints "DRIVING SIMULATOR DRIVE: N passed, M failed" last.
 * Needs Chromium; launches with SwiftShader so WebGL2 exists without a GPU.
 */
const { chromium } = require('playwright-core');
const PAGE = 'file:///home/user/ZackHelms.github.io/games/driving-simulator/index.html';
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 });
  await page.evaluate(() => window.__DS.setPaused(true));
  const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  // ---- 1. boot and the kits ----
  const boot = await page.evaluate(() => {
    const D = window.__DS;
    return { chunks: D.CHUNKS.size, cars: D.TRAFFIC.cars.length, fmt: ROAD_KIT.format, kinds: ROAD_KIT.vehicles.map(v => v.kind),
      lane: ROAD_KIT.standard.laneWidth, dash: [ROAD_KIT.standard.dashLength, ROAD_KIT.standard.dashGap],
      buildings: TOWN_KIT.buildings.length, forest: TOWN_KIT.forest.length, gl: !!document.getElementById('gl').getContext('webgl2'),
      cycle: D.SETTINGS.cycle, badge: (document.getElementById('build-badge') || {}).textContent };
  });
  ok('boots with WebGL2, chunks and traffic', boot.gl && boot.chunks >= 12 && boot.cars >= 10, boot);
  ok('road kit is road-spec/v1 with six vehicle kinds', boot.fmt === 'road-spec/v1' && boot.kinds.length === 6, boot.kinds);
  ok('MUTCD numbers come from the kit: 12 ft lanes, 10 ft dash on a 40 ft cycle', boot.lane === 3.66 && boot.dash[0] === 3.05 && boot.dash[1] === 9.14, boot);
  ok('town kit supplies 13 buildings and 6 forest species', boot.buildings === 13 && boot.forest === 6, boot);
  ok('build badge carries a real timestamp', /^build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(boot.badge || ''), boot.badge);

  // ---- 2. the road: classes, tapers, signs, geometry ----
  const road = await page.evaluate(() => {
    const D = window.__DS;
    D.sectionAt(60000);
    const S = D.ROAD.sect.filter(s => s.s0 < 60000);
    const classes = [...new Set(S.map(s => s.cls))];
    let jumps = 0, badTaper = 0, firstTown = null;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1].c.lanesPerDirection, b = S[i].c.lanesPerDirection;
      if (Math.abs(a - b) > 1) jumps++;
      if (a !== b) { const want = Math.max(S[i - 1].c.mergeTaper, S[i].c.mergeTaper); if (Math.abs(S[i].taper - want) > 0.01) badTaper++; }
      if (S[i].cls === 'town2' && firstTown === null) firstTown = S[i].s0;
    }
    // lane count is continuous and never steeper than the taper allows
    let maxStep = 0, maxTh = 0, minR = Infinity, maxGrade = 0, laneVals = new Set();
    for (let s = 0; s < 60000; s += 2) {
      const p = D.at(s), q = D.at(s + 2);
      maxStep = Math.max(maxStep, Math.abs(q.L - p.L));
      maxTh = Math.max(maxTh, Math.abs(p.th));
      const k = Math.abs(q.th - p.th) / 2; if (k > 1e-9) minR = Math.min(minR, 1 / k);
      maxGrade = Math.max(maxGrade, Math.abs(q.y - p.y) / 2);
      laneVals.add(Math.round(p.L * 100) / 100);
    }
    // every lane drop (in either direction of travel) has its warning sign before it
    D.at(60000); D.ensureSigns(60000);
    const drops = [];
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1].c.lanesPerDirection, b = S[i].c.lanesPerDirection;
      if (b < a) drops.push({ s: S[i].s0, side: 1 });                       // +s traffic loses a lane at s0
      if (b > a) drops.push({ s: S[i].s0 + S[i].taper, side: -1 });         // -s traffic loses one at the taper's far end
    }
    const signed = drops.filter(d => D.SIGNS.some(g => g.kind === 'laneEnds' && g.side === d.side && (d.side > 0 ? d.s - g.s : g.s - d.s) > 50 && (d.side > 0 ? d.s - g.s : g.s - d.s) < 400));
    const limits = S.filter(sc => sc.s1 < 59000 && D.SIGNS.some(g => g.kind === 'limit' && g.mph === sc.c.speedLimitMph && g.s > sc.s0 && g.s < sc.s1));
    return { classes, jumps, badTaper, firstTown, maxStep, maxTh, minR, maxGrade, laneVals: laneVals.size, drops: drops.length, signed: signed.length,
      sects: S.length, limits: limits.length, limitWant: S.filter(sc => sc.s1 < 59000).length };
  });
  ok('all four road classes appear within 60 km', road.classes.length === 4, road.classes);
  ok('2-, 4- and 6-lane sections all occur (1, 2 and 3 lanes per direction)', ['rural2', 'arterial4', 'highway6'].every(c => road.classes.includes(c)), road.classes);
  ok('a class change never adds or drops more than one lane per direction', road.jumps === 0, road.jumps);
  ok('every taper is the kit\'s MUTCD merge length for the faster class', road.badTaper === 0, road.badTaper);
  ok('lane count is continuous (no step over 2 m larger than a taper allows)', road.maxStep < 2 / 160, road.maxStep);
  ok('the centreline never turns back on itself (|heading| < 90 deg)', road.maxTh < Math.PI / 2 - 0.05, road.maxTh);
  ok('no curve tighter than the plan\'s 380 m radius (spirals included)', road.minR > 370, road.minR);
  ok('grades stay under 8%', road.maxGrade < 0.08, road.maxGrade);
  ok('every lane drop, in each direction, is signed 50-400 m ahead', road.drops > 3 && road.signed === road.drops, road);
  ok('every section posts its own speed limit', road.limits === road.limitWant, road);

  // ---- 3. the clock: a 24-hour day in 2.4 minutes, configurable ----
  const clock = await page.evaluate(() => {
    const D = window.__DS;
    const out = {};
    out.defaultCycle = D.SETTINGS.cycle;
    out.optionDefault = document.getElementById('cycle-sel').querySelector('option[value="144"]').textContent;
    D.SETTINGS.cycle = 144; D.SKY.hour = 6;
    for (let i = 0; i < 1440; i++) D.advanceClock(0.1);          // 144 s
    out.after144 = D.SKY.hour;
    D.SKY.hour = 6; for (let i = 0; i < 360; i++) D.advanceClock(0.1);   // 36 s = 6 h
    out.after36 = D.SKY.hour;
    D.SETTINGS.cycle = 600; D.SKY.hour = 0; for (let i = 0; i < 6000; i++) D.advanceClock(0.1);
    out.after600 = D.SKY.hour;
    D.SETTINGS.cycle = 0; D.SKY.hour = 9; D.advanceClock(50); out.stopped = D.SKY.hour;
    D.SKY.hour = 12; D.updateSky(); out.noon = { e: D.SKY.sun[1], lights: D.SKY.lights, day: D.SKY.day };
    D.SKY.hour = 0; D.updateSky(); out.midnight = { e: D.SKY.sun[1], lights: D.SKY.lights, night: D.SKY.night };
    D.SKY.hour = 19.75; D.updateSky(); out.dusk = { e: D.SKY.sun[1] };
    D.SKY.hour = 6.25; D.updateSky(); out.dawn = { e: D.SKY.sun[1] };
    D.SETTINGS.cycle = 144;
    return out;
  });
  ok('default day length is 2.4 minutes', clock.defaultCycle === 144 && /2\.4 minutes/.test(clock.optionDefault), clock);
  ok('144 s of driving is exactly one 24-hour day', Math.abs(((clock.after144 - 6 + 24) % 24)) < 1e-6 || Math.abs(clock.after144 - 6) < 1e-6, clock.after144);
  ok('36 s is a quarter day (6 h)', Math.abs(clock.after36 - 12) < 1e-6, clock.after36);
  ok('a 10-minute setting takes 600 s for the day', Math.abs(clock.after600 % 24) < 1e-6 || Math.abs(clock.after600 - 24) < 1e-6, clock.after600);
  ok('"stopped" holds the time', clock.stopped === 9, clock.stopped);
  ok('sun high at noon, lights off', clock.noon.e > 0.6 && !clock.noon.lights && clock.noon.day > 0.95, clock.noon);
  ok('sun below the horizon at midnight, headlights on', clock.midnight.e < -0.3 && clock.midnight.lights && clock.midnight.night > 0.95, clock.midnight);
  ok('a summer day: the sun sets about 7:45 pm and rises about 6:15 am', Math.abs(clock.dusk.e) < 0.05 && Math.abs(clock.dawn.e) < 0.05, clock);

  // ---- 4. the car: acceleration, braking, steering, reverse ----
  const car = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    const reset = s => { D.teleport(s); D.TRAFFIC.cars.length = 0; I.gasTarget = 0; I.brakeTarget = 0; I.gas = 0; I.brake = 0; I.steer = 0; I.wheelAngle = 0; I.wheelHeld = false; };
    // a long straight in a 2-lane section: find one
    let s0 = 200; for (let s = 200; s < 20000; s += 50) { let straight = true; for (let d = 0; d < 700; d += 10) if (Math.abs(D.at(s + d).th - D.at(s).th) > 0.02) { straight = false; break; } if (straight) { s0 = s; break; } }
    reset(s0);
    I.gasTarget = 1;
    let t = 0, t60 = null;
    while (t < 25) { D.tick(1 / 60); t += 1 / 60; if (t60 === null && P.vx >= 26.82) t60 = t; }
    const v25 = P.vx;
    // brake from 60 mph
    reset(s0); P.vx = 26.82; I.gasTarget = 0; I.brakeTarget = 1; I.brake = 1;
    const sb = P.s; let tb = 0; while (P.vx > 0.05 && tb < 10) { D.tick(1 / 60); tb += 1 / 60; }
    const brakeDist = P.s - sb;
    // steering left turns left (u falls, yaw rises relative to the road)
    reset(s0); P.vx = 15; I.brakeTarget = 0; I.brake = 0; I.wheelHeld = true; I.steer = 0.6;
    const y0 = P.yaw; for (let i = 0; i < 60; i++) D.tick(1 / 60);
    const turnL = { dyaw: P.yaw - y0, u: P.u };
    I.wheelHeld = false; I.steer = 0;
    // reverse: hold the brake at a standstill
    reset(s0); I.brakeTarget = 1; for (let i = 0; i < 240; i++) D.tick(1 / 60);
    const gearR = P.gear, vR = P.vx;
    I.brakeTarget = 0; I.gasTarget = 1; for (let i = 0; i < 120; i++) D.tick(1 / 60);
    const gearBack = P.gear;
    I.gasTarget = 0; I.gas = 0;
    return { s0, t60, v25, brakeDist, turnL, gearR, vR, gearBack };
  });
  ok('0-60 mph in a sedan-like 6-11 s', car.t60 !== null && car.t60 > 6 && car.t60 < 11, car.t60);
  ok('keeps accelerating past 60 mph toward its top speed', car.v25 > 30 && car.v25 < 59, car.v25);
  ok('stops from 60 mph in 30-50 m (about 0.9 g)', car.brakeDist > 30 && car.brakeDist < 50, car.brakeDist);
  ok('steering left turns the car left', car.turnL.dyaw > 0.05 && car.turnL.u < 1.6, car.turnL);
  ok('holding the brake at a standstill engages reverse and backs up', car.gearR === -1 && car.vR < -0.5, [car.gearR, car.vR]);
  ok('the accelerator at a standstill puts it back in drive', car.gearBack === 1, car.gearBack);

  // ---- 5. collisions: a tree, a building, another car ----
  const hit = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    // find a tree collider near the road in a forest chunk and drive at it
    let tree = null;
    for (let s = 300; s < 1000 && !tree; s += 96) {
      D.teleport(s); D.TRAFFIC.cars.length = 0;
      for (const ch of D.CHUNKS.values()) for (const c of ch.col.circ) {
        const q = D.project(c.x, c.z, s);
        if (Math.abs(q.s - s) < 60 && Math.abs(q.u) > q.p.Rr + 3 && Math.abs(q.u) < q.p.Rr + 14 && c.r > 0.2) { tree = c; break; }
      }
    }
    if (!tree) return { tree: null };
    const q = D.project(tree.x, tree.z, P.s);
    const a = D.at(q.s - 20);
    const [sx, sz] = [a.x - a.tz * q.u, a.z + a.tx * q.u];
    P.x = sx; P.z = sz; P.s = q.s - 20; P.yaw = Math.atan2(tree.x - sx, tree.z - sz); P.vx = 12; P.vy = 0; P.r = 0;
    I.gasTarget = 0; I.gas = 0; I.brakeTarget = 0; I.brake = 0;
    let minD = 1e9;
    for (let i = 0; i < 240; i++) { D.tick(1 / 60); minD = Math.min(minD, Math.hypot(P.x - tree.x, P.z - tree.z)); }
    const res = { tree: true, minD, vAfter: P.vx, halfW: P.V.width / 2 };
    return res;
  });
  ok('a tree near the road blocks the car (never passes through its trunk)', hit.tree && hit.minD > hit.halfW * 0.9, hit);
  ok('hitting a tree takes the speed out', hit.tree && Math.abs(hit.vAfter) < 6, hit);

  const crash = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    D.teleport(400); D.TRAFFIC.cars.length = 0;
    const c = D.spawnCar(P.s + 25, 1, 0, 0); c.f = 0; c.v = 0;
    P.vx = 15; I.gasTarget = 1;
    let minGap = 1e9;
    for (let i = 0; i < 180; i++) { D.tick(1 / 60); minGap = Math.min(minGap, (c.s - P.s) - (c.V.length + P.V.length) / 2); }
    I.gasTarget = 0; I.gas = 0;
    return { minGap, stopT: c.stopT, hazard: c.hazard, pv: P.vx };
  });
  ok('ramming a car ahead does not pass through it', crash.minGap > -0.6, crash);
  ok('the car that was hit puts its hazards on', crash.hazard === 1, crash);

  // ---- 6. traffic: keep right, no overlaps, merge before a lane ends ----
  const traffic = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    // start just before a 3 -> 2 lane drop so merges are exercised
    const S = D.ROAD.sect;
    const drop = S.find((sc, i) => i > 0 && S[i - 1].c.lanesPerDirection === 3 && sc.c.lanesPerDirection === 2);
    D.teleport(drop.s0 - 900);
    I.gasTarget = 0;
    let wrongSide = 0, overlaps = 0, offRoad = 0, steps = 0, inEnded = 0, maxCars = 0, laneChanges = 0;
    const seenLc = new Set();
    for (let i = 0; i < 60 * 90; i++) {
      // the player cruises in the right lane at the limit so the window moves through the drop
      const p = D.at(P.s), lim = D.sectionAt(P.s).c.speedLimitMph * 0.44704;
      const u = D.laneCenter(0, p.L);
      P.s += lim / 60; const q = D.at(P.s); const [x, z] = [q.x - q.tz * u, q.z + q.tx * u];
      P.x = x; P.z = z; P.yaw = q.th; P.vx = lim; P.vy = 0; P.r = 0;
      D.stepTraffic(1 / 60); steps++;
      const cars = D.TRAFFIC.cars; maxCars = Math.max(maxCars, cars.length);
      for (const c of cars) {
        if (c.lc && !seenLc.has(c.id + ':' + c.lc.from + '>' + c.lc.to)) { seenLc.add(c.id + ':' + c.lc.from + '>' + c.lc.to); laneChanges++; }
        if (c.off <= 0.2) wrongSide++;
        const cp = D.at(c.s);
        if (c.off > cp.L * 3.66 + 0.3) offRoad++;
        if (!c.lc && c.lane > 0 && cp.L - c.lane < 0.35) inEnded++;
      }
      if (i % 30 === 0) for (const a of cars) for (const b of cars) {
        if (a.id >= b.id || a.dir !== b.dir) continue;
        const la = a.lc ? [a.lc.from, a.lc.to] : [a.lane], lb = b.lc ? [b.lc.from, b.lc.to] : [b.lane];
        if (!la.some(l => lb.includes(l))) continue;
        if (Math.abs(a.s - b.s) < (a.V.length + b.V.length) / 2 - 0.3) overlaps++;
      }
    }
    return { steps, wrongSide, overlaps, offRoad, inEnded, maxCars, laneChanges, drop: drop.s0 };
  });
  ok('every car keeps to its own side of the centre line', traffic.wrongSide === 0, traffic);
  ok('no two cars in a lane overlap over 90 s through a lane drop', traffic.overlaps === 0, traffic);
  ok('no car drives off the paved lanes', traffic.offRoad === 0, traffic);
  ok('cars merge out of a lane before it tapers away', traffic.inEnded === 0, traffic);
  ok('traffic changes lanes (merging and passing happen)', traffic.laneChanges >= 3, traffic.laneChanges);
  ok('the road stays populated', traffic.maxCars >= 15, traffic.maxCars);

  const headOn = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    D.teleport(400); D.TRAFFIC.cars.length = 0;
    // the player stops in the oncoming lane; an oncoming car must stop short
    const p = D.at(P.s), u = -D.laneCenter(0, p.L);
    P.x = p.x - p.tz * u; P.z = p.z + p.tx * u; P.u = u; P.vx = 0;
    const c = D.spawnCar(P.s + 160, -1, 0); c.v = 24;
    let minGap = 1e9;
    for (let i = 0; i < 60 * 15; i++) { D.stepTraffic(1 / 60); minGap = Math.min(minGap, (c.s - P.s) - (c.V.length + P.V.length) / 2); }
    return { minGap, v: c.v };
  });
  ok('an oncoming driver stops for a car stopped in their lane', headOn.minGap > 0.5 && headOn.v < 0.5, headOn);

  // ---- 7. controls: wheel, pedals, horn, views, settings ----
  await page.evaluate(() => window.__DS.setPaused(false));
  const ui = await page.evaluate(() => {
    const D = window.__DS, U = D.UI;
    return { wheel: U.wheel, gas: U.gas, brake: U.brake, speed: U.speed, w: innerWidth, h: innerHeight,
      chrome: ['back-btn', 'mute-btn', 'set-btn', 'view-btn'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()) };
  });
  const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= ui.w && r.y + r.h <= ui.h;
  const wheelR = { x: ui.wheel.x - ui.wheel.r, y: ui.wheel.y - ui.wheel.r, w: ui.wheel.r * 2, h: ui.wheel.r * 2 };
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  ok('wheel and pedals sit inside the screen', inside(wheelR) && inside(ui.gas) && inside(ui.brake), ui);
  ok('wheel, pedals and chrome do not overlap', !overlap(wheelR, ui.gas) && !overlap(wheelR, ui.brake) && !overlap(ui.gas, ui.brake)
    && ui.chrome.every(c => ![wheelR, ui.gas, ui.brake].some(r => overlap(r, { x: c.x, y: c.y, w: c.width, h: c.height }))), ui);
  // the same layout rules at phone sizes in both orientations, speed readout included
  const sweep = [];
  for (const [w, h] of [[390, 844], [844, 390], [375, 667], [667, 375], [430, 932], [1024, 768], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await frames(3);
    const u = await page.evaluate(() => { const U = window.__DS.UI; return { wheel: U.wheel, gas: U.gas, brake: U.brake, speed: U.speed, w: innerWidth, h: innerHeight,
      chrome: ['back-btn', 'mute-btn', 'set-btn', 'view-btn'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()) }; });
    const wr = { x: u.wheel.x - u.wheel.r, y: u.wheel.y - u.wheel.r, w: u.wheel.r * 2, h: u.wheel.r * 2 };
    const rects = { wheel: wr, gas: u.gas, brake: u.brake, speed: u.speed };
    u.chrome.forEach((c, i) => { rects['chrome' + i] = { x: c.x, y: c.y, w: c.width, h: c.height }; });
    const names = Object.keys(rects);
    for (const n of names) if (!(rects[n].x >= 0 && rects[n].y >= 0 && rects[n].x + rects[n].w <= u.w && rects[n].y + rects[n].h <= u.h)) sweep.push(`${w}x${h} ${n} off screen`);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (names[i].startsWith('chrome') && names[j].startsWith('chrome')) continue;
      if (overlap(rects[names[i]], rects[names[j]])) sweep.push(`${w}x${h} ${names[i]}/${names[j]}`);
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await frames(3);
  ok('controls, speed readout and chrome fit without overlapping at seven phone/tablet sizes', sweep.length === 0, sweep);

  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
  const W = ui.wheel;
  // grab the rim at 12 o'clock and turn it a quarter turn clockwise (to the right)
  await touch('touchStart', [[W.x, W.y - W.r * 0.85, 1]]);
  for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI / 2; await touch('touchMove', [[W.x + Math.cos(a) * W.r * 0.85, W.y + Math.sin(a) * W.r * 0.85, 1]]); }
  const turned = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, held: window.__DS.INPUT.wheelHeld }));
  // press the accelerator with a second finger while steering
  const G = ui.gas;
  await touch('touchMove', [[W.x + W.r * 0.85, W.y, 1], [G.x + G.w / 2, G.y + G.h / 2, 2]]);
  await touch('touchStart', [[W.x + W.r * 0.85, W.y, 1], [G.x + G.w / 2, G.y + G.h / 2, 2]]);
  await frames(8);
  const both = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, gas: window.__DS.INPUT.gas }));
  await touch('touchEnd', []);
  await frames(30);
  const released = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, gas: window.__DS.INPUT.gas, held: window.__DS.INPUT.wheelHeld }));
  ok('turning the on-screen wheel clockwise steers right', turned.held && turned.steer < -0.4, turned);
  ok('a second finger on the accelerator works while steering', both.gas > 0.2 && both.steer < -0.4, both);
  ok('a released wheel springs back to centre and the pedal lets go', Math.abs(released.steer) < 0.05 && released.gas < 0.05 && !released.held, released);
  await touch('touchStart', [[W.x, W.y, 3]]);
  const horn = await page.evaluate(() => window.__DS.INPUT.horn);
  await touch('touchEnd', []);
  const hornOff = await page.evaluate(() => window.__DS.INPUT.horn);
  ok('tapping the middle of the wheel sounds the horn while held', horn === true && hornOff === false, [horn, hornOff]);

  const views = [];
  for (let k = 0; k < 3; k++) { await page.click('#view-btn'); await frames(3); views.push(await page.evaluate(() => [window.__DS.CAM.mode, window.__DS.SETTINGS.view])); }
  ok('the view button goes cockpit -> chase -> orbit -> cockpit and remembers it', views.map(v => v[0]).join() === '1,2,0' && views.every(v => v[0] === v[1]), views);

  await page.click('#set-btn');
  const panel = await page.evaluate(() => ({ open: document.getElementById('settings').classList.contains('open'), cyc: document.getElementById('cycle-sel').value }));
  await page.selectOption('#cycle-sel', '600');
  const cyc600 = await page.evaluate(() => window.__DS.SETTINGS.cycle);
  await page.selectOption('#cycle-sel', '144');
  await page.click('#set-close');
  ok('settings open on the cog and offer the day length (2.4 min selected)', panel.open && panel.cyc === '144', panel);
  ok('changing the day length in settings takes effect', cyc600 === 600, cyc600);

  // ---- 8. pixels: a real picture, and night is darker than day ----
  const lum = async () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => {
    const c = document.getElementById('gl'), g = c.getContext('webgl2');
    const w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    let s = 0, n = 0, distinct = new Set();
    for (let i = 0; i < px.length; i += 4 * 97) { s += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; n++; distinct.add(px[i] >> 4 << 8 | px[i + 1] >> 4 << 4 | px[i + 2] >> 4); }
    r({ mean: s / n, distinct: distinct.size });
  })));
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.cycle = 0; D.SKY.hour = 12; D.CAM.mode = 1; });
  await frames(4);
  const day = await lum();
  await page.evaluate(() => { window.__DS.SKY.hour = 0.5; });
  await frames(4);
  const night = await lum();
  ok('the frame is a real picture (many distinct colours)', day.distinct > 40, day);
  ok('midnight is much darker than noon', night.mean < day.mean * 0.45, [day.mean, night.mean]);

  // ---- 9. sound: the radio is audible over the engine but does not drown it, and switches off ----
  const lv = async () => page.evaluate(async () => { const S = window.__DS.SND; let a = 0, m = 0; for (let i = 0; i < 40; i++) { a += (S.rms('sfx') || 0) ** 2; m += (S.rms('music') || 0) ** 2; await new Promise(r => setTimeout(r, 50)); } return { sfx: Math.sqrt(a / 40), music: Math.sqrt(m / 40) }; });
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.radio = 1; D.SETTINGS.muted = false; D.SND.apply(); D.INPUT.gasTarget = 0.5; D.PLAYER.vx = 25; });
  await page.waitForTimeout(1500);
  const lvOn = await lv();
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.radio = 0; D.SND.apply(); });
  await page.waitForTimeout(2500);
  const lvOff = await lv();
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.radio = 1; D.SND.apply(); D.INPUT.gasTarget = 0; });
  ok('the engine is audible and the radio sits under it (0.15-1.2x its level)', lvOn.sfx > 0.02 && lvOn.music > 0.15 * lvOn.sfx && lvOn.music < 1.2 * lvOn.sfx, lvOn);
  ok('switching the radio off silences the music bus', lvOff.music < 0.002 && lvOff.sfx > 0.02, lvOff);

  ok('no page errors', errors.length === 0, errors.slice(0, 5));
  await browser.close();
  console.log(`DRIVING SIMULATOR DRIVE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`DRIVING SIMULATOR DRIVE: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
