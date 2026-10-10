# CYOA2 - context

`games/cyoa2/index.html` (single file, ~5,490 lines). The world of CYOA played on a
**board of 5 ft squares**: a seed makes a town, its inn and trades, its houses and a
bandit cave; each place's board is **charted the first time someone walks in** and is
kept in the save from then on. CD commission, 2026-10-09 (in chat, not `/create-new-games`).
Suite: `.claude/tests/drive-cyoa2.cjs` (511 checks). Style: **Grimoire**
(`.claude/styles/grimoire.md`). **Proprietary** (`games/cyoa2/LICENSE`), confirmed by the
CD on 2026-10-10.

This is **step 3 of 5, first push**. Step 1 was the map generator, the asset library, the
renderer and a token to walk. Step 2 was the grid rules: line of sight and fog of war, a
party of up to six, rounds. Step 3 (2026-10-10) brings the **Game Master**: Claude, over
the player's own API key, narrating into a story panel beside the board and acting on the
world through 25 engine tools; and with it **character sheets, checks, attacks, hit points,
dying, rests and levels**, a **script that plays the monsters**, and a **cost ledger**.
It is the second page in the repo that calls an API at runtime (CYOA is the first), and
like CYOA it calls nothing but `api.anthropic.com`, and only with a key the player typed.

The page is built from **parts** (see "Working source" at the end): the scratchpad that
holds them is not in the repo, so the shipped file is the source of truth.

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

Step 3, asked and answered before a line of it was written (2026-10-10, four questions):

- **The licence: "Yes. Proprietary license."** Step 1 shipped it protected without asking;
  it is now the CD's call, like the other seven.
- **Scope: "Play first, voice after."** This push: your API key, the Game Master and its
  cost ledger, a story panel on the map, typed lines, talking to people, character sheets,
  checks, attacks and hit points. **Next push:** the narrator's voice, speaking instead of
  typing, the notes page, rule popups. (CYOA has all four; they were left out on purpose.)
- **Who plays the monsters:** the CD's own words: *"A scripted engine as the default, with
  option in settings to use game master and/or pin cheaper model."* So three modes
  (`script` default, `gm`, and step 2's `hand` kept), and a model can be pinned per task.
- **Your turn: "Tap the board, talk when you like."** A tap on a foe in reach is an
  attack, a tap on a square is a move, abilities are on the character's card; the engine
  resolves all of it at once, for free. Anything else is typed to the Game Master.
- **Narration: "At the beats."** The Game Master speaks, unasked, the first time the party
  enters a place, when a fight starts and when it ends, on the monsters' turns when it is
  playing them, and when it is spoken to. Walking, doors and looking at things are silent.

## Assumed, not decided (flag these when the CD next looks)

None of these was asked for; each was the conservative reading. All are cheap to change.

| Assumed | Why | To change it |
|---|---|---|
| **Grimoire** style, not Neon Arcade | it is CYOA's sequel, and an inked map on vellum is what a tabletop map looks like | the page chrome is CSS tokens; the map palette is the `INK`/`WASH` constants at the top of ART |
| CYOA's chrome: no top-left back/mute, **2x reload** top-right, EXIT on the title | the CD chose these for CYOA | `#reload-btn`, `#ribbon-btn` and the header height in the CSS |
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
| ~~Rounds never end by themselves~~ (step 3: a fight ends when one side is beaten; the cross still stands everyone down) | - | `fightCheck()` |
| New travellers are **named by the seed** from the given-name table | a blank name field is a chore; the name is editable | `intent({t:'party',op:'add'})` |
| ~~Cover is not built~~ (step 3 built half cover, below) | - | `coverOn()` |

Step 3 added these. The four answers above settled what, who and when; this is the rest.
**Rules:**

| Assumed | Why | To change it |
|---|---|---|
| **5e-lite, CYOA's own**: six callings (Fighter, Rogue, Cleric, Wizard, Ranger, Bard), the standard array by each calling's priorities, levels 1 to 5, two attacks and two or three abilities each | CYOA's sheets, ported with a reach in squares added to every attack and ability | `CLASSES`, `XP_LEVELS`, `BESTIARY` in RULES |
| Initiative is **d20 + dexterity** | step 2's plain d20 had no sheet to read | `initOf()` |
| **One action, one bonus action, 30 ft** a turn; **DASH** spends the action on 30 ft more | 5e | `openTurn()`, `intent('dash')` |
| **No opportunity attacks, no reactions.** Shield is a **bonus action** that lasts to the wizard's next turn | reactions need an interrupt in the middle of someone else's deed; nothing else in the engine does that yet | `useAbility` (`fx:'shield'`), `openTurn` |
| A blade reaches the **eight squares round its wielder**, never through a wall, a shut door or round a hard corner | the grid's own adjacency | `meleeClear()` |
| A shot needs **range and a clear line of sight**; the board's sight radius limits it too (8 squares in the cave) | a torch-lit cave is short work for a longbow otherwise | `reachWhy()` |
| **Half cover: +2 AC** when someone, or a thing that fills its square, stands on the line of a shot | the one cover rule a grid makes cheap to judge | `coverOn()` |
| A shot with an **enemy beside the shooter is at disadvantage** | 5e | `pressed()` |
| **Advantage is the engine's to give** (a sleeping or fallen target, a hidden attacker); only the Game Master's own `attack` tool may add it for something the engine cannot see | a player's intent must not be able to claim it | `strike()` reads `it.mode` only when `it.by === 'gm'` |
| **Sneak attack** once a turn: with advantage, or with a friend beside the target; never on a spell | 5e, simplified | `strike()` |
| At 0 a traveller is **down** and rolls **death saves** on their turns; a blow while down is a failed save (a critical two); damage of twice their hit points at once kills | 5e | `hurtPC()`, `deathSave()` |
| **The monsters' script never strikes the fallen** | a party that goes down should usually wake up, not be finished off by a script | `foePlan()` |
| A fight **ends by itself**: last enemy gone is a victory (experience shared among the living), nobody standing is a defeat | - | `fightCheck()`, `endFight()` |
| **Beaten but breathing: the party wakes at the inn the next morning at 08:00, 1 hit point each, half its gold gone.** The dead leave the party for a list of the fallen. **All dead: the tale is over.** | a total party kill on a bad roll should cost something and still leave a tale | `rescue()`, `bury()`, `afterHarm()`, `st.over` |
| **A rest is refused only with enemies in sight.** Short: an hour, a hit die, short-rest abilities. Long: eight hours, everything | simple, and the clock makes it cost something | `intent('rest')` |
| Fighting tricks (Action Surge, Shield, Bless, Sleep, Turn Undead, Hunter's Mark, Magic Missile, Cunning Action) are **refused outside a fight**; healing and inspiration work anywhere, and touch is not measured outside one | a blessing cast in the street would never end | `useAbility()` |
| New travellers take the callings **in rotation**; a calling can be **changed until it has earned experience** (the purse follows the calling) | so a party can be set up by hand with no Game Master | `intent('party', op:'class')` |
| The party starts as **one nameless placeholder**; `create_character` fills it, later characters join beside it | CYOA's conversational character creation, on a board that needs someone standing on it from the first frame | `newPc(..., stock)` |
| **Balance is untuned.** A party of four played by the suite's own naive planner won most cave fights; one traveller alone usually dies there | the numbers are 5e's, not tuned for this cave | `BESTIARY`, section Q's fight tally |

**The Game Master and the table:**

| Assumed | Why | To change it |
|---|---|---|
| Default model **Claude Opus 5.5 at medium effort**; Sonnet 5.5 and Haiku 5.5 offered, plus a model id typed by hand | CYOA's choice | `MODELS`, `Settings.defaults` |
| A **model per task** (players' lines, beats, monsters' turns), each defaulting to the main one | the CD asked to be able to pin a cheaper model for the monsters; the other two came free | `taskSettings()`, Settings |
| With the Game Master playing the monsters there is **one telling per monster's turn**; whatever it leaves undone or fails at, **the script finishes** | a fight must never stall on the network | `Session.tick`, `Session.tried` |
| A telling changes the **live** tale as it goes (the board moves while the model works); if it fails, the **whole tale is put back** from a snapshot taken before it began | CYOA stages a copy and commits; here the players should see pieces move as tools land | `Session.turn()` |
| **A failed telling is still billed** (the ledger marks it) | the API charged for it | `Costs.add(... failed)` |
| The **story panel is open by default**, under the board on a phone held upright and beside it on a wide or lying-down screen; folded, the engine's lines are said as toasts | the game is half a conversation now | `#story`, `UI.storyOpen`, `UI.chip` |
| A **key saved for CYOA on the same device is offered by a button, never used unasked** | the same origin can read it, but a key is spent money | `Settings.cyoaKey()`, `#set-cyoa-key` |
| A line and its answer cost **two minutes and up** of the tale's clock; travel 5 minutes (45 to the cave); a fight a minute per ten rounds | so rests and "the next morning" mean something | `addMinutes()` callers |
| When the model calls tools and then says nothing, it is **asked once** for the telling | CYOA does the same | `AnthropicGM.run()` |
| `update_npc` with `attitude:'free'` releases the captive; **there is no cell-key rule in the engine** | the Game Master has `set_door` and `update_npc`; a rule can come when the plot needs one | a `key` item check in `intent('door')` |

## The road from here (agreed in outline, 2026-10-09)

1. **Done:** generators, asset library, renderer, a token to walk.
2. **Done:** grid rules - line of sight, fog of war, a party of six, rounds with
   initiative and 30 ft turns, monsters moved by hand. (Cover waits for attacks.)
3. The Game Master.
   - **Done (first push, 2026-10-10):** the key, the model client, 25 tools, the world
     bible and canon, the story panel, typed lines, talking to people, sheets, checks,
     attacks, hit points, dying, rests, levels, cover, the monsters' script, the ledger.
   - **Next (second push):** the narrator's voice and its sentence queue, speech instead
     of typing, the notes page, rule popups. All four exist in CYOA (`.claude/cyoa.md`).
   - Not planned yet: an ending or epilogue screen when Q0 is completed, places the
     Game Master makes up beyond the charted ones, woodcut plates.
4. Multiplayer: other devices send the SAME intents; the host's engine judges them. A web
   page on an iPhone cannot use Bluetooth or host a LAN server, so the realistic route is
   WebRTC data channels with QR pairing or a small relay (assumed from general knowledge,
   not re-checked on 2026-10-09).
5. Table mode: a display-only map at a fixed physical scale, and a pluggable dice source
   (engine RNG, a typed-in physical roll, later a camera).

## Architecture (sections in the script, in order)

`UTIL / PRNG / TABLES / ASSETS / MAP / FURNISH / WORLD / SITES / RULES / ENGINE /
GAME MASTER: TOOLS / CONTEXT / CLIENT / COSTS / ART / VIEW / AUDIO / STORAGE / UI /
SESSION / BOOT`

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
  - A round is `st.round = {n, site, order:[{id, k, roll}], i, moved, act, bonus, extra,
    sneak, xp, had}`; `moveLeft(R)` is `SPEED + extra - moved`. Dice are seeded by the
    tale and counted in `st.n.roll`: `d20(st)` for initiative, and **`diceRng(st)`, one
    generator per deed** (a blow's to-hit, its damage and its riders all come off one
    count). Because the count is state, a test can set it to where a wanted number comes
    up next, which is how the suite makes a natural 1 or a failed save happen on demand.
  - *Step 3's intents:* `attack {target, attack?}`, `ability {name, target?}` (in a round
    the actor's; outside one any traveller's, by `who`), `dash`, `rest {kind}`, `party`
    `op:'class'`. Once `st.over` is set every intent is refused with `over`.
  - **`strike()`** is one attack start to finish: who may be struck (`notarget`, `friend`,
    `peace`, `gone`, `turned`), with what (`weaponFor`: the weapon named, else a blade if
    the target is beside you, else the first that reaches), then the roll, cover, riders
    (bless, inspiration, sneak attack, the ranger's mark), the harm, and `fightCheck()`.
    **`useAbility()`** is the same for a class ability, driven by its row in `CLASSES`
    (`cost`, `tg`, `rg`, `heal` / `dmg` / `fx`).
  - A monster's block is made the first time it matters and kept on its person:
    `st.npcs[id].sheet = {tpl, ac, hp, hpMax, asleep, turned}` (`sheetOf`). Its attacks
    are **always** `BESTIARY[tpl].atk`, never anything a file says.
  - **`foePlan(st)`** is the monsters' script, asked for **one intent at a time** so the
    table can show each deed: strike whoever is in reach (the weakest first), shoot if
    there is a line, else close in, dash if the way is open and the movement spent, else
    end. It never plans for a traveller and never strikes the fallen.
  - `dropToken()` takes a monster off the board for good: out of the order (keeping the
    turn in hand), out of `st.met`, and off any ranger's mark. `hurtFoe` calls it.
- **Rules** (`04b-rules`). Tables and pure functions only: `CLASSES`, `BESTIARY`,
  `ROLE_TPL` (which block a bandit's role fights with), `parseDice` (strict: real dice,
  bounded counts), `rollTerms`, `d20s`, `combineMode`, `makeSheet` (fixes the key order
  of a sheet, so a save round-trips byte for byte), `hurtPC` / `healPC` / `grantXp`,
  `checkFor` (a skill, an ability or "<ability> save"), `weaponsOf`, the clock.
- **Game Master: tools** (`TOOLS`, `exec`). Twenty-five tools, each a description, a
  closed JSON schema and a `run(st, input)` that **validates everything before it changes
  anything** and returns `ok(result, say, kind)` or `err(reason)`. Most are a thin wrapper
  round the intents the board sends (`viaIntent`), so the model and a finger are judged
  by the same code. **The model never does geometry**: it names who or what by the ids
  the digest prints (`P1`, `N0`, `S2n1`, `R2`, `D3`, `E0`, `O12`, or a square `"x,y"`),
  `anchorOf()` turns that into squares to stand on, and the engine finds the way.
  `exec()` is the only door: it snapshots first and, if a tool throws half way, puts the
  tale back in place (the boards are then NEW objects; anything holding an old one must
  let go, which `UI.sync` does). `lookup` is the one read-only tool.
  The tools: `roll_check`, `roll_dice`, `move`, `travel_party`, `set_door`,
  `place_object`, `remove_object`, `reveal`, `create_npc`, `update_npc`, `start_combat`,
  `end_combat`, `attack`, `use_ability`, `end_turn`, `rest`, `advance_time`, `inventory`,
  `update_character`, `suggest_character`, `create_character`, `update_quest`,
  `record_fact`, `lookup`, `end_scene`.
- **Context.** What the model reads. **Cached prefix, byte-stable for a tale:** the tool
  definitions, `SYSTEM_PROMPT`, then `bibleText(st)` (the seed's world: people, threads,
  places, the opening). **After the cache breakpoints, fresh every turn:**
  `turnContext()` = the table's settings, `boardDigest()` (the board in words: rooms with
  what is in them and whether the party has SEEN them, doors, ways out, every person with
  where they stand and whether they are IN SIGHT, hostiles with their block),
  `partyDigest()`, the fight if there is one, quests, CANON (facts about whoever is at
  hand, plus keyword matches on the player's words), the last ten scene summaries, the
  last eight exchanges, **what the board did SINCE YOU LAST SPOKE** (the chips), and last
  the player's line or a `STAGES` stage direction.
- **Client** (`AnthropicGM`). Raw `fetch` to `https://api.anthropic.com/v1/messages` with
  the player's key; no SDK. Streamed (SSE parsed by hand), adaptive thinking, an explicit
  `output_config.effort`, `fallbacks:'default'` with its beta header on Opus only. **Each
  turn is a fresh conversation** (earlier turns reach the model as text in the context,
  so no thinking block is ever replayed across turns); inside a turn the tool loop is
  append-only, up to ten rounds, and `echo()` sends the assistant's blocks back as they
  came. `heal()` learns from a model's own 400 which field it will not take (fallbacks,
  effort, thinking), drops it once, and remembers. A `GMError` has a `kind` (`auth`,
  `busy`, `network`, `model`, `refusal`, `aborted`, `bad`); busy and network are retried
  twice, never after a word has streamed. `window.__CYOA2_MOCK__`, set by a test before
  load, replaces the provider and drives the same hooks.
  *Model ids, request fields and prices were checked against platform.claude.com/docs on
  2026-10-10 (`PRICES_CHECKED`); nothing has been sent to the live API from here.*
- **Costs** (`Costs`, `CLAUDE_PRICES`). Each telling is one ledger line in the save:
  exact token counts from every reply's usage, times list price, **priced on the model
  that served the reply**. Haiku 5.5 has a second price above 100,000 prompt tokens. An
  unpriced model is marked unknown, never guessed. The Costs panel totals by task and by
  model and exports CSV.
- **Session** (`Session`, after UI). When the Game Master speaks. `queue(kind)` holds
  the beats (`opening`, `enter`, `fight`, `fightend`), each kind at most once;
  `tick()` runs between one thing and the next on the board, never while a panel, a
  dialog or the menu is open, and tells a waiting beat or hands a monster its turn (to
  the Game Master once per turn if `monsters === 'gm'`, else to `UI.foeAct` and the
  script). `turn()` is one telling: halt any walk, save, set `G.busy`, snapshot, build
  the context, run the provider with hooks that stream words into the story and run
  tools on the live tale (`UI.sync` after each, so the page follows), then either keep it
  (story, clock, turn count, ledger) or put the tale back and say why.
- **Saves.** `packState` / `unpackState`, format `v: 3`. A save is the whole state: bible,
  sites, people (monsters' blocks included), every charted board (byte grids as strings,
  **`seen` included**), the party with their sheets and who leads, a round in progress,
  who has been met, the journal, and step 3's: the clock, the purse, facts, scene
  summaries, quests, the story, the ledger, which places have been told, the fallen,
  and whether the tale is over. **The API key is never in it.** A v1 or v2 save loads:
  each traveller is given a calling by their place in the party and a full sheet
  (`cleanPc` bounds every number of a v3 sheet and rebuilds abilities from the class
  table, believing only the uses). **Loading
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
  Step 3: a tap on an enemy the actor can strike (`aims()`, ringed in red) is a blow; on
  anyone else a card (`pcCard`, `tokCard`) whose buttons are what can be done by them or
  for them now (DASH, the actor's abilities, a weapon that reaches, TALK, ROLL
  INITIATIVE, a healer's hands outside a fight). `UI.resolved()` shows what the engine
  answered: a chip in the story, a number rising off the square, a sound. The Party
  panel is a sheet for each traveller (calling, level, hit points, what they strike
  with, know and carry), with REST AN HOUR / SLEEP THE NIGHT and the list of the fallen.
  The story (`#story`) is a log plus a bar: who speaks, the line, SEND (STOP while the
  Game Master is speaking). `UI.tell` writes an entry into `st.story` and onto the page;
  `UI.chip` is the engine's own line, toasted too when the log is folded. Settings holds
  the key, the model, effort, content rating, when the Game Master speaks, who plays the
  monsters and the three per-task models.

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

Step 3:

- **Never `innerHTML` anything the model said**, any more than anything from a save: a
  name, a reason, a line of narration. The key lives in this origin. The suite streams a
  whole `<img onerror>` in one piece and requires it never to be an element, even while
  streaming.
- **The key lives only under `cyoa2.key`** (localStorage with "remember", else
  sessionStorage, else memory): never in the settings blob, never in a save or an
  export. `connect-src` in the CSP names `https://api.anthropic.com` and nothing else.
- **Nothing that changes in play goes into `bibleText()` or `SYSTEM_PROMPT`**: they are
  the cached prefix. The suite compares the bible text with the tale's first, after play
  and after a save.
- **Never send an empty message.** A reply with no text and no tool call cannot go back
  as an assistant turn; the one nudge ("Now narrate...") joins the last user turn.
  `echo()` also drops text blocks that are empty or only space. (CYOA's client still
  sends the empty turn in that case: inferred from the API's documented rule, not seen
  live; worth the same two-line fix there.)
- **A tool validates completely, then mutates.** The suite calls every tool with one of
  each kind of bad input and compares the tale byte for byte. A new tool needs a row in
  `TOOLS`, a bad call in section S, and (if it changes the board) a `say` for its chip.
- **`Session.turn` and its hooks check `G.st !== st`** after every await: the table may
  have opened another tale while this one was being told. Without the check a failed
  old telling "puts back" the old tale over the new one.
- **Every way of acting from the page checks `G.busy` first** (`go`, `tapAt`, `rounds`,
  `endTurn`, `attack`, `ability`, `act1`, `send`, `exportFile`, the Chronicle's Go), and
  `saveNow` refuses to save mid-telling and deep-copies when it does save (the store
  writes a moment later; a live reference would let the next telling leak into it).
- **A beat waits** (`UI.blocked()`), is queued once per kind, and is dropped if it no
  longer applies (a place already told, a fight already over).
- **`moveToken` restores the lookup for whoever is left behind** when two monsters have
  shared a square in passing (found by step 3's fights; it had been latent since step 2).
- **Adding a calling's ability** is a row in `CLASSES[...].abilities`; a new `fx` needs
  a branch in `useAbility`, an entry in its fight-only list if it must not be used
  outside a round, and a row in section Q. **Adding a monster** is a `BESTIARY` row and,
  for the tale's own bandits, a `ROLE_TPL` entry.
- **Prices and model ids go stale.** `CLAUDE_PRICES`, `MODELS` and `PRICES_CHECKED` are
  one place; the Costs panel prints the date they were checked.

## Tests

`drive-cyoa2.cjs` (511 checks, about 145 s) runs the generators inside the real page
across 36 worlds (329 boards) and asserts they are whole, then the engine's refusals,
lazy charting, saves (including a tampered file), the phone flow, tap accuracy at five
viewports after a resize-while-hidden, gestures, keys and the panels (sections A to M,
step 1), then **N sight and fog, O the party, P rounds** (step 2), then **Q sheets,
blows and dying, R the table by touch, S the Game Master's tools, T the Game Master at
the table** (step 3). `CYOA2_ONLY=NOP` runs only the named sections (A stands for A to
I) and `CYOA2_PAGE=<path>` points the suite at a copy of the page; both are for negative
tests and neither prints the GREEN line a gate looks for.

Section N judges the engine's sight with **an independent judge**: a line walked in
fiftieths of a square that shares no code with the ray march. *Sound:* every square shown
has some clear line to it. *Complete:* every square plainly in view is shown. That judge
found the corner crack described under Sight. Its first version also "found" 35 squares
that were really the judge's own sample points being too coarse near a square's edge:
before believing an oracle, look at what it flags.

Step 3's four sections, and what each is for:

- **Q** is the engine alone. Fights are played out, the monsters by `foePlan` and the
  travellers by a planner the suite wrote for itself (so the script under test has an
  opponent it did not write), with sixteen invariants checked after every deed. Then
  the rules a lucky run does not reach: `force(st, die, v)` sets the tale's dice count
  to where a wanted number comes up next, so a natural 1, a failed save against Turn
  Undead or the third death save happens on demand through the real code.
- **R** is the page with no Game Master: a whole fight by touch against the script,
  what is ringed and what a card offers, the token painter's own pixels, sheets, rests,
  the cross, defeat and rescue, the end of a tale.
- **S** calls the 25 tools directly: one of each kind of bad input (62 in all), the tale
  compared byte for byte; each happy path; and what the turn context carries, with the
  sharp cases built (someone behind a shut door, a fact about someone far away).
- **T** is the seam with the model. The real client runs against a stand-in for
  `api.anthropic.com` that can refuse, overload, go silent, break its JSON or die half
  way; then `window.__CYOA2_MOCK__` stands in for the model so the table's side (beats,
  the monsters' turn, a tale opened while another is told) can be driven exactly.

**Not verified:** no request has been sent to the live API from this suite or by hand;
model ids, request fields and prices come from platform.claude.com/docs as read on
2026-10-10. The first real key will be the first real test of the client.

### Negative tests, step 3 (2026-10-10, `negtest-copies.py`)

**343 deliberate breaks** (engine 118, tools and context 81, client and session 93, page
50, the CSP 1), each a one-line change to a rule the page keeps. The suite was green at
390 checks when they started.

**On the first pass 129 of 335 came back GREEN from the section they were aimed at**
(engine 41, tools 49, client and session 19, page 20). Two of those are caught by another
section. Six are changes with no observable effect (below). The other 121 were rules no
row held; closing them, and four more that a second full pass found, took the suite
from 390 checks to 511.

**Final pass, on the shipped page with the shipped suite: 337 caught, 6 with no
observable effect, 0 missed** (engine 118 of 118; tools 78 of 81 and page 46 of 50 with
the six no-effect changes between them, and one page break, TALK addressing nobody,
that only the client section can see; client and session 93 of 93; CSP 1 of 1). Fifteen
of the 337 are caught by a crash or a timeout in the suite rather than by a named row:
each is a break that makes the page throw or never reach the state the suite waits for.

What the misses had in common (the long form is
`.claude/notes/20261010-negative-tests-at-scale-and-a-gm-on-a-board.md`):

- *Rules that bite on a rare die.* Hundreds of blows, and a natural 1 that would have
  hit never came up. Now forced.
- *A refusal that came from an earlier check.* "Never to oneself" was refused because
  the bonus action was spent. Rows now assert the reason and arrange for only one.
- *A sample without the sharp case.* IN SIGHT was checked where everyone was in sight;
  "no rest with enemies in sight" where there were none.
- *"Refused" is not "validated".* A tool with its validation removed often still fails,
  by throwing; where the reason matters the row asserts the text.
- *The wire on unhappy paths* (what goes back after a refused call, silence, broken
  JSON, a 529, a refusal) was not looked at.
- *The busy lock was tried at one door of six.*

Writing those rows turned up more than rows. **A bug in the client:** it echoed an empty
assistant turn after a silent tool round (the nudge now joins the last user turn).
**A flaky row:** reload-and-Continue saved, waited 400 ms and reloaded, and under load
the write had not landed; it had been "catching" seven breaks that had nothing to do
with it, three of which nothing else caught. `saveNow` now returns its write and the
suite awaits it. (The same row failed once more, 1 run in 18 under load, with the key
gone from localStorage after the reload; not reproduced in 12 further runs, not
explained. `Settings.setKey` used to remove and re-set an unchanged key on every
Settings action and no longer does; the row now prints what storage held before and
after if it ever fails again.) **A row that disarmed another:** making "never to
oneself" assert its own reason removed the only thing that had been catching "no bonus
action left". The second full pass found all four.

**No observable effect (not holes; left in as guards):**

| Break | Why nothing can see it |
|---|---|
| `p.stock = false` removed from `create_character` | both paths into it (`party` `name`, `party` `add` with a name) already clear the flag |
| the off-board check removed from `anchorOf` | a square off the board has nowhere to stand, and that is refused next |
| `!st.over` removed from `UI.arrived` | `UI.over()` always runs after it and hides the button |
| the eight-deed cap removed from `UI.foeAct` | `foePlan` cannot loop: every deed it asks for spends something |
| `fieldset { min-width:0 }` removed | with today's option labels the fieldsets already fit at 320 px; the rule that matters is the selects' `width:100%`, which IS caught |
| "unknown asset" guard | the break written for it was a no-op (the condition it added was always false) |

The 77 breaks of steps 1 and 2 were then run again against their own sections, nine of
them re-anchored to code step 3 had rewritten: **76 caught at once, and one
GREEN: "the last finger of a pinch is not a tap", for the third step running.** This time
the cause was under the geometry. In a synthetic `touchEnd` the finger listed is the one
that LIFTS; the row had always taken it for the one that stays, so it had been judging
the ground under the wrong finger and passing or failing by whatever lay under the
other (in step 3, the inn's bar counter, which a tap only reads). The row now asks the
PAGE where the remaining finger is (`Ptr`), slides the table until open ground is under
it, and afterwards requires a real tap on that square to walk. With that, 77 of 77.

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
For step 3 add: **a real key against the real API** (nothing has been sent to it); how
the story panel sits above the iPhone's keyboard when the line field has the focus
(the board is squeezed between the header and a keyboard in headless only by guess);
whether a tap on a ringed enemy is easy to hit at the default zoom with a thumb; and
how a telling of several tool calls reads while the pieces move.

## Follow-ups (not built)

Save slots beyond the autosave; a second floor behind the inn's stairs and a cellar; a
way into the locked cell (a key in the chief's chest is the obvious one); locked doors in
buildings; a road beyond the town's east and west ends; more site kinds (mill, watch
house, crypt); weather and time of day.

From step 3 (first push): everything in the second push (voice, speech, the notes page,
rule popups); an ending when the matter at hand is completed; opportunity attacks and
reactions; conditions that do something on the board (prone, restrained are honoured
only as advantage); hiding and stealth; a key for the cell as an engine rule; loot off
the fallen; shops and prices; places the Game Master makes up; tuning the cave for a
party of one to three; a way to undo a mis-tapped blow (there is none, as at a table).

From step 2: bystanders who move (a town that goes about its day); a marching order the
player sets, instead of nearest-first; dashing and difficult ground beyond furniture;
light sources carried and put out (the cave's 8 squares is "someone has a torch");
stealth, so that being in sight and being noticed are two things; a "last seen here"
ghost for a bandit who walks out of sight; the dice as a pluggable source for the
physical table (the engine's `d20` is the only place a roll is made).

## Working source

The page is assembled from eleven **parts** by a `build.sh` that concatenates them and
runs `check-inline-js.cjs`: `01-head.html` (CSS and markup), `02-core.js`, `03-map.js`,
`04-gen.js`, `04b-rules.js`, `05-engine.js`, `05b-gm.js`, `06-art.js`, `07-view.js`,
`08-ui.js`, `09-tail.html`. They live in the session scratchpad, which is not in the
repo, so **the shipped `index.html` is the source of truth**: a later session edits it
directly (`.claude/scripts/replace-fn.py` for a whole function), or splits it again at
the banner comments (`/* ===== NAME ===== */`) if it wants parts back. The same goes
for the break lists: their generators are scratch, the traces above are the record.
