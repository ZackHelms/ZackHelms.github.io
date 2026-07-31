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
//   * CURRICULUM: 8 blocks of 8 — drag, flames, grav+gas, liquid base,
//     gas base, black hole, bush, fan — tutorials authored, rest generated;
//     the complexity score (gems + 2*flames + 2*frosts + 2*grav +
//     2*obstacles + basePts) ramps within and across blocks.
//   * BASE STATES: born-liquid gems need a latched frost to sit home
//     (removing it melts them again); born-gas gems need two.
//   * OBSTACLES: the void consumes gems (fail + retry); bushes stop stone
//     and drink liquid but pass vapor; fans blow vapor and nothing else.
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
const WIKI = path.join(repoRoot, 'games', 'phasic', 'wiki.html');
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
  check('24 authored levels across the curriculum', await g('G=>G.authored') === 24);
  for (const i of [0,1,2,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,24,32,40,48,56,57]) await load(i);
  check('all authored maps parse with matching footprints', errors.length === 0, errors);

  // ---------- WIKI: settings overlay button to wiki.html ----------
  const wikiHref = await page.evaluate('(function(){var el=document.getElementById("wiki-btn");return el?el.getAttribute("href"):null;})()');
  check('settings overlay has a WIKI link to wiki.html', wikiHref === 'wiki.html', wikiHref);

  // ---------- menu format: one line, Title Case, 32+ rows ----------
  await load(0);
  const opts = await page.evaluate('[...document.querySelectorAll("#lvlsel option")].map(o=>o.textContent)');
  check('level list has 64+ one-line entries', opts.length >= 64 && opts.every(t => !t.includes('\n')), opts.length);
  check('level entries read "N · Title Case"', opts.every(t => /^\d+ · \S/.test(t)) && opts.every(t => /[a-z]/.test(t)), opts.slice(0, 3));

  // ---------- L1 The First Gem: one gem, one socket ----------
  let s = await st();
  check('L1: exactly one gem, no tools', s.objs.length === 1 && s.heatN === 0 && s.coldN === 0);
  await dragPath('R', [[4, 9]]);
  await step(0.3);
  check('L1: home by a single drag', (await st()).objs.every(o => o.home));
  await page.waitForTimeout(900);
  check('L1: level clear fires', (await st()).game === 'clear');
  check('clear screen shows the complexity score', await page.evaluate('document.getElementById("clearcx").textContent') === 'COMPLEXITY ' + (await g('G=>G.complexity()')).score);

  // ---------- L2 First Facets ----------
  await load(1);
  await dragPath('R', [[3, 9]]);
  await dragPath('M', [[8, 10]]);
  check('L2: two gems tidied', await allHome(0.4), await st());

  // ---------- L3 Shape Gates ----------
  await load(2);
  await dragPath('B', [[2, 1], [2, 6], [1, 9]]);
  await dragPath('R', [[7, 1], [7, 9]]);
  check('L9: L-tromino + square dragged through their gates', await allHome(0.5), await st());

  // ---------- L8 The Whole Spectrum: all eight, no tools ----------
  await load(7);
  check('L8: 8 gems, zero tools', (await st()).objs.length === 8 && (await st()).heatN === 0);
  // unpack order (hand-verified against every socket marking): G clears the
  // left approach, P dives the left edge and slides under G's future home,
  // M follows the same edge to its corner, then C, B, Y, O, ruby last.
  await dragPath('G', [[1, 5], [1, 7], [4, 8], [5, 9]]);
  await dragPath('P', [[0, 2], [0, 10], [0, 11], [3, 11]]);
  await dragPath('M', [[0, 2], [0, 5], [0, 10], [0, 11]]);
  await dragPath('C', [[1, 2], [1, 9]]);
  await dragPath('B', [[1, 1], [1, 7], [7, 7], [8, 8], [8, 10]]);
  await dragPath('Y', [[1, 4], [1, 7], [4, 7], [7, 7]]);
  await dragPath('O', [[1, 5], [1, 7], [4, 7]]);
  await dragPath('R', [[1, 2], [1, 7]]);
  check('L8: the crowded drawer unpacked entirely by hand', await allHome(0.6), await st());

  // ---------- L9 Meltdown: melt, pour, tap-to-revert (no frost bucket below L25) ----------
  await load(8);
  let o = await dragPath('R', [[4, 6]]);
  check('L9: 2x2 solid cannot pass the 1-wide slot', o.ay <= 3, o);
  check('L9: heat melts', await apply('heat', 'R') && (await obj('R')).phase === 'liquid');
  await step(4);
  check('L9: liquid drained through the slot', (await obj('R')).cy > 6);
  await step(1.5);
  await shot('phasic-liquid');
  check('L9: tap freezes it solid', await tapRetry('R'));
  check('L9: home after nudge', await ensureHome('R', 4, 9));
  await page.waitForTimeout(900);
  check('L9: clear fires', (await st()).game === 'clear');

  // ---------- mechanic rules: quench both ways (frost debuts at L25, so these
  // borrow a bucket unit via the TEST-only grant() verb to exercise the rule) ----------
  await load(8); // Meltdown again — heat:1, cold:0 after the frost strip
  await g('G=>G.grant(0,1)'); // hand it a frost to throw, as if a bucket existed
  check('quench: heat melts the gem', await apply('heat', 'R') && (await obj('R')).phase === 'liquid');
  await step(4);
  check('quench: liquid drained to open floor', (await obj('R')).cy > 6);
  s = await st();
  check('quench: frost thrown at the hot gem is not consumed', !(await apply('cold', 'R')) && (await st()).coldN === s.coldN);
  await step(1.2);
  o = await obj('R'); s = await st();
  check('quench: the quench took the flame home AND cooled it solid', s.heatN === 1 && o.phase === 'solid' && o.heats === 0, o);

  await load(24); // Standing Water — born liquid, cold:1, the symmetric case
  await step(3);
  check('quench: frost freezes the born-liquid gem', await apply('cold', 'R'));
  await step(1.2);
  o = await obj('R');
  check('quench: solid with a latched frost', o.phase === 'solid' && o.frosts === 1, o);
  await g('G=>G.grant(1,0)'); // hand it a flame to throw, as if a bucket existed
  s = await st();
  check('quench: heat thrown at the frosted gem is not consumed as a flame', !(await apply('heat', 'R')) && (await st()).heatN === s.heatN);
  await step(1.2);
  o = await obj('R'); s = await st();
  check('quench: fire freed the frost instead — the gem warms back to liquid', o.phase === 'liquid' && o.frosts === 0 && s.coldN === 1, o);

  // ---------- L10 Room to Pour: tap refused without room, flame stays ----------
  await load(9);
  await apply('heat', 'R'); await step(1.6);
  o = await obj('R');
  check('L20: liquid resting on the shelf', o.cy > 4 && o.cy < 6.2, o);
  check('L20: tap on the shelf is refused — no room to crystallize', !(await tap('R')));
  o = await obj('R'); s = await st();
  check('L20: the flame stays latched after the refusal', o.heats === 1 && o.phase === 'liquid' && s.heatN === 0, o);
  await step(5);
  check('L20: liquid drained to the floor room', (await obj('R')).cy > 7);
  check('L20: tap now freezes', await tapRetry('R'));
  await step(1.0);
  check('L20: solved', await ensureHome('R', 4, 9) && await allHome(0.4), await st());

  // ---------- L11 Gem Drawer ----------
  await load(10);
  await dragPath('R', [[1, 5], [1, 9]]);
  await dragPath('B', [[2, 3], [2, 7], [6, 9]]);
  await dragPath('M', [[2, 1], [2, 8], [4, 10]]);
  s = await st();
  check('L11: three gems tidied by drag alone (gem drawer)', s.objs.filter(x => x.home).length === 3, s.objs);
  const r5 = await meltPourTap('P', 2, 11, 's=>{const o=s.objs.find(u=>u.L==="P");return o.miny>10.3;}', 25);
  check('L11: long gem melted through the comb and tapped solid', r5.drained && r5.tapped, r5);
  check('L11: drawer fully tidied', r5.home && await allHome(0.4), await st());

  // ---------- L12 One Flame: reuse + live sockets ----------
  await load(11);
  await apply('heat', 'B'); await step(3.5);
  check('L12: the one flame is busy', (await st()).heatN === 0);
  check('L12: tap freezes and frees the flame', await tapRetry('B') && (await st()).heatN === 1);
  check('L12: first gem home', await ensureHome('B', 1, 9));
  // live sockets: a home gem can still be melted and re-frozen
  check('L12: a home gem can be melted again', await apply('heat', 'B') && (await obj('B')).phase === 'liquid');
  check('L12: it is no longer home while molten', !(await obj('B')).home);
  await step(2.5);
  check('L12: tap re-freezes it', await tapRetry('B'));
  check('L12: back home', await ensureHome('B', 1, 9));
  await apply('heat', 'R'); await step(3.5);
  check('L12: tap freezes the second gem', await tapRetry('R'));
  check('L13: solved with a single flame', await ensureHome('R', 7, 9) && await allHome(0.4), await st());

  // ---------- L17 Sideways: the well leaves its bucket; win with well deployed ----------
  await load(16);
  let gv = await g('G=>G.gravAt()');
  check('L17: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
  await apply('heat', 'R'); await step(2.5);
  o = await obj('R');
  check('L17: docked well means the melt fell straight down', o.cy > 9 && o.cx > 5.2, o);
  await setGrav(-1.2, 5.5);
  gv = await g('G=>G.gravAt()');
  check('L17: placing the well undocks it', gv && gv.docked === false, gv);
  let t = await stepUntil('s=>{const o=s.objs[0];return o.cx<1.8&&o.cy>4&&o.cy<7.6;}', 30);
  check('L17: liquid pooled against the left wall at the well (' + t + 's)', t > 0, await obj('R'));
  check('L17: tap freezes it there', await tapRetry('R'));
  check('L17: home', await ensureHome('R', 0, 5));
  await page.waitForTimeout(900);
  gv = await g('G=>G.gravAt()');
  check('L17: level cleared WITH the well still deployed on the ring', (await st()).game === 'clear' && gv && gv.docked === false, gv);

  // ---------- L18 Point Pull ----------
  await load(17);
  await apply('heat', 'O');
  await setGrav(1.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>8.6&&o.cx<3.6;}', 30);
  check('L18: point placement chose the LEFT branch (' + t + 's)', t > 0, await obj('O'));
  check('L8: tap freezes', await tapRetry('O'));
  check('L18: solved', await ensureHome('O', 1, 9) && await allHome(0.4), await st());

  // ---------- L19 Spring Cleaning ----------
  await load(18);
  gv = await g('G=>G.gravAt()');
  check('L19: well starts docked', gv && gv.docked === true, gv);
  await dragPath('G', [[1, 4], [0, 0]]);
  await dragPath('Y', [[3, 4], [5, 0]]);
  await dragPath('M', [[3, 7], [4, 4]]);
  s = await st();
  check('L19: pile mostly tidied by drag', s.objs.filter(x => x.home).length === 3, s.objs);
  await apply('heat', 'B'); await step(3);
  o = await obj('B');
  check('L19: melt fell straight down under docked gravity', o.cy > 9.5 && o.cx < 5, o);
  await setGrav(10.5, 6);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cx>6.8&&o.cy<7.8;}', 40);
  check('L19: well lifted the liquid over the divider (' + t + 's)', t > 0, await obj('B'));
  await setGrav(8, 13.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="B");return o.cy>8.8;}', 30);
  check('L19: liquid funneled into the chamber (' + t + 's)', t > 0, await obj('B'));
  await step(1.5);
  check('L19: tap freezes in the chamber', await tapRetry('B'));
  check('L19: solved', await ensureHome('B', 7, 9) && await allHome(0.4), await st());

  // ---------- L20 The Kettle: steam to rain to stone, frost never needed ----------
  await load(19);
  await apply('heat', 'P'); await step(2);
  await apply('heat', 'P');
  check('L20: second flame boils to gas', (await obj('P')).phase === 'gas');
  await setGrav(9.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<2.6&&o.maxx<6.6;}', 90);
  check('L20: steam herded across the attic (' + t + 's)', t > 0, await obj('P'));
  await shot('phasic-gas');
  await setGrav(2.5, 13.5);
  check('L20: first tap condenses steam to rain', await tap('P') && (await obj('P')).phase === 'liquid');
  await step(3);
  o = await obj('P');
  check('L20: rain landed in the basin, not back down the flue', o.cy < 3.4, o);
  check('L20: second tap freezes it to stone', await tapRetry('P'));
  await step(1.0);
  check('L20: solved — no frost bucket exists below L25', (await st()).coldN === 0 && await ensureHome('P', 1, 2) && await allHome(0.4), await st());

  // ---------- L21 Balloon Route ----------
  await load(20);
  await setGrav(0.5, 13.5);
  await apply('heat', 'Y'); await step(1.5); await apply('heat', 'Y');
  t = await stepUntil('s=>{const o=s.objs[0];return o.maxy<1.95&&o.minx>4.3;}', 90);
  check('L21: gas herded fully into the ceiling pocket (' + t + 's)', t > 0, await obj('Y'));
  await setGrav(5.8, 13.5);
  check('L21: tap condenses in the pocket', await tap('Y'));
  await step(2.5);
  o = await obj('Y');
  check('L21: condensate held on the pocket floor', o.cy < 2.6, o);
  check('L21: tap freezes', await tapRetry('Y'));
  check('L21: solved', await ensureHome('Y', 5, 0) && await allHome(0.4), await st());

  // ---------- L13 Queue ----------
  await load(12);
  o = await dragPath('G', [[3, 6]]);
  check('L13: T-tetromino cannot pass the 1-wide slot', o.ay <= 3, o);
  await dragPath('G', [[0, 1]]);
  await dragPath('M', [[4, 1], [4, 6], [8, 10]]);
  check('L13: 1x1 gem dragged through the slot solid', (await obj('M')).home, await obj('M'));
  await dragPath('G', [[3, 1]]);
  const r12 = await meltPourTap('G', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="G");return o.cy>7;}', 20);
  check('L13: T-gem melted through, tapped solid, slid home', r12.drained && r12.tapped && r12.home, r12);
  check('L13: solved', await allHome(0.4), await st());

  // ---------- shove guard: a dragged solid displaces a resting puddle (tactic #10) ----------
  await load(12); // Queue, fresh: G tetromino + M 1x1, heat:1, no cold
  await apply('heat', 'G'); // melt the T-tetromino
  await step(2.5); // let the puddle settle above the shelf/slot (matches the L13 geometry above)
  let shoveParts = await g('G=>G.parts("G")');
  const shoveX0 = shoveParts.reduce((a, p) => a + p.x, 0) / shoveParts.length;
  await dragPath('M', [[8, 3], [2, 3]]); // stage beside the shelf, then drag the stone straight through the puddle
  await step(1.0);
  shoveParts = await g('G=>G.parts("G")');
  const shoveX1 = shoveParts.reduce((a, p) => a + p.x, 0) / shoveParts.length;
  check('shove guard: dragging M into the resting puddle displaces it >=0.8 cells in the push direction (' +
    (shoveX0 - shoveX1).toFixed(2) + ')', shoveX0 - shoveX1 >= 0.8, { shoveX0, shoveX1 });

  // ---------- L14 Glassworks: the production line ----------
  await load(13);
  await dragPath('M', [[7, 8], [2, 11]]);
  check('L14: 1x1 gem dropped through the comb', (await obj('M')).home, await obj('M'));
  await dragPath('Y', [[6, 3]]);
  let r13 = await meltPourTap('Y', 7, 9, 's=>{const o=s.objs.find(u=>u.L==="Y");return o.miny>9.8;}', 25);
  check('L14: citrine melted, poured, tapped solid on its own side', r13.drained && r13.home, r13);
  await dragPath('O', [[3, 1]]);
  r13 = await meltPourTap('O', 4, 9, 's=>{const o=s.objs.find(u=>u.L==="O");return o.miny>9.8;}', 25);
  check('L14: amber cycled through the same flame', r13.drained && r13.home, r13);
  r13 = await meltPourTap('R', 1, 9, 's=>{const o=s.objs.find(u=>u.L==="R");return o.miny>9.8;}', 25);
  check('L14: ruby last — line cleared', r13.drained && r13.home && await allHome(0.4), await st());

  // ---------- L22 Reflow ----------
  await load(21);
  await setGrav(1.5, 13.5);
  await apply('heat', 'R'); await step(3);
  check('L22: puddle starts in a bottom pocket', (await obj('R')).cy > 8);
  await setGrav(11.2, 4.0);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>7.6;}', 40);
  check('L22: liquid lifted over both pillars (' + t + 's)', t > 0, await obj('R'));
  await setGrav(8.7, 13.5);
  await step(4);
  check('L22: tap freezes in the pocket', await tapRetry('R'));
  check('L22: solved by moving the well mid-flow', await ensureHome('R', 8, 10) && await allHome(0.4), await st());

  // ---------- L23 Master Facet ----------
  await load(22);
  await apply('heat', 'C'); await step(2.5);
  check('L23: melt cleared the doorway', (await obj('C')).cy > 4);
  await dragPath('M', [[2, 1], [2, 6], [7, 6], [7, 9], [1, 9], [0, 10]]);
  check('L23: 1x1 gem escorted through both slots', (await obj('M')).home, await obj('M'));
  await setGrav(8.7, 13.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>8.6;}', 30);
  check('L23: liquid drained through both slots (' + t + 's)', t > 0, await obj('C'));
  await step(3);
  check('L23: tap freezes', await tapRetry('C'));
  check('L23: solved', await ensureHome('C', 7, 9) && await allHome(0.6), await st());

  // ---------- L16 Full Spectrum (flame finale of the flames block) ----------
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

  // ---------- L25 Standing Water: liquid base state, frost holds it ----------
  await load(24);
  o = await obj('R');
  check('L25: gem is born liquid', o.phase === 'liquid' && o.heats === 0, o);
  await step(3);
  check('L25: frost freezes the born-liquid gem', await apply('cold', 'R'));
  await step(1.2);
  o = await obj('R');
  check('L25: solid with a latched frost', o.phase === 'solid' && o.frosts === 1, o);
  check('L25: taking the frost back MELTS it again', await tap('R') && (await obj('R')).phase === 'liquid' && (await st()).coldN === 1);
  await step(2.5);
  check('L25: frost again', await apply('cold', 'R'));
  await step(1.2);
  check('L25: home with the frost still latched', await ensureHome('R', 4, 9));
  await page.waitForTimeout(900);
  check('L25: level clears with a latched frost (win rule)', (await st()).game === 'clear' && (await st()).coldN === 0);

  // ---------- L33 Loose Vapor: gas base state, two frosts ----------
  await load(32);
  o = await obj('Y');
  check('L33: gem is born gas', o.phase === 'gas', o);
  await step(2);
  check('L33: first frost condenses', await apply('cold', 'Y') && (await obj('Y')).phase === 'liquid');
  await step(3);
  let froze33 = false;
  for (let a33 = 0; a33 < 5; a33++) { if (await apply('cold', 'Y')) { froze33 = true; break; } await step(2); }
  check('L33: second frost freezes', froze33);
  await step(1.4);
  o = await obj('Y');
  check('L33: solid with two latched frosts', o.phase === 'solid' && o.frosts === 2, o);
  check('L33: solved', await ensureHome('Y', 3, 9) && await allHome(0.4), await st());

  // ---------- L41 The Void: consumption, fail, retry ----------
  await load(40);
  await dragPath('R', [[3, 5], [3, 6]]); // feed it to the void
  await step(1.5);
  o = await obj('R');
  check('L41: the void consumed the gem', o.dead === true, o);
  check('L41: fail state raised', (await st()).game === 'fail');
  await load(40); // retry
  check('L41: retry restores the gem', !(await obj('R')).dead && (await st()).game === 'play');
  await dragPath('R', [[7, 1], [7, 10]]); // safe route around the void
  check('L41: solved by going around', await allHome(0.4), await st());

  // ---------- L49 Overgrowth: bush stops stone, drinks liquid, passes vapor ----------
  await load(48);
  o = await dragPath('Y', [[6, 8]]);
  check('L49: bush blocks the solid gem', o.ax <= 3, o);
  await apply('heat', 'Y'); await step(1.2); await apply('heat', 'Y');
  check('L49: boiled to vapor', (await obj('Y')).phase === 'gas');
  await setGrav(0.5, 13.5); // bottom-left: vapor flees up and to the RIGHT
  t = await stepUntil('s=>{const o=s.objs[0];return o.minx>5.6;}', 60);
  check('L49: vapor slipped through the hedge (' + t + 's)', t > 0, await obj('Y'));
  await setGrav(7.5, 13.5);
  check('L49: tap condenses on the far side', await tap('Y'));
  await step(3);
  check('L49: tap freezes', await tapRetry('Y'));
  check('L49: solved', await ensureHome('Y', 6, 10) && await allHome(0.4), await st());

  // ---------- L57 Crosswind: fans blow vapor and nothing else ----------
  await load(56);
  await apply('heat', 'Y'); await step(1.2); await apply('heat', 'Y');
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>6.2&&o.cy<3;}', 60);
  check('L57: the fan blew the vapor into the alcove (' + t + 's)', t > 0, await obj('Y'));
  check('L57: tap condenses in the alcove', await tap('Y'));
  await step(3);
  check('L57: tap freezes', await tapRetry('Y'));
  check('L57: solved with no gravity well at all', await ensureHome('Y', 6, 2) && await allHome(0.4), await st());

  // ---------- L58 The Stopper: the plug-the-slot tactic ----------
  await load(57);
  await apply('heat', 'R'); // no plug, plain gravity: the pour drains into the void
  t = await stepUntil('s=>s.objs.some(o=>o.dead)', 20);
  check('L58: unplugged pour drains into the void (' + t + 's)', t > 0);
  await step(1.5);
  check('L58: fail raised', (await st()).game === 'fail');
  await load(57); // retry, now use the tactic
  await dragPath('M', [[2, 3], [2, 5]]); // plug the slot with the stone
  check('L58: stone parked IN the slot', (await obj('M')).ax === 2 && (await obj('M')).ay === 5, await obj('M'));
  await setGrav(8.7, 13.5);
  await apply('heat', 'R');
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="R");return o.miny>9.6;}', 30);
  check('L58: the pour crossed the plugged slot and drained safely (' + t + 's)', t > 0, await obj('R'));
  await step(1.5);
  check('L58: tap freezes', await tapRetry('R'));
  check('L58: ruby home', await ensureHome('R', 7, 10));
  await dragPath('M', [[2, 3], [7, 3], [7, 8], [1, 8], [0, 10], [0, 11]]); // unplug, around the void
  check('L58: tactic complete — stone unplugged and put away', await allHome(0.5), await st());

  // ---------- generated curriculum: every served level is a solved level ----------
  const GEN_IDX = [3,4,5,6, 14, 23, 25,26,27,28,29,30,31, 33,34,35,36,37,38,39,
    41,42,43,44,45,46,47, 49,50,51,52,53,54,55, 58,59,60,61,62,63];
  const scores = {};
  for (const i of GEN_IDX) {
    await load(i);
    const info = await g('G=>G.genInfo()');
    const cx = await g('G=>G.complexity()');
    const ok = info && info.hasScript && await g('G=>G.replayGen()');
    const done = ok && (await st()).objs.every(x => x.home);
    (scores[(i / 8) | 0] = scores[(i / 8) | 0] || []).push(cx ? cx.score : -1);
    check('gen L' + (i + 1) + ': solver script replays to a win (salt ' + (info && info.salt) + ', cx ' + (cx && cx.score) + ')', done, info);
  }
  for (const i of [70, 100]) {
    await load(i);
    const ok = await g('G=>G.replayGen()');
    check('endless L' + (i + 1) + ': generated + solver-replayed to a win', ok && (await st()).objs.every(x => x.home));
  }

  // ---------- phasweave: template coverage across the generated indices below 65 ----------
  // GEN_IDX above is the scan set; genInfo().template + genInfo().weave are recorded per
  // index as we pass over it so the block-scoped weave gates below don't re-scan.
  const seenTemplates = new Set();
  const weaveByIdx = {};
  for (const i of GEN_IDX) {
    await load(i);
    const info = await g('G=>G.genInfo()');
    if (info) seenTemplates.add(info.template);
    if (info && info.weave) weaveByIdx[i] = info.weave;
  }
  check('template coverage: two-shelf appears among generated levels below 65',
    seenTemplates.has('two-shelf'), [...seenTemplates]);
  check('template coverage: attic appears among generated levels below 65',
    seenTemplates.has('attic'), [...seenTemplates]);

  // ---------- phasweave: in-path weave gates, one per obstacle block ----------
  // Curriculum block index ranges (0-based load() index; block N spans i in [8N, 8N+7]).
  // Block 5 = L41-48 (i 40-47), block 6 = L49-56 (i 48-55), block 7 = L57-64 (i 56-63);
  // the authored tutorial at the head of each (L41/L49/L57/L58) is not in GEN_IDX.
  const block5 = GEN_IDX.filter(i => i >= 40 && i <= 47);
  const block6 = GEN_IDX.filter(i => i >= 48 && i <= 55);
  const block7 = GEN_IDX.filter(i => i >= 56 && i <= 63);

  // block 5: hole-under-gap + plug — the hole sits at (sx, shelfR+1), directly
  // beneath a real gap column of the shelf it crosses (not a defensive corner).
  let plugIdx = null, plugFound = null;
  for (const i of block5) {
    const wv = weaveByIdx[i];
    if (!wv || wv.k !== 'plug') continue;
    await load(i);
    const mi = await g('G=>G.mapInfo()');
    const hy = wv.shelfR + 1;
    const holeHere = mi.holes.some(h => h.x === wv.sx && h.y === hy);
    const shelf = mi.shelves.find(sh => sh.y === wv.shelfR);
    const underGap = !!shelf && shelf.gaps.some(gp => wv.sx >= gp.x && wv.sx < gp.x + gp.w);
    if (holeHere && underGap) { plugIdx = i; plugFound = { wv, holeHere, underGap, shelf }; break; }
  }
  check('block 5 (L41-48): a plug weave hides the hole under a shelf gap column (found L' +
    (plugIdx === null ? '-' : plugIdx + 1) + ')', plugIdx !== null, { candidates: block5, found: plugFound });

  // block 6: mid-field bush column — a hedge in columns 1-8 (the travel band),
  // not the old defensive side column (0 or 9).
  let bushIdx = null, bushFound = null;
  for (const i of block6) {
    const wv = weaveByIdx[i];
    if (!wv || wv.k !== 'bush') continue;
    await load(i);
    const mi = await g('G=>G.mapInfo()');
    const midField = wv.bx >= 1 && wv.bx <= 8;
    const painted = mi.bushes.some(bs => bs.x === wv.bx);
    if (midField && painted) { bushIdx = i; bushFound = { wv, painted }; break; }
  }
  check('block 6 (L49-56): a bush weave stands mid-field (col 1-8), not the old side column (found L' +
    (bushIdx === null ? '-' : bushIdx + 1) + ')', bushIdx !== null, { candidates: block6, found: bushFound });

  // block 7: fan lane — the beam crosses the staging band (rows 0-2) across
  // enough columns that the cloud has to actually ride it, not just skim past.
  let fanIdx = null, fanFound = null;
  for (const i of block7) {
    const wv = weaveByIdx[i];
    if (!wv || wv.k !== 'fan') continue;
    await load(i);
    const mi = await g('G=>G.mapInfo()');
    const cols = new Set(mi.beam.filter(bm => bm.y >= 0 && bm.y <= 2).map(bm => bm.x));
    if (cols.size >= 3) { fanIdx = i; fanFound = { wv, cols: [...cols] }; break; }
  }
  check('block 7 (L57-64): a fan weave beam crosses the staging band (rows 0-2) across >=3 columns (found L' +
    (fanIdx === null ? '-' : fanIdx + 1) + ')', fanIdx !== null, { candidates: block7, found: fanFound });

  // ---------- phasweave: woven replays — the found index per pattern still beats its own hazard ----------
  for (const [label, idx] of [['plug', plugIdx], ['bush', bushIdx], ['fan', fanIdx]]) {
    if (idx === null) continue;
    await load(idx);
    const ok = await g('G=>G.replayGen()');
    const home = ok && (await st()).objs.every(x => x.home);
    check('woven replay (' + label + ', L' + (idx + 1) + '): solver script beats the in-path hazard', home);
  }

  // ---------- phasweave: deeper endless spot checks ----------
  for (const i of [85, 110]) {
    await load(i);
    const ok = await g('G=>G.replayGen()');
    check('endless L' + (i + 1) + ': generated + solver-replayed to a win', ok && (await st()).objs.every(x => x.home));
  }

  // ---------- complexity ramps ----------
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  for (const b of Object.keys(scores)) {
    const a = scores[b];
    if (a.length >= 2) check('complexity block ' + b + ': last generated >= first (' + a.join(',') + ')', a[a.length - 1] >= a[0] - 1);
  }
  check('complexity envelope: later blocks harder than block 0 (' +
    avg(scores[0]).toFixed(1) + ' -> ' + avg(scores[7]).toFixed(1) + ')',
    avg(scores[7]) > avg(scores[0]));

  // ---------- STUCK: the stored solver script plays as a visible ghost ----------
  async function stuckPlay(maxS) { // drive the ghost on sim time; -1 = never cleared
    const cap = maxS || 60;
    let t = 0;
    for (; t < cap; t++) {
      const cur = await st();
      if (cur.game === 'clear') break;
      if (cur.objs.every(o => o.home)) break; // solved — the 650 ms clear timer is wall-clock
      await step(1);
    }
    await page.waitForTimeout(900);
    return (await st()).game === 'clear' ? t : -1;
  }
  await load(65);
  await g('G=>G.stuck()');
  await step(0.1);
  check('STUCK: no instant teleport — the ghost is still playing', (await st()).game === 'play', await st());
  const ghostT = await stuckPlay(60);
  check('STUCK: the ghost replays the solver script to a win (' + ghostT + 's sim)', ghostT > 0, await st());
  check('STUCK: progress recorded', (await g('G=>G.save()')).done[65] === true);

  // ---------- STUCK fallback: authored level, no stored script ----------
  await load(1);
  check('STUCK fallback: an authored level has no solver script', (await g('G=>G.genInfo()')) === null);
  await g('G=>G.stuck()');
  await step(0.1);
  check('STUCK fallback: no instant teleport — the gems fly home in sequence', (await st()).game === 'play', await st());
  const fallT = await stuckPlay(60);
  check('STUCK fallback: staggered fly-home clears the level (' + fallT + 's sim)', fallT > 0, await st());
  check('STUCK fallback: progress recorded', (await g('G=>G.save()')).done[1] === true);

  // ---------- budgets sane on fresh authored loads ----------
  for (const i of [0,1,2,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,24,32,40,48,56,57]) {
    await load(i);
    s = await st();
    check('budget L' + (i + 1) + ' fresh-load sane', s.heatN >= 0 && s.coldN >= 0);
  }

  // ---------- frost strip: no cold bucket exists below L25 ----------
  for (const i of [0,1,2,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22]) {
    await load(i);
    check('L' + (i + 1) + ' fresh-load: no frost bucket below L25', (await st()).coldN === 0);
  }
  await load(24);
  check('L25 fresh-load: frost bucket debuts at 1 (Standing Water)', (await st()).coldN === 1);
  await load(32);
  check('L33 fresh-load: frost bucket at 2 (Loose Vapor)', (await st()).coldN === 2);

  // ---------- wiki: home, tactics page, live search (second page, same context) ----------
  const wpage = await ctx.newPage();
  wpage.on('pageerror', e => errors.push('pageerror(wiki): ' + e.message));
  wpage.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console(wiki): ' + m.text()); });
  await wpage.goto('file://' + WIKI, { waitUntil: 'load', timeout: 20000 });
  await wpage.waitForTimeout(300);
  const wp = (expr) => wpage.evaluate(expr);

  const pagesLen = await wp('window.PAGES.length');
  check('wiki: PAGES has 7+ entries', pagesLen >= 7, pagesLen);
  const homeCards = await wp('document.querySelectorAll("#content .pcard").length');
  check('wiki: home renders exactly PAGES.length-1 link cards', homeCards === pagesLen - 1, { pagesLen, homeCards });

  await wp('location.hash = "#tactics"');
  await wpage.waitForTimeout(150);
  const tacticCount = await wp('document.querySelectorAll("#content .tactic-item").length');
  check('wiki: #tactics renders exactly 12 numbered entries', tacticCount === 12, tacticCount);

  await wp('(function(){var el=document.getElementById("wiki-search");el.value="stopper";el.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await wpage.waitForTimeout(150);
  const searchResults = await wp('document.querySelectorAll("#content .pcard").length');
  check('wiki: search "stopper" surfaces 1+ result', searchResults >= 1, searchResults);
  const firstResultHref = await wp('(function(){var a=document.querySelector("#content .pcard");return a?a.getAttribute("href"):null;})()');
  check('wiki: "stopper" result links to #tactics', firstResultHref === '#tactics', firstResultHref);

  await wp('(function(){var el=document.getElementById("wiki-search");el.value="";el.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await wpage.waitForTimeout(150);
  const restoredTacticCount = await wp('document.querySelectorAll("#content .tactic-item").length');
  check('wiki: clearing search restores the current page content', restoredTacticCount === 12, restoredTacticCount);

  await wpage.close();

  // ---------- console errors ----------
  check('no console/page errors across the whole run', errors.length === 0, errors.slice(0, 6));

  await browser.close();
  console.log('PHASIC DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('PHASIC DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
