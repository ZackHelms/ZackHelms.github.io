# ZackHelms.github.io — Claude Instructions

## Git workflow

It is fine to push directly to the `main` branch for this repository. No pull request is required.

## Project structure

- `games/` — self-contained single-file HTML games (CSS + JS inline, no shared libs)
- `games/index.html` — games hub; add a card here for every new game
- `town-game-isometric/` — standalone isometric town-game project

## Adding a new game

1. Create `games/<slug>.html` as a single self-contained file
2. Add a card to `games/index.html`
3. Commit and push to `main`

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

**Standing rule for all games and game updates:** If the design spec is unclear or internally inconsistent, ask clarifying questions before writing code.

## Shared game conventions

See `games/CLAUDE.md` for the full shared conventions table (fonts, palette, input, etc.).
