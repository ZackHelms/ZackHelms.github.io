# Negative tests at scale (343 breaks), and a Game Master on a board

From CYOA2 step 3 (2026-10-10): sheets, blows and dying on the grid; a script that plays
the monsters; Claude as Game Master over the player's key, acting through 25 engine
tools. Full detail is in `.claude/cyoa2.md`; this note keeps what generalises.

## A green suite of 390 checks let one break in three through

Step 3 was written with its suite alongside: four new sections, 214 checks, the whole
suite green at 390. Then deliberate breaks were aimed at it, each a one-line change to a
rule the page is supposed to keep. **On the first pass 129 of 335 came back GREEN from
the section they were aimed at** (engine 41 of 118, tools 49 of 81, client and session 19
of 88, page 20 of 48). Six were changes with no observable effect (below) and two would
have been caught by another section. The other 121 were rules no row held. Closing them
took the suite from 390 checks to 511. It had not been careless; it had been written by
the same hand as the code, in the same hour, and it tested what that hand thought of.

The holes were of six kinds, and each has a cure worth keeping.

1. **A rule that only matters on a rare die.** Hundreds of fights were played out with an
   invariant checked after every deed, and "a natural 1 always misses" never failed with
   the rule removed, because a 1 that would otherwise have hit needs a +15 bonus or an
   armour class of 5. Same for the death saves (a 20, a 1, the third failure) and "a
   check that meets its DC exactly succeeds".
   *Cure: make the dice state.* Every deed draws from one generator seeded by the tale
   and a counter in the save. A test sets the counter to where the wanted number comes
   up next (`force(st, 20, 1)`) and the rule is exercised on demand, through the real
   code path, with no test hook in the page.
2. **A refusal that came from an earlier check.** "Inspiration never to oneself" passed
   with the rule removed: the bonus action was already spent, so the call was refused
   anyway, for a different reason. "A weapon nobody carries" was refused as "no action
   left". *Cure: assert the reason (`why`), not that it was refused, and arrange the
   state so only the rule under test can say no.*
3. **A sample that never held the sharp case** (the step 2 lesson, again). "The digest
   marks IN SIGHT exactly those the party can see" was checked in the town square, where
   everyone was in sight. "A rest is refused exactly when an enemy is in sight" was
   checked after won fights, when none was. *Construct the case; do not wait for it.*
4. **"Refused" is not "validated".** Remove a tool's validation and the call often still
   fails: the tool throws on the bad input and `exec` puts the tale back. Safe, and
   invisible to a row that only asks for `ok:false`. Where the error text matters to
   the model, assert the text.
5. **Nothing looked at the wire for the unhappy paths.** The request shape was checked;
   what goes back after a refused tool call (`is_error`, the reason), after a reply
   with no words, after broken tool JSON, after a 529, after a refusal, was not.
6. **The busy lock was checked at one door.** A tap was turned away while the Game
   Master spoke; a blow, a rest, an export and a second line were not tried. *When a
   guard is repeated at N entry points, the row calls all N.*

Also: **fixing one row disarmed another break.** Making "never to oneself" assert its
own reason removed the only row that had been catching "no bonus action left" by
accident. And three breaks that read as caught were being "caught" only by a flaky row
(below). **Re-run the whole list after closing holes, not only the ones that were
missed**: the second full pass found those four.

And the old lists again. Step 2's lesson was that a new feature disarms older rows, so
the 77 breaks of steps 1 and 2 were re-run. One came back green: "the last finger of a
pinch is not a tap", for the third step running. This time the cause went deeper than
geometry. In a synthetic `touchEnd`, the finger listed is the one that LIFTS; the row
had always believed it was the one that stays, so it had been checking the ground under
the wrong finger, and passing or failing by what happened to be under the other. The row
now asks the page where it thinks the remaining finger is, slides the table until open
ground is under it, and afterwards requires a real tap on that square to walk.
**A row that says "nothing happened" needs a twin that shows something would have.**

The same hole was then looked for where the row had been copied from, and found: Ember
Depths' suite had the identical pinch row, written from the same wrong note. One break
(reset the latch when a pinch drops to one finger) came back green against it; the row
was rebuilt the same way and now fails by name. The semantics are measured rather than
remembered now (`.claude/scripts/probe-cdp-touch.cjs`, table in
`20260724-headless-mobile-game-testing.md` § CDP multi-touch), and both older notes
carry a dated correction. **When a row turns out to rest on a wrong belief, grep for
the belief, not for the row.**

## The breaks found bugs, not only missing rows

- **An empty message.** Writing the row for "the model calls its tools and then says
  nothing" showed the client echoing that empty reply back as an assistant turn. That
  reply is a documented case, not an exotic one: an empty response with `end_turn`
  "typically occurs ... particularly after tool results", and the documented last
  resort is a continuation prompt as new user input, never the empty reply sent back
  (source: https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons,
  read 2026-10-10). The nudge now joins the last user turn. That an echoed empty
  assistant turn is answered with a 400 ("all messages must have non-empty content
  except for the optional final assistant message") is from third-party reports of
  that error text, not reproduced here: there is no key in the build container. The
  same page warns against the opposite habit, text after tool results on EVERY round
  (the model learns to stop and wait for it), so the nudge stays a once-per-turn last
  resort. CYOA's client still echoes the empty turn (`.claude/cyoa.md` § Known,
  not fixed).
- **A save that had not landed.** One row (reload, Continue, compare) "caught" seven
  breaks that had nothing to do with it. It saved, waited 400 ms and reloaded; under two
  browsers on two cores the write had not finished. `UI.saveNow()` now returns its
  write and the suite awaits it. **A row that catches unrelated breaks is flaky, and a
  negative-test run is the cheapest flake detector there is.** (It failed once more
  afterwards, 1 run in 18 under load, with the API key missing from localStorage after
  the reload. Not reproduced in 12 further runs and not explained. The page was
  rewriting an unchanged key on every Settings action, remove then set; it no longer
  does. If that row ever fails again its message now prints what storage held before and
  after the reload.)
- Earlier in the same step, from the rows themselves: a store write handed live
  references (the next telling leaked into the save), and a board lookup that lost a
  monster when two had shared a square in passing.

## Equivalent changes: say so, do not force a row

Six breaks cannot be seen by any row because the code they remove is covered by
another guard: a second "the tale is over" check behind the first, a deed cap on a
script that already cannot loop, a `min-width:0` that today's labels do not need. Each is
listed in `.claude/cyoa2.md` with why. The honest record is "caught, or shown to be
equivalent", not a row contorted to fail.

## Negative tests on copies (`.claude/scripts/negtest-copies.py`)

`negtest-batch.py` breaks the shipping file in place, one break at a time. At this
scale (343 new breaks and 77 old ones, most of them run two or three times) that cost
three things in one afternoon:

- an interrupted run **left its break live in the shipping file**, twice (restored with
  `negtest.sh restore`, verified against a clean build);
- the suite could not be edited while a run was going;
- 90 breaks at 25 s each is most of an hour, serially.

The new runner applies each break to a fresh copy in a scratch directory and points the
suite at the copy through an environment variable the suite reads (`CYOA2_PAGE`). The
shipping file is never touched, the suite can be frozen (`--freeze`) and edited
meanwhile, and breaks run two at a time. A suite needs one line to support it, plus the
rule that it never prints GREEN when pointed at a copy.

Two cautions it prints for itself: more jobs than cores makes timing rows flaky; and a
break caught only by a crash or a timeout (`CAUGHT-BY-CRASH`) should be read, and given
a named row if it is cheap (a stand-in server that relents on the fourth request turns
"the client never gives up" from a 15 s timeout into a count).

## A model at a board: what made it work

- **A finger and the model send the same intents.** The tools are thin wrappers round
  the engine calls a tap makes, so there is one judge. The model never does geometry:
  it names things by the ids of a text digest (`move P1 toward N0`) and the engine finds
  the squares.
- **Free play, told afterwards.** Walking, doors, blows and abilities resolve at once
  and cost nothing. Each leaves one line (a "chip") in the story, and the next telling
  is given every chip since the Game Master last spoke. That list is the whole bridge
  between a board that moves by touch and a narrator who was not asked.
- **The opponent is a script by default.** A fight must not stall on a network or a
  bill. The script is asked for one intent at a time so the table can show each deed;
  the model can take the monsters' turns as a setting, once per turn, and whatever it
  leaves or fails at the script finishes.
- **Live tool calls, whole-turn rollback.** The board moves while the model works
  (better to watch than a staged copy that commits at the end), so a failure must put
  the whole tale back from a snapshot. The price: every way of acting is locked while a
  telling runs, nothing is saved mid-telling, and every `await` is followed by "is this
  still the tale I was telling?".

## Tooling gotchas met on the way

- The file-writing tool turns `\uXXXX` escapes into the literal characters. A later
  search-and-replace must match the literal character, not the escape.
- `pkill -f <pattern>` matches the shell that is running it when the pattern is in its
  own command line. It killed the session's shell mid-restore.
- A background job started from a tool call dies with an interruption unless it is
  detached (`setsid nohup ... &`), and dies with a container restart regardless: make
  runs resumable, or make them leave nothing behind (copies do).
