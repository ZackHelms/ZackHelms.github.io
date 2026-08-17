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
| `mods` | target share of each module type among placed modules — `{fire, ice, arc, blast}`. Shares are relative, so `{fire:1}` is a mono-fire grid |
| `noMods` | never place a module at all — the bare-triangle player |
| `gridSmart` | prefer the cell that feeds the MOST structures (the shared cell) over the first free side. This is the knob the whole game is about |
| `noShare` | refuse any cell that would feed more than one structure — the same modules, the same spend, deliberately un-shared |
| `scatter` | drop modules on cells that touch nothing, to price what adjacency is actually worth |
| `walls` | how many walls to keep standing (`0` never builds one) |
| `wallMods` | priority list of module types for a wall's two free sides |
| `lab` | **positional** plan of lab track ids. Repeating an id means "buy another tier of it at that point in the order", so `['grid','chassis','grid']` is grid-1 → chassis-1 → grid-2 |
| `upgrade` | `never` \| `value` (level 3) \| `aggressive` (level 4) |
| `place` | where along the road turrets want to sit — `0.0` entry, `1.0` exit |
| `placeStrict` | refuse cells outside that window rather than merely preferring it — without it a "camp the exit" persona quietly spreads out once the good cells fill, and stops being a bad persona |

Valid lab ids come from the `LAB` table in the game:

```
grep -o "id:'[a-z]*'" games/turret-builder/index.html | sort -u
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

## Three traps that make a persona lie

1. **A `lab` list that is not walked positionally strands cores.** The first
   version of the interpreter fell through to the next id whenever it could
   not afford the current one, which quietly turned every persona into "buy
   whatever is cheapest the moment you can afford it". The coherent build
   reached level 3 with GRID still on tier 1, and — the tell — *no value of
   `HP_LEVEL` changed the outcome at all*. If a curve sweep does nothing, the
   curve is not what is stopping the persona.

2. **A persona that never gets the board it is meant to have proves nothing.**
   Check the printed `board:` line (turrets · modules · walls · live links)
   before believing a verdict. `orphan-mods` is *supposed* to show 0 links;
   `coherent` showing 15 links means it was cash-starved, not out-designed.

3. **Do not read seeds as robustness.** The simulation carries no gameplay
   randomness — wave composition, elite stamping, targeting and damage are
   all deterministic, and `RNG` only drives sparks and screen shake. Runs are
   therefore byte-identical across `--seed` values. That makes the eval exactly
   reproducible, but it means agreement across seeds is **not** evidence of a
   robust balance; vary the persona, not the seed. `--seed` exists to pin the
   cosmetic RNG and to keep the hook honest if a gameplay roll is ever added.
