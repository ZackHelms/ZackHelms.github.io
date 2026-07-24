# Neon Crossing — Context (`games/neon-crossing/index.html`)

Crossy-Road-style endless lane hopper, top-down grid. Tap = hop forward;
swipe ≥24 px = hop left/right/back (mouse: click = forward, drag =
directional). The camera auto-scrolls forward and sweeps away laggards;
grass/road/river/rail rows generate procedurally ahead under strict
fairness invariants. Single self-contained file; WebAudio SFX + looping
chiptune (no audio files).

## Unit space & coordinates

- **Lane units**: x is measured in column widths (`u`); the playfield spans
  `u ∈ [0, 9]` (`COLS` 9, column `c` covers `[c, c+1)`, centers at `c+0.5`).
  Rows are integers `r` increasing *forward* (up-screen); `camY` = row
  coordinate at the canvas bottom edge. `ux(u)`/`rowY(r)` map to pixels.
- `TILE = min(cw/9, ch/10)`: portrait → 9 columns flush to the width
  (~18 rows visible on iPhone 13); landscape → tile from height (~10 rows,
  ~20 columns visible). The playfield stays 9 logical columns, centered,
  with glow boundary lines + dimming outside (`X0 > 2` check).
- Traffic runs on a **circular track** of `SPAN = 9 + 2·EXT(14) = 37` tiles
  (`wrapLane`), so lanes cover any screen width and the wrap seam is always
  off-screen. Uniform drift on a closed loop **preserves gaps forever** —
  the car-gap invariant is enforced at generation time only.

## Player & hops

`player = {col,row,px,py,hop,onLog,dir,squashT,blinkT}` — `px/py` are the
render/collision position (fractional while hopping or riding a log).
`HOP_DUR` 0.09 s linear tween with sine arc lift + squash/stretch;
`queuedDir` buffers **at most one** input mid-hop (latest wins). Hops from
a log re-snap: `baseColOf() = clamp(round(px-0.5), 0, 8)`. Blocked hops
(tree / playfield edge / missing row) play `sndBlocked` + `bumpT` wiggle
and do NOT queue. Landing (`endHop`): grass → orb pickup (+5); river →
`logAt` (±0.25 slack) attaches (`onLog`) or `die('splash')`.

## Rows & hazards

`rows: Map<int, row>`; factories `mkGrass/mkRoad/mkRiver/mkRail`.
- **grass** `{trees[], orb, orbGot}` — 0–3 trees, orb on an open tile (30%).
- **road** `{vel, cars[{x,c}]}` — one direction+speed per lane; car length
  `CAR_LEN` 1.35; hit if `|carCenter−px| < CAR_LEN/2 + FROG_HALF(0.32) − 0.05`.
- **river** `{vel, logs[{x,len}]}` — logs 2–3 tiles; standing on one drifts
  `px` by `vel`; carried past the field (`px < −0.1 || > 9.1`) = swept death.
- **rail** `{phase idle→warn→train, t, warnDur, idleDur, trainX, trainDir}` —
  warn flashes the row + lamps + chime (`chimeT` 0.45 repeat), then a
  `TRAIN_SPEED` 22 t/s, `TRAIN_LEN` 16 train sweeps; kills **only** in
  `phase==='train'` and only on that row.
Hazard checks run every frame against `Math.round(player.py)` — so the
nearest row also applies mid-hop. Deaths: `die(cause)` with distinct anims
(car flatten / splash shrink+rings / train flicker+sparks / swept tumble),
overlay after 0.9 s, `deathT > 0.7` gates retry.

## Generator + fairness invariants (asserted headlessly)

Band-based: `pickBand` emits runs (grass 1–2, road 1–3, river 1–2, rail 1),
hazard weights ramp with `r/150`; rows `r ≤ 2` are safe grass. Invariants:
1. **Composition**: ≤3 consecutive non-grass rows (`runNonGrass` caps band
   length); ≤2 consecutive river rows (river bands ≤2 and never adjacent —
   `prevType==='river'` zeroes river weight).
2. **Grass**: ≤3 trees (≥6 open, asserted ≥3) and **no tree wall**: for
   every open column `c` of the previous row, some open `c' ∈ {c−1,c,c+1}`
   exists with (`c'==c` or `c'` open in the previous row) — i.e. reachable
   with at most one lateral hop. Violations fixed by deleting the tree at
   `c` (opening `c` always satisfies the `d=0` case; removals only help).
3. **Road**: clear gap between consecutive cars ≥ `CAR_GAP_MIN` 2.6 tiles —
   `distributeGaps(n, SPAN−n·CAR_LEN, 2.6, 12)` builds exact-sum gap sets on
   the closed loop; speed ≤ `CAR_SPEED_MAX` 4.2 (ramp `1.1+min(r·0.012,1.7)`
   × jitter, clamped).
4. **River**: log front-to-front spacing / speed ≤ `LOG_CADENCE` 3.0 s
   (bounded wait): gaps ∈ [1.2, 4.0] so `spacingMax ≤ 7`, and
   `speed = min(max(rand, spacingMax/3), LOG_SPEED_MAX 2.4)` — 7/3 ≈ 2.33 ≤
   2.4, so the cadence bound is always satisfiable after the cap.
5. **Rail**: `warnDur = 1.25 + rand·0.55` ≥ `WARN_MIN` 1.2 s.

## Camera & pacing

`camSpeed` eases toward `min(0.55 + maxRow·0.0045, 1.35)`; player pushed
below the bottom edge (`py + 1 < camY`) = swept. Forward follow: if
`py − camY > VISROWS·0.62` the camera catches up fast. **Idle pressure**:
no `maxRow` gain for >6 s (`IDLE_LIMIT`) → ×`IDLE_MULT` 2.8 camera, red
vignette pulse + `sndIdle` every 0.9 s. Score = `maxRow`(headline DIST)
`+ 5·orbsGot`; best in `neon-crossing-best` (try/catch).

## Audio

Lazy `AC` on first gesture (`audio()` in canvas down, overlay tap, keys,
mute); `sfxGain`/`musicGain` → destination; mute zeroes both gains,
persists `neon-crossing-mute`, 350 ms debounce, `#mute-btn` is z-60 (above
overlays), click-listener only (a real tap's synthesized click fires once).
`visibilitychange`: hidden → suspend; visible → resume unless muted.
**Music**: 128 BPM, 32-step (2-bar) C-major square-chiptune — C/G/Am/F,
octave-bounce bass, pluck lead, kick/snare/hat from a looped noise buffer;
lookahead scheduler (`setInterval` 100 ms scheduling <0.3 s ahead,
`musicStep`/`nextNoteTime`); starts in `reset()`, `musicGain` 0.5, voices
0.026–0.08.

## Tuning knobs

`SCROLL0/SCROLL_MAX` + `0.0045` ramp (pacing), `IDLE_LIMIT/IDLE_MULT`,
`CAR_GAP_MIN`/`CAR_SPEED_MAX` (road difficulty), `LOG_CADENCE`/
`LOG_SPEED_MAX` + gap range [1.2,4.0] (river), `warnDur`/`idleDur` ranges +
`TRAIN_SPEED` (rail), tree count weights + orb 30% in `mkGrass`, `HOP_DUR`,
hazard band weights in `pickBand` (`r/150` ramp).

## § headless test recipe

Drive: scratchpad `neon-crossing/drive.cjs` (playwright-core,
`executablePath:'/opt/pw-browsers/chromium'`, iPhone 13 + 844×390 contexts,
`file://`). 26 checks: hop exactness, tree block, car/splash/train/sweep
deaths, log carry + re-snap + edge death, train warn/adjacent-row
negatives, idle pressure, 500-row generator sweep of every invariant
above (plus 30 s `updateRow` motion → gaps preserved), real start tap →
`AC`/`musicPlaying`/`musicStep` advancing, mute toggle + reload
persistence, velocity-aware autopilot survives real play, landscape
layout + hop. Traps hit:
- `state='paused'` freezes the rAF sim; call `step(1/60)` manually.
  **`hopInput` gates on `state==='play'`** — deterministic tests call
  `startHop(dir)` directly.
- Manual `step()` loops keep simulating after `die()` (rAF wouldn't);
  break out of step loops when `state==='dead'` or positions keep drifting
  past the death point and confuse assertions.
- Mute has its own 350 ms debounce — successive `page.tap('#mute-btn')`
  calls need ≥400 ms spacing or the second tap is swallowed.
- Headless music assertions need
  `args:['--autoplay-policy=no-user-gesture-required']`; otherwise
  `AC.currentTime` can stay frozen and `musicStep` never advances.
- A naive greedy autopilot hops into lanes where a car *arrives* during the
  hop — road safety must include a `|vel|·horizon` term. That's bot
  smarts, not game unfairness (gaps ≥2.6 are always crossable).
- Crafted test rows are plain objects `rows.set(r, {r,type:'grass',
  trees:[], orb:-1, orbGot:false})`; keep `camY = player.row − 6` and
  `lastProgressT = playT` in sandboxes or sweep/pressure fire mid-test.

## Gotchas / follow-up ideas

- Row objects are mutated in place by `updateRow`; rail SFX are gated on
  visibility + `state==='play'` so off-screen rows stay silent.
- `reset()` is called once at boot then `state='title'` so the field (and
  frog) render behind the start overlay.
- Ideas: coins banked between runs + frog skins, an eagle/hawk sweep
  animation for the idle-pressure kill, daily seed, river lilypads
  (static safe tiles), speed boost pickup, haptics via `navigator.vibrate`.
