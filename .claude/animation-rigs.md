# Animation Rigs — context

`games/animation-rigs/index.html`, one self-contained file (~1,100 lines).
CD commission 2026-10-04. Placed directly after CYOA on the hub. Open (MIT).

## What it is
Eight stick-figure humanoid rigs (21 joints each, vertex dots on every joint)
living in a grey-box course you orbit and zoom: two flights of stairs up to a
platform and back down, and a ladder up a tower with a red button on top. The
button folds both flights into slides; whoever is on them falls, turns
feet-first, slides to the ground and gets up. The slides fold back to stairs a
few seconds later. No goal, no score: the motion is the content.

## The CD's spec, and how each line was read
- "walking or running around inside a three-dimensional gray box scene where I
  can rotate and zoom": orbit drag, pinch / wheel zoom, plus two-finger /
  right-drag pan and tap-a-figure-to-follow (not asked for; cheap and it is
  how you study one rig).
- "stairs to go up to a platform and then stairs that go down": stair A rises
  toward +x, platform at y=3, stair B falls toward +x. 11 treads of 0.25 x 0.5.
- "a ladder ... to a platform where they push a button that turns the stairs
  into slides": separate tower (y=3.6) behind the stairs, ladder on its +z face.
- "the fall animation followed by slide animation as they slide down": `fall`
  (0.55 s: lose footing, arms flail, turn feet-first, drop onto the back) then
  `slide` (gravity minus friction down the ramp, friction on the floor), then
  `getup` (1.5 s, hands behind, feet in, rise over the feet).
- "The slide changes back to stairs after a few seconds, which should be
  sufficient for all of the characters to end up back on the ground": held at
  least 4 s AND until no faller/slider is still on a ramp (`stairsLogic`). The
  drive suite asserts it never folds under a rider.
- "After that character pushes the button they climb back down the ladder":
  yes, via the tower-top wait spot.
- "If the character is on the ladder or on that platform, the other character
  will attempt to climb up the ladder": read as a **one-ladder queue that is
  always staffed**. `ladderAssign()` keeps exactly one `ladder.next` walking to
  / waiting at `Q_PT`; it climbs once the ladder is free, nobody at the top is
  waiting to come down (they go first), and fewer than two are on the tower.
  Net effect: one person presses, the next is already climbing, the presser
  waits at `S_W` and goes down when the newcomer is off the ladder. The button
  only works while the flights are stairs (it glows then); a press during a
  slide cycle buzzes and does nothing, so a climber who arrives early "attempts"
  it and leaves. If the CD meant something else (e.g. a race up the ladder, or
  the climber being pulled off), this is the place to change.

## Architecture
- **Pose = function of a parameter block.** Every state builds a `P` (pelvis,
  body frame f/u, lean, twist, ankle + toe targets, hand grips with weights,
  pole vectors) and `buildPose(s,P)` returns the 22 points (21 joints + a nose
  tip for the facing tick). Arms and legs are always `ik2` two-bone IK, so bone
  lengths are exact (the suite asserts it).
- **State changes blend** joint positions from a snapshot over `blendDur`
  (`setState`). Bones may stretch during a blend; nowhere else.
- **Locomotion (`locoParams`)**: feet are planted in the world; a foot swings
  during its window of the gait phase toward a landing predicted from velocity
  (`lead = spd*(remaining swing + half stance)`), snapped to tread centres on
  stairs (`snapTread`, one tread per step walking, two running via the cycle
  length). Heel peels late in stance; toe pitches through swing; pelvis bob
  inverts between walk and run; pelvis is clamped to what both legs can reach,
  then smoothed. Standing still with a misplaced foot keeps the phase running
  until both feet are re-planted under the hips (that is the turn-in-place and
  settle step). Planted feet follow `footY` every frame so a fold under a
  waiting figure can never bury a foot.
- **Ladder (`climbP`)**: continuous climb coordinate `c`; limbs in diagonal
  pairs (LF+RH, RF+LH), each two rungs per cycle, pelvis `0.6c+0.64`. `on`,
  `mount`, `unmount`, `off` are keyed transitions (`bottomP`, `mountP` with
  pelvis keyframes chosen so the trailing leg never over-reaches). C_END=5.45
  is where both feet are planted on the top rungs.
- **Tasks** are step lists (`go` / `idle` / `face` / `wait` / `call` /
  `climbUp` / `climbDown` / `press`) run by `runSteps`; `newTask` picks wander
  (55 %) or a stairs crossing (45 %, sometimes pausing on the platform).
  Waypoints flagged `st` are stair segments: a figure holds at the edge while
  the flight is not stairs. Anyone who still ends up on a flight that is not
  stairs falls (`update`), which is also what catches a runner's momentum.
- **Ground nav**: visibility graph around the two inflated blocks (`navPath`).
- **Rendering**: hand-written perspective projection onto Canvas 2D. Static
  faces subdivided into <=0.75 m tiles (`addQuad`) so painter's sorting holds;
  back faces culled; near-plane clipped. Each figure is ONE sort item (depth of
  its pelvis) drawn with its own internal bone/dot sort. Floor shadows: box
  hulls projected along `LDIR`, unioned in one `nonzero` fill; figures on the
  floor cast projected-bone shadows, figures up on the structure cast them on
  the plane under them.

## Tuning numbers worth knowing
`A_RAMP = 9.8(sin - 0.25cos)` ~ 2.5 m/s^2, floor friction 0.5 g: a slide from the
top reaches ~5.6 m/s and runs out ~3 m past the bottom, inside the floor.
Climb rate 0.9 c/s (0.54 m/s). Walk 1.35 m/s, run 3.5 m/s, both x0.62 on stairs.

## Tests
`.claude/tests/drive-animation-rigs.cjs` — 300 simulated seconds through the
`window.__AR` hook: no NaN, no bone stretch outside blends, repeated climbs,
presses and slides, <=1 on the ladder, <=2 on the tower, nobody walks onto a
slide, no fold under a rider, no walker inside a block, no buried planted
foot, armed / refused button presses. `--shots <dir>` for eyeballing.
