# Synthesizing whole songs in WebAudio (2026-09-17, music-mixer)

Five songs, ~5:00 each, fifteen independent stems apiece, **no audio assets at
all**. Written for Music Mixer; the parts worth reusing are the data model, the
Karplus-Strong workaround, the scheduling decision and the two gates.

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

## Two mixing facts that are not optional

- **A limiter is what makes "everything on" land instead of clip.** Fifteen
  tracks is a loud sum; a `DynamicsCompressorNode` before the master is the
  whole fix.
- **Per-song level trim.** Un-trimmed, gamelan measured **2.6x quieter** than
  synthwave and the song dropdown doubled as a volume control. A `mix` field
  scaling the bus fixes it, and the gate fails if the five spread past 2.2x.

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
285-315 s, no pad resting over 45% of a song, 60%+ of steps sounding with
everything held, every resolvable pitch in band — an octave typo is otherwise a
subsonic lead nobody hears).

**A browser gate is separate and necessary**, because "the pads light up" is
not evidence of audio: the lamp is CSS and runs perfectly with the graph
completely dead. Put an `AnalyserNode` on the limiter and assert real signal,
then fire **every distinct (track, pattern, character) triple** through its
real voice — 265 of them here — because a voice that throws on one character
kills the whole scheduling tick, silencing fourteen good tracks, and only in
the sections that use it.

Guard against a computed pattern string, too: a `'...'.replace()` to dodge a
miscount would eval into a pass and be unreadable in the file. The gate greps
for it.
