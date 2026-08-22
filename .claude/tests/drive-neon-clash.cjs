#!/usr/bin/env node
/**
 * drive-neon-clash.cjs — rules + design-invariant suite for games/neon-clash/.
 *
 * The checks that matter here are the ones a refactor would quietly break:
 *   - the rotated top tray, and TWO fingers deploying at the same time
 *   - the deploy contract (own half only, pay or fail, caps)
 *   - "the bunker protects its garrison" — untargetable inside, EJECTED ALIVE
 *     when the building dies (the spec's whole reason for the card)
 *   - the stat shape the design asks for (tank walls, fighter rushes, archer reaches)
 *   - energy: 1/sec, cap 20, doubled in sudden death
 *
 * Usage: NODE_PATH=<playwright-core dir> node .claude/tests/drive-neon-clash.cjs
 * Output: one PASS/FAIL line per check, then `... DRIVE: N passed, M failed`.
 */
'use strict';
const path = require('path');
const fs = require('fs');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) { console.error('needs playwright-core resolvable (NODE_PATH=...)'); process.exit(1); }
const EXE = process.env.SMOKE_CHROMIUM ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'games', 'neon-clash', 'index.html');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  ' + extra : '')); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/font|net::/i.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(450);

  // ---- geometry: recompute the tray layout the game uses, so the touch
  // ---- points below land on real cards rather than on faith.
  const geo = await page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  const trayH = Math.min(96, Math.max(62, Math.round(geo.h * 0.125)));
  const barH = 13;
  const cardH = Math.max(38, trayH - barH - 12);
  const gap = Math.max(5, Math.round(geo.w * 0.016));
  const cardW = Math.min(Math.round((geo.w - gap * 5) / 4), Math.round(cardH * 0.92));
  const x0 = geo.left + (geo.w - (cardW * 4 + gap * 3)) / 2;
  const slotX = i => x0 + i * (cardW + gap) + cardW / 2;
  const botCardY = geo.top + geo.h - trayH + barH + 6 + cardH / 2;
  const topCardY = geo.top + trayH - barH - 6 - cardH / 2;
  const boardY = f => geo.top + trayH + (geo.h - 2 * trayH) * f;
  const DECK = ['tank', 'archer', 'fighter', 'bunker'];
  // side 0 tray is in deck order; side 1 is mirrored only when it is flipped
  const botSlot = k => slotX(DECK.indexOf(k));
  const topSlot = (k, flipped) => slotX(flipped ? 3 - DECK.indexOf(k) : DECK.indexOf(k));

  const drag = (moves) => page.evaluate(ms => {
    const cv = document.getElementById('game');
    const send = (type, pts) => {
      const touches = pts.map(p => new Touch({ identifier: p.id, target: cv, clientX: p.x, clientY: p.y }));
      cv.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : touches,
        targetTouches: type === 'touchend' ? [] : touches,
        changedTouches: touches, bubbles: true, cancelable: true,
      }));
    };
    for (const m of ms) send(m.type, m.pts);
  }, moves);

  // =================================================================== flow
  await page.click('#db-PRO');
  await page.waitForTimeout(250);
  ok('difficulty button starts a match', await page.evaluate(() => __NC.state === 'play'));

  // ============================================== a real touch drag deploys
  await page.evaluate(() => __NC.setEnergy(0, 20));
  const n0 = await page.evaluate(() => __NC.units.length);
  await drag([
    { type: 'touchstart', pts: [{ id: 1, x: botSlot('fighter'), y: botCardY }] },
    { type: 'touchmove', pts: [{ id: 1, x: geo.left + geo.w / 2, y: boardY(0.75) }] },
    { type: 'touchend', pts: [{ id: 1, x: geo.left + geo.w / 2, y: boardY(0.75) }] },
  ]);
  await page.waitForTimeout(100);
  const drop = await page.evaluate(() => ({ n: __NC.units.length, e: __NC.energy[0], keys: __NC.units.map(u => u.key) }));
  ok('touch drag from the tray deploys that card', drop.n === n0 + 1 && drop.keys.includes('fighter'), JSON.stringify(drop));
  ok('deploying charges the card cost', near(drop.e, 17, 0.6), 'e=' + drop.e.toFixed(2));

  // ==================================================== the deploy contract
  const contract = await page.evaluate(() => {
    const out = {};
    __NC.setEnergy(0, 2); out.broke = __NC.deploy(0, 'tank', 50, 130);
    __NC.setEnergy(0, 20); out.enemyHalf = __NC.deploy(0, 'tank', 50, 30);
    __NC.setEnergy(0, 20); out.legal = __NC.deploy(0, 'tank', 50, 130);
    __NC.setEnergy(1, 20); out.p2EnemyHalf = __NC.deploy(1, 'tank', 50, 130);
    __NC.setEnergy(1, 20); out.p2Legal = __NC.deploy(1, 'tank', 50, 30);
    __NC.setEnergy(0, 3); const before = __NC.energy[0];
    __NC.deploy(0, 'tank', 50, 130);                 // refused: costs 4
    out.noCharge = __NC.energy[0] === before;
    return out;
  });
  ok('a deploy you cannot afford is refused', contract.broke === false);
  ok('a refused deploy costs nothing', contract.noCharge === true);
  ok('deploying on the enemy half is refused', contract.enemyHalf === false);
  ok('a legal deploy succeeds', contract.legal === true);
  ok('the rule is symmetric — side 1 cannot deploy on side 0', contract.p2EnemyHalf === false);
  ok('side 1 can deploy on its own half', contract.p2Legal === true);
  const clampCheck = await page.evaluate(() => {
    __NC.start('2p'); __NC.setEnergy(0, 20);
    __NC.deploy(0, 'fighter', 50, 80.5);             // finger right on the halfway line
    const u = __NC.units.filter(x => x.side === 0).pop();
    return u ? u.y : null;
  });
  ok('a drop at the halfway line clamps into your own half', clampCheck !== null && clampCheck >= 80, 'y=' + clampCheck);

  // ================================================== the stat shape spec'd
  const stats = await page.evaluate(() => {
    __NC.start('2p');
    const out = {};
    for (const k of ['tank', 'archer', 'fighter']) {
      __NC.setEnergy(0, 20);
      __NC.deploy(0, k, 20 + Math.random() * 60, 140);
      const u = __NC.units.filter(x => x.key === k).pop();
      out[k] = { cost: u.k.cost, hp: u.k.hp, dps: u.k.dmg * u.k.rate, rate: u.k.rate, range: u.k.range, speed: u.k.speed };
    }
    return out;
  });
  ok('tank costs 4, archer/fighter 3', stats.tank.cost === 4 && stats.archer.cost === 3 && stats.fighter.cost === 3, JSON.stringify(stats));
  ok('tank has the most HP and the least damage',
     stats.tank.hp > stats.fighter.hp && stats.fighter.hp > stats.archer.hp &&
     stats.tank.dps < stats.archer.dps && stats.tank.dps < stats.fighter.dps, JSON.stringify(stats));
  ok('fighter has the fastest attacks and the fastest legs',
     stats.fighter.rate > stats.tank.rate && stats.fighter.rate > stats.archer.rate &&
     stats.fighter.speed > stats.tank.speed && stats.fighter.speed > stats.archer.speed, JSON.stringify(stats));
  ok('archer out-ranges everything by a wide margin',
     stats.archer.range > stats.tank.range * 3 && stats.archer.range > stats.fighter.range * 3, JSON.stringify(stats));

  // ============================================================ the bunker
  const caps = await page.evaluate(() => {
    __NC.start('2p');
    const out = {};
    __NC.setEnergy(0, 20); out.b1 = __NC.deploy(0, 'bunker', 28, 118);
    __NC.setEnergy(0, 20); out.b2 = __NC.deploy(0, 'bunker', 72, 118);
    __NC.setEnergy(0, 20); out.b3 = __NC.deploy(0, 'bunker', 50, 100);
    __NC.setEnergy(0, 20); out.onBase = __NC.deploy(0, 'bunker', 50, 158);   // over the goalpost
    out.count = __NC.buildings.filter(b => b.side === 0).length;
    const b = __NC.buildings[0];
    __NC.setEnergy(0, 20); out.g1 = __NC.deploy(0, 'archer', b.x, b.y - 9);
    __NC.setEnergy(0, 20); out.g2 = __NC.deploy(0, 'fighter', b.x, b.y - 9);
    __NC.setEnergy(0, 20); out.g3 = __NC.deploy(0, 'archer', b.x, b.y - 9);
    out.garrison = b.garrison.length;
    out.stationary = b.garrison.every(u => u.home === b);
    out.rangeBoost = b.garrison.filter(u => u.key === 'fighter').map(u => u.k.range);
    return out;
  });
  ok('two bunkers place, a third is refused', caps.b1 && caps.b2 && !caps.b3 && caps.count === 2, JSON.stringify(caps));
  ok('a bunker cannot be dropped on top of a base', caps.onBase === false);
  ok('a bunker garrisons exactly two units', caps.g1 && caps.g2 && !caps.g3 && caps.garrison === 2, JSON.stringify(caps));
  ok('garrisoned units become stationary', caps.stationary === true);

  const shielded = await page.evaluate(() => {
    // an enemy parked against the bunker must chew the BUILDING, not the garrison
    const b = __NC.buildings.find(x => x.side === 0);
    __NC.setEnergy(1, 20);
    __NC.deploy(1, 'tank', b.x, 70);     // a tank outlives the garrison's return fire
    return { bhp: b.hp, ghp: b.garrison.map(u => u.hp) };
  });
  await page.waitForTimeout(3500);        // engaged and shooting, and the tank is still standing
  const shieldedAfter = await page.evaluate(() => {
    const b = __NC.buildings.find(x => x.side === 0);
    const f = b && b.garrison.find(u => u.key === 'fighter');
    return b ? { bhp: b.hp, ghp: b.garrison.map(u => u.hp), firing: !!(f && f.target), melee: f ? f.k.range : null }
             : { gone: true };
  });
  ok('the bunker takes the damage aimed at its garrison',
     !shieldedAfter.gone && shieldedAfter.bhp < shielded.bhp &&
     shieldedAfter.ghp.every((h, i) => h === shielded.ghp[i]),
     JSON.stringify({ shielded, shieldedAfter }));
  ok('a garrisoned melee unit fires through the slits beyond its own reach',
     shieldedAfter.firing === true && shieldedAfter.melee < 15, JSON.stringify(shieldedAfter));

  const ejected = await page.evaluate(() => {
    const b = __NC.buildings.find(x => x.side === 0);
    const out = { ids: b.garrison.map(u => u.id), hps: b.garrison.map(u => u.hp) };
    b.hp = 1;                                  // the tank's next hit levels it
    return out;
  });
  let bunkerDown = false;
  for (let i = 0; i < 40 && !bunkerDown; i++) {
    await page.waitForTimeout(250);
    bunkerDown = await page.evaluate(() => __NC.buildings.filter(b => b.side === 0).length === 1);
  }
  const after = await page.evaluate(ids => {
    const alive = __NC.units.filter(u => ids.includes(u.id));
    return { n: alive.length, homes: alive.map(u => u.home === null),
             bunkers: __NC.buildings.filter(b => b.side === 0).length };
  }, ejected.ids);
  ok('a destroyed bunker ejects its garrison ALIVE and mobile',
     bunkerDown && after.n === 2 && after.homes.every(Boolean) && after.bunkers === 1,
     JSON.stringify({ ejected, after, bunkerDown }));

  // ============================================================== energy
  const eco = await page.evaluate(async () => {
    __NC.start('2p'); __NC.setEnergy(0, 4); __NC.setEnergy(1, 4);
    const t0 = performance.now(), e0 = __NC.energy[0];
    await new Promise(r => setTimeout(r, 2500));
    const dt = (performance.now() - t0) / 1000;
    const rate = (__NC.energy[0] - e0) / dt;
    __NC.setEnergy(0, 20);
    await new Promise(r => setTimeout(r, 900));
    const cap = __NC.energy[0];
    return { rate, cap };
  });
  ok('energy accrues at 1 per second', near(eco.rate, 1, 0.12), 'rate=' + eco.rate.toFixed(3));
  ok('energy is capped at 20', eco.cap === 20, 'cap=' + eco.cap);
  const sudden = await page.evaluate(async () => {
    __NC.setEnergy(0, 4);
    __NC.setTime(181);
    const t0 = performance.now(), e0 = __NC.energy[0];
    await new Promise(r => setTimeout(r, 1800));
    return (__NC.energy[0] - e0) / ((performance.now() - t0) / 1000);
  });
  ok('sudden death doubles the energy rate', near(sudden, 2, 0.25), 'rate=' + sudden.toFixed(3));

  // ============================================= win condition ends the match
  await page.evaluate(() => {
    __NC.start('2p');
    __NC.bases[1].hp = 30;
    __NC.setEnergy(0, 20);
    __NC.deploy(0, 'fighter', 50, 84);
  });
  await page.waitForTimeout(12000);
  const over = await page.evaluate(() => ({
    s: __NC.state, hp: __NC.bases[1].hp,
    shown: !document.getElementById('ov-over').classList.contains('hidden'),
    res: document.getElementById('res-main').textContent,
  }));
  ok('razing the enemy base ends the match', over.s === 'over' && over.hp === 0 && over.shown, JSON.stringify(over));
  ok('2P result names the winning colour', /GREEN|RED/.test(over.res), over.res);

  // ================================================ two players, two fingers
  await page.evaluate(() => { __NC.start('2p'); __NC.setEnergy(0, 20); __NC.setEnergy(1, 20); });
  await page.waitForTimeout(80);
  const p0 = { id: 11, x: botSlot('fighter'), y: botCardY };
  const p1 = { id: 12, x: topSlot('tank', true), y: topCardY };
  const d0 = { id: 11, x: geo.left + geo.w * 0.3, y: boardY(0.8) };
  const d1 = { id: 12, x: geo.left + geo.w * 0.7, y: boardY(0.2) };
  await drag([
    { type: 'touchstart', pts: [p0] },
    { type: 'touchstart', pts: [p1] },
    { type: 'touchmove', pts: [d0, d1] },
    { type: 'touchend', pts: [d0] },
    { type: 'touchend', pts: [d1] },
  ]);
  await page.waitForTimeout(120);
  const duel = await page.evaluate(() => ({
    green: __NC.units.filter(u => u.side === 0).map(u => u.key),
    red: __NC.units.filter(u => u.side === 1).map(u => u.key),
    e: __NC.energy.map(v => Math.round(v)),
  }));
  ok('both players deploy simultaneously from opposite trays',
     duel.green.includes('fighter') && duel.red.includes('tank'), JSON.stringify(duel));
  ok('each side pays only for its own card', duel.e[0] <= 17 && duel.e[1] <= 16, JSON.stringify(duel.e));

  // the far tray is inert when nobody is sitting there
  await page.evaluate(() => { __NC.start('ai', 'PRO'); __NC.setEnergy(1, 20); });
  const redBefore = await page.evaluate(() => __NC.units.filter(u => u.side === 1).length);
  await drag([
    { type: 'touchstart', pts: [{ id: 21, x: topSlot('tank', false), y: topCardY }] },
    { type: 'touchmove', pts: [{ id: 21, x: geo.left + geo.w / 2, y: boardY(0.2) }] },
    { type: 'touchend', pts: [{ id: 21, x: geo.left + geo.w / 2, y: boardY(0.2) }] },
  ]);
  await page.waitForTimeout(100);
  const redAfter = await page.evaluate(() => __NC.units.filter(u => u.side === 1).length);
  ok('in vs-AI mode the top tray does not answer the player', redAfter === redBefore, redBefore + '->' + redAfter);

  // ================================================================== the AI
  await page.evaluate(() => __NC.start('ai', 'LEGEND'));
  let negEnergy = false, overCap = false;
  for (let i = 0; i < 40; i++) {
    const e = await page.evaluate(() => __NC.energy[1]);
    if (e < -0.001) negEnergy = true;
    if (e > 20.001) overCap = true;
    await page.waitForTimeout(400);
  }
  const ai = await page.evaluate(() => ({
    units: __NC.units.filter(u => u.side === 1).length,
    builds: __NC.buildings.filter(b => b.side === 1).length,
    myBase: __NC.bases[0].hp, state: __NC.state,
  }));
  ok('the AI actually plays cards', ai.units + ai.builds > 0 || ai.state === 'over', JSON.stringify(ai));
  ok('the AI never spends energy it does not have', !negEnergy && !overCap);
  ok('an undefended base loses to LEGEND', ai.myBase < 1500 || ai.state === 'over', JSON.stringify(ai));

  ok('no page or console errors throughout', errs.length === 0, errs.join(' | '));

  console.log('\nNEON CLASH DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
