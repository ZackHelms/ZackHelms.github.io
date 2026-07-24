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

28 games (26 in-repo + 2 external builds).

## Coverage summary (read this first when picking new games)

### Saturated — avoid without a named twist
- **Input `tap`-only:** 12 games. **`endless-highscore`:** 11 games.
- **Genre `arcade-classic`:** 5. `idle-clicker`: 2 (both very deep — don't
  add a third). One-thumb neon arcade in general is the house specialty and
  the most crowded shelf.

### Rare — one game each; a second with a different spin is fair game
- `hold-charge` (pinball plunger) · `two-thumb` (pinball) · `swipe`-led
  (neon-slice) · `virtual-joystick` (zed-shooter) · `par-course` (neon-golf)
  · `match-vs-ai` + `local-2p` (air hockey) · `open-sandbox` (town builder)
  · `rhythm` (piano tiles, pre-synth-era) · `hex-grid` (bubble-blaster) ·
  `seeded-determinism` (blade-spin, word-circuit daily) · `word` +
  `drag-connect` + `daily-challenge`/`timed-round` (word-circuit).

### Absent — highest-novelty targets
- **Genres:** `card-deck` · `trivia` · `turn-based-tactics` ·
  `roguelike` · `platformer` · `shmup` · `maze` · `stealth` ·
  `memory-board` · `tower-defense-classic` (build/place towers — Sorcery is
  cast-spells defense) · `driver-racing` (steer the vehicle — Horse Race is
  influence-only).
- **Inputs:** `tilt` (iOS motion-permission prompt — low priority) ·
  `pinch-rotate`.
- **Players:** local-2p beyond air hockey (turn-based pass-and-play would
  also cover `turn-based-tactics` or `memory-board` in the same build).

### Example picks this table would have suggested
A `word` or `card-deck` game (absent genre, calm pacing contrast), a
pass-and-play `turn-based-tactics` board (absent genre + rare local-2p), a
`shmup` with `drag-steer` (absent genre, proven input), or a
`daily-challenge` mode retrofit onto an existing seeded game.
