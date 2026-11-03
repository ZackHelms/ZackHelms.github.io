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
// Meeus 49 (Astronomical Algorithms, 2nd ed., ch. 49, the corrections for the quarters and W): the TRUE first (k + 0.25) and
// last (k + 0.75) quarter, JDE. The mean quarter is up to about 0.7 day off the true one (-0.62801 sin M' alone), which is
// 0.07 of lit fraction, so a quarter's 0.5 +/- 0.05 is checked at the true hour. The planetary arguments (under 0.0004 day) are left out.
function quarterJD(k) {
  const T = k / 1236.85, E = 1 - 0.002516 * T - 0.0000074 * T * T, r = x => x * DR, s = Math.sin, c = Math.cos;
  const M = r(2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T ** 3);
  const Mp = r(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const F = r(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  const Om = r(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3);
  const d = -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F) + 0.00454 * E * s(Mp - M)
    + 0.00204 * E * E * s(2 * M) - 0.00180 * s(Mp - 2 * F) - 0.00070 * s(Mp + 2 * F) - 0.00040 * s(3 * Mp) - 0.00034 * E * s(2 * Mp - M)
    + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(Mp + 2 * M) + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(Om);
  const W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F);
  return meanPhase(k) + d + (Math.abs(k % 1 - 0.25) < 1e-9 ? W : -W);
}
// Saemundsson's refraction (Sky & Telescope 72, 70, 1986; Meeus, Astronomical Algorithms, 2nd ed., eq. 16.4), in degrees, from
// the TRUE altitude h in degrees: R = 1.02 / tan(h + 10.3 / (h + 5.11)) arcminutes. 0.483 deg at h = 0, 0.618 at -0.833.
const saem = h => 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DR) / 60;
// a body's apparent ENU direction: lifted by saem() in its own vertical plane (the suite's own, for the drawn sun)
const liftOwn = v => { const hl = Math.hypot(v[0], v[2]), a = Math.asin(v[1]) + saem(Math.asin(v[1]) / DR) * DR; return [v[0] / hl * Math.cos(a), Math.sin(a), v[2] / hl * Math.cos(a)]; };
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
  // with the suite's own OpenGL-convention camera: the pixel row for Jupiter and the Milky Way patches use it. An optional
  // fourth argument narrows the field of view (radians, vertical), so a row can zoom on the sun or the moon (DS-4).
  await page.evaluate(() => {
    const W = window;
    W.__dsPx = () => { const c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); return { w, h, px, L: (x, y) => { const i = (y * w + x) * 4; return px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; } }; };
    W.__dsContrast = (F, x, y) => { const v = F.L(x, y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && F.L(x + dx, y + dy) > v) return -1;
      let ring = 0, lo = 1e9, hi = -1e9; for (let d = -3; d <= 3; d++) for (const q of [F.L(x + d, y - 3), F.L(x + d, y + 3), F.L(x - 3, y + d), F.L(x + 3, y + d)]) { ring += q; lo = Math.min(lo, q); hi = Math.max(hi, q); }
      return hi - lo > 8 ? -1 : v - ring / 28; };
    W.__dsPeaks = (F, frac, t) => { let n = 0; for (let y = Math.floor(F.h * (1 - frac)) + 3; y < F.h - 3; y++) for (let x = 3; x < F.w - 3; x++) if (W.__dsContrast(F, x, y) >= t) n++; return n; };
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
      // the world direction through pixel (x, y), for rows that need the angle from a body at every pixel
      F.dir = (x, y) => { const xn = ((x + 0.5) / w * 2 - 1) * t * w / h, yn = ((y + 0.5) / h * 2 - 1) * t, d = [0, 1, 2].map(i => f[i] + xn * sv[i] + yn * u[i]), l = Math.hypot(...d); return d.map(v => v / l); };
      F.fov = fov; F.pxPerRad = h / 2 / t;
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
  // row: the Milky Way all round the sky. At 02:30 EDT on May 16 (the new moon; the moon below the horizon) the 35-deg
  // almucantar is read every 10 deg of azimuth through four aimed frames (the stars off). Every patch the suite's own galactic
  // plane puts within 4 deg of it is brighter than every patch it puts more than 25 deg from it; with MW.on false all are equal.
  // One crossing of the band (the row above) can be met by a wrong frame by chance; 36 patches round the sky cannot.
  const MAY16 = MAY5 + 11, JDr = jdOf(MAY16, 2.5, -4);
  const ring = []; for (let a = 0; a < 4; a++) for (let o = -40; o <= 40; o += 10) { const az = a * 90 + o; ring.push({ aim: a, az: (az + 360) % 360, b: +galB(enuToJ2000(enuOf(35, az), JDr)).toFixed(1) }); }
  const mwr = await page.evaluate(([MAY16, aims, ring]) => {
    const D = window.__DS, W = window; D.SKY.hour = 2.5; D.setDate(MAY16); D.STARS.on = false;
    const read = () => aims.map((aim, a) => { const pts = ring.filter(p => p.aim === a), F = W.__dsAimed(aim, 0, pts.map(p => p.w));
      return F.at.map(q => { let s = 0, n = 0; for (let y = Math.round(q.y) - 7; y <= Math.round(q.y) + 7; y++) for (let x = Math.round(q.x) - 7; x <= Math.round(q.x) + 7; x++) { s += F.L(x, y); n++; } return +(s / n).toFixed(2); }); }).flat();
    D.MW.on = true; const on = read(); D.MW.on = false; const off = read(); D.MW.on = true; D.STARS.on = true;
    const moonUp = D.SKY.moon[1], night = D.SKY.night; D.SKY.hour = 6.25; D.setDate(MAY16 - 11);
    return { on, off, moonUp, night };
  }, [MAY16, [0, 90, 180, 270].map(az => enuToWorldOwn(enuOf(35, az))), ring.map(p => ({ aim: p.aim, w: enuToWorldOwn(enuOf(35, p.az)) }))]);
  ring.forEach((p, k) => { p.on = mwr.on[k]; p.off = mwr.off[k]; });
  const rOn = ring.filter(p => Math.abs(p.b) < 4), rOff = ring.filter(p => Math.abs(p.b) > 25);
  const rMin = Math.min(...rOn.map(p => p.on)), rMax = Math.max(...rOff.map(p => p.on)), rFlat = Math.max(...mwr.off) - Math.min(...mwr.off);
  ok('the Milky Way all round the sky: at 02:30 EDT on May 16 (no moon), around the 35-deg almucantar every 10 deg, every patch the suite\'s own galactic plane puts within 4 deg of it is brighter than every patch more than 25 deg from it; with MW.on false all 36 are equal',
    rOn.length >= 3 && rOff.length >= 12 && mwr.moonUp < 0 && mwr.night > 0.99 && rMin >= rMax + 3 && rFlat <= 1,
    { onBand: rOn.map(p => p.az + ':' + p.on), offMax: rMax, nOff: rOff.length, flat: rFlat, moonUp: mwr.moonUp });
  // row: a star behind the distant hills is hidden. The hills are drawn by the sky shader, not as geometry, so only the star
  // pass's own ridge test can hide a star behind them. At 00:30 EDT on May 6 Capella (mag 0.1) is about 2 deg up in the
  // north-north-west (SIMBAD J2000 05 16 41.359 +45 59 52.77, precessed by the suite), past the 2-deg fade and about 1.3 deg under the skyline there; aimed at it as the Jupiter row is, its
  // place reads the same with the stars on and off. At 21:00 on May 5, about 31 deg up, the same aim finds it (the detector sees it).
  const capW = [[MAY5 + 1, 0.5], [MAY5, 21]].map(([m, h]) => { const jd = jdOf(m, h, -4), q = precess(hms('05 16 41.359'), dms('+45 59 52.77'), jd), v = ownAltAz(q.ra, q.dec, jd); return { m, h, alt: +v.alt.toFixed(2), w: enuToWorldOwn(v.v) }; });
  const cap = await page.evaluate(caps => {
    const D = window.__DS, W = window;
    const look = (c, on) => { D.STARS.on = on; const F = W.__dsAimed(c.w, 8, [c.w]), a = F.at[0]; let best = -1e9;
      for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) best = Math.max(best, F.L(x, y));
      return { x: +a.x.toFixed(1), y: +a.y.toFixed(1), L: Math.round(best) }; };
    const out = caps.map(c => { D.SKY.hour = c.h; D.setDate(c.m); return { h: c.h, alt: c.alt, on: look(c, true), off: look(c, false) }; });
    D.STARS.on = true; D.SKY.hour = 6.25; D.setDate(caps[1].m);
    return out;
  }, capW);
  ok('a star behind the distant hills is hidden: Capella at 00:30 EDT on May 6 (about 2 deg up, under the skyline) adds nothing where it projects; at 21:00 on May 5 it is a bright point there',
    capW[0].alt > 1.8 && capW[0].alt < 2.5 && Math.abs(cap[0].on.L - cap[0].off.L) <= 2 && cap[1].on.L - cap[1].off.L >= 60, cap);
  // row: the planets' vertices on the GPU follow the date. The 35 floats read back from the star buffer after a date step to May 20
  // equal STARS.data's planet slots, turn through SKY.starM onto SKY.planets[i].enu within 1e-4, and Venus's has moved over 5 deg
  // since May 5 (a pixel cannot see a buffer left at boot: Jupiter moves under a pixel in a day).
  const gpu = await page.evaluate(MAY5 => {
    const D = window.__DS, g = document.getElementById('gl').getContext('webgl2');
    const read = () => { const b = new Float32Array(35); g.bindBuffer(g.ARRAY_BUFFER, D.STARS.buf); g.getBufferSubData(g.ARRAY_BUFFER, D.STARS.n * 28, b); g.bindBuffer(g.ARRAY_BUFFER, null); return Array.from(b); };
    D.SKY.hour = 22; D.setDate(MAY5); const a = read();
    D.setDate(MAY5 + 15); const b = read(), cpu = Array.from(D.STARS.data.subarray(D.STARS.n * 7, D.STARS.n * 7 + 35));
    const r = { a, b, cpu, starM: Array.from(D.SKY.starM), enu: D.STARS.planets.map(id => (D.SKY.planets.find(p => p.id === id) || {}).enu) };
    D.SKY.hour = 6.25; D.setDate(MAY5); return r;
  }, MAY5);
  const gM = rows3(gpu.starM), gErr = [0, 1, 2, 3, 4].map(k => { const d = gpu.b.slice(k * 7, k * 7 + 3), e = gpu.enu[k]; return e ? Math.max(...mul3(gM, d).map((x, i) => Math.abs(x - e[i]))) : 1; });
  const venMove = angDeg(gpu.a.slice(7, 10), gpu.b.slice(7, 10)), gpuCpu = Math.max(...gpu.b.map((x, i) => Math.abs(x - gpu.cpu[i])));
  ok('the planets\' vertices on the GPU follow the date: read back from the star buffer after a step to May 20 they equal STARS.data, land on SKY.planets[i].enu through SKY.starM within 1e-4, and Venus\'s has moved over 5 deg since May 5',
    gpuCpu < 1e-7 && gErr.every(e => e < 1e-4) && venMove > 5, { gpuCpu, gErr, venMove });
  // row: the sun is drawn where it is. At 17:00 EDT on May 5, aimed 8 deg to the side of the suite's own sun (through its own
  // (east, up, south) map), the sun's saturated disc is centred within 4 px of where that sun projects. A world without the
  // ENU-to-world flip puts it at azimuth 180 - az, 10 deg away.
  // Restated at dssky step 3 (DS-4): the disc is now its real 0.53 deg, about 4.5 px across at the 0.8 rad field of view, where
  // the row wanted 20 saturated pixels. It looks through a 0.2 rad field (34 px a degree, the disc about 18 px across, 8 deg still
  // well inside the frame), and the place it is checked against is the suite's own sun lifted by its own refraction (saem()).
  const sunW17 = enuToWorldOwn(liftOwn(ownSun(jdOf(MAY5, 17, -4)).v));
  const sunPx = await page.evaluate(([MAY5, sw]) => {
    const D = window.__DS, W = window; D.SKY.hour = 17; D.setDate(MAY5);
    const F = W.__dsAimed(sw, 8, [sw], 0.2), a = F.at[0]; let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const i = (y * F.w + x) * 4; if (F.px[i] >= 250 && F.px[i + 1] >= 250 && F.px[i + 2] >= 240) { sx += x; sy += y; n++; } }
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return { at: { x: +a.x.toFixed(1), y: +a.y.toFixed(1) }, n, c: n ? { x: +(sx / n).toFixed(1), y: +(sy / n).toFixed(1) } : null, w: F.w };
  }, [MAY5, sunW17]);
  ok('the sun is drawn where it is: at 17:00 EDT on May 5, aimed 8 deg to its side through a 0.2 rad field of view, the sun\'s saturated disc is centred within 4 px of where the suite\'s own sun, refracted, projects',
    sunPx.n >= 20 && !!sunPx.c && Math.hypot(sunPx.c.x - sunPx.at.x, sunPx.c.y - sunPx.at.y) < 4 && Math.abs(sunPx.at.x - sunPx.w / 2) > 40, sunPx);
  // row: the stars fade with the night. At 22:00 on May 5, aimed at Polaris as the Jupiter row is, what the star adds to its pixel
  // with SKY.night forced to 0.5 is 0.3-0.75 of what it adds at 1 (the pass's gain carries the night, so dusk stars are faint).
  const polW = enuToWorldOwn(ownStar('Polaris', jdOf(MAY5, 22, -4)).v);
  const fade = await page.evaluate(([MAY5, pw]) => {
    const D = window.__DS, W = window; D.SKY.hour = 22; D.setDate(MAY5);
    const add = night => { const v = []; for (const on of [true, false]) { D.STARS.on = on; D.SKY.night = night; const F = W.__dsAimed(pw, 8, [pw]), a = F.at[0]; let best = -1e9;
      for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) best = Math.max(best, F.L(x, y)); v.push(best); }
      return v[0] - v[1]; };
    const full = add(1), half = add(0.5); D.STARS.on = true; D.SKY.hour = 6.25; D.setDate(MAY5);
    return { full: Math.round(full), half: Math.round(half) };
  }, [MAY5, polW]);
  ok('the stars fade with the night: what Polaris adds to its pixel with SKY.night at 0.5 is 0.3-0.75 of what it adds at 1',
    fade.full >= 60 && fade.half / fade.full >= 0.3 && fade.half / fade.full <= 0.75, fade);
  // rows (DS-7): no column of light under a low sun or moon, and the sky above the ridge unchanged by the fix. The fog, the
  // distant hills and paint reflections sample the sky with the elevation clamped to about 1.15 deg, so while they took the
  // sun and moon discs with it, a body near that height painted a column down everything below it at its azimuth. The times
  // are found by bisection on the page's own SKY (its sun and moon are proven against astronomy-engine above), not typed in:
  // sunset with the sun at 1.0 deg on May 5, moonrise with the moon at 1.0 deg on May 6. Aimed at the body from 30 m above
  // the car, in the rows from 4 px under the horizon's projection to the bottom, the 3-px strip at the body's x is compared
  // with the strips where the directions 10 deg either side in azimuth (same altitude) project.
  const col = await page.evaluate(MAY5 => {
    const D = window.__DS, W = window, DR = Math.PI / 180, altOf = v => Math.asin(v[1]) / DR;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const at = (mjd, h, body) => { D.SKY.hour = h; D.setDate(mjd); return altOf(D.SKY[body]); };
    const find = (mjd, lo, hi, body) => { let a = at(mjd, lo, body); if ((a - 1) * (at(mjd, hi, body) - 1) >= 0) return null;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, v = at(mjd, m, body); if ((v - 1) * (a - 1) > 0) { lo = m; a = v; } else hi = m; } return (lo + hi) / 2; };
    const column = (mjd, lo, hi, body) => {
      const h = find(mjd, lo, hi, body); if (h === null) return null;
      at(mjd, h, body);
      const v = D.SKY[body], alt = altOf(v), az = Math.atan2(v[0], v[2]) / DR;
      const dirs = [v, enu(alt, az - 10), enu(alt, az + 10), enu(0, az)].map(D.enuToWorld);
      const F = W.__dsAimed(dirs[0], 0, dirs), hy = Math.floor(F.at[3].y) - 4;
      const strip = x0 => { let s = 0, n = 0; for (let y = 0; y <= hy; y++) for (let x = Math.round(x0) - 1; x <= Math.round(x0) + 1; x++) { s += F.L(x, y); n++; } return s / n; };
      const [c, l, r] = [0, 1, 2].map(k => strip(F.at[k].x));
      return { h: +h.toFixed(4), alt: +alt.toFixed(3), az: +((az + 360) % 360).toFixed(2), x: F.at.slice(0, 3).map(a => +a.x.toFixed(1)), rows: hy + 1,
        c: +c.toFixed(2), l: +l.toFixed(2), r: +r.toFixed(2), ratio: +(c / Math.min(l, r)).toFixed(3) };
    };
    const out = { sun: column(MAY5, 19, 20.5, 'sun'), moon: column(MAY5 + 1, 0, 1.5, 'moon') };
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return out;
  }, MAY5);
  ok('no column of light under a low sun or moon: at sunset (sun 1.0 deg) and moonrise (moon 1.0 deg) the ground below the body is at most 1.25x as bright as 10 deg either side',
    !!col.sun && !!col.moon && col.sun.h > 19.5 && col.sun.h < 20.5 && col.moon.h > 0 && col.moon.h < 1 && [col.sun, col.moon].every(k => k.rows > 100 && k.ratio <= 1.25), col);
  // row (dssky step 6): a body behind the distant hills is hidden. The sky pass adds the discs on every ray and its hills replace
  // the sum below the ridge; a break that adds them back after the hills drew a disc over them, and no other row saw it (the
  // column row looks only under the horizon). At the column row's two times the bodies stand at 1.0 deg true, about 1.36 drawn,
  // under the skyline at their azimuths (the page's ridge is 0.4-4 deg). Zoomed to a 2-deg field of view on where the drawn
  // disc is (SKY.sunDiscW / moonDiscW; refraction is proven by its own row), the pixels within 0.8 of its radius are compared
  // with the same-sized patches 1.5 deg either side in azimuth, at the same height, which are hills too.
  const hid = await page.evaluate(([MAY5, hs, hm]) => {
    const D = window.__DS, W = window, DR = Math.PI / 180;
    const rot = (v, deg) => { const c = Math.cos(deg * DR), s = Math.sin(deg * DR); return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]; };
    const one = (mjd, h, body) => {
      D.SKY.hour = h; D.setDate(mjd);
      const dW = D.SKY[body + 'DiscW'], r = D.SKY[body + 'R'], F = W.__dsAimed(dW, 0, null, 2 * DR);
      const ctr = [dW, rot(dW, -1.5), rot(dW, 1.5)], acc = ctr.map(() => [0, 0, 0]);
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
        const d = F.dir(x, y);
        ctr.forEach((c, k) => { if (Math.hypot(d[0] - c[0], d[1] - c[1], d[2] - c[2]) < 0.8 * r) { const v = F.L(x, y); acc[k][0] += v; acc[k][1]++; acc[k][2] = Math.max(acc[k][2], v); } });
      }
      const m = acc.map(a => a[1] ? a[0] / a[1] : -1);
      return { h: +h.toFixed(4), drawnAlt: +(Math.asin(dW[1]) / DR).toFixed(3), n: acc.map(a => a[1]), mean: m.map(v => +v.toFixed(2)), max: acc.map(a => +a[2].toFixed(1)), ratio: +(m[0] / Math.min(m[1], m[2])).toFixed(3) };
    };
    const out = hs === null || hm === null ? null : { sun: one(MAY5, hs, 'sun'), moon: one(MAY5 + 1, hm, 'moon') };
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return out;
  }, [MAY5, col.sun ? col.sun.h : null, col.moon ? col.moon.h : null]);
  ok('a sun or moon behind the distant hills is hidden: at sunset and moonrise (each 1.0 deg up, under the skyline), zoomed on where the drawn disc is, its pixels are within 10% of the hills 1.5 deg either side',
    !!hid && [hid.sun, hid.moon].every(k => k.n.every(n => n > 1000) && k.ratio <= 1.1), hid);
  // The sky above the ridge, unchanged by the split: five frames from 30 m above the car, each wholly above the ridge (its lowest
  // corner over 5 deg up, so no hills and no ground in it): 12:00 aimed at 32 deg up in azimuth 200 and at the sun (65 deg up),
  // 17:00 at the sun (36 deg), 22:00 at 32 deg / 200 (stars, Milky Way), 04:00 on May 6 at the moon (25 deg up, aimed 32 deg up).
  // SKY_BEFORE: each frame's mean luminance and FNV-1a hash of its RGBA bytes, recorded 2026-11-02 by this row's own code on the
  // page before the split (one skyCol(), the page of e43a233, in the worktree at bbf3d0e); after it every mean is within 0.5
  // and every hash equal (the bodies' terms are kept in the same sum in the same order, so the bits are the same).
  // Restated at dssky step 2: the frames are taken with STARS.on false, because step 2 brightens the star pass (a pass of its
  // own, after the sky's) and the row is about the sky pass. The stars-off values were recorded the same way on the same
  // pre-split page (bbf3d0e) on 2026-11-02, where its stars-on values reproduced the ones recorded at step 1 exactly; by day the
  // star pass does not draw, so the three daytime values are the step-1 ones unchanged.
  // Restated again at dssky step 3 (DS-4), which redraws the bodies by design: the sun disc at its real size, its aureole about the
  // refracted disc, the moon from the kit's lit sphere, all in skyBodies(), added to skyBase() in the sky pass. The claim is now
  // "the sky away from the bodies is unchanged": every frame's mean within 0.5 of the pre-split record; night22, the one frame
  // with no body and no aureole in it, still hashes as before the split (the base is bit for bit the old one); the four frames
  // that hold a disc or the aureole hash as recorded on this step's page (SKY_STEP3, 2026-11-02, by this row's own code), so a
  // later change to them shows here. Measured on this step's page: means -0.000, -0.003, -0.003, 0.000 and -0.144 (moon4: the
  // old moon disc was 1.0-1.3 deg across and uniformly lit; the new one is 0.49 deg and 82% lit).
  // Restated at dssky step 4, which scales the moon's light by its phase: the moon's broad glow (in skyBase(), uMoonCol) with it,
  // and the Milky Way dimmed under a bright moon. moon4 (a 0.68-lit moon 25 deg up) is the one frame either touches: its mean
  // fell 6.142 and its hash moved. Traced on this step's page (a scratch run): with the old moonlight put back in SKY.moonCol and
  // SKY.starDim at 1, the frame hashes 63e2c7c4, step 3's value, exactly (the glow alone is -5.2 of the mean, the Milky Way's
  // dimming -0.8). So moon4 is now held to its step-4 mean (within 0.5) and hash (SKY_STEP4), the other four as before.
  const SKY_STEP3 = { noon: 'f74f5560', noonSun: '0174b859', sun17: '6379ab21', night22: '4eb245a1', moon4: '63e2c7c4' };
  const SKY_STEP4 = { moon4: [28.253, '411be863'] };
  const SKY_BEFORE = { noon: [169.486, 'ce2df9fc'], noonSun: [182.519, '5963df34'], sun17: [193.474, 'a0571206'], night22: [22.164, '4eb245a1'], moon4: [34.395, '6e7d7372'] };
  const skyNow = await page.evaluate(MAY5 => {
    const D = window.__DS, W = window, DR = Math.PI / 180, altOf = v => Math.asin(v[1]) / DR;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const fnv = px => { let h = 0x811c9dc5; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
    const frame = (mjd, h, aim) => { D.SKY.hour = h; D.setDate(mjd); const a = aim(), F = W.__dsAimed(a, 0); let s = 0;
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) s += F.L(x, y);
      // the frame's lowest corner, from the aimed camera (0.8 rad, up = world up)
      const el = Math.asin(a[1]), t = Math.tan(0.4), k = t * F.w / F.h, low = Math.asin((Math.sin(el) - t * Math.cos(el)) / Math.hypot(k, Math.cos(el) + t * Math.sin(el), Math.sin(el) - t * Math.cos(el))) / DR;
      return { mean: +(s / (F.w * F.h)).toFixed(3), hash: fnv(F.px), low: +low.toFixed(1) }; };
    const fixed = () => D.enuToWorld(enu(32, 200));
    const atBody = b => () => { const v = D.SKY[b], az = Math.atan2(v[0], v[2]) / DR; return D.enuToWorld(enu(Math.max(altOf(v), 32), az)); };
    D.STARS.on = false;
    const out = { noon: frame(MAY5, 12, fixed), noonSun: frame(MAY5, 12, atBody('sun')), sun17: frame(MAY5, 17, atBody('sun')), night22: frame(MAY5, 22, fixed), moon4: frame(MAY5 + 1, 4, atBody('moon')) };
    D.STARS.on = true;
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return out;
  }, MAY5);
  const skyRef = k => SKY_STEP4[k] || [SKY_BEFORE[k][0], SKY_STEP3[k]];
  const skyDiff = Object.keys(SKY_BEFORE).map(k => ({ k, low: skyNow[k].low, dMean: +(skyNow[k].mean - skyRef(k)[0]).toFixed(3), hash: skyNow[k].hash, same: skyNow[k].hash === skyRef(k)[1] }));
  ok('the sky above the ridge away from the bodies is unchanged: five frames above the ridge (12:00 twice, 17:00 at the sun, 22:00, 04:00 at the moon), the star pass off, match their pre-split means within 0.5; 22:00 (no body in it) its pre-split hash, the three with the sun their step-3 hashes, 04:00 at the moon its step-4 mean and hash (the moon\'s glow and the Milky Way by its phase)',
    skyDiff.every(r => r.low > 5 && Math.abs(r.dMean) <= 0.5 && r.same) && SKY_STEP3.night22 === SKY_BEFORE.night22[1], skyDiff);
  // ---- 8b2. the sun and the moon as they look (DS-4, dssky step 3) ----
  // The light stays geometric (SKY.sun, SKY.moon); the discs are drawn at SKY.sunDiscW / SKY.moonDiscW, lifted by refraction, at
  // their real sizes (SKY.sunR, SKY.moonR), the moon from the kit's lit sphere with its earthshine (SKY.moonES) and the page's maria.
  // The suite's oracles are its own: the Almanac sun (ownSun), Saemundsson's refraction (saem), Meeus 49's mean and true phases,
  // and astronomy-engine's lit fraction typed in (AE). Times for the pixel rows are found on the page's own SKY by bisection
  // (`when` below), not typed in. A "moon off" frame moves SKY.moonDiscW to the opposite point (under the horizon), which takes
  // the disc away and leaves everything else: the moon's broad glow and its light follow the geometric SKY.moonW.
  await page.evaluate(() => {
    const W = window, D = W.__DS, DR = Math.PI / 180;
    W.__dsAlt = (body, mjd, h) => { D.SKY.hour = h; D.setDate(mjd); return Math.asin(D.SKY[body][1]) / DR; };
    // the hour in [lo, hi] at which `body` (a SKY field) is at `alt` deg; null if it does not cross there
    W.__dsWhen = (body, mjd, lo, hi, alt) => { let a = W.__dsAlt(body, mjd, lo) - alt; if (a * (W.__dsAlt(body, mjd, hi) - alt) > 0) return null;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, v = W.__dsAlt(body, mjd, m) - alt; if (v * a > 0) { lo = m; a = v; } else hi = m; } W.__dsAlt(body, mjd, (lo + hi) / 2); return (lo + hi) / 2; };
    // the moon on and off through the same aimed camera; L(x, y) of the difference
    W.__dsMoonPair = (aim, offAz, dirs, fov) => { const A = W.__dsAimed(aim, offAz, dirs, fov), keep = D.SKY.moonDiscW;
      D.SKY.moonDiscW = keep.map(v => -v); const B = W.__dsAimed(aim, offAz, dirs, fov); D.SKY.moonDiscW = keep;
      A.diff = (x, y) => A.L(x, y) - B.L(x, y); A.off = B; return A; };
  });
  // row: the sun through the day, against the suite's own sun (the geometric place the light uses)
  const fiveT = []; for (const mjd of [MAR20, MAY5, JUN20]) for (const h of [6.5, 9, null, 17, 19.5]) fiveT.push({ mjd, h: h === null ? ownNoon(mjd, -4) : h });
  const sun5 = await page.evaluate(([ts, MAY5]) => { const D = window.__DS;
    const out = ts.map(t => { D.SKY.hour = t.h; D.setDate(t.mjd); return { ...t, dst: D.SKY.dst, sun: D.SKY.sun.slice() }; });
    D.SKY.hour = 6.25; D.setDate(MAY5); return out; }, [fiveT, MAY5]);
  const sun5c = sun5.map(r => { const o = altAzOf(ownSun(jdOf(r.mjd, r.h, -4)).v), a = altAzOf(r.sun);
    return { mjd: r.mjd, h: +r.h.toFixed(3), dst: r.dst, alt: +a.alt.toFixed(2), dAlt: +(a.alt - o.alt).toFixed(4), dAz: +dAz(a.az, o.az, o.alt).toFixed(4) }; });
  ok('the sun through the day: at 06:30, 09:00, solar noon, 17:00 and 19:30 EDT on Mar 20, May 5 and Jun 20 the page\'s sun is within 0.2 deg of the suite\'s own in altitude and in azimuth (on the sky)',
    sun5c.length === 15 && sun5c.every(c => c.dst === true && Math.abs(c.dAlt) < 0.2 && c.dAz < 0.2), sun5c);
  // row: refraction lifts the drawn discs only. At the hours (by bisection) when the page's geometric sun (setting, May 5) and moon
  // (rising, May 6) are at true altitudes 0, 1 and 10 deg, the drawn disc's altitude minus the geometric one equals the suite's
  // own Saemundsson value within 0.01 deg, in the same azimuth; and at the suite's own sunrise and sunset on May 5 (geometric centre
  // -0.833) the drawn upper limb (altitude + SKY.sunR) is at the horizon. The almanac's -0.833 is 34' of refraction at APPARENT
  // altitude 0 plus 16' of radius; Saemundsson at TRUE -0.833 is 0.618, so the limb sits 0.050 deg up: the plan's "within 0.05 of
  // 0" is that expected value itself, so the row asks for the suite's own 0.050 within 0.02 (and so within 0.07 of 0).
  const ownEv5 = ownRiseSet(MAY5, -4);
  const refr = await page.evaluate(([MAY5, evs]) => { const D = window.__DS, W = window, DR = Math.PI / 180, out = [];
    const azOf = v => Math.atan2(v[0], v[2]) / DR, wToEnu = v => [v[0], v[1], -v[2]];
    for (const [body, mjd, lo, hi] of [['sun', MAY5, 17, 20.5], ['moon', MAY5 + 1, 0, 4]]) for (const t of [0, 1, 10]) {
      const h = W.__dsWhen(body, mjd, lo, hi, t); if (h === null) { out.push({ body, t, h: null }); continue; }
      const g = D.SKY[body], dsk = wToEnu(D.SKY[body + 'DiscW']);
      out.push({ body, t, h: +h.toFixed(4), geo: Math.asin(g[1]) / DR, drawn: Math.asin(dsk[1]) / DR, dAz: Math.abs(((azOf(g) - azOf(dsk)) + 540) % 360 - 180) });
    }
    const limb = evs.map(e => { D.SKY.hour = e.h; D.setDate(MAY5); return { h: +e.h.toFixed(4), up: e.up, geo: Math.asin(D.SKY.sun[1]) / DR, limb: Math.asin(D.SKY.sunDiscW[1]) / DR + D.SKY.sunR / DR }; });
    D.SKY.hour = 6.25; D.setDate(MAY5); return { out, limb }; }, [MAY5, ownEv5]);
  const refrC = refr.out.map(r => r.h === null ? r : { ...r, lift: +(r.drawn - r.geo).toFixed(5), want: +saem(r.geo).toFixed(5), err: +Math.abs(r.drawn - r.geo - saem(r.geo)).toFixed(5) });
  const limbWant = -0.833 + saem(-0.833) + 0.265;
  ok('refraction lifts the drawn discs only: at true altitudes 0, 1 and 10 deg the drawn sun and moon stand Saemundsson\'s refraction above their geometric place (0.483, 0.362, 0.090 deg) within 0.01 deg, in the same azimuth; at the suite\'s own sunrise and sunset the drawn upper limb is at the horizon (0.050 deg up, within 0.02)',
    refrC.length === 6 && refrC.every(r => r.h !== null && Math.abs(r.geo - r.t) < 1e-3 && r.err < 0.01 && r.dAz < 1e-6)
    && refr.limb.length === 2 && refr.limb.every(l => Math.abs(l.limb - limbWant) < 0.02 && Math.abs(l.limb) < 0.07), { refrC, limb: refr.limb, limbWant: +limbWant.toFixed(4) });
  // row: the real sizes. The drawn sun at 17:00 EDT on May 5 (36 deg up), aimed at its disc through a 2-deg field of view (195 px a
  // degree): the white disc's pixels (all three channels 254 or more; the aureole round it stays under) give its diameter as
  // 2 sqrt(n / pi) / (px a degree), 0.53 deg within 20%. The moon: SKY.moonR is asin(1737.4 km / the kit's topocentric distance) at
  // 22:00 EDT every day from Mar 20 to Jun 20, and lies in 0.24-0.28 deg (0.49-0.56 across); SKY.sunR is 0.265 deg.
  const MOON_D = []; for (let m = MAR20; m <= JUN20; m++) MOON_D.push({ m, jd: jdOf(m, 22, -4) });
  const sizes = await page.evaluate(([MAY5, days]) => { const D = window.__DS, W = window, DR = Math.PI / 180;
    D.SKY.hour = 17; D.setDate(MAY5); const fov = 2 * DR, F = W.__dsAimed(D.SKY.sunDiscW, 0, [D.SKY.sunDiscW], fov); let n = 0, sx = 0, sy = 0, edge = 0;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const i = (y * F.w + x) * 4; if (F.px[i] >= 254 && F.px[i + 1] >= 254 && F.px[i + 2] >= 254) { n++; sx += x; sy += y; } }
    const pxDeg = F.pxPerRad * DR, sun = { n, pxDeg: +pxDeg.toFixed(2), diam: +(2 * Math.sqrt(n / Math.PI) / pxDeg).toFixed(4), c: n ? [+(sx / n - F.at[0].x).toFixed(2), +(sy / n - F.at[0].y).toFixed(2)] : null, sunR: D.SKY.sunR / DR };
    const moon = days.map(d => { D.SKY.hour = 22; D.setDate(d.m); const k = D.ZMH_SKY.skyAt(d.jd, D.OBS_SKY, null).moon.topoDistanceKm;
      return { m: d.m, r: D.SKY.moonR / DR, want: Math.asin(1737.4 / k) / DR }; });
    D.SKY.hour = 6.25; D.setDate(MAY5); return { sun, moon }; }, [MAY5, MOON_D]);
  const mr = sizes.moon.map(d => d.r), mErr = Math.max(...sizes.moon.map(d => Math.abs(d.r - d.want)));
  ok('the sun and the moon at their real sizes: the drawn sun is 0.53 deg across within 20% (white pixels at a 2-deg field of view), SKY.sunR 0.265 deg; SKY.moonR is asin(1737.4 / the moon\'s distance) and lies in 0.24-0.28 deg every day Mar 20 - Jun 20',
    Math.abs(sizes.sun.diam / 0.53 - 1) <= 0.2 && !!sizes.sun.c && Math.hypot(...sizes.sun.c) < 2 && Math.abs(sizes.sun.sunR - 0.265) < 1e-9
    && sizes.moon.length === JUN20 - MAR20 + 1 && mErr < 1e-9 && Math.min(...mr) >= 0.24 && Math.max(...mr) <= 0.28,
    { sun: sizes.sun, moonMin: +Math.min(...mr).toFixed(4), moonMax: +Math.max(...mr).toFixed(4), mErr });
  // row: the phase. The page's lit fraction (SKY.moonPhase, the kit's) at the Meeus 49 mean full moons of May 1 and May 31 (k 325.5,
  // 326.5) and the mean new moon of May 16 (k 326), and at the TRUE last quarter of May 9 (k 325.75, quarterJD: the mean one is
  // 17 h early, where the fraction is 0.57); and astronomy-engine's 0.835 at 2026-05-06 02:00 UT (22:00 EDT May 5).
  const phT = [['full May 1', meanPhase(325.5)], ['new May 16', meanPhase(326)], ['full May 31', meanPhase(326.5)], ['last quarter May 9', quarterJD(325.75)], ['AE', JD22]]
    .map(([n, jd]) => { const loc = jd - 2400000.5 - 4 / 24, mjd = Math.floor(loc); return { n, mjd, h: (loc - mjd) * 24 }; });
  const ph = await page.evaluate(([ts, MAY5]) => { const D = window.__DS;
    const out = ts.map(t => { D.SKY.hour = t.h; D.setDate(t.mjd); return { ...t, f: D.SKY.moonPhase.illuminatedFraction }; });
    D.SKY.hour = 6.25; D.setDate(MAY5); return out; }, [phT, MAY5]);
  const phF = Object.fromEntries(ph.map(p => [p.n, +p.f.toFixed(4)]));
  ok('the moon\'s phase: lit over 0.97 at the full moons of May 1 and May 31, under 0.03 at the new moon of May 16 (Meeus mean phases), 0.5 +/- 0.05 at the last quarter of May 9 (Meeus 49\'s true quarter), and astronomy-engine\'s 0.835 at 2026-05-06 02:00 UT within 0.005',
    ph.length === 5 && phF['full May 1'] > 0.97 && phF['full May 31'] > 0.97 && phF['new May 16'] < 0.03 && Math.abs(phF['last quarter May 9'] - 0.5) <= 0.05
    && Math.abs(phF.AE - AE.moonIllum) <= 0.005 && ph[0].mjd === MJD(2026, 5, 1) && ph[1].mjd === MJD(2026, 5, 16) && ph[2].mjd === MJD(2026, 5, 31) && ph[3].mjd === MJD(2026, 5, 9), ph);
  // row: the cycle. Over 30 game days from May 1 (22:00 EDT each day, May 1-30, the date stepped by setDate) the lit fraction runs full -> new
  // -> full once: it falls to one minimum under 0.03 and rises back, never turning anywhere else, waning before and waxing after.
  // And the moon rises a mean 30-70 min later each day: each day's rise (the page's topocentric centre crossing 0 deg upward, found
  // by bisection on a quarter-hour scan) over May 1-30, the mean interval between rises less 24 h.
  const cyc = await page.evaluate(MAY1 => { const D = window.__DS, DR = Math.PI / 180, fr = [], rises = [];
    for (let d = 0; d < 30; d++) { D.SKY.hour = 22; D.setDate(MAY1 + d); fr.push({ f: D.SKY.moonPhase.illuminatedFraction, w: D.SKY.moonPhase.waxing }); }
    const alt = h => { D.SKY.hour = h; D.updateSky(); return Math.asin(D.SKY.moon[1]) / DR; };
    for (let d = 0; d < 30; d++) { D.SKY.hour = 0; D.setDate(MAY1 + d); let p = alt(0);
      for (let q = 1; q <= 96; q++) { const h1 = q / 4, a = alt(h1); if (p < 0 && a >= 0) { let lo = h1 - 0.25, hi = h1;
          for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (alt(m) < 0) lo = m; else hi = m; } rises.push(MAY1 + d + (lo + hi) / 48); }
        p = a; } }
    D.SKY.hour = 6.25; D.setDate(MAY1 + 4); return { fr, rises }; }, MJD(2026, 5, 1));
  const f = cyc.fr.map(r => r.f), iMin = f.indexOf(Math.min(...f));
  const turns = f.slice(1, -1).filter((v, i) => (v - f[i]) * (f[i + 2] - v) < 0).length;
  const delay = cyc.rises.length > 1 ? ((cyc.rises[cyc.rises.length - 1] - cyc.rises[0]) / (cyc.rises.length - 1) - 1) * 1440 : null;
  const cycInfo = { first: +f[0].toFixed(3), min: +f[iMin].toFixed(4), minDay: iMin + 1, last: +f[29].toFixed(3), turns, rises: cyc.rises.length, delayMin: delay && +delay.toFixed(1),
    waneOk: cyc.fr.slice(0, iMin).every(r => !r.w), waxOk: cyc.fr.slice(iMin + 1).every(r => r.w) };
  ok('the moon\'s cycle: over 30 game days from May 1 the lit fraction runs full -> new -> full once (one turn, a minimum under 0.03 near May 16, waning before it and waxing after), and the moon rises a mean 30-70 min later each day',
    cyc.fr.length === 30 && f[0] > 0.95 && f[29] > 0.95 && f[iMin] < 0.03 && iMin >= 13 && iMin <= 17 && turns === 1 && cycInfo.waneOk && cycInfo.waxOk
    && cyc.rises.length >= 27 && delay >= 30 && delay <= 70, cycInfo);
  // row: the bright limb faces the sun, at three phases, and the disc's lit share is its phase. Zoomed on the drawn moon (a 1.5-deg
  // field of view, about 260 px a degree) at a waning gibbous (May 6, moon 22 deg up, rising, night), a last quarter (May 10, 30 deg
  // up, rising, dawn) and a waxing crescent (May 20, 30 deg up, setting, night); hours by bisection. The lit pixels are those the moon
  // adds (moon on minus off) at over half the most it adds; the line from the disc's centre to their centroid points within 15 deg
  // of the sun's direction on the screen (the suite's own sun, as the tangent of the great circle from the moon toward it); their
  // count over pi r^2 (r from SKY.moonR) is the page's lit fraction within 0.08; and on the crescent at night the dark part shows
  // the earthshine: the disc's unlit pixels inside 0.8 r add 8 or more.
  const limbT = [['gibbous', MAY5 + 1, 2, 4.5, 22], ['quarter', MAY5 + 5, 5, 6.5, 30], ['crescent', MAY5 + 15, 21, 23, 30]];
  const limb = [];
  for (const [n, mjd, lo, hi, alt] of limbT) {
    const r = await page.evaluate(([mjd, lo, hi, alt]) => { const D = window.__DS, W = window, DR = Math.PI / 180;
      const h = W.__dsWhen('moon', mjd, lo, hi, alt); if (h === null) return null;
      return { h, m: D.SKY.moonDiscW.slice(), R: D.SKY.moonR, frac: D.SKY.moonPhase.illuminatedFraction, sunUp: Math.asin(D.SKY.sun[1]) / DR, night: D.SKY.night }; }, [mjd, lo, hi, alt]);
    if (!r) { limb.push({ n, missing: true }); continue; }
    const m = r.m, sW = enuToWorldOwn(ownSun(jdOf(mjd, r.h, -4)).v), dm = sW[0] * m[0] + sW[1] * m[1] + sW[2] * m[2];
    const tg = [0, 1, 2].map(i => sW[i] - m[i] * dm), tl = Math.hypot(...tg), pt = [0, 1, 2].map(i => m[i] + 1e-4 * tg[i] / tl);
    const px = await page.evaluate(([m, pt, R, MAY5]) => { const W = window, D = window.__DS, fov = 1.5 * Math.PI / 180;
      const F = W.__dsMoonPair(m, 0, [m, pt], fov), c = F.at[0], rp = Math.tan(R) * F.pxPerRad; let mx = 0;
      for (let y = Math.floor(c.y - rp - 2); y <= c.y + rp + 2; y++) for (let x = Math.floor(c.x - rp - 2); x <= c.x + rp + 2; x++) mx = Math.max(mx, F.diff(x, y));
      let n = 0, sx = 0, sy = 0, es = 0, ne = 0;
      for (let y = Math.floor(c.y - rp - 2); y <= c.y + rp + 2; y++) for (let x = Math.floor(c.x - rp - 2); x <= c.x + rp + 2; x++) { const v = F.diff(x, y);
        if (v > mx / 2) { n++; sx += x; sy += y; } else if (Math.hypot(x - c.x, y - c.y) < 0.8 * rp) { es += v; ne++; } }
      const lit = [sx / n - c.x, sy / n - c.y], sun = [F.at[1].x - c.x, F.at[1].y - c.y];
      const ang = Math.abs(((Math.atan2(lit[1], lit[0]) - Math.atan2(sun[1], sun[0])) / Math.PI * 180 + 540) % 360 - 180);
      D.SKY.hour = 6.25; D.setDate(MAY5);
      return { rp: +rp.toFixed(1), max: Math.round(mx), lit: n, share: +(n / (Math.PI * rp * rp)).toFixed(3), ang: +ang.toFixed(2), es: ne ? +(es / ne).toFixed(1) : null }; }, [m, pt, r.R, MAY5]);
    limb.push({ n, h: +r.h.toFixed(3), frac: +r.frac.toFixed(3), sunUp: +r.sunUp.toFixed(1), night: +r.night.toFixed(2), ...px });
  }
  ok('the bright limb faces the sun: zoomed on a waning gibbous, a last quarter and a waxing crescent, the lit pixels\' centroid lies off the disc\'s centre toward the sun\'s direction within 15 deg, their share of the disc is the lit fraction within 0.08, and the crescent\'s dark part shows earthshine at night',
    limb.length === 3 && limb.every(l => !l.missing && l.ang <= 15 && Math.abs(l.share - l.frac) <= 0.08 && l.max >= 40)
    && limb[2].night > 0.95 && limb[2].es >= 8, limb);
  // row: the moon by day, as added light over the blue. On May 11 at the hour the sun reaches 30 deg (by bisection; the moon about 45
  // deg up, a third lit), aimed at the moon through a 0.1 rad field: the brightest of the disc's pixels beats the mean of the sky on
  // a ring 2 deg from the moon by 20 or more.
  const byDay = await page.evaluate(MAY11 => { const D = window.__DS, W = window, DR = Math.PI / 180;
    const h = W.__dsWhen('sun', MAY11, 7.5, 10, 30); if (h === null) return null;
    const m = D.SKY.moonDiscW, F = W.__dsAimed(m, 0, [m], 0.1), c = F.at[0], rp = Math.tan(D.SKY.moonR) * F.pxPerRad, r2 = Math.tan(2 * DR) * F.pxPerRad; let disc = 0, ring = 0, nr = 0;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const d = Math.hypot(x - c.x, y - c.y), v = F.L(x, y);
      if (d < rp - 1) disc = Math.max(disc, v); else if (Math.abs(d - r2) < 2) { ring += v; nr++; } }
    const o = { h: +h.toFixed(3), sunUp: +(Math.asin(D.SKY.sun[1]) / DR).toFixed(1), moonUp: +(Math.asin(D.SKY.moon[1]) / DR).toFixed(1), day: +D.SKY.day.toFixed(2), night: +D.SKY.night.toFixed(3),
      frac: +D.SKY.moonPhase.illuminatedFraction.toFixed(2), disc: Math.round(disc), ring: +(ring / nr).toFixed(1), nr };
    D.SKY.hour = 6.25; D.setDate(MAY11 - 6); return o; }, MAY5 + 6);
  ok('the moon by day: on May 11 with the sun 30 deg up and the moon over 20 deg, its disc is brighter than the blue sky 2 deg off it (by 20 levels or more), drawn as added light, not by the night',
    !!byDay && byDay.sunUp > 20 && byDay.moonUp > 20 && byDay.night === 0 && byDay.nr > 100 && byDay.disc >= byDay.ring + 20, byDay);
  // row: no stray pixels from the moon disc. At the gibbous hour above (night), two 0.8 rad frames: aimed at the moon, and aimed at
  // the point 90 deg from it toward the zenith, where the kit once leaked a dashed great circle; in both, moon on minus off is
  // nowhere more than 1 level at a pixel over 2 moon radii from the drawn moon (each pixel's own ray), and the first frame does hold
  // the moon.
  const stray = await page.evaluate(([MAY6]) => { const D = window.__DS, W = window, DR = Math.PI / 180;
    const h = W.__dsWhen('moon', MAY6, 2, 4.5, 22); if (h === null) return null;
    const m = D.SKY.moonDiscW, R = D.SKY.moonR, up = [0, 1, 0], k = m[1], z = [0, 1, 2].map(i => up[i] - m[i] * k), zl = Math.hypot(...z), far = z.map(v => v / zl);
    const look = aim => { const F = W.__dsMoonPair(aim, 0, [], 0.8); let out = 0, maxOut = 0, inside = 0;
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const v = Math.abs(F.diff(x, y)); if (v < 0.5) continue; const d = F.dir(x, y);
        const a = Math.acos(Math.min(1, d[0] * m[0] + d[1] * m[1] + d[2] * m[2])); if (a > 2 * R) { out++; maxOut = Math.max(maxOut, v); } else inside++; }
      return { out, maxOut: +maxOut.toFixed(1), inside }; };
    const o = { h: +h.toFixed(3), at: look(m), far: look(far), sep: +(Math.acos(far[0] * m[0] + far[1] * m[1] + far[2] * m[2]) / DR).toFixed(2) };
    D.SKY.hour = 6.25; D.setDate(MAY6 - 1); return o; }, [MAY5 + 1]);
  ok('no stray pixels from the moon disc: aimed at the moon and at the point 90 deg from it, the moon adds nothing (1 level at most) to any pixel over 2 radii from its disc, and the first frame holds the disc',
    !!stray && Math.abs(stray.sep - 90) < 0.01 && stray.at.inside >= 4 && stray.at.maxOut <= 1 && stray.far.maxOut <= 1 && stray.far.inside === 0, stray);
  // ---- 8b3. moonlight by phase; a bright moon dims the stars; earthshine by night only (DS-4, dssky step 4) ----
  // row: a full moon lights the night. Two frames from 30 m above the car (__dsAimed, 0.8 rad, no cars drawn), aimed 30 deg down at
  // world azimuths 20 and 200 deg, so that each frame is all ground (its top edge 7 deg under the horizon): the land as the moon
  // and the sky's ambient light it, without the headlights and the night sky, which do not change with the moon and would only
  // dilute the ratio (the chase view is recorded beside it, not tested). The mean 8-bit luminance of the two at 01:00 EDT on
  // 2026-05-31 (the full moon of May 31, high in the south: the row checks it is over 20 deg up on the page), on 2026-05-16 (the
  // new moon, under the horizon), and at dusk, the hour on the evening of May 16 at which the page's sun is at -3 deg (by
  // bisection). The full-moon night is at least 1.5x the moonless one, and both are under half of dusk. And the light goes by the
  // phase (the new moon is under the horizon at 01:00, so the pair alone cannot see it): the first quarter of May 23, high in the
  // evening at the hour the page's sun reaches -25 deg (by bisection: the moon at about the full moon's height, and past the
  // twilight still in the scene at -15 deg, traced with the moon's light taken out: the land 12.24 at -15 against 9.49 moonless,
  // 9.488 at -25), lifts the land over the moonless night by at
  // most 0.35 of what the full moon lifts it (the kit's phase law gives a quarter about 0.11 of the full moon's light). MOON_AMB was tuned on
  // this row (1.0: measured 18.18 / 10.09 / 44.87, so 1.80x and 0.41 of dusk, the quarter's lift 0.18; at 1.4 the full moon came
  // to 0.45 of dusk, at 0 to 1.29x). On the step-3 page (the old moonlight, no phase, no moonlit ambient): 13.32 / 10.08, 1.32x,
  // and the quarter, higher in the sky, lit the land 1.28x as much as the full moon did.
  const MAY31 = MAY5 + 26;   // MAY16 is the Milky Way row's (8b)
  const nightAt = async (mjd, h) => { const st = await page.evaluate(([mjd, h]) => { const D = window.__DS, W = window, DR = Math.PI / 180;
    D.SETTINGS.cycle = 0; D.CAM.mode = 1; D.SKY.hour = h; D.setDate(mjd);
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const ground = [20, 200].map(az => { const F = W.__dsAimed(D.enuToWorld(enu(-30, az)), 0); let s = 0; for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) s += F.L(x, y); return s / (F.w * F.h); });
    return { h: +h.toFixed(4), sun: +(Math.asin(D.SKY.sun[1]) / DR).toFixed(2), moon: +(Math.asin(D.SKY.moon[1]) / DR).toFixed(2), lit: +D.SKY.moonPhase.illuminatedFraction.toFixed(3),
      at: Math.round(D.PLAYER.s), ground: +((ground[0] + ground[1]) / 2).toFixed(2) }; }, [mjd, h]);
    await frames(4); return { ...st, chase: +(await lum()).mean.toFixed(2) }; };
  const duskH = await page.evaluate(MAY16 => window.__dsWhen('sun', MAY16, 19.5, 22, -3), MAY16);
  const qH = await page.evaluate(M => window.__dsWhen('sun', M, 21, 24, -25), MAY5 + 18);
  const moonNight = { full: await nightAt(MAY31, 1), none: await nightAt(MAY16, 1), dusk: duskH === null ? null : await nightAt(MAY16, duskH), quarter: qH === null ? null : await nightAt(MAY5 + 18, qH) };
  await page.evaluate(MAY5 => { const D = window.__DS; D.SKY.hour = 6.25; D.setDate(MAY5); }, MAY5);
  if (moonNight.dusk) { const r = (a, b, k) => +(moonNight[a][k] / moonNight[b][k]).toFixed(3);
    Object.assign(moonNight, { ratio: r('full', 'none', 'ground'), fullDusk: r('full', 'dusk', 'ground'), noneDusk: r('none', 'dusk', 'ground'), chaseRatio: r('full', 'none', 'chase'), chaseFullDusk: r('full', 'dusk', 'chase') });
    if (moonNight.quarter) moonNight.qLift = +((moonNight.quarter.ground - moonNight.none.ground) / (moonNight.full.ground - moonNight.none.ground)).toFixed(3); }
  ok('a full moon lights the night: the full-moon midnight (2026-05-31 01:00 EDT, the moon high) is at least 1.5x the new-moon midnight (2026-05-16 01:00) in mean luminance, and both are under half of dusk (the sun at -3 deg); a first-quarter moon high lifts the night at most 0.35 as much as the full one',
    !!moonNight.dusk && !!moonNight.quarter && moonNight.full.moon > 20 && moonNight.full.lit > 0.97 && moonNight.none.moon < 0 && Math.abs(moonNight.dusk.sun + 3) < 0.01
    && moonNight.ratio >= 1.5 && moonNight.fullDusk < 0.5 && moonNight.noneDusk < 0.5
    && moonNight.quarter.moon > 20 && Math.abs(moonNight.quarter.lit - 0.5) < 0.1 && moonNight.qLift >= 0 && moonNight.qLift <= 0.35, moonNight);
  // row: a bright moon dims the stars. What Polaris adds to its pixel (STARS.on minus off, the brightest pixel in 7x7 round where
  // the page's own Polaris vertex projects, aimed 8 deg to its side as the fade row is) at 01:00 EDT on May 31 (full moon high),
  // and on May 16 (no moon) at the hour, by bisection in 01:30-03:00, at which the page's Polaris stands at the same altitude (the
  // same side of the pole, so the same azimuth too, and the same extinction): the full-moon value is 0.3-0.75 of the moonless one.
  // The pass's gain as handed to the GPU (uStarK, read back with getUniform) is recorded beside it.
  const polDim = await page.evaluate(([MAY16, MAY31]) => { const D = window.__DS, W = window, DR = Math.PI / 180;
    const idx = D.SKY_DATA.stars.rows.findIndex(r => r[0] === 11767);
    const pol = () => D.enuToWorld(D.starDir(idx)), alt = () => Math.asin(D.starDir(idx)[1]) / DR;
    const add = () => { const p = pol(), v = []; let k = null; for (const on of [true, false]) { D.STARS.on = on; const F = W.__dsAimed(p, 8, [p]), a = F.at[0]; let best = -1e9;
      if (on) k = gl.getUniform(PRG.stars.p, PRG.stars.U.uStarK);
      for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) best = Math.max(best, F.L(x, y)); v.push(best); }
      D.STARS.on = true; return { add: Math.round(v[0] - v[1]), uStarK: +k.toFixed(4) }; };
    D.SKY.hour = 1; D.setDate(MAY31); const a31 = alt(), az31 = Math.atan2(D.starDir(idx)[0], D.starDir(idx)[2]) / DR;
    const full = { alt: +a31.toFixed(4), moon: +(Math.asin(D.SKY.moon[1]) / DR).toFixed(1), ...add() };
    const at = h => { D.SKY.hour = h; D.setDate(MAY16); return alt() - a31; };
    let lo = 1.5, hi = 3, f = at(lo), h = null;
    if (f * at(hi) < 0) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, v = at(m); if (v * f > 0) { lo = m; f = v; } else hi = m; } h = (lo + hi) / 2; at(h); }
    const none = h === null ? null : { h: +h.toFixed(4), alt: +alt().toFixed(4), dAz: +Math.abs(Math.atan2(D.starDir(idx)[0], D.starDir(idx)[2]) / DR - az31).toFixed(4), moon: +(Math.asin(D.SKY.moon[1]) / DR).toFixed(1), ...add() };
    D.SKY.hour = 6.25; D.setDate(MAY16 - 11);
    return { full, none, ratio: none ? +(full.add / none.add).toFixed(3) : null };
  }, [MAY16, MAY31]);
  ok('a bright moon dims the stars: what Polaris adds at the full-moon midnight (May 31, 01:00 EDT) is 0.3-0.75 of what it adds on the moonless night of May 16 at the same altitude, and the gain handed to the star pass falls with it',
    !!polDim.none && Math.abs(polDim.none.alt - polDim.full.alt) < 1e-3 && polDim.none.dAz < 0.05 && polDim.full.moon > 20 && polDim.none.moon < 0
    && polDim.none.add >= 60 && polDim.ratio >= 0.3 && polDim.ratio <= 0.75 && polDim.full.uStarK < polDim.none.uStarK * 0.75, polDim);
  // row (the overseer's, dssky step 4): earthshine is a night thing. By day the moon's dark part is no brighter than the sky beside
  // it. On May 11 at the hour the sun reaches 30 deg (the moon about 45 deg up, a third lit), through a 0.1 rad field: the pixels
  // well inside the dark part (under 0.85 radii from the centre, and 0.3 radii or more on the dark side of the terminator, which
  // crosses the sun's axis at 1 - 2 x the lit fraction), the moon on against the moon off (the disc moved under the horizon) and
  // against the sky on a ring 2 deg off. With earthshine by day the dark part sat lighter than the blue (dssky step 3's note).
  const dayDark = await page.evaluate(MAY11 => { const D = window.__DS, W = window, DR = Math.PI / 180;
    const h = W.__dsWhen('sun', MAY11, 7.5, 10, 30); if (h === null) return null;
    const m = D.SKY.moonDiscW, sw = D.SKY.sunW, R = Math.tan(D.SKY.moonR), k = D.SKY.moonPhase.illuminatedFraction;
    const sd = sw[0] * m[0] + sw[1] * m[1] + sw[2] * m[2], st0 = [0, 1, 2].map(i => sw[i] - m[i] * sd), sl = Math.hypot(...st0), st = st0.map(v => v / sl);
    const F = W.__dsMoonPair(m, 0, [m], 0.1), c = F.at[0], r2 = Math.tan(2 * DR) * F.pxPerRad;
    let n = 0, on = 0, off = 0, maxDiff = -1e9, ring = 0, nr = 0;
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
      if (Math.abs(Math.hypot(x - c.x, y - c.y) - r2) < 2) { ring += F.L(x, y); nr++; continue; }
      const d = F.dir(x, y), dm = d[0] * m[0] + d[1] * m[1] + d[2] * m[2], o = [0, 1, 2].map(i => (d[i] / dm - m[i]) / R);
      const r = Math.hypot(...o), u = o[0] * st[0] + o[1] * st[1] + o[2] * st[2];
      if (r < 0.85 && u < 1 - 2 * k - 0.3) { n++; on += F.L(x, y); off += F.off.L(x, y); maxDiff = Math.max(maxDiff, F.diff(x, y)); } }
    const o = { h: +h.toFixed(3), sunUp: +(Math.asin(D.SKY.sun[1]) / DR).toFixed(1), moonUp: +(Math.asin(D.SKY.moon[1]) / DR).toFixed(1), night: D.SKY.night, frac: +k.toFixed(3),
      n, dark: +(on / n).toFixed(2), behind: +(off / n).toFixed(2), maxDiff: +maxDiff.toFixed(1), ring: +(ring / nr).toFixed(2), nr };
    D.SKY.hour = 6.25; D.setDate(MAY11 - 6); return o; }, MAY5 + 6);
  ok('by day the moon\'s dark part is no brighter than the sky beside it: on May 11 with the sun 30 deg up, the pixels well inside the dark part add at most 1 level to the sky behind them and sit within 1 level of the sky 2 deg off',
    !!dayDark && dayDark.sunUp > 20 && dayDark.moonUp > 20 && dayDark.night === 0 && dayDark.frac > 0.2 && dayDark.frac < 0.5 && dayDark.n >= 100 && dayDark.nr > 100
    && dayDark.maxDiff <= 1 && dayDark.dark <= dayDark.ring + 1, dayDark);
  // ---- 8b4. a slider for each thing in the sky (DS-6, dssky step 5) ----
  // SETTINGS.sky holds six percentages, 0-200, 100 by default: Stars and Planets scale their vertices' gain in the one star pass,
  // Milky Way the band's gain, Sun the sun's colour (its disc, aureole, broad lobe and light), Moonlight the moon's disc, its glow and
  // its light (the moonlit ambient with it), Earthshine the light on its dark part. Every measure below is the suite's own, through
  // the page's renderScene() (__dsAimed); a value handed to the GPU is read back with gl.getUniform after the frame that used it.
  const SKY_K = ['stars', 'planets', 'mw', 'sun', 'moon', 'earthshine'];
  const skyPage = (fn, arg) => page.evaluate(([src, arg]) => { try { return (0, eval)(src)(arg); } catch (e) { return { err: String(e) }; } }, [String(fn), arg]);
  await page.evaluate(() => { const W = window, D = W.__DS, DR = Math.PI / 180;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    W.__dsSkySet = o => { D.SETTINGS.sky = Object.assign({ stars: 100, planets: 100, mw: 100, sun: 100, moon: 100, earthshine: 100 }, o || {}); D.updateSky(); };
    // what star-buffer vertex i adds to its pixel: the brightest in 7x7 round where the page's own vertex projects, aimed 8 deg to its
    // side as the Jupiter row is, STARS.on minus off
    W.__dsVertAdd = (i, night) => { const p = D.enuToWorld(D.starDir(i)), v = []; const keep = D.SKY.night; if (night !== undefined) D.SKY.night = night;
      for (const on of [true, false]) { D.STARS.on = on; const F = W.__dsAimed(p, 8, [p]), a = F.at[0]; let best = -1e9;
        for (let y = Math.round(a.y) - 3; y <= Math.round(a.y) + 3; y++) for (let x = Math.round(a.x) - 3; x <= Math.round(a.x) + 3; x++) best = Math.max(best, F.L(x, y)); v.push(best); }
      D.STARS.on = true; D.SKY.night = keep; return Math.round(v[0] - v[1]); };
    W.__dsHip = hip => D.SKY_DATA.stars.rows.findIndex(r => r[0] === hip);
    // the mean of the land from 30 m, aimed 30 deg down at world azimuths 20 and 200 (the night row's frames)
    W.__dsLand = () => { let s = 0, n = 0; for (const az of [20, 200]) { const keep = now; now = 100; const F = W.__dsAimed(D.enuToWorld(enu(-30, az)), 0); now = keep; for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { s += F.L(x, y); n++; } } return +(s / n).toFixed(3); };
    // a 15x15 patch's mean where a world direction projects, aimed at it
    W.__dsPatch = aim => { const F = W.__dsAimed(aim, 0, [aim]), a = F.at[0]; let s = 0, n = 0;
      for (let y = Math.round(a.y) - 7; y <= Math.round(a.y) + 7; y++) for (let x = Math.round(a.x) - 7; x <= Math.round(a.x) + 7; x++) { s += F.L(x, y); n++; } return s / n; };
    // the moon zoomed (1.5 deg) at an hour found by bisection: the most it adds (moon on minus off), and the mean it adds well inside the
    // dark part (under 0.85 radii, 0.3 radii or more on the dark side of the terminator, as the by-day row has it)
    W.__dsMoonZoom = () => { const m = D.SKY.moonDiscW, sw = D.SKY.sunW, R = Math.tan(D.SKY.moonR), k = D.SKY.moonPhase.illuminatedFraction;
      const sd = sw[0] * m[0] + sw[1] * m[1] + sw[2] * m[2], st0 = [0, 1, 2].map(i => sw[i] - m[i] * sd), sl = Math.hypot(...st0), st = st0.map(v => v / sl);
      const F = W.__dsMoonPair(m, 0, [m], 1.5 * DR); let mx = 0, dk = 0, n = 0;
      for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const v = F.diff(x, y); mx = Math.max(mx, v);
        const d = F.dir(x, y), dm = d[0] * m[0] + d[1] * m[1] + d[2] * m[2], o = [0, 1, 2].map(i => (d[i] / dm - m[i]) / R);
        if (Math.hypot(...o) < 0.85 && o[0] * st[0] + o[1] * st[1] + o[2] * st[2] < 1 - 2 * k - 0.3) { dk += v; n++; } }
      return { max: Math.round(mx), dark: n ? +(dk / n).toFixed(2) : null, n, frac: +k.toFixed(3), night: +D.SKY.night.toFixed(3) }; };
    W.__dsU = (prg, name) => { const v = gl.getUniform(PRG[prg].p, PRG[prg].U[name]); return v && v.length !== undefined ? Array.from(v) : v; };
  });
  // row: at 100% everywhere the frame is byte-identical to the frame before the sliders. Seven frames from 30 m above the car, the
  // star pass on, each holding what one slider scales: noon at the sun (its disc, aureole and lobe), the land at 17:00 (the sun's
  // light), 22:00 at 32 deg up in azimuth 200 (the stars and the Milky Way), 22:00 at Jupiter's vertex (a planet), 04:00 on May 6 at
  // the moon (its disc and glow), the land at the full-moon midnight of May 31 (its light and the moonlit ambient), and the May 20
  // crescent zoomed to 1.5 deg (its earthshine). SKY_SLIDERS_BEFORE: each frame's FNV-1a hash of its RGBA bytes, recorded 2026-11-02
  // by this row's own code on the page before the sliders (the page of 1125705, dssky step 4), with the page's clock held at 100 s for
  // each frame (the trees sway on it) and the car teleported to s = 400 first: a land frame is not otherwise the same from run to run.
  const SKY_SLIDERS_BEFORE = { noonSun: '0174b859', land17: 'e7c77ffc', night22: 'a3451048', jup22: '261017ad', moon4: '9a58595c', landFull: '50d59823', crescent: '937d0897' };
  const sky100 = await skyPage(([MAY5, MAY5n]) => { const W = window, D = W.__DS, DR = Math.PI / 180;
    const enu = (alt, az) => [Math.sin(az * DR) * Math.cos(alt * DR), Math.sin(alt * DR), Math.cos(az * DR) * Math.cos(alt * DR)];
    const fnv = px => { let h = 0x811c9dc5; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
    // the page's clock `now` (the trees' sway, uWind) held at 100 s for the frame, so a frame with trees in it is the same from run to run
    const hashOf = (aim, fov) => { const keep = now; now = 100; const F = W.__dsAimed(aim, 0, [], fov); now = keep; let s = 0; for (let i = 0; i < F.px.length; i += 4) s += F.px[i] + F.px[i + 1] + F.px[i + 2]; return { hash: fnv(F.px), sum: s }; };
    const atBody = b => { const v = D.SKY[b], az = Math.atan2(v[0], v[2]) / DR; return D.enuToWorld(enu(Math.max(Math.asin(v[1]) / DR, 32), az)); };
    if (D.SETTINGS.sky) W.__dsSkySet({});
    D.teleport(400); D.TRAFFIC.cars.length = 0;   // the car where the earlier rows (which drive on real frames) cannot have left it
    const out = {};
    D.SKY.hour = 12; D.setDate(MAY5); out.noonSun = hashOf(atBody('sun'));
    D.SKY.hour = 17; D.setDate(MAY5); out.land17 = hashOf(D.enuToWorld(enu(-30, 200)));
    D.SKY.hour = 22; D.setDate(MAY5); out.night22 = hashOf(D.enuToWorld(enu(32, 200)));
    out.jup22 = hashOf(D.enuToWorld(D.starDir(D.STARS.n + 3)));
    D.SKY.hour = 4; D.setDate(MAY5 + 1); out.moon4 = hashOf(atBody('moon'));
    D.SKY.hour = 1; D.setDate(MAY5 + 26); out.landFull = hashOf(D.enuToWorld(enu(-30, 20)));
    const h = W.__dsWhen('moon', MAY5 + 15, 21, 23, 30); out.crescent = h === null ? null : hashOf(D.SKY.moonDiscW, 1.5 * DR);
    D.SKY.hour = 6.25; D.setDate(MAY5);
    return out;
  }, [MAY5]);
  console.log('  .. sky sliders at 100%: ' + JSON.stringify(sky100));
  const sky100Diff = SKY_SLIDERS_BEFORE ? Object.keys(SKY_SLIDERS_BEFORE).map(k => ({ k, was: SKY_SLIDERS_BEFORE[k], now: sky100[k] && sky100[k].hash })).filter(r => r.was !== r.now) : ['no record'];
  ok('at 100% everywhere the frame is byte-identical to the frame before the sliders: seven frames (the sun, its light, the stars and the Milky Way, Jupiter, the moon, its light, the crescent\'s earthshine) hash as recorded on the page before them',
    !sky100.err && sky100Diff.length === 0 && Object.keys(sky100).length === 7, { diff: sky100Diff, err: sky100.err });
  // row: the SKY section. After TIME, its own h3, six range inputs labelled Stars, Planets, Milky Way, Sun, Moonlight and Earthshine,
  // 0-200 in steps of 1, at 100 on a fresh page, read at 320 px wide: every label and slider inside the panel, the label clear of its
  // slider, and the panel with no sideways scroll.
  await page.setViewportSize({ width: 320, height: 568 });
  await frames(2);
  const skyUI = await skyPage(() => { const D = window.__DS; D.openSettings();
    const panel = document.querySelector('#settings .panel'), pr = panel.getBoundingClientRect(), h3 = [...panel.querySelectorAll('h3')].map(h => h.textContent);
    const sky = [...panel.querySelectorAll('h3')].find(h => h.textContent === 'SKY'), rows = [];
    for (let el = sky && sky.nextElementSibling; el && el.tagName !== 'H3'; el = el.nextElementSibling) for (const r of (el.classList.contains('row') ? [el] : el.querySelectorAll('.row'))) {
      const inp = r.querySelector('input'), lab = r.querySelector('label'); if (!inp || !lab) continue;
      const ir = inp.getBoundingClientRect(), lr = lab.getBoundingClientRect();
      rows.push({ label: lab.textContent, for: lab.htmlFor === inp.id, type: inp.type, min: inp.min, max: inp.max, step: inp.step, value: inp.value, k: inp.dataset.k,
        inside: lr.left >= pr.left - 0.5 && ir.right <= pr.right + 0.5 && ir.left >= pr.left - 0.5, clear: lr.right <= ir.left + 0.5, w: Math.round(ir.width) }); }
    const o = { h3, rows, scroll: panel.scrollWidth - panel.clientWidth, docScroll: document.documentElement.scrollWidth - innerWidth, iw: innerWidth };
    D.closeSettings(); return o; });
  await page.setViewportSize({ width: 844, height: 390 });
  await frames(2);
  const skyLabels = ['Stars', 'Planets', 'Milky Way', 'Sun', 'Moonlight', 'Earthshine'];
  ok('a SKY section after TIME with Stars, Planets, Milky Way, Sun, Moonlight and Earthshine sliders, 0-200 in steps of 1, defaults 100, fitting at 320 px wide',
    !skyUI.err && skyUI.h3.indexOf('SKY') === skyUI.h3.indexOf('TIME') + 1 && skyUI.rows.length === 6 && skyUI.rows.map(r => r.label).join() === skyLabels.join()
    && skyUI.rows.map(r => r.k).join() === SKY_K.join() && skyUI.rows.every(r => r.for && r.type === 'range' && r.min === '0' && r.max === '200' && r.step === '1' && r.value === '100' && r.inside && r.clear && r.w >= 80)
    && skyUI.scroll <= 0 && skyUI.docScroll <= 0 && skyUI.iw === 320, skyUI);
  // row: saved and restored. The six sliders moved through the panel (an input event each) are in the stored settings; a second page
  // reads them and its panel shows them; a stored settings object without `sky` (an old save) reads 100 everywhere, one with only some
  // of the six reads 100 for the rest, under the same key.
  const skyMoved = { stars: 37, planets: 150, mw: 0, sun: 200, moon: 64, earthshine: 121 };
  const skySaved = await skyPage(mv => { const D = window.__DS; D.openSettings();
    for (const [k, v] of Object.entries(mv)) { const el = document.querySelector(`#settings input[data-k="${k}"][type=range]`); if (!el) continue; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }
    D.closeSettings(); return { live: Object.assign({}, D.SETTINGS.sky), stored: (JSON.parse(localStorage.getItem('drivingSimulator.settings.v1') || '{}') || {}).sky || null }; }, skyMoved);
  const skyVisit = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e)));
    await p.goto(PAGE); await p.waitForFunction(() => window.__DS && window.__DS.SKY, null, { timeout: 60000 });
    const r = await p.evaluate(() => { const D = window.__DS; D.openSettings(); const ui = {}; for (const el of document.querySelectorAll('#settings input[type=range][data-k]')) ui[el.dataset.k] = el.value;
      D.closeSettings(); return { sky: D.SETTINGS.sky ? Object.assign({}, D.SETTINGS.sky) : null, ui }; });
    await p.close(); return r; };
  const skyBack = await skyVisit();
  const restore = s => page.evaluate(s => { const k = 'drivingSimulator.settings.v1', o = JSON.parse(localStorage.getItem(k) || '{}'); if (s === undefined) delete o.sky; else o.sky = s; localStorage.setItem(k, JSON.stringify(o)); }, s);
  await restore(undefined); const skyOld = await skyVisit();
  await restore({ stars: 50, moon: 0 }); const skyPart = await skyVisit();
  await page.evaluate(() => { const D = window.__DS; if (window.__dsSkySet) window.__dsSkySet({}); try { localStorage.setItem('drivingSimulator.settings.v1', JSON.stringify(D.SETTINGS)); } catch (e) { /* */ } });
  const all100 = o => !!o && SKY_K.every(k => o[k] === 100);
  ok('the sky sliders are saved and come back after a reload; an old save without them reads 100 everywhere, and one with some of them reads 100 for the rest',
    !skySaved.err && SKY_K.every(k => skySaved.live[k] === skyMoved[k] && skySaved.stored && skySaved.stored[k] === skyMoved[k])
    && !!skyBack.sky && SKY_K.every(k => skyBack.sky[k] === skyMoved[k] && skyBack.ui[k] === String(skyMoved[k]))
    && all100(skyOld.sky) && SKY_K.every(k => skyOld.ui[k] === '100')
    && !!skyPart.sky && skyPart.sky.stars === 50 && skyPart.sky.moon === 0 && ['planets', 'mw', 'sun', 'earthshine'].every(k => skyPart.sky[k] === 100),
    { saved: skySaved, back: skyBack, old: skyOld, part: skyPart });
  // The per-slider measures, each at a given setting of the six (the rest at 100): stars, what Polaris (HIP 11767) and a fainter star
  // (HIP_DIM, under 128 at 100%) add at 22:00 on May 5; planets, what Jupiter's vertex adds then (and at the night factor JUP_NIGHT, where
  // it is under 128); the Milky Way, the band patch less the patch 40 deg off it at 02:30 on May 6 (the Milky Way row's aims, the stars
  // off); the sun, its saturated pixels at 17:00 through the sun row's 0.2 rad aim, and the land at 17:00; the moon, the most it adds
  // zoomed on the gibbous of May 6 (22 deg up) and the land at the full-moon midnight; earthshine, the mean added well inside the dark
  // part of the May 20 crescent, zoomed. With the GPU's uniforms read back after each.
  const HIP_DIM = 55642, JUP_NIGHT = 0.04;
  const skyMeasure = set => skyPage(([set, MAY5, mwAims, sunW, hipDim, jupNight]) => { const W = window, D = W.__DS, DR = Math.PI / 180; W.__dsSkySet(set);
    const o = {}, pol = W.__dsHip(11767), dim = W.__dsHip(hipDim);
    D.SKY.hour = 22; D.setDate(MAY5); o.pol = W.__dsVertAdd(pol); o.dim = W.__dsVertAdd(dim); o.jup = W.__dsVertAdd(D.STARS.n + 3); o.jupLow = W.__dsVertAdd(D.STARS.n + 3, jupNight);
    D.SKY.hour = 2.5; D.setDate(MAY5 + 1); D.STARS.on = false; const band = W.__dsPatch(mwAims[0]), off = W.__dsPatch(mwAims[1]); D.STARS.on = true; o.mw = +(band - off).toFixed(2); o.uMwGain = W.__dsU('sky', 'uMwGain');
    D.SKY.hour = 17; D.setDate(MAY5); { const F = W.__dsAimed(sunW, 8, [sunW], 0.2); let n = 0; for (let i = 0; i < F.px.length; i += 4) if (F.px[i] >= 250 && F.px[i + 1] >= 250 && F.px[i + 2] >= 240) n++; o.sunPx = n; o.uSunCol = W.__dsU('sky', 'uSunCol'); }
    o.land17 = W.__dsLand();
    const hg = W.__dsWhen('moon', MAY5 + 1, 2, 4.5, 22); o.gib = hg === null ? null : W.__dsMoonZoom(); o.uMoonK = W.__dsU('sky', 'uMoonK');
    D.SKY.hour = 1; D.setDate(MAY5 + 26); o.landFull = W.__dsLand(); o.uMoonCol = W.__dsU('sky', 'uMoonCol'); o.uAmbSky = W.__dsU('world', 'uAmbSky');
    const hc = W.__dsWhen('moon', MAY5 + 15, 21, 23, 30); o.cres = hc === null ? null : W.__dsMoonZoom(); o.uMoonES = W.__dsU('sky', 'uMoonES');
    // the draw: POINTS calls in one aimed frame at 22:00
    D.SKY.hour = 22; D.setDate(MAY5); { const g = document.getElementById('gl').getContext('webgl2'), orig = g.drawArrays; let pts = 0;
      g.drawArrays = function (mode) { if (mode === g.POINTS) pts++; return orig.apply(this, arguments); }; try { W.__dsAimed(D.enuToWorld(D.starDir(pol)), 8, []); } finally { g.drawArrays = orig; } o.points = pts; }
    W.__dsSkySet({}); D.SKY.hour = 6.25; D.setDate(MAY5); return o; }, [set, MAY5, [enuToWorldOwn(enuOf(ALT, bandAz)), enuToWorldOwn(enuOf(ALT, offAz))], sunW17, HIP_DIM, JUP_NIGHT]);
  const sk100 = await skyMeasure({});
  const sk0 = {}; for (const k of SKY_K) sk0[k] = await skyMeasure({ [k]: 0 });
  const skNone = await skyMeasure({ stars: 0, planets: 0 });
  console.log('  .. sky sliders, all at 100: ' + JSON.stringify(sk100));
  // row: each slider at 0 takes its own thing away, and only that: the slider named in the detail is the one that failed
  const zeroBad = [];
  const z = (k, c, v) => { if (!c) zeroBad.push({ k, v }); };
  z('base', !sk100.err && sk100.pol >= 60 && sk100.jup >= 60 && sk100.mw >= 3 && sk100.sunPx >= 20 && sk100.gib && sk100.gib.max >= 40 && sk100.cres && sk100.cres.dark >= 4 && sk100.points === 1, sk100);
  z('stars', !sk0.stars.err && sk0.stars.pol <= 2 && sk0.stars.dim <= 2 && sk0.stars.jup >= 60 && sk0.stars.points === 1, sk0.stars);
  z('planets', !sk0.planets.err && sk0.planets.jup <= 2 && sk0.planets.pol >= 60 && sk0.planets.points === 1, sk0.planets);
  z('mw', !sk0.mw.err && Math.abs(sk0.mw.mw) <= 1 && sk0.mw.uMwGain === 0 && sk0.mw.pol >= 60, sk0.mw);
  z('sun', !sk0.sun.err && sk0.sun.sunPx === 0 && sk0.sun.gib && sk0.sun.gib.max >= 40, sk0.sun);
  z('moon', !sk0.moon.err && sk0.moon.gib && sk0.moon.gib.max <= 1 && sk0.moon.sunPx >= 20 && sk0.moon.pol >= 60, sk0.moon);
  z('earthshine', !sk0.earthshine.err && sk0.earthshine.cres && sk0.earthshine.cres.dark <= 1 && sk0.earthshine.cres.max >= 40 && sk0.earthshine.gib.max >= 40, sk0.earthshine);
  z('stars+planets', !skNone.err && skNone.points === 0, skNone);
  const brief = o => o.err ? o.err : { pol: o.pol, dim: o.dim, jup: o.jup, mw: o.mw, uMwGain: o.uMwGain, sunPx: o.sunPx, gib: o.gib && o.gib.max, cres: o.cres && [o.cres.max, o.cres.dark], points: o.points };
  console.log('  .. sky sliders at 0: ' + JSON.stringify(Object.assign(Object.fromEntries(SKY_K.map(k => [k, brief(sk0[k])])), { 'stars+planets': brief(skNone) })));
  ok('each sky slider at 0 takes its own thing away and leaves the rest: Stars (Polaris adds nothing, Jupiter still there), Planets (Jupiter nothing, Polaris there), Milky Way (the band no brighter than off it, its gain 0), Sun (no sun disc), Moonlight (no moon disc), Earthshine (the crescent\'s dark part adds nothing, its lit part there); Stars and Planets both at 0 skip the POINTS draw',
    zeroBad.length === 0, zeroBad.length ? zeroBad : { pol: sk100.pol, jup: sk100.jup, mw: sk100.mw, sunPx: sk100.sunPx, gib: sk100.gib && sk100.gib.max, cres: sk100.cres && sk100.cres.dark });
  // row: each at 200 doubles its thing. Stars and planets draw after the tonemap, so their pixels double (within 10%, on a star and a
  // planet under 128 at 100%); the rest go through the tonemap or saturate, so there the value handed to the GPU is exactly 2x (within
  // 1e-6) and the pixels are brighter at 200% than at 100%, and at 100% than at 50%.
  const sk200 = {}, sk50 = {}; for (const k of SKY_K) { sk200[k] = await skyMeasure({ [k]: 200 }); if (!['stars', 'planets'].includes(k)) sk50[k] = await skyMeasure({ [k]: 50 }); }
  const x2 = (a, b) => { const A = [].concat(a), B = [].concat(b); return A.length === B.length && B.some(v => v > 0) && A.every((v, i) => Math.abs(v - 2 * B[i]) <= 1e-6 * Math.max(1e-3, Math.abs(2 * B[i]))); };
  const r2 = (a, b) => +(a / b).toFixed(3);
  const twoBad = [], two = {};
  const t = (k, c, v) => { two[k] = v; if (!c) twoBad.push({ k, v }); };
  t('stars', !sk200.stars.err && sk100.dim >= 20 && sk100.dim < 128 && Math.abs(r2(sk200.stars.dim, sk100.dim) - 2) <= 0.2 && Math.abs(sk200.stars.jupLow - sk100.jupLow) <= 2,
    { dim: [sk100.dim, sk200.stars.dim, r2(sk200.stars.dim, sk100.dim)], jupLow: [sk100.jupLow, sk200.stars.jupLow] });
  t('planets', !sk200.planets.err && sk100.jupLow >= 20 && sk100.jupLow < 128 && Math.abs(r2(sk200.planets.jupLow, sk100.jupLow) - 2) <= 0.2 && Math.abs(sk200.planets.dim - sk100.dim) <= 2,
    { jupLow: [sk100.jupLow, sk200.planets.jupLow, r2(sk200.planets.jupLow, sk100.jupLow)], dim: [sk100.dim, sk200.planets.dim] });
  t('mw', !sk200.mw.err && x2(sk200.mw.uMwGain, sk100.uMwGain) && sk200.mw.mw > sk100.mw && sk100.mw > sk50.mw.mw,
    { gpu: [sk50.mw.uMwGain, sk100.uMwGain, sk200.mw.uMwGain], px: [sk50.mw.mw, sk100.mw, sk200.mw.mw] });
  t('sun', !sk200.sun.err && x2(sk200.sun.uSunCol, sk100.uSunCol) && sk200.sun.land17 > sk100.land17 && sk100.land17 > sk50.sun.land17,
    { gpu: [sk100.uSunCol, sk200.sun.uSunCol], land17: [sk50.sun.land17, sk100.land17, sk200.sun.land17] });
  t('moon', !sk200.moon.err && x2(sk200.moon.uMoonK, sk100.uMoonK) && x2(sk200.moon.uMoonCol, sk100.uMoonCol) && sk200.moon.landFull > sk100.landFull && sk100.landFull > sk50.moon.landFull,
    { gpu: [sk100.uMoonK, sk200.moon.uMoonK, sk100.uMoonCol, sk200.moon.uMoonCol], landFull: [sk50.moon.landFull, sk100.landFull, sk200.moon.landFull] });
  t('earthshine', !sk200.earthshine.err && x2(sk200.earthshine.uMoonES, sk100.uMoonES) && sk200.earthshine.cres.dark > sk100.cres.dark && sk100.cres.dark > sk50.earthshine.cres.dark,
    { gpu: [sk100.uMoonES, sk200.earthshine.uMoonES], dark: [sk50.earthshine.cres.dark, sk100.cres.dark, sk200.earthshine.cres.dark] });
  console.log('  .. sky sliders at 200 (and 50): ' + JSON.stringify(two));
  ok('each sky slider at 200 doubles its thing: a star and a planet under 128 double in pixels within 10% (and the other does not move); the Milky Way\'s gain, the sun\'s colour, the moon\'s disc level and colour and the earthshine handed to the GPU are exactly 2x, with the pixels brighter at 200% than at 100% and at 100% than at 50%',
    twoBad.length === 0, twoBad.length ? twoBad : two);
  await page.evaluate(y => { const D = window.__DS; D.PLAYER.yaw = y; D.CAM.chase = null; }, yaw8b);

  // ---- 8c. the stars at the phone's numbers (DS-5, dssky step 2) ----
  // A second browser context at an iPhone 13 in landscape: 844x390 CSS px at deviceScaleFactor 3, so the page caps DPR at 2 and
  // renders the main pass at RSCALE = min(2 * 0.85, 1.75) = 1.7 at medium graphics. The suite's own context (scale 1, RSCALE
  // 0.85) never sees that. The helpers are this context's own (page.evaluate defined the others in the first page only): a
  // read-back, and a camera aimed so that a world direction lands EXACTLY on a chosen framebuffer point (Newton on the same
  // OpenGL-convention projection as __dsAimed), so the star's centre can be put at four sub-pixel phases, 0, 1/4, 1/2 and 3/4 of
  // a pixel along the diagonal (1/2 puts it on a pixel corner, the worst case). What a star adds is the brightest pixel of
  // STARS.on minus STARS.on false in a 10x10 window round it (8-bit luminance; the pass is added after the tonemap).
  // The stars: Polaris from SIMBAD through the suite's own precession and GMST (ownStar); for the magnitude-4 star, iota Leonis
  // (HIP 55642, V 4.00), its J2000 RA/Dec and magnitude are read from the kit's catalogue (SKY_DATA, data, not code) and turned
  // to alt/az by the same precess() and ownAltAz(). The patch: 200x100 CSS px (340x170 framebuffer px) centred on Polaris, the
  // local maxima of the difference at 40 or more. Measured 2026-11-02 (the table in .claude/driving-simulator.md DS-5): before,
  // Polaris 230 / 182 / 86 / 182 (min 86), iota Leo 100 / 78 / 37 / 78 (min 37), 3 stars in the patch; after (sigma floor in CSS
  // px, STAR_GAIN 4.0) Polaris min 207, iota Leo min 88, 9 in the patch, so the row asks for 7 (9 less 20%, floored).
  const JD22p = jdOf(MAY5, 22, -4);
  const ctxP = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const pageP = await ctxP.newPage();
  pageP.on('pageerror', e => errors.push('phone: ' + String(e)));
  await pageP.goto(PAGE);
  await pageP.waitForFunction(() => window.__DS && window.__DS.CHUNKS.size > 10, null, { timeout: 90000 });
  const iotaJ = await pageP.evaluate(() => { const S = SKY_DATA.stars, I = k => S.fields.indexOf(k), r = S.rows.find(r => r[I('hip')] === 55642); return r ? { ra: r[I('ra')], dec: r[I('dec')], mag: r[I('mag')] } : null; });
  const iotaW = iotaJ ? (q => enuToWorldOwn(ownAltAz(q.ra, q.dec, JD22p).v))(precess(iotaJ.ra, iotaJ.dec, JD22p)) : null;
  const phone = await pageP.evaluate(([MAY5, polW, iotaW]) => {
    const D = window.__DS; D.setPaused(true); D.SETTINGS.cycle = 0; D.SKY.hour = 22; D.setDate(MAY5);
    const c = document.getElementById('gl'), g = c.getContext('webgl2'), w = c.width, h = c.height, fov = 0.8, up = [0, 1, 0];
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
    const basis = f => { const sv = nrm(cr(f, up)); return { f, sv, u: cr(sv, f) }; };
    const proj = (B, d) => { const t = Math.tan(fov / 2); return { x: (dt(d, B.sv) / dt(d, B.f) / (t * w / h) * 0.5 + 0.5) * w - 0.5, y: (dt(d, B.u) / dt(d, B.f) / t * 0.5 + 0.5) * h - 0.5 }; };
    const px = f => { g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      renderScene([D.PLAYER.x, D.PLAYER.y + 30, D.PLAYER.z], f, up, fov, 0.2, w, h, { propDist: 560, shadows: false, hidePlayer: false }, []);
      const p = new Uint8Array(w * h * 4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, p); return (x, y) => { const i = (y * w + x) * 4; return p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722; }; };
    const aimFor = (d, X, Y) => { const B0 = basis(d); let a = 0, b = 0;
      const at = (a, b) => proj(basis(nrm([0, 1, 2].map(i => B0.f[i] + a * B0.sv[i] + b * B0.u[i]))), d);
      for (let k = 0; k < 8; k++) { const p = at(a, b), e = 1e-5, pa = at(a + e, b), pb = at(a, b + e);
        const j11 = (pa.x - p.x) / e, j21 = (pa.y - p.y) / e, j12 = (pb.x - p.x) / e, j22 = (pb.y - p.y) / e, det = j11 * j22 - j12 * j21, ex = X - p.x, ey = Y - p.y;
        a += (j22 * ex - j12 * ey) / det; b += (-j21 * ex + j11 * ey) / det; }
      return nrm([0, 1, 2].map(i => B0.f[i] + a * B0.sv[i] + b * B0.u[i])); };
    const X0 = Math.floor(w / 2), Y0 = Math.floor(h / 2);
    const pair = f => { D.STARS.on = true; const A = px(f); D.STARS.on = false; const B = px(f); D.STARS.on = true; return (x, y) => A(x, y) - B(x, y); };
    const phases = d => [0, 0.25, 0.5, 0.75].map(o => { const f = aimFor(d, X0 + o, Y0 + o), p = proj(basis(f), d), A = pair(f); let best = -1;
      for (let y = Y0 - 4; y <= Y0 + 5; y++) for (let x = X0 - 4; x <= X0 + 5; x++) best = Math.max(best, A(x, y));
      return { o, at: [+p.x.toFixed(2), +p.y.toFixed(2)], add: Math.round(best) }; });
    const pol = phases(polW), iota = iotaW ? phases(iotaW) : [];
    const A = pair(aimFor(polW, X0, Y0)), PW = Math.round(100 * RSCALE), PH = Math.round(50 * RSCALE); let n40 = 0;
    for (let y = Y0 - PH; y < Y0 + PH; y++) for (let x = X0 - PW; x < X0 + PW; x++) { const v = A(x, y); if (v < 40) continue; let mx = true;
      for (let dy = -1; dy <= 1 && mx; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && A(x + dx, y + dy) > v) { mx = false; break; }
      if (mx) n40++; }
    return { w, h, RSCALE, DPR, night: D.SKY.night, pol, iota, polMin: Math.min(...pol.map(q => q.add)), iotaMin: iota.length ? Math.min(...iota.map(q => q.add)) : -1, patch: { w: 2 * PW, h: 2 * PH, n40 } };
  }, [MAY5, polW, iotaW]);
  await ctxP.close();
  ok('at the phone\'s render scale (RSCALE 1.7) Polaris adds at least 200 and a magnitude-4 star (iota Leonis, HIP 55642) at least 60 at every sub-pixel phase',
    phone.RSCALE === 1.7 && phone.DPR === 2 && phone.night > 0.95 && !!iotaJ && Math.abs(iotaJ.mag - 4) <= 0.05 && phone.pol.length === 4 && phone.iota.length === 4
    && phone.polMin >= 200 && phone.iotaMin >= 60, { RSCALE: phone.RSCALE, DPR: phone.DPR, iotaMag: iotaJ && iotaJ.mag, pol: phone.pol, iota: phone.iota });
  ok('at the phone\'s render scale the 200x100 CSS px patch round Polaris holds at least 7 stars that add 40 or more',
    phone.RSCALE === 1.7 && phone.patch.w === 340 && phone.patch.h === 170 && phone.patch.n40 >= 7, phone.patch);

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
  // Restated at dssky step 5: the SOUND section is found by its heading, not as the fourth h3 (the SKY section is a new one before it).
  const menu = await page.evaluate(() => ({ chans: [...document.querySelectorAll('input.chan')].map(e => e.dataset.k), radioSel: !!document.getElementById('radio-sel'),
    stations: [...document.getElementById('station-sel').options].map(o => o.textContent), firstRow: [...document.querySelectorAll('#settings h3')].find(h => h.textContent === 'SOUND')?.nextElementSibling?.querySelector('select')?.id,
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
