#!/usr/bin/env node
/**
 * eval-music-mixer-runtime.cjs — runtime gate for Music Mixer.
 *
 * eval-music-mixer.cjs proves the NOTATION is well formed. This proves the
 * two things that only a browser can: the SOUND path (every pattern character
 * in all five songs reaches a voice that can render it, the transport
 * schedules notes, holding every pad produces a non-silent signal at the
 * limiter) and the CONTACT-PATCH hit test (one fingertip on a seam holds both
 * pads, and the CD's eight-finger grip really does hold all fifteen).
 *
 * Two things make this worth a Chromium launch. First, a voice that throws on
 * one character (a gong handed an 'X', a filter handed a NaN frequency) kills
 * the whole scheduling tick, so one bad char silences fourteen good tracks —
 * and only for the sections that use it, which a live listen may never reach.
 * Second, "the pads light up" is not evidence of audio: the lamp is CSS and
 * runs fine with the audio graph completely dead.
 *
 * Usage: NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
 *          node .claude/tests/eval-music-mixer-runtime.cjs
 *
 * Final line: MIXER-RUNTIME: GREEN | RED   (exit 0 / 1)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PAGE = path.join(process.cwd(), 'games', 'music-mixer', 'index.html');
const CHROME = process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium';
const problems = [];
const fail = (m) => problems.push(m);
const NOISE = /fonts\.googleapis|fonts\.gstatic|net::ERR_|favicon/i;

(async () => {
  if (!fs.existsSync(PAGE)) { console.log('MIXER-RUNTIME: RED'); console.error('missing ' + PAGE); process.exit(1); }
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push('console: ' + m.text()); });

  await page.goto('file://' + PAGE);
  await page.waitForTimeout(900);

  if (!(await page.evaluate(() => !!window.__MM))) {
    fail('the page exposes no __MM test hook');
  } else {
    /* --- 1. does an AudioContext come up at all? --------------------- */
    const up = await page.evaluate(() => window.__MM.audio());
    if (!up) fail('initAudio() did not produce a running AudioContext');
    await page.evaluate(() => window.__MM.probe());

    /* --- 2. every pattern character through its real voice ----------- */
    const n = await page.evaluate(() => {
      try { return window.__MM.audition(); } catch (e) { return 'THREW: ' + e.message; }
    });
    if (typeof n !== 'number') fail('audition() ' + n);
    else if (n < 250) fail('audition() only exercised ' + n + ' voice/character pairs, expected 250+');
    else console.log('AUDITIONED=' + n);
    await page.waitForTimeout(500);

    /* --- 3. per song: transport runs, pads sound, nothing throws ----- */
    const peaks = [];
    for (let i = 0; i < 5; i++) {
      const before = errs.length;
      await page.evaluate((k) => { window.__MM.select(k); window.__MM.holdAll(true); }, i);
      await page.waitForTimeout(1500);
      let peak = 0;
      for (let s = 0; s < 22; s++) {
        peak = Math.max(peak, await page.evaluate(() => window.__MM.level()));
        await page.waitForTimeout(55);
      }
      const st = await page.evaluate(() => window.__MM.state());
      const tag = st.song;
      if (!st.playing) fail(tag + ': transport is not running after a hold');
      if (st.held !== 15) fail(tag + ': holdAll left ' + st.held + '/15 pads held');
      if (st.step < 6) fail(tag + ': only ' + st.step + ' steps scheduled in 1.5 s');
      if (st.dur < 285 || st.dur > 315) fail(tag + ': duration ' + st.dur + 's outside 285-315');
      if (!(peak > 0.02)) fail(tag + ': signal at the limiter peaked at ' + peak.toFixed(4) +
        ' with all 15 pads held — effectively silent');
      if (peak > 0.99) fail(tag + ': signal peaked at ' + peak.toFixed(3) + ' — the limiter is being overrun');
      if (errs.length > before)
        fail(tag + ': threw while playing -> ' + errs.slice(before).join(' | '));
      peaks.push(peak);
      console.log('PLAYED=' + tag + ' step=' + st.step + ' peak=' + peak.toFixed(3) +
                  ' bars=' + st.bars + ' dur=' + st.dur + 's');
      await page.evaluate(() => window.__MM.holdAll(false));
      await page.waitForTimeout(200);
    }

    /* --- 3b. the five songs must be level-matched -------------------- */
    if (peaks.length === 5) {
      const lo = Math.min(...peaks), hi = Math.max(...peaks);
      console.log('LEVELS=' + peaks.map((x) => x.toFixed(3)).join(' ') + '  spread=' + (hi / lo).toFixed(2) + 'x');
      if (hi / lo > 2.2)
        fail('song levels span ' + (hi / lo).toFixed(2) + 'x (max 2.2x) — retune the per-song `mix` trims ' +
             'so the dropdown is not also a volume control');
    }

    /* --- 4. releasing everything really does go quiet ---------------- */
    await page.waitForTimeout(700);
    let quiet = 1;
    for (let s = 0; s < 8; s++) {
      quiet = Math.min(quiet, await page.evaluate(() => window.__MM.level()));
      await page.waitForTimeout(60);
    }
    if (quiet > 0.004) fail('releasing every pad left ' + quiet.toFixed(4) +
      ' of signal — a track is latching when nothing should sustain');
    else console.log('RELEASED_FLOOR=' + quiet.toFixed(5));

    /* --- 5. the contact patch: seams, crossings, and the CD's grip ---- */
    /* Every point below is derived from the live pad rectangles, so this
       checks the real geometry rather than numbers typed from a screenshot. */
    const geom = await page.evaluate(() => {
      const pads = [...document.querySelectorAll('.pad')].map((p) => p.getBoundingClientRect());
      const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      /* portrait: pad i sits at column i/5, and i%5 climbs from the bottom */
      const mid = (a, b) => ({ x: (c(pads[a]).x + c(pads[b]).x) / 2,
                               y: (c(pads[a]).y + c(pads[b]).y) / 2 });
      return {
        centre: c(pads[0]),
        seam01: mid(0, 1),                       // one seam inside column 0
        cross: mid(5, 11),                       // where pads 5,6,10,11 meet
        colSeams: [mid(0, 1), mid(1, 2), mid(2, 3), mid(3, 4)],
        crossings: [mid(5, 11), mid(6, 12), mid(7, 13), mid(8, 14)],
      };
    });
    const press = async (pts) => page.evaluate((arg) => {
      const g = document.getElementById('grid');
      const fire = (type, id, x, y, target) => target.dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true,
        pointerType: 'touch', isPrimary: id === 1,
      }));
      arg.pts.forEach((p, k) => fire('pointerdown', 20 + k, p.x, p.y, g));
      const n = window.__MM.state().held;
      arg.pts.forEach((p, k) => fire('pointerup', 20 + k, p.x, p.y, window));
      return { n, after: window.__MM.state().held };
    }, { pts });

    const cases = [
      ['a fingertip in the middle of one pad', [geom.centre], 1],
      ['a fingertip laid across one seam', [geom.seam01], 2],
      ['a fingertip on a four-pad crossing', [geom.cross], 4],
      ['four fingers down one column\'s seams', geom.colSeams, 5],
      ['four fingers on two columns\' crossings', geom.crossings, 10],
      ['the CD\'s eight-finger grip', geom.colSeams.concat(geom.crossings), 15],
    ];
    for (const [what, pts, want] of cases) {
      const r = await press(pts);
      if (r.n !== want) fail('contact patch: ' + what + ' held ' + r.n + ' pads, expected ' + want);
      else console.log('TOUCH=' + want + '  ' + what);
      if (r.after !== 0) fail('contact patch: ' + what + ' left ' + r.after + ' pads stuck on after release');
      await page.waitForTimeout(60);
    }
    /* with the spread dialled to zero a seam press must fall between the pads */
    await page.evaluate(() => {
      const s = document.getElementById('spread');
      s.value = '0';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const zero = await press([geom.seam01]);
    if (zero.n !== 0) fail('with touch spread at 0 a seam press still held ' + zero.n + ' pads');
    else console.log('TOUCH=0  seam press with spread dialled to zero');
  }

  for (const e of errs) fail(e);
  await browser.close();

  console.log('');
  console.log('PROBLEMS=' + problems.length);
  for (const p of problems) console.log('  - ' + p);
  console.log('MIXER-RUNTIME: ' + (problems.length ? 'RED' : 'GREEN'));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  console.log('MIXER-RUNTIME: RED');
  process.exit(1);
});
