#!/usr/bin/env node
/**
 * drive-turret-builder.cjs — RULES gate for games/turret-builder/.
 *
 * Balance lives next door in eval-turret-builder.cjs, so a rebalance never
 * fights a mechanics regression. This file asserts the DESIGN SPEC to the
 * decimal, by measuring the game rather than reading its constants.
 *
 * THE PAYLOAD MODEL. A shot builds one payload and copies it outwards:
 *   AMP   multiplies the payload's kinetic damage
 *   FIRE  adds a burn — elemental, over FIRE_T seconds
 *   ICE   adds chill — slows movement AND attack speed, no damage at all
 *   ELEC  copies the payload onto the next enemy at ELEC_XFER
 *   BLAST copies the payload onto everything in a radius at BLAST_XFER
 * Damage decays as it is copied; EFFECTS land at full potency.
 *
 * The headline test is the CD's own worked example — ELEC+BLAST+FIRE+ICE,
 * one per side, base 10 — which must come out at exactly:
 *   main target  12.5 kinetic (10 + 2.5 splash), 9.375 burn, full chill
 *   arc target   6.25 kinetic (5 + 1.25 splash), 4.6875 burn, full chill
 *   bystander    1.25 kinetic, 0.9375 burn, full chill
 *
 * Every number is measured off a DAMAGE LEDGER (__TB.setLog) fired at pinned
 * dummies with known armour and resist — inferring them from a live wave
 * would only ever prove that some damage happened.
 *
 * Usage:
 *   npm install playwright-core            # once, any directory
 *   NODE_PATH=<that dir>/node_modules node .claude/tests/drive-turret-builder.cjs
 */
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core not resolvable (NODE_PATH).');
  console.log('TURRET-BUILDER DRIVE: 0 passed, 1 failed');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = 'file://' + path.join(repoRoot, 'games', 'turret-builder', 'index.html');
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

let pass = 0, fail = 0;
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}
function group(t) { console.log('\n--- ' + t + ' ---'); }

/* ------------------- helpers injected into the page ------------------- */
const HELPERS = `(() => {
  const G = window.__TB;
  const ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];      // up, down, left, right
  const DIAG  = [[-1,-1],[-1,1],[1,-1],[1,1]];

  function fresh() {
    G.clearStorage();
    G.seedRandom(7);
    G.newRun();
    G.unlockAll();
    G.setCash(1000000);
    G.setPhase('grace');          // park the flow machine: no wave gatecrashes
    return G;
  }
  /* a turret cell with all four SIDES free (for modules) */
  function plusSpot() {
    for (const c of G.buildableCells('turret'))
      if (ORTHO.every(([dr,dc]) => G.canPlace('fire', c.r+dr, c.c+dc))) return c;
    return null;
  }
  /* ... and all four DIAGONALS free too (for boosters) */
  function bigSpot() {
    for (const c of G.buildableCells('turret')) {
      if (!ORTHO.every(([dr,dc]) => G.canPlace('fire', c.r+dr, c.c+dc))) continue;
      if (!DIAG.every(([dr,dc]) => G.canPlace('twin', c.r+dr, c.c+dc))) continue;
      return c;
    }
    return null;
  }
  function ring(spot, kinds) {
    kinds.forEach((k, i) => { const [dr,dc] = ORTHO[i]; G.place(k, spot.r+dr, spot.c+dc); });
  }
  /* Place a turret with the given modules, fire exactly ONE shot at a lone
     pinned dummy, remove the turret so nothing fires again, then let the burn
     run out. Returns the ledger split by channel. */
  function oneShot(mods, dummyOpts, boosters, sideMap) {
    fresh();
    const spot = boosters ? bigSpot() : plusSpot();
    G.place('turret', spot.r, spot.c);
    if (sideMap) { for (const k of Object.keys(sideMap)) {
      const [dr,dc] = ORTHO[+k]; G.place(sideMap[k], spot.r+dr, spot.c+dc); } }
    else ring(spot, mods);
    if (boosters) boosters.forEach((b, i) => { const [dr,dc] = DIAG[i]; G.place(b, spot.r+dr, spot.c+dc); });
    const st = G.turretStats(spot.r, spot.c);
    const cs = G.cellSize();
    const id = G.spawnDummy(Object.assign({
      hp: 1e9, x: G.cellCx(spot.c) + cs * 1.2, y: G.cellCy(spot.r), d: 500,
    }, dummyOpts || {}));
    G.setLog(true);
    G.step(0.001, 1);                       // cooldown starts at 0 -> one shot
    const shot = G.log().slice();
    const chill = G.creepById(id) ? G.creepById(id).chill : 0;
    const chillT = G.creepById(id) ? G.creepById(id).chillT : 0;
    G.sell(spot.r, spot.c);                 // silence the turret
    G.clearLog();
    for (let i = 0; i < 320; i++) G.step(0.02, 1);   // 6.4 s: let the burn finish
    const after = G.log().slice();
    G.setLog(false);
    const sum = (log, f) => log.filter(f).reduce((a, e) => a + e.amt, 0);
    return { st, spot, id, chill, chillT,
             kin: sum(shot, e => e.type === 'kin'),
             ele: sum(shot, e => e.type === 'ele'),
             dot: sum(after, e => e.tag === 'dot'),
             shot, after };
  }
  /* three bodies in a line: primary in range, an arc target 2 cells on, and a
     bystander half a cell past that (inside the arc target's blast) */
  function threeInLine(mods, sideMap) {
    fresh();
    const spot = plusSpot();
    G.place('turret', spot.r, spot.c);
    if (sideMap) { for (const k of Object.keys(sideMap)) {
      const [dr,dc] = ORTHO[+k]; G.place(sideMap[k], spot.r+dr, spot.c+dc); } }
    else ring(spot, mods);
    const st = G.turretStats(spot.r, spot.c);
    const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
    const prim = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2, y:y0, d:900 });
    const arcT = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2 + cs*2.0, y:y0, d:10 });
    const near = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2 + cs*2.0 + cs*0.5, y:y0, d:5 });
    G.setLog(true);
    G.step(0.001, 1);
    const shot = G.log().slice();
    const chills = [prim, arcT, near].map(i => { const c = G.creepById(i); return c ? +c.chill.toFixed(4) : 0; });
    G.sell(spot.r, spot.c);
    G.clearLog();
    for (let i = 0; i < 320; i++) G.step(0.02, 1);
    const after = G.log().slice();
    G.setLog(false);
    const kinOf = id => +shot.filter(e => e.id === id && e.type === 'kin').reduce((a,e)=>a+e.amt,0).toFixed(4);
    const dotOf = id => +after.filter(e => e.id === id && e.tag === 'dot').reduce((a,e)=>a+e.amt,0).toFixed(4);
    return { st, ids:{ prim, arcT, near },
             kin:{ prim:kinOf(prim), arcT:kinOf(arcT), near:kinOf(near) },
             dot:{ prim:dotOf(prim), arcT:dotOf(arcT), near:dotOf(near) },
             chills, hitCount: new Set(shot.filter(e=>e.type==='kin').map(e=>e.id)).size };
  }
  /* a legal wall cell, plus its module-capable (non-road, in-board) sides */
  function wallSpot() {
    for (const p of G.pathCellList()) {
      if (!G.canPlace('wall', p.r, p.c)) continue;
      const free = ORTHO.map(([dr,dc]) => ({ r:p.r+dr, c:p.c+dc }))
        .filter(q => G.canPlace('fire', q.r, q.c));
      if (free.length >= 2) return { cell:p, free };
    }
    return null;
  }
  function freeSideCounts() {
    const out = [];
    for (const p of G.pathCellList()) {
      if (!G.canPlace('wall', p.r, p.c)) continue;
      out.push(ORTHO.map(([dr,dc]) => ({ r:p.r+dr, c:p.c+dc }))
        .filter(q => G.canPlace('fire', q.r, q.c)).length);
    }
    return out;
  }
  return { fresh, plusSpot, bigSpot, ring, oneShot, threeInLine, wallSpot, freeSideCounts, ORTHO, DIAG };
})()`;

/* ---------------------- synthetic touch, per the notes ----------------- */
const TOUCH = `(() => {
  function ev(kind, x, y) {
    const el = document.getElementById('cv');
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent(kind, {
      bubbles: true, cancelable: true,
      touches: kind === 'touchend' ? [] : [t],
      targetTouches: kind === 'touchend' ? [] : [t],
      changedTouches: [t],
    }));
  }
  return {
    tap(x, y) { ev('touchstart', x, y); ev('touchend', x, y); },
    drag(x0, y0, x1, y1) {
      ev('touchstart', x0, y0);
      for (let i = 1; i <= 6; i++) ev('touchmove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6);
      ev('touchend', x1, y1);
    },
  };
})()`;

(async () => {
  const browser = await chromium.launch(
    Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] },
      executablePath ? { executablePath } : {}));
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const errs = [];
  /* Print page errors the MOMENT they happen. Collecting them for a check at
     the very end hides the fact that a crash inside draw() stops the canvas
     updating, which then surfaces as a baffling stale-hitbox failure fifty
     checks later instead of as the crash it is. */
  page.on('pageerror', e => { errs.push(e.message); console.log('  !! PAGE ERROR: ' + e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await page.goto(GAME, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(250);
  await page.evaluate('window.__H = ' + HELPERS);
  await page.evaluate('window.__T = ' + TOUCH);
  // forwards an optional argument — page.evaluate(fn) alone silently passes
  // undefined, which is how the first version of the frozen-board regression
  // test threw on `BAR_TABS.find(...).id` instead of testing anything
  const P = async (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));

  /* =================================================================== */
  group('the base turret — unchanged by the redesign');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      const s = G.turretStats(spot.r, spot.c);
      G.setLog(true);
      G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      for (let i = 0; i < 1000; i++) G.step(0.01, 1);
      const log = G.log().filter(e => e.type === 'kin');
      G.setLog(false);
      return { s, shots: log.length, amts: [...new Set(log.map(e => +e.amt.toFixed(6)))] };
    });
    check('a turret still deals exactly 10 kinetic a hit', near(r.s.D, 10), r.s.D);
    check('a turret still fires exactly once a second', near(r.s.rate, 1), r.s.rate);
    check('a turret still reaches 2.6 cells', near(r.s.rangeCells, 2.6), r.s.rangeCells);
    check('100% hit chance — ten seconds is ten or eleven identical hits',
      (r.shots === 10 || r.shots === 11) && r.amts.length === 1 && near(r.amts[0], 10),
      { shots: r.shots, amts: r.amts });
    check('a bare turret carries no payload beyond its kinetic hit',
      r.s.dot === 0 && r.s.chill === 0 && r.s.hops === 0 && r.s.blast === 0, r.s);
  }

  /* =================================================================== */
  group('THE WORKED EXAMPLE — ELEC + BLAST + FIRE + ICE, one per side');
  {
    // sides are indexed [up, down, left, right]
    const r = await P(() => window.__H.threeInLine(null, { 0:'elec', 1:'blast', 2:'fire', 3:'ice' }));
    check('the payload is 10 kinetic, a 7.5 burn, one hop at 50%, a 25% splash',
      near(r.st.D, 10) && near(r.st.dot, 7.5, 1e-4) && r.st.hops === 1 &&
      near(r.st.xfer, 0.5, 1e-4) && near(r.st.blast, 0.25, 1e-4),
      { D:r.st.D, dot:r.st.dot, hops:r.st.hops, xfer:r.st.xfer, blast:r.st.blast });
    check('main target takes 12.5 kinetic — 10 direct plus its own 2.5 splash',
      near(r.kin.prim, 12.5, 1e-3), r.kin.prim);
    check('main target burns for 9.375 — 7.5 direct plus 1.875 from the splash',
      near(r.dot.prim, 9.375, 1e-3), r.dot.prim);
    check('the arc target takes 6.25 kinetic — 5 transferred plus its own 1.25 splash',
      near(r.kin.arcT, 6.25, 1e-3), r.kin.arcT);
    check('the arc target burns for 4.6875', near(r.dot.arcT, 4.6875, 1e-3), r.dot.arcT);
    check('a bystander in the arc target’s blast takes 1.25 kinetic and 0.9375 burn',
      near(r.kin.near, 1.25, 1e-3) && near(r.dot.near, 0.9375, 1e-3),
      { kin:r.kin.near, dot:r.dot.near });
    check('all three are chilled at FULL potency — effects do not decay',
      r.chills.every(c => near(c, 0.25, 1e-4)), r.chills);
  }

  /* =================================================================== */
  group('AMP — +50% damage a module, and everything scales with it');
  {
    const r = await P(async () => {
      const G = window.__TB, H = window.__H;
      const out = {};
      for (const n of [1, 2, 3, 4]) {
        const res = H.oneShot(Array.from({ length:n }, () => 'amp'));
        out['n' + n] = { D:+res.st.D.toFixed(4), kin:+res.kin.toFixed(4) };
      }
      return { out, curve: G.consts().AMP_DMG };
    });
    check('one AMP is +50% kinetic', near(r.out.n1.D, 15, 1e-4), r.out.n1);
    check('four AMP is +260% kinetic', near(r.out.n4.D, 36, 1e-4), r.out.n4);
    check('AMP damage is what actually lands', near(r.out.n4.kin, 36, 1e-3), r.out.n4);
    check('the AMP curve has increasing returns per module',
      r.curve[2] > 2 * r.curve[1] && r.curve[3] - r.curve[2] > r.curve[2] - r.curve[1], r.curve);

    const amped = await P(() => window.__H.oneShot(['amp', 'amp', 'fire', 'fire']));
    check('a burn is a fraction of the AMPED hit, not the base one',
      amped.st.D > 10 && near(amped.st.dot, amped.st.D * 2.0, 1e-3),
      { D:amped.st.D, dot:amped.st.dot });
  }

  /* =================================================================== */
  group('FIRE — a burn worth a fraction of the hit, over 5 s, elemental');
  {
    const r = await P(() => {
      const H = window.__H;
      const out = {};
      for (const n of [1, 2, 3, 4]) {
        const res = H.oneShot(Array.from({ length:n }, () => 'fire'));
        out['n' + n] = { dot:+res.st.dot.toFixed(4), landed:+res.dot.toFixed(4) };
      }
      return out;
    });
    check('one FIRE burns for 75% of the hit', near(r.n1.dot, 7.5, 1e-4), r.n1);
    check('four FIRE burn for 700% of the hit', near(r.n4.dot, 70, 1e-4), r.n4);
    check('the burn actually delivers its whole total',
      near(r.n1.landed, 7.5, 1e-2) && near(r.n4.landed, 70, 1e-1), r);
    check('FIRE has increasing returns — four is far more than four times one',
      r.n4.dot > 4 * r.n1.dot, { one:r.n1.dot, four:r.n4.dot });

    const shape = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'fire', 'fire', 'fire']);
      const id = G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      G.step(0.001, 1);
      G.sell(spot.r, spot.c);
      G.setLog(true);
      for (let i = 0; i < 125; i++) G.step(0.02, 1);   // 2.5 s — halfway
      const half = G.log().filter(e => e.tag === 'dot').reduce((a, e) => a + e.amt, 0);
      const mid = G.creepById(id);
      for (let i = 0; i < 160; i++) G.step(0.02, 1);
      const after = G.creepById(id);
      G.setLog(false);
      return { half, midBurn: !!mid.burn, afterBurn: !!after.burn, dur: G.consts().FIRE_T };
    });
    check('the burn runs over 5 s — half of it has landed by 2.5 s',
      near(shape.half, 35, 1.5) && shape.dur === 5, { half: shape.half, dur: shape.dur });
    check('the burn is still running at 2.5 s and gone by 5 s',
      shape.midBurn && !shape.afterBurn, shape);

    const res = await P(() => window.__H.oneShot(['fire','fire','fire','fire'], { res: 0.5 }));
    check('the burn is ELEMENTAL — a 50% resist halves it', near(res.dot, 35, 0.2), res.dot);

    const refresh = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire','fire','fire','fire']);
      const id = G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      G.setLog(true);
      for (let i = 0; i < 400; i++) G.step(0.02, 1);   // 8 s of continuous fire
      const dps = G.log().filter(e => e.tag === 'dot').reduce((a,e)=>a+e.amt,0) / 8;
      G.setLog(false);
      const b = G.creepById(id).burn;
      return { dps, burnDps: b ? +b.dps.toFixed(3) : 0 };
    });
    check('the burn REFRESHES rather than stacking — sustained rate is total/duration',
      near(refresh.burnDps, 14, 0.6) && refresh.dps < 20,
      { burnDps: refresh.burnDps, measuredDps: +refresh.dps.toFixed(2) });
  }

  /* =================================================================== */
  group('ICE — chill only: no damage at all');
  {
    const r = await P(() => {
      const H = window.__H;
      const out = {};
      for (const n of [1, 2, 3, 4]) {
        const res = H.oneShot(Array.from({ length:n }, () => 'ice'));
        out['n' + n] = { chill:+res.st.chill.toFixed(4), chillT:+res.st.chillT.toFixed(3),
                         kin:+res.kin.toFixed(4), ele:+res.ele.toFixed(4), dot:+res.dot.toFixed(4) };
      }
      return out;
    });
    check('ICE deals NO damage — the whole hit is still just the turret’s 10 kinetic',
      near(r.n4.kin, 10, 1e-4) && near(r.n4.ele, 0) && near(r.n4.dot, 0), r.n4);
    check('one ICE chills 25% for 2 s', near(r.n1.chill, 0.25, 1e-4) && near(r.n1.chillT, 2, 1e-3), r.n1);
    check('four ICE chill 75% for 3.5 s', near(r.n4.chill, 0.75, 1e-4) && near(r.n4.chillT, 3.5, 1e-3), r.n4);
    check('ICE has increasing returns', r.n4.chill > 2 * r.n1.chill, { one:r.n1.chill, four:r.n4.chill });

    const slows = await P(() => {
      const G = window.__TB, H = window.__H;
      /* Put the ICE turret where it actually covers the road, and give it ONE
         creep to shoot: the first version spawned a pinned dummy too, and
         since a turret picks the enemy FURTHEST along it shot that instead
         and the walker was never chilled at all. */
      function walkFor(withIce) {
        H.fresh();
        const samples = G.pathSamples(120), rng = 2.6 * G.cellSize();
        let spot = null, bestCov = 0;
        for (const c of G.buildableCells('turret')) {
          const x = G.cellCx(c.c), y = G.cellCy(c.r);
          // only the EARLY path counts: the walker gets 15 s, so a turret
          // covering the far end of a 26-cell road would never see it
          const cov = samples.slice(0, 40).filter(s => Math.hypot(s.x - x, s.y - y) <= rng).length;
          const sidesFree = H.ORTHO.every(([dr, dc]) => G.canPlace('fire', c.r + dr, c.c + dc));
          if (cov > bestCov && sidesFree) { bestCov = cov; spot = c; }
        }
        if (withIce) { G.place('turret', spot.r, spot.c); H.ring(spot, ['ice','ice','ice','ice']); }
        const id = G.spawnDummy({ hp:1e9, d:0, spd:1.25, pinned:false });
        let chilled = 0;
        for (let i = 0; i < 750; i++) {
          G.step(0.02, 1);
          const c = G.creepById(id);
          if (c && c.chillT > 0) chilled = Math.max(chilled, c.chill);
        }
        const c = G.creepById(id);
        return { d: c ? +c.d.toFixed(1) : 1e9, chill: chilled };
      }
      const plain = walkFor(false), iced = walkFor(true);
      return { freeD:plain.d, chD:iced.d, chC:iced.chill };
    });
    check('chill slows MOVEMENT', slows.chC > 0 && slows.chD < slows.freeD * 0.9, slows);

    const atk = await P(() => {
      const G = window.__TB, H = window.__H;
      function wallDamageOver(sec, chilled) {
        H.fresh();
        const w = H.wallSpot();
        G.place('wall', w.cell.r, w.cell.c);
        if (chilled) { G.place('ice', w.free[0].r, w.free[0].c); G.place('ice', w.free[1].r, w.free[1].c); }
        const before = G.wallStats(w.cell.r, w.cell.c).hp;
        G.spawnDummy({ hp:1e9, d:0, spd:1.25, pinned:false });
        for (let i = 0; i < sec / 0.02; i++) G.step(0.02, 1);
        const s = G.wallStats(w.cell.r, w.cell.c);
        return { lost: before - s.hp, maxHp: s.maxHp };
      }
      return { plain: wallDamageOver(12, false), chilled: wallDamageOver(12, true) };
    });
    check('chill slows ATTACK SPEED — a chilling wall takes fewer hits in the same time',
      atk.chilled.lost < atk.plain.lost, atk);
  }

  /* =================================================================== */
  group('ELEC — arcs to one more enemy, carrying half the payload');
  {
    const r = await P(() => {
      const H = window.__H;
      const out = {};
      for (const n of [1, 2, 3, 4]) {
        const res = H.oneShot(Array.from({ length:n }, () => 'elec'));
        out['n' + n] = { hops:res.st.hops, xfer:+res.st.xfer.toFixed(4) };
      }
      return out;
    });
    const curve = await P(() => window.__TB.consts());
    check('one ELEC is one hop at 50%', r.n1.hops === 1 && near(r.n1.xfer, 0.5, 1e-4), r.n1);
    check('three ELEC are three hops at 66%', r.n3.hops === 3 && near(r.n3.xfer, 0.66, 1e-4), r.n3);
    /* Four of a kind is ALSO the TESLA COIL combo (+2 hops), so the raw curve
       has to be read off the table and the combo asserted on top of it — the
       first version of this test read 6 hops and called it a bug. */
    check('the raw curve is four hops at 75% for four modules',
      curve.ELEC_HOPS[4] === 4 && near(curve.ELEC_XFER[4], 0.75, 1e-9), curve.ELEC_HOPS);
    check('four ELEC is that curve plus TESLA COIL’s two extra hops',
      r.n4.hops === curve.ELEC_HOPS[4] + 2 && near(r.n4.xfer, 0.75, 1e-4), r.n4);
    check('ELEC has increasing returns in both hops and transfer',
      r.n4.hops > r.n1.hops && r.n4.xfer > r.n1.xfer, r);

    const chain = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['elec','elec','elec']);   // three: no TESLA COIL in the way
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const prim = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2, y:y0, d:900 });
      const rest = [];
      for (let i = 1; i <= 6; i++) rest.push(G.spawnDummy({ hp:1e9, x:x0 + cs*(1.2 + 2.0*i), y:y0, d:10 }));
      G.setLog(true);
      G.step(0.001, 1);
      const log = G.log().filter(e => e.type === 'kin');
      G.setLog(false);
      const byId = {};
      for (const e of log) byId[e.id] = +((byId[e.id] || 0) + e.amt).toFixed(4);
      const ids = Object.keys(byId).map(Number);
      return { byId, n: ids.length, prim, dup: log.length !== ids.length ? 0 : 1,
               order: ids.map(i => byId[i]) };
    });
    check('three ELEC reach four targets — the primary plus three hops',
      chain.n === 4, { targets: chain.n, damage: chain.byId });
    check('each hop carries 75% of the one before it — damage decays down the chain',
      chain.order.every((v, i) => i === 0 || v < chain.order[i - 1] + 1e-9),
      chain.order);
    check('a bolt only ever hits a target once', chain.dup === 1, chain);
    check('the chain starts on the turret’s own target',
      near(chain.byId[chain.prim], 10, 1e-3), chain.byId[chain.prim]);
  }

  /* =================================================================== */
  group('BLAST — splashes a fraction of the payload over a radius');
  {
    const r = await P(() => {
      const H = window.__H;
      const out = {};
      for (const n of [1, 2, 3, 4]) {
        const res = H.oneShot(Array.from({ length:n }, () => 'blast'));
        out['n' + n] = { blast:+res.st.blast.toFixed(4), radius:+res.st.blastR.toFixed(3),
                         kin:+res.kin.toFixed(4) };
      }
      return out;
    });
    check('one BLAST splashes 25%', near(r.n1.blast, 0.25, 1e-4), r.n1);
    check('four BLAST splash 110%', near(r.n4.blast, 1.10, 1e-4), r.n4);
    check('the radius grows with the stack', r.n4.radius > r.n1.radius, r);
    check('the primary takes its own splash — 10 plus 25% of 10',
      near(r.n1.kin, 12.5, 1e-3), r.n1.kin);
    check('BLAST has increasing returns', r.n4.blast > 4 * r.n1.blast, { one:r.n1.blast, four:r.n4.blast });

    const area = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['blast','blast','blast','blast']);
      const st = G.turretStats(spot.r, spot.c);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const px = x0 + cs * 1.2;
      const inA = G.spawnDummy({ hp:1e9, x:px, y:y0, d:900 });
      const inB = G.spawnDummy({ hp:1e9, x:px + cs*0.5, y:y0, d:10 });
      const out1 = G.spawnDummy({ hp:1e9, x:px + cs*8.0, y:y0, d:10 });
      G.setLog(true); G.step(0.001, 1);
      const log = G.log().filter(e => e.type === 'kin');
      G.setLog(false);
      const of = id => +log.filter(e => e.id === id).reduce((a,e)=>a+e.amt,0).toFixed(4);
      return { radius:+st.blastR.toFixed(2), inA:of(inA), inB:of(inB), out:of(out1) };
    });
    check('everything inside the radius is caught, and nothing outside it',
      area.inA > 0 && area.inB > 0 && area.out === 0, area);
    check('a bystander in the blast takes the splash but not the direct hit',
      near(area.inB, 11, 0.2) && area.inA > area.inB, area);
  }

  /* =================================================================== */
  group('the judgement call — damage decays, EFFECTS do not');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['ice', 'blast', 'ice', 'blast']);
      const st = G.turretStats(spot.r, spot.c);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const px = x0 + cs * 1.2;
      // the bystander sits INSIDE the primary's blast radius — the first
      // version put it 2 cells away, outside it, and measured nothing
      const prim = G.spawnDummy({ hp:1e9, x:px, y:y0, d:900 });
      const by = G.spawnDummy({ hp:1e9, x:px + cs * 0.4, y:y0, d:10 });
      const out = G.spawnDummy({ hp:1e9, x:px + cs * 9, y:y0, d:5 });
      G.setLog(true); G.step(0.001, 1);
      const log = G.log(); G.setLog(false);
      const kin = id => +log.filter(e => e.id === id && e.type === 'kin').reduce((a,e)=>a+e.amt,0).toFixed(4);
      const ch = id => { const c = G.creepById(id); return c ? +c.chill.toFixed(4) : 0; };
      return { blastR:+st.blastR.toFixed(3), source:ch(prim), caught:ch(by), outside:ch(out),
               kinPrim:kin(prim), kinBy:kin(by) };
    });
    check('ICE + BLAST chills everything in the blast radius, at full potency',
      r.caught > 0 && near(r.source, r.caught, 1e-4) && r.outside === 0, r);
    check('…while the DAMAGE it carries there is only the transferred fraction',
      r.kinBy > 0 && r.kinBy < r.kinPrim, r);
    const el = await P(() => window.__H.threeInLine(null, { 0:'ice', 1:'elec', 2:'ice', 3:'elec' }));
    check('ICE + ELEC carries the full chill down the arc, though damage halves',
      near(el.chills[0], el.chills[1], 1e-4) && el.kin.arcT < el.kin.prim,
      { chills: el.chills, kin: el.kin });
  }

  /* =================================================================== */
  group('continuous tracking, and an instant snap');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const a = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2, y:y0, d:900 });
      const b = G.spawnDummy({ hp:1e9, x:x0 - cs*1.2, y:y0, d:100 });
      G.step(0.001, 1);
      const held1 = G.turretStats(spot.r, spot.c).tid;
      for (let i = 0; i < 30; i++) G.step(0.02, 1);
      const held2 = G.turretStats(spot.r, spot.c).tid;   // still the same one
      // kill the held target: the very next frame must retarget
      G.clearCreeps();
      const c = G.spawnDummy({ hp:1e9, x:x0 + cs*1.0, y:y0, d:400 });
      G.step(0.001, 1);
      const snapped = G.turretStats(spot.r, spot.c).tid;
      return { a, b, c, held1, held2, snapped };
    });
    check('a turret locks onto the enemy furthest along and HOLDS it',
      r.held1 === r.a && r.held2 === r.a, r);
    check('when its target vanishes it snaps to the next one instantly',
      r.snapped === r.c, r);

    const oor = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const far = G.spawnDummy({ hp:1e9, x:x0 + cs*1.2, y:y0, d:900, pinned:true });
      const stay = G.spawnDummy({ hp:1e9, x:x0 + cs*1.0, y:y0, d:100 });
      G.step(0.001, 1);
      const before = G.turretStats(spot.r, spot.c).tid;
      // walk the held target clean out of range by moving it
      G.moveCreep(far, x0 + cs * 40, y0);
      G.step(0.001, 1);
      const after = G.turretStats(spot.r, spot.c).tid;
      return { far, stay, before, after };
    });
    check('a target that walks out of range is dropped for the next one, same frame',
      oor.before === oor.far && oor.after === oor.stay, oor);
  }

  /* =================================================================== */
  group('diagonal synergy boosters');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      const out = {};
      // the CD's claim: two BLAST plus a TWIN transfers the FULL payload
      H.fresh();
      let sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('blast', sp.r, sp.c - 1);   // left
      G.place('blast', sp.r + 1, sp.c);   // bottom
      out.twoBlast = +G.turretStats(sp.r, sp.c).blast.toFixed(4);
      G.place('twin', sp.r + 1, sp.c - 1);
      out.twoBlastTwin = +G.turretStats(sp.r, sp.c).blast.toFixed(4);
      // TWIN must do nothing on a mixed turret
      H.fresh();
      sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('blast', sp.r, sp.c - 1);
      G.place('fire', sp.r + 1, sp.c);
      const beforeTwin = +G.turretStats(sp.r, sp.c).blast.toFixed(4);
      G.place('twin', sp.r + 1, sp.c - 1);
      out.mixedTwin = { before: beforeTwin, after: +G.turretStats(sp.r, sp.c).blast.toFixed(4),
                        mul: +G.turretStats(sp.r, sp.c).boostMul.toFixed(3) };
      // PRISM rewards variety
      H.fresh(); sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('blast', sp.r, sp.c - 1); G.place('fire', sp.r + 1, sp.c);
      const p2 = +G.turretStats(sp.r, sp.c).blast.toFixed(4);
      G.place('prism', sp.r + 1, sp.c - 1);
      out.prism = { before:p2, after:+G.turretStats(sp.r, sp.c).blast.toFixed(4) };
      // RELAY rewards touching turrets
      H.fresh(); sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('blast', sp.r, sp.c - 1);
      G.place('relay', sp.r + 1, sp.c - 1);
      const noNeighbour = +G.turretStats(sp.r, sp.c).blast.toFixed(4);
      G.place('turret', sp.r - 1, sp.c);
      out.relay = { alone:noNeighbour, paired:+G.turretStats(sp.r, sp.c).blast.toFixed(4) };
      // CLOCK is fire rate only
      H.fresh(); sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('fire', sp.r, sp.c - 1);
      const r0 = G.turretStats(sp.r, sp.c);
      G.place('clock', sp.r + 1, sp.c - 1);
      const r1 = G.turretStats(sp.r, sp.c);
      out.clock = { rate0:+r0.rate.toFixed(4), rate1:+r1.rate.toFixed(4),
                    dot0:+r0.dot.toFixed(4), dot1:+r1.dot.toFixed(4) };
      out.cap = G.consts().BOOST_CAP;
      return out;
    });
    check('two BLAST modules splash 50% of the payload', near(r.twoBlast, 0.50, 1e-4), r.twoBlast);
    check('…and a TWIN booster takes that to a FULL 100% — the CD’s own example',
      near(r.twoBlastTwin, 1.00, 1e-4), r.twoBlastTwin);
    check('TWIN does nothing at all on a mixed turret',
      near(r.mixedTwin.before, r.mixedTwin.after, 1e-6) && near(r.mixedTwin.mul, 1, 1e-6), r.mixedTwin);
    check('PRISM is the mirror image — it pays for variety',
      r.prism.after > r.prism.before, r.prism);
    check('RELAY pays for turrets touching this one',
      r.relay.paired > r.relay.alone, r.relay);
    check('CLOCK buys fire rate and leaves the modules alone',
      r.clock.rate1 > r.clock.rate0 && near(r.clock.dot0, r.clock.dot1, 1e-6), r.clock);

    const diag = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('fire', sp.r, sp.c - 1);
      const base = G.turretStats(sp.r, sp.c).rate;
      G.place('clock', sp.r - 1, sp.c);          // ORTHOGONAL — must be inert
      const ortho = G.turretStats(sp.r, sp.c).rate;
      G.place('clock', sp.r + 1, sp.c + 1);      // DIAGONAL — must apply
      const dg = G.turretStats(sp.r, sp.c).rate;
      return { base:+base.toFixed(4), ortho:+ortho.toFixed(4), diag:+dg.toFixed(4) };
    });
    check('a booster on a SIDE does nothing — boosters are diagonal-only',
      near(diag.base, diag.ortho, 1e-6) && diag.diag > diag.ortho, diag);

    const shared = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      // one booster diagonally between two turrets pays both
      let a = null;
      for (const c of G.buildableCells('turret')) {
        if (G.canPlace('turret', c.r + 2, c.c + 2) && G.canPlace('clock', c.r + 1, c.c + 1)) { a = c; break; }
      }
      G.place('turret', a.r, a.c);
      G.place('turret', a.r + 2, a.c + 2);
      const b0 = G.turretStats(a.r, a.c).rate, b1 = G.turretStats(a.r + 2, a.c + 2).rate;
      G.place('clock', a.r + 1, a.c + 1);
      return { before:[+b0.toFixed(3), +b1.toFixed(3)],
               after:[+G.turretStats(a.r, a.c).rate.toFixed(3), +G.turretStats(a.r + 2, a.c + 2).rate.toFixed(3)] };
    });
    check('a booster is SHARED — one diagonal tile lifts both turrets it touches',
      shared.after[0] > shared.before[0] && shared.after[1] > shared.before[1], shared);
  }

  /* =================================================================== */
  group('named combos — the things worth remembering');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      const ORTHO = H.ORTHO;
      const out = { pairs:{}, quads:{} };
      function build(sides) {
        H.fresh();
        const sp = H.plusSpot();
        G.place('turret', sp.r, sp.c);
        sides.forEach((k, i) => { const [dr, dc] = ORTHO[i]; if (k) G.place(k, sp.r + dr, sp.c + dc); });
        return G.turretStats(sp.r, sp.c);
      }
      // every documented pair combo, built in one orientation and its mirror
      const pairSpecs = [
        ['blast', 'fire'], ['blast', 'ice'], ['blast', 'elec'], ['amp', 'blast'],
        ['amp', 'fire'], ['amp', 'ice'], ['amp', 'elec'], ['elec', 'fire'],
        ['elec', 'ice'], ['fire', 'ice'],
      ];
      for (const [a, b] of pairSpecs) {
        const s1 = build([a, a, b, b]);            // up/down = a, left/right = b
        const s2 = build([b, b, a, a]);            // mirrored
        out.pairs[a + '+' + b] = { combo:s1.combo, name:s1.comboName, mirror:s2.combo };
      }
      for (const k of ['amp', 'fire', 'ice', 'elec', 'blast']) {
        const s = build([k, k, k, k]);
        out.quads[k] = { combo:s.combo, name:s.comboName };
      }
      // adjacent (non-opposite) pairs must NOT make a combo
      const adj = build(['blast', null, 'fire', null]);
      out.adjacent = adj.combo;
      const three = build(['blast', 'blast', 'fire', null]);
      out.incomplete = three.combo;
      out.total = Object.keys(G.COMBOS).length;
      return out;
    });
    const pairKeys = Object.keys(r.pairs);
    check('every documented opposite-pair combo is found',
      pairKeys.every(k => r.pairs[k].combo), r.pairs);
    check('combos are rotation-invariant — the mirrored build finds the same one',
      pairKeys.every(k => r.pairs[k].combo === r.pairs[k].mirror), r.pairs);
    check('every four-of-a-kind combo is found',
      Object.keys(r.quads).every(k => r.quads[k].combo), r.quads);
    check('the grenade launcher is exactly the CD’s pattern',
      r.pairs['blast+fire'].combo === 'grenade' &&
      /INCENDIARY GRENADE LAUNCHER/.test(r.pairs['blast+fire'].name), r.pairs['blast+fire']);
    check('an ADJACENT pair is not a combo — the pattern has to be opposite sides',
      r.adjacent === null, r.adjacent);
    check('three sides is not a combo either — all four must be filled',
      r.incomplete === null, r.incomplete);
    check('there are at least ten combos to discover', r.total >= 10, r.total);

    /* the effects themselves */
    const eff = await P(() => {
      const G = window.__TB, H = window.__H;
      const ORTHO = H.ORTHO;
      function build(sides) {
        H.fresh();
        const sp = H.plusSpot();
        G.place('turret', sp.r, sp.c);
        sides.forEach((k, i) => { const [dr, dc] = ORTHO[i]; if (k) G.place(k, sp.r + dr, sp.c + dc); });
        return { sp, st: G.turretStats(sp.r, sp.c) };
      }
      const out = {};
      /* Every build() calls fresh(), which WIPES the board — so all of them
         have to happen before anything is measured off an earlier one. The
         first version read grenadeR with a build() inside the object literal,
         which reset the board out from under the ground-fire check. */
      // GRENADE: bigger radius + burning ground
      const twoBlastR = +build(['blast', 'blast', null, null]).st.blastR.toFixed(3);
      const gren = build(['blast', 'blast', 'fire', 'fire']);
      out.grenadeR = { two: twoBlastR, combo: +gren.st.blastR.toFixed(3) };
      {
        const cs = G.cellSize();
        G.spawnDummy({ hp:1e9, x:G.cellCx(gren.sp.c) + cs*1.2, y:G.cellCy(gren.sp.r), d:500 });
        G.step(0.001, 1);
        out.groundFire = G.st().grounds;
      }
      const plain = build(['blast', 'blast', 'blast', 'blast']).st;
      // TESLA: +2 hops
      const teslaBase = build(['elec','elec','elec',null]).st;
      const tesla = build(['elec','elec','elec','elec']).st;
      out.tesla = { hops3:teslaBase.hops, quad:tesla.hops, floor:tesla.xfer };
      // SIEGE: range and pierce
      const ampBase = build(['amp','amp','amp',null]).st;
      const siege = build(['amp','amp','amp','amp']).st;
      out.siege = { r0:+ampBase.rangeCells.toFixed(3), r1:+siege.rangeCells.toFixed(3), pierce:siege.eff.pierce };
      // LANCE: burn ignores resist
      const lance = build(['amp','amp','fire','fire']);
      {
        const cs = G.cellSize();
        const id = G.spawnDummy({ hp:1e9, res:0.9, x:G.cellCx(lance.sp.c) + cs*1.2, y:G.cellCy(lance.sp.r), d:500 });
        G.setLog(true); G.step(0.001, 1); G.sell(lance.sp.r, lance.sp.c); G.clearLog();
        for (let i = 0; i < 320; i++) G.step(0.02, 1);
        out.lanceDot = +G.log().filter(e => e.tag === 'dot').reduce((a,e)=>a+e.amt,0).toFixed(3);
        out.lanceExpected = +lance.st.dot.toFixed(3);
        G.setLog(false);
      }
      // HAILSTORM: chill shreds armour
      out.hail = build(['ice','ice','ice','ice']).st.eff.chillShred;
      // FROSTBITE: chilled enemies take more
      out.frost = build(['amp','amp','ice','ice']).st.eff.chillAmp;
      // RAILGUN: one hop at full strength
      const rail = build(['amp','amp','elec','elec']).st;
      out.rail = { hops:rail.hops, xfer:rail.xfer };
      // BLIZZARD: +2 hops and longer reach
      const blizBase = build(['elec','elec',null,null]).st;
      const bliz = build(['elec','elec','ice','ice']).st;
      out.bliz = { hops0:blizBase.hops, hops1:bliz.hops, r0:+blizBase.hopR.toFixed(2), r1:+bliz.hopR.toFixed(2) };
      // FIRESTORM: the burn spreads
      out.firestorm = build(['fire','fire','fire','fire']).st.eff.dotSpread;
      // MORTAR: radius
      out.mortar = { quad:+plain.blastR.toFixed(3), mul:plain.eff.blastRMul };
      return out;
    });
    check('INCENDIARY GRENADE LAUNCHER widens the blast and leaves fire on the ground',
      eff.grenadeR.combo > eff.grenadeR.two && eff.groundFire > 0, eff);
    check('TESLA COIL adds two hops and floors the transfer',
      eff.tesla.quad === eff.tesla.hops3 + 1 + 2 && eff.tesla.floor >= 0.6, eff.tesla);
    check('SIEGE BATTERY extends the range and pierces armour',
      eff.siege.r1 > eff.siege.r0 && eff.siege.pierce === 0.5, eff.siege);
    check('THERMAL LANCE makes the burn ignore a 90% resist entirely',
      near(eff.lanceDot, eff.lanceExpected, 0.2), { got:eff.lanceDot, expected:eff.lanceExpected });
    check('HAILSTORM cracks 40% of a chilled enemy’s armour', eff.hail === 0.4, eff.hail);
    check('FROSTBITE makes chilled enemies take 30% more', eff.frost === 0.3, eff.frost);
    check('RAILGUN trades every hop but one for a full-strength transfer',
      eff.rail.hops === 1 && near(eff.rail.xfer, 1.0, 1e-6), eff.rail);
    check('BLIZZARD adds two hops and half again the reach',
      eff.bliz.hops1 === eff.bliz.hops0 + 2 && eff.bliz.r1 > eff.bliz.r0, eff.bliz);
    check('FIRESTORM lets the burn spread on its own', eff.firestorm > 0, eff.firestorm);
    check('MORTAR BATTERY widens the blast', eff.mortar.mul === 1.5, eff.mortar);

    const announce = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const sp = H.plusSpot();
      G.place('turret', sp.r, sp.c);
      const ORTHO = H.ORTHO;
      G.place('blast', sp.r + ORTHO[0][0], sp.c + ORTHO[0][1]);
      G.place('blast', sp.r + ORTHO[1][0], sp.c + ORTHO[1][1]);
      G.place('fire',  sp.r + ORTHO[2][0], sp.c + ORTHO[2][1]);
      const beforeFound = G.st().combosFound.length;
      G.place('fire',  sp.r + ORTHO[3][0], sp.c + ORTHO[3][1]);   // completes it
      const afterFound = G.st().combosFound.slice();
      // selling a side must retract the combo
      G.sell(sp.r + ORTHO[3][0], sp.c + ORTHO[3][1]);
      const gone = G.comboAt(sp.r, sp.c);
      return { beforeFound, afterFound, gone };
    });
    check('completing a pattern records the discovery',
      announce.beforeFound === 0 && announce.afterFound.includes('grenade'), announce);
    check('breaking the pattern retracts the combo', announce.gone === null, announce);

    /* The codex is the "learn and remember" half of the ask, so it has to
       survive a new run — and it must never list something never built. */
    const codex = await P(() => {
      const G = window.__TB, H = window.__H;
      G.clearStorage();
      H.fresh();
      const empty = G.codex().length;
      const sp = H.plusSpot();
      G.place('turret', sp.r, sp.c);
      H.ring(sp, ['blast', 'blast', 'fire', 'fire']);
      const afterBuild = G.codex().slice();
      G.newRun();                                  // a whole new run
      const afterNewRun = G.codex().slice();
      return { empty, afterBuild, afterNewRun, total: G.COMBO_TOTAL,
               stored: JSON.parse(localStorage.getItem('turretBuilder.v1.codex') || '{}') };
    });
    check('the discoveries codex starts empty and records what you build',
      codex.empty === 0 && codex.afterBuild.includes('grenade'), codex);
    check('and it PERSISTS across runs — remembering is the point',
      codex.afterNewRun.includes('grenade') && !!codex.stored.grenade, codex);
    check('the codex never lists a combo that was not built',
      codex.afterNewRun.length === 1 && codex.total > 1, codex);
  }

  /* =================================================================== */
  group('the grid — four sides, orthogonal only, shared');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'ice', 'elec', 'blast']);
      const mods = G.modsAt(spot.r, spot.c);
      const total = G.COMBAT_MODS.reduce((a, k) => a + mods[k], 0);
      const sidesFull = H.ORTHO.every(([dr, dc]) => G.tileAt(spot.r + dr, spot.c + dc) !== null);
      const diag = G.place('fire', spot.r - 1, spot.c - 1);
      const after = G.modsAt(spot.r, spot.c);
      return { mods, total, sidesFull, diagPlaced: diag,
               afterTotal: G.COMBAT_MODS.reduce((a, k) => a + after[k], 0) };
    });
    check('a turret takes four modules and there is nowhere to put a fifth',
      r.total === 4 && r.sidesFull, r);
    check('a MODULE on a diagonal still grants nothing — that space is the boosters’',
      r.diagPlaced === true && r.afterTotal === 4, r);

    const shared = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      let a = null;
      for (const c of G.buildableCells('turret'))
        if (G.canPlace('turret', c.r, c.c + 2) && G.canPlace('fire', c.r, c.c + 1)) { a = c; break; }
      G.place('turret', a.r, a.c);
      G.place('turret', a.r, a.c + 2);
      G.place('fire', a.r, a.c + 1);
      return { left: G.modsAt(a.r, a.c).fire, right: G.modsAt(a.r, a.c + 2).fire,
               fed: G.tileAt(a.r, a.c + 1).fed, links: G.st().links };
    });
    check('one module wedged between two turrets still pays BOTH',
      shared.left === 1 && shared.right === 1 && shared.fed === 2, shared);

    const wallOnly = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['armor', 'regen']);
      const m = G.modsAt(spot.r, spot.c);
      return { armor:m.armor, regen:m.regen, fed:G.tileAt(spot.r - 1, spot.c).fed };
    });
    check('ARMOR and REGEN are still wall hardware only',
      wallOnly.armor === 0 && wallOnly.regen === 0 && wallOnly.fed === 0, wallOnly);

    const cap = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const before = G.st().turretCap;
      let placed = 0;
      for (const c of G.buildableCells('turret')) if (G.place('turret', c.r, c.c)) placed++;
      const capped = G.st().turrets;
      G.addCores(300); G.buyLab('grid');
      return { before, placed, capped, after:G.st().turretCap, base:G.consts().TURRET_CAP_BASE };
    });
    check('the turret cap is enforced to the tile',
      cap.before === cap.base && cap.capped === cap.base && cap.placed === cap.base, cap);
    check('a GRID lab tier buys exactly one more turret slot', cap.after === cap.before + 1, cap);
  }

  /* =================================================================== */
  group('damage types — armour eats kinetic, resist eats elemental');
  {
    const r = await P(() => {
      const H = window.__H;
      return {
        armoured: +H.oneShot([], { arm: 7 }).kin.toFixed(4),
        heavy:    +H.oneShot([], { arm: 100 }).kin.toFixed(4),
        resistant:+H.oneShot([], { res: 0.6 }).kin.toFixed(4),
      };
    });
    check('armour is a FLAT cut off a kinetic hit — 10 against armour 7 lands 3',
      near(r.armoured, 3, 1e-4), r.armoured);
    check('armour can never eat more than 85% of a hit', near(r.heavy, 1.5, 1e-4), r.heavy);
    check('resist does NOT touch kinetic', near(r.resistant, 10, 1e-4), r.resistant);

    const counters = await P(() => {
      const G = window.__TB;
      return { hulkArm:G.CREEPS.hulk.arm, hulkRes:G.CREEPS.hulk.res,
               wardArm:G.CREEPS.ward.arm, wardRes:G.CREEPS.ward.res,
               bossArm:G.CREEPS.boss.arm, bossRes:G.CREEPS.boss.res };
    });
    check('HULK answers to elemental, WARD to kinetic, the BREAKER to both',
      counters.hulkArm > 0 && counters.hulkRes === 0 &&
      counters.wardRes >= 0.5 && counters.wardArm === 0 &&
      counters.bossArm > 0 && counters.bossRes > 0, counters);

    const scaling = await P(() => {
      const G = window.__TB;
      const at = gw => G.wave(gw).filter(e => e.type === 'hulk').map(e => +e.arm.toFixed(3))[0];
      return { l1:at(4), l4:at(3 * G.WAVES_PER_LEVEL + 4), l8:at(7 * G.WAVES_PER_LEVEL + 4),
               base:G.CREEPS.hulk.arm, res:G.CREEPS.ward.res, mul1:G.armMulFor(1) };
    });
    check('armour scales with the campaign floor, so elemental stays the answer',
      scaling.l8 > scaling.l4 && scaling.l4 > scaling.l1 && near(scaling.l1, scaling.base, 1e-6), scaling);
    check('armour holds flat inside a level, and RESIST never scales at all',
      near(scaling.mul1, 1, 1e-9) && scaling.res === 0.60, scaling);
  }

  /* =================================================================== */
  group('walls — 100 HP on the road, two free sides');
  {
    const base = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      const s = G.wallStats(w.cell.r, w.cell.c);
      const counts = H.freeSideCounts();
      const offRoad = G.buildableCells('turret')[0];
      return { hp:s.hp, maxHp:s.maxHp, base:G.WALL.hp, maxSides:Math.max(...counts),
               wallOffRoad:G.canPlace('wall', offRoad.r, offRoad.c),
               turretOnRoad:G.canPlace('turret', w.cell.r, w.cell.c),
               boosterOnRoad:G.canPlace('twin', w.cell.r, w.cell.c) };
    });
    check('a wall still has a base HP of 100', base.maxHp === 100 && base.hp === 100, base);
    check('a wall on the road has at most two module-capable sides', base.maxSides <= 2, base);
    check('only walls go on the road', base.wallOffRoad === false &&
      base.turretOnRoad === false && base.boosterOnRoad === false, base);

    const block = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      const wd = G.wallStats(w.cell.r, w.cell.c).d;
      const id = G.spawnDummy({ hp:1e9, d:0, spd:1.25, pinned:false });
      for (let i = 0; i < 250; i++) G.step(0.02, 1);   // 5 s: held and chewing
      const c = G.creepById(id), s = G.wallStats(w.cell.r, w.cell.c);
      return { wd, creepD:c ? c.d : null, hp:s.hp, maxHp:s.maxHp, blocked:c && c.d < wd };
    });
    check('a creep still stops at a wall instead of walking through it',
      block.blocked === true, block);
    check('a blocked creep chews the wall down', block.hp < block.maxHp, block);

    const mods = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      G.place('armor', w.free[0].r, w.free[0].c);
      const one = G.wallStats(w.cell.r, w.cell.c);
      G.place('armor', w.free[1].r, w.free[1].c);
      const two = G.wallStats(w.cell.r, w.cell.c);
      return { one:one.maxHp, oneDr:one.dr, two:two.maxHp, twoDr:two.dr };
    });
    check('an ARMOR module is still +35% wall HP and flat damage reduction',
      mods.one === 135 && mods.oneDr === 2 && mods.two === 170 && mods.twoDr === 4, mods);

    const teeth = await P(() => {
      const G = window.__TB, H = window.__H;
      function build(kind) {
        H.fresh();
        const w = H.wallSpot();
        G.place('wall', w.cell.r, w.cell.c);
        if (kind) G.place(kind, w.free[0].r, w.free[0].c);
        const id = G.spawnDummy({ hp:1e9, d:0, spd:1.25, pinned:false });
        G.setLog(true);
        for (let i = 0; i < 700; i++) G.step(0.02, 1);
        const log = G.log(); G.setLog(false);
        const c = G.creepById(id);
        return { total:+log.reduce((a, e) => a + e.amt, 0).toFixed(3),
                 chill:c ? c.chill : 0, burn:c ? !!c.burn : false };
      }
      const bare = build(null);
      const out = { bare:bare.total };
      for (const k of ['fire', 'ice', 'elec', 'blast', 'amp']) out[k] = build(k);
      // regen on a damaged wall
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      G.place('regen', w.free[0].r, w.free[0].c);
      G.spawnDummy({ hp:1e9, d:0, spd:1.25, pinned:false });
      for (let i = 0; i < 400; i++) G.step(0.02, 1);
      const hurt = G.wallStats(w.cell.r, w.cell.c).hp;
      G.clearCreeps();
      for (let i = 0; i < 250; i++) G.step(0.02, 1);
      out.regen = { hurt:+hurt.toFixed(2), healed:+G.wallStats(w.cell.r, w.cell.c).hp.toFixed(2) };
      return out;
    });
    check('a bare wall does no damage to what hits it', near(teeth.bare, 0, 1e-9), teeth.bare);
    check('FIRE on a wall burns the attacker', teeth.fire.total > 0 && teeth.fire.burn, teeth.fire);
    check('ICE on a wall chills the attacker — the same effect it has on a turret',
      teeth.ice.chill > 0, teeth.ice);
    check('ELEC, BLAST and AMP all give a wall teeth',
      teeth.elec.total > 0 && teeth.blast.total > 0 && teeth.amp.total > 0,
      { elec:teeth.elec.total, blast:teeth.blast.total, amp:teeth.amp.total });
    check('REGEN repairs the wall between attacks', teeth.regen.healed > teeth.regen.hurt, teeth.regen);

    const wcap = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const before = G.st().wallCap;
      let placed = 0;
      for (const p of G.pathCellList()) if (G.place('wall', p.r, p.c)) placed++;
      G.addCores(400); G.buyLab('bulwark');
      return { before, placed, after:G.st().walls, capAfter:G.st().wallCap, base:G.consts().WALL_CAP_BASE };
    });
    check('the wall cap is enforced, and BULWARK buys one more slot',
      wcap.before === wcap.base && wcap.placed === wcap.base && wcap.capAfter === wcap.before + 1, wcap);
  }

  /* =================================================================== */
  group('economy');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      G.setCash(500);
      const spot = H.plusSpot();
      const before = G.st().cash;
      G.place('turret', spot.r, spot.c);
      const afterBuild = G.st().cash;
      const upCost = G.turretUpCost(1);
      G.upgrade(spot.r, spot.c);
      const lvl2 = G.turretStats(spot.r, spot.c);
      const afterUp = G.st().cash;
      G.sell(spot.r, spot.c);
      return { spent:before - afterBuild, cost:G.TURRET.cost, upCost,
               refund:G.st().cash - afterUp, total:G.TURRET.cost + upCost,
               lvl2D:lvl2.D, lvl:lvl2.lvl,
               boosterCost:G.BOOSTERS.twin.cost, iceCost:G.MODULES.ice.cost };
    });
    check('placing costs the card price', r.spent === r.cost, r);
    check('upgrading a turret still raises its damage 28% a level',
      r.lvl === 2 && near(r.lvl2D, 12.8, 1e-6), r);
    check('selling refunds half of everything sunk into a tile',
      r.refund === Math.floor(r.total * 0.5), r);
    check('boosters cost more than modules — they are the rarer decision',
      r.boosterCost > r.iceCost, r);

    const lab = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(3); G.newRun();
      const shutEarly = G.st().labOpen;
      G.unlockAll();
      const costs = [0, 1, 2].map(t => G.labCost('grid', t));
      G.addCores(2);
      const poor = G.buyLab('grid');
      G.addCores(60);
      const rich = G.buyLab('grid');
      return { shutEarly, costs, poor, rich, labWave:G.LAB_WAVE,
               tracks:G.LAB.map(t => t.id) };
    });
    check('the lab is shut until wave 5', lab.shutEarly === false && lab.labWave === 5, lab);
    check('lab tiers cost more as they go up', lab.costs[0] < lab.costs[1] && lab.costs[1] < lab.costs[2], lab.costs);
    check('a tier you cannot afford is refused, one you can is charged',
      lab.poor === false && lab.rich === true, lab);
    check('the lab has a track for every combat module',
      ['amp', 'fire', 'ice', 'elec', 'blast'].every(k => lab.tracks.includes(k)), lab.tracks);
  }

  /* =================================================================== */
  group('flow — nothing waits on a tap');
  {
    const flow = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(5); G.newRun();
      const seen = [];
      let last = '';
      for (let i = 0; i < 40000; i++) {
        G.step(1 / 30, 1);
        if (i % 60 === 0) G.setLives(9999);   // nothing is built; keep it alive
        const s = G.st();
        const k = s.phase + ':' + s.level + ':' + s.wave;
        if (k !== last) { seen.push(k); last = k; }
        if (s.phase === 'levelclear') break;
      }
      const s = G.st();
      return { seen:seen.slice(0, 4), phase:s.phase, wave:s.wave, waves:G.WAVES_PER_LEVEL };
    });
    check('a level runs grace → wave → gap → … with no button ever pressed',
      flow.seen[0].startsWith('grace') && flow.seen[1].startsWith('wave') && flow.seen[2].startsWith('gap'),
      flow.seen);
    check('a level is eight waves and then clears',
      flow.phase === 'levelclear' && flow.wave === flow.waves, flow);

    const retry = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(5); G.newRun();
      G.addCores(60);
      G.startLevel(3);
      const opened = { cores:G.st().cores, grid:G.st().lab.grid };
      G.buyLab('grid'); G.buyLab('grid');
      G.setLives(0);
      G.step(1 / 30, 1);
      const failedPhase = G.st().phase;
      for (let i = 0; i < 200; i++) G.step(1 / 30, 1);
      const back = G.st();
      return { opened, failedPhase, retries:back.retries, cores:back.cores, grid:back.lab.grid, level:back.level };
    });
    check('running out of lives fails the LEVEL, not the run',
      retry.failedPhase === 'failed' && retry.level === 3 && retry.retries === 1, retry);
    check('a failed attempt is rolled back WHOLE — cores and lab tiers revert',
      retry.cores === retry.opened.cores && retry.grid === retry.opened.grid, retry);

    const endless = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(5); G.newRun();
      G.startLevel(G.CAMPAIGN_LEVELS + 1);
      G.setLives(0);
      G.step(1 / 30, 1);
      return { state:G.st().state, scores:G.scores().length };
    });
    check('endless has no retries — a breach there ends the run and records it',
      endless.state === 'dead' && endless.scores === 1, endless);

    const intro = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(9); G.newRun();
      const seen = [];
      let lastGw = 0;
      for (let i = 0; i < 200000; i++) {
        G.step(1 / 30, 1);
        if (i % 60 === 0) G.setLives(9999);
        const s = G.st();
        if (s.gw !== lastGw) { seen.push({ gw:s.gw, n:s.unlocked.length, lab:s.labOpen }); lastGw = s.gw; }
        if (s.level > 2) break;
      }
      return { seen:seen.slice(0, 13), order:G.BUILD_ORDER, unlock:G.UNLOCK };
    });
    const counts = intro.seen.map(s => s.n);
    check('exactly one new tile unlocks every wave',
      counts.length >= 10 && counts.slice(0, 10).every((n, i) => n === i + 1), counts);
    check('the lab opens on wave 5, not before',
      intro.seen[3] && intro.seen[4] && intro.seen[3].lab === false && intro.seen[4].lab === true,
      intro.seen.map(s => ({ gw:s.gw, lab:s.lab })));
    check('the turret comes first and the boosters come last',
      intro.unlock.turret === 1 && intro.unlock.clock === Math.max(...Object.values(intro.unlock)),
      intro.unlock);
  }

  /* =================================================================== */
  group('the curve is a sawtooth, not a ramp');
  {
    const r = await P(() => {
      const G = window.__TB;
      const rows = [];
      for (let L = 1; L <= G.CAMPAIGN_LEVELS; L++) {
        const row = [];
        for (let w = 1; w <= G.WAVES_PER_LEVEL; w++) row.push(G.hpMulFor((L - 1) * G.WAVES_PER_LEVEL + w));
        rows.push(row);
      }
      return rows;
    });
    check('waves harden across a level', r.every(row => row.slice(0, -1).every((v, i) => row[i + 1] > v)));
    check('the BREAKER wave is a spike on top of that',
      r.every(row => row[row.length - 1] > row[row.length - 2]));
    check('the next level opens EASIER than the boss you just beat',
      r.slice(1).every((row, i) => row[0] < r[i][r[i].length - 1]));
    check('…but on a higher floor than the level before it',
      r.slice(1).every((row, i) => row[0] > r[i][0]));
    const elites = await P(() => {
      const G = window.__TB;
      const a = G.wave(20).map(e => e.elite), b = G.wave(20).map(e => e.elite);
      return { same:JSON.stringify(a) === JSON.stringify(b), any:a.some(Boolean), l1:G.wave(3).some(e => e.elite) };
    });
    check('elites are stamped deterministically, not rolled', elites.same && elites.any, elites);
    check('no elites before level 3', elites.l1 === false, elites);
  }

  /* =================================================================== */
  group('the canvas-drawn UI, pressed the way a thumb does');
  {
    await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(11); G.newRun(); G.unlockAll(); G.setCash(100000); G.setPhase('grace');
    });
    await page.waitForFunction(() => window.__TB.tabRects().length === 3, { timeout: 4000 }).catch(() => {});
    const tabs = await P(() => ({ tabs:window.__TB.tabRects().map(t => t.id), cards:window.__TB.cardRects().map(c => c.kind) }));
    check('the build bar has three tabs so thirteen kinds fit one thumb-height bar',
      tabs.tabs.length === 3, tabs.tabs);
    check('the BUILD tab shows the structures', tabs.cards.includes('turret') && tabs.cards.includes('wall'), tabs.cards);

    const switched = await P(() => {
      const G = window.__TB, T = window.__T;
      const tb = G.tabRects().find(t => t.id === 'mods');
      T.tap(tb.x + tb.w / 2, tb.y + tb.h / 2);
      return G.st().barTab;
    });
    check('tapping a tab switches it', switched === 'mods', switched);
    // wait for the BAR to redraw, not a guessed number of milliseconds
    await page.waitForFunction(() => window.__TB.cardRects().some(c => c.kind === 'fire'), { timeout: 4000 }).catch(() => {});
    const modCards = await P(() => window.__TB.cardRects().map(c => c.kind));
    check('the MODULES tab shows all five combat modules',
      ['amp', 'fire', 'ice', 'elec', 'blast'].every(k => modCards.includes(k)), modCards);

    const armed = await P(() => {
      const G = window.__TB, T = window.__T;
      const card = G.cardRects().find(c => c.kind === 'fire');
      T.tap(card.x + card.w / 2, card.y + card.h / 2);
      return G.st().armed;
    });
    check('tapping a card arms it', armed === 'fire', armed);

    const placed = await P(() => {
      const G = window.__TB, T = window.__T;
      const c = G.buildableCells('fire')[0];
      T.tap(G.cellCx(c.c), G.cellCy(c.r));
      return { modules:G.st().modules, stillArmed:G.st().armed };
    });
    check('tapping a tile with a card armed places it, and it stays armed',
      placed.modules === 1 && placed.stillArmed === 'fire', placed);

    const dragged = await P(() => {
      const G = window.__TB, T = window.__T;
      const tb = G.tabRects().find(t => t.id === 'syn');
      T.tap(tb.x + tb.w / 2, tb.y + tb.h / 2);
      return G.st().barTab;
    });
    check('the SYNERGY tab exists for the boosters', dragged === 'syn', dragged);
    await page.waitForFunction(() => window.__TB.cardRects().some(c => c.kind === 'clock'), { timeout: 4000 }).catch(() => {});
    const boostCards = await P(() => window.__TB.cardRects().map(c => c.kind));
    check('and it shows all four boosters',
      ['twin', 'prism', 'relay', 'clock'].every(k => boostCards.includes(k)), boostCards);

    const dropped = await P(() => {
      const G = window.__TB, T = window.__T;
      const card = G.cardRects().find(c => c.kind === 'clock');
      const c = G.buildableCells('clock').find(z => !G.tileAt(z.r, z.c));
      T.drag(card.x + card.w / 2, card.y + card.h / 2, G.cellCx(c.c), G.cellCy(c.r));
      return G.st().boosters;
    });
    check('dragging a booster onto a tile places it', dropped === 1, dropped);

    const inspect = await P(() => {
      const G = window.__TB, T = window.__T;
      const t = G.tilesRaw().find(z => z.kind === 'booster');
      T.tap(G.cellCx(t.c), G.cellCy(t.r));
      return G.selected();
    });
    check('tapping a placed booster selects it', inspect && inspect.kind === 'booster', inspect);
    await page.waitForTimeout(120);
    await page.waitForFunction(() => window.__TB.cardRects().length === 0, { timeout: 4000 }).catch(() => {});
    const stale = await P(() => ({ cards:window.__TB.cardRects().length, tabs:window.__TB.tabRects().length,
                                   panel:Object.keys(window.__TB.panelRects()) }));
    check('the selection panel clears BOTH the card and tab hitboxes — no invisible taps',
      stale.cards === 0 && stale.tabs === 0 && stale.panel.includes('sell'), stale);

    const sold = await P(() => {
      const G = window.__TB, T = window.__T;
      const b = G.panelRects().sell;
      T.tap(b.x + b.w / 2, b.y + b.h / 2);
      return { boosters:G.st().boosters, sel:G.selected() };
    });
    check('the SELL button works when pressed as a thumb would',
      sold.boosters === 0 && sold.sel === null, sold);

    /* THE FROZEN-BOARD REGRESSION. Tapping a SYNERGY card froze the game and
       wiped the HUD and build bar: the drag ghost fell through to
       drawModuleShape for any non-turret/wall kind, so a booster looked up
       MODULES['twin'], got undefined, and threw inside draw() — which ended
       the requestAnimationFrame chain.

       The original drag test could never catch it, because T.drag() dispatches
       touchstart/move/end synchronously inside ONE evaluate and no frame ever
       renders while dragCard is set. This holds each kind mid-drag across REAL
       animation frames, and separately arms each kind, then checks the loop is
       still running and the chrome still draws. */
    for (const kind of await P(() => window.__TB.BUILD_ORDER)) {
      await P(k => {
        const G = window.__TB;
        G.closeScreen();
        const tab = G.BAR_TABS.find(t => t.keys.includes(k));
        G.setTab(tab.id);
        G.setCash(100000);
      }, kind);
      await page.waitForFunction(k => window.__TB.cardRects().some(c => c.kind === k),
        kind, { timeout: 4000 }).catch(() => {});
      // hold the card down (touchstart only) so a frame renders mid-drag
      const held = await P(k => {
        const G = window.__TB;
        const card = G.cardRects().find(c => c.kind === k);
        if (!card) return false;
        const el = document.getElementById('cv');
        const x = card.x + card.w / 2, y = card.y + card.h / 2;
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles:true, cancelable:true,
          touches:[t], targetTouches:[t], changedTouches:[t] }));
        const b = G.buildableCells('turret')[0];
        const t2 = new Touch({ identifier: 1, target: el, clientX: G.cellCx(b.c), clientY: G.cellCy(b.r) });
        el.dispatchEvent(new TouchEvent('touchmove', { bubbles:true, cancelable:true,
          touches:[t2], targetTouches:[t2], changedTouches:[t2] }));
        return true;
      }, kind);
      if (!held) continue;
      // let real frames render with the ghost on screen
      await new Promise(r => setTimeout(r, 120));
      const alive = await P(() => {
        const G = window.__TB;
        const el = document.getElementById('cv');
        const t = new Touch({ identifier: 1, target: el, clientX: 5, clientY: 5 });
        el.dispatchEvent(new TouchEvent('touchend', { bubbles:true, cancelable:true,
          touches:[], targetTouches:[], changedTouches:[t] }));
        return { bar: G.cardRects().length, tabs: G.tabRects().length };
      });
      check('dragging a ' + kind.toUpperCase() + ' card renders without killing the loop',
        alive.bar > 0 && alive.tabs === 3 && errs.length === 0,
        { kind, bar: alive.bar, tabs: alive.tabs, errors: errs.slice(0, 1) });
    }
    /* and the same for ARMING, which is the gesture the CD actually reported */
    for (const kind of await P(() => window.__TB.BUILD_ORDER)) {
      await P(k => {
        const G = window.__TB, T = window.__T;
        G.setTab(G.BAR_TABS.find(t => t.keys.includes(k)).id);
        G.setCash(100000);
      }, kind);
      await page.waitForFunction(k => window.__TB.cardRects().some(c => c.kind === k),
        kind, { timeout: 4000 }).catch(() => {});
      await P(k => {
        const G = window.__TB, T = window.__T;
        const card = G.cardRects().find(c => c.kind === k);
        if (card) T.tap(card.x + card.w / 2, card.y + card.h / 2);
      }, kind);
      await new Promise(r => setTimeout(r, 90));
      const armedOk = await P(() => ({ bar: window.__TB.cardRects().length, armed: window.__TB.st().armed }));
      check('arming a ' + kind.toUpperCase() + ' card keeps the board and chrome alive',
        armedOk.bar > 0 && errs.length === 0, { kind, ...armedOk, errors: errs.slice(0, 1) });
      await P(() => { const G = window.__TB; if (G.st().armed) { const c = G.cardRects().find(x => x.kind === G.st().armed); if (c) window.__T.tap(c.x + c.w / 2, c.y + c.h / 2); } });
    }

    const z = await P(() => ({
      mute:getComputedStyle(document.getElementById('mute')).zIndex,
      overlay:getComputedStyle(document.getElementById('ui')).zIndex,
      href:document.getElementById('back-btn').getAttribute('href'),
    }));
    check('the ← and 🔊 chrome sits above any full-screen overlay',
      +z.mute > +z.overlay && z.href === '../index.html', z);
  }

  /* =================================================================== */
  group('graphics styles — TOON by default, NEON still there');
  {
    const styles = await P(() => ({
      ids: window.__TB.GFX_STYLES.map(g => g.id),
      names: window.__TB.GFX_STYLES.map(g => g.name),
      current: window.__TB.gfx(),
    }));
    check('both styles are offered and NEON is named as the old look',
      styles.ids.length === 2 && styles.ids.includes('toon') && styles.ids.includes('neon')
        && styles.names.includes('NEON'), styles);

    /* the default has to be proven on a page that booted with NO stored
       setting — reading the live value after the suite has been setting it
       all along would prove nothing */
    await P(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate('window.__H = ' + HELPERS);
    await page.evaluate('window.__T = ' + TOUCH);
    const fresh = await P(() => ({ gfx: window.__TB.gfx(), stored: localStorage.getItem('turretBuilder.v1.settings') }));
    check('a first-time visitor gets TOON', fresh.gfx === 'toon', fresh);

    const gear = await P(() => {
      const b = document.getElementById('gfx-btn');
      if (!b) return { missing: true };
      const r = b.getBoundingClientRect();
      return { z: +getComputedStyle(b).zIndex, overlay: +getComputedStyle(document.getElementById('ui')).zIndex,
               top: Math.round(r.top), left: Math.round(r.left), open: window.__TB.gfxMenuOpen() };
    });
    check('the settings gear sits in the top-left chrome, above any overlay',
      !gear.missing && gear.left < 200 && gear.top < 120 && gear.z > gear.overlay && !gear.open, gear);

    await page.tap('#gfx-btn');
    const opened = await P(() => ({
      open: window.__TB.gfxMenuOpen(),
      rows: [...document.querySelectorAll('#gfx-menu [data-gfx]')].map(e => e.dataset.gfx),
      ticked: [...document.querySelectorAll('#gfx-menu [data-gfx]')].filter(e => e.classList.contains('on')).map(e => e.dataset.gfx),
    }));
    check('tapping it opens a dropdown listing every style, the current one ticked',
      opened.open && opened.rows.length === 2 && JSON.stringify(opened.ticked) === '["toon"]', opened);

    await page.tap('#gfx-menu [data-gfx="neon"]');
    const picked = await P(() => ({
      gfx: window.__TB.gfx(), open: window.__TB.gfxMenuOpen(),
      stored: (JSON.parse(localStorage.getItem('turretBuilder.v1.settings') || '{}')).gfx,
    }));
    check('picking NEON switches the style, closes the menu and persists the choice',
      picked.gfx === 'neon' && !picked.open && picked.stored === 'neon', picked);

    await page.reload({ waitUntil: 'load' });
    await page.evaluate('window.__H = ' + HELPERS);
    await page.evaluate('window.__T = ' + TOUCH);
    const kept = await P(() => window.__TB.gfx());
    check('and it survives a reload', kept === 'neon', kept);

    /* the real risk with two renderers is that one of them throws mid-frame
       and takes the rAF chain with it — the exact shape of the freeze bug.
       So run REAL frames of a populated board in each style and read the
       page-error log, not just a return value. */
    for (const style of ['neon', 'toon']) {
      const before = errs.length;
      await P((st) => {
        const G = window.__TB, H = window.__H;
        G.setGfx(st);
        H.fresh();
        const sp = H.bigSpot();
        G.place('turret', sp.r, sp.c);
        G.place('blast', sp.r - 1, sp.c); G.place('blast', sp.r + 1, sp.c);
        G.place('fire', sp.r, sp.c - 1);  G.place('fire', sp.r, sp.c + 1);
        G.place('clock', sp.r + 1, sp.c + 1); G.place('twin', sp.r - 1, sp.c - 1);
        for (const q of G.pathCellList()) { if (G.place('wall', q.r, q.c)) break; }
        G.ready();
      }, style);
      await new Promise(r => setTimeout(r, 500));
      const live = await P(() => ({ gfx: window.__TB.gfx(), creeps: window.__TB.st().creeps, turrets: window.__TB.st().turrets, walls: window.__TB.st().walls }));
      check('the ' + style.toUpperCase() + ' renderer draws a live board with turrets, walls and creeps without throwing',
        live.gfx === style && errs.length === before, { style, live, errors: errs.slice(before, before + 1) });
    }
  }

  /* =================================================================== */
  group('persistence');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const sp = H.bigSpot();
      G.place('turret', sp.r, sp.c);
      G.place('blast', sp.r - 1, sp.c); G.place('blast', sp.r + 1, sp.c);
      G.place('fire', sp.r, sp.c - 1);  G.place('fire', sp.r, sp.c + 1);
      G.place('clock', sp.r + 1, sp.c + 1);
      G.addCores(60); G.buyLab('grid');
      const before = G.st();
      const comboBefore = G.comboAt(sp.r, sp.c);
      G.save(1);
      G.newRun();
      const wiped = G.st().turrets;
      const ok = G.load(1);
      const after = G.st();
      return { ok, wiped, comboBefore, comboAfter:G.comboAt(sp.r, sp.c),
               before:{ t:before.turrets, m:before.modules, b:before.boosters, lab:before.lab.grid },
               after:{ t:after.turrets, m:after.modules, b:after.boosters, lab:after.lab.grid } };
    });
    check('a save round-trips turrets, modules, boosters and the lab',
      r.ok && r.wiped === 0 && JSON.stringify(r.before) === JSON.stringify(r.after), r);
    check('and the combo is rebuilt from the restored board, not stored',
      r.comboBefore === 'grenade' && r.comboAfter === 'grenade', r);

    const pend = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(13); G.newRun();
      G.startLevel(2);
      G.unlockAll(); G.setCash(100000);
      const c = G.buildableCells('turret')[0];
      G.place('turret', c.r, c.c);
      G.setPhase('levelclear', 0.001);
      G.step(0.01, 2);
      const raw = JSON.parse(localStorage.getItem('turretBuilder.v1.auto'));
      return { level:G.st().level, turrets:G.st().turrets, pending:raw && raw.pending, savedLevel:raw && raw.run.level };
    });
    check('the between-levels save still opens a FRESH level',
      pend.level === 3 && pend.turrets === 0 && pend.savedLevel === 3, pend);
  }

  /* =================================================================== */
  group('page health');
  check('no page errors at any point in the suite', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  console.log('\nTURRET-BUILDER DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  console.log('TURRET-BUILDER DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
