# Star Surge (`games/star-surge/index.html`) — architecture notes

Vertical shmup: drag-steer (relative 1.2× finger delta, clamped to lower
65% of screen), constant auto-fire, 5 stages × (3 waves + boss). Bosses
are **checkpoints** (`starSurge.stage` = max stage reached; menu offers
CONTINUE). Score best at `starSurge.best`.

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
- Boss: octagon spinner, hp `26 + stage*14`; aimed 3-burst always, adds
  rings ≤65% hp (denser + faster ≤30%); side-to-side sweep. HP bar top.
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
and bounded arrays. Other top-level state: `state, stage, wave, lives,
weapon, score, ship, bullets, ebullets, enemies, boss, powerups,
spawnQueue, pendingStage, maxStage`, plus `startGame(stage)`,
`spawnEnemy(type,x,y)`, `spawnBoss()`. Steering = TouchEvent drag on `#cv`.
Note: a stress sweep can legitimately advance the persisted checkpoint —
assert against `localStorage['starSurge.stage']`, not a hard-coded stage.
