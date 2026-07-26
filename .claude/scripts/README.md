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
  Drive suites worth keeping across sessions live in `.claude/tests/` — see
  that folder's README for when a suite earns a place there.

- `check-games-sync.cjs` — three-way catalog gate. A new game has to land in
  the hub card, the hub's `GAMES[]` facet dataset, **and** the
  `.claude/games-index.md` row, and those drift independently. Checks card ↔
  dataset ↔ index-row parity by href, icon uniqueness, card/dataset/index name
  agreement, facet-column agreement on all five axes, that every row points at
  a game that exists on disk with the context file it claims, that the
  "N games (M in-repo + K external)" line adds up, and that the dashboard's
  `AXES` still covers every facet axis. Pure node — no Chromium, no deps, so
  it costs nothing to run. Final line `GAMES-SYNC: GREEN`/`RED`, exit 0/1.

  ```
  node .claude/scripts/check-games-sync.cjs     # from the repo root
  ```

  Batches kept hand-rolling a throwaway Playwright script that covered only
  card ↔ dataset; nothing ever checked the index rows, which is the file every
  session is told to read *first* when choosing a game to build.

- `stamp-badge.sh` — sets each given page's `#build-badge` to the current
  UTC time (badge SOP: `games/CLAUDE.md` § Build Timestamp Badge). Replaces
  whatever timestamp/placeholder the badge holds — no need to know the old
  string. One invocation = one identical timestamp across all files. Prints
  `STAMPED <file> <ts>` per file; exits 1 (`NO-BADGE`/`NO-FILE`) so gates
  fail loudly. Run it as the last step before commit on every changed page:

  ```
  .claude/scripts/stamp-badge.sh games/index.html games/<slug>/index.html
  ```
