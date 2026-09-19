# Interlock — context

`games/interlock/` — a 3-D disassembly puzzle. A solid cube is subdivided into
connected polycube pieces; drag to rotate, tap a piece to try all six straight
sliding directions. A blocked piece jiggles, a clear one slides out. Clear the
board and the next puzzle is one piece bigger, up to the player's chosen
maximum.

**Licensing: one of the six protected games** (with fire-clicker, phasic,
mitochondria, qntmchmst, turret-builder) — proprietary LICENSE in its
directory, never Apache/MIT. The CD marked it protected the day it shipped, so
it never carried a permissive licence at all. **Do not add one**, and do not
let the "new game default: copy the MIT LICENSE" step in
`games/CLAUDE.md` § Adding a New Game talk a future session into it. The one
exception is section 6 of that licence: the bundled Three.js stays MIT on its
own terms and the proprietary grant explicitly does not reach it.

**Provenance.** Supplied by the CD as a finished multi-file build (2026-09-19)
and added to the hub as-is apart from the site chrome. Its look and feel are
deliberately NOT the neon games aesthetic — cream on black, Inter, a gold
`#d6bd86` accent, glass panels — and that is the CD's call, not drift. Do not
"bring it in line" with `games/CLAUDE.md` § Code style.

## Layout — index.html is GENERATED

| Path | What it is |
|---|---|
| `src/` | **the source.** `page.html`, `style.css`, `game.js`, `world.js`, `audio.js`, `puzzle.js`, `vendor/three.module.min.js` |
| `build.mjs` | the bundler — `cd games/interlock && node build.mjs` (~1 s) |
| `index.html` | **generated, do NOT edit by hand.** Overwritten by `build.mjs` |
| `LICENSE` | **proprietary** — all rights reserved, play-only, with a carve-out for the bundled Three.js |

Edit `src/`, then rebuild. An edit made straight to `index.html` is gone the
next time anyone runs the build, and `.claude/tests/drive-interlock.cjs` goes
red on a page that does not match `src/` — that check exists because pinning
one line let an unbuilt edit through on the first try.

### Why a bundler at all

The repo wants one self-contained file per game and the smoke gate loads pages
over `file://`, where an ES module import is a CORS error and every page would
report RED. The shipped game is six ES modules. So `build.mjs` inlines the CSS
and concatenates the JS into one `<script type="module">`.

The one non-obvious part is **scope**. Three.js minifies to ~450 top-level
identifiers (`t`, `e`, `n`, `i`, `r`, `s`, …) and the game's own top level uses
several of the same letters — `const s` is the settings object. Concatenating
them flat is a `SyntaxError` on redeclaration. So:

- three stays at module top level, with its single trailing `export{a as B,…}`
  rewritten into `const THREE_NS={B:a,…}` (the namespace name is checked
  against the source, because `__THREE__` is already taken in there);
- the game's four modules go inside an IIFE that opens with `const T=THREE_NS;`,
  so its top-level names *shadow* three's instead of colliding with them.

`build.mjs` throws rather than emitting a broken page if any of its assumptions
break: more than one `export` in three, an unparsable export entry, a surviving
`import`/`export` after stripping, a `</script` in the bundle, or a missing or
ambiguous anchor in `page.html`.

### Three.js is a documented exception, not a precedent

`games/CLAUDE.md` says no external JS libraries, and wayfinder and mitochondria
both write their own WebGL rather than pull one in. Interlock arrived with
Three.js r169 already load-bearing (PBR materials, transmission, PMREM
environment, instancing) and rewriting that was not the commission. It is
bundled, pinned, MIT, and the only such case in `games/`. **A new game does not
get to cite this one.**

## Site chrome (added 2026-09-19)

Four buttons, top-left, standard geometry — 38x32, `z-index:80`, at
`left: 8 / 50 / 92 / 134` plus `env(safe-area-inset-left)`, `top: 6px +
env(safe-area-inset-top)`:

`←` back → `../index.html` · `🔊/🔇` mute · `↻` new puzzle · `⚙` settings

The **fill is the game's own** (`#17191b99`, `backdrop-filter: blur(16px)`,
`#ffffff26` hairline) rather than `var(--panel)`, because this game has no neon
palette to match. Geometry follows the SOP so the row sits where it does in
every other game; paint follows the game so it reads as part of the scene. The
settings gear kept its inline SVG and its `#settingsButton` id — it moved from
a 48px circle at 20/20 to the fourth slot in the row, and nothing else about
the dialog changed.

- **Mute** is a master override, not a slider: `s.muted` gates
  `master.gain` in `Sound.update()` and leaves the three sliders where the
  player left them, so unmuting restores the mix rather than a default. It
  persists in the same `interlock-settings` blob as everything else, and the
  icon is painted from storage at boot before the first frame.
- **Reload** generates a fresh puzzle at the *current* size — the way out of a
  board you do not like, not a level restart (there are no authored levels).
  It clears `animations` first: `newPuzzle()` disposes the meshes the frame
  loop is mid-way through sliding, and a leftover entry would keep writing
  positions to them.
- Both call `sound.start()` before anything else. On iOS the first gesture is
  usually one of these buttons, not the canvas.
- `visibilitychange` suspends/resumes the AudioContext (the repo's audio SOP).
  The 24-minute sky cycle is driven off `performance.now()`, so it catches up
  by itself when the tab comes back — that is by design, do not "fix" it.

## Generation and the gate

`src/puzzle.js` peels connected pieces along a clear axis while keeping the
remainder connected, so a solution exists by construction. Cube size is a step
function of piece count: 4³ under 9 pieces, 5³ under 15, 6³ to 20.

`.claude/tests/drive-interlock.cjs` (pure node, ~2 s, runs in `gates.sh`)
asserts, over 192 boards spanning every size 5–20 on a seeded RNG: exact piece
count, an exact partition of the cube (every cell once, nothing outside, every
piece a connected polycube), and a **complete collision-checked removal
sequence** using the game's own `canSlide`.

The solvability loop alone is worth nothing — a `canSlide` that always returns
true satisfies it trivially — so the suite opens with hand-built fixtures whose
answer is known: a 3-cube with a single centre cell is walled in on all six
sides, the shell around it is blocked by the core, the solver must call that
board stuck, and the same piece alone must slide every way. Every row of the
suite has been made to go red on purpose; keep it that way when adding one.

## Known, deliberate, or watched

- **Viewport measurement.** `fit()` sizes the renderer from
  `innerWidth/innerHeight` while the CSS box is `100vw/100dvh`, and `tap()`
  normalises pointer coordinates against `innerWidth/innerHeight` too. That is
  the two-coordinate-space shape `games/CLAUDE.md` § Canvas sizing warns about.
  `check-canvas-space.cjs` reports `SQUASH=1.000`, so it is not biting today,
  but if taps ever drift low on iOS this is the first place to look: the cure
  is one `getBoundingClientRect()` helper feeding both. There is also only a
  `resize` listener — no `orientationchange`/`visualViewport` reflow.
- **No score, no save beyond settings.** Progress is the current piece count,
  and it resets to the player's minimum on every visit. That is the design.
- Diagnostics: `window.interlock.state` (piece count, what remains, which
  pieces are free) and `window.interlock.audio` (live bus gains). Read-only,
  and the drive suite and any future browser check should use them rather than
  reaching into the IIFE.
