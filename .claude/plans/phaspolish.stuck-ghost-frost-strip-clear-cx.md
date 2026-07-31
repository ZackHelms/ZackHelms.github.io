# phaspolish — Phasic Now-bucket trio: STUCK ghost-replay, frost strip below L25, complexity on the clear screen

**Status:** DRAFT
**Requested:** 2026-07-31 (all three are CD decisions from the 2026-07-31 rounds).
**Scope:** `games/phasic/index.html`, `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`, `games/CLAUDE.md` (blurb only if needed).

> Line references below were verified against commit `7700f84` during the
> planning session. They will drift as tasks land — re-locate by the named
> symbol, not the number.

## Goal

Three CD-signed polish items land as one run: (1) the STUCK button visibly
plays the stored solver script (fast-forward ghost) instead of teleporting
gems home; (2) the cold bucket disappears from every level below L25
(Standing Water is where frost gains its real job); (3) the level-clear
screen shows the level's complexity score. Suite stays green end to end.

## Context

The 2026-07-31 curriculum playtest passed. The CD's standing decisions:
ghost-replay "right after the playtest", strip early frost bucket (it has no
job before base states), show the CX score on clear. All three touch the same
file and are each too small to justify their own oversee run — bundled here
with provenance: each was its own `TODO.md ## Now` entry.

## Implementation guidance (for the overseer)

Tiers assigned under the **balanced** profile (this repo has no local
task-scoping skill — rubric per the zmh-producer scaffold skill).

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Strip frost below index 24 (game + generator + suite rework) | single-system code | sonnet | high | mechanical edits plus real judgment: the quench coverage must be re-homed via a new test verb |
| 2 | Complexity score on the clear screen | mechanical-edit | haiku | medium | verbatim content below; suite check included; machine-checkable |
| 3 | STUCK ghost-replay (stepwise script runner + ghost mode + fallback) | invariant-bearing code | opus | high | refactors the solver executor that the generated-content gate depends on; async orchestration + TEST-mode determinism |
| 4 | Docs + badge sweep | docs | haiku | low | enumerated edits; exact targets below |

- **Ordering / dependencies:** 1 → 2 → 3 → 4, strictly sequential (all tasks
  touch `games/phasic/index.html`). Parallel-safe: none.
- **Files owned per task:** every task: `games/phasic/index.html` +
  `.claude/tests/drive-phasic.cjs`; task 4 additionally `.claude/phasic.md`.
- **Validation per task:** after each task run the full drive suite
  (`NODE_PATH=<scratchpad>/node_modules node .claude/tests/drive-phasic.cjs`)
  → final line `PHASIC DRIVE: N passed, 0 failed`; final gate additionally
  `node .claude/scripts/smoke-mobile.cjs games/phasic/index.html` → `SMOKE: GREEN`.
- **Tier audit (required):** task 1 fails haiku checklist item 4 (the quench
  re-home needs test design); task 3 fails items 4 and 5 (invariant-bearing
  refactor); tasks 2 and 4 pass the checklist (verbatim content, exact
  targets). Split per the spec-then-fill pattern: this plan embeds the
  verbatim content for tasks 2/4.
- **Decision defaults:**
  - Suite totals: never hardcode a new expected count — the invariant is
    "the suite grows by exactly the checks each task adds, and the final
    line reports 0 failed".
  - Ghost replay on a level with no stored script (all 24 authored levels,
    and generated salt-99 emergencies): fall back to a *staggered* fly-home
    (one gem snaps home every ~0.3 s via the existing freeze animation) —
    visible, never the old instant teleport.
  - STUCK pressed mid-level: reload the level first (the script assumes a
    fresh board); discarding partial player progress is accepted.
  - If the ghost run somehow fails mid-playback (it should not — scripts are
    validation-time winners on a deterministic sim): finish with the
    staggered fly-home fallback, still record the clear.
  - Ghost playback speed: ~4× real time (8 sub-steps per rAF frame at 60 fps
    against `HSTEP=1/120`); show `SOLVING…` in `#hintbar` while it runs.
- **Embedded-content QA (required):** the task-2 snippet below was reviewed
  against `levelClear` (`index.html:964-973`) and `cxScore` (`:413`) this
  session; `lvl.cx` exists for every authored def (`LEVELS.forEach` at
  `:411`, `NEWL` defs inline) and every generated def (`buildGen` returns
  `cx`), so the `lvl.cx ?` guard is belt-and-braces only.
- **Escalation triggers:** only a suite failure that resists two diagnosis
  rounds, or any need to change an authored level's *map* (tutorial maps are
  CD content — budgets `heat:`/`cold:` are in scope, cell layouts are not).
- **Playtest:** yes — CD should press STUCK on one generated level (watch the
  ghost solve it), open any level below L25 (no cold bucket), clear any level
  (CX line under the stars).
- **Publish:** default — push `main`, verify the Pages run for the SHA goes
  `success`, update the build badge and state its timestamp in the report.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. **Frost strip below L25.**
   - Set `cold:0` in all 16 legacy `LEVELS` defs (`index.html:128-352`;
     currently `cold:1` or `2`). `NEWL.first/whole` already 0; `NEWL.water`
     (index 24) keeps `cold:1`, `vapor` keeps `2` — they are ≥ L25.
   - Generator (`buildGen`, `:1174`): `cold:` becomes
     `b>=3 ? (nL+2*nG)+(p>=6?1:0) : 0`. This changes no rng consumption
     (cold is computed after all `r()` calls), so maps, salts and cached
     solver scripts are byte-identical — verified reasoning, and the suite's
     generated-content replays prove it.
   - The cold bucket auto-hides at zero budget (`drawBuckets` guard
     `if((hot?lvl.heat:lvl.cold)<=0) continue;` at `:1464`) — no draw change.
   - Hint sweep: grep stripped defs' `hint:` strings + `#hintbar` copy for
     frost/cold mentions; none exist today (verified), the settings-overlay
     copy ("Frost quenches a flame from afar", `:98`) stays — frost still
     exists from L25 on.
   - **Suite rework** (`drive-phasic.cjs`):
     - Add a TEST-only budget verb to `__GF`: `grant:(h,c)=>{heatN+=h;coldN+=c;}`.
     - The L9 Meltdown quench checks (`:168-184`) currently spend the cold
       bucket that will no longer exist. Keep L9 as a pure melt/pour/tap
       solve, and move the two quench assertions ("frost thrown at the hot
       gem is not consumed", "the quench took the flame home AND cooled it
       solid") into a new "mechanic rules" section that loads L9, calls
       `grant(0,1)`, and runs the same sequence. Add the symmetric fire-frees-
       a-frost assertion there too (load 24, freeze with frost, `grant(1,0)`,
       throw heat, expect the frost freed unconsumed — `dropSourceOn`
       `:885-888`).
     - Kettle check `:292`: `coldN === 2` → `coldN === 0` (text: "no frost
       bucket exists here at all").
     - New sweep: fresh-load every authored index < 24 and assert
       `s.coldN === 0`; fresh-load 24 and 32 and assert `1` and `2`.
2. **Complexity on the clear screen.** Verbatim:
   - After `<div id="clearstars">…</div>` (`:88`) add:
     `<div id="clearcx" style="color:var(--dim);font-size:11px;letter-spacing:1px;margin-bottom:6px"></div>`
   - In `levelClear()` after the `clearname` line (`:969`) add:
     `$('clearcx').textContent = lvl.cx ? 'COMPLEXITY '+cxScore(lvl.cx) : '';`
   - Suite: in the L1 clear block (`drive-phasic.cjs:138`) add
     `check('clear screen shows the complexity score', await page.evaluate('document.getElementById("clearcx").textContent') === 'COMPLEXITY ' + (await g('G=>G.complexity()')).score);`
3. **STUCK ghost-replay.**
   - Refactor `runScriptFast` (`:1221-1278`) into a stepwise executor — e.g.
     a generator function `scriptRunner(script)` that yields control after
     every `take(n)` chunk — and keep `runScriptFast` as the synchronous
     drain of that runner. **Invariant: validation behavior is unchanged** —
     same op semantics, same budget (300 s of sim), same abort-on-death; the
     40 generated-content replay checks are the proof.
   - Ghost mode: `stuckSolve` (`:1302-1314`) becomes: reload the level
     (fresh board; clears `fail` too), and if `genCache[lvlIdx]` has a
     script, attach a ghost driver instead of snapping. The driver advances
     the runner by 8 sub-steps per frame from the main loop (`loop()`,
     `:1733-1742`) when not in TEST; under TEST, `__GF.step(s)` advances the
     ghost with the same sub-step budget before its own `sub()` calls, so the
     suite drives it deterministically. Input (`onDown`) and the STUCK button
     are inert while the ghost runs; `#hintbar` shows `SOLVING…`; do NOT set
     `solving` (the ghost is a show — SFX and fx should play); on completion
     mark the win through the normal `updateHome`/`levelClear` path.
   - No-script fallback (authored levels, salt-99): staggered fly-home — for
     each gem in sequence (~0.3 s apart) restore latched sources to buckets
     as today (`:1307-1308`), set the gem `freezing` onto its socket cells
     via the existing `ftarg`/`freezeStep` animation, then `updateHome`.
   - Suite: replace the two STUCK checks (`:497-501`) with: load 65,
     `stuck()`, then loop `step(1)` (cap 60 s sim) until `game === 'clear'`;
     assert `save().done[65]`; assert NOT instant (immediately after
     `stuck()` + one `step(0.1)`, `game` is still `'play'`). Add the
     fallback check: load 1 (authored, no script), `stuck()`, same loop,
     same not-instant assert.
4. **Docs + badge.** `.claude/phasic.md`: STUCK paragraph (`:151`) gains the
   ghost-replay behavior + fallback; note "frost bucket first appears at
   L25" in the base-states bullet; fix the stale `checkSocket` name at `:65`
   to `updateHome`. Update the `#build-badge` in `games/phasic/index.html`
   to the current `date -u '+%Y-%m-%d %H:%M UTC'` as the last edit before the
   final commit, and state the string in the report.

## Gotchas / bindings

- `?test=1` freezes the rAF sim (`loop()` skips `stepSim`) but still runs
  `updateHome` every frame — the ghost driver must NOT depend on rAF for sim
  advancement or the suite hangs; route all sim stepping through the runner.
- `solving` gates SFX (`tone`/`noise` early-return), toasts, rejects, and
  the fail overlay. Validation runs must keep setting it; the ghost must not.
- Scripts in `genCache` are built lazily by `getLevel` on the player's own
  device — after task 1's generator edit they regenerate identically
  (deterministic seeded rng + seeded `p.wp` gas wander). Do not persist
  scripts across the edit; there is nothing to migrate.
- The freeze animation takes 0.5 s (`freezeStep` `:846-863`); suite
  assertions after any freeze must `step(0.9)` first (the `ensureHome`
  pattern, `drive-phasic.cjs:102-106`).
- `killGem` during a ghost would strand it — scripts are validated
  death-free, but the fallback path (decision default) must exist and end in
  a recorded clear either way.
- Commit hygiene: explicit pathspecs, never `git add -A`; Conventional
  Commits, scope `phasic`.
- Chromium for the gates: `/opt/pw-browsers/chromium`; `npm install
  playwright-core` in the session scratchpad and run the suite with
  `NODE_PATH` pointing at it.

## Validation

Full drive suite green after every task (final line
`PHASIC DRIVE: N passed, 0 failed`), smoke gate green on
`games/phasic/index.html` at the end, no console errors (the suite asserts
this). Games-sync gate not triggered (no catalog change). Manual playtest
per the Playtest bullet.

## Follow-ups

None known at draft time. Discovered residue → `phaspolish.follow-up.md`
per the oversee wrap-up.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phaspolish.stuck-ghost-frost-strip-clear-cx.md
```
