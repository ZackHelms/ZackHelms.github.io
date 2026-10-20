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
| 1 | Engine: goals and unlocks, the slots' new order, flat prices, saves; rules rows | open |
| 2 | Engine: bins and stalls take anything, the stall's menu, closing, wrong-input jams; rules rows | open |
| 3 | UI: empty bays, the slots' new order, the goal board, a machine arriving, Prices in the menu; page rows | open |
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

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/taasgoals.goals-arc.md
```

(Or one step per session, as the earlier TAAS arcs ran: "Run the next open step of
`.claude/plans/taasgoals.goals-arc.md` on branch `taas-goals`".)
