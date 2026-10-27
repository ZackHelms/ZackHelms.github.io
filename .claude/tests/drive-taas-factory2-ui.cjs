#!/usr/bin/env node
/**
 * drive-taas-factory2-ui.cjs - TAAS's Robot factory v2 page, in Chromium (~30 s).
 *
 * drive-taas-factory2.cjs proves the engine. This proves the page (games/taas/factory-v2.html,
 * the CD, 2026-10-26): the mode dropdown on both pages (v2 is its own page, so choosing it or one of
 * the first page's modes goes between them, and the last choice is kept), the build badge, that a tap
 * at the pixel where a thing is DRAWN reaches that thing (the new raw materials bin, the hoppers, the
 * terminal and its elevator), your arms at the raw materials bin and the planer's hopper by real
 * touches, the terminal's bubble and a robot riding the elevator up (drawn coming up out of the shaft),
 * a robot's bubble and its page, choosing a main prompt by tapping its source and destination on the
 * floor (a machine refused as a source, the same place refused twice, Cancel), the sentence builder by
 * real taps (a line kept once its fourth word is chosen, nonsense raising the slip figure, lines moved
 * and removed), the lines part never rebuilt under a finger, the dump truck read off pixels (there,
 * and its bed tipping), the chrome, the bubble and the pick card on screen at three sizes, a save that
 * survives a reload apart from the first factory's, Info from the menu, and the menu's Prices.
 * Frames are stepped through the page's own test hook (TAAS_FACTORY2, paused), so time is exact;
 * input goes through real touch events.
 *
 * Usage:
 *   node .claude/tests/drive-taas-factory2-ui.cjs     (playwright-core on NODE_PATH; gates.sh finds it)
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas-factory2-ui.cjs   # negtest-copies
 *
 * Final line: TAAS-FACTORY2-UI: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.log('NO-PLAYWRIGHT: playwright-core not resolvable (run via .claude/scripts/gates.sh)'); console.log('TAAS-FACTORY2-UI: RED'); process.exit(1); }

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'factory-v2.html');
const SRC = fs.readFileSync(PAGE, 'utf8');
const V1 = fs.readFileSync(path.join(process.cwd(), 'games', 'taas', 'index.html'), 'utf8');

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined && detail !== '' ? ' (' + detail + ')' : '')); }
}
// both pages, as the site serves them side by side
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/blank') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>blank</title>'); return; }
  const body = u === '/taas/factory-v2.html' ? SRC : u === '/taas/index.html' ? V1 : null;
  if (!body) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port, BASE = ORIGIN + '/taas/factory-v2.html', V1URL = ORIGIN + '/taas/index.html';
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('FAIL chromium launches (' + e2.message + ')'); console.log('TAAS-FACTORY2-UI: RED'); server.close(); process.exit(1); } }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(u => !String(u).startsWith('http://127.0.0.1'), r => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  const H = (fn, arg) => page.evaluate(fn, arg);
  // a clean factory, paused, so the suite owns the clock (the old page is left for a blank one before
  // storage is cleared, so its pagehide save cannot write the last row's factory back)
  const fresh = async (seed, prep) => {
    await page.goto(ORIGIN + '/blank', { waitUntil: 'load' });
    await H(() => { localStorage.clear(); });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on);
    await H(([sd, pr]) => { const T = window.TAAS_FACTORY2; T.paused = true; T.s = FACTORY2.newGame(sd || 1); T.s.shop.next = 1e9; if (pr === 'open') T.s.goal = FACTORY2.CFG.goals.length; T.view.camY = T.view.minY; T.tick(0); }, [seed, prep || '']);
  };
  const step = (sec) => H(sec => { const T = window.TAAS_FACTORY2; for (let i = 0; i < Math.round(sec * 60); i++) T.tick(1 / 60); }, sec);
  const stepUntil = (fnSrc, max) => H(([src, max]) => { const T = window.TAAS_FACTORY2, f = new Function('s', 'return (' + src + ')(s)'); for (let i = 0; i < max * 60; i++) { if (f(T.s)) return true; T.tick(1 / 60); } return f(T.s); }, [fnSrc, max || 30]);
  const rectOf = (id) => H(id => window.TAAS_FACTORY2.spriteRect(id), id);
  const centre = r => [r.x + r.w / 2, r.y + r.h / 2];
  const camTo = y => H(y => { const T = window.TAAS_FACTORY2, v = T.view; v.camY = Math.max(v.minY, Math.min(v.maxY, y)); T.tick(0); }, y);
  // scroll so a world row is in the middle of the screen
  const look = (wy) => H(wy => { const T = window.TAAS_FACTORY2, v = T.view, p = T.screen(0, wy, 0); v.camY = Math.max(v.minY, Math.min(v.maxY, v.camY + p[1] - v.h / 2)); T.tick(0); }, wy);
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await step(0.05); };
  async function section(name, fn) { try { await fn(); } catch (e) { ok(false, name + ' played through', e.message.split('\n')[0]); } }

  /* ---------- 1. the page and the Version in both factories' menus (the CD, 2026-10-27: Robot
     Factory has its own card on the games list, opening here at v2; v1 is TAAS's page in its factory) ---------- */
  await section('1. version', async () => {
    await page.goto(ORIGIN + '/blank'); await H(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on);
    await page.tap('#menu-btn');
    const a = await H(() => { const rows = [...document.getElementById('menu').children].filter(e => e.getBoundingClientRect().height > 0), sel = document.getElementById('version-sel');
      return { first: rows[0] && rows[0].id, v: sel.value, opts: [...sel.options].map(o => o.value + ':' + o.textContent).join(), dropdown: !!document.getElementById('mode-btn'), title: document.title, mode: document.documentElement.dataset.mode }; });
    ok(a.first === 'menu-version' && a.v === 'v2' && a.opts === 'v2:v2,v1:v1' && !a.dropdown && a.title === 'Robot Factory v2' && a.mode === 'robot-factory-v2',
      'the v2 page: no mode dropdown, and its menu opens with the Version first, reading v2, with v2 and v1 to choose from', JSON.stringify(a));
    await H(() => { window.TAAS_FACTORY2.s.money = 41; });
    await page.selectOption('#version-sel', 'v1');
    await page.waitForFunction(() => location.pathname === '/taas/index.html' && window.TAAS_FACTORY && window.TAAS_FACTORY.on, null, { timeout: 4000 }).catch(() => {});
    const b = await H(() => ({ path: location.pathname, q: location.search, mode: document.documentElement.dataset.mode, title: document.title, saved: (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.indexOf('taas.factory2.v') === 0)) || '{}')).money }));
    ok(b.path === '/taas/index.html' && b.q === '?mode=robot-factory' && b.mode === 'robot-factory' && b.title === 'Robot Factory v1' && b.saved === 41,
      'choosing v1 goes to TAAS\'s page in its factory (Robot Factory v1), and v2 saved itself on the way out', JSON.stringify(b));
    await page.tap('#menu-btn');
    const v1 = await H(() => document.getElementById('version-sel').value);
    await page.selectOption('#version-sel', 'v2').catch(() => {});
    await page.waitForFunction(() => location.pathname === '/taas/factory-v2.html' && window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on, null, { timeout: 4000 }).catch(() => {});
    const c = await H(() => ({ path: location.pathname, money: window.TAAS_FACTORY2 && window.TAAS_FACTORY2.s.money }));
    ok(v1 === 'v1' && c.path === '/taas/factory-v2.html' && c.money === 41, 'v1\'s menu reads v1, and choosing v2 there comes back here to the same factory', JSON.stringify({ v1, c }));
    // the browser's Back from v2 to v1: the page comes back running, its menu shut
    await page.goBack({ waitUntil: 'load' }).catch(() => {});
    await page.waitForFunction(() => location.pathname === '/taas/index.html' && window.TAAS_FACTORY && window.TAAS_FACTORY.on, null, { timeout: 4000 }).catch(() => {});
    const t0 = await H(() => window.TAAS_FACTORY && window.TAAS_FACTORY.s.t);
    await page.waitForTimeout(400);
    const d = await H(() => ({ path: location.pathname, t: window.TAAS_FACTORY && window.TAAS_FACTORY.s.t, menu: document.getElementById('menu').hidden }));
    ok(d.path === '/taas/index.html' && d.t > t0 && d.menu, 'Back from v2 to v1 finds v1 running, its menu shut', JSON.stringify({ t0, d }));
    // TAAS's own card opens the page with no ?mode=: always formal now, whatever was played last
    await H(() => localStorage.setItem('taas-mode', 'robot-factory-v2'));
    await page.goto(V1URL, { waitUntil: 'load' });
    const e = await H(() => ({ path: location.pathname, mode: document.documentElement.dataset.mode }));
    ok(e.path === '/taas/index.html' && e.mode === 'formal', 'TAAS with no ?mode= stays formal, even with v2 chosen last under the old dropdown', JSON.stringify(e));
    await page.goto(V1URL + '?mode=robot-factory-v2', { waitUntil: 'load' });
    await page.waitForFunction(() => location.pathname === '/taas/factory-v2.html' && window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on, null, { timeout: 4000 }).catch(() => {});
    ok(await H(() => location.pathname) === '/taas/factory-v2.html', 'an old link to v2 on TAAS\'s page (?mode=robot-factory-v2) still lands here');
    const badge = await (async () => { await page.goto(BASE, { waitUntil: 'load' }); return H(() => { const r = document.getElementById('build-badge').getBoundingClientRect(); return { b: innerHeight - r.bottom, r: innerWidth - r.right, t: document.getElementById('build-badge').dataset.utc }; }); })();
    ok(badge.b < 12 && badge.r < 12 && /^build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(badge.t || ''), 'the build badge sits in the bottom right corner, stamped in UTC', JSON.stringify(badge));
  });

  /* ---------- 2. a tap where a thing is drawn reaches that thing ---------- */
  await section('2. taps', async () => {
    const WANT = { rawFront: 'raw', rawBack: 'raw', terminal: 'terminal', liftFrame: 'terminal', planerInFront: 'planerIn', binFront: 'bin', machine: 'machine', recycle: 'recycle', extractInFront: 'extractIn', sawInFront: 'sawIn', saw: 'saw', bench: 'bench' };
    for (const [w, h] of [[390, 844], [844, 390], [360, 740]]) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(2, 'open');
      const bad = [];
      for (const id of Object.keys(WANT)) {
        const ry = await H(id => { const T = window.TAAS_FACTORY2; T.view.camY = T.view.minY; T.tick(0); const r = T.spriteRect(id); return r; }, id);
        if (!ry) { bad.push(id + ' not drawn'); continue; }
        // scroll the thing into the middle, then ask what the pixel at its inked centre is
        const t = await H(([id]) => {
          const T = window.TAAS_FACTORY2, v = T.view;
          let r = T.spriteRect(id); v.camY = Math.max(v.minY, Math.min(v.maxY, v.camY + r.y + r.h / 2 - v.h / 2)); T.tick(0); r = T.spriteRect(id);
          const pts = [[0.5, 0.6], [0.5, 0.75], [0.4, 0.5], [0.6, 0.5], [0.5, 0.4]];
          for (const [fx, fy] of pts) { const x = r.x + r.w * fx, y = r.y + r.h * fy; const k = T.hitTest(x, y); if (k) return k.kind; }
          return null;
        }, [id]);
        if (t !== WANT[id]) bad.push(id + '->' + t);
      }
      ok(!bad.length, w + 'x' + h + ': a tap on the raw materials bin, the terminal, the elevator, the hoppers and the machines reaches each', bad.join(', '));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(2);
    const lift = await H(() => { const T = window.TAAS_FACTORY2, L = FACTORY2.LAYOUT.LIFT, v = T.view; const p = T.screen((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, 0); v.camY += p[1] - v.h / 2; T.tick(0); const q = T.screen((L.x0 + L.x1) / 2, L.y1 - 0.15, 0); return T.hitTest(q[0], q[1]); });
    ok(lift && lift.kind === 'terminal', 'a tap on the elevator\'s platform is a tap on the terminal', JSON.stringify(lift));
    const locked = await H(() => { const T = window.TAAS_FACTORY2; return ['extractInFront', 'saw', 'bench'].map(id => T.spriteRect(id)); });
    ok(locked.every(r => r === null), 'a locked slot\'s machine and hopper are not drawn (and so not tapped)');
  });

  /* ---------- 3. your arms: the raw materials bin and the planer's hopper ---------- */
  await section('3. arms', async () => {
    await fresh(3);
    await H(() => { const s = window.TAAS_FACTORY2.s; s.raw = ['log.m', 'log.m', 'log.l', 'sappy.s']; s.planer.in = []; });
    await look(15.5);
    let c = centre(await rectOf('rawFront'));
    await tap(c[0], c[1]);
    await stepUntil("s => FACTORY2.bubbleOpen(s) && FACTORY2.bubbleOpen(s).kind === 'raw'", 30);
    await step(0.1);
    const opts = await H(() => [...document.querySelectorAll('#fx-bubble [data-opt]')].map(b => b.dataset.opt));
    ok(opts.filter(o => o.indexOf('take:') === 0).sort().join() === 'take:log.l,take:log.m,take:sappy.s', 'tapping the raw materials bin walks you there, and its bubble offers each kind in it', opts.join());
    for (const id of ['take:log.m', 'take:log.l']) { await page.tap('#fx-bubble [data-opt="' + id + '"]'); await step(0.5); }
    const inv = await H(() => window.TAAS_FACTORY2.s.avatar.inv.slice().sort().join());
    ok(inv === 'log.l,log.m,log.m', 'two taps take the medium and the large logs into your arms', inv);
    await look(4.2);
    c = centre(await rectOf('planerInFront'));
    await tap(c[0], c[1]);
    await stepUntil("s => FACTORY2.bubbleOpen(s) && FACTORY2.bubbleOpen(s).kind === 'planerIn'", 40);
    await step(0.1);
    await page.tap('#fx-bubble [data-opt="put:log.m"]'); await step(0.1);
    const s1 = await H(() => { const s = window.TAAS_FACTORY2.s; return { hop: s.planer.in.length + (s.planer.item ? 1 : 0), run: s.planer.phase, inv: s.avatar.inv.join() }; });
    ok(s1.hop === 2 && s1.inv === 'log.l', 'and a tap at the planer\'s hopper puts the medium logs in', JSON.stringify(s1));
    await step(1);
    ok(await H(() => window.TAAS_FACTORY2.s.planer.phase) === 'run', 'and the planer starts on them by itself');
  });

  /* ---------- 4. the terminal, the elevator, a robot's bubble and its page ---------- */
  await section('4. robots', async () => {
    await fresh(4);
    await H(() => { window.TAAS_FACTORY2.s.money = 5; });
    await look(15.6);
    const c = centre(await rectOf('terminal'));
    await tap(c[0], c[1]);
    await stepUntil("s => FACTORY2.bubbleOpen(s) && FACTORY2.bubbleOpen(s).kind === 'terminal'", 30);
    await step(0.1);
    const b = await H(() => ({ opts: [...document.querySelectorAll('#fx-bubble [data-opt]')].map(x => x.dataset.opt + ':' + (x.querySelector('.fx-lbl') || {}).textContent), signs: [...document.querySelectorAll('#fx-bubble .fx-sign')].map(x => x.textContent).join('') }));
    ok(b.opts.join() === 'buy:$1,configs:Configs' && b.signs === '+', 'the terminal\'s bubble: a robot for $1 on the + row, and the configurations under it', JSON.stringify(b));
    const m0 = await H(() => window.TAAS_FACTORY2.s.money);
    await page.tap('#fx-bubble [data-opt="buy"]'); await step(0.05);
    const ride = await H(() => { const s = window.TAAS_FACTORY2.s; return { where: s.robots[0] && s.robots[0].where, lift: s.lift.by, money: s.money }; });
    ok(ride.where === 'up' && ride.lift === 0 && Math.abs(m0 - ride.money - 1) < 1e-9, 'buying it: $1, and it rides the elevator up', JSON.stringify(ride));
    // drawn coming up through the shaft: less of it shows half way than at the top
    const ink = () => H(() => { const T = window.TAAS_FACTORY2, L = FACTORY2.LAYOUT.LIFT, k = T.view.dpr, a = T.screen(L.x0, L.y0 - 1.3, 0), b = T.screen(L.x1, L.y1, 0); const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.round((b[1] - a[1]) * k)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 225 && im[i + 1] > 228 && im[i + 2] > 232) n++; return n; });
    // and nothing of it below the floor in front of the opening: what is still in the shaft is hidden
    const front = () => H(() => { const T = window.TAAS_FACTORY2, L = FACTORY2.LAYOUT.LIFT, k = T.view.dpr, a = T.screen(L.x0 - 0.2, L.y1 + 0.04, 0), b = T.screen(L.x1 + 0.2, L.y1 + 1.4, 0); const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.round((b[1] - a[1]) * k)).data; let n = 0; for (let i = 0; i < im.length; i += 4) if (im[i] > 225 && im[i + 1] > 228 && im[i + 2] > 232) n++; return n; });
    await step(0.45); const half = await ink(), below = await front();
    await step(1.5); const top = await ink();
    ok(top > half * 1.15 && top > 200 && below < 20, 'drawn rising out of the shaft: more of its white body shows at the top than a quarter of the way up, and none of it below the floor in front of the opening', half + ' / ' + top + ', below ' + below);
    ok(await H(() => window.TAAS_FACTORY2.s.robots[0].where) === 'floor', 'and it steps off onto the floor');
    await step(3);
    await H(() => { const s = window.TAAS_FACTORY2.s; s.robots[0].x = 2.45; s.robots[0].y = 15.48; window.TAAS_FACTORY2.tick(0); });
    await look(15.5);
    const rp = await H(() => { const T = window.TAAS_FACTORY2, r = T.s.robots[0]; return T.screen(r.x, r.y, 0.55); });
    await tap(rp[0], rp[1]);
    await stepUntil("s => FACTORY2.bubbleOpen(s) && FACTORY2.bubbleOpen(s).kind === 'robot'", 30);
    await step(0.1);
    const rb = await H(() => ({ name: (document.querySelector('#fx-bubble .fx-bname') || {}).textContent, opts: [...document.querySelectorAll('#fx-bubble [data-opt]')].map(x => x.dataset.opt + ':' + (x.querySelector('.fx-lbl') || {}).textContent).join() }));
    ok(rb.name === 'Bolt' && rb.opts === 'notes:No prompt,down:Storage', 'a tap on the robot: its name, its page (no prompt yet) and Storage', JSON.stringify(rb));
    await page.tap('#fx-bubble [data-opt="notes"]'); await step(0.1);
    const pg = await H(() => ({ open: !document.getElementById('fx-panel').hidden, name: document.getElementById('fx-rp-name').value, prompt: (document.querySelector('[data-panel="prompt"]') || {}).textContent, slip: (document.querySelector('[data-part="lines"] .fx-h span:last-child') || {}).textContent }));
    ok(pg.open && pg.name === 'Bolt' && /Tap here/.test(pg.prompt) && /0%/.test(pg.slip), 'its page: its name, an empty main prompt to tap, and no slips with no lines', JSON.stringify(pg));
  });

  /* ---------- 5. choosing a main prompt on the floor ---------- */
  await section('5. prompt', async () => {
    await page.tap('[data-panel="prompt"]'); await step(0.05);
    const p0 = await H(() => ({ panel: document.getElementById('fx-panel').hidden, pick: !document.getElementById('fx-pick').hidden, text: document.getElementById('fx-pick').textContent, st: window.TAAS_FACTORY2.pick }));
    ok(p0.panel && p0.pick && /from/.test(p0.text) && p0.st.step === 'src', 'tapping it closes the page and asks for the source', JSON.stringify(p0));
    await look(4.2);
    let c = centre(await rectOf('machine'));
    await tap(c[0], c[1]);
    const p1 = await H(() => ({ st: window.TAAS_FACTORY2.pick, nope: document.getElementById('fx-pick').classList.contains('nope') }));
    ok(p1.st.step === 'src' && p1.nope, 'a machine is not a source: the card shakes and still asks', JSON.stringify(p1));
    await look(15.5);
    c = centre(await rectOf('rawFront')); await tap(c[0], c[1]);
    const p2 = await H(() => ({ st: window.TAAS_FACTORY2.pick, text: document.getElementById('fx-pick').textContent }));
    ok(p2.st.step === 'dst' && p2.st.src === 'raw' && /raw materials bin/.test(p2.text) && /to/.test(p2.text), 'the raw materials bin as the source; now it asks for the destination', JSON.stringify(p2));
    await tap(c[0], c[1]);
    ok((await H(() => window.TAAS_FACTORY2.pick)).step === 'dst', 'the same bin again is refused');
    // the marks: valid places tinted while choosing
    const tint = await H(() => { const T = window.TAAS_FACTORY2, r = T.placeRect('bin'); return r; });
    ok(tint === null || tint.w > 10, '(a place\'s mark has a size)');
    await look(4.2);
    c = centre(await rectOf('machine')); await tap(c[0], c[1]);
    await step(0.1);
    const p3 = await H(() => { const r = window.TAAS_FACTORY2.s.robots[0]; return { src: r.src, dst: r.dst, pick: window.TAAS_FACTORY2.pick, open: !document.getElementById('fx-panel').hidden, text: document.querySelector('[data-panel="prompt"]').textContent }; });
    ok(p3.src === 'raw' && p3.dst === 'planerIn' && !p3.pick && p3.open && p3.text === 'Take things from the raw materials bin to the planer\'s hopper.', 'the planer as the destination is its hopper; the page comes back with the prompt as the robot reads it', JSON.stringify(p3));
    await page.tap('[data-panel="prompt"]'); await step(0.05);
    await page.tap('#fx-pick [data-pick="cancel"]'); await step(0.05);
    const p4 = await H(() => ({ pick: window.TAAS_FACTORY2.pick, open: !document.getElementById('fx-panel').hidden, src: window.TAAS_FACTORY2.s.robots[0].src }));
    ok(!p4.pick && p4.open && p4.src === 'raw', 'Cancel goes back to the page and keeps the prompt it had', JSON.stringify(p4));
  });

  /* ---------- 6. the sentence builder ---------- */
  await section('6. lines', async () => {
    await page.tap('[data-panel="edit:0"]'); await step(0.05);
    const w0 = await H(() => [...document.querySelectorAll('.fx-sb-list [data-panel]')].map(b => b.textContent));
    ok(w0.join() === 'Only take,Never take,Recycle,Wait,Carry,Stop at', 'a new line opens the builder on the first word\'s list', w0.join());
    await page.tap('[data-panel="word:recycle"]'); await step(0.02);
    const w1 = await H(() => [...document.querySelectorAll('.fx-sb-list [data-panel]')].map(b => b.textContent).slice(0, 4).join());
    ok(w1 === 'any,small,medium,large', 'a word chosen, the builder moves on to the next word\'s list', w1);
    for (const w of ['any', 'slogs']) { await page.tap('[data-panel="word:' + w + '"]'); await step(0.02); }
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines.length)) === 0, 'three words in, nothing is kept yet');
    await page.tap('[data-panel="word:none"]'); await step(0.05);
    const l1 = await H(() => ({ lines: window.TAAS_FACTORY2.s.robots[0].lines, text: document.querySelector('[data-panel="edit:0"]').textContent, slip: document.querySelector('[data-part="lines"] .fx-h span:last-child').textContent }));
    ok(JSON.stringify(l1.lines) === '[["recycle","any","slogs","none"]]' && l1.text === 'Recycle any sap logs' && /5%/.test(l1.slip), 'the fourth word keeps it: "Recycle any sap logs", and the robot slips 5% of trips', JSON.stringify(l1));
    await page.tap('[data-panel="sb-done"]'); await step(0.02);
    await page.tap('[data-panel="edit:1"]'); await step(0.02);
    for (const w of ['wait', 'medium', 'planks', 'atime']) { await page.tap('[data-panel="word:' + w + '"]'); await step(0.02); }
    const l2 = await H(() => ({ n: window.TAAS_FACTORY2.s.robots[0].lines.length, slip: document.querySelector('[data-part="lines"] .fx-h span:last-child').textContent }));
    ok(l2.n === 2 && /10%/.test(l2.slip), 'a line that means nothing is kept too, and the slip figure goes to 10%', JSON.stringify(l2));
    await page.tap('[data-panel="pos:2"]'); await step(0.02);
    await page.tap('[data-panel="word:seconds"]'); await step(0.02);
    const l3 = await H(() => ({ line: window.TAAS_FACTORY2.s.robots[0].lines[1].join(' '), focus: window.TAAS_FACTORY2.page.pos }));
    ok(l3.line === 'wait medium seconds atime', 'a chip goes back to a word, and a change to a kept line is kept at once', JSON.stringify(l3));
    await page.tap('[data-panel="sb-done"]'); await step(0.02);
    await page.tap('[data-panel="up:1"]'); await step(0.02);
    const l4 = await H(() => window.TAAS_FACTORY2.s.robots[0].lines.map(l => l[0]).join());
    ok(l4 === 'wait,recycle', 'the up arrow moves a line up', l4);
    await page.tap('[data-panel="del:0"]'); await step(0.02);
    const l5 = await H(() => ({ lines: window.TAAS_FACTORY2.s.robots[0].lines.map(l => l[0]).join(), slip: document.querySelector('[data-part="lines"] .fx-h span:last-child').textContent }));
    ok(l5.lines === 'recycle' && /5%/.test(l5.slip), 'and the cross removes it', JSON.stringify(l5));
    // a finger held in the lines part keeps it as it is while the robot works and the lines change
    await page.tap('[data-panel="edit:1"]'); await step(0.02);
    const el0 = await H(() => { const b = document.querySelector('[data-panel="word:only"]'); b.dataset.tag = 'held'; return !!b; });
    const box = await H(() => { const r = document.querySelector('[data-panel="word:only"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box[0], y: box[1] }] });
    await H(() => { const T = window.TAAS_FACTORY2; FACTORY2.setLine(T.s, 0, 1, ['wait', '3', 'seconds', 'none']); });
    await step(1);
    const held = await H(() => { const b = document.querySelector('[data-panel="word:only"]'); return b && b.dataset.tag === 'held'; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await step(0.1);
    const after = await H(() => { const b = document.querySelector('[data-panel="word:only"]'); return !b || b.dataset.tag !== 'held'; });
    ok(el0 && held && after, 'the lines part is never rebuilt under a finger, and catches up once it lifts');
    await page.tap('[data-panel="close"]'); await step(0.02);
  });

  /* ---------- 7. the dump truck ---------- */
  await section('7. truck', async () => {
    await fresh(7);
    await H(() => { const T = window.TAAS_FACTORY2; T.view.camY = T.view.maxY; T.tick(0); });
    const yellow = () => H(() => { const T = window.TAAS_FACTORY2, TR = FACTORY2.LAYOUT.TRUCK, k = T.view.dpr, a = T.screen(TR.x0, TR.y0 + 0.2, 1.0), b = T.screen(TR.x1, TR.y0 + 1.2, 0.6); const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(a[0] * k), Math.round(a[1] * k), Math.round((b[0] - a[0]) * k), Math.max(1, Math.round((b[1] - a[1]) * k))).data; let n = 0, t = 0; for (let i = 0; i < im.length; i += 4) { t++; if (im[i] > 190 && im[i + 1] > 130 && im[i + 1] < 215 && im[i + 2] < 110) n++; } return { n, t }; });
    const y0 = await yellow();
    ok(y0.n > y0.t * 0.15, 'the truck\'s yellow bed is there in the yard, outside the floor\'s front edge', JSON.stringify(y0));
    const bits = () => H(() => { const T = window.TAAS_FACTORY2, TR = FACTORY2.LAYOUT.TRUCK, k = T.view.dpr, a = T.screen(TR.x0 - 0.1, TR.y0, 3.2), b = T.screen(TR.x1 + 0.1, TR.y0 + 1.6, 0); const im = document.getElementById('fx-canvas').getContext('2d').getImageData(Math.round(a[0] * k), Math.max(0, Math.round(a[1] * k)), Math.round((b[0] - a[0]) * k), Math.round((b[1] - Math.max(0, a[1])) * k)).data; let h = 0; for (let i = 0; i < im.length; i += 16) h = (h * 31 + (im[i] >> 4)) >>> 0; return h; });
    const flat = await bits();
    await H(() => { window.TAAS_FACTORY2.s.raw = []; });
    await step(C_delay() + 1.2);
    const tipped = await bits();
    const ph = await H(() => ({ phase: window.TAAS_FACTORY2.s.truck.phase, tilt: window.TAAS_FACTORY2.truck().tilt }));
    ok(ph.phase === 'tip' && tipped !== flat && ph.tilt > 0.5, 'the bin empty, the truck tips its bed (drawn tilted, and the picture changes)', JSON.stringify(ph));
    await step(2);
    ok((await H(() => window.TAAS_FACTORY2.s.raw.length)) === 10, 'and ten logs land in the raw materials bin');
    function C_delay() { return 0.8; }
  });

  /* ---------- 8. the chrome, the bubble and the pick card on screen ---------- */
  await section('8. sizes', async () => {
    const bad = [];
    for (const [w, h] of [[320, 640], [390, 844], [844, 390], [1280, 800]]) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(8);
      await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.money = 9; for (let i = 0; i < 4; i++) FACTORY2.buyRobot(s); for (let i = 0; i < 400; i++) T.tick(1 / 60); FACTORY2.sendDown(s, 1); for (let i = 0; i < 600; i++) T.tick(1 / 60); s.avatar.task = { kind: 'terminal', arrived: true, spot: FACTORY2.LAYOUT.SPOT.terminal }; s.avatar.x = 0.61; s.avatar.y = 16.15; s.bubble = { kind: 'terminal' }; T.view.camY = T.view.maxY; T.tick(0); });
      await step(0.1);
      const r = await H(() => { const g = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; }; return { vw: innerWidth, vh: innerHeight, menu: g('menu-btn'), reload: g('reload-btn'), bubble: g('fx-bubble') }; });
      ['menu', 'reload', 'bubble'].forEach(k => { const q = r[k]; if (!q) bad.push(w + 'x' + h + ' ' + k + ' missing'); else if (q.l < 0 || q.t < 0 || q.r > r.vw || q.b > r.vh) bad.push(w + 'x' + h + ' ' + k + ' off screen'); });
      if (r.menu && r.reload && !(r.menu.r <= r.reload.l)) bad.push(w + 'x' + h + ' chrome order');
      ['menu', 'reload'].forEach(k => { const q = r[k], u = r.bubble; if (q && u && u.t < q.b && u.b > q.t && u.l < q.r && u.r > q.l) bad.push(w + 'x' + h + ' bubble over the ' + k + ' button'); });
      const n = await H(() => document.querySelectorAll('#fx-bubble [data-opt]').length);
      if (n !== 6) bad.push(w + 'x' + h + ' terminal options ' + n);
      await H(() => { window.TAAS_FACTORY2.openRobot(0); document.querySelector('[data-panel="prompt"]').click(); });
      await step(0.05);
      const pk = await H(() => { const q = document.getElementById('fx-pick').getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, vw: innerWidth, vh: innerHeight }; });
      if (pk.l < 0 || pk.r > pk.vw || pk.b > pk.vh || pk.t < 40) bad.push(w + 'x' + h + ' pick card off screen ' + JSON.stringify(pk));
      await H(() => document.querySelector('#fx-pick [data-pick="cancel"]').click());
    }
    ok(!bad.length, 'menu and reload in order, the terminal\'s bubble (buy, a stored robot to call up, three to send down, the configurations) and the pick card on screen at 320, 390, landscape and desktop', bad.join('; '));
    await page.setViewportSize({ width: 390, height: 844 });
  });

  /* ---------- 9. saves, Info, Prices ---------- */
  await section('9. saves', async () => {
    await fresh(9);
    await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.money = 3; FACTORY2.buyRobot(s); for (let i = 0; i < 200; i++) T.tick(1 / 60); FACTORY2.setPrompt(s, 0, 'bin', 'stall0'); FACTORY2.setLine(s, 0, 0, ['carry', '2', 'things', 'atime']); FACTORY2.rename(s, 0, 'Hauler'); localStorage.setItem('taas.factory.v' + 3, '{"keep":1}'); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on);
    const b = await H(() => { const r = window.TAAS_FACTORY2.s.robots[0]; return { name: r && r.name, dst: r && r.dst, lines: r && r.lines.length, v1: localStorage.getItem('taas.factory.v3') }; });
    ok(b.name === 'Hauler' && b.dst === 'stall0' && b.lines === 1 && b.v1 === '{"keep":1}', 'a reload keeps the factory (a robot, its name, prompt and line) in its own save, leaving the first factory\'s alone', JSON.stringify(b));
    await page.tap('#menu-btn'); await page.tap('[data-menu="info"]'); await step(0.05);
    const info = await H(() => document.getElementById('fx-panel-body').textContent);
    ok(/Robot factory v2/.test(info) && /Only take, Never take, Recycle, Wait, Carry, Stop at/.test(info) && /Order matters/.test(info) && /mean nothing/.test(info) && /dump truck/.test(info), 'Info from the menu says how v2 works: the truck, the auto machines, the main prompt, the four word lists, order, and nonsense');
    await page.tap('[data-panel="close"]');
    await page.tap('#menu-btn');
    const shown = await H(() => !document.getElementById('menu-prices').hidden && document.getElementById('price-robot').textContent);
    await page.tap('[data-price="robot"][data-by="1"]');
    const after = await H(() => ({ txt: document.getElementById('price-robot').textContent, flat: window.TAAS_FACTORY2.s.flat.robot }));
    ok(shown === '$1' && after.txt === '$2' && after.flat === 2, 'the menu\'s Prices set what a robot costs here', JSON.stringify([shown, after]));
  });

  /* ---------- 10. configurations at the terminal (the CD, 2026-10-27: "save/load/delete a configuration
     for the current set of active robots ... Deleting a config requires an extra dialog where i have to
     type in I am sure then click a proceed btn") ---------- */
  const atTerminal = () => H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.avatar.x = 0.61; s.avatar.y = 16.15; s.avatar.path = []; s.avatar.task = { kind: 'terminal', arrived: true, spot: FACTORY2.LAYOUT.SPOT.terminal }; s.bubble = { kind: 'terminal' }; T.view.camY = T.view.maxY; T.tick(0); });
  const cfgList = () => H(() => [...document.querySelectorAll('.fx-cfs li')].map(li => ({ name: li.querySelector('b').textContent, text: li.textContent, load: !li.querySelector('[data-panel^="cf-load"]').disabled })));
  await section('10. configurations', async () => {
    await fresh(10, 'open');
    await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.money = 2; FACTORY2.buyRobot(s); FACTORY2.buyRobot(s); for (let i = 0; i < 300; i++) T.tick(1 / 60);
      FACTORY2.rename(s, 0, 'Hauler'); FACTORY2.setPrompt(s, 0, 'raw', 'planerIn'); FACTORY2.setLine(s, 0, 0, ['recycle', 'any', 'slogs', 'none']); FACTORY2.setLine(s, 0, 1, ['wait', '10', 'seconds', 'trips']);
      FACTORY2.rename(s, 1, 'Seller'); FACTORY2.setPrompt(s, 1, 'bin', 'stall0'); });
    await atTerminal(); await step(0.1);
    await page.tap('#fx-bubble [data-opt="configs"]'); await step(0.05);
    const p0 = await H(() => ({ open: !document.getElementById('fx-panel').hidden, h: (document.querySelector('#fx-panel-body h2') || {}).textContent, count: (document.querySelector('[data-cf="count"]') || {}).textContent, name: (document.getElementById('fx-cf-name') || {}).value, save: !(document.querySelector('[data-panel="cf-save"]') || { disabled: true }).disabled, bubble: document.getElementById('fx-bubble').hidden }));
    ok(p0.open && p0.h === 'Configurations' && p0.count === '2 robots' && p0.name === 'Setup 1' && p0.save && p0.bubble, 'Configs at the terminal opens its page: the robots on the floor to save, under a name to change', JSON.stringify(p0));
    await page.tap('[data-panel="cf-save"]'); await step(0.05);
    await page.fill('#fx-cf-name', 'Haul crew'); await page.tap('[data-panel="cf-save"]'); await step(0.05);
    const l1 = await cfgList(), st1 = await H(() => JSON.parse(localStorage.getItem(window.TAAS_FACTORY2.CFG_KEY) || '[]'));
    ok(l1.length === 2 && l1[0].name === 'Haul crew' && l1[1].name === 'Setup 1' && /2 robots: Hauler, Seller/.test(l1[0].text) && st1.length === 2 && st1[0].robots[0].lines.length === 2, 'Save keeps them, newest first, in this browser: each with its robots by name', JSON.stringify(l1.map(x => x.name)));
    ok(await H(() => document.getElementById('fx-cf-name').value) === 'Setup 3', 'and the name box offers the next name');
    // the robots changed, then the configuration loaded back
    await H(() => { const s = window.TAAS_FACTORY2.s; FACTORY2.removeLine(s, 0, 0); FACTORY2.removeLine(s, 0, 0); FACTORY2.setPrompt(s, 0, null, null); FACTORY2.rename(s, 1, 'Renamed'); });
    await step(0.05);
    await page.tap('[data-panel="cf-load:0"]'); await step(0.05);
    const ld = await H(() => { const s = window.TAAS_FACTORY2.s; return { open: !document.getElementById('fx-panel').hidden, a: s.robots[0].name + ':' + s.robots[0].src + ':' + s.robots[0].lines.length, b: s.robots[1].name + ':' + s.robots[1].dst }; });
    ok(!ld.open && ld.a === 'Hauler:raw:2' && ld.b === 'Seller:stall0', 'Load puts them back (names, prompts, lines) and closes the page to show the floor', JSON.stringify(ld));
    // a new game: the configurations are still there; one that needs robots says what it costs
    await H(() => { const T = window.TAAS_FACTORY2; T.s = FACTORY2.newGame(11); T.s.shop.next = 1e9; T.s.goal = FACTORY2.CFG.goals.length; T.tick(0); });
    await atTerminal(); await step(0.1);
    await page.tap('#fx-bubble [data-opt="configs"]'); await step(0.05);
    const l2 = await cfgList();
    ok(l2.length === 2 && !l2[0].load && /buys 2 robots, \$2: not enough money/.test(l2[0].text), 'in a new game they are still there; one that needs robots says it buys 2 for $2, and with no money it cannot load', JSON.stringify(l2[0]));
    await H(() => { window.TAAS_FACTORY2.s.money = 2; }); await step(0.05);
    const l3 = await cfgList();
    ok(l3[0].load && !/not enough/.test(l3[0].text), 'with the money, Load is offered', JSON.stringify(l3[0]));
    await page.tap('[data-panel="cf-load:0"]'); await step(0.05);
    const nb = await H(() => window.TAAS_FACTORY2.s.robots.map(r => r.name + ':' + r.where).join());
    ok(nb === 'Hauler:up,Seller:queued', 'and loading buys them, and up they come', nb);
    // deleting asks for "I am sure", then Proceed
    await H(() => window.TAAS_FACTORY2.openConfigs()); await step(0.05);
    await page.tap('[data-panel="cf-del:1"]'); await step(0.05);
    const d0 = await H(() => ({ dlg: !document.getElementById('fx-confirm').hidden, h: document.getElementById('fx-confirm-h').textContent, go: document.querySelector('[data-dlg="proceed"]').disabled, focus: document.activeElement && document.activeElement.id }));
    ok(d0.dlg && d0.h === 'Delete "Setup 1"?' && d0.go && d0.focus === 'fx-confirm-in', 'Delete opens a dialog naming it, Proceed off and the typing box ready', JSON.stringify(d0));
    await page.type('#fx-confirm-in', 'I am');
    const d1 = await H(() => document.querySelector('[data-dlg="proceed"]').disabled);
    await page.type('#fx-confirm-in', ' sure');
    const d2 = await H(() => document.querySelector('[data-dlg="proceed"]').disabled);
    ok(d1 && !d2, 'Proceed comes on only once "I am sure" is typed in full', JSON.stringify([d1, d2]));
    await page.tap('[data-dlg="cancel"]'); await step(0.05);
    const d3 = await H(() => ({ dlg: document.getElementById('fx-confirm').hidden, n: window.TAAS_FACTORY2.configs.length }));
    ok(d3.dlg && d3.n === 2, 'Cancel deletes nothing', JSON.stringify(d3));
    await page.tap('[data-panel="cf-del:1"]'); await step(0.05);
    ok(await H(() => document.getElementById('fx-confirm-in').value) === '', 'and asks again from an empty box');
    await page.type('#fx-confirm-in', 'i am sure ');
    await page.tap('[data-dlg="proceed"]'); await step(0.05);
    const d4 = await H(() => ({ dlg: document.getElementById('fx-confirm').hidden, names: [...document.querySelectorAll('.fx-cfs li b')].map(b => b.textContent).join(), stored: JSON.parse(localStorage.getItem(window.TAAS_FACTORY2.CFG_KEY)).map(c => c.name).join() }));
    ok(d4.dlg && d4.names === 'Haul crew' && d4.stored === 'Haul crew', 'Proceed deletes it, from the page and from storage', JSON.stringify(d4));
    // the dialog and the page fit a small phone
    await page.setViewportSize({ width: 320, height: 640 }); await step(0.05);
    await page.tap('[data-panel="cf-del:0"]'); await step(0.05);
    const fit = await H(() => { const g = sel => { const q = document.querySelector(sel).getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight; }; return { dlg: g('.fx-dlg'), go: g('[data-dlg="proceed"]'), save: g('[data-panel="cf-save"]') }; });
    ok(fit.dlg && fit.go && fit.save, 'the page and the dialog fit a 320 px phone', JSON.stringify(fit));
    await page.tap('[data-dlg="cancel"]'); await page.tap('[data-panel="close"]');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  /* ---------- 11. the recycle bin's Destroy all (the CD, 2026-10-27) ---------- */
  await section('11. destroy', async () => {
    await fresh(11);
    await H(() => { window.TAAS_FACTORY2.s.recycle = ['log.m', 'plank.s', 'plank.s']; });
    await look(5.2);
    const c = centre(await rectOf('recycle'));
    await tap(c[0], c[1]);
    await stepUntil("s => FACTORY2.bubbleOpen(s) && FACTORY2.bubbleOpen(s).kind === 'recycle'", 30);
    await step(0.1);
    const b = await H(() => { const d = document.querySelector('#fx-bubble [data-opt="destroy"]'), q = d && d.getBoundingClientRect(), bb = document.getElementById('fx-bubble').getBoundingClientRect(); return d && { label: d.textContent, aria: d.getAttribute('aria-label'), off: d.disabled, wide: q.width > bb.width * 0.6, last: d.closest('.fx-brow') === document.querySelector('#fx-bubble').lastElementChild }; });
    ok(b && b.label === 'Destroy all' && !b.off && b.wide && b.last && /3 things/.test(b.aria), 'the recycle bin\'s bubble has Destroy all across its foot', JSON.stringify(b));
    await page.tap('#fx-bubble [data-opt="destroy"]'); await step(0.05);
    const a = await H(() => ({ n: window.TAAS_FACTORY2.s.recycle.length, off: document.querySelector('#fx-bubble [data-opt="destroy"]').disabled, inv: window.TAAS_FACTORY2.s.avatar.inv.length }));
    ok(a.n === 0 && a.off && a.inv === 0, 'one tap destroys everything in it; then there is nothing to destroy', JSON.stringify(a));
  });

  /* ---------- 12. Done keeps a half-built line, a word not chosen left blank (the CD, 2026-10-27) ---------- */
  await section('12. blanks', async () => {
    await fresh(12);
    await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.money = 1; FACTORY2.buyRobot(s); for (let i = 0; i < 300; i++) T.tick(1 / 60); T.openRobot(0); });
    await step(0.05);
    await page.tap('[data-panel="edit:0"]'); await step(0.02);
    await page.tap('[data-panel="word:only"]'); await step(0.02);
    await page.tap('[data-panel="pos:2"]'); await step(0.02);
    await page.tap('[data-panel="word:planks"]'); await step(0.02);
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines.length)) === 0, 'two words of four: nothing kept yet');
    await page.tap('[data-panel="sb-done"]'); await step(0.05);
    const a = await H(() => ({ lines: window.TAAS_FACTORY2.s.robots[0].lines, text: (document.querySelector('[data-panel="edit:0"]') || {}).textContent, slip: document.querySelector('[data-part="lines"] .fx-h span:last-child').textContent, page: window.TAAS_FACTORY2.page }));
    ok(JSON.stringify(a.lines) === '[["only","_","planks","none"]]' && a.text === 'Only take planks' && /5%/.test(a.slip) && a.page.line === -1, 'Done keeps it as it is: "Only take planks", the size left blank (any size, so it means something)', JSON.stringify(a));
    await page.tap('[data-panel="edit:1"]'); await step(0.02);
    await page.tap('[data-panel="word:carry"]'); await step(0.02);
    await page.tap('[data-panel="edit:0"]'); await step(0.02);   // to another line: the half-built one is kept too
    const b = await H(() => ({ lines: window.TAAS_FACTORY2.s.robots[0].lines.map(l => l.join(' ')), chips: [...document.querySelectorAll('.fx-sb-words .fx-chip')].map(c => c.textContent + (c.classList.contains('blank') ? '(blank)' : '')).join('|'), slip: document.querySelector('[data-part="lines"] .fx-h span:last-child').textContent }));
    ok(b.lines.join() === 'only _ planks none,carry _ _ none' && /10%/.test(b.slip), 'a line left for another is kept as it is too ("Carry", which means nothing: slips 10%)', JSON.stringify(b));
    const list = await H(() => [...document.querySelectorAll('.fx-sb-list [data-panel]')].map(x => x.textContent).slice(0, 4).join());
    ok(b.chips === 'Only take|Which(blank)|planks|(none)' && list === 'any,small,medium,large', 'and a kept line opens on its blank word, shown blank, to fill in', b.chips + ' / ' + list);
    await page.tap('[data-panel="word:medium"]'); await step(0.02);
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines[0].join(' '))) === 'only medium planks none', 'filling it in is kept at once');
    await page.tap('[data-panel="sb-done"]'); await step(0.02);
    await page.tap('[data-panel="edit:1"]'); await step(0.02);
    await page.tap('[data-panel="word:3"]'); await step(0.02);
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines[1].join(' '))) === 'carry 3 _ none', 'and so is one word of two blanks, the other still blank');
    await page.tap('[data-panel="sb-done"]'); await step(0.02);
    await page.tap('[data-panel="edit:2"]'); await step(0.02);
    await page.tap('[data-panel="sb-done"]'); await step(0.02);
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines.length)) === 2, 'Done with no word chosen adds nothing');
    await page.tap('[data-panel="edit:2"]'); await step(0.02);
    await page.tap('[data-panel="word:wait"]'); await step(0.02);
    await page.tap('[data-panel="close"]'); await step(0.02);
    ok((await H(() => window.TAAS_FACTORY2.s.robots[0].lines.length)) === 3, 'and closing the page keeps a half-built line as well');
  });

  /* ---------- 13. goal 4 on the wall (the CD, 2026-10-27) ---------- */
  await section('13. goal 4', async () => {
    await fresh(13);
    await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.goal = 3; s.goalT = 600; T.tick(1 / 60); });
    const g0 = await H(() => document.getElementById('fx-score').textContent);
    ok(/Goal: Sell sap \+ S, M & L planks at once, >90% for 10 minutes\./.test(g0), 'the wall shows goal 4 once the first three are met', g0);
    await H(() => { const T = window.TAAS_FACTORY2, s = T.s; s.stalls.forEach((st, i) => { st.bought = true; st.want = ['sap', 'plank.s', 'plank.m', 'plank.l'][i]; }); });
    await step(2);
    const g1 = await H(() => document.getElementById('fx-score').textContent);
    ok(/at once, >90% for 9:5\d\./.test(g1), 'with all four on sale it counts down', g1);
    await H(() => { const s = window.TAAS_FACTORY2.s; s.goalT = 0.05; });
    await step(0.2);
    const g2 = await H(() => ({ text: document.getElementById('fx-score').textContent, goal: window.TAAS_FACTORY2.s.goal }));
    ok(g2.goal === 4 && /All goals met/.test(g2.text), 'met: every goal is met', JSON.stringify(g2));
    await H(() => window.TAAS_FACTORY2.showInfo()); await step(0.02);
    const info = await H(() => [...document.querySelectorAll('.fx-goals li')].map(li => li.textContent));
    ok(info.length === 4 && /at the same time/.test(info[3]) && /No reward yet/.test(info[3]) && /arrives in slot 04/.test(info[2]), 'Info lists the four goals, the fourth with no reward yet', info[3]);
    const txt = await H(() => document.getElementById('fx-panel-body').textContent);
    ok(/configurations/.test(txt) && /destroy/.test(txt) && /Done keeps a line as it is/.test(txt) && /33% are small, 33% medium and 33% large/.test(txt) && /under Version in the menu/.test(txt), 'and says how the configurations, Destroy all and a blank word work, and that logs come in every size alike');
    await page.tap('[data-panel="close"]');
  });

  ok(!errors.length, 'no errors on the page', errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-FACTORY2-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
