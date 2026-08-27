# Tuning a difficulty curve with a persona eval

Written 2026-08-27, rebuilding Ember Depths' difficulty after the meta layer
made it trivial to snowball. The game-specific outcome is in
`.claude/ember-depths.md`; this note is the **method**, which applies to any
game here whose difficulty the CD states as a felt outcome rather than a number.

The brief was "a new character should reach about depth 8 on average". That is
not a constant you can write down — it is the output of enemy count × an HP
curve × the player's own kit × how well the player plays. The only way to set
it is to measure it.

---

## 1. Put every difficulty number in ONE object first

Before tuning anything, collect the constants into a single object (`CURVE` in
Ember Depths) — including the ones that feel structural: the player's starting
HP and attack, the per-enemy base stats, how many hearts a floor drops. A
sweep can then override the whole set from outside with
`Object.assign(CURVE, candidate)`, and there is exactly one place a future
session has to look.

This is worth doing *even if you think you know which knob matters*. On this
pass the answer turned out to be the player's base HP and the enemy count, not
the HP multiplier that looked like the obvious dial.

## 2. Make the curve unbounded, and split linear from quadratic

For a "no ceiling" game (the run can in principle go forever), the scaling has
to be a formula, not a table:

```
stat = base * (1 + k*mul + k*k*quad)      // k = depth - 1
```

The split does real work. The **linear** term decides how fast the early floors
tighten; the **quadratic** term is what eventually beats any build. Tuning them
together is what lets "gentle at depth 3" and "lethal at depth 30" coexist —
with a single linear term you can only slide the whole difficulty up and down.

## 3. The persona must play the real game, through the real entry points

The eval calls `playerAct` / `useConsumable` / `takeRelic`. It simulates
nothing. A parallel model of combat would be the thing under test.

**And the persona must move the way the UI moves.** The first version picked a
goal and re-derived its next step every turn from a fresh BFS. That BFS routes
around enemies, so a single foe shuffling in a corridor flipped the gradient
and the delver paced between two tiles for 6000 turns. The eval dutifully
reported *"a maxed build averages depth 3.5"* — a number that measured the
deadlock, not the game, and that looked exactly like a difficulty finding.

The fix is to do what a tap does: build **one** path to the goal and follow it
until something interrupts. That is not just a bug fix, it is a fidelity
argument — the persona should be limited by the same things the player is.

### 3a. …and it must STICK TO THE ERRAND, which is a second, separate bug

One path per goal is not enough. Re-picking the *goal* every time a path runs
out livelocks just as thoroughly, and it took a second pass (2026-08-27) to
find: two unexplored corners at equal distance are two attractors, so the
delver walks to one, reveals a cell, discovers the other is now nearer, walks
back, and repeats. **200 consecutive moves, no enemies on the board, zero
progress**, until the per-floor guard cut the run.

The fix is one condition: the previous goal wins while it is still on the
candidate list and has not gone stale. A picked-up pile or a corner that has
now been seen drops off the list by itself, which is what ends the errand
honestly. That means `evalGoal` returning one answer has to become `evalGoals`
returning a ranked **list** — you cannot keep a goal you never re-computed.

**This single fix took truncation from 21 runs in 108 to 3, and put all three
personas in the correct order.** Everything else on this page was measured
after it; several "difficulty findings" before it were this bug.

## 3b. If you add personas, the ORDERING is the eval's own control

Three skill bands (novice / steady / veteran) are worth far more than one,
because "does skill buy depth?" becomes a check the eval can fail. If the
veteran stops outliving the novice, either the tactics have stopped working or
the persona has stopped playing them — and you find out in the same run that
measures the curve, rather than shipping a tactic the game no longer rewards.

Ember Depths: fresh 5.9 / 7.2 / 7.5 · kitted 14.5 / 16.5 / 17.7 · maxed
34.7 / 35.0 / 44.6. Monotonic at every tier is the property; the gap widening
with the build is a bonus, not the assertion.

**Every difference between bands must be a DECISION, never a stat.** Whether
you look where you are walking, whether you pick your ground, whether you buy
on purpose. The moment a "skilled" persona is just given more HP, the eval is
measuring the kit twice.

## 3c. Three ways a *tactical* persona measures itself instead of the game

All three cost real time on 2026-08-27, all three made the high-skill persona
the **worst** of the three, and all three look like difficulty findings:

- **Chasing is not clearing.** "Clear the enemies before crossing a trap"
  implemented as *hunt the pack across the floor* killed a fully maxed build on
  depth 7, having spent 352 turns not descending. Every extra turn near an
  enemy is an extra enemy turn — that is the whole economy of a turn-based
  game. Waiting one step from the thing that is coming anyway costs nothing;
  going to find it costs the floor. Model "wait for the board to clear" as
  *deferring*, and bound the defer, because something that will not close never
  arrives and never leaves.
- **A corner beats a crowd, not a bow.** The chokepoint tactic (back into a
  corridor so only one thing can reach you) is real and the CD uses it — but
  applied to *archers* it put the delver in a shooting gallery, pacing between
  two cells for a hundred turns while two of them shot it down a straight
  column. Ranged attackers never have to walk into the corner. Charge them.
- **Commit to the ground you picked.** Re-choosing the best cell every turn
  makes a retreat into a shuffle: the pack keeps moving, so the "best" cell
  keeps changing and you never arrive. Store the choice, walk to it, and put a
  **per-floor budget** on the whole tactic so a standoff cannot eat the floor.

The common shape: a tactic that is *good advice for a person* becomes a
pathology when a script applies it every turn without the judgement about
*when*. Budget it, bound it, and give it a cooldown after it fails.

## 4. Count truncated runs, and print them

Any persona can still get stuck, and a run that ends on a guard is not a run.
Give `evalRun` a turn guard, a per-floor guard and a depth cap, return **why**
it ended, and print a `cut` column. Silent truncation reads as "the curve did
that", and it is the single easiest way to publish a confidently wrong balance
number.

**And separate the reasons.** One `stuck` label covering both "900 turns on one
floor" and "120 failed moves in a row" hid which bug was which for an entire
debugging pass. Splitting them into `slow` and `stuck` pointed straight at the
attractor livelock in §3a: `slow`, with the tally showing 200 *moves* and no
waits, which is a very different animal from a delver pinned in a corner.

Treat a high truncation rate as a **bug in the persona until proven otherwise**.
Ember Depths' MAXED rows truncated ~40% of the time for two days and that was
recorded as an honest downward bias; it was in fact the livelock, and fixing it
took the whole cohort to 3 in 108. The honest disclosure was true and it was
also covering for a defect.

## 5. Seed it, or you are comparing luck

Procedural floors need a seed hook — Ember Depths has `seedSalt`, which
replaces `Date.now()` in the generator's seed when non-zero. Without it, two
sweeps of the same candidate differ by more than the candidates differ from
each other. Even seeded, expect ±0.5 depth of run-to-run noise from combat
rolls; set assertion bands around measured values with that much room, near
the observed floor rather than at the vacuous end.

## 6. Sweep candidates from outside the game, then lock ONE set

A harness that loads the page once, applies a candidate and plays N runs per
build answers in minutes what reasoning cannot answer at all. Six candidates ×
three builds × 14 runs is a couple of minutes.

**Promote it to a flag the second time you write it.** As of 2026-08-27 this is
`--override '<json>'` on the eval itself (`{"curve":{…},"gear":{…}}`), which
merges candidates in, validates their shape, prints what it applied, and skips
the assertions — the bands are calibrated to the shipping constants, so running
them against a candidate reports the sweep as a regression. Sweeping an
**economy** rather than a difficulty curve is its own method:
`20260827-pricing-a-progression-economy.md`.

**Gotcha that cost a candidate:** `Object.assign(CURVE, over)` **replaces** a
nested object wholesale. An override of `{base: {slime: {...}}}` wipes every
other enemy's stats, and merging into `CURVE.base` afterwards merges into the
already-truncated copy. Merge nested keys explicitly, or keep the sweepable
constants flat.

## 7. Say out loud that the persona is worse than a person

A scripted persona does not bait a corridor, count an archer's line, or decide
a floor is a loss and run for the stairs. Its average is a **floor** on what
the CD will see, not a prediction. Ember Depths' fresh persona averages ~7
against a brief of 8, and that is recorded as agreement, not as a miss — with
the reasoning in the eval's own header, so the next session does not "fix" it.

**But do not let that disclaimer absorb a defect.** "The persona plays worse
than a person" is true and it is also the perfect cover story for a livelock —
see §4. The disclaimer is for the gap between a *correct* script and a person;
it is not a reason to accept a number that surprises you.

---

## What the eval is for afterwards

Not a gate. It is the thing you re-run when a constant changes, and the reason
`CURVE` carries the comment *"tuned against the eval, never guessed"*. Keep it
out of `gates.sh` (which runs `drive-<slug>.cjs` only) — a two-minute balance
sweep does not belong in the loop you run on every edit.
