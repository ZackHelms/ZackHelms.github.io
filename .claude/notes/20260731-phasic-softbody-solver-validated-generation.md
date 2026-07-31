# Phasic: soft-body PBD in a single file, and solver-validated generation

Engineering lore from the four Phasic builds (2026-07-31, commits
e14e404 → ffaf9f0). Game context: `.claude/phasic.md`. Suite:
`.claude/tests/drive-phasic.cjs` (195 checks).

## Soft-body particles that read as liquid/gas (Canvas 2D, no libs)

Verlet/PBD at 1/120: each gem ≤5 particles, MST tethers recomputed ~0.12 s,
pairwise everything is trivial at this size. Three properties were each
DISCOVERED missing by the drive suite, not by eye:

- **Cohesion is not optional.** Max-distance tethers alone let a 4-square
  puddle spread into a 4.3-cell single-file pancake — at which point no
  footprint-shaped freeze placement can ever cover it. A weak pull back
  toward ~0.98-cell rest spacing (f≈0.045) fixed refreeze *and* made
  puddles look like liquid.
- **Gas spacing must fit its destinations.** The design spec's "gas squares
  stay within two cells" is also a level-design constraint: at 1.9-cell
  spacing a 4-mote cloud needs ~5.7 linear cells and gets one mote squeezed
  out of a 6×2 pocket (it then dangles under the lip, tethered through the
  wall, and drags the whole condensate out later). 1.6 fits the pockets.
- **Buoyancy+noise cannot find a chimney.** Gas pins under the first
  ceiling forever. The fix is a guidance field: value-iterate "best
  reachable potential" over open cells (potential = distance from the
  gravity point; a deep virtual point when gravity is plain down), then
  accelerate each mote toward the best neighbor. Rebuild on gravity
  change; suppress inside fan beams. This is also why gas herding is a
  gravity-well skill: with plain down, ceiling potentials tie and the
  cloud parks at the flue mouth — the well must exist before any gas level
  in the curriculum.

Other keepers:
- **Freeze placement search**: candidates near the puddle's ideal anchor
  (r≤1.7, per-particle jump ≤1.9 cells) with a longer 2.35 reach reserved
  for the socket ("close counts, it snaps in"). Without the tight caps the
  suite caught a puddle freezing into MID-AIR 2.5 cells above a shelf.
  Occupancy must include obstacle cells (hole/bush/fan) or gems freeze
  onto hazards.
- **Point gravity cuts both ways**: "away from the well" points DOWN for
  anything below a mid-height well. Herding gas means bottom corners.
  Conversely a well parked ABOVE a puddle's level lifts liquid over walls.
- **Symmetric reversion** (`phase = base + flames − frosts`): every
  transition still runs through the room-check state machine. The nasty
  bug: `home` was only recomputed for solids, so melting a socketed gem
  left a stale home=true that could have faked a win. Recompute for every
  gem, and clear the flag inside melt().

## Solver-validated generation — a served level is a solved level

`buildGen(i,salt)` constructs a candidate from the curriculum block's
factor set; `makeScript()` plans player verbs (drag routes via
wide-enough gaps, melt-pour-tap otherwise, frost verbs for base states);
`runScriptFast()` executes them headlessly on the REAL sim (gem death
aborts). Failing salts are discarded (0–19, then validated easy rescue
salts 90–95). Consequences that made this worth it:

- The winning script is stored → the drive suite replays every generated
  level (generated-content gate) and STUCK/auto-solve falls out for free.
- **Determinism needs the sim seeded too, not just the generator** — gas
  wander phases were `Math.random()` and would have made level N differ
  per device; they're now seeded per level+particle.
- Generation cost is 20–150 ms per level at load — no precomputation
  needed even for "thousands of levels".
- Obstacle placement doesn't need to be provably safe by construction —
  the solver dying IS the proof-of-avoidability filter. (Tuning still
  matters: the hole's pull radius had to shrink so floor-crossing liquid
  one cell below survives, or every block-5 salt failed.)

## Suite-writing traps specific to this kind of game

- `?test=1` freezes rAF sim-stepping; everything advances via
  `__GF.step()` — deterministic, but toasts/fx age in REAL time, so
  screenshots taken between synchronous steps show stale rings/toasts
  (rAF starvation artifact, not a bug).
- The freeze animation is 0.5 s — assert `home` no sooner than ~0.9 s
  after a tap, or you'll drag a still-freezing gem (no-op) and read a
  false failure.
- Frosting/tapping a still-pouring chain is CORRECTLY refused (mid-air
  vertical shape has no valid placement) — drain conditions must wait for
  `miny` to reach the floor, not the centroid.
- **Drag-only maps can hide dependency CYCLES.** Whole Spectrum's first
  layout deadlocked: M needed col7 before G homed, G had to clear the lane
  before P, P had to clear row1 before M. Hand-verify the unpack order
  against every socket marking (they're walkable until their gem homes) —
  or redesign the map; we removed the shelf entirely and moved one socket.
- Two-band generated sockets: travel lanes (rows 0–2 top, 6–8 bottom)
  must stay ≥ the tallest crossing gem, or parked sockets block later
  travelers; 3-tall gems always socket in the bottom band.

## Template + weaving lessons (added after the 2026-07-31 burndown)

- **One shared script runner is the invariant.** Validation (`runScriptFast`
  = synchronous drain, `solving` on) and the STUCK ghost (paced by
  frames/`__GF.step`, `solving` off) both execute `scriptRunner`. Any new
  script op (e.g. the `{g:[]}` dock-the-well form) is automatically
  understood by both — and any op added anywhere ELSE would desync them.
  Extend the runner, never fork it.
- **Byte-diff proof for determinism-preserving refactors.** When adding a
  new seeded draw ahead of existing ones, prove old outputs survive: patch
  a baseline copy with a stand-in `r()` and diff every candidate def
  (index × salt) against the new code's same-template output. The template
  pick was proven this way over 1105 candidates before shipping.
- **Packing-order conflicts collapse template solve rates.** Two-shelf's
  first cut solved 19% of candidates — scatter wanted nearest-gap-first,
  shelf packing wanted farthest-first. Deal sockets FROM the scatter
  (scatter-first, pack outside-in from each gap) → 42%. When a new
  template underperforms, measure per-salt solve rates and look for two
  heuristics fighting; don't just add salts.
- **Plain candidates win the salt race unless woven ones are preferred.**
  In-path hazards are rarer than plain solvable boards, so `getLevel`
  must prefer the first WOVEN candidate that solves (blocks 5–7) or
  hazards stay decorative forever. Weave odds ramp within a block
  (0.2 + 0.12·p) so hazards lean late and the complexity envelope stays
  truthful.
- **Rescue-band fallthrough is the canary.** A template/weave change that
  drops any sub-65 index to rescue salts (≥90) has broken difficulty —
  the suite's per-index `salt` in `genInfo()` makes this checkable.
- **Solver-validates ≠ player-can (phasfreeze, 2026-07-31).** The script
  runner's `{c:}` freeze op deploys the gravity well below the board and
  retries when a freeze is refused — so the replay gate stayed green on
  every level whose settled T5 puddle refused 100% of first frosts for a
  player who simply let it rest (the structural `h−0.9 > 1.9` cap
  disease). When a validation path has a built-in recovery a player would
  never discover, its green is a proxy metric: audit what the *bare* play
  path does before trusting it for fairness.
