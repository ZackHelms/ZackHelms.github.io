# dsweather - Driving Simulator: rain, fog and snow, Auto or picked (DS-8, with DS-11's green winter lawns)

**Status:** DRAFT
**Drafted on** `main` at `bec4bfc` (suite 158 checks, break list 79). Every `file:line` below was read on
`bec4bfc`; re-grep each anchor before editing, as another session may land first.
**Requested:** 2026-11-04, the CD, at backlog refinement and plan-gen (each answer a pick from offered
options unless quoted):

- Weather is what comes next for Driving Simulator (over junctions with signals and a destination).
- The first pass has **rain, fog and snow**.
- A **Weather dropdown** in settings: **Auto** (changes by itself, weighted by season, **snow only in
  winter**) or a fixed **Clear / Rain / Fog / Snow**, saved like Season.
- **Real-world grip**: wet asphalt about 0.7x dry, packed snow about 0.3x; traffic slows to match.
- **Light to heavy rain, no thunderstorms** (storms are a later item).
- The manual **Snow pick is winter only**: greyed out unless the season is winter.
- Settled snow, verbatim: "treat 2 lane roads more like back roads that dont get salt treated and scraped
  so they whiten with markings fading under snow and darker tire tracks in the lanes [...]. 4 lane and 6
  lane roads get treated and scraped."
- Also verbatim: "stop spelling it "tyre", use "tire" instead."
- **DS-11** (bundled here): town and suburb lawns stay fescue green in winter; fields and verges stay straw.

**Scope:** `games/driving-simulator/index.html` (settings, a weather state and timeline, the sky and fog
shaders, the world shader's wet and snow terms, a precipitation pass, a windscreen pass in the cockpit,
headlights, the car's grip, the traffic's speeds, the weather sound), the suite
`.claude/tests/drive-driving-simulator.cjs`, the break list `.claude/tests/negtests/driving-simulator.json`,
and the docs `.claude/driving-simulator.md`, `.claude/tests/README.md`, `games/CLAUDE.md` (the Driving
Simulator paragraph), `TODO.md`, `DONE.md`. Source TODO entry: `TODO.md` § Now, "Weather: rain, fog and
snow" (DS-11's entry was merged into it). Spec: `.claude/driving-simulator.md` § Backlog (refinement,
2026-11-04), DS-8 and DS-11.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

A Weather row in settings offers Auto, Clear, Rain, Fog and Snow; Auto is the default and is a pure
function of the game's date and hour, so the same day always has the same weather. Under rain the sky
goes grey, the sun, moon and stars hide, the road darkens and shines, rain streaks fall (slanting as you
drive), drops gather on the windscreen in the cockpit and the wipers clear them, the car stops in about
1.4x its dry distance, the traffic slows, headlights come on, and you hear the rain, the wipers and wet
tires. Fog closes the view to a few hundred metres. In winter, snow falls and settles: grass, roofs and
conifers whiten; two-lane roads whiten with their markings fading and darker tire tracks in the lanes,
while four- and six-lane roads stay wet and dark with snow on their shoulders, and grip falls to about
0.3x on the white roads. Town lawns stay fescue green in winter. Under Clear every frame, every car and
every sound is exactly as shipped.

## Context

- **Settings.** `SETTINGS` (`index.html:1214-1230`) merges a saved object over its defaults; the SKY sliders
  show the pattern for a new key (a missing or invalid value reads the default). `SET_KEY` is
  `drivingSimulator.settings.v1` (`:1156`). The Season row is HTML at `:78-79` in TIME; `setSeason(v)`
  (`:4287-4294`) is the dropdown's path and `__DS.setSeason`'s. `syncSettingsUI()` (`:4270-4277`) fills the
  panel. `SEASONS_OPEN` (`:1166`) is the precedent for "listed but not selectable".
- **The road knows its class per vertex.** The road's vertex colour is `[p.L, p.L < 1.5 ? 0 : 1, p.sh]`
  (`:1800`): lanes per direction, the centre-line type and the shoulder. `FS_WORLD`'s asphalt branch reads
  it as `L, dbl, sh` (`:2344-2373`). `L` is 1 on `rural2` and `town2`, 2 on `arterial4`, 3 on `highway6`,
  fractional inside a taper (`crossAt`, `:1311-1322`). So "treated" is `clamp(L - 1.0, 0.0, 1.0)` in the
  shader, with no new vertex data, and it blends over a taper by itself. The asphalt branch already has
  the wheel paths (`paths`, darker and smoother) and the markings (`mark`, `mc`).
- **Colours are baked; weather must not be.** A chunk's colours are in its vertices and a season is a
  rebuild (`applySeason`, `:3083`). Weather changes by the minute, so every weather effect is a uniform
  read in the shaders, and **no chunk is rebuilt for weather.** Materials (`MAT`, `:1550-1551`): 0 road,
  1 grass, 4 roof, 5 bark, 6 leaf (broadleaf canopies, the conifers' cones at `:1719`, the distant
  treeline at `:1868-1870` and the yard bushes at `:1943`), 7 concrete, 21 dirt.
- **Fog and the sky.** `FS_WORLD` fogs every fragment toward `skyBase()` at
  `fogK = 1 - exp(-dist * uFog)` (`:2450-2452`), with `uFog = lerp(0.0016, 0.00105, SKY.day)` set in
  `renderScene` (`:3480`), which is a meteorological optical range of about 2.9 km by day (MOR = 3.0 / sigma,
  the WMO's 5% contrast). `skyBase()` (`GLSL_COMMON`, `:2275-2292`) is the gradient, the sunset tint, the
  sun's broad lobe and the moon's glow. `FS_SKY` adds `skyBodies()` on the view ray only and draws the
  hills (`:2464-2519`). That split is DS-7's fix: **no disc may reach the fog again.** The star pass is
  gated in `renderScene` (`:3463`) and the Milky Way in `FS_SKY`.
- **Light.** `updateSky()` (`:3174-3219`) sets `SKY.sunCol`, `SKY.moonCol`, `SKY.ambSky`, `SKY.ambGnd`,
  `SKY.exposure` and `SKY.lights = SKY.day < 0.5` (`:3218`), and applies the SKY sliders last. `SKY.lights`
  is read at `:3316` (the player's headlamps), `:3320` (the traffic's), `:3378` (`gatherLights`, the two
  headlight cones) and `:3588` (the dashboard's headlight tell-tale).
- **The cockpit has no windscreen.** `buildCabin` (`:2165-2242`) builds the dash, the A-pillars from the cowl
  corners `a = [sx * (cowl.halfWidth - 0.04), cowl.top, cowl.z]` through `b` to the header `c2`
  (`:2186-2189`), the headliner and the mirror, all in the car's own frame; the view looks through an
  opening. `glassAt()` (`:2040`) and `car.ws` / `car.cowl` give the glazing. `CAM.mode === 0` is the
  cockpit (`updateCamera`, `:3240`; its cockpit branch `:3245-3254`). The context is
  `getContext('webgl2', { antialias: true, alpha: false, ... })` (`:2246`).
- **Instanced sprites already exist.** The glows (`VS_GLOW` `:2567`, `FS_GLOW` `:2578`) draw camera-facing
  quads with `drawArraysInstanced` off `GLOWBUF` (`renderScene`, `:3517-3528`). `GFX` (`:3533-3537`) is the
  graphics setting (render scale, props distance, shadows). The mirror is a second `renderScene` with
  `mirrorPass: true` (`:3551`).
- **The car.** `stepPlayer` (`:2745`) sets `const mu = onRoad ? 1.0 : 0.62;` (`:2752`) once a step; `mu`
  bounds traction (`m * G * mu * 0.55`), the brakes (`m * G * 0.95 * mu`), both axles' lateral force
  (`muF`, `muR`) and the cruise control's forces, so one factor on `mu` moves all of them. `pr.p` is the
  road sample under the car (`project`), so `pr.p.L` is the lanes per direction there. Skid squeal
  is `P.slip > 0.9` (`S.update`).
- **Traffic.** `idm(v, v0, gap, vl)` (`:2977-2981`) has `A = 1.4, B = 2.2, T = 1.35, S0 = 3`;
  `stepTraffic` sets `v0 = limit * c.f * fastLane` (`:3022`). `TRAFFIC.rnd` (`:2918`) is the traffic's
  own stream: weather must never draw from it.
- **Sound.** `VOL_KEYS` (`:1158`) gives a channel and a slider per sound (`VOL_LABELS`, `:4264`, still
  spelled "Tyres on the road" and "Tyre squeal"); `S.unlock()` (`:3875`) builds every node once, and
  `probes` (`:3938`) put an analyser on each channel. `S.update()` (`:3953`) drives the engine, tires,
  wind, skid and the ambient bed; the birds are scheduled by `SKY.day` and `AMB_SEASON[lookSeason]`
  (`:3862-3867`). `S.preview(k)` (`:4236`) plays a sample when a slider is let go. DS-2's rule holds:
  nothing is created per frame.
- **The clock.** `advanceClock(dt)` (`:4333`) moves `SKY.hour` by `dt * 24 / SETTINGS.cycle` and steps the
  date at midnight (`nextDate`); `setDate()` (`:4353`) and the time-of-day slider jump it. `tick()`
  (`:4358`) runs input, clock, sky, player, traffic, chunks. `boot()` is at `:4416`, the test hook
  `window.__DS` at `:4456`.
- **The suite.** 158 rows; `ok(name, cond, detail)` (`:26`). Pixels come from `__dsAimed` (section 8b,
  `:1005`), recorded before-hashes are typed in (`SPRING_BEFORE`, `:359`; `SKY_BEFORE`, `:1269`), and sound
  rows run on `lvT` (the loop held, `SND.update(0)` on a 50 ms timer, `Math.random` seeded; section 9).
  Pages are opened from `ctx` (and `ctxP` for the touch rows); the season rows reload. The volume-key
  row (`:2080`) types the keys by hand.
- **Real-world figures used below** (from general knowledge, not looked up this run: say so where they
  matter): wet asphalt friction about 0.7x dry and packed snow about 0.3x (the CD's pick); so 60-0 braking
  is about 1/0.7 = 1.43x dry wet and about 3.3x on snow, a little less with drag. Raindrops fall at about
  4-9 m/s, snowflakes at about 1-1.5 m/s. Fog by definition is a visibility under 1 km; the US National
  Weather Service's dense-fog threshold is a quarter mile (about 400 m). North Carolina requires headlights
  whenever the wipers are in use for the weather (G.S. 20-129(a), from memory: inferred).

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

### State, timeline and the dropdown

- **`SETTINGS.weather`**: `'auto' | 'clear' | 'rain' | 'fog' | 'snow'`, default `'auto'`; a missing or
  invalid value reads `'auto'`; `'snow'` while `lookSeason !== 'winter'` reads `'auto'` at boot.
- **The row**: `Weather` in TIME, straight after Season (`:78-79`), `<select id="weather-sel">` listing
  Auto, Clear, Rain, Fog, Snow; Snow `disabled` unless `lookSeason === 'winter'`, re-evaluated whenever the
  season changes. `setWeather(v)` is the handler's path and `__DS.setWeather`'s; it refuses a disabled
  pick. Leaving winter with Snow picked sets Auto.
- **`WX`**, one object: `{ kind, intensity, cloud, fog, wet, snow, ... }`, `kind` in
  `clear | rain | fog | snow`, `intensity` 0-1. `cloud` (0-1) and the fog density follow `kind` and
  `intensity`. `wet` (0-1) and `snow` (0-1, the settled cover) **accumulate** (below).
- **Auto is a pure function of the date and hour**, `wxAt(mjd, hour)`. Each game day draws its spell from
  its own stream, `mulberry32(hashSeed(WORLD_SEED, 'wx-' + mjd))`, **never** `TRAFFIC.rnd` and never
  `Math.random`: a kind by the season's weights, a start hour, a length, an intensity. A spell may run past
  midnight, so `wxAt` also looks at the day before. Edges ramp over 30 game minutes. The weights key off
  `lookSeason` (the season the road looks like, as `AMB_SEASON` does), never `SETTINGS.season`, which the
  calendar rows write on their own. *Chosen* weights, as a share of days with a spell (worth the CD's eye):
  spring rain 0.30, fog 0.10; summer rain 0.35 (afternoon, 13:00-19:00 starts), fog 0.05; autumn rain 0.25,
  fog 0.15; winter rain 0.25, fog 0.10, **snow 0.15**. Rain spells 2-10 h, intensity 0.2-1.0; fog 04:00-10:00
  starts, 3-7 h; snow 3-12 h, intensity 0.3-1.0. Real Raleigh snow is closer to 0.05 of winter days; 0.15 is
  chosen so a player sees it within about a week of game days (17 minutes at the default 2.4-minute day).
- **A fixed pick** is that kind at a fixed intensity: Rain 0.7, Fog 0.8, Snow 0.7.
- **Accumulation** (in game hours; *chosen*): `wet` rises toward 1 with a 20-minute time constant while it
  rains (snow on a treated road counts as rain for `wet`), and dries with a 2-hour constant by day and 5 by
  night. `snow` rises toward 1 with a 1.5-hour constant while it snows (scaled by intensity) and melts with
  an 8-hour constant by day and 24 by night; outside winter `snow` is 0. Stepped each tick by the game's own
  `dt * 24 / cycle` (so a stopped clock stops the weather).
- **Jumps re-derive, never step.** At boot, `setDate()`, the time-of-day slider, a season switch and a pick
  of Auto, the state is recomputed from a pure integrator, `wxHistory(mjd, hour)`, which steps the same
  equations over the previous 48 game hours of `wxAt` in 10-minute steps (288 steps). A **fixed** pick made
  live keeps the current `wet` and `snow` and lets them move from there. At boot a fixed pick starts at its
  steady state: Clear 0 and 0, Rain wet 1, Fog 0 and 0, Snow cover 1.
- **Hooks:** `__DS.WX`, `setWeather`, `wxAt`, `wxHistory`, and a `WX_SEASON` weights table.

### Sky, fog and light (no new draw call)

- **`uCloud`** in `GLSL_COMMON`: `skyBase()` mixes toward an overcast grey (luminance by `uDay`, about 0.55x
  the clear horizon's by day, bluish-dark by night) by `uCloud`; the sun's broad lobe and the moon's glow
  scale by `1 - uCloud`. `skyBodies()` scales by `1 - uCloud` (no disc through cloud). The star pass's
  gain and the Milky Way's scale by `1 - uCloud`, and the star pass is skipped at `cloud >= 0.98`.
- **Light under cloud:** `SKY.sunCol *= 1 - 0.85 * cloud`, `SKY.moonCol *= 1 - cloud`, and the ambient gains
  part of what the sun lost (diffuse daylight: `ambSky` and `ambGnd` up to 1.3x by day under full cloud).
  `SKY.exposure` is unchanged (the picture really is darker). Applied after the SKY sliders.
- **`uFog`**: Clear's value as now; weather raises sigma so the meteorological optical range is: rain 8 km
  at intensity 0.2 down to 1 km at 1.0; fog 400 m at 0.2 down to 150 m at 1.0; snow 1.5 km down to 400 m.
  (MOR = 3.0 / sigma.) Under fog the sky pass's hills fade to the fog colour and the horizon band thickens,
  so the far road and the hills disappear together.
- **Headlights** come on whenever `WX.kind !== 'clear'` (NC's wipers-on rule, inferred), for the player and
  the traffic: every reader of `SKY.lights` (`:3316`, `:3320`, `:3378`, `:3588`) reads a new
  `lightsOn()` = `SKY.lights || WX.kind !== 'clear'`.
- **Clear is byte-identical.** Every new GLSL term sits behind `if (uX > 0.0)` or is a multiplication that is
  exactly 1.0 under Clear, and every new JS factor is exactly 1 under Clear; recorded hashes prove it.

### Rain

- **A precipitation pass**, `PRG.precip`, one `drawArraysInstanced` after the world and the cabin, before
  the contact shadows: camera-facing quads placed **procedurally in the vertex shader** from
  `gl_InstanceID` (no per-frame buffer), in a 60 m box round the eye that wraps by `mod` (camera-relative,
  like everything else). Rain is a thin streak along the drop's velocity **relative to the camera**
  (falling at 6-8 m/s by hash, minus the car's world velocity), its screen length that motion over one
  frame at 60 fps, so it slants as you drive. Lit by the ambient, the sun and moon under cloud, and the
  first four local lights (the headlights first), so rain shows in the headlight beams at night. Count at
  intensity 1: 5,000 streaks times the `GFX` row's scale (*chosen*: 0.35 / 0.65 / 1.0), times intensity.
  Depth test on, depth write off, alpha-blended. **Instances inside the player's car box** (its basis and
  half extents plus 0.1 m, uniforms) are moved off-screen, in every view, so no rain falls through the roof
  or inside the cockpit. Drawn in the mirror too.
- **Wet surfaces**, in `FS_WORLD` under `if (uWet > 0.0)`: asphalt darkens (albedo times 0.45 at full wet),
  roughness falls toward 0.15, and it takes a sky reflection (`refl` up to 0.6) and a stronger specular from
  every light; wetness gathers first in the wheel paths and low noise patches (puddles, glossier). Concrete,
  roofs and walls darken by up to 0.75x; grass by 0.9x. No stretched reflection streaks (an approximation:
  log it in the assumed table).

### The windscreen and the wipers (cockpit only)

- **A windscreen quad** built in `buildCabin` from the A-pillar points (`a` both sides at the cowl, `c2` both
  sides at the header, `:2186-2189`), 2-3 mm inside the glass line, drawn by `PRG.glass` after the
  precipitation pass, only when `CAM.mode === 0` and `wet > 0` or it is snowing.
- **Drops**: a procedural field on the quad's uv (hashed cells; each drop has a birth time). A drop shows
  when it was born after the wiper last crossed its place. Above about 15 m/s the drops creep up the glass
  (airflow). Each drop refracts: the frame is copied to a texture once (`copyTexSubImage2D`, only in the
  cockpit while it rains) and a drop samples it with a lens offset. **If the copy errors** on the
  antialiased default framebuffer (check `gl.getError()` once), or costs more than the frame-cost trigger,
  draw drops as dark lenses with a highlight instead (no refraction) and log it.
- **Wipers**: two blades pivoting at the cowl, sweeping about 100 deg. The rate follows the rain, in
  cycles (out and back): intermittent (one every 6 s) under 0.35 intensity, low (45 a minute) to 0.7, high
  (65 a minute) above, and low for snow. (Real wipers run about 40-50 a minute on low and 60-70 on high:
  from general knowledge, not looked up.) The time each uv was last wiped is computed in the shader from the sweep schedule
  (uniforms: the cycle start, the period and the sweep time), not stored. The blades are drawn as dark
  bands in the same pass.
- **Snow on the glass**: flakes stick as small white blots and melt in about 4 s, wiped like drops.

### Snow (winter only)

- **Falling snow** is the same pass in snow mode: soft round flakes, 1-1.5 m/s with a wobble, drifting with
  the relative wind; count at intensity 1: 4,000 times the `GFX` scale.
- **Settled cover**, in `FS_WORLD` under `if (uSnow > 0.0)`, on upward faces (`smoothstep(0.45, 0.9, N.y)`)
  with a noise edge: grass, roofs, concrete, dirt and the tops of bark (limbs) at full cover; leaf (the
  conifers' cones, the treeline, bushes) patchy at 0.7. Cars stay clean (a moving car sheds it; there are no
  parked cars). Snow albedo about 0.8 (linear), rough 1.
- **The road by class** (the CD's rule), with `treat = clamp(L - 1.0, 0.0, 1.0)`:
  - **Untreated (two-lane, `treat` 0):** the lanes and shoulders whiten with the cover; the markings fade
    (`mark *= 1 - smoothstep(0.25, 0.75, cover)`); the **wheel paths** stay darker: packed, dirty snow
    (about 0.3 albedo, grey-brown) where the cover is thin, at about 0.45-0.7x the white between them.
  - **Treated (four- and six-lane, `treat` 1):** the travel lanes are wet asphalt (`wet` forced to at least
    0.8 while there is cover) with a little grey slush between the wheel paths while it snows; the
    markings stay; the shoulders beyond the edge line whiten, brightest at the outer edge (the plowed
    windrow).
  - A taper blends the two by `treat`.
- **DS-11, green winter lawns:** `SEASON_LOOK.winter.lawn` becomes a fescue green, *chosen* about sRGB
  (70, 98, 50) (spring's lawn (62, 96, 42) a touch duller and greyer). Fields, verges and the forest floor
  stay as DS-3 made them. This one change is baked (a rebuild into winter shows it), so spring's bytes are
  untouched.

### Grip and traffic

- **Grip:** `stepPlayer`'s `mu` (`:2752`) times `surfaceMu()`. On the road: `lerp(1, 0.7, wet)`, then under
  snow on an untreated road `lerp(that, 0.3, snow * (1 - treat))`; a treated road under snow is wet (0.7).
  Off the road: `0.62 * lerp(1, 0.8, wet)`, and under snow `lerp(that, 0.3, snow)`. `treat` from `pr.p.L`
  as in the shader. Exactly 1 under Clear. Cornering stiffness (`Cf`, `Cr`) is unchanged: below the limit
  the car feels as signed off; it is the limit that moves.
- **Skid squeal** is quieter on a wet road (times `1 - 0.6 * wet`) and silent on snow cover over 0.5.
- **Traffic** (`stepTraffic` / `idm`): `v0` times 0.92 in rain, 0.85 in fog, 0.8 on a treated road in snow
  and 0.6 on an untreated one; the time headway `T` times 1.3 in rain and fog and 1.6 in snow; the
  comfortable braking `B` times the surface's mu. Each factor is exactly 1 under Clear. The traffic's
  discipline rules (own side, no overlaps, merges) must hold in every weather.

### Sound

- **A Rain channel**: `'rain'` in `VOL_KEYS` after `'wind'`, labelled "Rain and wipers", 0-100, old saves
  read 100, its own probe. Built once in `S.unlock()`: the rain's hiss (noise through a bandpass near 3-5 kHz
  and a lowpassed rumble, level by intensity) and, in the cockpit, the **roof drumming** (lower: a bandpass
  near 400-900 Hz, amplitude-crackled) with the outside hiss behind the glass at 1.5 kHz like the ambient.
  The **wipers**: a soft thump at each end of a sweep and a faint rubber swish during it, scheduled from
  the same sweep schedule as the shader, in the cockpit only.
- **Wet tires**: the tires channel's level up to 2x and its band up about 1.5x on a wet road at speed (the
  spray hiss); on snow cover a duller, lower crunch (band down 0.6x).
- **Weather and the ambient:** no birds and no insects while it rains or snows; the breeze 0.6x under snow
  (snow hushes). Fog changes nothing.
- **Spelling:** the labels become "Tires on the road" and "Tire squeal". The saved keys `tyres` and `skid`
  and every identifier stay as they are (renaming `vols.tyres` would silently reset players' volumes).

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md` § Plans).
One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Record Clear's frames on the base page; the weather state, `wxAt`, accumulation and history, the dropdown; the suite pins Clear | engine+tests | opus | high | a byte-identical guarantee recorded before any edit, a seeded timeline that must not touch the traffic's stream, an integrator two paths must agree on |
| 2 | Overcast sky, weather fog, light under cloud, headlights in weather | render+tests | opus | high | shader terms that must vanish exactly under Clear, DS-7's no-disc-in-fog rule, a visibility row measured off pixels |
| 3 | The precipitation pass (rain mode) and wet surfaces | render+tests | opus | high | a new instanced program, culling inside the car, relative-wind streaks, wet BRDF terms measured off pixels |
| 4 | The windscreen and the wipers | render+tests | opus | high | a new cabin quad and program, a frame copy with a fallback, an analytic wipe schedule |
| 5 | Snow: falling, settled cover, the road by class, DS-11's lawns | render+tests | opus | high | the CD's treated/untreated rule in the shader, markings and tire tracks, a baked colour that must not move spring |
| 6 | Grip and traffic in the weather | physics+tests | opus | high | one factor on `mu` through every force, braking against v^2 / 2 mu g, traffic discipline in snow |
| 7 | The weather's sound, the labels | audio+tests | opus | high | Web Audio built once, levels by measurement on the `lvT` timer, the wipers on the shader's schedule |
| 8 | Break list and negative tests; frame cost; docs | eval+docs | opus | high | each break on its own row; MISSED needs a row or an argued equivalence |
| 9 | Ship: badge, gates, land on `main`, Pages, TODO/DONE, report | ship | sonnet | medium | the documented procedure |

- **Ordering:** 1 -> 2 -> ... -> 9. Nothing in parallel (one page, one suite).
- **Files owned per task:** 1: settings, `WX` and its functions, the Weather row, boot, `__DS`, the suite's
  setup; 2: `GLSL_COMMON`, `FS_SKY`, the star pass's gates, `updateSky`'s light, `uFog`, `lightsOn()`;
  3: `PRG.precip`, `FS_WORLD`'s wet terms, `renderScene`; 4: `buildCabin`, `PRG.glass`, the frame copy;
  5: the precip pass's snow mode, `FS_WORLD`'s snow terms, `SEASON_LOOK.winter.lawn`; 6: `stepPlayer`'s `mu`,
  `idm` / `stepTraffic`, the skid level; 7: `SND`, `VOL_KEYS`, `VOL_LABELS`; 8: the break list and the docs;
  9: the badge, the plan's move to `DONE/`, `TODO.md`, `DONE.md`. Every step adds its rows to the suite.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every page edit; `.claude/scripts/gates.sh games/driving-simulator/index.html` at the end of every
  step, **run alone** (check `uptime` first; producer config § Environment).
- **Gates on the base page first.** Run `gates.sh` once on the unchanged page before step 1 and name any
  red row in the Results; a step passes when its only reds were red there too. (dsradio fixed the radio
  rows on 2026-11-04; the perf block's wall-clock FPS row can still flap under load, and a catch only it
  makes is no catch.)
- **Tier audit (required):** no step passes a haiku checklist. Steps 1-7 each mix new design with rows that
  must measure (hashes, pixels, braking distances, audio levels): opus, high. Step 8 needs judgment on
  breaks: opus, high. Step 9 is the procedure but pushes to `main`: sonnet, medium.
- **Decision defaults:** everything under "Design". Beyond it:
  - A choice not listed here becomes a row in `.claude/driving-simulator.md`'s "Assumed, not decided"
    table, marked DS-8 (or DS-11).
  - A suite row the change contradicts is restated, never deleted. Known: the volume-key row (`:2080`)
    gains `'rain'`; any row reading the TIME section's row list or the panel's height at 320 px gains the
    Weather row.
  - **The suite pins Clear.** In the suite's setup, `ctx.addInitScript` (and `ctxP`'s) writes
    `weather: 'clear'` into the saved settings **only when no `weather` key is there**, so every existing
    row runs under Clear (they assume a clear sky) and a row that saves a weather keeps it across a reload.
    Each weather row sets its own weather and puts Clear back.
  - If a band below cannot hold with the Design's numbers, move the number, not the band, and log it.
    The bands are the CD's words ("about 0.7x", "whiten", "darker tire tracks", "markings fading").
  - **Frame cost first, then fidelity.** If heavy rain or snow costs more than the trigger below, lower the
    particle count, then the windscreen's refraction, before anything else; log what moved.
  - The tree-expert agent is **not** needed: no tree geometry changes (snow on limbs is a shader term).
- **The suite's oracles:** the CD's ratios (0.7, 0.3) and v^2 / (2 mu g) for braking; MOR = 3.0 / sigma for
  visibility; fall speeds typed from Context; the measured side is always the rendered pixels, the GPU's
  buffers, the car's own stepped motion or the audio analysers, never the page's tables echoed back.
- **Embedded-content QA.** New rows: step 1 adds 5, step 2 adds 5, step 3 adds 4, step 4 adds 3, step 5 adds
  5, step 6 adds 4, step 7 adds 8 = 34 (listed in Steps). Expected total at the end of step 7: start + 34
  (158 + 34 = 192 if nothing else lands first; state the real numbers). Step 8 adds a row only for a MISSED
  break; say how many.
- **Escalation triggers:** Clear's recorded frames cannot be held byte-identical (the recording itself
  differs between two runs of the base page); the frame cost of heavy rain or snow in the cockpit at
  390x844 under SwiftShader exceeds 1.5x Clear's median rAF delta after the count and refraction
  fallbacks; anything needing a change to `drivingSimulator.settings.v1`'s key.
- **Playtest:** see § Validation.
- **Publish:** step 9 pushes `main`, which is the publish. Verify the Pages run.
- **Commit strategy:** one conventional commit per step on the plan's branch (`ds-weather`, or the branch
  your session may push to), scope `driving-simulator`, ending "(dsweather step N)". Step 9 lands the
  branch on `main` as one commit with `.claude/scripts/land-on-main.sh`, dry-run first.

## Steps

### Step 1 - the weather's state, its timeline and the dropdown

- **First, before any page edit:** record Clear's frames on the base page as `WX_BEFORE` (mean luminance and
  FNV-1a of the RGBA bytes, the way `SKY_BEFORE` was recorded, `:1248-1273`): the road at 13:00 in the chase
  view and in the cockpit (May 5, `teleport(400)`, paused), 22:00 stars (the night22 aim), the sun at 17:00
  and a town street at 21:00 (streetlights and headlights). Run the recording twice; the hashes must agree.
  Also record a traffic trace (every car's `id`, `s`, `lane`, `v` after 60 s of `tick(1/60)` from a fixed
  `teleport`) as `TRAFFIC_BEFORE`.
- Build per Design: `SETTINGS.weather`, the Weather row and `setWeather()`, `WX`, `WX_SEASON`, `wxAt`,
  `wxHistory`, the stepping in `tick`, the re-derivations, the hooks. Nothing is drawn or heard yet.
- Set up the suite's Clear pin (Decision defaults).
- Rows (5; a new section 3e after the seasons):
  - **the dropdown:** a Weather row straight after Season in TIME listing Auto, Clear, Rain, Fog, Snow;
    Auto on a fresh page; each pick saved and back after a reload; a stored `weather: 'hail'` and an old
    save with no key both read Auto; the row fits at 320 px wide (as the SKY row is measured, `:1593-1610`).
  - **snow is winter's:** in spring, summer and autumn Snow is disabled and `setWeather('snow')` refuses;
    in winter it is allowed; leaving winter with Snow picked sets Auto.
  - **Auto is the date's own weather:** `wxAt` gives the same answer for the same date and hour after a
    reload and after a `teleport`; with Auto on, the 60 s traffic trace equals `TRAFFIC_BEFORE` and a
    seeded `Math.random`'s next draw is unchanged (the weather uses neither stream).
  - **Auto by season:** over each season's whole run of dates (`SEASON_DATES`), the share of days with a
    rain, fog or snow spell within +/- 0.06 of the chosen weights, and no snow at all outside winter
    (sampled hourly, with `lookSeason` set by `applySeason`).
  - **it gathers and fades:** through a rain spell `wet` rises to over 0.9 and is under 0.2 five game hours
    after it stops by day; through a snow spell `snow` rises to over 0.9 and melts after; and after a
    time-of-day jump into the middle of a spell, the stepped state and `wxHistory` agree within 0.02 at
    ten sampled hours.
- Expected total: start + 5.

### Step 2 - the grey sky, the fog, the light under cloud, headlights

- Build per Design.
- Rows (5):
  - **Clear is as shipped:** the five `WX_BEFORE` frames hash as recorded, again after Rain then back to
    Clear with `wet` and `snow` 0.
  - **cloud hides the bodies:** under Rain at intensity 1, the pixel at the sun's disc (the 17:00 aim) is
    within 5% of the sky 3 deg beside it, the moon likewise (the `moon4` aim of `SKY_BEFORE`), and at 22:00 no
    star pixel
    (the star row's own method, section 8b).
  - **the sky goes grey:** under Rain at 13:00, the sky's mean HSV saturation under 0.15 where Clear's is over
    0.3, and its mean luminance 0.4-0.8x Clear's.
  - **the fog closes the view:** a straight, flat stretch, chase camera aimed down the road at 13:00: the
    road's contrast against the fog colour at the screen rows for 50, 100, 200 and 300 m falls as
    `exp(-sigma (d - 50))` with the sigma for the weather's MOR within 20%, for Fog at 0.2 and 1.0 (MOR 400
    and 150 m); under Clear (MOR about 2.9 km, too long to fit over 300 m) the contrast at 300 m is at least
    0.85x that at 50 m.
  - **headlights in weather:** at 13:00 the player's headlamp pixels (`MAT.HEADLAMP`, cockpit off) are lit
    under Rain, Fog and Snow and unlit under Clear; a traffic car's likewise.
- Expected total: step 1's + 5.

### Step 3 - rain falls, and the road gets wet

- Build per Design.
- Rows (4):
  - **it rains where you look:** under Rain at 13:00, chase view, one instanced draw for the pass; the
    difference between the frame and the same frame with the pass off covers 0.5-15% of the pixels; under
    Clear the pass does not draw (the call count is Clear's).
  - **streaks follow the relative wind:** driving forward, streaks fan out from the road's vanishing point,
    so a whole-frame mean would read vertical either way. Take the difference frame's orientation (a
    structure tensor) in the left and right thirds separately: at rest both within 5 deg of vertical; at
    30 m/s the two lean opposite ways, each more than 10 deg off vertical, toward the screen's edge.
  - **no rain inside the car:** cockpit view, the cabin's own pixels (the dash, the headliner, the A-pillars:
    the frame with the world drawn black) identical with the pass on and off; in the chase view, none of the
    car's own pixels change.
  - **the road is wet:** after `wet` reaches 1, at 13:00 the lane asphalt's mean luminance is 0.4-0.75x dry's;
    at 21:00 on a town street, the road's brightest pixel under a streetlight is brighter wet than dry.
- Expected total: step 2's + 4.

### Step 4 - the windscreen and the wipers

- Build per Design. Measure the frame copy's cost first (median of 20 frames, cockpit, with and without);
  note it in the Results and take the fallback if the trigger says so.
- Rows (3):
  - **drops on the glass, in the cockpit only:** under Rain, cockpit, the windscreen's region differs from
    the same frame with the glass pass off by more than 1% of its pixels; in the chase and orbit views the
    pass does not draw; under Clear (dry) it does not draw in the cockpit either.
  - **the wipers clear what they sweep:** stepped with `tick(1/60)`, right after a sweep the drops in the
    swept arc are under 20% of those in the unswept corner below the A-pillar, and they rebuild before the
    next sweep.
  - **the wipers follow the rain:** over 30 s of ticks, cycles counted from the swept arc's drop count
    falling (once a cycle: the return stroke finds the arc already clear): intermittent at intensity 0.25
    (4-7), low at 0.5 (19-26, the Design's 22.5), high at 0.9 (28-37, the Design's 32.5).
- Expected total: step 3's + 3.

### Step 5 - snow, the white roads and the green lawns

- Build per Design. Then take shots with `.claude/scripts/shot-page.cjs` for the Results: a rural two-lane
  road and a six-lane highway at full cover, 13:00, chase view, and a town street at 21:00.
- Rows (5):
  - **it snows:** in winter under Snow, chase view at rest, the difference frame shows flakes; the flakes
    move less than a third as far per frame as rain's streaks under the same ticks.
  - **snow settles:** after `snow` reaches 1 at 13:00, the grass and roofs in an aimed frame read over 0.6 of
    a white reference's luminance on their upward faces; under Clear in winter they are as DS-3 made them.
  - **two-lane roads whiten:** on `rural2` at full cover, the lane between the wheel paths is over 0.55
    luminance, the dashed yellow's contrast is under 15% of Clear's, and the wheel paths are 0.45-0.85x
    the lane between them.
  - **wider roads are scraped:** on `highway6` at the same cover, the travel lanes are darker than dry asphalt
    (wet), the lane lines keep over 70% of Clear's contrast, and the shoulder beyond the edge line is over
    0.55 luminance; a taper reads between the two.
  - **winter lawns stay green (DS-11):** in winter, a suburb chunk's lawn vertices (read back off the GPU)
    have a mean hue of 75-120 deg; the fields' grass is still straw (28-48 deg, DS-3's band); spring's
    recorded chunks still hash as `SPRING_BEFORE`.
- Expected total: step 4's + 5.

### Step 6 - grip and traffic

- Build per Design.
- Rows (4):
  - **wet braking:** 60-0 mph on a straight, level stretch (as the dry row does it) with `wet` 1: the
    distance is 1.25-1.6x the dry row's figure (v^2 / 2 mu g gives 1.43x at 0.7).
  - **snow braking, by road:** at full cover on `rural2`, 2.5-3.6x dry (3.3x at 0.3, less with drag); on
    `highway6` at the same cover, the wet band.
  - **it slides on snow:** a step steer of half lock at 20 m/s on `rural2` at full cover drives `slip` over 1
    where the same input on a dry road stays under 1.
  - **traffic in the weather:** over 90 s of ticks each, the traffic's mean speed against its limit under
    Rain is at most 0.95x Clear's and under Snow on a two-lane road at most 0.72x; in every weather, no two
    cars overlap and none crosses to the other side (the discipline row's own checks).
- Expected total: step 5's + 4. The dry 0-60, 60-0 and cruise rows must still pass unchanged.

### Step 7 - the weather's sound

- Build per Design. All rows on `lvT` (the loop held, the scheduler on a 50 ms timer, `Math.random` seeded).
- Rows (8; section 9c):
  - **a Rain slider:** "Rain and wipers" after Wind; old saves read 100; at 0 the rain probe is silent and the
    engine's level is unchanged. Restate the volume-key row (`:2080`) with `'rain'`.
  - **rain is heard and scales:** the rain probe's mean RMS at intensity 0.9 is 2-6x that at 0.25, and under
    Clear, Fog and Snow it is under 1e-5.
  - **under the roof:** cockpit vs chase under Rain: the rain channel's spectral centroid is lower inside
    and its level 0.6-1.4x outside's.
  - **wet tires:** at 25 m/s, the tires probe on a wet road is 1.5-3x dry's and its centroid higher.
  - **the wipers:** in the cockpit under Rain at 0.5, the rain channel's envelope peaks at the wiper period
    (within 10%), and there is no thump in the chase view.
  - **the birds hide:** at 13:00 under Rain the birds probe is under 0.2x Clear's; under Snow the ambient's
    breeze is under 0.75x Clear's.
  - **no node growth:** 60 s of ticks through Rain, Snow and Clear with the rain sound and the wipers on, every
    `create*` wrapped as in DS-2: no AudioNode created.
  - **"tire":** the SOUND labels read "Tires on the road" and "Tire squeal"; no visible label in the page
    contains "Tyre" (the CD, 2026-11-04).
- Expected total: step 6's + 8 (158 + 34 = 192 if nothing else landed).

### Step 8 - breaks, frame cost, docs

- **Breaks**, at least: Snow pickable outside winter; an old save reading Rain; `wxAt` drawing from
  `TRAFFIC.rnd`; Auto ignoring the season (snow in spring); `wet` that never dries; an overcast term left on
  under Clear (`uCloud` 0.01); the sun's disc through cloud; stars through cloud; `uFog` unchanged in fog;
  no headlights in rain by day; rain inside the car (no cull); streaks ignoring the car's motion; the road
  not darkened when wet; the glass pass in the chase view; wipers that do not clear; a constant wiper rate;
  snow cover on a treated road's lanes; markings not fading on a two-lane road; no tire tracks; winter
  lawns straw again; grip unchanged when wet; snow's 0.3 on a treated road; traffic not slowing; the rain
  channel on another slider; rain heard under Clear; no roof drumming; no wet-tire hiss; birds in the rain;
  a node a frame in the rain sound; "Tyre" back on a label. Each with a `row` field naming the row meant to
  see it (`.claude/tests/negtests/driving-simulator.json`, 79 now). Run them on copies with
  `negtest-copies.py` in foreground chunks (`--only`), not beside another Chromium suite. A harness built
  from the suite's own boot and the new sections, copied verbatim, is fine when the whole suite is too slow
  here; say so and pass it on the unbroken page first. A MISSED break gets a row or an argued equivalence.
- **Frame cost**, SwiftShader, 390x844 at dpr 3 and 844x390: Clear, Rain 1.0, Fog 1.0 and Snow 1.0 (winter),
  chase and cockpit: draw calls, triangles, `frame-budget.cjs swiftshader=1` medians over three runs, the
  frame copy's cost. Into `.claude/driving-simulator.md` § Measured.
- **Docs:** `.claude/driving-simulator.md`: DS-8 and DS-11 built, the assumed rows, § Architecture (a
  Weather paragraph: the state, the timeline, the shader terms, the passes, grip, sound), § Testing (the
  rows and breaks), the suite's count on line 6, and "tyre" -> "tire" in the file's prose (identifiers
  such as `tyres`, `tyreG` and `noTyres` stay as they are); `.claude/tests/README.md` (the count and a
  weather sentence); `games/CLAUDE.md`'s Driving Simulator paragraph.

### Step 9 - ship

- `stamp-badge.sh games/driving-simulator/index.html`, then `check-inline-js` and `gates.sh` after the
  stamp (alone). Read the badge back out of the file.
- Move this plan to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>`, with a Results section.
- Land with `land-on-main.sh` (dry run first). Message:
  `feat(driving-simulator): rain, fog and snow, Auto or picked (DS-8, DS-11)` with the session's trailers.
  If `behind`, merge `origin/main` into the branch, re-run the gates, check the other session's files
  survived.
- `TODO.md`: the entry to `DONE.md` with the badge string. The other driving-sim items in § Next (DS-9,
  DS-10, DS-12) were held back from planning until this lands: say in the report that they are ready for
  `/zmh-producer:backlog-plan-gen driving-sim`.
- Verify the Pages run for the landed SHA (two checks, then report).
- Report: the badge string, the playtest list, the assumed rows, the frame cost.

## Gotchas / bindings

- **Clear must not move a byte.** Guard every new GLSL term with `if (uX > 0.0)` or a factor that is exactly
  1.0, and every new JS factor likewise. `WX_BEFORE` is recorded on the base page; recorded after an edit it
  proves nothing.
- **Never draw from `TRAFFIC.rnd` or `Math.random`** for the weather. The traffic would move and the seeded
  sound rows would hear different dice. The weather's stream is `hashSeed(WORLD_SEED, 'wx-' + mjd)`.
- **No disc in the fog.** Weather fog mixes toward `skyBase()` (now overcast), never `skyBodies()`: that was
  DS-7's column.
- **The look is `lookSeason`, not `SETTINGS.season`.** The DST rows write `SETTINGS.season` directly; snow
  that keyed off it would fall on a spring-looking road.
- **No chunk rebuild for weather.** Only DS-11's lawn colour is baked (it changes with the season, not the
  weather).
- **The windscreen pass draws after the world and the cabin** with depth test on; the cabin's A-pillars and
  dash must cover it. Build the quad 2-3 mm inside the glass line so it never z-fights the body's glazing.
- **`copyTexSubImage2D` from an antialiased default framebuffer** is expected to resolve implicitly (from
  memory: verify with `gl.getError()`); iOS Safari is untested. The fallback (no refraction) must exist.
- **The precipitation pass in the mirror** uses the mirror's eye and basis; the car-box cull uses the
  player's car in every pass (the mirror camera sits inside the car).
- **The world pass culls back faces; the precip and glass passes must not** (a quad facing away would
  vanish), and they must restore `CULL_FACE`, `BLEND` and `depthMask` as they found them.
- **Timed rows go red under load.** Run the gates alone; never count a catch only a timed row made. The
  sound rows use `lvT` for exactly this reason.
- **Hue of a linear colour:** convert each channel to sRGB first, then HSV (as DS-3's rows do).
- **Spelling:** "tire" in every new string, comment and doc line; saved keys and existing identifiers keep
  `tyre` (a renamed `vols` key silently resets players' volumes).
- **Two copies of shared prose:** the Driving Simulator paragraph in `games/CLAUDE.md` and the
  `.claude/tests/README.md` row; fix both in step 8.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. No model names in commits or files. Another
  session works in this repo at the same time (combat-sim): never commit its files.

## Validation

`check-inline-js` after every page edit; `gates.sh` at the end of every step, alone, red only where the base
page is red; the break list in step 8 with every break caught or argued. Beyond the gates, the CD's eyes and
ears (assumed: a phone, sound on):

- Settings, Weather: Auto by default; Clear, Rain and Fog pickable; Snow greyed out until the season is
  winter.
- Rain: a grey sky with no sun, a dark shiny road that shows the streetlights at night, streaks that slant as
  you speed up, the headlights on by day, and longer stops. In the cockpit, drops on the glass, the wipers
  clearing them (slow in light rain, fast in heavy), rain drumming on the roof and wet tires hissing.
- Fog: the road and the hills disappearing within a few hundred metres.
- Winter, Snow: flakes falling; grass, roofs and pines going white; on two-lane roads the lanes white with the
  lines fading and darker tire tracks; on four- and six-lane roads black wet lanes with snow on the
  shoulders; the car sliding and stopping long on the white roads; the town's lawns still green under Clear.
- Clear: exactly as before, in every season.

## Follow-ups

- Thunderstorms: lightning that lights the scene and thunder delayed by distance (the CD chose "no storms"
  for the first pass).
- Splashes where rain hits the road, and spray thrown up behind the cars.
- Stretched reflections of lights on a wet road (anisotropic), if the round highlights read wrong.
- Snow on parked or slow cars; snowbanks as geometry at the plowed edges.
- The other driving-sim items held until this lands: DS-9 (car and colour), DS-10 (a median), DS-12 (the
  trees' structure pass), then DS-13 (Later).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dsweather.rain-fog-snow.md
```
