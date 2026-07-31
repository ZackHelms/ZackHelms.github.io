# phasfreeze — trace and fix the freeze-refusal fairness bug (frost refused with visible clearance)

**Status:** DRAFT
**Requested:** 2026-07-31 (CD screenshots: L27 Spare Gallery P/I4 on the upper shelf, L29 Split Foundry C/T5 on the floor — "No room to crystallize here" despite plenty of room; the CD's launch-and-freeze move was a workaround for this).
**Scope:** `games/phasic/index.html` (freeze placement search + possibly puddle cohesion), `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at commit `2279838`; re-locate by symbol. `tryFreeze`
> at `index.html:799` (candidate radius `d>1.7` at `:811`, per-particle
> jump caps `cd.sock?2.35:1.9` at `:835`), `freezeDry` verb at `:2318`.

## Goal

A settled puddle with genuine room for its footprint freezes on the first
frost. The traced root cause is documented; the fix is bounded so the
mid-air-freeze exploit and the legitimate no-room refusals stay dead; suite
regression checks pin the fixed cases.

## Context

Fairness-critical: in block 3+ frost is the only tool, and a refusal on a
fair board strands the level. The standing hypothesis (UNTRACED — verify
first, per house diagnosis discipline): a spread puddle's outer particles
exceed the 1.9-cell jump cap for tall/wide footprints (T5 needs 3x3; a
5-wide pancake's corners jump >2 cells). The cohesion system
(`.claude/notes/20260731-phasic-softbody-solver-validated-generation.md`)
exists precisely because spread puddles defeat freeze reach — this may be
the same disease at larger footprints.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile (no local task-scoping skill; plugin
scaffold rubric).

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Reproduce + trace (no fix yet) | debugging | opus | high | root-causing a physics/search interaction; the trace gates everything |
| 2 | Fix per trace, bounded options | invariant-bearing code | opus | high | the freeze search guards the game's central fairness invariant |
| 3 | Suite: spread-freeze regressions + existing negatives stay green | tests | sonnet | high | assertion design on physics timing |
| 4 | Docs + badge | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 → 4 sequential. Task 1's TRACED cause must be
  stated in its report before task 2 spawns — the overseer reviews it.
- **Files owned:** 1: probe scripts in the session scratchpad only (no
  repo edits); 2: `games/phasic/index.html`; 3: `.claude/tests/drive-phasic.cjs`;
  4: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green
  (`NODE_PATH=<scratchpad>/node_modules node .claude/tests/drive-phasic.cjs`);
  final gate adds `node .claude/scripts/smoke-mobile.cjs games/phasic/index.html`.
- **Tier audit:** tasks 1–2 fail haiku checklist item 4 outright; task 3
  fails item 4; task 4 passes.
- **Decision defaults:**
  - Task 1 repro: `?test=1`, load index 26 (L27) and 28 (L29) — generated
    defs are deterministic — melt/settle the reported gem until it rests
    (4+ s), then read `__GF.freezeDry(L)`'s candidate list: for each
    candidate, whether cells failed or the jump cap failed, and at what
    distance. That distinguishes the hypothesis (jump cap) from occupancy.
  - Task 2 remedies, preferred in order, chosen by what the trace shows:
    (i) **pre-freeze gather** — when frost/tap lands on a *resting* puddle,
    run a short strong cohesion pull toward the chosen anchor before the
    final placement commit (reads as the puddle drawing together; no
    teleport); (ii) **footprint-scaled caps** — widen candidate radius /
    jump cap as a function of footprint size only for RESTING puddles
    (velocity below a threshold), so mid-air chains still refuse;
    (iii) **extremal anchors** — seed the candidate search from extremal
    particles, not only the centroid.
  - HARD invariants, whatever the fix: the mid-air freeze exploit stays
    dead (existing suite negatives); Room to Pour's 1-tall-shelf refusal
    stays a refusal; the 2.35 socket snap stays; no particle teleports
    (>2.6 cells instantaneous) outside the existing freeze animation.
  - If the trace shows the refusals were CORRECT (genuinely occupied
    cells), pivot: the fix is generator-side (guarantee freeze room near
    sockets for large footprints) — same plan, task 2 re-scoped, say so
    in the report.
- **Embedded-content QA:** no verbatim code embedded; numeric caps cited
  above were re-read from the tree this session.
- **Escalation triggers:** a trace that implicates the PBD solver itself
  (not the search) — stop and report before touching particle physics.
- **Playtest:** L27 and L29 — first frost on the settled puddle should
  take, no launch-and-freeze needed.
- **Publish:** default — push `main`, verify Pages `success`, badge stated.
- **Commit strategy:** one conventional commit per task (task 1 commits
  nothing), scope `phasic`.

## Steps

1. Reproduce both CD cases headlessly; trace via `freezeDry`; report the
   cause with evidence (candidate dumps), no code changes.
2. Implement the bounded fix per the trace; all HARD invariants above
   hold; both repro cases now freeze first-try.
3. Suite: two regression checks (settled I4-on-shelf freezes; settled
   T5-on-floor freezes — build them from the task-1 repro recipes, derive
   indices by scanning `genInfo`/`mapInfo`, don't hardcode); run the full
   suite twice, same count.
4. Docs: `.claude/phasic.md` freeze bullet gains the fix's rule of thumb;
   badge bump stated in the report.

## Gotchas / bindings

- Freeze animation is 0.5 s; suite asserts wait ~0.9 s (`ensureHome`
  pattern). Settling a melt takes 2.5–4 s of sim.
- `solving` must not gate the fix's behavior — validation scripts rely on
  `{c:}`/`{t:}` freezing exactly like play; any resting-velocity threshold
  must hold under `runScriptFast`'s stepping too (the generated-content
  replay gate is the proof).
- Generated defs regenerate deterministically — index 26/28 reproduce the
  CD's boards exactly; do not persist anything.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after tasks 2–4 (twice at task 3); smoke green at
the end; the two new regressions plus every existing freeze negative green
together.

## Follow-ups

If the gather remedy lands, consider surfacing it as visible feedback
(puddle shimmer while gathering) — CD call, not this plan.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasfreeze.freeze-refusal-fairness-fix.md
```
