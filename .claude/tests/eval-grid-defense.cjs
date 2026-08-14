#!/usr/bin/env node
// eval-grid-defense.cjs — BALANCE + PACING harness for games/grid-defense/.
//
// Rules are gated by drive-grid-defense.cjs. This file measures whether the
// campaign's difficulty *claims* are true, by actually playing it:
//
//   "skip the skill trees and you barely get past level 3"
//   "a poor skill selection stalls you around level 4"
//   "a poor tower mix / placement stalls well before a good one"
//   "a coherent build — AOE at the mouth, frost behind it, single-target
//    mid-path, snipers deep — goes the distance"
//
// A persona is DATA, not code, so new ones can be written by hand or by a
// subagent hunting for strategies and exploits the fixed set never imagined:
//
//   {
//     name:    "front-aoe",
//     skills:  ["drill","drill","velocity", ...],   // spend priority; [] = never
//     armory:  ["nova","pulse","frost","rail"],     // tier priority; [] = never
//     research: true,                               // melt spare cores into ★
//     mix:     { nova:0.30, frost:0.20, pulse:0.30, rail:0.20 },  // target share
//     place:   { nova:0.12, frost:0.35, pulse:0.55, rail:0.80 },  // 0=entry 1=exit
//     upgrade: "value" | "never" | "aggressive",
//     abilities: true,
//   }
//
// `place` is the interesting knob: each turret type names the point along the
// road it wants to sit near, so "AOE at the start, snipers further out" is a
// thing the harness can actually express — and get wrong on purpose.
//
// Usage:
//   node .claude/tests/eval-grid-defense.cjs                # built-in personas + assertions
//   node .claude/tests/eval-grid-defense.cjs --only good-mix
//   node .claude/tests/eval-grid-defense.cjs --strategy my.json   # one custom persona
//   node .claude/tests/eval-grid-defense.cjs --json         # machine-readable report
// Env: GD_RETRY_CAP (default 3) — attempts allowed per level before "stalled".
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core not resolvable (NODE_PATH).');
  console.log('GRID-DEFENSE EVAL: 0 passed, 1 failed');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'grid-defense', 'index.html');
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const RETRY_CAP = +(process.env.GD_RETRY_CAP || 3);
const argv = process.argv.slice(2);
const argOf = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const ONLY = argOf('--only');
const STRATEGY_FILE = argOf('--strategy');
const AS_JSON = argv.includes('--json');
// --curve <levelGrowth>,<waveGrowth> overrides the HP sawtooth for a run, so
// the balance can be swept without editing the game between measurements.
const CURVE = (argOf('--curve') || '').split(',').map(Number).filter(n => n > 0);

/* --------------------------- built-in personas --------------------------- */
const GOOD_SKILLS = [
  'drill', 'drill', 'velocity', 'focus', 'drill', 'crit', 'velocity', 'ordnance',
  'standing', 'fieldcmd', 'drill', 'focus', 'crit', 'deadeye', 'velocity',
  'logistics', 'contracts', 'crit', 'focus', 'armorpen', 'cryo', 'deadeye',
  'execute', 'armorpen', 'drill', 'overdrive', 'crit', 'execute', 'armorpen',
  'annihilation', 'marksman', 'marksman', 'rapid', 'tactics', 'velocity',
  'hypervelocity', 'wideblast', 'ordnance', 'shrapnel', 'incendiary',
];
// Points into things that do not scale with the HP curve: sell value, refunds,
// targeting modes, flat per-kill cash. All real nodes, all the wrong ones.
const BAD_SKILLS = [
  'logistics', 'salvage', 'salvage', 'salvage', 'salvage', 'calibration',
  'scavenge', 'scavenge', 'scavenge', 'targeting', 'modular', 'reclaim',
  'logistics', 'logistics', 'logistics', 'prefab', 'prefab', 'retrofit',
];
const GOOD_MIX   = { nova: 0.30, frost: 0.20, pulse: 0.28, rail: 0.22 };
// AOE at the mouth, frost just behind it, single-target mid, snipers deep.
const GOOD_PLACE = { nova: 0.12, frost: 0.32, pulse: 0.55, rail: 0.80 };

const PERSONAS = [
  { name: 'good-mix', desc: 'coherent build: good skills, good mix, front-loaded AOE, upgrades',
    skills: GOOD_SKILLS, armory: ['nova', 'pulse', 'rail', 'frost'], research: true,
    mix: GOOD_MIX, place: GOOD_PLACE, upgrade: 'value', abilities: true },

  { name: 'no-skills', desc: 'never opens the skill trees; everything else played well',
    skills: [], armory: ['nova', 'pulse', 'rail', 'frost'], research: false,
    mix: GOOD_MIX, place: GOOD_PLACE, upgrade: 'value', abilities: false },

  { name: 'bad-skills', desc: 'spends every point on nodes that do not scale',
    skills: BAD_SKILLS, armory: ['nova', 'pulse', 'rail', 'frost'], research: true,
    mix: GOOD_MIX, place: GOOD_PLACE, upgrade: 'value', abilities: false },

  { name: 'bad-mix', desc: 'good skills, but all PULSE and never upgrades',
    skills: GOOD_SKILLS, armory: ['pulse'], research: true,
    mix: { pulse: 1 }, place: { pulse: 0.5 }, upgrade: 'never', abilities: true },

  { name: 'bad-placement', desc: 'good skills and mix, but everything crammed at the exit',
    skills: GOOD_SKILLS, armory: ['nova', 'pulse', 'rail', 'frost'], research: true,
    mix: GOOD_MIX, place: { nova: 0.92, frost: 0.92, pulse: 0.92, rail: 0.92 },
    placeStrict: true, placeWindow: 0.16, upgrade: 'value', abilities: true },

  { name: 'no-armory', desc: 'good skills and placement, but never buys a permanent tier',
    skills: GOOD_SKILLS, armory: [], research: true,
    mix: GOOD_MIX, place: GOOD_PLACE, upgrade: 'value', abilities: true },
];

/* ------------------- the strategy interpreter (in-page) ------------------ */
const PLAYER = `(() => {
  const G = window.__GD;
  const SAMPLES = 140;
  let samples = [], cells = [], covCache = {};

  function refreshBoard() {
    covCache = {};
    samples = G.pathSamples(SAMPLES);
    cells = G.buildableCells().map(o => ({ r:o.r, c:o.c, x:G.cellCx(o.c), y:G.cellCy(o.r) }));
  }
  function rangeOf(type) {
    const S = G.S(), st = G.st();
    return G.TOWERS[type].range * G.cellSize() * (1 + 0.05 * st.armory[type].tier) * S.range;
  }
  // coverage AND where along the road that coverage sits — the second number
  // is what lets a persona want its AOE at the mouth and its snipers deep
  function covFor(type, r, c) {
    const k = type + ':' + r + ':' + c;
    if (covCache[k]) return covCache[k];
    const x = G.cellCx(c), y = G.cellCy(r), rng = rangeOf(type);
    let n = 0, sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      if (Math.hypot(p.x - x, p.y - y) <= rng) { n++; sum += i / (samples.length - 1); }
    }
    const res = { cov: n / samples.length, frac: n ? sum / n : 0.5 };
    covCache[k] = res;
    return res;
  }
  function valueOf(type) {
    const T = G.TOWERS[type], st = G.st();
    const dps = T.dmg * (1 + 0.20 * st.armory[type].tier) / T.rate;
    if (type === 'nova') return dps * 2.6;
    if (type === 'frost') return dps + 26;
    return dps;
  }
  function placeScore(strat, type, r, c) {
    const { cov, frac } = covFor(type, r, c);
    if (cov <= 0.015) return 0;
    const pref = (strat.place && strat.place[type] !== undefined) ? strat.place[type] : 0.5;
    const d = frac - pref;
    // placeStrict refuses everything outside the window instead of merely
    // preferring it — without that, a "crowd the exit" persona quietly
    // spreads out once the good cells fill and stops being a bad persona
    if (strat.placeStrict && Math.abs(d) > (strat.placeWindow || 0.15)) return 0;
    return cov * Math.exp(-(d * d) / (2 * 0.18 * 0.18));
  }
  function ownedTypes() {
    const a = G.st().armory;
    return Object.keys(a).filter(t => a[t].owned);
  }
  function wantType(strat, cash) {
    const placed = G.towersRaw(), total = Math.max(1, placed.length);
    let best = null, bestGap = -Infinity;
    for (const t of ownedTypes()) {
      const target = (strat.mix && strat.mix[t]) || 0;
      if (target <= 0) continue;
      const cost = Math.max(5, Math.round(G.TOWERS[t].cost * G.S().buildCost));
      if (cost > cash) continue;
      const gap = target - placed.filter(p => p.type === t).length / total;
      if (gap > bestGap) { bestGap = gap; best = t; }
    }
    return best;
  }
  function spendCash(strat) {
    let guard = 0;
    while (guard++ < 60) {
      const st = G.st(), S = G.S();
      let bBuild = null;
      const type = wantType(strat, st.cash);
      if (type) {
        const cost = Math.max(5, Math.round(G.TOWERS[type].cost * S.buildCost));
        let bc = null, bs = 0;
        for (const cc of cells) {
          if (!G.canBuild(cc.r, cc.c)) continue;
          const sc = placeScore(strat, type, cc.r, cc.c);
          if (sc > bs) { bs = sc; bc = cc; }
        }
        if (bc) bBuild = { kind:'build', type, cell:bc, score: bs * valueOf(type) / cost };
      }
      let bUp = null;
      if (strat.upgrade !== 'never') {
        const boost = strat.upgrade === 'aggressive' ? 2.2 : 1;
        for (const t of G.towersRaw()) {
          if (t.lvl >= S.maxLvl) continue;
          const cost = Math.max(5, Math.round(G.TOWERS[t.type].cost * 0.8 * t.lvl * S.upCost));
          if (cost > st.cash) continue;
          const sc = placeScore(strat, t.type, t.r, t.c) * valueOf(t.type) * 0.45 * boost / cost;
          if (!bUp || sc > bUp.score) bUp = { kind:'up', t, score: sc };
        }
      }
      const pick = (bBuild && bUp) ? (bBuild.score >= bUp.score ? bBuild : bUp) : (bBuild || bUp);
      if (!pick) break;
      const ok = pick.kind === 'build'
        ? G.build(pick.type, pick.cell.r, pick.cell.c)
        : G.upgrade(pick.t.r, pick.t.c);
      if (!ok) break;
    }
  }
  function spendCores(strat) {
    if (!strat.armory || !strat.armory.length) {
      if (strat.research) { let g = 0; while (g++ < 10 && G.research()) {} }
      return;
    }
    let guard = 0;
    while (guard++ < 20) {
      const st = G.st();
      const next = strat.armory
        .filter(t => st.armory[t] && st.armory[t].owned && st.armory[t].tier < 8)
        .sort((a, b) => st.armory[a].tier - st.armory[b].tier)[0];
      if (!next || !G.buyArmory(next)) break;
    }
    if (strat.research) { let g = 0; while (g++ < 6 && G.st().cores >= 14 && G.research()) {} }
  }
  function spendSkills(strat) {
    if (!strat.skills || !strat.skills.length) return;
    let guard = 0;
    while (guard++ < 60) {
      let spent = false;
      for (const id of strat.skills) { if (G.spendSkill(id)) { spent = true; break; } }
      if (!spent) break;
    }
  }
  function useAbilities(strat) {
    if (!strat.abilities) return;
    const st = G.st();
    if (!st.abilities.length) return;
    const creeps = G.creepsRaw().filter(c => !c.dead);
    if (creeps.length < 4) return;
    for (const id of st.abilities) {
      if (id === 'airstrike') {
        // drop it on the densest cluster we can see
        let best = null, bestN = 0;
        for (const c of creeps) {
          let n = 0;
          for (const o of creeps) if (Math.abs((o.d - c.d)) < G.cellSize() * 2.4) n++;
          if (n > bestN) { bestN = n; best = c; }
        }
        if (best && bestN >= 5) {
          const pt = G.pathSamples(200)[Math.max(0, Math.min(199, Math.round(best.d / G.totalLen() * 199)))];
          G.fireAbility('airstrike', pt.x, pt.y);
        }
      } else if (id === 'cryo' && creeps.length >= 10) G.fireAbility('cryo');
      else if (id === 'overdrive' && creeps.length >= 8) G.fireAbility('overdrive');
      else if (id === 'repair' && G.st().lives <= 6) G.fireAbility('repair');
    }
  }
  function act(strat) { spendCores(strat); spendSkills(strat); spendCash(strat); useAbilities(strat); }

  return {
    /* Play one persona through the campaign. Returns a per-level report. */
    run(strat, opts) {
      const cap = opts.retryCap, maxLevel = opts.maxLevel;
      G.newRun();
      const levels = [];
      let attempts = 1, stalled = null;
      let cur = { level: 1, attempt: 1, waveLives: [], lostTotal: 0 };
      refreshBoard();
      let livesAt = G.st().lives, lastWave = 1, guard = 0;
      while (guard++ < 4000000) {
        G.step(1 / 30, 6);
        const s = G.st();
        if (s.state !== 'play') { stalled = s.level; break; }
        if (guard % 12 === 0) act(strat);

        if (s.wave !== lastWave) {                 // a wave just resolved
          cur.waveLives.push(livesAt - s.lives >= 0 ? livesAt - s.lives : 0);
          livesAt = s.lives; lastWave = s.wave;
        }
        if (s.phase === 'failed') {
          cur.lostTotal = cur.waveLives.reduce((a, b) => a + b, 0);
          levels.push({ level: cur.level, attempt: attempts, cleared: false, waveLives: cur.waveLives });
          if (attempts >= cap) { stalled = cur.level; break; }
          attempts++;
          cur = { level: cur.level, attempt: attempts, waveLives: [] };
          // let the retry timer expire, then re-scan the (identical) board
          for (let i = 0; i < 200; i++) G.step(1 / 30, 1);
          refreshBoard();
          livesAt = G.st().lives; lastWave = 1;
          continue;
        }
        if (s.phase === 'levelclear') {
          levels.push({ level: cur.level, attempt: attempts, cleared: true, waveLives: cur.waveLives });
          if (cur.level >= maxLevel) { stalled = null; break; }
          for (let i = 0; i < 120; i++) G.step(1 / 30, 1);   // roll into the next level
          const ns = G.st();
          attempts = 1;
          cur = { level: ns.level, attempt: 1, waveLives: [] };
          refreshBoard();
          livesAt = ns.lives; lastWave = 1;
          continue;
        }
      }
      const st = G.st();
      return {
        name: strat.name, levels, stalled,
        reached: st.level, score: st.score, retries: st.retries,
        cleared: levels.filter(l => l.cleared).length,
      };
    },
  };
})()`;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

(async () => {
  let personas = PERSONAS;
  if (STRATEGY_FILE) {
    const raw = JSON.parse(fs.readFileSync(STRATEGY_FILE, 'utf8'));
    personas = Array.isArray(raw) ? raw : [raw];
  } else if (ONLY) {
    personas = PERSONAS.filter(p => p.name === ONLY);
    if (!personas.length) { console.error('no persona named ' + ONLY); process.exit(1); }
  }

  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const results = [];
  for (const persona of personas) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + GAME, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.clear());
    if (CURVE.length === 2) await page.evaluate(c => window.__GD.setCurve(c[0], c[1]), CURVE);
    await page.evaluate('window.__P = ' + PLAYER);
    const t0 = Date.now();
    const res = await page.evaluate(
      ([p, o]) => window.__P.run(p, o),
      [persona, { retryCap: RETRY_CAP, maxLevel: 10 }]);
    res.ms = Date.now() - t0;
    res.desc = persona.desc || '';
    res.errors = errs.slice(0, 2);
    results.push(res);
    await page.close();
    if (!AS_JSON) {
      const line = res.levels.map(l => l.level + (l.cleared ? '✓' : '✗')).join(' ');
      console.log(`\n${res.name.padEnd(14)} stalled@${res.stalled === null ? '--' : res.stalled}` +
        `  cleared=${res.cleared}  score=${res.score}  (${(res.ms / 1000).toFixed(0)}s)`);
      console.log('   ' + (res.desc || ''));
      console.log('   ' + line);
      if (res.errors.length) console.log('   ERRORS ' + JSON.stringify(res.errors));
    }
  }
  await browser.close();

  if (AS_JSON) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }
  if (STRATEGY_FILE) {
    console.log('\n(custom strategy run — no design assertions applied)');
    process.exit(0);
  }
  if (ONLY) process.exit(0);

  /* ---------------------- the design's difficulty claims ---------------------- */
  console.log('\n--- design claims ---');
  const by = n => results.find(r => r.name === n);
  const good = by('good-mix'), noSkill = by('no-skills'), badSkill = by('bad-skills');
  const badMix = by('bad-mix'), badPlace = by('bad-placement'), noArm = by('no-armory');
  const depth = r => r.stalled === null ? 99 : r.stalled;

  check('a coherent build clears all ten levels', good.stalled === null, depth(good));
  check('skipping the skill trees: clears 3, cannot pass 4',
    depth(noSkill) <= 4, depth(noSkill));
  check('a poor skill selection: clears 4, cannot pass 5',
    depth(badSkill) <= 5, depth(badSkill));
  check('good skills still beat no skills', depth(good) > depth(noSkill),
    { good: depth(good), noSkill: depth(noSkill) });
  check('a poor selection still beats none at all', depth(badSkill) >= depth(noSkill),
    { badSkill: depth(badSkill), noSkill: depth(noSkill) });
  check('tower mix matters — one-note PULSE stalls before a good mix',
    depth(badMix) < depth(good), { badMix: depth(badMix), good: depth(good) });
  check('placement matters — crowding the exit stalls before spreading the road',
    depth(badPlace) < depth(good), { badPlace: depth(badPlace), good: depth(good) });
  check('the armory matters — skipping permanent tiers costs depth',
    depth(noArm) < depth(good), { noArm: depth(noArm), good: depth(good) });
  check('skills outrank hardware — a bad build with good skills beats good hardware with none',
    depth(badMix) > depth(noSkill), { badMix: depth(badMix), noSkill: depth(noSkill) });

  /* Pacing inside a level: later waves should bite harder than early ones.
     Measured on the run that actually got deep enough to have an opinion. */
  const deep = results.slice().sort((a, b) => depth(b) - depth(a))[0];
  const cleared = deep.levels.filter(l => l.cleared && l.waveLives.length >= 8);
  if (cleared.length) {
    const early = cleared.map(l => l.waveLives.slice(0, 4).reduce((a, b) => a + b, 0));
    const late = cleared.map(l => l.waveLives.slice(-4).reduce((a, b) => a + b, 0));
    const sum = a => a.reduce((x, y) => x + y, 0);
    check('waves bite harder later in a level than at its start',
      sum(late) >= sum(early), { earlyLivesLost: sum(early), lateLivesLost: sum(late) });
  } else {
    check('waves bite harder later in a level than at its start', false, 'no level cleared with full wave data');
  }

  console.log('\nGRID-DEFENSE EVAL: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  console.log('GRID-DEFENSE EVAL: ' + pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
