# phasnames — follow-up (oversee run 2026-08-01)

## Decisions made on your behalf — review

- **Fourth display site added.** The plan enumerated three display sites;
  preflight found a fourth — `ghostHint()` rewrites the hint bar with the
  level name after a STUCK ghost replay. It now uses `lvlName` too (plan
  intent: every displayed name carries the block word). If the ghost hint
  should stay unprefixed for some reason, it is a one-line revert.
- **Curriculum-table row labels fixed in passing.** `.claude/phasic.md`'s
  block-2 row listed its authored levels by 0-based index (a phasgrav doc
  quirk) while every other row uses 1-based level numbers; task 3
  normalized it to level numbers (17 The Side Pocket … 23 Master Facet,
  L24 generated).
- **Preflight anchor corrections (cosmetic drift only):** `blockOf` at
  `index.html:1233` (plan said :1102), `buildLvlSel` at :2567 (plan said
  :2234), `loadLevel` hintbar at :525, `clearname` at :1093. No
  load-bearing plan defects.

## Deferred / discovered follow-ups

- **Endless-tail naming word** (plan's own Follow-ups item): endless
  levels (index 64+) show no prefix by design. If the CD wants one, it is
  a one-line change in `lvlName`.
- **Tier-routing candidate note (1 observation, damped — no action):**
  task 2 (suite additions with exact anchors and fully enumerated check
  specs) passed sonnet-medium first-try; a similarly fully-specified suite
  task may be haiku-viable. Revisit only if a second observation lands.
