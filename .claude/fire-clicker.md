# Fire Clicker — context

`games/fire-clicker/index.html` (~900 lines, single file). **A village
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
  ground brighter than far snow at night.
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
- **Upgrades** (`UPG[]`, DOM panel toggled by the bottom-right 🔨 button —
  same button opens AND closes it, label flips to ✕ CLOSE; the card list
  lives in its own `#upg-scroll` container so the button never moves):
  FIRE PIT (+5 s max bank), DRY TINDER (+0.5 s per tap), WINDBREAK (slower
  drain), SHARP TOOLS (+1 per trip), RECRUIT VILLAGER (+1, capped by
  houses×5), FIREKEEPER (auto-tapper: red-hatted villager, −1 wood → +4 s via
  the same `stoke()` when bank < 35%), BUILD HOUSE, FOUND VILLAGE, and the
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

## Gotchas
- Villager walk speed matters: at <35 px/s a first gather trip takes 20-30 s
  and the game feels dead (and the drive suite times out) — it's 46-60 px/s.
- The keeper feeds through `stoke()` so the cap/mote/float rules stay in one
  place; don't add a second bank-mutation path.
- Flame spawn per frame must be probabilistic (`floor + rand<frac`) — a bare
  `for (i < fractionalWant)` loop always runs once and a dying fire smokes
  like a bonfire.
- Drive suite: `scratchpad/drive-fire.cjs` pattern (19 checks) — worth
  promoting into `.claude/tests/` on the next pass.
