# phasgrav — the gravity block (L17–24) requires the orb: anti-shove tutorials + walls-only orb-maze generation

**Status:** DRAFT
**Requested:** 2026-07-31 (CD, verbatim intent: "the 8 levels that
introduce the gravity orb should require the gravity orb to be used.
Currently I am able to use another object to push the liquid or gas object
where i need it to go." Opener "like the old level 10 with one object & a
grav orb and a flame"; then maze-like levels; complexity ramps. CD
decision same day: block-2 mazes are **walls-only** — bushes/fans/voids
keep their block 5–7 debuts and join gravity mazes only there).
**Scope:** `games/phasic/index.html` (block-2 authored defs, generator,
`makeScript`), `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at `2279838`; re-locate by symbol. `AUTH` at
> `index.html:404` (block 2 = indices 16–22 authored: `LEVELS[6..10]`
> Sideways/Point Pull/Spring Cleaning/Kettle/Balloon Route +
> `LEVELS[13..14]` Reflow/Master Facet; index 23 generated), `buildGen`
> at `:1103` (`useGrav=b>=2` at `:1108`), `makeScript` at `:1473`,
> Room to Pour (the "old level 10" model) = `LEVELS[3]`.

## Goal

Every level in the gravity block genuinely needs the orb: a new simple
opener (one gem + one flame + the orb, orb-mandatory), authored maps
hardened so the push-the-puddle shove cannot substitute for the orb, and
block-2 generated levels become **walls-only orb-mazes** (serpentine wall
geometry the pour is pulled/pushed through by moving the well). Suite
negatives pin the anti-shove property per tutorial.

## Context

The CD solved gravity levels by shoving liquid with solids (now tactic
#10) — legitimate elsewhere, but it lets players skip the block's lesson.
Anti-shove is achieved by GEOMETRY (routes only liquid can travel, socket
pockets beyond shove reach, no spare solids adjacent), never by disabling
the shove mechanic (tactics #10–12 stay legal game-wide). "Requires the
orb" is enforced by design + suite negatives, not a runtime gate.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | New block opener (index 16) — one gem, one flame, the orb | level design + code | opus | high | tutorial authoring against a fairness property |
| 2 | Anti-shove hardening of authored 17–22 | level design + code | opus | high | seven maps, each preserving its taught idea |
| 3 | Walls-only orb-maze template for block-2 generation | invariant-bearing code | opus | high | generator/solver contract work (reuse phasweave machinery) |
| 4 | Suite: anti-cheese negatives + maze coverage/replays + updated block-2 solutions | tests | sonnet | high | per-map negative design |
| 5 | Docs + badge | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 → 4 → 5 sequential.
- **Files owned:** 1–3: `games/phasic/index.html`; 4: the suite;
  5: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green after every task —
  note tasks 1–2 CHANGE authored maps, so the existing block-2 scripted
  solutions in the suite must be updated in the same task that changes
  the map (a task is not done red).
- **Tier audit:** 1–3 fail haiku item 4 outright; 4 fails item 4;
  5 passes.
- **Decision defaults:**
  - Opener (task 1): new `NEWL.gravity` def at index 16, modeled on Room
    to Pour's shape: one 2x2 gem, `heat:1, cold:0, grav:1`; the socket in
    a mid-height side pocket behind a 1-wide slot that no solid fits
    through and plain-down drainage cannot reach — melt, drag the well to
    pull the pour sideways/up into the pocket, tap. Name it
    `'Sideways Falls'`-class (implementer's choice, Title Case; the
    naming plan will prefix it later). Current `Sideways` (LEVELS[6])
    moves to index 17, displacing `Point Pull` etc. one slot right;
    `Master Facet` (old index 22) becomes the block finale at 22 by
    DROPPING one authored slot to generated — default: `Spring Cleaning`
    (old 18) leaves the block (it is mostly a drag level — weakest orb
    lesson; it returns to the legacy LEVELS pool unused). Update `AUTH`
    accordingly; total authored count changes 24→24 (one added, one
    removed) — keep `__GF.authored` and its suite check truthful.
  - Anti-shove passes (task 2): per map, ensure the orb-dependent leg is
    unreachable by shoving: 1-wide liquid channels bordered by wall
    (solids can't enter), socket pockets ≥2 cells beyond any position a
    solid can occupy, and no spare 1x1 gems unless the map's lesson needs
    one. Preserve each level's taught idea (Point Pull = point vs
    direction, Kettle = two-flame gas herding, Balloon Route = gas
    pocket, Reflow = the lift, Master Facet = everything). If a map
    cannot be hardened without losing its lesson, log it to the follow-up
    file and leave that map unchanged — report it; do not force.
  - Orb-maze template (task 3): `'gravmaze'` in the template registry
    (drawn like the others, block-2-only for now, ~60% odds so the block
    feels distinct; blocks 5+ keep their existing templates/weaves —
    obstacle-era gravmazes are a FOLLOW-UP, not this plan, per the CD's
    walls-only decision). Geometry: serpentine 1-wide liquid channel
    through 2–3 wall baffles between the melt point and a pocketed
    socket; solids' own sockets reachable by plain drag; the script
    solves with `{g:}` waypoint sequences moving the well around the ring
    (the phasweave `scriptRunner` op vocabulary suffices — no new ops
    expected). Determinism rails identical to phasweave (seeded draws in
    fixed order; the byte-diff proof technique from
    `.claude/notes/20260731-phasic-softbody-solver-validated-generation.md`
    § Template lessons applies — drawer/two-shelf/attic candidates must
    reproduce exactly when gravmaze isn't drawn).
  - Suite (task 4): per redesigned tutorial, ONE anti-cheese negative —
    script the shove attempt the CD reported (drag the available solid
    into the puddle toward the socket) and assert the puddle does NOT
    reach home that way (bounded steps), then the orb solution passes.
    For gravmaze: template coverage below 65 in block 2, replays green,
    and a negative asserting the maze channel is solid-impassable
    (`solidFits` false along it — via `mapInfo` geometry).
  - `cx` accounting: gravmaze levels carry `grav:1` (they do — `useGrav`);
    complexity ramp asserts must stay green — if the maze lifts block-2
    scores above block 3, that is acceptable ONLY if the envelope checks
    still pass; otherwise tune gem counts, not the formula.
- **Embedded-content QA:** no verbatim maps in this plan on purpose —
  map authoring happens at run time under the constraints above, and the
  overseer reviews each map against its listed lesson before the commit.
  The AUTH index arithmetic (24 authored before and after) must be
  re-verified in task 1's report.
- **Escalation triggers:** a hardened map that breaks its own tutorial
  teachability; the complexity envelope refusing to balance after two
  tuning rounds. Otherwise autonomous.
- **Playtest:** the CD plays L17–24 start to finish — every level should
  force the orb into their hand; the shove should feel visibly futile
  where they used it before. **Design-content audition — emphasized in
  the report.**
- **Publish:** default — push `main`, Pages verified, badge stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. `NEWL.gravity` opener + AUTH reshuffle + suite solution updates for
   the shifted indices; authored count stays 24.
2. Anti-shove passes on the six remaining authored maps (17–22), suite
   solutions updated alongside each map.
3. `'gravmaze'` template + script routing + determinism proof.
4. Anti-cheese negatives + gravmaze coverage/replays; full suite twice,
   same count.
5. Docs: `.claude/phasic.md` curriculum table block-2 row + a "gravity
   block is orb-mandatory" design note; badge stated.

## Gotchas / bindings

- Changing authored maps invalidates the suite's hand-verified drag
  orders — every map edit re-verifies its solution against socket
  markings (the Whole-Spectrum deadlock lesson, solver-gen note).
- `save.done` indices shift meaning when AUTH moves levels — acceptable
  (the CD is the only player), but say so in the report.
- The gas guidance field and freeze search treat walls as walls — 1-wide
  channels must still leave freeze room at the socket pocket (footprint
  + the phasfreeze outcomes if that plan lands first; re-check its
  merged behavior at preflight).
- Sequencing: draft assumed `phasfreeze`/`phaschrome` may land first —
  expect line drift; re-locate by symbol at preflight.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after every task (anti-cheese negatives + replays
+ ramp asserts); smoke green at the end.

## Follow-ups

Obstacle-era gravmazes (blocks 5+ with bushes/fans/voids woven into orb
mazes) — explicitly deferred by the CD's walls-only decision; revisit
after the block-2 playtest verdict.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasgrav.orb-mandatory-gravity-block.md
```
