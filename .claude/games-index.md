# Games Index — catalog + facet coverage

One row per shipped game in `games/`, classified with the shared facet
vocabulary from zmhstudio (`templates/design/game-facets.md` in
`ZackHelms/zmhstudio` — full definitions there; this file is
self-sufficient for sessions without that repo). Purpose: when asked for
"new, unique" games, read the **coverage summary** below first — novelty =
covering absent/rare facet values, not just a new theme.

**Maintenance rule:** every new game adds its row AND refreshes the
coverage summary in the same commit (step in `games/CLAUDE.md` § Adding a
New Game). External-build games (zed-shooter, qntmchmst) get rows too —
they occupy design space even though their source lives elsewhere.
The hub's 📊 COVERAGE HEURISTICS dashboard (`games/index.html`, `GAMES`
array) embeds a copy of this catalog's facets — update it in the same
commit as the row.

Axis legend (values are open enums; reuse before inventing):
**Genre** shelf label · **Input** thumb mechanic · **Session** shape of one
sitting · **Mechanics** the 2–4 that carry it · **Players** solo / vs-ai /
local-2p.

## Catalog

| Game | Path | Genre | Input | Session | Key mechanics | Players | Context |
|---|---|---|---|---|---|---|---|
| Neon Clash | `neon-clash/` | card-battler | drag-place, tap, tap-select | match-vs-ai, local-2p | card-deck, resource-economy, ai-opponent, rotated-2p-ui, area-of-effect, art-styles | vs-ai, local-2p | `.claude/neon-clash.md` |
| Zed Shooter | `zed-shooter/` | shooter | virtual-joystick, kb-mouse | wave-survival | meta-progression | solo | external: zed-fps repo |
| Mitochondria Simulator | `mitochondria/` | biology-sim | orbit-drag, pinch-zoom, two-finger-pan, tap | open-sandbox, guided-lessons | systems-simulation, scale-ladder, skill-teaching, real-time-3d | solo | `.claude/mitochondria.md` |
| Quantum Chemist | `qntmchmst/` | grid-puzzle | tap, drag-place | level-campaign | match-clear | solo | external: qntmchmst repo |
| Stick Wars | `stick-wars.html` | brawler | tap | wave-survival | meta-progression, resource-economy | solo | — |
| Town Builder | `town-game-1.html` | builder-sim | tap, drag-place | open-sandbox | resource-economy | solo | — |
| Horse Race | `horse-race.html` | racing | tap | endless-highscore | collection | solo | — |
| Piano Tiles | `piano-tiles.html` | rhythm | multi-tap-zones | level-campaign | timing-precision | solo | — (mp3 audio, pre-synth-era) |
| Sorcery | `sorcery.html` | defense | tap, hold | wave-survival | wave-defense, meta-progression | solo | `.claude/sorcery.md` |
| Stick Commander 3D | `stick-commander-3d.html` | rts-strategy | tap | level-campaign | resource-economy, boss-fights | solo | — |
| Adventure | `adventure.html` | rpg-adventure | tap | save-campaign | meta-progression, collection | solo | `.claude/adventure.md` |
| Croissant Clicker | `croissant-clicker.html` | idle-clicker | tap | idle-persistent | resource-economy, meta-progression | solo | `.claude/croissant-clicker.md` |
| Basketball Clicker | `basketball-clicker.html` | idle-clicker | tap | idle-persistent | resource-economy, meta-progression | solo | — |
| Gate Breaker | `gate-breaker/` | dungeon-crawler | tap | save-campaign | meta-progression, boss-fights | solo | — (React single-file) |
| Merge Drop | `merge-drop/` | physics-puzzle | drag-aim-release | endless-highscore | physics-sim, merging, combo-multiplier | solo | `.claude/merge-drop.md` |
| Neon Golf | `neon-golf/` | sports | drag-aim-release | par-course | physics-sim, trajectory-aiming | solo | `.claude/neon-golf.md` |
| Neon Pinball | `neon-pinball/` | arcade-classic | two-thumb, hold-charge | endless-highscore | physics-sim, deflection, combo-multiplier | solo | `.claude/neon-pinball.md` |
| Gravity Runner | `gravity-runner/` | endless-runner | tap | endless-highscore | procedural-generation, timing-precision | solo | `.claude/gravity-runner.md` |
| Brick Breaker | `brick-breaker/` | arcade-classic | drag-paddle | level-campaign | deflection, meta-progression | solo | `.claude/brick-breaker.md` |
| Neon Snake Arena | `snake-arena/` | arcade-classic | drag-steer | endless-highscore | collection, combo-multiplier | solo | `.claude/snake-arena.md` |
| Neon Slice | `neon-slice/` | arcade-classic | swipe | endless-highscore | gesture, combo-multiplier | solo | `.claude/neon-slice.md` |
| Bubble Blaster | `bubble-blaster/` | match-puzzle | drag-aim-release | endless-highscore | match-clear, trajectory-aiming, hex-grid | solo | `.claude/bubble-blaster.md` |
| Block Fit | `block-fit/` | grid-puzzle | drag-place | endless-highscore | match-clear | solo | `.claude/block-fit.md` |
| Sky Hopper | `sky-hopper/` | endless-climber | drag-steer | endless-highscore | physics-sim, procedural-generation | solo | `.claude/sky-hopper.md` |
| Neon Stack | `neon-stack/` | timing-skill | tap | endless-highscore | timing-precision, stacking, combo-multiplier | solo | `.claude/neon-stack.md` |
| Blade Spin | `blade-spin/` | timing-skill | tap | level-campaign | timing-precision, seeded-determinism, boss-fights | solo | `.claude/blade-spin.md` |
| Neon Crossing | `neon-crossing/` | arcade-classic | tap, swipe | endless-highscore | lane-navigation, procedural-generation | solo | `.claude/neon-crossing.md` |
| Neon Air Hockey | `air-hockey/` | sports | drag-paddle | match-vs-ai, local-2p | physics-sim, deflection, ai-opponent | vs-ai, local-2p | `.claude/air-hockey.md` |
| Meteor Defense | `meteor-defense/` | defense | tap | wave-survival | wave-defense, resource-economy, combo-multiplier | solo | `.claude/meteor-defense.md` |
| Word Circuit | `word-circuit/` | word | drag-connect | daily-challenge, timed-round | word-building, seeded-determinism | solo | `.claude/word-circuit.md` |
| Neon Tactics | `neon-tactics/` | turn-based-tactics | tap | match-vs-ai, local-2p | grid-combat, line-of-sight, ai-opponent | vs-ai, local-2p | `.claude/neon-tactics.md` |
| Star Surge | `star-surge/` | shmup | drag-steer | level-campaign | bullet-dodging, boss-fights, meta-progression | solo | `.claude/star-surge.md` |
| Turret Builder | `turret-builder/` | tower-defense-classic | drag-place, tap | level-campaign, wave-survival, endless-highscore, save-campaign | wave-defense, adjacency-synergy, damage-typing, combo-discovery | solo | `.claude/turret-builder.md` |
| Grid Defense | `grid-defense/` | tower-defense-classic | drag-place, tap | level-campaign, wave-survival, endless-highscore, save-campaign | wave-defense, resource-economy, tower-upgrades, meta-progression | solo | `.claude/grid-defense.md` |
| Neon Tripeaks | `tri-peaks/` | card-deck | tap | quick-round, daily-challenge | card-chain, combo-multiplier, seeded-determinism | solo | `.claude/tri-peaks.md` |
| Shadow Circuit | `shadow-circuit/` | stealth, maze | tap-to-move | level-campaign | vision-cones, line-of-sight, procedural-generation | solo | `.claude/shadow-circuit.md` |
| Neon Recall | `neon-recall/` | memory-board | tap | level-campaign, local-2p | memory-match, resource-economy, combo-multiplier | solo, local-2p | `.claude/neon-recall.md` |
| Neon Drift | `neon-drift/` | driver-racing | two-thumb | time-trial | physics-sim, ghost-replay, timing-precision | solo | `.claude/neon-drift.md` |
| Ember Depths | `ember-depths/` | roguelike | tap-to-move | run-based | permadeath, relic-builds, procedural-generation, grid-combat | solo | `.claude/ember-depths.md` |
| Alpine Ascent | `alpine-ascent/` | platformer | hold-charge, drag-aim-release | level-campaign | physics-sim, timing-precision, checkpoint-climb | solo | `.claude/alpine-ascent.md` |
| Golden Reel | `golden-reel/` | fishing | hold-charge, tap | save-campaign | collection, resource-economy, timing-precision | solo | `.claude/golden-reel.md` |
| Vault Breaker | `vault-breaker/` | dexterity-puzzle | pinch-rotate | level-campaign | timing-precision, seeded-determinism, star-rating | solo | `.claude/vault-breaker.md` |
| Locksport | `locksport/` | lockpicking-sim | drag-probe, tension-hold | level-campaign | feel-simulation, binding-order, star-rating, seeded-determinism | solo | `.claude/locksport.md` |
| Ballpark | `ballpark/` | trivia | drag-slider | daily-challenge, quick-round | estimation-scoring, streak-multiplier, seeded-determinism | solo | `.claude/ballpark.md` |
| Tilt Labyrinth | `tilt-labyrinth/` | marble-labyrinth | tilt, drag-steer | level-campaign | physics-sim, hazard-avoidance, star-rating | solo | `.claude/tilt-labyrinth.md` |
| Sky Lantern | `sky-lantern/` | flight-control | mic-blow, drag-steer | level-campaign | analog-breath, physics-sim, star-rating | solo | `.claude/sky-lantern.md` |
| Signal Hunt | `signal-hunt/` | hidden-object | pinch-zoom, two-finger-pan, tap | async-versus, daily-challenge, timed-round | visual-search, seeded-determinism, share-code | solo, async-2p | `.claude/signal-hunt.md` |

| Wayfinder | `wayfinder/` | exploration-sim | twin-stick, drag-slider | skill-campaign, open-sandbox | first-person-3d, map-and-compass, day-night-cycle, skill-teaching | solo | `.claude/wayfinder.md` |
| Phasic | `phasic/` | phase-puzzle | drag-place, tap | level-campaign, endless-levels, daily-challenge | phase-change, soft-body-physics, point-gravity, resource-economy | solo | `.claude/phasic.md` |

49 games (47 in-repo + 2 external builds).

## Coverage summary (read this first when picking new games)

### Saturated — avoid without a named twist
- **Input `tap`-only:** 14 games. **`endless-highscore`:** 12 games.
- **Genre `arcade-classic`:** 5. `idle-clicker`: 2 (both very deep — don't
  add a third). One-thumb neon arcade in general is the house specialty and
  the most crowded shelf.

### Rare — one game each; a second with a different spin is fair game
- `hold-charge` (pinball plunger, alpine-ascent leap, golden-reel cast —
  now an established pattern) · `fishing` + `catch-log collection`
  (golden-reel) · `two-thumb` (pinball flippers,
  neon-drift hold-steer) · `swipe`-led
  (neon-slice) · `virtual-joystick` (zed-shooter) · `par-course` (neon-golf)
  · `time-trial` + `ghost-replay` (neon-drift)
  · `match-vs-ai` + `local-2p` (air hockey, neon-tactics, neon-recall) · `open-sandbox` (town builder)
  · `rhythm` (piano tiles, pre-synth-era) · `hex-grid` (bubble-blaster) ·
  `word` + `drag-connect` (word-circuit) · `timed-round` (word-circuit,
  signal-hunt) · `card-deck` +
  `quick-round` (tri-peaks) · `daily-challenge` (word-circuit, tri-peaks,
  ballpark, signal-hunt, phasic — an established house pattern now) ·
  `stealth`/`maze` + `vision-cones` (shadow-circuit) · `tap-to-move`
  (shadow-circuit, ember-depths) · `roguelike` + `run-based` +
  `permadeath` + `relic-builds` (ember-depths) ·
  `seeded-determinism` (blade-spin, word-circuit, tri-peaks, ballpark,
  signal-hunt — an established house pattern now).
- `lockpicking-sim` genre + `drag-probe`/`tension-hold` feel input +
  `feel-simulation`/`binding-order` mechanics (locksport — a physical-skill
  simulator, the first "learn a real craft" title).
- `trivia` + `drag-slider` + `estimation-scoring` (ballpark — graded
  guessing rather than multiple choice) · `marble-labyrinth` + `tilt` +
  `hazard-avoidance` (tilt-labyrinth — the only motion-sensor game).
- `flight-control` genre + `mic-blow` input + `analog-breath` mechanic
  (sky-lantern — the only game that listens; hold-to-burn is its fallback,
  not a second mode worth counting).
- `hidden-object` genre + `pinch-zoom`/`two-finger-pan` input +
  `visual-search`/`share-code` mechanics + `async-versus` session +
  `async-2p` players (signal-hunt — the only game two people play without
  being in the same room or the same minute).

- `exploration-sim` genre + `twin-stick` input + `first-person-3d` /
  `map-and-compass` / `day-night-cycle` mechanics + `skill-campaign` session
  (wayfinder — the repo's only 3D game and its only real-world-skill trainer;
  also the only page rendering with WebGL rather than Canvas 2D).

- `tower-defense-classic` + a 100-level `level-campaign` +
  `meta-progression` (grid-defense — the only game whose long arc is a
  between-levels economy: an armory of permanent turret tiers plus three
  branching skill trees, with `save-campaign` slots and a top-ten board.
  Sorcery is the other tower defense but is spell-cast, single-run and has
  no persistent build). **turret-builder** is the third and shares the
  shelf without repeating it: see the new mechanics below.

- `phase-puzzle` genre + `phase-change` / `soft-body-physics` /
  `point-gravity` mechanics + `endless-levels` session (phasic — the only
  soft-body simulation and the first game with solver-validated procedural
  levels forever: 16 authored, then endless seeded drawers, each beaten by
  the in-game solver before it is served; earmarked as the first web-first
  prototype of a future iOS title).

### Newly opened by the 2026-08-15/16 build
- `biology-sim` genre + `systems-simulation` / `scale-ladder` / `real-time-3d`
  mechanics + `guided-lessons` session + `orbit-drag` input (mitochondria — the
  first title that is explicitly **not scored**: an explorable instrument built
  on a real OXPHOS flux model, with 30 scenarios, 13 step-through walkthroughs,
  layer toggles and a membrane cutaway. It is also the repo's second WebGL2
  page after wayfinder).
- **`scale-ladder`** is the genuinely new mechanic (phase 2, 2026-08-16): one
  continuous coordinate space in which pinching out turns the organelle into one
  of hundreds inside a living cell — 9 procedurally-built human cell types — and
  tapping any mitochondrion up there drops you back into it at full detail.
  Nothing is swapped; the cell is modelled at true relative scale. No other game
  in the repo changes the *magnification* of its subject as a mechanic; phase 3
  adds a tissue/whole-body rung.

### Newly opened by the 2026-08-17 build
- **`adjacency-synergy`**, **`damage-typing`** and **`combo-discovery`**
  (turret-builder) are the three new mechanic values, and they are the whole
  game rather than a garnish. `combo-discovery` is the rarest of them: fifteen
  named turret patterns (two opposite module pairs, or four of a kind) with
  effects nothing else in the game does, announced when built, kept in a codex
  that persists across runs, and never listed before you find them. No other
  game in the repo has hidden content the player is expected to learn and
  remember rather than unlock on a schedule. It
  has exactly ONE turret — a gray triangle, 10 kinetic damage a second,
  unchanging — and all of its depth in the tiles you bolt around it: a module
  powers *every* turret and wall it orthogonally touches, so one tile wedged
  between two turrets pays both and a board becomes a packing problem rather
  than a scatter of towers. `damage-typing` is the counter-play half: flat
  armour eats kinetic and scales with the campaign, percentage resist eats
  elemental and does not, so no single module answers everything. Where
  grid-defense puts its depth in a between-levels meta-game of four turret
  types, this puts it in the layout — the two are deliberate inverses, and a
  third tower defense on the same shelf would now need a different axis again.

### Absent — what's actually left
Sensor inputs are now down to two: **`shake`** and **`camera`**. Everything
else on the primary axes has at least one game, so novelty mostly has to come
from **inventing a new facet value**, not filling a hole. Open directions:
- **Inputs:** `shake`, `camera`-driven, `long-press-hold`, `two-hand-chord`
  (both thumbs doing *different* jobs, not mirrored like pinball's flippers).
- **Sessions:** `weekly-ladder`, `endless-coop`, `relay` (each player adds one
  move to a shared seeded run and passes the code on — a natural next step now
  that `share-code` exists and is drive-tested).
- **Sessions:** `guided-lessons` now exists (mitochondria) alongside
  wayfinder's `skill-campaign`; a third non-scored explorable would want a
  different subject, not a different shape.
- **Players:** local-2p has four flavours — real-time shared-board (air
  hockey), turn-based tactics (neon-tactics), memory duel (neon-recall) and
  simultaneous rotated-UI (neon-clash) — and `async-2p` now has one
  (signal-hunt). A `co-op` value has nothing at all.

### Newly opened by the 2026-08-22 build
- **`card-battler`** genre + **`rotated-2p-ui`** mechanic (neon-clash) are the
  two new values. The genre is the repo's first real-time deck-in-hand
  skirmish: a shared board split into halves, energy that refills on a clock
  rather than on kills, and units that walk and fight without further input
  once dropped. `rotated-2p-ui` is the rarer of the two — the phone lies flat
  on a table and the *far* card tray is drawn upside down, so two players
  facing each other across it each read their own hand the right way up and
  deploy **simultaneously**, multi-touch, with no turns. The three older
  local-2p games all share one orientation: air hockey's board is
  orientation-neutral, and neon-tactics/neon-recall pass the phone between
  turns. A fifth local-2p title would now want `co-op`, which is still empty.
- **`art-styles`** (neon-clash, 2026-08-23) is the first player-selectable art
  direction in the repo — a second cel-shaded skin over the same simulation,
  behind a settings cogwheel. Everything else here paints exactly one way. If a
  second game ever wants a skin picker, the pattern to copy is in
  `.claude/neon-clash.md` § Graphics styles: a skin is paint, `glow()` goes
  no-op rather than branching at every call site, and scenery is seeded once.
- **`area-of-effect`** (neon-clash, added later the same day with the fireball
  card) is also new. Plenty of games here blow several things up at once, but
  this is the first where the *player aims the blast* — a placed circle whose
  damage and knockback both fall off from the centre, so the skill is reading
  a crowd rather than hitting a target. Anything with a grenade, a bomb, a
  shockwave or a cleared radius should reuse this value rather than mint one.

### Example picks this table would suggest next
A `shake` game (one of the two untouched sensors), an `async-versus` retrofit
onto another seeded title now that signal-hunt has proven the share-code
pattern (blade-spin, vault-breaker, ballpark and word-circuit are all seeded
already), or a `co-op` shape, which is the emptiest cell on the players axis.

*(The first 2026-07-24 batch — word-circuit, neon-tactics, star-surge,
grid-defense — filled the `word`, `turn-based-tactics`, `shmup`,
`tower-defense-classic`, and `daily-challenge` gaps. The second batch —
tri-peaks, shadow-circuit, neon-recall, neon-drift — filled `card-deck`,
`stealth`, `maze`, `memory-board`, and `driver-racing`, adding
`tap-to-move` input and `time-trial`/`quick-round` sessions. The
2026-07-25 realistic-graphics batch — ember-depths, alpine-ascent,
golden-reel, vault-breaker — filled `roguelike` + `run-based`,
`platformer`, the new `fishing` genre, and the `pinch-rotate` input. The
2026-07-25 realistic lock-picking build — locksport — added the
`lockpicking-sim` genre and the two-handed `drag-probe`/`tension-hold`
feel input. The 2026-07-25 closing pair — ballpark and tilt-labyrinth —
took the last two absent values, `trivia` and `tilt`. The 2026-07-25
new-axes pair — sky-lantern and signal-hunt — had nothing left to fill, so
it invented values instead: the `mic-blow` sensor input with a
`flight-control` genre, and the `hidden-object` genre with `pinch-zoom` /
`two-finger-pan` input and the `async-versus` session / `async-2p` players
that let two people share one seeded grid.)*
