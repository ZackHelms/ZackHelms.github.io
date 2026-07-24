# Parallel game-batch builds with builder subagents — SOP + gotchas

From the 2026-07-24 session that shipped Neon Slice, Bubble Blaster, Block
Fit, and Sky Hopper (commit 6144e23) — four games built **concurrently** by
four builder subagents, each passing the smoke gate and a scripted gameplay
drive before handoff. Total wall-clock ≈ 25 min of building; zero game-code
fixes needed at orchestrator review. This works because the repo's context
system is complete enough to brief an agent cold; reuse this pattern for any
multi-game batch.

## Orchestration pattern

- One builder agent per game; all launched in parallel. Each agent owns
  exactly TWO files: `games/<slug>/index.html` and `.claude/<slug>.md`.
  **Agents must not touch `games/index.html`** (single shared file =
  orchestrator-only, cards added after all agents finish) and must not run
  git commands.
- Orchestrator pre-installs `playwright-core` in the session scratchpad
  once; every agent's brief includes the literal
  `NODE_PATH=<scratchpad>/node_modules node .claude/scripts/smoke-mobile.cjs …`
  command so all agents share one install.
- Badge timestamps: agents write the placeholder `build 2026-07-24 00:00 UTC`;
  the orchestrator stamps the real `date -u` on ALL changed pages in one sed
  pass right before commit (keeps every badge in the batch identical).

## What the agent brief must contain (all of it)

1. Files to read first: `games/CLAUDE.md`, the newest game as boilerplate
   reference (head/meta/palette/HUD/overlay patterns — snake-arena as of
   this batch), `.claude/notes/20260724-headless-mobile-game-testing.md`,
   and one existing `.claude/<game>.md` as the context-file style model.
2. The hard-conventions checklist spelled out (viewport meta, palette vars,
   badge div + placeholder, 100dvh/safe-area layout, DPR cap 2, dt cap
   100 ms, touch+mouse mirrored with `{passive:false}`, 400 ms overlay-tap
   debounce, localStorage in try/catch, top-level `let` state for
   `page.evaluate` testability, one classic script, file://-safe).
3. A complete per-game design spec (mechanics, scoring, fairness rules,
   HUD, overlay copy). Vague specs are where agents diverge; fairness rules
   ("never more bombs than gems per volley", "generator must guarantee
   reachability", "never deal a dead hand") must be explicit.
4. Required validation: `node --check` on the extracted script, smoke gate
   GREEN, and a bespoke headless gameplay drive with deterministic
   scenarios (set top-level state directly, then assert).

## Gotchas confirmed this batch

- All four agents' "test failures" were test-design bugs, not game bugs
  (e.g. asserting combo state after `touchend` when lift banks the combo
  synchronously; Playwright evaluating an arrow-function *string* as an
  expression instead of calling it). Per-game traps live in each
  `.claude/<slug>.md` § headless test recipe.
- Block Fit-style lifted drags: when a game renders the dragged piece N px
  above the finger, synthetic touches must aim the finger N px BELOW the
  intended drop point.
- Agents naturally re-derive iOS/WebAudio safety if told the target device:
  audio contexts must be created lazily on first gesture (all four games do
  this via a shared `audio()` helper pattern).
- Icon check before writing hub cards: grep `game-icon` in
  `games/index.html`; this batch took 🔪 🎯 🧩 🐇.

## Publish reminder

Push to `main` **is** the publish, but `git push` ≠ live — verify the
"pages build and deployment" run for the pushed SHA concludes `success`
(`mcp__github__actions_list`), per `.claude/zmh/producer.md` § Publish.
Gotcha: that MCP tool's response is ~400k chars and overflows context even
at `per_page:1`; it gets saved to a tool-results file instead — extract with
`jq -r '.workflow_runs[] | select(.head_sha=="<sha>") | [.status,.conclusion] | @tsv'`
on that file.

Stall variant (hit 2026-07-24, push `631a6e5`): sometimes **no workflow run
is created at all** for a push — the commit is verifiably on GitHub `main`
(`mcp__github__list_commits`) but the runs list never gains an entry, and
Pages silently keeps serving the previous deploy. Same fix as the 503 case
(zmhstudio note `20260720-firepit-…-pages-503.md`): after ~10 min with no
run, `git commit --allow-empty` + push to re-trigger, then verify the new
run concludes `success`.

## Second batch confirmations (2026-07-24, five games: Neon Stack, Blade Spin, Neon Crossing, Neon Air Hockey, Meteor Defense — commit 5ccb853)

The pattern held at N=5, again with zero game-code fixes at orchestrator
review (each agent's own drive found-and-fixed its bugs pre-handoff;
26–41 assertions per game). New learnings to fold into future briefs:

- **Audio is now a batch requirement** (SFX + looping background music,
  all WebAudio-synthesized, zero audio files) and the brief pattern worked
  first-try in all five games: lazy AudioContext on first gesture →
  `sfxGain`/`musicGain` masters; SFX = short oscillator/noise envelopes;
  music = 16+-step lookahead sequencer (setInterval ~100 ms scheduling
  ~0.3 s ahead of `ac.currentTime`; bass + lead + noise-buffer hats;
  musicGain ≈ 0.5, per-voice 0.03–0.08); persisted 🔊/🔇 mute top-left that
  stops propagation; `visibilitychange` → suspend/resume. Assign each game
  a distinct tempo/key/mood in its brief or you'll get five identical loops.
- **Repeated cross-agent bug — canvas in a flex column needs
  `min-height:0`:** two of five agents independently shipped-then-fixed a
  landscape overflow where `flex:1` canvas transferred its intrinsic
  300:150 min-content size and pushed play elements off-screen at 844×390.
  Put `min-height:0` in the hard-conventions checklist of every future
  brief (now also in `games/CLAUDE.md` § Shared Conventions).
- **Remote stop-hook vs in-flight agents:** the remote session's stop hook
  demands committing untracked files at every turn end, but mid-batch the
  unfinished agents' `games/<slug>/` dirs are untracked WIP owned by
  running subagents. Resolution: commit-and-push each game to the WIP
  branch as its builder lands (batch 1/5 … 5/5 commits), never `git add -A`
  mid-batch, and tell the hook why the rest waits. Bonus: per-game commits
  make each game's diff reviewable in isolation.
- Headless AudioContext assertions need Chromium launched with
  `--autoplay-policy=no-user-gesture-required` (detail in
  `20260724-headless-mobile-game-testing.md`).
- Icons taken by this batch: 🏗️ 🗡️ 🐸 🏒 ☄️.

## Third batch (2026-07-24, four games via /create-new-games 4: Word Circuit, Neon Tactics, Star Surge, Grid Defense — commits a43442c…561d098)

**Sequential orchestrator-built variant** — no subagents; the session built,
tested, documented, and committed each game in turn on the WIP branch, then
merged to `main` once. Works fine at N=4 and trades wall-clock for tighter
quality control: unlike the parallel batches (zero orchestrator-found bugs
because agents fixed their own), this batch's scripted drives caught **four
real game bugs pre-ship** — catalogued in
`20260724-headless-mobile-game-testing.md` § Real bug classes. Notes:

- Concept picks came from `.claude/games-index.md` § Coverage summary (the
  batch closed the `word`, `turn-based-tactics`, `shmup`,
  `tower-defense-classic`, and `daily-challenge` gaps); refresh the
  coverage summary in each game's own commit — the per-commit rule kept the
  index honest mid-batch.
- Per-game commit + stamp-badge + smoke on {game, hub} per commit scales
  cleanly; final Pages verification once after the `main` merge.
- Icons taken by this batch: 🔤 ♟️ 🚀 🗼.
