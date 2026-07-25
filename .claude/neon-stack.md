# Neon Stack — Context (`games/neon-stack/index.html`)

Tap-timing tower stacker (portrait-first, works landscape). A block slides
horizontally one slab above the tower; tap locks it where it is. Overhang
past the block below is sliced off as debris; land inside the perfect window
and the block snaps flush, building a combo that regrows lost width. A drop
with zero overlap topples the run. Single self-contained file; WebAudio SFX
plus a synthwave step-sequencer music loop, no audio files.

## Unit space & core mechanics

- **Unit space**: fixed `UW` 100 wide; `VH = ch/scale` from aspect (~216u on
  iPhone 13 portrait, ~46u landscape). World y grows **upward**; block `i`
  occupies `y ∈ [i·BLOCK_H, (i+1)·BLOCK_H]`, `BLOCK_H` 7. Base block:
  `BASE_W` 56, centered, bottom at y=0; `sy(y) = (camBot + VH − y)·scale`.
- **Slider**: same width as the current top block, bottom edge one slab
  above the tower top, bouncing between `min`/`max`. Speed
  `min(95, 38 + 1.2·placedN)` u/s — **hard cap 95**. Spawn side alternates
  (`spawnSide` flips each spawn; first block enters from the left).
- **Drop resolution** (`dropBlock`), with `dx = slider.x − top.x`:
  - `|dx| ≥ w` → overlap ≤ 0: whole block tumbles as debris, game over.
  - `|dx| ≤ PERFECT_TOL 2.5` → **perfect**: snap to `top.x`, no trim,
    `combo++`, score `+1+3·combo`, pentatonic chime rises with combo
    (`PENT[combo−1]`, clamped). Every 3rd consecutive perfect regrows width
    `+4`, **capped at BASE_W 56** (sparkle + "WIDTH +4" text).
  - else → **trim**: `newW = w − |dx|`, `newX = (slider.x + top.x)/2`; the
    cut piece (width `|dx|`, centered past the kept edge) becomes debris
    (gravity 170 u/s², spin, fade); `combo = 0`, score `+1`, screen shake
    scaled by `|dx|`.
- **Score vs height**: HEIGHT (= `placedN`) is the headline HUD number;
  SCORE folds in perfect bonuses; BEST is best *height*, persisted
  immediately when exceeded. `newBestRun` flag (not `h ≥ best`) drives the
  ★ on the game-over overlay so ties don't claim a new best.
- **Camera**: `camBot` eases (6/s) toward
  `max(CAM0 −10, towerTop − VH·0.45)` — tower top rides ~55% down the
  screen once tall enough. Deep blocks fade: `alpha = max(0.3, 1 −
  depth·0.05)`. Block hue walks `(150 + i·13) % 360`; bg hue drifts with
  height; milestone flash + fanfare every 10 blocks.

## Fairness rules (asserted headlessly, do not break)

- Slide speed never exceeds **95 u/s**; `PERFECT_TOL` is a const — never
  scaled by speed or height.
- Travel half-range each side of `top.x` is `max(w + MISS_PAD 4, 8)`, so
  the swept span always covers the top block **plus ≥8u beyond each edge**
  (a perfect is always reachable) **and** reaches `|dx| ≥ w` (a full miss is
  always physically possible).
- Width never regrows above `BASE_W` 56.

## Architecture (function inventory)

`audio`/`applyGains`/`getNoise`/`beep`/`noiseHit` (audio core: lazy
AudioContext on first gesture, `sfxGain` + `musicGain` → destination) ·
`snd*` (place thunk, trim slice + noise tick, perfect chime, regrow
sparkle, milestone, game-over boom) · `mLead`/`mBass`/`mHat`/
`musicPlayStep`/`musicSchedule`/`startMusic`/`softenMusic` (music) ·
`resize`/`sx`/`sy`/`initStars` (layout) · `reset`/`startGame`/`updateHud`/
`showBanner`/`addText`/`burst`/`gameOver` (flow) · `spawnSlider`/
`dropBlock` (core mechanics) · `step` (slider bounce + camera) ·
`onDown`/`uiTapLogic`/`uiTap`/`muteTap` (input) · `rr`/`drawSlab`/`render`
(draw: stars, grid, ground glow, dashed edge guides, tower, slider, debris,
rings, particles, texts, milestone flash) · `frame` (rAF, dt cap 0.1 s;
decays placeT/settleT/debris/particles/rings/texts even outside `play`).
State: `state` (`title|play|over`), `tower[]`, `slider`, `debrisArr[]`,
`placedN`, `score`, `combo`, `best`, `camBot`, `muted`, `musicTimer`,
`musicStep`, `nextNoteTime` — all top-level `let`, reachable from
`page.evaluate`. localStorage: `neon-stack-best`, `neon-stack-mute`
(try/catch).

## Music (chill synthwave, ~100 BPM)

16th-note lookahead scheduler: `setInterval` 100 ms schedules ≥0.3 s ahead
of `ac.currentTime`; `STEP_DUR` 0.15 s, 32-step (2-bar) loop. Voices →
`musicGain` (0.5): saw lead through a 1400 Hz lowpass playing an A-minor-
pentatonic arpeggio (bar 1 over Am, bar 2 over F), triangle bass (A2 → F2,
two hits/bar), noise-buffer hats on offbeat 8ths + bar-end ghosts. Per-voice
gains 0.03–0.08. Starts on `startGame`; game over softens `musicVol` to
0.16 (loop keeps running); retry restores 0.5. Mute button (top-left DOM,
`stopPropagation`, own 400 ms debounce) zeroes both master gains and
persists; `visibilitychange` suspends/resumes the context (resume skipped
while muted).

## Tuning knobs

`SPEED0`/`SPEED_INC`/`SPEED_CAP` (difficulty ramp), `PERFECT_TOL` (perfect
window), `REGROW` + the `combo % 3` cadence (comeback generosity),
`MISS_PAD` (how far the slider overshoots a full miss), `CAM_ANCHOR_F`
(how much tower stays visible), `BLOCK_H`/`BASE_W` (scale feel),
squash/settle constants `PLACE_SQUASH` 0.14 / `SETTLE` 0.07.

## § headless test recipe

Drive: scratchpad `neon-stack/drive.cjs` (playwright-core,
`executablePath:'/opt/pw-browsers/chromium'`, iPhone 13 profile, `file://`
URL, fonts/net console noise filtered). Pattern: one real
`page.touchscreen.tap` to pass the start overlay (creates AudioContext,
starts the scheduler), then **deterministic drops** inside single
`page.evaluate` calls — set `slider.x = top.x + offset; dropBlock();`
synchronously so the rAF loop can't move the slider between the set and the
drop. Fairness invariants are asserted on the freshly spawned `slider`
before each drop across a 70-placement sweep. Traps hit:

- Launch Chromium with `--autoplay-policy=no-user-gesture-required` or the
  AudioContext may sit suspended in headless runs.
- The mute button double-binds `touchend` + `click` with a 400 ms debounce —
  a test that clicks twice back-to-back sees one toggle; wait >400 ms
  between toggles.
- Headless rAF can lag wall-clock right after load: a screenshot ~250 ms
  after a drop can still show the placement squash mid-animation (block
  drawn wider than the one below). That's the squash, not a width bug —
  assert widths from `tower[]`, never from pixels.
- `dropBlock` reads `slider.x` raw (no clamp to `min`/`max`), which is what
  makes the deterministic full-miss test (`slider.x = top.x + slider.w +
  0.5`) work.

## Gotchas / follow-up ideas

- `slider` is `null` between a game-over miss and the next `spawnSlider` —
  render and `step` both guard on it.
- Timers (`placeT`, `settleT`) decay in `frame`, not `step`, so overlays
  don't freeze mid-squash; `placeT` waits for `settleT` to finish.
- Ideas: daily-seed runs, a "sudden death" mode with PERFECT_TOL 1,
  wind sway above 50 blocks, ghost outline of your best run's top block,
  regrow pickup that floats by like Sky Hopper's comet.
