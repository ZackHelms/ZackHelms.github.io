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
- [phasic·IP] Reserve the app name "Phasic" in App Store Connect as early
  as possible (name reservations are first-come within Apple's rules; the
  name is unique across the entire App Store — have a backup like "Phasic
  Gems"). *Amended 2026-08-01: the enrollment half is already DONE — the
  account is active (Team `TT479XD8ZL`, distribution cert to 2027-05-10)
  and has shipped TestFlight builds via rn-ios-flightdeck. The reservation
  is step 3 of flightdeck's `apple-app-setup` per-game checklist, which
  the phasport plan hands you in full.*
- [phasic·IP] Source visibility. *Decided 2026-08-01: keep Phasic's source
  public until the App Store submission nears — Pages keeps serving the
  web version, the license carve-out stands, and the iOS copy lives in the
  already-private rn-ios-flightdeck repo. Revisit at submission time
  (going private then = its own plan: Pages restructure / built-output
  only).*

## Next

- (none)

## Later

*(all four plan-ready — recommended burndown order is this file order:
daily → mazes → acro → port, so the first TestFlight payload carries
everything)*

- [phasic] Daily challenge: one shared solver-proven level per UTC date
  (date-derived generated index; results in `save.daily`, never
  `save.done`; share codes deferred).
  **Plan ready (2026-08-01)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasdaily.daily-challenge.md`
- [phasic] Obstacle-era gravmazes: bushes/fans/voids woven into orb
  mazes in blocks 5–7 (phasweave + phasgrav machinery). *Un-gated
  2026-08-01: CD signed off the block-2 playtest.*
  **Plan ready (2026-08-01)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasmazes.obstacle-era-gravmazes.md`
- [phasic] "Acrobatics" → the Launch block: 9th curriculum block (levels
  65–72) built on launch-and-freeze; orb-less boards make the tactic
  mandatory; endless moves to 73+ with save migration. *Decided
  2026-08-01: tutorial drafted as a proposal, CD auditions it.*
  **Plan ready (2026-08-01)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasacro.acrobatics-block.md`
- [phasic] iOS app via rn-ios-flightdeck: GameShell WebView wrap of the
  latest web build (the CD's flightdeck choice settles the old scoping
  question; native picker/haptics stay follow-ups). The TestFlight build
  itself is CD-authorized (10× billed minutes) after the per-game Apple
  checklist.
  **Plan ready (2026-08-01)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasport.rn-flightdeck-ios-app.md`

## Icebox

- [phasic] Seed browser / level-code entry for the endless space.
