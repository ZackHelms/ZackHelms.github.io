# Procedural gait: why it snaps, how to measure it, and balancing on a COM model

From Animation Rigs A002 (2026-10-05). The CD reported legs and feet that
"snap from one frame to the next" and a torso too upright on stairs. Full
detail lives in `.claude/animation-rigs.md`; this note keeps what generalises
to any procedural animation (any game here with planted feet and IK limbs).

## Measure snaps as impulses, not as big accelerations
A plain threshold on frame-to-frame acceleration (second difference of joint
positions) counts fast but smooth motion as snapping: running feet legitimately
exceed it, and "fixes" that slowed nothing down read as regressions. What the
eye sees as a snap is an **impulse**: a joint's acceleration far above its own
recent average. The metric that worked: flag a joint when its second difference
is > 0.02 m (at 60 Hz) AND > 3x the mean of its previous four frames.
Before trusting it, prove it sees the old bug (A001: ~282 per 1000
figure-frames, worst 1.63 m/frame², a foot teleporting).

Then bisect by category (lift-off / mid-swing / landing / stance, stairs vs
flat, walk vs run) and by joint. Whole-body impulses (pelvis, spine and head
together) point at the pelvis or root; legs-only point at the feet or IK;
head-only at trunk rotation.

## The causes, roughly in order of how much they cost
1. **A swing defined as a phase window** (`lp < sf`): when the gait's swing
   fraction changes, a foot drops into or out of the middle of a swing. Give
   each swing its own clock, started by an event.
2. **A target recomputed every frame and quantised** (snapped to stair treads,
   or recomputed when a turn starts late): the foot jumps with it. Glide the
   target, commit it before touch-down, add hysteresis to the quantisation.
3. **IK singularities**: near full extension the knee position changes
   enormously for tiny target changes, and a fixed pole flips the knee
   sideways when the limb lines up with it. Soft IK (ease the reach toward
   full extension) plus a **sagittal pole** (side axis x limb direction, a
   quarter turn from the limb, so it can never line up with it). That pole is
   also anatomically right for every leg orientation.
4. **First-order lag on a target that steps** (`x += (t-x)*k`): position is
   continuous but velocity jumps. Anything whose target can step (pelvis
   height when a reach limit switches feet, lean, sway, load shares) wants a
   critically damped spring.
5. **Curves with non-zero end slopes**: a `sin` step arc lands with vertical
   speed. `sin²` lifts and lands at zero.
6. **Timing curves for obstacle clearance** ("rise early when stepping up")
   switch shape as the target crosses a threshold. Follow the terrain
   profile dilated by a slope cone instead, through a spring. Never chain a
   rounded max across many segments: it inflates flat plateaus.
7. **Feedback loops in the gait clock**: an early lift that lands just after
   its own slot misses that slot and lifts early again, every cycle. Re-time
   the clock on an early lift and let anything driven by the clock (arms)
   follow through a sprung offset.
8. **Snapshot pose blends** freeze velocity at the state change; extrapolate
   the snapshot along its last velocity.

## Balance from a mass model
Fourteen segments with Winter/Dempster mass fractions give a whole-body COM
from any pose in a few dozen multiplies. Solve one degree of freedom against
it per frame (trunk lean walking; hips fore-aft while reaching) with a
numeric sensitivity probe, low-pass the error so per-step wobble does not rock
the trunk, and drive the result through a spring.

**The target is the centre of pressure, not the ankles.** A first version
targeted the ankle midpoint and leaned every figure backwards, because bent
knees and the swing leg put the COM ahead of the ankles, and so does a real
human: standing, the COP is ~5 cm in front of the ankles; walking it rolls
heel to toe, ~7 cm ahead on average. Accelerating needs the COM further ahead
by about a*h/g. On stairs the upper foot carries the body.

Also check the rig's resting geometry before tuning balance: A001 stood with
its knees bent ~30° (pelvis height 0.93 m for 0.89 m legs), which shifted the
COM and made every balance number look wrong.

## Versions that cannot drift
When a CD wants to compare versions side by side, freeze the old code paths
(new functions or `VER>=n` branches, never edits), copy the shipped page into
a test fixture, and assert the old selection reproduces it **bit for bit**
under a seeded `Math.random` with `requestAnimationFrame` and timers stubbed.
A new version must not consume `Math.random` on an old version's path.

## Addendum (same day): the safety valve that became the gait
A002 shipped with an "out of reach, lift now" rule whose thresholds the rig's
own (newly taller) standing pose crossed on almost every normal toe-off. Every
step was then an early lift that re-timed the gait: 0.32 m steps at 2.3
strides/s, which the CD saw at once and no smoothness metric could, because it
was smooth. Two lessons: **measure the gait itself** (step length and cadence
against human norms, ~0.7 m and ~0.9 strides/s walking) whenever you touch a
gait, not only its smoothness; and a corrective rule should be **rare** in
normal motion, so count how often it fires.

Standing balance is done at the hips and ankles, not by tilting the trunk.
Solving a standing figure's COM error with trunk lean rocked it about +-15
degrees; a fore-aft pelvis shift with the trunk upright is both what people do
and what reads as standing still.

Shadows of a figure on stairs: projecting onto one flat plane at the tread height
jumps a step per tread; projecting onto the exact treads still jumps wherever the
light falls off a step edge. For a stick figure the smooth line through the tread
centres reads best.

## Addendum (A004): adding physics to a procedural walker

The CD's report: climbers squat, a runner's mass sits on its heels at the bottom
of a flight and leans further forward at the top, where a real runner leans while
speeding up and straightens at speed. Traced cause: the root moved on a scripted
speed ramp and the trunk was bent afterwards to put the COM where the support
wanted it, which runs cause and effect backwards (braking leaned back, speeding
up leaned forward, whatever the eye expected).

What was tried, in order:
- **Full stepping physics** (COM as an inverted pendulum, feet placed at capture
  points): figures needed a balance assist 6-30% of the time, walked backwards
  when a foot lifted with the COM behind the other one, and fell off the flights
  whenever a step could not catch them. Too unstable to be the motion itself.
- **Plan + leash** (a planned root the physics COM is pulled toward): diverged
  into 15 m/s runaways whenever the leash and the step placement disagreed.
- **What shipped:** simulate the stable parts (the trunk as a rigid body on the
  hips under a torque-limited PD, the pelvis height with legs that push but never
  pull) and impose the unstable part through the **force law**: the COM sits
  ahead of the feet by `h * a / g` for the plan's acceleration, then solve the
  pose so its COM is exactly there. Make the plan physically feasible (jerk-limited
  human accelerations, turn rate <= ~0.6 g lateral, brake before corners) so the
  law never asks for an absurd lean.

Lessons: a vertical that can fall but not pull makes landings late, which shows
as a pelvis snap, so preview the landing reach and land toe-first; measure big
per-frame jumps (> 0.3 m) across several seeds, not one; and write each realism
check so the previous version **fails** it, or it proves nothing.
