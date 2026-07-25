# Mic input, async-versus, and generator fairness gates that aren't bots

From the 2026-07-25 batch that shipped **Sky Lantern** (mic-blow flight) and
**Signal Hunt** (pan/pinch hidden-object with shareable duel codes). Both were
new-facet-value games rather than gap-fillers, so most of what follows is the
first time this repo has done any of it.

## Microphone as a game input (sky-lantern)

- `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false,
  autoGainControl:false}})` — all three defaults actively fight a breath
  controller. AGC in particular makes a sustained blow fade out.
- Connect the stream to an `AnalyserNode` **only**. Connecting it anywhere that
  reaches `destination` is a feedback loop through the phone speaker.
- Time-domain RMS is enough; no FFT needed. Blowing, humming and speaking all
  read the same, which is a free accessibility win — say so in the menu copy.
- The noise floor must be **asymmetric**: fall fast toward quiet, rise very
  slowly. A symmetric tracker lets a sustained blow drag the floor up under
  itself and the input dies mid-breath.
- Keep the RMS→input mapping a **pure function** (`breathFromRms(rms, floor,
  sens)`). The drive tests it directly — silence, room tone, saturation,
  monotonicity, sensitivity ordering — with no mic and no mocking.
- Make the game drivable without a mic: `sampleMic()` returns early when the
  analyser is null, so a test sets `inputMode='mic'; micAn=null; micBreath=0.8`
  and exercises the whole flight path deterministically.
- Always ship a touch fallback and surface which mode is live. Permission
  denial is common and silent failure looks like a broken game.
- iOS needs the permission request on a user gesture — hang it off the same tap
  that starts the round.

## Async versus over a share code (signal-hunt)

The pattern, now proven and worth reusing on any seeded game (blade-spin,
vault-breaker, ballpark, word-circuit are all candidates):

- A score is meaningless without the seed, so put **both in one code**:
  6 base-36 chars seed + 4 base-36 chars score + 1 checksum char.
- **The seed space must fit the code.** The drive caught `slice(-6)` silently
  truncating any seed ≥ 36⁶ — roughly half of all random seeds — which would
  have handed the rival a *different grid* while looking like it worked. Define
  `SEED_MAX = 36^6` and reduce every seed source mod it (random, daily hash).
  Generalised rule: **if you encode an id, generate the id inside the encodable
  range** — don't encode-then-hope.
- Checksum so a retyped code is rejected, not silently mis-loaded. Strip all
  non-alphanumerics on parse so a code survives a text message.
- Ship it as a URL hash (`#h=<code>`) *and* a paste field.
- **Wire `hashchange`, not just a boot-time read.** Tapping a challenge link
  while the page is already open is a same-document fragment navigation —
  nothing reloads, and a boot-only parse never sees the new code. This is the
  normal case when a friend sends a second challenge.
- A drive test proves the duel is honest: same seed → byte-identical world.

## Fairness gates: prefer physics to autopilots

The most expensive lesson of the batch. Sky Lantern's first fairness gate was
"can a scripted autopilot finish every level", and it burned many iterations
because **a failing bot doesn't tell you whether the level or the bot is
wrong**. Measured instrumentation showed the bot spending 26 of 58 seconds
producing no altitude — a bot problem wearing a level-design costume.

What actually worked was three gates derived from the game's own constants:

1. **Corridors exist** — sweep the level, assert a free lane wider than the
   player at every position.
2. **Corridors are reachable** — solve the player's real equation of motion
   (`v' = a - kv` has a closed form) for the time available between obstacles,
   and assert the widest demanded move is a fraction of what's coverable. This
   caught a level asking for **92% of the available lateral travel** — passable
   only with a frame-perfect input. No bot would have told you that; a bot
   either scrapes through or dies, and neither is a diagnosis.
3. **Moving hazards never seal the route** — sweep position × time including
   every mover's real position function.

Gate 2 then moved *into the generator* (`enforceReach()`), so the property is
constructed rather than merely checked.

Keep an autopilot afterwards if you like, but label it what it is: a competence
proxy, gated honestly (here: every ascent reached to ≥95%, ≥5 of 6 cleared) and
never the thing standing in for a fairness proof.

Corollary, same family as the existing "auto-solver scripts need the game's own
error metric" note: when a bot plans around hazards, read hazard positions from
**the game's own `kiteX()`/`birdX()` at the predicted arrival time**, never from
a re-derivation.

## Two bug classes worth generalising

- **`applyMute()` must set the button icon BEFORE the `if(!AC) return`
  guard.** The muted flag is restored from localStorage on load, long before
  any AudioContext exists, so guarding first leaves a muted game showing 🔊
  until the first interaction. Both new games fix this; **most existing games
  in this repo still have the old ordering** (the guard-first shape was copied
  forward from the 2026-07-24 audio retrofit). Worth a sweep — it is a
  one-line change per game, but it is 40 files, so it wants its own commit and
  its own smoke run rather than riding along with a feature.
- **A canvas HUD cannot read `env(safe-area-inset-*)`.** Measure it: park two
  zero-width divs with `height: env(safe-area-inset-top/bottom)` and read their
  `getBoundingClientRect().height` on resize. Without it, bottom-anchored
  canvas UI lands under the iPhone home indicator — and **headless Chromium
  reports 0 for the insets**, so no drive test and no screenshot will ever show
  you the problem. This is a design-review check, not a testable one.

## Resource budgeting scales with level length, not level content

Sky Lantern's fuel pickups were generated one-per-hazard-row, which meant the
*low*-density (early, gentler) levels got the fewest refuels across the longest
climbs — exactly backwards. Any consumable that gates progress should be placed
on its own **distance ladder**, independent of whatever else the generator is
spacing. The symptom was distinctive and worth recognising: every long level
failing at 95–100% completion with the resource at exactly zero.

## Cheap perf pattern for many-sprite scenes

Signal Hunt draws ~350 vector glyphs across 48 (shape, colour) combinations.
Pre-rendering each combination once into a small canvas and blitting with
`drawImage` at the zoomed size — plus viewport culling — holds 320 on-screen
nodes at ~8 ms/frame. Line work batched into one path per style bucket instead
of stroking per segment. Both are worth reaching for before anything cleverer.
