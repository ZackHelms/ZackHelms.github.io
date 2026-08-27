#!/usr/bin/env node
/**
 * eval-ember-depths.cjs — balance and pacing for games/ember-depths/.
 *
 * Rules live in drive-ember-depths.cjs; this file answers the two questions a
 * rules test cannot: **how deep does a delver get**, and **how fast does the
 * kit fill up?** Neither falls out of reading `CURVE` or `GEAR` — both fall
 * out of a few hundred played runs.
 *
 * THREE PERSONAS, one per skill band, because a single scripted player was
 * measuring one point on a curve the CD cares about the whole shape of:
 *
 *   NOVICE  — walks straight at the nearest gold, lets the auto-path carry it
 *             over traps it can see, takes whichever relic is on the left, and
 *             swings at whatever is adjacent. Drinks only when nearly dead.
 *   STEADY  — routes around a trap when a route exists, focuses the weakest
 *             adjacent enemy, drinks at half, throws a bomb at a crowd, and
 *             takes relics off a short preference list.
 *   VETERAN — never crosses a trap it can go round, and when it cannot, clears
 *             the floor's aggro FIRST and crosses on an empty board. Outnumbered,
 *             it backs into the tightest cell it can reach — a dead end or a
 *             corridor, where only one thing can reach it at a time — and fights
 *             there. This is the tactic the CD reported actually works, so the
 *             eval has to be able to play it or the top of the band is fiction.
 *
 * Two modes:
 *   DEPTH    — fixed builds (FRESH / KITTED / MAXED) x personas. What the
 *              difficulty curve is tuned against.
 *   CAMPAIGN — one character per persona playing N delves back to back, banking
 *              gold and SHOPPING between them through the camp's own
 *              `campAction`. What the economy is tuned against: the number that
 *              matters is **purchases per delve**, and the CD's spec is ~1.
 *
 * READ THIS BEFORE TRUSTING A NUMBER HERE. The personas are scripted, and even
 * VETERAN plays worse than a person: it does not count an archer's line or
 * decide a floor is a loss and run for the stairs. Treat the averages as a
 * FLOOR on what the CD will see; the assertions are banded accordingly — they
 * exist to catch a curve that has MOVED, not to certify a feel.
 *
 * Seeded: `seedSalt` makes floor generation reproducible, so re-running after a
 * constant changes compares curves rather than luck. Pass --seed to move the
 * whole cohort.
 *
 * Run: NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
 *      node .claude/tests/eval-ember-depths.cjs [--runs 20] [--delves 14] \
 *                                              [--seed 1234] [--report]
 *   --report prints the tables and skips the assertions (use while tuning).
 *   --depth / --campaign run only that half.
 */
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) { console.error('needs playwright-core resolvable (NODE_PATH=...)'); process.exit(1); }
const EXE = process.env.SMOKE_CHROMIUM ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'games', 'ember-depths', 'index.html');

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
};
const RUNS = argOf('runs', 20);
const DELVES = argOf('delves', 14);
const SEED = argOf('seed', 90210);
const REPORT_ONLY = argv.includes('--report');
const ONLY_DEPTH = argv.includes('--depth');
const ONLY_CAMPAIGN = argv.includes('--campaign');
const DO_DEPTH = !ONLY_CAMPAIGN;
const DO_CAMPAIGN = !ONLY_DEPTH;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

/* The personas, evaluated inside the page. They play the real game through
   playerAct / useConsumable / takeRelic / campAction — nothing here simulates
   a rule, and nothing here re-derives one. */
const PERSONA_SRC = `
/* A persona walks the way the UI walks: it picks a goal, builds ONE path to it,
   and follows that path until something interrupts — exactly what a tap does.
   An earlier version re-derived the next step every turn from a fresh BFS, and
   because that BFS routes around enemies, a foe shuffling in a corridor flipped
   the gradient and the delver paced between two tiles for 6000 turns. A persona
   that can deadlock does not measure difficulty, it measures the deadlock. */
let evalPath = [], evalGoalKey = '', evalStuck = 0, evalHold = 0, evalHoldHp = 0, evalSpot = null, evalNoChoke = 0, evalChokeBudget = 0, evalWaitTrap = 0, evalGoalAge = 0, evalRng = 1;
function evalRand() { evalRng = (evalRng * 1103515245 + 12345) & 0x7fffffff; return evalRng / 0x7fffffff; }
function evalReach() { return bfsMap(player.x, player.y, (x, y) => grid[IDX(x, y)] === 0); }
function evalTrapAt(x, y) {
  const t = trapAt(x, y);
  return !!t && !t.sprung && seen[IDX(x, y)] === 1;
}
/* NOTE the asymmetry with the shipping game: buildPathTo is deliberately BLIND
   to traps, so avoiding one is the player's own work. A persona that dodges has
   to do that work here, which is exactly the skill difference being measured. */
function evalBuildPath(tx, ty, dodgeTraps) {
  const okCell = (x, y) => grid[IDX(x, y)] === 0 &&
    (!enemyAt(x, y) || (x === tx && y === ty)) &&
    (!dodgeTraps || (x === player.x && y === player.y) || (x === tx && y === ty) ||
      !evalTrapAt(x, y));
  let dist = bfsMap(tx, ty, okCell);
  if (dist[IDX(player.x, player.y)] === -1 && dodgeTraps) return null;   // no clean route
  if (dist[IDX(player.x, player.y)] === -1) return [];
  const path = [];
  let cx = player.x, cy = player.y, guard = 400;
  while (!(cx === tx && cy === ty) && guard-- > 0) {
    const here = dist[IDX(cx, cy)];
    let best = null;
    for (const d of DIRS) {
      const nx = cx + d[0], ny = cy + d[1];
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      const dd = dist[IDX(nx, ny)];
      if (dd === -1 || dd >= here) continue;       // strictly downhill: no ping-pong
      if (!best || dd < best.d) best = { nx, ny, d: dd };
    }
    if (!best) break;
    cx = best.nx; cy = best.ny;
    path.push([cx, cy]);
  }
  return path;
}
function evalRoute(tx, ty, cfg) {
  if (cfg.dodgeTraps) {
    const clean = evalBuildPath(tx, ty, true);
    if (clean) return { path: clean, crossesTrap: false };
  }
  return { path: evalBuildPath(tx, ty, false) || [], crossesTrap: cfg.dodgeTraps };
}
/* The goal list, best first. It is a LIST rather than a single answer because
   a careful delver that cannot reach its first choice without crossing a trap
   takes its second choice instead — deferring is the skill, and you cannot
   defer to something you never computed. */
function evalGoals(cfg) {
  const deps = evalReach();
  const reach = (x, y) => deps[IDX(x, y)];
  const out = [];
  if (player.hp <= player.maxHp * cfg.healAt) {
    const hearts = items.filter((i) => i.type === 'heart' && seen[IDX(i.x, i.y)] && reach(i.x, i.y) >= 0);
    hearts.sort((a, b) => reach(a.x, a.y) - reach(b.x, b.y));
    for (const h of hearts) if (reach(h.x, h.y) <= 10) out.push(h);
  }
  if (!chest.opened && seen[IDX(chest.x, chest.y)] && reach(chest.x, chest.y) >= 0) out.push(chest);
  const piles = items.filter((i) => i.type === 'gold' && seen[IDX(i.x, i.y)] && reach(i.x, i.y) >= 0);
  piles.sort((a, b) => reach(a.x, a.y) - reach(b.x, b.y));
  for (const g of piles) if (reach(g.x, g.y) <= cfg.greed) out.push(g);
  if (seen[IDX(stairs.x, stairs.y)] && reach(stairs.x, stairs.y) >= 0) out.push(stairs);
  const frontier = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (seen[IDX(x, y)] || grid[IDX(x, y)] !== 0) continue;
    for (const d of DIRS) {
      const ax = x + d[0], ay = y + d[1];
      if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) continue;
      const r = reach(ax, ay);
      if (r >= 0) { frontier.push({ x, y, r }); break; }
    }
  }
  frontier.sort((a, b) => a.r - b.r);
  for (const f of frontier.slice(0, 6)) out.push(f);
  if (!out.length) out.push(stairs);
  return out;
}
/* Openness is the whole chokepoint idea, and it is measured off the board, not
   guessed: a cell with two floor neighbours is a corridor and a cell with one
   is a dead end, so standing there means at most one thing can be adjacent to
   you at a time (a wraith walks through walls and is the exception the tactic
   simply eats). */
function evalOpenness(x, y) {
  let n = 0;
  for (const d of DIRS) {
    const nx = x + d[0], ny = y + d[1];
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
    if (grid[IDX(nx, ny)] === 0) n++;
  }
  return n;
}
function evalHere() { return evalOpenness(player.x, player.y); }
/* Back into the tightest cell you can reach before the pack does. Only cells
   strictly closer to the player than to the nearest hunter are candidates —
   retreating INTO the enemy is how a clever tactic becomes a death. */
function evalChokepoint(aggro) {
  const mine = evalReach();
  const theirs = bfsMap(aggro[0].x, aggro[0].y, (x, y) => grid[IDX(x, y)] === 0);
  for (let i = 1; i < aggro.length; i++) {
    const d = bfsMap(aggro[i].x, aggro[i].y, (x, y) => grid[IDX(x, y)] === 0);
    for (let j = 0; j < theirs.length; j++) {
      if (d[j] >= 0 && (theirs[j] < 0 || d[j] < theirs[j])) theirs[j] = d[j];
    }
  }
  let best = null;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const i = IDX(x, y);
    if (grid[i] !== 0) continue;
    const md = mine[i];
    if (md < 0 || md > 4) continue;                 // not worth a long walk
    if (evalTrapAt(x, y)) continue;                 // a corner is not a corner if it bites
    const open = evalOpenness(x, y);
    if (open > 2) continue;                         // only corridors and dead ends
    if (theirs[i] >= 0 && theirs[i] <= md) continue; // they get there first
    const score = open * 100 + md;
    if (!best || score < best.score) best = { x, y, score, open };
  }
  return best;
}
function evalDist(e) { return Math.abs(e.x - player.x) + Math.abs(e.y - player.y); }
function evalTurn(cfg) {
  if (statuses.stun > 0) { playerAct({ wait: true }); return; }
  if (player.hp <= player.maxHp * cfg.drinkAt && (consumables.draught || 0) > 0) { useConsumable('draught'); return; }
  const near = enemies.filter((e) => evalDist(e) <= 2);
  if (near.length >= cfg.bombAt && (consumables.bomb || 0) > 0) { useConsumable('bomb'); return; }
  const adj = enemies.filter((e) => evalDist(e) === 1);
  // Only the pack that is actually COMING counts. An aggro slime six rooms away
  // is not a reason to stand still, and treating it as one is what made the
  // first version of this persona the worst of the three: it spent the floor
  // waiting in corridors while archers shot it.
  const pack = enemies.filter((e) => e.aggro && evalDist(e) <= 6);

  if (adj.length) {
    adj.sort((a, b) => a.hp - b.hp);
    evalPath = []; evalHold = 0; evalSpot = null;
    playerAct({ attack: adj[0] });
    return;
  }
  if (evalNoChoke > 0) evalNoChoke--;
  /* A per-floor budget on the whole tactic. Picking ground and holding it is
     worth turns, but only so many: without a ceiling every deep floor turned
     into a standoff and the run truncated instead of ending, which measures
     the eval rather than the game. Spend it and play the rest of the floor
     straight. */
  if (cfg.chokepoint && pack.length && evalNoChoke <= 0 && evalChokeBudget > 0) {
    /* A corner beats a crowd, but ONLY a crowd. Anything with a line on you
       beats the corner, because it never has to walk into it — the first
       version of this retreated from two archers and paced between the same
       two cells for a hundred turns while they shot it to death from down a
       straight column, which is how a 70 HP maxed build died on depth 7. So
       shooters are charged, not waited out. */
    const shooters = pack.filter((e) => e.type === 'archer' && losClear(e.x, e.y, player.x, player.y));
    if (shooters.length) {
      shooters.sort((a, b) => evalDist(a) - evalDist(b));
      const hunt = evalRoute(shooters[0].x, shooters[0].y, cfg);
      const step = hunt.path[0];
      evalSpot = null; evalHold = 0;
      if (step) {
        const foe = enemyAt(step[0], step[1]);
        evalChokeBudget--;
        if (foe) { playerAct({ attack: foe }); return; }
        if (playerAct({ move: [step[0] - player.x, step[1] - player.y] })) { evalPath = []; return; }
      }
    } else if (pack.filter((e) => evalDist(e) <= 5).length >= 3) {
      // COMMIT to the ground you picked. Re-choosing every turn is what makes
      // a retreat into a shuffle: the pack keeps moving, so the "best" cell
      // keeps changing, and you never actually arrive anywhere.
      const atSpot = evalSpot && evalSpot.x === player.x && evalSpot.y === player.y;
      if (!evalSpot || (!atSpot && evalHold > 8)) { evalSpot = evalChokepoint(pack); evalHold = 0; }
      if (evalSpot && !atSpot) {
        const route = evalRoute(evalSpot.x, evalSpot.y, cfg);
        const step = route.path[0];
        evalHold++; evalChokeBudget--;
        if (step && !enemyAt(step[0], step[1]) &&
            playerAct({ move: [step[0] - player.x, step[1] - player.y] })) {
          evalPath = []; evalHoldHp = player.hp; return;
        }
        evalSpot = null;
      } else if (atSpot && evalHold < 6 && pack.some((e) => evalDist(e) <= 4) &&
                 player.hp >= evalHoldHp) {
        evalHold++; evalChokeBudget--; playerAct({ wait: true }); return;   // they are coming to you
      } else {
        // Whatever it was is not coming. Holding a corner against something
        // that will not walk into it is a deadlock, not a tactic — drop the
        // ground and stay off it for a while, or the next turn re-picks the
        // same cell and the floor never ends.
        evalSpot = null; evalHold = 0; evalNoChoke = 15;
      }
    }
  }
  evalHoldHp = player.hp;

  const goals = evalGoals(cfg);
  /* STICK TO THE ERRAND. Two unexplored corners at the same distance are two
     attractors, and re-picking the nearest every time a path runs out walks
     the delver back and forth between them until the floor times out — 200
     consecutive moves, no enemies on the board, 0 progress. So the previous
     goal wins as long as it is still on the list and has not gone stale; a
     picked-up pile or a corner that has now been seen drops off the list by
     itself, which is what ends the errand honestly. */
  evalGoalAge++;
  let goal = goals[0];
  if (evalGoalKey && evalGoalAge < 30) {
    const keep = goals.find((g) => g.x + ',' + g.y === evalGoalKey);
    if (keep) goal = keep;
  }
  const key = goal.x + ',' + goal.y;
  if (key !== evalGoalKey) evalGoalAge = 0;
  if (key !== evalGoalKey || !evalPath.length) {
    evalGoalKey = key;
    const route = evalRoute(goal.x, goal.y, cfg);
    /* Crossing a trap while something is on top of you is how a stun becomes a
       death, so a veteran CLEARS FIRST: if the pack is already within reach it
       stands and lets it come, and crosses on the quiet board afterwards.
       Deliberately narrow. Two richer versions of this rule — hunt the pack
       across the floor, then defer to a different errand — both made the
       veteran the WORST persona of the three (a fully maxed build dying at
       depth 7, 350 turns spent not descending), because every extra turn spent
       near an enemy is an extra enemy turn. Waiting one step from the thing
       that is coming anyway costs nothing; going to find it costs the floor. */
    if (route.crossesTrap && cfg.clearBeforeTrap && evalWaitTrap > 0 &&
        pack.some((e) => evalDist(e) <= 2)) {
      // Bounded, because "wait for the board to clear" against something that
      // will not close is a deadlock: an archer holding at range two with no
      // line on you never arrives and never leaves, and the floor times out.
      evalWaitTrap--;
      evalPath = []; evalGoalKey = ''; playerAct({ wait: true }); return;
    }
    evalPath = route.path;
  }
  const step = evalPath.shift();
  if (!step) {
    /* Nowhere to go by plan. Almost always that means bodies in the way — the
       route BFS treats an occupied cell as blocked — so the honest answer is
       to fight through rather than shuffle. A deep floor at the enemy cap can
       otherwise pin a persona for a hundred turns and truncate the run, which
       measures the eval instead of the game. */
    const blocking = enemies.filter((e) => evalDist(e) <= 4);
    if (blocking.length) {
      blocking.sort((a, b) => evalDist(a) - evalDist(b));
      const through = evalBuildPath(blocking[0].x, blocking[0].y, false);
      const s2 = through && through[0];
      if (s2) {
        const foe = enemyAt(s2[0], s2[1]);
        if (foe) { playerAct({ attack: foe }); evalStuck = 0; return; }
        if (playerAct({ move: [s2[0] - player.x, s2[1] - player.y] })) { evalStuck = 0; return; }
      }
    }
    // Still nothing: shove in a legal direction rather than standing still,
    // which is what a person does when a corridor is contested.
    evalStuck++;
    const opts = DIRS.filter((d) => {
      const nx = player.x + d[0], ny = player.y + d[1];
      return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[IDX(nx, ny)] === 0;
    });
    if (opts.length) playerAct({ move: opts[Math.floor(evalRand() * opts.length)] });
    else playerAct({ wait: true });
    return;
  }
  if (enemyAt(step[0], step[1])) { evalPath = []; playerAct({ attack: enemyAt(step[0], step[1]) }); return; }
  if (!playerAct({ move: [step[0] - player.x, step[1] - player.y] })) { evalPath = []; evalStuck++; playerAct({ wait: true }); }
  else evalStuck = 0;
}
/* Relic choice is a skill too: the novice takes whatever is on the left, the
   veteran takes the thing its build wants. Both go through takeRelic. */
function evalPickRelic(cfg) {
  if (!cfg.relicOrder) { takeRelic(relicOffer[Math.floor(evalRand() * relicOffer.length)]); return; }
  let best = relicOffer[0], rank = 99;
  for (const k of relicOffer) {
    const r = cfg.relicOrder.indexOf(k);
    const score = r < 0 ? 50 : r;
    if (score < rank) { rank = score; best = k; }
  }
  takeRelic(best);
}
function evalRun(cfg, salt, cap) {
  seedSalt = salt;
  evalRng = (salt % 0x7fffffff) || 1;
  startRun();
  evalPath = []; evalGoalKey = ''; evalStuck = 0; evalHold = 0; evalHoldHp = player.hp; evalSpot = null; evalNoChoke = 0; evalChokeBudget = 40; evalWaitTrap = 8;
  let guard = 12000, lastFloor = floorNum, sinceFloor = 0, truncated = '';
  const startedAt = floorNum;
  while (state !== 'dead' && guard-- > 0 && floorNum <= cap) {
    if (state === 'relic') { evalPickRelic(cfg); continue; }
    if (state === 'descend') { completeDescend(); continue; }
    if (state !== 'play') break;
    if (floorNum !== lastFloor) { lastFloor = floorNum; sinceFloor = 0; evalChokeBudget = 40; evalWaitTrap = 8; evalSpot = null; evalNoChoke = 0; evalGoalAge = 0; }
    if (++sinceFloor > 900) { truncated = 'slow'; break; }
    if (evalStuck > 120) { truncated = 'stuck'; break; }
    evalTurn(cfg);
  }
  if (!truncated && guard <= 0) truncated = 'turns';
  if (!truncated && floorNum > cap) truncated = 'cap';
  const depth = floorNum, carried = gold;
  if (state !== 'dead') { player.hp = 0; state = 'play'; checkDeath(); }
  return { depth, startedAt, truncated, turns: turnCount, gold: carried, kills, relics: relics.length };
}

/* ---- the camp half: what the persona does with what it banked -------------
   Every purchase goes through campAction, the same switch the buttons call, so
   a shop that could not be afforded in the UI cannot be afforded here either. */
function evalGearCost(c, k) {
  const next = GEAR[k].tiers[c.gear[k] + 1];
  return next ? next.cost : Infinity;
}
function evalShop(cfg) {
  const c = chr();
  let bought = 0, guard = 40;
  while (guard-- > 0) {
    // Gear: the novice grabs whatever is cheapest, the veteran works its
    // priority order and saves for the rung it actually wants.
    let pick = null;
    if (cfg.gearOrder) {
      for (const k of cfg.gearOrder) { if (evalGearCost(c, k) <= c.gold) { pick = k; break; } }
    } else {
      let bestCost = Infinity;
      for (const k in GEAR) { const cost = evalGearCost(c, k); if (cost < bestCost) { bestCost = cost; pick = k; } }
      if (bestCost > c.gold) pick = null;
    }
    if (!pick) break;
    const before = c.gear[pick];
    campAction('buy-gear', pick);
    if (c.gear[pick] === before) break;
    bought++;
  }
  // Skills, spent down the persona's route. A point it cannot legally place is
  // simply left unspent — skillOpen is the game's rule, not the eval's.
  if (cfg.skillOrder) {
    for (let i = 0; i < 30 && c.sp > 0; i++) {
      let placed = false;
      for (const key of cfg.skillOrder) {
        const node = skillNode(key);
        if (!node || rank(key) >= node.max || !skillOpen(key) || c.sp < rank(key) + 1) continue;
        campAction('rank', key); placed = true; break;
      }
      if (!placed) break;
    }
  }
  // Supplies last, out of what is left over — a delver who spends the war chest
  // on potions never buys the sword.
  if (cfg.supplyBudget) {
    const floorGold = Math.max(0, c.gold - cfg.supplyBudget);
    for (const k of CONSUMABLE_KEYS) {
      for (let i = 0; i < CONSUMABLES[k].max; i++) {
        if (c.gold - CONSUMABLES[k].cost < floorGold) break;
        const held = c.supplies[k] || 0;
        campAction('buy-supply', k);
        if ((c.supplies[k] || 0) === held) break;
      }
    }
  }
  return bought;
}
/* One character, N delves, shopping in between — the only honest way to ask
   "how often do I get to buy something?". Returns a row per delve. */
function evalCampaign(cfg, seed, delves, cap) {
  localStorage.clear(); loadSlots();
  campAction('new', '0'); campAction('create', '0');
  const c = chr();
  const out = [];
  for (let i = 0; i < delves; i++) {
    const bought = evalShop(cfg);
    /* NOBODY DIVES, and that is a measurement rather than an assumption. The
       sticky start-depth lets you open at your deepest floor, and every persona
       that used it stalled dead: the payout counts floors below where you
       STARTED, so opening at your best means dying on arrival for nothing, and
       you skip every shallow floor's loot on the way. Measured over 12 delves
       it froze the steady and veteran characters at 7-8 gear tiers and nine
       consecutive delves with nothing to buy, while the same persona starting
       from floor 1 reached 20. Worth knowing before the economy is read off
       these numbers: this is the gold-optimal line, not a lazy one. */
    if (cfg.diveDeep) campAction('depth', 'max');
    const r = evalRun(cfg, seed + i * 7919, cap);
    out.push({ delve: i + 1, bought, depth: r.depth, from: r.startedAt,
               gold: c.gold, banked: c.stats.gold, sp: c.sp,
               gear: Object.values(c.gear).reduce((a, b) => a + b, 0),
               trunc: r.truncated });
  }
  return out;
}
`;

const fmt = (n, w) => String(n).padStart(w);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(URL);
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: PERSONA_SRC });
  await page.evaluate(() => { localStorage.clear(); loadSlots(); });

  /* The three skill bands. Everything that separates them is a decision a
     person makes at the board, not a stat: whether you look where you are
     walking, whether you pick your ground, and whether you buy on purpose. */
  const PERSONAS = {
    novice: {
      healAt: 0.35, drinkAt: 0.2, greed: 16, bombAt: 5,
      dodgeTraps: false, clearBeforeTrap: false, chokepoint: false,
      relicOrder: null, gearOrder: null, skillOrder: null,
      supplyBudget: 0, diveDeep: false,
    },
    steady: {
      healAt: 0.55, drinkAt: 0.4, greed: 9, bombAt: 3,
      dodgeTraps: true, clearBeforeTrap: false, chokepoint: false,
      relicOrder: ['blade', 'skin', 'crown', 'leech', 'ward', 'lantern'],
      gearOrder: null,
      skillOrder: ['edge', 'hide', 'lantern', 'bones', 'prospect', 'wind', 'heavy', 'vengeance'],
      supplyBudget: 120, diveDeep: false,
    },
    veteran: {
      healAt: 0.7, drinkAt: 0.5, greed: 7, bombAt: 3,
      dodgeTraps: true, clearBeforeTrap: true, chokepoint: true,
      relicOrder: ['blade', 'skin', 'leech', 'crown', 'ward', 'lantern'],
      gearOrder: ['weapon', 'armor', 'charm', 'lantern'],
      skillOrder: ['edge', 'hide', 'lantern', 'heavy', 'bones', 'vengeance', 'prospect', 'wind',
                   'execution', 'trapwise', 'carto', 'fortune', 'stand', 'bloodletter', 'unbroken', 'sovereign'],
      supplyBudget: 250, diveDeep: false,
    },
  };

  const results = {};
  if (DO_DEPTH) {
    // Fixed builds, applied by writing the character directly — the camp's own
    // buy/rank actions are the campaign half's business, and the drive suite's.
    const TOP = 6;
    const BUILDS = {
      FRESH:  { gear: { weapon: 0, armor: 0, lantern: 0, charm: 0 }, skills: {}, supplies: {} },
      KITTED: { gear: { weapon: 2, armor: 2, lantern: 1, charm: 1 },
                skills: { edge: 1, hide: 1, lantern: 1, bones: 1 },
                supplies: { draught: 2, bomb: 1 } },
      MAXED:  { gear: { weapon: TOP, armor: TOP, lantern: TOP, charm: TOP },
                skills: { edge: 2, hide: 2, heavy: 1, lantern: 2, bones: 1, vengeance: 1, trapwise: 1,
                          prospect: 2, wind: 1, execution: 1, carto: 1, fortune: 1, stand: 1,
                          bloodletter: 1, unbroken: 1, sovereign: 1 },
                supplies: { draught: 3, bomb: 3, dust: 3 } },
    };
    for (const buildName of Object.keys(BUILDS)) {
      for (const pName of Object.keys(PERSONAS)) {
        let rows = await page.evaluate(async (args) => {
          const [build, cfg, runs, seed] = args;
          localStorage.clear(); loadSlots();
          campAction('new', '0'); campAction('create', '0');
          const c = chr();
          const out = [];
          for (let i = 0; i < runs; i++) {
            c.gear = Object.assign({}, build.gear);
            c.skills = Object.assign({}, build.skills);
            c.supplies = Object.assign({}, build.supplies);
            c.startFloor = 1; c.stats.bestDepth = 0; c.stats.deepest = 0; c.stats.spAwarded = 0;
            const r = evalRun(cfg, seed + i * 7919, 200);
            out.push([r.depth, r.truncated, r.gold]);
          }
          seedSalt = 0;
          return out;
        }, [BUILDS[buildName], PERSONAS[pName], RUNS, SEED]);
        const trunc = rows.filter((d) => d[1]).length;
        const truncKinds = {};
        rows.forEach((d) => { if (d[1]) truncKinds[d[1]] = (truncKinds[d[1]] || 0) + 1; });
        const carried = rows.reduce((a, d) => a + d[2], 0) / rows.length;
        const depths = rows.map((d) => d[0]).sort((a, b) => a - b);
        const avg = depths.reduce((a, b) => a + b, 0) / depths.length;
        results[buildName + '/' + pName] = {
          avg: +avg.toFixed(2),
          median: depths[Math.floor(depths.length / 2)],
          p10: depths[Math.floor(depths.length * 0.1)],
          p90: depths[Math.floor(depths.length * 0.9)],
          max: depths[depths.length - 1],
          carried: Math.round(carried),
          trunc, truncKinds,
        };
      }
    }

    console.log('\n  DEPTH — build/persona     avg  med  p10  p90  max  gold   cut  (' + RUNS + ' runs, seed ' + SEED + ')');
    for (const k of Object.keys(results)) {
      const r = results[k];
      console.log('  ' + k.padEnd(22) + fmt(r.avg, 5) + fmt(r.median, 5) + fmt(r.p10, 5) +
        fmt(r.p90, 5) + fmt(r.max, 5) + fmt(r.carried, 6) + fmt(r.trunc, 6) + '  ' + JSON.stringify(r.truncKinds));
    }
    const cut = Object.values(results).reduce((a, r) => a + r.trunc, 0);
    console.log('  truncated runs: ' + cut + ' of ' + (RUNS * Object.keys(results).length));
  }

  const camp = {};
  if (DO_CAMPAIGN) {
    for (const pName of Object.keys(PERSONAS)) {
      const rows = await page.evaluate(async (args) => {
        const [cfg, seed, delves] = args;
        const out = evalCampaign(cfg, seed, delves, 200);
        seedSalt = 0;
        return out;
      }, [PERSONAS[pName], SEED, DELVES]);
      const totalGear = rows[rows.length - 1].gear;
      const boughtTotal = rows.reduce((a, r) => a + r.bought, 0);
      camp[pName] = {
        rows,
        perDelve: +(boughtTotal / rows.length).toFixed(2),
        gearTiers: totalGear,
        maxTiers: 24,
        endGold: rows[rows.length - 1].gold,
        deepest: rows.reduce((a, r) => Math.max(a, r.depth), 0),
        // How lumpy the spending is: a campaign that buys nothing for six
        // delves and then everything at once averages 1 and feels nothing like it.
        dryDelves: rows.filter((r) => r.bought === 0).length,
        bigDelves: rows.filter((r) => r.bought >= 3).length,
      };
    }
    console.log('\n  CAMPAIGN — ' + DELVES + ' delves each, shopping between (seed ' + SEED + ')');
    for (const pName of Object.keys(camp)) {
      const c = camp[pName];
      console.log('\n  ' + pName.toUpperCase() + ':  buys/delve ' + c.perDelve +
        ' · gear ' + c.gearTiers + '/' + c.maxTiers +
        ' · deepest ' + c.deepest + ' · ' + c.endGold + '◈ left' +
        ' · dry ' + c.dryDelves + ' · 3+ ' + c.bigDelves);
      console.log('    delve  from  depth  buys  gear  gold');
      for (const r of c.rows) {
        console.log('    ' + fmt(r.delve, 5) + fmt(r.from, 6) + fmt(r.depth, 7) +
          fmt(r.bought, 6) + fmt(r.gear, 6) + fmt(r.gold, 6) + (r.trunc ? '  ' + r.trunc : ''));
      }
    }
  }
  console.log('');

  if (!REPORT_ONLY) {
    if (DO_DEPTH) {
      const fresh = results['FRESH/steady'], novice = results['FRESH/novice'];
      const vet = results['FRESH/veteran'];
      const kit = results['KITTED/steady'], max = results['MAXED/steady'];
      // The CD's number, banded: a script plays worse than a person, so the
      // floor is what is asserted and the ceiling only catches a runaway curve.
      ok('a fresh delver averages about depth 8', fresh.avg >= 5 && fresh.avg <= 10, fresh);
      ok('and dying on the first two floors is rare', fresh.p10 >= 2, fresh);
      // The whole point of three personas: SKILL has to be worth something, or
      // the tactics the CD actually uses are not in the game.
      ok('skill is worth depth — the veteran outlives the novice',
         vet.avg > novice.avg, { novice, vet });
      ok('and greed alone is not skill', novice.avg <= fresh.avg + 2, { novice, fresh });
      ok('the first tiers of gear and skills are FELT', kit.avg >= fresh.avg + 1.5, { fresh, kit });
      ok('a finished build goes far deeper', max.avg >= fresh.avg * 2, { fresh, max });
      // "No ceiling" is the half a table cannot show: the curve has to keep
      // rising past any build, so even a maxed delver has to die.
      ok('but the dark still wins in the end — no build survives forever',
         max.max < 400 && max.avg < 200, max);
    }
    if (DO_CAMPAIGN) {
      // THE ECONOMY SPEC, in one number: about one new piece of kit per delve.
      // Banded wide because the personas reach very different depths, and a
      // band is what stops a re-tune chasing noise.
      for (const pName of Object.keys(camp)) {
        const c = camp[pName];
        ok(pName + ' buys roughly one piece of kit per delve',
           c.perDelve >= 0.55 && c.perDelve <= 1.9, { perDelve: c.perDelve, gear: c.gearTiers });
      }
      // Neither failure mode is acceptable: a kit that fills up in two delves,
      // or a ladder so steep the campaign never gets off the bottom rung.
      ok('nobody maxes the kit inside a short campaign',
         Object.values(camp).every((c) => c.gearTiers < c.maxTiers),
         Object.fromEntries(Object.keys(camp).map((k) => [k, camp[k].gearTiers])));
      ok('but a good player does climb the ladder', camp.veteran.gearTiers >= 8,
         { veteran: camp.veteran.gearTiers });
      ok('and skill still shows in the purse',
         camp.veteran.gearTiers >= camp.novice.gearTiers,
         { novice: camp.novice.gearTiers, veteran: camp.veteran.gearTiers });
    }
    ok('no page errors across every run', errs.length === 0, errs.join(' | '));
    console.log('\nEMBER DEPTHS EVAL: ' + pass + ' passed, ' + fail + ' failed');
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
