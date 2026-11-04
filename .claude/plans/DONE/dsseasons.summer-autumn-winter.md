# dsseasons - Driving Simulator: summer, autumn and winter become selectable (DS-3)

**Status:** IMPLEMENTED 2026-11-04 (oversee run, branch `ds-seasons`, step commits bfef3b5..a4bdfd6, landed on `main` as one commit; `build 2026-11-04 04:01 UTC`)
**Drafted on** `main` at `37afb17` (suite 141 checks, break list 57). Every `file:line` below was read
on `37afb17`; re-grep each anchor before editing, as another session may land first.
**Requested:** 2026-11-01, the CD (verbatim):

> Add to settings a season dropdown menu defaults to spring and other seasons are visible but not
> selectable (yet; add this to the backlog for "driving sim").

The dropdown shipped that day (`build 2026-11-01 15:55 UTC`). This plan opens the other three. The
look of each season was written into the backlog as *chosen* defaults and can be overruled at plan
review.

**Scope:** `games/driving-simulator/index.html` (the season table and switch, the tree, bush, grass
and treeline colours, the bare winter trees, the ambient sound by season, `window.__DS`), the suite
`.claude/tests/drive-driving-simulator.cjs`, the break list
`.claude/tests/negtests/driving-simulator.json`, and the docs `.claude/driving-simulator.md`,
`.claude/tests/README.md`, `games/CLAUDE.md` (the Driving Simulator inventory paragraph), `TODO.md`,
`DONE.md`. Source TODO entry: `TODO.md` § Now, "Summer, autumn and winter become selectable". Full
spec: `.claude/driving-simulator.md` § Backlog, DS-3.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

The Season dropdown offers all four seasons; spring stays the default and stays exactly as shipped,
byte for byte. Choosing a season puts the calendar on that season's middle date (DS-1 already runs
the sun, moon, planets and stars from the date) and rebuilds the loaded road in that season's look,
with the player's place and the traffic untouched. Broadleaf trees go deeper green in summer, turn
red, orange, russet and yellow in autumn (varied tree by tree), and stand bare in winter as a trunk
and limbs; conifers never change. Grass and verges go from fresh green to dormant straw, bushes and
the distant treeline follow, and the ambient sound changes: cicadas and katydids in summer, crickets
and fewer birds in autumn, a few birds and no insects in winter.

## Context

- **The dropdown and its guard.** `index.html:78-79` lists summer, autumn and winter `disabled`.
  `SEASONS` and `SEASONS_OPEN = ['spring']` are at `:1165`. A saved season outside `SEASONS_OPEN`
  is reset to spring at boot (`:1225`); the saved date is checked against the season's run
  (`:1227-1228`). The change handler (`:4112-4114`) refuses a closed season and otherwise sets
  `SETTINGS.season` and calls `setDate(SEASON_DATES[v][2])`.
- **The calendar already covers every season.** `SEASON_DATES` (`:1192-1197`) holds each season's
  `[first, last, middle]`; `nextDate()` wraps inside `SETTINGS.season` (`:4165-4170`); `setDate()`
  saves and calls `updateSky()` (`:4172-4176`). The suite's DST rows already set
  `D.SETTINGS.season = 'autumn'` / `'winter'` directly and call `setDate()`
  (`drive-driving-simulator.cjs:297-306`), so the sky needs no new code, only the switch.
- **Chunks bake colour into their meshes.** `buildChunk(ci)` (`index.html:1699`) is a pure function
  of `WORLD_SEED` and `ci`: its props come from `rngFor('chunk-' + ci)` (`:1798`) and per-lot
  `mulberry32(hashSeed(...))` streams (`:1827`, `:1868`). `makeChunk()` uploads and drops the arrays
  (`:2981-2986`); `updateChunks(budget)` builds the missing wanted chunks, `c - 3 .. c + 12`
  (`:2980`, `:2987-2996`). `teleport()` (`:4254-4261`) rebuilds by moving the player, which also
  resets the player (`resetPlayer()`, `:2608-2612`) and respawns all traffic: the season switch
  must NOT go through it.
- **Trees.** `addTree(mb, T, x, y, z, scale, rnd, colliders, ox, oz)` (`:1664-1686`): conifers are
  `CONIFERS = {'fir-1', 'pine-1'}` (`:1663`), drawn as cones; broadleaf trees as one `blob()` per
  kit canopy sphere. It draws from `rnd` in this order: the bark tint (non-birch only), `lv`, `hue`,
  then one `rnd.int(0, 1e9)` seed per cone or blob. `x, z` are anchor-relative; the world position
  is `x + ox, z + oz` (every caller passes the anchor). The collider is a circle at the trunk
  (`:1685`). Species pools by environment are in `treeCfg` (`:1802-1808`): forest (all six forest
  ids), fields (street trees + broadleaf forest), open (forest), suburb (street trees), town (street
  trees on the verge, `:1866-1872`).
- **Colours** are linear RGB in `C` (`:1534-1539`): `leaf`, `conifer`, `grassField`, `grassDry`,
  `grassForest`, `lawn`, `birchBark`. `grassColor(env, x, z)` (`:1692-1698`) mixes field and dry
  by a noise `t` for fields/open, uses `grassForest` in forest and `lawn` in town/suburb; the kerb
  strip uses `C.lawn` directly (`:1751`). The distant treeline (`:1776-1797`) is `C.conifer` in a
  forest and `C.leaf` elsewhere (`:1785`). Town yard bushes are `C.leaf` blobs (`:1857-1862`; note
  `C.leaf.map(v => v * lr.range(0.7, 1.1))` draws three numbers).
- **The shaders only multiply the vertex colour.** Grass (`:2290-2296`) and leaves (`:2317-2320`)
  scale `vCol` by noise; leaves sway in the vertex shader on material 6 (`:2223`). Nothing in GLSL
  is green by itself, so a season is vertex colour and geometry only.
- **Meshes.** `MB` stores 12 floats a vertex: position, normal, colour, material, uv
  (`:1400-1406`); `upload()` writes them as one `Float32Array` and the indices as `Uint32Array`
  (`:2524-2528`) and returns `null` for an empty builder. `MB.cyl` is vertical only (`:1440`); there
  is no cylinder between two arbitrary points. The world pass culls back faces (`:3382`); the shadow
  pass does not (`:3345`).
- **Ambient.** `S.unlock()` builds `ambF` (a lowpass into `ch.ambient`) and the breeze (`:3801-3805`).
  `S.update()` schedules a bird by day or a cricket by night a little ahead of `ac.currentTime`
  (`:3863-3869`). `bird()` makes a `StereoPanner` and oscillators per call; `cricket()` three tones
  (`:4016-4030`); the slider's preview plays one (`:4075`). Probes are one analyser per bus and
  channel (`:3830-3836`), read by `S.rms(k)`; `S.update(dt)` automates against `ac.currentTime` and
  does not use `dt` for timing, so extra calls are harmless.
- **The suite's oracles already exist.** `ownSun`, `ownRiseSet`, `ownNoon` (`:41-52`), `SIMBAD`
  with Betelgeuse and Rigel (`:65-67`), `ownStar` (`:85`), the sunrise row's shape (`:224-243`), the
  dropdown row to restate (`:738-742`), `__dsAimed` for aimed frames (`:778`), and recorded
  before-hashes typed into the suite (`SKY_BEFORE`, `:1042`).
- **Recomputed while drafting (2026-11-03).** NOAA's solar-calculator algorithm, Raleigh
  35.7796 N 78.6382 W, -0.833 deg: Aug 6, 2026 06:27 / 20:14 EDT (declination +16.56); Nov 6, 2026
  06:42 / 17:14 EST (-16.13); Feb 4, 2027 07:12 / 17:45 EST (-16.14); May 5 06:18 / 20:05 EDT,
  as the suite's comment says. The backlog's table had summer's sunrise at 06:26, a rounding edge.
  The suite's own `ownRiseSet` gives 06:26 / 20:14, 06:42 / 17:14, 07:12 / 17:45. At 22:00 EST on
  Feb 4, 2027 its `ownStar` puts Betelgeuse at alt 59.5, az 204.5 and Rigel at alt 41.2, az 210.2
  (Orion high in the south); at 22:00 EDT on Aug 6 both are below the horizon (-46.8, -61.4).
- **The tree knowledge base** (zmhstudio `templates/design/trees/`, read while drafting):
  `architecture.md` gives the branch orders (one trunk, about 4-10 scaffold limbs, a handful of
  order-2 branches per limb, then twigs), a child/parent length ratio of 0.5-0.8, and the spreading
  habit of oak and maple (several codominant limbs at 30-70 deg from vertical).
  `species/english-oak.md`: autumn "a dull yellow-brown to russet, often held late".
  `species/silver-birch.md`: autumn "a clear bright yellow", RGB (232, 196, 60).
  `species/japanese-maple.md`: autumn (190, 45, 35). Raleigh's maples are mostly red maple, whose
  autumn runs scarlet to orange to yellow (inferred: general botany, not in the KB).

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

- **One look table.** `SEASON_LOOK[season]` holds every colour that changes with the season (linear
  RGB, made with `lin3` from the sRGB values below). Spring's row is built from the shipped `C`
  values, unchanged. The builders read a module-level `LOOK` (the current row), never
  `SETTINGS.season`: the DST rows write `SETTINGS.season` directly to move the calendar, and must not
  change the look.
- **The switch.** `applySeason(v)` sets `LOOK = SEASON_LOOK[v]`, frees every chunk's meshes
  (`freeMesh`), clears `CHUNKS` and calls `updateChunks(99)`. It never moves the player or the
  traffic. Boot calls it (or sets `LOOK` from `SETTINGS.season`) before the first chunk is built, so a
  saved winter boots in winter. The handler: `SEASONS_OPEN = SEASONS` (all four), the `disabled`
  attributes removed, and a change to a new season sets `SETTINGS.season`, calls `applySeason(v)`
  and `setDate(SEASON_DATES[v][2])`. The test hook gets `setSeason` (the handler's own path, without
  the DOM event).
- **Spring is byte-identical.** Every season draws exactly the same numbers from every stream in the
  same order. A winter tree still calls `rnd.int(0, 1e9)` once per canopy sphere; it uses that seed
  for its limbs' jitter (`mulberry32(seed)`) instead of for a blob. Anything new that varies per tree
  (the autumn colour) comes from a hash of the tree's world position, never from `rnd`:
  `mulberry32(hashSeed(WORLD_SEED, 'leaf-' + Math.round((x + ox) * 10) + ',' + Math.round((z + oz) * 10)))`.
  Spring takes the shipped code path's colours exactly (`C.leaf` with `lv` and `hue`).
- **Trees by season** (sRGB, then `lin3`, then times the shipped `lv`; `hue` is applied only in
  spring and summer):
  - Spring: as shipped. Summer: deeper green, (46, 82, 42), about 0.85x spring's value at the same
    hue.
  - Autumn, picked per tree by the position hash: maple-1 and sapling-1 from red (178, 48, 30),
    scarlet-orange (204, 84, 30) and orange (214, 128, 36), weights 0.4 / 0.35 / 0.25; oak-1 between
    russet (140, 78, 40) and dull yellow-brown (150, 112, 52); birch-1 between yellow (232, 196, 60)
    and yellow-green (196, 186, 70); the street trees tree-1..3 between yellow (218, 180, 54) and
    orange-yellow (222, 150, 44). "Between" = a lerp by a second number from the same hash.
  - Winter: no canopy blobs. The trunk cylinder stays as in every season (same radius, same height,
    same collider). For each kit canopy sphere, one scaffold limb (`MAT.BARK`, bark colour) from the
    trunk at `y + 0.9 th` to the sphere's centre pushed out by half its radius along the direction
    away from the attach point; a sphere straight above the trunk (horizontal offset under 0.2 m
    scaled) gives the leader, ending at the sphere's top. Limb radius `0.6 tr` to
    `max(0.02, 0.15 tr)`, 5 segments, no caps. Two order-2 branches per limb at 55% and 75% of its
    length, each turned 35-50 deg off the limb about a perpendicular axis at a random azimuth, biased
    up (add 0.3 to y before normalising), 0.55-0.7 of the limb's length, radius 0.6x the limb's there
    tapering to 0.015 m, 4 segments. All jitter from the sphere's own seed. No twig layer (the
    distant treeline carries the mass); the tree-expert review decides whether that reads.
  - **A new `MB.limb(p0, p1, r0, r1, seg, c, mat)`**: a frustum between two points, rings in an
    orthonormal frame round the axis, outward normals, wound counter-clockwise from outside (the
    world pass culls back faces, `:3382`; a wrong winding hides the limb from the camera while its
    shadow still shows, because the shadow pass does not cull).
  - Conifers: identical bytes in every season.
- **Bushes** (town yards): spring and summer the season's leaf green; autumn browner (120, 96, 48);
  winter thin: (104, 88, 70) at 0.7x the radius. Same `lr` draws in every season.
- **Grass** (`grassColor()` and the kerb's lawn), sRGB per season, field / dry / forest floor / lawn:
  spring as shipped (78, 108, 46) / (128, 122, 72) / (56, 76, 40) / (62, 96, 42); summer
  (64, 94, 36) / (112, 112, 58) / (48, 68, 34) / (54, 86, 36); autumn (112, 108, 58) /
  (150, 128, 80) / (92, 74, 46) / (84, 98, 48); winter (150, 128, 84) / (166, 142, 98) /
  (96, 80, 60) / (128, 118, 74). The forest floor goes to leaf litter in autumn and winter. No snow.
- **The distant treeline** in fields and open land (`:1785`, `C.leaf` there): summer's leaf green;
  autumn a muted olive-orange (138, 104, 52); winter grey-brown bare crowns (110, 98, 90). In a forest
  it stays `C.conifer`. (Inferred: a distant autumn hardwood stand averages to olive-orange, a bare
  one to grey-brown; worth the CD's eye.)
- **Ambient by season.** Two new gains built once in `S.unlock()`, `amb.birdG` and `amb.insG`, both
  into `ambF`, each with an analyser probe (`birds`, `insects`), so `S.rms('insects')` measures the
  insects alone. `bird()` connects through `amb.birdG`; `cricket()` and the two new voices through
  `amb.insG`. A table `AMB_SEASON` gives per season: birds by day (a rate factor), the day insect and
  the night insect, and a level:
  - spring: birds 1, no day insect, crickets at night (as shipped: the same rates and levels; only the routing through `amb.insG`, a gain of 1, is new);
  - summer: birds 1, **cicadas** by day (a buzz: noise band-passed near 5 kHz, amplitude-pulsed at
    about 30-60 Hz, swelling over 2-6 s and fading), **katydids** at night (rasps of 2-4 pulses of
    band-passed noise near 3-4 kHz, "ka-ty-did"), about 1.5x louder than spring's crickets;
  - autumn: birds 0.5, crickets at night;
  - winter: birds 0.3, no insects at all.
  The ambient slider's preview plays the season's own voice. All levels measured, never set by ear:
  summer's night insect RMS 1.3-2.5x spring's at night, cicadas by day under 0.6x the engine at a
  cruise in the chase view (they must not mask it).

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans). One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Record spring's chunk bytes on the base page; open the seasons; the look table with spring only; `applySeason()`; the sky and calendar rows | engine+tests | opus | high | a byte-identical guarantee that must be recorded before any edit, a rebuild that must not touch the player or traffic, and GPU read-back rows |
| 2 | Trees, bare winter limbs, bushes, grass, treeline; the tree and grass rows; the tree-expert review | render+tests | opus | high | new geometry with a culling trap, an RNG stream that must not shift, hue bands measured off the meshes and the picture |
| 3 | The ambient by season: birds and insects gains and probes, cicadas, katydids; the sound rows | audio+tests | opus | high | Web Audio voices from scratch, levels by measurement, rows that must not depend on the frame rate |
| 4 | Break list and negative tests; frame cost; docs | eval+docs | opus | high | each break on its own row; MISSED needs a row or an argued equivalence |
| 5 | Ship: badge, gates, land on `main`, Pages, TODO/DONE, report | ship | sonnet | medium | the documented procedure |

- **Ordering:** 1 -> 2 -> 3 -> 4 -> 5. Nothing in parallel (one page, one suite).
- **Files owned per task:** 1: the season constants, the handler, boot, `applySeason`, `__DS`, the
  suite; 2: `C` / `SEASON_LOOK`, `MB.limb`, `addTree`, `grassColor`, `buildChunk`'s colour sites, the
  suite; 3: `SND`'s ambient, the suite; 4: the break list, the docs; 5: the badge line, the plan's
  move to `DONE/`, `TODO.md`, `DONE.md`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every page edit; `.claude/scripts/gates.sh games/driving-simulator/index.html` at the end of
  every step, **run alone** (check `uptime` first; producer config § Environment).
- **Gates red only on the known rows counts as green.** On this container the unchanged page fails
  "the engine is audible and the radio sits near it (0.5-1.6x the engine)" and "all four stations
  play and sit within 25% of each other", and the perf block's row when every frame takes 1 s or
  more (`TODO.md` § Later, the radio rows; `DONE.md` 2026-11-03). Run the gates once on the base
  page first; a step passes when its only reds are rows that were red there too, named in the step's
  Results.
- **Tier audit (required):** no step passes a haiku checklist. Steps 1-3 each mix design with rows
  that must measure (GPU read-back, hues, audio levels): opus, high. Step 4 needs judgment on breaks:
  opus, high. Step 5 is the procedure but pushes to `main`: sonnet, medium.
- **Decision defaults:** everything under "Design". Beyond it:
  - A choice not listed here becomes a row in `.claude/driving-simulator.md`'s "Assumed, not
    decided" table, marked DS-3.
  - A suite row the change contradicts is restated, never deleted. Known: "a season dropdown in
    TIME: spring selected, summer, autumn and winter listed but not selectable" (`:741`) becomes
    "spring by default, all four selectable, each saved".
  - If a hue band below cannot hold with the Design's colours, move the colour, not the band, and log
    it; the bands are the season's words ("red-orange", "yellow", "straw").
  - The tree-expert review (step 2) may tune anything inside this Design (colours, limb counts,
    angles, lengths, radii) and the rows move with it inside their bands. Anything structural (a twig
    layer, alpha cards, new species, snow) goes to the follow-up file for the CD, not into this run.
- **The suite's oracles:** NOAA's times (typed from Context) and the suite's own `ownRiseSet` and
  `ownStar`; the hue bands from the season words above; the measured side is always the GPU's own
  buffers, the rendered pixels or the audio analysers, never the page's tables echoed back.
- **Embedded-content QA.** New rows: step 1 adds 5, step 2 adds 8, step 3 adds 3 = 16 (listed in
  Steps). Expected total at the end of step 3: start + 16 (141 + 16 = 157 if nothing else lands
  first; state the real numbers). Step 4 adds a row only for a MISSED break; say how many.
- **Escalation triggers:** spring's recorded bytes cannot be kept (the recording itself differs
  between two runs of the base page); a winter forest chunk builds more than 2x slower than spring's,
  or its triangles exceed 1.6x spring's, and fewer limbs would break the Design; anything needing a
  change to `drivingSimulator.settings.v1`'s key.
- **Playtest:** see § Validation.
- **Publish:** step 5 pushes `main`, which is the publish. Verify the Pages run.
- **Commit strategy:** one conventional commit per step on the plan's branch (`ds-seasons`, or the
  branch your session may push to), scope `driving-simulator`, ending "(dsseasons step N)". Step 5
  lands the branch on `main` as one commit with `.claude/scripts/land-on-main.sh`, dry-run first.

## Steps

### Step 1 - the switch, the sky, and spring held still

- **First, before any page edit:** record spring's chunk bytes on the base page by the new row's own
  code, and type them into the suite as `SPRING_BEFORE` (as `SKY_BEFORE` was, `:1042`). Choose one
  chunk per environment present in the first 12 km (scan `sectionAt(s).env`: forest, fields, open,
  suburb, town; name the `s` of each). For each, `teleport` there, then read the chunk's `baseMesh`
  and `propMesh` vertex and index buffers back off the GPU and hash them (FNV-1a over the bytes, the
  suite's `fnv`, `:1046`). Read through `gl.COPY_READ_BUFFER` (`getBufferParameter(..., BUFFER_SIZE)`,
  then `getBufferSubData`), with the VAO unbound, so no binding the page relies on is disturbed (an
  index buffer may be bound only to `ELEMENT_ARRAY_BUFFER` or the copy targets, from memory of the
  WebGL 2 spec: verify). The context is `document.getElementById('gl').getContext('webgl2')`
  (`:2161`). Run the recording twice; the hashes must agree.
- Build per Design: `SEASONS_OPEN = SEASONS`, no `disabled`, `SEASON_LOOK` with spring only (the
  others may alias spring until step 2), `LOOK`, `applySeason()`, boot, the handler, `__DS.setSeason`.
- Rows (5; section 3b, after the date rows, unless a better home is obvious):
  - **selectable and saved:** each season chosen by a `change` event on `#season-sel` sets
    `SETTINGS.season`, puts the date on its middle date (`SEASON_DATES[v][2]`) and saves both; after
    a reload in winter the page boots in winter on the saved date, and its loaded chunks hash as
    they did before the reload. Then back to spring.
  - **nothing moves:** across a switch the player's `s`, `u`, `x`, `z`, `yaw` and speed and every
    traffic car's id, `s` and lane are unchanged.
  - **spring is as shipped:** the recorded chunks hash as `SPRING_BEFORE`; again after a round trip
    spring -> winter -> spring.
  - **sunrise and sunset** on each season's middle date within 10 min of NOAA (typed: 06:27 / 20:14
    EDT, 06:42 / 17:14 EST, 07:12 / 17:45 EST) and of `ownRiseSet`, found as the clock row finds them
    (`:224-227`), with the clock's EDT/EST as the season's.
  - **each season's sky:** at 22:00 EST on Feb 4, 2027, Betelgeuse and Rigel within 0.05 deg of
    `ownStar` (precessed), Betelgeuse above 50 deg and both between az 180 and 230; at 22:00 EDT on
    Aug 6, 2026 both below the horizon.
- Restate the dropdown row (`:741`). Expected total: start + 5.

### Step 2 - trees, grass, bushes and the treeline

- Build per Design. Add a read-only hook `__DS.treeTest(id, season, x, z)` that builds one tree of
  that kit id with the page's own `addTree` into a fresh `MB` (a fixed `rnd`, the given world
  position) and returns its vertex floats and indices, and a per-chunk `trees` list
  `[{ id, x, z }]` (world position) returned by `buildChunk` (metadata only: not in any mesh, so
  spring's bytes do not move).
- Rows (8; colours are the stored linear vertex colour taken to sRGB, then HSV):
  - **canopies by season:** for each broadleaf id, the mean hue of its `MAT.LEAF` vertices: spring and
    summer 95-135 deg, summer's mean value at most 0.9x spring's for the same tree; autumn maple-1
    and sapling-1 0-35 deg, oak-1 18-45 deg with saturation 0.45-0.8, birch-1 42-60 deg, tree-1..3
    30-52 deg.
  - **bare in winter:** every broadleaf id in winter has no `MAT.LEAF` vertex, has at least one limb
    per kit canopy sphere (its `MAT.BARK` vertex count exceeds spring's by at least
    `spheres x 12`), keeps its collider (the chunk's circle colliders identical to spring's), and
    every bark triangle faces out (its winding's normal agrees with its vertex normals).
  - **conifers never change:** fir-1 and pine-1 hash the same in all four seasons.
  - **a forest is never one colour:** 40 maple-1 at different positions in autumn: hues spread over
    at least 15 deg and fall in at least 3 of 6 equal bins of 0-36 deg.
  - **the same trees in the same places:** for each recorded chunk, the `trees` list and the
    colliders are identical in all four seasons, and in winter its props buffer differs from
    spring's (the rebuild happened).
  - **grass by season:** the fields chunk's `MAT.GRASS` vertices: summer mean hue 60-100 deg with
    mean value at most 0.92x spring's; autumn 36-62 deg (the dry end alone is about 41); winter 28-48 deg with mean saturation
    0.2-0.55; the forest chunk's floor in autumn and winter 25-45 deg.
  - **bushes and the treeline follow:** a town chunk's yard bushes in autumn browner than spring's
    (hue under 60 deg) and in winter smaller (bounding radius about 0.7x); the fields treeline's
    vertices in autumn 25-50 deg, in winter saturation under 0.3; a forest's treeline unchanged.
  - **the picture follows:** one aimed frame of the forest at `teleport(400)`, 13:00, chase view, in
    spring, autumn and winter: autumn's share of warm pixels (hue 0-50 deg, saturation over 0.3) at
    least 3x spring's, and winter's share of green pixels (hue 75-150 deg, saturation over 0.25)
    under 0.5x spring's. Record the shares in the Results.
- **The tree-expert review.** After the rows pass, take shots with `.claude/scripts/shot-page.cjs`
  (the eval form in `.claude/driving-simulator.md` § Testing): the forest at `teleport(400)`, chase
  view, 13:00, in all four seasons, plus a town street (`teleport(10600)`) in autumn and winter. If
  the session lists the `tree-expert` agent type, spawn it on those shots with this plan's Design;
  otherwise read zmhstudio's `templates/design/trees/architecture.md`, `species/english-oak.md`,
  `species/silver-birch.md` and `species/japanese-maple.md` (the zmhstudio checkout, or
  `mcp__github__get_file_contents` on `zackhelms/zmhstudio`) and say the review was by reading. Adopt
  tuning per the decision defaults; log what changed; send the shots' paths and the verdict to the
  Results. This closes `.claude/driving-simulator.md` § Follow-ups' tree-expert item for the seasons;
  say so there in step 4.
- Expected total: step 1's + 8.

### Step 3 - the ambient by season

- Build per Design.
- **The rows drive the scheduler on a timer.** The ambient is queued about 0.3 s ahead from the frame
  loop, and on this container a frame can take a second, so a row that samples while frames are slow
  measures gaps, not the season (the radio rows' failure, `TODO.md` § Later). While a row samples,
  call `__DS.SND.update(0)` from a `setInterval(..., 50)` in the page and clear it after. Hold
  `Math.random` to a seeded generator for the sampling window, so two seasons compared hear the same
  dice. Sample the `insects` and `birds` probes' RMS every 50 ms over the window and take the mean.
- Rows (3):
  - **no insects in winter:** by day (13:00) and by night (01:00), 4 s each, `insects` RMS under 1e-5,
    with the ambient slider at 100; spring by night in the same conditions over 1e-4 (crickets).
  - **summer's insects:** cicadas by day (`insects` over 1e-4 at 13:00, where spring's is under 1e-5)
    and katydids by night at 1.3-2.5x spring's night insects; the cicadas under 0.6x the engine RMS
    at a cruise in the chase view.
  - **autumn and winter thin the birds:** at 13:00 over 8 s, `birds` RMS in autumn under 0.7x
    spring's and in winter under 0.5x; autumn by night has crickets (over 1e-4).
- Expected total: step 2's + 3.

### Step 4 - breaks, frame cost, docs

- **Breaks**, at least: `SEASONS_OPEN` left spring-only; `applySeason` not rebuilding; the switch
  through `teleport` (player and traffic reset); a summer colour leaking into spring; winter skipping
  the blob seeds (the stream shifts); the autumn colour from `rnd`; one colour for every maple; winter
  keeping the canopy; the conifers coloured by season; a limb wound inside out; the bare tree without
  its collider; grass unchanged in winter; the treeline unchanged in winter; insects on in winter; no
  cicadas in summer; boot ignoring a saved season. Each with a `row` field naming the row meant to
  see it (`.claude/tests/negtests/driving-simulator.json`, 57 now). Run them on copies with
  `negtest-copies.py` in foreground chunks (`--only`), not beside another Chromium suite. As in DS-2,
  a harness built from the suite's own boot and the new sections, copied verbatim, is fine when the
  whole suite is too slow here; say so and pass it on the unbroken page first. A MISSED break gets a
  row or an argued equivalence in the Results.
- **Frame cost**, SwiftShader, the forest at `teleport(400)`, chase and cockpit: draw calls and
  triangles per season; `buildChunk()` time per chunk per season (median of 10); the switch's whole
  rebuild time. Into `.claude/driving-simulator.md` § Measured.
- **Docs:** `.claude/driving-simulator.md` (DS-3 built, the assumed rows, § Architecture's chunks,
  trees and sound, § Testing with the rows and breaks, § Follow-ups' tree-expert item, the suite's
  count on line 6); `.claude/tests/README.md` (the count); `games/CLAUDE.md`'s Driving Simulator
  paragraph (it still says the other seasons are greyed out and the suite has 108 checks).

### Step 5 - ship

- `stamp-badge.sh games/driving-simulator/index.html`, then `check-inline-js` and `gates.sh` after
  the stamp (alone). Read the badge back out of the file.
- Move this plan to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>`, with a Results section.
- Land with `land-on-main.sh` (dry run first). Message:
  `feat(driving-simulator): summer, autumn and winter, each as Raleigh looks and sounds (DS-3)` with
  the session's trailers. If `behind`, merge `origin/main` into the branch, re-run the gates, check
  the other session's files survived.
- `TODO.md`: the entry to `DONE.md` with the badge string.
- Verify the Pages run for the landed SHA (two checks, then report).
- Report: the badge string, the playtest list, the assumed rows, the tree-expert verdict.

## Gotchas / bindings

- **Do not shift a random stream.** Every season must draw the same numbers in the same order from
  `rnd` and every `lr`, or the forest moves between seasons (and spring's bytes break). Skip a blob,
  never its seed draw. New per-tree variety comes from the position hash.
- **Do not switch through `teleport()`.** It resets the player and respawns the traffic
  (`:4254-4261`); the CD's spec keeps both.
- **The look is not `SETTINGS.season`.** The DST rows (`:297-306`) set `SETTINGS.season` directly to
  move the calendar; a builder reading it would bake autumn into a chunk built during them.
- **Record before you edit.** `SPRING_BEFORE` comes from the base page; recorded after a change it
  proves nothing.
- **`makeChunk` drops the arrays** (`:2984`): the rows read the GPU's buffers back, or use the
  `treeTest` hook; `upload()` returns `null` for an empty builder, so a chunk's `propMesh` can be
  `null` (guard it, and count it as an empty hash, not a skip).
- **The world pass culls back faces; the shadow pass does not.** A limb wound inside out is invisible
  in the picture but casts a shadow.
- **`bird()` makes nodes per call** (a panner and oscillators); that is by design, and the DS-2 node
  row runs with the ambient at 0. Route it through `amb.birdG`; do not add per-call nodes beyond what
  a voice needs, and never per frame.
- **Timed rows go red under load.** Run the gates alone; never count a catch only a timed row made.
  The sound rows here drive the scheduler on a timer for exactly this reason.
- **Hue of a linear colour:** convert each channel to sRGB first (the standard transfer function),
  then HSV. A scalar on a linear colour shifts its sRGB hue a little; the bands allow for it.
- **Two copies of shared prose:** the season row in `games/CLAUDE.md` and the TODO entry both say the
  seasons are greyed out; fix both in step 4 and step 5.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. No model names in commits or files.

## Validation

`check-inline-js` after every page edit; `gates.sh` at the end of every step, alone, red only where
the base page is red; the break list in step 4 with every break caught or argued. Beyond the gates,
the CD's eyes and ears (assumed: a phone, the chase view, sound on):

- Settings, Season: each of the four can be picked; the date jumps to its middle (Aug 6, Nov 6,
  Feb 4) and the road around you changes without moving you or the cars.
- Summer: deeper green; cicadas by day, katydids at night.
- Autumn: maples red and orange, oaks russet, birches and the town's street trees yellow, no two
  stretches of forest the same; tan grass; crickets at night and fewer birds.
- Winter: bare broadleaf trees (pines and firs still green), straw-brown grass, a few birds and no
  insects; at about 22:00, Orion high in the south.
- Spring: exactly as before.

## Follow-ups

- The look following the calendar inside a season (leaf-out in late March and April, colour peaking
  in late October, leaves down by December): an option the backlog names, not in this item.
- Snow and weather: a weather item.
- A twig layer or alpha cards for winter crowns, if the tree-expert review or the CD finds the bare
  limbs too sparse.
- Raleigh lawns are often tall fescue, which stays green in winter (inferred: general knowledge, not
  checked against a source); this plan browns them as the backlog chose. The CD may want them greener.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dsseasons.summer-autumn-winter.md
```

## Results (2026-11-04)

- **Step 1** (bfef3b5). Spring's chunks were recorded on the base page by GPU read-back (`COPY_READ_BUFFER`, verified legal for vertex and index buffers with the VAO unbound). Two runs were byte-identical. One chunk per environment: forest 416, fields 1568, suburb 7136, open 8288, town 10688. Rows 141 -> 146.
- **Step 2** (f773d37). Autumn hue ranges: maple 7.9-19.6, oak 25.7-36.3, birch 48.5-54.4, street trees 37.5-45.4. Forty maples spread 24.1 deg. The picture row's shares:

  | Season | Warm share | Green share |
  |---|---|---|
  | Spring | 0.0006 | 0.0929 |
  | Autumn | 0.0533 | 0.0046 |
  | Winter | 0.0311 | 0.0061 |

  Rows 146 -> 154. The tree-expert agent reviewed the shots (spawned by the overseer); its tuning landed in step 4 (follow-up file).
- **Step 3** (629a897). Insects, mean RMS: winter 0 by day and night, spring by night 0.00111, summer by day 0.00328 (cicadas), summer by night 0.00227 (katydids, 2.05x spring). Birds: autumn 0.506x spring's, winter 0.272x. Cicadas vs the engine: mean 0.05x. Rows 154 -> 157.
- **Step 4** (a4bdfd6). The tree tuning; 19 breaks added (list 57 -> 76), all caught by their named rows. Frame cost is in `.claude/driving-simulator.md` § Measured: winter has 1.12x the triangles, a season adds no draw calls, and a switch into winter takes 120 ms.
- **Step 5.** Badge `build 2026-11-04 04:01 UTC`. After merging main's CS-3 into the branch, the final gate run was GREEN: 157 passed, 0 failed.
- Follow-up file: `.claude/plans/DONE/dsseasons.summer-autumn-winter.follow-up.md`.
