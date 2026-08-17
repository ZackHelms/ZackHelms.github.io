#!/usr/bin/env node
/**
 * eval-turret-builder.cjs — BALANCE + PACING harness for games/turret-builder/.
 *
 * Rules are gated by drive-turret-builder.cjs. This file measures whether the
 * campaign's difficulty *claims* are true, by actually playing it with
 * declarative strategy personas:
 *
 *   "a coherent grid clears all eight levels"
 *   "bare turrets with no modules barely get started"
 *   "modules that touch nothing are wasted money"
 *   "SHARING a module between two turrets beats bolting it to one"
 *   "a one-note grid meets the creep that answers it"
 *   "a level takes about eight minutes"
 *
 * A persona is DATA, not code, so new ones can be written by hand or by a
 * subagent hunting for exploits the fixed set never imagined. Schema and the
 * hazards that make a persona lie: .claude/tests/strategies-turret-builder/README.md
 *
 * Usage:
 *   node .claude/tests/eval-turret-builder.cjs                 # personas + assertions
 *   node .claude/tests/eval-turret-builder.cjs --only coherent
 *   node .claude/tests/eval-turret-builder.cjs --strategy my.json
 *   node .claude/tests/eval-turret-builder.cjs --json
 *   node .claude/tests/eval-turret-builder.cjs --curve 1.62,1.20
 * Env: TB_RETRY_CAP (default 3) — attempts per level before "stalled".
 */
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core not resolvable (NODE_PATH).');
  console.log('TURRET-BUILDER EVAL: 0 passed, 1 failed');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = 'file://' + path.join(repoRoot, 'games', 'turret-builder', 'index.html');
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const RETRY_CAP = +(process.env.TB_RETRY_CAP || 3);
const argv = process.argv.slice(2);
const argOf = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const ONLY = argOf('--only');
const STRATEGY_FILE = argOf('--strategy');
const AS_JSON = argv.includes('--json');
const CURVE = (argOf('--curve') || '').split(',').map(Number).filter(n => n > 0);
const SEED = +(argOf('--seed') || process.env.TB_SEED || 12345);

/* --------------------------- built-in personas --------------------------
   `lab` is a POSITIONAL plan of track ids: repeating an id means "buy another
   tier of it at that point in the order". Schema and the traps that make a
   persona lie: .claude/tests/strategies-turret-builder/README.md */
const LAB_ALL = [
  'grid', 'chassis', 'grid', 'fire', 'chassis', 'grid', 'elec', 'servo',
  'blast', 'chassis', 'ice', 'grid', 'bulwark', 'optics', 'amp', 'chassis',
  'fire', 'grid', 'servo', 'blast', 'elec', 'bulwark', 'optics', 'ice',
  'amp', 'blast', 'fire', 'servo', 'optics', 'bulwark', 'chassis', 'bulwark',
];
const MIXED = { amp: 0.22, fire: 0.20, ice: 0.18, elec: 0.20, blast: 0.20 };

const PERSONAS = [
  { name: 'coherent', desc: 'mixed modules, shared between packed turrets, boosters, walls, lab spread',
    mods: MIXED, gridSmart: true, boosters: ['prism', 'clock'], walls: 2, wallMods: ['ice', 'fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  { name: 'no-modules', desc: 'bare gray triangles — the turret alone, upgraded hard',
    noMods: true, walls: 2, wallMods: [], lab: LAB_ALL, upgrade: 'aggressive', place: 0.45 },

  { name: 'orphan-mods', desc: 'buys modules but drops them where nothing touches a turret',
    mods: MIXED, scatter: true, walls: 2, wallMods: [], lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  { name: 'unshared', desc: 'same modules, same spend, but never shares one between two turrets',
    mods: MIXED, gridSmart: false, noShare: true, walls: 2, wallMods: ['ice', 'fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  { name: 'no-boosters', desc: 'a good grid that never touches the diagonals',
    mods: MIXED, gridSmart: true, boosters: [], walls: 2, wallMods: ['ice', 'fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  /* ALL-IN builds. The design promise is increasing returns for stacking one
     type, so each of these should be strong — and the four-of-a-kind combo
     they each unlock is the reward for committing. */
  { name: 'all-amp', desc: 'four AMP a turret — SIEGE BATTERY, raw kinetic',
    mods: { amp: 1 }, gridSmart: true, boosters: ['twin'], walls: 2, wallMods: ['amp'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'all-fire', desc: 'four FIRE a turret — FIRESTORM, burn that spreads',
    mods: { fire: 1 }, gridSmart: true, boosters: ['twin'], walls: 2, wallMods: ['fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'all-elec', desc: 'four ELEC a turret — TESLA COIL, six hops',
    mods: { elec: 1 }, gridSmart: true, boosters: ['twin'], walls: 2, wallMods: ['elec'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'all-blast', desc: 'four BLAST a turret — MORTAR BATTERY, splash on everything',
    mods: { blast: 1 }, gridSmart: true, boosters: ['twin'], walls: 2, wallMods: ['blast'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'all-ice', desc: 'four ICE a turret — HAILSTORM, and no damage of its own',
    mods: { ice: 1 }, gridSmart: true, boosters: ['twin'], walls: 2, wallMods: ['ice'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  /* COMBO builds — opposite pairs, so every turret carries a named combo. */
  { name: 'grenadiers', desc: 'INCENDIARY GRENADE LAUNCHER on every turret',
    pairs: ['blast', 'fire'], gridSmart: true, boosters: ['prism'], walls: 2, wallMods: ['ice'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'cryo', desc: 'CRYO SHELL on every turret — chill the whole blast',
    pairs: ['blast', 'ice'], gridSmart: true, boosters: ['prism'], walls: 2, wallMods: ['fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },
  { name: 'chainers', desc: 'CHAIN REACTION on every turret — every hop detonates',
    pairs: ['blast', 'elec'], gridSmart: true, boosters: ['prism'], walls: 2, wallMods: ['ice'],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  { name: 'no-walls', desc: 'a good grid that never buys a second of time on the road',
    mods: MIXED, gridSmart: true, boosters: ['prism', 'clock'], walls: 0, wallMods: [],
    lab: LAB_ALL, upgrade: 'value', place: 0.45 },

  { name: 'no-lab', desc: 'good grid, good walls, never spends a single core',
    mods: MIXED, gridSmart: true, boosters: ['prism', 'clock'], walls: 2, wallMods: ['ice', 'fire'],
    lab: [], upgrade: 'value', place: 0.45 },

  { name: 'exit-camp', desc: 'everything crammed at the exit, where it gets one look',
    mods: MIXED, gridSmart: true, boosters: ['prism'], walls: 2, wallMods: ['ice', 'fire'],
    lab: LAB_ALL, upgrade: 'value', place: 0.93, placeStrict: true },
];

/* ------------------- the strategy interpreter (in-page) ------------------ */
const PLAYER = `(() => {
  const G = window.__TB;
  const ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];
  const MODS = ['amp','fire','ice','elec','blast'];
  const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
  let samples = [], cells = [], covCache = {};

  function refreshBoard() {
    covCache = {};
    samples = G.pathSamples(140);
    cells = G.buildableCells('turret').map(o => ({ r:o.r, c:o.c }));
  }
  function rangePx() { const s = G.st(); return G.TURRET.range * (1 + 0.08 * (s.lab.optics || 0)) * G.cellSize(); }
  /* coverage AND where along the road that coverage sits — the second number
     is what lets a persona want to camp the exit and be wrong about it */
  function covFor(r, c) {
    const k = r + ':' + c;
    if (covCache[k]) return covCache[k];
    const x = G.cellCx(c), y = G.cellCy(r), rng = rangePx();
    let n = 0, sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      if (Math.hypot(p.x - x, p.y - y) <= rng) { n++; sum += i / (samples.length - 1); }
    }
    const res = { cov: n / samples.length, frac: n ? sum / n : 0.5 };
    covCache[k] = res;
    return res;
  }
  function turretScore(strat, r, c) {
    const { cov, frac } = covFor(r, c);
    if (cov <= 0.012) return 0;
    const pref = strat.place === undefined ? 0.45 : strat.place;
    const d = frac - pref;
    if (strat.placeStrict && Math.abs(d) > 0.16) return 0;
    let sc = cov * Math.exp(-(d * d) / (2 * 0.20 * 0.20));
    let free = 0;
    for (const [dr, dc] of ORTHO) if (G.canPlace('fire', r + dr, c + dc)) free++;
    /* A named combo needs all FOUR sides, so a pairs persona must refuse any
       cell it cannot finish. This is a real constraint on the player too: the
       first version packed eleven turrets into the highest-coverage cells,
       left them with no free sides, and built SEVEN modules and ZERO combos
       while reporting a full board. Combos cost board space. */
    if (strat.pairs && free < 4) return 0;
    if (!strat.scatter && !strat.noMods) sc *= 0.55 + 0.15 * free;
    return sc;
  }
  function structures() { return G.tilesRaw().filter(t => t.kind === 'turret' || t.kind === 'wall'); }
  function modCount(t) { return MODS.concat(['armor','regen']).reduce((a, k) => a + (t.mods[k] || 0), 0); }
  function modShare() {
    const tally = { amp:0, fire:0, ice:0, elec:0, blast:0 };
    let n = 0;
    for (const t of G.tilesRaw()) if (t.kind === 'module' && tally[t.mod] !== undefined) { tally[t.mod]++; n++; }
    return { tally, n: Math.max(1, n) };
  }
  function wantMod(strat) {
    const { tally, n } = modShare();
    let best = null, bestGap = -Infinity;
    for (const k of MODS) {
      const target = (strat.mods && strat.mods[k]) || 0;
      if (target <= 0) continue;
      const gap = target - tally[k] / n;
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    return best;
  }
  /* PAIRS MODE. A named combo needs two OPPOSITE sides of one type and the
     other two of another, so this fills a turret side by side rather than
     chasing a share target — it is the only way a persona can deliberately
     build INCENDIARY GRENADE LAUNCHERs instead of stumbling onto one. */
  function pairFill(strat) {
    const [a, b] = strat.pairs;
    for (const t of G.tilesRaw()) {
      if (t.kind !== 'turret') continue;
      const sides = G.turretStats(t.r, t.c).sides;   // [up, down, left, right]
      const plan = [a, a, b, b];
      for (let d = 0; d < 4; d++) {
        if (sides[d]) continue;
        /* side index d means the module sits at turret + ORTHO[d]. The first
           version used ORTHO[d ^ 1] here and every pairs persona built ZERO
           combos while reporting a full board — the tell was "0 combos" on a
           persona whose whole job was building them. */
        const [dr, dc] = ORTHO[d];
        const r = t.r + dr, c = t.c + dc;
        if (!G.canPlace(plan[d], r, c)) continue;
        return { kind: plan[d], r, c };
      }
    }
    return null;
  }
  /* boosters sit on a turret's diagonals; prefer a diagonal that touches two
     turrets, since a booster is shared exactly like a module */
  function boosterSpot(strat) {
    if (!strat.boosters || !strat.boosters.length) return null;
    const kind = strat.boosters[G.st().boosters % strat.boosters.length];
    let best = null, bestFeeds = 0;
    for (const t of G.tilesRaw()) {
      if (t.kind !== 'turret') continue;
      for (const [dr, dc] of DIAG) {
        const r = t.r + dr, c = t.c + dc;
        if (!G.canPlace(kind, r, c)) continue;
        let feeds = 0;
        for (const [er, ec] of DIAG) {
          const n = G.tileAt(r + er, c + ec);
          if (n && n.kind === 'turret') feeds++;
        }
        if (feeds > bestFeeds) { bestFeeds = feeds; best = { kind, r, c }; }
      }
    }
    return best;
  }
  /* Every empty buildable cell that touches at least one structure with a
     free side, scored by HOW MANY it would feed. gridSmart chases the shared
     cell; a naive player takes whatever is next to the turret it just built. */
  function modSpots(strat) {
    const out = [];
    for (const cc of cells) {
      if (G.tileAt(cc.r, cc.c)) continue;
      if (!G.canPlace('fire', cc.r, cc.c)) continue;
      let feeds = 0;
      for (const [dr, dc] of ORTHO) {
        const n = G.tileAt(cc.r + dr, cc.c + dc);
        if (n && (n.kind === 'turret' || n.kind === 'wall') && modCount(n) < 4) feeds++;
      }
      if (feeds === 0) continue;
      if (strat.noShare && feeds > 1) continue;    // refuse the shared cell on purpose
      out.push({ r:cc.r, c:cc.c, feeds });
    }
    out.sort((a, b) => strat.gridSmart ? b.feeds - a.feeds : a.feeds - b.feeds);
    return out;
  }
  function scatterSpot() {
    for (const cc of cells) {
      if (G.tileAt(cc.r, cc.c) || !G.canPlace('fire', cc.r, cc.c)) continue;
      let touches = 0;
      for (const [dr, dc] of ORTHO) { const n = G.tileAt(cc.r + dr, cc.c + dc); if (n && n.kind !== 'module') touches++; }
      if (touches === 0) return cc;              // deliberately orphaned
    }
    return null;
  }
  function bestWallCell() {
    let best = null, bs = -1;
    for (const p of G.pathCellList()) {
      if (!G.canPlace('wall', p.r, p.c)) continue;
      // a wall is worth most where the guns already look
      let n = 0;
      for (const t of G.tilesRaw()) {
        if (t.kind !== 'turret') continue;
        if (Math.hypot(G.cellCx(t.c) - G.cellCx(p.c), G.cellCy(t.r) - G.cellCy(p.r)) <= rangePx()) n++;
      }
      if (n > bs) { bs = n; best = p; }
    }
    return best;
  }
  /* A priority list has to mean SAVING for the thing you want, not buying
     whatever is cheapest the moment you can afford it. The first version
     fell through to the next id on failure, which quietly turned every
     persona into "spend one core at a time on the cheapest tier available"
     — the coherent build reached level 3 with GRID still on tier 1, and no
     value of HP_LEVEL made any difference because the curve was never the
     thing stopping it. */
  /* Walk the plan POSITIONALLY: repeating an id in the list means "buy
     another tier of this at that point in the order", so [grid, chassis,
     grid] is grid-1, chassis-1, grid-2 — not grid all the way to five. */
  function nextLabId(strat) {
    const s = G.st(), used = {};
    for (const id of strat.lab) {
      used[id] = (used[id] || 0) + 1;
      const tr = G.LAB.find(t => t.id === id);
      if (!tr) continue;
      const have = s.lab[id] || 0;
      if (have >= tr.tiers) continue;
      if (have < used[id]) return id;
    }
    return null;
  }
  function spendCores(strat) {
    if (!strat.lab || !strat.lab.length) return;
    let guard = 0;
    while (guard++ < 60) {
      const want = nextLabId(strat);
      if (!want) break;
      if (!G.buyLab(want)) break;      // cannot afford it yet: save, do not settle
    }
  }
  function spendCash(strat) {
    let guard = 0;
    while (guard++ < 90) {
      const s = G.st();
      let did = false;

      /* 1. turret slots are the scarce thing — always fill them */
      if (s.turrets < s.turretCap) {
        let bc = null, bs = 0;
        for (const cc of cells) {
          if (!G.canPlace('turret', cc.r, cc.c)) continue;
          const sc = turretScore(strat, cc.r, cc.c);
          if (sc > bs) { bs = sc; bc = cc; }
        }
        if (bc && G.place('turret', bc.r, bc.c)) { did = true; continue; }
      }

      /* 2. walls, up to whatever this persona believes in */
      if ((strat.walls || 0) > 0 && s.walls < Math.min(strat.walls, s.wallCap)) {
        const w = bestWallCell();
        if (w && G.place('wall', w.r, w.c)) { did = true; continue; }
      }

      /* 3. modules — pairs mode first, since a combo is worth more than a
            marginally better share ratio */
      if (!strat.noMods && strat.pairs) {
        const pf = pairFill(strat);
        if (pf && G.place(pf.kind, pf.r, pf.c)) { did = true; continue; }
      }
      if (!strat.noMods && !strat.pairs) {
        const mod = strat.scatter ? (wantMod(strat) || 'fire') : wantMod(strat);
        if (mod) {
          if (strat.scatter) {
            const sp = scatterSpot();
            if (sp && G.place(mod, sp.r, sp.c)) { did = true; continue; }
          } else {
            const spots = modSpots(strat);
            if (spots.length && G.place(mod, spots[0].r, spots[0].c)) { did = true; continue; }
          }
        }
      }
      /* 3b. boosters on the diagonals */
      if (strat.boosters && strat.boosters.length) {
        const bs = boosterSpot(strat);
        if (bs && G.place(bs.kind, bs.r, bs.c)) { did = true; continue; }
      }
      if (!strat.noMods) {
        /* wall hardware on the two free sides */
        if ((strat.wallMods || []).length) {
          for (const t of G.tilesRaw()) {
            if (t.kind !== 'wall' || modCount(t) >= 2) continue;
            let placed = false;
            for (const [dr, dc] of ORTHO) {
              if (!G.canPlace('fire', t.r + dr, t.c + dc)) continue;
              const k = strat.wallMods[modCount(t) % strat.wallMods.length];
              if (G.place(k, t.r + dr, t.c + dc)) { placed = true; break; }
            }
            if (placed) { did = true; break; }
          }
          if (did) continue;
        }
      }

      /* 4. upgrades and repairs */
      for (const t of G.tilesRaw()) {
        if (t.kind === 'wall' && t.hp < t.maxHp * 0.6) { if (G.upgrade(t.r, t.c)) { did = true; break; } }
      }
      if (did) continue;
      if (strat.upgrade !== 'never') {
        const thresh = strat.upgrade === 'aggressive' ? 4 : 3;
        let bt = null, bs = 0;
        for (const t of G.tilesRaw()) {
          if (t.kind !== 'turret' || t.lvl >= thresh) continue;
          const sc = covFor(t.r, t.c).cov / (G.turretUpCost(t.lvl) || 1);
          if (sc > bs) { bs = sc; bt = t; }
        }
        if (bt && G.upgrade(bt.r, bt.c)) { did = true; continue; }
      }
      if (!did) break;
    }
  }
  function act(strat) { spendCores(strat); spendCash(strat); }

  return {
    run(strat, opts) {
      const cap = opts.retryCap, maxLevel = opts.maxLevel;
      G.clearStorage();
      G.newRun();
      const levels = [];
      let attempts = 1, stalled = null;
      let cur = { level:1, waveLives:[] };
      refreshBoard();
      let livesAt = G.st().lives, lastWave = 1, guard = 0;
      while (guard++ < 300000) {
        G.step(1 / 30, 6);
        const s = G.st();
        if (s.state !== 'play') { stalled = s.level; break; }
        if (guard % 8 === 0) act(strat);

        if (s.wave !== lastWave) {
          cur.waveLives.push(Math.max(0, livesAt - s.lives));
          livesAt = s.lives; lastWave = s.wave;
        }
        if (s.phase === 'failed') {
          levels.push({ level:cur.level, attempt:attempts, cleared:false, waveLives:cur.waveLives, mins:+(s.levelElapsed / 60).toFixed(2) });
          if (attempts >= cap) { stalled = cur.level; break; }
          attempts++;
          cur = { level:cur.level, waveLives:[] };
          for (let i = 0; i < 200; i++) G.step(1 / 30, 1);
          refreshBoard();
          livesAt = G.st().lives; lastWave = 1;
          continue;
        }
        if (s.phase === 'levelclear') {
          levels.push({ level:cur.level, attempt:attempts, cleared:true, waveLives:cur.waveLives, mins:+(s.levelElapsed / 60).toFixed(2) });
          if (cur.level >= maxLevel) { stalled = null; break; }
          for (let i = 0; i < 180; i++) G.step(1 / 30, 1);
          const ns = G.st();
          attempts = 1;
          cur = { level:ns.level, waveLives:[] };
          refreshBoard();
          livesAt = ns.lives; lastWave = 1;
          continue;
        }
      }
      const st = G.st();
      const clearedMins = levels.filter(l => l.cleared).map(l => l.mins);
      return {
        name: strat.name, levels, stalled,
        reached: st.level, score: st.score, retries: st.retries,
        cleared: levels.filter(l => l.cleared).length,
        unspentCores: st.cores,
        turrets: st.turrets, modules: st.modules, walls: st.walls, links: st.links,
        boosters: st.boosters, combos: st.combos.length, combosFound: st.combosFound,
        minsPerLevel: clearedMins.length ? +(clearedMins.reduce((a, b) => a + b, 0) / clearedMins.length).toFixed(2) : null,
        minsRange: clearedMins.length ? [Math.min(...clearedMins), Math.max(...clearedMins)] : null,
        lab: st.lab,
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
    await page.goto(GAME, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.clear());
    if (CURVE.length === 2) await page.evaluate(c => window.__TB.setCurve(c[0], c[1]), CURVE);
    await page.evaluate(s => window.__TB.seedRandom(s), SEED);
    await page.evaluate('window.__P = ' + PLAYER);
    const t0 = Date.now();
    const res = await page.evaluate(([p, o]) => window.__P.run(p, o),
      [persona, { retryCap: RETRY_CAP, maxLevel: 8 }]);
    res.ms = Date.now() - t0;
    res.desc = persona.desc || '';
    res.errors = errs.slice(0, 2);
    results.push(res);
    await page.close();
    if (!AS_JSON) {
      const line = res.levels.map(l => l.level + (l.cleared ? '✓' : '✗')).join(' ');
      console.log(`\n${res.name.padEnd(13)} stalled@${res.stalled === null ? '--' : res.stalled}` +
        `  cleared=${res.cleared}  score=${res.score}  min/level=${res.minsPerLevel}  (${(res.ms / 1000).toFixed(0)}s)`);
      console.log('   ' + res.desc + (res.combosFound && res.combosFound.length ? '   [' + res.combosFound.join(', ') + ']' : ''));
      console.log('   ' + line);
      console.log(`   board: ${res.turrets} turrets · ${res.modules} modules · ${res.boosters} boosters · ${res.walls} walls · ${res.links} links · ${res.combos} combos` +
        (res.unspentCores > 25 ? `   ** ${res.unspentCores} CORES UNSPENT **` : ''));
      if (res.errors.length) console.log('   ERRORS ' + JSON.stringify(res.errors));
    }
  }
  await browser.close();

  if (AS_JSON) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }
  if (STRATEGY_FILE) { console.log('\n(custom strategy run — no design assertions applied)'); process.exit(0); }
  if (ONLY) process.exit(0);

  /* ---------------------- the design's difficulty claims ------------------- */
  console.log('\n--- design claims ---');
  const by = n => results.find(r => r.name === n);
  const depth = r => (r.stalled === null ? 99 : r.stalled);
  const coherent = by('coherent'), noMods = by('no-modules'), orphan = by('orphan-mods');
  const unshared = by('unshared'), noBoost = by('no-boosters');
  const allAmp = by('all-amp'), allFire = by('all-fire'), allElec = by('all-elec');
  const allBlast = by('all-blast'), allIce = by('all-ice');
  const grenadiers = by('grenadiers'), cryo = by('cryo'), chainers = by('chainers');
  const noWalls = by('no-walls'), noLab = by('no-lab'), exitCamp = by('exit-camp');

  check('a coherent grid clears the whole campaign', coherent.stalled === null, depth(coherent));

  /* The headline: this game is about the MODULES, so a board of bare turrets
     must not be a viable way to play it. */
  check('bare turrets are not a strategy — no modules stalls in the low single digits',
    depth(noMods) <= 4 && depth(noMods) < depth(coherent),
    { noModules: depth(noMods), coherent: depth(coherent) });

  /* And it is about ADJACENCY, so buying the same modules and dropping them
     where they touch nothing must be worth close to nothing. */
  check('a module that touches nothing is wasted money',
    depth(orphan) <= depth(noMods) + 1 && depth(orphan) < depth(coherent),
    { orphaned: depth(orphan), noModules: depth(noMods), coherent: depth(coherent) });

  /* A module feeds EVERY structure it touches. If refusing to share cost
     nothing, the rule would be decoration. */
  check('SHARING a module between two turrets beats bolting it to one',
    depth(unshared) < depth(coherent) || unshared.score < coherent.score * 0.85,
    { unshared: { depth: depth(unshared), score: unshared.score, links: unshared.links },
      coherent: { depth: depth(coherent), score: coherent.score, links: coherent.links } });
  check('and the shared grid really does run more links off the same board',
    coherent.links > unshared.links, { coherent: coherent.links, unshared: unshared.links });

  /* THE CD'S FIRST PRINCIPLE — "going all in on one type of mod yields
     increasing returns". Every damage type stacked four deep must be able to
     carry a run, because that is what the super-linear stack curves promise
     and what the four-of-a-kind combo rewards. */
  const damageMonos = [['FIRE', allFire], ['ELEC', allElec], ['BLAST', allBlast]];
  for (const [nm, r] of damageMonos) {
    check('all-in on ' + nm + ' carries a run — increasing returns, as promised',
      r.stalled === null, depth(r));
  }
  check('every all-in damage build finds its four-of-a-kind combo',
    damageMonos.every(([, r]) => r.combosFound.length > 0) && allAmp.combosFound.length > 0,
    { fire: allFire.combosFound, elec: allElec.combosFound,
      blast: allBlast.combosFound, amp: allAmp.combosFound });

  /* The honest counterpart: ICE deals NO damage, so committing to it alone
     cannot work however good the chill is. That is the shape of the tradeoff,
     not a bug — chill multiplies other turrets, and there are none. */
  check('all-in on ICE cannot carry a run — it is a multiplier with nothing to multiply',
    depth(allIce) <= 4 && depth(allIce) < depth(coherent),
    { allIce: depth(allIce), coherent: depth(coherent) });

  /* THE CD'S SECOND PRINCIPLE — certain COMBINATIONS are worth learning. A
     board built entirely of named combos must be competitive with the best
     stacked build, or discovery is a decoration. */
  check('a board of INCENDIARY GRENADE LAUNCHERs is a real strategy',
    grenadiers.stalled === null && grenadiers.combosFound.includes('grenade'),
    { depth: depth(grenadiers), found: grenadiers.combosFound });
  check('a board of CHAIN REACTIONs is a real strategy',
    chainers.stalled === null && chainers.combosFound.includes('chainreaction'),
    { depth: depth(chainers), found: chainers.combosFound });
  check('the best combo board is competitive with the best stacked board',
    Math.max(grenadiers.score, chainers.score) >= 0.9 * Math.max(allFire.score, allElec.score, allBlast.score),
    { combo: Math.max(grenadiers.score, chainers.score),
      stacked: Math.max(allFire.score, allElec.score, allBlast.score) });
  /* …and not every combo is good, which is what makes them worth learning
     rather than just building. CRYO SHELL chills beautifully and kills
     slowly. */
  check('but not every combo is a good one — CRYO SHELL falls short',
    depth(cryo) < depth(coherent), { cryo: depth(cryo), coherent: depth(coherent) });

  check('the diagonals are worth building on — skipping boosters costs depth or score',
    depth(noBoost) < depth(coherent) || noBoost.score < coherent.score,
    { noBoosters: { d: depth(noBoost), s: noBoost.score }, coherent: { d: depth(coherent), s: coherent.score } });
  check('walls buy real time — skipping them costs depth or score',
    depth(noWalls) < depth(coherent) || noWalls.score < coherent.score,
    { noWalls: { d: depth(noWalls), s: noWalls.score }, coherent: { d: depth(coherent), s: coherent.score } });
  check('the lab matters — never spending a core costs depth',
    depth(noLab) < depth(coherent), { noLab: depth(noLab), coherent: depth(coherent) });
  check('placement matters — camping the exit stalls before working the road',
    depth(exitCamp) < depth(coherent), { exitCamp: depth(exitCamp), coherent: depth(coherent) });

  /* -------------------------- pacing: the eight minutes ------------------- */
  console.log('\n--- pacing ---');
  const mins = coherent.minsPerLevel;
  console.log('   coherent build: ' + mins + ' min/level (range ' + JSON.stringify(coherent.minsRange) + ')');
  check('a level takes about eight minutes for a build that is winning',
    mins !== null && mins >= 6.5 && mins <= 9.5, { minsPerLevel: mins, range: coherent.minsRange });
  /* CHILL STRETCHES A LEVEL, and there is no way around it: a wave ends when
     the board is clear, so slowing everything down without killing it faster
     lengthens the tail. CRYO SHELL is the extreme case and runs about eleven
     minutes a level. That is a known, measured cost of a chill-heavy build
     rather than a bug — but it is capped here so it cannot quietly get worse. */
  const slowest = results.slice().filter(r => r.minsPerLevel !== null)
    .sort((a, b) => b.minsPerLevel - a.minsPerLevel)[0];
  console.log('   slowest build:  ' + slowest.name + ' at ' + slowest.minsPerLevel + ' min/level');
  check('even a chill-heavy build keeps a level under twelve minutes',
    slowest.minsPerLevel <= 12, { build: slowest.name, mins: slowest.minsPerLevel });

  /* Pacing inside a level: later waves should bite harder than early ones. */
  const deep = results.slice().sort((a, b) => depth(b) - depth(a))[0];
  const cleared = deep.levels.filter(l => l.cleared && l.waveLives.length >= 6);
  const sum = a => a.reduce((x, y) => x + y, 0);
  if (cleared.length) {
    const early = sum(cleared.map(l => sum(l.waveLives.slice(0, 3))));
    const late = sum(cleared.map(l => sum(l.waveLives.slice(-3))));
    check('waves bite harder later in a level than at its start', late >= early,
      { earlyLivesLost: early, lateLivesLost: late });
  } else {
    check('waves bite harder later in a level than at its start', false, 'no level cleared with full wave data');
  }

  console.log('\nTURRET-BUILDER EVAL: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  console.log('TURRET-BUILDER EVAL: ' + pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
