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

## 4. Count truncated runs, and print them

Any persona can still get stuck, and a run that ends on a guard is not a run.
Give `evalRun` a turn guard, a per-floor guard and a depth cap, return **why**
it ended, and print a `cut` column. Ember Depths' MAXED rows still truncate
about 40% of the time; that biases those averages *downward*, which is stated
rather than hidden. Silent truncation reads as "the curve did that", and it is
the single easiest way to publish a confidently wrong balance number.

## 5. Seed it, or you are comparing luck

Procedural floors need a seed hook — Ember Depths has `seedSalt`, which
replaces `Date.now()` in the generator's seed when non-zero. Without it, two
sweeps of the same candidate differ by more than the candidates differ from
each other. Even seeded, expect ±0.5 depth of run-to-run noise from combat
rolls; set assertion bands around measured values with that much room, near
the observed floor rather than at the vacuous end.

## 6. Sweep candidates from outside the game, then lock ONE set

A scratchpad harness that loads the page once, applies
`Object.assign(CURVE, candidate)` per candidate and plays N runs per build
answers in minutes what reasoning cannot answer at all. Six candidates × three
builds × 14 runs is a couple of minutes.

**Gotcha that cost a candidate:** `Object.assign(CURVE, over)` **replaces** a
nested object wholesale. An override of `{base: {slime: {...}}}` wipes every
other enemy's stats, and merging into `CURVE.base` afterwards merges into the
already-truncated copy. Merge nested keys explicitly, or keep the sweepable
constants flat.

## 7. Say out loud that the persona is worse than a person

A scripted persona does not bait a corridor, count an archer's line, or decide
a floor is a loss and run for the stairs. Its average is a **floor** on what
the CD will see, not a prediction. Ember Depths' fresh persona averages 6.9
against a brief of 8, and that is recorded as agreement, not as a miss — with
the reasoning in the eval's own header, so the next session does not "fix" it.

---

## What the eval is for afterwards

Not a gate. It is the thing you re-run when a constant changes, and the reason
`CURVE` carries the comment *"tuned against the eval, never guessed"*. Keep it
out of `gates.sh` (which runs `drive-<slug>.cjs` only) — a two-minute balance
sweep does not belong in the loop you run on every edit.
