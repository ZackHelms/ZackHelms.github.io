#!/usr/bin/env node
/**
 * drive-ember-depths.cjs — camera + relic-panel invariants for games/ember-depths/.
 *
 * The board camera and the relic panel are both retrofits over a turn engine
 * that predates them, and both have a failure mode that is invisible on
 * screen and expensive to re-derive:
 *
 *   - FREE LOOK IS DURABLE. Until the player drags, the camera eases to keep
 *     them on screen; the first drag hands the camera over *for good*. The bug
 *     this guards is the camera quietly re-tethering on the next step — which
 *     is precisely what the previous version did by design, so a refactor that
 *     "restores" followCam looks like a fix.
 *   - THE PANEL IS A READ, NEVER A TURN. Opening and closing the relic panel
 *     goes through handleTap, the same entry point that walks the hero. If the
 *     tap falls through, the dismissing tap walks you into a room you cannot
 *     see and every enemy takes a step. turnCount and pathQueue are the
 *     witnesses; a screenshot is not.
 *   - ×N MEANS ×N. The panel aggregates duplicate relics onto one row, so
 *     every effect site has to read relicCount() rather than
 *     relics.includes(). One check drives ALL of them together: a site left on
 *     .includes() is the entire failure mode, and a per-relic check invites
 *     the next relic to be quietly forgotten.
 *
 * Plus the zoom range and the clamp, which are cheap and pin the numbers the
 * gesture code assumes.
 *
 * Run: NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
 *      node .claude/tests/drive-ember-depths.cjs
 */
const path = require('path');
const fs = require('fs');
let chromium, devices;
try { ({ chromium, devices } = require('playwright-core')); }
catch (e) { console.error('needs playwright-core resolvable (NODE_PATH=...)'); process.exit(1); }
const EXE = process.env.SMOKE_CHROMIUM ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'games', 'ember-depths', 'index.html');

const GEAR_MAX = 3;   // tiers per gear track, minus the free starting kit

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/font|net::/i.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(450);
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2], radiusX: 12, radiusY: 12, force: 1 })),
  });

  const start = async () => {
    await page.evaluate(() => { if (state !== 'play') startRun(); });
    await page.waitForTimeout(250);
  };
  await start();
  ok('run starts in play', await page.evaluate(() => state) === 'play');

  // ---------- zoom range ----------
  console.log('\n[zoom]');
  const z = await page.evaluate(() => ({ min: MIN_ZOOM, max: MAX_ZOOM, cur: zoom }));
  ok('opens at the whole-board fit (zoom 1)', z.cur === 1, z);
  ok('can zoom out past the fit', z.min < 1, z);
  ok('can zoom in well past the fit', z.max >= 5, z);

  // Zoom-1 is the identity case: the layout must match what a viewport-fit
  // board drew before the camera existed.
  const fit = await page.evaluate(() => {
    zoom = 1; applyView();
    return { tile, ox, oy, base: baseTile, w: tile * COLS, h: tile * ROWS, vw: viewW, vh: viewH };
  });
  ok('zoom 1 == baseTile fit', fit.tile === fit.base && fit.w <= fit.vw + 1 && fit.h <= fit.vh + 1, fit);

  // Clamp: at max zoom the board may touch a viewport edge but never pass it.
  // Act and READ IN ONE evaluate — followCam eases on the next rAF, so a read
  // in a second round trip measures the follow, not the pan.
  const clampTL = await page.evaluate(() => {
    zoom = MAX_ZOOM; applyView(); panBy(99999, 99999);
    return { ox, oy, vx: viewX, vy: viewY };
  });
  ok('pan clamps at the top-left edge', clampTL.ox <= clampTL.vx && clampTL.oy <= clampTL.vy &&
     clampTL.ox >= clampTL.vx - 1 && clampTL.oy >= clampTL.vy - 1, clampTL);
  const clampBR = await page.evaluate(() => {
    panBy(-99999, -99999);
    return { r: ox + tile * COLS, b: oy + tile * ROWS, vr: viewX + viewW, vb: viewY + viewH };
  });
  ok('pan clamps at the bottom-right edge', clampBR.r >= clampBR.vr - 1 && clampBR.b >= clampBR.vb + -1 &&
     clampBR.r <= clampBR.vr + 1 && clampBR.b <= clampBR.vb + 1, clampBR);

  // Zoomed out below the fit the board is centred and there is nothing to pan.
  const out = await page.evaluate(() => {
    zoom = MIN_ZOOM; applyView();
    const before = { ox, oy };
    panBy(200, 200);
    return { before, ox, oy, canPan: canPan() };
  });
  ok('below the fit the camera centres and cannot pan',
     out.canPan === false && out.ox === out.before.ox && out.oy === out.before.oy, out);

  // ---------- free look is durable ----------
  console.log('\n[free look]');
  await page.evaluate(() => { zoom = 1; camFree = false; centerCam(); });
  const tethered = await page.evaluate(async () => {
    // Zoomed in and NOT yet dragged: walking must pull the camera along.
    zoom = 3; applyView(); camFree = false; centerCam();
    const before = { ox, oy };
    player.x = Math.max(1, player.x); player.y = ROWS - 2;
    player.vx = player.x; player.vy = player.y;
    for (let i = 0; i < 60; i++) followCam(1 / 60);
    return { before, ox, oy, camFree };
  });
  ok('un-dragged camera still follows the hero', tethered.oy !== tethered.before.oy, tethered);

  const freed = await page.evaluate(() => {
    zoom = 3; applyView(); centerCam();
    panBy(0, 120);                       // the drag that frees the camera
    const after = { ox, oy, camFree };
    player.x = 1; player.y = 1; player.vx = 1; player.vy = 1;   // hero walks far away
    for (let i = 0; i < 120; i++) followCam(1 / 60);
    return { after, ox, oy };
  });
  ok('a drag latches camFree', freed.after.camFree === true, freed);
  ok('freed camera never re-tethers, however far the hero walks',
     freed.ox === freed.after.ox && freed.oy === freed.after.oy, freed);

  const recentred = await page.evaluate(() => {
    const btn = recenterBtn;
    if (!btn) return { btn: null };
    handleTap(btn.x, btn.y);
    return { btn: { x: btn.x, y: btn.y }, camFree, turn: turnCount, queued: pathQueue.length };
  });
  ok('the recentre button exists while the camera is free', recentred.btn !== null, recentred);
  ok('tapping it hands the camera back', recentred.camFree === false, recentred);
  ok('and costs no turn', recentred.queued === 0, recentred);
  const following = await page.evaluate(() => {
    const before = { ox, oy };
    player.x = COLS - 2; player.y = ROWS - 2; player.vx = player.x; player.vy = player.y;
    for (let i = 0; i < 120; i++) followCam(1 / 60);
    return { before, ox, oy };
  });
  ok('after recentring the camera follows again', following.oy !== following.before.oy, following);

  // A real two-finger spread must free the camera and never fire a tap.
  await page.evaluate(() => { zoom = 1; camFree = false; centerCam(); turnCount = 0; pathQueue = []; });
  const cx = 195, cy = 500;
  await touch('touchStart', [[cx - 40, cy, 1], [cx + 40, cy, 2]]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [[cx - 40 - i * 14, cy, 1], [cx + 40 + i * 14, cy, 2]]);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', [[cx + 152, cy, 2]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(80);
  const pinched = await page.evaluate(() => ({ zoom, camFree, queued: pathQueue.length, turn: turnCount }));
  ok('a real pinch zooms in', pinched.zoom > 1.2, pinched);
  ok('a real pinch frees the camera', pinched.camFree === true, pinched);
  ok('a real pinch never fires a tap', pinched.queued === 0 && pinched.turn === 0, pinched);

  const pageState = await page.evaluate(() => ({
    scale: window.visualViewport ? window.visualViewport.scale : 1,
    sx: window.scrollX, sy: window.scrollY,
  }));
  ok('the pinch scaled the board, not the page', pageState.scale === 1 && !pageState.sx && !pageState.sy, pageState);

  // ---------- the relic panel is a read, never a turn ----------
  console.log('\n[relic panel]');
  // The camera checks above teleport the hero to arbitrary cells to drive
  // followCam, which can leave them standing inside a wall. Regenerate the
  // floor so the board below is a real one — stages inside a suite must not
  // inherit each other's mutable state.
  await page.evaluate(() => {
    genFloor(floorNum);
    state = 'play';
    zoom = 1; camFree = false; centerCam();
    relics = []; player.atk = 3; player.maxHp = 12; player.hp = 12;
    takeRelic('blade'); takeRelic('lantern');
    turnCount = 0; pathQueue = []; buffPanel = false;
  });
  await page.waitForTimeout(80);
  const hot = await page.evaluate(() => buffRect && { x: buffRect.x + buffRect.w / 2, y: buffRect.y + buffRect.h / 2 });
  ok('the relic row publishes a tap target', !!hot, hot);
  const opened = await page.evaluate((h) => {
    handleTap(h.x, h.y);
    return { open: buffPanel, turn: turnCount, queued: pathQueue.length };
  }, hot);
  ok('tapping the relic row opens the panel', opened.open === true, opened);
  ok('opening it queues no step and takes no turn', opened.queued === 0 && opened.turn === 0, opened);

  // The dismissing tap lands on the BOARD — the dangerous case, because that
  // is a coordinate tapTile() would happily walk to.
  // Aim at an orthogonal neighbour of the hero, not at "the first seen floor
  // tile on the board": a distant seen tile can be unreachable on a given
  // procedural floor, and the control check below then fails for a reason
  // that has nothing to do with the panel. A neighbour is always both seen
  // and one step away, on every floor.
  const walkable = await page.evaluate(() => {
    for (const [dx, dy] of DIRS) {
      const x = player.x + dx, y = player.y + dy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      if (grid[IDX(x, y)] === 0 && seen[IDX(x, y)] && !enemyAt(x, y)) {
        return { px: ox + (x + 0.5) * tile, py: oy + (y + 0.5) * tile, x, y };
      }
    }
    return null;
  });
  ok('found a walkable tile to aim the dismissing tap at', !!walkable, walkable);
  // An adjacent tap steps immediately rather than queueing, so the witness
  // has to be the hero's own position and the turn counter, not pathQueue
  // alone — `queued === 0` is true both when nothing happened and when the
  // hero has already walked.
  const closed = await page.evaluate((w) => {
    const at = { x: player.x, y: player.y, turn: turnCount };
    handleTap(w.px, w.py);
    return { at, open: buffPanel, x: player.x, y: player.y, turn: turnCount, queued: pathQueue.length };
  }, walkable);
  ok('tapping again closes the panel', closed.open === false, closed);
  ok('the dismissing tap never walks the hero',
     closed.x === closed.at.x && closed.y === closed.at.y && closed.turn === closed.at.turn && closed.queued === 0, closed);
  // ...and the very same tap, with the panel shut, DOES act — otherwise the
  // check above would pass on a hit-test that is simply broken.
  const walks = await page.evaluate((w) => {
    const at = { x: player.x, y: player.y, turn: turnCount };
    handleTap(w.px, w.py);
    return { at, moved: player.x !== at.x || player.y !== at.y, turn: turnCount, queued: pathQueue.length };
  }, walkable);
  ok('the same tap with the panel shut does act',
     walks.moved || walks.queued > 0 || walks.turn > walks.at.turn, walks);

  // ---------- duplicates aggregate, and every effect site stacks ----------
  console.log('\n[stacking]');
  // Every number below comes out of the GAME's own functions — hurtPlayer,
  // killEnemy, lightRadius — never re-derived in the check. A check that
  // recomputes `damage - relicCount('skin')` for itself passes with the
  // shipping site still on relics.includes(), which is the exact regression
  // this group exists to catch (verified: it did).
  const stack = await page.evaluate(() => {
    state = 'play';
    relics = []; player.atk = 3; player.maxHp = 40; player.hp = 40; wardTimer = 0;
    const light1 = lightRadius();
    ['blade', 'blade', 'skin', 'skin', 'leech', 'leech', 'lantern', 'lantern', 'ward', 'ward', 'crown', 'crown']
      .forEach(takeRelic);
    const rows = relicCounts();

    // STONE SKIN ×2: drive a real 6-damage hit, with the ward parked so it
    // cannot eat it. maxHp is raised above so no hit here can kill.
    wardTimer = 99;
    const hpBefore = player.hp;
    hurtPlayer(6, player.x, player.y);
    const skinDealt = hpBefore - player.hp;

    // EMBER WARD ×2: a ready ward must block outright and set its own,
    // shorter, recharge.
    wardTimer = 0;
    const hpBeforeWard = player.hp;
    hurtPlayer(6, player.x, player.y);
    const warded = { blocked: player.hp === hpBeforeWard, timer: wardTimer };

    // LEECH FANG ×2: kill a real enemy through killEnemy().
    player.hp = 20;
    const victim = { id: 9999, x: player.x, y: player.y, vx: player.x, vy: player.y, hp: 0, maxHp: 3, atk: 1, type: 'brute', aggro: true, seed: 1 };
    enemies.push(victim);
    const hpBeforeKill = player.hp;
    killEnemy(victim);
    const healed = player.hp - hpBeforeKill;

    return {
      rows: rows.length, counts: rows.map(r => r.key + ':' + r.n),
      atk: player.atk, maxHp: player.maxHp,
      light: lightRadius(), light1,
      skinDealt, warded, healed,
    };
  });
  ok('twelve relics aggregate to six rows', stack.rows === 6, stack);
  ok('every row carries ×2', stack.counts.every(c => c.endsWith(':2')), stack);
  ok('blade stacks: +2 attack twice', stack.atk === 7, stack);
  ok('crown stacks: +2 max HP twice', stack.maxHp === 44, stack);
  ok('lantern stacks: light grows past one copy', stack.light > stack.light1 + 1.6 - 1e-9, stack);
  ok('skin stacks: a real 6-damage hit lands for 4', stack.skinDealt === 4, stack);
  ok('ward still blocks, and stacks to a shorter recharge',
     stack.warded.blocked === true && stack.warded.timer === 4, stack);
  ok('leech stacks: a real kill heals two', stack.healed === 2, stack);

  // The panel must survive being asked to render a stacked, live board.
  const rendered = await page.evaluate(() => {
    buffPanel = true;
    drawBuffPanel();
    return { open: buffPanel };
  });
  ok('the panel renders a fully stacked build without throwing', rendered.open === true, rendered);
  await page.evaluate(() => { buffPanel = false; });

  // Descending never leaves a panel open over the new floor.
  const descended = await page.evaluate(() => {
    buffPanel = true; camFree = true;
    genFloor(floorNum + 1);
    return { open: buffPanel, camFree };
  });
  ok('a new floor closes the panel and recentres', descended.open === false && descended.camFree === false, descended);

  // ---------- meta progression: characters, gear, skills, supplies ----------
  // Clean slate: this group is about persistence, so it must not inherit the
  // slots any earlier stage happened to write.
  console.log('\n[meta]');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  const three = await page.evaluate(() => {
    campAction('new', '0'); campAction('create', '0');
    const a = chr().name;
    chr().gold = 100;
    campAction('slots');
    campAction('new', '1'); campAction('create', '1');
    const b = chr().name;
    chr().gold = 7;
    campAction('slots');
    campAction('new', '2'); campAction('create', '2');
    saveSlots();
    return { a, b, golds: slots.map((c) => c && c.gold), filled: slots.filter(Boolean).length };
  });
  ok('three characters fill three slots', three.filled === 3, three);
  ok('each slot keeps its own purse', three.golds[0] === 100 && three.golds[1] === 7 && three.golds[2] === 0, three);

  // A reload is the only honest persistence check — everything else measures
  // the in-memory copy that was never written.
  await page.reload();
  await page.waitForTimeout(400);
  const reloaded = await page.evaluate(() => ({
    golds: slots.map((c) => c && c.gold),
    names: slots.map((c) => c && c.name),
  }));
  ok('characters survive a reload', reloaded.golds[0] === 100 && reloaded.golds[1] === 7, reloaded);

  const erased = await page.evaluate(() => {
    campAction('erase', '1');
    return { slots: slots.map((c) => (c ? c.gold : null)) };
  });
  ok('erasing one delver leaves the others whole',
     erased.slots[0] === 100 && erased.slots[1] === null && erased.slots[2] === 0, erased);

  // A save blob is player-editable and version-drifting. migrate() must clamp
  // rather than trust — an out-of-range gear tier would index off the end of
  // its track and throw mid-delve.
  const clamped = await page.evaluate(() => {
    localStorage.setItem('emberDepths.slots.v1', JSON.stringify([{
      name: 'CHEAT', gold: -50, sp: 999.9,
      gear: { weapon: 99, armor: -3, lantern: 'x', charm: 1 },
      skills: { 'might.edge': 99, 'nope.nope': 5 },
      supplies: { draught: 99, ghost: 4 },
      stats: { bestDepth: -2 },
    }, null, null]));
    loadSlots();
    activeSlot = 0;
    const c = chr();
    return {
      gold: c.gold, sp: c.sp, weapon: c.gear.weapon, armor: c.gear.armor, lantern: c.gear.lantern,
      edge: rank('might', 'edge'), junkSkill: c.skills['nope.nope'],
      draught: c.supplies.draught, junkSupply: c.supplies.ghost,
      best: c.stats.bestDepth, atk: metaAtk(),
    };
  });
  ok('a hand-edited save is clamped, not trusted',
     clamped.gold === 0 && clamped.sp === 999 && clamped.weapon === GEAR_MAX &&
     clamped.armor === 0 && clamped.lantern === 0 && clamped.edge === 3 &&
     clamped.junkSkill === undefined && clamped.draught === 3 &&
     clamped.junkSupply === undefined && clamped.best === 0, clamped);
  ok('and the clamped kit still computes a real bonus', clamped.atk === 3 + 3, clamped);

  // ---- the forge ----
  const forge = await page.evaluate(() => {
    localStorage.clear(); loadSlots();
    campAction('new', '0'); campAction('create', '0');
    const c = chr();
    c.gold = 20;
    campAction('buy-gear', 'weapon');           // 40g — cannot afford
    const poor = { gold: c.gold, tier: c.gear.weapon };
    c.gold = 200;
    campAction('buy-gear', 'weapon');
    campAction('buy-gear', 'armor');
    return { poor, gold: c.gold, weapon: c.gear.weapon, armor: c.gear.armor };
  });
  ok('a purchase you cannot afford is a no-op',
     forge.poor.gold === 20 && forge.poor.tier === 0, forge);
  ok('buying debits exactly the price and raises one tier',
     forge.gold === 200 - 40 - 40 && forge.weapon === 1 && forge.armor === 1, forge);

  // The kit has to REACH the delve: startRun folds it into player stats once,
  // and nothing downstream re-reads it.
  const kitted = await page.evaluate(() => {
    const c = chr();
    c.gold = 5000;
    campAction('buy-gear', 'weapon'); campAction('buy-gear', 'weapon');   // -> ASHSTEEL RUIN, +3
    campAction('buy-gear', 'armor'); campAction('buy-gear', 'armor');     // -> EMBERPLATE, +8 hp, -1 dr
    campAction('buy-gear', 'lantern'); campAction('buy-gear', 'lantern'); campAction('buy-gear', 'lantern');
    campAction('buy-gear', 'charm'); campAction('buy-gear', 'charm'); campAction('buy-gear', 'charm');
    const light0 = 3.6;
    startRun();
    return {
      atk: player.atk, maxHp: player.maxHp, hp: player.hp,
      light: lightRadius(), light0, goldMult: goldMult(), marks: marksStairs(),
      stairsSeen: seen[IDX(stairs.x, stairs.y)] === 1,
    };
  });
  ok('gear reaches the delve: attack', kitted.atk === 3 + 3, kitted);
  ok('gear reaches the delve: max HP, and you start full', kitted.maxHp === 12 + 8 && kitted.hp === kitted.maxHp, kitted);
  ok('gear reaches the delve: light', Math.abs(kitted.light - (kitted.light0 + 2.6)) < 1e-6, kitted);
  ok('gear reaches the delve: gold multiplier', Math.abs(kitted.goldMult - 1.5) < 1e-9, kitted);
  ok('the Deepseeker Idol marks the stairs on arrival', kitted.marks && kitted.stairsSeen, kitted);

  // ---- skills: the gate, the rising cost, and the effects ----
  const gate = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.sp = 30;
    campAction('rank', 'might', 'vengeance');   // needs 4 spent in MIGHT
    const locked = { rank: rank('might', 'vengeance'), sp: c.sp };
    campAction('rank', 'might', 'edge');        // 1
    campAction('rank', 'might', 'edge');        // 2
    campAction('rank', 'might', 'edge');        // 3  -> 6 spent
    const afterEdge = { rank: rank('might', 'edge'), sp: c.sp, spent: treeSpent('might') };
    campAction('rank', 'might', 'edge');        // already max
    const capped = rank('might', 'edge');
    campAction('rank', 'might', 'vengeance');   // now open
    return { locked, afterEdge, capped, vengeance: rank('might', 'vengeance'), sp: c.sp };
  });
  ok('a locked node refuses the point', gate.locked.rank === 0 && gate.locked.sp === 30, gate);
  ok('rank r costs r (1+2+3 for three ranks)',
     gate.afterEdge.rank === 3 && gate.afterEdge.sp === 24 && gate.afterEdge.spent === 6, gate);
  ok('a maxed node takes no more points', gate.capped === 3, gate);
  ok('spending in the tree opens its deeper nodes', gate.vengeance === 1, gate);

  // Every skill effect below is measured through the GAME's own function, not
  // recomputed here — the same rule the relic stacking check earned.
  const skills = await page.evaluate(() => {
    const c = chr();
    c.gear = { weapon: 0, armor: 0, lantern: 0, charm: 0 };   // isolate the skills
    c.skills = {}; c.sp = 60;
    ['hide', 'hide', 'hide'].forEach(() => campAction('rank', 'vigor', 'hide'));
    ['bones', 'bones'].forEach(() => campAction('rank', 'vigor', 'bones'));
    campAction('rank', 'vigor', 'wind');
    campAction('rank', 'vigor', 'stand');
    ['lamp', 'lamp', 'lamp'].forEach(() => campAction('rank', 'cunning', 'lamp'));
    ['prospect', 'prospect'].forEach(() => campAction('rank', 'cunning', 'prospect'));
    // MIGHT's deeper nodes gate on points spent in MIGHT, so the order here
    // is load-bearing: three ranks of KEEN EDGE (1+2+3) is what opens them.
    ['edge', 'edge', 'edge'].forEach(() => campAction('rank', 'might', 'edge'));
    campAction('rank', 'might', 'heavy');
    campAction('rank', 'might', 'vengeance');
    campAction('rank', 'might', 'execution');
    startRun();
    enemies = [];
    const out = { maxHp: player.maxHp, atk: player.atk, light: lightRadius() };

    // THICK HIDE + STONE BONES through a real hit
    player.hp = player.maxHp;
    const before = player.hp;
    hurtPlayer(6, player.x, player.y);
    out.dealt = before - player.hp;

    // VENGEANCE reads the CURRENT hp, so it can only be measured in situ
    player.hp = player.maxHp;
    out.dmgHealthy = playerDamage();
    player.hp = Math.floor(player.maxHp / 2);
    out.dmgWounded = playerDamage();

    // EXECUTION through a real kill
    player.hp = 5;
    const victim = { id: 8888, x: player.x, y: player.y, vx: player.x, vy: player.y, hp: 0, maxHp: 3, atk: 1, type: 'slime', aggro: true, seed: 2 };
    enemies.push(victim);
    killEnemy(victim);
    out.execHeal = player.hp - 5;

    // LAST STAND: the first killing blow, and only the first
    player.hp = 4;
    hurtPlayer(99, player.x, player.y);
    out.stood = player.hp;
    hurtPlayer(99, player.x, player.y);
    out.thenDies = player.hp <= 0;

    // PROSPECTOR through a real pickup
    const d = DIRS.find(([dx, dy]) => grid[IDX(player.x + dx, player.y + dy)] === 0);
    items = [{ x: player.x + d[0], y: player.y + d[1], type: 'gold', amt: 10 }];
    gold = 0; player.hp = player.maxHp;
    playerAct({ move: d });
    out.picked = gold;

    // SECOND WIND through a real descent
    player.hp = 1;
    completeDescend();
    out.rested = player.hp;
    return out;
  });
  ok('THICK HIDE reaches the delve', skills.maxHp === 12 + 6, skills);
  ok('KEEN EDGE ×3 reaches the delve', skills.atk === 3 + 3, skills);
  ok('LAMPLIGHT widens a real light radius', Math.abs(skills.light - (3.6 + 1.8)) < 1e-6, skills);
  ok('STONE BONES ×2 shaves two off a real 6-damage hit', skills.dealt === 4, skills);
  ok('VENGEANCE only bites at or below half HP',
     skills.dmgHealthy === 6 && skills.dmgWounded === 8, skills);
  ok('EXECUTION heals on a real kill', skills.execHeal === 1, skills);
  ok('LAST STAND catches the first killing blow and only the first',
     skills.stood === 1 && skills.thenDies === true, skills);
  ok('PROSPECTOR ×2 turns a 10 pile into 15', skills.picked === 15, skills);
  ok('SECOND WIND heals on a real descent', skills.rested === 3, skills);

  // ---- supplies: bought in camp, used in the delve, lost with the body ----
  const supply = await page.evaluate(() => {
    const c = chr();
    c.gold = 500; c.supplies = {};
    campAction('buy-supply', 'draught');
    campAction('buy-supply', 'draught');
    campAction('buy-supply', 'bomb');
    campAction('buy-supply', 'dust');
    const bought = { held: JSON.parse(JSON.stringify(c.supplies)), gold: c.gold };
    for (let i = 0; i < 5; i++) campAction('buy-supply', 'bomb');   // max 3
    const capped = c.supplies.bomb;
    startRun();
    const carried = JSON.parse(JSON.stringify(consumables));
    return { bought, capped, carried };
  });
  ok('supplies are bought at their price',
     supply.bought.gold === 500 - 30 - 30 - 45 - 35 && supply.bought.held.draught === 2, supply);
  ok('a supply caps at its stack size', supply.capped === 3, supply);
  ok('what you bought is what you carry in',
     supply.carried.draught === 2 && supply.carried.bomb === 3 && supply.carried.dust === 1, supply);

  const used = await page.evaluate(() => {
    enemies = [];
    player.hp = 1;
    const t0 = turnCount, n0 = consumables.draught;
    useConsumable('draught');
    const draught = { healed: player.hp, spent: n0 - consumables.draught, turns: turnCount - t0 };

    // FIREBOMB: one enemy inside the blast, one outside, both real
    const near = { id: 7001, x: player.x + 1, y: player.y, vx: player.x + 1, vy: player.y, hp: 30, maxHp: 30, atk: 1, type: 'slime', aggro: false, seed: 3 };
    const far = { id: 7002, x: player.x, y: player.y, vx: player.x, vy: player.y, hp: 30, maxHp: 30, atk: 1, type: 'slime', aggro: false, seed: 4 };
    far.x = player.x; far.y = player.y;      // placed, then moved out of range below
    near.x = Math.max(0, Math.min(COLS - 1, player.x + 1));
    far.x = Math.max(0, Math.min(COLS - 1, player.x));
    far.y = Math.max(0, Math.min(ROWS - 1, player.y + 5));
    enemies = [near, far];
    useConsumable('bomb');
    const bomb = { near: near.hp, far: far.hp };

    seen.fill(0);
    useConsumable('dust');
    let unseen = 0;
    for (let i = 0; i < seen.length; i++) if (!seen[i]) unseen++;
    return { draught, bomb, dust: { unseen, left: consumables.dust } };
  });
  ok('a draught heals and is spent',
     used.draught.healed === 9 && used.draught.spent === 1, used);
  ok('using an item costs your turn', used.draught.turns === 1, used);
  ok('a firebomb burns what is in range and nothing outside it',
     used.bomb.near === 25 && used.bomb.far === 30, used);
  ok('farsight dust maps the whole floor', used.dust.unseen === 0 && used.dust.left === 0, used);

  // ---- the payout ----
  const banked = await page.evaluate(() => {
    const c = chr();
    c.gold = 0; c.sp = 0; c.stats.bestDepth = 0; c.stats.runs = 0;
    c.supplies = { draught: 2 };
    startRun();
    floorNum = 5; gold = 33; kills = 4;
    player.hp = 0;
    checkDeath();
    return {
      state, gold: c.gold, sp: c.sp, best: c.stats.bestDepth,
      runs: c.stats.runs, kills: c.stats.kills, supplies: JSON.parse(JSON.stringify(c.supplies)),
      bank: lastBank,
    };
  });
  ok('the delve banks carried gold plus a depth bonus',
     banked.gold === 33 + 40 && banked.bank.depthBonus === 40, banked);
  ok('and pays skill points for the depth, with a new-deepest bonus',
     banked.sp === 2 + 2 && banked.best === 5 && banked.bank.newBest === true, banked);
  ok('unused supplies go down with the body',
     Object.keys(banked.supplies).length === 0, banked);
  ok('the run is recorded once', banked.runs === 1 && banked.kills === 4, banked);

  // checkDeath is state-guarded; a second call must not pay twice.
  const twice = await page.evaluate(() => {
    const before = chr().gold;
    checkDeath(); checkDeath();
    return { before, after: chr().gold };
  });
  ok('death cannot bank the same delve twice', twice.before === twice.after, twice);

  ok('no page or console errors throughout', errs.length === 0, errs.join(' | '));

  console.log('\nEMBER DEPTHS DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
