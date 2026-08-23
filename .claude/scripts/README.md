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

  **Remote sessions need no install.** `playwright-core` ships nested inside
  the globally-installed `playwright`, so point `NODE_PATH` at that and go
  (verified 2026-07-27). A top-level `playwright-core` does not exist there,
  which is why a bare `NODE_PATH=/opt/node22/lib/node_modules` still fails:

  ```
  NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
    node .claude/scripts/smoke-mobile.cjs signals/index.html
  ```

  The gate is not games-only — it is an error-free-load check for any page in
  the repo, `signals/index.html` included.

  For deeper gameplay-driving tests (touch drags, deterministic physics
  scenarios), see `.claude/notes/20260724-headless-mobile-game-testing.md`.
  Drive suites worth keeping across sessions live in `.claude/tests/` — see
  that folder's README for when a suite earns a place there.

- `shot-page.cjs` — headless screenshot of any repo page for **visual
  iteration** (WebGL2 renders via SwiftShader). Same Chromium/`NODE_PATH`
  requirements as the smoke gate. Options: `w=/h=/dpr=` viewport,
  `wait=` ms, `click=x,y` (dismiss a splash), repeatable `select=#id:value`
  (drive pickers), repeatable `eval=<js>`. Exits 1 on any PAGEERROR — a parse
  error kills a page's whole script while the canvas still "renders", so check
  this even when the PNG looks plausible (added 2026-08-15 after exactly that
  bit twice).

  **`<out.png>` is positional, and the options are a closed set.** Writing it
  opt-style (`out=shot.png`) used to be taken verbatim as the path, so the shot
  landed in a junk directory literally named `out=` while the script printed a
  cheerful `SHOT=` line — and a typo'd key (`widht=390`) fell through to
  `NaN` and was ignored. Both exit 1 with a usage message now (2026-08-23).

  `eval=` runs JS in the page before the wait, so a scene can be **arranged**
  through the game's own test hook rather than screenshotting whatever the game
  happened to be doing. Added 2026-08-23, after a session hand-rolled four
  throwaway screenshot drivers to pose Neon Clash scenes — a spell mid-arc, the
  finale mid-explosion — that no combination of `click=`/`select=` could reach.
  Reach for it whenever the interesting frame is a *transient* one.

  ```
  NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
    node .claude/scripts/shot-page.cjs experiments/lone-tree/index.html /tmp/t.png \
    w=900 h=700 wait=2500 select=#species:pine

  node .claude/scripts/shot-page.cjs games/neon-clash/index.html /tmp/a.png \
    wait=950 eval="__NC.setSkin('toon'); __NC.start('2p'); __NC.setEnergy(0,20); __NC.deploy(0,'fireball',50,104)"
  ```

- `gates.sh` — runs the whole validation set in one command: the smoke gate on
  each changed page, `check-games-sync.cjs` (always — it is free), and any kept
  `.claude/tests/drive-<slug>.cjs` for the games those pages belong to. Resolves
  `NODE_PATH` itself, so there is nothing to remember. One parseable line per
  gate, final `GATES: GREEN`/`RED`, exit 0/1.

  ```
  .claude/scripts/gates.sh                     # derive pages from git
  .claude/scripts/gates.sh games/<slug>/index.html   # explicit
  .claude/scripts/gates.sh --no-drive          # smoke + sync only
  ```

  With no arguments it takes the changed `.html` from the working tree, the
  index, and `origin/main...HEAD` — the common mid-session case. It reports
  `SMOKE skipped (no playwright-core)` **and fails**, rather than passing
  quietly, because a silently-skipped gate is the failure mode
  `.claude/zmh/producer.md` § Validation explicitly forbids.

- `check-games-sync.cjs` — three-way catalog gate. A new game has to land in
  the hub card, the hub's `GAMES[]` facet dataset, **and** the
  `.claude/games-index.md` row, and those drift independently. Checks card ↔
  dataset ↔ index-row parity by href, icon uniqueness, card/dataset/index name
  agreement, facet-column agreement on all five axes, that every row points at
  a game that exists on disk with the context file it claims, that the
  "N games (M in-repo + K external)" line adds up, and that the dashboard's
  `AXES` still covers every facet axis. Since 2026-08-23 it also gates **card
  copy**: every hub card carries a description and none runs past **two
  sentences** (the CD's rule — the hub is a scan-and-pick list, and card text
  grows a clause at a time as a game gains features; three cards had reached
  five sentences and one seven before anyone noticed). Pure node — no Chromium,
  no deps, so it costs nothing to run. Final line `GAMES-SYNC: GREEN`/`RED`,
  exit 0/1.

  ```
  node .claude/scripts/check-games-sync.cjs     # from the repo root
  ```

  Batches kept hand-rolling a throwaway Playwright script that covered only
  card ↔ dataset; nothing ever checked the index rows, which is the file every
  session is told to read *first* when choosing a game to build.

- `stamp-badge.sh` — sets each given page's `#build-badge` to the current
  UTC time (badge SOP: `games/CLAUDE.md` § Build Timestamp Badge). Replaces
  whatever the badge holds — timestamp or placeholder of any shape — because
  it rewrites the div's whole text, then **greps the file back** to confirm the
  substitution landed. One invocation = one identical timestamp across all
  files. Prints `STAMPED <file> <ts>` per file; exits 1
  (`NO-BADGE`/`NO-FILE`/`NO-STAMP`) so gates fail loudly. Run it as the last
  step before commit on every changed page:

  ```
  .claude/scripts/stamp-badge.sh games/index.html games/<slug>/index.html
  ```

  **The self-check is the point** (added 2026-08-22 after it bit). The sed used
  to match only `build [0-9]{4}-…-…  ..:.. UTC`, so on a badge reading
  `build PENDING` it matched nothing, changed nothing — and still printed
  `STAMPED`. Neon Clash shipped twice with an unstamped badge, and two session
  reports quoted timestamps that had never been written. Root cause was not the
  regex, it was a tool asserting an outcome it had not verified; the class to
  watch for is any helper whose success line is computed from *intent* rather
  than from re-reading the artifact.
