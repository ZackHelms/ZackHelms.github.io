# Oversee/burndown operations in this repo (2026-07-31, first burndown)

Lessons from the first `/zmh-producer:backlog-burndown` here (3 oversee
runs: phaspolish → phaswiki → phasweave, all merged + Pages-verified).
Session-ops knowledge, not game knowledge — the game lessons live in
`20260731-phasic-softbody-solver-validated-generation.md`.

## Worktree discipline for spawned implementers — every tier

A subagent does NOT reliably inherit the run worktree's cwd for git: a
haiku implementer with relative-path instructions committed to the primary
checkout's local `main` (repaired by cherry-pick onto the run branch +
resetting local main; nothing had been pushed). Every committing spawn
prompt now carries **absolute worktree paths** and **`git -C <worktree>`
for every git command**, plus "verify `branch --show-current` before
committing" — zero recurrences across the following 11 tasks. The shared
oversee command text was generalized to say this for all tiers
(zmhstudio `bab5176`).

## The CD queues while runs execute — ride the run branch

Mid-burndown CD requests (new backlog items, plan amendments) are safe to
record without waiting: edit `TODO.md`/plan files in the ACTIVE run's
worktree and commit with **explicit pathspecs** (`git commit TODO.md …`) —
implementers own only their listed files, so there is no collision, and
the edits merge to main with the run. Never plain `git commit` (the
implementer may have staged its files) and never `git add -A`.

## ExitWorktree after a merge

`ExitWorktree remove` refuses because the branch "has N commits" — that
check compares against the branch base, not main. After the `--no-ff`
merge the commits ARE preserved; verify with
`git branch --contains <branch-tip>` (must list main), then re-invoke with
`discard_changes: true`. Removing without that verification would be how
work actually gets lost — always check first.

## Pages verification cadence

Every merge gets its own "pages build and deployment" verification (the
jq-on-saved-file pattern, `20260724-parallel-game-batch-builds.md`). Slow
builds (4+ min) happen; don't poll hot — arm a `send_later` self check-in
(~6 min) and report only on failure. All three runs' deploys (#550-552)
concluded success.

## No repo-local implementer agents — and it was fine

This repo has no `.claude/agents/`; spawns used the general-purpose agent
with the Agent tool's `model` override (haiku/sonnet/opus per the plan's
guidance table) and effort conveyed in the prompt. That worked first-pass
for 10 of 11 tasks. If effort tiers ever need to be real (implementer-low
vs -high system prompts), install the zmh-producer scaffold agents; until
a task fails for effort-shaped reasons, the override approach is enough.
