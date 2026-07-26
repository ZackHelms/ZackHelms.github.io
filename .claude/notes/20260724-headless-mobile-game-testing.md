# Headless mobile game testing (iPhone 13 viewport) — harness + gotchas

From the 2026-07-24 session that shipped Merge Drop and Neon Golf. Both games
were verified before push by driving them headlessly in Chromium at the
target device profile. The reusable minimum lives in
`.claude/scripts/smoke-mobile.cjs` (error-free load gate); this note records
the fuller gameplay-driving pattern and the traps hit.

## Harness pattern

- Remote sessions: Chromium is pre-installed at `/opt/pw-browsers/chromium`;
  do NOT `playwright install`. `npm install playwright-core` in the session
  scratchpad and launch with `executablePath`.
- Device profile that matches the design target:
  `{ viewport: {width:390, height:844}, deviceScaleFactor:3, isMobile:true,
  hasTouch:true }` (iPhone 13).
- Load games via `file://` URLs — everything is self-contained, so no server
  is needed. Filter out Google-Fonts/network console errors
  (`/fonts\.g|net::ERR|Failed to load resource/i`); fail on the rest.
- **Touch drags:** `page.touchscreen` only taps. For drag gestures
  (golf pull-back, aim-and-release), synthesize `TouchEvent`s inside
  `page.evaluate` — `new Touch({identifier, target, clientX, clientY})`
  dispatched as `touchstart` / interpolated `touchmove`s / `touchend` on
  `document.elementFromPoint(x, y)`. Works because the games listen on the
  canvas with `{passive:false}`.
- Game internals (top-level `let` state like `orbs`, `ball`, `state`) are
  reachable from `page.evaluate` — classic scripts put top-level lexical
  bindings in the realm's global scope. Drive deterministic scenarios by
  setting state directly (place ball beside cup, push orbs into the tank)
  instead of relying on random gameplay.
- Useful sweep for physics games: fire the ball/orb at max speed in N
  directions per level and assert (a) it never escapes the playfield bounds
  and (b) it always comes to rest — catches tunneling and energy leaks
  cheaply (54 shots across Neon Golf's 9 holes ran in seconds).
- **WebAudio assertions:** launch Chromium with
  `--autoplay-policy=no-user-gesture-required`, then after a synthetic
  start tap assert the top-level `AC` exists with `state==='running'`, the
  music scheduler interval id is set, and the sequencer step counter
  advances between two sampled evaluates. Mute-toggle tests: tap the DOM
  button, assert the muted flag + localStorage `<slug>-mute` + master gain
  values, then reload and assert persistence. "Comes to rest" sweeps on
  games with AI (air hockey) need the AI's speed param zeroed via its real
  config — a live AI legitimately keeps rallying forever.

## Test-design traps hit (the game was right, the test was wrong)

- **Merge test:** two same-tier orbs placed 4 px apart never merge — merges
  require actual circle overlap (`d² < (r1+r2)²`), and two orbs resting on
  the floor have no lateral force pulling them together. Deterministic merge
  tests must place the pair overlapping.
- **Overflow test:** dumping 40 same-tier orbs to force a game-over fails —
  the game chain-merges them into a few big orbs and the pile ends up *below*
  the danger line. That's the core mechanic working, not a bug. To test the
  danger-line rule deterministically, build a column of *alternating* tiers
  (can't merge) taller than the tank.
- iOS fires both `touchend` and `click` for one tap on overlay elements —
  the games debounce (400 ms) their start/retry handlers for this; tests
  should tap once and not assume a second event is a second intent.
- **Stress sweeps mutate persistence:** a long simulated-combat sweep can
  legitimately kill bosses and advance persisted checkpoints/bests. Later
  assertions must compare against the stored localStorage value, never a
  hard-coded stage/score from earlier in the test file (hit in star-surge:
  "CONTINUE · STAGE 2" had become stage 3 by the time the menu re-rendered).
- `page.reload()` wipes helpers injected via `page.evaluate` — wrap helper
  installation in a function and re-run it after every reload.
- **The rAF loop keeps simulating between evaluates.** Manual
  `update(1/60)` stepping inside one evaluate is deterministic, but the
  page's own rAF loop runs in real time between evaluates — in neon-drift
  the unsteered car drove itself onto the rough during a 400 ms
  `waitForTimeout`, so an absolute engine-pitch assert read the rough-speed
  value. Assert *relations* sampled atomically in a single evaluate (freq
  vs `car.v` read together), never absolutes across two evaluates.
- **Live NPCs interfere with unrelated assertions.** A patrol guard caught
  the player mid-walk in shadow-circuit's movement test and respawned them
  at start, failing a position assert that had nothing to do with movement.
  Isolate the rule under test: clear the actor array (`guards = []`) or
  zero the AI's speed via its real config (same family as the air-hockey
  rally case above).

## Real bug classes the drives caught (2026-07-24 four-game batch)

Unlike the traps above, these were genuine game bugs — the drive was right.
All four games shipped only after a scripted drive failed first:

- **`findIndex` −1 collides with computed indices.** Word-circuit's
  backtrack check `idx === path.length - 2` matched a *new* cell whenever
  the path had 1 tile (both sides −1) — every second letter popped the path
  empty. Guard `idx !== -1` before comparing findIndex results to computed
  positions.
- **Mode flags must be cleared in the single transition function.** Neon
  Tactics' `aiActive` was only cleared on match end; `doAction →
  maybeAutoEnd → endTurn` mid-AI-turn left it set, so the AI kept acting on
  the player's turn. Rule: whatever function performs the state transition
  (`endTurn`) owns resetting every mode flag.
- **setTimeout racing a per-frame director loop.** Star-surge's post-boss
  stage advance via `setTimeout(startWave, 1900)` raced the wave director's
  own "queue empty + field clear → advance" check → double-spawn/skipped
  wave. Sequence game-state through an explicit flag the director consumes
  (`pendingStage`), never a parallel timer.
- **Stale canvas-UI hitboxes** (grid-defense; now a Shared Conventions row
  in `games/CLAUDE.md`).

Second four-game batch (2026-07-24: tri-peaks, shadow-circuit, neon-recall,
neon-drift) added three more review/screenshot-caught classes:

- **Two mode branches advancing one entity in the same frame.** Shadow
  Circuit's chase→patrol handoff set `mode='patrol'` AND left a return
  path — the patrol ping-pong and the return-path walk then both moved the
  guard every frame. Rule: an entity's movement lives in exactly ONE mode
  branch; if a transition needs travel, model it as its own explicit mode
  (`returning`), not a flag layered on another mode.
- **Terminal checks must be state-guarded (idempotent).** Neon Recall's
  bomb power can clear the board *inside* `applyPower`, and `flipTile`
  calls `checkBoardDone` again right after — without a
  `state === 'play'` guard the round bonus paid twice. Any
  board-done/win/lose check reachable from both a side effect and its
  caller needs the guard.
- **Shared lazily-created audio resources.** Neon Drift's noise buffer was
  created lazily by the skid SFX but also needed by the music hats — hats
  stayed silent until the first skid. Create shared buffers in
  `audioInit`. Same review pass: overlay/menu `bindTap` handlers must call
  `audioInit()` too — on iOS the first gesture is usually a DOM menu
  button, not the canvas.

Third batch (2026-07-25 realistic-graphics: ember-depths, alpine-ascent,
golden-reel, vault-breaker) added two more test-was-wrong classes:

- **Staged state keeps evolving during the screenshot wait.** Golden
  Reel's staged fight (tension 88, mode run) snapped during the 600 ms
  `waitForTimeout` before the shot — run-mode tension climbs ~19/s even
  unreeled. When staging a scene that then waits in real time, stage
  *stable* values (calm mode, frozen `modeT: 999`) — same family as "the
  rAF loop keeps simulating between evaluates."
- **Auto-solver scripts need the game's own error metric.** Vault
  Breaker's solver computed a CCW pin approach from the raw CW distance:
  at the target that maps to −360°, so the script re-rotated a full lap
  forever and the hold never accumulated. Gate "arrived" on the game's
  `pinError()`-style function, not on your own re-derivation. (An
  auto-solver as a fairness gate — proving every generated level
  completable inside the timer — is worth the trouble: it validated all
  8 vault layouts in seconds.)

Fourth batch (2026-07-25: locksport, then ballpark + tilt-labyrinth) added
one more test-was-wrong class and two genuine bug classes:

- **(test wrong) A reset can immediately re-enter the next state.** After
  locksport's `resetLock()` the lock re-binds at once, so the new binding pin
  sits at rest in state `'binding'`, not `'free'`. An "everything is down"
  assert must accept the post-reset state too, not just the idle one.
- **(real) Draw loops must bail on terminal states, not just the menu.**
  Ballpark's `draw()` returned early only for `game==='menu'`; at `'end'` the
  question index has walked past the last question, so `curQ()` was undefined
  and every frame threw *behind* the end overlay — invisible on screen, caught
  only by the drive's console-error assert. Keep a console-error check in
  every suite; it is the cheapest bug detector in the harness.
- **(real) Deferred UI must capture its data at schedule time.** Tilt
  Labyrinth's win overlay fires on a 1.25 s `setTimeout` and re-read
  `lvlIdx`/`save.t[lvlIdx]`; jumping boards from the dropdown during the
  animation crashed it on `undefined.toFixed()`. Capture every value the
  callback needs in the closure and bail if the state it belongs to has moved
  on. (Same family as "setTimeout racing a per-frame director loop" above.)

Also from that batch: **continuous-force games drift hard during a
screenshot wait.** Tilt Labyrinth's held tilt keeps *accelerating* the ball,
so a ball staged at a chosen spot was ~40 units away by the time the shot
landed 300 ms later. Stage near-zero force (tilt ≈ 0.1) and zero velocity —
the most aggressive instance yet of "the rAF loop keeps simulating between
evaluates."

Also from the 2026-07-24 batch: **stage action-game screenshots by deterministic
placement, not scripted driving** — two attempts at "drive into turn 1"
put the drift car in empty rough (the corner arrives sooner than a blind
frame count assumes); placing the car on the racing line with matching
heading/velocity and hand-built skid/ghost props was deterministic and
shot-perfect on the first try.

Also: error-free smoke + green drives did NOT catch word-circuit's canvas
rendering at 2× zoom (missing `width:100%;height:100%` CSS — Shared
Conventions row). Only the mid-play **screenshot review** exposed it —
treat the screenshot as part of the gate, not just report garnish.

## Fairness gates by level type (pick the cheap one that actually proves it)

Three shapes have now been used. Match the gate to how the level is built:

| Level shape | Gate | Example |
| --- | --- | --- |
| Hand-authored **static** geometry (walls + hazards) | **BFS in agent-centre space** with obstacles inflated by the agent's radius + a margin, and hazards inflated to their *capture* radius. Proves a slow, careful route exists. | tilt-labyrinth: 10 boards, 0.5-unit grid |
| **Generated** levels with continuous motion | Solve the player's real equation of motion for the time available; assert the demanded move is a fraction of what's coverable. Then move the check *into* the generator. | sky-lantern (`.claude/notes/20260725-sensor-input-and-async-versus-games.md`) |
| A **rules puzzle** with no geometry | An auto-solver that plays by the game's own rules, gated on the game's own error metric. | vault-breaker, locksport |
| A **3D world with authored objectives** | BFS reachability **plus** a walk of each *intended leg* — see below. | wayfinder |

### Reachability is not the same as the route you told the player to take

The most expensive gate lesson so far (wayfinder, 2026-07-26). A BFS gate
proved every control reachable from the start and passed — while the leg the
lesson *instructs* was blocked by a **74° face**, because BFS happily routed
the long way round the hill. A second control sat **in a stream channel**,
where the movement code's own depth rule made it unreachable at all.

So for any game that names a route ("go via the boulder", "follow the stream
in"), add a **final-leg gate**: greedily walk each intended leg with the real
movement code and assert it arrives, and assert no intended leg crosses ground
the mover refuses. Generalised: *test the path your design tells the player to
walk, not just that the destination exists somewhere on the graph.*

Corollary for placing objectives: put them where the player can stand. A
control on a stream belongs on the **bank**, not the centreline — the same
depth rule that makes water an obstacle makes a mid-channel objective
unreachable.

### Gate the teaching, not just the outcome (the cheat gate)

For any game whose point is that the player performs a technique, arrival is
not evidence. Write a gate that **teleports straight to the objective without
performing the technique and asserts the game refuses to complete it.** In
wayfinder this immediately exposed that five of nine lessons could be passed by
wandering into the control, and later caught two subtler holes: a "touched the
stream" flag that was trivially true because the control sat *on* the stream,
and a handrail percentage computed from so few samples that a single frame of
stale velocity satisfied it. Rule: a technique flag needs a **minimum sample
count** and must be measurable *away from* the objective.

Two things the BFS variant taught that transfer:

- **Passing BFS is not the same as being playable.** BFS finds a route through
  a 1-unit slot. Author corridors at ≥ 2× body diameter of clear width and put
  hazards at a corridor's *edge*, never centred — a centred hazard eats almost
  the whole lane and leaves a technically-passable sliver. Have the gate print
  an openness number per level so a suspiciously tight one is visible.
- Never gate on "did my scripted player finish". A failing bot cannot tell you
  whether the level or the bot is wrong — the same lesson the sky-lantern batch
  paid for independently.

## Gate the CONTENT of an embedded bank, not just the code

Any game shipping a data bank (question banks, word lists, level tables) wants
a cheap content assert alongside the behaviour tests, because bad *data* passes
every code test. Ballpark's bank gate gets the whole class in six lines: every
answer must lie strictly inside its own range, **and not within 5% of either
end** (an answer parked at an edge is either unreachable or free), log ranges
need positive lower bounds, no duplicate prompts, every entry carries its unit.
Cheap to write once, and it makes adding 50 more questions a safe operation.

## Measuring boot time: `page.goto` lies in this sandbox

Wayfinder appeared to take **16 s to load**, which sent me optimising the wrong
thing. Every game in the repo measures ~12.8 s to *DOMContentLoaded* here —
that is the blocked `fonts.googleapis.com` request, not the page. Wayfinder's
real work was ~1.3 s on top of that baseline.

- Never conclude anything about boot cost from `page.goto` timing. Time the
  build functions directly with `performance.now()` inside `page.evaluate`, or
  compare against another game as a control.
- The live site is unaffected — fonts load normally there.

## Testing a WebGL page headlessly

- Launch with `--use-gl=swiftshader --enable-unsafe-swiftshader`. Without them
  the context may be missing entirely and you will "prove" a rendering bug that
  does not exist.
- Software GL runs at roughly **0.4 s/frame** for a scene a real GPU eats.
  Screenshot waits need seconds, not milliseconds — and **you cannot measure
  on-device frame rate this way**. Say so in the report rather than implying a
  number you did not measure; ask the CD, who has the phone.
- Filter `WebGL|SwiftShader|GroupMarker` out of the console-error assert, but
  keep the assert — it is still what catches genuine page errors.
- Keep the simulation layer free of GPU dependencies (`gfxOk` false must not
  throw). Then the whole drive suite runs regardless of whether rendering
  works, which is what makes any of the above testable.

## Related SOP

After pushing: `git push` ≠ live. Verify the "pages build and deployment"
workflow run for the pushed SHA concludes `success` (three jobs: build,
report-build-status, deploy), then compare the page's `#build-badge`
timestamp against the live page. Config: `.claude/zmh/producer.md` § Publish.
