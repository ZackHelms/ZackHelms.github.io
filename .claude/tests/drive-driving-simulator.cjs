/**
 * Driving Simulator drive suite.
 *
 * Kept in the repo because it encodes the road's design invariants (classes,
 * tapers as long as MUTCD asks, signs before every lane drop, a centreline
 * that never doubles back), the clock the CD specified (a 24-hour day in 2.4
 * minutes, configurable), the car's physics against real-world figures, and the
 * traffic's lane discipline. The simulation is stepped directly through
 * `__DS.tick(dt)` with the live loop paused, so every number is deterministic.
 *
 *   .claude/scripts/gates.sh games/driving-simulator/index.html
 *
 * Exits 0/1 and prints "DRIVING SIMULATOR DRIVE: N passed, M failed" last; with DS_PAGE
 * set (a copy under test) the line ends " (copy)" so it never reads as the shipping page's pass.
 * Needs Chromium; launches with SwiftShader so WebGL2 exists without a GPU.
 */
const { chromium } = require('playwright-core');
const path = require('path');
// DS_PAGE: a copy to test instead (negtest-copies.py); the default is this checkout's page,
// so a worktree tests its own branch and never the primary checkout.
const COPY = !!process.env.DS_PAGE;
const PAGE = 'file://' + (process.env.DS_PAGE || path.join(process.cwd(), 'games', 'driving-simulator', 'index.html'));
const TAIL = COPY ? ' (copy)' : '';
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } }

// ---- the suite's own calendar and sun (never the page's) ----
// MJD from the UTC calendar; the sun is the Astronomical Almanac's low-precision sun, turned to
// alt/az through Meeus 12.4 GMST and Raleigh's longitude. Geometric altitude: no refraction.
const MJD = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 40587;
const MAY5 = MJD(2026, 5, 5), MAR20 = MJD(2026, 3, 20), JUN20 = MJD(2026, 6, 20);
const RAL = { lat: 35.7796, lon: -78.6382 }, DR = Math.PI / 180;
const jdOf = (mjd, local, off) => 2400000.5 + mjd + (local - off) / 24;
function aaSun(jd) {
  const n = jd - 2451545, L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * DR;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DR, eps = (23.439 - 0.0000004 * n) * DR;
  return { ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / DR, dec: Math.asin(Math.sin(eps) * Math.sin(lam)) / DR };
}
function gmst(jd) { const T = (jd - 2451545) / 36525; return ((280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000) % 360 + 360) % 360; }
function ownSun(jd) {   // { alt, dec, ha (deg, -180..180), v: [east, up, north] }
  const s = aaSun(jd), ha = (((gmst(jd) + RAL.lon - s.ra) % 360) + 540) % 360 - 180, H = ha * DR, d = s.dec * DR, la = RAL.lat * DR;
  const v = [-Math.cos(d) * Math.sin(H), Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(H), Math.sin(d) * Math.cos(la) - Math.cos(d) * Math.sin(la) * Math.cos(H)];
  return { alt: Math.asin(v[1]) / DR, dec: s.dec, ha, v };
}
// local clock hours of the -0.833 deg crossings on one date (minute scan, interpolated)
function ownRiseSet(mjd, off) {
  const ev = []; let prev = ownSun(jdOf(mjd, 0, off)).alt;
  for (let m = 1; m <= 1440; m++) { const a = ownSun(jdOf(mjd, m / 60, off)).alt; if ((prev < -0.833) !== (a < -0.833)) ev.push({ h: (m - 1 + (-0.833 - prev) / (a - prev)) / 60, up: a > prev }); prev = a; }
  return ev;
}
function ownNoon(mjd, off) { let t = 12; for (let i = 0; i < 6; i++) t -= ownSun(jdOf(mjd, t, off)).ha / 15 / 1.0027379; return t; }
const angDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DR;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 60000 });
  await page.evaluate(() => window.__DS.setPaused(true));
  const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  // ---- 1. boot and the kits ----
  const boot = await page.evaluate(() => {
    const D = window.__DS;
    return { chunks: D.CHUNKS.size, cars: D.TRAFFIC.cars.length, fmt: ROAD_KIT.format, kinds: ROAD_KIT.vehicles.map(v => v.kind),
      lane: ROAD_KIT.standard.laneWidth, dash: [ROAD_KIT.standard.dashLength, ROAD_KIT.standard.dashGap],
      buildings: TOWN_KIT.buildings.length, forest: TOWN_KIT.forest.length, gl: !!document.getElementById('gl').getContext('webgl2'),
      cycle: D.SETTINGS.cycle, badge: (document.getElementById('build-badge') || {}).textContent,
      cal: { mjd: D.SKY.mjd, hour: D.SKY.hour, dst: D.SKY.dst, text: D.dateText(D.SKY.mjd), off: D.utcOffset(D.SKY.mjd, D.SKY.hour) } };
  });
  ok('boots with WebGL2, chunks and traffic', boot.gl && boot.chunks >= 12 && boot.cars >= 10, boot);
  ok('road kit is road-spec/v1 with six vehicle kinds', boot.fmt === 'road-spec/v1' && boot.kinds.length === 6, boot.kinds);
  ok('MUTCD numbers come from the kit: 12 ft lanes, 10 ft dash on a 40 ft cycle', boot.lane === 3.66 && boot.dash[0] === 3.05 && boot.dash[1] === 9.14, boot);
  ok('town kit supplies 13 buildings and 6 forest species', boot.buildings === 13 && boot.forest === 6, boot);
  ok('build badge carries a real timestamp', /^build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(boot.badge || ''), boot.badge);

  // ---- 2. the road: classes, tapers, signs, geometry ----
  const road = await page.evaluate(() => {
    const D = window.__DS;
    D.sectionAt(60000);
    const S = D.ROAD.sect.filter(s => s.s0 < 60000);
    const classes = [...new Set(S.map(s => s.cls))];
    let jumps = 0, badTaper = 0, firstTown = null;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1].c.lanesPerDirection, b = S[i].c.lanesPerDirection;
      if (Math.abs(a - b) > 1) jumps++;
      if (a !== b) { const want = Math.max(S[i - 1].c.mergeTaper, S[i].c.mergeTaper); if (Math.abs(S[i].taper - want) > 0.01) badTaper++; }
      if (S[i].cls === 'town2' && firstTown === null) firstTown = S[i].s0;
    }
    // lane count is continuous and never steeper than the taper allows
    let maxStep = 0, maxTh = 0, minR = Infinity, maxGrade = 0, laneVals = new Set();
    for (let s = 0; s < 60000; s += 2) {
      const p = D.at(s), q = D.at(s + 2);
      maxStep = Math.max(maxStep, Math.abs(q.L - p.L));
      maxTh = Math.max(maxTh, Math.abs(p.th));
      const k = Math.abs(q.th - p.th) / 2; if (k > 1e-9) minR = Math.min(minR, 1 / k);
      maxGrade = Math.max(maxGrade, Math.abs(q.y - p.y) / 2);
      laneVals.add(Math.round(p.L * 100) / 100);
    }
    // every lane drop (in either direction of travel) has its warning sign before it
    D.at(60000); D.ensureSigns(60000);
    const drops = [];
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1].c.lanesPerDirection, b = S[i].c.lanesPerDirection;
      if (b < a) drops.push({ s: S[i].s0, side: 1 });                       // +s traffic loses a lane at s0
      if (b > a) drops.push({ s: S[i].s0 + S[i].taper, side: -1 });         // -s traffic loses one at the taper's far end
    }
    const signed = drops.filter(d => D.SIGNS.some(g => g.kind === 'laneEnds' && g.side === d.side && (d.side > 0 ? d.s - g.s : g.s - d.s) > 50 && (d.side > 0 ? d.s - g.s : g.s - d.s) < 400));
    const limits = S.filter(sc => sc.s1 < 59000 && D.SIGNS.some(g => g.kind === 'limit' && g.mph === sc.c.speedLimitMph && g.s > sc.s0 && g.s < sc.s1));
    return { classes, jumps, badTaper, firstTown, maxStep, maxTh, minR, maxGrade, laneVals: laneVals.size, drops: drops.length, signed: signed.length,
      sects: S.length, limits: limits.length, limitWant: S.filter(sc => sc.s1 < 59000).length };
  });
  ok('all four road classes appear within 60 km', road.classes.length === 4, road.classes);
  ok('2-, 4- and 6-lane sections all occur (1, 2 and 3 lanes per direction)', ['rural2', 'arterial4', 'highway6'].every(c => road.classes.includes(c)), road.classes);
  ok('a class change never adds or drops more than one lane per direction', road.jumps === 0, road.jumps);
  ok('every taper is the kit\'s MUTCD merge length for the faster class', road.badTaper === 0, road.badTaper);
  ok('lane count is continuous (no step over 2 m larger than a taper allows)', road.maxStep < 2 / 160, road.maxStep);
  ok('the centreline never turns back on itself (|heading| < 90 deg)', road.maxTh < Math.PI / 2 - 0.05, road.maxTh);
  ok('no curve tighter than the plan\'s 380 m radius (spirals included)', road.minR > 370, road.minR);
  ok('grades stay under 8%', road.maxGrade < 0.08, road.maxGrade);
  ok('every lane drop, in each direction, is signed 50-400 m ahead', road.drops > 3 && road.signed === road.drops, road);
  ok('every section posts its own speed limit', road.limits === road.limitWant, road);

  // ---- 3. the clock: a 24-hour day in 2.4 minutes, configurable ----
  const clock = await page.evaluate(MAY5 => {
    const D = window.__DS;
    const out = {};
    out.defaultCycle = D.SETTINGS.cycle;
    out.optionDefault = document.getElementById('cycle-sel').querySelector('option[value="144"]').textContent;
    D.SETTINGS.cycle = 144; D.SKY.hour = 6;
    for (let i = 0; i < 1440; i++) D.advanceClock(0.1);          // 144 s
    out.after144 = D.SKY.hour;
    D.SKY.hour = 6; for (let i = 0; i < 360; i++) D.advanceClock(0.1);   // 36 s = 6 h
    out.after36 = D.SKY.hour;
    D.SETTINGS.cycle = 600; D.SKY.hour = 0; for (let i = 0; i < 6000; i++) D.advanceClock(0.1);
    out.after600 = D.SKY.hour;
    D.SETTINGS.cycle = 0; D.SKY.hour = 9; D.advanceClock(50); out.stopped = D.SKY.hour;
    D.setDate(MAY5);   // the days above stepped the date; noon, midnight and the sun's times are May 5's
    D.SKY.hour = 12; D.updateSky(); out.noon = { e: D.SKY.sun[1], lights: D.SKY.lights, day: D.SKY.day };
    D.SKY.hour = 0; D.updateSky(); out.midnight = { e: D.SKY.sun[1], lights: D.SKY.lights, night: D.SKY.night };
    // the page's sun over the day, a minute at a time, for its -0.833 deg crossings (local clock hours)
    const alt = h => { D.SKY.hour = h; D.updateSky(); return Math.asin(D.SKY.sun[1]) * 180 / Math.PI; };
    const ev = []; let prev = alt(0);
    for (let m = 1; m <= 1440; m++) { const a = alt(m / 60); if ((prev < -0.833) !== (a < -0.833)) ev.push({ h: (m - 1 + (-0.833 - prev) / (a - prev)) / 60, up: a > prev }); prev = a; }
    out.sunEv = ev; out.mjd = D.SKY.mjd; out.dst = D.SKY.dst;
    D.SKY.hour = 6.25; D.updateSky();
    D.SETTINGS.cycle = 144;
    return out;
  }, MAY5);
  const ownEv = ownRiseSet(MAY5, -4), hm = h => Math.floor(h) + ':' + String(Math.floor(h % 1 * 60)).padStart(2, '0');
  ok('default day length is 2.4 minutes', clock.defaultCycle === 144 && /2\.4 minutes/.test(clock.optionDefault), clock);
  ok('144 s of driving is exactly one 24-hour day', Math.abs(((clock.after144 - 6 + 24) % 24)) < 1e-6 || Math.abs(clock.after144 - 6) < 1e-6, clock.after144);
  ok('36 s is a quarter day (6 h)', Math.abs(clock.after36 - 12) < 1e-6, clock.after36);
  ok('a 10-minute setting takes 600 s for the day', Math.abs(clock.after600 % 24) < 1e-6 || Math.abs(clock.after600 - 24) < 1e-6, clock.after600);
  ok('"stopped" holds the time', clock.stopped === 9, clock.stopped);
  ok('sun high at noon, lights off', clock.noon.e > 0.6 && !clock.noon.lights && clock.noon.day > 0.95, clock.noon);
  ok('sun below the horizon at midnight, headlights on', clock.midnight.e < -0.3 && clock.midnight.lights && clock.midnight.night > 0.95, clock.midnight);
  ok('May 5 in Raleigh: sunrise and sunset within 10 min of the suite\'s own computation (about 6:18 am and 8:05 pm EDT)',
    clock.mjd === MAY5 && clock.dst === true && clock.sunEv.length === 2 && ownEv.length === 2 && clock.sunEv[0].up && !clock.sunEv[1].up
    && Math.abs(clock.sunEv[0].h - ownEv[0].h) < 10 / 60 && Math.abs(clock.sunEv[1].h - ownEv[1].h) < 10 / 60,
    { page: clock.sunEv.map(e => hm(e.h)), own: ownEv.map(e => hm(e.h)), mjd: clock.mjd, dst: clock.dst });

  // ---- 3b. the calendar: a date that steps at midnight, saved, on Raleigh's clock; the sun from the date ----
  const cb = boot.cal;
  ok('a first visit is Tue May 5, 2026 at 1:00 pm, EDT', cb.mjd === MAY5 && cb.hour >= 13 && cb.hour < 13.5 && cb.text === 'Tue May 5' && cb.dst === true && cb.off === -4, cb);
  const K = { MAY5, MAR20, JUN20, APR1: MJD(2026, 4, 1), NOV1: MJD(2026, 11, 1), MAR14: MJD(2027, 3, 14) };
  const cal = await page.evaluate(K => {
    const D = window.__DS, o = {};
    // three game days at the default 2.4-minute day, from 1 pm on May 5
    D.SETTINGS.cycle = 144; D.SKY.hour = 13; D.setDate(K.MAY5);
    const steps = [];
    for (let i = 0; i < 3 * 1440; i++) { const m = D.SKY.mjd, h = D.SKY.hour; D.advanceClock(0.1); if (D.SKY.mjd !== m) steps.push([m, D.SKY.mjd, h, D.SKY.hour]); }
    o.days = { end: D.SKY.mjd, hour: D.SKY.hour, steps, text: D.dateText(D.SKY.mjd) };
    // the season's last day, 23:59, stepped past midnight
    D.SKY.hour = 23 + 59 / 60; D.setDate(D.SEASON_DATES.spring[1]);
    o.last = { mjd: D.SKY.mjd, text: D.dateText(D.SKY.mjd) };
    for (let i = 0; i < 3; i++) D.advanceClock(0.1);
    o.wrap = { mjd: D.SKY.mjd, hour: D.SKY.hour, text: D.dateText(D.SKY.mjd), dst: D.SKY.dst };
    // a date saved by crossing midnight (Apr 1 -> Apr 2), for a second page to read
    D.SKY.hour = 23.99; D.setDate(K.APR1);
    for (let i = 0; i < 3; i++) D.advanceClock(0.1);
    o.saved = { mjd: D.SKY.mjd, stored: JSON.parse(localStorage.getItem('drivingSimulator.settings.v1') || '{}').date };
    return o;
  }, K);
  ok('crossing midnight steps the date by exactly one: three game days from May 5 are May 8, the hour where it started', cal.days.end === MAY5 + 3 && cal.days.steps.length === 3
    && cal.days.steps.every(s => s[1] === s[0] + 1 && s[2] > 23.9 && s[3] < 0.1) && Math.abs(cal.days.hour - 13) < 1e-6 && cal.days.text === 'Fri May 8', cal.days);
  ok('Jun 20 at 23:59, stepped past midnight, becomes Mar 20 (the season wraps to its first day)', cal.last.mjd === JUN20 && cal.last.text === 'Sat Jun 20'
    && cal.wrap.mjd === MAR20 && cal.wrap.text === 'Fri Mar 20' && cal.wrap.hour > 0 && cal.wrap.hour < 0.1 && cal.wrap.dst === true, cal);
  // a second page in the same browser reads the saved date; a saved date outside spring falls back to May 5
  const visit = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e)));
    await p.goto(PAGE); await p.waitForFunction(() => window.__DS && window.__DS.SKY, null, { timeout: 60000 });
    const r = await p.evaluate(() => ({ mjd: window.__DS.SKY.mjd, date: window.__DS.SETTINGS.date, season: window.__DS.SETTINGS.season, text: window.__DS.dateText(window.__DS.SKY.mjd) }));
    await p.close(); return r; };
  const v1 = await visit();
  await page.evaluate(d => { const k = 'drivingSimulator.settings.v1', s = JSON.parse(localStorage.getItem(k) || '{}'); s.date = d; localStorage.setItem(k, JSON.stringify(s)); }, MJD(2026, 8, 1));
  const v2 = await visit();
  await page.evaluate(MAY5 => { const D = window.__DS; D.SKY.hour = 13; D.setDate(MAY5); }, MAY5);   // back to May 5, and the store back to this page's own settings
  ok('the date is saved at midnight and a second visit comes back to it; a saved date outside spring falls back to May 5',
    cal.saved.mjd === K.APR1 + 1 && cal.saved.stored === K.APR1 + 1 && v1.mjd === K.APR1 + 1 && v1.text === 'Thu Apr 2' && v2.mjd === MAY5 && v2.date === MAY5 && v2.season === 'spring', { saved: cal.saved, v1, v2 });
  const offs = await page.evaluate(K => {
    const D = window.__DS, C = [[K.MAY5, 13, -4], [K.MAY5 + 210, 12, -5], [K.MAY5 - 59, 12, -5], [K.MAY5 - 58, 1.99, -5], [K.MAY5 - 58, 2, -4], [K.MAY5 - 57, 0, -4],
      [K.NOV1 - 1, 23.5, -4], [K.NOV1, 1.99, -4], [K.NOV1, 2, -5], [K.NOV1 + 1, 0, -5], [K.MAR14 - 1, 12, -5], [K.MAR14, 1.99, -5], [K.MAR14, 2, -4], [K.MAR14 + 1, 0, -4]];
    return C.map(([m, h, want]) => ({ m, h, want, got: D.utcOffset(m, h), text: D.dateText(m) }));
  }, K);
  ok('utcOffset follows the US rule: EDT on May 5, EST on Dec 1, the change at 02:00 on Mar 8 and Nov 1, 2026 and on Mar 14, 2027',
    offs.every(c => c.got === c.want) && offs[3].text === 'Sun Mar 8' && offs[7].text === 'Sun Nov 1' && offs[11].text === 'Sun Mar 14', { wrong: offs.filter(c => c.got !== c.want), days: [offs[3].text, offs[7].text, offs[11].text] });
  const dstRun = await page.evaluate(K => {
    const D = window.__DS, o = {};
    const run = n => { const hs = []; let move = 0, prev = D.SKY.sun.slice();
      for (let i = 0; i < n; i++) { D.advanceClock(0.1); D.updateSky(); const s = D.SKY.sun;
        move = Math.max(move, Math.acos(Math.min(1, prev[0] * s[0] + prev[1] * s[1] + prev[2] * s[2])) * 180 / Math.PI); prev = s.slice(); hs.push([D.SKY.hour, D.SKY.dst]); }
      return { hs, move }; };
    D.SETTINGS.cycle = 144;
    // Nov 1, 2026 from 01:50 EDT, for two and a half game hours
    D.SETTINGS.season = 'autumn'; D.SKY.hour = 1 + 50 / 60; D.setDate(K.NOV1);
    const d0 = D.SKY.dst, f = run(150);
    const backs = f.hs.map((x, i) => i && x[0] < f.hs[i - 1][0] ? i : -1).filter(i => i >= 0);
    o.fall = { d0, backs: backs.length, after: backs.length ? f.hs[backs[0]] : null, end: f.hs[f.hs.length - 1], move: f.move };
    // Mar 14, 2027 from 01:50 EST, for half an hour
    D.SETTINGS.season = 'winter'; D.SKY.hour = 1 + 50 / 60; D.setDate(K.MAR14);
    const s0 = D.SKY.dst, g = run(30);
    const jumps = g.hs.map((x, i) => i && x[0] - g.hs[i - 1][0] > 0.5 ? i : -1).filter(i => i >= 0);
    o.spring = { s0, jumps: jumps.length, after: jumps.length ? g.hs[jumps[0]] : null, end: g.hs[g.hs.length - 1], move: g.move };
    D.SETTINGS.season = 'spring'; D.SKY.hour = 13; D.setDate(K.MAY5);
    o.restored = { season: D.SETTINGS.season, mjd: D.SKY.mjd, dst: D.SKY.dst };
    return o;
  }, K);
  const fa = dstRun.fall, sp = dstRun.spring;
  ok('the clock changes at 02:00 as Raleigh\'s does: Nov 1 falls back to 01:0x EST once and never again that night, Mar 14 springs forward, the sun moving < 0.5 deg across each',
    fa.d0 === true && fa.backs === 1 && fa.after[0] >= 1 && fa.after[0] < 1.1 && fa.after[1] === false && fa.end[0] > 3 && fa.end[1] === false && fa.move < 0.5
    && sp.s0 === false && sp.jumps === 1 && sp.after[0] >= 3 && sp.after[0] < 3.1 && sp.after[1] === true && sp.move < 0.5
    && dstRun.restored.season === 'spring' && dstRun.restored.mjd === MAY5 && dstRun.restored.dst === true, dstRun);
  // the sun from the date: declination and solar noon at local noon, and the sun's direction at 9 am and 5 pm
  const sunDates = await page.evaluate(([dates, home]) => {
    const D = window.__DS;
    const out = dates.map(mjd => { D.SKY.hour = 12; D.setDate(mjd); const r = { mjd, decl: D.SKY.decl, noon: D.SKY.solarNoon, dst: D.SKY.dst, sun: {} };
      for (const h of [9, 17]) { D.SKY.hour = h; D.updateSky(); r.sun[h] = D.SKY.sun.slice(); }
      return r; });
    D.SKY.hour = 13; D.setDate(home);
    return out;
  }, [[MAR20, MAY5, JUN20], MAY5]);
  const sunCmp = sunDates.map(r => ({ text: r.mjd, dDecl: r.decl - ownSun(jdOf(r.mjd, 12, -4)).dec, dNoonMin: (r.noon - ownNoon(r.mjd, -4)) * 60,
    dSun9: angDeg(r.sun[9], ownSun(jdOf(r.mjd, 9, -4)).v), dSun17: angDeg(r.sun[17], ownSun(jdOf(r.mjd, 17, -4)).v), decl: r.decl, noon: r.noon, dst: r.dst }));
  ok('the sun from the date: declination and solar noon within 0.1 deg and 1 min of the suite\'s own on Mar 20, May 5 and Jun 20 (and the sun within 0.1 deg at 9 am and 5 pm)',
    sunCmp.length === 3 && sunCmp.every(c => c.dst === true && Math.abs(c.dDecl) < 0.1 && Math.abs(c.dNoonMin) < 1 && c.dSun9 < 0.1 && c.dSun17 < 0.1), sunCmp);
  // the date in the settings' TIME section: shown, refreshed after a midnight on the next open, and the slider moves the hour only
  const dateUI = await page.evaluate(MAY5 => {
    const D = window.__DS, $ = id => document.getElementById(id), o = {};
    D.SETTINGS.cycle = 144; D.SKY.hour = 23 + 58 / 60; D.setDate(MAY5);
    D.openSettings();
    let r = $('date-val').closest('.row'); while (r && r.tagName !== 'H3') r = r.previousElementSibling;
    o.before = { shown: $('date-val').textContent, want: D.dateText(D.SKY.mjd), section: r && r.textContent, settings: !!$('date-val').closest('#settings') };
    D.closeSettings();
    for (let i = 0; i < 3; i++) D.advanceClock(0.1);
    D.openSettings();
    o.after = { shown: $('date-val').textContent, want: D.dateText(D.SKY.mjd), mjd: D.SKY.mjd };
    const el = $('tod'); el.value = '600'; el.dispatchEvent(new Event('input'));
    o.slide = { hour: D.SKY.hour, mjd: D.SKY.mjd, shown: $('date-val').textContent, clock: $('tod-val').textContent };
    D.closeSettings();
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return o;
  }, MAY5);
  ok('the TIME section shows the date (#date-val), which reads the next day after a midnight on the next open; the time-of-day slider moves the hour, not the date',
    dateUI.before.shown === 'Tue May 5' && dateUI.before.shown === dateUI.before.want && dateUI.before.section === 'TIME' && dateUI.before.settings
    && dateUI.after.mjd === MAY5 + 1 && dateUI.after.shown === 'Wed May 6' && dateUI.after.shown === dateUI.after.want
    && dateUI.slide.hour === 10 && dateUI.slide.mjd === MAY5 + 1 && dateUI.slide.shown === 'Wed May 6' && dateUI.slide.clock === '10:00 AM', dateUI);

  // ---- 4. the car: acceleration, braking, steering, reverse ----
  const car = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    const reset = s => { D.teleport(s); D.TRAFFIC.cars.length = 0; I.gasTarget = 0; I.brakeTarget = 0; I.gas = 0; I.brake = 0; I.steer = 0; I.wheelAngle = 0; I.wheelHeld = false; };
    // a long straight in a 2-lane section: find one
    let s0 = 200; for (let s = 200; s < 20000; s += 50) { let straight = true; for (let d = 0; d < 700; d += 10) if (Math.abs(D.at(s + d).th - D.at(s).th) > 0.02) { straight = false; break; } if (straight) { s0 = s; break; } }
    reset(s0);
    I.gasTarget = 1;
    let t = 0, t60 = null;
    while (t < 25) { D.tick(1 / 60); t += 1 / 60; if (t60 === null && P.vx >= 26.82) t60 = t; }
    const v25 = P.vx;
    // brake from 60 mph
    reset(s0); P.vx = 26.82; I.gasTarget = 0; I.brakeTarget = 1; I.brake = 1;
    const sb = P.s; let tb = 0; while (P.vx > 0.05 && tb < 10) { D.tick(1 / 60); tb += 1 / 60; }
    const brakeDist = P.s - sb;
    // steering left turns left (u falls, yaw rises relative to the road)
    reset(s0); P.vx = 15; I.brakeTarget = 0; I.brake = 0; I.wheelHeld = true; I.steer = 0.6;
    const y0 = P.yaw; for (let i = 0; i < 60; i++) D.tick(1 / 60);
    const turnL = { dyaw: P.yaw - y0, u: P.u };
    I.wheelHeld = false; I.steer = 0;
    // reverse: brake to a stop and keep holding; it takes a full second at 0 mph
    reset(s0); P.vx = 8; I.brakeTarget = 1; I.brake = 1;
    let tZero = null, tRev = null, tr = 0;
    for (let i = 0; i < 60 * 6; i++) { D.tick(1 / 60); tr += 1 / 60; if (tZero === null && Math.abs(P.vx) * 2.23694 < 0.5) tZero = tr; if (tRev === null && P.gear < 0) tRev = tr; }
    const gearR = P.gear, vR = P.vx;
    // steering in reverse at full reverse speed: a steady turn the way a real car turns, never a spin
    I.wheelHeld = true; I.steer = 0.5; const yawR0 = P.yaw; let maxR = 0, minVx = 0;
    for (let i = 0; i < 60 * 4; i++) { D.tick(1 / 60); maxR = Math.max(maxR, Math.abs(P.r)); minVx = Math.min(minVx, P.vx); }
    const revTurn = { r: P.r, maxR, dyaw: P.yaw - yawR0, vy: P.vy, vx: P.vx, minVx, kin: P.vx / P.V.wheelbase * Math.tan(P.steer) };
    I.wheelHeld = false; I.steer = 0;
    I.brakeTarget = 0; I.brake = 0; I.gasTarget = 1; for (let i = 0; i < 180; i++) D.tick(1 / 60);
    const gearBack = P.gear;
    I.gasTarget = 0; I.gas = 0;
    return { s0, t60, v25, brakeDist, turnL, gearR, vR, gearBack, tZero, tRev, revTurn, hold: D.REVERSE_HOLD };
  });
  ok('0-60 mph in a sedan-like 6-11 s', car.t60 !== null && car.t60 > 6 && car.t60 < 11, car.t60);
  ok('keeps accelerating past 60 mph toward its top speed', car.v25 > 30 && car.v25 < 59, car.v25);
  ok('stops from 60 mph in 30-50 m (about 0.9 g)', car.brakeDist > 30 && car.brakeDist < 50, car.brakeDist);
  ok('steering left turns the car left', car.turnL.dyaw > 0.05 && car.turnL.u < 1.6, car.turnL);
  ok('holding the brake at a standstill engages reverse and backs up', car.gearR === -1 && car.vR < -0.5, [car.gearR, car.vR]);
  ok('reverse waits for a full second at 0 mph with the brake held (1.0-1.25 s)', car.hold === 1 && car.tZero !== null && car.tRev !== null && car.tRev - car.tZero > 0.98 && car.tRev - car.tZero < 1.25, car);
  ok('steering in reverse turns the car steadily, the way a real car does (no spin)', car.revTurn.minVx < -4 && car.revTurn.maxR < 0.6 && car.revTurn.r < -0.15
    && Math.abs(car.revTurn.r - car.revTurn.kin) < 0.15 && Math.abs(car.revTurn.dyaw) < 2.4 && Math.abs(car.revTurn.vy) < 1.2, car.revTurn);
  ok('the accelerator at a standstill puts it back in drive', car.gearBack === 1, car.gearBack);

  // ---- 4b. cruise control ----
  const cruise = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT, C = D.CRUISE;
    const keepLane = () => { const q = D.at(P.s), u = D.laneCenter(0, q.L); P.yaw = q.th; P.x = q.x - q.tz * u; P.z = q.z + q.tx * u; P.vy = 0; P.r = 0; };
    const drive = (n) => { for (let i = 0; i < n; i++) { D.tick(1 / 60); keepLane(); } };
    D.teleport(3000); D.TRAFFIC.cars.length = 0; D.setCruise(false);
    I.gasTarget = 1; while (P.vx < 22) { D.tick(1 / 60); keepLane(); }
    I.gasTarget = 0; I.gas = 0;
    const on = D.setCruise(true), set = C.v;
    // 90 s over real grades: the speed stays put without a foot on a pedal
    let mn = 1e9, mx = -1e9, gMax = 0;
    for (let i = 0; i < 60 * 90; i++) { D.tick(1 / 60); keepLane(); mn = Math.min(mn, P.vx); mx = Math.max(mx, P.vx); gMax = Math.max(gMax, Math.abs(D.at(P.s + 2).y - D.at(P.s - 2).y) / 4); }
    // and with it off the same road bleeds speed (so the hold is the cruise control's doing)
    D.setCruise(false); const vOff0 = P.vx; drive(60 * 10); const vOffLoss = vOff0 - P.vx;
    P.vx = set; D.setCruise(true);
    // the accelerator overrides it; letting go brings the car back to the set speed
    I.gasTarget = 1; drive(180); const vOver = P.vx; I.gasTarget = 0; I.gas = 0;
    drive(60 * 30); const vBack = P.vx, stillOn = C.on;
    // the brake lets go of it
    I.brakeTarget = 1; drive(3); const offByBrake = !C.on; I.brakeTarget = 0; I.brake = 0;
    // it will not take a standstill
    D.teleport(3000); P.vx = 0; const refused = D.setCruise(true) === false && !C.on;
    return { on, set, mn, mx, gMax, vOffLoss, vOver, vBack, stillOn, offByBrake, refused };
  });
  ok('cruise control takes the current speed', cruise.on && Math.abs(cruise.set - 22) < 0.5, cruise);
  ok('cruise holds the set speed within 0.3 m/s for 90 s over the road\'s grades', cruise.mx - cruise.set < 0.3 && cruise.set - cruise.mn < 0.3 && cruise.gMax > 0.01, cruise);
  ok('without it the same road bleeds speed (the hold is the cruise control)', cruise.vOffLoss > 1, cruise.vOffLoss);
  ok('the accelerator overrides cruise and letting go settles back to the set speed', cruise.vOver > cruise.set + 1.5 && Math.abs(cruise.vBack - cruise.set) < 0.3 && cruise.stillOn, cruise);
  ok('the brake pedal switches cruise off', cruise.offByBrake, cruise);
  ok('cruise refuses a standstill', cruise.refused, cruise);

  // ---- 5. collisions: a tree, a building, another car ----
  const hit = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    // find a tree collider near the road in a forest chunk and drive at it
    let tree = null;
    for (let s = 300; s < 1000 && !tree; s += 96) {
      D.teleport(s); D.TRAFFIC.cars.length = 0;
      for (const ch of D.CHUNKS.values()) for (const c of ch.col.circ) {
        const q = D.project(c.x, c.z, s);
        if (Math.abs(q.s - s) < 60 && Math.abs(q.u) > q.p.Rr + 3 && Math.abs(q.u) < q.p.Rr + 14 && c.r > 0.2) { tree = c; break; }
      }
    }
    if (!tree) return { tree: null };
    const q = D.project(tree.x, tree.z, P.s);
    const a = D.at(q.s - 20);
    const [sx, sz] = [a.x - a.tz * q.u, a.z + a.tx * q.u];
    P.x = sx; P.z = sz; P.s = q.s - 20; P.yaw = Math.atan2(tree.x - sx, tree.z - sz); P.vx = 12; P.vy = 0; P.r = 0;
    I.gasTarget = 0; I.gas = 0; I.brakeTarget = 0; I.brake = 0;
    let minD = 1e9;
    for (let i = 0; i < 240; i++) { D.tick(1 / 60); minD = Math.min(minD, Math.hypot(P.x - tree.x, P.z - tree.z)); }
    const res = { tree: true, minD, vAfter: P.vx, halfW: P.V.width / 2 };
    return res;
  });
  ok('a tree near the road blocks the car (never passes through its trunk)', hit.tree && hit.minD > hit.halfW * 0.9, hit);
  ok('hitting a tree takes the speed out', hit.tree && Math.abs(hit.vAfter) < 6, hit);

  const crash = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    D.teleport(400); D.TRAFFIC.cars.length = 0;
    const c = D.spawnCar(P.s + 25, 1, 0, 0); c.f = 0; c.v = 0;
    P.vx = 15; I.gasTarget = 1;
    let minGap = 1e9;
    for (let i = 0; i < 180; i++) { D.tick(1 / 60); minGap = Math.min(minGap, (c.s - P.s) - (c.V.length + P.V.length) / 2); }
    I.gasTarget = 0; I.gas = 0;
    return { minGap, stopT: c.stopT, hazard: c.hazard, pv: P.vx };
  });
  ok('ramming a car ahead does not pass through it', crash.minGap > -0.6, crash);
  ok('the car that was hit puts its hazards on', crash.hazard === 1, crash);

  // ---- 6. traffic: keep right, no overlaps, merge before a lane ends ----
  const traffic = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    // start just before a 3 -> 2 lane drop so merges are exercised
    const S = D.ROAD.sect;
    const drop = S.find((sc, i) => i > 0 && S[i - 1].c.lanesPerDirection === 3 && sc.c.lanesPerDirection === 2);
    D.teleport(drop.s0 - 900);
    I.gasTarget = 0;
    let wrongSide = 0, overlaps = 0, offRoad = 0, steps = 0, inEnded = 0, maxCars = 0, laneChanges = 0;
    const seenLc = new Set();
    for (let i = 0; i < 60 * 90; i++) {
      // the player cruises in the right lane at the limit so the window moves through the drop
      const p = D.at(P.s), lim = D.sectionAt(P.s).c.speedLimitMph * 0.44704;
      const u = D.laneCenter(0, p.L);
      P.s += lim / 60; const q = D.at(P.s); const [x, z] = [q.x - q.tz * u, q.z + q.tx * u];
      P.x = x; P.z = z; P.yaw = q.th; P.vx = lim; P.vy = 0; P.r = 0;
      D.stepTraffic(1 / 60); steps++;
      const cars = D.TRAFFIC.cars; maxCars = Math.max(maxCars, cars.length);
      for (const c of cars) {
        if (c.lc && !seenLc.has(c.id + ':' + c.lc.from + '>' + c.lc.to)) { seenLc.add(c.id + ':' + c.lc.from + '>' + c.lc.to); laneChanges++; }
        if (c.off <= 0.2) wrongSide++;
        const cp = D.at(c.s);
        if (c.off > cp.L * 3.66 + 0.3) offRoad++;
        if (!c.lc && c.lane > 0 && cp.L - c.lane < 0.35) inEnded++;
      }
      if (i % 30 === 0) for (const a of cars) for (const b of cars) {
        if (a.id >= b.id || a.dir !== b.dir) continue;
        const la = a.lc ? [a.lc.from, a.lc.to] : [a.lane], lb = b.lc ? [b.lc.from, b.lc.to] : [b.lane];
        if (!la.some(l => lb.includes(l))) continue;
        if (Math.abs(a.s - b.s) < (a.V.length + b.V.length) / 2 - 0.3) overlaps++;
      }
    }
    return { steps, wrongSide, overlaps, offRoad, inEnded, maxCars, laneChanges, drop: drop.s0 };
  });
  ok('every car keeps to its own side of the centre line', traffic.wrongSide === 0, traffic);
  ok('no two cars in a lane overlap over 90 s through a lane drop', traffic.overlaps === 0, traffic);
  ok('no car drives off the paved lanes', traffic.offRoad === 0, traffic);
  ok('cars merge out of a lane before it tapers away', traffic.inEnded === 0, traffic);
  ok('traffic changes lanes (merging and passing happen)', traffic.laneChanges >= 3, traffic.laneChanges);
  ok('the road stays populated', traffic.maxCars >= 15, traffic.maxCars);

  const headOn = await page.evaluate(() => {
    const D = window.__DS, P = D.PLAYER, I = D.INPUT;
    D.teleport(400); D.TRAFFIC.cars.length = 0;
    // the player stops in the oncoming lane; an oncoming car must stop short
    const p = D.at(P.s), u = -D.laneCenter(0, p.L);
    P.x = p.x - p.tz * u; P.z = p.z + p.tx * u; P.u = u; P.vx = 0;
    const c = D.spawnCar(P.s + 160, -1, 0); c.v = 24;
    let minGap = 1e9;
    for (let i = 0; i < 60 * 15; i++) { D.stepTraffic(1 / 60); minGap = Math.min(minGap, (c.s - P.s) - (c.V.length + P.V.length) / 2); }
    return { minGap, v: c.v };
  });
  ok('an oncoming driver stops for a car stopped in their lane', headOn.minGap > 0.5 && headOn.v < 0.5, headOn);

  // ---- 7. controls: wheel, pedals, horn, views, settings ----
  await page.evaluate(() => window.__DS.setPaused(false));
  const ui = await page.evaluate(() => {
    const D = window.__DS, U = D.UI;
    return { wheel: U.wheel, gas: U.gas, brake: U.brake, speed: U.speed, w: innerWidth, h: innerHeight,
      chrome: ['back-btn', 'mute-btn', 'set-btn', 'view-btn'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()) };
  });
  const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= ui.w && r.y + r.h <= ui.h;
  const wheelR = { x: ui.wheel.x - ui.wheel.r, y: ui.wheel.y - ui.wheel.r, w: ui.wheel.r * 2, h: ui.wheel.r * 2 };
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  ok('wheel and pedals sit inside the screen', inside(wheelR) && inside(ui.gas) && inside(ui.brake), ui);
  ok('wheel, pedals and chrome do not overlap', !overlap(wheelR, ui.gas) && !overlap(wheelR, ui.brake) && !overlap(ui.gas, ui.brake)
    && ui.chrome.every(c => ![wheelR, ui.gas, ui.brake].some(r => overlap(r, { x: c.x, y: c.y, w: c.width, h: c.height }))), ui);
  // the same layout rules at phone sizes in both orientations, speed readout included
  const sweep = [];
  for (const [w, h] of [[390, 844], [844, 390], [375, 667], [667, 375], [430, 932], [1024, 768], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await frames(3);
    const u = await page.evaluate(() => { const U = window.__DS.UI; return { wheel: U.wheel, gas: U.gas, brake: U.brake, speed: U.speed, cruise: U.cruise, fps: U.fps, perf: U.perf, w: innerWidth, h: innerHeight,
      chrome: ['back-btn', 'mute-btn', 'set-btn', 'view-btn'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()) }; });
    const wr = { x: u.wheel.x - u.wheel.r, y: u.wheel.y - u.wheel.r, w: u.wheel.r * 2, h: u.wheel.r * 2 };
    // the touch pads around the pedals (14 px) and the cruise button (6 px) must not reach each other either
    const pad = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
    if (!u.fps || !u.perf) sweep.push(`${w}x${h} perf stats not laid out`);
    const rects = { wheel: wr, gas: pad(u.gas, 14), brake: u.brake, speed: u.speed, cruise: pad(u.cruise, 6), fps: u.fps || { x: -1, y: -1, w: 0, h: 0 }, perf: u.perf || { x: -1, y: -1, w: 0, h: 0 } };
    u.chrome.forEach((c, i) => { rects['chrome' + i] = { x: c.x, y: c.y, w: c.width, h: c.height }; });
    const names = Object.keys(rects);
    for (const n of names) if (!['gas', 'cruise'].includes(n) && !(rects[n].x >= 0 && rects[n].y >= 0 && rects[n].x + rects[n].w <= u.w && rects[n].y + rects[n].h <= u.h)) sweep.push(`${w}x${h} ${n} off screen`);
    for (const n of ['gas', 'cruise']) { const r = u[n]; if (!(r.x >= 0 && r.y >= 0 && r.x + r.w <= u.w && r.y + r.h <= u.h)) sweep.push(`${w}x${h} ${n} off screen`); }
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (names[i].startsWith('chrome') && names[j].startsWith('chrome')) continue;
      if (overlap(rects[names[i]], rects[names[j]])) sweep.push(`${w}x${h} ${names[i]}/${names[j]}`);
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await frames(3);
  ok('controls, cruise button, speed readout, FPS, stats and chrome fit without overlapping at seven phone/tablet sizes', sweep.length === 0, sweep);

  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
  const W = ui.wheel;
  // grab the rim at 12 o'clock and turn it a quarter turn clockwise (to the right)
  await touch('touchStart', [[W.x, W.y - W.r * 0.85, 1]]);
  for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI / 2; await touch('touchMove', [[W.x + Math.cos(a) * W.r * 0.85, W.y + Math.sin(a) * W.r * 0.85, 1]]); }
  const turned = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, held: window.__DS.INPUT.wheelHeld }));
  // press the accelerator with a second finger while steering
  const G = ui.gas;
  await touch('touchMove', [[W.x + W.r * 0.85, W.y, 1], [G.x + G.w / 2, G.y + G.h / 2, 2]]);
  await touch('touchStart', [[W.x + W.r * 0.85, W.y, 1], [G.x + G.w / 2, G.y + G.h / 2, 2]]);
  await frames(8);
  const both = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, gas: window.__DS.INPUT.gas }));
  await touch('touchEnd', []);
  await frames(30);
  const released = await page.evaluate(() => ({ steer: window.__DS.INPUT.steer, gas: window.__DS.INPUT.gas, held: window.__DS.INPUT.wheelHeld }));
  ok('turning the on-screen wheel clockwise steers right', turned.held && turned.steer < -0.4, turned);
  ok('a second finger on the accelerator works while steering', both.gas > 0.2 && both.steer < -0.4, both);
  ok('a released wheel springs back to centre and the pedal lets go', Math.abs(released.steer) < 0.05 && released.gas < 0.05 && !released.held, released);
  await touch('touchStart', [[W.x, W.y, 3]]);
  const horn = await page.evaluate(() => window.__DS.INPUT.horn);
  await touch('touchEnd', []);
  const hornOff = await page.evaluate(() => window.__DS.INPUT.horn);
  ok('tapping the middle of the wheel sounds the horn while held', horn === true && hornOff === false, [horn, hornOff]);

  // cruise: a second finger taps the button while the first holds the accelerator
  await page.evaluate(() => { const D = window.__DS; D.setPaused(true); D.teleport(3000); D.TRAFFIC.cars.length = 0; D.PLAYER.vx = 20; D.setCruise(false); });
  const CB = await page.evaluate(() => window.__DS.UI.cruise);
  const GP = await page.evaluate(() => window.__DS.UI.gas);
  await touch('touchStart', [[GP.x + GP.w / 2, GP.y + GP.h / 2, 5]]);
  await touch('touchStart', [[GP.x + GP.w / 2, GP.y + GP.h / 2, 5], [CB.x + CB.w / 2, CB.y + CB.h / 2, 6]]);
  await touch('touchEnd', [[CB.x + CB.w / 2, CB.y + CB.h / 2, 6]]);   // CDP lifts the fingers a touchEnd NAMES; the gas finger stays down
  const ccOn = await page.evaluate(() => ({ on: window.__DS.CRUISE.on, gasHeld: window.__DS.INPUT.gasTarget }));
  await touch('touchEnd', []);
  await touch('touchStart', [[CB.x + CB.w / 2, CB.y + CB.h / 2, 7]]);
  await touch('touchEnd', []);
  const ccOff = await page.evaluate(() => window.__DS.CRUISE.on);
  ok('tapping the cruise button with a finger on the accelerator turns cruise on, a second tap off', ccOn.on === true && ccOn.gasHeld === 1 && ccOff === false, [ccOn, ccOff]);
  await page.evaluate(() => { window.__DS.teleport(400); window.__DS.setPaused(false); });

  // the settings menu pauses the game: no driving, traffic or clock while it is open
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.cycle = 144; D.INPUT.gasTarget = 1; });
  await frames(4);
  await page.click('#set-btn');
  await frames(2);
  const p0 = await page.evaluate(() => { const D = window.__DS; return { s: D.PLAYER.s, h: D.SKY.hour, cars: D.TRAFFIC.cars.map(c => c.s).join() }; });
  await frames(6);
  const p1 = await page.evaluate(() => { const D = window.__DS; return { s: D.PLAYER.s, h: D.SKY.hour, cars: D.TRAFFIC.cars.map(c => c.s).join(), open: D.menuOpen() }; });
  await page.keyboard.press('Escape');
  await frames(6);
  const p2 = await page.evaluate(() => { const D = window.__DS; D.INPUT.gasTarget = 0; return { s: D.PLAYER.s, h: D.SKY.hour, open: D.menuOpen() }; });
  ok('opening settings pauses the car, the traffic and the clock', p1.open && p1.s === p0.s && p1.h === p0.h && p1.cars === p0.cars, [p0.s, p1.s, p0.h, p1.h]);
  ok('Escape closes settings and the game carries on', !p2.open && p2.s > p1.s && p2.h !== p1.h, [p1.s, p2.s]);

  const views = [];
  for (let k = 0; k < 3; k++) { await page.click('#view-btn'); await frames(3); views.push(await page.evaluate(() => [window.__DS.CAM.mode, window.__DS.SETTINGS.view])); }
  ok('the view button goes cockpit -> chase -> orbit -> cockpit and remembers it', views.map(v => v[0]).join() === '1,2,0' && views.every(v => v[0] === v[1]), views);

  await page.click('#set-btn');
  const panel = await page.evaluate(() => ({ open: document.getElementById('settings').classList.contains('open'), cyc: document.getElementById('cycle-sel').value }));
  await page.selectOption('#cycle-sel', '600');
  const cyc600 = await page.evaluate(() => window.__DS.SETTINGS.cycle);
  await page.selectOption('#cycle-sel', '144');
  await page.click('#set-close');
  ok('settings open on the cog and offer the day length (2.4 min selected)', panel.open && panel.cyc === '144', panel);
  ok('changing the day length in settings takes effect', cyc600 === 600, cyc600);
  const season = await page.evaluate(() => { const el = document.getElementById('season-sel');
    return { v: el.value, saved: window.__DS.SETTINGS.season, opts: [...el.options].map(o => [o.value, o.disabled]), section: el.closest('.row').previousElementSibling.querySelector('select')?.id };
  });
  ok('a season dropdown in TIME: spring selected, summer, autumn and winter listed but not selectable', season.v === 'spring' && season.saved === 'spring' && season.section === 'cycle-sel'
    && JSON.stringify(season.opts) === JSON.stringify([['spring', false], ['summer', true], ['autumn', true], ['winter', true]]), season);

  // ---- 8. pixels: a real picture, and night is darker than day ----
  const lum = async () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => {
    const c = document.getElementById('gl'), g = c.getContext('webgl2');
    const w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    let s = 0, n = 0, distinct = new Set();
    for (let i = 0; i < px.length; i += 4 * 97) { s += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; n++; distinct.add(px[i] >> 4 << 8 | px[i + 1] >> 4 << 4 | px[i + 2] >> 4); }
    r({ mean: s / n, distinct: distinct.size });
  })));
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.cycle = 0; D.SKY.hour = 12; D.CAM.mode = 1; });
  await frames(4);
  const day = await lum();
  await page.evaluate(() => { window.__DS.SKY.hour = 0.5; });
  await frames(4);
  const night = await lum();
  ok('the frame is a real picture (many distinct colours)', day.distinct > 40, day);
  ok('midnight is much darker than noon', night.mean < day.mean * 0.45, [day.mean, night.mean]);

  // ---- 9. sound: one volume per sound, the radio's stations, measured off the analysers ----
  const lv = async (keys, secs = 2) => page.evaluate(async ([keys, secs]) => { const S = window.__DS.SND, acc = {}; for (const k of keys) acc[k] = 0; const n = secs * 20;
    for (let i = 0; i < n; i++) { for (const k of keys) acc[k] += (S.rms(k) || 0) ** 2; await new Promise(r => setTimeout(r, 50)); }
    for (const k of keys) acc[k] = Math.sqrt(acc[k] / n); return acc; }, [keys, secs]);
  const setVol = (k, v) => page.evaluate(([k, v]) => { const D = window.__DS; D.SETTINGS.vols[k] = v; D.SND.apply(); }, [k, v]);
  await page.evaluate(() => { const D = window.__DS; D.setPaused(true); D.SETTINGS.muted = false; D.SETTINGS.station = 0; D.SND.tune(); D.SND.apply();
    D.CAM.mode = 1; D.SKY.hour = 12; D.updateSky(); D.PLAYER.vx = 25; D.PLAYER.thr = 0.5; });
  await page.waitForTimeout(1500);
  const lvOn = await lv(['sfx', 'music', 'engine', 'tyres', 'wind', 'ambient']);
  await setVol('music', 0); await page.waitForTimeout(2500);
  const lvOff = await lv(['sfx', 'music']);
  await setVol('music', 100);
  await setVol('engine', 0); await page.waitForTimeout(600);
  const engOff = await lv(['engine', 'tyres', 'wind', 'music']);
  await setVol('engine', 100); await setVol('engine', 50); await page.waitForTimeout(600);
  const engHalf = await lv(['engine']);
  await setVol('engine', 100);
  ok('the engine is audible and the radio sits near it (0.5-1.6x the engine)', lvOn.engine > 0.02 && lvOn.music > 0.5 * lvOn.engine && lvOn.music < 1.6 * lvOn.engine, lvOn);
  ok('the ambient bed is there by day but well under the engine (0.05-0.4x)', lvOn.ambient > 0.05 * lvOn.engine && lvOn.ambient < 0.4 * lvOn.engine, lvOn);
  ok('the radio slider at 0 silences the music bus and nothing else', lvOff.music < 0.002 && lvOff.sfx > 0.02, lvOff);
  ok('the engine slider at 0 silences the engine while tyres, wind and radio play on', engOff.engine < 0.0005 && engOff.tyres > 0.005 && engOff.wind > 0.005 && engOff.music > 0.01, engOff);
  ok('the engine slider half way is a quarter of the level (a squared taper)', Math.abs(engHalf.engine / lvOn.engine - 0.25) < 0.08, [engHalf.engine, lvOn.engine]);
  // every sound has its own slider in the menu, and the radio's on/off switch is gone
  const menu = await page.evaluate(() => ({ chans: [...document.querySelectorAll('input.chan')].map(e => e.dataset.k), radioSel: !!document.getElementById('radio-sel'),
    stations: [...document.getElementById('station-sel').options].map(o => o.textContent), firstRow: document.querySelector('#settings h3:nth-of-type(4) + .row select')?.id,
    keys: window.__DS.SETTINGS.vols && Object.keys(window.__DS.SETTINGS.vols) }));
  ok('settings have a volume slider for radio, ambient, engine and every other sound', ['music', 'ambient', 'engine', 'tyres', 'wind', 'skid', 'crash', 'horn', 'ui'].every(k => menu.chans.includes(k)) && !menu.radioSel, menu);
  ok('a radio station selector heads the sound section, with four stations', menu.firstRow === 'station-sel' && menu.stations.length === 4, menu);
  // a slider for a one-shot sound plays a sample of it when let go, through its own channel
  const preview = await page.evaluate(async () => { const S = window.__DS.SND; let m = 0; const el = document.getElementById('vol-horn'); el.dispatchEvent(new Event('change'));
    for (let i = 0; i < 6; i++) { m = Math.max(m, S.rms('horn') || 0); await new Promise(r => setTimeout(r, 40)); } return m; });
  ok('letting go of the horn slider sounds the horn so the level can be heard', preview > 0.01, preview);
  // the stations are level-matched (the selector is not a volume control)
  const st = [];
  for (let k = 0; k < 4; k++) {
    await page.evaluate(k => { const D = window.__DS; D.SETTINGS.station = k; D.SND.tune(); }, k);
    await page.waitForTimeout(800);
    st.push((await lv(['music'], 8)).music);
  }
  await page.evaluate(() => { const D = window.__DS; D.SETTINGS.station = 0; D.SND.tune(); D.PLAYER.thr = 0; });
  ok('all four stations play and sit within 25% of each other', st.every(v => v > 0.015) && Math.max(...st) / Math.min(...st) < 1.25, st);

  // ---- 10. performance stats: pure green FPS at the top, the rest on the left, both behind a setting ----
  const greenIn = R => page.evaluate(R => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!R) return res(-1);
    const c = document.getElementById('hud'), g = c.getContext('2d'), d = devicePixelRatio > 0 ? Math.min(devicePixelRatio, 2) : 1;
    const px = g.getImageData(Math.round(R.x * d), Math.round(R.y * d), Math.round(R.w * d), Math.round(R.h * d)).data;
    let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200 && px[i] < 30 && px[i + 1] > 235 && px[i + 2] < 30) n++;
    res(n);
  }))), R);
  await page.evaluate(() => { const D = window.__DS; D.setPaused(false); D.SETTINGS.perf = 2; D.layoutUI(); });
  await frames(6);
  const pf = await page.evaluate(() => ({ fps: window.__DS.UI.fps, perf: window.__DS.UI.perf, out: window.__DS.PERF.out, def: window.__DS.SETTINGS.perf }));
  const gFps = await greenIn(pf.fps), gBlock = await greenIn(pf.perf);
  const pick = v => page.evaluate(v => { const el = document.getElementById('perf-sel'); el.value = v; el.dispatchEvent(new Event('change')); }, v);
  await pick('1');
  await frames(3);
  const only = await page.evaluate(() => ({ fps: !!window.__DS.UI.fps, perf: window.__DS.UI.perf }));
  const gFps1 = await greenIn(pf.fps), gBlock1 = await greenIn(pf.perf);
  await pick('0');
  await frames(3);
  const gFps0 = await greenIn(pf.fps);
  await pick('2');
  ok('performance stats default to on', pf.def === 2, pf.def);
  ok('the FPS is drawn in pure green at the top centre', gFps > 40 && pf.fps.y < 60 && Math.abs(pf.fps.x + pf.fps.w / 2 - 422) < 2, [gFps, pf.fps]);
  ok('the detail block shows frame, CPU, GPU, draw calls, triangles and more', gBlock > 200 && pf.out.fps > 0 && pf.out.ms > 0 && pf.out.calls > 20 && pf.out.tris > 1000 && pf.out.r3d > 0, [gBlock, pf.out]);
  ok('"FPS only" keeps the FPS and drops the block; "off" drops both', only.fps && only.perf === null && gFps1 > 40 && gBlock1 < 5 && gFps0 < 5, [gFps1, gBlock1, gFps0]);

  ok('no page errors', errors.length === 0, errors.slice(0, 5));
  await browser.close();
  console.log(`DRIVING SIMULATOR DRIVE: ${pass} passed, ${fail} failed` + TAIL);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`DRIVING SIMULATOR DRIVE: ${pass} passed, ${fail + 1} failed` + TAIL); process.exit(1); });
