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
