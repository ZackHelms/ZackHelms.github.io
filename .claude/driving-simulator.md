# Driving Simulator (`games/driving-simulator/`)

An endless two-way US road you drive in WebGL2, from the driver's seat or from
outside the car. CD commission, 2026-11-01, placed on the hub straight after
Animation Rigs. Open licence (MIT, the default). Suite:
`.claude/tests/drive-driving-simulator.cjs` (108 checks).

## The CD's brief (verbatim)

> add a new arcade game named "driving simulator" to the list after "animation
> rigs". This is a driving game where you can switch the view from inside car
> behind the wheel to outside the car. Car and scenery should look realistic. A
> few other vehicles are on the road in either lane. Sometimes 2 lane, sometimes
> 4 lane, sometimes 6 lane. 24 hour day/night cycle takes 2.4 minutes (this is
> configurable via settings menu). Leverage the zmh-3d plugin if it helps or if
> work here with this game can help improve the plugin.

## The four answers given before the build

| Question | CD's answer |
|---|---|
| Goal | **Free drive.** No score, no fail state; a crash stops the car and you drive on. |
| Phone input | **On-screen wheel + pedals** (keyboard too). |
| Road | **US right-hand, two-way.** Half the lanes oncoming; dashed yellow on 2-lane, double yellow on 4/6; lanes added and dropped on tapers. |
| Licence | **Open MIT** (the default). |

## Assumed, not decided

| Thing | What was built | Why |
|---|---|---|
| Rendering | Hand-written **WebGL2** (the second hand-written WebGL game after Wayfinder; Interlock uses Three.js) | "Realistic" 3D with shadows, headlights and a mirror is not reachable in Canvas 2D; no library, per the no-dependencies rule |
| Look | Realism inside the scene; the site's neon only on the chrome, HUD fonts and the settings panel | Same split as `experiments/` dioramas |
| Four road classes | rural 2-lane 55 mph, town 2-lane 35 mph (kerbs, sidewalks, streetlights), arterial 4-lane 45 mph, highway 6-lane 65 mph (undivided, double yellow) | The kit's `standard.roadClasses`; a 6-lane road with a grass median was offered but not chosen |
| Lane changes between classes | At most one lane per direction at a time, over the kit's MUTCD merge taper (L = W x S, ~165-238 m) | Real practice; a 2 -> 6 jump in one taper would be a 7 m lateral shift |
| Start | 1:00 pm, at rest, in the right lane of a rural forest 2-lane | Sun high enough for shadows; sunset arrives about 40 s in at the default day |
| Sun | *Superseded by DS-1 (2026-11-02):* the sun, moon, planets and stars of Raleigh, NC on the game's date, from zmh-sky. Was: latitude 36 N, declination 15 deg, solar noon at 1 pm | The CD asked for Raleigh's spring sky |
| Player's car | The kit's sedan, painted blue | |
| Crashes | Bounce, lose speed, shake; the car you hit puts its hazards on and stops for 6 s | Free drive: no damage model |
| Radio | On by default; four stations (Lo-fi, the original chord loop, first) | Every game here has music; it is the car radio. Stations added on the CD's ask (2026-11-01, second brief); their styles were assumed |
| Views | Cockpit (default), chase, orbit (drag + pinch) | "Inside behind the wheel" and "outside" |
| Observer (DS-1) | `OBS = { lat: 35.7796, lon: -78.6382 }`; the kit's `OBS_SKY` has `heightM: 0` | The kit's own Raleigh observer. Raleigh is about 100 m up, which moves the moon's parallax by far under 0.001 deg |
| Season dates (DS-1) | The astronomical seasons: spring Mar 20 - Jun 20, 2026; summer Jun 21 - Sep 22; autumn Sep 23 - Dec 20; winter Dec 21, 2026 - Mar 19, 2027. `SEASON_DATES` rows are `[first, last, middle]` as MJDs | DS-3 cites them; the DST rows use autumn and winter |
| Start date (DS-1) | A first visit is the season's middle date at 1 pm: **Tue May 5, 2026** in spring. The hour always starts at 1 pm; the date is saved. A missing, broken or out-of-season saved date becomes the middle date | The CD chose a day per game day; the middle of spring shows a typical spring sky |
| Date steps (DS-1) | At each midnight the date steps by one; past the season's last day (or before its first, through the hook only) it goes to the first day. `setDate()` saves, as a midnight does. Choosing another open season moves the date to its middle date (unreachable while only spring is open) | One rule for the midnight and the wrap |
| Daylight saving (DS-1) | `SKY.dst` is state. On the fall-back day the clock goes 02:00 -> 01:00 once; on the spring-forward day 02:00 -> 03:00. At boot, a date step and the time-of-day slider `dst` is re-derived by the rule (`utcOffset`), with the repeated hour reading as EDT and the missing hour (02:00-02:59 on the spring day) as EDT. At a date step `dst` is derived for 00:00 of the new date | Raleigh's clock; pure (date, hour) is ambiguous in the repeated hour. Spring never meets a transition: only the hook reaches them |
| Magnitude cut (DS-1) | The splice's `--mag 5`: 1,627 stars | Naked-eye under a light-polluted sky; one flag to change it |
| `STAR_GAIN = 3.2` (DS-1; *superseded by DS-5: 4.0*) | The star pass's gain after the tonemap, times `SKY.exposure` and `SKY.night` | Read off pixels at 22:00 on May 5: at 1.6 Spica (mag 0.97) peaked at luminance 118, not white; at 3.2 it reads 209 and Arcturus saturates |
| `MW_GAIN = 0.012` (DS-1) | The Milky Way's linear scale before the tonemap: the kit's `MILKY_WAY_PEAK` | Faint, as Raleigh's sky is: Cygnus reads luminance 32.8 against 19.5 off the band |
| Planet colours and clamp (DS-1) | Mercury and Venus white; Mars (1.0, 0.62, 0.42); Jupiter (1.0, 0.95, 0.85); Saturn (1.0, 0.9, 0.7). Point intensity clamped at 2.5 (Sirius = 1). A planet outside the kit's 1800-2050 elements gets magnitude 99 and draws nothing | Venus a bright point, not a flare |
| Star profile (DS-1; *the floor superseded by DS-5*) | The kit's Gaussian point with sigma floored at 0.5 framebuffer px and the point at least 3 px wide; the centre keeps the law's value. From about 2.8 px up it is exactly the kit's | The kit's 1-2 px point is sub-pixel at pixel centres: faint stars came out at a fifth of their law or not at all |
| Star fade (DS-1) | `smoothstep(0, 2, alt)` over the first 2 deg; nothing below the horizon or under the ridge | The kit's 2-deg fade, written as a smoothstep |
| The world frame (DS-1) | The page's world is (east, up, **south**). `SKY.sun / moon / planets / starM` stay in the kit's ENU; the GPU gets `SKY.sunW`, `SKY.moonW` and `SKY.starW` through `enuToWorld(v) = [v[0], v[1], -v[2]]` | `M4.look` is an OpenGL lookAt, so the renderer is right-handed; fed ENU unmapped, the sky drew mirrored (traced in step 3). The plan's "no remap" was wrong |
| The Date row (DS-1) | `#date-val` on its own row (`#date-row`, "Date") under the time-of-day slider, at every width | Inside the Time-of-day row it pushed the clock past the row's edge at 320 px |
| Star sigma floor (DS-5) | `max(sz * 0.5 / sqrt(8), 0.5 * max(uPx, 1))`: half a CSS pixel, and never under half a framebuffer pixel. The mirror pass (`uPx = 1`) and the suite's own scale-1 context (RSCALE 0.85) keep 0.5 framebuffer px | The plan's lever 1 is `0.5 * uPx`; below RSCALE 1 that is under half a framebuffer pixel, the sub-pixel case the DS-1 floor was there to stop (measured at RSCALE 0.85 with `0.5 * uPx`: Polaris 59 at a pixel corner, against 86 before) |
| `STAR_GAIN = 4.0` (DS-5) | Raised from 3.2, after the CSS-px floor | The floor alone left Polaris at 166 at a pixel corner on the phone; 200 / 166 x 3.2 = 3.86, rounded up to 4.0 (Polaris 207, iota Leo 88 at their worst phase). The kit's law, the 2.5 clamp and `MW_GAIN` are unchanged |
| Notes link (DS-1) | `#settings a{color:var(--blue);overflow-wrap:anywhere}` | The licence link reads and wraps at 320 px |

## The second brief (2026-11-01, after "plays great"), verbatim

> - If i hold brake long enough i reach 0 mph and still hold brake for 1 second at 0 then it should start going in reverse. It kind of does that now but spins the car too (which may be intentional but i want to control turning while going in reverse)
> - Add a cruise control toggle on/off button that holds current speed
> - Opening the settings menu should pause the game.
> - Add separate audio controls in settings for bgm, ambient, engine, and each other sfx currently available. Each simply has a volume slider where all the way to left makes it 0 volume (muted). Replace "Radio on/off" toggle with slider.
> - Add radio station selector in settings menu at top of sound section.
> - Add a fps metric at the top in pure green (easy to see) and in settings menu a toggle for perfstats to show or not show stuff like this. Are there any other performance statistics? Go ahead and add those too so i can see.

What was built, and the one cause that was traced:

- **The spin was a bug, traced to code.** The dynamic branch of `stepPlayer`
  (above 2 m/s) multiplied the yaw moment `a*Fyf*cos(d) - b*Fyr` by
  `sign(vx)`. The slip angles already carry the direction of travel, so in
  reverse that flipped the sign of the yaw damping and the car spun (measured:
  wheel half left at 5.6 m/s backwards gave +2.4 rad/s, a turn every 2.6 s,
  the wrong way). Removed, with the same stray `sign(vx)` on the front tyre's
  drag. Now the same input gives a steady -0.36 rad/s, the kinematic value, and
  the car turns as a real one backs up: wheel left, tail left.
- **Reverse** engages after `REVERSE_HOLD` = 1.0 s with the brake held and the
  speed under 0.2 m/s (0 on the readout); it was 0.6 s under 0.3 m/s.
- **Cruise control** (`CRUISE`, `setCruise`): a HUD button above the
  accelerator (touch role `cruise`, key X). It holds the speed it was tapped at
  with a throttle computed from what the car must overcome (drag, rolling,
  grade) plus a small P+I correction, and a touch of brake on a descent the
  engine cannot hold. The accelerator overrides it while held and the car
  settles back on release; the brake pedal, reverse or a crash over 3 m/s lets
  it go; it refuses below 1 m/s (red rim and a low buzz). Lit green with the set
  speed on the button and "CC nn" on the dash.
- **The menu pauses** the loop (`menuOpen()` gates `tick`). The sound keeps
  playing as it was, so each slider is heard as it moves, and a slider for a
  one-shot sound (horn, crash, skid, tyres, wind, ambient, buttons) plays a
  sample of it when let go (`SND.preview`). Esc closes the menu; the time-of-day
  slider redraws the sky while paused.
- **A volume per sound** (`SETTINGS.vols`, `VOL_KEYS`): radio, ambient, engine,
  tyres, wind, tyre squeal, crashes, horn, buttons; 0-100 with 100 the measured
  mix and a squared taper (half way is a quarter). "All sound" (the old master)
  stays above them. An old save's `radio: 0` becomes `vols.music = 0`.
- **Ambient**: there was no ambient sound to put a slider on, so one was built:
  a breeze, birds by day, crickets by night (`bird()`, `cricket()`), muffled
  behind the glass in the cockpit.
- **Radio stations** (`STATIONS`, `BEATS`): 88.1 Lo-fi (the original loop),
  94.5 Synthwave, 101.9 Jazz (swung), 106.3 Classical (Alberti bass), each a
  function of the step number so it loops exactly, each trimmed to the same
  level off the music probe. Tuning fades the old station and covers the gap
  with a burst of static.
- **Performance stats** (`PERF`, `drawPerf`, setting `perf`: 2 all / 1 FPS
  only / 0 off, default all because the CD asked to see them): FPS in pure
  `#00ff00` at the top centre (beside the chrome when there is room, on a line
  under it on a narrow phone), and a block on the left: frame time (average and
  slowest in the last half second), CPU ms for sim / 3D / HUD, GPU ms from
  `EXT_disjoint_timer_query_webgl2` where the browser offers it ("n/a" on iOS),
  draw calls and triangles (counted by wrapping the context's draw functions, so
  every pass is in them), the 3D picture's resolution and scale, chunks, cars,
  lights and JS heap (Chrome only).
- `--sat/--sab/--sal/--sar` are now defined from `env(safe-area-inset-*)`. The
  layout already read `--sab` but nothing set it, so the pedals sat in the
  iPhone's home-indicator strip.

## Open questions for the CD

1. Does the car feel right? 0-60 mph is ~7 s, braking from 60 is ~39 m, steering
   narrows with speed. All tunable in `stepPlayer()` / `maxSteer()`.
2. Should the player be able to pick their car (the kit has six) or its colour?
3. Weather, junctions with signals, or a destination next?
4. Is the 6-lane class right undivided, or should it get a median?
5. ~~Cruise control +/- buttons?~~ The CD, 2026-11-01: "Cruise control as is for now."
6. ~~Should traffic make sound?~~ The CD, 2026-11-01: yes, in stereo with Doppler: backlog DS-2.
7. ~~Should the moon follow the real date, phase included?~~ The CD, 2026-11-01: "Moon
   realism: yes, add this (and sun position) to the backlog": DS-4. Asked then whether
   the date should advance a day per game day, the CD chose **a day per game day**
   (DS-1's calendar).

## Backlog (the CD's third message, 2026-11-01), specified for plan-gen

The CD, verbatim:

> Cruise control as is for now.
>
> Other cars should make sound yes; stereo so that if i pass a car and it is on my right i hear it in right speaker mostly (a little in left too is realistic), also doppler effect should be realistically simulated. Add this to backlog for driving simulator.
>
> Oh yeah, fix the star field rotation. It looks like i am at the earths rotational north pole and star field spins around like a spinning top. Should look like star field looks to me in the sky from perspective of raleigh north Carolina in the spring. Add this to driving sim backlog.
>
> Add to settings a season dropdown menu defaults to spring and other seasons are visible but not selectable (yet; add this to the backlog for "driving sim").

Then, in the CD's fourth message:

> Moon realism: yes, add this (and sun position) to the backlog for driving sim.

The CD was then asked whether the in-game date should advance a day per game
day (so the moon goes through its phases) or stay one fixed date per season,
and chose **"A day per game day"**. DS-1 carries that calendar.

The season dropdown itself shipped the same day (`build 2026-11-01 15:55 UTC`): a
**Season** row in TIME, spring selected, summer / autumn / winter listed but
disabled, `SETTINGS.season` saved, `SEASONS` and `SEASONS_OPEN` in the page, a
suite row. The four items below are `TODO.md` § Now. Each is one plan. DS-3 and
DS-4 need DS-1's calendar, so they go after it. **DS-1's plan:**
`.claude/plans/DONE/dsstars.real-sky-and-calendar.md` (drafted 2026-11-01; step 1 built the
same day on `claude/brave-sagan-odwmrd`; revised 2026-11-02 for zmh-sky). DS-2 to DS-4
wait until it lands: all three share its files, and DS-3 and DS-4 cite its contracts
(`SEASON_DATES`, `SKY.mjd`, `utcOffset`, `julianDate()`, `OBS_SKY`, `SKY.starM`, and the
`ZMH-SKY` block with its `ZMH_SKY.skyAt()`).

**zmh-sky (2026-11-02).** The CD shipped zmhstudio's sky kit (`plugins/zmh-sky/`,
skill `zmh-sky:sky-pipeline`) and asked for the sky work to use it: "update the backlog
and plan(s) accordingly since this new plugin should streamline the sky work". The kit
gives the sun, the topocentric moon with its phase, the planets, a J2000 star catalogue
and the star matrix for any date and place, plus GLSL for star points, the moon's disc
and the Milky Way. It is spliced into the page by its own CLI. Its numbers are graded
against astronomy-engine. DS-1 and DS-4 below were rewritten to use it, and DS-3's sky
comes with it.

Every step runs `gates.sh`, so a
step that moves the sun must restate the suite's sun row in that step (producer
config § Plans, "plan the seams"). The defaults marked *chosen* were set when
the item was written; the CD may overrule them at plan review, but they need no
answer to start.

### DS-1. A real star field: the sky from Raleigh, NC, in spring

**Built 2026-11-02** (plan `dsstars`, steps 1-4; the spec below was checked
against the code). One correction to it: the kit's ENU is not the page's x, y,
z. The page's world is (east, up, south), and the GPU gets every body through
`enuToWorld` (see Architecture, "The sky").

**The cause, traced 2026-11-01.** `skyCol()` in `GLSL_COMMON` turns the star
lookup direction about the world's vertical axis (`sd.xz` rotated by
`uStarRot`), and `setFrameUniforms()` sets `uStarRot = SKY.hour / 24 * TAU`.
A sky turning about the zenith is the sky at the North Pole. The stars are
also not real: a hash over (azimuth, elevation) cells (`step(0.985, h21(cell))`),
so there are no constellations, and the grid's cells crowd together at the
zenith.

**Build.**

1. **Observer.** Raleigh, NC: latitude 35.7796 N, longitude 78.6382 W. This
   replaces `LAT = 36 deg`.
2. **A calendar that advances a day per game day** (the CD's answer). It
   replaces `DECL` and `SOLAR_NOON`.
   - Each season is a run of dates, the astronomical seasons (*chosen*):
     spring Mar 20 - Jun 20, 2026; summer Jun 21 - Sep 22, 2026; autumn
     Sep 23 - Dec 20, 2026; winter Dec 21, 2026 - Mar 19, 2027.
   - The date steps forward one day each time the game clock passes midnight
     (`advanceClock()`), and after the season's last day it wraps to its first.
     The wrap moves the sun, the stars and the moon once, about every 92 game
     days (about 3.7 hours at the default 2.4-minute day).
   - A first visit starts on the season's middle date at 1 pm (spring:
     **May 5, 2026**). The date is saved beside the settings so the moon's
     phase carries on between visits; the hour still starts at 1 pm.
   - The time-of-day slider moves the hour only, never the date. The settings'
     TIME section shows the date beside it (for example "Tue May 5").
   - The UTC offset follows the US rule: EDT from the second Sunday of March to
     the first Sunday of November, EST otherwise. Autumn's clock falls back an
     hour on Nov 1, 2026, as Raleigh's does.
   - The sun's declination, the equation of time and solar noon come from the
     date. Step 1 built this with NOAA's solar calculator (Meeus-based). The
     revised step 2 takes the sun from zmh-sky's `skyAt()` instead, one sun for
     the light and, later, the moon's terminator. For May 5 at local noon,
     recomputed 2026-11-01 by two independent methods that agree within 0.011
     deg, and by the kit (+16.387 deg, +3.31 min): declination +16.4 deg,
     equation of time +3.3 min, solar noon 13:11, sunrise 06:18, sunset 20:05
     EDT. Step 1 measured 06:18:09 and 20:04:52 on the page. (The first draft
     of this item said +16.0 deg and 20:03.)
   - The suite recomputes these with its own copy of the formula; it never
     copies these numbers.
   - The suite's existing row ("the sun sets about 7:45 pm and rises about
     6:15 am") must be restated in the same step, to within 10 min of the
     computed times. The clock rows stay (144 s is still one game day); new
     rows: crossing midnight advances the date by exactly one, and the day
     after the season's last wraps to its first.
3. **A real catalogue, from zmh-sky** (revised 2026-11-02). The kit's
   `sky-data/v1` stars (XHIP via d3-celestial, J2000, BSD-3-Clause), cut at
   magnitude 5.0: **1,627 stars**, each with HIP number, RA, Dec, V magnitude
   and B-V.
   - The kit's CLI splices them into the page as a `ZMH-SKY` block, beside the
     KITS block, along with the library (`ZMH_SKY`) and its GLSL:
     `node <zmhstudio>/plugins/zmh-sky/cli/zmh-sky.mjs splice --page games/driving-simulator/index.html --mag 5 --parts stars,planets,glsl`.
     Nobody types star data, and nobody edits the block by hand.
   - **Attribution** (the kit's `data/SOURCES.md`). The settings' THE ROAD notes
     show the kit's line verbatim, "Star data: XHIP (Anderson & Francis 2012) via
     d3-celestial, (c) 2015 Olaf Frohn, BSD-3-Clause; constellation lines after
     the IAU figures, modified by O. Frohn; planet elements: JPL (Standish),
     Table 1.", and link `LICENSE-d3-celestial.txt`, which ships beside the
     page.
   - *Superseded:* the first choice was BSC5 from CDS (VizieR V/50), packed by a
     new script. The proxy refused its host on 2026-11-01, even after the CD
     chose to allow it, and the kit made the download unnecessary.
4. **One rotation from catalogue to sky: the kit's star matrix.**
   - `skyAt()` gives `starMatrix` (`equatorialJ2000ToHorizonMatrix`): J2000 to
     the sky, sidereal time and **precession included**. It is row-major, so it
     is uploaded with transpose. Never build the rotation from the hour and the
     latitude: that is the zenith-spin bug, the kit's first trap.
   - Local sidereal time is the kit's `lstDeg` (Meeus 12.4): 204.4 deg at the
     local midnight that starts May 5, and 11.69 h at 22:00 EDT.
   - Because the date advances with the clock, LST runs on smoothly through
     midnight (the stars come back about 4 minutes earlier each night, as they
     do). It jumps only at the season's wrap.
   - The kit's ENU is x east, y up, z north, and `SKY.sun`, `.moon`,
     `.planets` and `.starM` stay in it. The page's world is (east, up, south):
     the GPU gets `SKY.starW = W * starM` with `W = diag(1, 1, -1)` (the first
     draft said "no remap", which drew the sky mirrored). The celestial pole
     **of date** sits due north at an altitude equal to the latitude. The J2000
     pole is 0.15 deg from it in 2026.
   - Stars rise in the east and set in the west. Stars north of dec +54.2 deg
     never set.
5. **Drawing.** One `gl.POINTS` draw right after the sky in `renderScene()`,
   so the mirror gets it too.
   - Depth test off, like the sky. The ridge (in the sky shader) hides the
     stars behind it through a shared `ridgeY()`, and the world covers the rest.
   - Each vertex is a J2000 unit vector, and the star matrix turns it into the
     sky.
   - Size, brightness and colour follow the kit's laws (`starAppearance`:
     gamma 0.5 on flux, Sirius = 1, 1-4 px; `bvToRGB`), with extinction of
     0.2 mag per airmass, faded by `SKY.night`, and one page gain.
   - **The planets** (added 2026-11-02, the CD's choice) ride in the same draw as
     five more points: Mercury, Venus, Mars, Jupiter and Saturn from `skyAt()`.
     On May 5 at 22:00, Venus (-3.9) is low in the west-north-west and Jupiter
     (-2.0) higher in the west.
   - **The Milky Way** (added 2026-11-02, the CD's choice) is the kit's
     procedural band, drawn in the sky shader at night only. It is faint, since
     Raleigh's sky is light-polluted.
   - Delete the hash stars and `uStarRot`.
   - Cost: one draw call, 1,632 vertices, and the band's per-pixel work; check
     them on the perf block.
6. **The moon in its real place** (added 2026-11-02, the CD's choice).
   `skyAt()`'s topocentric moon replaces the placeholder that kept it opposite
   the sun. Its phase, size and light stay in DS-4.

**Checks.** Each is its own row and each is negative-tested. The suite checks
against its own formulas (Meeus GMST, IAU 1976 precession, Meeus 49 mean phases)
and against astronomy-engine's numbers from the kit's golden vectors, never
against the page's or the kit's code.

- **Polaris** (HIP 11767, J2000 RA 2h31m49s, Dec +89 15' 51'') is 0.74 deg from
  the J2000 pole. Precessed to 2026, over a game day its altitude runs
  35.15-36.41 deg and its azimuth stays within 0.77 deg of north. The check:
  altitude 35.1-36.5 deg and azimuth within 0.8 deg of north at every hour, each
  within 0.05 deg of the suite's own precessed alt/az. At 22:00 it is 35.39 /
  359.40. (The first draft's 35.0-35.6 band was wrong, and the 2026-11-01
  correction's 35.04-36.52 left out precession.)
- **Each star circles the pole of date, not the zenith.** Its angle to the pole
  stays the same within 0.05 deg over 24 game hours. Dubhe (dec +61.75 deg)
  never sets; Arcturus (dec +19.2 deg) rises and sets.
- **The spring sky at 22:00 on May 5** (2026-05-06 02:00 UT). These are
  astronomy-engine's values (zmh-sky `vectors/golden.v1.json`, records
  `2026-05-06T02Z/raleigh/hip<N>`), checked within 0.05 deg. The first table here
  took J2000 positions without precession and was up to 0.33 deg off; the zmhsky
  run traced that, and the 2026-11-02 revision reproduced it.

  | Star | Altitude | Azimuth | Where |
  |---|---|---|---|
  | Regulus | 58.38 | 226.50 | high, south-west |
  | Arcturus | 51.96 | 105.54 | east |
  | Spica | 36.76 | 147.11 | south-east |
  | Dubhe | 63.56 | 350.41 | high, north |
  | Vega | 12.23 | 50.64 | rising, north-east |
  | Betelgeuse | 7.43 | 273.81 | setting, west |
  | Sirius | 2.82 | 246.98 | on the south-west horizon |

- **Stars move west.** A star in the east climbs over one game hour.
- **The sun, the moon and the planets** at the same moment, within 0.05 / 0.3 /
  0.3 deg of astronomy-engine's. At the Meeus mean full and new moons of May
  2026, the sun-moon angle is near 180 and near 0.
- **Pixels.** At midnight the sky above the ridge holds star pixels whichever
  way the camera looks. At noon it holds none. Jupiter's point is drawn where
  the suite says it is. The Milky Way is brighter on the band than off it at
  night, and absent by day.

**Files:** `index.html` (the `ZMH-SKY` block, `updateSky()`, `setFrameUniforms()`,
`skyCol()` and `FS_SKY`, `renderScene()`, the THE ROAD notes),
`LICENSE-d3-celestial.txt` beside the page, the suite, and this file. Plan:
`.claude/plans/DONE/dsstars.real-sky-and-calendar.md`.

### DS-2. Other cars make sound, in stereo, with real Doppler

**Build.**

1. **Voices.** The 6 traffic cars nearest the listener within 150 m each get a
   voice from a fixed pool built once in `SND.unlock()`.
   - No AudioNodes are created per frame.
   - When a voice moves to another car it fades over about 80 ms, so nothing
     clicks.
   - The 7th-nearest car, and any car beyond 150 m, is silent.
2. **A voice's sound.**
   - An engine like the player's: two saws and a square through a lowpass.
     Its pitch comes from the car's speed (`c.v`) through the same gearbox
     shape, scaled by `c.kind`: lower for `boxTruck` and `pickup`, higher for
     `hatchback`.
   - Tyre roar: band-passed noise from the shared buffer on the voice's own
     BufferSource, so that source's `playbackRate` can carry the Doppler.
     Its level follows speed.
   - Then air absorption: a lowpass falling with distance, from about 16 kHz
     at 5 m to about 3 kHz at 150 m.
   - Then distance: inverse-distance gain, reference 5 m, clamped near 1 m.
   - Then the stereo pan.
   - Then a new **`traffic` channel** into `sfx`. Add `traffic` to `VOL_KEYS`
     and its label "Other cars" to `VOL_LABELS`; the settings rows are built
     from `VOL_KEYS`. It defaults to 100, and the existing merge gives old
     saves 100.
   - In the cockpit, the glass muffles it the way it muffles the ambient bed
     (lowpass at about 1.5 kHz, x0.5).
3. **The listener is the camera.** It stands at `CAM.eye` and faces `CAM.fwd`,
   so the cockpit, chase and orbit views each hear from where they look. Its
   velocity is the player's car velocity in every view.
4. **Stereo.** θ is the source's bearing from the listener's facing (0 ahead,
   +90 deg to the right), and `p = 0.8 x sin θ`.
   - Equal-power pan: `L = cos((p + 1) π / 4)`, `R = sin((p + 1) π / 4)`.
   - A car abeam on the right then plays R ≈ 0.99 and L ≈ 0.16: mostly the
     right, a little in the left, as the CD asked.
   - Use explicit L/R gains (a ChannelMerger) so the law can be tested.
5. **Doppler, computed by hand.** Web Audio's PannerNode no longer applies
   Doppler.
   - `f' = f x (c + v_L·û) / (c + v_S·û)`, where c = 343 m/s, û is the unit
     vector from the listener to the car, v_L the listener's velocity and v_S
     the car's (`c.dir x c.v` along its heading).
   - Apply it every frame to the engine oscillators' frequencies and the tyre
     source's `playbackRate`, with a time constant of about 30 ms, so a
     pass-by sweeps rather than steps.
   - Worked case, an oncoming car with both at 25 m/s: x1.157 approaching,
     x0.864 receding, a drop of about five semitones.
   - Worked case, overtaking at 5 m/s relative: under 1.5%.
6. **Level.** Measure it with `SND.rms('traffic')`; never set it by ear. A car
   passing 4 m away at 25 m/s, heard from outside the car, sits at 0.5-1.0x the
   player's engine at a cruise; in the cockpit, about half that.
7. **The paused menu** holds traffic sound as it was, like every other sound.

**Checks.**

- **Stereo.** A car parked 6 m to the listener's right gives a right/left RMS
  ratio of 4-12, measured on a channel splitter with an analyser per side
  (probes `trafficL` and `trafficR`). Mirror it for the left. A car dead ahead
  gives L and R within 10% of each other.
- **Doppler.** For an oncoming car, a receding car and a car at the same speed,
  the voice's applied factor equals the formula within 0.5%. An FFT of the
  traffic channel shows the engine peak moving by the same ratio within 3%.
- **The slider.** "Other cars" at 0 silences the traffic channel and nothing
  else.
- **The pool.** At most 6 voices play, and they belong to the 6 nearest cars.
  No AudioNode is created after unlock over 60 s of heavy traffic (count them
  by wrapping `ac.create*`).
- **Range.** A car beyond 150 m is silent.

**Files:** `index.html` (`SND`, `VOL_KEYS`, `VOL_LABELS`), the suite, and this
file.

### DS-3. Summer, autumn and winter become selectable

Comes after DS-1, which supplies the calendar and the sun and stars from the
date.

**Build.** Remove the `disabled` flags and grow `SEASONS_OPEN`; spring stays
the default. Choosing a season puts the calendar on its middle date, and from
there it runs through that season's dates (DS-1). Each season has one look,
Raleigh as it is through that season, and every part below is *chosen*. An
option the CD may want later, not in this item: let the look follow the
calendar within a season (leaf-out through late March and April, autumn colour
peaking in late October, leaves down by December).

- **Sun, moon, planets and stars come from DS-1's calendar** through zmh-sky's
  `skyAt()`, which works for any date. So DS-3's sky needs no new astronomy: the
  season's dates are the only input. On each season's middle date:

  | Season | Declination | Sunrise | Sunset | Clock | LST0 |
  |---|---|---|---|---|---|
  | Summer | +16.6 deg | 06:26 | 20:14 | EDT | 296.1 deg |
  | Autumn | -16.1 deg | 06:42 | 17:14 | EST | 41.8 deg |
  | Winter | -16.1 deg | 07:12 | 17:45 | EST | 130.5 deg |

  These are NOAA computations for Aug 6, Nov 6 and Feb 4 (declination at local
  noon), recomputed 2026-11-01; the first draft's declinations were 0.3-0.4 deg
  off. Recompute them, don't copy them. A winter evening should then show Orion
  high in the south. Star checks must precess, as DS-1's do. The kit's golden
  vectors also hold astronomy-engine values for Raleigh on 2026-11-01, an autumn
  date.
- **Trees.** The broadleaf species (`oak-1`, `maple-1`, `birch-1`, `sapling-1`
  and the street trees `tree-1`..`tree-3`) change with the season. Conifers
  (`fir-1`, `pine-1`) do not change.
  - Summer: a deeper green.
  - Autumn: maple red-orange, oak russet-brown, birch and street trees yellow,
    varied per tree by a hash so a forest is never one colour.
  - Winter: bare. A trunk and a few branch limbs replace the canopy blobs; this
    is new geometry, and the colliders keep the trunk.
  - Bushes: green in spring and summer, browner in autumn, thin in winter.
- **Grass and verges** (`grassColor()`).
  - Spring: fresh green.
  - Summer: deeper green, a little dry.
  - Autumn: tan-green.
  - Winter: dormant straw-brown. Raleigh's warm-season lawns go dormant.
  - No snow. Raleigh sees only a few snow days a year, and snow would be a
    weather item.
- **Ambient** (`bird()`, `cricket()`).
  - Summer: cicadas by day, katydids at night, louder.
  - Autumn: crickets, and fewer birds.
  - Winter: a few birds and no insects.
- **Switching season** rebuilds the loaded chunks, because their meshes bake
  colour in. Do it the way `teleport()` rebuilds, keeping the player's `s` and
  `u` and the traffic.

**Checks.**

- Each season is selectable and is saved.
- Each season's sunrise and sunset are within 10 min of the NOAA computation.
- Each season shows its own sky, for example winter at 22:00 against the
  suite's own alt/az for Betelgeuse and Rigel.
- A sampled broadleaf canopy's colour falls in that season's hue band; a winter
  broadleaf tree has no canopy vertices; conifers are identical in every season.
- Grass hue falls in each season's band.
- No insect sound in winter.
- The player's `s` and `u` are unchanged across a switch.
- Spring stays exactly as shipped: the same vertex hash for the same chunks.

**Files:** `index.html` (the season table, the settings handler,
`buildChunk()` and the tree builders, `grassColor()`, the ambient functions),
the suite, and this file.

### DS-4. The sun and the moon as they really look

Comes after DS-1. DS-1 already puts the sun and the moon where they really are,
from zmh-sky's `skyAt()` (revised 2026-11-02; the CD chose to bring the moon's
place into DS-1). DS-4 is what they look like and how they light the scene, and
the kit supplies nearly all of it.

**Today, traced 2026-11-01** (before DS-1).
- `updateSky()` sets `SKY.moon = celestial(H + 12.8, -DECL * 0.6)`. That keeps
  the moon roughly opposite the sun, so it is near full every night and never
  in the day sky. DS-1 replaces this with the real moon.
- `skyCol()` draws the moon as an evenly lit disc with no phase, multiplied by
  `uNight`, so it vanishes by day.
- Moonlight (`SKY.moonCol`) follows the moon's altitude only.
- The sun's disc (`smoothstep(0.99985, 0.99993, cs)`) is about 1.4-2 deg
  across, roughly three times the real 0.53 deg.
- Neither body is lifted by refraction at the horizon.

**Build.**

1. **The sun** is `skyAt().sun` after DS-1, checked through the whole day and
   not just at noon. May 5, computed 2026-11-01:

   | Time (EDT) | Altitude | Azimuth |
   |---|---|---|
   | 06:18 sunrise | -0.8 | 69 (east-north-east) |
   | 09:00 | 31.3 | 92 |
   | 13:11 solar noon | 70.6 | 180 |
   | 17:00 | 36.0 | 265 |
   | 20:05 sunset | -0.8 | 291 (west-north-west) |

   (Recomputed 2026-11-01 with declination +16.4; the first draft used +16.0
   and was about 0.3 deg low.) Noon altitude is 90 - 35.78 + declination: 77.7
   deg at the June solstice and 54.2 deg at the March equinox.
2. **Refraction.** Draw both bodies lifted by `ZMH_SKY.refractionDeg(alt)`
   (Bennett's formula, about 34' at the horizon); the kit leaves it off by
   default, so the host adds it. Sunrise and sunset then happen when the
   geometric centre is at -0.833 deg, as almanacs define them.
3. **Real sizes.** The sun's disc is 0.53 deg and the moon's 0.49-0.56 deg,
   varying with its distance (`skyAt().moon.topoDistanceKm`); a soft edge of a
   few pixels hides the aliasing. *Chosen*. If they read too small on a phone, a
   minimum size in pixels is the lever.
4. **The moon's position** is done in DS-1 (`skyAt().moon`, the full Meeus ch.
   47 series with topocentric parallax). Add refraction (item 2) only.
5. **Phase.** Use the kit's `MOON_DISC_GLSL` (`zmhMoonDisc(viewDir, moonDir,
   sunDir, angularRadius, earthshine)`). It draws a lit sphere shaded from
   `skyAt().sun`, so the terminator, the lit fraction and the crescent's tilt all
   come out right with no special cases, and the bright limb faces the sun.
   - Keep its coverage gate. The kit found a dashed line 90 deg from the moon
     without it.
   - Pass the one sun from DS-1, never a second one.
   - Faint earthshine on the dark part of a crescent: `earthshineFraction()`,
     or a multiple of it (*chosen*).
     If DS-6 has landed, add its **Earthshine** slider row here (DS-6, 2026-11-02).
   - A few soft, low-frequency darker patches (the maria), fixed to the face
     the moon always turns toward Earth (*chosen*). The kit has none, so this is
     the page's own.
6. **Moonlight.** `SKY.moonCol` and the night ambient scale with the kit's
   `moonIlluminanceLux(phaseAngleDeg, altDeg)` (or `moonPhaseFactor`) as well as
   the moon's altitude. The exposure keeps a full-moon night clearly brighter than
   a moonless one, and both clearly night. Moon shadows are not in this item
   (the shadow map runs by day only).
7. **The moon by day.** Draw it whenever it is above the horizon, as added
   light rather than multiplied by `uNight`, so it shows as a pale disc
   against a blue sky.
8. **A bright moon dims the stars.** A faint glow round the moon grows with
   the phase, and DS-1's star pass and Milky Way fade by the sky's brightness, so
   a full moon washes out the faintest stars and the band (*chosen*).

**Checks.** Each is its own row and each is negative-tested.

- **Sun.** Altitude and azimuth match the suite's own sun within 0.2 deg at five
  times of day on three dates. Sunrise and sunset fall within 2 min of its
  times, with refraction.
- **Moon position and anchors** are DS-1's rows. Here, refraction: a body is drawn
  `refractionDeg(geometric altitude)` higher than its geometric place, 0.48 deg at a true
  altitude of 0 (corrected 2026-11-02: the kit's formula takes the true altitude; the first
  draft's 0.57 deg, 34', is the refraction at apparent altitude 0).
- **Phase.** At the Meeus mean phases (ch. 49, each within a day), the lit
  fraction is over 0.97 at full (2026-05-01, 2026-05-31) and under 0.03 at new
  (2026-05-16), and 0.5 +/- 0.05 at the last quarter (about 2026-05-09).
  astronomy-engine's 0.835 at 2026-05-06 02:00 UT (golden record
  `2026-05-06T02Z/geo/moon`) is a fixed point.
- **The cycle.** Over 30 game days the phase runs new to full to new once, and
  the moon rises on average about 50 min later each day (30-70 min).
- **The bright limb faces the sun.** Through a test hook that draws the moon
  alone, the centroid of its lit pixels lies toward the sun's projected
  direction within 15 deg.
- **Pixels.**
  - With the moon above the horizon by day, its disc is brighter than the sky
    around it.
  - A full-moon midnight is brighter than a new-moon midnight (mean luminance
    ratio over 1.5), and both are darker than dusk.
  - The drawn sun disc spans 0.53 deg at the current field of view, within 20%.
  - No stray pixels away from the moon's disc (the kit's coverage gate kept).

**Files:** `index.html` (`updateSky()`, `skyCol()` or the sky shader's moon and
sun discs, the moonlight and exposure terms, the star pass's and Milky Way's
fade, a test hook), the suite, and this file. The `ZMH-SKY` block already
carries `MOON_DISC_GLSL` (DS-1 splices with `glsl`).

### The CD's first playtest of the real sky (2026-11-02), verbatim

> Add backlog items for driving sim for the following:
>
> * in game the stars are too dim, increase brightness
> * Add sliders in the settings menu for each celestial object (stars, milky way, sun, moon (sunshine), moon (earthshine), any others i missed)
>
> * Sun rise, sun set, moon rise, and moon set all show a vertical smearing at the horizon. Im attaching some screenshots to show what i see

The screenshots (badge `build 2026-11-02 12:27 UTC`, an iPhone, chase view): at
7:50-7:57 PM a bright column at the sun's place runs from the hilltops down
through the grass and over the car to the bottom of the screen; at 3:29 and 3:41 AM
a paler column does the same under the rising moon. DS-5 to DS-7 are in `TODO.md`
§ Now. DS-7 is a bug fix; DS-5 and DS-6 share `STAR_GAIN`, so DS-6 goes after DS-5.

**Plans (2026-11-02).** DS-7, DS-5, DS-4 and DS-6 are one seven-step arc,
`.claude/plans/dssky.horizon-stars-moon-sliders.md` (in that order; DS-7 and DS-5 land on
`main` at step 2; DS-6 goes after DS-4 so its Earthshine row exists). DS-2 is
`.claude/plans/dssound.traffic-stereo-doppler.md`, run after the arc. DS-3 is not planned yet:
re-sweep once both have landed.

### DS-5. Brighter stars

**Today** (`index.html`, read 2026-11-02). The star pass draws zmh-sky's
`starAppearance` law (intensity `10^(-0.4 * 0.5 * (m + 1.46))`, Sirius = 1;
0.2 mag of extinction per air mass; 1-4 px) after the tonemap, scaled by one
constant, `STAR_GAIN = 3.2`, times `SKY.exposure * SKY.night`
(`uStarK`). Points are sized in framebuffer pixels times `uPx = RSCALE`, the
main pass's render scale. Step 3 of DS-1 set 3.2 in SwiftShader at 844x390,
where Spica peaked at luminance 209; nobody had looked at a phone. The kit's
point profile is under 0.4 px wide for faint stars, which DS-1 floored at
0.5 px (the zmh-sky report below).

**Build.**
1. **Measure first, on the phone's numbers.** At the iPhone 13 viewport and
   the render scale the page picks there (`DPR` capped at 2, then the graphics
   setting), read back the peak luminance of five reference stars at 22:00 on
   May 5 (Arcturus 0.0, Vega 0.0, Regulus 1.4, Polaris 2.0, and one star of
   magnitude 3.0-3.5 picked from `SKY_DATA` and cited by HIP) and the count of stars above a visible threshold
   in a fixed patch. Record them in this file. The cause of "too dim" is not
   traced; candidates to measure, not assume: the gain, points sized in
   framebuffer pixels on a 2x screen (physically half the size), and the
   additive pass landing after the tonemap.
2. **Raise the default** so that, at the phone's render scale, a mag-2 star
   (Polaris) reads clearly white and a mag-4 star is plainly visible against
   Raleigh's night sky (*chosen*: Polaris peak >= 200, mag 4 >= 60 in 8-bit
   luminance above the sky). If the measure shows the point size, not the
   gain, is short, size points in CSS pixels (`uPx` times `DPR`) instead of
   raising the gain past the clamp, and say which in the results.
3. Keep the kit's law and the 2.5 clamp, so Venus stays a point, not a flare.
   Keep the Milky Way's `MW_GAIN` as is (DS-6 gives it a slider).

**Checks.** The step-3 star rows stay green, restated where a threshold was
tied to 3.2. New: the five reference stars' peaks and the patch count at the
phone viewport meet item 2; a break that halves the gain fails it.

**Files:** `index.html` (`STAR_GAIN` and maybe `uPx`), the suite, this file.

**Measured and built (dssky step 2, 2026-11-02).** Measured in a second browser context at the
phone's numbers: 844x390 CSS px at `deviceScaleFactor` 3, so the page reads DPR 2 and RSCALE 1.7
(1435x663 framebuffer), 22:00 EDT on May 5, `SKY.night` 1, `SKY.exposure` 1.8. The camera stood 30 m
above the car with a 0.8-rad field of view, aimed so that the star's centre landed exactly at the
framebuffer point (717 + o, 331 + o) for o = 0, 1/4, 1/2 and 3/4 (1/2 is a pixel corner). The figure
is what the star adds at its brightest pixel: STARS on minus STARS off, 8-bit luminance, over a sky of
14-27. The fifth star is Megrez (HIP 59774, V 3.32) and the magnitude-4 star iota Leonis (HIP 55642, V 4.00),
both from `SKY_DATA`. The patch is 200x100 CSS px (340x170 framebuffer) centred on Polaris, counting
the local maxima of the difference at 40 or more.

| star (HIP, V, altitude) | before: 3.2, floor 0.5 fb px (min) | floor 0.5 CSS px, 3.2 (min) | after: floor 0.5 CSS px, 4.0 (min) |
| - | - | - | - |
| Arcturus (69673, -0.05, 52.0) | 239 / 239 / 236 / 239 (236) | 239 / 239 / 238 / 239 (238) | 239 / 239 / 239 / 239 (239) |
| Vega (91262, 0.03, 12.2) | 229 / 229 / 164 / 229 (164) | 229 / 229 / 223 / 229 (223) | 229 / 229 / 229 / 229 (229) |
| Regulus (49669, 1.36, 58.4) | 226 / 183 / 94 / 183 (94) | 226 / 209 / 165 / 209 (165) | 240 / 236 / 201 / 236 (201) |
| Polaris (11767, 1.97, 35.4) | 230 / 182 / 86 / 182 (**86**) | 230 / 215 / 166 / 215 (166) | 236 / 236 / 207 / 236 (**207**) |
| Megrez (59774, 3.32, 68.1) | 108 / 84 / 39 / 84 (39) | 108 / 99 / 76 / 99 (76) | 135 / 124 / 95 / 124 (95) |
| iota Leo (55642, 4.00, 64.3) | 100 / 78 / 37 / 78 (**37**) | 100 / 91 / 71 / 91 (71) | 125 / 115 / 88 / 115 (**88**) |
| patch round Polaris, stars at 40+ | 3 | 7 | 9 |

The stars did NOT meet the targets at the phone's numbers, so the escalation trigger did not fire.
The cause, now traced to pixels: **the sub-pixel phase, then the gain.** With sigma floored at 0.5 framebuffer px
(0.29 CSS px at RSCALE 1.7), a faint star's brightest pixel fell to 37% of its centre whenever
the centre sat on a pixel corner. Polaris added 230 on a pixel centre and 86 on a corner. The
plan's "points sized in framebuffer pixels" stays ruled out (`uPx` already sized them). **Levers used,
in the plan's order:** (1) the sigma floor in CSS pixels, half a CSS pixel and never under half a
framebuffer pixel (the "Assumed" table says why); that alone brought Polaris's worst phase from 86 to
166, and the mag-4 star's from 37 to 71. (2) `STAR_GAIN` from 3.2 to 4.0 for the rest. At the suite's own
scale-1 context (RSCALE 0.85, so the floor is unchanged there) the gain alone moved Polaris's worst
phase from 86 to 108 and iota Leo's from 37 to 46. Rows: "at the phone's render scale (RSCALE 1.7)
Polaris adds at least 200 and a magnitude-4 star at least 60 at every sub-pixel phase" and "the
patch round Polaris holds at least 7 stars that add 40 or more" (9 measured, less 20%). Both are red on
the step-1 page, and the first is red with either lever alone. Restated: "the sky above the ridge is
unchanged by the split" now takes its frames with the star pass off, because its two night frames held
the stars. Its stars-off values were recorded on the same pre-split page.

### DS-6. A slider for each thing in the sky

**Build.** A **SKY** section in the settings, after TIME, with one slider per
object, 0-200%, default 100% (today's look), saved as new fields of the same
`drivingSimulator.settings.v1` object (never a new key; an old save without
them reads 100%):

| Slider | Scales (*chosen*) |
|---|---|
| Stars | the star pass's gain for the stars (`STAR_GAIN`) |
| Planets | the five planet vertices' gain, separately from the stars |
| Milky Way | `MW_GAIN` |
| Sun | the sun's disc and glow in `skyCol()`, and its light on the scene (`SKY.sunCol`) |
| Moonlight | the moon's disc and glow, and its light on the scene (`SKY.moonCol`), i.e. sunshine off the moon |
| Earthshine | the earthshine on the moon's dark part; **comes with DS-4**, which adds earthshine; until then the row is not drawn |

- One slider scales how bright the thing looks **and** the light it casts
  (*chosen*). If the CD wants those apart (a bright sun disc with a dim day),
  that is a second row each, a plan-review call.
- Others the CD may want, not built unless asked: the twilight sky glow, and
  the night sky's light-pollution glow (both are the page's own colours, not
  the kit's).
- 0% removes the thing (its pass or term is skipped, so 0% also costs nothing).
- The rows use the existing range-row markup (`.row` + `type="range"`, as the
  volume rows do) and must fit at 320 px wide.

**Checks.** Per slider: 0% removes its pixels (the star, planet, Milky Way, sun
disc and moon disc rows of DS-1, run at 0%, find nothing) and 200% doubles its
measured contribution within 10%; the settings round-trip a reload; an old save
reads 100% everywhere; the sky's day pixels are byte-identical at 100% to
before. **Files:** `index.html` (the settings markup, `SETTINGS`, the gains'
uniforms), the suite, this file.

### DS-7. No column of light under a rising or setting sun or moon (bug)

**Cause, traced in the code 2026-11-02** (not yet reproduced in a render; the
plan's first step does that). Three places sample `skyCol()` with the
direction's elevation **clamped to a constant**, and `skyCol()` includes the sun
disc (`smoothstep(0.99985, 0.99993, cs) * 30.0` plus two glow lobes) and the
moon disc:
- the world's fog colour, `skyCol(normalize(vec3(-V.x, max(-V.y, 0.0) * 0.4 + 0.02, -V.z)))`
  (`FS_WORLD`, about line 2351): every fragment below the horizon gets the sky
  at elevation 0.02 rad (1.15 deg) and its own azimuth;
- the distant hills, `skyCol(normalize(vec3(d.x, 0.02, d.z)))` (`FS_SKY`, about
  line 2382);
- paint reflections, `R.y` clamped at -0.05 (about line 2343).

So when the sun or the moon stands within about a degree of 1.15 deg altitude,
every hill, grass, road, tree and car fragment at its azimuth gets the disc
(times 30 for the sun) in its fog colour: a column as wide as the disc, from
the horizon to the bottom of the screen, over everything, faded only by the fog
factor. That is the screenshots' shape, and it explains why it shows only at
rise and set. Both lines date from the game's first commit (`15ad39d`), so it
predates DS-1; DS-1's real rise and set times made it easy to see.

**Fix (*chosen*).** Split the sky colour from the bodies: `skyBase(d)` (the
gradient, the sunset tint and the broad glow that colours the haze) and the
discs added only where the direction is the real view ray (the sky pass's own
`d`). Fog, hills and reflections call `skyBase()`. Keep the wide sunset glow in
the haze: a warm horizon toward the sun is right; a disc in it is not.

**Checks.** At sunset (sun altitude 1.0 deg) and moonrise (moon 1.0 deg), chase
view facing the body, the column of pixels below the horizon at the body's
projected x is no brighter than the columns 10 deg either side (within the
noise of the scene); the disc above the horizon is still drawn; a break that
puts the disc back in the fog colour fails the row. The sky's pixels above the
ridge stay byte-identical. **Files:** `index.html` (`GLSL_COMMON`, `FS_SKY`,
`FS_WORLD`), the suite, this file.

**Also seen in the night screenshots, not asked about:** faint concentric rings
in the dark sky. Hypothesis, not traced: 8-bit banding of the night gradient,
which a little dither in the sky pass would hide. Noted here, not planned.

## Follow-ups not yet done

- **Trees have not had a tree-expert review.** zmhstudio's `tree-expert` agent
  is meant to see any tree render a human should find realistic; the trees here
  are the town kit's species drawn as low-poly blobs and cones (conifers by id:
  `fir-1`, `pine-1`), with a ragged treeline sheet for distant forest. Run it on
  a forest shot (`teleport(400)`, chase view) before tuning the foliage.

## Architecture (one file, banner-commented sections)

- **Kits.** `ROAD_KIT` and `TOWN_KIT` live between `/*KITS:BEGIN*/` and
  `/*KITS:END*/` and are written only by `games/driving-simulator/build-kits.mjs`
  (regeneration commands are in its header). `ROAD_KIT` is zmh-3d's
  `road-spec/v1` whole: six vehicles with real proportions and a lofted
  side-elevation profile, the paint mix, the MUTCD standard. `TOWN_KIT` is
  zmh-3d's `scenery-spec/v1` town kit reduced to what a roadside needs
  (buildings without furniture, street trees, forest species, bushes, boulders,
  recipe colours). Python owns WHAT; this page owns HOW (meshing, materials,
  placement). Never hand-edit the block.
- **The sky kit.** `ZMH_SKY` (zmh-sky's whole library), `SKY_DATA` (1,627
  stars to mag 5 as `{ fields: ['hip', 'ra', 'dec', 'mag', 'bv'], rows }`, and
  the planets' elements) and `ZMH_SKY_GLSL` live between `/*ZMH-SKY:BEGIN*/`
  and `/*ZMH-SKY:END*/`, right after the KITS block. The kit's CLI writes it;
  never hand-edit it. To regenerate, from the repo root:
  `node <zmhstudio>/plugins/zmh-sky/cli/zmh-sky.mjs splice --page games/driving-simulator/index.html --mag 5 --parts stars,planets,glsl`
  (it prints `ZMH-SKY=<page> bytes=98547 stars=1627`; a second run leaves the
  page byte-identical). The attribution is `#sky-notes` in THE ROAD notes and
  `LICENSE-d3-celestial.txt` beside the page.
- **The calendar.** The date is an integer MJD, `SKY.mjd` (`SKY.day` is the
  daylight factor). `mjdOf()`, `civilOf()`, `weekday()` and `dateText()` are pure
  arithmetic, with no `Date` objects: the player's time zone is not Raleigh's.
  `SEASON_DATES` holds each season's `[first, last, middle]`. `advanceClock()`
  steps the date at each midnight through `nextDate()` (wrapping at the season's
  end, saving `SETTINGS.date`) and changes the clock at 02:00 on the DST days;
  `SKY.dst` is state, re-derived by `utcOffset(mjd, hour)` only at boot, a date
  step, `setDate()` and the time-of-day slider. `julianDate()` is the one Julian
  date (UT): `2400000.5 + SKY.mjd + (SKY.hour - offset) / 24`. Never pass it to
  GLSL.
- **The sky.** `updateSky()` calls `ZMH_SKY.skyAt(julianDate(), OBS_SKY,
  SKY_DATA.planets)` once. **One sun**: `SKY.sun` is its `sun.enu`, and the light,
  the sun disc and the shadows all use it; nothing else in the page computes a
  sun. `SKY.moon` is the topocentric moon (its look and light are still the old
  ones until DS-4), `SKY.moonPhase` is kept for DS-4, `SKY.lst` is the kit's LST,
  and `SKY.planets` holds the five naked-eye planets. **The star matrix**
  `SKY.starM` is the kit's `starMatrix`: J2000 to ENU, precession included,
  flat row-major, determinant -1 (ENU is left-handed). It is uploaded with
  `uniformMatrix3fv(loc, true, ...)` (transpose = true). **The world frame** is
  (east, up, south), because `M4.look` is an OpenGL lookAt (facing +z, +x is on
  the screen's left). So `SKY.*` stay ENU, exactly as the kit gives them, and the
  GPU gets `SKY.sunW` and `SKY.moonW` (`enuToWorld(v) = [v[0], v[1], -v[2]]`) and
  `SKY.starW` (`starM` with its third row negated).
- **The star pass** (`VS_STARS` / `FS_STARS`, `PRG.stars`), one `gl.POINTS`
  draw right after the sky in `renderScene()`, so the mirror gets it too (with
  `uPx` 1 there and `RSCALE` in the main pass). The VAO (`initStars()`) holds 7
  floats a vertex: the J2000 unit vector, the magnitude and the `bvToRGB`
  colour; 1,627 stars, then the five planets in `PLANET_IDS` order. The
  planets' vertices are rewritten by `writePlanets()` on every `updateSky()`:
  each planet's ENU direction taken back to J2000 through `transpose(starM)`, so
  the shader lands it exactly on `p.enu`, and `bufferSubData`'d. The kit's law:
  gamma 0.5 on flux about Sirius, 0.2 mag per Kasten-Young air mass, 1-4 px.
  Additive (`ONE, ONE`) after the sky's tonemap, depth test off, blend off
  afterwards; skipped when `SKY.night <= 0` or `STARS.on` is false; gain
  `uStarK = STAR_GAIN * exposure * night`. The hills are not geometry, so
  `FS_STARS` discards below the same `ridgeY()` the sky shader draws them with.
- **The Milky Way** is the kit's `MILKY_WAY_GLSL` in `FS_SKY` only (not
  `GLSL_COMMON`, so the fog and the paint reflections stay without it): above the
  ridge, only when `uNight > 0` and `uMwGain > 0` (`MW.on`), it adds
  `MW_GAIN * zmhMilkyWay(transpose(uStarM) * d) * MILKY_WAY_RGB * night` before
  the tonemap. The day sky's pixels are byte-identical with it on or off.
- **The hash stars are gone** (`uStarRot` and the hash in `skyCol()`), so there
  are no stars in the fog or in paint reflections any more. That is intended.
- **The road** is a pure function of `WORLD_SEED` and `s` (distance along it).
  `extendPlan()` appends straights, 70 m spirals and arcs (radius 380-1500 m);
  the next curve's sign is biased back toward heading 0 and capped at |1.3 rad|,
  so the road can never turn back on itself (asserted to 60 km). Elevation is
  three sines (grades < 8%). `extendSections()` appends road classes;
  `crossAt(s)` gives lanes per direction (fractional inside a taper), shoulder,
  kerb flag and how much terrain may rise beside the road. `at(s)` is the
  interpolated sample everything reads; `worldAt(p, u)` maps (s, u) to the
  world with **u > 0 to the right of +s**; `groundAt()` is the one height
  function the mesh, the car and the cameras all use, so they can never
  disagree; `project(x, z, hint)` is the inverse.
- **Chunks** are 96 m of road plus everything beside it, built by `buildChunk()`
  into two meshes: `base` (road, verge, 255 m of terrain each side, the distant
  treeline ribbon; always drawn) and `props` (trees, buildings, driveways,
  streetlights, signs; drawn inside the graphics setting's props distance).
  Buildings sit on a **global lot grid** keyed by s, so neighbouring chunks never
  overlap. Each chunk also carries its colliders (circles and boxes), its
  streetlight lamp positions and its glow sprites. One chunk is built per frame
  (~5-13 ms); 3 behind and 12 ahead are kept.
- **Signs** are derived from the sections by `ensureSigns()` (speed limit each
  way, W4-2 "lane ends" 160 m before every drop in each direction), drawn from a
  canvas atlas.
- **Camera-relative rendering.** Every mesh is stored relative to its own anchor
  and drawn with `translate(anchor - eye)`, with the view at the origin, so a car
  100 km down the road keeps centimetre precision. Shader noise takes
  `uCamWrap` (eye mod 4096) and its hash is periodic in 4096, so the pattern
  never jumps.
- **One world shader** (`FS_WORLD`) branches on a per-vertex material id
  (`MAT`): asphalt with every MUTCD marking computed from (s, u, lanes)
  (dashes on the 40 ft cycle, double yellow, lane lines that appear with a
  taper's new lane, edge lines, rumble strips on wide shoulders, darker wheel
  paths, retroreflection under headlights), grass, walls with a window grid
  (lit at night per window), roofs, bark, foliage (wind sway), paint (clearcoat
  reflection of the sky), glass, rubber, rims, lamps, cabin trim, the gauge
  texture and the mirror texture. Lighting: sun or moon with a 4-tap PCF shadow
  map (texel-snapped, ~150 m box), hemisphere ambient, up to 16 local lights
  (our two headlights, the five nearest cars' headlights, the nearest
  streetlights), exponential fog toward the sky's horizon colour, ACES tonemap.
  The sky shader draws the gradient, sun, moon, the Milky Way and a hazed
  ridge at infinity; the stars are their own pass (below).
- **Vehicles** (`buildVehicle`) loft the kit's profile: a 7-point ring per
  station, glazing where the kit says `belt < top` (side glass where both
  stations are glazed; a steep top segment under a glazed roof is a windscreen
  or back light), wheel arches, lamps placed where the body surface actually is
  at the lamp's height (`surfZ`; the first draft searched for the first tall
  enough station and buried every lamp inside the body), grille, plates,
  mirrors, and five-spoke wheels drawn separately so they spin and steer.
- **The cabin** (`buildCabin`, player only) is built in the same frame from the
  same profile: dashboard, instrument cluster (a canvas texture redrawn every
  other frame: rev counter, speedometer, gear, clock), visor, centre stack,
  L-section A-pillars from the cowl to the windscreen header, headliner, door
  cards and sills, B-pillars, console, passenger seat, a turning steering wheel
  and a rear-view mirror whose glass shows a second camera (320x96 FBO, every
  other frame, no shadows; its texture is already tonemapped, so the shader
  passes it straight through).
- **The car** (`stepPlayer`): a dynamic bicycle model with linear tyres clamped
  at the friction limit, a kinematic blend below 2 m/s, front-drive traction
  (55% of weight), power at the wheels, drag, rolling resistance, engine
  braking and grade. Reverse: hold the brake for 1 s at 0 mph. Cruise control
  feeds the same throttle and brake (see the second brief). Ground
  following samples four contact patches; body pitch and roll ride a spring on
  the accelerations. Collisions: SAT against building boxes and traffic, circle
  vs box against trunks, poles and sign posts.
- **Traffic** (`stepTraffic`) lives in road coordinates (s, lane, dir). IDM car
  following (the player counts as a leader when in that lane, including head-on
  in the oncoming lane), a mandatory merge when the lane ends within 300 m,
  passing on the left and keeping right, kept populated in a 380 m behind /
  1050 m ahead window at the traffic setting's density.
- **Input**: touch events (never pointer events) with per-finger roles: the
  wheel rim (turned by angle, springs back on release, 135 deg = full lock),
  the hub (horn), the two pedals, anything else = look round (cockpit) or orbit
  and pinch (orbit view), and the cruise button. Keyboard: arrows/WASD,
  Space, H, C, X (cruise), Esc (close the menu).
- **Sound**: engine (two saws and a square through a throttle-opened lowpass,
  four-cylinder firing frequency from the gearbox's rpm), tyre and wind noise,
  skid squeal, crash, horn, an ambient bed; the radio's four stations on the
  music bus. Every sound has its own channel gain (a slider each) and an
  analyser: `SND.rms(name)` reads `sfx`, `music` or any channel. Muffled in the
  cockpit.
- **Settings** (cog): day length (24 s / 1 min / **2.4 min** / 10 min / 24 min /
  1 h / real time / stopped), time of day, traffic, units, graphics
  (resolution scale, shadows, props distance), mirror, performance stats, the
  season (spring only so far; the rest listed, greyed out: backlog DS-3), the
  radio station, all sound and a slider per sound, and the how-to and road
  notes. Opening it pauses the game. Persisted in `drivingSimulator.settings.v1`.
- **Performance stats** (`PERF`): see the second brief. The draw-call counter
  wraps `gl.drawElements` / `drawArrays` / their instanced forms once at boot.

## Testing

`window.__DS` exposes the sim; `__DS.setPaused(true)` stops the live loop and
`__DS.tick(dt)` steps it, so the suite's numbers are deterministic.
`__DS.teleport(s)` rebuilds the world anywhere along the road. The suite covers
the kits, the road invariants (classes, one-lane steps, MUTCD tapers,
continuous lane counts, no doubling back, curvature, grades, signs before every
lane drop in each direction), the clock (144 s = 24 h, other lengths, stopped,
sun times), the car against real figures (0-60, braking, steering sense,
reverse after a full second at 0 mph, a steady reverse turn with no spin),
cruise control (takes the speed, holds it within 0.3 m/s for 90 s of real
grades, the accelerator overrides and it settles back, the brake and a
standstill), collisions (trees, a car ahead), traffic discipline through a lane
drop (own side, no overlaps, merges before the taper, lane changes happen),
head-on stopping, two-finger touch on the wheel and pedals, the horn, the view
cycle, settings, the cruise button tapped by a second finger while the first
holds the accelerator, the menu pausing the car, traffic and clock (and Esc
resuming), a seven-size layout sweep (cruise button, FPS and the stats block
included, pedal and button touch pads padded), day vs night pixels, the audio
levels per channel (radio and engine sliders silence only their own channel, the
squared taper, a slider's preview, four level-matched stations) and the
performance stats off pixels (pure green FPS, the block, the three settings).
Negative-tested 2026-11-01: removing lane-ends signs, the merge, the
player-as-leader rule or halving the clock each turns rows red. The second
brief's rows were negative-tested the same day with eleven marked breaks in one
run (the yaw sign back, a 0.6 s hold, cruise without its throttle, no menu
pause, the engine channel deaf to its slider, untrimmed stations, a neon rather
than pure green FPS, no cruise touch role, the block shown with FPS only, no
horn preview, no Esc): 14 rows red, each break caught by its own row.

**The sky (DS-1, 31 rows: 30 new and the restated sunrise row).** The calendar (section 3b): the first visit, the
midnight step, the wrap, the saved date, `utcOffset`, the 02:00 changes, the sun
from the date, the Date row; the restated sunrise and sunset row (section 3).
The kit (3c): the block and its attribution, one sun, the moon, the planets.
The stars (3d): LST, the pole of date, Polaris, the nine stars circling it,
Dubhe and Arcturus, the 22:00 sky, stars moving west. The star pass (8b): one
POINTS draw per pass, Jupiter's pixel, star pixels at midnight, none at noon,
none with the pass off, the Milky Way at one crossing, then (step 4) the Milky
Way all round the sky, a star behind the hills, the planets' vertices on the GPU,
the sun drawn where it is, and the stars fading with the night.

The oracles are never the page's or the kit's code. The suite has its own
Astronomical Almanac sun, Meeus 12.4 GMST, Meeus 21.2-21.4 precession, Meeus
49.1 mean phases, SIMBAD J2000 positions typed in sexagesimal, the IAU galactic
pole, and its own (east, up, south) map and OpenGL-convention projection. It
also types in astronomy-engine's values from zmh-sky's `vectors/golden.v1.json`,
by record id: `2026-05-06T02Z/raleigh/sun`, `.../raleigh/moon`,
`.../geo/moon` (lit fraction), `.../geo/ven`, `.../geo/jup` and
`.../raleigh/hip<N>` for the eight stars of the 22:00 table.

**The break list** (`.claude/tests/negtests/driving-simulator.json`, 25 breaks,
run whole on copies 2026-11-02 with `negtest-copies.py --jobs 2` in `--only`
pairs): every break caught by the row meant for it. Five were missed at first
(or caught only by a sound row, which is no catch) and each got a row:
the star matrix uploaded without transpose to the Milky Way (the one-crossing
row passed: the wrong frame put that patch at b = -6, still on the band), the
planets' GPU buffer left at boot (Jupiter moves under a pixel between 13:00 and
22:00), the ridge test removed, the stars' gain without the night (a twilight
change only), and the sun's world flip removed (caught by the one-crossing
Milky Way row only through the mirrored moon's glow, so it got its own row).
Each `row` field in the list names the row meant to see it.

**A known flake (untraced hypothesis):** under machine load (two suites at
once, or the gates beside a break run) the sound rows (the engine and radio
levels, the engine slider, the four stations within 25%) and the perf block's
row (FPS 0) can go red. They measure over wall-clock time. A break "caught"
only by one of them is not caught. Run the gates alone.

Screenshots for review: `.claude/scripts/shot-page.cjs` with the test hook, for example
`node .claude/scripts/shot-page.cjs games/driving-simulator/index.html /tmp/x.png w=844 h=390 wait=4000 eval="__DS.SETTINGS.cycle=0;__DS.SKY.hour=20.5;__DS.teleport(10600);__DS.CAM.mode=0"`
(sections at the default seed: forest 2-lane from the start, 4-lane from ~1.1 km,
6-lane ~2.5-4 km, suburb 4-lane ~6.8 km, town ~10.2 km). Lessons that transfer:
`.claude/notes/20261101-a-realistic-webgl2-scene-in-one-file.md`. Software rendering is slow
(300-800 ms a frame), so it says nothing about phone frame rate.

## Measured (2026-11-01)

- **The sky's frame cost (2026-11-02, SwiftShader, 22:00 on May 5).** Per frame,
  paused, 844x390: chase 74 draw calls with the stars and the Milky Way, 74 with
  the stars only, 73 with both off; cockpit 132 / 132 / 130 (the star pass runs
  in the mirror too); triangles unchanged (187,151 chase, 282,584 cockpit:
  `triCount` gives 0 for POINTS); the Milky Way adds no call (it is inside the
  sky's draw). `renderFrame()` CPU time 0.1-0.3 ms each way. `frame-budget.cjs
  swiftshader=1` (390x844 at dpr 3): median 883 / 900 / 883 ms the three ways,
  equal within noise. SwiftShader has no GPU timer and says how the renderer
  behaves with no GPU at all, not a phone's frame rate.

- Simulation (`tick`) median < 0.1 ms, p95 0.2 ms; worst 13 ms on a frame that
  builds a town chunk.
- Audio: engine RMS ~0.04 idle, ~0.06 cruising, ~0.08 full throttle; radio ~0.5-0.75x
  the engine at half throttle, about 1.1x at a light cruise. The four stations
  measured 0.0515 / 0.0569 / 0.0372 / 0.0335 untrimmed (a 1.7x spread); trimmed
  1.0 / 0.9 / 1.38 / 1.54 they sit at 0.049-0.054. Ambient, outside at noon:
  0.006 (0.14x the engine); at night 0.004; in the cockpit at idle 0.003.
- Cruise control on a straight holds the set speed to the last digit (the
  feed-forward is the car's own force model); over 90 s of real grades within
  0.3 m/s.

## How to add...

- **A road class**: a row in zmh-3d's `road_gen._standard()` (and
  `road_spec.ROAD_CLASS_NAMES`), regenerate, then a `SECT_LEN` and `ENV_OF` entry
  here and its place in `extendSections()`'s neighbour rule.
- **A vehicle kind**: a base in zmh-3d's `road_gen._BASES` (+ `VEHICLE_KINDS`,
  `VEHICLE_DIMS`), regenerate, then a weight in `KIND_W`.
- **An environment**: an `ENV_W` weight, a `treeCfg` row, lot rules in
  `buildChunk()`, and a `grassColor()` branch.
