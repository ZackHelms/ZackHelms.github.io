# Colony Sim: building and tuning a watched simulation (2026-11-26)

The first draft of `games/colony-sim/` went from a brainstorm to a shipped page in one session:
design, a 10-task plan, inline execution, a fresh-reviewer pass and a fix pass. The design
and as-built detail live in `.claude/colony-sim.md`. This note keeps what a later session
would otherwise have to rediscover.

## 1. Check the arithmetic of time and distance before agreeing a scale

I proposed 15-minute days on a 1 km island and said a walk covers ~130 m per game hour. It
covers 52 m (1.4 m/s x 37.5 s). A builder-check subagent caught it. Had it gone unchecked,
the waterfall would have been a 10-hour walk each way. The fix (30-minute days, a brisk
1.6 m/s, so 120 m per game hour) took one line. Finding out later would have cost a retune.

**Rule:** when realistic walking meets a compressed clock, write out "metres per game hour"
and the time to two or three named places before proposing numbers. A real-pace walker under
any short day gets a small world. Temporary camps or a slower day are the levers.

## 2. A finish line made of meters: prove it reachable first

The CD's phase 1 finish line, as I wrote it, said "every meter at 80% or more for 2 days".
The builder check flagged that daily drain makes it impossible, and I rewrote it to "never
below 50 for 48 h". Even that went 0 for 10 in the first headless runs. Three causes, each
found by logging *what reset the window* (`sim.breakers`):

- **Energy:** 5.4/h of heavy work took a full night's 100 to about 30 by bedtime. Cut to
  3.6/2.6/1.7 per hour (heavy/light/idle), so a day costs about 45.
- **Cleanliness:** an ocean bath caps at 70 (CD). At 1-1.9/h it fell below 50 within a day.
  "A bath at least every 3 days" means about 7 a day, so 0.32/h awake.
- **No lesson ever fired for it.** `hygiene` had no trigger at all. Fix: a **nightly review**
  at 21:00. Each of energy, hunger, cleanliness and health that dipped below 50 that day is
  one chance to learn its habit. Repeating the mistake raises the chance (x(1 + 0.3 per
  repeat), at most 0.9). Without that boost a low-INT/WIS settler could take a week to learn
  to wash, and that was the long tail.

Then two causes of a long tail:

- **The camp was finished by day 4.4 in the slowest seeds.** The rest was waiting on habits.
  Logging "builtAll day" beside "done day" showed it. Build costs went up 1.5x and hours 1.6x,
  so the camp is the main arc.
- **Lunch was a 0.8-hour window.** A builder in a 90-minute step missed it entirely. Three
  mealtimes, interrupts for meals and bedtime, packed lunches, eating from a basket.

A loop worth knowing: a founder at 0 hunger walks home (perseverance). If there's still
nothing edible at camp (only raw meat), they collapse again on arrival, every tick: 1,382
collapses in one run. A 6-hour cooldown, and a settler who cooks their own meat, ended it.

Final measured table: `.claude/colony-sim.md` § Measured (held-out seeds 31-60: 30/30, median
day 12.9).

## 3. Bundling ES modules into one page

The sim modules must import cleanly in Node (for `tools/test-sim.mjs` and `tools/run.mjs`) and
also ship as one inline script. Concatenating them, as Interlock does, failed at once:
`Identifier 'HOUR' has already been declared`, because three modules each had their own
`HOUR`, `clamp` and `lerp`. What works (`games/colony-sim/build.mjs`):

- each module becomes its own `{ ... }` block, so private helpers stay private;
- each exported name is declared once outside every block (`let a, b, c;`) and assigned
  inside (`export function f` becomes `f = function f`, `export const X =` becomes `X =`);
- imports are deleted, since an imported name is one of those outer bindings;
- the build throws if two modules export the same name.

Circular imports (`sim.js` and `brain.js` import each other) are fine both in Node and in the
bundle, because no module calls another while it loads.

**Trap:** `export const CELL = 2, IW = 500, IH = 350;` exports only `CELL` under this rewrite.
`IW = 500` becomes an assignment to an undeclared name and throws in strict mode. One export
per statement.

**Trap:** the UI read `api.sim().settlers` while it was being built, before any game had been
loaded or created. Build the UI after boot.

## 4. Rendering: what screenshots caught that tests did not

Every rig test was green, yet the first follow shot showed each settler as a cloud of loose
balls. The capsule mesh was two hemispheres with **no cylinder between them**. Combat
Simulator's `VS_LIMB` stretches the mesh between A and B by `aEnd`, and the band joining the
equator at end 0 to the equator at end 1 has to exist in the mesh. Six triangles per segment.

Then the whole scene looked washed out. Colours were authored as sRGB (`0.36, 0.58, 0.22`)
but lit as if linear, then gamma-encoded, so they were brightened twice. Fix:
`pow(vC, vec3(2.2))` on the way in. (Capsule colours from `hex()` were already linear.)

At midnight the camp looked like day. The firelight was `1.2 + 6 x night` with a `0.02 d^2`
falloff. Now it is `0.3 + 2.2 x night` with `0.09 d^2`.

Screenshot recipe that works on the CD's Windows box: launch Chromium with
`--use-angle=swiftshader --enable-unsafe-swiftshader`. To read pixels from a WebGL canvas
without `preserveDrawingBuffer`, render a frame and `drawImage` it onto a 2D canvas **in the
same task**, before the browser composites and clears it (`drive-colony-sim.cjs`).

## 5. What the final review found (fresh reviewer, Opus), and the root causes

All the simulation checks were green. Each of these was a gap in how the page treats a
person, not in the simulation:

1. **Bubbles never expired, and flickered.** The UI deleted its only record of a shown line
   while the sim's ring buffer still held it, so the line was re-created every frame. Now a
   row in `games/CLAUDE.md` (Showing a simulation's event feed).
2. **"Later" on sleep was never refused, even after the lesson.** The refusal asked `needOf()`,
   which hides a need the player has already put off. So once one Later was accepted, every
   following Later was too. Refusal now reads the raw need (`learnedNeed`).
   **The same root cause, second form:** `needOf` returns only the most urgent need, so a full
   bladder hid an exhausted settler's learned refusal. `learnedNeed` checks every need a learned
   lesson covers.
3. **The camera off the north or south edge froze the page with sound on.** `seaD[]` read out of
   range gave `undefined`, so `NaN`, and `setTargetAtTime(NaN)` throws. Everything after audio
   in `frame()` stopped every frame: the clock, the panels, autosave. Now part of the Audio row
   in `games/CLAUDE.md`.
4. **A save of the wrong shape half-loaded, then saved itself back.** `restore()` copied fields
   wholesale and `step()` threw every frame afterwards. Fix: `validateSnap()` checks everything
   `step` touches, and `load()` runs one `step` on a copy before accepting the save. A failing
   save is set aside under `colonySim.bad`.
5. **Removing a goal made its half-built site the top priority.** `activeSites` sorted by
   `goals.indexOf(goal)`, which is -1 once the goal has been removed.
6. **Plan buttons acted on a row index** while `forecast()` re-minted the list underneath, so a
   click could hit the job that had moved into that row. Inputs now carry the item's id.
7. **A resumed chop could fell an already-felled tree**, and get 3 free logs, because preemption
   releases the reservation. The chop step checks the tree every tick (`FX.treeStanding`).
8. **A new island stopped hourly autosave**, because `lastSave` kept the old game's clock.

Every fix got a test that failed first. Item 3's test only failed once the test made sure
audio was on: the first version left it muted, and so passed with the bug in place. Undoing
the fix on purpose and watching the test go red is what showed that.

## 6. Test-writing traps

- **Planting a corrupt save for the next reload:** the page's own save on unload overwrote the
  planted blob, so the check "passed" against a good save. Detach the game first
  (`window.__CS.G.sim = null`), then plant.
- **The `&&` trap from `.claude/scripts/README.md` bit again.** A `cd` into a directory the
  shell was already in failed, and the Python edit chained after it never ran. The map then
  re-rendered from the unpatched file and looked like the patch hadn't worked.
