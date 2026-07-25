# Ember Depths — game context

`games/ember-depths/index.html` — turn-based torchlit roguelike. Tap-to-move
BFS pathing, bump combat, permadeath, relic builds, procedural floors,
realistic light-map rendering. Single self-contained file.

## Architecture

- **Grid:** 11×16 (`COLS`/`ROWS`), `grid` Uint8Array (0 floor, 1 wall).
  `IDX(x,y)`, 4-dir movement. All logic is **instant** (no animation
  blocking): entity `x,y` are logical, `vx,vy` are cosmetic eased visuals —
  tests drive `playerAct` directly and never wait for tweens.
- **Turn engine:** `playerAct({move|attack|wait})` is the single entry:
  resolves the player action, `turnCount++`, ticks `wardTimer`,
  `enemiesAct()`, `recomputeVision()`, `checkDeath()`. Returns false (no
  turn) for illegal moves. Stepping onto chest/stairs returns early —
  enemies do NOT act on those transitions.
- **Generation** (`genFloor(n)`): drunkard-walk carve (~42% floor —
  connected by construction), stairs = max-BFS-distance cell, chest at
  dist ≥ 4, torches on walls adjacent to floor (≤9), gold/hearts on free
  floor, enemies at dist ≥ 5. Types unlock by depth: slime/bat → archer(2)
  → brute(4, acts odd turns only) → wraith(6, walks through walls).
  Scaling: `hp += floor((n-1)/2)`, `atk += floor((n-1)/3)`, count
  `3 + 0.9n` cap 10.
- **Vision:** `lit`/`seen` Uint8Arrays. Light sources = player
  (r 3.6, lantern 5.2) + torches (r 2.4); Bresenham `losClear` gates both
  visibility and archer shots. Enemies aggro when their tile is lit and
  BFS dist ≤ 8.
- **Pathing:** `tapTile` → `buildPathTo` (BFS backtrack) → `pathQueue`
  consumed at 0.19 s/step in the rAF loop (`pathStep`). Interrupts: newly
  visible enemy, adjacent aggro enemy, blocker on next cell, or taking
  damage. Tapping a lit enemy paths to adjacent then auto-attacks
  (`attackTargetId`).
- **Relics** (`RELICS`, chest offers 2, all-owned → +25 gold): blade +2 atk,
  leech +1 HP/kill, skin −1 dmg (min 1), ward blocks 1 hit/6 turns
  (`wardTimer`), lantern +light, crown +2 maxHP & +2 heal per descend.
  Effects live in `takeRelic` (stat relics) / `hurtPlayer` (skin+ward
  order: skin first, ward consumes the hit) / `killEnemy` (leech) /
  `completeDescend` (crown).
- **Death:** `checkDeath` is state-guarded (idempotent); persists
  `emberDepths.bestDepth`/`bestGold`; overlay 900 ms later.

## Rendering (the realistic-graphics stack)

- Pre-rendered 64px texture tiles (5 floor variants w/ speckle noise,
  flagstone seams, cracks, moss, edge AO; wall top + brick front face when
  the tile below is floor).
- **Light map:** half-res offscreen `darkCv` — base dark fill, opaque black
  over unseen tiles, `destination-out` radial punches per light source with
  per-source flicker (`flick(seed)`), drawn over the scene, then additive
  (`lighter`) warm glows + vignette. Explored-but-unlit stays dimly
  visible (memory).
- Particles: torch/player embers (buoyant, swaying), kill puffs; floating
  damage text; screen shake on player hurt.
- Entities are gradient-shaded canvas draws (glossy slime, flapping bat,
  bone archer, tusked brute, translucent wraith), y-sorted, elliptical
  ground shadows, animated flame (layered radial gradients).

## Audio

Standard stack: lazy `audioInit` (also called by every `bindTap` handler),
shared `noiseBuf` created in `audioInit`, `sfxGain`/`musicGain`, mute key
`ember-depths-mute`, `visibilitychange` suspend. Music: continuous detuned
saw drone through a lowpass + 32-step sequencer (minor triangle plucks, deep
toms, echoing bandpass "drips" — 3 scheduled repeats fake the cavern echo).

## Test hooks / traps

- Top-level lets (`state`, `grid`, `player`, `enemies`, `items`, `relics`,
  `gold`, `floorNum`, `chest`, `stairs`, `pathQueue`…) reachable from
  `page.evaluate`; `genFloor(n)` / `playerAct` / `hurtPlayer` / `takeRelic`
  / `tapTile` callable directly.
- Clear `enemies = []` before movement/pickup assertions — live enemies act
  on every `playerAct` (established trap class).
- Chest/stairs transitions skip the enemy turn — don't assert enemy
  movement across them.
- Drive: `scratchpad/drive-ember.cjs` (34 checks: gen invariants ×30
  floors, combat math, relic effects, path walk, 250-turn fuzz, death
  persistence, mute reload).
