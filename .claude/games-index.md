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
| Zed Shooter | `zed-shooter/` | shooter | virtual-joystick, kb-mouse | wave-survival | meta-progression | solo | external: zed-fps repo |
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
| Grid Defense | `grid-defense/` | tower-defense-classic | drag-place, tap | wave-survival | wave-defense, resource-economy, tower-upgrades | solo | `.claude/grid-defense.md` |
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

42 games (40 in-repo + 2 external builds).

## Coverage summary (read this first when picking new games)

### Saturated — avoid without a named twist
- **Input `tap`-only:** 14 games. **`endless-highscore`:** 11 games.
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
  `word` + `drag-connect` + `timed-round` (word-circuit) · `card-deck` +
  `quick-round` (tri-peaks) · `daily-challenge` (word-circuit, tri-peaks) ·
  `stealth`/`maze` + `vision-cones` (shadow-circuit) · `tap-to-move`
  (shadow-circuit, ember-depths) · `roguelike` + `run-based` +
  `permadeath` + `relic-builds` (ember-depths) ·
  `seeded-determinism` (blade-spin, word-circuit, tri-peaks — an
  established house pattern now).
- `lockpicking-sim` genre + `drag-probe`/`tension-hold` feel input +
  `feel-simulation`/`binding-order` mechanics (locksport — a physical-skill
  simulator, the first "learn a real craft" title).
- `trivia` + `drag-slider` + `estimation-scoring` (ballpark — graded
  guessing rather than multiple choice) · `marble-labyrinth` + `tilt` +
  `hazard-avoidance` (tilt-labyrinth — the only motion-sensor game).

### Absent — nothing left on the primary axes
Every genre, input, and session value this catalog tracks now has at least
one game. Novelty from here has to come from **new facet values**, not from
filling holes — invent the axis value first, then the game. Open directions:
- **Inputs:** `voice`/`mic-blow`, `two-finger-pan`, `long-press-hold`,
  `shake`, `camera`-driven — none exist yet.
- **Sessions:** `async-versus` (share a seed, compare scores),
  `weekly-ladder`, `endless-coop`.
- **Players:** local-2p has three flavors — real-time (air hockey),
  turn-based tactics (neon-tactics), memory duel (neon-recall); a fourth
  needs a genuinely new interaction shape.

### Example picks this table would suggest next
A `mic-blow` or `shake` game (the last untouched sensor inputs after tilt
landed), an `async-versus` retrofit onto a seeded game (blade-spin,
vault-breaker, ballpark and word-circuit all have `seeded-determinism`), or
a second `trivia` title in a different shape now that the genre is open.

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
took the last two absent values, `trivia` and `tilt`, so the coverage map
has no empty cells left on genre, input, or session.)*
