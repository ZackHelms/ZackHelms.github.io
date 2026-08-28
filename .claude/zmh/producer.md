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
  work is recoverable rather than silently skipped. Currently outstanding: **nothing** — the long-running
  entry was cleared by the 2026-08-27/28 star-surge scale pass, see below.

  **CLEARED 2026-08-28: `dd6e9c1` + `60ae87c`** — the two Games-hub commits
  (Star Surge first and every card description trimmed to 24 words; Ember
  Depths second in the grid) that the concurrent hub/star-surge session pushed
  *after* its own refine commit `4d0f869`. The 2026-08-25 ember-depths pass ran alongside it, was
  scoped by the CD to Ember Depths only, and moved the pointer past all three;
  `4d0f869` is that session's own refine commit and is skippable, but those two
  hub commits are not. **Still outstanding after the 2026-08-27 ember-depths
  pass**, which was scoped to Ember Depths again and whose range
  (`a0c8504..fc27bf1`) sat entirely above them: that range held three
  ember-depths feature commits plus `7ff3392` (its own earlier refine commit)
  and `8b6ca0a` (the CD's PR merge of that work) — both skippable, neither
  hiding anything. **Still outstanding after the second 2026-08-27
  ember-depths pass** (the economy/persona one, pointer `8dd459f`, refine
  commit `5f6063b`), which left nothing NEW behind and is worth reading as the
  benign case: a concurrent star-surge session pushed `14fb540` + its merge
  `f66af0b`, and the CD pushed `1d67ef4` (a settings chore), but all three
  landed on `main` *after* the pointer was written and were merged in
  afterwards — so they are still inside `git log 8dd459f..HEAD` rather than
  buried under it. **The pointer only hides what was already an ancestor when
  it was written**, which is checkable in one line and worth checking rather
  than assuming: `git merge-base --is-ancestor <their-sha>
  $(cat .claude/last-refine-sha)`. That pass also hit the shared-file merge
  CLAUDE.md § Git workflow warns about — both sessions edited adjacent rows of
  `.claude/tests/README.md`'s suite table, resolved by taking their
  star-surge row (98 checks) and this session's ember-depths rows, then
  verifying their five files were byte-identical to `origin/main` with
  `git diff --stat origin/main -- <paths>` before reporting done.
  **The 2026-08-27/28 star-surge scale pass** (pointer `bd1fca5`) closed the
  two-day-old hub entry, and the way it closed is the argument for this list
  existing at all: `dd6e9c1`'s rule — every hub card at 24 words or fewer —
  had been applied to all 49 cards and then written down **nowhere**, while
  `check-games-sync.cjs` enforced only a two-sentence cap that two long
  sentences clear easily. Reading the skipped commit's own message was what
  surfaced it; adding the word cap to the gate immediately caught two cards
  (Ember Depths at 28, Block Fit at 25) that had already drifted back over it
  in three days. A skipped commit is not just unrefined work — it can be a
  rule the repo is silently no longer keeping. That pass otherwise ran with
  the concurrent ember-depths session and left nothing new behind: the other
  commits in `8dd459f..bd1fca5` were `5f6063b` (their refine commit),
  `b82f09d`/`c27f126` (their merges of this session's work) and `8a261e7`
  (their own note into this file) — all theirs and all already recorded.
  Earlier entries, all since cleared:
  turret-builder's `acb50c1` + `e9ea508` were an entry and the
  2026-08-23 turret-builder pass refined them (it also found and fixed a live
  cel-shading defect that had shipped in `acb50c1`, which is the argument for
  keeping this list rather than letting a skipped range disappear). The second
  2026-08-23 turret-builder pass (`6827c5f`, five graphics styles) ran alone in
  the range too — every commit between the pointer and HEAD was that session's
  own, including its own earlier refine commit, so nothing was left behind.
  The 2026-08-23 star-surge station pass (`992a7bd`, `430b647`) likewise left
  nothing behind: the only other commit in its range was `1e8a778`, the
  turret-builder session's own refine commit, already accounted for above.
  The 2026-08-24 star-surge title-screen pass (`21301b6`) ran alone: the only
  other commit between the pointer and HEAD was `cf8ac9d`, its own session's
  earlier refine commit. The 2026-08-25 star-surge 3D-models pass (`2e89f88`,
  `1193863`, `088011f`) ran alone too — the only other commits in range were
  `ba0a205`/`2fe476c`, the same session's earlier refine pass. The 2026-08-25
  star-surge animlight pass (`d38bf1d`, `f2c3cb1`) likewise ran alone: the only
  other commit between the pointer and HEAD was `f367a52`, that same session's
  3D-models refine commit.

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
  stuck Pages build silently keeps serving the last-good deploy. Read that
  run's **jobs**, not the run object — and read the stuck job's **log**
  before concluding anything: on 2026-08-23 the run reported `in_progress`
  after all three jobs had concluded `success`, and an hour later the
  deploy *job* reported `in_progress` for nine minutes after its log said
  `Reported success!`. A hung-looking deploy is usually a stale status, not
  a wedge. Spotting the badge on the live page is **not** available from a
  remote session — the agent proxy 403s **both** hostnames on CONNECT
  (`tythos.com`, the site's custom domain per the repo-root `CNAME`, and
  `zackhelms.github.io`; re-verified 2026-08-23) — so the workflow conclusion
  is the whole verification.
  Parse the oversized run listing with
  `node .claude/scripts/pages-status.cjs <saved-result> <sha>`, which prints a
  `PAGES=` verdict and exits non-zero unless it is `success`. Full procedure:
  `.claude/notes/20260817-pages-deploy-wedged-after-503.md`.
- Authorization: pushing to `main` is standing authorization (CLAUDE.md §
  Git workflow); no separate publish sign-off needed.

## Reporting
- Handoff convention: default two-line ending, plus the badge SOP — when
  any game file (or `games/index.html`) was edited, state its exact
  `build YYYY-MM-DD HH:MM UTC` badge string in the report so the CD can
  check the live page against it (`games/CLAUDE.md` § Build Timestamp
  Badge).
