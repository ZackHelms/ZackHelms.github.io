# phasport — the Phasic iOS app: RN WebView shell via rn-ios-flightdeck

**Status:** DRAFT
**Requested:** 2026-08-01 (CD: "create an ios app for the latest version of
the webapp game" via rn-ios-flightdeck).
**Scope:** `games/phasic/index.html` (shell-chrome guard only) +
`.claude/tests/drive-phasic.cjs` + `.claude/phasic.md` in THIS repo; the
**`zackhelms/rn-ios-flightdeck` repo** (clone at
`/workspace/rn-ios-flightdeck`): new `games/phasic/` app via its importer +
app-icon set. **This is the repo's first cross-repo oversee plan — read
§ Gotchas before anything else.**

> Anchors verified at `a825c0d` (site) / `1bac854` (flightdeck). Re-locate by
> symbol on drift. This plan is recommended to run LAST in the burndown so
> the first TestFlight payload carries phasdaily/phasmazes/phasacro.

## Goal

`games/phasic/` exists in rn-ios-flightdeck as a preflight-green GameShell RN
app wrapping the latest Phasic web build (game + wiki + license + icons),
with a proper flattened app-icon set, hub-chrome hidden inside the shell, and
the CD handed the exact per-game Apple checklist + build command. The actual
TestFlight build is **CD-authorized** (10× billed macOS minutes) and is NOT
run by this plan.

## Context

Phasic is the web-first prototype of a planned iOS title (see the
`[phasic·IP]` items). flightdeck is the proven pipeline: per-game RN WebView
shell, `workflow_dispatch` macOS build, TestFlight. `games/signals` (from
this very repo) is the precedent import. The old "iOS port scoping" item's
shell question is answered by the CD's choice of flightdeck: **WKWebView
wrap**; native picker/haptics stay Later polish.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Shell-chrome guard + drive check (site repo) | mechanical-edit | sonnet | medium | exact sites below; suite nuance |
| 2 | Import into flightdeck + manifest fix | mechanical-edit | sonnet | medium | exact script + 2 file fixes |
| 3 | App-icon set (8 sizes, flattened) | mechanical-edit | sonnet | medium | scripted Pillow work, exact recipe |
| 4 | Flightdeck validation + commit/push + docs both repos | mechanical-edit | sonnet | medium | multi-repo commit discipline |

- **Ordering:** 1 → 2 → 3 → 4 strictly (task 2 imports the payload containing
  task 1's guard; task 4 commits what 2+3 produced).
- **Files owned:** 1: site `games/phasic/index.html` + drive suite; 2:
  flightdeck `games/phasic/**` (via importer) + its `flightdeck.json`; 3:
  flightdeck `games/phasic/ios/GameShell/Images.xcassets/AppIcon.appiconset/`;
  4: flightdeck commit + site `.claude/phasic.md` + badge.
- **Validation per task:** 1: site drive suite green + smoke; 2–4: flightdeck
  `bash scripts/preflight.sh phasic` prints `PREFLIGHT=pass` (its privacy
  sub-gate `IOS-PRIVACY: GREEN`), and `(cd games/phasic && npm ci && npm test)`
  green. Site final gate as usual.
- **Tier audit:** all tasks are mechanical with exact targets but each has a
  cross-repo or environment nuance (haiku checklist item 4 fails on the
  multi-repo discipline) → sonnet-medium across the board.
- **Decision defaults:**
  - Task 1 guard, added right after the `TEST` flag is defined
    (`index.html:422` region): when `location.protocol==='file:' && !TEST`,
    hide `#back-btn` and `#build-badge` (`style.display='none'`). Rationale:
    the shell loads `file://<bundle>/www/index.html`; the hub link would 404
    the WebView. The drive suite loads `file://…?test=1` so its chrome checks
    are unaffected; smoke loads `file://` without params and only asserts
    console-cleanliness. Add one drive check: a fresh page loaded via
    `file://` WITHOUT `?test=1` has `#back-btn` computed display `none`
    (pattern: the suite's existing second-page loads, e.g. the wiki page at
    `drive-phasic.cjs:1263`).
  - `wiki.html` needs no guard — its links are relative and its footer link
    targets the game's own files; it ships in the payload as-is.
  - Task 2 payload staging: copy exactly `index.html`, `wiki.html`,
    `icon.svg`, `icon-1024.png`, `LICENSE` from the RUN WORKTREE's
    `games/phasic/` (so the guard rides along) into a scratchpad staging dir;
    then `bash scripts/import-web-game.sh phasic <staging-dir> "Phasic"`
    from the flightdeck root. Expect `FIRST_IMPORT=1`, `WWW_FILES=5`.
  - After import, edit flightdeck `games/phasic/flightdeck.json`:
    `"sourceRepo": "jrpgstudio"` → `"ZackHelms.github.io"` (the importer
    hardcodes the default — `import-web-game.sh:146`; signals was hand-fixed
    the same way).
  - Task 3 icon recipe (from flightdeck's 2026-07-30 note): `pip install
    Pillow` (works through the proxy, no venv); source = the site's
    `games/phasic/icon-1024.png` (1024² RGBA — native res, no upscale);
    for each size in the appiconset `Contents.json` (40/58/60/80/87/120/180/
    1024 — same set as hometown's), LANCZOS-resize then **flatten to RGB on
    `#06060e`** (Apple rejects alpha on the 1024; flatten all sizes for
    consistency). Overwrite the template-copied placeholder PNGs in
    `games/phasic/ios/GameShell/Images.xcassets/AppIcon.appiconset/`;
    `Contents.json` itself is already correct — do not edit it.
  - Task 4 commits: flightdeck first — stage `games/phasic` ONLY (explicit
    pathspec), Conventional Commit `feat(phasic): import Phasic web game as
    GameShell app (payload + icons)`, then `git fetch origin && git merge
    --ff-only origin/main`, then push flightdeck `main`. Site docs:
    `.claude/phasic.md` § iOS-port notes gains the downstream-consumer note
    (mirroring `signals/README.md`'s: editing the web game does NOT update
    the iOS app; re-import via `scripts/import-web-game.sh phasic <staging>
    "Phasic"` replaces only `www/`) + badge bump.
  - Display name "Phasic"; `marketingVersion` stays `0.1.0`.
- **Embedded-content QA:** payload file count 5 re-derived from `ls
  games/phasic/` at draft time (LICENSE, icon-1024.png, icon.svg, index.html,
  wiki.html); icon size list read from hometown's `Contents.json` this
  session; importer default-sourceRepo claim read at `import-web-game.sh:146`.
- **Escalation triggers:** flightdeck clone missing AND `add_repo` denied;
  preflight RED for a reason outside `games/phasic` (pipeline regression —
  do not fix flightdeck infra from this plan).
- **Playtest:** CD, after their own build: install from TestFlight, check
  icon, full-screen game, no hub arrow/badge, audio after first tap, saves
  persist across relaunch, wiki opens and returns.
- **Publish:** site side default (guard + badge are player-neutral). The
  flightdeck BUILD is NOT publish-authorized here: per its config § Publish
  the CD runs `/ios-build-push phasic` (~70 billed min). Before that, the CD
  must complete flightdeck's `apple-app-setup` per-game checklist — bundle id
  (suggest `com.tythos.phasic`), App Store profile against the shared cert,
  ASC app record (⚠ the name "Phasic" is unique-across-the-App-Store; have a
  backup like "Phasic Gems" — this is also the `[phasic·IP]` name-reservation
  item), secrets `PHASIC_BUNDLE_ID` + `PHASIC_PROVISION_BASE64`. The 6 shared
  secrets already exist (proven by hometown/signals green builds).
- **Commit strategy:** one commit per task; site scope `phasic`, flightdeck
  scope `phasic`.

## Steps

1. Site: the `file:`+`!TEST` chrome guard + the no-param drive check; suite
   grows by exactly that one check.
2. Flightdeck: stage 5-file payload from the worktree → importer → verify
   `FIRST_IMPORT=1`, `WWW_FILES=5` → fix `flightdeck.json` sourceRepo.
3. Flightdeck: generate the 8 flattened icon PNGs from the 1024 master.
4. Validate flightdeck (`preflight.sh phasic` + jest), commit+push flightdeck
   main; site docs note + badge; site final gates.

## Gotchas / bindings

- **Cross-repo discipline (the big one).** Site work happens in this run's
  site worktree as normal. Flightdeck work happens in the clone at
  `/workspace/rn-ios-flightdeck` **directly on its `main`** (its own SOP —
  no PRs, no worktrees there). Every flightdeck git command:
  `git -C /workspace/rn-ios-flightdeck …`. If the clone is absent, `add_repo`
  zackhelms/rn-ios-flightdeck (access: push) and clone per its instructions
  first. NEVER stage site files into flightdeck's git or vice versa.
- **Flightdeck never-do rules bind here:** never rename `GameShell`; never
  touch `template/`; never `pod install` locally; never touch RN/Xcode
  version pins; re-imports only replace `www/`. Icons under
  `games/phasic/ios/…` survive re-imports — that's why they're safe there.
- Flightdeck env: node via nvm (scripts source it), **no rsync** (importer
  falls back to tar/cp — normal), **no `gh` CLI** (irrelevant here — no build
  is dispatched).
- The importer requires slug `^[a-z][a-z0-9]*$` — `phasic` is valid.
- Google Fonts is an external fetch: inside the shell it works online and
  falls back to system fonts offline — signals shipped the same way;
  acceptable, do NOT inline fonts in this plan.
- `check-ios-privacy.py` scans the `www/` payload: Phasic uses WebAudio +
  localStorage + guarded `navigator.vibrate` — none privacy-gated; expect
  GREEN with no Info.plist keys. If it flags something, read its output
  before adding any key.
- Site suite invariant: the guard must not change behavior when `TEST` is
  set or on http(s) — all 338 existing checks must stay green untouched.
- Worktree discipline (site side): absolute paths + `git -C <worktree>`;
  explicit pathspecs; never `git add -A`.

## Validation

Site: full drive suite green (grows by 1), smoke green. Flightdeck:
`PREFLIGHT=pass` + `IOS-PRIVACY: GREEN` + jest green. No macOS build runs.

## Follow-ups

- Native level picker + real haptics (the iOS-port item's polish half) —
  future flightdeck per-game work, after the CD plays build 1.
- `?daily` deep-link / shell entry once phasdaily lands (if the CD wants the
  daily surfaced natively).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasport.rn-flightdeck-ios-app.md
```
