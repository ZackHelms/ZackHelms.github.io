# Brick Breaker — Context (`games/brick-breaker/index.html`)

Arkanoid-style: drag anywhere to move the paddle, tap to launch. 8 designed
levels that loop with rising ball speed; brick types and falling power-ups.
Single self-contained file.

## Architecture

- **Unit space** 100×160; brick grid 10 cols (`BW` 9.0 × `BH` 4.4) at
  (`GRIDX` 5, `GRIDY` 20); paddle line `PADY` 147.
- **Levels are ASCII maps** (`LEVELS[]`, 10 chars/row):
  `.` empty · `1` normal · `2` armored (2 hp, shows a crack at 1 hp) ·
  `S` steel (indestructible, excluded from level-clear) · `E` explosive
  (chains 3×3) · `?` guaranteed power-up drop. Add/tweak levels there only.
- **Ball(s)**: `balls[]`, speed re-normalized every frame to
  `min(122, 78 + level·5)` (×0.72 under slow-mo) so effects/levels apply to
  live balls. Movement substeps ≤1.1 u to prevent tunneling. Paddle bounce
  angle from hit offset (max 1.08 rad from vertical) — no speed-up on paddle.
- **Brick collision**: circle-vs-AABB per nearby grid cell, reflecting along
  the lesser-penetration axis; one brick hit per substep.
- **Power-ups** (`drops[]`, caught with the paddle): `W` wide 12 s ·
  `M` multiball (split to cap 6) · `L` twin lasers 8 s · `S` slow-mo 8 s ·
  `P` +1 life (cap 5). Weights in `PU_WEIGHTS`; normal bricks drop 12 %.
- **Flow**: 3 lives; losing the last ball resets power-ups and serves a stuck
  ball; `levelCleared()` (no non-steel bricks) advances and re-serves.
  `localStorage` key: `brickBreaker.best`.

## Gotchas

- The tap-vs-drag discriminator is `moved < 14 px && < 300 ms` in `onUp` —
  don't launch on `onDown` or paddle drags will fire the ball.
- `killBrick` recurses for explosive chains *after* splicing the brick out,
  which is what terminates the recursion. Keep that order.
- Steel bricks give +5 per ding (anti-frustration), and lasers can't break
  them.
