# Grid Defense — strategy files

Personas for `.claude/tests/eval-grid-defense.cjs`. Each file is one JSON
object (or an array of them) describing how a player behaves; the harness
plays the real campaign with it and reports how far it got.

```
NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
  node .claude/tests/eval-grid-defense.cjs --strategy .claude/tests/strategies/example.json
```

Add `--json` for machine-readable output. `stalled@--` means the strategy
cleared all ten levels; `stalled@N` means it failed level N up to the retry
cap (`GD_RETRY_CAP`, default 3).

## Schema

| key | meaning |
| --- | --- |
| `skills` | priority list of skill-node ids, retried in order every time points are spent. Repeat an id to buy several ranks. `[]` never spends. |
| `armory` | tier-purchase priority by turret type. `[]` never buys. |
| `research` | melt spare cores into skill points |
| `mix` | target share of each turret type among placed towers |
| `place` | where along the road each type wants to sit — `0.0` entry, `1.0` exit |
| `placeStrict` / `placeWindow` | refuse cells outside the window rather than merely preferring it — this is what makes a "bad placement" persona genuinely bad instead of quietly spreading out once the good cells fill |
| `upgrade` | `never` \| `value` \| `aggressive` |
| `abilities` | fire the COMMAND actives when they are up |

Valid skill ids come from the `TREES` table in the game:

```
grep -o "id:'[a-zA-Z]*'" games/grid-defense/index.html | sort -u
```

## Having an agent play

The reason personas are data and not code: a subagent can author them. A
useful prompt gives the agent the schema above, the two commands, and a set
of lines of attack (single-type builds, extreme placement, one-tree
specialists, economy-first, anything degenerate) and asks it to report a
ranked table plus **anything that beat the built-in `good-mix`** — a
strategy that clears more easily or scores materially higher is an exploit,
and that is the most valuable thing the exercise can produce.

Cheap enough to run wide: each strategy takes 1-3 seconds.
