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

## Balance findings from the persona eval (2026-08-28) — CD decisions

Measured by `.claude/tests/eval-fire-clicker.cjs`. A day is 5 real minutes.

- [ ] **The game runs out at ~1 h 15 of play.** The economy maxes at day 15
      (casual) / day 10 (optimal), after which the only card left is RECRUIT
      VILLAGER at `24 * 1.75^n` — POP 20 costs another ~11 hours and POP 50
      would need ~2e12 wood. Either the recruit curve wants flattening, or the
      TOWN stage needs to land before that wall. Needs-Zack: which.
- [ ] **Skill barely pays.** Optimal play beats naive play 2.4x to the village
      and only 1.45x to a maxed economy, because the only difference the game
      allows is buy order. If mastery should matter, there has to be a lever a
      good player can pull that a naive one cannot.
- [ ] **Three upgrades buy zero throughput.** FIRE PIT, DRY TINDER and
      WINDBREAK only reduce tapping (which is a flat 1 tap/second at every
      stage) — a value-driven player correctly never buys any of them. They
      need a second effect, or the tapping loop needs to be something a player
      would want to buy out of.
- [ ] **FIREKEEPER makes the game play itself.** One keeper sustains the fire
      indefinitely on 0.17 wood/s; the casual persona taps 366 times in 400
      days and never has to touch the screen again. That is either the
      idle-game promise or the moment the game stops being one — CD call.
