# Shadow Circuit (`games/shadow-circuit/index.html`)

Top-down stealth-maze: tap-to-move pathfinding, guard vision cones, collect
all gold cores then reach the exit. Run = 3 lives, endless floor campaign
with rising guard counts/speed. Persist: `shadowCircuit.best` (score),
`shadowCircuit.bestLevel` (floor), `shadowCircuit-mute`.

## Level generation (`startLevel(l, seedOverride)`)

- `levelConf(l)`: floors 1–5 step 11×15 → 13×19, 3→5 cores, 2→4 guards;
  6+ adds guards (cap 6) and +2%/floor guard speed (cap ×1.3).
- `genMaze`: recursive backtracker over odd cells (all odd,odd cells are
  floor and connected — start `(1, ROWS-2)` is always reachable), then ~14%
  extra wall knock-outs create loops so guards can be circled.
- Exit: reachable floor in rows ≤3 farthest (BFS) from start. Cores: BFS
  dist ≥4 from start, ≥3 manhattan apart. Shadow tiles: ~10% of floors.
- Guard patrols: BFS route between two floor cells ≥5 from start, length
  ≥5, soft-rejected if the route brushes within 1 cell of start (relaxes
  after 200 tries). Guards ping-pong the route (`ri`/`dir`).
- Seed: `runSeed + level*7919`; `startLevel(l, seed)` is fully
  deterministic — same maze/cores/guards.

## Detection / chase state machine

Guard modes: `patrol` → (meter full) → `chase` → (LOS lost 2.5 s) →
`returning` (BFS back to nearest route node at patrol speed) → `patrol`.
**All movement for a mode lives in that mode's branch — `returning` exists
so patrol ping-pong and return-path never both advance the guard in one
frame** (the double-move bug caught in review). `guardSees()`: range 3.6
cells, cone half-angle 0.62 rad around `facing`, Bresenham LOS (walls
block), suppressed while `readyT > 0` (1.5 s level grace) or
`playerHidden()` (standing still, centered on a shadow tile). Meter fills
in ~0.33 s (`detect += 3dt`), decays at 1.5/s. Full → alert (`spotted`
kills the floor's ghost bonus). Chase repaths BFS to the player every
0.5 s at 3.5 cells/s vs player 4.4 — the player outruns straights, corners
break LOS. Contact (< 0.55 cells, any mode) = caught: −1 life, 1 s flash,
respawn at start with cores kept, guards reset. 0 lives = run over.

## Scoring

Core +250 · floor clear +500 · time bonus `max(0, 300 − 5·seconds)` ·
ghost bonus +400 if never alerted this floor.

## Audio

House pattern; music = 72 BPM deep sine pulse (55/58.3 Hz) + sparse
triangle plucks; when any guard is chasing the scheduler layers urgent
7 kHz hats + saw stabs (reads live `guards` state — no mode swap needed).
SFX: tap blip, core chime, exit-unlock arp, alert sting, caught descent,
clear arp.

## Headless test recipe (`test-shadow-circuit.cjs` pattern, 25 checks)

- Everything top-level: `startLevel(l, seed)`, `setDest(c,r)`, `bfs`,
  `bfsDistMap`, `losClear`, `update(dt)` (step via
  `for(i<secs*60) update(1/60)`).
- Stage detection scenarios by writing `grid`/`player`/`guards` directly:
  carve a lane, place a stationary guard (`speed:0`, 2-node same-cell
  route) facing the player.
- **Trap (hit in this build's drive): movement assertions must clear
  `guards = []` first** — a live patrol can catch the player mid-walk and
  respawn them at start, failing a position assert that has nothing to do
  with movement.
- Sweep: 5 floors × 20 s with random `setDest` every 2 s, asserting guards
  never occupy a wall cell.
