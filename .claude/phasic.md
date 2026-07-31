# Phasic — phase-change block sort (`games/phasic/index.html`)

Game: one self-contained file (~1850 lines, Canvas 2D) plus games/phasic/wiki.html (~530 lines, DOM). **Web-first prototype of a
planned iOS title** — design decisions favor things that port: pure touch
verbs, no keyboard, the back/reload chrome is web-only by design.

## Core rules (CD spec, decisions locked 2026-07-31)

- Gems are clusters of small beveled squares (1–5 cells, 8 colors, fixed
  canonical shapes — R 2x2, O Z4, Y S4, G T4, C T5, B L3, P I4, M 1x1).
- **Win = every gem SOLID resting in its matching socket** (footprint always
  equals the gem's; validated at load, `keyPat`). Nothing else matters — the
  gravity well can still be deployed. Gems are never locked: a gem sitting
  home (`o.home`) can be dragged out or melted again at any time.
- **No rotation, ever.** If a shape doesn't fit an opening, the answer is
  phase change. Solids are weightless (a deliberate call: pegboard feel,
  sockets can sit anywhere, drag puzzles stay fair).
- **SYMMETRIC REVERSION model: phase = base + flames − frosts** (clamped
  solid…gas). Flames latch and raise the phase; frosts latch and lower it;
  tapping removes the most recent source (flames first) and steps the phase
  back the way that source had moved it — freezing always runs the
  room-search (no room → the source stays latched, refusal buzz). Frost
  thrown at a flamed gem quenches a flame unconsumed (and fire thrown at a
  frosted gem frees a frost unconsumed).
- **Base states** (`def.base = {P:'liquid'|'gas'}`): a born-liquid gem needs
  one latched frost to sit solid in its socket, a born-gas gem needs two —
  and taking that frost back melts it again. Win with latched frosts is
  legal. This is what gives the cold bucket a real job — the frost bucket first appears at L25 Standing Water; every level below it has cold:0 and shows no COLD bucket at all.
- **Freeze needs room**: placement search around the puddle's ideal anchor
  (radius 1.7 cells, per-particle jump ≤1.9 cells; the SOCKET placement gets
  a longer 2.35 reach and is tried first — "close counts, it snaps in").
  No valid placement → refusal: error buzz, shake, toast, `navigator.vibrate`
  (no-op on iOS Safari — real haptics arrive in the iOS build).
- **Gravity well** (0–1 per level): lives in a middle GRAV bucket between
  HOT and COLD. Docked = plain down. Drag it out onto the ring just outside
  the border (`placeGrav` projects to the ring; dropping it on the bucket
  re-docks it — `gravSrc.docked`). Liquid falls TOWARD it, gas flees it.
  Key depth: a well placed ABOVE a puddle's level lifts liquid over walls
  (REFLOW teaches this). The gas guidance field rebuilds on dock/undock.

## Physics (the part worth rereading before touching)

Verlet/PBD at fixed `HSTEP=1/120` (`sub()`), ≤5 particles per gem so all
pairwise work is trivial.

- **Solid**: kinematic. `moveSolid` walks the pixel anchor toward the finger
  in ≤0.30-cell steps, axis-separated (slide), `solidFits` checks walls +
  border + other solids at half-size 0.462 — "fits through the opening" is
  emergent. Half-cell magnetic alignment (0.10 cell capture) makes slot
  threading forgiving. Cosmetic jiggle spring (`jx/jvx`) sells the jello.
- **Liquid**: gravity toward the well; MST tethers (recomputed 0.12 s) with
  max 1.48 cells, **cohesion** pulls tether pairs back toward 0.98
  (f=0.045) — without it a 4-square puddle spreads into a 4.3-cell pancake
  and freeze placement can never cover it (found by the drive suite).
- **Gas**: buoyancy = −gravity ×CELL·8, wander noise, spacing ~**1.6 cells**
  (the spec's "within two square distances" — also what makes a cloud blanket
  a chamber), tethers max 2.55, and a **guidance field**: `buildGasField`
  value-iterates "highest reachable potential" over open cells (potential =
  distance from the well, or depth-below-field when no well), `gasGuide`
  accelerates each particle toward the best neighbor (CELL·26). This is what
  lets gas seep along a ceiling and find a flue — pure buoyancy+noise pins it
  under the first wall forever. Rebuilt when the well moves >0.4 cell.
- **Freeze anim**: `tryFreeze` commits particle→cell matching, `freezeStep`
  runs a 0.5 s springy snap (overshoot wobble) that shoves fluids aside, then
  `updateHome` locks if it landed on the socket anchor with sources home.

## Curriculum: one new idea every 8 levels (CD design, 2026-07-31)

The campaign is **blocks of 8**. The first level of each block is a
hand-authored tutorial that teaches the block's new factor; the rest of the
block is generated with everything introduced so far, complexity rising.
`AUTH` (sparse map, curriculum index → def) holds the 24 authored levels;
`getLevel(i)` fills every other index from the generator.

| Block | Levels | Introduces | Authored |
|---|---|---|---|
| 0 | 1–8 | drag + fit; gem count ramps 1→8 | 1 The First Gem · 2 First Facets · 3 Shape Gates · 8 The Whole Spectrum (all 8, open drawer) |
| 1 | 9–16 | flames (melt/boil + tap-revert) | 9 Meltdown · 10 Room to Pour · 11 Gem Drawer · 12 One Flame · 13 Queue · 14 Glassworks · 16 Full Spectrum |
| 2 | 17–24 | gravity well + gas herding | 17 Sideways · 18 Point Pull · 19 Spring Cleaning · 20 The Kettle · 21 Balloon Route · 22 Reflow · 23 Master Facet |
| 3 | 25–32 | liquid base state (frost holds it) | 25 Standing Water |
| 4 | 33–40 | gas base state (two frosts) | 33 Loose Vapor |
| 5 | 41–48 | black hole obstacle | 41 The Void |
| 6 | 49–56 | bush obstacle | 49 Overgrowth |
| 7 | 57–64 | fan obstacle | 57 Crosswind · 58 The Stopper (tactic level) |
| ∞ | 65+ | endless, all factors mixed | — |

Future mechanics (added by the CD in later sessions) get their own 8-block
inserted before the endless tail, same pattern: tutorial first, then mix.

## Complexity metric (formalized)

Every level carries `cx` (annotated on authored defs, computed by the
generator) and `cxScore(cx)`:

    score = gems + 2·flames + 2·frosts + 2·grav + 2·obstacles + basePts
    (flames/frosts = required applications; grav = well needed/present;
     basePts = 2 per born-liquid gem + 3 per born-gas gem)

`__GF.complexity()` exposes it; the drive suite asserts the generated ramp
is non-decreasing within blocks and that later blocks outscore block 0.
Generation doesn't chase perfect monotonicity (CD: it doesn't have to) —
the envelope rises.

## Obstacles

- **Black hole** (`@`): pulls nearby liquid/gas (radius 1.5, tuned so
  floor-crossing liquid ≥1 cell below survives) and consumes anything whose
  square touches it — including a solid dragged or frozen onto it (freeze
  placement treats hole cells as occupied). A consumed gem = LOST overlay +
  RETRY. Death also aborts a solver run, so generated holes are provably
  avoidable.
- **Bush** (`%`): blocks solids (counts in `solidBlockAt`), **drinks
  liquid** (contact = death), lets gas pass untouched.
- **Fan** (`^v<>`): a tile that blows only gas — beam of ≤5 cells until a
  wall, strong accel, suppresses the gas guidance field in the beam. The
  tile itself is solid to stone and liquid.

## Tactics registry (maintain this list — CD request)

1. **The Stopper** (taught L58): plug a slot with a small stone so a pour
   can cross over it instead of draining — then unplug and put the stone away.
2. **Freeze near, slide home**: crystallize where there's room, drag the
   solid the last stretch.
3. **The well lifts**: park the well above a puddle's level and point
   gravity hauls liquid up over walls (Reflow).
4. **Herd from the far side**: gas flees the well — park it opposite where
   you want the cloud (Kettle, Overgrowth).
5. **Quench from afar**: throw frost at a flamed gem to cool it a step
   without spending the frost (and fire frees a frost, symmetrically).
6. **Melt on the socket's side**: carry a gem over the gap nearest its
   socket before melting, so the pour lands where it will freeze
   (Glassworks).
7. **Steam the hedge**: bushes stop stone and drink liquid — boil and cross
   as vapor (Overgrowth).
8. **Ride the fan**: fans move gas for free where the well can't reach
   (Crosswind).
9. **Dock for down**: drop the well back in its bucket to restore plain
   gravity mid-plan.
10. **Push the puddle** (taught by L13 Queue): solids shove liquid —
   drag a stone into a puddle to bulldoze it through a slot or along a
   shelf that gravity alone won't take it past.
11. **Launch and freeze** (advanced — CD-discovered, 2026-07-31): shove
   a puddle hard with a dragged solid to fling it airborne, then frost it
   mid-flight so it crystallizes where it could never rest. Reserved for a
   future Acrobatics block; no earlier level may require it.
12. **Fence with stone** (CD 2026-07-31): solids ignore the gravity
   well — park them as walls to pen a cloud or puddle in place, then
   grav-push or grav-pull one gem at a time through a maze when flames
   and frosts are scarce.

## Generator + endless + STUCK

Levels without an `AUTH` entry come from `buildGen(i,salt)`: single-shelf
drawer, sockets packed bottom (and a second tier bottom-aligned to row 4
when the gem count overflows one row), gems scattered in rows 0–2, factor
set from the curriculum block, difficulty from position-in-block and an
endless bonus past 64. Every candidate is **beaten by the in-game solver
before being served** (`makeScript()` plans drag/melt/frost routes;
`runScriptFast()` executes headlessly on the real sim — deaths abort);
salts 0–19 are tried, then validated easy rescue salts 90–95. Deterministic
per index (seeded rng + seeded gas wander), so level 23 is identical on
every device. **STUCK** (settings) reloads the level and plays the stored solver script as a visible ghost at 4x (input locked, SOLVING… in the hint bar, SFX on); authored levels and script-less emergencies instead get a staggered fly-home (one gem every 0.3s via the freeze animation). Either way the clear records normally.
`__GF.replayGen()` re-runs the stored winning script — the drive suite
replays every generated level below 65 plus endless spot checks.

## Wiki (games/phasic/wiki.html)

Player-facing wiki, reachable from the cogwheel settings menu (WIKI
button). One self-contained DOM page (no canvas, no game code): a
`PAGES[]` array of `{id, title, icon, html}` drives hash-routed pages —
home, basics, phases, gravity, obstacles, tactics (mirrors this file's
registry, all 12), levels — plus a live search box under the reload
button (title + tag-stripped text; query rendered via textContent only).
Adding a page = appending one PAGES[] object. Keep the tactics page in
sync with this file's registry when either changes.

## Tone

Casual-first: the majority of levels are "bring order to chaos" tidying;
the occasional "I'm pretty smart" moment (Kettle, Reflow, Master Facet,
The Stopper). Keep that ratio when authoring new tutorials.
Gem/socket footprint equality is console-error-validated per load, so the
smoke gate catches a bad map edit.

## Test API + drive suite

`?test=1` freezes the rAF sim (render only); everything advances through
`window.__GF.step(s)` — deterministic. Verbs: `load/applySource/tapHome/
dragTo/setGrav/state/parts/freezeDry`. `freezeDry` returns the placement
search's candidate list — the tool that found both freeze bugs.

`.claude/tests/drive-phasic.cjs` (195 checks): a scripted player solution for
all 24 authored levels (final-leg gate), plus fit-gating negatives (2x2/T4 refused by a
1-wide slot, 1x1 passes), freeze-refusal on the 1-tall shelf without consuming
the frost, the cancel rule with bucket restoration, live-socket re-melting, win-with-deployed-well, the generated-content
replay gate (17-32 + endless), STUCK, menu format, and the console-error
assert. Freeze-near-then-
slide (`ensureLock`) is a legitimate player move the suite uses.

## Audio

House WebAudio stack (lazy init, sfxGain/musicGain, shared noise buffer,
visibilitychange suspend). SFX: melt gliss+hiss, boil bubbles, condense
reverse-hiss, freeze thunk, crystalline lock arp, slosh (velocity-triggered,
throttled), cancel dual-chime, error buzz, win fanfare. **Music: 10 seeded
generative songs** (`SONGS[]` — bpm/root/mode/prog/waves/hat/arp; mulberry32
per song), rotating `level % 10`. Settings overlay: separate music/SFX
sliders + mutes (persisted `phasic_v1`); top-left 🔊 is the master toggle.

## Known trade-offs / iOS-port notes

- Frictionless liquid: a puddle with one particle over a lip can slowly
  siphon through — levels place basins/lips so it rarely matters, and
  re-melting is always free. Add floor friction if a future level needs it.
- Freeze one cell shy of the socket is common on tall drops — by design the
  player slides the solid home (or gets the 2.35 socket snap when close).
- Level select is a DOM `<select>`; the iOS build will want a native picker.
- `navigator.vibrate` guards are already in place for Safari.
