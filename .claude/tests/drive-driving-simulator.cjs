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
const fs = require('fs');
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
// any body from its RA/Dec of date (degrees) at Raleigh, through the suite's own GMST: { alt, az, v: [east, up, north] }
function ownAltAz(ra, dec, jd) {
  const H = (gmst(jd) + RAL.lon - ra) * DR, d = dec * DR, la = RAL.lat * DR;
  const v = [-Math.cos(d) * Math.sin(H), Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(H), Math.sin(d) * Math.cos(la) - Math.cos(d) * Math.sin(la) * Math.cos(H)];
  return { alt: Math.asin(v[1]) / DR, az: ((Math.atan2(v[0], v[2]) / DR) % 360 + 360) % 360, v };
}
const altAzOf = v => ({ alt: Math.asin(Math.max(-1, Math.min(1, v[1]))) / DR, az: ((Math.atan2(v[0], v[2]) / DR) % 360 + 360) % 360 });
const dAz = (a, b, alt) => Math.abs(((a - b + 540) % 360) - 180) * Math.cos(alt * DR);   // on-sky separation along the almucantar
// SIMBAD J2000 (ICRS) positions, typed in sexagesimal: RA h m s, Dec d ' "
const hms = t => { const [h, m, x] = t.split(' ').map(Number); return (h + m / 60 + x / 3600) * 15; };
const dms = t => { const g = t[0] === '-' ? -1 : 1, [d, m, x] = t.replace(/^[+-]/, '').split(' ').map(Number); return g * (d + m / 60 + x / 3600); };
const SIMBAD = { Polaris: [11767, '02 31 49.09', '+89 15 50.8'], Regulus: [49669, '10 08 22.311', '+11 58 01.95'], Arcturus: [69673, '14 15 39.672', '+19 10 56.67'],
  Spica: [65474, '13 25 11.579', '-11 09 40.75'], Dubhe: [54061, '11 03 43.672', '+61 45 03.72'], Vega: [91262, '18 36 56.336', '+38 47 01.28'],
  Betelgeuse: [27989, '05 55 10.305', '+07 24 25.43'], Sirius: [32349, '06 45 08.917', '-16 42 58.02'], Rigel: [24436, '05 14 32.272', '-08 12 05.90'] };
const unitRD = (ra, dec) => [Math.cos(dec * DR) * Math.cos(ra * DR), Math.cos(dec * DR) * Math.sin(ra * DR), Math.sin(dec * DR)];
// Meeus 21.2-21.4: IAU 1976 precession of a J2000 RA/Dec (degrees) to the mean equator of date (TT = UT)
function precess(ra, dec, jd) {
  const t = (jd - 2451545) / 36525, as = DR / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * as, z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * as;
  const th = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * as, a0 = ra * DR + zeta, d0 = dec * DR;
  const A = Math.cos(d0) * Math.sin(a0), B = Math.cos(th) * Math.cos(d0) * Math.cos(a0) - Math.sin(th) * Math.sin(d0), C = Math.sin(th) * Math.cos(d0) * Math.cos(a0) + Math.cos(th) * Math.sin(d0);
  return { ra: (((Math.atan2(A, B) + z) / DR) % 360 + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, C))) / DR };
}
const raDecOf = v => ({ ra: ((Math.atan2(v[1], v[0]) / DR) % 360 + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DR });
// the precession as a matrix (J2000 -> of date, rows), by its action on the three axes; a rotation, so its transpose goes back
function precM(jd) { const c = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => { const r = raDecOf(v), q = precess(r.ra, r.dec, jd); return unitRD(q.ra, q.dec); });
  return [[c[0][0], c[1][0], c[2][0]], [c[0][1], c[1][1], c[2][1]], [c[0][2], c[1][2], c[2][2]]]; }
const mulT = (M, v) => [0, 1, 2].map(i => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]);   // transpose(M) * v
const mul3 = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);                    // a page row-major flat 9 too, via rows3
const rows3 = m => [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
// a SIMBAD J2000 star, precessed by the suite, at Raleigh through its own GMST: { alt, az, v }
const ownStar = (name, jd) => { const [, ra, dec] = SIMBAD[name], q = precess(hms(ra), dms(dec), jd); return ownAltAz(q.ra, q.dec, jd); };
// an ENU direction back to J2000 through the suite's own GMST and precession (for the galactic latitude)
function enuToJ2000(v, jd) { const la = RAL.lat * DR, sd = Math.sin(la) * v[1] + Math.cos(la) * v[2], cdc = Math.cos(la) * v[1] - Math.sin(la) * v[2];
  const H = Math.atan2(-v[0], cdc) / DR, dec = Math.asin(Math.max(-1, Math.min(1, sd))) / DR, ra = gmst(jd) + RAL.lon - H;
  return mulT(precM(jd), unitRD(ra, dec)); }
const GAL_POLE = unitRD(192.85948, 27.12825);   // the IAU galactic north pole, J2000
const galB = vJ => Math.asin(Math.max(-1, Math.min(1, vJ[0] * GAL_POLE[0] + vJ[1] * GAL_POLE[1] + vJ[2] * GAL_POLE[2]))) / DR;
const enuOf = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
// The page's world frame is (east, up, SOUTH): its renderer is right-handed (an OpenGL lookAt), so ENU's north is world -z.
const enuToWorldOwn = v => [v[0], v[1], -v[2]];
// Meeus 49.1: the MEAN new (integer k) and full (k + 0.5) moons, JDE; delta-T (about 70 s) ignored
function meanPhase(k) { const T = k / 1236.85; return 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T; }
// astronomy-engine 2.1.19 (zmh-sky vectors/golden.v1.json, never shipped): the oracle's values at 2026-05-06 02:00 UT
const AE = {
  sun: { alt: -20.881657475, az: 310.517712321 },     // record 2026-05-06T02Z/raleigh/sun
  moon: { alt: -23.14562993, az: 109.087015027 },     // record 2026-05-06T02Z/raleigh/moon (topocentric)
  moonIllum: 0.835373145,                             // record 2026-05-06T02Z/geo/moon, moonIllumFraction
  ven: { ra: 72.973356438, dec: 23.639460993, mag: -3.885724 },   // record 2026-05-06T02Z/geo/ven (geocentric, true equator of date)
  jup: { ra: 111.326408898, dec: 22.388555784, mag: -1.998412 },  // record 2026-05-06T02Z/geo/jup
  // the eight stars of the plan's 22:00 table, alt / az: records 2026-05-06T02Z/raleigh/hip<N>
  stars: { Regulus: [58.382346645, 226.504116082], Arcturus: [51.957838582, 105.537348892], Spica: [36.757145909, 147.113228099], Dubhe: [63.557205467, 350.414652531],
    Vega: [12.234204709, 50.64338272], Betelgeuse: [7.428322881, 273.807102779], Sirius: [2.821716365, 246.980207024], Polaris: [35.386323342, 359.402707464] },
};

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

  // ---- 3c. the sky from zmh-sky: the spliced block, one sun, the moon in its real place, the planets ----
  // The fixed moment is May 5, 2026 at 22:00 EDT = 2026-05-06 02:00 UT, the kit's golden instant.
  const pageFile = COPY ? process.env.DS_PAGE : path.join(process.cwd(), 'games', 'driving-simulator', 'index.html');
  // the licence ships beside the game, never beside a copy under test (copies live in a scratch dir)
  const licFile = path.join(process.cwd(), 'games', 'driving-simulator', 'LICENSE-d3-celestial.txt');
  const src = fs.readFileSync(pageFile, 'utf8');
  const bi = src.indexOf('/*ZMH-SKY:BEGIN*/'), head = bi < 0 ? '' : src.slice(bi, src.indexOf('\n', src.indexOf('\n', src.indexOf('\n', bi) + 1) + 1));
  const ATTR = /Star data: XHIP \(Anderson & Francis 2012\) via d3-celestial, \(c\) 2015 ([^,;]+), BSD-3-Clause; constellation lines after the IAU figures, modified by [^;]+; planet elements: JPL \(Standish\), Table 1\./;
  const attr = head.match(ATTR), lic = fs.existsSync(licFile) ? fs.readFileSync(licFile, 'utf8') : '';
  const licHolder = (lic.match(/^Copyright \(c\) 2015, (.+)$/m) || [])[1];
  const want = Object.fromEntries(Object.entries(SIMBAD).map(([n, [hip, ra, dec]]) => [hip, { n, ra: hms(ra), dec: dms(dec) }]));
  const blk = await page.evaluate(hips => {
    const D = window.__DS, S = D.SKY_DATA.stars, F = S.fields, R = S.rows, I = k => F.indexOf(k);
    const notes = document.getElementById('sky-notes'), a = notes && notes.querySelector('a');
    return { fields: F.join(), n: R.length, maxMag: Math.max(...R.map(r => r[I('mag')])),
      raBad: R.filter(r => !(r[I('ra')] >= 0 && r[I('ra')] < 360)).length, decBad: R.filter(r => !(r[I('dec')] >= -90 && r[I('dec')] <= 90)).length,
      named: hips.map(h => { const r = R.find(r => r[I('hip')] === h); return r ? { hip: h, ra: r[I('ra')], dec: r[I('dec')] } : { hip: h, missing: true }; }),
      notes: notes ? notes.textContent : null, href: a ? a.getAttribute('href') : null, inSettings: !!(notes && notes.closest('#settings')),
      lib: typeof D.ZMH_SKY.skyAt === 'function' && typeof ZMH_SKY_GLSL === 'object' };
  }, Object.keys(want).map(Number));
  const starOff = blk.named.map(r => r.missing ? { hip: r.hip, missing: true } : { hip: r.hip, name: want[r.hip].n, off: angDeg(unitRD(r.ra, r.dec), unitRD(want[r.hip].ra, want[r.hip].dec)) });
  ok('the zmh-sky block: its header names zmh-sky and carries the attribution; 1,500-1,750 stars to mag 5, RA in [0, 360), Dec in [-90, 90]; the nine named stars by HIP within 0.01 deg of SIMBAD; the notes carry the attribution and link the licence beside the game',
    /GENERATED by zmh-sky/.test(head) && !!attr && blk.lib && blk.fields === 'hip,ra,dec,mag,bv' && blk.n >= 1500 && blk.n <= 1750 && blk.maxMag <= 5.0 && blk.raBad === 0 && blk.decBad === 0
    && starOff.length === 9 && starOff.every(r => !r.missing && r.off < 0.01)
    && blk.inSettings && blk.notes !== null && blk.notes.includes(attr[0]) && blk.href === 'LICENSE-d3-celestial.txt' && /Redistribution and use/.test(lic) && licHolder === attr[1],
    { header: !!attr, n: blk.n, maxMag: blk.maxMag, raBad: blk.raBad, decBad: blk.decBad, starOff, notes: blk.notes && blk.notes.slice(0, 60), href: blk.href, lic: lic.length, holderMatch: !!attr && licHolder === attr[1] });
  const JD22 = jdOf(MAY5, 22, -4);
  const phases = []; for (let k = 300; k <= 340; k += 0.5) { const jd = meanPhase(k); if (jd - 2400000.5 >= MJD(2026, 5, 1) && jd - 2400000.5 < MJD(2026, 6, 1)) phases.push({ k, jd, full: k % 1 !== 0 }); }
  // a JD to the page's date and EDT clock (all of May is EDT)
  const atJD = phases.map(p => { const loc = p.jd - 2400000.5 - 4 / 24, mjd = Math.floor(loc); return { ...p, mjd, hour: (loc - mjd) * 24 }; });
  const sky = await page.evaluate(([MAY5, JD22, atJD]) => {
    const D = window.__DS, o = {};
    const ang = (a, b) => { const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      return Math.atan2(Math.hypot(c[0], c[1], c[2]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180 / Math.PI; };
    D.SKY.hour = 22; D.setDate(MAY5);
    const ref = D.ZMH_SKY.skyAt(JD22, D.OBS_SKY, D.SKY_DATA.planets);
    o.obs = D.OBS_SKY; o.sun = D.SKY.sun.slice(); o.sunVsKit = ang(D.SKY.sun, ref.sun.enu); o.moon = D.SKY.moon.slice(); o.moonPhase = D.SKY.moonPhase;
    o.planets = D.SKY.planets.map(p => ({ id: p.id, mag: p.mag, valid: p.valid, enu: p.enu.slice(), altDeg: p.altDeg, azDeg: p.azDeg }));
    o.hookSolar = 'solar' in D;
    o.anchors = atJD.map(a => { D.SKY.hour = a.hour; D.setDate(a.mjd); return { k: a.k, full: a.full, mjd: a.mjd, hour: a.hour, dst: D.SKY.dst, sep: ang(D.SKY.sun, D.SKY.moon) }; });
    D.SKY.hour = 6.25; D.setDate(MAY5);
    o.restored = { mjd: D.SKY.mjd, hour: D.SKY.hour };
    return o;
  }, [MAY5, JD22, atJD]);
  const sunAA = altAzOf(sky.sun);
  ok('one sun, the kit\'s: SKY.sun is skyAt(julianDate()).sun.enu (under 1e-6 deg) and within 0.05 deg of astronomy-engine at 22:00 EDT on May 5 (-20.882 / 310.518); no solar() or celestial() left',
    sky.sunVsKit < 1e-6 && Math.abs(sunAA.alt - AE.sun.alt) < 0.05 && dAz(sunAA.az, AE.sun.az, AE.sun.alt) < 0.05
    && !sky.hookSolar && !/function solar\(|function celestial\(/.test(src) && sky.obs.latDeg === RAL.lat && sky.obs.lonEastDeg === RAL.lon && sky.obs.heightM === 0,
    { sunVsKit: sky.sunVsKit, sun: sunAA, ae: AE.sun, hookSolar: sky.hookSolar, obs: sky.obs });
  const moonAA = altAzOf(sky.moon), full = sky.anchors.filter(a => a.full), nw = sky.anchors.filter(a => !a.full);
  ok('the moon in its real place: topocentric within 0.3 deg of astronomy-engine at 22:00 EDT on May 5 (-23.146 / 109.087), its lit fraction kept; at the Meeus mean full moons of May 2026 it is within 15 deg of opposite the sun, at the mean new moon within 15 deg of it',
    Math.abs(moonAA.alt - AE.moon.alt) < 0.3 && dAz(moonAA.az, AE.moon.az, AE.moon.alt) < 0.3
    && !!sky.moonPhase && Math.abs(sky.moonPhase.illuminatedFraction - AE.moonIllum) < 0.01 && typeof sky.moonPhase.waxing === 'boolean'
    && full.length === 2 && nw.length === 1 && sky.anchors.every(a => a.dst === true) && full.every(a => Math.abs(a.sep - 180) < 15) && nw.every(a => a.sep < 15)
    && sky.restored.mjd === MAY5 && sky.restored.hour === 6.25,
    { moon: moonAA, ae: AE.moon, phase: sky.moonPhase, anchors: sky.anchors });
  const pl = Object.fromEntries(sky.planets.map(p => [p.id, p]));
  const plCmp = ['ven', 'jup'].map(id => { const o = ownAltAz(AE[id].ra, AE[id].dec, JD22), p = pl[id] || {}, e = p.enu ? altAzOf(p.enu) : {};
    return { id, dAlt: p.altDeg - o.alt, dAz: dAz(p.azDeg, o.az, o.alt), dEnu: p.enu ? angDeg(p.enu, o.v) : null, dFields: p.enu ? Math.abs(e.alt - p.altDeg) + dAz(e.az, p.azDeg, e.alt) : null, mag: p.mag, own: o.alt.toFixed(2) + '/' + o.az.toFixed(2) }; });
  ok('the planets: exactly Mercury, Venus, Mars, Jupiter and Saturn, all valid; Venus and Jupiter within 0.3 deg of the suite\'s own alt/az from astronomy-engine\'s RA/Dec at 22:00 EDT on May 5; Venus brighter than -3.5, Jupiter than -1.5',
    sky.planets.length === 5 && sky.planets.map(p => p.id).sort().join() === 'jup,mar,mer,sat,ven' && sky.planets.every(p => p.valid === true)
    && plCmp.every(c => Math.abs(c.dAlt) < 0.3 && c.dAz < 0.3 && c.dEnu < 0.3 && c.dFields < 1e-6) && (pl.ven || {}).mag < -3.5 && (pl.jup || {}).mag < -1.5,
    { ids: sky.planets.map(p => p.id), plCmp });

  // ---- 3d. the stars: sidereal time, the pole of date, the stars' places and motion ----
  // The page's star directions are __DS.starDir(i): the vertex's J2000 vector through SKY.starM, as the GPU is given it.
  const HIP = Object.fromEntries(Object.entries(SIMBAD).map(([n, [hip]]) => [n, hip]));
  const LSTT = [[MAY5, 0], [MAY5, 4.5], [MAY5, 9.25], [MAY5, 13], [MAY5, 18.75], [MAY5, 22]];
  const st3 = await page.evaluate(([MAY5, HIP, LSTT]) => {
    const D = window.__DS, o = {}, idx = Object.fromEntries(Object.entries(HIP).map(([n, h]) => [n, D.SKY_DATA.stars.rows.findIndex(r => r[0] === h)]));
    const at = (mjd, h) => { D.SKY.hour = h; D.setDate(mjd); };
    o.lst = LSTT.map(([m, h]) => { at(m, h); return D.SKY.lst; });
    at(MAY5, 0); o.lst0 = D.SKY.lst;
    // across a midnight date step: 23:59:30 plus one 0.1 s step at cycle 144 (1 game minute)
    at(MAY5, 23 + 59.5 / 60); const l0 = D.SKY.lst; D.SETTINGS.cycle = 144; D.advanceClock(0.1); D.updateSky();   // as tick() does
    o.step = { l0, l1: D.SKY.lst, mjd: D.SKY.mjd, hour: D.SKY.hour };
    at(MAY5, 22); o.starM = Array.from(D.SKY.starM); o.idx = idx;
    o.at22 = Object.fromEntries(Object.entries(idx).map(([n, i]) => [n, D.starDir(i)]));
    at(MAY5, 23); o.at23 = { Arcturus: D.starDir(idx.Arcturus), Betelgeuse: D.starDir(idx.Betelgeuse) };
    o.day = []; for (let q = 0; q < 96; q++) { at(MAY5, q / 4); o.day.push({ h: q / 4, starM: Array.from(D.SKY.starM), dirs: Object.fromEntries(Object.entries(idx).map(([n, i]) => [n, D.starDir(i)])) }); }
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return o;
  }, [MAY5, HIP, LSTT]);
  const lstOwn = LSTT.map(([m, h]) => ((gmst(jdOf(m, h, -4)) + RAL.lon) % 360 + 360) % 360);
  const lstD = st3.lst.map((v, k) => Math.abs(((v - lstOwn[k] + 540) % 360) - 180));
  const stepOwn = 360.98564736629 * (((st3.step.mjd + st3.step.hour / 24) - (MAY5 + (23 + 59.5 / 60) / 24))), stepPage = ((st3.step.l1 - st3.step.l0) % 360 + 360) % 360;
  ok('LST is the suite\'s own Meeus 12.4 within 0.01 deg at six times; 204.4 at the local midnight that starts May 5; across a midnight date step it moves only by the step\'s own sidereal advance',
    lstD.every(d => d < 0.01) && Math.abs(st3.lst0 - 204.41) < 0.05 && st3.step.mjd === MAY5 + 1 && st3.step.hour < 0.1 && Math.abs(stepPage - stepOwn) < 0.01,
    { lstD, lst0: st3.lst0, step: st3.step, stepPage, stepOwn });
  const JD22s = jdOf(MAY5, 22, -4), P22 = precM(JD22s), poleJ = mulT(P22, [0, 0, 1]), M22 = rows3(st3.starM);
  const poleNow = [0, Math.sin(RAL.lat * DR), Math.cos(RAL.lat * DR)];   // due north at altitude = latitude
  const poleEnu = mul3(M22, poleJ), j2000Enu = mul3(M22, [0, 0, 1]);
  ok('the pole of date: the suite\'s own precessed pole through SKY.starM is due north at altitude 35.78 deg (within 0.01); the J2000 pole lands 0.10-0.20 deg from it (the matrix precesses)',
    angDeg(poleEnu, poleNow) < 0.01 && angDeg(j2000Enu, poleNow) > 0.10 && angDeg(j2000Enu, poleNow) < 0.20,
    { pole: altAzOf(poleEnu), off: angDeg(poleEnu, poleNow), j2000: angDeg(j2000Enu, poleNow) });
  const polaris = st3.day.filter((r, q) => q % 4 === 0).map(r => { const a = altAzOf(r.dirs.Polaris), own = ownStar('Polaris', jdOf(MAY5, r.h, -4));
    return { h: r.h, alt: a.alt, az: a.az, dAlt: Math.abs(a.alt - own.alt), dSky: angDeg(r.dirs.Polaris, own.v) }; });
  ok('Polaris at each of 24 hours: altitude 35.1-36.5 deg, azimuth within 0.8 deg of north, and within 0.05 deg of the suite\'s own precessed alt/az',
    polaris.length === 24 && polaris.every(r => r.alt > 35.1 && r.alt < 36.5 && Math.abs(((r.az + 180) % 360) - 180) < 0.8 && r.dAlt < 0.05 && r.dSky < 0.05),
    polaris.filter(r => !(r.alt > 35.1 && r.alt < 36.5 && Math.abs(((r.az + 180) % 360) - 180) < 0.8 && r.dAlt < 0.05 && r.dSky < 0.05)).slice(0, 4));
  const circ = Object.keys(HIP).map(n => { const a = st3.day.map(r => angDeg(r.dirs[n], poleNow)); return { n, spread: Math.max(...a) - Math.min(...a) }; });
  ok('each of the nine stars circles the pole of date: its angle to the pole stays the same within 0.05 deg over 24 game hours',
    circ.length === 9 && circ.every(c => c.spread < 0.05), circ);
  const dubheMin = Math.min(...st3.day.map(r => r.dirs.Dubhe[1])), arc = st3.day.map(r => r.dirs.Arcturus[1]);
  ok('Dubhe stays above the horizon all day; Arcturus is below it at some hour and above it at another',
    dubheMin > 0 && arc.some(y => y < 0) && arc.some(y => y > 0), { dubheMinAlt: Math.asin(dubheMin) / DR, arcturus: [Math.min(...arc), Math.max(...arc)].map(y => Math.asin(y) / DR) });
  const tab = Object.entries(AE.stars).map(([n, [alt, az]]) => { const a = altAzOf(st3.at22[n]), own = ownStar(n, JD22s);
    return { n, dAlt: +(a.alt - alt).toFixed(4), dAz: +dAz(a.az, az, alt).toFixed(4), dOwn: +angDeg(st3.at22[n], own.v).toFixed(4) }; });
  ok('the 22:00 sky: the eight stars of the table within 0.05 deg of astronomy-engine (records 2026-05-06T02Z/raleigh/hip<N>) and of the suite\'s own precessed alt/az',
    tab.length === 8 && tab.every(r => Math.abs(r.dAlt) < 0.05 && r.dAz < 0.05 && r.dOwn < 0.05), tab);
  const alt = v => Math.asin(v[1]) / DR;
  const mv = { arcturus: [alt(st3.at22.Arcturus), alt(st3.at23.Arcturus)], betelgeuse: [alt(st3.at22.Betelgeuse), alt(st3.at23.Betelgeuse)], arcAz: altAzOf(st3.at22.Arcturus).az, betAz: altAzOf(st3.at22.Betelgeuse).az };
  ok('stars move west: over one game hour Arcturus (east) climbs and Betelgeuse (west) sinks',
    mv.arcAz > 45 && mv.arcAz < 135 && mv.betAz > 225 && mv.betAz < 315 && mv.arcturus[1] > mv.arcturus[0] + 5 && mv.betelgeuse[1] < mv.betelgeuse[0] - 5, mv);

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

  // ---- 8b. the star pass: one draw, the planets where they are, star pixels by night only, the Milky Way ----
  // Pixel helpers run in the page. `peaks` counts isolated bright pixels in the top `frac` of the frame: a pixel no
  // dimmer than its 8 neighbours, inside a flat 7x7 ring (its 24 pixels within 8 levels of each other, so a leaf or
  // a lit window against the sky does not count), whose luminance beats the ring's mean by `t` (8-bit levels).
  // `aimed` draws one frame through the page's own renderScene() from 30 m above the car (over the trees) with a
  // 0.8 rad camera aimed at a world direction (turned `offAz` deg in azimuth), and projects a world direction
  // with the suite's own OpenGL-convention camera: the pixel row for Jupiter and the Milky Way patches use it.
  await page.evaluate(() => {
    const W = window;
    W.__dsPx = () => { const c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); return { w, h, px, L: (x, y) => { const i = (y * w + x) * 4; return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; } }; };
    W.__dsContrast = (F, x, y) => { const v = F.L(x, y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && F.L(x + dx, y + dy) > v) return -1;
      let ring = 0, lo = 1e9, hi = -1e9; for (let d = -3; d <= 3; d++) for (const q of [F.L(x + d, y - 3), F.L(x + d, y + 3), F.L(x - 3, y + d), F.L(x + 3, y + d)]) { ring += q; lo = Math.min(lo, q); hi = Math.max(hi, q); }
      return hi - lo > 8 ? -1 : v - ring / 28; };
    W.__dsPeaks = (F, frac, t) => { let n = 0; for (let y = Math.floor(F.h * (1 - frac)) + 3; y < F.h - 3; y++) for (let x = 3; x < F.w - 3; x++) if (W.__dsContrast(F, x, y) >= t) n++; return n; };
    W.__dsAimed = (aimW, offAz, dirsW) => {
      const D = W.__DS, c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height;
      const az = Math.atan2(aimW[0], aimW[2]) + offAz * Math.PI / 180, el = Math.asin(aimW[1]), fov = 0.8, up = [0, 1, 0];
      const f = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
      g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      renderScene([D.PLAYER.x, D.PLAYER.y + 30, D.PLAYER.z], f, up, fov, 0.2, w, h, { propDist: 560, shadows: false, hidePlayer: false }, []);
      const F = W.__dsPx();
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const s0 = cr(f, up), sl = Math.hypot(...s0), sv = s0.map(v => v / sl), u = cr(sv, f), t = Math.tan(fov / 2);
      F.at = (dirsW || []).map(d => ({ x: (dt(d, sv) / dt(d, f) / (t * w / h) * 0.5 + 0.5) * w - 0.5, y: (dt(d, u) / dt(d, f) / t * 0.5 + 0.5) * h - 0.5 }));
      return F;
    };
  });
  const yaw8b = await page.evaluate(() => window.__DS.PLAYER.yaw);
  // row: one POINTS draw per pass, recorded by wrapping gl.drawArrays
  const draws = await page.evaluate(async () => {
    const D = window.__DS, g = document.getElementById('gl').getContext('webgl2'), rec = [], orig = g.drawArrays;
    const run = async (n) => { rec.length = 0; for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)); return rec.slice(); };
    g.drawArrays = function (mode, first, count) { if (mode === g.POINTS) rec.push({ f: frameNo, fb: g.getParameter(g.FRAMEBUFFER_BINDING) === null ? 'main' : 'fbo', first, count }); return orig.apply(this, arguments); };
    D.setPaused(true); D.SETTINGS.cycle = 0; D.SKY.hour = 22; D.setDate(D.SKY.mjd); const mirror = D.SETTINGS.mirror; D.SETTINGS.mirror = 1;
    D.CAM.mode = 1; D.CAM.chase = null; await run(2); const chase = await run(3);
    D.CAM.mode = 0; await run(2); const cockpit = await run(4);
    D.SKY.hour = 12; D.updateSky(); const noon = await run(3);
    g.drawArrays = orig; D.SETTINGS.mirror = mirror; D.CAM.mode = 1;
    return { n: D.STARS.n, count: D.STARS.count, chase, cockpit, noon };
  });
  const byFrame = list => { const m = {}; for (const r of list) (m[r.f] = m[r.f] || []).push(r); return Object.entries(m).map(([f, l]) => ({ f: +f, main: l.filter(r => r.fb === 'main').length, fbo: l.filter(r => r.fb === 'fbo').length })); };
  const chF = byFrame(draws.chase), coF = byFrame(draws.cockpit), allDraws = draws.chase.concat(draws.cockpit);
  ok('one POINTS draw per pass with STARS.n + 5 vertices: one in the main pass, one more in the mirror pass in the cockpit view; none by day',
    draws.n >= 1500 && draws.count === draws.n + 5 && allDraws.length > 0 && allDraws.every(r => r.first === 0 && r.count === draws.n + 5)
    && chF.length >= 2 && chF.every(r => r.main === 1 && r.fbo === 0) && coF.length >= 3 && coF.every(r => r.main === 1 && r.fbo === (r.f % 2 === 0 ? 1 : 0)) && coF.some(r => r.fbo === 1)
    && draws.noon.length === 0, { n: draws.n, count: draws.count, chF, coF, noon: draws.noon.length, sample: allDraws[0] });
  // row: the planets are drawn where they are
  const jupOwnW = enuToWorldOwn(ownAltAz(AE.jup.ra, AE.jup.dec, JD22).v);
  const jp = await page.evaluate(([MAY5, jw]) => {
    const D = window.__DS, W = window; D.SKY.hour = 22; D.setDate(MAY5);
    const verts = D.STARS.planets.map((id, k) => ({ id, d: D.starDir(D.STARS.n + k), enu: (D.SKY.planets.find(p => p.id === id) || {}).enu }));
    const look = () => { const F = W.__dsAimed(jw, 8, [jw]), a = F.at[0]; let best = { c: -1 };
      for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) { const c = W.__dsContrast(F, x, y); if (c > best.c) best = { c: Math.round(c), x, y, L: Math.round(F.L(x, y)) }; }
      return { at: { x: +a.x.toFixed(1), y: +a.y.toFixed(1) }, w: F.w, best }; };
    const on = look(); D.STARS.on = false; const off = look(); D.STARS.on = true;
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return { verts, on, off };
  }, [MAY5, jupOwnW]);
  const vErr = jp.verts.map(v => v.enu ? Math.max(...v.d.map((x, i) => Math.abs(x - v.enu[i]))) : 1);
  ok('the planets are drawn where they are: the five planet vertices through SKY.starM equal SKY.planets[i].enu within 1e-4; Jupiter (from 30 m above the car, aimed 8 deg to its side) is a bright local maximum within 3 px of where the suite\'s own Jupiter projects, and is gone with STARS.on false',
    jp.verts.map(v => v.id).join() === 'mer,ven,mar,jup,sat' && vErr.every(e => e < 1e-4)
    && Math.abs(jp.on.at.x - jp.on.w / 2) > 40 && jp.on.best.c >= 100 && jp.off.best.c < 10, { vErr, on: jp.on, off: jp.off });
  // rows: star pixels at midnight, none at noon, none with the pass switched off
  const chaseSky = async (hour, starsOn) => page.evaluate(async ([hour, starsOn, MAY5]) => {
    const D = window.__DS, W = window, out = [];
    D.SETTINGS.cycle = 0; D.SKY.hour = hour; D.setDate(MAY5); D.STARS.on = starsOn; D.CAM.mode = 1;
    for (const deg of [0, 90, 180, 270]) {
      D.PLAYER.yaw = deg * Math.PI / 180; D.CAM.chase = null;
      for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r));
      const F = await new Promise(r => requestAnimationFrame(() => r(W.__dsPx())));
      // the lowest elevation in the counted band (the top 20% of rows), from the camera: must be above the ridge (<= 4.2 deg)
      const f = D.CAM.fwd, up = [0, 1, 0], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const s0 = cr(f, up), sl = Math.hypot(...s0), sv = s0.map(v => v / sl), u = cr(sv, f), t = Math.tan(D.CAM.fov / 2), yN = 0.6;
      let minEl = 90; for (const xN of [-1, 0, 1]) { const d = [0, 1, 2].map(i => f[i] + xN * t * F.w / F.h * sv[i] + yN * t * u[i]); minEl = Math.min(minEl, Math.asin(d[1] / Math.hypot(...d)) * 180 / Math.PI); }
      out.push({ deg, n40: W.__dsPeaks(F, 0.2, 40), n30: W.__dsPeaks(F, 0.2, 30), minEl: +minEl.toFixed(1) });
    }
    D.STARS.on = true;
    return out;
  }, [hour, starsOn, MAY5]);
  const mid = await chaseSky(0, true), midOff = await chaseSky(0, false), noonSky = await chaseSky(12, true);
  // the noon sky through the same aimed camera, the Milky Way on and off: byte-identical
  const noonMw = await page.evaluate(MAY5 => {
    const D = window.__DS, W = window; D.SKY.hour = 12; D.setDate(MAY5); let same = true, nPx = 0;
    for (const aim of [[0.6, 0.5, 0.62], [-0.7, 0.3, -0.64], [0, 0.95, 0.31]]) {
      const l = Math.hypot(...aim), a = aim.map(v => v / l);
      D.MW.on = true; const A = W.__dsAimed(a, 0).px.slice(); D.MW.on = false; const B = W.__dsAimed(a, 0).px; D.MW.on = true;
      nPx += A.length / 4; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { same = false; break; }
    }
    return { same, nPx, night: D.SKY.night };
  }, MAY5);
  ok('star pixels at midnight: at four headings (chase view) the sky above the ridge holds isolated pixels clearly brighter than their neighbours',
    mid.every(r => r.n40 >= 4 && r.minEl > 5), mid);
  ok('no star pixels at noon at the same four headings, and the Milky Way term adds nothing by day (the noon sky byte-identical with MW.on true and false)',
    noonSky.every(r => r.n30 === 0) && noonMw.same && noonMw.nPx > 100000 && noonMw.night === 0, { noonSky, noonMw });
  ok('with STARS.on false at midnight the same regions hold no isolated bright pixels: skyCol() has no stars of its own left',
    midOff.every(r => r.n30 === 0) && mid.every(r => r.n40 >= 4), { midOff, mid: mid.map(r => r.n40) });
  // row: the Milky Way where the suite's own galactic plane says it is, at 02:30 EDT on May 6 (May 5-6's night)
  const MAY6 = MAY5 + 1, JDmw = jdOf(MAY6, 2.5, -4), ALT = 35;
  const bAt = az => galB(enuToJ2000(enuOf(ALT, az), JDmw));
  let bandAz = 30; for (let az = 30; az <= 120; az += 0.5) if (Math.abs(bAt(az)) < Math.abs(bAt(bandAz))) bandAz = az;
  const dAzOff = 2 * Math.asin(Math.sin(20 * DR) / Math.cos(ALT * DR)) / DR;   // 40 deg of arc along the almucantar
  const offAz = [bandAz - dAzOff, bandAz + dAzOff].sort((a, b) => Math.abs(bAt(b)) - Math.abs(bAt(a)))[0];
  const mwq = await page.evaluate(([MAY6, aimsW]) => {
    const D = window.__DS, W = window; D.SKY.hour = 2.5; D.setDate(MAY6); D.STARS.on = false;
    const patch = aim => { const F = W.__dsAimed(aim, 0, [aim]), a = F.at[0]; let s = 0, n = 0;
      for (let y = Math.round(a.y) - 7; y <= Math.round(a.y) + 7; y++) for (let x = Math.round(a.x) - 7; x <= Math.round(a.x) + 7; x++) { s += F.L(x, y); n++; } return +(s / n).toFixed(2); };
    D.MW.on = true; const on = aimsW.map(patch); D.MW.on = false; const off = aimsW.map(patch); D.MW.on = true; D.STARS.on = true;
    const moon = D.SKY.moon.slice(); D.SKY.hour = 6.25; D.setDate(D.SKY.mjd - 1);
    return { on, off, moon };
  }, [MAY6, [enuToWorldOwn(enuOf(ALT, bandAz)), enuToWorldOwn(enuOf(ALT, offAz))]]);
  const mwInfo = { bandAz, bBand: +bAt(bandAz).toFixed(2), offAz: +offAz.toFixed(1), bOff: +bAt(offAz).toFixed(1), arc: +angDeg(enuOf(ALT, bandAz), enuOf(ALT, offAz)).toFixed(2),
    moonSep: [angDeg(mwq.moon, enuOf(ALT, bandAz)), angDeg(mwq.moon, enuOf(ALT, offAz))].map(v => +v.toFixed(1)), on: mwq.on, off: mwq.off };
  ok('the Milky Way where the suite\'s own galactic plane says it is: at 02:30 EDT on May 6, a patch on the band 35 deg up in the east beats one 40 deg off it by a clear margin with MW.on true; with MW.on false the two are equal',
    Math.abs(mwInfo.bBand) < 2 && Math.abs(mwInfo.bOff) > 20 && Math.abs(mwInfo.arc - 40) < 0.5 && mwInfo.moonSep.every(v => v > 50)
    && mwq.on[0] - mwq.on[1] >= 6 && Math.abs(mwq.off[0] - mwq.off[1]) <= 1, mwInfo);
  await page.evaluate(y => { const D = window.__DS; D.PLAYER.yaw = y; D.CAM.chase = null; }, yaw8b);

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
