#!/usr/bin/env node
/**
 * drive-animation-rigs.cjs — rules suite for games/animation-rigs/.
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/drive-animation-rigs.cjs [--shots <dir>]
 *
 * Runs the simulation for several simulated minutes through the page's
 * window.__AR hook (deterministic steps, not wall time) and asserts the
 * invariants the scene is built on:
 *   - the rig: every limb bone keeps its length whenever no pose blend is
 *     running (IK may never stretch a bone), and no joint is ever NaN;
 *   - the button loop: someone climbs, presses, and the stairs turn into
 *     slides more than once; at most one figure is ever ON the ladder and at
 *     most two on the tower top;
 *   - the slides: nobody walks onto a flight while it is not stairs, and the
 *     slides never fold back while anyone is still sliding on them;
 *   - the floor: no walking figure ends up inside the structure or the tower
 *     at ground level, and no planted foot sinks below the surface.
 * --shots writes a few screenshots for eyeballing (not asserted).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'games', 'animation-rigs', 'index.html');
const shotDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;

let bad = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };

(async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  let browser;
  try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
  catch (e) {
    const alt = fs.readdirSync('/opt/pw-browsers').find(d => d.startsWith('chromium'));
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/' + alt + '/chrome-linux/chrome' });
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // font loads fail offline in the sandbox; a missing web font is not a page error
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => !!window.__AR);

  const R = await page.evaluate(() => {
    const A = window.__AR, chars = A.chars;
    const LEN = [[13, 14, 0.45], [14, 15, 0.44], [17, 18, 0.45], [18, 19, 0.44], [5, 6, 0.29], [6, 7, 0.26], [9, 10, 0.29], [10, 11, 0.26], [15, 16, 0.15], [19, 20, 0.15]];
    const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const r = { nan: 0, stretch: 0, worstStretch: 0, maxLadder: 0, maxTower: 0, onStairsWhileSlide: 0,
      foldWithRider: 0, inside: 0, sink: 0, worstSink: 0, climbs: 0, states: {}, presses: 0, slides: 0, sliders: 0 };
    let prevMode = A.ST.mode, wasClimb = new Set(), slid = new Set();
    const DT = 1 / 30, N = 30 * 300;
    for (let k = 0; k < N; k++) {
      A.step(DT, 1);
      const mode = A.ST.mode;
      let onLadder = 0, onTower = 0;
      for (const c of chars) {
        r.states[c.state] = (r.states[c.state] || 0) + 1;
        if (!c.out) continue;
        for (const p of c.out) if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) r.nan++;
        if (c.blendT >= c.blendDur + 0.05) for (const [a, b, L] of LEN) {
          const e = Math.abs(d3(c.out[a], c.out[b]) - L * c.s);
          if (e > 2e-3) { r.stretch++; r.worstStretch = Math.max(r.worstStretch, e); }
        }
        if (c.state === 'ladder') { onLadder++; if (!wasClimb.has(c.id)) { wasClimb.add(c.id); r.climbs++; } }
        else wasClimb.delete(c.id);
        if (c.onTower) onTower++;
        if (c.state === 'fall' || c.state === 'slide') slid.add(c.id);
        if (c.state === 'loco' && mode !== 'stairs' && prevMode !== 'stairs') {
          const s = A.stairAt(c.x, c.z, 0);
          if (s && s.d >= 0) r.onStairsWhileSlide++;
        }
        if (mode === 'toStairs' && prevMode === 'slide' && (c.state === 'fall' || c.state === 'slide') && c.sl.d > -0.05) r.foldWithRider++;
        if (c.state === 'loco' && A.pelvisBaseY(c.x, c.z) < 0.01) {
          for (const o of A.OBS) if (c.x > o.x0 + 0.05 && c.x < o.x1 - 0.05 && c.z > o.z0 + 0.05 && c.z < o.z1 - 0.05) r.inside++;
        }
        if (c.state === 'loco' && c.feet[0]) for (let i = 0; i < 2; i++) {
          const f = c.feet[i]; if (f.sw) continue;
          const a = c.out[i ? 19 : 15], fy = A.footY(a.x, a.z);
          const e = fy - (a.y - 0.08 * c.s);
          if (e > 0.03 && c.blendT >= c.blendDur + 0.05) { r.sink++; r.worstSink = Math.max(r.worstSink, e); }
        }
      }
      r.maxLadder = Math.max(r.maxLadder, onLadder);
      r.maxTower = Math.max(r.maxTower, onTower);
      prevMode = mode;
    }
    r.presses = A.ST.presses; r.slides = A.ST.slides; r.sliders = slid.size;
    return r;
  });

  console.log('animation-rigs: 300 simulated seconds, 8 figures');
  console.log('  states(frames): ' + JSON.stringify(R.states));
  ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  ok(R.nan === 0, 'no NaN joints (' + R.nan + ')');
  ok(R.stretch === 0, 'limb bones keep their length outside pose blends (' + R.stretch + ' violations, worst ' + R.worstStretch.toFixed(4) + ' m)');
  ok(R.climbs >= 4, 'figures climb the ladder repeatedly (' + R.climbs + ' climbs/descents)');
  ok(R.presses >= 3, 'the button gets pressed (' + R.presses + ')');
  ok(R.slides >= 2, 'the stairs turn into slides more than once (' + R.slides + ')');
  ok(R.sliders >= 1, 'someone actually rides a slide (' + R.sliders + ' figures)');
  ok(R.maxLadder <= 1, 'never more than one figure on the ladder (max ' + R.maxLadder + ')');
  ok(R.maxTower <= 2, 'never more than two on the tower top (max ' + R.maxTower + ')');
  ok(R.onStairsWhileSlide === 0, 'nobody walks onto a flight while it is a slide (' + R.onStairsWhileSlide + ')');
  ok(R.foldWithRider === 0, 'slides never fold back under a rider (' + R.foldWithRider + ')');
  ok(R.inside === 0, 'no walker inside the structure or tower at ground level (' + R.inside + ')');
  ok(R.sink === 0, 'planted feet never sink into the surface (' + R.sink + ', worst ' + R.worstSink.toFixed(3) + ' m)');

  // a press by the player while armed, and a refused one while not
  const P = await page.evaluate(() => {
    const A = window.__AR;
    let n = 0; while (A.ST.mode !== 'stairs' && n++ < 600) A.step(1 / 30, 1);
    const before = A.ST.slides; A.press(); const armed = A.ST.slides === before + 1;
    const mode1 = A.ST.mode; A.press(); const refused = A.ST.slides === before + 1;
    return { armed, refused, mode1 };
  });
  ok(P.armed, 'tapping the armed button turns the stairs into slides');
  ok(P.refused, 'a press while the slides are out does nothing (mode ' + P.mode1 + ')');

  // the same press through real input: a mouse tap on the pixel the button is drawn at
  await page.evaluate(() => { const A = window.__AR; let n = 0; while (A.ST.mode !== 'stairs' && n++ < 900) A.step(1 / 30, 1); });
  const T = await page.evaluate(() => { const A = window.__AR; return { s0: A.ST.slides, b: A.btnScreen(), mode: A.ST.mode }; });
  await page.mouse.click(T.b.x, T.b.y);
  const s1 = await page.evaluate(() => window.__AR.ST.slides);
  ok(T.mode === 'stairs' && s1 === T.s0 + 1, 'a tap on the drawn button presses it (' + T.s0 + ' -> ' + s1 + ')');

  if (shotDir) {
    fs.mkdirSync(shotDir, { recursive: true });
    for (let i = 0; i < 4; i++) {
      await page.evaluate((i) => { const A = window.__AR; A.step(1 / 30, 45 + i * 20); }, i);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(shotDir, 'shot' + i + '.png') });
    }
  }
  await browser.close();
  console.log(bad ? 'DRIVE animation-rigs: RED (' + bad + ')' : 'DRIVE animation-rigs: GREEN');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); console.log('DRIVE animation-rigs: RED'); process.exit(1); });
