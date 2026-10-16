# taasstore - TAAS robot factory: the storefront brief (plan arc)

**Status:** IN PROGRESS (steps 1-3 done; step 4 open)
**Requested:** 2026-10-15 (the CD's storefront brief, two answers: customers "Across the
counter", a full room "Room fills up").
**Scope:** `games/taas/index.html` (the `FACTORY` engine and the factory UI),
`.claude/tests/drive-taas-factory*.cjs`, `.claude/tests/eval-taas-factory.cjs`,
`.claude/tests/negtests/taas-factory-*.json`, `.claude/scripts/poses/taas-factory-busy.js`,
`.claude/taas.md`, `.claude/tests/README.md`, `CLAUDE.md`, `games/CLAUDE.md`.

## How to use this arc

One step per session turn, then `/compact`. Each step has its own plan file with
everything needed to resume from disk alone. To run the next step after a compact:

> Run the next open step of `.claude/plans/taasstore.storefront-arc.md`.

At the end of each step: tick it below, write what it found under **Results** (numbers
the later steps need), commit to the branch and push the branch (never `main` before
step 4).

## Arc

| # | Step | Plan file | Status |
|---|---|---|---|
| 0 | Brief, engine v3, rules suite, UI, page suite, eval, busy pose and frame budget, engine break list, docs spliced | (this session, before the arc) | DONE - WIP commit `b1d9838` on `taas-storefront` |
| 1 | Finish the page's break list: classify every miss, add rows, re-run the misses | `taasstore.s1-page-break-list.md` | DONE - 49 of 50 caught |
| 2 | Docs final: fill the placeholders from step 1's results, check every count | `taasstore.s2-docs-final.md` | DONE - no placeholder, counts match |
| 3 | Gates: every suite, smoke, games-sync, no break left in the page | `taasstore.s3-gates.md` | DONE - GATES: GREEN, six suites green |
| 4 | Ship: badge, one clean commit, fast-forward `main`, push, Pages deploy, report to the CD | `taasstore.s4-ship.md` | open |

## Results (shared memory between steps; append, do not rewrite)

- **Branch:** `taas-storefront` (local and pushed; `main` untouched). Local `main` and
  `origin/main` were at the same SHA when the branch was cut.
- **Suites (green on the page at `b1d9838` + the step-1 row):** rules
  `drive-taas-factory.cjs` 156 checks; page `drive-taas-factory-ui.cjs` 83 checks (82 + the
  overlap row added in step 1); eval `eval-taas-factory.cjs` 19 checks, 8 personas.
- **Engine break list** (`negtests/taas-factory-engine.json`): 101 breaks, 100 caught; the
  miss is `bubbleOpen()`'s arrival check, an equivalent change (every `tap()` clears the
  bubble). Already written up in `.claude/taas.md` § Negative tests (factory).
- **Page break list** (`negtests/taas-factory-ui.json`, 50 breaks): the first run reached
  34 verdicts (31 caught, 3 missed; `<scratchpad>/v3/neg/ui.out`) before a container
  restart killed it. The other 16 were restarted with `--only` against the current suite
  (with the overlap row) into `<scratchpad>/v3/neg/ui2.out` (`ui2.log`); the list of names is
  `<scratchpad>/v3/neg/rest.txt`. Misses so far:
  - `tap-keys-flat` (tap targets' depth key flattened to 0): **a row was missing**. The
    planer's box overlaps the recycle bin's on screen and only the key makes the bin, in
    front, win. Row added to the page suite's section 5 ("where two things overlap on
    screen, a tap there reaches the one standing in front"), judged by the layout's
    footprints, not the page's keys. Verified: page GREEN 83/83, the break's copy RED.
  - `money-stale` (the wall's money board drawn from `shownMoney` instead of `s.money`):
    **a row was missing**, though the effect is one frame: `draw()` runs before
    `renderHud()` updates `shownMoney`, so the board showed each new sum 16 ms late, and the
    "figures" row settles three frames before reading. New row in section 13: down from
    $7,777 to $4 (no swell), the first frame's board must match a dt-0 redraw ("it shows a
    new sum on the very frame the money changes"). Pins the boards' rule: draw from the
    state. Verified: page GREEN, the copy RED on that row only.
  - `saw-never-spins` (`const a0 = run ? clock * 22 : 0.3;` -> `const a0 = 0.3;`, the
    table saw's blade angle frozen): **the row could not fail**. Its "spinning" frames
    differed because of the plank sliding over the table and the dust puffs, not the blade.
    Section 11's row now holds the engine (`FACTORY.step` stubbed) and the dust
    (`Math.random` stubbed) for 1.5 s before the two frames, so only the blade can move.
    Verified: page GREEN, the copy RED (0 px changed).
  - `stall-stock-undrawn` (the stall's planks never drawn on the counter): **a row was
    missing**. New row in section 13: one plank then three on the stall change the stall's
    pixels (~2,500 px each step at 390 px; 0 on the copy).
  - `carry-count-gone` (the count badge over your arms never drawn): **a row was
    missing**. New row at the start of section 15: one thing in your arms adds no white,
    two or three add a white badge (~600 px; 0 on the copy).
  - **Page suite now 86 checks** (82 + overlap + same-frame money + stall + badge). Both new
    rows verified: page GREEN 86/86, each copy RED on its own row only.
  - `no-remeasure` (`enter()`'s `VW.w = 0;` deleted): **equivalent for its purpose**.
    `layout()` runs only while the factory shows (`frame()` and the resize listener both
    check `on`) and compares against the last size it measured, so a resize made in formal
    mode is still caught on the way back in. Its only visible effect: coming back from
    formal mode no longer scrolls the view to the top (`first` resets `camY`). Not pinned
    by a row, since nobody asked for either behaviour.
- **Page break list, final (step 1 done):** **49 of 50 caught** (first run 31 of 34 before
  the restart, then 13 of 16, then the 5 fixed misses re-run with `--only`, all caught,
  `<scratchpad>/v3/neg/ui3.out`). The one miss is `no-remeasure`, equivalent (above).
  Page suite **86 checks**, GREEN.
- **Fill text for step 2:**
  - `@UICAUGHT@` -> `49`
  - `@UIROW@` -> `49 of 50 breaks caught (`negtests/taas-factory-ui.json`); five misses
    became rows, and the one left is an equivalent change, recorded in `.claude/taas.md`.`
  - `@UIMISSES@` -> "The page list's first runs caught 44 of 50: five misses were rows not
    yet written or rows that could not fail (a tap where the planer's box overlaps the
    recycle bin's, which only the depth key settles; the money board drawn one frame late,
    since `draw()` runs before `renderHud()`; the saw-blade row, which passed on the
    sliding plank and the dust with the blade frozen; the planks on the stall; the count
    badge over your arms), and all five are caught now. **The page's one miss is an
    equivalent change**: `enter()`'s `VW.w = 0`, since `layout()` only runs while the
    factory shows and compares against the size it last measured, so a resize made in
    formal mode is still caught on the way back; its only visible effect is that coming
    back from formal mode scrolls the view to the top." 
- **Placeholders left in the docs for step 2:** `@UICAUGHT@` (twice in `.claude/taas.md`),
  `@UIMISSES@` (once in `.claude/taas.md`), `@UIROW@` (once in `.claude/tests/README.md`).
- **For the report (step 4):**
  - inferred: "Fix sap jam costs $5" means scrubbing a jam costs $5.
  - inferred: the CD's mistake example said a wrong sale pays $5; the build pays the stall's
    $4 (times satisfaction), since medium planks now sell for $4.
  - assumed: item lengths, the log mix (sizes 20/65/15%, qualities 75/15/10%), every timing,
    the customers' rate (every 8-16 s), the carvings, UI choices: full list in
    `.claude/taas.md` § Assumed, not decided (factory).
  - Design finding, an open question: **hiring the operator first is a trap** (it presses
    every log at $1 while you still carry every plank); moving it to stocking recovers.
    Also overproduction and fixed demand (`.claude/taas.md` § Open questions for the CD
    (factory), 1-3).
- **Docs final (step 2 done, 2026-10-16):** the three placeholders filled (`grep -rn "@UI"`
  over `.claude`, `CLAUDE.md`, `games/CLAUDE.md` finds only this arc's own notes); counts checked
  against the suites' own last lines: rules `CHECKS=156` GREEN, eval `CHECKS=19` GREEN, page 86
  (step 1's GREEN run). No stale count near "factory" (the only hits for the old numbers were
  "2026-10-15)"). The factory sections read end to end: machine01 and "seller" appear only in
  the CD's quoted briefs, the change history and the assumed table's "what changed" rows. One
  wording fix: the engine list's "nine misses were rows" listed eight (the ninth is the
  equivalent); now "eight of its nine misses were rows". `CLAUDE.md` and `games/CLAUDE.md`
  read true.
- **Gates (step 3 done, 2026-10-16):** `.claude/scripts/gates.sh --eval games/taas/index.html`
  -> `GATES: GREEN` (SMOKE, GAMES-SYNC, NEGTEST-SCAN "nothing changed", four drives, two
  evals). Each suite run on its own, its own last lines:
  - formal, untouched: `drive-taas.cjs` `CHECKS=43` `TAAS: GREEN`; `drive-taas-ui.cjs`
    `CHECKS=39` `TAAS-UI: GREEN` (both at the README's counts);
  - factory: `drive-taas-factory.cjs` `CHECKS=156` `TAAS-FACTORY: GREEN`;
    `drive-taas-factory-ui.cjs` `CHECKS=86` `TAAS-FACTORY-UI: GREEN`;
  - evals: `eval-taas.cjs` `CHECKS=9` `TAAS-EVAL: GREEN`; `eval-taas-factory.cjs`
    `CHECKS=19` `TAAS-FACTORY-EVAL: GREEN`.
  - Nothing left behind: no `@negtest` in the page, no `.claude/tests/.negcopies-*`, the
    tree clean before this note. The page is unchanged since `b1d9838` (empty
    `git diff --stat b1d9838 -- games/taas/index.html`), so the frame budget's 16.7 ms
    median stands and was not re-run.
