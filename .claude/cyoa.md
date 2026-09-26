# CYOA — context

`games/cyoa/index.html` (single file, ~4,000 lines). A tabletop RPG in the spirit of
D&D where **Claude is the Game Master**: a seed generates a world, the GM narrates it
(text revealed in step with a narrator voice), players type or speak, and every change
to the world goes through a **deterministic engine** that validates it, logs it, and
feeds the recorded canon back to the GM so revisits stay consistent. CD commission,
2026-09-25. Plan (implemented, archived): `.claude/plans/DONE/cyoa.ai-gm-adventure.md`.
Lessons and root causes: `.claude/notes/20260926-cyoa-ai-gm-lessons.md`. Suite:
`.claude/tests/drive-cyoa.cjs` (165 checks). Style: **Grimoire**
(`.claude/styles/grimoire.md`). **Proprietary** (`games/cyoa/LICENSE`).

## CD decisions (2026-09-25 interview) — do not relitigate

- **Bring-your-own Anthropic key**, stored in the browser (localStorage when
  "remember" is on, else sessionStorage), sent only to `api.anthropic.com`. No server.
- Default model **Claude Opus 5.5** (`claude-opus-5-5`); Settings offers Opus 5,
  Sonnet 5, Haiku 4.5 and a custom id. Default effort `medium`.
- **Cost ledger** (CD request, 2026-09-25): every paid call is priced in US dollars as
  it happens, saved in the game's save, and listed from a $ button on the Load screen.
  The CD will experiment with models and may later script more of the GM or pin some
  tasks to Haiku; per-task model routing is the first step (see Costs below).
- Scene pictures **code-drawn** (woodcut plates) by default; **painted by OpenAI** is an
  opt-in on the player's own OpenAI key.
- Narrator: **built-in speech synthesis** by default; **OpenAI** or **ElevenLabs** voices
  are opt-ins on the player's own keys.
- Characters are **created by talking with the GM** (`create_character`,
  `suggest_character` for "surprise me").
- Story: a **seeded main quest in three acts inside an open world**; victory or a
  party wipe runs an epilogue and opens an ending screen; play may continue.
- Title: NEW / LOAD / SETTINGS / EXIT. **No top-left back/mute/settings chrome**;
  EXIT is the way back. **Reload button top-right at 2x** (76x60), below the badge.
- Hub: the **first** card, icon 🧙.

## CD decisions (2026-09-26, second round) — do not relitigate

- **A new picture after every Game Master reply** (the free woodcut: a new framing plus
  a moment inset); a paid painting changes **per topic change**, not per reply.
- **The clock moves a realistic amount with every interaction.**
- **Every line of the party sheet opens a popup** that closes on a tap outside it.
- **Selected story text goes to a Notes page verbatim**, one bullet per selection; the
  page also takes typed notes and removes old ones.
- Asked whether an Anthropic key can make better voices: **no**, the API has no speech
  output (source: the claude-api skill). The CD will try the OpenAI voice later.
- **Open, CD undecided (2026-09-25):** which GM tasks to script or pin to Haiku. They
  first want to experiment with models using the cost ledger. Ask again once they have
  cost history to look at; per-task routing (Costs below) is where it plugs in.

## Documented exceptions to repo conventions

| Convention | Here | Why |
|---|---|---|
| Hub back button + mute top-left | None; EXIT on the title; mute is the Settings volume sliders | CD request |
| Neon Arcade style | Grimoire | CD request: "a new distinct style" |
| Canvas 2D for everything | DOM/CSS page; Canvas 2D only for plates + frontispiece | a text game; music-mixer is the DOM precedent |
| No network | Calls `https://api.anthropic.com/v1/messages`; optionally `api.openai.com` (speech, images) and `api.elevenlabs.io` (speech). All three are the only `connect-src` hosts in the CSP | the game is an LLM conversation; the rest are opt-ins |
| No external JS | Raw `fetch` + a hand-written SSE parser, no SDK | no bundler here; the claude-api skill's `curl/` examples are the wire reference |

## Architecture (sections in the script, in order)

`UTIL / PRNG / TABLES / WORLD / ENGINE / CONTEXT / GM / NARRATION / SPEECH-IN / AUDIO /
PLATES / COSTS / PREMIUM / STORAGE / SESSION / UI / BOOT`

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
  which the page treats as voice off; section O of the suite fakes an iPhone engine.
- **Device voice choice** (`Speech`). Apple gives a downloaded voice a plain name
  ("Zoe") and keeps its tier in the id (`com.apple.voice.premium.en-US.Zoe`), so
  `Speech.quality()` reads name AND `voiceURI`; the novelty filter (eloquence etc.) does
  too, but "compact" is only penalised by name (every stock iPhone voice is compact, and
  penalising the id would rank another language above them). "Best available" =
  language, then tier (Premium > Enhanced/Natural), then `v.default` as a tiebreak so the
  device's own choice wins within a tier. The game always sets `u.voice`, so the phone's
  system voice setting only matters through that tiebreak - except under the list's
  second entry, "This device's own voice setting" (`voiceURI: 'system'`), where
  `pick()` returns null and the utterance carries no voice and no language, so the
  device decides. That entry exists because the CD's downloaded Jamie (Premium) never
  appeared in the list (2026-09-25): Safari appears to hide downloaded voices from pages
  (assumed: anti-fingerprinting). Whether the device default then speaks in it is
  unverified. The list is re-read on every
  Settings open, on returning to the tab and at every `pick()`: iOS may not fire
  `voiceschanged` for a voice downloaded while the page is open.
- **Plates.** `Plates.specFor(st)` = `{id, k, land, season, f, fig, tod, wx, v, m, ms}`; a
  place's `scene` (`k` + features) is fixed at creation, so a revisit shows the same
  scenery. Placement PRNG is seeded by the place id. Cached (8) at 1.25x.
  **A new picture after every reply** (CD, 2026-09-26): `v` picks one of five `VIEWS`
  framings (`st.turn % 5`; wide for an arrival, the low wide view for a fight), and `m`/`ms`
  is the turn's **moment**, drawn by `drawMoment()` as a woodcut roundel in the canvas's
  top-right corner **at blit time** (so it survives any crop). Moments come from the
  engine: `exec` calls `noteScene()` after every accepted call, which keeps the turn's
  most dramatic moment by `MOMENT_PRI` (battle > fallen > magic > check > quest > item >
  person > rest > arrive) in `st.scene.moment = {k, sub, turn}`; `specFor` shows it only
  while `moment.turn === st.turn - 1`, so it lasts exactly one reply. `momentIcon()` maps
  kind + subject (item name, skill label, `ability|heal`) onto one of 26 `ICON` drawers.
  Because moments live in the state and come from the logged calls, a reload or replay
  draws the same picture. The plate fades (260 ms) on every change.
- **Premium voice** (`Premium`). When the narrator is OpenAI or ElevenLabs and that key
  is set, `Narrator.enq()` starts each sentence's audio request **as the sentence is
  queued** (pool of 3), so the clip is usually decoded before its turn; `playBuf()` plays
  it through `AudioSys.voice` (WebAudio, which the NEW tap already unlocked on iOS) and
  reveals words in proportion to playback time. Any error -> one toast, `Premium.failed`
  for the session (reset by changing the provider or key), and the device voice / text
  takes over mid-passage. OpenAI: `POST /v1/audio/speech`, `gpt-4o-mini-tts`, voice
  default `cedar`, `instructions` = `NARRATOR_STYLE`. ElevenLabs: `POST
  /v1/text-to-speech/{voice}`, `xi-api-key`, `eleven_multilingual_v2`.
- **Painted pictures** (`Art`). `POST /v1/images/generations` (`gpt-image-2` default,
  editable; 1536x1024, quality medium), prompt = place name, summary, kind, land,
  season, up to 4 canon facts about the place, plus a fixed woodcut house style. The PNG
  is re-encoded to JPEG and stored in IndexedDB store `art` keyed `seed|placeId|topic`,
  and in memory as a decoded image: **one painting per topic** (CD, 2026-09-26; a
  painting costs ~$0.04, so not per reply). `st.scene.topic` turns over on `end_scene`,
  `start_combat`, `end_combat` and a `set_scene` that changes who is in view or the mood
  (not on `move_party`: a new place is a new key anyway, and a return within the topic
  reuses the painting). The prompt adds the moment and who is in view (`Art.moment`).
  Paintings are asked for only for a **finished reply's** state (`st === G.st && st.turn >
  0`): never the blank page before the opening (the opening's `set_scene` would make it a
  wasted $0.04 at once) and never the mid-turn copy. The moment roundel is drawn over
  the painting too. The woodcut draws first and the painting replaces it when ready;
  `UI.plateToken` is the only "is this still the current plate" check (checking
  `G.st.here` was a bug: during a turn the plate is drawn from the uncommitted copy).
  Paintings are a cache: not in saves or exports; "Delete all" clears them.
- **Saves.** IndexedDB `cyoa/saves` (autosave + 3 slots), localStorage then memory as
  fallbacks. Save = `{format:'cyoa-save', v:1, seed, pins, bible, events, transcript,
  turn, endingAck, costs, notes, meta}`; load = replay. Export/import = the same JSON.
  Keys are never in a save.
- **Clock.** Every player exchange takes time: after the turn, unless the GM already
  moved the clock (`move_party`, `rest`, `advance_time`) or characters are being made,
  `exchangeMinutes()` adds 2 min + 1 per 60 narrated words + `CHECK_MINUTES` per
  `roll_check` (investigation 15, survival 20, ...), or 1 min per reply in a fight, capped
  at 120. It is executed and **logged as an ordinary `advance_time` event** (`auto: true`),
  so replay lands on the same minute. The system prompt tells the GM this happens, so it
  uses `advance_time` only for longer activities. The header shows `hudClock()` (short,
  one line); the engine's `clockText()` stays unchanged because tool results carry it.
- **Party sheet.** Every score, save, skill, attack, ability, item, HP, Armour, level,
  class and condition is a `.term` button; `termInfo(c, kind, key)` writes the popup from
  `ABIL_INFO` / `SAVE_INFO` / `SKILL_INFO` / `COND_INFO` / `CLASS_INFO` / `ITEM_INFO` plus
  this character's numbers, computed the way the engine computes them (keep them in step
  when a rule changes). `Pop` is a centred dialog over its own scrim: a tap outside
  closes it and is swallowed; Escape closes it before the page under it.
- **Notes.** `G.notes = [{id, text, src: 'story'|'mine', at}]`, saved with the tale. A
  selection inside `#scroll` raises the fixed "+ Note" button just under it (clamped on
  screen, repositioned on scroll); it acts on **pointerdown** with `preventDefault` so the
  tap does not collapse the selection first. The text comes from `rangeText()` (the DOM
  text, paragraphs joined by line breaks): `Selection.toString()` follows the rendering,
  and the drop cap's float swallowed the space after it ("Awolf"). The Notes page edits
  in place (textarea per bullet, autosave on blur), removes with the cross, and drops
  empty notes when it closes. Notes are text only (`textarea.value`), never markup.

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

## Costs (the ledger)

`G.costs` is a list of entries `{at, turn, kind, task, desc, model, usd, calls, est,
tok?, secs?, chars?, failed?, unknown?}`, saved as `costs` in every save (plus
`meta.usd` for the slot list) and run through `Costs.sanitize` on load and import.

- **Claude is exact**: `Costs.claude(model, usage)` = usage from each reply x the list
  price of the model that **served** it (`message_start.message.model`, so a server-side
  fallback is billed at the fallback's price). Cache writes at 1.25x input (5-min) or 2x
  (1-hour, from `usage.cache_creation`); reads at 0.1x. One `gm` entry per turn, summing
  every request of its tool loop. A **failed turn is still billed** (its tokens were
  spent) and marked `failed`; a stream that dies after `message_start` carries its usage
  out on the thrown `GMError` so it is billed once. A 401 has no usage and costs nothing.
- **Voice and pictures are estimates** (`est: true`, shown with `~`): OpenAI
  `gpt-4o-mini-tts` = text tokens (chars/4, plus `NARRATOR_STYLE`) at $0.60/M + audio at
  $0.015/min of decoded clip; `tts-1` $15/M chars, `tts-1-hd` $30/M; ElevenLabs $0.10 per
  1k chars (Flash/Turbo $0.05). One voice entry per passage, growing per sentence. A
  picture is billed from the reply's `usage` when present (gpt-image-2 $5/M text in,
  $8/M image in, $30/M image out), else a flat ~$0.041 (gpt-image-1: $0.063).
- Prices live in `CLAUDE_PRICES` / `Costs.speech` / `Costs.image`, checked
  `PRICES_CHECKED` = 2026-09-25 (sources: the claude-api skill's model table for
  Claude; OpenAI and ElevenLabs pricing pages). An unknown Claude model id is recorded with
  its tokens and `unknown: true` and shown as `$?` - update the table rather than guess.
- **Where it shows**: the header total (`#cost-btn`, opens the history), a line under
  each passage (`.cost-tag`, per turn: GM cost, models, calls, voice, picture), the
  menu's Cost history, and a $ plaque on every Load slot. The history panel has totals
  by kind and by model, an average per player turn, and a CSV export. Settings > Show
  what each turn costs hides the tags and the header button (the ledger still records).
- **Per-task models**: `Settings.data.taskModels = {opening, turn, epilogue}`; empty =
  the main model. `taskSettings(kind)` is the only place a request picks its model. To
  pin another task to Haiku or script it, split it into its own `gmTurn` kind (or a
  deterministic path that never calls the provider) and add a row there.
- Rough scale (inferred, not measured): Opus 5.5 at medium effort, $0.03-0.10 per
  player turn. `debug: true` in `cyoa.settings.v1` still logs raw usage per request.

## Unverified here (no keys in the build container)

The OpenAI speech/images and ElevenLabs request shapes were checked against their docs
on 2026-09-25 and exercised against stubs, never live. Two things are assumptions until
the CD's first try: that ElevenLabs answers browser (CORS) requests on a plain API key
(its docs recommend single-use tokens for client-side use), and that the default
ElevenLabs voice id `JBFqnCBsd6RMkjVDRZzb` is still a stock voice. Either failure falls
back to the device voice with a toast naming the error.

Also unverified: whether iOS Safari lists downloaded Enhanced/Premium voices in
`getVoices()` at all, and whether their names carry the tier. The code handles both
shapes; if Safari hides them, no page can use them. The CD's Jamie (Premium) did NOT
appear (2026-09-25); whether "This device's own voice setting" then speaks in it is
the open question. Also unverified on a real iPhone: that the "+ Note" button's
`pointerdown` keeps the native selection alive next to iOS's own Copy callout
(verified in headless Chromium only).

## Follow-ups (not built)

An offline scripted GM for visitors without a key; an optional server proxy; more world
tables and a bigger bestiary; an initiative tracker UI; more moment kinds (a portrait per
NPC role, a clue still life for `record_fact`); an effort sweep
after the first playtest; caching premium audio per passage (nothing replays a passage
yet, so it would buy nothing today).
