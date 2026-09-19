#!/usr/bin/env node
/**
 * drive-interlock-viewport.cjs — does Interlock lay out in the space its taps
 * arrive in?  (games/CLAUDE.md § Canvas sizing, cure #1)
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/drive-interlock-viewport.cjs
 *
 * Why this is a suite rather than a run of check-canvas-space.cjs: that probe
 * EXEMPTS any page that has set cv.style.width/height inline, and three.js's
 * renderer.setSize() does exactly that by default. Interlock therefore reported
 * `pinned=inline-css` and SQUASH=1.000 while never being measured at all — the
 * probe's own documented false-positive guard, hiding a real 0.711 squash
 * (2026-09-19). The probe also shrinks the box with a percentage max-height,
 * which resolves to `none` against this page's auto-height body, so it could
 * not have prised the two apart here even without the exemption. Both are
 * reasons to pin the box in px from this suite instead and check the thing
 * that actually matters: not the aspect ratio, but whether a tap at the pixel
 * a piece is DRAWN on hits that piece.
 *
 * The method is deliberately not circular. ndcOf() returns camera-projection
 * NDC with no viewport in it; this file maps that to a client point using the
 * canvas rect IT measured, which is the same mapping the browser uses to
 * composite the backing store into the box; pick() then has to agree. A page
 * that normalises taps by innerHeight while the box is shorter fails for every
 * piece away from the centre line, by an offset that grows with y.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'games', 'interlock', 'index.html');
const VW = 390, VH = 844;

let bad = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };

// The board is drawn by compositing the backing store into the CSS box, so the
// screen point of a piece is its NDC mapped through THAT box. This is the
// browser's own mapping, written out; nothing in the page supplies it.
const screenOf = (rect, ndc) => ({
  x: rect.x + (ndc.x * 0.5 + 0.5) * rect.width,
  y: rect.y + (0.5 - ndc.y * 0.5) * rect.height,
});

async function pickAll(page, label) {
  const rect = await page.locator('#game').boundingBox();
  const ids = await page.evaluate(() => window.interlock.state.pieces.filter(p => !p.removed).map(p => p.id));
  if (!ids.length) { fail(label + ': no pieces on the board to aim at'); return { rect, hits: 0, tried: 0 }; }
  let hits = 0, tried = 0, worst = null;
  for (const id of ids) {
    const ndc = await page.evaluate((i) => window.interlock.ndcOf(i), id);
    if (!ndc) { fail(label + ': piece ' + id + ' would not project'); continue; }
    const pt = screenOf(rect, ndc);
    if (pt.x < rect.x || pt.x > rect.x + rect.width || pt.y < rect.y || pt.y > rect.y + rect.height) continue;
    tried++;
    const got = await page.evaluate(([x, y]) => window.interlock.pick(x, y), [pt.x, pt.y]);
    // The centre of a piece's bounding sphere can sit behind a neighbour, so
    // the honest assertion is "a tap there hits SOMETHING", never "nothing".
    if (got !== null) hits++; else worst = worst || { id, pt };
  }
  return { rect, hits, tried, worst };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const squash = (b) => (b.backing.w / b.backing.h) / (b.box.w / b.box.h);
  const measure = () => page.evaluate(() => {
    const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
    return { backing: { w: cv.width, h: cv.height }, box: { w: r.width, h: r.height },
             inner: { w: innerWidth, h: innerHeight } };
  });

  console.log('-- at boot, box == window --');
  let m = await measure();
  ok(Math.abs(squash(m) - 1) < 0.02, 'backing store matches the box (squash ' + squash(m).toFixed(3) + ')');
  let r = await pickAll(page, 'boot');
  ok(r.tried >= 3, 'aimed at ' + r.tried + ' on-screen pieces');
  ok(r.hits === r.tried, 'every tap landed on the board (' + r.hits + '/' + r.tried + ')');

  console.log('-- box forced SHORTER than innerHeight, as iOS chrome does --');
  // px, with !important: a percentage max-height resolves to `none` against
  // this page's auto-height body, so it would not move the box at all.
  await page.addStyleTag({ content: '#game{height:600px!important}' });
  await page.evaluate(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); });
  await page.waitForTimeout(600);
  m = await measure();
  ok(Math.round(m.box.h) === 600 && m.inner.h === VH, 'box is ' + Math.round(m.box.h) + 'px inside a ' + m.inner.h + 'px window (the two really are apart)');
  ok(Math.abs(squash(m) - 1) < 0.02, 'backing store followed the box down (squash ' + squash(m).toFixed(3) + ')');
  r = await pickAll(page, 'squashed');
  ok(r.tried >= 3, 'aimed at ' + r.tried + ' on-screen pieces');
  ok(r.hits === r.tried, 'every tap still landed on the board (' + r.hits + '/' + r.tried + ')' +
     (r.worst ? ' — first miss: piece ' + r.worst.id + ' at y=' + r.worst.pt.y.toFixed(0) : ''));

  console.log('-- a real tap removes a piece at the bottom of a squashed board --');
  // The failure this guards reads as "the low part of the cube stopped
  // answering", so aim at the LOWEST target on screen rather than a convenient
  // one. A piece's bounding-sphere centre can sit BEHIND a neighbour, so the
  // candidates are narrowed to pieces that are both free and unoccluded at
  // their own centre — asked of pick(), then confirmed by the click itself.
  {
    const rect = await page.locator('#game').boundingBox();
    const ids = await page.evaluate(() => window.interlock.state.pieces.filter((p) => !p.removed && p.free).map((p) => p.id));
    let low = null;
    for (const id of ids) {
      const ndc = await page.evaluate((i) => window.interlock.ndcOf(i), id);
      if (!ndc) continue;
      const pt = screenOf(rect, ndc);
      if (pt.x < rect.x || pt.x > rect.x + rect.width || pt.y < rect.y || pt.y > rect.y + rect.height) continue;
      const at = await page.evaluate(([x, y]) => window.interlock.pick(x, y), [pt.x, pt.y]);
      if (at !== id) continue;                       // occluded by a neighbour
      if (!low || pt.y > low.pt.y) low = { id, pt };
    }
    // An empty candidate set is a FAILURE, not a skip: it means either no
    // piece is removable or nothing projected, and both are bugs.
    if (!low) fail('no free, unoccluded piece to aim at — nothing was actually tested');
    else {
      const gone = () => page.evaluate(() => window.interlock.state.pieces.filter((p) => p.removed).map((p) => p.id).sort().join(','));
      const before = await gone();
      await page.mouse.click(low.pt.x, low.pt.y);
      await page.waitForTimeout(900);
      const after = await gone();
      // "a piece was removed" is NOT the check. A tap normalised by innerHeight
      // in a shorter box lands on a piece HIGHER up the board, which is often
      // also free — so the count still falls by one and a count assertion goes
      // green on the exact bug this file exists for (caught by negative test,
      // 2026-09-19). The removed piece has to be the one that was aimed at.
      const removed = after.split(',').filter(Boolean).filter((id) => !before.split(',').includes(id));
      ok(removed.length === 1 && +removed[0] === low.id,
         'tapping the lowest free piece (id ' + low.id + ', y=' + low.pt.y.toFixed(0) + ' of a ' +
         Math.round(rect.height) + 'px box in an ' + VH + 'px window) removed THAT piece' +
         (removed.length === 1 && +removed[0] !== low.id ? ' — it removed ' + removed[0] + ' instead' :
          removed.length === 0 ? ' — nothing was removed' : ''));
    }
  }

  console.log('-- the box coming back is picked up too --');
  await page.addStyleTag({ content: '#game{height:100dvh!important}' });
  await page.waitForTimeout(400);                       // no resize event fired: the frame loop must catch this
  m = await measure();
  ok(Math.round(m.box.h) === VH, 'box is back to ' + Math.round(m.box.h) + 'px');
  ok(Math.abs(squash(m) - 1) < 0.02, 'and the backing store came with it (squash ' + squash(m).toFixed(3) + ')');

  ok(errs.length === 0, 'no console errors (' + errs.slice(0, 2).join(' | ') + ')');
  await browser.close();
  console.log('INTERLOCK-VIEWPORT: ' + (bad ? 'RED' : 'GREEN'));
  process.exit(bad ? 1 : 0);
})();
