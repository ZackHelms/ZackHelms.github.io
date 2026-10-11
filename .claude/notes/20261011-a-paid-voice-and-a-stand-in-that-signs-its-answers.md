# A paid voice with a free fallback, and a stand-in service that signs its answers

From CYOA2, 2026-10-11. The CD played the scripted table, found the device's own
narrator voice "unbearable", and asked for CYOA's paid one (OpenAI's speech on the
player's own key). Full detail is in `.claude/cyoa2.md`; this note keeps what
generalises.

## Make the stand-in's answers say which request they answer

The page asks a speech service for one clip per sentence, three at a time, and plays
them in order. The questions worth asking are all about WHICH clip: was the first
sentence played first when its sound came back last; was the sentence that got cut off
the one in hand; did the sentence that failed get read by the other voice, in its place.
None of that can be read off the page without adding a label to the page's own objects,
which is test code in the shipping file.

So the stand-in signs its answers instead. Every reply is a silent WAV **whose length is
that request's own** (0.12 s, 0.13 s, 0.14 s...). The suite watches the page's sound
where it leaves (`AudioBufferSourceNode.prototype.start`, wrapped before the page's
script runs) and matches each clip's duration back to the request, and so to the
sentence. The page under test is untouched and knows nothing about it.

The shape is general: **when the thing under test moves opaque payloads around, give
each payload a property the page has no reason to change and the test can read at the
far end.** A length, a size, a colour, a checksum. It is the difference between "three
things were played" and "the right three, in the right order".

And, as with the fake synthesizer in the step 3 note: **record the page's state inside
the hook**, not afterwards. "Was the passage marked while the clip played" is a race
when asked later and a fact when asked at `start()`.

## A fallback ladder, when the fallback is the thing the user is escaping

CYOA's paid voice gives up for the whole visit on the first failure of any kind and
reads on in the device's voice. That is the simple rule and it is fine when the fallback
is acceptable. Here the fallback is exactly what the CD asked to be rid of, so a single
dropped request should not cost the rest of the session:

- one sentence that fails is read by the device's voice, and the paid voice has the next;
- a **refusal** (a bad key, a voice that does not exist) is final at once, with the
  service's own words in the notice;
- **three failures running** are final too;
- any change to the settings, or pressing "Hear it", tries afresh.

The general point: **how eagerly to fall back depends on how bad the fallback is, and
that is a product fact, not a technical one.** Ask what the user was getting away from.

## Whoever lets go stops listening first

A sentence's sound can be let go three ways (silence, an answer cutting in, the queue's
cap). Each sets the sentence's `done` flag and only THEN calls off the request, and both
handlers on the sound's promise begin `if (done) return`. That one ordering buys three
properties: a stop is never counted as the service's failure, the other voice does not
read the sentence instead, and sound that could not be called back in time is not played
into the silence that was asked for.

It also meant the failure counter never needed to know what a "stopped" error looks
like. The first draft tagged those errors and checked for the tag; the negative tests
could not make that check matter, because nothing ever reached it.

## The break list found dead code before it found holes

174 deliberate breaks were aimed at the new code. Writing them was worth it before a
single one was run: three lines turned out to be deletable with nothing changing, which
is to say dead.

- A check for "already called off" before sending a request. The browser refuses a
  request whose signal is already aborted, so the check changed nothing.
- A loop that called off queued sounds when the paid voice was given up on. Each
  sentence calls off its own sound when its turn ends, a moment later.
- Re-enabling a button that the very next line re-rendered.

The earlier note said a break that cannot be caught is sometimes the code telling you a
line is dead. The addition: **you can hear it while writing the break, before running
anything.** If you cannot say which row should go red, look at the line first.

Run, 7 of the first 168 came back green, all of them holes in the rows. Three shapes
were new to this repo's list:

- **A second copy of the value hid the first.** The key is kept in storage AND in
  memory. Delete the read of the visit's storage and the memory copy answers for it, in
  the same page load. The row has to empty memory first, which is what a reload does.
  Any cache in front of a store needs a row that goes round the cache.
- **The state was already what the deed would make it.** The cursor was in the field
  before the button was asked to put it there. Every key the suite typed was typed with
  the "remember" box ticked. Start a row from the OTHER state.
- **A rule about what comes after the failure.** "Once given up on, the device reads on"
  was only ever tried on tellings where every sentence failed, so there was no later
  success for the rule to overrule.

## Two small traps in the rows themselves

- `[null, null, 'x'].join('/')` is `//x`, not `null/null/x`. A row that compared a
  joined list of `getItem()` results against a string with the word `null` in it failed
  on correct code. Map through `String` first.
- A row about a time limit has to **assert the time**. "A request that is never
  answered is given up on" would have passed with the limit changed from the test's
  0.3 s back to the default 12 s, because the row only checked what happened in the end.

## A wait that crashes hides every row after it

Nine breaks were "caught" only because a `waitForFunction` timed out and took the run
down with it. That is red, but it is one unreadable line instead of the row that names
what broke, and nothing after it runs. The section's waits now give up quietly
(`.catch(() => {})`) and leave the verdict to the row that needed the thing waited for.
Keep the crash for what is truly fatal (the page did not load); everywhere else, a wait
is not an assertion.
