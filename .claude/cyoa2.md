# CYOA2 - context

`games/cyoa2/index.html` (single file, ~2,560 lines). The world of CYOA played on a
**board of 5 ft squares**: a seed makes a town, its inn and trades, its houses and a
bandit cave; each place's board is **charted the first time someone walks in** and is
kept in the save from then on. CD commission, 2026-10-09 (in chat, not `/create-new-games`).
Suite: `.claude/tests/drive-cyoa2.cjs` (98 checks). Style: **Grimoire**
(`.claude/styles/grimoire.md`). **Proprietary** (`games/cyoa2/LICENSE`).

This is **step 1 of 5**. There is no Game Master model in it yet, no combat and no fog:
it is the map generator, the asset library, the renderer and a token you walk around.

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

## The road from here (agreed in outline, 2026-10-09)

1. **Done:** generators, asset library, renderer, a token to walk.
2. Grid rules: speed and turns, line of sight, fog of war, cover. `tall` on an asset and
   the WINDOW/BARS edge codes are already there for the sight rules.
3. The Game Master: port CYOA's engine, tools, bible and canon. The model should never do
   geometry - it gets a text digest of a room and calls grid tools (`move_token`,
   `spawn_token`, `place_object`, `reveal`); the engine validates. A token drag stays a
   local, validated move with no API call; the GM is called on triggers.
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
- **Movement** (`stepInfo`, `findPath`). Eight directions, 5 ft a square, 5 ft a diagonal,
  rough things (`mv:'r'`) cost double. A diagonal may not cut a corner or pass a door. A
  closed, unlocked door can be planned through at +1; a locked one cannot.
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
- **Engine.** `intent(st, it)` is the only door: `move`, `step`, `halt`, `door`, `travel`,
  `jump`. Each validates completely, a refusal changes nothing and returns `{ok:false,
  why, say}`, and each accepted change is journalled (`st.log`, capped at 400). A walk is
  a queue the host's clock advances one `step` at a time, so a blocked square stops it
  honestly. What the walker meant to do on arriving comes back as `next` on the last step
  and is asked for separately, after the token has visibly arrived. Intents carry `who`;
  `st.party` is a list of one for now.
- **Saves.** `packState` / `unpackState`. A save is the whole state: bible, sites, people,
  every charted board (byte grids as strings), the party, the journal. **Loading never
  calls a generator** (asserted with all three stubbed to throw). `unpackState` treats a
  file as untrusted: it rebuilds every map field by field and drops what does not fit.
  IndexedDB `cyoa2/saves` slot `auto`, localStorage then memory as fallbacks; export and
  import are the same JSON.
- **Art.** An inked map: line, sepia washes, hatching for rock, one accent per map.
  `paintMap(g, m, R, opt, names)` paints everything still for a range of squares, in
  units of squares; `ART[id]` is one painter per asset, drawn back-to-north in its own
  footprint. Doors and tokens are painted live (`paintDoor`, `paintToken`). Text goes
  through `mapText`, which drops to pixel space so it stays crisp.
- **View.** A full-map bitmap (`bakeBase`, capped at ~4 MP) is blitted every frame; when
  the camera rests, the part on screen is repainted at exact device pixels (`bakeSharp`).
  Both are keyed by `bakeKey` (map, grid, footprints, fonts loaded). The canvas is sized
  from its own `getBoundingClientRect()` and taps are read from the same box. Fingers go
  through touch events; the mouse is a separate path.

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
- The ribbon (z 69) stays under the panels (z 70); the reload button (z 90) stays above.

## Tests

`drive-cyoa2.cjs` runs the generators inside the real page across 36 worlds (329 boards)
and asserts they are whole, then the engine's refusals, lazy charting, saves (including a
tampered file), the phone flow, tap accuracy at five viewports after a resize-while-hidden,
gestures, keys and the panels.

Negative-tested 2026-10-09 with `negtest-batch.py`: sixteen deliberate breaks. Fourteen
went red at once. Two came back GREEN and each was a hole in the suite, not in the game:

- *The path planner ignoring a locked door.* The check walked "into the cell", but the
  cell's one square has the prisoner on it, so the move was refused as occupied whatever
  the lock did. It now lifts the prisoner off first and requires `noway`.
- *The key handler's focus check removed.* The only text field sits behind a panel, and
  an open panel already stops the board's keys, so the check could not fail. A second
  row now types into a field placed on the board itself.

Both are the same lesson as `.claude/tests/README.md` keeps teaching: a row guarded by
two things proves neither until each is the only thing in the way.

`check-canvas-space.cjs` reports `CANVAS=FLAG id=frontis` on this page. That is the title's
picture (never hit-tested) being squeezed by the probe's own forced `max-height`; the
probe cannot see `#map` at all because its screen is hidden at load. The question it
exists to ask is answered for the map by section K of the drive suite.

**Not verified here:** everything above ran in headless Chromium. Nothing has been tried
on a real iPhone: pinch and pan under Safari's gesture recognizer, the audio unlock on
the first tap, and saving a file through the share sheet are the three to check first.

## Follow-ups (not built)

Save slots beyond the autosave; a second floor behind the inn's stairs and a cellar; a
way into the locked cell (a key in the chief's chest is the obvious one); locked doors in
buildings; a road beyond the town's east and west ends; more site kinds (mill, watch
house, crypt); weather and time of day; a smaller header in landscape on a phone.
