# phasdaily — daily challenge: one shared solver-proven level per UTC date

**Status:** IMPLEMENTED 2026-08-01 — commits ba26051..07113a1, merged to main
**Requested:** 2026-08-01 (backlog Later item: "Daily-challenge / share-code
retrofit (house pattern; the generator is already seeded and deterministic
per index)").
**Scope:** `games/phasic/index.html`, `.claude/tests/drive-phasic.cjs`,
`games/index.html` (GAMES facet entry) + `.claude/games-index.md` (re-facet),
`.claude/phasic.md`.

> Anchors verified at `a825c0d`; re-locate by symbol (earlier burndown runs
> may land first): `getLevel` at `index.html:2034`, `genCache` :2032, menu
> overlay `#menu` :74 / `#play-btn` :79, handlers :2584-2588, `loadLevel`
> :518, `levelClear`'s `save.done[lvlIdx]=true` :1090, `buildLvlSel` N-calc
> :2573, save load/persist :454-456 (`localStorage` key `phasic_v1`),
> `lvlName` :1235, TEST flag :422.

## Goal

A DAILY button on the menu serves the same generated, solver-proven level to
every player on a given UTC date. Completing it records to a per-date daily
log (never to `save.done`), the clear screen says it was the daily, and free
play is untouched. House pattern: ballpark's DAILY TEN (menu button + UTC
date key + `save.daily[dateKey]` results).

## Context

Every generated Phasic level is already deterministic per index and beaten by
the solver before serving (`getLevel`). A date-derived index therefore IS a
daily challenge — no new generation machinery, only an entry point, display
labels, and separate persistence. Share codes are explicitly OUT of scope
(follow-up; signal-hunt's duel-code pattern exists when wanted).

## Implementation guidance (for the overseer)

Tiers under the **balanced** profile.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Daily mode: index derivation, button, display, persistence split | cross-system | sonnet | high | touches load/clear/menu paths; two poison-traps below |
| 2 | Suite: determinism, persistence-split, menu-invariance checks | tests | sonnet | medium | enumerated checks below |
| 3 | Catalog re-facet + docs + badge | docs | haiku | low | enumerated; sync gate |

- **Ordering:** 1 → 2 → 3 sequential.
- **Files owned:** 1: `games/phasic/index.html`; 2: the drive suite; 3: hub
  `GAMES[]` entry + `.claude/games-index.md` + `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green each task; task 3 also
  `node .claude/scripts/check-games-sync.cjs` GREEN (catalog re-faceted);
  final smoke.
- **Tier audit:** task 1 fails haiku items 1+4 (cross-cutting flow edits with
  behavioral traps) → sonnet-high; task 2 is enumerated but needs assertion
  judgment → sonnet-medium; task 3 passes the checklist → haiku-low.
- **Decision defaults:**
  - **Index derivation:** `const DAILY_BASE=100000;
    const dailyIdx=()=>DAILY_BASE+Math.floor(Date.now()/86400000);` — far
    above any curriculum boundary (stays endless-flavored even if a future
    block insert moves the 64 boundary), `blockOf` caps it, `lvlName` leaves
    it unprefixed, `getLevel` generates + solver-proves it like any endless
    index. TEST override required for deterministic tests: a
    `G.setDay(n)`-style TEST hook (or `?day=N` param read only when `TEST`)
    that pins the day number — suite must not depend on the wall clock.
  - **Menu:** `#daily-btn` (class `obtn alt`) directly under `#play-btn`
    inside `#menu`; label `DAILY`; shows a ✓ suffix when
    `save.daily?.[dateKey()]` exists. `dateKey()` = UTC `YYYY-MM-DD`.
  - **Mode flag:** a module-level `dailyMode` boolean set by the button,
    cleared by any non-daily load path (`play-btn`, `lvlsel` change,
    `next-btn`, TEST `load`). Keep the flag OUT of `save`.
  - **Poison-trap 1 (load-bearing):** `levelClear` writes
    `save.done[lvlIdx]=true` (`:1090`). With `lvlIdx≈100037` that turns
    `save.done` into a ~100k-slot sparse array — JSON-serialized with ~100k
    `null`s and `buildLvlSel`'s `hi` scan then walks it. In daily mode the
    clear MUST branch: `save.daily[dateKey()]={t:Math.round(lvlT)}` and NOT
    touch `save.done`.
  - **Poison-trap 2 (load-bearing):** `buildLvlSel`'s
    `N=Math.max(64,hi+2,lvlIdx+2)` (`:2573`) would build 100k+ `<option>`s
    while a daily is loaded. Derive N from a display index that ignores
    daily (`dailyMode?<last non-daily lvlIdx or 63>:lvlIdx`), or skip the
    rebuild in daily mode and rebuild on exit — either way the option count
    while a daily is open must equal the count before it opened.
  - **Display:** hint bar and `#clearname` show
    `'DAILY '+dateKey()+' · '+<generated name>` instead of the `L<n>` form
    (daily is unlisted, so a 6-digit level number is noise); `#lvlsel`
    selection is left unchanged (the daily is never an option). Clear-screen
    `#next-btn` in daily mode returns to the menu instead of loading
    `lvlIdx+1` (there is no next daily).
  - **Music:** leave `songStart(i<64?blockOf(i):i%10)` untouched — the daily
    index rotates the endless songs; acceptable.
  - Daily completion does not unlock curriculum levels (no `save.done`
    write) — intended.
- **Embedded-content QA:** the two poison-traps were traced to live code this
  session (`:1090`, `:2573`) — they are facts, not hypotheses. No verbatim
  block here exceeds a signature; counts stated as invariants.
- **Escalation triggers:** none beyond the standard list.
- **Playtest:** tap DAILY — a fresh puzzle labeled with today's date; clear
  it; DAILY shows ✓; the level list is unchanged; tomorrow it's a new one.
- **Publish:** default — player-facing; push main, Pages verified, badges
  stated.
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. `DAILY_BASE`/`dailyIdx()`/`dateKey()` + TEST day-pin + `#daily-btn` +
   `dailyMode` flag + the two branch guards (clear persistence, lvlsel
   N-calc) + display overrides + next-btn behavior.
2. Suite: (a) with the day pinned, DAILY twice → identical `mapInfo` board
   both times; (b) different pinned day → different board (any field
   differs); (c) clear the daily via the solver-grant path → `save.daily`
   has the date key, `save.done` length unchanged, `#lvlsel` option count
   unchanged; (d) hint bar starts `'DAILY '`; (e) menu DAILY shows ✓ after
   the clear. Never hardcode the suite total.
3. Hub `GAMES[]` phasic entry + `.claude/games-index.md` row gain the
   `daily-challenge` facet (mirror ballpark's row wording); `.claude/phasic.md`
   gains a § Daily challenge (derivation, the two traps, TEST day-pin);
   badge bump. Sync gate green.

## Gotchas / bindings

- The two poison-traps above are the whole risk of this plan — every other
  edit is chrome. Any implementer change that lets a 6-digit index touch
  `save.done` or the option list is wrong even if the suite happens to pass.
- `getLevel(dailyIdx())` runs the generator+solver for a fresh index at tap
  time (same cost as any endless level, cached in `genCache` per session) —
  do not add a spinner; existing endless loads take the same path.
- The card/hub markup must NOT change (sync-gate regex is strict); only the
  `GAMES[]` dataset entry's facet list and the games-index row change —
  they must stay mirrored or `check-games-sync.cjs` goes RED.
- `save.daily` is a new optional key on the `phasic_v1` blob — guard reads
  (`save.daily||{}`); never restructure existing keys.
- Worktree discipline: absolute paths + `git -C <worktree>` in every
  committing spawn prompt; explicit pathspecs; never `git add -A`.

## Validation

Full drive suite green after each task (grows by exactly task 2's checks);
`check-games-sync.cjs` GREEN after task 3; final smoke green on the game
page.

## Follow-ups

- Share-code duel (signal-hunt's checksummed-code pattern) — CD-triggered.
- Daily streak counter — trivial once `save.daily` accumulates.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasdaily.daily-challenge.md
```
