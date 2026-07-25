#!/usr/bin/env node
// smoke-mobile.cjs — headless mobile smoke gate for this repo's pages.
//
// Loads each given page (path relative to the repo root, or absolute) in
// headless Chromium at an iPhone 13 viewport (390x844 @3x, touch enabled)
// and fails if the page throws any console error or uncaught exception.
// External-resource failures (Google Fonts, network) are ignored — pages
// must work offline-degraded but fonts aren't part of the gate.
//
// Usage:
//   node .claude/scripts/smoke-mobile.cjs games/index.html games/neon-golf/index.html
//
// Requirements: `playwright-core` resolvable (NODE_PATH works), and a
// Chromium binary — $SMOKE_CHROMIUM, /opt/pw-browsers/chromium (remote
// sessions), or `chromium` on PATH. Fails loudly if either is missing.
//
// Output: one PASS/FAIL line per page, then a final `SMOKE: GREEN` or
// `SMOKE: RED` line. Exit 0 on green, 1 on red or setup failure.
'use strict';
const path = require('path');
const fs = require('fs');

const pages = process.argv.slice(2);
if (pages.length === 0) {
  console.error('usage: node smoke-mobile.cjs <page.html ...>');
  console.log('SMOKE: RED');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (e) {
  console.error('smoke-mobile: playwright-core not resolvable.');
  console.error('  fix: npm install playwright-core (any dir), then run with');
  console.error('       NODE_PATH=<that dir>/node_modules node .claude/scripts/smoke-mobile.cjs ...');
  console.log('SMOKE: RED');
  process.exit(1);
}

const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

const IGNORE = /fonts\.g|net::ERR|Failed to load resource/i;
const repoRoot = path.resolve(__dirname, '..', '..');

(async () => {
  let browser;
  try {
    browser = await chromium.launch(executablePath ? { executablePath } : {});
  } catch (e) {
    console.error('smoke-mobile: could not launch Chromium (' + e.message + ')');
    console.error('  fix: set SMOKE_CHROMIUM to a chromium binary path');
    console.log('SMOKE: RED');
    process.exit(1);
  }
  let red = false;
  for (const p of pages) {
    const abs = path.isAbsolute(p) ? p : path.join(repoRoot, p);
    if (!fs.existsSync(abs)) { console.log('FAIL ' + p + ' — file not found'); red = true; continue; }
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    try {
      await page.goto('file://' + abs, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1500);
    } catch (e) {
      errors.push('load: ' + e.message);
    }
    const real = errors.filter(e => !IGNORE.test(e));
    if (real.length) { console.log('FAIL ' + p); real.forEach(e => console.log('  ' + e)); red = true; }
    else console.log('PASS ' + p);
    await ctx.close();
  }
  await browser.close();
  console.log(red ? 'SMOKE: RED' : 'SMOKE: GREEN');
  process.exit(red ? 1 : 0);
})();
