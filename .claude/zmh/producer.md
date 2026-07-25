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
- **Note:** `TODO.md`/`DONE.md` do not exist yet — this repo has never had a
  backlog file. The first `/zmh-producer:backlog-refine` run creates them
  with the bucket layout above; until then, commands that read the backlog
  treat it as empty rather than failing.

## Plans
- Plans dir: `.claude/plans/` (archive: `.claude/plans/DONE/`)
- Plan template: `.claude/templates/plan.md` — not yet present; the first
  `/zmh-producer:backlog-plan-gen` run copies the plugin's plan template
  here before writing its first plan
- Task-scoping skill: none
- Metrics ledger: none

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
