#!/usr/bin/env node
// probe-cdp-touch.cjs - what does CDP's Input.dispatchTouchEvent mean in THIS Chromium?
//
// Three suites here drive real multi-touch through CDP (drive-ember-depths, drive-cyoa2,
// drive-music-mixer-runtime), and two notes in this repo (2026-08-25, 2026-09-17) described
// `touchPoints` wrongly: one said that in a `touchEnd` you list the fingers that STAY, the
// other that Chromium diffs the list against the previous call. Neither is so. A pinch row built on
// the first belief checked the ground under the wrong finger and stayed green with the
// rule it guards removed (found 2026-10-10 by a negative test, in two suites).
//
// This probe asks the browser instead of a note. It logs what a page sees (e.touches and
// e.changedTouches) for seven short sequences and compares them with the semantics the
// suites now rely on:
//   - touchStart / touchMove act on the points LISTED; points not listed stay down where
//     they were (a shorter list lifts nobody);
//   - touchEnd lifts the points LISTED (they become changedTouches); the rest stay down;
//   - touchEnd with an empty list lifts every point still down, one event each;
//   - points are matched by `id`.
//
// Usage:   NODE_PATH=/opt/node-tools/node_modules node .claude/scripts/probe-cdp-touch.cjs [--quiet]
// Output:  one block per case (omitted with --quiet), then
//            CDP-TOUCH: AS-DOCUMENTED chromium=<version>          (exit 0)
//            CDP-TOUCH: CHANGED chromium=<version> cases=<A,B,..>  (exit 1)
// Run it when a container ships a new Chromium, or before writing a multi-touch row. If it
// says CHANGED, the suites' gesture rows need reading again before they are trusted.
'use strict';
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) {
  console.error('probe-cdp-touch: playwright-core not resolvable (NODE_PATH=/opt/node-tools/node_modules, or see smoke-mobile.cjs)');
  console.log('CDP-TOUCH: CHANGED chromium=unknown cases=setup'); process.exit(1);
}
const fs = require('fs');
const exe = process.env.SMOKE_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const quiet = process.argv.includes('--quiet');

// [name, steps, the events a page should log]. A step is [type, [[x, id], ...]].
const CASES = [
  ['A', 'two down, touchEnd lists finger 0: finger 0 lifts, finger 1 stays',
    [['touchStart', [[150, 0]]], ['touchStart', [[150, 0], [250, 1]]], ['touchEnd', [[102, 0]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchend touches[1@250] changed[0@102]', 'touchend touches[] changed[1@250]']],
  ['B', 'two down, touchEnd lists finger 1: finger 1 lifts, finger 0 stays',
    [['touchStart', [[150, 0]]], ['touchStart', [[150, 0], [250, 1]]], ['touchEnd', [[298, 1]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchend touches[0@150] changed[1@298]', 'touchend touches[] changed[0@150]']],
  ['C', 'touchMove listing one of two: the other stays down, unmoved',
    [['touchStart', [[150, 0], [250, 1]]], ['touchMove', [[160, 0]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchmove touches[0@160,1@250] changed[0@160]', 'touchend touches[1@250] changed[0@160]', 'touchend touches[] changed[1@250]']],
  ['D', 'after one finger lifts, the survivor can still be moved by its id',
    [['touchStart', [[150, 0]]], ['touchStart', [[150, 0], [250, 1]]], ['touchMove', [[150, 0], [260, 1]]], ['touchEnd', [[150, 0]]], ['touchMove', [[270, 1]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchmove touches[0@150,1@260] changed[1@260]', 'touchend touches[1@260] changed[0@150]', 'touchmove touches[1@270] changed[1@270]', 'touchend touches[] changed[1@270]']],
  ['E', 'touchStart listing a SUBSET lifts nobody (the list is not diffed against the last call)',
    [['touchStart', [[150, 0], [250, 1]]], ['touchStart', [[250, 1]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchend touches[1@250] changed[0@150]', 'touchend touches[] changed[1@250]']],
  ['F', 'touchStart listing only a NEW id adds it; the two already down stay',
    [['touchStart', [[150, 0], [250, 1]]], ['touchStart', [[320, 2]]], ['touchEnd', []]],
    ['touchstart touches[0@150] changed[0@150]', 'touchstart touches[0@150,1@250] changed[1@250]', 'touchstart touches[0@150,1@250,2@320] changed[2@320]', 'touchend touches[1@250,2@320] changed[0@150]', 'touchend touches[2@320] changed[1@250]', 'touchend touches[] changed[2@320]']],
  ['G', 'touchEnd listing two of three lifts those two, one event each',
    [['touchStart', [[100, 0], [200, 1], [300, 2]]], ['touchEnd', [[100, 0], [300, 2]]], ['touchEnd', []]],
    ['touchstart touches[0@100] changed[0@100]', 'touchstart touches[0@100,1@200] changed[1@200]', 'touchstart touches[0@100,1@200,2@300] changed[2@300]', 'touchend touches[1@200,2@300] changed[0@100]', 'touchend touches[1@200] changed[2@300]', 'touchend touches[] changed[1@200]']],
];

const PAGE = '<body style="margin:0"><div id="p" style="width:400px;height:600px;touch-action:none"></div><script>'
  + 'window.log=[];for(const t of ["touchstart","touchmove","touchend","touchcancel"])document.getElementById("p").addEventListener(t,(e)=>{'
  + 'e.preventDefault();const f=(l)=>[...l].map((x)=>x.identifier+"@"+Math.round(x.clientX)).join(",");'
  + 'log.push(t+" touches["+f(e.touches)+"] changed["+f(e.changedTouches)+"]");},{passive:false});</script>';

(async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const version = browser.version();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 600 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.setContent(PAGE);
  const cdp = await ctx.newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: 300, id: p[1] })) });
  const changed = [];
  for (const [id, what, steps, want] of CASES) {
    await page.evaluate(() => { window.log.length = 0; });
    for (const [type, pts] of steps) {
      try { await send(type, pts); } catch (e) { await page.evaluate((m) => window.log.push('ERROR ' + m), type + ': ' + String(e.message).split('\n')[0]); }
    }
    const got = await page.evaluate(() => window.log.slice());
    const same = got.length === want.length && got.every((l, k) => l === want[k]);
    if (!same) changed.push(id);
    if (!quiet || !same) {
      console.log((same ? 'same    ' : 'CHANGED ') + id + ': ' + what);
      for (const l of got) console.log('    ' + l);
      if (!same) { console.log('  expected:'); for (const l of want) console.log('    ' + l); }
    }
    await send('touchCancel', []).catch(() => {});
  }
  await browser.close();
  if (changed.length) { console.log('CDP-TOUCH: CHANGED chromium=' + version + ' cases=' + changed.join(',')); process.exit(1); }
  console.log('CDP-TOUCH: AS-DOCUMENTED chromium=' + version);
})().catch((e) => { console.error(e); console.log('CDP-TOUCH: CHANGED chromium=unknown cases=crash'); process.exit(1); });
