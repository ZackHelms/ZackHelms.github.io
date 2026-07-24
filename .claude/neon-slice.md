# Neon Slice — Context (`games/neon-slice/index.html`)

Fruit-Ninja-style endless swipe slicer. Neon gems launch from the bottom edge
in gravity arcs; swipe fast to slice them, chain combos inside one swipe,
don't slice the red bombs, don't let gems drop. 3 lives. Single
self-contained file, ~730 lines.

## Unit space + constants

- **Unit space** 100×200 (portrait), letterboxed like the other games
  (`scale = min` fit, `px()/py()` map to canvas CSS px). Gravity `G` 130 u/s².
- **Launch**: `x0 ∈ [15,85]`, `vy = -√(2·G·rise)` with `rise = UH·(0.62..0.92)`
  so apexes land 8–38% from the top; `vx` biased toward center. Gems reflect
  off the side walls so nothing drifts out of reach.
- **Volleys**: gap `max(1.25, 2.6 − playT·0.012)` s; count `lo..hi` where
  `hi = min(4, 2 + ⌊playT/40⌋)`, `lo = 2` after 50 s; items stagger 0.11–0.16 s
  apart via the `pending[]` delay queue.
- **FRENZY**: after 20 s, 10% chance per volley (12 s cooldown): 6–8 gems,
  purple banner, at most 1 bomb.
- **Bombs**: per-item chance `min(1/6, 0.03 + playT·0.0016)`, zero before 8 s
  (`BOMB_GRACE`); per-volley cap `⌊n/2⌋` — never more bombs than gems, and a
  1-item volley is never a bomb. Slicing one: −1 life, white flash
  (`FLASH_TIME` 0.5), hit-stop freeze (`FREEZE_TIME` 0.4, world pauses, combo
  voided). Bombs that fall off the bottom are harmless.
- **Gold**: 1-in-12 gems, radius 6 vs 5, ×5 points, bigger burst.
- **Blade**: slices only when segment speed ≥ `BLADE_MIN_SPEED` 90 u/s (a
  resting finger never slices); trail samples live `TRAIL_LIFE` 0.16 s.
- **Combo**: `COMBO_WINDOW` 0.3 s between slices (ticks in *scaled* time, so
  slow-mo stretches it); banked on window expiry or finger lift: bonus
  `comboN²·10`, banner `COMBO xN +bonus`. Slow-mo at combo ≥4
  (`timeScale` 0.35 for 0.4 s, refreshed per slice).
- **Scoring**: gem = `10 + 2·⌊playT/60⌋`, gold ×5, combo bonus on top.
- `localStorage` key: `neonSlice.best` (read/write in try/catch).

## Architecture

- **State machine** `state`: title | play | over, all core state in top-level
  `let`s (`gems`, `pending`, `pieces`, `particles`, `popups`, `trail`,
  `scoreV`, `comboN`, `lives`, ...) so headless tests can reach them.
- **Function inventory**: flow `reset / updateHud / showBanner / loseLife /
  gameOver`; spawning `makeGem / launchItem / bombChance / launchVolley`;
  slicing `segCircleHit / sliceSegment / sliceGem / bombHit / missGem /
  finalizeCombo`; fx `spawnPieces / burst / addPopup / updateFx`; sim `step`;
  input `bladeDown / bladeMove / bladeUp / uiTap`; render `drawGemPath /
  drawGem / drawPiece / drawTrail / render`; loop `frame`.
- **Slicing is event-driven**: `bladeMove` converts the touch/mouse point to
  unit space, pushes a trail sample, and if `dist/dt ≥ 90 u/s` runs
  `sliceSegment(prev→cur)` immediately — segment-vs-circle
  (closest-point-on-segment, `d² ≤ r²`) against every gem. No per-frame
  re-testing; a bomb hit `break`s the loop (one bomb ends the swipe).
- **Halves**: each sliced gem spawns 2 `pieces` whose local frame is rotated
  to the blade angle; rendering clips a half-plane rect (small gap) and draws
  the same gem path, so the cut edge always matches the swipe direction.
- **Timing layers in `frame()`**: real `dt` (capped 0.1 s) drives `simTime`,
  slow-mo/freeze/flash/shake decay and the blade; scaled `dts` drives
  `step()` + `updateFx()`. Bomb freeze skips both (full hit-stop);
  `state==='over'` keeps fx running under the overlay.
- Entity arrays use swap-remove (`arr[i]=arr[last]; arr.pop()`), backwards
  iteration — no per-frame allocation beyond trail/particle pushes.

## Tuning knobs

All in the `// ---------- constants` block: pacing (`VOLLEY_GAP*`), ramp
(`BOMB_CHANCE*`, volley `hi/lo` in `launchVolley`), feel (`BLADE_MIN_SPEED`,
`COMBO_WINDOW`, `SLOWMO_*`, `FREEZE_TIME`), economy (`BASE_PTS`,
`MINUTE_BONUS`, `GOLD_MULT`, combo formula in `finalizeCombo`).

## Headless testing

Drive script pattern (see `.claude/notes/20260724-headless-mobile-game-testing.md`):
iPhone 13 context, `file://` load, wait >400 ms before tapping the start
overlay. Deterministic slices: in ONE `page.evaluate`, set
`volleyTimer=9999; pending.length=0; gems.length=0;`, push
`makeGem({x,y,vx:0,vy:0,...})`, then dispatch synthesized
`TouchEvent`s through it (same-tick dispatch → huge blade speed via the 4 ms
`dt` floor). **Gotcha:** `touchend` banks/resets the combo synchronously —
assert open-combo state *before* lifting the finger. Slow-creep test (2 px
per 40 ms) verifies the no-slice threshold. Drops: push a gem below `UH`
with `vy>0` and wait a frame.

## Follow-up ideas

- Power-up gems: freeze-time (blue clock), 2× score window, screen-clear.
- Wave/stage structure with short breathers instead of a pure ramp.
- Blade skins / trail colors as a best-score reward.
- Multi-touch: second finger as an independent blade.
