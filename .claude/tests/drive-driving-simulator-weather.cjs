/**
 * Driving Simulator weather drive suite (DS-8, dsweather).
 *
 * The weather's rows live here, beside the main suite (`drive-driving-simulator.cjs`), because that one already takes about
 * 7.5 minutes and one gate call cannot run for more than 10. The boot is the main suite's own, copied verbatim (launch
 * arguments, the context, the `__DS` waits, `ok()`, the summary line, the exit code), and so is its Clear pin: every page
 * starts under a fixed Clear unless a row saves a weather of its own (the pin writes `weather: 'clear'` only where no
 * `weather` key is stored). The simulation is stepped through `__DS.tick(dt)` with the live loop paused.
 *
 *   .claude/scripts/gates.sh games/driving-simulator/index.html
 *
 * Exits 0/1 and prints "DRIVING SIMULATOR WEATHER DRIVE: N passed, M failed" last; with DS_PAGE set (a copy under test) the
 * line ends " (copy)". Needs Chromium; launches with SwiftShader so WebGL2 exists without a GPU.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const COPY = !!process.env.DS_PAGE;
const PAGE = 'file://' + (process.env.DS_PAGE || path.join(process.cwd(), 'games', 'driving-simulator', 'index.html'));
const TAIL = COPY ? ' (copy)' : '';
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } }

const MJD = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 40587;
const MAY5 = MJD(2026, 5, 5);
const SET_KEY = 'drivingSimulator.settings.v1';
// The Clear pin, in every context's setup: a page with no `weather` stored boots under a fixed Clear (the shipped sky), so a
// row that wants a weather sets it and puts Clear back. A context without it (ctxN below) is a fresh visitor's.
const CLEAR_PIN = () => { try { const k = 'drivingSimulator.settings.v1', s = JSON.parse(localStorage.getItem(k) || '{}') || {};
  if (!('weather' in s)) { s.weather = 'clear'; localStorage.setItem(k, JSON.stringify(s)); } } catch (e) { /* private mode */ } };

// WX_BEFORE: Clear's frames on the page before any weather (9bbb754, recorded 2026-11-04 by this suite's own __wxFrames, run
// twice in one page and again in a second browser, every hash equal): [mean 8-bit luminance, FNV-1a of the RGBA bytes] for the
// road at 13:00 on May 5 at teleport(400) in the chase view and the cockpit, the sky at 22:00 aimed 32 deg up in azimuth 200
// (the main suite's night22 aim, stars on), the sky at 17:00 aimed at the sun, and a town street at 21:00 (the first town2
// section past 1 km that is over 600 m long, 300 m in; streetlights and headlights). Read by step 2's "Clear is as shipped".
const WX_BEFORE = { road13chase: [145.046, '876f56aa'], road13cockpit: [80.334, '76960555'], night22: [22.219, 'a3451048'], sun17: [193.471, '6379ab21'], town21: [62.294, 'c2c34651'] };
// TRAFFIC_BEFORE: every car's [id, s, lane, v] after 60 s of tick(1/60) from __wxPlace(3000) at 13:00 on May 5 with the day at
// 2.4 minutes, on the same page and the same day (the same twice, and the same from June 14 at 09:00: the base page's traffic
// never reads the date)
const TRAFFIC_BEFORE = [[1, 2992.3123, 0, 0], [22, 2983.4432, 0, 0], [24, 2978.6596, 1, 3.3365], [29, 4075.9994, 1, 19.1516], [30, 2970.0851, 0, 2.0764],
  [32, 2628.257, 1, 25.5252], [34, 4016.7493, 1, 18.9929], [35, 3572.0656, 2, 29.1195], [36, 2590.6444, 0, 28.0924], [37, 3969.0756, 0, 22.7732],
  [38, 2684.9016, 1, 25.1122], [39, 2959.9981, 0, 0.8504], [41, 2677.5173, 0, 29.3971], [42, 2737.9716, 1, 25.1299], [43, 3029.7399, 2, 14.6427],
  [44, 2778.3623, 0, 28.3022], [45, 2794.2112, 1, 25.5412], [46, 3877.8399, 1, 26.1249], [47, 2842.5657, 0, 28.1209], [49, 2880.051, 1, 28.2239],
  [51, 3505.1353, 1, 27.6034], [52, 2951.7674, 0, 0.1143], [53, 3132.2053, 2, 28.814], [54, 3479.8848, 2, 27.9987], [55, 3227.6846, 2, 27.8732],
  [56, 3382.9296, 2, 27.4014], [57, 3411.6525, 2, 28.9909], [58, 2999.8791, 2, 13.0613], [59, 3593.5966, 2, 27.2721], [60, 3670.3466, 0, 28.3472],
  [62, 3833.0866, 2, 26.6475], [63, 3854.094, 0, 25.6775], [64, 2824.524, 1, 22.7986], [65, 3941.8554, 1, 22.9805], [66, 2708.9527, 1, 27.288],
  [67, 3998.5304, 1, 20.1416], [68, 2646.0846, 1, 26.3067], [69, 4043.9736, 0, 19.2795]];
// The chosen weights (the plan's Design, typed here, never read from the page): the share of the look's days with a spell of each kind
const WEIGHTS = { spring: { rain: 0.30, fog: 0.10, snow: 0 }, summer: { rain: 0.35, fog: 0.05, snow: 0 }, autumn: { rain: 0.25, fog: 0.15, snow: 0 }, winter: { rain: 0.25, fog: 0.10, snow: 0.15 } };

// the in-page helpers: __dsPx and __dsAimed copied from the main suite's section 8b, then this suite's own aims
const install = p => p.evaluate(() => {
  const W = window;
  W.__dsPx = () => { const c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); return { w, h, px, L: (x, y) => { const i = (y * w + x) * 4; return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; } }; };
  W.__dsAimed = (aimW, offAz, dirsW, fovArg) => {
    const D = W.__DS, c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height;
    const az = Math.atan2(aimW[0], aimW[2]) + offAz * Math.PI / 180, el = Math.asin(aimW[1]), fov = fovArg || 0.8, up = [0, 1, 0];
    const f = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    renderScene([D.PLAYER.x, D.PLAYER.y + 30, D.PLAYER.z], f, up, fov, 0.2, w, h, { propDist: 560, shadows: false, hidePlayer: false }, []);
    const F = W.__dsPx();
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const s0 = cr(f, up), sl = Math.hypot(...s0), sv = s0.map(v => v / sl), u = cr(sv, f), t = Math.tan(fov / 2);
    F.at = (dirsW || []).map(d => ({ x: (dt(d, sv) / dt(d, f) / (t * w / h) * 0.5 + 0.5) * w - 0.5, y: (dt(d, u) / dt(d, f) / t * 0.5 + 0.5) * h - 0.5 }));
    F.dir = (x, y) => { const xn = ((x + 0.5) / w * 2 - 1) * t * w / h, yn = ((y + 0.5) / h * 2 - 1) * t, d = [0, 1, 2].map(i => f[i] + xn * sv[i] + yn * u[i]), l = Math.hypot(...d); return d.map(v => v / l); };
    F.fov = fov; F.pxPerRad = h / 2 / t;
    return F;
  };
  // __wxPlace(s): the traffic's dice and ids put back to the boot's (TRAFFIC.rnd is rngFor('traffic')), the input and the car's
  // motion zeroed, the car teleported to s, and the loaded chunks rebuilt in a fixed order (applySeason of the current look), so a
  // frame with cars and chunks in it is the same frame wherever in a run it is taken
  W.__wxPlace = s => { const D = W.__DS, I = D.INPUT;
    D.TRAFFIC.rnd = mulberry32(hashSeed(WORLD_SEED, 'traffic')); D.TRAFFIC.nextId = 1;
    D.setCruise(false); Object.assign(I, { gasTarget: 0, brakeTarget: 0, gas: 0, brake: 0, steer: 0, keySteer: 0, keyGas: 0, keyBrake: 0, wheelAngle: 0, wheelHeld: false });
    Object.assign(D.PLAYER, { steer: 0, gear: 1, rpm: 800, gi: 0, pitch: 0, roll: 0, vp: 0, vr: 0, vpV: 0, vrV: 0, spin: 0, ax: 0, ay: 0, off: 0, shake: 0, revHold: 0, slip: 0, lastHit: 0 });
    D.teleport(s); D.applySeason(D.lookSeason); D.CAM.look = 0; D.CAM.lookP = 0; D.CAM.chase = null; };
  W.__wxTown = () => { const D = W.__DS; D.sectionAt(60000); const sc = D.ROAD.sect.find(q => q.cls === 'town2' && q.s1 - q.s0 > 600 && q.s0 > 1000); return sc ? sc.s0 + 300 : null; };
  W.__wxFnv = px => { let h = 0x811c9dc5; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
  W.__wxStat = F => { let s = 0; for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) s += F.L(x, y); return [+(s / (F.w * F.h)).toFixed(3), W.__wxFnv(F.px)]; };
  // the page's own frame (updateCamera + renderFrame) in a view: 1 chase, 0 cockpit (gauges drawn, the mirror drawn this frame)
  W.__wxView = mode => { const D = W.__DS, keep = now; now = 100; D.CAM.mode = mode; D.CAM.chase = null; frameNo = 0;
    if (mode === 0) drawGauges(); updateCamera(0); renderFrame(); now = keep; return W.__dsPx(); };
  // WX_BEFORE's five frames, { key: [mean luminance, fnv-1a] }; leaves the car at 400 m, 13:00 on May 5
  W.__wxFrames = MAY5 => { const D = W.__DS, DR = Math.PI / 180, out = {}, mode = D.CAM.mode, cyc = D.SETTINGS.cycle;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    D.SETTINGS.cycle = 0; D.STARS.on = true;
    D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    out.road13chase = W.__wxStat(W.__wxView(1));
    out.road13cockpit = W.__wxStat(W.__wxView(0));
    D.SKY.hour = 22; D.setDate(MAY5); { const keep = now; now = 100; out.night22 = W.__wxStat(W.__dsAimed(D.enuToWorld(enu(32, 200)), 0)); now = keep; }
    D.SKY.hour = 17; D.setDate(MAY5); { const v = D.SKY.sun, az = Math.atan2(v[0], v[2]) / DR, alt = Math.max(Math.asin(v[1]) / DR, 32), keep = now; now = 100;
      out.sun17 = W.__wxStat(W.__dsAimed(D.enuToWorld(enu(alt, az)), 0)); now = keep; }
    const ts = W.__wxTown(); D.SKY.hour = 21; D.setDate(MAY5); W.__wxPlace(ts);
    out.town21 = W.__wxStat(W.__wxView(1));
    D.CAM.mode = mode; D.CAM.chase = null; D.SETTINGS.cycle = cyc; D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return out; };
  // TRAFFIC_BEFORE's trace: from __wxPlace(3000) at a date and hour with the day at 2.4 minutes, 60 s of tick(1/60); every car [id, s, lane, v]
  W.__wxTraffic = (mjd, hour, MAY5) => { const D = W.__DS, cyc = D.SETTINGS.cycle;
    D.SETTINGS.cycle = 144; D.SKY.hour = hour; D.setDate(mjd); W.__wxPlace(3000);
    for (let i = 0; i < 3600; i++) D.tick(1 / 60);
    const cars = D.TRAFFIC.cars.map(c => [c.id, +c.s.toFixed(4), c.lane, +c.v.toFixed(4)]);
    D.SETTINGS.cycle = cyc; D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return cars; };
  // Auto's weather sampled hourly over a run of dates under the current look: [mjd, hour, kind, intensity] for every hour
  W.__wxHours = (m0, m1) => { const D = W.__DS, out = []; for (let m = m0; m <= m1; m++) for (let h = 0; h < 24; h++) { const w = D.wxAt(m, h); out.push([m, h, w.kind, w.intensity]); } return out; };
});

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript(CLEAR_PIN);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 });
  await page.evaluate(() => window.__DS.setPaused(true));
  await install(page);
  const boot = await page.evaluate(() => ({ weather: window.__DS.SETTINGS.weather, kind: window.__DS.WX.kind }));

  // ---- 3e. the weather's state, its timeline and the dropdown (DS-8, dsweather step 1) ----
  // A page in a context: booted, paused, `fn(arg)` evaluated, closed
  const visitIn = async (c, fn, arg) => { const p = await c.newPage(); p.on('pageerror', e => errors.push('visit: ' + String(e)));
    await p.goto(PAGE); await p.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 });
    await p.evaluate(() => window.__DS.setPaused(true));
    const r = await p.evaluate(fn, arg); await p.close(); return r; };
  // row: the dropdown. A Weather row straight after Season in TIME listing Auto, Clear, Rain, Fog, Snow; Auto on a fresh page (a
  // context with no pin and nothing stored); a stored 'hail' and an old save with no weather key both read Auto; each pick chosen
  // on #weather-sel saved and back after a reload (Snow in winter); the row fitting at 320 px wide.
  const dd = await page.evaluate(() => { const el = document.getElementById('weather-sel'), sr = document.getElementById('season-sel').closest('.row');
    let r = sr; while (r && r.tagName !== 'H3') r = r.previousElementSibling;
    const row = el && el.closest('.row'), lab = row && row.querySelector('label');
    return { exists: !!el, afterSeason: !!row && sr.nextElementSibling === row, section: r && r.textContent, label: lab && lab.textContent, for: lab && lab.htmlFor === 'weather-sel',
      opts: el ? [...el.options].map(o => [o.value, o.textContent]) : [] }; });
  const ctxN = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const readW = () => { const D = window.__DS; D.openSettings(); const v = document.getElementById('weather-sel').value; D.closeSettings();
    return { weather: D.SETTINGS.weather, mode: D.WX.mode, sel: v, stored: (JSON.parse(localStorage.getItem('drivingSimulator.settings.v1') || '{}') || {}).weather }; };
  const fresh = await visitIn(ctxN, readW);
  const hail = await visitIn(ctxN, () => { const k = 'drivingSimulator.settings.v1', s = JSON.parse(localStorage.getItem(k) || '{}') || {}; s.weather = 'hail'; localStorage.setItem(k, JSON.stringify(s)); return true; });
  const hailBack = await visitIn(ctxN, readW);
  await visitIn(ctxN, () => { const k = 'drivingSimulator.settings.v1', s = JSON.parse(localStorage.getItem(k) || '{}') || {}; delete s.weather; localStorage.setItem(k, JSON.stringify(s)); return true; });
  const oldBack = await visitIn(ctxN, readW);
  await ctxN.close();
  // each pick on #weather-sel in a second page of the pinned context, then that page reloaded
  const pw = await ctx.newPage(); pw.on('pageerror', e => errors.push('picks: ' + String(e)));
  const bootPw = async () => { await pw.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 }); await pw.evaluate(() => window.__DS.setPaused(true)); };
  await pw.goto(PAGE); await bootPw();
  const picks = [];
  for (const v of ['rain', 'fog', 'snow', 'auto', 'clear']) {
    const live = await pw.evaluate(v => { const D = window.__DS, el = document.getElementById('weather-sel');
      if (v === 'snow') D.setSeason('winter');
      el.value = v; el.dispatchEvent(new Event('change'));
      return { weather: D.SETTINGS.weather, kind: D.WX.kind, stored: (JSON.parse(localStorage.getItem('drivingSimulator.settings.v1') || '{}') || {}).weather }; }, v);
    await pw.reload(); await bootPw();
    const back = await pw.evaluate(readW);
    const look = await pw.evaluate(() => window.__DS.lookSeason);
    if (v === 'snow') await pw.evaluate(() => window.__DS.setSeason('spring'));
    picks.push({ v, live, back, look });
  }
  await pw.close();
  await page.evaluate(() => { try { localStorage.setItem('drivingSimulator.settings.v1', JSON.stringify(window.__DS.SETTINGS)); } catch (e) { /* */ } });
  // the row at 320 px wide, measured as the SKY rows are: label and select inside the panel, the label clear of the select, no sideways scroll
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const narrow = await page.evaluate(() => { const D = window.__DS; D.openSettings();
    const panel = document.querySelector('#settings .panel'), pr = panel.getBoundingClientRect(), el = document.getElementById('weather-sel'), lab = el.closest('.row').querySelector('label');
    const ir = el.getBoundingClientRect(), lr = lab.getBoundingClientRect();
    const o = { inside: lr.left >= pr.left - 0.5 && ir.right <= pr.right + 0.5 && ir.left >= pr.left - 0.5, clear: lr.right <= ir.left + 0.5, w: Math.round(ir.width),
      scroll: panel.scrollWidth - panel.clientWidth, docScroll: document.documentElement.scrollWidth - innerWidth, iw: innerWidth };
    D.closeSettings(); return o; });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const pk = Object.fromEntries(picks.map(p => [p.v, p]));
  ok('the dropdown: a Weather row straight after Season in TIME listing Auto, Clear, Rain, Fog and Snow; Auto on a fresh page; a stored "hail" and an old save with no weather both read Auto; Rain, Fog, Snow (in winter), Auto and Clear each chosen on #weather-sel are saved and back after a reload; the row fits at 320 px wide',
    dd.exists && dd.afterSeason && dd.section === 'TIME' && dd.label === 'Weather' && dd.for
    && JSON.stringify(dd.opts) === JSON.stringify([['auto', 'Auto'], ['clear', 'Clear'], ['rain', 'Rain'], ['fog', 'Fog'], ['snow', 'Snow']])
    && fresh.weather === 'auto' && fresh.mode === 'auto' && fresh.sel === 'auto' && hail && hailBack.weather === 'auto' && hailBack.sel === 'auto' && oldBack.weather === 'auto' && oldBack.sel === 'auto' && oldBack.stored === undefined
    && picks.length === 5 && picks.every(p => p.live.weather === p.v && p.live.stored === p.v && p.back.weather === p.v && p.back.stored === p.v && p.back.sel === p.v && p.back.mode === p.v)
    && ['rain', 'fog', 'snow'].every(v => pk[v].live.kind === v) && pk.clear.live.kind === 'clear' && pk.snow.look === 'winter'
    && narrow.inside && narrow.clear && narrow.w >= 80 && narrow.scroll <= 0 && narrow.docScroll <= 0 && narrow.iw === 320,
    { dd, fresh, hailBack, oldBack, picks, narrow });

  // row: snow is winter's. In spring, summer and autumn Snow is disabled, setWeather('snow') refuses and a change event on it
  // falls back; in winter it is offered and taken; leaving winter with Snow picked sets Auto (and saves it).
  const snowRow = await page.evaluate(MAY5 => { const D = window.__DS, el = document.getElementById('weather-sel'), sn = el.querySelector('option[value="snow"]'), o = { off: [] };
    const stored = () => (JSON.parse(localStorage.getItem('drivingSimulator.settings.v1') || '{}') || {}).weather;
    for (const s of ['spring', 'summer', 'autumn']) { D.setSeason(s); const ref = D.setWeather('snow');
      el.value = 'snow'; el.dispatchEvent(new Event('change'));
      o.off.push({ s, disabled: sn.disabled, ref, weather: D.SETTINGS.weather, sel: el.value, kind: D.WX.kind }); }
    D.setSeason('winter'); const snow0 = D.WX.snow; o.win = { snow0, disabled: sn.disabled, took: D.setWeather('snow'), weather: D.SETTINGS.weather, kind: D.WX.kind, snow: D.WX.snow };
    D.setSeason('spring'); o.left = { weather: D.SETTINGS.weather, sel: el.value, stored: stored(), disabled: sn.disabled, mode: D.WX.mode, snow: D.WX.snow };
    D.setWeather('clear'); D.SKY.hour = 13; D.setDate(MAY5);
    return o; }, MAY5);
  ok('snow is winter\'s: in spring, summer and autumn Snow is disabled, setWeather("snow") refuses and a change event on it falls back to the pick before; in winter it is offered and taken (a live pick keeping the cover where it was); leaving winter with Snow picked sets Auto, saved',
    snowRow.off.length === 3 && snowRow.off.every(r => r.disabled && r.ref === false && r.weather === 'clear' && r.sel === 'clear' && r.kind === 'clear')
    && !snowRow.win.disabled && snowRow.win.took === true && snowRow.win.weather === 'snow' && snowRow.win.kind === 'snow' && snowRow.win.snow === snowRow.win.snow0
    && snowRow.left.weather === 'auto' && snowRow.left.sel === 'auto' && snowRow.left.stored === 'auto' && snowRow.left.disabled && snowRow.left.mode === 'auto' && snowRow.left.snow === 0, snowRow);

  // row: Auto is the date's own weather. wxAt at 368 dates and hours through spring (four a day) answers the same after a reload and after a
  // teleport; with Auto on, the 60 s traffic trace (from a date whose Auto weather is clear through the trace's ten game hours, so
  // later steps that slow the traffic in the weather leave it alone) equals TRAFFIC_BEFORE; a seeded Math.random's next draw is
  // unchanged by 60 s of ticks through a rain spell, and the weather's functions, called directly through a rain spell, draw
  // nothing from TRAFFIC.rnd (counted through a stand-in that wraps it).
  const SAMPLE = Array.from({ length: 368 }, (_, i) => [MJD(2026, 3, 20) + (i >> 2), [6.5, 12.25, 15.5, 20.75][i & 3]]);
  const sampleIn = async p => p.evaluate(S => S.map(([m, h]) => { const w = window.__DS.wxAt(m, h); return [m, +h.toFixed(2), w.kind, +w.intensity.toFixed(6)]; }), SAMPLE);
  await page.evaluate(() => window.__DS.setWeather('auto'));
  const a1 = await sampleIn(page);
  const ap = await ctx.newPage(); ap.on('pageerror', e => errors.push('auto: ' + String(e)));
  await ap.goto(PAGE); await ap.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 });
  const a2 = await sampleIn(ap); await ap.close();
  await page.evaluate(() => window.__DS.teleport(5200));
  const a3 = await sampleIn(page);
  const auto = await page.evaluate(([MAY5, M0, M1]) => { const W = window, D = W.__DS, H = W.__wxHours(M0 - 1, M1), o = {};
    // a dry trace: a spring date whose Auto weather is clear from 12:00 to 24:00 (the trace runs 13:00 to 23:00), sampled hourly and at the half hours
    for (let m = M0 + 1; m <= M1 && o.dry === undefined; m++) { let dry = true; for (let h = 12; h < 24; h += 0.5) if (D.wxAt(m, h).kind !== 'clear') { dry = false; break; } if (dry) o.dry = m; }
    // a wet run: the first hour of a rain spell
    const rain = H.find((r, i) => i > 0 && r[2] === 'rain' && H[i - 1][2] !== 'rain' && r[1] < 14);
    o.rain = rain ? [rain[0], rain[1]] : null;
    return o; }, [MAY5, MJD(2026, 3, 20), MJD(2026, 6, 20)]);
  const trace = auto.dry ? await page.evaluate(([m, MAY5]) => { window.__DS.setWeather('auto'); return window.__wxTraffic(m, 13, MAY5); }, [auto.dry, MAY5]) : null;
  const streams = auto.rain ? await page.evaluate(([m, h, MAY5]) => { const W = window, D = W.__DS, o = {};
    // a seeded Math.random (the suite's own mulberry32): 60 s of ticks with the day at 24 s from an hour before the rain, then the next draw
    const gen = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const keepR = Math.random, cyc = D.SETTINGS.cycle; Math.random = gen(1234);
    let kinds = new Set();
    try { D.SETTINGS.cycle = 24; D.SKY.hour = Math.max(0, h - 1); D.setDate(m); W.__wxPlace(3000);
      for (let i = 0; i < 3600; i++) { D.tick(1 / 60); kinds.add(D.WX.kind); }
      o.next = Math.random(); } finally { Math.random = keepR; D.SETTINGS.cycle = cyc; }
    o.want = gen(1234)(); o.kinds = [...kinds];
    // TRAFFIC.rnd through a counting stand-in while the weather's functions run through the spell (no traffic is stepped here)
    const R = D.TRAFFIC.rnd; let n = 0;
    D.TRAFFIC.rnd = { next: () => { n++; return R.next(); }, range: (a, b) => { n++; return R.range(a, b); }, int: (a, b) => { n++; return R.int(a, b); }, pick: arr => { n++; return R.pick(arr); } };
    const mr = Math.random; let nm = 0; Math.random = () => { nm++; return mr(); };
    try { for (let k = 0; k < 48; k++) { const hh = h - 2 + k / 4; D.wxAt(m, hh); D.wxHistory(m, hh); D.SKY.hour = ((hh % 24) + 24) % 24; D.stepWeather(0.25); D.wxDerive(); }
      for (const v of ['rain', 'fog', 'clear', 'auto']) D.setWeather(v);
    } finally { D.TRAFFIC.rnd = R; Math.random = mr; }
    o.trafficDraws = n; o.randomDraws = nm;
    D.setWeather('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, [auto.rain[0], auto.rain[1], MAY5]) : null;
  const same12 = JSON.stringify(a1) === JSON.stringify(a2), same13 = JSON.stringify(a1) === JSON.stringify(a3), traceSame = JSON.stringify(trace) === JSON.stringify(TRAFFIC_BEFORE);
  ok('Auto is the date\'s own weather: wxAt at 368 spring dates and hours (four a day) is the same after a reload and after a teleport; with Auto on, the 60 s traffic trace equals TRAFFIC_BEFORE; a seeded Math.random\'s next draw is unchanged by 60 s of ticks through a rain spell, and the weather\'s functions draw nothing from TRAFFIC.rnd or Math.random',
    a1.length === 368 && a1.some(r => r[2] !== 'clear') && same12 && same13 && !!auto.dry && traceSame
    && !!streams && streams.kinds.includes('rain') && streams.next === streams.want && streams.trafficDraws === 0 && streams.randomDraws === 0,
    { same12, same13, dry: auto.dry, rain: auto.rain, traceSame, trace: traceSame ? 'equal' : (trace || []).slice(0, 4), streams, wet: a1.filter(r => r[2] !== 'clear').length });

  // row: Auto by season. Over each season's whole run of dates (SEASON_DATES), the look set by applySeason, the share of days on
  // which a rain, fog or snow spell starts (sampled hourly: a day counts a kind when one of its hours has it and the hour before
  // did not) is within 0.06 of the chosen weights; and no snow at any hour outside winter.
  const bySeason = await page.evaluate(([MAY5, SEAS]) => { const W = window, D = W.__DS, out = {};
    for (const s of SEAS) { D.applySeason(s); const [m0, m1] = D.SEASON_DATES[s], H = W.__wxHours(m0 - 1, m1), days = m1 - m0 + 1, n = { rain: 0, fog: 0, snow: 0 }, seen = {};
      for (let i = 24; i < H.length; i++) { const [m, , k] = H[i]; if (k !== 'clear' && H[i - 1][2] !== k && !seen[m + k]) { seen[m + k] = 1; n[k]++; } }
      out[s] = { look: D.lookSeason, days, share: { rain: +(n.rain / days).toFixed(3), fog: +(n.fog / days).toFixed(3), snow: +(n.snow / days).toFixed(3) },
        snowHours: H.filter(r => r[2] === 'snow').length }; }
    D.applySeason('spring'); D.SKY.hour = 13; D.setDate(MAY5);
    return out; }, [MAY5, Object.keys(WEIGHTS)]);
  console.log('  .. spell shares by season: ' + JSON.stringify(Object.fromEntries(Object.entries(bySeason).map(([k, v]) => [k, v.share]))));
  const seasonBad = Object.keys(WEIGHTS).flatMap(s => ['rain', 'fog', 'snow'].filter(k => !(bySeason[s] && Math.abs(bySeason[s].share[k] - WEIGHTS[s][k]) <= 0.06)).map(k => s + '.' + k));
  ok('Auto by season: over each season\'s run of dates (its look set by applySeason) the share of days on which a rain, fog or snow spell starts is within 0.06 of the chosen weights (spring 0.30/0.10, summer 0.35/0.05, autumn 0.25/0.15, winter 0.25/0.10/0.15), and no hour outside winter snows',
    seasonBad.length === 0 && ['spring', 'summer', 'autumn'].every(s => bySeason[s].snowHours === 0 && bySeason[s].look === s) && bySeason.winter.snowHours > 0 && bySeason.winter.look === 'winter',
    { bad: seasonBad, bySeason });

  // row: it gathers and fades. Auto, the day at 24 s (a tick of 1/60 s is a game minute), ticked through a spring rain spell that
  // ends by day (07:00-12:00): wet over 0.9 in it and under 0.2 five game hours after it stops; through a winter snow spell strong
  // enough to settle (peak intensity x hours over 5), each followed by hours without another (7 after the rain, 14 after the snow): snow over 0.9 and, 12 game hours after it stops, under 0.7 of its peak. And after a
  // jump of the time-of-day slider into the middle of each spell, the stepped wet and snow agree with wxHistory within 0.02 at ten
  // hours sampled over the next ten game hours.
  const gather = await page.evaluate(([MAY5, SP, WI]) => { const W = window, D = W.__DS, o = {}, cyc = D.SETTINGS.cycle;
    const runs = (H, kind) => { const out = []; for (let i = 1; i < H.length; i++) if (H[i][2] === kind && H[i - 1][2] !== kind) { let j = i, pk = 0; while (j < H.length && H[j][2] === kind) { pk = Math.max(pk, H[j][3]); j++; }
      let q = j; while (q < H.length && H[q][2] !== kind) q++;
      if (j < H.length) out.push({ m0: H[i][0], h0: H[i][1], m1: H[j][0], h1: H[j][1], hours: j - i, peak: pk, after: q - j }); } return out; };
    const tickH = hours => { const n = Math.round(hours * 60); for (let i = 0; i < n; i++) D.tick(1 / 60); };
    const slide = (m, h) => { D.setDate(m); const el = document.getElementById('tod'); el.value = String(Math.round(h * 60)); el.dispatchEvent(new Event('input')); };
    const agree = (key) => { const r = []; for (let k = 0; k < 10; k++) { tickH(1); const hs = D.wxHistory(D.SKY.mjd, D.SKY.hour); r.push(+Math.abs(D.WX[key] - hs[key]).toFixed(4)); } return r; };
    D.setWeather('auto'); D.SETTINGS.cycle = 24; W.__wxPlace(3000); D.TRAFFIC.cars.length = 0;
    try {
      // spring rain ending by day
      const R = runs(W.__wxHours(SP[0], SP[1]), 'rain').filter(r => r.h1 >= 7 && r.h1 <= 12 && r.m1 === r.m0 && r.h0 >= 2 && r.after >= 7);
      o.rainSpell = R[0] || null;
      if (R[0]) { const r = R[0]; D.SKY.hour = r.h0 - 2; D.setDate(r.m0); let peak = 0;
        while (D.WX.kind === 'rain' || D.SKY.hour < r.h0 + 0.5) { tickH(1 / 6); peak = Math.max(peak, D.WX.wet); if (D.SKY.hour > r.h1 + 1) break; }
        const stopH = D.SKY.hour; tickH(5); o.rain = { peak: +peak.toFixed(4), stopH: +stopH.toFixed(2), after5: +D.WX.wet.toFixed(4), dayAfter: +D.wxDayAt(D.SKY.mjd, D.SKY.hour).toFixed(3) };
        slide(r.m0, (r.h0 + r.h1) / 2); o.rainAgree = agree('wet'); }
      // winter snow, strong enough to settle
      D.setSeason('winter'); D.setWeather('auto'); D.SETTINGS.cycle = 24;
      const S = runs(W.__wxHours(WI[0], WI[1]), 'snow').filter(r => r.peak * r.hours > 5 && r.h0 >= 2 && r.after >= 14);
      o.snowSpell = S[0] || null;
      if (S[0]) { const r = S[0]; D.SKY.hour = r.h0 - 2; D.setDate(r.m0); let peak = 0, guard = 0;
        while ((D.WX.kind === 'snow' || guard < 3 * 6) && guard < 30 * 6) { tickH(1 / 6); peak = Math.max(peak, D.WX.snow); guard++; }
        const atStop = D.WX.snow; tickH(12); o.snow = { peak: +peak.toFixed(4), atStop: +atStop.toFixed(4), after12: +D.WX.snow.toFixed(4) };
        slide(r.m0, r.h0 + r.hours / 2); o.snowAgree = agree('snow'); o.snowWetAgree = agree('wet'); }
    } finally { D.SETTINGS.cycle = cyc; D.setSeason('spring'); D.setWeather('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); }
    return o; }, [MAY5, [MJD(2026, 3, 20), MJD(2026, 6, 20)], [MJD(2026, 12, 21), MJD(2027, 3, 19)]]);
  console.log('  .. gathers: ' + JSON.stringify({ rain: gather.rain, snow: gather.snow, agreeMax: [gather.rainAgree, gather.snowAgree, gather.snowWetAgree].map(a => a && Math.max(...a)) }));
  const maxA = a => a ? Math.max(...a) : 1;
  ok('it gathers and fades: through a spring rain spell wet rises over 0.9 and is under 0.2 five game hours after it stops by day; through a winter snow spell the cover rises over 0.9 and melts after; after a time-of-day jump into the middle of each spell the stepped state and wxHistory agree within 0.02 at ten hours',
    !!gather.rain && gather.rain.peak > 0.9 && gather.rain.after5 < 0.2 && gather.rain.dayAfter > 0.5
    && !!gather.snow && gather.snow.peak > 0.9 && gather.snow.after12 < 0.7 * gather.snow.peak
    && [gather.rainAgree, gather.snowAgree, gather.snowWetAgree].every(a => !!a && a.length === 10 && maxA(a) <= 0.02), gather);

  // ---- 3f. the grey sky, the fog, the light under cloud, headlights in weather (DS-8, dsweather step 2) ----
  // Step 2's helpers. __wxPick(kind, I): a fixed pick at intensity I (WX_FIXED's own when I is left out), through setWeather, so
  // the sky, the fog and the lamps read it as a player's pick; __wxPick('clear') puts WX_FIXED back. __dsContrast / __dsPeaks:
  // the main suite's star-pixel method (section 8b), copied. __wxRoad(s, fog): a camera 3 m over the right lane at s aimed down
  // the road (no cars), the frame drawn through renderScene() with the world's fog sigma replaced by `fog` when it is a number
  // (fogSigma swapped for the one frame), and the pixels where the lane centre lies at each distance in `ds`, each with its
  // distance from the eye. __wxLamps(): the player's car and a traffic car, each seen from 6 m ahead of it at 1.2 m, and the
  // brightest pixel within 3 px of each headlamp, with the lamps as the page has them and with lightsOn() swapped to false.
  await page.evaluate(() => {
    const W = window, F0 = Object.assign({}, W.__DS.WX_FIXED);
    W.__wxPick = (kind, I) => { const D = W.__DS; Object.assign(D.WX_FIXED, F0); if (I !== undefined) D.WX_FIXED[kind] = I; D.setWeather(kind); };
    W.__dsContrast = (F, x, y) => { const v = F.L(x, y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && F.L(x + dx, y + dy) > v) return -1;
      let ring = 0, lo = 1e9, hi = -1e9; for (let d = -3; d <= 3; d++) for (const q of [F.L(x + d, y - 3), F.L(x + d, y + 3), F.L(x - 3, y + d), F.L(x + 3, y + d)]) { ring += q; lo = Math.min(lo, q); hi = Math.max(hi, q); }
      return hi - lo > 8 ? -1 : v - ring / 28; };
    W.__dsPeaks = (F, frac, t) => { let n = 0; for (let y = Math.floor(F.h * (1 - frac)) + 3; y < F.h - 3; y++) for (let x = 3; x < F.w - 3; x++) if (W.__dsContrast(F, x, y) >= t) n++; return n; };
    // a camera at eye looking at a world point, the frame through renderScene, and the suite's own projection of world points
    W.__wxCam = (eye, target, recs, pts) => { const c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height, fov = 0.8, up = [0, 1, 0];
      const fl = Math.hypot(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]), f = [0, 1, 2].map(i => (target[i] - eye[i]) / fl);
      g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      renderScene(eye, f, up, fov, 0.2, w, h, { propDist: 560, shadows: false, hidePlayer: false }, recs);
      const F = W.__dsPx(), cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const s0 = cr(f, up), sl = Math.hypot(...s0), sv = s0.map(v => v / sl), u = cr(sv, f), t = Math.tan(fov / 2);
      F.at = pts.map(p => { const d = [0, 1, 2].map(i => p[i] - eye[i]); return { x: (dt(d, sv) / dt(d, f) / (t * w / h) * 0.5 + 0.5) * w - 0.5, y: (dt(d, u) / dt(d, f) / t * 0.5 + 0.5) * h - 0.5, dist: Math.hypot(...d) }; });
      return F; };
    W.__wxRoad = (s, fog, ds) => { const D = W.__DS, keep = now, keepF = fogSigma; now = 100;
      const pt = (q, u = 1.8) => { const p = D.at(q), xz = worldAt(p, u); return [xz[0], D.groundAt(p, u, xz[0], xz[1]), xz[1]]; };
      const e = pt(s); e[1] += 3;
      if (typeof fog === 'number') fogSigma = () => fog;
      let F; try { F = W.__wxCam(e, pt(s + 120), [], ds.flatMap(d => [pt(s + d), pt(s + d, 0.9), pt(s + d, 2.7)])); } finally { fogSigma = keepF; now = keep; }
      return ds.map((d, i) => { const a = F.at[3 * i], y = Math.round(a.y), x0 = Math.round(Math.min(F.at[3 * i + 1].x, F.at[3 * i + 2].x)), x1 = Math.round(Math.max(F.at[3 * i + 1].x, F.at[3 * i + 2].x)), px = [];
        for (let x = x0; x <= x1; x++) { const k = (y * F.w + x) * 4; px.push([F.px[k], F.px[k + 1], F.px[k + 2]]); }
        return { d, dist: +a.dist.toFixed(2), x0, x1, y, px }; }); };
    W.__wxLamps = () => { const D = W.__DS, keep = now, keepL = lightsOn, mode = D.CAM.mode; now = 100; D.CAM.mode = 1;
      const look = (B, V, recs) => { const H = V.headlamp, eye = toWorld(B, [0, 1.2, V.length / 2 + 6]), tg = toWorld(B, [0, 0.7, 0]);
        const lamps = [1, -1].map(sx => toWorld(B, [sx * H.x, H.y, V.length / 2]));
        const F = W.__wxCam(eye, tg, recs, lamps);
        return F.at.map(a => { let m = 0; for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) m = Math.max(m, F.L(x, y)); return Math.round(m); }); };
      const P = D.PLAYER, pb = playerBasis();
      // the traffic car furthest from every other car (and the player), within 250 m
      let best = null, bd = 0;
      for (const c of D.TRAFFIC.cars) { const dp = Math.hypot(c.x - P.x, c.z - P.z); if (dp > 250) continue;
        let md = dp; for (const o of D.TRAFFIC.cars) if (o !== c) md = Math.min(md, Math.hypot(c.x - o.x, c.z - o.z)); if (md > bd) { bd = md; best = c; } }
      const out = { gap: Math.round(bd) };
      try {
        for (const on of [true, false]) {
          if (!on) lightsOn = () => false;
          const recs = carRecords();
          out[on ? 'on' : 'off'] = { player: look(pb, D.CARMESH[P.V.kind].car.V, recs), car: best ? look(carBasis(best.x, best.y, best.z, best.yaw, best.pitch, 0), D.CARMESH[best.kind].car.V, recs) : null,
            head: recs.map(r => r.head) };
        }
      } finally { lightsOn = keepL; now = keep; D.CAM.mode = mode; }
      return out; };
  });
  // the pixels' linear values: the page's tonemap undone (8-bit level -> its pow(1/2.2) -> the ACES fit solved for x)
  const unTone = v => { const Y = Math.pow(Math.min(v, 254.5) / 255, 2.2), A = 2.51 - 2.43 * Y, B = 0.03 - 0.59 * Y; return (-B + Math.sqrt(B * B + 4 * A * 0.14 * Y)) / (2 * A); };

  // row: Clear is as shipped. WX_BEFORE's five frames hash as recorded; then Rain (a frame drawn under it, the state stepped), and
  // back to Clear with wet and snow 0: the five again
  const clearRow = await page.evaluate(MAY5 => { const W = window, D = W.__DS, o = {};
    o.first = W.__wxFrames(MAY5);
    W.__wxPick('rain'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); o.rain = { kind: D.WX.kind, cloud: D.WX.cloud, wet: D.WX.wet }; W.__wxView(1); D.stepWeather(0.5);
    W.__wxPick('clear'); D.WX.wet = 0; D.WX.snow = 0;
    o.again = W.__wxFrames(MAY5); o.after = { kind: D.WX.kind, cloud: D.WX.cloud, wet: D.WX.wet, snow: D.WX.snow, fog: D.WX.fog };
    return o; }, MAY5);
  const clearBad = ['first', 'again'].flatMap(p => Object.keys(WX_BEFORE).filter(k => !(clearRow[p][k] && clearRow[p][k][1] === WX_BEFORE[k][1] && clearRow[p][k][0] === WX_BEFORE[k][0])).map(k => p + '.' + k));
  ok('Clear is as shipped: the five WX_BEFORE frames (road at 13:00 chase and cockpit, the stars at 22:00, the sun at 17:00, a town street at 21:00) hash as recorded on the page before the weather, and again after Rain then back to Clear with wet and snow 0',
    clearBad.length === 0 && clearRow.rain.kind === 'rain' && clearRow.rain.cloud === 1 && clearRow.after.kind === 'clear' && clearRow.after.cloud === 0 && clearRow.after.wet === 0 && clearRow.after.fog === 0,
    { bad: clearBad, rain: clearRow.rain, after: clearRow.after, again: clearBad.length ? clearRow.again : 'same' });

  // row: cloud hides the bodies. Under Rain at intensity 1: the sun's disc at 17:00 (WX_BEFORE's sun17 aim) within 5% of the sky
  // 3 and 30 deg beside it in azimuth (Clear's aureole is near white 3 deg off, so the 30 deg sample is what shows the aim is on it), the moon's at 04:00 on May 6 (SKY_BEFORE's moon4 aim) likewise (or within one 8-bit level, the
  // night sky being dark), where under Clear each disc is far brighter than its neighbour; and at 22:00 (the night22 aim) no
  // star pixel by the star row's own method (section 8b: isolated pixels 30 levels over their ring), where Clear has them.
  const bodies = await page.evaluate(MAY5 => { const W = window, D = W.__DS, DR = Math.PI / 180, o = {}, keep = now; now = 100;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const aim = b => { const v = D.SKY[b], az = Math.atan2(v[0], v[2]) / DR, alt = Math.max(Math.asin(v[1]) / DR, 32); return D.enuToWorld(enu(alt, az)); };
    const side = (v, deg) => { const az = Math.atan2(v[0], v[2]) + deg * DR, h = Math.hypot(v[0], v[2]); return [Math.sin(az) * h, v[1], Math.cos(az) * h]; };
    const body = (mjd, hr, b) => { D.SKY.hour = hr; D.setDate(mjd); const disc = D.SKY[b + 'DiscW'], F = W.__dsAimed(aim(b), 0, [disc, side(disc, 3), side(disc, 30)]);
      const L = a => Math.round(F.L(Math.round(a.x), Math.round(a.y)) * 10) / 10; return { disc: L(F.at[0]), beside: L(F.at[1]), far: L(F.at[2]), alt: +(Math.asin(D.SKY[b][1]) / DR).toFixed(1) }; };
    const stars = () => { D.SKY.hour = 22; D.setDate(MAY5); const F = W.__dsAimed(D.enuToWorld(enu(32, 200)), 0); return { n30: W.__dsPeaks(F, 1, 30), n40: W.__dsPeaks(F, 1, 40) }; };
    for (const [k, I] of [['clear'], ['rain', 1]]) { W.__wxPick(k, I); o[k] = { sun: body(MAY5, 17, 'sun'), moon: body(MAY5 + 1, 4, 'moon'), stars: stars(), cloud: D.WX.cloud, I: D.WX.intensity }; }
    W.__wxPick('clear'); now = keep; D.SKY.hour = 13; D.setDate(MAY5);
    return o; }, MAY5);
  const near = (r, tol) => [r.beside, r.far].every(b => Math.abs(r.disc - b) <= Math.max(tol * b, 1));
  ok('cloud hides the bodies: under Rain at intensity 1 the sun\'s disc at 17:00 and the moon\'s at 04:00 are within 5% of the sky 3 and 30 deg beside them (Clear: the sun saturated and far over the sky 30 deg off, the moon far over its neighbour), and at 22:00 there is no star pixel by the star row\'s method (Clear: some)',
    bodies.rain.I === 1 && bodies.rain.cloud === 1 && near(bodies.rain.sun, 0.05) && near(bodies.rain.moon, 0.05) && bodies.rain.stars.n30 === 0
    && bodies.clear.sun.disc >= 250 && bodies.clear.sun.disc > bodies.clear.sun.far + 30 && bodies.clear.moon.disc > bodies.clear.moon.beside + 30 && bodies.clear.stars.n40 >= 4, bodies);

  // row: the sky goes grey. Under Rain (the fixed pick) at 13:00 on May 5, the sky aimed 32 deg up at azimuth 200 and again at
  // azimuth 20 (all sky): its mean HSV saturation (the pixels as shown) under 0.15 where Clear's is over 0.3, and its mean 8-bit
  // luminance 0.4-0.8x Clear's
  const grey = await page.evaluate(MAY5 => { const W = window, D = W.__DS, DR = Math.PI / 180, o = {}, keep = now; now = 100;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const stat = F => { let s = 0, l = 0, n = 0; for (let i = 0; i < F.px.length; i += 4) { const r = F.px[i], g = F.px[i + 1], b = F.px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      s += mx > 0 ? (mx - mn) / mx : 0; l += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++; } return { sat: +(s / n).toFixed(3), lum: +(l / n).toFixed(2) }; };
    for (const k of ['clear', 'rain']) { W.__wxPick(k); D.SKY.hour = 13; D.setDate(MAY5); o[k] = [200, 20].map(az => stat(W.__dsAimed(D.enuToWorld(enu(32, az)), 0))); o[k + 'Cloud'] = D.WX.cloud; }
    W.__wxPick('clear'); now = keep; D.SKY.hour = 13; D.setDate(MAY5);
    return o; }, MAY5);
  const greyRatio = grey.rain.map((r, i) => +(r.lum / grey.clear[i].lum).toFixed(3));
  ok('the sky goes grey: under Rain at 13:00 the sky (32 deg up, two azimuths) has a mean HSV saturation under 0.15 where Clear\'s is over 0.3, and a mean luminance 0.4-0.8x Clear\'s',
    grey.rainCloud === 1 && grey.rain.every(r => r.sat < 0.15) && grey.clear.every(r => r.sat > 0.3) && greyRatio.every(q => q >= 0.4 && q <= 0.8), { grey, greyRatio });

  // row: the fog closes the view. A straight, level stretch (the heading within 0.5 deg and the road within 0.6 m of a straight
  // line over 340 m), a camera 3 m over the right lane aimed down it at 13:00, no cars. At the lane centre 50, 75, 100, 150, 200
  // and 300 m on, three frames: the weather's own, and the same with the world's fog sigma replaced by 0 and by 1 (fogSigma
  // swapped for the frame). With the tonemap undone, C(d) = (weather - full) / (none - full) is the share of the road's own
  // contrast against the fog colour still showing; ln C over the eye's distance is fitted with a line, over the distances where
  // the weather frame is still 6 levels from the full fog, and its slope is the measured sigma. Fog at 0.2 and 1.0 must give
  // 3 / MOR for 400 and 150 m within 20%. Under Clear (an optical range of about 2.9 km) C(300) / C(50) is at least 0.7: an
  // optical range over 2 km. (The plan's 0.85 cannot hold for the shipped haze: exp(-0.00105 x 250) is 0.77; Clear is not to move.)
  const DS = [50, 75, 100, 150, 200, 300];
  const fogRun = await page.evaluate(([MAY5, DS]) => { const W = window, D = W.__DS, o = {};
    // the stretch: from 1 km on, every 50 m, the first whose next 340 m hold the heading and lie on a line
    let s0 = null;
    for (let s = 1000; s < 40000 && s0 === null; s += 50) { const a = D.at(s), b = D.at(s + 340); let okS = true;
      for (let d = 0; d <= 340 && okS; d += 10) { const p = D.at(s + d); if (Math.abs(p.th - a.th) > 0.5 * Math.PI / 180 || Math.abs(p.y - (a.y + (b.y - a.y) * d / 340)) > 0.6) okS = false; }
      if (okS) s0 = s; }
    o.s = s0; if (s0 === null) return o;
    D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(s0); D.TRAFFIC.cars.length = 0; o.cls = D.sectionAt(s0).cls;
    for (const [k, I] of [['clear'], ['fog', 0.2], ['fog', 1]]) { W.__wxPick(k, I); o[k + (I || '')] = { mor: D.WX.mor, w: W.__wxRoad(s0, null, DS), none: W.__wxRoad(s0, 0, DS), full: W.__wxRoad(s0, 1, DS) }; }
    W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, [MAY5, DS]);
  const fogFit = run => { if (!run) return null; const pts = [];
    run.w.forEach((p, i) => { const lin = q => q.reduce((a, c) => a + c.reduce((x, v) => x + unTone(v), 0), 0), raw = q => q.reduce((a, c) => a + c[0] + c[1] + c[2], 0);
      const w = lin(p.px), n = lin(run.none[i].px), f = lin(run.full[i].px), C = (w - f) / (n - f);
      pts.push({ d: p.d, dist: p.dist, npx: p.px.length, C: +C.toFixed(4), lev: +(Math.abs(raw(p.px) - raw(run.full[i].px)) / 3).toFixed(1), den: +(Math.abs(n - f) / p.px.length).toFixed(4) }); });
    const use = pts.filter(q => q.lev >= 8 && q.den > 0.01 && q.C > 0);
    let sig = null; if (use.length >= 2) { const n = use.length, mx = use.reduce((a, q) => a + q.dist, 0) / n, my = use.reduce((a, q) => a + Math.log(q.C), 0) / n;
      sig = -use.reduce((a, q) => a + (q.dist - mx) * (Math.log(q.C) - my), 0) / use.reduce((a, q) => a + (q.dist - mx) ** 2, 0); }
    return { sig: sig && +sig.toFixed(5), n: use.length, pts }; };
  const fit = { clear: fogFit(fogRun.clear), fog02: fogFit(fogRun['fog0.2']), fog1: fogFit(fogRun.fog1) };
  const within = (f, mor) => !!f && f.sig !== null && Math.abs(f.sig / (3 / mor) - 1) <= 0.2;
  const cR = fit.clear && (fit.clear.pts[5].C / fit.clear.pts[0].C);
  console.log('  .. fog fits: ' + JSON.stringify({ s: fogRun.s, cls: fogRun.cls, clear: fit.clear && fit.clear.sig, c300_50: cR && +cR.toFixed(3), fog02: fit.fog02 && [fit.fog02.sig, 3 / 400, fit.fog02.n], fog1: fit.fog1 && [fit.fog1.sig, 3 / 150, fit.fog1.n] }));
  ok('the fog closes the view: down a straight, level road at 13:00 the road\'s contrast against the fog colour falls as exp(-sigma d) with sigma within 20% of 3 / MOR for Fog at 0.2 (400 m) and 1.0 (150 m), measured off the pixels; under Clear the contrast at 300 m is at least 0.7x that at 50 m',
    fogRun.s !== null && within(fit.fog02, 400) && within(fit.fog1, 150) && Math.abs(fogRun['fog0.2'].mor - 400) < 0.01 && Math.abs(fogRun.fog1.mor - 150) < 0.01 && cR >= 0.7 && fit.clear.pts[0].den > 0.01,
    { s: fogRun.s, fit });

  // row: headlights in weather. At 13:00, the player's car and a traffic car seen from 6 m ahead: under Rain, Fog and Snow (in
  // winter) the brightest pixel within 3 px of each headlamp is at least 25 levels over the same frame with the lamps forced off
  // (lightsOn swapped to false), and under Clear the two frames' lamps are the same, level for level
  const lampRun = await page.evaluate(MAY5 => { const W = window, D = W.__DS, o = {};
    for (const k of ['clear', 'rain', 'fog', 'snow']) { if (k === 'snow') D.setSeason('winter'); W.__wxPick(k); D.SKY.hour = 13; D.setDate(k === 'snow' ? D.SKY.mjd : MAY5); W.__wxPlace(k === 'snow' ? 400 : 400);
      o[k] = Object.assign(W.__wxLamps(), { kind: D.WX.kind, lights: D.SKY.lights, day: +D.SKY.day.toFixed(2) }); }
    W.__wxPick('clear'); D.setSeason('spring'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, MAY5);
  const lit = r => !!r.on.car && [0, 1].every(i => r.on.player[i] >= r.off.player[i] + 25 && r.on.car[i] >= r.off.car[i] + 25);
  const same = r => !!r.on.car && JSON.stringify([r.on.player, r.on.car]) === JSON.stringify([r.off.player, r.off.car]);
  ok('headlights in weather: at 13:00 the player\'s headlamps and a traffic car\'s are lit under Rain, Fog and Snow (each lamp at least 25 levels over the same frame with the lamps off) and unlit under Clear',
    ['rain', 'fog', 'snow'].every(k => lampRun[k].kind === k && !lampRun[k].lights && lit(lampRun[k])) && lampRun.clear.kind === 'clear' && !lampRun.clear.lights && same(lampRun.clear),
    Object.fromEntries(Object.entries(lampRun).map(([k, r]) => [k, { on: [r.on.player, r.on.car], off: [r.off.player, r.off.car], gap: r.gap, kind: r.kind, lights: r.lights }])));

  const tail = await page.evaluate(() => ({ weather: window.__DS.SETTINGS.weather, look: window.__DS.lookSeason }));
  ok('no page errors; the suite booted under its Clear pin (nothing stored, so the pin wrote Clear) and leaves the page under Clear in spring',
    errors.length === 0 && boot.weather === 'clear' && boot.kind === 'clear' && tail.weather === 'clear' && tail.look === 'spring', { errors: errors.slice(0, 5), boot, tail });
  await browser.close();
  console.log(`DRIVING SIMULATOR WEATHER DRIVE: ${pass} passed, ${fail} failed` + TAIL);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`DRIVING SIMULATOR WEATHER DRIVE: ${pass} passed, ${fail + 1} failed` + TAIL); process.exit(1); });
