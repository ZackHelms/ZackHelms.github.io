#!/usr/bin/env node
/**
 * drive-turret-builder.cjs — RULES gate for games/turret-builder/.
 *
 * Balance lives next door in eval-turret-builder.cjs, so a rebalance never
 * fights a mechanics regression. This file asserts the DESIGN SPEC to the
 * decimal, by measuring the game rather than reading its constants:
 *
 *   a turret is 10 kinetic damage, once a second, 100% hit chance
 *   fire   +10%  of that hit as a 5 s burn        (4 sides -> +40%)
 *   ice    +2.5% direct elemental and a 10% slow for 1 s   (-> +10% / 40%)
 *   arc    +5%   elemental, chaining to +1 enemy  (-> +20% to 5 targets)
 *   blast  +5%   kinetic and +2.5% fire, splashed (-> +20% / +10%)
 *   walls  100 HP on the road, two free sides for modules
 *
 * Every module number is measured off a DAMAGE LEDGER (__TB.setLog) fired at
 * a pinned dummy with known armour and resist — inferring them from a live
 * wave would only ever prove that some damage happened.
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
  const ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];

  function fresh(seed) {
    G.clearStorage();
    G.seedRandom(seed === undefined ? 7 : seed);
    G.newRun();
    G.unlockAll();
    G.setCash(1000000);
    G.setPhase('grace');          // park the flow machine: no wave gatecrashes
    return G;
  }
  /* a buildable cell whose four orthogonal neighbours are all buildable too,
     so a turret can be ringed with a full set of modules */
  function plusSpot() {
    for (const c of G.buildableCells('turret'))
      if (ORTHO.every(([dr,dc]) => G.canPlace('fire', c.r+dr, c.c+dc))) return c;
    return null;
  }
  function ring(spot, kinds) {
    kinds.forEach((k, i) => { const [dr,dc] = ORTHO[i]; G.place(k, spot.r+dr, spot.c+dc); });
  }
  /* Fire exactly one shot from every turret at a pinned dummy, then remove
     the turret so nothing fires again, and let \`after\` seconds of pure
     damage-over-time run out. Returns the ledger. */
  function oneShot(spot, dummyOpts, after) {
    G.setLog(true);
    const id = G.spawnDummy(Object.assign({
      hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500,
    }, dummyOpts || {}));
    G.step(0.001, 1);                       // cooldown starts at 0 -> one shot
    G.sell(spot.r, spot.c);                 // silence the turret
    const secs = after === undefined ? 6 : after;
    for (let i = 0; i < Math.round(secs / 0.02); i++) G.step(0.02, 1);
    const log = G.log();
    G.setLog(false);
    return { log, id, creep: G.creepById(id) };
  }
  const sum = (log, f) => log.filter(f).reduce((a, e) => a + e.amt, 0);

  return {
    fresh, plusSpot, ring, oneShot, sum, ORTHO,
    /* place a turret ringed with N of one module and measure one shot */
    modShot(n, mod, dummyOpts, after) {
      const G2 = fresh();
      const spot = plusSpot();
      G2.place('turret', spot.r, spot.c);
      const stats0 = G2.turretStats(spot.r, spot.c);
      ring(spot, Array.from({length:n}, () => mod));
      const stats = G2.turretStats(spot.r, spot.c);
      const res = oneShot(spot, dummyOpts, after);
      return { D: stats0.D, stats, log: res.log, creep: res.creep,
               kin: sum(res.log, e => e.type === 'kin' && e.tag === 'turret'),
               dot: sum(res.log, e => e.tag === 'dot'),
               ice: sum(res.log, e => e.tag === 'ice'),
               arc: sum(res.log, e => e.tag === 'arc'),
               blastKin: sum(res.log, e => e.tag === 'blast' && e.type === 'kin'),
               blastEle: sum(res.log, e => e.tag === 'blast' && e.type === 'ele') };
    },
    /* a legal wall cell, plus its module-capable (non-road, in-board) sides */
    wallSpot() {
      for (const p of G.pathCellList()) {
        if (!G.canPlace('wall', p.r, p.c)) continue;
        const free = ORTHO.map(([dr,dc]) => ({ r:p.r+dr, c:p.c+dc }))
          .filter(q => G.canPlace('fire', q.r, q.c));
        if (free.length >= 2) return { cell:p, free };
      }
      return null;
    },
    freeSideCounts() {
      const out = [];
      for (const p of G.pathCellList()) {
        if (!G.canPlace('wall', p.r, p.c)) continue;
        out.push(ORTHO.map(([dr,dc]) => ({ r:p.r+dr, c:p.c+dc }))
          .filter(q => G.canPlace('fire', q.r, q.c)).length);
      }
      return out;
    },
  };
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
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await page.goto(GAME, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(250);
  await page.evaluate('window.__H = ' + HELPERS);
  await page.evaluate('window.__T = ' + TOUCH);
  const P = async fn => page.evaluate(fn);

  /* =================================================================== */
  group('the base turret — the spec, verbatim');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      const s = G.turretStats(spot.r, spot.c);
      // 100% hit chance: ten seconds of fire, every hit identical, none missed
      G.setLog(true);
      G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      for (let i = 0; i < 1000; i++) G.step(0.01, 1);
      const log = G.log().filter(e => e.tag === 'turret');
      G.setLog(false);
      return { s, shots: log.length, amts: [...new Set(log.map(e => +e.amt.toFixed(6)))],
               cost: G.TURRET.cost, silhouette: 'triangle' };
    });
    check('a turret deals exactly 10 kinetic damage a hit', near(r.s.D, 10), r.s.D);
    check('a turret fires exactly once a second', near(r.s.rate, 1), r.s.rate);
    check('a turret reaches 2.6 cells', near(r.s.rangeCells, 2.6), r.s.rangeCells);
    check('100% hit chance — ten seconds is ten or eleven identical hits, no misses',
      (r.shots === 10 || r.shots === 11) && r.amts.length === 1 && near(r.amts[0], 10),
      { shots: r.shots, amts: r.amts });
    check('a bare turret carries no module effects at all',
      r.s.fireDot === 0 && r.s.iceDir === 0 && r.s.arcDir === 0 && r.s.blastKin === 0);
  }

  /* =================================================================== */
  group('FIRE — +10% of the hit as a 5 s burn, elemental');
  {
    const one = await P(() => window.__H.modShot(1, 'fire'));
    const four = await P(() => window.__H.modShot(4, 'fire'));
    check('one FIRE module burns for 10% of the turret’s hit',
      near(one.dot, 0.10 * one.D, 1e-4), { dot: one.dot, D: one.D });
    check('four FIRE modules burn for 40% — 100% kinetic + 40% fire, as spec’d',
      near(four.dot, 0.40 * four.D, 1e-4) && near(four.kin, four.D, 1e-6),
      { kinetic: four.kin, dot: four.dot, D: four.D });
    const shape = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'fire', 'fire', 'fire']);
      G.setLog(true);
      const id = G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      G.step(0.001, 1);
      G.sell(spot.r, spot.c);
      for (let i = 0; i < 125; i++) G.step(0.02, 1);   // 2.5 s — halfway
      const half = G.log().filter(e => e.tag === 'dot').reduce((a, e) => a + e.amt, 0);
      const mid = G.creepById(id);
      for (let i = 0; i < 150; i++) G.step(0.02, 1);   // past 5 s
      const after = G.creepById(id);
      G.setLog(false);
      return { half, midDots: mid.dots.length, afterDots: after.dots.length };
    });
    check('the burn is a DOT, not a lump — half the damage lands by 2.5 s',
      near(shape.half, 2.0, 0.12), shape.half);
    check('the burn is still running at 2.5 s and gone by 5 s',
      shape.midDots === 1 && shape.afterDots === 0, shape);
    const resisted = await P(() => window.__H.modShot(4, 'fire', { res: 0.5 }));
    check('the burn is ELEMENTAL — a 50% resist halves it',
      near(resisted.dot, 0.40 * resisted.D * 0.5, 1e-4), resisted.dot);
  }

  /* =================================================================== */
  group('ICE — +2.5% direct elemental and a 10% slow for 1 s');
  {
    const one = await P(() => window.__H.modShot(1, 'ice', {}, 0.2));
    const four = await P(() => window.__H.modShot(4, 'ice', {}, 0.2));
    check('one ICE module adds 2.5% direct damage and a 10% slow',
      near(one.ice, 0.025 * one.D, 1e-4) && near(one.stats.iceSlow, 0.10, 1e-6),
      { dmg: one.ice, slow: one.stats.iceSlow });
    check('four ICE modules add 10% direct damage and a 40% slow — exactly the spec',
      near(four.ice, 0.10 * four.D, 1e-4) && near(four.stats.iceSlow, 0.40, 1e-6),
      { dmg: four.ice, slow: four.stats.iceSlow });
    const dur = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['ice', 'ice', 'ice', 'ice']);
      const id = G.spawnDummy({ hp: 1e9, x: G.cellCx(spot.c) + G.cellSize() * 1.2, y: G.cellCy(spot.r), d: 500 });
      G.step(0.001, 1);
      G.sell(spot.r, spot.c);
      const at0 = G.creepById(id);
      for (let i = 0; i < 45; i++) G.step(0.02, 1);   // 0.9 s
      const at09 = G.creepById(id);
      for (let i = 0; i < 15; i++) G.step(0.02, 1);   // past 1.0 s
      const at12 = G.creepById(id);
      return { s0: at0.slow, t0: at0.slowT, s09: at09.slow, s12: at12.slow };
    });
    check('the slow lasts one second and then lets go',
      near(dur.s0, 0.40) && near(dur.t0, 1.0, 0.01) && near(dur.s09, 0.40) && dur.s12 === 0, dur);
    const resisted = await P(() => window.__H.modShot(4, 'ice', { res: 0.6 }, 0.2));
    check('ICE damage is ELEMENTAL — a 60% resist cuts it to 40%',
      near(resisted.ice, 0.10 * resisted.D * 0.4, 1e-4), resisted.ice);
  }

  /* =================================================================== */
  group('ARC — +5% elemental that chains to the nearest untouched enemy');
  {
    const chain = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['arc', 'arc', 'arc', 'arc']);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      // primary inside the turret's 2.6 cells; the rest out of its reach but
      // 2.0 cells apart, inside the 2.3-cell jump radius
      const primary = G.spawnDummy({ hp: 1e9, x: x0 + cs * 1.2, y: y0, d: 900 });
      const rest = [];
      for (let i = 1; i <= 5; i++) rest.push(G.spawnDummy({ hp: 1e9, x: x0 + cs * (1.2 + 2.0 * i), y: y0, d: 10 }));
      G.setLog(true);
      G.step(0.001, 1);
      const log = G.log().filter(e => e.tag === 'arc');
      G.setLog(false);
      const stats = G.turretStats(spot.r, spot.c);
      const ids = log.map(e => e.id);
      return { stats, n: log.length, ids, uniq: new Set(ids).size,
               amts: [...new Set(log.map(e => +e.amt.toFixed(6)))],
               D: stats.D, primary, rest, primaryHit: ids[0] === primary };
    });
    check('four ARC modules deal +20% per target and chain four times — five targets',
      chain.n === 5 && near(chain.stats.arcDir, 0.20 * chain.D, 1e-6) && chain.stats.arcJumps === 4,
      { targets: chain.n, arcDmg: chain.stats.arcDir, jumps: chain.stats.arcJumps });
    check('every target in the chain takes the same +20%',
      chain.amts.length === 1 && near(chain.amts[0], 0.20 * chain.D, 1e-4), chain.amts);
    check('a bolt can only hit a target once', chain.uniq === chain.n, { hits: chain.n, distinct: chain.uniq });
    check('the chain starts on the turret’s own target', chain.primaryHit, chain.ids);
    const one = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['arc']);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      G.spawnDummy({ hp: 1e9, x: x0 + cs * 1.2, y: y0, d: 900 });
      for (let i = 1; i <= 3; i++) G.spawnDummy({ hp: 1e9, x: x0 + cs * (1.2 + 2.0 * i), y: y0, d: 10 });
      G.setLog(true); G.step(0.001, 1);
      const log = G.log().filter(e => e.tag === 'arc'); G.setLog(false);
      return { n: log.length, amt: log[0] && +log[0].amt.toFixed(6), D: G.turretStats(spot.r, spot.c).D };
    });
    check('one ARC module is +5% and exactly one extra jump — two targets',
      one.n === 2 && near(one.amt, 0.05 * one.D, 1e-4), one);
  }

  /* =================================================================== */
  group('BLAST — +5% kinetic (concussive) and +2.5% fire, as AoE');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['blast', 'blast', 'blast', 'blast']);
      const st = G.turretStats(spot.r, spot.c);
      const cs = G.cellSize(), x0 = G.cellCx(spot.c), y0 = G.cellCy(spot.r);
      const px = x0 + cs * 1.2;
      G.spawnDummy({ hp: 1e9, x: px, y: y0, d: 900 });                 // primary
      G.spawnDummy({ hp: 1e9, x: px + cs * 0.6, y: y0, d: 10 });       // inside the bloom
      G.spawnDummy({ hp: 1e9, x: px - cs * 0.6, y: y0, d: 10 });       // inside the bloom
      G.spawnDummy({ hp: 1e9, x: px + cs * 6.0, y: y0, d: 10 });       // well outside
      G.setLog(true); G.step(0.001, 1);
      const log = G.log(); G.setLog(false);
      const bk = log.filter(e => e.tag === 'blast' && e.type === 'kin');
      const be = log.filter(e => e.tag === 'blast' && e.type === 'ele');
      return { st, D: st.D, nk: bk.length, ne: be.length,
               kAmt: [...new Set(bk.map(e => +e.amt.toFixed(6)))],
               eAmt: [...new Set(be.map(e => +e.amt.toFixed(6)))],
               radius: st.blastR };
    });
    check('four BLAST modules deal +20% kinetic and +10% fire',
      near(r.st.blastKin, 0.20 * r.D, 1e-6) && near(r.st.blastFire, 0.10 * r.D, 1e-6),
      { kin: r.st.blastKin, fire: r.st.blastFire });
    check('the blast is AREA damage — three targets caught, the distant one missed',
      r.nk === 3 && r.ne === 3, { kinHits: r.nk, eleHits: r.ne });
    check('every caught target takes the same concussive and fire split',
      r.kAmt.length === 1 && near(r.kAmt[0], 0.20 * r.D, 1e-4) &&
      r.eAmt.length === 1 && near(r.eAmt[0], 0.10 * r.D, 1e-4), { kin: r.kAmt, fire: r.eAmt });
    const one = await P(() => window.__H.modShot(1, 'blast'));
    check('one BLAST module is +5% kinetic and +2.5% fire',
      near(one.stats.blastKin, 0.05 * one.D, 1e-6) && near(one.stats.blastFire, 0.025 * one.D, 1e-6),
      { kin: one.stats.blastKin, fire: one.stats.blastFire });
  }

  /* =================================================================== */
  group('the grid — four sides, orthogonal only, shared between neighbours');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'ice', 'arc', 'blast']);
      const mods = G.modsAt(spot.r, spot.c);
      const total = Object.values(mods).reduce((a, b) => a + b, 0);
      const sidesFull = H.ORTHO.every(([dr, dc]) => G.tileAt(spot.r + dr, spot.c + dc) !== null);
      // a fifth module can only go diagonally, and a diagonal grants nothing
      const diag = G.place('fire', spot.r - 1, spot.c - 1);
      const after = G.modsAt(spot.r, spot.c);
      return { mods, total, sidesFull, diagPlaced: diag,
               afterTotal: Object.values(after).reduce((a, b) => a + b, 0) };
    });
    check('a turret takes four modules and there is nowhere to put a fifth',
      r.total === 4 && r.sidesFull, r);
    check('any mix of four is legal — one of each',
      r.mods.fire === 1 && r.mods.ice === 1 && r.mods.arc === 1 && r.mods.blast === 1, r.mods);
    check('DIAGONAL neighbours grant nothing (that is the whole point of orthogonal)',
      r.diagPlaced === true && r.afterTotal === 4, { placed: r.diagPlaced, total: r.afterTotal });

    const shared = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      // find a row with three consecutive buildable cells
      let a = null;
      for (const c of G.buildableCells('turret'))
        if (G.canPlace('turret', c.r, c.c + 2) && G.canPlace('fire', c.r, c.c + 1)) { a = c; break; }
      G.place('turret', a.r, a.c);
      G.place('turret', a.r, a.c + 2);
      G.place('fire', a.r, a.c + 1);
      return { left: G.modsAt(a.r, a.c).fire, right: G.modsAt(a.r, a.c + 2).fire,
               fed: G.tileAt(a.r, a.c + 1).fed, links: G.st().links };
    });
    check('one module wedged between two turrets pays BOTH of them',
      shared.left === 1 && shared.right === 1 && shared.fed === 2, shared);

    const wallOnly = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['armor', 'regen']);
      const m = G.modsAt(spot.r, spot.c);
      return { armor: m.armor, regen: m.regen,
               fedA: G.tileAt(spot.r - 1, spot.c).fed, fedR: G.tileAt(spot.r + 1, spot.c).fed };
    });
    check('ARMOR and REGEN are wall hardware — bolted to a turret they feed nothing',
      wallOnly.armor === 0 && wallOnly.regen === 0 && wallOnly.fedA === 0 && wallOnly.fedR === 0, wallOnly);

    const cap = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const before = G.st().turretCap;
      let placed = 0;
      for (const c of G.buildableCells('turret')) { if (G.place('turret', c.r, c.c)) placed++; }
      const capped = G.st().turrets;
      G.addCores(200); G.buyLab('grid');
      const after = G.st().turretCap;
      return { before, placed, capped, after, base: G.consts().TURRET_CAP_BASE };
    });
    check('turret slots are the scarce thing, and the cap is enforced to the tile',
      cap.before === cap.base && cap.capped === cap.base && cap.placed === cap.base, cap);
    check('a GRID lab tier buys exactly one more turret slot', cap.after === cap.before + 1, cap);
  }

  /* =================================================================== */
  group('damage types — armour eats kinetic, resist eats elemental');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      const armoured = H.modShot(0, 'fire', { arm: 7 }, 0.2);
      const heavy = H.modShot(0, 'fire', { arm: 100 }, 0.2);
      const resistant = H.modShot(0, 'fire', { res: 0.6 }, 0.2);
      return { armoured: armoured.kin, heavy: heavy.kin, resistant: resistant.kin, floor: G.consts().KIN_FLOOR };
    });
    check('armour is a FLAT cut off a kinetic hit — 10 against armour 7 lands 3',
      near(r.armoured, 3, 1e-6), r.armoured);
    check('armour can never eat more than 85% of a hit', near(r.heavy, 1.5, 1e-6), r.heavy);
    check('resist does NOT touch kinetic', near(r.resistant, 10, 1e-6), r.resistant);
    const counters = await P(() => {
      const G = window.__TB;
      return { hulkArm: G.CREEPS.hulk.arm, hulkRes: G.CREEPS.hulk.res,
               wardArm: G.CREEPS.ward.arm, wardRes: G.CREEPS.ward.res,
               bossArm: G.CREEPS.boss.arm, bossRes: G.CREEPS.boss.res };
    });
    check('HULK answers to elemental (flat armour, no resist)',
      counters.hulkArm > 0 && counters.hulkRes === 0, counters);
    check('WARD answers to kinetic (heavy resist, no armour)',
      counters.wardRes >= 0.5 && counters.wardArm === 0, counters);
    check('the BREAKER has both, so a one-note grid cannot answer it',
      counters.bossArm > 0 && counters.bossRes > 0, counters);

    /* Armour scaling is what keeps the modules load-bearing all campaign, so
       it is a rule, not a tuning knob: a turret's kinetic grows with levels
       and CHASSIS tiers, and against a flat 7 that never moves a board of
       bare triangles measured its way to level 6. */
    const scaling = await P(() => {
      const G = window.__TB;
      const at = gw => G.wave(gw).filter(e => e.type === 'hulk').map(e => +e.arm.toFixed(3))[0];
      return { l1: at(4), l4: at(3 * G.WAVES_PER_LEVEL + 4), l8: at(7 * G.WAVES_PER_LEVEL + 4),
               mul1: G.armMulFor(1), mul8: G.armMulFor(8 * G.WAVES_PER_LEVEL),
               base: G.CREEPS.hulk.arm, res: G.CREEPS.ward.res };
    });
    check('armour scales with the campaign floor — elemental stays the answer to it',
      scaling.l8 > scaling.l4 && scaling.l4 > scaling.l1 && near(scaling.l1, scaling.base, 1e-6), scaling);
    check('armour holds flat inside a level (it tracks the floor, not the wave)',
      near(scaling.mul1, 1, 1e-9), scaling.mul1);
    check('RESIST does not scale — it is a fraction, so it never needed to',
      scaling.res === 0.60, scaling.res);
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
      return { hp: s.hp, maxHp: s.maxHp, base: G.WALL.hp,
               sideCounts: [...new Set(counts)].sort(), maxSides: Math.max(...counts),
               wallOffRoad: G.canPlace('wall', offRoad.r, offRoad.c),
               turretOnRoad: G.canPlace('turret', w.cell.r, w.cell.c),
               moduleOnRoad: G.canPlace('fire', w.cell.r, w.cell.c) };
    });
    check('a wall has a base HP of 100', base.maxHp === 100 && base.hp === 100 && base.base === 100, base);
    check('a wall on the road has at most two module-capable sides',
      base.maxSides <= 2, { counts: base.sideCounts });
    check('walls go on the road and nothing else does',
      base.wallOffRoad === false && base.turretOnRoad === false && base.moduleOnRoad === false, base);

    const block = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      const wd = G.wallStats(w.cell.r, w.cell.c).d;
      const id = G.spawnDummy({ hp: 1e9, d: 0, spd: 1.25, pinned: false });
      // 5 s: ~1.6 s of walking, then ~3 s of hitting. Long enough to prove it
      // is held and chewing, short enough that the 100 HP wall is still up —
      // measure the block BEFORE the wall falls or you measure nothing.
      for (let i = 0; i < 250; i++) G.step(0.02, 1);
      const c = G.creepById(id);
      const s = G.wallStats(w.cell.r, w.cell.c);
      return { wd, creepD: c ? c.d : null, hp: s.hp, maxHp: s.maxHp, blocked: c && c.d < wd };
    });
    check('a creep stops at a wall instead of walking through it',
      block.blocked === true && block.creepD < block.wd, block);
    check('a blocked creep attacks the wall and takes it down', block.hp < block.maxHp, block);

    const through = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      const wd = G.wallStats(w.cell.r, w.cell.c).d;
      const id = G.spawnDummy({ hp: 1e9, d: 0, spd: 1.25, pinned: false });
      for (let i = 0; i < 4000; i++) G.step(0.02, 1);
      const s = G.wallStats(w.cell.r, w.cell.c);
      const c = G.creepById(id);
      return { hp: s.hp, wd, passed: !c || (c && c.d > wd) };
    });
    check('once the wall is down, the road is open again',
      through.hp === 0 && through.passed, through);

    const mods = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      const bare = G.wallStats(w.cell.r, w.cell.c);
      G.place('armor', w.free[0].r, w.free[0].c);
      const one = G.wallStats(w.cell.r, w.cell.c);
      G.place('armor', w.free[1].r, w.free[1].c);
      const two = G.wallStats(w.cell.r, w.cell.c);
      return { bare: bare.maxHp, one: one.maxHp, oneDr: one.dr, two: two.maxHp, twoDr: two.dr };
    });
    check('an ARMOR module is +35% wall HP and flat damage reduction',
      mods.one === 135 && mods.oneDr === 2 && mods.two === 170 && mods.twoDr === 4, mods);

    const teeth = await P(() => {
      const G = window.__TB, H = window.__H;
      const build = (kind) => {
        H.fresh();
        const w = H.wallSpot();
        G.place('wall', w.cell.r, w.cell.c);
        if (kind) G.place(kind, w.free[0].r, w.free[0].c);
        const id = G.spawnDummy({ hp: 1e9, d: 0, spd: 1.25, pinned: false });
        G.setLog(true);
        for (let i = 0; i < 700; i++) G.step(0.02, 1);
        const log = G.log(); G.setLog(false);
        const c = G.creepById(id);
        return { total: log.reduce((a, e) => a + e.amt, 0), slow: c ? c.slow : 0,
                 dots: c ? c.dots.length : 0, stats: G.wallStats(w.cell.r, w.cell.c) };
      };
      const bare = build(null), fire = build('fire'), ice = build('ice'),
            blast = build('blast'), arc = build('arc');
      // regen is measured on a damaged wall instead
      H.fresh();
      const w = H.wallSpot();
      G.place('wall', w.cell.r, w.cell.c);
      G.place('regen', w.free[0].r, w.free[0].c);
      const rs = G.wallStats(w.cell.r, w.cell.c);
      const id = G.spawnDummy({ hp: 1e9, d: 0, spd: 1.25, pinned: false });
      for (let i = 0; i < 400; i++) G.step(0.02, 1);
      const hurt = G.wallStats(w.cell.r, w.cell.c).hp;
      G.clearCreeps();
      for (let i = 0; i < 250; i++) G.step(0.02, 1);   // 5 s of quiet
      const healed = G.wallStats(w.cell.r, w.cell.c).hp;
      return { bare: bare.total, fire: fire.total, fireDots: fire.dots, iceSlow: ice.slow,
               blast: blast.total, arc: arc.total, regenRate: rs.wRegen, hurt, healed };
    });
    check('a bare wall does no damage to what hits it', near(teeth.bare, 0, 1e-9), teeth.bare);
    check('a FIRE module makes the wall burn its attacker',
      teeth.fire > 0 && teeth.fireDots > 0, { dealt: teeth.fire, dots: teeth.fireDots });
    check('an ICE module slows what is hitting the wall', teeth.iceSlow > 0, teeth.iceSlow);
    check('a BLAST module answers each hit with concussive thorns', teeth.blast > 0, teeth.blast);
    check('an ARC module shocks the attacker', teeth.arc > 0, teeth.arc);
    check('a REGEN module repairs the wall between attacks',
      teeth.regenRate > 0 && teeth.healed > teeth.hurt, teeth);

    const wcap = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const before = G.st().wallCap;
      let placed = 0;
      for (const p of G.pathCellList()) if (G.place('wall', p.r, p.c)) placed++;
      const after = G.st().walls;
      G.addCores(400); G.buyLab('bulwark');
      return { before, placed, after, capAfter: G.st().wallCap,
               hpAfter: G.WALL.hp, base: G.consts().WALL_CAP_BASE };
    });
    check('wall slots start at the published base and are enforced',
      wcap.before === wcap.base && wcap.after === wcap.base && wcap.placed === wcap.base, wcap);
    check('a BULWARK tier buys one more wall slot', wcap.capAfter === wcap.before + 1, wcap);
  }

  /* =================================================================== */
  group('economy — cash, cores, the lab');
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
      const spentTotal = G.TURRET.cost + upCost;
      G.sell(spot.r, spot.c);
      const afterSell = G.st().cash;
      return { before, afterBuild, cost: G.TURRET.cost, upCost, afterUp,
               refund: afterSell - afterUp, spentTotal, lvl2D: lvl2.D, lvl: lvl2.lvl };
    });
    check('placing costs the card price', r.before - r.afterBuild === r.cost, r);
    check('upgrading a turret raises its damage 28% a level',
      r.lvl === 2 && near(r.lvl2D, 12.8, 1e-6), { lvl: r.lvl, D: r.lvl2D });
    check('selling refunds half of everything sunk into a tile',
      r.refund === Math.floor(r.spentTotal * 0.5), r);

    const lab = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(3); G.newRun();
      const shutEarly = G.st().labOpen;
      G.unlockAll();
      const costs = [0, 1, 2].map(t => G.labCost('grid', t));
      G.addCores(3);
      const poor = G.buyLab('grid');
      G.addCores(50);
      const rich = G.buyLab('grid');
      const coresAfter = G.st().cores;
      return { shutEarly, costs, poor, rich, coresAfter, labWave: G.LAB_WAVE };
    });
    check('the lab is shut until wave 5', lab.shutEarly === false && lab.labWave === 5, lab);
    check('lab tiers cost more as they go up', lab.costs[0] < lab.costs[1] && lab.costs[1] < lab.costs[2], lab.costs);
    check('a tier you cannot afford is refused, and one you can is charged',
      lab.poor === false && lab.rich === true && lab.coresAfter === 53 - lab.costs[0],
      { poor: lab.poor, rich: lab.rich, cores: lab.coresAfter });

    const scale = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'fire', 'fire', 'fire']);
      const before = G.turretStats(spot.r, spot.c);
      G.addCores(500);
      G.buyLab('chassis');
      const chassis = G.turretStats(spot.r, spot.c);
      G.buyLab('fire');
      const fireTier = G.turretStats(spot.r, spot.c);
      return { d0: before.D, dot0: before.fireDot, d1: chassis.D, dot1: chassis.fireDot, dot2: fireTier.fireDot };
    });
    check('a CHASSIS tier is +20% turret damage, and the modules ride along with it',
      near(scale.d1, 12, 1e-6) && near(scale.dot1, 4.8, 1e-6), scale);
    /* The module tracks climb at deliberately different rates: the
       single-target modules gain 30% a tier against the crowd modules' 12%,
       because the spec's own percentages already hand ARC and BLAST five
       targets to FIRE's one. */
    check('a FIRE tier is +30% on top of that', near(scale.dot2, 4.8 * 1.30, 1e-6), scale);
    const steps = await P(() => window.__TB.consts().MOD_LAB_STEP);
    check('single-target module tracks climb faster per tier than the crowd ones',
      steps.fire > steps.arc && steps.ice > steps.blast && steps.fire === steps.ice, steps);
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
      return { seen: seen.slice(0, 6), phase: s.phase, level: s.level, wave: s.wave,
               waves: G.WAVES_PER_LEVEL, elapsed: s.levelElapsed };
    });
    check('a level runs grace → wave → gap → … with no button ever pressed',
      flow.seen[0].startsWith('grace') && flow.seen[1].startsWith('wave') && flow.seen[2].startsWith('gap'),
      flow.seen);
    check('a level is eight waves and then clears',
      flow.phase === 'levelclear' && flow.wave === flow.waves, flow);

    const latch = await P(() => {
      const G = window.__TB;
      const before = G.st().score;
      for (let i = 0; i < 200; i++) G.step(1 / 30, 1);   // sit in levelclear
      const mid = G.st();
      return { before, after: mid.score, phase: mid.phase, level: mid.level };
    });
    check('the level-clear bonus cannot re-fire and farm itself',
      latch.after === latch.before || latch.phase !== 'levelclear', latch);
    check('clearing a level rolls straight into the next one', latch.level >= 2, latch);

    const retry = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(5); G.newRun();
      G.addCores(60);
      G.startLevel(3);
      const opened = { cores: G.st().cores, grid: G.st().lab.grid, score: G.st().score };
      G.buyLab('grid'); G.buyLab('grid');
      const spent = { cores: G.st().cores, grid: G.st().lab.grid };
      G.setLives(0);
      G.step(1 / 30, 1);
      const failed = G.st();
      for (let i = 0; i < 200; i++) G.step(1 / 30, 1);   // let the retry timer run out
      const back = G.st();
      return { opened, spent, failedPhase: failed.phase, retries: back.retries,
               cores: back.cores, grid: back.lab.grid, level: back.level };
    });
    check('running out of lives fails the LEVEL, not the run',
      retry.failedPhase === 'failed' && retry.level === 3 && retry.retries === 1, retry);
    check('a failed attempt is rolled back WHOLE — cores and lab tiers revert',
      retry.cores === retry.opened.cores && retry.grid === retry.opened.grid,
      { openedWith: retry.opened, spentDownTo: retry.spent, backTo: { cores: retry.cores, grid: retry.grid } });

    const endless = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(5); G.newRun();
      G.startLevel(G.CAMPAIGN_LEVELS + 1);
      G.setLives(0);
      G.step(1 / 30, 1);
      return { state: G.st().state, level: G.st().level, scores: G.scores().length };
    });
    check('endless has no retries — a breach there ends the run and records it',
      endless.state === 'dead' && endless.scores === 1, endless);
  }

  /* =================================================================== */
  group('the introduction is measured in waves');
  {
    const r = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(9); G.newRun();
      const seen = [];
      let lastWave = 0;
      for (let i = 0; i < 60000; i++) {
        G.step(1 / 30, 1);
        if (i % 60 === 0) G.setLives(9999);
        const s = G.st();
        if (s.wave !== lastWave) { seen.push({ wave: s.wave, n: s.unlocked.length, lab: s.labOpen }); lastWave = s.wave; }
        if (s.phase === 'levelclear') break;
      }
      return { seen, order: G.BUILD_ORDER, unlock: G.UNLOCK };
    });
    const counts = r.seen.map(s => s.n);
    check('exactly one new tile unlocks every wave through the first level',
      counts.length >= 8 && counts.slice(0, 8).every((n, i) => n === i + 1), counts);
    check('the lab opens on wave 5, not before',
      r.seen[3] && r.seen[4] && r.seen[3].lab === false && r.seen[4].lab === true,
      r.seen.map(s => ({ w: s.wave, lab: s.lab })));
    check('the turret comes first and the wall-only modules come last',
      r.unlock.turret === 1 && r.unlock.armor === 7 && r.unlock.regen === 8, r.unlock);
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
    const rising = r.every(row => row.slice(0, -1).every((v, i) => row[i + 1] > v));
    const bossSpike = r.every(row => row[row.length - 1] > row[row.length - 2]);
    const opensEasier = r.slice(1).every((row, i) => row[0] < r[i][r[i].length - 1]);
    const higherFloor = r.slice(1).every((row, i) => row[0] > r[i][0]);
    check('waves harden across a level', rising, r.map(row => +row[0].toFixed(2)));
    check('the BREAKER wave is a spike on top of that', bossSpike);
    check('the next level opens EASIER than the boss you just beat', opensEasier);
    check('…but on a higher floor than the level before it', higherFloor);
    const elites = await P(() => {
      const G = window.__TB;
      const a = G.wave(20).map(e => e.elite), b = G.wave(20).map(e => e.elite);
      return { same: JSON.stringify(a) === JSON.stringify(b), any: a.some(Boolean),
               l1: G.wave(3).some(e => e.elite) };
    });
    check('elites are stamped deterministically, not rolled',
      elites.same && elites.any, elites);
    check('no elites before level 3', elites.l1 === false, elites);
  }

  /* =================================================================== */
  group('pacing — a level is about eight minutes of budget');
  {
    const r = await P(() => {
      const G = window.__TB;
      const p = G.pacing();
      let spawn = 0;
      for (let w = 1; w <= G.WAVES_PER_LEVEL; w++) spawn += G.spawnWindowFor(w);
      return { spawn, grace: p.GRACE_T, gap: p.GAP_T, waves: G.WAVES_PER_LEVEL };
    });
    const budget = r.grace + r.spawn + r.gap * (r.waves - 1);
    check('the spawn + gap + grace budget lands the level near eight minutes',
      budget > 330 && budget < 520, { seconds: Math.round(budget), minutes: +(budget / 60).toFixed(2) });
  }

  /* =================================================================== */
  group('the canvas-drawn UI, pressed the way a thumb does');
  {
    await P(() => { const G = window.__TB; G.clearStorage(); G.seedRandom(11); G.newRun(); G.unlockAll(); G.setCash(100000); G.setPhase('grace'); });
    await page.waitForTimeout(120);
    const cards = await P(() => window.__TB.cardRects());
    check('the build bar draws a card for every tile type',
      cards.length === 8 && cards.map(c => c.kind).includes('turret') && cards.map(c => c.kind).includes('regen'),
      cards.map(c => c.kind));

    const armed = await P(() => {
      const G = window.__TB, T = window.__T;
      const card = G.cardRects().find(c => c.kind === 'turret');
      T.tap(card.x + card.w / 2, card.y + card.h / 2);
      return G.st().armed;
    });
    check('tapping a card arms it', armed === 'turret', armed);

    const placed = await P(() => {
      const G = window.__TB, T = window.__T;
      const c = G.buildableCells('turret')[0];
      T.tap(G.cellCx(c.c), G.cellCy(c.r));
      return { turrets: G.st().turrets, stillArmed: G.st().armed, cell: c };
    });
    check('tapping a tile with a card armed places it', placed.turrets === 1, placed);
    check('and it STAYS armed, so a turret can be ringed in four more taps',
      placed.stillArmed === 'turret', placed);

    const disarm = await P(() => {
      const G = window.__TB, T = window.__T;
      const card = G.cardRects().find(c => c.kind === 'turret');
      T.tap(card.x + card.w / 2, card.y + card.h / 2);
      return G.st().armed;
    });
    check('tapping the armed card again puts it away', disarm === null, disarm);

    const dragged = await P(() => {
      const G = window.__TB, T = window.__T;
      const card = G.cardRects().find(c => c.kind === 'fire');
      const c = G.buildableCells('fire').find(z => !G.tileAt(z.r, z.c));
      T.drag(card.x + card.w / 2, card.y + card.h / 2, G.cellCx(c.c), G.cellCy(c.r));
      return { modules: G.st().modules, armed: G.st().armed };
    });
    check('dragging a card onto a tile places it too — both grammars are first-class',
      dragged.modules === 1 && dragged.armed === null, dragged);

    const inspect = await P(() => {
      const G = window.__TB, T = window.__T;
      const t = G.tilesRaw().find(z => z.kind === 'turret');
      T.tap(G.cellCx(t.c), G.cellCy(t.r));
      return { sel: G.selected(), r: t.r, c: t.c };
    });
    check('tapping a placed tile selects it', inspect.sel && inspect.sel.kind === 'turret', inspect);
    await page.waitForTimeout(90);
    const stale = await P(() => ({ cards: window.__TB.cardRects().length, panel: Object.keys(window.__TB.panelRects()) }));
    check('the selection panel CLEARS the build-card hitboxes — no invisible taps',
      stale.cards === 0 && stale.panel.includes('sell'), stale);

    const sold = await P(() => {
      const G = window.__TB, T = window.__T;
      const b = G.panelRects().sell;
      T.tap(b.x + b.w / 2, b.y + b.h / 2);
      return { turrets: G.st().turrets, sel: G.selected() };
    });
    check('the SELL button on that panel works when pressed as a thumb would',
      sold.turrets === 0 && sold.sel === null, sold);
    await page.waitForTimeout(90);
    const back = await P(() => window.__TB.cardRects().length);
    check('and the build cards come back afterwards', back === 8, back);

    const z = await P(() => ({
      mute: getComputedStyle(document.getElementById('mute')).zIndex,
      backBtn: getComputedStyle(document.getElementById('back-btn')).zIndex,
      overlay: getComputedStyle(document.getElementById('ui')).zIndex,
      href: document.getElementById('back-btn').getAttribute('href'),
    }));
    check('the ← and 🔊 chrome sits ABOVE any full-screen overlay',
      +z.mute > +z.overlay && +z.backBtn > +z.overlay, z);
    check('the back button points at the games hub', z.href === '../index.html', z);
  }

  /* =================================================================== */
  group('persistence');
  {
    const r = await P(() => {
      const G = window.__TB, H = window.__H;
      H.fresh();
      const spot = H.plusSpot();
      G.place('turret', spot.r, spot.c);
      H.ring(spot, ['fire', 'ice']);
      G.addCores(50); G.buyLab('grid');
      const before = G.st();
      G.save(1);
      G.newRun();                          // wipe the board
      const wiped = G.st();
      const ok = G.load(1);
      const after = G.st();
      return { ok, before: { t: before.turrets, m: before.modules, lab: before.lab.grid, links: before.links },
               wiped: wiped.turrets,
               after: { t: after.turrets, m: after.modules, lab: after.lab.grid, links: after.links } };
    });
    check('a save round-trips the board, the lab and the live grid links',
      r.ok && r.wiped === 0 && JSON.stringify(r.before) === JSON.stringify(r.after), r);

    const pend = await P(() => {
      const G = window.__TB;
      G.clearStorage(); G.seedRandom(13); G.newRun();
      G.startLevel(2);
      G.unlockAll(); G.setCash(100000);
      const c = G.buildableCells('turret')[0];
      G.place('turret', c.r, c.c);
      // force the level to clear, which writes the between-levels save
      G.setPhase('levelclear', 0.001);
      G.step(0.01, 2);
      const afterAdvance = G.st();
      const raw = JSON.parse(localStorage.getItem('turretBuilder.v1.auto'));
      G.newRun();
      const ok = G.load ? true : false;
      return { level: afterAdvance.level, turrets: afterAdvance.turrets,
               pending: raw && raw.pending, savedLevel: raw && raw.run.level, ok };
    });
    check('the between-levels save opens a FRESH level, never the last one’s board',
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
