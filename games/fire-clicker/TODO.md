# Fire Clicker — game backlog

Game-specific backlog only (CD-requested, 2026-08-28). The repo-root TODO.md
is Phasic-scoped — fire-clicker work is tracked here.
Implemented so far: CAMP → VILLAGE (5→10 houses, 5 villagers/house, tavern /
general store / sawbones with live effects, cel-shaded art, per-stage layout +
trodden paths). Everything below is not built yet.

## TOWN stage
- [ ] FOUND TOWN upgrade — proposed gate: 10 houses + all three village
      businesses; big resource cost.
- [ ] Sawbones hut → **Doctor's office** (upgrade in place: same slot,
      smarter building, stronger effect — e.g. work speed 25% → 40%).
- [ ] **Constable hut** (new building; effect TBD — proposal: prevents
      "mishaps": occasional resource-loss events that start at town scale).
- [ ] **Fire marshal hut** (proposal: fire safety — bank drains slower, or
      a dead fire keeps embers longer so relighting is cheaper).
- [ ] **Small school** (proposal: villagers slowly graduate to +1 yield each).
- [ ] Town visual overhaul: houses shrink again, plank→brick/frame look,
      a street grid replaces the radial paths, lamp posts, more house slots.

## CITY stage
- [ ] Constable hut → **Police station**; fire marshal hut → **Fire station**.
- [ ] Small school → **Elementary school**, add **Middle school** and
      **High school** (schooling ladder stacks its effect).
- [ ] City visual overhaul: paved roads, streetlights, multi-storey
      buildings, cleared (grey/slushy) ground, maybe vehicles.

## METROPOLIS and beyond
- [ ] **College**, and further modern/futuristic stages (CD: "…futuristic
      city, etc."). Each stage keeps shrinking buildings to fit more.
- [ ] The campfire's role at high stages — CD direction needed: does the
      whole economy still hang off tapping one fire (a plaza "eternal
      flame"?), or do later stages add heat infrastructure?

## Ascension
- [ ] When practical upgrades run out, **ascend**: reset with a permanent
      productivity boost scaled by how far the run got. `S.lifeWarm`
      (warm-seconds) and stage reached are the obvious inputs. Needs CD
      sign-off on the formula and what persists.

## Smaller / anytime
- [ ] Stage-specific chat-bubble lines (school kids, constable, barkeep…).
- [ ] Firekeeper-powered offline progress (fire burns while away if wood
      stocked; currently nothing accrues offline — honest but stingy).
- [ ] More log seats / bigger fire ring as population grows.
- [ ] Stockpile art that visibly grows with stored resources.
- [ ] Mishap events + toasts to give constable/fire marshal something real.

## Balance findings from the persona eval

Measured by `.claude/tests/eval-fire-clicker.cjs`. A day is 5 real minutes.

### Addressed 2026-08-28 (skill-reward pass)
- [x] **Skill barely paid** — optimal play beat naive play by only 1.26x at
      POP 15 and **1.06x at POP 20**. Fixed by ROARING FIRE (a camp-wide speed
      bonus while the bank is above 75%, which the firekeeper structurally
      cannot earn) plus MICROMANAGEMENT (tap a work site to aim every villager
      at one resource). The gap now holds at **2.3x / 2.2x**, guarded by
      assertions.
- [x] **A second and third FIREKEEPER bought nothing** — capped at one.

### Open
- [ ] **The game still runs out at ~1 h 11 of play.** Every multiplier is bought
      by day 14 (casual) / day 7 (optimal), after which the only card left is
      RECRUIT VILLAGER at `24 * 1.75^n` — POP 20 costs the speedrunner another
      five hours and POP 50 would need ~2e12 wood. Either the recruit curve
      flattens or the TOWN stage lands before that wall. Needs-Zack: which.
- [ ] **FIRE PIT / DRY TINDER / WINDBREAK still buy zero throughput.** Tapping
      demand is a flat ~1 tap/second at every stage, so all three reduce effort
      rather than time and a value-driven player skips them. Three ways to fix,
      cheapest first:
      1. **Ramp the roar bonus with heat** — full bonus at 100% of the bank,
         half at 75%. Then a bigger bank (PIT), a stronger tap (TINDER) and a
         slower drain (WINDBREAK) all buy *time spent near the top*, which is
         throughput. One-line change to `heatBoost()`; the eval would price it
         in about a minute.
      2. **Make the roar bonus need an absolute bank**, not just a fraction —
         e.g. the top 25% *and* at least 10 s banked, so FIRE PIT is a gate.
      3. Give WINDBREAK a second effect (villagers work through the night?).
- [ ] **A naive player can buy BELLOWS and feel nothing.** The casual persona
      buys it at day 2.3 and roars 0.4% of the run. The card and the FIREKEEPER
      card both say so in as many words, but it is still a trap card for
      someone who does not read. Consider hiding BELLOWS until the player has
      roared once.
- [ ] **The firekeeper can strand a hands-off player.** If wood hits 0 while the
      fire is out, nothing gathers and nothing recovers until the player taps.
      A human notices; the literal never-taps-again persona hard-stalls at day
      6 (`--casual-strict`). Options: keep one wood in reserve for the keeper,
      or a louder "THE FIRE IS OUT" state.
