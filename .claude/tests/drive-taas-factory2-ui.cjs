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

  /* ---------- 1. the page and the mode dropdown on both pages ---------- */
  await section('1. mode', async () => {
    await page.goto(ORIGIN + '/blank'); await H(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on);
    const a = await H(() => ({ label: document.getElementById('mode-btn').selectedOptions[0].textContent, opts: [...document.getElementById('mode-btn').options].map(o => o.value).join(), stored: localStorage.getItem('taas-mode'), mode: document.documentElement.dataset.mode }));
    ok(a.label === 'Robot factory v2' && a.opts === 'formal,robot-factory,robot-factory-v2' && a.stored === 'robot-factory-v2' && a.mode === 'robot-factory-v2', 'the v2 page: its dropdown names it and lists all three modes, and keeps it as the last choice', JSON.stringify(a));
    await page.selectOption('#mode-btn', 'robot-factory');
    await page.waitForFunction(() => location.pathname === '/taas/index.html' && window.TAAS_FACTORY && window.TAAS_FACTORY.on, null, { timeout: 4000 }).catch(() => {});
    const b = await H(() => ({ path: location.pathname, mode: document.documentElement.dataset.mode, stored: localStorage.getItem('taas-mode') }));
    ok(b.path === '/taas/index.html' && b.mode === 'robot-factory' && b.stored === 'robot-factory', 'choosing Robot factory goes to the first page, in its factory', JSON.stringify(b));
    await page.selectOption('#mode-btn', 'robot-factory-v2').catch(() => {});
    await page.waitForFunction(() => location.pathname === '/taas/factory-v2.html' && window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on, null, { timeout: 4000 }).catch(() => {});
    ok(await H(() => location.pathname) === '/taas/factory-v2.html', 'and choosing Robot factory v2 there comes back here');
    await page.goto(V1URL, { waitUntil: 'load' });
    await page.waitForFunction(() => location.pathname === '/taas/factory-v2.html' && window.TAAS_FACTORY2 && window.TAAS_FACTORY2.on);
    ok(true, 'the first page opened with v2 the last choice goes straight to v2 (the games list\'s link opens what was played last)');
    await page.goto(V1URL + '?mode=formal', { waitUntil: 'load' });
    ok(await H(() => document.documentElement.dataset.mode) === 'formal' && await H(() => location.pathname) === '/taas/index.html', 'a ?mode= on the first page still wins');
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
    ok(b.opts.join() === 'buy:$1' && b.signs === '+', 'the terminal\'s bubble: a robot for $1, on the + row', JSON.stringify(b));
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
      const r = await H(() => { const g = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; }; return { vw: innerWidth, vh: innerHeight, menu: g('menu-btn'), mode: g('mode-btn'), reload: g('reload-btn'), bubble: g('fx-bubble') }; });
      ['menu', 'mode', 'reload', 'bubble'].forEach(k => { const q = r[k]; if (!q) bad.push(w + 'x' + h + ' ' + k + ' missing'); else if (q.l < 0 || q.t < 0 || q.r > r.vw || q.b > r.vh) bad.push(w + 'x' + h + ' ' + k + ' off screen'); });
      if (r.menu && r.mode && r.reload && !(r.menu.r <= r.mode.l && r.mode.r <= r.reload.l)) bad.push(w + 'x' + h + ' chrome order');
      if (r.bubble && r.mode && r.bubble.t < r.mode.b && r.bubble.l < r.mode.r && r.bubble.r > r.mode.l) bad.push(w + 'x' + h + ' bubble over the mode button');
      const n = await H(() => document.querySelectorAll('#fx-bubble [data-opt]').length);
      if (n !== 5) bad.push(w + 'x' + h + ' terminal options ' + n);
      await H(() => { window.TAAS_FACTORY2.openRobot(0); document.querySelector('[data-panel="prompt"]').click(); });
      await step(0.05);
      const pk = await H(() => { const q = document.getElementById('fx-pick').getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, vw: innerWidth, vh: innerHeight }; });
      if (pk.l < 0 || pk.r > pk.vw || pk.b > pk.vh || pk.t < 40) bad.push(w + 'x' + h + ' pick card off screen ' + JSON.stringify(pk));
      await H(() => document.querySelector('#fx-pick [data-pick="cancel"]').click());
    }
    ok(!bad.length, 'menu, mode and reload in order, the terminal\'s bubble (buy, a stored robot to call up, three to send down) and the pick card on screen at 320, 390, landscape and desktop', bad.join('; '));
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

  ok(!errors.length, 'no errors on the page', errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-FACTORY2-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
