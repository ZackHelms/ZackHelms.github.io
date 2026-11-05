# dsweather: handoff to finish the run (written 2026-11-05)

The oversee run of `.claude/plans/dsweather.rain-fog-snow.md` stopped on quota with steps 1-8 done and
green. What is left is **step 9 (ship)**, plus the oversee wrap-up's bookkeeping. This file is the whole
brief. You do not need the original session.

## State

- **Branch `ds-weather` on origin, at `a4813e9`** plus this handoff commit. Base: `a7ddfc0` (origin/main
  when the run began). Commits:
  - `9bbb754` task 0: the main suite reads `SMOKE_CHROMIUM` first
  - `0f9b977` step 1: state, timeline, dropdown
  - `b76e979` step 2: sky, fog, light, headlights
  - `f870415` step 3: rain and wet roads
  - `3c7dc19` step 4: windscreen and wipers
  - `8b9c8ba` step 5: snow, road by class, DS-11 lawns
  - `96665fc` step 6: grip and traffic
  - `6da0360` step 7: sound and "tire" labels
  - `a4813e9` step 8: breaks, frame cost, docs
- **Gates at `a4813e9`** (Windows box, each run alone): `gates.sh --no-drive` GREEN (smoke, games-sync,
  negtest scan); main suite **158/0**; weather suite **37/0**. Break list: 79 -> **117**, all 38 new breaks
  caught.
- **Decisions, deferred items and things for the CD's eye:** `.claude/plans/dsweather.rain-fog-snow.follow-up.md`.
  Assumed rows, architecture, testing and frame cost are already in `.claude/driving-simulator.md`.
- **Not done yet:**
  - the badge stamp;
  - the plan's Status line and Results section, and moving it to `DONE/`;
  - `TODO.md` and `DONE.md`;
  - landing on `main`;
  - the Pages check;
  - the CD's report.

## Rules

- **Another Claude session pushes to `main` too** (Combat Simulator). Never commit its files.
  - Use explicit pathspecs; never `git add -A` or `git add .`.
  - Never author a merge commit on `main`.
  - Fetch and check `git rev-list --count HEAD..origin/main` right before any push.
- Conventional Commits, ending with the session's own Co-Authored-By / Claude-Session trailers. No model
  names in files.
- Spelling: "tire", never "tyre", in new prose. Identifiers and saved keys (`tyres`, `tyreG`, `noTyres`)
  stay.
- Producer config: `.claude/zmh/producer.md` (§ Integration, § Publish, § Reporting). Read it.

## Steps

1. **Check out the branch.**
   ```
   git fetch origin
   git checkout -B ds-weather origin/ds-weather
   ```

2. **Sync with main.** If `git rev-list --count HEAD..origin/main` is non-zero, run
   `git merge origin/main` **into `ds-weather`**.
   - Resolve `TODO.md`, `DONE.md`, `.claude/tests/README.md`, `games/CLAUDE.md` and
     `.claude/zmh/producer.md` by keeping both sides' additions.
   - A real conflict in `games/driving-simulator/` cannot come from the other session. Stop and report if
     you see one.

3. **Stamp and gate.**
   ```
   bash .claude/scripts/stamp-badge.sh games/driving-simulator/index.html
   node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html
   ```
   Read the badge string back out of the file (`build YYYY-MM-DD HH:MM UTC`). Then run the gate as **three
   separate foreground calls**, each under 10 minutes, with nothing else running Chromium:
   ```
   bash .claude/scripts/gates.sh --no-drive games/driving-simulator/index.html
   node .claude/tests/drive-driving-simulator.cjs
   node .claude/tests/drive-driving-simulator-weather.cjs
   ```
   `gates.sh` with no flag runs both suites in one call, which can pass 10 minutes.
   - Expect GREEN, 158/0 and 37/0.
   - In a remote container Chromium is at `/opt/pw-browsers/chromium`, and `gates.sh` finds
     `playwright-core` itself. For the two `node` calls, export the same `NODE_PATH` if they cannot find it
     (`.claude/scripts/README.md` § smoke-mobile).
   - Timed rows (sound, perf) can flap under load: re-run once, alone, before calling one red.
   - The main suite's date-at-midnight row is a known rare flake (follow-up file).

4. **Close the plan.** In `.claude/plans/dsweather.rain-fog-snow.md`, set
   `**Status:** IMPLEMENTED 2026-11-05`, with the commit range and the landed SHA once known (or "landed as
   one commit on main, see DONE.md"). Append a `## Results` section built from:
   - the follow-up file;
   - `.claude/driving-simulator.md` § Measured (frame cost 1.15-1.26x Clear in every case, against the 1.5x
     trigger);
   - the measured numbers below.

   Then move both files:
   ```
   git mv .claude/plans/dsweather.rain-fog-snow.md .claude/plans/DONE/
   git mv .claude/plans/dsweather.rain-fog-snow.follow-up.md .claude/plans/DONE/
   git rm .claude/plans/dsweather.handoff.md
   ```
   Stage edits before the `git mv`.

5. **Backlog.**
   - `TODO.md`: remove the `[driving-sim]` "Weather: rain, fog and snow" entry (DS-8 + DS-11, the one that
     ends "Plan ready (2026-11-04)").
   - DS-9, DS-10 and DS-12 in § Next say "plan this once dsweather lands": change each to say it is ready
     for `/zmh-producer:backlog-plan-gen driving-sim`.
   - Add a **Needs Zack** playtest entry for DS-8/DS-11 at the badge string. The playtest is the plan's
     § Validation list, plus the follow-up file's "For your eye" items: sparse snowfall, Auto's snow share,
     the wiper rates.
   - Leave the existing DS-2/3/4/6 playtest entry as it is.
   - `DONE.md`: a newest-first entry for 2026-11-05 with the badge string, one line on what shipped, and a
     pointer to the archived plan.
   - Commit on `ds-weather` with explicit pathspecs.

6. **Land.** Write the message file:
   `feat(driving-simulator): rain, fog and snow, Auto or picked (DS-8, DS-11)`, a short body, then the
   session's trailers. Then:
   ```
   bash .claude/scripts/land-on-main.sh ds-weather <msg-file> --dry-run
   bash .claude/scripts/land-on-main.sh ds-weather <msg-file>
   git push origin ds-weather
   ```
   - The first line must print `LAND: DRY`; the second, `LAND: GREEN sha=...`.
   - If the land prints `behind`, `origin/main` moved: merge it into `ds-weather`, re-run step 3's gates,
     and land again.
   - `git push origin ds-weather` keeps the per-step commits.
   - Then check that the other session's files survived:
     `git diff --stat <landed-sha>~1 <landed-sha>` should show only driving-sim files, docs and plans.

7. **Verify the deploy.** Per `.claude/zmh/producer.md` § Publish:
   ```
   gh run list --repo ZackHelms/ZackHelms.github.io --workflow "pages-build-deployment" --limit 2 --json headSha,status,conclusion,databaseId
   ```
   Match `headSha` to the landed SHA. Check twice a few minutes apart, then report either way.

8. **Report to the CD:**
   - outcome and the landed SHA;
   - the badge string;
   - the playtest list;
   - the decisions to review (the follow-up file's "Numbers moved off the plan" and "For your eye");
   - frame cost;
   - that DS-9, DS-10 and DS-12 are ready for `/zmh-producer:backlog-plan-gen driving-sim`.

   Skip `/zmh-producer:refine-context`: step 8 already wrote the run's learnings into
   `.claude/driving-simulator.md` and `.claude/zmh/producer.md`. Remote branches cannot be deleted from a
   cloud session, and the CD does not want to be asked to delete them.

## Measured (for the Results section)

| Measure | Result | Band / target |
|---|---|---|
| Fog visibility | MOR off pixels: Fog 0.2 sigma 0.00746 | target 0.0075 |
| | Fog 1.0 sigma 0.0222 | target 0.020, inside 20% |
| | Clear, 300 m vs 50 m contrast | 0.782 |
| Rain | changes 1.2% of the chase frame, in one instanced draw | - |
| | streaks lean +-52 deg at 30 m/s | - |
| Wet asphalt | 0.649x dry, linear | - |
| | night highlight under a streetlight 168 -> 209 | - |
| Windscreen | drops on 3.5% of the region | - |
| | wiper cycles in 30 s: 5 / 23 / 33 | 4-7 / 19-26 / 28-37 |
| | frame copy 7.9-10 ms; refraction shipped | - |
| Snow | two-lane lane 0.80 reflectance, tracks 0.52x, yellow contrast 0.004x Clear's | - |
| | highway lanes 0.89x dry, lines 0.97x / 1.08x, shoulder 0.73 | - |
| | lawn hue 94-95 deg in winter | - |
| Braking 60-0 | wet 1.407x dry | v^2/2mug: 1.43x |
| | snow on rural2 3.107x | about 3.3x less drag |
| | snow on treated highway6 1.403x | - |
| | half-lock step steer at 20 m/s: slip 0.479 dry, 2.0 on snow | - |
| Traffic speed vs Clear | rain 0.906, fog 0.843 | - |
| | snow on treated roads 0.772, snow on two-lane 0.598 | - |
| | new cars spawn at 0.92 / 0.60 | - |
| Sound | rain 3.59x louder at 0.9 than at 0.25 | - |
| | cockpit 0.967x outside, centroid 1195 Hz against 6027 Hz | - |
| | wet tires 1.99x dry | - |
| | wiper envelope period 1.33 s | cycle 1.333 s |
| | no AudioNode created in 600 ticks | - |
| Frame cost | 1.15-1.26x Clear across Rain / Fog / Snow, chase / cockpit, both orientations | trigger 1.5x |
