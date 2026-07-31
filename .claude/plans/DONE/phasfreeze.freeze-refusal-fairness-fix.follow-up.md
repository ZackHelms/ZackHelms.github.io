# phasfreeze — follow-up (oversee run 2026-07-31)

## Blocked — needs you

(none)

## Decisions made on your behalf — review

- **Case A (L27, I4 gem P) was not a distinct bug.** The trace exhausted
  the play space on the CD's own board: a settled I4 always froze, before
  and after (h=1 forces only a 0.10-cell reach). The only refusal window
  is mid-pour, while the column is visibly falling — a legitimate refusal.
  Treated the sighting as either that moment or a second view of the T5
  disease; no I4-specific change shipped. The suite still pins settled-I4
  freezing as an invariant.
- **The plan's repro indices (26/28) were stale** — the CD played the
  pre-templates build (`6bc1f9a^`); the same-day template commit re-rolled
  every generated level. The trace reproduced the CD's exact board on a
  read-only extract of the old build and the disease identically at HEAD.
  All suite checks scan for their cases at runtime; nothing is hardcoded.
- **Remedy pinned to footprint-scaled resting cap + surface-row anchor
  seeding; the physics-gather remedy was rejected for correctness use**
  after measurement — pulling the settled T5 toward its target footprint
  levitates the puddle (centroid 11.60 → ~10.1) while the max jump
  oscillates 1.81 → 2.64 → 1.96 within 0.6 s, so a fixed-duration gather
  freezes on a coin flip. It remains available as pure visual flavour (the
  plan's original Follow-ups item — CD call).
- **Socket cap:** kept 2.35 as the floor; a resting puddle may use the
  footprint-scaled cap there too (`max(2.35, jcap)`, jcap ≤ 2.6).
- **Resting 1–2-tall spread refusals left unfixed on purpose** (see
  Deferred below) — the pinned design targeted the structural h=3 disease.

## Deferred / discovered follow-ups

- **h≤2 resting spread refusals (18 cases in the 314-puddle sweep;
  needed cap 1.92–3.44).** These are horizontal-spread refusals, not the
  height disease; the in-game remedy is re-melt/re-pour closer to the
  socket. Widening the resting cap for h≤2 (e.g. to ~2.2) would clear the
  marginal third of them — but how forgiving freeze should *feel* is a
  design call, so it stays with the CD rather than a follow-up plan.
- **Validator blind spot, now closed but worth knowing:** the solver
  script's `{c:}` freeze op parks the gravity well below the board and
  retries on refusal — the exact "launch/drag-and-freeze" workaround the
  CD discovered by hand. That is why `replayGen` stayed green while
  players were refused 100% of the time on settled T5s. Appended to the
  solver-generation note as a proxy-metric lesson.
- **Tier observations** (ledger: none configured): all four tasks
  first-pass at plan tiers (opus/opus/sonnet/haiku), zero warm retries,
  zero escalations. Task 3's sonnet caught its own measurement bug via a
  scratchpad probe before it reached the suite.
