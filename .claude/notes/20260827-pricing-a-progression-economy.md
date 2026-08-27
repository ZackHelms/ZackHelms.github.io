# Pricing a progression economy against a player who gets richer

Written 2026-08-27, after the CD reported maxing Ember Depths' entire gear kit
**in about two delves**. The game-specific outcome is in `.claude/ember-depths.md`
§ The gear ladder; this note is the **method**, and it applies to any game here
with a persistent shop — `grid-defense` (cash/cores/skill points),
`turret-builder`, `star-surge`'s station, `adventure`.

The companion note is
`20260827-tuning-a-difficulty-curve-with-a-persona-eval.md`: same instrument,
different quantity. Read that one first — it covers the persona itself.

---

## 1. The failure is structural, not "the numbers are too low"

The instinct is to double the prices. That does not fix this, and knowing why
is the whole note.

In a roguelite the shop is paid for by runs, and **runs get better as the shop
gets bought**. So income is not a constant to price against — it is a function
of how much has already been bought. In Ember Depths:

- a delve's takings grow roughly with the **square** of the depth it reaches
  (more floors × richer floors), and
- depth grows roughly **linearly** in the number of upgrades owned.

So income after *n* purchases goes like `(a + b·n)²`, while a flat ladder of
four tiers goes like a constant. Measured across the campaign that is a factor
of ~40 in income against a factor of ~1 in price. Doubling every price shifts
the curve; it does not change that the two curves diverge, and the kit still
gets bought out — just two delves later.

**A ladder has to grow at roughly the rate income grows, or the pacing is only
correct at one point on it.**

## 2. Therefore: a geometric ladder, and the RATIO is the tuned quantity

Price rung *k* at `base · r^k`. Now cost grows exponentially in purchases while
income grows quadratically, so the ratio `r` is what decides whether they run
parallel:

- **`r` too high** → the early game buys three things a delve and the late
  game stalls for six delves saving for one rung.
- **`r` too low** → back to the original bug.
- The target is the `r` where `r^(rungs)` ≈ the income ratio across the whole
  campaign. Ember Depths: income ×~40 over 24 purchases, six rungs a track,
  so `r ≈ 40^(1/6) ≈ 1.85`. Shipped ×1.9, and the measurement agreed.

That back-of-envelope is worth doing **before** the sweep, because it tells you
which decade to sweep in. It is not worth trusting instead of the sweep — the
income exponent is itself a guess about how much depth an upgrade buys.

## 3. Measure PURCHASES PER DELVE, not gold per delve

The CD's spec was "on average one new piece of gear after each run". That is
directly measurable and it is the only number that means anything, because it
already folds in income, prices and how deep the player gets. Gold per delve
does not: it looks alarming or fine depending on prices you have not set yet.

So the eval needed a **campaign mode**: one character, N delves back to back,
banking gold and **shopping between them through the game's own camp actions**
(`campAction('buy-gear', …)`), then the delve, then shop again. Print a row per
delve — depth, purchases, cumulative tiers, gold left — because the average
alone hides the shape.

Two secondary numbers are worth printing beside it, and both caught something:

- **dry delves** (bought nothing) and **3+ delves** (a splurge). A campaign
  that buys nothing for six delves and then everything at once averages 1.0 and
  feels nothing like it.
- **gold left over at the end.** A campaign that ends with 30k unspent has
  finished the ladder, whatever its average says.

## 4. Shop through the game's own action dispatcher

The campaign persona buys through `campAction`, the same switch the buttons
call — so anything it could not afford in the UI it cannot afford here, and the
`skillOpen()` prerequisite rule is the game's, not a copy. This is the same
fidelity argument as the persona playing through `playerAct`, and it is the
reason the eval can be trusted to price a ladder it cannot see.

It also means the shopping **policy** is a persona trait like any other, and a
real differentiator between skill bands: cheapest-first (novice) versus a
priority order that saves for the rung it actually wants (veteran).

## 5. Sweep from outside the game, and make that a supported flag

`eval-ember-depths.cjs --override '<json>'` merges candidate constants into
`CURVE` and rewrites `GEAR` rung costs before playing, so a sweep is a shell
loop rather than a fresh scratchpad harness. It was a scratchpad harness twice
in one session, which is the signal to promote it.

Three things the flag has to do, all learned by having them go wrong:

- **Merge `CURVE` one level deep.** A plain `Object.assign` replaces a nested
  object wholesale, so an override of `{base:{slime:{…}}}` silently deletes
  every other enemy. (Recorded in the companion note as a lost candidate.)
- **Validate the shape and throw.** A ladder with the wrong number of rungs
  must fail loudly, not quietly leave the top tiers at their old price and
  report a beautiful, meaningless number.
- **Skip the assertions when an override is set.** The bands are calibrated to
  the shipping constants; running them against a candidate reports the sweep as
  a regression.

Print the applied candidate above the table. A table of numbers with no
candidate beside it is the fastest way to tune against the wrong thing.

## 6. What the sweep actually said

15 combinations of `M` (a multiplier on the base rung) × `r`, 14 delves each,
two personas. The shape was clean and monotonic, which is itself reassuring:

| | `r`=1.8 | `r`=2.0 | `r`=2.2 |
| --- | --- | --- | --- |
| `M`=1 | 1.71 (kit maxed) | 1.71 (maxed) | 1.71 (maxed) |
| `M`=3 | 1.29 | 1.14 | 1.00 |
| `M`=6 | 0.93 | 0.86 | 0.79 |

Anything at `M`=1 maxed the kit inside the campaign regardless of ratio — that
is the original bug, and it is *not* fixed by ratio alone. The shipped ladder
is a hand-authored version of `M`≈6 / `r`≈1.9 with a **deliberately cheap first
rung** (70 rather than 240), so a brand-new character can buy something after
its first delve. Measured over 25 delves: **0.96 purchases per delve for all
three personas**, novice maxing on delve 25, veteran near 18.

## 7. Assert the pacing as a band, and assert both failure modes

The gate is not "0.96". It is:

- each persona's purchases-per-delve **within 0.55–1.9** (wide, because the
  personas reach very different depths and a narrow band would chase noise),
- **nobody maxes the kit** inside a short campaign — the original bug, and
- **a good player does climb** — at least 8 of 24 tiers for the veteran, which
  is the opposite bug, a ladder so steep the campaign never leaves rung one.

One-sided assertions are how a re-tune walks off the other end of the range.

## 8. Fixing an economy re-prices everything that touches it

Two knock-ons neither of which was the ask:

- **Consumables became pocket change** beside a 3600◈ axe, so they were
  re-priced with the ladder. A sink that no longer costs anything is no longer
  a decision.
- **Every test that restated a price went red** — five of them. The fix is a
  rule now (`.claude/tests/README.md`): a check reads the constant it depends
  on out of the game's own table rather than repeating the number. The check
  that says "buying debits exactly the price" should survive a re-tune; if it
  does not, it was asserting the price, not the debit.

## 9. The eval finds design bugs the brief never mentioned

Worth expecting, not just tolerating. Every persona given the "start at your
deepest floor" option **stalled dead**: the payout counts floors below where
you *started*, so opening at your best means dying on arrival for nothing while
also skipping every shallow floor's loot. Frozen at 7–8 gear tiers with nine
consecutive delves of nothing to buy, against 20 tiers for the same persona
starting from floor 1.

Nobody would have found that by reading the code — the feature works exactly as
specified. It took a campaign that played the option end to end. That is the
argument for campaign mode existing at all, beyond the number it was built for.
