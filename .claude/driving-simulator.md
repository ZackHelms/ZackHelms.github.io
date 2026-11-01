# Driving Simulator (`games/driving-simulator/`)

An endless two-way US road you drive in WebGL2, from the driver's seat or from
outside the car. CD commission, 2026-11-01, placed on the hub straight after
Animation Rigs. Open licence (MIT, the default). Suite:
`.claude/tests/drive-driving-simulator.cjs` (55 checks).

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
| Radio | On by default, a mellow chord loop | Every game here has music; it is the car radio |
| Views | Cockpit (default), chase, orbit (drag + pinch) | "Inside behind the wheel" and "outside" |

## Open questions for the CD

1. Does the car feel right? 0-60 mph is ~7 s, braking from 60 is ~39 m, steering
   narrows with speed. All tunable in `stepPlayer()` / `maxSteer()`.
2. Should the player be able to pick their car (the kit has six) or its colour?
3. Weather, junctions with signals, or a destination next?
4. Is the 6-lane class right undivided, or should it get a median?

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
  braking and grade. Reverse: hold the brake at a standstill for 0.6 s. Ground
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
  and pinch (orbit view). Keyboard: arrows/WASD, Space, H, C.
- **Sound**: engine (two saws and a square through a throttle-opened lowpass,
  four-cylinder firing frequency from the gearbox's rpm), tyre and wind noise,
  skid squeal, crash, horn; the radio on the music bus. Muffled in the cockpit.
  `SND.rms(bus)` is the level probe the suite uses.
- **Settings** (cog): day length (24 s / 1 min / **2.4 min** / 10 min / 24 min /
  1 h / real time / stopped), time of day, traffic, units, graphics
  (resolution scale, shadows, props distance), mirror, radio, volume, and the
  how-to and road notes. Persisted in `drivingSimulator.settings.v1`.

## Testing

`window.__DS` exposes the sim; `__DS.setPaused(true)` stops the live loop and
`__DS.tick(dt)` steps it, so the suite's numbers are deterministic.
`__DS.teleport(s)` rebuilds the world anywhere along the road. The suite covers
the kits, the road invariants (classes, one-lane steps, MUTCD tapers,
continuous lane counts, no doubling back, curvature, grades, signs before every
lane drop in each direction), the clock (144 s = 24 h, other lengths, stopped,
sun times), the car against real figures (0-60, braking, steering sense,
reverse), collisions (trees, a car ahead), traffic discipline through a lane
drop (own side, no overlaps, merges before the taper, lane changes happen),
head-on stopping, two-finger touch on the wheel and pedals, the horn, the view
cycle, settings, a seven-size layout sweep, day vs night pixels and the audio
levels. Negative-tested 2026-11-01: removing lane-ends signs, the merge, the
player-as-leader rule or halving the clock each turns rows red.

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
  the engine.

## How to add...

- **A road class**: a row in zmh-3d's `road_gen._standard()` (and
  `road_spec.ROAD_CLASS_NAMES`), regenerate, then a `SECT_LEN` and `ENV_OF` entry
  here and its place in `extendSections()`'s neighbour rule.
- **A vehicle kind**: a base in zmh-3d's `road_gen._BASES` (+ `VEHICLE_KINDS`,
  `VEHICLE_DIMS`), regenerate, then a weight in `KIND_W`.
- **An environment**: an `ENV_W` weight, a `treeCfg` row, lot rules in
  `buildChunk()`, and a `grassColor()` branch.
