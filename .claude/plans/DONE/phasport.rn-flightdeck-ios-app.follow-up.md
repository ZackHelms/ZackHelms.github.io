# phasport — follow-up (oversee run 2026-08-02)

Run outcome: implemented clean. Site commits `5e7befa..ebe7ef5` on
`worktree-oversee+phasport`; flightdeck commit `7436db7` pushed to
`rn-ios-flightdeck` `main` (`6889eee..7436db7`). All four tasks
sonnet-medium, first-pass green, zero retries/escalations.

## Blocked — needs you

The app is import-complete and preflight-green, but everything from here
runs on your authorization (10× billed macOS minutes) and your Apple
account. In order:

1. **flightdeck `apple-app-setup` per-game checklist** (skill lives in
   rn-ios-flightdeck, `.claude/skills/apple-app-setup/SKILL.md`):
   - Bundle id — suggest `com.tythos.phasic`.
   - App Store provisioning profile against the shared distribution cert
     (Team `TT479XD8ZL`, cert valid to 2027-05-10).
   - ASC app record — ⚠ the name "Phasic" must be unique across the whole
     App Store; have "Phasic Gems" ready as backup. Creating this record
     IS the `[phasic·IP]` name-reservation item in TODO.md — doing this
     step closes that one too. Reserve early; first-come.
   - Repo secrets `PHASIC_BUNDLE_ID` + `PHASIC_PROVISION_BASE64`. The 6
     shared secrets already exist (proven by hometown/signals/zmhscan
     green builds).
2. **Build:** from a flightdeck session, `/ios-build-push phasic`
   (~70 billed minutes). NOT run by this plan, per its scope.
3. **Playtest after TestFlight install:** app icon renders (flattened,
   no black-square alpha artifact); game is full-screen with NO hub
   back-arrow and NO build badge; audio starts after first tap; saves
   persist across relaunch; wiki opens and returns to the game.

## Decisions made on your behalf — review

- **Badge bumped in task 1, not task 4** (plan assigned it to task 4's
  docs pass). The game-page edit is task 1's, and bumping there means the
  iOS payload carries the exact badge the site serves
  (`build 2026-08-02 13:29 UTC`). Task 4 became docs-only, no badge.
- **Preflight corrections (cosmetic drift, plan drafted 3 merges ago):**
  `const TEST` anchor `index.html:422` → `:478`; suite second-page load
  pattern `drive-phasic.cjs:1263` → `:1484`; suite count 338 → 399
  (grew to 400 with the new guard check).
- **Flightdeck base moved** since the plan's anchor (`1bac854` →
  `6889eee`: new zmhscan app + signals distributed mode). Verified
  `import-web-game.sh` and `preflight.sh` unchanged;
  `check-ios-privacy.py` expanded its key list but nothing Phasic-relevant.
  Fast-forwarded the clone before importing.
- **Guard is defensively null-checked** (`if(bb)`/`if(bd)`) so a future
  chrome refactor can't turn it into a page error inside the shell.
- Flightdeck push printed an informational "This repository moved" notice
  (remote URL casing `zackhelms` → `ZackHelms`); push succeeded, remote
  URL left as-is.

## Deferred / discovered follow-ups

- Native level picker + real haptics — the iOS-polish half of the old
  port item; future flightdeck per-game work, after the CD plays build 1.
- `?daily` deep-link / shell entry so the daily challenge is reachable
  natively (phasdaily landed earlier this burndown).
- Session-harness note: after a worker restart the session cwd reverts to
  the multi-repo root, where `EnterWorktree` refuses to run ("not in a
  git repository"). Workaround used this run: manual `git worktree add`
  + absolute-path/`git -C` discipline in every spawn prompt; worktree
  cleanup is then manual too. Tier note (no ledger in this repo): 4/4
  sonnet-medium first-pass — the plan's uniform tiering was right.
