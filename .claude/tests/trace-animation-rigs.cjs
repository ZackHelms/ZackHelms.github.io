#!/usr/bin/env node
/**
 * trace-animation-rigs.cjs - diagnostic probe for games/animation-rigs/ (not a gate).
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/trace-animation-rigs.cjs <mode> [--v A005] [--seed 12345] [--secs 300]
 *
 * Modes (same seeded Math.random + stubbed rAF as the drive suite, 1/60 s steps):
 *   trace <id> <from> <to>  one figure, one line per frame between simulated times
 *                           <from> and <to>: root x z, speed, plan accel, turn rate,
 *                           yaw (deg), COM offset from the root sideways / forward (cm),
 *                           trunk roll (deg), feet (S swing / p planted), the current
 *                           step and its waypoints, run flag, target speed.
 *   tilt                    the six fastest sideways tilts (whole-body COM lean, deg/s)
 *                           with the turn rate and lean over the 0.5 s before each.
 *   jumps                   every frame the plan's root moved more than 7 cm.
 *
 * Why it exists: the A005 turn fix was diagnosed with exactly these three views,
 * hand-written as scratch probes (a scratch copy of the suite loses __dirname).
 * Find an event with `tilt` or `jumps`, then read it frame by frame with `trace`.
 * Output is plain lines for reading, not a pass/fail gate.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PAGE = 'file://' + path.join(path.resolve(__dirname, '..', '..'), 'games', 'animation-rigs', 'index.html');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const mode = argv[0];
if (!['trace', 'tilt', 'jumps'].includes(mode)) {
  console.log('usage: trace-animation-rigs.cjs trace <id> <from> <to> | tilt | jumps  [--v A005] [--seed 12345] [--secs 300]');
  process.exit(2);
}
const ver = opt('v', ''), seed = +opt('seed', 12345), secs = +opt('secs', 300);
const args = mode === 'trace' ? { id: +argv[1], from: +argv[2], to: +argv[3] } : {};

(async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => console.log('PAGE-ERROR ' + e));
  await page.addInitScript((sd) => {
    let s = sd >>> 0;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    window.requestAnimationFrame = () => 0;
  }, seed);
  await page.goto(PAGE + (ver ? '?v=' + ver : ''));
  await page.waitForFunction(() => !!window.__AR);
  const out = await page.evaluate(([mode, a, secs]) => {
    const A = window.__AR, L = [], hist = {}, last = {}, ev = [];
    const end = mode === 'trace' ? a.to : secs;
    const f = (x, n) => (+x).toFixed(n);
    while (A.simT < end) {
      A.step(1 / 60, 1);
      for (const c of A.chars) {
        if (mode === 'trace' && c.id !== a.id) continue;
        if (c.state !== 'loco' || !c.out) { hist[c.id] = []; last[c.id] = null; continue; }
        const J = c.out, rt = { x: -Math.sin(c.yaw), z: Math.cos(c.yaw) }, fw = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) };
        const C = A.comOf(J), my = (J[15].y + J[19].y) / 2;
        const el = (C.x - c.x) * rt.x + (C.z - c.z) * rt.z, ef = (C.x - c.x) * fw.x + (C.z - c.z) * fw.z;
        const roll = Math.atan2((J[3].x - J[0].x) * rt.x + (J[3].z - J[0].z) * rt.z, J[3].y - J[0].y) * 180 / Math.PI;
        const lean = Math.atan2(el, C.y - my) * 180 / Math.PI;
        if (mode === 'trace') {
          if (A.simT < a.from) continue;
          const st = c.steps[0];
          L.push([f(A.simT, 2), 'x', f(c.x, 2), 'z', f(c.z, 2), 'v', f(c.spd, 2), 'acc', f(c.acc || 0, 1), 'w', f(c.yawRate, 2),
            'yaw', f(c.yaw * 180 / Math.PI, 0), 'eL', f(el * 100, 1), 'eF', f(ef * 100, 1), 'roll', f(roll, 1),
            c.feet.map(t => t && t.sw ? 'S' : 'p').join(''), st ? st.a : '-',
            st && st.pts ? 'i' + st.i + ' ' + st.pts.map(p => f(p.x, 2) + ',' + f(p.z, 2) + (p.st ? 'st' : '')).join(' ') : '',
            c.run ? 'RUN' : 'walk', 'tSpd', f(c.tSpd, 2)].join(' '));
          continue;
        }
        const P = last[c.id];
        last[c.id] = { x: c.x, z: c.z };
        if (mode === 'jumps') {
          if (P && Math.hypot(c.x - P.x, c.z - P.z) > 0.07) ev.push('JUMP t=' + f(A.simT, 2) + ' id=' + c.id + ' ' + f(P.x, 2) + ',' + f(P.z, 2) + ' -> ' + f(c.x, 2) + ',' + f(c.z, 2));
          continue;
        }
        const h = hist[c.id] || (hist[c.id] = []);
        h.push({ t: A.simT, lean, w: c.yawRate, v: c.spd });
        if (h.length > 31) h.shift();
        if (h.length >= 2) {
          const p = h[h.length - 2], q = h[h.length - 1];
          ev.push({ rate: (q.lean - p.lean) * 60, t: q.t, id: c.id, v: q.v, w: q.w,
            wHist: h.filter((_, i) => i % 3 === 0).map(x => f(x.w, 1)).join(' '), leanHist: h.filter((_, i) => i % 3 === 0).map(x => f(x.lean, 0)).join(' ') });
        }
      }
    }
    if (mode === 'trace') return L;
    if (mode === 'jumps') return ev.length ? ev : ['JUMPS=0'];
    ev.sort((x, y) => Math.abs(y.rate) - Math.abs(x.rate));
    const top = [], seen = new Set();
    for (const e of ev) { const k = e.id + ':' + Math.floor(e.t); if (seen.has(k)) continue; seen.add(k); top.push(e); if (top.length >= 6) break; }
    return top.map(e => 'TILT ' + f(e.rate, 0) + ' deg/s t=' + f(e.t, 2) + ' id=' + e.id + ' v=' + f(e.v, 2) + ' w=' + f(e.w, 2) +
      '\n  turn rate (last 0.5 s): ' + e.wHist + '\n  COM lean deg (last 0.5 s): ' + e.leanHist);
  }, [mode, args, secs]);
  console.log(out.join('\n'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
