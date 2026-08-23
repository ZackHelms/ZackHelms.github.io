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

Bases sit at `(50, 150)` and `(50, 10)` — an armoured pedestal with a **turret**
whose barrel tracks its target, 1500 HP. They are still the only win condition,
but they are no longer passive: see *The base turret*. (Until 2026-08-22 they
were drawn as an endzone goalpost with no attack; the goalpost read as scenery,
which stopped being true the moment the base fought back.)

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

Energy refills at **1/sec, cap 20**, both sides, starting at 5.

**Sudden death is a ramp, not a switch** (2026-08-23). At `SUDDEN_AT` (180 s)
both sides gain **+1 energy/sec**, and another +1 every `SUDDEN_STEP` (60 s)
after — 2/s at 3:00, 3/s at 4:00, up to the ceiling of **8/s at 9:00**, where
a full bar of 20 refills in two and a half seconds. `MATCH_LIMIT` is **600 s**
and awards the match on remaining base HP. Damage dealt *to bases* still
doubles once at 3:00 and does not keep doubling: energy is the escalating
pressure, not raw damage, because a damage ramp just ends matches early
whereas an energy ramp makes both players do more.

`suddenTier(t)` is capped at `SUDDEN_TIERS` on purpose. `matchT` keeps ticking
for a frame or two past the wall while the finale starts, and an uncapped tier
printed `+9/S` on a game whose top rate is 8.

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

### Two ways to deploy

Both idioms run through **one** drag record, so there is no mode to get stuck
in and no second code path to keep in sync:

- **Drag** a card from the tray onto the board and release.
- **Tap** a card to *arm* it (`sel[side] = kind`, white border + pulsing dashed
  ring), then tap the board to place it. Tapping the armed card again disarms.

`pointDown` starts a drag for any card touch and marks it `tap: true`;
`pointMove` clears that flag once the finger travels past `TAP_SLOP` (10 px);
`pointUp` reads the flag — still a tap → arm/disarm, otherwise → deploy. A
touch that starts on the **board** belongs to whichever player has a card
armed (`armedFor`), preferring the player whose own half the finger is over;
in 2p that fallback is what lets an armed card be tapped down across the line.
A successful deploy clears `sel[side]`; a refused one keeps it, so a card you
could not afford yet is still armed a second later.

### The one input rule that differs

`dropOff(k)` is `0` for a spell and `DRAG_OFF` for everything else. A unit's
ghost sits ahead of the finger so your thumb does not cover the thing you are
placing; a **spell lands exactly where you tap**, because you are aiming a
circle wide enough to sight down and the brief says the blast is centred on
the tap. The dashed blast ring in `drawDrags` is drawn at `k.blast`, so the
preview is the cast. `aiDeploy` backs its aim point out by `dropOff(KINDS[key])`
rather than a constant, which is what keeps the AI on the player's rules.

## Deployment rules (`dropInfo` / `tryDeploy`)

A drop is legal **anywhere on the board** — one rule for every card type. The
ghost sits `dropOff(k)` ahead of the finger toward the opponent (`DRAG_OFF` = 9
world units for units and buildings, **0 for spells**) and is then *clamped*
into that player's own half by `clampToHalf`.

**The border rule.** Aiming past the halfway line does not refuse the card: it
lands on **your** side of the line at the **same x**. A bad aim costs you
position, never the card — which is what makes tap-to-place safe to offer on a
phone, where the finger covers the target. Only a release that is off the board
entirely (over a tray, outside the frame) cancels, and that silent cancel is
the deliberate "change my mind" gesture — it is the reason `off` is the one
refusal that does **not** play the deny sting.

Refusals set `flash[side + ':' + kind]` (a 0.45 s red card pulse):

| reason | when | applies to | deny sting |
|---|---|---|---|
| `off` | released off the board (tray, outside the frame) | every card | no — silent cancel |
| `energy` | cost exceeds current energy | every card | yes |
| `max` | already two bunkers on that side | buildings | yes |
| `blocked` | bunker would overlap a base (`BASE_CLR`) or another bunker | buildings | yes |
| `full` | dropping a unit on a bunker that already holds two | units | yes |

A **spell can only ever be refused for `off` or `energy`** — it has no
footprint to block, no cap to hit, and it must not garrison a bunker it is
dropped on. That last one is the easy bug: the garrison branch lives in the
`else` of the type test, so any new spell gets it right for free, but a card
that forgets its `type` will silently try to walk into a building.

`aiDeploy(key, x, y)` backs the point out by `dropOff(KINDS[key])` and goes
through `tryDeploy` — the AI obeys exactly the rules the player does, including
cost and the border clamp. There is no AI-only placement path.

### Buildings slide, they do not get refused (added 2026-08-23)

The border rule applied to **footprint** instead of side. A building aimed
where it cannot stand — over the emplacement (`BASE_CLR` = 18 plus both radii),
onto a bunker already there, or into an edge — slides to the nearest legal
ground via `nearestSpot()` instead of being refused. Same reasoning as the
border rule, with more at stake: a bunker costs 8, and losing the most
expensive card in the deck to a thumb is the worst version of that mistake.

`nearestSpot()` rings outward in 2-unit steps and takes the closest legal
candidate on the first ring that has one, so the answer is always near the aim
and never a jump across the board. It is **approximate on purpose**: candidates
outside the half are clamped back onto it, so a clamped point can land nearer
than the ring it came from. The error is a couple of world units on a 100x160
board, well under what a thumb aims to, and the alternative is a real distance
transform for a case the player just experiences as "it went where I meant".

Two things this deliberately does **not** change: releasing off the board still
cancels (that is the change-my-mind gesture, and it is why the drive suite aims
a corner case at `(1, 159)` rather than `(-20, 178)`), and the two-bunker cap
still refuses outright — `max` is checked before the slide, since sliding a card
you are not allowed to play would be nonsense. `blocked` now means the whole
half has no room, which is why its caption reads NO ROOM ON YOUR HALF.

## Spells are lobbed (added 2026-08-23)

**Every spell** leaves the caster's own base, arcs up out of the screen, and
lands `SPELL_FLIGHT` (**2 s**) later. That is the contract for every spell
added from here on, which is why it lives next to the `type === 'spell'` branch
in `tryDeploy` and not inside `castSpell`: `launchSpell()` puts a shell in
`spells[]`, `stepSpells()` flies it, and `castSpell()` — untouched — is what
resolves on landing. A cast counts in `casts[]` at **launch**, because a cast
is the act, not the landing.

The gameplay consequence is deliberate and is the thing to weigh if this is
ever tuned. A fighter covers ~26 world units in two seconds, nearly **twice**
the fireball's 14-unit blast, so a spell no longer lands on a mover unless you
lead it. What it does still land on is anything standing still — and the
**siege lock** is precisely what makes attackers stand still. Fireball stops
being a panic button and becomes the answer to a push that has already
committed. The AI aims at where units are *now*, not where they will be; that
is the same naive aim a player starts with, so it degrades symmetrically.

A shell in the air when the match ends is **cancelled, not resolved**
(`endMatch` clears `spells`), so a match cannot be decided after it is over.

Drawing it takes three marks and needs all three: a dashed **landing ring**
that says where, a closing inner ring that says how soon, and a **ground
shadow** under the shell. Without the shadow a shell lifted up the screen reads
as a shell that will land further up the screen. The first draft also scaled
the shell so hard at apex that it covered the very landing zone it was
telegraphing — hence `SPELL_GROW` 1.0 against `SPELL_LIFT` 23, the rise doing
the "coming at you" work rather than the size.

## The finale (added 2026-08-23)

A razed base decides the match instantly, but the result screen waits
`FINALE_T` (**3 s**). `state` becomes `'finale'`: the board is frozen, the
losing base is blown apart on an accelerating cadence, fireworks go off over
the winner's half, and the winning units bob on the spot.

Everything that **decides** happens on entry to the finale — `winner`, and a
`finalHp` snapshot. That snapshot is load-bearing: the loser's base is zeroed
at 80% through the animation so it renders as rubble, and without the snapshot
a *time-limit* win would report `RED BASE 0` for a base that finished with
hundreds of HP. Because nothing is decided during it, the whole thing is safe
to skip, and a tap does exactly that (`pointDown` → `finishMatch`).

A dead-level draw skips the finale entirely — there is nothing to raze.

## Music (5 tracks, added 2026-08-23)

`TRACKS[]` holds five: PROTOCOL (100 bpm), OVERCLOCK (126), IRONWORKS (92),
NIGHTRUN (116), LAST STAND (138). Each is two bars of bass and lead
(32 sixteenths) plus one bar of drums as 16-character strings, written as
**note names** through `seq()`/`nt()` rather than arrays of decimals — a
pattern nobody can read is a pattern nobody will ever edit. `pickTrack()` runs
per match and never repeats the track just played.

**Tempo tracks the energy rate**, so the music accelerates exactly when the
game does: `tempoMul()` is `1 + 0.1 * (regenRate(matchT) - 1)`, capped at
`TEMPO_CAP` 1.6. The cap is not cosmetic — past ~1.6x the sixteenths stop
reading as a groove and start reading as a buzz, and a phone still has to
schedule every node. `musicSchedule()` reads the tempo **fresh each step**
rather than caching it, so a ramp step lands within a breath of the banner
announcing it; the 0.3 s scheduling horizon is what makes that automatic and
is why there is no explicit "retune" call anywhere.

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

### The base turret

Each base mounts one turret: **two archers' damage a shot** (`BASE_GUN.dmg =
KINDS.archer.dmg * 2`), on an archer's cadence, at an archer's range. It is
written in *archer units* on purpose — the spec was "two archers per shot at an
archer's speed and range", and a later archer rebalance should carry the base
with it rather than silently decoupling.

Three rules, each load-bearing:

- **Reach is measured from the base's rim** (`gunReach = edgeDist(u, bs)`, i.e.
  `hypot - bs.r`), which is exactly how an archer measures its own shot *at*
  the base. Measure it the other way (`edgeDist(bs, u)`, from the unit's rim)
  and the envelope shrinks by `bs.r` — 7 world units short of an archer
  besieging it, so the one unit the turret exists to answer would sit safely
  outside it. Same envelope both ways is the only playable reading. The reach
  ring in `drawBaseReach` is drawn at `range + bs.r` for the same reason.
- **It shoots units only.** A bunker can never be built inside an enemy base's
  reach (the halves do not come close enough), and a base that could shoot a
  besieger's *building* would be answering the siege lock with a rule of its
  own.
- **A garrison is shielded from it**, as from everything else — the `u.home`
  skip is shared with `pickTarget`, not re-implemented.

Balance intent: a **lone** unit that walks up to a base now loses to the base.
40 damage a second kills an archer in two shots and a fighter in four, so
trickle attacks stop working entirely, while a massed push still gets through
(the turret focuses one target at a time). This is also the counterweight to
the siege lock, which is otherwise purely defender-favourable. Knobs, in the
order to reach for them: `BASE_GUN.dmg`'s archer multiplier, then `rate`, then
`range` — the multiplier is the one the spec named, so change it consciously.

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

## Graphics styles (added 2026-08-23)

Two art directions over **one** simulation, chosen from the cogwheel in the
top-left HUD cluster (`#cog-btn`, sitting alongside back / mute / new — all
four were narrowed to 34 px together so the row would not push the title out
of `#hud-mid`).

| | |
|---|---|
| `toon` | **the default.** Cel-shaded cartoon: dirt arena, grass verge, plank fence, characters |
| `neon` | the original: dark board, grid, glowing wireframe silhouettes |

The picker is a native `<select>` (`#skin-sel`), not a pair of buttons — which
is why it is wired to its `change` event and deliberately **not** through
`bindTap()`: that helper's `touchend` handler swallows the native picker.

**The invariant that makes this safe:** *a skin is paint.* Nothing in `step()`
knows a skin exists, so switching mid-match cannot change an outcome — the
drive suite asserts stats, costs, ranges, energy and an actual deploy come out
byte-identical under both. Keep it that way: if a skin ever needs to know a
number, that number belongs in the sim, not in the painter.

**Cel shading here means exactly two things and nothing else:** flat colour
steps (never a gradient) and one heavy ink outline per shape. `cel(path, fill,
shade, lw, cx, cy)` is that rule made callable — it fills, clips one hard-edged
shade half-plane through `(cx, cy)`, and inks the outline. `inkStroke()` is the
same idea for line-like parts (a bow limb, an arrow shaft) which have no
interior to clip into. Two details worth not undoing:

- **The shade is counter-rotated out of the sprite's frame** (`frameRot()`
  reads the rotation back off the live transform). A sprite that drags its own
  shadow round as it turns to face a target is the single tell that reads as
  flat shapes rather than lit shapes.
- **`glow()` is a no-op when the skin has no bloom.** One switch kills every
  halo in the game rather than a branch at thirty-odd call sites, so a new
  effect written in the neon idiom is automatically right in both skins.

**Team identity moves under the feet.** Under toon a silhouette says *what* and
no longer says *whose* — a knight is a knight in both colours, and the rogue's
cloak is dark red (`#7c1a2a`, deliberately far from the red team's `#ff2244`)
even on the green team. So each unit stands on a thin team-coloured ground
ring: the one mark that survives every facing, the white hit flash, and being
read at arm's length. It is sized to read as a base ring and not a halo —
thicker and a knot of four units becomes one puddle of team colour with limbs.
Tray cards pass `plain` to suppress it, since a card already carries its side
in its border and its tray.

**Scenery is baked once from a fixed seed** (`buildScene()`, mulberry32) and
never touched again: dirt patches, pebbles, the ragged grass boundary, the
grass blades, and every fence plank with its tilt, its knot and whether it is
missing or broken. Re-rolling per frame would make the arena boil, and nothing
about it could ever be asserted. Two properties the generator owes the game:
the fence leaves a **gateway** where each base stands (planks within
`BASE_HW + 2.5` of centre on the horizontal edges are dropped, so a fort does
not grow out through solid timber), and the vertical edges keep *some* missing
planks — "poorly maintained" is a property of the place, not an effect.

The toon base is a **fort**: team-coloured battlements behind a masonry wall,
timber corner towers flying pennants, and the same turret geometry the neon
base draws (hub at `dir * BASE_GUN.hub`, barrel out to `BASE_GUN.barrel`), so
the turret's reach reads off the picture identically in both skins. It went
through a rounded-box-plus-seams draft that read unmistakably as a metal drum;
the crenellations are what fixed it. The team colour lives on the battlements
rather than as a band on the back wall, because a coloured bar there sat
exactly where `hpBar()` draws and read as a second health bar.

Chrome (tray, cards, page background) differs only by palette, so it reads from
`THEME[skin]` instead of growing a second copy of the layout code.

Opening settings sets `paused`, which gates `step()`. This is a real-time game:
a menu you have to read while your base is being hit is not a menu. The panel
stacks *above* the other overlays (`z-index: 78`) rather than replacing them,
so closing it reveals the title, the field manual or the result with no state
to restore.

## Gates

- `node .claude/scripts/smoke-mobile.cjs games/neon-clash/index.html`
- `node .claude/scripts/check-games-sync.cjs`
- `.claude/tests/drive-neon-clash.cjs` (116 checks) — drives a real touch drag
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
  a massed push with a cast of its own. The border block pins the clamp both
  ways (own x kept, own side of the line, symmetric for side 1, and a spell too),
  and the tap block drives real `TouchEvent`s to prove a stationary card touch
  arms rather than deploys. The turret block asserts the archer-derived stats
  and then the envelope: an archer placed at the exact edge of *its* reach on a
  base must take fire. Note the two blocks that measure a **moving** subject —
  the border check uses a bunker (a unit drifts off the border inside the
  round-trip) and the envelope check uses a slow tank and a 300 ms window,
  because the subject marches into the envelope on its own.
  The skins block asserts the cog's box against every other top-left box
  (pairwise, from real `getBoundingClientRect()`s — the brief was that it must
  not overlap what is already there), that opening settings stops the clock and
  closing it restarts it, that the choice reaches `localStorage`, that scenery
  is the same object frame to frame, and the load-bearing one: a full board of
  every card type renders in **both** skins, sampled off the canvas to prove
  toon paints dirt where neon paints void.

## Test hook

`window.__NC` exposes `state / energy / units / buildings / bases / matchT`
plus `deploy(side, key, fingerX, fingerY)`, `start(mode, diff)`,
`setEnergy(side, v)`, `casts`, `deck`, `kindOf(key)`, `sel`, `gun`, `shots`,
`skin`, `setSkin(name)`, `paused`, `scene`, `spells`, `flight`, `settle()`,
`regen`, `tier`, `finaleT`, `finaleLen`, `winner`, `tracks`, `track`, `tempo`
and `place(side, key, x, y)`
— `settle()` lands every shell in the air through the real `castSpell` path, so
the fireball *rule* checks are not each paying two seconds of wall clock; the
flight itself is pinned by its own block.
— note `deploy` takes **finger** world coordinates, not the final spawn point,
so it exercises the same `dropOff` path a real drag does. `place` is the one
hook that bypasses the rules: it exists so a test can *arrange* a cluster and
then cast at it through the real path, never to assert placement behaviour.
