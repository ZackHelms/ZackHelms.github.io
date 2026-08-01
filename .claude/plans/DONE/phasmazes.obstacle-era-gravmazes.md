# phasmazes — obstacle-era gravmazes: hazards woven into orb mazes in blocks 5–7

**Status:** IMPLEMENTED 2026-08-01 — commits dbe322b..618cee0, merged to main
**Requested:** 2026-08-01 (Later item un-gated by the CD's block-2 playtest
sign-off, 2026-08-01: "bushes/fans/voids woven into orb mazes in blocks 5+ —
deferred by the CD's walls-only decision; revisit after the block-2 playtest
verdict").
**Scope:** `games/phasic/index.html` (generator + solver only),
`.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at `a825c0d`; re-locate by symbol (phasdaily may land
> first): `buildMaze` :1252, `buildGen` :1332 (template draws :1345-1348 —
> `b===2&&tr<0.60` gravmaze / `b>=2&&tr<0.40` two-shelf / `b>=4&&tr<0.75`
> attic), weave-kinds gate :1678 (`b>=5&&r()<0.2+0.12*p`, newest-idea-first
> fan→bush→plug), `getLevel` :2034 (`scan` gate :2044
> `blockOf(i)>=5||blockOf(i)===2`, `wanted` :2045 already accepts
> `template==='gravmaze'`), `makeScript` :1706, weave legs :1758,
> `WEAVE_SCAN=19` :2033.

## Goal

Generated boards in blocks 5–7 can draw a gravmaze variant whose tunnel
carries the block's own hazard — a bush baffle the pour cannot pass (boil it
to vapor and re-condense beyond), a fan segment that shoves vapor along or
against the route, a void placed to punish a sloppy pour — solver-proven like
every generated level, at odds that keep them a highlight rather than the
norm. The block-2 walls-only gravmaze is byte-identical after this plan.

## Context

phasgrav built the walls-only gravmaze for block 2; phasweave taught blocks
5–7 to weave hazards into shelf/drawer solution paths. This plan is their
intersection, deliberately deferred until the CD signed off the block-2 maze
feel (done 2026-08-01). The maze's closed 3-row tunnel is the most
constrained space in the game — hazard placement rules that are safe on open
boards can seal a tunnel outright, which is why this gets a design-tier task
and hard fairness gates, not a template tweak.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Hazard-maze generator + solver legs | cross-system | fable | high | novel constrained-space design + solver coupling; the one genuinely hard task |
| 2 | Suite: fairness gates + block-2 byte-identity + determinism diff | tests | sonnet | high | proof techniques enumerated but non-trivial to wire |
| 3 | Docs + badge | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 sequential.
- **Files owned:** 1: `games/phasic/index.html`; 2: the suite; 3:
  `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green each task (its existing
  generated-content replay gate re-proves every served level); final smoke.
- **Tier audit:** task 1 is the rubric's "genuinely hard reasoning" row
  (novel algorithm under tight invariants, coupled to the solver) — fable
  high, used deliberately; task 2 fails haiku items 1+4 (proof wiring) →
  sonnet-high; task 3 passes → haiku-low.
- **Decision defaults:**
  - **Template draw:** extend the `buildGen` template pick with a b>=5
    branch (e.g. `else if(b>=5&&tr<0.15) template='gravmaze'`) placed so the
    block-2 draw is untouched. Odds default 0.15 (maze ≈ 1 in 7 obstacle-era
    boards) — tune freely if solver yield is poor, never above 0.30.
  - **One hazard per maze, the block's newest idea first** (fan in block 7,
    bush in 6, void in 5 — mirroring the weave-kinds convention), falling
    back to older kinds only when the newest declines the board.
  - **Hazard semantics in the tunnel** (from `.claude/phasic.md`
    § Obstacles): bush stops stone and drinks liquid but passes vapor → a
    bush baffle forces melt-to-GAS past that segment (the well's guidance
    field herds vapor; re-condense beyond it — this needs a frost or a
    revert-tap with room, so grant the board's budget accordingly); fan
    blows only gas → place it to carry vapor along the tunnel axis (helper)
    or as a gate that must be crossed while liquid (obstruction) — pick ONE
    role per board; void pulls liquid/gas within radius 1.5 → place it in a
    floor recess adjacent to the route where an overshot pour dies but a
    careful one passes — never directly ON the only route.
  - **Sealing rule stays absolute:** the existing baffle invariants (no
    adjacent stubs, 1-cell mouth, no-solid-fits shapes, roofed alcove) bind
    hazard placement too; a hazard may never make the BFS liquid/vapor route
    vanish — extend the candidate's own build-time reject (`return null`)
    rather than relying on the solver to fail it later.
  - **Solver:** extend the maze walk in `makeScript`/the weave-leg helpers
    with the hazard legs (boil-at-bush / re-condense-after, fan-timed vapor
    leg, void-safe pour pacing). The stored script must clear the level —
    `getLevel` only serves solver-beaten candidates, which is the real
    fairness gate; do not weaken that loop.
  - **`getLevel`:** the `wanted` predicate already prefers gravmaze in the
    scan and the scan gate already covers `blockOf(i)>=5` — expect NO edits
    there; if task 1 finds otherwise, that's a finding for the report, not a
    silent change.
  - **Determinism:** all draws for the hazard must come from the candidate's
    own `r` stream AFTER the template draw, so non-maze candidates and
    block-2 mazes consume the identical stream they always did.
- **Embedded-content QA:** the template-draw thresholds, weave gate, scan
  gate and hazard radii quoted above were read from live code/docs this
  session; the 0.15 odds is a NEW knob (a choice, not a derived fact) and is
  marked as such.
- **Escalation triggers:** solver yield collapse (fewer than ~1 in 3 hazard
  mazes solver-beaten across the byte-diff corpus → the design needs a CD
  conversation, not more salt); any change that alters a block-2 board.
- **Playtest:** CD: browse generated levels in blocks 5–7 (the suite's
  genInfo TEST hook lists which indices drew mazes) and play one bush maze
  and one fan maze — verdict on whether the hazard reads as a lesson or a
  gotcha.
- **Publish:** default — player-facing; push main, Pages verified, badge
  stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. Template-draw branch + hazard placement in `buildMaze` (b>=5 only) +
   build-time route rejects + solver legs.
2. Suite: (a) **block-2 byte-identity** — phasgrav's byte-diff technique:
   dump every block-2 candidate def before/after, assert zero diffs;
   (b) determinism — two fresh loads of one hazard-maze index byte-match;
   (c) fairness — for each hazard kind, at least one generated maze exists
   in blocks 5–7's first 2 salts-corpus AND its stored script clears it via
   the replay gate; (d) a BFS negative per kind (bush maze: no liquid-only
   route; fan-gate maze: the gated segment impassable as vapor when the fan
   opposes — mirror the existing SHAPE_STR-based impassability proof);
   (e) void maze: the route BFS avoids the void radius. Never hardcode the
   suite total.
3. `.claude/phasic.md`: extend the gravmaze § with the hazard-maze rules +
   odds knob + the sealing rule; badge bump.

## Gotchas / bindings

- **phasgrav's recorded lessons bind:** a 1-row channel is unsolvable for
  the soft-body pour (0/24) — hazards must live in the 3-row tunnel shape;
  adjacent stubs seal the tunnel; the 1-cell mouth + shape filter is what
  keeps solids out — never widen it.
- The void's pull radius (1.5) reaches through walls — measure placement
  against the ROUTE, not just cell adjacency.
- A bush drinks liquid on contact: a bush baffle with the socket beyond it
  makes plain-down drainage fatal — that's the lesson, but the build-time
  reject must confirm the vapor route exists BEFORE the solver spends salts.
- `WEAVE_SCAN` (19) already bounds the salt hunt for wanted boards in
  blocks 5–7 — do not raise it; if yield needs help, fix placement rules.
- Generated block 5–7 NON-maze boards will shift content wherever the new
  template branch consumes a draw — that is expected and accepted (the
  replay gate re-proves them); block 2 must NOT shift (suite gate 2a).
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after each task; smoke green at the end. The
generated-content replay gate + the new byte-identity and BFS gates are the
proof load — a green pass without 2a–2e is not done.

## Follow-ups

- Obstacle mazes in the endless tail's rotation weighting (endless already
  inherits all factors; consider raising maze odds there if the CD likes
  these).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasmazes.obstacle-era-gravmazes.md
```
