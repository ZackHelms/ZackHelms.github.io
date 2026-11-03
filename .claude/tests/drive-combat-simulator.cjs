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
 * pausing the duel, the victory and defeat flows and the saved ladder, and the
 * graphics styles (the select, saving and validating the pick, a skin is paint
 * with real frames drawn between the ticks, toon's bands, toon's ink round the
 * fighters and the courtyard and none in realistic, every element drawn in every
 * style with no GL error).
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
const E = new Function(ENG + ';return { RULES, ATTACKS, LADDER, rankParams, newFight, stepFight, startHit, aiIntent, phasesOf, specOf, canAct, NO_INPUT };')();
const { RULES } = E;
const DT = 1 / 120;
const IN = o => Object.assign({ mx: 0, mz: 0, atk: false, dodge: false, parry: false, power: false }, o || {});
// a duel with the opponent standing in reach, no mind of its own
function dummy(rank) { const F = E.newFight(rank || 1, 7); F.p.z = -0.6; F.e.z = 0.6; return F; }
function run(F, secs, pIn, eIn) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { E.stepFight(F, DT, pIn ? pIn(F, i) : IN(), eIn ? eIn(F, i) : IN()); } }
function evs(F, type, who) { return F.events.filter(e => e.type === type && (who === undefined || e.who === who)); }

console.log('-- engine: the brief');
ok('engine block is DOM-free', !/document\.|window\.|getContext|localStorage/.test(ENG));
ok('the engine never sees a graphics style', !/style/i.test(ENG));
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
// a scripted chain thrower: taps attack whenever it is free or its cut is not yet queued
const chainTap = f => IN({ atk: f.st === 'free' || (f.st === 'atk' && !f.queued) });
// step and stamp every event with the time it happened, so rows can ask what came after what
function stepT(F, pIn, eIn) { const n0 = F.events.length; E.stepFight(F, DT, pIn, eIn); for (let j = n0; j < F.events.length; j++) F.events[j].t = F.t; }
// `att` ('e' or 'p') chains cuts at the other, who presses parry once, when `press(F, tHit)` says,
// tHit being the time of the first hit on the defender; nobody's mind is on
function chainAt(rank, att, press, secs) {
  const F = E.newFight(rank, 3); F.p.z = -0.6; F.e.z = 0.6; F.p.hp = F.p.hpMax = F.e.hp = F.e.hpMax = 1e6;
  const def = att === 'e' ? 'p' : 'e', R = { F, def, tHit: null, pressedAt: null, stAtPress: null };
  const defIn = F => { if (R.tHit !== null && R.pressedAt === null && press(F, R.tHit)) { R.pressedAt = F.t + DT; R.stAtPress = F[def].st; return IN({ parry: true }); } return IN(); };
  for (let i = 0; i < Math.round((secs || 2.0) / DT); i++) {
    stepT(F, att === 'p' ? chainTap(F.p) : defIn(F), att === 'e' ? chainTap(F.e) : defIn(F));
    if (R.tHit === null) { const h = F.events.find(e => e.type === 'hit' && e.on === def); if (h) R.tHit = h.t; }
  }
  return R;
}
// every attack row in the table, whatever kinds it holds
const attackRows = () => Object.keys(E.ATTACKS).flatMap(k => [].concat(E.ATTACKS[k]));
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
console.log('-- engine: a parry only counts before the blade lands');
{
  // the CD's case: hit by a chained cut, parry pressed while still reeling, at every point of the flinch
  const bad = [], seen = [];
  for (const rank of [1, 5, 10]) for (let k = 1; k <= 7; k++) {
    const off = 0.03 * k, R = chainAt(rank, 'e', (F, tHit) => F.t - tHit >= off - 1e-9);
    const later = R.F.events.filter(e => e.t >= R.pressedAt && e.t <= R.pressedAt + 1.0 && e.who === 'p' && (e.type === 'parryStart' || e.type === 'parry'));
    seen.push(R.stAtPress);
    if (R.pressedAt === null || R.stAtPress !== 'flinch' || later.length) bad.push({ rank, off, st: R.stAtPress, later: later.map(e => e.type + '@' + (e.t - R.pressedAt).toFixed(3)) });
  }
  ok('a parry pressed while reeling from a hit does nothing: no parry starts and no cut is turned in the next 1.0 s (ranks 1, 5, 10; pressed 0.03-0.21 s after the hit)', bad.length === 0 && seen.length === 21, bad);
}
{
  // ...but one pressed once the flinch is over still meets the next cut of the chain, before it lands
  const bad = [];
  for (const rank of [1, 5, 10]) {
    const R = chainAt(rank, 'e', F => F.p.st === 'free');
    const first = R.F.events.find(e => e.type === 'hit' && e.on === 'p');
    const par = R.F.events.find(e => e.type === 'parry' && e.who === 'p');
    const between = R.F.events.filter(e => e.type === 'hit' && e.on === 'p' && e.t > R.tHit && par && e.t <= par.t);
    if (!first || !par || par.t - R.pressedAt > 0.5 || par.atk === first.atk || between.length) bad.push({ rank, par: par && (par.t - R.pressedAt), between: between.length });
  }
  ok('a parry pressed on the first free tick after the flinch turns the next chained cut aside (ranks 1, 5, 10)', bad.length === 0, bad);
}
{
  // a parry held in the buffer from before a hit is lost to it: the player presses parry during its own
  // wind-up, and the opponent's cut, already swinging, lands first
  const one = () => {
    const F = E.newFight(1, 3); F.p.z = -0.6; F.e.z = 0.6;
    let tHit = null, bufAtHit;
    for (let i = 0; i < Math.round(1.6 / DT); i++) {
      stepT(F, IN({ atk: i === 24, parry: i === 30 }), IN({ atk: i === 0 }));
      if (tHit === null) { const h = F.events.find(e => e.type === 'hit' && e.on === 'p'); if (h) { tHit = h.t; bufAtHit = F.p.buf; } }
    }
    const sw = F.events.find(e => e.type === 'swing' && e.who === 'p'), hit = F.events.find(e => e.type === 'hit' && e.on === 'p');
    return { tHit, bufAtHit, inWind: !!(sw && hit && sw.t < 31 * DT && hit.t > 31 * DT && !F.events.some(e => e.type === 'hit' && e.who === 'p' && e.t < hit.t)),
      starts: F.events.filter(e => e.type === 'parryStart' && e.who === 'p').length };
  };
  const a = one();
  const keep = E.RULES.buffer; let b;
  try { E.RULES.buffer = 0.6; b = one(); } finally { E.RULES.buffer = keep; }     // and with a buffer outlasting the flinch
  ok('a parry held in the buffer is cleared by the hit that flinches its fighter: none starts after the flinch, even when the buffer outlasts it', a.tHit !== null && a.inWind && a.bufAtHit === null && a.starts === 0 && b.tHit !== null && b.inWind && b.bufAtHit === null && b.starts === 0, { a, b });
}
{
  // the same rule for the opponent: the player chains, the opponent's inputs are scripted (no mind).
  // Kept off the one-tick boundary: the opponent steps second, so 0.21 s is already its last reeling tick
  const bad = [];
  for (const rank of [1, 5, 10]) {
    for (let k = 1; k <= 6; k++) {
      const off = 0.03 * k, R = chainAt(rank, 'p', (F, tHit) => F.t - tHit >= off - 1e-9);
      const later = R.F.events.filter(e => e.t >= R.pressedAt && e.t <= R.pressedAt + 1.0 && e.who === 'e' && (e.type === 'parryStart' || e.type === 'parry'));
      if (R.pressedAt === null || R.stAtPress !== 'flinch' || later.length) bad.push({ rank, off, st: R.stAtPress, later: later.map(e => e.type) });
    }
    const R = chainAt(rank, 'p', F => F.e.st === 'free');
    const first = R.F.events.find(e => e.type === 'hit' && e.on === 'e');
    const par = R.F.events.find(e => e.type === 'parry' && e.who === 'e');
    if (!first || !par || par.t - R.pressedAt > 0.5 || par.atk === first.atk) bad.push({ rank, after: par ? par.t - R.pressedAt : null });
  }
  ok('the opponent too: its parry while reeling is dropped (0.03-0.18 s after the hit), its parry once free meets the next cut (ranks 1, 5, 10)', bad.length === 0, bad);
}
{
  // each row's own window: the opponent throws the row at a player in reach (1.2 m apart, as dummy());
  // contact is the first tick of the active window, found by a dry run
  const throwRow = (row, pressAt) => {
    const F = E.newFight(1, 3); F.p.z = -0.6; F.e.z = 0.6; F.p.hp = F.p.hpMax = 1e6;
    let contact = -1;
    const power = row.kind === 'power'; if (power) F.e.energy = 10;               // a power row is thrown the way a fighter throws it
    for (let i = 0; i < 300 && (contact < 0 || i <= contact + 5); i++) {         // stop just after contact, the stagger still on
      if (i === 60 && !power) E.startHit(F, F.e, row.idx, row.kind);
      stepT(F, IN({ parry: i === pressAt }), IN({ power: power && i === 60 }));
      if (contact < 0 && F.events.some(e => (e.type === 'hit' && e.on === 'p') || (e.type === 'parry' && e.who === 'p'))) contact = i;
    }
    return { F, contact };
  };
  const rows = attackRows().filter(r => r.parry), bad = [];
  for (const row of rows) {
    const c = throwRow(row, -1).contact, W = Math.round(row.parryWin / DT);
    const inside = throwRow(row, c - (W - 2)), outside = throwRow(row, c - (W + 2));
    const turned = inside.F.events.some(e => e.type === 'parry' && e.who === 'p') && inside.F.e.st === 'stagger' && inside.F.p.hp === 1e6;
    const landed = outside.F.events.some(e => e.type === 'hit' && e.on === 'p') && !outside.F.events.some(e => e.type === 'parry');
    if (c < 0 || !turned || !landed) bad.push({ row: row.kind + ' ' + row.name, c, W, turned, landed });
  }
  const kinds = [...new Set(rows.map(r => r.kind))], names = [...new Set(rows.map(r => r.name))];
  ok('every parryable row is judged by its own window: a parry raised parryWin - 2 ticks before contact turns it, parryWin + 2 does not (' + rows.length + ' rows: ' + kinds.join(', ') + ' x ' + names.join(', ') + ')',
    rows.length >= 15 && ['normal', 'quick', 'heavy'].every(k => kinds.includes(k)) && bad.length === 0, bad);
}
{
  // no swing is resolved twice: none that dealt damage is ever parried, and none hits twice
  const n = {}; let hits = 0, parries = 0;
  for (const rank of [1, 5, 10]) for (let s = 1; s <= 4; s++) {
    const F = E.newFight(rank, s * 7919 + rank), mem = {};
    for (let i = 0; i < 120 / DT && !F.over; i++) {
      E.stepFight(F, DT, counter(F, mem), E.aiIntent(F, DT));
      for (const e of F.events) if (e.type === 'hit' || e.type === 'parry') { const k = rank + ':' + s + ':' + e.atk; n[k] = (n[k] || 0) + 1; if (e.type === 'hit') hits++; else parries++; }
      F.events.length = 0;
    }
  }
  const twice = Object.keys(n).filter(k => n[k] > 1 || /undefined/.test(k));
  ok('no swing both hurts and is parried, or lands twice: each attack id meets one hit or one parry at most (AI v counter, ranks 1, 5, 10, four seeds)', hits > 0 && parries > 0 && twice.length === 0, { hits, parries, twice: twice.slice(0, 5) });
}
{
  // the normal rows are today's numbers, copied from the chain as it shipped
  const TODAY = [
    ['kesa', 7, 0.16, 0.10, 0.30, 2.0, 2.0, 0.30], ['gyaku', 7, 0.14, 0.10, 0.30, 2.0, 2.0, 0.25], ['yoko', 9, 0.16, 0.12, 0.32, 2.1, 2.6, 0.30],
    ['tsuki', 10, 0.18, 0.08, 0.34, 2.4, 0.8, 0.60], ['shomen', 15, 0.26, 0.12, 0.45, 2.2, 1.4, 0.45]];
  const N = E.ATTACKS.normal, keys = ['name', 'dmg', 'wind', 'act', 'rec', 'reach', 'arc', 'lunge'];
  const same = N.length === 5 && TODAY.every((t, i) => keys.every((k, j) => N[i][k] === t[j]) && N[i].kind === 'normal' && N[i].idx === i && N[i].parry === true && N[i].parryWin === 0.24);
  ok('the normal attack rows are today\'s chain exactly, each parryable for 0.24 s; the power row is not parryable', same && E.ATTACKS.power.parry === false && E.ATTACKS.power.parryWin === 0, { N, power: E.ATTACKS.power });
}
console.log('-- engine: quick and heavy strikes');
{
  // the kind rows: the chain, with wind-up, recovery and damage scaled, and a parry window that scales with the telegraph
  const F = { quick: [0.5, 0.8, 0.6, 0.12], heavy: [2.0, 1.3, 1.6, 0.40] }, bad = [];
  for (const k of Object.keys(F)) {
    const [w, r, d, win] = F[k], rows = E.ATTACKS[k] || [];
    if (rows.length !== RULES.chain.length) bad.push({ k, n: rows.length });
    RULES.chain.forEach((c, i) => {
      const x = rows[i] || {};
      const okRow = Math.abs(x.wind - c.wind * w) < 1e-12 && Math.abs(x.rec - c.rec * r) < 1e-12 && Math.abs(x.dmg - c.dmg * d) < 1e-12 &&
        ['name', 'act', 'reach', 'arc', 'lunge'].every(f => x[f] === c[f]) && x.kind === k && x.idx === i && x.parry === true && Math.abs(x.parryWin - win) < 1e-12;
      if (!okRow) bad.push({ k, i, x });
    });
  }
  ok('the quick and heavy rows are the chain with wind-up, recovery and damage x0.5/0.8/0.6 and x2.0/1.3/1.6, parryable for 0.12 s and 0.40 s', bad.length === 0, bad.slice(0, 3));
}
{
  // each strike starts a cut of its own kind; landed on the same cut of the chain, it does its kind's damage
  const got = {};
  for (const act of ['atk', 'quick', 'heavy']) {
    const F = dummy(1); F.e.hp = F.e.hpMax = 1e6;
    run(F, 1.0, (F, i) => IN({ [act]: i === 0 }));
    const sw = evs(F, 'swing', 'p'), h = evs(F, 'hit', 'p');
    got[act] = { n: sw.length, kind: sw[0] && sw[0].kind, idx: sw[0] && sw[0].idx, hidx: h[0] && h[0].idx, dmg: h[0] && h[0].dmg, w: sw[0] && E.ATTACKS[sw[0].kind] && E.ATTACKS[sw[0].kind][0].wind };
  }
  const n = got.atk.dmg, okKinds = got.atk.kind === 'normal' && got.quick.kind === 'quick' && got.heavy.kind === 'heavy' && ['atk', 'quick', 'heavy'].every(a => got[a].n === 1 && got[a].idx === 0 && got[a].hidx === 0);
  ok('attack, quick and heavy each start a cut whose swing carries its kind; on the same cut quick does 0.6x and heavy 1.6x normal\'s damage, quick winds up in half the time',
    okKinds && n > 0 && Math.abs(got.quick.dmg / n - 0.6) < 1e-9 && Math.abs(got.heavy.dmg / n - 1.6) < 1e-9 && Math.abs(got.quick.w / got.atk.w - 0.5) < 1e-9, got);
}
{
  // mixed into the chain: atk, quick, heavy, atk, quick, each tapped once the cut before is half wound
  const F = dummy(1); F.e.hp = F.e.hpMax = 1e6;
  const seq = ['atk', 'quick', 'heavy', 'atk', 'quick'];
  let k = 0;
  run(F, 4.0, (F, i) => {
    const p = F.p;
    if (k >= seq.length) return IN();
    if (k === 0 && p.st === 'free') return IN({ [seq[k++]]: true });
    if (k > 0 && p.st === 'atk' && !p.queued && p.chain === k - 1 && p.t >= E.phasesOf(p, E.specOf(p)).w * RULES.chainQueue) return IN({ [seq[k++]]: true });
    return IN();
  });
  const sw = evs(F, 'swing', 'p').slice(0, 5), pays = evs(F, 'energy', 'p').filter(e => /combo/.test(e.why)).map(e => e.why);
  const want = ['normal', 'quick', 'heavy', 'normal', 'quick'];
  ok('quick and heavy strikes mix into the chain: atk, quick, heavy, atk, quick are cuts 1-5 of one chain, and the combo pays at 3 and 5',
    sw.length === 5 && sw.every((e, i) => e.idx === i && e.kind === want[i]) && evs(F, 'hit', 'p').length >= 5 && pays.slice(0, 2).join() === 'combo3,combo5', { sw: sw.map(e => e.idx + e.kind), pays });
}
{
  // the opponent throws all three, jabbing more as the ranks climb and leaning on heavies low down
  const share = {};
  for (const rank of [1, 5, 10]) {
    const c = { normal: 0, quick: 0, heavy: 0 };
    for (let s = 1; s <= 4; s++) {
      const F = E.newFight(rank, s * 104729 + rank), mem = {};
      F.p.hp = F.p.hpMax = F.e.hp = F.e.hpMax = 1e6;
      for (let i = 0; i < 60 / DT; i++) {
        E.stepFight(F, DT, counter(F, mem), E.aiIntent(F, DT));
        for (const e of F.events) if (e.type === 'swing' && e.who === 'e') c[e.kind]++;
        F.events.length = 0;
      }
    }
    const n = c.normal + c.quick + c.heavy || 1;
    share[rank] = { n, quick: +(c.quick / n).toFixed(3), heavy: +(c.heavy / n).toFixed(3), c };
  }
  console.log('     opponent cuts by kind (quick / heavy share): rank 1 ' + share[1].quick + ' / ' + share[1].heavy + ', rank 5 ' + share[5].quick + ' / ' + share[5].heavy + ', rank 10 ' + share[10].quick + ' / ' + share[10].heavy);
  ok('the opponent throws all three kinds (rank 5), quick more often at rank 10 than at rank 1 and heavy more often at rank 1 than at rank 10 (AI v counter, four seeds, 60 s)',
    share[5].c.normal > 0 && share[5].c.quick > 0 && share[5].c.heavy > 0 && share[10].quick > share[1].quick && share[1].heavy > share[10].heavy, share);
}
{
  // a telegraph matters to the opponent's mind: at rank 5 it parries more of a player's heavies than of their quicks
  const parried = { quick: 0, heavy: 0 }, N = 40;
  for (const act of ['quick', 'heavy']) for (let s = 1; s <= N; s++) {
    const F = E.newFight(5, 7000 + s); F.p.z = -0.6; F.e.z = 0.6;
    for (let i = 0; i < 1.5 / DT; i++) {
      E.stepFight(F, DT, IN({ [act]: i === 0 }), E.aiIntent(F, DT));
      if (F.events.some(e => (e.type === 'hit' && e.who === 'p') || e.type === 'parry' || e.type === 'dodged' || (e.type === 'whiff' && e.who === 'p'))) break;
    }
    if (evs(F, 'parry', 'e').length) parried[act]++;
  }
  ok('a telegraph matters to the opponent: at rank 5 it parries more of 40 heavies than of 40 quicks, each a first cut from free', parried.heavy > parried.quick, parried);
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
    const lead = e.st === 'power' ? 0.13 : Math.min(0.13, 0.9 * E.specOf(e).parryWin);   // a cut's lead from its row; a power attack is dodged, as before
    if (until > 0 && until <= lead && mem.ans !== e.atkId) { mem.ans = e.atkId; if (e.st === 'power') { inp.dodge = true; inp.mx = -dz / d; inp.mz = dx / d; } else inp.parry = true; }
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
  // the context starts with nothing stored, and no row has saved settings yet
  const style0 = await page.evaluate(() => ({ style: __CS.SETTINGS.style, sel: document.getElementById('style-sel').value }));
  ok('with nothing stored the graphics style is realistic, and the select says so', style0.style === 'realistic' && style0.sel === 'realistic', style0);
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

  console.log('-- page: graphics styles');
  // every comparison draws all its variants inside ONE evaluate through __CS.draw() (dt 0, camera
  // snapped), because the rAF loop keeps drawing between evaluates
  const SKEY = 'combatSimulator.settings.v1';
  const offered = await page.evaluate(() => [...document.querySelectorAll('#style-sel option')].map(o => o.value));
  ok('the style select offers exactly realistic, toon, in that order', JSON.stringify(offered) === JSON.stringify(['realistic', 'toon']), offered);
  const pick = await page.evaluate(KEY => {
    __CS.setPaused(true); __CS.setStyle('realistic');
    const F0 = __CS.F, t0 = F0.t;
    const a = __CS.pixels().d;
    const sel = document.getElementById('style-sel'); sel.value = 'toon'; sel.dispatchEvent(new Event('change'));
    const b = __CS.pixels().d;
    let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
    return { style: __CS.SETTINGS.style, raw: localStorage.getItem(KEY) || '', diff, sameFight: __CS.F === F0, t: __CS.F.t === t0, st: __CS.APP.state };
  }, SKEY);
  ok('choosing toon in the select sets it, saves it and changes the next draw, with no new duel', pick.style === 'toon' && /"style":"toon"/.test(pick.raw) && pick.diff > 2000 && pick.sameFight && pick.t,
    { style: pick.style, stored: pick.raw.slice(0, 120), diff: pick.diff, sameFight: pick.sameFight, t: pick.t });
  const booted = async () => { await page.waitForFunction(() => window.__CS && window.__CS.F, null, { timeout: 30000 }); return page.evaluate(() => ({ style: __CS.SETTINGS.style, sel: document.getElementById('style-sel').value })); };
  await page.reload();
  const kept = await booted();
  ok('after a reload the style is still toon', kept.style === 'toon' && kept.sel === 'toon', kept);
  const store = s => page.evaluate(([KEY, s]) => { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s === null) delete o.style; else o.style = s; localStorage.setItem(KEY, JSON.stringify(o)); }, [SKEY, s]);
  await store(null); await page.reload(); const noKey = await booted();
  await store('chalk'); await page.reload(); const junk = await booted();
  ok('a stored settings object without a style, or with a junk one, loads as realistic', noKey.style === 'realistic' && noKey.sel === 'realistic' && junk.style === 'realistic' && junk.sel === 'realistic', { noKey, junk });
  await store('realistic'); await page.reload(); await booted();
  await page.evaluate(() => __CS.setPaused(true));
  // a skin is paint: one fixed-seed duel per style, a real frame drawn every 4 ticks, the stick at rest
  const duelUnder = (first, then, at) => page.evaluate(([first, then, at]) => {
    __CS.stick(0, 0); __CS.INPUT.keys = {}; __CS.setPaused(true); __CS.setStyle(first);
    __CS.startDuel(5, 777);
    for (let i = 0; i < 1200; i++) {
      if (then && i === at) __CS.setStyle(then);
      if (i % 30 === 0) __CS.press('atk');
      __CS.tick(1 / 120, 1);
      if (i % 4 === 0) __CS.draw();
    }
    const F = __CS.F, drawn = __CS.SETTINGS.style;
    const snap = JSON.stringify({ p: F.p, e: F.e, ai: F.ai, t: F.t, nextAtk: F.nextAtk, r: F.rng() });
    __CS.setStyle('realistic');
    return { snap, drawn, hits: F.p.stats.hits + F.e.stats.hits };
  }, [first, then, at]);
  const STY = await page.evaluate(() => __CS.STYLES.slice());
  const runs = {};
  for (const s of STY) runs[s] = await duelUnder(s);
  const base = runs.realistic;
  console.log('     paint scenario: ' + base.hits + ' cuts landed, snapshot ' + base.snap.length + ' bytes; select change redrew ' + pick.diff + ' px');
  ok('a skin is paint: a fixed-seed duel steps to byte-identical fighters under ' + STY.join(', '), base.hits > 0 && STY.every(s => runs[s].snap === base.snap && runs[s].drawn === s),
    STY.map(s => [s, runs[s].drawn, runs[s].hits, runs[s].snap === base.snap]));
  const swaps = [];
  for (const s of STY.filter(s => s !== 'realistic')) { const r = await duelUnder('realistic', s, 600); swaps.push([s, r.drawn === s, r.snap === base.snap]); }
  ok('switching style mid-duel (realistic to ' + STY.filter(s => s !== 'realistic').join(', ') + ' at tick 600) changes nothing', swaps.length === STY.length - 1 && swaps.every(x => x[1] && x[2]), swaps);
  // toon is banded: fewer distinct luminance levels on the opponent's torso
  const bands = await page.evaluate(() => {
    __CS.setPaused(true); __CS.startDuel(1, 99); __CS.tick(1 / 60, 125);
    const F = __CS.F; F.ai.cd = 1e9; F.p.x = 0; F.p.z = -1.5; F.e.x = 0; F.e.z = 1.5; F.p.st = F.e.st = 'free'; F.p.t = F.e.t = 0;
    __CS.PARTS.length = 0;
    const out = {};
    for (const s of __CS.STYLES) {
      __CS.setStyle(s); __CS.draw();
      const c = project([F.e.x, 1.25, F.e.z], innerWidth, innerHeight);
      const px = __CS.pixels(Math.round(c.x - 6), Math.round(c.y - 20), 12, 40).d, hist = new Array(64).fill(0);
      for (let i = 0; i < px.length; i += 4) hist[Math.floor((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 256 * 64)]++;
      out[s] = hist.filter(n => n >= 3).length;
    }
    __CS.setStyle('realistic');
    return out;
  });
  console.log('     torso luminance levels: ' + JSON.stringify(bands));
  ok('toon is banded: at most half the luminance levels of realistic on the opponent\'s torso', bands.realistic >= 20 && bands.toon * 2 <= bands.realistic, bands);
  // toon's ink: FX.ink on and off on ONE frozen frame, near-black pixels (every channel < 30) counted
  // in the opponent's box (0.6 m round it, 2 m tall), outside both fighters' wide boxes (1.3 m, 2.4 m:
  // the courtyard alone), and in the 12 x 40 px box on its torso (the ink is a rim, never a fill)
  const ink = await page.evaluate(() => {
    __CS.setPaused(true); __CS.startDuel(1, 99); __CS.tick(1 / 60, 125);
    const F = __CS.F; F.ai.cd = 1e9; F.p.x = 0; F.p.z = -1.5; F.e.x = 0; F.e.z = 1.5; F.p.st = F.e.st = 'free'; F.p.t = F.e.t = 0;
    __CS.PARTS.length = 0;
    const W = innerWidth, H = innerHeight;
    const boxOf = (f, r, top) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [0, top]) { const q = project([f.x + dx, y, f.z + dz], W, H); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      return [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)]; };
    const one = (style, on) => {
      __CS.setStyle(style); __CS.FX.ink = on;
      const px = __CS.pixels(), d = px.d, w = px.w, h = px.h, k = w / W;     // rows bottom-up, device px
      const be = boxOf(F.e, 0.6, 2.0), bp = boxOf(F.p, 1.3, 2.4), bo = boxOf(F.e, 1.3, 2.4);
      const c = project([F.e.x, 1.25, F.e.z], W, H), tb = [Math.round(c.x - 6), Math.round(c.y - 20), Math.round(c.x + 6), Math.round(c.y + 20)];
      const inB = (b, x, y) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3];
      let opp = 0, yard = 0, torso = 0, tN = 0;
      for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
        const x = gx / k, y = (h - 1 - gy) / k, i = (gy * w + gx) * 4, dark = d[i] < 30 && d[i + 1] < 30 && d[i + 2] < 30;
        if (inB(tb, x, y)) { tN++; if (dark) torso++; }
        if (!dark) continue;
        if (inB(be, x, y)) opp++;
        if (!inB(bp, x, y) && !inB(bo, x, y)) yard++;
      }
      return { opp, yard, torso, tN, d };
    };
    const on = one('toon', true), off = one('toon', false), rOn = one('realistic', true), rOff = one('realistic', false);
    let same = rOn.d.length === rOff.d.length; for (let i = 0; same && i < rOn.d.length; i++) if (rOn.d[i] !== rOff.d[i]) same = false;
    __CS.FX.ink = true; __CS.setStyle('realistic');
    const strip = r => ({ opp: r.opp, yard: r.yard, torso: r.torso, tN: r.tN });
    return { on: strip(on), off: strip(off), rOn: strip(rOn), rOff: strip(rOff), same };
  });
  console.log('     ink: ' + JSON.stringify(ink));
  // measured at 844x390 (rank 1): fighter +548 (+114 of it the courtyard's ink behind), courtyard +3334,
  // torso 27 of 480 dark; with the hull culled instead of discarded, the torso went 475 of 480
  ok('toon inks round a fighter: near-black on the opponent rises with the ink on, and stays a rim, not a fill',
    ink.on.opp - ink.off.opp >= 300 && ink.on.tN > 0 && ink.on.torso <= ink.on.tN * 0.25, { on: ink.on, off: ink.off });
  ok('toon inks round the courtyard: near-black outside both fighters rises with the ink on', ink.on.yard - ink.off.yard >= 1500, { on: ink.on.yard, off: ink.off.yard });
  ok('realistic is untouched by the ink: its frames with FX.ink on and off are byte-identical', ink.same && ink.rOn.yard === ink.rOff.yard, { same: ink.same, rOn: ink.rOn, rOff: ink.rOff });
  // every element at once in every style: a power wind-up and its ring, a trail, sparks; no GL error
  const all = await page.evaluate(() => {
    __CS.setPaused(true); __CS.setStyle('realistic'); __CS.startDuel(4, 31); __CS.tick(1 / 60, 125);
    const F = __CS.F; F.ai.cd = 1e9; F.p.x = 0; F.p.z = -0.8; F.e.x = 0; F.e.z = 0.8; F.p.st = F.e.st = 'free'; F.p.t = F.e.t = 0;
    __CS.press('atk');
    for (let n = 0; n < 240 && __CS.VIS.p.trail.length < 3; n++) { __CS.tick(1 / 120, 1); __CS.draw(); }
    F.e.st = 'power'; F.e.t = 0.05;
    __CS.PARTS.length = 0;
    for (let i = 0; i < 40; i++) __CS.PARTS.push({ p: [Math.sin(i) * 0.6, 0.6 + (i % 8) * 0.15, Math.cos(i) * 0.6], v: [0, 0, 0], life: 0.6, age: 0.1, size: 0.04, col: [1, 0.9, 0.7], g: 0 });
    const out = { trail: __CS.VIS.p.trail.length, st: F.e.st, parts: __CS.PARTS.length, styles: {} };
    for (const s of __CS.STYLES) {
      __CS.setStyle(s);
      const px = __CS.pixels().d, err = __CS.glError();
      let mono = true; for (let i = 4; i < px.length && mono; i += 4) if (px[i] !== px[0] || px[i + 1] !== px[1] || px[i + 2] !== px[2]) mono = false;
      out.styles[s] = { err, mono };
    }
    __CS.setStyle('realistic');
    return out;
  });
  ok('every element at once (power ring, trail, 40 sparks) draws in ' + Object.keys(all.styles).join(', ') + ' with no GL error and a real picture',
    all.trail >= 3 && all.st === 'power' && all.parts === 40 && Object.keys(all.styles).length === STY.length && Object.values(all.styles).every(r => r.err === 0 && !r.mono), all);
  ok('no page or console errors', errors.length === 0, errors);
  await browser.close();
  finish();
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); fail++; finish(); });
function finish() { console.log('COMBAT SIMULATOR DRIVE: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }
