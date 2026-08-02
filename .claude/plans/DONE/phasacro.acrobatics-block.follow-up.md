# phasacro — follow-up (oversee run 2026-08-02)

## Blocked — needs you

- **Audition the tutorial (L65 "The Flue")**: play it cold — does the launch
  read as discoverable? Verdict on the block word `Launch`, the name
  `The Flue`, and the hint ("No pour ever climbs a wall — melt the ruby
  where it lies, ram the puddle with the stone until it leaps up the flue,
  and freeze it in mid-air."). One-line edits if you want different words.
- **Playtest 2–3 generated block-8 levels** (L66–L72; mirrored sides, decoy
  ramp) — lesson or gotcha?

## Decisions made on your behalf — review

- **`{t:}` (revert-tap), not `{c:}` (thrown cold), is the solver's freeze
  verb for flame-melted gems** — traced: `dropSourceOn('cold')` on a
  flame-heated gem takes the removeFlame path, which commits the freeze but
  unconditionally returns false, so `{c:}` misreports success as failure.
  Documented in `.claude/phasic.md`; every launch leg and suite proof
  asserts via phase, never the applySource boolean.
- **Block-8 curriculum suppresses weaves, hazards, and gravmaze
  eligibility** (the plan only mandated `useGrav=false`): `buildGen`
  branches to `buildLaunch` for `b===8 && i<CURRICULUM_END` before any
  r() draw, which is also what keeps every other block's stream
  byte-identical. Endless (72+) keeps everything, including gravmazes —
  the plan's endless-keeps-grav trap is closed by construction.
- **`getLevel` got one non-weakening tweak**: block-8 curriculum uses
  `scan=0` (no rarer woven/maze form exists to hold out for), so the first
  solver-beaten salt serves. The fairness loop and WEAVE_SCAN untouched.
- The plan's migration snippet lacked a `persist()` — added, so the
  one-time splice survives the session it runs in.
- Generation yield: 139/140 salt wins over 65–71 × salts 0–19 (the one
  miss is a constructor packing reject, not a solver loss); all seven
  indices serve salt 0; no rescue/scriptless serves in the block.
- Tier note (no metrics ledger in this repo): all five tasks first-pass,
  zero warm retries, zero escalations — sonnet spike, sonnet-medium
  boundary, opus tutorial, fable generator/solver, sonnet suite/docs.
  (The first spike attempt died with a session-worker restart before doing
  any work — an environment failure, not a task failure; the respawn
  succeeded on attempt 1 of 3.)

## Deferred / discovered follow-ups

- Endless weighting for launch boards (plan's own follow-up — endless 72+
  currently never draws the launch template; decide after the block
  auditions well).
- Tutorial name/hint one-liners if the CD renames at audition.
