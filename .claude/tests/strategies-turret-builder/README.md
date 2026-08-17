# Turret Builder — strategy files

Personas for `.claude/tests/eval-turret-builder.cjs`. Each file is one JSON
object (or an array of them) describing how a player behaves; the harness
plays the real campaign with it and reports how far it got.

```
NODE_PATH=<playwright dir>/node_modules \
  node .claude/tests/eval-turret-builder.cjs \
  --strategy .claude/tests/strategies-turret-builder/checkerboard.json
```

Add `--json` for machine-readable output. `stalled@--` means the strategy
cleared all eight levels; `stalled@N` means it failed level N up to the retry
cap (`TB_RETRY_CAP`, default 3).

## Schema

| key | meaning |
| --- | --- |
| `mods` | target share of each module type — `{amp, fire, ice, elec, blast}`. `{blast:1}` is an all-in board |
| `pairs` | `[a, b]` — build NAMED COMBOS instead of chasing a share: fills two opposite sides with `a` and the other two with `b`. A pairs persona only places turrets on cells with all four sides free, because a combo it cannot finish is worth nothing |
| `boosters` | diagonal boosters to place, cycled — e.g. `["twin"]` for an all-in board, `["prism","clock"]` for a mixed one. `[]` never touches the diagonals |
| `noMods` | never place a module at all — the bare-triangle player |
| `gridSmart` | prefer the cell that feeds the MOST structures (the shared cell) over the first free side |
| `noShare` | refuse any cell that would feed more than one structure |
| `scatter` | drop modules where they touch nothing, to price what adjacency is worth |
| `walls` | how many walls to keep standing (`0` never builds one) |
| `wallMods` | priority list of module types for a wall's two free sides |
| `lab` | **positional** plan of lab track ids. Repeating an id means "another tier at that point", so `['grid','chassis','grid']` is grid-1 -> chassis-1 -> grid-2 |
| `upgrade` | `never` \| `value` (level 3) \| `aggressive` (level 4) |
| `place` | where along the road turrets want to sit — `0.0` entry, `1.0` exit |
| `placeStrict` | refuse cells outside that window rather than merely preferring it |

Valid lab ids come from the `LAB` table in the game:

```
grep -o "{ id:'[a-z]*'" games/turret-builder/index.html | sort -u
```

## Having an agent play

The reason personas are data and not code: a subagent can author them. A
useful prompt gives the agent the schema above, the two commands, and a set
of lines of attack — mono-element grids, extreme placement, wall-heavy or
wall-free builds, lab plans that ignore GRID, layouts that chase sharing to
the exclusion of coverage — and asks for a ranked table plus **anything that
beat the built-in `coherent` persona**. A strategy that clears more easily or
scores materially higher is an exploit, and that is the most valuable thing
the exercise can produce.

Cheap enough to run wide: each strategy takes about a second.

## Four traps that make a persona lie

1. **A `lab` list that is not walked positionally strands cores.** The first
   interpreter fell through to the next id whenever it could not afford the
   current one, which turned every persona into "buy whatever is cheapest".
   The reference build reached level 3 with GRID still on tier 1 — and the
   tell was that *no value of `HP_LEVEL` changed the outcome at all*. **If a
   curve sweep does nothing, the curve is not what is stopping the persona.**

2. **A pairs persona that packs its turrets builds no combos.** A combo needs
   all four sides, so a turret wedged between two others can never carry one.
   The first version placed eleven turrets on the best-coverage cells and
   reported a full board with **zero combos**. `turretScore` now refuses any
   cell with fewer than four free sides in pairs mode.

3. **Always read the printed `board:` line before believing a verdict.**
   `orphan-mods` is *supposed* to show 0 links; `coherent` showing 15 links
   means it was cash-starved, not out-designed. `0 combos` on a pairs persona
   means the persona is broken, not that combos are weak.

4. **Do not read seeds as robustness.** The simulation carries no gameplay
   randomness — waves, elites, targeting and damage are all deterministic, and
   `RNG` only drives sparks and screen shake. Runs are byte-identical across
   `--seed` values. That makes the eval exactly reproducible, but agreement
   across seeds is **not** evidence of a robust balance. Vary the persona.
