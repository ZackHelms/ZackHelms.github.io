# dsstars - Driving Simulator: the real sky over Raleigh, NC, and a calendar that runs a day per game day (DS-1)

**Status:** PARTIALLY IMPLEMENTED 2026-11-01 - step 1 of 5 done, on branch `claude/brave-sagan-odwmrd`
(not on `main`). Stopped at step 2: the agent proxy still refuses `cdsarc.cds.unistra.fr` (CONNECT
403 at 19:05 and 20:17 UTC, in a container started after the CD's answer). Details and what to do:
`dsstars.real-sky-and-calendar.follow-up.md`.
**Requested:** 2026-11-01, the CD (third message of the day, verbatim):

> Oh yeah, fix the star field rotation. It looks like i am at the earths rotational north pole and
> star field spins around like a spinning top. Should look like star field looks to me in the sky
> from perspective of raleigh north Carolina in the spring. Add this to driving sim backlog.

Asked the same day whether the in-game date should advance a day per game day or stay one fixed
date per season, the CD chose **"A day per game day"**. Asked during this plan's drafting how the
run should get the star catalogue (this container's proxy refuses the hosts that serve it), the CD
chose **"Allow the host"**: they add `cdsarc.cds.unistra.fr` to the environment's allowed domains.

**Scope:** `games/driving-simulator/index.html` (settings, the sun and sky section, the GLSL sky,
`renderScene()`, the settings UI, the clock, the test hook), a new
`games/driving-simulator/build-stars.mjs` and the catalogue source it reads, the suite
`.claude/tests/drive-driving-simulator.cjs`, a new break list
`.claude/tests/negtests/driving-simulator.json`, and the docs `.claude/driving-simulator.md`,
`.claude/tests/README.md`, `games/CLAUDE.md`, `CLAUDE.md`. Source TODO entry: `TODO.md` § Now,
the first `[driving-sim]` item. Full spec: `.claude/driving-simulator.md` § Backlog, DS-1 (read it
whole; this plan settles what it leaves open, and the sweep that drafted it corrected some of its numbers).

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

At night the stars over the road are the real stars, about 1,600 of them to magnitude 5 from the
Yale Bright Star Catalogue. They turn about the celestial pole, which stands due north 35.78 deg up,
and the angle comes from true sidereal time. The game keeps a date. It starts on Tue May 5, 2026 at
1 pm, steps a day each time the clock passes midnight, and wraps from Jun 20 back to Mar 20. The sun
rises and sets for that date in Raleigh. The date shows in the settings, is saved between visits,
and follows the US daylight-saving rule. The hash-grid stars and `uStarRot` are gone.

## Context

The cause is traced (`.claude/driving-simulator.md` § Backlog, DS-1). `skyCol()` turns its star
lookup about the world's vertical axis (`index.html:1208-1217`), and `setFrameUniforms()` sets
`uStarRot = SKY.hour / 24 * TAU` (`index.html:2097`). A sky turning about the zenith is the sky at
the North Pole. The stars themselves are a hash over (azimuth, elevation) cells, so they have no
constellations.

DS-3 (the other seasons) and DS-4 (the sun and moon) both build on this plan's calendar, observer
and sidereal rotation. Its contracts (the names under "Design") are what those plans will cite. DS-2
(traffic sound) shares the page, the suite and the context file, so plan-gen deferred all three.
Re-sweep with `/zmh-producer:backlog-plan-gen driving-sim` once this lands.

## Corrections to the spec, found while drafting (2026-11-01, recomputed twice)

Recomputed here with two independent methods: NOAA's Meeus-based solar calculator, and the
Astronomical Almanac's low-precision sun with Meeus 12.4 sidereal time. The two agree within 0.011 deg.

- **May 5, 2026 (local noon):** declination **+16.4 deg** (the spec said +16.0); equation of time
  +3.3 min; solar noon 13:11; sunrise 06:18-06:19; sunset **20:05 EDT** (the spec said 20:03). The
  noon altitude is 70.6 deg. The sweep that drafted this plan corrected the spec and the
  `TODO.md` entry. The suite never copies these numbers anyway; it computes its own.
- **Polaris does not stay inside 35.0-35.6 deg.** At J2000 it is 0.74 deg from the pole, so over a
  day its altitude runs 35.04-36.52 deg and its azimuth 359.09-0.91 deg. The row below uses
  altitude 35.0-36.6 and azimuth within 1.0 deg of north, and checks each hour against the suite's
  own alt/az within 0.5 deg. At 22:00 it is 35.2 / 359.4, as the spec says.
- The equinox noon altitude is 90 - 35.78 + 0 = **54.2** deg, not 53.7. DS-4's text, DS-4's sun
  table (recomputed with +16.4 deg) and DS-3's declinations were also off by 0.3-0.4 deg. The same
  sweep corrected all of them in `.claude/driving-simulator.md`.
- Confirmed unchanged: LST at the local midnight that starts May 5 is 204.4 deg; at 22:00 EDT it is
  11.69 h. All seven stars in the 22:00 table are within 0.5 deg (Regulus 58.3/227.2, Arcturus
  52.3/105.6, Spica 37.0/147.4, Dubhe 63.4/350.1, Vega 12.4/50.8, Betelgeuse 7.1/274.0, Sirius
  2.6/247.2). Dec +54.2 deg is the circumpolar limit.

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

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

**The sun from the date** (replaces `DECL` and `SOLAR_NOON`, `index.html:1923-1934`).
- `updateSky()` computes `{ decl, eot }` by the NOAA solar calculator (kernel below) for the current
  JD.
- It sets `SKY.decl` (degrees) and `SKY.solarNoon = (720 - 4 * OBS.lon - eot) / 60 + off` (local
  clock hours).
- `celestial(hour, decl)` keeps its body with `SKY.solarNoon` and `OBS.lat` in place of the
  constants, and `SKY.sun = celestial(H, SKY.decl)`.
- **The moon keeps today's rule** on the new numbers, `celestial(H + 12.8, -SKY.decl * 0.6)`. DS-4
  replaces it; do not improve it here.
- No refraction here either (DS-4 adds it). Sunrise and sunset are when the geometric centre is at
  -0.833 deg.

```js
// NOAA solar calculator (Meeus-based). jd: Julian date (UT). Returns degrees and minutes.
// Verified while drafting: 0.011 deg from an independent low-precision sun over 5 dates x 48 times.
function solar(jd) {
  const T = (jd - 2451545) / 36525, R = Math.PI / 180;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
  const decl = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R;
  const y = Math.tan(eps / 2 * R) ** 2, l = L0 * R, m = M * R;
  const eot = 4 / R * (y * Math.sin(2 * l) - 2 * e * Math.sin(m) + 4 * e * y * Math.sin(m) * Math.cos(2 * l) - 0.5 * y * y * Math.sin(4 * l) - 1.25 * e * e * Math.sin(2 * m));
  return { decl, eot };
}
```

**Sidereal time** (Meeus 12.4). `gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T*T
- T*T*T / 38710000`, mod 360. Then `SKY.lst = gmst + OBS.lon`, in degrees, mod 360, set in
`updateSky()`. Because the date steps at midnight, LST runs on smoothly through midnight; it jumps
only at the season's wrap and (by an hour's worth) nowhere else.

**The sky matrix** (catalogue to sky; verified while drafting against the spherical alt/az formula
to 0.01 deg, pole at (0, sin lat, cos lat)).
- Equatorial unit vectors take x to the equinox and z to the north celestial pole; the sky takes x
  east, y up, z north (`celestial()`'s axes).
- With `c = cos LST`, `s = sin LST`, `cp = cos lat`, `sp = sin lat`, the rows are:
  - east = `-s*x + c*y`
  - up = `cp*c*x + cp*s*y + sp*z`
  - north = `-sp*c*x - sp*s*y + cp*z`
- Column-major for `uniformMatrix3fv(loc, false, m)`:
  `[-s, cp*c, -sp*c,  c, cp*s, -sp*s,  0, sp, cp]`.
- Keep it in `SKY.starM` (a `Float32Array(9)`), set in `updateSky()`.
- `starDir(hr)` in JS multiplies the same nine numbers. The suite tests what the GPU draws, so there
  is no second formula in the page.

**The catalogue: BSC5, VizieR V/50** (`https://cdsarc.cds.unistra.fr/ftp/V/50/`: `ReadMe` and
`catalog.gz`).
- `build-stars.mjs` (dependency-free, node's `fs` and `zlib` only, the `build-kits.mjs` pattern)
  reads the catalogue and keeps records with a J2000 position and `Vmag <= 5.0`. It writes the block
  between `/*STARS:BEGIN*/` and `/*STARS:END*/`, placed right after `/*KITS:END*/`
  (`index.html:113`).
- **Take the byte offsets from the ReadMe's byte-by-byte table**, never from memory. They are
  expected to be: HR 1-4, RA J2000 76-83 (h, m, s), Dec J2000 84-90 (sign, d, m, s), Vmag 103-107,
  B-V 110-114. Some records have blank positions; skip those.
- Block format:
  - a header line naming the script, the source (BSC5, Hoffleit and Warren 1991, VizieR V/50), the
    magnitude cut and the count;
  - one flat JSON integer array `const STARS_RAW = [...]`, five per star: HR, RA x 1000 (degrees),
    Dec x 1000 (degrees), V x 100, and B-V x 100 (a missing B-V packed as 0, which reads as white).
- About 1,600 stars and roughly 40 KB. The script prints the count, and the header records it.
- Commit the downloaded `catalog.gz` and `ReadMe` under `games/driving-simulator/data/bsc5/` (about
  120 KB together), so the block can be rebuilt with no network.
- Precession from J2000 to 2026 (about 0.36 deg) is ignored. Say so in the header and in a comment
  at `starDir()`.
- **Terms:** read the ReadMe and CDS's terms of use (`https://cds.unistra.fr/`, its conditions of
  use) in the run. Record the source and the acknowledgement they ask for in three places: the block
  header, the settings' THE ROAD notes (a line such as "The stars are the Yale Bright Star
  Catalogue's, from CDS's VizieR service") and `.claude/driving-simulator.md`.
  - If the terms forbid redistribution in a public repo, stop and report to the CD (escalation below).
  - If the terms cannot be read in the container, record "terms not read; assumed: free use with
    acknowledgement" as an assumed row.

**The star pass** (one draw per `renderScene()`, so the mirror gets it too).
- Program `PRG.stars`, compiled in `initGL()` (`index.html:1497-1502`); its fragment shader
  includes `${GLSL_COMMON}`. The VAO is built once from `STARS_RAW`: per vertex, the equatorial unit
  vector (3 floats), an RGB colour and a size (4 floats), all precomputed on the CPU.
- Drawn right after the sky (`index.html:2182-2187`), still with the depth test off and
  `depthMask(false)`:
  - additive blend `ONE, ONE`, then blend off;
  - `gl.drawArrays(gl.POINTS, 0, STARS.n)`;
  - skipped when `SKY.night <= 0` or `STARS.on === false`.
- Vertex shader: `gl_Position = uVP * vec4(uStarM * aE * 1000.0, 1.0)`, using the same `vp` as the
  world (the far plane is 2400). The star's sky direction is passed to the fragment shader.
- **The ridge must hide stars.** The distant hills are drawn inside the sky shader
  (`index.html:1397-1403`), not as geometry, so the world's depth test cannot cover a star behind
  them. Move the ridge height into `float ridgeY(float az, float mtn)` in `GLSL_COMMON`. `FS_SKY`
  calls `ridgeY(az, uMtn)`, and the star fragment shader discards below `ridgeY(atan(d.z, d.x), 1.0)`.
  The sky's pixels must stay byte-identical, which a day-pixel row confirms.
- **Brightness and size.** `I = 10^(-0.4 * (V - 1.0))`, clamped to 0.03-1.6. Size in pixels is
  `clamp(1.0 + (4.5 - V) * 0.45, 1.0, 3.2) * uPx`. `uPx` is the main pass's render scale (`sc` in
  `resize()`, `index.html:2830`; keep it in a variable), and 1 in the mirror pass.
- **Colour from B-V.** Blend linearly between five stops, then mix halfway to white (the eye sees
  most stars as white). Stops: -0.3 (0.62, 0.72, 1.00), 0.0 (0.80, 0.85, 1.00), 0.6 (1.00, 0.96,
  0.90), 1.0 (1.00, 0.85, 0.70), 1.6 (1.00, 0.70, 0.45).
- **Fade.**
  - Multiply by `SKY.night`.
  - Extinction of 0.2 mag per airmass, with Kasten-Young airmass
    `X = 1 / (sin(alt) + 0.50572 * (alt_deg + 6.07995)^-1.6364)`. Clamp alt at 0 in the formula; the
    discard handles below.
  - Fade in over the first 2 deg of altitude.
  - The fragment draws a round point (`gl_PointCoord`, a soft edge) at `I * fade * uExposure` in
    linear light. The pass draws after `tonemap()`, so keep values small: a magnitude-1 star should
    read clearly white, and a magnitude-5 star should be barely visible on a dark phone.
- **Delete** the hash-star block (`index.html:1208-1217`), `uStarRot` (`index.html:1188`) and its
  setter (`index.html:2097`). Nothing else reads them; confirm with a grep.
- `PERF`'s draw wrapper (`index.html:1176-1184`) already counts the call. `triCount` returns 0 for
  POINTS, so triangles do not move.

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

**Test hook** (`window.__DS`, `index.html:2929`): add `OBS`, `SEASON_DATES`, `mjdOf`, `civilOf`,
`dateText`, `utcOffset`, `solar`, `STARS` (`{ n, hr, on }` plus the raw array) and `starDir`. The
existing `SKY` export already carries `mjd`, `dst`, `decl`, `solarNoon`, `lst` and `starM`.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans). One task per arc step; each is one session's work and one commit on `ds-stars`.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Suite reads `DS_PAGE`; the calendar, DST, the sun from the date, the date in TIME and saved; restate the sun row; calendar rows | cross-system | opus | high | clock, sky, settings and UI at once; DST state that must not loop; restating a row honestly |
| 2 | The catalogue: download V/50, read its terms, `build-stars.mjs`, the generated block; catalogue rows | content-pipeline | sonnet | high | a parser over a documented fixed-width format with exact offsets from the ReadMe; one external dependency that may block (escalation) |
| 3 | Sidereal time, the sky matrix, the star pass, `ridgeY()`, delete the hash stars; star and pixel rows | rendering | opus | high | GL state in a shared render path (mirror included), shader edits that must leave the sky's pixels unchanged, pixel rows that must discriminate |
| 4 | Break list and negative tests; frame cost; docs (spec numbers confirmed) | eval+docs | opus | high | each break must land on its own row; any MISSED needs a row written or an equivalence argued; docs read from the code |
| 5 | Ship: badge, gates, land on `main`, Pages, report | ship | sonnet | medium | the documented procedure, exact commands below |

- **Ordering / dependencies:** strictly 1 -> 2 -> 3 -> 4 -> 5 (all touch `index.html` and the
  suite). Parallel-safe: none. Step 3 needs step 2's block. **If step 2 is blocked** (the
  escalation below), step 1's commit stands on the branch and the run stops; nothing may stand in
  for the catalogue.
- **Files owned per task:** 1: the settings block, the sun-and-sky section, the clock, the settings
  UI and hook in `index.html`, plus the suite; 2: `build-stars.mjs`, `data/bsc5/`, the STARS block,
  the THE ROAD notes line, the suite; 3: `GLSL_COMMON`, `FS_SKY`, a new `VS_STARS`/`FS_STARS`,
  `initGL()`, `setFrameUniforms()`, `renderScene()`, `resize()`, the hook, the suite; 4: the break
  list, the four docs; 5: the badge line and the plan's move to `DONE/`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every edit to the page; `.claude/scripts/gates.sh games/driving-simulator/index.html` GREEN
  at the end of every step (it smokes the page, runs this suite, checks the games sync and scans
  for live breaks).
- **Tier audit (required):** no step passes a haiku checklist. Step 2 is the most mechanical, but
  its offsets come from a document read at run time and it carries the only external dependency
  (sonnet, high). Steps 1, 3 and 4 each need judgment across the engine, the shader and the suite
  (opus, high). Step 5 is the procedure, but it pushes to `main` and verifies a deploy (sonnet,
  medium).
- **Decision defaults:** everything under "Design" above. Beyond it:
  - Prefer the page's existing patterns: `celestial()`'s axes, `build-kits.mjs`'s marked block, the
    sky's draw state.
  - A choice not listed here goes into `.claude/driving-simulator.md`'s "Assumed, not decided"
    table as a row, never silently.
  - A suite row the new rules contradict is **restated** (same claim, the new rule) and named in
    the Results. Never delete a row to go green.
  - If a tolerance below proves too tight for SwiftShader's pixels, widen it only after tracing why,
    and record the trace.
- **Embedded-content QA:** the suite has 78 checks at d0bff6c. Expected after each step: step 1 +8
  new (one restated in place) = 86; step 2 +2 = 88; step 3 +11 = 99. The invariant is that each
  step grows the suite by exactly the rows it adds. State the real total in each step's Results; if
  a step ends with a different row count, say why. Line numbers were read on d0bff6c; re-read before
  editing (each step moves lines). The `solar()` kernel and the matrix were run and checked while
  drafting (above).
- **Escalation triggers** (stop and report to the CD; do not work around):
  - `cdsarc.cds.unistra.fr` is still refused at step 2. The CD chose to allow it; it may take a new
    session. Try once, read `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, and do not fetch the data
    from any other host or package.
  - The catalogue's terms forbid redistribution.
  - The star pass costs more than a frame budget's worth on the perf block (step 4 measures).
  - Anything that would need a change to `drivingSimulator.settings.v1`'s key.
- **Playtest** (after step 5):
  - At night, look north: the Big Dipper (Dubhe high in the north at 22:00) and Polaris barely
    moving. South-west: Regulus and Leo. East: Arcturus, then Vega rising in the north-east.
  - Watch the sky turn about Polaris, not overhead.
  - The date in the settings ("Tue May 5"), stepping a day after midnight.
  - The sun setting a little after 8 pm.
  - Is magnitude 5 too many stars, or too faint, on your phone? Size and brightness are each one
    constant.
- **Publish:** step 5 pushes `main`, which is the publish; verify the Pages run (producer config
  § Publish). Steps 1-4 push the branch only.
- **Commit strategy:** one conventional commit per step on `ds-stars`, scope `driving-simulator`,
  ending "(dsstars step N)". Step 5 lands the branch on `main` as one commit with
  `.claude/scripts/land-on-main.sh ds-stars <message-file>` (dry-run first).

## Resume here (a session told "run the next open step of this arc")

1. Read `CLAUDE.md` § Git workflow. Concurrent sessions push to `main`; never author a merge commit
   on `main`; `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main`
   immediately before any push to `main`.
2. Read this file in full, including every step's Results. Then read `.claude/driving-simulator.md`:
   § Backlog DS-1, § Architecture, § Testing, and the "Assumed, not decided" table.
3. **Step 1 is on `origin/claude/brave-sagan-odwmrd`, not `ds-stars`** (the session that ran it could
   push only to its own designated branch, and `main` must not get the game's half before step 5).
   Start from that branch: a worktree cut from `main` (as an oversee run cuts one) merges
   `origin/claude/brave-sagan-odwmrd` in before anything else, then re-runs the gates (86 checks).
   Read "ds-stars" below as the branch the arc lives on, and push to whatever branch your own
   session may push to. Run the first step in the table below that
   is not DONE, and only that one. Then tick it, append a Results section (append, never rewrite),
   commit, push the branch (`git push -u origin ds-stars`), stop and report. **Never push to `main`
   before step 5.**

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

## Steps (one per session, then `/compact`; each ends: tick here, Results, commit to `ds-stars`, push the branch)

| # | Step | Status |
|---|---|---|
| 0 | The CD's words, the catalogue answer and the spec corrections recorded (this file) | DONE 2026-11-01 |
| 1 | `DS_PAGE`; calendar, DST, sun from the date, date in TIME and saved; restated sun row; calendar rows | DONE 2026-11-01 |
| 2 | Catalogue: V/50 downloaded and its terms read, `build-stars.mjs`, the STARS block; catalogue rows | BLOCKED 2026-11-01: host refused |
| 3 | Sidereal time, sky matrix, star pass, `ridgeY()`, hash stars deleted; star and pixel rows | |
| 4 | Break list run whole, frame cost, docs | |
| 5 | Ship: badge, gates, land on `main`, Pages, report to the CD | |

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

### Step 2 - the catalogue

- Download `ReadMe` and `catalog.gz` from `https://cdsarc.cds.unistra.fr/ftp/V/50/` into a new
  empty directory, then copy them into `games/driving-simulator/data/bsc5/`. **Blocked? Stop**
  (escalation trigger): commit nothing for this step and report.
- Read the ReadMe's byte-by-byte table and CDS's conditions of use; record what they say (Design,
  "Terms").
- Write `build-stars.mjs` beside `build-kits.mjs`. Its header gives the regeneration command
  (`node build-stars.mjs data/bsc5/catalog.gz`). It parses by the ReadMe's offsets, cuts at
  `V <= 5.0`, writes the block, and prints the count and the brightest five as a sanity line. Sirius
  (HR 2491) must be first at about V = -1.46.
- The THE ROAD notes line and its source, per "Terms".
- New rows (2):
  1. The catalogue holds 1,400-1,800 stars, every V <= 5.0, and RA and Dec in range. The nine named
     HR numbers are present: 424 Polaris, 3982 Regulus, 5340 Arcturus, 5056 Spica, 4301 Dubhe,
     7001 Vega, 2061 Betelgeuse, 2491 Sirius, 1713 Rigel. The header names `build-stars.mjs` and V/50.
  2. Those nine sit at the suite's own J2000 positions within 0.01 deg. The suite has its own table
     of their coordinates (the values in `.claude/driving-simulator.md` DS-1 for Polaris; standard
     J2000 for the rest). This catches a packing scale, a sign or an hours-vs-degrees slip.
- Suite 86 -> 88.

### Step 3 - the stars in the sky

- Sidereal time, the sky matrix and the star pass, as in "Design". Then `ridgeY()`, and delete the
  hash stars and `uStarRot`.
- New rows (11):
  1. LST equals the suite's Meeus 12.4 within 0.01 deg at six times. At the local midnight that
     starts May 5 it is 204.4 deg (within 0.05). Across a midnight date step, LST moves only by the
     step's own sidereal advance.
  2. The celestial pole, `SKY.starM` applied to (0, 0, 1), is due north at altitude 35.78 deg
     (within 0.01).
  3. Polaris: at each of 24 hours its altitude is 35.0-36.6 deg, its azimuth within 1.0 deg of
     north, and both within 0.5 deg of the suite's alt/az.
  4. Each of the nine stars keeps its angle to the pole within 0.05 deg over 24 game hours, so it
     circles the pole and not the zenith.
  5. Dubhe stays above the horizon all day; Arcturus is below it at some hour and above it at
     another.
  6. The spring sky at 22:00 EDT on May 5: the seven stars of the spec's table within 0.5 deg of the
     suite's own alt/az. One row; on failure it prints each star's deltas.
  7. Stars move west: Arcturus (east at 22:00) climbs and Betelgeuse (west) sinks over one game hour.
  8. One POINTS draw per pass with `STARS.n` vertices, recorded by wrapping `gl.drawArrays` for one
     frame: one in the main pass, one more in the mirror pass in the cockpit view.
  9. Pixels at midnight. At four headings (chase view, `PLAYER.yaw` 0, 90, 180 and 270 deg,
     `CAM.chase = null`, a few frames), the sky above the ridge holds isolated pixels clearly above
     their neighbours.
  10. Pixels at noon: none.
  11. With `STARS.on = false` at midnight, the same regions hold none. This is what proves `skyCol()`
      has no stars of its own left.
- Also rerun the existing day/night pixel rows (`suite:421-422`). The sky's day pixels must not move
  with `ridgeY()` (the refactor is exact).
- Suite 88 -> 99.

### Step 4 - negative tests, frame cost, docs

- Write `.claude/tests/negtests/driving-simulator.json` in `negtest-batch.py`'s format: `name`,
  `file`, `old` (found exactly once), and `new` carrying the `@negtest` marker outside any string
  literal. At least these breaks, each meant for its own row:
  - the latitude 90 (the old bug's sky);
  - LST without the longitude;
  - the RA sign flipped (stars run east);
  - the date not stepping at midnight;
  - the wrap to the middle date instead of the first;
  - EST all year;
  - no fall-back;
  - the date not saved;
  - `DECL` 15 deg kept for the sun;
  - the declination's sign flipped;
  - the star pass not drawn;
  - stars not faded by day;
  - a hash star left in `skyCol()`;
  - the magnitude cut at 6.5;
  - RA read as hours, not degrees;
  - the ridge test removed (and say which row sees it, or record why none can).
- Run it whole with `negtest-copies.py` (Tools above). Every MISSED gets a row that sees it, or a
  written argument that it is equivalent or dead code (the tests README's rules). Record the result
  in `.claude/driving-simulator.md` § Testing.
- Frame cost:
  - Run `node .claude/scripts/frame-budget.cjs games/driving-simulator/index.html swiftshader=1` at
    night, with the stars on and then off through the hook (its header has the `eval`/`evalFile`
    options). With `swiftshader=1` the number says how the renderer behaves with no GPU, not a
    phone's frame rate; say so.
  - Record the star pass's share on the perf block: calls +1, or +2 with the mirror; triangles
    unchanged; the 3D CPU time on and off.
  - Escalate only on a gross cost.
- Docs, every name and count read from the code:
  - `.claude/driving-simulator.md`:
    - DS-1 marked built. Its numbers, DS-3's sun table and DS-4's sun table were already corrected
      when this plan was drafted: confirm them against what the suite computes, and change only
      what disagrees;
    - the assumed table: the observer, the season dates, the start date, the DST handling, the
      magnitude cut, the star look, precession ignored, and the terms row if assumed;
    - Architecture (the calendar, the sky matrix, the star pass, the STARS block and its script);
    - Testing (the new rows, the break list's result);
    - the header count.
  - `.claude/tests/README.md`: the suite's row, its count, and the break-list line.
  - `games/CLAUDE.md`: the DRIVING SIMULATOR entry, its count, and the STARS block named beside the
    KITS block as generated.
  - `CLAUDE.md`: the Driving Simulator row gains the calendar, the catalogue block ("generated by
    `build-stars.mjs`, never hand-edited") and the sky matrix.

### Step 5 - ship

- `.claude/scripts/stamp-badge.sh games/driving-simulator/index.html`, then read the stamp back out
  of the file. `check-inline-js` and `gates.sh` must be GREEN after the stamp.
- Move this plan to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>` (the branch range), and
  commit on `ds-stars`.
- Land the branch:
  - Run `git fetch origin main`, then `.claude/scripts/land-on-main.sh ds-stars <message-file> --dry-run`,
    then without `--dry-run`. The message is `feat(driving-simulator): the real sky over Raleigh and a calendar (DS-1)`
    with the session's trailers.
  - If it reports `behind`, merge `origin/main` into `ds-stars`, re-run the gates, and check the
    other session's files survived (CLAUDE.md § Git workflow).
- Push the branch: `git push origin ds-stars`.
- `TODO.md`: move the DS-1 entry to `DONE.md` with the badge string. DS-2 to DS-4 stay in `TODO.md`
  § Now, re-sweepable (see Follow-ups).
- Verify the "pages build and deployment" run for the landed SHA: `mcp__github__actions_list`,
  `perPage: 1`, branch main, event dynamic. Match `head_sha` and read the jobs. Budget two checks,
  then report.
- Report to the CD:
  - the badge string;
  - the star count and the catalogue's terms;
  - the playtest list above;
  - the assumed rows most worth a look: the start date, the DST jump, the star look, the
    magnitude cut;
  - the re-sweep command.

## Gotchas / bindings

- **The suite's hard-coded page path** (`suite:17`) tests the primary checkout from a worktree.
  Step 1 fixes it first; until then, a green suite in a worktree proves nothing.
- **`SKY.day` is taken**: it is the daylight factor that half the renderer reads. The date is
  `SKY.mjd`.
- **No `Date` in the sky code.** The device's time zone is not Raleigh's. MJD arithmetic only.
  `Date.now()` stays where it already is, if anywhere.
- **The ridge is not geometry.** A star pass with the depth test off draws over the hills unless its
  fragment shader runs the same `ridgeY()`. The world drawn afterwards covers it correctly.
- **The mirror calls `renderScene()` too** (`index.html:2265`, near 0.5, 320x96). The star pass runs
  there with `uPx = 1`. The mirror's colour target is already tonemapped
  (`.claude/notes/20261101-a-realistic-webgl2-scene-in-one-file.md`), and so is the star pass's
  output: add it as it is, with no second tonemap.
- **Blend state leaks.** The glow and blob passes set their own blend state later in
  `renderScene()`. Turn blend off after the star pass and leave depth state as the sky leaves it, or
  the world draws blended.
- **`skyCol()` is also the world shader's fog and paint reflection** (`GLSL_COMMON` is in
  `FS_WORLD`). Deleting the hash stars removes stars from reflections. That is intended; say so in
  the docs.
- **DST state loops if derived.** On the fall-back day, 01:30 is both EDT and EST. Keep `SKY.dst` as
  state, flip it only in `advanceClock()`, and re-derive it only at boot, a date step and the slider.
- **The clock rows are exact** (`suite:118-122`, tolerances 1e-6). The midnight loop must not
  perturb the hour's arithmetic: subtract 24 exactly, never re-modulo a value that is already in
  range.
- **Settings coercion** (`index.html:236`) forces the season to spring at load. The DST rows set
  `SETTINGS.season` through the hook after boot and must restore it, or later rows run in autumn.
- **SwiftShader** renders slowly, and `gl_PointSize` above 1 is supported there. A pixel row that
  needs a point bigger than 64 px is wrong anyway. Point sizes are in framebuffer pixels: multiply by
  the render scale, or phones (scale up to 1.75) get pinpricks.
- **Downloaded files are untrusted data.** Download into a new empty directory, keep the script
  elsewhere, and pass paths as arguments (the environment's rule). The script reads text; it never
  evaluates it.
- **`negtest-copies.py`** needs the suite to honour `DS_PAGE` (step 1). Run the suite once on the
  unbroken page first; never edit the page while a list runs. A row that "catches" unrelated breaks
  is flaky until traced.
- **Discovery over instruction** (`games/CLAUDE.md`): no new text on the play surface. The date
  lives in the settings only.
- Commits: explicit pathspecs (never `git add -A`), the session's Co-Authored-By / Claude-Session
  trailers, no model id anywhere in the repo.

## Validation

Per step, as in the guidance table. End to end:
- `gates.sh games/driving-simulator/index.html` GREEN on the stamped page, with the suite at its new
  count;
- the break list run whole, every miss explained;
- the frame cost recorded;
- the Pages run for the landed SHA concluded `success`.

The CD's playtest (above) is what no suite can do: whether the sky looks like Raleigh's on a phone.

## Follow-ups

- **DS-2, DS-3, DS-4** (`TODO.md` § Now): re-sweep with `/zmh-producer:backlog-plan-gen driving-sim`
  right after this lands. DS-3 and DS-4 cite this plan's `SEASON_DATES`, `SKY.mjd`, `utcOffset`,
  `solar()`, `SKY.lst` and `SKY.starM`. DS-4 also replaces the moon's placeholder rule and adds
  refraction; DS-4's "a bright moon dims the stars" fades this plan's star pass.
- The Milky Way (out of scope in DS-1).
- Precession to the date (0.36 deg) if a sharper sky is ever wanted.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dsstars.real-sky-and-calendar.md
```

(Or one step per session: "Run the next open step of `.claude/plans/dsstars.real-sky-and-calendar.md`
on branch `ds-stars`".)
