# phaschrome — mobile chrome/layout round: bucket raise, rotation squish fix, landscape buckets, now-playing line

**Status:** IMPLEMENTED 2026-07-31 (burndown run 2) — commits
0a52e1d..c3b3208; suite 252→284; squish traced to degenerate-viewport
CELL<0 (iOS trigger stays a labeled hypothesis — see follow-up)
**Requested:** 2026-07-31 (four CD items, bundled: same file, same
layout/chrome subsystem, each a single task).
**Scope:** `games/phasic/index.html`, `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Anchors verified at `2279838`; re-locate by symbol. `layout()` at
> `index.html:498` (`BZ=clamp(H*0.125,80,112)` at `:503`), `bucketRects`
> at `:869`, lone resize listener at `:2270`, `SONGS[]` at `:2187`,
> `songStart` at `:2200`, `songStart(i%10)` call at `:489`, toast bottom
> offset in CSS at `:46`.

## Goal

Four device-feel items land together: buckets sit ~half a bucket height
higher (no more iOS swipe-up-to-background on grabs); rotating
portrait↔landscape never leaves the game squished (with a headless
reproduction pinning it); landscape mode puts the three buckets in a right-
side column so the field gets full vertical space; a now-playing line
(track number + song title) sits at the very bottom.

## Context

All four are CD device reports from 2026-07-31 play sessions. The squish
bug's cause is UNTRACED (house rule: trace before fixing) — candidates in
the TODO entry are hypotheses only.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Rotation squish: reproduce headlessly, trace, fix | debugging + invariant code | opus | high | untraced device bug in layout/lifecycle code |
| 2 | Bucket raise (~half bucket height) | single-system code | sonnet | high | layout arithmetic with feel constraints |
| 3 | Landscape: buckets right-column layout | single-system code | sonnet | high | orientation-branched geometry, input hit areas |
| 4 | Song titles + now-playing line | single-system code | sonnet | medium | small UI + content, names below |
| 5 | Docs + badge | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 → 4 → 5 sequential (1 first: its repro check
  then guards every later layout change).
- **Files owned:** 1–4: `games/phasic/index.html` + `.claude/tests/drive-phasic.cjs`;
  5: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green; final gate adds smoke
  on `games/phasic/index.html`.
- **Tier audit:** task 1 fails haiku items 1+4 (unknown cause); tasks 2–3
  fail item 4 (feel/geometry judgment); task 4 fails item 4 mildly
  (placement judgment); task 5 passes.
- **Decision defaults:**
  - Task 1 repro FIRST, fix second: playwright page at 390x844 →
    `setViewportSize(844x390)` → back to 390x844, reading field geometry
    each step (expose a TEST-only `__GF.metrics()` returning
    `{W,H,CELL,FX,FY,cvW:cv.width,cvH:cv.height,rectW,rectH}`). The bug
    reproduces when post-round-trip CELL/aspect ≠ the original. If
    headless does NOT reproduce, emulate iOS specifics (visualViewport
    resize order, delayed rect updates) before concluding — and if it
    genuinely cannot reproduce headlessly, instrument the fix's
    invariant instead (post-layout self-check, below) and say so.
  - Whatever the cause, ship the belt-and-braces lifecycle hardening:
    listen on `orientationchange` and `visualViewport.resize` in addition
    to `resize`; after any of them, run `layout()` now AND once more on
    the next rAF + at 300 ms (rects can settle late on iOS); add a cheap
    post-layout self-check — if the canvas attribute size disagrees with
    the current bounding rect by >2 px, re-run `layout()` (self-healing
    beats a stuck squish).
  - Bucket raise: lift the bucket row by `bh*0.5` (bucketRects `y`), keep
    BZ reserving the same total strip so the field doesn't jump; hit
    areas stay ≥ current (the `inRect` margins and the `p.y>=b.hot.y`
    grab tests move with the rects). Toast bottom offset (`:46`) may need
    +half-bucket too — check visually via screenshot.
  - Landscape (`W>H`): buckets become a right-side COLUMN (HOT top, GRAV
    middle, COLD bottom), field sized on `H` minus padding only (no BZ
    strip at the bottom); `bucketRects` returns the column geometry;
    grab/drop hit tests already read `bucketRects` so they follow; the
    gravity ring (`placeGrav`) stays the field border ring — verify the
    docked-bucket drop zone still works from the column. Portrait
    behavior unchanged.
  - Song titles (task 4), verbatim — add `t:` to each `SONGS[]` entry in
    order: `'First Light'`, `'Copper Squares'`, `'Slow Thaw'`,
    `'Vapor Trail'`, `'Deep Cellar'`, `'Warm Static'`, `'Ride the Flue'`,
    `'Still Water'`, `'Amber Drift'`, `'Night Drawer'` (CD renames at
    will — they asked for titles to exist). Now-playing line: canvas-drawn
    dim 10px Share Tech Mono, `'NN · TITLE'`, bottom-center in portrait
    (in the strip the raise frees), bottom-left in landscape; updates in
    `songStart`; expose `__GF.nowPlaying()` for the suite.
  - Suite additions per task: (1) the rotation round-trip check
    (aspect+CELL recover, twice in a row); (3) landscape smoke — a second
    context at 844x390 loads L1, `__GF.buckets()` (add TEST verb
    returning bucketRects) shows the column on the right and the field
    using >90% of available height; (4) `nowPlaying()` matches
    `'01 · FIRST LIGHT'`-shape on load(0) (case per implementation).
- **Embedded-content QA:** song titles above are the plan's content —
  10 titles, matched to the 10 `SONGS[]` entries (count re-derived).
  No other verbatim code.
- **Escalation triggers:** task 1 unable to reproduce OR trace after two
  honest rounds — ship the hardening + self-check, log the open trace to
  the follow-up file, and say so in the report (do NOT claim the cause).
- **Playtest:** on device — grab a flame from the raised buckets (no
  app-switcher trigger), rotate both ways twice (no squish), landscape
  shows right-column buckets, bottom line shows the song.
- **Publish:** default — push `main`, Pages verified, badge stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. Rotation: repro → trace → fix + lifecycle hardening + self-check;
   suite round-trip check green twice.
2. Bucket raise + toast offset; screenshot before/after at 390x844.
3. Landscape column layout + `__GF.buckets()`; landscape suite context.
4. `SONGS[]` titles + now-playing line + `nowPlaying()` + suite check.
5. Docs: phasic.md Audio section notes titles; layout section notes the
   landscape column + rotation self-check; badge bump stated.

## Gotchas / bindings

- `layout()` rescales existing gem positions by CELL ratio (`:505-510`) —
  a double-layout must be idempotent (second call with identical rect is
  a no-op scale of 1.0); verify no drift after 10 repeated layouts (suite
  can assert positions stable).
- `?test=1` freezes stepSim but `layout()` runs on real resize events —
  the rotation check drives real viewport changes, no `step()` needed.
- The wood border texture cache (`woodCanvas=null` on layout) — landscape
  reflow must invalidate it exactly as portrait does (it already does in
  `layout()`; don't add a second cache).
- Fan-beam / gas-field caches are grid-indexed, not pixel — orientation
  change doesn't touch them; do not rebuild.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after each task (rotation + landscape + now-playing
checks included); smoke green at the end; screenshots for the CD (raise,
landscape) attached to the report.

## Follow-ups

Landscape-specific field proportions (GW×GH is portrait-shaped 10×12 — a
rotated board layout is a design question for the CD, NOT this plan; this
plan only reclaims the chrome space).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phaschrome.mobile-chrome-layout-round.md
```
