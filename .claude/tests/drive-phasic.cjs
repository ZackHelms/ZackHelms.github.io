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
const crypto = require('crypto');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) { console.error('playwright-core not resolvable (NODE_PATH).'); console.log('PHASIC DRIVE: 0 passed, 1 failed'); process.exit(1); }

const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'phasic', 'index.html');
const WIKI = path.join(repoRoot, 'games', 'phasic', 'wiki.html');
const HUB = path.join(repoRoot, 'games', 'index.html');
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
  // ---- phasfreeze helpers: settled-puddle freeze fix (commit 16c4a28) ----
  const REST_V = 0.01; // CELL*0.01 in cell units — mirrors tryFreeze's own REST_V threshold
  function maxJumpBetween(a, b) { // per-particle distance between two parts() snapshots, cell units
    let m = 0;
    for (let k = 0; k < a.length; k++) m = Math.max(m, Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y));
    return m;
  }
  async function driftNow(L) { // one sub-step's worth of per-particle motion — the same
    const before = await g('G=>G.parts("' + L + '")');           // measure tryFreeze itself
    await step(1 / 120);                                          // uses to decide RESTING
    return maxJumpBetween(before, await g('G=>G.parts("' + L + '")'));
  }
  async function ensureLiquid(L) { // liquid-base gems are already liquid; solids get melted; gas skipped
    const o2 = await obj(L);
    if (!o2 || o2.phase === 'gas') return false;
    if (o2.phase === 'solid') { await g('G=>G.grant(1,0)'); if (!(await apply('heat', L))) return false; }
    return true;
  }
  async function realFreeze(L) { // the actual play-path commit: tap frees a latched flame, else throw frost
    const o2 = await obj(L);
    if (o2.heats > 0) return tap(L);
    await g('G=>G.grant(0,1)');
    return apply('cold', L);
  }

  // ---------- boot ----------
  check('test API present', await page.evaluate('!!window.__GF'));
  check('25 authored levels across the curriculum', await g('G=>G.authored') === 25);
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

  // ---------- phasnames: block-word prefix on curriculum entries + hint bar ----------
  const BLOCK_WORD = ['Drag','Flame','Gravity','Frost','Vapor','Void','Hedge','Wind'];
  const badBlockEntries = [];
  for (let b = 0; b < 8; b++) {
    for (let idx = 8 * b; idx <= 8 * b + 7; idx++) {
      const expected = (idx + 1) + ' · ' + BLOCK_WORD[b] + ' · ';
      if (!opts[idx] || !opts[idx].startsWith(expected)) badBlockEntries.push({ idx, got: opts[idx], expected });
    }
  }
  check('phasnames: every curriculum entry (0-63) reads "N · <block word> · Name"',
    badBlockEntries.length === 0, badBlockEntries.slice(0, 3));
  const hintbar0 = await page.evaluate('document.getElementById("hintbar").textContent');
  check('phasnames: L1 hint bar starts "L1 · Drag · "', hintbar0.startsWith('L1 · Drag · '), hintbar0);

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
  check('L10: liquid resting on the shelf', o.cy > 4 && o.cy < 6.2, o);
  check('L10: tap on the shelf is refused — no room to crystallize', !(await tap('R')));
  o = await obj('R'); s = await st();
  check('L10: the flame stays latched after the refusal', o.heats === 1 && o.phase === 'liquid' && s.heatN === 0, o);
  await step(5);
  check('L10: liquid drained to the floor room', (await obj('R')).cy > 7);
  check('L10: tap now freezes', await tapRetry('R'));
  await step(1.0);
  check('L10: solved', await ensureHome('R', 4, 9) && await allHome(0.4), await st());

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

  // ---------- L17 The Side Pocket: the gravity block opens ORB-MANDATORY ----------
  // The socket lives in a walled 2x2 alcove whose only mouth is a 1-cell-tall
  // slot at (7,6): no 2x2 solid fits it, and plain down-drainage can only fall
  // past it. The single route is melt -> undock the well onto the right ring at
  // the mouth's height -> the pour climbs the plinth wall and in -> freeze.
  await load(16);
  s = await st();
  check('L17: one gem, one flame, the well — and no frost', s.objs.length === 1 && s.heatN === 1 && s.coldN === 0, s);
  let gv = await g('G=>G.gravAt()');
  check('L17: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
  o = await dragPath('R', [[8, 5]]);
  check('L17: the 2x2 solid cannot be dragged into the alcove — the mouth is 1 cell tall', o.ax < 7, o);
  await apply('heat', 'R');
  let t = await stepUntil('s=>{const o=s.objs[0];return o.miny>10;}', 25);
  o = await obj('R');
  check('L17: docked, the melt drains straight down and never enters the alcove (' + t + 's)', t > 0 && o.maxx < 7, o);
  await setGrav(11.5, 6.5);
  gv = await g('G=>G.gravAt()');
  check('L17: placing the well undocks it', gv && gv.docked === false, gv);
  t = await stepUntil('s=>{const o=s.objs[0];return o.minx>7.2&&o.maxy<7;}', 30);
  check('L17: the well pulled the pour up the wall and through the slot (' + t + 's)', t > 0, await obj('R'));
  check('L17: tap freezes it in the alcove', await tapRetry('R'));
  check('L17: solved — the socket is reachable only with the well', await ensureHome('R', 8, 5) && await allHome(0.4), await st());

  // ---------- L18 Sideways: the well leaves its bucket; win with well deployed ----------
  // Anti-shove (phasgrav task 2): the socket is a floor-level 2x2 nook behind the
  // 1-tall mouth at (2,11) — no 2x2 solid fits, so the gem cannot be walked home
  // as stone and the sideways pull is the only route.
  await load(17);
  gv = await g('G=>G.gravAt()');
  check('L18: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
  o = await dragPath('R', [[6, 10], [2, 10], [0, 10]]);
  check('L18: the 2x2 solid cannot be dragged into the floor nook — the mouth is 1 cell tall', !o.home && o.ax >= 3, o);
  await load(17);
  await apply('heat', 'R'); await step(3.5);
  o = await obj('R');
  check('L18: docked well means the melt fell straight down, clear of the nook', o.cy > 10.5 && o.cx > 5.2, o);
  await setGrav(-1.2, 11.5);
  gv = await g('G=>G.gravAt()');
  check('L18: placing the well undocks it', gv && gv.docked === false, gv);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx<1.6&&o.cy>9.4;}', 30);
  check('L18: liquid walked along the floor into the nook at the well (' + t + 's)', t > 0, await obj('R'));
  check('L18: tap freezes it there', await tapRetry('R'));
  check('L18: home', await ensureHome('R', 0, 10));
  await page.waitForTimeout(900);
  gv = await g('G=>G.gravAt()');
  check('L18: level cleared WITH the well still deployed on the ring', (await st()).game === 'clear' && gv && gv.docked === false, gv);

  // ---------- L19 Point Pull ----------
  // Anti-shove (phasgrav task 2): the left cellar is roofed with one 1-wide chute
  // at (0,8) and every row of this gem is 2 cells wide, so no drag reaches it.
  await load(18);
  o = await dragPath('O', [[1, 4], [1, 7], [1, 10], [0, 10]]);
  check('L19: the S-gem cannot be dragged into the left cellar — the chute is 1 wide', !o.home && o.ay <= 7, o);
  await load(18);
  await apply('heat', 'O');
  await setGrav(1.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>9.4&&o.cx<3.6;}', 40);
  check('L19: point placement chose the LEFT branch and dropped down the chute (' + t + 's)', t > 0, await obj('O'));
  check('L19: tap freezes', await tapRetry('O'));
  check('L19: solved', await ensureHome('O', 1, 10) && await allHome(0.4), await st());

  // ---------- L20 The Kettle: steam to rain to stone, frost never needed ----------
  // Anti-shove (phasgrav task 2): this map needed no hardening — it carries a single
  // gem (so no second solid exists to shove with) and that gem is 4 cells wide while
  // the only way up is a 2-wide flue, so no solid can ever stand in the attic.
  await load(19);
  s = await st();
  o = await dragPath('P', [[2, 5], [7, 5], [7, 1], [1, 2]]);
  check('L20: lone 4x1 gem can never reach the 2-wide flue — no solid ever enters the attic',
    s.objs.length === 1 && !o.home && o.ay >= 5, o);
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
  // Anti-shove (phasgrav task 2): the ceiling pocket's doorway is the single cell
  // (4,1) — this gem is 2 rows tall, so only the cloud can get through.
  await load(20);
  o = await dragPath('Y', [[1, 4], [1, 0], [3, 0], [5, 0]]);
  check('L21: the 2-tall gem cannot be dragged into the ceiling pocket — the doorway is 1 cell', !o.home && o.ax <= 3, o);
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
  // Anti-shove (phasgrav task 2): the far pocket is capped except for the 1-wide
  // chute at column 9 — a 2x2 solid cannot descend it, so the lift is the only way in.
  await load(21);
  o = await dragPath('R', [[1, 5], [8, 5], [8, 7], [8, 10]]);
  check('L22: the 2x2 solid cannot be dragged into the far pocket — the chute is 1 wide', !o.home && o.ay <= 7, o);
  await load(21);
  await setGrav(1.5, 13.5);
  await apply('heat', 'R'); await step(3);
  check('L22: puddle starts in a bottom pocket', (await obj('R')).cy > 8);
  await setGrav(11.2, 4.0);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cx>7.6;}', 40);
  check('L22: liquid lifted over both pillars (' + t + 's)', t > 0, await obj('R'));
  await setGrav(9.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs[0];return o.cy>9.8&&o.cx>7.6;}', 30);
  check('L22: the corner well dropped it down the chute into the pocket (' + t + 's)', t > 0, await obj('R'));
  await step(3);
  check('L22: tap freezes in the pocket', await tapRetry('R'));
  check('L22: solved by moving the well mid-flow', await ensureHome('R', 8, 10) && await allHome(0.4), await st());

  // ---------- L23 Master Facet ----------
  // Anti-shove (phasgrav task 2): both slots sit in column 2, so the pour drops
  // straight into the left cellar and never rests on a floor it could be pushed
  // along. The socket is across a 3-tall divide (columns 5-6) reachable only by
  // lifting the puddle onto the row-8 lane — the 1x1 escort shares the cellar and
  // still cannot move it across. That negative is asserted before the solution.
  await load(22);
  await apply('heat', 'C'); await step(6);
  await dragPath('M', [[2, 1], [2, 5], [2, 8], [0, 11]]);
  let shovePeak = -1;
  for (let k = 0; k < 3; k++) for (const row of [11, 10, 9]) {
    await dragPath('M', [[0, row], [4, row]]);
    shovePeak = Math.max(shovePeak, (await obj('C')).maxx);
    await step(0.3);
    shovePeak = Math.max(shovePeak, (await obj('C')).maxx);
    await dragPath('M', [[0, row]]);
  }
  await step(2);
  o = await obj('C');
  check('L23 anti-cheese: shoving the puddle with the 1x1 never crosses the divide (peak x ' +
    shovePeak.toFixed(2) + ')', shovePeak < 6.5 && !o.home, { shovePeak, cx: o.cx });

  await load(22);
  await apply('heat', 'C'); await step(2.5);
  check('L23: melt cleared the doorway', (await obj('C')).cy > 4);
  await dragPath('M', [[2, 1], [2, 5], [2, 8], [0, 11]]);
  check('L23: 1x1 gem escorted through both slots', (await obj('M')).home, await obj('M'));
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>10.4&&o.cx<5;}', 30);
  check('L23: liquid drained through both slots into the left cellar (' + t + 's)', t > 0, await obj('C'));
  await setGrav(11.5, 8.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cx>6.8&&o.cy<9.4;}', 60);
  check('L23: the well lifted the pour over the 3-tall divide onto the lane (' + t + 's)', t > 0, await obj('C'));
  await setGrav(8.5, 13.5);
  t = await stepUntil('s=>{const o=s.objs.find(u=>u.L==="C");return o.cy>9.8&&o.cx>6.8;}', 40);
  check('L23: dropped into the far cellar (' + t + 's)', t > 0, await obj('C'));
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
  const voidLogPreLen = await page.evaluate('(window.__SFXLOG||[]).length');
  await dragPath('R', [[3, 5], [3, 6]]); // feed it to the void
  await step(1.5);
  o = await obj('R');
  check('L41: the void consumed the gem', o.dead === true, o);
  const voidLogTail = (await page.evaluate('window.__SFXLOG||[]')).slice(voidLogPreLen);
  check('phasaudio: void death logs gulp, not slurp (log tail ' + JSON.stringify(voidLogTail) + ')',
    voidLogTail.length > 0 && voidLogTail[voidLogTail.length - 1] === 'gulp' && !voidLogTail.includes('slurp'),
    voidLogTail);
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

  // ---------- phasgrav: gravmaze coverage, BFS impassability, docked-well negative ----------
  // Block 2 (L17-24) has exactly one generated slot — L24 (index 23); L17-23
  // are all authored (see the L17-L23 checks above). Scanning GEN_IDX for
  // block 2 rather than hardcoding "23" means this stays scan-derived: today
  // it finds one index, and that one index IS full block-2 gravmaze coverage
  // — obstacle-era gravmazes (blocks 5+) are a follow-up, not this plan.
  const block2GenIdx = GEN_IDX.filter(i => i >= 16 && i <= 23);
  check('phasgrav: block-2 generated-index scan finds exactly L24 — index 23 is the ONLY possible ' +
    'gravmaze index until obstacle-era mazes land (found ' + block2GenIdx.map(i => i + 1).join(',') + ')',
    block2GenIdx.length === 1 && block2GenIdx[0] === 23, block2GenIdx);

  // shape offsets come straight from the page's own SHAPE_STR (a top-level
  // const, visible to page.evaluate like SONGS/blockOf already are elsewhere
  // in this suite) — never duplicated/hardcoded here, so a shape edit can't
  // silently desync the BFS from what the game actually draws.
  const SHAPES = await page.evaluate('SHAPE_STR');
  function shapeOff(L) {
    const rows = SHAPES[L], off = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === 'X') off.push({ x, y });
    return off;
  }
  function fitsAt(off, ax, ay, wallRows, gw2, gh2) { // walls-only fit test, mirrors solidFits's wall check
    for (const c of off) {
      const x = ax + c.x, y = ay + c.y;
      if (x < 0 || y < 0 || x >= gw2 || y >= gh2) return false;
      if (wallRows[y][x] === '1') return false;
    }
    return true;
  }
  function bfsReach(off, sax, say, wallRows, gw2, gh2) { // every lattice anchor a drag can reach from spawn
    const seen = new Set(), key = (x, y) => x + ',' + y;
    if (!fitsAt(off, sax, say, wallRows, gw2, gh2)) return seen;
    seen.add(key(sax, say));
    const q = [[sax, say]];
    while (q.length) {
      const [ax, ay] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = ax + dx, ny = ay + dy, k = key(nx, ny);
        if (seen.has(k) || !fitsAt(off, nx, ny, wallRows, gw2, gh2)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  }

  for (const gIdx of block2GenIdx) {
    await load(gIdx);
    const mi = await g('G=>G.mapInfo()');
    check('phasgrav: gravmaze coverage — L' + (gIdx + 1) + ' (the only generated block-2 index today) ships ' +
      'mapInfo().maze truthy, i.e. the gravmaze template actually shipped there', !!mi.maze, mi.maze);
    // gravmaze replay (win, all home) is already asserted exactly by the
    // 'gen L24: solver script replays to a win' check in the GEN_IDX loop
    // above (info.hasScript && replayGen() to a win with every obj home) —
    // extending that existing check rather than duplicating it here.

    if (!mi.maze) continue;
    const mz = mi.maze, gw2 = mi.walls[0].length, gh2 = mi.walls.length;
    let tunnelBreach = null, missingHome = null;
    for (const gm of mi.gems) {
      const off = shapeOff(gm.L);
      const reach = bfsReach(off, gm.ax, gm.ay, mi.walls, gw2, gh2);
      for (const key of reach) {
        const [ax, ay] = key.split(',').map(Number);
        if (off.some(c => ay + c.y >= mz.ceil)) { tunnelBreach = { L: gm.L, ax, ay }; break; }
      }
      if (tunnelBreach) break;
      if (gm.L !== mz.L && !reach.has(gm.sax + ',' + gm.say)) missingHome = gm.L;
    }
    check('L' + (gIdx + 1) + ' gravmaze BFS (walls-only lattice): no solid gem placement, including the ' +
      'maze gem itself, ever reaches a tunnel cell (row >= ceil ' + mz.ceil + ')',
      tunnelBreach === null, { tunnelBreach, mz });
    check('L' + (gIdx + 1) + ' gravmaze BFS: every non-maze solid can still reach its own socket by plain drag',
      missingHome === null, { missingHome, gems: mi.gems });

    // docked-well negative: melt the maze gem and leave the well DOCKED
    // (uniform down — setGrav is never called), then confirm plain drainage
    // alone cannot solve it. Measured form (task 3): the mouth only lets
    // part of the gem's overhead footprint through, so the pour parks near
    // the mouth end, columns away from the alcove, and freeze refuses there.
    await load(gIdx);
    let gv = await g('G=>G.gravAt()');
    check('L' + (gIdx + 1) + ' docked-well negative: well starts DOCKED (uniform down)', gv && gv.docked === true, gv);
    await apply('heat', mz.L);
    for (let k = 0; k < 12; k++) await step(5); // ~60s sim, docked the whole way
    const o4 = await obj(mz.L);
    const pocketCx = mz.pc + mz.mw / 2;
    check('L' + (gIdx + 1) + ' docked-well negative: melt under docked gravity parks the pour columns away ' +
      'from the alcove (cx ' + o4.cx.toFixed(2) + ' vs pocket cx ' + pocketCx.toFixed(2) + ')',
      Math.abs(o4.cx - pocketCx) > 3, o4);
    check('L' + (gIdx + 1) + ' docked-well negative: not home after ~60s of docked-only sim', !o4.home, o4);
    const tapOk4 = await tap(mz.L);
    check('L' + (gIdx + 1) + ' docked-well negative: the freeze tap is refused while parked off the socket',
      !tapOk4, { tapOk4, o4 });
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

  // ---------- phasmazes: obstacle-era hazard mazes (blocks 5-7) — block-2
  // byte-identity pin, determinism, per-kind coverage/replay, BFS fairness
  // negatives ----------
  // buildGen/mulberry are page-global functions (reachable via page.evaluate
  // exactly like SHAPE_STR/blockOf above); mapInfo()/genInfo()/replayGen()
  // are the TEST hooks documented at the top of this file. block2GenIdx is
  // the SAME scan-derived array phasgrav computed above — reused here, never
  // recomputed, so both sections agree on what "the generated block-2 index"
  // even means.

  // ---- (a) BLOCK-2 BYTE-IDENTITY — the run's hardest gate, now permanent.
  // The hazard-maze template draw lives on a SEPARATE index-seeded mulberry
  // (buildGen's mzIdx const) that only ever runs for b>=5, so a block-2
  // candidate's own draw stream is untouched by construction — this gate
  // proves it stays that way by hashing buildGen(i,salt)'s actual output for
  // every block-2 generated index, across every salt getLevel's own scan can
  // reach (0-19 the main scan, 90-95 the rescue band, 99 the emergency
  // fallback — mirrored exactly off getLevel above), into one pinned
  // SHA-256. A second corpus over block 3 (pre-maze drawer/two-shelf/attic
  // content, unaffected by anything this plan touches) is pinned the same
  // way as a harness-drift canary: if BOTH hashes move, suspect the harness
  // (e.g. a JSON key-order change); if ONLY block-2 moves, it's real.
  //
  // *** PINNED HASHES ARE CD-SIGNED-OFF BLOCK-2 CONTENT (2026-08-01 block-2
  // playtest verdict). A future edit that moves PINNED_BLOCK2_HASH is either
  // a deliberate block-2 redesign — re-pin consciously, with a fresh CD
  // verdict recorded — or a regression to fix. Never silently update the
  // constant to make a red check green. ***
  const HASH_SALTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 90, 91, 92, 93, 94, 95, 99];
  function stableStringify(val) { // recursive sorted-key JSON — key-order-proof hashing
    if (val === null || typeof val !== 'object') return JSON.stringify(val);
    if (Array.isArray(val)) return '[' + val.map(stableStringify).join(',') + ']';
    const keys = Object.keys(val).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(val[k])).join(',') + '}';
  }
  async function buildDefCorpus(indices) { // every buildGen(i,salt) def, in index-then-salt order
    const entries = [];
    for (const i of indices) for (const salt of HASH_SALTS) {
      const def = await page.evaluate('buildGen(' + i + ',' + salt + ')');
      entries.push({ i, salt, def });
    }
    return entries;
  }
  const PINNED_BLOCK2_HASH = '817f920cae53eb842e11daaef6fc3926ccfcc2e4ede58d1203d7ea3c89516b1d';
  const PINNED_BLOCK3_CONTROL_HASH = '472939e0fa31d2e93c78aa4d91bfd2d0a342c92548cf700b8e232b25c95e3bb7';
  const block3GenIdx = GEN_IDX.filter(i => i >= 24 && i <= 31); // control: block 3 (Frost/liquid-base), pre-maze content

  const block2Hash = crypto.createHash('sha256').update(stableStringify(await buildDefCorpus(block2GenIdx))).digest('hex');
  check('phasmazes: BLOCK-2 BYTE-IDENTITY — buildGen defs for every block-2 generated index (L' +
    block2GenIdx.map(i => i + 1).join(',L') + ') across salts ' + HASH_SALTS.length +
    ' (0-19,90-95,99) hash to the pinned SHA-256',
    block2Hash === PINNED_BLOCK2_HASH, { block2Hash, PINNED_BLOCK2_HASH });

  const block3Hash = crypto.createHash('sha256').update(stableStringify(await buildDefCorpus(block3GenIdx))).digest('hex');
  check('phasmazes: control corpus — block 3 (L' + block3GenIdx.map(i => i + 1).join(',L') +
    ', pre-maze content) buildGen defs hash to their own pinned SHA-256 (harness-drift canary for the gate above)',
    block3Hash === PINNED_BLOCK3_CONTROL_HASH, { block3Hash, PINNED_BLOCK3_CONTROL_HASH });

  // ---- (b) DETERMINISM: two FRESH page loads (genCache is page-lifetime —
  // an in-page second load would just read the cache and prove nothing about
  // the generator itself) of one hazard-maze index must produce byte-
  // identical mapInfo. Same fresh-reload technique the phasdaily section
  // below establishes for its own determinism gate — reproduced locally
  // here since phasdaily's helpers are declared later in this file and
  // aren't in scope yet at this point in the script. ----
  async function mazesReload() {
    await page.goto('file://' + GAME + '?test=1', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(400);
  }
  function serializeMazeBoard(mi) { // walls+gems+template+holes+bushes+fans+beam+maze, order-independent
    const s2 = arr => arr.map(x => JSON.stringify(x)).sort();
    return stableStringify({
      template: mi.template, maze: mi.maze, walls: mi.walls,
      gems: s2(mi.gems.map(g2 => ({ L: g2.L, ax: g2.ax, ay: g2.ay, sax: g2.sax, say: g2.say, w: g2.w, h: g2.h, base: g2.base }))),
      holes: s2(mi.holes), bushes: s2(mi.bushes), fans: s2(mi.fans), beam: s2(mi.beam),
    });
  }
  await mazesReload();
  await load(50);
  const detSerial1 = serializeMazeBoard(await g('G=>G.mapInfo()'));
  await mazesReload();
  await load(50);
  const detSerial2 = serializeMazeBoard(await g('G=>G.mapInfo()'));
  check('phasmazes determinism: L51 (bush maze, index 50) generates an identical board (walls+gems+' +
    'template+holes+bushes+fans+beam+maze) across two fresh page loads',
    detSerial1 === detSerial2, { equal: detSerial1 === detSerial2 });

  // ---- (c) PER-KIND COVERAGE + REPLAY: void (42), bush (50), fan (60), plus
  // the width-decline case (43 — walls-only is the correct fallback when the
  // maze gem is too wide for the void's alcove, not a broken hazard). ----
  async function loadMazeInfo(i) {
    await load(i);
    return { info: await g('G=>G.genInfo()'), mi: await g('G=>G.mapInfo()') };
  }
  const { info: info42, mi: mi42 } = await loadMazeInfo(42);
  check('phasmazes: L43 (index 42) ships the gravmaze template', info42 && info42.template === 'gravmaze', info42);
  check('phasmazes: L43 void maze — holes present, bushes/fans absent',
    mi42.holes.length >= 1 && mi42.bushes.length === 0 && mi42.fans.length === 0,
    { holes: mi42.holes.length, bushes: mi42.bushes.length, fans: mi42.fans.length });
  const replay42 = await g('G=>G.replayGen()');
  check('phasmazes: L43 void maze — solver script replays to a win (the served board is solver-beaten)',
    replay42 === true && (await st()).objs.every(x => x.home), replay42);

  const { info: info50, mi: mi50 } = await loadMazeInfo(50);
  check('phasmazes: L51 (index 50) ships the gravmaze template', info50 && info50.template === 'gravmaze', info50);
  check('phasmazes: L51 bush maze — bushes present, holes/fans absent',
    mi50.bushes.length >= 1 && mi50.holes.length === 0 && mi50.fans.length === 0,
    { holes: mi50.holes.length, bushes: mi50.bushes.length, fans: mi50.fans.length });
  const replay50 = await g('G=>G.replayGen()');
  check('phasmazes: L51 bush maze — solver script replays to a win (the served board is solver-beaten)',
    replay50 === true && (await st()).objs.every(x => x.home), replay50);

  const { info: info60, mi: mi60 } = await loadMazeInfo(60);
  check('phasmazes: L61 (index 60) ships the gravmaze template', info60 && info60.template === 'gravmaze', info60);
  check('phasmazes: L61 fan maze — fans+beam present, holes/bushes absent',
    mi60.fans.length >= 1 && mi60.beam.length >= 1 && mi60.holes.length === 0 && mi60.bushes.length === 0,
    { holes: mi60.holes.length, bushes: mi60.bushes.length, fans: mi60.fans.length, beam: mi60.beam.length });
  const replay60 = await g('G=>G.replayGen()');
  check('phasmazes: L61 fan maze — solver script replays to a win (the served board is solver-beaten)',
    replay60 === true && (await st()).objs.every(x => x.home), replay60);

  const { info: info43, mi: mi43 } = await loadMazeInfo(43);
  check('phasmazes: L44 (index 43) ships the gravmaze template', info43 && info43.template === 'gravmaze', info43);
  check('phasmazes: L44 width-decline gravmaze — ZERO hazards (holes+bushes+fans all empty; the maze ' +
    'gem is 3 wide so void declined and no newer kind is eligible at block 5 — walls-only is correct here)',
    mi43.holes.length === 0 && mi43.bushes.length === 0 && mi43.fans.length === 0,
    { holes: mi43.holes.length, bushes: mi43.bushes.length, fans: mi43.fans.length });

  // ---- (d) BFS NEGATIVES per kind, computed in node from mapInfo (mirrors
  // phasgrav's BFS style above: walls row-strings are '1'/'0' per cell). ----
  function wallOpen(wallRows, x, y) { // true if (x,y) is on-grid and NOT a '#' wall
    if (y < 0 || y >= wallRows.length || x < 0 || x >= wallRows[0].length) return false;
    return wallRows[y][x] === '0';
  }
  function mazeBfsRoute(wallRows, extraBlocked, x0, y0, x1, y1) { // 4-neighbour BFS; walls + extraBlocked(x,y) both block
    const open = (x, y) => wallOpen(wallRows, x, y) && !extraBlocked(x, y);
    const seen = new Set();
    const key = (x, y) => x + ',' + y;
    if (!open(x0, y0) || !open(x1, y1)) return { reach: false, seen };
    seen.add(key(x0, y0));
    const q = [[x0, y0]];
    while (q.length) {
      const [cx, cy] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
        if (seen.has(k) || !open(nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return { reach: seen.has(key(x1, y1)), seen };
  }

  // bush (L51, index 50): liquid is drunk by a bush on contact — a route
  // that treats '%' cells as blocked must FAIL; the same route with '%'
  // passable (the vapor path) must SUCCEED, since that is the only way past
  // the hedge (mirrors mazeRouteOk's own liquid-vs-gas bush rule).
  const gemR50 = mi50.gems.find(g2 => g2.L === mi50.maze.L);
  const bushSet50 = new Set(mi50.bushes.map(b => b.x + ',' + b.y));
  const mouth50 = [mi50.maze.mx, mi50.maze.top], sock50 = [gemR50.sax, gemR50.say];
  const bushBlockedRoute = mazeBfsRoute(mi50.walls, (x, y) => bushSet50.has(x + ',' + y), mouth50[0], mouth50[1], sock50[0], sock50[1]);
  check('phasmazes: L51 bush maze — liquid route (bush cells blocked) from mouth to socket FAILS (the hedge drinks a plain pour)',
    !bushBlockedRoute.reach, { mouth: mouth50, sock: sock50, bushes: mi50.bushes });
  const bushOpenRoute = mazeBfsRoute(mi50.walls, () => false, mouth50[0], mouth50[1], sock50[0], sock50[1]);
  check('phasmazes: L51 bush maze — vapor route (bush cells passable) from mouth to socket SUCCEEDS (the only way past the hedge)',
    bushOpenRoute.reach, { mouth: mouth50, sock: sock50 });

  // fan (L61, index 60): the beam must cover the floor-baffle climb gate (the
  // one open tunnel row at that column — TOP+1 and FLOOR are walled by the
  // baffle itself), forcing a liquid crossing instead of a vapor float over
  // it; the fan tile is solid to stone/liquid (mirrors solidBlockAt /
  // collideParticleWalls in the page source) so it must not read as open in
  // the walls grid AND must be excluded from the BFS traversal graph, yet a
  // liquid route must still exist around it — an obstruction, not a seal.
  const floorBaffle60 = mi60.maze.baffles.find(b => b.k === 'floor');
  check('phasmazes: L61 fan maze has a floor baffle to derive the climb gate from', !!floorBaffle60, mi60.maze.baffles);
  const climbGateCells = [];
  for (let y = mi60.maze.top; y <= mi60.maze.floorY; y++)
    if (wallOpen(mi60.walls, floorBaffle60.x, y)) climbGateCells.push({ x: floorBaffle60.x, y });
  const beamSet60 = new Set(mi60.beam.map(b => b.x + ',' + b.y));
  check('phasmazes: L61 fan maze — every open tunnel cell above the floor baffle (the climb gate, x=' +
    floorBaffle60.x + ') is in the fan beam',
    climbGateCells.length > 0 && climbGateCells.every(c => beamSet60.has(c.x + ',' + c.y)),
    { climbGateCells, beam: mi60.beam });
  const fan60 = mi60.fans[0];
  check('phasmazes: L61 fan maze — the fan tile is NOT a "#" wall cell (a distinct hazard the BFS graph ' +
    'must exclude on its own, not get for free from the walls grid)',
    wallOpen(mi60.walls, fan60.x, fan60.y), fan60);
  const gemR60 = mi60.gems.find(g2 => g2.L === mi60.maze.L);
  const mouth60 = [mi60.maze.mx, mi60.maze.top], sock60 = [gemR60.sax, gemR60.say];
  const fanBlockedRoute = mazeBfsRoute(mi60.walls, (x, y) => x === fan60.x && y === fan60.y, mouth60[0], mouth60[1], sock60[0], sock60[1]);
  check('phasmazes: L61 fan maze — liquid route from mouth to socket SUCCEEDS with the fan tile excluded from the graph (the obstruction narrows the route, it never seals it)',
    fanBlockedRoute.reach, { mouth: mouth60, sock: sock60, fan: fan60 });
  check('phasmazes: L61 fan maze — the fan tile cell itself never enters the open-route BFS graph',
    !fanBlockedRoute.seen.has(fan60.x + ',' + fan60.y), { fan: fan60, seenSize: fanBlockedRoute.seen.size });

  // void (L43, index 42): a careful route (every open cell strictly >=1.5
  // from every hole, matching the page's own mazeRouteOk pull-radius rule —
  // it blocks at <1.5) must exist from mouth to socket, AND at least one
  // open tunnel cell must sit within that same 1.5-cell pull — the overshot
  // threat is real, not decorative.
  const gemR42 = mi42.gems.find(g2 => g2.L === mi42.maze.L);
  const mouth42 = [mi42.maze.mx, mi42.maze.top], sock42 = [gemR42.sax, gemR42.say];
  const nearHole42 = (x, y) => mi42.holes.some(h => Math.hypot(h.x - x, h.y - y) < 1.5);
  const voidSafeRoute = mazeBfsRoute(mi42.walls, nearHole42, mouth42[0], mouth42[1], sock42[0], sock42[1]);
  check('phasmazes: L43 void maze — a careful route (every cell >=1.5 from every hole) exists from mouth to socket',
    voidSafeRoute.reach, { mouth: mouth42, sock: sock42, holes: mi42.holes });
  let threatCell42 = null;
  for (let y = mi42.maze.top; y <= mi42.maze.floorY && !threatCell42; y++)
    for (let x = 0; x < mi42.walls[0].length && !threatCell42; x++) {
      if (!wallOpen(mi42.walls, x, y)) continue;
      if (mi42.holes.some(h => h.x === x && h.y === y)) continue; // the hole's own cell, not a route cell
      if (nearHole42(x, y)) threatCell42 = { x, y };
    }
  check('phasmazes: L43 void maze — at least one open tunnel cell sits within the hole\'s 1.5-cell pull (the overshot threat is real, not decorative)',
    threatCell42 !== null, threatCell42);

  // ---- (e) cleanup: leave no maze level loaded — low-index authored level,
  // same section-boundary convention the rest of this suite uses. ----
  await load(0);

  // ---------- phasfreeze: settled-puddle freeze fix (commit 16c4a28) ----------
  // tryFreeze now widens the per-particle jump cap for RESTING puddles only —
  // scaled to footprint height, min(2.6, max(1.9, footprintHeight-0.9+0.45)) —
  // and seeds surface-row anchors, so a settled 3-tall gem (T5, letter C)
  // reaches its true footprint instead of refusing at the old fixed 1.9 cap.
  // A still-falling/dragged puddle keeps the plain 1.9 cap — the mid-air
  // freeze exploit stays dead. Indices are scanned at runtime (the generator
  // re-rolls whenever templates change) — never hardcode a level number here.
  const FREEZE_SCAN_HI = 96;

  // T5/C: a moving puddle still refuses (the exploit stays dead); the same
  // puddle once truly at rest now finds room and freezes within the wider cap.
  let t5 = null;
  for (let i = 0; i < FREEZE_SCAN_HI; i++) {
    await load(i);
    if (!(await g('G=>G.genInfo()'))) continue; // generated levels only
    if (!(await ensureLiquid('C'))) continue;
    await step(0.5); // early in the pour — fixed, deterministic
    const earlyDrift = await driftNow('C');
    if (earlyDrift <= REST_V) continue; // didn't catch it moving; try another index
    const earlyDry = await g('G=>G.freezeDry("C")');
    if (earlyDry && earlyDry.pick) continue; // already fits while moving — not the case we want
    await step(6); // settle
    const restDrift = await driftNow('C');
    if (restDrift > REST_V) continue; // hasn't settled yet at this fixed budget
    const dry = await g('G=>G.freezeDry("C")');
    if (!dry || !dry.pick) continue; // still refuses settled — not the fixed disease's case
    t5 = { idx: i, earlyDrift, earlyDry, restDrift, dry };
    break;
  }
  check('phasfreeze: scan finds a settled T5/C level with open floor to freeze into' +
    (t5 ? ' (found L' + (t5.idx + 1) + ')' : ' — none found, generator may have changed shape'),
    !!t5, t5);

  if (t5) {
    check('T5 L' + (t5.idx + 1) + ': mid-pour puddle is genuinely moving (drift ' + t5.earlyDrift.toFixed(4) +
      ' > rest ' + REST_V + ') and freeze is refused — the mid-air exploit stays dead',
      t5.earlyDrift > REST_V && !(t5.earlyDry && t5.earlyDry.pick), t5.earlyDry);
    check('T5 L' + (t5.idx + 1) + ': settled puddle rests (drift ' + t5.restDrift.toFixed(4) +
      ' <= rest ' + REST_V + ') and freezeDry now finds a candidate at ' + JSON.stringify(t5.dry.pick),
      t5.restDrift <= REST_V && !!(t5.dry && t5.dry.pick), t5.dry);
    const t5Committed = await realFreeze('C');
    const t5PreCommit = await g('G=>G.parts("C")'); // post-reorder, pre-move: target-order snapshot
    await step(1.2);
    o = await obj('C');
    check('T5 L' + (t5.idx + 1) + ': settled freeze commits via the play path and reaches solid within ~1.2s',
      t5Committed && o.phase === 'solid', o);
    const t5MaxJump = maxJumpBetween(t5PreCommit, await g('G=>G.parts("C")'));
    check('T5 L' + (t5.idx + 1) + ": every particle's commit jump stays <= 2.6 cells (max " + t5MaxJump.toFixed(3) + ')',
      t5MaxJump <= 2.6 + 1e-6, t5MaxJump);
  }

  // I4/P invariant: settled I4 ALWAYS froze, before and after this fix (h=1
  // forces only a small jump even at the old fixed cap) — a cheap guard that
  // the common case stays working.
  let i4 = null;
  for (let i = 0; i < FREEZE_SCAN_HI; i++) {
    await load(i);
    if (!(await g('G=>G.genInfo()'))) continue;
    if (!(await ensureLiquid('P'))) continue;
    await step(6);
    const restDrift = await driftNow('P');
    if (restDrift > REST_V) continue;
    const dry = await g('G=>G.freezeDry("P")');
    if (!dry || !dry.pick) continue;
    i4 = { idx: i, restDrift, dry };
    break;
  }
  let i4Result = null;
  if (i4) {
    const i4Committed = await realFreeze('P');
    const i4PreCommit = await g('G=>G.parts("P")');
    await step(1.2);
    o = await obj('P');
    const i4MaxJump = maxJumpBetween(i4PreCommit, await g('G=>G.parts("P")'));
    i4Result = { committed: i4Committed, phase: o.phase, maxJump: i4MaxJump };
  }
  check('phasfreeze invariant: settled I4/P still freezes on the first try' +
    (i4 ? ' (found L' + (i4.idx + 1) + ', jump ' + i4Result.maxJump.toFixed(3) + ')' : ' — none found, generator may have changed shape'),
    !!i4 && i4Result.committed && i4Result.phase === 'solid' && i4Result.maxJump <= 2.6 + 1e-6,
    { i4, i4Result });

  // Room to Pour's shelf refusal (L20, above) already pins the no-room
  // negative and is unaffected by this fix (moving puddle, small footprint,
  // never reaches REST_V during the drain) — no duplicate check needed here.

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

  // ---------- phasaudio: dedicated obstacle SFX + per-block music ----------
  // TEST-only window.__SFXLOG. gulp/slurp/hum-on/hum-off/song pushes all
  // happen before any `ac` guard, so the log fills even without an
  // AudioContext. Bush/fan levels are scan-derived (mapInfo().bushes /
  // .fans per load), never hardcoded — the void gulp check above extends
  // the suite's own existing L41 navigation instead.
  check('phasaudio: window.__SFXLOG is an array after a level load',
    await page.evaluate('Array.isArray(window.__SFXLOG)'));

  // bush -> slurp: derive the first curriculum level with a bush obstacle,
  // melt its gem to liquid (one heat — boiling to gas would let it pass),
  // then pull it straight into the hedge with the gravity well (liquid
  // falls TOWARD the point source) and confirm the kill logs slurp.
  let audBushIdx = null, audBushMap = null;
  for (let i = 0; i < 64 && audBushIdx === null; i++) {
    await load(i);
    const mi = await g('G=>G.mapInfo()');
    if (mi.bushes.length > 0) { audBushIdx = i; audBushMap = mi; }
  }
  check('phasaudio: derived the first curriculum level with a bush obstacle (found L' +
    (audBushIdx === null ? '-' : audBushIdx + 1) + ')', audBushIdx !== null, audBushIdx);

  if (audBushIdx !== null) {
    await load(audBushIdx);
    const bushGem = (await st()).objs[0].L;
    const bushO = await obj(bushGem);
    check('phasaudio: heat melts the bush-level gem to liquid',
      await apply('heat', bushGem) && (await obj(bushGem)).phase === 'liquid');
    const bushLogPreLen = await page.evaluate('(window.__SFXLOG||[]).length');
    await setGrav(audBushMap.bushes[0].x + 0.5, bushO.cy); // pull straight into the hedge column
    const bushDeadT = await stepUntil('s=>s.objs.some(o=>o.dead)', 20);
    check('phasaudio: liquid pulled into the hedge dies (' + bushDeadT + 's)', bushDeadT > 0, await obj(bushGem));
    const bushLogTail = (await page.evaluate('window.__SFXLOG||[]')).slice(bushLogPreLen);
    check('phasaudio: bush death logs slurp, not gulp (log tail ' + JSON.stringify(bushLogTail) + ')',
      bushLogTail.length > 0 && bushLogTail[bushLogTail.length - 1] === 'slurp' && !bushLogTail.includes('gulp'),
      bushLogTail);
    await step(1.5); // fail overlay raises ~0.9s after the kill (failT), as the L41 block also waits out
    check('phasaudio: fail state raised after the bush kill', (await st()).game === 'fail');
    await load(audBushIdx); // reload — same reload-after-fail pattern as the L41 block
    check('phasaudio: reload after the bush kill restores play', (await st()).game === 'play' && !(await obj(bushGem)).dead);
  }

  // fan hum: derive the first curriculum level with a fan (never trust a
  // fixed level number — templates re-roll), confirm loading it starts the
  // ambient hum, then confirm a fan-free level stops it with no new hum-on.
  let audFanIdx = null;
  for (let i = 0; i < 64 && audFanIdx === null; i++) {
    await load(i);
    const mi = await g('G=>G.mapInfo()');
    if (mi.fans.length > 0) audFanIdx = i;
  }
  check('phasaudio: derived the first curriculum level with a fan obstacle (found L' +
    (audFanIdx === null ? '-' : audFanIdx + 1) + ')', audFanIdx !== null, audFanIdx);

  if (audFanIdx !== null) {
    // hum-off's TEST log is gated on fanHumNodes (an honest "a real node was
    // torn down" signal, unlike hum-on's ac-decoupled "would have started"
    // signal) — a real AudioContext is needed to actually spin up the node
    // fanHumStop() can be observed tearing down. Headless chromium can
    // construct one with no user gesture (verified: ac.state === 'running').
    await page.evaluate('audioInit()');
    await load(0); // known fan-free level, hum guaranteed off before measuring the on-transition
    check('phasaudio: sanity — L1 has no fans', (await g('G=>G.mapInfo()')).fans.length === 0);
    const humOnPreLen = await page.evaluate('(window.__SFXLOG||[]).length');
    await load(audFanIdx);
    const humOnLog = (await page.evaluate('window.__SFXLOG||[]')).slice(humOnPreLen);
    check('phasaudio: loading the fan level (L' + (audFanIdx + 1) + ') appends hum-on', humOnLog.includes('hum-on'), humOnLog);

    const humOffPreLen = await page.evaluate('(window.__SFXLOG||[]).length');
    await load(0); // fan-free level — hum stops at the top of loadLevel
    const humOffLog = (await page.evaluate('window.__SFXLOG||[]')).slice(humOffPreLen);
    check('phasaudio: loading a fan-free level (L1) appends hum-off with no new hum-on',
      humOffLog.includes('hum-off') && !humOffLog.includes('hum-on'), humOffLog);
  }

  // per-block music: songStart(i<72?blockOf(i):i%10) — assert against the
  // log's LAST song entry (a level's load can also push hum-on/off around it).
  for (const i of [0, 9, 60, 70]) {
    const expected = i < 72 ? await page.evaluate('blockOf(' + i + ')') : i % 10;
    await load(i);
    const songLog = await page.evaluate('window.__SFXLOG||[]');
    let lastSong = null;
    for (let k = songLog.length - 1; k >= 0; k--) { if (Array.isArray(songLog[k]) && songLog[k][0] === 'song') { lastSong = songLog[k]; break; } }
    check('phasaudio: load(' + i + ') logs song index ' + expected + ' (last song entry ' + JSON.stringify(lastSong) + ')',
      !!lastSong && lastSong[1] === expected, lastSong);
  }

  // ---------- phaschrome: rotation lifecycle — the squish repro, pinned ----------
  // Gem particles live in PIXELS, and layout() only ever moves them by a
  // RELATIVE transform (new CELL / old CELL). Break one link in that chain and
  // the gems stay in the old frame forever while the field draws in the new one
  // — the CD's "portrait -> landscape -> portrait squishes it irrecoverably,
  // rotating again does not fix it, only a restart does" report (a restart heals
  // because setupLevel re-derives positions from startAx/startAy).
  //
  // Traced break: CELL came out <= 0 for any canvas shorter than ~124 px,
  // because BZ's 80 px floor did not shrink with H, so `ah` went negative. The
  // NEXT layout's `oldCell>0` guard then silently dropped its transform, and
  // every later layout faithfully applied correct relative transforms on top of
  // a corrupted absolute state. Pre-fix, a 390x160 excursion collapsed L1's
  // first gem from 1.0-cell particle spacing to 0.042 and a full rotation round
  // trip did not heal it.
  //
  // These pin the INVARIANT, not the trigger: after any viewport excursion the
  // geometry and the gems come back, and a repeated layout() is a strict no-op.
  const VP_PORTRAIT = { width: 390, height: 844 };
  const VP_LANDSCAPE = { width: 844, height: 390 };
  const EPS_CELL = 1e-9;  // float residue of a similarity-transform round trip
  const metricsNow = () => g('G=>G.metrics()');
  const gemPts = (L) => g('G=>G.parts("' + L + '")');
  const sameGeom = (a, b) => a.W === b.W && a.H === b.H && a.CELL === b.CELL &&
    a.FX === b.FX && a.FY === b.FY && a.cvW === b.cvW && a.cvH === b.cvH;
  const backingMatchesBox = (m) => m.rectW > 0 && m.rectH > 0 &&
    Math.abs(m.cvW / m.rectW - m.cvH / m.rectH) < 1e-6;   // no stretch: one scale on both axes
  const maxCellDrift = (a, b) => (!a || !b || a.length !== b.length) ? Infinity
    : Math.max(...a.map((p, i) => Math.max(Math.abs(p.x - b[i].x), Math.abs(p.y - b[i].y))));
  async function viewport(vp) { await page.setViewportSize(vp); await page.waitForTimeout(320); }

  await viewport(VP_PORTRAIT);
  await load(0);
  const chromeL = (await st()).objs[0].L;
  const mBase = await metricsNow(), pBase = await gemPts(chromeL);
  check('phaschrome: portrait baseline — canvas backing store matches its CSS box (' +
    mBase.cvW + 'x' + mBase.cvH + ' over ' + mBase.rectW + 'x' + mBase.rectH + '), CELL ' + mBase.CELL.toFixed(2),
    backingMatchesBox(mBase) && mBase.CELL > 0, mBase);

  // (a) the round trip the CD reports, run twice in a row
  for (let round = 1; round <= 2; round++) {
    await viewport(VP_LANDSCAPE);
    const mL = await metricsNow();
    check('phaschrome: round ' + round + ' landscape — box is wide, CELL > 0 (' + mL.CELL.toFixed(2) +
      '), backing store unstretched (' + mL.cvW + 'x' + mL.cvH + ')',
      mL.W > mL.H && mL.CELL > 0 && backingMatchesBox(mL), mL);
    await viewport(VP_PORTRAIT);
    const mP = await metricsNow(), pP = await gemPts(chromeL);
    check('phaschrome: round ' + round + ' back to portrait — CELL/FX/FY/canvas recover exactly',
      sameGeom(mBase, mP), { mBase, mP });
    const d = maxCellDrift(pBase, pP);
    check('phaschrome: round ' + round + ' back to portrait — gems land back on their cells (max drift ' +
      d.toExponential(2) + ' cells)', d < EPS_CELL, { d, pP: pP && pP.slice(0, 2) });
  }

  // (a2) the traced trigger itself: a box short enough that the bucket strip
  // alone overruns it. This is what used to drive CELL negative.
  for (const h of [200, 160, 140, 120]) {
    await viewport({ width: 390, height: h });
    const mS = await metricsNow();
    check('phaschrome: ' + h + 'px-tall viewport keeps CELL positive (' + mS.CELL.toFixed(3) + ')',
      mS.CELL > 0, mS);
  }
  await viewport(VP_PORTRAIT);
  const mHeal = await metricsNow(), pHeal = await gemPts(chromeL);
  check('phaschrome: geometry recovers after the degenerate-box excursion', sameGeom(mBase, mHeal), { mBase, mHeal });
  const dHeal = maxCellDrift(pBase, pHeal);
  check('phaschrome: gems recover after the degenerate-box excursion (max drift ' +
    dHeal.toExponential(2) + ' cells) — the squish is no longer one-way', dHeal < EPS_CELL, { dHeal });

  // (b) idempotence: the rescale is relative, so per-call residue would compound
  const mIdem0 = await metricsNow(), pIdem0 = await gemPts(chromeL);
  for (let i = 0; i < 10; i++) await g('G=>G.relayout()');
  const mIdem1 = await metricsNow(), pIdem1 = await gemPts(chromeL);
  check('phaschrome: 10 consecutive layout() calls on a settled box leave the geometry bit-identical',
    JSON.stringify(mIdem0) === JSON.stringify(mIdem1), { mIdem0, mIdem1 });
  check('phaschrome: 10 consecutive layout() calls leave every gem particle bit-identical',
    JSON.stringify(pIdem0) === JSON.stringify(pIdem1),
    { a: pIdem0 && pIdem0.slice(0, 2), b: pIdem1 && pIdem1.slice(0, 2) });

  // (c) the lifecycle hardening is actually wired. A CSS-only box change fires
  // no window resize, so anything that heals it can only be a listener firing.
  const wired = await page.evaluate(`(() => {
    const w = document.getElementById('wrap'), out = { hasVV: !!window.visualViewport };
    w.style.height = '600px';
    out.staleAfterCssChange = window.__GF.metrics();
    window.dispatchEvent(new Event('orientationchange'));
    out.afterOrientationChange = window.__GF.metrics();
    w.style.height = '700px';
    if (window.visualViewport) window.visualViewport.dispatchEvent(new Event('resize'));
    out.afterVisualViewport = window.__GF.metrics();
    w.style.height = '';
    window.dispatchEvent(new Event('resize'));
    out.afterResize = window.__GF.metrics();
    return out;
  })()`);
  await page.waitForTimeout(400);   // let the rAF + 300 ms follow-up passes land
  check('phaschrome: a CSS-only box change really does go unnoticed until an event fires',
    Math.abs(wired.staleAfterCssChange.H - wired.staleAfterCssChange.rectH) > 2, wired.staleAfterCssChange);
  check('phaschrome: orientationchange runs layout() (box ' +
    wired.afterOrientationChange.rectH + 'px, canvas took it)',
    Math.abs(wired.afterOrientationChange.H - wired.afterOrientationChange.rectH) < 0.5 &&
    backingMatchesBox(wired.afterOrientationChange), wired.afterOrientationChange);
  check('phaschrome: visualViewport.resize runs layout()', wired.hasVV &&
    Math.abs(wired.afterVisualViewport.H - wired.afterVisualViewport.rectH) < 0.5 &&
    backingMatchesBox(wired.afterVisualViewport), wired.afterVisualViewport);
  check('phaschrome: window resize runs layout()',
    Math.abs(wired.afterResize.H - wired.afterResize.rectH) < 0.5 &&
    backingMatchesBox(wired.afterResize), wired.afterResize);
  const mAfterWired = await metricsNow();
  check('phaschrome: the event storm settles back on the real portrait geometry',
    sameGeom(mBase, mAfterWired), { mBase, mAfterWired });

  // ---------- phaschrome: landscape puts the buckets in a right-side column ----------
  // CD request (2026-07-31): in landscape, move HOT/GRAV/COLD off the bottom
  // row and into a right-side column so the play field gets the full height.
  // L1 has no buckets at all; level index 25 is this region's canonical
  // heat+grav+cold level (probed live — heatN 1, coldN 1, a docked well) so
  // it exercises all three column slots at once, same convention the frost-
  // strip checks above use for picking a level by what it actually contains.
  // GW/GH mirror index.html's own `const GW=10,GH=12` — the field is always
  // that shape (a rotated board is explicitly out of scope for this plan).
  const GW = 10, GH = 12;
  const buckets = () => g('G=>G.buckets()');

  await viewport(VP_PORTRAIT);
  await load(25);
  const bPortraitBefore = await buckets(), mPortraitBefore = await metricsNow();
  check('phaschrome: L26 (index 25) has heat+grav+cold — a real column test level',
    bPortraitBefore.hot && bPortraitBefore.cold && bPortraitBefore.grav, bPortraitBefore);
  check('phaschrome: portrait bucket row — HOT/COLD share a y (unchanged row layout)',
    bPortraitBefore.hot.y === bPortraitBefore.cold.y &&
    bPortraitBefore.hot.x < bPortraitBefore.grav.x && bPortraitBefore.grav.x < bPortraitBefore.cold.x,
    bPortraitBefore);

  await viewport(VP_LANDSCAPE);
  const mLand = await metricsNow(), bLand = await buckets();
  const fieldRight = mLand.FX + GW * mLand.CELL;
  check('phaschrome: landscape — canvas is wide (W>H), CELL positive (' + mLand.CELL.toFixed(2) + ')',
    mLand.W > mLand.H && mLand.CELL > 0, mLand);
  check('phaschrome: landscape — every bucket rect sits right of the field (fieldRight ' +
    fieldRight.toFixed(1) + ')',
    ['hot', 'grav', 'cold'].every(k => bLand[k].x > fieldRight), { fieldRight, bLand });
  check('phaschrome: landscape — column is ordered HOT above GRAV above COLD',
    bLand.hot.y < bLand.grav.y && bLand.grav.y < bLand.cold.y, bLand);
  const heightUsed = (mLand.FY + GH * mLand.CELL) / mLand.H;
  check('phaschrome: landscape — field uses >90% of the available height (' +
    (heightUsed * 100).toFixed(1) + '%, FY ' + mLand.FY.toFixed(1) + ' + GH*CELL ' +
    (GH * mLand.CELL).toFixed(1) + ' of H ' + mLand.H + ')',
    heightUsed > 0.9, { heightUsed, mLand });

  // landscape grab sanity: a real mouse grab from the HOT column bucket lands
  // a flame on a gem, proving the HOT hit-test's new upper y bound (needed so
  // it stops swallowing taps meant for GRAV/COLD below it in the column)
  // didn't also break grabbing from HOT itself. Uses Playwright's own mouse
  // API against the wired mousedown/mousemove/mouseup listeners — no new
  // game-side test hooks needed.
  const stLand = await st();
  const target = stLand.objs.find(o => o.phase === 'solid' && o.frosts === 0);
  check('phaschrome: landscape grab sanity — L26 has a meltable solid gem to target',
    !!target, stLand.objs);
  if (target) {
    const canvasRect = await page.evaluate(() => {
      const r = document.getElementById('cv').getBoundingClientRect();
      return { left: r.left, top: r.top };
    });
    const hotPt = { x: canvasRect.left + bLand.hot.x + bLand.hot.w / 2, y: canvasRect.top + bLand.hot.y + bLand.hot.h * 0.4 };
    // aim at the gem's centroid (already particle-average pixel-frame cell
    // units), not its anchor cell — an anchor corner need not be occupied by
    // any actual particle for a non-rectangular gem footprint
    const gemPt = {
      x: canvasRect.left + mLand.FX + target.cx * mLand.CELL,
      y: canvasRect.top + mLand.FY + target.cy * mLand.CELL,
    };
    const heatsBefore = target.heats;
    await page.mouse.move(hotPt.x, hotPt.y);
    await page.mouse.down();
    await page.mouse.move(gemPt.x, gemPt.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(50);
    const after = (await st()).objs.find(o => o.L === target.L);
    check('phaschrome: landscape — real mouse grab from the HOT column bucket lands a flame on ' +
      target.L, after && after.heats === heatsBefore + 1, { before: heatsBefore, after: after && after.heats });
  }

  await viewport(VP_PORTRAIT);
  const bPortraitAfter = await buckets(), mPortraitAfter = await metricsNow();
  check('phaschrome: portrait metrics unchanged by the landscape excursion (bit-identical)',
    sameGeom(mPortraitBefore, mPortraitAfter), { mPortraitBefore, mPortraitAfter });
  check('phaschrome: portrait bucket rects unchanged by the landscape excursion (bit-identical)',
    JSON.stringify(bPortraitBefore) === JSON.stringify(bPortraitAfter), { bPortraitBefore, bPortraitAfter });

  // ---------- phaschrome: now-playing line at the very bottom of the screen ----------
  await load(0);
  const songTitle0 = await page.evaluate('SONGS[0].t');
  check('phaschrome: load(0) — nowPlaying shows track 01 with SONGS[0].t (' + songTitle0 + ')',
    (await g('G=>G.nowPlaying()')) === '01 · ' + songTitle0);
  await load(9);
  const songTitle1 = await page.evaluate('SONGS[1].t');
  check('phaschrome: load(9), block 1 — nowPlaying shows track 02 with SONGS[1].t (' + songTitle1 + ')',
    (await g('G=>G.nowPlaying()')) === '02 · ' + songTitle1);
  await load(79); // endless, 79%10=9 — double-digit now-playing (coverage the L9 per-block update lost)
  const songTitle9 = await page.evaluate('SONGS[9].t');
  check('phasaudio: load(79) endless (79%10=9) — nowPlaying pads to 10 with SONGS[9].t (' + songTitle9 + ')',
    (await g('G=>G.nowPlaying()')) === '10 · ' + songTitle9);

  // ---------- phasnames: endless entries (index 72+) carry no block word ----------
  const optsEndless = await page.evaluate('[...document.querySelectorAll("#lvlsel option")].map(o=>o.textContent)');
  const BLOCK_WORD_RE = /^\d+ · (Drag|Flame|Gravity|Frost|Vapor|Void|Hedge|Wind) · /;
  const badEndlessEntries = [];
  for (let idx = 72; idx < optsEndless.length; idx++) {
    const t = optsEndless[idx];
    if (!/^\d+ · \S/.test(t) || BLOCK_WORD_RE.test(t)) badEndlessEntries.push({ idx, got: t });
  }
  check('phasnames: endless entries (index 72+) are one line, unprefixed by a block word',
    optsEndless.length > 72 && badEndlessEntries.length === 0, badEndlessEntries.slice(0, 3));

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

  // ---------- phaslicense: LICENSE file, settings link, wiki footer ----------
  const licenseText = fs.readFileSync(path.join(repoRoot, 'games', 'phasic', 'LICENSE'), 'utf8');
  const licenseFirstLine = licenseText.split('\n')[0];
  check('phaslicense: LICENSE file exists, non-empty, first line names PHASIC',
    licenseText.length > 0 && licenseFirstLine.includes('PHASIC'), licenseFirstLine);

  const licHref = await page.evaluate('(function(){var el=document.getElementById("lic-btn");return el?el.getAttribute("href"):null;})()');
  check('phaslicense: settings overlay has a LICENSE link to LICENSE', licHref === 'LICENSE', licHref);

  await wp('location.hash = "#home"');
  await wpage.waitForTimeout(150);
  const footHome = await wp(`(function(){
    var el = document.getElementById('wiki-foot');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var a = el.querySelector('a');
    return { text: el.textContent, visible: el.offsetParent !== null && r.width > 0 && r.height > 0, href: a ? a.getAttribute('href') : null };
  })()`);
  check('phaslicense: wiki #home footer is present, visible, and reads "All rights reserved"',
    !!footHome && footHome.visible && /All rights reserved/i.test(footHome.text), footHome);

  await wp('location.hash = "#tactics"');
  await wpage.waitForTimeout(150);
  const footTactics = await wp(`(function(){
    var el = document.getElementById('wiki-foot');
    return el ? el.textContent : null;
  })()`);
  check('phaslicense: wiki footer still present after navigating to #tactics, same text',
    footTactics !== null && footTactics === footHome.text, { footHome: footHome && footHome.text, footTactics });

  check('phaslicense: wiki footer link href is LICENSE', !!footHome && footHome.href === 'LICENSE', footHome);

  await wpage.close();

  // ---------- phasbrand: icon files, head links, hub-first card, icon CSS ----------
  const iconSvgPath = path.join(repoRoot, 'games', 'phasic', 'icon.svg');
  const iconPngPath = path.join(repoRoot, 'games', 'phasic', 'icon-1024.png');
  const iconSvgStat = fs.existsSync(iconSvgPath) ? fs.statSync(iconSvgPath) : null;
  const iconPngStat = fs.existsSync(iconPngPath) ? fs.statSync(iconPngPath) : null;
  check('phasbrand: games/phasic/icon.svg exists and is non-empty',
    !!iconSvgStat && iconSvgStat.size > 0, iconSvgStat && iconSvgStat.size);
  check('phasbrand: games/phasic/icon-1024.png exists and is non-empty',
    !!iconPngStat && iconPngStat.size > 0, iconPngStat && iconPngStat.size);

  const iconSvgText = iconSvgStat ? fs.readFileSync(iconSvgPath, 'utf8') : '';
  check('phasbrand: icon.svg contains viewBox="0 0 512 512"',
    /viewBox="0 0 512 512"/.test(iconSvgText), iconSvgText.slice(0, 80));

  const pngMagic = iconPngStat ? fs.readFileSync(iconPngPath).subarray(0, 8) : Buffer.alloc(0);
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  check('phasbrand: icon-1024.png starts with the PNG magic bytes',
    pngMagic.equals(PNG_MAGIC), pngMagic.toString('hex'));

  const headLinks = await page.evaluate(() => {
    const svgLink = document.querySelector('head link[rel="icon"][type="image/svg+xml"]');
    const touchLink = document.querySelector('head link[rel="apple-touch-icon"]');
    return {
      svgHref: svgLink ? svgLink.getAttribute('href') : null,
      touchHref: touchLink ? touchLink.getAttribute('href') : null,
    };
  });
  check('phasbrand: game head has rel="icon" type="image/svg+xml" href="icon.svg"',
    headLinks.svgHref === 'icon.svg', headLinks);
  check('phasbrand: game head has rel="apple-touch-icon" href="icon-1024.png"',
    headLinks.touchHref === 'icon-1024.png', headLinks);

  const hubSrc = fs.readFileSync(HUB, 'utf8');
  const cssRuleMatch = hubSrc.match(/\.game-card\[href="phasic\/"\]\s*\.game-icon\s*\{([^}]*)\}/);
  const cssDecl = cssRuleMatch ? cssRuleMatch[1] : '';
  check('phasbrand: hub CSS has a .game-card[href="phasic/"] .game-icon rule with a phasic/icon.svg background and font-size: 0',
    !!cssRuleMatch && /background\s*:[^;]*phasic\/icon\.svg/.test(cssDecl) && /font-size\s*:\s*0\b/.test(cssDecl),
    cssRuleMatch ? cssDecl.trim() : null);

  const hubPage = await ctx.newPage();
  hubPage.on('pageerror', e => errors.push('pageerror(hub): ' + e.message));
  hubPage.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console(hub): ' + m.text()); });
  await hubPage.goto('file://' + HUB, { waitUntil: 'load', timeout: 20000 });
  await hubPage.waitForTimeout(300);

  const firstCard = await hubPage.evaluate(() => {
    const a = document.querySelector('a.game-card');
    if (!a) return null;
    const iconEl = a.querySelector('.game-icon');
    return { href: a.getAttribute('href'), iconText: iconEl ? iconEl.textContent : null };
  });
  check('phasbrand: hub grid\'s FIRST game-card links href="phasic/"',
    !!firstCard && firstCard.href === 'phasic/', firstCard);
  check('phasbrand: hub grid\'s first game-card icon div text is still 💠',
    !!firstCard && firstCard.iconText === '💠', firstCard);

  const iconStyle = await hubPage.evaluate(() => {
    const a = document.querySelector('a.game-card[href="phasic/"]');
    const el = a ? a.querySelector('.game-icon') : null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fontSize: cs.fontSize, backgroundImage: cs.backgroundImage };
  });
  check('phasbrand: live computed style — PHASIC card .game-icon fontSize is 0px',
    !!iconStyle && iconStyle.fontSize === '0px', iconStyle);
  check('phasbrand: live computed style — PHASIC card .game-icon backgroundImage is set (not none)',
    !!iconStyle && iconStyle.backgroundImage !== 'none', iconStyle);

  await hubPage.close();

  // ---------- phasdaily: daily challenge — determinism, persistence split, menu invariance ----------
  // DAILY_BASE=100000; dailyIdx()=DAILY_BASE+dayNum(); dateKey() derives from
  // the SAME pinned dayNum(), so setDay(n) (TEST-only) keeps both in lockstep
  // without depending on the wall clock. Every determinism probe reloads the
  // page first: genCache is a page-lifetime cache keyed by index, so a
  // same-page second click for the same day would just be served from cache
  // and prove nothing about the generator itself being deterministic — only
  // a fresh page (fresh genCache) followed by the same pinned day is a real
  // test. Reload points reuse the boot goto verbatim; the pageerror/console
  // listeners are bound to the `page` object once at the top of this file and
  // survive navigation, so no re-wiring is needed after a reload.
  const dailyDateKey = n => new Date(n * 86400000).toISOString().slice(0, 10);
  async function dailyReload() {
    await page.goto('file://' + GAME + '?test=1', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(400);
  }
  async function dailyClickBtn(id) {
    await page.evaluate('(function(){var el=document.getElementById("' + id + '");if(el)el.click();})()');
  }
  async function dailyWaitForLvl(target, maxMs) { // the daily generates+solves at click time
    const cap = maxMs || 60000, t0 = Date.now();     // (possibly several salts) — poll instead
    while (Date.now() - t0 < cap) {                  // of assuming a fixed wait is long enough
      if ((await st()).lvl === target) return true;
      await page.waitForTimeout(200);
    }
    return false;
  }
  function serializeBoard(mi) { // walls + gems + template + holes/bushes/fans, order-independent
    const s2 = arr => arr.map(x => JSON.stringify(x)).sort();
    return JSON.stringify({
      template: mi.template, walls: mi.walls,
      gems: s2(mi.gems.map(g2 => ({ L: g2.L, ax: g2.ax, ay: g2.ay, sax: g2.sax, say: g2.say, w: g2.w, h: g2.h, base: g2.base }))),
      holes: s2(mi.holes), bushes: s2(mi.bushes), fans: s2(mi.fans),
    });
  }

  // (a) determinism: reload -> pin day A -> DAILY -> capture; reload again ->
  // pin the SAME day A -> DAILY -> capture; the two boards must be identical.
  const DAY_A = 20000, DAY_B = 20001;
  await dailyReload();
  const DAILY_BASE_ = await page.evaluate('DAILY_BASE'); // read from the page, never hardcoded twice
  const idxA = DAILY_BASE_ + DAY_A, idxB = DAILY_BASE_ + DAY_B;

  await g('G=>G.setDay(' + DAY_A + ')');
  await dailyClickBtn('daily-btn');
  const gotA1 = await dailyWaitForLvl(idxA, 60000);
  const mi1 = await g('G=>G.mapInfo()');
  check('phasdaily determinism: pinned day ' + DAY_A + ' loads daily index ' + idxA + ' (run 1)',
    gotA1 && (await st()).lvl === idxA, await st());
  const serial1 = serializeBoard(mi1);

  await dailyReload(); // fresh genCache — an in-page second click would be served from cache
  await g('G=>G.setDay(' + DAY_A + ')');
  await dailyClickBtn('daily-btn');
  const gotA2 = await dailyWaitForLvl(idxA, 60000);
  const mi2 = await g('G=>G.mapInfo()');
  check('phasdaily determinism: pinned day ' + DAY_A + ' loads daily index ' + idxA + ' (run 2, fresh reload)',
    gotA2 && (await st()).lvl === idxA, await st());
  const serial2 = serializeBoard(mi2);

  check('phasdaily determinism: the same pinned day generates an identical board (walls+gems+template+' +
    'holes/bushes/fans) across two fresh page loads',
    gotA1 && gotA2 && serial1 === serial2, { equal: serial1 === serial2, serial1, serial2 });

  // (b) a different pinned day, after another reload, produces a different board.
  await dailyReload();
  await g('G=>G.setDay(' + DAY_B + ')');
  await dailyClickBtn('daily-btn');
  const gotB = await dailyWaitForLvl(idxB, 60000);
  const mi3 = await g('G=>G.mapInfo()');
  check('phasdaily determinism: pinned day ' + DAY_B + ' loads daily index ' + idxB,
    gotB && (await st()).lvl === idxB, await st());
  const serial3 = serializeBoard(mi3);
  check('phasdaily determinism: a different pinned day (' + DAY_B + ' vs ' + DAY_A + ') produces a board that ' +
    'differs from (a) in at least one field',
    gotB && serial3 !== serial1, { same: serial3 === serial1 });

  // (d) display: while the daily (day B) is loaded, the hint bar reads
  // "DAILY <dateKey> · <name>", not the "L<n> · " form.
  const dayBKey = dailyDateKey(DAY_B);
  const hintbarDaily = await page.evaluate('document.getElementById("hintbar").textContent');
  check('phasdaily display: hint bar starts "DAILY " and contains the pinned date key ' + dayBKey +
    ' while the daily is loaded', hintbarDaily.startsWith('DAILY ') && hintbarDaily.includes(dayBKey), hintbarDaily);

  // (c) persistence split: clear the loaded daily via the solver-grant path
  // (replayGen) and confirm the clear writes ONLY save.daily, never
  // save.done, and never touches the (frozen-in-daily-mode) #lvlsel list.
  const lvlselCountBefore = await page.evaluate('document.querySelectorAll("#lvlsel option").length');
  const saveBefore = await g('G=>G.save()');
  const doneLenBefore = saveBefore.done.length;
  const genInfoDaily = await g('G=>G.genInfo()');
  const replayOk = !!(genInfoDaily && genInfoDaily.hasScript) && await g('G=>G.replayGen()');
  check('phasdaily persistence: replayGen() (the solver-grant clear path) returns true for the pinned daily',
    replayOk, genInfoDaily);
  await page.waitForTimeout(900); // levelClear() fires off updateHome's 650ms clearPending timer
  const saveAfter = await g('G=>G.save()');
  const dailyKeys = Object.keys(saveAfter.daily || {});
  check('phasdaily persistence: save().daily has exactly the pinned date key ' + dayBKey + ' with a numeric t',
    dailyKeys.length === 1 && dailyKeys[0] === dayBKey && typeof (saveAfter.daily || {})[dayBKey].t === 'number',
    saveAfter.daily);
  check('phasdaily persistence: save().done.length is unchanged by the daily clear (' +
    doneLenBefore + ' -> ' + saveAfter.done.length + ')',
    saveAfter.done.length === doneLenBefore, { doneLenBefore, doneLenAfter: saveAfter.done.length });
  const lvlselCountDuring = await page.evaluate('document.querySelectorAll("#lvlsel option").length');
  check('phasdaily persistence: #lvlsel option count unchanged while the daily was open (' +
    lvlselCountBefore + ' -> ' + lvlselCountDuring + ')',
    lvlselCountDuring === lvlselCountBefore, { lvlselCountBefore, lvlselCountDuring });

  // (e) ✓ label + return: NEXT LEVEL from a daily clear goes back to the menu
  // (there is no "next daily"), not lvlIdx+1, and the DAILY button picks up
  // its ✓ suffix now that today's (pinned) daily is recorded.
  await dailyClickBtn('next-btn');
  const menuHiddenAfterNext = await page.evaluate('document.getElementById("menu").classList.contains("hide")');
  const dailyBtnText = await page.evaluate('document.getElementById("daily-btn").textContent');
  check('phasdaily return: NEXT LEVEL from a daily clear shows the menu (not .hide)',
    menuHiddenAfterNext === false, menuHiddenAfterNext);
  check('phasdaily return: the DAILY button label ends with the ✓ suffix after the clear',
    dailyBtnText.endsWith('✓'), dailyBtnText);

  // #lvlsel invariance: loading a normal level after the daily rebuilds the
  // list (buildLvlSel's daily-mode early-return no longer applies) — the
  // rebuilt count matches the pre-daily count from (c), proving the daily
  // excursion left no residue on the curriculum list.
  await load(3);
  const lvlselCountAfterNormal = await page.evaluate('document.querySelectorAll("#lvlsel option").length');
  check('phasdaily return: #lvlsel option count after returning and loading a normal level matches the ' +
    'pre-daily count (' + lvlselCountBefore + ' -> ' + lvlselCountAfterNormal + ')',
    lvlselCountAfterNormal === lvlselCountBefore, { lvlselCountBefore, lvlselCountAfterNormal });

  // leave no daily state behind for later checks: load(3) above already reset
  // dailyMode to false (same convention as every other section boundary in
  // this suite); release the day pin too so nothing downstream could ever
  // observe a stale pinned day.
  await g('G=>G.setDay(null)');

  // ---------- console errors ----------
  check('no console/page errors across the whole run', errors.length === 0, errors.slice(0, 6));

  await browser.close();
  console.log('PHASIC DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('PHASIC DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
