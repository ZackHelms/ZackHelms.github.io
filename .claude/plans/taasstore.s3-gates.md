# taasstore step 3 - gates

**Status:** DONE 2026-10-16 (results in the arc)
**Arc:** `.claude/plans/taasstore.storefront-arc.md`.
**Scope:** read-only checks; fixes only if a gate is red (then record the cause in the
arc's Results, traced to code, before fixing).

## Goal

Every gate that covers TAAS is green on the branch, both modes, before anything is stamped
or pushed to `main`.

## Steps (run from the repo root)

1. `.claude/scripts/gates.sh --eval games/taas/index.html` -> final line `GATES: GREEN`.
   It smokes the page and runs every `drive-taas*.cjs` (formal: `drive-taas.cjs`,
   `drive-taas-ui.cjs`; factory: `drive-taas-factory.cjs`, `drive-taas-factory-ui.cjs`),
   the `eval-taas*.cjs` evals with `--eval`, and `check-games-sync.cjs`. Read each suite's
   own last line, not only the summary.
2. Formal mode must be untouched by this brief: `drive-taas.cjs` and `drive-taas-ui.cjs`
   GREEN at their documented counts (`.claude/tests/README.md`: 43 and 39).
3. No break left behind in the page or the tree:
   - `grep -n "@negtest" games/taas/index.html` -> nothing;
   - `ls .claude/tests/.negcopies-* 2>/dev/null` -> nothing;
   - `git status --short` shows only intended files.
4. Frame budget (measured before the arc at 16.7 ms median; re-run only if the page
   changed since `b1d9838`):
   `NODE_PATH=/opt/node-tools/node_modules node .claude/scripts/frame-budget.cjs games/taas/index.html select=#mode-btn:robot-factory evalFile=.claude/scripts/poses/taas-factory-busy.js`
   -> median 16.7 ms.
5. Write the gate lines (each suite's checks and verdict) under the arc's Results, tick
   step 3, commit if anything changed, push the branch.

## Done when

`GATES: GREEN`, all six TAAS suites green with their counts recorded, no `@negtest` in
the page.
