# phasmazes — follow-up (oversee run 2026-08-01)

## Decisions made on your behalf — review

- **The plan's odds default was replaced, on a measured finding.** The plan
  said `b>=5 && tr<0.15` per salt; shipped is an **index-seeded** eligibility
  draw (`mzIdx = b>=5 && mulberry(hash(i))()<0.20`, then `tr<0.60`). Reason,
  measured before shipping: `getLevel`'s wanted-scan hunts wanted templates
  across all 20 salts, so per-salt odds compound — at 0.15/salt, 22 of 25
  obstacle-era indices shipped mazes and every block-6/7 weave was crowded
  out, the opposite of the plan's own "highlight, not the norm" goal. Rarity
  has to live on the index. `getLevel` untouched, as the plan demanded;
  effective share ≈0.20–0.25, under the plan's 0.30 ceiling.
- Fan mazes ship the **obstruction role only** (the plan allowed helper OR
  obstruction per board); the beam covers the floor-baffle climb gate and the
  pour crosses as liquid. A helper-fan maze variant remains open design
  space.
- Bush-maze budget: `heat:2, cold:0` — re-condense is the documented
  revert-tap route rather than a granted frost.
- cx for hazard mazes: `obstacles:1, grav:1, flames:2 (bush) / 1 (fan/void)`
  — no ramp assert moved.
- Suite item (a) was formalized as a **pinned SHA-256** of the block-2
  generated-def corpus (`PINNED_BLOCK2_HASH`) plus a block-3 **control pin**
  so harness drift is distinguishable from a real block-2 change. Re-pin
  rule (also in `.claude/phasic.md`): only a deliberate, CD-approved block-2
  redesign may move the block-2 hash.
- Tier note (no metrics ledger in this repo): fable-high (task 1) first-pass
  at the commit level with heavy internal iteration (bush solver 0/22 →
  100% across three design fixes); sonnet-high and haiku-low first-pass
  clean. Final corpus: 84/84 hazard mazes solver-beaten.

## Deferred / discovered follow-ups

- Endless maze-odds weighting (plan's own follow-up) — revisit after the CD
  plays the hazard mazes.
- A helper-role fan maze (vapor carried along the tunnel axis) — designed
  but not shipped; only worth building if the obstruction fan reads well.
