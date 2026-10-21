# taasgoals - follow-up (oversee run, 2026-10-20 to 2026-10-21)

Plan: `.claude/plans/DONE/taasgoals.goals-arc.md`. Steps 1-6 ran as subagents in the worktree
branch `worktree-oversee+taasgoals` (each step's commit also pushed to `taas-goals`); step 7 and the
wrap-up were run by the overseer.

## Blocked - needs you

- Nothing blocked. What only you can do is the playtest (the plan's Playtest list) and the
  questions below.

## Decisions made on your behalf - review

- **Is $1 the default you want?** At a flat $1 the eval's lessons change (step 5, traced):
  - Every persona hires two robots 30 s in, with $2 in hand.
  - An operator left untold then drains the money: the goals persona had to rest it and press by
    hand on 5 of 12 seeds.
  - Five claims changed substance:
    - Hiring the operator first is no longer a trap.
    - The 5 s delay starves the line only if it is put in at hire.
    - "All medium" is now ahead.
    - Setting a stall before it can be stocked no longer locks the shop.
    - "Full house" is ahead, but behind "all medium".

  Each row now asserts the new behaviour. Open question 19 in `.claude/taas.md` asks you.
- **Tips left as they are.** Info's five Tips are unchanged, though step 5 found two of them no
  longer shown by the eval at $1:
  - Tip 3 ("give an agent the next best task").
  - Tip 5's line "set a stall only once someone can stock it".

  Recorded per Tip in `.claude/taas.md` section Tips (inferred: they would hold again at a
  higher robot price, set in the menu).
- **The eval's personas restated** to suit $1 (named in the eval's header and in the plan's step 5
  Results):
  - `paced` puts its delay in once planks pile up behind a full stall. The old rule is kept as
    `paced early`.
  - `stocker only` hires only once it can pay for its instruction slots.
  - A new `alone` never hires.
  - The new `goals` persona plays from a new game and presses by hand when the money runs out.
- **31 assumed rows** were added to `.claude/taas.md` (factory, 2026-10-20). The ones most worth a
  look:
  - Goal 3 is "Sell 25 sap" (a draft).
  - The board counts down ("Sell 38 medium planks", "for 9:41").
  - An old save counts as all goals met.
  - The dots are all green.
  - Every cleaned jam, the planer's sap jam included, puts the thing in the recycle bin.
  - The robot jobs list is in slot order (extractor, bench, saw).
  - When a machine arrives, anyone standing in its footprint steps out of the way.
  - Buying a stall opens Re-assign at once.
  - A closed stall's customers re-pick, or leave at no cost.
  - The saw jams on a rough plank.
  - Start over keeps the prices.
- **Steps 1 and 2 changed a little UI and some page-suite rows** to keep every gate green between
  steps, pulling small pieces of steps 3 and 4 forward (named in their Results).
- **One commit on `main`.** The arc landed as one commit whose tree is the branch's last, by
  fast-forward. That follows the plan and `CLAUDE.md` ("never author a merge commit on `main`")
  rather than the oversee command's `merge --no-ff`. The per-step history stays on `taas-goals`.
- **Profile.** The plan was drafted at an assumed `balanced`; this repo has no task-scoping skill.
  It ran as written: opus/high for steps 1-5 and sonnet/high for step 6. Step 7 was done by the
  overseer rather than a sonnet/medium subagent, because it is the integration and the push to
  `main`.

## Deferred / discovered follow-ups

- **Late-game satisfaction (hypothesis, not traced).** The goals persona ends its hour at 20%
  customer satisfaction on seed 12 and 39% on seed 8 (89-90% on others). It is recorded in
  `.claude/taas.md`'s Measured section as untraced. Worth a look alongside the Later item "Demand
  in the robot factory".
- **Test gaps** (small, mechanical):
  - No row asserts a jammed slot's dead buttons, the stuck thing drawn in it, or its smoke (step 4).
  - The second-stall eval row passes on seed 7 by only $5 (fragile).
- **Two engine breaks are equivalents** (`bubble-before-arrival`, `s2-no-slot-toss`), and one page
  break is (`no-remeasure`). They are explained in `.claude/taas.md` section Negative tests (factory).
- **Unchanged from the plan's Follow-ups:**
  - An instruction for things that are not logs on the planer and each slot (the CD: "later").
  - A dot for a wrong thing in a stall.
  - Goal 3 and anything after it.
  - Open question 12 (should a customer give up?), which interacts with closing.
