# DONE — done log

- 2026-10-26 [taas] **Robot factory v2** (the CD's brief, no Q&A by request), a page of its own on
  the same mode dropdown in both pages: the planer and the sap extractor run by themselves from
  hoppers into their output bins; a raw materials bin that a dump truck (its tail end in the yard)
  fills ten for $10 whenever it is empty; a terminal and an elevator for buying robots, calling them
  up from storage and sending them down; each robot's main prompt chosen by tapping a source then a
  destination on the floor, and up to six instruction lines from a four-list sentence builder, read
  first-match from the top, a nonsense line adding 5% to its slips. Measured: two haulers and a
  stocker with good lines meet goal 1 in about 10 minutes at 93-98% satisfaction. Suites 112 / 45,
  break lists 28/28 and 14/14; `gates.sh` now maps a game's second page to its slug.

- 2026-10-21 [taas] **Goals that unlock slots 02-04, bins and stalls filled by hand, flat $1
  prices** (the CD, 2026-10-20, with four answers): a new factory starts with one stall and slot 01;
  "Sell 50 medium planks" unlocks the sap extractor (02), over $50 and over 90% for 10 minutes on a
  countdown that starts over unlocks the bench (03), "Sell 25 sap" (a draft) the table saw (04);
  every bin and stall is a put/take bubble, a stall's Re-assign / Re-stock / Close with a green dot
  per thing, a machine run on the wrong thing jams; robots and stalls a flat $1 set under Prices in
  the menu. The goals persona meets all three on 12 of 12 seeds inside the hour; five eval claims
  changed substance at $1 (open question 19). Suites 358 / 159 / 35, break lists 216/214, 148/147,
  14/14; plan `.claude/plans/DONE/taasgoals.goals-arc.md`.

- 2026-10-17 [taas] **Four stalls and eight robots in the robot factory** (the CD,
  2026-10-16): stalls 2-4 bought for $50 / $100 / $150 and set by tapping to one of
  13 things (unsold stock to your arms), customers picking a stall at random, one
  stocking robot per stall with an "Only stock X" per thing, robots for the saw,
  the extractor and the bench that make no mistakes yet, robots $20 to $160. Two
  new Tips and open questions 12-15 from the eval's growing personas; the delay
  Tip corrected over twelve seeds. Suites 260 / 129 / 32; plan
  `.claude/plans/DONE/taasstalls.stalls-arc.md`.

- 2026-10-13 [cyoa2] **The second negative-test pass, finished**: 688 breaks
  at the last three pushes and step 4 (voice 122, script 190, table 129, book
  154, step 4 93), every one caught by a named row or written up as having no
  effect; 925 checks. It found a defect as well as holes: a name such as
  "constructor" passed every table lookup made by truthiness, so a guest could
  make the host's engine throw and a hostile save could reach a built-in
  function. Fixed with `own()` at every lookup a file, a guest or a tool can
  name (`90bdc2b`), with rows and 18 breaks at the new sites.

- 2026-10-13 [cyoa2] **Step 4: other phones at the table.** One phone hosts
  the tale, the Game Master, the keys and the voice; others in the same room
  join by QR code, phone to phone over WebRTC with no server and no STUN, see
  the same board and story, and play their own travellers by acts the host's
  engine judges. The CD's four answers (QR in the room, all on the host, each
  plays their own, the host takes over). A hand-written QR encoder checked
  against segno. Also: the Compare table fits a phone once the real font loads
  (`eade9ba`), and the voice list of the second negative-test pass (122 breaks,
  14 holes closed with rows, the rest caught or of no observable effect).

- 2026-10-11 [cyoa2] The narrator's **paid voice**: OpenAI's speech on the
  player's own key, as CYOA has it, with the device's voice as fallback and
  its cost estimated in the ledger (`334f14e`); the Game Master dropdown in
  the CD's words, "Scripted (free)" / "AI (Claude api key)", and the five
  under it shortened (`ea48684`). The CD asked for both after playing the
  scripted table. Suite 807 checks; what is still to be heard on a phone is
  in TODO § Needs Zack.

- 2026-10-10 [cyoa2] Step 3 complete: two Game Masters over one engine, a
  script by default and Claude per area with a twin, tags, ratings and a
  Compare page (`d7cc8a2`); then the narrator's voice, a microphone, notes
  and a rule book (`4b316cd`). Design record: `.claude/cyoa2.md`.

- 2026-08-29 [phasic] Launch-block audition PASSED — the CD signed off on
  the block-8 playtest and the `Launch` / `The Flue` name+hint wording
  (backlog-refine interview). Closes phasacro's "Blocked — needs you"
  items; its deferred endless-launch-weighting question is unblocked and
  now sits in TODO `## Next`.

- 2026-08-02 [phasic] phasport oversee run: the Phasic iOS app —
  imported into `rn-ios-flightdeck` as a GameShell WKWebView app
  (`games/phasic`: 5-file www payload incl. wiki + license, 8 flattened
  app icons from the 1024 master, sourceRepo fixed) with
  `PREFLIGHT=pass`, `IOS-PRIVACY: GREEN`, jest green; site side gained
  the file://-outside-test shell-chrome guard (hides `#back-btn` +
  `#build-badge` in the shell; drive suite 399→400) and the
  downstream-consumer note in `.claude/phasic.md`. TestFlight build
  stays CD-authorized — Apple per-game checklist handed over in the
  follow-up. Site commits `5e7befa..ebe7ef5`; flightdeck `7436db7`
  (pushed, `6889eee..7436db7`). Plan archived to `.claude/plans/DONE/`.

- 2026-08-02 [phasic] phasacro oversee run: the Launch block — 9th
  curriculum block (levels 65–72, indices 64–71), orb-less boards where
  launch-and-freeze (ram a settled puddle with a stone, frost it
  mid-flight) is provably the only way home. `CURRICULUM_END=72`,
  `blockOf` caps 8, `BLOCK_WORD` +'Launch'; endless now 73+ with a
  one-way save migration (acroV flag, 8 slots spliced at 64). Tutorial
  `The Flue` (AUTH[64]): socket in a roofed pillar fed by a 1-wide flue —
  stone-drag, pour, and resting-freeze all proven impossible (23-proof
  harness), the double-jab launch proven in-harness first (task-1 spike,
  deterministic byte-identical). Generated 65–71 via a `buildLaunch`
  template with three geometry rejects (stone-unreachable,
  pour-closure-dry, snap-excluded), mirrored sides, decoy ramp; solver
  launch leg uses `{t:}` — traced: `applySource('cold')` returns false on
  flame-heated commits. 139/140 salt wins, all serve salt 0; blocks 0–7 +
  endless byte-identical (pinned hashes held). Block-8 curriculum excluded
  from gravmazes/weaves; endless keeps everything. Suite 374→399; wiki
  tactic #11 now names the block. CD audition passed 2026-08-29
  (name/hint + block-8 playtest signed off at backlog-refine). (2878020..cd2cdb9 + wrap-up docs; plan archived to
  .claude/plans/DONE/)

- 2026-08-01 [phasic] phasmazes oversee run: obstacle-era gravmazes — the
  generated maze template now carries one hazard in blocks 5–7 and endless
  (newest idea first: fan b≥7 / bush b≥6 / void b≥5 when the maze gem is
  2-wide; width-decline falls back to walls-only). Eligibility is
  index-seeded (~0.20 of obstacle-era indices, ceiling 0.30) — a measured
  correction to the plan's per-salt odds: getLevel's wanted-scan hunts
  across all 20 salts, so 0.15/salt shipped mazes on 22/25 indices and
  crowded out every weave. Void = sealed floor recess behind a moved
  mouth; bush = full-height hedge one past the mouth (heat:2, revert-tap
  re-condense); fan = obstruction beam over the climb gate. mazeRouteOk
  build-time BFS rejects; scriptMaze hazard legs; 84/84 corpus
  solver-beaten. Block-2 byte-identity proven (1080-def zero-diff) and
  PINNED in the suite (SHA-256 + block-3 control canary; re-pin only on a
  CD-approved block-2 redesign). Suite 351→374. (dbe322b..618cee0 +
  wrap-up docs; plan archived to .claude/plans/DONE/)

- 2026-08-01 [phasic] phasdaily oversee run: daily challenge — a menu DAILY
  button serves one shared solver-proven generated level per UTC date
  (index = `DAILY_BASE` 100000 + UTC day number; `dateKey` YYYY-MM-DD).
  Results go to `save.daily[date]={t:seconds}`, never `save.done`, and
  `buildLvlSel` skips its rebuild in daily mode — both ~100k-index
  poison-traps guarded (sparse save array; 100k-option level list, which
  fires at LOAD, not just clear). Display `DAILY <date> · <name>` at all
  three sites (hint bar, clear screen, ghost hint); NEXT-from-daily returns
  to the menu; retry/replay/STUCK preserve daily mode; TEST `setDay(n)`
  day-pin keeps the suite clock-free. Catalog re-faceted (+`daily-challenge`,
  sync gate green). Suite 338→351. (ba26051..07113a1 + wrap-up docs; plan
  archived to .claude/plans/DONE/)

- 2026-08-01 [phasic] phasnames oversee run: block-lesson naming — every
  curriculum level (indices 0–63) displays as `Word · Name` via
  `BLOCK_WORD=['Drag','Flame','Gravity','Frost','Vapor','Void','Hedge',
  'Wind']` + `lvlName(i,def)`, at four display sites (level-select
  `N · Word · Name`, hint bar, ghost-replay hint, clear screen; the
  ghost-hint site was a preflight addition — the plan listed three).
  Display-layer only — defs, `genName`, `AUTH`, saves untouched; endless
  (64+) unprefixed by design. Suite 335→338 (per-block menu scan,
  `L1 · Drag ·` hintbar, endless-unprefixed). Curriculum-table block-2
  row relabeled to level numbers in passing. (b9994a7..f1fd53b + wrap-up
  docs; plan archived to .claude/plans/DONE/)

- 2026-08-01 [phasic] phasgrav oversee run: the gravity block (L17–24) is
  now genuinely orb-mandatory. New opener 'The Side Pocket' (index 16,
  one 2x2 gem + flame + orb, walled side alcove); Spring Cleaning left
  the block (def kept, unused). The CD's shove exploit proved broader —
  four maps were solvable by dragging the gem home AS STONE (no melt);
  all hardened by geometry (1-cell mouths, solid-unreachable pockets),
  The Kettle already proof, Master Facet's real shove killed (divide +
  far cellar). 'gravmaze' template for generated block-2 boards (sealed
  3-row tunnel + baffles; the literal 1-row serpentine is unsolvable for
  the soft-body pour, 0/24 vs 40/40 — lesson recorded); determinism
  byte-diff proven (only index 23's sub-0.60 salts changed). Suite
  317→335 (BFS impassability, docked-well negatives, per-map anti-cheese
  drags). save.done 16–18 shifted meaning. (2c759e6..c105ae4 + wrap-up
  docs; plan archived to .claude/plans/DONE/) *CD playtest verdict:
  PASSED, 2026-08-01 — block 2 signed off; the gravmazes follow-on was
  un-gated and planned the same day (phasmazes).*

- 2026-08-01 [phasic] phasaudio oversee run: obstacle SFX + per-block
  music — the void gulps (300→40 Hz sine + thump + swallowed noise), the
  hedge slurps (bandpass sweep + two blips), fan levels hum (one shared
  ~185 Hz loop, LFO, ≤0.05, loadLevel lifecycle, silent during solving/
  validation); sfxError back to genuine rejects only. Songs: blocks 0–7
  own songs 0–7 (`i<64?blockOf(i):i%10`), endless keeps the 10-song
  rotation. TEST-only `__SFXLOG` proves wiring; bush/fan check levels
  runtime-derived. Suite 300→317. (8ce92e4..5f730af + wrap-up docs; plan
  archived to .claude/plans/DONE/)

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
