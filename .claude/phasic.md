# Phasic — phase-change block sort (`games/phasic/index.html`)

One self-contained file, ~1250 lines, Canvas 2D. **Web-first prototype of a
planned iOS title** — design decisions favor things that port: pure touch
verbs, no keyboard, the back/reload chrome is web-only by design.

## Core rules (CD spec, decisions locked 2026-07-31)

- Gems are clusters of small beveled squares (1–5 cells, 8 colors, fixed
  canonical shapes — R 2x2, O Z4, Y S4, G T4, C T5, B L3, P I4, M 1x1).
- **Win = every gem SOLID in its matching socket** (socket footprint always
  equals the gem's; validated at load, `keyPat`). Sources must be tapped home
  before a gem can lock.
- **No rotation, ever.** If a shape doesn't fit an opening, the answer is
  phase change. Solids are weightless (a deliberate call: pegboard feel,
  sockets can sit anywhere, drag puzzles stay fair).
- **One source = one step.** Heat: solid→liquid, liquid→gas. Cold: gas→liquid,
  liquid→solid. A source stays latched on the gem until single-tapped home
  (flies back to its bucket). Phase persists after release. Cold onto a gem
  with a latched heat cancels BOTH (and vice versa) — no phase change.
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

## Levels + tone

**CD direction (2026-07-31): casual and fun first.** The majority of levels
should feel like "bring order to chaos" — tidying a jumble is the core
accomplishment — with only the occasional "I'm pretty smart" puzzle. The
chaos levels are GEM DRAWER, SPRING CLEANING, GLASSWORKS and the all-8-gem
FULL SPECTRUM finale; the smart moments are THE KETTLE, REFLOW and MASTER
FACET. Keep this ratio when adding levels.

16 authored maps (`LEVELS[]`, 10×12 ASCII: `#` wall, UPPER gem, lower socket).
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

`.claude/tests/drive-phasic.cjs` (87 checks): a scripted player solution for
all 16 levels (final-leg gate), plus fit-gating negatives (2x2/T4 refused by a
1-wide slot, 1x1 passes), freeze-refusal on the 1-tall shelf without consuming
the frost, the cancel rule with bucket restoration, locked-gem immunity,
sources-home-before-lock, gravity dock/undock, and the console-error assert. Freeze-near-then-
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
