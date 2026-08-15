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
| `drive-grid-defense.cjs` | `games/grid-defense/` | 50 checks on RULES (balance lives in the eval next to it, so a rebalance never fights a mechanics regression): the wave-by-wave intro schedule, the timer-driven continuous flow (grace → wave → gap → level clear, ten waves to a level, nothing waiting on a tap), level retry with a whole-attempt rollback so a level cannot be farmed for cores by dying on purpose, tree gating, persistence, scoreboard, and the curve's shape. It also presses the canvas-drawn UI through real touch events, which is where this repo's stale-hitbox bug lives. Caught a clear-phase that re-fired and farmed the level bonus forever, a between-levels auto-save that reopened the next level holding the previous level's board, random elite stamping that made wave HP dip level-to-level, and a deferred game-over screen that popped over a freshly started run. |
| `eval-grid-defense.cjs` | `games/grid-defense/` | Balance and pacing, not rules. Plays the real campaign with declarative strategy personas — no skills, bad skills, bad tower mix, bad placement, no armory, and **one per skill tree** — and asserts the design's difficulty *claims*, including the hard requirement that **specialising in any single tree can still clear all ten levels**. Seeded (`--seed`) because crit rolls alone swung a verdict by two levels between identical runs. It caught: difficulty running backwards inside a level, research strictly dominating the armory, a 23-strategy agent exploration whose headline "3.3x gap" was really short skill lists stranding 88 of 116 points, and two trees that could not finish alone (ENGINEERING after deploy caps gutted its economy identity, COMMAND for having no way to turn army size into damage). |
| `drive-phasic.cjs` | `games/phasic/` | 246 checks: scripted player solutions for all 24 authored curriculum levels, solver-script replays for every generated level below 65 plus endless spot checks (a served level is a solved level), template-coverage and in-path weave gates (void under the pour line, mid-field hedge, ridden fan lane), base-state rules (born-liquid needs a latched frost; removing it melts again), obstacle gates (void consumes + retry, bush stops stone/drinks liquid/passes vapor, fan blows only gas), the Stopper tactic both ways, symmetric reversion, live sockets, win-with-deployed-well, STUCK, menu format, and a complexity-ramp assertion. Earlier rounds caught freeze teleporting a puddle mid-air, liquid too flat to refreeze (missing cohesion), gas unable to find a flue (missing pressure guidance), and a stale home flag on melted gems that could have faked a win. |

Run them the same way as the smoke gate:

```
npm install playwright-core          # once, any directory
NODE_PATH=<that dir>/node_modules node .claude/tests/drive-wayfinder.cjs
```

Each prints a `... DRIVE: N passed, M failed` final line and exits 0/1.

Harness patterns, and the accumulated list of ways these tests go wrong before
the game does: `.claude/notes/20260724-headless-mobile-game-testing.md`.
