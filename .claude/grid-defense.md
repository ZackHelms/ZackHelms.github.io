# Grid Defense (`games/grid-defense/index.html`) — architecture notes

A **100-level tower-defense campaign** on a 9×13 portrait grid, followed by
endless. One wave per level, a new map every ten levels, and a between-levels
economy that is the actual game: cash is per-level and disposable, while the
**armory** (permanent turret tiers) and the **skill trees** persist for the
whole run. Lives persist too — the run ends when they hit zero.

## The three currencies (this is the design)

| | earned | spent on | resets |
|---|---|---|---|
| `$` cash | `startCashFor(L)` + kill bounties | placing and upgrading towers **this level** | every level |
| `◆` cores | `coresFor(L)` on each level clear | ARMORY: unlock a turret type, or one permanent tier | never (per run) |
| `★` skill | `skillPtsFor(L)`, from level 5 | the three trees | never (per run) |

**The level 2/3/4 shop is a deliberate either/or.** `coresFor(L)` pays exactly
2 for levels 1–4, and both a turret unlock (`UNLOCK_COST`) and a first tier
(`tierCost(0)`) cost exactly 2. So the player buys the new turret *or* upgrades
what they own, never both — which is the promise the game makes. The drive
suite gates this; if core income or either price drifts, the choice silently
stops being a choice. Surplus cores late in a run convert 5◆→1★ (RESEARCH), so
cores never go dead.

## Turrets (`TOWERS`)

Silhouettes are spec'd, not incidental — **PULSE** green triangle (single) ·
**NOVA** red circle (splash) · **FROST** blue snowflake outline (slow) ·
**RAIL** purple spike (long-range heavy). `drawTurretShape()` draws all four
and is shared by the board and the armory icons. Every turret sits on a dark
base plate so it reads as a structure; creeps use a **warm/steel palette with
distinct silhouettes** (hex/chevron/square/octagon/cross/star) because the
turret palette took over green and red.

Two independent power axes multiply: per-instance level (cash, 3 base and up to
5 via ENGINEERING) and armory tier (cores, 8 tiers of +20% dmg / +6% rate /
+5% range applying to every tower of that type).

## Skill trees (`TREES`)

OFFENSE (kill power) · ENGINEERING (economy, cost, instruments) · COMMAND
(active abilities, lives, cold control). Six columns, up to five rows, browsed
full-screen with horizontal scroll; tapping a node opens a detail sheet with
the SPEND button. Gating: a node opens when **any** parent in `req` holds ≥1
point; tier-5 capstones additionally need `gate` (12) points in that same tree.

**Every effect is a pure mutation of the stat bag `S`** (`baseStats()` →
`computeStats()`); nothing else in the game reads the skill table. Adding a
skill means adding a node with an `eff(S, rank)` and, if it introduces a new
lever, one field in `baseStats()`. `computeStats()` runs on purchase, level
start and load — never per frame.

Budget: ~116 points earned across 100 levels against ~250 points of tree, so
roughly 40% is reachable. Specialisation is forced, not suggested.

## Difficulty curve — read before touching

`hpMulFor(L)` uses an **accelerating exponent**: `exp(HP_A·x + HP_B·x²)`.
A flat rate does not work here and this was measured, not guessed: waves spread
over ~60s, so a defence that holds at level 20 holds at 100 with the same
headroom. The quadratic term is what makes the back half a squeeze.

`HP_A = 0.040, HP_B = 0.00026` was calibrated 2026-08-10 against the drive
suite's auto-player (coverage-optimal placement, both build and upgrade levers,
a fixed skill order, and **no use of the COMMAND abilities**): it first leaks
around level 77 and falls around 80–86. A player who actually spends abilities
and builds coherently has the headroom to reach 100. `__GD.setCurve(a, b)` is
the sweep hook; `.claude/tests/drive-grid-defense.cjs` holds the harness.

Elites are stamped **deterministically** per creep type and spread evenly
through each group. Rolling them at random let one level land a heavy elite the
next level missed, so total wave HP could dip level-to-level — an invisible
difficulty wobble on an otherwise monotonic ramp. Boss levels (every 10th)
shrink the ordinary mix to 72% and add WARDENs; the ramp is therefore monotonic
*within* each class, not across the two.

## Maps

`MAPS[]` — ten waypoint paths plus `rocks` (unbuildable non-road cells that
shape the build space). `mapIndexFor(L) = floor((L-1)/10)`, cycling in endless.
The road is drawn as one **thick rounded polyline clipped to the board**, not
per-cell fills: the first/last waypoints sit off-grid so creeps walk on and off,
and `boardPoint()` pulls anything drawn *at* those points (exit marker, leak
floats) back inside — otherwise they paint over the HUD and the build bar.

## Screens and state

Canvas renders the board and the bottom bars; **every menu is DOM** under
`#ui` (menu, armory, skills, scoreboard, settings, save slots, level clear,
game over, pause). `openScreen()` sets `paused = true`, which is what stops
`update()`; `closeScreen()` clears it. Chrome (`←`, `🔊`, `☰`) is `z-index:90`
against the overlay's `70`, so mute stays reachable behind any screen.

Two lifecycle latches worth knowing, both regression-tested:
- `completeLevel()` sets `phase = 'clear'`. Without it the wave-complete check
  (`spawnList` and `creeps` both empty) re-fires every frame while the
  level-clear screen is up and farms the clear bonus forever.
- `pendingStart` makes the between-levels auto-save write `{pending:true}`
  instead of the finished level's board. Restoring a pending save calls
  `startLevel(run.level)` for a fresh level; without it, CONTINUE reopened the
  *next* level number holding the *previous* level's towers and cash.

Persistence (all `gridDefense.v2.*`): `auto` (written at every level start),
`slot1..3` (manual), `scores` (top 10 by score, each `{ts, level, score, won}`),
`settings` (music/sfx volume, mute, default speed). A run is recorded on death
or on ABANDON/RETIRE — `run.recorded` prevents double-writing.

## Test hooks (`window.__GD`)

`st()` state summary · `S()`, `run()`, `towersRaw()`, `creepsRaw()` ·
`newRun/startLevel/ready/step(dt,n)` · `build/upgrade/sell` ·
`buyArmory/research/spendSkill` · `fireAbility` · `wave(L)`, `hpMulFor`,
`startCashFor`, `coresFor`, `skillPtsFor`, `pathSamples(n)`, `buildableCells()`
· `save(i)/load(i)` · **`cardRects()/actionRects()/panelRects()/abilityRects()`**
publish the live canvas hitboxes so a drive test can press the drawn UI the way
a thumb does — the repo's documented failure mode is a hidden widget leaving
stale hitboxes behind, and this game is where that bug was first found.

Suite: `.claude/tests/drive-grid-defense.cjs` (67 checks — unlock script, tree
gating, touch drag-place and panel taps, persistence, scoreboard, curve
monotonicity, and a full auto-player campaign). Slow (~5 min); it runs the
campaign for real.
