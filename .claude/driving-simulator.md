# Driving Simulator (`games/driving-simulator/`)

An endless two-way US road you drive in WebGL2, from the driver's seat or from
outside the car. CD commission, 2026-11-01, placed on the hub straight after
Animation Rigs. Open licence (MIT, the default). Suite:
`.claude/tests/drive-driving-simulator.cjs` (77 checks).

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
5. Cruise control has no +/- buttons (set, then tap again to change). Wanted?
6. Should traffic make sound? Other cars are silent today.

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
