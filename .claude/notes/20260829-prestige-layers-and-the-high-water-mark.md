# Prestige layers, and the high-water-mark bonus

Written 2026-08-29, adding EVOLUTION to Fire Clicker. The game-specific
implementation is in `.claude/fire-clicker.md`; this note is the **method** and
the **research**, which apply to any idle/incremental game here that eventually
runs out of content — croissant-clicker and basketball-clicker both already have
reset layers, and this is the shape to reach for next time.

The CD's brief: *"in order to progress you have to do an evolution restart that
gives you some overall bonus but you have to restart at the beginning… if you
progress to the same point in two different playthroughs the first restart gets
you the bonus but the second doesn't add anything. The bonus should increase
maybe not linear but maybe polynomial or exponential… Egg Inc. is a game that
does this well if you can find research on how they do their math."*

---

## 1. What Egg Inc actually does (and it is the opposite of the guess)

Worth writing down, because the intuition is wrong and the research is two
searches away only if you know what you are looking for.

- Soul eggs earned on a prestige ≈ `floor((farm value / 1e6) ^ 0.21)`.
- Each soul egg is a flat **+10%** earnings bonus.

So the reward curve is **strongly sub-linear** in the run's value — exponent
0.21 — and the bonus is merely **linear** in the currency. Neither half is
polynomial-in-progress or exponential, which is what everyone assumes when they
say "Egg Inc feels exponential".

It *feels* exponential because farm value itself grows exponentially with
progress. The shape to copy is therefore:

> **A sub-linear exponent applied to an exponentially-growing quantity.**

That composition is what gives a curve that is unbounded, never runaway, and
tunable with a single number. Get this backwards — a super-linear exponent on a
quantity that already compounds — and run three trivialises the entire game.

Fire Clicker's version, with the stages costing ×11 each:

```js
const EMBER_BASE = 1200;   // reach that earns the first ember
const EMBER_EXP  = 0.55;
embersFor(reach) = floor((reach / EMBER_BASE) ^ EMBER_EXP)
emberMul()       = 1 + 0.10 * embers
```

0.55 rather than 0.21 because the underlying quantity (resources hauled) grows a
good deal more slowly than an Egg Inc farm value does. **The exponent is a
function of how fast the base quantity compounds** — copying 0.21 onto a
gentler economy gives a prestige layer nobody can feel. Every 10× of reach is
~3.5× the embers, and a stage rung is ~×11, so a rung is worth roughly a
doubling of the bonus.

## 2. The reach metric must be CONTINUOUS

The obvious metric for "how far did you get" is the stage reached. Do not use
it. It has five possible values, so a run that missed the next rung by ten
minutes banks **exactly the same as one that stopped an hour earlier** — the
worst feeling a prestige layer can produce, and the one that makes players stop
evolving.

Use a continuous proxy for the run's depth. Fire Clicker uses `S.gathered`,
total resources hauled this run — the direct analogue of Egg Inc's farm value.
Every extra ten minutes registers. Peak population would also work; it is
coarser (integer steps) but more legible on a HUD.

Count it where the resources actually land, not where they are spent:

```js
const haul = ...;
S.res[v.carry] += haul;
S.gathered += haul;          // reach: what this run has hauled, ever
```

## 3. The high-water mark is a FUNCTION, not an accumulation

This is the CD's rule — *a second run to the same depth banks nothing* — and the
implementation that follows from it is much simpler than the one you would write
if you started from "accumulate a currency".

Do **not** keep a running total and try to add the right delta on each evolve.
Instead store one number, the best reach ever, and make the currency a pure
function of it:

```js
S.bestReach                              // the only thing that persists
embers   = embersFor(S.bestReach)        // derived, never stored authoritatively
gainNow  = embersFor(max(bestReach, gathered)) - embers
```

Three things fall out for free:

- **A shallower run banks 0.** No special case, no comparison, no bug.
- **The count and the mark cannot drift apart**, because there is only one of
  them. An accumulated total can disagree with the reach that earned it through
  a partial write, an edited save, or a tuning change.
- **Retuning the curve silently re-prices every past run correctly.** Change
  `EMBER_EXP` and everyone's bonus moves to what it should have been, rather
  than stranding players on a total nobody can reproduce.

Corollary for the save path: **recompute the currency from the mark on load**,
never trust the saved count.

```js
S.bestReach = Math.max(0, +d.bestReach || 0);
S.embers = embersFor(S.bestReach);   // NOT +d.embers
```

## 4. Multiply YIELD, not speed

The natural place to hang the bonus in a sim with visible agents is the speed
lever the game already has — Fire Clicker's roar bonus scales the whole gather
cycle. It is the wrong place. At +900% (which is only ~deep run four) the
villagers become streaking dots and the scene stops reading as a village.

Yield takes the same multiplier, is invisible to the animation, and is a lever
the pacing eval already models. Speed bonuses want a ceiling; yield bonuses do
not.

## 5. Name exactly what crosses the reset, and rebuild everything else

```js
const carry = { bestReach, embers, evolutions, muted };
S = Object.assign(freshState(), carry);
```

Four things, listed in one place. Anything else surviving makes the next run not
a fresh start, which is the entire cost the bonus is paid for — and prestige
layers rot by accretion, one "surely we can keep the…" at a time.

The scene must be **rebuilt from nothing, not adjusted**. Agents hold references
into world state — Fire Clicker's villagers hold a `home` reference into `HOMES`
and a numbered seat index — and a stale reference is how an agent ends up
walking to a building that no longer exists:

```js
villagers.length = 0; HOMES.length = 0;
for (const k of Object.keys(BIZ)) delete BIZ[k];
seatTaken.fill(false);
resize(); syncVillagers();
```

## 6. Make the reset a BANNER, not a card

It is the only irreversible action in the game. A row that looks like every
other row in the upgrade list is a row someone taps by reflex on the way to the
card below it. Fire Clicker's evolve control is a separate gold-ruled panel
above the list, states what the run would bank *before* asking, and takes two
taps (`EVOLVE…` → `START OVER — KEEP ✦ 13` / `CANCEL`).

Say the shortfall out loud too. When the run has not beaten the mark, the banner
says so — *"evolving now would bank nothing; push past ✦ 90.0k hauled to earn
the next ember"* — which turns the high-water rule from a hidden mechanic into a
visible goal.

## 7. Assert BOTH failure modes

A prestige layer has two ways to be wrong and they pull in opposite directions,
so one assertion cannot cover it. Price it off the analytic model — running a
ladder of whole playthroughs is only affordable there:

```
PASS evolving makes the next run faster (2.27x to TOWN)     >= 1.5
PASS ...without trivialising it (2.27x < 6x)                <  6
PASS a full first run banks a bonus worth the reset (77 embers)
```

A bonus that changes nothing makes the restart pure loss and nobody takes it. A
bonus that collapses the ladder deletes the content it was meant to extend.
Add an `--embers N` flag so any run *after* N evolutions can be priced directly;
that flag is what turned "does the loop converge?" from an argument into a table:

| embers | VILLAGE | TOWN | CITY | METROPOLIS |
|---|---|---|---|---|
| 0  | 0h21 | 1h02 | 4h12 | — |
| 8  | 0h12 | 0h35 | 2h20 | 1.3d |
| 20 | 0h07 | 0h21 | 1h24 | 18h39 |
| 44 | 0h04 | 0h12 | 0h47 | 10h22 |

And assert the rule itself in the **rules** suite, not the pacing one — it is a
rule, not a balance number. The three checks that matter are: a first run banks
embers and resets the settlement while keeping them; a **shallower** run banks
exactly nothing and cannot move the mark down; a **deeper** run pays again.

> Gotcha: a drive block that calls `evolve()` is destructive by definition —
> it replaces the whole state object. Snapshot and restore around it
> (`JSON.stringify(S)` / `S = JSON.parse(...)`, then rebuild the scene), or it
> silently wipes what later checks depend on. Here it broke a save-persistence
> assertion a hundred lines further down, which is a long way from the cause.

## 8. Where the wall goes

The prestige loop only works if a run *ends* somewhere the player can feel. The
useful framing: the wall is where the next stage is far enough away that
evolving beats grinding. Tune the run length to that point, not to a stage.

Fire Clicker targets ~2 h: TOWN lands at 0h55 and CITY at 2h43, so a two-hour
session takes TOWN and gets most of the way to CITY — which is exactly when
evolving becomes the right move. A run does **not** need to reach the top rung;
METROPOLIS being unreachable on run one is the design working, not a gap.

Two curves set that, and both were flattened to get there:

- **RECRUIT VILLAGER 1.75 → 1.45.** At 1.75 population walled out near POP 20
  and the economy plateaued two stages before the ladder ended — a metropolis
  with a village's workforce.
- **BUILD HOUSE 1.6 → 1.45.** Houses are a *gate* as well as a purchase (every
  FOUND card demands the rung below be fully built), so this curve decides where
  each stage lands. At 1.6 the thirty-second house cost 10.6M wood and put the
  top rung days past anything a bonus could rescue.

**Flattening a curve re-prices every metric that touched it.** Both changes made
recruits cheap for everyone, which is what broke the skill-gap proxy — see §9 of
`20260828-pacing-a-real-time-game-in-wall-clock-hours.md`.
