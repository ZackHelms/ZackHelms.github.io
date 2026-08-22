# Star Surge (`games/star-surge/index.html`) — architecture notes

Vertical shmup: drag-steer (relative 1.2× finger delta, clamped to lower
65% of screen), fires only while the finger/mouse is down (`fireT` only
decrements inside `if (drag)`; `onDown` zeroes `fireT` so the first shot on
a fresh press is instant). A **sector** is `MAX_STAGE` (5) stages, each with
its own mini-boss, capped by one extra, harder/longer **sector boss**.
`MAX_SECTOR` is currently `1` — raising it to the requested 11 (increasing
difficulty per sector) is explicitly deferred until the XP/weapon/armor
progression system exists to give the player matching power growth;
shipping harder sectors first would make them unbeatable with only the
current fixed weapon-tier ceiling. Both the mini-boss and the sector boss
are **checkpoints**: `starSurge.stage` = max stage reached this sector,
`starSurge.sectorBossReady` = the stage-`MAX_STAGE` mini-boss has fallen
(menu/end-screen CONTINUE then jumps straight to the sector boss via
`startGame(stage, atSectorBoss)`, skipping a replay of stages 1‑`MAX_STAGE`).
Score best at `starSurge.best`.

## Sector boss vs. mini-boss

`boss.sector` (`true`/`false`) is the single flag threaded through combat,
HUD, and music to distinguish them — there is no separate state variable.
- **Mini-boss** (`spawnBoss()`): unchanged difficulty, hp `26 + stage*14`.
- **Sector boss** (`spawnSectorBoss()`): hp `(26 + MAX_STAGE*14) * 2.6` —
  2.6× the toughest mini-boss, both harder *and* longer by construction.
  Also fires a wider aimed spread (`arms=2` vs `1`), faster fire/ring
  cadence, a 20-bullet finale ring under 15% hp, drifts faster, and renders
  as a 14-spike shape with an inner ring (mini-boss: 8-spike, no ring).
- `bossDown()` branches on `boss.sector` first: sector-boss-down either
  ends the run in victory (`sector >= MAX_SECTOR`) or advances
  `sector++/stage=1`; mini-boss-down at `stage < MAX_STAGE` advances the
  stage as before, at `stage === MAX_STAGE` it sets `pendingSectorBoss`
  instead of ending the run. The wave director (`update`) checks
  `pendingSectorBoss` before `pendingStage` so the sector boss starts once
  the "STAGE `MAX_STAGE` CLEAR" banner fades — same fixed-pre-test pattern
  as `pendingStage`, don't reintroduce a `setTimeout` here either.

## Music

20 hand-composed **webaudio-score/v1** tracks (see zmhstudio's `zmh-synth`
score-authoring skill) drive an adaptive soundtrack: `MUSIC_TRACKS[]` holds
the score data, a pure `compileScore()` turns each into a flat time-sorted
note-event list, and a two-slot crossfading look-ahead scheduler
(`scheduleMusic`, 25 ms tick, ~0.35 s horizon) plays them through ~20
synthesized instrument recipes (`playKick`/`playAcidBass`/`playWobbleBass`/
etc. — percussion is a shared seeded-noise buffer sliced through per-voice
filter chains, melodic voices are live oscillator+filter+ADSR). `NN ·
TITLE` now-playing label lives in `#track-label` (a persistent DOM element,
not canvas-drawn, so it survives under the menu/end-screen overlay too).

`selectTrackId()` is a **pure function of game state** — no randomness —
and one track plays for a **whole stage** (every wave *and* that stage's
own mini-boss), not per-wave: `STAGE_BGM_IDS` (14: 4 calm/patrol + 10
combat) is indexed by `(sector-1)*MAX_STAGE + (stage-1)`, round-robining
continuously across sectors rather than resetting each one, so a longer
campaign keeps surfacing different tracks. Only `boss.sector` (the sector
boss, not the mini-boss) switches to `SECTOR_BOSS_TRACK_IDS` (5, dubstep/
hard-techno), indexed by `sector-1` — also round-robin, not reset.
Non-`'play'` state → the ambient menu track. Earlier versions switched
per-wave (calm on wave 1, combat on waves 2–3) and separately per-mini-boss;
both were replaced 2026-08-22 because a full stage is long enough to
actually judge a track by, per direct feedback that per-wave switching
cycled too fast. This is also *not* enemies-on-screen-driven — see the
code comment history: that heuristic thrashed the crossfade every time
`spawnQueue` briefly drained between bursts. Stage-boundary switching
instead lines the 1 s crossfade up with the existing `stageBanner` display,
so the handoff reads as intentional. Sub-track sequences reference bar-pattern names;
percussion patterns are `x`/`X`/`.` per step, melodic patterns are
space-separated note/`+`chord/`-`tie/`.`rest tokens — see the skill doc for
the full grammar before hand-editing a track's `patterns`/`sequence`.

To refine a track (change its genre/key/instrumentation) don't hand-edit
raw pattern strings — use `.claude/scripts/star-surge-music/` (procedural
drum-grid + scale-walk generator, seeded, validated against the same
`compileScore` before output; see that folder's README) and re-embed the
regenerated track's JSON.

## Wave director

- `buildWave(stage, wave)` returns a deterministic spawn script
  `[{t, type, xf}]` (counts scale with stage; xf = x as width fraction).
  `update` drains it against `waveT`.
- Director rule: when no boss, queue empty, enemies cleared, and no banner
  showing → advance (`wave++`, wave 4 = `spawnBoss()`).
- **Trap fixed pre-test:** after `bossDown()` the next stage must start via
  the `pendingStage` flag (director resets `wave = 1` once the STAGE CLEAR
  banner fades). The earlier setTimeout version raced the director —
  double-spawned or skipped wave 1.

## Entities

- Enemies (`ENEMY_DEFS` hp/r/pts): **drone** (sine drift, ram only),
  **shooter** (descends to a hold-Y, aimed shots), **spinner** (crosses
  horizontally, rotating 4-way ring), **tanker** (slow, 6 hp, always drops
  a powerup). Enemy color = `STAGE_HUES[stage-1]` (green→blue→purple→gold→red).
- Mini-boss: octagon spinner, hp `26 + stage*14`; aimed 3-burst always, adds
  rings ≤65% hp (denser + faster ≤30%); side-to-side sweep. HP bar top.
  Sector boss is the same state machine with `boss.sector=true` scaling
  every number up — see § Sector boss vs. mini-boss above.
- Powerups (11% drop, tanker 100%): **P** weapon tier +1 (max 4:
  single → twin → triple spread → triple fast; ship hit drops a tier),
  **S** one-hit shield, **G** SURGE (clears all enemy bullets, 3 dmg to all
  enemies, 4 to boss).
- `EBULLET_CAP` 90 bounds the bullet storm (readability + perf); `eShoot`
  and ring spawns respect it.

## Player

3 lives; hit → weapon-tier loss, respawn center-bottom with 2 s invuln
(blink). Ram kills the enemy too. `hitShip` early-outs mid-iteration when
the run ends (`state` check after each collision loop matters).

## Test hooks (headless)

`update(dt)` is directly callable — the stress sweep drives 3000×
`update(1/60)` with a spawned army + low boss and asserts finite positions
and bounded arrays. Other top-level state: `state, sector, stage, wave,
lives, weapon, score, ship, bullets, ebullets, enemies, boss, powerups,
spawnQueue, pendingStage, pendingSectorBoss, maxStage, sectorBossReady`,
plus `startGame(stage, atSectorBoss)`, `spawnEnemy(type,x,y)`,
`spawnBoss()`, `spawnSectorBoss()`. Steering = TouchEvent drag on `#cv`.
Note: a stress sweep can legitimately advance the persisted checkpoint —
assert against `localStorage['starSurge.stage']` /
`localStorage['starSurge.sectorBossReady']`, not a hard-coded stage.
