# dssky - Driving Simulator: no column under a low sun or moon, brighter stars, the sun and moon as they really look, and a slider for each thing in the sky (DS-7, DS-5, DS-4, DS-6)

**Status:** PARTIALLY IMPLEMENTED (2026-11-03). Steps 1-5 DONE; step 6 IN PROGRESS (work in
progress committed, unverified); step 7 not started. Drafted on `main` at `e43a233` (the page's badge
`build 2026-11-02 12:27 UTC`, the suite at 108 checks, the break list at 25).

## HANDOFF STATE (2026-11-03) - read this first

The first session ran out of quota during step 6. Everything is on the remote branch
**`claude/brave-sagan-odwmrd`** (`origin`). Nothing is lost.

- **On `main`:** steps 1-2 (DS-7 the column, DS-5 the stars) landed as `cec3b2f`, badge
  `build 2026-11-02 17:17 UTC`, Pages deploy verified green. `TODO.md`/`DONE.md` already moved
  DS-7 and DS-5 to `DONE.md`; the TODO entry now reads "The sky arc, second half" (DS-4, DS-6).
- **On the branch only (not on `main`):** step 3 `dcc8db5` (DS-4a discs), step 4 `1125705` (DS-4b
  moonlight), step 5 `d573462` (DS-6 sliders), each GATES GREEN when committed (suite 120, 123, 128).
  Then a **WIP commit for step 6** (see below). Each step's `#### Results` section below is the record.
- **Step 6 WIP, unverified:** the break list grew from 25 to 47 entries and the suite gained rows
  (about 26 lines) for the breaks that had none yet. The worker was stopped mid-run, so it is not
  known whether every new break is caught, whether the new row(s) pass, or what the suite total is.
  Not yet done: the break runs, the frame cost, all the docs, and step 6's Results section.
- **Overseer decisions already made** (keep them; record them in the follow-up file
  `.claude/plans/dssky.horizon-stars-moon-sliders.follow-up.md`, which this handoff created):
  earthshine scaled by the night factor (it showed by day); step 5's expected total became 128,
  not 127. All other decisions are in each step's Results and in `.claude/driving-simulator.md`'s
  "Assumed, not decided" table.
- **To finish:**
  1. Check out `claude/brave-sagan-odwmrd` and fetch `origin/main`. If `main` moved, merge
     `origin/main` INTO the branch, never the reverse.
  2. Run `bash .claude/scripts/negtest.sh scan games/driving-simulator/index.html`. It must print
     GREEN (it did at handoff).
  3. Run the suite alone: `node .claude/tests/drive-driving-simulator.cjs`.
  4. Finish step 6 as written below:
     - run all 47 breaks in foreground chunks under 9 minutes
       (`python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/driving-simulator.json --only a,b,...`);
     - every break must be caught by the row it names; a MISSED break gets a row or an argued
       equivalence;
     - frame cost before (`2bff358`'s page) and after;
     - the docs list in step 6, plus the items the step 1-5 Results deferred: the sun and moonlight
       "wrong term" breaks, the stale `skyCol()` mentions and suite row name, the DS-4 checks list's
       "If DS-6 has landed" text, and the count in `.claude/tests/README.md`;
     - append `#### Results (step 6)`, mark step 6 DONE, and commit.
  5. Then do step 7 exactly as written: stamp, gates GREEN after the stamp, plan + follow-up to
     `DONE/`, `land-on-main.sh` dry run then real, TODO entry to `DONE.md` with the badge, verify
     Pages (two checks), report with the playtest list.
- **Rails:** never commit red on the way to `main`. Run `gates.sh` alone, with no other Chromium
  job running. Use explicit pathspecs. Never put a merge commit on `main`.
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

### Step 1 - DS-7: no column under a low sun or moon (DONE 2026-11-02)

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

#### Results (step 1)

Worktree branch `worktree-oversee+dssky`, from `bbf3d0e` (the page's shaders as on `e43a233`).

- **The times, by bisection on the page's own `SKY`** (40 halvings of `SKY.hour` through `setDate()`):
  the sun at 1.0 deg setting on May 5 at **19.9203 h (19:55:13 EDT)**, azimuth 289.70; the moon at
  1.0 deg rising on May 6 at **0.3287 h (00:19:43 EDT)**, azimuth 126.79. Both match the plan's
  kit-computed 19:55 and 00:20.
- **The repro row, on today's page, FAILED** as the traced cause predicted. The ratio is the body's
  strip against the dimmer of the two side strips (the strictest reading of "either side"); rows
  from 4 px under the horizon to the bottom, 155 rows; 8-bit luminance.

  | | sun: body / left / right | sun ratio | moon: body / left / right | moon ratio |
  | - | - | - | - | - |
  | before, the suite | 245.98 / 129.70 / 125.77 | **1.956** | 195.89 / 18.91 / 17.46 | **11.217** |
  | before, a scratch run (another car position) | 246.63 / 119.85 / 119.65 | 2.061 | 196.23 / 19.03 / 18.79 | 10.443 |
  | after, the suite | 118.46 / 125.63 / 120.24 | **0.985** | 19.70 / 18.94 / 17.49 | **1.126** |
  | break check: a copy with only the fog back on `skyView()` | 223.31 / 127.38 / 124.34 | 1.796 (FAIL) | 171.25 / 18.89 / (cut off in the log) | over 9 (FAIL) |

  The sun's case came out just under 2x, not "far above" it: the sides are bright too (the sunset
  tint and the broad lobe in the haze toward the sun). The moon's column is 10-11x, because the
  night ground is so dark. Fixing only the fog (hills and reflections still on `skyView()`) is
  enough for the row to see the difference, so the row bites on the fog line alone.
- **The sky above the ridge, recorded before the split** (by the row's own code, run once from a
  scratch script and once inside the suite, where the car stood elsewhere: the same values both
  times, so the frames hold sky only). Five frames from `__dsAimed` (30 m above the car, 0.8 rad),
  each with its lowest corner over 5 deg up: mean 8-bit luminance and the FNV-1a hash of the
  RGBA bytes.

  | frame | aim | lowest corner | mean | hash |
  | - | - | - | - | - |
  | `noon` | 12:00 May 5, 32 deg up, azimuth 200 | 6.9 deg | 169.486 | `ce2df9fc` |
  | `noonSun` | 12:00 May 5, at the sun (65 deg up) | 30.8 deg | 182.519 | `5963df34` |
  | `sun17` | 17:00 May 5, at the sun (36 deg up) | 9.9 deg | 193.474 | `a0571206` |
  | `night22` | 22:00 May 5, 32 deg up, azimuth 200 | 6.9 deg | 22.208 | `16a94f02` |
  | `moon4` | 04:00 May 6, toward the moon (25 deg up), aimed 32 deg up | 6.9 deg | 34.476 | `45be3111` |

  After the split all five means are equal (difference 0.000) and **all five hashes are equal**.
  The row requires every mean within 0.5 and every hash equal: the plan's default asked for the
  12:00 hash only, but the 12:00 frame in the plan's sense has no body in it, so it could not
  see the sum's rounding (see the next point); the two sun frames and the moon frame can.
- **Decision not in the plan: one sum with the bodies weighted 0 or 1, not two functions added.**
  The first build was the plan's literal shape, `skyBase(d)` plus a separate `skyBodies(d)` added
  in `FS_SKY` above the ridge. It cured the column (sun 1.02, moon 1.09 in the scratch run) but
  changed the bits: `noon` hashed `23875c83` and `sun17` `58c0bcea`, with every mean equal to
  three decimals (float re-association: the sun's terms had been one `uSunCol * (disc + lobe +
  aureole)`). So the shipped shape is `skySum(d, bodies)`, the old `skyCol()`'s one expression in
  its old order with the sun disc, the aureole and the moon disc each times `bodies`
  (`x * 1 = x`, `x + 0 = x` exactly); `skyBase(d) = skySum(d, 0.0)` (fog, hills, paint
  reflections) and `skyView(d) = skySum(d, 1.0)` (the sky pass's own ray). "Only above the ridge"
  holds because the hills already replace `c` under the ridge, so a body behind them stays
  hidden, exactly as before. There is no `skyBodies()` function at step 1: it would be
  `skyView - skyBase`. Step 3 rewrites the bodies with sky-pass-only uniforms (`uSunDisc`,
  `uMoonDisc`, radii) and will change the sky above the ridge anyway, so it can split them into
  their own `skyBodies()` in `FS_SKY` then.
- **Decision not in the plan: aimed frames, not the chase view, for the unchanged row.** The sky
  pass's pixels depend only on the view direction and the time (the eye moves nothing in it), so
  an aimed camera at fixed world directions gives a hash that cannot move with the car's place or
  the chase camera's lag, as long as no geometry is in the frame (checked by the lowest corner).
- **Suite total: 110** (108 + 2), all green; no row restated. The sun row ("the sun is drawn where it
  is") and the four star-pixel rows stayed green unchanged.
- `check-inline-js` GREEN; `gates.sh games/driving-simulator/index.html`: **GATES: GREEN** (smoke,
  games-sync, negtest scan, the suite 110/0), run alone. The badge is not stamped (step 2 does).
- For step 6's break list: "the disc back in the fog" is caught by the repro row (shown above);
  "the disc in the hills" and "bodies below the ridge" are untested here.

### Step 2 - DS-5: brighter stars; land DS-7 and DS-5 (DONE 2026-11-02)

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

#### Results (step 2)

Worktree branch `worktree-oversee+dssky`, on `2fb91c0` (step 1). **Measure, raise and rows: DONE
2026-11-02. Landing: overseer** (badge, gates after the stamp, `land-on-main.sh`, Pages, TODO/DONE).

- **Measured before any change** in a second browser context: 844x390 CSS px at
  `deviceScaleFactor` 3, which gave DPR 2, **RSCALE 1.7** and a 1435x663 framebuffer, at 22:00 EDT on
  May 5, with `SKY.night` 1 and `SKY.exposure` 1.8. The camera stood 30 m above the car (0.8 rad), aimed by
  Newton on the suite's own projection so that the star's centre lands exactly at (717 + o, 331 + o)
  for o = 0, 1/4, 1/2 and 3/4 of a pixel along the diagonal (1/2 is the pixel corner). Each figure is
  what the star adds at its brightest pixel (STARS on minus off, 8-bit luminance). The fifth star is
  Megrez (HIP 59774, V 3.32) and the magnitude-4 star iota Leonis (HIP 55642, V 4.00), both from
  `SKY_DATA`. The patch is 200x100 CSS px (340x170 framebuffer) round Polaris, counting stars at 40 or more.

  | star (min over the four phases) | before (3.2, floor 0.5 fb px) | floor 0.5 CSS px, 3.2 | after (floor 0.5 CSS px, 4.0) |
  | - | - | - | - |
  | Arcturus | 236 | 238 | 239 |
  | Vega (12 deg up) | 164 | 223 | 229 |
  | Regulus | 94 | 165 | 201 |
  | **Polaris** | **86** (230 / 182 / 86 / 182) | 166 | **207** (236 / 236 / 207 / 236) |
  | Megrez (3.32) | 39 | 76 | 95 |
  | **iota Leo (4.00)** | **37** (100 / 78 / 37 / 78) | 71 | **88** (125 / 115 / 88 / 115) |
  | patch, stars at 40+ | 3 | 7 | 9 |

  The full per-phase table is in `.claude/driving-simulator.md` § Backlog DS-5. The targets were not
  met before, so the escalation trigger did not fire. **The cause, traced to pixels:** the sub-pixel
  phase first, then the gain. The 0.5-framebuffer-px sigma floor is 0.29 CSS px at RSCALE 1.7, so a
  faint star on a pixel corner kept only 37% of its centre value (Polaris 230 on a centre, 86 on a corner).
- **Levers, in the plan's order:** (1) `vSig = max(sz * 0.5 / sqrt(8.0), 0.5 * max(uPx, 1.0))`.
  This moved Polaris's worst phase from 86 to 166 and iota Leo's from 37 to 71, so the mag-4 target
  was met and Polaris's was not. (2) `STAR_GAIN` from 3.2 to 4.0 (200 / 166 x 3.2 = 3.86, rounded up).
  The kit's law, the 2.5 clamp (Venus) and `MW_GAIN` are unchanged.
- **Decision not in the plan: the floor is `0.5 * max(uPx, 1.0)`, not `0.5 * uPx`.** Below RSCALE 1
  (the suite's own context, 0.85, and the low graphics setting), `0.5 * uPx` falls under half a
  framebuffer pixel, which is the sub-pixel case DS-1's floor exists to stop. Measured with
  `0.5 * uPx` at RSCALE 0.85, Polaris at a pixel corner dropped from 86 to 59. The mirror pass
  (`uPx = 1`) is unchanged either way. The row is in the "Assumed, not decided" table, beside one for
  `STAR_GAIN = 4.0`.
- **Rows (in the second context, which is closed after them):** "at the phone's render scale (RSCALE 1.7)
  Polaris adds at least 200 and a magnitude-4 star (iota Leonis, HIP 55642) at least 60 at every
  sub-pixel phase"; "at the phone's render scale the 200x100 CSS px patch round Polaris holds at least
  7 stars that add 40 or more" (9 measured, less 20%, floored). Polaris comes from the suite's own
  SIMBAD and precession (`ownStar`). For iota Leo, the J2000 RA/Dec and magnitude are read from the kit's
  catalogue data and turned to alt/az by the suite's own `precess()` and `ownAltAz()`. The suite's
  values matched the scratch measurement to the unit.
- **The rows bite:** run against copies, the step-1 page turns both red (Polaris 86, iota Leo 37,
  patch 3). The new gain with the floor back at 0.5 framebuffer px turns the phase row red (Polaris
  108, iota Leo 46 at the corner), and so does the new floor with the gain back at 3.2 (Polaris 166).
  The patch row catches only the step-1 page: with either lever alone the patch already holds 7 or
  more. For step 6's break list: "the star floor back to 0.5" and "`STAR_GAIN` halved" both land on the
  phase row.
- **Restated: "the sky above the ridge is unchanged by the split"** (step 1's row). Its 22:00 and
  04:00 frames held the stars, so this step's brighter stars changed their hashes (`a3451048`,
  `ecb17b0b`; means +0.011 and +0.019). It now takes all five frames with `STARS.on` false. The
  stars-off values were recorded on the same pre-split page (`bbf3d0e`): night22 22.164 `4eb245a1`,
  moon4 34.395 `6e7d7372`. On that page the stars-on values reproduced step 1's recorded ones exactly,
  and the step-1 and step-2 pages give the same stars-off values. The three daytime frames are unchanged, because
  the star pass does not draw by day. No other row was tied to 3.2 or the 0.5 px floor: the Jupiter
  row, the four star-pixel rows and "the stars fade with the night" stayed green unchanged.
- **Suite total: 112** (110 + 2), all green.
- **Landing (overseer):** badge stamped `build 2026-11-02 17:17 UTC`, `check-inline-js` and
  `gates.sh` GREEN after the stamp (112/0); DS-7 and DS-5 moved from `TODO.md` to `DONE.md`; landed on
  `main` with `land-on-main.sh`; `origin/main` then merged back into the arc's branch.

### Step 3 - DS-4a: the sun and the moon as they look (DONE 2026-11-02)

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

#### Results (step 3)

Worktree branch `worktree-oversee+dssky`, on `e02063d` (steps 1-2, landed on `main` as `cec3b2f` and merged back).

- **Built.** `updateSky()`: `SKY.sunDiscW`, `SKY.moonDiscW` (`enuToWorld(refracted(v))`: the ENU direction lifted in its own
  vertical plane by `ZMH_SKY.refractionDeg` of its true altitude), `SKY.sunR` (0.265 deg), `SKY.moonR`
  (`asin(1737.4 / topoDistanceKm)`), `SKY.moonES` (`ES_GAIN * earthshineFraction(phaseAngleDeg)`, `ES_GAIN = 600`) and
  `SKY.poleW`. `SKY.sun`, `SKY.moon`, `uSunDir`, `uMoonDir` and every light term stay geometric. New uniforms `uSunDisc`,
  `uMoonDisc`, `uPoleW`, `uSunR`, `uMoonR`, `uMoonES`, `uMoonK` (`MOON_K = 1.2`) in the sky pass only. `GLSL_COMMON` keeps
  `skyBase()` alone (step 1's `skySum` / `skyView` are gone); `FS_SKY` brings in `MOON_DISC_GLSL` beside `MILKY_WAY_GLSL` and
  has `skyBodies(d)`: the sun disc (`1 - smoothstep(uSunR, uSunR + pixel, length(d - uSunDisc))`, the pixel from
  `fwidth(d)`) times 30 plus the aureole `pow(cs, 120) * 0.6` about `uSunDisc`, gated by `step(-0.06, uSunDir.y)` as before; the
  kit's `zmhMoonDisc(d, uMoonDisc, uSunDir, uMoonR, uMoonES)` with its gate, times the maria and `uMoonK`, never `uNight`.
  `c = skyBase(d) + skyBodies(d)` in main's uniform control flow, before any branch; the hills still replace `c` under the
  ridge. The hook: `__DS.MOON_K`, `__DS.ES_GAIN`, and the `SKY` fields above. `__dsAimed(aimW, offAz, dirsW, fov)` in the
  suite takes an optional field of view, and its frame gains `dir(x, y)` (a pixel's world ray) and `pxPerRad`.
- **Rows (eight new), with what they measured on this page:**

  | row | measured |
  | - | - |
  | the sun through the day (06:30, 09:00, solar noon, 17:00, 19:30 EDT on Mar 20, May 5, Jun 20) vs the suite's own sun, 0.2 deg | worst 0.0036 deg in altitude, 0.0038 on the sky in azimuth |
  | refraction on the drawn discs (sun setting May 5, moon rising May 6, at true 0, 1, 10 deg by bisection) vs Saemundsson, 0.01 deg; the upper limb at the suite's rise and set | lifts 0.48303 / 0.36240 / 0.09013 deg for both bodies, error under 1e-5, azimuth unchanged; limb 0.0512 (rise 06:18) and 0.0516 (set 20:05) against the suite's 0.0502 |
  | the sizes: the sun at a 2-deg field (166 px a degree), all channels 254+; the moon every day Mar 20 - Jun 20 at 22:00 | sun 6,448 px, 0.546 deg across (+3%), centred within 0.01 px; moon 0.2437-0.2776 deg, equal to `asin(1737.4 / d)` exactly |
  | the phase (Meeus mean full May 1 and May 31, mean new May 16, TRUE last quarter May 9; astronomy-engine at 02:00 UT May 6) | 0.9984, 0.9981, 0.0029, 0.5013; 0.83548 against 0.83537 |
  | the cycle (May 1-30 at 22:00; moonrise by bisection) | 0.997 -> 0.0029 on May 16 -> 0.997, one turn, waning then waxing; 29 rises, a mean 51.2 min later each day |
  | the bright limb (1.5-deg field; gibbous May 6 03:11, quarter May 10 05:38, crescent May 20 21:59) | angle to the suite's own sun 0.00 / 0.04 / 0.17 deg; lit share 0.815 / 0.438 / 0.240 against 0.820 / 0.449 / 0.247; the crescent's dark part at night adds 43.1 |
  | the moon by day (May 11, the sun at 30 deg at 08:49, the moon 46 deg up, a third lit, 0.1 rad field) | brightest disc pixel 237 against 141.8 on the ring 2 deg off |
  | no stray pixels (0.8 rad, aimed at the moon and 90 deg from it) | 0 pixels over 1 level beyond 2 radii in both; 16 inside in the first |

- **Restated (named), not added:**
  - **"the sun is drawn where it is"**: the real-sized disc is about 4.5 px across at the 0.8 rad field, under the row's 20 saturated
    pixels; it now looks through a 0.2 rad field (267 pixels, centred 0.1 px from the target) and checks against the suite's own
    sun lifted by its own `saem()`.
  - **"the sky above the ridge is unchanged by the split"**, now **"... away from the bodies is unchanged"**: the bodies change
    by design, so the five frames (stars off) must match their pre-split means within 0.5 (measured -0.000, -0.003, -0.003,
    0.000, -0.144); `night22`, the one frame with no body and no aureole in it, still has its pre-split hash `4eb245a1` (the base is
    bit for bit the old one); the four frames with a disc or the aureole are pinned to hashes recorded on this step's page
    (`noon f74f5560`, `noonSun 0174b859`, `sun17 6379ab21`, `moon4 63e2c7c4`), with this reason in the row's comment. `noon`
    has no disc but sees the aureole: the sun is 10 deg above the frame's top.
- **Two tolerances, traced and restated, not widened:**
  - **The last quarter is checked at Meeus 49's TRUE hour, not the mean one.** At the mean last quarter of May 9 (04:29 UT) the
    kit gives 0.570, outside 0.5 +/- 0.05; Meeus 49's periodic correction for quarters alone is up to -0.628 sin M' days, and here
    the true quarter is 16.7 h later (21:13 UT), where the kit gives 0.5013. The suite types in Meeus 49's quarter terms and W
    (`quarterJD()`). The same terms put the kit at 0.5013 at every quarter from Nov 2025 to Oct 2026 (a scratch check), so the
    terms and the kit agree; the full and new moons stay at the mean phase, where they pass with room (0.998, 0.003).
  - **The upper limb at rise and set is 0.050 deg up, not 0.** The plan's own correction line works it out:
    -0.833 + 0.618 + 0.265 = 0.050. A bound of 0.05 round 0 is the expected value itself, so the row asks for the suite's own
    0.050 within 0.02 (measured 0.0512, 0.0516), and so within 0.07 of 0.
- **Break checks** (six scratch copies, the suite run against each alone; each landed on its own row):

  | break | row that went red | value |
  | - | - | - |
  | no refraction on the discs | refraction | lift 0 against 0.483 |
  | the sun negated in `zmhMoonDisc` | the bright limb | angle 179.9 deg; lit share 0.18 for a 0.82 moon |
  | the moon times `uNight` | the moon by day | disc 142 against the sky's 141.8 |
  | earthshine 0 | the bright limb | the crescent's dark part 1.2 (wants 8) |
  | refraction on the light (`SKY.sun` refracted) | the sun through the day, one sun the kit's, refraction | 0.646 deg at 06:30 Mar 20 |
  | the sun 0.8 deg in radius | the sizes | 1.62 deg across |

  The sky-away-from-the-bodies row also went red under every break but the uNight one (it pins the hashes): a second catch,
  never counted as the row named. With no refraction its `noon` hash read `23875c83`, the hash step 1 recorded for its first
  two-function build: the aureole about the geometric sun.
- **Decisions not in the plan:**
  - **The maria sit at four fixed points on the face** (roughly Imbrium, Serenitatis-Tranquillitatis, Procellarum, Nubium) and
    `vn()` only roughens their edges. The plan's "3-4 patches from `vn()`" was built first: one patch came out in SwiftShader,
    and their number would hang on a GPU's `sin()` precision (`h21` is `fract(sin(x) * 43758)` at arguments in the thousands),
    so a phone could show a different count from the suite's.
  - **The pole of date is (0, sin lat, cos lat) in ENU, exactly** (`SKY.poleW`), not `SKY.starW` times the J2000 pole, which is
    0.14 deg off it by precession and a matrix product a frame.
  - **The sun disc's angle is the chord `length(d - s)`**, not `acos(dot)`, which resolves about 0.02 deg in floats.
  - **`MOON_K` is a uniform (`uMoonK`)**, so step 5's Moonlight slider scales a uniform rather than a constant in the shader.
  - All are in `.claude/driving-simulator.md`'s "Assumed, not decided" table, with `ES_GAIN`, `MOON_K`, no minimum disc size and
    the two directions per body.
- **For the playtest and step 4:** the earthshine is strong after the tonemap (the May 20 crescent's dark part adds 43 levels
  against the lit limb's 169, and by day the dark part of the disc is lighter than the blue around it), and on the night disc
  the maria read faintly (the disc sits near saturation at exposure 1.8). Both are dials (`ES_GAIN`, `MARE_DARK`), left at the
  plan's values for the CD's look. "midnight is much darker than noon" stayed green unchanged (step 4 moves the moonlight).
- **Suite total: 120** (112 + 8), all green. `check-inline-js` GREEN; `gates.sh games/driving-simulator/index.html`: **GATES: GREEN**
  (smoke, games-sync, negtest scan, the suite 120/0), run alone. The badge is not stamped (step 7 does).

### Step 4 - DS-4b: moonlight by phase; a bright moon dims the stars (DONE 2026-11-02)

- `SKY.moonCol`, the moonlit ambient share, the star and Milky Way dimming (Design).
- Rows:
  - "a full-moon midnight (2026-05-31 01:00 EDT, moon high) is at least 1.5x a new-moon midnight
    (2026-05-16 01:00) in mean luminance, and both are under half of dusk (sun -3 deg)";
  - "a bright moon dims the stars: what Polaris adds at the full-moon midnight is 0.3-0.75 of what
    it adds at the new-moon midnight, at the same altitude" (pick an hour per date where Polaris is
    at the same height, or compare `uStarK` handed to the GPU plus one pixel row);
  - restate "midnight is much darker than noon" (`:740`) if its numbers move.
- Expected total: 120 + 2 = 122.

#### Results (step 4)

Worktree branch `worktree-oversee+dssky`, on `dcc8db5` (step 3). The container restarted mid-step; the page edit survived on
disk and the step was finished from it.

- **Built** (`updateSky()`, `renderScene()`; the shaders are unchanged):
  - `SKY.moonLight = SKY.night * ZMH_SKY.moonIlluminanceLux(phaseAngleDeg, moon.altDeg) / ZMH_SKY.FULL_MOON_ILLUMINANCE_LUX`
    (the kit's 5-deg ramp replaces `smooth(-0.05, 0.2, ...)`); `SKY.moonCol = MOON_RGB * SKY.moonLight` with
    `MOON_RGB = [0.04, 0.052, 0.088]`, the old moonlight's colour at its old full level. 0.882 under the full moon of May 31
    at 01:00 (phase angle 5.25 deg, 26.9 deg up), 0.29 for the gibbous of 04:00 May 6.
  - The moonlit ambient: `SKY.ambSky += MOON_AMB * MOON_RGB * SKY.moonLight`, **`MOON_AMB = 1.0`**, tuned on the row below.
  - `SKY.moonBright = moonPhaseFactor(phaseAngleDeg) * clamp(altDeg / 5, 0, 1)`, `SKY.starDim = 1 - MOON_DIM * moonBright`,
    **`MOON_DIM = 0.6`**; `uStarK = STAR_GAIN * exposure * night * starDim` and `uMwGain = MW_GAIN * starDim`.
  - **The glow round the moon** (`skyBase()`'s `uMoonCol * pow(cm, 30) * 0.6`) is times `moonPhaseFactor` through `uMoonCol`,
    which now carries the phase: no second uniform (a second factor would square the phase). Fog and hills take the same
    `uMoonCol`, so they stay consistent.
  - **The overseer's addition, earthshine by night only:** `SKY.moonES = ES_GAIN * earthshineFraction(phaseAngleDeg) * SKY.night`.
    The lit disc is still never times `uNight`.
  - The hook: `__DS.MOON_RGB`, `MOON_AMB`, `MOON_DIM`; `SKY.moonLight`, `.moonBright`, `.starDim`.
- **Rows (three new), measured in the suite on this page:**

  | row | measured |
  | - | - |
  | a full moon lights the night (+ a first quarter lifts it at most 0.35 as much) | the land from 30 m (two frames 30 deg down, azimuths 20 and 200): full 18.18, moonless 10.09, dusk (May 16, the sun at -3 deg at 20:26) 44.87: **1.80x**, full **0.405** and moonless 0.225 of dusk; the first quarter of May 23 (0.57 lit, 39 deg up, the sun at -25 deg at 22:56) lifts the land **0.177** of the full moon's lift. The moon 26.9 deg up at full, -33.3 at new |
  | a bright moon dims the stars | Polaris at 35.1848 deg on both nights (May 31 01:00; May 16 at 01:59, by bisection, azimuth within 0.0006 deg): adds **113** under the full moon against **233** without one, **0.485**; `uStarK` read back 3.3907 against 7.2 (0.471) |
  | by day the moon's dark part is no brighter than the sky beside it (the overseer's) | May 11 at 08:49 (the sun 30 deg up, the moon 46.2 deg, 0.335 lit), 273 pixels well inside the dark part: they add **0** to the sky behind them (max 0.0), mean 141.94 against **141.81** on the ring 2 deg off |

  Each time is found on the page's own `SKY` by bisection; only the two dates of the plan's row and their 01:00 are typed in.
- **Decision not in the plan: the night row measures the land, not the chase view.** The plan's row does not name a view. In
  the chase view the headlit road, the car and the night sky do not change with the moon, so they dilute the ratio: at
  `MOON_AMB = 1.4` the chase view gave 1.44x at the suite's place (1.63x in a scratch run at another), with full / dusk at 0.46,
  a window too narrow to hold. And its mean is not stable from run to run of the same page (the moonless 01:00 frame read 20.7,
  29.0 and 17.8 in three runs; the chase camera's lag runs on real frame time), which is also true of the older "midnight is
  much darker than noon" row's input. The land frames (`__dsAimed`, no cars, all ground) are bit-stable and see what moonlight
  changes. The chase values are still recorded in the row's detail, not tested.
- **Decision not in the plan: the row also checks the phase law** with a first-quarter moon high. Its pair alone cannot: at
  01:00 on May 16 the new moon is under the horizon, so moonlight without the phase leaves the pair as it was. The quarter is
  taken at the sun's -25 deg, not -15: traced in a scratch run, with the moon's light taken out the land at -15 deg reads 12.24
  against the moonless 9.49 (the twilight still in the scene), at -25 deg 9.488.
- **Restated (named), not added: "the sky above the ridge away from the bodies is unchanged"**. Its `moon4` frame (04:00 May 6,
  a 0.68-lit moon 25 deg up) fell 6.142 in mean and changed hash (`411be863`). Traced on this page in a scratch run: with the
  old moonlight put back in `SKY.moonCol` and `SKY.starDim` at 1 the frame hashes `63e2c7c4`, step 3's value, exactly; the
  glow is -5.2 of the mean, the Milky Way's dimming -0.8. `moon4` is now held to its step-4 mean (28.253, within 0.5) and hash;
  the other four frames as before.
- **"midnight is much darker than noon" stayed green, not restated:** noon 143.97, 00:30 18.86 (0.13x; the bound is 0.45x).
  On the step-3 page the same row read 142.56 / 35.20, but that row's input is the chase view, whose mean moves from run to run
  (above), so the change is not attributed to this step.
- **Break checks** (scratch copies, the suite run against each alone):

  | break | row that went red | value |
  | - | - | - |
  | moonlight without the phase (`moonIlluminanceLux(0, alt)`) | a full moon lights the night | the quarter's lift 1.09x the full moon's (19.89 against 19.12 over 10.09; wants 0.35 at most); also the sky-away row (`moon4` +5.27) |
  | no star dimming (`starDim = 1`) | a bright moon dims the stars | Polaris 233 / 233, ratio 1.0, `uStarK` 7.2 both; also the sky-away row (`moon4` +0.785) |
  | earthshine by day restored (no `* SKY.night`) | by day the moon's dark part | adds 13.3, mean 154 against the ring's 141.8 |
  | no moonlit ambient (`MOON_AMB = 0`) | a full moon lights the night | 1.288x |
  | the whole step-3 page | all three new rows and the sky-away row | 1.32x and the quarter 1.28x; Polaris 1.0; the dark part 154 |

  The sky-away row's catches are second catches, never counted as the row named.
- **Kept green:** step 3's earthshine row (the May 20 crescent's dark part at night, `SKY.night` above 0.95 there) and "the
  moon by day" (the lit part, unchanged).
- **Expected totals shift by one:** the overseer's row makes this step 120 + 3 = 123 (the plan said 122), so step 5's expected
  total is **128**, not 127.
- **Suite total: 123**, all green. `check-inline-js` GREEN; `gates.sh games/driving-simulator/index.html`: **GATES: GREEN**
  (smoke, games-sync, negtest scan, the suite 123/0), run alone. The badge is not stamped (step 7 does).
- **For step 6's break list:** "moonlight without the phase" and "no star dimming by the moon" land on the two rows above;
  add "earthshine by day" (the overseer's row) and "no moonlit ambient" (the night row), both shown above.

### Step 5 - DS-6: a slider for each thing in the sky (DONE 2026-11-02)

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

#### Results (step 5)

Worktree branch `worktree-oversee+dssky`, on `1125705` (step 4).

- **The before-hashes, recorded first.** The page of `1125705` was copied aside (sha1 `e7f2f911...`) before any edit, and the
  byte-identical row was written and run against that copy (`DS_PAGE`): seven frames from 30 m above the car, the star pass on,
  each holding what one slider scales, FNV-1a of the RGBA bytes: noon at the sun `0174b859`, the land at 17:00 `e7c77ffc`, 22:00
  at 32 deg / azimuth 200 `a3451048`, 22:00 at Jupiter's vertex `261017ad`, 04:00 May 6 at the moon `9a58595c`, the land at the
  full-moon midnight of May 31 `50d59823`, the May 20 crescent at 1.5 deg `937d0897`. On the built page all seven hash the same.
  **Traced on the way (two recordings thrown away):** the two land frames were not the same from run to run of the same page.
  First cause, the trees sway on the page's clock (`uWind = now`, real time): the row now holds `now` at 100 s for each frame.
  That left them still moving; second cause, the car is where the earlier rows that drive on real frames left it (the
  "Escape closes settings and the game carries on" row drives it), so the row teleports it to s = 400 first. With both, the
  before copy and the built page give the same seven hashes.
- **Built** (the page): `SKY_KEYS`, `SETTINGS.sky` merged on load as `vols` (plus: a value that is not a number 0-200 reads 100);
  `<h3>SKY</h3>` after TIME and `#sky-rows` built from `SKY_KEYS` (`input.skyk`, ids `sky-<key>`, `min 0 max 200 step 1`), labels
  Stars, Planets, Milky Way, Sun, Moonlight, Earthshine; `syncSettingsUI()` sets them; an `input` saves, then `updateSky()` for
  sun, moon and earthshine. `VS_STARS`: `uStarsK`, `uPlanetK`, `uNStars` (`STARS.n`), `vI *= gl_VertexID >= uNStars ? uPlanetK :
  uStarsK`, one POINTS draw, skipped when stars and planets are both 0. `renderScene()`: `uMwGain = MW_GAIN * starDim * mw/100`,
  `uMoonK = MOON_K * moon/100`. `updateSky()`: `SKY.sunCol *= sun/100`, `SKY.moonCol` and the moonlit ambient `* moon/100`,
  `SKY.moonES *= earthshine/100`. Every factor is multiplied on last, so at 100 it is an exact `* 1`. `__DS.SKY_KEYS`.
- **Rows (five new), measured in the suite on this page** (the 0 and 200 values from the break runs below, whose pages differ
  from this one only in the broken line; each break leaves the other sliders' values as here):

  | row | measured |
  | - | - |
  | at 100% everywhere the frame is byte-identical | the seven hashes above, all equal |
  | the SKY section | the h3 right after TIME; six range rows, labels and `data-k` in order, 0-200 step 1, value 100; at 320 x 568: every label and slider inside the panel, each label left of its slider, sliders at least 80 px wide, no sideways scroll in the panel or the page |
  | saved and restored | the six moved through the panel (an `input` event each, 37 / 150 / 0 / 200 / 64 / 121) are in the store and on a second page, its sliders showing them; the store without `sky` reads 100 everywhere; `sky: { stars: 50, moon: 0 }` reads those two and 100 for the rest |
  | each slider at 0 | at 100: Polaris adds 223, HIP 55642 103, Jupiter 235, the band 11.12 over the patch off it, the sun 267 saturated pixels, the gibbous moon adds up to 194, the crescent's dark part 60.97. Stars 0: Polaris 0, HIP 55642 0, Jupiter 235. Planets 0: Jupiter 0, Polaris 223. Milky Way 0: band - off 0, `uMwGain` 0. Sun 0: 0 saturated pixels (the moon still 194). Moonlight 0: the gibbous adds 0, the sun still 267. Earthshine 0: the dark part 0, the lit limb 220. Stars and Planets 0: no POINTS call (1 otherwise) |
  | each slider at 200 | Stars: HIP 55642 103 -> 206 (2.00), Jupiter unmoved; Planets: Jupiter at night 0.04 68 -> 136 (2.00), the star unmoved; Milky Way: `uMwGain` 0.004934 / 0.009869 / 0.019737 at 50 / 100 / 200, the band 5.77 / 11.12 / 20.98; Sun: `uSunCol` (3, 2.85, 2.58) -> (6, 5.70, 5.16), the land at 17:00 92.85 / 112.52 / 139.89; Moonlight: `uMoonK` 1.2 -> 2.4, `uMoonCol` 2x, the land at the full-moon midnight 14.12 / 17.92 / 24.69; Earthshine: `uMoonES` 0.03704 -> 0.07409, the dark part 34.05 / 60.97 / 99.92. Every GPU pair exactly 2x (powers of two are exact in float32) |

- **Decision not in the plan: a planet under 128.** Jupiter at 22:00 adds 235 (its point is far past white: `vI` up to 2.5
  times `uStarK` 7.2), and there is no planet under 128 up that night, so the planet half of the row forces `SKY.night` to 0.04
  for its two frames (the pass's gain carries the night linearly, as the "stars fade with the night" row uses): 68 at 100%. The
  star half uses iota Leonis (HIP 55642, mag 4), 103 at 100% at the suite's scale.
- **Decision not in the plan: the per-slider measures.** Stars and Planets on the vertex's own projection (STARS.on minus off,
  as the Polaris rows); Milky Way on the Milky Way row's two aims with the stars off; Sun on the sun row's saturated disc and,
  for 200, the land at 17:00 (its light); Moonlight on the gibbous zoomed (its disc) and, for 200, the land at the full-moon
  midnight (its light and ambient); Earthshine on the dark part of the May 20 crescent zoomed, "well inside" as the by-day row
  defines it (under 0.85 radii and 0.3 radii past the terminator). Each 0 check also confirms one neighbour stays (Jupiter when
  Stars is 0, the moon when the Sun is 0, and so on), so a slider wired to its neighbour is caught there too.
- **Restated (named), not added: "a radio station selector heads the sound section".** It found the section as
  `#settings h3:nth-of-type(4)`, and the SKY h3 is a new fourth; it now finds the h3 whose text is SOUND (same claim).
- **Break checks** (scratch copies, the suite run against each alone):

  | break | row that went red | value |
  | - | - | - |
  | the planets slider wired to the stars (`uPlanetK = stars/100`) | each slider at 0 (Stars: Jupiter 0, wants 60) and each at 200 (Stars: Jupiter 25 -> 51 moved; Planets: 25 -> 25) | 126 / 2 |
  | an old save reading 0 (every missing `sky` reads 0, a fresh page too) | saved and restored (the old save 0 everywhere), and 18 older rows whose first visit is now a sky of nothing | 109 / 19 |
  | an old save reading 0, narrowly (only a stored object without `sky`) | saved and restored alone (old: all six 0) | 127 / 1 |
  | the earthshine slider wired to moonlight (`moonES * moon/100`) | each slider at 0 (Earthshine: the dark part 60.97, wants at most 1) and each at 200 (`uMoonES` unmoved, the dark part 60.97 three times) | 126 / 2 |
  | the Milky Way slider ignored (`uMwGain` without `mw/100`) | each slider at 0 (Milky Way: band - off 11.12, gain 0.00987) and each at 200 (gain the same at 50 / 100 / 200) | 126 / 2 |

- **Expected 128, measured 128** (123 + 5), all green. `check-inline-js` GREEN; `gates.sh games/driving-simulator/index.html`:
  **GATES: GREEN** (smoke, games-sync, negtest scan, the suite 128/0), run alone. The badge is not stamped (step 7 does).
- **For step 6's break list:** the four above (planets to stars, old save 0, earthshine to moonlight, Milky Way ignored) land on
  the rows named; "each slider wired to the wrong term" for Sun and Moonlight is not yet run (Sun to the moon's light would show
  on the 0 row's Sun / Moonlight checks, untested). The DS-4 checks list's note "If DS-6 has landed, add its Earthshine slider row
  here" (`.claude/driving-simulator.md`) is for step 6's docs pass.

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
