# taasstore step 4 - ship, verify the deploy, report

**Status:** open
**Arc:** `.claude/plans/taasstore.storefront-arc.md` (its Results hold the report's facts).
**Scope:** the badge, git, the Pages deploy, the CD's report. Rules: root `CLAUDE.md` §
Git workflow, `.claude/zmh/producer.md` § Publish and § Reporting.

## Steps

1. **Badge:** `.claude/scripts/stamp-badge.sh games/taas/index.html` -> `STAMPED ...`.
   Read it back from the file (`grep -o 'build 20[^<]*' games/taas/index.html`) and use that
   exact string in the report. Smoke once more:
   `NODE_PATH=/opt/node-tools/node_modules node .claude/scripts/smoke-mobile.cjs games/taas/index.html`
   -> `SMOKE: GREEN`.
2. **Close the arc in the same commit:** mark the arc and the four step files
   `IMPLEMENTED 2026-10-16` (or the day it lands) and move all five to
   `.claude/plans/DONE/` with `git mv`.
3. **One clean commit:** on `taas-storefront`,
   `git reset --soft $(git merge-base HEAD origin/main)` and commit once:
   `feat(taas): the storefront - wood by size and quality, the planer, a counter that sells to customers, slots 02-04`,
   with a body summarizing the brief, the two answers, the suites and break lists (counts
   from the arc), and the attribution lines from the session's system reminder. No model
   name in the message.
4. **Push, re-checked immediately before:** `git fetch origin main` and
   `git rev-list --count HEAD..origin/main`. If non-zero, merge `origin/main` into
   `taas-storefront`, resolve there, re-run step 3's gates, then continue. Then
   `git checkout main && git merge --ff-only taas-storefront && git push -u origin main`.
   If another session's commits came in, check their files survived (`git show --stat`).
   Then delete the side branch: `git push origin --delete taas-storefront` and
   `git branch -d taas-storefront`.
5. **Deploy:** `mcp__github__actions_list` with `method: list_workflow_runs`,
   `resource_id: '266280069'`, `perPage: 1`; match `head_sha` to the push, read the jobs.
   Budget two checks (the second via `send_later`, ~3 min). A run left unconfirmed is a
   debt: say so in the report with the run URL.
6. **Report to the CD**, short, plain ASCII, labelled ("inferred:", "assumed:", "source:"):
   what shipped in a few lines, the badge string, the deploy verdict, the two inferences
   and the main assumptions (arc Results), and the open questions worth their call (the
   operator-first trap, overproduction, fixed demand). Suggest what to playtest first: carry a
   plank to the counter, hire the stocker, then the operator.

## Done when

`main` carries the one commit, Pages ran green for its SHA (or the report says plainly it
is unconfirmed), the plans sit in `.claude/plans/DONE/`, and the CD has the report.
