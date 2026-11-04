# csstyles - Combat Simulator: a Graphics style selector, the toon style and the neon style (plan arc)

**Status:** PARTIALLY IMPLEMENTED. Steps 1-3 (CS-1, the selector and toon) landed on `main` 2026-11-02 as `7a3e760`, Pages deploy `success`. **Paused for quota in step 4.** Its unvalidated work (neon code, rows and breaks, partly run) is saved as commit `85bf3c2` on the remote branch `cs-styles-step4-wip`, not on `cs-styles` and not on `main`. To resume: run the handoff command at the end of this file; the overseer should cut its worktree from `main`, then `git fetch origin cs-styles-step4-wip && git cherry-pick 85bf3c2`, tell the step-4 implementer the WIP is unvalidated and partly run (re-read it, finish, re-run every step-4 break two at a time, gate alone at 76+), and continue from step 4. **Run after csparry** (`.claude/plans/csparry.parry-timing-strike-kinds.md`, planned 2026-11-03, first in the backlog by the CD's call): it adds engine rows to the suite, so re-derive every suite count here from the baseline at resume, and expect a possible conflict in `drive-combat-simulator.cjs` when cherry-picking `85bf3c2` (keep both sides). **csparry landed (CS-3, CS-4, 2026-11-03):** the suite is now 89 checks (44 + 45) and `negtests/combat-simulator.json` has 32 breaks, so re-derive every count here from that baseline on resume.
**Requested:** 2026-11-01. The CD answered the build's Look question with: "All three with selector in
settings menu. Default to realistic webgl. Its a lot so put items in backlog in a combat simulator
section and i can run "backlog-plan-gen" for them later." Realistic shipped (d92baba). The other two
were specified as backlog items **CS-1** (the selector and toon) and **CS-2** (neon) in
`.claude/combat-simulator.md` section "Backlog (the CD's answer on the look), specified for plan-gen".
This plan **bundles both TODO entries** (`[combat-sim]` CS-1 and CS-2 in `TODO.md` section Now). CS-2 was
"After CS-1" and shares every file with it, so it is steps 4-6 of this arc rather than a plan drafted
against code that steps 1-3 will rewrite. **CS-1 lands on `main` on its own at step 3**, so toon is
playable even if the neon half stalls.
**Scope:** `games/combat-simulator/index.html` (the settings panel, `SETTINGS`, the shaders, the
arena mesh builder, `initGL()`, `render()`, the `__CS` hook), `.claude/tests/drive-combat-simulator.cjs`
(part 2 and one part 1 row), `.claude/tests/negtests/combat-simulator.json` and a new
`.claude/tests/negtests/combat-simulator-styles.json`, `.claude/combat-simulator.md`,
`.claude/tests/README.md`, `.claude/games-index.md`, `games/index.html` (the `GAMES[]` facets only),
`games/CLAUDE.md` (the inventory paragraph), `CLAUDE.md` (the context-file row), `TODO.md`, `DONE.md`.
**The `ENGINE` block (`index.html:101-391`) is out of scope and must not change by one byte.**

## Goal

The settings' PICTURE section opens with a `Graphics style` dropdown: `realistic` (the default, the
shipped look, pixel for pixel), `toon` (cel-shaded in three bands, ink outlines round the fighters and
the courtyard, a saturated flat palette, a two-colour sky, a solid white blade crescent, star-burst
sparks) and `neon` (the site's Neon Arcade palette in 3D: a dark courtyard drawn in glowing lines, the
fighters dark with green and red rims, a white-hot blade, a cheap bloom). The pick is saved, applies on
the next frame mid-duel, and changes nothing about the fight: a fixed-seed duel steps to byte-identical
fighters under every style with real frames drawn between the ticks.

## Context

Combat Simulator is the repo's second hand-written WebGL2 game (`.claude/combat-simulator.md`
section Architecture): one material-switched arena shader, about 25 instanced tapered capsules per
fighter, one shadow map, additive trails, rings and sparks, about 12 draw calls a frame. It already
has a quality select (`Graphics`: low / medium / high, `SETTINGS.gfx`) that is **not** the style and
stays as it is. Three games here already carry art styles (`art-styles` facet: Neon Clash, Turret
Builder, Star Surge), all Canvas 2D; the shared rules for them are in `games/CLAUDE.md` row "Graphics
styles": **a skin is paint**, assert it by playing one deterministic scenario per style **with real
frames drawn between the ticks**, and keep identity counters out of the snapshot. This is the first
style system on a WebGL page, so its mechanism (one program set per style, compiled from the same
sources under a `#define`) is new here and is written down in step 3.

## The design (decided here; a choice the steps leave open goes into `.claude/combat-simulator.md` as an assumed row, never silently)

### Styles, settings and the selector

- `const STYLES = ['realistic', 'toon']` beside `SETTINGS` (`index.html:394-397`); step 4 appends
  `'neon'`. `SETTINGS` gains `style: 'realistic'`. After the load at `:396`, validate:
  `if (!STYLES.includes(SETTINGS.style)) SETTINGS.style = 'realistic';` (an old save without the key,
  or a junk value, reads realistic).
- The dropdown is **written in the HTML**, not generated from `STYLES` (otherwise the "offers exactly
  these" row would be tautological). It is the first row under `<h3>PICTURE</h3>` (`:75`), above the
  existing Graphics row (`:76-77`):
  `<div class="row"><label for="style-sel">Graphics style</label><select id="style-sel"><option value="realistic">realistic</option><option value="toon">toon</option></select></div>`
  Labels lowercase, like the existing options. Do not rename the existing `Graphics` row.
- Wire it beside `gfxSel` (`:1757-1760`): set its value from `SETTINGS.style`, listen for **`change`**
  (never a tap helper: `games/CLAUDE.md` row "Native form controls"), set `SETTINGS.style`, `saveSettings()`,
  nothing else. The next `render()` picks the style up. No reload, no `startDuel()`.
- `render()` reads the style once per frame into a local `look` and uses it for everything it draws.
  **Nothing else reads `SETTINGS.style`**: not the engine (it cannot, it is DOM-free and lifted into
  node), not `update()`, not `stepEffects()`, not the HUD (the HUD keeps its look and layout in every
  style: decided, the spec says only that the controls keep their layout).

### One program set per style, from the same sources

- Every shader string starts `#version 300 es` then a newline. `withStyle(src, n)` inserts
  `#define STYLE n` after that line and **throws if the line is not found** (count the replacement).
  `compile()` (`:692-706`) is unchanged; callers pass `withStyle(...)`.
- `PROGS = {}` and `progsFor(look)`: compiles (once, lazily, on first use) `world`, `limb`, `sky`,
  `glow` and, for toon and neon, the two ink programs (below) with `STYLE` 0 / 1 / 2 for realistic /
  toon / neon; the shadow and `flat` programs are compiled once and shared by every set. `initGL()`
  (`:836-881`) builds realistic's set exactly as today, so boot cost does not grow. `render()` starts
  with `const look = SETTINGS.style, P = progsFor(look);` and uses `P.*` where it used `PRG.*`.
- In GLSL, every style difference is an `#if STYLE == 1` / `#elif STYLE == 2` / `#else` block. The
  realistic program is therefore compiled from exactly today's code, which is what makes "realistic is
  untouched" provable (step 1's one-off pixel comparison, step 2's ink row, step 5's bloom row).

### Toon (step 1: shading; step 2: ink)

- **Albedo**: per material, the flat `vCol` with no noise, then pushed in saturation:
  `vec3 satp(vec3 c, float k){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return clamp(mix(vec3(l), c, k), 0.0, 1.0); }`
  with `k = 1.6`. The flagstones (`m == 0`, `:533-548`) keep their joint pattern as a flat darker
  line (the `mortar` term) and drop the `h21`/`vn` tone noise; gravel keeps its furrows as two flat
  tones; every other material is flat. Fighters keep each opponent's gi / hakama hue (`LOOK`,
  `:1053-1060`; `lookFor()`), saturated the same way.
- **Light in three bands with a hard terminator**: a `shadeToon(P, N, V, alb, sp, ao)` in
  `GLSL_COMMON` (`:449-515`) beside `shade()` (`:491`): `k = ndl * shadowAt(...)` (no wrap), banded
  `k > 0.55 ? 1.0 : k > 0.12 ? 0.55 : 0.0`; ambient as today but flat (no `N.y` gradient) and floored
  so a dusk duel still reads (start at `max(amb, uKeyCol * 0.18 + 0.12)` and tune by eye at ranks 1, 5
  and 10); the lanterns' light banded in two steps; **no specular and no sky reflection**, except the
  blade (`FS_LIMB` `m == 2`, `:619-621`): one hard highlight, `step(0.985, dot(N, H))` in white.
  The cool rim at `:631` is off in toon. Tonemap as today, then `satp(…, 1.15)`.
- **Sky** (`FS_SKY`, `:653-671`): two colours, taken from today's `skyCol()` at the zenith and at the
  horizon (so dawn-to-dusk by rank still holds), blended smoothly by height; clouds as a hard
  threshold of the same noise in one flat tint; the sun a flat disc; the two mountain ranges as flat
  silhouettes in two tones. Fog in `FS_WORLD` (`:580-582`) mixes toward the same horizon colour.
- **Effects** (in `render()`'s additive section, `:1416-1454`): toon's trail is a **solid white
  crescent**: every vertex white at alpha 0.9 (the inner edge too), drawn with
  `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`, which needs `FS_FLAT` (`:689-690`) to write alpha `vC.a`
  instead of `1.0` (harmless for the additive styles: with `ONE, ONE` and a context made with
  `alpha: false`, `:436`, source alpha is never read or shown). Power rings keep their additive draw.
  Sparks (`FS_GLOW`, `:679-682`) under `STYLE == 1` are **star bursts**: a solid five-point star
  (`r < 0.32 + 0.68 * pow(abs(cos(atan(vQ.y, vQ.x) * 2.5)), 6.0)`), the particle colour at full
  strength, crisp edge.
- **Ink (step 2): inverted hulls, drawn by discarding by normal, not by culling.** Culling is off
  everywhere in this renderer (`:1383`) and the winding was never checked; worse, by derivation
  `VS_LIMB`'s frame `(u, ax, v)` (`:594-597`) is **left-handed** (`v = cross(ax, u)`, so
  `u x ax = -v`), so the capsules' outward faces wind clockwise and a "cull front faces" hull would
  cover the fighter in black. Derived, not measured: do not switch to `gl.cullFace` without measuring.
  The hull pass instead pushes each vertex out along its outward direction by the ink width and the
  fragment shader **discards every fragment whose outward normal faces the eye**
  (`if (dot(N, uEye - P) > 0.0) discard;`), which is winding-independent: what is left is the far
  shell, which depth-tests behind the body except in a thin band at the silhouette.
  - **Width is screen-constant**: `w = uInk * length(uEye - base)` with
    `uInk = inkPx * 2 * tan(CAM.fov / 2) / (ph / dpr)` (CSS px; `CAM.fov` `:1113`, `ph`/`dpr` in
    `render()`). Toon `inkPx = 1.5` (the spec's "r + 0.012 m" is about 1.5 px at the duel's camera
    distance; a constant world width would vanish on the wall 17 m away). The same width for the
    blade (decided: a black-edged blade is the toon look).
  - **Fighters**: `VS_INK_LIMB` = `VS_LIMB`'s body with `r = mix(iR.x, iR.y, aEnd) + w` (no shadow
    coordinate, no colour varying) and `FS_INK` (the discard, then a flat ink colour uniform, toon
    `#0d0b10`). One instanced draw over all capsules, after the fighters' colour draws.
  - **Arena**: a new per-vertex attribute **`aExt`** (vec3, location 4), the direction a vertex moves
    by one unit of ink, chosen as a **function of the corner alone** so the shell closes. The mesh
    builder (`:709-743`) goes from 10 floats a vertex to 13 (stride 40 -> 52; update `initGL()`'s four
    pointers at `:847-850` and add the fifth): `vert(mb, p, nr, c, m, ext)` with `ext` defaulting to
    `[0, 0, 0]`. `box()` (`:718-725`): `ext = sx * X + sy * Y + sz * Z` for the corner's signs and the
    box's local axes (every face then moves out by exactly one unit). `cyl()` (`:726-737`): a side
    vertex's ext is its radial unit `[c, 0, s]` plus `[0, -1, 0]` on the bottom ring and `[0, +1, 0]`
    on the top ring; a cap vertex the same as the top ring's (centre: `[0, 1, 0]`). `quad()` keeps 0
    unless its caller passes one; the floor disc (`:750-752`) and both `annulus()` calls (`:756-757`)
    stay 0, so the ground grows no shell (its shell's faces point down, are discarded or never seen).
    `VS_INK_WORLD` moves `aPos + aExt * w`; `FS_INK` as above. One draw of the whole arena mesh.
  - The shadow program (`VS_SH_WORLD`, `:634-635`) reads location 0 only and needs no change beyond
    the new stride, which lives in the VAO.

### Neon (step 4: the look; step 5: the bloom)

- The palette is `games/CLAUDE.md`'s: `--bg #06060e`, green `#39ff14`, red `#ff2244`, gold `#ffc300`,
  blue `#4488ff`, purple `#b44fff`, white `#dde3ff`. **Neon is computed in display space with no
  tonemap**, so those hues land on screen as written (the hue row depends on it).
- **Courtyard**: every material's body is near-black (`vCol * 0.05` over `#06060e`); the flagstone
  joints (the `mortar` term) glow **blue**; the paper lanterns (`m == 4`) glow **gold** at every rank;
  sky: `#06060e` at the zenith to a dark purple at the horizon, the two mountain ranges as thin
  glowing **purple** lines where `d.y` crosses each range's height (`fwidth`-wide), a few stars kept.
  Fog mixes toward `#06060e`.
- **Edges**: step 2's ink pass, drawn in an emissive colour per material and 2 px wide: plaster, tile
  and stone (`m == 9, 7, 2`) **purple**, the torii's lacquer (`m == 8`) **gold**, the lanterns' paper
  (`m == 4`) gold, trunks and foliage (`m == 3, 6`) blue at 40%. `FS_INK` under `STYLE == 2` reads a
  `flat in int vMat` from `VS_INK_WORLD` for this. (Silhouette and depth-step lines, not every box
  edge: decided; every edge would need a face-uv attribute, see Follow-ups.)
- **No sun shadows**: skip the shadow pass's two draws (`:1385-1388`) when `look === 'neon'` (keep
  computing `shVP`; it is a uniform) and set `uShadowOn` 0 (`setCommon`, `:1349`). Instead a faint
  **ground glow** under each fighter: `flatRing(f.x, f.z, 0, 0.7, [r, g, b, 0.14], 32)` in the
  fighter's colour, additive.
- **Fighters**: `FS_LIMB` under `STYLE == 2`: a dark body (`vCol * 0.06`) plus a rim
  `uRim * pow(1 - max(dot(N, V), 0), 2.2) * 1.4`; the blade (`m == 2`) white-hot
  (`vec3(1.0, 0.97, 0.92)` plus `uGlow`). `uRim` is a new uniform set in the per-fighter loop
  (`:1409-1414`): **you green, the opponent red**. The edges are the fighter ink pass drawn **per
  fighter** in that fighter's colour (the same per-fighter attribute offsets the colour loop uses,
  `:1412`), 2 px.
- **Effects**: trails in the fighter's colour (power: gold) at twice today's alpha (`0.45 -> 0.9`,
  `:1423`), sparks half again as large (`:1447`), additive as today.
- **Bloom (step 5)**, the cheap way that keeps the default framebuffer's MSAA: after the main pass,
  draw **the same scene again into a quarter-resolution target**, bright-pass and blur it there, and
  add it back over the frame.
  - Refactor first: move `render()`'s main-pass body (`:1393-1454`, sky through sparks) **verbatim**
    into `drawScene(look, P)` and call it; the gate must stay green on that refactor alone before any
    bloom code exists (commit it inside the step, or check it, but prove it).
  - `BLOOM = { w, h, texA, fbA, rbDepth, texB, fbB }`, created on first neon frame and re-created when
    `ceil(pw / 4)` or `ceil(ph / 4)` changes: RGBA8 textures, LINEAR, CLAMP_TO_EDGE; `fbA` has `texA`
    plus a depth renderbuffer, `fbB` only `texB`.
  - Per neon frame: bind `fbA`, viewport `(w, h)`, clear, `drawScene(look, P)`; full-screen pass
    `fbA -> fbB` horizontal 9-tap gaussian with a bright-pass `max(c - 0.45, 0) / 0.55`; `fbB -> fbA`
    vertical, no threshold; bind the default framebuffer, full viewport, **`DEPTH_TEST` disabled**,
    `blendFunc(ONE, ONE)`, add `texA * 0.9`. Restore depth test, depth mask and blend after.
  - The full-screen passes use a `VS_POST` like `VS_SKY` (`:650-652`: a triangle from `gl_VertexID`,
    no attributes, `SKYVAO`) writing `vUV = p * 0.5 + 0.5`.

### Test hooks and knobs

Added to `window.__CS` (`:1808-1816`): `STYLES`; `setStyle(s)` (sets `SETTINGS.style` and the
select's value, no save: rows that test saving go through the select's `change`); `draw()` (renders one
frame **now**, synchronously, with `FRAME_DT` 0, `CAM.init = false` and `CAM.shake = 0`, so two draws
of the same state are the same picture; restore `FRAME_DT` after); `pixels(x, y, w, h)` (calls `draw()`
then `gl.readPixels` in the same task and returns the RGBA bytes; **GL rows run bottom-up**:
`gy = ph - (y + h)` in device px); `glError()` (`gl.getError()`); `PARTS`; and `FX = { ink: true,
bloom: true }`, test-only switches read by `render()` so a row can toggle a pass **in the live page**
(`games/CLAUDE.md` row "A check that can skip": toggle a feature in one page, never diff two loads).
Every pixel comparison renders all its variants **inside one `page.evaluate`**, because the rAF loop
keeps drawing between evaluates.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md` section
Plans). One task per arc step; each is one session's work and one commit on `cs-styles`.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Selector, `SETTINGS.style`, program sets per style, toon shading (world, limbs, sky, trails, sparks), the hooks; 10 rows; breaks | cross-system | opus | high | GLSL across five shaders, the settings and the render loop at once; the paint-invariance scenario and the band-count measurement need judgment about what a frozen frame is |
| 2 | Toon ink: `aExt` in the mesh builder, the two hull programs, discard by normal, screen-constant width; 3 rows; breaks | rendering | opus | high | a vertex-format change under a static mesh, a shell that must close, and a winding trap the plan only derived |
| 3 | CS-1 docs, the facet, badge, **land CS-1 on `main`**, verify Pages | docs | sonnet | high | long but mechanical: every count and name read from the code; the landing is the documented procedure |
| 4 | Neon look: selector option, palette in display space, glowing joints and edges, rims, ground glow, no shadow pass, stronger effects; 2 rows (+1 restated); breaks | rendering | opus | high | per-material emissive design in GLSL and the per-fighter edge pass; a hue measurement that has to bite |
| 5 | Bloom: `drawScene()` refactor, quarter-res target, blur, composite, resize; 3 rows; breaks | rendering | opus | high | framebuffer state (depth, blend, viewport) restored exactly or the next frame breaks in a way no row names |
| 6 | Docs final, both break lists in full, badge, land on `main`, Pages, report | docs | sonnet | high | mechanical, but runs ~40 breaks in chunks and must trace any MISSED rather than delete it |

- **Ordering / dependencies:** strictly 1 -> 2 -> 3 -> 4 -> 5 -> 6 (one file; each step builds on the
  last). Parallel-safe: none.
- **Files owned per task:** 1, 2, 4, 5: `games/combat-simulator/index.html` (never the `ENGINE`
  block), `.claude/tests/drive-combat-simulator.cjs`, `.claude/tests/negtests/combat-simulator-styles.json`;
  3 and 6: the docs named in Scope, the badge line, `TODO.md` / `DONE.md`, this plan.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/combat-simulator/index.html`
  after every edit; the suite green with its new rows; `.claude/scripts/gates.sh games/combat-simulator/index.html`
  GREEN at the end of every step; the step's new breaks all caught.
- **Suite counts** (re-derive each time as baseline + added - removed, and state it in Results):
  61 today -> step 1 adds 10 (71) -> step 2 adds 3 (74) -> step 4 adds 2 and restates 1 (76) ->
  step 5 adds 3 (79). If a step needs another row, add it and say so; never remove one to go green.
- **Tier audit (required):** no step passes a haiku checklist. 1, 2, 4, 5 are GLSL and GL state with
  no verbatim spec for most lines (opus, high: shader judgment plus measurements that must bite). 3 and
  6 must read every count and name out of the code and run the landing and Pages procedure exactly
  (sonnet, high).
- **Decision defaults:** everything under "The design" above. Beyond it: if a look choice is open
  (a colour, a band threshold, a width), pick, record it as an assumed row in
  `.claude/combat-simulator.md`, and move on: the CD auditions the look. Prefer the existing pattern
  (`flatRing`, the per-fighter attribute offsets, `setCommon`'s guards). A suite row the new code
  contradicts is **restated** (same claim, the new list), named in Results, never deleted. If a
  measured threshold is needed (band counts, luminance), measure on the unbroken page first, set the
  threshold with a margin, and prove it bites with a break.
- **Embedded-content QA:** the line numbers here were read on `a3c97c4` (the page is unchanged since
  `d92baba`); re-read before editing, since every step moves lines. The GLSL fragments in "The design"
  are shapes to follow, not code to paste unread; the counts above are the invariant.
- **Escalation triggers** (stop and report to the CD): the engine block would have to change; the
  realistic frame cannot be kept pixel-identical; the bloom adds more draw calls than neon's own main
  pass plus four (record calls per style from `PERF.out.calls` in Results); a WebGL2 feature this needs
  (renderbuffer depth, RGBA8 render targets) fails under SwiftShader in a way that suggests it would
  fail on iOS Safari.
- **Playtest** (after step 3, toon; after step 6, neon): open the settings, pick each style mid-duel and
  close: does toon read as cel-shaded with clean ink at rank 1 (morning) and rank 10 (dusk)? Is the
  blade's white crescent readable as a timing cue? Do the star sparks feel right? Does neon read as the
  site's arcade look, are green you and red them clear at a glance, is the bloom too much or too little
  (`0.9` strength and the `0.45` threshold are guesses)? Does the frame rate hold on your phone in each
  style (the FPS counter is on by default)?
- **Publish:** step 3 and step 6 each land on `main` (the publish) and verify the Pages run (producer
  config section Publish). Steps 1, 2, 4, 5 push the branch only.
- **Commit strategy:** one conventional commit per step on `cs-styles`, scope `combat-simulator`,
  ending "(csstyles step N)". Steps 3 and 6 land the branch on `main` as one commit each with
  `.claude/scripts/land-on-main.sh cs-styles <message-file>` (dry-run first); landing twice from one
  branch is fine (the second commit's diff is only steps 4-6).

## Resume here (a session told "run the next open step of this arc")

1. Read `CLAUDE.md` (concurrent sessions push to `main`; never author a merge commit on `main`;
   `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main` immediately before any
   push to `main`).
2. Read this file in full, every step's Results included.
3. Read `.claude/combat-simulator.md` (Architecture, Backlog CS-1 and CS-2, Tests) and `games/CLAUDE.md`
   rows "Graphics styles", "Reading pixels back (checks)", "A check that can skip" and "Editing a
   large single-file game".
4. Check out `cs-styles` (create it from `main` at step 1). Run the first step not ticked DONE, and only
   that one. Then tick it, append a Results section (append, never rewrite), commit, push the branch
   (`git push origin cs-styles`), stop and report. **Never push to `main` except at steps 3 and 6.**

Tools:
- Gates: `.claude/scripts/gates.sh games/combat-simulator/index.html` (it finds `playwright-core`
  itself); `node .claude/scripts/check-inline-js.cjs games/combat-simulator/index.html` after every edit.
- Breaks on copies, after the suite has run once green on the unbroken page:
  `python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/combat-simulator-styles.json --page-env CS_PAGE --jobs 2 --freeze .claude/tests/drive-combat-simulator.cjs -- node .claude/tests/drive-combat-simulator.cjs`
  (`--only a,b` for a subset; run chunks under ~9 minutes, `.claude/zmh/producer.md` section
  Environment). Every break's `new` carries `/* @negtest */` (a `//` comment broke parsing last time),
  and its `old` must be found exactly once.
- Badge: `.claude/scripts/stamp-badge.sh games/combat-simulator/index.html`, then read the stamp back out
  of the file (`games/CLAUDE.md` section Build Timestamp Badge).

## Steps (one per session, then `/compact`; each ends: tick here, Results, commit to `cs-styles`, push the branch)

| Step | What | Status |
|---|---|---|
| 1 | Selector, styles, toon shading, hooks | DONE 2026-11-02 |
| 2 | Toon ink | DONE 2026-11-02 |
| 3 | CS-1 docs, land, Pages | DONE 2026-11-02 (landed `7a3e760`, Pages success) |
| 4 | Neon look | paused, WIP `85bf3c2` on `cs-styles-step4-wip` |
| 5 | Bloom | open |
| 6 | Docs final, break lists, land, Pages | open |

### Step 1 - the selector, program sets per style, toon shading, the hooks

Build "Styles, settings and the selector", "One program set per style", toon's albedo, bands, sky and
effects (not its ink), and the hooks and `FX` knobs (`FX.ink` and `FX.bloom` exist from now on;
`render()` ignores them until steps 2 and 5).

**Before any edit, take a realistic baseline**: on the unchanged page, `startDuel(3, 4242)`, step the
intro and 2 s of fight with taps, then through one `page.evaluate` draw a frozen frame (dt 0, camera
snapped, `CAM.shake = 0`) and save its readPixels hash; after the step, the same procedure with
`style = 'realistic'` must give **the same hash**. This is a one-off proof (it needs the old page), not
a suite row: write both hashes in Results. If SwiftShader is not deterministic across two loads of the
same unchanged page (try it twice first), say so and fall back to comparing the realistic program's
GLSL text before and after (`STYLE 0` must compile from exactly today's source).

Rows (part 2 unless noted; 61 -> 71):
1. (part 1) **the engine never sees a style**: `!/style/i.test(ENG)` beside the DOM-free row
   (`drive-combat-simulator.cjs:44`). The engine text has no "style" today (checked).
2. With nothing stored, `SETTINGS.style === 'realistic'` and `#style-sel` reads `realistic`. (The suite's
   context starts empty, `:209`; take this at boot, before any row stores settings.)
3. `#style-sel` offers exactly `['realistic', 'toon']`, in that order (a literal in the suite).
4. Choosing toon **through the select** (`value = 'toon'`, dispatch `change`) sets `SETTINGS.style`,
   stores `"style":"toon"` under `combatSimulator.settings.v1`, and **the next draw differs** from a
   realistic draw of the same frozen state, while `__CS.F` is the same object and `F.t` has not moved
   (no new duel, no reload).
5. After `page.reload()`, the style is still toon and the select reads toon.
6. A stored settings object **without** `style`, and one with `style: 'chalk'`, both load as realistic
   (two reloads; restore realistic and reload once more at the end of the section).
7. **A skin is paint**: for each shipped style, `startDuel(5, 777)`, `setPaused(true)`, 1,200 ticks of
   1/120 with `press('atk')` every 30 ticks and `__CS.draw()` every 4 ticks (`__CS.stick(0, 0)` and
   no keys first: with the stick at rest the camera, which `render()` moves, never reaches
   `playerIntent()`, `:1270-1279`); snapshot
   `JSON.stringify({ p: F.p, e: F.e, ai: F.ai, t: F.t, nextAtk: F.nextAtk, r: F.rng() })`. All
   snapshots byte-identical. (`F.nextAtk` is per fight, `:185`, so it is safe to keep.)
8. **A switch mid-duel changes nothing**: the same scenario in realistic, and again switching to every
   other style at tick 600; snapshots identical.
9. **Toon is banded**: a frozen frame per style with both fighters in view (`F.p` at z -1.5, `F.e` at
   z 1.5, both `free`); read a box on the opponent's torso (`project([F.e.x, 1.25, F.e.z])`, 12 x 40
   CSS px), quantise luminance to 64 levels and count levels holding at least 3 pixels: toon's count
   is at most half of realistic's (measure both on the unbroken page first; if the ratio is not
   clearly below 0.5, tighten the toon bands rather than the row).
10. **Every element at once, every style, no GL error**: `F.e.st = 'power'` in its wind-up, a trail
    (a real cut stepped to its active window), 40 sparks pushed into `__CS.PARTS`; for each style,
    `draw()`, then `glError() === 0` and the frame is not a single colour.
Then restore realistic.

Breaks (new list `.claude/tests/negtests/combat-simulator-styles.json`; each caught by its own row):
`style-engine` (the engine reads `typeof SETTINGS` and nudges a timing under toon: rows 1 and 7),
`style-render-writes-fighter` (`render()` adds 1e-9 to `F.p.x` under toon: row 7), `style-default-toon`,
`style-option-missing`, `style-not-saved`, `style-needs-reload` (the change handler only saves; render
reads a copy taken at boot), `style-junk-kept` (no validation), `style-toon-unbanded` (toon calls the
realistic `shade()`), `style-switch-new-duel` (the handler calls `startDuel`).

### Step 2 - toon ink

Build "Ink" under Toon: `aExt` and the 13-float vertex, the two hull programs, the passes (arena hull
after the arena draw; fighter hull after the fighters' colour draws, `:1404-1415`), gated on
`look === 'toon' && FX.ink` (step 4 extends it to neon).

Rows (74):
1. **Ink round a fighter**: one evaluate, toon, `FX.ink` on and off on the same frozen frame; near-black
   pixels (all channels < 30) in the opponent's projected bounding box rise by at least a margin you
   set from the measurement (expect hundreds at 844x390).
2. **Ink round the courtyard**: the same toggle, counted over the frame **outside** both fighters'
   boxes (the wall's cap line, the torii, the lanterns), rises by a measured margin.
3. **Realistic is untouched by the ink**: realistic frames with `FX.ink` true and false are
   byte-identical (the pass never runs outside toon).

Breaks: `ink-off-fighters`, `ink-off-arena`, `ink-in-realistic`, `ink-ext-zero` (every `ext` left 0: the
arena shell collapses onto the mesh and is discarded), `ink-cull-not-discard` (the pass uses
`gl.cullFace(gl.FRONT)` without the discard: the derivation says it paints the fighter's front black;
**if this break is caught by row 1 the wrong way round (more black, not less) or not at all, record what
was measured: it is the evidence for or against the left-handed frame**).

### Step 3 - CS-1 docs, the facet, land CS-1, verify Pages

- `.claude/combat-simulator.md`: a section "Graphics styles" (the selector, `STYLES`, `withStyle` and
  `progsFor`, toon's bands, the ink by discard and why not culling, `aExt` and the 13-float vertex, the
  hooks and `FX`); new assumed rows for every look choice made in steps 1-2; the Backlog section's CS-1
  marked shipped (date, commit) and CS-2 left as the open half; the Tests section's count and new rows.
- `.claude/tests/README.md` row for `drive-combat-simulator.cjs` (`:309`): the count and the style rows.
- **Facet**: add `art-styles` to Combat Simulator's mechanics in `.claude/games-index.md` (`:33`) and in
  `games/index.html`'s `GAMES[]` entry (`:654`), then `node .claude/scripts/check-games-sync.cjs`
  (GAMES-SYNC: GREEN). Add Combat Simulator to the `art-styles` paragraph (`games-index.md:420-426`) as
  the first WebGL page with styles. Restamp `games/index.html`'s badge too, since it changed.
- `games/CLAUDE.md` Combat Simulator inventory paragraph and the `CLAUDE.md` context-file row: one clause
  each ("a Graphics style selector: realistic, toon").
- `TODO.md`: the entry stays (CS-2 is still open) but says CS-1 shipped with the badge; `DONE.md`: a CS-1
  line.
- Stamp the badge, run `gates.sh`, commit (step 3), push the branch, then land:
  `.claude/scripts/land-on-main.sh cs-styles <msg> --dry-run`, then for real; if it reports `behind`,
  merge `origin/main` into `cs-styles`, re-run the gates, land again. Verify the Pages run for the
  landed SHA (producer config section Publish: `mcp__github__actions_list`, `perPage: 1`, match
  `head_sha`, read the jobs). Quote the badge read back from the file.

### Step 4 - the neon look

Build everything under Neon except the bloom: the `neon` option (HTML and `STYLES`), the display-space
palette, the courtyard's glowing joints, lanterns and sky, the ink pass reused as emissive edges per
material, rims, the per-fighter edge pass in green and red, the ground glow, no shadow pass, stronger
trails and sparks.

Rows (76):
- **Restated**: step 1's row 3 now offers exactly `['realistic', 'toon', 'neon']`. Rows 7, 8 and 10
  already loop over the shipped styles; check that they now include neon (their detail lists the styles).
1. **Neon is dark and its light is the palette**: a frozen neon frame; mean luminance below a measured
   ceiling (expect under 0.12), and of the brightest 2% of pixels at least 85% sit within 25 degrees of
   hue of green, red, blue, purple or gold, or are near-white (the blade, sparks).
2. **You are green, they are red**: in each fighter's projected box, the mean colour of its brightest
   10% of pixels has green over 1.5x red and blue for you, red over 1.5x green and blue for them.

Breaks: `neon-tonemapped` (the filmic tonemap left on: hues drift), `neon-rims-same` (both fighters'
`uRim` green), `neon-bright-arena` (the realistic albedo kept), `neon-option-missing`, `neon-shadows-on`
(the shadow pass still runs: caught only if a row reads it; if no row catches it, add one that counts
`PERF` draw calls in neon against toon, or record it as accepted and why).

### Step 5 - the bloom

First the `drawScene(look, P)` refactor alone, gates green; then `BLOOM`, the two blur passes, the
composite, the resize.

Rows (79):
1. **Bloom adds a halo**: neon, `FX.bloom` on and off on the same frozen frame: the frame's summed
   luminance rises by at least a measured margin, and the count of mid-bright pixels (luminance 0.08-0.4)
   within 6 px of the brightest ones rises.
2. **Bloom is neon's alone**: realistic and toon frames byte-identical with `FX.bloom` true and false.
3. **The target follows the screen**: neon, change the viewport (844x390 -> 390x844 -> back), draw
   after each: `glError() === 0` and the bloom target is `ceil(pw / 4) x ceil(ph / 4)` (expose `BLOOM`
   through `__CS`).

Breaks: `bloom-off`, `bloom-everywhere` (bloom not gated on neon), `bloom-no-resize`, `bloom-depth-on`
(the composite leaves `DEPTH_TEST` on: the halo vanishes behind the scene's depth), `bloom-state-leak`
(the composite leaves blending on, which breaks the next frame's arena: if no row sees it, add one that
draws neon then realistic and requires realistic's frame to match a realistic-only draw).

### Step 6 - docs final, the break lists in full, land, verify Pages

- Run **both** break lists in full on the final page, in chunks: `combat-simulator-styles.json` (all
  steps' breaks) and `combat-simulator.json` (the 19 breaks the game shipped with; committed by the
  plan-gen sweep that wrote this plan, since they had lived only in a scratchpad). An `old` anchor that
  no longer matches exactly once is updated to the current code **with the same intent**, never
  dropped. The list's first run caught five of them only by a suite timeout (`ring-never-closes`,
  `ring-no-flash`, `menu-no-pause`, `ladder-no-advance`, `buttons-crowded`); after the suite's
  wait-on-frames fixes all 19 were caught by their own rows. If a timeout catches one again, the
  runner reports it as `CAUGHT-BY-CRASH`: trace it rather than count it.
- `.claude/combat-simulator.md`: the Graphics styles section completed for neon and the bloom; neon's
  assumed rows; Backlog CS-2 shipped; Tests count, rows and both negative-test lists with their counts.
  `.claude/tests/README.md`, `games/CLAUDE.md`, `CLAUDE.md` row: "realistic, toon and neon".
- `TODO.md`: remove the entry; `DONE.md`: a CS-2 line. This plan: Status `IMPLEMENTED <date>
  (<range>)`; move it to `.claude/plans/DONE/` with its follow-up file if one was written.
- Stamp the badge, gates, commit (step 6), push the branch, land on `main` as in step 3, verify Pages,
  report with the badge read back from the file.

## Gotchas / bindings

- **The engine block does not change.** The suite lifts `ENGINE:BEGIN..END` into node (`drive-combat-simulator.cjs:31-34`); a
  `git diff` of that span must be empty at every step.
- **`__CS.tick()` never renders** (`index.html:1812`): it calls `update()` only. A paint-invariance row
  that only ticks proves nothing about the renderer; call `__CS.draw()` between ticks.
- **The rAF loop keeps drawing between `page.evaluate`s**, with a real `dt`, moving the camera and the
  feet. Freeze by doing every variant of a comparison inside one evaluate through `draw()`.
- **`gl.readPixels` is bottom-up** and in device pixels; `project()` (`:1120`) gives top-left CSS px.
  The suite runs at `deviceScaleFactor: 1` (`:209`), but `pixels()` must not assume it.
- **The context has `preserveDrawingBuffer` false**: read in the same task as the draw (that is what
  `pixels()` is for), never after an `await`.
- **Uniform locations can be missing**: `compile()` collects only active uniforms (`:702-704`), so a
  uniform a style's shader optimises away is `undefined` in `U`. WebGL treats a null location as a
  no-op, but guard any call whose arguments would throw (the `if (U.uShadow)` pattern in `setCommon`,
  `:1349-1356`).
- **The shadow map is a texture on unit 0** (`setCommon`, `:1355`). Never bind it while `SHADOW.fb` is
  bound, and never sample it from a pass drawing into a framebuffer it is attached to.
- **Vertex format**: changing the arena stride from 40 to 52 bytes touches `vert()` and all four
  existing `vertexAttribPointer` calls (`:847-850`); a missed one draws garbage with no GL error. The
  shadow pass uses the same VAO, so check shadows still fall after step 2.
- **`#version 300 es` must stay the first line** of every shader; the define goes after it.
  `withStyle` must throw on a source it could not patch rather than compile an undefined `STYLE`
  (`#if` on an undefined macro is an error in GLSL ES 3.00, and the message is unhelpful).
- **Native select**: listen for `change`; the global `keydown` (`:1260-1267`) handles Escape and the
  fight keys. Arrow keys on a focused `<select>` change its value; the handler returns before it
  records any key while the menu is open (`APP.paused`, `:1263`), so the duel never sees them. Do not
  add a tap helper to the select.
- **Editing a large single-file game**: replace by function (`.claude/scripts/replace-fn.py`) or by
  anchors you have read in the current file; parse-check after every edit
  (`games/CLAUDE.md` row "Editing a large single-file game").
- **SwiftShader is slow and parallel jobs make it slower**: wait on `__CS.APP.frames`, never on wall
  time (`.claude/combat-simulator.md` section Tests); keep `--jobs 2` for breaks.
- **Commit hygiene**: explicit pathspecs, never `git add -A`; the harness's Co-Authored-By and
  Claude-Session trailers; no model identifiers in commits or files.

## Validation

Per step: parse check, the suite (counts above), `gates.sh games/combat-simulator/index.html` GREEN
(smoke at iPhone 13, the drive suite, games-sync), the step's breaks all caught. Step 1 also proves the
realistic frame unchanged (the one-off hash). Steps 3 and 6: GAMES-SYNC GREEN (step 3 changes the
facets), the badge read back from the file, the Pages run for the landed SHA concluded `success` with
its jobs read. Beyond the gate, only the CD can say whether the looks are right (Playtest above).

## Follow-ups

- **Every box edge in neon**: a per-vertex face-uv attribute and an `fwidth` line in `FS_WORLD` would
  light every edge of the wall and the torii, not only silhouettes and depth steps. Only if the CD
  wants the full wireframe look.
- **Styles in the HUD**: the HUD keeps one look in all three styles (assumed). A toon or neon HUD is a
  separate ask.
- The four open questions in `.claude/combat-simulator.md` (ladder pace, branching combos, more
  fighters, the opponent's power attack) are the CD's and are untouched by this arc.

## Results (append, do not rewrite)

### Step 1 results

Built on `2bff358`. The ENGINE span is byte-identical (the md5 of `ENGINE:BEGIN..END` is the
same before and after). `gates.sh games/combat-simulator/index.html` is GREEN, and the suite is
**61 + 10 = 71 passed, 0 failed**, with no extra rows.

**The realistic frame did not change (the one-off proof).** The procedure: `startDuel(3, 4242)`;
125 ticks of 1/60 for the intro; 240 ticks of 1/120 with `press('atk')` every 30 ticks; sparks
cleared and `APP.time = 100`; then, in one evaluate, `FRAME_DT = 0`, `CAM.init = false`,
`CAM.shake = 0`, `render()` and a full-frame `readPixels` at 844x390, hashed with sha256.
- On the unchanged page, two separate loads gave `2ddf4aa3cb07bfa35de7a863a0a2bb9630fcba19f0f7206702a04321935729be`
  both times, so SwiftShader is deterministic across loads and the GLSL fallback was not needed.
- After the edit, with `style = 'realistic'`, the same hash: `2ddf4aa3...935729be`. I took it
  twice, once before the toon tuning and once at the end.
- Toon gives `5646b48a...` on the same state: it compiles and differs.

**The 10 rows** (part 2 unless noted):
1. (part 1) `!/style/i.test(ENG)`.
2. At boot, with nothing stored: `SETTINGS.style` and `#style-sel` both read `realistic`.
3. The select's options are exactly `['realistic','toon']` (a literal in the suite).
4. A `change` on the select to toon: `SETTINGS.style` is toon, `"style":"toon"` is stored, and
   the next `pixels()` differs from the realistic one by more than 2,000 px (measured: 329,160,
   every pixel, because toon's final `satp` touches the whole frame). `__CS.F` is the same object
   and `F.t` has not moved.
5. After a reload: toon, and the select reads toon.
6. A stored settings object without `style`, and one with `style: 'chalk'`, each load as
   realistic. Realistic is then stored and the page reloaded.
7. A skin is paint: per style, `startDuel(5, 777)`, 1,200 ticks of 1/120, `press('atk')` every
   30 ticks, `draw()` every 4, the stick at rest; the snapshot
   `{p, e, ai, t, nextAtk, r: rng()}` is byte-identical across styles (17 cuts landed in the
   scenario).
8. The same scenario, switched realistic -> toon at tick 600, gives the same snapshot.
9. Toon is banded: `startDuel(1, 99)`, `F.p` z -1.5 and `F.e` z 1.5, both free, one frozen frame
   per style, a 12 x 40 CSS px box at `project([F.e.x, 1.25, F.e.z])`, luminance quantised to 64,
   levels with at least 3 px counted. The threshold is `realistic >= 20 && toon * 2 <= realistic`.
   Measured on the unbroken page (rank 1 is the row; ranks 5 and 10 measured beside it):

   | rank | realistic | toon | toon, unbanded (`shade()`) |
   |---|---|---|---|
   | 1 | 37 | 14 | 33 |
   | 5 | 38 | 14 | 24 |
   | 10 | 34 | 17 | 36 |

   Toon's ratio is 0.38-0.50. The leftover levels are edge pixels, MSAA-blended against the
   courtyard behind the silhouette, plus the hand and the obi crossing the box. At rank 1, 85% of
   toon's box sits in three levels, against 32% for realistic.
10. Every element at once: a real cut stepped until the trail has 3 or more samples,
    `F.e.st = 'power'` at t 0.05 (its ring), and 40 sparks. For each style, `pixels()`;
    `glError() === 0` and the frame is not one colour.

**Breaks** (`.claude/tests/negtests/combat-simulator-styles.json`, 9 of 9 caught, none by a crash;
run in five chunks, alone on the box):

| break | caught by |
|---|---|
| `style-engine` (the engine's `F.t += dt` scales by 1.0001 under toon) | row 1, rows 7 and 8 |
| `style-render-writes-fighter` (`render()` adds 1e-9 to `F.p.x` under toon) | rows 7 and 8 |
| `style-default-toon` | row 2 (and row 6's no-key case) |
| `style-option-missing` | row 3 (and rows 4 and 5) |
| `style-not-saved` | row 4 (nothing stored), row 5 |
| `style-needs-reload` (render reads a copy of the style taken on its first frame) | row 4 (no difference), row 9 (37 / 37) |
| `style-junk-kept` | row 6 (`chalk` kept) |
| `style-toon-unbanded` (toon's limbs call `shade()`) | row 9 (37 / 33) |
| `style-switch-new-duel` (the handler calls `startDuel`) | row 4 (a new `F`) |

**Draw calls per frame** (`PERF.calls` for one `draw()`, the rank-4 scene of row 10):
- Idle (sky, arena, two fighters, two shadow draws): 6 in realistic, 6 in toon.
- With a trail, a power ring and sparks: 8 in realistic, 9 in toon. Toon's solid trail is its
  own `drawArrays` under `ONE, ONE_MINUS_SRC_ALPHA`, ahead of the additive rings.

**How it is built:**
- `withStyle()` throws unless the source starts `#version 300 es\n`.
- `progsFor(look)` compiles `world`, `limb`, `sky` and `glow` per style on first use. The shadow
  and `flat` programs stay in `PRG` and are shared. `initGL()` builds only realistic's set.
- `render()` opens with `const look = SETTINGS.style, P = progsFor(look);`, and every `PRG.` in
  it became `P.`.
- `FS_FLAT` now writes alpha `vC.a`. That is harmless for the additive passes, as the hash shows.
- `__CS` gains `STYLES`, `PARTS`, `FX`, `setStyle`, `draw`, `pixels` (whole frame by default)
  and `glError`.
- `dprNow()` replaces the loop's and the HUD hook's copies of the dpr expression.
- `FX = { ink: true, bloom: true }` exists, and nothing reads it yet.

**Assumed look choices, for step 3 to write into `.claude/combat-simulator.md`:**
- **Bands**: `k = ndl * shadow`, with a lit band of 0.7 above k = 0.55, a mid band of 0.4 above
  0.12, else 0. The plan's 1.0 / 0.55 blew out the pale flagstones at rank 1 after the 1.6
  saturation push, so I dropped it to 0.7 / 0.4.
- **Ambient floor**: `max(mix(ambGnd, ambSky, 0.5) * ao, keyCol * 0.1 + 0.1)`. The plan's
  0.18 + 0.12 also washed out rank 1. Ranks 1, 5 and 10 were checked by eye.
- **Lanterns**: two steps, `+0.15` at li > 0.08 and `+0.45` at li > 0.3, in the lamp colour.
  The paper's emission does not flicker in toon.
- **Albedo**:
  - Saturation is pushed by 1.6 before shading, and by `satp(…, 1.15)` again after the tonemap.
  - The flagstone joints are a hard line at `e < 0.022`, at 0.42 x the stone colour.
  - The gravel is two tones, 1.0 and 0.8, on the sign of the furrow sine.
- **Blade**: a white highlight of strength 4.0 (pre-tonemap) where `dot(N, H) > 0.985`. It keeps
  the power glow `uGlow * 1.8`. No rim in toon.
- **Sky**:
  - The colours are skyCol's zenith and horizon, blended `smoothstep(0.02, 0.55, d.y)`.
  - The clouds sit at a noise threshold of 0.66, 85% opaque. Their tint is
    `mix(0.07-grey, 1.2-white, uDay)`.
  - The sun is a flat disc at `cos > 0.9992`, the moon at `cos > 0.99965`. There are no stars.
  - The far range is `(0.05, 0.08, 0.14)` and the near one `(0.03, 0.06, 0.05)`, each scaled by
    the day and mixed 45% / 25% toward the horizon colour.
- **Fog** mixes toward toon's horizon colour.
- **Trail**: solid white at alpha 0.9 at every vertex, power cuts included (power is not tinted
  in toon).
- **Sparks**: the plan's star; the colour is clamped to 1 and scaled by life, with no 2x
  over-bright.

### Step 2 results

Built on `ade4d81`. The ENGINE span is byte-identical (md5 of `ENGINE:BEGIN..END`
`db0815e8...` before and after). `gates.sh games/combat-simulator/index.html`, run alone, is
GREEN, and the suite is **71 + 3 = 74 passed, 0 failed**, with no extra rows.

**The realistic frame did not change.** Step 1's procedure (`startDuel(3, 4242)`, 125 ticks of
1/60, 240 ticks of 1/120 with `press('atk')` every 30, sparks cleared, `APP.time = 100`, one
frozen `pixels()` at 844x390, sha256) gives `2ddf4aa3cb07bfa35de7a863a0a2bb9630fcba19f0f7206702a04321935729be`
on the edited page, with `FX.ink` true and with it false: the same hash as step 1. Toon with
`FX.ink` false gives `de186cd2...`, which is exactly the unedited page's toon frame (so
the 13-float vertex changed nothing but the new pass); toon with ink gives `e10f0c03...`.
Shadows still fall: the realistic hash covers the shadow pass, which reads the same VAO.

**How it is built:**
- The arena vertex is 13 floats (stride 52). `vert(mb, p, nr, c, m, e)` takes the ink
  extrusion `e` (default `NOEXT`, `[0, 0, 0]`), and `initGL()` has five pointers. `aExt` is
  location 4, at offset 40.
- `box()` walks a `BOXC` sign table. A corner's `e` is `sx X + sy Y + sz Z` in the box's own
  axes, and `quad()` takes four extrusions. The corners' positions are computed exactly as
  before, so the vertex order and values are bit-identical.
- `cyl()`: a side vertex is `[c, -1, s]` on the bottom ring and `[c, 1, s]` on the top ring.
  The cap centre is `[0, 1, 0]` and the cap ring `[c, 1, s]`.
- The floor disc and both annuli stay 0.
- `VS_INK_WORLD` moves `aPos + aExt * uInk * |uEye - aPos|`. `VS_INK_LIMB` is `VS_LIMB`'s frame
  with the vertex pushed out along `n` by `uInk * |uEye - s|`. `FS_INK` discards where
  `dot(vN, uEye - vW) > 0` and writes `uInkCol` flat (no tonemap).
- `INK = { toon: { px: 1.5, col: #0d0b10 } }` beside `progsFor()`. `progsFor()` compiles
  `inkWorld` and `inkLimb` (under the style's `STYLE`) only for a style in `INK`. `render()`
  computes `const ink = FX.ink && INK[look]` and
  `inkW = ink.px * 2 * tan(CAM.fov / 2) / (ph / dpr)`.
- There are two passes, both through `inkSet()`: the arena hull straight after the arena
  draw, and one instanced draw of all `nCaps` capsules after the fighters' colour draws (once
  the attribute offsets are reset). Step 4 extends both by adding `neon` to `INK`, plus a
  per-fighter colour.

**The 3 rows** (part 2). One evaluate runs `startDuel(1, 99)` with `F.p` at z -1.5 and `F.e` at
z 1.5, both free and sparks cleared. It renders toon with ink on and off and realistic with ink
on and off, and counts near-black pixels (every channel < 30) in three regions:
- the opponent's box: the projected AABB 0.6 m round it, 2 m tall;
- outside both fighters' wide boxes (1.3 m, 2.4 m), which is the courtyard alone;
- the 12 x 40 px torso box of step 1's row 9.

Measured on the unbroken page at 844x390:

| frame | opponent box | courtyard | torso box (of 480) |
|---|---|---|---|
| toon, ink on | 734 | 3,334 | 27 |
| toon, ink off | 186 | 0 | 0 |
| realistic, on = off | 198 | 0 | 0 |
| toon on, rank 5 / rank 10 (beside the row) | 814 / 1,633 | 3,334 / 3,612 | 30 / 158 |

1. **Ink round a fighter**: the opponent box rises by `>= 300` (measured +548; +114 of that is
   the courtyard's own ink behind the opponent, which is what is left with the fighter pass
   removed). Also, the torso box is at most 25% near-black with ink on (measured 5.6%: the ink
   is a rim, not a fill). The second clause is the one that catches the culled hull.
2. **Ink round the courtyard**: the courtyard rises by `>= 1500` (measured +3,334).
3. **Realistic is untouched by the ink**: realistic's full frames with `FX.ink` true and false
   are byte-identical.

Step 1's row 9 still passes with ink on: toon has 13 levels on the torso, against 14 without
ink and 37 for realistic.

**Breaks** (appended to `.claude/tests/negtests/combat-simulator-styles.json`; 5 of 5 caught by
their own rows, none by a crash; run in three foreground chunks, alone on the box):

| break | caught by | measured |
|---|---|---|
| `ink-off-fighters` (the fighter pass deleted) | row 1 | opponent box 300 vs 186: +114 < 300 |
| `ink-off-arena` (the arena pass deleted) | row 2 | courtyard 0 vs 0 |
| `ink-in-realistic` (`INK` gains a `realistic` entry) | row 3 | frames differ; courtyard 3,334 in realistic |
| `ink-ext-zero` (`vert()` writes 0, 0, 0 for every `ext`) | row 2 | courtyard 0: the shell collapses onto the mesh and is discarded or hidden |
| `ink-cull-not-discard` (the limb pass compiles `FS_INK` without the discard and draws under `gl.cullFace(gl.FRONT)`) | row 1, by its fill clause | torso 475 of 480 near-black; opponent box 4,760 |

All 14 anchors in the list match exactly once on the final page, and every `new` carries
`/* @negtest */`. None of step 1's 9 anchors was touched by this step. Row 9's picture
changed, though, so I re-ran `style-toon-unbanded` (still caught by row 9: 37 / 32) and
`style-needs-reload` (still caught, by rows 4, 9 and now row 1).

**The cull evidence: the derivation holds.** With front faces culled and the discard taken
out, the fighter came out **covered in black**: 99% of the torso box, and more than six times
the ink-on count in the opponent's box. That is "the wrong way round" (more black, not less).
So the capsules' outward faces reach the rasteriser wound clockwise, which is what a
left-handed `(u, ax, v)` frame in `VS_LIMB` predicts. `gl.cullFace(gl.BACK)` would therefore
be the culling that keeps the far shell. Discarding by normal stays the design, because it
does not depend on winding. A rise-only row 1 would have **passed** this break, which is why
row 1 has the torso-fill ceiling.

**Draw calls per frame** (`PERF.calls` for one `draw()`, the rank-4 scene of step 1's row 10):
- Idle: 6 in realistic, 8 in toon (the two ink passes).
- With a trail, a power ring and sparks: 8 in realistic, 11 in toon (9 with `FX.ink` off).

**Assumed look choices, for step 3 to write into `.claude/combat-simulator.md`:**
- Ink is the plan's `#0d0b10` at the plan's 1.5 CSS px, with the same width on the blade. At
  the duel's distance the blade is narrower than its two ink edges, so in toon it reads as a
  dark line with a light core.
- The arena's overlapping wall boxes (each is `hl + 0.02` long) draw a short vertical ink line
  at every segment joint, so the wall reads as panels. I kept these rather than special-casing
  them.
- The open bottom of a pine's foliage cone shows the shell's bottom ring as a dark band
  where the camera sees under it. I kept this as the rim's own line.
- The ink is drawn flat in display space (no tonemap, no fog), so a far pine's outline is as
  dark as a near one's.
- The ink writes depth, so the additive effects depth-test against it like any other geometry.

### Step 3 results

Docs only: the `ENGINE` block and the page's code did not change, and only the badge line of
`games/combat-simulator/index.html` did (the `GAMES[]` facet and the badge in
`games/index.html`).

**Files changed:** `.claude/combat-simulator.md` (a new "Graphics styles" section; 14 assumed
rows; Backlog CS-1 marked shipped 2026-11-02 and CS-2 marked open; Tests: 74 checks, the 13
style rows named, both break lists with counts; the header and Architecture lines),
`.claude/tests/README.md` (the `drive-combat-simulator.cjs` row), `.claude/games-index.md`
(Combat Simulator gains `art-styles`; the `art-styles` paragraph names it as the first WebGL
page with styles; there is no facet-count line to update), `games/index.html` (the COMBAT
SIMULATOR `GAMES[]` entry's `mech` gains `art-styles`; badge), `games/CLAUDE.md` and root
`CLAUDE.md` ("a Graphics style selector: realistic, toon"; the inventory's 74 checks and
19 + 14 breaks), `TODO.md` (the entry says CS-1 shipped, CS-2 open), `DONE.md` (a CS-1 line),
`games/combat-simulator/index.html` (badge line only), and this plan.

**Counts, read from the code:** suite 74 (61 + 10 + 3), of which 13 are style rows (the
engine row in part 1); break lists 19 (`combat-simulator.json`) and 14
(`combat-simulator-styles.json`: 9 from step 1, 5 from step 2).

**Badges:** `games/combat-simulator/index.html` `build 2026-11-02 22:04 UTC`;
`games/index.html` `build 2026-11-02 22:04 UTC` (both read back from the files).

Landing on main done by the overseer.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/csstyles.selector-toon-neon.md
```
