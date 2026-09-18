# Reading tempo and metre out of finger taps

Music Mixer's RECORD tool has to turn a list of tap times into a BPM, a time
signature and a bar grid, with no click track to lean on — the click is
*derived* from the performance, not played during it. This is the derivation,
the four versions that were wrong, and what the measured accuracy actually is.

Shipped in `games/music-mixer/index.html` as `onsetStrength`, `detectTempo`
and `detectBeats`. The summary lives in `.claude/music-mixer.md`; this is the
working.

## The input: onset STRENGTH, not onset times

```js
onsetStrength(raws)  ->  [{ t, w }]   // merged within 25 ms, w = how many
```

Pads struck together are **one onset carrying weight**. That weighting is
load-bearing and it is the single most important line in the whole thing:

- **tempo** wants timing, so simultaneous hits must not count three times and
  let a dense chord outvote the grid;
- **metre** wants *accent*, and weight is the only accent information a take
  has. Nothing records velocity — a pad is either pressed or not — so "three
  pads at once" is the entire vocabulary for "this is a downbeat".

Version 3 below deduped simultaneous hits away entirely. Metre detection then
had a flat series to correlate and got **every case wrong**, scoring ~1.00 at
every candidate bar length because the series had no structure left.

## Tempo

Grid fit is the easy half and it was never the problem:

```
for bpm in 60..190 step 0.5:
  for 16 phases across one sixteenth:
    score = sum over onsets of exp(-(distance to nearest sixteenth / 30ms)^2) * w
```

The hard half is the **octave**. Half, double and 1.5x all fit a steady
performance about as well, because they genuinely do: a stream of eighths at
76 BPM *is* a stream of dotted eighths at 114, each sitting dead on its own
grid. No amount of grid-fitting separates them — the fits are equal by
construction.

Three terms settle it, and the key point is that **each one is degenerate
alone and they have to pull against each other**:

| Term | Prefers | Why it cannot work alone |
| --- | --- | --- |
| metrical position — weight landing on beats (`pos%4==0`) and off-beats (`pos%4==2`) rather than smeared across all four | the reading that puts notes at musically sensible places | monotonically prefers **doubling**: halve the sixteenth and an eighth becomes a quarter, so *everything* lands on a beat and the score goes to 1.0 |
| density — onsets per beat, preferred near 2.2 | the reading with musical note density | prefers **halving** on sparse material: one onset per beat looks better at half tempo, where it becomes two |
| a log-normal pull toward ~112 BPM | ordinary tempi | nearly useless for the case that matters — 76 and 152 are almost equidistant from 112, so it cannot break the very ambiguity it was added for |

Final combination:

```js
key = (0.2 + metric) * exp(-(log2(opb/2.2)^2)/2.8) * exp(-(log2(bpm/112)^2)/0.7)
```
evaluated only over candidates within 3% of the best raw grid fit.

## Metre

Autocorrelation of the onset-strength series, **binned on sixteenths**, at lag
`4n` for n in 2..7, with a common-time prior:

```js
adj = r + (n===4 ? 0.16 : 0) - (n===2 ? 0.04 : 0) - (n===6 ? 0.04 : 0)
```

The 2 and 6 penalties are there because a 4/4 pattern also correlates at lag 2
and a 3/4 one at lag 6 — the neighbouring harmonics have to clearly beat the
fundamental, not merely tie it.

**Bin on sixteenths, never on beats.** Binning on beats was version 1's bug and
it is a subtle one. An onset half a beat from the phase sits exactly on a
rounding boundary, `Math.round(0.5)` goes up, and the bar appears to *drift*:
a plain 4/4 rock pattern produced per-beat counts of

```
4,3,3,3,3, 4,3,3,3,3, 4,3,3,3,3, ...
```

— sixteen onsets spread across **five** beat slots, repeating with period 5.
The detector faithfully reported 5/4. The counts looked so nearly right that
the temptation was to adjust the weights; the actual fix was to stop binning at
that resolution.

Also **not** by downbeat weight, which was the first instinct: "the bar's first
beat carries the most onsets" is defeated by any ordinary backbeat, where the
snare beat outweighs the downbeat. Periodicity does not care where the bar
starts.

## The four wrong versions, in order

1. **Downbeat weight + 112 prior.** 4/4 read as 5/4 (the beat-binning drift
   above); 76 BPM read as 114 (1.5x, prior too strong).
2. **Autocorrelation on beats + deduped onsets.** Same drift, still wrong.
3. **Deduped + sixteenth-grid autocorrelation.** Metre now scored ~1.00 at
   *every* lag — dedupe had removed the density that carries the accent. 76
   read as 152 (2x).
4. **Onset strength + metrical-position tie-break.** Metre correct throughout;
   tempo doubled at 76 and 92, because metrical position always prefers
   doubling. Adding density fixed the doubling and introduced *halving*
   (120 -> 60, 100 -> 75). Only the two together, weighted, behaved.

## Tuning method

Weights were grid-searched in a throwaway harness against synthetic takes with
**known** answers — five rhythm patterns crossed with several tempi, metres 2
through 7, and three jitter levels — then scored on a **separate set that was
never tuned on**. The search does not ship; only the weights do.

This matters: the first weight set read **15/15 on its tuning set** and 76% on
held-out data. Quoting the tuning number would have been straightforwardly
false.

## Measured accuracy

Held out, 27 cases per tempo (five 4/4 patterns plus metres 3/5/6/7, three
jitter levels):

| BPM | tempo | metre |
| --- | --- | --- |
| 60 | 0% | 33% |
| 68 | 56% | 81% |
| 76 | 74% | 85% |
| 88 | 89% | 100% |
| 96-141 | **100%** (except 124 at 96%) | **100%** (except 124 at 96%) |
| 152 | 37% | 85% |
| 166 | 33% | 89% |
| 178 | 33% | 89% |

Aggregated:

```
below 85 BPM : 43%   (81 cases)
85 - 145 BPM : 98%   (189 cases)
above 145    : 35%   (81 cases)
```

**Read the aggregate carefully.** An earlier holdout reported "76% overall" —
true, but an artifact of sampling two of its five tempi outside the usable
band. A held-out aggregate is only as meaningful as its sampling distribution,
and quoting one without saying how it sampled is close to meaningless. The
honest statement is the band table, not a single number.

## The edges: where the loop starts and stops

Tempo and metre give the **grid**. A loop also needs its **phase** (which
sixteenth is beat one) and its **length** (how many bars), and neither is in
the tap times in any direct way — both have to be chosen.

### Phase — `detectDownbeat`

Fold the onset-strength series into one bar (`idx mod beats*4`) and score every
rotation against a template:

```
tmpl[0]            = 1      downbeat
tmpl[barSteps/2]   = 0.45   the half bar
tmpl[p % 4 === 0]  = 0.3    the other beats
otherwise          = 0.04
score(r) *= 1.2 if r is the rotation the FIRST onset sits on
```

That bonus is the whole thing. For an ordinary backbeat the fold is symmetric
with period 4 — every rotation by a beat scores identically, because it is
genuinely ambiguous which beat is "one". What is *not* ambiguous is that a take
starts when the player starts playing. The template only overrules it when some
other rotation is clearly the accented one (a crash on the downbeat, a bar that
starts with three pads at once).

The bar line **nearest** the first onset becomes `t = 0`. Nearest, not the one
before: if the first onset turns out to sit more than half a bar before the
chosen downbeat it is a pickup, and a pickup is wrapped to the *end* of the
loop, which is where it plays from. Placing it at the start instead would open
the song with most of a bar of silence — the exact complaint this work came
from.

There was a real bug here in the shipped version: `zero` was
`floor((first - phase) / barSec) * barSec`, where `phase` is a *sixteenth*
phase sitting within half a step of the first onset. When it landed a hair
after, `floor` returned -1 and the song opened with a whole empty bar.

### Length — `loopBars`

Score every candidate length 1..(bar of the last onset + 1):

```js
score(L) = (kept weight / total weight) * mus(L) * fill(L)
mus  = L%4===0 ? 1 : L%2===0 ? 0.94 : 0.9
fill = min(1, 0.4 + 0.6 * (weight in bar L-1) / (mean weight per bar over L))
```

Three terms, each useless alone, same as the tempo octave:

| Term | Alone it prefers |
| --- | --- |
| cost (kept/total) | the longest candidate — keep everything |
| fill | the shortest — a single dense bar |
| the 4/8/16 prior | nothing on its own; it only breaks ties |

The loss exponent was the one tuned knob. At `^1.5` a two-bar take with three
trailing quarter notes read as three bars; at `^1.0` it reads as two and
nothing else regressed, so the term is linear.

**A worked case.** Four bars of a beat plus three quarter notes into the fifth:

- `L=5`: discards nothing, but its last bar holds 3 of 51 weight, so
  `fill = 0.4 + 0.6*0.29 = 0.58`, and `mus = 0.9` -> **0.52**
- `L=4`: discards 3/51 = 6%, last bar full, `mus = 1` -> **0.94**

### Measured

Synthetic takes with known lead-in, length and trailing fragment; tuned on one
set, scored on another never tuned on:

```
start alignment : 100%   (864/864 held out)
loop length     :  99%   (792/796 held out, given the metre was right)
```

The four length misses are all two-bar takes where the "fragment" is nearly a
whole bar — genuinely ambiguous, and the BEATS/BPM controls move the bar lines
if the CD disagrees.

Two rules keep the seam closed once the length is chosen, and both are easy to
get wrong:

1. **Read the length off the sixteenth grid, never off the snapped positions.**
   A coarse SNAP (1/4, 1/2) must be able to move the last note *onto* the
   closing bar line without the song growing a bar to hold it — so a note that
   snaps onto the loop point wraps to step 0, where it is the downbeat played a
   hair early.
2. **Clip note durations at `dur`.** A tail that rings past the loop point
   overlaps the next pass on every repeat.

And the length is **derived**, never stored: correcting the BPM in the edit bar
means the same performance is genuinely a different number of bars.

## Why this shape makes the UI easy

The failures are **almost never a few percent off** — they are octave errors,
and the detector's bias pulls them *toward* the 85-145 band. A 68 BPM take
comes back as 136; a 166 BPM take comes back as 83. Both are one tap from
correct, and the tap is always the same tap.

So the edit bar carries **one-tap ÷2 and ×2** beside the BPM field rather than
only a number to type. They **refuse out of range instead of clamping**:
clamping meant 112 ×2 became 220 (the old ceiling) and ÷2 then returned 110,
so the round trip did not round-trip — which defeats the entire point of the
pair.

Metre gets the same treatment with a BEATS dropdown, for the same reason: it is
a guess, it is right in the common band, and correcting it should cost one
gesture.

The general form of this is now a conventions row in `games/CLAUDE.md`
(**Tuning a heuristic**): read the residual failures and answer them in the
interface, rather than hiding an imperfect estimate or pretending to a
precision the method does not have.
