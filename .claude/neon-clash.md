# Neon Clash — Context

`games/neon-clash/index.html` (single self-contained file, ~1520 lines).
Real-time card skirmish on one shared board. Vs AI at three grades, or two
players on one phone lying flat between them.

## The one thing that makes it different

**`rotated-2p-ui`.** In 2P mode the *top* card tray is drawn rotated 180°, so
a second player sitting on the opposite side of the table reads their own hand
the right way up. Both players deploy **at the same time** — there are no
turns and no pass-the-phone step. Every touch is routed by which tray it
started in (`pointDown` → `cardAt` → `controls(side)`), so simultaneous drags
from both ends of the phone are independent.

`trayFlipped(side)` is the single switch: `side === 1 && mode === '2p'`. It
controls three things that must stay in agreement —
1. `layoutCards()` card ordering (mirrored index, so P2's left-to-right reads
   the same as P1's),
2. the `ctx.rotate(Math.PI)` in `drawCard`,
3. the energy label and the drag captions (`GARRISON`, deny text).

In **vs-AI** mode the top tray is deliberately *not* flipped: nobody is
sitting there, and the player wants to read the AI's roster and energy.
`startMatch()` calls `layoutCards()` because the ordering depends on `mode`.

## Portrait lock

The game is **portrait-only**. `applyView()` (called on `resize`,
`orientationchange` and `screen.orientation` change) decides the shell's shape:

- **Touch device in landscape** — `#app` is pinned to the viewport centre, sized
  `innerHeight × innerWidth`, and given `rotate(-angle)` where `angle` is
  `screen.orientation.angle` (falling back to `window.orientation`, then 90).
  That is exactly what an OS portrait lock does: the layout never reflows, it
  just turns with the device. `#app.rotated` also re-derives the HUD's safe-area
  padding, since the notch is now on a side edge.
- **Anything else** (portrait phone, or a desktop window) — no rotation, and
  the width is clamped to `innerHeight * PORTRAIT_AR` so a wide window gets a
  centred portrait column instead of a stretched strip.

Two consequences to keep in mind when editing:

1. **The overlays live inside `#app`.** A transform makes an element the
   containing block for its `position:fixed` descendants, so the menu / help /
   result overlays only rotate with the game because they are nested there.
   Moving one back out to `<body>` would leave it landscape while the game
   turns. (`#build-badge` is deliberately left outside — it is a watermark and
   is more useful pinned to the physical corner.)
2. **`localPt()` un-rotates every pointer.** A ±90° rotation leaves the bounding
   box centred on the element's true centre, so the centre is a fixed point and
   `Rot(-viewRot)` around it recovers canvas-local coordinates. Anything new
   that reads `clientX/clientY` must go through `localPt`, never
   `getBoundingClientRect().left` directly.

`resize()` is unaffected — it reads `clientWidth/clientHeight`, which are layout
sizes and ignore the transform.

## Board and coordinates

World space is `UW 100 × UH 160`; `CENTER = 80` is the halfway line. Only the
board is in world units — both card trays are drawn in screen pixels.
`resize()` splits the canvas into `trayH` (top) / board / `trayH` (bottom) and
letterboxes the board into the middle.

Bases sit at `(50, 150)` and `(50, 10)` — drawn as an endzone goalpost
(pedestal + two uprights + crossbar), 1500 HP, no attack of their own. They
are the only win condition.

## Card types — the axis the deck grows along

Every entry in `KINDS` carries a **`type`**, and this is the one thing to get
right when adding a card. The deck is explicitly meant to grow (more units,
more buildings, more spells, eventually a deck-builder that picks five of
them), so **every rule branches on `type`, never on a card's name.**

| `type` | means | in the code |
|---|---|---|
| `unit` | walks, fights, can be garrisoned | `spawnUnit`, `stepUnit`, `pickTarget` |
| `building` | stationary, occupies ground, capped per side | `spawnBunker`, `clearSpot`, `MAX_BUNKERS` |
| `spell` | **no entity at all** — resolves the instant it lands | `castSpell` |

The three places that used to say `key === 'bunker'` now say
`k.type === 'building'`; if you find a name comparison creeping back in,
that is the bug. `DECK` is the left-to-right tray order and nothing else
depends on it — `layoutCards` and the flip mirror read `DECK.length`.

## Economy and the deck

Energy refills at **1/sec, cap 20**, both sides, starting at 5. At
`SUDDEN_AT` (180 s) regen doubles and damage dealt *to bases* doubles;
`MATCH_LIMIT` (300 s) awards the match on remaining base HP.

| Card | Type | Cost | HP | Dmg | Rate | Range | Speed |
|---|---|---|---|---|---|---|---|
| Tank | unit | 4 | 260 | 12 | 1.0/s | 6.5 | 8.5 |
| Fighter | unit | 3 | 130 | 16 | 2.0/s | 6 | 13 |
| Archer | unit | 3 | 70 | 20 | 1.0/s | 26 | 9 |
| Bunker | building | 8 | 600 | — | — | — | stationary |
| Fireball | spell | 5 | — | 90 | once | blast 14 | — |

Read as the spec's shape: tank = high HP / low damage / average everything
else; archer = low HP / average damage / long reach; fighter = average HP and
damage but double attack rate and the fastest legs; bunker = a building.
Tray order is fixed by `DECK`: **tank, fighter, archer, bunker, fireball.**

## Fireball — the comeback card

The brief was explicit about what this card is *for*: you have fallen behind,
the opponent has massed an army, and this is the card that buys the swing
back. Everything about it follows from that.

- **Cost 5, own half only** — the same `ownHalf` check every card obeys. It is
  not a base-sniping tool and cannot reach one (see below).
- **Damage falls off**: `90` at the centre, halving to `45` at the rim
  (`falloff: 0.5`, radius `blast: 14`). That is the whole balance. 90 kills an
  archer outright, guts a fighter (130 → 40) and chips a tank (260 → 170) — an
  excellent trade against four massed units and a *bad* one against a single
  unit, which is exactly the incentive the brief asked for. If it ever needs
  toning, move `falloff` before you move `dmg`: shrinking the rim value keeps
  the anti-crowd payoff while cutting the value of a lazy centre-of-board cast.
- **Knockback is radial**, out from the impact point, scaled by the same
  falloff, plus a short stun (`kb: 34`, `stun: 0.45`, shed at `KB_DECAY`).
  Scattering the deathball is half the value of the card — a knocked unit is
  shoved out of range and has to walk back in. Note it does **not** break a
  siege lock: a committed unit comes back to the same building.
- **It cannot damage a base, either side's.** Only units win the game. A
  spell that chipped the goalpost would turn hoarded energy into a second win
  condition and quietly undo the whole design. Geometry already makes it
  unreachable; `castSpell` simply never looks at `bases`.
- **A garrison is shielded from it**, like every other damage source — the
  bunker takes the blast. Same rule as the rest of § Bunkers.
- **Friendly fire is off.** The card exists to rescue the losing player;
  making it hurt your own line would punish exactly the person holding it.

### The one input rule that differs

`dropOff(k)` is `0` for a spell and `DRAG_OFF` for everything else. A unit's
ghost sits ahead of the finger so your thumb does not cover the thing you are
placing; a **spell lands exactly where you tap**, because you are aiming a
circle wide enough to sight down and the brief says the blast is centred on
the tap. The dashed blast ring in `drawDrags` is drawn at `k.blast`, so the
preview is the cast. `aiDeploy` backs its aim point out by `dropOff(KINDS[key])`
rather than a constant, which is what keeps the AI on the player's rules.

## Deployment rules (`dropInfo` / `tryDeploy`)

A drop is legal when the **finger** is on that player's own half — one rule for
every card type. The ghost sits `dropOff(k)` ahead of the finger toward the
opponent (`DRAG_OFF` = 9 world units for units and buildings, **0 for spells**)
and is then *clamped* into the half — so dragging to the halfway line deploys at
the line rather than failing. Refusals set `flash[side + ':' + kind]` (a 0.45 s
red card pulse) and, except for the "wrong half" case, play the deny sting:

| reason | when | applies to |
|---|---|---|
| `half` | finger is on the opponent's side | every card |
| `energy` | cost exceeds current energy | every card |
| `max` | already two bunkers on that side | buildings |
| `blocked` | bunker would overlap a base (`BASE_CLR`) or another bunker | buildings |
| `full` | dropping a unit on a bunker that already holds two | units |

A **spell can only ever be refused for `half` or `energy`** — it has no
footprint to block, no cap to hit, and it must not garrison a bunker it is
dropped on. That last one is the easy bug: the garrison branch lives in the
`else` of the type test, so any new spell gets it right for free, but a card
that forgets its `type` will silently try to walk into a building.

`aiDeploy(key, x, y)` backs the point out by `dropOff(KINDS[key])` and goes
through `tryDeploy` — the AI obeys exactly the rules the player does, including
cost and half checks. There is no AI-only placement path.

## Bunkers

Cost 8, 600 HP, **two per side**, holds **two units**. Dropping a unit card on
your own bunker garrisons it: the unit stops moving, is removed from every
enemy's target list (`pickTarget` skips `e.home`), and fires through the slits
at `max(kind.range, GARRISON_MIN_RANGE = 15)` — which is a real upgrade for
tanks and fighters and a no-op for archers.

**The garrison survives the building.** When a bunker dies, `killEntity`
ejects both occupants around it at their *current* HP with `home = null`. That
is the whole point of the "protection of the building" in the spec: the bunker
ate the damage instead of them. Do not change this to killing the garrison
without re-reading the design note — it is the difference between the bunker
being a shelter and being a coffin.

## Combat

`pickTarget` picks the nearest enemy unit or bunker by **edge** distance; if
that is farther than `range + AGGRO_PAD` (20) the unit walks at the enemy base
instead. Garrisoned units cannot chase — they take what is inside their range
or nothing. Retarget every 0.35–0.55 s.

### The siege lock

**Once a unit lands its first blow on a building it commits to that building
until the building dies.** `u.lock` holds the target; while it is set,
`stepUnit` skips `pickTarget` entirely, and it clears the instant `aliveT` says
the building is gone (with `retarget` already expired, so the freed unit
re-picks on the same frame).

This is a *balance* rule, not a targeting convenience, and it is the reason a
push is answerable at all. Without it, attackers that reach your base delete
each defender the moment it lands — the defender can never get a body on the
board. With it, a committed attacker keeps its back turned, so answering a push
that has already arrived is the cheapest fighting in the game. Three details
carry that intent and should not drift:

- **It engages on the first blow, not on targeting.** A unit merely *marching*
  at a base (the `pickTarget` fallthrough) has no lock and is still free to
  divert onto a defender that steps into its path. Moving the assignment up
  into `pickTarget` would quietly commit every unit that ever wandered
  base-ward, and the counterplay would vanish.
- **It covers every building** (`isBuilding`) — bunkers as well as bases. A
  bunker parked near the halfway line is therefore a deliberate tarpit: it eats
  attention as well as damage.
- **A fireball does not break it.** The blast shoves a committed unit out of
  range and it has to walk back, but it walks back to the same building.
  "Until it is destroyed" means what it says.

`drawLocks()` draws a faint pulsing dashed tether from each committed unit to
its target, under the units. That readout is load-bearing — the defender has to
be able to tell at a glance which attackers are busy and which are still free.

Melee applies damage instantly plus a `slash` arc; ranged pushes a homing
`shot` that resolves on arrival (and fizzles if its target dies first).
`separate()` is an O(n²) soft push that also shoves units out of bunker radii
and base footprints. `UNIT_CAP = 16` per side bounds it.

## AI

`AIS[ROOKIE|PRO|LEGEND]` tunes think interval, an idle/skip chance, how often
it answers a threat, whether it builds and mans bunkers, and an energy
`reserve` it will not spend on pushes. `aiThink()` runs in priority order:
**fireball** a cluster (`bestBlast` aims at each enemy unit in turn, pulls the
point into its own half and keeps whichever catches the most; it fires at
`aiP.spellMin` targets or more) → **counter** whatever is walking at it
(fighter against ranged, archer against tanks, placed between the lead threat
and its base) → **fortify** while quiet → **man the slits** → **push** at the
halfway line, following its own spearhead 60% of the time.

ROOKIE has `spell: 0` and never casts — massing units against it is meant to
work. PRO needs 3 in the circle, LEGEND only 2.

ROOKIE keeps `reserve: 0` and `spell: 0`, so it dribbles units out one at a
time, never masses, and never punishes you for massing — that, plus its idle chance, is what makes it beatable. An
**undefended** base falls to LEGEND in roughly 25–30 s; that is intended, and
1500 base HP is the knob if it ever needs to be gentler.

## Rendering notes

Unit silhouettes say *what*, colour says *whose* — `drawUnitShape()` takes the
side colour for the outline and the kind colour for the accent, and the same
function draws the card art, the board unit and the drag ghost, so a card can
never drift from the thing it deploys.

## Gates

- `node .claude/scripts/smoke-mobile.cjs games/neon-clash/index.html`
- `node .claude/scripts/check-games-sync.cjs`
- `.claude/tests/drive-neon-clash.cjs` (67 checks) — drives a real touch drag
  from the tray to the board, then asserts the refusal rules, the card types
  and deck order, the bunker/garrison caps, garrison ejection, a base kill
  ending the match, that the AI actually plays, and that the rotated top tray
  deploys for P2 — plus the portrait lock, where a landscape viewport must keep
  the portrait layout and a touch pushed through the view transform must still
  hit the card it covers. The siege-lock block pins the rule from both
  directions — a unit that has hit a building must not divert onto a defender
  that walks up, one merely marching at a base must, and killing the building
  must free every attacker it held. The fireball block pins every rule above to
  a number:
  90 at the centre, 45 at the rim, nothing outside the circle, nothing friendly,
  neither base, a garrison untouched while its bunker burns, knockback that
  actually shoves a unit backwards against its own march, and LEGEND answering
  a massed push with a cast of its own.

## Test hook

`window.__NC` exposes `state / energy / units / buildings / bases / matchT`
plus `deploy(side, key, fingerX, fingerY)`, `start(mode, diff)`,
`setEnergy(side, v)`, `casts`, `deck`, `kindOf(key)` and `place(side, key, x, y)`
— note `deploy` takes **finger** world coordinates, not the final spawn point,
so it exercises the same `dropOff` path a real drag does. `place` is the one
hook that bypasses the rules: it exists so a test can *arrange* a cluster and
then cast at it through the real path, never to assert placement behaviour.
