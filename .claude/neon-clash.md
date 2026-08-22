# Neon Clash — Context

`games/neon-clash/index.html` (single self-contained file, ~1350 lines).
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

## Economy and the deck

Energy refills at **1/sec, cap 20**, both sides, starting at 5. At
`SUDDEN_AT` (180 s) regen doubles and damage dealt *to bases* doubles;
`MATCH_LIMIT` (300 s) awards the match on remaining base HP.

| Card | Cost | HP | Dmg | Rate | Range | Speed |
|---|---|---|---|---|---|---|
| Tank | 4 | 260 | 12 | 1.0/s | 6.5 | 8.5 |
| Archer | 3 | 70 | 20 | 1.0/s | 26 | 9 |
| Fighter | 3 | 130 | 16 | 2.0/s | 6 | 13 |
| Bunker | 8 | 600 | — | — | — | stationary |

Read as the spec's shape: tank = high HP / low damage / average everything
else; archer = low HP / average damage / long reach; fighter = average HP and
damage but double attack rate and the fastest legs; bunker = a building.

## Deployment rules (`dropInfo` / `tryDeploy`)

A drop is legal when the **finger** is on that player's own half. The ghost
sits `DRAG_OFF` (9 world units) ahead of the finger toward the opponent and is
then *clamped* into the half — so dragging to the halfway line deploys at the
line rather than failing. Refusals set `flash[side + ':' + kind]` (a 0.45 s red
card pulse) and, except for the "wrong half" case, play the deny sting:

| reason | when |
|---|---|
| `half` | finger is on the opponent's side |
| `energy` | cost exceeds current energy |
| `max` | already two bunkers on that side |
| `blocked` | bunker would overlap a base (`BASE_CLR`) or another bunker |
| `full` | dropping a unit on a bunker that already holds two |

`aiDeploy(key, x, y)` backs the point out by `DRAG_OFF` and goes through
`tryDeploy` — the AI obeys exactly the rules the player does, including cost
and half checks. There is no AI-only placement path.

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

Melee applies damage instantly plus a `slash` arc; ranged pushes a homing
`shot` that resolves on arrival (and fizzles if its target dies first).
`separate()` is an O(n²) soft push that also shoves units out of bunker radii
and base footprints. `UNIT_CAP = 16` per side bounds it.

## AI

`AIS[ROOKIE|PRO|LEGEND]` tunes think interval, an idle/skip chance, how often
it answers a threat, whether it builds and mans bunkers, and an energy
`reserve` it will not spend on pushes. `aiThink()` runs in priority order:
**counter** whatever is walking at it (fighter against ranged, archer against
tanks, placed between the lead threat and its base) → **fortify** while quiet
→ **man the slits** → **push** at the halfway line, following its own spearhead
60% of the time.

ROOKIE keeps `reserve: 0`, so it dribbles units out one at a time and never
masses — that, plus its idle chance, is what makes it beatable. An
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
- `.claude/tests/neon-clash-drive.cjs` — drives a real touch drag from the
  tray to the board, then asserts the refusal rules, the bunker/garrison caps,
  garrison ejection, a base kill ending the match, that the AI actually plays,
  and that the rotated top tray deploys for P2 — plus the portrait lock, where
  a landscape viewport must keep the portrait layout and a touch pushed through
  the view transform must still hit the card it covers.

## Test hook

`window.__NC` exposes `state / energy / units / buildings / bases / matchT`
plus `deploy(side, key, fingerX, fingerY)`, `start(mode, diff)` and
`setEnergy(side, v)` — note `deploy` takes **finger** world coordinates, not
the final spawn point, so it exercises the same `DRAG_OFF` path a real drag does.
