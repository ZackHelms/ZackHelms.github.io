# Neon Snake Arena — Context (`games/snake-arena/index.html`)

Smooth (non-grid) snake in a walled arena. Hold + drag anywhere = virtual
joystick steering. Eat orbs to grow, chain combos, grab timed gold orbs,
avoid mines/walls/yourself. Single self-contained file.

## Architecture

- **Unit space** 100×150. Head `{x, y, ang}` moves at
  `min(54, 30 + playT·0.28)` and slews toward `targetAng` at `TURN` 4.6 rad/s
  (`angleTo` handles wrap).
- **Body** = breadcrumb path: `pts[]` (newest first) sampled every
  `PATH_SPACING` 0.7 u of travel; segment i sits at `pts[(i+1)·2]`
  (`SEG_SPACING` 1.4). Growth just raises `segs` (cap 220); the path array is
  trimmed to `segs·2+8`.
- **Steering input**: `joy` stores touch origin + current point (screen px);
  beyond a 12 px deadzone `targetAng = atan2(drag vector)`. Keyboard:
  arrows/A/D nudge `targetAng` relative to heading.
- **Death**: wall (head radius vs arena rect), self (head vs body segments
  from index 8 outward, radii scaled ×0.55 for fairness), or active mine.
- **Orbs**: always `ORB_COUNT` 3 on field; every 5th spawn is gold
  (worth 50 vs 10, expires in 7 s, blinks its last 2 s). Combo `comboN`
  (cap x9) increments per eat inside a 4 s window and multiplies orb points;
  a purple ring around the head shows the window draining.
- **Mines**: from 10 s in, one every 9 s (cap 9): 1.3 s shrinking-ring
  telegraph (harmless), ~25 s active, 1 s fade-out (harmless again).
- `localStorage` key: `snakeArena.best`.

## Gotchas

- Self-collision starts at segment 8 — lowering that makes ordinary tight
  turns lethal.
- Spawners retry up to 40 times to avoid the head/mines; they intentionally
  fall through with a plain random spot rather than infinite-looping on a
  crowded field.
