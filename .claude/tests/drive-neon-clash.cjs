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
 *   - the card TYPES (unit / building / spell) and the deck's left-to-right order
 *   - fireball: own half only, distance falloff, radial knockback, no base damage,
 *     and a garrison inside a bunker shielded from the blast
 *   - the SIEGE LOCK: a unit that has started hitting a building commits to it
 *     until it falls (and one merely marching at a base does not)
 *   - energy: 1/sec, cap 20, doubled in sudden death
 *   - the portrait lock: a sideways phone keeps the portrait layout, and a
 *     touch pushed through the view transform still hits the card it covers
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
  const DECK = ['tank', 'fighter', 'archer', 'bunker', 'fireball'];
  const N = DECK.length;
  const cardW = Math.max(50, Math.min(Math.round((geo.w - gap * (N + 1)) / N), Math.round(cardH * 0.92)));
  const x0 = geo.left + (geo.w - (cardW * N + gap * (N - 1))) / 2;
  const slotX = i => x0 + i * (cardW + gap) + cardW / 2;
  const botCardY = geo.top + geo.h - trayH + barH + 6 + cardH / 2;
  const topCardY = geo.top + trayH - barH - 6 - cardH / 2;
  const boardY = f => geo.top + trayH + (geo.h - 2 * trayH) * f;
  // side 0 tray is in deck order; side 1 is mirrored only when it is flipped
  const botSlot = k => slotX(DECK.indexOf(k));
  const topSlot = (k, flipped) => slotX(flipped ? N - 1 - DECK.indexOf(k) : DECK.indexOf(k));

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

  // ================================================= card types + deck order
  const deck = await page.evaluate(() => ({
    order: __NC.deck,
    types: __NC.deck.map(k => __NC.kindOf(k).type),
    fb: __NC.kindOf('fireball'),
  }));
  ok('the deck reads tank, fighter, archer, bunker, fireball left to right',
     deck.order.join(',') === 'tank,fighter,archer,bunker,fireball', deck.order.join(','));
  ok('cards are typed unit / building / spell',
     deck.types.join(',') === 'unit,unit,unit,building,spell', deck.types.join(','));
  ok('fireball is a 5-energy spell', deck.fb.cost === 5 && deck.fb.type === 'spell', JSON.stringify(deck.fb));

  // =================================================== fireball: cast contract
  const cast = await page.evaluate(() => {
    __NC.start('2p');
    const out = {};
    __NC.setEnergy(0, 20); out.enemyHalf = __NC.deploy(0, 'fireball', 50, 30);
    __NC.setEnergy(0, 4);  out.broke = __NC.deploy(0, 'fireball', 50, 120);
    __NC.setEnergy(0, 20);
    const n = __NC.units.length;
    out.legal = __NC.deploy(0, 'fireball', 50, 120);
    out.spent = 20 - __NC.energy[0];
    out.spawned = __NC.units.length - n;
    out.counted = __NC.casts[0];
    return out;
  });
  ok('fireball cannot be cast on the enemy half', cast.enemyHalf === false);
  ok('fireball you cannot afford is refused', cast.broke === false);
  ok('fireball casts on your own half', cast.legal === true && cast.counted === 1, JSON.stringify(cast));
  ok('casting fireball costs 5 energy', near(cast.spent, 5, 0.35), 'spent=' + cast.spent);
  ok('a spell puts nothing on the board', cast.spawned === 0, 'spawned=' + cast.spawned);

  // ============================== units drop ahead of the finger, spells under it
  const aim = await page.evaluate(() => {
    __NC.start('2p');
    __NC.setEnergy(0, 20); __NC.deploy(0, 'tank', 50, 120);
    const u = __NC.units.filter(x => x.side === 0).pop();
    const mark = __NC.place(1, 'tank', 50, 120);          // right under the finger
    __NC.setEnergy(0, 20); __NC.deploy(0, 'fireball', 50, 120);
    return { unitY: u.y, dealt: mark.maxHp - mark.hp };
  });
  ok('a unit still lands DRAG_OFF ahead of the finger', near(aim.unitY, 111, 0.6), 'y=' + aim.unitY);
  ok('a spell lands exactly under the finger', near(aim.dealt, 90, 1), 'dealt=' + aim.dealt);

  // ============================================ fireball: damage falls off
  const blast = await page.evaluate(() => {
    __NC.start('2p');
    const mid = __NC.place(1, 'tank', 50, 100);        // dead centre
    const rim = __NC.place(1, 'tank', 50, 114);        // exactly one blast radius out
    const out_ = __NC.place(1, 'tank', 50, 130);       // clear of the circle
    const mine = __NC.place(0, 'tank', 42, 100);       // my own tank, in the fire
    __NC.setEnergy(0, 20);
    __NC.deploy(0, 'fireball', 50, 100);               // a spell lands under the finger
    return {
      mid: mid.hp, rim: rim.hp, out: out_.hp, mine: mine.hp, max: mid.maxHp,
      kbMid: [mid.kbx, mid.kby], kbRim: [rim.kbx, rim.kby], stun: mid.stun,
      base0: __NC.bases[0].hp, base1: __NC.bases[1].hp, baseMax: __NC.bases[1].maxHp,
    };
  });
  ok('fireball hits hardest at the centre', near(blast.max - blast.mid, 90, 1), 'dealt=' + (blast.max - blast.mid));
  ok('fireball damage halves at the rim', near(blast.max - blast.rim, 45, 1), 'dealt=' + (blast.max - blast.rim));
  ok('fireball spares anything outside the circle', blast.out === blast.max, 'hp=' + blast.out);
  ok('fireball never touches your own units', blast.mine === blast.max, 'hp=' + blast.mine);
  ok('fireball cannot damage either base',
     blast.base0 === blast.baseMax && blast.base1 === blast.baseMax, JSON.stringify([blast.base0, blast.base1]));
  ok('fireball stuns what it hits', blast.stun > 0, 'stun=' + blast.stun);
  ok('knockback points away from the tap, and weakens with distance',
     blast.kbRim[1] > 0 && Math.abs(blast.kbRim[0]) < 0.01 &&
     Math.hypot(...blast.kbRim) < Math.hypot(...blast.kbMid), JSON.stringify([blast.kbMid, blast.kbRim]));

  // ======================================= fireball: knockback actually moves
  const kb = await page.evaluate(() => {
    __NC.start('2p');
    // above the impact point, so the shove opposes the way it wants to walk
    const u = __NC.place(1, 'tank', 50, 92);
    __NC.setEnergy(0, 20);
    __NC.deploy(0, 'fireball', 50, 100);
    return { before: u.y, id: u.id };
  });
  await page.waitForTimeout(140);
  const kbAfter = await page.evaluate(id => {
    const u = __NC.units.find(x => x.id === id);
    return u ? u.y : null;
  }, kb.id);
  ok('a knocked unit is thrown backwards, against its own march',
     kbAfter !== null && kbAfter < kb.before - 1, 'y ' + kb.before + ' -> ' + kbAfter);

  // ================================ fireball: the bunker still shelters its garrison
  const shield = await page.evaluate(() => {
    __NC.start('2p');
    __NC.setEnergy(0, 20); __NC.deploy(0, 'bunker', 50, 97);      // impact y = 88
    const b = __NC.buildings.find(x => x.side === 0);
    // finger inside the bunker's grab radius AND still on our own half
    __NC.setEnergy(0, 20); __NC.deploy(0, 'archer', b.x, b.y - 4);
    const g = b.garrison[0];
    __NC.setEnergy(1, 20);
    // side 1's finger sits on its own half; the impact clamps to the halfway
    // line, which is still inside the bunker's blast reach.
    const fired = __NC.deploy(1, 'fireball', 50, b.y - 9);
    return { fired, bunker: b.hp, bunkerMax: b.maxHp, garrison: g.hp, garrisonMax: g.maxHp, held: b.garrison.length };
  });
  ok('an enemy fireball burns the bunker', shield.fired === true && shield.bunker < shield.bunkerMax,
     JSON.stringify(shield));
  ok('the garrison inside is shielded from the blast', shield.garrison === shield.garrisonMax, JSON.stringify(shield));

  // ==================================== a spell dropped on your bunker is cast, not garrisoned
  const noGarrison = await page.evaluate(() => {
    __NC.start('2p');
    __NC.setEnergy(0, 20); __NC.deploy(0, 'bunker', 50, 118);
    const b = __NC.buildings.find(x => x.side === 0);
    __NC.setEnergy(0, 20);
    const fired = __NC.deploy(0, 'fireball', b.x, b.y - 9);
    return { fired, held: b.garrison.length, casts: __NC.casts[0], hp: b.hp, max: b.maxHp };
  });
  ok('a spell dropped on your own bunker casts instead of garrisoning',
     noGarrison.fired === true && noGarrison.held === 0 && noGarrison.casts === 1, JSON.stringify(noGarrison));
  ok('your own fireball does not burn your own bunker', noGarrison.hp === noGarrison.max, JSON.stringify(noGarrison));

  // ================================================ the AI plays the spell too
  await page.evaluate(() => {
    __NC.start('ai', 'LEGEND');
    for (let i = 0; i < 4; i++) __NC.place(0, 'fighter', 44 + i * 5, 56 + (i % 2) * 6);
    __NC.setEnergy(1, 20);
  });
  let aiCast = 0;
  for (let i = 0; i < 24 && !aiCast; i++) {
    await page.waitForTimeout(250);
    aiCast = await page.evaluate(() => __NC.casts[1]);
  }
  ok('LEGEND answers a massed push with a fireball', aiCast > 0, 'casts=' + aiCast);

  // ============================================ the siege lock (focus fire)
  // Once a unit lands a blow on a building it commits until that building dies.
  // This is the rule that makes a push answerable, so it is pinned from both
  // directions: a committed unit must NOT divert, and an uncommitted one must.
  const siegeId = await page.evaluate(() => {
    __NC.start('2p');
    return __NC.place(1, 'fighter', 50, 138).id;      // parked on side 0's base
  });
  await page.waitForTimeout(420);                      // long enough to land a blow
  const siege0 = await page.evaluate(id => {
    const u = __NC.units.find(x => x.id === id);
    return { lock: u.lock && u.lock.kind, defId: __NC.place(0, 'fighter', 50, 131).id };
  }, siegeId);
  ok('hitting a base commits the attacker to it', siege0.lock === 'base', 'lock=' + siege0.lock);
  await page.waitForTimeout(700);
  const siege1 = await page.evaluate(ids => {
    const a = __NC.units.find(x => x.id === ids[0]), d = __NC.units.find(x => x.id === ids[1]);
    return {
      atkLock: a && a.lock && a.lock.kind, atkTarget: a && a.target && a.target.kind,
      defHp: d && d.hp, defMax: d && d.maxHp, baseHurt: __NC.bases[0].maxHp - __NC.bases[0].hp,
    };
  }, [siegeId, siege0.defId]);
  ok('a committed attacker will not turn on a defender that walks up',
     siege1.atkLock === 'base' && siege1.atkTarget === 'base' && siege1.defHp === siege1.defMax,
     JSON.stringify(siege1));
  ok('and it keeps chewing the building while it ignores them', siege1.baseHurt > 0,
     'dealt=' + siege1.baseHurt);

  // ------- but merely WALKING at a base commits nothing
  const walkIds = await page.evaluate(() => {
    __NC.start('2p');
    const w = __NC.place(1, 'fighter', 50, 100);       // marching at side 0's base, far from it
    return { w: w.id, target: w.target && w.target.kind, d: __NC.place(0, 'archer', 50, 112).id };
  });
  await page.waitForTimeout(700);
  const walk = await page.evaluate(id => {
    const u = __NC.units.find(x => x.id === id);
    return { lock: u && u.lock, target: u && u.target && u.target.kind };
  }, walkIds.w);
  ok('a unit only marching at a base is still free to divert onto a defender',
     walk.lock === null && walk.target === 'unit', JSON.stringify(walk));

  // ------- the lock releases the moment the building falls
  await page.evaluate(() => {
    __NC.start('2p');
    __NC.setEnergy(0, 20); __NC.deploy(0, 'bunker', 50, 127);
    const b = __NC.buildings[0];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      __NC.place(1, 'fighter', b.x + Math.cos(a) * 11, b.y + Math.sin(a) * 11);
    }
  });
  await page.waitForTimeout(500);
  const onBunker = await page.evaluate(() =>
    __NC.units.filter(u => u.side === 1).filter(u => u.lock && u.lock.kind === 'bunker').length);
  ok('hitting a bunker commits attackers to it as well', onBunker >= 4, 'locked=' + onBunker);
  let gone = false;
  for (let i = 0; i < 30 && !gone; i++) {
    await page.waitForTimeout(250);
    gone = await page.evaluate(() => __NC.buildings.length === 0);
  }
  ok('the besieged bunker does fall', gone);
  const freed = await page.evaluate(() => {
    const mine = __NC.units.filter(u => u.side === 1 && !u.dead);
    return { n: mine.length, stillLocked: mine.filter(u => u.lock).length,
             onBase: mine.filter(u => u.target && u.target.kind === 'base').length };
  });
  ok('killing the building releases every attacker it held',
     freed.n > 0 && freed.stillLocked === 0, JSON.stringify(freed));
  ok('released attackers pick a new target and march on', freed.onBase > 0, JSON.stringify(freed));

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

  // ============================================ portrait lock (landscape view)
  // The game is portrait-only: a touch device turned sideways must keep the
  // portrait layout and stay playable, not reflow into a landscape strip.
  const land = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  });
  const lp = await land.newPage();
  const lerrs = [];
  lp.on('pageerror', e => lerrs.push('PAGEERROR ' + e.message));
  lp.on('console', m => { if (m.type() === 'error' && !/font|net::/i.test(m.text())) lerrs.push('CONSOLE ' + m.text()); });
  await lp.goto(URL);
  await lp.waitForTimeout(450);
  await lp.click('#db-PRO');
  await lp.waitForTimeout(250);
  const view = await lp.evaluate(() => {
    const a = document.getElementById('app'), cv = document.getElementById('game');
    return { rot: __NC.viewRot, rotated: a.classList.contains('rotated'),
             aw: a.clientWidth, ah: a.clientHeight, cw: cv.clientWidth, cvh: cv.clientHeight };
  });
  ok('a sideways phone keeps the portrait layout',
     view.rotated && Math.abs(Math.abs(view.rot) - Math.PI / 2) < 1e-6 &&
     view.ah > view.aw && view.cvh > view.cw, JSON.stringify(view));
  // a real touch drag, its screen coords pushed THROUGH the view transform,
  // must still land on the card it visually covers
  const lgeo = await lp.evaluate(() => {
    const cv = document.getElementById('game');
    return { cw: cv.clientWidth, ch: cv.clientHeight };
  });
  const lTray = Math.min(96, Math.max(62, Math.round(lgeo.ch * 0.125)));
  const lCardH = Math.max(32, lTray - 13 - 12);
  const lGap = Math.max(5, Math.round(lgeo.cw * 0.016));
  const lCardW = Math.max(50, Math.min(110, Math.min(Math.round((lgeo.cw - lGap * (N + 1)) / N), Math.round(lCardH * 0.92))));
  const lX0 = (lgeo.cw - (lCardW * N + lGap * (N - 1))) / 2;
  const toClient = (px, py) => lp.evaluate(([px, py]) => {
    const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
    const rot = __NC.viewRot, c = Math.cos(rot), s = Math.sin(rot);
    const dx = px - cv.clientWidth / 2, dy = py - cv.clientHeight / 2;
    return { x: r.left + r.width / 2 + (dx * c - dy * s), y: r.top + r.height / 2 + (dx * s + dy * c) };
  }, [px, py]);
  const lFrom = await toClient(lX0 + DECK.indexOf('fighter') * (lCardW + lGap) + lCardW / 2,
                               lgeo.ch - lTray + 13 + 6 + lCardH / 2);
  const lTo = await toClient(lgeo.cw / 2, lTray + (lgeo.ch - 2 * lTray) * 0.78);
  await lp.evaluate(([a, b]) => {
    const cv = document.getElementById('game');
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 3, target: cv, clientX: x, clientY: y });
      cv.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
    };
    mk('touchstart', a.x, a.y); mk('touchmove', b.x, b.y); mk('touchend', b.x, b.y);
  }, [lFrom, lTo]);
  await lp.waitForTimeout(120);
  const lDrop = await lp.evaluate(() => __NC.units.filter(u => u.side === 0).map(u => ({ k: u.key, y: Math.round(u.y) })));
  ok('touch still resolves through the rotated view',
     lDrop.length === 1 && lDrop[0].k === 'fighter' && lDrop[0].y > 100, JSON.stringify(lDrop));
  ok('no errors in the rotated view', lerrs.length === 0, lerrs.join(' | '));
  await land.close();

  ok('no page or console errors throughout', errs.length === 0, errs.join(' | '));

  console.log('\nNEON CLASH DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
