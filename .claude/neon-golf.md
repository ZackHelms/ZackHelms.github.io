# Neon Golf — `games/neon-golf/index.html`

9-hole drag-and-release mini-golf. Pull back from anywhere on screen (relative
aiming — the drag does not need to start on the ball), release to shoot in the
opposite direction. Hazards: walls, bumpers (over-unity bounce), sand (heavy
friction), water (+1 stroke, ball returns to pre-shot spot), boost pads
(directional acceleration), and horizontally oscillating mover walls.

## Architecture (single self-contained file)

- **Unit space:** every hole is authored in a fixed 100×160 unit court
  (y down); `resize()` computes `scale/ox/oy` to letterbox it into the canvas,
  `px()/py()/toUnit()` convert. All physics constants are in units, so the game
  is resolution-independent (iPhone portrait is the design target).
- **Course data:** `HOLES[]` — `{name, par, tee, cup, walls, bumpers, sand,
  water, boosts, movers}`. Rects are `[x,y,w,h]`; boosts add `[ax,ay]` accel;
  movers are `[cx,y,w,h,range,speed]` with `x = cx + sin(simTime*speed)*range
  - w/2` (`moverRect`). Adding a hole = adding a data entry.
- **State machine:** `title | play | sunk | card`. `sunk` covers both a real
  sink (with `sinkAnim` lerp into the cup) and the 8-stroke cap; tap advances
  via `onDown`. Final scorecard is a DOM table overlay.
- **Ball physics:** 3 substeps/frame; exponential friction
  `v *= pow(retain, dt)` with `retain 0.35`/s on court, `0.0004`/s in sand;
  stop below `STOP_SPEED 4`. Circle-vs-AABB (`collideRect`) with
  center-inside-rect fallback along the shortest axis; borders clamp at the
  court edge. `WALL_E 0.82`, `BUMPER_E 1.25` with a 95 u/s minimum kick.
- **Cup:** sink when `dist < CUP_R 3.4` and `speed < SINK_SPEED 85`; faster
  hits "rim out" (partial radial bounce + 0.72 damp).
- **Water:** checked on ball center; splash resets to `preShot` (recorded at
  each shot) with +1 stroke, capped at `MAX_STROKES 8`.
- **Shots:** `shotVector()` — power `= dragLen(units) × 3.2`, clamped to
  `MAX_POWER 250` (≈ full court length + margin); shots under power 18 are
  cancelled taps. Aim line is color-coded green/gold/red by power fraction.
- **HUD:** DOM bar (HOLE / PAR / STROKES / TOTAL-vs-par) + hole-name strip;
  safe-area top padding. Banners (`#banner`) are pointer-events:none DOM.
- **Audio:** WebAudio oscillator `beep` helper; wall ticks gated to impacts
  with normal speed > 12 u/s to avoid substep spam.
- **Persistence:** `localStorage["neonGolf.best"]` = lowest round total.

## Hole design notes

Gaps are ≥ 16 units against a 2.2-unit ball radius. H5/H8 water is crossed via
land causeways (water rects deliberately leave the bridge uncovered) with
aligned boost pads. H6's mover plus its two wall stubs never seals the row —
range 30, width 28, stubs 12 wide.

## Gotchas

- Overlay taps (`uiTap`) and in-game taps debounce/handle iOS's double
  `touchend`+`click` firing.
- `simTime` drives movers, water shimmer, boost chevrons, and cup pulse — it
  advances in every state, so attract visuals keep animating on overlays.
