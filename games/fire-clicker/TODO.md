# Fire Clicker — game backlog

Game-specific backlog only (CD-requested, 2026-08-28). The repo-root TODO.md
is Phasic-scoped — fire-clicker work is tracked here.
Implemented: all five stages (CAMP → VILLAGE → TOWN → CITY → METROPOLIS), the
hearth ladder, the banded scene layout, the civic upgrade chains, and the
EVOLUTION prestige loop. Sections below are marked built or open.

## Built 2026-08-29 — the stage ladder and the evolution loop
- [x] **TOWN, CITY, METROPOLIS.** Five rungs off one `STAGES` table: house caps
      5/10/16/24/32, buildings shrinking every rung, straw → timber → brick →
      stone → glass, footpaths → a surveyed gravel avenue → a lit street grid,
      snow → packed → paved → plaza, street lamps from TOWN on that punch real
      holes in the night-lighting layer. FOUND cards are generated from the
      table and gated on *filling* the rung below.
- [x] **The hearth ladder**: campfire → cast-iron stove → bricked furnace →
      steam plant → high-tech core. The flame never changes, only its housing.
- [x] **Civic buildings upgrade in place**, as the CD asked: sawbones hut →
      doctor's office, constable hut → police station, fire marshal → fire
      station, small school → high school → college.
- [x] **EVOLUTION.** Reset to a fresh camp; keep EMBERS earned from the run's
      total haul, `floor((reach/1200)^0.55)`, +10% haul each. The bonus is a
      **high-water mark**: evolving twice at the same depth banks nothing, only
      going further pays. Measured — run 1 banks ~13 embers at two hours and
      run 2 reaches TOWN 2.27x faster.
- [x] **Pacing stretched to a ~2 h run.** FOUND VILLAGE 0h21, TOWN 0h55, CITY
      2h43 for an optimal player, so a two-hour session lands TOWN and most of
      the way to CITY — which is where evolving becomes the right move.

## Still open at the top of the ladder
- [ ] **Beyond METROPOLIS.** The CD's "…futuristic city, etc." — further rungs
      are one row in `STAGES` plus one case per painter now. Needs-Zack: how
      many, and whether the campfire stays the whole economy at that scale or
      later stages add heat infrastructure.
- [ ] **Mishap events.** The constable and fire marshal are priced as flat
      bonuses because there are no mishaps to prevent yet. Giving them real
      events would make them read as insurance rather than as another
      multiplier.
- [ ] Stage-specific chat-bubble lines (school kids, constable, barkeep…).
- [ ] Town visual polish: vehicles on the city grid, shopfronts along the
      avenue, snow clearing from paved ground during the day.

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

### Addressed 2026-08-29 (pacing and the prestige loop)
- [x] **The game ran out at ~1 h 11 of play.** Both halves of the fix landed:
      the recruit curve flattened (`1.75 → 1.45`, so population keeps growing
      into the late stages instead of walling out at POP 20 — a metropolis with
      a village's workforce) and the TOWN/CITY/METROPOLIS stages landed above
      it. BUILD HOUSE flattened too (`1.6 → 1.45`), because houses are a *gate*
      as well as a purchase and at 1.6 the thirty-second house cost 10.6M wood.
      An optimal player now sees VILLAGE at 0h21, TOWN at 0h55 and CITY at
      2h43, and the content past that is the evolution ladder rather than a
      single run.
- [x] **Skill stopped paying, and the proxy was the reason.** Flattening
      recruits made them cheap for everyone, so the naive persona closed to
      1.33x *on POP* while still taking twice as long to reach anything — it
      even reached POP 10 first, because the optimal opening buys FIRE PIT and
      SHARP TOOLS instead. The gap is now asserted on the stage ladder (2.11x /
      1.98x / 2.94x to VILLAGE / TOWN / CITY) and BELLOWS' ceiling grows with
      the stage, since a skill lever has to scale with the economy it levers.

### Open
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
