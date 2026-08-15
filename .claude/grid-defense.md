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

## Placing turrets — two ways, both first-class

**Drag** a build card onto a tile, or **tap** the card to arm it and **tap** a
tile to drop it. A drag is awkward one-handed on a phone, so the tap path is
not a fallback — it is the same operation with a different grammar.

The two share one press: `onDown` records which card the press started on
(`downCard`), and `onUp` decides. Released over the board → build (drag).
Released still inside the card it started on → that was a *tap*, so arm it
(`armedType`), toggling off if it was already armed. With a turret armed, the
next board tap places it and disarms; a tap on the road denies but **stays**
armed; a tap on an existing tower inspects that tower instead of denying; a tap
off the board puts it away. `armedType` is cleared by `closeScreen()`,
`startLevel()` and arming an ability, so it can never survive a context change.

Because there is no cursor to hover on a touchscreen, arming washes every
buildable tile in a **neutral** light tint — deliberately not the turret's own
colour, since red is the danger colour everywhere else in this game and a red
turret would wash the board in "you cannot build here".

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

## Deployment caps — the scarcity that makes placement a decision

**One of each turret type on the field to start.** Every armory tier of that
type buys exactly one more slot, and the COMMAND tree buys slots across the
board (`MUSTER`, `MASS LEVY`, `GRAND ARMY`). `deployCap(type) = 1 + tier +
S.deployAll`; `canDeploy()` gates building, the drag ghost, the armed-tile wash
and whether a card will arm at all, and the build card always shows `have/cap`.

This is the change that made the rest of the balance mean anything. With ~25
turrets the board was a blanket and position barely mattered; with four to
twenty, *which* turret and *where* is the whole game. It also re-pointed the
economy: cash stopped being the constraint the moment turret COUNT became one,
so cores (slots) and skill points (multipliers) carry the run.

## Adjacency synergy (ENGINEERING · POWER GRID)

Orthogonal neighbours only — **diagonals deliberately grant nothing**, so a
layout is a decision rather than "clump everything". A turret can be lifted by
at most four neighbours (all an orthogonal cell has) and the skill *rank* caps
how many actually pay, first-placed first, so build order matters.

- **Same type** — both gain +16% damage, fire rate and range (per neighbour).
- **Different types trade traits** — a RAIL lends reach (+38%), a PULSE lends
  cycle speed (+26%), a NOVA lends splash (45% of damage in a small bloom), a
  FROST lends a brief chill. `SMART GRID` doubles every one of them.

Computed in `recomputeAdjacency()` on build/sell/upgrade and whenever skills
change — never per frame. Combat just reads `t.syn`.

## Reading a turret without text

A placed turret carries two readings, **neither of them text** — the numbers
live on the selection panel, where they are asked for:

| reading | earned with | shown as |
| --- | --- | --- |
| LEVEL | cash | the silhouette grows and its outline thickens |
| SYNERGY | placement | a coloured bloom on the edge facing each lending neighbour, **in that neighbour's colour** |

The plate keeps a plain 1px border in the turret's own colour. **Tier is not
drawn on the turret.** It had a copper/silver/gold frame for exactly one build
and lost: four turret colours plus three metals plus the blooms was too many
palettes on one tile. Tier reads off the build card's `have/cap` counter
instead, which is where its real consequence — another deployment slot —
already lives.

So a NOVA with a PULSE on its right glows green on that right edge, and the
PULSE glows red on its left — the bloom names *who* is helping and *from which
side*, which a number never could. `recomputeAdjacency()` records the side and
the lender's colour in `t.syn.links`; `drawTower()` clips a gradient to the
base plate so it reads as an inward bulge rather than an outer halo.

## The three currencies (this is the design)

| | earned | spent on | resets |
|---|---|---|---|
| `$` cash | `startCashFor(L)` + kill bounties | placing and upgrading towers **this level** | every level |
| `◆` cores | `coresForWave(gw)` on each wave clear | ARMORY (from wave 5): a permanent tier = **+1 deployable** of that type plus its stats, or RESEARCH into skill points | never (per run) |
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

Rewards are deliberately thin. At 2 cores and 1 point a wave the campaign paid
out ~450 cores and ~116 points against ~290 cores and ~250 points of things to
buy, so neither currency was ever a decision — the CD's words were "an over
abundance … they don't feel like valuable rewards". A run now pays roughly
**150 cores and 60 points**: about enough to fill one tree, which is what makes
specialising a choice. Surplus cores still convert to points at an escalating
price (`researchCost()`).

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

Wave HP is a **sawtooth**, not one smooth ramp:
`HP_LEVEL^(level-1) · HP_WAVE^(wave-1)`, with `HP_BOSS` on the tenth wave.
Waves harden steeply across a level, the boss spikes, and the next level opens
far easier than that boss but on a higher floor than the level before it —
which is the pacing that was asked for. A single monotonic curve was measured
doing the *opposite* of what it looked like: the board grows from empty inside
a level, so gentle per-wave growth made a level's OPENING waves the dangerous
ones (24 lives lost in the first four waves against 0 in the last four).

`HP_LEVEL = 1.40, HP_WAVE = 1.16` was swept with the eval **after deploy caps
landed**. A board of ~5-20 turrets instead of ~25 meant the previous 2.00 curve
was unwinnable for every persona — a reminder that the curve is meaningless
except relative to how much defence the rules permit.

Elites are stamped **deterministically** per creep type and spread evenly
through each group; rolling them at random let one wave land a heavy elite the
next one missed, an invisible wobble on an otherwise monotonic ramp.

The WARDEN was retuned twice: first from a wall (520 HP **and** 4 armour, where
the armour alone ate ~40% of an early PULSE shot), now 300 HP and 2 armour.
NOVA was cut hard as well (10 → 6.5 damage, 1.3 → 0.95 blast, 2.2 → 1.85 range)
after the CD cleared wave 6 with nothing but powered-up novas at the mouth.


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
  personas played over the real campaign. Personas are **data**
  (`.claude/tests/strategies/`, schema in that folder's README), so a subagent
  can author them and hunt for exploits; `--strategy f.json`, `--only NAME`,
  `--curve <levelGrowth>,<waveGrowth>` and `--json` are the knobs. Each run
  takes 1-3 seconds, so sweeping is cheap.

Measured at `HP_LEVEL = 1.40 / HP_WAVE = 1.16` with a 3-retry cap and a
**seeded RNG**, stable across four seeds. These are the campaign's difficulty
*claims*, and the eval fails if they stop being true:

| persona | outcome |
| --- | --- |
| coherent build | clears all ten |
| **OFFENSE tree alone** | **clears all ten** — few turrets, enormous hitters |
| **ENGINEERING tree alone** | **clears all ten** — clustered synergy, deep upgrades |
| **COMMAND tree alone** | **clears all ten** — a big army and abilities |
| one-note PULSE, never upgrade | stalls at 8 |
| crowd every turret at one spot | stalls at 7 |
| poor skill selection | stalls at 6 |
| no skills at all | stalls at 4-5 |
| never buy an armory tier | stalls at 4 |

**Any one tree must be able to finish the campaign alone** — that is a design
requirement, so it is an assertion. When COMMAND failed it (stalling at 9 on
one seed) the fix was the TREE, not the curve: it could field the biggest army
in the game with no way to turn size into power, so `COMBINED ARMS` now pays
every turret +1.6%/rank damage per turret on the field. ENGINEERING failed the
same way earlier — deploy caps had gutted its economy identity — and was
re-pointed onto synergy and per-level damage.


**Seed the RNG or the numbers lie.** Combat crit rolls alone swung a persona's
verdict by two whole levels between otherwise identical runs; all in-game
randomness now goes through `RNG` (`__GD.seedRandom(seed)`) for this reason.

Two findings the harness produced that changed the design, not just the tuning:
- **A short `skills` list strands points.** Eight node ids absorb ~24 of a
  campaign's ~116, so a strategy plays on a fifth of its budget and looks far
  worse than it is — this made an entire 23-strategy exploration report a
  spurious "3.3x gap" against the reference build. The eval now prints
  `N SKILL POINTS UNSPENT` and offers `spendRest`.
- **Research had to become an escalating price.** At a flat 5 cores it was
  strictly better to melt every core than to buy a permanent tier: a persona
  that never touched the armory *matched the reference build outright*, making
  cores just skill points with extra steps. Now `5 + 3·(conversions so far)`,
  which restores the armory as the primary use and research as a surplus dump.

A ceiling worth knowing before re-tuning: pushing the no-skills stall down to
level 3 while a good build still clears ten needs the trees to be worth ~150×,
which makes towers nearly irrelevant. 2.00 is the last point before the good
build stops reaching the end.
