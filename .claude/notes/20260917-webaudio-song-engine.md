# Synthesizing whole songs in WebAudio (2026-09-17, music-mixer)

Six songs, 2-5 min each, fifteen independent stems apiece, **no audio assets
at all**. Written for Music Mixer; the parts worth reusing are the data model,
the Karplus-Strong workaround, the scheduling decision, the envelope trap and
the two gates. (Started at five songs of ~5:00; the sixth was grown from a
performance the CD recorded in the game itself, and the duration rule widened
to 120-315 s on 2026-09-19 so a recorded take need not be padded to five
minutes to qualify.)

## Why there was no choice

5 songs x 5 min x 15 stems as files is hundreds of megabytes, and
`games/CLAUDE.md`'s single-file rule allows a baked asset only when it is
generated from in-repo source, loads lazily, and degrades — a song cannot
degrade. So: synthesis. The trade to state to the CD up front is **timbre**,
not length or structure: you can have real five-minute arrangements with
intro/build/break/outro, and they will sound like a very good synthesizer
rather than a recording.

## Data model: patterns + arrangement, not a note list

A note list for 2080 steps x 15 tracks is unwritable and unreviewable. Instead
each track carries a handful of **pattern strings** and the song carries an
**arrangement** of sections that names one pattern per track:

```
pats: { a: 'X...x...X...x...', b: 'X.......X...x...' }
arr:  [ { n:'VERSE', b:16, k:[0,5,2,6], p:'abaaaabaaaaabaa' } ]
```

- A pattern's length **must be a multiple of the song's steps-per-bar**, so a
  2- or 4-bar pattern is just a longer string. Gamelan's gong patterns are 64
  long because its real unit is the four-bar *gongan*.
- `p` is one char per pad, so a section reads as a column of the score, and
  the arrangements line up visually when written aligned.
- Chords come from the **scale**, not from chord names: a per-bar chord-root
  array `k` plus `harm:1` on a track plus `ch:[0,2,4,6]` gives diatonic
  sevenths, so a whole ii-V-I is four integers.

## Cents, not semitones — this is what buys authenticity

Store the scale as a **cent** table. Two of the five songs are then genuinely
not 12-TET, because their genres are not:

- **slendro** (gamelan): `[0, 231, 474, 717, 955]`
- **Bhairavi in just intonation** (raga): `[0, 112, 316, 498, 702, 814, 1018]`

And the single most important detail for the gamelan: real paired bronze bars
are tuned a couple of Hz apart, and the beating between them (*ombak*) is what
makes an ensemble shimmer. A `beat` option that adds a detuned twin oscillator
is the difference between "gamelan" and "marimba". Do not let a later pass
"fix" the detune.

## Five voice factories, never a one-off voice

~65 named voices from five parameterised factories: `mem()` membranes,
`noi()` noise, `fm()` bars/bells/gongs, `sub()` oscillator stacks (basses,
leads, pads, bowed, winds), `ks()` Karplus-Strong strings. Extend a factory's
options; a sixth hand-written voice function is how a synth becomes
unmaintainable.

Two conventions worth copying:

- **Percussion characters are strokes, not volumes.** `X`/`x`/`o`/`r` re-tune
  and re-shape inside the factory, so `o` on a djembe is the bass stroke and
  `X` is the slap. That is where a hand-drum part gets its life.
- **Pitch input differs by factory class and must be documented.** `noi()`
  voices take a *ratio* (their character is a filter frequency); `mem()` and
  `fm()` take absolute Hz from a `PERC_BASE[voice] * tune` table. That split
  is why the data gate demands a `PERC_BASE` entry only for the latter.

## Karplus-Strong: a DelayNode cannot do it

The obvious implementation — noise burst into a `DelayNode` with a lowpass in
the feedback loop — **cannot work above ~375 Hz at 48 kHz**, because a delay
inside a cycle cannot go below one render quantum (128 samples). That rules out
most of the useful range.

Bake the string in **plain JS** into an `AudioBuffer` instead (a delay-line
array plus a two-tap averaging lowpass, ~15 lines), then play it with
`BufferSource` + `playbackRate`. Two anchor pitches per voice cover the range;
the shorter decay an upshifted buffer gets is what a real short string does, so
the artifact is physically correct. Remember to subtract the DC the excitation
leaves behind and fade the tail, or every pluck ends in a click.

## Scheduling: schedule everything, gate with a per-track gain

The tempting optimisation is to skip scheduling a track that is not currently
held. **Don't.** With a ~90 ms lookahead, a pad pressed 50 ms before a beat has
already missed that beat — which is exactly the moment a player reaches for a
drum, so the one saving costs the thing the game is for. Schedule every track
every step and let a per-track `GainNode` decide what is audible. Measured
cost is ~50 note events a second, which is nothing for WebAudio.

If a low-end device ever needs it, the cheap and *unobservable* win is to skip
**non-sustaining** voices whose track has been released for longer than the
lookahead — never to gate on `held` directly.

`setInterval(scheduleLoop, 20)` with a 90 ms lookahead. Read the clock off
`AC.currentTime`, not the step counter, which also means **suspending the
context pauses the song where it stands** rather than letting five minutes
elapse behind a locked screen.

## Groove without velocity notation

Melodic patterns carry pitch only — no velocity characters, which keeps the
strings readable. The feel comes from three cheap things instead:

- `accentAt(step)`: the bar downbeat leads, then pulse heads, then the rest.
- a per-track `push` in ms (bass late, hats early) — this is most of the feel.
- a hash-based per-note humanise, deterministic so a bug is reproducible.
- `swing` shifting odd steps, per song.

## Envelopes: automation runs in TIME order, not call order

The single worst defect this engine has had, found 2026-09-19 because the CD
said **"the stabs often sound off rhythm, and the lead sometimes does"**.

A sustaining envelope is written the obvious way — attack, decay to the
sustain level, hold, release:

```js
g.gain.setValueAtTime(0, when);
g.gain.linearRampToValueAtTime(p, when + atk);
g.gain.exponentialRampToValueAtTime(p * sus, when + atk + dec);   // decay
g.gain.setValueAtTime(p * sus, when + dur);                        // hold ends
g.gain.exponentialRampToValueAtTime(p * 0.0007, when + dur + rel); // release
g.gain.setValueAtTime(0, when + dur + rel + 0.002);
```

That is correct for every note **longer than its own attack+decay**, and wrong
for every note shorter. `AudioParam` events go into one timeline sorted by
**timestamp**; the order you called the methods in is irrelevant. With
`dur = 0.144` and `atk + dec = 0.514` the timeline actually reads:

```
0.000  setValue 0
0.014  ramp to p
0.144  setValue 0.7p          <- "hold ends"
0.284  ramp to ~0             <- release
0.286  setValue 0
0.514  ramp to 0.7p           <- the DECAY, arriving after everything
```

Nothing follows that last event, so the gain climbs back to the sustain level
and **stays there** until the oscillators stop. One note, two attacks, the
second about 3.5 sixteenths late — which is why it reads as bad *timing*
rather than a bad sound, and why the CD reported it as a rhythm problem.

The fix is to clamp every segment to the note's own length and carry the value
forward rather than assuming the segment completed:

```js
const dEnd = Math.min(when + atk + dec, end);
hold = p * Math.pow(sus, (dEnd - when - atk) / dec);   // where the decay got to
g.gain.exponentialRampToValueAtTime(hold, dEnd);
```

**The general rule: an envelope's segments must be monotonically increasing in
time for every duration the voice can be handed** — and the durations come
from data, so they will eventually be shorter than you designed for.

Three things about it are worth keeping:

- **It hid in plain sight for the life of the engine.** It cannot fire on a
  long note, and most notes are long. Measured across the songs, only 11 of
  ~180 tracks were affected — but PULSE's STABS was 12 of 12 hits, which is
  exactly the track the CD named first.
- **The same bug made the gamelan gong sound broken in the other direction.**
  Its decay is 3.27 s against a 0.21 s note, so the "ghost" was the entire
  gong: the real hit was a click and a blob of sound arrived three seconds
  later. After the fix the note is short and the 3.25 s *release* is the tail,
  which is what a gong is.
- **`.claude/scripts/short-notes.cjs`** answers "which tracks are short enough
  to be exposed to this", and is the maintenance question behind the gate's
  voice list.

### Gating an envelope: what the check has to get right

Invisible in a mix, unmistakable in the envelope. Fire ONE note of the voice
into a dry `AnalyserNode` (muted into the graph so it is pulled), sample RMS
every 10 ms, and assert the shape. Three ways the obvious check is toothless,
all three hit while writing this one:

1. **Do not anchor on the peak.** Walking forward from the loudest sample is
   wrong for a slow-attack voice: `sawPad`'s note is cut off mid-attack while
   its ghost reaches full sustain, so the maximum sits *inside* the ghost and
   the walk starts past the evidence. **Count humps** instead — a rise over
   40% of peak, ending on a fall under 12% — and require exactly one.
2. **Wait out the previous voice.** Oscillators outlive their envelope by
   design and `gongAgeng` runs 6.8 s, so the row measured straight after it
   reads a gong tail; the voice under test then sits so far below `peak` that
   its own ghost never crosses the threshold.
3. **Do not fire each voice at its shortest note in the data.** That looks
   faithful and is the weakest possible test: `sawPad`'s shortest is 1.154 s
   against a 1.320 s attack+decay, only 13% short, so the re-rise is too small
   for the note to have gone quiet first. Fire well inside attack+decay — what
   is being guarded is the envelope function across the voice parameters in
   use, not the song.

Render the samples as a sparkline (`' .:-=+*#%@'`) in the failure message. The
defect is obvious at a glance and unreadable as numbers:

```
before   :+%@%#*+++**+=:..                 :=*#%%##*++====+++====++**######**==-:.
after    :+#%@@#*+++***+=:.
         0ms        250ms        500ms        750ms
```

## Two mixing facts that are not optional

- **A limiter is what makes "everything on" land instead of clip.** Fifteen
  tracks is a loud sum; a `DynamicsCompressorNode` before the master is the
  whole fix.
- **Per-song level trim.** Un-trimmed, gamelan measured **2.6x quieter** than
  synthwave and the song dropdown doubled as a volume control. A `mix` field
  scaling the bus fixes it, and the gate fails if the songs spread past 2.2x.
  Trim a new song by **measuring** rather than guessing: play it with
  everything held, read the analyser peak, and scale `mix` by the ratio to the
  pack. DORIAN came in at 0.365 against a 0.212-0.327 spread and 0.9 -> 0.7
  put it inside.

Reverb is a synthesized impulse response (2.1 s of filtered decaying noise
plus four discrete early reflections — no asset). Take the send **after** the
track gain: releasing a pad then stops feeding the room but lets the tail it
already put there decay, which is both realistic and why the gate's
released-floor check allows ~0.001 rather than 0.

## The two gates, and why both

**A pure-node gate over the hand-authored data found 39 real defects on its
first run** — four patterns one character short of a bar, two the arrangement
referenced that no track had, a melodic gong written in drum characters, four
pads resting half their song. None of them throw, and most are inaudible until
you happen to reach that section. Eval the data literal straight out of the
page and assert the notation contract *and* the design rules (each song within
120-315 s, no pad resting over 45% of a song, 60%+ of steps sounding with
everything held, every resolvable pitch in band — an octave typo is otherwise a
subsonic lead nobody hears).

**A browser gate is separate and necessary**, because "the pads light up" is
not evidence of audio: the lamp is CSS and runs perfectly with the graph
completely dead. Put an `AnalyserNode` on the limiter and assert real signal,
then fire **every distinct (track, pattern, character) triple** through its
real voice — 303 of them here — because a voice that throws on one character
kills the whole scheduling tick, silencing fourteen good tracks, and only in
the sections that use it.

Guard against a computed pattern string, too: a `'...'.replace()` to dodge a
miscount would eval into a pass and be unreadable in the file. The gate greps
for it.
