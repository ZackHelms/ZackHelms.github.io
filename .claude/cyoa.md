# CYOA — context

`games/cyoa/index.html` (single file, ~3,200 lines). A tabletop RPG in the spirit of
D&D where **Claude is the Game Master**: a seed generates a world, the GM narrates it
(text revealed in step with a narrator voice), players type or speak, and every change
to the world goes through a **deterministic engine** that validates it, logs it, and
feeds the recorded canon back to the GM so revisits stay consistent. CD commission,
2026-09-25. Plan: `.claude/plans/cyoa.ai-gm-adventure.md`. Suite:
`.claude/tests/drive-cyoa.cjs` (76 checks). Style: **Grimoire**
(`.claude/styles/grimoire.md`). **Proprietary** (`games/cyoa/LICENSE`).

## CD decisions (2026-09-25 interview) — do not relitigate

- **Bring-your-own Anthropic key**, stored in the browser (localStorage when
  "remember" is on, else sessionStorage), sent only to `api.anthropic.com`. No server.
- Default model **Claude Opus 5.5** (`claude-opus-5-5`); Settings offers Opus 5,
  Sonnet 5, Haiku 4.5 and a custom id. Default effort `medium`.
- Scene pictures **code-drawn** (woodcut plates); AI art is a phase-2 option.
- Narrator: **built-in speech synthesis**; premium voices are a phase-2 option.
- Characters are **created by talking with the GM** (`create_character`,
  `suggest_character` for "surprise me").
- Story: a **seeded main quest in three acts inside an open world**; victory or a
  party wipe runs an epilogue and opens an ending screen; play may continue.
- Title: NEW / LOAD / SETTINGS / EXIT. **No top-left back/mute/settings chrome**;
  EXIT is the way back. **Reload button top-right at 2x** (76x60), below the badge.
- Hub: the **first** card, icon 🧙.

## Documented exceptions to repo conventions

| Convention | Here | Why |
|---|---|---|
| Hub back button + mute top-left | None; EXIT on the title; mute is the Settings volume sliders | CD request |
| Neon Arcade style | Grimoire | CD request: "a new distinct style" |
| Canvas 2D for everything | DOM/CSS page; Canvas 2D only for plates + frontispiece | a text game; music-mixer is the DOM precedent |
| No network | Calls `https://api.anthropic.com/v1/messages` | the game is an LLM conversation |
| No external JS | Raw `fetch` + a hand-written SSE parser, no SDK | no bundler here; the claude-api skill's `curl/` examples are the wire reference |

## Architecture (sections in the script, in order)

`UTIL / PRNG / TABLES / WORLD / ENGINE / CONTEXT / GM / NARRATION / SPEECH-IN / AUDIO /
PLATES / STORAGE / SESSION / UI / BOOT`

- **PRNG.** `rngFor(seed, stream, n)` = a fresh sfc32 per (seed, stream, index). The
  engine keeps the indices (`st.n.roll`, `st.n.name`, `st.n.pregen`) **in state**, so a
  replay reproduces every draw. Never use `Math.random` in anything the engine or a
  plate reads (music/SFX may).
- **World.** `generateWorld(seed, pins)` -> the **world bible**: region, tone, land,
  season, threat (+3 escalation stages, lair, boss statblock), MacGuffin, factions,
  9-11 places as a graph (L0 start, L1 its inn at 0h, the farthest node is the lair),
  ~10 NPCs (quest giver, innkeeper, ally, a traitor, the villain), the main quest Q0
  in three acts, and an opening incident. Pure function of its inputs. **The bible is
  stored in every save**, so a later change to the tables never breaks an old save.
- **Engine.** `newGame` builds mutable state from the bible; `exec(st, tool, input)` is
  the only door. Every tool **validates completely before it mutates** (and `exec`
  snapshot-restores on a throw). An accepted, non-read-only call is an **event**
  `{turn, name, input, result}`; `replay(seed, pins, bible, events, turn)` re-executes
  them and must equal the live state (asserted). 23 tools: dice, checks, travel,
  places/people/facts, characters, abilities, inventory, combat (initiative, attack,
  death saves, XP + levels 1-5), rest, time, quests, scene, lookup, end_scene.
- **Turn atomicity.** `gmTurn()` runs the provider against a **deep copy** of the state;
  only on success are the copy, its events, the player line, the chips and the
  narration committed. Any failure (network, 5xx after retries, 401, refusal, abort)
  discards the copy, removes the turn's DOM (incl. half-streamed narration) and hands
  the player's line back in the input box.
- **Context.** Request = `tools` + `system` (cached) + user[`bibleText` (cached),
  `turnContext` (volatile)]. **Each player turn is a fresh conversation**: earlier
  turns appear as a plain transcript inside the turn context, so no thinking block
  from an earlier turn is ever replayed (Opus 5.5's preserved-thinking binding never
  applies across turns). Inside a turn the tool loop is append-only and echoes the
  assistant content unchanged. The turn context carries the current place, people
  present, party sheets, combat, quests, play-created places/people, **CANON** (facts
  scored by focus + keyword match, max 40), the last 10 scene summaries and the last
  8 exchanges.
- **GM client** (`AnthropicGM`). Headers `x-api-key`, `anthropic-version: 2023-06-01`,
  `anthropic-dangerous-direct-browser-access: true`. Per `MODELS` profile: adaptive
  thinking (never `disabled`/`budget_tokens` — both 400 on Opus 5.5), explicit
  `output_config.effort`, and on Opus 5.5/Opus 5 `fallbacks: "default"` with beta
  `server-side-fallback-2026-07-01` (a 400 naming fallbacks retries once without, for
  the session). Never a forced `tool_choice`. `max_tokens` 16000, streamed. Only
  `text` blocks are narrated. Stop `refusal` -> in-fiction message + rollback.
  Tools are **not** `strict` and not `eager_input_streaming`: the engine validates
  every input anyway and returns reasons, and inputs are tiny.
- **Mock.** `window.__CYOA_MOCK__(api)` replaces the provider when a test sets it with
  `addInitScript`; never reachable from a URL. It drives the same hooks, so everything
  downstream is real.
- **Narration.** Streamed text -> sentence queue -> one `SpeechSynthesisUtterance` per
  sentence (also dodges engines that cut long utterances), words revealed by
  `onboundary` or a rate estimate, hard timeout per sentence. Voice off -> text speed.
  Tap the scroll = skip (reveal all, cancel speech). Headless Chromium has no voices,
  which the page treats as voice off.
- **Plates.** `Plates.specFor(st)` = `{id, k, land, season, f, fig, tod, wx}`; a place's
  `scene` (`k` + features) is fixed at creation, so a revisit looks the same in the
  same light and weather. Placement PRNG is seeded by the place id. Cached (8) at 1.25x.
- **Saves.** IndexedDB `cyoa/saves` (autosave + 3 slots), localStorage then memory as
  fallbacks. Save = `{format:'cyoa-save', v:1, seed, pins, bible, events, transcript,
  turn, endingAck, meta}`; load = replay. Export/import = the same JSON. Keys are never
  in a save.

## Rules that are easy to break

- **Never `innerHTML` model or save text.** `el()` sets `textContent`; the narrator
  appends text nodes. The CSP allows inline script (the page is one inline script),
  so it would NOT stop an injected `onerror` — text-only rendering is the defence, and
  the key lives in the same origin. Two suite rows guard it (live and re-rendered).
- **Keep the cached prefix byte-stable**: tools, `SYSTEM_PROMPT` and `bibleText` must
  not contain anything per-turn (time, counters, unsorted keys). Volatile data goes in
  `turnContext`. The suite asserts the bible text is identical across turns.
- **A new tool** needs: schema + run in `TOOLS` (validate first), a chip in `chipFor`
  if players should see it, and — if it only reads — `ro: true` so it is not logged.
  Adding a tool changes the cached prefix for everyone once; that is fine.
- **Changing the world tables** changes what new seeds generate, never old saves (the
  bible travels with the save). Changing a tool's behaviour CAN desync old saves' replay
  (`restore` warns on mismatches but loads); bump `ENGINE_V` and handle it if it matters.
- The opening turn starts **inside** the crossfade's midpoint (not after the fade), so
  there is no dead gap — and so the suite can wait on `turn >= 1`.
- The ribbon (z 69) must stay **under** the panels (z 70) or it covers their Back
  button; the reload button (z 90) stays above everything.

## Costs (inferred, not measured)

Opus 5.5 at medium effort: roughly $0.03-0.10 per player turn with 1-3 requests per
turn; the ~7k-token prefix is cached (cache reads $0.20/MTok). Set `debug: true` in
`cyoa.settings.v1` to log `usage` per request and per session to the console.

## Phase 2 / follow-ups (not built)

Premium narrator (OpenAI TTS / ElevenLabs, BYO key, per-passage audio cached in
IndexedDB, reveal synced to `currentTime`); optional AI scene art (OpenAI Images, cached
per place); an offline scripted GM for visitors without a key; an optional server proxy;
more world tables and a bigger bestiary; an initiative tracker UI; a cost meter; an
effort sweep after the first playtest. Each phase-2 provider needs its host added to the
CSP `connect-src`/`img-src`/`media-src`.
