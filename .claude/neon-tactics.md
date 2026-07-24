# Neon Tactics (`games/neon-tactics/index.html`) — architecture notes

Turn-based squad tactics on a 7×9 portrait grid. Modes: **VS AI** (persisted
W-L record) and **2 PLAYER pass-and-play** (hot-seat with a pass screen
between turns). Win by destroying the enemy **CORE** (hexagon, 8 HP) or
wiping the squad.

## Rules engine

- Squads: 2× STRIKER (6hp/mv3/atk3/rng1), SNIPER (4/2/3/rng3),
  TANK (10/2/2/rng1), MEDIC (4/3/atk1/rng1, heal 3). Data in `TYPES`;
  spawn layout in `spawnSide` (mirrored rows 0-1 / 7-8, core at back-center,
  impassable).
- Per turn every unit has independent `moved` and `acted` flags — move and
  act in either order, any unit interleaving; acting also spends the move
  (`doAction` sets both). Turn auto-ends when all units are spent
  (`maybeAutoEnd`), or via END TURN button.
- Movement: 4-directional BFS (`bfsMoves`) ≤ `mv`; walls, cores, and ALL
  units block. Attacks: manhattan range + **Bresenham LOS** (`hasLOS`) —
  only walls block LOS, units don't. Melee is rng 1 (orthogonal only, by
  manhattan). Medic heal targets = damaged allies in rng, no LOS needed.
- Walls: `genWalls(seed)` places 7+ pairs in rows 2–4, 180°-mirrored to the
  bottom half for fairness; mulberry32-seeded (`startGame(mode, seed)` pins
  layouts for tests).

## AI (side B)

`aiStepOne` activates one unready unit per `AI_STEP_DELAY` (0.55 s) tick —
readable pacing, input locked meanwhile. Greedy scoring over (dest ×
target) pairs: damage×8 (+100 kill), core damage×12 (+200 core kill),
heal×6, advance toward player core ×2, minus `aiThreat` exposure ×4
(enemies with `mv+rng` reach of the dest). No-target dests score
advance-exposure only.

**Trap fixed in testing:** `endTurn()` must clear `aiActive` FIRST —
`doAction → maybeAutoEnd → endTurn` can fire mid-AI-turn, and a stale
`aiActive` lets the AI keep acting on the player's turn.

## Input

Tap = touchstart+touchend within 18 px (drag-scroll guard). Flow: tap own
unit → green BFS move cells + red pulsing target rings; tap cell to move,
tap ring to strike, tap elsewhere to deselect. Selected unit's stat line +
END TURN draw below the board (canvas-drawn button, `endBtnRect` hit test).
In vs-AI, input is fully blocked on turn B; in 2P the pass overlay gates
each handoff.

## Rendering

Units are neon glyphs: striker = directional triangle, sniper = diamond,
tank = square, medic = cross, core = hexagon with HP numeral; side colors
`SIDE_COL` (A green, B purple; red reserved for damage/targets). HP bars
under units; spent units get a dark veil. Move anim = 0.16 s lerp (unit
drawn from anim, not grid, while in flight); shots = glowing line sweep;
floats + screen shake on hits.

## Persistence

`neonTactics.record` = JSON `{w,l}` (vs-AI only). Mute at `neonTactics-mute`.

## Test hooks (headless)

Top-level: `state, mode, turnSide, turnNum, units, cores, walls, selId,
moveSet, targetSet, aiActive, winner, record, boardX, boardY, cell` plus
`startGame(mode, seed)`, `endTurn()`, `attackTargets(u, r?, c?)`,
`doAction`, `refreshSel`, `isWall`, `isCore`. Tap synthesis: touchstart+end
at `boardX + c*cell + cell/2`. Deterministic combat: teleport units, call
`refreshSel`, tap the target cell. AI legality check: after its turn, no
unit overlaps/on-wall/OOB.
