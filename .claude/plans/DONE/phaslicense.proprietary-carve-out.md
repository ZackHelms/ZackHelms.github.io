# phaslicense — proprietary license carve-out for games/phasic/ + in-game and wiki links

**Status:** IMPLEMENTED 2026-07-31 (burndown run 3) — commits
42fd23e..1f96ce5; suite 284→289; forward-only carve-out live (LICENSE,
root preamble, settings link, wiki footer)
**Requested:** 2026-07-31 (CD: IP protection ahead of the App Store; facts
verified that day — root license is Apache 2.0, not MIT; carve-out is
forward-only; Apache §6 never granted the PHASIC name).
**Scope:** `games/phasic/LICENSE` (new), root `LICENSE.txt` (preamble
exception), `games/phasic/index.html` (settings link), `games/phasic/wiki.html`
(footer), `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at `2279838`: settings overlay buttons at
> `index.html:100-101` (STUCK, WIKI); wiki `<main id="content">` at
> `wiki.html:84`, `render()` at `:453`, `</body>` at `:532`.

## Goal

`games/phasic/` is explicitly excluded from the repo's Apache 2.0 grant:
a proprietary all-rights-reserved LICENSE sits in the game folder, the
root `LICENSE.txt` carries an exception preamble naming it, and players
can reach it from the game's settings menu and a footer on every wiki
page. Forward-only by nature; that is understood and documented.

## Context

The repo is public and Pages-served; the CD is preparing an App Store
release and wants the game's code/content out of the permissive grant
going forward. The name/trademark was never licensed (Apache §6). The
CD-side IP actions (USPTO, copyright, Apple) live in TODO.md ## Needs
Zack and are NOT this plan's scope.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Draft `games/phasic/LICENSE` | docs (legal-shaped) | sonnet | medium | wording judgment; overseer reviews before commit |
| 2 | Root `LICENSE.txt` exception preamble | mechanical-edit | haiku | medium | verbatim below |
| 3 | Settings link + wiki footers | mechanical-edit | haiku | medium | verbatim below |
| 4 | Suite + smoke | tests | sonnet | medium | small DOM checks |
| 5 | Docs + badges | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 → 4 → 5 sequential.
- **Files owned:** 1: `games/phasic/LICENSE`; 2: `LICENSE.txt`;
  3: `games/phasic/index.html` + `games/phasic/wiki.html`;
  4: `.claude/tests/drive-phasic.cjs`; 5: `.claude/phasic.md` + badges.
- **Validation per task:** drive suite green after 3–4; final smoke on
  BOTH `games/phasic/index.html` and `games/phasic/wiki.html`.
- **Tier audit:** task 1 fails haiku item 4 (wording); 2–3 pass
  (verbatim); 4 borderline → sonnet-medium; 5 passes.
- **Decision defaults:**
  - Task 1 content requirements (sonnet drafts plain, readable text —
    not legalese cosplay; the overseer reviews it like a commit):
    copyright line `Copyright (c) 2026 Zack Helms. All rights reserved.`;
    no permission to copy, modify, distribute, sublicense, sell, or make
    derivative works of anything in `games/phasic/` without prior written
    permission; the PHASIC name, logo and branding are reserved and no
    trademark rights are granted; playing the game where officially
    published is permitted; an explicit note that this folder is EXCLUDED
    from the repository's Apache 2.0 license and that versions
    distributed before this notice remain under their original license;
    contact = the repository owner. NO warranty section theatrics beyond
    a one-line as-is disclaimer.
  - Task 2 verbatim — prepend to `LICENSE.txt` (above the Apache text):
    ```
    NOTICE — SCOPE EXCEPTION

    The directory games/phasic/ (the game "PHASIC") is NOT licensed
    under the Apache License below. All rights to its contents are
    reserved — see games/phasic/LICENSE. This exception applies from
    2026-07-31 forward; it does not affect copies of earlier versions
    already distributed under the Apache License. No trademark rights
    to the PHASIC name were ever granted (Apache License §6).

    ---------------------------------------------------------------
    ```
  - Task 3 verbatim: in the settings overlay after the WIKI button
    (`index.html:101`):
    `<a id="lic-btn" class="obtn alt" href="LICENSE" style="text-decoration:none;font-size:12px">LICENSE</a>`
    In `wiki.html`, a footer rendered on EVERY page (append once, inside
    the render pipeline or as a fixed element after `<main id="content">`):
    `<footer id="wiki-foot" style="...dim, 10px, centered, padding...">© 2026 Zack Helms · All rights reserved · <a href="LICENSE">License</a></footer>`
    (implementer matches house styling; the footer must be visible on
    every hash route including search results).
  - A plain-text `LICENSE` file served by Pages renders fine in-browser;
    no HTML wrapper needed.
  - The root-LICENSE preamble changes the WHOLE repo's license file
    presentation — that is the point, but flag it prominently in the
    final report so the CD sees it.
- **Embedded-content QA:** the preamble and link snippets above are the
  plan's verbatim content — reviewed against the actual overlay markup
  and Apache §6 this session. Task 1's license text is drafted at run
  time and REVIEWED BY THE OVERSEER before its commit (read the whole
  file; check the requirement list above item by item).
- **Escalation triggers:** none — but the report must repeat, verbatim,
  the forward-only caveat so the CD's expectations stay calibrated.
- **Playtest:** cogwheel shows LICENSE; tapping opens the text; wiki
  pages show the footer; both link targets resolve on the live site.
- **Publish:** default — push `main`, Pages verified, badges stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`
  (task 2's commit scope: `repo`).

## Steps

1. Draft `games/phasic/LICENSE` per requirements; overseer review gate.
2. Prepend the root notice (verbatim above) — nothing else in
   `LICENSE.txt` changes, byte-for-byte.
3. Add the settings link and the wiki footer.
4. Suite: settings overlay has `#lic-btn` href `LICENSE`; wiki page shows
   `#wiki-foot` containing `All rights reserved` on `#home` AND after
   navigating to `#tactics`; the LICENSE file exists and is non-empty
   (fs check in the suite). Smoke both pages.
5. Docs: `.claude/phasic.md` gains a short "Licensing" note (folder is
   proprietary, root carries the exception, forward-only); badges bumped
   on both changed pages, strings stated in the report.

## Gotchas / bindings

- Do NOT touch the Apache body text — the preamble sits fully above it,
  separated by the rule line.
- `href="LICENSE"` is relative — correct from both `games/phasic/` pages.
- GitHub's license auto-detection for the repo may change or disappear
  with a preamble in `LICENSE.txt` — cosmetic, accepted; note in report.
- The wiki footer must not overlap the search results view (it renders
  outside `#content`).
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Drive suite green (grown by task 4's checks); smoke green on both pages;
manual link-tap on the live site after publish.

## Follow-ups

The public-vs-private source decision (TODO.md ## Needs Zack) supersedes
this plan's protections if taken — nothing here blocks it.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phaslicense.proprietary-carve-out.md
```
