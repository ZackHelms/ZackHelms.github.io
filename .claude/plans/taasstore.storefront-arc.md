# taasstore - TAAS robot factory: the storefront brief (plan arc)

**Status:** IN PROGRESS (steps 1-4 below; everything before them is built and committed)
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
| 1 | Finish the page's break list: classify every miss, add rows, re-run the misses | `taasstore.s1-page-break-list.md` | IN PROGRESS |
| 2 | Docs final: fill the placeholders from step 1's results, check every count | `taasstore.s2-docs-final.md` | open |
| 3 | Gates: every suite, smoke, games-sync, no break left in the page | `taasstore.s3-gates.md` | open |
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
- **Page break list** (`negtests/taas-factory-ui.json`, 50 breaks): run in progress, see
  step 1. Misses so far:
  - `tap-keys-flat` (tap targets' depth key flattened to 0): **a row was missing**. The
    planer's box overlaps the recycle bin's on screen and only the key makes the bin, in
    front, win. Row added to the page suite's section 5 ("where two things overlap on
    screen, a tap there reaches the one standing in front"), judged by the layout's
    footprints, not the page's keys. Verified: page GREEN 83/83, the break's copy RED.
  - `money-stale` (the wall's money board drawn from `shownMoney` instead of `s.money`):
    not yet classified.
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
