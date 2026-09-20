# Interlock

A touch-friendly 3-D disassembly puzzle. No accounts, music, or network dependencies — the shipped page fetches nothing at all.

## Building

`index.html` is **generated** — edit `src/`, then:

```
cd games/interlock && node build.mjs
```

That inlines `src/style.css` and bundles `src/*.js` plus the vendored Three.js
into the single self-contained `index.html` this repo's game convention wants,
and stamps the build badge. For a local preview just open the built
`index.html` — it needs no server, because nothing is fetched. To preview the
unbundled source instead, `python3 -m http.server 8000` in `src/` and open
`page.html`; ES modules will not load over `file://`.

Architecture notes, including why the bundler wraps the game in an IIFE and why
Three.js is a documented exception to "no external JS libraries", are in
`.claude/interlock.md`.

## Play

Drag in any direction to rotate. Tap a piece to try all six straight sliding directions. A blocked piece jiggles; a clear one slides out. Pinch or use the mouse wheel to zoom. Arrow keys rotate; Enter tries the piece at screen center. Top left, in the site's standard order: back to the games hub, mute, a fresh puzzle at the current size, and the gear that opens settings.

Each puzzle is a connected solid subdivided into connected polycube pieces. Generation peels connected pieces along clear axes while preserving a connected remainder, so every puzzle has a solution. Collision checks test the full straight exit path against every remaining piece. Multiple pieces may be removable at a given stage. Pieces translate without turning; this is a voxel disassembly puzzle, not a simulation of traditional burr joints.

Settings save locally in this browser. Each page load starts at your chosen minimum. Completing a puzzle advances one piece up to the maximum, then generates new puzzles at that maximum. Empty minimum/maximum fields resolve to 5/20 on blur or closing settings; out-of-range values are clamped and inverted bounds are reconciled. Size changes apply to the next puzzle.

The default background is pure black. The other four are procedural landscapes: a shader sky with a sun disc and its glow, a moon, two drifting cloud decks and stars, over a displaced heightfield coloured by height and slope, with reflective water, grass or falling snow.

The **only light sources are the sun and the moon**. Ambient comes from the sky itself — the same shader you are looking at is baked into an environment map — so daylight carries the blue and the clouds overhead and night is only what the moon gives. Exactly one of the two casts shadows at a time. Shadow mapping handles what the sun is blocked from; ambient occlusion, baked per vertex from the cells still on the board and recomputed every time a piece comes out, handles the seams and crevices the sun never reached. Lighting follows a continuous 24-minute cycle from page load without restarting between puzzles or background changes.

The three translucent materials refract, and you can see the **other pieces** through them, not just the background: piece outlines are drawn opaque so they reach the refraction pass, and colour comes from absorption scaled to each piece's size, so a thick piece is deeply saturated and a thin one is nearly clear.

Audio begins after the first tap, as required by mobile browsers. Effects and distinct environmental ambience are synthesized locally with Web Audio. There is no music.

Modern WebGL-capable Safari, Chrome, Firefox or Edge is required. Browser power-saving can pause animation when the tab is hidden; the day cycle catches up when it resumes.

## Validation

`.claude/tests/drive-interlock.cjs` (pure node, no browser) generates 192
puzzles spanning every size from 5 to 20 on a seeded RNG and asserts exact
piece count, an exact partition of the cube, and a complete collision-checked
removal sequence for each — plus hand-built fixtures with known answers, so a
collision test that always says "clear" cannot pass it. It also fails if the
built `index.html` does not match `src/`.

Browser side, `.claude/scripts/smoke-mobile.cjs` and
`check-canvas-space.cjs` both run green at the iPhone 13 viewport. Rendering,
touch and audio were driven headlessly; check them on your own device too.

## Licence

Interlock is **proprietary** — all rights reserved, play-only. See `LICENSE`.
It is one of this repo's protected games; do not add a permissive licence to
this directory.

The bundled Three.js r169 is the exception and stays MIT on its own terms
(`src/vendor/THREE-LICENSE.txt`, and the `@license` banner preserved inside the
built `index.html`).
