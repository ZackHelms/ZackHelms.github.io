# csparry - follow-up (oversee run 2026-11-03 to 2026-11-04)

## Blocked - needs you

- **Blade at contact (CD decision, not a code blocker).** Step 1 measured the gap from the
  opponent's blade to the player's body surface on the tick damage lands. Three of ten are over
  0.25 m: yoko at rank 1 (0.255), shomen at rank 1 (0.290) and rank 10 (0.327, the tip still
  overhead). Contact was not moved, per the plan's decision default: moving it shifts every timing
  the ladder was measured on. Your call whether contact should land later in the sweep. Numbers:
  the plan's Step 1 Results; `.claude/combat-simulator.md` section CS-3 as built.
  *Decided 2026-11-04 (backlog refinement): land on the blade. Now CS-5 in `TODO.md` § Next.*

## Decisions made on your behalf - review

- **Branch.** The plan named `cs-parry` for the per-step commits; the run pushed them to this
  session's own branch `claude/combat-simulator-arcade-2uzwxr` instead (the harness pins pushes to
  it). Same commits, same role as the off-box copy.
- **Landing.** The overseer landed both halves with `land-on-main.sh` (CS-3 after step 2, CS-4
  after step 5), then merged `origin/main` back into the branch so the second landing was a
  fast-forward.
- **Step 1 choices** (plan Results): `ATTACKS.power.idx` is -1; the stagger clear is in without a
  break of its own (a 1.5 s stagger outlasts the 0.22 s buffer, so it cannot show in play); row 3
  raises `RULES.buffer` to 0.6 s for half its check, because with today's equal 0.22 s buffer and
  flinch the clear is otherwise unobservable; row 4 presses up to 0.18 s, not 0.21, to stay off
  the one-tick boundary; row 5 throws the power row via the power input. `parry-window-wide` is
  caught only by row 7 (row 5 measures each row against its own window by design).
- **Step 3 choices:** kind rows built by a loop over `RULES.kinds` (a new kind is one entry); the
  AI's kind roll is `aiStrike(F)`, one `F.krng` draw per cut; the counter persona keeps 0.13 s for
  power attacks (it dodges those). No ladder tuning was needed: the line stayed
  `masher 1, 0; counter 1, 1`.
- **Step 4 choices:** the tells (quick 0.06 s, 1500 -> 800 Hz; heavy 0.22 s, 500 -> 200 Hz), the
  icon strokes and the help wording were picked; rows 1 and 2 each cover both new buttons / keys
  in one row, to keep the plan's +3.
- **Ladder change you will feel:** counter at rank 10 went 0.875 -> 1, because the opponent can no
  longer parry your stagger punish straight out of a flinch.
- **Profile:** the plan was drafted at `balanced`; the run used `balanced` (this repo has no
  task-scoping skill). No mismatch.

## Deferred / discovered follow-ups

- **Opponent kind shares sit below `quickP` at rank 10** (measured 0.104 quick vs `quickP` 0.30):
  about half its swings at rank 10 are the stagger punish, which stays normal. Fine as built;
  playtest whether rank 10 should jab more. *Decided 2026-11-04 (backlog refinement), after the
  CD's playtest passed CS-3 and CS-4: leave it as built.*
- More strike kinds: one `RULES.kinds` entry plus a button, key and icon each, but the six-button
  cluster has no room for a seventh at 360x640 without a new layout.
