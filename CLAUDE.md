# ZackHelms.github.io — Claude Instructions

## Git workflow

It is fine to push directly to the `main` branch for this repository. No pull request is required.

## Project structure

- `games/` — self-contained single-file HTML games (CSS + JS inline, no shared libs)
- `games/index.html` — games hub; add a card here for every new game
- `signals/` — **not a game.** Single-file reference app cataloguing every signal a web
  app can monitor, feature-detected and probed live in the visitor's own browser, with
  per-signal iOS Safari status and native-bridge notes. Data-table-driven: to add a
  signal, append one object to `SIGNALS[]` (or `NATIVE_ONLY[]`). See `signals/README.md`
- `character-lists/` — **not a game.** Personal reference app for remembering who's who
  in a book/show/film: a hub of titles, each with a name-only character list and a
  second list of places, and a tap-for-detail dialog. Data-driven — to add a title,
  write `character-lists/data/<slug>.js` (one `CL.add({...})` call) and add the slug to
  `data/manifest.js`; **never edit `index.html` to add content.** Spoilers go in each
  entry's `spoiler` field so `role`/`detail` stay safe to read mid-book. Full field
  contract in `character-lists/README.md`
- `experiments/` — **not games.** Interactive dioramas probing web rendering/sensor tech
  (WebGL2, DeviceOrientation, instancing…), one self-contained single-file page per
  experiment in its own subdirectory, listed on `experiments/index.html` (add a card there
  for every new experiment). Each diorama has an ⓘ info button whose overlay documents how
  the scene works — rendering passes, simulation model, approximations and limitations —
  keep that panel accurate when changing a scene. Realism is the design goal; the neon
  games aesthetic does not apply inside dioramas (the hub page keeps site styling).
  Shared conventions + Dragon Vase notes: `.claude/experiments.md`; the two big apps have
  dedicated context files — **Tree Simulator** (`experiments/lone-tree/`, saw tool +
  species presets mirroring zmhstudio's tree KB): `.claude/tree-simulator.md`;
  **ARViewport** (`experiments/rain-on-glass/`, scenes × times × weather × beings +
  wipeable glass): `.claude/arviewport.md`. Directory names are historical; titles renamed
  2026-08-15.
- `town-game-isometric/` — standalone isometric town-game project
- `FFL1/` — **generated/published, do NOT edit by hand.** This directory is overwritten
  by `publish.sh` in the separate [`ZackHelms/FFL1`](https://github.com/ZackHelms/FFL1)
  repo, which replaces it with the contents of that repo's `webapp/` folder. Make FFL1
  web app changes in the FFL1 repo's `webapp/`, then run its `publish.sh` to deploy here.
- `games/zed-shooter/` — **generated/published, do NOT edit by hand.** Overwritten by
  `50-publish.sh` in the separate [`ZackHelms/zed-fps`](https://github.com/ZackHelms/zed-fps)
  repo with that repo's Vite build output (the script also maintains this game's card in
  `games/index.html`). Make changes in zed-fps, then publish from there.

- `games/qntmchmst/` — **generated/published, do NOT edit by hand.** Overwritten by
  `50-publish.sh` in the separate [`ZackHelms/qntmchmst`](https://github.com/ZackHelms/qntmchmst)
  repo with that repo's Vite build output (the script also maintains this game's card in
  `games/index.html`). Make changes in qntmchmst, then publish from there.
## Adding a new game

`/create-new-games <N>` runs the whole batch commission (concept picks from
coverage gaps → build → test → ship → report). Manual steps:

0. Choose the concept from the coverage gaps in `.claude/games-index.md`
   (the games catalog + facet coverage map)
1. Create `games/<slug>.html` (or `games/<slug>/index.html` in its own
   subdirectory) as a single self-contained file
2. Add a card to `games/index.html` (plus an entry in that file's `GAMES`
   facet dataset — it feeds the hub's 📊 coverage dashboard) and a row to
   `.claude/games-index.md`
3. Commit and push to `main` (full checklist: `games/CLAUDE.md` § Adding a New Game)

## Code style

- Google Fonts: `Black Ops One` (headings) + `Share Tech Mono` (body)
- Color palette via `:root` CSS vars; dark background (`#06060e`), neon accents
- Canvas 2D for all game rendering; `requestAnimationFrame` game loop
- No external JS libraries

## Game-specific context files

Each game with significant design complexity has a dedicated context file in `.claude/`:

| Game | Context file | When to use |
|---|---|---|
| Adventure (`games/adventure.html`) | `.claude/adventure.md` | Any work on the adventure RPG — character systems, combat, RP encounters, save system, progression |
| Sorcery (`games/sorcery.html`) | `.claude/sorcery.md` | Any work on the sorcery tower-defense game |
| Merge Drop (`games/merge-drop/`) | `.claude/merge-drop.md` | Any work on the orb-merge physics puzzler |
| Neon Golf (`games/neon-golf/`) | `.claude/neon-golf.md` | Any work on the mini-golf game — hole design lives in its `HOLES[]` data |
| Neon Pinball (`games/neon-pinball/`) | `.claude/neon-pinball.md` | Any work on the pinball game — table geometry, flipper/segment physics |
| Gravity Runner (`games/gravity-runner/`) | `.claude/gravity-runner.md` | Any work on the gravity-flip endless runner — pattern spawning, fairness |
| Brick Breaker (`games/brick-breaker/`) | `.claude/brick-breaker.md` | Any work on the brick breaker — level maps, brick types, power-ups |
| Neon Snake Arena (`games/snake-arena/`) | `.claude/snake-arena.md` | Any work on the analog snake — body path, combo, mine pacing |
| Neon Slice (`games/neon-slice/`) | `.claude/neon-slice.md` | Any work on the swipe slicer — volley fairness, blade hit test, combo/slow-mo |
| Bubble Blaster (`games/bubble-blaster/`) | `.claude/bubble-blaster.md` | Any work on the bubble shooter — hex-grid math, snap/match/drop, row pressure |
| Block Fit (`games/block-fit/`) | `.claude/block-fit.md` | Any work on the drag puzzle — piece set, drag-lift UX, clears, dead-deal guard |
| Sky Hopper (`games/sky-hopper/`) | `.claude/sky-hopper.md` | Any work on the vertical bouncer — physics, generator reachability, platform mix |
| Neon Stack (`games/neon-stack/`) | `.claude/neon-stack.md` | Any work on the tower stacker — slide/trim math, perfect window, regrow rules |
| Blade Spin (`games/blade-spin/`) | `.claude/blade-spin.md` | Any work on the blade thrower — disc rotation patterns, level generator, collision arcs |
| Neon Crossing (`games/neon-crossing/`) | `.claude/neon-crossing.md` | Any work on the lane hopper — row generator fairness, log riding, camera pressure |
| Neon Air Hockey (`games/air-hockey/`) | `.claude/air-hockey.md` | Any work on the air hockey — puck/mallet physics, AI difficulty table |
| Meteor Defense (`games/meteor-defense/`) | `.claude/meteor-defense.md` | Any work on the meteor interceptor — wave/ammo budgets, chain blasts, mercy rebuild |
| Word Circuit (`games/word-circuit/`) | `.claude/word-circuit.md` | Any work on the word hunt — embedded dictionary, board gen/solver, drag path rules |
| Neon Tactics (`games/neon-tactics/`) | `.claude/neon-tactics.md` | Any work on the squad tactics — rules engine, LOS, AI scoring, pass-and-play flow |
| Star Surge (`games/star-surge/`) | `.claude/star-surge.md` | Any work on the shmup — wave director, boss phases, powerups, bullet caps |
| Grid Defense (`games/grid-defense/`) | `.claude/grid-defense.md` | Any work on the tower-defense campaign — the three-currency economy (cash/cores/skill points), armory tiers, the three skill trees, the ten-level/100-wave difficulty curve, continuous flow + retries, maps/waypoints, wave composition, drag-place UX, save/scoreboard |
| Neon Tripeaks (`games/tri-peaks/`) | `.claude/tri-peaks.md` | Any work on the tripeaks solitaire — board geometry/exposure, deal fairness, streak scoring, daily seed |
| Shadow Circuit (`games/shadow-circuit/`) | `.claude/shadow-circuit.md` | Any work on the stealth maze — maze/patrol generation, vision-cone detection, chase state machine |
| Neon Recall (`games/neon-recall/`) | `.claude/neon-recall.md` | Any work on the memory board — flip rules, scan budget, power pairs, versus turn logic |
| Neon Drift (`games/neon-drift/`) | `.claude/neon-drift.md` | Any work on the drift racer — track splines, drift physics, lap/anti-cut tracking, ghost replay |
| Ember Depths (`games/ember-depths/`) | `.claude/ember-depths.md` | Any work on the roguelike — turn engine, floor generation, vision/light map, relic effects |
| Alpine Ascent (`games/alpine-ascent/`) | `.claude/alpine-ascent.md` | Any work on the charge-jump climber — jump envelope, mountain generator, ground types, wind, altitude-graded rendering |
| Golden Reel (`games/golden-reel/`) | `.claude/golden-reel.md` | Any work on the fishing game — cast/bite/fight state machine, species zones, gear effects, dusk-water rendering |
| Vault Breaker (`games/vault-breaker/`) | `.claude/vault-breaker.md` | Any work on the safecracker — rotation input, pin/ring/handle phases, vault generator, brushed-metal rendering |
| Locksport (`games/locksport/`) | `.claude/locksport.md` | Any work on the lock-picking sim — binding/shear pin physics, spool/serrated drivers, tension pad, level path, cutaway rendering |
| Ballpark (`games/ballpark/`) | `.claude/ballpark.md` | Any work on the estimation trivia — question bank + range rules, log/linear dial math, proximity scoring, daily seeding |
| Tilt Labyrinth (`games/tilt-labyrinth/`) | `.claude/tilt-labyrinth.md` | Any work on the tilt maze — motion/drag input, ball physics, hole capture rules, board authoring + BFS fairness gate |
| Wayfinder (`games/wayfinder/`) | `.claude/wayfinder.md` | Any work on the orienteering sim — WebGL2 terrain/sky/water renderer, heightfield + land grids, ISOM map generation, compass/bearing/pace maths, the 9-lesson engine |
| Sky Lantern (`games/sky-lantern/`) | `.claude/sky-lantern.md` | Any work on the breath-flight game — mic RMS→breath mapping, burner/heat model, level generator + its three fairness gates |
| Signal Hunt (`games/signal-hunt/`) | `.claude/signal-hunt.md` | Any work on the hidden-object hunt — world/decoy generation, pan-pinch input, share codes and duel flow, colourblind labels |
| Turret Builder (`games/turret-builder/`) | `.claude/turret-builder.md` | Any work on the module-grid tower defense — the payload model and the CD's worked example (asserted to the decimal), the damage-decays/effects-don't rule, super-linear stack curves, diagonal boosters, the fifteen named combos and the discoveries codex, orthogonal sharing between turrets and walls, kinetic-vs-elemental typing and the scaling-armour rule, the narrow HP_LEVEL band, and the two test suites |
| Neon Clash (`games/neon-clash/`) | `.claude/neon-clash.md` | Any work on the real-time card skirmish — the rotated two-player tray, the deploy contract, bunker/garrison rules, unit stats, the AI ladder |
| Phasic (`games/phasic/`) | `.claude/phasic.md` | Any work on the phase-change block sort — soft-body particle physics, symmetric phase/base rules, gas guidance field, gravity-well bucket, curriculum blocks + complexity metric, generator/solver (three board templates, in-path obstacle weaving), STUCK ghost-replay, in-game wiki + tactics registry, resting-freeze fairness rule, chrome/layout (landscape column, rotation self-heal), proprietary-license carve-out, iOS-port notes |

**Standing rule for all games and game updates:** If the design spec is unclear or internally inconsistent, ask clarifying questions before writing code.

## Shared game conventions

See `games/CLAUDE.md` for the full shared conventions table (fonts, palette, input, etc.).

## zmh-producer

This repo carries a zmh-producer config at `.claude/zmh/producer.md`
(environment, backlog layout, validation gate, integration/publish rules for
the `/zmh-producer:*` commands). The gates it names live in `.claude/scripts/`;
gameplay drive suites worth keeping live in `.claude/tests/`; session learnings
go to `.claude/notes/`.

**Plugin bootstrap.** Remote containers never fetch the marketplace a repo
declares, so the plugin arrives via `.claude/hooks/session-start.sh`
(registered under `hooks.SessionStart` in `.claude/settings.json`, which also
names the marketplace and `enabledPlugins`). It is a no-op locally. If
`/zmh-producer:*` still fails to resolve — always the case in **multi-repo**
sessions, where the harness never fires a repo-local hook — run
`/load-plugins` once per fresh container.

`.claude/hooks/session-start.sh` (above its `repo-specific` marker) and
`.claude/commands/load-plugins.md` are **verbatim copies** from
`zmhstudio/plugins/zmh-producer/templates/`. Update them by re-copying, never
by hand-editing this repo's copy; only the section below the hook's marker is
this repo's to edit (currently a deliberate no-op — nothing to install).
Adopting another plugin needs no hook change, just another
`"<plugin>@zmhstudio": true` in `enabledPlugins`. Gotchas and the four
verified bootstrap paths: `.claude/notes/20260822-zmh-plugin-bootstrap.md`.
