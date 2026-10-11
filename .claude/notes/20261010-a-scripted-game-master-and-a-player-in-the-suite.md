# A scripted Game Master, and a player in the suite

From CYOA2, 2026-10-10: the CD asked for a default mode that is "deterministic scripted
everything", with the model as something to add area by area and compare against. Full
detail is in `.claude/cyoa2.md`; this note keeps what generalises.

## A deterministic narrator is tables and a hash, and the hash is the whole trick

The script picks every line with `varyOf(st, key, list)`: a hash of the seed and of what
the line is about (`enter:S3`, `fight:S2:1:612`). Not a counter, not the clock, not
`Math.random`. Three things fall out of that one choice, and none of them was the reason
it was made:

- **The same tale played twice says the same words**, so a suite can compare a story
  byte for byte, and a player who reloads does not hear a different inn.
- **Asking what the script WOULD say costs nothing and changes nothing.** `beatText()`
  and `talkOf(..., dry)` are pure, so a card can show an answer before it is given and a
  test can ask every question of everyone on 24 worlds without moving the tale.
- **The twin.** With a model narrating, the page asks the script for its version of the
  same moment first and keeps it under the model's passage. That only works because
  asking is free and repeatable; a narrator with a counter in it would have advanced.

The one counter the script does keep (how far someone has got through their small talk)
is a flag in the save, read but not advanced when asked dry. Wherever "the next one" is
wanted, make it state, not a side effect of asking.

## Derive the plot; store only what cannot be derived

The first sketch had quest stages in the save. What shipped has none: `chiefOut()`,
`captiveFree()`, `goalMet()` and `carries()` read the board and the packs, and
`plotCheck()` applies each consequence once behind a flag. The reason is the second
Game Master. A model can end the chief with a tool call, a player can do it with a
sword, a save can be edited by hand, and in all three the plot is whatever is true. A
stored stage would have needed every one of those paths to remember to advance it, and
the model's path is not code anyone here writes.

The rule that came out of it: **when two different actors can change the world, state
that summarises the world belongs to neither.** Compute it.

## The suite's own player found what no rule row was looking for

Section U loads a small player into the page (`cyoa2-player.js`). It knows the intents
and nothing else: ask around, take the job, climb the hill, break off when losing, sleep,
buy a draught, come back, search, report. After every intent the engine accepts, it
checks the tale is still whole.

It asks a question no rule row asks: **can this be finished, on every seed?** And the
answers were not about the script at all:

- **A fight that could never end.** Corpses filled a corridor, the monsters' script could
  not path to anyone, nobody could act, and the round counter reached 799. No rule was
  broken. The fix was a rule about being seen (`threatOf`), not about pathing.
- **A traveller "stable at 8 hit points".** A level earned while lying at 0 had healed
  them without standing them up. Every state field was individually legal.
- **A smith with nowhere to stand.** In about one forge in thirteen the furniture left
  the keeper no square, so on those seeds one whisper could never be settled.

Each of these is a *reachable* state that is wrong, on a small fraction of seeds, with
every invariant green. A rule row checks that a rule holds where the author thought to
look; a player wanders. For any game with a generated world and a win condition, a
player that plays to the ending across many seeds is worth more than the next hundred
rule rows, and it doubles as the balance instrument (four travellers: every tale in
about two climbs; one alone: 23 of 24 within eight).

## Negative tests, fourth pass: the same lesson, and a new one

249 breaks; 24 green on the first pass; 20 real holes.

**The sharp case, again, three times in one day** (see the step 3 note for the first
three). The new instances are worth having as patterns because each looked like a
proper row:

- "With tools one die is rolled; without, the lower of two" was checked on two dice that
  happened to come up with the first one lower. Then "the lower" IS "the first". When a
  rule chooses between two values, the test data must make the choices *differ*.
- "The purse follows the calling" was checked on a seed that rolled a calling with the
  same starting gold. Search for a seed where the answer changes, and fail if there is
  none.
- Two columns were checked with one item in each. Use lopsided data (two and one) or a
  swap is invisible.

**New: a rule hidden behind its own fallback.** A keeper with no square in their room is
tried in every other room, and failing that in the yard. Delete the first fallback and
the second catches everyone, so "the keeper is on the board" stays true. A chain of
fallbacks needs a row per link, each asserting *which* link caught it (here: how many
keepers stand outdoors).

**New: a break that hangs.** One break left a row awaiting a walk that could never
start. `page.evaluate` has no timeout, so the suite sat for fourteen minutes at zero CPU
printing nothing, and the batch behind it sat too. A gate that can wait for ever needs a
watchdog that turns the wait into a red line (`CYOA2_WATCHDOG_MIN`). A low load average
on a machine that is "running tests" is the tell.

**And one green break was right.** `bedPrice()` asked whether the beds were free; so did
both callers, first. Deleting the test changed nothing because it did nothing. A break
that cannot be caught is sometimes the suite's fault and sometimes the code telling you a
line is dead; look before writing a row for it.
