# phasaudio — follow-up (2026-08-01 run)

## Blocked — needs you

- (none — but the whole run is CD-audition content: sound aesthetics were
  shipped per the plan's defaults, deliberately not iterated. Audition list
  in the run report.)

## Decisions made on your behalf — review

- **Preflight drift (cosmetic, corrected anchors handed to implementers):**
  `killGem` :820 (was :768), songStart call :495 (was :486), `SONGS[]` :2291
  (was :1642), `blockOf` :1194 (was :1089), suite L41 block :476-486 (was
  :410-420), phasic.md Audio § :214 (was :178). All symbol claims held.
- **L9 now-playing expectation updated (behavior change, not a test hack):**
  the phaschrome-era check asserted `load(9)` → `10 · <SONGS[9].t>` under the
  old `%10` rotation; per-block music makes i=9 play block 1's song
  (`02 · <SONGS[1].t>`). Committed as its own test commit (`ef971f4`). The
  double-digit-format coverage that check carried was restored via an
  endless-level probe (`load(69)` → `10 · <SONGS[9].t>`).
- **Suite initializes real audio for the hum teardown check:** `__GF.load()`
  bypasses the button handlers that normally create the AudioContext, so the
  suite calls `audioInit()` directly before the fan-hum block — the check
  exercises real node start/stop rather than only the TEST log (verified
  clean in headless Chromium: context runs, no console errors).
- Bush/fan check levels are runtime-derived by scanning `mapInfo()` across
  indices (found L49 Overgrowth / L57 Crosswind — matching the plan's
  guesses, but derived, so template re-rolls can't silently break them).

## Deferred / discovered follow-ups

- **TEST-log gating asymmetry (traced, harmless today):** `fanHumStart`
  logs `'hum-on'` via a would-start flag decoupled from `ac`, but
  `fanHumStop`'s `'hum-off'` log is gated on real nodes existing
  (`fanHumNodes`), which requires a live AudioContext. If a future check
  wants `'hum-off'` observable with no audio context, mirror the
  would-start shape (`wouldStop` flag). Not worth a task now — the suite's
  audioInit approach is the stronger probe anyway.
- Plan's own follow-up stands: block-themed song *parameters* (e.g.
  obstacle blocks darker) instead of fixed assignment — only if the CD asks
  after auditioning.
