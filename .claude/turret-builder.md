# Turret Builder (`games/turret-builder/index.html`) — architecture notes

A tower defense in which **the turret is the smallest part of the game**. A
turret is a plain gray triangle: 10 kinetic damage, once a second, 100% hit
chance, and it never changes. Everything that makes it dangerous is a
**module tile** bolted to one of its four orthogonal sides — and a module
feeds *every* turret and wall it touches, so the board stops being a scatter
of towers and becomes a circuit. Eight levels of eight waves, about eight
minutes each, then endless.

It is the second tower defense in the repo after `grid-defense/`, and it is
deliberately the inverse of it: grid-defense is four distinct turret types
with a 100-wave meta-game bolted on; this is *one* turret type and all the
depth in the adjacency layout. It grew out of grid-defense's ENGINEERING
`POWER GRID` skill — the CD's ask was to build a whole game around that one
node.

## The spec is the contract

These numbers came from the CD verbatim and `drive-turret-builder.cjs`
asserts every one of them **by measuring the game**, off a damage ledger
fired at a pinned dummy with known armour and resist. Do not change them
without the CD saying so; if a balance problem seems to need it, the answer
is almost always somewhere else (see § Module power).

| | per module | four sides |
| --- | --- | --- |
| base turret | 10 kinetic, 1.0/s, 100% hit, 2.6 cells | — |
| **FIRE** | +10% of the hit as a 5 s burn (elemental) | +40% |
| **ICE** | +2.5% direct elemental, 10% slow for 1 s | +10%, 40% slow |
| **ARC** | +5% direct elemental, chains to +1 nearest untouched enemy | +20% to **five** targets |
| **BLAST** | +5% kinetic (concussive) + 2.5% fire, as AoE | +20% / +10% splashed |
| **ARMOR** | walls only: +35% wall HP, +2 flat DR | +70%, DR 4 |
| **REGEN** | walls only: +4% of max HP a second | +8%/s |

"Up to four of a kind" is **structural, not a rule**: a turret has four
orthogonal sides and there is nowhere to put a fifth. Diagonals grant
nothing, which is what makes a layout a decision instead of "clump
everything" — and is why the CD's "diagonal tiles, later" is a genuinely
new axis rather than more of the same.

## The one rule that is actually new

**A module powers every turret AND wall it orthogonally touches.** One tile
wedged between two turrets pays both of them. That single line is the game:
it turns the board into a packing problem where the best answer is a
checkerboard near the road, and it is why `recomputeGrid()` records links in
both directions (the module knows who it feeds, the structure knows who is
feeding it and from which side).

`recomputeGrid()` runs on every place/sell/upgrade and every lab purchase —
**never per frame**. Combat and rendering only ever read the cached `t.mods`,
`t.D`, `t.arcJumps`, `t.blastR` and friends.

Reading the board without text: a turret **blooms on the edge facing each
feeding module, in that module's colour**, and a bright conduit is drawn from
every module to everything it powers. An unpowered module renders dim. The
numbers live on the selection panel, where they are asked for.

## Damage types — the reason a one-note grid loses

Two channels, one rule each:

- **KINETIC** is reduced **flat** by armour, never below 15% of the hit.
- **ELEMENTAL** is reduced by a **percentage** resist.

`HULK` has armour and no resist (answer: elemental). `WARD` has 60% resist
and no armour (answer: kinetic). The `BREAKER` has both.

**Armour scales with the level floor (`armMulFor`), resist does not** — and
this is load-bearing, not tuning. A turret's kinetic damage grows all
campaign through levels and CHASSIS tiers, so a flat armour of 7 that never
moves is a real tax at level 1 and a rounding error at level 8. Before armour
scaled, a board of **bare gray triangles measured its way to level 6**, which
made the entire module layer a 40% garnish. With it, no-modules stalls at 4.
Resist is already a fraction, so it needs no equivalent.

## Module power — the measured ordering (read before rebalancing)

The eval measures, and the eval asserts, this ordering:

| build | stalls at |
| --- | --- |
| ARC-only · BLAST-only | **clears all 8** (and outscores an evenly-mixed grid) |
| coherent mixed grid | **clears all 8** |
| exit-camp | 7 |
| unshared · no-walls · FIRE-only | 5 |
| no-modules · no-lab | 4 |
| ICE-only | 3 |
| orphaned modules | 2 |

**ARC and BLAST are the strongest modules, and that follows directly from
the CD's percentages, not from anything this build chose.** Four ARC modules
put 20% of the hit on *five* targets — up to a whole extra turret's worth of
damage against a pack — while four FIRE modules put 40% on *one*. BLAST is
the only module that deals both damage types, so it is the only one that
answers armour and resist at once. Against wave compositions that are mostly
crowds, the crowd modules win, and an evenly-weighted mix measurably
*dilutes* into the weaker two.

Two things were tried and did **not** close the gap: raising WARD's share of
the late waves (ARC is 100% elemental, so resist ought to be its counter),
and making the FIRE/ICE lab tracks climb 30% a tier against ARC/BLAST's 12%.
The lab lever fails for an economy reason — a run pays ~155 cores against a
~320-core lab, GRID and CHASSIS are close to mandatory, and the module tracks
never reach a tier high enough to matter.

The uneven lab steps were kept anyway (they are directionally right and cost
nothing), but **the honest state of play is that FIRE and ICE are support
modules, not damage modules**: ICE's real product is the 40% slow, which is
continuously refreshed while a turret is firing and therefore multiplies
*every other* structure's time-on-target, and FIRE's is sustained
single-target damage for the BREAKER. A player who reads them as damage will
be disappointed.

**This is a live design question for the CD, not a settled balance.** The
levers, if it should change: raise the ICE slow's duration or cap (its
1-second window is the spec's, and it is what keeps ICE marginal), give
FIRE's burn a stacking rule, cap ARC's jumps below the module count, or
simply accept ARC/BLAST as the damage modules and FIRE/ICE as the control
pair and say so in the game's own copy. **Do not "fix" it by editing the four
percentages** — those are the CD's spec, and `drive-turret-builder.cjs`
fails the moment they move.

## Walls

Walls go **on the road**. A creep that reaches one stops and hits it; the
pile-up that creates is what BLAST and ARC want, which is the intended
synergy rather than a happy accident. A road cell has two road neighbours and
two free sides, so **a wall takes exactly two modules — that is the geometry,
not a rule**, and it is what the CD's "the 2 adjacent sides" describes.

Wall module output is expressed as a **fraction of the wall's own max HP**,
so BULWARK tiers and ARMOR modules scale a wall's teeth along with its body
instead of leaving it a wet paper bag by level 6. `SAPPER` exists to stop
walls being free: it does ~6× a grub's structure damage.

Walls never reroute anything — there is no mazing and no pathfinding, so a
wall cannot make a level unwinnable. `wallCap` and finite HP are what keep
them from being a blanket.

## Economy — two currencies, on purpose

| | earned | spent on | resets |
| --- | --- | --- | --- |
| `$` cash | `startCashFor(L)` + kill bounties | turrets, modules, walls, upgrades, repairs **this level** | every level |
| `◆` cores | `coresForWave(gw)` on every wave clear | the LAB (9 permanent tracks) | never (per run) |

There are no skill trees. grid-defense puts its depth in a between-levels
meta-game; here the depth is the *layout*, and a third currency would only
compete with it for the player's attention.

`GRID` (+1 turret slot a tier) is the track that matters most, because
**turret slots, not cash, are the scarce thing** — the same lesson deploy
caps taught grid-defense. A run pays roughly 155 cores against ~320 cores of
lab, so about half is reachable and specialising is forced.

Losing a level rolls the attempt back **whole** via `run.snapshot` — cores,
score and every lab tier revert to how they stood when the level opened.
Without that, a patient player farms a level for cores, dies on purpose, and
keeps them. **Endless (level 9+) has no retries.**

## Flow, and the introduction

`update()` is a timer state machine: `grace` (25 s) → `wave` → `gap` (9 s) →
… → `levelclear` (4 s) → next level, with `failed` (3 s) looping back to a
retry. **Nothing waits on a tap.** Feedback is a transparent canvas `toast()`
over the running board.

**The introduction is measured in waves, not levels**, so level 1 *is* the
tutorial: TURRET, FIRE, ICE, WALL, ARC, BLAST, ARMOR, REGEN on waves 1-8, and
the LAB opens on wave 5. The drive suite gates that schedule off the real
flow — the build bar must gain exactly one card a wave.

Placement has two first-class grammars, as in grid-defense: **drag** a card
onto a tile, or **tap** the card to arm it and tap the tile. One difference
worth knowing: **arming here does not end on a successful drop.** You ring a
turret with four modules in four taps, and re-arming between each was the
single most annoying thing about the first build; arming ends only when the
kind has nowhere left to go or nothing left to pay with.

## Difficulty curve

`hpMulFor(gw) = HP_LEVEL^(L-1) · HP_WAVE^(w-1)`, with `HP_BOSS` on the eighth
wave — the same **sawtooth** grid-defense arrived at, for the same reason:
the board grows from near-empty inside a level, so one smooth ramp makes a
level's *opening* waves the dangerous ones.

`HP_LEVEL = 1.22, HP_WAVE = 1.15` was swept with the eval. A warning from
that sweep, because it will save the next session an hour: **for a long time
no value of `HP_LEVEL` changed any outcome at all** — every persona stalled
at level 3 whether the curve was 1.16 or 1.54. That is the signature of
something structural, not a curve problem. It was two things: the eval's own
core-spending fell through to the cheapest affordable tier instead of saving
for its priority (so the reference build reached level 3 with GRID still on
tier 1), and the power budget was simply too small for a grid to exist.
**If a curve sweep does nothing, stop sweeping the curve.**

## Determinism

**The simulation carries no gameplay randomness at all.** Wave composition,
elite stamping, targeting and damage are all deterministic functions of the
global wave index; `RNG` drives only sparks and screen shake. Runs are
therefore byte-identical across `--seed` values.

That makes the eval exactly reproducible, and it makes a level a knowable
puzzle rather than a dice roll — but it also means **agreement across seeds
is not evidence of a robust balance**, and a report should never present it
as such. Vary the persona, not the seed. `__TB.seedRandom` exists to pin the
cosmetic RNG and to keep the hook honest if a gameplay roll is ever added.

## Test hooks (`window.__TB`)

`st()` state summary · `run()`, `tilesRaw()`, `creepsRaw()` ·
`newRun/startLevel/ready/skipGap/advance/step(dt,n)` ·
`place/sell/upgrade/buyLab` · `turretStats(r,c)`, `wallStats(r,c)`,
`modsAt(r,c)`, `tileAt(r,c)` · `canPlace`, `buildableCells(kind)`,
`pathCellList`, `pathDistOfCell`, `pathSamples(n)` · `wave(gw)`, `hpMulFor`,
`armMulFor`, `spdMulFor`, `startCashFor`, `coresForWave` ·
`setCurve(a,b)`, `setPacing(...)`, `seedRandom` · `save(i)/load(i)` ·
**`cardRects()/panelRects()/hudRects()`** publish the live canvas hitboxes so
a drive test can press the drawn UI the way a thumb does.

Three hooks exist specifically to make the spec measurable rather than
inferred, and they are the reason the module numbers are asserted to the
decimal instead of "some damage happened":

- **`setLog(on)` / `log()`** — a ledger of every damage instance
  (`{id, amt, raw, type, tag}`), so "four FIRE modules deliver 40% of the hit
  over five seconds" is a sum, not a guess.
- **`spawnDummy({hp, arm, res, x, y, d, spd, pinned})`** — a bare target with
  exactly the stats you ask for. `pinned` (default true) holds its position
  so chain-lightning geometry can be laid out by hand.
- **`setPhase(p, t)`** — parks the flow state machine so a measurement is
  never gatecrashed by the next wave spawning halfway through it.

Suites — **rules and balance are deliberately separate files**, so a balance
tweak never fights a mechanics regression:

- `.claude/tests/drive-turret-builder.cjs` (95 checks) — the spec verbatim,
  the grid's sharing and four-side geometry, damage types and armour scaling,
  walls, economy, the timer-driven flow, level retry with a whole-attempt
  rollback, the wave-by-wave intro schedule, the sawtooth's shape, the
  canvas-drawn UI pressed through real touch events, and persistence.
- `.claude/tests/eval-turret-builder.cjs` (15 claims) — balance and pacing,
  via strategy personas played over the real campaign. Personas are **data**
  (`.claude/tests/strategies-turret-builder/`, schema in that folder's
  README), so a subagent can author them and hunt for exploits.
  `--strategy f.json`, `--only NAME`, `--curve a,b`, `--seed` and `--json`.
  Each persona takes about a second, so sweeping is cheap.

## Ideas the CD has already parked

- **Diagonal tiles on a turret** — synergy boosts for neighbouring modules,
  boosts with neighbouring turrets, or fire-rate. `ORTHO` is a table and
  `recomputeGrid()` reads it, so a `DIAG` set with its own weight is a small
  change; the *balance* is not, since it doubles a turret's attachable
  surface from four to eight.
- More module types beyond the six here.
