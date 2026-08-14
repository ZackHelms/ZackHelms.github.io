# Grid Defense (`games/grid-defense/index.html`) — architecture notes

A **ten-level tower-defense campaign** on a 9×13 portrait grid, followed by
endless. A **level is one map and ten escalating waves ending in a WARDEN**, so
the run is still 100 waves of content — but the level is the retry unit and the
board persists across its ten waves, which is what makes upgrading a placed
tower worth doing. Cash is per-level and disposable; the **armory** (permanent
turret tiers) and the **skill trees** persist for the whole run.

## Continuous flow — nothing waits on a tap

`update()` is a timer state machine: `grace` (build window) → `wave` → `gap` →
`wave` … → `levelclear` → next level, with `failed` looping back to a retry.
There is no START WAVE button and the fourth action-row slot is a **readout with
its hitbox nulled** (`actionBtns.ready = null`) rather than a button. Feedback
is a transparent canvas `toast()` drawn over the running board — level clears,
wave clears and failures never stop play.

Timings: `GRACE_T` 7s, `GAP_T` 2.5s, `LEVEL_T` 2s, `FAIL_T` 2.4s.

## Lives, retries and what the board ranks

Lives refill at every level start. Running out fails the **level**, not the run:
`failLevel()` rolls the attempt back *whole* via `levelSnapshot` — score, cores,
skill points and spent skills all revert to how they stood when the level
opened, and `run.retries` ticks. Without that rollback a patient player farms a
level for cores, dies deliberately, and keeps them. Score banks only when a
level is actually **cleared** (`run.levelScore` → `run.score`), so the top-ten
board ranks score and shows retries — retries are what separate players.

**Endless (level 11+) has no retries**: a breach there ends the run and records
it. That is what gives the scoreboard its teeth.

## The three currencies (this is the design)

| | earned | spent on | resets |
|---|---|---|---|
| `$` cash | `startCashFor(L)` + kill bounties | placing and upgrading towers **this level** | every level |
| `◆` cores | `coresForWave(gw)` on each wave clear | ARMORY (from wave 5): permanent turret tiers, or RESEARCH into skill points | never (per run) |
| `★` skill | `skillPtsForWave(gw)`, from wave 5 | the three trees | never (per run) |

Rewards land **per wave**, and the ARMORY/SKILLS buttons open from the HUD at
any time (opening pauses), so a long level is something you actively manage
rather than a thing you watch.

**The introduction is measured in WAVES, not levels.** `TURRET_WAVE` hands over
one new turret per wave — PULSE, NOVA, FROST, RAIL on waves 1/2/3/4 — free, and
`ARMORY_WAVE` (5) keeps *every* purchase (tiers and RESEARCH alike) shut until
then. Levels are ~10× longer than they were, so a per-level intro would have
made the player wait twenty minutes for the sniper; this way level 1 *is* the
tutorial and the meta-game opens halfway through it. The drive suite gates the
schedule from the real flow: the build bar must gain exactly one card a wave
through wave 4 and hold at four.

Surplus cores late in a run convert 5◆→1★ (RESEARCH), so cores never go dead.

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
+5% range applying to every tower of that type). Turrets themselves are never
bought — `applyTurretUnlocks(L)` grants them on schedule, called both from
`completeLevel()` (so the new one is introduced on the level-clear screen and
present in the shop) and from `startLevel()` as a safety net for loads and
direct level jumps.

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

Every curve is a function of the **global wave index** `globalWave()` =
`(level-1)*10 + wave`, 1..100 in the campaign. Because that index is monotonic
and bosses land on every tenth wave, the pacing falls out for free: waves harden
across a level, the boss is a spike, and the next level opens easier than that
boss but harder than the level before it. Nothing special-cases "level start".

`hpMulFor(gw)` uses an **accelerating exponent**: `exp(HP_A·x + HP_B·x²)`.
A flat rate does not work here and this was measured, not guessed: waves spread
over ~60s, so a defence that holds at level 20 holds at 100 with the same
headroom. The quadratic term is what makes the back half a squeeze.

`HP_A = 0.040, HP_B = 0.00027` was calibrated against the drive suite's
auto-player (coverage-optimal placement, both build and upgrade levers, a fixed
skill order, and **no use of the COMMAND abilities**): it starts leaking in the
mid-70s and falls in the low-to-mid 80s. Re-tuned when unlocks became free —
handing over all four turrets by level 4 and banking their cores made the same
bot roughly ten levels stronger, which is the kind of drift only a harness
catches. A player who actually spends abilities and builds coherently has the
headroom to reach 100. `__GD.setCurve(a, b)` is the sweep hook; `.claude/tests/drive-grid-defense.cjs` holds the harness.

Elites are stamped **deterministically** per creep type and spread evenly
through each group. Rolling them at random let one level land a heavy elite the
next level missed, so total wave HP could dip level-to-level — an invisible
difficulty wobble on an otherwise monotonic ramp. Boss waves (every 10th)
shrink the ordinary mix to 72% and add WARDENs; the ramp is therefore monotonic
*within* each class, not across the two.

The WARDEN was retuned after the CD reported it as a wall: it carried 520 base
HP **and 4 armour**, and the armour alone ate ~40% of an early PULSE shot, so it
read as unkillable next to the creeps leading up to it. Now 300 HP, 2 armour,
and a fatter bounty so killing it funds the next level.

## Maps

`MAPS[]` — ten waypoint paths plus `rocks` (unbuildable non-road cells that
shape the build space). One map per level: `mapIndexFor(level) = (level-1) % 10`,
cycling in endless.
The road is drawn as one **thick rounded polyline clipped to the board**, not
per-cell fills: the first/last waypoints sit off-grid so creeps walk on and off,
and `boardPoint()` pulls anything drawn *at* those points (exit marker, leak
floats) back inside — otherwise they paint over the HUD and the build bar.
**Creeps and beams are clipped to the board** for the same reason: creeps walk
on from off-grid and unclipped they float up into the HUD.

## Screens and state

Canvas renders the board and the bottom bars; **every menu is DOM** under
`#ui` (menu, armory, skills, scoreboard, settings, save slots, level clear,
game over, pause). `openScreen()` sets `paused = true`, which is what stops
`update()`; `closeScreen()` clears it. Chrome (`←`, `🔊`, `☰`) is `z-index:90`
against the overlay's `70`, so mute stays reachable behind any screen.

Three lifecycle latches worth knowing, all regression-tested:
- `completeLevel()` moves `phase` to `levelclear`, so the wave-complete check
  (`spawnList` and `creeps` both empty) cannot re-fire and farm the bonus.
- `endRun()`'s deferred game-over screen is held in `overTimer` and cancelled by
  `startRun()`/`showMenu()`. Unowned, it popped over a run started within its
  700 ms window.
- `pendingStart` makes the between-levels auto-save write `{pending:true}`
  instead of the finished level's board. Restoring a pending save calls
  `startLevel(run.level)` for a fresh level; without it, CONTINUE reopened the
  *next* level number holding the *previous* level's towers and cash.

Persistence (all `gridDefense.v3.*` — v2 keys are abandoned, the level model
changed under them): `auto` (written at every level start),
`slot1..3` (manual), `scores` (top 10 by score, each
`{ts, level, wave, score, retries, won}`),
`settings` (music/sfx volume, mute, default speed). A run is recorded on death
or on ABANDON/RETIRE — `run.recorded` prevents double-writing.

## Test hooks (`window.__GD`)

`st()` state summary · `S()`, `run()`, `towersRaw()`, `creepsRaw()` ·
`newRun/startLevel/ready/skipGap/advance/step(dt,n)` · `build/upgrade/sell` ·
`buyArmory/research/spendSkill` · `fireAbility` · `wave(L)`, `hpMulFor`,
`startCashFor`, `coresForWave`, `skillPtsForWave`, `globalWave`, `isBossWave`,
`pathSamples(n)`, `buildableCells()`, `setCurve(a,b)`
· `save(i)/load(i)` · **`cardRects()/actionRects()/panelRects()/abilityRects()`**
publish the live canvas hitboxes so a drive test can press the drawn UI the way
a thumb does — the repo's documented failure mode is a hidden widget leaving
stale hitboxes behind, and this game is where that bug was first found.

Suites — **rules and balance are deliberately separate files**, so a balance
tweak never fights a mechanics regression:
- `.claude/tests/drive-grid-defense.cjs` (50 checks) — mechanics and lifecycle:
  intro schedule, continuous flow, level retry + rollback, tree gating, touch
  drag-place and panel taps, persistence, scoreboard, curve shape.
- `.claude/tests/eval-grid-defense.cjs` — balance and pacing, via strategy
  personas played over the real campaign.
