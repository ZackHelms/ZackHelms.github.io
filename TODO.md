# TODO — ZackHelms.github.io backlog

Buckets in order: In progress · Now · Needs Zack · Next · Later · Icebox.
Done log: `DONE.md`. Created 2026-07-31 scoped to **Phasic** — other work
in this repo is tracked per-game in `.claude/<game>.md` until it earns a
backlog entry here.

## In progress

- (none)

## Now

- [phasic] STUCK ghost-replay + strip frost buckets below L25 + complexity
  score on the clear screen (three CD decisions 2026-07-31, bundled: same
  file, same risk profile, each a single task).
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phaspolish.stuck-ghost-frost-strip-clear-cx.md`
- [phasic] In-game wiki (cogwheel → WIKI: home page, topic pages incl.
  tactics, search box under the reload button) + tactic #10 "push the
  puddle" (L13 Queue) into the registry. (CD request 2026-07-31, verbatim
  in the plan, given with the playtest sign-off.)
  **Plan ready (2026-07-31)** — run:
  `/zmh-producer:oversee-implementation .claude/plans/phaswiki.in-game-wiki-and-tactics.md`

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

## Needs Zack

- (none — the 2026-07-31 rounds answered everything asked; curriculum
  playtest signed off, see DONE.md)

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
