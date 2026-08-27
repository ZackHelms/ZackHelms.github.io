# Turret Builder (`games/turret-builder/index.html`) — architecture notes

A tower defense in which **the turret is the smallest part of the game**. A
turret is a plain gray triangle: 10 kinetic damage, once a second, 100% hit
chance, and it never changes. Everything that makes it dangerous is a tile
you bolt around it — five **modules** on its four orthogonal sides, and
**synergy boosters** on its diagonals — and a module feeds *every* turret and
wall it touches, so the board stops being a scatter of towers and becomes a
circuit. Eight levels of eight waves, about eight minutes each, then endless.

It grew out of grid-defense's ENGINEERING `POWER GRID` skill: the CD's ask
was a whole game built around that one node. The **2026-08-17 redesign**
(second CD pass) replaced the original additive-percentage modules with the
payload model below, added AMP, boosters, named combos and continuous target
tracking.

## The payload model — read this before touching combat

A shot builds **one payload** and copies it outwards. Every module either
shapes the payload or copies it somewhere else, which is why the
combinations compose instead of merely adding up.

| module | what it does to the payload |
| --- | --- |
| **AMP** | multiplies its kinetic damage (+50% for one, +260% for four) |
| **FIRE** | adds a burn — elemental, over 5 s (75% of the hit for one, 700% for four) |
| **ICE** | adds chill — slows movement **and attack speed**. **No damage at all** |
| **ELEC** | copies the payload onto the next enemy (1 hop at 50%, up to 4 at 75%) |
| **BLAST** | copies the payload over a radius (25% for one, 110% for four) |

**DAMAGE decays as it is copied. EFFECTS land at full potency.** That split
is the one judgement call in the spec and it is load-bearing — see § The two
conflicts below.

`propagate()` is the recursion; `addTo()`/`commitShot()` accumulate per enemy
and apply **once per shot**. The accumulation matters: the burn *refreshes*
rather than stacks, so applied piecemeal an enemy standing in its own blast
would keep only the larger of its direct burn and its splash burn (7.5,
discarding 1.875) instead of the spec's 9.375. Accumulating inside a shot and
refreshing only *between* shots gives both the spec's arithmetic and a burn a
fast turret cannot stack into absurdity.

### The worked example, which is a test

The CD's own example — ELEC + BLAST + FIRE + ICE, one per side, base 10 —
comes out exactly, and `drive-turret-builder.cjs` asserts every figure:

| | kinetic | burn over 5 s | chill |
| --- | --- | --- | --- |
| main target | **12.5** (10 direct + 2.5 own splash) | **9.375** (7.5 + 1.875) | full |
| arc target | **6.25** (5 transferred + 1.25 own splash) | **4.6875** | full |
| bystander in the arc's blast | **1.25** | **0.9375** | full |

## Increasing returns, and why there is no variety penalty

The CD asked for "all in on one type yields increasing returns" and "variety
yields diminishing returns". The first is implemented directly: every stack
curve is **super-linear** (`FIRE_DOT`, `ICE_CHILL`, `ELEC_XFER`,
`BLAST_XFER`, `AMP_DMG` — all indexed 0..4).

The second is **emergent, and deliberately not a penalty.** A variety penalty
would contradict the CD's own worked example, which shows an *unpenalised* 10
kinetic and an *unpenalised* 25% splash on a turret carrying four different
types. Instead, spreading across four types leaves every one of them on its
weakest tier, so variety buys **coverage** (chill + multi-target + splash)
rather than throughput. Measured: all-in on FIRE, ELEC or BLAST clears the
campaign; an even five-way mix also clears but scores no better.

## The two conflicts in the rough spec, and how they were resolved

Recorded because both are judgement calls a future session could reasonably
want to revisit:

1. **"elec + arc + fire + ice"** — ELEC *is* the arc module, so this was read
   as ELEC + BLAST + FIRE + ICE (one per side). That reading is the one that
   makes every number in the worked example come out.

2. **ELEC transfers "50% of any dmg or effects like chill"**, but ICE + BLAST
   is also supposed to leave "all enemies in blast radius being chilled".
   Those disagree: at a 25% splash transfer a chill would be quarter-strength
   and the second sentence could not be true. **Damage scales with the
   transfer; effects transfer at full potency.** That satisfies both, and it
   is what makes ICE worth a slot now that it deals no damage — its whole
   product is an effect, and effects propagate for free while damage falls off.

## Diagonal synergy boosters

Boosters go on a turret's **diagonals**, which were inert until this pass —
that is what keeps them a separate decision rather than four more module
slots. A booster lifts every turret it touches diagonally, so the sharing
rule holds there too. Output multiplier capped at `BOOST_CAP` (3.5).

| booster | effect |
| --- | --- |
| **TWIN** ⊕ | ×2 module output, but only while every module on the turret is one type |
| **PRISM** ◈ | +30% module output per distinct type beyond the first |
| **RELAY** ⇄ | +22% module output per turret orthogonally touching this one |
| **CLOCK** » | +40% fire rate; does nothing for the modules |

TWIN is the CD's "same" booster and its worked claim is a test: **two BLAST
modules splash 50%, and a TWIN takes that to a full 100%.**

## Named combos — the discovery layer

Specific side patterns do things no amount of stacking will. Signatures are
**rotation-invariant** so a player who builds the mirror of a combo still
finds it: four of a kind is `quad:<type>`, two opposite pairs is
`pair:<a>+<b>` with the names sorted, and anything else has no combo — an
*adjacent* pair is deliberately nothing.

Fifteen exist. The CD specified the first; the rest were invented here and
the CD has more coming.

| pattern | combo | effect |
| --- | --- | --- |
| BLAST + FIRE | **INCENDIARY GRENADE LAUNCHER** | +60% radius, impacts leave burning ground 5 s |
| BLAST + ICE | **CRYO SHELL** | chill in the blast hits the cap and lasts twice as long |
| BLAST + ELEC | **CHAIN REACTION** | every arc hop detonates a full-strength explosion |
| AMP + BLAST | **DEMOLITION CHARGE** | +40% radius, splash ignores half of armour |
| AMP + FIRE | **THERMAL LANCE** | the burn ignores resistance entirely |
| AMP + ICE | **FROSTBITE** | chilled enemies take 30% more from everything |
| AMP + ELEC | **RAILGUN** | one hop only, at full strength |
| ELEC + FIRE | **WILDFIRE** | arcs carry the burn at full strength, however far |
| ELEC + ICE | **BLIZZARD** | +2 hops and half again the reach |
| FIRE + ICE | **THERMAL SHOCK** | a chilled enemy takes double burn damage |
| four AMP | **SIEGE BATTERY** | +30% range, shots ignore half of armour |
| four FIRE | **FIRESTORM** | the burn spreads to anything within 1.2 cells |
| four ICE | **HAILSTORM** | chilled enemies lose 40% of their armour |
| four ELEC | **TESLA COIL** | +2 hops, no hop transfers below 60% |
| four BLAST | **MORTAR BATTERY** | +50% radius |

A combo turret gets a **pulsing outline in the combo's colour** and its name
on the selection panel. On completion a banner names it and its effect.

**Adding a combo** is one entry in `COMBOS` plus, if it needs a new lever,
one flag read in combat. `comboKeyOf()` and the effect flags are the whole
contract. Announcing is deliberately *not* inside `recomputeTurret` — that
runs on level load, save restore and every lab purchase, and a banner on each
would be noise; `place()` diffs a `comboSnapshot()` through
`announceCombos()` instead.

**Combos cost board space**, which is the real tension: four filled sides
means a plus-shape per turret, so a combo board fields ~8 turrets where a
packed mixed board fields 11. The eval learned this the hard way — see
§ Traps.

## The discoveries codex

Discoveries **persist across runs** (`turretBuilder.v1.codex`), reachable
from the menu and the pause screen. It only ever lists what has actually been
built: a codex that reset each run would make remembering pointless, and one
that listed the undiscovered entries would make learning pointless. `★
DISCOVERIES n/15`.

## Continuous target tracking

A turret **holds** its target frame to frame and only lets go when the target
dies or leaves range — then it snaps to the next in the same frame, with no
cooldown penalty for the switch. `trackTarget()` runs every frame regardless
of cooldown, so the barrel keeps turning to follow, which is what makes the
board read as machines watching the road.

## Damage types — the reason a one-note grid can still lose

- **KINETIC** is reduced **flat** by armour, never below 15% of the hit.
- **ELEMENTAL** is reduced by a **percentage** resist.

`HULK` has armour and no resist (answer: elemental). `WARD` has 60% resist
and no armour (answer: kinetic). The `BREAKER` has both.

**Armour scales with the level floor (`armMulFor`), resist does not** — and
this is load-bearing, not tuning. A turret's kinetic grows all campaign, so a
flat armour of 7 that never moves is a real tax at level 1 and a rounding
error at level 8. Before armour scaled, **bare gray triangles measured their
way to level 6**, which made the whole module layer a garnish.

## Economy — two currencies

| | earned | spent on | resets |
| --- | --- | --- | --- |
| `$` cash | `startCashFor(L)` + bounties | turrets, modules, boosters, walls, upgrades | every level |
| `◆` cores | `coresForWave(gw)` per wave clear | the LAB (10 tracks) | never (per run) |

No skill trees: the depth is the *layout*, and a third currency would compete
with it for attention. `GRID` (+1 turret slot a tier) matters most, because
**turret slots and board space, not cash, are the scarce things**.

A run pays roughly 155 cores against ~340 of lab, so about half is reachable.
The single-target module tracks (FIRE/ICE) climb 26% a tier against the crowd
modules' 14% — a hedge kept from the previous balance pass, though the lab
lever is weak because module tracks rarely reach a high tier.

Losing a level rolls the attempt back **whole** via `run.snapshot`. **Endless
(level 9+) has no retries.**

## Flow and the introduction

`grace` (25 s) → `wave` → `gap` (9 s) → … → `levelclear` (4 s) → next level,
`failed` (3 s) → retry. **Nothing waits on a tap.**

The introduction is measured in **waves**, and there are thirteen placeable
kinds now, so it runs into level 2: TURRET, FIRE, AMP, ICE, ELEC, BLAST on
waves 1-6, WALL/ARMOR/REGEN on 7-9, the four boosters on 10-13. The LAB opens
on wave 5.

Placement keeps both grammars — **drag** a card onto a tile, or **tap** the
card to arm and tap the tile — and **arming does not end on a successful
drop**, because you ring a turret with four modules in four taps.

The build bar has **three tabs** (BUILD / MODULES / SYNERGY); thirteen kinds
will not fit one thumb-height bar. Both `cardRects` *and* `tabRects` must
clear when the selection panel opens — this repo's documented failure mode is
a hidden widget leaving stale hitboxes, and there are now two such tables.

## Difficulty curve

`hpMulFor(gw) = HP_LEVEL^(L-1) · HP_WAVE^(w-1)`, `HP_BOSS` on the eighth
wave — a **sawtooth**, because the board grows from near-empty inside a level
and one smooth ramp makes a level's *opening* waves the dangerous ones.

`HP_LEVEL = 1.30, HP_WAVE = 1.15`, swept after the redesign. **The useful
band is about ten percent wide**: at 1.30 a coherent grid clears all eight
and the marginal builds fall one to five levels short; by 1.40 the coherent
grid itself stalls at 5. The pre-redesign 1.22 left almost every build
clearing, because the new module numbers are far stronger than the
percentages they replaced. **Re-sweep after any module change.**

## Measured strategy ladder

| build | stalls at |
| --- | --- |
| coherent mixed · all-FIRE · all-ELEC · all-BLAST · GRENADIERS · CHAIN REACTIONs | **clears all 8** |
| no boosters · all-AMP | 7 |
| unshared · CRYO SHELL · no walls | 6 |
| no lab | 4 |
| bare turrets · all-ICE · exit-camping | 3 |
| orphaned modules | 2 |

Two of those are design statements worth keeping: **all-ICE cannot carry a
run** because it is a multiplier with nothing to multiply, and **not every
combo is good** — CRYO SHELL chills beautifully and kills slowly.

**Chill stretches a level.** A wave ends when the board is clear, so slowing
everything without killing it faster lengthens the tail: CRYO SHELL runs
~11 min a level against the coherent build's 7.8. That is a measured cost of
a chill-heavy build, not a bug, and the eval caps it at 12 so it cannot
quietly get worse.

## Placement rules, and the overlay that teaches them

`canPlace(kind, r, c)` is the single authority on where a thing may go, and
since 2026-08-23 it is the *same walk* `recomputeGrid()` uses to wire the
board — `hostFor(kind, r, c)`:

| kind | where |
| --- | --- |
| turret | any open ground off the road |
| wall | on the road only, never within 1.2 cells of the mouth or the exit |
| module (`amp/fire/ice/elec/blast`) | orthogonally adjacent to a **turret or wall** |
| `armor` / `regen` (`WALL_ONLY_MODS`) | orthogonally adjacent to a **wall** |
| booster (`twin/prism/relay/clock`) | diagonally adjacent to a **turret** |

Before that, a module or booster could be dropped on any empty non-road cell
and simply fed nothing — the board took the money for hardware that was
inert by construction. **What you may build and what actually connects are
now one rule.** If they ever diverge again, the bug is that someone edited
one walk and not the other; `hostFor()` exists so there is only one to edit.

`openCell(r, c)` is the geometry question on its own — on the board, empty,
not a boulder, not the road — and it is what a *test* wants when it looks for
"a turret cell with four free sides", because `canPlace('fire', …)` around a
turret that does not exist yet correctly answers no.

**The overlay.** While a kind is armed (tap) or in hand (drag),
`drawPlaceOverlay()` scrims every illegal cell and strikes it with a red X,
and captions the board with the rule in five words (`placeHint(kind)`). It
draws **above the tiles**: an occupied cell is an illegal cell, and the
arming wash it replaced tinted only the legal ones, which left "can I put a
module on my turret?" answered by an absence. It reads `placeMask(kind)` —
every cell partitioned good/bad, cached against `gridVer` (bumped by
`recomputeGrid()`) plus the wave, so eight build cards can ask the same
question every frame for free.

Two judgement calls worth keeping:

- **The legal marking is gated on scarcity** (`good.length <= 22%` of the
  board). A module has eight legal cells and they need to glow; a turret has
  a hundred, and washing those green turns the whole map into a highlight and
  buries the terrain. Above the threshold, clear ground is simply left alone
  — the absence of an X is the message.
- **A card with nowhere to go still picks up.** It is dimmed and reads
  `NO SPOT`, but unlike an unaffordable card it does not deny the press:
  lifting it is how a player learns *why*, because the overlay reds out the
  whole board and names the rule. Denying the press would withhold the
  explanation at the exact moment it is wanted.

## Graphics styles — four cel skins and NEON

A ⚙ gear in the top-left chrome (right of ☰) opens a dropdown listing every
entry in `GFX_STYLES`; the pick is stored in `settings.gfx`, mirrored to the
module-level `GFX`, and read everywhere through `cel()`. **`cel()` is the
FAMILY test — `GFX !== 'neon'` — not "is the style TOON".** Five ship:

| id | what it is |
| --- | --- |
| `toon` | **the default.** Cel-shaded: grass, a paved road, boulders, flat-fill steel hardware with a hard ink outline |
| `mech` | military hardware — autocannon on a track deck, ordnance crates, sensor pylons, jersey barriers; the creeps become the column it is shooting at (treads, optics, plating) |
| `steampunk` | brass and rivets — a boiler turret with a working pressure gauge, canister modules, cog boosters, riveted iron walls, clanking automata trailing steam |
| `stoneage` | the CD's brief, literally: cavemen turrets, cauldron modules, totem boosters, a log palisade, horned beasts — and the thrown rock takes the colour of the cauldron it was dipped in |
| `neon` | the original wireframe look — dark board, glowing edges, dashed road |

The cel recipe is one helper: `celShape(path, fill, ink, hi, s)` — flat fill,
one hard ink outline, one rim-light facet — plus `contactShadow()` under
anything that stands on the ground.

### How a skin is defined

`SKINS[id] = { pal, turret?, creep?, module?, booster?, wall?, shot? }`.
`PAL_TOON` is the base palette and every other skin states only what it
changes, so a new palette key reaches all four at once. `applySkin()`
reassigns the live `SK` and `TOON` (the palette keeps its name because every
call site reads it as "the cel palette", which is what it still is) — they
are *reassigned*, not looked up per call, because `celShape()` alone runs a
few hundred times a frame.

The overrides draw in the **local space their wrapper set up**: origin at the
tile centre, contact shadow already laid, and — for a wall — the HP bar still
the wrapper's job. That split is deliberate: a skin can change how a thing
looks and cannot change where it is or what it reports. Three invariants hold
across all four cel skins, and each is worth defending:

- **The type COLOUR is never overridden.** A module is drawn in `M.col` and a
  creep in `c.def.col` in every style, because that colour is how the board
  answers "what is that".
- **The type SILHOUETTE survives.** Creeps keep `creepPath()` and skins hang
  furniture *around* it, so a HULK still reads as a HULK in STONE AGE.
  `creepHeading()` (read off `posAt`, not stored) turns the furniture —
  treads, chimneys, horns — while the identity polygon stays put.
- **Rules readouts are the wrapper's.** The wall HP bar and the elite ring are
  drawn outside the skin hook. A skin quietly restyling those would be a skin
  changing what the board *says*.

`dominantModCol(t)` is the one piece of paint that reaches into a tile: the
module a turret carries most of, ridden along on the beam as `mcol` so
STONE AGE can paint the hurled rock in it. Combat never reads it.

**The sun is fixed in SCREEN space.** A turret's hull and barrel are painted
inside `ctx.rotate(aim)` because a turret turns to face what it is shooting,
so `celShape()` counter-rotates its rim-light wedge by `frameRot()` — the
rotation read back off the live transform (`getTransform()`, iOS Safari 15.4+,
guarded). Without it the light source swings round with the barrel and the
turret reads as a flat shape rather than a lit one; it shipped that way on
2026-08-23 and was caught by measurement, not by eye — bearing of the
brightest sample across five aim angles went `[0, 0, 0, 5, 90]`, and is
`[140 × 5]` with the fix. Note the wedge is `s * 6`, not the snug `±s`
triangle: once counter-rotated a snug wedge no longer covers the clipped
shape. This is the second mechanism in
`.claude/notes/20260823-canvas-skins-and-cel-shading.md`, and turret-builder
is the *second* independent re-derivation to miss it — check it first on any
new cel skin. The note's *first* mechanism (funnel `glow()` so it can go
no-op) does not apply here: this game's neon style uses no `shadowBlur` at
all.

**Testing the sun needs both halves.** The turret measurement only bites on a
skin that swings a large lit body: TOON and MECH pass a ring through their
rotating hulls, but STEAMPUNK swings a thin cannon past a fixed boiler and
STONE AGE a thin arm past a fixed man, so a ring through *their* cores
samples geometry that never rotates and would pass whatever `frameRot()`
returned. `paintCelProbe(rot, s)` closes that: one **disc** drawn through
`celShape()` inside a rotated frame. A disc is rotation-invariant, so the
bright bearing can only move if the rim light moves — the mechanism every
skin shares, tested with the sprite taken out of the question.

**A style is paint — and it is asserted, not asserted-in-prose.** Nothing in
`update()` or the payload maths knows a style exists; every `cel()` and `SK`
call site is inside a draw function. The drive suite proves it the honest way:
the same deterministic scenario — three module-ringed turrets, a wall, 26
seconds of a live wave — is played out under all five styles with **real
frames drawn between ticks**, and every gameplay number (creep distance, HP,
chill, turret aim to six places, wall HP, cash, lives, link count) must come
out byte-identical. Drawing between ticks is the point: a check that only
stepped the sim could not see a draw function that writes to a creep, caches
onto a tile, or moves the board geometry, which is the failure a large skin
system actually invites. It discriminates — `c.d += 0.001` inside
`drawCreepMech` fails it and names MECH as the drifted style. Neon Clash reached
the same shape independently on the same day (`.claude/neon-clash.md` calls it
"a skin is paint"), so treat the cogwheel-plus-dropdown, TOON-default
arrangement as a repo convention now rather than one game's idea; the two
games share no code, only the pattern. Every drawable has a cel twin
(`drawGroundCel`, `drawRoadCel`, `drawBoulder`, `drawTurretCel`,
`drawModuleCel`, `drawBoosterCel`, `drawWallCel`, `creepPath` +
`drawCreepShape`); `draw()` branches once per layer, never per object, and
each cel twin then dispatches to `SK.<part> || <part>BodyToon`.

## The road, the ends of it, and the grass

Three CD asks from 2026-08-23, all of them about the board saying out loud
what the rules already were:

- **The paving joints sit on GRID LINES.** They used to be struck every 0.72
  of a cell measured *along the path*, which is a fine-looking road and a
  useless one: a wall occupies a whole grid cell, so joints drifting out of
  phase with the grid gave the player no way to see where one wall slot ends
  and the next begins. Each joint is now the shared **edge between two
  consecutive road cells**, taken off `pathOrder` — the road cells in walk
  order, deduped against the last one pushed, built in `buildPath()` beside
  `pathCells`. The old centre-line wear dashes went with them: spaced by
  distance, they put a second rhythm on the road permanently out of phase
  with the first.
- **An arrow on the first and last road cell**, pointing the way the creeps
  walk, painted from the ROAD palette because they are part of the road and
  not a HUD element floating over it. `drawPathEnds()` reads the direction
  off `posAt` at each end rather than off the cells, so a map whose road
  leaves the board sideways still gets it right. They land exactly on the two
  cells `canPlace('wall', …)` refuses (within 1.2 cells of the mouth or the
  exit), which is why they can be drawn *as road* without lying about what is
  buildable.
- **The ground is grass, and only grass.** The dirt verge hugging the road and
  the worn brown patches are gone: the brown fought the road for attention and
  made the buildable field look like it had rules in it that it does not.
  Terrain now varies only in **shade**, and the one thing on the field that is
  not grass — a boulder — is the one thing you genuinely cannot build on.

Two rules the terrain earned the hard way, both still in force:

- **Scatter comes from a stable per-cell hash (`h2(a, b)`), never from the
  seeded `RNG`.** Gameplay RNG is reserved for sparks and shake, and drawing
  from it would make the ground move every frame *and* silently couple the
  art to the simulation's determinism.
- **Ground is decided per MAP, not per cell.** The first version picked
  dirt-or-grass per grid cell and painted hard-edged squares — it read as a
  checkerboard, not as ground. `buildTerrain()` caches (keyed
  `GFX:mapIdx:cell:boardX:boardY` — the style is in the key because the grass
  colour is baked in — and invalidated by `buildPath()`) a set of multi-lobe
  tone patches plus grass tufts with per-tuft lean, length and blade count.
  **Perfect circles and identical tufts both read as stamps**, which is why
  the tone patches are three overlapping lobes and not discs: that mistake
  was made once with the dirt blobs and again, the same day, with the tone
  patches that outlived them.

## Determinism

**The simulation carries no gameplay randomness.** Wave composition, elite
stamping, targeting and damage are all deterministic functions of the global
wave index; `RNG` drives only sparks and screen shake. Runs are byte-identical
across `--seed` values.

That makes the eval exactly reproducible — but **agreement across seeds is
not evidence of a robust balance**, and a report must not present it as such.
Vary the persona, not the seed.

## Test hooks (`window.__TB`)

`st()` · `run()`, `tilesRaw()`, `creepsRaw()`, `groundsRaw()` ·
`newRun/startLevel/ready/skipGap/advance/step` · `place/sell/upgrade/buyLab` ·
`turretStats(r,c)` (payload, boosters, combo, **sides**), `wallStats`,
`modsAt`, `tileAt`, `comboAt` · `canPlace`, `openCell`, `buildableCells(kind)`,
`placeMask(kind)`, `placeHint(kind)`, `overlayKind()`, `arm(kind)` ·
`pathCellList()`, `pathOrderList()` (the road in WALK order), `pathEnds()` ·
`forceDraw()`, `clearToasts()`, `paintTurret(aim, s)`,
`paintCelProbe(rot, s)`, `pixelAt(x, y)` ·
`setCurve/setPacing/seedRandom` · `cardRects/tabRects/panelRects/hudRects` ·
`codex()`, `COMBO_TOTAL` · `gfx()`, `setGfx(id)`, `GFX_STYLES`,
`gfxMenuOpen/openGfxMenu/closeGfxMenu`.

`clearToasts()` is not a convenience. Toasts draw **over the board**, so every
pixel measurement of what the board itself painted — grass, joints, arrows —
read the tail of a `LEVEL 1 · SUBSTATION` banner instead until it existed; all
three of those checks failed on their first run for that reason and none of
them failed for the reason they were testing.

Four hooks exist to make the spec *measurable* rather than inferred:

- **`setLog(on)` / `log()`** — every damage instance (`{id, amt, raw, type,
  tag, parts}`), so the worked example is a sum rather than a guess.
- **`spawnDummy({hp, arm, res, x, y, d, spd, pinned})`** — a bare target with
  exactly the stats you ask for; `pinned` holds position so chain geometry can
  be laid out by hand.
- **`moveCreep(id, x, y)`** — teleport a dummy, the only honest way to test
  "walked out of range" without also testing the pathing.
- **`setPhase(p, t)`** — parks the flow machine so a measurement is never
  gatecrashed by the next wave.

Suites — **rules and balance are separate files**, so a rebalance never fights
a mechanics regression:

- `.claude/tests/drive-turret-builder.cjs` (207 checks) — the spec verbatim
  including the worked example, each module in isolation and stacked, the
  effects-vs-damage split, tracking and snap, all four boosters, all fifteen
  combos with their effects, the codex, walls, economy, flow, the sawtooth,
  the canvas UI pressed through real touch events, the placement rules and
  the overlay mask, all **five graphics styles**
  (default, dropdown, persistence, **each renderer driven through real frames
  on a populated board** — a per-style throw fails only that style's check,
  verified by breaking `drawGroundNeon` and watching TOON stay green — the
  **fixed sun** both on a tracking turret and on the bare `paintCelProbe`
  disc, and a **silhouette fingerprint** proving each cel skin replaces the
  shape and not merely the paint), and the **road group** (the walk order is
  a one-cell chain, the ends of it are where the arrows go and where a wall
  is refused, a joint on every road-cell boundary, an arrow on both end
  cells, and green at five points in every buildable cell in every cel
  style), and the **skin-neutrality** check above. Every one of those was
  verified by breaking the thing it asserts — see § Traps for the two that
  first passed against the very regression they were written to catch.
- `.claude/tests/eval-turret-builder.cjs` (22 claims) — balance and pacing via
  personas. `--strategy f.json`, `--only NAME`, `--curve a,b`, `--seed`,
  `--json`. About a second each.

## Traps this codebase has already fallen into

- **A curve sweep that changes nothing means the curve is not the problem.**
  Before the redesign, every persona stalled at level 3 whether `HP_LEVEL`
  was 1.16 or 1.54; the causes were the eval's core-spending settling for the
  cheapest affordable tier and a power budget too small for a grid to exist.
- **A turret's `links` now come from modules *and* boosters**, so anything
  reading `l.from.mod` crashes on a booster link. Use `linkColour()`.
- **`canPlace('fire', …)` is not "is this cell open".** Since modules must
  touch a host, it answers *no* for every side of a turret that has not been
  built yet — which is exactly what a test helper hunting for "a cell with
  four free sides" asks. Six drive-suite helpers were quietly written that
  way; they use `openCell()` now. When a rule tightens, audit the tests that
  used the old rule as a *proxy* for something else, not just the ones that
  assert it.
- **Anything that maps a build-card kind to a silhouette must go through
  `drawKindShape()`.** The drag ghost used to fall through to
  `drawModuleShape` for any kind that was not a turret or a wall, so holding a
  BOOSTER card looked up `MODULES['twin']`, found undefined, and threw inside
  `draw()` — which ended the requestAnimationFrame chain and froze the game
  with no HUD and no build bar. Shipped and CD-reported, because **the drive
  test could not see it**: `T.drag()` dispatches touchstart/move/end
  synchronously inside one `page.evaluate`, so no frame ever renders while
  `dragCard` is set. The regression test now holds each card down across REAL
  animation frames (`setTimeout` between touchstart and touchend) for all
  thirteen kinds, in both the drag and the arm gesture. Verified by
  reintroducing the bug and watching it fail.
- **The loop now survives a throw.** `loop()` wraps update+draw in a try and
  always re-arms `requestAnimationFrame`, logging each distinct error once. A
  rendering mistake should cost a frame, not brick the session until reload.
  The error still reaches the console, which the drive suite watches, so this
  cannot hide a regression.
- **The drive suite's `P()` helper must forward its argument.**
  `page.evaluate(fn)` with no second argument silently passes `undefined`,
  which made the first version of the frozen-board test throw on
  `BAR_TABS.find(...).id` instead of testing anything.
- **`clearStorage` must drop the in-memory codex too**, or it diverges from
  disk and `recordCombo` declines to re-write entries it thinks are known.
- **A pairs persona must refuse cells it cannot finish.** The first version
  packed eleven turrets into the highest-coverage cells, left them with no
  free sides, and built seven modules and ZERO combos while reporting a full
  board. Check the printed `board:` line before believing a verdict.
- **"All four are distinct" is not "all four are different".** The check that
  each cel skin paints its own turret first compared whole-sprite pixel
  hashes, and passed with `turret: drawTurretMech` deliberately deleted from
  `SKINS` — because the palette still went through, so a MECH turret with a
  TOON *shape* hashed differently. Rewritten to hash the SILHOUETTE it then
  passed on a **one-sample** antialiasing difference. The check that works
  asserts a minimum pairwise distance: the closest honest pair is toon/mech at
  7.9%, a fallen-through skin is 0.1%, and the bar is 3%. **A distinctness
  test needs a distance, not an inequality.**
- **A neutrality snapshot must not contain identity counters.** The
  skin-is-paint check first put `t.tid` — the id of the creep a turret is
  holding — in its per-style snapshot, and failed on all four non-TOON styles
  for a reason that had nothing to do with skins: `creepSeq` is a
  **page-lifetime** counter that no run reset touches, so the fifth style's
  run numbers its creeps far above the first's. The snapshot records *whether*
  a target is held, not which one. Anything id-shaped in a cross-run
  comparison deserves that suspicion first.
- **A pixel measurement of the board must clear the chrome first.** Grass,
  joints and arrows were all first measured through a `LEVEL 1 · SUBSTATION`
  toast — three failures, none of them about the thing under test.
  `clearToasts()` exists for that.
- **Every one of these is proved by breaking it.** Stub `frameRot()` (both sun
  checks fail), drop one skin's `turret:` entry (the fingerprint fails), push
  the joints 0.34 cell out of phase (the joint check fails), comment out
  `drawPathEnds()` (the arrow check fails), stroke a dirt verge back along the
  road (the grass check fails) — and that last one only fails once the grass
  check samples FIVE points per cell, because a verge hugging the road misses
  every cell centre while browning the quarter of each neighbour nearest it.
  The first version of that check sampled centres only and stayed green
  against the very thing it was written to catch.
- **Ground decided per cell reads as a checkerboard.** The first TOON terrain
  chose dirt-or-grass per grid cell and filled squares; on screen it was a
  chequered field, not ground. Terrain ignores the grid entirely. Same class
  of mistake, three times more: perfect circles for worn patches, one
  identical grass tuft repeated, and then — after the dirt was removed
  altogether — perfect circles *again* for the grass **tone** patches, which
  had quietly inherited the shape the dirt blobs were fixed out of. All read
  as stamps until they were given per-instance variation.
- **Print page errors as they happen.** A crash inside `draw()` stops the
  canvas updating and then surfaces as a baffling stale-hitbox failure fifty
  checks later.

## Parked for the CD

- More combos — the CD has a list coming. One entry in `COMBOS` each.
- Boosters beyond the four here; `BOOSTERS` and `DIAG` are both tables.
- Whether CRYO SHELL's level-stretching should be compensated, and whether
  all-ICE deserves a way to convert chill into damage on its own.
