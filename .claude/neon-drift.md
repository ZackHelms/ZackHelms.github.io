# Neon Drift (`games/neon-drift/index.html`)

Top-down drift time-trialer. Hold left/right screen halves to steer
(multi-touch tracked per-identifier; arrow keys on desktop); the car
auto-accelerates. 3 laps per run; best time + a full ghost replay persist
per track. Tracks unlock in sequence. Persist: `neonDrift.best1..3` (ms),
`neonDrift.ghost1..3` (`{t, f:[[x,y,ang]...]}` @30 fps),
`neonDrift.unlocked`, `neonDrift-mute`.

## Track + world model

- `TRACKS[]`: closed Catmull-Rom control-point loops in a ~1000×1400 world
  (minimap hardcodes that scale), `halfW` road half-width (78/68/60).
  `sampleTrack` emits 30 samples/segment → `samples[]` centerline.
- `onTrack(x,y)`: nearest-sample distance ≤ halfW+6. **`nearestIdx` searches
  only ±30 around the last index** — this is both perf and the anti-cut
  mechanism (see below).
- Camera = plain translate centered on car (no rotation — deliberate,
  north-up readability).

## Physics (arcade drift)

`car {x,y,ang,v,vx,vy}` — heading `ang` steers at 2.7 rad/s scaled by
`0.45+0.55·v/VMAX`; velocity *direction* `(vx,vy)` lags heading via grip
lerp (GRIP 6.5 on asphalt, 3.2 on rough) = the drift. VMAX 340, rough caps
to 130 (excess decays at 300/s). No walls or death — the rough is the
penalty. Skid dots spawn when `|cross(heading, velDir)| > 0.22` at speed.

## Lap counting / anti-cut

`prog` accumulates only forward nearest-index deltas in (0, 26). Cutting
across the infield can't teleport the index (window ±30) — while the
window re-syncs it slides in ≥26-sample steps, which are *not* credited,
so a cut simply forfeits the skipped distance (worst case the lap doesn't
count until re-driven). Lap fires at `prog ≥ 0.92·N` with index back
inside [0,12); 3 laps → `finishRace()` (best/ghost/unlock writes).

## Ghost

Recorded every 2nd update (~30 fps, cap 6000 frames), saved only on a new
best. Replay indexes `ghostData[floor(raceT*30)]` — drawn at 0.4 alpha in
blue. Menu shows "GHOST READY" once one exists.

## Audio

House pattern + a **continuous engine oscillator** (sawtooth → lowpass →
`engGain` → `sfxGain`): freq `58 + 150·v/VMAX`, gain gated to 0 outside
count/play states, updated in `frame()`. `noiseBuf` is created in
`audioInit` (music hats and skids share it — creating it lazily in one SFX
left the other silent, caught in review). Music: 122 BPM synthwave saw
bass + offbeat stab + hats. Countdown beeps, lap chime, finish arp.
bindTap calls `audioInit()` — a menu tap may be the first iOS gesture.

## Headless test recipe (`test-neon-drift.cjs` pattern, 22 checks)

- `startRace(0); countT = 0.01; stepGame(0.1)` skips the countdown.
- Lap sim without steering: slide the car along `samples` in 4-sample
  steps calling `update(1/60)` between placements (`lapDrive` helper) —
  progress tracker credits it like real driving.
- **Trap: between evaluates the rAF loop keeps driving the unsteered car**
  (usually onto the rough) — assert relations sampled atomically in one
  evaluate (e.g. engine-freq vs `car.v`), never absolute values across
  two evaluates. Same reason the physics sweep breaks on `state！=='play'`:
  a sweep can cross the finish line mid-run.
- Steering via top-level `steerL/steerR` flags directly, or real
  `touchHold/touchRelease` synthesis for the input-path check.
