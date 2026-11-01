# Driving Simulator (`games/driving-simulator/`)

An endless two-way US road you drive in WebGL2, from the driver's seat or from
outside the car. CD commission, 2026-11-01, placed on the hub straight after
Animation Rigs. Open licence (MIT, the default). Suite:
`.claude/tests/drive-driving-simulator.cjs` (78 checks).

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
| Sun | Latitude 36 N, declination 15 deg, solar noon at 1 pm (summer time): sunrise ~6:15 am, sunset ~7:45 pm | A US summer clock |
| Player's car | The kit's sedan, painted blue | |
| Crashes | Bounce, lose speed, shake; the car you hit puts its hazards on and stops for 6 s | Free drive: no damage model |
| Radio | On by default; four stations (Lo-fi, the original chord loop, first) | Every game here has music; it is the car radio. Stations added on the CD's ask (2026-11-01, second brief); their styles were assumed |
| Views | Cockpit (default), chase, orbit (drag + pinch) | "Inside behind the wheel" and "outside" |

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
7. The moon is placed by a rule of thumb (`celestial(H + 12.8, -DECL * 0.6)`), not by the
   date. Should it follow the season's real date, phase included? (Not asked; noticed
   while specifying DS-1.)

## Backlog (the CD's third message, 2026-11-01), specified for plan-gen

The CD, verbatim:

> Cruise control as is for now.
>
> Other cars should make sound yes; stereo so that if i pass a car and it is on my right i hear it in right speaker mostly (a little in left too is realistic), also doppler effect should be realistically simulated. Add this to backlog for driving simulator.
>
> Oh yeah, fix the star field rotation. It looks like i am at the earths rotational north pole and star field spins around like a spinning top. Should look like star field looks to me in the sky from perspective of raleigh north Carolina in the spring. Add this to driving sim backlog.
>
> Add to settings a season dropdown menu defaults to spring and other seasons are visible but not selectable (yet; add this to the backlog for "driving sim").

The season dropdown itself shipped the same day (`build 2026-11-01 15:55 UTC`): a
**Season** row in TIME, spring selected, summer / autumn / winter listed but
disabled, `SETTINGS.season` saved, `SEASONS` and `SEASONS_OPEN` in the page, a
suite row. The three items below are `TODO.md` § Now. Each is one plan. DS-3
needs DS-1's date model, so it goes after it. Every step runs `gates.sh`, so a
step that moves the sun must restate the suite's sun row in that step (producer
config § Plans, "plan the seams"). The defaults marked *chosen* were set when
the item was written; the CD may overrule them at plan review, but they need no
answer to start.

### DS-1. A real star field: the sky from Raleigh, NC, in spring

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
2. **One date per season** in a table that replaces `DECL` and `SOLAR_NOON`.
   - Spring is **May 5, at UTC-4 (EDT)**, the middle of spring (*chosen*).
   - The rows DS-3 will use: summer Aug 6 (UTC-4), autumn Nov 6 (UTC-5),
     winter Feb 4 (UTC-5).
   - The sun's declination, the equation of time and solar noon come from the
     date, by NOAA's general solar position equations. For the spring date,
     computed here 2026-11-01: declination +16.0 deg, equation of time
     +3.5 min, solar noon 13:11, sunrise 06:18, sunset 20:03 EDT.
   - The suite recomputes these with its own copy of the formula; it never
     copies these numbers.
   - The suite's existing row ("the sun sets about 7:45 pm and rises about
     6:15 am") must be restated in the same step, to within 10 min of the
     computed times.
3. **A real catalogue** of the stars the eye sees, to about magnitude 5.0
   (about 1,600 stars). Each star has RA and Dec (J2000), V magnitude and B-V
   colour. *Chosen* source: the Yale Bright Star Catalogue, 5th ed. (BSC5,
   VizieR V/50).
   - Check its terms before using it, and record the source (and any
     attribution it asks for) here and in the settings' notes.
   - A committed, dependency-free script packs it into a marked block in the
     page (the `build-kits.mjs` pattern); nobody types star data by hand.
   - This container's proxy may refuse the download. If it does, the plan stops
     and asks the CD for the file; it does not invent star data.
   - Precession from J2000 to 2026 (about 0.36 deg) may be ignored; say so in
     the code.
4. **One rotation from catalogue to sky.** Local sidereal time is
   `LST(hour) = LST0(season) + 15 deg x hour`.
   - It uses the solar rate on purpose. The game's date never advances, and the
     true sidereal rate would jump the sky about 1 deg at every midnight.
   - Spring LST0 (local midnight, May 5) is 204.4 deg; at 22:00, LST is
     11.69 h.
   - Axes are those of `celestial()`: x east, y up, z north. The celestial
     pole sits due north at an altitude equal to the latitude.
   - Stars rise in the east and set in the west. Stars north of
     dec +54.2 deg never set.
5. **Drawing.** One `gl.POINTS` draw right after the sky in `renderScene()`,
   so the mirror gets it too.
   - Depth test off, like the sky; the world and the ridge cover it.
   - Each vertex is a unit vector in equatorial coordinates; one matrix
     uniform turns it into the sky.
   - Size and brightness come from magnitude, and colour from B-V.
   - Faded by `SKY.night`, and dimmed toward the horizon by airmass (about
     0.2 mag per airmass).
   - Delete the hash stars and `uStarRot`.
   - Cost: one draw call and about 1,600 vertices; check it on the perf block.
6. **Out of scope:** the moon (open question 7) and the Milky Way.

**Checks.** Each is its own row and each is negative-tested.

- **Polaris** (RA 2h31m49s, Dec +89 15' 51'') sits at altitude 35.0-35.6 deg
  and azimuth 359.0-0.5 deg at every hour of the game day. Computed for 22:00:
  35.2 deg, 359.4 deg.
- **Each star circles the pole, not the zenith.** Its angle to the pole stays
  constant within 0.05 deg over 24 game hours. Dubhe (dec +61.75 deg) never
  sets; Arcturus (dec +19.2 deg) rises and sets.
- **The spring sky at 22:00 on May 5.** Each star is checked against the
  suite's own alt/az formula, never the page's, to within 0.5 deg:

  | Star | Altitude | Azimuth | Where |
  |---|---|---|---|
  | Regulus | 58.3 | 227 | high, south-west |
  | Arcturus | 52.3 | 106 | east |
  | Spica | 37.0 | 147 | south-east |
  | Dubhe | 63.4 | 350 | high, north |
  | Vega | 12.4 | 51 | rising, north-east |
  | Betelgeuse | 7.1 | 274 | setting, west |
  | Sirius | 2.6 | 247 | on the south-west horizon |

- **Stars move west.** A star in the east climbs over one game hour.
- **Pixels.** At midnight the sky above the ridge holds star pixels whichever
  way the camera looks; at noon it holds none.

**Files:** `index.html` (the constants, `celestial()`, `updateSky()`,
`setFrameUniforms()`, `skyCol()`, `renderScene()` and a star data block), a
star build script beside `build-kits.mjs`, the suite, and this file.

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

Comes after DS-1, which supplies the date per season and the sun and stars from
that date.

**Build.** Remove the `disabled` flags and grow `SEASONS_OPEN`; spring stays
the default. Each season is Raleigh as it looks at that season's date, and
every part below is *chosen*.

- **Sun and stars come from DS-1's table.**

  | Season | Declination | Sunrise | Sunset | Clock | LST0 |
  |---|---|---|---|---|---|
  | Summer | +16.9 deg | 06:25 | 20:15 | EDT | 296.1 deg |
  | Autumn | -15.8 deg | 06:40 | 17:15 | EST | 41.8 deg |
  | Winter | -16.5 deg | 07:13 | 17:43 | EST | 130.5 deg |

  These are NOAA computations made 2026-11-01; recompute them, don't copy
  them. A winter evening should then show Orion high in the south.
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
  The sky shader draws the gradient, sun, moon, stars and a hazed ridge at
  infinity.
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

Screenshots for review: `.claude/scripts/shot-page.cjs` with the test hook, for example
`node .claude/scripts/shot-page.cjs games/driving-simulator/index.html /tmp/x.png w=844 h=390 wait=4000 eval="__DS.SETTINGS.cycle=0;__DS.SKY.hour=20.5;__DS.teleport(10600);__DS.CAM.mode=0"`
(sections at the default seed: forest 2-lane from the start, 4-lane from ~1.1 km,
6-lane ~2.5-4 km, suburb 4-lane ~6.8 km, town ~10.2 km). Lessons that transfer:
`.claude/notes/20261101-a-realistic-webgl2-scene-in-one-file.md`. Software rendering is slow
(300-800 ms a frame), so it says nothing about phone frame rate.

## Measured (2026-11-01)

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
