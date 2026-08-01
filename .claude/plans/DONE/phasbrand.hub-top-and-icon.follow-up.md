# phasbrand — follow-up (2026-08-01 run)

## Blocked — needs you

- (none)

## Decisions made on your behalf — review

- **Plan's `<img>`-in-card suggestion overridden (traced, preflight).** The
  games-sync gate parses hub cards with a text-only-icon regex
  (`check-games-sync.cjs:43` — `<div class="game-icon">([^<]+)</div>`, and the
  literal class strings `game-card`/`game-icon` must match exactly), so an
  `<img>` inside the icon div — or even a modifier class on the div — makes
  the PHASIC card invisible to the gate → `GAMES[] entry has no hub card` →
  RED. Shipped shape instead: card markup untouched (`💠` stays the div text,
  satisfying icon-equality + uniqueness), and the SVG renders via a pure-CSS
  rule `.game-card[href="phasic/"] .game-icon { width/height 2.1rem;
  background: url('phasic/icon.svg') center/contain no-repeat; font-size: 0 }`.
  The plan anticipated this ("the gate's green defines done; whatever shape it
  forces").
- **Gate order-insensitivity verified, not assumed** (plan asked): card↔dataset
  ↔games-index pairing is by `href` (`byHref`, `check-games-sync.cjs:84-88`) —
  card order is free; `GAMES[]` and games-index rows left in place.
- **One warm retry on the icon art (spec conformance, not aesthetics):** first
  render's solid band took the bottom ~half, liquid covered the whole top half,
  gas unreadable, and gas puffs muddied the bush crown brown. Retry moved the
  bands to true thirds (solid bottom ⅓, liquid middle ⅓ with wavy edge at the
  ⅓ line, gas top ⅓ mostly transparent) and re-toned the puffs to the hi-ruby
  family. Aesthetics beyond band geometry were deliberately NOT iterated — the
  plan reserves that for the CD audition.
- Icon-div sizing: `2.1rem` square (vs the 1.8rem emoji glyph) to compensate
  for the SVG's internal padding — screenshot-checked against neighboring
  cards, not eyeballed from numbers.

## Deferred / discovered follow-ups

- Trademark filing of the logo mark once the CD signs off the art — already
  tracked in the `[phasic·IP]` Needs-Zack items; the 1024 master is the filing
  artifact.
- App Store flattened-icon derivative (opaque background) — belongs to the
  future iOS-port plan, not here; the committed master keeps transparency.
- If the CD wants icon art iteration after audition (bush silhouette, gas
  visibility at favicon size), that's a small standalone round — no plan
  needed, the SVG is a single self-contained file.
