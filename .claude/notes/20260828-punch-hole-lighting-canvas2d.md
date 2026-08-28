# Punch-hole lighting + keyframed day cycle in Canvas 2D

Reference implementation: `games/fire-clicker/` (`drawLighting()`, `KF[]`,
`skyAt()`). First dynamic-darkness lighting system in the repo; the recipe is
reusable by any game that wants "night falls, light sources carve warm pools".

## The architecture (three layers, one pass)

1. **Paint the whole scene in day colours, always.** No painter branches on
   time of day — lighting is post-processing, so every sprite stays one
   implementation.
2. **A low-res darkness canvas** (`LSCALE` ≈ 1/3 of the viewport — gradients
   blur away the resolution anyway, and the cost of the per-light gradients
   goes with its area). Each frame: fill it with night-blue at
   `ambient()`-alpha, then erase a radial gradient per light source with
   `globalCompositeOperation = 'destination-out'` (fire scaled by
   intensity × flicker, rising motes, lit windows), then `drawImage` it over
   the scene scaled up.
3. **Warm additive tints** (`'lighter'`, orange radial gradients) at the same
   light positions, on the main canvas, after the darkness layer — this is
   what makes the pool read as *firelight* instead of a hole in the dark.

## The three gotchas (each shipped wrong once before it was right)

- **Don't double-darken the sky.** The sky gradient is already palette-dark at
  night (see below), so a full-screen darkness fill blackens it twice and the
  stars die. Ramp the darkness in with a vertical gradient that is alpha-0
  above ~half the horizon and full ambient just below it.
- **A full erase reads as a white daylight circle, not firelight.** Cap the
  punch alpha (≤ 0.85 — snow near the fire stays slightly dimmed even at full
  blaze) and use a steep multi-stop falloff (1 → 0.55 → 0.18 → 0 at radii
  0/0.35/0.7/1) so the mid-pool keeps some dark; then the warm tint supplies
  the orange core. The first version erased fully at 0.55 falloff and the
  night shot looked like a spotlight of noon.
- **Assert it off pixels, over the real backdrop.** The drive check reads
  `getImageData` near the fire vs a far ground corner at night and requires a
  wide margin (measured ~170-240 vs 67). Fill/paint order matters per the
  unpremultiplied-RGB rule in `games/CLAUDE.md` § Reading pixels back.

## The day cycle that drives it

One keyframe table `KF[] = {t, skyTop, skyBot, amb}` over t ∈ [0,1)
(5 real minutes per day), lerped in RGB — the **same table** yields the sky
gradient and the `ambient()` darkness, so they can never disagree. Sun and
moon ride the same arc half a day apart (`(t±0.5)%1`); stars/aurora fade in
off `amb` thresholds; HUD phase names (`DAWN/DAY/DUSK/NIGHT`) are plain t
ranges. Windows join the light list only when a house is occupied at
`amb > 0.18`, which makes occupancy legible at night for free.
