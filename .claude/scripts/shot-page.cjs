#!/usr/bin/env node
// shot-page.cjs — headless screenshot of a repo page, for visual iteration.
//
// Loads a page (path relative to the repo root, or absolute) in headless
// Chromium — WebGL2 works via SwiftShader — waits, optionally performs simple
// actions, and writes a PNG. Prints PAGEERRORs (external-resource noise
// filtered) so a dead script is obvious even when the canvas "renders".
//
// Usage:
//   node .claude/scripts/shot-page.cjs <page.html> <out.png> [opts]
// Options (KEY=value, any order):
//   w=390 h=844          viewport (default iPhone 13)
//   wait=3000            ms to wait before the shot
//   click=x,y            click once after load (e.g. dismiss a splash)
//   select=#id:value     set a <select> (repeatable)
//   dpr=2                deviceScaleFactor
//
// Requirements: playwright-core resolvable (remote sessions:
//   NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules) and a
//   Chromium binary ($SMOKE_CHROMIUM, /opt/pw-browsers/chromium, or PATH).
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const [page_, out, ...rest] = process.argv.slice(2);
if (!page_ || !out) {
  console.error('usage: shot-page.cjs <page.html> <out.png> [w= h= wait= click=x,y select=#id:val dpr=]');
  process.exit(1);
}
const opt = { w: 390, h: 844, wait: 3000, dpr: 2, click: null, select: [] };
for (const a of rest) {
  const i = a.indexOf('=');
  const k = a.slice(0, i), v = a.slice(i + 1);
  if (k === 'select') opt.select.push(v);
  else if (k === 'click') opt.click = v.split(',').map(Number);
  else opt[k] = Number(v);
}
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

(async () => {
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: opt.dpr, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_CONNECTION|Failed to load resource|fonts\.g/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto('file://' + path.resolve(page_), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  if (opt.click) { try { await page.mouse.click(opt.click[0], opt.click[1]); } catch {} }
  for (const s of opt.select) {
    const i = s.indexOf(':');
    try { await page.selectOption(s.slice(0, i), s.slice(i + 1)); } catch (e) { errors.push('select failed: ' + s); }
  }
  await page.waitForTimeout(opt.wait);
  await page.screenshot({ path: out });
  console.log('SHOT=' + out);
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 8).join('\n') : 'ERRORS=none');
  await browser.close();
  process.exit(errors.some(e => e.startsWith('PAGEERROR')) ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
