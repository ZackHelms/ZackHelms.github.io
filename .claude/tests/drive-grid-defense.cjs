#!/usr/bin/env node
// drive-grid-defense.cjs — gameplay drive + balance suite for games/grid-defense/.
//
// The 100-level campaign is a progression system, so the things worth gating
// are the progression rules and the difficulty ramp, not the rendering:
//   * UNLOCK SCRIPT: level 1 offers PULSE alone; the level-2/3/4 shops each
//     pay exactly enough for ONE of {new turret, upgrade a turret you own}.
//     This is the design promise "you have the choice of X or Y" — if core
//     income or a price drifts, the choice silently stops being a choice.
//   * TREE RULES: a child node refuses a point until a parent holds one;
//     capstones additionally need their tree gate; points are never created.
//   * BALANCE RAMP: a scripted, deliberately non-optimal auto-player runs the
//     campaign from level 1. It must clear the early levels comfortably, must
//     NOT coast to 100 (or the ramp is flat), and the wave HP curve must rise
//     monotonically. Prints the level it fell on so the curve can be tuned.
//   * PERSISTENCE: save -> mutate -> load restores the run; the top-10 board
//     keeps 10 entries sorted by score with a timestamp and level on each.
//   * LIFECYCLE: clearing a level cannot re-fire (the 'clear' phase latch),
//     and a between-levels auto-save reopens as a fresh level, not a stale
//     board belonging to the previous level.
//
// Run: NODE_PATH=<dir>/node_modules node .claude/tests/drive-grid-defense.cjs
// Env: GD_FULL=1 runs the auto-player all the way to level 100 (slow).
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core not resolvable (NODE_PATH).');
  console.log('GRID-DEFENSE DRIVE: 0 passed, 1 failed');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'grid-defense', 'index.html');
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const IGNORE = /fonts\.g|net::ERR|Failed to load resource/i;
const MAX_LEVEL = process.env.GD_FULL ? 100 : +(process.env.GD_LEVELS || 100);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

/* The auto-player. Deliberately a competent-but-not-optimal human stand-in:
   it places by path coverage, keeps a fixed composition, reinvests bounty
   mid-wave, and follows one pre-committed build order through the trees.   */
const AUTOPLAYER = `(() => {
  const G = window.__GD;
  const SAMPLES = 160;
  let samples = [], cells = [];
  function refreshBoard() {
    covCache = {};
    samples = G.pathSamples(SAMPLES);
    const cs = G.cellSize();
    cells = G.buildableCells().map(o => {
      const x = G.cellCx(o.c), y = G.cellCy(o.r);
      let near = Infinity;
      for (const p of samples) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < near) near = d;
      }
      return { r: o.r, c: o.c, x, y, near: near / cs };
    });
  }
  function coverage(cellObj, rangePx) {
    let n = 0;
    for (const p of samples) if (Math.hypot(p.x - cellObj.x, p.y - cellObj.y) <= rangePx) n++;
    return n / samples.length;
  }
  function rangeOf(type) {
    const S = G.S(), st = G.st();
    return G.TOWERS[type].range * G.cellSize() * (1 + 0.05 * st.armory[type].tier) * S.range;
  }
  // coverage per (type, cell) is fixed within a level — cache it, or the
  // spend loop becomes hundreds of thousands of distance checks per second
  let covCache = {};
  function covFor(type, r, c) {
    const k = type + ':' + r + ':' + c;
    if (covCache[k] === undefined) covCache[k] = coverage({ x: G.cellCx(c), y: G.cellCy(r) }, rangeOf(type));
    return covCache[k];
  }
  function valueOf(type) {
    const T = G.TOWERS[type], st = G.st();
    const dmg = T.dmg * (1 + 0.20 * st.armory[type].tier);
    const dps = dmg / T.rate;
    if (type === 'nova') return dps * 2.6;      // splash hits a pack
    if (type === 'frost') return dps + 26;      // utility floor
    return dps;
  }
  const TARGET = { pulse: 0.32, nova: 0.28, rail: 0.25, frost: 0.15 };
  function wantType(cash) {
    const st = G.st();
    const owned = Object.keys(TARGET).filter(t => st.armory[t] && st.armory[t].owned);
    const placed = G.towersRaw();
    const total = Math.max(1, placed.length);
    let best = null, bestGap = -Infinity;
    for (const t of owned) {
      const have = placed.filter(p => p.type === t).length / total;
      const gap = TARGET[t] - have;
      const cost = Math.round(G.TOWERS[t].cost * G.S().buildCost);
      if (cost > cash) continue;
      if (gap > bestGap) { bestGap = gap; best = t; }
    }
    return best;
  }
  /* Every purchase weighs the best new tower against the best upgrade on
     value-per-dollar, so the yardstick player uses both levers a human has. */
  function spend() {
    let guard = 0;
    while (guard++ < 90) {
      const st = G.st(), S = G.S();
      let bBuild = null;
      const type = wantType(st.cash);
      if (type) {
        const cost = Math.max(5, Math.round(G.TOWERS[type].cost * S.buildCost));
        let bestCell = null, bestCov = 0;
        for (const cc of cells) {
          if (cc.near > 3.2 || !G.canBuild(cc.r, cc.c)) continue;
          const cov = covFor(type, cc.r, cc.c);
          if (cov > bestCov) { bestCov = cov; bestCell = cc; }
        }
        if (bestCell && bestCov > 0.02) {
          bBuild = { kind: 'build', type, cell: bestCell, score: bestCov * valueOf(type) / cost };
        }
      }
      let bUp = null;
      for (const t of G.towersRaw()) {
        if (t.lvl >= S.maxLvl) continue;
        const cost = Math.max(5, Math.round(G.TOWERS[t.type].cost * 0.8 * t.lvl * S.upCost));
        if (cost > st.cash) continue;
        const sc = covFor(t.type, t.r, t.c) * valueOf(t.type) * 0.45 / cost;
        if (!bUp || sc > bUp.score) bUp = { kind: 'up', t, score: sc };
      }
      const pick = (bBuild && bUp) ? (bBuild.score >= bUp.score ? bBuild : bUp) : (bBuild || bUp);
      if (!pick) break;
      const ok = pick.kind === 'build'
        ? G.build(pick.type, pick.cell.r, pick.cell.c)
        : G.upgrade(pick.t.r, pick.t.c);
      if (!ok) break;
    }
  }
  // turrets arrive on their own schedule now; cores only ever buy tiers,
  // cheapest-first, and only once the armory opens at level 5
  function armory() {
    let guard = 0;
    while (guard++ < 20) {
      const s = G.st();
      const owned = ['pulse', 'rail', 'nova', 'frost'].filter(t => s.armory[t].owned);
      const next = owned
        .filter(t => s.armory[t].tier < 8)
        .sort((a, b) => s.armory[a].tier - s.armory[b].tier)[0];
      if (!next) { if (!G.research()) break; else continue; }
      if (!G.buyArmory(next)) break;
    }
  }
  const SKILL_ORDER = [
    'drill','drill','logistics','velocity','focus','drill','contracts','crit',
    'velocity','standing','prefab','drill','focus','crit','deadeye','logistics',
    'velocity','crit','fieldcmd','focus','deadeye','drill','crit','contracts',
    'armorpen','velocity','execute','armorpen','deadeye','focus','prefab','crit',
    'execute','armorpen','standing','logistics','annihilation','armorpen','execute',
    'contracts','standing','modular','retrofit','bulwark','standing','modular',
    'calibration','salvage','powergrid','foundry','marksman','marksman','marksman',
    'hypervelocity','fortify','rapid','cryo','overdrive','tactics','rapid',
  ];
  function skills() {
    let guard = 0;
    while (guard++ < 80) {
      let spent = false;
      for (const id of SKILL_ORDER) { if (G.spendSkill(id)) { spent = true; break; } }
      if (!spent) break;
    }
  }
  function playLevel(maxSteps) {
    refreshBoard();
    spend();
    G.ready();
    let steps = 0;
    while (steps < maxSteps) {
      G.step(1 / 30, 15);
      steps += 15;
      const s = G.st();
      if (s.state !== 'play') return { dead: true, level: s.level, lives: s.lives, score: s.score };
      if (s.phase === 'clear') return { cleared: true, level: s.level, lives: s.lives, score: s.score };
      if (steps % 45 === 0) spend();
    }
    return { timeout: true, level: G.st().level };
  }
  return {
    refreshBoard, spend, armory, skills, playLevel,
    campaign(maxLevel, maxSteps) {
      const log = [];
      for (let i = 0; i < maxLevel; i++) {
        const before = G.st();
        const res = playLevel(maxSteps || 4000);
        log.push({ level: before.level, lives: G.st().lives, towers: before.towers,
                   cleared: !!res.cleared, dead: !!res.dead, timeout: !!res.timeout,
                   score: G.st().score });
        if (res.dead || res.timeout) return { log, fell: before.level, dead: !!res.dead, timeout: !!res.timeout };
        armory(); skills();
        const nxt = G.st().level;
        if (nxt > 100) return { log, fell: null, won: true };
        G.startLevel(nxt);
      }
      return { log, fell: null, stopped: G.st().level };
    },
  };
})()`;

(async () => {
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + GAME, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(300);

  const G = expr => page.evaluate('(' + expr + ')(window.__GD)');
  const st = () => G('G=>G.st()');

  /* ------------------------- boot / main menu ------------------------- */
  check('boots to the main menu', (await st()).state === 'menu');
  check('main menu offers NEW RUN / LOAD / SCOREBOARD / SETTINGS',
    await page.evaluate(() => ['m-new', 'm-load', 'm-scores', 'm-set'].every(id => !!document.getElementById(id))));
  check('no CONTINUE with no save', await page.evaluate(() => !document.getElementById('m-cont')));

  await G('G=>G.newRun()');
  let s = await st();
  check('new run starts on level 1', s.level === 1, s.level);
  check('starts with 20 lives', s.lives === 20, s.lives);
  check('level 1 uses the SERPENTINE map', s.mapIdx === 0 && s.map === 'SERPENTINE', s.map);

  /* ------------------------- the unlock script ------------------------ */
  check('level 1 owns PULSE only',
    s.armory.pulse.owned && !s.armory.nova.owned && !s.armory.frost.owned && !s.armory.rail.owned, s.armory);
  check('PULSE is the green triangle',
    await page.evaluate(() => window.__GD.TOWERS.pulse.shape === 'tri' && window.__GD.TOWERS.pulse.col === '#39ff14'));
  check('NOVA is the red circle',
    await page.evaluate(() => window.__GD.TOWERS.nova.shape === 'circ' && window.__GD.TOWERS.nova.col === '#ff2244'));
  check('FROST is the blue snowflake',
    await page.evaluate(() => window.__GD.TOWERS.frost.shape === 'flake' && window.__GD.TOWERS.frost.col === '#4488ff'));
  check('RAIL is the purple spike',
    await page.evaluate(() => window.__GD.TOWERS.rail.shape === 'spike' && window.__GD.TOWERS.rail.col === '#b44fff'));
  check('level 1 grants no skill points (trees open at 5)',
    await page.evaluate(() => window.__GD.skillPtsFor(1) === 0 && window.__GD.skillPtsFor(4) === 0 && window.__GD.skillPtsFor(5) === 1));

  const coreCurve = await page.evaluate(() => [1, 2, 3, 4].map(L => window.__GD.coresFor(L)));
  check('levels 1-4 each pay exactly 2 cores', coreCurve.every(c => c === 2), coreCurve);

  // The opening is a guided introduction: one new turret per level for the
  // first four levels, handed over rather than bought, with no upgrade option
  // competing for the same cores until the trees open at level 5.
  const intro = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    const out = [];
    for (let L = 1; L <= 6; L++) {
      G.startLevel(L);
      const a = G.st().armory;
      out.push({ L, owned: Object.keys(a).filter(k => a[k].owned), cores: G.st().cores });
    }
    return out;
  });
  check('level 1 fields PULSE alone', intro[0].owned.join() === 'pulse', intro[0].owned);
  check('level 2 introduces NOVA', intro[1].owned.join() === 'pulse,nova', intro[1].owned);
  check('level 3 introduces FROST', intro[2].owned.join() === 'pulse,nova,frost', intro[2].owned);
  check('level 4 introduces RAIL', intro[3].owned.join() === 'pulse,nova,frost,rail', intro[3].owned);
  check('the arsenal is complete from level 4 on', intro[5].owned.length === 4, intro[5].owned);

  const introFree = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    G.run().cores = 7;                    // arbitrary balance, untouched by unlocks
    G.startLevel(4);
    return { cores: G.st().cores, owned: Object.keys(G.st().armory).filter(k => G.st().armory[k].owned).length };
  });
  check('turrets are introduced, never purchased — cores are not spent',
    introFree.cores === 7 && introFree.owned === 4, introFree);

  // upgrades are deferred wholesale: nothing in the armory sells before level 5
  const earlyShop = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun(); G.run().cores = 40;
    const res = {};
    for (const L of [2, 3, 4]) {
      G.startLevel(L);
      res['tier@' + L] = G.buyArmory('pulse');
      res['research@' + L] = G.research();
    }
    G.startLevel(5);
    res['tier@5'] = G.buyArmory('pulse');
    res['research@5'] = G.research();
    res.cores = G.st().cores;
    return res;
  });
  check('no armory tier can be bought on levels 2-4',
    !earlyShop['tier@2'] && !earlyShop['tier@3'] && !earlyShop['tier@4'], earlyShop);
  check('research is deferred with it', !earlyShop['research@2'] && !earlyShop['research@4'], earlyShop);
  check('both open at level 5', earlyShop['tier@5'] && earlyShop['research@5'], earlyShop);

  const banked = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    let cores = 0;
    for (let L = 1; L <= 4; L++) cores += G.coresFor(L);
    return cores;
  });
  check('the intro levels bank their cores for level 5', banked === 8, banked);

  // the promise a player actually sees: the build bar grows one card a level
  const barGrowth = [];
  for (const L of [1, 2, 3, 4]) {
    await page.evaluate(n => window.__GD.startLevel(n), L);
    await page.waitForTimeout(60);
    barGrowth.push(await page.evaluate(() => window.__GD.cardRects().map(c => c.type)));
  }
  check('the build bar gains exactly one card per intro level',
    barGrowth.map(b => b.length).join() === '1,2,3,4', barGrowth);

  /* --------------------------- skill trees ---------------------------- */
  await G('G=>G.newRun()');
  await page.evaluate(() => { window.__GD.run().sp = 60; });
  check('a child node refuses a point before its parent', !(await G('G=>G.spendSkill("crit")')));
  check('a tier-1 root accepts a point', await G('G=>G.spendSkill("drill")'));
  check('...opening its child', await G('G=>G.spendSkill("focus")'));
  check('...which opens the grandchild', await G('G=>G.spendSkill("crit")'));
  check('a capstone is gated behind 12 points in its tree',
    !(await G('G=>G.spendSkill("annihilation")')));
  const spBefore = (await st()).sp;
  await G('G=>G.spendSkill("drill")');
  check('spending a rank costs exactly its tier price', (await st()).sp === spBefore - 1, (await st()).sp);
  const ranks = await page.evaluate(() => {
    let n = 0; while (window.__GD.spendSkill('drill')) n++;
    return { rank: window.__GD.run().skills.drill, extra: n };
  });
  check('a node stops at its max rank', ranks.rank === 5, ranks);
  check('damage stats actually move with skills', await page.evaluate(() => window.__GD.S().dmgAll > 1.2));
  const abBefore = (await st()).abilities.length;
  await page.evaluate(() => { window.__GD.run().sp = 30; window.__GD.spendSkill('standing'); window.__GD.spendSkill('fieldcmd'); });
  check('FIELD COMMAND unlocks the airstrike ability',
    (await st()).abilities.includes('airstrike') && abBefore === 0, (await st()).abilities);
  const livesJump = await page.evaluate(() => {
    const before = window.__GD.st().lives;
    window.__GD.run().sp = 10;
    window.__GD.spendSkill('standing');
    return { before, after: window.__GD.st().lives, max: window.__GD.st().maxLives };
  });
  check('+max-life skills raise current lives too', livesJump.after === livesJump.before + 1, livesJump);

  /* ---------------------------- lifecycle ----------------------------- */
  await G('G=>G.newRun()');
  await page.evaluate(() => { window.__GD.setCash(100000); });
  const cellsL1 = await G('G=>G.buildableCells().slice(0,6)');
  await page.evaluate(cs => cs.forEach(c => window.__GD.build('pulse', c.r, c.c)), cellsL1);
  check('towers place on buildable cells', (await st()).towers === 6, (await st()).towers);
  check('a tower cannot be placed on the road', await page.evaluate(() => {
    for (let r = 0; r < 13; r++) for (let c = 0; c < 9; c++) if (!window.__GD.canBuild(r, c)) {
      return window.__GD.build('pulse', r, c) === false;
    }
    return false;
  }));
  await G('G=>G.ready()');
  check('READY starts the wave', (await st()).phase === 'wave');
  let guard = 0, sNow = await st();
  while (guard++ < 400 && sNow.phase === 'wave' && sNow.state === 'play') {
    await G('G=>G.step(1/30, 30)');
    sNow = await st();
  }
  check('a stacked level 1 clears', sNow.phase === 'clear', sNow);
  check('clearing advances the level counter', sNow.level === 2, sNow.level);
  const noRefire = await page.evaluate(() => {
    const before = window.__GD.run().score;
    window.__GD.step(1 / 30, 120);
    return { before, after: window.__GD.run().score };
  });
  check('the clear phase cannot re-fire and farm bonuses', noRefire.before === noRefire.after, noRefire);
  check('clearing paid cores', sNow.cores >= 2, sNow.cores);

  /* ------------------- real touch input on canvas UI ------------------- */
  // Canvas-drawn buttons keep their hitboxes in JS arrays; a branch that hides
  // the widgets but leaves stale rects swallows taps (the 2026-07-24 bug in
  // this very game). These press the real pointer path, not the action hooks.
  await G('G=>G.newRun()');
  await page.evaluate(() => window.__GD.setCash(600));
  await page.waitForTimeout(150);

  const touchDrag = (from, to) => page.evaluate(([a, b]) => {
    const cv = document.getElementById('cv');
    const send = (type, x, y) => {
      const t = new Touch({ identifier: 1, target: cv, clientX: x, clientY: y });
      cv.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t],
        changedTouches: [t],
      }));
    };
    send('touchstart', a.x, a.y);
    send('touchmove', (a.x + b.x) / 2, (a.y + b.y) / 2);
    send('touchmove', b.x, b.y);
    send('touchend', b.x, b.y);
  }, [from, to]);
  const mid = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  const cards = await page.evaluate(() => window.__GD.cardRects());
  check('level 1 draws exactly one build card (PULSE only)',
    cards.length === 1 && cards[0].type === 'pulse', cards.map(c => c.type));
  const spot = await page.evaluate(() => {
    const t = window.__GD.buildableCells().find(c => c.r > 3);
    return { r: t.r, c: t.c, x: window.__GD.cellCx(t.c), y: window.__GD.cellCy(t.r) };
  });
  const towersBefore = (await st()).towers;
  await touchDrag(mid(cards[0]), spot);
  check('dragging the card onto a cell builds a tower',
    (await st()).towers === towersBefore + 1, { before: towersBefore, after: (await st()).towers });

  // tapping the placed tower must swap the build bar for its panel, and the
  // panel's buttons must actually receive the tap
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(80);
  const panel = await page.evaluate(() => ({ p: window.__GD.panelRects(), cards: window.__GD.cardRects().length }));
  check('tapping a tower opens its panel and clears the build-bar hitboxes',
    !!panel.p.sell && panel.cards === 0, panel);
  const lvlBefore = await page.evaluate(([r, c]) => window.__GD.towersRaw().find(t => t.r === r && t.c === c).lvl, [spot.r, spot.c]);
  await page.touchscreen.tap(panel.p.up.x + panel.p.up.w / 2, panel.p.up.y + panel.p.up.h / 2);
  await page.waitForTimeout(80);
  const lvlAfter = await page.evaluate(([r, c]) => window.__GD.towersRaw().find(t => t.r === r && t.c === c).lvl, [spot.r, spot.c]);
  check('the panel UP button upgrades rather than deselecting', lvlAfter === lvlBefore + 1, { lvlBefore, lvlAfter });

  await page.touchscreen.tap(5, 400);            // tap empty space to deselect
  await page.waitForTimeout(80);
  const startBtn = await page.evaluate(() => window.__GD.actionRects().ready);
  await page.touchscreen.tap(startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2);
  await page.waitForTimeout(80);
  check('tapping START WAVE starts the wave', (await st()).phase === 'wave', (await st()).phase);

  await page.evaluate(() => document.getElementById('menu-btn').click());
  await page.waitForTimeout(150);
  check('the menu button opens the pause screen', await page.evaluate(() => !!document.getElementById('g-resume')));
  check('chrome outranks the overlay so mute stays reachable mid-run', await page.evaluate(() => {
    const z = el => +getComputedStyle(el).zIndex;
    return z(document.getElementById('mute')) > z(document.getElementById('ui'));
  }));
  check('the pause screen actually pauses the simulation', await page.evaluate(async () => {
    const a = window.__GD.st().creeps;
    window.__GD.step(1 / 30, 60);
    return window.__GD.st().creeps === a;
  }));
  await page.evaluate(() => document.getElementById('g-resume').click());
  await page.waitForTimeout(120);
  check('RESUME returns to the board',
    await page.evaluate(() => document.getElementById('ui').classList.contains('hidden')));

  /* --------------------------- persistence ---------------------------- */
  await G('G=>G.startLevel(2)');
  await page.evaluate(() => { window.__GD.run().score = 4242; window.__GD.run().cores = 7; });
  check('save writes a slot', await G('G=>G.save(1)'));
  await page.evaluate(() => { window.__GD.run().score = 9; window.__GD.run().cores = 0; });
  check('load restores it', await G('G=>G.load(1)'));
  s = await st();
  check('...with score and cores intact', s.score === 4242 && s.cores === 7, s);
  const pendingReload = await page.evaluate(() => {
    // between-levels auto-save must reopen as a fresh level, not last level's board
    window.__GD.setCash(100000);
    const cs = window.__GD.buildableCells().slice(0, 3);
    cs.forEach(c => window.__GD.build('pulse', c.r, c.c));
    const raw = JSON.parse(localStorage.getItem('gridDefense.v2.auto') || 'null');
    return raw;
  });
  check('auto-save exists during a level', pendingReload && !pendingReload.level.pending, !!pendingReload);

  /* --------------------------- scoreboard ----------------------------- */
  const board = await page.evaluate(() => {
    localStorage.removeItem('gridDefense.v2.scores');
    for (let i = 0; i < 14; i++) {
      const list = JSON.parse(localStorage.getItem('gridDefense.v2.scores') || '[]');
      list.push({ ts: Date.now() - i * 1000, level: i + 1, score: i * 100, won: false, endless: false });
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem('gridDefense.v2.scores', JSON.stringify(list.slice(0, 10)));
    }
    return JSON.parse(localStorage.getItem('gridDefense.v2.scores'));
  });
  check('scoreboard keeps exactly 10 entries', board.length === 10, board.length);
  check('scoreboard is sorted by score', board.every((e, i) => i === 0 || board[i - 1].score >= e.score));
  check('every entry carries a timestamp and a level',
    board.every(e => typeof e.ts === 'number' && e.ts > 0 && typeof e.level === 'number'));

  /* ------------------------- difficulty curve -------------------------- */
  const curve = await page.evaluate(() => {
    const out = [];
    for (let L = 1; L <= 100; L++) {
      const w = window.__GD.wave(L);
      let hp = 0;
      for (const e of w.list) hp += window.__GD.CREEPS[e.type].hp * w.hpMul * (e.elite ? 1.7 : 1);
      out.push({ L, n: w.list.length, hp: Math.round(hp), cash: window.__GD.startCashFor(L) });
    }
    return out;
  });
  check('every level has creeps', curve.every(c => c.n > 0));
  // Boss levels are deliberate spikes (the normal mix shrinks, a WARDEN lands),
  // so the ramp is monotonic within each class, not across the two.
  const normals = curve.filter(c => c.L % 10 !== 0), bosses = curve.filter(c => c.L % 10 === 0);
  check('wave HP rises on every ordinary level',
    normals.every((c, i) => i === 0 || c.hp > normals[i - 1].hp),
    normals.filter((c, i) => i > 0 && c.hp <= normals[i - 1].hp).slice(0, 3));
  check('wave HP rises on every boss level',
    bosses.every((c, i) => i === 0 || c.hp > bosses[i - 1].hp),
    bosses.filter((c, i) => i > 0 && c.hp <= bosses[i - 1].hp).slice(0, 3));
  check('every boss level spikes above the level before it',
    bosses.every(b => b.hp > curve[b.L - 2].hp),
    bosses.filter(b => b.hp <= curve[b.L - 2].hp).map(b => b.L));
  check('level 100 is far harder than level 1', curve[99].hp / curve[0].hp > 200,
    Math.round(curve[99].hp / curve[0].hp));
  check('starting cash grows with the curve', curve[99].cash > curve[0].cash * 10, curve[99].cash);
  const maps = await page.evaluate(() => {
    const seen = [];
    for (let L = 1; L <= 100; L += 10) seen.push(window.__GD.MAPS[Math.floor((L - 1) / 10) % window.__GD.MAPS.length].name);
    return seen;
  });
  check('ten distinct maps across the campaign', new Set(maps).size === 10, maps);

  /* ----------------------- auto-player campaign ------------------------ */
  await page.evaluate(() => { localStorage.clear(); });
  await G('G=>G.newRun()');
  await page.evaluate(AUTOPLAYER + '; window.__AUTO = ' + AUTOPLAYER);
  const result = await page.evaluate(n => window.__AUTO.campaign(n, 5000), MAX_LEVEL);
  const log = result.log;
  const lastLog = log[log.length - 1];
  console.log('  --  auto-player: ' + (result.won ? 'cleared all 100' : 'fell on level ' + result.fell) +
    ' · score ' + (lastLog ? lastLog.score : 0) +
    ' · towers at end ' + (lastLog ? lastLog.towers : 0));
  const sample = log.filter(l => [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].includes(l.level))
    .map(l => l.level + ':♥' + l.lives + '/' + l.towers + 't');
  console.log('  --  ' + sample.join('  '));
  check('auto-player never times out on a level', !result.timeout, result);
  check('auto-player clears the first ten levels', log.length >= 10 && log.slice(0, 10).every(l => l.cleared),
    log.slice(0, 10).map(l => l.cleared));
  check('auto-player still has most lives at level 10',
    (log[9] ? log[9].lives : 0) >= 14, log[9]);
  const firstLoss = log.find((l, i) => i > 0 && l.lives < log[i - 1].lives);
  check('the early campaign does not punish — no leaks before level 25',
    !firstLoss || firstLoss.level >= 25, firstLoss && firstLoss.level);
  check('the ramp bites — a non-optimal player does not coast to 100',
    !result.won, result.fell);
  check('...but gets deep enough that the curve is not brutal',
    (result.fell || 101) >= 55, result.fell);
  check('the end is a squeeze, not a cliff — lives bleed before the run ends',
    !!firstLoss && result.fell - firstLoss.level >= 3, { firstLoss: firstLoss && firstLoss.level, fell: result.fell });
  check('score accumulates through the run', lastLog && lastLog.score > 1000, lastLog && lastLog.score);

  check('no console/page errors during the whole suite', errors.length === 0, errors.slice(0, 4));

  await browser.close();
  console.log('GRID-DEFENSE DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  console.log('GRID-DEFENSE DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
