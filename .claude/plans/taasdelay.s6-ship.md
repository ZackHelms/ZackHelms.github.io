# taasdelay step 6 - ship, verify the deploy, report

**Status:** open
**Arc:** `.claude/plans/taasdelay.delay-arc.md` (its Results hold the report's facts).
**Scope:** the badge, git, the Pages deploy, the CD's report. Rules: root `CLAUDE.md` § Git
workflow, `.claude/zmh/producer.md` § Publish and § Reporting. Same shape as
`.claude/plans/DONE/taasstore.s4-ship.md`.

## Steps

1. **Badge:** `.claude/scripts/stamp-badge.sh games/taas/index.html`; read it back
   (`grep -o 'build 20[^<]*' games/taas/index.html`); smoke once more -> `SMOKE: GREEN`.
2. **Close the arc in the same commit:** mark the arc and its six step files
   `IMPLEMENTED <date>` and `git mv` all seven to `.claude/plans/DONE/`.
3. **One clean commit** on `taas-delay`: `git reset --soft $(git merge-base HEAD origin/main)`,
   then `feat(taas): a delay between a robot's tasks, and people keep their hair facing the camera`,
   a body (the CD's ask and four answers, the suites' counts, the break lists) and the
   attribution lines from the session's system reminder. No model name.
4. **Push, re-checked immediately before:** `git fetch origin main`,
   `git rev-list --count HEAD..origin/main`; if non-zero, merge `origin/main` into `taas-delay`,
   re-run the gates, then go on. `git checkout main && git merge --ff-only taas-delay &&
   git push -u origin main`. Delete the local branch; the remote one cannot be deleted from a
   remote session (the proxy refuses ref deletion): add it to `TODO.md`'s branch item instead.
5. **Deploy:** `mcp__github__actions_list`, `list_workflow_runs`, `resource_id: '266280069'`,
   `perPage: 1`; match `head_sha`, read the jobs; a second check via `send_later` (~3 min).
6. **Report to the CD**, short, plain ASCII, labelled: what shipped (the delay, and the hair fix with its traced cause), the badge string, the
   deploy verdict, the assumptions worth their call (wording, default 5 s, the stocker's
   iteration, the slider), the eval's finding on overproduction, and what to try first (set a
   delay on an instructed operator once the stall stays full and watch the output bin).

## Done when

`main` carries the one commit, Pages ran green for its SHA (or the report says it is
unconfirmed), the plans sit in `.claude/plans/DONE/`, and the CD has the report.
