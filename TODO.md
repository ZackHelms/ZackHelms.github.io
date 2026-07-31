# TODO — ZackHelms.github.io backlog

Buckets in order: In progress · Now · Needs Zack · Next · Later · Icebox.
Done log: `DONE.md`. Created 2026-07-31 scoped to **Phasic** — other work
in this repo is tracked per-game in `.claude/<game>.md` until it earns a
backlog entry here.

## In progress

- (none)

## Now

- [phasic] **Freeze-refusal fairness bug** (CD screenshots 2026-07-31, live
  build 14:01): a big liquid gem pancakes flat and frost then refuses with
  "No room to crystallize here" despite visible clearance — seen on L27
  Spare Gallery (P/I4 on the upper shelf) and L29 Split Foundry (C/T5 on
  the floor). Hypothesis only (untraced): a spread puddle's outer particles
  exceed the per-particle jump cap (1.9 cells) for tall/wide footprints —
  investigate with `__GF.freezeDry` before proposing a fix. Fairness-
  critical in block 3+ where frost is the only tool. Needs a plan
  (`/zmh-producer:backlog-plan-gen the freeze-refusal bug`).
- [phasic] Move the PHASIC card to the TOP of the games hub list
  (`games/index.html` card order; keep games-sync green). (CD 2026-07-31.)

- [phasic] Raise the HOT/GRAV/COLD buckets by ~half a bucket height — at
  the screen's bottom edge, grabbing a source keeps triggering the iOS
  swipe-up-to-background gesture (CD 2026-07-31). Layout: `bucketRects`/
  `BZ` accounting; keep the drag hit areas at least as generous.
- [phasic] Now-playing line at the very bottom of the screen: track number
  + song title (CD 2026-07-31). The 10 `SONGS[]` have no names yet —
  naming them is part of the item (CD can rename after). Pairs naturally
  with the bucket raise (same freed bottom strip) — bundle at plan-gen;
  coordinate with the phasaudio plan's per-block song assignment.
- [phasic] Landscape layout: in landscape orientation move the three
  buckets (HOT/GRAV/COLD) to the RIGHT side of the screen so the play
  field gets the full vertical real estate (CD 2026-07-31). Bundle with
  the bucket raise / now-playing items — same layout round.
- [phasic] **Rotation squish bug** (CD 2026-07-31, device-observed):
  rotate portrait → landscape → portrait and the game renders squished;
  further rotations never recover — only a restart does. Symptom
  recorded, cause NOT yet traced — debug first (candidates to check, not
  conclusions: stale `100dvh` after iOS rotation; canvas flex box vs
  bounding-rect measured mid-rotation; single `resize` listener with no
  `orientationchange`/`visualViewport` handler or deferred re-layout).
  The fix plan must include a headless reproduction: drive the viewport
  390x844 → 844x390 → 390x844 in the suite and assert the field's
  rendered aspect recovers. Bundle with the layout round above.

- [phasic] **Proprietary license carve-out** (CD 2026-07-31; needs a
  plan): add `games/phasic/LICENSE` (all-rights-reserved proprietary
  notice, © Zack Helms), amend root `LICENSE.txt` with an explicit
  exception clause ("games/phasic/ is NOT licensed under Apache 2.0 —
  all rights reserved, see games/phasic/LICENSE"), link it from the
  game's settings menu and a footer link on every wiki page. Facts
  verified 2026-07-31: the root license is **Apache 2.0, not MIT**; a
  carve-out is forward-only (copies already distributed under Apache 2.0
  keep those rights for those versions — the grant is irrevocable);
  Apache §6 never licensed the PHASIC name/trademark in the first place.

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
  logo mark too once the queued 2x2-gem icon exists (it's the brand).
  File intent-to-use (1(b)) now if the App Store launch is months out.
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

- [phasic] Obstacle-weaving generator: holes/bushes/fans placed IN solution
  paths (solver keeps validating); two-shelf and gas/attic templates. (CD:
  next engineering priority.)
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasweave.obstacle-weaving-generator.md`
- [phasic] Dedicated obstacle SFX (void gulp, bush slurp, fan hum) +
  per-block music (songs by curriculum block instead of `level % 10`) —
  merged: both audio-subsystem items.
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phasaudio.obstacle-sfx-and-block-music.md`

- [phasic] Block-lesson level naming (CD 2026-07-31): every level name in
  a curriculum block begins with the same word, the word that describes
  the block's lesson (tutorials AND generated names — `genName` would draw
  from a per-block lead word + suffix pool). Interpretation to confirm at
  plan-gen: lead-word list per block (e.g. Drag/Flame/Gravity/Frost/
  Vapor/Void/Hedge/Wind) and whether legacy tutorial names like "The
  Kettle" get prefixed or renamed.
- [phasic] **Gravity block (L17–24) must REQUIRE the orb** (CD 2026-07-31,
  verbatim intent): "Currently I am able to use another object to push the
  liquid or gas object where i need it to go." Opener like old L10 (Room
  to Pour shape): one object + one flame + the grav orb, orb-mandatory.
  Then maze-like levels needing careful orb use to push gas / pull liquid
  through mazes past obstacles (bushes, fans, voids) as needed; complexity
  ramps with more objects in various states and traps like voids. Design
  notes: needs anti-shove layouts (the push-the-puddle tactic must not
  bypass the lesson — fence solids out or omit spare solids); flag for the
  plan-gen interview: obstacles formally debut in blocks 5–7, so using
  bushes/fans/voids inside block-2 mazes reshuffles the curriculum
  introduction order — CD call on how to reconcile.
- [phasic] Custom game icon (hub card + future iOS app icon): a 2x2 red
  gem — lower third solid, middle third liquid (translucent), top third
  gaseous (semi-transparent) — on a transparent background with a leafy
  bush behind the gem. Deliver as an inline/hub-card image plus a
  1024x1024 master for the iOS icon; wire favicon/apple-touch-icon on the
  game page. (CD spec 2026-07-31, verbatim in this entry.)

## Later

- [phasic] "Acrobatics" curriculum block (8 levels, future insert before
  the endless tail): built around the launch-and-freeze tactic — levels
  with no gravity orb or other facilitating tools whose obstacles REQUIRE
  shoving a puddle airborne with a solid and frosting it mid-flight.
  Tutorial authored with the CD; tactic must never be required in earlier
  blocks (CD 2026-07-31 — it emerged as a workaround on L29, which is the
  freeze-refusal bug above, not intended design).
- [phasic] iOS port scoping: shell choice (WKWebView wrap vs Swift port),
  real haptics, native level picker, drop web-only chrome. Notes:
  `.claude/phasic.md` § iOS-port notes.
- [phasic] Daily-challenge / share-code retrofit (house pattern; the
  generator is already seeded and deterministic per index).

## Icebox

- [phasic] Seed browser / level-code entry for the endless space.
