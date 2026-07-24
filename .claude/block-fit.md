# Block Fit — Context (`games/block-fit/index.html`)

1010!-style endless drag-and-place puzzle. 9×9 board, tray of 3 pieces dealt
together, no rotation; complete rows/columns clear simultaneously; run ends
when no tray piece fits anywhere. Single self-contained file, all rendering
(board, tray, drag) on the one canvas.

## Unit space / layout

- **Unit space** 100×138, scaled uniformly (`scale`, `ox`, `oy`); `oy` gets a
  0.55 downward bias so the tray sits nearer the thumbs. `px()/py()` map
  units → canvas css px. DPR capped at 2.
- **Board**: `GRID` 9 × `CELL` 10 units at `BX` 5, `BY` 6 (so units 5..95 ×
  6..96). Cell value: `0` empty, else `fam + 1`.
- **Tray**: 3 slots, `slotRect(i)` = 30×30 units at `x = 2.5 + i·32.5`,
  `y = TRAY_Y` 104. Resting pieces render at `TRAY_CELL` 5.2 u/cell.
- **Drag lift**: held piece's *center* floats `LIFT_PX` 90 css px above the
  finger (thumb never hides it), grown to full `CELL` scale over `GRAB_T`
  0.12 s. `ghostPos()` always uses the FULL lift (not the animated one) so
  snapping is deterministic; ghost col/row = `round((center-B)/CELL - w/2)`
  clamped into the board — drops near an edge snap inward.

## Piece set (family → color, deal weight early/late)

| fam | shapes | color | wE→wL |
|---|---|---|---|
| dot | 1×1 | `#dde3ff` | 10→8 |
| line2..line5 | h+v each | green/blue/purple/red | 16→12, 16→13, 10→12, 6→10 |
| sq2 / sq3 | 2×2 / 3×3 | `#ffc300` / `#00e5ff` | 14→12, 4→9 |
| trom | L-tromino ×4 rot | `#ff7a1a` | 14→12 |
| corner | 3×3 L (5 cells) ×4 rot | `#ff4fd8` | 6→11 |

Family weight is split across its orientations (`FAM_SIZE`); early bias fades
linearly over the first `EARLY_DEALS` 6 deals. Shapes are generated in
`buildPieces()` via a 90° `rot()` helper — don't hand-edit cell lists.

## Scoring

- Placement = cells in the piece. Clear = `10 × uniqueCellsCleared × mult`
  (1 line ×1, 2 ×2, 3+ ×3); row/col intersections dedupe via a Map.
- Streak: consecutive clearing placements bump `streak`; from x2 on, bonus
  `+50 × streak` + banner. A non-clearing placement resets it.

## Key algorithms

- `canPlace(p,c,r)` bounds+occupancy; `anyFit(p)` scans all anchors.
- `findLines(extra)` — complete rows/cols of board ∪ optional hypothetical
  cells; used for the real clear (`extra=null`) AND the hover "would clear"
  highlight (ghost cells passed in).
- `deal()` no-dead-deal rule: 3 weighted picks; if none fits, reroll a slot
  up to 6 times, then final fallback force-picks from
  `PIECES.filter(anyFit)`. A genuinely stuck board falls through to
  `checkGameOver()` (runs after every placement; deal happens inside place).
- Clears zero the board **immediately** (logic/tests see post-clear state);
  visuals replay via `clearFx` entries with `delay = i·CLEAR_STAGGER` 0.03 s
  stagger and a `CLEAR_FLASH` 0.32 s white flash + particles.
- Invalid release: `returning[]` eases the piece back to its slot over
  `RETURN_T` 0.18 s; the slot keeps its piece, `held` flag hides it meanwhile.

## Rendering / perf

- Cell sprites pre-rendered per family (+1 empty) in `buildCellCache()` on
  resize — glow, rim, bevel baked in; board render is 81 `drawImage` calls.
- Placement pop (`popCells`, 1.28→1 scale), shake, floats, banner DOM node.
- `localStorage` key: `blockFit.best` (get/set wrapped in try/catch).

## Headless testing

`.claude/scripts/smoke-mobile.cjs` gate plus a gameplay driver (recipe in
`.claude/notes/20260724-headless-mobile-game-testing.md`). Specifics:
top-level `board`/`tray`/`drag`/`score`/`streak` are settable from
`page.evaluate`; build a tray slot as `{ p: PIECE_BY_ID['sq2'], held:false,
born:0 }`. Synthesized touch drags must place the *finger* `LIFT_PX` px BELOW
the intended piece center: end point =
`rect.top + py(BY + (r + p.h/2)·CELL) + LIFT_PX`. To force game over
deterministically use a checkerboard fill (isolated holes → only `dot` fits)
with a dotless tray, then call `checkGameOver()`.

## Gotchas / tuning knobs

- Retry is gated on `overT > 0.6` and overlay taps are debounced 400 ms
  (iOS double-fires touchend+click).
- Difficulty levers: family `wE/wL`, `EARLY_DEALS`, streak bonus (50),
  clear base (10), line multiplier caps.
- Follow-up ideas: hold-slot swap, score-based color themes, combo sound
  ramp, daily-seed mode, subtle board heatmap hinting at risky corners.
