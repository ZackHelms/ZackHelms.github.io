# Wayfinder — architecture & context

`games/wayfinder/index.html` (single self-contained file, ~1150 lines). A
first-person 3D valley you navigate with a paper map and a compass. **The only
WebGL page in the repo** and the only game that teaches a real-world skill.

## The two decisions everything else follows from

1. **There is no "you are here" dot.** The map shows terrain, not your
   position. You keep your place by dragging a *thumb marker* and moving it as
   you pass features you recognise — real thumbing. Every lesson that scores
   position (thumbing, relocation) compares the **thumb** against the true
   position; the player never sees the answer. Putting a dot on the map would
   delete the entire skill the game exists to teach.
2. **The map must be honest.** Contours, vegetation, watercourses and point
   features are all generated from the same heightfield and land grid the world
   is built from — so anything on the map is really there, and nothing is drawn
   in the world that isn't mapped. That is why the only 3D landmarks are the
   four mapped ones (boulder, cairn, ruin, wall end) plus the control flag.

## Terrain: bake once, sample everywhere

`rawHeight(x,z)` is the expensive authored function — fbm base, five cosine
hills, a river valley carved toward `riverBed(s)`, a beck, track corridors, and
an explicit reentrant gully. It is evaluated **once per grid node at boot** into
`HGT` (257×257 at `GRID = 4 m` over a 1024 m square). `heightAt()` is a bilinear
sample of that grid, so rendering, collision, contours and the map can never
disagree about the shape of the ground. `LANDG` bakes the land type per cell the
same way and `landAt()` is a lookup.

**This is load-bearing for performance.** The first build called the raw
functions per pixel/vertex and took ~16 s to boot; grids plus cached polyline
lengths (`prepPoly`) brought the real work to ~0.5 s. (Note: in the sandbox
*every* game appears to take ~13 s to load — that is the blocked Google Fonts
request, not the game. Measure boot with `performance.now()` around the build
functions, not with `page.goto`.)

Named features: Beacon Hill (the 148 m climbable summit, with the cairn), Crow
Knoll, Long Fell, Mill Stream (the river, N→S, bed falls 40 m → 6 m), the Beck
(tributary off Beacon Hill's west flank), Ridge Track and Wood Lane (handrails),
the stone wall, and the reentrant. Every lesson is authored against one of
these, and a drive test asserts the reentrant is a genuine hollow — a lesson
that points at terrain the noise happened not to produce would be a lie.

## Movement and route choice

`stepSim(dt)` moves the player on the surface. Speed = base × `LAND_SPEED[land]`
(trail 1.32, open 1.0, forest 0.82, dense 0.42, marsh 0.55, water 0.3) × a slope
term that punishes climbing and mildly rewards gentle descent. Deep water
(> 1.15 m) and slopes steeper than 1.25 rise/run are refused. **This is what
makes route choice a real orienteering decision** — the straight line through
the plantation is genuinely slower than the track around it.

## Navigation maths

World convention: **+x east, +z south**; bearing 0 = north = −z, clockwise.
`bearingTo`, `angDiff`, and `trueToMag`/`magToTrue` applying `DECLINATION`
(11.5° E). The compass needle points *magnetic* north, the map carries magnetic
north lines, and bearings taken off the map are reported as magnetic readings —
so the declination is something the player actually navigates with, as in real
life. "Red in the shed" = heading within 4° of the dialled bearing; the needle
and the housing go green. Pace counting is `PACE_M = 1.62 m` per double-pace.

## The lesson engine

`LESSONS[9]`, taught in the order orienteering clubs teach them: orient the map
→ handrail → thumbing → bearing → pace counting → aiming off → contours →
attack point → night relocation. Each has a `check` type consumed by
`questUpdate()` (per-step) and `mapConfirm()` (map CONFIRM button):

| check | passes when |
| --- | --- |
| `orient` | map rotation is within 12° of the ground (`mapRot ≈ -yaw`) |
| `goto` | control reached |
| `thumb` | 3 checkpoint prompts answered, each scored on thumb error |
| `bearing` | bearing dialled from the map, then the control reached |
| `pace` | reach a point 170 m on bearing 108° from the wall end (no feature there) |
| `aimoff` | control reached; the debrief reports whether you hit the Beck first |
| `attack` | control reached; the debrief reports whether you used the Boulder |
| `relocate` | thumb placed within 70 m of the true position **in the dark**, then walk home |

**Finding the control is not the same as doing it properly.** `tryComplete()`
runs `techniqueFailure()` before any lesson completes, and arriving without the
technique is refused with coaching that says what you actually did:

| lesson | requirement |
| --- | --- |
| handrail | ≥ 90 travel samples AND ≥ 55% of them within 45 m of the water |
| thumb | ≥ 2 of 3 thumb placements inside 55 m |
| bearing | bearing taken to within 45 m of the cairn **and** held on-line for ≥ 50% of walking |
| pace | counter armed at the wall, counted distance within 22% of 170 m |
| aim off | met the Beck **> 45 m from the control** (touching it at the flag proves nothing) |
| attack | passed within 30 m of The Boulder |

The debrief then grades *how well*: handrail percentage, thumb errors in metres,
pace count against the real distance, and so on. That is where the teaching
happens.

**Coach hints.** Each lesson carries `hints[]`. If your distance to the target
stops improving for ~55 s (then ~80 s), the coach names a *technique* — "climb
for a view", "the track runs east–west", "hit the Beck and turn". It never says
where you are; that would hand back the dot the whole design removes.

**Map marks.** The MARK tool pencils a purple ✕ anywhere on the map; tapping an
existing mark rubs it out. Marks persist in the save. This is what orienteers do
with a pencil — flagging an attack point, or a feature you have positively
identified while relocating.

## Rendering (raw WebGL2 — the documented exception)

House convention is Canvas 2D and no external libraries. 3D terrain cannot be
done convincingly in Canvas 2D, and Three.js is a library, so this game uses
**hand-written WebGL2 + GLSL** with all assets generated procedurally. The
exception is recorded in `games/CLAUDE.md` § Rendering.

Four programs: sky (fullscreen triangle, ray direction reconstructed from the
inverse view-projection; gradient by sun elevation, sun disc/glow, hash-noise
stars at night), terrain (one static 131k-triangle draw call for the whole
kilometre, lambert + micro-relief normal perturbation from value noise so the
4 m mesh doesn't read as felt, exponential fog, a headlamp cone at night), water
(only wet cells, animated normals, fresnel + sun glint), and instanced
billboards for trees and landmarks (4-tile procedural atlas: conifer, broadleaf,
rock, control flag; per-instance tint and base darkening so a wood doesn't look
like one sprite repeated).

Day/night is a **24-minute cycle** (`DAY_SECONDS`): `sunElevation()` drives the
whole palette, fog density, ambient level and star opacity.

The HUD is a second 2D canvas over the GL canvas — baseplate compass with
rotating housing and orienting arrow, clock, pace counter, joystick.

## Input

Twin-stick: the lower-left quadrant is an invisible virtual joystick (walk), and
dragging anywhere else looks around. Map screen: drag to pan, pinch to zoom,
a MAP ROTATION slider (orienting the map), and two armed modes — THUMB (tap to
place your claimed position) and BEARING (tap a target; the bearing is taken
from the thumb, as it would be from your thumb on a real map).

## Graceful degradation

If `webgl2` is unavailable the game does not throw: `gfxOk` stays false, the HUD
prints a message, and the whole simulation, map and compass still run. That also
means the drive suite exercises everything without a GPU.

## Test hooks (`scratchpad/drive-wayfinder.cjs`, 67 checks)

Everything is top-level and reachable from `page.evaluate`: `HGT`, `LANDG`,
`heightAt`, `landAt`, `waterDepthAt`, `polyNear`, `bearingTo`, `trueToMag`,
`stepSim`, `moveVec`, `player`, `thumb`, `bearingSet`, `mapRot`, `mapConfirm`,
`startLesson`, `beginRun`, `questUpdate`, `questTargetPos`, `LESSONS`, `save`.

Gates worth keeping:
- **BFS walkability gate** — flood-fill the 4 m grid using the *same* rules the
  movement code uses (depth < 1.15, step gradient < 1.25) and assert every
  lesson control, the summit and the footbridge are reachable from the start.
- **Final-leg gate** — reachability from the start is NOT enough. A control can
  be reachable the long way round while the leg the lesson *tells you to walk*
  is blocked. This gate greedily walks each intended leg (attack point →
  control, Beck → aim-off control, flank → reentrant) and asserts no intended
  leg crosses ground the mover refuses. It was written after it turned out the
  attack-point control sat behind a **74° face** from its own attack point, and
  the aim-off control sat **in the stream channel** where the depth rule makes
  it unreachable. Both are now on ground you can actually stand on.
- **Cheat gate** — teleport to each control *without* performing the technique
  and assert the lesson refuses to complete. This is the test that keeps the
  teaching honest as the game changes.
- **Terrain honesty** — summit is Beacon Hill, river bed falls monotonically,
  all six land types present, and the reentrant is a real cross-slope hollow
  that drains downhill.
- **Scripted completion** — every one of the 9 lessons is completed
  programmatically, so no lesson can be shipped unfinishable.

Screenshots need long waits: headless uses SwiftShader at roughly 0.4 s/frame.
