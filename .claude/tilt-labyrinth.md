# Tilt Labyrinth — architecture & context

`games/tilt-labyrinth/index.html` (single self-contained file, ~640 lines).
The classic wooden hole-maze: tip the board, roll a steel ball past the holes
into the brass cup. **The repo's only `tilt` game** — this was the last absent
input in the coverage map.

## Input: tilt, with a fallback that is a first-class citizen

Two control paths write the same `tilt = {x, y}` vector (each −1..1):

- **Motion** (`onOrient`): `deviceorientation` → `gamma/26` and
  `(beta − betaZero)/26`, clamped. **`betaZero` is captured from the first
  event after every `startLevel`**, so whatever pitch you're holding the phone
  at becomes "level" — nobody has to hold their phone flat on a table.
  iOS 13+ needs `DeviceOrientationEvent.requestPermission()` from a user
  gesture, so `enableMotion()` is called from the ROLL button and resolves
  either way; denial silently leaves you in drag mode.
- **Drag** (`pMove`): the finger's offset from where it landed, over
  `DRAG_SENS = 70` px, is the tilt vector. Releasing levels the board — but
  only if no motion events have been seen (`motionSeen`), otherwise a tap
  would flatten a phone that's genuinely tilted.

The HUD shows `◈ TILT` (green) or `◈ DRAG` (blue), and a spirit-level bubble
at the bottom renders the live vector. Whichever path last wrote wins, so
picking up the phone mid-level switches modes seamlessly.

## Physics

Board space is **100 × 140 units**; `R_BALL = 3.1`. `stepPhysics(dt)` runs
**4 substeps**:

- `v += G_ACC * tilt * h` with `G_ACC = 235`, damped `v *= e^(-1.15h)`,
  clamped to `V_MAX = 95` (the tunnelling guard — a 120-shot max-speed sweep
  asserts nothing escapes or ends up inside a wall).
- Walls are AABBs. `circleVsRect` returns the closest-point normal and
  penetration, with a shallowest-side push-out for the degenerate
  centre-inside case. Bounce keeps `REST = 0.36` of the normal velocity.
- Board edges are handled directly, not as wall rects.

### The hole rule (the bit with the skill in it)

```
d < h.r*0.34                     -> falls, any speed
d < h.r*0.72 && speed < 52       -> falls
```
A ball rolling slowly across a rim drops in; a ball moving fast **skims over**
the edge but is still swallowed dead-centre. That's what makes committing to a
fast line a real (and sometimes correct) gamble. The goal cup captures at
`goal.r*0.62`, any speed.

## Boards

`LEVELS[10]`, hand-authored: FIRST ROLL → THE GATE → ZIGZAG → THE FUNNEL →
SWITCHBACK → MINEFIELD → THE COMB → THE VAULT (goal inside a chamber entered
from below) → THE SPIRAL (a real inward spiral) → THE GAUNTLET. Each is
`{name, par, start, goal:{x,y,r}, walls:[{x,y,w,h}], holes:[{x,y,r}]}`.

**Fairness gate:** the drive test BFS-searches ball-centre space on a 0.5-unit
grid, treating "within `R_BALL + 0.35` of a wall" and "within `h.r*0.72 +
0.35` of a hole" as blocked — i.e. the path a *slow, careful* player can take
without ever risking capture. Every board must have one. When authoring a new
board, corridors want ≥ 13 units of clear width (≈ 6 units of centre freedom);
anything tighter passes BFS but plays miserably. Holes belong at corridor
*edges*, not centred in one — a centred hole eats almost the whole lane.

## Scoring & progression

`starsFor`: 3 = under par with **zero falls**; 2 = under 1.7 × par; else 1.
Falls reset the ball to the start (RETRY button) and the clock keeps running —
no lives, no game over. Boards unlock sequentially; a `<select>` in the
top-right replays any unlocked board.

`localStorage['tiltLabyrinth']` = `{u: unlockedCount, t:{lvl:bestSeconds},
s:{lvl:stars}}`; mute in `tilt-labyrinth-mute`.

**`winLevel()` captures everything its deferred overlay needs** (`wIdx`,
`wName`, `wPar`, `wFalls`, `wBest`) at win time and bails if `lvlIdx` moved,
because the overlay fires 1.25 s later and the player can jump boards from the
dropdown in between — reading the globals late crashed on
`save.t[lvlIdx].toFixed()`. Same family as the note's "setTimeout racing a
per-frame loop" trap.

## Rendering

Pre-rendered per-resize texture canvases (`makeTextures`): **oak board**
(diagonal gradient, 340 bezier grain strokes, elliptical knot rings, pore
speckle) and a darker **walnut frame** band. Drawn per frame: frame with a
drop shadow, board surface, inner bevel, holes (radial black with a lit far
rim and a dark near rim), the brass-ringed goal with an additive glow, walls
as raised strips with a top highlight and a shadow **thrown opposite the
tilt**, and the steel ball — radial gradient with a specular hotspot, a soft
contact shadow offset by tilt, and a faint blue bounce light.

The whole board translates `-tilt * 7` px, which sells the tipping far more
cheaply than a real 3D transform. On a fall or a win the ball lerps into the
hole/cup and shrinks (`sinkAt`).

## Audio

`audioInit` builds the masters, the shared `noiseBuf`, **and a looping
band-passed noise "rolling" bed** whose gain and filter frequency track ball
speed every frame — the ball sounds like it's rolling. Knock SFX on wall hits
scale with impact speed; a descending thunk for a hole, a bright triad for the
cup. Music is a slow music-box waltz (sine melody + triangle bass pulse),
25 ms lookahead. Suspends on `visibilitychange`.

## Test hooks (`scratchpad/drive-tilt.cjs`, 50 checks)

`LEVELS`, `ball`, `tilt`, `tiltMode`, `betaZero`, `onOrient`, `stepPhysics`,
`checkHoles`, `startLevel`, `resetBall`, `starsFor`, `update`, `save`,
`R_BALL`, `V_MAX` are all reachable from `page.evaluate`. Drive motion by
calling `onOrient({beta, gamma})` directly; drive drag with synthesized
TouchEvents. Set `ball.x/y/vx/vy` then call `checkHoles()` to test capture
rules deterministically.

### Screenshot caveat

Held tilt keeps **accelerating** the ball for the whole real-time
`waitForTimeout` before a shot, so a staged position drifts far off. Stage
near-level tilt (≈0.1) with zero velocity — the "rAF keeps simulating between
evaluates" trap from `.claude/notes/20260724-headless-mobile-game-testing.md`,
in its most aggressive form yet.
