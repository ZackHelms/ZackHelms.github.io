# Neon Tripeaks (`games/tri-peaks/index.html`)

Classic 28-card Tri-Peaks solitaire, tap-only, portrait. Modes: FREE PLAY
(random seed) and DAILY DEAL (seeded from UTC date — same board for
everyone, best-of-day persisted).

## Board geometry

- `POSITIONS[]` (module const): 28 slots as `{row, p}` — row 0 = 3 peak
  tops at p 1.5/4.5/7.5; row 1 = 6 at p 1,2,4,5,7,8; row 2 = 9 at p
  0.5–8.5; row 3 = 10 at p 0–9 (contiguous, always exposed). Index order:
  0–2 row 0, 3–8 row 1, 9–17 row 2, 18–27 row 3.
- `coverIdx[i]` precomputed: the row+1 cards at p±0.5 that must both be
  removed before card i is `exposed(i)`. Rows 0–2 render face-down until
  exposed.
- Layout in `resize()`: `CW = min(46, (W-16)/10)`, `CH = CW*1.5`,
  `boardY = min(safeTop+170, H*0.2)`; rows overlap at `0.55*CH`.
  Stock/waste sit in the thumb zone via `wasteXY()` =
  `max(board bottom + 40, H - sab - CH*1.4 - 130)`.

## Rules / scoring

- `adjacent(a,b)`: rank distance 1 with K↔A wrap (`(a-b+13)%13` is 1 or 12).
- `doMoveAt(i)`: only if `playable(i)` (exposed + adjacent to waste top).
  Score `100 + min(4, streak-1)*100` (max 500/card). Peak tops award
  500/1000/2000 for 1st/2nd/3rd peak. Win (all 28 removed) pays +300 per
  leftover stock card. `flipStock()` resets streak to 0.
- Deal over when stock empty and no playable card (checked after every
  move/flip). `state`: menu | play | won | over.

## Deal generator (fairness, deterministic)

`genDeal(seed)`: up to 60 attempts at `seed + attempt*7919` (mulberry32 +
Fisher-Yates). A deal is accepted when (a) ≥2 of the 10 row-3 cards are
immediately playable on the opening waste card and (b) a greedy
full-knowledge sim (`greedySim`) clears ≥14 of 28. Daily seed:
`hashStr('TP-' + utcDateStr())`; daily number counts from
`DAILY_EPOCH = Date.UTC(2026,0,1)`.

## Persistence

`triPeaks.best` (free best, int) · `triPeaks.dailyBest` (JSON
`{date, score}`, valid only when date === today UTC) · `triPeaks-mute`.

## Audio

House pattern (lazy AC on first gesture, sfx/music masters). Music: swung
lounge loop, 96 BPM eighth notes with 0.3-step swing offset — `BASS_SEQ`
32-step walking bass + `CHORD_SEQ` two-note stabs + hat noise (highpass
5 kHz) routed to `musicGain`. SFX: `sfxPick(streak)` rises a semitone per
streak step (capped +8), flip/nope/peak/win/lose.

## Headless test recipe (`test-tri-peaks.cjs` pattern, 25 checks)

- All rules functions and state are top-level: drive with
  `startGame('free', seed)`, `doMoveAt(i)`, `flipStock()`, inspect
  `board/stock/waste/score/streak/state`.
- Greedy bot (play first playable else flip) reaches `won`/`over` in <400
  iterations — good end-to-end sweep.
- Real-input checks: canvas tap on `cardXY(i)` center for an exposed row-3
  card; stock tap zone has +14px slop.
- Trap: several `doMoveAt` calls in one evaluate spawn overlapping score
  popups in a screenshot — cosmetic, sequential in real play.
