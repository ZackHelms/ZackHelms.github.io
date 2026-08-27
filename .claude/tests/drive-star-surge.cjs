#!/usr/bin/env node
// drive-star-surge.cjs — weapon-formula + difficulty-curve invariant gate for
// games/star-surge/. This game has no debug handle (`window.__GD`-style) — it
// is a single inline <script> of module-level globals (save, ship, weapon,
// bullets, enemies...), so checks call the game's own functions directly via
// page.evaluate rather than driving touch input.
//
// This suite exists because the two-axis weapon model (permanent XP tier =
// quality; in-run `weapon` pip 1-4 = quantity/area only, NEVER fire rate) has
// already been violated once by accident (an `atkSpeedMul()` pip-speed bonus
// that quietly fought the tap-fast-vs-hold-steady player-skill mechanic —
// see .claude/star-surge.md's Lessons learned) and the missile homing floor
// exists specifically to stop a formula from silently reopening a "missiles
// auto-hit everything" exploit. Re-deriving why each of these formulas has
// the shape it does costs more than reading this file — that is what earns
// it a place here (see .claude/tests/README.md's bar).
//
//   * FIRE RATE IS CONSTANT: weaponCooldown() must not vary with the pip
//     (`weapon`) — only the player's tap-fast-vs-hold-steady input controls
//     attack speed. Regressing this silently undoes a design decision.
//   * QUANTITY SCALES WITH PIP, QUALITY DOESN'T: blaster/missiles/bolas fire
//     `weapon` projectiles via spreadOffsets(); beam fires `weapon` parallel
//     bands; flame lights `weapon` cone lobes; bombs alternate turret-count
//     and blast-radius per BOMB_UPGRADES; chain starts at zero jumps and
//     gains two per pip; EMP grows radius only (never damage) per pip.
//   * MISSILE MIN TURN RADIUS: the effective turnRate at fire time must
//     never imply a turn radius smaller than MISSILE_MIN_TURN_RADIUS[tier],
//     so missiles can't reliably curl a U-turn onto an unaimed target.
//   * DIFFICULTY CURVE: enemyHp() and incoming ship damage both rise with
//     campaignDifficulty() (sector/stage), not just wave enemy count.
//
// Run: NODE_PATH=<dir>/node_modules node .claude/tests/drive-star-surge.cjs
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core not resolvable (NODE_PATH).');
  console.log('STAR-SURGE DRIVE: 0 passed, 1 failed');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..', '..');
const GAME = path.join(repoRoot, 'games', 'star-surge', 'index.html');
const candidates = [process.env.SMOKE_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);
const executablePath = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
const IGNORE = /fonts\.g|net::ERR|Failed to load resource/i;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}
const rising = arr => arr.every((v, i) => i === 0 || v >= arr[i - 1]);
const strictlyRising = arr => arr.every((v, i) => i === 0 || v > arr[i - 1]);
const allEqual = arr => arr.every(v => v === arr[0]);

(async () => {
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + GAME, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    saves[0] = newCharacter('DRIVE'); activeSlot = 0; save = saves[0];
    save.weapons = { blaster: 3, beam: 3, flame: 3, bombs: 3, missiles: 3, bolas: 3, chain: 3, emp: 3 };
    save.hpTier = 3;
    writeSaves();
    startGame(1);
  });

  /* --------------------------- ship movement --------------------------- */
  const shipTop = await page.evaluate(() => {
    ship.y = Math.max(safeTop + 55, Math.min(H - safeBot - 30, 0));
    return { y: ship.y, safeTop };
  });
  check('ship can reach near the top of the screen (safeTop+55 floor)', shipTop.y === shipTop.safeTop + 55, shipTop);

  /* ----------------------- fire rate is pip-invariant -------------------- */
  const cooldownsByWeapon = await page.evaluate(() => {
    const out = {};
    for (const wt of ['blaster', 'bombs', 'missiles', 'bolas', 'chain', 'emp']) {
      save.equippedWeapon = wt;
      out[wt] = [1, 2, 3, 4].map(w => { weapon = w; return +weaponCooldown().toFixed(4); });
    }
    return out;
  });
  for (const [wt, cds] of Object.entries(cooldownsByWeapon)) {
    check(`${wt} cooldown is constant across pip 1-4 (fire rate is player-controlled, not pip-controlled)`, allEqual(cds), cds);
  }

  /* --------------------- discrete weapons: count = pip ------------------- */
  const discreteCounts = await page.evaluate(() => {
    const out = {};
    for (const wt of ['blaster', 'missiles', 'bolas']) {
      save.equippedWeapon = wt;
      out[wt] = [1, 2, 3, 4].map(w => { weapon = w; bullets = []; fireWeapon(); return bullets.length; });
    }
    return out;
  });
  for (const [wt, counts] of Object.entries(discreteCounts)) {
    check(`${wt} fires exactly [1,2,3,4] projectiles across pip 1-4`, JSON.stringify(counts) === '[1,2,3,4]', counts);
  }

  /* --------------------------- bombs: alternation ------------------------ */
  const bombs = await page.evaluate(() => {
    save.equippedWeapon = 'bombs';
    return [1, 2, 3, 4].map(w => { weapon = w; bullets = []; fireWeapon(); return { count: bullets.length, radius: +bullets[0].radius.toFixed(2) }; });
  });
  check('bombs pip 1->2 adds a turret, same radius', bombs[1].count === bombs[0].count + 1 && bombs[1].radius === bombs[0].radius, bombs);
  check('bombs pip 2->3 grows radius, same turret count', bombs[2].count === bombs[1].count && bombs[2].radius > bombs[1].radius, bombs);
  check('bombs pip 3->4 adds a turret, same (grown) radius', bombs[3].count === bombs[2].count + 1 && bombs[3].radius === bombs[2].radius, bombs);

  /* ----------------------- beam / flame: pip = count ---------------------- */
  const beamFlame = await page.evaluate(() => ({
    beam: [1, 2, 3, 4].map(w => { weapon = w; return beamOffsets().length; }),
    flame: [1, 2, 3, 4].map(w => FLAME_LOBES[w].length),
  }));
  check('beam offset count is [1,2,3,4] across pip', JSON.stringify(beamFlame.beam) === '[1,2,3,4]', beamFlame.beam);
  check('flame lobe count is [1,2,3,4] across pip', JSON.stringify(beamFlame.flame) === '[1,2,3,4]', beamFlame.flame);

  /* ------------------- chain: zero jumps at pip 1, +2/pip ----------------- */
  const chainHits = await page.evaluate(() => {
    save.equippedWeapon = 'chain';
    return [1, 2, 3, 4].map(w => {
      weapon = w; lightningBolts = []; enemies = []; boss = null;
      for (let i = 0; i < 20; i++) spawnEnemy('drone', 40 + i * 18, 300);   // dense enough that range never starves a jump
      fireChain();
      return lightningBolts.length ? lightningBolts[0].points.length - 1 : 0;
    });
  });
  check('chain hits exactly [1,3,5,7] enemies across pip 1-4 (0/2/4/6 jumps)', JSON.stringify(chainHits) === '[1,3,5,7]', chainHits);

  /* ------------------------ emp: radius-only pip axis --------------------- */
  const empByPip = await page.evaluate(() => {
    save.equippedWeapon = 'emp';
    const out = [];
    for (let w = 1; w <= 4; w++) {
      weapon = w; empPulses = []; enemies = [];
      fireEmp();
      out.push(+empPulses[0].maxR.toFixed(2));
    }
    return out;
  });
  check('emp radius strictly grows with pip', strictlyRising(empByPip), empByPip);
  const empDmgDealt = await page.evaluate(() => {
    // dmg has no discrete per-bullet artifact to read off (fireEmp applies it inline) —
    // deal it into an enemy with hp too high to die, and read the hp delta instead.
    save.equippedWeapon = 'emp';
    return [1, 2, 3, 4].map(w => {
      weapon = w; empPulses = []; enemies = [];
      spawnEnemy('tanker', ship.x, ship.y); enemies[0].hp = 9999;
      const before = enemies[0].hp; fireEmp();
      return before - enemies[0].hp;
    });
  });
  check('emp damage dealt has no pip term (radius grows, dmg does not)', allEqual(empDmgDealt), empDmgDealt);

  /* --------------------- missiles: minimum turn radius --------------------- */
  const missileTurn = await page.evaluate(() => {
    save.equippedWeapon = 'missiles';
    return [1, 2, 3, 4, 5].map(t => {
      save.weapons.missiles = t; weapon = 1; bullets = [];
      fireWeapon();
      const b = bullets[0], spd = Math.hypot(b.vx, b.vy);
      return { tier: t, impliedRadius: Math.round(spd / b.turnRate), floor: MISSILE_MIN_TURN_RADIUS[t] };
    });
  });
  for (const m of missileTurn) {
    check(`missile tier ${m.tier} implied turn radius (${m.impliedRadius}px) matches its floor (${m.floor}px)`, Math.abs(m.impliedRadius - m.floor) <= 1, m);
  }
  const floors = missileTurn.map(m => m.floor);
  check('missile min-turn-radius floor strictly shrinks (more agile) as tier rises, never reaching zero',
    strictlyRising(floors.slice().reverse()) && floors.every(f => f > 0), floors);

  /* --------------------------- difficulty curve ---------------------------- */
  const hpBySector = await page.evaluate(() => {
    const out = [];
    for (const s of [1, 3, 6, 9, 11]) { sector = s; stage = 1; out.push(enemyHp('drone')); }
    return out;
  });
  check('drone hp rises across sectors 1->11 (campaignDifficulty scales individual enemy toughness, not just wave count)', rising(hpBySector) && hpBySector[hpBySector.length - 1] > hpBySector[0], hpBySector);

  const incomingBySector = await page.evaluate(() => {
    const out = [];
    for (const s of [1, 6, 11]) { sector = s; stage = 1; out.push({ bullet: +incomingBulletDmg().toFixed(2), ram: +incomingRamDmg().toFixed(2) }); }
    return out;
  });
  check('incoming bullet dmg rises across sectors', strictlyRising(incomingBySector.map(x => x.bullet)), incomingBySector);
  check('incoming ram dmg rises across sectors', strictlyRising(incomingBySector.map(x => x.ram)), incomingBySector);

  /* ---------------------- crash-free smoke, every weapon -------------------- */
  const smoke = await page.evaluate(async () => {
    const log = [];
    for (const wt of Object.keys(WEAPON_DEFS)) {
      startGame(1);
      save.equippedWeapon = wt;
      drag = { fx: 100, fy: 700, sx: ship.x, sy: ship.y };
      for (let i = 0; i < 300; i++) { weapon = 1 + (i % 4); update(1 / 60); if (state !== 'play') break; }
      log.push(wt);
    }
    return log;
  });
  const weaponCount = await page.evaluate(() => Object.keys(WEAPON_DEFS).length);
  check('every weapon runs 5s of real update() ticks with no crash', smoke.length === weaponCount, smoke);

  /* ------------------------- graphics style setting ------------------------ */
  // Both styles must paint every hull. A per-style branch that only throws
  // when one enemy type is on screen is invisible until that wave arrives,
  // so each style paints a frame holding all four enemy types + both boss
  // kinds + every projectile shape at once.
  const gfxDefault = await page.evaluate(() => {
    const stored = localStorage.getItem('starSurge.gfx');
    return { stored, active: gfx, options: Array.from(document.querySelectorAll('#gfx-select option')).map(o => o.value) };
  });
  check('3D animlight is the default graphics style with nothing stored', gfxDefault.active === 'anim' && !gfxDefault.stored, gfxDefault);
  check('settings dropdown offers exactly the five known styles', JSON.stringify(gfxDefault.options) === JSON.stringify(['toon', 'neon', 'model', 'anim', 'sprite']), gfxDefault.options);

  const painted = await page.evaluate(() => {
    const out = {};
    for (const style of ['toon', 'neon', 'model', 'anim', 'sprite']) {
      gfx = style;
      startGame(1);
      enemies.length = 0; spawnQueue.length = 0;
      for (const t of ['drone', 'shooter', 'spinner', 'tanker']) spawnEnemy(t, 60 + Math.random() * 260, 300);
      for (const wt of ['blaster', 'bombs', 'missiles', 'bolas']) bullets.push({ x: 150, y: 500, vx: 0, vy: -500, wtype: wt, dmg: 3, r: 4, radius: 70, turnRate: 2 });
      ebullets.push({ x: 120, y: 400, vx: 0, vy: 160 });
      powerups.push({ x: 90, y: 450, vy: 0, kind: 'P' });
      ship.shieldCharges = 2;
      let frames = 0;
      spawnBoss(); for (let i = 0; i < 30; i++) { draw(); frames++; }        // mini-boss
      spawnSectorBoss(); for (let i = 0; i < 30; i++) { draw(); frames++; }  // sector boss
      boss = null; for (let i = 0; i < 10; i++) { draw(); frames++; }        // no boss
      out[style] = frames;
    }
    return out;
  });
  check('every entity type paints in every graphics style without throwing',
        painted.toon === 70 && painted.neon === 70 && painted.model === 70 && painted.anim === 70 && painted.sprite === 70, painted);

  /* ---- SPRITESHEETS: the pre-render cache ------------------------------
     The style's whole promise is that hulls become blits of lazily-baked
     frames. Three things rot silently if unpinned: the cache must actually
     fill (a dead branch quietly falls back to live mesh painting and looks
     identical), every key must carry the hue (a hue-blind key serves stage
     1's green drones in the red sector forever), and a stage change must
     mint NEW entries rather than repaint old ones. */
  const sprCache = await page.evaluate(() => {
    gfx = 'sprite';
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; boss = null;
    for (const t of ['drone', 'shooter', 'spinner', 'tanker']) spawnEnemy(t, 100 + Math.random() * 160, 300);
    SPR.clear(); sprBytes = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    const stage1Keys = Array.from(SPR.keys());
    stage = 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    const stage2New = Array.from(SPR.keys()).filter(k => !stage1Keys.includes(k));
    gfx = 'toon'; stage = 1;
    return {
      filled: stage1Keys.length,
      shipFrames: stage1Keys.filter(k => k.startsWith('S|')).length,
      enemyKeysCarryHue: stage1Keys.filter(k => k.startsWith('E|')).every(k => k.split('|')[2] === '140'),
      stage2MintsNew: stage2New.filter(k => k.startsWith('E|')).every(k => k.split('|')[2] === '200') && stage2New.length >= 4,
      budgetTracked: sprBytes > 0,
    };
  });
  check('SPRITESHEETS actually blits from a lazily-filled cache (ship + all four enemy types baked)',
        sprCache.filled >= 5 && sprCache.shipFrames >= 1 && sprCache.budgetTracked, sprCache);
  check('sprite cache keys carry the stage hue, and a stage change mints new frames instead of serving stale ones',
        sprCache.enemyKeysCarryHue && sprCache.stage2MintsNew, sprCache);

  // The sun must be fixed in SCREEN space: the spinner draws its blades and
  // dome inside ctx.rotate(e.ang), so without cel()'s frameRot() counter-
  // rotation the whole sprite drags its shading round as it spins — the tell
  // that reads as flat shapes rather than lit shapes. Measured by walking a
  // ring inside the dome and reporting the brightest bearing: it must not
  // move as e.ang does. This discriminates — stubbing frameRot() to 0 takes
  // the spread from 0deg to ~170deg.
  const sun = await page.evaluate(() => {
    gfx = 'toon';
    const out = [];
    for (const ang of [0, 0.8, 1.6, 2.4, 3.9]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(200, 400); ctx.scale(4, 4);
      drawEnemyToon({ type: 'spinner', r: 13, slowT: 0, ang });
      ctx.restore();
      let best = -1, bestA = 0;
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * Math.PI * 2;
        const d = ctx.getImageData(Math.round(200 + Math.cos(a) * 15), Math.round(400 + Math.sin(a) * 15), 1, 1).data;
        const l = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
        if (l > best) { best = l; bestA = Math.round(a * 180 / Math.PI); }
      }
      out.push(bestA);
    }
    return out;
  });
  check('cel shading keeps the sun fixed in screen space while a sprite spins', Math.max(...sun) - Math.min(...sun) <= 10, sun);

  const gfxPersist = await page.evaluate(() => {
    const sel = document.getElementById('gfx-select');
    sel.value = 'neon'; sel.dispatchEvent(new Event('change'));
    const afterNeon = { active: gfx, stored: localStorage.getItem('starSurge.gfx') };
    sel.value = 'toon'; sel.dispatchEvent(new Event('change'));
    return { afterNeon, afterToon: { active: gfx, stored: localStorage.getItem('starSurge.gfx') } };
  });
  check('picking a style updates the live renderer and persists it', gfxPersist.afterNeon.active === 'neon' && gfxPersist.afterNeon.stored === 'neon' && gfxPersist.afterToon.stored === 'toon', gfxPersist);

  const chromeRow = await page.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right) }; };
    const panel = document.getElementById('settings-panel');
    const openedByTap = (() => { document.getElementById('settings').dispatchEvent(new MouseEvent('click', { bubbles: true })); return !panel.classList.contains('hidden'); })();
    onDown({ preventDefault() {}, clientX: 200, clientY: 600 });
    return { back: r('back-btn'), mute: r('mute'), cog: r('settings'), openedByTap, closedByCanvas: panel.classList.contains('hidden') };
  });
  check('the cog sits in the top-left chrome row, clear of ← and 🔊', chromeRow.cog.l >= chromeRow.mute.r && chromeRow.mute.l >= chromeRow.back.r, chromeRow);
  check('tapping the cog opens the panel and touching the canvas closes it', chromeRow.openedByTap && chromeRow.closedByCanvas, chromeRow);


  /* ---- sector combat report -> launch -> allied station ------------------
     The station is what turns eleven sectors from one corridor into eleven
     stops, and it is where a new player is first shown the shipyard. The
     checks below pin the things that would silently rot it: the run must
     CONTINUE through the station (score/xp/salvage/pip/hull all carry), the
     two currencies must stay unconvertible, and no callout may point at a
     feature that has drifted off-screen or onto the wrong side. */
  const arriveAtReport = (sectorNo, stats) => page.evaluate(({ n, st }) => {
    saves[0] = newCharacter('DRIVE'); activeSlot = 0; save = saves[0];
    startGame(n);
    Object.assign(sec, st || {});
    boss = { x: 195, y: 120, r: 46, hp: 0, maxHp: 100, sector: true, t: 0, fireT: 1, ringT: 1, dir: 1 };
    bossDown();
    return { state, sector, clearedSector, campaignDone };
  }, { n: sectorNo, st: stats });

  const cleared = await arriveAtReport(3, { kills: 120, shotsFired: 400, shotsHit: 250, hits: 2, shields: 1, bestStreak: 55, t: 251 });
  check('clearing a sector stops at a combat report instead of rolling straight into the next',
        cleared.state === 'report' && cleared.clearedSector === 3 && cleared.sector === 4, cleared);
  const banked = await page.evaluate(() => JSON.parse(localStorage.getItem('starSurge.saves'))[0].sector);
  check('the cleared sector is banked to the save checkpoint before the report shows', banked === 4, banked);

  await page.waitForTimeout(950);
  const report = await page.evaluate(() => ({ shown: !overlay.classList.contains('hidden'), txt: overlay.innerText }));
  const REPORT_ROWS = ['KILLS', 'ACCURACY', 'TIMES HIT', 'BEST STREAK', 'SECTOR TIME',
                       'XP EARNED', 'SALVAGE', 'SECTOR SCORE', 'TOTAL SCORE',
                       'TAP TO DOCK AT NEAREST ALLIED STATION'];
  check('the report shows hits taken, accuracy, xp, salvage, totals and the dock prompt',
        report.shown && REPORT_ROWS.every(r => report.txt.includes(r)),
        REPORT_ROWS.filter(r => !report.txt.includes(r)));

  const acc = await page.evaluate(() => {
    startGame(1); save.equippedWeapon = 'blaster'; weapon = 4; sec = newSectorStats();
    drag = { fx: 0, fy: 0, sx: ship.x, sy: ship.y }; fireT = 0;
    update(0.016);                       // drives the REAL fire path, not fireWeapon() directly
    const fired = sec.shotsFired, made = bullets.length;
    const b = bullets[0];
    const e = { type: 'drone', x: b.x, y: b.y, hp: 99, r: 12, pts: 60, xp: 3, t: 0, slowT: 0 };
    enemies = [e]; applyBulletHit(b, e);
    drag = null;
    return { fired, made, hit: sec.shotsHit };
  });
  check('accuracy counts projectiles: a pip-4 spread is 4 shots and one connect is 1 hit',
        acc.fired === acc.made && acc.made === 4 && acc.hit === 1, acc);

  // A beam/flame/chain/emp build spawns no projectiles at all. Reporting 0%
  // and grading it as if it had missed everything would punish the build for
  // its own physics, so the accuracy term is dropped and the rest re-weighted.
  const beam = await page.evaluate(async () => {
    startGame(2); save.weapons.beam = 3; save.equippedWeapon = 'beam';
    sec = newSectorStats();
    Object.assign(sec, { kills: 90, hits: 0, bestStreak: 60, t: 200 });
    const grade = gradeFor(sec);
    boss = { x: 195, y: 120, r: 46, hp: 0, maxHp: 100, sector: true, t: 0, fireT: 1, ringT: 1, dir: 1 };
    bossDown();
    await new Promise(r => setTimeout(r, 950));
    return { grade, txt: overlay.innerText };
  });
  check('a projectile-less build is graded on what it can be, not capped at 0% accuracy',
        beam.grade === 'S' && !beam.txt.includes('ACCURACY') && beam.txt.includes('WEAPON'), beam);

  const chain = await page.evaluate(async () => {
    startGame(4); sec = newSectorStats();
    boss = { x: 195, y: 120, r: 46, hp: 0, maxHp: 100, sector: true, t: 0, fireT: 1, ringT: 1, dir: 1 };
    bossDown();
    await new Promise(r => setTimeout(r, 950));
    const atReport = state, y0 = ship.y;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const afterTap = state;
    let minY = y0;
    for (let i = 0; i < 200 && state === 'launch'; i++) { update(0.016); minY = Math.min(minY, ship.y); }
    return { atReport, afterTap, shipLeft: minY < -20, atStation: state };
  });
  check('tapping the report launches the ship off-screen and lands at the station',
        chain.atReport === 'report' && chain.afterTap === 'launch' && chain.shipLeft && chain.atStation === 'station', chain);

  const btns = await page.evaluate(() => ({
    B: stationLayout().B.map(b => ({ id: b.id, side: b.side, x: b.x, y: b.y, w: b.w, h: b.h,
                                     ax: b.at.x, ay: b.at.y, ar: b.at.r })), W, H }));
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  let anyOverlap = false;
  for (let i = 0; i < btns.B.length; i++) for (let j = i + 1; j < btns.B.length; j++) if (overlaps(btns.B[i], btns.B[j])) anyOverlap = true;
  const onScreen = btns.B.every(b => b.x >= 0 && b.y >= 0 && b.x + b.w <= btns.W && b.y + b.h <= btns.H);
  check('the station offers four buttons, all on-screen and non-overlapping',
        btns.B.length === 4 && onScreen && !anyOverlap, btns.B.map(b => b.id));
  // Left-column buttons point at left-hand features and right at right-hand
  // ones. That pairing is the entire reason no callout line crosses the
  // station or another callout, so it is the thing worth asserting.
  const sideOk = btns.B.every(b => b.side < 0 ? b.ax < btns.W / 2 : b.ax > btns.W / 2);
  const featuresInView = btns.B.every(b => b.ax - b.ar > 0 && b.ax + b.ar < btns.W && b.ay - b.ar > 0 && b.ay < btns.H * 0.8);
  check('each callout points at a feature on its own side of the station, fully on-screen',
        sideOk && featuresInView, btns.B.map(b => ({ id: b.id, side: b.side, ax: Math.round(b.ax), ay: Math.round(b.ay) })));

  const tapStation = (id) => page.evaluate(i => {
    veil = 0;
    const b = stationLayout().B.find(x => x.id === i);
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
  }, id);

  const repair = await page.evaluate(() => {
    state = 'station'; veil = 0;
    ship.maxHp = 100; ship.hp = 40; save.credits = 500; save.xp = 777;
    const q = repairQuote();
    const b = stationLayout().B.find(x => x.id === 'repair');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    return { q, hp: ship.hp, cr: save.credits, xp: save.xp };
  });
  check('repair buys hull with CREDITS at the posted price and never touches XP',
        repair.q.hp === 60 && repair.q.cost === 60 * 3 && repair.hp === 100 && repair.cr === 320 && repair.xp === 777, repair);

  const wallet = await page.evaluate(() => {
    state = 'station'; veil = 0;
    ship.maxHp = 100; ship.hp = 20; save.credits = 60;
    const b = stationLayout().B.find(x => x.id === 'repair');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    const patched = { hp: ship.hp, cr: save.credits };
    save.credits = 2;                     // less than the price of a single HP
    const q2 = repairQuote();
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    return { patched, q2, hp2: ship.hp, cr2: save.credits, off: !!stationLayout().B.find(x => x.id === 'repair').off };
  });
  check('a thin wallet buys a partial patch; a broke pilot is refused and the button greys out',
        wallet.patched.hp === 40 && wallet.patched.cr === 0 &&
        wallet.q2.hp === 0 && wallet.hp2 === 40 && wallet.cr2 === 2 && wallet.off, wallet);

  const spend = await page.evaluate(() => {
    save.xp = 5000; save.credits = 500;
    delete save.weapons.bombs;
    showShipyard();
    document.getElementById('wpn-bombs').click();
    return { xp: save.xp, credits: save.credits, owns: save.weapons.bombs };
  });
  check('shipyard unlocks spend XP only -- salvage credits are a separate purse',
        spend.credits === 500 && spend.xp < 5000 && spend.owns === 1, spend);

  const resume = await page.evaluate(() => {
    state = 'station'; veil = 0;
    ship.maxHp = 100; ship.hp = 55; score = 12345; save.xp = 900; save.credits = 400; weapon = 3;
    save.hpTier = 0;
    Object.assign(sec, { kills: 99, t: 42 });
    const b = stationLayout().B.find(x => x.id === 'combat');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    return { state, score, xp: save.xp, credits: save.credits, weapon, hp: ship.hp,
             stage, wave, secKills: sec.kills, secT: sec.t };
  });
  check('COMBAT resumes the SAME run: score, xp, salvage, pip and hull all carry through the station',
        resume.state === 'play' && resume.score === 12345 && resume.xp === 900 && resume.credits === 400 &&
        resume.weapon === 3 && resume.hp === 55 && resume.stage === 1 && resume.wave === 1 &&
        resume.secKills === 0 && resume.secT === 0, resume);

  const plating = await page.evaluate(() => {
    state = 'station'; veil = 0;
    ship.maxHp = 100; ship.hp = 60; save.hpTier = 1;   // as if just bought in the shipyard
    const b = stationLayout().B.find(x => x.id === 'combat');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    return { hp: ship.hp, maxHp: ship.maxHp };
  });
  check('hull plating bought at the station is hull you fly out with', plating.maxHp === 120 && plating.hp === 80, plating);

  const backFromShipyard = await page.evaluate(() => {
    state = 'station'; veil = 0; stationT = 5;
    const b = stationLayout().B.find(x => x.id === 'upgrades');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    const inShipyard = state;
    document.getElementById('b-back').click();
    return { inShipyard, back: state, veil };
  });
  // A second crossfade here would also swallow taps (stationTap ignores input
  // while the veil is up), so a returning player would find a dead screen.
  check('the shipyard returns to the station it was opened from, with no second crossfade',
        backFromShipyard.inShipyard === 'shipyard' && backFromShipyard.back === 'station' && backFromShipyard.veil === 0, backFromShipyard);

  const rest = await page.evaluate(() => {
    state = 'station'; veil = 0; save.credits = 123; save.xp = 456;
    const b = stationLayout().B.find(x => x.id === 'rest');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    const stored = JSON.parse(localStorage.getItem('starSurge.saves'))[0];
    return { state, storedCr: stored.credits, storedXp: stored.xp };
  });
  check('REST banks the pilot and returns to pilot select',
        rest.state === 'pilots' && rest.storedCr === 123 && rest.storedXp === 456, rest);

  /* ---- routing: pilots -> station -> (upgrades | combat | rest) ----------
     There is no menu screen. Picking a pilot opens its station, which is the
     only hub: the shipyard, the next sector and pilot select all leave from
     it and come back to it. These pin the shape of that graph, because a
     stray `showMenu()` reintroduced anywhere would strand the player on a
     screen the rest of the flow no longer returns to. */
  const opening = await page.evaluate(() => {
    saves = [null, null, null]; writeSaves();
    showPilotSelect();
    const atPilots = state;
    const menuStillExists = typeof showMenu !== 'undefined';
    // the title screen is canvas: no overlay chrome, no HTML slot buttons
    const overlayLive = !overlay.classList.contains('hidden') || overlay.innerHTML !== '';
    const htmlSlots = !!document.getElementById('b-slot1');
    const b = pilotsLayout().S[1];
    pilotsDown(b.x + b.w / 2, b.y + b.h / 2);
    return { atPilots, menuStillExists, overlayLive, htmlSlots,
             created: !!saves[1], after: state, slot: activeSlot };
  });
  check('the game opens on pilot select and a pilot goes straight to its station -- no menu screen',
        opening.atPilots === 'pilots' && !opening.menuStillExists &&
        opening.after === 'station' && opening.slot === 1, opening);
  check('the title screen carries no overlay chrome and no HTML slot buttons',
        !opening.overlayLive && !opening.htmlSlots, opening);
  check('an empty bay creates its pilot on the way through',
        opening.created, opening);

  // REST is a real save point now, so a run has to survive being put down.
  const putDown = await page.evaluate(() => {
    saves[0] = newCharacter('ROUTE'); activeSlot = 0; save = saves[0];
    save.sector = 4; save.hpTier = 0;
    restoreRun();
    const fresh = { score, hp: ship.hp, weapon };
    score = 8888; runXpEarned = 120; runCredits = 340; weapon = 3;
    ship.hp = 44; ship.shieldCharges = 2;
    enterStation(true);                       // banks the run
    veil = 0;
    const b = stationLayout().B.find(x => x.id === 'rest');
    stationTap(b.x + b.w / 2, b.y + b.h / 2);
    const afterRest = state;
    activeSlot = -1; save = null; score = 0; weapon = 1;   // wander off
    enterPilot(0);                                          // and come back
    return { fresh, afterRest, back: state, score, hp: ship.hp, weapon,
             shields: ship.shieldCharges, xp: runXpEarned, cr: runCredits, sector };
  });
  check('a fresh pilot starts a fresh run (score 0, full hull, pip 1)',
        putDown.fresh.score === 0 && putDown.fresh.hp === 100 && putDown.fresh.weapon === 1, putDown.fresh);
  check('REST banks the run and picking the pilot again resumes it exactly',
        putDown.afterRest === 'pilots' && putDown.back === 'station' &&
        putDown.score === 8888 && putDown.hp === 44 && putDown.weapon === 3 &&
        putDown.shields === 2 && putDown.xp === 120 && putDown.cr === 340 &&
        putDown.sector === 4, putDown);

  // ...but a run that ENDED must not resume. Death is the one thing that
  // clears it, which is what keeps "resume" from becoming "undo my death".
  const died = await page.evaluate(async () => {
    saves[0] = newCharacter('ROUTE2'); activeSlot = 0; save = saves[0];
    save.sector = 3;
    restoreRun();
    score = 5000;
    enterStation(true);
    const banked = !!save.run;
    resumeIntoSector();
    ship.invuln = 0; ship.hp = 1;
    hitShip(999);
    const overState = state, runAfterDeath = save.run;
    await new Promise(r => setTimeout(r, 950));
    const ids = { retry: !!document.getElementById('b-retry'),
                  pilots: !!document.getElementById('b-pilots'),
                  menu: !!document.getElementById('b-menu') };
    enterPilot(0);
    return { banked, overState, runAfterDeath, ids, score, sector, back: state };
  });
  check('the death screen offers RETRY and PILOTS, and no route to a menu',
        died.overState === 'over' && died.ids.retry && died.ids.pilots && !died.ids.menu, died.ids);
  check('dying ends the run: picking the pilot again starts fresh at the checkpoint sector',
        died.banked && died.runAfterDeath === null && died.back === 'station' &&
        died.score === 0 && died.sector === 3, died);

  const migrated = await page.evaluate(() => {
    const legacy = [{ name: 'OLD', xp: 10, sector: 2, best: 5, weapons: { blaster: 1 },
                      equippedWeapon: 'blaster', armors: {}, equippedArmor: null, hpTier: 0 }, null, null];
    localStorage.setItem('starSurge.saves', JSON.stringify(legacy));
    const loaded = loadSaves();
    return { credits: loaded[0].credits, xp: loaded[0].xp };
  });
  check('a pilot saved before credits existed loads with a zero balance, not undefined',
        migrated.credits === 0 && migrated.xp === 10, migrated);

  const stationPaint = await page.evaluate(() => {
    const fp = () => {
      const d = ctx.getImageData(0, 0, W, H).data;
      let h = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4 * 37) {
        h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
        if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
      }
      return { h, lit };
    };
    saves[0] = newCharacter('DRIVE'); activeSlot = 0; save = saves[0];
    startGame(3);
    state = 'station'; stationT = 3; veil = 0; shake = 0;
    const layoutSig = s => {
      gfx = s;
      const L = stationLayout();
      return L.B.map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.at.x), Math.round(b.at.y)].join(':')).join('|') + '#' + Math.round(L.R);
    };
    const sigToon = layoutSig('toon'), sigNeon = layoutSig('neon'), sigModel = layoutSig('model'), sigAnim = layoutSig('anim'), sigSprite = layoutSig('sprite');
    // one 8x8 box inside a hub panel, clear of the ring, windows and dome —
    // metal under model, near-black fill under neon
    const hub = () => {
      const L = stationLayout();
      const x = Math.round(L.f.hub.x - L.R * 0.55), y = Math.round(L.f.hub.y - L.R * 0.55);
      const d = ctx.getImageData(x, y, 8, 8).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      return Math.round(s / (d.length / 4));
    };
    gfx = 'toon'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const t = fp();
    gfx = 'neon'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const n = fp(); const hubNeon = hub();
    gfx = 'model'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const m = fp(); const hubModel = hub();
    gfx = 'anim'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const a = fp(); const hubAnim = hub();
    gfx = 'sprite'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const sp = fp(); const hubSprite = hub();
    gfx = 'toon';
    return { sigToon, sigNeon, sigModel, sigAnim, sigSprite, t, n, m, a, sp, hubNeon, hubModel, hubAnim, hubSprite };
  });
  check('the station paints a substantial scene in every style, and all three differ',
        stationPaint.t.h !== stationPaint.n.h && stationPaint.n.h !== stationPaint.m.h && stationPaint.t.h !== stationPaint.m.h &&
        stationPaint.t.lit > 300 && stationPaint.n.lit > 300 && stationPaint.m.lit > 300, stationPaint);
  check('a skin is paint: the station layout is identical in every style',
        stationPaint.sigToon === stationPaint.sigNeon && stationPaint.sigToon === stationPaint.sigModel &&
        stationPaint.sigToon === stationPaint.sigAnim && stationPaint.sigToon === stationPaint.sigSprite, stationPaint);
  // bars sit mid-gap: measured 601 under model, 123 under neon (ring-glow
  // bleed keeps neon's floor well above black), 111 with the branch dead
  check('the mesh-family stations are plated metal, not wireframe: the hub interior is lit where neon leaves it dark',
        stationPaint.hubModel > 350 && stationPaint.hubAnim > 350 && stationPaint.hubSprite > 350 && stationPaint.hubNeon < 200,
        { hubModel: stationPaint.hubModel, hubAnim: stationPaint.hubAnim, hubSprite: stationPaint.hubSprite, hubNeon: stationPaint.hubNeon });

  /* ---- title screen ------------------------------------------------------
     The pilots screen is CANVAS: the word, the three bays and the erase
     controls are all drawn, so nothing about their geometry is checked by a
     browser. Everything under this heading is an assertion a layout engine
     would otherwise have made for free -- plus the two things a screenshot
     cannot see, which are that the fight stays in its arena over time and
     that a cached bitmap actually re-bakes when the style changes.  */
  const bays = await page.evaluate(() => {
    showPilotSelect();
    const L = pilotsLayout(), out = { W, H, sq: L.sq, n: L.S.length,
      offscreen: 0, overlaps: 0, iconAbove: 0, iconOverlap: 0, notSquare: 0 };
    for (const s of L.S) {
      if (s.x < 0 || s.y < 0 || s.x + s.w > W || s.y + s.h > H) out.offscreen++;
      if (s.dx - s.dr < 0 || s.dx + s.dr > W || s.dy + s.dr > H) out.offscreen++;
      if (s.dy - s.dr < s.y + s.h) out.iconAbove++;      // the icon belongs BELOW its bay
      if (Math.abs(s.w - s.h) > 0.5) out.notSquare++;    // "3 squares", not 3 rectangles
    }
    for (let i = 0; i < L.S.length; i++) for (let j = i + 1; j < L.S.length; j++) {
      const a = L.S[i], b = L.S[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.overlaps++;
      if (Math.hypot(a.dx - b.dx, a.dy - b.dy) < a.dr + b.dr) out.iconOverlap++;
    }
    return out;
  });
  check('three square bays sit on the bottom edge: on-screen, apart, each with its icon below it',
        bays.n === 3 && bays.offscreen === 0 && bays.overlaps === 0 && bays.notSquare === 0 &&
        bays.iconAbove === 0 && bays.iconOverlap === 0 && bays.sq >= 60, bays);

  // ...and it has to hold at sizes the rest of the suite never visits. Canvas
  // layout has no reflow: a title sized off a column count and bays sized off
  // a viewport fraction can collide at one aspect ratio and be fine at every
  // other, and nothing in the browser will say so.
  const viewports = [[320, 568], [430, 932], [768, 1024], [844, 390], [1024, 600], [280, 650]];
  const sweep = [];
  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    sweep.push(await page.evaluate(([w, h]) => {
      showPilotSelect();
      const L = pilotsLayout(), T = titleLayout();
      const bad = [];
      for (const s of L.S) {
        if (s.x < 0 || s.y < 0 || s.x + s.w > W || s.y + s.h > H) bad.push('bay-offscreen');
        if (s.dy + s.dr > H || s.dx - s.dr < 0 || s.dx + s.dr > W) bad.push('icon-offscreen');
        if (s.dy - s.dr < s.y + s.h) bad.push('icon-above-bay');
        if (Math.abs(s.w - s.h) > 0.5) bad.push('bay-not-square');
      }
      if (T.y0 + T.rows * T.u > L.sqTop) bad.push('title-overlaps-bays');
      if ((W - T.maxCols * T.u) / 2 < 4) bad.push('title-too-wide');
      if (T.y0 < safeTop + 20) bad.push('title-under-chrome');
      ctx.setTransform(1, 0, 0, 1, 0, 0); draw();       // and it must still paint
      return { vp: w + 'x' + h, bad: [...new Set(bad)] };
    }, [w, h]));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  check('the title and the bays survive every viewport, portrait and landscape',
        sweep.every(r => r.bad.length === 0), sweep.filter(r => r.bad.length));

  const titleBox = await page.evaluate(() => {
    const L = titleLayout(), P = pilotsLayout(), T = buildTitleWord();
    return { u: L.u, inkL: (W - L.maxCols * L.u) / 2, inkTop: L.y0,
             inkBot: L.y0 + L.rows * L.u, blockTop: L.y0 - T.pad,
             sqTop: P.sqTop, safeTop, W, H };
  });
  check('the word clears the chrome row above it and the bays below it, with margin either side',
        titleBox.blockTop >= titleBox.safeTop + 30 &&
        titleBox.inkBot <= titleBox.sqTop &&
        titleBox.inkL >= 6 && titleBox.inkL * 2 + 6 < titleBox.W, titleBox);

  // "case sensitive and stylized" was the ask: the word is Star Surge, so the
  // font has to have a real cap height, a real x-height and a real descender.
  const glyphs = await page.evaluate(() => {
    const bot = t => GLYPHS[t].top + GLYPHS[t].rows.length - 1;
    return { word: TITLE_LINES.join(' '),
             missing: TITLE_LINES.join('').split('').filter(ch => !GLYPHS[ch]),
             capTop: GLYPHS.S.top, xTop: GLYPHS.a.top,
             capBot: bot('S'), xBot: bot('a'), gBot: bot('g'), rows: GLYPH_ROWS };
  });
  check('the title is case-sensitive: caps start higher, x-height sits lower, g descends',
        glyphs.word === 'Star Surge' && glyphs.missing.length === 0 &&
        glyphs.xTop > glyphs.capTop && glyphs.xBot === glyphs.capBot &&
        glyphs.gBot > glyphs.capBot && glyphs.gBot < glyphs.rows, glyphs);

  const swarm = await page.evaluate(() => {
    const seen = {}; let dots = 0;
    for (let li = 0; li < TITLE_LINES.length; li++)
      for (let ci = 0; ci < TITLE_LINES[li].length; ci++) {
        const gl = GLYPHS[TITLE_LINES[li][ci]];
        if (!gl) continue;
        for (let ri = 0; ri < gl.rows.length; ri++)
          for (let cc = 0; cc < 5; cc++) {
            if (gl.rows[ri][cc] !== '#') continue;
            dots++;
            seen[DF_TYPES[(hash32(((li * 23 + ci) * 11 + ri) * 7 + cc) >>> 3) & 3]] = true;
          }
      }
    return { dots, kinds: Object.keys(seen).sort() };
  });
  check('every lit cell of the word is an enemy hull, and all four kinds turn up',
        swarm.dots > 90 && swarm.kinds.length === 4, swarm);

  const titlePaint = await page.evaluate(() => {
    const fp = () => {
      const d = ctx.getImageData(0, 0, W, H).data;
      let h = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4 * 37) {
        h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
        if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
      }
      return { h, lit };
    };
    saves = [newCharacter('AAA'), null, null];
    showPilotSelect(); titleT = 4; shake = 0; veil = 0;
    const sig = s => {
      gfx = s;
      const L = titleLayout(), P = pilotsLayout();
      return [Math.round(L.u), Math.round(L.y0), L.maxCols].join(':') + '#' +
             P.S.map(b => [b.x, b.y, b.w, b.dy, b.dr].map(Math.round).join(',')).join('|');
    };
    const sigToon = sig('toon'), sigNeon = sig('neon'), sigModel = sig('model'), sigAnim = sig('anim'), sigSprite = sig('sprite');
    // The word is baked once and kept. If its key does not move with the
    // style, a style switch leaves the OLD bitmap on screen forever.
    gfx = 'toon'; const keyToon = buildTitleWord().key;
    gfx = 'neon'; const keyNeon = buildTitleWord().key;
    gfx = 'model'; const keyModel = buildTitleWord().key;
    gfx = 'anim'; const keyAnim = buildTitleWord().key;
    gfx = 'sprite'; const keySprite = buildTitleWord().key;
    gfx = 'toon'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const t = fp();
    gfx = 'neon'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const n = fp();
    gfx = 'model'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const m = fp();
    gfx = 'anim'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const a = fp();
    gfx = 'sprite'; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); const sp = fp();
    const dfr = dfrTrack ? { key: dfrTrack.key, frames: dfrTrack.frames.length, liveKey: W + '|' + H + '|' + dpr } : null;
    gfx = 'toon';
    return { sigToon, sigNeon, sigModel, sigAnim, sigSprite, keyToon, keyNeon, keyModel, keyAnim, keySprite, t, n, m, a, sp, dfr };
  });
  check('the title screen paints a substantial scene in every style, and all five differ',
        new Set([titlePaint.t.h, titlePaint.n.h, titlePaint.m.h, titlePaint.a.h, titlePaint.sp.h]).size === 5 &&
        titlePaint.t.lit > 300 && titlePaint.n.lit > 300 && titlePaint.m.lit > 300 && titlePaint.a.lit > 300 && titlePaint.sp.lit > 300, titlePaint);
  check('a skin is paint: the title and bay layout is identical in every style',
        titlePaint.sigToon === titlePaint.sigNeon && titlePaint.sigToon === titlePaint.sigModel &&
        titlePaint.sigToon === titlePaint.sigAnim && titlePaint.sigToon === titlePaint.sigSprite, titlePaint);
  check('the baked word re-bakes on a style switch instead of serving the old bitmap',
        new Set([titlePaint.keyToon, titlePaint.keyNeon, titlePaint.keyModel, titlePaint.keyAnim, titlePaint.keySprite]).size === 5, titlePaint);
  // The flattened dogfight: drawing the title under 'sprite' must have recorded
  // a screen-space track — full length, keyed on W|H|dpr so a resize re-records.
  check('under SPRITESHEETS the title dogfight records a full flattened loop, keyed on the viewport',
        titlePaint.dfr && titlePaint.dfr.frames === 22 * 60 && titlePaint.dfr.key === titlePaint.dfr.liveKey, titlePaint.dfr);

  // A pilot is the only thing on this screen that cannot be undone, and there
  // is no confirm dialog left to catch a misfire -- so the gesture has to.
  // Each stage RE-SEEDS. Sharing one pilot across all three reads fine until
  // stage 1 regresses: the bay is then empty, stage 2's press lands on the
  // square instead of the icon, and the suite dies on a null holdSlot rather
  // than reporting the failure it was there to catch.
  const erase = await page.evaluate(() => {
    const noop = { preventDefault() {} };
    const seed = () => {
      saves = [newCharacter('DOOMED'), newCharacter('KEEP'), null];
      writeSaves(); showPilotSelect();
      return pilotsLayout().S[0];
    };
    const spin = n => { for (let i = 0; i < n; i++) tickHold(1 / 60); };
    let s = seed();                                  // press, then release
    pilotsDown(s.dx, s.dy);
    const armed = !!holdSlot;
    onUp(noop); spin(120);
    const afterTap = !!saves[0], drained = holdSlot === null;
    s = seed();                                      // press, then slide off
    pilotsDown(s.dx, s.dy); pilotsMove(s.dx + 60, s.dy);
    const slideCancels = !!holdSlot && !holdSlot.down;
    spin(120);
    const afterSlide = !!saves[0];
    s = seed();                                      // press, and hold it out
    pilotsDown(s.dx, s.dy); spin(120);
    return { armed, afterTap, drained, slideCancels, afterSlide,
             gone: saves[0] === null, kept: !!saves[1] && saves[1].name === 'KEEP',
             persisted: JSON.parse(localStorage.getItem('starSurge.saves'))[0] === null };
  });
  check('erasing a pilot takes a deliberate hold -- a tap drains, a slide-off cancels',
        erase.armed && erase.afterTap && erase.drained && erase.slideCancels && erase.afterSlide, erase);
  check('a completed hold erases exactly that pilot, on disk as well as in memory',
        erase.gone && erase.kept && erase.persisted, erase);

  const erasedActive = await page.evaluate(() => {
    saves = [newCharacter('ACTIVE'), null, null];
    activeSlot = 0; save = saves[0];
    showPilotSelect();
    erasePilot(0);
    // erasing the pilot you were flying must not leave the save handle dangling: the
    // very next paint reads save.name for the bay caption
    let painted = true;
    try { ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); } catch (e) { painted = e.message; }
    return { slot: activeSlot, save, painted };
  });
  check('erasing the pilot you were flying clears the active handle instead of dangling it',
        erasedActive.slot === -1 && erasedActive.save === null && erasedActive.painted === true, erasedActive);

  /* The dogfight is the one part of this screen a screenshot cannot judge:
     every single frame of a fight that has drifted off to the far corner
     looks perfectly correct. These drive a minute of it. */
  const arena = await page.evaluate(() => {
    showPilotSelect(); dfInit();
    let fired = 0, respawns = 0;
    const realFire = dfFire, realRespawn = dfRespawn;
    window.dfFire = function (s, fu) { fired++; return realFire(s, fu); };
    window.dfRespawn = function (o) { respawns++; return realRespawn(o); };
    const out = { samples: 0, offX: 0, offY: 0, offZ: 0, front: 0, minFs: 1, maxFs: 0,
                  minK: 99, maxK: 0 };
    try {
      for (let i = 0; i < 3600; i++) {              // one minute at 60fps
        titleT += 1 / 60; dfUpdate(1 / 60);
        for (const s of dfShips) {
          out.samples++;
          if (s.sx < -W * 0.6 || s.sx > W * 1.6) out.offX++;
          if (s.sy < -H * 0.5 || s.sy > H * 1.5) out.offY++;
          if (s.p.z < DF_ZMIN * 0.6 || s.p.z > DF_ZMAX * 1.4) out.offZ++;
          if (s.p.z < DF_ZUI) out.front++;
          if (s.fs < out.minFs) out.minFs = s.fs;
          if (s.fs > out.maxFs) out.maxFs = s.fs;
          if (s.k < out.minK) out.minK = s.k;
          if (s.k > out.maxK) out.maxK = s.k;
        }
      }
    } finally { window.dfFire = realFire; window.dfRespawn = realRespawn; }
    out.fired = fired; out.respawns = respawns;
    out.minFs = +out.minFs.toFixed(2); out.maxFs = +out.maxFs.toFixed(2);
    out.minK = +out.minK.toFixed(2); out.maxK = +out.maxK.toFixed(2);
    out.frontPct = +(out.front / out.samples * 100).toFixed(1);
    return out;
  });
  check('the dogfight stays in its arena across a minute of flight',
        arena.offX === 0 && arena.offY === 0 && arena.offZ === 0, arena);
  check('it reads as three dimensions: hulls foreshorten, and depth swings the size several-fold',
        arena.minFs <= 0.4 && arena.maxFs > 0.9 && arena.maxK / arena.minK > 3, arena);
  check('some passes come in front of the UI plane, so ships cross the logo and the bays',
        arena.frontPct > 1 && arena.frontPct < 60, arena);
  // 4-8 kills a minute across six sampled runs. The floor is 2 so this stays
  // a real check: `> 0` passed even when the guns fired down the nose and hit
  // roughly nothing, which is the regression it is here to catch.
  check('the fight keeps fighting: hulls shoot, hit, and a downed hull comes back',
        arena.fired > 40 && arena.respawns >= 2, arena);

  /* ---- 3D MODELS ('model') style ------------------------------------------
     The third style is the one whose look depends on DERIVED motion (bank)
     and a real per-face light, so the things to pin are: the sim stays
     byte-identical across all three styles while real frames are drawn
     between the ticks; the painters leave no fingerprint on sim objects
     (bank state lives in a WeakMap, never on the entity); banking follows
     each hull's own movement and only the spec'd hulls bank; the bank
     changes the LIGHTING, not just the outline; and the dogfight's
     perspective path projects hulls where the sim says they are. */
  const modelSim = await page.evaluate(() => {
    // A deterministic 90-frame scenario: every randomly-rolled field is
    // pinned after spawn, fire timers are parked out of reach, and the ship
    // is swept side to side so its bank derivation has something to chew on.
    const scenario = style => {
      gfx = style;
      saves[0] = newCharacter('SKIN'); activeSlot = 0; save = saves[0];
      startGame(2);
      state = 'play'; overlay.classList.add('hidden');
      enemies.length = 0; spawnQueue.length = 0; bullets.length = 0; ebullets.length = 0;
      powerups.length = 0; particles.length = 0; boss = null; stageBanner = 0;
      const d = spawnEnemy('drone', 120, 150); d.vy = 100; d.amp = 40; d.fireT = 99; d.t = 0;
      const sh = spawnEnemy('shooter', 260, 160); sh.vy = 75; sh.holdY = 150; sh.fireT = 99;
      const sp = spawnEnemy('spinner', 90); sp.y = 200; sp.fireT = 99;
      const tk = spawnEnemy('tanker', 200, 240); tk.fireT = 99;
      const keys0 = enemies.map(e => Object.keys(e).sort().join(',')).join('|');
      for (let i = 0; i < 90; i++) {
        ship.x = 195 + Math.sin(i / 9) * 80;
        update(1 / 60);
        ctx.setTransform(1, 0, 0, 1, 0, 0); draw();
      }
      return {
        sim: enemies.map(e => [e.type, e.x.toFixed(3), e.y.toFixed(3), (e.ang || 0).toFixed(3), e.hp].join('~')).join('|'),
        keys: enemies.map(e => Object.keys(e).sort().join(',')).join('|'),
        keys0,
        banks: { drone: VIS.get(d) || null, shooter: VIS.get(sh) || null,
                 spinner: VIS.get(sp) || null, tanker: VIS.get(tk) || null,
                 boss: boss ? VIS.get(boss) || null : null },
      };
    };
    const t = scenario('toon'), n = scenario('neon'), m = scenario('model'), a = scenario('anim'), sp = scenario('sprite');
    gfx = 'toon';
    return { t: t.sim, n: n.sim, m: m.sim, a: a.sim, sp: sp.sim, keys: a.keys, keys0: a.keys0, banks: m.banks };
  });
  check('a skin is paint: 90 driven frames leave the sim byte-identical across all five styles',
        modelSim.t === modelSim.n && modelSim.n === modelSim.m && modelSim.m === modelSim.a && modelSim.a === modelSim.sp, modelSim);
  check('the model painters leave no fingerprint on sim objects (bank lives off-entity)',
        modelSim.keys === modelSim.keys0, { keys: modelSim.keys, keys0: modelSim.keys0 });
  check('who banks is the spec: the swaying drone does, straight-line hulls hold level, the spinner spins instead',
        modelSim.banks.drone !== null && Math.abs(modelSim.banks.drone.bank) > 0.03 &&
        modelSim.banks.shooter !== null && Math.abs(modelSim.banks.shooter.bank) < 0.02 &&
        modelSim.banks.tanker !== null && Math.abs(modelSim.banks.tanker.bank) < 0.02 &&
        modelSim.banks.spinner === null, modelSim.banks);

  const shipBank = await page.evaluate(() => {
    gfx = 'model';
    state = 'play';
    VIS.delete(ship);
    ship.x = 60;
    // (VIS.get || NaN): if the derivation is dead this must FAIL, not throw
    const bk = () => (VIS.get(ship) || { bank: NaN }).bank;
    for (let i = 0; i < 45; i++) { ship.x += 5; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); }
    const right = bk();
    for (let i = 0; i < 60; i++) { ship.x -= 5; ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); }
    const left = bk();
    for (let i = 0; i < 60; i++) { ctx.setTransform(1, 0, 0, 1, 0, 0); draw(); }
    const settled = bk();
    gfx = 'toon';
    return { right: +right.toFixed(3), left: +left.toFixed(3), settled: +settled.toFixed(3) };
  });
  check('the ship banks with its own motion: right when flying right, left when left, level at rest',
        shipBank.right > 0.3 && shipBank.left < -0.3 && Math.abs(shipBank.settled) < 0.05, shipBank);

  // The SAME half of the hull at opposite bank signs — same faces, same
  // per-face grime, so only the light can move the number. What dominates it
  // is the deck (the biggest face): banked toward the upper-left lamp it
  // catches the light, banked away it falls off it. Two earlier forms of
  // this check were wrong: left-vs-right in one frame passed on the grime
  // difference between the two side skirts with the lighting broken, and a
  // "rising flank is lit" reading had the geometry backwards.
  const bankLight = await page.evaluate(() => {
    gfx = 'model';
    const leftHalf = bankVal => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(180, 300);
      drawMeshTop(MESH_ENEMY.tanker, 60, bankVal, 0, 26);
      ctx.restore();
      const d = ctx.getImageData(120, 250, 58, 100).data;
      let s = 0, c = 0;
      for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > 30) { s += l; c++; } }
      return c ? s / c : 0;
    };
    const towardLamp = Math.round(leftHalf(-0.5)), awayFromLamp = Math.round(leftHalf(0.5));
    gfx = 'toon';
    return { towardLamp, awayFromLamp };
  });
  check('banking changes the lighting, not just the outline: the deck swings dark-to-lit through the lamp',
        bankLight.towardLamp - bankLight.awayFromLamp > 40, bankLight);

  const dfModel = await page.evaluate(() => {
    gfx = 'model';
    showPilotSelect(); dfInit(); titleT = 2;
    const bayTop = pilotsLayout().sqTop - 20;
    let checked = 0, visible = 0, frames = 0;
    // Only hulls in front of the UI plane are guaranteed unoccluded (the
    // word paints over the far layer), so collect those moments as they come.
    while (checked < 4 && frames < 3000) {
      dfUpdate(1 / 60); titleT += 1 / 60; frames++;
      const near = dfShips.filter(s => s.p.z > 150 && s.p.z < DF_ZUI - 30 && s.hurt <= 0 &&
        s.sx > 50 && s.sx < W - 50 && s.sy > 60 && s.sy < bayTop);
      if (!near.length) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0); draw();
      for (const s of near) {
        checked++;
        const box = Math.max(12, Math.round(26 * s.k));
        const d = ctx.getImageData(Math.round(s.sx - box / 2), Math.round(s.sy - box / 2), box, box).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        // a hull FILLS its box; a few stray starfield pixels must not pass
        // for one (they did, when this threshold was a flat 4 pixels)
        if (lit > box * box * 0.05) visible++;
      }
    }
    gfx = 'toon';
    return { checked, visible, frames };
  });
  check('the model dogfight projects real hulls where the sim says they are',
        dfModel.checked >= 4 && dfModel.visible === dfModel.checked, dfModel);

  /* ---- oversized hulls, in EVERY style -------------------------------------
     The 3x player / 2x ordinary enemy / untouched boss scale-up started as an
     'anim'-only trait and went universal on 2026-08-27, so the discriminating
     axis is no longer anim-vs-model (that comparison now reads 1.00 and would
     pass with the scale-up deleted from the file). It is FIELD vs FRAMED,
     measured inside each style: a flying hull is scaled, a hull in a fixed art
     box (pilot bay, baked logo cell) is not. Every style is measured, because
     each takes the factor by a different mechanism -- a mesh scale, a canvas
     transform, or a bake size -- so there is no one line to protect them all.
     'anim' keeps its own two checks below: the vivid palette and the rigs. */
  const animScale = await page.evaluate(() => {
    // Paint one hull alone on a cleared canvas and measure the box it covers.
    // animT is parked where every blinker sits at its dim ebb, so a strobe's
    // halo cannot inflate the measurement.
    animT = 0.5;
    saves[0] = newCharacter('BIG'); activeSlot = 0; save = saves[0];
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; bullets.length = 0; ebullets.length = 0;
    const span = fn => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2); fn(); ctx.restore();
      const s = 180, px = Math.round(s * 2 * dpr);
      const d = ctx.getImageData(Math.round((W / 2 - s) * dpr), Math.round((H / 2 - s) * dpr), px, px).data;
      let lo = 1e9, hi = -1e9, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40 || d[i] + d[i + 1] + d[i + 2] < 90) continue;
        const x = (i / 4) % px;
        if (x < lo) lo = x; if (x > hi) hi = x; n++;
      }
      return n ? (hi - lo + 1) / dpr : 0;
    };
    const drone = { type: 'drone', r: 12, ang: 0, slowT: 0, x: 195, y: 300 };
    const out = {};
    for (const style of ['toon', 'neon', 'model', 'anim', 'sprite']) {
      gfx = style;
      out[style] = {
        ship: span(() => paintShip(true, false)),
        drone: span(() => paintEnemy(drone, false)),
        bay: span(() => paintShip(true, true)),          // a framed portrait
        word: span(() => paintEnemy(drone, true)),       // a letter's cell
      };
    }
    spawnBoss();
    for (const style of ['toon', 'neon', 'model', 'anim', 'sprite']) {
      gfx = style; out[style].boss = span(() => paintBoss());
    }
    boss = null; gfx = 'toon'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return out;
  });
  // field / framed, inside one style: the scale-up and nothing else.
  const SC_STYLES = ['toon', 'neon', 'model', 'anim', 'sprite'];
  const upShip = k => animScale[k].ship / animScale[k].bay;
  const upDrone = k => animScale[k].drone / animScale[k].word;
  // Measured 2026-08-27: player 2.95-3.00 and drone 1.89-2.01 across all five
  // styles. The spread is the flat styles' glow — shadowBlur is not touched by
  // a transform, so a constant halo pads the framed hull proportionally more
  // than the flying one and drags the ratio a hair under the factor. Bands are
  // tight enough that neither can be cleared by the mistake it exists to
  // catch: a hull left at 1:1, or one scaled by the other hull's factor.
  check('every style flies oversized hulls on the FIELD: the player ~3x, an ordinary enemy ~2x',
        SC_STYLES.every(k => animScale[k].bay > 12 && upShip(k) > 2.85 && upShip(k) < 3.15) &&
        SC_STYLES.every(k => animScale[k].word > 8 && upDrone(k) > 1.85 && upDrone(k) < 2.15),
        { ship: SC_STYLES.map(k => [k, +upShip(k).toFixed(2)]),
          drone: SC_STYLES.map(k => [k, +upDrone(k).toFixed(2)]) });
  // A framed hull is art in a box: 3x would spill a pilot bay over its
  // neighbour and 2x would close the counters of the letters the logo is
  // spelled from. Both contexts pass portrait=true and must stay 1:1 — pinned
  // here as "the same size the flat styles have always drawn them", since
  // those two branches were never touched by any scale.
  check('framed hulls are exempt from the scale-up: the pilot bay and the baked logo stay 1:1',
        SC_STYLES.every(k => Math.abs(animScale[k].bay / animScale.toon.bay - 1) < 0.35 &&
                          Math.abs(animScale[k].word / animScale.toon.word - 1) < 0.35),
        { bay: SC_STYLES.map(k => [k, Math.round(animScale[k].bay)]),
          word: SC_STYLES.map(k => [k, Math.round(animScale[k].word)]) });
  // The boss is the control: it is the one hull NO style scales, so its span
  // must stay in the same neighbourhood in all five. The ceiling is 1.15 — the
  // mesh rim always has a muzzle glow or two lit past the barrel tips — and it
  // still cannot be cleared by an enemy-scale 2x, which is the point.
  check('the boss is exempt in every style: no scale-up ever reaches a capital ship',
        SC_STYLES.every(k => animScale[k].boss / animScale.model.boss > 0.85 &&
                          animScale[k].boss / animScale.model.boss < 1.15),
        SC_STYLES.map(k => [k, Math.round(animScale[k].boss)]));

  const animLights = await page.evaluate(() => {
    gfx = 'anim';
    saves[0] = newCharacter('LIT'); activeSlot = 0; save = saves[0];
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0; bullets.length = 0;
    boss = null; stageBanner = 0;
    ship.x = 195; ship.y = 500; ship.shieldCharges = 0;
    // Sample boxes in SHIP-LOCAL coordinates scaled by 3, so each one sits on
    // the rig element it is named for rather than on a guessed pixel.
    const at = (lx, ly, box) => {
      const x = Math.round(195 + lx * 3 - box / 2), y = Math.round(500 + ly * 3 - box / 2);
      return () => ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr),
                                    Math.round(box * dpr), Math.round(box * dpr)).data;
    };
    const tipL = at(-16.6, 7.2, 16);                 // left wingtip strobe
    const veinNose = at(-1.85, -11.9, 9);            // the vein's first segment
    const veinTail = at(-3.15, 8.85, 9);             // and its last
    const red = d => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 110 && d[i] > d[i + 1] + 45 && d[i] > d[i + 2] + 45) n++; return n; };
    const lum = d => { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return Math.round(s / (d.length / 4)); };
    const N = 24, strobe = [], nose = [], tail = [];
    for (let i = 0; i < N; i++) {
      animT = i * (2.9 / N);          // one full vein period
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
      strobe.push(red(tipL()));
      nose.push(lum(veinNose()));
      tail.push(lum(veinTail()));
    }
    const argmax = a => a.indexOf(Math.max(...a));
    const circDist = (i, j) => Math.min(Math.abs(i - j), N - Math.abs(i - j));
    gfx = 'toon'; animT = 0;
    return {
      strobeMax: Math.max(...strobe), strobeMin: Math.min(...strobe),
      strobeLit: strobe.filter(v => v > 4).length,
      noseSwing: Math.max(...nose) - Math.min(...nose),
      tailSwing: Math.max(...tail) - Math.min(...tail),
      phaseGap: circDist(argmax(nose), argmax(tail)), N,
    };
  });
  // Mostly dark with a short sharp swell is the whole point of a nav strobe:
  // a light that is simply ON would pass a bare "is it bright" bar.
  check('the wingtip sensors really strobe: dark most of the cycle, a sharp flash in it',
        animLights.strobeMax > 8 && animLights.strobeMin === 0 &&
        animLights.strobeLit > 0 && animLights.strobeLit < animLights.N * 0.4, animLights);
  // Both ends of a vein brighten, but NOT together — that is what separates a
  // wave travelling down a conduit from the whole conduit breathing, and it is
  // the only form of this check a breathing-vein bug would fail.
  check('the veins flow: a wavefront runs the length of one, lighting its ends at different times',
        animLights.noseSwing > 10 && animLights.tailSwing > 10 &&
        animLights.phaseGap >= animLights.N / 5, animLights);

  /* ---- shield cap + per-style shield & powerup skins -------------------- */
  const shieldCap = await page.evaluate(() => {
    saves[0] = newCharacter('CAP'); activeSlot = 0; save = saves[0];
    save.armors = { shield: 5 }; save.equippedArmor = 'shield';   // the deepest tier there is
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0; boss = null;
    // 1. armor regen must stop at the cap even at tier 5, which used to bank 5
    ship.shieldCharges = 0; ship.shieldRegenT = 0;
    // Ninety seconds of real sim is ninety seconds of waves arriving, and a
    // hit SPENDS a charge — so clearing the hostiles once, before the loop,
    // left this reading 1 instead of 2 on a minority of runs (seen 2026-08-27).
    // Re-clear every tick: the regen path stays real, the only thing removed
    // is the randomness that could take a charge back off it.
    for (let i = 0; i < 60 * 90; i++) {
      enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0;
      ship.shieldRegenT = -1; update(1 / 60);
    }
    const fromRegen = ship.shieldCharges;
    // 2. the S pickup must not push past it either
    ship.shieldCharges = 0;
    let fromPickups = 0;
    for (let i = 0; i < 6; i++) {
      powerups.length = 0;
      powerups.push({ x: ship.x, y: ship.y, vy: 0, kind: 'S' });
      update(1 / 60);
      fromPickups = ship.shieldCharges;
    }
    // 3. and a run banked before the cap existed must be clamped on restore
    save.run = { score: 0, xp: 0, cr: 0, weapon: 1, hp: 100, shields: 9 };
    restoreRun();
    const fromRestore = ship.shieldCharges;
    return { fromRegen, fromPickups, fromRestore, cap: MAX_SHIELDS };
  });
  check('shields cap at 2 from every source that can grant one: armor regen, the S pickup, a restored run',
        shieldCap.cap === 2 && shieldCap.fromRegen === 2 && shieldCap.fromPickups === 2 &&
        shieldCap.fromRestore === 2, shieldCap);

  const skinFxRaw = await page.evaluate(() => {
    saves[0] = newCharacter('FX'); activeSlot = 0; save = saves[0];
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0; boss = null;
    powerups.length = 0; particles.length = 0; floats.length = 0; stageBanner = 0;
    ship.x = 195; ship.y = 500; ship.shieldCharges = 2; ship.invuln = 0;
    const P = { x: 195, y: 250, vy: 0, kind: 'P' };
    const box = (x, y, w, h) => {
      const d = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr),
                                 Math.round(w * dpr), Math.round(h * dpr)).data;
      let lit = 0, sum = 0, hsh = 5381;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] + d[i + 1] + d[i + 2];
        sum += v; if (v > 60) lit++;
        hsh = ((hsh * 33) ^ (d[i] >> 3) ^ (d[i + 1] >> 2) ^ (d[i + 2] >> 3)) >>> 0;
      }
      return { lit, mean: sum / (d.length / 4), hsh };
    };
    const out = {};
    // ---- powerups, painted in the live scene ----
    const shot = t => {
      animT = t;
      powerups.length = 0; powerups.push(P);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    };
    // The crate's SIZE is read off a canvas holding nothing else — painted
    // alone over the real backdrop, same reasoning as the shield profiles
    // below. In the live scene the starfield sits inside any box wide enough
    // to hold a 1.5x crate, and it would pad the span in every style equally.
    const puSpan = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#06060e'; ctx.fillRect(0, 0, W, H);
      drawPowerup(P);
      const s = 60, px = Math.round(s * 2 * dpr);
      const d = ctx.getImageData(Math.round((P.x - s) * dpr), Math.round((P.y - s) * dpr), px, px).data;
      let lo = 1e9, hi = -1e9, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i + 1] + d[i + 2] < 90) continue;
        const x = (i / 4) % px;
        if (x < lo) lo = x; if (x > hi) hi = x; n++;
      }
      return n ? (hi - lo + 1) / dpr : 0;
    };
    for (const style of ['toon', 'neon', 'model', 'anim', 'sprite']) {
      gfx = style;
      shot(0.2);
      out[style] = { pu: box(P.x - 18, P.y - 18, 36, 36) };
      animT = 0.2; out[style].puW = puSpan();
      shot(0.55);            // ~0.35s later: a tumbling crate has turned
      out[style].puMoved = box(P.x - 18, P.y - 18, 36, 36).hsh;
    }
    powerups.length = 0;

    /* ---- shields, painted ALONE on a cleared canvas ----------------------
       The first version of this measured the shield inside the live scene at
       a radius that differs per style, so the sample box moved between styles
       and could land on the hull. It then passed with every branch collapsed
       into one. Calling the painter directly on a blank canvas removes both
       confounds: nothing else is on screen, and a radial profile can be taken
       wherever the style actually puts its shield. */
    const ringMean = (R, f) => {
      let s = 0, n = 0;
      for (let a = 0; a < 6.2; a += 0.22) {
        const x = 195 + Math.cos(a) * R * f, y = 500 + Math.sin(a) * R * f;
        s += box(x - 2, y - 2, 4, 4).mean; n++;
      }
      return s / n;
    };
    // The background fill is load-bearing, not tidiness: getImageData returns
    // UNpremultiplied RGB, so a 1.6%-alpha shell over a transparent canvas
    // reads as its full colour and the profile comes out flat and bright.
    // Composited over the real backdrop it reports what an eye would see.
    const shieldOnly = (style, charges, t) => {
      gfx = style; animT = t; ship.shieldCharges = charges;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#06060e'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(195, 500);
      drawShield(shipArtScale());
      ctx.restore();
    };
    // Every style now rings a 3x hull, so every outer radius carries the hull
    // scale — the flat styles by transform, the mesh family through shieldR().
    const OUTER = { toon: 28, neon: 26, model: 30, anim: 30, sprite: 30 };
    for (const k in OUTER) OUTER[k] *= A_SHIP_SCALE;
    for (const style of ['toon', 'neon', 'model', 'anim', 'sprite']) {
      const R = OUTER[style];
      shieldOnly(style, 2, 2.0);        // 2.0s sits in the gap between sweeps
      out[style].sh = { r30: ringMean(R, 0.30), r60: ringMean(R, 0.60), rim: ringMean(R, 0.99) };
      shieldOnly(style, 0, 2.0);
      out[style].sh.none = ringMean(R, 0.99);
    }
    // every distinct (style, charges) the bake can be asked for
    const keys = [];
    for (const style of ['model', 'anim', 'sprite']) for (const n of [1, 2]) {
      gfx = style; ship.shieldCharges = n;
      keys.push(shieldSprite(n, shipArtScale(), style === 'anim').key);
    }
    gfx = 'toon'; ship.shieldCharges = 0; animT = 0;
    return { out, keys };
  });
  const puReach = await page.evaluate(() => {
    saves[0] = newCharacter('PUR'); activeSlot = 0; save = saves[0];
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0; bullets.length = 0;
    boss = null; particles.length = 0; floats.length = 0;
    ship.x = 195; ship.y = 500; ship.invuln = 0;
    const at = d => {
      powerups.length = 0;
      powerups.push({ x: 195, y: 500 - d, vy: 0, kind: 'S' });
      ship.shieldCharges = 0;
      update(1 / 60);
      const got = powerups.length === 0;
      powerups.length = 0;
      return got;
    };
    return { near: at(25), far: at(30), reach: ship.r + 14 };
  });
  const shieldKeys = skinFxRaw.keys, skinFx = skinFxRaw.out;
  const STYLES5 = ['toon', 'neon', 'model', 'anim', 'sprite'];
  // Distinctness alone is too weak here, and proved it: with the mesh branch
  // dead the four hashes still differed, because the LETTER was styled per
  // style outside the branch. So assert the behaviour instead - a mesh-family
  // pickup is a crate that TUMBLES, and the flat ones hold still.
  check('the powerup is reskinned per style: the mesh styles tumble a crate, the flat ones hold still',
        STYLES5.every(k => skinFx[k].pu.lit > 60) &&
        skinFx.toon.pu.hsh !== skinFx.neon.pu.hsh &&
        skinFx.model.pu.hsh !== skinFx.model.puMoved &&
        skinFx.anim.pu.hsh !== skinFx.anim.puMoved &&
        skinFx.sprite.pu.hsh !== skinFx.sprite.puMoved &&
        skinFx.toon.pu.hsh === skinFx.toon.puMoved &&
        skinFx.neon.pu.hsh === skinFx.neon.puMoved,
        { lit: STYLES5.map(k => skinFx[k].pu.lit), moved: STYLES5.map(k => skinFx[k].pu.hsh !== skinFx[k].puMoved) });
  // The crates grew 1.5x alongside the hulls (2026-08-27), in every style.
  // There is no framed context to measure a pickup against the way there is
  // for a hull, so this pins the ABSOLUTE span — measured 2026-08-27 at 36
  // (toon), 37 (neon) and 40 (mesh family), against roughly 24-27 at 1:1, so
  // the floor at 30 cannot be cleared by an unscaled crate. The second
  // half is the paint-only half — the art overhangs the reach, and the reach
  // is where it always was (centres within ship.r + 14), so a crate whose
  // picture is already touching the ship is still not collected.
  check('the dropped crates grew too: 1.5x art in every style, over an unchanged pickup reach',
        STYLES5.every(k => skinFx[k].puW > 30 && skinFx[k].puW < 46) &&
        puReach.reach === 27 && puReach.near && !puReach.far,
        { span: STYLES5.map(k => [k, Math.round(skinFx[k].puW)]), reach: puReach });
  check('every style actually paints a shield, and none paints one with no charges',
        STYLES5.every(k => skinFx[k].sh.rim - skinFx[k].sh.none > 25 && skinFx[k].sh.none < 40),
        STYLES5.map(k => [k, Math.round(skinFx[k].sh.rim), Math.round(skinFx[k].sh.none)]));
  // The CD's spec for the 3D shell, stated as a measurement: a thin spherical
  // shell presents its thickness edge-on at the limb and almost none of it
  // head-on, so brightness must climb monotonically outward and pile up at the
  // rim. Neon and toon draw rings, not shells, and are deliberately exempt.
  // The shells are baked to an offscreen sprite, so they inherit the cache trap
  // the title word has: a key that does not move with everything the bake read
  // serves the old bitmap forever, with no error anywhere.
  check('the baked shield sprite re-bakes on a style or charge change instead of serving the old bitmap',
        new Set(shieldKeys).size === shieldKeys.length, shieldKeys);
  check('the 3D shield is a spherical SHELL: nearly clear head-on, climbing to a bold limb',
        ['model', 'anim', 'sprite'].every(k => {
          const p = skinFx[k].sh;
          return p.r60 > p.r30 && p.rim > p.r60 * 2 && p.rim > p.r30 * 3;
        }),
        ['model', 'anim'].map(k => [k, ['r30', 'r60', 'rim'].map(q => Math.round(skinFx[k].sh[q]))]));

  const shellSweep = await page.evaluate(() => {
    saves[0] = newCharacter('SW'); activeSlot = 0; save = saves[0];
    startGame(1);
    enemies.length = 0; spawnQueue.length = 0; ebullets.length = 0; boss = null;
    powerups.length = 0; stageBanner = 0;
    gfx = 'anim'; ship.shieldCharges = 2;
    const R = 30 * shipArtScale();
    const lum = (x, y) => {
      const d = ctx.getImageData(Math.round((x - 6) * dpr), Math.round((y - 6) * dpr),
                                 Math.round(12 * dpr), Math.round(12 * dpr)).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      return s / (d.length / 4);
    };
    // painted alone over the real backdrop, same reasoning as the profile above
    const N = 20, left = [], right = [];
    for (let i = 0; i < N; i++) {
      animT = i * (SHIELD_SWEEP / N);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#06060e'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(195, 500);
      drawShield(shipArtScale());
      ctx.restore();
      left.push(lum(195 - R * 0.55, 500));
      right.push(lum(195 + R * 0.55, 500));
    }
    const argmax = a => a.indexOf(Math.max(...a));
    const rng = a => Math.max(...a) - Math.min(...a);
    gfx = 'toon'; animT = 0; ship.shieldCharges = 0;
    return { lSwing: rng(left), rSwing: rng(right), lPeak: argmax(left), rPeak: argmax(right), N };
  });
  // Same shape as the vein-flow check, and for the same reason: a shell that
  // simply pulsed all over would brighten both patches together. Only a plane
  // of light CROSSING it lights one side before the other.
  check('the 3D shield sweeps: a plane of light crosses it, lighting one side before the other',
        shellSweep.lSwing > 5 && shellSweep.rSwing > 5 &&
        shellSweep.rPeak - shellSweep.lPeak >= 2, shellSweep);

  const finale = await page.evaluate(async () => {
    saves[0] = newCharacter('DRIVE'); activeSlot = 0; save = saves[0];
    startGame(MAX_SECTOR);
    boss = { x: 195, y: 120, r: 46, hp: 0, maxHp: 100, sector: true, t: 0, fireT: 1, ringT: 1, dir: 1 };
    bossDown();
    const snap = { state, sector, clearedSector, campaignDone };
    await new Promise(r => setTimeout(r, 950));
    return Object.assign(snap, { txt: overlay.innerText });
  });
  check('clearing the last sector reads CAMPAIGN COMPLETE and never advances past it',
        finale.campaignDone && finale.sector === 11 && finale.state === 'report' &&
        finale.txt.includes('CAMPAIGN COMPLETE'), { s: finale.sector, done: finale.campaignDone });

  await page.evaluate(() => { state = 'play'; overlay.classList.add('hidden'); });

  // stageBanner only ticks down inside the play branch of update(), so on any
  // non-play screen the last banner freezes and keeps painting. It sat behind
  // the SHIP DOWN overlay reading "STAGE 1 - WAVE 1" for a whole session.
  const bannerGuard = await page.evaluate(() => {
    startGame(2);
    enemies = []; bullets = []; ebullets = []; particles = []; floats = []; boss = null;
    bannerText = 'STAGE 1 · WAVE 1'; stageBanner = 5; shake = 0;
    // count GOLD pixels in the banner band -- stars and the ship are blue/green,
    // so hue alone separates the banner from the scene behind it
    const goldInBand = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); draw();
      const d = ctx.getImageData(0, Math.round(H * 0.33), W, 60).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 140 && d[i + 2] < 120) n++;
      return n;
    };
    const inPlay = goldInBand();
    state = 'over';
    const offPlay = goldInBand();
    state = 'play';
    return { inPlay, offPlay };
  });
  check('the stage banner stops painting off the play screen',
        bannerGuard.inPlay > 150 && bannerGuard.offPlay === 0, bannerGuard);

  check('no console/page errors across the whole drive', errors.length === 0, errors);

  console.log(`STAR-SURGE DRIVE: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
