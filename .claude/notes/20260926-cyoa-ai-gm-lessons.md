# CYOA: lessons from building an AI-narrated game (2026-09-25/26)

Root causes and non-obvious facts from the CYOA session (`games/cyoa/`, context in
`.claude/cyoa.md`). Each one cost time, and most are easy to reintroduce.

## 1. `Selection.toString()` loses the space after a one-letter drop cap

**Symptom:** a note taken from the start of a passage read "Awolf lunges" instead of
"A wolf lunges". Seen in a screenshot, not in the suite.

**Cause:** passages style their first letter with `::first-letter` floated as a drop
cap. `Selection.toString()` follows the *rendering*, and the float makes the space that
follows a one-letter word the leading whitespace of the next line box, which is
collapsed. A drop cap that is part of a longer word ("Rain") loses nothing, which is
why the first version of the check passed.

**Fix:** read the selected words from the DOM with `rangeText(range)` (walk
`range.cloneContents()`, join block elements with line breaks). The suite row now
selects "A wolf ..."; the negative test (`sel.toString()` back in) goes red.

## 2. iPhone voices, as the web sees them

- Apple names a downloaded voice plainly ("Zoe") and keeps its tier in the id:
  `com.apple.voice.premium.en-US.Zoe`, `...enhanced...`, `...compact...`. Match the tier
  on `name + ' ' + voiceURI`. Penalise "compact" by **name only**: every stock voice's
  id is compact, and penalising the id would rank a different language above them.
- The CD downloaded Jamie (Premium) and it never appeared in `getVoices()` at all
  (assumed: Safari hides downloaded voices from pages as anti-fingerprinting). Nothing
  a page does can select it by name. The "This device's own voice setting" entry sets
  no `voice` and no `lang` on the utterance; whether iOS then speaks in the downloaded
  voice is unverified.
- `voiceschanged` may not fire for a voice downloaded while the page is open, so the
  list is re-read on Settings open, on `visibilitychange` and at every `pick()`.
- In the current iOS the menu is Settings > Accessibility > **Read & Speak** > Voices
  (formerly Spoken Content).
- **Testing:** Chromium throws if `u.voice` is set to anything but a real
  `SpeechSynthesisVoice`, so a fake engine must replace `SpeechSynthesisUtterance` as
  well as `speechSynthesis` (both via `addInitScript`), and its `getVoices()` must
  return a **fresh array** each call, or a refresh bug is invisible.
- The Anthropic API has no speech output (source: the claude-api skill's endpoint
  list), so a better narrator needs an OpenAI or ElevenLabs key.

## 3. Paid pictures: only for a finished reply's state

Paintings are keyed per topic (`seed|place|topic`). The first version asked for one
whenever the plate was drawn, and two states were drawn that should never be paid for:

- **The blank page before the opening** (turn 0). The opening's own `set_scene` turns
  the topic over at once, so every new game bought two paintings ($0.08) and showed
  one. Caught by the suite's "one request for the place" row.
- **The mid-turn copy.** `gmTurn` refreshes the HUD from the uncommitted `work` state
  as tools run. The same mistake in another shape was an earlier bug: the art path
  checked `G.st.here` while drawing from the copy.

Rule: `committed = st === G.st && st.turn > 0`; anything else only draws a cached
painting. The plate key carries a `|c` suffix when committed, so the redraw after the
commit is never skipped as "same key".

## 4. Billing

- Price the model that **served** the reply (`message_start.message.model`), not the
  one requested: a server-side fallback on Opus 5.5 answers as another model.
- A stream can die after `message_start`: its usage must ride out on the thrown error
  (`ge.usage`) or the spent tokens vanish. A 401 carries no usage and costs nothing.
- A failed turn is rolled back but still billed; the ledger line is kept.
- **Accumulating rounded values drifts.** The voice line summed clip seconds rounded
  to 0.1 at every step: two 0.25 s clips gave 0.6 s. Store unrounded, round on display.

## 5. Determinism: derived state goes through the engine

- The clock's per-exchange step is computed outside the engine (it needs the
  narrated word count) but applied with `exec(work, 'advance_time', ...)` and **logged
  as an event**, or a replay of the log lands on a different minute. Same for the
  picture's moments: `exec` records them via `noteScene()`, so a load draws the same
  picture.
- Tool results carry `clockText()`, and `restore` compares every replayed result with
  the logged one. Changing that string's format makes every old save report
  mismatches, so the header uses its own `hudClock()`.

## 6. Small things that cost a round trip

- The plate fades for 260 ms before `canvas.dataset.key` updates; a check that reads
  the key right after a turn sees the old picture.
- The "+ Note" button acts on `pointerdown` with `preventDefault`: a `click` arrives
  after the tap has already collapsed the selection. Clamp it on screen: a selection
  scrolled out of view put it at a negative `top`.
- On the phone header, the clock line wrapped to two lines and pushed the place name
  out of view. The fixed-height header has room for one line only.
