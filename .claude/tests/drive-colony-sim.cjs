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
 * 400 ticks in one frame (a hidden tab never bursts). Prints DRIVE: GREEN / RED.
 */
'use strict';
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..', '..');
const PAGE = path.join(root, 'games', 'colony-sim', 'index.html');
const shots = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let fails = 0, passes = 0;
const check = (n, c, d) => { if (c) { passes++; console.log('  ok   ' + n); } else { fails++; console.log('  FAIL ' + n + (d !== undefined ? '  — ' + d : '')); } };

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
  });
  check('the island draws (≥ 8 distinct colours)', colours >= 8, colours);
  if (shots) await page.screenshot({ path: path.join(shots, 'colony-overview.png') });

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
