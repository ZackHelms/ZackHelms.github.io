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
  **Settled puddles get a fair reach** (phasfreeze fix, 2026-07-31): a
  RESTING puddle (max per-particle drift ≤ CELL·0.01 per sub-step) widens
  the non-socket jump cap to `min(2.6, max(1.9, h−0.9+0.45))` for an h-tall
  footprint — a 1-row pancake must reach h−0.9 cells up, so the flat 1.9
  structurally refused EVERY settled 3-tall gem — and seeds extra candidate
  anchors that stand the footprint on the puddle's resting row. Moving
  puddles keep 1.9 exactly, so mid-air/mid-pour freezes still refuse. Rule
  of thumb: at rest with real room, the first frost takes.
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
| 2 | 17–24 | gravity well + gas herding | 17 The Side Pocket · 18 Sideways · 19 Point Pull · 20 The Kettle · 21 Balloon Route · 22 Reflow · 23 Master Facet (L24 generated) |
| 3 | 25–32 | liquid base state (frost holds it) | 25 Standing Water |
| 4 | 33–40 | gas base state (two frosts) | 33 Loose Vapor |
| 5 | 41–48 | black hole obstacle | 41 The Void |
| 6 | 49–56 | bush obstacle | 49 Overgrowth |
| 7 | 57–64 | fan obstacle | 57 Crosswind · 58 The Stopper (tactic level) |
| ∞ | 65+ | endless, all factors mixed | — |

**Block-lesson naming (phasnames, 2026-08-01):** every curriculum level
displays as `Word · Name` — `BLOCK_WORD=['Drag','Flame','Gravity','Frost',
'Vapor','Void','Hedge','Wind']` (one word per block, beside `blockOf`) and
`lvlName(i,def)` wrap the stored name at the four display sites (level-select
options — `N · Word · Name`, hint bar, ghost-replay hint, clear screen).
Display-layer only: defs, `genName`, `AUTH`, `genCache` and saves are
untouched, so determinism is unaffected. Endless (index 64+) is unprefixed
(not a lesson block; CD can add a word with a one-line change).

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

Levels without an `AUTH` entry come from `buildGen(i,salt)` on one of three
board templates, drawn seeded-first per candidate: **drawer** (the original
single shelf), **two-shelf** (shelves rows 4+8, offset gaps, a staging
floor — sockets dealt scatter-first, packed outside-in from each gap), and
**gas attic** (ceiling shelf + flue; the born-gas gem sockets in the loft;
block 4+ only). In the obstacle blocks the generator **weaves the hazard
into the solution path** (odds ramp within each block): a void directly
under a slot the pour must cross, with a guaranteed 1x1 plug stone (the
Stopper, generalized); a mid-field hedge that forces a vapor crossing;
a fan lane the script rides with the well docked. Woven candidates that
solve are preferred over plain ones; every candidate is still **beaten by
the in-game solver before being served** (`makeScript` routes per template
and weave; `runScriptFast` executes on the real sim — deaths abort, so a
served hazard is a beaten hazard); salts 0-19, then validated easy rescue
salts 90-95 (never woven, always drawer). Deterministic per index.
**STUCK** replays the stored script as the visible ghost. `__GF.mapInfo()`
exposes the board as geometry (template, weave, obstacle cells, shelves/
gaps, gems, script) for the drive suite's in-path gates.

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
visibilitychange suspend). **SFX:** melt gliss+hiss, boil bubbles, condense
reverse-hiss, freeze thunk, crystalline lock arp, slosh (velocity-triggered,
throttled), cancel dual-chime, win fanfare; **obstacle deaths** — void plays
a dedicated **gulp** (descending 300→40 Hz sine + low thump + swallowed noise
tail), bush plays a **slurp** (bandpass noise 800→300 Hz + two descending blips);
`sfxError` remains for genuine rejects only. **Fan ambient hum:** one shared loop
node (bandpass noise ~185 Hz, slow LFO, ≤0.05 into sfxGain), idempotent
`fanHumStart/fanHumStop`, started by `loadLevel` when `fans.length>0`, stopped at
`loadLevel` top + fail/clear transitions, never during `solving`/validation
(those call `setupLevel` directly); `ac.suspend()` on `visibilitychange` silences
it for free. It is SFX — governed by the SFX slider/mute, no new setting.
**Music: 10 seeded generative songs** (`SONGS[]` — bpm/root/mode/prog/waves/hat/arp;
mulberry32 per song), per-block assignment — `songStart(i<64?blockOf(i):i%10)`:
curriculum blocks 0–7 own songs 0–7; endless (i≥64) rotates all 10 (songs 9–10
appear only in endless — accepted shape, `SONGS[]` stays at 10). Each song carries
a `t:` title (01 First Light, 02 Copper Squares, 03 Slow Thaw, 04 Vapor Trail,
05 Deep Cellar, 06 Warm Static, 07 Ride the Flue, 08 Still Water, 09 Amber Drift,
10 Night Drawer — CD renames at will); a dim `NN · Title` now-playing line draws
at the very bottom (center in portrait, bottom-left in landscape; drawn outside
the shake transform; `__GF.nowPlaying()`). Settings overlay: separate music/SFX
sliders + mutes (persisted `phasic_v1`); top-left 🔊 is the master toggle.
**TEST API:** `?test=1` freezes rAF sim; `window.__SFXLOG` (when set) logs
`gulp`/`slurp`/`hum-on`/`hum-off`/`['song', idx]` before any `ac` guard.
**Suite:** `phasaudio` group, 17 checks — suite total 317.

## Chrome / layout (phaschrome round, 2026-07-31)

- **Buckets ride half a height high in portrait** (`bucketRects` y =
  `H-BZ+6-bh*0.5`) so grabs stay clear of the iOS swipe-up edge; the toast
  offset moved in lockstep (161px). Field geometry (CELL/FX/FY) unchanged.
- **Landscape = right-side bucket column** (HOT/GRAV/COLD, `CZ` width
  strip; `layout()` branches on `W>H`): the field uses >90% of canvas
  height (was ~68%). Portrait math is bit-identical. The HOT grab test is
  y-bounded only in landscape. The board stays portrait-shaped 10×12 —
  a rotated board layout is a future design question, not chrome.
- **Rotation-squish fix (TRACED): a degenerate viewport (canvas shorter
  than ~124px) drove `CELL` negative**, corrupting the pixel-space
  particle state; the `oldCell>0` guard then dropped every later rescale,
  making it permanent until reload. Fix: `CELL` floored at 1, BZ's 80px
  clamp floor degrades on short boxes (`Math.min(80,H*0.42)` — identity
  for H≥191), repeated `layout()` is a strict no-op, and a post-layout
  self-check re-runs `layout()` once if the canvas backing store disagrees
  with the bounding rect by >2px. Which iOS event sequence delivers the
  degenerate box on device is an UNTRACED HYPOTHESIS — the invariant is
  pinned instead (suite: rotation round-trips, short-viewport sweeps,
  degenerate-box excursion, 10× layout idempotence). Lifecycle: `reflow()`
  runs `layout()` now + next rAF + 300ms on `resize`, `orientationchange`,
  and `visualViewport.resize`.

## Licensing (2026-07-31)

games/phasic/ is proprietary — its own LICENSE (all rights reserved,
play-only permission) excludes it from the repo's root Apache 2.0 grant
via a scope-exception preamble prepended to LICENSE.txt. Forward-only:
copies distributed under Apache 2.0 before 2026-07-31 stay Apache. The
PHASIC name was never trademark-licensed (Apache §6). In-game: settings
cogwheel → LICENSE button; every wiki page shows a © footer linking it.
CD-side IP actions (USPTO, copyright reg., Apple) live in TODO.md
## Needs Zack.

## Brand icon (phasbrand round, 2026-08-01)

- **`games/phasic/icon.svg`** — hand-authored 512x512-viewBox brand mark: 2x2
  beveled ruby squares (game palette `#ff2244`/`#ff8899`/`#8d0f22`, drawGem bevel
  style) over a leafy bush (bush palette `#123c1a`/`#2e7d32`/`#66bb6a`); horizontal
  phase thirds across the whole gem block — bottom third opaque faceted solid,
  middle third ~55%-opacity liquid with wavy top edge at the 1/3 line, top third
  mostly-transparent gas puffs. Fully self-contained SVG (no external refs) — used
  as favicon and inside CSS `url()`.
- **`games/phasic/icon-1024.png`** — 1024x1024 RGBA master rasterized from the SVG
  (playwright, `omitBackground`), keeps transparency. **iOS caveat:** App Store
  icons disallow transparency — flattening onto an opaque background happens in
  the future iOS pipeline, never here. Never run an optimizer/minifier on this
  master.
- **Game head links:** `rel="icon"` (SVG) + `rel="apple-touch-icon"` (PNG).
- **Hub integration:** PHASIC card is FIRST in the hub grid; card markup keeps
  `💠` as the icon-div text (the games-sync gate parses cards with a text-only-icon
  regex and enforces card↔dataset icon equality — do not put an `<img>` in the
  icon div); SVG renders via hub CSS rule `.game-card[href="phasic/"] .game-icon
  { … background: url('phasic/icon.svg') …; font-size: 0; }`.
- **Suite:** `phasbrand` group, 11 checks (files/magic bytes, head rels, hub-first
  card, CSS rule, live computed-style render) — suite total 300.

## Gravity block is orb-mandatory (phasgrav round, 2026-08-01)

The CD's reported exploit (shove the puddle with a solid) turned out broader: four maps (Sideways, Point Pull, Balloon Route, Reflow) could be solved by dragging the gem home as STONE — no melt at all. Hardened by geometry, never by disabling mechanics (tactics #10-12 stay legal game-wide): 1-cell mouths no solid footprint fits, socket pockets beyond any solid-reachable cell, pour-only routes. The Kettle was already proof (single gem, flue). Master Facet's real shove exploit killed by a 3-tall divide + far-cellar socket.

Anti-shove property is pinned by suite negatives per map (drag-impossibility, L23 18-pass shove-peak, L24 BFS impassability + docked-well negative). Suite total 335.

`gravmaze` template: block-2-only generated boards (60% odds, index 23 is the only generated block-2 index until obstacle-era mazes), sealed 3-row tunnel under the drawer, 1-cell mouth, 2-3 alternating roof/floor baffles, roofed socket alcove. IMPORTANT recorded lesson: a literal 1-row serpentine channel is UNSOLVABLE for the soft-body pour (0/24 — particles can't file through 1-cell gates into 1-row legs); the 3-row tunnel with 1-cell gates is the working shape (40/40). `getLevel` prefers gravmaze candidates in block 2 (same scan mechanism as woven boards in blocks 5-7). Determinism proven by byte-diff: only index 23's sub-0.60-salt candidates changed.

Traced-but-inert corner: the maze-gem pool still includes 'B' (L-tromino) whose notch cell can rest at the mouth row without breaching the tunnel — doesn't threaten anti-shove; noted in case a future audit trips on it.

`save.done` indices 16-18 shifted meaning with the AUTH reshuffle (acceptable — CD is the only player).

## Known trade-offs / iOS-port notes

- Frictionless liquid: a puddle with one particle over a lip can slowly
  siphon through — levels place basins/lips so it rarely matters, and
  re-melting is always free. Add floor friction if a future level needs it.
- Freeze one cell shy of the socket is common on tall drops — by design the
  player slides the solid home (or gets the 2.35 socket snap when close).
- Level select is a DOM `<select>`; the iOS build will want a native picker.
- `navigator.vibrate` guards are already in place for Safari.
