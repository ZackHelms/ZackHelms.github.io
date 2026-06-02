# Sorcery — Game Context

**File:** `games/sorcery.html` (single self-contained file, ~1200 lines)
**Stack:** Inline CSS + JS, Canvas 2D, no external libs, `requestAnimationFrame` loop.

---

## Architecture Overview

### Canvas & Layout

Logical canvas: 600 × 700 px (`CW`/`CH`). Canvas element uses
`position:absolute; top:0; left:0; width:100%; height:100%` inside a
`position:relative` container — this overrides the intrinsic pixel size so the
canvas always fills its container. `ResizeObserver` syncs CSS size on orientation
change. `pos()` in the input handler maps client coords to canvas coords via
`getBoundingClientRect()` ratio.

**Portrait:** column flex — HUD (top) → `#canvas-wrap` (flex:1) → spell bar (bottom).
**Landscape:** row flex — 120 px HUD panel (left) → `#canvas-wrap` (flex:1) → 120 px spell bar (right).

`BASE_Y = CH - 90` — y-coordinate of the base rectangle (kept high enough that
enemies near the bottom are still tappable).

### Game Loop

`loop(ts)` → `tick(dt)` + `draw()` via `requestAnimationFrame`.
`dt` = min of real delta and 100 ms (avoids spiral of death on tab-switch resume).
While `G.paused` is true, `tick` is skipped but `draw` still runs.

---

## Game State (`G` object)

Created fresh in `startGame()`, global `let G`. Key fields:

```
G.wave, G.waveKilled, G.waveTarget   — wave progress
G.spawnTimer, G.spawnInterval        — enemy spawn timing
G.baseHp                             — current base HP (max: BASE_MAX_HP = 500)
G.level, G.xp, G.xpNext             — player level/XP
G.gold, G.totalKills

G.raySpells  {}  id → live spell object (ray type)
G.wallSpells {}  id → live spell object (wall type)
G.ray             currently equipped ray spell (ref into raySpells)
G.wall            currently equipped wall spell (ref into wallSpells)

G.upgTaken   {}  "[upgId]_[spellId]" → stack count (for display; not used to limit)
G.enemySeen  {}  [enemyId] → { count, firstWave }
G.enemySeenOrder []  enemy ids, newest first (unshift on first encounter)

G._pd            pause depth counter
G.paused         true when _pd > 0
G.manualPaused, G.levelingUp, G.pickerOpen   reason flags

G.enemies[], G.projectiles[], G.walls[], G.particles[], G.floats[]
G.holdStart, G.holdX, G.holdY       hold-to-cast state
```

---

## Pause System

Multiple sources can pause simultaneously via a depth counter — never set
`G.paused` directly.

```js
pushPause()   // G._pd++; G.paused = true
popPause()    // G._pd--; clears G.paused only when reaching 0
```

Sources and their paired flags:
| Source | Flag | Overlay |
|--------|------|---------|
| Manual (pause btn) | `G.manualPaused` | `#pause-overlay` |
| Level-up | `G.levelingUp` | `#lu-overlay` |
| Spell picker | `G.pickerOpen` | `#sp-overlay` |
| Debug screen | `_dbgOpen` (module var) | `#dbg-overlay` |

`visibilitychange` + `window.blur` auto-pause via the manual-pause path.

---

## Spell System

**Defs** — immutable base objects in `RAY_DEFS` / `WALL_DEFS`.
**Instances** — `cloneDef(def, extra)` shallow-copies a def onto a new object.
Upgrades mutate instance fields in-place. Switching back to a spell retains all
its upgrades because instances persist in `G.raySpells` / `G.wallSpells`.

Ray spells are cloned with `{ _split: 1 }`.

### RAY_DEFS

| id | speed | dmg | aoe | dot | dotDur | instant |
|----|-------|-----|-----|-----|--------|---------|
| `magic_missile` | 900 | 25 | 0 | 0 | 0 | false |
| `fireball` | 420 | 15 | 55 | 3 | 5 | false |
| `laserbeam` | Infinity | 12 | 0 | 2 | 5 | true |

`instant:true` spells skip projectile creation and call `fireLaser()` directly.
AOE spells call `explode()` on projectile impact.

### WALL_DEFS

| id | baseHp | duration | slow | dotDmg | blocks |
|----|--------|----------|------|--------|--------|
| `force_field` | 100 | Infinity | 0 | 0 | true |
| `fire_wall` | Infinity | 20 | 0 | 5 | false |
| `slow_wall` | Infinity | 20 | 0.8 | 0 | false |

`blocks:true` — enemies stop and attack the wall instead of moving.
Fire wall: 333 ms tick via `w.dotTick[e.id]` (undefined → 0 for immediate first hit,
resets to 0.333). Also applies/refreshes a 5 s burning DOT each tick.

---

## Upgrade System

All upgrades are **multiplicative**. No stack limit (removed from `collectUpgrades`).

| id | name | targetType | effect |
|----|------|-----------|--------|
| `split` | SPLIT | ray | `s._split = round(s._split * 1.5)`, min 2 |
| `speed` | SPEED | ray | `s.speed *= 1.33` (skipped for Infinity-speed spells) |
| `damage` | POWER | ray | `s.dmg = round(s.dmg * 1.2)` |
| `dot` | IGNITE | ray | `s.dot = round(s.dot * 1.66)`, or starts at 2 |
| `wall_hp` | REINFORCE | wall | `s.baseHp = round(s.baseHp * 1.5)` (skipped for Infinity-hp) |

`collectUpgrades(spellObj, type, cat, out)` — pushes eligible options.
`avail(s)` on an entry gates availability (e.g. speed skips laser beam).
Stacks are tracked in `G.upgTaken` for the debug display only.

---

## Enemy System

`ENEMY_TYPES` — base stat array. Stats scaled on spawn: `diffScale(wave) = 1 + wave * 0.14`.

| id | col | r | hp | spd | range | dmg | rate | xp | wave | boss |
|----|-----|---|----|-----|-------|-----|------|----|------|------|
| `imp` | #ff4455 | 11 | 30 | 60 | 40 | 8 | 1.5 | 1 | 0 | |
| `orc` | #77cc44 | 15 | 80 | 40 | 45 | 18 | 1.0 | 2 | 3 | |
| `troll` | #559933 | 20 | 200 | 28 | 50 | 30 | 0.7 | 5 | 6 | |
| `ghost` | #aabbff | 13 | 50 | 75 | 45 | 12 | 2.0 | 3 | 4 | |
| `golem` | #cc8833 | 28 | 600 | 22 | 55 | 50 | 0.5 | 20 | 10 | ✓ |

Enemy fx: `e.fx.burning = {dps, dur, tick}` — tick counts down per frame, fires every 1 s.
`e.fx.slowed = {fac, dur}` — speed multiplied by `(1 - fac)` while active.

Enemies are first tracked in `spawnEnemy()`:
```js
if (!G.enemySeen[def.id]) {
  G.enemySeen[def.id] = { count: 0, firstWave: G.wave };
  G.enemySeenOrder.unshift(def.id);   // newest at top
}
G.enemySeen[def.id].count++;
```

---

## Level-Up Flow

`checkLevelUp()` → `showLevelUp()` → `buildOptions()` → 3 shuffled cards.
Cards are blocked (pointer-events off, dimmed) for 1 s via `.blocked` CSS class.
Option sources tried in order: `pickNewSpell()`, `pickEquippedUpgrade()`, `pickAnyUpgrade()`.

---

## CSS Variables

```css
--bg: #06060e    --panel: #0b0b16    --border: #1a1a30
--green: #39ff14  --gold: #ffc300    --blue: #4488ff
--red: #ff2244   --white: #dde3ff   --dim: #8899bb   --purple: #b44fff
```

Fonts: `'Black Ops One'` (headings), `'Share Tech Mono'` (body/mono).

---

## Semantic Index — Line Numbers (as of latest commit)

> Line numbers drift with edits. Use `grep -n` to reconfirm before surgical edits.
> Stable identifiers (function names, CSS selectors) are more reliable than line numbers.

### CSS / HTML sections (~line range)

| Element | ~Line |
|---------|-------|
| `:root` vars | 9 |
| `#hud` styles | 23 |
| `#canvas-wrap` + `canvas` | 53 |
| `#spell-bar` / `.spell-slot` | 65 |
| `@media (orientation:landscape)` | 93 |
| `#sp-overlay` (spell picker) | 126 |
| `#lu-overlay` (level up) | 164 |
| `#pause-overlay` | 200 |
| `#dbg-overlay` + debug styles | 221 |
| `#dbg-btn` | 260 |
| `#gameover` | 270 |
| `<div id="hud">` | 285 |
| `<div id="canvas-wrap">` | 305 |
| `<div id="spell-bar">` | 307 |
| `<!-- Spell Picker -->` | 320 |
| `<!-- Level Up -->` | 329 |
| `<!-- Pause -->` | 335 |
| `<!-- Debug -->` | 342 |
| `<!-- Game Over -->` | 349 |

### JS sections

| Symbol | ~Line |
|--------|-------|
| `CW`, `CH`, `BASE_Y`, `BASE_MAX_HP` | 369–377 |
| `xpNeeded`, `diffScale`, `baseColor` | 378–388 |
| `RAY_DEFS` | 390 |
| `WALL_DEFS` | 405 |
| `UPGRADE_DEFS` | 420 |
| `ENEMY_TYPES` | 441 |
| `let G` | 450 |
| `startGame()` | 452 |
| `cloneDef()` | 488 |
| `pushPause()` / `popPause()` | 491 |
| `togglePause()` | 494 |
| `showPauseOverlay()` / `hidePauseOverlay()` | 503, 587 |
| `buildPauseDebug()` / `buildSpellDebug()` / `buildEnemyDebug()` | 508–565 |
| `_dbgOpen`, `toggleDebug()`, `openDebug()`, `closeDebug()` | 567–585 |
| `openSpellPicker()` / `closeSpellPicker()` | 617, 651 |
| `loop()` | 662 |
| `tick()` | 671 |
| `spawnTick()` / `spawnEnemy()` | 683, 697 |
| `fireRay()` / `fireLaser()` / `ptSegDist()` | 720, 743, 752 |
| `tickProjectiles()` / `explode()` | 759, 778 |
| `tickEnemies()` | 786 |
| `tickFx()` / `hitEnemy()` / `killEnemy()` / `checkLevelUp()` | 814, 826, 833, 846 |
| `castWall()` / `tickWalls()` | 854, 869 |
| `spark()` / `floatText()` / `tickParticles()` / `tickFloats()` | 899–913 |
| `draw()` | 916 |
| `drawBase()` / `drawWalls()` / `drawEnemies()` | 926, 942, 959 |
| `drawProjectiles()` / laser/boom/spark/floats particle draws | 987–1045 |
| `drawHoldRing()` | 1038 |
| `updateHUD()` / `updateSpellBar()` | 1049, 1061 |
| `showLevelUp()` / `buildOptions()` | 1067, 1093 |
| `pickNewSpell()` / `pickEquippedUpgrade()` / `pickAnyUpgrade()` | 1104, 1124, 1133 |
| `collectUpgrades()` | 1142 |
| `gameOver()` | 1156 |
| input `setupInput()` IIFE | 1163 |
| `ResizeObserver` | 1202 |
| `startGame()` call | 1212 |

---

## Common Extension Patterns

**New enemy type:** Append to `ENEMY_TYPES`. Fields: `{id, name, col, r, hp, spd, range, dmg, rate, xp, gold, wave, boss?}`. Appears automatically in spawn pool at the correct wave.

**New ray spell:** Add entry to `RAY_DEFS`. Fields: `{id, name, desc, color, glow, speed, dmg, aoe, dot, dotDur, instant}`. Auto-appears in `pickNewSpell()` for any player who hasn't unlocked it.

**New wall spell:** Add entry to `WALL_DEFS`. Fields: `{id, name, desc, color, glow, baseHp, duration, slow, dotDmg, blocks}`. Same auto-discovery.

**New upgrade:** Append to `UPGRADE_DEFS`. Fields: `{id, name, targetType, desc, avail?(s)→bool, apply(G,s)}`. Auto-collected by `collectUpgrades()`.

**New particle type:** Push `{type:'mytype', ...fields}` to `G.particles[]`. Add a `drawMytypePtcl()` function and call it from `draw()` in the correct z-order.

**New overlay:** Add HTML element, CSS `display:none → display:flex` via `.show` class, wire into `pushPause()`/`popPause()` if it should pause gameplay.
