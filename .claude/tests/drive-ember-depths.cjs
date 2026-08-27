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

const GEAR_MAX = 6;   // tiers per gear track, minus the free starting kit
const CURVE_HP = 20;  // CURVE.playerHp — a delver's HP before any kit

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

  // The ✖ on a slot row must not delete anything by itself — it opens a confirm
  // screen, and only DELETE on that screen writes. A one-tap erase is the whole
  // bug this guards: the slot row and the ✖ sit on the same line.
  const asked = await page.evaluate(() => {
    showSlots();
    const line = document.querySelector('.slot-line');
    const del = line && line.querySelector('.del');
    const pick = line && line.querySelector('.row');
    const gap = del && pick ? Math.round(pick.getBoundingClientRect().left - del.getBoundingClientRect().right) : -1;
    const delLeft = del && pick ? del.getBoundingClientRect().left < pick.getBoundingClientRect().left : false;
    const w = del ? Math.round(del.getBoundingClientRect().width) : 0;
    campAction('erase-ask', '1');
    return {
      delLeft, gap, w,
      still: slots.map((c) => (c ? c.gold : null)),
      confirming: /DELETE/.test(document.getElementById('overlay').textContent),
      keeps: !!document.querySelector('[data-act="slots"]'),
      arms: !!document.querySelector('[data-act="erase"]'),
    };
  });
  ok('the delete button is a small icon left of the character row',
     asked.delLeft && asked.gap > 0 && asked.w > 0 && asked.w <= 40, asked);
  ok('tapping delete only asks — nothing is erased yet',
     asked.still[1] === 7 && asked.confirming && asked.keeps && asked.arms, asked);
  const kept = await page.evaluate(() => {
    campAction('slots');
    return { golds: slots.map((c) => (c ? c.gold : null)),
             stored: JSON.parse(localStorage.getItem('emberDepths.slots.v1')).map((c) => c && c.gold) };
  });
  ok('KEEP backs out with every delver intact',
     kept.golds[1] === 7 && kept.stored[1] === 7, kept);

  const erased = await page.evaluate(() => {
    campAction('erase-ask', '1');
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
      skills: { edge: 99, 'might.edge': 99, 'nope.nope': 5 },
      supplies: { draught: 99, ghost: 4 },
      stats: { bestDepth: -2 },
    }, null, null]));
    loadSlots();
    activeSlot = 0;
    const c = chr();
    return {
      gold: c.gold, sp: c.sp, weapon: c.gear.weapon, armor: c.gear.armor, lantern: c.gear.lantern,
      edge: rank('edge'), junkSkill: c.skills['nope.nope'],
      draught: c.supplies.draught, junkSupply: c.supplies.ghost,
      best: c.stats.bestDepth, atk: metaAtk(), topAtk: GEAR.weapon.tiers[GEAR.weapon.tiers.length - 1].atk,
    };
  });
  ok('a hand-edited save is clamped, not trusted',
     clamped.gold === 0 && clamped.weapon === GEAR_MAX &&
     clamped.armor === 0 && clamped.lantern === 0 && clamped.edge === 2 &&
     clamped.junkSkill === undefined && clamped.draught === 3 &&
     clamped.junkSupply === undefined && clamped.best === 0, clamped);
  // The legacy refund is the one path that turns a stored number into
  // currency, so it is clamped twice and asserted on its own.
  // Two dotted keys in that blob, each clamped to rank 3 = 6 points apiece.
  ok('a legacy skill blob cannot mint skill points',
     clamped.sp === 999 + 12, clamped);
  ok('and the clamped kit still computes a real bonus',
     clamped.atk === clamped.topAtk + 2, clamped);

  // ---- the forge ----
  const forge = await page.evaluate(() => {
    localStorage.clear(); loadSlots();
    campAction('new', '0'); campAction('create', '0');
    const c = chr();
    // Prices are READ, never restated. The ladder is tuned against the eval and
    // moves when the economy does; a check that hard-codes 40 fails the next
    // tuning pass for a reason that has nothing to do with the forge.
    const price = (k, t) => GEAR[k].tiers[t].cost;
    const short = price('weapon', 1) - 1;
    c.gold = short;
    campAction('buy-gear', 'weapon');           // one short — cannot afford
    const poor = { gold: c.gold, was: short, tier: c.gear.weapon };
    const purse = price('weapon', 1) + price('armor', 1) + 500;
    c.gold = purse;
    campAction('buy-gear', 'weapon');
    campAction('buy-gear', 'armor');
    // The ladder itself: six rungs above the free kit on every track, each one
    // dearer than the last. A flat or non-monotonic rung is an economy bug the
    // eval would only catch as a number drifting.
    const ladder = {};
    for (const k in GEAR) {
      const t = GEAR[k].tiers;
      ladder[k] = { n: t.length - 1, free: t[0].cost === 0,
                    rising: t.every((x, i) => i === 0 || x.cost > t[i - 1].cost) };
    }
    return { poor, gold: c.gold, purse, spent: price('weapon', 1) + price('armor', 1),
             weapon: c.gear.weapon, armor: c.gear.armor, ladder };
  });
  ok('a purchase you cannot afford is a no-op',
     forge.poor.tier === 0 && forge.poor.gold === forge.poor.was, forge);
  ok('buying debits exactly the price and raises one tier',
     forge.gold === forge.purse - forge.spent && forge.weapon === 1 && forge.armor === 1, forge);
  ok('every gear track is a free kit plus six rungs, each dearer than the last',
     Object.values(forge.ladder).every((l) => l.n === GEAR_MAX && l.free && l.rising),
     forge.ladder);

  // The kit has to REACH the delve: startRun folds it into player stats once,
  // and nothing downstream re-reads it.
  const kitted = await page.evaluate(() => {
    const c = chr();
    c.gold = 999999;
    // Start from the free kit: the forge block above already bought a rung on
    // two tracks, and inheriting that put weapon and armor a tier ahead of the
    // table this check reads its expectations out of.
    c.gear = { weapon: 0, armor: 0, lantern: 0, charm: 0 };
    const T = 3;                       // the same rung on all four tracks
    for (const k in GEAR) for (let i = 0; i < T; i++) campAction('buy-gear', k);
    // Expected values come out of the table, so a retuned tier moves the check
    // with it and the check still measures what it is for: that the kit is
    // folded into `player` at all.
    const want = {
      atk: GEAR.weapon.tiers[T].atk, hp: GEAR.armor.tiers[T].hp,
      light: GEAR.lantern.tiers[T].light, gold: GEAR.charm.tiers[T].gold,
    };
    const light0 = 3.6;
    startRun();
    return {
      want, tiers: Object.values(c.gear),
      atk: player.atk, maxHp: player.maxHp, hp: player.hp,
      light: lightRadius(), light0, goldMult: goldMult(), marks: marksStairs(),
      stairsSeen: seen[IDX(stairs.x, stairs.y)] === 1,
    };
  });
  ok('four tracks bought to the same rung', kitted.tiers.every((t) => t === 3), kitted);
  ok('gear reaches the delve: attack', kitted.atk === 3 + kitted.want.atk, kitted);
  ok('gear reaches the delve: max HP, and you start full',
     kitted.maxHp === CURVE_HP + kitted.want.hp && kitted.hp === kitted.maxHp, kitted);
  ok('gear reaches the delve: light',
     Math.abs(kitted.light - (kitted.light0 + kitted.want.light)) < 1e-6, kitted);
  ok('gear reaches the delve: gold multiplier',
     Math.abs(kitted.goldMult - (1 + kitted.want.gold)) < 1e-9, kitted);
  ok('the Deepseeker Idol marks the stairs on arrival', kitted.marks && kitted.stairsSeen, kitted);

  // ---- skills: ONE tree, and the prerequisite rule that shapes it ----
  console.log('\n[skill tree]');
  const gate = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.sp = 40;
    campAction('rank', 'lantern');          // needs BOTH roots
    const bothRoots = rank('lantern');
    campAction('rank', 'edge');             // one root only
    const oneRoot = rank('lantern') === 0 && (campAction('rank', 'lantern'), rank('lantern') === 0);
    campAction('rank', 'hide');             // now both
    campAction('rank', 'lantern');
    const opened = rank('lantern');
    const sp1 = c.sp;
    campAction('rank', 'lantern');          // rank 2 costs 2
    const rank2 = { r: rank('lantern'), spent: sp1 - c.sp };
    campAction('rank', 'lantern');          // max 2
    return { bothRoots, oneRoot, opened, rank2, capped: rank('lantern'), sp: c.sp };
  });
  ok('a node with two inputs refuses until BOTH are taken',
     gate.bothRoots === 0 && gate.oneRoot === true, gate);
  ok('taking both inputs opens it', gate.opened === 1, gate);
  ok('rank r costs r', gate.rank2.r === 2 && gate.rank2.spent === 2, gate);
  ok('a maxed node takes no more points', gate.capped === 2, gate);

  // The capstone is the rule at full size: two complete paths, one down each
  // side. Walking only one side must not open it, however many points are in.
  const capstone = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.sp = 99;
    const left = ['edge', 'hide', 'lantern', 'heavy', 'vengeance', 'execution', 'trapwise', 'carto', 'bloodletter'];
    left.forEach((k) => campAction('rank', k));
    const halfWay = { blood: rank('bloodletter'), unbroken: rank('unbroken'), sovereign: rank('sovereign') };
    campAction('rank', 'sovereign');
    const refusedOnOneSide = rank('sovereign') === 0;
    ['bones', 'wind', 'stand', 'prospect', 'fortune', 'unbroken'].forEach((k) => campAction('rank', k));
    campAction('rank', 'sovereign');
    return { halfWay, refusedOnOneSide, sovereign: rank('sovereign'), spent: skillsSpent(), sp: c.sp };
  });
  ok('one full side reaches its own capstone', capstone.halfWay.blood === 1, capstone);
  ok('but the final capstone refuses one side alone', capstone.refusedOnOneSide === true, capstone);
  ok('both sides open it', capstone.sovereign === 1, capstone);
  ok('and the whole route costs 16 points', capstone.spent === 16, capstone);

  // Every declared edge has to point at a real node, or the picture and the
  // rule disagree and a node becomes unreachable with no way to tell.
  const wiring = await page.evaluate(() => {
    const keys = SKILLS.map((n) => n.key);
    const bad = [];
    const roots = SKILLS.filter((n) => n.in.length === 0).map((n) => n.key);
    for (const n of SKILLS) for (const k of n.in) if (keys.indexOf(k) === -1) bad.push(n.key + '<-' + k);
    // every node reachable from a root by following edges forward
    const reached = new Set(roots);
    for (let pass = 0; pass < SKILLS.length; pass++) {
      for (const n of SKILLS) if (!reached.has(n.key) && n.in.every((k) => reached.has(k))) reached.add(n.key);
    }
    return { bad, roots, unreachable: keys.filter((k) => !reached.has(k)), total: keys.length };
  });
  ok('every edge names a real node', wiring.bad.length === 0, wiring);
  ok('the tree has exactly two roots', wiring.roots.length === 2, wiring);
  ok('and every node is reachable from them', wiring.unreachable.length === 0, wiring);

  const respec = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.sp = 10; c.gold = 0;
    ['edge', 'edge', 'hide'].forEach((k) => campAction('rank', k));   // 1+2+1 = 4 points
    const spent = skillsSpent(), price = respecCost();
    campAction('respec');                                             // no gold
    const broke = { skills: Object.keys(c.skills).length, gold: c.gold };
    c.gold = price;
    campAction('respec');
    return { spent, price, broke, after: { skills: Object.keys(c.skills).length, sp: c.sp, gold: c.gold } };
  });
  ok('forgetting needs the gold', respec.broke.skills === 2, respec);
  ok('and refunds every point for it',
     respec.after.skills === 0 && respec.after.sp === 6 + respec.spent && respec.after.gold === 0, respec);

  // Effects, every one measured through the game's own functions.
  const skills = await page.evaluate(() => {
    const c = chr();
    c.gear = { weapon: 0, armor: 0, lantern: 0, charm: 0 };
    c.skills = {}; c.sp = 99;
    ['edge', 'edge', 'hide', 'hide', 'lantern', 'lantern', 'bones', 'heavy', 'vengeance',
     'execution', 'trapwise', 'prospect', 'prospect', 'wind', 'carto', 'fortune', 'stand',
     'bloodletter', 'unbroken', 'sovereign'].forEach((k) => campAction('rank', k));
    startRun();
    enemies = []; clearStatuses();
    const out = { maxHp: player.maxHp, atk: player.atk, light: lightRadius(), cap: damageCap() };

    // STONE BONES through a real hit
    player.hp = player.maxHp;
    let before = player.hp;
    hurtPlayer(3, player.x, player.y);
    out.smallHit = before - player.hp;

    // UNBROKEN caps a big one
    player.hp = player.maxHp;
    before = player.hp;
    hurtPlayer(40, player.x, player.y);
    out.bigHit = before - player.hp;

    // BLOODLETTER stacks per kill and resets on the stairs
    killStreak = 0;
    player.hp = player.maxHp;
    const flat = playerDamage();
    for (let i = 0; i < 3; i++) {
      const v = { id: 6000 + i, x: player.x, y: player.y, vx: player.x, vy: player.y, hp: 0, maxHp: 1, atk: 1, type: 'slime', aggro: true, seed: 1 };
      enemies.push(v); killEnemy(v);
    }
    out.stacked = playerDamage() - flat;
    completeDescend();
    out.afterStairs = killStreak;

    // SOVEREIGN puts LAST STAND back on every descent
    lastStandUsed = true;
    completeDescend();
    out.standBack = lastStandUsed === false;

    // PROSPECTOR through a real pickup
    enemies = []; clearStatuses();
    const d = DIRS.find(([dx, dy]) => grid[IDX(player.x + dx, player.y + dy)] === 0);
    items = [{ x: player.x + d[0], y: player.y + d[1], type: 'gold', amt: 10 }];
    traps = []; gold = 0; player.hp = player.maxHp;
    playerAct({ move: d });
    out.picked = gold;
    return out;
  });
  ok('KEEN EDGE ×2 and SOVEREIGN reach the delve', skills.atk === 3 + 2 + 2, skills);
  ok('THICK HIDE ×2 and SOVEREIGN reach the delve', skills.maxHp === 20 + 4 + 6, skills);
  ok('LAMPLIGHT ×2 and SOVEREIGN widen the light',
     Math.abs(skills.light - (3.6 + 1.4 + 1)) < 1e-6, skills);
  ok('STONE BONES shaves a small hit', skills.smallHit === 2, skills);
  ok('UNBROKEN caps a huge one at 4', skills.cap === 4 && skills.bigHit === 4, skills);
  ok('BLOODLETTER stacks with kills and resets on the stairs',
     skills.stacked === 3 && skills.afterStairs === 0, skills);
  ok('SOVEREIGN recharges LAST STAND on a descent', skills.standBack === true, skills);
  ok('PROSPECTOR ×2 turns a 10 pile into 15', skills.picked === 15, skills);

  // ---- traps and the statuses they leave ----
  console.log('\n[traps]');
  const trapKinds = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.gear = { weapon: 0, armor: 0, lantern: 0, charm: 0 };
    startRun();
    enemies = []; items = [];
    const out = {};
    const put = (type) => {
      clearStatuses();
      traps = [];
      const d = DIRS.find(([dx, dy]) => grid[IDX(player.x + dx, player.y + dy)] === 0 &&
                                        !(player.x + dx === stairs.x && player.y + dy === stairs.y) &&
                                        !(player.x + dx === chest.x && player.y + dy === chest.y));
      const t = { x: player.x + d[0], y: player.y + d[1], type, sprung: false };
      traps.push(t);
      player.hp = player.maxHp;
      const hp0 = player.hp;
      playerAct({ move: d });
      return { hp0, hp: player.hp, st: JSON.parse(JSON.stringify(statuses)), sprung: t.sprung };
    };
    out.spike = put('spike');
    out.snare = put('snare');
    out.venom = put('venom');
    out.tar = put('tar');
    out.gloom = put('gloom');
    out.frail = put('frail');
    return out;
  });
  ok('a SPIKE PIT bites and leaves no status',
     trapKinds.spike.hp < trapKinds.spike.hp0 && trapKinds.spike.st.stun === 0, trapKinds.spike);
  ok('an IRON SNARE stuns', trapKinds.snare.st.stun > 0, trapKinds.snare);
  ok('a VENOM VENT poisons', trapKinds.venom.st.venom > 0, trapKinds.venom);
  ok('a TAR SEEP slows', trapKinds.tar.st.slow > 0, trapKinds.tar);
  ok('a GLOOM GLYPH blinds', trapKinds.gloom.st.gloom > 0, trapKinds.gloom);
  ok('a WITHER RUNE withers', trapKinds.frail.st.frail > 0, trapKinds.frail);
  ok('and every one of them springs exactly once',
     Object.keys(trapKinds).every((k) => trapKinds[k].sprung === true), trapKinds);

  const trapEffects = await page.evaluate(() => {
    startRun();
    enemies = []; items = []; traps = [];
    const out = {};
    clearStatuses();
    out.lightClear = lightRadius();
    statuses.gloom = 5;
    out.lightBlind = lightRadius();
    clearStatuses();
    player.hp = player.maxHp;
    out.dmgClear = playerDamage();
    statuses.frail = 5;
    out.dmgWither = playerDamage();
    clearStatuses();

    // Poison drains on YOUR clock, one per turn, and runs out.
    player.hp = player.maxHp;
    statuses.venom = 3;
    const hp0 = player.hp;
    for (let i = 0; i < 3; i++) playerAct({ wait: true });
    out.venomDrain = hp0 - player.hp;
    const midHp = player.hp;
    for (let i = 0; i < 3; i++) playerAct({ wait: true });
    out.venomStops = midHp - player.hp === 0 && statuses.venom === 0;

    // Mired: the dark gets two goes for your one. Measured as SWINGS, not
    // steps — an enemy walking toward you can be blocked by the layout, but
    // one already beside you attacks every time enemiesAct runs, so the
    // reading cannot depend on which floor generated.
    clearStatuses();
    const beside = DIRS.find(([dx, dy]) => grid[IDX(player.x + dx, player.y + dy)] === 0);
    const swing = () => {
      enemies = [];
      spawnEnemy('slime', player.x + beside[0], player.y + beside[1], 1);
      enemies[0].aggro = true;
      player.hp = player.maxHp;
      const hp0 = player.hp;
      playerAct({ wait: true });
      return hp0 - player.hp;
    };
    out.normalHits = swing();
    statuses.slow = 5;
    out.miredHits = swing();
    clearStatuses();
    enemies = [];
    return out;
  });
  ok('a GLOOM GLYPH halves your light',
     trapEffects.lightBlind < trapEffects.lightClear * 0.6, trapEffects);
  ok('a WITHER RUNE halves your damage',
     trapEffects.dmgWither === Math.ceil(trapEffects.dmgClear / 2), trapEffects);
  ok('venom drains one per turn and then stops',
     trapEffects.venomDrain === 3 && trapEffects.venomStops === true, trapEffects);
  ok('mired, the dark swings twice for your one',
     trapEffects.normalHits > 0 && trapEffects.miredHits === trapEffects.normalHits * 2, trapEffects);

  const trapSkill = await page.evaluate(() => {
    const c = chr();
    c.skills = {}; c.sp = 99;
    startRun();
    enemies = []; items = [];
    const spring = (type) => {
      clearStatuses(); traps = [];
      const d = DIRS.find(([dx, dy]) => grid[IDX(player.x + dx, player.y + dy)] === 0 &&
                                        !(player.x + dx === stairs.x && player.y + dy === stairs.y) &&
                                        !(player.x + dx === chest.x && player.y + dy === chest.y));
      traps.push({ x: player.x + d[0], y: player.y + d[1], type, sprung: false });
      player.hp = player.maxHp;
      const hp0 = player.hp;
      playerAct({ move: d });
      return { dmg: hp0 - player.hp, gloom: statuses.gloom };
    };
    const bare = { spike: spring('spike').dmg, gloom: spring('gloom').gloom };
    ['edge', 'hide', 'lantern', 'trapwise'].forEach((k) => campAction('rank', k));
    startRun(); enemies = []; items = [];
    const wise = { spike: spring('spike').dmg, gloom: spring('gloom').gloom, has: rank('trapwise') };
    return { bare, wise };
  });
  ok('TRAPWISE halves the spike and the hold',
     trapSkill.wise.has === 1 && trapSkill.wise.spike < trapSkill.bare.spike &&
     trapSkill.wise.gloom < trapSkill.bare.gloom, trapSkill);

  /* THE AUTO-PATH IS BLIND TO TRAPS. It used to treat one you could see as a
     wall, which quietly played the game for you — every hazard on the board
     routed around for free. Avoiding a trap is the player's own work now, so
     what is asserted is the opposite of what used to be: a trap dropped onto
     the route changes nothing about the route.
     The setup still has to be SEARCHED for rather than assumed, and for the
     same reason the old version did: the trap has to sit on a cell the path
     would take anyway, and one that HAS a way round it. A cell with no detour
     would be crossed by any pathfinder, trap-aware or not, so the check would
     stay green with trap-blindness reverted. The cell with a detour is the
     only one that discriminates. */
  const trapPath = await page.evaluate(() => {
    const reachWithout = (bx, by, tx, ty) => {
      const d = bfsMap(tx, ty, (x, y) => grid[IDX(x, y)] === 0 && !(x === bx && y === by));
      return d[IDX(player.x, player.y)] >= 0;
    };
    // Both candidates must come from the SAME generated floor. The first
    // version kept regenerating until it had found each of them, so a detour
    // found on floor 0 was asserted against floor 3's layout — coordinates
    // that no longer meant anything. Flaky one run in five, and the flake
    // looked like a pathing bug rather than a test bug.
    let detour = null;
    for (let floor = 0; floor < 14 && !detour; floor++) {
      startRun();
      enemies = []; items = []; traps = [];
      seen.fill(1);
      const near = bfsMap(player.x, player.y, (x, y) => grid[IDX(x, y)] === 0);
      for (let ty = 1; ty < ROWS - 1 && !detour; ty++) {
        for (let tx = 1; tx < COLS - 1 && !detour; tx++) {
          if (grid[IDX(tx, ty)] !== 0) continue;
          const dt = near[IDX(tx, ty)];
          if (dt < 2 || dt > 7) continue;
          // The candidate has to sit ON the route the game would take with no
          // trap there at all — otherwise "the path avoided it" is true of a
          // cell the path was never going to touch, and the check passes with
          // trap-avoidance ripped out entirely. (It did.)
          traps = [];
          buildPathTo(tx, ty, false);
          if (!pathQueue.length) continue;
          const onRoute = pathQueue.slice(0, -1);
          for (const [cx, cy] of onRoute) {
            if (reachWithout(cx, cy, tx, ty)) { detour = { trap: [cx, cy], target: [tx, ty] }; break; }
          }
        }
      }
    }
    const out = { found: !!detour };
    if (detour) {
      traps = [];
      buildPathTo(detour.target[0], detour.target[1], false);
      const clean = pathQueue.map(([x, y]) => x + ',' + y).join(' ');
      traps = [{ x: detour.trap[0], y: detour.trap[1], type: 'spike', sprung: false }];
      buildPathTo(detour.target[0], detour.target[1], false);
      out.overIt = pathQueue.some(([x, y]) => x === detour.trap[0] && y === detour.trap[1]);
      out.identical = pathQueue.map(([x, y]) => x + ',' + y).join(' ') === clean;
      // the detour the old behaviour would have taken really does exist
      out.hadAWayRound = reachWithout(detour.trap[0], detour.trap[1],
                                      detour.target[0], detour.target[1]);
    }
    return out;
  });
  ok('found a floor with a trap ON the route that has a way round it',
     trapPath.found === true && trapPath.hadAWayRound === true, trapPath);
  ok('the auto-path walks you straight over a trap you can see',
     trapPath.overIt === true, trapPath);
  ok('and the route is the one it would have taken with no trap at all',
     trapPath.identical === true, trapPath);

  /* Springing one hands the board back. Most traps do no damage — a snare or a
     gloom glyph leaves only a status — so the interrupt every other hazard
     gets for free (taking a hit) never fires for them, and without this the
     walk would carry straight on through the thing that just went off. */
  const trapStops = await page.evaluate(() => {
    startRun();
    enemies = []; items = []; seen.fill(1);
    const d = bfsMap(player.x, player.y, (x, y) => grid[IDX(x, y)] === 0);
    let far = null;
    for (let y = 0; y < ROWS && !far; y++) for (let x = 0; x < COLS; x++) {
      if (d[IDX(x, y)] >= 5 && d[IDX(x, y)] <= 8) { far = [x, y]; break; }
    }
    if (!far) return { skip: true };
    traps = [];
    buildPathTo(far[0], far[1], false);
    const planned = pathQueue.length;
    const step = pathQueue[0];
    traps = [{ x: step[0], y: step[1], type: 'snare', sprung: false }];
    buildPathTo(far[0], far[1], false);
    const queued = pathQueue.length;
    playerAct({ move: [step[0] - player.x, step[1] - player.y] });
    return { planned, queued, left: pathQueue.length, stun: statuses.stun, sprung: traps[0].sprung };
  });
  ok('springing a trap stops the walk, even one that does no damage',
     trapStops.skip || (trapStops.queued > 1 && trapStops.sprung === true &&
                        trapStops.left === 0), trapStops);

  // ---- supplies: bought in camp, used in the delve, KEPT until used ----
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
    const price = {};
    for (const k of CONSUMABLE_KEYS) price[k] = CONSUMABLES[k].cost;
    return { bought, capped, carried, price };
  });
  ok('supplies are bought at their price',
     supply.bought.gold === 500 - supply.price.draught * 2 - supply.price.bomb -
       supply.price.dust && supply.bought.held.draught === 2, supply);
  ok('a supply caps at its stack size', supply.capped === 3, supply);
  ok('what you bought is what you carry in',
     supply.carried.draught === 2 && supply.carried.bomb === 3 && supply.carried.dust === 1, supply);

  const used = await page.evaluate(() => {
    enemies = [];
    player.hp = 1;
    const t0 = turnCount, n0 = consumables.draught, p0 = chr().supplies.draught || 0;
    useConsumable('draught');
    // The pack belongs to the CHARACTER, so using one has to come off both the
    // in-run stock and the stored one — that is what makes "kept until used"
    // survive a death, and what stops an abandoned run refunding the potion.
    const draught = { healed: player.hp, spent: n0 - consumables.draught, turns: turnCount - t0,
                      packBefore: p0, packAfter: chr().supplies.draught || 0 };

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
  ok('spending one takes it out of the pack too, not just the delve',
     used.draught.packBefore - used.draught.packAfter === 1, used);
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
  ok('dying pays gold and NEVER skill points',
     banked.sp === 0 && banked.best === 5 && banked.bank.newBest === true, banked);
  ok('unused supplies do NOT go down with the body — the pack is kept',
     banked.supplies.draught === 2, banked);
  ok('the run is recorded once', banked.runs === 1 && banked.kills === 4, banked);

  // checkDeath is state-guarded; a second call must not pay twice.
  const twice = await page.evaluate(() => {
    const before = chr().gold;
    checkDeath(); checkDeath();
    return { before, after: chr().gold };
  });
  ok('death cannot bank the same delve twice', twice.before === twice.after, twice);

  // ---- skill points are earned by DEPTH, once each ----
  console.log('\n[milestones]');
  const miles = await page.evaluate(() => {
    const c = chr();
    c.sp = 0; c.skills = {}; c.stats.deepest = 0; c.stats.spAwarded = 0; c.stats.bestDepth = 0;
    c.startFloor = 1;
    startRun();
    const log = [];
    for (let i = 0; i < 11; i++) {       // finish floors 1..11
      const before = c.sp;
      completeDescend();
      log.push({ finished: floorNum - 1, gained: c.sp - before });
    }
    return { log, sp: c.sp, deepest: c.stats.deepest, awarded: c.stats.spAwarded };
  });
  ok('a point lands on every fifth floor and nowhere else',
     miles.log.filter((l) => l.gained > 0).map((l) => l.finished).join(',') === '5,10', miles);
  ok('eleven floors is two points', miles.sp === 2 && miles.awarded === 2, miles);

  const refarm = await page.evaluate(() => {
    const c = chr();
    const spBefore = c.sp;
    c.startFloor = 1;
    startRun();
    for (let i = 0; i < 8; i++) completeDescend();   // floors 1..8, all already done
    return { spBefore, sp: c.sp, deepest: c.stats.deepest };
  });
  ok('re-finishing a floor pays nothing — farming is for gold only',
     refarm.sp === refarm.spBefore && refarm.deepest === 11, refarm);

  // ---- the starting depth ----
  console.log('\n[starting depth]');
  const depthPick = await page.evaluate(() => {
    const c = chr();
    c.stats.bestDepth = 12; c.startFloor = 1;
    campAction('depth', '5');
    const up = c.startFloor;
    campAction('depth', '-1');
    const down = c.startFloor;
    campAction('depth', 'max');
    const max = c.startFloor;
    campAction('depth', '5');
    const clamped = c.startFloor;
    campAction('depth', '-99');
    const floor = c.startFloor;
    return { up, down, max, clamped, floor };
  });
  ok('the depth picker steps by 1 and 5', depthPick.up === 6 && depthPick.down === 5, depthPick);
  ok('and clamps to the deepest floor reached',
     depthPick.max === 12 && depthPick.clamped === 12 && depthPick.floor === 1, depthPick);

  await page.reload();
  await page.waitForTimeout(350);
  const sticky = await page.evaluate(() => {
    activeSlot = 0;
    const c = chr();
    c.stats.bestDepth = 12; c.startFloor = 9; saveSlots();
    return { stored: JSON.parse(localStorage.getItem('emberDepths.slots.v1'))[0].startFloor };
  });
  ok('the chosen depth is stored on the character', sticky.stored === 9, sticky);
  await page.reload();
  await page.waitForTimeout(350);
  const started = await page.evaluate(() => {
    activeSlot = 0;
    const c = chr();
    const picked = startFloorOf();
    startRun();
    const opened = floorNum;
    // A dive that goes nowhere pays nothing: the depth bonus counts floors
    // below where you STARTED, not below floor 1.
    gold = 0; player.hp = 0;
    checkDeath();
    return { picked, opened, bonus: lastBank.depthBonus, earned: lastBank.earned, best: c.stats.bestDepth };
  });
  ok('a delve opens on the chosen depth', started.picked === 9 && started.opened === 9, started);
  ok('and diving deep to die on arrival pays nothing',
     started.bonus === 0 && started.earned === 0, started);

  // ---- no overlay may hide its own first row ----
  // #overlay is a flex column that scrolls, and a CENTRED one puts the first
  // rows above the scroll origin where no gesture can reach them. It is not a
  // long-screen problem: this shipped with the TITLE heading 9-24px out of
  // reach in landscape on every phone size, which is the first thing a player
  // sees. Swept across portrait AND landscape because the two fail on
  // different screens — camp overflows in portrait, the short ones only in
  // landscape.
  console.log('\n[overlay reach]');
  const unreachable = [];
  for (const [w, h] of [[390, 844], [375, 667], [320, 568], [844, 390], [740, 360]]) {
    const probe = await context.newPage();
    await probe.goto(URL);
    await probe.waitForTimeout(300);
    await probe.setViewportSize({ width: w, height: h });
    await probe.waitForTimeout(150);
    const rows = await probe.evaluate(() => {
      localStorage.clear(); loadSlots();
      const ov = document.getElementById('overlay');
      const top = (label) => {
        ov.scrollTop = -9999;                       // scroll as far up as it goes
        const first = ov.firstElementChild;
        if (!first) return { label, top: 0 };
        return { label, top: Math.round(first.getBoundingClientRect().top - ov.getBoundingClientRect().top) };
      };
      const out = [];
      showMenu(); out.push(top('title'));
      showSlots(); out.push(top('slots'));
      campAction('new', '0'); campAction('create', '0');
      campAction('erase-ask', '0'); out.push(top('slots/confirm-delete'));
      campAction('slots');
      campAction('pick', '0');
      const c = chr();
      c.gold = 900; c.sp = 9; c.stats.bestDepth = 14;
      c.skills = { edge: 1, hide: 1, lantern: 1, prospect: 1, fortune: 1 };
      campAction('tab', 'forge'); out.push(top('camp/forge'));
      campAction('tab', 'skills'); out.push(top('camp/skills'));
      campAction('tab', 'supply'); out.push(top('camp/supply'));
      startRun(); relics = []; openChest(); out.push(top('relic x' + relicOffer.length));
      startRun(); floorNum = 12; gold = 180; kills = 31; relics = ['blade', 'ward', 'skin'];
      player.hp = 0; checkDeath(); showDeath(); out.push(top('death'));
      return out;
    });
    for (const r of rows) if (r.top < 0) unreachable.push(w + 'x' + h + ' ' + r.label + ' ' + r.top);
    await probe.close();
  }
  ok('every overlay screen can be scrolled to its own first row',
     unreachable.length === 0, unreachable);

  ok('no page or console errors throughout', errs.length === 0, errs.join(' | '));

  console.log('\nEMBER DEPTHS DRIVE: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
