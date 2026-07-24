# Word Circuit (`games/word-circuit/index.html`) — architecture notes

Drag-connect word hunt on a 5×5 letter grid. Two modes: **DAILY** (seeded
from the UTC date — same board for everyone, `DAILY #n` numbered from
2026-01-01) and **FREE PLAY** (random seed). 90-second rounds.

## Dictionary (the load-bearing piece)

- `DICT_RAW` is an embedded ~5.3k-word uppercase list (~31 KB), 3–8 letters,
  generated from a curated common-English base list plus regular +S/+ES/-IES
  forms. Generator lives in session scratchpad (`gen-dict.py` pattern): a
  `NO_S` blacklist keeps junk forms (HISES, ALIKES, ECHOS…) out — function
  words, adjectives, adverbs, irregulars, mass nouns never get S-forms.
- `PREFIX` set holds every prefix of every word (solver pruning).
- Menu copy says "compact built-in dictionary — common words only" to set
  expectations; obscure-word misses are accepted, junk words are not.
- To extend vocabulary: add base words (or explicit forms) to the generated
  list and re-inject; keep words ≤8 letters (solver caps DFS at 8).

## Board generation + solvability guarantee

- Big-Boggle 25-die faces (`DICE`); `Q` face = "Qu" tile (`grid[r][c]` is
  `'QU'`, drawn as "Qu", contributes 2 letters to words).
- `genBoard(seed)`: mulberry32-seeded shuffle+faces; solve; **reroll while
  fewer than `MIN_BOARD_WORDS` (45) findable words**, advancing the seed as
  `seed + attempt*7919` for ≤60 attempts — deterministic, so the daily board
  is still identical for everyone.
- `solveBoard` DFS from every cell with prefix pruning; result cached in
  `allWords` (Set). HUD shows `found/total`; end screen lists top-6 longest
  missed words ("MISSED GEMS").

## Input model

- Path built on touch/mouse drag; a cell only registers within a **core
  radius 0.42·cellSize** of its center (diagonal slop guard).
- Extend only to 8-adjacent unused cells. Sliding back onto the
  previous cell pops the last letter (backtrack undo).
- **Trap fixed in testing:** `findIndex` returns −1 for a new cell, and with
  `path.length===1`, `-1 === path.length-2` — must check `idx !== -1` before
  the backtrack branch or every second letter pops the path empty (and
  `sfxPick(-1)` throws non-finite AudioParam).
- Submit on release: ≥3 letters + in `allWords` + not already found →
  `PTS(len)`: 100/200/400/700/1100/1600 for 3/4/5/6/7/8.

## Layout

- Grid is placed in the **thumb zone**: `gridY = max(safeTop+118,
  (H-gridPix)*0.55)`; current-word readout draws at `gridY-42`.
- Canvas needs explicit `width:100%;height:100%` CSS — `inset:0` alone does
  NOT stretch a replaced element, it renders at intrinsic (dpr-scaled) size.

## Audio

House pattern: lazy `AC` on first gesture, `sfxGain`/`musicGain`, mute
persisted at `wordCircuit-mute`, suspend on `visibilitychange`. Pentatonic
pick blips rise per letter; word chime arpeggio scales with length; calm
84 bpm pluck/bass loop via 25 ms lookahead scheduler (only while `state==='play'`).

## Persistence

- `wordCircuit.best` — free-play best score.
- `wordCircuit.dailyBest` — JSON `{date:'YYYY-MM-DD', score}` (UTC date);
  menu shows today's score on the DAILY button, resets naturally at UTC
  midnight.

## Test hooks (headless)

Top-level lets reachable from `page.evaluate`: `state, mode, seed, grid,
allWords, found, foundSet, score, timeLeft, path, gridX, gridY, cellSize,
AC, musicStep, musicTimer, muted`. `startGame(mode, seedOverride)` allows a
pinned seed. Touch drags: synthesize `TouchEvent`s on `#cv` through cell
centers (`gridX + (c+0.5)*cellSize`). Deterministic word pick: DFS the live
`grid` for a member of `allWords`, drive its cell path, assert score/found.
