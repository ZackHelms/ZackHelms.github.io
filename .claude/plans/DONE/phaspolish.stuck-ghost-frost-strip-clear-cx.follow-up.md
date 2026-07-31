# phaspolish — follow-up (run of 2026-07-31)

## Blocked — needs you

- (none)

## Decisions made on your behalf — review

- Preflight correction: the plan said "all 16 legacy LEVELS defs (currently
  cold:1 or 2)" — only 14 were nonzero (First Facets / Shape Gates were
  already cold:0). Implemented against the corrected count.
- Task 2's haiku implementer committed to the PRIMARY checkout's local
  `main` instead of the run worktree (nothing had been pushed). Repaired by
  cherry-picking onto the run branch (`3f5c763`) and resetting local `main`
  to `b6b8e50`; re-validated in the worktree (223/0 at that point).
- STUCK rescue animation: gems flagged `flyHome` are immune to hole/bush
  kills while flying home (otherwise the L41 fallback dies crossing the
  void mid-rescue). Player-controlled gems are unaffected — the guard only
  exists inside the STUCK fly-home path.
- Fallback speed: the staggered fly-home runs at real time (`FLY_SUBS=2`),
  not the ghost's 4x — at 4x the 0.3s stagger read as the teleport the CD
  asked to remove.

## Deferred / discovered follow-ups

- Tier-routing note (no metrics ledger in this repo): haiku task-2 content
  was right first pass but landed in the wrong checkout — subagents do NOT
  reliably inherit the run worktree for git. From task 3 on, every spawn
  prompt carries absolute worktree paths + `git -C <worktree>` for all git
  commands; candidate improvement for the shared oversee command's spawn
  template (zmhstudio), to be raised at the burndown-end refine pass.
