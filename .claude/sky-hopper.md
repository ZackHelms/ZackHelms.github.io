# Sky Hopper — Context (`games/sky-hopper/index.html`)

Doodle-Jump-style endless vertical bouncer. The hopper auto-bounces off
platform tops (one-way — passes through from below); hold + drag anywhere is
*relative* horizontal steering (finger dx × gain, thumb never covers the
character); the screen wraps horizontally. Camera follows record height
upward only; falling below the camera's bottom edge kills. Single
self-contained file.

## Unit space & physics

- **Unit space**: fixed `UW` 100 wide; height `VH = ch/scale` from canvas
  aspect (~200 on iPhone 13). World y grows **upward** and doubles as meters
  (1u = 1m); `sy(y) = (camBot + VH - y) * scale` flips for screen.
- `GRAV` 260 u/s², `BOUNCE_VY` 158 → **max reach**
  `MAX_REACH = BOUNCE_VY²/(2·GRAV) ≈ 48u`; full bounce cycle ~1.2 s.
- `SPRING_MULT` 2.2 → spring vy 347.6, reach ≈ 2.2²·48 ≈ 232u (a full
  screen+). `FALL_MAX` 240 terminal; landing uses a prevFeet/feet **sweep**
  across platform tops, so no tunneling at any dt (cap 100 ms).
- Steering: drag stores `{finger origin, player.x origin}`;
  `steerX = anchorPx + fingerDx/scale × STEER_GAIN(1.6)`; player chases at
  `clamp(dx·12, ±HMAX 160)` u/s with **wrap-shortest dx**
  (`wrapDx = mod(d+50,100)-50`). Keyboard A/D/arrows move directly.
- Camera: `camBot` eases up toward `player.y - VH·0.52` (never down). Death:
  `player.y + BODY_H < camBot - 4`.

## Generator + reachability guarantee

`ensurePlatforms()` spawns one "rung" per gap while `genY < camBot+VH+60`.
Gap = `MAX_REACH × f × jitter(0.92–1)` where f ramps 0.55 → 0.90 over
2000m — so a rung is **always ≤ 0.90×reach** (≥4.8u apex margin). Every
platform fits fully on screen, so wrap caps horizontal need at 50u;
available steer time from bounce to fall-crossing at max gap ≈ 0.8 s ×
HMAX 160 = 128u ≫ 50. A crumble rung **never follows another crumble
rung** (`lastRungCrumble` forces redistribution), and no crumble below 80m.
Bonus (non-load-bearing) platforms + orbs spawn between rungs below 900m.

Type weights lerp with `t = alt/2000` (clamped):

| altitude | static | moving | crumble |
|---|---|---|---|
| 0m (t=0) | 0.78 | 0.10 | 0.12 |
| 1000m | 0.54 | 0.24 | 0.22 |
| 2000m+ (t=1) | 0.30 | 0.38 | 0.32 |

Width shrinks 18 → 14u; moving amp 8 → ~24u (clamped on-screen), speed
0.8 → ~2.3 rad/s. Springs: 12% of statics, hit zone |dx| < 4.2 of center.

## Architecture (function inventory)

`resize`/`sx`/`sy` (layout) · `initStars` (3 parallax layers, density/drift
scale with 500m band) · `gapAt`/`pickType`/`makePlatform`/`spawnRung`/
`ensurePlatforms` (generator) · `reset`/`score`/`updateHud`/`showBanner`/
`addText`/`die` (flow) · `bounceOn`/`debris`/`burst`/`step` (sim) ·
`onDown/Move/Up`/`uiTap` (input, 400 ms tap debounce) · `rr`/`drawPlat`/
`drawHopper`/`render` (draw) · `frame` (rAF, dt cap 0.1 s). Crumble:
`breakT ≥ 0` counts to `BREAK_DELAY` 0.32 s → `dead` + debris; culled with
platforms below `camBot - 30`. Score = `floor(maxY) + bonus` (orb +50,
comet +250; comets spawn above 400m). `localStorage` key: `skyHopper.best`
(try/catch). Milestones every 500m: banner, `bgHue` eases to
`240 + band·26`, stars denser/faster.

## Tuning knobs

`BOUNCE_VY`/`GRAV` (feel + reach — gaps auto-follow via `MAX_REACH`),
`GAP_MIN_F`/`GAP_MAX_F`/`GAP_RAMP_ALT` (difficulty curve), `STEER_GAIN`
(thumb sensitivity), `HMAX` (chase speed — keep ≥ ~110 or max gaps get
unfair), `SPRING_CHANCE`, `ORB_CHANCE`, `BREAK_DELAY`, `CAM_ANCHOR_F`.

## Headless testing

`.claude/scripts/smoke-mobile.cjs` gates load; the fuller drive
(scratchpad `sky-drive.cjs` pattern) follows
`.claude/notes/20260724-headless-mobile-game-testing.md`: iPhone 13
context, `file://`, font/net console noise filtered. Key tricks:
top-level `let` state (`player`, `platforms`, `steerX`, `state`, `maxY`…)
is reachable from `page.evaluate`; set `state='paused'` (any non-`play`
string) to freeze the rAF sim, then call `step(1/60)` in a loop for
deterministic scenarios (spring/crumble placement via `makePlatform`,
60 sim-second greedy autopilot: steer `steerX` to the highest live
platform below the current apex — reached 3284m). Drags are synthetic
`TouchEvent`s on the canvas; keep finger target speed under
`HMAX/STEER_GAIN` or wrap-shortest steering makes big jumps take the
short way around.

## Gotchas / follow-up ideas

- `steerX` is cleared on touch release — leaving it set makes the hopper
  drift to the stale target forever.
- Moving platforms recompute `x` from `playT`, so pausing `playT` freezes
  them; deterministic tests should place `amp:0` platforms.
- Ideas: jetpack/propeller pickup riff on the spring, breakaway cloud
  platforms above 3000m, enemies (the classic doodle counterpart), daily
  seed run, sfx toggle persisted alongside best.
