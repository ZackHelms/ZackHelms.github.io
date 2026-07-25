# Locksport — architecture & context

`games/locksport/index.html` (single self-contained file, ~640 lines). A
realistic **side-view pin-tumbler single-pin-picking** simulator: a cutaway
lock on a workbench, tension auto-applied, the player drags a pick to feel
out and set each binding pin. Zen (no timer death) + 3-star rating; a
12-lock practice path that mirrors the real SPP learning curve; level-select
dropdown for replaying anything unlocked.

## The real mechanic it models (research-grounded)

Real single-pin picking: apply light rotational **tension** to the plug; one
pin **binds** first (manufacturing tolerances mean the plug's rotation pinches
exactly one driver against the shear line). You lift *that* pin — it ratchets
up under friction and **holds** its lift instead of springing back (that stiff,
holding feel IS how you identify the binding pin). When its driver crosses the
**shear line** the plug turns a hair and the pin **sets** with a click; the next
pin now binds. Overlift past the shear margin and the driver jams above the
line → you must **reset** (dump tension, all pins drop). Sources consulted:
art-of-lockpicking.com (security pins, SPP), lockpickworld.com (practice-lock
progression), southord.com, scienceinsights.org (spool false-set + counter-
rotation easing).

Security drivers, faithfully:
- **Spool** (`p`): lifts to a **false set** — a big plug over-rotation (the
  "clunk"/counter-rotation *tell*) that traps it at the waist. Heavy tension
  pinches it solid; you must **ease tension into a green band** so it walks up
  past the waist to the true shear line. Too light → everything drops.
- **Serrated** (`r`): a stack of little ledges that each give a deceptive
  mini-click. Heavy tension sticks it at a serration; a light touch lets it
  pass all of them to the true set.

## Coordinates & geometry (screen space, px)

- `Y_SHEAR = 330` — the shear-line seam (housing/plug boundary).
- `KEYTIP_REST = 440` — a key pin's tip at rest (bottom of travel).
- Pin `setLift = 110 - keyLen` (keyLen 56..84 → setLift 26..54 px). A pin is
  **set** when its lift reaches `setLift`; **overset/jammed** past
  `setLift + tol.over`.
- `pinX(i)` spreads `n` chambers 46 px apart, centered. `pickTipX()` maps
  `pick.depth` 0..1 across the chamber span; `pinContact(p)` is ±11 px (hook)
  or ±26 px (rake).
- Plug **visual rotation** `plugAng` = `setCount*1.4` + `8×` per false-set
  spool (eases back as the spool walks up — the counter-rotation animation);
  `+40×openAnim` on open. `plugShift = plugAng*0.55` offsets the plug bore &
  key pins vs the fixed housing bores — that visible ledge is the shear line.

## State model

`game`: `menu | play | open`. Each pin has `state`:
`free → binding → (falseset) → set`, or `→ overset` (jam). Exactly one pin is
`binding` at a time: `bindingIndex()` = `lock.order[lock.setCount]` — a seeded
shuffle, so **bind order is randomized** per lock (not left-to-right).

`update(dt)` per pin:
- **`p.drop>0`** (released by reset/slip) → falls under gravity with a small
  bounce; runs *before* any state routing so even the next binding pin drops.
- **non-binding free pin** → springs toward the pick's lift when touched,
  back to 0 otherwise (loose, no hold).
- **binding pin** → `updateBinding`: below `MIN_SET` tension it holds but
  can't advance; otherwise `advanceBinding` ratchets it up in stick-slip
  `tol.step` jumps (slow sub-`tol.creep` pushes glide smoothly), handling
  serration catches, spool false-set, shear crossing (set vs jam), overset.
- **set pin** → key pin goes floppy (`freeLift`); re-lifting it past
  `setLift + tol.over` **jams it** and decrements `setCount` (real hazard:
  don't re-push set pins).

Tolerance classes `TOLS.{loose,med,tight}` = `{over, step, creep}` tighten
across the path. `tol.over` shrinks 11→4.8, so late locks jam far more easily.

## Tension

Levels 1–6: tension auto-eases to 0.55 (`tensionTarget`). Levels 7+ (`hasPad()`,
spools appear): a **left-thumb tension pad** (`zones.pad`, bottom-left) sets
`tensionHeld` by y-position. Bands on the pad: red heavy (`>HEAVY_T 0.75`,
serrations stick / spool pinches), gray ok, **green counter-rotation**
(`DROP_T..COUNTER_MAX` 0.12..0.50, walks a false-set spool up), red drop
(`<DROP_T`, every set pin falls). This is the two-handed feel — right thumb
picks in `zones.probe`, left thumb modulates tension.

## Input

- `zones.probe` (right/center, big): one finger drag — **dx slides**
  `pick.depth`, **dy lifts** `pick.lift` (0..70). Starts the clock on first
  touch. `rakeVX` tracks horizontal velocity for rake detection.
- `zones.pad` (bottom-left, levels 7+): drag sets tension.
- DOM buttons: `HOOK`/`RAKE` tool select, `RESET ⟲` (drops pins, +1 reset),
  back, mute. All go through `bindTap` (400 ms debounce, `audioInit()`).
- **Rake** (`updateRake`): fast horizontal reversals with the tips riding the
  pins. On loose/`rake:true` locks a scrub has ~55% to set the current
  standard pin (small chance to chain the next); on tight or security locks
  it mostly grits and can jam — modeling why raking beats cheap locks but
  fails real ones. Picks reset to HOOK each level.

## Levels (the practice path)

`LEVELS[12]`: FIRST PIN (1) → TWO/THREE PINS → WARM-UP FOUR → FIVE STACK
(rakeable) → TIGHT FIVE (tolerances bite, raking jams) → FIRST/TWIN SPOOLS
(pad + counter-rotation) → SERRATED → SECURITY MIX → SIX CHAMBERS → OLD IRON
(6 pins, every driver a security pin). `drv` string per level encodes each
chamber's driver type; `seed` drives the deterministic generator
(`genLock` / `mulberry32`). `par` seconds gate 3-star. Progress in
`localStorage['locksport']` = `{u:unlockedCount, s:{lvl:stars}}`; mute in
`locksport-mute`.

## Stars

`starsFor`: 3 = 0 resets AND under par; 2 = ≤2 resets AND under ~2.2× par;
else 1. Never a hard fail — you can reset infinitely, the timer only scores.

## Rendering (realistic cutaway)

Pre-rendered texture canvases built in `makeTextures()` (rebuilt on resize):
aged **wood** workbench (planks, grain quads, knots, speckle), **brass**
plate (brushed scratches, patina blots), **steel** plate (plug interior).
Warm upper-left bench key light (radial) + settling **dust motes**
(`drawDust`, additive). Per chamber: housing bore with edge highlight/shadow,
**zigzag spring** that compresses as the driver rises, steel driver (spool =
capped waist, serrated = ridge lines), brass key pin with a drawn conical
tip. Set pins get a green glow, oversets a red pulse, the binding pin a faint
gold wash. The **plug dial** (`drawDial`) shows a machined brass face with a
rotating keyway slot — the readable rotation tell. Tension wrench is an
L-bar seated in the keyway that twists with `plugAng`; the pick flexes
against a binding pin (`pick.flex`). Open payoff: golden light pours through
the keyway, bolt retracts, "UNLOCKED" glows.

## Audio

Standard stack. `audioInit` builds `sfxGain`/`musicGain` + the shared
`noiseBuf`. SFX: `probe`/`grit` (noise), `click` (set), `clunk` (spool false
set), `serr` (serration tick), `jam`, `sproing` (cascading pin drops on
reset), `creak`, `open` (arpeggio). Music: sparse noir bench loop — a slow 55
Hz sub drone under occasional minor-key triangle plucks (`schedMusic`,
25 ms lookahead). Suspends on `visibilitychange`.

## Test hooks (`scratchpad/drive-locksport.cjs`, 61 checks)

Top-level `lock`, `pick`, `tension`, `tensionHeld`, `game`, `zones`,
`bindingIndex()`, `pinX()`, `advanceBinding()`, `startLevel()`, `update()`,
`genLock()`, `save` are all reachable from `page.evaluate`. Drive a pin by
setting `pick.depth` to its chamber and stepping `update(1/60)`. Set
`insertAnim=0` to skip the level-start wrench animation. **Auto-solver
fairness gate**: a hook-and-ease solver opens all 12 levels with ≤3 resets
inside ~3× par sim time — proves every generated lock (incl. spool/serrated
mixes) is pickable by its own rules. Force a specific pin to bind by
rewriting `lock.order`.

### Trap noted (test was wrong, game was right)

- After `resetLock()` the lock immediately re-binds, so the new binding pin
  sits at rest in state `'binding'` (not `'free'`). An "all pins down" assert
  must accept `free || binding` at lift≈0. Same family as prior "staged state
  keeps evolving" traps.
