#!/usr/bin/env node
/**
 * check-canvas-space.cjs — does a page lay out in the space its taps arrive in?
 *
 * A fullscreen canvas sized from window.innerWidth/innerHeight, whose CSS box
 * is left to `width:100%;height:100%`, is using two coordinate spaces that iOS
 * makes disagree: after a rotation Safari's chrome can leave the box SHORTER
 * than innerHeight, CSS squashes the taller backing store into it, and every
 * sprite is drawn higher than it is hit-tested — by an offset that grows with
 * y. Shipped in fire-clicker 2026-08-28 ("the campfire only answers taps at
 * the bottom of the drawn circle and below"). See games/CLAUDE.md § Canvas
 * sizing for the two cures.
 *
 * This probe simulates that mismatch — it shrinks the canvas box away from
 * innerHeight with a stylesheet, fires the rotation events, and then compares
 * each visible canvas's backing-store aspect against its CSS box aspect. A
 * page that measures its own element (or pins its CSS size to the numbers it
 * sized the backing store with) comes back SQUASH=1.000.
 *
 * It is a DIAGNOSTIC, not one of the repo's hard gates: a mismatch on a canvas
 * the page never hit-tests is a stretched picture rather than a dead tap, so
 * read the result before acting on it. Three cases are recognised and exempt,
 * each of which flagged as a false positive when this was first run:
 *   - `pinned=inline-css` — the page set cv.style.width/height in px, tying
 *     the box to the backing store (cure #2). This probe reaches the element
 *     through a stylesheet and would otherwise prise apart what iOS cannot.
 *   - `uninit` — the canvas is still 300x150, the HTML default, so the page
 *     never booted. In this container that is usually a CDN library the
 *     offline proxy blocked (stick-commander-3d's three.js).
 *   - `skip-rotated` — the page counter-rotates its shell for a portrait lock
 *     (games/CLAUDE.md § Portrait lock, neon-clash), so a portrait backing
 *     store in a landscape box is the design, not a squash.
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/scripts/check-canvas-space.cjs games/foo/index.html [...]
 *
 * Prints one CANVAS= line per canvas, then CANVAS-SPACE: GREEN|FLAGGED.
 * Exits 0 when nothing is flagged, 1 otherwise.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const SHRINK = 60;             // px taken off the box, as iOS chrome would
const TOL = 0.02;              // 2% aspect drift tolerated
(async () => {
  const pages = process.argv.slice(2);
  if (!pages.length) { console.error('usage: check-canvas-space.cjs <page.html> [...]'); process.exit(2); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let flagged = 0;
  for (const p of pages) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
    try {
      await page.goto('file://' + path.resolve(p));
      await page.waitForTimeout(700);
      await page.addStyleTag({ content:
        'canvas{max-height:calc(100% - ' + SHRINK + 'px)!important}' });
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('orientationchange'));
      });
      await page.waitForTimeout(900);
      const rows = await page.evaluate(() => {
        const out = [];
        for (const c of document.querySelectorAll('canvas')) {
          const r = c.getBoundingClientRect();
          if (r.width < 50 || r.height < 50) continue;      // offscreen/effect layers
          if (getComputedStyle(c).display === 'none') continue;
          // A page that PINS its CSS size inline (cv.style.height = H + 'px')
          // has already tied the box to the numbers it sized the backing store
          // with — iOS cannot prise those apart, and neither may this probe,
          // which reaches the element through a stylesheet. That is cure #2,
          // so record it and do not measure a squash this probe imposed.
          const pinned = !!(c.style.height && c.style.width);
          // Still at the HTML canvas default: the page never sized it, so it
          // never booted (in this container that usually means a CDN library
          // the offline proxy blocked). Nothing to judge.
          const uninit = c.width === 300 && c.height === 150;
          // A page that counter-rotates its shell (games/CLAUDE.md § Portrait
          // lock) presents a portrait backing store in a landscape box ON
          // PURPOSE, so comparing the two aspects is meaningless here.
          let rotated = false;
          for (let el = c; el && el !== document.documentElement; el = el.parentElement) {
            const t = getComputedStyle(el).transform;
            if (t && t !== 'none') {
              const m = t.match(/matrix\(([^)]+)\)/);
              if (m) { const v = m[1].split(',').map(Number); if (Math.abs(v[1]) > 0.01 || Math.abs(v[2]) > 0.01) rotated = true; }
            }
          }
          out.push({ id: c.id || '(anon)', bw: c.width, bh: c.height, rw: r.width, rh: r.height, pinned, uninit, rotated });
        }
        return out;
      });
      for (const r of rows) {
        const squash = (r.bw / r.bh) / (r.rw / r.rh);       // 1.000 == box and backing agree
        const exempt = r.pinned || r.uninit || r.rotated;
        const bad = !exempt && Math.abs(squash - 1) > TOL;
        if (bad) flagged++;
        const tag = r.uninit ? 'uninit' : r.rotated ? 'skip-rotated' : bad ? 'FLAG' : 'ok';
        console.log('CANVAS=' + tag + ' page=' + p + ' id=' + r.id +
          (r.pinned ? ' pinned=inline-css' : '') +
          ' backing=' + r.bw + 'x' + r.bh + ' box=' + r.rw.toFixed(0) + 'x' + r.rh.toFixed(0) +
          ' SQUASH=' + squash.toFixed(3));
      }
      if (!rows.length) console.log('CANVAS=none page=' + p);
    } catch (e) {
      flagged++;
      console.log('CANVAS=ERROR page=' + p + ' msg=' + e.message.split('\n')[0]);
    }
    await page.close();
  }
  await browser.close();
  console.log('CANVAS-SPACE: ' + (flagged ? 'FLAGGED (' + flagged + ')' : 'GREEN'));
  process.exit(flagged ? 1 : 0);
})();
