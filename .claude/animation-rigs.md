# Animation Rigs — context

`games/animation-rigs/index.html`, one self-contained file (~1,520 lines).
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

## Versions (CD request 2026-10-05)
A **version** dropdown sits top-right beside the **speed** dropdown (4x / 2x /
1x / half / quarter, default 1x; both are native `<select>`s on `change`, never
`bindTap`). Versions are listed newest first and the newest is the default;
`?v=A001` opens an older one. Switching is live: every figure blends 0.35 s
into the new model.

- **A001** is the first release. **Its code paths are frozen**: `locoParams`,
  `pressParams`, `getupParams` and every A001 branch are never edited. A later
  version adds its own function (`locoParams2`, `pressParams2`,
  `getupParams2`) or branches on `VER>=n`; blend durations go through
  `BD(a001, a002)`. `buildPose`/`ik2` take A002-only fields (`softIK`,
  `sagPoles`, `roll`, `sideLean`, `breath`) that are absent, and therefore
  inert, in A001's parameter blocks. The suite proves it: the shipped A001
  (`.claude/tests/fixtures/animation-rigs-a001.html`, from commit 6c9d5ff) and
  the page opened with `?v=A001` produce the same joints **bit for bit** for
  300 s under one seed. A version must also never consume `Math.random` on an
  older version's path, or that comparison breaks.
- **A002** (CD notes: legs and feet snap between frames; torso too upright on
  stairs; humans bob and sway) adds the three things below. **Frozen**
  2026-10-05 with fixture `animation-rigs-a002.html` (from commit 2a58ef2).
- **A003** fixes A002's flat-ground walk (below). The current default.
- **Adding A004:** copy the shipped page into `fixtures/animation-rigs-a003.html`,
  add `{id:'A004',n:4}` to the front of `VERSIONS`, write new functions or
  `VER>=4` branches (never edit a path an older version runs), add it to `VERS`
  in the suite and bump the `S.VER === 3` default check. The CD chose, on
  2026-10-05, that a fix to a shipped version ships as a NEW version rather than
  a correction, so the old one stays selectable for comparison.
- **Why the freeze is the point (CD, 2026-10-05, after A003):** "I definitely
  want to keep each version separate; part of this experiment is observing each
  incremental change." The version list is the experiment's record, not a
  compatibility shim, so a behaviour fix is never back-ported into an older
  version, even a clear bug. **Open question for the CD:** the A003 stair-shadow
  fix (below) is renderer-only and was applied to every version; joints stay
  bit-identical, but A001/A002 no longer show their original snapping shadow. If
  the CD wants that visible too, gate `charShadowSteps` on `VER>=3`. Until the CD
  answers, ask before shipping any other cross-version renderer change.

### A003 (CD report 2026-10-05: "regular walking on the ground looks weird; the model leans back and takes short rapid steps")
Measured, not guessed: A002 on flat ground took 0.32 m steps at 2.3 strides/s
(A001 and real walking: ~0.7 m at ~0.9/s). Cause: A002's early-lift rule
("a stance foot out of reach lifts now") used thresholds that A002's own taller
standing pelvis crossed on almost every ordinary toe-off, so the gait was re-timed
every step. A003 (`VER>=3` branches inside `locoParams2`; A002 is frozen with its
own fixture):
- early lift only for a foot really out of reach (`behind` < -(0.62+0.25ra)s or
  reach > 0.93s; `otherOk` at 0.96s);
- balance targets retuned for full strides (`T3`: walk 0.035, run 0.015, stairs up
  0.10, down 0.19 m of COM lead) and braking leans back at 0.025*a, not 0.06*a;
- standing balance with the **hips and ankles** (fore-aft pelvis shift), trunk held
  upright; the trunk takes over as the figure gets moving (`wl` blend on `mv`).
Result: steps ~0.66-0.69 m at ~0.95-1.03 strides/s, walking lean ~5 deg and never
negative at the 5th percentile, standing ~2 deg with a ~7 deg spread (A002: ~30),
stairs up ~19, down ~1, running ~14.5; snaps 41 per 1000 (A002 49, A001 282).

### Shadows on the structure (renderer, every version)
A figure up on the structure used to cast its shadow onto ONE flat plane at the
height of the tread under its root, so the whole shadow jumped ~12 cm each time it
climbed a tread (CD report, same day). Projecting onto the exact treads is no
better: the light falls downhill on flight A, so the shadow of a moving point drops
off each step edge. `charShadowSteps` marches each point (bones subdivided x4) down
the light ray to `shadowY()`: over a flight the smooth line through the tread
centres (the ramp when folded), elsewhere the real platform/tower/ground height;
pieces landing > 0.6 m below the figure (off an edge) are left out. Fallers and
sliders get a shadow too now. This is drawing only: no version's joints change,
which is why A001/A002 stay bit-identical. Measured: a climber's head shadow moves
> 6 cm in one frame 5 times in 18,371 frames (flat plane: 524).

### A002: why it snapped and what fixed it
Measured with an impulse metric (a joint's frame acceleration more than 3x its
own recent average and > 0.02 m/frame^2), A001 had ~282 snaps per 1000
figure-frames, 23,784 of them in the legs, worst 1.63 m/frame^2 (a foot
teleporting). A002: ~49, legs ~3,000, worst ~0.23. The causes, in the order
they were found, are worth knowing for any procedural gait:
- **Swing defined as a phase window** (`lp < sf`): when `sf` changes (walk ->
  run) a foot drops into or out of the middle of a swing. Fix: a swing starts
  when the foot's phase wraps and runs on its own clock (`ft.t`), which
  follows the current gait.
- **Lift-off from the flat foot while the heel was raised**: ankle dropped
  ~10 cm at lift-off. Fix: swing starts from the displayed ankle (`fromAnk`)
  and the heel offset decays.
- **Landing target recomputed and tread-snapped every frame**: it jumped 0.5 m
  when the prediction crossed a tread edge, or when a turn began late in a
  swing. Fix: hysteresis snap (`snapTread2`), a glide (`toS`, tau 0.06 s),
  commit at t=0.85, the target height reached through a spring and made
  exact for touch-down; on flights `stepOver()` lands each step one tread
  beyond the other foot, and steps that leave a flight land clear of the edge.
- **Rise-early / drop-late timing curves on stairs** switched branch when the
  target height crossed a threshold, and lifted the foot to hip height while
  still far behind (knee whip). Fix: `clearY()`, the stair profile dilated by
  a slope cone, followed through a spring, acting mid-swing only. Do not use a
  rounded max chained across treads: it inflates plateaus by centimetres.
- **sin() step arc**: non-zero vertical speed at lift-off and touch-down. Fix:
  sin^2.
- **IK singularities**: a knee whips as the leg nears full extension, and flips
  sideways when the hip-to-ankle line nears the pole. Fix: soft IK (`soft`
  arg to `ik2`) and **sagittal poles** (pole = side axis x limb direction, a
  quarter turn from the limb, so it can never line up with it).
- **First-order lag on targets that step** (pelvis height when the leg-reach
  clamp switches feet; lean; sway): velocity jumps. Fix: `spring()`
  (critically damped) for pelvis height, lean, fore-aft and lateral offsets,
  head pitch, foot load shares, the arm-phase offset.
- **Gait desync**: an early lift landed just after its own slot and so lifted
  early again every cycle (both feet planted, body walking off them). Fix: an
  early lift re-times the gait clock; the arms follow through a sprung
  offset (`B.aOff`) so they never jump.
- **Snapshot pose blends** freeze velocity at a state change. Fix: the
  snapshot is extrapolated along its last velocity (`snapV`).
- Smaller: hard speed cut at a closed flight (now brakes on approach),
  one-frame crowd shoves (rate-limited), ladder toe/pole switches (blended),
  stair cadence switching in one frame (eased).

### A002: body masses and balance
`SEGS`: fourteen segments with Winter/Dempster mass fractions and segment-COM
positions (head+neck 8.1%, trunk 49.7%, upper arm 2.8%, forearm 1.6%, hand
0.6%, thigh 10%, shank 4.65%, foot 1.45%). `comOf(J)` is the whole-body centre
of mass of a built pose. Each frame `locoParams2` compares it with a target and
moves either the trunk lean (walking, solved with a numeric sensitivity probe
and a low-passed error so per-step wobble is ignored) or the hips fore-aft
(`mod` present, i.e. reaching for the button). The **target is the centre of
pressure, not the ankles** — that was the bug behind a first version that
leaned everyone backwards: standing it is the feet midpoint + 5 cm, walking
~7 cm ahead of the ankles on average, plus acceleration x ~0.06 (a*h/g), and on
stairs a load share toward the upper foot plus a bias (climbing pushes off the
upper step). Laterally the target is the loaded foot, 85% standing and 35%
walking; foot load shares are springs; the swing-side hip drops (`roll`,
~4 deg) and the trunk leans toward the stance side (`sideLean`). Standing
figures breathe, sway ~1 cm and shift their weight leg to leg every 2.5-6 s.
`getupParams2` solves the lean so the mass is over the feet once the hands
leave the floor. Measured (skeleton pelvis->chest line): walk ~4 deg forward,
stairs up ~22, run ~13.5, standing ~-2; walking sway ~3.4 cm and standing
weight shifts ~15 cm (5th-95th); the pelvis bob is +-2.4 cm per step by design.

Legs: A001 stood with knees bent ~30 deg (pelvis 0.93 m for 0.89 m legs).
A002 carries the pelvis at ~0.985 m standing, lower walking/running, and 17 cm
lower on stairs, where the next tread is otherwise out of reach.

## Tests
`.claude/tests/drive-animation-rigs.cjs` (~30 s), all seeded with `rAF`
stubbed: the rules under every version; A001 and A002 bit-identical to their
fixtures; the newest version's gait (step length, cadence), balance and the
stair-shadow smoothness; plus, from the A002 era: the rules under both versions (no NaN, no bone stretch outside
blends, climbs/presses/slides, ladder and tower limits, nobody on a slide, no
fold under a rider, nobody inside a block, planted feet on their surface as a
bounded rate); **A001 bit-identical to the fixture**; A002 snaps <= 30% of
A001's overall and <= 20% in the legs, worst < 0.35; A002 lean/sway/bob
ranges; both dropdowns, live switching and `?v=`; the button by hook and by a
real tap. Negative-tested 2026-10-05: freezing the lean, editing an A001 blend
and turning off soft IK + sagittal poles each turn it red. `--shots <dir>` for
eyeballing.
