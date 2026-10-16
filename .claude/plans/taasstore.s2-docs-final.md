# taasstore step 2 - docs final

**Status:** DONE 2026-10-16 (results in the arc)
**Arc:** `.claude/plans/taasstore.storefront-arc.md` (read its Results first: they hold the
numbers this step writes).
**Scope:** `.claude/taas.md`, `.claude/tests/README.md`, `CLAUDE.md`, `games/CLAUDE.md`.
No code.

## Goal

The docs describe the storefront build exactly, with no placeholder and no stale count.

## Steps

1. Fill the placeholders from the arc's Results:
   - `.claude/taas.md`, § Negative tests (factory): `@UICAUGHT@` (the page list's caught
     count) and `@UIMISSES@` (one or two sentences: each miss, whether a row was added or
     why it is equivalent; match the style of the engine list's sentence before it).
   - `.claude/taas.md`, § History, the 2026-10-15 entry: `@UICAUGHT@`.
   - `.claude/tests/README.md`, the `drive-taas-factory-ui.cjs` row: `@UIROW@` ->
     "N of 50 breaks caught (`negtests/taas-factory-ui.json`); <misses>."
   - `grep -rn "@UI" .claude CLAUDE.md games/CLAUDE.md` -> nothing.
2. Check every count against the suites' own output (run them; pure node ones are fast):
   - rules: `node .claude/tests/drive-taas-factory.cjs | tail -2` (156 at `b1d9838`);
   - page: the step-1 final count (83 at the end of the first miss);
   - eval: `node .claude/tests/eval-taas-factory.cjs | tail -2` (19).
   Places that state them: `.claude/taas.md` header (line ~22) and the 2026-10-15 History
   entry; `.claude/tests/README.md` the three factory rows. Grep for the old numbers (128,
   63, 15, 55, 102, 60) near "factory" to catch leftovers.
3. Read `.claude/taas.md` § Robot factory mode from "The storefront" down to "How to change
   it (factory)" once, end to end, for anything still describing the old build (machine01
   as the machine's name outside the brief's quotes, "seller" for the stocker, the plank
   bin, $5 planks, the sale bin).
4. `CLAUDE.md` (the `games/taas/` bullet and the TAAS context-file row) and
   `games/CLAUDE.md` (the TAAS inventory paragraph, ~4,100 lines) were updated before the
   arc; check they still read true.
5. Tick step 2 in the arc, commit (`docs(taas): ...`) to `taas-storefront`, push the branch.

## Done when

No `@UI` placeholder anywhere, every stated count matches a suite's output, and nothing in
the factory sections describes the pre-storefront build as current.
