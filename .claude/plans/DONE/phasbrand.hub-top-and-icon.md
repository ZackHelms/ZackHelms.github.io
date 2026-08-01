# phasbrand — Phasic to the top of the hub + the phase-gem icon (hub card, favicon, iOS master)

**Status:** IMPLEMENTED 2026-08-01 (da1997e..de567c6 on worktree-oversee+phasbrand; 1 warm retry on icon band geometry; `<img>`-in-card shape replaced by pure-CSS rule per sync-gate regex — see follow-up)
**Requested:** 2026-07-31 (two CD items bundled — both are Phasic-brand
presentation and both touch `games/index.html`).
**Scope:** `games/index.html` (card order + card icon), `games/phasic/icon.svg`
+ `games/phasic/icon-1024.png` (new), `games/phasic/index.html` (head
links), `.claude/tests/drive-phasic.cjs`, `.claude/games-index.md` only if
the sync gate demands it.

> Anchors verified at `2279838`: PHASIC card at `games/index.html:506-509`,
> its `GAMES[]` entry at `:577` (icon `💠`), game `<head>` at
> `games/phasic/index.html:3-7`. The games-sync gate
> (`node .claude/scripts/check-games-sync.cjs`) is the authority on what
> must stay consistent between card / dataset / games-index row.

## Goal

The PHASIC card sits first on the games hub, wearing the CD-specified
icon: a 2x2 red gem — lower third solid, middle third liquid
(translucent), top third gaseous (semi-transparent) — on a transparent
background with a leafy bush behind the gem. The same art ships as the
game page's favicon/apple-touch-icon and as a 1024x1024 PNG master for
the future iOS app icon.

## Context

CD spec verbatim in the TODO entry. The icon is the brand (and a future
trademark-filing artifact — see the [phasic·IP] backlog); the hub-top
placement is discoverability.

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Author `icon.svg` + rasterize `icon-1024.png` + head links | creative asset + code | sonnet | high | visual authoring judgment against a precise spec |
| 2 | Hub: card to top + card wears the icon (sync-gate-consistent) | single-system code | sonnet | medium | the sync gate decides the consistency shape |
| 3 | Suite + gates | tests | sonnet | medium | DOM/file checks + both gates |
| 4 | Docs + badges | docs | haiku | low | enumerated |

- **Ordering:** 1 → 2 → 3 → 4 sequential.
- **Files owned:** 1: `games/phasic/icon.svg`, `games/phasic/icon-1024.png`,
  `games/phasic/index.html` (head only); 2: `games/index.html`
  (+ `.claude/games-index.md` only if the gate requires); 3: the suite;
  4: `.claude/phasic.md`, badges.
- **Validation per task:** task 1: smoke on `games/phasic/index.html`;
  task 2 onward: `node .claude/scripts/check-games-sync.cjs` MUST be green
  (the catalog changed) plus the drive suite; final smoke on the game page
  and `games/index.html`.
- **Tier audit:** task 1 fails haiku item 4 (art); 2 borderline
  (gate-dependent) → sonnet-medium; 3 sonnet-medium; 4 passes.
- **Decision defaults:**
  - Icon art (task 1): hand-authored SVG, 512x512 viewBox, transparent
    background. Composition: a leafy bush (3–5 rounded dark-green clumps
    with a few lighter leaf dots, matching the in-game bush palette
    `#123c1a`/`#2e7d32`/`#66bb6a`) sitting BEHIND a 2x2 arrangement of
    beveled red squares in the game's ruby palette (`#ff2244` /
    hi `#ff8899` / lo `#8d0f22`, bevel style like `drawGem`). Phase
    thirds are horizontal bands across the WHOLE 2x2 gem: bottom third
    fully opaque faceted solid; middle third liquid — same red at
    ~55% opacity with a wavy top edge and droplet highlights; top third
    gas — ~25% opacity soft radial puffs drifting up. Read
    `games/phasic/index.html`'s `drawGem`/`drawObstacles` for the exact
    colors; the icon must read at 60px (hub) AND 1024px.
  - Rasterize: playwright screenshot of the SVG at 1024x1024 with
    transparent background (`omitBackground:true`) →
    `games/phasic/icon-1024.png`. Note: App Store icons ultimately
    disallow transparency — that flattening happens in the future iOS
    pipeline, NOT here; the master keeps transparency (say so in docs).
  - Head links (task 1, verbatim, into `games/phasic/index.html` `<head>`
    after the fonts link):
    `<link rel="icon" type="image/svg+xml" href="icon.svg">`
    `<link rel="apple-touch-icon" href="icon-1024.png">`
  - Hub (task 2): move the PHASIC `game-card` block to be the FIRST card
    in the grid; the card's icon element shows the SVG
    (`<img src="phasic/icon.svg" ...>` sized like the emoji icons, with
    the 💠 as alt/fallback text). Then run the sync gate: if it demands
    icon equality between card and `GAMES[]`, keep `i:'💠'` in the
    dataset AND render the image alongside/in place per what the gate
    actually checks — the gate's green defines done; whatever shape it
    forces, card/dataset/games-index stay consistent. `GAMES[]` array
    order and games-index row order: leave them as they are unless the
    gate ties order to card order (it does not, as of the last run —
    verify, don't assume).
  - Card order is presentation-only — no games-index count changes.
- **Embedded-content QA:** the two head-link lines are verbatim content
  (paths relative to the game folder — correct for `games/phasic/`);
  palette values above were re-read from the tree this session.
- **Escalation triggers:** none. Icon aesthetics are NOT an escalation —
  ship per spec; the CD auditions and can iterate.
- **Playtest:** hub shows PHASIC first with the gem icon; game tab shows
  the favicon; `icon-1024.png` opens crisp. **This is CD-audition
  content** — the report's audition list must name it.
- **Publish:** default — push `main`, Pages verified, badges stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`
  (task 2 scope: `hub`).

## Steps

1. Author `icon.svg`; rasterize the 1024 master; add head links; smoke.
2. Reorder the hub grid; wear the icon on the card; sync gate green.
3. Suite: hub's first `game-card` links `phasic/`; `icon.svg` +
   `icon-1024.png` exist and are non-empty; the game head contains both
   link rels; games-sync green; full suite twice.
4. Docs: `.claude/phasic.md` gains an "Icon" note (files, transparency
   caveat for the iOS flatten); badges on both changed pages stated.

## Gotchas / bindings

- `check-games-sync.cjs` is pure node, cheap, and the authority — run it
  after every hub edit, not just at the end.
- The hub's `GAMES[]` feeds the coverage dashboard — do not remove or
  reorder OTHER games' entries.
- SVG in an `<img>` cannot use external resources — the icon SVG must be
  fully self-contained (inline styles only, no font references).
- Keep the 1024 PNG out of any minification/optimization pass — it is a
  master artifact.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

games-sync green after every hub edit; drive suite green (task 3's checks
included); smoke green on the game page and the hub; the report attaches
a screenshot of the hub top and the icon at both sizes.

## Follow-ups

Trademark filing of the logo mark once the CD signs off the art
([phasic·IP] backlog); App Store flattened-icon derivative lives in the
future iOS-port plan.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasbrand.hub-top-and-icon.md
```
