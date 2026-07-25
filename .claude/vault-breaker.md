# Vault Breaker — game context

`games/vault-breaker/index.html` — pinch-rotate safecracking puzzle.
Twist two fingers (or drag one around the dial) through three lock
phases per vault against an alarm timer. Level campaign with stars.
Single self-contained file.

## Architecture

- **Input:** `rotate(delta°)` is the single entry. Two-finger twist:
  delta = change of the angle between the touches (1:1). One-finger
  fallback + mouse: delta = change of the finger's angle around the dial
  center. Per-call delta clamps at 45° (gesture-glitch guard);
  `dialAngle` stays normalized [0,360). `rotVel` is an impulse estimate
  (`0.6·old + 0.4·delta·60`) decayed `e^(−7dt)` in `update` — "steady"
  means `|rotVel| < 26`.
- **Vault gen** (`genVault(n)`, seeded `n*7919+13` → deterministic
  layouts): pins `min(5, 2+⌊n/2⌋)` with alternating required directions
  (CW first) and targets ≥40° apart, `pinTol max(3.5, 7−0.35n)`; rings
  `min(5, 2+⌊(n−1)/3⌋)`, `ringTol max(5, 9−0.4n)`, odd rings **drift**
  (±3+0.5n °/s, cap 12) from level 5; timer
  `(40+9·pins+7·rings)·max(0.6, 1−0.02n)`.
- **Phases** (`phase`): `pins` — marker must sit inside the target
  window, arrived in the pin's required direction (`lastDir`), steady,
  for 0.45 s (`holdT`); Geiger ticks accelerate near the sweet spot.
  `rings` — the active ring's gap rotates with the gesture (plus drift);
  hold it at the top keyway (±ringTol) 0.4 s to lock, inner → outer.
  `handle` — accumulate 270° in one direction (`handCW`/`handCCW`,
  reversal zeroes the other) to open.
- **Win/fail:** `vaultOpen` (state-guarded) → stars by remaining time
  (>50% → 3, >25% → 2, else 1), persists `vaultBreaker.level` (highest+1)
  and `vaultBreaker.stars` JSON (best per vault); door-slide animation
  then overlay. Timer expiry → `triggerAlarm` (state-guarded) → flashing
  alarm → retry overlay. Menu shows a vault-select grid (unlocked only)
  with per-vault stars.

## Rendering (the realistic-graphics stack)

- **Pre-rendered door** (`buildDoor`, rebuilt on resize): brushed-steel
  plate (900 tangential micro-strokes around the dial center), scratches,
  beveled edges, ~60 radial-gradient rivets, corner plates, hinges,
  engraved maker plate.
- **`metalArc()`** — anisotropic metal: ring segments whose lightness
  follows `cos(angle − lightAngle)` (+2nd harmonic), light fixed at
  top-left, so the metal "turns" under a stationary highlight.
- Dial: machined grooves, 72 engraved ticks + numbers (dark cut + 1 px
  light offset), glowing fiducial (bloom scales as you near the target),
  hold-progress arc, LED pin row, bezel screws with slots, slow moving
  glint band (additive). Rings phase: notched steel rings, active rim
  brightens, locked rings get a green LED. Handle: 3-spoke wheel +
  progress arc. Spark bursts on set/lock; micro-shake.
- **Open payoff:** door slides right (smoothstep) revealing a
  radial-gold vault interior — gold-bar pyramid, additive glow, floating
  dust motes.

## Audio

Standard stack (`vault-breaker-mute`, lazy `audioInit` incl. bindTap,
shared `noiseBuf`, visibilitychange suspend). Ratchet ticks paced by
accumulated rotation (`tickRatchet`), Geiger ticks near pin targets
(rate ∝ proximity), heavy pin clunk + ring chunk, phase chime, 3-bolt
door-opening sequence + fanfare, alarm klaxon. Music: low heist pulse
(triangle bass 8ths + hat ticks) that quickens with a warning ping when
the timer drops under 25%.

## Test hooks / traps

- All state top-level; `rotate`/`update(1/60)`/`startVault(n)` drive
  everything deterministically inside one `page.evaluate`.
- **Auto-solver trap (2026-07-25):** when scripting a solve of a CCW
  pin, compute arrival from `pinError()` — deriving it from the raw CW
  distance maps "on target" to −360° and the script laps the dial
  forever (the game was right, the test was wrong).
- Drive: `scratchpad/drive-vault.cjs` (30 checks: gen invariants,
  **auto-solver crackability gate for vaults 1–8 within the alarm
  budget**, direction/steadiness rules, drift, alarm/retry, synthesized
  two-finger pinch + one-finger fallback, vault-select grid, 60
  rotation-storm fuzzes, persistence + mute reload).
