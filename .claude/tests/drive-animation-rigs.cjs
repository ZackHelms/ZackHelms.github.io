#!/usr/bin/env node
/**
 * drive-animation-rigs.cjs — rules + version suite for games/animation-rigs/.
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/drive-animation-rigs.cjs [--shots <dir>] [--only <sections>]
 *
 * --only runs a comma-separated subset while iterating (rules, identity, snaps,
 * balance, shadows, physics, turns, ui), e.g. `--only identity,physics`; the gate runs
 * them all. Adding a version: copy the shipped page to fixtures/, put its id at
 * the front of VERS. Every version check below is derived from VERS.
 *
 * Every simulation section runs with a seeded Math.random and the page's own
 * requestAnimationFrame loop stubbed out, stepping through window.__AR, so a
 * run is reproducible and wall-clock load cannot change what is measured.
 * The newest version (NEW) is the one the CD sees by default.
 *
 *  1. RULES, under EVERY version (A005 default, A004 ... A001), 300 s each:
 *     no NaN joint; no limb bone stretched outside a pose blend (IK may never
 *     stretch a bone); someone climbs, presses and slides, repeatedly; <=1 on
 *     the ladder and <=2 on the tower; nobody walks onto a flight that is not
 *     stairs; slides never fold under a rider; no walker inside a block; and
 *     planted feet stay on the surface they are planted on. That last one is
 *     a RATE, not zero: a stance foot left out of reach at the top of a flight
 *     can still be pulled off it for a frame or two by the IK, so the bound is
 *     0.1% of planted-foot frames and 0.2 m. (Only feet whose figure finished
 *     its last pose blend count; ch.blendT keeps counting after a blend ends.)
 *  2. OLDER VERSIONS ARE FROZEN: each shipped version is kept as a fixture
 *     (.claude/tests/fixtures/animation-rigs-a00N.html, copied from the commit
 *     that shipped it) and today's page opened with ?v=A00N must produce the
 *     same joints, bit for bit, for 300 s, AND draw the same canvas, pixel for
 *     pixel, 90 times over it (the CD, 2026-10-05: each version keeps what it
 *     looked like; only the menus above the canvas are shared). This is what
 *     lets a new version be added without touching what the old ones show.
 *  3. SMOOTHNESS (NEW vs A001, same seed, 240 s at 60 Hz): a "snap" is a
 *     joint's frame-to-frame acceleration more than 3x its own recent average
 *     (and > 0.02 m/frame^2), i.e. an impulse rather than fast smooth motion.
 *     NEW must have at most 30% of A001's snaps overall, at most 20% in the
 *     legs, and no single snap above 0.35 m/frame^2 (A001's worst: ~1.6).
 *  4. GAIT + BALANCE (NEW), on the skeleton: on flat ground a walking step is
 *     a normal length at a normal cadence (A002 took 0.32 m steps at 2.3
 *     strides/s and looked frantic: the CD's 2026-10-05 report); trunk lean
 *     (pelvis->chest vs vertical) is slightly forward walking and never
 *     tipped back, clearly further forward up stairs, upright and steady
 *     standing; a side-to-side sway walking straight and a bigger one standing (weight
 *     shifts); a vertical bob walking.
 *  5. SHADOWS on the stairs follow the figure smoothly: a climber's head
 *     shadow moves more than twice as far as the head itself (+3 cm) between
 *     frames in under 0.2% of frames (projecting onto a flat plane at the
 *     tread height, the old renderer, jumps a step at every tread: ~3%). The
 *     relative form matters since A004: its runners take a flight faster, and
 *     a fixed 6 cm/frame bar started counting speed instead of snaps.
 *  6. PHYSICS (A004 on, run on the newest version; each check also run on A003 with the same seed, and required
 *     to fail there: a check that cannot see the old behaviour proves nothing):
 *     walking up stairs is not a squat (stance knee); the centre of mass rides
 *     over the upper foot, not behind it; running up a flight the lean is even
 *     from bottom to top (A003: 12 -> 26 -> 37 deg); starting to run leans
 *     further forward WHILE speeding up than at speed (A003 leaned less while
 *     accelerating, then most at speed); and the two corrective rules
 *     (a stance foot lifted early, the pelvis brought down to a leg out of
 *     reach) stay rare.
 *  7. TURNS (A005, each check also run on the version before it, with the same
 *     seed, and required to fail there): a turn starts and stops with the
 *     body's rotational inertia (A004 switched 0 -> 4 rad/s in one frame);
 *     the trunk never rolls past 20 deg and its roll rate stays a lean's, not
 *     a whip's (A004: 46 deg, 175 deg/s at the 99.9th percentile); the lean
 *     into a turn builds and fades over about a step; and the plan's root
 *     never jumps (A005's own guard: a slower turn swung figures into a rule
 *     that threw them out past the stair block's end).
 *  8. UI: the speed menu offers 4x/2x/1x/half/quarter defaulting to 1x and 4x
 *     really runs faster; the version menu lists newest first, defaults to
 *     it, switches the model live, and ?v= opens an older one; the button
 *     works through __AR and through a real tap on its drawn pixel; the page
 *     left to run on its own animation loop keeps every joint finite (a
 *     negative first frame step once made every A004 figure NaN); the follow
 *     menu offers none + the eight figures, defaults to none, flies in to the
 *     one picked and keeps it centred, zooms in closer than the overview may,
 *     keeps following through an orbit, follows a tapped figure, and "none"
 *     flies back to the overview.
 * --shots writes a few screenshots for eyeballing (not asserted).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = 'file://' + path.join(ROOT, 'games', 'animation-rigs', 'index.html');
const FIX = (v) => 'file://' + path.join(__dirname, 'fixtures', 'animation-rigs-' + v.toLowerCase() + '.html');
const VERS = ['A005', 'A004', 'A003', 'A002', 'A001'];   // newest first, as the page lists them
const NEW = VERS[0];
const VN = (v) => +v.slice(1);                      // 'A004' -> 4, the page's VER
const shotDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const want = (s) => !only || only.includes(s);

let bad = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };

async function launch() {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  try { return await chromium.launch(exe ? { executablePath: exe } : {}); }
  catch (e) {
    const alt = fs.readdirSync('/opt/pw-browsers').find(d => d.startsWith('chromium'));
    return chromium.launch({ executablePath: '/opt/pw-browsers/' + alt + '/chrome-linux/chrome' });
  }
}
// a deterministic page: seeded random, no rAF loop, optionally no timers
async function simPage(browser, url, seed, noTimers) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // font loads fail offline in the sandbox; a missing web font is not a page error
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(([sd, nt]) => {
    let s = sd >>> 0;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    window.requestAnimationFrame = () => 0;
    if (nt) window.setTimeout = () => 0;
  }, [seed, !!noTimers]);
  await page.goto(url);
  await page.waitForFunction(() => !!window.__AR);
  return { page, errs };
}

async function rules(browser, label, url) {
  const { page, errs } = await simPage(browser, url, 1234);
  const R = await page.evaluate(() => {
    const A = window.__AR, chars = A.chars;
    const LEN = [[13, 14, 0.45], [14, 15, 0.44], [17, 18, 0.45], [18, 19, 0.44], [5, 6, 0.29], [6, 7, 0.26], [9, 10, 0.29], [10, 11, 0.26], [15, 16, 0.15], [19, 20, 0.15]];
    const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const r = { nan: 0, stretch: 0, worstStretch: 0, maxLadder: 0, maxTower: 0, onStairsWhileSlide: 0,
      foldWithRider: 0, inside: 0, sink: 0, planted: 0, worstSink: 0, climbs: 0, states: {}, presses: 0, slides: 0, sliders: 0 };
    let prevMode = A.ST.mode;
    const wasClimb = new Set(), slid = new Set();
    for (let k = 0; k < 30 * 300; k++) {
      A.step(1 / 30, 1);
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
        if (c.state === 'loco' && c.feet[0] && c.blendT >= c.blendDur + 0.05) for (let i = 0; i < 2; i++) {
          const f = c.feet[i]; if (f.sw) continue;
          r.planted++;
          // against the surface the foot is planted on (sampling under the ankle instead
          // reads the NEXT tread whenever a heel lifts within a centimetre of a riser)
          const a = c.out[i ? 19 : 15], e = A.footY(f.plant.x, f.plant.z) - (a.y - 0.08 * c.s);
          if (e > 0.03) { r.sink++; r.worstSink = Math.max(r.worstSink, e); }
        }
      }
      r.maxLadder = Math.max(r.maxLadder, onLadder);
      r.maxTower = Math.max(r.maxTower, onTower);
      prevMode = mode;
    }
    r.presses = A.ST.presses; r.slides = A.ST.slides; r.sliders = slid.size;
    return r;
  });
  await page.close();
  console.log(label + ': 300 simulated seconds, 8 figures  states(frames) ' + JSON.stringify(R.states));
  ok(errs.length === 0, label + ' no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  ok(R.nan === 0, label + ' no NaN joints (' + R.nan + ')');
  ok(R.stretch === 0, label + ' limb bones keep their length outside pose blends (' + R.stretch + ', worst ' + R.worstStretch.toFixed(4) + ' m)');
  ok(R.climbs >= 4, label + ' figures climb the ladder repeatedly (' + R.climbs + ')');
  ok(R.presses >= 3, label + ' the button gets pressed (' + R.presses + ')');
  ok(R.slides >= 2, label + ' the stairs turn into slides more than once (' + R.slides + ')');
  ok(R.sliders >= 1, label + ' someone rides a slide (' + R.sliders + ' figures)');
  ok(R.maxLadder <= 1, label + ' never more than one on the ladder (max ' + R.maxLadder + ')');
  ok(R.maxTower <= 2, label + ' never more than two on the tower top (max ' + R.maxTower + ')');
  ok(R.onStairsWhileSlide === 0, label + ' nobody walks onto a flight while it is a slide (' + R.onStairsWhileSlide + ')');
  ok(R.foldWithRider === 0, label + ' slides never fold back under a rider (' + R.foldWithRider + ')');
  ok(R.inside === 0, label + ' no walker inside the structure or tower at ground level (' + R.inside + ')');
  ok(R.planted > 10000 && R.sink <= R.planted * 0.001 && R.worstSink < 0.2,
    label + ' planted feet stay on the surface (' + R.sink + ' of ' + R.planted + ' foot-frames, worst ' + R.worstSink.toFixed(3) + ' m)');
}

async function identity(browser, v) {
  const fx = FIX(v);
  if (!fs.existsSync(fx.replace('file://', ''))) { fail(v + ' fixture missing: ' + fx); return; }
  const run = async (url) => {
    const { page } = await simPage(browser, url, 777, true);
    const r = await page.evaluate(() => {
      const A = window.__AR, snaps = [], pix = [];
      // what the canvas shows: one FNV hash per pixel row of a fresh render
      const rows = () => {
        A.render();
        const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w = c.width * 4, out = [];
        for (let y = 0; y < c.height; y++) { let h = 2166136261; for (let i = y * w; i < (y + 1) * w; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } out.push(h >>> 0); }
        return out;
      };
      for (let k = 0; k < 9000; k++) {
        A.step(1 / 30, 1);
        if (k % 300 === 299) snaps.push(A.chars.map(c => c.out.map(p => [p.x, p.y, p.z])));
        if (k % 100 === 99) pix.push(rows());
      }
      return { snaps, pix, presses: A.ST.presses };
    });
    await page.close();
    return r;
  };
  const a = await run(fx), b = await run(PAGE + '?v=' + v);
  let maxd = 0, n = 0;
  for (let i = 0; i < a.snaps.length; i++) for (let j = 0; j < a.snaps[i].length; j++) for (let k = 0; k < 22; k++) for (let m = 0; m < 3; m++) {
    maxd = Math.max(maxd, Math.abs(a.snaps[i][j][k][m] - b.snaps[i][j][k][m])); n++;
  }
  ok(a.snaps.length === 30 && n > 0 && maxd === 0 && a.presses === b.presses,
    v + ' selection reproduces the shipped ' + v + ' bit for bit (' + n + ' coordinates over 300 s, max diff ' + maxd + ', presses ' + a.presses + '/' + b.presses + ')');
  // and it LOOKS as it shipped: the canvas, pixel for pixel (only the menus above it are shared)
  let rowsN = 0, rowsBad = 0, shotsBad = 0;
  for (let i = 0; i < a.pix.length; i++) {
    let badHere = 0;
    for (let y = 0; y < a.pix[i].length; y++) { rowsN++; if (a.pix[i][y] !== b.pix[i][y]) badHere++; }
    if (badHere || a.pix[i].length !== b.pix[i].length) shotsBad++;
    rowsBad += badHere;
  }
  ok(a.pix.length === 90 && rowsN > 0 && shotsBad === 0,
    v + ' selection draws exactly what the shipped ' + v + ' drew (90 renders over 300 s; ' + shotsBad + ' differ, ' + rowsBad + ' of ' + rowsN + ' pixel rows)');
}

async function snaps(browser, url) {
  const { page } = await simPage(browser, url, 12345);
  const r = await page.evaluate(() => {
    const A = window.__AR, H = new Map(), LEG = new Set([13, 14, 15, 16, 17, 18, 19, 20]);
    let tot = 0, legs = 0, frames = 0, max = 0;
    for (let k = 0; k < 60 * 240; k++) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        const key = c.state + (c.state === 'ladder' ? ':' + c.lad.sub : '');
        let h = H.get(c.id);
        if (!h || h.key !== key) { h = { key, P: [], acc: [] }; H.set(c.id, h); }
        h.P.push(c.out.slice(0, 21).map(p => [p.x, p.y, p.z])); if (h.P.length > 3) h.P.shift();
        if (h.P.length < 3) continue;
        frames++;
        const [a, b, d] = h.P, cur = [];
        for (let j = 0; j < 21; j++) cur.push(Math.hypot(d[j][0] - 2 * b[j][0] + a[j][0], d[j][1] - 2 * b[j][1] + a[j][1], d[j][2] - 2 * b[j][2] + a[j][2]));
        if (h.acc.length >= 4) for (let j = 0; j < 21; j++) {
          let m = 0; for (const q of h.acc) m += q[j]; m /= h.acc.length;
          if (cur[j] > 0.02 && cur[j] > 3 * m + 0.006) { tot++; if (LEG.has(j)) legs++; max = Math.max(max, cur[j]); }
        }
        h.acc.push(cur); if (h.acc.length > 4) h.acc.shift();
      }
    }
    return { tot, legs, frames, max, per1000: 1000 * tot / frames };
  });
  await page.close();
  return r;
}

async function balance(browser) {
  const { page } = await simPage(browser, PAGE, 12345);
  const r = await page.evaluate(() => {
    const A = window.__AR, cat = {}, ema = {}, last = {};
    const add = (k, v) => { (cat[k] = cat[k] || []).push(v); };
    for (let k = 0; k < 60 * 240; k++) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        if (c.state !== 'loco' || !c.out) continue;
        const J = c.out, fw = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) }, rt = { x: -Math.sin(c.yaw), z: Math.cos(c.yaw) };
        const dx = J[2].x - J[0].x, dy = J[2].y - J[0].y, dz = J[2].z - J[0].z;
        const lean = Math.atan2(dx * fw.x + dz * fw.z, dy) * 180 / Math.PI;
        const sa = A.stairAt(c.x, c.z, 0); let key = null;
        if (sa && c.spd > 0.3 && c.runAmt < 0.3 && sa.st.up * fw.x > 0.3) key = 'up';
        else if (!sa && A.pelvisBaseY(c.x, c.z) < 0.01) key = c.spd < 0.05 ? 'idle' : c.runAmt > 0.7 && c.spd > 2.5 ? 'run' : c.spd > 1.1 && c.runAmt < 0.3 ? 'walk' : null;
        if (!key) continue;
        add(key + ':lean', lean);
        // sway is the gait's own side to side, so it is sampled walking STRAIGHT: the lean into a turn
        // is checked in TURNS (A005's longer, milder turn leans otherwise filled the 95th percentile)
        if (Math.abs(c.yawRate) < 0.15) add(key + ':lat', ((J[0].x - c.x) * rt.x + (J[0].z - c.z) * rt.z) * 100);
        // bob: the pelvis against its own 1 s running average over an unbroken walk, so
        // figure height and speed changes drop out and only the per-step rise and fall is left
        const w = ema[c.id] && ema[c.id].k === k - 1 ? ema[c.id] : { e: J[0].y, t: 0 };
        w.e += (J[0].y - w.e) * (1 - Math.exp(-1 / 60)); w.t += 1 / 60; w.k = k; ema[c.id] = key === 'walk' ? w : null;
        if (key === 'walk' && w.t > 1.5) add('walk:bob', (J[0].y - w.e) * 100);
        // gait on flat ground: each landing's step length (ahead of the other foot) and stride rate
        if (key === 'walk') for (let i = 0; i < 2; i++) {
          const ft = c.feet[i], id = c.id + '_' + i, L = last[id];
          if (L && L.sw && !ft.sw) {
            const o = c.feet[1 - i].plant;
            add('walk:step', (ft.plant.x - o.x) * fw.x + (ft.plant.z - o.z) * fw.z);
            if (L.land != null && k - L.land < 120) add('walk:strides', 60 / (k - L.land));
          }
          last[id] = { sw: ft.sw, land: L && L.sw && !ft.sw ? k : (L ? L.land : null) };
        }
      }
    }
    const o = {};
    for (const k in cat) {
      const a = cat[k].slice().sort((x, y) => x - y), n = a.length;
      o[k] = { n, mean: a.reduce((x, y) => x + y, 0) / n, p5: a[Math.floor(n * 0.05)], p95: a[Math.floor(n * 0.95)] };
    }
    return o;
  });
  await page.close();
  const g = (k) => r[k] || { n: 0, mean: NaN, p5: NaN, p95: NaN };
  const f = (x) => (+x).toFixed(1);
  const walk = g('walk:lean'), up = g('up:lean'), idle = g('idle:lean'), run = g('run:lean');
  const st = g('walk:step'), sr = g('walk:strides');
  ok(st.n > 300 && st.mean > 0.55 && st.mean < 0.85, NEW + ' walking steps are a normal length (mean ' + st.mean.toFixed(2) + ' m; A002 took 0.32 m)');
  ok(sr.n > 300 && sr.mean > 0.75 && sr.mean < 1.2, NEW + ' walking stride rate is a normal cadence (' + sr.mean.toFixed(2) + ' strides/s; A002 ran 2.3)');
  ok(walk.n > 2000 && walk.mean > 2 && walk.mean < 9 && walk.p5 > -2, NEW + ' walking leans slightly forward and never tips back (mean ' + f(walk.mean) + ', 5th pct ' + f(walk.p5) + ' deg)');
  ok(up.n > 2000 && up.mean > 12 && up.mean > walk.mean + 8, NEW + ' climbing stairs leans clearly further forward (mean ' + f(up.mean) + ' deg vs walking ' + f(walk.mean) + ')');
  ok(run.n > 500 && run.mean > 5 && run.mean < 22, NEW + ' running leans forward within a runner\'s range (mean ' + f(run.mean) + ' deg)');
  ok(idle.n > 2000 && Math.abs(idle.mean) < 4 && idle.p95 - idle.p5 < 12, NEW + ' standing is upright and steady (mean ' + f(idle.mean) + ', spread ' + f(idle.p95 - idle.p5) + ' deg)');
  const wl = g('walk:lat'), il = g('idle:lat'), wp = g('walk:bob');
  ok(wl.p95 - wl.p5 > 2 && wl.p95 - wl.p5 < 9, NEW + ' walking sways side to side (' + f(wl.p95 - wl.p5) + ' cm, 5th-95th pct)');
  ok(il.p95 - il.p5 > 6, NEW + ' standing figures shift their weight leg to leg (' + f(il.p95 - il.p5) + ' cm)');
  ok(wp.p95 - wp.p5 > 2 && wp.p95 - wp.p5 < 8, NEW + ' the pelvis rises and falls when walking (' + f(wp.p95 - wp.p5) + ' cm, 5th-95th pct)');
}

async function shadows(browser) {
  const { page } = await simPage(browser, PAGE, 12345);
  const r = await page.evaluate(() => {
    const A = window.__AR, L = { x: 0.42, y: 0.85, z: 0.32 }, n = Math.hypot(L.x, L.y, L.z);
    L.x /= n; L.y /= n; L.z /= n;
    const H = new Map(), d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    let frames = 0, bigNew = 0, bigOld = 0;
    for (let k = 0; k < 60 * 240; k++) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        if (c.state !== 'loco' || !A.stairAt(c.x, c.z, 0)) { H.delete(c.id); continue; }
        const P = c.out[4], lvl = A.footY(c.x, c.z), kk = (P.y - lvl) / L.y;
        const old = { x: P.x - L.x * kk, y: lvl, z: P.z - L.z * kk }, nw = A.shadowHit(P, lvl - 0.6);
        if (!nw) { H.delete(c.id); continue; }
        const h = H.get(c.id);
        // a jump is a shadow that moves much further than the head casting it (a fast runner's
        // shadow legitimately covers 6 cm a frame going down a flight; a snap does it standing still)
        if (h) { frames++; const lim = 2 * d(h[2], P) + 0.03; if (d(h[0], old) > lim) bigOld++; if (d(h[1], nw) > lim) bigNew++; }
        H.set(c.id, [old, nw, { x: P.x, y: P.y, z: P.z }]);
      }
    }
    return { frames, bigNew, bigOld };
  });
  await page.close();
  ok(r.frames > 3000 && r.bigNew < r.frames * 0.002 && r.bigOld > r.frames * 0.01,
    'a stair climber\'s shadow follows smoothly (' + r.bigNew + ' jumps of more than twice its head\'s move + 3 cm in ' + r.frames + ' frames; a flat plane at the tread height would jump ' + r.bigOld + ' times)');
}

// A004's physics, measured on the skeleton, against A003 on the same seed (each claim must
// separate the two, or it is not evidence of anything)
async function physicsRun(browser, url) {
  const { page } = await simPage(browser, url, 12345);
  const r = await page.evaluate(() => {
    const A = window.__AR, cat = {}, st = {};
    const add = (k, v) => { (cat[k] = cat[k] || []).push(v); };
    const knee = (a, b, c) => { const u = [a.x - b.x, a.y - b.y, a.z - b.z], v = [c.x - b.x, c.y - b.y, c.z - b.z];
      return 180 - Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)))) * 180 / Math.PI; };
    for (let k = 0; k < 60 * 240; k++) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        const S = st[c.id] || (st[c.id] = { ps: c.spd });
        const acc = c.acc != null ? c.acc : (c.spd - S.ps) * 60; S.ps = c.spd;   // A004 plans it; A003 has only the speed
        if (c.state !== 'loco') continue;
        const J = c.out, fw = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) };
        const lean = Math.atan2((J[2].x - J[0].x) * fw.x + (J[2].z - J[0].z) * fw.z, J[2].y - J[0].y) * 180 / Math.PI;
        const sa = A.stairAt(c.x, c.z, 0), flat = !sa && A.pelvisBaseY(c.x, c.z) < 0.01;
        if (flat && c.runAmt > 0.7) {
          if (acc > 1) add('accel', lean);
          else if (Math.abs(acc) < 0.2 && c.spd > 3) add('steady', lean);
        }
        if (sa && sa.st.up * fw.x > 0.3) {
          const gait = c.runAmt > 0.7 && c.spd > 1.5 ? 'run' : c.runAmt < 0.3 && c.spd > 0.5 ? 'walk' : null;
          if (!gait) continue;
          if (gait === 'run') add('run' + (sa.d < 1.83 ? 1 : sa.d < 3.67 ? 2 : 3), lean);
          let up = null, ui = 0;
          for (let i = 0; i < 2; i++) { const f = c.feet[i]; if (f.sw) continue; if (!up || f.plant.y > up.y) { up = f.plant; ui = i; } }
          if (gait === 'walk' && up) {
            add('knee', knee(J[ui ? 17 : 13], J[ui ? 18 : 14], J[ui ? 19 : 15]));
            const C = A.comOf(J); add('com', ((C.x - up.x) * fw.x + (C.z - up.z) * fw.z) * 100);
          }
        }
      }
    }
    const o = {};
    for (const k in cat) { const a = cat[k].slice().sort((x, y) => x - y), n = a.length; o[k] = { n, mean: a.reduce((x, y) => x + y, 0) / n, p5: a[Math.floor(n * 0.05)] }; }
    let lifts = 0, early = 0, reach = 0;
    for (const c of A.chars) if (c.ph) { lifts += c.ph.nLift; early += c.ph.nEarly; reach += c.ph.nReach; }
    o.counts = { lifts, early, reach };
    return o;
  });
  await page.close();
  return r;
}
async function physics(browser) {
  const a = await physicsRun(browser, PAGE), b = await physicsRun(browser, PAGE + '?v=A003');
  const g = (r, k) => r[k] || { n: 0, mean: NaN, p5: NaN };
  const f = (x) => (+x).toFixed(1);
  const kn = g(a, 'knee'), kb = g(b, 'knee');
  ok(kn.n > 2000 && kn.mean < 65 && kb.mean > 75, NEW + ' walking up stairs is not a squat: loaded knee ' + f(kn.mean) + ' deg (A003 ' + f(kb.mean) + ')');
  const cn = g(a, 'com'), cb = g(b, 'com');
  // over the foot: from just behind the ankle to the ball of the foot (the toe is 15 cm ahead of the
  // ankle). Where in that range depends on the tread phase a figure steps onto the flight with
  // (A004 +1.5, A005 ~+6); A003's -10 is behind the heel.
  ok(cn.n > 2000 && cn.mean > -4 && cn.mean < 12 && cb.mean < -8, NEW + ' climbing, the centre of mass rides over the upper foot: ' + f(cn.mean) + ' cm ahead of its ankle (A003 ' + f(cb.mean) + ', behind it)');
  const r1 = g(a, 'run1'), r3 = g(a, 'run3'), q1 = g(b, 'run1'), q3 = g(b, 'run3');
  ok(r1.n > 200 && r3.n > 200 && Math.abs(r3.mean - r1.mean) < 8 && r1.mean > 8 && q3.mean - q1.mean > 12,
    NEW + ' running up a flight the lean is even: ' + f(r1.mean) + ' -> ' + f(r3.mean) + ' deg bottom to top third (A003 ' + f(q1.mean) + ' -> ' + f(q3.mean) + ')');
  const ac = g(a, 'accel'), sd = g(a, 'steady'), bc = g(b, 'accel'), bs = g(b, 'steady');
  ok(ac.n > 200 && sd.n > 500 && ac.mean > sd.mean + 3 && !(bc.mean > bs.mean + 3),
    NEW + ' a runner leans further forward while speeding up than at speed: ' + f(ac.mean) + ' vs ' + f(sd.mean) + ' deg (A003 ' + f(bc.mean) + ' vs ' + f(bs.mean) + ')');
  const c = a.counts;
  ok(c.lifts > 1000 && c.early < c.lifts * 0.03 && c.reach < c.lifts * 0.05,
    NEW + ' corrective rules stay rare: ' + c.early + ' early lifts and ' + c.reach + ' reach corrections in ' + c.lifts + ' steps');
}

async function turnRun(browser, url) {
  const { page } = await simPage(browser, url, 12345);
  const r = await page.evaluate(() => {
    const A = window.__AR, last = {}, ya = [], rr = [], lr = [], roll = [];
    let jumps = 0;
    for (let k = 0; k < 60 * 240; k++) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        const J = c.out, L = last[c.id];
        if (c.state !== 'loco' || !J) { last[c.id] = null; continue; }
        const rt = { x: -Math.sin(c.yaw), z: Math.cos(c.yaw) }, C = A.comOf(J);
        const my = (J[15].y + J[19].y) / 2;
        const tr = Math.atan2((J[3].x - J[0].x) * rt.x + (J[3].z - J[0].z) * rt.z, J[3].y - J[0].y) * 180 / Math.PI;
        const ln = Math.atan2((C.x - c.x) * rt.x + (C.z - c.z) * rt.z, C.y - my) * 180 / Math.PI;
        const N = { x: c.x, z: c.z, w: c.yawRate, tr, ln };
        last[c.id] = N;
        if (!L) continue;
        if (Math.hypot(N.x - L.x, N.z - L.z) > 0.07) jumps++;
        ya.push(Math.abs(N.w - L.w) * 60); rr.push(Math.abs(N.tr - L.tr) * 60); lr.push(Math.abs(N.ln - L.ln) * 60); roll.push(Math.abs(tr));
      }
    }
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    return { n: ya.length, yaMax: q(ya, 1), rollMax: q(roll, 1), rr999: q(rr, 0.999), lr999: q(lr, 0.999), jumps };
  });
  await page.close();
  return r;
}
async function turns(browser) {
  const PREV = VERS[1];
  const a = await turnRun(browser, PAGE), b = await turnRun(browser, PAGE + '?v=' + PREV);
  const f = (x) => (+x).toFixed(1);
  ok(a.n > 50000 && a.yaMax < 30 && b.yaMax > 100,
    NEW + ' turns start and stop with the body\'s rotational inertia: yaw acceleration at most ' + f(a.yaMax) + ' rad/s^2 (' + PREV + ' ' + f(b.yaMax) + ')');
  ok(a.rollMax < 20 && a.rr999 < 60 && (b.rollMax > 30 || b.rr999 > 100),
    NEW + ' the trunk rolls into a turn, never whips: at most ' + f(a.rollMax) + ' deg, 99.9th pct ' + f(a.rr999) + ' deg/s (' + PREV + ' ' + f(b.rollMax) + ' deg, ' + f(b.rr999) + ' deg/s)');
  ok(a.lr999 < 75 && b.lr999 > 100,
    NEW + ' the lean into a turn builds over about a step: 99.9th pct ' + f(a.lr999) + ' deg/s (' + PREV + ' ' + f(b.lr999) + ')');
  ok(a.jumps === 0, NEW + ' the plan\'s root never jumps more than 7 cm in a frame (' + a.jumps + '; ' + PREV + ' ' + b.jumps + ')');
}

async function ui(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(PAGE);
  await page.waitForFunction(() => !!window.__AR);
  const S = await page.evaluate(() => ({
    speeds: [...document.querySelectorAll('#speed-sel option')].map(o => o.textContent),
    speed: document.getElementById('speed-sel').selectedOptions[0].textContent,
    vers: [...document.querySelectorAll('#ver-sel option')].map(o => o.textContent),
    ver: document.getElementById('ver-sel').selectedOptions[0].textContent, VER: window.__AR.VER,
  }));
  ok(JSON.stringify(S.speeds) === JSON.stringify(['4×', '2×', '1×', '½×', '¼×']) && S.speed === '1×',
    'speed menu offers 4x 2x 1x half quarter, default 1x (' + S.speeds.join(' ') + ', default ' + S.speed + ')');
  ok(JSON.stringify(S.vers) === JSON.stringify(VERS) && S.ver === NEW && S.VER === VN(NEW),
    'version menu lists newest first and defaults to it (' + S.vers.join(' ') + ', default ' + S.ver + ')');
  const rate = async (v) => {
    await page.selectOption('#speed-sel', v);
    const t0 = await page.evaluate(() => [window.__AR.simT, performance.now()]);
    await page.waitForTimeout(1200);
    const t1 = await page.evaluate(() => [window.__AR.simT, performance.now()]);
    return (t1[0] - t0[0]) / ((t1[1] - t0[1]) / 1000);
  };
  const r1 = await rate('1'), r4 = await rate('4'), rq = await rate('0.25');
  ok(r4 > r1 * 2.5 && rq < r1 * 0.5, 'speed menu changes simulated time per real second (1x ' + r1.toFixed(2) + ', 4x ' + r4.toFixed(2) + ', quarter ' + rq.toFixed(2) + ')');
  await page.selectOption('#speed-sel', '1');
  const got = [], order = VERS.slice().reverse();
  for (const v of order) { await page.selectOption('#ver-sel', String(VN(v))); got.push(await page.evaluate(() => window.__AR.VER)); }
  ok(got.join() === order.map(VN).join(), 'version menu switches the animation model live (' + order.join('/') + ' -> ' + got.join('/') + ')');
  for (const [v, n] of VERS.slice(1).map(v => [v, VN(v)])) {
    const q = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await q.goto(PAGE + '?v=' + v); await q.waitForFunction(() => !!window.__AR);
    const qv = await q.evaluate(() => [window.__AR.VER, document.getElementById('ver-sel').selectedOptions[0].textContent]);
    await q.close();
    ok(qv[0] === n && qv[1] === v, '?v=' + v + ' opens on ' + v + ' (' + qv.join(' ') + ')');
  }

  // the button: through the hook while armed, refused while not, and through a real tap
  const P = await page.evaluate(() => {
    const A = window.__AR;
    let n = 0; while (A.ST.mode !== 'stairs' && n++ < 900) A.step(1 / 30, 1);
    const before = A.ST.slides; A.press(); const armed = A.ST.slides === before + 1;
    const mode1 = A.ST.mode; A.press(); const refused = A.ST.slides === before + 1;
    return { armed, refused, mode1 };
  });
  ok(P.armed, 'pressing the armed button turns the stairs into slides');
  ok(P.refused, 'a press while the slides are out does nothing (mode ' + P.mode1 + ')');
  await page.evaluate(() => { const A = window.__AR; let n = 0; while (A.ST.mode !== 'stairs' && n++ < 900) A.step(1 / 30, 1); });
  const T = await page.evaluate(() => { const A = window.__AR; return { s0: A.ST.slides, b: A.btnScreen(), mode: A.ST.mode }; });
  await page.mouse.click(T.b.x, T.b.y);
  const s1 = await page.evaluate(() => window.__AR.ST.slides);
  ok(T.mode === 'stairs' && s1 === T.s0 + 1, 'a tap on the drawn button presses it (' + T.s0 + ' -> ' + s1 + ')');

  // the page on its own animation loop, every version: every joint stays finite
  for (const v of VERS) {
    const q = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await q.goto(PAGE + '?v=' + v); await q.waitForFunction(() => !!window.__AR);
    await q.waitForTimeout(700);
    const nan = await q.evaluate(() => window.__AR.chars.filter(c => !c.out || c.out.some(p => !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))).length);
    await q.close();
    ok(nan === 0, v + ' running live, every figure stays finite (' + nan + ' of 8 NaN)');
  }

  // FOLLOW: shared camera menu
  const F0 = await page.evaluate(() => ({ opts: [...document.querySelectorAll('#follow-sel option')].map(o => o.textContent),
    sel: document.getElementById('follow-sel').value, f: window.__AR.follow, d: window.__AR.cam.dist }));
  ok(F0.opts.length === 9 && F0.opts[0] === 'follow: none' && F0.sel === 'none' && F0.f === null,
    'follow menu offers none + 8 figures, defaults to none (' + F0.opts.join(', ') + ')');
  await page.selectOption('#follow-sel', '5');
  await page.waitForTimeout(2500);
  const centred = () => page.evaluate(() => { const A = window.__AR, p = A.follow.out[0], c = A.cam; return { id: A.follow.id, off: Math.hypot(c.tx - p.x, c.tz - p.z), dist: c.dist, yaw: c.yaw }; });
  const F1 = await centred();
  ok(F1.id === 5 && F1.off < 0.3 && F1.dist < 6.5, 'picking a figure follows it and flies in (figure ' + F1.id + ', ' + F1.off.toFixed(2) + ' m off centre, ' + F1.dist.toFixed(1) + ' m away)');
  await page.mouse.move(195, 600);
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -220); await page.waitForTimeout(25); }
  await page.mouse.down(); await page.mouse.move(275, 590, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(600);
  const F2 = await centred();
  ok(F2.id === 5 && F2.dist < 2 && Math.abs(F2.yaw - F1.yaw) > 0.3 && F2.off < 0.3,
    'while following, zoom reaches in close and orbit goes round the figure (' + F2.dist.toFixed(2) + ' m, yaw moved ' + Math.abs(F2.yaw - F1.yaw).toFixed(2) + ' rad, ' + F2.off.toFixed(2) + ' m off centre)');
  await page.selectOption('#follow-sel', 'none');
  await page.waitForTimeout(3500);
  const F3 = await page.evaluate(() => ({ f: window.__AR.follow, d: window.__AR.cam.dist, sel: document.getElementById('follow-sel').value }));
  ok(F3.f === null && F3.sel === 'none' && Math.abs(F3.d - F0.d) < 0.5, '"none" stops following and flies back to the overview (' + F3.d.toFixed(1) + ' m, was ' + F0.d.toFixed(1) + ')');
  const tp = await page.evaluate(() => { const A = window.__AR; let best = null; for (let i = 0; i < 8; i++) { const s = A.charScreen(i); if (s.z > 1 && s.x > 30 && s.x < 360 && s.y > 120 && s.y < 800 && (!best || s.z < best.z)) best = { ...s, i }; } return best; });
  if (tp) { await page.evaluate(() => { window.__tapT = performance.now(); }); }
  const tapped = tp ? await (async () => { const s = await page.evaluate((i) => window.__AR.charScreen(i), tp.i); await page.mouse.click(s.x, s.y); return page.evaluate(() => [window.__AR.follow && window.__AR.follow.id, document.getElementById('follow-sel').value]); })() : null;
  ok(tp && tapped[0] === tp.i && tapped[1] === String(tp.i), 'a tap on a figure follows it and the menu shows it (' + (tapped ? tapped.join(' / ') : 'no figure on screen') + ')');

  if (shotDir) {
    fs.mkdirSync(shotDir, { recursive: true });
    for (let i = 0; i < 4; i++) {
      await page.evaluate((i) => { window.__AR.step(1 / 30, 45 + i * 20); }, i);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(shotDir, 'shot' + i + '.png') });
    }
  }
  await page.close();
}

(async () => {
  const browser = await launch();
  if (want('rules')) for (const v of VERS) await rules(browser, v, v === NEW ? PAGE : PAGE + '?v=' + v);
  if (want('identity')) for (const v of VERS.slice(1)) await identity(browser, v);
  if (want('snaps')) {
  const s1 = await snaps(browser, PAGE + '?v=A001'), s2 = await snaps(browser, PAGE);
  console.log('snaps per 1000 figure-frames: A001 ' + s1.per1000.toFixed(1) + ' (legs ' + s1.legs + ', worst ' + s1.max.toFixed(3) + ')  ' + NEW + ' ' + s2.per1000.toFixed(1) + ' (legs ' + s2.legs + ', worst ' + s2.max.toFixed(3) + ')');
  ok(s1.tot > 1000, 'the snap metric sees A001\'s snapping (' + s1.tot + ' events) - a metric that cannot see the old bug proves nothing');
  ok(s2.per1000 <= s1.per1000 * 0.3, NEW + ' has at most 30% of A001\'s snaps (' + (100 * s2.per1000 / s1.per1000).toFixed(0) + '%)');
  ok(s2.legs <= s1.legs * 0.2, NEW + ' legs have at most 20% of A001\'s snaps (' + (100 * s2.legs / s1.legs).toFixed(0) + '%)');
  ok(s2.max < 0.35, NEW + ' worst single snap under 0.35 m/frame^2 (' + s2.max.toFixed(3) + ', A001 ' + s1.max.toFixed(3) + ')');
  }
  if (want('balance')) await balance(browser);
  if (want('shadows')) await shadows(browser);
  if (want('physics')) await physics(browser);
  if (want('turns')) await turns(browser);
  if (want('ui')) await ui(browser);
  await browser.close();
  console.log((bad ? 'DRIVE animation-rigs: RED (' + bad + ')' : 'DRIVE animation-rigs: GREEN') + (only ? ' (only ' + only.join(',') + ')' : ''));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); console.log('DRIVE animation-rigs: RED'); process.exit(1); });
