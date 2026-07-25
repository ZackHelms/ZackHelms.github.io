# Meteor Defense — Context (`games/meteor-defense/index.html`)

Missile-Command-style tap interceptor. Meteors fall from the top toward a
neon city of six buildings (the lives) along the bottom; the player taps the
sky to launch interceptors from an indestructible central silo. Interceptors
detonate at the tap point into an expanding blast ring; any meteor whose
center enters an active blast dies and spawns a smaller secondary blast, so
kills chain (score = base × chain depth). Ammo is a per-wave budget shown at
the silo. All six buildings destroyed = game over. Single self-contained file.

## Unit space & world

- **Unit space**: fixed world height `WH = 178`; `scale = ch/WH`,
  `WW = cw/scale` (portrait iPhone 13 ≈ 82u wide, landscape ≈ 385u). y grows
  **downward** (0 = top of sky) — no flip, `sx/sy` are just `*scale`.
- `GROUND_Y = WH − max(4, safeAreaBottom/scale + 2)` — safe-area measured via
  a hidden `#safe-probe` div with `padding-bottom:env(safe-area-inset-bottom)`.
- City layout is **fraction-based** (`B_FRACS` = x as fraction of WW,
  `B_HEIGHTS` per style 16–25u, width `clamp(WW*0.085, 6.5, 14)`), recomputed
  by `layoutCity()` on every resize, so portrait/landscape both work and
  building `alive` state survives rotation. Silo at `WW/2`, `SILO_H` 9.

## Core tuning values

| knob | value | note |
|---|---|---|
| `INTERCEPT_SPEED` | 190 u/s | ≥ 3× meteor cap (fairness) |
| `BLAST_R` / `BLAST_R2` | 13 / 8 | primary / secondary max radius |
| `BLAST_GROW` | 60 u/s | ring expansion |
| `BLAST_HOLD` / `BLAST_FADE` | 0.5 / 0.28 s | kills only while grow+hold ("active") |
| `METEOR_BASE_SPEED` | 18 u/s | wave 1 |
| `SPEED_PER_WAVE` | 2.4 | base = min(18 + 2.4(N−1), cap) |
| `METEOR_SPEED_CAP` | 55 u/s | HARD cap, applies after comet ×1.6 and jitter |
| `MAX_ONSCREEN` | 10 | enforced by spawn scheduler (see below) |
| `AMMO_FACTOR`/`AMMO_FLAT` | 1.6 / +2 | ammo = ceil(1.6·threats)+2 |
| `INTERMISSION_T` | 2.5 s | between-wave banner + tally |

## Waves (`makeWavePlan(n)` — single source of truth)

- Parents = `min(6 + 2N, 26)`. Splitter chance from wave 2
  (`0.10+0.02N`, cap 0.32); comet chance from wave 3 (`0.05+0.018N`, cap
  0.26). UFO on every 3rd wave with 1–3 drops **decided in the plan** so the
  ammo formula counts them exactly.
- `threats = parents + 2·splitters + ufoDrops` → `ammo = ceil(1.6·threats)+2`
  (always ≥ 1.5× threats). Types: NORMAL (base 10), SPLITTER (base 10, splits
  into 2 normal children), COMET (1.6× speed, base 30, brighter).
- **Spawn scheduler**: min interval `max(0.45, 1.6−0.05N)` + 0–0.5 s jitter;
  a spawn is **deferred** unless `threatCount() + cost ≤ 10`, where
  `threatCount()` = live meteors + one extra per live splitter (a splitter
  becomes 2 children = net +1) and cost is 2 for a splitter, 1 otherwise.
  UFO drops go through the same gate. This is what makes the ≤10 cap hold
  even across mid-air splits.
- Wave completes when queue, meteors, ufo, and ufoPending are all empty →
  `endWave()`: intermission 2.5 s, bonus = 10·survivingBuildings +
  2·unspentAmmo, tallied in ~12 ticked chunks (`tallyChunk`, tick SFX);
  leftover added at intermission end, then `startWave(n+1)`.
- **Mercy rule** in `endWave()`: every wave `N % 5 === 0` rebuilds one random
  destroyed building (glow + rising hum) — bonus is computed *before* the
  rebuild so it doesn't pay +10 for the freebie.

## Fairness rules (asserted in the headless drive)

1. Ammo ≥ 1.5× total threats every wave (formula gives ≥1.6×).
2. `INTERCEPT_SPEED ≥ 3 × METEOR_SPEED_CAP` (190 vs 165), and geometrically:
   worst-case interceptor flight to any point at ≥30% altitude
   (`√((WW/2)² + GROUND_Y²)/190` ≈ 0.89 s portrait, 1.33 s landscape) beats
   the fastest possible meteor arrival at building height
   (`(GROUND_Y − maxBuildingH)/55` ≈ 2.7 s).
3. On-screen meteors ≤ 10, enforced by the spawn scheduler (splitters reserve
   2 slots up front).
4. Splitter split altitude fixed at 40–60% (`splitFrac = 0.4 + rand·0.2`;
   `splitY = GROUND_Y·(1 − splitFrac)`), so children are always interceptable.

## Chains & scoring

Interceptor blast = chain 1. Each kill: `score += base × chain`, spawns a
secondary blast (maxR 8) at the meteor's position with `chain+1`, shows
"×N!" popup for chain ≥ 2, kill SFX pitch = `280 + 150·min(chain,6)` Hz.
UFO kill (blast touch, radius +3.2 slop) = +50. Meteor on live building →
`destroyBuilding` (crumble particles, shake 0.7, crash+siren). Meteor on
ground/rubble/silo = harmless (scorch mark / spark). Persistence keys:
`meteor-defense-best`, `meteor-defense-best-wave`, `meteor-defense-mute`
(all try/catch).

## Architecture (function inventory)

`resize`/`layoutCity`/`initStars` (layout) · `makeWavePlan`/`startWave`/
`endWave` (waves) · `spawnMeteor(type, baseSpeed, opts)`/`threatCount`/
`splitMeteor`/`spawnUfo`/`addBlast`/`blastActive`/`fireAt`/`destroyBuilding`/
`gameOver` (entities) · `reset`/`startGame`/`updateHud`/`banner`/`addPop`/
`burst` (flow) · `step(dt)` (sim: scheduler → ufo → meteors → interceptors →
blasts+kills → dead-meteor resolution → completion → intermission) ·
`drawBuilding`(6 style variants: antenna/ziggurat/dome/slant/twin/pylon,
hash-lit windows)/`drawSilo`/`drawUfo`/`render` · `frame` (rAF, dt cap 0.1 s,
dpr cap 2). Audio: `audio()` lazy AC + `masterGain←{sfxGain, musicGain}`,
`beep`/`noiseHit` (SFX), UFO warble = persistent LFO-modulated osc
(`startUfoSound`/`stopUfoSound`), music = 16-step ~95 BPM lookahead
sequencer (`startMusic`, setInterval 100 ms scheduling 0.3 s ahead of
`AC.currentTime`; A-minor sawtooth bass, sparse square arps on `barIdx%4`,
noise hats **only while `state==='play' && wavePhase==='active'`** — hats
drop out during intermissions per the mood spec).

## § headless test recipe

Drive lives at scratchpad `meteor-defense/drive.cjs` (playwright-core,
`executablePath:'/opt/pw-browsers/chromium'`, iPhone 13 profile, `file://`).
41 assertions, all green 2026-07-24. Patterns + traps:

- Top-level `let` state (`state`, `meteors`, `blasts`, `buildings`, `ammo`,
  `score`, `wavePhase`, `spawnQueue`…) is readable AND assignable from
  `page.evaluate`. Set `state='paused'` to stop the rAF loop calling
  `step()`, then call `step(1/60)` in a loop for determinism — `step()`
  itself never checks `state`.
- **Wave-completion trap**: an emptied `spawnQueue` + no meteors completes
  the wave on the very next step and rolls into intermission/next wave. To
  hold a frozen wave open, park a fake entry: `spawnQueue=['blocker']` with
  `spawnT=1e9` (blocks both spawning and completion).
- Deterministic meteors: `spawnMeteor(type, 0, {x,y,tx,ty,speed})`, then
  zero `vx/vy` to park one under a growing blast. Chain test geometry: blast
  at (30,60), A at (40,60) (inside 13), B at (46.5,60) (outside primary,
  inside A's secondary radius 8).
- Input test needs `state='play'` (handlers guard on it), so use the
  blocker-queue trick and let rAF run; `page.touchscreen.tap` is enough —
  firing happens on `touchstart`.
- `gameOver` is a top-level function declaration = a mutable global; the
  cap-sweep stubs it (`gameOver=()=>{}`) and revives all buildings each step
  so a 150 s wave-12 sim can't end early; restore it afterwards.
- Audio asserts: launch Chromium with
  `--autoplay-policy=no-user-gesture-required` or `AC.currentTime` stays
  frozen and the sequencer never advances (`stepIdx+barIdx*16 > 0` is the
  "music is running" check). Mute assert: `masterGain.gain.value` 0/1 +
  localStorage `meteor-defense-mute`.
- Smoke gate: `NODE_PATH=<scratchpad>/node_modules node
  .claude/scripts/smoke-mobile.cjs games/meteor-defense/index.html`.

## Gotchas / follow-up ideas

- Meteor velocities are baked at spawn (no homing); a mid-flight orientation
  change rescales the city but in-flight meteors keep their old vector —
  they land as harmless scorches at worst.
- If the UFO is blast-killed before dropping everything, the undropped
  threats are forfeited (player keeps the ammo margin) — completion doesn't
  wait for them; same if it exits the far edge while cap-blocked.
- Blast "active" window = expand + 0.5 s hold; the 0.28 s fade is visual
  only and kills nothing.
- Ideas: score multiplier for no-building-lost waves, smart-bomb pickup
  (full-screen blast), meteor types that weave, daily seed, difficulty
  select that scales `AMMO_FACTOR`.
