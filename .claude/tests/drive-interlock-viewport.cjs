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

/* Wait in RENDERED FRAMES, never milliseconds.
 *
 * This suite passed on its own and went RED inside gates.sh, which runs three
 * Chromium suites back to back (2026-09-20). Nothing about the page changed —
 * the waits did not survive the load. WebGL here is rasterized in software and
 * a frame can cost 300-700 ms, so `waitForTimeout(400)` on a busy machine is
 * ZERO frames, and the row it guarded ("the box coming back is picked up too")
 * is precisely the one that depends on the frame loop having run. A gate that
 * is green alone and red in the suite is still a flaky gate. */
const frames = (page, n = 4) => page.evaluate((k) => new Promise((res) => {
  let i = 0;
  const step = () => (++i >= k ? res(i) : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n).catch(() => null);

async function until(page, fn, label, ms = 60000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await frames(page, 1);
  }
  fail('timed out after ' + ms + 'ms waiting for ' + label);
  return false;
}

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
  await until(page, () => !!(window.interlock && window.interlock.state.pieces.length), 'the board to exist');
  await frames(page, 5);

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
  await until(page, () => Math.round(window.interlock.box().h) === 600, 'the box to reach 600px');
  await frames(page, 5);
  m = await measure();
  ok(Math.round(m.box.h) === 600 && m.inner.h === VH, 'box is ' + Math.round(m.box.h) + 'px inside a ' + m.inner.h + 'px window (the two really are apart)');
  ok(Math.abs(squash(m) - 1) < 0.02, 'backing store followed the box down (squash ' + squash(m).toFixed(3) + ')');
  r = await pickAll(page, 'squashed');
  ok(r.tried >= 3, 'aimed at ' + r.tried + ' on-screen pieces');
  ok(r.hits === r.tried, 'every tap still landed on the board (' + r.hits + '/' + r.tried + ')' +
     (r.worst ? ' — first miss: piece ' + r.worst.id + ' at y=' + r.worst.pt.y.toFixed(0) : ''));

  console.log('-- real taps hit the piece they are aimed at, on a squashed board --');
  /* Three taps, each at the point FURTHEST FROM THE VERTICAL MIDDLE of the box
   * where a free piece can be reached.
   *
   * Two earlier shapes of this row both failed as checks, and both failures
   * were about which board the generator happened to deal (2026-09-20):
   *   - one tap at the LOWEST free piece passed with tap() broken, because the
   *     innerHeight error is zero at the centre line and grows with distance
   *     from it, so a target near the middle is barely displaced and a large
   *     piece absorbs the displacement;
   *   - requiring a piece to be unoccluded AT ITS OWN CENTRE found no
   *     candidate at all on some boards, and reported that as a failure.
   * So the aim points come from scanning the board rather than from the
   * pieces: every grid point pick() says holds a free piece is a candidate,
   * which always yields some, and the extreme one maximises the displacement a
   * broken mapping would produce. Three rounds mean one lucky board cannot
   * carry the row.
   *
   * What it asserts is that the REAL tap path agrees with pick() about what is
   * under a pixel. They read the same viewBox(), so a regression in either
   * shows up here. */
  {
    let taps = 0;
    for (let round = 0; round < 3; round++) {
      const rect = await page.locator('#game').boundingBox();
      const midY = rect.y + rect.height / 2;
      const free = new Set(await page.evaluate(() =>
        window.interlock.state.pieces.filter((p) => !p.removed && p.free).map((p) => p.id)));
      let best = null;
      for (let iy = 1; iy < 14; iy++) for (let ix = 1; ix < 8; ix++) {
        const x = rect.x + rect.width * ix / 8, y = rect.y + rect.height * iy / 14;
        const off = Math.abs(y - midY);
        if (best && off <= best.off) continue;                 // cannot win; skip the round trip
        const id = await page.evaluate(([a, b]) => window.interlock.pick(a, b), [x, y]);
        if (id === null || !free.has(id)) continue;
        best = { id, x, y, off };
      }
      if (!best) { fail('round ' + round + ': no reachable free piece anywhere on the board'); break; }

      const gone = () => page.evaluate(() =>
        window.interlock.state.pieces.filter((p) => p.removed).map((p) => p.id).sort().join(','));
      const before = await gone();
      const wasGone = before.split(',').filter(Boolean).length;
      await page.mouse.click(best.x, best.y);
      // The slide-out takes 650 ms of ANIMATION time, many frames on this
      // rasterizer, so wait for the BOARD to change, not for a wall clock.
      await until(page, (n) => window.interlock.state.pieces.filter((q) => q.removed).length > n,
                  'the tapped piece to leave', 20000, wasGone);
      await frames(page, 6);
      const after = await gone();
      const removed = after.split(',').filter(Boolean).filter((id) => !before.split(',').includes(id));

      // "a piece was removed" is NOT the check: a tap normalised by innerHeight
      // in a shorter box lands on a piece HIGHER up, which is often also free,
      // so a count assertion goes green on the very bug this file exists for.
      ok(removed.length === 1 && +removed[0] === best.id,
         'tap ' + (round + 1) + ': pick() said piece ' + best.id + ' at y=' + best.y.toFixed(0) +
         ' (' + best.off.toFixed(0) + 'px off centre, box ' + Math.round(rect.height) +
         'px in a ' + VH + 'px window) and THAT piece left' +
         (removed.length === 0 ? ' — nothing was removed' :
          +removed[0] !== best.id ? ' — piece ' + removed[0] + ' left instead' : ''));
      taps++;
    }
    ok(taps === 3, 'all three taps were actually taken (' + taps + '/3)');
  }

  console.log('-- the box coming back is picked up too --');
  await page.addStyleTag({ content: '#game{height:100dvh!important}' });
  // deliberately no resize event: the per-frame re-measure is what must catch
  // this, so wait on FRAMES, which is the only thing that can
  await until(page, () => Math.round(window.interlock.box().h) === 844, 'the box to return to 844px');
  await frames(page, 4);
  m = await measure();
  ok(Math.round(m.box.h) === VH, 'box is back to ' + Math.round(m.box.h) + 'px');
  ok(Math.abs(squash(m) - 1) < 0.02, 'and the backing store came with it (squash ' + squash(m).toFixed(3) + ')');

  ok(errs.length === 0, 'no console errors (' + errs.slice(0, 2).join(' | ') + ')');
  await browser.close();
  console.log('INTERLOCK-VIEWPORT: ' + (bad ? 'RED' : 'GREEN'));
  process.exit(bad ? 1 : 0);
})();
