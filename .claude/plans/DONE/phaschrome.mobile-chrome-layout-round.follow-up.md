# phaschrome — follow-up (oversee run 2026-07-31)

## Blocked — needs you

(none)

## Decisions made on your behalf — review

- **The rotation squish was traced to a degenerate-viewport mechanism, not
  to rotation itself.** A plain portrait↔landscape round trip recovers
  bit-exactly (verified as a negative control). The reproducing sequence
  is any moment the canvas box goes shorter than ~124px: `BZ`'s 80px
  clamp floor drove `CELL` negative, corrupting the pixel-space particle
  state, and the `oldCell>0` guard then silently dropped every later
  rescale — permanent until reload. **Which iOS event sequence delivers
  that degenerate box on device remains an UNTRACED HYPOTHESIS** (iOS
  Safari plausibly reports a transient tiny visual viewport mid-rotation
  with the URL bar/keyboard in play, but that link was not traced). The
  fix pins the invariant instead: CELL floored ≥1, BZ degrades on short
  boxes, strict no-op relayout, post-layout self-check, and layout on
  `resize` + `orientationchange` + `visualViewport.resize` (now + rAF +
  300ms). If the squish EVER recurs on device, that hypothesis needs the
  trace — the `__GF.metrics()` harness is in place for it.
- **Now-playing under mute still names the level's track** — the track is
  a property of the level, not of audibility (matches how the sequencer
  keeps ticking state under mute).
- Screenshot levels: L1 has no buckets (`heat:0,cold:0,grav:0`), so
  bucket screenshots use L26 and the landscape checks scan for the first
  heat+grav+cold level (index 25 region) instead of the plan's literal
  "L1".
- The HOT-bucket grab test gained an upper y-bound **in landscape only**
  (portrait keeps the exact old unbounded test) — in a column, an
  unbounded test would swallow GRAV/COLD taps.
- Song titles shipped as drafted in the plan; the CD renames at will.

## Deferred / discovered follow-ups

- **Landscape board proportions** (from the plan's Follow-ups): the board
  stays portrait-shaped 10×12; a genuinely landscape board layout is a
  design question for the CD, not chrome work.
- **Real-device rotation verification**: the fix is proven against the
  traced mechanism headlessly; the CD's device playtest is the field
  test. The suite's degenerate-box excursion + round-trip checks guard
  regressions either way.
- **Tier observations** (ledger: none configured): all five tasks
  first-pass at plan tiers (opus/sonnet/sonnet/sonnet/haiku), zero warm
  retries, zero escalations. Suite 252→284 across the run.
