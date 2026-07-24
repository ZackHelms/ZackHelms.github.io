# Neon Recall (`games/neon-recall/index.html`)

Pair-matching memory board. Solo = round campaign on a mistake budget
("SCANS"); Versus = pass-and-play hot-seat (classic memory rules — no
hidden info, so no handoff screens needed). Persist: `neonRecall.best`,
`neonRecall.bestRound`, `neonRecall-mute`.

## Rules engine

- `tiles[]`: `{id, power, up, taken, fl, pulse}`; pair identity = `id`
  (glyph shape = id%15, color = id%6 — `drawGlyph` draws 15 vector
  shapes). `flipTile(i)` is the single rules entry: guards
  (`state==='play'`, `lockT<=0`, not up/taken), first flip stores
  `firstIdx`, second resolves instantly on match / starts the 0.9 s
  `lockT` view window on mismatch (`pendA/pendB` flip back in
  `resolveMismatch`).
- Solo: match = `100 + 50·(streak−1)`; mismatch burns a SCAN
  (`misses--`), 0 scans with pairs left = run over. Round clear bonus
  `250 + 150·scansLeft`. Grids: `ROUND_GRID` 3×4 → 5×6 (round 5+);
  budget `max(4, pairs − round)`.
- Power pair (solo round ≥2, one per round, type cycles
  peek/turns/bomb by round): peek = reveal whole board 1.3 s; turns =
  +2 scans; bomb = removes a random extra pair (+100).
  **`checkBoardDone()` guards on `state==='play'` — a bomb can clear the
  board inside `applyPower` and `flipTile` calls `checkBoardDone` again
  right after; without the guard the round bonus double-pays** (caught in
  review).
- Versus: 3×6 board, **9 pairs — odd count means no draws**. Match =
  +1 point + keep the turn; mismatch passes (`passT` banner). No powers.

## Deal

`buildBoard(pairs, rng, withPower, round)` — Fisher-Yates over id pairs,
mulberry32 seeded `runSeed + round*7919`; `startSolo(seed)` /
`startVersus(seed)` are deterministic for tests (bomb's target pair is the
one `Math.random()` exception).

## Audio

House pattern; music = 108 BPM major-pentatonic marimba pings (triangle +
sub-octave sine) over a low sine root. SFX: flip (440/520 by first/second),
match arp rising a semitone per streak, soft saw mismatch, pass toot,
power arp, clear/over runs.

## Headless test recipe (`test-neon-recall.cjs` pattern, 28 checks)

- Drive purely via `flipTile(i)` + helpers `pairOf(i)`/`mismatchOf(i)`
  (findIndex on ids); step time with `update(1/60)` loops to expire
  `lockT` before asserting flip-backs.
- Force power scenarios by overwriting `tiles[i].power` on both tiles of
  a pair before flipping — powers fire on match, no RNG needed (except
  bomb's target choice, so assert taken-count delta, not which pair).
- Verified math anchor: seed 31337 round 1 perfect-clear = 2350
  (100+150+…+350 streak run + 250 + 5×150 bonus).
