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
