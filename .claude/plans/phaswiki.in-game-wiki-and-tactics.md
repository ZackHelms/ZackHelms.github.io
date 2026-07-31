# phaswiki — Phasic in-game wiki (cogwheel entry, searchable topic pages) + tactics #10–11

**Status:** DRAFT
**Requested:** 2026-07-31 (CD, verbatim with the playtest sign-off: "add to
tactic list what i have to do in lv 13 where i push a liquid object with a
solid object. Create a wiki for this game (accessible via cogwheel menu)
with a home page with links to specific pages for this game (all within the
phasic subdir) like tactics page, and other pages that make sense, with a
search textbox on top right (under the standard reload button").
**Scope:** `games/phasic/wiki.html` (new), `games/phasic/index.html`
(settings overlay + badge), `.claude/tests/drive-phasic.cjs`,
`.claude/phasic.md`, `games/CLAUDE.md` (Phasic blurb).

> Line references verified against commit `7700f84`; re-locate by symbol.
> Runs after the other phasic plans in the burndown — expect line drift in
> `index.html`.

## Goal

A player-facing wiki ships inside `games/phasic/`: a WIKI button in the
cogwheel settings menu opens `wiki.html` — home page of topic links, a
tactics page carrying the full registry (now 11 entries: the CD's
push-a-liquid-with-a-solid move from L13 Queue, plus the launch-and-freeze
acrobatics move the CD discovered on L29, marked advanced), a live search
box top-right under the reload button. The new tactics are also recorded in
the `.claude/phasic.md` registry, and the shove mechanic they rely on gains
a drive-suite guard.

## Context

The tactics registry (`.claude/phasic.md:118-138`, 9 entries) is CD-managed
canon but invisible to players. The CD's L13 move: in Queue (menu L13 =
curriculum index 12 = `AUTH[12]` = `LEVELS[11]`, `index.html:403`), a
dragged solid shoves liquid particles aside (`moveSolid`'s fluid-shove
block, `:636-640`) — the player pushes a puddle with a stone to move liquid
where gravity won't take it. The wiki makes the registry (and the rest of
the game's ideas) discoverable in-game.

## Implementation guidance (for the overseer)

Tiers assigned under the **balanced** profile (no local task-scoping skill;
zmh-producer scaffold rubric).

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Record tactics #10–11 in `.claude/phasic.md` | docs | haiku | low | verbatim content below |
| 2 | Build `games/phasic/wiki.html` (hash-routed pages, search, house chrome) | single-system code | sonnet | high | content authoring + UI judgment inside clear conventions |
| 3 | WIKI button in the settings overlay | mechanical-edit | haiku | medium | verbatim content below; exact target |
| 4 | Suite + gates: wiki DOM checks, shove-mechanic guard, smoke on both pages | tests | sonnet | high | new page checks + a physics assertion need judgment |
| 5 | Docs + badges | docs | haiku | low | enumerated edits |

- **Ordering / dependencies:** 1 → 2 → 3 → 4 → 5 sequential (task 2's
  tactics page transcribes task 1's registry text).
- **Files owned per task:** 1: `.claude/phasic.md`; 2: `games/phasic/wiki.html`;
  3: `games/phasic/index.html`; 4: `.claude/tests/drive-phasic.cjs`;
  5: `.claude/phasic.md`, `games/CLAUDE.md`, both badges.
- **Validation per task:** drive suite green after tasks 3–4;
  `node .claude/scripts/smoke-mobile.cjs games/phasic/index.html games/phasic/wiki.html`
  green at the end (`SMOKE: GREEN`).
- **Tier audit (required):** tasks 2 and 4 fail haiku checklist item 4
  (content/UI and assertion judgment); tasks 1/3/5 pass (verbatim or
  enumerated targets).
- **Decision defaults:**
  - **One file, many pages**: `wiki.html` is a single self-contained
    hash-routed page (house rule: single-file, no external libs). "Specific
    pages" = routes — `wiki.html#tactics` is a linkable page. A `PAGES[]`
    array drives everything: `{id, title, icon, html}`; adding a page =
    appending one object (mirror the `signals/` data-table pattern in
    spirit, not code).
  - Page set (v1): `home` (link cards to every other page), `basics`
    (goal, drag/fit, sockets, win rule), `phases` (flame/frost/tap
    reversion, base states), `gravity` (the well, dock, lift, gas
    herding), `obstacles` (void, hedge, fans), `tactics` (all 11, numbered,
    with the teaching level named where one exists), `levels` (curriculum
    blocks, complexity score, endless, STUCK). Write for players — no code
    or test-API references.
  - Chrome: standard topbar — ← back link to `index.html` (the game),
    title, ↻ reload button top-right (`location.reload()`); the **search
    input sits directly under the reload button**, right-aligned (CD spec).
    Search filters `PAGES[]` by title + text content live (case-insensitive
    substring; strip tags for matching), rendering result links with a
    ~90-char snippet; empty query restores the current page. Build badge
    div immediately after `<body>` per SOP.
  - Styling: house palette/fonts (`:root` vars, Black Ops One headings,
    Share Tech Mono body), dark bg, DOM-rendered (no canvas) — the wiki is
    a document, `signals/` is precedent for a DOM page in this repo.
  - The game side (task 3), verbatim — in the settings overlay after the
    STUCK button (`index.html:99`):
    `<a id="wiki-btn" class="obtn alt" href="wiki.html" style="text-decoration:none">WIKI</a>`
  - **No hub/catalog changes**: the wiki is part of the Phasic game, not a
    new game — `games/index.html`, `GAMES[]` and `.claude/games-index.md`
    are untouched, so the games-sync gate is not triggered.
  - Tactics #10 and #11 (task 1), verbatim, appended to the registry:
    `10. **Push the puddle** (taught by L13 Queue): solids shove liquid —
    drag a stone into a puddle to bulldoze it through a slot or along a
    shelf that gravity alone won't take it past.`
    `11. **Launch and freeze** (advanced — CD-discovered, 2026-07-31): shove
    a puddle hard with a dragged solid to fling it airborne, then frost it
    mid-flight so it crystallizes where it could never rest. Reserved for a
    future Acrobatics block; no earlier level may require it.`
  - iOS-port note: the wiki is content, not web-only chrome — it ports; the
    back/reload buttons on it are web-only like the game's own.
- **Embedded-content QA (required):** the task-3 snippet was written against
  the settings overlay markup (`:94-101`) and reuses the existing
  `.obtn.alt` class; the tactic text matches the registry's list format
  (numbered bold-lead entries). The wiki page text itself is authored by
  task 2 from `.claude/phasic.md` — the overseer reviews it for
  player-appropriateness (no internals) before commit.
- **Escalation triggers:** only genuine spec conflicts with the CD's wording
  (none foreseen — the hash-route interpretation is a logged decision
  default, not an escalation).
- **Playtest:** yes — CD: open cogwheel → WIKI, tap through home links,
  search "stopper" and "push", confirm the search box sits under ↻ on
  iPhone-width, back button returns to the game.
- **Publish:** default — push `main`, verify Pages `success`, state both
  badges.
- **Commit strategy:** one conventional commit per task (1+2 may merge into
  one `feat(phasic): in-game wiki` commit; 3–5 separate), scope `phasic`.

## Steps

1. Append tactics #10 and #11 (verbatim above) to `.claude/phasic.md:118-138`.
2. Build `games/phasic/wiki.html` per the decision defaults. Done-criteria:
   loads clean at iPhone 13 viewport with zero console errors; every
   `PAGES[]` entry reachable from home and from the hash directly; tactics
   page lists exactly 11 entries; search "stopper" surfaces the tactics
   page; search box visually under the reload button.
3. Add the WIKI button (verbatim above). Done: settings overlay shows it;
   tapping navigates (href relative — game and wiki share the directory).
4. Suite additions:
   - Settings overlay contains `#wiki-btn` with `href="wiki.html"`.
   - New page context on `wiki.html?` (plain load, no `?test=1` needed):
     home link count === `PAGES.length - 1`; `location.hash='#tactics'`
     renders 11 numbered tactics; typing "stopper" into the search input
     yields ≥1 result linking `#tactics`; no console errors.
   - **Shove-mechanic guard** (protects tactic #10's physics): in a new L13
     Queue block — melt G through the slot region, let the puddle rest,
     drag M horizontally into it, assert the puddle centroid displaced ≥0.8
     cells in the push direction (`__GF.parts('G')` before/after). Keep the
     existing L13 solve block untouched.
5. Docs: `.claude/phasic.md` gains a short "Wiki" section (file, PAGES[]
   contract, page list — ≤10 lines) and its line-count note updates;
   `games/CLAUDE.md` PHASIC blurb gains "in-game wiki (cogwheel → WIKI,
   searchable)"; update BOTH `#build-badge`s (`index.html` changed in task
   3; `wiki.html` new) to the current `date -u '+%Y-%m-%d %H:%M UTC'` and
   state both strings in the report.

## Gotchas / bindings

- Single-file rule: no shared CSS/JS between `index.html` and `wiki.html` —
  duplicate the ~20 lines of palette/font boilerplate rather than extracting
  a shared stylesheet.
- Google Fonts is the only allowed external resource; the smoke gate's
  IGNORE list already tolerates fonts.g / net::ERR for offline runs.
- The settings overlay is `z-index:70`-land with chrome at 80
  (`games/CLAUDE.md` convention) — the WIKI anchor lives INSIDE the overlay,
  so no z-index work; do not add wiki chrome above the game's topbar.
- `wiki.html` gets NO `?test=1` API and no game code — it is a pure
  document; keep it free of the game's save key (`phasic_v1`) entirely.
- The suite's existing "menu format" and "authored maps parse" checks run
  against `index.html` — task 3's one-line overlay edit cannot disturb
  them, but run the full suite anyway (the rule is every task).
- Search must not use `innerHTML` from the query (inject via
  `textContent`) — the query is user input even in a static page.
- Commit hygiene: explicit pathspecs, no `git add -A`.

## Validation

Drive suite green (grown by task 4's checks, 0 failed); smoke gate green on
BOTH `games/phasic/index.html` and `games/phasic/wiki.html`; games-sync not
triggered (no catalog change — assert by not touching those files). Manual
playtest per Playtest bullet.

## Follow-ups

Likely: per-level hint links into the wiki ("read about fans") — CD call;
wiki pages for future mechanic blocks ride those blocks' plans.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phaswiki.in-game-wiki-and-tactics.md
```
