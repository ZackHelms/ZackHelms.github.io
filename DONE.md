# DONE — done log

- 2026-08-01 [phasic] phasbrand oversee run: the brand round — hand-
  authored 2x2 phase-gem icon (`games/phasic/icon.svg`, 512 viewBox,
  ruby+bush game palettes, phase thirds: solid/liquid/gas bottom-to-top)
  + 1024x1024 RGBA master (`icon-1024.png`, transparency kept — iOS
  flatten happens in the future iOS pipeline) + favicon/apple-touch head
  links; PHASIC card moved to FIRST on the hub wearing the icon via a
  pure-CSS rule (card markup untouched — the sync gate's card regex is
  text-only-icon, so `💠` stays the div text). Suite 289→300.
  (da1997e..de567c6 + wrap-up docs; plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] phaslicense oversee run: games/phasic/ is now
  proprietary — folder LICENSE (all rights reserved, play-only, reviewed
  against the 8-item requirement list), root LICENSE.txt scope-exception
  preamble (Apache body byte-identical), settings-cogwheel LICENSE
  button, © footer on every wiki route. Forward-only: pre-2026-07-31
  Apache copies stay Apache; the PHASIC name was never trademark-
  licensed (Apache §6). Suite 284→289. (42fd23e..1f96ce5 + wrap-up docs;
  plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] phaschrome oversee run: mobile chrome/layout round —
  rotation squish TRACED (degenerate viewport drove CELL negative; the
  oldCell>0 guard then dropped every healing rescale — permanent until
  reload) and fixed with CELL≥1 + degrading BZ clamp + strict no-op
  relayout + post-layout self-check + resize/orientationchange/
  visualViewport lifecycle (iOS trigger sequence stays a labeled
  hypothesis; invariant pinned instead); buckets raised bh/2 in portrait
  (toast follows); landscape gets a right-side bucket column (field 68%→
  91% of canvas height, portrait bit-identical); 10 songs titled + dim
  "NN · Title" now-playing line at the very bottom. Suite 252→284.
  (0a52e1d..c3b3208 + wrap-up docs; plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] phasfreeze oversee run: the freeze-refusal fairness
  bug traced and fixed — a settled 1-row puddle must reach h−0.9 cells to
  build an h-tall shape, so the flat 1.9 jump cap structurally refused
  EVERY settled 3-tall gem (13/13); fix = resting-gated footprint-scaled
  cap (≤2.6) + surface-row anchor seeding. 0 regressions over a
  314-puddle sweep; mid-air/mid-pour refusals byte-identical; the CD's
  L27 I4 case proved a mid-pour sighting, not a second bug. Suite
  246→252 checks. (16c4a28..23b13e8 + wrap-up docs; plan archived to
  .claude/plans/DONE/)

- 2026-07-31 [phasic] phasweave oversee run: generated levels gain two new
  board templates (two-shelf, gas attic — drawer determinism proven by
  byte-diff) and in-path obstacle weaving in blocks 5-7 (void under the
  pour line with a guaranteed plug stone, mid-field hedge vapor crossing,
  ridden fan lane with the well docked) — solver-validated throughout, no
  rescue fallthrough below 65. Suite 236→246 checks incl. scanning weave
  gates. (6bc1f9a..76a0fd6; plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] phaswiki oversee run: in-game wiki shipped
  (cogwheel → WIKI, 7 hash-routed pages, live search under the reload
  button) with the tactics registry grown to 12 (push the puddle, launch
  and freeze, fence with stone) and a liquid-shove suite guard. Suite
  228→236 checks. (6711ad9..21929a2; plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] phaspolish oversee run: STUCK now plays the solver
  script as a visible 4x ghost (staggered fly-home fallback for authored
  levels), frost buckets stripped below L25 (frost debuts at Standing
  Water), complexity score shown on the level-clear screen. Suite 195→228
  checks. (3824b99..a0c917d; plan archived to .claude/plans/DONE/)

- 2026-07-31 [phasic] CD playtest of the 8-block curriculum: **passed,
  signed off** (with two new requests recorded to the backlog: tactic #10
  "push the puddle", and the in-game wiki → `phaswiki` plan).
- 2026-07-31 [phasic] v4: curriculum blocks of 8 (drag → flames → grav+gas
  → liquid base → gas base → void → bush → fan), formalized complexity
  metric, symmetric base-state reversion, three obstacles with fail/retry,
  tactics registry, 195-check drive suite. (ffaf9f0)
- 2026-07-31 [phasic] v3: flame reversion, live sockets, solver-validated
  endless generation, STUCK auto-solve. (d7aaab9)
- 2026-07-31 [phasic] v2: rename gemflow→phasic, gravity-well bucket,
  casual 16-level campaign. (e17acf9)
- 2026-07-31 [phasic] v1: soft-body phase-change block sort shipped as
  gemflow. (e14e404)

Pre-backlog history lives in `.claude/games-index.md` and each game's
context file.
