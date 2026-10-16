# taasdelay step 5 - docs final and gates

**Status:** IMPLEMENTED 2026-10-16 (results in the arc)
**Arc:** `.claude/plans/taasdelay.delay-arc.md` (every count and finding is in Results).
**Scope:** `.claude/taas.md`, `.claude/tests/README.md`, `CLAUDE.md`, `games/CLAUDE.md`; no code.

## Docs

- `.claude/taas.md`, robot factory:
  - a "### A delay between tasks (CD, 2026-10-16) - stated" section after the storefront's
    "What was built": the CD's words, the four answers table (copy from the arc), what was built;
  - the robots table: the delay's row (both jobs);
  - the hair fix (step 1): one line in the 3D kit notes (a part that sits on another sorts with
    that part's centre, not its own; the hair is its ellipsoid less the facets in front of the
    head's centre and below a 0.1 m hairline, `hairOver()`; a cap of the faces outside the head
    was tried first and left a bald patch seen from behind, see step 1's Results), and the
    `games/CLAUDE.md` Depth row's flush-part sentence gains this second case if it reads naturally;
  - the assumed-not-decided table: every design decision in the arc's list, plus anything step 2
    or 3 decided (wording, default 5 s, one per robot, the stocker's iteration, 0 s rolls no
    die, the slider and steppers, the pause sign);
  - open question 2 marked built; open question 8 ("every instruction on the list from the
    start?") now has its first answer for one instruction;
  - § Architecture / How to change it: an instruction with a value (`r.wait`, `setWait`, the
    `pause` state) and the rule that a job-less row is consulted by every job;
  - § Negative tests (factory): the new caught / total and the misses.
- `.claude/tests/README.md`: the factory suites' counts and the break lists' totals.
- `CLAUDE.md` TAAS row: overproduction "answered with a delay instruction" (drop "being built").
- `games/CLAUDE.md` TAAS inventory: one clause on the delay if it reads naturally.
- `grep -rn` for each old count; nothing stale.

## Gates

`.claude/scripts/gates.sh --eval games/taas/index.html` -> `GATES: GREEN`; then each TAAS suite on
its own for its count (formal 43 / 39 / 9 untouched). Frame budget
(`.claude/scripts/frame-budget.cjs` with the busy pose) re-run, since the page changed: the median
must stay 16.7 ms. Record all of it in Results. Commit to `taas-delay`, push, tick the arc.

## What was done (2026-10-16)

- **`.claude/taas.md`**: the header's suite counts (factory 180 / 99 / 23; formal page 26 -> 39,
  stale since 2026-10-14); a new section **"A delay between tasks (CD, 2026-10-16) - stated"**
  after the storefront's What was built (the CD's words, the four answers, what was built, the
  measured lesson, the hair); a robots-table row for either job; **12 assumed-not-decided rows**
  (wording and one number per robot, 5 s, what ends an iteration, the slip only above 0, the
  `pause` state, the overlap with the roll-in, `setWait` refusing, the evals lines, saves, the
  controls, the pause sign, the hairline); open question 2 marked built, 8 given its first answer,
  **a new open question 10 (what the delay starts at)**; Architecture (an instruction with a value,
  the job-less row consulted by every job, `start` rows, grades, events, the hair's sort, the
  robot's page and `holdWait`, the `person()` hook); How to change it (an instruction with a value);
  a new **Measured (2026-10-16, the delay)** with the paced-vs-supervisor table and the sweep;
  Negative tests (124 / 123, 71 / 70, eval 4 / 4); the frame cost re-run; a History entry.
- **`.claude/tests/README.md`**: the three factory rows (180, 99, 23; the delay's and hair's rows;
  the paced persona and `EVAL_WAITS`; break lists 124 / 123, 71 / 70 and the eval's 4 / 4).
- **`CLAUDE.md`** TAAS row: overproduction "answered 2026-10-16 with a delay instruction" (no
  "being built"), open question 10, and a clause on the delay and the hair.
- **`games/CLAUDE.md`**: the TAAS inventory gains the delay; the Depth row's flush-part sentence
  gains the second case (a part sitting over another, the hair).
- Stale counts grepped in those five files and `.claude/games-index.md`: only the 2026-10-15
  History entry keeps 156 / 86 / 19, as history.

## Gates (2026-10-16)

- `.claude/scripts/gates.sh --eval games/taas/index.html`: smoke, games-sync, negtest scan, the four
  drive suites and both evals GREEN; **`GATES: GREEN`**.
- Each TAAS suite on its own: formal `drive-taas` **43**, `drive-taas-ui` **39**, `eval-taas` **9**
  (untouched); factory `drive-taas-factory` **180**, `drive-taas-factory-ui` **99**,
  `eval-taas-factory` **23**; all GREEN.
- Frame budget (busy pose, 390x844), four runs: **median 16.7 ms**, p95 16.7-16.8, max 16.8-33.3,
  **0-2 of 149 over**: inside budget, as before.
