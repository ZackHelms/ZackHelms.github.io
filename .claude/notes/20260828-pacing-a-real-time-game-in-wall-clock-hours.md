# Pacing a real-time game in wall-clock hours, and the estimator that comes free

Written after the Fire Clicker persona-eval build (2026-08-28,
`.claude/tests/eval-fire-clicker.cjs`). The two ember-depths notes —
`20260827-tuning-a-difficulty-curve-with-a-persona-eval.md` and
`20260827-pricing-a-progression-economy.md` — already cover the persona
discipline itself (play the real game through the real entry points, seed it,
sweep from outside, assert bands, say out loud that the persona is worse than a
person). All of that still applies and is not repeated here.

**What is different here is the clock.** Ember Depths is turn-based: a run is a
number of turns, and "how long is that" is unanswerable. Fire Clicker runs in
*real time* — `DAY_LEN` is 300 s of wall clock — so every measurement converts:

> **1 in-game day = 5 real minutes. 12 days = 1 hour of play.**

That single conversion is what turns a balance table into a schedule the CD can
act on. "FOUND VILLAGE at day 4.1" is a number; "twenty minutes in" is a design
decision. Report both, always, and put the conversion in the eval's header so
nobody has to re-derive it.

---

## 1. Drop the painters and you get four orders of magnitude

The game's `frame()` interleaves simulation and drawing. The harness stops the
render loop dead and drives the simulation itself:

```js
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
// ... then, per step, inside one page.evaluate that runs the WHOLE run:
dayStep(dt); fireStep(dt); syncVillagers();
for (const v of villagers) villagerStep(v, dt);
floats.length = 0; chips.length = 0; motes.length = 0; sparks.length = 0;
```

Measured: **~18,000x realtime, ~60 game-days per wall-second.** A year of
hour-a-day play simulates in about 75 seconds. Three things make that work:

- **The whole run lives in one `page.evaluate`.** Per-step round trips to Node
  would dominate everything; the run returns once, with its milestones.
- **Truncate the particle arrays every step.** They are normally drained by the
  painters you just removed, so without this they grow without bound and the
  run dies on memory rather than on the economy.
- **`dt` is a parameter and step-size independence is checkable.** 1/30 s is the
  default; the analytic model runs at 2 s and gives identical milestone days at
  1 s and 5 s. If a result moves when `dt` moves, it is a step artefact, not a
  finding.

### The practical ceiling is the GAME, not the harness

Budget ~1 wall-second per 60 game-days per persona-seed. Ten wall-minutes buys
~36,000 game-days — eight years of hour-a-day play. Nothing in the harness
degrades over that range (the villager count is capped by the population cap, so
per-step cost is bounded). What runs out first is the game: Fire Clicker's last
meaningful purchase lands around day 15, and the `1.75^n` recruit curve walls out
near day 150. **Simulating past a few hundred days measures the shape of a wall.**
Say that in the report — "how long can you playtest" is usually the wrong
question, and "how long is there anything left to measure" is the right one.

---

## 2. Build the analytic estimator too, and print its error every run

The eval carries a second half: a closed-form throughput model that runs the
same policies in Node with **no browser at all**.

```
rate  = uptime x popCap() x tripYield() / cycle
cycle = (idle wait + 2 x meanDist / speed + work) / heatBoost
```

400 days for two personas in ~330 ms — ~2,400 game-days per wall-second, ~40x
the browser sim. That is the thing to reach for when sweeping a balance
constant: "what does doubling the FOUND VILLAGE cost do to time-to-village" is
answerable in a third of a second instead of a minute.

**The discipline that makes it trustworthy is printing it beside the sim on
every run — by default, not behind a flag.** Every run prints a MODEL vs SIM
table plus a mean absolute error, and two assertions fail the suite if MAE
exceeds 10%. It was briefly opt-in (`--model`); that was wrong, because the one
place it mattered most — the automated gate — was the one place nobody would
pass the flag. `--no-model` is the escape hatch instead. An estimator nobody
checks becomes fiction within two commits. Currently 4.6% / 1.9% MAE.

Also print the **measured cycle against the modelled cycle** every run. That one
line is the model's own smoke test, and see §4 for the time it earned its keep.

### Two calibration surprises worth stealing

Both cost real debugging time and neither is visible in the code:

1. **Income does not split evenly across resource pools.** `villagerStep` picks
   the scarcest resource with p=0.7 and otherwise picks uniformly, so **the
   scarcest pool takes 80% of all trips** and the other two 10% each. A model
   that divided income three ways ran **~30% pessimistic** and the error
   compounded daily. That self-routing is also why the camp recovers so fast
   from a lopsided purchase — a real design property, discovered by the model
   being wrong.
2. **A consumer's cost tracks what it is consuming, not how many consumers
   there are.** The firekeeper burns one wood per 4 s of banked fire; three
   firekeepers share one bank and take turns, so the wood cost is
   `drainRate/4` regardless of count. Charging per keeper made the casual
   persona's model ~12% pessimistic.

The shape of both: **a model of an agent system gets the per-agent maths right
and the aggregation wrong.** Check the aggregation first.

---

## 3. Personas converging is a design diagnostic, not a null result

The first baseline had optimal play beating naive play by **1.26x at POP 15 and
1.06x at POP 20** — the two personas arriving within 6% of each other after
thirteen hours of simulated play. That is not "balanced". That is the shape of a
game where nothing the player does matters, and it is invisible from inside a
single playthrough. **Two personas measured against each other are a better
instrument than either alone.**

The fix pattern, which generalises: give the skilled player a bonus **the
automation structurally cannot earn**. Fire Clicker's ROARING FIRE pays a
camp-wide speed bonus while the fuel bank is above 75%; the auto-stoker only
tops up below 35%, so *an auto-tended fire can never cross the threshold*. It is
not a rule that says "no bonus for idlers" — it falls out of two numbers that
cannot both be satisfied. Measured result: speedrun roaring 100% of the run,
casual 0.4%; the gap now holds above 2.1x to the end of the content.

**Then assert the gap.** `skill pays at POP 15 (2.29x)` and `only the
hand-tended fire ROARS (100% vs 0%)` are now checks. A balance property nobody
asserts regresses silently — that is the whole reason the 1.06x was news.

---

## 4. A model that disagrees with the sim is a bug report

The casual persona's measured gather cycle came out **32% longer** than the
model predicted, while the speedrunner's matched to 3%. The instinct is to fit
the model. The cause was a shipped bug:

`syncVillagers()` re-flags `v.keeper = i >= popCap()`. Buying RECRUIT VILLAGER
raises `popCap`, which demotes the villager sitting at the old boundary from
keeper to worker — and left it standing in `keeperWait`, a state nothing in the
machine ever moves it out of. **Every recruit bought after a firekeeper
permanently retired one villager.** 8 of 13 idle by day 30.

Nothing on screen showed it. The villagers stood around the fire, which is
exactly where a keeper belongs. No rule test caught it, because no rule was
broken. The *only* signal was an aggregate that did not match arithmetic.

Generalised, and now a shared-conventions rule in `games/CLAUDE.md`:

> **When an entity's role flag can change at runtime, the state machine must
> release it from any role-exclusive state.** A demoted agent parked in a state
> only its old role can exit is stranded silently and forever.

And the eval now asserts `stranded === 0` directly.

---

## 5. A persona's recovery must restore a WORKING state

The casual persona hands the fire to the auto-stoker and stops tapping. Because
a real person notices a dead fire, it re-lights after 20 s of cold — and the
first version tapped **once** and went hands-off again. One second of fire per
twenty-one is not enough for a villager to finish a twelve-second trip, so the
camp livelocked and the eval reported a hard stall at day 6.

That "finding" was entirely the persona's bug. The fix is to tap back up to 80%
of the bank before releasing. The rule, now in `.claude/tests/README.md`:

> A persona's recovery behaviour must restore a *working* state, not merely take
> the action a person would take first. A recovery that half-works measures the
> persona, and it looks exactly like a game-balance finding.

Keep the literal version available anyway — `--casual-strict` removes the
noticing entirely and measures the true never-taps-again case, which is where a
genuine soft-lock would show up.

---

## 6. Extract the purchase path before writing the eval

The upgrade transaction lived inside the upgrade card's `click` handler. The
eval needs it, and re-implementing it would have meant the eval slowly measuring
a different economy than the game. Pulling `buyUpg(id)` out — cost deduction,
level increment, side effects, save — took five minutes and left the card
handler as `if (!buyUpg(u.id)) return; audioInit(); sfxBuy(); buildUpgPanel();`.
Sound and the panel rebuild stay with the card, because they belong to the
*gesture*, not to the transaction.

This is the same rule as ember-depths' "shop through the game's own action
dispatcher", arrived at from the other direction: if there is no dispatcher yet,
**make one before writing the eval, not a copy of one inside it.**

---

## 7. The persona's SHOPPING LIST is a verdict on the upgrade table

The milestone table is what you build the eval for. The other output — which
cards the value-driven persona bought, and which it never touched in 200 days —
turned out to be worth as much, and it costs nothing extra to print.

Fire Clicker shipped with three fire-tending upgrades (a bigger bank, a stronger
tap, a slower drain) that the optimal persona **never bought at all**. Not
"bought late": `—` in the milestone column at day 200. A card no rational player
takes is dead weight in the panel, and no amount of playing the game yourself
tells you that as flatly as an empty cell does.

It also tells you *why*, if you read the model. All three reduce **taps needed
per second**, and tapping was never scarce: the bank drains 1 s per second and a
tap banks 1 s, so a brimming fire costs one tap per second against a hand that
can manage eight. Cutting a budget that is not binding buys nothing.

Which is what made the fix findable. Ramping the roar bonus with heat — half the
bonus at the 75% line, all of it at a brimming bank — does not touch the tap
budget at all. It changes what the *shape* of the bank is worth: a hand-tapped
fire sawtooths between `maxBank() - tapPower()` and `maxBank()`, so a deeper pit
is a shallower sawtooth in fractional terms and holds a higher mean bonus
between taps. FIRE PIT went from never bought to the first purchase in the game,
maxed. The other two stayed unbought, correctly — the ramp does not make a
cheaper refill valuable, and pretending otherwise would have been the easy
mistake.

Two habits fall out:

- **Print the final levels dict and the never-bought cells.** `{pit:8, tinder:0,
  wind:0, ...}` is a design review in one line.
- **Run the counterfactual before claiming a fix.** `git stash` + the analytic
  model is a few hundred milliseconds and turns "this should help FIRE PIT" into
  "FIRE PIT moved from never to first". Same discipline as printing the model's
  error: a balance claim nobody measured is a balance claim nobody should trust.
