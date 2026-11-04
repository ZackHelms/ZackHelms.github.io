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

  // ---- 3g. rain falls, and the road gets wet (DS-8, dsweather step 3) ----
  // Step 3's helpers. __wxDiff(a, b): the share of pixels where two frames differ by 3 levels or more in any channel, and the mask
  // of them. __wxDraws(fn): fn() run with every drawArraysInstanced counted by program, and PERF.calls for it. __wxOff(fn): fn()
  // with the precipitation pass off (precipCount swapped to 0 for it). __wxTensor(D, x0, x1): the structure tensor of a
  // difference image over the columns x0..x1, as the line orientation's angle off vertical in degrees (the lower end
  // to the left, "/", is negative; the image's rows run upward, as readPixels gives them).
  await page.evaluate(() => {
    const W = window;
    W.__wxDiff = (a, b) => { const m = new Uint8Array(a.w * a.h); let n = 0;
      for (let i = 0, j = 0; i < a.px.length; i += 4, j++) if (Math.max(Math.abs(a.px[i] - b.px[i]), Math.abs(a.px[i + 1] - b.px[i + 1]), Math.abs(a.px[i + 2] - b.px[i + 2])) >= 3) { m[j] = 1; n++; }
      return { share: n / (a.w * a.h), n, m }; };
    W.__wxDraws = fn => { const g = document.getElementById('gl').getContext('webgl2'), orig = g.drawArraysInstanced, c = { precip: 0, other: 0 };
      g.drawArraysInstanced = function (...a) { if (g.getParameter(g.CURRENT_PROGRAM) === PRG.precip.p) c.precip++; else c.other++; return orig.apply(this, a); };
      try { W.__DS.PERF.calls = 0; const F = fn(); c.calls = W.__DS.PERF.calls; c.F = F; } finally { g.drawArraysInstanced = orig; } return c; };
    W.__wxOff = fn => { const keep = precipCount; precipCount = () => 0; try { return fn(); } finally { precipCount = keep; } };
    W.__wxTensor = (A, B, x0, x1) => { const L = (F, x, y) => F.L(x, y), d = (x, y) => Math.abs(L(A, x, y) - L(B, x, y));
      let jxx = 0, jyy = 0, jxy = 0;
      for (let y = 1; y < A.h - 1; y++) for (let x = Math.max(1, x0); x < Math.min(A.w - 1, x1); x++) {
        const gx = (d(x + 1, y) - d(x - 1, y)) / 2, gy = (d(x, y + 1) - d(x, y - 1)) / 2; jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; }
      // the gradients' dominant direction, from the x axis; the lines run across it, so it is also the lines' angle off vertical
      return +(0.5 * Math.atan2(2 * jxy, jxx - jyy) * 180 / Math.PI).toFixed(2); };
    // __wxVert(xf, w, h): the world's vertical as the page's camera (CAM, as last set) draws it at column xf of the width and
    // mid-height, in the same measure (degrees off the screen's vertical, "/" negative): a camera that looks down leans it
    W.__wxVert = (xf, w, h) => { const C = W.__DS.CAM, f = C.fwd, up = [0, 1, 0], t = Math.tan(C.fov / 2), asp = w / h;
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const s0 = cr(f, up), sl = Math.hypot(...s0), sv = s0.map(v => v / sl), u = cr(sv, f), xn = (xf * 2 - 1) * t * asp;
      const p = [0, 1, 2].map(i => (f[i] + xn * sv[i]) * 10), q = [p[0], p[1] + 0.1, p[2]], sc = r => [dt(r, sv) / dt(r, f) / (t * asp) * w / 2, dt(r, u) / dt(r, f) / t * h / 2];
      const a = sc(p), b = sc(q); return +(Math.atan2(-(b[0] - a[0]), b[1] - a[1]) * 180 / Math.PI).toFixed(2); };
  });

  // row: it rains where you look. Under Rain at intensity 1, 13:00, the chase view (the page's own frame): the pass is one
  // instanced draw (the frame's call count the same frame's with the pass off plus one), and the frame differs from the same
  // frame with the pass off on 0.5-15% of its pixels; under Clear the precipitation program draws nothing and the call count
  // is the same as with the pass off.
  const rains = await page.evaluate(MAY5 => { const W = window, D = W.__DS, o = {}, view = () => W.__wxView(1);
    for (const [k, I] of [['clear'], ['rain', 1]]) { W.__wxPick(k, I); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0);
      const on = W.__wxDraws(view), off = W.__wxOff(() => W.__wxDraws(view));
      o[k] = { n: precipCount(), precip: on.precip, calls: on.calls, offCalls: off.calls, offPrecip: off.precip, share: +W.__wxDiff(on.F, off.F).share.toFixed(4) }; }
    W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, MAY5);
  ok('it rains where you look: under Rain at 13:00 (intensity 1) the chase view draws the pass as one instanced draw, and the frame differs from the same frame with the pass off on 0.5-15% of its pixels; under Clear the pass does not draw (the call count is the same with it off)',
    rains.rain.n > 0 && rains.rain.precip === 1 && rains.rain.calls === rains.rain.offCalls + 1 && rains.rain.offPrecip === 0 && rains.rain.share >= 0.005 && rains.rain.share <= 0.15
    && rains.clear.n === 0 && rains.clear.precip === 0 && rains.clear.calls === rains.clear.offCalls && rains.clear.share === 0, rains);

  // row: streaks follow the relative wind. The chase view under Rain at intensity 1, the difference frame (the pass on less the
  // pass off), its structure tensor's orientation in the left and right thirds of the screen: at rest both within 5 deg of the
  // vertical (the world's, as the camera draws it in that third: the chase camera looks a little down, which leans a falling
  // line by several degrees toward the middle, so the screen's own vertical would not do); with the car at 30 m/s (its speed
  // set, the frame drawn, nothing stepped) the left third's streaks lean with their lower end to the left ("/") and the right
  // third's to the right ("\"), each more than 10 deg off the screen's vertical: they fan out from the road's vanishing point,
  // toward the screen's edges.
  const lean = await page.evaluate(MAY5 => { const W = window, D = W.__DS, o = {};
    W.__wxPick('rain', 1); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0);
    for (const v of [0, 30]) { D.PLAYER.vx = v; const on = W.__wxView(1), off = W.__wxOff(() => W.__wxView(1)), t = on.w / 3;
      o['v' + v] = { left: W.__wxTensor(on, off, 0, Math.round(t)), right: W.__wxTensor(on, off, Math.round(2 * t), on.w), share: +W.__wxDiff(on, off).share.toFixed(4),
        vertL: W.__wxVert(1 / 6, on.w, on.h), vertR: W.__wxVert(5 / 6, on.w, on.h) }; }
    D.PLAYER.vx = 0; W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, MAY5);
  ok('streaks follow the relative wind: in the chase view under Rain the streaks\' orientation (the difference frame\'s structure tensor) is within 5 deg of the vertical in the left and right thirds at rest, and at 30 m/s the two thirds lean opposite ways, each more than 10 deg off vertical with the lower end toward the screen\'s edge',
    Math.abs(lean.v0.left - lean.v0.vertL) <= 5 && Math.abs(lean.v0.right - lean.v0.vertR) <= 5 && lean.v30.left <= -10 && lean.v30.right >= 10 && lean.v0.share > 0 && lean.v30.share > 0, lean);

  // row: no rain inside the car. In the cockpit (the page's own frame, the mirror's own pass held off so its glass shows one
  // picture throughout: rain seen in the mirror is rain outside; and since step 4 the windscreen's pass held off too, as its drops
  // refract the falling rain and sit where the cabin's mask is taken) under Rain at intensity 1: the cabin's own pixels (where the
  // frame with the cabin differs from the same frame without it, the pass off, less a pixel at its edges, where the antialiasing
  // mixes in the world beyond) are the same with the pass on and off. Then the field the suite alone uses (PRECIP.field 1: every
  // drop placed inside the player's car box) is culled whole: the cockpit frame and a chase camera's (9 m behind and 3 m over the car, looking at it) are the same with the pass on
  // and off, the car's own pixels included, while the same field beside the box (field 2) is seen from both.
  const cabin = await page.evaluate(MAY5 => { const W = window, D = W.__DS, o = {};
    W.__wxPick('rain', 1); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0);
    const mir = D.SETTINGS.mirror, keepG = glassOn; D.SETTINGS.mirror = 0; glassOn = () => false;   // the windscreen (step 4) held off: its drops refract the rain
    const cock = () => W.__wxView(0);
    const noCab = () => { const keep = D.CAM.mode; let F; try { D.CAM.mode = 0; D.CAM.chase = null; const k = now; now = 100; frameNo = 0; drawGauges(); updateCamera(0);
      const g = GFX[SETTINGS.gfx] || GFX[1], recs = carRecords(), shadows = g.shadows && (SKY.sun[1] > 0.02); if (shadows) renderShadow(recs);
      gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      renderScene(CAM.eye, CAM.fwd, CAM.up, CAM.fov, CAM.near, glc.width, glc.height, { propDist: g.propDist, shadows, hidePlayer: false, cabin: false }, recs);
      F = W.__dsPx(); now = k; } finally { D.CAM.mode = keep; } return F; };
    const offC = W.__wxOff(cock), offN = W.__wxOff(noCab), mask = W.__wxDiff(offC, offN).m;
    const onC = cock(), dm = W.__wxDiff(onC, offC).m;
    const w = offC.w, inner = i => { const x = i % w; if (x < 1 || x >= w - 1 || i < w || i >= mask.length - w) return false;
      for (const k of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) if (!mask[i + k]) return false; return true; };
    let cab = 0, hit = 0; for (let i = 0; i < mask.length; i++) if (mask[i] && inner(i)) { cab++; if (dm[i]) hit++; }
    o.cockpit = { cabinPx: cab, changed: hit, frameShare: +W.__wxDiff(onC, offC).share.toFixed(4) };
    // the box field, in the cockpit and from a chase camera
    const P = D.PLAYER, B = playerBasis(), V = P.V, recs = carRecords(), noP = recs.filter(r => !r.player);
    const eye = toWorld(B, [0, 3, -9]), tg = toWorld(B, [0, V.height * 0.5, 0]);
    const chase = rr => { const k = now; now = 100; try { return W.__wxCam(eye, tg, rr, []); } finally { now = k; } };
    const carM = W.__wxDiff(W.__wxOff(() => chase(recs)), W.__wxOff(() => chase(noP))).m;
    const field = f => { const keep = D.PRECIP.field; D.PRECIP.field = f; try { const c1 = cock(), c0 = W.__wxOff(cock), h1 = chase(recs), h0 = W.__wxOff(() => chase(recs)), dc = W.__wxDiff(c1, c0), dh = W.__wxDiff(h1, h0);
      let car = 0, carHit = 0; for (let i = 0; i < carM.length; i++) if (carM[i]) { car++; if (dh.m[i]) carHit++; }
      return { cockpit: dc.n, chase: dh.n, carPx: car, carChanged: carHit }; } finally { D.PRECIP.field = keep; } };
    o.inBox = field(1); o.beside = field(2);
    D.SETTINGS.mirror = mir; glassOn = keepG; W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, MAY5);
  ok('no rain inside the car: under Rain in the cockpit the cabin\'s own pixels (dash, headliner, pillars) are the same with the pass on and off; every drop placed inside the car\'s box is culled, so the cockpit frame and a chase camera\'s (the car\'s own pixels included) are unchanged, while the same field beside the box is seen from both',
    cabin.cockpit.cabinPx > 1000 && cabin.cockpit.changed === 0 && cabin.cockpit.frameShare > 0
    && cabin.inBox.cockpit === 0 && cabin.inBox.chase === 0 && cabin.inBox.carPx > 1000 && cabin.inBox.carChanged === 0
    && cabin.beside.cockpit > 50 && cabin.beside.chase > 50, cabin);

  // row: the road is wet. Under Rain with the pass off (only the ground compared), the same frame with wet 0 and wet 1. At 13:00
  // a camera 3 m over the right lane of a straight, level stretch aimed down it (the fog row's __wxRoad): the lane's middle half
  // (0.9-2.7 m off the centre line, both wheel paths), 8-25 m on, has a mean luminance (linear: the tonemap undone, as the fog
  // row does) 0.4-0.75x dry's. At 21:00 on a town street, a camera 3 m over the right lane 25 m short of a streetlight, aimed at
  // the road under it: the brightest pixel of the road's asphalt (both lanes between their lines, 3-35 m on: a lamp's highlight
  // on a wet road lies between the lamp and the eye) is brighter wet than dry, by at least 5 levels.
  const WD = [8, 10, 12, 15, 20, 25];
  const wetRun = await page.evaluate(([MAY5, WD]) => { const W = window, D = W.__DS, o = {};
    let s0 = null;
    for (let s = 1000; s < 40000 && s0 === null; s += 50) { const a = D.at(s), b = D.at(s + 340); let okS = true;
      for (let d = 0; d <= 340 && okS; d += 10) { const p = D.at(s + d); if (Math.abs(p.th - a.th) > 0.5 * Math.PI / 180 || Math.abs(p.y - (a.y + (b.y - a.y) * d / 340)) > 0.6) okS = false; }
      if (okS) s0 = s; }
    o.s = s0; if (s0 === null) return o;
    W.__wxPick('rain', 1); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(s0); D.TRAFFIC.cars.length = 0;
    for (const w of [0, 1]) { D.WX.wet = w; o['day' + w] = W.__wxOff(() => W.__wxRoad(s0, null, WD)).flatMap(r => r.px); }
    // the town street: the first lamp on the road 40 m or more past the street's start, the camera 25 m short of its foot
    const ts = W.__wxTown(); D.SKY.hour = 21; D.setDate(MAY5); W.__wxPlace(ts); D.TRAFFIC.cars.length = 0;
    let lamp = null; for (const ch of D.CHUNKS.values()) for (const l of ch.lights) { const q = D.project(l[0], l[2], ts); if (q.s > ts + 40 && q.s < ts + 300 && (!lamp || q.s < lamp.s)) lamp = { s: q.s, u: q.u }; }
    o.lamp = lamp && { s: +lamp.s.toFixed(1), u: +lamp.u.toFixed(2) };
    if (lamp) { const sc = lamp.s - 25;
      const peak = () => { const keep = now; now = 100; let m = 0; try {
        const pt = (q, u) => { const p = D.at(q), xz = worldAt(p, u); return [xz[0], D.groundAt(p, u, xz[0], xz[1]), xz[1]]; };
        const e = pt(sc, 1.8); e[1] += 3; const ds = []; for (let d = 3; d <= 35; d += 0.25) ds.push(d);
        const U = [[-3.2, -0.3], [0.3, 3.2]], F = W.__wxCam(e, pt(lamp.s, 0), [], ds.flatMap(d => U.flatMap(([u0, u1]) => [pt(sc + d, u0), pt(sc + d, u1)])));
        for (let i = 0; i < F.at.length; i += 2) { const a = F.at[i], b = F.at[i + 1], y = Math.round((a.y + b.y) / 2); if (y < 0 || y >= F.h) continue;
          for (let x = Math.max(0, Math.round(Math.min(a.x, b.x))); x <= Math.min(F.w - 1, Math.round(Math.max(a.x, b.x))); x++) m = Math.max(m, F.L(x, y)); }
      } finally { now = keep; } return +m.toFixed(1); };
      for (const w of [0, 1]) { D.WX.wet = w; o['night' + w] = W.__wxOff(peak); } }
    D.WX.wet = 0; W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, [MAY5, WD]);
  const linLum = px => px.length ? px.reduce((a, p) => a + 0.2126 * unTone(p[0]) + 0.7152 * unTone(p[1]) + 0.0722 * unTone(p[2]), 0) / px.length : NaN;
  const lev = px => px.length ? px.reduce((a, p) => a + 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], 0) / px.length : NaN;
  const wet = wetRun.day0 ? { lin: +(linLum(wetRun.day1) / linLum(wetRun.day0)).toFixed(3), level: +(lev(wetRun.day1) / lev(wetRun.day0)).toFixed(3), n: wetRun.day0.length,
    dry: +lev(wetRun.day0).toFixed(1), wet: +lev(wetRun.day1).toFixed(1), night: [wetRun.night0, wetRun.night1], lamp: wetRun.lamp, s: wetRun.s } : { s: null };
  ok('the road is wet: with wet 1 at 13:00 the lane\'s asphalt (8-25 m on, a straight level road) has a mean luminance 0.4-0.75x dry\'s; at 21:00 on a town street the road\'s brightest pixel under a streetlight is brighter wet than dry',
    wetRun.s !== null && wet.lin >= 0.4 && wet.lin <= 0.75 && wet.n > 200 && !!wetRun.lamp && wetRun.night1 >= wetRun.night0 + 5, wet);

  // ---- 3h. the windscreen and the wipers (DS-8, dsweather step 4) ----
  // Step 4's helpers. __wxGlassPx(region): the pixels (readPixels indexing, rows up) where a region of the windscreen lies in the
  // page's cockpit camera as last set: points on a 4 mm grid of the glass coordinates (a toward the driver's side, v up the glass
  // from the cowl, metres) inside the region, placed by the page's own glassPoint() and projected by the suite. A region is a
  // { blade, r0, r1, f0, f1 } sector of a wiper's sweep (f the fraction of the sweep from the park) or an { a0, a1, v0, v1 } box.
  // __wxGlassDraws(fn): fn() with the glass program's draws counted. __wxGlassOnly(): the glass pass alone, over a flat grey,
  // from the cockpit camera (the drops then show by their lenses' rims and highlights; the blades are near black).
  // __wxShare(on, off, pix, blade): the share of a region's pixels that differ by 3 levels or more between two frames, leaving out
  // blade pixels (under 40 levels in the frame with the glass) when `blade` is set.
  await page.evaluate(() => {
    const W = window;
    W.__wxRegion = R => { const D = W.__DS, G = D.WIPER_GEO, out = [];
      for (let a = -0.9; a <= 0.9; a += 0.004) for (let v = 0; v <= 1.0; v += 0.004) {
        if (R.blade !== undefined) { const B = G.blades[R.blade], dx = a - B.a, dy = v - B.v, r = Math.hypot(dx, dy), f = (Math.PI - Math.atan2(dy, dx)) / (G.sweep * Math.PI / 180);
          if (r < R.r0 || r > R.r1 || f < R.f0 || f > R.f1 || v < (R.vmin || 0)) continue; }
        else if (a < R.a0 || a > R.a1 || v < R.v0 || v > R.v1) continue;
        out.push([a, v]); }
      return out; };
    W.__wxGlassPx = (R, w, h) => { const C = W.__DS.CAM, B = playerBasis(), vp = M4.mul(M4.persp(C.fov, w / h, C.near, 2400), M4.look([0, 0, 0], C.fwd, C.up)), set = new Set();
      for (const [a, v] of W.__wxRegion(R)) { const p = toWorld(B, glassPoint(a, v)), q = [p[0] - C.eye[0], p[1] - C.eye[1], p[2] - C.eye[2]];
        const cx = vp[0] * q[0] + vp[4] * q[1] + vp[8] * q[2] + vp[12], cy = vp[1] * q[0] + vp[5] * q[1] + vp[9] * q[2] + vp[13], cw = vp[3] * q[0] + vp[7] * q[1] + vp[11] * q[2] + vp[15];
        if (cw <= 0) continue; const x = Math.floor((cx / cw * 0.5 + 0.5) * w), y = Math.floor((cy / cw * 0.5 + 0.5) * h);
        if (x >= 0 && x < w && y >= 0 && y < h) set.add(y * w + x); }
      return [...set]; };
    W.__wxGlassDraws = fn => { const g = document.getElementById('gl').getContext('webgl2'), orig = g.drawArrays, c = { glass: 0 };
      g.drawArrays = function (...a) { if (g.getParameter(g.CURRENT_PROGRAM) === PRG.glass.p) c.glass++; return orig.apply(this, a); };
      try { c.F = fn(); } finally { g.drawArrays = orig; } return c; };
    W.__wxGlassOnly = () => { const C = W.__DS.CAM, w = glc.width, h = glc.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.clearColor(0.5, 0.5, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST); drawGlass(M4.mul(M4.persp(C.fov, w / h, C.near, 2400), M4.look([0, 0, 0], C.fwd, C.up)), C.eye, w, h);
      gl.disable(gl.BLEND); gl.depthMask(true); return W.__dsPx(); };
    W.__wxShare = (on, off, pix, blade) => { let n = 0, m = 0; for (const j of pix) { const i = j * 4;
      if (blade && on.px[i] * 0.2126 + on.px[i + 1] * 0.7152 + on.px[i + 2] * 0.0722 < 40) continue; m++;
      if (Math.max(Math.abs(on.px[i] - off.px[i]), Math.abs(on.px[i + 1] - off.px[i + 1]), Math.abs(on.px[i + 2] - off.px[i + 2])) >= 3) n++; }
      return m ? n / m : 0; };
  });
  // the regions: the driver's blade's sector near the park (f 0.15-0.38, r 0.35-0.6, v over 0.1, clear of the dash: the blade
  // crosses it last on its way back),
  // the same blade's sector near the top of its stroke (f 0.75-0.95: out and back close together), and the corner below the
  // driver's A-pillar, which neither blade reaches (a 0.52-0.64, v 0.1-0.22)
  const ARC_LOW = { blade: 0, r0: 0.35, r1: 0.6, f0: 0.15, f1: 0.38, vmin: 0.1 }, ARC_TOP = { blade: 0, r0: 0.3, r1: 0.55, f0: 0.75, f1: 0.95 }, CORNER = { a0: 0.52, a1: 0.64, v0: 0.1, v1: 0.22 };

  // row: drops on the glass, in the cockpit only. Under Rain (the fixed pick) at 13:00 with the wipers not yet started, the
  // cockpit frame's windscreen (the strip's own pixels, by the page's glassPoint) differs from the same frame with the glass pass
  // off (glassOn swapped to false) on more than 1% of its pixels, and the pass draws once; in the chase and orbit views under Rain
  // and in the cockpit under Clear the glass program does not draw and the frame is the same with the pass off.
  const glassRow = await page.evaluate(([MAY5, CORNER]) => { const W = window, D = W.__DS, o = {};
    const mir = D.SETTINGS.mirror; D.SETTINGS.mirror = 0;
    for (const k of ['rain', 'clear']) { W.__wxPick(k); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0); D.WIPER.on = false;
      for (const mode of k === 'rain' ? [0, 1, 2] : [0]) {
        const on = W.__wxGlassDraws(() => W.__wxView(mode)), keep = glassOn; glassOn = () => false; let off; try { off = W.__wxView(mode); } finally { glassOn = keep; }
        const r = { draws: on.glass, frame: +W.__wxDiff(on.F, off).share.toFixed(4) };
        if (mode === 0) { const pix = W.__wxGlassPx({ a0: -0.9, a1: 0.9, v0: 0, v1: 1.1 }, on.F.w, on.F.h); r.glassPx = pix.length; r.share = +W.__wxShare(on.F, off, pix).toFixed(4); }
        o[k + mode] = r; } }
    D.SETTINGS.mirror = mir; W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400);
    return o; }, [MAY5, CORNER]);
  ok('drops on the glass, in the cockpit only: under Rain the cockpit\'s windscreen differs from the same frame with the glass pass off on more than 1% of its pixels (one draw); in the chase and orbit views under Rain, and in the cockpit under Clear, the glass pass does not draw and the frame is unchanged',
    glassRow.rain0.draws === 1 && glassRow.rain0.glassPx > 5000 && glassRow.rain0.share > 0.01
    && glassRow.rain1.draws === 0 && glassRow.rain1.frame === 0 && glassRow.rain2.draws === 0 && glassRow.rain2.frame === 0 && glassRow.clear0.draws === 0 && glassRow.clear0.frame === 0, glassRow);

  // row: the wipers clear what they sweep. Under Rain at 0.25 (intermittent: one cycle every 6 s), stepped with tick(1/60) from the
  // wipers' start with the tick clock set to 1000 s (the drops' births and the sweeps then fall the same way every run; this row
  // and the next), in the page's own cockpit frame. A region's drops are the share of its pixels the glass pass changes, as a share
  // of the same at the same moment with the wipers taken off (WIPER.on false for the frame: every drop that has fallen, unwiped),
  // so the regions' different backgrounds cancel. Right after the second sweep has ended (the first tick with the blades parked)
  // the drops in the driver's blade's sector near the park are under 20% of those in the corner below the A-pillar (which no blade
  // reaches, so it reads 1); on the last tick before the next sweep they are back to at least 70% of the corner's.
  const wipeRow = await page.evaluate(([MAY5, ARC, CORNER]) => { const W = window, D = W.__DS, o = {};
    const mir = D.SETTINGS.mirror; D.SETTINGS.mirror = 0;
    W.__wxPick('rain', 0.25); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0); D.WIPER.on = false; now = 1000; D.CAM.mode = 0; D.CAM.chase = null;
    const frame = () => { updateCamera(0); const g = GFX[SETTINGS.gfx] || GFX[1], recs = carRecords();
      const draw = () => { gl.viewport(0, 0, glc.width, glc.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderScene(CAM.eye, CAM.fwd, CAM.up, CAM.fov, CAM.near, glc.width, glc.height, { propDist: g.propDist, shadows: false, hidePlayer: false, cabin: true }, recs); return W.__dsPx(); };
      const on = draw(); D.WIPER.on = false; let all, off; try { all = draw(); } finally { D.WIPER.on = true; }
      const keep = glassOn; glassOn = () => false; try { off = draw(); } finally { glassOn = keep; }
      const pa = W.__wxGlassPx(ARC, on.w, on.h), pc = W.__wxGlassPx(CORNER, on.w, on.h), rel = p => { const a = W.__wxShare(all, off, p); return a > 0 ? +(W.__wxShare(on, off, p) / a).toFixed(4) : -1; };
      return { arc: rel(pa), corner: rel(pc), arcAll: +W.__wxShare(all, off, pa).toFixed(4), cornerAll: +W.__wxShare(all, off, pc).toFixed(4), arcPx: pa.length, cornerPx: pc.length, wiper: D.wiperAt(D.now) }; };
    D.tick(1 / 60); o.rate = D.WIPER.rate; o.P = D.WIPER.P;
    let n = 0; while (!(D.wiperAt(D.now).cycle === 1 && D.wiperAt(D.now).stroke === 'park') && n < 2000) { D.tick(1 / 60); n++; }
    o.after = frame();
    while (D.wiperAt(D.now + 1 / 60).cycle === 1 && n < 3000) { D.tick(1 / 60); n++; }
    o.before = frame();
    D.SETTINGS.mirror = mir; W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.WIPER.on = false;
    return o; }, [MAY5, ARC_LOW, CORNER]);
  const wA = wipeRow.after, wB = wipeRow.before;
  ok('the wipers clear what they sweep: under Rain at 0.25, stepped with tick(1/60), right after a sweep the drops in the swept arc are under 20% of those in the unswept corner below the A-pillar, and before the next sweep they are back to at least 70% of the corner\'s',
    wipeRow.rate === 'int' && wA.wiper.stroke === 'park' && wA.wiper.cycle === 1 && wB.wiper.cycle === 1 && wB.wiper.tau > 5.9 && wA.arcPx > 300 && wA.cornerPx > 150
    && wA.arcAll > 0.01 && wA.cornerAll > 0.01 && wA.corner > 0.9 && wA.arc < 0.2 * wA.corner && wB.corner > 0.9 && wB.arc >= 0.7 * wB.corner, wipeRow);

  // row: the wipers follow the rain. 30 s of tick(1/60) from the wipers' start under Rain at 0.25, 0.5 and 0.9. Every third tick,
  // the glass pass alone (__wxGlassOnly), and q: the share of drop pixels in the driver's blade's sector near the top of its stroke
  // over the same with the wipers taken off for the frame; a tick with that blade at 70% of its sweep or more (over or beside the
  // sector) is skipped, so only the drops are read. Between sweeps q only grows (drops gather); a cycle is counted when q falls,
  // to under half the reading before and by more than 0.08: the out stroke clears the sector and the back stroke, before the next
  // reading, finds it still clear. Intermittent at 0.25: 4-7; low at 0.5:
  // 19-26 (the Design's 22.5); high at 0.9: 28-37 (32.5).
  const rateRow = await page.evaluate(([MAY5, ARC]) => { const W = window, D = W.__DS, o = {};
    for (const I of [0.25, 0.5, 0.9]) {
      W.__wxPick('rain', I); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.stepPlayer(0); D.WIPER.on = false; now = 1000; D.CAM.mode = 0; D.CAM.chase = null; updateCamera(0);
      const grey = (() => { const w = glc.width, h = glc.height; gl.viewport(0, 0, w, h); gl.clearColor(0.5, 0.5, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 1); return W.__dsPx(); })();
      const pix = W.__wxGlassPx(ARC, grey.w, grey.h);
      const q = () => { updateCamera(0); const on = W.__wxShare(W.__wxGlassOnly(), grey, pix, true), keep = D.WIPER.on; D.WIPER.on = false; let all; try { all = W.__wxShare(W.__wxGlassOnly(), grey, pix, true); } finally { D.WIPER.on = keep; } return all > 0 ? on / all : -1; };
      const qs = []; let prev = q(), cycles = 0, skipped = 0, fallMin = 9, riseMax = 0;
      for (let i = 1; i <= 1800; i++) { D.tick(1 / 60); if (i % 3) continue;
        if (D.wiperAt(D.now).angle >= 0.7 * D.WIPER_GEO.sweep) { skipped++; continue; }
        const v = q(); qs.push(+v.toFixed(2));
        if (v < 0.5 * prev && prev - v > 0.08) { cycles++; fallMin = Math.min(fallMin, prev - v); } else riseMax = Math.max(riseMax, prev - v);
        prev = v; }
      o['I' + I] = { rate: D.WIPER.rate, P: +D.WIPER.P.toFixed(3), px: pix.length, cycles, skipped, fallMin: +fallMin.toFixed(2), otherDropMax: +riseMax.toFixed(2), qs: qs.slice(0, 50).join(' ') }; }
    W.__wxPick('clear'); D.SKY.hour = 13; D.setDate(MAY5); W.__wxPlace(400); D.WIPER.on = false;
    return o; }, [MAY5, ARC_TOP]);
  console.log('  .. wiper cycles in 30 s: ' + JSON.stringify([0.25, 0.5, 0.9].map(I => [I, rateRow['I' + I].rate, rateRow['I' + I].cycles])));
  ok('the wipers follow the rain: over 30 s of ticks, cycles counted from the swept arc\'s drop count falling: intermittent at 0.25 (4-7), low at 0.5 (19-26), high at 0.9 (28-37)',
    [['0.25', 'int', 4, 7], ['0.5', 'low', 19, 26], ['0.9', 'high', 28, 37]].every(([I, r, a, b]) => { const x = rateRow['I' + I]; return x.rate === r && x.px > 300 && x.cycles >= a && x.cycles <= b; }),
    rateRow);

  const tail = await page.evaluate(() => ({ weather: window.__DS.SETTINGS.weather, look: window.__DS.lookSeason }));
  ok('no page errors; the suite booted under its Clear pin (nothing stored, so the pin wrote Clear) and leaves the page under Clear in spring',
    errors.length === 0 && boot.weather === 'clear' && boot.kind === 'clear' && tail.weather === 'clear' && tail.look === 'spring', { errors: errors.slice(0, 5), boot, tail });
  await browser.close();
  console.log(`DRIVING SIMULATOR WEATHER DRIVE: ${pass} passed, ${fail} failed` + TAIL);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`DRIVING SIMULATOR WEATHER DRIVE: ${pass} passed, ${fail + 1} failed` + TAIL); process.exit(1); });
