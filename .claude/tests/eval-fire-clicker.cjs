#!/usr/bin/env node
/**
 * eval-fire-clicker.cjs — pacing and economy for games/fire-clicker/.
 *
 * Rules live in drive-fire-clicker.cjs; this file answers the question a rules
 * test cannot: **how many days does a player need to reach each milestone, and
 * therefore how many real-world hours?** Fire Clicker runs in real time —
 * DAY_LEN is 300 s — so the conversion is fixed and blunt:
 *
 *     1 in-game day = 5 real minutes.   12 days = 1 hour of play.
 *
 * Everything here is reported in both units.
 *
 * TWO PERSONAS, the two ends of the CD's audience:
 *
 *   SPEEDRUN — taps the fire continuously (8 Hz) so the bank never empties,
 *              and spends on whatever maximises gathering throughput per unit
 *              cost, computed from the analytic model below rather than from a
 *              hand-written shopping list. Saves for a stage upgrade the moment
 *              one is visible, but still buys anything whose payback beats the
 *              wait. Never buys FIREKEEPER (it burns wood to do a job the
 *              tapping already does) and never buys FIRE PIT / DRY TINDER /
 *              WINDBREAK — at 8 taps a second the bank is free, so all three
 *              are worth exactly zero throughput. That is a finding, not a bug
 *              in the persona.
 *
 *   CASUAL   — taps at 3 Hz to get the camp started, buys the FIRST affordable
 *              upgrade in panel order with no regard for value, and **stops
 *              tapping entirely the moment FIREKEEPER is bought**, from then on
 *              living off the auto-stoker. Because a real person notices a dead
 *              fire, the default lets them re-light after DEAD_NOTICE seconds
 *              of cold; --casual-strict removes that and measures the literal
 *              never-taps-again case. As of 2026-08-28 the two are identical —
 *              one firekeeper sustains the fire indefinitely on its own, so the
 *              relight branch never fires and there is no soft-lock to find.
 *
 * BOTH PERSONAS PLAY THE REAL GAME. The harness steps the shipped
 * `dayStep`/`fireStep`/`villagerStep` and buys through the shipped `buyUpg()`;
 * it only skips the painters. Nothing about the economy is re-implemented here,
 * so a balance change lands in these numbers automatically.
 *
 * SPEED — MEASURED, not estimated. Rendering is ~all of a frame's cost, so
 * dropping the painters buys four orders of magnitude:
 *
 *   browser sim   ~18,000x realtime   ~60 game-days per wall-second
 *   analytic model (--model-only)     ~2,400 game-days per wall-second
 *                                     (~4,900 at --model-dt 5, same answers)
 *
 * Since 1 game-day is 5 real minutes, 60 game-days/s means **a full year of
 * hour-a-day play simulates in about 75 seconds**. The run prints its own
 * measured factor, so these numbers stay honest as the game grows.
 *
 * PRACTICAL CEILING. Budget ~1 wall-second per 60 game-days per persona-seed:
 * the default 200-day x 3-seed x 2-persona matrix is ~20 s, a 400-day matrix
 * ~40 s, and ten wall-minutes buys ~36,000 game-days — eight years of
 * hour-a-day play. So the harness is not the limit. **The game is**: the
 * economy's last meaningful purchase lands around day 15, and RECRUIT
 * VILLAGER's 1.75^n curve walls out near day 150 (POP 50 would cost ~2e12
 * wood and is unreachable in any human lifetime). Simulating past a few
 * hundred days measures the shape of that wall and nothing else.
 *
 * Run: NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
 *      node .claude/tests/eval-fire-clicker.cjs [--days 200] [--seeds 3]
 *                       [--dt 0.0333] [--persona speedrun|casual|both]
 *                       [--casual-strict] [--no-model] [--report]
 *   --report      prints the tables and skips the assertions (use while tuning).
 *   --no-model    skips the analytic estimator. It runs by default, printing its
 *                 error against the sim and asserting the MAE, because that
 *                 printout is the only thing that stops it silently rotting.
 *   --model-only  skips the browser entirely — the estimator alone, in
 *                 milliseconds. This is the mode for sweeping a balance
 *                 constant; the full run's MODEL vs SIM table is what licenses
 *                 trusting it. --model-dt sets its integration step (default 2 s;
 *                 5 s gives identical milestones and is 2.5x faster).
 *   --cycle-wait / --cycle-speed  the two fitted model constants, printed back
 *                 as `cycle measured / model` on every browser run. If that line
 *                 drifts past a few percent, the villager loop changed and these
 *                 need refitting before any model number is trustworthy.
 */
'use strict';
const path = require('path');
const fs = require('fs');
let chromium = null;   // --model-only never needs it, so a missing browser is not fatal here
try { ({ chromium } = require('playwright-core')); } catch (e) {}
const EXE = process.env.PLAYWRIGHT_CHROMIUM ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'games', 'fire-clicker', 'index.html');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt  = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const DAYS    = +opt('--days', 200);
const SEEDS   = +opt('--seeds', 3);
const DT      = +opt('--dt', 1/30);
const WHO     = opt('--persona', 'both');
const STRICT  = flag('--casual-strict');
const REPORT  = flag('--report');
/* The estimator runs BY DEFAULT. It costs ~0.2 s, and the only thing keeping it
   honest is its error being printed and asserted on every run — an estimator
   nobody checks becomes fiction within two commits. --no-model is the escape
   hatch, not --model the opt-in, so a bare `gates.sh --eval` still catches
   drift. (`--model` is kept as a no-op alias; it appears in older notes.) */
const WANT_MODEL = !flag('--no-model');
const VW = +opt('--vw', 390), VH = +opt('--vh', 844);
/* Throughput-model constants, CALIBRATED against the browser sim (see the
   `cycle measured / model` line the run prints). They are the game's own
   averages nudged to fit: villagers idle 0.4-1.2 s between trips, walk at
   46-60 px/s, and the mean is not quite the mean of the walk because the
   scarcest-first job pick is not uniform over the three sites. */
const CYCLE_WAIT  = +opt('--cycle-wait', 1.0);
const CYCLE_SPEED = +opt('--cycle-speed', 53);
const MODEL_ONLY  = flag('--model-only');
/* The model's integration step, in game seconds. Milestones are reported in
   days (300 s), so a few seconds of quantisation is free accuracy-wise and buys
   a linear speed-up. Raise it for a wide sweep, drop it to 1 to check that a
   result is not a step artefact. */
const MODEL_DT    = +opt('--model-dt', 2);
/* Stockpile->site distances at 390x844, measured off the shipped resize().
   Only used by --model-only, which never opens a browser; every run that does
   open one reads the live geometry instead. */
const DEFAULT_GEOM = { dist: [267.5, 154.5, 261.7] };
/* The fraction of a full bank at which the fire starts to ROAR. Mirrors the
   game's own const; the in-page half reads the real one off the page. */
const ROAR_AT = 0.75;

const DAY_MIN = 5;                       // DAY_LEN 300 s => 5 real minutes/day
const hhmm = (days) => {
  const mins = days * DAY_MIN;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h >= 24 ? (h / 24).toFixed(1) + 'd' : h + 'h' + String(m).padStart(2, '0');
};
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, d) => String(v === null || v === undefined ? '—' : (+v).toFixed(d === undefined ? 1 : d)).padStart(n);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
}

/* ===================== the persona run, executed inside the page ===================== */
/* Serialised to the browser. Everything it touches — S, UPG, buyUpg, villagerStep —
   is the shipped game's own top-level scope. */
async function inPage(cfg) {
  const R = { seed: cfg.seed, persona: cfg.persona, milestones: {}, stalled: null,
    trips: 0, tapCount: 0, workerSecs: 0, burnSecs: 0, baseTrips: 0, baseWorkerSecs: 0, roarSecs: 0 };

  // --- deterministic RNG for the whole run -------------------------------
  const realRandom = Math.random;
  let s = cfg.seed >>> 0;
  Math.random = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  try {
    // --- reset to a brand new camp ----------------------------------------
    try { localStorage.clear(); } catch (e) {}
    S = freshState();
    villagers.length = 0;
    for (const h of HOMES) h.inside = 0;
    for (let i = 0; i < seatTaken.length; i++) seatTaken[i] = false;
    FIRE.burning = false; FIRE.intensity = 0; FIRE.ember = 0;
    layoutBuildings(); bakeGround(); syncVillagers();

    // --- geometry the analytic model needs --------------------------------
    R.geom = {
      stock: { x: G.stock.x, y: G.stock.y },
      sites: JOBS.map(j => j.site()),
      W: W, H: H,
    };
    R.geom.dist = R.geom.sites.map(p => Math.hypot(p.x - G.stock.x, p.y - G.stock.y));

    // --- analytic throughput model (also drives the SPEEDRUN policy) ------
    const meanDist = R.geom.dist.reduce((a, b) => a + b, 0) / R.geom.dist.length;
    const CYCLE_WAIT = cfg.cycleWait, CYCLE_SPEED = cfg.cycleSpeed;
    /* Mean ROARING-FIRE scale over one tap sawtooth. A tapper who never wastes
       fuel lets the bank fall to maxBank - tapPower before topping it up, and
       holds the ROAR_AT line below that, so heat sweeps [hLow, 1] linearly in
       time. A DEEPER pit is a shallower sawtooth in FRACTIONAL terms, which is
       exactly why FIRE PIT now buys throughput rather than only comfort. */
    function roarScaleMean(maxB, tapP) {
      const hLow = Math.max(ROAR_AT, 1 - tapP / maxB);
      return 0.5 + 0.5 * Math.min(1, Math.max(0, ((hLow + 1) / 2 - ROAR_AT) / (1 - ROAR_AT)));
    }
    function rateWith(up) {
      const saved = S.up; S.up = up;
      const pop = popCap(), yld = tripYield();
      const speed = CYCLE_SPEED * (up.tavern ? 1.15 : 1);
      const work = up.sawbones ? 2.4 : 3.2;
      // ROARING FIRE scales the whole cycle, and only a persona that actually
      // tends the fire gets it — the firekeeper never crosses the 75% line.
      // The bonus RAMPS with heat, so what matters is the MEAN scale over the
      // tap sawtooth, not the peak: see roarScaleMean() in the harness header.
      const boost = cfg.roars ? 1 + (0.1 + 0.1 * (up.bellows || 0)) * roarScaleMean(maxBank(), tapPower()) : 1;
      const cycle = (CYCLE_WAIT + 2 * meanDist / speed + work) / boost;
      S.up = saved;
      return pop * yld / cycle;               // resource units per second, all pools
    }
    const clone = (u) => Object.assign({}, u);

    /* The marginal value of one more level of `id`. A HOUSE raises no rate on
       its own — it is worth exactly the RECRUITs it unlocks — so an upgrade
       that scores zero gets re-priced as a bundle with what it enables. */
    function value(id) {
      const u = UPG.find(x => x.id === id);
      const now = clone(S.up), base = rateWith(now);
      const after = clone(now); after[id] = (after[id] || 0) + 1;
      const c = u.cost(now[id] || 0);
      let cost = 0; for (const k of Object.keys(c)) cost += c[k];
      let gain = rateWith(after) - base;
      if (gain <= 0 && id === 'house') {
        const bu = UPG.find(x => x.id === 'bunk'), b = clone(after);
        for (let n = 0; n < 5; n++) {
          const sv = S.up; S.up = b; const room = (b.bunk || 0) < maxOf(bu); S.up = sv;
          if (!room) break;
          const bc = bu.cost(b.bunk || 0);
          for (const k of Object.keys(bc)) cost += bc[k];
          b.bunk = (b.bunk || 0) + 1;
        }
        gain = rateWith(b) - base;
      }
      return { gain, cost, ratio: cost > 0 ? gain / cost : 0 };
    }

    const STAGE_IDS = ['village', 'town', 'city', 'metropolis'];
    /* MICROMANAGEMENT raises no rate, so the marginal-value greedy would never
       buy it. It is a capability — it removes the tax of gathering into pools
       the next purchase does not need — so a skilled player takes it on sight. */
    const CAPABILITY_IDS = ['micro'];
    const buyable = () => UPG.filter(u => showU(u) && (S.up[u.id] || 0) < maxOf(u));
    const afford  = (u) => canAfford(u.cost(S.up[u.id] || 0));

    function shopSpeedrun() {
      // A visible stage upgrade is the goal: save for it, but still take any
      // buy whose payback lands before the stage would otherwise be affordable.
      const goal = buyable().find(u => STAGE_IDS.includes(u.id));
      let bought = true;
      while (bought) {
        bought = false;
        const cap = buyable().find(u => CAPABILITY_IDS.includes(u.id) && afford(u));
        if (cap && buyUpg(cap.id)) { bought = true; continue; }
        if (goal && afford(goal)) { if (buyUpg(goal.id)) { bought = true; continue; } }
        const rate = rateWith(S.up) || 1e-6;
        let waitToGoal = Infinity;
        if (goal) {
          const c = goal.cost(S.up[goal.id] || 0);
          let need = 0; for (const k of Object.keys(c)) need += Math.max(0, c[k] - S.res[k]);
          waitToGoal = need / (rate / 3);     // pools fill roughly evenly
        }
        let best = null;
        for (const u of buyable()) {
          if (u === goal || STAGE_IDS.includes(u.id) || CAPABILITY_IDS.includes(u.id)) continue;
          if (u.id === 'keeper') continue;     // a continuous tapper never needs one
          if (!afford(u)) continue;
          const v = value(u.id);
          if (v.gain <= 0) continue;
          const payback = v.cost / v.gain;     // seconds of gathering to earn it back
          if (goal && payback > waitToGoal) continue;
          if (!best || v.ratio > best.v.ratio) best = { u, v };
        }
        if (best && buyUpg(best.u.id)) bought = true;
      }
    }

    /* The skill expression MICROMANAGEMENT buys: aim the whole camp at the
       resource the next intended purchase is furthest short of, and release
       them once it is covered. A naive player owns the same button and never
       touches it. */
    function directWork() {
      if (!S.up.micro) return;
      const goal = buyable().find(u => STAGE_IDS.includes(u.id));
      let target = goal;
      if (!target) {
        let best = null;
        for (const u of buyable()) {
          if (CAPABILITY_IDS.includes(u.id) || u.id === 'keeper') continue;
          const v = value(u.id);
          if (v.gain > 0 && (!best || v.ratio > best.v.ratio)) best = { u, v };
        }
        target = best && best.u;
      }
      if (!target) { S.focus = null; return; }
      const c = target.cost(S.up[target.id] || 0);
      let worst = null, need = 0;
      for (const k of Object.keys(c)) {
        const short = c[k] - S.res[k];
        if (short > need) { need = short; worst = k; }
      }
      S.focus = worst;               // null once every pool covers the cost
    }

    function shopCasual() {
      // first affordable in panel order, no value judgement at all
      let bought = true;
      while (bought) {
        bought = false;
        for (const u of buyable()) { if (afford(u) && buyUpg(u.id)) { bought = true; break; } }
      }
    }

    // --- milestones --------------------------------------------------------
    const MS = [];
    MS.push({ k: 'FIRE LIT', f: () => S.lifeWarm > 0 });
    for (const u of UPG) MS.push({ k: u.n + ' Lv1', f: () => (S.up[u.id] || 0) >= 1 });
    for (let h = 3; h <= 10; h++) MS.push({ k: 'HOUSE #' + h, f: () => houses() >= h });
    for (const p of [10, 15, 20, 25, 50]) MS.push({ k: 'POP ' + p, f: () => popCap() >= p });
    /* The end of the CURRENT content for anyone buying on value: FIRE PIT,
       DRY TINDER, WINDBREAK and FIREKEEPER move no resources, so a speedrunner
       never touches them and 'ALL MAXED' is unreachable for that persona by
       design. This is the marker that means "nothing left that changes the
       economy". */
    const THRU = ['tools', 'village', 'tavern', 'shop', 'sawbones', 'bellows', 'micro'];
    MS.push({ k: 'ECONOMY MAXED', f: () => THRU.every(id => { const u = UPG.find(x => x.id === id); return (S.up[id] || 0) >= maxOf(u); }) });
    MS.push({ k: 'ALL MAXED', f: () => UPG.every(u => !showU(u) || (S.up[u.id] || 0) >= maxOf(u)) });
    const left = MS.slice();

    // --- the loop ----------------------------------------------------------
    const dt = cfg.dt;
    let t = 0, tapAcc = 0, actAcc = 0, cold = 0, lastProgress = 0, prevTotal = 0;
    let tapping = true;
    const gameT = () => (S.day - 1 + S.dayT) * DAY_LEN;
    const totalRes = () => S.res.wood + S.res.stone + S.res.food;

    while (S.day <= cfg.maxDays) {
      // ---- persona input
      if (cfg.persona === 'casual' && (S.up.keeper || 0) >= 1) {
        /* Hands off the moment the auto-stoker is hired. A person still notices
           a dead fire, though, and when they step in they top the bank back up
           rather than poking it once — tapping once and walking away leaves the
           camp livelocked at one second of fire per twenty, which is a bug in
           the persona, not a finding about the game. --casual-strict removes
           the noticing entirely and measures the true never-taps-again case. */
        if (!R.handedOver) { R.handedOver = true; tapping = false; R.stoppedTappingAt = t; }
        if (!FIRE.burning) cold += dt; else cold = 0;
        if (!cfg.strict && cold > 20) tapping = true;
        if (tapping && S.bank >= maxBank() * 0.8) { tapping = false; cold = 0; }
      }
      if (tapping) {
        // Capacity-limited, not mash-limited: a tap that overflows the bank is
        // thrown away, so both personas tap only when a full tapPower() fits.
        // tapCount is therefore the real tapping DEMAND the game places on a
        // player, not a count of futile jabs.
        const hz = cfg.persona === 'speedrun' ? 8 : 3;
        tapAcc += hz * dt;
        while (tapAcc >= 1) {
          tapAcc -= 1;
          // Tap when a full tapPower() fits (no waste), or — for a persona
          // that wants the ROARING bonus — when the bank is about to fall
          // through the 75% line before the next tap could land. tapCount is
          // therefore the true effort the game asks of this player.
          const fits = S.bank <= maxBank() - tapPower();
          const losingRoar = cfg.roars && S.bank < maxBank() * ROAR_AT + drainRate() / hz;
          if (fits || losingRoar) { stoke(G.fire.x, G.fire.y - 8, tapPower()); R.tapCount++; }
          else break;
        }
      }

      // ---- the game's own step (painters skipped)
      dayStep(dt);
      fireStep(dt);
      syncVillagers();
      // Calibration counters: the analytic model's `cycle` and `uptime` are
      // guesses until they are measured against the villagers actually walking.
      for (const v of villagers) {
        const was = v.state;
        villagerStep(v, dt);
        if (!v.keeper) {
          // Calibrate against the model's UN-boosted cycle by charging worker
          // time at the heat multiplier: a roaring second is worth `heatBoost()`
          // ordinary seconds of work, so the ratio stays comparable for a
          // persona that is roaring the whole run.
          const base = !S.up.tavern && !S.up.sawbones;
          if (was === 'toStock' && v.state === 'idle') { R.trips++; if (base) R.baseTrips++; }
          if (FIRE.burning) { R.workerSecs += dt; if (base) R.baseWorkerSecs += dt * heatBoost(); }
        }
      }
      if (FIRE.burning) R.burnSecs += dt;
      if (roaring()) R.roarSecs += dt;
      floats.length = 0; chips.length = 0; motes.length = 0; sparks.length = 0;

      t += dt;
      actAcc += dt;
      if (actAcc >= 0.5) {
        actAcc = 0;
        if (cfg.persona === 'speedrun') { shopSpeedrun(); directWork(); } else shopCasual();
        for (let i = left.length - 1; i >= 0; i--) {
          if (left[i].f()) {
            R.milestones[left[i].k] = { day: S.day - 1 + S.dayT, sec: gameT() };
            left.splice(i, 1);
            lastProgress = t;
          }
        }
        const total = totalRes();
        if (total > prevTotal + 1e-9) lastProgress = t;
        prevTotal = total;
        if (t - lastProgress > DAY_LEN * 3) {
          R.stalled = { at: S.day - 1 + S.dayT, res: Object.assign({}, S.res), up: Object.assign({}, S.up), burning: FIRE.burning };
          break;
        }
        if (!left.length) break;
      }
    }
    R.endDay = S.day - 1 + S.dayT;
    R.simSeconds = t;
    R.finalUp = Object.assign({}, S.up);
    R.finalRes = { wood: Math.floor(S.res.wood), stone: Math.floor(S.res.stone), food: Math.floor(S.res.food) };
    R.pop = popCap();
    /* Invariant guard: nobody should be parked in a FIREKEEPER state while not
       flagged a keeper. A villager in that limbo never gathers again. */
    R.stranded = villagers.filter(v => !v.keeper && (v.state === 'keeperGo' || v.state === 'keeperWait')).length;

    /* The wall: what the run was still saving for when the cap hit, and how
       long that purchase is away at the rate it ends on. This is the number
       that says how much playable content is actually left. */
    {
      const rate = rateWith(S.up);
      let next = null;
      const pool = UPG.filter(x => showU(x) && (S.up[x.id] || 0) < maxOf(x))
        // the speedrunner is not waiting for something it would never buy
        .filter(x => cfg.persona !== 'speedrun' || (x.id !== 'keeper' && value(x.id).gain > 0));
      for (const u of pool) {
        const c = u.cost(S.up[u.id] || 0);
        let need = 0; for (const k of Object.keys(c)) need += Math.max(0, c[k] - S.res[k]);
        const days = need / Math.max(1e-9, rate * 0.8) / DAY_LEN;   // scarcest pool takes 80% of trips
        if (!next || days < next.days) next = { id: u.id, n: u.n, lvl: (S.up[u.id] || 0) + 1, days };
      }
      R.wall = next;
    }
    R.modelRate = rateWith(S.up);
    R.meanDist = meanDist;
    R.uptime = t > 0 ? R.burnSecs / t : 0;
    R.roarUptime = t > 0 ? R.roarSecs / t : 0;
    R.obsCycle = R.trips > 0 ? R.workerSecs / R.trips : null;          // measured seconds per trip, whole run
    R.baseCycle = R.baseTrips > 0 ? R.baseWorkerSecs / R.baseTrips : null; // ... before tavern/sawbones
    R.modelCycle = CYCLE_WAIT + 2 * meanDist / CYCLE_SPEED + 3.2;      // the model's un-upgraded prediction
  } finally {
    Math.random = realRandom;
  }
  return R;
}

/* ===================== the analytic model, pure Node ===================== */
/* Same policy, no villagers and no browser. Resources accrue at the closed-form
   rate and purchases are discrete, so 400 days finishes in single-digit
   milliseconds. This is the estimator to reach for when balancing — "what does
   doubling the FOUND VILLAGE cost do to time-to-village" is a question it
   answers instantly. It is only trustworthy while the MODEL vs SIM table below
   shows a small error, which is why the two always print together. */
function modelRun(spec, persona, maxDays, strict) {
  const roars = persona === 'speedrun';   // only a hand-tended fire crosses 75%
  const { UPGS, levels: up, meanDist } = spec;
  for (const u of UPGS) up[u.id] = 0;
  const res = { wood: 0, stone: 0, food: 0 };
  const maxOf = (u) => typeof u.max === 'function' ? u.max() : u.max;
  const showU = (u) => !u.show || u.show();
  const houses = () => Math.min(2 + up.house, up.village ? 10 : 5);
  const popCap = () => Math.min(4 + up.bunk, houses() * 5);
  const tripYield = () => 1 + up.tools + (up.shop ? 1 : 0);

  /* Mean ROARING-FIRE scale over one tap sawtooth — mirror of the in-page
     helper. Kept as a formula on (maxBank, tapPower) so a change to FIRE PIT
     or DRY TINDER reprices itself here without a second edit. */
  function roarScaleMean(maxB, tapP) {
    const hLow = Math.max(ROAR_AT, 1 - tapP / maxB);
    return 0.5 + 0.5 * Math.min(1, Math.max(0, ((hLow + 1) / 2 - ROAR_AT) / (1 - ROAR_AT)));
  }

  /* rate = workers x yield / cycle, cycle = idle + round trip + work.
     Constants are the game's own: idle wait 0.4-1.2 s (mean 0.8), villager
     speed 46-60 px/s (mean 53) x tavern, work 3.2 s (2.4 with sawbones). */
  function rateAt(over) {
    const sv = {}; for (const k of Object.keys(over || {})) { sv[k] = up[k]; up[k] = over[k]; }
    const speed = CYCLE_SPEED * (up.tavern ? 1.15 : 1);
    const boost = roars ? 1 + (0.1 + 0.1 * (up.bellows || 0)) * roarScaleMean(5 + up.pit * 5, 1 + up.tinder * 0.5) : 1;
    const cycle = (CYCLE_WAIT + 2 * meanDist / speed + (up.sawbones ? 2.4 : 3.2)) / boost;
    const r = popCap() * tripYield() / cycle;
    for (const k of Object.keys(sv)) up[k] = sv[k];
    return r;
  }
  const canAfford = (c) => Object.keys(c).every(k => res[k] >= c[k]);
  const costSum = (c) => Object.keys(c).reduce((a, k) => a + c[k], 0);
  const STAGE_IDS = ['village', 'town', 'city', 'metropolis'];
  const CAPABILITY_IDS = ['micro'];   // raises no rate; a skilled player takes it on sight
  const buyable = () => UPGS.filter(u => showU(u) && up[u.id] < maxOf(u));
  const buy = (u) => { const c = u.cost(up[u.id]); for (const k of Object.keys(c)) res[k] -= c[k]; up[u.id]++; };

  const MS = [{ k: 'FIRE LIT', f: () => true }];
  for (const u of UPGS) MS.push({ k: u.n + ' Lv1', f: () => up[u.id] >= 1 });
  for (let h = 3; h <= 10; h++) MS.push({ k: 'HOUSE #' + h, f: () => houses() >= h });
  for (const p of [10, 15, 20, 25, 50]) MS.push({ k: 'POP ' + p, f: () => popCap() >= p });
  const THRU = ['tools', 'village', 'tavern', 'shop', 'sawbones', 'bellows', 'micro'];
  MS.push({ k: 'ECONOMY MAXED', f: () => THRU.every(id => up[id] >= maxOf(UPGS.find(x => x.id === id))) });
  MS.push({ k: 'ALL MAXED', f: () => UPGS.every(u => !showU(u) || up[u.id] >= maxOf(u)) });
  const left = MS.slice(), out = {};

  /* The resource the next intended purchase is furthest short of — what a
     player with MICROMANAGEMENT aims the camp at. */
  function directed() {
    const goal = buyable().find(u => STAGE_IDS.includes(u.id));
    let target = goal;
    if (!target) {
      let best = null;
      for (const u of buyable()) {
        if (CAPABILITY_IDS.includes(u.id) || u.id === 'keeper') continue;
        const base = rateAt();
        const gain = rateAt({ [u.id]: up[u.id] + 1 }) - base;
        if (gain <= 0) continue;
        const ratio = gain / costSum(u.cost(up[u.id]));
        if (!best || ratio > best.ratio) best = { u, ratio };
      }
      target = best && best.u;
    }
    if (!target) return null;
    const c = target.cost(up[target.id]);
    let worst = null, need = 0;
    for (const k of Object.keys(c)) { const short = c[k] - res[k]; if (short > need) { need = short; worst = k; } }
    return worst;
  }

  const dt = MODEL_DT, DAY = 300;
  let t = 0, uptime = 1;
  while (t < maxDays * DAY) {
    /* Income does NOT split evenly. `villagerStep` picks the scarcest resource
       with p=0.7 and otherwise picks uniformly, so the scarcest pool takes 80%
       of all trips and the other two 10% each. That self-routing is why the
       camp recovers so fast from a lopsided purchase — a model that split the
       income three ways ran ~30% pessimistic against the sim. */
    const total = rateAt() * uptime * dt;
    const focus = (roars && up.micro) ? directed() : null;
    if (focus) {
      res[focus] += total;          // MICROMANAGEMENT: every trip goes where it is told
    } else {
      const pools = ['wood', 'stone', 'food'].sort((a, b) => res[a] - res[b]);
      res[pools[0]] += total * 0.8; res[pools[1]] += total * 0.1; res[pools[2]] += total * 0.1;
    }
    if (persona === 'casual' && up.keeper) {
      /* The auto-stoker throws one log (1 wood) for +4 s of bank, so the wood
         it eats tracks the DRAIN, not the number of keepers — extra keepers
         share one bank and just take turns. Charging per keeper made the model
         run ~12% pessimistic for this persona. */
      res.wood -= dt * (1 / (1 + up.wind * 0.09)) / 4;
      if (res.wood < 0) { res.wood = 0; if (strict) uptime = 0; }
    }
    t += dt;

    let bought = true;
    while (bought) {
      bought = false;
      // Cheap gate first: most ticks nothing is affordable, and the value scan
      // below costs a dozen rate evaluations. Skipping it when there is nothing
      // to buy is what makes the model ~40x faster than the browser sim.
      const aff = buyable().filter(u => canAfford(u.cost(up[u.id])));
      if (!aff.length) break;
      if (persona === 'casual') { buy(aff[0]); bought = true; continue; }
      const cap = aff.find(u => CAPABILITY_IDS.includes(u.id));
      if (cap) { buy(cap); bought = true; continue; }
      const goal = buyable().find(u => STAGE_IDS.includes(u.id));
      if (goal && canAfford(goal.cost(up[goal.id]))) { buy(goal); bought = true; continue; }
      let waitToGoal = Infinity;
      if (goal) {
        const c = goal.cost(up[goal.id]);
        let need = 0; for (const k of Object.keys(c)) need += Math.max(0, c[k] - res[k]);
        waitToGoal = need / Math.max(1e-6, rateAt() / 3);
      }
      let best = null;
      for (const u of aff) {
        if (STAGE_IDS.includes(u.id) || CAPABILITY_IDS.includes(u.id) || u.id === 'keeper') continue;
        const c = u.cost(up[u.id]);
        const base = rateAt();
        let gain = rateAt({ [u.id]: up[u.id] + 1 }) - base, cost = costSum(c);
        if (gain <= 0 && u.id === 'house') {
          const bu = UPGS.find(x => x.id === 'bunk');
          const b = { house: up.house + 1, bunk: up.bunk };
          for (let n = 0; n < 5; n++) {
            const sv = up.house; up.house = b.house;
            const room = b.bunk < maxOf(bu); up.house = sv;
            if (!room) break;
            cost += costSum(bu.cost(b.bunk)); b.bunk++;
          }
          gain = rateAt(b) - base;
        }
        if (gain <= 0) continue;
        if (goal && cost / gain > waitToGoal) continue;
        const ratio = gain / cost;
        if (!best || ratio > best.ratio) best = { u, ratio };
      }
      if (best) { buy(best.u); bought = true; }
    }
    for (let i = left.length - 1; i >= 0; i--) if (left[i].f()) { out[left[i].k] = { day: t / DAY }; left.splice(i, 1); }
    if (!left.length) break;
  }
  return { milestones: out, endDay: t / DAY, up: Object.assign({}, up) };
}

/* ===================== driver ===================== */
(async () => {
  if (MODEL_ONLY) {
    /* No browser at all: the analytic estimator on its own. This is the mode to
       use when sweeping a balance constant — it answers in milliseconds, and the
       full run's MODEL vs SIM table is what licenses trusting it. */
    const spec = buildSpec(DEFAULT_GEOM);
    const personas = WHO === 'both' ? ['speedrun', 'casual'] : [WHO];
    const out = {}; let ms = 0;
    for (const p of personas) {
      const t0 = process.hrtime.bigint();
      out[p] = modelRun(spec, p, DAYS, STRICT);
      ms += Number(process.hrtime.bigint() - t0) / 1e6;
    }
    const keys = [];
    for (const p of personas) for (const k of Object.keys(out[p].milestones)) if (!keys.includes(k)) keys.push(k);
    keys.sort((a, b) => (out[personas[0]].milestones[a]?.day ?? 1e9) - (out[personas[0]].milestones[b]?.day ?? 1e9));
    console.log('\n  FIRE CLICKER — ANALYTIC MODEL ONLY (no browser), cap ' + DAYS + ' days');
    console.log('  1 in-game day = ' + DAY_MIN + ' real minutes. Model cost: ' + ms.toFixed(1) + ' ms for ' +
      personas.length + ' persona(s) — ' + Math.round(DAYS * personas.length / (ms / 1000)).toLocaleString() +
      ' game-days per wall-second.');
    console.log('\n  ' + pad('MILESTONE', 20) + personas.map(p => pad('    day  ' + p.toUpperCase(), 18)).join(''));
    for (const k of keys) {
      let line = '  ' + pad(k, 20);
      for (const p of personas) {
        const m = out[p].milestones[k];
        line += num(m ? m.day : null, 7) + '   ' + pad(m ? hhmm(m.day) : '—', 8);
      }
      console.log(line);
    }
    console.log('');
    process.exit(0);
  }
  if (!chromium) { console.error('needs playwright-core resolvable (NODE_PATH=...), or pass --model-only'); process.exit(1); }
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  page.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  await page.goto(URL);
  await page.waitForTimeout(400);
  // stop the render loop dead: the harness owns the clock from here
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(120);

  const personas = WHO === 'both' ? ['speedrun', 'casual'] : [WHO];
  const runs = {};
  let wall = 0, simSec = 0;
  for (const persona of personas) {
    runs[persona] = [];
    for (let i = 0; i < SEEDS; i++) {
      const t0 = Date.now();
      const r = await page.evaluate(inPage, {
        persona, seed: 1000 + i * 7919, dt: DT, maxDays: DAYS, strict: STRICT,
        cycleWait: CYCLE_WAIT, cycleSpeed: CYCLE_SPEED,
        roars: persona === 'speedrun',   // only a hand-tended fire crosses 75%
      });
      wall += Date.now() - t0; simSec += r.simSeconds;
      runs[persona].push(r);
      if (r.stalled) console.log('  STALLED ' + persona + ' seed ' + r.seed + ' at day ' + r.stalled.at.toFixed(1) + ' ' + JSON.stringify(r.stalled.res));
    }
  }
  const geom = runs[personas[0]][0].geom;
  await browser.close();

  const factor = simSec / (wall / 1000);
  console.log('\n  FIRE CLICKER EVAL — ' + VW + 'x' + VH + ', dt ' + DT.toFixed(4) + 's, ' + SEEDS + ' seed(s), cap ' + DAYS + ' days');
  console.log('  1 in-game day = ' + DAY_MIN + ' real minutes (DAY_LEN 300 s). Real time = days x 5 min.');
  console.log('  sim speed: ' + Math.round(factor) + 'x realtime  (' + (factor / 300).toFixed(1) + ' game-days per wall-second)');

  // milestone table -------------------------------------------------------
  const order = [];
  for (const p of personas) for (const r of runs[p]) for (const k of Object.keys(r.milestones)) if (!order.includes(k)) order.push(k);
  const dayOf = (p, k) => {
    const v = runs[p].map(r => r.milestones[k]).filter(Boolean).map(x => x.day);
    return v.length === runs[p].length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  order.sort((a, b) => (dayOf(personas[0], a) ?? 1e9) - (dayOf(personas[0], b) ?? 1e9));

  /* Mean absolute error of the analytic model, ignoring milestones inside the
     first day — those land in a couple of check ticks, where a 0.1-day
     difference is a meaningless three-digit percentage. */
  const mae = (p) => {
    if (!model) return null;
    const e = [];
    for (const k of order) {
      const d = dayOf(p, k), m = model[p].milestones[k];
      if (d !== null && m && d >= 1) e.push(Math.abs(m.day - d) / d * 100);
    }
    return e.length ? e.reduce((a, b) => a + b, 0) / e.length : null;
  };
  let model = null;
  if (WANT_MODEL) {
    const spec = buildSpec(geom);
    model = {};
    for (const p of personas) model[p] = modelRun(spec, p, DAYS, STRICT);
  }

  console.log('\n  ' + pad('MILESTONE', 20) + personas.map(p => pad('    day  ' + p.toUpperCase(), 18)).join(''));
  for (const k of order) {
    let line = '  ' + pad(k, 20);
    for (const p of personas) {
      const d = dayOf(p, k);
      line += num(d, 7) + '   ' + pad(d === null ? '—' : hhmm(d), 8);
    }
    console.log(line);
  }

  if (model) {
    console.log('\n  MODEL vs SIM (analytic estimator, no browser)');
    console.log('  ' + pad('MILESTONE', 20) + personas.map(p => pad(p.toUpperCase() + ': sim  model   err', 26)).join(''));
    for (const k of order) {
      let line = '  ' + pad(k, 20), any = false;
      for (const p of personas) {
        const d = dayOf(p, k), m = model[p].milestones[k];
        if (d !== null && m) { any = true; line += num(d, 6) + num(m.day, 7) + num((m.day - d) / d * 100, 7) + '%   '; }
        else line += pad('', 26);
      }
      if (any) console.log(line);
    }
    console.log('  mean absolute error, milestones past day 1: ' +
      personas.map(p => p + ' ' + num(mae(p), 1) + '%').join('   '));
  }

  // per-persona end state --------------------------------------------------
  console.log('');
  for (const p of personas) {
    const r = runs[p][0];
    console.log('  ' + p.toUpperCase() + ' @ day ' + r.endDay.toFixed(1) + ' (' + hhmm(r.endDay) + ')' +
      '  pop ' + r.pop + '  taps ' + r.tapCount + ' (' + (r.tapCount / Math.max(1, r.simSeconds)).toFixed(2) + '/s)' +
      '  levels ' + JSON.stringify(r.finalUp).replace(/"/g, ''));
    if (r.wall) console.log('    next purchase when the cap hit: ' + r.wall.n + ' Lv' + r.wall.lvl +
      ' — ' + r.wall.days.toFixed(1) + ' more days (' + hhmm(r.wall.days) + ' of play) at the ending rate');
    console.log('    calibration: fire uptime ' + (r.uptime * 100).toFixed(1) + '%' +
      '   ROARING ' + (r.roarUptime * 100).toFixed(1) + '% of the run' +
      '   trips ' + r.trips +
      '   cycle measured ' + (r.baseCycle ? r.baseCycle.toFixed(2) : '—') + 's (pre-tavern/sawbones)' +
      ' / model ' + r.modelCycle.toFixed(2) + 's' +
      (r.baseCycle ? '   -> model ' + ((r.modelCycle / r.baseCycle - 1) * 100).toFixed(1) + '% off' : ''));
  }

  if (REPORT) { console.log('\n  (assertions skipped: --report)\n'); process.exit(0); }

  // assertions: bands, not feels. They exist to catch a curve that MOVED.
  const sv = dayOf('speedrun', 'FOUND VILLAGE Lv1');
  const cv = personas.includes('casual') ? dayOf('casual', 'FOUND VILLAGE Lv1') : null;
  if (personas.includes('speedrun')) {
    ok('speedrun reaches VILLAGE (day ' + num(sv, 1) + ')', sv !== null, sv);
    ok('speedrun VILLAGE inside 2-40 days (2-3.3 h of play)', sv !== null && sv >= 2 && sv <= 40, sv);
  }
  if (personas.includes('casual')) {
    ok('casual reaches VILLAGE (day ' + num(cv, 1) + ')', cv !== null, cv);
    ok('casual is slower than speedrun', cv !== null && sv !== null && cv > sv, { cv, sv });
    /* The 2026-08-28 balance pass exists to make effort and skill pay. Before
       it, optimal play beat naive play by only 1.06x at POP 20 — the personas
       converged, which is the shape of a game where nothing you do matters.
       These guard the separation at both ends of the run. */
    const s15 = dayOf('speedrun', 'POP 15'), c15 = dayOf('casual', 'POP 15');
    const s20 = dayOf('speedrun', 'POP 20'), c20 = dayOf('casual', 'POP 20');
    if (s15 !== null && c15 !== null)
      ok('skill pays at POP 15 (' + (c15 / s15).toFixed(2) + 'x)', c15 / s15 >= 1.6, { s15, c15 });
    if (s20 !== null && c20 !== null)
      ok('skill still pays at POP 20 (' + (c20 / s20).toFixed(2) + 'x)', c20 / s20 >= 1.6, { s20, c20 });
    // the roar is the reward for tending the fire yourself; the keeper must not earn it
    const sr = runs.speedrun ? runs.speedrun[0].roarUptime : null;
    const cr = runs.casual[0].roarUptime;
    if (sr !== null)
      ok('only the hand-tended fire ROARS (' + (sr * 100).toFixed(0) + '% vs ' + (cr * 100).toFixed(0) + '%)',
        sr > 0.9 && cr < 0.2, { sr, cr });
  }
  ok('no persona hard-stalled', personas.every(p => runs[p].every(r => !r.stalled)),
    personas.map(p => runs[p].filter(r => r.stalled).length));
  // regression guard for the demoted-firekeeper bug: a villager re-flagged from
  // keeper to worker used to stay parked at the fire and never gather again.
  ok('no villager stranded in a keeper state', personas.every(p => runs[p].every(r => r.stranded === 0)),
    personas.map(p => runs[p].map(r => r.stranded)));
  if (model) {
    for (const p of personas) {
      const e = mae(p);
      ok(p + ' analytic model tracks the sim within 10% (MAE ' + num(e, 1) + '%)', e !== null && e < 10, e);
    }
  }
  console.log('\nFIRE CLICKER EVAL: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/* Pull the shipped UPG table into Node so the model prices things off the real
   cost curves rather than a copy that can rot. The table's closures read the
   game's own helpers, so we hand them equivalents over a shared `levels` map —
   `max`, `show` and `cost` then work verbatim, unpatched. */
function buildSpec(geom) {
  const src = fs.readFileSync(path.join(ROOT, 'games', 'fire-clicker', 'index.html'), 'utf8');
  const m = src.match(/const UPG = \[[\s\S]*?\n\];/);
  if (!m) throw new Error('could not find the UPG table in games/fire-clicker/index.html');
  const levels = {};
  const fmtS = (v) => (Math.round(v * 10) / 10) + 's';
  const maxBank = () => 5 + levels.pit * 5;
  const tapPower = () => 1 + levels.tinder * 0.5;
  const drainRate = () => 1 / (1 + levels.wind * 0.09);
  const stageMaxHouses = () => levels.village ? 10 : 5;
  const houses = () => Math.min(2 + levels.house, stageMaxHouses());
  const S = { up: levels };
  const UPGS = new Function('fmtS', 'maxBank', 'tapPower', 'drainRate', 'houses', 'stageMaxHouses', 'S',
    '"use strict";' + m[0] + '\nreturn UPG;')(fmtS, maxBank, tapPower, drainRate, houses, stageMaxHouses, S);
  const meanDist = geom.dist.reduce((a, b) => a + b, 0) / geom.dist.length;
  return { UPGS, levels, meanDist };
}
