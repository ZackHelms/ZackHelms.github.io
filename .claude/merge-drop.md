# Merge Drop — `games/merge-drop/index.html`

Suika/Watermelon-style one-thumb physics merge puzzler. Drag to aim a drop
column, release to drop an orb into the tank; two orbs of the same tier merge
into the next tier on contact. Game over when an orb sits above the red danger
line for `DANGER_TIME` (1.3 s).

## Architecture (single self-contained file)

- **Layout:** DOM HUD bar (SCORE / title / BEST) with `env(safe-area-inset-top)`
  padding for the iPhone notch; the canvas fills the rest of `100dvh`. Overlays
  (`#ov-start`, `#ov-over`) are DOM. State machine: `start | play | over`.
- **Tank geometry:** `jar {x,y,w,h}` computed in `resize()`; everything scales
  off `jar.w` — orb radius is `TIERS[t].f * jar.w` (`tierR`), gravity is
  `jar.w * 5.4`. Mid-game resize (rotation) remaps orb positions into the new
  tank, anchored to the tank floor.
- **Physics:** fixed-substep accumulator (`SUBDT = 1/120`, max 8 steps/frame),
  3 solver iterations per substep. Circle-circle position correction weighted
  by mass (`r²`), impulse with `RESTITUTION = 0.12`, wall/floor clamps, global
  velocity damping. Delta-time capped at 100 ms per repo convention.
- **Merging:** same-tier contact pairs are queued during iteration 0 only and
  resolved after the solve; `dead` flags prevent an orb merging twice in one
  step. Two max-tier orbs annihilate ("NOVA", 500 × chain pts + shake).
  Chain multiplier: merges within `CHAIN_WINDOW` (1 s) multiply points.
- **Tiers:** 11 entries in `TIERS` (radius fraction, neon color, points).
  Droppable tiers 0–4 picked by `DROP_WEIGHTS`. Score for a merge =
  `TIERS[newTier].pts × chain`.
- **Rendering perf:** orbs are pre-rendered once per tier into offscreen
  canvases (`buildOrbCache`, rebuilt on resize) — the per-frame loop is pure
  `drawImage`, no per-orb `shadowBlur`. Particles/floaters are plain rects/text.
- **Danger rule:** an orb with `age > 0.6 s` whose top edge is above `dangerY`
  accumulates `over` time; > 1.3 s → game over. `over` decays when it drops
  back below the line; the line pulses red while any orb is hot.
- **Audio:** tiny WebAudio oscillator helper (`beep`); context created/resumed
  on first touch (iOS requirement). No audio assets.
- **Persistence:** `localStorage["mergeDrop.best"]`.

## Tuning knobs

`TIERS[].f` (sizes), `DROP_WEIGHTS`, `RESTITUTION`, gravity multiplier in
`physStep`, `DANGER_TIME`, `DROP_COOLDOWN`, `CHAIN_WINDOW`.

## Gotchas

- Overlay tap handlers listen to both `touchend` and `click` with a 400 ms
  debounce (`lastStart`) — iOS fires both for one tap.
- Spawn row (`spawnY`) is slightly above the tank; the danger check's
  `age > 0.6` guard is what lets freshly dropped orbs pass through the danger
  band without instantly losing.
