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
- **Relics** (`RELICS`, chest offers 2): blade +2 atk, leech HP/kill, skin
  −dmg (min 1), ward blocks 1 hit per `wardRecharge()` turns (`wardTimer`),
  lantern +light, crown +2 maxHP & +2 heal per descend. Effects live in
  `takeRelic` (stat relics) / `hurtPlayer` (skin+ward order: skin first, ward
  consumes the hit) / `killEnemy` (leech) / `completeDescend` (crown).
  **`relics` is a list, not a set, and every effect stacks per copy.** Chests
  offer unseen relics first and start offering *second copies* once the set is
  exhausted (they used to pay +25 gold, which made a deep run stop building).
  So every effect site reads **`relicCount(key)`, never `relics.includes(key)`**
  — that is one rule with six enforcement points, and a site left on
  `.includes()` is the whole failure mode. Scaling per copy: blade/crown are
  additive through `takeRelic` for free; skin subtracts N; leech heals N;
  lantern `min(9, 3.6 + 1.6N)`; ward recharges in `max(2, 8 - 2N)` turns
  (copies shorten the cooldown rather than stacking shields, so a build cannot
  eat three hits a turn). `relicCounts()` is the aggregated view — one row per
  kind with `n` — and everything player-facing goes through it.
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

## Camera / zoom

`tile`, `ox`, `oy` remain the **only** things the renderer and the tap
hit-test read, so zoom is entirely a question of what `applyView()` writes
into them. Everything else follows:

- `baseTile` is the whole-board fit `resize()` computes (`floor(min(W/COLS,
  availH/ROWS))`), i.e. **zoom 1 == the fit**. `MIN_ZOOM` 0.5 (the board
  shrinks inside the viewport — a wider look at where you have been),
  `MAX_ZOOM` 6. `tile = baseTile * zoom`. Zoom 1 was `MIN_ZOOM` until
  2026-08-26; if you reintroduce a `zoom > MIN_ZOOM` test anywhere it now means
  "not fully zoomed out", **not** "zoomed in past the fit" — the honest test
  for "is there anything to pan" is `canPan()`, which compares the board's
  pixel size against the viewport.
- `camX`/`camY` are the world (tile-space) point held at the centre of the
  **board viewport** (`viewX/viewY/viewW/viewH` = the board area between the HUD
  row and the bottom margin). `applyView()` clamps them so the board can never
  be dragged off that viewport, and **centres an axis outright** when the
  board is smaller than the viewport on it. Zoom 1 is exactly that case on
  both axes, so it reproduces the original layout.
- `zoomAt(sx, sy, factor)` pins the world point under `(sx,sy)` — that is the
  pinch anchor. `panBy(dx, dy)` is a no-op at zoom 1 (the clamp re-centres).
- `centerCam()` runs at the end of `genFloor`, so a zoomed run opens each new
  floor on the player rather than last floor's corner. Zoom itself persists.
- **Free look (`camFree`) is the rule the rest of the camera bends to.** It
  latches the moment the player pans or pinches, and **only `centerCam()`
  clears it** (the ⌖ button, or a new floor). While it is set `followCam` does
  nothing at all: the camera stays exactly where it was put, however far the
  hero walks, so a drag can look anywhere on the map and *stay* there. Before
  it is set, `followCam(dt)` is the old correction — nothing happens until the
  player nears a dead-zone edge, then it eases just enough to bring them back.
  The dangerous regression is the camera quietly re-tethering after a drag,
  because that is what this game did *by design* until 2026-08-26: a refactor
  that "restores" `followCam` looks like a fix and silently deletes the
  feature. `drive-ember-depths.cjs` pins it.
- **The ⌖ button has to exist.** With no tether, the route back to the hero
  cannot be another gesture (a drag is what got you here) and cannot be a
  board tap (that walks). `drawRecenter()` paints it in the bottom-right of the
  viewport **only while `camFree`**, so it doubles as the signal that the
  camera is currently the player's; `handleTap` hit-tests it before `tapTile`,
  so re-centring costs no turn.
- A zoomed board is bigger than its viewport, so `drawScene` masks the strips
  outside `view*` back to background **before** the vignette (so they darken
  exactly as the already-empty strips do at zoom 1) — otherwise the dungeon
  renders up behind the HUD text. That bug is the tell of a wider class: the
  renderer had **no viewport concept**, and "the board stays inside the play
  area" held only *by accident of the fit*. `ctx.clip()` was tried and
  rejected — it shakes with the content or shaves the outermost column, and it
  cannot reach the light map, glow and vignette, which paint full-screen
  outside the world's `save()` block.
- **Init ordering:** `applyView()` needs the view rect from `resize()`, and
  `centerCam()` needs `player`. `genFloor(1)` runs at the bottom of the script,
  *after* `resize()`, so both hold. Hoisting that call above `resize()` clamps
  the camera against a zero-size viewport and renders the board off-screen with
  no error.

Gestures share the canvas and must never be confused (`TAP_SLOP` 14 px):
1 finger under slop → tap; 1 finger over slop → drag-pan (only when
`canPan()`);
2 fingers → pinch zoom + pan at the midpoint. `gestured` latches for the whole
touch sequence once a pinch or drag happens, so the final lift never fires a
stray tap. Every canvas touch handler `preventDefault()`s, and document-level
`gesture*` + multi-touch `touchmove` guards kill Safari's own page zoom, so a
pinch only ever scales the board. `wheel` (plain and ctrl+wheel) zooms on
desktop.

## Audio

Standard stack: lazy `audioInit` (also called by every `bindTap` handler),
shared `noiseBuf` created in `audioInit`, `sfxGain`/`musicGain`, mute key
`ember-depths-mute`, `visibilitychange` suspend. Music: continuous detuned
saw drone through a lowpass + 32-step sequencer (minor triangle plucks, deep
toms, echoing bandpass "drips" — 3 scheduled repeats fake the cavern echo).

## Settings

Cogwheel `#cog` is the third button in the top-left row (← / 🔊 / ⚙). **All
three chrome buttons sit at `z-index:45`, above the `#settings` scrim (z 40)** —
the cog needs it to stay a toggle rather than a one-way door, and
`games/CLAUDE.md` § Chrome above overlays requires ← and mute to outrank every
full-screen overlay so the player is always one tap from leaving or silencing
the game. Raising only the cog shipped for one commit (a0c8504) and was caught
by the refine pass, not by play; `neon-clash` has the same shape, `#hud-left`
at z 80 over `#ov-settings` at 78. The scrim layers over whatever is underneath
(title, relic choice, live floor) rather than replacing it, so closing restores
the view with no state to keep; it also swallows a stray tap that would
otherwise reach the board. Tapping the scrim itself closes.

Two sliders, music and SFX, 0–100% in steps of 5. They **scale** the mix
headroom the game was tuned at (`SFX_BASE` 0.4, `MUSIC_BASE` 0.14), so 100% is
exactly the old behaviour; `applyVolumes()` is the single place both gains are
written, and mute still wins over both. Persisted as
`ember-depths-sfxvol` / `ember-depths-musicvol` (floats 0–1; anything out of
range falls back to 1). Raising a slider above 0 while muted **un-mutes** —
otherwise the panel is dead and the player has no idea why. A slider drag also
calls `audioInit()`, since it is a valid iOS unlock gesture.

The 🔊 button **stays** alongside the sliders: it is the repo-wide audio
standard (`games/CLAUDE.md` § Audio), the `ember-depths-mute` key is asserted
by the existing drive suite's mute-reload check, and it is the one-tap silence
the chrome rule above is about. `applyVolumes()` is where the two settle.

The HUD's `DEPTH`/gold text starts at **x=148** to clear the third button —
note this is the *sideways* move `games/CLAUDE.md` § Third chrome button warns
usually fails. It works here only because this HUD's left block is two short
left-aligned lines (~75 px) and the right block starts at
`W - min(150, W-250) - 12` = 238 on a 390 px screen. The x is coupled to the
button count: a fourth chrome button needs it moved again, or moved below the
row as that convention prescribes.

## Relic panel (the buff tooltip)

Tapping the HUD relic row opens a canvas-drawn panel listing every relic with
its card text and a **live** status line (`relicStatus`) — current attack, max
HP, light radius, ward readiness. It is drawn last in `drawScene`, over the
intro banner and descend fade.

- **It is a read, never a turn.** Open and close both go through `handleTap`,
  the same entry point that walks the hero, so the ordering there is the whole
  contract: `if (buffPanel) { buffPanel = false; return; }` comes *first*, and
  the dismissing tap therefore never reaches `tapTile`. Let it fall through and
  the tap that closes the panel walks you into a room you cannot see and every
  enemy takes a step — invisible in a screenshot, obvious in `turnCount`.
- Duplicates **aggregate to one row** with `×N` (`relicCounts()`), in the panel
  and in the HUD row. The card text quotes single-copy numbers, so the live
  status line carries the stacked truth (ward spells its shortened recharge out
  explicitly, since its card names a number).
- The HUD row **measures before it places**: six relics with `×N` badges are
  wider than the gap between the gold line and the right edge, so the row
  slides left (floor x=196, to clear the gold text) instead of running off
  screen. `buffRect` is published from `drawHUD` each frame — hit-testing reads
  what was actually drawn rather than recomputing the layout.
- A faint plate is drawn behind the row on purpose: an icon strip with no
  affordance reads as decoration, and nothing else on this HUD is tappable.
- `genFloor` and `startRun` both clear `buffPanel`, so no panel survives into a
  floor or run that did not open it.

## Test hooks / traps

- Top-level lets (`state`, `grid`, `player`, `enemies`, `items`, `relics`,
  `gold`, `floorNum`, `chest`, `stairs`, `pathQueue`…) reachable from
  `page.evaluate`; `genFloor(n)` / `playerAct` / `hurtPlayer` / `takeRelic`
  / `tapTile` callable directly.
- Clear `enemies = []` before movement/pickup assertions — live enemies act
  on every `playerAct` (established trap class).
- Chest/stairs transitions skip the enemy turn — don't assert enemy
  movement across them.
- **Camera state is eased every frame.** `followCam` runs on the next rAF
  after any camera change, so a drive check that does `evaluate(panBy(...))`
  and then reads `ox`/`oy` in a *second* `evaluate` measures the follow, not
  the pan. Act and read in **one** `page.evaluate`. (Cost three false
  failures on 2026-08-25 — the clamp and pinch-anchor checks were right and
  the test was wrong.) Technique + the CDP multi-touch harness:
  `.claude/notes/20260825-ember-depths-pinch-zoom-and-multi-touch-testing.md`.
- **Chrome reachability is checkable, cheaply.** For each overlay the game can
  raise (title, relic choice, death, settings scrim), walk ← / 🔊 / ⚙ and
  assert `document.elementFromPoint(centre)` returns that button's own id.
  Nine such checks caught the z-index defect above.
- **Camera checks teleport the hero, and can leave them inside a wall.**
  Driving `followCam` means writing `player.x/y` to arbitrary cells; a later
  stage that then looks for a walkable neighbour finds none, or paths from a
  wall. Call `genFloor(floorNum)` between stages. This is the repo-wide
  "stages must not share mutable state" rule wearing a camera costume — it made
  the panel group flaky (~50%) before it was found, which is worse than red.
- **Aim a "does this tap walk?" control at an orthogonal neighbour**, not at
  "the first `seen` floor tile on the board": a distant seen tile can be
  unreachable on a given procedural floor, so the control fails for a reason
  that has nothing to do with the thing under test. And an adjacent tap can
  resolve *immediately* rather than queueing — witness a move with
  `player.x/y` **and** `turnCount`, not `pathQueue.length` alone, which reads 0
  both when nothing happened and when the hero already walked.
- Drive: **`.claude/tests/drive-ember-depths.cjs` (37 checks)** — kept, and
  picked up automatically by `gates.sh` for any change under
  `games/ember-depths/`. Covers the zoom range and clamps, zoom-1 layout
  identity, free look (tethered before a drag, never re-tethering after one,
  handed back by ⌖), a real CDP pinch that zooms without firing a tap or
  scaling the page, the panel-is-not-a-turn contract with its positive control,
  and one check that drives **all six** stacking sites through the game's own
  `hurtPlayer` / `killEnemy` / `lightRadius`. That last point was learned the
  hard way: the first version re-derived `damage - relicCount('skin')` inside
  the check and passed with the shipping site reverted to `.includes()`.
  Negative-controlled through `negtest.sh` (a `camFree`-blind `followCam`, a
  falling-through dismiss tap, and each of skin/leech/ward reverted to
  non-stacking) — each fails exactly its own check.
- Older scratchpad suites (2026-08-25, 70 checks: slider → gain math, mute
  precedence, reload persistence, pinch anchor, screen→tile round-trip, fuzz
  runs, the chrome-reachability sweep) are gone with their container. The
  invariants worth keeping from them are written down above.
