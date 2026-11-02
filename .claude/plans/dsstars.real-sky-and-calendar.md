# dsstars - Driving Simulator: the real sky over Raleigh, NC (zmh-sky), and a calendar that runs a day per game day (DS-1)

**Status:** PARTIALLY IMPLEMENTED - step 1 of 5 done (2026-11-01), on branch
`claude/brave-sagan-odwmrd`, not on `main`. **Revised 2026-11-02 for zmh-sky:** steps 2-5 were
rewritten around zmhstudio's new sky kit, so the catalogue download that stopped the first run
(the proxy refused `cdsarc.cds.unistra.fr`) is gone. The first run's record:
`dsstars.real-sky-and-calendar.follow-up.md`.
**Requested:** 2026-11-01, the CD (third message of the day, verbatim):

> Oh yeah, fix the star field rotation. It looks like i am at the earths rotational north pole and
> star field spins around like a spinning top. Should look like star field looks to me in the sky
> from perspective of raleigh north Carolina in the spring. Add this to driving sim backlog.

Asked the same day whether the in-game date should advance a day per game day or stay one fixed
date per season, the CD chose **"A day per game day"**. Asked during this plan's drafting how the
run should get the star catalogue (this container's proxy refuses the hosts that serve it), the CD
chose **"Allow the host"**. That answer no longer matters: nothing is downloaded now.

**The revision (2026-11-02), the CD verbatim:**

> I just created a zmh-sky plugin. "git pull zmhstudio" then load the new zmh-sky plugin and update
> the backlog and plan(s) accordingly since this new plugin should streamline the sky work.

Asked what the star work should draw besides the stars, the CD chose all three offered: **the
planets, the moon in its real place, and the Milky Way band**. The moon's phase, size and light
stay in DS-4.

**What the revision changed:**

| Was (2026-11-01) | Now (zmh-sky) |
|---|---|
| BSC5 downloaded from CDS, packed by a new `build-stars.mjs` | the kit's `sky-data/v1` stars (XHIP via d3-celestial, BSD-3), 1,627 to mag 5, spliced as a `ZMH-SKY` block by the kit's CLI |
| the page's own NOAA `solar()` (step 1) and `celestial()` | the sun and the moon from `ZMH_SKY.skyAt()`: one sun for everything |
| a hand-built sky matrix, precession ignored | the kit's J2000 star matrix, **precession applied** |
| the spec's 22:00 star table (unprecessed, up to 0.33 deg off) | astronomy-engine's values from the kit's golden vectors |
| the plan's own magnitude and colour laws | the kit's `starAppearance` law and `bvToRGB` |
| stars only; planets, moon and Milky Way out of scope | planets as points in the star pass, the moon at its real place, the Milky Way band in the sky shader |
| step 2 stops if the host is refused | step 2 stops only if zmhstudio cannot be reached |

**Scope:** `games/driving-simulator/index.html` (the `ZMH-SKY` block, the sun and sky section, the
GLSL sky, `renderScene()`, the THE ROAD notes, the test hook; step 1 already did the settings, the
clock and the calendar), `games/driving-simulator/LICENSE-d3-celestial.txt` (copied from the kit),
the suite `.claude/tests/drive-driving-simulator.cjs`, a new break list
`.claude/tests/negtests/driving-simulator.json`, and the docs `.claude/driving-simulator.md`,
`.claude/tests/README.md`, `games/CLAUDE.md`, `CLAUDE.md`. Source TODO entry: `TODO.md` § Now,
the first `[driving-sim]` item. Full spec: `.claude/driving-simulator.md` § Backlog, DS-1 (revised
2026-11-02 to match). The kit: zmhstudio `plugins/zmh-sky/` (README, and the skill
`skills/sky-pipeline/SKILL.md`, which every step reads first).

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

At night the stars over the road are the real stars: the 1,627 to magnitude 5 in zmh-sky's
catalogue, with the naked-eye planets among them and the Milky Way's band behind them. On the first
night, Venus is low in the west after sunset and Jupiter higher up in the west. They all turn about
the celestial pole of date, due north 35.78 deg up, by true sidereal time. The moon is where it
really is, though it still looks and lights as it does today until DS-4. The game keeps a date
(step 1, built): Tue May 5, 2026 at 1 pm on a first visit, a day on at each midnight, Jun 20
wrapping to Mar 20, saved, on Raleigh's daylight-saving clock. The sun rises and sets for that date
in Raleigh. The hash-grid stars and `uStarRot` are gone.

## Context

The cause is traced (`.claude/driving-simulator.md` § Backlog, DS-1). `skyCol()` turns its star
lookup about the world's vertical axis, and `setFrameUniforms()` sets
`uStarRot = SKY.hour / 24 * TAU`. A sky turning about the zenith is the sky at the North Pole. The
stars themselves are a hash over (azimuth, elevation) cells, so they have no constellations. The
kit's skill names this exact bug as its first trap ("the zenith spin").

DS-3 (the other seasons) and DS-4 (the sun and moon's looks) both build on this plan's calendar,
observer and kit wiring. The names under "Design" are what those plans will cite. DS-2 (traffic
sound) shares the page, the suite and the context file, so plan-gen deferred all three. Re-sweep
with `/zmh-producer:backlog-plan-gen driving-sim` once this lands.

## Corrections to the spec (2026-11-01, and again 2026-11-02 with precession)

First recomputed 2026-11-01 with two independent methods: NOAA's Meeus-based solar calculator, and
the Astronomical Almanac's low-precision sun with Meeus 12.4 sidereal time. The two agree within
0.011 deg. Recomputed 2026-11-02 with the kit (`skyAt`), with an independent IAU 1976 precession
(Meeus 21.2-21.3, written for the check), and against astronomy-engine's values in the kit's golden
vectors. All three agree within 0.01 deg.

- **May 5, 2026 (local noon):** declination **+16.4 deg** (the spec said +16.0); equation of time
  +3.3 min; solar noon 13:11; sunrise 06:18; sunset **20:05 EDT** (the spec said 20:03). The noon
  altitude is 70.6 deg. Step 1 measured 06:18:09 and 20:04:52 on the page and 06:18:10 and
  20:04:51 in the suite. The kit's sun gives declination +16.387 and EoT +3.31 min.
- **The equinox noon altitude** is 90 - 35.78 + 0 = **54.2** deg, not 53.7. DS-4's text, DS-4's
  sun table and DS-3's declinations were also off by 0.3-0.4 deg, and have been corrected in
  `.claude/driving-simulator.md`.
- **LST, unchanged:** 204.41 deg at the local midnight that starts May 5, and 11.687 h at 22:00 EDT.
- **The spec's 22:00 star table was wrong, traced 2026-11-02.** It took J2000 RA/Dec without
  precessing them to 2026, and so did this plan's first draft, which called it "confirmed". The
  zmhsky run found this (its follow-up, with the table), and this revision reproduced both numbers:
  - Unprecessed, it matches the old table within 0.04 deg.
  - With precession it moves up to 0.33 deg in altitude. Refraction does not explain the gap.

  The correct table, for May 5, 2026 at 22:00 EDT (2026-05-06 02:00 UT), uses astronomy-engine's
  values from zmh-sky `vectors/golden.v1.json`, records `2026-05-06T02Z/raleigh/hip<N>`. The kit
  and the independent precession both match them within 0.01:

  | Star (HIP) | Altitude | Azimuth | Old table |
  |---|---|---|---|
  | Regulus (49669) | 58.382 | 226.504 | 58.3 / 227 |
  | Arcturus (69673) | 51.958 | 105.537 | 52.3 / 106 |
  | Spica (65474) | 36.757 | 147.113 | 37.0 / 147 |
  | Dubhe (54061) | 63.557 | 350.415 | 63.4 / 350 |
  | Vega (91262) | 12.234 | 50.643 | 12.4 / 51 |
  | Betelgeuse (27989) | 7.428 | 273.807 | 7.1 / 274 |
  | Sirius (32349) | 2.822 | 246.980 | 2.6 / 247 |
  | Polaris (11767) | 35.386 | 359.403 | 35.2 / 359.4 |

- **Polaris, precessed:** over May 5 its altitude runs 35.15-36.41 deg, and its azimuth stays within
  0.77 deg of north. The first draft's 35.04-36.52 was the unprecessed figure.
- **The J2000 pole is not the pole of date.** In 2026 it sits 0.15 deg from it: through the kit's
  star matrix it lands at altitude 35.926 deg, not 35.78. The pole the sky turns about is the
  **pole of date**.
- **The planets and the moon at 22:00 EDT on May 5** (kit, matching astronomy-engine):
  - Venus: magnitude -3.9, altitude 4.3 deg, azimuth 296 (low in the west-north-west).
  - Jupiter: -2.0, altitude 33.5, azimuth 275 (west).
  - Mercury, Mars and Saturn are below the horizon.
  - The moon is waning gibbous (84% lit), below the horizon at -23.1 / 109, rising later.

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

The observer, the date, the seasons, the clock, the UTC offset, the Julian date and "Settings and save" were built in step 1, and its Results give the real names. Their line numbers below are the 2026-11-01 ones, kept as history.

**Observer.** `const OBS = { lat: 35.7796, lon: -78.6382 }` (degrees, east positive). It replaces
`LAT` (`index.html:1923`); update the comment above it (`index.html:1921-1922`).

**The date is an integer MJD** (Modified Julian Date at 0h UT; May 5, 2026 = **61165**), held in
`SKY.mjd`. Do not call it `SKY.day`: that name is already the daylight factor (`index.html:1920`).
Civil dates come from pure arithmetic, with no `Date` objects in the sky code. The player's device
time zone is not Raleigh's, and `new Date(...)` local methods would leak it in.
- Write `mjdOf(y, m, d)`, `civilOf(mjd)` (Hinnant's `days_from_civil` / `civil_from_days` on
  `mjd - 40587` days since 1970-01-01) and `weekday(mjd) = (mjd + 3) % 7` (0 = Sunday; 61165 gives 2,
  a Tuesday).
- `dateText()` gives "Tue May 5".

**Seasons** (`SEASON_DATES`, beside `SEASONS` at `index.html:226`): `{ spring: [Mar 20, Jun 20,
2026, middle May 5], summer: [Jun 21, Sep 22, 2026, middle Aug 6], autumn: [Sep 23, Dec 20, 2026,
middle Nov 6], winter: [Dec 21 2026, Mar 19 2027, middle Feb 4 2027] }`, stored as MJDs. DS-3 opens
the other three. Their rows exist now because DS-3 cites them and the DST rows use autumn.

**Clock and date** (`advanceClock()`, `index.html:2840-2843`):
- Let `t = SKY.hour + dt * 24 / cyc`.
- A step that crosses midnight steps the date by one, with a while loop over 24 h.
- A date past the season's last day becomes its first. At that wrap, re-derive `SKY.dst` by the rule
  and leave the hour alone.
- A step never spans two midnights at any setting (dt <= 0.1 s, the shortest day is 24 s). Keep the
  loop anyway.
- The hour arithmetic must keep the three clock rows exact (`suite:118-122`).
- `cyc === 0` (stopped) changes nothing.

**UTC offset** (`utcOffset(mjd, hour)`, -4 EDT or -5 EST). EDT runs from 02:00 on the second Sunday
of March to 02:00 on the first Sunday of November (2026: Mar 8 and Nov 1; 2027: Mar 14).
- **The clock changes as Raleigh's does**, held as state in `SKY.dst`. Pure (mjd, hour) is ambiguous
  in the repeated hour, and re-deriving it would loop.
  - On the fall-back day, `advanceClock()` crossing 02:00 with `SKY.dst` true sets the hour back to
    01:00 and clears `dst`.
  - On the spring-forward day, crossing 02:00 with `dst` false jumps to 03:00 and sets it.
  - UT, and so the sun and stars, run on without a jump.
- At boot, a date step and the time-of-day slider, `dst` is re-derived by the rule, and the repeated
  hour on the fall-back day reads as EDT, the first one.
- Spring (Mar 20 - Jun 20) is EDT throughout, so the transitions are only reachable through the
  hook with `SETTINGS.season = 'autumn'` / `'winter'`. Tests do exactly that and restore spring.
  The dropdown keeps those options disabled.

**Julian date.** `jd = 2400000.5 + SKY.mjd + (SKY.hour - off) / 24`, with `off` = -4 or -5.
JavaScript numbers are doubles, so precision is fine. Never pass a JD to GLSL.

**The sun from the date.** Step 1 built this with the NOAA `solar()` kernel and `celestial()`.
Step 2 replaces both with the kit (below). The suite's sun rows from step 1 test the result, not the
formula, so they carry over unchanged.

**Line anchors** for the rest of this section, read 2026-11-02 on the branch (step 1 plus its
comment fix). Re-grep before editing:

| Lines | What |
|---|---|
| 105-107 | the THE ROAD notes (107 is the kits line) |
| 116 | `/*KITS:END*/` |
| 1229-1237 | `PERF`'s draw wrapper |
| 1239 | `GLSL_COMMON` |
| 1241 | `uStarRot` |
| 1261-1271 | the hash stars |
| 1441-1457 | `FS_SKY`, with the ridge at 1450-1456 |
| 1550 | `initGL()` |
| 1977 | `SKY` |
| 1982 | `OBS` |
| 1986-1999 | `solar()` |
| 2001 | `julianDate()` |
| 2003-2009 | `celestial()` |
| 2010 | `updateSky()` |
| 2179 | the `uStarRot` setter |
| 2260 | `renderScene()`, with the sky draw at 2266 |
| 2347 | the mirror's `renderScene()` call |
| 2914 | `sc` in `resize()` |
| 3037 | `window.__DS` |

**zmh-sky in the page (step 2).**
- **Where the kit is.** It lives in zmhstudio, `plugins/zmh-sky/`. A remote session has the sibling
  clone at `/home/user/zmhstudio`. Without one, `add_repo ZackHelms/zmhstudio` (read) and clone it.
  Record the zmhstudio commit in the Results (shipped at `7b9c40e`, 2026-11-02).
- **Read the skill first:** `skills/sky-pipeline/SKILL.md`, its Conventions and Traps. It loads as
  `zmh-sky:sky-pipeline` once the plugin is installed: `enabledPlugins` in `.claude/settings.json`
  names it, and `/load-plugins` installs it in a multi-repo session.
- **The markers.** Put `/*ZMH-SKY:BEGIN*/` and `/*ZMH-SKY:END*/` on their own lines right after
  `/*KITS:END*/` (the first script).
- **The splice,** from the repo root:
  `node <zmhstudio>/plugins/zmh-sky/cli/zmh-sky.mjs splice --page games/driving-simulator/index.html --mag 5 --parts stars,planets,glsl`
  - It prints `ZMH-SKY=<page> bytes=<n> stars=<n>`. Expect 1,627 stars and about 98.5 KB (the same
    cut measured 98,548 B with `emit` on 2026-11-02).
  - The block defines `ZMH_SKY` (the whole library), `SKY_DATA` (`stars: { fields: ['hip', 'ra',
    'dec', 'mag', 'bv'], rows }` and `planets`) and `ZMH_SKY_GLSL` (`STAR_VERTEX`, `STAR_FRAGMENT`,
    `MOON_DISC_GLSL`, `MILKY_WAY_GLSL`).
  - The constellation lines are left out: the game draws no figures, and they would add 20 KB.
- **The block is generated, never hand-edited,** like KITS: to change it, splice again. The splice
  is idempotent, and a second run must leave the page byte-identical. Check that, and say so in the
  Results.
- **Attribution (BSD-3; the kit's `data/SOURCES.md`).**
  - Copy `plugins/zmh-sky/data/LICENSE-d3-celestial.txt` to
    `games/driving-simulator/LICENSE-d3-celestial.txt`.
  - Add a THE ROAD paragraph after the kits line (index.html:107). It says the sky (sun, moon,
    planets and stars) is zmh-sky's, computed for Raleigh and the game's date. It gives the kit's
    attribution line verbatim, "Star data: XHIP (Anderson & Francis 2012) via d3-celestial, (c) 2015
    Olaf Frohn, BSD-3-Clause; constellation lines after the IAU figures, modified by O. Frohn;
    planet elements: JPL (Standish), Table 1.", and links `LICENSE-d3-celestial.txt`.
  - Use Olaf Frohn's name nowhere else (clause 3).
  - XHIP's own upstream terms are unverified (the kit's follow-up). That is the kit's open item, not
    a stop condition here.

**The bodies from the kit (step 2).**
- `const OBS_SKY = { latDeg: OBS.lat, lonEastDeg: OBS.lon, heightM: 0 }`.
  - `heightM` 0 matches the kit's own Raleigh observer. Raleigh is about 100 m up, which moves the
    moon's parallax by far less than 0.001 deg (assumed).
  - `lonEastDeg` is east-positive, so Raleigh is negative.
- `updateSky()` calls `const s = ZMH_SKY.skyAt(julianDate(), OBS_SKY, SKY_DATA.planets)` once, then
  sets:
  - `SKY.sun = s.sun.enu`. The kit's ENU `[east, up, north]` is the page's x, y, z (`celestial()`'s
    axes), so there is no remap.
  - `SKY.decl = s.sun.decDeg`, `SKY.eot = ZMH_SKY.equationOfTimeMin(jd)`, and `SKY.solarNoon` as
    step 1 does.
  - `SKY.moon = s.moon.enu`, the topocentric moon (the skill's trap: never the geocentric `moon()`
    for anything drawn). Also keep
    `SKY.moonPhase = { phaseAngleDeg, illuminatedFraction, waxing, moonAgeFraction }` from `s.moon`
    for DS-4; nothing in DS-1 reads it.
  - `SKY.lst = s.lstDeg`, and `SKY.starM.set(s.starMatrix)` into a `Float32Array(9)`, row-major as
    the kit returns it.
  - `SKY.planets`: from `s.planets`, the ones with `nakedEye`, kept as `{ id, mag, valid, enu,
    altDeg, azDeg }`. Those are Mercury, Venus, Mars, Jupiter and Saturn; check the kit's
    `NAKED_EYE` table.
- **Delete `solar()` and `celestial()`.** Their only callers are in `updateSky()`. `julianDate()`
  stays the one Julian date.
- **The moon's look stays.** Moonlight (`SKY.moonCol`) keeps its altitude rule, now on the real
  moon, and `skyCol()`'s moon disc keeps its look; DS-4 changes both. The placeholder was up every
  night; the real moon is down on many nights. That is the real sky.
- **One sun** (the skill's trap). The light, the sun disc and, in DS-4, the moon's terminator all use
  `s.sun`. Nothing else in the page computes a sun.

**The star matrix.**
- `s.starMatrix` is the kit's `equatorialJ2000ToHorizonMatrix(jd, obs)`: J2000 to ENU, **precession
  included**, row-major, with determinant -1 (ENU is left-handed, as the kit notes).
- Upload it with `gl.uniformMatrix3fv(loc, true, SKY.starM)`. The `true` (transpose) matters:
  WebGL2 allows it, and the kit's matrices are row-major.
- Never compose a matrix from the hour and the latitude (the zenith-spin trap), and never turn the
  stars on the CPU.
- The matrix is orthogonal, so `transpose(uStarM) * d` takes a world direction back to J2000. The
  Milky Way and the planets use that.
- `starDir(i)` in JS is `ZMH_SKY.mat3MulVec(SKY.starM, unit_i)`, so the suite tests what the GPU is
  given.

**The star pass (step 3)**, one draw per `renderScene()`, so the mirror gets it too.
- **The program** is `PRG.stars`, compiled in `initGL()`: the page's own `VS_STARS`/`FS_STARS`,
  ported from `ZMH_SKY_GLSL.STAR_VERTEX`/`STAR_FRAGMENT`. It keeps the same law and constants, in
  the page's frame and draw state. Its fragment shader includes `${GLSL_COMMON}`.
- **The VAO** is built once. Each star vertex carries its J2000 unit vector
  (`ZMH_SKY.unitFromRaDec(ra, dec)`), its magnitude, and its linear colour
  (`ZMH_SKY.bvToRGB(bv)`; a null `bv` gives white). Five planet vertices follow (below).
- **The draw** goes right after the sky (index.html:2266):
  - the depth test off and `depthMask(false)`, as for the sky;
  - additive blend `ONE, ONE`, then blend off;
  - `gl.drawArrays(gl.POINTS, 0, STARS.n + 5)`;
  - skipped when `SKY.night <= 0` or `STARS.on === false`.
- **The vertex shader:** `vec3 enu = uStarM * aDir; gl_Position = uVP * vec4(enu * 1000.0, 1.0)`,
  with the world's `vp` (far plane 2400, camera-relative, so the eye is at the origin). The depth
  test is off, so the kit's `xyww` / `depthFunc(LEQUAL)` note does not apply here. Pass `enu` to the
  fragment shader.
- **The look,** the kit's `starAppearance` law:
  - intensity `10^(-0.4 * 0.5 * (m - (-1.46)))`: gamma 0.5 on flux, Sirius = 1;
  - extinction `m += 0.2 * airmass(alt)`, with the kit's Kasten-Young air mass;
  - size `mix(1.0, 4.0, min(1.0, I)) * uPx`, the kit's 1-4 px. `uPx` is the main pass's render scale
    (`sc` in `resize()`; keep it in a variable) and 1 in the mirror;
  - a fade over the first 2 deg of altitude, nothing below the horizon;
  - times `SKY.night`, `uExposure` and one page constant `STAR_GAIN` (assumed). Start where a
    magnitude-1 star reads clearly white after the tonemap, and record the value.
  - The pass draws after `tonemap()`, so keep the values small.
  - Planets brighter than Sirius go over 1. Clamp the intensity at 2.5 (assumed), so Venus is a
    bright point, not a flare.
- **The ridge must hide stars.** The distant hills are drawn inside the sky shader
  (index.html:1450-1456), not as geometry, so the world's depth test cannot cover a star behind
  them.
  - Move the ridge height into `float ridgeY(float az, float mtn)` in `GLSL_COMMON`. `FS_SKY` calls
    `ridgeY(az, uMtn)`, and `FS_STARS` discards below `ridgeY(atan(enu.z, enu.x), 1.0)`.
  - The sky's pixels must stay byte-identical; a day-pixel row confirms it.
- **Delete** the hash-star block (index.html:1261-1271), `uStarRot` (1241) and its setter (2179).
  Nothing else reads them; confirm with a grep.
- **PERF:** the draw wrapper already counts the call. `triCount` returns 0 for POINTS, so the
  triangle count does not move.

**The planets (step 3).**
- The last five vertices of the star buffer are Mercury, Venus, Mars, Jupiter and Saturn. Uranus,
  Neptune and Pluto are never drawn.
- `updateSky()` rewrites them with `bufferSubData` once the GL is up:
  - direction = `ZMH_SKY.mat3MulVec(ZMH_SKY.mat3Transpose(SKY.starM), p.enu)`. This goes back
    through the same matrix, so the shader's `uStarM` lands it exactly on `p.enu`;
  - the kit's magnitude;
  - a fixed colour each (assumed): Mercury and Venus white, Mars (1.0, 0.62, 0.42), Jupiter (1.0,
    0.95, 0.85), Saturn (1.0, 0.9, 0.7);
  - a planet that is not `valid` (outside 1800-2050) gets magnitude 99, which draws nothing.
- The same law applies, so a planet is a star's point, only brighter.

**The Milky Way (step 3).**
- `FS_SKY` takes `ZMH_SKY_GLSL.MILKY_WAY_GLSL` and the `uStarM` uniform. Put it in `FS_SKY`, not
  `GLSL_COMMON`, so the fog and the paint reflections stay without it.
- Above the ridge, and only when `uNight > 0.0` (a branch, so the day sky costs nothing and keeps
  its pixels byte-identical), it adds to `c` before `tonemap()`:
  `MW_GAIN * zmhMilkyWay(transpose(uStarM) * d) * MILKY_WAY_RGB * uNight * smoothstep(0.0, 0.1, d.y)`.
- `MILKY_WAY_RGB` comes from `ZMH_SKY.MILKY_WAY_RGB`, passed as a uniform or inlined at compile.
- `MW_GAIN` is one page constant (assumed). Start from the kit's scale, so the band is faint:
  Raleigh's sky is light-polluted, and the CD chose the band knowing that.
- `MW.on` switches it, for the tests and the frame cost.
- It costs a galactic transform on every night sky pixel; the snippet returns early off the band.
  Step 4 measures it.

**Settings and save.**
- `SETTINGS.date` holds the MJD, written by `saveSettings()` whenever the date steps (once a game
  day).
- On load, a missing date, or one outside the current season's range, becomes the season's middle
  date. The hour still starts at 13:00 (`boot()`, `index.html:2907`).
- The TIME section shows the date as `<span id="date-val">`, styled like `#tod-val`
  (`index.html:44`), in the Time-of-day row before the clock (`index.html:77`). `syncSettingsUI()`
  (`index.html:2796-2802`) fills it, and so does the open-menu refresh in `frame()`
  (`index.html:2872`).
- **It must not overflow the panel at 320 px wide.** If it would, put it on its own line under the
  slider and say which in the Results.
- The time-of-day slider (`index.html:2823`) moves the hour only, never the date.

**Test hook** (`window.__DS`, index.html:3037).
- Step 1 added `OBS, SEASON_DATES, mjdOf, civilOf, weekday, dateText, utcOffset, solar, setDate`.
- Step 2 drops `solar` and adds `ZMH_SKY`, `SKY_DATA` and `OBS_SKY`.
- Step 3 adds `STARS` (`{ n, on }` and the VAO's vertex count), `MW` (`{ on }`), `starDir` and
  `STAR_GAIN`.
- The `SKY` export already carries `mjd, dst, decl, eot, solarNoon`, and gains `lst, starM, planets,
  moonPhase`.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans). One task per arc step; each is one session's work and one commit on the arc's branch.
Step 1 is done.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | (done 2026-11-01) the calendar, DST, the sun from the date, the date in TIME and saved | cross-system | opus | high | - |
| 2 | Splice zmh-sky; licence and notes; the sun, moon, planets, LST and star matrix from `skyAt()`; delete `solar()`/`celestial()`; the kit and body rows | cross-system | opus | high | swaps the sun under rows that must stay green; four frames to keep straight (ENU, J2000, of date, topocentric); an independent oracle for every row |
| 3 | The star pass with the planets, `ridgeY()`, the Milky Way; delete the hash stars; the star, planet, Milky Way and pixel rows | rendering | opus | high | GL state in a shared render path (the mirror too), shader edits that must leave the sky's day pixels unchanged, pixel rows that must discriminate |
| 4 | Break list and negative tests; frame cost; docs | eval+docs | opus | high | each break must land on its own row; any MISSED needs a row or an equivalence argued; docs read from the code |
| 5 | Ship: badge, gates, land on `main`, Pages, report | ship | sonnet | medium | the documented procedure, exact commands below |

- **Ordering:** strictly 2 -> 3 -> 4 -> 5. Every step touches `index.html` and the suite, so nothing
  runs in parallel. Step 3 needs step 2's block and `SKY.starM`.
- **Files owned per task:**
  - 2: the `ZMH-SKY` markers and block, the sun-and-sky section (`OBS_SKY`, `updateSky()`, the
    deletions), the THE ROAD notes paragraph, `LICENSE-d3-celestial.txt`, the hook, the suite;
  - 3: `GLSL_COMMON`, `FS_SKY`, the new `VS_STARS`/`FS_STARS`, `initGL()`, `setFrameUniforms()`,
    `renderScene()`, `resize()`, `updateSky()`'s planet upload, the hook, the suite;
  - 4: the break list and the four docs;
  - 5: the badge line and the plan's move to `DONE/`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every edit to the page, and `.claude/scripts/gates.sh games/driving-simulator/index.html`
  GREEN at the end of every step. The gates smoke the page, run this suite, check the games sync
  and scan for live breaks.
- **Tier audit (required):** no step passes a haiku checklist.
  - Steps 2, 3 and 4 each need judgment across the kit's frames, the shaders and the suite (opus,
    high).
  - Step 5 is the procedure, but it pushes to `main` and verifies a deploy (sonnet, medium).
- **Decision defaults:** everything under "Design" above. Beyond it:
  - **The kit's way first:** its conventions, its law, its GLSL as the reference. A page-side
    variation (the gain constants, the ridge, `uPx`) is a row in `.claude/driving-simulator.md`'s
    "Assumed, not decided" table.
  - Never patch the kit's code inside the page's block. A kit bug goes to zmhstudio as a report, and
    the step stops if it blocks.
  - A choice not listed here goes into that table as a row, never silently.
  - **A suite row the new rules contradict is restated** (same claim, the new rule) and named in the
    Results. Never delete a row to go green.
  - If a tolerance proves too tight for SwiftShader's pixels, widen it only after tracing why, and
    record the trace.
- **The suite's oracles.** The suite never copies the page's or the kit's code. It checks against:
  - its own formulas: the Almanac sun, Meeus 12.4 GMST, Meeus 21.2-21.3 precession, Meeus 49.1 mean
    phases;
  - standard J2000 star positions typed in sexagesimal (SIMBAD);
  - astronomy-engine's numbers from zmh-sky's `vectors/golden.v1.json`, typed in with their record
    ids as the source. astronomy-engine is an independent oracle that is never shipped, so its
    values are fair to hard-code.
- **Embedded-content QA.** The suite had 86 checks after step 1 (measured). Expected after each
  step: 86 + 4 = 90 after step 2, and 90 + 13 = 103 after step 3. Each step grows the suite by
  exactly the rows it adds; state the real total in each step's Results, and say why if it differs.
  Line numbers were read on the branch on 2026-11-02; re-read before editing.
- **Escalation triggers** (stop and report to the CD; do not work around):
  - zmhstudio cannot be reached: no sibling clone, and `add_repo ZackHelms/zmhstudio` refused.
    Never re-type the star data, and never fetch it from anywhere else.
  - The splice fails, or a second splice changes the page. That is a kit bug, for zmhstudio.
  - The star pass and the Milky Way cost more than a frame budget's worth on the perf block (step 4
    measures).
  - Anything that would need a change to `drivingSimulator.settings.v1`'s key.
- **Playtest** (after step 5):
  - About 21:00: Venus, very bright, low in the west-north-west (about 15 deg up; it sets about
    22:30); Jupiter higher in the west.
  - At 22:00, look north: the Big Dipper high in the north, and Polaris barely moving.
  - South-west: Regulus and Leo. East: Arcturus, then Vega rising in the north-east.
  - Watch the sky turn about Polaris, not overhead.
  - After midnight: the Milky Way faint in the east (Cygnus, then Sagittarius later).
  - The moon rising late on May 5 (waning gibbous); its look is still the old disc until DS-4.
  - The date in the settings ("Tue May 5"), stepping a day after midnight. The sun sets a little
    after 8 pm.
  - Too many stars or too faint on your phone? `STAR_GAIN` and `MW_GAIN` are each one constant, and
    the magnitude cut is the splice's `--mag`.
- **Publish:** step 5 pushes `main`, which is the publish. Verify the Pages run (producer config
  § Publish). Steps 2-4 push the branch only.
- **Commit strategy:** one conventional commit per step on the arc's branch, scope
  `driving-simulator`, ending "(dsstars step N)". Step 5 lands the branch on `main` as one commit
  with `.claude/scripts/land-on-main.sh <branch> <message-file>`, dry-run first.

## Resume here (a session told "run the next open step of this arc")

1. Read `CLAUDE.md` § Git workflow. Concurrent sessions push to `main`; never author a merge commit
   on `main`; `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main`
   immediately before any push to `main`.
2. Read this file in full, including every step's Results. Then read `.claude/driving-simulator.md`:
   § Backlog DS-1, § Architecture, § Testing, and the "Assumed, not decided" table.
3. **Step 1 is on `origin/claude/brave-sagan-odwmrd`** (the session that ran it could push only to its
   own designated branch, and `main` must not get the game's half before step 5). Start from that
   branch: a worktree cut from `main`, as an oversee run cuts one, merges
   `origin/claude/brave-sagan-odwmrd` in before anything else, then re-runs the gates (86 checks).
   That branch is "the arc's branch" below; push to whichever branch your own session may push to.
4. **Have the kit:** a zmhstudio clone at `7b9c40e` or later (`/home/user/zmhstudio` in a remote
   multi-repo session, else `add_repo ZackHelms/zmhstudio`), and the `zmh-sky:sky-pipeline` skill
   (or read `plugins/zmh-sky/skills/sky-pipeline/SKILL.md` directly).
5. Run the first step in the table below that is not DONE, and only that one. Then tick it, append a
   Results section (append, never rewrite), commit, push the branch, stop and report. **Never push
   to `main` before step 5.**

Tools:
- Gates: `.claude/scripts/gates.sh games/driving-simulator/index.html`. It finds `playwright-core`
  itself; Chromium is at `/opt/pw-browsers/chromium`.
- Screenshots: `node .claude/scripts/shot-page.cjs games/driving-simulator/index.html <out.png> w=844 h=390 wait=4000 eval="..."`
  with the hook. Software rendering takes 300-800 ms a frame, so it says nothing about phone frame
  rate.
- Break lists on copies, after one run of the suite on the unbroken page:
  `python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/driving-simulator.json --page-env DS_PAGE --jobs 2 --freeze .claude/tests/drive-driving-simulator.cjs -- node .claude/tests/drive-driving-simulator.cjs`
  (`--only a,b` for a subset; never edit the page while it runs).

The CD's standing preferences:
- Keep replies short.
- Plain ASCII only: straight quotes, plain hyphens, no curly quotes or en/em dashes.
- Label anything inferred, assumed or sourced ("inferred:", "assumed:", "source: X").
- A cause reported to the CD must have been traced in code or data; otherwise call it a hypothesis.
- Don't ask the CD about deleting remote branches.

## Steps (one per session, then `/compact`; each ends: tick here, Results, commit to the arc's branch, push the branch)

| # | Step | Status |
|---|---|---|
| 0 | The CD's words, the catalogue answer and the spec corrections recorded (this file) | DONE 2026-11-01 |
| 1 | `DS_PAGE`; calendar, DST, sun from the date, date in TIME and saved; restated sun row; calendar rows | DONE 2026-11-01 |
| 2 | zmh-sky spliced, licence and notes; the sun, moon, planets, LST and star matrix from the kit; kit and body rows || DONE 2026-11-02 |
| 3 | The star pass with planets, `ridgeY()`, the Milky Way, hash stars deleted; star, planet, Milky Way and pixel rows | |
| 4 | Break list run whole, frame cost, docs | |
| 5 | Ship: badge, gates, land on `main`, Pages, report to the CD | |

(Step 2 was the BSC5 download until 2026-11-02; it was blocked on 2026-11-01 because the host was
refused, and the revision replaced it.)

### Step 1 - the calendar and the sun from the date

- **First, the suite's page path.** `drive-driving-simulator.cjs:17` hard-codes
  `/home/user/ZackHelms.github.io/...`. In an oversee worktree it would test the **primary
  checkout's page**, not the branch's.
  - Make it `const PAGE = 'file://' + (process.env.DS_PAGE || path.join(process.cwd(), 'games', 'driving-simulator', 'index.html'))`.
    `gates.sh` cds to the repo root, so `process.cwd()` is the worktree's.
  - When `DS_PAGE` is set, the last line must not read as a clean pass for the shipping page.
    `negtest-copies.py`'s contract says a suite must never print its GREEN line on a copy. Follow
    `drive-taas-factory.cjs:44` and `:2144`, which prints `PASS-ON-COPY` there: here, end the line
    with ` (copy)`. The exit code is unchanged.
- Everything under "Design" for the observer, the date, the seasons, the clock, the UTC offset, the
  Julian date and the sun, plus the settings and save part and the date in TIME. Leave the stars
  alone until step 3: the hash stars still spin.
- **Restate** `suite:125` ("a summer day: the sun sets about 7:45 pm and rises about 6:15 am") as
  "May 5 in Raleigh: sunrise and sunset within 10 min of the suite's own computation (about 6:18 am
  and 8:05 pm EDT)":
  - Scan the page's `SKY.sun` over the day in 1-minute steps for the -0.833 deg crossings, at
    `SKY.mjd = 61165` with `SETTINGS.cycle = 0`.
  - Compare them with the suite's own sun: the Astronomical Almanac's low-precision sun (RA and Dec
    from `n = jd - 2451545`: `L = 280.460 + 0.9856474 n`, `g = 357.528 + 0.9856003 n`,
    `lambda = L + 1.915 sin g + 0.020 sin 2g`, `eps = 23.439 - 0.0000004 n`), turned to alt/az
    through Meeus 12.4 GMST and Raleigh's longitude.
  - The page's `solar()` must not be copied into the suite.
- Rows 123/124 (noon high, midnight below) should hold unchanged on May 5. If either moves, trace it.
- New rows (8):
  1. A first visit is Tue May 5, 2026 at 1:00 pm (`SKY.mjd === 61165`, `SKY.hour === 13`,
     `dateText() === 'Tue May 5'`, EDT).
  2. Crossing midnight steps the date by exactly one. Three game days of `advanceClock(0.1)` at
     cycle 144 give +3; the hour rows are untouched.
  3. Jun 20 at 23:59, stepped past midnight, becomes Mar 20.
  4. The date is saved and comes back. A second page in the same browser context reads it. A saved
     date outside spring (hand-written into localStorage) falls back to May 5.
  5. `utcOffset` follows the US rule: -4 on May 5, -5 on Dec 1, the change at 02:00 on Mar 8 and
     Nov 1, 2026 and on Mar 14, 2027.
  6. Fall-back: with `SETTINGS.season = 'autumn'` on Nov 1, 2026 from 01:50 EDT, stepping past
     02:00 reads 01:0x EST once and never again that night. The sun's direction moves less than
     0.5 deg across the step (UT is continuous). Restore spring.
  7. `SKY.decl` and `SKY.solarNoon` match the suite's own within 0.1 deg and 1 min on Mar 20, May 5
     and Jun 20.
  8. The TIME section shows `dateText()` in `#date-val`, which updates after a midnight crossing on
     the next open. The time-of-day slider moves the hour and not the date.
- Suite 78 -> 86 (the restated row stays one row).

#### Step 1 results

Built (2026-11-01, oversee worktree `worktree-oversee+dsstars`):
- **Suite page path.** `drive-driving-simulator.cjs` now `require('path')`s and reads
  `PAGE = 'file://' + (process.env.DS_PAGE || path.join(process.cwd(), 'games', 'driving-simulator', 'index.html'))`.
  With `DS_PAGE` set (`COPY`), the final line ends ` (copy)` (`TAIL`); the exit code is unchanged.
- **Calendar** (a new "the calendar" block beside `SEASONS`, before `SETTINGS`): `mjdOf(y, m, d)`,
  `civilOf(mjd)` -> `{ y, m, d }` (Hinnant, on `mjd - 40587`), `weekday(mjd)` (0 = Sunday),
  `WEEKDAYS`, `MONTHS`, `dateText(mjd)` ("Tue May 5"), `SEASON_DATES` (`{ season: [first, last,
  middle] }` as MJDs), `dstDays(y)` -> `[second Sunday of March, first Sunday of November]` and
  `utcOffset(mjd, hour)`. No `Date` objects anywhere in it.
- **Settings.** `SETTINGS.date` (an MJD, `null` by default) in the same `drivingSimulator.settings.v1`
  object; after the season coercion, a missing, non-integer or out-of-season date becomes the
  season's middle date.
- **Sky.** `SKY` gains `mjd`, `dst`, `decl` (degrees), `eot` (minutes) and `solarNoon` (local clock
  hours). `OBS = { lat: 35.7796, lon: -78.6382 }` (degrees) and `RAD` replace `LAT`, `DECL` and
  `SOLAR_NOON`. `solar(jd)` is the plan's kernel verbatim; `julianDate()` gives the JD (UT) from
  `SKY.mjd`, `SKY.hour` and `SKY.dst`. `updateSky()` sets `decl`, `eot`, `solarNoon`, then
  `SKY.sun = celestial(H, SKY.decl)` and the moon by today's rule `celestial(H + 12.8, -SKY.decl * 0.6)`.
  `celestial(hour, decl)` takes degrees and converts inside. No refraction.
- **Clock.** `advanceClock(dt)`: `t = SKY.hour + dt * 24 / cyc`; `while (t >= 24) { t -= 24; nextDate(); }`;
  then, if the step crossed 02:00, the fall-back (`t -= 1`, `dst = false`, only with `dst` true on
  the first Sunday of November) or the spring-forward (`t += 1`, `dst = true`, only with `dst` false
  on the second Sunday of March). `cyc <= 0` returns at once. `nextDate()` steps the date (past the
  season's last day, or before its first, to its first), re-derives `dst` by the rule at 00:00 and
  saves. `setDate(mjd)` sets the date, re-derives `dst` at the current hour, saves and calls
  `updateSky()`; it is the hook's sanctioned way to change the date. Boot sets `SKY.mjd =
  SETTINGS.date` and derives `dst` at 13:00; the time-of-day slider re-derives `dst` and never
  touches the date.
- **UI.** `#date-val` (styled with `#tod-val`, plus `white-space:nowrap`) sits on **its own line
  under the slider**, a row `#date-row` labelled "Date" in TIME. Measured with Playwright at 320x568,
  panel open: inside the Time-of-day row it pushed the clock to x = 289-335 px, past the row's right
  edge at 285 px, so it moved; on its own row the span is 63 px wide (x 222-285), row scrollWidth =
  clientWidth = 250, page width 320 (no horizontal scroll). `syncSettingsUI()` and the open-menu
  refresh in `frame()` fill it.
- **Hook.** `window.__DS` gains `OBS, SEASON_DATES, mjdOf, civilOf, weekday, dateText, utcOffset,
  solar, setDate`; the `SKY` export carries `mjd, dst, decl, eot, solarNoon`.

Restated row (one row, in place): "a summer day: the sun sets about 7:45 pm and rises about 6:15 am"
-> "May 5 in Raleigh: sunrise and sunset within 10 min of the suite's own computation (about 6:18 am
and 8:05 pm EDT)". The page's `SKY.sun` scanned a minute at a time (interpolated) gives **06:18:09
and 20:04:52 EDT**; the suite's own sun (Astronomical Almanac low-precision sun, Meeus 12.4 GMST,
Raleigh's longitude: `aaSun`, `gmst`, `ownSun`, `ownRiseSet` at the top of the suite) gives **06:18:10
and 20:04:51**. Page solar noon 13:11:15, decl +16.387 deg at local noon; the suite's own 13:11:15,
+16.385. The old row's `dusk` / `dawn` fields are gone. Rows 123/124 (noon high, midnight below) hold
unchanged on May 5: the clock rows' stepping now crosses midnight (to May 6-7), so the block calls
`setDate(MAY5)` before them.

Suite: **78 -> 86** (8 new rows, the restated row still one). `gates.sh
games/driving-simulator/index.html`: SMOKE, GAMES-SYNC, NEGTEST-SCAN GREEN, `DRIVING SIMULATOR
DRIVE: 86 passed, 0 failed`, `GATES: GREEN`.

Rows that can fail (scratch check, not the step-4 list): eight breaks on copies, run against a copy of
the suite cut after the calendar rows, each turned at least one new row red: the date not stepping
(4 rows), the wrap to the middle date (the wrap row), EST all year (6 rows), no fall-back (the 02:00
row), the date not saved at midnight (the saved-date row), the sun kept at 15 deg (the sun-from-the-
date row), the declination's sign flipped (3 rows, incl. noon and sunrise), the slider stepping the
date (the TIME row).

Assumed (step 4 moves these into the context file's Assumed table):
- assumed: `SEASON_DATES` rows are arrays `[first, last, middle]`.
- assumed: on the spring-forward day the hour that does not exist (02:00-02:59) reads as EDT in
  `utcOffset()`; on the fall-back day the repeated hour reads as EDT (the plan's rule).
- assumed: at a date step `dst` is re-derived for 00:00 of the new date, and the 02:00 check then runs
  on that date (one rule for the midnight and the wrap).
- assumed: `nextDate()` sends a date before the season's first day to the first day too (reachable
  only through the hook).
- assumed: choosing a different open season in the dropdown moves the date to that season's middle
  date (unreachable while only spring is open; DS-3 may revisit).
- assumed: `setDate()` saves, as a date step does.
- assumed: the Date row is its own line at every width, not only on narrow screens.
- assumed: row 1 accepts an hour of 13.0-13.5, not exactly 13: the live loop runs a few frames before
  the suite pauses it (13.04-13.07 observed).
- assumed: row 6 checks the spring-forward too (Mar 14, 2027, with `SETTINGS.season = 'winter'`) and
  restores spring and May 5; row 7 also checks the sun's direction at 9 am and 5 pm within 0.1 deg of
  the suite's own (this is what sees a `celestial()` that ignores `SKY.decl`).

For steps 2-4:
- `julianDate()` is the one JD; step 3's `SKY.lst` should use it. The suite's `gmst(jd)`, `jdOf()` and
  `MJD()` are already at its top for the LST rows.
- Restore state with `setDate(MAY5)` (and `SETTINGS.season = 'spring'`) after any row that moves the
  date; `setDate` writes localStorage, and a later page in the same context reads it.
- The calendar rows leave the clock at 06:15 on May 5, cycle 144, spring, as the clock block always did.
- A full `negtest-copies.py` run of the eight scratch breaks at `--jobs 4` did not finish inside a
  10-minute call (no verdict lines were printed before it was stopped); a solo suite run takes about
  2.4 min. Hypothesis, not traced: four SwiftShader suites on four cores slow each other well past 4x.
  Step 4 should budget for it (fewer jobs, or `--only` in batches).

### Step 2 - zmh-sky in the page; the sun, the moon and the planets from it

- Start from step 1 (the Resume section, item 3). Then read the kit's skill and README.
- **Splice** the block, check that it is idempotent, and add the licence file and the THE ROAD
  paragraph (Design, "zmh-sky in the page").
- **The bodies** from `skyAt()`, the star matrix into `SKY.starM`, `SKY.planets` and
  `SKY.moonPhase`. Delete `solar()` and `celestial()`, and update the hook (Design, "The bodies from
  the kit"). The stars still spin until step 3.
- **Step 1's rows must stay green unchanged.** They test the sun against the suite's own, not the
  page's formula. The noon-high / midnight-below rows and the "midnight much darker than noon" pixel
  row must hold with the real moon too. If any row moves, trace why.
- New rows (4). The fixed moment is **May 5, 2026 at 22:00 EDT** (`SKY.hour = 22; setDate(MAY5)`),
  which is 2026-05-06 02:00 UT, the kit's golden instant. Restore 06:15 on May 5 afterwards, as the
  calendar rows do.
  1. **The sky block.**
     - The header names zmh-sky and carries the attribution line.
     - `SKY_DATA.stars` holds 1,500-1,750 rows (1,627 measured), every `mag <= 5.0`. Every RA is in
       [0, 360): d3's -180..180 convention must never reach the page. Every Dec is in [-90, 90].
     - The nine named stars are present by HIP: Polaris 11767, Regulus 49669, Arcturus 69673,
       Spica 65474, Dubhe 54061, Vega 91262, Betelgeuse 27989, Sirius 32349, Rigel 24436.
     - Each sits within 0.01 deg of the suite's own J2000 position: SIMBAD values typed in
       sexagesimal, such as Sirius 06h45m08.92s -16 42' 58.0".
     - The THE ROAD notes carry the attribution line and a link to `LICENSE-d3-celestial.txt`, which
       exists beside the page.
  2. **One sun, the kit's.**
     - `SKY.sun` is `ZMH_SKY.skyAt(...).sun.enu` exactly (angle under 1e-6 deg).
     - Its alt/az is within 0.05 deg of astronomy-engine's -20.882 / 310.518 (record
       `2026-05-06T02Z/raleigh/sun`).
  3. **The moon in its real place.**
     - `SKY.moon`'s alt/az is within 0.3 deg of astronomy-engine's topocentric -23.146 / 109.087
       (record `2026-05-06T02Z/raleigh/moon`).
     - The anchors: the suite computes the Meeus 49.1 **mean** phase instants for May 2026 itself
       (full near May 1 and May 31, new near May 16; all three are spring dates). At each, the
       angle between `SKY.sun` and `SKY.moon` is within 15 deg of 180 at full and of 0 at new.
       Mean phases are up to about 14 h off the true ones, the moon's latitude reaches 5 deg, and
       parallax 1 deg; 15 deg covers all three. The placeholder moon fails the new-moon anchor.
  4. **The planets.**
     - `SKY.planets` holds exactly Mercury, Venus, Mars, Jupiter and Saturn, all `valid`.
     - Venus and Jupiter are each within 0.3 deg of the suite's own alt/az. The suite turns
       astronomy-engine's geocentric RA/Dec of date (Venus 72.973 / +23.639, Jupiter 111.326 /
       +22.389; records `2026-05-06T02Z/geo/ven` and `.../geo/jup`) through its own GMST and
       Raleigh's position. The Table 1 elements are good to about 0.1 deg.
     - Venus's magnitude is below -3.5 and Jupiter's below -1.5.
- Suite 86 -> 90.

#### Step 2 results

Done 2026-11-02 (oversee run, worktree branch `worktree-oversee+dsstars`, from d47bc1d). zmhstudio at 7b9c40e.
- **Splice:** `ZMH-SKY=games/driving-simulator/index.html bytes=98547 stars=1627`. A second splice left
  the page byte-identical (same sha256). The page is now 296,690 B.
- **Licence and notes:** `games/driving-simulator/LICENSE-d3-celestial.txt` copied from the kit; the new
  THE ROAD paragraph is `<p id="sky-notes">`, with the attribution line verbatim and the link. The
  licence holder's name is only in that paragraph, the licence file and the generated block.
- **Bodies:** `OBS_SKY`; `updateSky()` calls `skyAt()` once and sets `sun`, `decl`, `eot`
  (`equationOfTimeMin`), `solarNoon` (step 1's formula), the topocentric `moon`, `moonPhase`, `lst`,
  `starM` (`Float32Array(9)`, row-major) and `planets` (`{id, mag, valid, enu, altDeg, azDeg}`, the
  naked-eye five). `solar()` and `celestial()` are deleted; the hook drops `solar` and adds `OBS_SKY`,
  `ZMH_SKY`, `SKY_DATA`. The hash stars and `uStarRot` are untouched (step 3).
- **Suite:** 90 passed (section "3c", 4 rows). No step-1 row was restated and none moved.
- The kit at 22:00 EDT May 5: sun -20.876 / 310.515; moon -23.134 / 109.092; Venus mag -3.89 at
  4.34 / 296.16; Jupiter -2.00 at 33.49 / 274.94. Mean-phase sun-moon angles: 175.1 (full, May 1),
  5.5 (new, May 16), 174.2 (full, May 31).
- Scratch breaks on copies: the moon as the anti-sun turned the moon row red; the longitude's sign
  flipped turned the sun, moon and planet rows (and step 1's sun rows) red.
- **Choices beyond the plan** (step 4 adds them to the assumed table):
  - The sky-block row never types the licence holder's name: it captures it from the block header and
    checks it matches the licence file and `#sky-notes`.
  - The licence file is checked beside the checkout's page, not a `DS_PAGE` copy (copies live in scratch).
  - CSS `#settings a{color:var(--blue);overflow-wrap:anywhere}`, so the link reads and wraps at 320 px.
  - The moon row also checks `SKY.moonPhase.illuminatedFraction` against `2026-05-06T02Z/geo/moon`
    within 0.01 (not asked for).
- **Gates:** the implementer's three gate runs were red on one sound row each (which one varied:
  engine/radio loudness, the engine slider, the four stations within 25%) while it ran broken copies
  in parallel at load average 3-4. Its control, the step-1 page under the step-1 suite, failed the
  stations row the same way. Re-run by the overseer on a quiet machine: `GATES: GREEN`, 90 passed.
  That machine load causes it is a hypothesis, not traced; the sound rows measure loudness over
  wall-clock time.

### Step 3 - the stars, the planets and the Milky Way in the sky

- The star pass, the planets' vertices, `ridgeY()` and the Milky Way, as in "Design". Then delete
  the hash stars and `uStarRot`.
- New rows (13). Unless a row says otherwise, the moment is May 5 at 22:00 EDT and the observer is
  Raleigh.
  1. **LST** equals the suite's own Meeus 12.4 within 0.01 deg at six times. At the local midnight
     that starts May 5 it is 204.4 deg (within 0.05). Across a midnight date step it moves only by
     the step's own sidereal advance.
  2. **The pole of date.**
     - The suite precesses the celestial pole of date back to J2000 with its own Meeus 21
       precession. `SKY.starM` applied to that vector is due north at altitude 35.78 deg (within
       0.01).
     - `SKY.starM` applied to the J2000 pole (0, 0, 1) is 0.10-0.20 deg from it, which shows the
       matrix precesses.
  3. **Polaris:** at each of 24 hours its altitude is 35.1-36.5 deg and its azimuth within 0.8 deg
     of north, and both are within 0.05 deg of the suite's own precessed alt/az.
  4. **Each of the nine stars circles the pole of date:** its angle to the pole stays the same within
     0.05 deg over 24 game hours.
  5. Dubhe stays above the horizon all day. Arcturus is below it at some hour and above it at
     another.
  6. **The 22:00 sky:** all eight stars of the Corrections table are within 0.05 deg of
     astronomy-engine's values (the record ids are the source) and of the suite's own precessed
     alt/az. One row; on failure it prints each star's deltas.
  7. **Stars move west:** over one game hour Arcturus (east) climbs and Betelgeuse (west) sinks.
  8. **One POINTS draw per pass** with `STARS.n + 5` vertices, recorded by wrapping `gl.drawArrays`
     for one frame: one in the main pass, and one more in the mirror pass in the cockpit view.
  9. **The planets are drawn where they are.**
     - The five planet vertices, turned by `SKY.starM`, equal `SKY.planets[i].enu` within 1e-4.
     - Pixel check: pick a view that puts Jupiter (33.5 deg up in the west at 22:00) in frame, such
       as the orbit view pitched up, and say which. The pixel where the suite's own Jupiter
       direction projects (from step 2's RA/Dec, through the camera's `vp`) is within 3 px of a
       local maximum clearly brighter than its neighbours. With `STARS.on = false` there is none.
       Venus is only 4.3 deg up at 22:00, so the hills may hide it there.
  10. **Star pixels at midnight.** At four headings (chase view, `PLAYER.yaw` 0, 90, 180 and 270 deg,
      `CAM.chase = null`, a few frames), the sky above the ridge holds isolated pixels clearly
      brighter than their neighbours.
  11. **Pixels at noon:** none, and the Milky Way term adds nothing (the noon sky's pixels are
      byte-identical with `MW.on` true and false).
  12. With `STARS.on = false` at midnight, the regions in row 10 hold no isolated bright pixels. This
      proves `skyCol()` has no stars of its own left. The Milky Way is smooth at that scale, so it
      does not count.
  13. **The Milky Way where the suite says it is.**
      - Pick an hour on the night of May 5-6 when the suite's own galactic plane is well up in the
        east, about 02:00-03:00 EDT. The suite uses its own galactic pole (RA 192.85948, Dec
        27.12825, J2000, IAU) and its own precession.
      - The mean luminance of a patch on the band, above the ridge, beats a patch 40 deg off it by a
        clear margin with `MW.on` true.
      - With `MW.on` false the two are equal within noise.
- Also rerun the existing day/night pixel rows. The sky's day pixels must not move with `ridgeY()`
  or the Milky Way branch (the refactor is exact).
- Suite 90 -> 103.

### Step 4 - negative tests, frame cost, docs

- **Write `.claude/tests/negtests/driving-simulator.json`** in `negtest-batch.py`'s format: `name`,
  `file`, `old` (found exactly once), and `new` with the `@negtest` marker outside any string
  literal.
- **The breaks.** At least these, each meant for its own row. Each says which row should see it.
  - **Step 1's:**
    - the date not stepping at midnight;
    - the wrap to the middle date instead of the first;
    - EST all year;
    - no fall-back;
    - the date not saved;
    - `julianDate()` ignoring `SKY.dst` (an hour off).
  - **The observer:**
    - latitude 90, the old bug's sky (`OBS_SKY.latDeg = 90`);
    - the longitude's sign flipped (`lonEastDeg: -OBS.lon`).
  - **The kit wiring:**
    - the star matrix uploaded without transpose;
    - the stars through `s.horizonMatrix` (of date) instead of `s.starMatrix`, so precession is
      skipped. The 0.05-deg table row must see it;
    - the moon left on the placeholder rule;
    - the planet vertices given `p.enu` as their J2000 direction;
    - the planets frozen at boot.
  - **The pass:**
    - the star pass not drawn;
    - stars not faded by day;
    - a hash star left in `skyCol()`;
    - the ridge test removed (say which row sees it, or record why none can).
  - **The Milky Way:**
    - in world coordinates (`zmhMilkyWay(d)` without `transpose(uStarM)`);
    - not faded by day.
- **Run it whole** with `negtest-copies.py` (Tools above), at `--jobs 2`, in `--only` batches of
  about 3, each under about 9 minutes.
  - Why: step 1 saw `--jobs 4` print nothing in 10 minutes. The cause is a hypothesis, not traced.
  - Every MISSED gets a row that sees it, or a written argument that it is equivalent or dead code
    (the tests README's rules).
  - Record the result in `.claude/driving-simulator.md` § Testing.
- **Frame cost.**
  - Run `node .claude/scripts/frame-budget.cjs games/driving-simulator/index.html swiftshader=1` at
    night three ways through the hook: stars and Milky Way on, stars only, and both off. The
    script's header has the `eval`/`evalFile` options.
  - With `swiftshader=1` the number says how the renderer behaves with no GPU, not a phone's frame
    rate; say so.
  - Record what the pass and the band add on the perf block: calls +1 (+2 with the mirror),
    triangles unchanged, and the 3D CPU time in each run.
  - Escalate only on a gross cost.
- **Docs,** every name and count read from the code:
  - `.claude/driving-simulator.md`:
    - DS-1 marked built; its spec was revised 2026-11-02, so confirm it against the code;
    - the assumed table, from step 1's Results and this revision: the observer and `heightM`, the
      season dates, the start date, the DST handling, the magnitude cut (the splice's `--mag 5`),
      `STAR_GAIN`, the planet colours and the 2.5 clamp, `MW_GAIN`, and the Date row's place;
    - Architecture: the calendar; the `ZMH-SKY` block and its regeneration command; one sun from
      `skyAt()`; the star matrix convention (row-major, transpose on upload, det -1, J2000 to ENU
      with precession); the star pass and its planet vertices; the Milky Way in `FS_SKY` only;
    - Testing: the new rows, the oracles (with the golden record ids) and the break list's result;
    - the header count.
  - `.claude/tests/README.md`: the suite's row, its count, and the break-list line.
  - `games/CLAUDE.md`: the DRIVING SIMULATOR entry, its count, and the `ZMH-SKY` block named beside
    the KITS block as generated.
  - `CLAUDE.md`: the Driving Simulator row gains the calendar, the zmh-sky block ("spliced by the
    kit's CLI, never hand-edited"), one sun from `skyAt()` and the star matrix convention.

### Step 5 - ship

- Run `.claude/scripts/stamp-badge.sh games/driving-simulator/index.html`, then read the stamp back
  out of the file. `check-inline-js` and `gates.sh` must be GREEN after the stamp.
- Move this plan and its follow-up to `.claude/plans/DONE/`, with Status `IMPLEMENTED <date>` (the
  branch range), and commit on the arc's branch.
- **Land the branch:**
  - Run `git fetch origin main`, then `.claude/scripts/land-on-main.sh <branch> <message-file> --dry-run`,
    then the same without `--dry-run`. The message is
    `feat(driving-simulator): the real sky over Raleigh from zmh-sky, and a calendar (DS-1)`, with
    the session's trailers.
  - If it reports `behind`, merge `origin/main` into the branch, re-run the gates, and check the
    other session's files survived (CLAUDE.md § Git workflow).
- Push the branch to the branch your session may push to.
- `TODO.md`: move the DS-1 entry to `DONE.md` with the badge string. DS-2 to DS-4 stay in `TODO.md`
  § Now, ready to re-sweep (see Follow-ups).
- **Verify** the "pages build and deployment" run for the landed SHA: `mcp__github__actions_list`,
  `resource_id: '266280069'`, `perPage: 1`. Match `head_sha` and read the jobs. Budget two checks,
  then report.
- **Report to the CD:**
  - the badge string;
  - the star count and the attribution;
  - the playtest list above;
  - the assumed rows most worth a look: the start date, the DST jump, `STAR_GAIN`, `MW_GAIN`, the
    magnitude cut;
  - the re-sweep command.

## Gotchas / bindings

- **Start from step 1's branch,** not `main` (the Resume section, item 3). A worktree cut from `main`
  has none of the calendar.
- **The suite's page path** reads `DS_PAGE`, or the checkout's own page (step 1 fixed it). A green
  suite tests the checkout it runs in.
- **The kit's conventions** (the skill's table), all of which bite:
  - matrices are flat **row-major**, so upload them with transpose = true;
  - `[east, up, north]` is the page's x, y, z, so there is no remap;
  - the star matrix has determinant -1, which is expected, not a bug;
  - stars are **J2000** and go through `starMatrix`; the sun, the moon and the planets are **of
    date** and come out as `enu`;
  - the moon to draw is the **topocentric** one in `skyAt()`;
  - `lonEastDeg` is east-positive;
  - everything takes `jdUT`, and the kit treats TT as UT.
- **The `ZMH-SKY` block is generated.** Re-splice it, never edit it. The zmhstudio path varies by
  session, so find it, don't remember it.
- **One sun.** After step 2 nothing in the page computes the sun but `skyAt()`.
- **`SKY.day` is taken:** it is the daylight factor that half the renderer reads. The date is
  `SKY.mjd`.
- **No `Date` in the sky code.** The device's time zone is not Raleigh's. Use MJD arithmetic and
  `julianDate()`.
- **The ridge is not geometry.** A star pass with the depth test off draws over the hills unless its
  fragment shader runs the same `ridgeY()`. The world drawn afterwards covers it correctly.
- **The mirror calls `renderScene()` too** (index.html:2347, near 0.5, 320x96). The star pass runs
  there with `uPx = 1`. The mirror's colour target is already tonemapped
  (`.claude/notes/20261101-a-realistic-webgl2-scene-in-one-file.md`), and so is the star pass's
  output: add it as it is, with no second tonemap.
- **Blend state leaks.** The glow and blob passes set their own blend state later in
  `renderScene()`. Turn blend off after the star pass and leave the depth state as the sky leaves
  it, or the world draws blended.
- **`skyCol()` is also the world shader's fog and paint reflection** (`GLSL_COMMON` is in
  `FS_WORLD`).
  - Deleting the hash stars removes stars from reflections. That is intended; say so in the docs.
  - The Milky Way goes in `FS_SKY` only, for the same reason.
- **DST is state.** On the fall-back day, 01:30 is both EDT and EST. Step 1 keeps `SKY.dst` as
  state; leave it so.
- **Settings coercion** forces the season to spring at load. Rows that set `SETTINGS.season` through
  the hook must restore it, and restore the date with `setDate(MAY5)`.
- **SwiftShader** renders slowly, and `gl_PointSize` above 1 works there. Point sizes are in
  framebuffer pixels: multiply by the render scale, or phones (scale up to 1.75) get pinpricks.
- **`negtest-copies.py`:** run the suite once on the unbroken page first, and never edit the page
  while a list runs. A row that "catches" unrelated breaks is flaky until traced.
- **Discovery over instruction** (`games/CLAUDE.md`): no new text on the play surface. The date and
  the attribution live in the settings only.
- **Commits:** explicit pathspecs (never `git add -A`), the session's Co-Authored-By /
  Claude-Session trailers, and no model id anywhere in the repo.

## Validation

Per step, as in the guidance table. End to end:
- `gates.sh games/driving-simulator/index.html` GREEN on the stamped page, with the suite at its new
  count;
- the splice idempotent;
- the break list run whole, every miss explained;
- the frame cost recorded;
- the Pages run for the landed SHA concluded `success`.

The CD's playtest (above) is what no suite can do: whether the sky looks like Raleigh's on a phone.

## Follow-ups

- **DS-2, DS-3 and DS-4** (`TODO.md` § Now): re-sweep with `/zmh-producer:backlog-plan-gen driving-sim`
  right after this lands.
  - DS-3 and DS-4 cite this plan's `SEASON_DATES`, `SKY.mjd`, `utcOffset`, `julianDate()`,
    `OBS_SKY`, `SKY.starM` and the `ZMH-SKY` block.
  - DS-4 is now small: refraction (`ZMH_SKY.refractionDeg`), real disc sizes, the phase disc (the
    kit's `MOON_DISC_GLSL`, a lit sphere), moonlight (`moonIlluminanceLux`), earthshine, the moon by
    day, and a bright moon dimming this plan's stars.
- **Constellation figures:** the kit has them (`constellationSegments`, 20 KB more in the block). An
  opt-in settings toggle would be a new item for the CD, not this plan.
- **Sky brightness and twilight** are not in the kit's v1, so a light-polluted Raleigh sky is still
  the page's own colours.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dsstars.real-sky-and-calendar.md
```

(Or one step per session: "Run the next open step of `.claude/plans/dsstars.real-sky-and-calendar.md`".)
