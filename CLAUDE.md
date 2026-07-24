# ZackHelms.github.io — Claude Instructions

## Git workflow

It is fine to push directly to the `main` branch for this repository. No pull request is required.

## Project structure

- `games/` — self-contained single-file HTML games (CSS + JS inline, no shared libs)
- `games/index.html` — games hub; add a card here for every new game
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

1. Create `games/<slug>.html` (or `games/<slug>/index.html` in its own
   subdirectory) as a single self-contained file
2. Add a card to `games/index.html`
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

**Standing rule for all games and game updates:** If the design spec is unclear or internally inconsistent, ask clarifying questions before writing code.

## Shared game conventions

See `games/CLAUDE.md` for the full shared conventions table (fonts, palette, input, etc.).

## zmh-producer

This repo carries a zmh-producer config at `.claude/zmh/producer.md`
(environment, backlog layout, validation gate, integration/publish rules for
the `/zmh-producer:*` commands). The smoke gate it names lives in
`.claude/scripts/`; session learnings go to `.claude/notes/`.
