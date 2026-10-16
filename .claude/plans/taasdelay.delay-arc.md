# taasdelay - TAAS robot factory: a delay between a robot's tasks (plan arc)

**Status:** IN PROGRESS (steps 1-5 done; step 6 open)
**Requested:** 2026-10-16, the CD's answer to the storefront's open question 2 (overproduction):
"Add an instruction that lets me add a delay between iterations of its task. Let the delay be a
configurable value, a positive integer 0,1,2,...,60 seconds." And one more fix the same day (step
1): "customers appear to go bald when they turn to face towards me (down)", the avatar too.
**Scope:** `games/taas/index.html` (the `FACTORY` engine and the factory UI),
`.claude/tests/drive-taas-factory*.cjs`, `.claude/tests/eval-taas-factory.cjs`,
`.claude/tests/negtests/taas-factory-*.json`, `.claude/taas.md`, `.claude/tests/README.md`,
`CLAUDE.md`, `games/CLAUDE.md`. Formal mode is out of scope and must stay at 43 / 39 / 9.

## The CD's four answers (asked 2026-10-16, before any code)

| Question | CD's answer |
|---|---|
| Which robots can take it? | **Every robot**: one instruction, any job (the operator waits between logs, the stocker between stockings). The first instruction that belongs to no one job |
| When does it join the list? | **From the start**: on the list as soon as there is a slot to put it in, not after a mistake (the first exception to "an instruction joins when its mistake is seen") |
| Does a robot ever ignore it? | **Slips 1 in 20**, like every instruction: about one iteration in 20 it goes straight on |
| What is one operator iteration? | **Every log it handles**: the wait comes after each press (once the cut is out) and after each log it tosses in the recycle bin |

## Design decisions for the build (assumed, not decided; record each in `.claude/taas.md`)

- **One delay per robot**, held as `r.wait` (whole seconds, 0-60), set from the slot that holds
  the instruction; the rule row is `{ id: 'delay', job: null, text: 'Wait between tasks', wait: true }`
  (wording assumed). A robot holds the instruction once, like any other.
- **Default 5 s** when it is first put in a slot (assumed: 0 would look like it does nothing).
- **The stocker's iteration** is one thing out of the bin: after each stocking and each recycle,
  never after a "looking for plank" (the thing went back, so the job is not done).
- **The slip is rolled once per iteration**, at its end, and **only when the wait is above 0**: a
  robot told to wait 0 s consumes no die, so its day matches a day without the instruction roll
  for roll (the "crossed wires" pattern in `drive-taas-factory.cjs` section 7).
- **A wait is a new robot state** (`pause`), entered from the end of an iteration and left after
  `r.wait` seconds; a job change or rest releases it like any other state (`release()`).
- **Evals**: "Waited between tasks" (green), and a slip "Went straight on, against its
  instructions" as a line of its own (yellow), per the fourth brief's rules.
- **Saves**: no version bump (a bump would wipe every player's factory): `load()` sets
  `seen.delay` and clamps `r.wait`, defaulting a missing one to 5.
- **UI** (step 3): the filled slot shows the wait with a slider (0-60, step 1) and - / + buttons;
  a waiting robot shows a pause sign with a ring that empties.

## How to use this arc

One step per session turn, then `/compact`. Each step has its own plan file with everything
needed to resume from disk alone. To run the next step after a compact:

> Run the next open step of `.claude/plans/taasdelay.delay-arc.md`.

At the end of each step: tick it below, write what it found under **Results** (numbers the
later steps need), commit to the branch `taas-delay` and push the branch (never `main` before
step 6).

## Arc

| # | Step | Plan file | Status |
|---|---|---|---|
| 0 | The CD's three answers recorded, the demand item in `TODO.md`, this arc | (this session) | DONE - on `main` |
| 1 | Fix: people keep their hair when they face the camera (cause traced: the hair sorts behind the head) | `taasdelay.s1-hair.md` | DONE 2026-10-16 |
| 2 | Engine: the delay instruction, `r.wait`, the `pause` state, evals, save/load; rules suite rows | `taasdelay.s2-engine.md` | DONE 2026-10-16 |
| 3 | UI: the slot's slider and steppers, the waiting robot's sign, Info text; page suite rows | `taasdelay.s3-ui.md` | DONE 2026-10-16 |
| 4 | Eval (does a delay end overproduction?) and both break lists (the hair too) | `taasdelay.s4-eval-negtests.md` | DONE 2026-10-16 |
| 5 | Docs final and gates | `taasdelay.s5-docs-gates.md` | DONE 2026-10-16 |
| 6 | Ship: badge, one clean commit, fast-forward `main`, push, Pages deploy, report to the CD | `taasdelay.s6-ship.md` | open |

## Results (shared memory between steps; append, do not rewrite)

- **Baseline (2026-10-16, `main` after the storefront):** rules `drive-taas-factory.cjs` 156
  checks; page `drive-taas-factory-ui.cjs` 86; eval `eval-taas-factory.cjs` 19 (8 personas);
  engine break list 100 of 101 caught; page break list 49 of 50. Formal 43 / 39 / 9.
- **Step 1 (2026-10-16), the hair:** built as an explicit hairline, not the planned cap (the cap left
  a bald patch on the crown seen from behind; traced in `taasdelay.s1-hair.md` § What was built).
  `hairOver(p, zh)` / `hairCap(nu, nv, col)` in the 3D kit, sorted as the head with bias +0.001.
  New test hook `TAAS_FACTORY.person(who, face)` over `bakePerson()` (split out of
  `personSprite()`). Page suite `drive-taas-factory-ui.cjs` **89** (86 + 3 rows in section
  16. hair); rules **156** GREEN; smoke GREEN. Five breaks `hair-*` appended to
  `taas-factory-ui.json` (now **55** entries) and caught **5 of 5** on copies; each of the three
  new rows catches at least one. Not fixed, outside the ask: a waiting customer's look baked
  mid-blink keeps its eyes shut while it waits (traced; offer the CD a one-line fix).
- **Step 2 (2026-10-16), the engine:** the row `{ id: 'delay', job: null, text: 'Wait between
  tasks', wait: true, start: true }` (last in `RULES`; `start` rows go on the list through
  `startSeen()` in `newGame()` and `load()`), `CFG.wait = { min: 0, max: 60, start: 5 }`,
  `r.wait` (5 on a new robot), **`F.setWait(s, id, sec)`** (integers 0-60 only, refused not
  rounded; allowed with the instruction in no slot; event `'waitset'`), the state **`pause`**
  entered by `done(s, r)` at the end of each iteration (operator: after a toss, after the cut is
  out or the planer jams, after a flick; stocker: after `cool`, never after a look), the eval
  lines **`'waited'`** (green) and **`'straight!'`** (yellow; the slip), written with `note()`,
  events **`'paused'`** `{ by, wait }` and **`'straight'`** `{ by }`. Taking the instruction out
  ends a wait; a toss you beat the robot to is no iteration. The UI has no `DOING` text
  for the two eval keys yet (step 3), and draws a pausing robot in its idle pose (step 3).
  The wait overlaps the next log rolling in (0.9 s), so an operator's gap is
  `max(wait, stageSec) + pressSec`. Rules **180** (156 + 24, section 12); page **89** (two picker
  rows updated: the list now holds the delay from the start); eval 19; formal 43 / 39; smoke
  GREEN. Engine break list **124** (23 `delay-*` appended; `misstock-green` re-anchored), **23 of
  23** caught after one row was widened; the whole list is step 4's to re-run. Overproduction, seed 51, ten minutes, instructed operator and stocker: no wait
  -> **16** medium planks in the bin (satisfaction 100%); 3 s -> **0** (1 at most). Seeds 51-53
  sweep: 2 s keeps satisfaction 100% but the bin reaches up to 10; 3 s holds the bin but
  satisfaction ends 38-98%; 4-5 s starves the line (11-18%). The useful band is narrow (2-3 s)
  and the 5 s default starves customers behind a fully instructed operator: step 4 should
  measure it and the report should put it to the CD.
- **Step 3 (2026-10-16), the UI:** a slot holding the delay wraps to a second line, `.fx-wait`:
  `-` / slider `#fx-wait` (range 0-60, step 1) / `+` / "N s" (`data-panel="wait:-1"` and
  `"wait:1"` through the click delegate; the slider on `input` -> `F.setWait` + `showWait()` in
  place, `change` -> save). `pageSig` holds `r.wait`; `renderRobot()` skips while `holdWait`
  (pointer/touch down on the slider), or the 60 fps redraw replaces the slider mid-drag; a redraw
  restores keyboard focus. At <= 360 px the row drops its indent. `pauseSign()` over a robot in
  `pause` (white disc, two bars, teal ring that empties; 27 px right while a mood badge is up) and
  a `calm` face; `DOING.waited` / `DOING.straight`; Info (Instructions + Green items). Page suite
  **99** (89 + 10 rows, section 17); rules 180; formal 43 / 39; smoke, parse, `negtest.sh scan`
  GREEN; factory eval not re-run (engine untouched). Page break list **71** (16 `delay-ui-*`
  appended), **16 of 16** caught on copies after one row was tightened (a stepper that never
  saved was hidden by the page's `pagehide` save: the row now reads the save before any frame).
  Every `old` in the four TAAS lists occurs once. Screenshots looked at: the robot page at 390
  and 320 (the first 320 shot put "5 s" off the panel; fixed with `width: 0` on the slider and
  `min-width: 0` on the row) and the pause signs in the scene.
- **Step 4 (2026-10-16), the eval and the break lists:** eval `eval-taas-factory.cjs` **23** GREEN
  (19 + 4): a ninth persona `paced` (the supervisor for an hour; once its operator holds its plan
  and a stall's worth of medium planks waits behind a full stall it puts the delay in a fifth slot,
  leaves the slider at 5 s and nudges it a second a minute by the bin; assumed player rule) beside
  `supervisor` for the same hour, seed 7. Supervisor's bin 116 medium planks at the hour and
  climbing; paced at most 12 in the last 20 min, 3 at the hour; served 297 vs 302; satisfaction
  100%; money **$658 vs $575** (+83 after the $25 slot). Opt-in sweep `EVAL_WAITS=1` (seeds 1-8,
  an hour, not asserted): tuned bin 3-10, 100%, +51..+120; **2 s** still overproduces (45-67),
  +23..+65; **3 s** bin 6-37, 100% on all 8, +60..+102; **4 s** starves 4 of 8 (10-33%); **5 s
  (the default) starves 8 of 8 (10-24%)**, -321..+53. For the CD: a 3 s start? (not changed).
  New list `negtests/taas-factory-eval.json` (4 breaks against the eval) **4 of 4**, each new
  row RED on its own break; the eval prints `PASS-ON-COPY` under `TAAS_PAGE`. Engine list
  **123 of 124** (miss `bubble-before-arrival`, the known equivalent); page list **70 of 71**
  (miss `no-remeasure`, the known equivalent); all 23 `delay-*`, 16 `delay-ui-*` and 5 `hair-*`
  caught. No suite rows added. A background shell stops at 30 min: run the page list with a
  longer `timeout` (it takes ~45 min at three jobs).
- **Step 5 (2026-10-16), docs and gates:** `.claude/taas.md` (the delay's section, four answers, 12
  assumed rows, open question 2 built, 8 a first answer, **new open question 10: what the delay
  starts at**, architecture, how to change it, Measured (the delay), negative tests 124 / 123,
  71 / 70, 4 / 4, frame cost, History), `.claude/tests/README.md`, `CLAUDE.md` and
  `games/CLAUDE.md` (the Depth row's second case: a part over another). **`GATES: GREEN`** with
  `--eval`; formal 43 / 39 / 9; factory **180 / 99 / 23**; frame budget median **16.7 ms**, p95
  16.7-16.8, 0-2 of 149 over (four runs). Step 6's report should carry: the delay (what it does,
  the four answers as built), the hair, the 5 s start starving the line (3 s works on all eight
  seeds; the CD's call), and the blink offer from step 1.
