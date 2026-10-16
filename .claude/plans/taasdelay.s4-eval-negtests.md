# taasdelay step 4 - the eval and both break lists

**Status:** IN PROGRESS (eval and engine list done; the page list is running)
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
  **Done in step 2 (2026-10-16):** 23 breaks `delay-*` covering all of the above and more are
  already the last 23 entries of `taas-factory-engine.json` (124 now), caught 23 of 23 (one row
  widened after a miss; see `taasdelay.s2-engine.md`). Run the whole list once here for the
  total; add breaks only for what step 4's eval claims rely on.
- Page list: the same for step 3 (slider not wired, steppers not clamped, the pause sign never drawn, the picker
  hiding the delay, the evals line missing, the re-render breaking a drag). Step 1's five hair breaks are already in
  `taas-factory-ui.json` (the last five, `hair-*`), caught 5 of 5; count them in the list's total.
- Record caught / total for each list in Results, with every miss and what became of it.

## Done when

The eval GREEN with its new claims (count), both break lists run with every miss classified and
the new rows verified (each copy RED on its own row), no `@negtest` or neg copies left
(`.claude/scripts/negtest.sh scan`). Commit to `taas-delay`, push the branch, tick the arc.

## What was found (2026-10-16)

**Eval** (`eval-taas-factory.cjs`): **23** claims GREEN (19 + 4), ~1.5 s. A ninth persona, `paced`,
plays the supervisor for an hour beside the supervisor played for the same hour (seed 7, both
added to the table as `paced 1h` / `supervisor 1h`). Once its operator holds its whole plan and a
stall's worth of medium planks waits in the output bin behind a full stall (16.7 min), it puts
"Wait between tasks" in the operator's fifth slot ($25), leaves the slider at its start (5 s),
and once a minute nudges it a second: longer while the bin holds more than a stall's worth and is
not falling, shorter when it holds fewer than two or a customer waits at an empty stall (the
persona's rule is assumed, a player with a slider). Its waits ran 5,6,7,6,5,4,3,2,1,0,1,2,3,4,5,
4,3,2 s (the rule overshoots: it looks once a minute). The four claims:
1. a line that makes more than it sells fills its bin: the supervisor's medium planks climb for
   its last twenty minutes, 80 -> **116** by the hour (each a $1 log never sold);
2. the delay stops it: the paced bin holds at most **12** in the last twenty minutes, **3** at
   the hour;
3. without starving customers: served **297 vs 302**, nobody waiting at the end, satisfaction
   **100%** throughout;
4. and it pays: money **$658 vs $575** (+83 after the $25 slot), running costs $343 vs $471.
The books-balance claim now covers the two hour-long runs too. Under `TAAS_PAGE` the eval prints
`PASS-ON-COPY`, not GREEN.

**Not asserted, the sweep** (`EVAL_WAITS=1`, ~8 s more): the paced persona with the slider left
at one value from the same moment, seeds 1-8, an hour each, against the supervisor:

| Wait | Medium planks in the bin at 1 h | Satisfaction at 1 h | Money vs no delay |
|---|---|---|---|
| none | 116-151 | 100% | - |
| tuned (the persona) | 3-10 | 100% on 8 of 8 (one dipped to 59% mid-run) | +51 to +120 |
| 2 s | 45-67 (still overproduces) | 100% on 8 of 8 | +23 to +65 |
| 3 s | 6-37 | 100% on 8 of 8 | +60 to +102 |
| 4 s | 0-2 | 10-33% on 4 of 8 | -102 to +119 |
| 5 s (the default) | 0 | **10-24% on 8 of 8** | -321 to +53 |

So a delay pays when it is tuned, or left at 3 s; **the 5 s default starves the customers** once
the bin's stock runs out (the operator waits after every log it handles, tossed ones included,
the CD's answer 4). This confirms step 2's finding over eight more seeds and an hour: a finding
for the CD (a 3 s default?), not tuned here.

**Eval break list (new)**, `negtests/taas-factory-eval.json`, 4 breaks against the eval, **4 of
4** caught, each new row RED on a break of its own: demand doubled (`shop.every` halved) -> row 1
(among 12 rows); the operator never pauses -> rows 2 and 4; every wait 60 s whatever the slider
says -> rows 3 and 4; each wait billed $3 -> row 4 alone.

**Engine break list** (`taas-factory-engine.json`, 124, against `drive-taas-factory.cjs`, whole
list): **123 of 124**; the miss is `bubble-before-arrival`, the known equivalent change
(`bubbleOpen()`'s arrival check, which every `tap()` makes redundant; `.claude/taas.md` § Negative
tests). All 23 `delay-*` caught.

