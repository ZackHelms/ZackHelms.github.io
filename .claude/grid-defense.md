# Grid Defense (`games/grid-defense/index.html`) — architecture notes

Classic build-and-place tower defense on a 9×13 portrait grid. Survive
**20 waves** (win → optional endless); 20 lives (boss leak −3); best wave +
win flag persisted (`gridDefense.best`, `gridDefense.won`).

## Map / path

`WAYPOINTS` (row,col; enters above row 0, exits below row 12) defines one
serpentine road. `buildPath()` derives px polyline `segs` + `totalLen` and
the `pathCells` set (unbuildable). Creeps store only scalar distance `d`;
`posAt(d)` interpolates the polyline (plus a small per-creep perpendicular
`off` so packs don't stack). Rebuilt on resize — creep `d` survives
mid-game rotation because positions are path-relative.

## Towers (`TOWERS`)

PULSE $40 rapid single · NOVA $70 splash (`aoe` radius in cells) · FROST
$60 slow (55% speed for `slowT`s) · RAIL $100 long-range heavy. 3 levels:
+45% dmg, +10% range per level; upgrade cost `base*0.8*lvl`; sell = 70% of
`spent`. All shots are instant-hit with beam visuals (`beams`), classic
**first targeting** (furthest `d` in range).

## Waves (`buildSpawnList`)

Deterministic composition per wave n: runts always; fasts n≥2; brutes n≥4;
swarm packs n≥6; every 5th wave = boss (+ escorts, second boss n≥10). HP
scales ×(1 + (n−1)·0.22). Wave-clear bonus 12+n; intermission 8 s with
**early-call bonus** (2× remaining whole seconds) via the NEXT button.

## Input model

- Build: **drag a card** from the bottom bar onto a cell (ghost shows range
  ring + green/red affordability), drop to build. `onDown` only arms
  `dragCard` when the touch starts on a card; taps elsewhere fall through
  to `onUp` selection logic.
- Manage: tap a placed tower → panel replaces the build bar (UP $x / SELL
  $x buttons, range ring). **Trap fixed in testing:** when the panel is
  shown the build bar isn't drawn but `cardRects` kept stale hitboxes that
  swallowed the panel-button taps (deselecting instead of upgrading) — the
  panel branch must clear `cardRects`.

## Test hooks (headless)

`update(dt)` directly callable (stress sweep: 12 towers, wave-15 horde,
2400×`update(1/60)`, assert finite/bounded). Top-level: `state, money,
lives, wave, waveActive, interT, towers, creeps, spawnList, spawnHpMul,
beams, pathCells, totalLen, cardRects, panelBtns, nextBtnRect, selTower,
endless`, plus `startGame, buildTower, canBuild, spawnCreep, towerAt,
cellCx/cellCy`. Drag-place = touchstart on card center → moves → end on
target cell. Wave-clear/victory forced by emptying `spawnList`+`creeps`
with `waveActive=true` (and `wave=19` for the win path).
