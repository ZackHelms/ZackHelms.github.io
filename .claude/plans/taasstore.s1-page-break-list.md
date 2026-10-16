# taasstore step 1 - finish the page's break list

**Status:** IN PROGRESS
**Arc:** `.claude/plans/taasstore.storefront-arc.md` (read its Results first).
**Scope:** `.claude/tests/drive-taas-factory-ui.cjs` (rows only), the arc's Results.
**Do not edit `games/taas/index.html` while a break-list run is going**: the runner copies
the page per break. The suite is safe to edit (`--freeze` runs a frozen copy).

## Goal

Every break in `.claude/tests/negtests/taas-factory-ui.json` (50) is either caught by the
page suite or recorded as an equivalent change with the reason, and the final caught count
is in the arc's Results.

## The run

Started 2026-10-15 ~23:49 UTC in the background (two Chromium jobs, ~25 s a break):

```
NODE_PATH=/opt/node-tools/node_modules timeout 3600 python3 .claude/scripts/negtest-copies.py \
  .claude/tests/negtests/taas-factory-ui.json --page-env TAAS_PAGE --jobs 2 \
  --freeze .claude/tests/drive-taas-factory-ui.cjs \
  --log /tmp/claude-0/-home-user/7849a3ec-e84f-5892-9d27-69af77739d32/scratchpad/v3/neg/ui.log \
  -- node .claude/tests/drive-taas-factory-ui.cjs \
  > /tmp/claude-0/-home-user/7849a3ec-e84f-5892-9d27-69af77739d32/scratchpad/v3/neg/ui.out 2>&1
```

- Running? `pgrep -f "negtest-copies.py .claude/tests/negtests/taas-factory-ui"`.
- Verdicts: `grep "^NEG=" <scratchpad>/v3/neg/ui.out` (one line per break:
  `NEG=<name> VERDICT=caught|MISSED|CAUGHT-BY-CRASH ...`); the runner's final summary is at
  the end of that file.
- If the container was recycled (the scratchpad is gone and nothing runs), start it again
  with the command above (make the `neg/` directory first). Run from the repo root.

## For each MISSED break

1. Read it: `python3 -c` over the JSON, matching `name` (fields `old` / `new`).
2. Decide: **a row missing** (the break changes something a player could see or do) or
   **equivalent** (no input can tell the copies apart; say why, as the engine list's
   `bubbleOpen()` note does).
3. A row missing: add the row to the suite section that owns the behaviour, judged by
   something independent of the code under test (the layout's numbers, pixels, the
   engine's state), never by the same variable the break changed. Then prove it both ways:
   - the page: `NODE_PATH=/opt/node-tools/node_modules node .claude/tests/drive-taas-factory-ui.cjs`
     -> `TAAS-FACTORY-UI: GREEN`;
   - the break's copy: write the page with `old` replaced by `new` to the scratchpad and run
     the suite with `TAAS_PAGE=<copy>` -> RED, failing on the new row.
4. Record it under the arc's Results (the break, which kind, the row or the reason).

Known misses:
- `tap-keys-flat`: done (row added; see the arc).
- `money-stale`: `money = cash(s.money)` -> `cash(shownMoney || 0)` in the wall boards'
  draw. Note `.claude/taas.md` § Negative tests and games/CLAUDE.md "Reading pixels back":
  a drawn number needs its own check (compare the masks two different values draw). First
  find why today's money-board rows did not catch it (likely: `shownMoney` tracks
  `s.money` closely, so the stale value only lags; check what `shownMoney` is and when it
  updates) before writing the row.

## When the run has ended

- Re-run only the breaks that were MISSED and got a row, against the updated suite:
  the same command with `--only name1,name2` and a fresh `--log`/output file. Each must
  come back caught.
- Final count = breaks caught (first run + re-run). Equivalents stay MISSED and are named.
- Remove the runner's leftovers if any: `ls .claude/tests/.negcopies-*` must be empty.
- Write to the arc's Results: "Page break list: N of 50 caught; misses: <names and why>",
  the page suite's final check count, and the exact text to fill `@UIMISSES@` with.
- Tick step 1 in the arc, commit (`test(taas): ...`) to `taas-storefront` and push the branch.

## Done when

No break is unclassified, every row-missing break is caught on re-run, the page suite is
GREEN on the page, and the arc's Results hold the numbers step 2 needs.
