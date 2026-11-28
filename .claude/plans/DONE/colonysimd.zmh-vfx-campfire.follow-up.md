# colonysimd — follow-up (oversee run, 2026-11-27)

## Blocked — needs you

Nothing blocked. Playtest: see `TODO.md`, "Playtest the zmh-vfx campfire".

## Decisions made on your behalf — review

- **Preflight correction: the drive suite's baseline was 28 rows, not 27.** The plan counted 27
  `check(...)` rows that run; the unmodified suite printed `DRIVE: GREEN (28 passed)` at
  `b8e8f04`. The invariant "exactly 3 more" held: 28 -> 31.
- **Preflight correction: the forced site carries `hours`.** test-sim's `forceBuilt` shape
  includes `hours: B.hours`, which the plan's description of it left out. The suite's pushed
  site includes it (1.5).
- **Branch name.** The plan named `colony-sim-vfx-campfire`; the run worked on the oversee
  worktree branch `worktree-oversee+colonysimd` and also pushed it as `colony-sim-vfx-campfire`
  so the three step commits survive the worktree.
- **R2's camera aim** reads the ground height through `G.R.pan(0, 0)` (which snaps `cam.ty` to
  the ground at the target) before setting `ty` = ground + 0.6. The plan did not say how to get
  the ground height inside the page.
- **FIRE_FLOOR = 800**, from a measured 2033 warm pixels built vs 0 unbuilt at 23:00.
- **Negative tests, as run:** N1 (instance count 0) turned R2 red only; N2 (`embers: false`) R1
  only, R2 stayed green (2298 warm px); N3 (the old box flame back) R1 only, R2 stayed green
  (7482 px, since the emissive boxes glow too); N4 (no done check) R2 and R3. All as the plan
  expected.
- **`--shots`** reaches the stringified harness function through `window.__fireShot`, since
  the `sky(fn)` helper cannot close over Node variables.

## Deferred / discovered follow-ups

- `FS_BOX`'s emissive branch (`render.js`, the `vE > 0.5` path) now has no user. Remove it the
  next time `render.js` is reworked (the plan's own follow-up; too small for a run of its own).
- If the flame reads too pale by day: a `params: { flames: { alpha } }` override or a
  day-dependent alpha. The CD's call after the playtest.
- **Environment note (this run):** inside an `EnterWorktree` session, the harness refuses a Bash
  line that mixes `git` into a longer compound command ("too complex to verify that it stays
  inside the worktree"). Plain one-command `git` lines run fine. Recorded in
  `.claude/zmh/producer.md` § Environment.
