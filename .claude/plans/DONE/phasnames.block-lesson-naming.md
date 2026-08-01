# phasnames — block-lesson naming: every level displays its block's lead word as a prefix

**Status:** IMPLEMENTED 2026-08-01 — commits `b9994a7`..`f1fd53b` on
`worktree-oversee+phasnames` (+ wrap-up docs), merged to `main` same day.
All 3 tasks first-pass; a 4th display site (`ghostHint`) was added in
preflight; suite 335→338. See `.follow-up.md`.
**Requested:** 2026-07-31 (CD: "each set of 8 levels begins with the same
word that describes the lesson"; same-day decision: **prefix everything**
— uniform "Word · Name", tutorials keep their names).
**Scope:** `games/phasic/index.html` (display layer only),
`.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at `2279838`; re-locate by symbol (this plan runs LAST
> in the burndown — expect heavy drift from phasgrav): `blockOf` at
> `index.html:1102`, `buildLvlSel` at `:2234` (menu entry text at its
> `op.textContent` line), the hintbar line in `loadLevel` at `:486-489`
> region, `clearname` in `levelClear`.

## Goal

Every level's DISPLAYED name is `Word · Name` where Word is its
curriculum block's lesson word — in the level-select list, the hint bar,
and the clear screen. Defs and generated names stay untouched (display-
layer prefix), so determinism, `AUTH`, `genCache` and save data are
unaffected.

## Context

The CD wants the level list to scan by lesson. Prefixing at display time
is the deterministic-safe implementation: `genName` and every def keep
their current strings; one function derives the shown name.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | `BLOCK_WORD` + `lvlName(i,def)` + the three display sites | mechanical-edit | haiku | medium | verbatim content below, exact targets |
| 2 | Suite: block-consistency assertion + menu format update | tests | sonnet | medium | scanning assertion wording |
| 3 | Docs + badge | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 sequential.
- **Files owned:** 1: `games/phasic/index.html`; 2: the suite;
  3: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green each task; final smoke
  on the game page.
- **Tier audit:** task 1 passes the haiku checklist (verbatim below);
  task 2 fails item 4 mildly → sonnet-medium; task 3 passes.
- **Decision defaults:**
  - Verbatim (task 1) — add beside `blockOf` (`:1102`):
    ```js
    const BLOCK_WORD=['Drag','Flame','Gravity','Frost','Vapor','Void','Hedge','Wind'];
    function lvlName(i,def){ const nm=def?def.name:genName(i);
      return i<64 ? BLOCK_WORD[blockOf(i)]+' · '+nm : nm; }
    ```
    Then use `lvlName` at the three display sites: `buildLvlSel`'s
    `op.textContent` (replacing its `nm` derivation), the `#hintbar` line
    in `loadLevel`, and `clearname` in `levelClear`. Endless (65+) shows
    NO prefix — it is not a lesson block (flagged for the CD in the
    report; one-word change if they want one).
  - Do NOT touch `def.name`, `genName`, `AUTH`, `NAME_A/B`, or any
    stored/cached string. If phasgrav landed first and renamed block-2
    tutorials, nothing here changes — the prefix wraps whatever the name
    is.
  - Menu-entry shape becomes `"N · Word · Name ✓"` — still one line.
- **Embedded-content QA:** `BLOCK_WORD` has exactly 8 entries matching
  blocks 0–7's lessons (drag, flames, gravity+gas, liquid base=Frost,
  gas base=Vapor, void, bush=Hedge, fan=Wind — consistent with the
  curriculum table in `.claude/phasic.md`); the snippet was written
  against `blockOf`/`genName` as read this session.
- **Escalation triggers:** none.
- **Playtest:** open the level list — each block of 8 scans under its
  word; play one level per block and check the hint bar + clear screen.
- **Publish:** default — push `main`, Pages verified, badge stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. The verbatim snippet + three call-site swaps.
2. Suite: update the existing menu-format check's expectations
   (`/^\d+ · \S/` still holds; add: for each block b in 0–7, EVERY
   unlocked-or-not option for indices 8b..8b+7 starts
   `(i+1)+' · '+BLOCK_WORD[b]+' · '`); assert index 65+ options carry no
   block word; hintbar text on `load(0)` starts `'L1 · Drag · '`.
   Never hardcode a total count.
3. Docs: `.claude/phasic.md` curriculum section notes the display-layer
   prefix + `BLOCK_WORD`; badge bump stated.

## Gotchas / bindings

- `buildLvlSel` runs on every load and on save changes — `lvlName` must
  stay cheap (no regeneration; `genName(i)` is already called there for
  unauthored levels, keep that single call).
- The suite's existing menu-format check asserts lowercase presence
  (`/[a-z]/`) — the prefix words are Title Case; the check still passes,
  don't remove it.
- Locked entries show `' 🔒'`, done show `' ✓'` — the prefix goes in the
  NAME part, suffixes unchanged.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after each task; smoke green at the end.

## Follow-ups

Endless-tail naming word (if the CD wants one) — one-line change.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasnames.block-lesson-naming.md
```
