# phasaudio — Phasic dedicated obstacle SFX + per-block music

**Status:** IMPLEMENTED 2026-08-01 (8ce92e4..5f730af on worktree-oversee+phasaudio; all tasks first-pass; one pre-existing L9 now-playing expectation updated for the behavior change — see follow-up)
**Requested:** 2026-07-31 (backlog Next items from the refine round).
**Scope:** `games/phasic/index.html` (audio section + `killGem`/`setupLevel`
hooks), `.claude/tests/drive-phasic.cjs`, `.claude/phasic.md`.

> Line references verified against commit `7700f84`; re-locate by symbol.
> Runs after `phaspolish`/`phasweave` in the burndown — same file, expect
> line drift.

## Goal

The three obstacle events stop borrowing the error buzz: the void gets a
gulp, the bush a slurp, fan levels a soft ambient hum. Music stops rotating
`level % 10` and instead gives each curriculum block its own song (endless
keeps the full 10-song rotation). All WebAudio-synthesized per house rules —
no audio files.

## Context

`killGem` (`index.html:768-776`) plays `sfxError` for both hole and bush
deaths; fans are silent. Songs start in `loadLevel` via `songStart(i%10)`
(`:486`); `SONGS[]` (`:1642-1653`) holds 10 seeded generative songs. The
audio stack is the house standard (lazy `audioInit`, `sfxGain`/`musicGain`,
shared `noiseBuf`, `visibilitychange` suspend — `:1588-1686`).

## Implementation guidance (for the overseer)

Tiers assigned under the **balanced** profile (no local task-scoping skill;
zmh-producer scaffold rubric).

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | sfxGulp + sfxSlurp + fan-hum ambient, wired to events/levels | single-system code | sonnet | high | sound design judgment inside clear rails (existing tone/noise helpers) |
| 2 | Per-block music assignment | mechanical-edit | haiku | medium | verbatim one-line edit below; machine-checkable |
| 3 | Suite: audio wiring checks via a TEST-only SFX log | tests | sonnet | medium | pattern exists (suite conventions); wording/details agent's own |
| 4 | Docs + badge | docs | haiku | low | enumerated edits |

- **Ordering / dependencies:** 1 → 2 → 3 → 4, sequential (same file).
- **Files owned per task:** 1–3: `games/phasic/index.html` +
  `.claude/tests/drive-phasic.cjs`; 4: `.claude/phasic.md` + badge.
- **Validation per task:** full drive suite green after each; smoke gate at
  the end.
- **Tier audit (required):** task 1 fails haiku checklist item 4 (sound
  design); task 3 fails item 4 mildly (assertion wording) but the rails are
  strong — sonnet-medium; tasks 2/4 pass the checklist (verbatim/enumerated).
- **Decision defaults:**
  - `sfxGulp` (void): descending sine ~300→40 Hz over ~0.5 s + a low
    triangle thump + a swallowed noise tail; keep peak ≤ the existing
    `sfxThunk` loudness. `sfxSlurp` (bush): bandpass noise sweeping down
    ~800→300 Hz + two short descending blips. Route both through `sfxGain`
    via the existing `tone`/`noise` helpers (they already respect `solving`).
  - `killGem` keeps its shake/toast/vibrate behavior and the `solving` guard
    (`:772-774`); only the sound changes: `why==='hole'` → gulp,
    `'bush'` → slurp; `sfxError` stays for genuine rejects.
  - Fan hum: one shared loop node (bandpass `noiseBuf` ~150–220 Hz, slow
    gain LFO, volume ≤0.05 into `sfxGain`), started when a level with
    `fans.length>0` enters play and the AudioContext exists, stopped on
    level change / menu / fail / clear. Never started while `solving`.
    Guard double-starts (idempotent `fanHumStart/Stop`).
  - Per-block music (verbatim, task 2): `loadLevel` `:486` becomes
    `if(typeof songStart==='function') songStart(i<64?blockOf(i):i%10);`
    — blocks 0–7 own songs 0–7; endless rotates all 10. `blockOf` is
    defined at `:1089`.
  - Muting/volume: no new settings — the hum is SFX, governed by the SFX
    slider/mute like everything else.
- **Embedded-content QA (required):** the task-2 line was checked against
  `loadLevel` and `blockOf` this session (both exist as cited); no other
  verbatim code is embedded — sound recipes above are design intent with
  loudness bounds, not copied code.
- **Escalation triggers:** none beyond the standard (suite failure resisting
  two rounds). Sound aesthetics are explicitly NOT an escalation — ship the
  defaults; the CD auditions after.
- **Playtest:** yes — audition round: feed a gem to the void (L41), let the
  hedge drink one (L49), idle on L57 for the hum, then skim one level from
  each block for the song change. **This is CD-audition content.**
- **Publish:** default — push `main`, verify Pages `success`, badge updated
  and stated. (Publish authorization is standing; the report must still
  flag the audition list above.)
- **Commit strategy:** one conventional commit per task, scope `phasic`.

## Steps

1. Implement `sfxGulp`, `sfxSlurp`, `fanHumStart/fanHumStop` next to the
   existing SFX consts (`:1627-1639`); wire `killGem`; call
   `fanHumStart` at the end of `loadLevel` when `fans.length>0` (and
   `fanHumStop` at its top + on `retry/next/menu` paths — the reload/next
   handlers all funnel through `loadLevel`, so top-of-function stop covers
   them; also stop on `game==='fail'`/`'clear'` transitions).
2. The per-block `songStart` line (verbatim above).
3. Suite: TEST-only `window.__SFXLOG=[]` pushed by gulp/slurp/hum-start/
   `songStart` (log the chosen song index). Checks: void death on L41 logs
   `gulp` (extend the existing L41 block); bush death logs `slurp` (feed the
   melt to the hedge on a retry of L49, then solve normally — or reuse the
   existing Overgrowth flow's negative space); loading L57 logs `hum-on`;
   `songStart` logs `blockOf(i)` for i∈{0, 9, 60} and `i%10` for 70. Keep
   the existing checks untouched.
4. Docs: `.claude/phasic.md` Audio section (`:178-186`): new SFX + hum +
   per-block rotation; badge timestamp stated in the report.

## Gotchas / bindings

- `tone`/`noise` early-return when `solving` — the hum must ALSO check
  `solving` at start time since it is a long-lived node, and must be stopped
  by `visibilitychange` suspend (it hangs off `ac`, so `ac.suspend()`
  already silences it — verify, don't assume).
- The suite runs `?test=1` with the sim frozen; `loadLevel` still fires
  `songStart` — the SFX log works without an AudioContext ONLY if the log
  push happens before the `ac` guard (put the push first in each function).
- Validation runs (`getLevel` salt loop) call `setupLevel`, not `loadLevel`
  — the hum hook belongs in `loadLevel` so validation stays silent.
- Bush-death check: killing a gem raises the fail overlay after 0.9 s
  (`failT`) — reload after asserting, as the existing L41 block does
  (`drive-phasic.cjs:410-420`).
- Don't grow `SONGS[]`; 10 songs, 8 blocks — songs 8–9 appear only in
  endless rotation. That is the accepted shape.
- Commit hygiene: explicit pathspecs, no `git add -A`.

## Validation

Full drive suite green after each task; smoke gate green at the end; no
console errors. Audible qualities are validated by the CD audition, not the
suite — the suite proves wiring only.

## Follow-ups

Possible later: block-themed song *parameters* (e.g. obstacle blocks darker)
rather than fixed assignment — only if the CD asks after auditioning.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/phasaudio.obstacle-sfx-and-block-music.md
```
