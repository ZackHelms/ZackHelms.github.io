#!/usr/bin/env node
/**
 * drive-taas-factory-ui.cjs — TAAS's robot factory page, in Chromium (~40 s).
 *
 * drive-taas-factory.cjs proves the engine. This proves the page: the mode dropdown (its name
 * on the button, ?mode=, the remembered choice, the factory's loop stopping in formal mode),
 * that a tap at the pixel where a thing is DRAWN reaches that thing at every viewport and scroll,
 * and where two overlap the one in front (the canvas-space rule in games/CLAUDE.md), the red button that glows when ready and goes dark
 * while it runs, the first loop played with real touches (walk, press, the log's $1 in red below
 * zero, the plank into your arms from the output bin, round to the counter, a customer who walks
 * in at the door and buys it, $4), a drag that scrolls and never walks, hiring and the stocking
 * job through the bubble, a robot's page (its name, its base prompt, buying a slot and giving it
 * an instruction, all by real taps, the stocker's "looking for plank" count, its Evals with their
 * colours and words for every size and quality, a real tap on Reset evals), the scene read off
 * pixels (the recycle bin, a gnarled log's holes in the same places on its plank, sap logs, three
 * lengths of plank, the slots' numbers, the saw's blade spinning only while it cuts, the
 * extractor's tank filling), the wall (money, customer satisfaction, a window in the middle and
 * the goal across the top) and the counter's label (the price a customer pays, falling with
 * customer satisfaction), the shop in real time (a customer at the door, waiting at the stall
 * with an hourglass, satisfaction falling 0.1% a second, paying, leaving), your arms and the
 * bubbles (the recycle bin's put and take, an input bin, the saw's three cuts), the build badge
 * in the bottom right corner in both modes, the info panel opened from the menu, saves that
 * survive a reload without touching the formal mode's, re-measuring after a resize while hidden,
 * the chrome and bubble all on screen at phone, landscape and desktop sizes, people who keep
 * their hair turned toward the camera (customers and the avatar under its hat), and the delay
 * between tasks (on the list from the start; its slider and - / + under the slot, set in the
 * engine, stopping at 0 and 60, never redrawn under a dragging finger, surviving a reload; its
 * evals lines; the pause sign over a waiting robot and its emptying ring, read off pixels; the
 * slot row at 320 and 390 wide; Info), and the goals (taasgoals, 2026-10-20: a new factory's empty
 * bays that a tap walks into, the wall's goal counting down, a machine arriving with its float, the
 * slots' new order, the moved bench and saw tapped at three sizes, the floor re-baked with the goal,
 * and the menu's Prices steppers, factory only), and the bins and stalls by hand (step 4: each output bin's halves,
 * the stall's Re-assign / Re-stock / Close and back at three sizes, the green dots and CLOSED read off the label, a jam
 * drawn on each of slots 02-04 and scrubbed by a tap, Info; and fresh() that loads no save). Frames are
 * stepped through the page's own test hook (TAAS_FACTORY, paused), so time is exact; input goes
 * through real touch events.
 *
 * Usage:
 *   node .claude/tests/drive-taas-factory-ui.cjs     (playwright-core on NODE_PATH; gates.sh finds it)
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas-factory-ui.cjs   # negtest-copies
 *
 * Final line: TAAS-FACTORY-UI: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.log('NO-PLAYWRIGHT: playwright-core not resolvable (run via .claude/scripts/gates.sh)'); console.log('TAAS-FACTORY-UI: RED'); process.exit(1); }

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const SRC = fs.readFileSync(PAGE, 'utf8');

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined && detail !== '' ? ' (' + detail + ')' : '')); }
}
const server = http.createServer((req, res) => {
  if (req.url === '/blank') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>blank</title>'); return; }   // (fresh(): somewhere to leave the page for)
  if (!req.url.startsWith('/taas.html')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(SRC);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port, BASE = ORIGIN + '/taas.html';
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('FAIL chromium launches (' + e2.message + ')'); console.log('TAAS-FACTORY-UI: RED'); server.close(); process.exit(1); } }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(u => !String(u).startsWith('http://127.0.0.1'), r => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  const go = async (q) => { await page.goto(BASE + (q || ''), { waitUntil: 'load' }); };
  const H = (fn, arg) => page.evaluate(fn, arg);
  // a clean factory, paused, so the suite owns the clock; `open` meets every goal first, so slots 02-04
  // have their machines, as every factory did before the goals (2026-10-20) and the rows that use them assume.
  // The old page is left for a blank one BEFORE storage is cleared: its pagehide save would otherwise write
  // the previous row's factory back, and the new page first loaded and baked that (traced 2026-10-20, step 3)
  let loaded = null;   // what the new page loaded by itself, before the suite's own factory replaced it
  const fresh = async (seed, open) => {
    await page.goto(ORIGIN + '/blank', { waitUntil: 'load' });
    await H(() => { localStorage.clear(); });
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    loaded = await H(([sd, op]) => { const T = window.TAAS_FACTORY, was = { goal: T.s.goal, money: T.s.money, robots: T.s.robots.length, t: T.s.t, saved: localStorage.getItem('taas.factory.v' + FACTORY.CFG.version) };
      T.paused = true; T.s = FACTORY.newGame(sd || 1); if (op) T.s.goal = FACTORY.CFG.goals.length; T.view.camY = T.view.minY; T.tick(0); return was; }, [seed, !!open]);
  };
  const step = (sec) => H(sec => { const T = window.TAAS_FACTORY; for (let i = 0; i < Math.round(sec * 60); i++) T.tick(1 / 60); }, sec);
  const S = () => H(() => JSON.parse(FACTORY.save(window.TAAS_FACTORY.s)));
  const rectOf = (id) => H(id => window.TAAS_FACTORY.spriteRect(id), id);
  const centre = r => [r.x + r.w / 2, r.y + r.h / 2];
  async function section(name, fn) { try { await fn(); } catch (e) { ok(false, name + ' played through', e.message.split('\n')[0]); } }
  // the ink on a wall board's face, by colour (the face itself is a flat dark slate); `grow` widens
  // the sampled box by that many metres each side, onto the frame, to catch text that overflows
  const boardInk = (k, grow) => H(([k, grow]) => {
    const T = window.TAAS_FACTORY, r = T.board(k), d = T.view.dpr, gx = (grow || 0) * T.view.S;
    const x = Math.round((r.x - gx) * d), y = Math.round(r.y * d), w = Math.round((r.w + 2 * gx) * d), h = Math.round(r.h * d);
    const im = document.getElementById('fx-canvas').getContext('2d').getImageData(x, y, w, h).data;
    const o = { white: 0, red: 0, green: 0, amber: 0, caption: 0, edge: 0 };
    for (let i = 0; i < im.length; i += 4) {
      const R = im[i], G = im[i + 1], B = im[i + 2], px = (i / 4) % w;
      const kind = R > 225 && G > 225 && B > 225 ? 'white' : R > 200 && G < 140 && B < 140 ? 'red' : G > 170 && R < 170 && B < 170 ? 'green' : R > 200 && G > 150 && B < 90 ? 'amber'
        : Math.abs(R - 159) < 22 && Math.abs(G - 176) < 22 && Math.abs(B - 194) < 22 ? 'caption' : '';
      if (kind) { o[kind]++; if (gx && (px < gx * d - 1 || px > w - gx * d)) o.edge++; }
    }
    return o;
  }, [k, grow || 0]);

  // the colour at a world point, averaged over a few pixels; and at a screen point
  const px = (x, y, z) => H(([x, y, z]) => { const T = window.TAAS_FACTORY, p = T.screen(x, y, z), k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); const d = g.getImageData(Math.round(p[0] * k) - 4, Math.round(p[1] * k) - 4, 9, 9).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } return [r / n, gg / n, b / n].map(Math.round); }, [x, y, z]);
  const px2 = p => H(([x, y]) => { const c = document.getElementById('fx-canvas'), g = c.getContext('2d'), k = window.TAAS_FACTORY.view.dpr; const d = g.getImageData(Math.round(x * k) - 3, Math.round(y * k) - 3, 7, 7).data; let r = 0, gg = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; n++; } return [r / n, gg / n]; }, p);
  // the counter label's bright pixels, as a mask: what the figure says
  const plateBits = () => H(() => { const T = window.TAAS_FACTORY, r = T.board('plate'), d = T.view.dpr; const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data; let bits = ''; for (let i = 0; i < im.length; i += 4) bits += im[i] + im[i + 1] + im[i + 2] > 360 ? '1' : '0'; return bits; });

  /* ---------- 1. the mode dropdown ---------- */
  await section('1. mode', async () => {
    await go(); await H(() => localStorage.clear()); await go();
    const f = await H(() => ({ mode: document.documentElement.dataset.mode, wrap: getComputedStyle(document.querySelector('.wrap')).display !== 'none', fac: getComputedStyle(document.getElementById('factory')).display, on: !!(window.TAAS_FACTORY && window.TAAS_FACTORY.on), label: document.getElementById('mode-btn').selectedOptions[0].textContent }));
    ok(f.mode === 'formal' && f.wrap && f.fac === 'none' && !f.on && f.label === 'Formal', 'a first visit opens in formal mode, the dropdown reading "Formal", the factory asleep', JSON.stringify(f));
    await page.selectOption('#mode-btn', 'robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY.on);
    const g = await H(() => ({ mode: document.documentElement.dataset.mode, wrap: getComputedStyle(document.querySelector('.wrap')).display, url: location.search, stored: localStorage.getItem('taas-mode'), label: document.getElementById('mode-btn').selectedOptions[0].textContent, cw: document.getElementById('fx-canvas').width, iw: innerWidth }));
    ok(g.mode === 'robot-factory' && g.wrap === 'none' && /mode=robot-factory/.test(g.url) && g.stored === 'robot-factory' && g.label === 'Robot factory' && g.cw >= g.iw,
      'choosing Robot factory shows the factory, names it on the button, and puts ?mode=robot-factory in the address', JSON.stringify(g));
    await go();
    ok(await H(() => document.documentElement.dataset.mode) === 'robot-factory', 'a reload with no ?mode= keeps the last choice');
    await go('?mode=formal');
    const h = await H(() => ({ mode: document.documentElement.dataset.mode, on: window.TAAS_FACTORY.on, big: !!document.querySelector('.outcome .big') }));
    ok(h.mode === 'formal' && !h.on && h.big, '?mode=formal wins over the remembered choice, and the formal page is all there', JSON.stringify(h));
    await page.selectOption('#mode-btn', 'robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY.on);
    await page.selectOption('#mode-btn', 'formal');
    const t0 = await H(() => window.TAAS_FACTORY.s.t);
    await page.waitForTimeout(300);
    ok(!(await H(() => window.TAAS_FACTORY.on)) && (await H(() => window.TAAS_FACTORY.s.t)) === t0, 'leaving the factory stops its clock (nothing runs behind the formal page)');
  });

  /* ---------- 2. the first loop, with real touches on drawn pixels ---------- */
  await section('2. first loop', async () => {
    await fresh(1);
    await H(() => { window.TAAS_FACTORY.s.shop.next = 1e9; });   // nobody comes in until the suite says so
    const btn = await H(() => { const q = FACTORY.LAYOUT.SOLID.console; return window.TAAS_FACTORY.screen((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, 0.88); });
    const lit = await px2(btn);
    await page.touchscreen.tap(btn[0], btn[1]);
    const t1 = await S();
    ok(t1.avatar.task && t1.avatar.task.kind === 'machine' && t1.avatar.path.length > 0, 'a tap on the drawn red button sends the avatar walking to the planer', JSON.stringify(t1.avatar.task));
    let pressedAt = -1;
    for (let i = 0; i < 40 && pressedAt < 0; i++) { await step(0.1); if ((await H(() => window.TAAS_FACTORY.s.machine.phase)) === 'run') pressedAt = i; }
    const dark = await px2(btn);
    ok(lit[0] > 200 && lit[0] - lit[1] > 120 && dark[0] < lit[0] - 70, 'the button glows red while ready and goes dark once pressed', 'ready rgb ' + lit.map(Math.round) + ', pressed ' + dark.map(Math.round));
    ok(pressedAt > 2, 'the avatar walked first and pressed on arrival', pressedAt);
    await step(5.6);
    const t2 = await S();
    ok(t2.bin.join() === 'plank.m' && t2.money === -0.1, 'four seconds later a medium plank is in the planer\'s output bin, and the press cost $0.10 (the CD, 2026-10-16)', t2.bin.join() + ' / ' + t2.money);
    const neg = await boardInk('cash'), said = await H(() => document.getElementById('fx-score').textContent);
    ok(neg.red > 40 && neg.white < 5 && /^Money -\$0\.10\./.test(said), 'below zero the money board on the wall reads -$0.10, in red (money to the cent)', JSON.stringify(neg) + ' ' + said);
    const bin = await rectOf('binFront');
    await page.touchscreen.tap(centre(bin)[0], bin.y + bin.h * 0.4);
    // (2026-10-20: the output bin opens the recycle bin's bubble, and nothing comes out by itself)
    let binOpen = false;
    for (let i = 0; i < 40 && !binOpen; i++) { await step(0.1); binOpen = await H(() => !!document.querySelector('#fx-bubble [data-opt="take:plank.m"]')); }
    const held0 = await H(() => window.TAAS_FACTORY.s.avatar.inv.length);
    if (binOpen) await page.tap('#fx-bubble [data-opt="take:plank.m"]');
    await step(0.5);
    const t3 = await S();
    ok(binOpen && !held0 && t3.avatar.inv.join() === 'plank.m' && !t3.bin.length, 'a tap on the drawn output bin walks over and opens its bubble, and a real tap on the plank in it takes it into your arms (2026-10-20: it came with no bubble to answer)', t3.avatar.inv.join());
    const counter = await rectOf('counter');
    await page.touchscreen.tap(counter.x + counter.w * 0.85, counter.y + counter.h * 0.7);
    // (2026-10-20: the stall offers Re-assign, Re-stock and Close, and stocks nothing by itself)
    let three = false;
    for (let i = 0; i < 80 && !three; i++) { await step(0.1); three = await H(() => ['assign', 'restock', 'close'].every(id => !!document.querySelector('#fx-bubble [data-opt="' + id + '"]'))); }
    const stocked0 = await H(() => window.TAAS_FACTORY.s.stalls[0].stock.length);
    if (three) { await page.tap('#fx-bubble [data-opt="restock"]'); await step(0.05); }
    if (await page.$('#fx-bubble [data-opt="put:plank.m"]')) await page.tap('#fx-bubble [data-opt="put:plank.m"]');
    await step(0.5);
    const t4 = await S();
    ok(three && !stocked0 && t4.stalls[0].stock.map(g => g.item).join() === 'plank.m' && !t4.avatar.inv.length, 'a tap on the drawn counter walks round to it, and real taps on Re-stock and the plank stock the stall (2026-10-20: it stocked itself)', JSON.stringify(t4.stalls[0].stock));
    // a customer walks in from the door on the left, buys it, and the money comes in
    await H(() => { window.TAAS_FACTORY.s.shop.next = window.TAAS_FACTORY.s.t; });
    await step(0.1);
    const c0 = await H(() => window.TAAS_FACTORY.s.shop.people.map(c => c.x));
    let sold = false;
    for (let i = 0; i < 120 && !sold; i++) { await step(0.1); sold = await H(() => window.TAAS_FACTORY.s.shop.served > 0); }
    await H(() => { window.TAAS_FACTORY.s.shop.next = 1e9; });
    await step(0.05);
    const t5 = await S(), bump = await boardInk('cash');
    await step(0.5);
    const after = await boardInk('cash'), said3 = await H(() => document.getElementById('fx-score').textContent);
    ok(c0.length === 1 && c0[0] < 0.2 && sold && t5.money === 3.9 && !t5.stalls[0].stock.length && bump.green > 40 && bump.red === 0 && after.white > 40 && after.green === 0 && after.red === 0 && /^Money \$3\.90\./.test(said3),
      'a customer comes in at the door on the left and buys it for $4: the money board flashes green, then reads $3.90 in white, out of the red', JSON.stringify([c0, bump, after]) + ' ' + said3);
    await step(1.5);   // the sale's "+$4" floats up past the board first
    const sat0 = await boardInk('sat');
    await H(() => { window.TAAS_FACTORY.s.satisfaction = 70; window.TAAS_FACTORY.tick(1 / 60); });
    const sat70 = await boardInk('sat');
    await H(() => { window.TAAS_FACTORY.s.satisfaction = 55; window.TAAS_FACTORY.tick(1 / 60); });
    const sat1 = await boardInk('sat'), said4 = await H(() => document.getElementById('fx-score').textContent);
    ok(sat0.green > 60 && !sat0.red && !sat0.amber && sat70.amber > 60 && !sat70.green && sat1.red > 60 && !sat1.green && !sat1.amber && /Customer satisfaction 55%\./.test(said4),
      'the customer satisfaction board starts green at 100%, turns amber, then red as it falls', JSON.stringify([sat0, sat70, sat1]) + ' ' + said4);
  });

  /* ---------- 3. a drag scrolls and never walks ---------- */
  await section('3. scroll', async () => {
    await fresh(2);
    const v0 = await H(() => ({ cam: window.TAAS_FACTORY.view.camY, min: window.TAAS_FACTORY.view.minY, max: window.TAAS_FACTORY.view.maxY, path: window.TAAS_FACTORY.s.avatar.path.length }));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', 200, 700);
    for (let y = 690; y >= 450; y -= 30) await touch('touchMove', 200, y);
    await touch('touchEnd');
    await step(0.05);
    const v1 = await H(() => ({ cam: window.TAAS_FACTORY.view.camY, task: window.TAAS_FACTORY.s.avatar.task }));
    ok(v0.max > v0.min + 100 && v1.cam > v0.cam + 150 && !v1.task, 'dragging up scrolls the floor (it is taller than the screen) and does not walk the avatar', JSON.stringify([v0.min, v0.max, v1.cam]));
    for (let k = 0; k < 4; k++) { await touch('touchStart', 200, 750); for (let y = 740; y >= 100; y -= 4) await touch('touchMove', 200, y); await page.waitForTimeout(120); await touch('touchMove', 200, 100); await touch('touchEnd'); }
    const v2 = await H(() => window.TAAS_FACTORY.view.camY);
    ok(Math.abs(v2 - v0.max) < 0.5, 'and stops at the end of the floor', v2.toFixed(1) + ' vs ' + v0.max.toFixed(1));
    await step(1);
    const dock = await rectOf('dockPanel');
    ok(dock && dock.y > 0 && dock.y + dock.h < 844, 'the robot dock at the bottom comes into view');
  });

  /* ---------- 4. hire and give a job, through the bubble ---------- */
  await section('4. hire', async () => {
    await fresh(3, true);
    await H(() => { window.TAAS_FACTORY.s.money = 20; window.TAAS_FACTORY.s.shop.next = 1e9; window.TAAS_FACTORY.view.camY = window.TAAS_FACTORY.view.maxY; window.TAAS_FACTORY.tick(0); });
    const dock = await rectOf('dockPanel');
    await page.touchscreen.tap(centre(dock)[0], centre(dock)[1]);
    let open = false;
    for (let i = 0; i < 160 && !open; i++) { await step(0.1); open = await H(() => !document.getElementById('fx-bubble').hidden); }
    const o = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + ':' + b.disabled + ':' + b.textContent.trim()));
    ok(open && o.length === 1 && o[0] === 'hire:false:$1', 'the dock offers a robot for the flat $1 (2026-10-20; it was $20)', JSON.stringify(o));
    await page.tap('#fx-bubble [data-opt="hire"]');
    await step(0.2);
    const jobs = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + '=' + b.getAttribute('aria-label')));
    const nm = await H(() => document.querySelector('#fx-bubble .fx-bname') && document.querySelector('#fx-bubble .fx-bname').textContent);
    ok(jobs.join() === 'job:operate=Run the planer,job:stock:0=Stock stall 1, medium planks,job:extract=Run the sap extractor,job:carve=Carve at the bench,job:saw=Run the table saw,job:rest=Rest,notes=Instructions' && nm === 'Bolt' && (await S()).robots.length === 1, 'hiring it turns the bubble to the new robot: its name, its jobs (the planer, the one stall, slots 02-04 in slot order with every goal met), rest and its clipboard', nm + ': ' + jobs.join());
    await page.tap('#fx-bubble [data-opt="job:stock:0"]');
    await step(16);   // out of the crate, up the floor, round the planer's output bin to the walkway
    const r = (await S()).robots[0], sp = await H(() => FACTORY.LAYOUT.SPOT.stock);
    ok(r.job === 'stock:0' && Math.hypot(r.x - sp.x, r.y - sp.y) < 0.1, 'a tap on the stocking icon sends the robot to the walkway by the counter', r.x.toFixed(2) + ',' + r.y.toFixed(2));
    await H(() => { const T = window.TAAS_FACTORY; T.view.camY = T.view.minY; T.tick(0); });
    const rp = await H(() => { const r = window.TAAS_FACTORY.s.robots[0]; return window.TAAS_FACTORY.screen(r.x, r.y, 0.55); });
    await page.touchscreen.tap(rp[0], rp[1]);
    let ro = false;
    for (let i = 0; i < 160 && !ro; i++) { await step(0.1); ro = await H(() => !!document.querySelector('#fx-bubble [data-opt="job:operate"]')); }
    const on = await H(() => document.querySelector('#fx-bubble .fx-opt.on') && document.querySelector('#fx-bubble .fx-opt.on').dataset.opt);
    ok(ro && on === 'job:stock:0', 'a tap on the drawn robot walks over and shows its jobs, its own one marked', on);
  });

  /* ---------- 5. taps land where things are drawn, at every size ---------- */
  await section('5. hit tests', async () => {
    const sizes = [[390, 844], [320, 640], [430, 932], [844, 390], [1280, 800], [768, 1024]];
    const want = { machine: 'machine', console: 'machine', rack: 'rack', binBack: 'bin', binFront: 'bin', recycle: 'recycle', counter: 'stall', stall0: 'stall', plate0: 'stall',
      sawInFront: 'sawIn', saw: 'saw', sawConsole: 'saw', sawOutFront: 'sawOut', extractInFront: 'extractIn', extract: 'extract', extractConsole: 'extract', extractOutFront: 'extractOut',
      benchInFront: 'benchIn', bench: 'bench', benchOutFront: 'benchOut', dockPanel: 'dock' };
    const bad = [], front = [];
    let seen = 0, pairs = 0;
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(4, true);   // every goal met: slots 02-04 have their machines to tap (taasgoals step 3)
      for (const cam of ['min', 'max']) {
        const res = await H(([want, cam]) => {
          const T = window.TAAS_FACTORY, out = [], hits = [];
          T.view.camY = T.view[cam + 'Y']; T.tick(0);
          Object.keys(want).forEach(id => {
            const r = T.spriteRect(id);
            if (!r) { out.push(id + ' not drawn'); return; }
            // the counter is tapped at the stall's end: elsewhere along it the tall planer's box stands in front
            const st = FACTORY.LAYOUT.STALL, x = id === 'counter' ? T.screen((st.x0 + st.x1) / 2, 0, 0)[0] : r.x + r.w / 2, y = r.y + r.h * (id.indexOf('Front') > 0 ? 0.5 : id === 'counter' ? 0.75 : 0.6);
            if (y < 50 || y > T.view.h) return;   // off screen (or under the chrome) at this size and scroll
            const t = T.hitTest(x, y);
            if (!t || t.kind !== want[id]) out.push(id + '->' + (t && t.kind)); else hits.push(id);
          });
          // where two things of different kinds overlap on screen, a tap there reaches the one standing in
          // front: the one whose footprint's front edge is nearer (the layout's numbers, not the page's sort keys)
          const ids = ['machine', 'console', 'rack', 'binBack', 'binFront', 'recycle', 'counter', 'stall0', 'plate0', 'sawInBack', 'sawInFront', 'saw', 'sawConsole', 'sawOutBack', 'sawOutFront',
            'extractInBack', 'extractInFront', 'extract', 'extractConsole', 'extractOutBack', 'extractOutFront', 'benchInBack', 'benchInFront', 'bench', 'benchOutBack', 'benchOutFront', 'dockPanel'];
          const foot = id => FACTORY.LAYOUT.SOLID[/^(stall|plate)\d$/.test(id) ? 'counter' : id.replace(/(Back|Front)$/, '')];
          const kind = id => want[id] || want[id.replace(/Back$/, 'Front')];
          const pairs = [];
          ids.forEach((a, i) => ids.slice(i + 1).forEach(b => {
            if (kind(a) === kind(b)) return;
            const ra = T.spriteRect(a), rb = T.spriteRect(b);
            if (!ra || !rb) return;
            const x0 = Math.max(ra.x, rb.x), x1 = Math.min(ra.x + ra.w, rb.x + rb.w), y0 = Math.max(ra.y, rb.y), y1 = Math.min(ra.y + ra.h, rb.y + rb.h);
            if (x1 - x0 < 3 || y1 - y0 < 3 || (y0 + y1) / 2 < 50 || (y0 + y1) / 2 > T.view.h) return;
            const fa = foot(a), fb = foot(b);
            if (!fa || !fb) { out.push('no footprint for ' + a + ' or ' + b); return; }
            const near = fa[3] > fb[3] ? a : b, t = T.hitTest((x0 + x1) / 2, (y0 + y1) / 2);
            pairs.push(a + '/' + b);
            if (!t || t.kind !== kind(near)) out.push(a + ' over ' + b + ' -> ' + (t && t.kind) + ', not the ' + near + ' in front');
          }));
          const fp = T.screen(5.4, 6.0, 0);   // open floor in the lane east of the recycle bin
          if (fp[1] > 60 && fp[1] < T.view.h) { const fl = T.hitTest(fp[0], fp[1]); if (!fl || fl.kind !== 'floor' || Math.abs(fl.x - 5.4) > 0.05 || Math.abs(fl.y - 6.0) > 0.05) out.push('floor ' + JSON.stringify(fl)); }
          const box = document.getElementById('fx-canvas').getBoundingClientRect(), c = document.getElementById('fx-canvas');
          if (Math.abs(c.width / T.view.dpr - box.width) > 1 || Math.abs(c.height / T.view.dpr - box.height) > 1) out.push('canvas ' + c.width + 'x' + c.height + ' for a ' + box.width + 'x' + box.height + ' box');
          return { out, hits: hits.length, pairs };
        }, [want, cam]);
        seen += res.hits;
        res.pairs.forEach(x => { pairs++; if (front.indexOf(x) < 0) front.push(x); });
        res.out.forEach(x => bad.push(w + 'x' + h + ' ' + cam + ': ' + x));
      }
      await H(() => { const T = window.TAAS_FACTORY; T.view.camY = T.view.minY; T.tick(0); });
      const con = await rectOf('console');
      if (con && con.y > 60 && con.y + con.h < h) {
        await page.touchscreen.tap(con.x + con.w / 2, con.y + con.h * 0.4);
        const t = await S();
        if (!t.avatar.task || t.avatar.task.kind !== 'machine') bad.push(w + 'x' + h + ' touch on console -> ' + JSON.stringify(t.avatar.task));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length && seen > 60, 'at six sizes, scrolled to the top and the bottom, a tap on each drawn thing reaches that thing (the planer, its rack and bins, the counter, every slot\'s machine and bins, the dock), and the floor maps back to the metre', bad.join('; ') + ' (' + seen + ' hits)');
    ok(!bad.some(x => / over /.test(x)) && front.indexOf('machine/recycle') >= 0 && front.indexOf('machine/counter') >= 0,
      'where two things overlap on screen, a tap there reaches the one standing in front (the recycle bin before the planer\'s box, the planer before the counter)', front.join(', ') + ' (' + pairs + ' overlaps)');
  });

  /* ---------- 6. chrome and bubble all on screen ---------- */
  await section('6. layout', async () => {
    const sizes = [[390, 844], [320, 640], [844, 390], [1280, 800]];
    const bad = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(5);
      // the busiest bubble there is: the recycle bin with six kinds in your arms and four in it
      await H(() => { const s = window.TAAS_FACTORY.s; s.shop.next = 1e9; s.avatar.inv.push('plank.s', 'rough.m', 'log.l', 'b2x4.m', 'sap', 'carving.owl'); s.recycle.push('gnarled.m', 'sappy.l', 'log.s', 'plank.l'); FACTORY.tap(s, { kind: 'recycle' }); });
      await step(4);
      const r = await H(() => {
        const box = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, hidden: e.hidden }; };
        const ids = ['menu-btn', 'mode-btn', 'reload-btn', 'fx-bubble'];
        const o = {}; ids.forEach(i => { o[i] = box(i); });
        o.vw = innerWidth; o.vh = innerHeight; o.sw = document.scrollingElement.scrollWidth;
        o.opts = [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => { const q = b.getBoundingClientRect(); return [q.left, q.right, q.top, q.bottom]; });
        return o;
      });
      const inside = k => r[k].l >= 0 && r[k].r <= r.vw + 0.5 && r[k].t >= 0 && r[k].b <= r.vh + 0.5;
      const overlap = (a, b) => !(r[a].r <= r[b].l || r[b].r <= r[a].l || r[a].b <= r[b].t || r[b].b <= r[a].t);
      ['menu-btn', 'mode-btn', 'reload-btn', 'fx-bubble'].forEach(k => { if (!inside(k)) bad.push(w + 'x' + h + ' ' + k + ' off screen'); });
      if (r['fx-bubble'].hidden) bad.push(w + 'x' + h + ' bubble did not open');
      if (r.opts.length !== 10) bad.push(w + 'x' + h + ' ' + r.opts.length + ' choices in the bubble');
      if (r.opts.some(o => o[0] < 0 || o[1] > r.vw || o[2] < 0 || o[3] > r.vh)) bad.push(w + 'x' + h + ' a choice off screen');
      [['menu-btn', 'mode-btn'], ['mode-btn', 'reload-btn'], ['fx-bubble', 'menu-btn'], ['fx-bubble', 'mode-btn'], ['fx-bubble', 'reload-btn']].forEach(([a, b]) => { if (overlap(a, b)) bad.push(w + 'x' + h + ' ' + a + ' over ' + b); });
      if (!(r['menu-btn'].r <= r['mode-btn'].l && r['mode-btn'].r <= r['reload-btn'].l && r.vw - r['reload-btn'].r < 24)) bad.push(w + 'x' + h + ' chrome order (menu, mode, then reload in the top right corner)');
      if (r.sw > r.vw) bad.push(w + 'x' + h + ' sideways scroll');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length, 'at four sizes: menu and mode on the left, reload in the top right corner, the recycle bin\'s ten choices all on screen, nothing on top of anything', bad.join('; '));
  });

  /* ---------- 7. the info panel ---------- */
  await section('7. panel', async () => {
    await fresh(6);
    await page.tap('#menu-btn');
    const sub = await H(() => document.getElementById('menu-info-sub').textContent);
    await page.tap('[data-menu="info"]');
    const p = await H(() => ({ open: !document.getElementById('fx-panel').hidden, menu: !document.getElementById('menu').hidden, rows: [...document.querySelectorAll('#fx-panel-body tbody tr')].map(r => r.textContent) }));
    ok(p.open && !p.menu && sub === 'How the factory works' && p.rows.length === 1 && /No robots yet/.test(p.rows[0]), 'Info in the menu ("How the factory works") closes the menu and opens the explanation, with the measured table (no robots yet)', JSON.stringify(p) + ' ' + sub);
    const words = await H(() => document.getElementById('fx-panel-body').textContent);
    ok(/The goal: Sell 50 medium planks\./.test(words) && /Customer satisfaction/.test(words) && /starts at 100%/.test(words) && !/formal/i.test(words), 'it starts from the goal and explains customer satisfaction on its own terms, without the formal mode', (words.match(/formal.{0,30}/i) || [''])[0]);
    ok(/costs \$0\.10 for each thing it processes/.test(words) && /starts with 10 logs/.test(words) && /10 more arrive for \$10/.test(words) && /fixing a jam costs \$5/.test(words) && /every second each one waits costs 0.1%/.test(words) && /Satisfaction sets what customers pay/.test(words) && /never less than the thing cost to make \(\$1\.10 for a plank/.test(words),
      'and the storefront\'s rules: 10 logs to start and 10 more for $10, $0.10 a machine run, $5 to fix a jam, 0.1% a second for each customer waiting, satisfaction setting the price but never below what the thing cost to make');
    const tips = await H(() => [...document.querySelectorAll('#fx-panel-body .fx-tips li b')].map(b => b.textContent));
    ok(tips.join('|') === 'A first agent rarely pays for itself.|An agent faster than demand makes waste.|Give an agent the next best task, not the biggest.|More agents do not make more demand.|An agent is only as good as what feeds it.' && /ROI above 1/.test(words) && /investment, its upkeep and the cleanup/.test(words)
      && /start the wait short/.test(words) && !/twice as fast/.test(words),
      'and its Tips: a first agent rarely pays for itself (ROI above 1 only once it has its guardrails), an agent faster than demand makes waste (pace it, starting short), give an agent the next best task (the CD, 2026-10-16), more agents do not make more demand, an agent is only as good as what feeds it (taasstalls step 4)', JSON.stringify(tips));
    ok(/three sizes/.test(words) && /table saw/.test(words) && /sap extractor/.test(words) && /bench/.test(words) && /\$2 \/ \$4 \/ \$8/.test(words) && /\$3 \/ \$6 \/ \$12/.test(words) && /Instructions/.test(words) && /\$5, \$10, \$15, \$20 and \$25/.test(words),
      'and wood\'s sizes and qualities, slots 02 to 04, the CD\'s prices, and instructions');
    await H(() => { window.TAAS_FACTORY.s.money = 33; });
    await page.tap('[data-panel="restart"]');
    const once = await S();
    await H(() => { const b = document.querySelector('[data-panel="restart"]'); if (b) b.click(); });
    const twice = await S();
    ok(once.money === 33 && twice.money === 0 && await H(() => document.getElementById('fx-panel').hidden), 'Start over asks first, and the second tap starts a new factory');
  });
  /* ---------- 8. saves ---------- */
  await section('8. saves', async () => {
    await fresh(7);
    await H(() => { const s = window.TAAS_FACTORY.s; s.money = 20; s.shop.next = 1e9; FACTORY.tap(s, { kind: 'dock' }); });
    await step(9);
    await page.tap('#fx-bubble [data-opt="hire"]');
    await step(0.1);
    await page.tap('#fx-bubble [data-opt="job:stock:0"]');
    await H(() => { window.TAAS_FACTORY.s.money = 17; });
    await step(2.2);   // the page's own autosave, every 2 s
    // read it from a second tab: a reload would also save on pagehide and hide a dead autosave
    const p2 = await ctx.newPage();
    await p2.goto(BASE + '?mode=robot-factory', { waitUntil: 'load' });
    await p2.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    const tab2 = await p2.evaluate(() => ({ money: window.TAAS_FACTORY.s.money, robots: window.TAAS_FACTORY.s.robots.map(r => r.job) }));
    await p2.close();
    ok(tab2.money === 17 && tab2.robots.join() === 'stock:0', 'the factory saves itself every few seconds while it runs', JSON.stringify(tab2));
    // a real formal-mode run, one quarter in: the factory must not touch it
    await H(() => { const st = TAAS.commit(TAAS.newGame(), { opp: true, inv: { train: 4 } }); localStorage.setItem('taas.v' + TAAS.CFG.version, JSON.stringify({ state: st, plan: { opp: true, inv: {} } })); });
    await H(() => { window.TAAS_FACTORY.s.money = 23; });   // no frame runs: only leaving the page can save this
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    ok(await H(() => window.TAAS_FACTORY.s.money) === 23, 'and saves on the way out, so a reload loses nothing');
    const back = await H(() => { const f = JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version)); return { money: window.TAAS_FACTORY.s.money, robots: window.TAAS_FACTORY.s.robots.map(r => r.job), formal: f.state.q + '/' + f.state.history.length + '/' + f.plan.opp }; });
    ok(back.robots.join() === 'stock:0' && back.formal === '1/1/true', 'a reload brings the factory back (money, the robot and its job) and leaves the formal save alone', JSON.stringify(back));
    // doctor the save on the way in, after the outgoing page's pagehide save and before any script
    await page.addInitScript(() => {
      if (sessionStorage.getItem('fx-bump') !== '1') return;
      sessionStorage.removeItem('fx-bump');
      Object.keys(localStorage).filter(k => /^taas\.factory\.v/.test(k)).forEach(k => { const d = JSON.parse(localStorage.getItem(k)); d.version = 99; localStorage.setItem(k, JSON.stringify(d)); });
    });
    await H(() => sessionStorage.setItem('fx-bump', '1'));
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    const st = await H(() => ({ money: window.TAAS_FACTORY.s.money, robots: window.TAAS_FACTORY.s.robots.length }));
    ok(st.money === 0 && st.robots === 0, 'a factory save from another version is not loaded', JSON.stringify(st));
  });

  /* ---------- 9. back in after a resize while hidden ---------- */
  await section('9. re-measure', async () => {
    await fresh(8);
    await page.selectOption('#mode-btn', 'formal');
    await page.setViewportSize({ width: 600, height: 700 });
    await page.selectOption('#mode-btn', 'robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY.on);
    await H(() => { window.TAAS_FACTORY.paused = true; window.TAAS_FACTORY.tick(0); });
    const r = await H(() => { const T = window.TAAS_FACTORY, c = document.getElementById('fx-canvas'), m = T.spriteRect('machine'); const t = T.hitTest(m.x + m.w / 2, m.y + m.h * 0.6); return { cw: c.width / T.view.dpr, vw: T.view.w, hit: t && t.kind }; });
    ok(Math.abs(r.cw - 600) <= 1 && r.vw === 600 && r.hit === 'machine', 'coming back after a resize in formal mode re-measures the canvas, and taps still land', JSON.stringify(r));
    // and a resize while it is showing (a phone turning over) re-measures on the next frame
    await page.setViewportSize({ width: 430, height: 760 });
    // wait on the property, bounded: under load the resize can arrive a few frames late
    for (let i = 0; i < 40 && (await H(() => window.TAAS_FACTORY.view.w)) !== 430; i++) await page.waitForTimeout(50);
    await H(() => window.TAAS_FACTORY.tick(1 / 60));
    const r2 = await H(() => { const T = window.TAAS_FACTORY, c = document.getElementById('fx-canvas'), m = T.spriteRect('machine'); const t = T.hitTest(m.x + m.w / 2, m.y + m.h * 0.6); return { cw: c.width / T.view.dpr, vw: T.view.w, hit: t && t.kind }; });
    ok(Math.abs(r2.cw - 430) <= 1 && r2.vw === 430 && r2.hit === 'machine', 'a resize while the factory shows re-measures it too', JSON.stringify(r2));
    await page.setViewportSize({ width: 390, height: 844 });
  });

  /* ---------- 10. a robot's page, by real taps ---------- */
  await section('10. robot page', async () => {
    await fresh(9);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.money = 60; s.shop.next = 1e9;
      ['operate', 'stock:0'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
      s.rack = Array(80).fill('log.m'); s.rackMine = 0; s.force.think = Array(80).fill(false);   // the planer's input bin: medium logs only
      for (let i = 0; i < 300; i++) FACTORY.step(s, 0.05);
      s.robots[1].job = null; s.robots[1].state = 'idle'; s.robots[1].carry = null;
      s.events = []; s.money = 100; s.seen.sap = true; s.seen.gnarled = true;
      T.view.camY = T.view.minY; T.tick(1 / 60);
    });
    const tapRobot = async id => {
      const rp = await H(id => { const r = window.TAAS_FACTORY.s.robots[id]; return window.TAAS_FACTORY.screen(r.x, r.y, 0.55); }, id);
      await page.touchscreen.tap(rp[0], rp[1]);
      let ro = false;
      for (let i = 0; i < 160 && !ro; i++) { await step(0.1); ro = await H(() => !!document.querySelector('#fx-bubble [data-opt="notes"]')); }
      return ro;
    };
    const opened = await tapRobot(0);
    const b0 = await H(() => ({ name: document.querySelector('#fx-bubble .fx-bname').textContent, note: document.querySelector('#fx-bubble [data-opt="notes"]').textContent.trim() }));
    ok(opened && b0.name === 'Bolt' && b0.note === '', 'a tap on the drawn robot shows its name and its clipboard (nothing on it yet)', JSON.stringify(b0));
    await page.tap('#fx-bubble [data-opt="notes"]');
    await step(0.05);
    const pg = await H(() => ({ open: !document.getElementById('fx-panel').hidden, mode: window.TAAS_FACTORY.page.mode, name: document.getElementById('fx-rp-name').value, base: document.querySelector('.fx-base').textContent, slots: document.querySelectorAll('.fx-slots li').length, buy: document.querySelector('[data-panel="buy"]').textContent, dis: document.querySelector('[data-panel="buy"]').disabled }));
    ok(pg.open && pg.mode === 'robot' && pg.name === 'Bolt' && pg.base === 'Use the planer to refine raw materials.' && pg.slots === 5 && pg.buy === 'Unlock this slot: $5' && !pg.dis,
      'the clipboard opens its page: its name, its base prompt on top (the planer now), five slots, the first for $5', JSON.stringify(pg));
    const before = await H(() => window.TAAS_FACTORY.s.money + window.TAAS_FACTORY.s.spent - window.TAAS_FACTORY.s.earned);
    await page.tap('[data-panel="buy"]');
    await step(0.05);
    const pk = await H(() => ({ money: window.TAAS_FACTORY.s.money + window.TAAS_FACTORY.s.spent - window.TAAS_FACTORY.s.earned, slots: window.TAAS_FACTORY.s.robots[0].slots, rules: [...document.querySelectorAll('.fx-rules .fx-rule')].map(b => b.textContent), pick: window.TAAS_FACTORY.page.pick }));
    ok(pk.money === before - 5 && pk.slots === 1 && pk.pick === 0 && pk.rules.join('|') === 'Never put sap on input log|Put gnarled logs in recycle bin|Wait between tasks', 'unlocking a slot takes $5 and opens the list straight away: only the instructions for mistakes already seen, and the delay (on the list from the start)', JSON.stringify(pk));
    await page.tap('[data-panel="rule:sap"]');
    await step(0.05);
    const set = await H(() => ({ rules: window.TAAS_FACTORY.s.robots[0].rules, slot: document.querySelector('.fx-slot.filled') && document.querySelector('.fx-slot.filled').textContent, picker: !!document.querySelector('.fx-picker'), next: document.querySelector('[data-panel="buy"]').textContent }));
    ok(set.rules.join() === 'sap' && set.slot === 'Never put sap on input log' && !set.picker && set.next === 'Unlock this slot: $10', 'tapping an instruction puts it in the slot, closes the list, and the next slot asks $10', JSON.stringify(set));
    await page.tap('[data-panel="buy"]'); await step(0.05);
    const dup = await H(() => [...document.querySelectorAll('.fx-rules .fx-rule')].map(b => b.textContent + ':' + b.disabled));
    ok(dup.length === 3 && /slot 1\):true$/.test(dup[0]) && /:false$/.test(dup[1]) && /:false$/.test(dup[2]), 'in the next slot\'s list, the instruction it already holds is greyed and says where', JSON.stringify(dup));
    await page.tap('[data-panel="cancel"]'); await step(0.05);
    ok(!(await H(() => !!document.querySelector('.fx-picker'))) && (await H(() => window.TAAS_FACTORY.s.robots[0].rules.join())) === 'sap,', 'Cancel closes the list and leaves the slot empty');
    await page.fill('#fx-rp-name', '  <b>Planky</b>  ');
    await H(() => document.getElementById('fx-rp-name').dispatchEvent(new Event('change')));
    await step(0.05);
    const nm = await H(() => ({ name: window.TAAS_FACTORY.s.robots[0].name, field: document.getElementById('fx-rp-name').value, injected: !!document.querySelector('#fx-panel-body b b, #fx-panel-body .fx-h b') }));
    ok(nm.name === '<b>Planky</b>' && nm.field === '<b>Planky</b>' && !nm.injected, 'a robot can be named; the name is kept as typed (trimmed) and never read as markup', JSON.stringify(nm));
    await page.tap('[data-panel="close"]');
    await step(0.05);
    ok(await H(() => document.getElementById('fx-panel').hidden), 'Close shuts the page');
    await tapRobot(0);
    const b1 = await H(() => ({ name: document.querySelector('#fx-bubble .fx-bname').textContent, html: document.querySelector('#fx-bubble .fx-bname').innerHTML, note: document.querySelector('#fx-bubble [data-opt="notes"]').textContent.trim() }));
    ok(b1.name === '<b>Planky</b>' && /&lt;b&gt;/.test(b1.html) && b1.note === '1/2', 'its bubble wears the new name (as text) and its clipboard says 1 of 2 slots filled', JSON.stringify(b1));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.tap('#fx-bubble [data-opt="notes"]'); await step(0.05);
    await page.tap('[data-panel="pick:1"]'); await step(0.05);
    const fit = await H(() => { const p = document.getElementById('fx-panel'), body = document.getElementById('fx-panel-body'); p.scrollTop = -9999; const top = body.getBoundingClientRect().top - p.getBoundingClientRect().top; const wide = body.scrollWidth > body.clientWidth + 1 || document.scrollingElement.scrollWidth > innerWidth; return { top, wide, scrolls: p.scrollHeight > p.clientHeight }; });
    ok(fit.top >= 0 && !fit.wide && fit.scrolls, 'at 320x568 the page scrolls, its top is reachable, and nothing runs off sideways', JSON.stringify(fit));
    await H(() => window.TAAS_FACTORY.closePanel());
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(10);
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.money = 20; FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); s.money = 500; FACTORY.choose(s, 'notes'); T.tick(1 / 60); });
    const one = await H(() => ({ open: !document.getElementById('fx-panel').hidden, buy: document.querySelector('[data-panel="buy"]').textContent, dis: document.querySelector('[data-panel="buy"]').disabled, base: document.querySelector('.fx-base').textContent }));
    ok(one.open && one.dis && /once two robots are on staff/.test(one.buy) && /No job/.test(one.base), 'with one robot its page is there (name, no job yet), but slots wait for the second robot', JSON.stringify(one));
    await H(() => window.TAAS_FACTORY.closePanel());
    // the stocker, told to stock only medium planks, at a bin of other things: its page counts the looking
    await fresh(12);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.money = 60; s.shop.next = 1e9;
      ['operate', 'stock:0'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
      s.robots[0].job = null; s.robots[0].state = 'idle';
      s.money = 100; s.seen.stockOnly = true; FACTORY.buySlot(s, 1); FACTORY.setRule(s, 1, 0, 'stockOnly');
      for (let i = 0; i < 400; i++) FACTORY.step(s, 0.05);
      s.force.slip = [false]; s.bin.push('plank.s', 'rough.m', 'plank.l');
      T.tick(1 / 60);
    });
    await step(6);
    const hunt = await H(() => { const T = window.TAAS_FACTORY, r = T.s.robots[1]; T.openRobot(1); const row = [...document.querySelectorAll('.fx-rec tr')].find(tr => /Looking for a medium plank/.test(tr.textContent)); return { n: r.record['looking:plank.m'], row: row && row.textContent, bin: T.s.bin.join(), dot: row && row.querySelector('.fx-dot').className, base: document.querySelector('.fx-base').textContent }; });
    ok(hunt.n >= 3 && hunt.row === 'Looking for a medium plank' + hunt.n && /soso/.test(hunt.dot) && hunt.bin === 'plank.s,rough.m,plank.l' && hunt.base === 'Stock the sales counter with the items in this bin.',
      'the stocker\'s page (its base prompt: stock the sales counter) counts each reach that came up with something other than a medium plank: "Looking for a medium plank" and how often', JSON.stringify(hunt));
    const ev = await H(() => {
      const T = window.TAAS_FACTORY, r = T.s.robots[1];
      r.record = { stock: 4, 'misstock:plank.s': 2, 'misstock:rough.m!': 1, 'recycle:plank.l': 2, looking: 3 };
      T.openRobot(1); T.tick(1 / 60);
      const sec = document.querySelector('.fx-evals');
      return { head: sec && sec.querySelector('.fx-h span').textContent, rows: [...sec.querySelectorAll('.fx-rec tr')].map(tr => tr.querySelector('.fx-dot').className.replace('fx-dot ', '') + '|' + tr.textContent) };
    });
    const want = ['good|Put a medium plank in the stall4', 'bad|Put a small plank in the medium plank stall2', 'bad|Put a medium gnarled plank in the medium plank stall, against its instructions1',
      'soso|Looking for plank3', 'good|Put a large plank in the recycle bin2'];
    ok(ev.head === 'Evals' && JSON.stringify(ev.rows) === JSON.stringify(want), 'its Evals: a medium plank stocked green, anything else put in the medium plank stall red (against its instructions a line of its own), looking yellow, recycling green', JSON.stringify(ev));
    const op = await H(() => {
      const T = window.TAAS_FACTORY, r = T.s.robots[0];
      r.record = { plank: 3, 'cut:log.s': 1, 'jam:sappy.l': 1, 'reject:gnarled.m': 2, 'caught:rough.s': 1 };
      T.openRobot(0); T.tick(1 / 60);
      return [...document.querySelectorAll('.fx-evals .fx-rec tr')].map(tr => tr.querySelector('.fx-dot').className.replace('fx-dot ', '') + '|' + tr.textContent);
    });
    ok(JSON.stringify(op) === JSON.stringify(['good|Medium log, medium plank3', 'soso|Cut a small log: a small plank1', 'bad|Fed in a large sap log: a jam1', 'good|Put a medium gnarled log in the recycle bin2', 'good|Caught a small gnarled plank at the exit: into the recycle bin1']),
      'and the operator\'s name every log by its size and quality', JSON.stringify(op));
    await page.tap('[data-panel="evals-reset"]');
    await step(0.05);
    const rs = await H(() => { const T = window.TAAS_FACTORY, r = T.s.robots[0], sec = document.querySelector('.fx-evals'); return { keys: Object.keys(r.record).length, rows: sec.querySelectorAll('.fx-rec tr').length, empty: /Nothing yet/.test(sec.textContent), dis: sec.querySelector('[data-panel="evals-reset"]').disabled }; });
    ok(!rs.keys && !rs.rows && rs.empty && rs.dis, 'Reset evals empties them and greys itself until there is something to reset', JSON.stringify(rs));
    await H(() => window.TAAS_FACTORY.closePanel());
  });

  /* ---------- 11. the scene, read off pixels ---------- */
  await section('11. scene', async () => {
    await fresh(11, true);
    await H(() => { const T = window.TAAS_FACTORY; T.s.shop.next = 1e9; T.view.camY = T.view.minY; T.tick(1 / 60); });
    const R = await H(() => FACTORY.LAYOUT);
    const bin = await px(R.RECYCLE.x, R.SOLID.recycle[3] - 0.02, 0.3);
    ok(bin[1] > bin[0] + 30 && bin[1] > bin[2], 'the recycle bin is drawn, green, in front of the planer\'s out-feed', 'rgb ' + bin);
    const wall = await px(2.16, 0.45, 1.8);
    ok(wall[0] - wall[2] < 30 && Math.abs(wall[0] - wall[1]) < 30, 'beside the window is plain wall', 'rgb ' + wall);
    // the holes: a gnarled log on the in-feed and its gnarled plank in the output bin, scanned for
    // hole-coloured pixels column by column, the hole centres put back into metres from the item's middle
    const holes = (at) => H(([at]) => {
      const T = window.TAAS_FACTORY, V = T.view, k = V.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const a = T.screen(at[0] - 0.5, at[1] + 0.16, at[2] - 0.15), b = T.screen(at[0] + 0.5, at[1] - 0.16, at[2] + 0.2);
      const x0 = Math.round(a[0] * k), x1 = Math.round(b[0] * k), y0 = Math.round(Math.min(a[1], b[1]) * k), y1 = Math.round(Math.max(a[1], b[1]) * k);
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0, cols = [];
      for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < y1 - y0; y++) { const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2]; if (r + gg + bb < 120 && r >= bb + 10) n++; } cols.push(n >= 2); }
      const out = [];
      for (let x = 0; x < w; x++) if (cols[x] && !cols[x - 1]) { let e = x; while (cols[e + 1]) e++; out.push(+(((x0 + (x + e) / 2) / k - V.ox) / V.S - at[0]).toFixed(3)); x = e; }
      return out;
    }, [at]);
    const logAt = await H(() => { const T = window.TAAS_FACTORY, s = T.s, L = FACTORY.LAYOUT; s.machine.phase = 'ready'; s.machine.staged = 1; s.machine.log = 'gnarled.m'; s.bin = ['rough.m']; T.tick(0); return [L.SOLID.inBelt[2] - 0.425 - 0.02, L.ROW.planer, 0.53 + 0.12]; });
    const binAt = await H(() => { const q = FACTORY.LAYOUT.SOLID.bin; return [(q[0] + q[2]) / 2, q[1] + 0.15, 0.06]; });
    const logH = await holes(logAt), plankH = await holes(binAt);
    ok(logH.length === 3 && plankH.length === 3 && logH.every((x, i) => Math.abs(x - plankH[i]) < 0.04), 'a gnarled log\'s plank has its holes in the same places as the log (the CD\'s ask), read off the drawn pixels', 'log ' + logH.join() + ' / plank ' + plankH.join());
    const green = (x0, x1, y, z0, z1) => H(([x0, x1, y, z0, z1]) => { const T = window.TAAS_FACTORY, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); const a = T.screen(x0, y, z0), b = T.screen(x1, y, z1); const d = g.getImageData(Math.round(a[0] * k), Math.round(b[1] * k), Math.round((b[0] - a[0]) * k), Math.round((a[1] - b[1]) * k)).data; let n = 0, all = 0; for (let i = 0; i < d.length; i += 4) { all++; if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 60) n++; } return n / all; }, [x0, x1, y, z0, z1]);
    for (const z of ['s', 'l']) {
      await H(z => { const T = window.TAAS_FACTORY, s = T.s; s.machine.log = 'sappy.' + z; s.bin = []; T.tick(0); }, z);
      const sap = await green(0.5, 1.75, logAt[1] + 0.2, 0.45, 0.95);
      ok(sap > 0.025, 'a ' + (z === 's' ? 'small' : 'large') + ' sap log rolls in green with sap', (sap * 100).toFixed(1) + '% green');
    }
    // sizes: a small, a medium and a large plank are drawn at three lengths
    const lens = await H(() => { const T = window.TAAS_FACTORY, s = T.s, q = FACTORY.LAYOUT.SOLID.bin, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); s.machine.log = 'log.m';
      return ['plank.s', 'plank.m', 'plank.l'].map(p => { s.bin = [p]; T.tick(0); const y = T.screen(0, q[1] + 0.15, 0.09)[1], x0 = T.screen((q[0] + q[2]) / 2, 0, 0)[0], x1 = T.screen(q[2] + 0.4, 0, 0)[0];   // the right half: the left end of a long one runs under the out-feed
        const w = Math.round((x1 - x0) * k), d = g.getImageData(Math.round(x0 * k), Math.round(y * k) - 6, w, 12).data; let n = 0;
        for (let x = 0; x < w; x++) { let hit = false; for (let r = 0; r < 12 && !hit; r++) { const i = (r * w + x) * 4; hit = d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 175 && d[i] - d[i + 2] > 60; } if (hit) n++; } return n; }); });
    ok(lens[0] > 10 && lens[1] > lens[0] * 1.3 && lens[2] > lens[1] * 1.15, 'a small, a medium and a large plank are drawn at three lengths (2\', 4\', 8\' in the CD\'s words)', lens.join(' < '));
    // the four slots, numbered on the floor at the left, the middle and the right of each row
    const nums = await H(() => { const T = window.TAAS_FACTORY, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'), L = FACTORY.LAYOUT; T.s.avatar.x = 3; T.s.avatar.y = 16.8; T.s.avatar.path = []; T.s.avatar.task = null;
      const out = [];
      [[3.05, 5.65], [L.ROW.extract - 0.75, L.ROW.extract + 1.45], [L.ROW.bench - 0.75, L.ROW.bench + 1.45], [L.ROW.saw - 0.65, L.ROW.saw + 1.3]].forEach(([y0, y1]) => {   // (02-04 the extractor's, the bench's, the saw's: 2026-10-20)
        const y = y1 - 0.3; T.view.camY = Math.min(T.view.maxY, Math.max(T.view.minY, T.screen(0, y, 0)[1] + T.view.camY - 300)); T.tick(0);
        out.push([0.45, 3.0, 5.52].map(x => { const p = T.screen(x, y, 0), d = g.getImageData(Math.round(p[0] * k) - 10, Math.round(p[1] * k) - 6, 20, 12).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 175 && Math.abs(d[i] - d[i + 2]) < 40) n++; return n; }));
      });
      T.view.camY = T.view.minY; T.tick(0);
      return out; });
    ok(nums.length === 4 && nums.every(row => row.every(n => n > 15)), 'slots 01 to 04 each have their number painted on the floor at the left, the middle and the right', JSON.stringify(nums));
    // the saw's blade spins only while it cuts; the extractor's tank fills as it runs
    const sawPx = () => H(() => { const T = window.TAAS_FACTORY, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'), y = FACTORY.LAYOUT.ROW.saw; const a = T.screen(2.15, y, 1.0), b = T.screen(2.75, y, 0.77); return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.round((b[1] - a[1]) * k)).data); });
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
    await H(() => { const T = window.TAAS_FACTORY, y = FACTORY.LAYOUT.ROW.saw; T.view.camY = T.screen(0, y, 0)[1] + T.view.camY - 400; T.tick(0); });
    const i1 = await sawPx(); await step(0.05); const i2 = await sawPx();
    await H(() => { const s = window.TAAS_FACTORY.s; s.saw.in.push('plank.m'); s.saw.phase = 'idle'; });
    await H(() => { const s = window.TAAS_FACTORY.s; s.avatar.x = FACTORY.LAYOUT.SPOT.saw.x; s.avatar.y = FACTORY.LAYOUT.SPOT.saw.y; FACTORY.tap(s, { kind: 'saw' }); FACTORY.choose(s, 'cut:b2x4'); });
    await step(0.5);
    // between the two frames only the blade may move: the engine is held (so the plank on the table stays put) and no
    // dust is made, after a second and a half for the dust already in the air to clear (the first version of this row
    // passed on the plank and the dust alone, with the blade frozen)
    const held = await H(() => { const T = window.TAAS_FACTORY; window.__step = FACTORY.step; window.__rnd = Math.random;
      FACTORY.step = () => {}; Math.random = () => 0.999; for (let i = 0; i < 90; i++) T.tick(1 / 60); return T.s.saw.phase; });
    const r1 = await sawPx(); await H(() => { window.TAAS_FACTORY.tick(1 / 30); }); const r2 = await sawPx();
    await H(() => { FACTORY.step = window.__step; Math.random = window.__rnd; });
    ok(held === 'run' && diff(i1, i2) < 5 && diff(r1, r2) > 30, 'the table saw\'s blade stands still until it cuts, then spins (with nothing else in view moving)', held + ': ' + diff(i1, i2) + ' vs ' + diff(r1, r2) + ' px changed between frames');
    await H(() => { const T = window.TAAS_FACTORY, y = FACTORY.LAYOUT.ROW.extract; T.view.camY = T.screen(0, y, 0)[1] + T.view.camY - 400; T.tick(0); });
    const ey = await H(() => FACTORY.LAYOUT.ROW.extract);
    const tankAt = () => green(1.95, 2.45, ey - 0.05 + 0.28, 0.9, 1.45);
    const t0 = await tankAt();
    await H(() => { const s = window.TAAS_FACTORY.s; s.extract.in.push('sappy.l'); s.avatar.x = FACTORY.LAYOUT.SPOT.extract.x; s.avatar.y = FACTORY.LAYOUT.SPOT.extract.y; FACTORY.tap(s, { kind: 'extract' }); });
    await step(3.4);
    const t1 = await tankAt();
    ok(t1 > t0 * 2 && t1 > 0.15, 'the sap extractor\'s tank fills with sap as it runs', (t0 * 100).toFixed(0) + '% to ' + (t1 * 100).toFixed(0) + '% sap-green');
  });

  /* ---------- 13. the wall: money, customer satisfaction and the goal (the CD, 2026-10-14 and 15) ---------- */
  await section('13. wall boards', async () => {
    await fresh(14);
    const gone = await H(() => ['fx-hud', 'fx-info', 'fx-cash', 'fx-money', 'fx-sat', 'back-btn', 'mute-btn'].filter(id => document.getElementById(id)));
    ok(!gone.length, 'the money and satisfaction pills, the i button, the back button and the mute button are gone from the screen', gone.join());
    const g = await H(() => {
      const T = window.TAAS_FACTORY, c = T.board('cash'), s = T.board('sat'), gl = T.board('goal'), m = document.getElementById('menu-btn').getBoundingClientRect();
      const win = [T.screen(2.3, 0.45, 2.35)[0], T.screen(3.4, 0.45, 2.35)[0]];
      return { c, s, gl, chrome: m.bottom, win, mid: T.screen(3, 0, 0)[0], vw: innerWidth, vh: innerHeight, cam: T.view.camY, min: T.view.minY };
    });
    const onScreen = r => r.x >= 0 && r.x + r.w <= g.vw && r.y >= g.chrome && r.y + r.h <= g.vh;
    ok(g.cam === g.min && onScreen(g.c) && onScreen(g.s) && onScreen(g.gl) && g.c.w > 60 && g.s.w > 80 && g.c.h > 30 && g.gl.y + g.gl.h <= g.c.y && g.gl.w > g.c.w + g.s.w,
      'scrolled to the top, the goal across the top of the wall and both boards under it are on screen below the chrome', JSON.stringify(g));
    const glass = await H(() => { const T = window.TAAS_FACTORY, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      return [[2.6, 1.8], [3.1, 1.8], [1.1, 1.65], [4.8, 1.65]].map(([x, z]) => { const p = T.screen(x, 0.48, z), d = g.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data; return d[2] > 240 && d[1] > 215 && d[0] > 170 && d[0] < 215; }); });
    ok(g.c.x + g.c.w < g.win[0] && g.win[1] < g.s.x && Math.abs((g.win[0] + g.win[1]) / 2 - g.mid) < 20 && glass.join() === 'true,true,false,false',
      'money on the left, a window in the middle (glass on screen there, not over the boards), customer satisfaction on the right', JSON.stringify(g) + ' glass ' + glass);
    const cap = await boardInk('sat');
    ok(cap.caption > 150, 'the right-hand board is captioned in full: customer satisfaction', JSON.stringify(cap));
    // the goal (the CD, 2026-10-15): a yellow GOAL tag, then the goal in white, and it is what the screen reader hears too
    const goal = await boardInk('goal'), heard = await H(() => document.getElementById('fx-score').textContent);
    ok(goal.amber > 150 && goal.white > 300 && /Goal: Sell 50 medium planks\.$/.test(heard), 'the rear wall says the goal: a yellow GOAL tag and "Sell 50 medium planks" (the CD\'s first goal, 2026-10-20)', JSON.stringify(goal) + ' ' + heard);
    await H(() => { const T = window.TAAS_FACTORY; T.view.camY += 100; T.tick(0); });
    const moved = await H(() => window.TAAS_FACTORY.board('cash'));
    ok(Math.abs(moved.y - (g.c.y - 100)) < 0.01, 'they scroll with the floor, so a long way down they are out of sight', moved.y + ' vs ' + (g.c.y - 100));
    await H(() => { const T = window.TAAS_FACTORY; T.view.camY = T.view.minY; T.tick(0); });
    const figures = async (n) => H(n => { const T = window.TAAS_FACTORY; T.s.money = n; for (let i = 0; i < 3; i++) T.tick(1); const r = T.board('cash'), d = T.view.dpr;
      const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
      let bits = ''; for (let i = 0; i < im.length; i += 4) bits += im[i] > 225 && im[i + 1] > 225 && im[i + 2] > 225 ? '1' : '0'; return bits; }, n);
    const f4 = await figures(4), f7 = await figures(7777);
    let fd = 0; for (let i = 0; i < f4.length; i++) if (f4[i] !== f7[i]) fd++;
    ok(fd > 200 && f4.indexOf('1') >= 0, 'the money board draws the sum it is given ($4 and $7,777 come out as different figures)', fd + ' px differ');
    // and on the very frame the sum changes: the board draws from the state, never from what the last frame showed.
    // Down from $7,777 to $4, so no swell; the second draw is at dt 0, so nothing else on the wall has moved.
    const sameFrame = await H(() => { const T = window.TAAS_FACTORY, d = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const bits = () => { const r = T.board('cash'), im = g.getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
        let b = ''; for (let i = 0; i < im.length; i += 4) b += im[i] > 225 && im[i + 1] > 225 && im[i + 2] > 225 ? '1' : '0'; return b; };
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
      T.s.money = 7777; for (let i = 0; i < 3; i++) T.tick(1); const was = bits();
      T.s.money = 4; T.tick(1 / 60); const first = bits(); T.tick(0); const next = bits();
      return { first: diff(first, next), changed: diff(was, next) }; });
    ok(sameFrame.first < 20 && sameFrame.changed > 200, 'and it shows a new sum on the very frame the money changes, not a frame late', JSON.stringify(sameFrame));
    await H(() => { const T = window.TAAS_FACTORY; T.s.money = 98765432; for (let i = 0; i < 3; i++) T.tick(1); });
    const big = await boardInk('cash', 0.05);
    ok(big.white > 60 && big.edge === 0, 'a very large sum shrinks to fit inside the money board', JSON.stringify(big));
    // the stall's label on the counter: MEDIUM PLANKS and what a customer pays now, green at full price
    // and amber once customer satisfaction has brought it down (the CD: satisfaction affects the price)
    await H(() => { const T = window.TAAS_FACTORY; T.s.satisfaction = 100; T.tick(0); });
    const full = await boardInk('plate'), r100 = await plateBits();
    await H(() => { const T = window.TAAS_FACTORY; T.s.satisfaction = 72; T.tick(0); });
    const low = await boardInk('plate'), r72 = await plateBits();
    let pd = 0; for (let i = 0; i < r100.length; i++) if (r100[i] !== r72[i]) pd++;
    ok(full.green > 40 && full.white > 60 && !full.amber && low.amber > 40 && !low.green && low.white > 60 && pd > 30, 'the counter\'s label reads MEDIUM PLANKS and the price a customer pays: $4 in green at 100%, $3 in amber at 72%', JSON.stringify([full, low]) + ' ' + pd + ' px of the figure changed');
    // what is on the stall is drawn on it: one plank, then three (nobody in the shop, and every redraw at dt 0)
    const onStall = await H(() => { const T = window.TAAS_FACTORY, s = T.s, st = FACTORY.LAYOUT.STALL, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const grab = () => { const a = T.screen(st.x0, st.y0, st.z + 0.4), b = T.screen(st.x1, st.y1, st.z - 0.02); return g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.round((b[1] - a[1]) * k)).data; };
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
      s.shop.next = 1e9; s.shop.people = []; s.stalls[0].stock = []; T.tick(0); const s0 = grab();
      s.stalls[0].stock.push({ item: 'plank.m', by: 'player' }); T.tick(0); const s1 = grab();
      s.stalls[0].stock.push({ item: 'plank.m', by: 'player' }, { item: 'plank.m', by: 'player' }); T.tick(0); const s3 = grab();
      return { one: diff(s0, s1), three: diff(s1, s3) }; });
    ok(onStall.one > 400 && onStall.three > 400, 'the planks on the stall are drawn on the counter: one, then more as it fills', JSON.stringify(onStall) + ' px changed');
  });

  /* ---------- 14. the shop, with real time ---------- */
  await section('14. shop', async () => {
    await fresh(15);
    await H(() => { const T = window.TAAS_FACTORY; T.s.shop.next = T.s.t; T.view.camY = T.view.minY; T.tick(0); });
    const shopInk = () => H(() => { const T = window.TAAS_FACTORY, L = FACTORY.LAYOUT, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const a = T.screen(0.3, L.SHOP.lineY, 1.25), b = T.screen(5.8, L.SHOP.lineY, 0.75); return Array.from(g.getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.round((b[1] - a[1]) * k)).data); });
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
    const empty = await shopInk();
    await step(1.5);
    const one = await S();
    ok(one.shop.people.length === 1 && one.shop.people[0].x > 0 && one.shop.people[0].x < 2.5 && one.shop.people[0].state === 'in', 'a customer walks in from the door on the left', JSON.stringify(one.shop.people));
    await H(() => { window.TAAS_FACTORY.s.shop.next = 1e9; });
    await step(5);
    const there = await S(), drawn = await shopInk();
    ok(there.shop.people[0].state === 'wait' && Math.abs(there.shop.people[0].x - (await H(() => FACTORY.LAYOUT.SHOP.x0))) < 0.05 && diff(empty, drawn) > 150, 'and stands at the stall, drawn in the shop behind the counter, waiting', diff(empty, drawn) + ' px');
    // a waiting customer thinks of an hourglass
    const glassAt = () => H(() => { const T = window.TAAS_FACTORY, c = T.s.shop.people[0], k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); const p = T.screen(c.x, c.y, 1.2); const d = g.getImageData(Math.round(p[0] * k) - 20, Math.round(p[1] * k) - 60, 40, 60).data; let w = 0, a = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) w++; if (d[i] > 200 && d[i + 1] > 130 && d[i + 1] < 190 && d[i + 2] < 90) a++; } return [w, a]; });
    const hg = await glassAt();
    ok(hg[0] > 60 && hg[1] > 4, 'over a waiting customer, an hourglass (white bubble, running sand)', JSON.stringify(hg));
    const sat0 = await H(() => window.TAAS_FACTORY.s.satisfaction);
    await step(10);
    const sat1 = await H(() => window.TAAS_FACTORY.s.satisfaction);
    ok(sat0 - sat1 > 0.85 && sat0 - sat1 < 1.05, 'and customer satisfaction falls about 0.1% a second while it waits (ten seconds, about 1%)', (sat0 - sat1).toFixed(3));
    await H(() => { const s = window.TAAS_FACTORY.s; s.stalls[0].stock.push({ item: 'plank.m', by: 'player' }); });
    await step(1.2);
    const pay = await H(() => window.TAAS_FACTORY.s.shop.people[0].state);
    await step(2);
    const left = await S();
    ok(pay === 'pay' && left.shop.served === 1 && left.shop.people[0].state === 'out' && left.shop.people[0].item === 'plank.m', 'stocked, it taps its card and walks off with the plank', pay + ' / ' + JSON.stringify(left.shop.people));
    await step(8);
    ok(!(await S()).shop.people.length, 'out the door it came in by');
  });

  /* ---------- 15. your arms, the recycle bin and the slots, through the bubbles ---------- */
  await section('15. bubbles', async () => {
    await fresh(16, true);
    // with more than one thing in your arms, a white badge says how many
    const badge = await H(() => { const T = window.TAAS_FACTORY, a = T.s.avatar, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      T.s.shop.next = 1e9; T.view.camY = T.view.minY;
      const white = () => { const p = T.screen(a.x - 0.5, a.y, 1.5), q = T.screen(a.x + 0.5, a.y, 0.3), d = g.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), Math.round((q[0] - p[0]) * k), Math.round((q[1] - p[1]) * k)).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) n++; return n; };
      const out = {}; [[], ['plank.s'], ['plank.s', 'rough.m'], ['plank.s', 'rough.m', 'plank.s']].forEach(inv => { a.inv = inv; T.tick(0); out[inv.length] = white(); });
      a.inv = []; T.tick(0); return out; });
    ok(badge[1] - badge[0] < 20 && badge[2] - badge[1] > 200 && badge[3] - badge[1] > 200, 'with more than one thing in your arms a white badge counts them; one thing has none', JSON.stringify(badge) + ' white px by things held');
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.shop.next = 1e9; s.avatar.inv.push('plank.s', 'rough.m', 'plank.s'); s.recycle.push('sappy.l'); T.view.camY = T.view.minY; T.tick(0); });
    const rec = await rectOf('recycle');
    await page.touchscreen.tap(rec.x + rec.w / 2, rec.y + rec.h * 0.6);
    let open = false;
    for (let i = 0; i < 40 && !open; i++) { await step(0.1); open = await H(() => !document.getElementById('fx-bubble').hidden); }
    const o = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + '|' + b.getAttribute('aria-label') + '|' + b.querySelector('.fx-lbl').textContent + '|' + (b.querySelector('.fx-arr path').getAttribute('stroke'))));
    ok(open && JSON.stringify(o) === JSON.stringify(['put:plank.s|Put a small plank in, 2|x2|#16b3a5', 'put:rough.m|Put a medium gnarled plank in|x1|#16b3a5', 'take:sappy.l|Take a large sap log out|x1|#f2862e']),
      'a tap on the drawn recycle bin opens its bubble: each kind in your arms to put in (a teal arrow down), each kind in the bin to take out (an orange arrow up)', JSON.stringify(o));
    await page.tap('#fx-bubble [data-opt="put:plank.s"]'); await step(0.05);
    await page.tap('#fx-bubble [data-opt="take:sappy.l"]'); await step(0.05);
    const st = await S();
    ok(st.recycle.join() === 'plank.s,plank.s' && st.avatar.inv.slice().sort().join() === 'rough.m,sappy.l', 'a tap puts both small planks in; another takes the sap log out into your arms', st.recycle.join() + ' / ' + st.avatar.inv.join());
    // the sap extractor's input bin takes it; the bench's takes the gnarled plank
    await H(() => { const T = window.TAAS_FACTORY, y = FACTORY.LAYOUT.ROW.extract; T.view.camY = Math.min(T.view.maxY, T.screen(0, y, 0)[1] + T.view.camY - 300); T.tick(0); });
    const ei = await rectOf('extractInFront');
    await page.touchscreen.tap(ei.x + ei.w / 2, ei.y + ei.h / 2);
    open = false;
    for (let i = 0; i < 80 && !open; i++) { await step(0.1); open = await H(() => !!document.querySelector('#fx-bubble [data-opt="put:sappy.l"]')); }
    const exOpts = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt).join());
    ok(open && exOpts === 'put:sappy.l,put:rough.m', 'the sap extractor\'s input bin offers everything you carry, the sap log and the gnarled plank (2026-10-20: every bin takes anything; it offered just the sap log)', exOpts);
    await page.tap('#fx-bubble [data-opt="put:sappy.l"]'); await step(0.05);
    const ex = await H(() => window.TAAS_FACTORY.s.extract.in.join());
    ok(ex === 'sappy.l', 'and takes it', ex);
    // the saw: three cuts, greyed with nothing to cut, a real tap cuts the next plank
    await H(() => { const T = window.TAAS_FACTORY, s = T.s, y = FACTORY.LAYOUT.ROW.saw; s.avatar.inv.push('plank.l'); T.view.camY = Math.min(T.view.maxY, T.screen(0, y, 0)[1] + T.view.camY - 300); T.tick(0); });
    const sc = await rectOf('sawConsole');
    await page.touchscreen.tap(sc.x + sc.w / 2, sc.y + sc.h * 0.5);
    open = false;
    for (let i = 0; i < 80 && !open; i++) { await step(0.1); open = await H(() => !!document.querySelector('#fx-bubble [data-opt="cut:b2x4"]')); }
    const cuts = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + '|' + b.disabled + '|' + b.textContent.trim()));
    ok(open && cuts.join() === 'cut:b2x4|true|2x4,cut:b2x2|true|2x2,cut:dowels|true|dowels', 'a tap on the drawn table saw offers its three cuts, greyed with nothing in its input bin', cuts.join());
    await H(() => { const s = window.TAAS_FACTORY.s; s.saw.in.push(s.avatar.inv.pop()); });
    await step(0.1);
    const lit = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.disabled + '|' + b.getAttribute('aria-label')));
    ok(lit.join() === 'false|Cut into two large 2"x4"s,false|Cut into four large 2"x2"s,false|Cut into sixteen large dowel rods', 'with a large plank in, they light, named for what each makes of it', lit.join());
    const m0 = await H(() => window.TAAS_FACTORY.s.money);
    await page.tap('#fx-bubble [data-opt="cut:b2x2"]');
    await step(4.5);
    const cut = await S();
    ok(cut.saw.out.join() === 'b2x2.l' && Math.round((m0 - cut.money) * 100) === 10, 'a tap on a cut presses the saw ($0.10), and four large 2"x2"s land in its output bin', cut.saw.out.join() + ' / ' + (m0 - cut.money));
  });
  /* ---------- 16. people keep their hair facing the camera (the CD, 2026-10-16) ---------- */
  // turned toward the camera the head was drawn over the hair, so customers went bald and the avatar lost the hair under
  // its hat. One person alone through the hook (standing, arms down), its pixels sorted by the shading bands of its hair
  // and skin colours (the page's own, read from the source), in boxes round its head's centre measured in metres: the
  // crown above the centre, the face below it, either side of the head under the hat
  await section('16. hair', async () => {
    const hex = ((SRC.match(/const CUST_HAIR = \[([^\]]*)\]/) || ['', ''])[1].match(/#[0-9a-f]{6}/g)) || [], col = SRC.match(/skin: '(#[0-9a-f]{6})', hair: '(#[0-9a-f]{6})'/) || [];
    const look = await H(([hex, skin, avHair]) => {
      const T = window.TAAS_FACTORY;
      const band = h => { const n = parseInt(h.slice(1), 16); return [0, 1, 2].map(k => { const m = [1, 0.85, 0.68][k], t = [0, 0.05, 0.16][k], f = (v, c) => Math.round(Math.min(255, Math.max(0, v * m * (1 - t) + c * t))); return [f(n >> 16 & 255, 60), f(n >> 8 & 255, 70), f(n & 255, 120)]; }); };
      const near = (d, i, B) => B.some(c => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < 24);
      const out = {};
      for (const who of [1, 2, 'avatar']) {
        const H = band(who === 'avatar' ? avHair : hex[(who * 3) % hex.length]), K = band(skin);
        out[who] = {};
        for (const [nm, yaw] of [-0.7, -0.35, 0, 0.35, 0.7].map(e => [Math.round(e * 180 / Math.PI), Math.PI / 2 + e]).concat([['up', -Math.PI / 2]])) {
          const sp = T.person(who, yaw), k = sp.dpr, S = sp.S, d = sp.c.getContext('2d').getImageData(0, 0, sp.c.width, sp.c.height).data, W = sp.c.width, [hx, hy] = sp.head;
          const cnt = (x0, x1, y0, y1, B) => { let n = 0; for (let y = Math.round((hy + y0 * S) * k); y < Math.round((hy + y1 * S) * k); y++) for (let x = Math.round((hx + x0 * S) * k); x < Math.round((hx + x1 * S) * k); x++) { const i = (y * W + x) * 4; if (d[i + 3] > 200 && near(d, i, B)) n++; } return n; };
          out[who][nm] = { crown: cnt(-0.15, 0.15, -0.27, -0.08, H), bare: cnt(-0.15, 0.15, -0.27, -0.08, K), face: cnt(-0.12, 0.12, 0.02, 0.2, K), sides: cnt(-0.3, -0.12, -0.15, 0.08, H) + cnt(0.12, 0.3, -0.15, 0.08, H) };
        }
      }
      return out;
    }, [hex, col[1], col[2]]);
    const turned = who => Object.keys(look[who] || {}).filter(n => n !== 'up').map(n => [n, look[who][n]]), up = who => (look[who] || {}).up || {};
    const say = who => JSON.stringify(look[who]);
    const cust = [1, 2].filter(w => !(turned(w).length === 5 && turned(w).every(([, r]) => r.crown >= 0.75 * up(w).crown && r.bare < 40 && r.face > 200)));
    ok(hex.length === 5 && !cust.length, 'a customer turned toward the camera keeps its hair (the CD\'s bald customers): as much on its crown as seen from behind, from 40 degrees either side of straight down, with its face below',
      cust.map(say).join(' ') + (hex.length === 5 ? '' : ' hair colours ' + hex.join()));
    const back = [1, 2].filter(w => !(up(w).crown > 300 && up(w).bare < 20 && up(w).face < 20));
    ok(!back.length, 'and seen from behind it is all hair still, crown and nape: the hair opens over the face only', back.map(say).join(' '));
    const av = turned('avatar');
    ok(av.length === 5 && av.every(([, r]) => r.sides >= 0.4 * up('avatar').sides && r.face > 200), 'the avatar too: turned toward the camera, hair shows under the hard hat either side of its head, with its face below', say('avatar'));
  });
  /* ---------- 17. the delay between tasks: its slider, its steppers, the waiting robot (the CD, 2026-10-16) ---------- */
  await section('17. delay', async () => {
    // two robots on staff, the operator on the planer with medium logs only, and no mistake seen yet
    const staff = async (seed) => {
      await fresh(seed);
      await H(() => {
        const T = window.TAAS_FACTORY, s = T.s;
        s.money = 60; s.shop.next = 1e9;
        ['operate', 'stock:0'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
        s.robots[1].job = null; s.robots[1].state = 'idle';
        s.rack = Array(400).fill('log.m'); s.rackMine = 0; s.force.think = Array(400).fill(false); s.force.slip = Array(400).fill(false);
        s.money = 100; s.events = []; T.view.camY = T.view.minY; T.tick(1 / 60);
      });
    };
    await staff(17);
    await H(() => window.TAAS_FACTORY.openRobot(0));
    await page.tap('[data-panel="buy"]'); await step(0.05);
    const list = await H(() => ({ seen: FACTORY.known(window.TAAS_FACTORY.s).map(q => q.id).join(), rules: [...document.querySelectorAll('.fx-rules .fx-rule')].map(b => b.textContent) }));
    ok(list.seen === 'delay' && list.rules.join('|') === 'Wait between tasks', 'with no mistake seen yet, a new slot\'s list offers the delay, and only the delay', JSON.stringify(list));
    await page.tap('[data-panel="rule:delay"]'); await step(0.05);
    const put = await H(() => { const w = document.querySelector('.fx-wait'), sl = document.getElementById('fx-wait'); return { slot: document.querySelector('.fx-slot.filled') && document.querySelector('.fx-slot.filled').textContent, wait: window.TAAS_FACTORY.s.robots[0].wait, row: !!w && w.closest('li') === document.querySelector('.fx-slot.filled').closest('li'), type: sl && sl.type, min: sl && sl.min, max: sl && sl.max, step: sl && sl.step, value: sl && sl.value, out: w && w.querySelector('output').textContent, steps: w ? w.querySelectorAll('[data-panel^="wait:"]').length : 0 }; });
    ok(put.slot === 'Wait between tasks' && put.wait === 5 && put.row && put.type === 'range' && put.min === '0' && put.max === '60' && put.step === '1' && put.value === '5' && put.out === '5 s' && put.steps === 2,
      'in a slot, the delay shows its wait under it: a slider from 0 to 60 a second at a time, at 5 s, with a - and a + either side', JSON.stringify(put));
    await page.tap('[data-panel="wait:1"]'); await step(0.05);
    const up1 = await H(() => ({ wait: window.TAAS_FACTORY.s.robots[0].wait, out: document.querySelector('.fx-wait output').textContent, value: document.getElementById('fx-wait').value }));
    await page.tap('[data-panel="wait:-1"]'); await step(0.05); await page.tap('[data-panel="wait:-1"]'); await step(0.05);
    const dn2 = await H(() => ({ wait: window.TAAS_FACTORY.s.robots[0].wait, out: document.querySelector('.fx-wait output').textContent, value: document.getElementById('fx-wait').value }));
    ok(up1.wait === 6 && up1.out === '6 s' && up1.value === '6' && dn2.wait === 4 && dn2.out === '4 s' && dn2.value === '4', '+ sets the robot\'s wait a second longer and - a second shorter, in the engine, on the slider and in the figure', JSON.stringify([up1, dn2]));
    // the ends, by the keyboard on the slider (which also keeps its focus through the page redrawing)
    await page.focus('#fx-wait'); await page.keyboard.press('End'); await step(0.05);
    const hi = await H(() => ({ wait: window.TAAS_FACTORY.s.robots[0].wait, out: document.querySelector('.fx-wait output').textContent, plus: document.querySelector('[data-panel="wait:1"]').disabled, minus: document.querySelector('[data-panel="wait:-1"]').disabled, focus: document.activeElement && document.activeElement.id }));
    await page.keyboard.press('ArrowRight'); await step(0.05);
    const hi2 = await H(() => window.TAAS_FACTORY.s.robots[0].wait);
    await page.keyboard.press('Home'); await step(0.05);
    const lo = await H(() => ({ wait: window.TAAS_FACTORY.s.robots[0].wait, out: document.querySelector('.fx-wait output').textContent, plus: document.querySelector('[data-panel="wait:1"]').disabled, minus: document.querySelector('[data-panel="wait:-1"]').disabled }));
    const below = await H(() => FACTORY.setWait(window.TAAS_FACTORY.s, 0, -1));
    ok(hi.wait === 60 && hi.out === '60 s' && hi.plus && !hi.minus && hi.focus === 'fx-wait' && hi2 === 60 && lo.wait === 0 && lo.out === '0 s' && lo.minus && !lo.plus && !below,
      'it stops at 60 (+ greyed) and at 0 (- greyed), and the slider keeps the keyboard while the page redraws', JSON.stringify({ hi, hi2, lo, below }));
    // a drag on the slider, with real touches, while the operator works and its evals change under it every few frames
    await page.tap('[data-panel="wait:1"]'); await page.tap('[data-panel="wait:1"]'); await page.tap('[data-panel="wait:1"]'); await step(0.05);
    const cdp = await ctx.newCDPSession(page);
    const geo = await H(() => { const e = document.getElementById('fx-wait'), r = e.getBoundingClientRect(); e.__mine = true; return { l: r.left, w: r.width, y: r.top + r.height / 2, rec: JSON.stringify(window.TAAS_FACTORY.s.robots[0].record) }; });
    const at = v => geo.l + 8 + (geo.w - 16) * v / 60;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at(3), y: geo.y }] });
    let same = true, mid = null;
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at(3 + 4.5 * i), y: geo.y }] });
      await H(() => { const r = window.TAAS_FACTORY.s.robots[0]; r.record.plank = (r.record.plank || 0) + 1; });   // its evals change under the finger (staged: the robot is mid-wait)
      await step(0.5);
      const q = await H(() => { const e = document.getElementById('fx-wait'); return { mine: !!(e && e.__mine), wait: window.TAAS_FACTORY.s.robots[0].wait, out: document.querySelector('.fx-wait output').textContent }; });
      if (!q.mine) same = false;
      if (i === 5) mid = q;
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await step(0.05);
    const end = await H(() => { const r = window.TAAS_FACTORY.s.robots[0], e = document.getElementById('fx-wait'); return { wait: r.wait, value: e.value, out: document.querySelector('.fx-wait output').textContent, redrawn: !e.__mine, rec: JSON.stringify(r.record), saved: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.indexOf('taas.factory.v') === 0) || 'null') || 'null') }; });
    const savedWait = end.saved && end.saved.robots && end.saved.robots[0].wait;
    ok(same && mid && Math.abs(mid.wait - 25) <= 3 && mid.out === mid.wait + ' s' && Math.abs(end.wait - 48) <= 3 && end.value === String(end.wait) && end.out === end.wait + ' s' && end.rec !== geo.rec && end.redrawn && savedWait === end.wait,
      'a drag on the slider is never redrawn under the finger: the wait and its figure follow it to the end while the robot\'s evals change, the page catches up on release, and the wait is saved', JSON.stringify({ same, mid, end: Object.assign({}, end, { saved: savedWait, rec: end.rec === geo.rec ? 'unchanged' : 'changed' }) }));
    await page.tap('[data-panel="wait:1"]');
    // read the save before any frame runs (the page also saves every 2 s of frames and on leaving, which would hide a stepper that never saves)
    const want = await H(() => ({ wait: window.TAAS_FACTORY.s.robots[0].wait, saved: (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.indexOf('taas.factory.v') === 0)) || '{}').robots || [{}])[0].wait }));
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    const back = await H(() => { const T = window.TAAS_FACTORY; T.paused = true; T.openRobot(0); T.tick(1 / 60); return { wait: T.s.robots[0].wait, value: document.getElementById('fx-wait') && document.getElementById('fx-wait').value, out: document.querySelector('.fx-wait output') && document.querySelector('.fx-wait output').textContent }; });
    ok(want.wait === end.wait + 1 && want.saved === want.wait && back.wait === want.wait && back.value === String(want.wait) && back.out === want.wait + ' s', 'a tap on + is saved at once, and the wait survives a reload, on the slider and in the engine', JSON.stringify({ want, back }));
    await H(() => window.TAAS_FACTORY.closePanel());
    // the evals: the operator waits, then slips once and goes straight on
    await staff(18);
    const ev = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      FACTORY.buySlot(s, 0); FACTORY.setRule(s, 0, 0, 'delay'); FACTORY.setWait(s, 0, 1);
      s.force.slip = [false, false, true].concat(Array(40).fill(false));
      for (let i = 0; i < 1200; i++) FACTORY.step(s, 0.05);   // a walk to the planer, then a log every 5 s or so
      T.openRobot(0); T.tick(1 / 60);
      return [...document.querySelectorAll('.fx-evals .fx-rec tr')].map(tr => tr.querySelector('.fx-dot').className.replace('fx-dot ', '') + '|' + tr.textContent.replace(/\d+$/, ''));
    });
    ok(ev.includes('good|Waited between tasks') && ev.includes('soso|Went straight on, against its instructions') && ev.indexOf('good|Waited between tasks') < ev.indexOf('soso|Went straight on, against its instructions'),
      'its evals count each wait in green and the time it went straight on, against its instructions, in yellow below it', JSON.stringify(ev));
    await H(() => window.TAAS_FACTORY.closePanel());
    // the waiting robot, read off pixels: the engine and the dust held, the clock still, the robot idle and then pausing
    const sign = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, r = s.robots[0], k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      window.__step = FACTORY.step; window.__rnd = Math.random; FACTORY.step = () => {}; Math.random = () => 0.999;
      T.tick(2);   // the minute's floats (a "-$0.10" a press, a restock's "-$10") rise and go before the pixels are read
      T.view.camY = Math.min(T.view.maxY, Math.max(T.view.minY, T.screen(0, r.y, 0)[1] + T.view.camY - 400));
      const grab = () => { r.moodT = 0; T.tick(0); const p = T.screen(r.x, r.y, 1.3); const d = g.getImageData(Math.round((p[0] - 18) * k), Math.round((p[1] - 36) * k), Math.round(36 * k), Math.round(40 * k)).data; let teal = 0, white = 0; for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - 22) < 30 && Math.abs(d[i + 1] - 179) < 30 && Math.abs(d[i + 2] - 165) < 30) teal++; if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++; } return { teal, white, px: Array.from(d) }; };
      r.state = 'idle'; r.t = 0; const idle = grab();
      r.state = 'pause'; r.wait = 10; r.t = 1; const early = grab();
      r.t = 8; const late = grab();
      r.state = 'idle'; r.t = 0;
      FACTORY.step = window.__step; Math.random = window.__rnd;
      let changed = 0; for (let i = 0; i < idle.px.length; i += 4) if (Math.abs(idle.px[i] - early.px[i]) + Math.abs(idle.px[i + 1] - early.px[i + 1]) + Math.abs(idle.px[i + 2] - early.px[i + 2]) > 60) changed++;
      return { idle: [idle.teal, idle.white], early: [early.teal, early.white], late: [late.teal, late.white], changed };
    });
    ok(sign.changed > 300 && sign.idle[0] < 10 && sign.early[1] > sign.idle[1] + 300 && sign.early[0] > 2.5 * sign.late[0] && sign.late[0] > 20,
      'a robot waiting between tasks shows a pause sign over its head (none while it works), with a ring that empties as the wait runs out', JSON.stringify(sign));
    // the slot row at phone sizes: everything inside the page, nothing on anything, every button a finger wide
    const bad = [];
    for (const [w, h] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await H(() => { const T = window.TAAS_FACTORY; T.closePanel(); T.openRobot(0); T.tick(1 / 60); });
      const r = await H(() => {
        const b = e => { const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width, h: q.height }; };
        const li = document.querySelector('.fx-waits'), body = document.getElementById('fx-panel-body');
        return { body: b(body), li: li && b(li), kids: li ? ['.fx-slot', '.fx-x', '[data-panel="wait:-1"]', '#fx-wait', '[data-panel="wait:1"]', 'output'].map(sel => [sel, b(li.querySelector(sel))]) : [], wide: document.scrollingElement.scrollWidth > innerWidth || body.scrollWidth > body.clientWidth + 1 };
      });
      if (!r.li) { bad.push(w + 'x' + h + ' no slot holding the delay'); continue; }
      if (r.wide) bad.push(w + 'x' + h + ' sideways scroll');
      r.kids.forEach(([n, q]) => { if (q.l < r.li.l - 0.5 || q.r > r.li.r + 0.5) bad.push(w + 'x' + h + ' ' + n + ' outside its row'); });
      r.kids.filter(([n]) => n !== 'output' && n !== '.fx-slot').forEach(([n, q]) => { if ((n === '#fx-wait' ? q.w : Math.min(q.w, q.h)) < 44) bad.push(w + 'x' + h + ' ' + n + ' under 44 px (' + Math.round(n === '#fx-wait' ? q.w : Math.min(q.w, q.h)) + ')'); });
      for (let i = 0; i < r.kids.length; i++) for (let j = i + 1; j < r.kids.length; j++) { const [a, p] = r.kids[i], [c, q] = r.kids[j]; if (!(p.r <= q.l + 0.5 || q.r <= p.l + 0.5 || p.b <= q.t + 0.5 || q.b <= p.t + 0.5)) bad.push(w + 'x' + h + ' ' + a + ' over ' + c); }
      if (r.li.r > r.body.r || r.li.l < r.body.l) bad.push(w + 'x' + h + ' row outside the page');
    }
    await H(() => window.TAAS_FACTORY.closePanel());
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length, 'at 320 and 390 wide the slot, its cross, the - and +, the slider and the figure all sit inside the row, none on another, each button a finger wide', bad.join('; '));
    await H(() => window.TAAS_FACTORY.showInfo());
    const info = await H(() => document.getElementById('fx-panel-body').textContent);
    await H(() => window.TAAS_FACTORY.closePanel());
    ok(/on the list from the start and suits any robot: Wait between tasks/.test(info) && /0 to 60 seconds \(5 to begin with\)/.test(info) && /a wait between tasks, as told/.test(info), 'Info tells of the delay: on the list from the start, 0 to 60 seconds, 5 to begin with, and a wait as told is green', (info.match(/One is on the list[^.]*\.[^.]*\./) || [''])[0]);
  });
  /* ---------- 18. the picker that stays put, and bins you can take from (the CD, 2026-10-16) ---------- */
  await section('18. bins', async () => {
    // the picker: scrolled down its list while the robot works, it stays where it was
    await fresh(19);
    const pk = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.money = 60; s.shop.next = 1e9;
      ['operate', 'stock:0'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
      s.rack = Array(200).fill('log.m'); s.rackMine = 0; s.force.think = Array(400).fill(false);
      FACTORY.RULES.forEach(q => { if (q.id !== 'output') s.seen[q.id] = true; });   // a long list, one still to come
      s.money = 500; FACTORY.buySlot(s, 0); s.events = [];
      T.openRobot(0); T.tick(1 / 60);
      document.querySelector('[data-panel="pick:0"]').click(); T.tick(1 / 60);
      const list = document.querySelector('.fx-rules');
      list.scrollTop = 140; const first = list.firstElementChild; first.dataset.mark = 'kept';
      const rec0 = JSON.stringify(s.robots[0].record);
      for (let i = 0; i < 20 * 60; i++) T.tick(1 / 60);   // twenty seconds of the robot pressing logs, the page drawn every frame
      const l2 = document.querySelector('.fx-rules');
      const worked = JSON.stringify(s.robots[0].record) !== rec0;
      const out = { worked, top: l2.scrollTop, same: l2 === list && l2.firstElementChild.dataset.mark === 'kept', n: l2.children.length, scrolls: l2.scrollHeight > l2.clientHeight + 100 };
      // a new instruction joining the list rebuilds the picker, still where it was
      s.seen.output = true; T.tick(1 / 60);
      const l3 = document.querySelector('.fx-rules');
      out.joined = [l3.children.length, l3.scrollTop, l3 !== list];
      return out;
    });
    ok(pk.worked && pk.scrolls && pk.same && pk.top === 140, 'scrolled down the instruction list while the robot works, the list stays where it was: the robot finishing things no longer rebuilds it (the CD\'s jumping list)', JSON.stringify(pk));
    ok(pk.joined[0] === pk.n + 1 && pk.joined[1] === 140 && pk.joined[2], 'and when a new instruction joins the list the picker is rebuilt with it, still scrolled where it was', JSON.stringify(pk.joined));
    // a finger down in the list holds it as it is until the finger lifts
    const held = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, list = document.querySelector('.fx-rules'), btn = list.children[3];
      const touch = (type, el) => { const tch = new Touch({ identifier: 1, target: el, clientX: 10, clientY: 10 }); el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [tch], changedTouches: [tch] })); };
      touch('touchstart', btn);
      s.seen.output = false; s.seen.output = true; delete s.seen.price; T.tick(1 / 60);   // the list changes under the finger
      const during = document.querySelector('.fx-rules') === list;
      touch('touchend', btn); T.tick(1 / 60);
      const after = document.querySelector('.fx-rules') !== list;
      return { during, after };
    });
    ok(held.during && held.after, 'a finger down in the list holds it as it is (no button swapped under the finger), and it is rebuilt once the finger lifts', JSON.stringify(held));
    await H(() => window.TAAS_FACTORY.closePanel());

    // the recycle bin's bubble: yours on top, settled into the lower left; the bin's below, settled into the upper left
    await fresh(20);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.shop.next = 1e9;
      s.avatar.inv.push('plank.s', 'plank.s', 'rough.m', 'sap', 'log.l', 'b2x4.m');
      s.recycle.push('sappy.l', 'dowels.s');
      FACTORY.tap(s, { kind: 'recycle' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05);
      T.tick(1 / 60); T.tick(1 / 60);
    });
    const geo = () => H(() => {
      const b = document.getElementById('fx-bubble'), top = b.querySelector('.fx-mine'), bot = b.querySelector('.fx-bins'), line = b.querySelector('.fx-line');
      const R = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; };
      const puts = [...top.querySelectorAll('[data-opt]')], takes = [...bot.querySelectorAll('[data-opt]')];
      return { line: R(line).t, top: R(top), bot: R(bot), puts: puts.map(e => e.dataset.opt), takes: takes.map(e => e.dataset.opt), p0: puts[0] ? R(puts[0]) : null, t0: takes[0] ? R(takes[0]) : null, ph: [top.querySelectorAll('.fx-ph').length, bot.querySelectorAll('.fx-ph').length] };
    });
    const g0 = await geo();
    ok(g0.puts.join() === 'put:log.l,put:plank.s,put:rough.m,put:sap,put:b2x4.m' && g0.takes.join() === 'take:sappy.l,take:dowels.s' && g0.top.b < g0.line && g0.bot.t > g0.line && g0.top.b - g0.top.t === g0.bot.b - g0.bot.t,
      'at the recycle bin the bubble shows what you carry on top and what is in the bin below, a line between two halves of the same height', JSON.stringify(g0));
    ok(g0.p0 && Math.abs(g0.p0.b - g0.top.b) <= 1 && Math.abs(g0.p0.l - g0.top.l) <= 1 && g0.t0 && Math.abs(g0.t0.t - g0.bot.t) <= 1 && Math.abs(g0.t0.l - g0.bot.l) <= 1,
      'yours settle into the lower left of the top half, the bin\'s into the upper left of the bottom half', JSON.stringify([g0.p0, g0.top, g0.t0, g0.bot]));
    // tap the same spot again and again: everything you carry goes in, and the line never moves
    const spot = [g0.p0.l + 20, g0.p0.b - 20], lines = [g0.line];
    for (let i = 0; i < 7; i++) { await page.touchscreen.tap(spot[0], spot[1]); await step(0.05); lines.push((await geo()).line); }
    const g1 = await geo(), s1 = await S();
    ok(!s1.avatar.inv.length && s1.recycle.length === 8 && lines.every(y => y === g0.line) && g1.ph[0] === 1 && g1.puts.length === 0,
      'tapping that lower-left tile again and again puts everything you carry in the bin, a kind a tap, and the line between the halves never moves (the CD)', JSON.stringify({ lines, inv: s1.avatar.inv, bin: s1.recycle.length, ph: g1.ph }));
    const spot2 = [g1.t0.l + 20, g1.t0.t + 20];
    for (let i = 0; i < 9; i++) { await page.touchscreen.tap(spot2[0], spot2[1]); await step(0.05); lines.push((await geo()).line); }
    const g2 = await geo(), s2 = await S();
    ok(!s2.recycle.length && s2.avatar.inv.length === 8 && lines.every(y => y === g0.line) && g2.ph[1] === 1 && g2.takes.length === 0,
      'and tapping the upper-left tile below again and again takes it all back out into your arms, the line still where it was', JSON.stringify({ inv: s2.avatar.inv.length, bin: s2.recycle.length, ph: g2.ph, lines: [...new Set(lines)] }));
    // a plank put in the table saw's input bin comes back out (the CD's example)
    await fresh(21, true);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.shop.next = 1e9; s.avatar.inv.push('plank.m');
      FACTORY.tap(s, { kind: 'sawIn' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05);
      T.tick(1 / 60); T.tick(1 / 60);
    });
    await page.tap('#fx-bubble [data-opt="put:plank.m"]'); await step(0.05);
    const inSaw = await H(() => window.TAAS_FACTORY.s.saw.in.join());
    await page.tap('#fx-bubble [data-opt="take:plank.m"]'); await step(0.05);
    const s3 = await S();
    ok(inSaw === 'plank.m' && !s3.saw.in.length && s3.avatar.inv.join() === 'plank.m', 'a plank put in the table saw\'s input bin can be taken back out with a tap on its bubble\'s lower half, to sell instead (the CD\'s example)', inSaw + ' / ' + s3.avatar.inv.join());
    // the planer's input bin: its logs are on its rack, and its bubble takes them out
    const rackPx = async () => H(() => {
      const T = window.TAAS_FACTORY, r = T.spriteRect('rack'), k = T.view.dpr;
      T.tick(0);
      const d = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.w * k), Math.round(r.h * k)).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2]; return n / (d.length / 4);
    });
    await fresh(22);
    await H(() => { const s = window.TAAS_FACTORY.s; s.shop.next = 1e9; s.rack = []; });
    const empty = await rackPx();
    await H(() => { const s = window.TAAS_FACTORY.s; s.rack = ['log.l', 'log.l', 'log.l', 'log.l', 'log.l', 'log.l']; });
    const full = await rackPx();
    ok(Math.abs(full - empty) > 8, 'the planer\'s rack shows the logs in its input bin: an empty bin, an empty rack', empty.toFixed(1) + ' vs ' + full.toFixed(1));
    await fresh(23);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.shop.next = 1e9; s.rack = ['sappy.m', 'log.m', 'sappy.m']; s.rackMine = 0;
      FACTORY.tap(s, { kind: 'rack' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05);
      T.tick(1 / 60); T.tick(1 / 60);
    });
    const rb = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + '|' + b.getAttribute('aria-label')));
    await page.tap('#fx-bubble [data-opt="take:sappy.m"]'); await step(0.05);
    const s4 = await S();
    ok(rb.join() === 'take:log.m|Take a medium log out,take:sappy.m|Take a medium sap log out, 2' && s4.avatar.inv.join() === 'sappy.m,sappy.m' && s4.rack.join() === 'log.m',
      'the planer\'s input bin gives its logs back too: take the sap logs out for the sap extractor', JSON.stringify(rb) + ' / ' + s4.avatar.inv.join());
    // a restock says what it cost, over the rack (what the canvas writes, read off fillText)
    const said = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, g = document.getElementById('fx-canvas').getContext('2d'), out = [], fill = g.fillText;
      s.bubble = null; s.rack = []; s.rackMine = 0; s.machine.log = 'log.m'; s.machine.staged = 1;
      FACTORY.tap(s, { kind: 'machine' });
      for (let i = 0; i < 400 && !s.events.some(e => e.kind === 'restock'); i++) FACTORY.step(s, 0.05);
      g.fillText = function (txt) { out.push(String(txt)); return fill.apply(this, arguments); };
      T.tick(1 / 60);
      g.fillText = fill;
      return out;
    });
    ok(said.includes('-$10') && said.includes('10 logs bought') && said.includes('-$0.10'), 'when the planer\'s bin runs out and restocks, "-$10" and "10 logs bought" float up over it (and each press says its "-$0.10")', JSON.stringify(said.filter(x => /\$|logs/.test(x))));
  });
  /* ---------- 19. four stalls, eight robots (taasstalls step 3) ---------- */
  await section('19. stalls and robots', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(19, true);
    await H(() => { const T = window.TAAS_FACTORY; T.s.money = 500; T.s.shop.next = 1e9; T.view.camY = T.view.minY; T.tick(0); });
    // the counter at the start: the first stall's tray and label, three empty places each with a plus
    const start = await H(() => {
      const T = window.TAAS_FACTORY, L = FACTORY.LAYOUT, g = document.getElementById('fx-canvas').getContext('2d'), d = T.view.dpr;
      const plus = L.STALLS.map(q => { const p = T.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z), im = g.getImageData(Math.round(p[0] * d) - 6, Math.round(p[1] * d) - 6, 13, 13).data; let w = 0, t = 0; for (let i = 0; i < im.length; i += 4) { if (im[i] > 235 && im[i + 1] > 235 && im[i + 2] > 235) w++; if (im[i] < 90 && im[i + 1] > 150 && im[i + 2] > 140) t++; } return [w, t]; });
      const q = L.STALLS[0], p = T.screen((q.x0 + q.x1) / 2 - 0.3, (q.y0 + q.y1) / 2, q.z + 0.03), tf = g.getImageData(Math.round(p[0] * d), Math.round(p[1] * d), 1, 1).data;
      return { drawn: [0, 1, 2, 3].map(i => !!T.spriteRect('stall' + i) + '/' + !!T.spriteRect('plate' + i)), plus, tray: [tf[0], tf[1], tf[2]] };
    });
    ok(start.drawn.join() === 'true/true,false/false,false/false,false/false' && start.plus.slice(1).every(([w, t]) => w > 10 && t > 3) && start.plus[0][1] <= 3 && start.tray.every(v => v > 215),
      'at the start the counter has the first stall\'s tray (its pale floor drawn over the counter\'s top) and label, and three empty places, each a dashed outline with a white plus in the middle', JSON.stringify(start));
    // a real tap on an empty place: you walk round, and its bubble offers the stall for the flat $1 (2026-10-20; it was $50)
    const p1 = await H(() => { const q = FACTORY.LAYOUT.STALLS[1]; return window.TAAS_FACTORY.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z); });
    await page.touchscreen.tap(p1[0], p1[1]);
    let open = false;
    for (let i = 0; i < 200 && !open; i++) { await step(0.1); open = await H(() => !!document.querySelector('#fx-bubble [data-opt="buystall"]')); }
    const buy = await H(() => { const b = document.querySelector('#fx-bubble [data-opt="buystall"]'); return b && [b.getAttribute('aria-label'), b.textContent.trim(), b.querySelector('svg') ? 1 : 0]; });
    ok(open && buy && buy[0] === 'Buy a stall here, $1' && buy[1] === '$1' && buy[2] === 1, 'a tap on an empty place walks you there, and its bubble offers a stall for $1, with a picture of one', JSON.stringify(buy));
    if (await page.$('#fx-bubble [data-opt="buystall"]')) await page.tap('#fx-bubble [data-opt="buystall"]');   // (a missing button fails the rows, not the run)
    await step(0.2);
    const sells = await H(() => [...document.querySelectorAll('#fx-bubble .fx-brow')].map(r => [...r.querySelectorAll('[data-opt^="sell:"]')].map(b => b.dataset.opt.slice(5) + '=' + b.textContent.trim() + (b.querySelector('svg') ? '' : '!nopic') + (b.classList.contains('on') ? '*' : ''))).filter(r => r.length));
    const backBtn = await H(() => !!document.querySelector('#fx-bubble [data-opt="back"]'));
    const want = await H(() => { const s = window.TAAS_FACTORY.s; return FACTORY.SELLS.map(x => x + '=' + '$' + (Math.abs(FACTORY.priceNow(s, x) - Math.round(FACTORY.priceNow(s, x))) < 0.005 ? Math.round(FACTORY.priceNow(s, x)) : FACTORY.priceNow(s, x).toFixed(2))); });
    const t1 = await S();
    ok(t1.money === 499 && t1.stalls[1].bought && t1.stalls[1].want === null && backBtn && sells.map(r => r.length).join() === '4,3,3,3' && [].concat(...sells).slice().sort().join() === want.slice().sort().join(),
      'buying it costs $1, and the bubble turns into the thirteen things the stall can sell, a row to a kind (planks and sap, then each of the saw\'s cuts), each with a picture and what a customer pays now, none marked (2026-10-20: the Re-assign list, under a back button)', JSON.stringify(sells));
    // the stall's bubble sits under the stall when there is no room over it, and never covers its tray
    const bub = await H(() => { const T = window.TAAS_FACTORY, q = FACTORY.LAYOUT.STALLS[1], b = document.getElementById('fx-bubble').getBoundingClientRect(), p = T.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z); return { cover: p[0] > b.left && p[0] < b.right && p[1] > b.top && p[1] < b.bottom, on: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, under: document.getElementById('fx-bubble').classList.contains('under') }; });
    ok(!bub.cover && bub.on, 'the stall\'s bubble is on screen and does not cover the stall it is about (under it, ' + bub.under + ')', JSON.stringify(bub));
    // choosing what it sells: a real tap; its label then shows the thing and what a customer pays for it
    const blank = await H(() => { const T = window.TAAS_FACTORY, r = T.board('plate', 1), d = T.view.dpr, im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] + im[i + 1] + im[i + 2] > 360) n++; return n; });
    if (await page.$('#fx-bubble [data-opt="sell:plank.l"]')) await page.tap('#fx-bubble [data-opt="sell:plank.l"]');
    await step(0.3);
    await H(() => { const T = window.TAAS_FACTORY; T.s.avatar.x = 5.4; T.s.avatar.y = 6.0; T.s.avatar.path = []; T.s.bubble = null; T.tick(0); });
    const lab = await H(() => {
      const T = window.TAAS_FACTORY, d = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'), said = [], fill = g.fillText;
      g.fillText = function (txt) { said.push(String(txt)); return fill.apply(this, arguments); };
      T.tick(0);
      g.fillText = fill;
      const r = T.board('plate', 1), im = g.getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
      let n = 0, green = 0; for (let i = 0; i < im.length; i += 4) { if (im[i] + im[i + 1] + im[i + 2] > 360) n++; if (im[i + 1] > 200 && im[i] < 170 && im[i + 2] < 190) green++; }
      return { n, green, said: said.filter(x => /PLANK|\$/.test(x)) };
    });
    const t2 = await S();
    ok(t2.stalls[1].want === 'plank.l' && blank < 5 && lab.n > 60 && lab.green > 10 && lab.said.indexOf('LARGE PLANKS') >= 0 && lab.said.indexOf('$8') >= 0 && lab.said.indexOf('MEDIUM PLANKS') >= 0 && lab.said.indexOf('$4') >= 0,
      'a tap on large planks sets the stall: its label, blank until then, now reads LARGE PLANKS at $8 in green beside the first stall\'s MEDIUM PLANKS at $4', JSON.stringify({ blank, lab }));
    // what is in a stall is drawn on its own tray
    const tray = async () => H(() => { const T = window.TAAS_FACTORY, q = FACTORY.LAYOUT.STALLS[1], d = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); T.tick(0); const x0 = T.screen(q.x0 + 0.1, 0, 0)[0], x1 = T.screen(q.x1 - 0.1, 0, 0)[0], y0 = T.screen(0, q.y0, q.z + 0.3)[1], y1 = T.screen(0, q.y1, q.z)[1]; const im = g.getImageData(Math.round(x0 * d), Math.round(y0 * d), Math.round((x1 - x0) * d), Math.round((y1 - y0) * d)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 200 && im[i + 1] > 160 && im[i + 1] < 215 && im[i + 2] < 150) n++; return n; });
    const empty = await tray();
    await H(() => { const s = window.TAAS_FACTORY.s; s.stalls[1].stock.push({ item: 'plank.l', by: 'player' }, { item: 'plank.l', by: 'player' }); });
    const full = await tray();
    ok(full > 200 && full > 5 * empty, 'the planks in the second stall are drawn on its own tray', empty + ' -> ' + full + ' plank-coloured pixels');
    // a tap on each stall's drawn tray, its label or an empty place reaches that stall
    const taps = [];
    for (const [w, h] of [[390, 844], [320, 640], [844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      const res = await H(() => {
        const T = window.TAAS_FACTORY, out = [];
        T.view.camY = T.view.minY; T.tick(0);
        FACTORY.LAYOUT.STALLS.forEach((q, i) => {
          const at = [['tray', T.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z + 0.05)], ['label', [T.board('plate', i).x + T.board('plate', i).w / 2, T.board('plate', i).y + T.board('plate', i).h / 2]]];
          at.forEach(([what, p]) => { if (p[1] < 55 || p[1] > T.view.h) return; const t = T.hitTest(p[0], p[1]); out.push(i + what + (t && t.kind === 'stall' && t.i === i ? '' : '->' + JSON.stringify(t))); });
        });
        return out;
      });
      res.forEach(x => taps.push(w + 'x' + h + ' ' + x));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(taps.length >= 16 && taps.every(x => !/->/.test(x)), 'at three sizes a tap on each stall\'s tray (or empty place) and on its label reaches that stall, east to west', taps.filter(x => /->/.test(x)).join('; ') + ' (' + taps.length + ' taps)');
    // the robots' jobs: a stall's shows what it sells and its number; slots 02-04 each have a picture of their own
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, run = n => { for (let k = 0; k < n; k++) FACTORY.step(s, 0.05); };
      s.money = 2000;
      FACTORY.tap(s, { kind: 'stall', i: 2 }); run(300); FACTORY.choose(s, 'buystall'); s.bubble = null;
      for (let k = 0; k < 2; k++) { FACTORY.tap(s, { kind: 'dock' }); run(400); FACTORY.choose(s, 'hire'); s.bubble = null; }
      FACTORY.tap(s, { kind: 'robot', id: 1 }); run(300);
      T.tick(0);
    });
    const jb = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => ({ id: b.dataset.opt, aria: b.getAttribute('aria-label'), lbl: b.textContent.trim(), svg: (b.querySelector('svg') || {}).outerHTML || '' })));
    const by = id => jb.find(o => o.id === id) || { svg: '', aria: '', lbl: '' };
    const pics = ['job:operate', 'job:saw', 'job:extract', 'job:carve'].map(k => by(k).svg);
    ok(jb.map(o => o.id).join() === 'job:operate,job:stock:0,job:stock:1,job:stock:2,job:extract,job:carve,job:saw,job:rest,notes'
      && by('job:stock:1').aria === 'Stock stall 2, large planks' && by('job:stock:1').lbl === '2' && /viewBox="0 0 34 9"/.test(by('job:stock:1').svg) && /viewBox="0 0 26 9"/.test(by('job:stock:0').svg) && by('job:stock:2').aria === 'Stock stall 3' && /<rect x="7" y="10"/.test(by('job:stock:2').svg)
      && pics.every(p => p.length > 50) && new Set(pics).size === 4,
      'a robot\'s bubble lists the planer, a job for each stall bought (what the stall sells and its number, or the stocking icon while it sells nothing) and slots 02 to 04, each with a picture of its own', JSON.stringify(jb.map(o => o.id + '=' + o.aria + '|' + o.lbl)));
    // the saw's robot: a real tap gives it the job; its page has the cut, and a real tap sets it
    if (await page.$('#fx-bubble [data-opt="job:saw"]')) await page.tap('#fx-bubble [data-opt="job:saw"]');
    await step(0.2);
    await H(() => window.TAAS_FACTORY.openRobot(1));
    await step(0.1);
    const cut0 = await H(() => [...document.querySelectorAll('.fx-cuts [data-panel]')].map(b => b.dataset.panel + '=' + b.getAttribute('aria-pressed')));
    if (await page.$('.fx-cuts [data-panel="cut:dowels"]')) await page.tap('.fx-cuts [data-panel="cut:dowels"]');
    await step(0.1);
    const cut1 = await H(() => ({ b: [...document.querySelectorAll('.fx-cuts [data-panel]')].map(b => b.dataset.panel + '=' + b.getAttribute('aria-pressed')), h: [...document.querySelectorAll('#fx-panel .fx-h')].map(x => x.textContent).join('|') }));
    const r1 = (await S()).robots[1];
    await H(() => { const T = window.TAAS_FACTORY; T.closePanel(); T.s.robots[0].job = 'stock:1'; T.openRobot(0); });
    await step(0.1);
    const other = await H(() => document.querySelectorAll('.fx-cuts').length);
    const head0 = await H(() => document.querySelector('#fx-panel .fx-h').textContent);
    await H(() => { const T = window.TAAS_FACTORY; T.closePanel(); T.s.robots[0].job = null; });
    ok(/stocking stall 2, large planks/.test(head0), 'a stall\'s robot\'s page says which stall it stocks and what that stall sells', head0);
    // a customer who got something else says what they wanted
    const wanted = await H(() => {
      const T = window.TAAS_FACTORY, g = document.getElementById('fx-canvas').getContext('2d'), said = [], fill = g.fillText;
      T.s.events.push({ kind: 'sold', item: 'plank.s', paid: 7.2, sale: 'wrong', by: 0, id: 99, x: 3.45, y: 1.15, at: 1, want: 'plank.l' });
      g.fillText = function (txt) { said.push(String(txt)); return fill.apply(this, arguments); };
      T.tick(1 / 60);
      g.fillText = fill;
      return said.filter(x => /wanted|satisfaction/.test(x));
    });
    ok(wanted.some(x => /^wanted a large plank: satisfaction -\d+%$/.test(x)), 'a customer at the large plank stall who is sold something else floats "wanted a large plank" and what it cost in satisfaction', JSON.stringify(wanted));
    ok(r1.job === 'saw' && cut0.join() === 'cut:b2x4=true,cut:b2x2=false,cut:dowels=false' && r1.cut === 'dowels' && cut1.b.join() === 'cut:b2x4=false,cut:b2x2=false,cut:dowels=true'
      && /on the table saw/.test(cut1.h) && /every plank into sixteen dowel rods/.test(cut1.h) && other === 0,
      'the saw\'s robot\'s page has its cut (2x4 to begin with) under its base prompt, a real tap on dowels sets it in the engine, and no other robot\'s page has one', JSON.stringify({ cut0, cut1, cut: r1.cut, other }));
    // a stall's robot walking its thing over is drawn holding it
    const held = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.robots[0].job = 'stock:1'; s.robots[0].state = 'carry'; s.robots[0].carry = 'plank.l'; s.robots[0].src = 'bin'; s.robots[0].x = 3.6; s.robots[0].y = 2.95; s.robots[0].path = [];
      s.avatar.x = 5.4; s.avatar.y = 6.0; s.avatar.path = [];
      const count = () => { T.paused = true; T.view.camY = T.view.minY; T.tick(0); const d = T.view.dpr, p = T.screen(3.6, 2.95, 0), q = T.screen(3.6, 2.95, 1.3), x0 = p[0] - 0.6 * T.view.S; const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(x0 * d), Math.round(q[1] * d), Math.round(1.2 * T.view.S * d), Math.round((p[1] - q[1]) * d)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 200 && im[i + 1] > 160 && im[i + 1] < 215 && im[i + 2] < 150) n++; return n; };
      const a = count(); s.robots[0].carry = null; const b = count(); s.robots[0].carry = 'plank.l';
      s.robots[0].state = 'idle'; s.robots[0].carry = null; s.robots[0].src = null; s.robots[0].job = null;
      return [a, b];
    });
    ok(held[0] > held[1] + 40, 'a stall\'s robot walking its thing over is drawn holding it', held.join(' -> '));
  });

  /* ---------- 20. the shop's back line, the dock of eight, Info ---------- */
  await section('20. back line, dock, info', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(20);
    // customers waiting in the line along the back wall show their hourglass beside the head, not over
    // the customer satisfaction board's number (2026-10-16: the line's hourglasses covered it)
    const white = async () => H(() => {
      const T = window.TAAS_FACTORY, r = T.board('sat'), d = T.view.dpr; T.tick(0);
      const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * 0.8 * d)).data;
      let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 235 && im[i + 1] > 235 && im[i + 2] > 235) n++; return n;
    });
    await H(() => { const T = window.TAAS_FACTORY, s = T.s, SH = FACTORY.LAYOUT.SHOP; s.shop.next = 1e9; T.view.camY = T.view.minY;
      [0, 1, 2, 3].forEach(k => s.shop.people.push({ id: 60 + k, x: SH.x0 - k * 0.62, y: SH.backY, state: 'wait', t: 3, stall: 0, at: 'line', item: null, by: null, wrong: false })); });
    const withLine = await white();
    await H(() => { window.TAAS_FACTORY.s.shop.people.length = 0; });
    const without = await white();
    ok(withLine <= without + 2, 'four customers waiting in the back line draw nothing white over the top four fifths of the customer satisfaction board (their hourglasses are beside their heads)', without + ' -> ' + withLine);
    // the dock: eight crates, every one a tap on the dock, its bay painted round all of them
    await H(() => { const T = window.TAAS_FACTORY; T.view.camY = T.view.maxY; T.tick(0); });
    const dock = await H(() => {
      const T = window.TAAS_FACTORY, out = [];
      FACTORY.LAYOUT.CRATES.forEach((c, i) => { const r = T.spriteRect('crate' + i); if (!r) { out.push(i + ' not drawn'); return; } const t = T.hitTest(r.x + r.w / 2, r.y + r.h * 0.6); if (!t || t.kind !== 'dock') out.push(i + '->' + JSON.stringify(t)); });
      const g = document.getElementById('fx-canvas').getContext('2d'), d = T.view.dpr, at = (x, y) => { const p = T.screen(x, y, 0), im = g.getImageData(Math.round(p[0] * d), Math.round(p[1] * d), 1, 1).data; return [im[0], im[1], im[2]]; };
      return { out, inBay: at(4.9, 16.4), outBay: at(5.6, 16.4) };
    });
    ok(!dock.out.length && dock.inBay[0] < dock.outBay[0] - 8 && (dock.inBay[1] - dock.inBay[0]) > (dock.outBay[1] - dock.outBay[0]) + 6,
      'the dock has eight crates, a tap on any of them reaches the dock, and the floor round all eight is painted as its bay', JSON.stringify(dock));
    const sold = await H(() => { const T = window.TAAS_FACTORY, s = T.s, run = n => { for (let k = 0; k < n; k++) FACTORY.step(s, 0.05); }; s.money = 2000; for (let k = 0; k < 8; k++) { FACTORY.tap(s, { kind: 'dock' }); run(400); FACTORY.choose(s, 'hire'); s.bubble = null; } FACTORY.tap(s, { kind: 'dock' }); run(400); T.tick(0); return [s.robots.length, [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + ':' + b.disabled + ':' + b.textContent.trim()).join(), s.money]; });
    ok(sold[0] === 8 && sold[1] === 'hire:true:sold out' && sold[2] === 2000 - 8, 'all eight robots cost $8 at the flat $1 (2026-10-20; it was $720), and then the dock is sold out', JSON.stringify(sold));
    // Info says it
    await H(() => window.TAAS_FACTORY.showInfo());
    const info = await H(() => document.getElementById('fx-panel-body').textContent);
    await H(() => window.TAAS_FACTORY.closePanel());
    ok(/room for 4 stalls/.test(info) && /buy another \(\$1 each\)/.test(info) && /up to 8, \$1 each/.test(info) && /once two robots are on staff/.test(info) && !/both are on staff|only medium planks are sold|the other slots are yours/.test(info),
      'Info tells of the four stalls and their flat price, the eight robots and theirs (2026-10-20), slots once two are on staff, and no longer that only medium planks sell or that slots 02 to 04 are yours alone', info.slice(0, 60));
  });

  /* ---------- 21. robots baked by pose (eight drawn live cost a frame in two, 2026-10-17) ---------- */
  await section('21. robot bake', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(21);
    // one robot facing the camera at the walkway: its antenna's bulb and its eyes, read off pixels
    const look = async (set) => H(set => {
      const T = window.TAAS_FACTORY, s = T.s, r = s.robots[0];
      if (set.rules !== undefined) { r.slots = 5; r.rules = set.rules; }
      if (set.mood !== undefined) { r.mood = set.mood; r.moodT = set.mood ? 2 : 0; }
      T.view.camY = T.view.maxY; T.tick(0);
      const g = document.getElementById('fx-canvas').getContext('2d'), d = T.view.dpr;
      const at = (x, y, z, rad) => { const p = T.screen(x, y, z), R = Math.round(rad * d), im = g.getImageData(Math.round(p[0] * d) - R, Math.round(p[1] * d) - R, 2 * R + 1, 2 * R + 1).data; const o = { red: 0, yellow: 0, green: 0, cyan: 0 }; for (let i = 0; i < im.length; i += 4) { const R0 = im[i], G = im[i + 1], B = im[i + 2]; if (R0 > 200 && G < 120 && B < 110) o.red++; else if (R0 > 200 && G > 140 && B < 110) o.yellow++; else if (G > 190 && R0 < 150 && B < 170) o.green++; else if (G > 200 && B > 200 && R0 < 160) o.cyan++; } return o; };
      // facing the camera (a robot on its pad does), the bulb is a hair behind its middle and the eyes 0.21 m in front
      return { bulb: at(r.x, r.y - 0.03, 1.2, 5), eyes: at(r.x, r.y + 0.21, 0.88, 9) };
    }, set);
    await H(() => { const T = window.TAAS_FACTORY, s = T.s, run = n => { for (let k = 0; k < n; k++) FACTORY.step(s, 0.05); }; s.money = 20; s.shop.next = 1e9; FACTORY.tap(s, { kind: 'dock' }); run(400); FACTORY.choose(s, 'hire'); s.bubble = null; run(60); s.avatar.x = 5.4; s.avatar.y = 6.0; s.avatar.path = []; for (let k = 0; k < 15; k++) T.tick(0.2); });   // (the crate's bits and sparks, flung at random, burn out first)
    // (moods with eyes that never blink: the clock the blink runs on is not the suite's to set)
    const none = await look({ rules: [], mood: 'good' }), three = await look({ rules: ['stockOnly', 'wait', 'stockOnly'] }), bad = await look({ mood: 'bad' });
    ok(none.bulb.red > 3 && three.bulb.red < none.bulb.red && three.bulb.yellow > 3 && none.eyes.green > 3 && none.eyes.red === 0 && bad.eyes.red > 3 && bad.eyes.green === 0,
      'a baked robot still shows its antenna\'s colour for its instructions and its eyes for its mood (both are in the bake\'s key): red with none, yellow with three; green eyes on a good outcome, red on a bad one', JSON.stringify({ none, three, bad }));
    // the bake stays within its budget over a busy quarter hour of eight robots
    const st = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, run = n => { for (let k = 0; k < n; k++) FACTORY.step(s, 0.05); };
      s.money = 2000; s.robots[0].mood = null; s.robots[0].moodT = 0;
      [1, 2, 3].forEach(i => { FACTORY.tap(s, { kind: 'stall', i }); run(300); FACTORY.choose(s, 'buystall'); FACTORY.choose(s, 'sell:' + ['plank.l', 'b2x4.m', 'sap'][i - 1]); s.bubble = null; });
      for (let k = 0; k < 7; k++) { FACTORY.tap(s, { kind: 'dock' }); run(400); FACTORY.choose(s, 'hire'); s.bubble = null; }
      ['operate', 'stock:0', 'stock:1', 'stock:2', 'stock:3', 'saw', 'extract', 'carve'].forEach((j, i) => { s.robots[i].job = j; s.robots[i].state = 'idle'; });
      s.shop.next = 2; s.saw.in.push('plank.m', 'plank.m'); s.extract.in.push('sappy.m'); s.bench.in.push('gnarled.m', 'gnarled.l');
      let most = 0;
      for (let f = 0; f < 15 * 60 * 6; f++) { T.tick(1 / 6); most = Math.max(most, T.robotBake().bytes); }
      return Object.assign(T.robotBake(), { most });
    });
    ok(st.n > 20 && st.most <= st.budget && st.bytes <= st.budget, 'a quarter hour of eight robots at work bakes their poses as they come up and never holds more than the cache\'s budget', JSON.stringify(st));
  });

  /* ---------- 22. goals on the floor and the wall, and Prices in the menu (taasgoals, 2026-10-20) ---------- */
  await section('22. goals and prices', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(22);
    const SLOT_IDS = ['sawInBack', 'sawInFront', 'sawInBelt', 'saw', 'sawConsole', 'sawOutBelt', 'sawOutBack', 'sawOutFront', 'extractInBack', 'extractInFront', 'extractInBelt', 'extract', 'extractConsole', 'extractOutBelt', 'extractOutBack', 'extractOutFront', 'benchInBack', 'benchInFront', 'bench', 'benchOutBack', 'benchOutFront'];
    // a new factory: one stall (medium planks) and the planer in slot 01, and three empty bays
    const fl = await H(ids => { const T = window.TAAS_FACTORY; const all = cam => { T.view.camY = T.view[cam + 'Y']; T.tick(0); return ids.filter(id => T.spriteRect(id)); };
      const drawn = all('min').concat(all('max')); T.view.camY = T.view.minY; T.tick(0);
      return { drawn, stalls: [0, 1, 2, 3].map(i => !!T.spriteRect('stall' + i)), planer: ['machine', 'rack', 'binFront', 'console'].every(id => T.spriteRect(id)), want: T.s.stalls[0].want }; }, SLOT_IDS);
    ok(!fl.drawn.length && fl.stalls.join() === 'true,false,false,false' && fl.planer && fl.want === 'plank.m', 'a new factory has one stall, for medium planks, and only slot 01\'s planer; nothing of slots 02-04 is drawn, top or bottom', JSON.stringify(fl));
    // an empty bay is floor: a tap where a machine or a bin will stand walks there and opens nothing
    const bayAt = await H(() => { const L = FACTORY.LAYOUT, q = k => L.SOLID[k], mid = k => [(q(k)[0] + q(k)[2]) / 2, (q(k)[1] + q(k)[3]) / 2];
      return { extract: mid('extract'), bench: mid('bench'), saw: mid('saw'), sawIn: mid('sawIn'), benchOut: mid('benchOut') }; });
    const bays = [];
    for (const k of Object.keys(bayAt)) {
      const at = bayAt[k];
      const p = await H(at => { const T = window.TAAS_FACTORY; T.view.camY = Math.max(T.view.minY, Math.min(T.view.maxY, T.screen(at[0], at[1], 0.5)[1] + T.view.camY - 420)); T.tick(0); return T.screen(at[0], at[1], 0.5); }, at);
      const t = await H(p => window.TAAS_FACTORY.hitTest(p[0], p[1]), p);
      await page.touchscreen.tap(p[0], p[1]);
      const a = await H(() => { const s = window.TAAS_FACTORY.s; return { task: s.avatar.task && s.avatar.task.kind, bubble: s.bubble }; });
      if (!t || t.kind !== 'floor' || a.task !== 'floor' || a.bubble) bays.push(k + ': ' + JSON.stringify([t && t.kind, a]));
    }
    ok(!bays.length, 'a tap where the sap extractor, the bench, the table saw or their bins will stand is a tap on the floor: the avatar walks there and nothing opens', bays.join('; '));
    // the wall's goal counts down as medium planks sell, and the screen reader hears the same words
    const heard = () => H(() => document.getElementById('fx-score').textContent.replace(/^.*Goal: /, ''));
    const goalBits = () => H(() => { const T = window.TAAS_FACTORY, r = T.board('goal'), d = T.view.dpr; T.view.camY = T.view.minY; T.tick(0);
      const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
      let b = ''; for (let i = 0; i < im.length; i += 4) b += im[i] > 225 && im[i + 1] > 225 && im[i + 2] > 225 ? '1' : '0'; return b; });
    const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
    const g50 = await goalBits(), h50 = await heard();
    await H(() => { window.TAAS_FACTORY.s.goalN = 3; });
    const g47 = await goalBits(), h47 = await heard();
    await H(() => { window.TAAS_FACTORY.s.goalN = 49; });
    const g1 = await goalBits(), h1 = await heard();
    ok(h50 === 'Sell 50 medium planks.' && h47 === 'Sell 47 medium planks.' && h1 === 'Sell 1 medium plank.' && differ(g50, g47) > 30 && differ(g47, g1) > 30,
      'goal 1 reads "Sell 50 medium planks" and counts down as they sell, to "Sell 1 medium plank", on the wall and in the screen reader\'s line', [h50, h47, h1, differ(g50, g47), differ(g47, g1)].join(' | '));
    // the 50th sale, by the engine: the sap extractor arrives in slot 02, with the level sound, sparks and a float naming it
    const arrival = await H(() => {
      const T = window.TAAS_FACTORY, s = T.s, L = FACTORY.LAYOUT, q = L.SOLID.extract, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const heardSfx = [], was = SND.sfx; SND.sfx = n => { heardSfx.push(n); return was(n); };
      T.view.camY = T.screen(0, L.ROW.extract, 0)[1] + T.view.camY - 420; T.tick(0);
      const cyan = () => { const a = T.screen(0.2, (q[1] + q[3]) / 2, 2.6), b = T.screen(5.8, (q[1] + q[3]) / 2, 1.2), im = g.getImageData(0, Math.round(a[1] * k), g.canvas.width, Math.round((b[1] - a[1]) * k)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] < 170 && im[i + 1] > 215 && im[i + 2] > 215) n++; return n; };
      const before = { rect: !!T.spriteRect('extract'), cyan: cyan() };
      s.goalN = 50; T.tick(1 / 60);
      for (let i = 0; i < 45; i++) T.tick(1 / 60);
      const c = T.spriteRect('extract'), hit = c ? T.hitTest(c.x + c.w / 2, c.y + c.h * 0.6) : null;
      const after = { goal: s.goal, rect: !!c, all: ['extractInFront', 'extractConsole', 'extractOutFront'].every(id => T.spriteRect(id)), hit: hit && hit.kind, cyan: cyan(), level: heardSfx.indexOf('level') >= 0, heard: document.getElementById('fx-score').textContent.replace(/^.*Goal: /, '') };
      for (let i = 0; i < 240; i++) T.tick(1 / 60);
      after.later = cyan();
      SND.sfx = was;
      return { before, after };
    });
    ok(!arrival.before.rect && arrival.after.goal === 1 && arrival.after.rect && arrival.after.all && arrival.after.hit === 'extract' && arrival.after.level && arrival.after.cyan > 300 && arrival.before.cyan < 50 && arrival.after.later < 50,
      'the 50th medium plank sold, the sap extractor arrives in slot 02 with the level sound and a float naming it (gone a few seconds later), and a tap on it reaches it', JSON.stringify(arrival));
    ok(arrival.after.heard === '>$50 & >90% customer satisfaction for 10 minutes.', 'then the wall reads goal 2: ">$50 & >90% customer satisfaction for 10 minutes"', arrival.after.heard);
    // goal 2's countdown in m:ss while both hold, and back to 10 minutes when either fails
    const rest = await goalBits();
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.money = 60; s.satisfaction = 100; s.shop.next = 1e9; for (let i = 0; i < Math.round(19.5 * 60); i++) T.tick(1 / 60); });
    const counting = await goalBits(), h941 = await heard();
    await H(() => { const T = window.TAAS_FACTORY; for (let i = 0; i < 60; i++) T.tick(1 / 60); });
    const h940 = await heard();
    await H(() => { const T = window.TAAS_FACTORY; T.s.satisfaction = 89; T.tick(1 / 60); });
    const hReset = await heard();
    ok(h941 === '>$50 & >90% customer satisfaction for 9:41.' && h940 === '>$50 & >90% customer satisfaction for 9:40.' && hReset === '>$50 & >90% customer satisfaction for 10 minutes.' && differ(rest, counting) > 30,
      'goal 2 counts down in minutes and seconds on the wall while money is over $50 and satisfaction over 90% ("for 9:41", "for 9:40"), and says "for 10 minutes" again the moment satisfaction falls to 89%', [h941, h940, hReset, differ(rest, counting)].join(' | '));
    // the long line fits the board: shrunk, never cut, nothing over its edges
    const fit = await H(() => { const T = window.TAAS_FACTORY, r = T.board('goal'), d = T.view.dpr, gx = 0.05 * T.view.S; T.s.goalT = 541; T.view.camY = T.view.minY; T.tick(0);
      const x = Math.round((r.x - gx) * d), w = Math.round((r.w + 2 * gx) * d), im = document.getElementById('fx-canvas').getContext('2d').getImageData(x, Math.round(r.y * d), w, Math.round(r.h * d)).data;
      let white = 0, edge = 0; for (let i = 0; i < im.length; i += 4) { if (im[i] > 225 && im[i + 1] > 225 && im[i + 2] > 225) { white++; const px = (i / 4) % w; if (px < gx * d - 1 || px > w - gx * d) edge++; } } return { white, edge }; });
    ok(fit.white > 200 && fit.edge === 0, 'goal 2\'s long line is drawn whole inside the board at 390 wide', JSON.stringify(fit));
    // goal 3 and after
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.goal = 2; s.goalN = 0; s.goalT = 600; T.tick(0); });
    const h25 = await heard();
    await H(() => { const T = window.TAAS_FACTORY; T.s.goalN = 24; T.tick(0); });
    const hSap1 = await heard();
    const saw = await H(() => { const T = window.TAAS_FACTORY, s = T.s; const bench = !!T.spriteRect('bench'), sawLocked = !T.spriteRect('saw'); s.goalN = 25; T.tick(1 / 60); return { bench, sawLocked, saw: !!T.spriteRect('saw'), goal: s.goal }; });
    const hDone = await heard();
    await H(() => window.TAAS_FACTORY.showInfo());
    const info = await H(() => document.getElementById('fx-panel-body').textContent);
    await H(() => window.TAAS_FACTORY.closePanel());
    ok(h25 === 'Sell 25 sap.' && hSap1 === 'Sell 1 sap.' && hDone === 'All goals met.' && saw.bench && saw.sawLocked && saw.saw && saw.goal === 3 && /The goal: All goals met\./.test(info),
      'goal 3 reads "Sell 25 sap" counting down to "Sell 1 sap"; the bench stands in 03 while 04 is still empty; the 25th brings the table saw, the wall then reads "All goals met", and Info says the same', [h25, hSap1, hDone, JSON.stringify(saw)].join(' | '));
    // the slots' order on screen: 02 the sap extractor, 03 the bench, 04 the table saw, each drawn over its own row
    const order = await H(() => { const T = window.TAAS_FACTORY, R = FACTORY.LAYOUT.ROW; T.view.camY = T.view.minY; T.tick(0);
      const on = (id, y) => { const r = T.spriteRect(id), p = T.screen(0, y, 0)[1]; return r && r.y < p && r.y + r.h > p ? r.y + r.h : null; };
      return [on('machine', R.planer), on('extract', R.extract), on('bench', R.bench), on('saw', R.saw)]; });
    ok(order.every(v => v !== null) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], 'down the floor: the planer, then the sap extractor (02), the bench (03) and the table saw (04), each drawn over its own row', JSON.stringify(order));
    // the baked floor follows the goals: Start over from a factory with every goal met goes back to empty bays with
    // no shadow left where the machines stood (the floor bake's key carries the goal; without it the floor baked with
    // the machines stays up, their grey shadows on the empty bay. Traced 2026-10-20: fresh() cleared storage and then the
    // old page's pagehide save wrote it again, so a new page first drew the previous row's factory, goal 3 and all;
    // since step 4 fresh() leaves the page first, section 23 holds it to that, and this row still bakes goal 3 itself)
    await fresh(25, true);
    // (a bake at goal 3 for certain: a frame drawn at another size, then back)
    await page.setViewportSize({ width: 430, height: 932 }); await H(() => { window.TAAS_FACTORY.layout(); window.TAAS_FACTORY.tick(0); });
    await page.setViewportSize({ width: 390, height: 844 }); await H(() => { window.TAAS_FACTORY.layout(); window.TAAS_FACTORY.tick(0); });
    await H(() => { const T = window.TAAS_FACTORY; T.s.money = 33; T.showInfo(); });
    await H(() => document.querySelector('[data-panel="restart"]').click());
    await H(() => document.querySelector('[data-panel="restart"]').click());
    const bay = await H(() => {
      const T = window.TAAS_FACTORY, L = FACTORY.LAYOUT, k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'), y = L.ROW.extract;
      T.s.shop.next = 1e9; T.view.camY = Math.max(T.view.minY, Math.min(T.view.maxY, T.screen(0, y, 0)[1] + T.view.camY - 420)); T.tick(0);
      const at = (x) => { const p = T.screen(x, y, 0), d = g.getImageData(Math.round(p[0] * k) - 4, Math.round(p[1] * k) - 4, 9, 9).data; let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2]; return Math.round(n / (d.length / 4)); };
      // under the sap extractor's body and its output bin, and bare bay east of them
      return { goal: T.s.goal, money: T.s.money, drawn: !!T.spriteRect('extract'), body: at(2.45), out: at(4.45), bare: at(5.5) };
    });
    ok(bay.goal === 0 && bay.money === 0 && !bay.drawn && Math.abs(bay.body - bay.bare) < 12 && Math.abs(bay.out - bay.bare) < 12,
      'Start over from a factory with every goal met goes back to an empty bay 02: bare floor where the sap extractor and its bin stood, no shadow of them left (the baked floor follows the goals)', JSON.stringify(bay));
    // real taps on the moved bench and saw at three sizes; with slot 01 only, the same taps walk to the floor
    let hitN = 0;
    const miss = [];
    for (const [w, h] of [[390, 844], [320, 640], [844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      for (const open of [false, true]) {
        await fresh(23, open);
        for (const [id, kind] of [['bench', 'bench'], ['saw', 'saw'], ['benchInFront', 'benchIn'], ['sawOutFront', 'sawOut']]) {
          const p = await H(([id, R]) => { const T = window.TAAS_FACTORY, y = FACTORY.LAYOUT.ROW[R]; T.s.avatar.task = null; T.s.bubble = null; T.view.camY = Math.max(T.view.minY, Math.min(T.view.maxY, T.screen(0, y, 0)[1] + T.view.camY - T.view.h * 0.55)); T.tick(0);
            const r = T.spriteRect(id); if (r) return [r.x + r.w / 2, r.y + r.h * (/Front/.test(id) ? 0.5 : 0.6)];
            const q = FACTORY.LAYOUT.SOLID[id.replace(/Front$/, '')]; return T.screen((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, /Front/.test(id) ? 0.3 : 0.6); }, [id, /^bench/.test(id) ? 'bench' : 'saw']);
          if (p[1] < 50 || p[1] > h - 10) { miss.push(w + 'x' + h + ' ' + id + ' off screen'); continue; }
          await page.touchscreen.tap(p[0], p[1]);
          const got = await H(() => { const t = window.TAAS_FACTORY.s.avatar.task; return t && t.kind; });
          if (got !== (open ? kind : 'floor')) miss.push(w + 'x' + h + (open ? ' open ' : ' locked ') + id + ' -> ' + got);
          else hitN++;
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!miss.length && hitN === 24, 'at 390x844, 320x640 and 844x390, a real tap on the bench, the table saw and their bins in their new rows reaches them once their goals are met, and walks to the floor before', miss.join('; ') + ' (' + hitN + ' of 24)');
    // Prices: in the factory's menu (and not in formal's), two steppers a dollar a tap, bounded, saved and kept by Start over
    await fresh(24);
    await page.tap('#menu-btn');
    const pm = await H(() => { const b = document.getElementById('menu-prices'), r = b.getBoundingClientRect();
      return { shown: !b.hidden && r.height > 40 && r.bottom <= innerHeight, rows: [...b.querySelectorAll('.mstep > span:first-child')].map(e => e.textContent.trim()), btns: b.querySelectorAll('button[data-price]').length,
        mi: [...document.querySelectorAll('#menu .mi')].map(e => e.firstChild.textContent.trim()).join(), ranges: document.querySelectorAll('#menu input[type=range]').length, inPrices: b.querySelectorAll('input, .mi').length }; });
    ok(pm.shown && pm.rows.join() === 'Robot $1,Stall $1' && pm.btns === 4 && pm.mi === 'Info,Exit game' && pm.ranges === 3 && pm.inPrices === 0,
      'the factory\'s menu has Prices: "Robot $1" and "Stall $1", each with - and + (no slider, no menu item, so the menu\'s items are still Info and Exit game)', JSON.stringify(pm));
    for (let i = 0; i < 3; i++) await page.tap('[data-price="robot"][data-by="1"]');
    await page.tap('[data-price="stall"][data-by="-1"]');
    const st = await H(() => ({ flat: window.TAAS_FACTORY.s.flat, robot: document.getElementById('price-robot').textContent, stall: document.getElementById('price-stall').textContent,
      stallDown: document.querySelector('[data-price="stall"][data-by="-1"]').disabled, stallUp: document.querySelector('[data-price="stall"][data-by="1"]').disabled, dock: FACTORY.hirePrice(window.TAAS_FACTORY.s), saved: JSON.parse(localStorage.getItem('taas.factory.v' + FACTORY.CFG.version) || '{}').flat }));
    ok(st.flat.robot === 4 && st.flat.stall === 0 && st.robot === '$4' && st.stall === '$0' && st.stallDown && !st.stallUp && st.dock === 4 && st.saved && st.saved.robot === 4 && st.saved.stall === 0,
      'three taps on the robot\'s + make a robot $4 and one on the stall\'s - makes a stall $0, where its - goes dark; the factory charges it and the save has it at once', JSON.stringify(st));
    await H(() => { FACTORY.setFlat(window.TAAS_FACTORY.s, 'robot', 199); window.TAAS_MENU.close(); });
    await page.tap('#menu-btn');
    await page.tap('[data-price="robot"][data-by="1"]');
    const top = await H(() => ({ robot: window.TAAS_FACTORY.s.flat.robot, up: document.querySelector('[data-price="robot"][data-by="1"]').disabled, shown: document.getElementById('price-robot').textContent }));
    await H(() => document.querySelector('[data-price="robot"][data-by="1"]').click());
    const top2 = await H(() => window.TAAS_FACTORY.s.flat.robot);
    ok(top.robot === 200 && top.up && top.shown === '$200' && top2 === 200, 'the robot\'s price stops at $200: its + goes dark there and does nothing', JSON.stringify(top) + ' ' + top2);
    await H(() => { FACTORY.setFlat(window.TAAS_FACTORY.s, 'robot', 7); window.TAAS_FACTORY.save(); window.TAAS_MENU.close(); });
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    await page.tap('#menu-btn');
    const back = await H(() => [document.getElementById('price-robot').textContent, document.getElementById('price-stall').textContent].join());
    await H(() => window.TAAS_MENU.close());
    await H(() => { const T = window.TAAS_FACTORY; T.paused = true; T.s.money = 33; T.showInfo(); });
    await H(() => document.querySelector('[data-panel="restart"]').click());
    await H(() => document.querySelector('[data-panel="restart"]').click());
    const fresh2 = await H(() => ({ money: window.TAAS_FACTORY.s.money, flat: window.TAAS_FACTORY.s.flat, goal: window.TAAS_FACTORY.s.goal }));
    ok(back === '$7,$0' && fresh2.money === 0 && fresh2.goal === 0 && fresh2.flat.robot === 7 && fresh2.flat.stall === 0, 'the prices survive a reload, and Start over begins a new factory (no money, the first goal) at the same prices', back + ' ' + JSON.stringify(fresh2));
    await go('?mode=formal');
    await page.tap('#menu-btn');
    const fm = await H(() => { const b = document.getElementById('menu-prices'); return { hidden: b.hidden, display: getComputedStyle(b).display, h: b.getBoundingClientRect().height }; });
    await H(() => window.TAAS_MENU.close());
    ok(fm.hidden && fm.display === 'none' && fm.h === 0, 'the formal mode\'s menu has no Prices', JSON.stringify(fm));
  });

  /* ---------- 23. bins and stalls by hand, the dots, CLOSED, jams on every slot, Info (taasgoals step 4) ---------- */
  await section('23. bins, stalls, dots, jams', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    // fresh() starts from nothing: a factory with every goal met and money in it, then a new page, which
    // loads a new game of its own (the old page's last save is gone with it)
    await fresh(31, true);
    await H(() => { const T = window.TAAS_FACTORY; T.s.money = 77; T.s.t = 999; T.save(); });
    await fresh(32);
    ok(loaded && loaded.goal === 0 && loaded.money === 0 && loaded.robots === 0 && loaded.t < 5, 'a new page in the suite starts from no save: the previous row\'s factory (every goal met, $77) is not what it loads', JSON.stringify(loaded && { goal: loaded.goal, money: loaded.money, t: loaded.t }));
    const waitFor = async (sel, n) => { for (let i = 0; i < (n || 120); i++) { if (await H(sel => !!document.querySelector(sel), sel)) return true; await step(0.1); } return false; };
    const tapIf = async (sel) => { if (await page.$(sel)) { await page.tap(sel); await step(0.1); return true; } return false; };
    const bubbleBox = () => H(() => { const e = document.getElementById('fx-bubble'), b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, hidden: e.hidden }; });
    const clear = (b, p) => !(p[0] > b.l && p[0] < b.r && p[1] > b.t && p[1] < b.b);
    const onScreen = (b, w, h) => b.l >= 0 && b.t >= 0 && b.r <= w + 0.5 && b.b <= h + 0.5;
    // each output bin: its bubble's two halves by real taps (your arms on top, the bin below), its placeholders when
    // both are empty, on screen and clear of the bin it is about
    await fresh(33, true);
    const bins = [], phs = [];
    for (const [k, sample, thing] of [['bin', 'plank.m', 'plank.m'], ['sawOut', 'b2x4.m', 'b2x4.m'], ['extractOut', 'sap', 'sap'], ['benchOut', 'carving.bird', 'carving.owl']]) {
      const p = await H(k => { const T = window.TAAS_FACTORY, s = T.s, q = FACTORY.LAYOUT.SOLID[k]; s.shop.next = 1e9; s.avatar.inv = []; s.avatar.task = null; s.bubble = null; s.avatar.act = null;
        T.view.camY = Math.max(T.view.minY, Math.min(T.view.maxY, T.screen(0, (q[1] + q[3]) / 2, 0)[1] + T.view.camY - 460)); T.tick(0);
        const r = T.spriteRect(k === 'bin' ? 'binFront' : k + 'Front'); return [r.x + r.w / 2, r.y + r.h * 0.4]; }, k);
      await page.touchscreen.tap(p[0], p[1]);
      const opened = await waitFor('#fx-bubble .fx-half.fx-bins');
      const ph = await H(() => [...document.querySelectorAll('#fx-bubble .fx-ph svg:not(.fx-arr)')].map(x => x.outerHTML));
      phs.push(ph[0] || '');
      // the bin gets its thing and your arms a log: the halves show them
      await H(([k, thing]) => { const s = window.TAAS_FACTORY.s; FACTORY.store(s, k).push(thing, thing); s.avatar.inv.push('log.m'); }, [k, thing]);
      await step(0.1);
      const halves = await H(() => ({ mine: [...document.querySelectorAll('#fx-bubble .fx-mine [data-opt]')].map(b => b.dataset.opt), bins: [...document.querySelectorAll('#fx-bubble .fx-bins [data-opt]')].map(b => b.dataset.opt) }));
      const box = await bubbleBox(), an = await H(k => { const T = window.TAAS_FACTORY, q = FACTORY.LAYOUT.SOLID[k]; return T.screen((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, 0.5); }, k);
      await tapIf('#fx-bubble [data-opt="take:' + thing + '"]');
      await step(0.5);
      await tapIf('#fx-bubble [data-opt="put:log.m"]');
      await step(0.5);
      const after = await H(k => { const s = window.TAAS_FACTORY.s; return { inv: s.avatar.inv.join(), bin: FACTORY.store(s, k).join() }; }, k);
      const good = opened && ph.length === 2 && ph[0] === ph[1] && sample === await H(k => FACTORY.SAMPLE[k], k) && halves.mine.join() === 'put:log.m' && halves.bins.join() === 'take:' + thing && onScreen(box, 390, 844) && clear(box, an) && after.inv === thing + ',' + thing && after.bin === 'log.m';
      if (!good) bins.push(k + ' ' + JSON.stringify({ opened, ph: ph.length, halves, box, an, after }));
    }
    if (new Set(phs).size !== 4) bins.push('the four placeholders are not four different things: ' + new Set(phs).size);
    ok(!bins.length, 'each output bin (the planer\'s, the saw\'s, the extractor\'s, the bench\'s) opens the two halves: faded placeholders while both are empty, then your log on top and its things below; a real tap takes its things into your arms and another puts the log in; the bubble on screen and clear of the bin', bins.join('; '));
    // a stall: its first level by a real tap on the drawn tray, three worded buttons of one width
    await fresh(34, true);
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.shop.next = 1e9; s.money = 50; s.avatar.inv = Array(8).fill('plank.m').concat(['log.m', 'sap']); T.view.camY = T.view.minY; T.tick(0); });
    const tray = await H(() => { const q = FACTORY.LAYOUT.STALLS[0]; return window.TAAS_FACTORY.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z + 0.05); });
    await page.touchscreen.tap(tray[0], tray[1]);
    const three = await waitFor('#fx-bubble [data-opt="restock"]');
    const first = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => ({ id: b.dataset.opt, text: (b.querySelector('.fx-lbl') || {}).textContent, w: Math.round(b.getBoundingClientRect().width), zzz: b.querySelectorAll('svg text').length, on: b.classList.contains('on') })));
    const fbox = await bubbleBox();
    ok(three && first.map(o => o.id + '=' + o.text).join() === 'assign=Re-assign,restock=Re-stock,close=Close' && new Set(first.map(o => o.w)).size === 1 && first[2].zzz === 3 && first.every(o => !o.on) && onScreen(fbox, 390, 844) && clear(fbox, tray),
      'a real tap on the stall opens its first level: three buttons of one width in the CD\'s words, "Re-assign", "Re-stock" and "Close" (with the robot\'s zzz), on screen and clear of the stall', JSON.stringify(first));
    // Re-assign: the thirteen things under a short back button; back goes up a level
    await tapIf('#fx-bubble [data-opt="assign"]');
    const assign = await H(() => ({ back: [...document.querySelectorAll('#fx-bubble [data-opt="back"]')].map(b => [b.getAttribute('aria-label'), Math.round(b.getBoundingClientRect().height)]), rows: [...document.querySelectorAll('#fx-bubble .fx-brow')].map(r => r.querySelectorAll('[data-opt^="sell:"]').length).filter(n => n), on: [...document.querySelectorAll('#fx-bubble .on')].map(b => b.dataset.opt).join(), others: document.querySelectorAll('#fx-bubble [data-opt]:not([data-opt^="sell:"]):not([data-opt="back"])').length }));
    await tapIf('#fx-bubble [data-opt="back"]');
    const up1 = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt).join());
    ok(assign.back.length === 1 && assign.back[0][0] === 'Back' && assign.back[0][1] < 45 && assign.rows.join() === '4,3,3,3' && assign.on === 'sell:plank.m' && !assign.others && up1 === 'assign,restock,close',
      'Re-assign by a real tap: a short back button over the thirteen things (4, 3, 3, 3; medium planks marked), and a tap on back goes up to the three again', JSON.stringify(assign) + ' / ' + up1);
    // Re-stock: the two halves under the back button; your eight planks fill it to six, two stay with you, and a full stall
    // takes no more; the stall's planks come back out by a tap
    await tapIf('#fx-bubble [data-opt="restock"]');
    const stock0 = await H(() => ({ mine: [...document.querySelectorAll('#fx-bubble .fx-mine [data-opt]')].map(b => b.dataset.opt).sort().join(), bins: document.querySelectorAll('#fx-bubble .fx-bins [data-opt]').length, ph: document.querySelectorAll('#fx-bubble .fx-bins .fx-ph').length, back: document.querySelectorAll('#fx-bubble [data-opt="back"]').length }));
    await tapIf('#fx-bubble [data-opt="put:plank.m"]');
    await step(0.5);
    const stock1 = await H(() => { const s = window.TAAS_FACTORY.s; return { stall: s.stalls[0].stock.map(g => g.item + '/' + g.by).join(), inv: s.avatar.inv.filter(x => x === 'plank.m').length, off: [...document.querySelectorAll('#fx-bubble .fx-mine [data-opt]')].filter(b => b.disabled).length, plank: (b => b && [b.querySelector('.fx-lbl').textContent, b.getAttribute('aria-label')])(document.querySelector('#fx-bubble [data-opt="put:plank.m"]')), take: [...document.querySelectorAll('#fx-bubble .fx-bins [data-opt]')].map(b => b.dataset.opt + '=' + b.textContent.trim()).join() }; });
    await tapIf('#fx-bubble [data-opt="take:plank.m"]');
    await step(0.5);
    const stock2 = await H(() => { const s = window.TAAS_FACTORY.s; return { stall: s.stalls[0].stock.length, inv: s.avatar.inv.filter(x => x === 'plank.m').length }; });
    ok(stock0.mine === 'put:log.m,put:plank.m,put:sap' && stock0.bins === 0 && stock0.ph === 1 && stock0.back === 1 && stock1.stall === Array(6).fill('plank.m/player').join() && stock1.inv === 2 && stock1.off === 3 && stock1.plank && stock1.plank.join() === 'x2,No room in this stall for a medium plank' && stock1.take === 'take:plank.m=x6' && stock2.stall === 0 && stock2.inv === 8,
      'Re-stock by real taps: everything you carry on top over an empty stall, a tap on your planks fills it to six and two stay in your arms (every put then dark, the planks still "x2", "no room"), and a tap on its six takes them back', JSON.stringify([stock0, stock1, stock2]));
    // Close, the zzz on, and Open again
    await tapIf('#fx-bubble [data-opt="back"]');
    await tapIf('#fx-bubble [data-opt="close"]');
    const shut = await H(() => { const b = document.querySelector('#fx-bubble [data-opt="open"]'); return { closed: window.TAAS_FACTORY.s.stalls[0].closed, b: b && [(b.querySelector('.fx-lbl') || {}).textContent, b.classList.contains('on'), b.querySelectorAll('svg text').length, b.getAttribute('aria-label')] }; });
    await tapIf('#fx-bubble [data-opt="open"]');
    const reopened = await H(() => ({ closed: window.TAAS_FACTORY.s.stalls[0].closed, b: !!document.querySelector('#fx-bubble [data-opt="close"]:not(.on)') }));
    ok(shut.closed && shut.b && shut.b[0] === 'Open' && shut.b[1] && shut.b[2] === 3 && shut.b[3] === 'Open this stall' && !reopened.closed && reopened.b,
      'a real tap on Close closes the stall and the button turns to "Open" with its zzz on; a tap on Open opens it again', JSON.stringify([shut, reopened]));
    // the three levels at three sizes: on screen, and never over the stall's tray or its label
    const lay = [];
    for (const [w, h] of [[390, 844], [320, 640], [844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      for (const menu of [null, 'assign', 'restock']) {
        const r = await H(menu => { const T = window.TAAS_FACTORY, s = T.s, q = FACTORY.LAYOUT.STALLS[0]; T.layout(); T.view.camY = T.view.minY; s.bubble = { kind: 'stall', i: 0, menu: null }; if (menu) FACTORY.choose(s, menu); T.tick(0); T.tick(0);
          const e = document.getElementById('fx-bubble'), b = e.getBoundingClientRect(), P = T.board('plate', 0);
          return { box: { l: b.left, t: b.top, r: b.right, b: b.bottom, hidden: e.hidden }, tray: T.screen((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z + 0.05), plate: [P.x + P.w / 2, P.y + P.h / 2], n: e.querySelectorAll('[data-opt]').length, opts: [...e.querySelectorAll('[data-opt]')].every(o => { const z = o.getBoundingClientRect(); return z.left >= b.left && z.right <= b.right + 0.5 && z.top >= b.top && z.bottom <= b.bottom + 0.5; }) }; }, menu);
        if (r.box.hidden || !onScreen(r.box, w, h) || !clear(r.box, r.tray) || !clear(r.box, r.plate) || !r.opts || r.n < 3) lay.push(w + 'x' + h + ' ' + (menu || 'first') + ' ' + JSON.stringify(r));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!lay.length, 'at 390x844, 320x640 and 844x390 each of the stall\'s three levels is on screen, every button inside it, and none covers the stall\'s tray or its label (beside the stall when it fits neither over nor under it)', lay.join('; '));
    // the dots: counted off the canvas at 0, 1 and 6 (a log among them is a green dot too), above the price and the name
    await fresh(35);
    const dots = (n) => H(n => {
      const T = window.TAAS_FACTORY, s = T.s, d = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      s.shop.next = 1e9; s.satisfaction = 100; s.avatar.x = 5.4; s.avatar.y = 6.0; s.avatar.path = []; s.bubble = null;
      s.stalls[0].stock = []; for (let i = 0; i < n; i++) s.stalls[0].stock.push({ item: i === 2 ? 'log.m' : 'plank.m', by: 'player' });
      T.view.camY = T.view.minY; T.tick(0);
      const r = T.board('plate', 0), x0 = Math.round(r.x * d), y0 = Math.round(r.y * d), w = Math.round(r.w * d), h = Math.round(r.h * d), im = g.getImageData(x0, y0, w, h).data;
      const col = new Array(w).fill(0); let dotBot = -1, priceTop = h;
      for (let i = 0; i < im.length; i += 4) {
        const R = im[i], G = im[i + 1], B = im[i + 2], x = (i / 4) % w, y = Math.floor(i / 4 / w);
        if (y < h * 0.34 && G > 190 && R < 110 && B > 90 && B < 170) { col[x]++; dotBot = Math.max(dotBot, y); }   // (the dots' band: the price's soft edges are this green too)
        else if (G > 220 && R > 115 && R < 150) priceTop = Math.min(priceTop, y);   // the price's green ($4 in full)
      }
      let runs = 0, on = false; col.forEach(c => { if (c && !on) runs++; on = !!c; });
      return { runs, dotBot, priceTop };
    }, n);
    const d0 = await dots(0), d1 = await dots(1), d6 = await dots(6);
    ok(d0.runs === 0 && d1.runs === 1 && d6.runs === 6 && d6.dotBot >= 0 && d6.dotBot < d6.priceTop,
      'the stall\'s label carries a green dot for each thing in it, read off the canvas: none at 0, one at 1, six at 6 (a log among them a green dot too), all above the price', JSON.stringify([d0, d1, d6]));
    // CLOSED in place of the price, in red; the name stays; the dots stay
    const plateSays = () => H(() => { const T = window.TAAS_FACTORY, g = document.getElementById('fx-canvas').getContext('2d'), said = [], fill = g.fillText, d = T.view.dpr;
      g.fillText = function (txt) { said.push(String(txt)); return fill.apply(this, arguments); }; T.tick(0); g.fillText = fill;
      const r = T.board('plate', 0), im = g.getImageData(Math.round(r.x * d), Math.round(r.y * d), Math.round(r.w * d), Math.round(r.h * d)).data;
      let red = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 200 && im[i + 1] < 140 && im[i + 2] < 140) red++;
      return { said: said.filter(x => /CLOSED|\$4|MEDIUM/.test(x)), red }; });
    const open = await plateSays();
    await H(() => { const s = window.TAAS_FACTORY.s; s.stalls[0].closed = true; });
    const closed = await plateSays(), dc = await dots(3);
    await H(() => { const s = window.TAAS_FACTORY.s; s.stalls[0].closed = false; });
    ok(open.said.join() === '$4,MEDIUM PLANKS' && open.red < 5 && closed.said.join() === 'CLOSED,MEDIUM PLANKS' && closed.red > 60 && dc.runs === 3,
      'a closed stall\'s label reads CLOSED in red where the price was, the name beside it and its three dots still over them', JSON.stringify([open, closed, dc.runs]));
    // a jam on each of slots 02-04, by a robot given the wrong thing: drawn as the planer's is (an amber light flashing,
    // grime that shrinks as it is scrubbed, its button dead), and a real tap on the machine scrubs it: $5, the thing to
    // the recycle bin, and the "jam fixed" float over that machine
    const jamRows = [], scrubRows = [];
    for (const [key, job, wrong, row] of [['extract', 'extract', 'plank.m', 'extract'], ['bench', 'carve', 'plank.m', 'bench'], ['saw', 'saw', 'log.m', 'saw']]) {
      await fresh(36, true);
      const j = await H(([key, job, wrong, row]) => {
        const T = window.TAAS_FACTORY, s = T.s, L = FACTORY.LAYOUT, run = n => { for (let k = 0; k < n; k++) FACTORY.step(s, 0.05); };
        s.shop.next = 1e9; s.money = 21; FACTORY.tap(s, { kind: 'dock' }); run(400); FACTORY.choose(s, 'hire'); s.bubble = null;
        s.avatar.x = 5.4; s.avatar.y = L.ROW[row] - 1.0; s.avatar.path = []; s.avatar.task = null;
        const r = s.robots[0]; r.job = job; r.state = 'idle';
        const m = key === 'bench' ? s.bench : s[key];
        m.in.push(wrong);
        for (let i = 0; i < 2400 && !FACTORY.jammed(s, key); i++) FACTORY.step(s, 0.05);
        T.view.camY = Math.max(T.view.minY, Math.min(T.view.maxY, T.screen(0, L.ROW[row], 0)[1] + T.view.camY - 430)); T.tick(0);
        return { jammed: FACTORY.jammed(s, key), red: Object.keys(r.record).filter(k => /^jam:/.test(k)).join(), money: s.money };
      }, [key, job, wrong, row]);
      // the light: amber over some frames (it flashes); none on a machine that is not jammed
      const look = await H(([key]) => {
        const T = window.TAAS_FACTORY, s = T.s, d = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'), m = key === 'bench' ? s.bench : s[key];
        const B = { saw: [1.95, 12.42, 0.84], extract: [2.98, 6.98, 0.9], bench: [2.0, 9.9, 0.96] }[key], F0 = { saw: [1.95, 2.95, 13.3, 0.76], extract: [1.95, 2.95, 7.8, 0.82], bench: [2.0, 3.7, 10.5, 0.88] }[key];
        const amber = () => { const p = T.screen(B[0], B[1], B[2]), R = Math.round(0.2 * T.view.S * d), im = g.getImageData(Math.round(p[0] * d) - R, Math.round(p[1] * d) - R, 2 * R, 2 * R).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 220 && im[i + 1] > 140 && im[i + 1] < 200 && im[i + 2] < 90) n++; return n; };
        const grime = () => { const a = T.screen(F0[0], F0[2], F0[3]), b = T.screen(F0[1], F0[2], F0[3] - 0.7), x = Math.round(a[0] * d), y = Math.round(a[1] * d), im = g.getImageData(x, y, Math.round((b[0] - a[0]) * d), Math.round((b[1] - a[1]) * d)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (Math.abs(im[i] - 74) < 12 && Math.abs(im[i + 1] - 53) < 12 && Math.abs(im[i + 2] - 36) < 12) n++; return n; };
        let most = 0; for (let f = 0; f < 45; f++) { T.tick(1 / 60); most = Math.max(most, amber()); }
        T.tick(0); const full = grime(); m.dirt = 0.3; T.tick(0); const part = grime(); m.dirt = 1;
        // the same machine, not jammed (the same frame): no light, no grime
        const was = m.phase; m.phase = 'idle'; T.tick(0); const calm = { amber: amber(), grime: grime() }; m.phase = was; T.tick(0);
        return { most, full, part, calm };
      }, [key]);
      if (!(j.jammed && j.red === 'jam:' + wrong && look.most > 25 && look.calm.amber < 3 && look.full - look.calm.grime > 60 && look.part - look.calm.grime < (look.full - look.calm.grime) * 0.6)) jamRows.push(key + ' ' + JSON.stringify([j, look]));
      // a real tap on the drawn machine scrubs it (somewhere on it that is the machine's, not its robot's)
      const p = await H(key => { const T = window.TAAS_FACTORY, r = T.spriteRect(key);
        for (const [u, v] of [[0.5, 0.6], [0.3, 0.6], [0.3, 0.4], [0.7, 0.4], [0.2, 0.7]]) { const x = r.x + r.w * u, y = r.y + r.h * v, t = T.hitTest(x, y); if (t && t.kind === key) return [x, y]; }
        return [r.x + r.w / 2, r.y + r.h * 0.6]; }, key);
      await H(() => { const T = window.TAAS_FACTORY, g = document.getElementById('fx-canvas').getContext('2d'); window.__said = []; window.__fill = g.fillText; g.fillText = function (txt, x, y) { window.__said.push([String(txt), x, y]); return window.__fill.apply(this, arguments); }; });
      await page.touchscreen.tap(p[0], p[1]);
      let done = false;
      for (let i = 0; i < 120 && !done; i++) { await step(0.1); done = await H(key => !FACTORY.jammed(window.TAAS_FACTORY.s, key), key); }
      const after = await H(([key, wrong]) => { const T = window.TAAS_FACTORY, s = T.s, g = document.getElementById('fx-canvas').getContext('2d'); g.fillText = window.__fill;
        const fixed = window.__said.find(x => x[0] === 'jam fixed'), m = FACTORY.LAYOUT.SOLID[key === 'bench' ? 'bench' : key], at = T.screen((m[0] + m[2]) / 2, (m[1] + m[3]) / 2, 1.2);
        return { money: s.money, recycle: s.recycle.join(), fixed: s.tally.player.fixed, near: fixed ? Math.round(Math.hypot(fixed[1] - at[0], fixed[2] - at[1]) / T.view.S * 100) / 100 : null }; }, [key, wrong]);
      if (!(done && Math.abs(after.money - (j.money - 5)) < 0.001 && after.recycle === wrong && after.fixed === 1 && after.near !== null && after.near < 1.2)) scrubRows.push(key + ' ' + JSON.stringify([done, j.money, after]));
    }
    ok(!jamRows.length, 'a robot given the wrong thing jams the sap extractor, the bench and the table saw (red in its evals), and each is drawn jammed as the planer is: an amber light flashing on it and grime down its front that shrinks as the dirt goes, neither there on the same machine unjammed', jamRows.join('; '));
    ok(!scrubRows.length, 'a real tap on each jammed machine walks over and scrubs it: $5, the thing that jammed it in the recycle bin, and "jam fixed" floating over that machine, not the planer', scrubRows.join('; '));
    // Info: the goals and what each brings, the slots' order, the stall's three choices, closing, anything in any bin and
    // what a wrong thing does, Prices in the menu
    await H(() => window.TAAS_FACTORY.showInfo());
    const info = await H(() => ({ text: document.getElementById('fx-panel-body').textContent, goals: [...document.querySelectorAll('#fx-panel-body .fx-goals li')].map(li => li.textContent) }));
    await H(() => window.TAAS_FACTORY.closePanel());
    const t = info.text;
    ok(info.goals.length === 3 && /^Sell 50 medium planks\..*the sap extractor arrives in slot 02\.$/.test(info.goals[0]) && /^More than \$50 and more than 90% customer satisfaction, both for 10 minutes without a break.*starts it again at 10 minutes.*the hand crafting bench arrives in slot 03\.$/.test(info.goals[1]) && /^Sell 25 sap\..*the table saw arrives in slot 04\.$/.test(info.goals[2])
      && /in this order: 02 the sap extractor, 03 the hand crafting bench, 04 the table saw/.test(t),
      'Info lists the three goals in order, each with the machine it brings and its slot (the countdown that starts again), and the slots\' order', JSON.stringify(info.goals));
    ok(/three choices: Re-assign, what it sells/.test(t) && /Re-stock, your arms and the stall's stock/.test(t) && /a stall holds 6/.test(t) && /green dots over a stall's label count the things in it/.test(t) && /says CLOSED in place of the price/.test(t) && /walks out if none is open, which costs nothing/.test(t) && /Open puts it back/.test(t),
      'Info tells of the stall\'s three choices, its six, the green dots, and closing (CLOSED on the label, customers going elsewhere or walking out at no cost, Open)');
    ok(/Any bin takes anything/.test(t) && /Nothing happens by itself when you get there/.test(t) && /the planer jams on anything but a normal or gnarled log/i.test(t) && /the table saw on anything but a plank \(gnarled ones too\)/.test(t) && /the sap extractor on anything but a log/.test(t) && /chisel breaks on anything but gnarled wood/.test(t)
      && /tap it and scrub it clean: \$5, and whatever jammed it goes in the recycle bin/.test(t) && /it runs empty/.test(t) && /you toss that thing in the recycle bin instead, one a tap/.test(t) && /Prices in the menu set what each robot and each stall costs, from \$0 to \$200/.test(t) && /Start over keeps them/.test(t)
      && !/get nothing wrong yet|tap an output bin to take everything/.test(t),
      'Info tells that any bin takes anything, what each machine jams on, the $5 scrub that sends the thing to the recycle bin, the extractor\'s empty run, that you toss rather than get it wrong, and Prices in the menu (and no longer that slot robots get nothing wrong or that an output bin empties into your arms)');
  });

  /* ---------- 12. the build badge, bottom right (the CD, fourth brief) ---------- */
  await section('12. badge', async () => {
    const bad = [], stamp = (SRC.match(/id="build-badge"[^>]*>([^<]*)</) || [])[1];
    for (const [w, h, mode] of [[390, 844, 'robot-factory'], [844, 390, 'robot-factory'], [390, 844, 'formal']]) {
      await page.setViewportSize({ width: w, height: h });
      if (mode === 'formal') await go('?mode=formal'); else await fresh(13);
      const b = await H(() => { const e = document.getElementById('build-badge'), r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight, text: e.textContent, utc: e.dataset.utc, mode: document.documentElement.dataset.mode }; });
      if (!(b.mode === mode && b.b <= b.vh && b.b >= b.vh - 24 && b.r <= b.vw && b.r >= b.vw - 24 && /^build \d{4}-\d\d-\d\d \d\d:\d\d \S+$/.test(b.text) && b.utc === stamp)) bad.push(w + 'x' + h + ' ' + JSON.stringify(b));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length, 'the build badge sits in the bottom right corner in both modes, keeping the stamp it was given', bad.join('; ') + ' file: ' + stamp);
  });

  ok(!errors.length, 'no page errors or console errors over the whole drive', errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-FACTORY-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
