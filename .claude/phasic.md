# Phasic — phase-change block sort (`games/phasic/index.html`)

One self-contained file, ~1250 lines, Canvas 2D. **Web-first prototype of a
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
- **REVERSION model (CD change 2026-07-31): phase = flame count.** 0 flames
  = solid, 1 = liquid, 2 = gas. A flame latches when dropped; single-tapping
  the gem takes the most recent flame back AND cools it one step (gas
  condenses; liquid runs the freeze room-search — no room means the flame
  stays latched and you get the refusal buzz). Frost is a thrown quench: on
  a flamed gem it removes one flame (same as a tap) and is never consumed;
  on a flameless gem it has nothing to do. The cold bucket is therefore a
  convenience verb, not a required one — budgets keep it around for feel.
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
  `checkSocket` locks if it landed on the socket anchor with sources home.

## Generator + endless + STUCK

Authored levels are 0–15 (`LEVELS[]`). **Levels 17+ are procedural**
(`getLevel(i)` → `buildGen(i,salt)`): a constructive single-shelf "drawer"
template — sockets packed along the floor, gems scattered up top, one shelf
at row 5 with a wide gap (+ optional 1-wide slot), difficulty `d=i-15`
scales gem count (2→4), gap width (4→2), budgets and the well. Every
candidate is **beaten by the in-game solver before it is served**
(`makeScript()` plans drag routes through wide-enough gaps and
melt-pour-tap routes otherwise; `runScriptFast()` executes it headlessly on
the real sim; failing salts are discarded, so a served level is a solved
level). Generation is deterministic per index — seeded rng plus seeded gas
wander (`p.wp`) — so level 23 is identical on every device. Endless: NEXT
LEVEL simply never stops; the level list grows as you clear. **STUCK**
(settings menu) auto-solves the current level — gems snap home, progress
is recorded — so no level can ever wall the player. Generated maps live in
`genCache` with their winning script (`__GF.replayGen()` re-runs it; the
drive suite replays all of 17–32 plus endless spot checks as the
generated-content gate). Next generator iteration when wanted: two-shelf
and gas/attic templates.

## Levels + tone

**CD direction (2026-07-31): casual and fun first.** The majority of levels
should feel like "bring order to chaos" — tidying a jumble is the core
accomplishment — with only the occasional "I'm pretty smart" puzzle. The
chaos levels are GEM DRAWER, SPRING CLEANING, GLASSWORKS and the all-8-gem
FULL SPECTRUM finale; the smart moments are THE KETTLE, REFLOW and MASTER
FACET. Keep this ratio when adding levels.

16 authored maps (indices 0-15) (`LEVELS[]`, 10×12 ASCII: `#` wall, UPPER gem, lower socket).
Ramp: drag → fit gates → melt (+cancel rule) → freeze-needs-room →
GEM DRAWER (chaos-lite) → source economy → well intro (SIDEWAYS) → point
pull → SPRING CLEANING (chaos + one well-dance) → **kettle** (boil + herd
gas with the well; the well must be taught before any gas level — gas has no
horizontal control without it) → balloon pocket → mixed queue → GLASSWORKS
(melt-pour-freeze production line) → well-lift (REFLOW) → MASTER FACET →
FULL SPECTRUM.
Gem/socket footprint equality is console-error-validated per load, so the
smoke gate catches a bad map edit.

## Test API + drive suite

`?test=1` freezes the rAF sim (render only); everything advances through
`window.__GF.step(s)` — deterministic. Verbs: `load/applySource/tapHome/
dragTo/setGrav/state/parts/freezeDry`. `freezeDry` returns the placement
search's candidate list — the tool that found both freeze bugs.

`.claude/tests/drive-phasic.cjs` (120 checks): a scripted player solution for
all 16 authored levels (final-leg gate), plus fit-gating negatives (2x2/T4 refused by a
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
