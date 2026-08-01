# phasdaily — follow-up (oversee run 2026-08-01)

## Decisions made on your behalf — review

- Preflight scope corrections applied before any implementer spawned (design
  unchanged, spec tightened): `ghostHint()` (:2079) is a **third** `L<n>`
  display site the plan didn't list — the DAILY label applies there too
  (mirrors the phasnames preflight addition). `buildLvlSel()` runs on every
  `loadLevel` (:527), so the option-count guard must hold at daily **load**
  time, not just at clear — implemented as an early return in `buildLvlSel`
  while in daily mode. retry/reload/replay/STUCK **preserve** daily mode
  (they reload `lvlIdx`; clearing it there would re-arm the `save.done`
  poison-trap on a retried daily).
- DAILY button ✓ label lives in `updateDailyBtn()`, refreshed at boot and on
  the NEXT-from-daily menu return.
- The NEXT-from-daily branch deliberately does **not** rebuild the level
  list (`lvlIdx` still holds the ~100k daily index at that moment); the next
  normal load path rebuilds it.
- Tier note (no metrics ledger in this repo): all three tasks first-pass
  green, zero warm retries, zero escalations — sonnet-high / sonnet-medium /
  haiku-low as drafted.

## Deferred / discovered follow-ups

- Share-code duel (signal-hunt's checksummed-code pattern) — CD-triggered,
  per the plan's Follow-ups.
- Daily streak counter — trivial once `save.daily` accumulates dates.
