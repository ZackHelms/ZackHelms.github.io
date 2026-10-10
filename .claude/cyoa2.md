# CYOA2 - context

`games/cyoa2/index.html` (single file, ~3,250 lines). The world of CYOA played on a
**board of 5 ft squares**: a seed makes a town, its inn and trades, its houses and a
bandit cave; each place's board is **charted the first time someone walks in** and is
kept in the save from then on. CD commission, 2026-10-09 (in chat, not `/create-new-games`).
Suite: `.claude/tests/drive-cyoa2.cjs` (176 checks). Style: **Grimoire**
(`.claude/styles/grimoire.md`). **Proprietary** (`games/cyoa2/LICENSE`).

This is **step 2 of 5**. Step 1 was the map generator, the asset library, the renderer
and a token to walk. Step 2 (2026-10-10 UTC, the same sitting) is the **grid rules**:
line of sight and fog of war, a party of up to six, and rounds (initiative, 30 ft turns,
the monsters moved by whoever holds the table). There is still no Game Master model, no attack, no hit point
and no network call: a round is movement only until step 3 gives it something to do.

## CD decisions (2026-10-09, chat) - do not relitigate

- A new game, same concept as CYOA, **centred on a board of 5 ft x 5 ft tiles** dividing
  up "a town, the inside of an inn, the first part of a cave that is a bandit hideout".
- Maps are **procedurally generated**, built from **asset libraries** of things that go
  in a map *or on other things in it*. The CD's own example, which the suite asserts:
  "a 5 x 10 ft table with a flower pot on one side, and this would be two separate
  assets that get added into the room".
- Generation has **levels**: the general setting and plot threads; then NPCs, monsters,
  buildings, caves; and some things **generated on the fly** to keep the up-front cost
  down - but whatever is generated on the fly **must be documented in the save** so the
  world stays consistent (the same idea as CYOA's canon).
- **All-digital mode first**: a player token on screen, moved around, on phone or computer.
- Later: **multiplayer**, the CD's phone as the central server, other players' web apps
  connecting to it to move their own tokens on their turns.
- Later still: a **physical table** - an LCD or pixel panel showing the map, real
  tokens, real dice read automatically into the game.
- Name **CYOA2**. Hub: the **first** card, directly above CYOA. Icon 🎲.

Step 2, asked and answered before a line of it was written (three questions, the CD
took the recommended answer to each):

- **Who moves the monsters until the Game Master arrives? "You do."** On a monster's
  turn whoever holds the device moves it, or passes, as at a real table. The model takes
  those turns over in step 3; it will send the same intents.
- **How many player tokens? "A party of up to 6."** Added and named in a Party panel;
  they follow the leader while exploring and take separate turns in rounds.
- **When does turn-by-turn play start? "A button, plus a prompt."** ROLL INITIATIVE is
  on the bar at any time, and the table offers it when a hostile first sees the party.

## Assumed, not decided (flag these when the CD next looks)

None of these was asked for; each was the conservative reading. All are cheap to change.

| Assumed | Why | To change it |
|---|---|---|
| **Grimoire** style, not Neon Arcade | it is CYOA's sequel, and an inked map on vellum is what a tabletop map looks like | the page chrome is CSS tokens; the map palette is the `INK`/`WASH` constants at the top of ART |
| CYOA's chrome: no top-left back/mute, **2x reload** top-right, EXIT on the title | the CD chose these for CYOA | `#reload-btn`, `#ribbon-btn` and the header height in the CSS |
| **Proprietary** licence | it will inherit CYOA's engine in step 3, and a permissive licence cannot be taken back while a proprietary one can be opened | replace `games/cyoa2/LICENSE`, fix the "eight protected" lists |
| One accent colour per map (green town, lapis cave, vermilion indoors) | Grimoire's "one accent per picture" rule, read per map | `accentOf()` |
| The tale starts in a **guest room** of the inn | "you wake in a rented room" gives a small first board | `newGame()` |
| A walk **opens** the closed doors it passes | exploring should not be a door-tapping chore; each one is still journalled, so a GM will hear of it | `stepInfo()` returns the door; `intent('step')` opens it |
| The Chronicle's **Go** button teleports | a sandbox convenience for looking at every place | `intent({t:'jump'})`; remove the button in `UI.chron` |

Step 2 added these. The three answers above settled who, how many and when; everything
below is how I filled in the rest.

| Assumed | Why | To change it |
|---|---|---|
| Sight reaches **24 squares in the town, 16 in a lit room, 8 in the cave** | daylight, lamplight, a torch (40 ft); the town at 24 still hides what is behind a building | `SIGHT`, `sightOf()` |
| Unseen ground is **blank vellum**; ground seen and left behind is **faded**; people show only while in sight | the map "inks itself in"; a faded room reads as remembered | `paintFog()`; Settings has a **Fog of war** switch (default on) |
| Under fog **a tap only walks over ground the party has seen** | otherwise the path planner draws a route through rooms nobody has opened | the view sends `known:true` with a move; the engine honours it (`route`, `barrier`) |
| A roof, or a thing that fills its squares, **seen in part is seen whole**; a rug or a bench is not | a half-drawn hearth looks like a bug, but making a bench whole would put whoever sits at its far end in sight through a wall | `sightFaces()` |
| **Everyone moves 30 ft a turn** | there are no character sheets until step 3 | `SPEED`; make it a field on the actor |
| Initiative is a plain **d20**, ties to the party, then by id; the dice are **seeded and counted** | no modifiers exist yet; the same tale played the same way must roll the same | `d20()`, `byInit` |
| Only **bandits in sight** roll; others **join when they come in sight**; bystanders (the innkeeper, the prisoner) never take a turn | a fight is who can see whom; it keeps the order short | `intent('rounds')`, `look()` |
| **Friends may be walked past, never stopped on; nobody passes the other side or a bystander** | the 5e rule, and without it the front of a party in a 5 ft passage walls in the rest | `barrier()`, the goal rule in `route()` |
| Exploring, **only the leader is walked**; the rest trail one step a tick, change places with the leader when they meet, and **close up after the leader stops** | a party is one thing to steer until a fight makes it six | `followOn()`, the gather ticks in `intent('step')` |
| A **tap on a companion gives them the lead** (so does their counter on the bar, or LEAD in the panel) | the square they stand on can mean nothing else | `tapAt()` |
| A walk **stops when a bandit first comes in sight**, and the table asks: Carry on / Roll initiative. Each bandit is "met" **once**, and that is saved | the prompt the CD asked for; in a round nothing stops, the newcomer just joins | `look()`, `st.met`, `UI.spotted()` |
| On a **monster's turn the table shows what the monster sees** too, and none of it is remembered | the hand that moves it has to see where it can go; the party's map must not learn from it | `eyes()` in VIEW (never calls `reveal`) |
| **Nobody leaves a board, joins, leaves the party or changes leader mid-round**; opening a door in a round is free | the least surprising reading; a door is 5e's free object interaction | the `inround` refusals in `intent()` |
| Rounds **never end by themselves**; the cross on the bar stands everyone down | nothing can die yet, so nothing can decide a fight is over | `intent({t:'rounds',op:'stop'})` |
| New travellers are **named by the seed** from the given-name table | a blank name field is a chore; the name is editable | `intent({t:'party',op:'add'})` |
| **Cover is not built** | it only means something once there is an attack to apply it to (step 3) | the sight code already tells walls from windows from tall things |

## The road from here (agreed in outline, 2026-10-09)

1. **Done:** generators, asset library, renderer, a token to walk.
2. **Done:** grid rules - line of sight, fog of war, a party of six, rounds with
   initiative and 30 ft turns, monsters moved by hand. (Cover waits for attacks.)
3. The Game Master: port CYOA's engine, tools, bible and canon. The model should never do
   geometry - it gets a text digest of a room and calls grid tools (`move_token`,
   `spawn_token`, `place_object`, `reveal`); the engine validates. A token drag stays a
   local, validated move with no API call; the GM is called on triggers. Step 2 left it
   three ready seams: a monster's turn is already a turn someone else takes (`turnOf`
   says whose), `look()` already reports who has just been sighted and who has joined,
   and `route()` answers "could it walk there, and how far is it" without moving anyone.
   Character sheets, attacks, hit points and cover belong here too.
4. Multiplayer: other devices send the SAME intents; the host's engine judges them. A web
   page on an iPhone cannot use Bluetooth or host a LAN server, so the realistic route is
   WebRTC data channels with QR pairing or a small relay (assumed from general knowledge,
   not re-checked on 2026-10-09).
5. Table mode: a display-only map at a fixed physical scale, and a pluggable dice source
   (engine RNG, a typed-in physical roll, later a camera).

## Architecture (sections in the script, in order)

`UTIL / PRNG / TABLES / ASSETS / MAP / FURNISH / WORLD / SITES / ENGINE / ART / VIEW /
AUDIO / STORAGE / UI / BOOT`

- **PRNG.** `rngFor(seed, stream, n)`, as in CYOA. Streams: `world`, then `site:<id>` per
  board. Because every board draws from its own stream, **charting places in a different
  order changes nothing** (asserted over 36 worlds). `h2()` is a stable hash for the ART
  only; never use it, or `Math.random`, for anything the rules read (music may).
- **Tiers.**
  - *One, up front:* `generateWorld(seed)` -> the **bible**: region, town, inn, gang, cave,
    six key sites (S0 town, S1 inn, S2 cave, S3 smithy, S4 shop, S5 chapel), seven people
    who matter (N0 innkeeper .. N5 the chief, N6 the prisoner) and three plot threads (one
    main, two that tangle with it). Pure function of the seed; it travels in the save.
  - *Two, on the fly:* `chart(st, id)` is **the one place a board comes into being**. It
    runs a generator once, stores the board in `st.maps`, and journals it. The town
    generator also **makes up the houses** (`addSite`) and every generator makes up its
    minor people (`addNpc`), all written into the state. Ids are scoped to the site that
    made them (`S6n1`), so they do not depend on charting order either.
  - `newGame` charts only the town (it owns the lots every building is fitted to) and the
    inn the tale starts in. Everything else waits for a visitor.
- **Map model** (`newMap`). Squares carry a terrain (`t`); **edges between squares** carry
  walls, doors, windows and bars (`wn` north edges, `ww` west edges), so a wall takes no
  floor away and furniture footprints are honest. `rg` is the room each square belongs to
  (0 = outside any room). `objs` are things: `{id, a, x, y, r}`; a small thing sitting on
  another is its own object with `on: <parent id>` and a `slot`. `tokens` are people.
  `exits` join boards. `lots` (town only) are the roofs, each naming the site inside.
  `indexMap()` rebuilds the derived lookups in `m._` and must be called after any change
  to a map's contents; `m._` is never saved.
- **Movement** (`stepInfo`, `spread`, `findPath`). Eight directions, 5 ft a square, 5 ft
  a diagonal, rough things (`mv:'r'`) cost double. A diagonal may not cut a corner or
  pass a door. A closed, unlocked door can be planned through at +1; a locked one cannot.
  `spread()` is the one Dijkstra (typed-array heap; `m._.free` and `m._.cost` are cached
  by `indexMap`): with goals it is `findPath`, with none it is a distance field, which is
  what the reach of a turn and the party's trailing are both read from.
- **Sight** (`sightFrom`, `sightFaces`, `reveal`, in MAP). The eye is at the middle of its
  square and casts lines at the ring of squares at the edge of its range, two or three
  to a square; **every square a line enters is in sight**. Walls and shut doors on the
  EDGES stop a line; windows, bars and open doors do not; rock, a roof and anything
  `tall` are seen and stop it. A line that passes **exactly through a corner** goes on
  only if BOTH ways round the corner are clear: the permissive rule let it through the
  crack where two roofs touch corner to corner (found by the suite's independent judge).
  `sightFaces` then adds the rock face or eaves beside any open ground in sight and
  makes roofs and blocking things whole (only ever squares nobody can stand on). `reveal` folds sight into `m.seen` (kept, saved), plus a
  second ring of cave rock wherever that gives away no unseen floor.
- **Furnisher** (`Furnisher`, `ROOMS`, `TOPS`). Fills a room from its recipe. Three rules
  a hand would follow: a thing with a back goes **against a wall** (`at:'wall'`), nothing
  stands on a **gate** (a square a room is entered by), and nothing that blocks may leave
  the room in two pieces (`F.whole`, checked twice: with people passable so nobody is
  walled in, and with people blocking so nobody plugs the only way through). Set pieces a
  plain rule cannot say are functions in the recipe: `fnBar`, `fnCounter`, `fnPews`,
  `fnCell`.
- **Sites.** `genTown` (road, lane, square, lots, pond, trees; proves every door and the
  trail reachable), `genBuilding` (an interior exactly the size of its lot, door on the
  lot's side: the inn has a set plan, everything else is split by `bspRooms` and joined by
  a spanning tree of doors), `genCave` (chambers on a loose lattice, wandering passages,
  one smoothing pass, cropped to fit; roles go by depth: guard post first, the chief last;
  a locked cell is cut into the rock; a gate goes where the passage to the chief narrows).
- **Engine.** `intent(st, it)` is the only door. Each intent validates completely, a
  refusal changes nothing and returns `{ok:false, why, say}`, and each accepted change is
  journalled (`st.log`, capped at 400).
  - *Nobody's turn in particular:* `party` (`add` / `drop` / `name`), `lead`, `rounds`
    (`start` / `stop`).
  - *One actor's:* `move`, `step`, `halt`, `door`, `end`, `travel`, `jump`. **`turnOf(st)`
    says who may act**: the leader while exploring, whoever's turn it is in a round (a
    monster, on a monster's turn). An actor is `{id, pc, o, m}`; `o` is the party member
    or the token itself. `who` may be left out; if given and wrong the refusal is
    `notlead`, `notturn` or `nobody`.
  - **`route(st, a, goals, known)` is the one planner** and changes nothing: the table
    asks it for a preview and `move` asks it for the walk, so they cannot disagree.
    `barrier()` is who stands in whose way; `reachOf()` is every square `route` would
    still accept this turn (the suite asserts the two agree square for square).
  - A walk is a queue the host's clock advances one `step` at a time. Exploring, each
    step also runs `followOn` (the party trails), and after the last square the walk
    lasts a few more ticks while stragglers close up. In a round a step spends feet
    (`R.moved`). What the walker meant to do on arriving comes back as `next` on the
    final step and is asked for separately, after the token has visibly arrived.
  - **`look(st)` runs after anything that moves anyone or swings a door.** It works out
    what the party sees now (derived, in a `WeakMap`, never saved), folds it into
    `m.seen`, records bandits met for the first time (`st.met`, reported as `spotted`)
    and, in a round, rolls newcomers into the order (`joined`) without losing the turn
    in hand.
  - A round is `st.round = {n, site, order:[{id, k, roll}], i, moved}`. Dice are
    `d20(st)`: seeded by the tale, counted in `st.n.roll`.
- **Saves.** `packState` / `unpackState`, format `v: 2`. A save is the whole state: bible,
  sites, people, every charted board (byte grids as strings, **`seen` included**), the
  party and who leads, a round in progress, who has been met, the journal. **Loading
  never calls a generator** (asserted with all three stubbed to throw). `unpackState`
  treats a file as untrusted: it rebuilds every map field by field and drops what does
  not fit; the party comes back as at most six, each with an id of their own, all on the
  leader's board; a round keeps only combatants who exist. A v1 save (no fog) loads: the
  party simply has not seen anything yet beyond where it stands. IndexedDB `cyoa2/saves`
  slot `auto`, localStorage then memory as fallbacks; export and import are the same JSON.
- **Art.** An inked map: line, sepia washes, hatching for rock, one accent per map.
  `paintMap(g, m, R, opt, names)` paints everything still for a range of squares, in
  units of squares; `ART[id]` is one painter per asset, drawn back-to-north in its own
  footprint. Doors and tokens are painted live (`paintDoor`, `paintToken`). Text goes
  through `mapText`, which drops to pixel space so it stays crisp. `vertexFn(m)` is the
  nudged corner every painter of squares shares; `paintEdge` is one wall, window or
  door frame; **`paintFog(g, m, R, seen, vis)` is laid over the bitmap live**: blank
  vellum over the unseen, a half wash over the remembered, and the walls that bound the
  known inked again on top so a room keeps its whole outline.
- **View.** A full-map bitmap (`bakeBase`, capped at ~4 MP) is blitted every frame; when
  the camera rests, the part on screen is repainted at exact device pixels (`bakeSharp`).
  Both are keyed by `bakeKey` (map, grid, footprints, fonts loaded); **fog is not baked**,
  so walking never repaints a bitmap. The canvas is sized from its own
  `getBoundingClientRect()` and taps are read from the same box. Fingers go through touch
  events; the mouse is a separate path. The table speaks for one **`actor()`** (the
  engine's `turnOf`); `eyes()` is what it shows (the party's sight, plus the monster's on
  a monster's turn); `reach()` is the gold wash of squares still in reach; `visual()`
  slides every piece that moved on a step. While the camera moves the bitmap is
  stretched with `imageSmoothingQuality = 'low'`: at 3x the fine stretch held a walking
  party at 83 ms a frame in headless Chromium, the cheap one at 16.7 (rAF deltas, six
  walking through the town, 2026-10-10; the fog itself cost nothing measurable).
- **UI.** The bar over the board (`UI.bar`) is the party as counters while exploring (the
  dashed one opens the Party panel) and the initiative order in a round, each counter
  with its roll, beside ROLL INITIATIVE or END TURN and the cross. The header's second
  line becomes `20 ft left · name · round 2` in a round, feet first because that is what
  a narrow screen must not truncate. In landscape on a phone the bar shares the header's
  row.

## Rules that are easy to break

- **Never `innerHTML` anything from a save.** `el()` sets `textContent`; the map uses
  `fillText`. A loaded file is untrusted and the suite loads one full of markup.
- **A generator's output is part of the save format's promise, not the save itself.**
  Changing a generator changes what NEW seeds chart, never an old save - but it does
  change what an old save charts NEXT. Bump `GEN_V` when output changes; it is stamped on
  every board and journalled.
- **Adding an asset** is one `asset(...)` row, one `ART[id]` painter, and a line in a
  `ROOMS` recipe (or a generator). The suite fails on a row with no painter, a painter
  that leaves no ink at any of the four turns, and an asset nothing ever places.
- **A token is placed through `F.token`**, never pushed onto `m.tokens`, or the
  wholeness check does not see it. Same for things: `F.put`.
- **`plan()` answers "what does a tap here mean" for both the hover preview and the
  tap.** Do not give the preview its own copy.
- **Anything that hides the board must re-measure on the way back** (`UI.closePanels`
  calls `viewMeasure`): a hidden canvas measures as nothing.
- `View.sharpFor` stops the sharp repaint from being retried every frame when the
  visible region is too big to bake; set `View.moved` when something invalidates it.
- **Call `look(st)` after anything that moves a piece or swings a door**, and move a
  token only through `moveToken()` (the lookup in `m._.tok` follows it). Sight that is
  one step stale shows as a bandit who is not there.
- **`eyes()` must never call `reveal`.** The monster's view is for the hand that moves
  it; the suite sets a bandit down on unseen ground and requires `m.seen` not to grow.
- **Do not give the preview, the reach wash or the keys their own idea of where an actor
  may go.** All three ask `route()` / `reachOf()` / `barrier()`.
- **The camera's easing must end when the edge of the board holds it short of its
  target**, not only when it arrives: otherwise it "moves" forever, `View.moved` is
  refreshed every frame and the sharp repaint never happens (found 2026-10-10; it had
  been latent in step 1's recentre button on any board smaller than the screen).
- **A test must wait for the camera before aiming a tap after a turn changes** (`settle`
  in section P): the table eases to whoever acts, and a screen position worked out
  mid-ease is a different square by the time the finger lands.
- The ribbon (z 69) stays under the panels (z 70); the reload button (z 90) stays above.

## Tests

`drive-cyoa2.cjs` (176 checks, about 100 s) runs the generators inside the real page
across 36 worlds (329 boards) and asserts they are whole, then the engine's refusals,
lazy charting, saves (including a tampered file), the phone flow, tap accuracy at five
viewports after a resize-while-hidden, gestures, keys and the panels (sections A to M,
step 1), then **N sight and fog, O the party, P rounds** (step 2). `CYOA2_ONLY=NOP`
runs only the named sections (A stands for A to I); it is for negative tests and never
prints the GREEN line a gate looks for.

Section N judges the engine's sight with **an independent judge**: a line walked in
fiftieths of a square that shares no code with the ray march. *Sound:* every square shown
has some clear line to it. *Complete:* every square plainly in view is shown. That judge
found the corner crack described under Sight. Its first version also "found" 35 squares
that were really the judge's own sample points being too coarse near a square's edge:
before believing an oracle, look at what it flags.

### Negative tests, step 2 (2026-10-10, `negtest-batch.py`)

Sixty-one deliberate breaks aimed at sections N, O and P. Fifty-eight went red at once.
Three came back GREEN, and all three were holes in the suite:

- *The game's Enter key removed.* The row tapped END TURN and then pressed Enter, and
  the tap had left the button focused: Enter on a focused button presses it whatever the
  page does. The row now takes the focus away first.
- *The monster's view folded into the party's memory.* The row compared `m.seen` before
  and after, but the bandit it happened to test could see nothing the party had not
  already seen. It now sets the bandit down on unseen ground for the comparison.
- *A bench made whole* (its unseen end lent to sight, and whoever sits there with it).
  The row compared sight with the bare lines at five moments, none of which had a
  part-seen bench in it. It now looks for one from every square of an inn (35 found).

The second and third are one mistake: **a row that waits for its sharp case to turn up
is not a row. Construct the case, or search for it and fail if there is none.**

Then step 1's sixteen breaks were run again, because step 2 had changed the rows they
aim at. **Two that used to be caught were now missed**, which is the more useful find:

- *A 7% skew in the tap mapping.* The row taps the free square furthest from the middle
  of the screen. The new bar made the board 56 px shorter, the furthest square came
  closer, and a tap at its middle forgave the error. The row now taps a tenth of a
  square inside the far corner (and, on one turn, the near corner).
- *The last finger of a pinch counted as a tap.* Under fog that stray tap landed on
  unseen ground and walked nobody whatever the gesture code did. Section L now lifts the
  fog by its own setting; K does too, for the same reason.

The lesson is the one already in `.claude/tests/README.md`, with a new edge: **a feature
that adds a refusal quietly disarms every older row whose proof was "and nobody
walked"**. Re-run the old breaks when a new rule can refuse.

### Negative tests, step 1 (2026-10-09)

Sixteen deliberate breaks. Fourteen went red at once. Two came back GREEN and each was a
hole in the suite, not in the game:

- *The path planner ignoring a locked door.* The check walked "into the cell", but the
  cell's one square has the prisoner on it, so the move was refused as occupied whatever
  the lock did. It now lifts the prisoner off first and requires `noway`.
- *The key handler's focus check removed.* The only text field sits behind a panel, and
  an open panel already stops the board's keys, so the check could not fail. A second
  row now types into a field placed on the board itself.

`check-canvas-space.cjs` reports `CANVAS=FLAG id=frontis` on this page. That is the title's
picture (never hit-tested) being squeezed by the probe's own forced `max-height`; the
probe cannot see `#map` at all because its screen is hidden at load. The question it
exists to ask is answered for the map by section K of the drive suite.

**Not verified here:** everything above ran in headless Chromium. Nothing has been tried
on a real iPhone: pinch and pan under Safari's gesture recognizer, the audio unlock on
the first tap, and saving a file through the share sheet are the three to check first.
For step 2 add: whether the bar's counters scroll comfortably under a thumb with six in
the party plus bandits, and whether a walk holds 60 fps on the phone itself (the frame
times above are headless and software-rendered, a rough proxy).

## Follow-ups (not built)

Save slots beyond the autosave; a second floor behind the inn's stairs and a cellar; a
way into the locked cell (a key in the chief's chest is the obvious one); locked doors in
buildings; a road beyond the town's east and west ends; more site kinds (mill, watch
house, crypt); weather and time of day.

From step 2: bystanders who move (a town that goes about its day); a marching order the
player sets, instead of nearest-first; dashing and difficult ground beyond furniture;
light sources carried and put out (the cave's 8 squares is "someone has a torch");
stealth, so that being in sight and being noticed are two things; a "last seen here"
ghost for a bandit who walks out of sight; the dice as a pluggable source for the
physical table (the engine's `d20` is the only place a roll is made).
