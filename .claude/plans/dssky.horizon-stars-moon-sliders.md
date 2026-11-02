# dssky - Driving Simulator: no column under a low sun or moon, brighter stars, the sun and moon as they really look, and a slider for each thing in the sky (DS-7, DS-5, DS-4, DS-6)

**Status:** DRAFT (2026-11-02). Drafted on `main` at `e43a233` (the page's badge
`build 2026-11-02 12:27 UTC`, the suite at 108 checks, the break list at 25).
**Requested:** 2026-11-01 and 2026-11-02, the CD. DS-4, 2026-11-01:

> Moon realism: yes, add this (and sun position) to the backlog for driving sim.

DS-5, DS-6 and DS-7, 2026-11-02, after the first playtest of the real sky (with five iPhone
screenshots, chase view):

> * in game the stars are too dim, increase brightness
> * Add sliders in the settings menu for each celestial object (stars, milky way, sun, moon
>   (sunshine), moon (earthshine), any others i missed)
> * Sun rise, sun set, moon rise, and moon set all show a vertical smearing at the horizon. Im
>   attaching some screenshots to show what i see

**Scope:** `games/driving-simulator/index.html` (`GLSL_COMMON`, `FS_WORLD`, `FS_SKY`, `VS_STARS`,
`FS_STARS`, `setFrameUniforms()`, `renderScene()`, `updateSky()`, the settings markup, `SETTINGS`
and its loader, the settings panel, the THE ROAD notes, `window.__DS`), the suite
`.claude/tests/drive-driving-simulator.cjs`, the break list
`.claude/tests/negtests/driving-simulator.json`, and the docs `.claude/driving-simulator.md`,
`.claude/tests/README.md`, `TODO.md`, `DONE.md`. Source TODO entries: `TODO.md` § Now, the four
`[driving-sim]` items "The sun and the moon as they really look", "No column of light...",
"Brighter stars" and "A slider for each thing in the sky", merged into one entry pointing here.
Full specs: `.claude/driving-simulator.md` § Backlog, DS-4 to DS-7 (this plan corrects them where
noted below). The kit: zmhstudio `plugins/zmh-sky/` (README and
`skills/sky-pipeline/SKILL.md`, which every step reads first).

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

A low sun or moon no longer paints a bright column down the hills, the grass and the car. Stars
read plainly on a phone: Polaris white, a magnitude-4 star clearly there. The sun and the moon are
their real sizes, lifted by refraction at the horizon, and the moon has its phase, earthshine on
the dark part, soft maria, is seen by day, and lights the night by its phase; a bright moon dims
the stars and the Milky Way. A SKY section in the settings holds one slider per thing in the sky
(Stars, Planets, Milky Way, Sun, Moonlight, Earthshine), 0-200%, saved. DS-7 and DS-5, the two
things the CD saw on the phone, reach `main` first, at step 2.

## Context

- **DS-7 is a bug since the game shipped** (`15ad39d`). The cause is traced in the code, not yet
  rendered: three places sample `skyCol()` with the elevation clamped, and `skyCol()` includes the
  sun and moon discs (read 2026-11-02):
  - `index.html:2351`, the fog colour in `FS_WORLD`:
    `skyCol(normalize(vec3(-V.x, max(-V.y, 0.0) * 0.4 + 0.02, -V.z)))`;
  - `index.html:2382`, the hills in `FS_SKY`: `skyCol(normalize(vec3(d.x, 0.02, d.z)))`;
  - `index.html:2343`, paint reflections: `R.y` clamped at -0.05;
  - `index.html:2187-2190`, the discs: the sun's `smoothstep(0.99985, 0.99993, cs) * 30.0` and its
    two lobes `pow(cs, 10) * 0.18` and `pow(cs, 120) * 0.6`, then the moon's
    `smoothstep(0.99975, 0.99985, cm) * 1.2 * uNight` and its glow `uMoonCol * pow(cm, 30) * 0.6`.
  - So when a body is within about a degree of 1.15 deg altitude (elevation 0.02 rad), every
    fragment below the horizon at its azimuth takes the disc into its fog colour. Computed with
    the kit: on May 5 the sun is at 1.0 deg at 19:55 EDT (azimuth 289.7), the screenshots'
    7:50-7:57 PM. The moon is at 1.0 deg rising at 00:20 EDT on May 6.
- **DS-5's cause is not traced.** What the code says (`VS_STARS`, `index.html:2398-2416`): points
  are already sized by `uPx = RSCALE` (`index.html:3285`), and `RSCALE = min(DPR * scale, 1.75)`
  with `DPR = min(devicePixelRatio, 2)` (`index.html:3933-3937`). So a star is sized in CSS
  pixels already: the spec's candidate "points sized in framebuffer pixels on a 2x screen" is ruled
  out by reading. The arithmetic below is derived from the code, a hypothesis to measure, not a
  cause:
  - iPhone 13 at medium graphics (`GFX[1].scale = 0.85`, `index.html:3350-3354`): RSCALE 1.7.
  - Polaris at 22:00 May 5 (35.4 deg up, about 0.34 mag of extinction): intensity about 0.17,
    `uStarK = 3.2 * 1.8 * 1 = 5.76`, so a centre value near 1.0. The point is 2.6 px wide, sigma
    floored at 0.5 px, so its brightest pixel is 0.37-1.0 of that by where its centre falls in the
    pixel: about 94-253 in 8 bits.
  - A magnitude-4.0 star at the same height: intensity about 0.069, a centre value near 0.40,
    about 37-101 in 8 bits.
  - Each star is about one framebuffer pixel, which is 0.6 CSS px, under 2 device pixels on a
    3x screen. The likeliest reading of "too dim" is small and phase-dependent, not a low gain.
    Step 2 measures it.
- **DS-4 and DS-6** are specified in `.claude/driving-simulator.md` § Backlog. DS-4 waited for
  DS-1 (landed 2026-11-02 as `fc7f66e`); DS-6 waited for DS-5 (they share `STAR_GAIN`), and goes
  after DS-4 here so its Earthshine row exists and its Sun and Moonlight sliders scale the terms
  DS-4 rewrites.
- **Why one arc:** all four edit the same shaders, `updateSky()` and the suite's sky section.
  Four plans on one 4,065-line file would each go stale the moment the one before it landed.
  DS-2 (traffic sound) is its own plan, `dssound.traffic-stereo-doppler.md`, and runs after this
  one.

## Corrections to the spec (2026-11-02, while drafting)

- **Refraction at the horizon is 0.48 deg, not 0.57.** `ZMH_SKY.refractionDeg()` takes the TRUE
  altitude (`index.html:543-547`: `1.02 / tan(h + 10.3 / (h + 5.11))` arcmin). Computed:
  `refractionDeg(0) = 0.483`, `refractionDeg(-0.833) = 0.618`, `refractionDeg(1) = 0.362`. The
  spec's 0.57 (34') is the refraction at APPARENT altitude 0. The check becomes: the drawn body's
  altitude minus its geometric altitude equals `refractionDeg(geometric)` within 0.01 deg, and at
  the almanac's rise and set (geometric centre -0.833) the drawn upper limb is within 0.05 deg of
  the horizon (-0.833 + 0.618 + 0.265 = 0.05).
- **The moon's size over this game's calendar** is 0.489-0.548 deg across (60 days from Mar 1,
  2026, from `topoDistanceKm` through `2 asin(1737.4 / d)`), inside the spec's 0.49-0.56.
- **"Points sized in framebuffer pixels"** is ruled out by reading (Context above). Step 2 keeps
  the other candidates: the gain, the 0.5 px sigma floor (fixed in framebuffer pixels, so a smaller
  share of a CSS pixel at a lower render scale), and where the point's centre falls in the pixel.

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

### DS-7, the column

- Split `skyCol(d)` in `GLSL_COMMON` into `skyBase(d)`: the gradient, the sunset tint, the sun's
  broad lobe `pow(cs, 10) * 0.18` and the moon's broad glow `uMoonCol * pow(cm, 30) * 0.6`; and
  `skyBodies(d)`: the sun disc, the sun's aureole `pow(cs, 120) * 0.6` and the moon disc. The
  aureole goes with the bodies: it is about 6 deg half-width at half height
  (`acos(0.5^(1/120))`), so in the fog it would still paint a 12-deg band. The two broad lobes are
  21 and 12 deg half-width and colour the haze toward the body, which is right.
- Fog (`FS_WORLD`), hills (`FS_SKY`) and reflections call `skyBase()` only. The sun's highlight on
  paint is the specular term `uSunCol * sp * sh`, already there.
- `FS_SKY` adds `skyBodies(d)` only on the real view ray **and only above the ridge**
  (`d.y >= ridge`). Today the hills replace `c` below the ridge, which hides a disc behind them;
  keep that.
- At step 1 the bodies' shapes stay exactly as today (DS-4 rewrites them at step 3), so the sky
  above the ridge is byte-identical to before.

### DS-5, the stars

- **Measure first** (step 2's first task) in a second browser context at the phone's numbers:
  viewport 844x390, `deviceScaleFactor: 3` (so DPR 2 and RSCALE 1.7 at medium). Five reference
  stars at 22:00 EDT on May 5: Arcturus (0.0), Vega (0.0), Regulus (1.4), Polaris (2.0), and one
  star of magnitude 3.0-3.5 chosen from `SKY_DATA` and cited by HIP number. For each, the added
  value (STARS.on minus STARS.on false) at its brightest pixel, **at four sub-pixel phases**
  (the aim moved by a quarter pixel each way) and the minimum over them; plus the count of
  stars above a threshold of 40 in a fixed 200x100 patch round Polaris. Record the table in
  `.claude/driving-simulator.md` (DS-5) before changing anything.
- **Targets** (*chosen*, from the spec): at the phone's render scale, at every phase, Polaris
  adds at least 200 and a magnitude-4 star at least 60 (8-bit luminance over the sky). Venus
  stays a point: the 2.5 clamp stays.
- **Levers, in this order:** (1) the sigma floor in CSS pixels, `max(..., 0.5 * uPx)` instead of
  0.5, which gives every faint star the same CSS footprint at any render scale and removes most of
  the phase dependence; (2) `STAR_GAIN`. Say which in the Results, with the before/after table.
  Keep the kit's magnitude law and `MW_GAIN` as they are.
- The suite's own viewport (844x390 at scale 1, RSCALE 0.85) keeps its star rows; restate any row
  whose threshold was tied to 3.2 or to the 0.5 px floor, and name it.

### DS-4, the sun and the moon

- **One sun, one moon, geometric for the light.** `SKY.sun`, `SKY.moon`, `SKY.day`, `SKY.night`
  and every light term stay on the geometric directions. Refraction lifts only the DRAWN discs:
  two new world directions `SKY.sunDiscW` and `SKY.moonDiscW` (each `enuToWorld` of the ENU
  direction rotated up in its own vertical plane by `refractionDeg(altDeg)`), new uniforms
  `uSunDisc` and `uMoonDisc` used by `skyBodies()` only.
- **Real sizes:** the sun's angular radius 0.265 deg; the moon's `asin(1737.4 / topoDistanceKm)`,
  uniforms `uSunR`, `uMoonR` (radians). The sun's disc is a smoothstep from the radius to the
  radius plus one pixel's angle (pass `uPxAng`, the pixel's angle at the current field of view, or
  use `fwidth` in `FS_SKY`), times today's 30. *Chosen*: no minimum size in pixels; the CD can
  ask for one if they read too small (about 3.6 CSS px across in the chase view).
- **The moon disc is the kit's `zmhMoonDisc`** (`ZMH_SKY_GLSL.MOON_DISC_GLSL`, `index.html:901-929`,
  already in the block): pass `uMoonDisc`, the world sun `uSunDir`, `uMoonR`, and the earthshine.
  Keep its coverage gate. Its colour times `MOON_K = 1.2` (today's disc level) times the Moonlight
  slider (step 5), **never times `uNight`**, so it shows by day as added light over the blue.
- **Earthshine** *chosen*: `ES_GAIN * ZMH_SKY.earthshineFraction(phaseAngleDeg)`, with
  `ES_GAIN = 600`, so a thin crescent's dark part sits at about 5% of its lit limb
  (`8.2e-5 * 600 = 0.049`). The kit's `EARTHSHINE_REFERENCE_FRACTION` is another host's art dial
  for an HDRP field, not this.
- **Maria** *chosen*: the page's own, three or four soft darker patches from `vn()` at low
  frequency, darkening the lit shade by at most 25%, in a frame fixed to the moon's face: built
  from the moon's direction and the world direction of the celestial pole of date (`SKY.starW`
  times the J2000 pole, so the pattern turns with the sky through a night). Libration is ignored.
  The patches must stay inside the coverage gate.
- **Moonlight:** `SKY.moonCol` keeps its colour, and its scale becomes
  `SKY.night * ZMH_SKY.moonIlluminanceLux(phaseAngleDeg, moonAltDeg) / ZMH_SKY.FULL_MOON_ILLUMINANCE_LUX`
  (the kit's 5-deg horizon ramp replaces `smooth(-0.05, 0.2, ...)`). Add a moonlit share to the
  night `SKY.ambSky` scaled the same way, so that a full-moon midnight is at least 1.5x a
  new-moon midnight in mean luminance and both are darker than dusk. Tune the share by measuring
  the row, never by eye.
- **A bright moon dims the stars** *chosen*: the star pass's gain and `MW_GAIN` times
  `1 - 0.6 * moonBright`, where `moonBright = moonPhaseFactor(phaseAngleDeg) * clamp(moonAltDeg / 5, 0, 1)`.
  A faint glow round the moon grows with the phase: the moon's broad glow in `skyBase()` times
  `moonPhaseFactor`.
- **The test hook:** `__DS.SKY.sunDiscW`, `.moonDiscW`, the radii, and `__DS.MOON_K`, `ES_GAIN`.
  The suite's `__dsAimed()` gains an optional field-of-view argument (the suite's own helper,
  `drive-driving-simulator.cjs:757`) so a row can zoom on the moon.

### DS-6, the sliders

- `SETTINGS.sky = { stars: 100, planets: 100, mw: 100, sun: 100, moon: 100, earthshine: 100 }`,
  merged on load exactly as `vols` is (`index.html:1209-1212`), so an old save reads 100
  everywhere. Same key, `drivingSimulator.settings.v1`, never a new one.
- A `<h3>SKY</h3>` after TIME (`index.html:66-81`) and rows built from a `SKY_KEYS` list the way
  `chan-rows` is built from `VOL_KEYS` (`index.html:3897`), `min="0" max="200" step="1"`, labels:
  Stars, Planets, Milky Way, Sun, Moonlight, Earthshine. They must fit at 320 px wide.
- What each scales (*chosen*, the spec's table): Stars, the star vertices' gain; Planets, the five
  planet vertices' gain; Milky Way, `MW_GAIN`; Sun, the sun's disc, aureole and broad lobe and its
  light `SKY.sunCol`; Moonlight, the moon's disc, glow and light `SKY.moonCol` and its ambient
  share; Earthshine, `ES_GAIN`.
- **Planets apart from the stars in the same draw:** a uniform `uPlanetK` and `uNStars`, picked in
  `VS_STARS` by `gl_VertexID >= uNStars`. The "one POINTS draw per pass" row stays as it is.
- **0% skips:** stars and planets at 0 both skip the POINTS draw; Milky Way at 0 passes
  `uMwGain = 0` (the shader already skips the term); the sun and moon at 0 drop their terms.
- **What "200% doubles" can be checked on:** the star and planet passes are added after the
  tonemap, so their pixels double (use a star that stays under 128). Everything else goes through
  the tonemap or saturates: there the check is on the value handed to the GPU (exactly 2x within
  1e-6), plus a pixel row that 200% is brighter than 100% and 100% than 50%.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans). One task per arc step; each is one session's work and one commit on the arc's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | DS-7: reproduce the column in a row, split `skyCol()` into `skyBase()` and `skyBodies()`, the column rows | rendering | opus | high | a shader split in a shared path (fog, hills, reflections, the mirror) that must leave the sky above the ridge byte-identical; the row must fail on today's page first |
| 2 | DS-5: measure the stars at the phone's numbers, raise them, rows; stamp and land DS-7 + DS-5 on `main` | rendering | opus | high | measure-before-change with a second browser context; a lever choice from data; landing mid-arc |
| 3 | DS-4a: refraction on the drawn discs, real sizes, the kit's moon disc with phase, earthshine and maria, the moon by day; the sun, refraction, phase, limb and pixel rows | rendering | opus | high | two directions per body (geometric for light, apparent for the disc); a kit GLSL function in the page's frame; rows that restate the sun row |
| 4 | DS-4b: moonlight by phase, the moonlit ambient, the moon dimming the stars and the Milky Way; the night-brightness and dimming rows | rendering | opus | high | exposure and ambient tuned against a measured ratio, under rows that already pin night darkness |
| 5 | DS-6: the SKY section and its six sliders, saved; the gains wired; the slider rows | cross-system | opus | medium | many small wires (settings, loader, panel, uniforms), but each scaling must be the right term and old saves must read 100 |
| 6 | Break list and negative tests; frame cost; docs | eval+docs | opus | high | each break must land on its own row; any MISSED needs a row or an argued equivalence; docs read from the code |
| 7 | Ship: badge, gates, land on `main`, Pages, TODO/DONE, report | ship | sonnet | medium | the documented procedure, exact commands below |

- **Ordering:** strictly 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7. Every step touches `index.html` and the
  suite, so nothing runs in parallel.
- **Files owned per task:**
  - 1: `GLSL_COMMON` (`skyCol` split), `FS_WORLD`'s fog and reflection lines, `FS_SKY`, the suite;
  - 2: `VS_STARS`, `STAR_GAIN`, the suite (a second context), `.claude/driving-simulator.md` DS-5's
    measured table; then the badge line and a landing;
  - 3: `skyBodies()`, `FS_SKY`'s uniforms, `setFrameUniforms()` or `renderScene()`'s sky uniforms,
    `updateSky()`'s disc directions, the hook, the suite;
  - 4: `updateSky()`'s light terms, `renderScene()`'s star and Milky Way gains, the suite;
  - 5: the settings markup, `SETTINGS` and its loader, the settings panel, `VS_STARS`'s gains,
    `renderScene()`, `updateSky()`'s light scales, the suite;
  - 6: the break list, the docs;
  - 7: the badge line, the plan's move to `DONE/`, `TODO.md`, `DONE.md`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every edit to the page, and `.claude/scripts/gates.sh games/driving-simulator/index.html`
  GREEN at the end of every step, run alone (check `uptime`; producer config § Environment:
  timed rows go red when two Chromium suites share the box).
- **Tier audit (required):** no step passes a haiku checklist.
  - Steps 1-4 each change a shader in a path the mirror pass shares, under pixel rows that must
    discriminate, and need an oracle the page cannot supply (opus, high).
  - Step 5 is many small wires, but the scaling of each term and the old-save rule need judgment
    (opus, medium).
  - Step 6 needs judgment on which row a break should land on (opus, high).
  - Step 7 is the procedure, but it pushes to `main` and verifies a deploy (sonnet, medium).
- **Decision defaults:** everything under "Design" above. Beyond it:
  - **The kit's way first.** Never patch the kit's code inside the `ZMH-SKY` block (it is
    generated). A kit bug goes to zmhstudio's `TODO.md` as a report, and the step stops if it
    blocks.
  - A choice not listed here goes into `.claude/driving-simulator.md`'s "Assumed, not decided"
    table as a row, never silently.
  - **A suite row the new rules contradict is restated** (same claim, the new rule) and named in
    the Results. Never delete a row to go green. Known now: step 3 changes the sun disc to its
    real size, so "the sun is drawn where it is" (`drive-driving-simulator.cjs:920`, which wants at
    least 20 saturated pixels at a 0.8-rad field of view, where a 0.53-deg disc is about 4.5 px
    across) is restated in step 3 with a measured count or a narrower field of view.
  - If a tolerance proves too tight for SwiftShader's pixels, widen it only after tracing why, and
    record the trace.
  - Times for the rows are found by bisection on the page's own `SKY` (its sun and moon are
    already proven against astronomy-engine by DS-1's rows), not typed in: a rendering row tests
    the picture, not the ephemeris.
- **The suite's oracles.** The suite never copies the page's or the kit's code. For DS-4's sun
  rows it uses its own Almanac sun (`drive-driving-simulator.cjs:35-52`); for the phase rows the
  Meeus 49.1 mean phases (`:96`) and the astronomy-engine record already typed in (`:100-101`). For
  refraction it may compute Bennett's / Saemundsson's formula itself (a published formula, typed
  in with its source), never call `ZMH_SKY.refractionDeg` as its own oracle.
- **Embedded-content QA.** The suite has 108 checks and the break list 25 (measured 2026-11-02 on
  `e43a233`). Each step grows the suite by exactly the rows it adds and restates; state the real
  total in each step's Results. Line numbers were read on `e43a233`; re-read before editing.
- **Escalation triggers** (stop and report to the CD; do not work around):
  - zmhstudio cannot be reached (no sibling clone and `add_repo ZackHelms/zmhstudio` refused).
  - The DS-7 repro row passes on today's page: the traced cause would then be wrong. Stop, keep
    the row, report what was measured. Do not ship a fix for an untraced cause.
  - The step-2 measurement shows the stars already meet the targets at the phone's numbers: then
    "too dim" is something the suite cannot see (the phone's display, its brightness setting).
    Stop and report the table; do not raise the gain blind.
  - Anything that would need a change to `drivingSimulator.settings.v1`'s key.
  - The sky passes cost more than a frame budget's worth on the perf block (step 6 measures).
- **Playtest** (after step 2, and again after step 7):
  - After step 2 (`build` string in the report): at sunset (about 7:50-8:05 pm) and moonrise
    (about 12:20 am on May 6), chase view toward the body: no column down the hills, grass or car.
    At 10 pm: Polaris white, the Big Dipper's stars and Leo's fainter ones plainly there.
  - After step 7: the moon's phase through a few game days (a waning gibbous on May 5-6, last
    quarter about May 9, new on May 16); the moon by day as a pale disc; the sun and moon small
    and real-sized; the crescent's dark part faintly lit; a full-moon night (May 31) brighter than
    a moonless one (May 16) and fewer stars under it. The SKY sliders: each at 0 and at 200.
  - Too small? A minimum disc size in pixels is the lever. Too bright or faint? Each slider, then
    `STAR_GAIN`, `ES_GAIN`, `MOON_K`.
- **Publish:** steps 2 and 7 push `main`, which is the publish. Verify the Pages run each time
  (producer config § Publish). Steps 1 and 3-6 push the branch only.
- **Commit strategy:** one conventional commit per step on the arc's branch, scope
  `driving-simulator`, ending "(dssky step N)". Steps 2 and 7 land the branch on `main` as one
  commit each with `.claude/scripts/land-on-main.sh <branch> <message-file>`, dry-run first.

## Resume here (a session told "run the next open step of this arc")

1. Read `CLAUDE.md` § Git workflow. Concurrent sessions push to `main`; never author a merge commit
   on `main`; `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main`
   immediately before any push to `main`.
2. Read this file in full, including every step's Results. Then read `.claude/driving-simulator.md`:
   § Backlog DS-4 to DS-7, § Architecture, § Testing, and the "Assumed, not decided" table; and the
   kit's skill `zmh-sky:sky-pipeline` (or `plugins/zmh-sky/skills/sky-pipeline/SKILL.md`).
3. The arc's branch is `ds-sky` (or the branch your session may push to), cut from `main`. After
   step 2's landing, merge `origin/main` into it before step 3 (`land-on-main.sh` refuses a branch
   that `origin/main` is not an ancestor of).
4. Run the first step below that is not DONE, and only that one. Then tick it, append a Results
   section (append, never rewrite), commit, push the branch, stop and report.

Tools:
- Gates: `.claude/scripts/gates.sh games/driving-simulator/index.html` (finds `playwright-core`
  itself).
- The suite alone: `node .claude/tests/drive-driving-simulator.cjs` (or with `DS_PAGE=<copy>`).
- Breaks: `python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/driving-simulator.json`
  in foreground chunks under about 9 minutes (`--only a,b,...`); `bash .claude/scripts/negtest.sh scan
  games/driving-simulator/index.html` after any surprise.
- Frame cost: `node .claude/scripts/frame-budget.cjs` (see `.claude/scripts/README.md`).
- Stamp: `.claude/scripts/stamp-badge.sh games/driving-simulator/index.html`.

## Steps

### Step 1 - DS-7: no column under a low sun or moon

- **First, the repro row, on today's page.** Add the row below and run it before touching the
  shaders. It must FAIL on today's page; record the measured ratios in the Results. (If it passes,
  stop: escalation trigger.)
  - Find, by bisection on the page's `SKY.hour`, 19:5x EDT on May 5 where `SKY.sun` is at 1.0 deg,
    and the time on May 6 where `SKY.moon` is at 1.0 deg rising (about 00:20).
  - For each: aim with `__dsAimed()` at the body's world direction, render, take the body's
    projected x; in the rows below the horizon (from 4 px under the horizon's projected y to the
    bottom), the mean luminance of a 3-px strip at the body's x against the strips at the
    projections of the directions 10 deg either side in azimuth (same altitude).
  - Row: "no column of light under a low sun or moon: at sunset (sun 1.0 deg) and moonrise (moon
    1.0 deg) the ground below the body is at most 1.25x as bright as 10 deg either side". Today
    the sun's case is expected far above 2x (the disc enters the fog at x30).
- Split `skyCol()` as in Design; switch fog, hills and reflections to `skyBase()`; add
  `skyBodies(d)` in `FS_SKY` above the ridge.
- A second row: "the sky above the ridge is unchanged by the split". The suite never copies the
  page's code, so it cannot render the old shader itself. *Default:* before the split, record in
  this step's Results the mean and a hash of the sky above the ridge at 12:00 and at 22:00 (chase
  view, fixed yaw); after it the means match within 0.5 and the 12:00 hash is equal. The sun row
  (`:920`) and the four star-pixel rows also stay green.
- The repro row now passes, and all 108 earlier rows stay green. Suite 108 + 2 = 110.

### Step 2 - DS-5: brighter stars; land DS-7 and DS-5

- **Measure** (Design, DS-5) in a second context, record the table in `.claude/driving-simulator.md`
  § Backlog DS-5 and in this Results section. Copy the `__dsPx` / `__dsAimed` helpers into the
  second page (they are defined by `page.evaluate` on the first one only).
- **Raise:** the sigma floor in CSS pixels first, then `STAR_GAIN`, until the targets hold at every
  phase. Re-measure; record after.
- Rows (in the second context): "at the phone's render scale (RSCALE 1.7) Polaris adds at least 200
  and a magnitude-4 star at least 60 at every sub-pixel phase"; "the patch round Polaris holds at
  least N stars above 40" (N from the measured after-value, minus 20%). Restate rows tied to 3.2 or
  the 0.5 px floor. Close the second context when done. Expected total: 110 + 2 = 112.
- **Ship DS-7 + DS-5 to `main`:** stamp the badge, `check-inline-js` and gates GREEN after the
  stamp, then `land-on-main.sh <branch> <msg> --dry-run`, then for real. Message:
  `fix(driving-simulator): no column of light under a low sun or moon; brighter stars (DS-7, DS-5)`
  with the session's trailers. Verify the Pages run (two checks). Move the DS-7 and DS-5 halves of
  the TODO entry to `DONE.md` with the badge string; the entry keeps DS-4 and DS-6.
- Then merge `origin/main` into the arc's branch.

### Step 3 - DS-4a: the sun and the moon as they look

- `updateSky()`: `SKY.sunDiscW`, `SKY.moonDiscW` (refracted), `SKY.sunR`, `SKY.moonR`,
  `SKY.moonES` (the earthshine). Uniforms into the sky pass only.
- `skyBodies()`: the sun disc at its real size from `uSunDisc`; the aureole about `uSunDisc`; the
  moon from `zmhMoonDisc(d, uMoonDisc, uSunDir, uMoonR, uMoonES)` with the maria, times `MOON_K`,
  not times `uNight`. `MOON_DISC_GLSL` goes into `FS_SKY` from `ZMH_SKY_GLSL` as
  `MILKY_WAY_GLSL` does (`index.html:2369`).
- Rows (each its own `ok()`):
  - the sun at five times (06:30, 09:00, solar noon, 17:00, 19:30 EDT) on Mar 20, May 5 and Jun 20:
    the page's geometric `SKY.sun` against the suite's own sun within 0.2 deg;
  - refraction: drawn altitude minus geometric equals the suite's own Saemundsson value within
    0.01 deg at true altitudes 0, 1 and 10 deg (0.483, 0.362 and about 0.09 deg); and at the
    suite's own sunrise and sunset (`ownRiseSet`) the drawn upper limb is within 0.05 deg of 0;
  - sizes: the drawn sun disc spans 0.53 deg within 20% (pixels across at a narrow field of view
    divided by pixels per degree); the moon's radius equals `asin(1737.4 / d)` and lies in
    0.24-0.28 deg on every day Mar 20 - Jun 20;
  - phase: the kit's lit fraction over 0.97 at the full moons 2026-05-01 and 05-31, under 0.03 at
    new 2026-05-16, 0.5 +/- 0.05 at last quarter (about 05-09), each at the Meeus mean phase's
    hour (the suite's `meanPhase`); the astronomy-engine fixed point 0.835 at 2026-05-06 02:00 UT
    within 0.005;
  - the cycle: over 30 game days from May 1 the lit fraction runs full -> new -> full once, and the
    moon rises a mean 30-70 min later each day;
  - the bright limb faces the sun: zoomed on the moon (field of view about 1.5 deg) at three
    phases, the centroid of the disc's lit pixels lies off the disc's centre toward the sun's
    projected direction within 15 deg;
  - the moon by day: at a time with the moon above 20 deg and the sun above 20 deg, the disc's
    pixels are brighter than the sky 2 deg off it;
  - no stray pixels: zoomed out, nothing brighter than the sky round the moon outside 2 radii
    (the kit's gate kept);
  - restate "the sun is drawn where it is" (`:920`) for the real-sized disc.
- Expected total: 112 + 8 = 120 (state the real total; a restated row does not add one).

### Step 4 - DS-4b: moonlight by phase; a bright moon dims the stars

- `SKY.moonCol`, the moonlit ambient share, the star and Milky Way dimming (Design).
- Rows:
  - "a full-moon midnight (2026-05-31 01:00 EDT, moon high) is at least 1.5x a new-moon midnight
    (2026-05-16 01:00) in mean luminance, and both are under half of dusk (sun -3 deg)";
  - "a bright moon dims the stars: what Polaris adds at the full-moon midnight is 0.3-0.75 of what
    it adds at the new-moon midnight, at the same altitude" (pick an hour per date where Polaris is
    at the same height, or compare `uStarK` handed to the GPU plus one pixel row);
  - restate "midnight is much darker than noon" (`:740`) if its numbers move.
- Expected total: 120 + 2 = 122.

### Step 5 - DS-6: a slider for each thing in the sky

- The SKY section, `SETTINGS.sky`, the loader merge, `syncSettingsUI()`, the `input` handlers
  (`saveSettings()` then `updateSky()` where a light term changes), the gains (Design).
- Rows:
  - "a SKY section after TIME with Stars, Planets, Milky Way, Sun, Moonlight and Earthshine,
    0-200, defaults 100, fitting at 320 px wide";
  - "the sky sliders are saved and come back after a reload; an old save without them reads 100";
  - per slider at 0: the matching DS-1/DS-4 pixel row finds nothing (stars, planets, Milky Way,
    sun disc, moon disc, earthshine on a crescent);
  - per slider at 200: stars and planets double in pixels within 10% (a star under 128); the
    others double on the value handed to the GPU within 1e-6 and are brighter in pixels;
  - "at 100% everywhere the frame is byte-identical to the frame before the sliders" (record the
    before-hash in this Results at the start of the step).
- The per-slider claims are one row each for 0 and for 200 (the failing slider named in its
  detail). Expected total: 122 + 5 = 127.

### Step 6 - break list, frame cost, docs

- Breaks (one line each, `negtest-batch.py` format, `/* @negtest */` in each `new`), at least:
  the disc back in the fog; the disc in the hills; the bodies below the ridge; the star floor back
  to 0.5; `STAR_GAIN` halved; no refraction on the disc; refraction on the light; the moon times
  `uNight`; earthshine 0; the sun's limb on the wrong side (sun direction negated in the moon
  disc); moonlight without the phase; no star dimming by the moon; each slider wired to the wrong
  term; an old save reading 0. Each must be caught by the row it names; any MISSED gets a row or an
  argued equivalence in the Results.
- Frame cost at the phone's settings before/after, on the perf block.
- Docs: `.claude/driving-simulator.md` (DS-4 to DS-7 built, § Architecture's sky, § Testing, the
  "Assumed, not decided" rows: `ES_GAIN`, `MOON_K`, the maria, the dimming 0.6, no minimum disc
  size, the sigma floor, `STAR_GAIN`), `.claude/tests/README.md` (the suite's count), the THE ROAD
  notes if they describe the sky.

### Step 7 - ship

- `stamp-badge.sh`, then `check-inline-js` and `gates.sh` GREEN after the stamp.
- Move this plan (and a follow-up, if any) to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>`.
- Land with `land-on-main.sh` (dry run first). Message:
  `feat(driving-simulator): the sun and moon as they really look, and a slider for each thing in the sky (DS-4, DS-6)`.
  If `behind`, merge `origin/main` into the branch, re-run the gates, check the other session's
  files survived.
- `TODO.md`: the entry to `DONE.md` with the badge string.
- Verify the Pages run for the landed SHA (`mcp__github__actions_list`, `resource_id '266280069'`,
  `perPage 1`; match `head_sha`, read the jobs; two checks, then report).
- Report: the badge string, the playtest list, the assumed rows most worth a look (`ES_GAIN`,
  `MOON_K`, the maria, the moon's dimming of the stars, the disc sizes with no minimum), and the
  next command (`/zmh-producer:oversee-implementation .claude/plans/dssound.traffic-stereo-doppler.md`).

## Gotchas / bindings

- **The world is (east, up, SOUTH)** (`index.html:2963-2968`). Every direction to the GPU goes
  through `enuToWorld`; `SKY.sun/.moon/.planets/.starM` stay ENU. A new disc direction is
  `enuToWorld` of the refracted ENU vector. The suite's own map is `enuToWorldOwn`.
- **Screen right is `cross(fwd, up)`** in this renderer (an OpenGL lookAt facing +z has +x on the
  screen's LEFT); the suite's `__dsAimed` already projects that way (`:765-766`). Use it for "10 deg
  either side" and for the limb's direction.
- **The `ZMH-SKY` block is generated.** Never edit it; take `MOON_DISC_GLSL`, `refractionDeg`,
  `earthshineFraction`, `moonIlluminanceLux`, `moonPhaseFactor` from it as they are.
- **`zmhMoonDisc` uses `fwidth`** (fragment only, fine in `FS_SKY`); call it in uniform control
  flow (not inside an `if` that varies per pixel), or `fwidth` is undefined. Same for the sun's
  pixel-wide edge if it uses `fwidth`.
- **The mirror pass shares `renderScene()`** (`uPx = 1` there). Anything added to the sky pass
  runs twice in the cockpit view.
- **The stars draw after the tonemap, additively** (`index.html:3281-3290`), with depth test off:
  their 8-bit pixel is `vColor * vI * profile * uStarK` plus the sky. That is why their doubling is
  measurable and the Milky Way's (before the tonemap) is not.
- **`SKY.day` is the daylight factor, not the date** (the date is `SKY.mjd`).
- **No `Date` in the sky code.** Use `julianDate()` and MJD arithmetic.
- **The suite's `__dsAimed` puts the camera 30 m above the player** with a 0.8-rad field of view
  (`:757-769`); the repro row wants that height (it sees the ground below the horizon).
- **Under the ridge there is no disc** after step 1: at 1.0 deg a body is usually behind the hills
  (`ridgeY` is 0.4-4 deg). The repro row needs only the ground below; a disc check needs a time
  when the body clears `ridgeY` at its azimuth.
- **Timed rows go red under load** (producer config § Environment): run the gates alone; never
  count a catch only a sound or perf row made.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. No model names in commits or files.
- **`land-on-main.sh` makes a new commit on `origin/main`;** the arc branch must merge
  `origin/main` back in before it can land again (step 2 -> step 3).

## Validation

`check-inline-js` after every page edit; `gates.sh games/driving-simulator/index.html` GREEN at
the end of every step (smoke, this suite, games-sync, the live-break scan); the break list run in
step 6 with every break caught or argued. Beyond the gates, the CD's phone is the only judge of
"bright enough" and "small enough": the playtest lists above say what to look at.

## Follow-ups

- The night sky's faint concentric rings in the screenshots: a hypothesis (8-bit banding of the
  night gradient), not traced, not in this plan (`.claude/driving-simulator.md` DS-7).
- Separate sliders for how bright a body looks and how much it lights the scene, if the CD asks
  (DS-6's spec).
- The twilight glow and the light-pollution glow as sliders, if the CD asks.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dssky.horizon-stars-moon-sliders.md
```
