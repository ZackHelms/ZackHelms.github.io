# taasdelay step 4 - the eval and both break lists

**Status:** open
**Arc:** `.claude/plans/taasdelay.delay-arc.md` (step 2's overproduction numbers are in Results).
**Scope:** `.claude/tests/eval-taas-factory.cjs`, `.claude/tests/negtests/taas-factory-engine.json`,
`.claude/tests/negtests/taas-factory-ui.json`; rows added to the two drive suites if a break
is missed.

## Eval

- A persona (or a phase of the attentive one) that sets a delay on its operator once the stall
  stays full: does the output bin stop filling, do the books still balance, does money end
  higher than without it (the planks it no longer presses cost $1 each)? Assert what is true
  and record the numbers; if the delay does not pay, say so in Results (that is a finding for
  the CD, not something to tune away).
- The existing claims stay green: the operator-first trap (now a decided lesson), the valid
  optimal path, "NO WAY OUT".

## Break lists (`.claude/scripts/negtest-copies.py`, never hand-edit the page)

- Engine list: add breaks for each piece of step 2 (the rule not on the list from the start, the
  wait skipped, the wait applied twice, waiting after a "looking", the slip rolled at 0 s, the
  slip never rolled, `setWait` not clamping, `load()` dropping `r.wait`, `release()` leaving
  `pause`). Run only the new names with `--only`, then classify every miss: a row missing, a row
  that cannot fail, or an equivalent change. Add rows for the first two, re-run those names.
- Page list: the same for step 3 (slider not wired, steppers not clamped, the pause sign never drawn, the picker
  hiding the delay, the evals line missing, the re-render breaking a drag). Step 1's five hair breaks are already in
  `taas-factory-ui.json` (the last five, `hair-*`), caught 5 of 5; count them in the list's total.
- Record caught / total for each list in Results, with every miss and what became of it.

## Done when

The eval GREEN with its new claims (count), both break lists run with every miss classified and
the new rows verified (each copy RED on its own row), no `@negtest` or neg copies left
(`.claude/scripts/negtest.sh scan`). Commit to `taas-delay`, push the branch, tick the arc.
