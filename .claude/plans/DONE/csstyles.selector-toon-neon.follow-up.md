# csstyles - follow-up (oversee run of 2026-11-04, steps 4-6)

## Blocked - needs you

Nothing blocked. The looks are yours to judge (the plan's Playtest list, neon half):
- Does neon read as the site's arcade look? Are green you and red them clear at a glance?
- Is the bloom too much or too little? Its strength (0.9) and threshold (0.45) are the plan's guesses, unchanged.
- Does neon hold its frame rate on your phone? The bloom draws the scene a second time at quarter
  resolution (decision 1 below), so neon is the heaviest style.

## Decisions made on your behalf - review

1. **The bloom's draw calls were not escalated.** The plan's trigger was "the bloom adds more draw
   calls than neon's own main pass plus four". The plan's own design draws the scene again into the
   quarter-resolution target, which adds 9 calls with effects, plus 3 post passes: 12 added, against
   a bound of 13. A whole frame in neon is now 19 calls idle and 21 with effects (realistic 6/8,
   toon 8/11). If neon stutters on your phone, the cheaper bloom is a `blitFramebuffer` of the
   finished frame downsampled, with no second scene. That version is not built.
2. **Neon's palette row is stricter than the plan.** The plan said 85% of the brightest 2% of
   pixels must sit on the palette. The step-4 implementer raised this to 96%: the real frame measures
   99.2%, and the tonemapped break only drifts to 93.9%, so at 85% the hue half of the row could
   never fail. The row reads neon with `FX.bloom` off. A second clause keeps the shipped frame,
   bloom on, under the same 0.12 mean luminance.
3. **Two rows were added beyond the plan's count.**
   - "Neon draws no shadow pass" is the remedy the plan offered for `neon-shadows-on`.
   - "The bloom leaves no GL state behind" exists because `bloom-state-leak` cannot show in any
     picture: every frame resets blending before it draws.

   The suite is 96, not the plan's 79. The plan was drafted at 61; csparry took the baseline to 89
   before this run.
4. **The "you are green" row checks both bloom off and bloom on.** With the bloom on, `neon-rims-same`
   went MISSED: the halo of the opponent's own red edges carried red past 1.5x. The bloom-off frame
   catches it.
5. **Preflight corrections** (cosmetic drift, handed to the implementers as corrections):
   - the ENGINE block is now at lines 103-425, not 101-391;
   - the suite baseline was 89, not 74;
   - `combat-simulator.json` holds 32 breaks, not 19.
6. **This run ran on Windows, not the remote container.** Two small test-infrastructure fixes were
   committed:
   - the combat suite honours `SMOKE_CHROMIUM`, as seven other suites already do;
   - `negtest-copies.py` runs `negtest.sh` through `bash`.

   Both behave as before on Linux. Measured values matched the container's exactly; the realistic
   frame hash is the same on both.
7. **The WIP was used as found.** Step 4's paused work (`85bf3c2`) was cherry-picked. Every hunk was
   re-read against the design and none needed changing.
8. **The branch was pushed as `cs-styles-neon`**, as the off-box copy of the per-step commits.

## Deferred / discovered follow-ups

- **A cheaper bloom**, only if neon's frame rate is poor on your phone (decision 1).
- **`gates.sh` does not find Chromium or `playwright-core` on Windows by itself.** It needs
  `NODE_PATH` and `SMOKE_CHROMIUM` set; without them it reports RED rather than skipping. This is
  recorded in `.claude/zmh/producer.md` § Environment.
- The plan's own Follow-ups still stand and are yours:
  - every box edge in neon (a face-uv attribute);
  - styled HUDs;
  - the four open questions in `.claude/combat-simulator.md`.
