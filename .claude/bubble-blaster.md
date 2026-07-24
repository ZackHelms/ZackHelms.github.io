# Bubble Blaster — Context (`games/bubble-blaster/index.html`)

Classic endless bubble shooter, portrait-first. Drag anywhere to aim (dotted
guide with one wall bounce), release to fire; 3+ same-color pops, detached
clusters fall for double points, the board drops a new ceiling row every 6
shots, game over when any bubble crosses the deadline. Single self-contained
file; all core state is top-level `let` bindings (reachable from
`page.evaluate` for headless tests).

## Unit space + grid math

- **Unit space** 100×186, y down. `R = UW/16 = 6.25` (bubble radius), row
  pitch `ROW_H = R·√3 ≈ 10.83`. Ceiling is y=0; deadline `DEAD_Y = 140`;
  shooter at `(50, 162)`, next-slot at `(78, 168)`.
- **Grid** = array of row objects `{par, cells[]}`. `par 0` → 8 columns flush
  left, `par 1` → 7 columns shifted right by R. Parities always alternate
  (spawn/append/advance all enforce it). Cell → unit:
  `cellX(par,c) = R·(par?2:1) + c·2R`, `cellY(r) = R + r·ROW_H`. Row indices
  shift down when `advanceRow()` unshifts a new row at index 0.
- **Neighbor sets** (`neighborsOf`): same row `c±1`; rows above/below are
  `{c-1, c}` when the row's own `par` is 0, `{c, c+1}` when it is 1.
- Cells hold `null` or a color index into `COLORS[]` — occupancy is
  exclusive, which is what makes overlap impossible by construction.

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `START_ROWS` | 5 | rows dealt at reset / after a board clear |
| `SHOTS_PER_ROW` | 6 | shots between forced row advances (HUD pips) |
| `HIT_D` | `2R·0.88` | flight sticks when this close to a filled cell |
| `FLY_SPEED` | 250 u/s | shot speed (1.8 u substeps) |
| `MIN_ANGLE` | 8° | min aim elevation; flatter/downward = cancel |
| `PTS_POP` / `PTS_FALL` | 10 / 20 | per popped / per fallen bubble |
| `STREAK_CAP` | 5 | multiplier cap; mult = `min(5, streak+1)` |
| `RED_AT` / `CYAN_AT` | 400 / 1000 | 5th and 6th color unlock scores |
| `CLEAR_BONUS` | 250 | flat bonus for emptying the board |

## Architecture (function inventory)

- Grid: `rowLen/cellX/cellY/makeRow/appendEmptyRow/neighborsOf/gridCount/`
  `colorsOnBoard/lowestBubbleY/trimRows` (trailing all-empty rows are trimmed
  after every resolve — `grid.length` shrinks, tests must not assume it).
- Flow: `reset`, `spawnRows`, `newRowCells` (30% copy-left bias so rows have
  runs), `dealColor` (only colors currently on board), `updateHud`,
  `checkUnlocks`, `checkDeadline`, `gameOver` (spills board into `fallers`).
- Shooting: `swapBubbles`, `shoot(dx,dy)`, `hitsGrid`, `stepFly`,
  `findSnapCell`, `land`, `resolveLanding`, `advanceRow`, `floodMatch`,
  `attachedSet`, `traceGuide`.
- Rendering: per-color pre-rendered sprites (`makeSprites`, rebuilt on
  resize; glow + colorblind glyph baked in) so the board loop is
  drawImage-only; effects are `fallers/rings/particles/popups`.

## Key algorithms

- **Snap-to-cell** (`findSnapCell`): append empty rows until the landing row
  +1 exists, then pick the nearest *empty supported* cell — row 0 or adjacent
  to a filled cell (nearest empty anywhere as a never-hit fallback). First
  found wins ties (row asc, col asc) → deterministic.
- **Match**: flood fill same color from the landed cell; ≥3 pops.
- **Drop**: BFS from all filled row-0 cells (`attachedSet`); unreached filled
  cells become gravity `fallers` (GRAV 480, slight upward pop, fade at the
  bottom edge).
- **Guide** (`traceGuide`): marches the exact flight physics in 1.2 u steps,
  reflecting off `x=R`/`x=UW-R`, stopping at ceiling/`hitsGrid`/second
  bounce; also draws a dashed ghost circle on the predicted snap cell.
- **Resolve order** matters: pop → drop → score/streak → `trimRows` →
  deadline check → (board-clear bonus | shot counter → advance) → re-deal any
  queue color no longer on the board → HUD.

## Tuning knobs

- Stick feel: `HIT_D` factor (0.88). Higher = earlier/softer sticks.
- Pressure: `SHOTS_PER_ROW`, `DEAD_Y`, `START_ROWS`.
- Generosity: `newRowCells` run bias (0.3), color unlock thresholds.
- `localStorage` key: `bubbleBlaster.best` (in try/catch — works on file://).

## Headless test recipe

Drive script pattern lives in this session's scratchpad (`bb-drive.cjs`);
general recipe in `.claude/notes/20260724-headless-mobile-game-testing.md`.
Specifics for this game:

- `grid`, `fly`, `cur`, `nxt`, `scoreV`, `streak`, `shotsSinceRow`, `state`
  and all functions above are top-level → visible to `page.evaluate`.
- Deterministic shots: build `grid` rows by hand (`{par:r%2, cells:[...]}`,
  parities must alternate), set `cur`, call `shoot(0,-1)`, poll
  `page.evaluate('fly === null')`. **Playwright trap:** a *string* that looks
  like an arrow function is evaluated as an expression (yields the function,
  never calls it) — pass a real function or a plain expression string.
- A green pair at `(0,3)+(0,4)` with a straight-up green shot snaps to
  `(1,3)` and pops all 3 — the canonical pop test.
- Invariant check after every landing: row lengths match parity, parities
  alternate, pairwise filled-cell distance ≥ 2R, all filled cells reachable
  from row 0.
- Overlay taps: `page.touchscreen.tap` works (touchstart preventDefault
  suppresses synthetic mouse events); drags/swap-taps need hand-built
  `TouchEvent`s dispatched on the canvas.

## Follow-up ideas

- Special bubbles (bomb pops radius 2, rainbow matches anything).
- Aim fine-tune: slow the guide/dampen aim when the finger drags far.
- Combo sfx pitch ramp with streak; persistent stats (games, clears).
- Difficulty ramp: `SHOTS_PER_ROW` shrinks to 5/4 at score milestones.
