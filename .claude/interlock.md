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
report RED. The shipped game is four ES modules plus a vendored Three.js. So
`build.mjs` inlines the CSS
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

## Lighting, materials and the sky (CD brief, 2026-09-20)

The brief: **the only light sources are the sun and the moon, plus a low
ambient from the blue sky and clouds by day and a very low one at night, like
moonlight on terrain.** Everything below follows from that, and the thing to
hold on to when changing any of it is that **ambient is now a consequence of
the sky, not a number**. Brightening the night means changing the night sky or
the exposure curve. It never means adding a light.

### The rig

Two `DirectionalLight`s and nothing else. What they replaced: a
`HemisphereLight` at intensity 2, a second `DirectionalLight` "rim" at 2, and a
`scene.environment` baked from three white quads in a fake studio. Those lit
the cube from directions with nothing in them, which is why it never read as
being outdoors whichever background was picked.

- **sun** — colour and intensity driven by altitude; reddens through
  `setHSL(0.115 - low*0.085, ...)` as it sets, which is the only place the warm
  dusk comes from now.
- **moon** — directly opposite the sun, peak intensity **0.17**.
- **exactly one of them casts at a time**, switched on `sun.intensity > 0.05`,
  so only one shadow map is rendered per frame.
- **ambient** is `scene.environment`, a PMREM of the same sky shader the player
  is looking at, at `environmentIntensity` 0.82. Re-baked only when the sun has
  moved more than 0.018 in altitude — a couple of hundred times over a
  24-minute cycle rather than 86 000 — and the previous render target is
  disposed each time, because `fromScene()` allocates a new one.

`background: 'none'` is the one exception and it is deliberate: there is no sky
to justify any ambient, but a player who picked an empty background did not ask
for an unlit board. It pins a fixed daylight key and a dim neutral studio sky
that feeds the IBL only — the visible background stays pure black.

**Settled, do not re-open (CD, 2026-09-20).** This is the one place the
sun-and-moon rule is bent, so it reads as an open question to anyone auditing
the rig against the brief. It is not: the CD reviewed it on device and closed
it. Bending the rule here is the decision, not an oversight to correct.

### Shadows, and why AO matters more here

`PCFSoftShadowMap`, one 2048 map (1024 on a phone), an ortho camera of +-14
around the board — 73 texels a unit — with `bias -0.0004` and
`normalBias 0.022`. **Glass pieces do not cast**: three has no transmissive
shadows, and a nearly clear piece throwing a solid black silhouette looks worse
than it throwing none. Everything receives.

Measured, the shadow map only changes **0.35-0.44%** of the frame on a full
board, and that is correct rather than a bug: the pieces are flush faces of one
solid, so the only places anything can cast are the recesses. Its real moment
comes as the puzzle comes apart, when a crater has walls.

So the bigger half of "shadow quality" here is **ambient occlusion**, baked per
vertex from voxel occupancy (`vertexAO`, `AO_LEVEL`). A shadow map only darkens
what the sun is blocked from, and between two flush pieces the sun was never
reaching anyway — the seams were being filled in flat by the sky ambient, which
is exactly what AO is for. It is **recomputed on every removal**
(`rebuildAO()`), because a face buried in a crevice is genuinely out in the open
once the piece beside it has slid away; bake it once and the board keeps
painting shadows for pieces that are no longer there.

### Glass: why the other pieces were invisible

The CD's report was "I can see the background fine but I also want to see other
puzzle piece edges", and the cause is one line in three's renderer.
`WebGLRenderer` splits the render list into **opaque / transmissive /
transparent**, and the transmission pass renders the background plus **the
opaque list only** into the refraction target. The edge `LineSegments` were
`transparent: true, opacity: .25`, so they landed in the transparent list and
never reached that target — the sky behind the board came through perfectly and
the other pieces did not exist.

The fix is that **edge lines are opaque**, with the 0.25 alpha pre-blended into
their colour so the seams look as they did. Do not make them transparent again,
whatever it looks like in isolation.

The rest of the glass was retuned around it: `transmission` 0.72 -> **0.92**
(clearer), with the colour now coming from **absorption** —
`attenuationDistance` scales with the piece's own radius, so a chunky piece is
deeply saturated and a thin one is nearly water, which is the depth cue that
tells two overlapping pieces apart. Getting that wrong is very visible: the
first attempt at `radius * 0.85` turned Gold Honey into maroon and Blue Ice into
opaque plastic. `side: DoubleSide` helps refraction where three runs its
back-face pass, but **do not depend on it** — that pass is skipped entirely when
`WEBGL_multisampled_render_to_texture` is available, which is most phones.

`polygonOffset` on the piece material is load-bearing, not tidiness: the edge
geometry is coincident with the faces, so without pushing the filled surface
back a hair the lines lose the depth test and never draw at all.

### Two artifacts the CD caught on the old build, and one on this one

Both of the old build's lighting complaints came from the two things this
rewrite deletes, and they are worth naming because either is easy to
reintroduce.

- **"The light moves as if the sun were shining through the planet."**
  `sun.intensity = .25 + day * 3` never reached zero, and a `DirectionalLight`
  is not occluded by terrain, so the sun went on lighting the board all night
  from below the horizon. A specular highlight tracked it across a face that
  had no diffuse light on it at all. The sun's intensity now goes to **exactly
  0** below the horizon (`smoothstep(alt, -0.09, 0.22)`), and the gate asserts
  that.
- **"A stationary oval light source on the right face."** That was the studio
  environment: three emissive quads at fixed positions, reflected by every
  smooth material and never moving, whatever the hour. Gone with the studio.

The third one is this build's own, and the CD's note about the moon is what
exposed it: **the sun and moon discs must not go into the IBL probe.** They are
already in the scene as analytic lights, so baking them into the environment
counts them twice — and PMREM blurs a half-degree disc over several texels, so
the second copy arrives as a soft smear that reads as bloom haze on a smooth
face, which is exactly the artifact being complained about. The probe material
carries `#define PROBE` and skips both discs and the tight sun glow; the *wide*
mie haze stays in, because that really is sky luminance and it is what warms
the ambient at dawn and dusk. The moon's own halo was tightened from `pow(mm,
700)` to `pow(mm, 2200)` at the same time: a moon is a hard-edged disc, and a
soft glow around it reads as a lens artifact rather than as moonlight.

The general rule, for any light added later: **an analytic light and its image
in the environment map are the same photons.** Pick one.

### The sky

One shader (`SKY_FRAG`) draws the gradient, the sun disc and its mie glow, the
moon with faint maria, two drifting cloud decks and the stars — and the same
material on a small sphere is what PMREM reads, so the light in the scene and
the picture behind it can never disagree. It is **opaque, depth-tested, and
drawn last** (`renderOrder 1000`): opaque so it reaches the transmission target
(a sky of transparent sprites would vanish through a glass piece), drawn last
so early-z rejects every pixel the board and the terrain already cover.

Two bugs worth not repeating. The cloud decks' `scale` is in noise cells across
the deck; at 0.08 the whole sky sampled a single cell and the clouds came out as
one flat wash. And the sun sat at **+z**, behind the camera, so it never
appeared in the sky and lit the board flat-on.

### Terrain

A displaced heightfield with baked vertex colours (144^2, 96^2 on a phone),
replacing a flat plane and twenty-two random cones. Colour comes from height
**and slope**, which is what stops it reading as a painted gradient: steep faces
go to rock at any altitude.

Two shaping rules. `keep` holds the ground flat and low under the board so no
ridge can grow through the puzzle. And **`rim`** lifts the far field into hills:
without it the far edge of the ground plane IS the skyline, which reads as a
ruler-straight horizon however much relief is nearer in.

`PRESETS` is validated by `World.checkPresets()` at every `set()`, because a
missing field multiplies into a vertex position as `NaN` — which does not throw,
it produces a geometry with no bounding sphere and an empty screen. That is not
hypothetical: `beach` lost its `rim` to a bad search-and-replace during this
build and the only signal was a console warning.

### Cost

**This container renders WebGL on SwiftShader, so no absolute frame time
measured here means anything about a phone** — the *previous* build already
read 233 ms/frame. What is real is the relative share, bisected at iPhone 13 /
dpr 3: terrain, water and grass ~36%, the sky dome ~14%, shadow mapping ~5%,
the environment/IBL ~0%. The change as a whole costs about 1.21x the previous
build on that rasterizer. Shadows and IBL being nearly free is the useful
finding; the terrain is the thing to cut first if a real device struggles, and
`bigDevice` in the `World` constructor is the one knob (grid density, shadow map
size, grass and snow counts).

## The viewport — fixed 2026-09-19, and how it hid

`viewBox()` is the **only** place a layout number comes from. `fit()` sizes the
backing store from it and `tap()` normalises against it, offsets included; a
zero box (hidden, not yet laid out) falls back to the window rather than being
divided by. `reflow()` re-measures and is a strict no-op unless the box moved,
and it runs on `resize`, on `orientationchange` (thrice, because iOS can hand
the first one a stale box), on `visualViewport` resize/scroll, and **once per
frame** — the frame pass is what catches a box change that fires no event at
all, which is a row in the gate.

`renderer.setSize(w, h, false)` — the third argument is `updateStyle`. It must
stay `false`. With the default `true`, three.js writes `style.width/height` in
px, which pins the box to whatever `innerHeight` said at the last `resize`
instead of letting `100vw/100dvh` track the real viewport.

**How the original bug hid, which is the part worth remembering.**
`check-canvas-space.cjs` reported `CANVAS=ok ... SQUASH=1.000` and it meant
nothing. Two independent reasons, both of them documented behaviour of that
probe:

1. It **exempts** any canvas with an inline `style.width`/`style.height`
   (`pinned=inline-css`, its cure #2) — and three.js's `setSize()` had set
   exactly those, so Interlock was never measured. The exemption exists so the
   probe cannot prise apart what iOS cannot; here it hid a real 0.711 squash.
2. It shrinks the box with a **percentage** `max-height`, which resolves to
   `none` against this page's auto-height body. Even without the exemption it
   could not have moved this box.

So the probe was green for the wrong reason twice over. `SQUASH=1.000` with
`pinned=inline-css` in the row is not evidence — read the whole line. Since
the fix the row carries no `pinned=` tag, which means it is a real measurement.

The gate that does bite is `.claude/tests/drive-interlock-viewport.cjs`: it
pins the box in **px**, confirms box and window really are apart, and then
checks what actually matters — that a tap at the pixel a piece is *drawn* on
hits *that* piece. Its method is deliberately not circular: `ndcOf()` returns
camera-projection NDC with no viewport in it, the suite maps that through the
canvas rect it measured itself (the same mapping the browser composites with),
and `pick()` has to agree.

Two traps that suite fell into first, both fixed, both worth not repeating:
aiming at a piece's bounding-sphere centre can aim at a point a **neighbour
occludes**, so candidates are narrowed by asking `pick()` first; and asserting
that *a* piece was removed passes on the very bug being tested, because a tap
normalised by `innerHeight` in a shorter box lands on a piece **higher up**
that is often also free. The assertion has to be that the piece aimed at is
the piece that went.

## Known, deliberate, or watched

- **No score, no save beyond settings.** Progress is the current piece count,
  and it resets to the player's minimum on every visit. That is the design.
- Diagnostics. Read-only: `window.interlock.state` (piece count, what remains,
  which pieces are free), `.audio` (live bus gains), `.rig()` (every light, the
  shadow flags, the environment and the exposure), `.edges()`, `.box()` (the
  measured viewport), `.ndcOf(id)` (a piece's centre in camera NDC, no viewport
  in it) and `.pick(x, y)` (what is under a client point). Three **writers**,
  all test-only and called by nothing in the game: `.clock(sec)` winds the
  24-minute cycle, `.shadows(on)` and `.transmission(on)` toggle a feature. The
  writers exist so a gate can prove a rendering property **causally** — turn the
  feature off, see the pixels move — rather than comparing two materials and
  hoping the difference came from the thing under test. That is not theoretical:
  a cross-material comparison put opaque pine ABOVE two of the three glasses on
  interior detail, because wood grain is high-frequency too.
