# taasdelay step 2 - the engine and the rules suite

**Status:** open
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
