#!/usr/bin/env node
/**
 * drive-taas-factory-ui.cjs — TAAS's robot factory page, in Chromium (~20 s).
 *
 * drive-taas-factory.cjs proves the engine. This proves the page: the mode dropdown (its name
 * on the button, ?mode=, the remembered choice, the factory's loop stopping in formal mode),
 * that a tap at the pixel where a thing is DRAWN reaches that thing at every viewport (the
 * canvas-space rule in games/CLAUDE.md), that the red button glows when ready and goes dark
 * while it runs, the whole first loop played with real touches (walk, press, the log's $1 in
 * red below zero, plank, bubble, $5), a drag that scrolls and never walks, hiring and a job
 * through the bubble, a robot's page (its name, its base prompt, buying a slot and giving it an
 * instruction, all by real taps, and the seller's "looking for plank" count), the recycle bin
 * drawn, the wall sign and the sap barrel gone, a sap log that shows its sap, a gnarled log's
 * holes in the same places on its plank (read off pixels), the info panel, saves that survive a
 * reload without touching the formal mode's, re-measuring after
 * a resize while hidden, and the chrome, HUD and bubble all on screen at phone, landscape
 * and desktop sizes. Frames are stepped through the page's own test hook (TAAS_FACTORY,
 * paused), so time is exact; input goes through real touch events.
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
  if (!req.url.startsWith('/taas.html')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(SRC);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + server.address().port + '/taas.html';
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
  // a clean factory, paused, so the suite owns the clock
  const fresh = async (seed) => {
    await H(() => { localStorage.clear(); });
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    await H(sd => { const T = window.TAAS_FACTORY; T.paused = true; T.s = FACTORY.newGame(sd || 1); T.view.camY = T.view.minY; T.tick(0); }, seed);
  };
  const step = (sec) => H(sec => { const T = window.TAAS_FACTORY; for (let i = 0; i < Math.round(sec * 60); i++) T.tick(1 / 60); }, sec);
  const S = () => H(() => JSON.parse(FACTORY.save(window.TAAS_FACTORY.s)));
  const rectOf = (id) => H(id => window.TAAS_FACTORY.spriteRect(id), id);
  const centre = r => [r.x + r.w / 2, r.y + r.h / 2];
  async function section(name, fn) { try { await fn(); } catch (e) { ok(false, name + ' played through', e.message.split('\n')[0]); } }

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
    const btn = await H(() => window.TAAS_FACTORY.screen(2.8, 3.71, 0.88));
    const lit = await H(([x, y]) => { const c = document.getElementById('fx-canvas'), g = c.getContext('2d'), k = window.TAAS_FACTORY.view.dpr; const d = g.getImageData(Math.round(x * k) - 3, Math.round(y * k) - 3, 7, 7).data; let r = 0, gg = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; n++; } return [r / n, gg / n]; }, btn);
    await page.touchscreen.tap(btn[0], btn[1]);
    const t1 = await S();
    ok(t1.avatar.task && t1.avatar.task.kind === 'machine' && t1.avatar.path.length > 0, 'a tap on the drawn red button sends the avatar walking to machine 01', JSON.stringify(t1.avatar.task));
    let pressedAt = -1;
    for (let i = 0; i < 40 && pressedAt < 0; i++) { await step(0.1); if ((await H(() => window.TAAS_FACTORY.s.machine.phase)) === 'run') pressedAt = i; }
    const dark = await H(([x, y]) => { const c = document.getElementById('fx-canvas'), g = c.getContext('2d'), k = window.TAAS_FACTORY.view.dpr; const d = g.getImageData(Math.round(x * k) - 3, Math.round(y * k) - 3, 7, 7).data; let r = 0, gg = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; n++; } return [r / n, gg / n]; }, btn);
    ok(lit[0] > 200 && lit[0] - lit[1] > 120 && dark[0] < lit[0] - 70, 'the button glows red while ready and goes dark once pressed', 'ready rgb ' + lit.map(Math.round) + ', pressed ' + dark.map(Math.round));
    ok(pressedAt > 2, 'the avatar walked first and pressed on arrival', pressedAt);
    await step(5.6);
    const t2 = await S();
    ok(t2.bin.join() === 'plank' && t2.money === -1, 'four seconds later a plank is in the bin, and the log cost $1', t2.bin.join() + ' / ' + t2.money);
    const neg = await H(() => { const e = document.getElementById('fx-money'), c = getComputedStyle(e).color.match(/\d+/g).map(Number); return { text: e.textContent, neg: e.classList.contains('neg'), c }; });
    ok(neg.text === '-$1' && neg.neg && neg.c[0] > 180 && neg.c[1] < 90 && neg.c[2] < 90, 'below zero the HUD reads -$1, in red', JSON.stringify(neg));
    const bin = await rectOf('binBack');
    await page.touchscreen.tap(centre(bin)[0], centre(bin)[1]);
    let open = false;
    for (let i = 0; i < 40 && !open; i++) { await step(0.1); open = await H(() => !document.getElementById('fx-bubble').hidden); }
    const opts = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => ({ id: b.dataset.opt, dis: b.disabled, svg: !!b.querySelector('svg rect[fill="#3fb26a"]') })));
    ok(open && opts.length === 1 && opts[0].id === 'sell:plank' && !opts[0].dis && opts[0].svg, 'a tap on the bin walks over and opens a white bubble with one green dollar bill', JSON.stringify(opts));
    await page.tap('#fx-bubble [data-opt="sell:plank"]');
    await step(0.1);
    const t3 = await S();
    const hud = await H(() => { const e = document.getElementById('fx-money'), c = getComputedStyle(e).color.match(/\d+/g).map(Number); return { text: e.textContent, neg: e.classList.contains('neg'), red: c[0] > 180 && c[1] < 90 }; });
    ok(t3.money === 4 && !t3.bin.length && hud.text === '$4' && !hud.neg, 'tapping the bill sells the plank: the HUD goes from -$1 to $4, and out of the red', JSON.stringify(hud));
    // customer satisfaction: how much customers trust us and our products, from 100%
    const read = () => H(() => { const e = document.getElementById('fx-sat'); return { text: e.querySelector('.fx-sat-top span').textContent + ' ' + document.getElementById('fx-sat-num').textContent, aria: e.getAttribute('aria-label'), cls: e.className, low: e.classList.contains('low') }; });
    const sat0 = await read();
    await H(() => { window.TAAS_FACTORY.s.satisfaction = 55; window.TAAS_FACTORY.tick(1 / 60); });
    const sat1 = await read();
    ok(sat0.text === 'customer satisfaction 100%' && sat0.aria === 'Customer satisfaction 100%' && !/low|mid/.test(sat0.cls) && /55%$/.test(sat1.text) && sat1.low,
      'the HUD shows customer satisfaction, starting at 100%, and turns red when it falls', JSON.stringify([sat0, sat1]));
  });

  /* ---------- 3. a drag scrolls and never walks ---------- */
  await section('3. scroll', async () => {
    await fresh(2);
    const v0 = await H(() => ({ cam: window.TAAS_FACTORY.view.camY, min: window.TAAS_FACTORY.view.minY, max: window.TAAS_FACTORY.view.maxY, path: window.TAAS_FACTORY.s.avatar.path.length }));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', 200, 700);
    for (let y = 690; y >= 300; y -= 30) await touch('touchMove', 200, y);
    await touch('touchEnd');
    await step(0.05);
    const v1 = await H(() => ({ cam: window.TAAS_FACTORY.view.camY, task: window.TAAS_FACTORY.s.avatar.task }));
    ok(v0.max > v0.min + 100 && v1.cam > v0.cam + 300 && !v1.task, 'dragging up scrolls the floor (it is taller than the screen) and does not walk the avatar', JSON.stringify([v0.min, v0.max, v1.cam]));
    // slow drags (no fling), checked before any frame: the drag itself has to stop at the end
    for (let k = 0; k < 4; k++) { await touch('touchStart', 200, 750); for (let y = 740; y >= 100; y -= 4) await touch('touchMove', 200, y); await page.waitForTimeout(120); await touch('touchMove', 200, 100); await touch('touchEnd'); }
    const v2 = await H(() => window.TAAS_FACTORY.view.camY);
    ok(Math.abs(v2 - v0.max) < 0.5, 'and stops at the end of the floor', v2.toFixed(1) + ' vs ' + v0.max.toFixed(1));
    await step(1);
    const cones = await rectOf('cones');
    ok(cones && cones.y > 0 && cones.y + cones.h < 844, 'the far bays come into view');
  });

  /* ---------- 4. hire and give a job, through the bubble ---------- */
  await section('4. hire', async () => {
    await fresh(3);
    await H(() => { window.TAAS_FACTORY.s.money = 20; });
    const dock = await rectOf('dockPanel');
    await page.touchscreen.tap(centre(dock)[0], centre(dock)[1]);
    let open = false;
    for (let i = 0; i < 50 && !open; i++) { await step(0.1); open = await H(() => !document.getElementById('fx-bubble').hidden); }
    const o = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt + ':' + b.disabled + ':' + b.textContent.trim()));
    ok(open && o.length === 1 && o[0] === 'hire:false:$20', 'the dock offers a robot for $20', JSON.stringify(o));
    await page.tap('#fx-bubble [data-opt="hire"]');
    await step(0.2);
    const jobs = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt));
    const nm = await H(() => document.querySelector('#fx-bubble .fx-bname') && document.querySelector('#fx-bubble .fx-bname').textContent);
    ok(jobs.join() === 'job:operate,job:sell,job:rest,notes' && nm === 'Bolt' && (await S()).robots.length === 1, 'hiring it turns the bubble to the new robot: its name, its jobs and its clipboard', nm + ': ' + jobs.join());
    await page.tap('#fx-bubble [data-opt="job:operate"]');
    await step(8);   // out of the crate, round the dock panel, up to the machine
    const r = (await S()).robots[0];
    ok(r.job === 'operate' && Math.hypot(r.x - 2.25, r.y - 4.25) < 0.1, 'a tap on the button icon sends the robot to machine 01', r.x.toFixed(2) + ',' + r.y.toFixed(2));
    // a tap on the drawn robot opens its bubble
    const rp = await H(() => { const r = window.TAAS_FACTORY.s.robots[0]; return window.TAAS_FACTORY.screen(r.x, r.y, 0.55); });
    await page.touchscreen.tap(rp[0], rp[1]);
    let ro = false;
    for (let i = 0; i < 40 && !ro; i++) { await step(0.1); ro = await H(() => !!document.querySelector('#fx-bubble [data-opt="job:sell"]')); }
    const on = await H(() => document.querySelector('#fx-bubble .fx-opt.on') && document.querySelector('#fx-bubble .fx-opt.on').dataset.opt);
    ok(ro && on === 'job:operate', 'a tap on the drawn robot walks over and shows its jobs, its own one marked', on);
  });

  /* ---------- 5. taps land where things are drawn, at every size ---------- */
  await section('5. hit tests', async () => {
    const sizes = [[390, 844], [320, 640], [430, 932], [844, 390], [1280, 800], [768, 1024]];
    const bad = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(4);
      await H(() => { const s = window.TAAS_FACTORY.s; s.money = 60; });
      const res = await H(() => {
        const T = window.TAAS_FACTORY, out = [];
        const want = { machine: 'machine', console: 'machine', binBack: 'bin', binFront: 'bin', dockPanel: 'dock' };
        if (T.spriteRect('desk')) out.push('the prompt lab desk is still drawn');
        Object.keys(want).forEach(id => {
          const r = T.spriteRect(id);
          if (!r) { out.push(id + ' not drawn'); return; }
          const x = r.x + r.w / 2, y = r.y + r.h * 0.6;
          if (y < 0 || y > T.view.h) return;   // off screen at this size: the scroll row covers it
          const t = T.hitTest(x, y);
          if (!t || t.kind !== want[id]) out.push(id + '->' + (t && t.kind));
        });
        const fp = T.screen(3, 5.5, 0), fl = T.hitTest(fp[0], fp[1]);   // open floor between the line and the dock
        if (!fl || fl.kind !== 'floor' || Math.abs(fl.x - 3) > 0.05 || Math.abs(fl.y - 5.5) > 0.05) out.push('floor ' + JSON.stringify(fl));
        const box = document.getElementById('fx-canvas').getBoundingClientRect(), c = document.getElementById('fx-canvas');
        if (Math.abs(c.width / T.view.dpr - box.width) > 1 || Math.abs(c.height / T.view.dpr - box.height) > 1) out.push('canvas ' + c.width + 'x' + c.height + ' for a ' + box.width + 'x' + box.height + ' box');
        return out;
      });
      // and through the real input path: a touch on the drawn console presses it
      const con = await rectOf('console');
      if (con && con.y > 0 && con.y + con.h < h) {
        await page.touchscreen.tap(con.x + con.w / 2, con.y + con.h * 0.4);
        const t = await S();
        if (!t.avatar.task || t.avatar.task.kind !== 'machine') res.push('touch on console -> ' + JSON.stringify(t.avatar.task));
      }
      res.forEach(x => bad.push(w + 'x' + h + ': ' + x));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length, 'at six sizes a tap on each drawn thing reaches that thing, and the floor maps back to the metre', bad.join('; '));
  });

  /* ---------- 6. chrome, HUD and bubble all on screen ---------- */
  await section('6. layout', async () => {
    const sizes = [[390, 844], [320, 640], [844, 390], [1280, 800]];
    const bad = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(5);
      await H(() => { const s = window.TAAS_FACTORY.s; s.bin.push('plank', 'rough', 'dowels'); FACTORY.tap(s, { kind: 'bin' }); });
      await step(4);
      const r = await H(() => {
        const box = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, hidden: e.hidden }; };
        const ids = ['back-btn', 'mute-btn', 'mode-btn', 'fx-cash', 'fx-info', 'fx-sat', 'fx-bubble'];
        const o = {}; ids.forEach(i => { o[i] = box(i); });
        o.vw = innerWidth; o.vh = innerHeight; o.sw = document.scrollingElement.scrollWidth;
        return o;
      });
      const inside = k => r[k].l >= 0 && r[k].r <= r.vw + 0.5 && r[k].t >= 0 && r[k].b <= r.vh + 0.5;
      const overlap = (a, b) => !(r[a].r <= r[b].l || r[b].r <= r[a].l || r[a].b <= r[b].t || r[b].b <= r[a].t);
      ['back-btn', 'mute-btn', 'mode-btn', 'fx-cash', 'fx-info', 'fx-sat', 'fx-bubble'].forEach(k => { if (!inside(k)) bad.push(w + 'x' + h + ' ' + k + ' off screen'); });
      if (r['fx-bubble'].hidden) bad.push(w + 'x' + h + ' bubble did not open');
      const pairs = [['back-btn', 'mute-btn'], ['mute-btn', 'mode-btn'], ['fx-bubble', 'mode-btn'], ['fx-cash', 'fx-info'], ['fx-cash', 'fx-sat'], ['fx-info', 'fx-sat']];
      ['fx-cash', 'fx-info', 'fx-sat'].forEach(k => pairs.push(['mode-btn', k], ['mute-btn', k], ['fx-bubble', k]));
      pairs.forEach(([a, b]) => { if (overlap(a, b)) bad.push(w + 'x' + h + ' ' + a + ' over ' + b); });
      if (!(r['back-btn'].r <= r['mute-btn'].l && r['mute-btn'].r <= r['mode-btn'].l)) bad.push(w + 'x' + h + ' chrome order');
      if (r.sw > r.vw) bad.push(w + 'x' + h + ' sideways scroll');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(!bad.length, 'at four sizes: back, mute and mode in a row, the money and the bubble on screen, nothing on top of anything', bad.join('; '));
  });

  /* ---------- 7. the info panel ---------- */
  await section('7. panel', async () => {
    await fresh(6);
    await page.tap('#fx-info');
    const p = await H(() => ({ open: !document.getElementById('fx-panel').hidden, rows: [...document.querySelectorAll('#fx-panel-body tbody tr')].map(r => r.textContent) }));
    ok(p.open && p.rows.length === 1 && /No robots yet/.test(p.rows[0]), 'the i button opens the explanation, with the measured table (no robots yet)', JSON.stringify(p));
    const words = await H(() => document.getElementById('fx-panel-body').textContent);
    ok(/Customer satisfaction/.test(words) && /starts at 100%/.test(words) && !/formal/i.test(words), 'it explains customer satisfaction on its own terms, without leaning on the formal mode', (words.match(/formal.{0,30}/i) || [''])[0]);
    ok(/Instructions/.test(words) && /\$5, \$10, \$15, \$20 and \$25/.test(words) && /recycle bin/.test(words) && !/prompt engineering|prompt level/i.test(words), 'and explains instructions (slot prices, the recycle bin), with nothing left of the prompt levels', (words.match(/prompt (engineering|level).{0,20}/i) || [''])[0]);
    ok(/costs \$1 for every log/.test(words) && /below zero/.test(words) && /sap logs/.test(words) && /looking for plank/.test(words) && !/sap poured|barrel/i.test(words), 'and the third brief: $1 a log (below zero is allowed), sap logs, the seller hunting for planks; no sap poured from a barrel', (words.match(/sap poured.{0,20}|barrel.{0,20}/i) || [''])[0]);
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
    await H(() => { const s = window.TAAS_FACTORY.s; s.money = 20; FACTORY.tap(s, { kind: 'dock' }); });
    await step(5);
    await page.tap('#fx-bubble [data-opt="hire"]');
    await step(0.1);
    await page.tap('#fx-bubble [data-opt="job:sell"]');
    await H(() => { window.TAAS_FACTORY.s.money = 17; });
    await step(2.2);   // the page's own autosave, every 2 s
    // read it from a second tab: a reload would also save on pagehide and hide a dead autosave
    const p2 = await ctx.newPage();
    await p2.goto(BASE + '?mode=robot-factory', { waitUntil: 'load' });
    await p2.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    const tab2 = await p2.evaluate(() => ({ money: window.TAAS_FACTORY.s.money, robots: window.TAAS_FACTORY.s.robots.map(r => r.job) }));
    await p2.close();
    ok(tab2.money === 17 && tab2.robots.join() === 'sell', 'the factory saves itself every few seconds while it runs', JSON.stringify(tab2));
    // a real formal-mode run, one quarter in: the factory must not touch it
    await H(() => { const st = TAAS.commit(TAAS.newGame(), { opp: true, inv: { train: 4 } }); localStorage.setItem('taas.v' + TAAS.CFG.version, JSON.stringify({ state: st, plan: { opp: true, inv: {} } })); });
    await H(() => { window.TAAS_FACTORY.s.money = 23; });   // no frame runs: only leaving the page can save this
    await go('?mode=robot-factory');
    await page.waitForFunction(() => window.TAAS_FACTORY && window.TAAS_FACTORY.on);
    ok(await H(() => window.TAAS_FACTORY.s.money) === 23, 'and saves on the way out, so a reload loses nothing');
    const back = await H(() => { const f = JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version)); return { money: window.TAAS_FACTORY.s.money, robots: window.TAAS_FACTORY.s.robots.map(r => r.job), formal: f.state.q + '/' + f.state.history.length + '/' + f.plan.opp }; });
    ok(back.robots.join() === 'sell' && back.formal === '1/1/true', 'a reload brings the factory back (money, the robot and its job) and leaves the formal save alone', JSON.stringify(back));
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
    // two robots by the engine's own route, the first at the button; two mistakes already seen
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.money = 60;
      ['operate', 'sell'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
      s.force.log = Array(80).fill('log'); s.force.think = Array(80).fill(false); s.force.price = Array(80).fill('fair');
      for (let i = 0; i < 200; i++) FACTORY.step(s, 0.05);
      s.robots[1].job = null; s.robots[1].state = 'idle'; s.robots[1].carry = null;   // the seller rests: no sales to move the money
      s.events = []; s.money = 100; s.seen.sap = true; s.seen.gnarled = true;
      T.tick(1 / 60);
    });
    const tapRobot = async id => {
      const rp = await H(id => { const r = window.TAAS_FACTORY.s.robots[id]; return window.TAAS_FACTORY.screen(r.x, r.y, 0.55); }, id);
      await page.touchscreen.tap(rp[0], rp[1]);
      let ro = false;
      for (let i = 0; i < 50 && !ro; i++) { await step(0.1); ro = await H(() => !!document.querySelector('#fx-bubble [data-opt="notes"]')); }
      return ro;
    };
    const opened = await tapRobot(0);
    const b0 = await H(() => ({ name: document.querySelector('#fx-bubble .fx-bname').textContent, note: document.querySelector('#fx-bubble [data-opt="notes"]').textContent.trim() }));
    ok(opened && b0.name === 'Bolt' && b0.note === '', 'a tap on the drawn robot shows its name and its clipboard (nothing on it yet)', JSON.stringify(b0));
    await page.tap('#fx-bubble [data-opt="notes"]');
    await step(0.05);
    const pg = await H(() => ({ open: !document.getElementById('fx-panel').hidden, mode: window.TAAS_FACTORY.page.mode, name: document.getElementById('fx-rp-name').value, base: document.querySelector('.fx-base').textContent, slots: document.querySelectorAll('.fx-slots li').length, buy: document.querySelector('[data-panel="buy"]').textContent, dis: document.querySelector('[data-panel="buy"]').disabled }));
    ok(pg.open && pg.mode === 'robot' && pg.name === 'Bolt' && pg.base === 'Use machine01 to refine raw materials.' && pg.slots === 5 && pg.buy === 'Unlock this slot: $5' && !pg.dis,
      'the clipboard opens its page: its name, its base prompt on top, five slots, the first for $5', JSON.stringify(pg));
    const before = await H(() => window.TAAS_FACTORY.s.money + window.TAAS_FACTORY.s.spent);   // the operator's presses cost too
    await page.tap('[data-panel="buy"]');
    await step(0.05);
    const pk = await H(() => ({ money: window.TAAS_FACTORY.s.money + window.TAAS_FACTORY.s.spent, slots: window.TAAS_FACTORY.s.robots[0].slots, rules: [...document.querySelectorAll('.fx-rules .fx-rule')].map(b => b.textContent), pick: window.TAAS_FACTORY.page.pick }));
    ok(pk.money === before - 5 && pk.slots === 1 && pk.pick === 0 && pk.rules.join('|') === 'Never put sap on input log|Put gnarled logs in recycle bin', 'unlocking a slot takes $5 and opens the list straight away: only the instructions for mistakes already seen', JSON.stringify(pk));
    await page.tap('[data-panel="rule:sap"]');
    await step(0.05);
    const set = await H(() => ({ rules: window.TAAS_FACTORY.s.robots[0].rules, slot: document.querySelector('.fx-slot.filled') && document.querySelector('.fx-slot.filled').textContent, picker: !!document.querySelector('.fx-picker'), next: document.querySelector('[data-panel="buy"]').textContent }));
    ok(set.rules.join() === 'sap' && set.slot === 'Never put sap on input log' && !set.picker && set.next === 'Unlock this slot: $10', 'tapping an instruction puts it in the slot, closes the list, and the next slot asks $10', JSON.stringify(set));
    await page.tap('[data-panel="buy"]'); await step(0.05);
    const dup = await H(() => [...document.querySelectorAll('.fx-rules .fx-rule')].map(b => b.textContent + ':' + b.disabled));
    ok(dup.length === 2 && /slot 1\):true$/.test(dup[0]) && /:false$/.test(dup[1]), 'in the next slot\'s list, the instruction it already holds is greyed and says where', JSON.stringify(dup));
    await page.tap('[data-panel="cancel"]'); await step(0.05);
    ok(!(await H(() => !!document.querySelector('.fx-picker'))) && (await H(() => window.TAAS_FACTORY.s.robots[0].rules.join())) === 'sap,', 'Cancel closes the list and leaves the slot empty');
    // a name: typed, trimmed, and shown as text wherever it appears
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
    // the page fits a small phone, scrolls, and its top is reachable
    await page.setViewportSize({ width: 320, height: 568 });
    await page.tap('#fx-bubble [data-opt="notes"]'); await step(0.05);
    await page.tap('[data-panel="pick:1"]'); await step(0.05);
    const fit = await H(() => { const p = document.getElementById('fx-panel'), body = document.getElementById('fx-panel-body'); p.scrollTop = -9999; const top = body.getBoundingClientRect().top - p.getBoundingClientRect().top; const wide = body.scrollWidth > body.clientWidth + 1 || document.scrollingElement.scrollWidth > innerWidth; return { top, wide, scrolls: p.scrollHeight > p.clientHeight }; });
    ok(fit.top >= 0 && !fit.wide && fit.scrolls, 'at 320x568 the page scrolls, its top is reachable, and nothing runs off sideways', JSON.stringify(fit));
    await H(() => window.TAAS_FACTORY.closePanel());
    await page.setViewportSize({ width: 390, height: 844 });
    // with one robot the slots wait for the second
    await fresh(10);
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.money = 20; FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); s.money = 500; FACTORY.choose(s, 'notes'); T.tick(1 / 60); });
    const one = await H(() => ({ open: !document.getElementById('fx-panel').hidden, buy: document.querySelector('[data-panel="buy"]').textContent, dis: document.querySelector('[data-panel="buy"]').disabled, base: document.querySelector('.fx-base').textContent }));
    ok(one.open && one.dis && /once both robots are on staff/.test(one.buy) && /No job/.test(one.base), 'with one robot its page is there (name, no job yet), but slots wait for the second robot', JSON.stringify(one));
    await H(() => window.TAAS_FACTORY.closePanel());
    // the seller, told to sell only planks, at a bin of things that are not planks: its page counts the looking
    await fresh(12);
    await H(() => {
      const T = window.TAAS_FACTORY, s = T.s;
      s.money = 60;
      ['operate', 'sell'].forEach(job => { FACTORY.tap(s, { kind: 'dock' }); for (let i = 0; i < 600 && !FACTORY.bubbleOpen(s); i++) FACTORY.step(s, 0.05); FACTORY.choose(s, 'hire'); FACTORY.choose(s, 'job:' + job); });
      s.robots[0].job = null; s.robots[0].state = 'idle';
      s.money = 100; s.seen.sellOnly = true; FACTORY.buySlot(s, 1); FACTORY.setRule(s, 1, 0, 'sellOnly');
      for (let i = 0; i < 200; i++) FACTORY.step(s, 0.05);
      s.force.slip = [false]; s.bin.push('dowels', 'rough', 'dowels');
      T.tick(1 / 60);
    });
    await step(6);
    const hunt = await H(() => { const T = window.TAAS_FACTORY, r = T.s.robots[1]; T.openRobot(1); const row = [...document.querySelectorAll('.fx-rec tr')].find(tr => /Looking for plank/.test(tr.textContent)); return { n: r.record.looking, row: row && row.textContent, bin: T.s.bin.join(), dot: row && row.querySelector('.fx-dot').className }; });
    ok(hunt.n >= 3 && hunt.row === 'Looking for plank' + hunt.n && /soso/.test(hunt.dot) && hunt.bin === 'dowels,rough,dowels', 'the seller\'s page counts each reach that came up with something other than a plank: "Looking for plank" and how often', JSON.stringify(hunt));
    await H(() => window.TAAS_FACTORY.closePanel());
  });

  /* ---------- 11. the wall and the recycle bin, read off pixels ---------- */
  await section('11. scene', async () => {
    await fresh(11);
    await H(() => { const T = window.TAAS_FACTORY; T.view.camY = T.view.minY; T.tick(1 / 60); });
    const px = (x, y, z) => H(([x, y, z]) => { const T = window.TAAS_FACTORY, p = T.screen(x, y, z), k = T.view.dpr, g = document.getElementById('fx-canvas').getContext('2d'); const d = g.getImageData(Math.round(p[0] * k) - 4, Math.round(p[1] * k) - 4, 9, 9).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } return [r / n, gg / n, b / n].map(Math.round); }, [x, y, z]);
    const wall = await px(3.0, 0.45, 1.8), bin = await px(3.8, 4.32, 0.3);
    ok(wall[0] - wall[2] < 30 && Math.abs(wall[0] - wall[1]) < 30, 'the back wall carries no sign: where it hung is plain wall', 'rgb ' + wall);
    ok(bin[1] > bin[0] + 30 && bin[1] > bin[2], 'the recycle bin is drawn, green, in front of the out-feed', 'rgb ' + bin);
    const was = await px(1.53, 4.2, 0.35), floor = await px(1.53, 5.2, 0);
    ok(Math.abs(was[0] - floor[0]) < 25 && Math.abs(was[2] - floor[2]) < 25, 'the sap barrel is gone: where it stood is bare floor', 'rgb ' + was + ' vs floor ' + floor);
    // the holes: a gnarled log on the in-feed and a plank with holes in the bin, each scanned for
    // hole-coloured pixels column by column, the hole centres put back into metres from the item's middle
    const holes = (kind) => H(([kind]) => {
      const T = window.TAAS_FACTORY, s = T.s, V = T.view, k = V.dpr, g = document.getElementById('fx-canvas').getContext('2d');
      const at = kind === 'gnarled' ? [1.7, 2.9, 0.66] : [5.22, 2.62, 0.06];
      const a = T.screen(at[0] - 0.5, at[1] + 0.16, at[2] - 0.15), b = T.screen(at[0] + 0.5, at[1] - 0.16, at[2] + 0.2);
      const x0 = Math.round(a[0] * k), x1 = Math.round(b[0] * k), y0 = Math.round(Math.min(a[1], b[1]) * k), y1 = Math.round(Math.max(a[1], b[1]) * k);
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0, cols = [];
      for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < y1 - y0; y++) { const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2]; if (r + gg + bb < 120 && r >= bb + 10) n++; } cols.push(n >= 2); }
      const out = [];
      for (let x = 0; x < w; x++) if (cols[x] && !cols[x - 1]) { let e = x; while (cols[e + 1]) e++; out.push(+(((x0 + (x + e) / 2) / k - V.ox) / V.S - at[0]).toFixed(3)); x = e; }
      return out;
    }, [kind]);
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.machine.phase = 'ready'; s.machine.staged = 1; s.machine.log = 'gnarled'; s.bin = ['rough']; T.tick(0); });
    const logH = await holes('gnarled'), plankH = await holes('rough');
    ok(logH.length === 3 && plankH.length === 3 && logH.every((x, i) => Math.abs(x - plankH[i]) < 0.04), 'a gnarled log\'s plank has its holes in the same places as the log (the CD\'s ask), read off the drawn pixels', 'log ' + logH.join() + ' / plank ' + plankH.join());
    await H(() => { const T = window.TAAS_FACTORY, s = T.s; s.machine.log = 'sappy'; s.bin = []; T.tick(0); });
    const sap = await H(() => { const T = window.TAAS_FACTORY, V = T.view, k = V.dpr, g = document.getElementById('fx-canvas').getContext('2d'); const a = T.screen(1.2, 3.05, 0.5), b = T.screen(2.2, 2.75, 0.85); const d = g.getImageData(Math.round(a[0] * k), Math.round(b[1] * k), Math.round((b[0] - a[0]) * k), Math.round((a[1] - b[1]) * k)).data; let n = 0, all = 0; for (let i = 0; i < d.length; i += 4) { all++; if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 60) n++; } return n / all; });
    ok(sap > 0.04, 'a sap log rolls in green with sap', (sap * 100).toFixed(1) + '% green');
  });

  ok(!errors.length, 'no page errors or console errors over the whole drive', errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-FACTORY-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
