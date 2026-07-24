# Gravity Runner — Context (`games/gravity-runner/index.html`)

One-thumb endless runner: tap to flip gravity between floor and ceiling of a
scrolling neon corridor. Die on red; collect gold orbs; speed ramps forever.
Single self-contained file.

## Architecture

- **Unit space** 100×160, y down; corridor between `CEIL` 14 and `FLOOR` 146;
  player fixed at x 26, world scrolls by `dist` (obstacles store world-x;
  screen-x = `o.x - dist`).
- **Player** is a cube whose `py` tracks the *gravity-contact face* (bottom
  face when `gdir=1`, top face when `gdir=-1`); `flip()` preserves the cube
  center when the face-of-reference changes — keep that when touching it.
- **Flip rule**: only while `grounded` or within `COYOTE` 0.09 s. Flip gives a
  small shove (`pvy = gdir·30`) then gravity 1350 does the rest (~0.44 s
  transit across the corridor).
- **Patterns** (`spawnPattern`) are appended when `nextSpawnX` enters view:
  spike runs (floor/ceiling), gates (62 % pillar — forces the other side),
  center blocks (hug either surface), staggers (spikes both sides with a
  flip window scaled by speed), and orb arcs (pure reward). `lastSafeSide`
  threads which surface stays survivable; min pattern gap is
  `34 + speed·0.30`, always ≥ flip-transit distance at that speed.
- **Hitboxes**: obstacles are kill-zones (player only collides with
  floor/ceiling). Spikes use a forgiving inner 60 % box.
- **Score** = `dist/10 + orbs·25`; speed `52 → 150` at `+1.35/s` (HUD shows
  multiplier vs base). `localStorage` key: `gravityRunner.best`.

## Gotchas

- Difficulty knob `hard = min(1, dist/2400)` widens spike runs and shrinks
  spawn slack — tune there, not in individual patterns.
- Death overlay is delayed 650 ms and retry-guarded by `deathT > 0.7` so a
  frantic flip-tap can't skip the score screen.
