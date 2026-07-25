# Ballpark — architecture & context

`games/ballpark/index.html` (single self-contained file, ~640 lines incl. the
question bank). Estimation trivia: no multiple choice — every question has a
**numeric** answer and you slide a dial to your best guess. Scoring is by how
close the needle lands, so a wrong-but-close guess still pays.

## Why it works as a game

Multiple-choice trivia is binary and you either know it or you don't.
Estimation is *gradeable*: "how tall is Everest" rewards knowing the order of
magnitude even if you're 2 km out. That makes a bank of hard facts playable by
someone who knows none of them exactly.

## The dial (the whole design hinges on this)

Each question carries `{lo, hi, s:'log'|'lin'}` bounding the dial.

- `posOf(q,v)` maps a value → 0..1 along the track; `valOf(q,p)` inverts it.
  On `log` questions the mapping is logarithmic, so an order-of-magnitude
  error costs a constant distance no matter where the answer sits. Use `log`
  for anything spanning decades (distances, populations, weights) and `lin`
  for bounded scales (years, percentages, small counts).
- **Scoring is distance along the dial, not relative error.** `d =
  |guessPos - truthPos|`; `acc = max(0, 1 - d/HIT_BAND)` with
  `HIT_BAND = 0.25`. That single rule works for both scale types and is
  directly readable on screen — the green band drawn at reveal *is* the
  scoring band.
- `BULLSEYE = 0.02` of the track pays a flat +500 on top.
- Points = `round(1000 * acc * mult) + bullseye`, where
  `mult = 1 + min(4,streak)*0.5` (x1 → x3). A zero-accuracy guess breaks the
  streak.

`roundNice()` quantises the readout so the number reads like a human guess
(3 significant figures up high, whole numbers for `lin`), and `fmt()` prints
`8,849` / `1.5 million` / `13.8`.

## Question bank

`BANK[]` — 100+ entries, `{q, a, u, lo, hi, s, c}` across SPACE / EARTH /
BODY / ANIMALS / HISTORY / BUILT / SCIENCE / SPORT. A drive test gates the
content: every answer must sit inside its own range and **not within 5% of
either dial end** (an answer parked at an edge is either unreachable or
free), log ranges must have positive lower bounds, no duplicate prompts.
Add questions freely — the gate catches bad ranges.

Prefer facts that don't drift (physical constants, historical years,
geography). Avoid anything that changes yearly.

## Run structure

`RUN_LEN = 10`. `buildRun(seed)` shuffles the bank with `mulberry32` and
walks it taking **at most 2 questions per category** before filling, so a run
never turns into ten space questions. Two modes:

- **DAILY TEN** — `seedFromString('bp-' + todayKey())`, identical for
  everyone that UTC day; the result is stored under
  `save.daily[YYYY-MM-DD]`.
- **FREE PLAY** — random seed, unlimited.

State machine: `menu → guess → reveal → (guess…) → end`. `lockIn()` scores
and freezes the needle; `nextQ()` advances or ends. The single `#act-btn`
switches label between LOCK IN / NEXT / SEE RESULTS.

## Input

One thumb. `dragZone` is a tall band centred on the dial (`dialRect.y-130`,
280 px tall) — touching anywhere in it jumps the needle to that x and keeps
tracking, so no fiddly grab-the-handle. A tick SFX fires on movement, rate
limited to 32 ms.

## Rendering

Canvas 2D over a dark grid with a soft radial spotlight. Per question: a
category chip, wrapped question text (`wrapText`), the big glowing readout,
then the dial with decade (log) or quarter (lin) ticks. On reveal the truth
marker eases from the guess to the answer over 0.5 s (cubic), the green
scoring band fades in, and the points pop up and drift. Bullseye flashes the
screen gold; a miss shakes it.

**`draw()` bails on `game==='end'` as well as `'menu'`** — after the last
question `qi === RUN_LEN`, so `curQ()` is undefined and every frame would
throw behind the overlay. (Caught by the drive's console-error assert.)

## Audio

Standard stack (`audioInit` builds `sfxGain`/`musicGain` + the shared
`noiseBuf`). SFX: dial tick, lock thunk, reveal sweep, win chime, bullseye
arpeggio, miss buzz. Music: a light game-show shuffle — walking triangle
bass over off-beat hats with a chord stab every bar, 25 ms lookahead
scheduler. Suspends on `visibilitychange`. Mute persists to
`ballpark-mute`.

## Persistence

`localStorage['ballpark']` = `{best, plays, daily:{date:{score,best}}}`.

## Test hooks (`scratchpad/drive-ballpark.cjs`, 34 checks)

`BANK`, `posOf/valOf`, `buildRun`, `seedFromString`, `startRun`, `lockIn`,
`nextQ`, `curQ`, `guessPos`, `score`, `streak`, `results`, `save` are all
reachable from `page.evaluate`. Set `guessPos = posOf(q, q.a)` for a
guaranteed bullseye, or `posOf(...) ± 0.24` to land on the band edge.
