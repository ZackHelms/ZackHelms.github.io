# zmh-producer config — ZACKHELMS.GITHUB.IO

## Environment
- Shell: bash
- Working tree: the `ZackHelms.github.io` repo root (remote Claude sessions:
  `/home/user/ZackHelms.github.io`)
- Setup quirks: none for editing — static site, no build system, no
  dependencies. The smoke gate (see § Validation) needs Chromium +
  `playwright-core`; remote sessions have Chromium pre-installed at
  `/opt/pw-browsers/chromium` and can `npm install playwright-core` in the
  session scratchpad (run the gate with `NODE_PATH` pointing at that
  `node_modules`).

## Backlog (TODO.md)
- Buckets, in file order: In progress · Now · Needs Zack · Next · Later ·
  Icebox
- Needs-Zack bucket name(s): `## Needs Zack`
- Icebox bucket: Icebox
- In-progress SOP: no
- Done log: DONE.md
- **Note:** `TODO.md`/`DONE.md` exist but are scoped to **Phasic** only
  (created 2026-07-31/08-01) — other games' work is tracked per-game in
  `.claude/<game>.md` until it earns a CD-facing backlog entry here (see
  `TODO.md`'s own header note).

## Plans
- Plans dir: `.claude/plans/` (archive: `.claude/plans/DONE/`)
- Plan template: `.claude/templates/plan.md` (present; Phasic's oversee
  plans use it)
- Task-scoping skill: none
- Metrics ledger: none
- **Note:** `.claude/last-refine-sha` is a **single repo-wide pointer**, but this
  repo routinely has two game sessions in flight at once (CLAUDE.md § Git
  workflow). Whichever refines first moves the pointer for both, so
  `git log <sha>..HEAD` can hand a session a scope that is mostly another
  session's already-refined work — and can hide its own earlier commits behind
  the other session's refine commit. Read the commit *subjects* in that range
  and refine only what this session actually did; a `docs(claude): refine …`
  commit in the range is the other session's pass and is skippable. (Hit
  2026-08-22: the star-surge pass set the pointer to `ca7891a`, so the
  neon-clash session's own `9410b86`/`312f002` sat below it, unrefined.)
- **Say what you left behind.** Because moving the pointer hides everything
  below it, a pass that deliberately refines only its own commits should name
  the other session's SHAs in its report *and* leave them listed here, so the
  work is recoverable rather than silently skipped. Currently outstanding:
  **`acb50c1` + `e9ea508`** (turret-builder's cel-shaded graphics style,
  2026-08-23) — below the pointer as of the star-surge pass at `7b7161d`, never
  refined by their own session. Whoever picks turret-builder up next should
  refine those two before doing anything else; delete this line when they have.

## Validation
- Procedure: headless mobile smoke-load of every changed page (the games
  are mobile-first; iPhone 13 viewport is the design target), then compare
  each changed page's `#build-badge` timestamp against what deploys (SOP in
  `games/CLAUDE.md` § Build Timestamp Badge)
- Hard gate command: `node .claude/scripts/smoke-mobile.cjs <page ...>` —
  loads each page in headless Chromium at iPhone 13 viewport and fails on
  any console/page error; prints `SMOKE: GREEN` / `SMOKE: RED` as its final
  line (exit 0/1). Requires Chromium + `playwright-core` (see § Environment);
  when they are unavailable, state so in the report — never skip silently.
- Second hard gate, whenever the games catalog changed (a game added,
  renamed, re-faceted, or removed):
  `node .claude/scripts/check-games-sync.cjs` — proves the hub card, the hub
  `GAMES[]` dataset and the `.claude/games-index.md` row agree, and that the
  index's count line adds up. Prints `GAMES-SYNC: GREEN` / `RED` (exit 0/1).
  Pure node: no Chromium, no dependencies, so there is never a reason to skip
  it.

## Integration (oversee wrap-up)
- Mode: direct-merge-push
- Detail: CLAUDE.md § Git workflow ("It is fine to push directly to the
  `main` branch for this repository. No pull request is required.")

## Publish
- Step: pushing to `main` **is** the publish — GitHub Pages auto-deploys.
  Verification is mandatory: confirm the "pages build and deployment"
  workflow run for the pushed SHA concludes `success` (remote sessions:
  `mcp__github__actions_list`), because `git push` ≠ live — a failed or
  stuck Pages build silently keeps serving the last-good deploy. Then spot
  the badge timestamp on the live page when possible.
- Authorization: pushing to `main` is standing authorization (CLAUDE.md §
  Git workflow); no separate publish sign-off needed.

## Reporting
- Handoff convention: default two-line ending, plus the badge SOP — when
  any game file (or `games/index.html`) was edited, state its exact
  `build YYYY-MM-DD HH:MM UTC` badge string in the report so the CD can
  check the live page against it (`games/CLAUDE.md` § Build Timestamp
  Badge).
