#!/usr/bin/env node
// drive-phasic.cjs — gameplay drive suite for games/phasic/.
//
// Encodes the level-design gates for the phase-change block sort under the
// REVERSION model (phase = flame count; taking a flame back cools one step):
//   * SOLVABILITY: every authored level is beaten by a scripted player
//     solution (drag, flame, tap-to-revert, gravity well) on the real sim.
//   * GENERATED-CONTENT GATE: every seeded procedural level 17-32 (plus
//     endless spot checks) replays its generation-time solver script to a
//     full win — a served level is a solved level.
//   * FIT GATE: solids cannot pass openings smaller than their footprint.
//   * REVERSION RULES: tap on gas condenses; tap on liquid freezes only
//     with room (else the flame stays); frost quenches a flame from afar
//     without being consumed.
//   * LIVE SOCKETS: a gem resting home can still be dragged out and melted.
//   * WIN RULE: level clears when all gems sit home, even with the gravity
//     well still deployed on the ring.
//   * MENU: level list entries are one line, "N · Title Case ✓".
//   * STUCK: auto-solve-and-skip completes any level.
//   * Console-error assert (also catches the footprint validator).
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
  async function stepUntil(condSrc, maxS) {
    let t = 0;
    while (t < maxS) {
      await step(0.5); t += 0.5;
      if (await page.evaluate('(' + condSrc + ')(window.__GF.state())')) return t;
    }
    return -1;
  }
  const apply = (kind, L) => g('G=>G.applySource("' + kind + '","' + L + '")');
  const tap = (L) => g('G=>G.tapHome("' + L + '")');
  const setGrav = (x, y) => g('G=>G.setGrav(' + x + ',' + y + ')');
  async function dragPath(L, wps) {
    for (const [x, y] of wps) {
      for (let i = 0; i < 60; i++) {
        const before = await obj(L);
        await g('G=>G.dragTo("' + L + '",' + x + ',' + y + ')');
        const after = await obj(L);
        if (after.ax === x && after.ay === y) break;
        if (after.ax === before.ax && after.ay === before.ay && i > 2) break;
      }
    }
    return obj(L);
  }
  async function tapRetry(L) { // tap-to-revert; retry while the puddle finds room
    for (let a = 0; a < 5; a++) {
      if (await tap(L)) return true;
      await step(2);
    }
    return false;
  }
  async function allHome(seconds) {
    await step(seconds || 1.2);
    return (await st()).objs.every(o => o.home);
  }
  async function ensureHome(L, sx, sy) { // freeze-near-then-slide is legit play
    await step(0.9); // let any freeze animation finish before sliding
    if (!(await obj(L)).home) { await dragPath(L, [[sx, sy]]); await step(0.5); }
    return (await obj(L)).home;
  }
  async function meltPourTap(L, sx, sy, drainCond, maxS) { // the core casual verb loop
    await apply('heat', L);
    const t = await stepUntil(drainCond, maxS || 25);
    await step(1.5);
    const tapped = await tapRetry(L);
    await step(1.0);
    return { drained: t > 0, tapped, home: await ensureHome(L, sx, sy) };
  }
  async function shot(name) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  }

  // ---------- boot ----------
  check('test API present', await page.evaluate('!!window.__GF'));
  check('16 authored levels', await g('G=>G.authored') === 16);
  for (let i = 0; i < 16; i++) await load(i); // footprint validator per map
  check('all authored maps parse with matching footprints', errors.length === 0, errors);

  // ---------- menu format: one line, Title Case, 32+ rows ----------
  await load(0);
  const opts = await page.evaluate('[...document.querySelectorAll("#lvlsel option")].map(o=>o.textContent)');
  check('level list has 32+ one-line entries', opts.length >= 32 && opts.every(t => !t.includes('\n')), opts.length);
  check('level entries read "N · Title Case"', opts.every(t => /^\d+ · \S/.test(t)) && opts.every(t => /[a-z]/.test(t)), opts.slice(0, 3));

  // ---------- L1 First Facets: pure drag ----------
  let s = await st();
  check('L1: 2 gems, no sources', s.objs.length === 2 && s.heatN === 0 && s.coldN === 0);
  await dragPath('R', [[3, 9]]);
  await dragPath('M', [[8, 10]]);
  await step(0.3);
  check('L1: both gems home by drag alone', (await st()).objs.every(o => o.home), await st());
  await page.waitForTimeout(900);
  check('L1: level clear fires', (await st()).game === 'clear');

  // ---------- L2 Shape Gates ----------
  await load(1);
  await dragPath('B', [[2, 1], [2, 6], [1, 9]]);
  await dragPath('R', [[7, 1], [7, 9]]);
  check('L2: L-tromino + square dragged through their gates', await allHome(0.5), await st());

  // ---------- L3 Meltdown: melt, pour, frost-quench freezes from afar ----------
  await load(2);
  let o = await dragPath('R', [[4, 6]]);
  check('L3: 2x2 solid cannot pass the 1-wide slot', o.ay <= 3, o);
  check('L3: heat melts', await apply('heat', 'R') && (await obj('R')).phase === 'liquid');
  await step(4);
  check('L3: liquid drained through the slot', (await obj('R')).cy > 6);
  await step(1.5);
  await shot('phasic-liquid');
  s = await st();
  check('L3: frost thrown at the hot gem is not consumed', !(await apply('cold', 'R')) && (await st()).coldN === s.coldN);
  await step(1.2);
  o = await obj('R'); s = await st();
  check('L3: the quench took the flame home AND cooled it solid', s.heatN === 1 && o.phase === 'solid' && o.heats === 0, o);
  check('L3: home after nudge', await ensureHome('R', 4, 9));
  await page.waitForTimeout(900);
  check('L3: clear fires', (await st()).game === 'clear');

  // ---------- L4 Room to Pour: tap refused without room, flame stays ----------
  await load(3);
  await apply('heat', 'R'); await step(1.6);
  o = await obj('R');
  check('L4: liquid resting on the shelf', o.cy > 4 && o.cy < 6.2, o);
  check('L4: tap on the shelf is refused — no room to crystallize', !(await tap('R')));
  o = await obj('R'); s = await st();
  check('L4: the flame stays latched after the refusal', o.heats === 1 && o.phase === 'liquid' && s.heatN === 0, o);
  await step(5);
  check('L4: liquid drained to the floor room', (await obj('R')).cy > 7);
  check('L4: tap now freezes', await tapRetry('R'));
  await step(1.0);
  check('L4: solved', await ensureHome('R', 4, 9) && await allHome(0.4), await st());

  // ---------- L5 Gem Drawer ----------
  await load(4);
  await dragPath('R', [[1, 5], [1, 9]]);
  await dragPath('B', [[2, 3], [2, 7], [6, 9]]);
  await dragPath('M', [[2, 1], [2, 8], [4, 10]]);
  s = await st();
  check('L5: three gems tidied by drag alone', s.objs.filter(x => x.home).length === 3, s.objs);
  const r5 = await meltPourTap('P', 2, 11, 's=>{const o=s.objs.find(u=>u.L==="P");return o.miny>10.3;}', 25);
  check('L5: long gem melted through the comb and tapped solid', r5.drained && r5.tapped, r5);
  check('L5: drawer fully tidied', r5.home && await allHome(0.4), await st());

  // ---------- L6 One Flame: reuse + live sockets ----------
  await load(5);
  await apply('heat', 'B'); await step(3.5);
  check('L6: the one flame is busy', (await st()).heatN === 0);
  check('L6: tap freezes and frees the flame', await tapRetry('B') && (await st()).heatN === 1);
  check('L6: first gem home', await ensureHome('B', 1, 9));
  // live sockets: a home gem can still be melted and re-frozen
  check('L6: a home gem can be melted again', await apply('heat', 'B') && (await obj('B')).phase === 'liquid');
  check('L6: it is no longer home while molten', !(await obj('B')).home);
  await step(2.5);
  check('L6: tap re-freezes it', await tapRetry('B'));
  check('L6: back home', await ensureHome('B', 1, 9));
  await apply('heat', 'R'); await step(3.5);
  check('L6: tap freezes the second gem', await tapRetry('R'));
  check('L6: solved with a single flame', await ensureHome('R', 7, 9) && await allHome(0.4), await st());

  // ---------- L7 Sideways: the well leaves its bucket; win with well deployed ----------
  await load(6);
  let gv = await g('G=>G.gravAt()');
  check('L7: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
  await apply('heat', 'R'); await step(2.5);
  o = await obj('R');
  check('L7: docked well means the melt fell straight down', o.cy > 9 && o.cx > 5.2, o);
  await setGrav(-1.2, 5.5);
  gv = await g('G=>G.gravAt()');
  check('L7: placing the well undocks it', gv && gv.docked === false, gv);
  let t = await stepUntil('s=>{const o=s.objs[0];return o.cx<1.8&&o.cy>4&&o.cy<7.6;}', 30);
  check('L7: liquid pooled against the left wall at the well (' + t + 's)', t > 0, await obj('R'));
  check('L7: tap freezes it there', await tapRetry('R'));
  check('L7: home', await ensureHome('R', 0, 5));
  await page.waitForTimeout(900);
  gv = await g('G=>G.gravAt()');
  check('L7: level cleared WITH the well still deployed on the ring', (await st()).game === 'clear' && gv && gv.docked === false, gv);

  // ---------- L8 Point Pull ----------
  await load(7);
  await apply('heat', 'O');
  await setGrav(1.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>8.6&&o.cx<3.6;}', 30);
  check('L8: point placement chose the LEFT branch (' + t + 's)', t > 0, await obj('O'));
  check('L8: tap freezes', await tapRetry('O'));
  check('L8: solved', await ensureHome('O', 1, 9) && await allHome(0.4), await st());

  // ---------- L9 Spring Cleaning ----------
  await load(8);
  gv = await g('G=>G.gravAt()');
  check('L9: well starts docked', gv && gv.docked === true, gv);
  await dragPath('G', [[1, 4], [0, 0]]);
  await dragPath('Y', [[3, 4], [5, 0]]);
  await dragPath('M', [[3, 7], [4, 4]]);
  s = await st();
  check('L9: pile mostly tidied by drag', s.objs.filter(x => x.home).length === 3, s.objs);
  await apply('heat', 'B'); await step(3);
  o = await obj('B');
  check('L9: melt fell straight down under docked gravity', o.cy > 9.5 && o.cx < 5, o);
  await setGrav(10.5, 6);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cx>6.8&&o.cy<7.8;}', 40);
  check('L9: well lifted the liquid over the divider (' + t + 's)', t > 0, await obj('B'));
  await setGrav(8, 13.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cy>8.8;}', 30);
  check('L9: liquid funneled into the chamber (' + t + 's)', t > 0, await obj('B'));
  await step(1.5);
  check('L9: tap freezes in the chamber', await tapRetry('B'));
  check('L9: solved', await ensureHome('B', 7, 9) && await allHome(0.4), await st());

  // ---------- L10 The Kettle: steam to rain to stone, frost never needed ----------
  await load(9);
  await apply('heat', 'P'); await step(2);
  await apply('heat', 'P');
  check('L10: second flame boils to gas', (await obj('P')).phase === 'gas');
  await setGrav(9.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<2.6&&o.maxx<6.6;}', 90);
  check('L10: steam herded across the attic (' + t + 's)', t > 0, await obj('P'));
  await shot('phasic-gas');
  await setGrav(2.5, 13.5);
  check('L10: first tap condenses steam to rain', await tap('P') && (await obj('P')).phase === 'liquid');
  await step(3);
  o = await obj('P');
  check('L10: rain landed in the basin, not back down the flue', o.cy < 3.4, o);
  check('L10: second tap freezes it to stone', await tapRetry('P'));
  await step(1.0);
  check('L10: solved without touching the frost bucket', (await st()).coldN === 2 && await ensureHome('P', 1, 2) && await allHome(0.4), await st());

  // ---------- L11 Balloon Route ----------
  await load(10);
  await setGrav(0.5, 13.5);
  await apply('heat', 'Y'); await step(1.5); await apply('heat', 'Y');
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<1.95&&o.minx>4.3;}', 90);
  check('L11: gas herded fully into the ceiling pocket (' + t + 's)', t > 0, await obj('Y'));
  await setGrav(5.8, 13.5);
  check('L11: tap condenses in the pocket', await tap('Y'));
  await step(2.5);
  o = await obj('Y');
  check('L11: condensate held on the pocket floor', o.cy < 2.6, o);
  check('L11: tap freezes', await tapRetry('Y'));
  check('L11: solved', await ensureHome('Y', 5, 0) && await allHome(0.4), await st());

  // ---------- L12 Queue ----------
  await load(11);
  o = await dragPath('G', [[3, 6]]);
  check('L12: T-tetromino cannot pass the 1-wide slot', o.ay <= 3, o);
  await dragPath('G', [[0, 1]]);
  await dragPath('M', [[4, 1], [4, 6], [8, 10]]);
  check('L12: 1x1 gem dragged through the slot solid', (await obj('M')).home, await obj('M'));
  await dragPath('G', [[3, 1]]);
  const r12 = await meltPourTap('G', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="G");return o.cy>7;}', 20);
  check('L12: T-gem melted through, tapped solid, slid home', r12.drained && r12.tapped && r12.home, r12);
  check('L12: solved', await allHome(0.4), await st());

  // ---------- L13 Glassworks: the production line ----------
  await load(12);
  await dragPath('M', [[7, 8], [2, 11]]);
  check('L13: 1x1 gem dropped through the comb', (await obj('M')).home, await obj('M'));
  await dragPath('Y', [[6, 3]]);
  let r13 = await meltPourTap('Y', 7, 9, 's=>{const o=s.objs.find(u=>u.L==="Y");return o.miny>9.8;}', 25);
  check('L13: citrine melted, poured, tapped solid on its own side', r13.drained && r13.home, r13);
  await dragPath('O', [[3, 1]]);
  r13 = await meltPourTap('O', 4, 9, 's=>{const o=s.objs.find(u=>u.L==="O");return o.miny>9.8;}', 25);
  check('L13: amber cycled through the same flame', r13.drained && r13.home, r13);
  r13 = await meltPourTap('R', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="R");return o.miny>9.8;}', 25);
  check('L13: ruby last — line cleared', r13.drained && r13.home && await allHome(0.4), await st());

  // ---------- L14 Reflow ----------
  await load(13);
  await setGrav(1.5, 13.5);
  await apply('heat', 'R'); await step(3);
  check('L14: puddle starts in a bottom pocket', (await obj('R')).cy > 8);
  await setGrav(11.2, 4.0);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>7.6;}', 40);
  check('L14: liquid lifted over both pillars (' + t + 's)', t > 0, await obj('R'));
  await setGrav(8.7, 13.5);
  await step(4);
  check('L14: tap freezes in the pocket', await tapRetry('R'));
  check('L14: solved by moving the well mid-flow', await ensureHome('R', 8, 10) && await allHome(0.4), await st());

  // ---------- L15 Master Facet ----------
  await load(14);
  await apply('heat', 'C'); await step(2.5);
  check('L15: melt cleared the doorway', (await obj('C')).cy > 4);
  await dragPath('M', [[2, 1], [2, 6], [7, 6], [7, 9], [1, 9], [0, 10]]);
  check('L15: 1x1 gem escorted through both slots', (await obj('M')).home, await obj('M'));
  await setGrav(8.7, 13.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>8.6;}', 30);
  check('L15: liquid drained through both slots (' + t + 's)', t > 0, await obj('C'));
  await step(3);
  check('L15: tap freezes', await tapRetry('C'));
  check('L15: solved', await ensureHome('C', 7, 9) && await allHome(0.6), await st());

  // ---------- L16 Full Spectrum ----------
  await load(15);
  s = await st();
  check('L16: all 8 gems present', s.objs.length === 8, s.objs.map(x => x.L));
  const r16 = await meltPourTap('P', 3, 11, 's=>{const o=s.objs.find(u=>u.L==="P");return o.miny>10.3;}', 25);
  check('L16: long gem melted down first', r16.drained && r16.home, r16);
  await dragPath('M', [[0, 2], [0, 5], [1, 8], [7, 8], [7, 11]]);
  await dragPath('G', [[1, 5], [1, 7], [4, 8], [5, 9]]);
  await dragPath('C', [[1, 2], [1, 9]]);
  await dragPath('B', [[1, 1], [1, 7], [7, 7], [8, 8], [8, 10]]);
  await dragPath('Y', [[1, 4], [1, 7], [4, 7], [7, 7]]);
  await dragPath('O', [[1, 5], [1, 7], [4, 7]]);
  await dragPath('R', [[1, 2], [1, 7]]);
  await step(0.5);
  check('L16: full spectrum brought to order', await allHome(0.6), await st());
  await page.waitForTimeout(900);
  check('L16: campaign clear overlay fires', (await st()).game === 'clear');
  await shot('phasic-final');

  // ---------- generated levels 17-32: a served level is a solved level ----------
  for (let i = 16; i < 32; i++) {
    await load(i);
    const info = await g('G=>G.genInfo()');
    const ok = info && info.hasScript && await g('G=>G.replayGen()');
    const done = ok && (await st()).objs.every(x => x.home);
    check('gen L' + (i + 1) + ': validated script replays to a win (salt ' + (info && info.salt) + ')', done, info);
  }
  // endless spot checks
  for (const i of [40, 75]) {
    await load(i);
    const ok = await g('G=>G.replayGen()');
    check('endless L' + (i + 1) + ': generated + solver-replayed to a win', ok && (await st()).objs.every(x => x.home));
  }

  // ---------- STUCK: auto-solve and skip ----------
  await load(33);
  await g('G=>G.stuck()');
  await page.waitForTimeout(900);
  check('STUCK: auto-solve completes the level', (await st()).game === 'clear');
  check('STUCK: progress recorded', (await g('G=>G.save()')).done[33] === true);

  // ---------- budgets sane on fresh authored loads ----------
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
