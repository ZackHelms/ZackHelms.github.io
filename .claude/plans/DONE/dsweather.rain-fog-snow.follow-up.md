# dsweather: follow-up (oversee run, 2026-11-04/05)

Run branch: `ds-weather` on origin (local worktree branch `worktree-oversee+dsweather`), base `a7ddfc0`.
Commits `9bbb754` (task 0) .. `a4813e9` (step 8), then the overseer's ship commit; landed on `main` as
one commit on 2026-11-05 at `build 2026-11-05 13:22 UTC`.

## Blocked: needs you

Nothing blocks shipping. After it ships: the playtest in the plan's § Validation.

## Decisions made on your behalf (review)

**Run mechanics**
- **Task 0:** the main suite launched Chromium only from `/opt/pw-browsers`; it now tries
  `process.env.SMOKE_CHROMIUM` first (`9bbb754`), as the combat suite and the gate scripts do.
- **The suite is split in two.** The main suite already took ~7.5 min on the Windows box, and one Bash call
  caps at 10. Every weather row lives in `.claude/tests/drive-driving-simulator-weather.cjs`, which `gates.sh`
  discovers by itself. Both suites pin Clear in `addInitScript`, only when no `weather` key is saved.
- **Step 9 is the overseer's wrap-up**, not a separate implementer (another session pushes to `main`).
- **The weather suite waits 60 s** for `goto`/`reload`, not Playwright's 30 (a page load took 23-29 s under
  a loaded CPU).
- **Breaks were run through harnesses cut from the weather suite by section** (each passed on the
  unbroken page first), not the whole suite per break.

**Numbers moved off the plan** (the bands held; the plan's rule is "move the number, not the band")
- **Plan defect (the drafter's):** the Clear fog row asked for 300 m contrast >= 0.85x of 50 m's, but the
  shipped haze gives exp(-0.00105 x 250) = 0.77. Clear may not move, so the row asks >= 0.7 (measured 0.782).
- Rain's overcast grey is ~0.28x the clear horizon (linear), not 0.55x, which read as bright as Clear on
  screen. `WX_GREY` is per kind: fog is brighter, so the dark road stands against it.
- Rain falls in a 24 m box (not 60) with streaks 1/30 s long (not 1/60). The plan's numbers drew 0.1% of
  the pixels.
- Wet asphalt is 0.4x (not 0.45x), with a sky reflection of 0.35 (puddles 0.7, not 0.6). The grey sky's
  reflection cancelled the darkening.
- Treated roads under snow take 0.4 of rain's sky reflection (a lane read 1.37x dry otherwise), and the
  sun's glint is scaled by `(1 - cloud)` (it glinted through full overcast).
- The windscreen draws while rain or snow **falls**, not while the road is wet. When it stops, the glass
  clears and the wipers park.
- DS-11's green also reaches the planting strips by town kerbs: the page colours them as lawn. One
  main-suite row ("grass by season") was restated, not deleted.
- A wet or snow trace under 2% counts as none, so an Auto clear day after rain is byte-identical.
- 21 assumed rows in total: `.claude/driving-simulator.md`, "Assumed, not decided", marked DS-8 / DS-11.

**For your eye at the playtest**
- **Snowfall looks sparse** at the plan's 4,000 flakes. Raising `PRECIP_MAX.snow` is the lever.
- **Auto snows on ~19% of winter days** (chosen 15%; real Raleigh is closer to 5%).
- **The wipers' rates** are the plan's guesses at real cars: one sweep every 6 s, then 45 and 65 a minute.

## Deferred / discovered follow-ups

- **A flaky date row** in the main suite ("the date is saved at midnight ... a second visit comes back to
  it"): 1 failure in 62 runs on this page, 0 in 56 on the base page. In the failure, the second page found
  no date in storage before any page script ran. Logged in `.claude/driving-simulator.md` § Testing as a
  browser storage race under load. If it recurs, the fix goes in the row (reopen when nothing is stored).
- In the cockpit the wipers keep sounding for up to one already-scheduled cycle after the game pauses.
- **Frame cost was measured while another heavy program ran** (1.15-1.26x Clear in every case, against the
  1.5x trigger). Absolute times are inflated; the ratios are what count. Tables: `.claude/driving-simulator.md`
  § Measured.
- From the plan:
  - thunderstorms;
  - splashes and spray;
  - stretched reflections of lights;
  - snow on cars, and snowbanks;
  - DS-9 / DS-10 / DS-12, which are ready for `/zmh-producer:backlog-plan-gen driving-sim` once this lands.
