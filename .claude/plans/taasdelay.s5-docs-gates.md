# taasdelay step 5 - docs final and gates

**Status:** open
**Arc:** `.claude/plans/taasdelay.delay-arc.md` (every count and finding is in Results).
**Scope:** `.claude/taas.md`, `.claude/tests/README.md`, `CLAUDE.md`, `games/CLAUDE.md`; no code.

## Docs

- `.claude/taas.md`, robot factory:
  - a "### A delay between tasks (CD, 2026-10-16) - stated" section after the storefront's
    "What was built": the CD's words, the four answers table (copy from the arc), what was built;
  - the robots table: the delay's row (both jobs);
  - the hair fix (step 1): one line in the 3D kit notes (a part that sits on another sorts with
    that part's centre, not its own; the hair is a cap of the faces outside the head), and the
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
