# Music Mixer — context

`games/music-mixer/index.html` (single file). A **stem mixer**, not a rhythm
game: fifteen pads, each one track of the playing song, and holding a pad is
the only way to hear that track. Commissioned by the CD 2026-09-17.

## The three rules that define it

1. **Two modes, and the locks outlive the switch.** The CD first ruled every
   latch out ("people love trying to find ways to press all buttons at the same
   time") and then, after playing it, asked for a **tap-to-lock** toggle in the
   chrome rail. Both modes now coexist, and there is still no ALL button — a
   full mix is either a grip or fifteen taps.
   - **Hold** (the default): a track sounds only while a pad is held.
   - **Lock**: a tap turns a pad on and leaves it on until tapped again.

   The case worth reading the code for: **turning lock mode off does NOT
   release what is already locked.** A locked pad keeps playing, and *tapping*
   it is what lets it go. So `latched[]` is shared by both modes and
   `recompute()` handles the two as **edges**, not levels — in lock mode a
   *press* toggles the lock (so the pad answers at once in both directions), in
   hold mode a *lift* clears one. `contactPrev[]` is what makes those edges
   visible, and `recompute(noLatch)` exists so a **programmatic** release
   (backgrounding the app) cannot be mistaken for the player lifting a finger
   and thereby silently clear a lock they set.

   Turning lock ON latches whatever is already sounding, so a mix built by hand
   survives the switch. **Restart (⟳) is the only reset** — it clears fingers,
   keys and locks; so does changing song, because the next song is a different
   fifteen tracks. `lockMode` persists in `localStorage`; the locks never do.
2. **The transport never stops.** From the first touch the clock runs whether
   or not anything is held, so a track always enters on the beat and in sync
   with the others. Pads gate a per-track `GainNode`; they do not start or
   stop playback. This is why pressing a pad mid-bar sounds musical instead of
   sounding like a tape starting.
3. **Nothing is sampled.** Every voice is oscillators, noise or one
   Karplus-Strong string; every song is a table of pattern strings. Five
   five-minute songs would be hundreds of megabytes as audio files and would
   break the single-file rule. The trade the CD accepted: the songs sound like
   a very good synthesizer, not like a recording.

## Pad layout — hue is the address

Fifteen pads in **three groups of five**. Hue climbs the left column, then the
middle, then the right, so **red is bottom-left and magenta is top-right**
(`HUES[]`, asserted strictly increasing by the data gate). Groups are fixed
roles, and a track keeps its slot across all five songs:

| group | portrait | landscape | role | pad 0 -> pad 4 |
|---|---|---|---|---|
| 0 | left column | bottom row | low end | sub/bass -> mid ostinato |
| 1 | middle column | middle row | harmony & melody | pad -> lead -> sparkle |
| 2 | **right column** | **top row** | **percussion** | low drum -> metal |

Within a group, **index 0 is the BOTTOM pad in portrait** and the LEFTMOST in
landscape. `layout()` is the whole transform: portrait puts group on the
column and climbs upward, landscape puts group on the row counted from the top
and climbs rightward. Both corners are preserved in both orientations, which
is the check to run after touching it.

Percussion slots are a taxonomy, not five arbitrary drums — slot 10 is always
the low drum and slot 14 always the metal, so the kick and the bell are in the
same place in synthwave and in gamelan. Only the label changes (KICK/DUNDUN/
GONG, RIDE/GANKOGUI/KENONG). Keep it that way when adding a song.

## Pads are contact patches, not points

`hitsAt()` holds **every pad whose rectangle the pointer reaches within
`spreadPx`** (default 12, settings slider 0-30). That is the feature, not a
tolerance bug: one fingertip laid across a seam holds both pads, a fingertip
on a four-pad crossing holds four, and the CD's stated grip — four fingers on
the inner crossings of two columns plus four on the remaining column's seams —
holds all fifteen with eight fingers. `drive-music-mixer-runtime.cjs` asserts
exactly that (1, 2, 4, 5, 10, 15 pads, and 0 with the spread dialled to zero),
derived from the live pad rectangles and dispatched as real CDP touches. It
also asserts the **ladder**: fingers added one at a time must make the held
count climb and never fall (measured 2 3 4 5 9 11 13 15). Never "fix" this
into a point test, and never let the ladder regress.

**Fingers come through TOUCH events, and the held set is rebuilt from
`e.touches` every time** — never accumulated. This is not a style preference;
it is the fix for the CD's 2026-09-17 report that five fingers held fine and
the sixth wiped all five. Three things caused that and all three matter:

1. Safari *derives* pointer events from touch events, so `preventDefault()` on
   `pointerdown` never reaches its gesture recognizer. Only a **non-passive**
   `touchstart`/`touchmove` listener does. Unprevented, the recognizer decides
   a many-finger touch might be a system gesture and fires `pointercancel`
   **for the fingers already down**.
2. `addEventListener('blur', …)` cleared the whole touch set. Safari can blur
   the window for an instant while making that decision. **Blur releases keys
   and the mouse only**; fingers are released by `touchend`/`touchcancel`.
   `releaseAll(fingersToo)` takes a flag for exactly this reason — only a real
   `visibilitychange` to hidden, and the restart button, pass `true`.
3. A `Map` keyed by `pointerId` and maintained incrementally never recovers
   from one missed or extra event. `e.touches` is the authoritative list of
   every finger on the glass on *every* touch event — `touchend` and
   `touchcancel` included, where it carries the fingers that REMAIN — so
   `fromTouches()` is self-healing and one cancelled finger costs one finger.

`ptr` still exists, but only for mouse and pen (and for fingers on a browser
with no `TouchEvent` at all — hence the `penOnly()` gate on `pointerType`,
which is what stops the two paths double-counting). The listeners live on
`#stage`, not `#grid`, so the margins around the grid refuse scrolling too —
which is why `touch-action:none` is on `#stage` as well.

**One thing no page can fix:** on iPadOS, four- and five-finger swipes and the
five-finger pinch are system gestures above the browser. A grip that large is
unreliable there until multitasking gestures are turned off in Settings.

Keyboard mirrors the **landscape** picture: `12345` percussion, `QWERT`
harmony/melody, `ASDFG` low end. The letters on the pads are hidden except on
`(pointer: fine)`.

## Notation contract

A pattern is a step-grid string whose length **must be a multiple of the
song's `steps`** (steps per bar), so a two- or four-bar pattern is just a
longer string. Gamelan's gong patterns are 64 long because its real unit is
the four-bar *gongan*.

```
'.'  rest
'-'  tie — extends the previous note one more step (never legal at index 0)
k:'m'  melodic    1-9 = scale degree 0-8, a-f = degree 9-14
k:'p'  percussive X accent, x normal, o soft/low, r rim/alt
```

The four percussion characters are **four strokes of one model**, not four
volumes: `mem()` and `noi()` re-tune and re-shape per character, so `o` on a
djembe is the bass stroke and `X` is the slap. That is where a hand-drum part
gets its life; use all four.

Track fields: `oct` shifts octaves, `ch` spawns a chord in scale degrees,
`harm:1` transposes by the current bar's chord root, `tune` scales a
percussion voice's natural pitch, `push` nudges it in ms (bass late, hats
early — this is the groove), `pan`, `g` gain.

An arrangement row is `{ n, b:bars, k:[chord roots], p:'<15 chars>' }` where
`p[i]` picks pad *i*'s pattern and `'.'` rests it. The arrangements are
written aligned so a section's `p` string reads as a column of the score.

**Chords come from the scale, not from chord names.** `harm:1` + `ch:[0,2,4,6]`
on degree `1` with a chord root of 3 gives degrees 3,5,7,9 — a G7 in D dorian
— so bossa's whole ii-V-I is the four numbers in `k`.

## Two songs are deliberately not in 12-TET

`cents[]` is a **cent** table, not semitones, precisely so this works:

- **GAMELAN** is slendro (`[0, 231, 474, 717, 955]`), five near-equal steps.
  The `beat` option on `saron`/`gender`/`bonang` detunes a twin oscillator a
  couple of Hz — that is the *ombak*, the shimmer real paired bronze bars make,
  and it is the single thing that makes the song sound like a gamelan rather
  than a marimba. Do not "fix" the detune.
- **RAGA** is Bhairavi in just intonation (`[0, 112, 316, 498, 702, 814,
  1018]`) with no chord motion at all — `k` is `[0]` in every section, because
  the tanpura never leaves Sa-Pa and the melody is the whole story.

PULSE, KORA and BOSSA are 12-TET. Time signatures are real: 12/8 (KORA, on the
seven-stroke bell as its timeline), 10/8 Jhaptaal (RAGA), 4/4 for the rest.
`bpm` counts the **displayed pulse**, and `barSec = pulses * 60 / bpm`.

## Voices

Five factories, ~65 named voices. Do not write a one-off voice function —
extend a factory's options instead.

| factory | covers |
|---|---|
| `mem()` | membranes: kick, toms, congas, djembe, dundun, tabla, dholak, kendang |
| `noi()` | noise: snares, hats, shaker, brush, ride, crash, kecer, clave, bell |
| `fm()` | bars and bells: metallophones, gongs, wood, Rhodes, vibes, celeste |
| `sub()` | oscillator stacks: basses, leads, arps, pads, strings, bowed, winds |
| `ks()` | Karplus-Strong strings: kora, ngoni, nylon, sitar, tanpura, upright |

`ks()` bakes its strings to `AudioBuffer`s in JS because **a `DelayNode` in a
feedback loop cannot go below one render quantum** (~375 Hz at 48 kHz), which
rules out most of the range. Two anchor pitches per voice, `playbackRate`
covers the semitones between — and the shorter decay an upshifted buffer gets
is what a real short string does, so it is a feature.

`noi()` voices take their pitch as a **ratio** (`p.r`, from the track's
`tune`) because their character is a filter frequency; `mem()` and `fm()`
voices take an absolute Hz from `PERC_BASE[voice] * tune`. That split is why
the data gate only demands a `PERC_BASE` entry for the latter.

## Signal chain

```
scheduled note -> trackGain[i] --+
                                 +-> trackPan[i] -+-> bus -> limiter -> master
live note -> its own gain -----> +                +-> send -> convolver -> bus
              (trackLive[i])
```

`trackGain[i]` is the song gate (0 unless the pad is held). `trackLive[i]` is
always open and is how a kit note gets past it — see **Three selections, two
pad behaviours** for why that separation is load-bearing.

- The **limiter** (`DynamicsCompressorNode`) is what makes "hold everything"
  land instead of clip. Fifteen tracks is a loud sum.
- The **reverb** is a synthesized impulse response (`makeIR`, 2.1 s of
  filtered decaying noise plus four discrete early reflections). No asset.
- The send is taken **after** the track gain, so releasing a pad stops feeding
  the room but lets the tail it already put there decay. That is both realistic
  and the reason the runtime gate's released-floor check allows ~0.001.
- `bus.gain` carries the **per-song `mix` trim**. Without it the dropdown
  doubles as a volume control (gamelan measured 2.6x quieter than synthwave
  before trimming); the runtime gate fails if the five songs spread past 2.2x.

## Scheduling

`setInterval(scheduleLoop, 20)` with a 90 ms lookahead. **Every track is
scheduled every step regardless of whether it is held** — the per-track gain
is what silences it. That is deliberate: gating at schedule time would mean a
pad pressed 50 ms before a beat misses that beat, which is exactly the moment
a player reaches for a drum. The cost is ~50 note events a second, which is
nothing for WebAudio. If a low-end device ever needs it, the cheap win is to
skip non-sustaining voices whose track has been released for longer than the
lookahead — not to gate on `held` directly.

Velocity is `track gain x accentAt(step) x a hash-based humanise`, and
`accentAt` leads on the bar's downbeat, then pulse heads, then the rest. There
is no velocity character in melodic notation on purpose — the groove comes
from `accentAt` and `push` instead, which keeps the pattern strings readable.

A held pad **pulses on each of its own notes** (`flashQ`, drained in the rAF
loop against `AC.currentTime`, not at schedule time). Lit but not pulsing means
that track is resting in this section — that readout is the whole reason a
resting track is allowed to exist, and why the data gate still caps resting at
45% of the song and 28 bars straight.

## Rendering: DOM/CSS, not Canvas 2D

The one documented deviation from the repo's Canvas-2D rule. The play surface
is fifteen DOM buttons: a coloured translucent cap (`background`), a lamp layer
behind it (`::before`, opacity `--glow * (0.74 + 0.26 * --pulse)`), a white-hot
filament core (`::after`, opacity `--glow * --pulse`) and a permanent specular
streak (`.sheen`). CSS `box-shadow` gives the bezel, the body depth and the
coloured light bleed onto neighbouring pads for free, and text labels stay
crisp. A canvas would have to re-implement all of it and still lose the text.
JS only ever writes `--glow` and `--pulse`.

Unlit pads are deliberately **saturated, not near-black** — the first pass had
them at 38% saturation / 13% lightness and the rainbow was unreadable until a
pad lit up.

## Three selections, two pad behaviours

The song dropdown has three kinds of entry, and each one puts the grid into a
different job. `mode` names the selection, `padMode` names what a press does.

| Selection | `mode` | `padMode` | Transport | Tempo strip | Wrench |
| --- | --- | --- | --- | --- | --- |
| MAKE A SELECTION (default) | `none` | `off` | stopped | hidden | hidden |
| RECORD NEW SONG | `rec` | `live` | stopped | hidden | shown |
| one of the five songs | `song` | `gate` | running | shown | hidden |

**`gate` and `live` are opposite directions of travel and must stay separate
code paths.** A song GATES a transport that was going to play that note anyway,
so a held pad opens `trackGain[i]`. The kit has no transport, so a press has to
TRIGGER a note that would not otherwise exist. Triggers also have to *stack* —
tap the same pad twice quickly and you want two notes ringing — so each live
note carries its own `GainNode` rather than sharing the track's.

**A live note joins the chain past the song gate** (`trackLive[i]`, straight
into the pan node). This is not a style choice. The song gate is what damps the
notes an outgoing song already scheduled, and those tails run for seconds — a
`gongAgeng` for six and a half. The first cut opened `trackGain` in live mode
so kit pads could be heard, and the result was the last song bleeding in
underneath the new kit for several seconds after the switch. The runtime gate's
`REC=quiet` check measures exactly that: the floor with nothing held right
after a mode switch, which read 0.132 with the bug and 0.0009 without.

Re-striking a **sustaining** voice damps the note already on that pad, the way
a re-struck key does; a drum, pluck or bell is left to ring and stack. Every
live note is retired on a timer (`liveIdle`, swept in `frame()`), because a
five-minute take would otherwise leave one `GainNode` per tap on the track
forever.

**`enterNone()` is silent on purpose.** The CD asked for "no song, no time
track, no meter, but you do see the tap pads" — so the grid is up and lights
under a finger, and makes no sound. That costs the game its old property that
the very first touch always sounded (it used to boot straight into PULSE).
Worth re-checking at playtest: if the silent first touch reads as broken rather
than as "pick something", the fix is to let `none` borrow the kit, not to
restore an auto-selected song.

## Chrome geometry is cached, so every mode switch re-lays-out

`rects[]` is filled by `measure()` from `layout()`, and the contact-patch hit
test reads it — never the live DOM. Hiding the tempo strip changes the chrome's
height, which moves and resizes all fifteen pads, so `syncChrome()` ends with a
`layout()` call.

This bit immediately on the first build: with the re-layout missing, every
contact-patch check came up exactly one pad short (the CD's eight-finger grip
held 12 instead of 15) because the hit test was aiming at where the pads used
to be. It is a **silent** failure — the pads still light when you do hit one —
and it is why the rule is written as "any layout-affecting change re-measures",
not "resize and orientationchange re-measure".

## The recording kit

`KIT = { root, mode, oct, pads[15] }`, persisted at `musicMixer.kit`.

- A pitched pad stores a **scale degree**, never a fixed pitch. That is the
  whole reason CHANGE KEY & MODE can transpose a performance already recorded
  rather than only retuning what you play next (CD call, 2026-09-18). `degMidi`
  indexes the mode's interval table and wraps into the next octave past its
  length, so degree 7 of a seven-note mode is the octave above degree 0.
- The **default kit** is ten degrees of C major climbing the two left columns
  (C4 D4 E4 F4 G4 | A4 B4 C5 D5 E5 — the eighth an octave over the first) and
  PULSE's five drums in the right column, keeping the standing rule that the
  right column is always percussion.
- `PITCH_KIT` / `PERC_KIT` are the picker's two lists and they carry the same
  `k:'m'` / `k:'p'` split the songs use, so an assigned pad drops straight into
  the scheduler's existing branches. The data gate checks a percussion voice
  has a `PERC_BASE` entry or is a `noi()` voice, and that no noise voice is
  offered as pitched.
- The note list is the **current scale across three octaves**, not a chromatic
  run: a pad holds a degree, and an out-of-scale note would have no degree to
  hold. Chromatic notes are the key/mode screen's problem, not the picker's.
- `load()` rebuilds a stored kit field by field and never trusts it wholesale —
  a pad naming a voice a later build dropped would throw on its first tap.

## The wrench is a mode picker

`TOOLS` lists five entries and `TOOL_READY` gates which are live; entries whose
stage has not landed sit in the menu **disabled rather than hidden**, so the
menu keeps its final shape and a greyed row says "later" without a caption
saying so. The 0th entry is deliberately blank — it is "no tool", the plain
replay state, and it is the default for a recorded song.

Under **TAP PAD**, a pad that goes down *on its own* and comes back up inside
650 ms opens its picker; a chord, a hold or a slide across a seam is left
alone, so the grid stays playable in that view. The decision lives in
`noteTap()`, called from `setHold`, rather than in the touch handlers — with a
contact patch, *which* pad a finger is on is `recompute()`'s answer, not the
event's.

## The key/mode screen and its sample

CHANGE KEY & MODE takes the **whole play surface** rather than opening over it:
picking a key is a decision about the instrument, not an adjustment made while
playing. `setTool` swaps `#grid` for `#keymode` and back.

`SAMPLE` is eight bars of plain piano written **once, in scale degrees**, and
rendered through whatever is picked:

- the left hand and the chord voicings are degrees relative to the **bar's
  chord root**, so stacking `0, 2, 4` yields whatever triad the mode actually
  has in that position — major, minor or diminished, correctly — with no
  second version of the piece;
- the melody is degrees relative to the **tonic**;
- both are read at **schedule time**, once per step, which is what lets a key
  change land inside one lookahead *without the loop losing its place*. That
  is the CD's rule stated exactly: the structure never moves, only its colour.
  The runtime gate asserts the step counter climbs across a key change, and a
  version that reset it went red at `step 10 -> 2`.

The sample gets **its own way to the bus** (`smpOut`) rather than borrowing a
track's and inheriting that track's gate. Pause leaves the ~90 ms already in
the graph to play out and the decays to ring — cutting them would be a mute,
not a pause.

The two lists set their **own** `touch-action: pan-y`. `#stage` refuses every
gesture on behalf of the pads, and without that override it would refuse these
scrolls too; `padsOff()` also makes the stage's touch, pointer and key
handlers bail while the screen is up, so nothing on it reads as a pad press.

### Rotating while the screen is up is the sharp edge

`resize` still fires and still runs `layout()` while `#grid` is
`display:none` — and a hidden element measures as **zero**, so every entry in
`rects[]` becomes an empty box. Come back to the grid without re-measuring and
the hit test is completely deaf: pads that light for nobody, no error, no clue.
`setTool` therefore calls `layout()` on the way out.

Worth knowing how this was nearly missed. The first version of the gate check
only left the screen and pressed a seam; that passed with the re-measure
deleted, because leaving the tool does not change the chrome's height and the
grid came back the same size it left. Only rotating *while the screen was up*
exposed it — and then it failed at **0 pads held, not one short**. A check that
cannot be made to fail is not evidence.

## Gates

```
node .claude/tests/drive-music-mixer.cjs [--report]        # notation + arrangement
NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
  node .claude/tests/drive-music-mixer-runtime.cjs         # audio + contact patch
```

Run **both** after touching song data or the synth. The data gate caught 39
real defects on its first run (off-by-one pattern lengths, patterns the
arrangement referenced but no track had, pads resting half the song) — none of
which throw, and most of which are inaudible until you happen to reach that
section. The runtime gate exists because "the pads light up" is not evidence
of audio: the lamp is CSS and runs fine with the graph completely dead.

## No helper text on the grid

The game shipped with `HOLD A PAD TO PLAY ITS TRACK` over the pads and the CD
cut it the same day: the pads already look like lamps behind plastic, so the
caption answered a question nobody had while covering one of the pads it
described. **Do not re-add it**, and do not add a first-run tooltip, a coach
mark or a timed hint — an auto-dismiss is still instruction and still sits on
the thing it points at. The cogwheel panel is where explanation lives, and it
is free to be thorough — it is also the only place the two pad modes are
written down, which is the point. This is now a repo-wide rule:
`games/CLAUDE.md` § Discovery over instruction.

## Ideas not taken

- **Contact size from `PointerEvent.width/height`** instead of a fixed spread
  would be more physical still (a thumb would naturally cover neighbours), but
  the reported values vary by device and would make a single-pad press
  unreliable. The slider is the honest version.
- **Grid size** is the CD's open question. It started as 8 rows x N columns and
  the CD cut it to 3x5 on the grounds that anything more makes the pads too
  small to hit deliberately. If it changes again, `GROUPS`/`PER_GROUP` and the
  role taxonomy above move together, and every song needs its track list
  re-cut — the arrangement `p` strings are per-pad.
