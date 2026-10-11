# CYOA2 - context

`games/cyoa2/index.html` (single file, ~7,000 lines). The world of CYOA played on a
**board of 5 ft squares**: a seed makes a town, its inn and trades, its houses and a
bandit cave; each place's board is **charted the first time someone walks in** and is
kept in the save from then on. CD commission, 2026-10-09 (in chat, not `/create-new-games`).
Suite: `.claude/tests/drive-cyoa2.cjs` (750 checks) with its own player,
`.claude/tests/cyoa2-player.js`. Style: **Grimoire** (`.claude/styles/grimoire.md`).
**Proprietary** (`games/cyoa2/LICENSE`), confirmed by the CD on 2026-10-10.

This is **step 3 of 5**. Step 1 was the map generator, the asset library, the renderer and
a token to walk. Step 2 was the grid rules: line of sight and fog of war, a party of up to
six, rounds. Step 3 is the Game Master, and it now comes in **two kinds**:

- **The script** (the default; added 2026-10-10 on the CD's word that the default must be
  "deterministic scripted everything"). No model, no key, no cost. It narrates the beats
  out of tables, people answer from **topic buttons**, things offer **verb buttons**, and a
  quest machine in the engine carries the whole adventure to an ending. The page calls
  nothing at all in this mode.
- **Claude**, over the player's own API key, for any of **five areas** the player gives it
  (narration, talking to people, lines typed to the table, the monsters' turns, making
  characters), acting through 26 engine tools. The script keeps the rest. Under each of
  Claude's passages the page can keep **the script's version of the same moment** (the
  twin), every passage is tagged with who told it and can be rated, and a Compare page adds
  it all up. That is the experiment the CD asked for: play it scripted, see what the model
  adds, tune how much of the table it gets.

Whoever tells it, **the narrator reads it aloud** in the device's own voice (the second
push of step 3, 2026-10-10: voice, a microphone where a model is listening, a notes
page, and a rule book behind every line of a traveller's sheet).

It is the second page in the repo that calls an API at runtime (CYOA is the first), and
like CYOA it calls nothing but `api.anthropic.com`, and only with a key the player typed.
The voice and the microphone are the browser's own (`speechSynthesis`,
`SpeechRecognition`); the page calls nothing for either.

The shipped file is the source of truth. To work on it as parts, split it with
`.claude/scripts/page-parts.py` (see "Working source" at the end).

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

The two kinds of Game Master, asked and answered before a line was written (2026-10-10,
the same day, after the first push had shipped). The CD's own words: *"default mode is
deterministic scripted everything"*; *"ai mode where ai api keys are required and ai is
used for certain aspects as already discussed"*; *"I want to experiment with deterministic
game play quality and show how ai enhanced gameplay differs to help me with fine tuning
how much the ai assists in different areas."* Four questions:

- **With the AI off, how do you talk and try unusual things? "Choice buttons."** Each
  person offers topics drawn from the seed's plot; chests, locks and desks offer verbs.
  No typing.
- **How much adventure does the script carry alone? "Whole adventure."** The main quest
  winnable start to finish with an ending, both whispers discoverable, loot, a shop, inn
  stays.
- **How is the difference shown? "Script twin", "Source and cost tags" and "Ratings and
  report"** (three of four offered; a blind A/B pick was not chosen).
- **Voice, for the push after this? "Device voice only."** The phone's own speech
  synthesis, free and the same in both modes; no paid voices.

Told to the CD with the questions, and not objected to: the script is the default **even
when a key is saved**; the model is switched **per area**, not all-or-nothing; the
switches can be flipped **in the middle of a tale**; every passage **records who told
it**; scripted text is **seeded** (the same seed and the same moves give the same words).

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

The two-mode push added these. The four answers settled the shape; this is what I filled
in to make a whole adventure out of it. **Every line the script speaks is mine**, written
for this push: the tables `MAIN`, `WHISPERS`, `GREET`, `GANG`, `ABOUT`, `IDLE`, `ENTER` in
THE SCRIPT section are data, and the CD should feel free to rewrite any of it.

**Who runs the table:**

| Assumed | Why | To change it |
|---|---|---|
| **Five areas**: narration at the beats, talking to people, lines typed to the table, the monsters' turns, making characters | the Game Master's jobs as the first push already had them, cut where one can be the script's while another is the model's | `AREAS`, `Mode`, the "Who runs the table" fieldset |
| With the table set to Claude the areas default to **all Claude except the monsters** | the CD's step 3 answer: a scripted engine plays the monsters by default | `Settings.defaults.areas`, `monsters` |
| **Asking for Claude with no key is refused where it is asked** (the choice snaps back, the key field takes the pen); a key that goes away mid-tale hands everything back to the script | "ai mode where ai api keys are required" | the `set-gm` handler, `Mode.master()` |
| **The plot is the engine's, not an area.** The quest machine runs whoever narrates; a model can close a quest too | so a tale can pass between script and model at any moment without the plot forking | `plotCheck()` |
| **The twin is kept by default** when Claude speaks; tags and ratings are **on by default** | the CD wants to compare; both can be switched off | `Settings.defaults.twin`, `.tags` |
| Rating marks are 👍 👎, shown greyed until pressed | "thumbs up or down" was the wording of the question | `UI.storyFoot`, `.st-foot .rate` |
| A story the player folded away **stays folded** when the script speaks; the fold gets a red dot | the model's telling forces it open because it is paid for; the script's is not worth taking the board away for | `UI.script`, `#story-toggle.new` |
| Told by the script, a new tale's **BEGIN goes on to the party sheet**, with a **SURPRISE ME** button per traveller | character creation without a conversation; nobody should play "Wayfarer the Fighter" by accident | `UI.whoIsHere`, `intent party op:'roll'` |

**The script's adventure:**

| Assumed | Why | To change it |
|---|---|---|
| **Being seen is a fight.** With only the script at the table, an enemy who is awake and sees a traveller on their feet starts one (no "Carry on"), every time, not only at first sight; the cross is off the bar until the party has broken from their sight | step 2's "a button, plus a prompt" let a party walk past the whole gang; a Game Master would not allow it and the script cannot be asked | `Mode.strict()`, `threatOf()`, `UI.spotted`, `UI.alarm`, `UI.mustFight` |
| **Sleepers are a choice**, and so is a word to say (the chief's old name) | the two things the script can rule on | `UI.spotted` |
| **A night is slept at the inn (1 gold a head; the stable, free, for an empty purse) or in a hideout emptied of its owners**; never in the street, never where enemies still hold the board. The Game Master's own `rest` tool may rule otherwise | so the hill costs something to climb twice, and "inn stays" mean something | `intent('rest')`, `by:'gm'` |
| **Only things in a hideout can be searched** (chest, crate, barrel, sacks, desk), once each; a townsperson's chest offers nothing | theft from neighbours needs a Game Master to judge it | `CONTAINERS`, `lootOf()` |
| What a thing holds is **fixed by the seed and the thing's id**; the chief's **strongbox** (first chest in the chief's chamber) is locked, DC 15, holds 30 gold more, a draught, and the reliquary when that is the matter at hand; the **desk** holds the ledger and the keeper's letter when those whispers are in the seed | "generated on the fly must be documented": here it is not even stored, it is derived | `plotSpots()`, `lootOf()` |
| **Locks**: the gang's keys open any lock in the hideout; else pick (Sleight of Hand DC 13, or 15 for the strongbox and the cell; **disadvantage without thieves' tools**) or force (Athletics, DC 3 higher; **advantage with a crowbar**); **one try each per traveller** | failure has to mean something without a softlock: beat the chief and the keys open everything | `verbsFor()`, `useOf()` |
| **The chief's keys come to whoever leads** when the chief falls; opening the cell frees the prisoner; a freed prisoner **walks down the hill with the party** and stands by the elder | so the plot's things move without a narrator moving them | `plotCheck()`, `plotLeave()` |
| The matter at hand pays **60 gold and 150 experience each**; a whisper **75 experience each** (the ledger 30 gold more) | enough that a party of four reaches level 2 by the ending | `MAIN_GOLD`, `MAIN_XP`, `SIDE_XP` |
| **Checks are the leader's**: talk checks DC 12-13 by the better of two skills, the name DC 12; a failed try is spent for that traveller, so the party changes who leads | makes "who speaks" a decision the board already has a control for | `bestCheck()`, `flag tried:*` |
| **Each whisper is known to two of the five named townsfolk** (never the one it is about); about a third of everyone else knows one | so the party has to ask around, and always can | `tellersOf()`, `whisperOf()` |
| What settling each whisper **does**: the keeper's debt = free beds and the guard post on the map; the smith's blades = **+1 damage on every weapon hit** for the rest of the tale; the informer = **the lookouts are found asleep** (unless the gang has already seen the party); the tunnel = the whole hideout on the map; the chief's kin = a name that, said to the chief on a Persuasion check, **ends the gang without a blow** (one try; on a failure the fight is on); the ledger = 30 gold from the elder, and it can prove the debt or the informing without a roll | each whisper should change the hill, not only the purse | `settleWhisper()`, `hush()`, `talkOf` (`name`) |
| The shop sells a **healing draught (12, 2d4+2), thieves' tools (10), a crowbar (4)**; the priest tends everyone for 5 gold or what the purse holds | only things with a rule of their own | `ITEMS`, `topicsFor()` |
| When the tale ends the script tells an **epilogue** and the table says so once: **Title, or Wander on**. The tale is not over | the first push had no ending | `beatText('ending')`, `UI.ending`, `flag end` |
| **A level earned at 0 hit points does not heal** | found by the suite's player: a traveller was "stable at 8". The level's hit points raise the maximum only | `grantXp()` |
| Two **generator fallbacks** (`GEN_V` 2): where no rock can be cut for a cell (about 1 hideout in 60) the prisoner is kept **bound in the chamber**; a keeper the recipe could not seat (the smith, in about 1 forge in 13) is seated in **any room, then the yard** | the plot needs someone to free and someone to ask on every seed. Boards that already had both are drawn exactly as before | `fnCell`, the end of `genBuilding` |
| **Balance, measured not tuned** (the suite's own player, 24 seeds, asserted in section U): four travellers finish every tale, in about two climbs and two days; **one alone finishes 23 of 24 within eight climbs** | the gang keeps its wounds between climbs, so persistence wins. Nothing was tuned to get these numbers | section U's rows; `.claude/tests/cyoa2-player.js` |

The second push of step 3 added these (voice, microphone, notes, rule book). One answer
shaped it ("Device voice only"); the rest is how I filled it in.

| Assumed | Why | To change it |
|---|---|---|
| The narrator is **on by default** | CYOA's is. One tap on the speaker beside the story turns it off, and that is remembered | `Settings.defaults.voiceOn` |
| It reads **tellings only**: the beats, what people say, what a model says. Not the engine's own lines (dice, doors, loot), not cards, not toasts | read aloud, the dice lines are noise | `UI.script`, `Session.turn` |
| **The words do not wait for the voice.** Text appears as it always did; the passage being read wears a mark in its margin | CYOA reveals words at speaking pace, but that is a book, and this is a board with a game going on | `Narrator.mark`, `.st-gm.speaking` |
| **An answer interrupts, a beat waits.** What someone says in answer to a tap cuts off whatever was being read; a beat queues behind it | so the voice is never on the last thing while the player is on the next, and never talks over a person | `UI.script` |
| **Silence** is: a tap on the story (not on a button in it, not while selecting words), the speaker button, STOP, a line sent to the table, BEGIN on the opening card, leaving for the title, a hidden page | CYOA's tap-to-skip, plus every place the table moves on | callers of `Narrator.stop()` |
| The opening is read **while it is on its card**, and not again when it is written into the story | the card is where it is read | `Session.openRead` |
| At most **40 sentences** wait to be read; older ones are dropped unread | nothing is read long after the table has moved on | `NARR_MAX` |
| A sentence gets **twice its expected time plus 3 s**; one over 240 letters is read a clause at a time; **90 ms** is left between cutting the voice off and giving it something new | device voices stall, some stop dead on a long utterance, and some are reported to swallow an utterance handed over in the same breath as a cancel (**not seen here; a precaution**) | `Narrator.patience`, `SENT_MAX`, `CANCEL_GAP` |
| Which voice: the best for the device's language (premium, then enhanced, then plain; compact and novelty voices last), or one chosen, or "whatever this device is set to" | CYOA's ranking, ported | `Speech.score`, `Speech.pick` |
| **A microphone only where a model reads the line**, and it takes SEND's place while the field is empty | the script takes no typed lines, so there is nothing to say to it; and a phone's bar has no room for both buttons | `UI.sayBtns`, `Listen` |
| A spoken line **waits in the field** to be read before it is sent, unless "send as soon as I stop speaking" is on | recognition gets names wrong | `Settings.data.autoSend` |
| Notes are **the players' own**: in the save, never shown to the model, no clock, no journal line, written even mid-round or after the tale is over; they **survive a telling that is taken back**. 300 notes of 2,000 letters | CYOA's notes page; a note is not part of the tale | `jot()`, the failure path of `Session.turn` |
| A note is made by **selecting words in the story**, by the **pen under a telling**, or by ADD A NOTE | selecting is CYOA's way; the pen is one tap on a phone, where selecting is fiddly | `UI.selChanged`, `UI.storyFoot`, `UI.notes` |
| The rule book opens from the **party sheet only**, and the sheet gained the **six scores** | CYOA's popups. The scores were shown nowhere before | `UI.party`, `ruleOf()` |
| On the sheet an ability is its **name and uses**; what it does moved into its page of the book | the sheet was a wall of text | `UI.party` |
| The book says the rules **as this table plays them** (no reactions, half cover, the bed rule), in my words | it is opened by someone asking "what does this do HERE" | the tables at the top of RULE BOOK |

## The road from here (agreed in outline, 2026-10-09)

1. **Done:** generators, asset library, renderer, a token to walk.
2. **Done:** grid rules - line of sight, fog of war, a party of six, rounds with
   initiative and 30 ft turns, monsters moved by hand. (Cover waits for attacks.)
3. The Game Master.
   - **Done (first push, 2026-10-10):** the key, the model client, 25 tools, the world
     bible and canon, the story panel, typed lines, talking to people, sheets, checks,
     attacks, hit points, dying, rests, levels, cover, the monsters' script, the ledger.
   - **Done (the two kinds of Game Master, 2026-10-10):** the script as the default, the
     model per area, the twin, tags, ratings, the Compare page, and a whole scripted
     adventure with an ending.
   - **Done (second push, 2026-10-10):** the narrator's voice on the **device's own
     speech** with a sentence queue, a microphone where a model reads the line, the notes
     page, and a rule book behind every line of the party sheet. Step 3 is complete.
   - Not planned yet: places the Game Master makes up beyond the charted ones, woodcut
     plates, a second adventure once the hill is taken.
4. Multiplayer: other devices send the SAME intents; the host's engine judges them. A web
   page on an iPhone cannot use Bluetooth or host a LAN server, so the realistic route is
   WebRTC data channels with QR pairing or a small relay (assumed from general knowledge,
   not re-checked on 2026-10-09).
5. Table mode: a display-only map at a fixed physical scale, and a pluggable dice source
   (engine RNG, a typed-in physical roll, later a camera).

## Architecture (sections in the script, in order)

`UTIL / PRNG / TABLES / ASSETS / MAP / FURNISH / WORLD / SITES / RULES / ENGINE /
GAME MASTER: TOOLS / THE SCRIPT / RULE BOOK / CONTEXT / CLIENT / COSTS / ART / VIEW /
AUDIO / STORAGE / VOICE / UI / SESSION / BOOT`

**The two Game Masters share one door.** The script and the model both act on the tale
through the engine (`intent()`, and the helpers the tools are built from), are told the
same plot by the same `plotCheck()`, and write into the same story with a tag saying who
spoke. Nothing in the engine knows which of them is at the table; `Mode` (in STORAGE) is
the only place that does, and it is asked by the table (UI, SESSION), never by the rules.

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
- **The script's intents** (two-mode push). `talk {npc, topic}` asks someone in sight one of
  the things `topicsFor()` says they can be asked; `use {what: O#|D#, verb}` searches a
  thing or unlocks, picks or forces a lock, standing beside it (a `move` may carry it as
  its `then`, so a tap walks there first); `item {item, who?, target?}` drinks or hands
  over a healing draught (an action in a fight, arm's reach); `party op:'roll'` rolls a
  traveller whole by the seed. `rest` gained the bed rule (`nobed`, `hostiles`; `by:'gm'`
  is a ruling and skips it). **`threatOf(st)`**: an enemy who is awake, in sight of a
  traveller who is on their feet; it is what forces a fight and what holds the cross back.
- **Rules** (`04b-rules`). Tables and pure functions only: `CLASSES`, `BESTIARY`,
  `ROLE_TPL` (which block a bandit's role fights with), `parseDice` (strict: real dice,
  bounded counts), `rollTerms`, `d20s`, `combineMode`, `makeSheet` (fixes the key order
  of a sheet, so a save round-trips byte for byte), `hurtPC` / `healPC` / `grantXp`,
  `checkFor` (a skill, an ability or "<ability> save"), `weaponsOf`, the clock.
- **The script** (`THE SCRIPT`, its own section after the tools). The other Game Master.
  - *Tables:* `MAIN` (the four matters at hand: giver, goal `free`/`chief`/`relic`, the
    offer, what "done in deed" reads as, the thanks), `WHISPERS` (six: who it is about, who
    it is settled with, the button, the check, the lines for telling, winning, losing and
    being shown proof), `GREET` / `GANG` / `ABOUT` / `IDLE` (lines by the kind of person:
    `groupOf()`), `ENTER` (a place first seen, by kind), `ITEMS` (in RULES).
  - *Determinism:* a line is chosen by `varyOf(st, key, list)`, a hash of the seed and of
    what the line is about. **Never a counter, never the clock.** That is what makes
    `beatText()` and `talkOf(..., dry)` free to ask, and the twin possible. (The one
    counter, how far someone has got through their small talk, is a flag `n:<npc>`, read
    but not advanced when asked dry.)
  - *Plot, derived not stored:* `chiefOut()`, `captiveFree()`, `goalMet()`, `carries()`
    read what is true; `plotCheck()` applies each consequence once (the keys to the
    leader, "the giver should hear of it", the ledger noticed) behind a flag; `plotLeave()`
    brings a freed prisoner down the hill; `hush()` puts the lookouts to sleep. `st.flags`
    holds only what cannot be derived: heard / done / tried, what has been searched or
    opened (`u:<site>:<id>`, `o:<site>:<id>`), `job`, `goal`, `spoils`, `called`, `end`.
  - *Talking:* `topicsFor(st, npc)` -> `[{id, label, sub, off, shown}]` (a button each;
    `off` greys it and says why); `talkOf(st, npc, topic, dry)` is one question and its
    consequences, or with `dry` only its words. `tellersOf()` / `whisperOf()` decide who
    has news.
  - *Things:* `thingOf()` (what `O#`/`D#` means and where to stand), `verbsFor()` (the
    buttons), `useOf()` (the deed), `lootOf()` (what it holds), `plotSpots()` (the chief's
    strongbox and desk).
  - *Telling:* `beatText(st, kind, data)` for `opening`, `enter`, `fight`, `fightend`,
    `ending`; `sceneOf()` is what the leader sees, in words.
  - *Twins:* `talkTwin()` (the nearest topic to a typed line, asked dry), `actTwin()`
    (what the board offers from where the leader stands), `monstersTwin(snap)` (the
    monsters' own script played out **on a copy** of the tale).
- **Game Master: tools** (`TOOLS`, `exec`). Twenty-six tools, each a description, a
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
  `end_combat`, `attack`, `use_ability`, `end_turn`, `rest`, `use_thing` (the board's own
  search / unlock / pick / force, exactly as a tap), `advance_time`, `inventory`,
  `update_character`, `suggest_character`, `create_character`, `update_quest`,
  `record_fact`, `lookup`, `end_scene`.
- **Context.** What the model reads. **Cached prefix, byte-stable for a tale:** the tool
  definitions, `SYSTEM_PROMPT`, then `bibleText(st)` (the seed's world: people, threads,
  places, the opening). **After the cache breakpoints, fresh every turn:**
  `turnContext()` = the table's settings, **which of the Game Master's jobs are the
  model's this turn and which the script is doing**, `boardDigest()` (the board in words: rooms with
  what is in them and whether the party has SEEN them, doors, ways out, every person with
  where they stand and whether they are IN SIGHT, hostiles with their block),
  `partyDigest()`, the fight if there is one, quests, **where the plot stands** (open,
  done in deed and whom to tell, whispers heard and settled), CANON (facts about whoever is at
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
- **Mode** (in STORAGE, beside `Settings`). `master()` is `'ai'` only when the table is
  set to Claude AND a key is there; `ai(area)` adds "and that area is given to it";
  `now()` is all five; `typed()` is whether a typed line would be read; `strict()` is
  "nobody at this table can rule on the unusual" (no model narrating or reading lines or
  playing the monsters, and no hand moving them).
- **Session** (`Session`, after UI). When the Game Master speaks, and which one.
  `queue(kind)` holds the beats (`opening`, `create`, `enter`, `fight`, `fightend`,
  `ending`), each kind at most once, whoever will tell them; `tick()` hands a beat to
  `turn()` if its area is the model's, else to `scripted()`, which tells it at once.
  `turn()` asks for **the twin before the provider runs**, so the script's version is of
  the same moment and costs nothing. `after()` runs `plotCheck()` on what a model did and
  queues the ending when the matter at hand has been closed; `ended()` says so once.
  `tick()` runs between one thing and the next on the board, never while a panel, a
  dialog or the menu is open, and tells a waiting beat or hands a monster its turn (to
  the model once per turn if the monsters are its, else to `UI.foeAct` and the monsters'
  script). `turn()` is one telling by the model: halt any walk, save, set `G.busy`, snapshot, build
  the context, run the provider with hooks that stream words into the story and run
  tools on the live tale (`UI.sync` after each, so the page follows), then either keep it
  (story, clock, turn count, ledger) or put the tale back and say why.
- **The rule book** (`RULE BOOK`, after THE SCRIPT). `ruleOf(st, p, kind, key)` returns
  `{ title, lines }` for one line of one traveller's sheet, or null for what is not on
  it. Kinds: `abil` (a score: what it is for, every skill and the save it feeds, with
  totals), `hp`, `ac`, `level`, `class`, `attack`, `ability`, `item`, `cond`, `status`,
  `purse`. It is pure, and **every number in it comes from the helper the engine rolls
  with** (`weaponsOf`, `checkFor`, `profBonus`, `acOf`, `expandStatExpr`), never from a
  second copy of the arithmetic. "Only in a fight" is `fightOnly(def)` in RULES, which is
  also the engine's own refusal. The words are tables at the top of the section
  (`ABIL_INFO`, `SKILL_INFO`, `COND_INFO`, `CLASS_INFO`, `KIT_INFO`).
- **Voice** (`VOICE`, after STORAGE). Three objects and a pure function.
  - `Speech`: the device's voices, ranked (`score`: language first, then how well made;
    compact and novelty voices last), `pick()` (the chosen one, the best, or null for
    "whatever this device is set to"), `prime()` (a silent utterance on the first touch,
    once: a phone lets a page speak only after a finger has asked), `stop()`.
  - `sentencesOf(buf, final)` -> `{ out, rest }`: whole sentences, and the start of one
    still arriving. Pure, so a model's words can be fed to it as they stream.
  - `Narrator`: a queue of sentences, each its own utterance. `begin(node)` / `push(t)` /
    `end()` for a telling that streams, `say(text, node)` for one that is whole. `pump()`
    reads them in order and marks the passage being read (`mark`: a class on the node,
    the music ducked, the speaker button lit). `stop()` is silence now: it empties the
    queue, cancels the device, **and ends the utterance in hand itself rather than
    waiting to be told it ended**.
  - `Listen`: `SpeechRecognition`, writing what it hears into the line field. `drop()`
    closes it without sending.
  The narrator is told what to read in exactly three places: `UI.script()` (the script),
  the `text` hook and the end of `Session.turn()` (a model), and `UI.enterPlay()` (the
  opening on its card).
- **Notes** (`jot()` in ENGINE; `UI.keep` / `notes` / `selChanged` / `grab`). `st.notes`
  is `[{ id: 'J7', text, src: 'story' | 'mine', turn, day, minute }]`, numbered by
  `st.n.note`. `intent({ t: 'jot', op: 'add' | 'edit' | 'drop' | 'tidy' })` is handled
  **before** the "the tale is over" refusal and outside every turn rule, writes no
  journal entry, moves no clock and rolls nothing.
- **Saves.** `packState` / `unpackState`, format `v: 5` (second push: `notes` and
  `n.note`; a v4 save opens with an empty notes page. Two-mode push, v4: `flags`, `tells`,
  `n.tell`, and on a telling `n`, `src`, `area`, `twin`; a v3 save loads with nothing
  settled and its old tellings unclaimed). A save is the whole state: bible,
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
  **Two-mode push:** `talkTo()` is the pen (model) or `talkCard()` (script: the card is
  the conversation, `ask()` is one question); `thingCard()` / `useThing()` / `used()` are
  verbs on a chest or a lock; `told()` writes a telling with its tally row, `script()` is
  the script speaking, `storyFoot()` the line under a passage (who, what kind, two rating
  marks, the twin); `compare()` / `compareCsv()` the Compare page; `spotted()` / `alarm()`
  / `mustFight()` the strict table; `whoIsHere()` the party sheet at the start; `ending()`.
  The story (`#story`) is a log plus a bar: who speaks, the line, SEND (STOP while the
  Game Master is speaking). The pen is shown only while `Mode.typed()`. `UI.tell` writes an entry into `st.story` and onto the page;
  `UI.chip` is the engine's own line, toasted too when the log is folded. Settings holds
  the key, the model, effort, content rating, when the Game Master speaks, who plays the
  monsters and the three per-task models.
  **Second push:** the story bar gained the narrator's speaker (`#voice-btn`, `UI.voice`)
  and, where a model reads the line, a microphone (`#mic`). `UI.sayBtns()` decides what
  sits at the end of the line field: STOP while a model is telling, else the microphone
  while there is nothing to send and SEND once there is. Every line of a sheet in the
  Party panel is a `.term` button that opens its page of the rule book in the dialog
  (`UI.rule`); the six scores are a row of `.stat` buttons. A telling's foot has a pen
  (`UI.keep`), selected words in the story raise a "+ Note" button (`UI.selChanged`,
  `UI.grab`, `rangeText()` in UTIL), and Notes is a panel of its own (`UI.notes`).
  Settings has a Voice group: the switch, which voice, the pace, HEAR IT, and the two
  settings for listening.

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
  `echo()` also drops text blocks that are empty or only space. The nudge is the
  documented last resort for an empty `end_turn` after tool results, and it must stay
  **once per turn**: the same page warns that text added after tool results on every
  round teaches the model to stop and wait for it (source:
  https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons, read
  2026-10-10). That an echoed empty turn is refused with a 400 is from third-party
  reports of the error text, not seen live. CYOA's client still sends the empty turn
  (`.claude/cyoa.md` § Known, not fixed).
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

The two kinds of Game Master:

- **`Mode` is the only place that decides who does what.** `Mode.ai(area)`, `Mode.typed()`
  (is there anyone to read a typed line), `Mode.strict()` (is the script the only one
  ruling). The engine never asks; an intent means the same thing whoever sent it.
- **The script's words are a pure function of the tale.** `varyOf(st, key, list)` picks by
  a hash of the seed and the key: never a counter, the clock or `Math.random`.
  `beatText()` and `talkOf(st, npc, topic, true)` (dry) must not write to the tale. The
  suite plays the same seed twice and compares the story byte for byte, and asks every
  topic dry and compares the tale before and after.
- **The twin is worked out BEFORE the model is called**, on the tale as it stood (the
  monsters' twin on a copy), and stored on the model's entry as `twin`. Worked out
  afterwards it would describe a board the model had already moved.
- **The plot is derived, not stored.** `chiefOut`, `captiveFree`, `goalMet`, `carries`
  read the board and the packs; `plotCheck()` applies each consequence once, behind a
  flag, and is called after anything that can change the answer (`endFight`, `useOf`,
  `talkOf`, `arrive`). A new consequence is a flag and a branch there, never a line in
  the UI: the model's tools reach the same rule only because it lives in the engine.
- **`st.flags` is all the script remembers.** Keys match `/^[\w:]{1,40}$/`; a loaded
  file's flag that does not fit, or whose value is not 1 to 9999 or a quest id, is
  dropped or made 1. The names in use are listed under THE SCRIPT above.
- **A button is an intent the engine can refuse.** `topicsFor()` and `verbsFor()` say
  what a card offers; `intent('talk')` and `intent('use')` refuse anything they would not
  have offered (`notopic`, `noverb`, `tried`), so a model, a save or a test cannot ask what
  a player could not. Never give a card its own list.
- **Every telling goes through `UI.told()`**, the script's and the model's alike: it
  writes the story entry (keys in a fixed order, for the byte-for-byte round trip) and
  the `st.tells` row the Compare page counts. A rating lives on the row.
- **Being seen is `threatOf(st)`**: an enemy who is awake, on this board, with a standing
  traveller in its sight. The strict table reads nothing else (first sight, a second
  sighting, each step of a walk, whether the cross is on the bar). The monsters' script
  must be able to path to the party or the fight can stand still for ever (the suite's
  player found one, behind a corridor of the fallen): that is why standing down is
  allowed again once the party has broken from their sight.
- **A long rest by the player obeys the bed rule; the Game Master's `rest` tool does not**
  (`by:'gm'`): a model may rule that the party sleeps in a barn. Keep the two apart.
- **Adding a matter at hand or a whisper** is a row in `THREADS_MAIN` / `THREADS_SIDE`
  (TABLES) and a row in `MAIN` / `WHISPERS` with every field section U's first row asks
  for, a consequence in `settleWhisper()`, and a row in section U that settles it with the
  dice forced both ways. Then run the suite's player: every seed must still be winnable.
- **A new tale opens the party sheet by itself** when the script makes the characters; a
  test that begins a tale closes it first (`begin()` in the suite does).

The second push (voice, microphone, notes, rule book):

- **The narrator must never be what something waits for.** Nothing awaits it. And
  `Narrator.stop()` ends the utterance in hand ITSELF (`cut`), which also clears that
  utterance's time limit. Wait for the device to report the cancel instead and two
  things go wrong on a device that does not report it: the new words queue behind a
  sentence nobody is saying, and the old sentence's time limit comes round seconds later
  and cancels whatever is being read by then. The suite has a synthesizer that is rude
  in exactly that way.
- **Whatever moves the table on calls `Narrator.stop()`**: an answer to a tap
  (`UI.script` for anything but a beat), a line sent, STOP, a telling that fails, BEGIN
  on the opening card, `Session.reset()`, a hidden page. A beat is the one thing that
  must NOT: it waits its turn.
- **Any code that changes the line field calls `UI.sayBtns()`** (`send`, `Listen.show`,
  `busy`, the failure path that puts a line back), or the wrong button is left at the
  end of the line: a microphone beside a line waiting to be sent, or no SEND at all.
- **`Listen.drop()` forgets the recognizer before it aborts it.** The recognizer's
  `onend` fires during the abort, and with auto-send on it would send what was half
  heard after the line that was sent by hand.
- **Notes are not the telling's to take back.** A failed telling restores the tale from
  a snapshot; `Session.turn` carries `st.notes` and `st.n.note` across that. And they are
  not the tale's to refuse: `jot` is answered before `st.over` is looked at.
- **The rule book prints a number only if it got it from the engine's helper.** The
  suite rolls every skill and save of every calling with the d20 forced to 10 and
  compares what the dice added with what the book says; it uses every ability outside a
  fight and compares the refusal with the book's "only in a fight". A rule changed in
  the engine with its own copy of the number in the book is how the two would drift.
- **A voice's name is the device's text, not ours**: `el('option', '', name)`, never
  markup. The suite offers a voice named `<img onerror>`.
- **A headless browser has `speechSynthesis` with no voices and a `SpeechRecognition`
  that hears nothing.** Sections X and Y install stand-ins before the page's own script;
  `open()` in the suite turns the narrator off for every other section, so nothing else
  depends on what a test machine happens to be able to say.

## Tests

`drive-cyoa2.cjs` (750 checks, about 225 s) runs the generators inside the real page
across 36 worlds (329 boards) and asserts they are whole, then the engine's refusals,
lazy charting, saves (including a tampered file), the phone flow, tap accuracy at five
viewports after a resize-while-hidden, gestures, keys and the panels (sections A to M,
step 1), then **N sight and fog, O the party, P rounds** (step 2), then **Q sheets,
blows and dying, R the table by touch, S the Game Master's tools, T the Game Master at
the table** (step 3), then **U the script alone, V the script's table by touch, W the
model's share of the table** (the two kinds of Game Master), then **X the narrator's
voice, Y the narrator and the microphone at a model's table, Z notes and the rule book**
(step 3's second push). `CYOA2_ONLY=NOP` runs only
the named sections (A stands for A to I) and `CYOA2_PAGE=<path>` points the suite at a
copy of the page; both are for negative tests and neither prints the GREEN line a gate
looks for. **A watchdog ends a run that is still going after 25 minutes**
(`CYOA2_WATCHDOG_MIN`): `page.evaluate` has no timeout of its own, and a deliberate
break once left a row awaiting a walk that could not start, so the run sat idle for
fourteen minutes and reported nothing.

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
- **S** calls the 26 tools directly: one of each kind of bad input (65 in all), the tale
  compared byte for byte; each happy path; and what the turn context carries, with the
  sharp cases built (someone behind a shut door, a fact about someone far away).
- **T** is the seam with the model. The real client runs against a stand-in for
  `api.anthropic.com` that can refuse, overload, go silent, break its JSON or die half
  way; then `window.__CYOA2_MOCK__` stands in for the model so the table's side (beats,
  the monsters' turn, a tale opened while another is told) can be driven exactly.

The three sections of the two kinds of Game Master:

- **U** is the script with no page under it. Its tables are whole (every thread has a
  giver, a goal and its lines; no line leaves a `{blank}` unfilled on any of 24 worlds,
  about 4,000 lines said),
  and asking it what it WOULD say changes nothing. Then **whole tales are played by the
  suite's own player** (`.claude/tests/cyoa2-player.js`, loaded into the page): it knows
  the intents and nothing else, asks around town, takes the job, climbs the hill, breaks
  off when it is losing, sleeps, buys a draught, comes back, searches what it has won and
  reports. After every intent the engine accepts it checks the tale is still whole. That
  player is how the script was debugged, and it found things no rule row was looking for
  (below). After it, each rule with **the dice made to fall both ways**: every whisper
  pressed and lost on a 1 and won on a 20, every lock picked and forced, the name said to
  the chief.
- **V** is the script's table by touch: the opening on its card, travellers rolled on
  the party sheet, topic buttons, a bed, the shop, a chest, a lock, the cell, sleepers,
  being seen a second time, a blow that fells the chief, the ending, the Compare page and
  its CSV; and that in all of it nothing was asked of any service.
- **W** is the model's share, with `__CYOA2_MOCK__` standing in for the model: who is
  asked for what under each setting, the twin worked out before the model is called, the
  tags, the tally, the monsters' twin played on a copy, an ending the model tells, and
  the key going away in the middle of a tale.

The second push's three sections:

- **X** is the narrator at the script's table, against a stand-in synthesizer that
  records what it is asked to say, takes a set time over each utterance, and can be made
  to hang, to offer no voices, or to drop an utterance without saying so. Text into
  sentences (and the same sentences when fed a letter at a time), which voice, the
  opening read on its card and not twice, the mark and the ducked music measured at the
  moment each sentence is handed over, an answer that interrupts and a beat that waits,
  every kind of silence, a voice that never finishes, a device with none, Settings.
- **Y** is the same narrator where a model is telling (a telling read while it is still
  arriving, one that fails, STOP, a line that cuts in), and the microphone against a
  stand-in recognizer the suite speaks for: guesses replaced by what was settled on,
  speech added after what was typed, auto-send, each way it can fail, a line sent by
  hand while it is open, the areas taken away from the model mid-listen.
- **Z** is notes (the engine alone, in and out of a save, a hostile file, the pen, a
  selection across two passages, the page) and the rule book (a page for every line of
  six callings at three levels, **every number checked against a roll made for it**, and
  the sheet by touch on two phones).

**Not verified:** no request has been sent to the live API from this suite or by hand;
model ids, request fields and prices come from platform.claude.com/docs as read on
2026-10-10. The first real key will be the first real test of the client. **Nor has any
real voice or microphone been heard**: X and Y run against stand-ins, because a headless
browser has neither. Whether a phone lets the first sentence speak, which voices it
lists, and whether it reports a cancel are all still to be found out on a device.

### Negative tests, the second push (2026-10-10, `negtest-copies.py`)

**171 deliberate breaks**: 59 at the narrator, 34 at the model's table and the
microphone, 77 at notes and the rule book, and one in the engine that both halves of
"only in a fight" read. The suite was green at 745 checks when they started.

**On the first pass 10 came back GREEN**, and 9 more were caught only by a crash or a
timeout. Nine of the ten were holes, closed with rows. The tenth was a style rule that
did nothing (`.stat { min-height:48px }`: three lines of text are already taller than
that) and is gone. Run again against the suite as shipped, with the two that had timed
out: **161 of the 171 are caught by a named row, 9 by a crash or a timeout, and 1 was
retired with the rule it exposed.** As with the two-mode push, a second pass of all of
them was not run.

What the nine had in common:

- *The test did the page's job for it.* Two rows called `UI.saveNow()` and then looked
  for the note in the save, so the pen's and the typing's own "save soon" could both be
  deleted unseen. They now flush whatever is waiting, do the deed, wait a second and
  look. Same shape: the row that turned the narrator on did it with the speaker button,
  which asks the device for leave to speak, so the asking on the first touch could go.
- *A value that never varied.* Every note in the suite was written on day 1, so the
  date under a note could have been the words "Day 1". A fighter's strength and
  constitution modifiers are equal, so the book could read the wrong one. The healing
  draught was never asked whether it "matters to the tale".
- *A guard for a path the test did not take.* `Listen.drop()` forgets the recognizer
  before aborting it, so that a half-heard line is not sent by the recognizer's own
  ending. The one row that dropped it did so from SEND, which empties the field first,
  so there was nothing to send either way. The row now puts the page away with the
  microphone open, auto-send on and half a line heard.
- *A desktop forgave what a phone will not.* "+ Note" acts on the way down, because a
  phone lets a selection go before a click arrives. A desktop keeps the selection, so
  the listener could be moved to `click` and still pass. The row now looks between the
  press and the release.
- *An input that took any word.* A note's `src` is `story` or `mine`; nothing asked what
  became of `theirs`.

The first of those is the one to carry forward: **when a row needs something saved,
shown or primed, check whether the row itself just did it.**

### Negative tests, the two kinds of Game Master (2026-10-10, `negtest-copies.py`)

**249 deliberate breaks** in two batches: 126 aimed at the script and the engine under
it (the tables, talk, things, locks, loot, the plot, rests, the generator fallbacks), 123
at the table and the model's share (the cards, being seen, the story's feet, the twin,
Settings, Compare, the session). The suite was green at 645 checks when they started.

**On the first pass 24 came back GREEN** from the sections they were aimed at, 12 in each
batch, and 22 more were caught only by a crash or a timeout (a row that throws, or waits
8 to 15 seconds for something the break had removed). Of the 24:

- **20 were holes in the suite**, closed with rows (below);
- **3 have no observable effect** (table below);
- **1 was a line of the page that did nothing**: `bedPrice()` asked whether the beds
  were free, and so did both of its callers before they looked at the price. The
  redundant test is gone.

**Where it ended.** Once the rows were written, the 24 green breaks, the nine that had
been caught only by a timeout and the 23 aimed at rows that had been rewritten were run
again against the suite as shipped: **223 of the 249 are caught by a named row, 22 by a
crash or a timeout, 3 have no observable effect, and 1 was retired with the line it
exposed.** A second pass of all 249 was NOT run. Step 3's second pass found four holes
its first could not (a row fixed for one break had been the only thing catching
another), so that is a known gap here, not a formality skipped.

What the 20 had in common:

- *A sample without the sharp case, three more times.* "Thieves' tools roll one die,
  bare hands keep the lower of two" was judged on two dice where the FIRST happened to be
  the lower, so "the lower" and "the first" were the same number and the tools could be
  deleted. "The purse follows the calling" was rolled on a seed whose new calling starts
  with the same gold as a fighter. Compare's Good and Poor columns were checked with one
  thumb up and one down, so a column could count its neighbour's. Each row now builds the
  case: two dice chosen so the first is higher (and, for the crowbar, lower), a seed
  searched for until the purse differs, two up and one down.
- *A rule hidden behind its own fallback.* The keeper who finds no square in their own
  room is tried in every other room, and failing that in the yard. With the first
  fallback deleted the second caught everyone, and the row only asked "is the keeper on
  the board". It now counts keepers standing outdoors (1 in 1,200; 23 without the rule).
- *The page's half of a rule, when only the engine's half had a row.* The engine says a
  failed word to the chief means a fight (`next: 'fight'`), and the page has to start
  one; the engine returns what a fight's end settled in the plot, and the page has to say
  so; the model's deeds have to be held against the plot afterwards. All three were
  tested where they are decided and not where they are carried out.
- *Something shown that no row read.* The difficulty on a lock's BUTTON was checked, the
  difficulty the dice were rolled against was not (they are separate expressions, and
  "three harder to force" lived in only one). Same for what the ending says of the
  whispers, the ledger in the desk, the journal's lines for talk and for things, the
  word on the chief's own card, and the digest still advertising a strongbox after it
  had been emptied.
- *A setting saved but never loaded in a test.* Every page in the suite was opened with
  the areas it wanted, so "what was chosen is what is loaded" had no row; nor had the
  case that tells `Mode.strict()` apart from "the model has nothing": a narrator alone.

Two things the pass found that were not holes. **A break that hangs the suite:** with
the pen offered where nobody reads it, a later row sat awaiting a walk that could not
start, for fourteen minutes, at no CPU, printing nothing. `page.evaluate` has no timeout.
The suite now has a watchdog (above). **And two of the three no-effect breaks are code
that guards a case today's worlds cannot produce**, which is worth knowing before
deleting either:

| Break | Why nothing can see it |
|---|---|
| "a whisper already heard is not heard again" removed from `hearWhisper()` | both callers (`talkOf` on news, `plotCheck` on finding the ledger) already ask whether it has been heard |
| "Hidden here" in the digest allowed on every board, not only the hideout | `lootOf()` answers only for a cave, and a world has one |
| the script made to "tell" a `create` beat | it has nothing to say for one (`beatText` returns nothing), and the only other thing a telling does is mark the place told, which the opening before it already did |


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
For the second push add: **the narrator on a real phone.** Does the first sentence
speak (the silent utterance on the first touch is there to earn that, and has only ever
met a stand-in)? Which voices does Safari list, and is "whatever this device is set to"
the better default there? Does a tap on the story stop it at once? And the microphone
in Safari and in Chrome on Android, which is the only place it can be tried at all.
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

From the second push: a way to SAY a topic at the script's table (the microphone is
offered only where a model reads the line; a topic's name spoken and matched to its
button would give the script's table a voice in both directions); the words lit in step
with the voice; rule pages opened from a card on the board and from a dice line in the
story, not only from the sheet; notes the Game Master can be shown; a voice per speaker.
Paid voices were offered and declined (the CD: device voice only).

From the two kinds of Game Master: a blind pick between the script's telling and the
model's (offered to the CD, not chosen); a second adventure once the hill is taken (the
ending leaves the party wandering a town with nothing left to ask); a script for more
than one matter at a time; loot off anyone but the chief; things to search outside the
hideout; a price for what the party sells; more than one line of small talk per kind of
person per whisper; the script's lines read by someone other than their author (every
one is mine, and the CD has not seen them); a rating scale finer than up or down; the
Compare page across tales rather than one tale at a time (the CSV is the only way to
add two tales up today).

From step 3 (first push), still open: opportunity attacks and reactions; conditions that
do something on the board (prone, restrained are honoured only as advantage); hiding and
stealth; places the Game Master makes up; a way to undo a mis-tapped blow (there is none,
as at a table). Done since: an ending, a key for the cell, the chief's keys off the
fallen, a shop with prices, and a party of one or two that can win by coming back.

From step 2: bystanders who move (a town that goes about its day); a marching order the
player sets, instead of nearest-first; dashing and difficult ground beyond furniture;
light sources carried and put out (the cave's 8 squares is "someone has a torch");
stealth, so that being in sight and being noticed are two things; a "last seen here"
ghost for a bandit who walks out of sight; the dice as a pluggable source for the
physical table (the engine's `d20` is the only place a roll is made).

## Working source

**The shipped `index.html` is the source of truth.** It was written as parts in a session
scratchpad (eleven files and a `build.sh`), and those are gone when the container is.
To get parts back, split the page at its banner comments:

```
python3 .claude/scripts/page-parts.py split games/cyoa2/index.html <scratch dir>
#   27 parts: 00-head.html (CSS and markup), 02-util.js ... 11-engine.js,
#   12-game-master-tools.js, 13-the-script.js, 14-rule-book.js,
#   15-game-master-context.js, 16-game-master-client.js, 17-costs.js, 18-art.js,
#   19-view.js, 20-audio.js, 21-storage.js, 22-voice.js, 23-ui.js, 24-session.js,
#   25-boot.js, 26-tail.html
python3 .claude/scripts/page-parts.py join  <scratch dir>     # byte for byte, then the parse check
python3 .claude/scripts/page-parts.py check <scratch dir>     # was the page edited behind the parts?
```

`stamp-badge.sh` edits the shipped page, so after stamping the head part is stale: run
`check`, and `split --force` again before the next edit (that drift happened once on
2026-10-10 and was only caught because the parts were compared with the page by hand).
For one function, `.claude/scripts/replace-fn.py` on the page itself is still quicker.
A new section needs a banner (`/* ============================== NAME`, twenty `=` or
more at the start of a line) or it will ride in its neighbour's part.

The break lists are scratch too: their generators are gone, the traces above are the
record. `negtest-copies.py` runs a list if one is written again.
