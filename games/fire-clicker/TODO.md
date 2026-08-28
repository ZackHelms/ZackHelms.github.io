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
