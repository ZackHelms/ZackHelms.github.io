# cyoa - AI Game Master tabletop adventure (new game, Grimoire style)

**Status:** DRAFT
**Requested:** 2026-09-25.
**Scope:** new `games/cyoa/` (single-file `index.html` + proprietary `LICENSE`),
new style spec `.claude/styles/grimoire.md`, hub card + `GAMES[]` entry in
`games/index.html` (FIRST card), `.claude/games-index.md` row, new context file
`.claude/cyoa.md`, new drive suite `.claude/tests/drive-cyoa.cjs`, doc touches in
root `CLAUDE.md` (licensing list, context-file table, `games/cyoa/` bullet) and
`games/CLAUDE.md` (exceptions + inventory entry).

## Goal

A tabletop RPG in the spirit of D&D where Claude is the Game Master. A seed
deterministically generates a world; the GM narrates it in text that is written
out while a narrator voice reads it aloud; players type or speak what they do; the
GM answers, and every change to the world goes through a deterministic engine that
validates it, records it in an append-only event log, and feeds the recorded canon
back to the GM on later turns so places, people and facts stay consistent. Games
save and load (autosave, three slots, file export/import). The page is built in a
new **Grimoire** style (illuminated manuscript), not Neon Arcade, and is listed as
the first card on the games hub with a wizard icon.

## Context

CD brief (2026-09-25, this session), with the decisions taken in the interview:

- **Flow:** hub -> CYOA title page with NEW / LOAD / SETTINGS / EXIT. EXIT returns
  to the games hub. None of the usual top-left chrome (back, settings cog, mute).
  The **reload button stays, top-right, twice its usual size**.
- NEW -> crossfade -> a seed-generated opening story, revealed gradually while a
  realistic narrator voice reads it. The seed can be pinned in SETTINGS.
- Players (one or a group at one device) type or speak actions and questions; the
  GM answers, interprets, and documents actions in an audit log / data structure
  so revisits and repeated questions stay consistent.
- Game state is saveable and loadable.
- **Decisions (CD answers):**
  - AI access: **bring-your-own Anthropic API key**, stored in the browser only,
    direct browser -> API calls. No server.
  - Default model: **Claude Opus 5.5 (`claude-opus-5-5`)**, changeable in Settings.
  - Scene pictures: **code-drawn** woodcut plates by default; **AI art optional**
    (phase 2).
  - Narrator voice: **built-in speech synthesis** by default; **premium voice
    optional** (phase 2).
  - Style: **Grimoire** - illuminated manuscript, parchment, ink, gold leaf,
    woodcut plates; Cinzel + IM Fell English.
  - Characters: **created by talking with the GM** after the opening; seeded
    suggestions for "surprise me".
  - Story shape: **seeded main quest (three acts) inside an open world**; an
    ending screen + epilogue on victory or party wipe, then "continue
    adventuring" is allowed.
  - License: **protected** (proprietary, all rights reserved, play-only) - the
    seventh protected game.
- Icon: a small wizard. Hub card uses 🧙 (unused by any other card, verified
  2026-09-25); the page favicon is an inline-SVG wizard head in Grimoire ink.

## Implementation guidance (for the overseer)

Tiers assigned by judgment: `.claude/zmh/producer.md` § Plans says this repo has
no task-scoping skill, so there is no checklist to score against. Profile:
balanced.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Grimoire style spec + styles README row | docs | sonnet | medium | new prose spec with token blocks; needs taste, not cross-system judgment |
| 2 | Page shell: title screen, settings panel, reload button, crossfade, Grimoire CSS, favicon, frontispiece placeholder | frontend | sonnet | high | self-contained DOM/CSS against a written spec |
| 3 | Deterministic engine: PRNG streams, world generator + tables, state/reducer/event log, rules (checks, combat, rest, death), validation, replay, canon retrieval | cross-system | opus | high | the load-bearing design; every other task consumes its API |
| 4 | GM client: raw-fetch SSE streaming, tool schemas, system prompt, per-turn context assembly, tool loop, turn atomicity, refusal/error handling, model profiles | cross-system | opus | high | API-surface correctness (Opus 5.5 breaking changes) + prompt design |
| 5 | Narration pipeline (sentence queue, synced reveal, Web Speech TTS, skip, ducking) + speech input | frontend | sonnet | high | browser-API plumbing with known platform quirks listed below |
| 6 | Woodcut scene renderer (SceneSpec -> Canvas 2D plate) + title frontispiece | art | opus | high | art quality from code needs judgment; deterministic by location id |
| 7 | Tale screen + in-game menu + Chronicle + party sheets + saves/load/export/import + ending screen | frontend | sonnet | high | UI over the engine API from task 3 |
| 8 | Mock GM provider + `drive-cyoa.cjs` suite + negative tests | tests | sonnet | high | scripted provider; assertions enumerated in § Validation |
| 9 | Hub card (first), `GAMES[]`, games-index row + coverage refresh, `.claude/cyoa.md`, LICENSE, CLAUDE.md + games/CLAUDE.md touches, badge | docs | sonnet | medium | several files that `check-games-sync.cjs` cross-checks; sonnet over haiku because the coverage-summary prose needs judgment |
| 10 | Phase 2: premium narrator voice (OpenAI TTS / ElevenLabs, BYO key) | frontend | sonnet | high | provider adapter behind task 5's voice interface |
| 11 | Phase 2: optional AI scene art (OpenAI Images, BYO key) + IndexedDB image cache | frontend | sonnet | high | provider adapter behind task 6's plate interface |

- **Ordering / dependencies:** 1 -> 2 -> 3 -> 4 -> (5, 6) -> 7 -> 8 -> 9. Phase 2
  (10, 11) only after 8 is green; each is independent of the other. Parallel-safe:
  none - every task edits `games/cyoa/index.html`. Default is sequential.
- **Files owned per task:** 1: `.claude/styles/**`; 2-7, 10, 11:
  `games/cyoa/index.html`; 8: `.claude/tests/drive-cyoa.cjs` (+ the mock hook in
  `index.html`); 9: `games/index.html`, `.claude/games-index.md`, `.claude/cyoa.md`,
  `games/cyoa/LICENSE`, `CLAUDE.md`, `games/CLAUDE.md`.
- **Validation per task:** after every task, `node .claude/scripts/smoke-mobile.cjs
  games/cyoa/index.html` is GREEN. From task 8 on, `node
  .claude/tests/drive-cyoa.cjs` is GREEN. Task 9 adds `node
  .claude/scripts/check-games-sync.cjs` GREEN.
- **Decision defaults** (the overseer decides and logs, it does not ask):
  - Anything in this plan vs. a repo-wide convention: **this plan wins** for the
    items listed in § Gotchas "Documented exceptions"; the convention wins
    everywhere else.
  - No API key when NEW is pressed: open Settings scrolled to the key field with
    one line saying the Game Master needs a key (the refusal/consequence case of
    the discovery rule). Do not build an offline scripted GM in this plan (see
    Follow-ups).
  - In-game menu lives top-right as a hanging bookmark ribbon to the left of the
    reload button. Never top-left.
  - Default effort `medium`; Settings offers low / medium / high.
  - Speech input fills the text box; the player taps send. A Settings toggle
    "send when I stop speaking" is off by default.
  - Content rating default "teen" (PG-13 violence, no sexual content); Settings
    offers family / teen / mature and the system prompt carries it.
  - Night-reading (dark) mode follows `prefers-color-scheme`, with a Settings
    override (auto / parchment / night).
  - Word/phrase choices, table contents, NPC name syllables, bestiary numbers:
    implementer's call, following 5e-lite conventions below.
- **Embedded-content QA:** the tool list, SceneSpec vocabulary and state shape
  below are interfaces, not verbatim code; implement to the contract. Counts
  stated as invariants (e.g. "drive suite grows by exactly what task N adds").
- **Escalation triggers:** (a) any live API call - the container has no
  Anthropic key, and the CD's key is never to be requested in chat or committed;
  the overseer validates against the mock provider only and leaves the live
  check to the CD playtest; (b) the hub order change if a concurrent session has
  also inserted a first card (merge per root `CLAUDE.md` § Git workflow, keep
  CYOA first, report it); (c) the `anthropic-dangerous-direct-browser-access`
  header is rejected by the API (it is the only browser path without a server).
- **Playtest:** yes - the CD, with their own key, on iPhone and desktop: voice
  quality, reveal/voice sync, speech input, GM consistency across a revisit, save
  -> reload -> load, the ending screen, and per-turn latency/cost at `medium`.
- **Publish:** per `.claude/zmh/producer.md` § Publish (direct to `main` is
  allowed by root `CLAUDE.md`); this planning session's branch is
  `claude/cyoa-game-design-s8xln4`.
- **Commit strategy:** one conventional commit per task, scope `cyoa`
  (task 1: `docs(styles)`; task 9: `docs(cyoa)` / `feat(games)`).

## Design

### Screens

1. **Title.** Woodcut frontispiece (a small wizard at a lectern, code-drawn),
   "CYOA" in gold-leaf Cinzel Decorative capitals, four rubric plaques: NEW, LOAD
   (disabled look when there are no saves), SETTINGS, EXIT (`href="../index.html"`).
   Top-right: the reload button at 2x size (see Gotchas). No other chrome.
2. **Settings** (full-screen parchment panel; reachable from title and in-game).
   Sections:
   - *Game Master:* Anthropic API key (password field, "remember on this device"
     toggle - off = sessionStorage only, "Test key" button that makes one tiny
     request), model (Opus 5.5 default, Opus 5, Sonnet 5, Haiku 4.5, custom id),
     effort (low / medium / high), content rating.
   - *World:* seed (blank = random, shown after generation so it can be copied),
     tone, land, main threat - each "random" or pinned.
   - *Narration:* voice on/off, voice picker (device voices, best first), speed,
     text speed when voice is off; phase 2 adds provider (built-in / OpenAI /
     ElevenLabs) + key + voice.
   - *Pictures:* code-drawn / AI art (phase 2) + key.
   - *Sound:* music volume, effects volume (mute lives here, not in chrome).
   - *Speech input:* language, "send when I stop speaking".
   - *Appearance:* auto / parchment / night.
   - *Data:* export all saves, import, delete all (confirm).
   Explanatory text is allowed here (opt-in panel), kept short.
3. **Tale screen** (after a 1.2 s crossfade from the title). Portrait layout:
   scene plate (~38% height) with the location name on a ribbon; the narration
   scroll below it (each GM passage opens with an illuminated drop cap; player
   lines in italic with the speaker's name rubricated; dice results as small
   inline d20 chips, e.g. "Perception 14 vs 12 - success"); bottom input bar with
   speaker chips (party members + "All"), text field ("What do you do?" as the
   placeholder, in-fiction), mic button (only if supported), send. Landscape: the
   plate goes left, the scroll right.
4. **Character creation** happens in the tale: after the opening, the GM asks who
   is at the table; the `create_character` tool builds each sheet (engine
   validates class, array, kit); "surprise me" -> `suggest_character` returns a
   seeded pregen the GM presents. Speaker chips appear as characters are created.
5. **In-game menu** (ribbon): Save (slot picker), Load, Chronicle, Party, Settings,
   Title (confirm; autosave already holds the game).
6. **Chronicle:** the player-facing view of the ledger - Places (visited, with
   their plates), People (met, disposition), Quests (acts + notes), Items, and the
   Dice log. Read-only.
7. **Load:** Autosave + three slots, each showing party names, location, in-game
   day, real date, play time, plate thumbnail; per-slot Export; Import file.
8. **Ending:** triggered by the engine when the main quest completes or the whole
   party is dead: epilogue narration, then "Continue adventuring" / "Title".

### World generation (deterministic)

- Seed string -> `cyrb128` -> independent `sfc32` streams: `world`, `names`,
  `dice`, `scene`. Random seed = three words from a word table + 2 digits (e.g.
  `amber-wolf-lantern-42`), shown in Settings and on the Load card.
- Tables (v1, extendable data arrays at the top of the script): tone (heroic,
  grim, whimsical, mystery), land (coast, marsh, highlands, deep forest, desert,
  frozen north, river valley, underdark), threat (cult, dragon, lich, bandit
  lord, fey court, plague, giant, rival wizard), MacGuffin, factions, ~20 NPC
  archetypes (role, traits, want, secret), 3-4 name cultures (syllable tables),
  ~24 location kinds, ~12 inciting incidents, weather by land and season.
- Output: the **world bible** - region name, land, tone, season, threat (name,
  nature, lair, goal, three escalation stages), MacGuffin, 2-3 factions, a
  starting settlement plus 8-12 locations as a graph (id, name, kind, summary,
  exits, danger, secret, SceneSpec), 8-12 NPCs (id, name, role, home, traits,
  want, secret, disposition), the main quest as three acts (goal + key
  places/NPCs per act), and the opening situation. Same seed -> byte-identical
  bible (stable key order in serialization).
- Settings pins (tone, land, threat) are inputs to the generator, stored in the
  save, so a pinned + seeded world is reproducible.

### Engine: state, events, rules

- `state = {v, seed, pins, bible, party[], locations{}, npcs{}, foes{}, quests{},
  facts[], time{day, minute}, weather, here, scene, combat, flags{}, summaries[],
  turn, counters{roll, name, id}}`.
- Every change is an **event** `{turn, type, args, result}` applied by a pure
  reducer `apply(state, event)`. `replay(seed, pins, events)` rebuilds the state;
  a debug assertion (and the drive suite) checks replay == live.
- **Turn atomicity:** events from one player turn are staged and committed only
  when the GM turn completes; a failed turn (network, 5xx after retries,
  refusal) rolls back to the pre-turn state and the player's line stays in the
  box for re-send.
- **Rules (5e-lite):** STR/DEX/CON/INT/WIS/CHA, mod = floor((score-10)/2),
  proficiency +2, standard array or seeded roll; six classes (Fighter, Rogue,
  Wizard, Cleric, Ranger, Bard) with hit die, proficient skills, kit, and 1-2
  signature abilities with uses per rest. Checks: d20 + mod (+ prof) vs DC
  (10/15/20), advantage/disadvantage, natural 20/1. Combat: `start_combat` rolls
  initiative; `attack` resolves to-hit vs AC and damage dice; foes come from a
  ~16-entry bestiary (AC, HP, attack, damage, XP); 0 HP -> down, three failed
  death saves -> dead. Short/long rest restore HP and ability uses and advance
  time.
- **Validation:** the reducer rejects illegal events with a reason string that
  goes back to the GM as an `is_error` tool result (moving to a non-adjacent
  place, spending gold not held, acting with a dead character, unknown ids).
- **Canon retrieval:** facts are `{id, subject, text, turn}`. Each turn the
  engine injects the facts for the current place, NPCs present, active quests,
  and keyword matches against the player's line (deterministic scoring, capped
  at ~40 facts / ~2k tokens). The GM can also call `lookup`.

### GM tools (declared in full on every request, stable order, `strict: true`)

`roll_check`, `roll_dice`, `move_party`, `create_location`, `record_fact`,
`create_npc`, `update_npc`, `create_character`, `suggest_character`,
`update_character` (HP delta, conditions, XP, level), `give_item` /
`take_item` / `adjust_gold` (one tool with an op field is fine), `start_combat`,
`attack`, `end_combat`, `rest`, `advance_time`, `update_quest`, `set_scene`,
`lookup`, `end_scene` (writes the rolling summary). Names are the contract for
the prompt and the mock; exact schemas are the implementer's. Names the GM does
not give (NPCs, places) come from the seeded name generator so they are
reproducible.

### GM client (raw HTTP)

- Endpoint `POST https://api.anthropic.com/v1/messages`, streaming SSE, headers
  `x-api-key`, `anthropic-version: 2023-06-01`, `content-type`,
  `anthropic-dangerous-direct-browser-access: true` (source: memory - verify
  against current docs before relying on it), plus `anthropic-beta` for the
  features below where the model profile allows them.
- **Raw `fetch`, not the SDK:** the repo forbids external JS libraries and has no
  bundler (root `CLAUDE.md` § Code style). The claude-api skill's `curl/`
  examples are the wire-format reference.
- **Model profiles** (table in code): `claude-opus-5-5` (default), `claude-opus-5`,
  `claude-sonnet-5`, `claude-haiku-4-5`, custom. Per profile: sends
  `output_config.effort` or not (Haiku 4.5 errors on effort), thinking mode
  (adaptive / omitted field; never `disabled` or `budget_tokens` on Opus 5.5 -
  both 400), and whether `fallbacks: "default"` + `server-side-fallback-2026-07-01`
  is sent.
- **Request per player turn:** a fresh conversation. `tools` (full set) ->
  `system` (GM persona, rules digest, tool etiquette, Grimoire prose style,
  content rating; `cache_control`) -> `messages[0]` user content blocks: the
  **world bible** (byte-stable; `cache_control`), then the volatile **turn
  context** (state snapshot: party sheets, place, present NPCs, quests, time,
  weather, combat; canon hits; rolling summaries; last ~8 exchanges as a plain
  transcript), then the player's line tagged with the speaker. History from
  earlier turns is never replayed as assistant messages, so no earlier thinking
  block is ever sent back.
- **Tool loop inside a turn:** append-only. Append the assistant content
  unchanged (thinking blocks included) and one user message holding every
  `tool_result`, loop until `end_turn`, cap 8 iterations. `tool_choice` is always
  `auto` (forced `any`/`tool` 400s on Opus 5.5).
- `max_tokens` 16000 (thinking counts toward it); streaming always on.
- Stop reasons: `refusal` -> in-fiction line ("The vision clouds; try another
  approach") + rollback; `max_tokens` -> keep whatever narration arrived, log it;
  `end_turn` with no text -> one follow-up request asking for the narration.
- Errors: 401/403 -> "key rejected" + open Settings; 429/529/5xx -> two retries
  with backoff then an in-fiction pause message; offline -> same.
- A 400 that names `fallbacks` (the permitted targets for Opus 5.5 were open at
  launch) -> retry once without it and remember that for the session.

### Narration pipeline

- Only `text` blocks are narration. Streamed text -> sentence splitter -> queue.
  Each sentence is spoken as its own `SpeechSynthesisUtterance`; its words are
  revealed at speaking pace, driven by `onboundary` when the platform fires it,
  else by a words-per-minute estimate from the rate. Voice off -> reveal at the
  text-speed setting.
- Tap anywhere on the narration -> finish the reveal and stop speech. Pressing the
  mic also stops speech (barge-in). Music ducks while speaking.
- Web Speech voice pick: prefer voices whose names mark premium quality
  ("Premium", "Enhanced", "Natural", "Neural") in the player's language; the
  player can override. Voices load async (`voiceschanged`).

### Speech input

`window.SpeechRecognition || window.webkitSpeechRecognition`; tap mic to start,
tap again or silence to stop; interim results stream into the text box; final
text stays for editing (auto-send off by default). No support -> the mic button
is not rendered (no caption).

### Scene plates (code-drawn woodcut)

- `SceneSpec = {kind: outdoor|indoor|underground, land, time: dawn|day|dusk|night,
  weather: clear|rain|fog|snow|storm, features: [<=4 from a fixed vocabulary:
  tower, castle, ruin, cave, tree, forest, river, lake, sea, ship, bridge,
  village, hearth, altar, statue, door, stairs, throne, crypt, mountain, moon,
  campfire, market, library], figures: [<=3: humanoid, beast, dragon, spirit,
  crowd], mood}`. Validated by the engine; unknown values dropped.
- Stored on the location the first time it is set; revisits reuse it, so a place
  always looks the same. Canvas 2D: parchment ground, layered ink silhouettes,
  hatching for shade, one accent (vermilion or gold), a manuscript border; seeded
  by location id. Rendered once to an offscreen canvas and cached; weather and
  firelight may animate as a light overlay.

### Saves

- IndexedDB store `cyoa` (saves can outgrow localStorage over a long campaign);
  settings in localStorage (`cyoa.settings.v1`); the API key in localStorage only
  when "remember" is on, else sessionStorage.
- A save = `{v, seed, pins, events[], transcript[], summaries[], meta}`; loading
  replays events. Autosave after every committed turn. Export = a `.cyoa.json`
  download of a slot; import validates `v` and replays it before accepting.
  Exports never include keys.

### Style: Grimoire (new named style)

- Tokens (parchment): vellum `#efe3c8`, vellum-shade `#e3d3ae`, ink `#2a1d12`,
  faded ink `#5a4632`, rubric vermilion `#a5301f`, gold leaf `#b8892b`
  (gradient for gilding), lapis `#27456e`, verdigris `#3f6f5f`. Night reading:
  ground `#1b140d`, ink `#e8d9b8`, same gold and rubric (lightened for contrast).
  Final values are task 1's call; contrast >= WCAG AA for body text.
- Fonts: Cinzel (headings, plaques), IM Fell English (body; italic for player
  lines), Cinzel Decorative (title, drop caps). Google Fonts.
- Components: deckled parchment panel, illuminated drop cap, rubricated headings,
  rubric plaques as buttons (ink border, small caps, gilded underline on hover,
  inked pressed state), d20 result chip, bookmark-ribbon menu, page-turn
  crossfade.
- Avoid: neon, glow, monospace, pill buttons, numbered "01/02" labels.

## Steps

1. **Style spec.** Write `.claude/styles/grimoire.md` (token blocks for parchment
   and night, fonts, components, rules) and add its row to
   `.claude/styles/README.md` ("Used by: `games/cyoa/`"). Done: file exists; README
   row present.
2. **Page shell.** `games/cyoa/index.html`: badge (real UTC time), Grimoire CSS,
   favicon (inline-SVG wizard head), title screen with the four plaques and EXIT
   link, 2x reload button top-right (behavior copied from croissant-clicker's
   force reload), Settings panel persisted to `cyoa.settings.v1`, crossfade to an
   empty tale screen, WebAudio init on first gesture with a quiet ambient loop
   and SFX (page turn, dice) per the Audio convention minus the chrome mute
   button. Done: smoke GREEN; buttons navigate; settings survive reload.
3. **Engine.** PRNG + seed words, tables, world generator, state/reducer/events,
   rules, validation, replay, retrieval, exposed on `window.CYOA.engine` for
   tests. Done: same seed -> identical bible hash across reloads; different
   seeds differ; replay == live after a scripted 30-event session; illegal
   moves rejected with reasons.
4. **GM client.** Everything in § GM client, plus the system prompt and the
   tool schemas, exposed as a provider interface `{runTurn(context, onText,
   onEvent)}` so task 8's mock can replace it. **Before writing it, load the
   claude-api skill and read `curl/examples.md`, `shared/tool-use-concepts.md`,
   `shared/prompt-caching.md`, and `shared/model-migration.md` § Migrating to
   Claude Opus 5.5.** Done: the mock-driven flow (task 8) passes; a "Test key"
   with a bad key shows the key-rejected state.
5. **Narration + speech input.** § Narration pipeline and § Speech input. Done:
   reveal completes with voice on and off; tap skips; mic hidden when the API is
   missing.
6. **Scene plates.** § Scene plates + the title frontispiece. Done: the same
   location id + spec renders identical pixels across reloads (hash the canvas);
   every feature and figure in the vocabulary draws without error.
7. **Tale UI + saves.** Tale screen, speaker chips, in-game menu, Chronicle,
   Party sheets, Load screen, autosave, slots, export/import, ending screen.
   Done: save -> reload page -> load gives a state deep-equal to the saved one.
8. **Mock + drive suite.** A mock provider selected only by a test hook
   (`window.__CYOA_MOCK__` set via `page.addInitScript`; never via a URL param
   a visitor could hit) that replays scripted turns: tool calls + narration.
   `.claude/tests/drive-cyoa.cjs` covers § Validation. Register it in
   `.claude/tests/README.md`. Break each guarded behavior on purpose through
   `.claude/scripts/negtest.sh save|restore` and confirm the suite goes red row
   by row.
9. **Catalog + docs.** Hub card as the FIRST `.game-card` in `games/index.html`
   (icon 🧙, name CYOA, description <= 2 sentences and <= 24 words; draft: "An AI
   game master spins a seeded world, narrates it aloud and remembers everything.
   Speak or type what your party does." = 21 words), `GAMES[]` entry, games-index
   row (first in the catalog) + coverage-summary refresh (new facet values
   likely: genre `tabletop-rpg`, input `voice` + `text-entry`, mechanics
   `llm-game-master`, `seeded-determinism`, `dice-rolls`; players `solo` +
   `local-coop` - reuse existing values where they fit, per the facet
   vocabulary), `.claude/cyoa.md` context file, `games/cyoa/LICENSE` (proprietary,
   copy the wording from `games/interlock/LICENSE` minus the Three.js carve-out),
   root `CLAUDE.md` (licensing: six -> seven protected games + list;
   context-file table row; project-structure bullet), `games/CLAUDE.md`
   (inventory entry; add CYOA to the Hub Back Button "Excluded" list with the
   reason). Restamp the badge with `.claude/scripts/stamp-badge.sh` and read it
   back. Done: all three gates GREEN.
10. **Phase 2 - premium voice.** Provider adapter behind the task 5 voice
    interface: OpenAI TTS (model and voice ids verified at implementation time)
    and ElevenLabs, each with its own BYO key. Audio clips per sentence; reveal
    synced to `audio.currentTime`; clips cached per passage in IndexedDB so a
    replay of a passage costs nothing. Falls back to built-in voice on any error.
11. **Phase 2 - AI scene art.** Provider adapter behind the task 6 plate
    interface: OpenAI Images with a BYO key; prompt built from the SceneSpec +
    place summary + a fixed Grimoire woodcut style suffix; cached in IndexedDB
    by location id so a revisit shows the same picture; the code-drawn plate
    shows while it loads and on any error.

## Gotchas / bindings

- **Documented exceptions** (CD request 2026-09-25; record each one in
  `.claude/cyoa.md` and where the convention lives):
  - No top-left back / mute / settings chrome. EXIT on the title page is the way
    back. Add CYOA to `games/CLAUDE.md` § Hub Back Button "Excluded".
  - Reload button top-right at 2x the standard chrome size (standard ~38x30 ->
    ~76x60), placed **below** the build badge (`top` >= 14px +
    safe-area) so the badge stays readable. `z-index` above every overlay.
  - Grimoire style, not Neon Arcade.
  - DOM-first page: text, menus and chrome in DOM/CSS; Canvas 2D only for scene
    plates and the frontispiece (Music Mixer is the precedent for DOM rendering).
  - First game that calls an external API at runtime.
- **Security:** never put model output or save-file text into `innerHTML`; use
  `textContent` / DOM construction only. The API key is in the same origin, so an
  injected element could exfiltrate it. Add a CSP `<meta>` restricting
  `connect-src` to `https://api.anthropic.com` (plus the phase-2 hosts when
  added), and `img-src 'self' data: blob:`. **The smoke gate fails on console
  errors, and a CSP violation is one** - allow Google Fonts in `style-src` /
  `font-src` and re-run smoke after adding it.
- The key never appears in the DOM outside the password field, in exports, in
  console logs, or in error messages shown on the page.
- **Opus 5.5 API rules** (source: claude-api skill, `shared/model-migration.md`):
  thinking can't be disabled (no `disabled`, no `budget_tokens`); forced
  `tool_choice` 400s; effort default is `medium`, so set it explicitly; text the
  model writes between tool calls can come back as empty `thinking` blocks - so
  the system prompt must say "make all tool calls first, then write the
  narration as your final reply", and the client renders only `text` blocks;
  thinking blocks are passed back unchanged inside the tool loop; the full tool
  set is declared from the first request of every turn and never changes.
- **Prompt caching:** the cached prefix is tools + system + world bible. Any byte
  change there (timestamps, unsorted keys, a per-turn value) silently kills the
  cache - keep the state snapshot, canon and transcript **after** the last
  breakpoint. Check `usage.cache_read_input_tokens` > 0 on turn 2 during the CD
  playtest (log usage to the console in a debug mode).
- Replay determinism: the dice stream is indexed by a counter stored in state,
  never by wall-clock or call order across async boundaries.
- iOS Safari: `speechSynthesis` must first be triggered inside a user gesture -
  prime it on the NEW tap. Long utterances can stop early on some engines
  (source: memory), which is another reason for per-sentence utterances.
- `SpeechRecognition` needs a secure context and mic permission; the prompt is
  the browser's own, so no pre-permission caption.
- Discovery rule: no hint text on the title or tale screens. Allowed text: the
  in-fiction placeholder, the key-needed line in Settings (refusal case), and the
  Settings panel itself (opt-in).
- The hub card goes FIRST; `check-games-sync.cjs` checks card <-> `GAMES[]` <->
  index agreement, not order, so verify the order by eye.
- Concurrent sessions push to `main`: follow root `CLAUDE.md` § Git workflow
  (fetch + re-check immediately before every push; merge into the branch, never
  author a merge on `main`).

## Validation

- `node .claude/scripts/smoke-mobile.cjs games/cyoa/index.html games/index.html`
  -> `SMOKE: GREEN`.
- `node .claude/scripts/check-games-sync.cjs` -> `GAMES-SYNC: GREEN`.
- `node .claude/tests/drive-cyoa.cjs` -> GREEN, covering at least:
  title has NEW/LOAD/SETTINGS/EXIT and EXIT points at `../index.html`; no
  `#back-btn` / `#mute-btn`; reload button top-right, >= 60px tall, below the
  badge; NEW without a key opens Settings at the key field; with the mock, NEW
  crossfades and narration text appears; same seed -> same bible hash, different
  seed -> different; illegal `move_party` returns an error result and state is
  unchanged; a failed turn rolls back; replay == live; revisiting a place reuses
  its SceneSpec and plate hash; save -> page reload -> load deep-equals;
  export -> import round-trips; tap-to-skip finishes the reveal; mock narration
  containing `<img src=x onerror=...>` creates no `img` element; the key string
  never appears in `document.body.innerHTML` or in an export.
- Negative tests via `negtest.sh` for each row above that guards behavior.
- `pages-status.cjs` / Pages workflow green for the pushed SHA (per
  `.claude/zmh/producer.md` § Publish).
- **Beyond gate-green (CD playtest, own key):** see Implementation guidance
  "Playtest".

## Follow-ups

- Offline "chronicler" mode: a scripted, template-based GM so visitors without a
  key can play a short seeded vignette.
- Optional server proxy (Cloudflare Worker holding the CD's key, with rate
  limits) as an alternative to BYO key.
- More world tables (lands, threats, cultures) and a bigger bestiary; levelling
  beyond level 5.
- Initiative tracker UI / battle map for combat.
- Cost meter in Settings from `usage` (tokens and an estimate per session).
- Effort sweep (low vs medium) on latency and consistency after the first
  playtest.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/cyoa.ai-gm-adventure.md
```
