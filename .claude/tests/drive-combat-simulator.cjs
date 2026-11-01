/**
 * Combat Simulator drive suite.
 *
 * Part 1 lifts the page's DOM-free ENGINE block into node and proves the CD's
 * rules as stated in the brief: the five-cut chain that cycles, a parry inside
 * its window staggers the attacker, a staggered fighter cannot parry or dodge
 * and takes +10%, a dodge's invincible frames carry you through a cut, the
 * energy sources (+1 a slipped cut, a parry, the 3rd and 5th cut of an unbroken
 * combo), the power attack at 10 / two in a row at 20 / capped at 20, and that
 * a power attack can be dodged but never parried. It also measures the
 * ladder: a button-masher wins the first duel and loses the last; a player who
 * parries on cue can win the last.
 *
 * Part 2 drives the page in Chromium (SwiftShader WebGL2): boot, the intro,
 * real multi-touch over CDP (stick and a button at once), the controls'
 * layout at seven sizes, the power button's ring closing at 10, the settings
 * pausing the duel, the victory and defeat flows and the saved ladder.
 *
 *   .claude/scripts/gates.sh games/combat-simulator/index.html
 *
 * Exits 0/1 and prints "COMBAT SIMULATOR DRIVE: N passed, M failed" last.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = process.env.CS_PAGE || path.join(ROOT, 'games/combat-simulator/index.html');   // CS_PAGE: a copy, for negative tests
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } }

// ---------------------------------------------------------------- part 1: the engine in node
const src = fs.readFileSync(FILE, 'utf8');
const a = src.indexOf('/*ENGINE:BEGIN*/'), b = src.indexOf('/*ENGINE:END*/');
const ENG = src.slice(a, b);
const E = new Function(ENG + ';return { RULES, LADDER, rankParams, newFight, stepFight, aiIntent, phasesOf, specOf, canAct, NO_INPUT };')();
const { RULES } = E;
const DT = 1 / 120;
const IN = o => Object.assign({ mx: 0, mz: 0, atk: false, dodge: false, parry: false, power: false }, o || {});
// a duel with the opponent standing in reach, no mind of its own
function dummy(rank) { const F = E.newFight(rank || 1, 7); F.p.z = -0.6; F.e.z = 0.6; return F; }
function run(F, secs, pIn, eIn) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { E.stepFight(F, DT, pIn ? pIn(F, i) : IN(), eIn ? eIn(F, i) : IN()); } }
function evs(F, type, who) { return F.events.filter(e => e.type === type && (who === undefined || e.who === who)); }

console.log('-- engine: the brief');
ok('engine block is DOM-free', !/document\.|window\.|getContext|localStorage/.test(ENG));
{
  // tap attack every time the previous cut is half wound up: hits 1..5 then 1 again
  const F = dummy(1); F.e.hp = F.e.hpMax = 1e6;
  const seq = [];
  run(F, 3.2, F => { if (F.p.st === 'free' || (F.p.st === 'atk' && !F.p.queued)) return IN({ atk: true }); return IN(); });
  for (const e of evs(F, 'swing', 'p')) seq.push(e.idx);
  ok('repeated taps chain five cuts, then the chain starts over', seq.slice(0, 7).join('') === '0123401', seq);
  ok('a full unbroken chain pays exactly +2 energy (cuts 3 and 5)', evs(F, 'energy', 'p').filter(e => /combo/.test(e.why)).slice(0, 2).map(e => e.why).join() === 'combo3,combo5', evs(F, 'energy', 'p').map(e => e.why));
}
{
  // stop tapping: once the grace runs out, the next tap starts at cut 1
  const F = dummy(1); F.e.hp = 1e6;
  run(F, 0.05, () => IN({ atk: true }));
  run(F, 1.2);
  F.events.length = 0;
  run(F, 0.05, () => IN({ atk: true }));
  ok('a pause ends the chain: the next tap is cut 1 again', evs(F, 'swing', 'p')[0] && evs(F, 'swing', 'p')[0].idx === 0, evs(F, 'swing', 'p'));
}
{
  // a cut that whiffs breaks the run of landed cuts, so no energy at "3"
  const F = dummy(1); F.e.hp = 1e6;
  let k = 0;
  run(F, 2.0, (F, i) => {
    if (F.p.st === 'atk' && F.p.chain === 1 && k === 0) { k = 1; F.e.z = 6; }      // step the dummy out of reach for cut 2
    if (F.p.st === 'atk' && F.p.chain === 2 && k === 1) { k = 2; F.e.z = 0.6; }
    return (F.p.st === 'free' || (F.p.st === 'atk' && !F.p.queued)) ? IN({ atk: true }) : IN();
  });
  const pays = evs(F, 'energy', 'p').filter(e => /combo/.test(e.why));
  ok('a whiffed cut breaks the combo count: cut 3 pays nothing', evs(F, 'whiff', 'p').length >= 1 && (pays.length === 0 || pays[0].why === 'combo3' && evs(F, 'swing', 'p').length > 5), { pays, whiffs: evs(F, 'whiff', 'p').length });
}
// the opponent throws one cut at the player; when should the player answer?
function incoming(rank, answer, at) {
  const F = E.newFight(rank, 3); F.p.z = -0.6; F.e.z = 0.6;
  let sent = false;
  run(F, 1.2, (F, i) => { if (!sent && F.e.st === 'atk' && at(F)) { sent = true; return IN({ [answer]: true, mx: 1 }); } return IN(); }, (F, i) => IN({ atk: i === 0 }));
  return F;
}
const untilActive = F => E.phasesOf(F.e, E.specOf(F.e)).w - F.e.t;
console.log('-- engine: parry and stagger');
{
  const F = incoming(1, 'parry', F => untilActive(F) <= 0.08);
  ok('a parry inside its window turns the cut aside: no damage, attacker staggered', F.p.hp === 100 && evs(F, 'parry', 'p').length === 1 && evs(F, 'parry', 'p')[0].by === 'e', { hp: F.p.hp, st: F.e.st });
  ok('a parry pays +1 energy', F.p.energy === 1, F.p.energy);
  const G = incoming(1, 'parry', F => untilActive(F) <= 0.45 && untilActive(F) > 0.4);
  ok('a parry pressed too early misses its window and the cut lands', G.p.hp < 100 && evs(G, 'parry').length === 0, G.p.hp);
}
{
  // a staggered fighter takes +10% and cannot parry or dodge
  const F = dummy(1); F.e.hp = F.e.hpMax = 1e6;
  run(F, 0.6, () => IN({ atk: false }));
  F.events.length = 0;
  F.e.st = 'free';
  run(F, 0.3, (F, i) => IN({ atk: i === 0 }));
  const plain = evs(F, 'hit', 'p')[0];
  const G = dummy(1); G.e.hp = G.e.hpMax = 1e6;
  G.e.st = 'stagger'; G.e.t = 0;
  run(G, 0.3, (F, i) => IN({ atk: i === 0 }), () => IN({ parry: true, dodge: true }));
  const crit = evs(G, 'hit', 'p')[0];
  ok('a cut on a staggered fighter does exactly 10% more', plain && crit && Math.abs(crit.dmg / plain.dmg - 1.10) < 1e-9 && crit.crit, { plain: plain && plain.dmg, crit: crit && crit.dmg });
  ok('a staggered fighter pressing parry and dodge does neither', G.e.st === 'stagger' && evs(G, 'parry').length === 0 && evs(G, 'dodgeStart', 'e').length === 0, G.e.st);
  // the stagger lasts long enough for the whole five-cut punish from close range
  const H = dummy(1); H.e.hp = H.e.hpMax = 1e6; H.e.st = 'stagger'; H.e.t = 0;
  run(H, RULES.stagger, F => (F.p.st === 'free' || (F.p.st === 'atk' && !F.p.queued)) ? IN({ atk: true }) : IN());
  ok('a full five-cut chain fits inside one stagger', evs(H, 'hit', 'p').filter(e => e.crit).length === 5, evs(H, 'hit', 'p').map(e => e.crit));
}
console.log('-- engine: dodge');
{
  const F = incoming(1, 'dodge', F => untilActive(F) <= 0.06);
  ok('a dodge timed into the cut: invincible, no damage', F.p.hp === 100 && evs(F, 'dodged', 'p').length === 1, { hp: F.p.hp });
  ok('a dodge that slips a cut pays +1 energy', F.p.energy === 1, F.p.energy);
  // the invincible frames are the middle of the dodge, not all of it
  ok('i-frames sit inside the dodge with vulnerable frames after', RULES.dodge.i0 > 0 && RULES.dodge.i1 < RULES.dodge.total, RULES.dodge);
  const G = E.newFight(1, 3); G.p.z = -0.6; G.e.z = 0.6;
  // dodge straight into the opponent too early: the i-frames are over when the blade arrives
  let sent = false;
  run(G, 1.2, (F) => { if (!sent && F.e.st === 'atk' && untilActive(F) <= 0.42 && untilActive(F) > 0.38) { sent = true; return IN({ dodge: true, mz: 1 }); } return IN(); }, (F, i) => IN({ atk: i === 0 }));
  ok('a dodge too early is no protection', G.p.hp < 100 && evs(G, 'dodged').length === 0, G.p.hp);
}
console.log('-- engine: energy and the power attack');
{
  const F = dummy(1); F.p.energy = 9;
  run(F, 0.1, (F, i) => IN({ power: i === 0 }));
  ok('no power attack at 9 energy', F.p.st !== 'power' && F.p.energy === 9, { st: F.p.st, e: F.p.energy });
  const G = dummy(1); G.e.hp = 1e6; G.p.energy = 10;
  run(G, 0.05, (F, i) => IN({ power: i === 0 }));
  ok('at 10 the power attack goes and costs 10', G.p.st === 'power' && G.p.energy === 0, { st: G.p.st, e: G.p.energy });
  const H = dummy(1); H.e.hp = H.e.hpMax = 1e6; H.p.energy = 20;
  run(H, 3, F => { if (F.p.st === 'power' || F.p.st === 'free') return IN({ power: true }); return IN(); });
  const starts = evs(H, 'powerStart', 'p');
  ok('banked 20 throws two power attacks back to back', starts.length === 2 && H.p.energy === 0, { starts: starts.length, e: H.p.energy });
  const gap = starts.length === 2 ? H.events.indexOf(starts[1]) : -1;
  ok('the second follows the first with no free frames between', starts.length === 2 && H.events.slice(H.events.indexOf(starts[0]), gap).every(e => e.type !== 'swing'), starts.length);
  // a parry at a full meter keeps it at 20
  const K = incoming(1, 'parry', F => { F.p.energy = 20; return untilActive(F) <= 0.08; });
  ok('energy is capped at 20', K.p.energy === 20 && evs(K, 'parry', 'p').length === 1 && RULES.energyMax === 20, K.p.energy);
}
{
  // the opponent's power attack against a parry and against a dodge
  const mk = (answer, at) => {
    const F = E.newFight(1, 5); F.p.z = -0.6; F.e.z = 0.6; F.e.energy = 10;
    let sent = false;
    run(F, 2.0, F => { if (!sent && F.e.st === 'power' && at(F)) { sent = true; return IN({ [answer]: true, mx: 1 }); } return IN(); }, (F, i) => IN({ power: i === 0 }));
    return F;
  };
  const P = mk('parry', F => untilActive(F) <= 0.08);
  ok('a power attack cannot be parried: the parrier takes it, the attacker is not staggered', P.p.hp < 100 && evs(P, 'parry').length === 0 && evs(P, 'hit', 'e')[0].power, { hp: P.p.hp });
  const D = mk('dodge', F => untilActive(F) <= 0.06);
  ok('a power attack can be dodged', D.p.hp === 100 && evs(D, 'dodged', 'p').length === 1 && D.p.energy === 1, { hp: D.p.hp, e: D.p.energy });
  // hyper armour: a cut into a winding power attack hurts but does not interrupt it
  const A = E.newFight(1, 5); A.p.z = -0.6; A.e.z = 0.6; A.e.energy = 10;
  run(A, 1.5, (F, i) => IN({ atk: i === 2 }), (F, i) => IN({ power: i === 0 }));
  ok('a fighter winding a power attack takes the cut but does not flinch', evs(A, 'hit', 'p').length >= 1 && evs(A, 'hit', 'e').some(e => e.power), { p: evs(A, 'hit', 'p').length, e: evs(A, 'hit', 'e').length });
}
{
  // the opponent fills the same meter by the same rules and spends it
  const F = E.newFight(10, 11); F.e.energy = 10; F.p.z = -0.5; F.e.z = 0.5;
  run(F, 4, () => IN(), F => E.aiIntent(F, DT));
  ok('the opponent throws a power attack once it has 10 energy', evs(F, 'powerStart', 'e').length >= 1, F.e.energy);
}
{
  // a knockout ends the duel and freezes the loser
  const F = dummy(1); F.e.hp = 1;
  run(F, 1.5, (F, i) => IN({ atk: i === 0, power: i > 30 }));
  ok('a knockout ends the duel with a winner and the loser down', F.over && F.over.winner === 'p' && F.e.st === 'down', F.over);
}
console.log('-- engine: the ladder');
function masher(F) { const p = F.p, e = F.e, dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); return IN({ mx: d > 1.6 ? dx / d : 0, mz: d > 1.6 ? dz / d : 0, atk: true }); }
function counter(F, mem) {
  const p = F.p, e = F.e, dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1, inp = IN();
  if (e.st === 'atk' || e.st === 'power') {
    const until = E.phasesOf(e, E.specOf(e)).w - e.t;
    if (until > 0 && until <= 0.13 && mem.ans !== e.atkId) { mem.ans = e.atkId; if (e.st === 'power') { inp.dodge = true; inp.mx = -dz / d; inp.mz = dx / d; } else inp.parry = true; }
    return inp;
  }
  if (e.st === 'stagger') { if (d > 1.8) { inp.mx = dx / d; inp.mz = dz / d; } if (RULES.stagger - e.t > 0.2) inp.atk = true; return inp; }
  if (p.energy >= 10 && d < 2.4 && e.st !== 'dodge') { inp.power = true; return inp; }
  if (Math.abs(d - 2.4) > 0.3) { const k = d > 2.4 ? 1 : -1; inp.mx = dx / d * k; inp.mz = dz / d * k; }
  return inp;
}
function duel(rank, bot, seed) {
  const F = E.newFight(rank, seed), mem = {};
  for (let i = 0; i < 120 / DT && !F.over; i++) { E.stepFight(F, DT, bot(F, mem), E.aiIntent(F, DT)); F.events.length = 0; }
  return F;
}
function rate(rank, bot, N) { let w = 0; for (let s = 1; s <= N; s++) if ((duel(rank, bot, s * 7919 + rank).over || {}).winner === 'p') w++; return w / N; }
{
  const N = 16;
  const m1 = rate(1, masher, N), m10 = rate(10, masher, N), c10 = rate(10, counter, N), c5 = rate(5, counter, N);
  console.log('     masher rank 1 ' + m1 + ', rank 10 ' + m10 + '; counter rank 5 ' + c5 + ', rank 10 ' + c10);
  ok('mashing attack wins the first duel', m1 >= 0.9, m1);
  ok('mashing attack loses the last duel', m10 <= 0.1, m10);
  ok('parrying on cue and punishing the stagger can win the last duel', c10 >= 0.6, c10);
  ok('...and wins the middle of the ladder outright', c5 >= 0.95, c5);
  const P1 = E.rankParams(1), P10 = E.rankParams(10);
  ok('every rank is harder than the one before (faster, readier, tougher)', [...Array(9)].every((_, i) => { const a = E.rankParams(i + 1), b = E.rankParams(i + 2);
    return b.react < a.react && b.parryP > a.parryP && b.windMul < a.windMul && b.hp > a.hp && b.dmgMul > a.dmgMul; }), { P1, P10 });
  ok('ten named opponents', E.LADDER.length === 10 && new Set(E.LADDER.map(l => l.name)).size === 10);
}

// ---------------------------------------------------------------- part 2: the page
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch (e) { console.log('FAIL  playwright-core not resolvable: page checks skipped'); fail++; return finish(); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + FILE);
  await page.waitForFunction(() => window.__CS && window.__CS.F, null, { timeout: 30000 });
  console.log('-- page: boot');
  const boot = await page.evaluate(() => ({ gl: !!document.getElementById('gl').getContext('webgl2'), st: __CS.APP.state, rank: __CS.F.rank,
    badge: document.getElementById('build-badge').textContent, back: document.getElementById('back-btn').getAttribute('href') }));
  ok('boots with WebGL2 into the intro of rank 1', boot.gl && boot.st === 'intro' && boot.rank === 1, boot);
  ok('build badge carries a real timestamp', /^build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(boot.badge), boot.badge);
  ok('back button returns to the hub', boot.back === '../index.html', boot.back);
  // the intro is stepped, not waited for: a loaded machine draws SwiftShader frames slowly
  const intro = await page.evaluate(() => { __CS.setPaused(true); __CS.startDuel(1, 1); __CS.tick(1 / 60, 110); const a = __CS.APP.state; __CS.tick(1 / 60, 20); return [a, __CS.APP.state]; });
  ok('the intro holds two seconds, then hands over to the fight', intro[0] === 'intro' && intro[1] === 'fight', intro);

  console.log('-- page: touch');
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2] })) });
  const L = await page.evaluate(() => JSON.parse(JSON.stringify(__CS.LAY)));
  await page.evaluate(() => { const F = __CS.F; F.e.x = 0; F.e.z = 3; F.p.x = 0; F.p.z = -3; });
  // thumb down on the stick zone and push up, while the other thumb taps attack
  await touch('touchStart', [[L.stick.x, L.stick.y, 1]]);
  await touch('touchMove', [[L.stick.x, L.stick.y - L.stick.r, 1]]);
  const z0 = await page.evaluate(() => __CS.F.p.z);
  await page.evaluate(() => __CS.tick(1 / 60, 30));
  const moved = await page.evaluate(() => ({ z: __CS.F.p.z, sy: __CS.INPUT.sy }));
  ok('pushing the stick up walks you at your opponent', moved.sy > 0.9 && moved.z > z0 + 0.5, { z0, moved });
  await touch('touchStart', [[L.stick.x, L.stick.y - L.stick.r, 1], [L.btn.atk.x, L.btn.atk.y, 2]]);
  await page.evaluate(() => __CS.tick(1 / 60, 1));
  const st = await page.evaluate(() => ({ st: __CS.F.p.st, stick: __CS.INPUT.sy }));
  ok('a second thumb on attack cuts while the stick is held', st.st === 'atk' && st.stick > 0.9, st);
  await touch('touchEnd', [[L.btn.atk.x, L.btn.atk.y, 2]]);
  await touch('touchEnd', [[L.stick.x, L.stick.y, 1]]);
  await page.evaluate(() => { __CS.tick(1 / 60, 60); const F = __CS.F; F.ai.cd = 1e9; F.e.x = 0; F.e.z = 6; F.p.x = 0; F.p.z = -2; F.p.st = 'free'; });
  for (const k of ['dodge', 'parry']) {
    await touch('touchStart', [[L.btn[k].x, L.btn[k].y, 3]]); await touch('touchEnd', [[L.btn[k].x, L.btn[k].y, 3]]);
    await page.evaluate(() => __CS.tick(1 / 60, 1));
    const s = await page.evaluate(() => __CS.F.p.st);
    ok('the ' + k + ' button ' + k + 's', s === k, s);
    await page.evaluate(() => __CS.tick(1 / 60, 60));
  }
  await page.evaluate(() => { __CS.F.p.energy = 10; });
  await touch('touchStart', [[L.btn.power.x, L.btn.power.y, 4]]); await touch('touchEnd', [[L.btn.power.x, L.btn.power.y, 4]]);
  await page.evaluate(() => __CS.tick(1 / 60, 1));
  ok('the power button throws the power attack', await page.evaluate(() => __CS.F.p.st === 'power'));
  await page.evaluate(() => __CS.tick(1 / 60, 120));

  console.log('-- page: the power button ring');
  // the HUD is drawn synchronously through the hook, so no read can catch a stale frame
  const ring = async (e, t) => page.evaluate(([e, t]) => {
    __CS.F.p.energy = e; __CS.F.p.st = 'free'; if (t !== undefined) __CS.APP.time = t; __CS.hud();
    const c = document.getElementById('hud'), x = c.getContext('2d'), b = __CS.LAY.btn.power, k = c.width / innerWidth;
    const r = Math.ceil(b.r * 1.3 * k), d = x.getImageData(Math.round(b.x * k) - r, Math.round(b.y * k) - r, r * 2, r * 2).data;
    let gold = 0, cyan = 0, gaps = 0;
    for (let yy = 0; yy < r * 2; yy++) for (let xx = 0; xx < r * 2; xx++) {
      if (Math.hypot(xx - r, yy - r) > r) continue;            // the circle round this button only
      const i = (yy * r * 2 + xx) * 4;
      if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 90 && d[i + 3] > 120) gold++;
      if (d[i] < 120 && d[i + 1] > 180 && d[i + 2] > 220 && d[i + 3] > 120) cyan++;
    }
    // the ten gaps between the inner ring's segments: dark while it is open, gold once it closes
    for (let g = 0; g < 10; g++) { const an = -Math.PI / 2 + g / 10 * Math.PI * 2, px = Math.round(r + Math.cos(an) * b.r * 1.1 * k), py = Math.round(r + Math.sin(an) * b.r * 1.1 * k), i = (py * r * 2 + px) * 4;
      if (d[i] > 180 && d[i + 1] > 120 && d[i + 2] < 110) gaps++; }
    return { gold, cyan, gaps };
  }, [e, t]);
  const r0 = await ring(0), r5 = await ring(5), r9 = await ring(9), r10 = await ring(10), r20 = await ring(20);
  ok('the ring fills with energy', r0.gold < r5.gold && r5.gold < r9.gold, [r0, r5, r9]);
  ok('at 10 the ring closes (no gaps left) and the button lights', r9.gaps === 0 && r10.gaps === 10 && r10.gold > r9.gold, [r9, r10]);
  ok('energy past 10 fills a second ring', r20.cyan > r10.cyan + 30, [r10, r20]);
  const fl = [];
  for (let i = 0; i < 8; i++) fl.push((await ring(10, 100 + i * 0.09)).gold);
  ok('a ready power attack flashes', Math.max(...fl) - Math.min(...fl) > 20, fl);
  await page.evaluate(() => { __CS.F.p.energy = 0; });

  console.log('-- page: layout');
  const sizes = [[390, 844], [844, 390], [375, 667], [667, 375], [360, 640], [1024, 768], [1280, 720]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const L = __CS.LAY, B = Object.entries(L.btn), out = [];
      for (const [k, b] of B) { const R = k === 'power' ? b.r * 1.3 : b.r; if (b.x - R < 0 || b.x + R > L.W || b.y - R < 0 || b.y + R > L.H) out.push('off:' + k); }
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const [ka, A] = B[i], [kb, C] = B[j], ra = ka === 'power' ? A.r * 1.3 : A.r, rb = kb === 'power' ? C.r * 1.3 : C.r;
        if (Math.hypot(A.x - C.x, A.y - C.y) < ra + rb) out.push('overlap:' + ka + '/' + kb);
      }
      const s = L.stick;
      for (const [k, b] of B) if (Math.hypot(b.x - s.x, b.y - s.y) < b.r * 1.3 + s.r + 8) out.push('stick:' + k);
      if (s.x - s.r < 0 || s.y + s.r > L.H) out.push('stick-off');
      const set = document.getElementById('set-btn').getBoundingClientRect();
      if (L.barTop - 17 < set.bottom + 4) out.push('bars-under-chrome');       // the label's cap height above the bar
      for (const [k, b] of B) if (b.y - b.r * 1.3 < L.barTop + 40) out.push('under-bars:' + k);
      return out;
    });
    ok('controls fit, clear of each other, the stick and the bars at ' + w + 'x' + h, r.length === 0, r);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);

  console.log('-- page: settings pause the duel');
  await page.evaluate(() => __CS.setPaused(false));
  await page.click('#set-btn');
  const t1 = await page.evaluate(() => [__CS.F.t, __CS.APP.frames]);
  await page.waitForFunction(f => __CS.APP.frames >= f + 6, t1[1], { timeout: 30000 });   // frames, not wall time
  const t2 = await page.evaluate(() => ({ t: __CS.F.t, paused: __CS.APP.paused, open: document.getElementById('settings').classList.contains('open') }));
  ok('opening the settings pauses the duel', t2.open && t2.paused && t2.t === t1[0], { t1, t2 });
  await page.keyboard.press('Escape');
  const f3 = await page.evaluate(() => __CS.APP.frames);
  await page.waitForFunction(f => __CS.APP.frames >= f + 6, f3, { timeout: 30000 });
  const t3 = await page.evaluate(() => ({ t: __CS.F.t, paused: __CS.APP.paused }));
  ok('Esc closes them and the duel runs on', !t3.paused && t3.t > t1[0], t3);
  await page.evaluate(() => __CS.setPaused(true));

  console.log('-- page: victory, defeat and the ladder');
  await page.evaluate(() => { const F = __CS.F; F.e.hp = 1; F.p.x = 0; F.p.z = -0.6; F.e.x = 0; F.e.z = 0.6; F.e.st = 'stagger'; F.e.t = 0; __CS.press('atk'); __CS.tick(1 / 60, 200); });
  const v = await page.evaluate(() => ({ open: document.getElementById('result').classList.contains('open'), title: document.getElementById('res-title').textContent,
    btn: document.getElementById('res-main').textContent, rank: __CS.SAVE.rank, stored: JSON.parse(localStorage.getItem('combatSimulator.ladder.v1') || '{}').rank }));
  ok('a knockout shows VICTORY and offers the next duel', v.open && v.title === 'VICTORY' && v.btn === 'NEXT DUEL', v);
  ok('the ladder moves up a rank and is saved', v.rank === 2 && v.stored === 2, v);
  await page.click('#res-main');
  const n2 = await page.evaluate(() => ({ rank: __CS.F.rank, st: __CS.APP.state, open: document.getElementById('result').classList.contains('open'), night: __CS.SKY.night }));
  ok('NEXT DUEL starts rank 2', n2.rank === 2 && n2.st === 'intro' && !n2.open, n2);
  await page.evaluate(() => { __CS.tick(1 / 60, 130); const F = __CS.F; F.p.hp = 1; F.p.x = 0; F.p.z = -0.6; F.e.x = 0; F.e.z = 0.6; F.p.st = 'stagger'; F.p.t = 0; F.e.st = 'free'; F.e.energy = 10; });
  await page.evaluate(() => { for (let i = 0; i < 300 && !__CS.F.over; i++) { __CS.F.e.energy = 10; __CS.tick(1 / 60, 1); } __CS.tick(1 / 60, 160); });
  const d = await page.evaluate(() => ({ open: document.getElementById('result').classList.contains('open'), title: document.getElementById('res-title').textContent, btn: document.getElementById('res-main').textContent, rank: __CS.SAVE.rank }));
  ok('losing shows DEFEAT and offers a retry of the same rank', d.open && d.title === 'DEFEAT' && d.btn === 'RETRY' && d.rank === 2, d);
  await page.click('#res-main');
  ok('RETRY fights rank 2 again', await page.evaluate(() => __CS.F.rank === 2));
  const sky = await page.evaluate(() => { const out = []; for (const r of [1, 5, 9, 10]) { __CS.setLighting(r); out.push([r, +__CS.SKY.day.toFixed(2), +__CS.SKY.night.toFixed(2), +__CS.SKY.lamp.toFixed(2)]); } __CS.setLighting(__CS.F.rank); return out; });
  ok('the ladder runs from daylight to a lantern-lit night', sky[0][1] === 1 && sky[0][3] === 0 && sky[3][2] > 0.5 && sky[3][3] > 0.5, sky);

  console.log('-- page: performance stats');
  const fps = async p => page.evaluate(p => { __CS.SETTINGS.perf = p; __CS.PERF.out.fps = 60; __CS.hud(); const c = document.getElementById('hud'), d = c.getContext('2d').getImageData(0, 0, c.width, 60).data; let g = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] > 200 && d[i + 2] < 40) g++; return g; }, p);
  const f1 = await fps(1), f0 = await fps(0);
  ok('the FPS counter is drawn in pure green when on, and not when off', f1 > 40 && f0 === 0, { f1, f0 });
  await page.evaluate(() => { __CS.SETTINGS.perf = 1; });
  ok('no page or console errors', errors.length === 0, errors);
  await browser.close();
  finish();
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); fail++; finish(); });
function finish() { console.log('COMBAT SIMULATOR DRIVE: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }
