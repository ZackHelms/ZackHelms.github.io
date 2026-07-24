# .claude/scripts

Deterministic helpers for working on this repo.

- `smoke-mobile.cjs` — headless mobile smoke gate. Loads each given page in
  Chromium at an iPhone 13 viewport and fails on any console/page error
  (external-font/network noise ignored). Final line `SMOKE: GREEN`/`SMOKE:
  RED`, exit 0/1. This is the hard gate named in `.claude/zmh/producer.md`
  § Validation; run it on every changed page before committing.
  Needs `playwright-core` resolvable (NODE_PATH works) and a Chromium binary
  (`$SMOKE_CHROMIUM`, `/opt/pw-browsers/chromium`, or PATH).

  ```
  npm install playwright-core            # once, any directory
  NODE_PATH=<that dir>/node_modules \
    node .claude/scripts/smoke-mobile.cjs games/index.html games/neon-golf/index.html
  ```

  For deeper gameplay-driving tests (touch drags, deterministic physics
  scenarios), see `.claude/notes/20260724-headless-mobile-game-testing.md`.

- `stamp-badge.sh` — sets each given page's `#build-badge` to the current
  UTC time (badge SOP: `games/CLAUDE.md` § Build Timestamp Badge). Replaces
  whatever timestamp/placeholder the badge holds — no need to know the old
  string. One invocation = one identical timestamp across all files. Prints
  `STAMPED <file> <ts>` per file; exits 1 (`NO-BADGE`/`NO-FILE`) so gates
  fail loudly. Run it as the last step before commit on every changed page:

  ```
  .claude/scripts/stamp-badge.sh games/index.html games/<slug>/index.html
  ```
