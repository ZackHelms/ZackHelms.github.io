# taasdelay step 2 - the engine and the rules suite

**Status:** IMPLEMENTED 2026-10-16 (see § What was built)
**Arc:** `.claude/plans/taasdelay.delay-arc.md` (the CD's answers and the design decisions).
**Scope:** the `FACTORY` block of `games/taas/index.html` and `.claude/tests/drive-taas-factory.cjs`.

## Start

1. `git fetch origin main`; cut `taas-delay` from `origin/main` (or check it out if it exists).
2. Read `.claude/taas.md` § Architecture (factory) and § How to change it (factory), "an
   instruction". The engine's pieces: `RULES` (~line 725), `has()` / `follows()` / `see()` /
   `known()` / `setRule()` (~line 852), `newGame()` (`seen: {}`, ~line 820), `newRobot()`
   (~line 1372), `release()`, `operate()` and `stocker()` (~line 1400-1520), `GRADE` /
   `credit()` / `note()` (~line 1027), `load()` (~line 1635), the exported API (~line 1709).
   Line numbers drift; grep for the names.

## Build

- A `RULES` row for the delay, job `null`, marked as carrying a wait. Check every `RULES`
  filter (`keepers`, the stocker's `recycles` find, the UI's picker) still does the right thing
  with a row that has no job.
- `newGame()` seeds `seen.delay = true`; `load()` sets it too and clamps `r.wait`
  (`Math.round`, 0-60, missing or not finite -> 5). `newRobot()` starts `r.wait` at 5.
- `setWait(s, id, sec)`: integer 0-60 only (reject non-numbers; round? decide and test), an
  event (`'waitset'`), exported. Setting it without the instruction in a slot is allowed (the
  value waits for the slot) or refused: decide, record, test.
- The `pause` state in both jobs: entered at the end of an iteration when the robot holds the
  delay, `r.wait > 0` and `follows(s, r, 'delay')`; otherwise straight on with a slip noted when
  it held the delay and `r.wait > 0`. Operator: after a toss (`reject` done), after the cut is out
  (`wait` ends), after a `flick`. Stocker: after `cool` that followed a `place` or a `drop`, not
  after `look`. Add `pause` to `STATES`.
- Evals: `GRADE.waited = 'good'`; the slip as its own line (`note()` or `credit()` with
  `against`; pick what reads right in the evals and grades yellow).

## Rules suite rows (new section, or extend section 7 and the instruction sections)

- The delay is on the list in a new factory and after `load()` of a save made without it.
- `setWait` accepts 0 and 60, refuses -1, 61, 2.5 (or rounds; whatever was decided), NaN, '5'.
- An operator told to wait N s: the gap between one log handled and the next is N s more than
  without (both after a press and after a toss); with `s.force.slip` staging a slip, no wait.
- A stocker told to wait: waits after a stocking and after a recycle, not after a looking.
- **Wait 0 consumes no die**: a day with the delay at 0 s plays the same day, roll for roll, as
  a day without it (event log, money and seed equal).
- The wait changes when, never what: over a long day the operator's outcomes per log are the
  same mix (or: the event kinds match with the time stretched).
- A job change or rest mid-pause releases the robot (state idle, no stuck `pause`).
- Save and load mid-pause resumes or releases cleanly; a bad `wait` in a save is clamped.
- Overproduction: an instructed operator plus stocker over 10 minutes, with and without a
  delay of about the customers' pace: the output bin's medium planks stay bounded with it and
  grow without it (record both numbers in the arc's Results; step 4's eval builds on them).

## Done when

`NODE_PATH=/opt/node-tools/node_modules node .claude/tests/drive-taas-factory.cjs` is GREEN with
the new rows (count in the arc's Results), the page suite still GREEN at 86
(`drive-taas-factory-ui.cjs`; the UI is not touched yet, but the engine change must not break
it), the page parses (`node .claude/scripts/check-inline-js.cjs games/taas/index.html`), smoke
GREEN. Commit to `taas-delay`, push the branch, tick the arc.

## What was built (2026-10-16)

Engine (`FACTORY` block of `games/taas/index.html`):

- **The row:** `{ id: 'delay', job: null, text: 'Wait between tasks', wait: true, start: true }`,
  last in `RULES` (so it is last in the picker). `start` is new data: `startSeen()` puts every
  `start` row on the list in `newGame()` and again in `load()`, so a save from before it gets it
  too (no version bump). `keepers`, the operator's `held` filter and the stocker's `recycles` find
  all skip it (no `rejects` / `recycles`, job not `operate`); the UI picker lists it through
  `known()`. The RULES comment now says it is the one row that belongs to no job.
- **`CFG.wait = { min: 0, max: 60, start: 5 }`**; `newRobot()` starts `r.wait` at 5 (assumed).
- **`setWait(s, id, sec)`** (exported): **refuses** anything but an integer 0-60 (a fraction,
  `'5'`, NaN, Infinity, null, out of range): decided against rounding, since the slider and
  steppers only ever give integers and a fraction can only be a bug. **Allowed with the
  instruction in no slot**: the robot keeps the number until the instruction goes back in.
  Each accepted call is a `'waitset'` event.
- **`done(s, r)`**, the end of one iteration, and the new state **`pause`** (in `STATES`):
  `done()` puts a robot that holds the delay with `r.wait > 0` into `pause` if
  `follows(s, r, 'delay')` (one `slip` die), else notes the slip; at 0 s, or without the
  instruction, it rolls nothing and goes to `idle`. `pause(r, dt)` reads `r.wait` every step, so a
  shorter wait set mid-pause ends it sooner. Called from: the operator's `reject` (after a toss),
  `wait` (the cut is out, **or the planer has jammed**: a sap log fed in was handled too), `flick`
  (a bad cut caught at the exit); the stocker's `cool` (only ever entered after `place` or
  `drop`), so never after a `look`. `release()` was already setting `idle`, so a job change or rest
  ends a pause; so does taking the instruction out of its slot (`pause()` checks `has()`). A
  toss that handled no log (you tossed it yourself while the robot was lifting it) is no
  iteration: the robot goes back to `idle` with no wait (found in the step's own review).
- **The wait overlaps the planer's staging.** The next log rolls in (0.9 s) while the operator
  waits, so the gap between two logs is `max(wait, stageSec) + pressSec`, not `wait` more than
  without: the model is "sleep N between iterations", with the next iteration still waiting for
  its log. Assumed, record in taas.md (step 5).
- **Evals:** `GRADE.waited = 'good'`, `GRADE.straight = 'good'`, written with `note()` (lines, not
  outcomes: no tally, no face, no `outcome` event) as `'waited'` and `'straight!'`, so the slip
  is yellow by the '!' rule and reads "Went straight on, against its instructions" once step 3
  gives it a `DOING` entry. Events `'paused'` `{ by, wait }` and `'straight'` `{ by }`.
- **`load()`**: `r.wait` clamped (`Math.round`, 0-60; anything not a finite number -> 5);
  `r.t` sanitised to a finite number >= 0 (a pause resumes from it).

Suites: rules `drive-taas-factory.cjs` **180** (156 + 24: section 12 "the delay between tasks",
23 rows, plus the pool row now fourteen with the delay's job row). Rows that asserted an empty
list now use `learnt()` (the list less its `start` rows). Page `drive-taas-factory-ui.cjs` stays
**89**: two rows updated because the picker now lists the delay from the start (the first
slot's list and the next slot's greyed list). Factory eval 19 GREEN, formal 43 / 39 GREEN,
smoke GREEN.

Break list: 23 breaks `delay-*` appended to `taas-factory-engine.json` (101 -> **124**), run on
copies: **23 of 23 caught**. The first run missed `delay-load-seen-no-start` (the row only loaded
a save whose robot held the delay, which marks it seen anyway); the row now also loads a bare
save, and the re-run caught it. The existing break `misstock-green` was re-anchored (its `old`
was the `GRADE` line, which gained the two delay keys) and still caught. Every `old` in the four
TAAS break lists still occurs exactly once in the page. The whole engine list was not re-run
(step 4 does that).

Overproduction (section 12's last row, seed 51, ten minutes, operator told
sappy/gnarled/medium, stocker told to recycle small, large and gnarled planks): without a wait
**16** medium planks in the output bin at the end (17 at most, satisfaction 100%); told to wait
3 s a log, **0** at the end and **1** at most. Scratch sweep over seeds 51-53 (not in the suite):
2 s keeps satisfaction at 100% but the bin still reached 1 / 10 / 5; 3 s held the bin at 1 but
satisfaction ended 98 / 38 / 52%; 4-5 s starved the line (6 waiting) and satisfaction fell to
11-18%. So the delay that ends overproduction without starving customers is a narrow band
around 2-3 s, and the default of 5 s starves them when the operator is fully instructed: a
finding for step 4's eval and the CD, not tuned here.

