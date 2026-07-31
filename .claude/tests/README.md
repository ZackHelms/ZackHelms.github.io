# .claude/tests

Gameplay-driving test suites that are worth keeping.

Most games in this repo are verified by a drive suite written in the session
scratchpad and thrown away afterwards — that is still the default, and it is
fine for a game whose rules fit in your head. A suite earns a place here when
**re-deriving it would cost more than reading it**: when it encodes fairness or
design invariants rather than just poking the UI.

| Suite | Game | Why it lives here |
| --- | --- | --- |
| `drive-wayfinder.cjs` | `games/wayfinder/` | 82 checks including a BFS walkability gate, a final-leg gate (every route the lessons instruct is walkable), and a cheat gate (each lesson refuses to complete without its technique). These caught an objective placed behind a 74° face and another placed inside a stream channel. |
| `drive-phasic.cjs` | `games/phasic/` | 87 checks: a scripted player solution for every one of the 16 levels (final-leg gate on the soft-body sim), fit-gating negatives, freeze-needs-room refusal, the heat/cold cancel rule with bucket accounting, gravity-well dock/undock, and locked-gem immunity. These caught freeze teleporting a puddle into mid-air, liquid spreading too flat to ever refreeze (missing cohesion), gas physically unable to find a flue (missing pressure guidance), and gas clouds too widely spaced to fit their destination pocket. |

Run them the same way as the smoke gate:

```
npm install playwright-core          # once, any directory
NODE_PATH=<that dir>/node_modules node .claude/tests/drive-wayfinder.cjs
```

Each prints a `... DRIVE: N passed, M failed` final line and exits 0/1.

Harness patterns, and the accumulated list of ways these tests go wrong before
the game does: `.claude/notes/20260724-headless-mobile-game-testing.md`.
