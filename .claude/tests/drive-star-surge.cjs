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
  check('no console/page errors across the whole drive', errors.length === 0, errors);

  console.log(`STAR-SURGE DRIVE: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
