# Neon Pinball — Context (`games/neon-pinball/index.html`)

Portrait pinball table. Two-thumb flippers (left/right screen half), hold-to-charge
plunger, bumpers, slingshots, a 3-target drop bank, 3 rollover lanes, ball save,
end-of-ball bonus with multiplier, and multiball. Single self-contained file.

## Architecture

- **Unit space** 100×170, y down, letterbox-fit to canvas (same pattern as Neon Golf).
- **Table geometry** is data: `SEGS[]` (line segments: walls, top arc from
  `buildArc()`, funnels, sling faces, one-way gate), `BUMPERS[]`, `TARGETS[]`
  (AABBs), `LANES[]` (non-solid sensors). The launch lane is x∈[86,94].
- **Physics** runs at fixed `PHYS_HZ` 240 substeps inside each RAF frame
  (`step` → n×`physSub`). Ball r 2.2, gravity 240, `MAXV` 380 — at 240 Hz a
  max-speed ball moves 1.6 u/substep < ball radius, so no tunneling (verified
  by a 20-direction max-speed sweep in headless testing).
- **Collision core**: `collideSegment(ball, a, b, e, surfVel, radius)` —
  circle-vs-segment with positional correction and restitution against a
  possibly-moving surface. Returns `true` (bounced), `'graze'`, or `false`.
- **Flippers**: capsules (`FLIP_LEN` 15, `FLIP_R` 2) around pivots
  `FL`/`FR`; angle slews toward rest/up at `FLIP_W` 22 rad/s; angular velocity
  `f.w` gives the contact-point surface velocity `ω·(-ry, rx)` so a moving
  flipper genuinely flings the ball.
- **One-way gate** (`kind:'gate'`) across the lane top: collides only when
  `v·n < 0` (ball dropping back toward the lane); launches pass through.
  Minimum launch power (275 u/s) always clears the arc so a ball can never
  stall on top of the gate.
- **Scoring**: `addScore(n)` applies the bonus multiplier `mult`. `bonusUnits`
  accrue (bumper 1, sling 1, lane 5, target 10) and pay `units×100×mult` at
  ball end. `mult` (cap x6) rises on bank clears and lane completions.
- **Multiball**: every 2nd bank clear spawns an auto-launched extra ball
  (max 3 in play). Drains only end the ball when the last one exits;
  `saveT` (6 s after launch) auto-serves a replacement once per launch.
- **Input**: touch identifiers map to `'L'`/`'R'`/`'P'` roles in `touches{}` so
  multi-touch flipping works; `manualServe()` (single resting non-auto ball)
  switches the whole screen to plunger mode. Keyboard: ←/Z, →/M, Space.

## Tuning knobs

Launch `275 + 105·power`; bumper kick min 135; sling kick 150; wall e 0.55,
flipper e 0.35; anti-stuck nudge fires after 2.5 s below speed 3.

## Gotchas

- A resting plunger ball is skipped by physics entirely (`inLane && vy===0 &&
  y>=150`) — don't "fix" that without replacing the rest condition.
- `hitTarget` bounces the ball right with a hardcoded `+30` vx because the
  bank hugs the left wall; if targets move, generalize the bounce.
- `localStorage` key: `neonPinball.best`.
