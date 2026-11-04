# dsseasons follow-up (DS-3, oversee run 2026-11-03/04)

## Blocked - needs you

Nothing blocked. Playtest list in the plan's Validation section; the build is `build 2026-11-04 04:01 UTC`.

## Decisions made on your behalf - review

- **Preflight: clean.** The page and suite were unchanged since the plan was drafted (37afb17); base 81d0c48. No anchor corrections.
- **The tree-expert review was spawned by the overseer after step 2** (the step-2 implementer had no way to spawn it and reviewed by reading the KB first). Adopted in step 4, all winter only, spring's bytes unchanged:
  - `LIMB.attach` 0.9 -> 0.7: on the street trees, two canopy-sphere centres sat below the split, so their limbs drooped (a topped, pollarded look). Every scaffold now rises 36-65 deg from vertical (KB `architecture.md`: decurrent, 30-70 deg).
  - `LIMB.r0` 0.45 -> 0.40 trunk radius: da Vinci's rule, four limbs' area equal to the trunk's at the split.
  - Order-2 branches 3 -> 4 per limb, at 35/55/70/85% (KB: oak 4, birch 4, maple 5 per limb).
  - Winter bark (96, 70, 50) -> (100, 92, 82) for non-birch broadleaf trees, as a new `LOOK.bark` key. The reviewer marked this one borderline (a colour, but a new key); the overseer took it. Basis: KB oak bark, lighter for red maple's grey bark (inferred).
  - Step 2's own reading-review had already moved the limb radius 0.6 -> 0.45 and the order-2 branches 2 -> 3.
- **The ambient follows the chosen look (`lookSeason`), not `SETTINGS.season`**, so rows that move the calendar never change what is heard.
- **Birds are thinned by count, not by a die** (autumn every other bird, winter 3 in 10), and a skipped bird still draws its dice, so a thinned season hears a subset of spring's birds. A die had shifted the random stream: on some seeds autumn heard 1.76x spring's birds.
- **`KATYDID_GAIN` 0.3 -> 0.2** by measurement (0.3 read 3.4x spring's crickets; 0.2 reads 2.05x, band 1.3-2.5x).
- **The sound rows sample 8 s windows**, not the plan's 4 s, and hold the frame loop, seed `Math.random` and wait for 0.5 s of silence first.
- **The sunrise row covers spring too** (May 5, 06:18 / 20:05), four seasons not three.
- **A season switch rebuilds every loaded chunk at once**, inside the change handler while the menu has the game paused. Measured on SwiftShader: 46-52 ms into spring, summer or autumn, 120 ms into winter.
- **Step 5 was run by the overseer itself**, not a separate agent: it overlaps the wrap-up.
- Every choice not in the Design is a DS-3 row in `.claude/driving-simulator.md`'s "Assumed, not decided" table.

## Deferred / discovered follow-ups

- **The tree-expert's structural items** (in `.claude/driving-simulator.md` § Follow-ups, ranked). Winter crowns still read sparse, nearer dead snags than dormant trees. The fix is a twig layer, a sparse grey-brown shell, or alpha cards.
  - More scaffold limbs than the kit has canopy spheres, attached at staggered heights.
  - The flat trunk top showing on the leaderless street trees.
  - Spring as a fresh May yellow-green. This needs spring's byte-identity lifted. The reviewer found spring reads as mature summer green, so spring and summer barely differ.
  - Marcescent oaks and a holly understory.
  - Raleigh's species: loblolly pine in place of fir-1, river birch bark, willow oak street trees, a forest weighted to oak, hickory and pine. The KB needs articles for these first.
- **The forest's autumn mix** reads maple-heavy for the Piedmont (inferred by the reviewer); it is a species-pool question.
- **The radio rows** (`TODO.md` § Later) can now use the pattern DS-3 built: the season sound rows drive `SND.update(0)` on a 50 ms timer with `Math.random` seeded (suite section 9a). Ready for a plan-gen re-sweep.
- **A possible flake to watch:** in one full-suite run during step 4, "the ambient bed is there by day but well under the engine (0.05-0.4x)" read 0.049x. That row is timed by wall clock, and it was green in every gate run.
- **The winter bird row is near-trivial on most seeds** (8 s of winter often holds no bird). It holds one at 0.25-0.27x on the suite's seed, and the "winter birds unthinned" break was caught.
- From the plan: the look following the calendar inside a season, snow and weather, and fescue lawns staying green in winter (inferred).
