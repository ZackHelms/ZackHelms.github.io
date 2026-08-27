#!/usr/bin/env node
// shot-strip.cjs — contact sheet: N frames of a page, spaced in time, tiled
// into one PNG.
//
// `shot-page.cjs` answers "does this look right?". It cannot answer "does this
// SCENE look right?" when the scene moves on its own — a procedural background,
// a physics sim, an AI that is only interesting when it does something. One
// frame of an animation is a sample of size one, and the frame you happen to
// catch is routinely the boring one: on 2026-08-24 a title-screen dogfight read
// as "completely broken, no ships visible" from a single shot, and the ships
// were fine — the shot landed in a lull. A strip shows the distribution.
//
// It also costs one image instead of N to review, which matters when the whole
// point is comparing frames against each other.
//
// Usage:
//   node .claude/scripts/shot-strip.cjs <page.html> <out.png> [key=value ...]
//     frames=4               how many to capture
//     gap=1000               ms between captures
//     wait=2500              ms to settle before the first one
//     w=390 h=844 dpr=1      viewport (dpr 1 by default — a strip is wide, and
//                            a 4-up at dpr 3 is a needlessly enormous image)
//     select=#id:value       set a <select> first (repeatable)
//     eval=<js>              run JS first (repeatable) — pose the scene through
//                            the game's own hook
//
// Prints `STRIP=<out> frames=N` and an `ERRORS=` line; exits 1 on any PAGEERROR
// (a parse error kills a page's script while the canvas still "renders").
// Requirements: playwright-core resolvable (remote sessions:
//   NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules) and a
//   Chromium binary ($SMOKE_CHROMIUM, /opt/pw-browsers/chromium, or PATH).
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const [page_, out, ...rest] = process.argv.slice(2);
if (!page_ || !out) {
  console.error('usage: shot-strip.cjs <page.html> <out.png> [frames= gap= wait= w= h= dpr= select= eval=]');
  process.exit(1);
}
// <out.png> is positional — same trap shot-page.cjs already fell into once.
if (out.includes('=')) {
  console.error('shot-strip.cjs: <out.png> is positional, not "key=value" — got: ' + out);
  process.exit(1);
}
const opt = { frames: 4, gap: 1000, wait: 2500, w: 390, h: 844, dpr: 1, select: [], eval: [] };
const NUMERIC = ['frames', 'gap', 'wait', 'w', 'h', 'dpr'];
for (const a of rest) {
  const i = a.indexOf('=');
  if (i < 0) { console.error('shot-strip.cjs: expected key=value, got: ' + a); process.exit(1); }
  const k = a.slice(0, i), v = a.slice(i + 1);
  if (k === 'select') opt.select.push(v);
  else if (k === 'eval') opt.eval.push(v);
  else if (NUMERIC.includes(k)) {
    const n = Number(v);
    if (!Number.isFinite(n)) { console.error('shot-strip.cjs: ' + k + '= expects a number, got: ' + v); process.exit(1); }
    opt[k] = n;
  } else {
    console.error('shot-strip.cjs: unknown option "' + k + '" (known: ' + NUMERIC.join(' ') + ' select eval)');
    process.exit(1);
  }
}
if (opt.frames < 1 || opt.frames > 12) { console.error('shot-strip.cjs: frames= must be 1..12'); process.exit(1); }
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

(async () => {
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    // Same as shot-page.cjs, and deliberately unlike frame-budget.cjs: these
    // flags let a WebGL page render at all, and a screenshot only cares that
    // the pixels are right, not how long they took to arrive.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
  // selectOption waits for a visibility that never comes.
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

  const frames = [];
  for (let i = 0; i < opt.frames; i++) {
    frames.push((await page.screenshot()).toString('base64'));
    if (i < opt.frames - 1) await page.waitForTimeout(opt.gap);
  }

  // Composite in a BLANK page, not the game's own — drawing a contact sheet
  // into the page under test is a fine way to measure the tool instead of it.
  const blank = await ctx.newPage();
  const url = await blank.evaluate(async fr => {
    const imgs = await Promise.all(fr.map(d => new Promise((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im); im.onerror = no;
      im.src = 'data:image/png;base64,' + d;
    })));
    const c = document.createElement('canvas');
    c.width = imgs[0].width * imgs.length; c.height = imgs[0].height;
    const g = c.getContext('2d');
    imgs.forEach((im, i) => {
      g.drawImage(im, i * im.width, 0);
      g.strokeStyle = '#ff00ff'; g.lineWidth = 2;      // a divider no game palette uses
      g.strokeRect(i * im.width + 1, 1, im.width - 2, im.height - 2);
    });
    return c.toDataURL('image/png');
  }, frames);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));

  console.log('STRIP=' + out + ' frames=' + opt.frames + ' gap=' + opt.gap + 'ms');
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 8).join('\n') : 'ERRORS=none');
  await browser.close();
  // A failed select= or eval= means the scene under the camera is not the
  // one that was asked for, so it fails like a page error does. Reporting it
  // and exiting 0 is the same class of bug stamp-badge.sh already had: a
  // success line computed from intent rather than from the artifact.
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
