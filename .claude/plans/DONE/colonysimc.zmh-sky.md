# colonysimc — a real sky for Colony Sim from the zmh-sky drop-in

**Status:** IMPLEMENTED 2026-11-27 (`9d05a02..4821773` plus the wrap-up, on branch `colony-sim-sky`; landed on `main` as one commit). Follow-up: `colonysimc.zmh-sky.follow-up.md`.
**Requested:** 2026-11-26 (CD, from the first playtest of the phase 1 draft).
**Scope:** `games/colony-sim/src/` (new generated `sky.js`; `render.js`, `main.js`, `ui.js`),
`games/colony-sim/build.mjs`, the generated `games/colony-sim/index.html`, a new
`games/colony-sim/LICENSE-d3-celestial.txt`, `.claude/tests/drive-colony-sim.cjs`,
`.claude/colony-sim.md`.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`). The "Implementation guidance" section is what
> the overseer reads to assign models and effort and to make decisions without
> asking.

## Goal

Colony Sim's sky is zmh-sky's: the real sun, the moon with its phase and earthshine, stars,
planets and the Milky Way, for an island at 15°S in the South Pacific. Game day 1 is a fixed
calendar date and each game day is the next date. One sun lights the scene and draws the
disc. The moon lights the night. The sky stays put when only the camera moves. Fog and the
water never show the discs. The ⓘ panel carries the star-data attribution and the page ships
`LICENSE-d3-celestial.txt`. The drive suite proves the frame, the sunrise side, the
camera-independence, the stars and the advancing moon. Each new row is shown to fail when its
behaviour is broken on purpose.

## Context

The CD's playtest feedback (TODO.md § Colony Sim, "A real sky from zmh-sky"): "The sky looks
weird when I rotate the camera; use the zmh-sky plugin ... sun, moon (with phases & earthshine
& etc), stars, milkyway". The CD's answers that day were a tropical island at about **15°S** in
the South Pacific (longitude left to this plan) on an **advancing calendar**. The CD also chose
to build a drop-in sky in zmh-sky first, with Colony Sim as its first user. That drop-in
**shipped on 2026-11-26** (zmhstudio plan `zmhskyb`, commits `0cbed49..aabbc22`, pushed). This
plan's trigger is met.

**What the page does today** (all in `games/colony-sim/src/render.js`, read for this plan):

- `FS_SKY` (lines 93-102) builds its view ray as `normalize(p.xyz / p.w)`, the far-plane point
  itself rather than that point minus the eye. So the sun's disc and glow slide as the camera
  orbits. Its stars are a hash grid over `d.xz / d.y * 90`, so they never turn with the night.
- `sunAt(hour)` (lines 290-297) is a simple arc. `palette(hour)` (lines 298-307) derives
  everything from it: `sun`, `sunCol`, `ambSky`, `ambGround`, `top`, `hor` and `night`. Its
  night "moonlight" is a fixed fake direction with no moon drawn.
- `setCommon` (lines 309-321) feeds `pal` to every lit program. Fog colour is `pal.hor`
  (line 315) and the fog distance is 2200 m (line 316).
- In `frame()` (lines 324-381), the clear colour is `pal.hor` (line 345). The sky is drawn
  first with the depth test off (lines 346-350). Then terrain, boxes and capsules draw
  (opaque), then the blended water with `depthMask(false)` (lines 368-372), then the shadow
  and selection discs. `pal.night` drives the fire's intensity (line 342) and the shadow
  strength (line 375), and it is returned as `{ night }` (line 380). `main.js:143` passes
  `out.night > 0.5` to `audio.tick` (crickets).
- The `light()` GLSL (lines 13-23) is one directional light (`uSun`, `uSunCol`) plus a
  hemispheric ambient (`uAmbGround`, `uAmbSky`), the fire and fog. It mixes in linear space.
  Every fragment shader ends with `pow(c, 1/2.2)`. The water's specular (line 85) reflects
  `uSun` only.
- The camera is standard right-handed GL: `lookAt` (lines 117-122) builds x = up × z, and
  `persp` (line 116) is the usual GL projection with near 0.25 and far 4000. `VP` is
  column-major (`mmul`, line 123) and uploaded with `transpose = false`.

**The island's compass already exists.** `island.js:46` says "landing on the south shore
(z+)". `la = π/2 ± 0.3` makes `dir` point roughly +z, and `island.js:53` names
`north = -dir` (inland, toward the scarp). So the island's own words already say +x east,
+y up, −z north. That is right-handed (E × N = x × (−z) = +y = U), and it is the exact frame
in the kit's README quickstart.

**The clock.** `sim.t` is game seconds and starts at `6 * HOUR` (`sim.js:56`).
`DAY = 86400` is exported (`sim.js:11-12`). `dayOf = floor(t / DAY) + 1` (`sim.js:16`). A
game day is 30 real minutes at 1x.

**The kit** (zmhstudio `plugins/zmh-sky/`, read for this plan). `createSky(gl, config)`
returns `{ update, draw, setConfig, lighting, dispose, project }` (`lib/zmh-sky-webgl.mjs:852-859`).
`data`, `observer` and `frame` are required; every other key defaults from `SKY_DEFAULTS`
(lines 57-79: `output: 'display'`, `constellationLines: false`, `earthshine: 100`,
`strict: true`, and so on). `draw({ viewProj, jdUT })` returns the lighting
(lines 611-635):

- `sun.dir` / `.color` / `.altDeg` / `.visible`. The colour ramps to 0 as the sun's centre
  goes from +2° to −1°.
- `moon.dir` / `.color` / `.illuminatedFraction` / `.phaseName` / …
- `ambient`, `exposure`, `nightFade` and `handedness`.

Every layer sits at the far plane (`LEQUAL`, no depth writes). The pass leaves BLEND disabled,
DEPTH_TEST on, `depthFunc(LESS)`, `depthMask(true)` and program/VAO/ARRAY_BUFFER null, and it
never touches the viewport or framebuffer (lines 15-19). It rebuilds the ray from the inverse
view-projection with no eye, which is the fix for this page's bug (lines 21-26). Its display
encode is `1 - exp(-x)`, then `pow(clamp(x), 1/2.2)` (lines 207-238). Before the gamma, that
is the same display-linear space this page lights in.

`gameClockToJd(start, dayIndex, hourOfDay, lonEastDeg)` (`lib/zmh-sky.mjs:1611`) gives local
mean solar time, so game noon is the sun's transit. The esm emit
`--mag 5 --parts stars,planets,glsl,webgl` was run for this plan. It gives 146,183 bytes, LF
line endings, exactly four `export const` (`ZMH_SKY`, `SKY_DATA`, `ZMH_SKY_GLSL`,
`ZMH_SKY_WEBGL`), no `import`, and no `</script`. That is what `build.mjs`'s stripping and its
two guards (lines 30-44) need.

**Moon phases** for the date this plan picks, computed with the kit at 15°S 150°W for 20:00
local time:

| Game day | Date | Moon |
| --- | --- | --- |
| 1 | 2027-07-05 | new (fraction 0.02) |
| 3 | 2027-07-07 | crescent 0.14 |
| 6 | 2027-07-10 | first quarter 0.44 |
| 14-16 | 2027-07-18 to 20 | full, 0.98-1.00 |
| 30 | 2027-08-03 | about new again |

The phase 1 median finish is day 13 (`.claude/colony-sim.md` § Measured), so a typical first
run sees dark Milky Way nights grow to a full moon. July is the southern dry season, with the
Milky Way's core high at night.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill;
`.claude/zmh/producer.md` § Plans says "Task-scoping skill: none"). One task per step, and each
is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Emit `src/sky.js`, add it to `build.mjs`'s ORDER, copy `LICENSE-d3-celestial.txt`, add the ⓘ Sky section, rebuild, sim tests | mechanical-edit | haiku | medium | every command, path and line of text is given verbatim below; passes the haiku-viability bar |
| 2 | Adopt `createSky` in `render.js`: delete the old sky, light the scene from the kit (sun, moon, ambient), disc-free fog, the night value, draw order, tune two gains against screenshots | cross-system | opus | high | fails haiku-viability on judgment: GL state ordering against a blended pass, colour-space matching between the kit and the page's lighting, and an on-screen tuning loop with no exact target |
| 3 | Six drive-suite rows, the header comment, five negative tests through `negtest.sh`, the gate | tests | sonnet | high | fails haiku-viability on judgment: pixel thresholds that pass on SwiftShader and still fail under each break, and reading a negative test row by row |
| 4 | `.claude/colony-sim.md`: files table, render row, calls, the sky section | docs | haiku | low | verbatim bullets given below |

- **Ordering / dependencies:** 1 → 2 → 3 → 4. Nothing is parallel-safe: 1-3 all rebuild
  `index.html`.
- **Files owned per task:**
  - Task 1: `games/colony-sim/src/sky.js` (new), `games/colony-sim/build.mjs`,
    `games/colony-sim/src/ui.js`, `games/colony-sim/LICENSE-d3-celestial.txt` (new),
    `games/colony-sim/index.html`.
  - Task 2: `games/colony-sim/src/render.js`, `games/colony-sim/src/main.js`,
    `games/colony-sim/index.html`.
  - Task 3: `.claude/tests/drive-colony-sim.cjs`. During its negative tests only, it makes
    temporary breaks of `src/render.js` and `index.html`, all restored by `negtest.sh`.
  - Task 4: `.claude/colony-sim.md`.
- **Validation per task:**
  - Task 1: `node games/colony-sim/build.mjs` prints `wrote index.html`;
    `node games/colony-sim/tools/test-sim.mjs` ends `SIM-TESTS: GREEN`; the page still loads
    (the old sky is still in place, so nothing visible changes yet).
  - Task 2: the same two commands, plus the existing drive suite unchanged and green
    (21 rows). The screenshots named in step 2 are taken and looked at.
  - Task 3: the suite ends `DRIVE: GREEN` with exactly 27 rows. Each negative test turns the
    rows named in step 3 red, and `negtest.sh scan` is clean.
  - Task 4: none beyond review.
  - Final gate: `bash .claude/scripts/gates.sh games/colony-sim/index.html` → `GATES: GREEN`,
    and `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- **Tier audit (required):** tasks 1 and 4 are haiku: every edit is given verbatim. Task 2
  fails the checklist on judgment. The look has no exact target. The colour-space match, the
  night floor and the gains are tuned by eye against screenshots, and the draw order must be
  reasoned against a blended, depth-write-off water pass. Task 3 fails on judgment: SwiftShader
  pixel thresholds have to separate a working sky from five different breaks.
- **Decision defaults** (calls made here, the CD's to overrule; task 4 records them):
  - **Observer: 15°S, 150°W** (`{ latDeg: -15, lonEastDeg: -150, heightM: 0 }`). This is
    French Polynesia's latitude band, and it is the kit README's own example longitude. The
    hour comes from `gameClockToJd`'s default offset (local mean solar time), so game 12:00 is
    solar noon and the clock label stays meaningful.
  - **Day 1 = 2027-07-05**, `START = { y: 2027, m: 7, d: 5 }`. This is two days after a new
    moon, so the moon is full around days 14-16 (see the table in Context).
    `dayIndex = Math.floor(sim.t / DAY)`, so game day 1 is index 0, and
    `hour = (sim.t % DAY) / 3600`. The date lives only in `render.js`. The sim, the saves and
    `test-sim.mjs` never see it.
  - **Frame: `{ east: [1, 0, 0], up: [0, 1, 0], north: [0, 0, -1] }`.** This matches
    `island.js`'s own compass (landing on the south shore, +z) and the camera's right-handed
    `lookAt`. Use the fixed frame, not one per seed. `strict` stays `true`, so a mirror throws
    on the first draw.
  - **Parts: `stars,planets,glsl,webgl` at `--mag 5`**. Constellation lines are off by
    default and the CD did not ask for them, so the 20 KB is saved. Planets stay on.
  - **Config:** `dpr` is the same `Math.min(2, devicePixelRatio)` the renderer already uses
    (`render.js:325`). Call `sky.setConfig({ dpr })` only when it changes. Leave every other
    key at its default (`starGain: 1`; the kit's phone `starGain` value is still awaiting the
    CD's playtest in zmhstudio).
  - **Draw order:** clear to black → terrain, boxes, capsules (opaque) → `sky.draw` → water
    (blended) → shadow and selection discs. The sky must come **before** the water: the water
    writes no depth, so a sky drawn after it would paint over any water with no opaque
    geometry behind it.
  - **Lighting needs the sky's numbers before the opaque pass.** Call
    `sky.update(jdUT)` at the top of `frame()`. It returns the same lighting object that
    `draw` does. Use it for every `setCommon`, then call `sky.draw({ viewProj: VP, jdUT })`
    in its slot.
  - **Two lights.** Add `uniform vec3 uMoon, uMoonCol;` to the `LIGHT` GLSL and a
    `+ uMoonCol * max(dot(N, uMoon), 0.0)` diffuse term beside the sun's. Add a moon glint to
    the water's specular the same way as the sun's. `uSun`/`uSunCol` come from
    `light.sun.dir` and `light.sun.color` × `SUN_GAIN`. `uMoon`/`uMoonCol` come from
    `light.moon.dir` and `light.moon.color`.
  - **Ambient:** `uAmbSky = max(light.ambient × AMB_GAIN, NIGHT_FLOOR)` per channel, and
    `uAmbGround = 0.5 × uAmbSky`. Start at `SUN_GAIN = 1.25` (the old palette's peak),
    `AMB_GAIN = 1` and `NIGHT_FLOOR = [0.02, 0.025, 0.05]`, then tune in step 2. The floor
    exists because this is a watched sim and the settlers must stay readable on a moonless
    night. Keep it a named constant and record it as a call.
  - **Fog colour is disc-free and never sampled from the pass** (the skill's "discs in the
    fog" trap). It is the mean over 8 azimuths at 2° altitude of
    `ZMH_SKY.skyRadiance(dirEnu, sunEnu, { quality: 'low' }) × light.exposure`, mapped
    `1 - exp(-x)`, plus `light.nightFade × SKY_DEFAULTS.nightSky`. This is the pass's own
    `zmhAtmosphere` / `zmhDisplay` before the gamma, so the fog meets the horizon.
    `sunEnu = [d[0], d[1], -d[2]]` from `light.sun.dir` (host → ENU under this frame).
    Recompute only when `jdUT` has moved more than one game minute (`1 / 1440` day), and
    cache it. The fog distance stays 2200 m.
  - **`night`** keeps its old meaning and range, so the fire, the shadows and the crickets
    behave as before:
    `night = 1 - clamp((sin(light.sun.altDeg · π/180) + 0.08) / 0.35, 0, 1)`.
    `frame()` returns `{ night, light }`.
  - **Delete**, don't comment out: `VS_SKY`, `FS_SKY`, `P.sky`, `sVAO` (once no longer used;
    `render.js:213` is its only creation), `sunAt` and `palette`. Remove `hex`/`mix3` only if
    nothing else uses them (grep first).
  - **Create the sky once in `makeRenderer`**, after the programs. It throws inside
    `makeRenderer` on a bad config, which is the right place.
- **Embedded-content QA (required):** done for this draft.
  - Every line cited above was read during drafting (render.js 13-23, 85, 93-102, 116-123,
    213, 290-381, 448-453; sim.js 11-17, 56; island.js 46-53; main.js 138-143; ui.js 155-166;
    build.mjs 17-44; the kit's lines as cited).
  - The emit's byte count, export count, import count and `</script` count were measured, not
    estimated.
  - Moon-phase table: computed with the kit (`gameClockToJd` + `skyAt`) at 20:00 local.
  - Sunrise check arithmetic: on 2027-07-05 at 15°S the declination is about +22.7°.
    `cos A = sin δ / cos φ = 0.386 / 0.966 = 0.40`, so the azimuth is about 66° (east of
    north). The ENU direction is about (0.91, small, 0.40), and in host terms x ≈ +0.91,
    z ≈ −0.40.
  - Suite count: the baseline is 21 rows that run, re-derived from
    `.claude/tests/drive-colony-sim.cjs`. That is one test-sim row (lines 30/31, one try/catch)
    plus 20 page rows (lines 46-207). This plan adds exactly 6, so 27. Confirm the baseline by
    running the suite before task 3, and state the invariant as "the suite grows by exactly 6".
- **Escalation triggers:** stop only if the drive suite is red on the unmodified baseline (a
  pre-existing break), or if `createSky` throws on this page's frame (it must not: the frame was
  checked right-handed above). If it does, the cited facts are wrong and the plan needs
  re-grounding, not a sign flip.
- **Playtest:** yes. Watch from landing through day 1's evening into night at 4x-16x:
  - The sun rises on the right of the default view, north of east (the view faces the camp,
    roughly north), arcs high through the north and sets on the left.
  - Orbiting the camera never moves the sun against the land.
  - At night: stars, the Milky Way, the thin crescent setting after the sun on day 1-3, and
    the planets.
  - Jump a week ahead with the speed buttons: a half moon, then a full moon around day 14 that
    lights the ground.
  - The fire still glows at night. The settlers are still readable on a moonless night.
  - The ⓘ panel's Sky section and its licence link open.
  - On the phone, check that the stars read; if not, say so (the kit's `starGain` is the knob).
- **Publish:** default. This is player-facing, so the overseer publishes in its wrap-up (the
  push to `main` is the deploy) and verifies the Pages run per `.claude/zmh/producer.md`
  § Publish. The report quotes the badge read back from `games/colony-sim/index.html`.
- **Commit strategy:** one conventional commit per step, scope `colony-sim`, on branch
  `colony-sim-sky`. Land it as one commit with `.claude/scripts/land-on-main.sh`
  (dry run first), per § Integration. Branch before the first commit (§ Integration: commits on
  the primary checkout's `main` are left behind by the landing).

## Steps

1. **Bring the kit in (task 1).**
   - Find the CLI: `D:/gitrepos/zmhstudio/plugins/zmh-sky/cli/zmh-sky.mjs` on the CD's
     Windows box (zmhstudio at `aabbc22` or later). Elsewhere, use the newest
     `~/.claude/plugins/cache/zmhstudio/zmh-sky/*/cli/zmh-sky.mjs` whose sibling
     `lib/zmh-sky-webgl.mjs` contains `function createSky` (`aabbc224f5e8` does).
   - Run
     `node <cli> emit --format esm --mag 5 --parts stars,planets,glsl,webgl --out games/colony-sim/src/sky.js`.
     It prints `ZMH-SKY-EMIT=... bytes=146183` (a little more or less if the kit moved; the
     first header line records the command). Never pass `--keep-comments`.
   - `games/colony-sim/build.mjs:17`: insert `'sky.js', ` immediately before `'render.js'` in
     `ORDER`.
   - Copy the kit's `data/LICENSE-d3-celestial.txt` (beside the CLI's `../data/`) to
     `games/colony-sim/LICENSE-d3-celestial.txt` byte for byte.
   - `games/colony-sim/src/ui.js`, in `showInfo()`: insert this immediately before the
     `<p class="role">First draft.` line (line 163):
     `<h3>Sky</h3><p>The real sky over an island at 15°S in the South Pacific, from 5 July 2027 on: each game day is the next date, so the moon runs through its phases. Drawn by zmh-sky. Star data: XHIP (Anderson &amp; Francis 2012) via d3-celestial, (c) 2015 Olaf Frohn, BSD-3-Clause; constellation lines after the IAU figures, modified by O. Frohn; planet elements: JPL (Standish), Table 1. <a href="LICENSE-d3-celestial.txt" target="_blank" rel="noopener">Licence</a>.</p>`
     The attribution sentence is the skill's line verbatim, with `&` escaped for the HTML.
   - Run `node games/colony-sim/build.mjs` and `node games/colony-sim/tools/test-sim.mjs`.
   - Commit by explicit path (`src/sky.js`, `build.mjs`, `src/ui.js`,
     `LICENSE-d3-celestial.txt`, `index.html`):
     `feat(colony-sim): bring in the zmh-sky drop-in (generated sky.js) and its attribution`.
   - Done when the build and the sim tests are green, and the page loads with no console
     error (`node .claude/scripts/smoke-mobile.cjs games/colony-sim/index.html` →
     `SMOKE: GREEN`).

2. **Adopt `createSky` (task 2)**, per the Decision defaults:
   - In `render.js`, add `import { ZMH_SKY, SKY_DATA, ZMH_SKY_WEBGL } from './sky.js';` and
     `import { DAY } from './sim.js';` (the build strips both; the names are bundle globals).
   - Add the constants `SKY_OBSERVER`, `SKY_START`, `SKY_FRAME`, `SUN_GAIN`, `AMB_GAIN` and
     `NIGHT_FLOOR` near the top, each with a one-line comment that names the call.
   - Create the sky in `makeRenderer`. In `frame()`:
     - work out `jdUT`;
     - call `sky.update`;
     - build the uniforms (`setCommon` takes the lighting plus the derived fog and night
       instead of `pal`);
     - clear to black;
     - draw opaque, then `sky.draw`, then water, then the discs;
     - return `{ night, light }`.
   - `main.js` keeps reading `out.night` (line 143). No change there unless the call shape
     changes.
   - Rebuild. Take screenshots with the existing suite's `--shots <dir>` plus a scratch script
     (keep that script out of the repo). Use `__CS.G.sim.t` set to day 1 at 06:30, 09:00,
     12:00, 18:15 and 23:00, and day 15 at 23:00, rendered with `G.R.frame(...)` as the suite's
     colour row does. Tune `SUN_GAIN`, `AMB_GAIN` and `NIGHT_FLOOR` until midday is no darker
     than the old build's midday shot (take it first, from `HEAD` before this step), dusk is
     warm, and a moonless 23:00 still shows the settlers and the camp. Record the final three
     values and one sentence on why in the commit body.
   - Run `node games/colony-sim/tools/test-sim.mjs` and the existing drive suite (21 rows,
     green).
   - Commit `src/render.js`, `src/main.js` (if touched) and `index.html`:
     `feat(colony-sim): the real sky — zmh-sky's sun, moon, stars and Milky Way light the island`.

3. **Prove it (task 3).** Add six rows to `.claude/tests/drive-colony-sim.cjs`, after the
   colour row (line 57). Pause first (speed 0 or `G.overlay` as the existing rows do). Set
   `G.sim.t` and call `G.R.frame(...)` directly, reading pixels in the same task, as the colour
   row does. Restore `G.sim.t` and the camera afterwards.
   1. `the sky's frame is right-handed (handedness +1)`: `out.light.handedness === 1`.
   2. `day 1 sunrise is in the east, north of east`: at day 1 06:30 (`sim.t = 6.5 * 3600`),
      `sun.dir[0] > 0.8`, `sun.dir[2] < -0.2` and `sun.altDeg > -2`. Then point the camera at
      the sun: `cam.yaw = atan2(-dir.z, -dir.x)` (the eye sits at
      `target + (cos yaw, ·, sin yaw)`, so it looks along −(cos yaw, sin yaw)), with a low
      pitch. Render, and find the brightest pixel within 40 px of
      `G.R.project(eye + 3000 × dir)`. It must be brighter than the frame's median by a clear
      margin. Pick the margin from the measured numbers and print them.
   3. `the sky does not move when only the camera does`: at day 1 09:00 and at 23:00, with
      pitch about 0.15 (top fifth of the frame all sky), render. Translate both the camera
      target and the eye by (+20, 0, +20) m with yaw, pitch and dist unchanged, and render
      again. The mean absolute difference over the top 20% rows is < 1/255 per channel.
   4. `stars show on a dark night`: day 1 23:00 (the crescent has set), camera tilted up.
      Count the pixels in the top band brighter than 3x the band median. There must be at
      least the threshold you measure halved (print the count).
   5. `the calendar advances the moon`: `light.moon.illuminatedFraction` is < 0.1 on day 1 at
      20:00 and > 0.9 on day 15 at 20:00.
   6. `the ⓘ panel credits the star data and its licence ships`: open the info overlay. Its
      text contains `XHIP (Anderson & Francis 2012) via d3-celestial`, and the link's target
      file exists on disk beside `index.html`.

   Update the header comment's list of page checks. Then run five negative tests through
   `bash .claude/scripts/negtest.sh` (each a temporary edit to `src/render.js` plus a rebuild,
   restored afterwards):

   | Break | Rows that must go red |
   | --- | --- |
   | (a) frame north `[0, 0, 1]` (a mirror; `createSky` throws) | 1 and every pixel row; the load row may go red too, and that is expected |
   | (b) frame rotated 180° (`east: [-1, 0, 0]`, `north: [0, 0, 1]`, still right-handed) | 2 only, of the new rows |
   | (c) `jdUT` offset by `cam.tx * 1e-4` (a sky that depends on the camera) | 3 |
   | (d) `layers: { stars: false, milkyWay: false }` in the config | 4 |
   | (e) `dayIndex` forced to 0 | 5 |

   Then run `negtest.sh scan` and get a clean result. Commit the suite:
   `test(colony-sim): drive rows for the real sky (frame, sunrise, camera, stars, moon, credit)`.

4. **Write it down (task 4)** in `.claude/colony-sim.md`:
   - § Files: add the row
     `| \`src/sky.js\` | **generated, do not edit**: zmh-sky's drop-in as an ES module (\`emit --format esm --mag 5 --parts stars,planets,glsl,webgl\`; the command is its first line). Regenerate from the zmhstudio checkout or the plugin cache, then rebuild |`.
   - Change the `src/render.js` row's "sky and sun from the clock" to
     "zmh-sky's sky pass (`createSky`) lighting the scene from its sun, moon and ambient".
   - § Calls made while building: replace the bullet
     `- A sun on a simple arc, not the zmh-sky kit's real sky.` with
     `- The sky (plan colonysimc, 2026-11-26): 15°S 150°W, day 1 = 5 July 2027 (two days after a new moon, so full around day 14-16), local mean solar time, frame +x east / +y up / −z north (the island's own compass), no constellation lines, a night ambient floor so settlers stay readable on a moonless night, fog coloured from the disc-free sky radiance at the horizon.`
   - Add a short `### The sky` subsection under § Architecture notes, covering: the draw order
     and why the sky goes before the water; that `render.js` is the only place a date exists;
     the fog rule; and how to regenerate `sky.js`.
   - Commit: `docs(colony-sim): the real sky's calls and how to regenerate it`.

## Gotchas / bindings

- **`src/sky.js` is generated.** Never hand-edit it, and never emit it with `--keep-comments`.
  The library header says "export function", and `build.mjs`'s regex would turn that comment
  into a bundle global or trip its `^\s*export\b` guard. After any regeneration, re-check it
  has exactly four `export const`, no `import` and no `</script`.
- **`build.mjs` turns every export into one bundle-wide global and throws on a duplicate**
  (lines 22-28). The four kit namespaces are new names: do not also export `ZMH_SKY` or similar
  from `render.js`. Import them.
- **Do not compute the view ray from the eye or the far-plane point anywhere.** That was this
  page's bug. The kit uses `P(x,y,0) − P(x,y,−1)` from the inverse view-projection. Delete
  `FS_SKY` rather than patch it.
- **Never sample the sky pass for fog or the water** (Driving Simulator's "discs in the fog",
  in the kit's skill). Use the disc-free `skyRadiance` path described in the Decision defaults.
- **The kit's conventions are claims to check against the host** (`.claude/zmh/producer.md`
  § Plans). This plan checked `lookAt` (right-handed, `render.js:117-122`) and the column-major
  `VP` (`mmul`, line 123). If you change the camera math, re-check both. A mirror passes every
  number except `handedness`, and `strict: true` throws on it.
- **GL state after `sky.draw`:** BLEND off, DEPTH_TEST on, `depthFunc(LESS)`, `depthMask(true)`,
  no program and no VAO. The water block re-enables blending and sets `depthMask(false)`
  itself (`render.js:369`), and the discs bind their own VAO. Do not rely on any other state
  surviving the call.
- **`sky.update(jdUT)` before the opaque pass**, `sky.draw` after it: the scene must be lit by
  this frame's sun, not last frame's.
- **The sim stays date-free.** No date, `jdUT` or kit call goes into `sim.js`, `brain.js`, the
  save or `test-sim.mjs`. Determinism and old saves are untouched.
- **`frame()` is also called directly by the drive suite** (`drive-colony-sim.cjs:51-52`, with
  `capsOf` returning `[]`). Keep its signature, and keep it safe to call twice in one task.
- **Windows (the CD's box):** run the gates and drive in the same Bash call as the three
  exports in `.claude/zmh/producer.md` § Environment (`PYTHONUTF8`, `NODE_PATH` to an npx-cache
  `playwright-core`, `SMOKE_CHROMIUM`). The suite already launches with
  `--use-angle=swiftshader --enable-unsafe-swiftshader`. Run `gates.sh` alone, never beside a
  negative-test copy (timed rows go red when two Chromium suites share the box). Run
  `.claude/scripts/eol-guard.sh` before landing; a Python text-mode edit rewrites LF as CRLF.
- **Commit hygiene:** explicit paths only, never `git add -A`. `.claude/worktrees/` is
  untracked in the primary checkout and must stay out of every commit.
- **Size:** `index.html` grows from about 187 KB to about 335 KB. That is expected; do not cut
  the magnitude to save it without a reason.
- **Perf:** the sky pass shades only sky pixels when drawn after the opaque geometry. If
  SwiftShader frame time balloons, check that the sky is not drawn before the terrain.

## Validation

- Per step, as in the guidance table.
- End-to-end: `bash .claude/scripts/gates.sh games/colony-sim/index.html` → `GATES: GREEN`. This
  includes `smoke-mobile.cjs` at the iPhone 13 viewport and `drive-colony-sim.cjs` at 27 rows.
- `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- `node games/colony-sim/tools/run.mjs --seeds 5` still finishes 5/5. The sim is untouched, so
  this is a sanity check, not a rebalance.
- The badge in `games/colony-sim/index.html` matches the deployed page (§ Publish).
- Manual playtest beyond gate-green: what the Playtest bullet lists. Only the CD can judge the
  look and whether stars read on a phone.

## Follow-ups

- Driving Simulator could later move from its own port to `createSky` (zmhstudio `zmhskyb`
  follow-up). That is not this plan's to do.
- The kit's phone `starGain` value awaits the CD's playtest in zmhstudio. If Colony Sim's stars
  read dim on the phone, set `starGain` here once the kit documents a value.
- Seasons and weather (CS-4) would read the same date. Keep `SKY_START` the one place the date
  is defined.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/colonysimc.zmh-sky.md
```
