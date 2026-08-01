# phasacro — the Acrobatics block: a 9th curriculum block built on launch-and-freeze

**Status:** DRAFT
**Requested:** 2026-08-01 (Later item; CD interview 2026-08-01: "Draft it —
I'll audition" — the tutorial ships as a proposal, the CD auditions it like
phasgrav's Side Pocket).
**Scope:** `games/phasic/index.html` (curriculum boundary, save migration,
tutorial def, generator factor, solver legs), `.claude/tests/drive-phasic.cjs`,
`.claude/phasic.md`.

> Anchors verified at `a825c0d`; re-locate by symbol — this is the biggest
> structural plan since the curriculum itself, run it AFTER phasdaily/
> phasmazes: `tryFreeze` :882 (rest gate :893-895, `jcap=rest?…:1.9` :898),
> `blockOf` :1233, `BLOCK_WORD` :1234 (8 entries), `lvlName` :1235,
> `songStart(i<64?blockOf(i):i%10)` :528, `buildLvlSel` `N=Math.max(64,…)`
> :2573, `buildGen` :1332 (`b=easy?0:blockOf(i)`, `extra=i>=64?…`, factor
> flags `useFlames=b>=1 … useFan=b>=7`), `AUTH` :438-441 (keys ≤57), save
> :454-456 (`phasic_v1`, `save.done` truthy array), `makeScript` :1706,
> `getLevel` :2034.

## Goal

A new block 8 "Launch" (levels 65–72, indices 64–71) slots in before the
endless tail: its levels have **no gravity orb and no other facilitating
tools** — obstacles are arranged so the ONLY way home is the launch-and-freeze
tactic (shove a settled puddle airborne with a solid, frost it mid-flight).
One authored tutorial opens the block (CD auditions it), generated boards
fill the rest, the solver can execute the tactic, existing saves migrate
cleanly, and endless (now 73+) still mixes every factor including the well.

## Context

Launch-and-freeze emerged as a player workaround on L29 during the
freeze-refusal era; phasfreeze fixed the bug and the CD ruled the tactic must
never be REQUIRED in earlier blocks — but liked it enough to want a dedicated
block. Mechanically it still works post-phasfreeze: `tryFreeze` does not
refuse a non-resting puddle, it only tightens the jump cap to 1.9
(`index.html:898`) — verified in code this session; task 1 proves it in the
harness before anything is built on it.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Harness proof: scripted launch-and-freeze lands a puddle in a raised socket | tests | sonnet | high | physics scripting; escalation path below |
| 2 | Boundary machinery: `CURRICULUM_END`, blockOf cap, BLOCK_WORD, save migration | mechanical-edit | sonnet | medium | enumerated sites below |
| 3 | Authored tutorial `NEWL.launch` at index 64 + both-directions proofs | cross-system | opus | high | level design vs measured constraints |
| 4 | Generator block-8 factor + solver launch legs | cross-system | fable | high | novel solver op + constrained generation — the hard task |
| 5 | Suite boundary updates + block-8 coverage + docs + badge | tests | sonnet | medium | enumerated boundary-check list below |

- **Ordering:** 1 → 2 → 3 → 4 → 5 strictly; task 1 is a spike (no game-file
  commit) whose script seeds task 3's proofs and task 4's solver leg.
- **Files owned:** 1: a scratch drive script (suite-side, may commit as a
  disabled helper); 2–4: `games/phasic/index.html`; 5: the suite +
  `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green each task (task 2 will
  legitimately update boundary-dependent checks — see task 5 split below:
  ONLY the minimal expectation edits ride task 2; new coverage waits for 5);
  final smoke.
- **Tier audit:** task 2 passes the mechanical checklist with the enumerated
  site list → sonnet-medium (not haiku: the save migration has a
  data-loss failure mode); tasks 3–4 are design-tier by the rubric
  (authored-content judgment / novel algorithm + solver coupling); task 1
  fails haiku 1+4 (physics timing) → sonnet-high; task 5 enumerated →
  sonnet-medium.
- **Decision defaults:**
  - **Constants:** `const CURRICULUM_END=72;` beside `blockOf`;
    `blockOf(i){ return Math.min((i/8)|0, 8); }`; `BLOCK_WORD` gains
    `'Launch'` (9 entries). Literal-64 swap sites (all verified):
    `lvlName`'s `i<64` → `i<CURRICULUM_END` (:1236), `loadLevel`'s
    `songStart(i<64?…)` → `i<CURRICULUM_END` (:528 — block 8 takes song 8;
    endless keeps `i%10`), `buildLvlSel` `N=Math.max(64,…)` →
    `Math.max(CURRICULUM_END,…)` (:2573), `buildGen`'s
    `extra=i>=64?Math.min(3,((i-64)/16)|0):0` → both 64s become
    `CURRICULUM_END` (:1335 region). Grep for any other literal 64 near
    level-index logic before calling task 2 done.
  - **Block-8 factor shape:** in `buildGen`, block 8 curriculum boards
    (`b===8 && i<CURRICULUM_END`) set `useGrav=false` and grant no frost
    surplus beyond the launch budget — the orb-less board is what makes the
    tactic mandatory. **Endless (`i>=CURRICULUM_END`) keeps ALL factors
    including the well** — after the cap change `blockOf(endless)===8`, so
    the no-orb rule must key on the index range, never on `b` alone (the
    single easiest way to ship a regression here).
  - **Save migration:** on load, once:
    `if(!save.acroV&&Array.isArray(save.done)&&save.done.length>64){
    save.done.splice(64,0,undefined,undefined,undefined,undefined,undefined,
    undefined,undefined,undefined); } save.acroV=1;` (endless completion
    marks shift up by 8; curriculum marks 0–63 untouched; shorter arrays
    need no splice but still set the flag). Persist after.
  - **Tutorial (task 3, the CD-audition artifact):** one puddle-to-be (a
    2-cell gem + one flame), one frost, one loose solid, a raised alcove
    socket with an overhang such that (a) the pour cannot reach it (no orb),
    (b) a settle-then-freeze anywhere below cannot bridge in (socket row
    beyond the 2.35 socket snap from any freezable cell — measure with
    `tryFreeze`'s dry mode), (c) the scripted shove+mid-flight-frost from
    task 1 lands it. Name/hint drafted by the implementer, flagged in the
    report for the CD. Negatives proven like phasgrav: drag-as-stone
    impossible, BFS pour-unreachable, no-freeze-bridge.
  - **Solver (task 4):** teach `makeScript` a launch leg — a scripted
    fast-drag of the loose solid into the settled puddle followed by a
    frost drop timed to the flight window (the executor is
    fixed-substep-deterministic, so the timing is reproducible). Generated
    block-8 boards must only be served when their stored script clears them
    (`getLevel`'s existing loop is the gate — do not weaken it). If solver
    yield is near-zero, generation may constrain layouts (launch lane
    geometry) rather than loosening physics.
  - **Complexity:** count a required launch as 2 into the `flames` term of
    `cx` (shove+frost ≈ two applications) rather than adding a new term —
    keeps `cxScore` and its suite ramp asserts untouched.
- **Embedded-content QA:** the `jcap` non-refusal fact, every literal-64
  site, the AUTH key range, and the save shape were read from live code
  this session. The splice count (8) = one block of 8 by construction.
  Suite-total invariants are stated per task, never as literals.
- **Escalation triggers:** task 1 cannot reproduce the tactic after 3
  scripted attempts → escalate the task to fable; still failing → HALT the
  run and report (the block's premise would be broken — a CD conversation,
  not a workaround). Task 4 solver yield < ~1 in 5 candidate salts on
  block-8 indices → report before shipping, don't silently rescue-template
  the whole block.
- **Playtest:** CD: play the tutorial (L65) cold — does the launch read as
  discoverable? Then 2–3 generated block-8 levels; verdict on the block
  word 'Launch' and the tutorial's name.
- **Publish:** default — player-facing; push main, Pages verified, badge
  stated.
- **Commit strategy:** one conventional commit per task (task 1's spike may
  fold into task 5's suite commit), scope `phasic`.

## Steps

1. Prove the tactic in the drive harness: settle a puddle, scripted
   fast-drag a solid into it, drop frost mid-flight, assert a freeze commits
   off the ground. Record the working timings.
2. `CURRICULUM_END` + cap + word + the four verified literal-64 swaps +
   save migration + minimal existing-check expectation edits (endless
   boundary 64→72 in the phasnames endless check; the `load(69)` now-playing
   probe moves to an index ≥ `CURRICULUM_END` with the same `%10` digit —
   e.g. 79).
3. `NEWL.launch` + `AUTH[64]` + the three negatives + the tactic proof as a
   positive.
4. Block-8 generation (orb-less, launch-mandatory layouts) + `makeScript`
   launch leg; served boards all script-cleared.
5. Suite: extend the phasnames per-block scan to 9 blocks/`CURRICULUM_END`
   options, block-8 song check ('09 · ' on a block-8 level), migration
   check (seed a pre-migration save via TEST, assert marks shifted),
   generated-block-8 replay coverage; `.claude/phasic.md` curriculum table
   gains the block-8 row + § Launch block notes; badge bump.

## Gotchas / bindings

- **The endless-keeps-grav trap** (decision defaults): `blockOf` caps at 8
  after this plan, so any `b===8` check now also matches endless — every
  block-8-only rule must ALSO test `i<CURRICULUM_END`.
- **Existing suite checks that hardcode the old boundary** (verified list):
  the phasnames endless-unprefixed check iterates `idx>=64`; the phaschrome
  `load(69)` now-playing check expects `'10 · '`; the phasnames curriculum
  scan covers blocks 0–7. Task 2 edits ONLY expectations that the boundary
  move invalidates; task 5 adds the new coverage. Anything else red is a
  real regression.
- **Save migration is one-way** — gate on the flag, never re-splice; a
  `save.done` shorter than 65 must not grow.
- `tryFreeze`'s airborne jump cap is 1.9 cells — launches must be low arcs;
  socket snap (2.35) applies only when the socket is a candidate, which
  needs the anchor within 2.3 of it — task 1's measured timings are the
  ground truth for what geometry is fair.
- The wiki's 12-tactic registry (`.claude/phasic.md`) already documents
  launch-and-freeze as a tactic — task 5 updates its entry to name the
  block; wiki.html regenerating is NOT in scope (its registry text is
  maintained in phasic.md; only sync if the wiki file embeds the same list —
  check before editing).
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after each task; smoke green at the end. The block-8
generated levels pass the existing replay gate; the migration check and the
three tutorial negatives are the proof load.

## Follow-ups

- Endless weighting for launch boards (once the CD has played the block).
- The tutorial's final name/hint — CD audition may rename (one-line edits).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasacro.acrobatics-block.md
```
