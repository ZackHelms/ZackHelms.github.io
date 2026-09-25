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
   Karplus-Strong string; every song is a table of pattern strings. Six songs
   of several minutes each would be hundreds of megabytes as audio files and
   would break the single-file rule. The trade the CD accepted: the songs sound like
   a very good synthesizer, not like a recording.

## Pad layout — hue is the address

Fifteen pads in **three groups of five**. Hue climbs the left column, then the
middle, then the right, so **red is bottom-left and magenta is top-right**
(`HUES[]`, asserted strictly increasing by the data gate). Groups are fixed
roles, and a track keeps its slot across all six songs:

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

**A window-level key handler has to yield to whatever is focused.** Once the
recorder added a song-title field and a BPM box, those fifteen keys were also
ordinary characters, and the handler's `preventDefault()` swallowed them: the
CD typed a name and got the letters that happen not to be pad keys back
(report, 2026-09-18 — "SAD FROG 12" came out as " O "). `typingInField()`
checks `document.activeElement` for INPUT / TEXTAREA / SELECT /
`isContentEditable` and is the *first* thing `keydown` asks. Note what it is
**not** on: `keyup` releases unconditionally, so a key pressed before the field
took focus can never stick down.

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

PULSE, KORA, BOSSA and DORIAN are 12-TET. Time signatures are real: 12/8
(KORA, on the seven-stroke bell as its timeline), 10/8 Jhaptaal (RAGA), 4/4
for the rest. `bpm` counts the **displayed pulse**, and
`barSec = pulses * 60 / bpm`.

## DORIAN is the CD's own recording, grown into a song

The sixth song came from a take the CD played on the pads and exported
(ZCK0, 2026-09-19). What is **theirs** and must not drift:

| kept from the take | value |
| --- | --- |
| key | C dorian, `cents: [0, 200, 300, 500, 700, 900, 1000]` |
| tempo | 103.5 BPM, 4/4, `swing: 0` (their take is dead straight) |
| drum groove | KICK `X.......x.......`, SNARE `....x.......x...`, HAT `..x...x...x...x.` — pattern `a` on pads 10-12 is their performance, transcribed |
| harmony | the i-bVII vamp their held piano spelled out: Cm with Bb passing |
| the flourish | CELESTE's `a` pattern `..111.1.1.......` is the rhythm of the Eb5 run they played in bar 1 |

What is **new**: the band. The take is piano only, one note per pad across
pads 0-9; a song needs the layout contract (low end, harmony/melody,
percussion) and fifteen distinct roles, so the vamp is re-voiced as sub,
upright bass, Rhodes, clav, vibes, pad, piano, strings, sax and celeste. The
chords move through `k` and `harm: 1` rather than being spelled note by note,
which is what lets one 2-bar piano figure sit over Cm7 - Bbmaj7 - F7 - Gm7.

`rootHz: 65.406` is C2, so `oct` reads as an octave number: 0 is the bass, 2
is the take's own C4 piano register, 3 is the lead.

**This is the worked example of what the export is for.** The readme in an
exported take says it is a seed, not a drop-in, and this is the shape of the
work between the two: the take gives key, tempo, groove and harmony; the
arrangement, the instrumentation and the duration are written around it.

### Growing a take into a song - the procedure

The CD will do this again, so: read the export's `performance` block, not just
its `song` block. The rendered `song` is one track per pad with one note each,
which is what a take is; the reusable material is underneath it.

1. **Read the identity out of the take.** Key (`kit.root` + `kit.mode`, and
   `song.cents`), tempo, metre, and the drum patterns on pads 10-14. Those are
   the CD's performance and should survive verbatim - DORIAN's KICK/SNARE/HAT
   pattern `a` is exactly what was played.
2. **Read the harmony off the held notes.** Step through the pitched patterns
   and write down which degrees sound together. ZCK0's held piano spelled Cm
   with a Bb passing chord: that became `k: [0, 6, ...]` plus `harm: 1`. Chord
   roots and `harm` are how a full song says what a take says note by note,
   and they are what lets one figure ride a moving progression.
3. **Re-voice into the layout contract.** Fifteen roles: low end, harmony and
   melody, percussion on the right. A take has no such split - every pitched
   pad is the same instrument - so this step is composition, not transcription.
4. **Set `rootHz` to an octave anchor** so `oct` reads as an octave number.
   DORIAN uses C2, which puts the take's own C4 register at `oct: 2`.
5. **Write the arrangement to the duration rule** (120-315 s) and check phrase
   alignment: a multi-bar pattern is indexed off the ABSOLUTE step, so every
   section must start on an even bar or a 2-bar phrase flips halfway.
6. **Trim `mix` by measuring, not guessing.** Play it with everything held,
   read the runtime gate's `LEVELS=` line, and scale so it sits in the pack.
   DORIAN came in at 0.365 against 0.212-0.327; 0.9 -> 0.7 fixed it.
7. **Both gates, then the badge.** Adding a song also means revisiting the
   suites' song-count assumptions - both now read the count rather than
   hard-coding it - and sweeping for prose that still says "five songs".

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

### The envelope trap: Web Audio runs automation in TIME order

`sEnv()` is the sustaining envelope and it is used by `sub()` and `fm()`. The
decay ramp **must be clamped to end by the note's end**:

```js
const dEnd = Math.min(when + atk + dec, end);
hold = p * Math.pow(sus, (dEnd - when - atk) / dec);   // where the decay got to
g.gain.exponentialRampToValueAtTime(hold, dEnd);
```

Without that clamp, a note shorter than `atk + dec` schedules its decay ramp
at a time **later than its own release**. Web Audio does not care what order
you called the methods in — it sorts events by time — so the timeline read:
attack, release to zero on the beat, `setValueAtTime(0)`, and *then* a ramp
back up to the sustain level, with no event after it. The note went quiet
correctly and then **came back**, and stayed.

It is silent on any note longer than its own decay, which is why it survived:
every long note in the game was fine.

Measured cost, per track (short hits / all hits):

| song | track | voice | affected | note | decay needs |
| --- | --- | --- | --- | --- | --- |
| PULSE | STABS | supersaw | **12/12** | 0.144 s | 0.514 s |
| PULSE | LEAD | supersaw | 4/25 | 0.144 s | 0.514 s |
| BOSSA | FLUTE | bansuri | 6/12 | 0.114 s | 0.470 s |
| GAMELAN | GONG | gongAgeng | 3/3 | 0.208 s | 3.270 s |
| KORA | FLUTE | bansuri | 2/14 | 0.130 s | 0.470 s |
| RAGA | BANSURI | bansuri | 2/15 | 0.156 s | 0.470 s |
| BOSSA | SAX | sax | 2/12 | 0.114 s | 0.450 s |
| PULSE, BOSSA | PAD, STRINGS | sawPad, strings | 2/3 each | 0.9-1.2 s | 1.0-1.3 s |

That table is the CD's report read back exactly: STABS, whose every hit is one
step long, "often sounds off rhythm"; LEAD, where only pattern `c`'s opening
run is short, "sometimes" (2026-09-19). The ghost lands ~3.5 sixteenths behind
the hit, which is why it reads as bad timing rather than as a bad sound.

**The scheduler was never the problem** and it is worth knowing why, so nobody
re-investigates it: `scheduleStep` adds exactly three things to a step's time —
`swing` (0 on PULSE), the track's `push` (unset on STABS and LEAD) and a +/-3.5 ms
humanise jitter. There is nowhere else for timing to come from.

The gate is section 12 of the runtime suite: fire one note of each voice a
song plays short, sample the envelope every 10 ms, and require that once the
level has fallen away nothing comes back. `__MM.envNote()` / `__MM.envLevel()`
exist for it — a dry analyser, muted into the bus so the graph pulls it,
because this is invisible in a mix.

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
  before trimming); the runtime gate fails if the songs spread past 2.2x.

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
| one of the built-in songs | `song` | `gate` | running | shown | hidden |

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

### Pad presets (CD request, 2026-09-25)

A second dropdown, `#kit-select`, sits beside the song list and is shown **only
under RECORD NEW SONG** (`syncChrome`). `KIT_PRESETS` lists them:

- **DEFAULT** - `defaultKit()`'s pads, the kit described above.
- **DRUMS 1** - fifteen percussion pads (`DRUMS1[]`), keeping the layout's
  low-to-high climb: low drums up the left column (KICK SURDO TOM DJEMBE
  CONGA), snares and wood in the middle (SNARE GHOST SNARE RIM CLAP CLAVE),
  cymbals and metal on the right (HAT SHAKER RIDE CRASH GANKOGUI - slot 14
  still the metal).

Rules worth keeping:

- A preset replaces `KIT.pads` only; **key, mode and octave stay** what
  CHANGE KEY & MODE set.
- The dropdown's value is **derived, never stored**: `kitPresetOf(KIT)` matches
  the pads against each preset (voice, k, and degree for pitched pads), and a
  pad edited under TAP PAD makes it read **CUSTOM** (a disabled option, hidden
  until it applies). Picking a preset over a custom kit replaces it - there is
  no undo.
- It is **disabled from the count-in until the take is stored** (`RC.state !==
  'idle'`), because a take is voiced from `KIT` when it stops, so a mid-take
  change would re-voice everything already played.
- Adding a preset is one row in `KIT_PRESETS`; the runtime gate's `PRESET=`
  check pins DRUMS 1's labels, the CUSTOM read, key survival, and that the
  list is hidden outside record mode.
- Portrait width is tight: `#kit-wrap` is a fixed 104 px and the row's chips do
  not shrink, so RECORD NEW SONG truncates to an ellipsis on a 390 px phone
  rather than the wrench and lock being crushed. A longer preset name than
  "DEFAULT"/"DRUMS 1" needs that width revisited.

## The wrench is a mode picker

`TOOLS` lists seven entries and `toolOK()` gates which are live **off the
SELECTION, not off what has been built**: RECORD belongs to a new song, REPLAY
& EDIT / EXPORT FILE / DELETE SONG to a recorded one. A row that does not apply
sits in the menu **disabled rather than hidden**, so the menu keeps one shape
and its greyed rows say what this selection cannot do, without a caption
saying so. The 0th entry is deliberately blank — it is "no tool", the plain
replay state, and it is the default for a recorded song.

Five rows are **modes**; `EXPORT FILE` and `DELETE SONG` are **actions** — they
fire and leave the tool where it was, which is why both are intercepted in the
menu's click handler before `setTool()` ever sees them.

**DELETE asks twice, and asks the second time somewhere else.** It is the only
irreversible thing in the game, so a second tap where the first one landed must
not be able to answer it. The menu hangs off the wrench at the top of the
screen, so `#del` normally pins to the *bottom* — but `askDelete(fromY)` takes
the clicked row's centre and **flips to the top when that row was in the lower
half of the screen**, which is what landscape does. Pinning it to the bottom
unconditionally put the confirm straight over the row in landscape (measured:
confirm 214-343, row at 275). Deleting the current selection falls back to
nothing selected rather than sliding to whichever song took its place in the
list. The runtime gate measures the actual on-screen geometry in both
orientations, not just that both elements exist.

Adding that seventh row also means the menu can outgrow the space under the
wrench, so its top is clamped to keep it on screen — measured *after* it is
shown, because a hidden element has no height. No phone is short enough to
need it today, so the gate squashes the viewport to 260 px to give that check
something to fail on.

Under **TAP PAD**, a pad that goes down *on its own* and comes back up inside
650 ms opens its picker; a chord, a hold or a slide across a seam is left
alone, so the grid stays playable in that view. The decision lives in
`noteTap()`, called from `setHold`, rather than in the touch handlers — with a
contact patch, *which* pad a finger is on is `recompute()`'s answer, not the
event's.

**TAP PAD suspends the lock toggle**, and has to. In lock mode a press
*latches*, so the pad is still held on release and the "nothing held now" test
that opens the picker never fires: the CD got a lit pad, a played note and no
dialog (report, 2026-09-18). Note the shape of that bug — the tap did
everything *except* the one thing it was for, which is why it read as
intermittent rather than broken.

It is **suspended, not switched off**: `lockOn()` is `lockMode && !lockSuspend`,
and every latch decision goes through it. `lockMode` is a persisted CD setting,
so a tool that cleared it would quietly change a preference as a side effect of
being opened; this way the setting is untouched and comes back on the way out.
The toggle is `disabled` while suspended rather than silently inert.

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

## Recording a take

A take is stored as **exact tap times**, quantized on the way out:

```
n.t, n.d   what was actually played, never overwritten
n.sT, n.sD where it lands under the current snap and intro padding
```

`prepTake()` derives the second pair from the first, so moving SNAP from 1/16
to OFF gets the human timing back intact and nothing about editing is
destructive. Notes are bucketed per step so the scheduler never scans the take.

`RECORD` runs the CD's countdown — 3, 2, 1, then **one more second of nothing**
before the dot, which is the breath before the downbeat and what stops the
first note landing on the count. Stopping opens a blocking overlay: the work is
milliseconds, but the overlay is held ~1.3 s deliberately, because a modal that
flashes reads as a glitch rather than as a step completing.

### Tempo and metre, and how much to trust them

Full derivation, the four wrong versions and the measured accuracy table:
`.claude/notes/20260918-tempo-and-metre-from-taps.md`.

Both are measured from nothing but tap times, over an **onset-strength** series
(pads struck together are one onset carrying weight). That weighting is
load-bearing: an early version deduped simultaneous hits away, which left metre
detection a flat series and it got every case wrong.

**Tempo.** The grid fit is the easy half and it is solid. The hard half is the
*octave* — half, double and 1.5x all fit a steady performance about as well; a
stream of eighths at 76 is a stream of dotted eighths at 114, each dead on its
own grid. Three terms settle it and they pull against each other:

| Term | What it prefers | Why it cannot work alone |
| --- | --- | --- |
| metrical position | notes on beats and off-beats, not smeared across every subdivision | always prefers **doubling** — an eighth becomes a quarter, so everything lands on a beat |
| density | about two onsets to the beat | always prefers **halving** on sparse material |
| ordinary tempo (~112) | breaks what is left | near-useless between 76 and 152, which are equidistant from it |

**Metre.** Autocorrelation of the onset-strength series binned on *sixteenths*.
Not on beats: an onset half a beat from the phase sits exactly on a beat-level
rounding boundary, and which side it falls makes the bar appear to drift —
that read a plain 4/4 take as 5/4. Not by downbeat weight either, which an
ordinary backbeat defeats (the snare outweighs the downbeat). Periodicity does
not care where the bar starts.

Measured on synthetic takes, weights tuned on one set and scored on another:
**98% tempo accuracy between 85 and 145 BPM** (189 cases), against 43% below 85
and 35% above 145. A single "overall" figure is close to meaningless here —
an earlier holdout reported 76% purely because it sampled two of its five tempi
outside the usable band. Those numbers are why the edit bar carries a one-tap **/2 and x2** next to the BPM field rather than only a number. The failures are not a few percent off, they are octave errors — and the detector's bias pulls them *toward* the good band, so a 68 BPM take comes back as 136 and a 166 BPM one comes back as 83. Both are one tap from correct, and it is always the same tap. They refuse out-of-range
rather than clamping — clamping means x2 then /2 does not return where it
started, which defeats the point.

### Edges: a take is a LOOP, so both of them are ours to find

Nobody starts or stops on a bar line. The CD waits a few seconds, plays four
bars of a beat, and stops a few quarter notes into the fifth. Neither the wait
nor the remainder is part of the song, so **both edges are decided, not
recorded**, and what comes back is a whole number of bars that joins onto
itself.

**The start** needs a bar *phase*, not just a bar *line* — tempo and metre give
the grid, `detectDownbeat()` gives which of the bar's sixteenths is beat one.
It folds the onset-strength series into one bar and scores each rotation
against a template (downbeat heaviest, then the half-bar, then the other
beats), with a **1.2x bonus on the rotation the first onset sits on**, because
a take starts when the player starts and that is nearly always beat one. The
bar line nearest the first onset becomes `t = 0`; if the first onset turns out
to be a pickup more than half a bar early, it is not shifted forward but
**wrapped to the end of the loop**, which is where it actually plays from.

A bug worth remembering: the old code did `floor((first - phase) / barSec)`
where `phase` is a *sixteenth* phase within half a step of the first onset. Get
the sign wrong by a hair and `floor` returns -1, so the song opened with a
whole empty bar.

**The end** is `loopBars()`, which scores every candidate length on three terms
that (as with the tempo octave) are each useless alone:

| Term | What it prefers |
| --- | --- |
| cost — the share of the performance discarded | keeping everything |
| fill — how full the candidate's *last* bar is | cutting a trailing fragment |
| a mild prior on 4, 8, 16 over 5, 7, 9 | round phrase lengths |

Held out against synthetic takes with known lengths: **~99% correct wherever
the metre was right** (792/796), and 100% on the start alignment (864/864).
Where it is wrong the take is two bars long and the "fragment" is nearly a bar,
which is genuinely ambiguous.

Two rules keep the seam closed once the length is chosen:

- **Length is read off the sixteenth grid, never off the snapped positions.**
  A coarse SNAP has to be able to move the last note *onto* the closing bar
  line without the song growing a bar to hold it — so a note that snaps onto
  the loop point wraps to step 0, where it is the downbeat played a hair early.
- **Nothing rings past `dur`.** `n.sD` is clipped at the loop point, or the
  loop overlaps itself on every pass.

`tk.bars` is therefore **derived** every time `prepTake()` runs, not stored.
That is what makes correcting the BPM or the metre in the edit bar behave: the
same performance at half the tempo is genuinely half as many bars. INTRO
padding shifts everything later by N note values and adds whole bars, so the
loop stays bar-aligned.

### Takes recorded before this: `retrimEdges()`

The edges changed, but the *stored data did not lose anything* — a take keeps
its exact tap times, so its edges can simply be found again. `loadTakes()`
re-derives them once for any take without `edges: EDGES_V`, then writes the
marker back so it never repeats. It uses the take's **own** `bpm` and `beats`
rather than re-detecting them, because the CD may have corrected those by hand
in the edit bar and that correction beats anything the detector knows.

Measured on the CD's first recording (report + export, 2026-09-19), which is
now the gate's fixture: stored as **6 bars** — an empty one at the front from
the old `floor()` sign slip, and a lone kick alone in a sixth — it re-trims to
**4 bars, 32 of 33 notes, first note back on step 0**. Running it again moves
nothing, which the gate also asserts: an idempotent migration is the only kind
safe to leave in a load path.

One seatbelt: if a re-trim would keep under 60% of the notes, the original is
kept. The job is cutting a fragment, never a performance.

### Four steps to the beat, in every metre

`tk.steps = tk.beats * 4`, not a flat 16 per bar. The flat version made SNAP's
`1/16` a lie in 3/4 (a "step" was a 12th of a beat) and left `perBeat = 16/3`,
so the edit click — which fires when `step % perBeat === 0` — only ever landed
on the downbeat. `steps` and `perBeat` are derived, so a stored take that
predates this re-grids itself on load.

## Replay, and editing a take

A take is a song the CD made, so it **replays exactly like the built-in songs**:
the pads gate it (`padMode: 'gate'`, notes routed through `trackGain`), silent
until something is held. That is the contract the runtime gate measures
directly — 0.0000 with nothing held, 0.29 with everything held.

REPLAY & EDIT is the other half: `editing` routes notes through `trackLive`
instead, so everything sounds without holding anything, and `padMode` goes
`live` so a pad can be overdubbed onto the take. The click track runs only
here — it is a recording aid, not part of the song.

The two bars of click after the last one are the CD's "the song is over, and
here it comes again": the first bar's last two clicks fade down, the second
bar's first two come back up (`clickVel`).

**Overdub is a transaction.** The notes are snapshotted when REC goes on, so
answering NO really does put the song back rather than leaving whatever
survived the last erase. The erase handle is a **moving window at the
playhead**, not a selection — the only erase gesture that works while the song
is running. A finger on the handle is deliberately *not* a pad press
(`exAt()` is consulted before `hitsAt()` in `fromTouches`), or you would play
the note you are deleting.

`activeKit()` exists because a take carries its own kit: selecting one must not
clobber the kit being built under RECORD NEW SONG. Everything that reads a
pad's sound goes through it rather than at `KIT` directly.

Two traps worth keeping in mind, both hit during the build:

- `setHold`'s gate branch used to bail on `!S` and read `S.tracks[i].v`. A take
  has no `S`, so recorded songs were **completely silent on replay** while
  every pad still lit. It reads the voice through `padVoiceName()` now.
- `takePlay()` calls `wakeAudio()`, not `ensureAudio()`. `ensureAudio` starts
  whatever transport the selection implies, including takes — so the two
  called each other and blew the stack. Waking the graph and starting a
  transport are separate jobs.

## Export

`EXPORT FILE` is the one row in the wrench menu that is an **action rather than
a mode**: it fires and leaves the tool where it was. It writes a
`music-mixer-take/v1` JSON file, downloaded as `<slug>-take.json`.

The point is that a Claude Code session can *use* it, so the file carries the
take rendered into **this game's own SONGS[] notation** — pattern strings plus
an arrangement — and not just a dump of tap times:

| Section | What it is for |
| --- | --- |
| `song` | the take as a SONGS[] object |
| `songSource` | the same thing as pasteable JS, already in the repo's style (unquoted keys, single quotes, one pattern per line) |
| `performance` | the raw tap times and durations, so a session can re-quantize at a different snap |
| `kit` | which voice and scale degree each of the fifteen pads held |
| `readme` | what this is, and the song contract it does **not** yet meet |

Rendering details worth knowing:

- A pad's scale degree becomes the pattern character directly, since the
  notation's `1-9`/`a-f` covers degrees 0-14 and `degHz` wraps past the scale
  length on its own. A pad outside that range is carried by the track's `oct`.
- Percussion has no recorded velocity, so the accent map is **metrical**: a
  note on a bar line is `X`, everything else `x`.
- `shortestPattern()` collapses a pattern that repeats. A looped performance
  exports as a tidy one-bar string; a through-composed one exports as the whole
  thing, which is honest — the string *is* the take.

**The readme earns its place** (it is the carve-out the discovery rule allows:
text for a reader who is not holding the device). It states the thing that
would otherwise waste a session's time — this is a **seed, not a drop-in**.
Pasting it into `SONGS[]` as-is fails the data gate on purpose, because a song
there must run 120-315 s, keep every pad under 45% rest and 28 bars straight,
average 0.22 notes/bar, sound on 60% of steps held, and stay under 26 voices a
step. The readme lists all of it and names the gate to run.

The runtime gate's real check is the **round trip**: walk the exported pattern
strings back into `pad@step` heads and require exactly the take's notes, none
missing and none invented. Losing a third of the notes reports
`36 notes missing, 0 invented (of 105)`.

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

`node .claude/scripts/short-notes.cjs` is not a gate but belongs in the same
breath: it lists the tracks whose notes are shorter than their voice's own
attack+decay, which is the maintenance question behind the runtime gate's
`SHAPES` list (see § The envelope trap). Run it after adding a song or
retuning a voice - a voice it names that `SHAPES` does not is a voice whose
envelope nothing is watching. It found two the first hand-picked list missed.

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
