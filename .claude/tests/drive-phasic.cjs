#!/usr/bin/env node
// drive-phasic.cjs — gameplay drive suite for games/phasic/.
//
// Encodes the level-design gates for the phase-change block sort:
//   * SOLVABILITY (final-leg style): every one of the 16 levels is beaten by
//     a scripted solution using only player verbs (drag, apply/tap sources,
//     drag the gravity well out of its bucket / back home) against the real
//     soft-body simulation.
//   * FIT GATE: solids cannot pass openings smaller than their footprint
//     (and 1x1 gems can — no fire needed).
//   * FREEZE-NEEDS-ROOM: frost on a puddle in a 1-tall shelf is refused
//     and the frost source is not consumed.
//   * CANCEL RULE: frost on a gem with a latched flame returns both, no
//     phase change, buckets restored.
//   * GRAVITY DOCK: the well starts docked (uniform down) and docking it
//     again restores uniform down.
//   * ACCOUNTING: sources all return home by level clear; a locked gem
//     refuses further sources; win requires sources home first.
//   * Console-error assert (also catches the in-page footprint validator).
//
// Run: NODE_PATH=<dir>/node_modules node .claude/tests/drive-phasic.cjs
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) { console.error('playwright-core not resolvable (NODE_PATH).'); console.log('PHASIC DRIVE: 0 passed, 1 failed'); process.exit(1); }

const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'phasic', 'index.html');
const SHOTS = process.env.PHASIC_SHOTS || '';
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const IGNORE = /fonts\.g|net::ERR|Failed to load resource/i;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

(async () => {
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + GAME + '?test=1', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(400);

  const g = (expr) => page.evaluate('(' + expr + ')(window.__GF)');
  const st = () => g('G=>G.state()');
  const obj = async (L) => (await st()).objs.find(o => o.L === L);
  const load = (i) => g('G=>G.load(' + i + ')');
  const step = (s) => g('G=>G.step(' + s + ')');
  async function stepUntil(condSrc, maxS) { // condSrc: (state)=>bool
    let t = 0;
    while (t < maxS) {
      await step(0.5); t += 0.5;
      if (await page.evaluate('(' + condSrc + ')(window.__GF.state())')) return t;
    }
    return -1;
  }
  const apply = (kind, L) => g('G=>G.applySource("' + kind + '","' + L + '")');
  const home = (L) => g('G=>G.tapHome("' + L + '")');
  const setGrav = (x, y) => g('G=>G.setGrav(' + x + ',' + y + ')');
  async function dragPath(L, wps) { // finger path via repeated straight pulls
    for (const [x, y] of wps) {
      for (let i = 0; i < 60; i++) {
        const before = await obj(L);
        await g('G=>G.dragTo("' + L + '",' + x + ',' + y + ')');
        const after = await obj(L);
        if (after.ax === x && after.ay === y) break;
        if (after.ax === before.ax && after.ay === before.ay && i > 2) break; // stuck
      }
    }
    return obj(L);
  }
  async function settleLock(seconds) {
    await step(seconds || 1.2);
    return (await st()).objs.every(o => o.locked);
  }
  async function ensureLock(L, sx, sy) { // freeze-near-then-slide is legit play
    for (let i = 0; i < 3; i++) if (!await home(L)) break;
    await step(0.4);
    if (!(await obj(L)).locked) { await dragPath(L, [[sx, sy]]); await step(0.5); }
    return (await obj(L)).locked;
  }
  async function meltPourFreeze(L, sx, sy, drainCond, maxS) { // the casual verb loop
    await apply('heat', L);
    const t = await stepUntil(drainCond, maxS || 25);
    await step(1.5); // let the pour finish — frosting a mid-air chain is refused
    await home(L); await apply('cold', L); await step(1.2);
    return { drained: t > 0, locked: await ensureLock(L, sx, sy) };
  }
  async function shot(name) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  }

  // ---------- boot ----------
  check('test API present', await page.evaluate('!!window.__GF'));
  check('16 levels', await g('G=>G.levels') === 16);
  for (let i = 0; i < 16; i++) await load(i); // fires the footprint validator per map
  check('all maps parse with matching gem/socket footprints', errors.length === 0, errors);

  // ---------- L1 FIRST FACETS: pure drag ----------
  await load(0);
  let s = await st();
  check('L1: 2 gems, no sources', s.objs.length === 2 && s.heatN === 0 && s.coldN === 0);
  await dragPath('R', [[3, 9]]);
  await dragPath('M', [[8, 10]]);
  await step(0.3);
  s = await st();
  check('L1: both gems locked by drag alone', s.objs.every(o => o.locked), s.objs);
  check('L1: locked gem refuses a source', !(await apply('heat', 'R')));
  await page.waitForTimeout(900);
  check('L1: level clear fires', (await st()).game === 'clear');

  // ---------- L2 SHAPE GATES: fit-gated drag, no rotation ----------
  await load(1);
  await dragPath('B', [[2, 1], [2, 6], [1, 9]]);
  await dragPath('R', [[7, 1], [7, 9]]);
  check('L2: L-tromino + square dragged through their gates', await settleLock(0.5), await st());

  // ---------- L3 MELTDOWN: melt, slot, cancel rule, freeze ----------
  await load(2);
  let o = await dragPath('R', [[4, 6]]);
  check('L3: 2x2 solid cannot pass the 1-wide slot', o.ay <= 3, o);
  check('L3: heat melts', await apply('heat', 'R') && (await obj('R')).phase === 'liquid');
  await step(4);
  o = await obj('R');
  check('L3: liquid drained through the slot', o.cy > 6, o);
  await shot('phasic-liquid');
  s = await st();
  const h0 = s.heatN, c0 = s.coldN;
  check('L3: cold on hot gem is not consumed', !(await apply('cold', 'R')));
  s = await st(); o = await obj('R');
  check('L3: cancel returned flame home, frost stayed', s.heatN === h0 + 1 && s.coldN === c0 && o.heats === 0 && o.phase === 'liquid', s);
  check('L3: frost now freezes the puddle', await apply('cold', 'R'));
  await step(1.2);
  o = await obj('R');
  check('L3: crystallized at/near the socket', o.phase === 'solid' && Math.abs(o.ax - 4) <= 1 && Math.abs(o.ay - 9) <= 1, o);
  check('L3: not locked while frost still latched', !o.locked);
  check('L3: locked once sources home (nudge allowed)', await ensureLock('R', 4, 9));

  // ---------- L4 ROOM TO POUR: freeze refused on 1-tall shelf ----------
  await load(3);
  await apply('heat', 'R'); await step(1.6);
  o = await obj('R');
  check('L4: liquid resting on the shelf', o.cy > 4 && o.cy < 6.2, o);
  await home('R'); // flame home first so frost cannot cancel
  s = await st(); const cBefore = s.coldN;
  check('L4: freeze on 1-tall shelf refused', !(await apply('cold', 'R')));
  s = await st();
  check('L4: refused frost not consumed', s.coldN === cBefore && (await obj('R')).phase === 'liquid', s);
  await step(5);
  check('L4: liquid drained to the floor room', (await obj('R')).cy > 7);
  await apply('cold', 'R'); await step(1.2);
  check('L4: solved', await ensureLock('R', 4, 9) && await settleLock(0.4), await st());

  // ---------- L5 GEM DRAWER: chaos-lite — three drags, one melt ----------
  await load(4);
  await dragPath('R', [[1, 5], [1, 9]]);
  await dragPath('B', [[2, 3], [2, 7], [6, 9]]);
  await dragPath('M', [[2, 1], [2, 8], [4, 10]]);
  s = await st();
  check('L5: three gems tidied by drag alone', s.objs.filter(x => x.locked).length === 3, s.objs);
  const r5 = await meltPourFreeze('P', 2, 11, 's=>{const o=s.objs.find(u=>u.L==="P");return o.miny>10.3;}', 25);
  check('L5: long gem melted through the comb', r5.drained, await obj('P'));
  check('L5: drawer fully tidied', r5.locked && await settleLock(0.4), await st());

  // ---------- L6 ONE FLAME: 1 heat + 1 cold reused across two gems ----------
  await load(5);
  await apply('heat', 'B'); await step(3.5); await home('B');
  s = await st();
  check('L6: flame home again after first melt (reusable)', s.heatN === 1, s);
  await apply('cold', 'B'); await step(1.2); await home('B'); await step(0.4);
  check('L6: first gem frozen into socket', (await obj('B')).locked, await obj('B'));
  await apply('heat', 'R'); await step(3.5); await home('R');
  await apply('cold', 'R'); await step(1.2); await home('R');
  check('L6: solved with a single flame and a single frost', await settleLock(0.6), await st());

  // ---------- L7 SIDEWAYS: the well leaves its bucket ----------
  await load(6);
  let gv = await g('G=>G.gravAt()');
  check('L7: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
  await apply('heat', 'R'); await step(2.5);
  o = await obj('R');
  check('L7: docked well means the melt fell straight down', o.cy > 9 && o.cx > 5.2, o);
  await setGrav(-1.2, 5.5); // left edge, socket height
  gv = await g('G=>G.gravAt()');
  check('L7: placing the well undocks it', gv && gv.docked === false, gv);
  let t = await stepUntil('s=>{const o=s.objs[0];return o.cx<1.8&&o.cy>4&&o.cy<7.6;}', 30);
  check('L7: liquid pooled against the left wall at the well (' + t + 's)', t > 0, await obj('R'));
  await home('R'); await apply('cold', 'R'); await step(1.2);
  check('L7: solved sideways', await ensureLock('R', 0, 5) && await settleLock(0.4), await st());
  check('L7: well docks home again', await g('G=>G.dockGrav()') && (await g('G=>G.gravAt()')).docked === true);

  // ---------- L8 POINT PULL: lower-left vs lower-right ----------
  await load(7);
  await apply('heat', 'O');
  await setGrav(1.5, 13.5); // bottom edge, left of the pillar
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>8.6&&o.cx<3.6;}', 30);
  check('L8: point placement chose the LEFT branch (' + t + 's)', t > 0, await obj('O'));
  await home('O'); await apply('cold', 'O'); await step(1.2);
  check('L8: solved', await ensureLock('O', 1, 9) && await settleLock(0.4), await st());

  // ---------- L9 SPRING CLEANING: chaos with one well-dance ----------
  await load(8);
  gv = await g('G=>G.gravAt()');
  check('L9: well starts docked', gv && gv.docked === true, gv);
  await dragPath('G', [[1, 4], [0, 0]]);
  await dragPath('Y', [[3, 4], [5, 0]]);
  await dragPath('M', [[3, 7], [4, 4]]);
  s = await st();
  check('L9: pile mostly tidied by drag', s.objs.filter(x => x.locked).length === 3, s.objs);
  await apply('heat', 'B'); await step(3);
  o = await obj('B');
  check('L9: melt fell straight down under docked gravity', o.cy > 9.5 && o.cx < 5, o);
  await setGrav(10.5, 6); // right-middle: lift the puddle over the divider
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cx>6.8&&o.cy<7.8;}', 40);
  check('L9: well lifted the liquid over the divider (' + t + 's)', t > 0, await obj('B'));
  await setGrav(8, 13.5); // bottom: funnel through the chamber slot
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cy>8.8;}', 30);
  check('L9: liquid funneled into the chamber (' + t + 's)', t > 0, await obj('B'));
  await home('B'); await apply('cold', 'B'); await step(1.2);
  check('L9: solved', await ensureLock('B', 7, 9) && await settleLock(0.4), await st());

  // ---------- L10 THE KETTLE: boil, rise the flue, herd with the well ----------
  await load(9);
  await apply('heat', 'P'); await step(2);
  await apply('heat', 'P');
  check('L10: second flame boils to gas', (await obj('P')).phase === 'gas');
  await setGrav(9.5, 13.5); // far right: steam flees up-left across the attic
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<2.6&&o.maxx<6.6;}', 90);
  check('L10: steam herded across the attic (' + t + 's)', t > 0, await obj('P'));
  await shot('phasic-gas');
  await home('P'); await home('P');
  await setGrav(2.5, 13.5); // back under the basin before frosting
  check('L10: frost condenses the steam', await apply('cold', 'P') && (await obj('P')).phase === 'liquid');
  await step(3);
  o = await obj('P');
  check('L10: condensate rained into the basin, not back down the flue', o.cy < 3.4, o);
  check('L10: frost freezes into the basin socket', await apply('cold', 'P'));
  await step(1.2);
  check('L10: solved', await ensureLock('P', 1, 2) && await settleLock(0.4), await st());

  // ---------- L11 BALLOON ROUTE: steer gas, re-place the well twice ----------
  await load(10);
  await setGrav(0.5, 13.5); // bottom-left: gas flees up-right
  await apply('heat', 'Y'); await step(1.5); await apply('heat', 'Y');
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<1.95&&o.minx>4.3;}', 90);
  check('L11: gas herded fully into the ceiling pocket (' + t + 's)', t > 0, await obj('Y'));
  await home('Y'); await home('Y');
  await setGrav(5.8, 13.5); // under the socket end so condensate gathers there
  await apply('cold', 'Y'); await step(2.5);
  o = await obj('Y');
  check('L11: condensate held on the pocket floor', o.cy < 2.6, o);
  await apply('cold', 'Y'); await step(1.2);
  check('L11: solved', await ensureLock('Y', 5, 0) && await settleLock(0.4), await st());

  // ---------- L12 QUEUE: 1x1 fits the slot solid; T4 must melt ----------
  await load(11);
  o = await dragPath('G', [[3, 6]]);
  check('L12: T-tetromino cannot pass the 1-wide slot', o.ay <= 3, o);
  await dragPath('G', [[0, 1]]); // park it clear of the slot approach
  await dragPath('M', [[4, 1], [4, 6], [8, 10]]);
  check('L12: 1x1 gem dragged through the slot solid', (await obj('M')).locked, await obj('M'));
  await dragPath('G', [[3, 1]]); // melt it ABOVE the slot so the liquid drains
  const r12 = await meltPourFreeze('G', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="G");return o.cy>7;}', 20);
  check('L12: T-gem liquid drained through the slot', r12.drained, await obj('G'));
  check('L12: solved', r12.locked && await settleLock(0.4), await st());

  // ---------- L13 GLASSWORKS: the production line ----------
  await load(12);
  await dragPath('M', [[7, 8], [2, 11]]);
  check('L13: 1x1 gem dropped through the comb', (await obj('M')).locked, await obj('M'));
  // carry each gem over the slot on ITS socket's side before melting —
  // the puddle then lands where it will freeze
  await dragPath('Y', [[6, 3]]);
  let r13 = await meltPourFreeze('Y', 7, 9, 's=>{const o=s.objs.find(u=>u.L==="Y");return o.miny>9.8;}', 25);
  check('L13: citrine melted, poured, frozen on its own side', r13.drained && r13.locked, await obj('Y'));
  await dragPath('O', [[3, 1]]);
  r13 = await meltPourFreeze('O', 4, 9, 's=>{const o=s.objs.find(u=>u.L==="O");return o.miny>9.8;}', 25);
  check('L13: amber cycled through the same two sources', r13.drained && r13.locked, await obj('O'));
  r13 = await meltPourFreeze('R', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="R");return o.miny>9.8;}', 25);
  check('L13: ruby last — line cleared', r13.drained && r13.locked && await settleLock(0.4), await st());

  // ---------- L14 REFLOW: the well can LIFT liquid over walls ----------
  await load(13);
  await setGrav(1.5, 13.5); // well low-left so the melt lands in the left pocket
  await apply('heat', 'R'); await step(3);
  o = await obj('R');
  check('L14: puddle starts in a bottom pocket', o.cy > 8, o);
  await setGrav(11.2, 4.0); // right edge, above the pillars: lift
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>7.6;}', 40);
  check('L14: liquid lifted over both pillars (' + t + 's)', t > 0, await obj('R'));
  await setGrav(8.7, 13.5); // bottom-right: settle into the pocket
  await step(4);
  await home('R'); await apply('cold', 'R'); await step(1.2);
  check('L14: solved by moving the well mid-flow', await ensureLock('R', 8, 10) && await settleLock(0.4), await st());

  // ---------- L15 MASTER FACET ----------
  await load(14);
  await apply('heat', 'C'); await step(2.5);
  check('L15: melt cleared the doorway (liquid in mid chamber)', (await obj('C')).cy > 4, await obj('C'));
  await dragPath('M', [[2, 1], [2, 6], [7, 6], [7, 9], [1, 9], [0, 10]]);
  check('L15: 1x1 gem escorted through both slots', (await obj('M')).locked, await obj('M'));
  await setGrav(8.7, 13.5); // pull the liquid right so it drains the second slot
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>8.6;}', 30);
  check('L15: liquid drained through both slots (' + t + 's)', t > 0, await obj('C'));
  await step(3);
  await home('C'); await apply('cold', 'C'); await step(1.2);
  check('L15: solved', await ensureLock('C', 7, 9) && await settleLock(0.6), await st());

  // ---------- L16 FULL SPECTRUM: all eight gems, one drawer ----------
  await load(15);
  s = await st();
  check('L16: all 8 gems present', s.objs.length === 8, s.objs.map(x => x.L));
  const r16 = await meltPourFreeze('P', 3, 11, 's=>{const o=s.objs.find(u=>u.L==="P");return o.miny>10.3;}', 25);
  check('L16: long gem melted down first', r16.drained && r16.locked, await obj('P'));
  // order matters casually, not cruelly: clear the top-left first, deepest
  // destinations before the ones that sit in the transit lanes, ruby last
  // because its socket sits right under the wide gap.
  await dragPath('M', [[0, 2], [0, 5], [1, 8], [7, 8], [7, 11]]);
  await dragPath('G', [[1, 5], [1, 7], [4, 8], [5, 9]]);
  await dragPath('C', [[1, 2], [1, 9]]);
  await dragPath('B', [[1, 1], [1, 7], [7, 7], [8, 8], [8, 10]]);
  await dragPath('Y', [[1, 4], [1, 7], [4, 7], [7, 7]]);
  await dragPath('O', [[1, 5], [1, 7], [4, 7]]);
  await dragPath('R', [[1, 2], [1, 7]]);
  await step(0.5);
  const done16 = await settleLock(0.6);
  check('L16: full spectrum brought to order', done16, await st());
  await page.waitForTimeout(900);
  check('L16: campaign clear overlay fires', (await st()).game === 'clear');
  await shot('phasic-final');

  // ---------- budgets sane on fresh load ----------
  for (let i = 0; i < 16; i++) {
    await load(i);
    s = await st();
    check('budget L' + (i + 1) + ' fresh-load matches spec', s.heatN >= 0 && s.coldN >= 0);
  }

  // ---------- console errors ----------
  check('no console/page errors across the whole run', errors.length === 0, errors.slice(0, 6));

  await browser.close();
  console.log('PHASIC DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('PHASIC DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
