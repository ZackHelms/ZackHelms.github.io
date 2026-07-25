# Alpine Ascent — game context

`games/alpine-ascent/index.html` — charge-jump mountain platformer
(Jump-King-like, mobile-first). Hold to charge, drag sideways to aim,
release to leap; climb one fixed mountain through 6 camps to the summit.
Falls cost altitude, never a life. Single self-contained file.

## Architecture

- **World units:** x 0..100 (`WORLD_W`, maps to screen width), y = altitude
  in meters, **y-up** (`sy()` flips for canvas). Camera `camY` = bottom
  altitude, follows `player.y - 55`.
- **Jump model:** `beginCharge(px)` (grounded only) → `player.charge`
  fills over `CHARGE_TIME` 0.85 s (floor `CHARGE_FLOOR` 0.35);
  `setAim(px)` maps thumb Δx/90 px to aim −1..1; `releaseJump()` launches
  `vy = VY_MAX(51.4)·(0.45+0.55c)`, `vx = VX_MAX(18)·aim·(0.5+0.5c)`.
  Full-charge apex ≈ 22 u. No air control; walls bounce at ×−0.45.
  `previewArc()` integrates the *same* physics (incl. current wind) for
  the dotted trajectory hint.
- **Landing:** platform tops are one-way — land only when `vy<0` crosses
  the top with x-overlap (`landOn`, picks the highest hit). Drop > 28 u
  below `jumpStartY` counts a fall (thud + shake). y<0 clamps to base.
- **Ground types:** grass/rock grip (vx→0); **ice** slides
  (`vx·e^(−0.9dt)`, can slip off edges); **crumble** collapses 0.55 s
  after landing and respawns 4 s later (`crumbleState` Map keyed by
  platform object — reset on `startClimb` since `genMountain` rebuilds
  the objects); **camp/summit** are wide safe ledges.
- **Mountain gen** (`genMountain`, FIXED seed 20260725 → same mountain
  every run, learnable routes): 6 segments × 9 steps + camp ledge, then
  summit (~60+ platforms, ~850 m). Reachability enforced via
  `dxAllow(dy)` envelope table (≤12→26, ≤15→20, ≤18→14) applied to the
  platform *center* from the previous takeoff point; optional side
  branches are never load-bearing. Type mix shifts with altitude
  (grass→rock→ice→crumble).
- **Wind:** `windAt(alt,t)` — zero below 330 m, then `sin(0.55t)·9·ramp`;
  accelerates airborne `vx`, drives snow streaks + HUD `WIND ▶▶`
  indicator + audio bed. Slow 10 s swell keeps it fair; preview arc
  accounts for it.
- **Progress:** `curCamp`, persisted `alpineAscent.camp` (highest ever) +
  `alpineAscent.summit`; menu offers CONTINUE FROM CAMP n. Summit landing
  → `state='win'` overlay (time/jumps/falls).

## Rendering (the realistic-graphics stack)

- **Sky:** altitude-keyed gradient stops (`SKY`) lerped by camera mid
  altitude — valley daylight → colder blue → cloud grey → alpenglow →
  starry indigo. Stars fade in above 620 m; sun sits at fixed world
  altitude (sinks as you climb) with radial glow + 4 slowly-breathing
  god-ray wedges below 560 m.
- **Parallax:** 3 pre-generated ridge heightfields receding at 0.16/0.34/
  0.55 of camera motion, haze-tinted toward the sky color; cloud puffs
  are world objects in the 340–540 band; a screen fog overlay peaks when
  the camera is inside the cloud band.
- **Platforms:** per-type pre-rendered textures (`platTex` cache) — rock
  strata + speckle, glossy ice with specular streaks + icicles
  underneath, cracked crumble, grass tufts; snowcaps above 380 m. Camps
  draw tent + animated campfire; summit a waving flag.
- **Character:** red-jacket mountaineer with beanie, backpack, wind/vel
  trailing scarf; crouch-squash while charging, stretch in flight;
  landing dust/snow puffs.
- Snowflake density scales with altitude and streaks with wind.

## Audio

Standard stack (`alpine-ascent-mute`, lazy `audioInit` from all bindTap
handlers, shared `noiseBuf`, visibilitychange suspend). Continuous
altitude/wind-scaled bandpass wind bed + charge hum oscillator (pitch
tracks charge); airy pad + sparse pentatonic bell sequencer; camp chime,
summit fanfare, land/fall thuds, crumble rumble.

## Test hooks / traps

- All state top-level; `update(dt)` is manually steppable — run whole
  scenarios (setup → N×`update(1/60)` → assert) inside ONE
  `page.evaluate` (the live rAF loop keeps running between evaluates).
- `landOn(p, x)` callable directly to stage checkpoint/summit/crumble
  cases; set `stats.time` to control wind phase (2.85 ≈ full gust).
- Drive: `scratchpad/drive-alpine.cjs` (23 checks: envelope invariant
  over every platform, jump apex bounds, ice/crumble/wind behavior,
  camp+summit persistence, synthetic touch charge-aim-release, 200-jump
  fuzz, mute reload).
