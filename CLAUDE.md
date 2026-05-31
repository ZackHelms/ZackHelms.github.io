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
