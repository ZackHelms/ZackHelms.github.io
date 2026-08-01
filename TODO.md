# TODO — ZackHelms.github.io backlog

Buckets in order: In progress · Now · Needs Zack · Next · Later · Icebox.
Done log: `DONE.md`. Created 2026-07-31 scoped to **Phasic** — other work
in this repo is tracked per-game in `.claude/<game>.md` until it earns a
backlog entry here.

## In progress

- (none)

## Now

- (none)

## Needs Zack

- [phasic·IP] USPTO clearance search for "PHASIC" before filing:
  https://www.uspto.gov/trademarks/search — check live + dead marks in
  Class 9 (downloadable game software) and Class 41 (online game
  services; the web version is arguably 41). Also search the Apple App
  Store for "Phasic" directly. Known name-adjacent actors to clear
  against (found 2026-07-31): **Phasic Labs** (UK indie game developer,
  made "Guide The Light"), **phasicfun.com** (web games portal),
  Mattel's **PHASE 10** family (huge mark, different word but same
  aisle). Gameplay mechanics are not trademark territory — the name/
  logo/slogan are.
- [phasic·IP] Decide: self-file via USPTO TEAS ($350/class base fee, +$200/class
  for a custom goods description; ~4.4 months to first action, ~10-18
  months to registration) vs engage an IP attorney (typ. $500-2000 +
  fees — recommended for the clearance opinion given Phasic Labs).
  Decide filing entity (you personally vs an LLC). Consider filing the
  logo mark too once the 2x2-gem icon ships (phasbrand). File
  intent-to-use (1(b)) now if the App Store launch is months out.
- [phasic·IP] US copyright registration of the game (copyright.gov eCO,
  ~$45-65) — protection is automatic without it, but registration
  before/soon after publication unlocks statutory damages + fees in
  infringement suits.
- [phasic·IP] Apple Developer Program enrollment ($99/yr) + reserve the
  app name "Phasic" in App Store Connect as early as possible (name
  reservations are first-come within Apple's rules).
- [phasic·IP] Decision: keep Phasic's source public (today: public repo,
  Pages-served, readable by anyone) vs move Phasic development private /
  ship only built+minified output before the App Store launch — the
  license carve-out forbids copying going forward, but public source
  makes copying trivial to do and hard to notice. Maximum protection =
  private source for the iOS build.

## Next

- [phasic] Dedicated obstacle SFX (void gulp, bush slurp, fan hum) +
  per-block music (songs by curriculum block instead of `level % 10`) —
  merged: both audio-subsystem items. Note: phaschrome names the songs;
  this plan changes which one plays per level — order-independent.
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasaudio.obstacle-sfx-and-block-music.md`
- [phasic] Orb-mandatory gravity block (L17–24): new one-gem opener,
  anti-shove hardening of the authored maps, walls-only orb-maze
  generation. *Decided 2026-07-31: block-2 mazes are walls-only —
  obstacles keep their block 5–7 debuts.*
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasgrav.orb-mandatory-gravity-block.md`
- [phasic] Block-lesson naming: display-layer "Word · Name" prefix for
  blocks 0–7. *Decided 2026-07-31: prefix everything; tutorials keep
  their names; endless unprefixed.* Run LAST (after phasgrav renames).
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasnames.block-lesson-naming.md`

## Later

- [phasic] "Acrobatics" curriculum block (8 levels, future insert before
  the endless tail): built around the launch-and-freeze tactic — levels
  with no gravity orb or other facilitating tools whose obstacles REQUIRE
  shoving a puddle airborne with a solid and frosting it mid-flight.
  Tutorial authored with the CD; tactic must never be required in earlier
  blocks (CD 2026-07-31 — it emerged as a workaround on L29, which is
  the freeze-refusal bug phasfreeze now owns, not intended design).
- [phasic] Obstacle-era gravmazes: bushes/fans/voids woven into orb
  mazes in blocks 5+ — deferred by the CD's walls-only decision; revisit
  after the block-2 playtest verdict (phasweave + phasgrav machinery).
- [phasic] iOS port scoping: shell choice (WKWebView wrap vs Swift port),
  real haptics, native level picker, drop web-only chrome. Notes:
  `.claude/phasic.md` § iOS-port notes.
- [phasic] Daily-challenge / share-code retrofit (house pattern; the
  generator is already seeded and deterministic per index).

## Icebox

- [phasic] Seed browser / level-code entry for the endless space.
