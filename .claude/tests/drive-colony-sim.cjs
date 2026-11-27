#!/usr/bin/env node
/**
 * drive-colony-sim.cjs — games/colony-sim/: the page in Chromium, plus the headless
 * simulation suite (games/colony-sim/tools/test-sim.mjs) so one gate covers both.
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules node .claude/tests/drive-colony-sim.cjs [--shots <dir>]
 *
 * Page checks: loads with no console errors; WebGL draws (non-blank, several colours);
 * the follow dropdown selects each settler, opens their panel and flies the camera to them;
 * 16x advances the clock; a ▲ in a settler's Next list reorders their plan (input logged);
 * a goal's ▲ reorders the board; a rightward drag (mouse, one finger) turns yaw up and Q / E keep
 * their direction (Q up, E down); a save survives a reload (Continue = same day and minute);
 * a corrupt save starts a fresh island without an error; a huge time backlog is capped at
 * 400 ticks in one frame (a hidden tab never bursts). The real sky (zmh-sky), each row rendering
 * G.R.frame itself at a set clock and camera and reading pixels in the same task: the frame handed to
 * the kit is right-handed; day 1 06:30's sun is east, north of east, and a hot disc sits where the kit
 * says (none on the anti-sun side); the sky does not change when only the camera slides; stars show
 * on a dark night; the moon waxes new (day 1) to full (day 15); the sea reaches the sky with no black
 * band from high up; the ⓘ panel credits the star data
 * and its licence file ships. Prints DRIVE: GREEN / RED.
 */
'use strict';
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..', '..');
const PAGE = path.join(root, 'games', 'colony-sim', 'index.html');
const shots = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let fails = 0, passes = 0;
const check = (n, c, d, show) => { if (c) { passes++; console.log('  ok   ' + n + (show && d !== undefined ? '  — ' + d : '')); } else { fails++; console.log('  FAIL ' + n + (d !== undefined ? '  — ' + d : '')); } };

(async () => {
  console.log('[headless simulation]');
  try {
    const out = execFileSync(process.execPath, [path.join(root, 'games', 'colony-sim', 'tools', 'test-sim.mjs')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const last = out.trim().split('\n').pop();
    check('test-sim.mjs is green', /SIM-TESTS: GREEN/.test(last), last);
  } catch (e) { check('test-sim.mjs is green', false, String(e.stdout || e).split('\n').filter((l) => /FAIL|RED/.test(l)).join(' | ')); }

  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch (e) { console.log('playwright-core not resolvable (set NODE_PATH)'); console.log('DRIVE: RED'); process.exit(1); }
  const exe = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean).find((p) => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  console.log('[page]');
  await page.goto(pathToFileURL(PAGE).href);
  await frames(8);
  check('loads with no console errors', errs.length === 0, errs.join(' | '));

  // WebGL draws: render a frame and copy it in the same task (no preserveDrawingBuffer needed)
  const colours = await page.evaluate(() => {
    const G = window.__CS.G, c = document.getElementById('view');
    G.R.frame(G.sim, G.rigs, (i) => [], performance.now() / 1000, { colors: G.colors, selected: null });
    const k = document.createElement('canvas'); k.width = 64; k.height = 40; const x = k.getContext('2d'); x.drawImage(c, 0, 0, 64, 40);
    const d = x.getImageData(0, 0, 64, 40).data, set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
    return set.size;
  }).catch((e) => 'frame threw: ' + String(e.message).split('\n')[0]);
  check('the island draws (≥ 8 distinct colours)', colours >= 8, colours);
  if (shots) await page.screenshot({ path: path.join(shots, 'colony-overview.png') });

  // The real sky (zmh-sky). Each row sets the clock and the camera, calls G.R.frame itself and reads
  // pixels in the same task (no preserveDrawingBuffer needed), then puts the clock, the speed and the
  // camera back so the rows below see what they did before. A throw is a failed row, never a crash.
  await page.evaluate(() => {
    const G = window.__CS.G, cv = document.getElementById('view');
    const T = window.__skyT = {
      run(fn) {
        const k = G.R.cam, was = { t: G.sim.t, speed: G.speedIdx, following: G.following, cam: Object.assign({}, k) };
        G.speedIdx = 0; G.following = false;
        try { return fn(T); } catch (e) { return { err: String(e && e.message || e).split('\n')[0] }; }
        finally { G.sim.t = was.t; G.speedIdx = was.speed; G.following = was.following; Object.assign(k, was.cam); }
      },
      // set the clock and (part of) the camera, draw one frame, return what it returned
      draw(t, cam) { G.sim.t = t; Object.assign(G.R.cam, { fly: null }, cam); return G.R.frame(G.sim, G.rigs, () => [], performance.now() / 1000, { colors: G.colors, selected: null }); },
      // the canvas as 8-bit RGBA at full size, copied in the task that drew it
      px() { const k = document.createElement('canvas'); k.width = cv.width; k.height = cv.height; const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, k.width, k.height); },
      lum(d, i) { return Math.max(d[i], d[i + 1], d[i + 2]); },
      median(d, rows) { const h = new Uint32Array(256); for (let i = 0; i < rows * cv.width * 4; i += 4) h[T.lum(d, i)]++; let n = 0, half = rows * cv.width / 2; for (let v = 0; v < 256; v++) { n += h[v]; if (n >= half) return v; } return 255; },
    };
  });
  const HOT_FLOOR = 500, STAR_FLOOR = 60;   // measured: ~2300 pixels at 250+ round the sun (0 on the anti-sun side), ~121-125 star pixels over 3x the median; each floor is well under half
  const sky = (fn) => page.evaluate((src) => window.__skyT.run(new Function('T', 'return (' + src + ')(T)')), fn.toString());
  const f2 = (v) => Array.isArray(v) ? '[' + v.map(f2).join(', ') + ']' : (typeof v === 'number' ? +v.toFixed(3) : v);

  // 1. the frame handed to the kit is right-handed (a mirror passes every number except this one)
  const hand = await sky((T) => { const o = T.draw(12 * 3600, {}); return { h: o.light.handedness }; });
  check("the sky's frame is right-handed (handedness +1)", hand.h === 1, JSON.stringify(hand));

  // 2. day 1 at 06:30: the sun is in the east, north of east, and the sky is bright where the kit says it is
  const rise = await sky((T) => {
    const G = window.__CS.G, k = G.R.cam, cv = document.getElementById('view');
    const probe = T.draw(6.5 * 3600, {}), d = probe.light.sun.dir, alt = probe.light.sun.altDeg;
    // look along the sun's azimuth from high up (the sun is a few degrees up, so no hill can hide it);
    // the eye sits at target + (cos yaw, ., sin yaw), so yaw = atan2(-dz, -dx) looks along (dx, dz)
    T.draw(6.5 * 3600, { ty: 150, dist: 300, pitch: 0.2, yaw: Math.atan2(-d[2], -d[0]) });
    const sp = G.R.project(k.tx + 1e5 * d[0], k.ty + 1e5 * d[1], k.tz + 1e5 * d[2]);
    if (!sp) return { d, alt, why: 'the sun is behind the camera' };
    const im = T.px(), s = cv.width / cv.clientWidth, cx = sp.sx * s, cy = sp.sy * s, R = 40 * s;
    // the brightest pixel within 40 px of the sun's screen point, and how many pixels there are hot (the disc)
    const near = (im) => { let peak = 0, hot = 0; for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(im.height, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(im.width, Math.ceil(cx + R)); x++) {
      if (Math.hypot(x - cx, y - cy) > R) continue;
      const i = (y * im.width + x) * 4, v = T.lum(im.data, i); if (v > peak) peak = v;
      if (v >= 250) hot++;
    } return { peak, hot }; };
    const a = near(im), median = T.median(im.data, im.height);
    // the same screen point with the camera turned round to the anti-sun side: no disc there
    T.draw(6.5 * 3600, { yaw: k.yaw + Math.PI });
    const b = near(T.px());
    return { d, alt, at: [Math.round(cx), Math.round(cy)], peak: a.peak, hot: a.hot, median, awayPeak: b.peak, awayHot: b.hot };
  });
  check('day 1 sunrise is in the east, north of east, and bright there',
    !rise.err && !rise.why && rise.d[0] > 0.8 && rise.d[2] < -0.2 && rise.alt > -2 && rise.peak >= 250 && rise.peak - rise.median >= 80 && rise.peak - rise.awayPeak >= 40 && rise.hot >= HOT_FLOOR && rise.awayHot === 0,
    JSON.stringify(f2(rise)), true);

  // 3. the sky is a function of the clock only: sliding the camera (and its eye) 28 m sideways changes nothing
  const still = await sky((T) => {
    const cv = document.getElementById('view'), out = {};
    for (const [name, t] of [['09:00', 9 * 3600], ['23:00', 23 * 3600]]) {
      const k = Object.assign({}, window.__CS.G.R.cam), base = { ty: 150, dist: 300, pitch: 0.15 };
      T.draw(t, Object.assign({ tx: k.tx, tz: k.tz }, base)); const a = T.px();
      T.draw(t, Object.assign({ tx: k.tx + 20, tz: k.tz + 20 }, base)); const b = T.px();
      const n = Math.floor(a.height * 0.2) * a.width * 4; let sum = 0, big = 0;
      for (let i = 0; i < n; i += 4) { let m = 0; for (let c = 0; c < 3; c++) { const df = Math.abs(a.data[i + c] - b.data[i + c]); sum += df; if (df > m) m = df; } if (m > 2) big++; }
      out[name] = { mean: sum / (n / 4 * 3), big };
    }
    return out;
  });
  check('the sky does not move when only the camera does (top fifth, 09:00 and 23:00)',
    !still.err && still['09:00'].mean < 0.05 && still['23:00'].mean < 0.05 && still['09:00'].big === 0 && still['23:00'].big === 0, JSON.stringify(f2(still)), true);

  // 4. stars: day 1 at 23:00, no moon up, the camera tilted to look up (target 250 m up, eye below it)
  const stars = await sky((T) => {
    const cv = document.getElementById('view'), o = T.draw(23 * 3600, { ty: 250, dist: 100, pitch: -0.6, yaw: 0 }), im = T.px();
    const rows = Math.floor(im.height * 0.6), med = T.median(im.data, rows), thr = 3 * Math.max(med, 4);
    let n = 0; for (let i = 0; i < rows * im.width * 4; i += 4) if (T.lum(im.data, i) > thr) n++;
    return { n, med, thr, moonAlt: o.light.moon.altDeg };
  });
  check('stars show on a dark night (pixels over 3x the sky\'s median, day 1 23:00)', !stars.err && stars.n >= STAR_FLOOR, JSON.stringify(f2(stars)), true);

  // 5. the calendar: each game day is the next date, so the moon waxes from new to full
  const moon = await sky((T) => ({ d1: T.draw(20 * 3600, {}).light.moon.illuminatedFraction, d15: T.draw(14 * 86400 + 20 * 3600, {}).light.moon.illuminatedFraction }));
  check('the calendar advances the moon (new on day 1, full on day 15)', !moon.err && moon.d1 < 0.1 && moon.d15 > 0.9, JSON.stringify(f2(moon)), true);

  // 5b. the sea reaches the sky: no black band between the far water and the horizon. The kit shades
  // below the horizon black and the sea mesh ends a few km out, so from high up a band showed there
  // (CD, 2026-11-27). In daylight from 900 m out and up, nothing on screen is near-black.
  const band = await sky((T) => {
    const out = {};
    for (const [name, t, pitch] of [['noon', 12 * 3600, 0.5], ['17:30', 17.5 * 3600, 0.3]]) {
      T.draw(t, { dist: 900, pitch }); const im = T.px(); let n = 0;
      for (let i = 0; i < im.data.length; i += 4) if (T.lum(im.data, i) < 12) n++;
      out[name] = n;
    }
    return out;
  });
  check('the sea reaches the sky (no near-black pixels from high up in daylight)', !band.err && band.noon === 0 && band['17:30'] === 0, JSON.stringify(band), true);

  // 6. the credit for the star data is on the info page and the licence it links to ships beside index.html
  const credit = await page.evaluate(() => {
    document.getElementById('info-btn').click();
    const card = document.getElementById('overlay-card'), a = card.querySelector('a[href*="LICENSE-d3-celestial"]'), r = { text: card.textContent, href: a && a.getAttribute('href') };
    const ok = document.getElementById('ov-ok'); if (ok) ok.click();
    return r;
  });
  const licFile = credit.href && path.join(path.dirname(PAGE), credit.href);
  check('the ⓘ panel credits the star data and its licence ships',
    credit.text.includes('XHIP (Anderson & Francis 2012) via d3-celestial') && !!licFile && fs.existsSync(licFile) && /BSD|Redistribution/i.test(fs.readFileSync(licFile, 'utf8')),
    JSON.stringify({ href: credit.href, exists: !!licFile && fs.existsSync(licFile) }));

  // follow each settler
  const follow = [];
  for (const id of [0, 1, 2, 3]) {
    await page.selectOption('#follow-sel', String(id));
    await frames(40);
    follow.push(await page.evaluate((id) => {
      const G = window.__CS.G, p = G.rigs[id].J[0], c = G.R.cam;
      const name = document.querySelector('#settler-body h2');
      return { shown: !document.getElementById('settler').classList.contains('hidden'), name: name && name.textContent, want: G.sim.settlers[id].name, d: Math.hypot(c.tx - p.x, c.tz - p.z), dist: c.dist };
    }, id));
  }
  check('follow menu selects each settler and opens their panel', follow.every((f) => f.shown && f.name === f.want), JSON.stringify(follow.map((f) => f.name)));
  check('…and flies the camera to them (target within 2 m, close in)', follow.every((f) => f.d < 2 && f.dist <= 12), JSON.stringify(follow.map((f) => f.d.toFixed(1) + '@' + f.dist.toFixed(0))));
  if (shots) await page.screenshot({ path: path.join(shots, 'colony-follow.png') });

  // camera rotation: a rightward drag turns yaw UP (inverted 2026-11-26); Q / E keep their direction
  const aim = await page.evaluate(() => {
    document.activeElement && document.activeElement.blur(); // the follow rows leave focus on a SELECT, which swallows every key
    const G = window.__CS.G; G.following = false; G.speedIdx = 0;
    const r = document.getElementById('view').getBoundingClientRect(), x = r.left + r.width * 0.3, y = r.top + r.height * 0.55, el = document.elementFromPoint(x, y);
    return { x, y, id: el && el.id, tag: el && el.tagName, cls: el && String(el.className) };
  });
  const yawNow = () => page.evaluate(() => window.__CS.G.R.cam.yaw);
  let y0 = await yawNow();
  await page.mouse.move(aim.x, aim.y); await page.mouse.down(); await page.mouse.move(aim.x + 120, aim.y, { steps: 6 }); await page.mouse.up();
  await frames(2);
  let y1 = await yawNow();
  check('a rightward mouse drag turns the camera the new way (yaw +0.72)', aim.id === 'view' && y1 - y0 > 0.6 && y1 - y0 < 0.85, (y1 - y0).toFixed(3) + ' from ' + JSON.stringify(aim));
  y0 = y1;
  const hasTouch = await page.evaluate(() => typeof Touch === 'function' && typeof TouchEvent === 'function');
  if (hasTouch) {
    await page.evaluate(({ x, y }) => {
      const c = document.getElementById('view');
      const mk = (cx) => new Touch({ identifier: 1, target: c, clientX: cx, clientY: y });
      const fire = (type, cx, live) => c.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: live ? [mk(cx)] : [], targetTouches: live ? [mk(cx)] : [], changedTouches: [mk(cx)] }));
      fire('touchstart', x, true);
      for (let i = 1; i <= 6; i++) fire('touchmove', x + 20 * i, true);
      fire('touchend', x + 120, false);
    }, aim);
  } else {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: aim.x, y: aim.y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: aim.x + 20 * i, y: aim.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await frames(2);
  y1 = await yawNow();
  check('a rightward one-finger drag turns the same way as the mouse', y1 - y0 > 0.6 && y1 - y0 < 0.85, (y1 - y0).toFixed(3) + (hasTouch ? ' (Touch events)' : ' (CDP)'));
  y0 = y1;
  await page.keyboard.down('q'); await frames(20); await page.keyboard.up('q');
  const dq = (await yawNow()) - y0; y0 += dq;
  await page.keyboard.down('e'); await frames(20); await page.keyboard.up('e');
  const de = (await yawNow()) - y0;
  check('Q / E still turn the way they did (Q yaw up, E yaw down)', dq > 0 && de < 0, 'Q ' + dq.toFixed(3) + ', E ' + de.toFixed(3));

  // 16x advances the clock
  const t0 = await page.evaluate(() => window.__CS.G.sim.t);
  await page.click('.spd[data-i="5"]');
  await page.waitForFunction((t0) => window.__CS.G.sim.t - t0 >= 4 * 3600, t0, { timeout: 60000 }).catch(() => {});
  const t1 = await page.evaluate(() => window.__CS.G.sim.t);
  check('16× advances the clock ≥ 4 game hours', t1 - t0 >= 4 * 3600, ((t1 - t0) / 3600).toFixed(1) + ' h');
  await page.click('.spd[data-i="0"]');
  check('the clock label shows the day', /Day \d+ · \d\d:\d\d/.test(await page.textContent('#clock')));

  // control B: ▲ in the Next list
  await page.selectOption('#follow-sel', '1');
  await frames(10);
  const re = await page.evaluate(async () => {
    const G = window.__CS.G, s = G.sim.settlers[1];
    if (s.plan.length < 2) s.plan.push({ id: 99901, kind: 'gather', label: 'Gather stone', owner: 'leader' });
    window.__CS.G.R && (window.__CS.api.input({ type: 'noop' }));
    await new Promise((r) => setTimeout(r, 400));
    const before = s.plan.map((p) => p.id);
    const btn = document.querySelector('#s-next button[data-a="up"][data-i="1"]');
    if (!btn) return { ok: false, why: 'no ▲ button' };
    btn.click();
    return { ok: true, before, after: s.plan.map((p) => p.id), logged: G.sim.inputs.slice(-1)[0] };
  });
  check('▲ in Next moves a job earlier and the order is recorded', re.ok && re.after[0] === re.before[1] && re.logged && re.logged.type === 'reorder', JSON.stringify(re));

  // control A: goal ▲
  const gm = await page.evaluate(() => {
    const G = window.__CS.G, before = G.sim.goals.slice();
    const btn = document.querySelector('#goal-list button[data-a="up"][data-g="' + before[3] + '"]'); btn.click();
    return { before: before.slice(2, 4), after: G.sim.goals.slice(2, 4) };
  });
  check('a goal ▲ reorders the board', gm.after[0] === gm.before[1] && gm.after[1] === gm.before[0], JSON.stringify(gm));

  // save and reload
  const at = await page.evaluate(() => { const S = window.__CS.G.sim; return { t: S.t, seed: S.seed }; });
  await page.reload(); await frames(5);
  const cont = await page.evaluate(() => { const b = document.getElementById('ov-go'); if (!b) return null; b.click(); return true; });
  await frames(3);
  const after = await page.evaluate(() => { const S = window.__CS.G.sim; return { t: S.t, seed: S.seed }; });
  check('a reload offers Continue and restores the same island and minute', cont && after.seed === at.seed && Math.abs(after.t - at.t) < 60, JSON.stringify({ at, after }));

  // a corrupt save
  // (detach the game first, or its save-on-unload would overwrite the planted blob)
  await page.evaluate(() => { window.__CS.G.sim = null; localStorage.setItem('colonySim.v1', '{"v":1,"snap":{"seed":"x"'); });
  errs.length = 0;
  await page.reload(); await frames(8);
  const fresh = await page.evaluate(() => ({ day: window.__CS.G.sim && Math.floor(window.__CS.G.sim.t / 86400) + 1, bad: !!localStorage.getItem('colonySim.bad'), overlay: !!document.getElementById('ov-go') }));
  check('a corrupt save starts a fresh island, keeps the bad blob aside, no error', fresh.day === 1 && fresh.bad && !fresh.overlay && errs.length === 0, JSON.stringify(fresh) + ' ' + errs.join('|'));

  // a save that parses but is structurally wrong (an older build's shape) also starts fresh
  await page.evaluate(() => { const snap = JSON.parse(localStorage.getItem('colonySim.v1') || 'null') || null; window.__CS.G.sim = null; localStorage.removeItem('colonySim.bad');
    const o = snap || { v: 1, snap: { seed: 5, t: 0, tick: 0, settlers: [{}] } }; if (o.snap.settlers && o.snap.settlers[0]) delete o.snap.settlers[0].m; localStorage.setItem('colonySim.v1', JSON.stringify(o)); });
  errs.length = 0;
  await page.reload(); await frames(8);
  const half = await page.evaluate(() => ({ day: window.__CS.G.sim && Math.floor(window.__CS.G.sim.t / 86400) + 1, bad: !!localStorage.getItem('colonySim.bad'), overlay: !!document.getElementById('ov-go') }));
  check('a save with a settler missing its meters starts a fresh island, no error', half.day === 1 && half.bad && !half.overlay && errs.length === 0, JSON.stringify(half) + ' ' + errs.join('|'));

  // speech bubbles: shown once, gone after 8 real seconds, no churn
  const bub = await page.evaluate(async () => {
    const G = window.__CS.G, sim = G.sim; G.speedIdx = 0;
    sim.bubbles.push({ id: 900001, sid: 0, t: sim.t, text: 'first line', kind: 'say' }, { id: 900002, sid: 0, t: sim.t, text: 'second line', kind: 'say' });
    let created = 0; const root = document.getElementById('bubbles');
    const mo = new MutationObserver((ms) => { for (const m of ms) created += m.addedNodes.length; }); mo.observe(root, { childList: true });
    await new Promise((r) => setTimeout(r, 1500)); const early = root.children.length;
    await new Promise((r) => setTimeout(r, 8500)); mo.disconnect();
    return { early, late: root.children.length, created };
  });
  check('a speech bubble shows, then is gone after 8 s while paused', bub.early >= 1 && bub.late === 0, JSON.stringify(bub));
  check('…and is created once, not re-created every frame', bub.created <= 2, JSON.stringify(bub));

  // panning off the north edge with sound on must not stop the page
  errs.length = 0;
  const edge = await page.evaluate(async () => {
    const G = window.__CS.G, A = window.__CS.audio; A.init(); if (A.muted) A.setMuted(false); if (!A.ctx) return { noAudio: true };
    G.speedIdx = 3; G.R.cam.tz = -90; G.R.cam.tx = 500; G.R.cam.dist = 30;
    const t0 = G.sim.t, c0 = document.getElementById('clock').textContent;
    await new Promise((r) => setTimeout(r, 2500));
    return { advanced: G.sim.t - t0, clock: c0 !== document.getElementById('clock').textContent };
  });
  check('panned off the island with sound on: no errors and the clock still runs', errs.length === 0 && edge.advanced > 0 && edge.clock, JSON.stringify(edge) + ' ' + errs.join('|'));

  // a new island autosaves on its own clock
  const ng = await page.evaluate(() => { const G = window.__CS.G; for (let i = 0; i < 8640 * 2; i++) window.__CS.step(G.sim); G.lastSave = G.sim.t; window.__CS.api.newGame(4242); return { lastSave: G.lastSave, t: G.sim.t }; });
  check('starting a new island resets the autosave clock', ng.lastSave === ng.t, JSON.stringify(ng));

  // a time backlog (a hidden tab) is capped
  const cap = await page.evaluate(async () => {
    const G = window.__CS.G; G.speedIdx = 5; const k0 = G.sim.tick; G.acc = 1e9;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { ran: G.sim.tick - k0, acc: G.acc };
  });
  check('a backlog runs at most ~400 ticks a frame and is then dropped', cap.ran <= 820 && cap.acc < 1e6, JSON.stringify(cap));
  check('no console errors through the whole drive', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(fails ? `DRIVE: RED (${passes} passed, ${fails} failed)` : `DRIVE: GREEN (${passes} passed)`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('suite crashed: ' + (e && e.stack || e)); console.log('DRIVE: RED'); process.exit(1); });
