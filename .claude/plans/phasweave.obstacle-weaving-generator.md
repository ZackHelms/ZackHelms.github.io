# phasweave — Phasic obstacle-weaving generator: hazards in the solution path, new templates

**Status:** DRAFT
**Requested:** 2026-07-31 (CD: "next engineering priority after the playtest").
**Scope:** `games/phasic/index.html` (generator/solver only), `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Line references verified against commit `7700f84`; re-locate by symbol.
> **Sequencing:** this plan assumes `phaspolish` has landed (its generator
> `cold:` edit and stepwise script runner both touch the same functions).

## Goal

Generated levels in the obstacle blocks (5–7) and endless stop hiding their
hazards in dead corners: black holes, bushes and fans appear **in the
solution path**, forcing the tactics the tutorials teach — and the solver
still beats every candidate before it is served. Two new board templates
(two-shelf, gas attic) widen the generated space beyond the single-shelf
drawer. Complexity accounting and the ramp assertion stay truthful.

## Context

Today `buildGen` (`index.html:1090-1177`) places obstacles defensively: the
hole under a shelf segment away from the gap and sockets (`:1143-1149`), the
bush as a side-column tuft (`:1140-1142`), the fan on a side column
(`:1138-1139`). A player can usually ignore them. The CD wants generated
levels where the hazard is the puzzle — the void waits under the pour line
until you plug the slot (the Stopper, taught L58), the hedge bisects the
field until you cross as vapor (Overgrowth), the fan lane is the only way
across (Crosswind). "A served level is a solved level" stays the law:
`makeScript` (`:1184-1220`) must plan routes that beat the woven hazard, and
`getLevel`'s salt loop (`:1280-1301`) remains the rejection filter.

## Implementation guidance (for the overseer)

Tiers assigned under the **balanced** profile (no local task-scoping skill;
zmh-producer scaffold rubric).

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Two-shelf + gas-attic templates (`buildGen` + `makeScript` routes) | invariant-bearing code | opus | high | the generator/solver contract is the game's core guarantee; multi-template routing is design-heavy |
| 2 | In-path obstacle weaving (3 patterns) + budget/cx accounting | invariant-bearing code | opus | high | same contract; each pattern needs a matching script strategy |
| 3 | Suite: in-path assertions + template coverage + replay/ramp still green | tests | sonnet | high | needs judgment about what "in-path" is measurable as, but rails are clear |
| 4 | Docs + badge | docs | haiku | low | enumerated edits |

- **Ordering / dependencies:** 1 → 2 → 3 → 4, strictly sequential (same file).
  Parallel-safe: none.
- **Files owned per task:** tasks 1–3: `games/phasic/index.html` +
  `.claude/tests/drive-phasic.cjs`; task 4: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite after each task
  (`PHASIC DRIVE: N passed, 0 failed`); final gate adds
  `node .claude/scripts/smoke-mobile.cjs games/phasic/index.html`.
- **Tier audit (required):** tasks 1–2 fail haiku checklist item 4 outright
  (novel generation design); task 3 fails item 4 (assertion design); task 4
  passes. The mechanical bulk inside 1–2 is inseparable from the judgment
  kernel — no further decomposition pays for itself.
- **Decision defaults:**
  - Template picker: seeded from the existing `mulberry` rng **before** any
    other draw so single-template levels reproduce today's boards when the
    picker chooses 'single-shelf'. Gate: two-shelf availble from block 2 on
    (~40 % odds), attic from block 4 on only when a born-gas gem exists
    (~35 %), else single-shelf. Rescue salts (≥90) always single-shelf, no
    obstacles — unchanged.
  - Two-shelf geometry: shelves at rows 4 and 8, gaps horizontally offset by
    ≥2 columns; sockets bottom-aligned to row 11 as today; the mid-band
    (rows 5–7) is a staging floor. `levelGaps()` (`:1178-1183`) generalizes
    to `levelGaps(row)`.
  - Gas-attic geometry: a ceiling shelf with a flue; the born-gas gem's
    socket sits in the attic (rows 0–3); the script condenses it up there
    exactly as the Balloon Route / Kettle solutions do (well parked far
    side, `{c:}` op, then `{d:}` the short slide).
  - Weave patterns (implement exactly these three, one roll each where the
    block allows): **(a) hole-under-gap + plug** — the hole sits in the
    floor cell directly under the main gap; the generator guarantees a
    1×1-capable plug gem (M) and `makeScript` emits the Stopper sequence
    (drag M into the slot, pour the wide gem across, tap solid, drag M out
    and home); **(b) mid-field bush column** — a bush segment in columns
    3–6 spanning the travel band, generated only when the affected gem has
    flame budget to cross as vapor; script boils, herds/fans across,
    condenses; **(c) fan lane** — a fan whose beam crosses the staging band,
    used by the script as the gas mover (no well needed on that leg).
  - If a woven candidate fails all 20 salts, `getLevel` falls through to the
    rescue band exactly as today — never ship unvalidated; never loosen the
    death-aborts rule to make a level pass.
  - `cx.obstacles` counts woven obstacles identically to placed ones; flame
    budget added for a bush crossing counts in `cx.flames`. Do not touch the
    `cxScore` formula.
  - Generation wall-clock: if the browser-side validation loop for a woven
    index exceeds ~2 s in practice, prefer reducing pattern odds over
    raising the sim budget (`300*120` sub-steps, `:1223`).
- **Embedded-content QA (required):** no verbatim code blocks are embedded
  here by design (interfaces + done-criteria instead); the geometry numbers
  above are design intent, not copied code. Suite counts follow the
  invariant rule (grow by what task 3 adds; 0 failed).
- **Escalation triggers:** a weave pattern that cannot validate at
  acceptable odds after two redesign rounds (report it as a follow-up rather
  than forcing it); any temptation to edit authored tutorial maps.
- **Playtest:** yes — CD should play 2–3 generated levels in blocks 5–7
  (L42+, L50+, L59+) and one endless (L66+): the hazard should be in the
  way, and the taught tactic should be the answer.
- **Publish:** default — push `main`, verify Pages `success`, badge updated
  and stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. Template registry inside `buildGen`: extract today's single-shelf body as
   template 'drawer'; add 'two-shelf' and 'attic' builders returning the
   same `{rows, gems, wg, gx, …}` intermediate; `makeScript` branches on a
   `template` field carried in the def (script planning per template:
   drawer = today's routes; two-shelf = route through both gaps
   sequentially; attic = the condense-up-top sequence). Done when: GEN_IDX
   replays all green AND at least one two-shelf and one attic index below 65
   exist (log which in the task report).
2. Weave patterns (a)–(c) per the decision defaults, including the
   guarantees (plug gem present for (a), flame budget for (b)), placement in
   the def's `cx`, and the matching `makeScript` strategies. Done when: the
   suite's new in-path assertions (task 3) can find woven indices below 65
   in every obstacle block.
3. Suite additions: a TEST-only `__GF.mapInfo()` (returns obstacle cells,
   gap columns per shelf row, template name); for each obstacle block 5–7
   assert ≥1 generated index below 65 whose hazard is in-path ((a) hole
   column ∈ gap columns; (b) bush in columns 1–8; (c) fan beam intersects
   the staging band); assert every GEN_IDX replay still wins; assert the
   complexity envelope check still passes; add 2 endless spot checks in the
   80s–120s range.
4. Docs: rewrite `.claude/phasic.md` "Generator + endless + STUCK"
   (`:140-153`) for templates + weaving (keep it under ~25 lines); badge
   timestamp; state it in the report.

## Gotchas / bindings

- **Determinism is sacred**: every random draw goes through the seeded
  `mulberry` stream, in a fixed order; `p.wp` gas wander stays seeded
  (`setupLevel` `:469`). Any `Math.random()` in generation breaks
  cross-device identity and the replay gate.
- Drawing extra rng values changes every downstream draw for that
  index+salt — that is *allowed* (levels may differ from today's), but it
  regenerates `genCache` scripts wholesale; the suite replay gate is the
  proof it still all works. Never reuse a stale cached script across this
  change.
- `makeScript`'s `{c:}` op retries + well-nudge fallback (`:1248-1257`) and
  the `{u:}` wait-until op are the existing vocabulary — prefer composing
  them over inventing new ops; if a new op is unavoidable (e.g. timed
  unplug), `runScriptFast`/the stepwise runner and the ghost driver (from
  phaspolish) must all understand it.
- Bushes absorb LIQUID on contact (`sub()` `:709-712`) and holes eat
  anything overlapping (`:699-722`) — script routes must respect kill radii
  (hole pull 1.5 cells / kill 0.45, solid overlap 0.55).
- Fans are solid to stone and liquid (`solidBlockAt` `:562-567`) — a fan in
  the staging band is also a drag obstruction; two-shelf routing must path
  around it.
- The freeze placement search treats hole/bush/fan cells as occupied
  (`occupiedCells` `:783-795`) — sockets must keep ≥ the gem footprint clear
  of woven obstacles or the level is unwinnable by construction.
- Suite runtime: each woven index re-validates in-browser on `load()`;
  keep total added suite indices modest (~6–10) so the suite stays under a
  few minutes.
- Commit hygiene: explicit pathspecs, no `git add -A`.

## Validation

Full drive suite green after every task; smoke gate green at the end; no
console errors. The generated-content replay gate + the new in-path
assertions are the acceptance test. Manual playtest per Playtest bullet.

## Follow-ups

Likely residue: weave patterns for future mechanic blocks (the CD adds
blocks over time); a difficulty dial on weave odds. Record in
`phasweave.follow-up.md` as discovered.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasweave.obstacle-weaving-generator.md
```
