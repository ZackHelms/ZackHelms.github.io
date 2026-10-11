# A scripted Game Master, a player in the suite, and a voice with nobody to hear it

From CYOA2, 2026-10-10: the CD asked for a default mode that is "deterministic scripted
everything", with the model as something to add area by area and compare against. Then,
the same day, the second push of step 3: a narrator's voice, a microphone, notes and a
rule book. Full detail is in `.claude/cyoa2.md`; this note keeps what generalises.

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

## A voice with nobody to hear it (the second push, the same day)

The narrator reads the tale in the device's own voice, and a line can be spoken where a
model reads it. Neither can be tried in the place the suite runs: a headless browser
has `speechSynthesis` with no voices in it and a `SpeechRecognition` that never hears
anything. Three things came out of building it anyway.

**Bring a stand-in that misbehaves, and install it before the page's script.** The
suite's synthesizer records every utterance *together with what the page looked like at
that instant* (which passage wore the mark, whether the music was ducked, whether the
button was lit), takes a set time over it, and has three switches: hang for ever, offer
no voices, and be **rude**, which is to drop what it was saying on `cancel()` and fire
neither `end` nor `error`. Each switch is a property that could not otherwise be
stated, let alone tested: "a stalled voice costs one sentence", "a device with no voice
is silent, not stuck", "silence does not wait for the device to agree". Recording the
page's state inside `speak()` matters more than it looks: asked afterwards, "was the
passage marked while it was read" is a race; asked at the moment of the call, it is a
fact.

**A queue of sentences, and two classes of telling.** One utterance per sentence means a
model's first sentence is being read while its last is still arriving, a stall costs a
sentence, and silence is immediate. The policy that made it livable is two words long:
*an answer interrupts, a beat waits.* What someone says in answer to a tap cuts off
whatever was being read; narration nobody asked for queues behind it. One rule for
everything (always interrupt, or always queue) is wrong half the time in either
direction: the voice is either talking over a person or still describing the last room.

**Stop must not wait to be told it stopped.** `Narrator.stop()` ends the utterance in
hand itself and clears that utterance's time limit. The obvious version (cancel, then
carry on when the device fires `end`) has two failures on a device that never fires it,
and the second is nasty: the old sentence's watchdog comes round seconds later and
cancels whatever is being read by then. Any "cancel and restart" over an API whose
callbacks are advisory needs the same shape: resolve your own promise, disarm your own
timers, and treat the callback as a courtesy.

**What is still unknown is listed, not guessed.** Whether a phone lets the first
sentence through, which voices Safari will list, and whether it reports a cancel are in
`TODO.md` as things only a device can answer. The 90 ms left between a cancel and the
next utterance is a precaution from reports, never observed here, and is labelled as
one where it is defined.

