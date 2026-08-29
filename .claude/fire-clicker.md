# Fire Clicker — context

`games/fire-clicker/index.html` (~1600 lines, single file). **A village
fire-keeping sim, NOT a shop-list clicker** — the CD explicitly redesigned it
away from the croissant/basketball template on 2026-08-28 (the first shipped
version was that template; it was fully replaced the same day). The whole game
is one rendered scene: a stylized-cartoon snowy landscape, two straw houses
top-left/top-right, an unlit campfire in the centre ringed by log seats, and
simulated villagers.

**Licensing: one of the five protected games** (with phasic, mitochondria,
qntmchmst, turret-builder) — proprietary LICENSE in its directory, never
Apache/MIT. The CD may develop it into a real app.

## Core loop (the CD's spec, implemented)
- **Tap the campfire** (generous elliptical hit zone, `G.hitR`): a mote of
  fire rises from the tap point (its own light source) and the tap **banks
  burn time** — `tapPower()` = 1 s base — into `S.bank`, capped at
  `maxBank()` = 5 s base. The bank **counts down from the moment it starts**
  (`fireStep`, `drainRate()` seconds of bank per real second). Taps outside
  the fire zone just kick up a snow puff and bank nothing — asserted in the
  drive suite.
- **Villagers** (`villagers[]`, state machine in `villagerStep`): while the
  fire burns they pick the scarcest job and haul **wood** (trees, bottom-left),
  **stone** (rocks, bottom-right) or **food** (ice-fishing hole, bottom) back
  to the stockpile, `tripYield()` each. When the fire is out they retreat —
  roughly half huddle on the log seats (hand-rubbing + shiver + breath puffs),
  half go inside the houses (window glows at night, smoke from the smoke-hole).
- **Day cycle**: `DAY_LEN` = 300 s per full day. `KF[]` palette keyframes
  (night→dawn→day→golden→dusk→night) drive sky gradient, `ambient()` darkness,
  sun/moon on the same arc half a day apart, stars, faint aurora at deep night.
- **Lighting** is the centrepiece: scene painted in day colours, then a
  low-res darkness canvas (`light`, LSCALE 0.34) is filled with
  `ambient()`-alpha night blue (ramping in below the skyline so the sky keeps
  its own palette) and light sources **punch holes** (`destination-out`
  radial gradients — fire scaled by intensity+flicker, motes, lit windows),
  then warm additive tints go on top. The drive suite pixel-asserts fireside
  ground brighter than far snow at night. Full recipe + the three gotchas:
  `.claude/notes/20260828-punch-hole-lighting-canvas2d.md`.
- **Chat bubbles** (`SAY`, `speak()`, `drawBubble()`): tapping a villager
  (20 px hit circle, checked BEFORE the fire hit test — a villager tap never
  stokes) shows a canvas speech bubble above their head for 5 s
  (`BUBBLE_DUR`), and **only one bubble can exist at a time** — `speak()`
  early-returns while `bubble` is set, by CD spec. Lines are drawn from
  weighted pools: carry lines per resource (log/rock/fish, incl. the
  heavier/lighter pair), time-of-day pools keyed off `phaseName()`
  (night/dawn/day/dusk), cold lines when the fire is out, warm lines when
  huddling by a lit fire, keeper lines, and a generic pool (fourth-wall-ish
  cozy deadpan — "Why do my legs move like this?"). `lastLine` blocks
  immediate repeats. The bubble follows its villager, word-wraps at 150 px,
  clamps to the screen, draws ABOVE the lighting layer, and ends early if the
  speaker goes indoors. New lines: append to the right pool; keep the voice —
  short, earnest, slightly self-aware, never snarky at the player.
- **ROARING FIRE** (`ROAR_AT` 0.75, `heat()`/`roaring()`/`roarScale()`/
  `roarNow()`/`heatBoost()`): while the bank sits above **75% of `maxBank()`**
  the whole camp works faster — one multiplier applied at three sites in
  `villagerStep` (the idle-wait decrement, `move()`'s speed, and `v.w`, the
  heat-scaled work clock that exists precisely so a roaring fire shortens the
  job itself). Base +10%, +10% per **BELLOWS** level to +70% at max. It is the
  reward for tending the fire *yourself*: the FIREKEEPER only stokes below 35%
  of the bank, so **an auto-tended fire can never cross the threshold**, and
  the eval measures exactly that split (speedrun roaring 100% of the run,
  casual ~0.5%). The bank ring goes bright and glowing above the line, carries
  a tick mark at 75% so the target is visible, and the label reads
  `⚡ ROARING +N%` with the *live* ramped value.
  **The bonus ramps** (`roarScale()`, 2026-08-28): half of `roarBonus()` at the
  ROAR_AT line, all of it at a brimming bank, linear between. Do not flatten
  this back into a cliff. It does two jobs. It removes a knife-edge — 74.9%
  and 75.1% of the bank were a whole multiplier apart, so the dial had one
  meaningful pixel. And it is the **only** reason FIRE PIT buys throughput: a
  hand-tapped fire sawtooths between `maxBank() - tapPower()` and `maxBank()`,
  so a deeper pit is a shallower sawtooth *in fractional terms* and holds a
  higher mean bonus between taps. Measured, FIRE PIT went from never bought by
  the optimal persona to its first purchase, maxed to Lv8. Note what the ramp
  does **not** fix: DRY TINDER and WINDBREAK stay dead, because tapping is not
  scarce — the bank drains 1 s/s and a tap banks 1 s, so a brimming fire
  costs 1 tap/second against a hand that can do eight, and neither card cuts a
  budget that was ever binding. See `games/fire-clicker/TODO.md`.
  **BELLOWS is gated on the first roar** (`S.roared`, saved; `show:()=>S.roared
  || S.up.bellows > 0`, 2026-08-29). The bonus exists at Lv0 — `roarBonus(0)`
  is +10% — so any player who taps a fresh five-second bank to the brim earns
  it within seconds and unlocks the card that deepens it. Before the gate,
  BELLOWS was the game's one trap card: expensive, and completely inert for
  someone letting the firekeeper smoulder (the casual persona bought it at day
  2.3 and roared 0.4% of the run). The `S.up.bellows > 0` half of the guard is
  load-bearing — it keeps the card visible for saves written before `S.roared`
  existed, so the gate can never delete a card someone paid for.
- **The dead-camp recovery valve** (`FORAGE_ARMFUL`, `v.forage`, the DESPERATE
  WOOD RUN branch of `keeperWait`, 2026-08-29): a dead fire **plus** an empty
  woodpile is the game's one terminal state. Cold villagers huddle or go
  inside, so nothing is gathered, so the keeper has nothing to throw, so the
  fire stays dead — forever. Neither eval persona reaches it (the sim holds
  100% fire uptime even for the literal never-taps-again player, because
  scarcest-first job picking refills wood faster than one keeper burns it) but
  a player spends into it by buying an upgrade as the bank runs out. So the
  keeper — whose whole job is feeding the fire — fetches wood itself.
  Two properties are load-bearing and both are pinned in the drive suite:
  1. **Only the keeper forages.** Any other villager working while cold would
     quietly refund a hands-off player the cost of neglect. `v.forage` is the
     flag that lets `toWork`/`working` skip their `!warm` bail-out, and it is
     cleared on delivery and on any keeper/worker role flip.
  2. **It brings back an ARMFUL, not a log.** A log is 4 s of fire; a villager
     needs ~15 s to stand up, walk out, gather and deliver. Relighting on one
     log buys 4 s in which nobody can finish a trip, so the camp flickers 4 s
     warm / 18 s cold forever — measured, in the first draft of this fix.
     `FORAGE_ARMFUL` (8) is ~32 s of continuous fire, one full round trip for
     everybody, which is what actually restarts the economy. If you change
     `stoke`'s +4 s or the villager cycle time, this number moves with them.
  Because it can only start from a state a tending player never reaches, it
  buys a hands-off player **survival and never throughput** — the eval's
  skill-gap assertions are untouched by it.
- **A dead fire says so, persistently.** `drawBank()` paints a pulsing
  `TAP TO RELIGHT` under the `COLD` label whenever `!FIRE.burning`. It used to
  be one transient hint, which is exactly the wrong shape: a dead fire stops
  the entire camp, and the player most likely to meet one has been away long
  enough for the hint to expire.
- **MICROMANAGEMENT** (`S.up.micro`, `S.focus`, `siteAt()`, `drawFocus()`): the
  skill lever. Once bought, tapping the trees / rocks / fishing hole sends
  **every** villager after that resource (`villagerStep`'s idle branch skips the
  scarcest-first pick entirely); tapping it again releases them. `S.focus` is
  saved, cleared on load if `micro` is not owned, and marked by a pulsing dashed
  ring at the site plus a ▸ against that resource in the HUD. Site hit tests
  run AFTER the villager test (a villager tap is still a bubble) and before the
  fire.
- **Upgrades** (`UPG[]`, DOM panel toggled by the bottom-right 🔨 button —
  same button opens AND closes it, label flips to ✕ CLOSE; the card list
  lives in its own `#upg-scroll` container so the button never moves):
  FIRE PIT (+5 s max bank), DRY TINDER (+0.5 s per tap), WINDBREAK (slower
  drain), SHARP TOOLS (+1 per trip), RECRUIT VILLAGER (+1, capped by
  houses×5), BELLOWS (the ROARING bonus above), MICROMANAGEMENT (shown at 3
  houses, priced to land just before FOUND VILLAGE), FIREKEEPER (auto-tapper: red-hatted villager, −1 wood → +4 s via
  the same `stoke()` when bank < 35%, **capped at one** — a second would feed
  the same bank and buy nothing, and it forages for itself when the camp is
  dead: see the recovery valve above), BUILD HOUSE, FOUND VILLAGE, and the
  village businesses. `max` may be a function (`maxOf()`), `show()` gates
  stage-locked cards; cards carry `dataset.uid` so `refreshHUD()` updates
  affordability without rebuilding mid-press.
- **Houses & stages** (`HOMES[]`/`HOUSE_SLOTS`, `BIZ`/`BIZ_DEFS`,
  `layoutBuildings()`): every house sleeps **5 villagers**
  (`popCap = min(4+recruits, houses×5)`); BUILD HOUSE fills slots in order —
  cap 5 at CAMP, 10 at VILLAGE. **FOUND VILLAGE** (shown at 5 houses) is the
  first stage upgrade (`S.up.village`): houses shrink (`houseW()`), swap from
  straw huts to timber cabins with chimneys, trodden paths bake into the
  ground from every doorstep to the fire, and businesses unlock — **TAVERN**
  (+15% walk speed), **GENERAL STORE** (+1 trip yield), **SAWBONES HUT**
  (work 3.2 s → 2.4 s). Business windows stay lit at night and join the
  lighting punch list. Stage ladder from here (town/city/metropolis,
  building upgrades, schools, ascension): `games/fire-clicker/TODO.md` —
  the game-specific backlog the CD asked for; repo-root TODO.md stays
  Phasic-only.
- **Cel shading**: everything solid gets a flat side-shade band and an INK
  (`#151823`) outline via `inkStroke()` — houses, businesses, trees, rocks,
  seats, fire stones, stockpile, villagers (coat + head). Painters draw
  through one **y-sorted item list** in `frame()` (buildings, scenery,
  villagers together), so villagers correctly pass behind and in front of
  buildings as the scene densifies.

## Architecture
- Save `fireClicker.v2` (v1 key is deleted on load), field-by-field `load()`,
  autosave 5 s + visibilitychange. `S.lifeWarm` accumulates warm-seconds —
  reserved for the future stage/ascension layer.
- `G` holds all scene anchors, recomputed in `resize()`; `G.houseL/R` are
  **persistent objects** (villagers hold `home` references and `inside`
  counts must survive resize — was a bug, fixed). Ground snowfield is baked
  once per resize (`bakeGround`); scatter uses seeded `prng()`, never
  per-frame RNG.
- Particles: `flames` (additive, spawn rate probabilistic ∝ intensity),
  `sparks`, `motes`, `smoke` (chimneys, breath, snow puffs), `snow`, `chips`
  (work debris), `floats` (+1 🪵 texts). Villagers y-sorted before draw.
- Audio: lazy `audioInit()`, wind bed (LFO’d noise, louder at night/cold) +
  crackle bed (gain follows `FIRE.intensity` per frame) + sparse minor plucks;
  SFX flint tap, snow puff, log toss, purchase. Mute persisted; suspend on
  hidden.
- Chrome z-80 (back/mute/upgrade btn) above the upgrade overlay z-70.

## Design intent going forward (CD, 2026-08-28 — details TBD)
- Resources → **stage progression**: village → town → … → futuristic city.
- Endgame: **ascend** (reset with a productivity boost scaled by progress).
  `S.lifeWarm`/`S.day` are the obvious inputs; nothing is wired yet.
- Keep the scene the hero: any new mechanic should be visible in the world
  (new buildings, busier villagers), not a bigger menu.

## Pacing (measured, not guessed)

`DAY_LEN` is 300 s, so **1 in-game day = 5 real minutes** — 12 days is an hour
of play. `.claude/tests/eval-fire-clicker.cjs` plays the real game headless with
two scripted personas and reports every milestone in both units. Current numbers
(390x844, 3 seeds, after the 2026-08-28 skill-reward pass):

| Milestone | SPEEDRUN | CASUAL | skill pays |
|---|---|---|---|
| MICROMANAGEMENT | day 2.6 (13 min) | day 5.4 (27 min) | 2.1x |
| **FOUND VILLAGE** | day 4.1 (**20 min**) | day 10.9 (**55 min**) | 2.7x |
| economy maxed (no multipliers left) | day 6.6 (33 min) | day 14.1 (1 h 11) | 2.1x |
| POP 15 | day 11.3 (57 min) | day 25.9 (2 h 10) | **2.3x** |
| POP 20 | day 71.7 (5 h 59) | day 160 (13 h 20) | **2.2x** |

**The pass that produced these.** The first baseline (same file, before ROARING
FIRE / MICROMANAGEMENT) had the two personas converging: 1.26x at POP 15 and
**1.06x at POP 20** — optimal play and naive play arriving within 6% of each
other, which is the shape of a game where nothing the player does matters. The
gap now holds above 2.2x all the way out, and two assertions guard it. If a
future change collapses it, the eval fails rather than the CD noticing months
later.

Still true, and still the strongest argument for the TOWN stage: **the
multipliers run out around day 7-14 (33 min to 1 h 11)**, after which the only
card left is RECRUIT VILLAGER on a `24 * 1.75^n` curve that linear income cannot
chase — POP 20 alone costs the speedrunner another five hours.

Two things the eval taught that are not obvious from the tables:

- **A value-driven player stops building houses.** BUILD HOUSE raises no rate of
  its own; it only lifts the RECRUIT cap. Once `bunk` is below that cap a house
  is worth nothing, so the speedrun persona correctly leaves houses at 8 while
  the casual (buying in panel order) reaches 10. "Economy maxed" therefore
  excludes `house` — houses are a means to population, not an end.
- **Tapping demand is ~1 tap/second, flat**, and FIRE PIT / DRY TINDER /
  WINDBREAK still buy no throughput for a player willing to sustain that. They
  reduce *effort*, not time. Ideas for fixing that: `games/fire-clicker/TODO.md`.

## Gotchas
- **A villager whose keeper flag changes must be reset to `idle`** (2026-08-28).
  `syncVillagers()` re-flags `v.keeper = i >= popCap()`, so buying RECRUIT
  VILLAGER demotes the villager sitting at the old boundary from keeper to
  worker — and if it is standing in `keeperGo`/`keeperWait`, **nothing in the
  state machine ever moves it again**. Every recruit bought after a firekeeper
  silently retired one villager for the rest of the run (8 of 13 idle by day 30
  in the casual persona). Nothing looked wrong on screen: the villagers stood by
  the fire, which is where a keeper belongs. The tell was numeric — a measured
  gather cycle 32% longer than the analytic model's — and it is now an
  assertion (`no villager stranded in a keeper state`). Any future role flag
  needs the same release.
- **Lay out in the canvas's own box, never `window.inner*`** (2026-08-28,
  the landscape tap bug). Pointer coords are resolved against
  `cv.getBoundingClientRect()`; on iOS that box is *shorter* than
  `innerHeight` after rotating into landscape (Safari's chrome). Size the
  scene from `innerHeight` and CSS squashes the taller backing store into the
  shorter box: everything is drawn **higher** than where it is hit-tested, so
  the campfire only answered taps at the bottom of the drawn circle and below.
  `viewBox()` is the single measurement point — keep every layout number
  downstream of it. Note the symptom is silent: nothing looks obviously wrong,
  the scene just stops agreeing with the finger, and a headless tap at
  `G.fire` "passes" because it tests the hit test against itself. To catch it
  you must tap where the fire is **drawn** (`G.fire.y * boxH / H`).
- **Rotation self-heal**: iOS can also hand every rotation event a stale box
  and then never fire again, so `reflow()` runs three passes per event across
  `resize`/`orientationchange`/`visualViewport` (phasic's pattern) *and*
  `frame()` re-measures the box 5×/s and relayouts on disagreement. `resize()`
  is idempotent for a given box, so all of that is a no-op once settled.
- The camp hut's snow cap must **hug the roof's outer quadratic** (underside
  control tucked inside the straw arc): the original free-floating crescent
  read fine on the pale portrait sky but showed as a detached white arc over
  the dark treeline in landscape.
- Villager walk speed matters: at <35 px/s a first gather trip takes 20-30 s
  and the game feels dead (and the drive suite times out) — it's 46-60 px/s.
- The keeper feeds through `stoke()` so the cap/mote/float rules stay in one
  place; don't add a second bank-mutation path.
- Flame spawn per frame must be probabilistic (`floor + rand<frac`) — a bare
  `for (i < fractionalWant)` loop always runs once and a dying fire smokes
  like a bonfire.
- **Drive suite: `.claude/tests/drive-fire-clicker.cjs`** (55 checks — see
  its row in `.claude/tests/README.md`). Run it after any change to the fire
  model, villager states, houses/stages, bubbles or lighting:
  `NODE_PATH=<playwright-core dir>/node_modules node .claude/tests/drive-fire-clicker.cjs`
  (optionally `SHOTDIR=<dir>` for screenshots).
- **Pacing eval: `.claude/tests/eval-fire-clicker.cjs`** (11 checks) — the two
  personas above, plus a calibrated analytic estimator. Run it after any change
  to a cost curve, `tripYield`, walk speed, work time or the villager loop:
  `node .claude/tests/eval-fire-clicker.cjs --days 400 --seeds 3`
  (~55 s). For a balance sweep with no browser at all,
  `node .claude/tests/eval-fire-clicker.cjs --model-only --days 400` answers in
  ~0.3 s — but only trust it while the run's `MODEL vs SIM` MAE stays low and
  the `cycle measured / model` line stays within a few percent. Both of those
  print on every full run for exactly that reason.
  Method + the two calibration surprises:
  `.claude/notes/20260828-pacing-a-real-time-game-in-wall-clock-hours.md`.
