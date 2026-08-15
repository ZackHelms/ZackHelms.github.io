#!/usr/bin/env node
// drive-grid-defense.cjs — mechanics + lifecycle gate for games/grid-defense/.
//
// This file gates RULES. Balance and pacing live in eval-grid-defense.cjs,
// which runs strategy personas over the real campaign; keeping them apart
// means a balance tweak never has to fight a mechanics regression.
//
//   * INTRO SCHEDULE: level 1 fields PULSE alone and hands over one more
//     turret per WAVE (2/3/4), with every armory purchase refused until
//     wave 5. The player-visible form is the build bar gaining a card a wave.
//   * CONTINUOUS FLOW: nothing waits on a tap. grace -> wave -> gap -> ...
//     -> levelclear -> next level runs on timers alone, ten waves to a level,
//     a new map each level, lives refilled at every level start.
//   * RETRY: running out of lives fails the LEVEL, not the run. The attempt
//     is rolled back whole — score, cores, skill points and spent skills all
//     revert to how they stood when the level opened, so a level cannot be
//     farmed for cores by dying on purpose. Endless has no retries.
//   * TREE RULES: a child refuses a point until a parent holds one; capstones
//     need their tree gate; ranks cap; points are never created.
//   * CURVE SHAPE: wave HP rises on every ordinary wave and every boss wave,
//     and each boss out-spikes the wave before it.
//   * PERSISTENCE + canvas hitboxes driven through real touch events.
//
// Run: NODE_PATH=<dir>/node_modules node .claude/tests/drive-grid-defense.cjs
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

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

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

  await G('G=>G.newRun()');
  let s = await st();
  check('new run opens level 1 wave 1', s.level === 1 && s.wave === 1 && s.gw === 1, s);
  check('starts with 20 lives', s.lives === 20, s.lives);
  check('opens in the build grace window, not waiting on a tap', s.phase === 'grace', s.phase);
  check('level 1 uses the first map', s.mapIdx === 0, s.map);

  /* ------------------------- the intro schedule ----------------------- */
  const shapes = await page.evaluate(() => {
    const T = window.__GD.TOWERS;
    return [T.pulse.shape + T.pulse.col, T.nova.shape + T.nova.col, T.frost.shape + T.frost.col, T.rail.shape + T.rail.col];
  });
  check('turret silhouettes are the spec\'d four',
    shapes.join('|') === 'tri#39ff14|circ#ff2244|flake#4488ff|spike#b44fff', shapes);

  const intro = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    const out = [];
    for (let w = 1; w <= 6; w++) {
      G.run().wave = w;
      G.startLevel(1);            // re-opens level 1; unlocks apply by wave
      G.run().wave = w;
      const a = G.st().armory;
      out.push({ w, owned: Object.keys(a).filter(k => a[k].owned) });
    }
    return out;
  });
  check('wave 1 fields PULSE alone', intro[0].owned.join() === 'pulse', intro[0].owned);


  const earlyShop = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun(); G.run().cores = 40;
    const res = {};
    for (const w of [2, 3, 4]) { G.run().wave = w; res['tier@' + w] = G.buyArmory('pulse'); }
    G.run().wave = 5;
    res['tier@5'] = G.buyArmory('pulse');
    res['research@5'] = G.research();
    return res;
  });
  check('no armory tier sells before wave 5',
    !earlyShop['tier@2'] && !earlyShop['tier@3'] && !earlyShop['tier@4'], earlyShop);
  check('tiers and research both open at wave 5',
    earlyShop['tier@5'] && earlyShop['research@5'], earlyShop);

  /* --------------------------- skill trees ---------------------------- */
  await G('G=>G.newRun()');
  await page.evaluate(() => { window.__GD.run().sp = 60; });
  check('a child node refuses a point before its parent', !(await G('G=>G.spendSkill("crit")')));
  check('a tier-1 root accepts a point', await G('G=>G.spendSkill("drill")'));
  check('...opening its child', await G('G=>G.spendSkill("focus")'));
  check('a capstone is gated behind 12 points in its tree', !(await G('G=>G.spendSkill("annihilation")')));
  const ranks = await page.evaluate(() => {
    let n = 0; while (window.__GD.spendSkill('drill')) n++;
    return window.__GD.run().skills.drill;
  });
  check('a node stops at its max rank', ranks === 5, ranks);
  check('damage stats move with skills', await page.evaluate(() => window.__GD.S().dmgAll > 1.2));

  /* ------------------------- continuous flow -------------------------- */
  const flow = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun(); G.setCash(200000);
    const seen = [];
    let last = '';
    for (let i = 0; i < 40000; i++) {
      G.step(1 / 30, 1);
      if (i % 20 === 0 && G.towersRaw().length < 26) {
        const cs = G.buildableCells();
        if (cs.length) {
          const c = cs[i % cs.length];
          G.build(['nova', 'frost', 'pulse', 'rail'][G.towersRaw().length % 4], c.r, c.c);
        }
      }
      const s = G.st();
      const key = s.level + ':' + s.wave + ':' + s.phase;
      if (key !== last) {
        const owned = Object.keys(s.armory).filter(k => s.armory[k].owned).length;
        seen.push({ level: s.level, wave: s.wave, phase: s.phase, lives: s.lives, score: s.score, cards: G.cardRects().length, owned });
        last = key;
      }
      if (s.level >= 2 && s.wave >= 2) break;
      if (s.state !== 'play') break;
    }
    return { seen, st: G.st(), map: G.st().mapIdx };
  });
  const phases = flow.seen.map(x => x.phase);
  check('the flow runs on timers with no tap: grace -> wave -> gap',
    phases[0] === 'grace' && phases[1] === 'wave' && phases.includes('gap'), phases.slice(0, 4));
  // the player-visible promise: the build bar gains a card a wave through 4
  const arsenal = flow.seen.filter(x => x.level === 1 && x.phase === 'wave').map(x => x.owned);
  check('the arsenal grows one turret per wave through wave 4, then holds at four',
    arsenal.slice(0, 6).join() === '1,2,3,4,4,4', arsenal);
  const lvl1Waves = flow.seen.filter(x => x.level === 1 && x.phase === 'wave').length;
  check('a level is ten waves', lvl1Waves === 10, lvl1Waves);
  check('clearing wave 10 rolls into the next level', phases.includes('levelclear'), phases.slice(-6));
  const lvl2 = flow.seen.find(x => x.level === 2);
  check('level 2 opens at wave 1 with lives refilled', lvl2 && lvl2.wave === 1 && lvl2.lives === 20, lvl2);
  check('level 2 loads the next map', flow.map === 1, flow.map);
  const banked = flow.seen.filter(x => x.level === 2)[0];
  check('clearing a level banks its score', banked && banked.score > 0, banked && banked.score);

  /* ------------------------------ retry ------------------------------- */
  const retry = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    G.run().score = 5000; G.run().cores = 12; G.run().sp = 6;
    G.startLevel(2);                       // snapshot is taken here
    const before = { score: G.st().score, cores: G.st().cores, sp: G.st().sp };
    G.spendSkill('drill');                 // spend DURING the attempt
    G.run().levelScore = 999; G.run().cores += 5;
    G.run().lives = 1;
    G.ready();
    for (let i = 0; i < 20000; i++) { G.step(1 / 30, 1); if (G.st().phase === 'failed') break; }
    const failedPhase = G.st().phase;
    for (let i = 0; i < 300; i++) G.step(1 / 30, 1);   // let the retry timer run
    const a = G.st();
    return { before, failedPhase,
      after: { level: a.level, wave: a.wave, lives: a.lives, score: a.score, cores: a.cores,
               sp: a.sp, retries: a.retries, levelScore: a.levelScore,
               drill: G.run().skills.drill || 0 } };
  });
  check('running out of lives fails the LEVEL, not the run', retry.failedPhase === 'failed', retry.failedPhase);
  check('the level replays from wave 1 with lives refilled',
    retry.after.level === 2 && retry.after.wave === 1 && retry.after.lives === 20, retry.after);
  check('the retry counter ticks', retry.after.retries === 1, retry.after.retries);
  check('a failed attempt banks nothing', retry.after.levelScore === 0 && retry.after.score === retry.before.score,
    { before: retry.before.score, after: retry.after.score });
  check('cores earned during the failed attempt are rolled back',
    retry.after.cores === retry.before.cores, { before: retry.before.cores, after: retry.after.cores });
  check('skill points spent during the failed attempt are refunded',
    retry.after.sp === retry.before.sp && retry.after.drill === 0, retry.after);

  const endlessDeath = await page.evaluate(() => {
    const G = window.__GD;
    G.newRun();
    G.run().endless = true;
    G.startLevel(12);
    G.run().lives = 1;
    G.ready();
    for (let i = 0; i < 20000; i++) { G.step(1 / 30, 1); if (G.st().state !== 'play') break; }
    return G.st().state;
  });
  check('endless has no retries — a breach ends the run', endlessDeath === 'dead', endlessDeath);

  /* ---------------------- canvas UI through touch --------------------- */
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
  check('wave 1 draws exactly one build card', cards.length === 1 && cards[0].type === 'pulse', cards.map(c => c.type));
  const spot = await page.evaluate(() => {
    const t = window.__GD.buildableCells().find(c => c.r > 3);
    return { r: t.r, c: t.c, x: window.__GD.cellCx(t.c), y: window.__GD.cellCy(t.r) };
  });
  const towersBefore = (await st()).towers;
  await touchDrag(mid(cards[0]), spot);
  check('dragging the card onto a cell builds a tower', (await st()).towers === towersBefore + 1,
    { before: towersBefore, after: (await st()).towers });
  /* --- tap-to-place: tap a card to arm it, tap a tile to drop it --- */
  const cards2 = await page.evaluate(() => window.__GD.cardRects());
  await page.touchscreen.tap(cards2[0].x + cards2[0].w / 2, cards2[0].y + cards2[0].h / 2);
  await page.waitForTimeout(80);
  check('tapping a build card arms that turret', (await st()).armed === 'pulse', (await st()).armed);
  const spot2 = await page.evaluate(() => {
    const t = window.__GD.buildableCells().find(c => c.r > 5);
    return { r: t.r, c: t.c, x: window.__GD.cellCx(t.c), y: window.__GD.cellCy(t.r) };
  });
  const before2 = (await st()).towers;
  await page.touchscreen.tap(spot2.x, spot2.y);
  await page.waitForTimeout(80);
  check('tapping a tile then places it there',
    (await st()).towers === before2 + 1 &&
    await page.evaluate(([r, c]) => !!window.__GD.towersRaw().find(t => t.r === r && t.c === c), [spot2.r, spot2.c]),
    { before: before2, after: (await st()).towers });
  check('placing disarms, so the next tap is not another turret', (await st()).armed === null);
  await page.touchscreen.tap(cards2[0].x + cards2[0].w / 2, cards2[0].y + cards2[0].h / 2);
  await page.waitForTimeout(60);
  await page.touchscreen.tap(cards2[0].x + cards2[0].w / 2, cards2[0].y + cards2[0].h / 2);
  await page.waitForTimeout(60);
  check('tapping the armed card again puts it away', (await st()).armed === null);
  await page.touchscreen.tap(cards2[0].x + cards2[0].w / 2, cards2[0].y + cards2[0].h / 2);
  await page.waitForTimeout(60);
  const onRoad = await page.evaluate(() => {
    for (let r = 0; r < 13; r++) for (let c = 0; c < 9; c++) {
      if (!window.__GD.canBuild(r, c) && !window.__GD.towersRaw().find(t => t.r === r && t.c === c)) {
        return { x: window.__GD.cellCx(c), y: window.__GD.cellCy(r) };
      }
    }
    return null;
  });
  const beforeRoad = (await st()).towers;
  await page.touchscreen.tap(onRoad.x, onRoad.y);
  await page.waitForTimeout(60);
  check('tapping the road refuses the placement but stays armed',
    (await st()).towers === beforeRoad && (await st()).armed === 'pulse', await st());
  await page.touchscreen.tap(spot2.x, spot2.y);
  await page.waitForTimeout(60);
  check('tapping an occupied tile inspects that tower instead of denying',
    (await st()).armed === null);

  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(80);
  const panel = await page.evaluate(() => ({ p: window.__GD.panelRects(), cards: window.__GD.cardRects().length }));
  check('tapping a tower opens its panel and clears the build-bar hitboxes',
    !!panel.p.sell && panel.cards === 0, panel);
  check('the action row publishes NO start-wave hitbox any more',
    await page.evaluate(() => !window.__GD.actionRects().ready));
  await page.touchscreen.tap(5, 400);
  await page.waitForTimeout(60);
  const armoryBtn = await page.evaluate(() => window.__GD.actionRects().armory);
  await page.touchscreen.tap(armoryBtn.x + armoryBtn.w / 2, armoryBtn.y + armoryBtn.h / 2);
  await page.waitForTimeout(150);
  check('the armory opens mid-level from the HUD', await page.evaluate(() => !!document.getElementById('a-go')));
  check('...and pauses the simulation while open', await page.evaluate(() => {
    const a = window.__GD.st().gw + ':' + window.__GD.st().phase;
    window.__GD.step(1 / 30, 200);
    return window.__GD.st().gw + ':' + window.__GD.st().phase === a;
  }));
  await page.evaluate(() => document.getElementById('a-go').click());
  await page.waitForTimeout(120);
  check('RESUME returns to the board',
    await page.evaluate(() => document.getElementById('ui').classList.contains('hidden')));
  check('chrome outranks the overlay so mute stays reachable', await page.evaluate(() => {
    const z = el => +getComputedStyle(el).zIndex;
    return z(document.getElementById('mute')) > z(document.getElementById('ui'));
  }));

  /* --------------------------- persistence ---------------------------- */
  await page.evaluate(() => { const G = window.__GD; G.startLevel(3); G.run().score = 4242; G.run().cores = 7; });
  check('save writes a slot', await G('G=>G.save(1)'));
  await page.evaluate(() => { window.__GD.run().score = 9; window.__GD.run().cores = 0; });
  check('load restores it', await G('G=>G.load(1)'));
  s = await st();
  check('...with score, cores and level intact', s.score === 4242 && s.cores === 7 && s.level === 3, s);

  /* --------------------------- scoreboard ----------------------------- */
  const board = await page.evaluate(() => {
    localStorage.removeItem('gridDefense.v3.scores');
    for (let i = 0; i < 14; i++) {
      const list = JSON.parse(localStorage.getItem('gridDefense.v3.scores') || '[]');
      list.push({ ts: Date.now() - i * 1000, level: i + 1, score: i * 100, retries: i, won: false });
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem('gridDefense.v3.scores', JSON.stringify(list.slice(0, 10)));
    }
    return JSON.parse(localStorage.getItem('gridDefense.v3.scores'));
  });
  check('scoreboard keeps exactly 10 entries', board.length === 10, board.length);
  check('scoreboard is sorted by score', board.every((e, i) => i === 0 || board[i - 1].score >= e.score));
  check('every entry carries a timestamp, level and retry count',
    board.every(e => typeof e.ts === 'number' && typeof e.level === 'number' && typeof e.retries === 'number'));

  /* ------------------------- difficulty curve -------------------------- */
  const curve = await page.evaluate(() => {
    const out = [];
    for (let gw = 1; gw <= 100; gw++) {
      const w = window.__GD.wave(gw);
      let hp = 0;
      for (const e of w.list) hp += window.__GD.CREEPS[e.type].hp * w.hpMul * (e.elite ? 1.7 : 1);
      out.push({ gw, n: w.list.length, hp: Math.round(hp), boss: window.__GD.isBossWave(gw) });
    }
    return out;
  });
  const hp = gw => curve[gw - 1].hp;
  check('every wave has creeps', curve.every(c => c.n > 0));
  // The pacing the CD asked for, stated three ways:
  let risesInLevel = [], opensEasier = [], levelHarder = [];
  for (let L = 1; L <= 10; L++) {
    const base = (L - 1) * 10;
    for (let w = 2; w <= 10; w++) if (hp(base + w) <= hp(base + w - 1)) risesInLevel.push(base + w);
    if (L > 1) {
      if (hp(base + 1) >= hp(base)) opensEasier.push(L);            // vs the boss it follows
      if (hp(base + 1) <= hp(base - 9)) levelHarder.push(L);        // vs the level before it
    }
  }
  check('waves harden across every level, up to the boss', risesInLevel.length === 0, risesInLevel.slice(0, 4));
  check('each level opens EASIER than the boss it follows', opensEasier.length === 0, opensEasier);
  check('...but harder than the level before it opened', levelHarder.length === 0, levelHarder);
  check('the boss is a spike over its own level\'s wave 9',
    [1,2,3,4,5,6,7,8,9,10].every(L => hp(L * 10) > hp(L * 10 - 1)));
  check('the campaign ends far harder than it starts', hp(100) / hp(1) > 200, Math.round(hp(100) / hp(1)));
  check('ten levels map to ten distinct maps', await page.evaluate(() => {
    const seen = new Set();
    for (let L = 1; L <= 10; L++) seen.add(window.__GD.MAPS[(L - 1) % window.__GD.MAPS.length].name);
    return seen.size === 10;
  }));

  check('no console/page errors during the whole suite', errors.length === 0, errors.slice(0, 4));

  await browser.close();
  console.log('GRID-DEFENSE DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  console.log('GRID-DEFENSE DRIVE: ' + pass + ' passed, ' + (fail + 1) + ' failed');
  process.exit(1);
});
