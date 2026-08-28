#!/usr/bin/env node
// frame-budget.cjs — is this page holding 60fps?
//
// Measures REAL presented frame times: rAF deltas on a live, presenting page.
// That is the only measurement of Canvas 2D cost that means anything, and
// getting there took four attempts on 2026-08-24 — the three that failed are
// worth knowing about, because every one of them produced a confident number:
//
//   1. `for (i=0;i<N;i++) { update(dt); draw(); }` timed with performance.now()
//      said 1.43 ms/frame. Canvas 2D calls are QUEUED; nothing rasterized.
//      It was timing the enqueue.
//   2. The same loop with `ctx.getImageData(0,0,1,1)` after each iteration to
//      "force a flush" said 18-20 ms — but the empty-loop baseline came back at
//      0.01 ms, which is the tell that the readback is NOT flushing either.
//      Both numbers were noise wearing a lab coat.
//   3. Timing two implementations back to back in one page, fastest-of-two,
//      order swapped to cancel bias. Still measuring the queue, still wrong,
//      and it ranked the wrong implementation first.
//
// Only rAF deltas on a presenting page found the actual regression (a title
// screen sitting at a hard 30fps in one of its two graphics styles).
//
// Two things to know before you read the output:
//
//   * The numbers are QUANTIZED to the vsync interval. 16.7 means "inside
//     budget", 33.3 means "missing every second frame". A median of 16.7 does
//     not tell you whether you have 10% headroom or 90% — for that, bisect by
//     stubbing pieces out (`window.drawFoo = () => {}`) and see which removal
//     brings a red page back under.
//   * Do NOT copy shot-page.cjs's launch args. It passes
//     `--use-angle=swiftshader --enable-unsafe-swiftshader`, which it needs so
//     WebGL pages render at all — and which forces the 2D canvas onto software
//     rasterization too. Measured on the same page the same way, that alone
//     takes the median from 16.7 ms to 50.0 ms. This script therefore leaves
//     the flags OFF by default and offers `swiftshader=1` for a WebGL page,
//     where the number then answers a different question (how the renderer
//     behaves with no GPU at all) and should not be compared against a run
//     without it.
//   * Even without the flags, headless is a rough proxy for a phone. Treat
//     green as strong evidence and red as worth investigating.
//
// Usage:
//   node .claude/scripts/frame-budget.cjs <page.html> [key=value ...]
//     w=390 h=844 dpr=3      viewport (default iPhone 13 at dpr 3 — dpr is a
//                            real cost multiplier, so measure at the design one)
//     wait=1500              ms to settle before sampling
//     frames=150             rAF samples to collect
//     budget=16.9            ms; median above this exits 1
//     swiftshader=1          force software GL (WebGL pages only — see above)
//     select=#id:value       set a <select> first (repeatable)
//     eval=<js>              run JS first (repeatable) — pose the scene through
//                            the game's own hook, or saturate a cap
//     evalFile=<path>        same, read from a file (repeatable). Poses worth
//                            re-measuring live in .claude/scripts/poses/ — a
//                            perf number means nothing without the scene it was
//                            taken on, and a pose retyped from a prose
//                            description is a different scene.
//
// Prints `FRAME median=… p95=… max=… over=N/T` and `BUDGET=ok|over`, exit 0/1.
// Requirements: playwright-core resolvable (remote sessions:
//   NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules) and a
//   Chromium binary ($SMOKE_CHROMIUM, /opt/pw-browsers/chromium, or PATH).
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const [page_, ...rest] = process.argv.slice(2);
if (!page_ || page_.includes('=')) {
  console.error('usage: frame-budget.cjs <page.html> [w= h= dpr= wait= frames= budget= select= eval= evalFile=]');
  process.exit(1);
}
const opt = { w: 390, h: 844, dpr: 3, wait: 1500, frames: 150, budget: 16.9, swiftshader: 0, select: [], eval: [] };
const NUMERIC = ['w', 'h', 'dpr', 'wait', 'frames', 'budget', 'swiftshader'];
for (const a of rest) {
  const i = a.indexOf('=');
  if (i < 0) { console.error('frame-budget.cjs: expected key=value, got: ' + a); process.exit(1); }
  const k = a.slice(0, i), v = a.slice(i + 1);
  if (k === 'select') opt.select.push(v);
  else if (k === 'eval') opt.eval.push(v);
  else if (k === 'evalFile') {
    try { opt.eval.push(fs.readFileSync(v, 'utf8')); }
    catch (e) { console.error('frame-budget.cjs: evalFile= cannot read ' + v + ': ' + e.message); process.exit(1); }
  }
  else if (NUMERIC.includes(k)) {
    const n = Number(v);
    if (!Number.isFinite(n)) { console.error('frame-budget.cjs: ' + k + '= expects a number, got: ' + v); process.exit(1); }
    opt[k] = n;
  } else {
    console.error('frame-budget.cjs: unknown option "' + k + '" (known: ' + NUMERIC.join(' ') + ' select eval evalFile)');
    process.exit(1);
  }
}
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

(async () => {
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    ...(opt.swiftshader ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}),
  });
  const ctx = await browser.newContext({
    viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: opt.dpr, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.resolve(page_), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  // Set the value directly rather than through page.selectOption: a settings
  // picker usually lives in a panel that starts `display:none`, and
  // selectOption's actionability check waits for a visibility that never
  // comes. Dispatch the event too — the value alone changes nothing.
  for (const s of opt.select) {
    const i = s.indexOf(':');
    const ok = await page.evaluate(([sel, val]) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === val;
    }, [s.slice(0, i), s.slice(i + 1)]);
    if (!ok) errors.push('select failed (no such element, or value rejected): ' + s);
  }
  for (const src of opt.eval) {
    try { await page.evaluate('(() => {' + src + '})()'); }
    catch (e) { errors.push('eval failed: ' + e.message); }
  }
  await page.waitForTimeout(opt.wait);

  const r = await page.evaluate(n => new Promise(res => {
    const d = []; let last = performance.now(), i = 0;
    const tick = t => {
      d.push(t - last); last = t;
      if (++i < n) requestAnimationFrame(tick);
      else {
        d.shift();                       // the first delta straddles the setup
        const s = d.slice().sort((a, b) => a - b);
        res({ median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)],
              max: s[s.length - 1], over: d.filter(x => x > 20).length, total: d.length });
      }
    };
    requestAnimationFrame(tick);
  }), opt.frames);

  const f = x => (Math.round(x * 10) / 10).toFixed(1);
  console.log('FRAME median=' + f(r.median) + ' p95=' + f(r.p95) + ' max=' + f(r.max) +
              ' over=' + r.over + '/' + r.total);
  const ok = r.median <= opt.budget;
  console.log('BUDGET=' + (ok ? 'ok' : 'over') + ' median=' + f(r.median) + 'ms budget=' + f(opt.budget) + 'ms');
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 8).join('\n'));
  await browser.close();
  // A failed select= or eval= means the scene measured is not the one that
  // was asked for, so it fails like a page error does. Reporting it and
  // exiting 0 is the same class of bug stamp-badge.sh already had: a
  // success line computed from intent rather than from the artifact.
  process.exit(ok && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
