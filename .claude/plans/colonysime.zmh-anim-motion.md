# colonysime — Colony Sim's settlers move on the zmh-anim kit

**Status:** DRAFT
**Requested:** 2026-11-28 (the CD installed zmhstudio's new **zmh-anim** plugin "so that you can
use it to update the settler movement animations", then "proceed").
**Scope:** `games/colony-sim/src/` (a new vendored `anim-rig.js`, `rig.js`, `main.js`),
`games/colony-sim/build.mjs`, `games/colony-sim/tools/` (a new vendored `anim-snaps.mjs`, a new
`gait.mjs`, `test-sim.mjs`), the generated `games/colony-sim/index.html`, `.claude/colony-sim.md`.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) — the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

The settlers walk, run, stop, start and turn the way Animation Rigs' figures do, built on the
**zmh-anim** kit rather than on Colony Sim's own A002-era copy:
- feet stay planted;
- no joint snaps;
- turns have inertia;
- a walker still walks (not runs) when the game runs at 2x and 4x, its steps played faster like a
  sped-up film.

Every claim is measured by a headless gait harness on the real simulation, against a baseline
taken before any motion change, and guarded by test rows that a deliberate break turns red. Work
poses (chop, build, sit, sleep, ...) keep their look.

## Context

**The kit.** zmhstudio's `plugins/zmh-anim` (skill `zmh-anim:procedural-animation`, enabled in
`.claude/settings.json` by this plan's commit) ships two dependency-free modules distilled from
Animation Rigs:

- **`lib/rig.mjs`** (zmhstudio commit `0c4cc8b`, 224 lines). It provides `vec`, `UP`, `ik2`,
  `sagittalPole`, `buildPose`, `JOINTS`, `BONES`, `SEGMENTS`, `centerOfMass`, `springStep`,
  `PHYSICS`, `SEGMENT_RADII`, `TURN_LIMITS`, `trunkModel`, `yawModel`, `turnGait` and `turnStep`.
- **`lib/snaps.mjs`** (commit `f45b2a8`, 42 lines). It provides `createSnapCounter`.

The skill's rule is to vendor-copy the files and keep the provenance header. Its catalogue "Why
procedural gaits snap" lists eleven causes, each with a fix. The skill's "Turns have inertia"
section is `turnStep`, and its "Measure before you fix" section is the discipline this plan follows.

**What Colony Sim has today.** `games/colony-sim/src/rig.js` was copied from Animation Rigs in its
A002 form, with soft IK and sagittal poles. The kit's `ik2` and `buildPose` are the same functions
in the same expression order (verified while drafting: `rig.js:20-31` and `:34-75` against
`rig.mjs`; the inline `sag` at `rig.js:57` is `sagittalPole`). The locomotion code still carries
most of the catalogue's causes:

| Catalogue cause | Where it is in `rig.js` |
|---|---|
| #1, swing as a phase window | the swing starts on the phase wrap (`:270`) but its progress is `lp / sf` and it ends at `lp >= sf` (`:272`, `:281`), so a change in `sf` or the cadence moves a foot mid-swing |
| #2, lift-off from the flat-foot position | `f.from` is `f.plant` (`:270`), not the ankle drawn with the heel raised (`:285-286`) |
| #3, a landing target that jumps | the target is recomputed every frame until 85 % (`:275`), with no glide |
| #5, a `sin()` arc | `:277` |
| #7, first-order lags | the pelvis height `:298`, the stand height `:147`, `runAmt` `:251` |
| #9, frozen blend snapshot | `:107`, `:110` |
| turns: a rate cap, not inertia | `:104`, 7 rad/s, which switches on in one frame |

The gait is also chosen from the **on-screen** speed. `main.js:16` passes
`speed: s.speed * 48 * mult`, and `rig.js:105` runs above 2.6 m/s and "skates" above 6 m/s
(`:254`). So at 2x a walking settler plays the run cycle, and at 4x it plays the run cycle or the
skate cycle.

**Baseline, measured while drafting** (a scratch mirror of `main.js`'s loop at 60 Hz with the
kit's `createSnapCounter`, seed 1, 600 real seconds from landing, key = `rig.act`):

| Game speed | Snaps / 1000 settler-frames | Legs / 1000 | Worst (m/frame²) | Walkers playing "run" | Locomotion frames skating | Yaw accel max |
|---|---|---|---|---|---|---|
| 1x | 635 | 250 | 0.92 | 0 % | 0 % | 420 rad/s² |
| 2x | 366 | 203 | 0.89 | 89 % | 0 % | 840 |
| 4x | 471 | 186 | 1.45 | 100 % | 49 % | 840 |

- **By activity at 1x:**
  - The walk frames (80 k of 143 k) snap at **1,124 per 1000**.
  - Standing (`idle`, mostly settle steps) is worse per frame.
  - `chop` contributes about 26 per 1000 overall.
- **The pelvis alone** snaps about 30 per 1000, so the limbs carry it, not the root.
- **For scale,** Animation Rigs' first version measured 282 and its A004 32-38.
- **These numbers are indicative only.** Task 1 re-takes the baseline with the committed harness,
  and that is the number the gates are set from.

**Why this is presentation only.** `rig.js:1-3`: "Pure presentation: it reads a settler and never
writes one". The sim is seeded and deterministic (`.claude/colony-sim.md` § Architecture, "Bodies
are presentation"). Nothing in this plan touches `sim.js`, `brain.js`, `data.js`, `nav.js` or the
save.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill; `.claude/zmh/producer.md`
§ Plans says "Task-scoping skill: none"). One task per step, each one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Vendor the kit; teach `build.mjs` the kit's export list; `rig.js` takes `ik2`/`buildPose` from the kit; move `viewOf` into `rig.js`; the gait harness `tools/gait.mjs`; re-take the baseline | infra | sonnet | high | fails the haiku bar on judgment: a bundler change with a new safety check, a pose-identity proof, a harness that mirrors `main.js` and defines five metrics |
| 2 | Rebuild locomotion on the kit: time-lapse tempo, gait from the natural pace, swings as events, springs, turn inertia, the drawn root, lean and hip roll, extrapolated blends; trace first, measure after | cross-system | opus | high | design judgment throughout (which catalogue fix applies to which line, the fast-forward policy's edges, tuning against the harness); it is the run's hard step |
| 3 | Six test-sim rows on the harness, each shown red by its own break through `negtest.sh` | tests | sonnet | high | fails the haiku bar on judgment: thresholds set from measured values, one break per row chosen and read row by row |
| 4 | `.claude/colony-sim.md`: files rows, a § Motion section with the before/after table, a call, the known-limits line, the anti-goal pointer | docs | sonnet | medium | the text is given below, but the numbers come from tasks 1-3's runs, so it is not verbatim |

- **Ordering / dependencies:** 1 → 2 → 3 → 4, strictly sequential. Task 2 needs task 1's harness
  and baseline, task 3 gates what task 2 built, and task 4 quotes all three. Nothing is
  parallel-safe, since tasks 1-3 all touch `rig.js` or `test-sim.mjs` or rebuild `index.html`.
- **Files owned per task:**
  - Task 1: `games/colony-sim/src/anim-rig.js` (new), `games/colony-sim/tools/anim-snaps.mjs`
    (new), `games/colony-sim/tools/gait.mjs` (new), `games/colony-sim/build.mjs`,
    `games/colony-sim/src/rig.js`, `games/colony-sim/src/main.js`, `games/colony-sim/index.html`.
  - Task 2: `games/colony-sim/src/rig.js`, `games/colony-sim/src/main.js`,
    `games/colony-sim/tools/gait.mjs` (metric fixes only), `games/colony-sim/index.html`.
  - Task 3: `games/colony-sim/tools/test-sim.mjs`. During negative tests only, it also makes
    temporary breaks of `src/rig.js` and `index.html`, all restored by `negtest.sh`.
  - Task 4: `.claude/colony-sim.md`.
- **Validation per task:**
  - Task 1:
    - `node games/colony-sim/build.mjs` prints `wrote index.html`.
    - `node games/colony-sim/tools/test-sim.mjs` ends `SIM-TESTS: GREEN (70 passed, 0 failed)`,
      the count unchanged.
    - `node games/colony-sim/tools/gait.mjs --seed 1 --mult 1 --secs 180` prints one JSON line.
    - The smoke gate is GREEN.
    - The pose-identity proof (step 1) printed identical.
  - Task 2: the same build, sim tests and smoke, plus the harness hitting every target in § Targets
    at 1x, 2x and 4x on seeds 1 and 2.
  - Task 3: `SIM-TESTS: GREEN` with exactly 6 more checks than task 2 left (expected 76), each break
    turning exactly its own row red, and `negtest.sh scan` clean.
  - Task 4: none beyond the final gate.
  - Final gate:
    - `bash .claude/scripts/gates.sh games/colony-sim/index.html` → `GATES: GREEN`. Its drive
      suite stays at 31 rows, because test-sim counts as one row.
    - `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- **Tier audit (required):** no task is haiku. Task 4 comes closest, but its table and numbers come
  from runs not yet made. Tasks 1 and 3 are sonnet, for the judgment named in the table. Task 2 is
  opus: it rewrites a gait against a measured target, which the kit's own history shows takes
  traced diagnosis, not pattern-following. The kit's skill and catalogue specify every fix, so it
  does not need fable.
- **Decision defaults:**
  - **Time-lapse, capped at 4.** The motion runs in *motion time*, `dt x tempo`, where
    `tempo = min(mult, 4)` and `mult` is the game speed.
    - At 1x, 2x and 4x the settler plays its natural walk or run at 1x, 2x or 4x tempo, with feet
      planted, like sped-up film.
    - At 8x and 16x the cycle plays at 4x tempo while the body covers 2x or 4x the ground, so stance
      feet are carried along (the slide cycle, as today's skate). This is the one honest
      fast-forward that never strobes: 4 strides per real second is the readable limit at 60 fps.
    - Paused (`mult` is 0, passed as 0.001 at `main.js:133`), the walker freezes mid-stride.
    - Work poses, breathing and the 0.35 s blend keep real seconds (`rig.t`), unchanged.
  - **The gait from the natural pace.**
    - `view.speed` becomes the settler's pace at 1x, `s.speed * 48` m/s, and the view carries
      `mult`.
    - Walk or run by that pace (run above 2.6, as today).
    - Planted versus slide is decided by the tempo cap, never by on-screen speed.
  - **Substeps.** Advance the locomotion state in substeps of at most 1/60 motion-second, so 4x
    takes 4 substeps a frame. Build the pose once per frame, after the last substep.
  - **Turns: `turnStep` from the kit.**
    - The target is the direction of travel while moving, and `st.yaw` otherwise.
    - Pass `speed` as the natural pace, `scale` as `rig.s` and `runAmt` as `rig.runAmt`.
    - Honour the caller contract: `yawRate = 0` on a teleport, and on re-entering locomotion from
      lying or sitting.
  - **Feet land along the direction of travel** (the drawn root's velocity), not along the body's
    still-turning facing. Otherwise a lagging heading steps off the path.
  - **The drawn root follows the sim through `springStep`.** Spring x and z toward the
    interpolated sim point at ω = 12 per motion-second, then cap the offset at 0.5 m.
    - This removes the velocity steps at tick boundaries and path corners, about 0.27 m behind at
      a walk.
    - A jump over 6 m still resets everything (`rig.js:103`), and also bumps a new `rig.epoch`
      (below).
  - **Lean and life.**
    - Lean into acceleration: the target is `base + a_fwd / g`, using 0.025 x a when braking (the
      kit's "Balance" numbers), through a spring with ω = 10.
    - The swing-side hip drops about 4° (`P.roll`), and the trunk leans toward the stance side
      (`P.sideLean`, about 0.02 rad).
    - No centre-of-mass solve and no `physStep` (both are follow-ups).
  - **Stride:** the kit's `0.84 + 0.44 * speed / s`, clamped to 1.05-2.6, times `s`, replacing the
    fixed `lerp(1.45, 2.6, ra)`. Keep it only if the step-length row holds, otherwise keep today's.
  - **`rig.epoch`:** an integer bumped on every activity-group change and every teleport. The
    harness keys its snap history on `act + ':' + epoch`, so a deliberate discontinuity is never
    counted.
  - **Leave the work poses alone** (`workPose`, `rig.js:155-222`), apart from what the shared
    blend and root change gives them.
  - **Do not touch `games/animation-rigs/`.** Its versions are frozen (`.claude/animation-rigs.md`).
- **Embedded-content QA (required):** done for this draft.
  - test-sim's count was re-derived by running it: `SIM-TESTS: GREEN (70 passed, 0 failed)`.
    Task 1 adds 0 and task 3 adds exactly 6, so the expected total is 76; state it as the
    invariant "grows by exactly 6".
  - The drive suite is at 31 rows (28 + the campfire's 3) and does not change.
  - The kit's line counts are from `wc -l`: `rig.mjs` 224, `snaps.mjs` 42.
  - Both commit hashes are from `git -C D:/gitrepos/zmhstudio log -1 --format=%h -- <file>`.
  - The plugin cache copy (`~/.claude/plugins/cache/zmhstudio/zmh-anim/f10df9bb818c/lib/`) was
    `cmp`-identical to the checkout on 2026-11-28.
- **Escalation triggers:**
  - Stop if test-sim or the drive suite is red on the unmodified baseline.
  - Stop if the pose-identity proof in step 1 shows any difference: that would mean the kit and the
    copy are not the same function, and the plan's premise is wrong.
  - If task 2 cannot reach the snap targets after its retry, ship what it reached only if every
    other target holds and the snaps improved. Record the measured numbers and the cause it traced
    in the follow-up file. Never loosen a target to pass.
- **Playtest:** yes.
  - **At 1x,** follow a settler walking: feet stay put while on the ground, no knee pops, and a
    turn eases in over a step instead of snapping.
  - **Starting, stopping, and standing turns:** starting off and stopping lean the body a little,
    and a standing turn to face a job is a few shuffled steps.
  - **At 2x,** walkers walk at a brisk tempo; only a hurrying settler runs.
  - **At 4x,** feet still plant, like sped-up film.
  - **At 8x and 16x,** the sliding cycle is as before.
  - **Transitions** into and out of chop, sit, eat and sleep blend without a jolt.
  - **On the phone,** the frame rate holds.
- **Publish:** default. This is a player-facing change: the overseer publishes in its wrap-up (a
  push to `main` is the deploy) and verifies the Pages run per `.claude/zmh/producer.md` § Publish.
  The report quotes the badge read back from `games/colony-sim/index.html`.
- **Commit strategy:** one conventional commit per step, scope `colony-sim`, on branch
  `colony-sim-anim-motion`. Land the branch as one commit with `.claude/scripts/land-on-main.sh`
  (dry run first), per § Integration.

## Targets

All are measured by `tools/gait.mjs` on **movement frames**: activity group `walk`, `run` or
`idle`, including blend frames into those groups. Seeds 1 and 2, 180 real seconds from landing at
60 Hz, unless a row says otherwise. B is task 1's re-taken baseline for the same seed and speed.

| # | Metric | Target |
|---|---|---|
| T1 | snaps per 1000 movement frames at 1x | ≤ 0.3 x B on each seed |
| T2 | leg snaps per 1000 at 1x | ≤ 0.2 x B on each seed |
| T3 | worst second difference at 1x | < 0.35 m/frame² |
| T4 | step length / cadence of a walk at 1x | 0.6-0.8 m per step, 0.8-1.15 strides per motion-second |
| T5 | frames where a walker (natural pace ≤ 2.6) plays `run`, at 2x and 4x | 0 |
| T6 | planted-foot slide (ankle xz speed while the foot is planted with its heel down, per motion-second) at 1x, 2x and 4x | ≤ 2 cm/s mean, and no slide-mode frames at ≤ 4x |
| T7 | yaw angular acceleration at 1x (motion time) | max ≤ 25 rad/s² (kit: ≤ ~18.6 by design) |

## Steps

1. **Vendor the kit, keep every pose identical, and build the harness (task 1).**
   - **Copy the two kit files.**
     - Copy `D:\gitrepos\zmhstudio\plugins\zmh-anim\lib\rig.mjs` byte for byte to
       `games/colony-sim/src/anim-rig.js`, and `lib/snaps.mjs` to
       `games/colony-sim/tools/anim-snaps.mjs`, with `cp`.
     - In a remote session, use the newest plugin cache's `zmh-anim/lib/` instead, or clone
       `ZackHelms/zmhstudio` into the scratchpad.
     - Confirm each hash with `git -C <zmhstudio> log -1 --format=%h -- plugins/zmh-anim/lib/<f>`.
       If either is not `0c4cc8b` / `f45b2a8`, use the hash it prints and say so.
     - Prepend one comment block to each file, above the module's own:
       ```
       /*
        * VENDORED from zmhstudio plugins/zmh-anim/lib/rig.mjs at commit 0c4cc8b (the zmh-anim kit,
        * skill zmh-anim:procedural-animation). Do not edit here: change it upstream, then copy it
        * again and put the new commit in this line.
        */
       ```
       Use `snaps.mjs` and `f45b2a8` in the second file's header. Neither header line may start
       with the word `import` or `export`.
     - Prove the body is untouched: `tail -n +7 <copy> | cmp - <original>` (the header is 6 lines;
       count yours) must print nothing.
   - **`build.mjs`.**
     - Insert `'anim-rig.js'` into `ORDER` (line 16) immediately before `'rig.js'`.
     - The kit ends with `export { UP };`. Today that line survives stripping and the build throws
       at lines 39-40 ("a module statement survived stripping"). In `wrap` (lines 29-34), remove a
       whole line of the form `export { a, b };` (names only, no `as`). Its names are **not**
       exported from the bundle; they stay local to their block.
     - Add a check that keeps the bundle honest: before stripping, collect the names in each
       module's `import { ... } from './x.js'` lines. After all blocks are wrapped, throw if any
       imported name is not in `exported` (message: `<name> is imported by <f> but no module
       exports it`). Then a module that imports `UP` from the kit fails the build instead of
       failing at run time in the page.
     - Verify it fires: temporarily add `UP` to `rig.js`'s import from `./anim-rig.js`, see the
       build throw, and remove it.
   - **`src/rig.js`.**
     - Delete its `ik2` (lines 18-31) and `buildPose` (lines 33-75).
     - Add `import { ik2, buildPose } from './anim-rig.js';` after the `island.js` import (line 4).
       The rest of `rig.js` calls them unchanged. Keep its own `V`, `UP` and helpers; do not
       import `vec` or `UP` from the kit.
     - **Pose-identity proof, before committing.** A scratch script imports the old `rig.js`
       (`git show HEAD:games/colony-sim/src/rig.js` into the scratchpad, with its
       `./island.js` import pointed at the real file) and the new one. It drives both with the same
       views for every activity in test-sim's `ACTS` list (`test-sim.mjs:355`) for 300 frames, and
       requires every joint to be `===` equal. Print `POSE-IDENTICAL` or the first difference.
   - **`viewOf` into `rig.js`.**
     - Export `viewOf(s, prev, a, mult)` from `rig.js` with exactly today's body
       (`main.js:14-17`, with `G.prev[i] || s` passed in as `prev`).
     - Use it in `main.js` (lines 25 and 133) and delete the local copy.
     - Add `rig.epoch = 0` to `makeRig` (line 84). Bump it in `updateRig` when the group changes
       (line 107) and on a teleport (line 103).
     - These are behaviour-free: the pose proof above must still hold after them.
   - **`tools/gait.mjs`, the harness.**
     - It mirrors `main.js`'s loop exactly: the accumulator at lines 124-130, `viewOf`, and
       `updateRig` with `dt` = 1/60. It runs a `createSim(seed)` colony from landing.
     - Export `measureGait({ seed, mult, secs })`, returning
       `{ per1000, legsPer1000, max, allPer1000, stepLen, cadence, walkerRunFrames, slideCmPerS, slideModeFrames, yawAccMax, ms }`.
     - Snaps come from the vendored `createSnapCounter({ legs: [13..20] })`. Push movement frames
       only (as § Targets defines them), keyed `act + ':' + epoch`, with `rig.J.slice(0, 21)`.
       `allPer1000` is a second counter over every frame.
     - `stepLen` and `cadence` are taken over walk frames whose natural pace is between 1.2 and 2.0
       m/s: the distance the drawn root covered divided by the swings started, and the swings
       started divided by 2 per motion-second.
     - `slideCmPerS` is the mean planted, heel-down ankle xz speed. Expose whatever per-foot state
       the rig needs to say "heel down" (for example `f.heel`) as a read-only field.
     - `yawAccMax` is the max |Δ yaw rate| / motion-dt. `ms` is the mean wall time of the four
       `updateRig` calls per frame.
     - CLI: `node games/colony-sim/tools/gait.mjs --seed 1 --mult 1 --secs 180` prints the JSON.
     - Add a `--trace <settler> <from> <to>` mode that prints, per frame, the act, root, pace, yaw
       rate, each foot's state and the frame's worst joint snap, to diagnose with (the skill's
       "Trace tools, not a gate").
   - **Re-take the baseline** for seeds 1 and 2 at 1x, 2x and 4x (180 s each) with the harness,
     and write the six JSON lines into the commit message body. Task 2 and the follow-up file use
     them.
   - Rebuild, run test-sim (70, unchanged), and run the smoke gate with the Windows exports.
   - Commit, by explicit path:
     `refactor(colony-sim): settlers' IK and pose from the vendored zmh-anim kit; gait harness`.

2. **Rebuild the locomotion on the kit (task 2).**
   - **Trace before changing anything.**
     - Run `gait.mjs --trace` on seed 1 at 1x across a walk with a corner, a stop, and a start
       from standing.
     - Name the three biggest snap sources with the frame and line each comes from, and put them
       in the commit body.
     - Fix in that order. The catalogue says what each cause wants, but the trace decides which
       ones this rig has.
   - **The fixes, as § Decision defaults set them:**
     - time-lapse tempo with substeps (and pass `mult` through `viewOf`: `speed: s.speed * 48`,
       `mult`);
     - the gait from the natural pace;
     - swings as events on their own clock, their duration fixed at lift-off from the current gait
       (catalogue #1);
     - lift-off from the displayed ankle, with the heel offset decaying (#2);
     - a gliding landing target (τ about 0.06 s), committed at 85 % of the swing, its height
       through a spring and exact at touch-down (#3);
     - the swing arc as `sin²` (#5);
     - `springStep` for pelvis height, stand height, lean and `runAmt` (#7);
     - an extrapolated blend snapshot, as in the skill's "Pose" section (#9);
     - `turnStep` for yaw, landing along the direction of travel, and the sprung drawn root;
     - lean into acceleration, hip roll and side lean;
     - for settle steps when standing: the same swing event (`sin²` arc, start from the displayed
       ankle).
   - **Above the tempo cap (8x, 16x):** today's skate branch (`rig.js:263-268`), entered from
     `mult > 4` instead of `spd > 6`, with walk or run still chosen by the natural pace.
   - **Iterate against § Targets with the harness** (seeds 1 and 2, 1x, 2x and 4x) until all seven
     hold. Count how often each corrective rule fires (the skill: it should be rare), and write the
     final JSON lines in the commit body.
   - **Keep the existing rig checks green.** These are the bone lengths, the finite capsules at dt
     0, 1/60 and 0.1, the stance ankles within 0.1 m on a slope, and the cadence 0.7-1.2
     (`test-sim.mjs:349-383`). Their `st.speed` is already a natural pace, and `mult` is absent
     (treat it as 1).
   - **Look at it.** Run the page at 1x and 4x with a settler followed, and take two screenshots
     mid-stride: Playwright with the Windows exports and
     `--use-angle=swiftshader --enable-unsafe-swiftshader`. Copy the canvas in the task that drew
     it, as the drive suite's sky harness does. Save them as
     `<scratchpad>/colony-walk-1x.png` and `colony-walk-4x.png`, read them, and send the CD the 1x
     one in the report.
   - Rebuild, run test-sim and smoke, then commit by explicit path:
     `feat(colony-sim): settlers walk on the zmh-anim kit (planted feet, turn inertia, time-lapse gait)`.

3. **Gate it (task 3).**
   - **Record the baseline.** Run test-sim and record the count, expected 70.
   - **Add a `gait` section to `tools/test-sim.mjs`** after `rig`. It imports `measureGait` from
     `./gait.mjs` and adds these 6 checks, named as below, each setting its threshold from
     § Targets:
     - **G1:** `'1x: movement snaps at most 30% of the old rig's (seeds 1, 2)'`. Write the
       baseline as a constant with its date and source commit, as `drive-colony-sim.cjs` does with
       `HOT_FLOOR`.
     - **G2:** `'1x: leg snaps at most 20% of the old rig's, worst < 0.35 m/frame²'`.
     - **G3:** `'1x: a walk takes 0.6-0.8 m steps at 0.8-1.15 strides/s'`.
     - **G4:** `'2x and 4x: a walker walks (no run frames below a 2.6 m/s pace)'`.
     - **G5:** `'1x-4x: planted feet hold (heel-down slide ≤ 2 cm/s, no slide-mode frames)'`.
     - **G6:** `'1x: turns have inertia (yaw acceleration ≤ 25 rad/s²)'`.
   - **Keep the section's run time under 40 s** (Node, this box): use 120-180 s runs, and reuse
     one run across rows where they share a seed and speed. test-sim runs inside the drive suite
     under `gates.sh`.
   - Run it: `SIM-TESTS: GREEN (76 passed, 0 failed)`, which is the baseline + 6.
   - **Negative tests, each through `.claude/scripts/negtest.sh`.** For each break: save; break
     with a `/* @negtest */` comment on the broken line; rebuild; run test-sim; restore; confirm
     `RESTORED`. Each break saves and restores `src/rig.js` and `index.html` (and `main.js` for
     B3). Record which rows went red:
     - **B1, the arc back to `sin`:** expect G1 or G2 red. If neither turns red, pick the
       catalogue fix the trace named as the biggest source and break that instead.
     - **B2, the stride constant ×1.5:** expect G3 red.
     - **B3, the gait from the on-screen speed again** (`speed * mult` in `viewOf`): expect G4 red.
     - **B4, the tempo cap at 1** (so 2x and 4x carry feet): expect G5 red.
     - **B5, the old yaw cap** (`rig.yaw += clamp(dy, -7 * dt, 7 * dt)` in place of `turnStep`):
       expect G6 red.
     - **G1 and G2 need a break of their own** (B1, or the substitute). A row no break can turn
       red is reported as such, not counted.
   - After the restores, `bash .claude/scripts/negtest.sh scan` must be clean and
     `git status --short games/colony-sim` must show nothing.
   - Commit by explicit path: `test(colony-sim): gait rows on the zmh-anim harness, negative-tested`.

4. **Document it (task 4).**
   - **`.claude/colony-sim.md` § As built, § Files.**
     - Replace the `src/rig.js` row's text
       `` `ik2` + `buildPose` copied from Animation Rigs (A002 form); planted feet on the heightfield; ``
       with
       `` IK and the pose builder from the vendored zmh-anim kit (`anim-rig.js`); locomotion on the kit's rules (see § Motion); `viewOf`, the one view of a settler the page and the harness share; ``
       and keep the rest of the row.
     - Add a row after it:
       `` | `src/anim-rig.js` | **vendored, do not edit**: the zmh-anim kit's `rig.mjs` (IK, pose, segment masses, spring, turn inertia), copied byte for byte with a header naming the zmhstudio commit. To update: copy it again, change the commit in the header, rebuild | ``
     - Add rows for `tools/anim-snaps.mjs` (vendored the same way, test-only, the snap counter)
       and `tools/gait.mjs` (`measureGait` and `--trace`, the harness behind test-sim's `gait`
       rows).
     - Update the test-sim row's count from 70 to the final count, and its section list (add
       `gait`).
   - **The `build.mjs` row:** add "a line `export { a, b };` is dropped and its names stay local;
     the build fails if a module imports a name no module exports".
   - **A new `### Motion` section** before `## Measured`:
     - the time-lapse policy (tempo `min(mult, 4)`, substeps, slide above 4x, frozen when paused,
       work poses on real seconds);
     - the gait from the natural pace;
     - which catalogue fixes were applied, with the three traced sources from step 2;
     - turns with `turnStep`;
     - the sprung root;
     - the before/after table: task 1's baseline and step 2's final numbers, seeds 1 and 2, 1x, 2x
       and 4x, with the same columns as § Context's table.
   - **§ Architecture, "Bodies are presentation"** (lines 343-348): change "The Animation Rigs
     skeleton, IK and locomotion are **copied**" to say the IK and pose come from the zmh-anim kit
     (vendored), and that the locomotion is Colony Sim's own on the kit's rules.
   - **§ Calls made while building:** append
     `- Motion (plan colonysime, 2026-11-28): the gait plays in time-lapse up to 4x tempo (feet planted at 1x-4x, a sliding cycle at 8x-16x, frozen when paused); walk or run is chosen from the settler's pace at 1x, never from the on-screen speed; work poses keep real-time tempo.`
   - **§ Known limits:** replace
     `- At 16x, walkers whose on-screen speed passes 6 m/s switch to a sliding gait cycle.` with
     `- At 8x and 16x the gait plays at 4x tempo and stance feet slide (4 strides a real second is the readable limit at 60 fps).`
   - Commit by explicit path: `docs(colony-sim): settler motion on the zmh-anim kit`.

## Gotchas / bindings

- **`index.html` is generated.** Edit `src/`, then run `node games/colony-sim/build.mjs`, which
  restamps the badge (`build.mjs:53-54`). Read the badge back for the report:
  `grep -o 'id="build-badge"[^>]*>[^<]*' games/colony-sim/index.html | sed 's/.*>//'`.
- **The bundler.**
  - It strips `import ... from` lines, rewrites `export function` / `export const`, and throws if
    two modules export one name (`claim`, `build.mjs:24-28`).
  - `rig.js`'s `ik2` and `buildPose` are the only names that collide with the kit's (checked
    while drafting). That is why `rig.js` must lose its copies in the same commit that adds
    `anim-rig.js` to `ORDER`.
  - The kit's `export { UP };` needs step 1's `build.mjs` change.
- **Do not touch the vendored bodies.** Only the header comments are ours.
- **Node imports `src/*.js` as ES modules with no `package.json`** (syntax detection; it works
  today for `campfire-particles.js`). Keep the vendored test file as `.mjs`.
- **Determinism and purity.**
  - The rig never writes a settler, never consumes the sim's RNG, and never calls `Math.random`.
    The kit has neither.
  - `sim.js` and friends stay untouched, and `run.mjs`'s numbers must not move.
- **`turnStep`'s caller contract:** set `yawRate = 0` on a teleport and on re-entering locomotion
  (the skill, § What zmh-anim ships).
- **Re-derive the snap thresholds for the frame rate.** The counter's thresholds assume 60 Hz and
  about 1 m of leg. The harness runs at 60 Hz, and settler heights are near 1 (`look.height`), so
  they hold. Do not feed it substeps.
- **A rate cap is not inertia, and inertia widens turns** (the skill, "Turns have inertia"). The
  sim's path is authoritative, so the drawn root follows it through a spring and only the facing
  has inertia. Do not make the root follow the facing.
- **A corrective rule must be rare.** Count how often any early-lift or reach correction fires.
- **The CD's Windows box:** gates and Playwright need three exports in the same Bash call
  (`.claude/zmh/producer.md` § Environment):
  - `PYTHONUTF8=1`;
  - `NODE_PATH=/c/Users/zmhel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules`;
  - `SMOKE_CHROMIUM=C:/Users/zmhel/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe`.

  If either path moved, re-find it with `ls ~/AppData/Local/npm-cache/_npx/*/node_modules/playwright-core`
  and `ls -d ~/AppData/Local/ms-playwright/chromium-*`.
- **Inside the worktree, keep each `git` command on a line of its own** (producer.md
  § Environment). The harness refuses a compound line that mixes in `git`. Subagents must use
  `git -C <absolute worktree path>`.
- **Run `gates.sh` alone.** Timing rows go red when two Chromium suites share the box.
- **Line endings:** edit with the Edit tool or an LF-preserving write. Copy the vendored files with
  `cp`, never through Python text mode. Run `bash .claude/scripts/eol-guard.sh` before landing.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. The primary checkout has an
  untracked `.claude/worktrees/` and another session's locked worktree, and neither is this plan's.
  Branch before the first commit. After landing, check `git log --oneline origin/main..main` in
  the primary checkout.
- **Read pixels in the task that drew them.** The canvas has no `preserveDrawingBuffer`. Wait in
  frames, never `waitForTimeout`.
- **A check that can skip:** if the harness returns no walk frames, or NaN, the row fails with
  the reason. It never passes vacuously.

## Validation

- `node games/colony-sim/tools/test-sim.mjs` → `SIM-TESTS: GREEN (76 passed, 0 failed)`.
- `node games/colony-sim/tools/gait.mjs` on seeds 1 and 2 at 1x, 2x and 4x: every § Targets row
  holds, and the JSON lines are recorded.
- `bash .claude/scripts/gates.sh games/colony-sim/index.html` with the three exports →
  `GATES: GREEN`: the smoke at iPhone 13, `drive-colony-sim.cjs` at 31 rows, games-sync and the
  negtest scan.
- `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- Breaks B1-B5 turned exactly the expected rows red; record each result line.
- The 1x walk screenshot from step 2 goes to the CD.
- The badge is read back from the file, and the Pages run for the landed SHA concludes `success`.
- Manual playtest: see Playtest above.

## Follow-ups

- **Balance on the segment-mass model** (`centerOfMass`), with the target at the centre of
  pressure. This is the kit's "Balance" section, A002-A003 in Animation Rigs.
- **The A004 physics:** the trunk as a rigid body (`trunkModel`) and an integrated pelvis height.
  `physStep` is not in kit v1. Upstream it into zmh-anim first, then vendor it.
- **Work poses:** chop's piecewise swing (`rig.js:161-162`) has hard corners and snaps about
  26 per 1000 frames overall. Smooth it, and decide whether work tempo should time-lapse too (the
  CD's call).
- **Hills and stairs-like terrain:** the kit's clearance field (`clearY`, not in v1) for the
  scarp's ramps.
- **Settlers walk through each other and through buildings** (§ Known limits). That is the sim's
  problem, not the rig's.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/colonysime.zmh-anim-motion.md
```
