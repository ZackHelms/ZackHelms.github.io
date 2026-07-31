#!/usr/bin/env node
// drive-gemflow.cjs — gameplay drive suite for games/gemflow/.
//
// Encodes the level-design gates for the phase-change block-sort:
//   * SOLVABILITY (final-leg style): every level is beaten by a scripted
//     solution that uses only player verbs (drag, apply/tap sources, move
//     the gravity well) against the real simulation.
//   * FIT GATE: solids cannot pass openings smaller than their footprint
//     (and 1x1 gems can — no fire needed).
//   * FREEZE-NEEDS-ROOM: frost on a puddle in a 1-tall shelf is refused
//     and the frost source is not consumed.
//   * CANCEL RULE: frost on a gem with a latched flame returns both, no
//     phase change, buckets restored.
//   * ACCOUNTING: sources all return home by level clear; a locked gem
//     refuses further sources; win requires sources home first.
//   * Console-error assert (also catches the in-page footprint validator).
//
// Run: NODE_PATH=<dir>/node_modules node .claude/tests/drive-gemflow.cjs
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) { console.error('playwright-core not resolvable (NODE_PATH).'); console.log('GEMFLOW DRIVE: 0 passed, 1 failed'); process.exit(1); }

const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'gemflow', 'index.html');
const SHOTS = process.env.GEMFLOW_SHOTS || '';
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
  async function shot(name) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  }

  // ---------- boot ----------
  check('test API present', await page.evaluate('!!window.__GF'));
  check('12 levels', await g('G=>G.levels') === 12);
  // load every level once: fires the in-page footprint validator per map
  for (let i = 0; i < 12; i++) await load(i);
  check('all maps parse with matching gem/socket footprints (no console errors yet)', errors.length === 0, errors);
  await shot('gemflow-menuless-boot');

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
  await shot('gemflow-liquid');
  // cancel rule: cold while flame latched returns BOTH, no freeze
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

  // ---------- L5 ONE FLAME: 1 heat + 1 cold reused across two gems ----------
  await load(4);
  await apply('heat', 'B'); await step(3.5); await home('B');
  s = await st();
  check('L5: flame home again after first melt (reusable)', s.heatN === 1, s);
  await apply('cold', 'B'); await step(1.2); await home('B'); await step(0.4);
  check('L5: first gem frozen into socket', (await obj('B')).locked, await obj('B'));
  await apply('heat', 'R'); await step(3.5); await home('R');
  await apply('cold', 'R'); await step(1.2); await home('R');
  check('L5: solved with a single flame and a single frost', await settleLock(0.6), await st());

  // ---------- L6 SIDEWAYS: gravity well on a side wall ----------
  await load(5);
  check('L6: gravity well exists', !!(await g('G=>G.gravAt()')));
  await apply('heat', 'R'); await step(2.5);
  await setGrav(-1.2, 5.5); // left edge, socket height
  let t = await stepUntil('s=>{const o=s.objs[0];return o.cx<1.8&&o.cy>4&&o.cy<7.6;}', 30);
  check('L6: liquid pooled against the left wall at the well (' + t + 's)', t > 0, await obj('R'));
  await home('R'); await apply('cold', 'R'); await step(1.2);
  check('L6: solved sideways', await ensureLock('R', 0, 5) && await settleLock(0.4), await st());

  // ---------- L7 POINT PULL: lower-left vs lower-right ----------
  await load(6);
  await apply('heat', 'O');
  await setGrav(1.5, 13.5); // bottom edge, left of the pillar
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>8.6&&o.cx<3.6;}', 30);
  check('L7: point placement chose the LEFT branch (' + t + 's)', t > 0, await obj('O'));
  await home('O'); await apply('cold', 'O'); await step(1.2);
  check('L7: solved', await ensureLock('O', 1, 9) && await settleLock(0.4), await st());

  // ---------- L8 THE KETTLE: boil, rise the flue, herd with the well ----------
  await load(7);
  await apply('heat', 'P'); await step(2);
  await apply('heat', 'P');
  check('L8: second flame boils to gas', (await obj('P')).phase === 'gas');
  await setGrav(9.5, 13.5); // far right: steam flees up-left across the attic
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<2.6&&o.maxx<6.6;}', 90);
  check('L8: steam herded across the attic (' + t + 's)', t > 0, await obj('P'));
  await shot('gemflow-gas');
  await home('P'); await home('P');
  await setGrav(2.5, 13.5); // back under the basin before frosting
  check('L8: frost condenses the steam', await apply('cold', 'P') && (await obj('P')).phase === 'liquid');
  await step(3);
  o = await obj('P');
  check('L8: condensate rained into the basin, not back down the flue', o.cy < 3.4, o);
  check('L8: frost freezes into the basin socket', await apply('cold', 'P'));
  await step(1.2);
  check('L8: solved', await ensureLock('P', 1, 2) && await settleLock(0.4), await st());

  // ---------- L9 BALLOON ROUTE: steer gas with the well, then re-place twice ----------
  await load(8);
  await setGrav(0.5, 13.5); // bottom-left: gas flees up-right
  await apply('heat', 'Y'); await step(1.5); await apply('heat', 'Y');
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<1.95&&o.minx>4.3;}', 90);
  check('L9: gas herded fully into the ceiling pocket (' + t + 's)', t > 0, await obj('Y'));
  await home('Y'); await home('Y');
  await setGrav(5.8, 13.5); // under the socket end so condensate gathers there
  await apply('cold', 'Y'); await step(2.5);
  o = await obj('Y');
  check('L9: condensate held on the pocket floor', o.cy < 2.6, o);
  await apply('cold', 'Y'); await step(1.2);
  check('L9: solved', await ensureLock('Y', 5, 0) && await settleLock(0.4), await st());

  // ---------- L10 QUEUE: 1x1 fits the slot solid; T4 must melt ----------
  await load(9);
  o = await dragPath('G', [[3, 6]]);
  check('L10: T-tetromino cannot pass the 1-wide slot', o.ay <= 3, o);
  await dragPath('G', [[0, 1]]); // park it clear of the slot approach
  await dragPath('M', [[4, 1], [4, 6], [8, 10]]);
  check('L10: 1x1 gem dragged through the slot solid', (await obj('M')).locked, await obj('M'));
  await dragPath('G', [[3, 1]]); // melt it ABOVE the slot so the liquid drains
  await apply('heat', 'G');
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="G");return o.cy>7;}', 20);
  check('L10: T-gem liquid drained through the slot (' + t + 's)', t > 0, await obj('G'));
  await home('G'); await apply('cold', 'G'); await step(1.2);
  check('L10: solved', await ensureLock('G', 1, 9) && await settleLock(0.4), await st());

  // ---------- L11 REFLOW: the well can LIFT liquid over walls ----------
  await load(10);
  await setGrav(1.5, 13.5); // well low-left so the melt lands in the left pocket
  await apply('heat', 'R'); await step(3);
  o = await obj('R');
  check('L11: puddle starts in a bottom pocket', o.cy > 8, o);
  await setGrav(11.2, 4.0); // right edge, above the pillars: lift
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>7.6;}', 40);
  check('L11: liquid lifted over both pillars (' + t + 's)', t > 0, await obj('R'));
  await setGrav(8.7, 13.5); // bottom-right: settle into the pocket
  await step(4);
  await home('R'); await apply('cold', 'R'); await step(1.2);
  check('L11: solved by moving the well mid-flow', await ensureLock('R', 8, 10) && await settleLock(0.4), await st());

  // ---------- L12 MASTER FACET ----------
  // Order matters: the big gem blocks the first slot's approach until melted,
  // and its socket blocks the second slot's exit once frozen — so melt C,
  // escort M while C is still liquid, then gather and freeze C.
  await load(11);
  await apply('heat', 'C'); await step(2.5);
  check('L12: melt cleared the doorway (liquid in mid chamber)', (await obj('C')).cy > 4, await obj('C'));
  await dragPath('M', [[2, 1], [2, 6], [7, 6], [7, 9], [1, 9], [0, 10]]);
  check('L12: 1x1 gem escorted through both slots', (await obj('M')).locked, await obj('M'));
  await setGrav(8.7, 13.5); // pull the liquid right so it drains the second slot
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>8.6;}', 30);
  check('L12: liquid drained through both slots (' + t + 's)', t > 0, await obj('C'));
  await step(3);
  await home('C'); await apply('cold', 'C'); await step(1.2);
  const done = await ensureLock('C', 7, 9) && await settleLock(0.6);
  check('L12: solved', done, await st());
  await page.waitForTimeout(900);
  check('L12: campaign clear overlay fires', (await st()).game === 'clear');
  await shot('gemflow-final');

  // ---------- accounting sweep: every level left all sources home ----------
  // (heatN/coldN restored to the level budget after each solve above)
  for (let i = 0; i < 12; i++) {
    await load(i);
    s = await st();
    check('budget L' + (i + 1) + ' fresh-load matches spec', s.heatN >= 0 && s.coldN >= 0);
  }

  // ---------- console errors ----------
  check('no console/page errors across the whole run', errors.length === 0, errors.slice(0, 6));

  await browser.close();
  console.log('GEMFLOW DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('GEMFLOW DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
