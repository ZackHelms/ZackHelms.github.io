# phasweave — follow-up (run of 2026-07-31)

## Blocked — needs you

- (none)

## Decisions made on your behalf — review

- **Two-shelf socket packing reordered** (task 1): the plan's geometry made
  only 19% of two-shelf candidates solvable and dropped three sub-65
  indices into the rescue band. Traced to two irreconcilable orderings
  (scatter wants nearest-gap-first, shelf wants farthest-first). Two-shelf
  boards now scatter first, then deal sockets outside-in from each gap;
  drawer boards keep the original left-to-right packing (bit-identical,
  proven by a 1105-candidate byte-diff). Solve rate 42%, no rescue
  fallthrough.
- **Woven-candidate preference** (task 2): in blocks 5–7 `getLevel` prefers
  the first *woven* candidate that solves over a plain one from an earlier
  salt — otherwise plain layouts always won the salt race and hazards
  stayed decorative. Weave odds ramp within each block (0.2 + 0.12·p), so
  hazards lean toward the block's later levels, keeping the ramp truthful.
- **Docked-well script op** (task 2): the `{g:[]}` (empty-args) form of the
  existing well op docks the well, used by fan-lane routes. Understood by
  the shared `scriptRunner`, so the STUCK ghost plays it natively.
- **Scatter re-lay for column hazards** (task 2): a hedge/fan that must own
  a whole column may lift the scatter, place the hazard, and re-lay the
  gems around it — same seeded stream, reverted wholesale if the layout
  fails, so determinism holds.
- Serving below 65 skews two-shelf (21 of 41 generated indices) because
  two-shelf wins more salt lotteries than the drawer despite 40% pick
  odds. **CD knob:** if you want more drawer variety, tune the pick odds
  (`buildGen`, template draw) — not the routing.

## Deferred / discovered follow-ups

- Weave patterns for the attic template (currently attic boards never
  weave; the flue route is its own puzzle already — revisit after CD
  playtest of blocks 5–7).
- The queued orb-mandatory gravity-block redesign (TODO.md ## Next) should
  reuse `mapInfo()` and the weave machinery for its maze levels — note for
  its plan-gen.
