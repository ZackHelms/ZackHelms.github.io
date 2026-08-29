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
- [x] **FIRE PIT bought zero throughput** — an optimal player never bought it
      at all. Fixed by ramping the roar bonus with heat (half at the 75% line,
      full at a brimming bank) rather than snapping it on at 75%. A hand-tapped
      fire sawtooths between `maxBank() - tapPower()` and `maxBank()`, so a
      deeper pit is a *shallower sawtooth in fractional terms* and holds a
      higher mean bonus between taps. Measured: FIRE PIT went from **never
      bought** to the **first purchase in the game** (day 0.2) and maxed to
      Lv8. It costs the speedrunner a little early tempo — POP 15 parity 2.29x
      -> 2.10x, POP 20 2.18x — because the ceiling now has to be earned instead
      of arriving free at 75.1% of the bank.

### Addressed 2026-08-29 (the player who does not read, and the one who leaves)
- [x] **BELLOWS was a trap card.** It multiplies a bonus a player who has never
      crossed 75% has never seen, and the casual persona bought it at day 2.3
      while roaring 0.4% of the run. Now gated on `S.roared` (saved): the card
      appears the first time the fire ROARS, which any player earns within
      seconds of tapping a fresh five-second bank to the brim. `S.up.bellows > 0`
      keeps it visible for older saves, so the gate can never delete a card
      someone paid for. Neither persona's pacing moved — both roar long before
      they can afford it.
- [x] **A dead camp could not restart itself.** A dead fire *plus* an empty
      woodpile is terminal: cold villagers huddle or go inside, so nobody
      gathers, so the keeper has nothing to throw. The keeper now forages for
      itself in that state and comes back with an armful (`FORAGE_ARMFUL` 8
      ≈ 32 s of fire), which is a full round trip for everybody and actually
      restarts the economy; a single log buys 4 s and just flickers, which the
      first draft did until the drive check was tightened to require the camp
      be *burning*, not merely holding wood. Only the keeper works in the cold,
      so this buys a hands-off player survival and never throughput. A dead
      fire also now carries a persistent pulsing `TAP TO RELIGHT` rather than
      one hint that expires while the player is away.

      **Correction to the earlier finding.** The "hard-stalls at day 6" was an
      artifact of the *estimator*, not the game: it zeroed uptime the instant
      its wood pool went negative. The browser sim, stepping real villagers,
      holds 100% fire uptime over 40 strict days — scarcest-first job picking
      refills wood faster than one keeper burns it. The estimator now floors
      the pool instead of killing the run. Where model and sim disagree, the
      sim is the game.

### Open
- [ ] **The game still runs out at ~1 h 11 of play.** Every multiplier is bought
      by day 14 (casual) / day 7 (optimal), after which the only card left is
      RECRUIT VILLAGER at `24 * 1.75^n` — POP 20 costs the speedrunner another
      five hours and POP 50 would need ~2e12 wood. Either the recruit curve
      flattens or the TOWN stage lands before that wall. Needs-Zack: which.
- [ ] **DRY TINDER and WINDBREAK still buy zero throughput.** (FIRE PIT is
      fixed — see above.) The reason is that *tapping is not scarce*: the bank
      drains 1 s per second and a tap banks 1 s, so holding a brimming fire
      costs exactly **1 tap/second** against a hand that can manage eight. A
      stronger tap and a slower drain both cut a tap budget that was never
      binding, so they remain comfort cards and the optimal persona still never
      buys either (`tinder:0, wind:0` at day 200). Needs-Zack, because the fix
      is a real balance change rather than a formula tweak:
      1. **Let the fire's appetite grow with the camp** — `drainRate()` scales
         with population or stage ("a bigger camp needs a bigger fire"). Tap
         demand then climbs toward the limit of a human hand and both cards
         become throughput. Costs: the FIREKEEPER burns more wood, and the
         casual persona's 3 Hz eventually stops holding the fire — which may be
         the point, or may be too harsh. The eval can price both in a minute.
      2. Give WINDBREAK a second effect (villagers work through the night?) and
         DRY TINDER a role in relighting a dead fire. Note that since
         2026-08-29 the keeper's own wood run already covers the *recovery*
         case, so a DRY TINDER relight effect would have to be about making a
         relight cheaper or faster, not about making one possible.
