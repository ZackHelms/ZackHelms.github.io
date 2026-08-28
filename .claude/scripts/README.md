# .claude/scripts

Deterministic helpers for working on this repo.

- `pages-status.cjs` — read the Pages deploy verdict out of an oversized
  `mcp__github__actions_list` result. That call always blows the tool-result
  limit, and the file the harness saves it to has lines too long for `Read`'s
  chunking, so the mandatory publish check (`.claude/zmh/producer.md`
  § Publish) ends in a hand-written parse every time. With a SHA it prints a
  `PAGES=success|pending|failed|absent` verdict and exits non-zero unless the
  deploy actually succeeded — `pending` and `absent` are not evidence the site
  is live, so neither exits 0.

  ```
  node .claude/scripts/pages-status.cjs <saved-result.txt>          # newest 5 runs
  node .claude/scripts/pages-status.cjs <saved-result.txt> 430b647  # verdict + exit code
  ```

  Written after the parse was re-derived four times in one session (2026-08-23)
  and the first attempt threw `KeyError: 'conclusion'` — a run still in flight
  has no `conclusion` key at all, which is exactly the case the check exists for.

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

- `marketplace-status.sh` — **is the plugin marketplace clone current, and does
  a skill actually exist?** Fetches the directory-source marketplace this repo
  declares and reads its skill list off `origin/main`, never off the working
  tree. Prints `MARKETPLACE=` `LOCAL=` `REMOTE=` `BEHIND=` and either
  `SKILLS=<all>` or, given a name, `SKILL_FOUND=<plugin:skill>`; exits 1 when
  the clone is behind or the named skill is absent from the remote.

  ```bash
  .claude/scripts/marketplace-status.sh                    # freshness + full list
  .claude/scripts/marketplace-status.sh sprite-prerender   # does this one exist?
  ```

  Exists because the clone at `/home/user/zmhstudio` is made when the container
  is built and **never fetched by anything**, so `ls` of its skills directory
  says only what existed that day. Reported-missing-but-actually-present cost a
  session on 2026-08-27/28 (`.claude/notes/20260822-zmh-plugin-bootstrap.md`).
  Run it before telling the CD a skill does not exist.

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

  `select=` sets the value directly and dispatches `input`/`change` rather than
  going through `page.selectOption`. A settings picker normally lives in a panel
  that starts `display:none`, and selectOption's actionability check waits for a
  visibility that never arrives — so `select=` silently did nothing on exactly
  the pickers it was added for. A failed `select=`/`eval=` now **exits 1**: a
  shot of the wrong scene is worse than no shot, and reporting it while exiting
  0 is the same class of bug `stamp-badge.sh` already had (both fixed 2026-08-24).

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

- `shot-strip.cjs` — **contact sheet**: N frames of a page, spaced in time,
  tiled into one PNG. Same options as `shot-page.cjs` plus `frames=`/`gap=`.

  `shot-page.cjs` answers "does this look right?"; it cannot answer "does this
  *scene* look right?" when the scene moves on its own — a procedural
  background, a physics sim, an AI that is only interesting when it does
  something. One frame of an animation is a sample of size one, and the frame
  you catch is routinely the boring one: on 2026-08-24 a title-screen dogfight
  read as "completely broken, no ships visible" from a single shot, and the
  ships were fine — the shot had landed in a lull. It also costs one image to
  review instead of N, which matters when the whole point is comparing frames
  against each other.

  ```
  node .claude/scripts/shot-strip.cjs games/star-surge/index.html /tmp/s.png \
    frames=4 gap=1000 select=#gfx-select:neon
  ```

- `frame-budget.cjs` — **is this page holding 60fps?** Measures rAF deltas on a
  live, presenting page and prints `FRAME median= p95= max= over=` plus
  `BUDGET=ok|over`; exits 1 if the median is over budget (default 16.9 ms).
  Same `w=/h=/dpr=/select=/eval=` options as the shot tools, plus `frames=`,
  `budget=` and `swiftshader=1`.

  It exists because **Canvas 2D calls are queued**, so the obvious measurement
  is wrong: timing a loop of `update()`/`draw()` reported 1.43 ms/frame for a
  scene that was really at 33.3, and adding a `getImageData` to "force a flush"
  produced a different confident wrong number (the empty-loop baseline came
  back at 0.01 ms, which is the tell). Three measurement rounds went that way
  on 2026-08-24 before rAF deltas found the real regression.

  Two things about the output. It is **quantized to vsync** — 16.7 means inside
  budget, 33.3 means missing every second frame — so it says whether you are
  over, never how much headroom you have; bisect by stubbing pieces out
  (`eval="window.drawFoo = () => {}"`) to find what costs. And it deliberately
  does **not** pass the screenshot tools' `--use-angle=swiftshader` flags:
  those let a WebGL page render at all, and they also drag the 2D canvas onto
  software rasterization, which took the same page from 16.7 ms to 50.0 ms.
  Use `swiftshader=1` for a WebGL page, and do not compare that number against
  a run without it.

  ```
  node .claude/scripts/frame-budget.cjs games/star-surge/index.html
  node .claude/scripts/frame-budget.cjs games/star-surge/index.html select=#gfx-select:neon
  node .claude/scripts/frame-budget.cjs games/star-surge/index.html \
    select=#gfx-select:sprite evalFile=.claude/scripts/poses/star-surge-field.js
  ```

  **`poses/` — the scene a number was measured on.** A frame-cost figure is
  only comparable against the scene that produced it, and a scene described in
  prose ("a 16-enemy + boss + 60-bullet field") is re-typed differently by the
  next session — which is exactly what happened on 2026-08-27. So a pose worth
  re-measuring goes in `.claude/scripts/poses/<game>-<scene>.js` and is passed
  with `evalFile=` (repeatable, and it fails loudly if the file is missing).
  Cite the pose file, not the prose, wherever a perf number is recorded.

- `gates.sh` — runs the whole validation set in one command: the smoke gate on
  each changed page, `check-games-sync.cjs` (always — it is free),
  `negtest.sh scan` (also always, also free), and any kept
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

- `negtest.sh` — scaffolding for **negative tests**, the practice of breaking a
  shipping file on purpose to prove a check discriminates. The hazard is not a
  red gate; it is a **green** one on a stub that never got restored, which is
  how a stubbed renderer reaches production (2026-08-23: a restoring `cp` ran
  from a drifted working directory, succeeded against the wrong path, and left
  a stubbed `frameRot()` in the tree).

  ```
  .claude/scripts/negtest.sh save    games/<slug>/index.html   # BEFORE breaking it
  #   … break it — marking the break with @negtest — run the suite, confirm
  #     the RIGHT check went red …
  .claude/scripts/negtest.sh restore games/<slug>/index.html   # cmp-verified
  .claude/scripts/negtest.sh scan                              # anything left behind?
  ```

  `save` snapshots into `.git/negtest/`, which cannot be committed and never
  shows up in `git status`. `restore` copies back and then `cmp`s the result,
  because `cp` reports success against a path that is not the one you meant.
  `scan` greps the changed **shipping** files for the `@negtest` marker and
  exits 1 if one survives — `gates.sh` runs it on every invocation. It skips
  all of `.claude/`: the first version did not, and `gates.sh` flagged its own
  explanatory comment. Prints `SAVED=`/`RESTORED=`/`NEGTEST-SCAN: GREEN|RED`.

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

- **`check-canvas-space.cjs`** — diagnostic: does a page lay out in the same
  coordinate space its taps arrive in? Simulates the iOS rotation quirk (the
  canvas box ends up shorter than `window.innerHeight`), then compares each
  visible canvas's backing-store aspect against its CSS box aspect.
  `SQUASH=1.000` means they agree. Written 2026-08-28 after fire-clicker
  shipped the mismatch — the scene was drawn higher than it was hit-tested, so
  the campfire only answered taps at the bottom of its drawn circle and below.

  ```
  NODE_PATH=<playwright-core dir>/node_modules \
    node .claude/scripts/check-canvas-space.cjs games/<slug>/index.html
  ```

  **A diagnostic, not a gate** — deliberately not wired into `smoke-mobile`.
  A squash on a canvas the page never hit-tests is a stretched picture, not a
  dead tap, and the caller has to know which. It exempts three cases that each
  false-positived on the first run (`pinned=inline-css`, `uninit`,
  `skip-rotated`) — see the script header. Current standing result: every game
  clean except `wayfinder`'s `gl`/`ui` canvases (render-only; its one
  hit-tested canvas already measures its own rect).
