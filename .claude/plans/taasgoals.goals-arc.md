# taasgoals - TAAS robot factory: goals that unlock the slots, bins and stalls filled by hand, flat prices (plan arc)

**Status:** DRAFT (steps 1-7 open; build on branch `taas-goals`)
**Requested:** 2026-10-20, the CD's brief (verbatim, quotes straightened):

> - start with only one sales stall set to sell medium planks, and slot01 with the planer.
> - use the same add/remove interaction i have with the recycle bin to every input bin and output
>   bin and sales stall. Later i will have robots moving items between bins, and they will mess up
>   sometimes, so each station needs mechanics for what can go wrong with wrong inputs.
> - when i tap in a sales stall give me two options to choose from: "re-assign" and "re-stock". If
>   i tap reassign then it takes me to the current menu where i select what to sell in that stall.
>   If i tap restock then open the standard add/remove menu (with all items).
> - add green dots to the sales stall (one dot for each item in the stall) as a visual indicator of
>   how many items are stocked there. Put these green dots immediately above the price and item name.
> - i need to be able to add/remove with output bins too so that i can put the correct items there
>   for the robots to grab when restocking.
> - Change first goal to "Goal: Sell 50 medium planks", when it is completed the player is rewarded
>   with slot02 gaining the sap extractor.
> - second goal is "Goal: >$50 & >90% customer satisfaction for 10 minutes" where 10 counts down in
>   real time while customer satisfaction is above 90%, but resets to 10 if drops below 90%. Reward
>   is the handcrafting station added to slot03.
> - make the default cost of each new sales stall and robot a flat $1. Add settings menu options to
>   adjust this flat cost for robots and an option for sales stall cost.
> - allow a sales stall to be "closed" (similar to robot sleep mode) if i want to stop selling items in it.

**Scope:** `games/taas/index.html` (the `FACTORY` engine and the factory UI), the three factory
suites (`.claude/tests/drive-taas-factory.cjs`, `drive-taas-factory-ui.cjs`,
`eval-taas-factory.cjs`) and their break lists (`.claude/tests/negtests/taas-factory-*.json`), the
pose `.claude/scripts/poses/taas-factory-eight.js`, `.claude/taas.md`, `.claude/tests/README.md`,
`CLAUDE.md`, `games/CLAUDE.md`. Formal mode is out of scope and must stay at 43 / 39 / 9.

## The CD's four answers (asked 2026-10-20, before any code)

| Question | CD's answer |
|---|---|
| The goals put the extractor in slot02 and the bench in slot03; where does the table saw go? | **Slot04, goal 3**: slot04 starts empty and a third goal unlocks the saw there. Goal 3 drafted by Claude as **"Sell 25 sap"** (assumed; the CD may change it) |
| What does a machine do when run on the wrong thing? | **It jams**, like a sap log in the planer today: $5 to fix, and the thing goes to the recycle bin. An extractor on a log with no sap runs empty ($0.10, the log back). Stalls and output bins go wrong as now (wrong sales, misstocks) |
| Goal 2: money drops to $50 or below while the 10 counts down? | **Resets to 10**: both conditions must hold the whole 10 minutes; either failing starts the countdown over |
| The new menus replace two one-tap shortcuts (a stall stocks itself when you reach it; an output bin empties into your arms). Keep one? | **As written**: every bin and stall works like the recycle bin, no automatic action on arrival. Robots will do most of the carrying later |

The brief also answers open question 13 in `.claude/taas.md` ("Should a robot carry things between
machines?"): **later** ("Later i will have robots moving items between bins"). Record it in step 6.

## Goal

A new factory starts with one stall (medium planks) and only slot 01's planer; slots 02-04 are
empty bays. Three goals on the wall, one at a time, each unlocking a machine: sell 50 medium planks
(the sap extractor, slot 02), over $50 and over 90% satisfaction for 10 minutes on a countdown that
resets (the bench, slot 03), sell 25 sap (the table saw, slot 04). Every input bin, output bin and
stall opens the recycle bin's two-half put/take bubble and takes anything; a machine run on the wrong
thing jams. A stall's tap offers Re-assign, Re-stock and Close; its label carries a green dot per thing
in it. Robots and stalls cost a flat $1 each, set in the menu.

## Context

The stalls arc (`.claude/plans/DONE/taasstalls.stalls-arc.md`, shipped 2026-10-17 as e823c35) gave
four stalls, eight robots and all four slots from the start. This brief turns the start into a
progression (goals unlock the slots), makes every station a place things can be put in by hand (the
groundwork for robots that move things between bins, and get it wrong), and makes buying cheap and
adjustable so the CD can test staffing freely.

## Design to settle (assumed unless the CD rules; record each as an assumed row in `.claude/taas.md`)

**Start and slots**
- "One stall set to medium planks" is already the start (`stalls` in `newGame()`,
  `games/taas/index.html:926`); keep it and assert it in a rules row.
- **The slots' new order**: 02 the sap extractor, 03 the bench, 04 the table saw. Move the machines,
  not the numbers: `ROW` (`index.html:837`) becomes `{ planer: 4.0, extract: 7.3, bench: 10.1, saw: 12.75 }`.
  The saw and the extractor share `mill(y)`; the bench is hard-coded at y 12.35-13.25
  (`index.html:853`, `875`, `879`): re-express it relative to `ROW.bench` (offsets from 12.75: solids
  y-0.4..y+0.5, body y-0.4..y+0.4, spots y+0.95 / y+0.85, `benchBot` y+0.85).
- **A slot is unlocked by its goal** and is derived, never stored: `s.goal` (goals met, 0-3) says
  which. A locked slot has no machine, bins or robot post: not drawn (an empty painted bay with its
  number), not tappable (`tap()` refuses its places), not in `jobsOpen()`, and its solids are out of
  the walk grid (`rects()` / `grid()`, `index.html:1044`, whose cache key is only `hired` today:
  add `s.goal`).

**Goals** (`CFG.goals`, a table, one row per goal)
1. `{ id: 'planks', item: 'plank.m', n: 50, unlocks: 'extract' }`: counts every medium plank a
   customer pays for and carries away (`c.item` in `buy()`, `index.html:1357`), whatever the stall
   was set to (assumed). The board: "Sell 50 medium planks", **the number counting down as they sell**
   (mirrors goal 2's countdown; "Sell 1 medium plank" at one; assumed).
2. `{ id: 'steady', money: 50, sat: 90, sec: 600, unlocks: 'carve' }`: `s.goalT` counts down from 600
   s of engine time while `s.money > 50` and the satisfaction **as the board shows it**
   (`Math.round(s.satisfaction) > 90`, so what you see is what counts; assumed) both hold; any step
   where either fails sets it back to 600. Engine time is real time (the page's clock stops only when
   the tab is hidden or the test hook pauses it). The board: ">$50 & >90% customer
   satisfaction for 10 minutes" at rest, "for 9:41" (m:ss) while counting (assumed format).
3. `{ id: 'sap', item: 'sap', n: 25, unlocks: 'saw' }`: as goal 1, for sap.
- After goal 3 the board reads "All goals met" (assumed).
- A goal met fires `ev(s, 'goal', { n, id, unlocks })`; the page shows the machine arriving (step 3).
- `s.goalN` counts the current goal's thing sold since that goal began, and starts again at 0 when
  the next goal starts (assumed: a sap sold before goal 3 does not count toward it).

**Bins and stalls take anything**
- Every input bin (rack, sawIn, extractIn, benchIn), every output bin (bin, sawOut, extractOut,
  benchOut) and every stall bought opens the two-half bubble the recycle bin has (`options()`,
  `index.html:1845`; `binHalves()`, `index.html:4342`): what you carry on top (**every** kind, not
  filtered), what is in it below. No automatic action on arrival: an output bin no longer empties into
  your arms (`arrive()`'s `pick`, `index.html:1467`), a stall no longer stocks itself.
- `ACCEPTS` (`index.html:758`) stops filtering what goes in; what a machine is made for becomes a
  separate test (`RIGHT[key](item)`, or a `jams(key, item)`), used by the machines and the toss.
- A stall holds `CFG.stallCap` (6) things; a put fills it up to that and the rest stay in your arms;
  each goes in as `{ item, by: 'player' }` (a stall's stock is objects, not plain ids: `store()` does
  not cover it).

**A stall's bubble, in two levels** (`s.bubble = { kind: 'stall', i, menu }`)
- `menu: null`: **Re-assign**, **Re-stock**, **Close** (or **Open** when closed). The words are the
  CD's own and go on the buttons (they earn their place: the CD named them). An empty place still
  offers only "Buy a stall here" at the flat price.
- `menu: 'assign'`: a back button, then the 13 things in the rows they have now (`SELL_ROWS`,
  `index.html:4364`); choosing one sets the stall as now (unsold stock into your arms, its robot
  released) **without** stocking it, and the bubble goes back to `menu: null` (assumed).
- `menu: 'stock'`: a back button, then the two halves (your arms, any thing / the stall's stock, by kind).
- **Close** (the robot's rest icon, `ICON.rest`, the zzz): `st.closed = true`. Nobody new picks it
  (`openStalls()`, `index.html:1036`); a customer at it or on the way who is not already paying picks
  again among the open stalls (the `stall` die only when there is a choice) or, with none open, walks
  out at no cost to satisfaction (assumed); while no stall is open nobody comes in and no die is rolled.
  Its stock stays (dots included); its robot stands idle at its post; re-assign and re-stock still
  work. The label reads CLOSED in place of the price (assumed).

**Green dots**: one per thing in the stall (`st.stock.length`, at most 6), **all green** whatever the
thing (the CD's words; a wrong thing is a green dot too: follow-up), in a row immediately above the
price and the name on the stall's label (`drawPlate()`, `index.html:4037`).

**Wrong inputs (the CD: it jams)**
- **The planer**: anything on its in-feed that `makes()` calls `'jam'` jams it, which is already every
  sap log and every thing that is not a log. The operator's log instructions are about logs:
  `rejectsLog()` matches only `LOGS`, so a robot presses a plank and jams the planer (red,
  `jam:<item>`); no new instruction joins for it (follow-up). You never get it wrong (`work()`,
  `index.html:1485`, tosses anything not yours, as now).
- **The table saw** jams on anything but a plank (rough planks included); **the extractor** jams on
  anything but a log, and runs **empty** on a normal or gnarled log (a run, $0.10, the same log back
  out, no sap; yellow for a robot, `empty:<log>`); **the bench**: the chisel breaks on anything but
  gnarled wood (gnarled logs, rough planks) and the bench is jammed the same way.
- A jam on a slot: the run is charged at the press as now, the machine stops `CFG.jamAt` into the
  run, and stays jammed until you tap it and scrub it (`CFG.fixCost`, $5, the planer's `clean` act
  generalised with `on: key`). **Every jam, the planer's sap jam included, puts the jammed thing in the
  recycle bin when it is cleaned** (one rule everywhere; today the sap log vanishes: restate any row
  that counts the recycle bin). A robot on a jammed machine waits (`mood: 'stuck'`), red
  `jam:<item>` in its evals.
- **You at a slot never get it wrong**, as at the planer: a press when the first thing in its input
  bin is not what it is made for (the clean log in the extractor included) tosses that thing in the
  recycle bin instead (a `toss` act), one per tap.

**Flat prices**
- `CFG.flat = { robot: 1, stall: 1, min: 0, max: 200 }` replaces `CFG.hire` and
  `CFG.stalls.prices` (`index.html:677`, `706`); the state keeps `s.flat = { robot, stall }`;
  `setFlat(s, what, dollars)` whole dollars, clamped. `hirePrice()` is `s.flat.robot` until eight are
  hired (`CFG.names.length`), `stallPrice()` `s.flat.stall` while a place is left (`index.html:1032`, `1034`).
- The menu (factory mode only) gains **Prices**: "Robot $1" and "Stall $1", each with - / + steppers
  and the amount; no range input (see Gotchas). It changes the live factory and saves it. "Start over"
  keeps the current prices (a setting, not progress; assumed).

**Saves**: version stays 3 (a bump wipes every player's factory). `load()` (`index.html:1975`) fills:
`s.goal` missing means a save from before this brief, **all three goals met** (it keeps every slot and
whatever is in their bins; assumed), `s.goalN` 0, `s.goalT` 600, `s.flat` $1 / $1, `st.closed`
false, jams kept. It must stop filtering bins by `ACCEPTS` (it does today for the rack, the mills'
input bins and the bench's, `index.html:1996`) and stop resetting a non-log on the planer's in-feed,
or a save loses what was put in by hand.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md` section
Plans). One task per arc step; each is one session's work and one commit on `taas-goals`.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Engine: goals, unlocks, the slots' new order, flat prices, saves; rules rows | cross-system | opus | high | engine state + walk grid + save migration + ~40 restated rows; design judgment on what each old row now means |
| 2 | Engine: bins and stalls take anything, the stall's two-level menu, closing, wrong-input jams; rules rows | cross-system | opus | high | touches the shop, the avatar, three machines and the stocker at once; the jam rule changes existing counts |
| 3 | UI: empty bays, the slots' new order on screen, the goal board and its countdowns, a machine arriving, Prices in the menu; page rows; the eight pose | ui | opus | high | baked sprites, hit-test gating and the shared menu (formal's suite reads it) |
| 4 | UI: output-bin and stall bubbles, the green dots, CLOSED, jams drawn on slots 02-04, Info rewritten; page rows | ui | opus | high | bubble layout at three sizes, canvas pixel rows, tracing any flaky row before trusting it |
| 5 | Eval (the goals reachable over twelve seeds, the economy at $1) and all three break lists; frame cost | eval | opus | high | measurement honesty: claims restated over seeds, causes traced, ~2 h of break-list runs |
| 6 | Docs final and gates | docs | sonnet | high | long but mechanical: every count and name read from the code, nothing new designed |
| 7 | Ship: badge, one commit, fast-forward `main`, Pages, report | ship | sonnet | medium | the documented procedure, exact commands below |

- **Ordering / dependencies:** strictly 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 (each builds on the last;
  all touch `games/taas/index.html`). Parallel-safe: none.
- **Files owned per task:** 1-2: the `FACTORY` block of `games/taas/index.html` (plus the minimal UI
  lines that would otherwise throw, named in each step) and `drive-taas-factory.cjs`; 3-4: the factory
  UI block, `drive-taas-factory-ui.cjs`, the pose; 5: `eval-taas-factory.cjs`, the three break lists;
  6: the four docs; 7: the badge line and the plan's move to `DONE/`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/taas/index.html` after
  every edit; the step's suite green with its new rows; `.claude/scripts/gates.sh games/taas/index.html`
  GREEN at the end of every step (add `--eval` from step 5 on). Formal 43 / 39 / 9 every step.
- **Tier audit (required):** no step passes a haiku checklist: 1-5 each need design judgment across
  engine, page and suites (and 5 needs causes traced in data); 6 must read every name and count out of
  the code (sonnet, high); 7 is the procedure but pushes to `main` and verifies a deploy (sonnet, medium).
- **Decision defaults:** everything under "Design to settle" above. Beyond it: prefer the existing
  pattern (the recycle bin's bubble, the planer's jam and `clean`, the robot's rest icon); a choice not
  listed here goes into `.claude/taas.md` as an assumed row, never silently. A suite row that the new
  rules contradict is **restated** (same claim, the new rule) and named in Results, never deleted to go
  green. If goal text and space conflict on the board, shrink the text (`fitText`), never drop words.
- **Embedded-content QA:** suite counts below are baselines; each step's new total is baseline + rows
  added - rows removed, stated in its Results. Offsets and line numbers were read on e823c35; re-read
  before editing (each step moves lines).
- **Escalation triggers** (stop and report to the CD, do not retune): a goal no persona reaches inside
  an hour on most of the twelve seeds, or goal 2's countdown that never completes on some seed (the
  numbers are the CD's); anything that would need a save version bump; formal's 43 / 39 / 9 moving;
  the frame budget missing (over 5 of 149 frames with the eight pose; assumed threshold) after a
  reasonable fix.
- **Playtest** (after step 7): a new game shows one stall and only slot 01; the goal board's number
  counting down for planks; slot 02's extractor arriving at 50; goal 2's countdown, and resetting when
  satisfaction dips; the bench in 03; 25 sap and the saw in 04; Re-assign / Re-stock / Close and the
  zzz; the dots; putting things into output bins and robots fetching them; a plank in the planer's
  input bin jamming it under a robot; Prices in the menu. Also: is "Sell 25 sap" the right goal 3?
- **Publish:** step 7 pushes `main`, which is the publish; verify the Pages run (producer config section
  Publish). Steps 1-6 push the branch only.
- **Commit strategy:** one conventional commit per step on `taas-goals`, scope `taas`, ending
  "(taasgoals step N)"; step 7 lands the branch on `main` as one commit (its tree the branch's last).

## Resume here (a session told "run the next open step of this arc")

1. Read `CLAUDE.md` (concurrent sessions push to `main`; never author a merge commit on `main`;
   `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main` immediately before
   any push to `main`).
2. Read this file in full: the brief, the four answers, "Design to settle", the steps and every
   step's Results.
3. Read `.claude/taas.md`: section Tips; section Robot factory mode's "Assumed, not decided" table (from the row
   "Stalls: ..." on), section Open questions (factory), the newest section Measured, section Negative tests (factory),
   section How to change it (factory).
4. Check out `taas-goals` (create it from `main` at step 1). Run the first step in the table that is
   not DONE, and only that one. Then: tick it, append a Results section (append, never rewrite),
   commit, push the branch, stop and report. **Never push to `main` before step 7.**

Tools:
- Gates: `NODE_PATH=/opt/node-tools/node_modules .claude/scripts/gates.sh games/taas/index.html` (add
  `--eval` for the evals); `node .claude/scripts/check-inline-js.cjs games/taas/index.html` after every
  edit. Chromium is at `/opt/pw-browsers/chromium`.
- Break lists on copies, after running the suite once on the unbroken page:
  `NODE_PATH=/opt/node-tools/node_modules python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/taas-factory-ui.json --page-env TAAS_PAGE --jobs 3 --freeze .claude/tests/drive-taas-factory-ui.cjs -- node .claude/tests/drive-taas-factory-ui.cjs`
  (the engine and eval lists the same with their suites; `--only a,b` for a subset). The page list
  takes about 80 minutes: never edit the page while it runs.
- Frame cost: `NODE_PATH=/opt/node-tools/node_modules node .claude/scripts/frame-budget.cjs games/taas/index.html select=#mode-btn:robot-factory evalFile=.claude/scripts/poses/taas-factory-eight.js`;
  never measure while other Chromium jobs run.

The CD's standing preferences: keep replies short; plain ASCII only (straight quotes, plain hyphens, no
curly quotes or en/em dashes); label anything inferred, assumed or sourced ("inferred:", "assumed:",
"source: X"). A cause reported to the CD must have been traced in code or data, otherwise call it a
hypothesis. Don't ask the CD about deleting remote branches. Ask before writing code only if a design
question is genuinely unclear.

## Steps (one per session, then `/compact`; each ends: tick here, Results, commit to `taas-goals`, push the branch)

| # | Step | Status |
|---|---|---|
| 0 | The CD's brief and four answers recorded (this file) | DONE 2026-10-20 |
| 1 | Engine: goals and unlocks, the slots' new order, flat prices, saves; rules rows | DONE 2026-10-20 |
| 2 | Engine: bins and stalls take anything, the stall's menu, closing, wrong-input jams; rules rows | DONE 2026-10-20 |
| 3 | UI: empty bays, the slots' new order, the goal board, a machine arriving, Prices in the menu; page rows | DONE 2026-10-20 |
| 4 | UI: bin and stall bubbles, green dots, CLOSED, jams on slots 02-04, Info; page rows | open |
| 5 | Eval (goals reachable, the economy at $1) and all three break lists; frame cost | open |
| 6 | Docs final and gates | open |
| 7 | Ship: badge, one commit, fast-forward `main`, push, Pages, report to the CD | open |

### Step 1 - engine: goals, unlocks, the slots' order, flat prices

- `CFG.goals`, `CFG.flat`; `s.goal`, `s.goalT`, `s.goalN`, `s.flat` in `newGame(seed)` (an optional
  second argument carries `flat` over for "Start over"). Count sales in `buy()`; check the current
  goal once per sub-step in `step()` after `stepShop()`; the goal 2 countdown there.
- `ROW` reordered and the bench relative to its row (see Design). `unlocked(s, job)` derived from
  `s.goal`; `jobsOpen()`, `tap()`, `rects()` / `grid()` (cache key) honour it. Export what the page
  needs (`goalNow(s)` or the table plus `s` fields; `setFlat`; `unlocked`).
- `hirePrice()` / `stallPrice()` flat; `load()` per "Saves". Update the four `renderPanel()` lines
  that read `C.hire` / `C.stalls.prices` (`index.html:4435` on) just enough not to throw; step 4
  rewrites Info. The goal board's `goalText()` (`index.html:3978`) may show the old text until step 3.
- Rules suite: a new section 16 (the start, each goal counted and met, the countdown and both resets,
  "All goals met", each unlock opening its job, posts and places and the walk, a locked slot refusing
  taps and jobs, the new rows' posts reachable from every pad, flat prices and `setFlat` bounds, saves
  old and new). Existing rows that use slots 02-04 open them explicitly (`s.goal = 3` in a helper),
  rows about $20-$160 and $50-$150 are restated at the flat price. Baseline 260.

### Step 2 - engine: bins and stalls, the stall's menu, closing, wrong inputs

- `options()` / `choose()` (`index.html:1845`, `1874`) for output bins (`BUBBLES` gains them;
  `arrive()` stops the `pick`), stalls in two levels (`assign`, `restock`, `close`, `back`, `sell:`,
  `put:`, `take:`), every input bin unfiltered. Keep `pick` and `stock` in `ACTS` so an old save's act
  loads (it finishes or is dropped: decide and test).
- Closing per Design (`openStalls()`, `stepShop()` re-pick and leaving, the guard for no open stall at
  `index.html:1371` where `open[0]` would be undefined, `stocker()` idle).
- Jams per Design: the mills (`startMill()` / `stepMill()`, `index.html:1288`, `1304`) and the bench
  (`carver()`, the avatar's `carve`) gain a jam; `clean` generalised; every cleaned jam to the recycle
  bin; the extractor's empty run; your toss at a slot; `rejectsLog()` on logs only.
- Rules suite: section 17 (every bin's put and take, anything in, the output bins, a stall's three
  levels and back, re-assign without stocking, re-stock up to six and the rest kept, take back, close /
  open and every customer case, no customers with none open, the robot idle at a closed stall, each
  machine's jam on each kind of wrong thing, the extractor's empty run, the clean and the recycle bin,
  a robot's red `jam:` and its stuck wait, your toss, a stall robot fetching what you put in an output
  bin, saves with odd things in bins). Restate rows that counted the recycle bin or relied on auto-stock.

### Step 3 - UI: slots and goals on screen, Prices

- Sprites of a locked slot hidden (`onFloor()`, `index.html:3216`, gains a slot tag) and out of
  `TAPS` / `hitTest()` (`index.html:4660`, `4636`); the bench's sprites (`index.html:3110` on) and
  every hard-coded bench / saw / extractor y (puffs, `anchorOf()` at `index.html:4303`, `SLOTS` at
  `index.html:3801`) from `ROWY`; the floor's bays and numbers in the new order; the baked floor's key
  gains `s.goal`.
- The goal board (`drawBoards()`, `index.html:3993`): the three goal texts with their countdowns, "All
  goals met". The `goal` event: sparks and the `level` sound over the slot, the machine's sprites
  appearing, a float naming it ("slot 02: the sap extractor").
- The menu (`index.html:366-374`, its script from `index.html:2351`): a factory-only **Prices**
  section, two stepper rows (see Gotchas: no `input[type=range]`, no `.mi`), `F.setFlat` and a save.
  "Start over" carries `s.flat` over.
- `.claude/scripts/poses/taas-factory-eight.js` sets `s.goal = 3` (its slots and robots need them).
- Page suite: section 22 (a new game's floor: one stall, slot 01 only, empty bays not tappable; the
  board's text and countdown read off the canvas; a goal met by the engine shows its machine and the
  float; the slots' order on screen; taps on the moved bench and saw at three sizes; Prices in the
  factory's menu and not in formal's, steppers, bounds, saved, kept by Start over). Baseline 129.

### Step 4 - UI: bins and stalls, dots, CLOSED, jams, Info

- Output bins' bubbles (`F.SAMPLE` entries for the placeholders, `binHalves()` reads
  `F.SAMPLE[b.kind]`; `anchorOf()` for each); `renderBubble()` (`index.html:4366`) decides a bin by
  `F.ACCEPTS[b.kind]` today: route the stall's `stock` level to `binHalves()` and its `assign` level to
  `stallRows()`, its first level to three worded buttons; a back button (icon) on the second levels.
- `drawPlate(i)`: the dots row above the price and name, CLOSED in place of the price when closed.
  A closed stall's tray could also look shut (assumed: optional).
- Jams on slots 02-04 drawn as the planer's is (find its jam look in `draw()`), tappable to scrub.
- Info (`renderPanel()`): the goals and what each unlocks, the slots' order, re-stock and re-assign,
  closing, anything in any bin and what a wrong thing does, Prices in the menu; the Tips rechecked.
- Page suite: section 23 (each output bin's halves by real taps, a stall's three levels, back, the 13
  rows, re-stock filling and taking back, the dots counted on the canvas at 0, 1 and 6, CLOSED drawn,
  the zzz on, a slot jam drawn and scrubbed by a tap, Info's new paragraphs).

### Step 5 - eval and the break lists

- `eval-taas-factory.cjs` (`persona()` at line 105, `SEEDS` line 348, `GSEEDS` line 402): a **goals
  persona** that plays from a new game through all three goals on seeds 1-12 and prints the minutes to
  each and how often goal 2's countdown reset; rows: every goal is reached on most seeds (state the
  share measured; escalate per the triggers), nothing dead-ends (the "valid optimal path" rule of the
  fourth brief). The existing personas start with `s.goal = 3` and play at the flat $1; re-measure and
  **restate** each claim that moved (as the stalls arc's step 4 did), recheck the five Tips.
- Break lists: new breaks for every new rule (goal counts, the countdown's resets, unlock gating, flat
  prices, each bubble level, closing, each jam, the toss, the dots, CLOSED, Prices); repoint stale
  ones; run all three whole lists; trace any row that catches unrelated breaks before trusting it.
  Baselines: engine 144 (143 caught), page 108 (107), eval 9 (9).
- Frame cost with the eight pose: 0-1 of 149 over before this arc; it must stay inside budget.

### Step 6 - docs and gates

- `.claude/taas.md`: a stated section for this brief (the CD's words, the four answers, what was
  built), the assumed rows, open question 13 answered "later", new open questions (at least: goal 3's
  goal, an instruction for things that are not logs, a dot for a wrong thing), Architecture names read
  from the code, How to change it ("another goal", "a fifth slot"), the measured section from step 5,
  the header counts, History.
- `.claude/tests/README.md` (the three factory rows and the break-list counts), `CLAUDE.md` (the
  games/taas bullet and the TAAS row), `games/CLAUDE.md` (the TAAS entry).
- `gates.sh games/taas/index.html --eval` GREEN; formal 43 / 39 / 9.

### Step 7 - ship

- `.claude/scripts/stamp-badge.sh games/taas/index.html`, then read the stamp back out of the file;
  `check-inline-js` and `gates.sh` GREEN after the stamp.
- One commit on `main` whose tree is the branch's last commit (the plan moved to
  `.claude/plans/DONE/`, Status IMPLEMENTED); `git fetch origin main`, `git rev-list --count
  HEAD..origin/main` must be 0 right before the push (else merge `origin/main` into the branch, re-run
  the gates, and check the shared files' TAAS lines survived); fast-forward only.
- Verify the "pages build and deployment" run for the pushed SHA (`mcp__github__actions_list`,
  `perPage: 1`, match `head_sha`, read the jobs); budget two checks, then report.
- Report to the CD: the badge string, goal times measured, the assumed rows most worth a look (goal 3,
  the count-down texts, old saves with all goals met, the dots all green), the new open questions.

## Gotchas / bindings

- **Formal's page suite reads the shared menu**: `drive-taas-ui.cjs` section 9 (lines 327-336)
  asserts `#menu .mi` is exactly "Info,Exit game" and `#menu input[type=range]` exactly the three
  volumes. The Prices rows must not be `input[type=range]` or `.mi`, and must be hidden in formal mode.
  Formal must stay 43 / 39 / 9.
- **`load()` drops things today**: it filters the rack, the mills' input bins and the bench's by
  `ACCEPTS` (`index.html:1996` and above it) and resets a non-log on the planer's in-feed to
  `log.m`. With bins taking anything, both must go, or a reload loses what was put in by hand.
- **No open stall**: `stepShop()` computes `open[0]` (`index.html:1371`); with every stall closed it
  is `undefined` and a customer would come in for no stall. Guard it, and roll no die.
- **The walk grid's cache** is keyed on `hired` only (`index.html:1050`): a slot unlocking must
  rebuild it (add `s.goal` to the key), or robots walk through the new machine.
- **`renderPanel()` reads `C.hire` and `C.stalls.prices`** (`index.html:4435` on): removing them in
  step 1 throws when Info opens unless those lines change in the same step.
- **Bin bubbles' placeholders read `F.SAMPLE[b.kind]`** (`binHalves()`, `index.html:4342`):
  output bins and stalls need entries, or an empty half draws `mini(undefined)`.
- **A stall's stock holds objects** (`{ item, by }`), not ids; `store()` (`index.html:1415`) covers only
  bins. Put and take on a stall need their own path.
- **The bench is hard-coded at row 04** in the engine (`index.html:853`, `875`, `879`) and in its
  sprites (`index.html:3110` on); grep every `12.` and `13.` y in both blocks after moving it.
- **Suites can no longer use slots 02-04 from `newGame()`**: open them on purpose (`s.goal = 3`); never
  weaken a row to make it pass. Name every restated row in Results.
- **Named dice**: a new die only where there is a choice (the re-pick after a close); forced in tests
  through `s.force[name]`. A goal or a jam rolls nothing.
- **The player never gets it wrong** (`yours()` / `work()`, `index.html:1484`): keep it, and extend
  it to slots 02-04 as the toss.
- **Break lists**: run each suite once on the unbroken page first; never edit the page while a list
  runs; a row that catches unrelated breaks is flaky until traced (the stalls arc's bulb row was
  `Math.random()` puffs frozen by `tick(0)`).
- **Discovery over instruction** (`games/CLAUDE.md`): no helper text on the play surface beyond the
  CD's own button words and the goal board.
- Commits: explicit pathspecs (never `git add -A`), the session's Co-Authored-By / Claude-Session
  trailers, no model id anywhere in the repo.

## Validation

Per step, as in the guidance table. End to end: `gates.sh games/taas/index.html --eval` GREEN on the
stamped page (formal 43 / 39 / 9; factory rules, page and eval at their new counts), the three break
lists run whole with every miss explained, the frame cost inside budget with the eight pose, and the
Pages run for the pushed SHA concluded `success`. A playtest by the CD (above) is what no suite can do:
whether the goals feel right in pace.

## Follow-ups

- An instruction for things that are not logs on the planer (and for each slot) once robots move
  things between bins (the CD: "later").
- A dot that shows a wrong thing in a stall differently (the CD asked for green dots; assumed all green).
- Goal 3 and anything after it are the CD's to set; "Sell 25 sap" is a draft.
- Open question 12 (should a customer give up?) interacts with closing: still open.

## Results (append, do not rewrite)

- **Baseline (2026-10-20, `main` at e823c35):** rules `drive-taas-factory.cjs` 260; page
  `drive-taas-factory-ui.cjs` 129; eval `eval-taas-factory.cjs` 32; break lists engine 144 (143
  caught), page 108 (107), eval 9 (9); formal 43 / 39 / 9 (source: `.claude/tests/README.md` and the
  stalls arc's Results; list sizes counted from the JSON files).
- **Step 1 results (2026-10-20, engine: goals, unlocks, the slots' new order, flat prices, saves).**
  - **Built** (`games/taas/index.html`, FACTORY block): `CFG.goals` (the three rows as designed),
    `CFG.flat = { robot: 1, stall: 1, min: 0, max: 200 }` in place of `CFG.hire` and
    `CFG.stalls.prices` (`CFG.stalls` keeps `n` and `start`); state `s.goal` (0-3), `s.goalN`,
    `s.goalT` (600), `s.flat`; `newGame(seed, flat)` carries `flat` over (through `flatOf()`, clamped
    whole dollars, $1 each for none or nonsense) and nothing else. `buy()` counts the current goal's
    thing (`c.item`); `stepGoal()` runs once per sub-step after `stepShop()`: a count goal is met at
    its `n`, goal 2 counts `s.goalT` down while `s.money > 50 && Math.round(s.satisfaction) > 90` and
    sets it back to 600 on any step where either fails. A goal met: `s.goal++`, `s.goalN = 0`,
    `s.goalT = 600`, `clearWay()`, then `ev(s, 'goal', { n, id, unlocks })` (`n` 1-based). `ROW` is
    `{ planer: 4.0, extract: 7.3, bench: 10.1, saw: 12.75 }` and the bench's solids and spots
    (`benchIn`, `bench`, `benchOut`, `benchBot`) are offsets from `ROW.bench` (`by(d)`, `r2` moved above
    the layout). `SLOT_JOBS` is `['extract', 'carve', 'saw']`; `slotOf(k)` maps a place or a SOLID key
    to its slot's job; `unlocked(s, job)` is derived from `s.goal`; `placeOpen(s, k)`; `jobsOpen()`,
    `tap()` and `rects()` honour it; `grid()`'s cache key is `'h' + hired + 'g' + goal`.
    `hirePrice()` is `s.flat.robot` while fewer than `CFG.names.length` (8) are hired, `stallPrice()`
    `s.flat.stall` while a place is left; `setFlat(s, what, dollars)`; `goalNow(s)` returns
    `{ i, goal, done, left, t, counting }` for the board. Exported: `slotOf, unlocked, placeOpen, goalNow,
    setFlat` (and `CFG.goals`, `CFG.flat` through `CFG`). `load()`: version 3; goal, count, countdown and
    prices filled and clamped (below); `s.robots` sliced to `CFG.names.length`.
  - **UI lines changed** (the minimum, ahead of steps 3-4): `renderPanel()`'s three lines that read
    `C.hire` / `C.stalls.prices` now say `usd(s.flat.robot)` / "$1 each"; and, pulled forward from
    step 3 because rows 02 and 04 would otherwise paint over each other, the floor's `SLOTS` bays are
    by position from `ROWY` (02 the extractor's row, 03 the bench's, 04 the saw's: the same rectangles
    as before). Nothing else on the page moved: the saw, extractor and bench sprites already read
    `SO` / `ROWY`, so they draw at their new rows.
  - **Rules suite** `drive-taas-factory.cjs`: **260 -> 308** (48 added in a new section 16, none
    removed). Section 16: the tables; the start (one stall, medium planks, slot 01 only, $1 / $1, the
    goal now); locked slots as empty floor, taps on their nine places refused, the floor in a bay
    walkable, no slot job offered or chosen; goal 1 counted at the sale (not at stocking or paying), a
    medium plank from a 2x4 stall counted, a small one not, met at 50 with its event, the count reset,
    the extractor's job, places, footprint and a real extraction; nothing counted toward goal 3 while
    goal 2 is up; goal 2's countdown, a reset by money at $50 and by satisfaction shown as 90% (90.4),
    counting at 91% (90.6), no count below, a one-step dip after 5 minutes restarting the whole 10
    minutes (money and satisfaction each), met at 600 s, no countdown while goal 1 is up; goal 3 and
    "all goals met" (nothing more counts, no event again); every unlocked slot's posts on free floor
    and reached from every pad with 1 or 8 robots unpacked after each goal; a robot given the new job
    walks there and works; standing in a bay when its machine arrives, walking across it, and a robot
    walking through it (all go round); flat prices, `setFlat` bounds and refusals, $0 free below zero,
    the stall price, no stall price once all four are bought, `newGame(seed, flat)`; saves (new
    round-trip mid-countdown and carrying on identically, a count part way, an old save -> all met, a
    hand-edited save clamped, a count at 50 met on the next step); a goal rolls no die (two days roll
    for roll identical, one meeting goal 1 at its first sale). Twelve breaks applied to copies were
    each caught (no countdown reset, no grid key, no `clearWay`, counting by the stall's want, no tap
    gate, no job gate, no rect gate, unrounded satisfaction, old save -> 0, no flat carry, no $0
    exception, count not reset).
  - **Restated rules rows** (same claim, the new rule): section 1 "eight robots, each $20 more than
    the last" (now the flat $1 and its bounds, `C.hire` gone); "the counter has room for four stalls ...
    $50, $100 and $150" (now the flat $1); "slots 02 to 04 have a job each" (`extract,carve,saw`); "a
    robot slips on an instruction rarely ... names of their own" (`C.names.length === 8` in place of
    `>= C.hire.length`). Section 2 "from the back: ... slots 01 to 04 one under another" (the new row
    order); section 2 now runs on an open factory (`open3`), as do section 6's hiring rows, section 9,
    section 9's "a robot can be put on any of slots 02-04", section 11's random play and its save
    rows, section 13's "what you put in the table saw's, the sap extractor's or the bench's input bin"
    (and the stall row after it), section 15's `crew()` (every row) and its two dock-of-eight walk rows.
    Section 6 "at $19 the dock shows the $20 robot greyed" ($0.99 / $1), "at $20 a robot is hired" ($1),
    "the bubble turns straight to the new robot" (slot order), "the second robot costs $40" ($1), "the
    third to the eighth cost $60 to $160" ($1 each, and no price once sold out). Section 14 "the next
    stall costs $50" ($1), "its bubble offers a stall for $50, out of reach with $0" ($1), "with $60 it
    is $50" ($1.50 / $1), "the next costs $100 and the last $150" ($1 each). Section 15 "a robot can
    stock any stall that has been bought" (the job list in slot order). Helpers: `staffed()` and
    `crew()` give money as robots x `s.flat.robot`; `staffed()` opens the slots when given a slot job;
    `open3(s)` sets `s.goal = 3`.
  - **Restated page rows** (`drive-taas-factory-ui.cjs`, still **129**; `fresh(seed, open)` meets
    every goal when `open`): section 4 "the dock offers a robot for $20" ($1) and "hiring it turns the
    bubble to the new robot" (opened, slot order); section 11 opened, and "slots 01 to 04 each have
    their number painted" (bays by slot order); section 15 opened (the extractor's input bin, the saw's
    cuts); section 18 the saw's input bin row opened; section 19 opened, "a tap on an empty place ...
    a stall for $50" ($1), "buying it costs $50" ($1, money 499), "a robot's bubble lists the planer,
    ..." (slot order); section 20 "all eight robots cost $720" ($8) and "Info tells of the four stalls
    and their prices, the eight robots and their prices" (the flat-price wording).
  - **Gates:** `gates.sh games/taas/index.html` GREEN; formal 43 / 39 (formal untouched; its eval 9
    not run, as no formal code moved).
  - assumed: `SLOT_JOBS` in slot order (`extract, carve, saw`), so a robot's bubble lists the slots'
    jobs top to bottom, which is also the order the goals unlock them.
  - assumed: `setFlat()` rounds a fraction to the nearest dollar and clamps to $0-$200 (unlike
    `setWait()`, which refuses); anything not a number, and any `what` but `robot` / `stall`, is refused
    and changes nothing; it fires a `flatset` event.
  - assumed: a price of $0 is free even with money below zero (`afford()`); any other price needs the
    money, as before.
  - assumed: `s.goalT` goes back to the full 600 whenever a goal is met, so it reads 600 everywhere but
    while goal 2 counts down.
  - assumed: a machine arriving takes floor that was empty, so anyone standing in its footprint steps
    to the nearest free floor and every walk under way is replanned round it (`clearWay()`); an avatar
    whose walk then ends where it stands arrives.
  - assumed (`load()`): a goal that is not a finite number (missing or garbage) is all three met; a
    fraction is floored, then clamped to 0-3; `goalN` is clamped to 0..the current goal's `n` (a count
    at `n` meets it on the next step); `goalT` to 0..600, else 600; `flat` through `flatOf()`. A robot
    on a slot still locked rests (the existing one-job rule); what a hand-edited save puts in a locked
    slot's bins is kept but out of reach.
  - **For steps 2-5:** step 2: `load()` still filters bins by `ACCEPTS` and resets the planer's in-feed
    (untouched here). Step 3: a locked slot's sprites are still drawn and still in `TAPS` (the engine
    refuses the tap); the baked floor's key lacks `s.goal`; Start over must call
    `FACTORY.newGame(seed, s.flat)`; the board can read `F.goalNow(s)` and the `goal` event
    (`{ n, id, unlocks }`); the pose `.claude/scripts/poses/taas-factory-eight.js` needs `s.goal = 3` (its
    slot jobs are refused in a new game). Step 4: Info's three price lines are placeholders. Step 5:
    `eval-taas-factory.cjs` was not run or edited; its personas now start with slots 02-04 locked and
    robots and stalls at $1, so the existing ones need `s.goal = 3` before any of their numbers mean
    what they did.
- **Step 2 results (2026-10-20, engine: bins and stalls take anything, the stall's menu, closing,
  wrong-input jams).**
  - **Built** (`games/taas/index.html`, FACTORY block): `ACCEPTS` now names all nine bins (the four
    input bins, the four output bins, the recycle bin), each `isItem`: nothing filters what goes in.
    What a machine is made for is a separate table, `RIGHT` (`planer`, `saw`, `extract`, `bench`), and
    `runOf(key, item)` says what a run comes to: `'run'`, `'empty'` (the extractor on a normal or
    gnarled log) or `'jam'`. `MACHINES`, `stateOf()`, `jammed()`; `rejectsLog()` matches logs only.
    State: a mill has `result` and `dirt`; the bench (`newBench()`) has `phase` ('idle' / 'jam') and
    `dirt`; a stall has `closed`. **Bins**: `BUBBLES` gains the four output bins and `arrive()` no longer
    starts a `pick`; a stall arrives at `{ kind: 'stall', i, menu: null }` and no longer stocks itself.
    **Stall menu** (`options()` and a new `chooseStall()`): `menu: null` -> `assign`, `restock`, `close` /
    `open` (icon `rest`, `on` when closed); `'assign'` -> `back` + the 13 `sell:` rows; `'stock'` -> `back`,
    a `put:` per kind you carry (any kind; disabled once the stall holds `CFG.stallCap`) and a `take:` per
    kind in it. A put fills to the cap as `{ item, by: 'player' }` (a `stocked` event, `tally.stocked`),
    the rest stay in your arms; a take returns every one of a kind (`took`, `at: 'stall'`). `sell:` sets
    the stall as before (unsold stock into your arms, its robot released) without stocking and goes back
    to `menu: null`. **Closing**: `openStalls()` drops a closed stall; `stepShop()` admits nobody and rolls
    no die while none is open (`open.length` guard); each customer not paying whose stall is not open
    re-picks (`pick()`, the `stall` die only when there is a choice; a `repick` event) or, with none open,
    walks out (`walkout`, no satisfaction cost); a closed stall's robot starts nothing new. **Jams**: the
    mills' `startMill()` records `result` (event `press` carries it) and `stepMill()` jams `CFG.jamAt` into
    a wrong run (event `jam { at, item, by }`, `credit(by, 'jam:' + item)`), runs an empty run its whole
    length (the log back, `milled { empty: true }`, `credit('empty:' + log)`, `GRADE.empty = 'soso'`);
    the bench (`benchNext()`, `jamBench()`) jams the same way and rolls no `carve` die for a wrong piece;
    `miller()` / `carver()` wait `stuck` on a jam. `unjam(s, key, by)` is the one clean: $5, the machine
    free, `cleaned { at, item }` and the jammed thing to the recycle bin (`recycled { from: 'jam' }`), the
    planer's sap jam included; the avatar's `clean` act carries `on` (absent = the planer). **Your toss**:
    `pressMill()` and `carve()` scrub a jam, else toss a wrong first thing (`tossAt()`, act `toss { on }`,
    `tossOut()`, one a tap, `recycled { from: key }`, `tally.tossed`); a wrong piece left on the bench is
    tossed off it; a tap on a jammed saw scrubs it (no bubble). **Saves** (`load()`): no `ACCEPTS`
    filtering; the planer's in-feed keeps any thing; mill and bench jams kept with their `dirt` (clamped
    0.01-1); a mill run on anything kept (its `result` worked out again); `closed` filled false; a stall
    bubble's `menu` validated; `clean` / `toss` `on` validated (else the planer), a `press` at the bench
    dropped. An old save's `pick` and `stock` acts stay in `ACTS` and **finish** as they began (tested).
    Exported: `RIGHT, MACHINES, runOf, jammed`.
  - **Rules suite** `drive-taas-factory.cjs`: **308 -> 358** (50 added in a new section 17, none
    removed). Section 17: the bin table and `RIGHT` / `runOf` table, grades; every one of the nine bins
    at once (nothing on arrival, anything in, anything back out); yours first in the rack whatever it is;
    a stall's three levels, back from each, bad ids refused at each level, re-assign without stocking,
    re-stock to six with the rest kept and a full stall refusing more, take back, a log and a carving in
    a stall, a log sold as a medium plank (a wrong sale), an empty place only a stall to buy; close /
    open (stock kept, re-stock and re-assign while closed); a paying customer finishing, the re-pick with
    one choice (no die, two waiting and one walking in) and the walk over, with two choices (a die each),
    none open (walk out, no drain), nobody admitted and no die while none open, the next walking in on
    open; a closed stall's robot idle, back to work on open, and one already holding a thing putting it
    in; the planer pressing a small plank under "Only input medium logs" and more (red `jam:plank.s`, no
    instruction joins) and its scrub putting the plank in the recycle bin, the sap jam's log likewise;
    each of slots 02-04 jamming on six or five kinds of wrong thing (1.3 s in, run charged, red, stuck,
    nothing out, no die); the extractor's empty run on a normal and a gnarled log; a scrub at each slot
    ($5, 2.5 s, the thing to the recycle bin, the robot carrying on) and a half scrub kept; your toss at
    the extractor, the saw, the bench (and off it) and the planer, and never a jam by you; stall robots
    fetching what you put in two output bins, and misstocking a wrong one red; saves (odd things in every
    bin, both slot jams with their scrub, a closed stall, a plank on the in-feed, the bubble's level,
    carrying on identically), an old save's `pick` and `stock` finishing, an old `clean` with no machine,
    hand-edited `on` / `menu` / press, a customer at a closed stall in a save.
  - **Restated rules rows** (same claim, the new path): section 3 "a tap on the planer's output bin ...
    you take everything in it into your arms" (its bubble, a tap a kind); "a tap on the counter ... stock
    the medium plank stall with your medium planks, and only those" (Re-stock and a put); "at the
    planer's input bin the bubble offers every log in your arms" (and the plank). Section 4 "the stall
    holds 6" (by Re-stock; a full stall takes no more). Section 9 "its input bin takes planks, and only
    planks" (anything), "a tap on its output bin takes them into your arms" (its bubble), "the sap
    extractor's input bin takes sap logs, and only sap logs" (anything), "the bench's input bin takes
    gnarled wood" (anything), and the walk before "the clean log can go in the planer's input bin" (the
    extractor's output bin through its bubble). Section 11's random play (the in-feed any thing; slots
    idle / running / jammed with something to scrub; no customer waiting for a closed stall) and "a
    hand-edited save is clamped" (a plank in the rack is kept, three of the rack yours; stalls carry
    `closed`). Section 13 "what you put in the table saw's ... input bin can be taken back out" (the
    bubble also offers what you still carry) and "the plank taken back out of the saw's bin goes on the
    counter" (Re-stock). Section 14 "its bubble now offers everything a stall can sell" (the Re-assign
    list under a back button, straight after buying), "the next costs $1 and so does the last" (the
    first level's three buttons, Re-assign's list), "at the first stall the bubble marks what it sells"
    (Re-assign), "choosing medium 2x4s instead" (nothing goes in by itself, back to the first level,
    Re-stock puts them in), "choosing what it already sells changes nothing" (inside Re-assign), "a tap
    on it stocks it ... up to 6" (Re-stock fills it to 6), the walk in "a customer waiting at a stall
    when you change what it sells buys the new thing" (Re-assign then Re-stock), "a save from before the
    four stalls" (`closed` in its JSON). Section 15 the walk in "set the stall to sell something else
    while its robot carries the old thing" (Re-assign first). No row counted the recycle bin across a
    cleaned jam (the suites' jam shortcut now adds a sap log to it; nothing it was counting moved).
  - **Page suite** `drive-taas-factory-ui.cjs`: still **129**; restated: section 2 "a tap on the drawn
    output bin walks over and takes the plank into your arms" (its bubble opens and a real tap on the
    plank takes it) and "a tap on the drawn counter walks round to it and stocks the stall" (real taps
    on Re-stock and the plank; the next row, the customer buying it, unchanged); section 15 "the sap
    extractor's input bin offers just the sap log" (offers everything you carry: the sap log and the
    gnarled plank); section 19 "buying it costs $1, and the bubble turns into the thirteen things"
    (the same rows, under a back button).
  - **Minimal UI** (no helper text beyond the CD's button words): `anchorOf()` places the four output
    bins' bubbles over them; `renderBubble()` treats a stall's `menu: 'stock'` as a bin (`binHalves()`),
    puts a back row (`backRow()`, a chevron icon, aria "Back") over the Re-stock halves and the Re-assign
    rows (`stallRows()` now takes only `sell` rows); `optButton()` words the first level "Re-assign"
    (the stall's thing as its picture), "Re-stock" and "Close" / "Open" (the zzz icon); `F.SAMPLE` has
    placeholders for the output bins and `stall`; the `jam` event stops the whir of the machine that
    jammed; the evals list words `empty:` ("Ran the extractor on a medium log: no sap"). **Step 4 must
    still**: lay out the first level and the back row at three sizes, draw the slots' jams (the `jam`
    puff and the `cleaned` float are still placed at the planer), and word Info.
  - **Negative tests** (copies only, scratch lists; the repo's break lists are step 5's): 22 one-line
    breaks run through `negtest-copies.py` on the rules suite, 21 caught by name, 1 crash traced to a row
    that read a null act (fixed to fail by name, then caught: 2 rows) - ACCEPTS filtering again, a
    gnarled plank allowed in the saw, no empty run, no mill jam, no recycle on a clean, `rejectsLog()` on
    anything, a stall stocking itself, output bins without a bubble, no cap on a stall put, `sell:`
    stocking, closed stalls still open, a re-pick that always rolls, arrivals with none open, a closed
    stall's robot working, the bench rolling a design for a wrong piece, `load()` filtering the rack or
    losing `closed`, no red on a jam, a carver not stuck, no walk-out. One more, the toss removed from
    `pressMill()` alone, was **not** caught and is an equivalent mutant: the press act's own "changed
    under your hand" guard tosses the thing anyway (a press later); removed from both places (and the
    bench's toss from both of its), each was caught.
  - **Gates**: `gates.sh games/taas/index.html` GREEN (factory rules 358, page 129; formal 43 / 39,
    untouched; evals not run).
  - assumed: "rough planks included" read as the table saw jamming on a gnarled plank too (it took
    planks only before, and a cut from a plank with holes would have no meaning yet).
  - assumed: buying a stall turns its bubble straight to Re-assign (`menu: 'assign'`, it sells nothing
    yet); every `sell:` (the one it sells included) goes back to the first level.
  - assumed: Re-stock's puts are disabled once the stall is full, and a put that fills it only part way
    leaves the rest in your arms (one `stocked` event with the number that went in).
  - assumed: a customer who walks out of a closed shop costs nothing and is not counted as served; the
    next customer walks in as soon as a stall opens (the `next` clock is not pushed back while all are
    closed).
  - assumed: a closed stall's robot finishes putting in a thing already in its hands (in `place` or
    `carry`), then starts nothing; a hunt it had decided is kept for when the stall opens.
  - assumed: a tap on a jammed table saw scrubs it at once (no cuts bubble), as the planer; a wrong
    piece a robot left on the bench (taken off the job before the chisel broke) is yours to toss off it.
  - assumed: at the bench a robot's jam is one iteration (it waits the delay, if it holds it, then
    stands stuck); a jam rolls no die anywhere (the bench rolls its `carve` die only for gnarled wood).
  - assumed: a cleaned jam's `recycled` event comes `from: 'jam'`, a toss at a slot `from:` the slot's
    key (`saw`, `extract`, `bench`); a mill save with a jam and a bad `cut` gets the first cut.
  - **For steps 3-5:** step 3 should know a stall bubble's level is `s.bubble.menu` (the menu's Start
    over and the pose are unaffected: the pose's `buystall` then `sell:` still works because buying
    opens Re-assign). Step 4: the jams of slots 02-04 are `s.saw.phase`, `s.extract.phase`,
    `s.bench.phase === 'jam'` (or `F.jammed(s, key)`), each with `dirt`; the `jam` / `cleaned` events
    carry `at` and `item`; `walkout` and `repick` events exist if the page wants them; a closed stall is
    `st.closed`. Step 5: `eval-taas-factory.cjs` (not run here) still picks up output bins by tapping
    them and stocks stalls on arrival (`want('bin')`, `want('stall')`), chooses `sell:` from a stall's
    first level (line 204) and treats every `F.ACCEPTS` bubble as a put-only bin (line 207, which now
    includes the output bins): its personas need the new paths (take from a bin's bubble, Re-stock) and
    their claims restating; the suites' jam shortcut (`dirt = 0.001` with a `clean` act) now also puts
    the jammed log in the recycle bin.
- **Step 3 results (2026-10-20, UI: empty bays, the slots' new order, the goal board and its countdowns, a
  machine arriving, Prices in the menu).**
  - **Built** (`games/taas/index.html`, factory UI and the shared menu): `bake()` tags every sprite with
    `slot: F.slotOf(id)` and `onFloor()` hides a sprite whose slot is not `F.unlocked()`, so a locked slot's
    machine, belts, console and bins are neither drawn nor in `spriteRect()` / `TAPS` / `hitTest()` (a tap in
    an empty bay is a tap on the floor). `draw()` keeps everything live out of a locked slot too (belt tops,
    the saw's and the extractor's buttons, the blade, the tank, the rides, the bins' heaps, the piece on the
    bench). The baked floor leaves a locked slot's contact shadows off (`F.placeOpen()`), and its key gains
    `s.goal`. Every hard-coded slot y in the UI already read `ROWY` (grepped `12.`, `13.`, `7.3`, `10.1`: none
    left outside the layout); two stale comments fixed (the saw and extractor are slots 04 and 02, the bench 03).
    **The board** (`goalText()` from `F.goalNow(s)`): "Sell 50 medium planks", counting down ("Sell 1 medium
    plank" at one, singular nouns from `ONE`); ">$50 & >90% customer satisfaction for 10 minutes" at rest and
    "... for 9:41" (m:ss, `mss()`, seconds rounded up) while it counts; "Sell 25 sap" counting down; "All goals
    met". `drawBoards()` fits it with `fitText` (shrunk, never cut). The screen-reader line (`renderHud()`, now
    also redrawn when the goal text changes) and Info's goal sentence read the same text. **The `goal`
    event**: the level sound, five spark puffs along the machine, the slot's sprites fading in over 0.6 s
    (`ARRIVE`, alpha in `blit()`), and a cyan float "slot 02: the sap extractor" / "slot 03: the hand crafting
    bench" / "slot 04: the table saw" that lasts 3 s and is shrunk and clamped to stay on screen (`FLOAT`
    entries gain optional `life` and `fit`). **Prices**: a `#menu-prices` group between the sound block and
    Exit game, "Prices", then "Robot $1" and "Stall $1" with - / + buttons (`data-price`, `data-by`), plain
    buttons and outputs (no `.mi`, no range input). It is hidden in formal by the `hidden` attribute, which
    `sync()` sets from the mode, and by a CSS rule keyed on `html[data-mode]`. `MODE` gained a `menu()` hook
    the menu calls when it opens. The factory registers `renderPrices`, which disables a button at
    `C.flat.min` / `C.flat.max`, and a tap calls `F.setFlat` on the live factory and saves at once. Start over
    is `F.newGame(seed, s.flat)`. **Pose**: `taas-factory-eight.js` sets `s.goal = CFG.goals.length` and still
    stages its eight-robot scene (read back: goal 3, jobs operate, stock:0-3, saw, extract, carve; four stalls;
    six customers; screenshot checked).
  - **Page suite** `drive-taas-factory-ui.cjs`: **129 -> 145** (16 added in a new section 22, none removed).
    Section 22: a new factory's floor (one stall for medium planks, slot 01 only, nothing of 02-04 drawn top or
    bottom); real taps on five empty-bay spots are floor taps that open nothing; goal 1 counting down
    50 / 47 / 1 with the singular, read off the wall's pixels and the score line; the 50th sale by the engine
    brings the extractor (sprites, the level sound, the float's cyan pixels there and gone 4 s later, a tap
    reaching it); goal 2's resting text; its countdown "9:41" / "9:40" and back to "10 minutes" at 89%; the long
    line inside the board at 390 wide; goal 3 counting to "Sell 1 sap", the bench in 03 while 04 is empty, the
    saw at 25, "All goals met" on the wall and in Info; the slots' order on screen; Start over from a factory
    with every goal met leaves bare floor where the extractor and its bin stood (the floor key); real taps
    on the bench, the saw and their bins at 390x844, 320x640 and 844x390, reaching them once open and the floor
    before; Prices in the factory's menu (and the menu's `.mi` still "Info,Exit game", three ranges); the
    steppers ($4 / $0, the dark -, the dock price, the save); the $200 cap; a reload keeping them and Start over
    keeping them with a new factory; no Prices in formal.
  - **Restated page rows** (same claim, the new rule): section 5 "at six sizes ... a tap on each drawn thing
    reaches that thing" and its overlap row "where two things overlap ... the one standing in front" (now on
    an open factory, `fresh(4, true)`, since a new factory has no slots 02-04 to tap); section 7 "it starts
    from the goal and explains customer satisfaction" (`/The goal: Sell 50 medium planks\./` in place of
    "Sell medium planks for $4"); section 13 "the rear wall says the goal" ("Goal: Sell 50 medium planks.").
  - **Gates**: `gates.sh games/taas/index.html` GREEN (factory rules 358, page 145; formal 43 / 39; evals not
    run). `check-inline-js` GREEN after every edit.
  - **Frame cost** (eight pose, nothing else running): median 16.7 ms, p95 16.7, max 16.8, **0 of 149 over**.
  - **Negative tests** (copies, a scratch list of 15; the repo's break lists are step 5's): all 15 caught by
    named rows: locked sprites drawn, `spriteRect()` ignoring `onFloor`, no countdown in goal 1/3, no
    singular, no m:ss, the score line not following the goal, the `goal` event's float gone, its level sound
    gone, the board without `fitText`, Start over dropping the prices, Prices shown in formal, the steppers
    never disabled, no save on a step, prices not rendered when the menu opens, and the floor key without
    `s.goal`. That last one was first **missed**. The row written for it compared a re-bake and could not see
    the break. Traced (a reload after `localStorage.clear()` loaded goal 3): `fresh()` clears storage, then the
    old page's `pagehide` save writes it again, so each new page first bakes the previous row's factory. The
    break's real symptom is grey machine shadows left in an empty bay after the goal drops. The row now checks
    that through Start over from a finished factory and is caught. The other 14 ran on the suite before that
    row changed; the page has not moved since.
  - assumed: the CD's "Goal:" prefix is the board's existing yellow GOAL tag, so the white text is the rest of
    the CD's sentence ("Sell 50 medium planks"); the screen reader says "Goal: Sell 50 medium planks." in words.
  - assumed: the countdown shows whole seconds rounded up (9:41.2 left reads "9:42"), and "for 10 minutes"
    whenever it is not counting (the full 600 s).
  - assumed: a machine arriving fades in over 0.6 s with sparks along its row, and its float stays 3 s (the
    others 1.3 s), cyan like "new instruction".
  - assumed: Prices sits between the sound block and Exit game, has no slider and no typed amount, and saves on
    every tap; the menu calls the mode's own `menu` hook to fill it in when it opens.
  - assumed: a locked slot shows nothing live at all (no belt, button, blade, tank or things in its bins, even
    a hand-edited save's), only its painted bay and numbers.
  - **For steps 4-5:** step 4: the `jam` puff and the `cleaned` float still sit at the planer, and Info is
    still the old text with the new goal sentence at its head (`The goal: <goalText()>.`). The bubbles for output
    bins and stalls are step 2's minimal ones. Step 5: fold the 15 breaks above into
    `.claude/tests/negtests/taas-factory-ui.json` (the scratch copy is not in the repo; each is one line, named
    `s3-*`, listed above). Remember that a suite row reading the floor right after `fresh()` sees the previous
    row's factory until something re-bakes. `FACTORY.newGame()` in the eval personas starts with slots 02-04
    locked.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/taasgoals.goals-arc.md
```

(Or one step per session, as the earlier TAAS arcs ran: "Run the next open step of
`.claude/plans/taasgoals.goals-arc.md` on branch `taas-goals`".)
