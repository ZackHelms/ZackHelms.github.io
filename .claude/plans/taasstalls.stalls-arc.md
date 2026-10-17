# taasstalls - TAAS robot factory: four stalls, eight robots (plan arc)

**Status:** IN PROGRESS (steps 1-2 done 2026-10-16: the engine's stalls and customers, its eight robots; step 3 done 2026-10-17: the page; step 4 done 2026-10-17: the eval and the break lists; step 5 done 2026-10-17: the docs and gates; branch `taas-stalls`)
**Requested:** 2026-10-16, inside the CD's answer to the bins brief (`.claude/plans/DONE/taasbins.md`,
which ships the first half: bins you take from, logs bought 10 for $10, $0.10 a run, the floor).
Verbatim:

> "... (and ability to sell all finished products... go ahead and add a way to purchase additional
> sales stalls (up to 4 total), and allow me to specify what is sold at each by tapping on it to set
> its item; any unsold items automatically go into my inventory when i change what is sold in a
> stall. Each additional stall costs $50, $100, $150. One robot per stall, so add 3 more robots i can
> order. These robots will travel to specific bin to fetch an item and put it in the stall. Each gets
> same base prompt and my instructions ensure they stock correctly. Add 3 more robots i can buy so i
> can staff them to the other slots 2,3,4."

**Scope:** `games/taas/index.html` (the `FACTORY` engine and the factory UI), the three factory
suites and their break lists, `.claude/taas.md`, `.claude/tests/README.md`, `CLAUDE.md`,
`games/CLAUDE.md`. Formal mode is out of scope and must stay at 43 / 39 / 9.

## The CD's four answers (asked 2026-10-16, before any code)

| Question | CD's answer |
|---|---|
| With up to four stalls, what does each customer come in for? | **A stall, at random**: each customer picks one of the stalls that has an item set, all equally likely, and waits there if it is empty (costing satisfaction as now). Arrivals stay one every 8-16 s |
| What can the robots on slots 02-04 get wrong? | **Nothing yet**: each works its machine on whatever is in its input bin, no mistakes and no instructions of its own for now. The saw robot makes the cut chosen on its page. Mistakes can come in a later brief |
| What do the six new robots cost? | **+$20 each**: $20, $40, $60, $80, $100, $120, $140, $160 |
| How do the stall robots' instructions keep them right? | **Rules per item**: one "Only stock X" instruction for each item a stall can sell (Only stock small planks, Only stock 2x4s, ...), joining the list as each mistake is seen |

## Design to settle in step 1 (assumed unless the CD rules; record each in `.claude/taas.md`)

- **What a stall can sell**: every item with a price (`CFG.price`): planks s/m/l, sap, and the
  saw's three cuts at three lengths (13 items). Gnarled planks and carvings have no price, so they
  cannot be set (ask the CD for prices if they should be).
- **Stalls**: four places along the counter, east to west; stall 1 exists (medium planks); 2-4 are
  bought by tapping an empty place ($50, $100, $150, in that order). A tap on a stall opens a
  bubble of the items it can sell; choosing one puts any unsold stock into your arms (the CD).
- **Queues**: four stalls side by side leave no room for a line each in a 1.25 m shop. Proposed: one
  line from the door; a customer whose stall is free walks to it, the rest wait in line (each still
  costs 0.1% a second while waiting); six in the room at most, as now.
- **Price and floor per stall**: its item's price times satisfaction, never below `floorOf()`; the
  counter's label per stall.
- **Stall robots**: a job per stall ("stock stall 2"); the robot fetches from the bin its item comes
  out of (planks: the planer's output bin; cuts: the saw's; sap: the extractor's). Base prompt as
  the stocker's, the same for all (the CD). `stockOnly` becomes one "Only stock X" row per item
  (13 rows, joining when that stall's robot puts something else in it); the old "Only stock medium
  planks" is the medium plank row. The recycle instructions stay by kind.
- **Slot robots**: jobs `saw`, `extract`, `carve`: press the machine on the first thing in its
  input bin whenever it is idle (the saw robot with the cut set on its page), no mistakes, no
  instructions but the delay (every robot can take it).
- **Robots**: up to eight (`CFG.hire` = 20..160 step 20); the dock needs eight crates (layout);
  `homeOf()` per job; slots open "once two robots are on staff" (was "both").
- **Saves**: version 4, migrating a v3 factory (its stall becomes stall 1, its robots keep their
  jobs), or no bump with `load()` filling the new fields: decide by what the migration needs.

## Resume here (a session told "continue with the next step in this arc file")

1. Read `CLAUDE.md` (concurrent sessions push to `main`; never author a merge commit on `main`;
   `git fetch origin main` and re-check `git rev-list --count HEAD..origin/main` immediately before
   any push to `main`).
2. Read this file in full: the brief, the four answers, the steps table and every step's Results.
3. Read `.claude/taas.md`: § Tips; § Robot factory mode's assumed-not-decided table (the rows from
   "Stalls: ..." on are this arc's); § Open questions (factory); the newest § Measured; § Negative
   tests (factory).
4. Run the first step in the table that is not DONE, and only that one. Then: tick it, append a
   Results section (append, never rewrite), commit to `taas-stalls`, push the branch, stop and report.
   **Never push to `main` before step 6.**

Tools and gates:
- `.claude/scripts/gates.sh games/taas/index.html` (add `--eval` for the evals);
  `node .claude/scripts/check-inline-js.cjs games/taas/index.html` after every edit to the page.
- Playwright: `NODE_PATH=/opt/node-tools/node_modules`; Chromium at `/opt/pw-browsers/chromium`.
- Break lists on copies, after running the suite once on the unbroken page:
  `NODE_PATH=/opt/node-tools/node_modules python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/taas-factory-ui.json --page-env TAAS_PAGE --jobs 3 --freeze .claude/tests/drive-taas-factory-ui.cjs -- node .claude/tests/drive-taas-factory-ui.cjs`
  (the page list takes about 80 minutes; never edit the page while it runs).
- Frame cost: `.claude/scripts/frame-budget.cjs games/taas/index.html select=#mode-btn:robot-factory evalFile=.claude/scripts/poses/taas-factory-eight.js`; never measure while other Chromium jobs run.
- Formal mode must stay at 43 (`drive-taas`) / 39 (`drive-taas-ui`) / 9 (`eval-taas`). Saves stay version 3.
- Ship (step 6): stamp the badge with `.claude/scripts/stamp-badge.sh` and read it back from the
  file; fast-forward `main` after the rev-list check; verify the Pages run with `mcp__github__actions_list`.

The CD's standing preferences: keep replies short; plain ASCII only (straight quotes, plain hyphens,
no curly quotes or en/em dashes); label anything inferred, assumed or sourced ("inferred:",
"assumed:", "source: X"). A cause reported to the CD must have been traced in code or data, otherwise
call it a hypothesis. Don't ask the CD about deleting remote branches. Ask before writing code only
if a design question is genuinely unclear.

Step 6 notes (from step 5): gates GREEN on a4e45a9 and the step 5 commit; `CLAUDE.md`,
`games/CLAUDE.md` and `.claude/tests/README.md` are shared with other sessions, so after the rev-list
check sanity-check their TAAS lines survived any merge. The report to the CD: the two new Tips, open
questions 12-15, and the delay Tip's correction ("about twice as fast" held on seed 7 only).

Step 5 notes (from step 4, done): suite counts are rules 260, page 129, eval 32 (about a minute;
`EVAL_SEEDS` / `EVAL_GROW_SEEDS`); break lists engine 144 (143 caught), page 108 (107), eval 9 (9),
the misses the two known equivalent changes. CLAUDE.md's TAAS row and games/taas bullet, and
games/CLAUDE.md's TAAS entry, still describe the Tips as three (now five) and one stall. Step 6's
report must include the two new Tips and open questions 12-15, which the CD has not seen.

## Steps (one per session turn, then `/compact`; each ends: tick here, Results, commit to branch `taas-stalls`, push the branch)

| # | Step | Status |
|---|---|---|
| 0 | The CD's brief and four answers recorded (this file) | DONE 2026-10-16 |
| 1 | Engine: stalls (buy, set, unsold to arms), customers picking a stall, prices per stall; rules suite rows | DONE 2026-10-16 |
| 2 | Engine: eight robots, stall jobs and "Only stock X" per item, slot 02-04 jobs; rules suite rows | DONE 2026-10-16 |
| 3 | UI: the counter's four stalls and labels, the stall bubble, the dock of eight, the robot page's jobs, the slot robots at work; page suite rows | DONE 2026-10-17 |
| 4 | Eval (personas with stalls and slot robots; the economy) and both break lists | DONE 2026-10-17 |
| 5 | Docs final and gates | DONE 2026-10-17 |
| 6 | Ship: badge, one commit, fast-forward `main`, push, Pages, report to the CD | open |

## Results (append, do not rewrite)

### Step 1 (2026-10-16): the engine's stalls and customers

- **Settled** (each an assumed row in `.claude/taas.md`, "Stalls: ..."): a stall sells any of the
  13 things with a price (`SELLS`); four places along the counter (`STALLS`, 1.35 m apart, the first
  where the one stall stood), any empty one bought at the next price ($50 / $100 / $150 by how many);
  a tap on a stall stocks it and opens a bubble of the 13 things with what a customer pays now;
  choosing another brings the unsold stock back into your arms and stocks what you carry of the new
  thing; a stall bought sells nothing until set, and nobody comes for it.
- **The shop in three rows** (not the plan's "one line from the door" exactly): one customer waits
  at each stall across the counter (`lineY`), anyone whose stall is taken waits in one line along the
  back wall (`backY`), first come first served, and everyone walks in and out along a walk between
  them (`laneY`, `walkTo()`). A screenshot at four stalls shows the line's hourglasses **covering the
  satisfaction board's number**: step 3 has to draw the line's waiting differently (smaller, lower,
  or not at all).
- **A die only when there is a choice**: a counter with one open stall rolls no `stall` die.
- **Saves stay version 3**; `load()` fills the new fields (a save from before: its stall the first,
  three places to buy; a walk to the counter becomes a walk to the first stall).
- **Two bugs the new rows caught before they shipped**: a customer could stop dead on the walk, its
  turn-off 0.30000000000000004 m short of its place counting as "far" for ever (now a hair's
  tolerance), and the next customer took a freed stall one step late (payments are now settled before
  places are handed out).
- **Interim until step 2**: the stocker still stocks the first stall from the planer's output bin;
  the UI only maps the counter's tap to the first stall and faces customers by their row (step 3).
- **Suites**: rules 197 -> 221 (section 14, the stalls: buying, prices by count, setting and the
  unsold stock, no customers for an unset stall and no die, equal odds over three stalls, a customer
  at each stall and the line behind, first come first served, prices and floors stall by stall, a
  wrong thing sold as the stall's, a change while a customer waits, an empty stall filling the shop,
  a busy quarter hour where nobody walks through anybody or gets stuck, bad taps, saves old and new);
  page 111 unchanged (the tap map now expects a stall); eval 24, its crossed-wires row now measured
  over the last ten minutes, not five (main's own pair was 1.2 $/min apart over five, 0.6 over ten;
  the new shop moved them to 2.1 and 1.1 with nothing about instructions changed). Formal untouched.

### Step 2 (2026-10-16): the engine's eight robots

- **Settled** (each an assumed row in `.claude/taas.md`, "Robots: ...", "Stall robots: ...", "Slot
  robots", "The bench: ..."): eight robots at $20 to $160 (`CFG.hire`), named Bolt to Dynamo; jobs as
  strings, `operate`, `stock:0`-`stock:3` (one for each stall bought), `saw`, `extract`, `carve`, one
  robot to a job (a save's `stock` is `stock:0`); instruction slots open once two are on staff
  (`CFG.slotsAt`). Saves stay version 3.
- **The dock of eight**: two rows of four crates 0.6 m square in front of the panel, a cell of floor
  between any two, you hire from the aisle between the rows. **A first try ran the panel across the
  whole dock**, which sent every robot round its east end; the eval's paced persona then fell into a
  jam spiral (money below zero, never the slot for the sap-log instruction). Traced: the old dock with
  everything else new played as before (the operator's plan at 24.8 min, $367 at the end); the panel
  back at its own width (x 0.4-2.8), robots leave between the crates, and the persona is back (24.1
  min, $377). It also moved slot 04's floor number out from behind the panel, which the page suite
  had caught.
- **A stall's robot waits at the output bin its stall's thing comes out of** (planks the planer's,
  cuts the saw's, sap the extractor's), reaches in, walks one thing to its stall, puts it in and walks
  back (`stocker()`'s new `carry`, `go()`). The first stall's robot on planks has the bin behind it and
  the stall in front, as the stocker always had, and never takes a step: the old stocker rows pass
  unchanged but for the new eval keys. **Thirteen "Only stock X"** (the medium plank one still
  `stockOnly`), one consulted per stall; a recycle instruction never takes the stall's own thing; a
  stall set to something else mid-fetch sends the robot's load back to its bin. Evals name the thing:
  `stock:plank.l`, `misstock:plank.s@plank.l`, `looking:sap` (the page's `DOING` reads both these and
  a save's older keys).
- **Slot robots** (`miller()`, `carver()`): press the saw (the cut set on its page, `setCut()`) or the
  extractor whenever idle with something in the input bin; carve the bench's gnarled wood piece by
  piece; green every time, no slip die without the delay; the delay works on them. The bench is one
  pair of hands: you cannot carve while its robot does, it waits while you do, and either finishes a
  piece the other left.
- **A bug the new rows caught**: a robot that counts as home within 0.06 m keeps the rest of its path,
  and the first stall robot's walk reused it and snapped to its stall in one step (`go()` now replans a
  path that ends somewhere else).
- **Interim until step 3**: the robot bubble lists the new jobs with the planer's button for the
  three slots and a number for each stall; `JOB_NAME`, the base prompt and `DOING` know the new jobs;
  "once two robots are on staff". A screenshot with all eight hired: every robot at its post; the
  dock panel's art covers only the west half of the pads, and the first and second stalls' robots
  overlap on screen at the planer's bin. The test hook's state setter left a stale bubble on screen
  (it reset the bubble's signature to a closed bubble's own); fixed.
- **Interim until step 4**: the eval's personas still hire two. **One eval row is red, and was luck
  on main**: "without the delay it takes over twice as long" (supervisor 45.3 min vs paced 24.1, 1.88x
  here). Measured over six seeds (7-12) on main itself it held only on seed 7 (2.23x; the others 0.84,
  1.15, 1.17, 0.84, 0.98), and "inside 25 minutes" missed on three of them (26.8, 30.2, 25.7). Step 4
  restates the delay's claims over several seeds rather than retuning one seed green; the Tip "an agent
  faster than demand makes waste" should be checked against that too before it is told to the CD as
  measured.
- **Two rules rows made honest**: the operator's instruction rows had a 20 s budget the old dock met
  with 0.65 s to spare (now 30 s), and the overproduction row's "12 or more medium planks" held by luck
  (main left 11 on seed 53; it is now "more than a stall's worth, at least four times the paced bin").
- **Suites**: rules 221 -> 259 (section 15: the dock of eight and that a robot from any pad reaches
  every post however many are packed, slots open at two, a job for each stall bought, each stall's
  robot fetching from its own bin and walking it over, the first stall's robot never stepping,
  untold / told / told about another thing, recycle never the stall's own, a change mid-fetch, two
  stalls sharing a bin, a stall selling nothing, the saw's cut and pace, the extractor, the bench's
  one pair of hands, no slip on the slots, the delay on a slot robot, saves new and old, and a quarter
  hour with all eight where every stall sells and nothing wrong is stocked); page 111 unchanged (its
  job ids and eval line updated); eval 23 of 24 (above). `gates.sh` GREEN (formal 43 / 39 untouched).

### Step 3 (2026-10-17): the page

- **Settled** (each an assumed row in `.claude/taas.md`, from "The counter on screen" to "Info"): a tray
  and a label for each stall bought, the label's price first at its west end (the robots that never
  move stand in front of a label's east end) and then the thing in capitals; a blank label on a stall
  with nothing set; an empty place a dashed outline with a white plus. The stall's bubble: the 13
  things in four rows, each with its picture and what a customer pays now. A bubble with no room over
  its thing goes under it. The robots' job buttons: a stall's shows what it sells and its number, and
  the saw, the extractor and the bench each have a picture of their own; a stall robot's job name says
  what it stocks. The saw robot's page has its cut (three buttons, `setCut()`). The dock's bay painted
  round the panel and all eight pads (the panel art itself stays where its solid is, step 2). The back
  line's hourglasses beside the head at 70%. A stall's robot walks its thing over in both claws; the
  bench's robot holds a chisel and throws chips. A wrong sale says what was wanted. Info rewritten for
  four stalls, eight robots and slots 02-04.
- **Engine, one change**: the robots waiting at one output bin stand 0.8 m apart (`SPOT.fetch`; they
  were 0.4 m apart and drawn one over the other); a rules row checks it.
- **Two bugs found and fixed**: a stall's tray sorted behind the counter it sits on since the
  storefront brief, so the counter's top hid all of it but its back rim (traced: key 2.26 against
  2.30). And a tap on the second or third stall's label reached the planer: the planer's box (its
  chimney, plus the tap pad) reaches over them though nothing of it is drawn there. A tap now goes to
  the front-most thing with paint under the finger (`inked()`), falling back to the box as before.
- **Frame cost**: with four stalls and eight robots (new pose `taas-factory-eight.js`) the scene missed
  a frame in two (33.3 ms median, 81-89 of 149 over), and the robots alone were to blame (stubbed out: 1
  over; customers, labels or things: still 60-67). Robots are now baked by pose (rounded, keyed on every
  field the bake reads, least recently used out within 12 MB, each canvas the size of what it draws):
  0-1 of 149 over in three runs; the old busy pose as before. A busy quarter hour without the budget
  bakes 335 poses (17 MB), so the budget is really used.
- **A flaky row, traced before it was trusted**: the new bulb-and-eyes row went red on two unrelated
  breaks under parallel load. Cause: the hire's crate bits and sparks are flung with `Math.random()`, the
  suite's one half-second tick left some alive, and every later `tick(0)` froze them, sometimes over the
  bulb. The setup now lets them burn out; three suites at once came back green.
- **Interim until step 4**: the eval's personas still hire two (unchanged; their stall spot is the same).
- **Suites**: rules 259 -> 260 (the fetch spots' spacing); page 111 -> 129 (section 19: the counter at the
  start, buying an empty place by real taps, the 13-thing bubble, the bubble off its stall, setting a
  stall and its label, stock on its own tray, taps on every tray and label at three sizes, the jobs'
  pictures, the saw robot's cut by a real tap, a stall robot's page, the wrong-sale float, a robot
  drawn holding its thing; section 20: the back line's hourglasses, the dock of eight and its bay,
  sold out at eight, Info; section 21: the robot bake keeps the bulb and the face, and its budget).
  Break lists: page 84 -> 108 (24 `stalls-ui-*`, all caught, the three that met the flaky row re-run after it was
  fixed), engine 143 -> 144 (`stalls-fetch-crowded`, caught); step 4 re-runs both whole lists. Formal
  untouched.

### Step 4 (2026-10-17): the eval and both break lists

- **The eval's persona rebuilt to grow** (`G` in `persona()`; assumed players, each an assumed row in
  `.claude/taas.md`, "The eval's growing personas"): once both robots hold their plans it buys a stall,
  hires its robot, then sets what the stall sells, each step when it can pay and keep $20; takes out of
  a robot's slots what its new plan has not got; carries what no robot carries (planks to the saw while
  the saw's bins hold less than a stall's worth, sap logs to the extractor and its clean logs back,
  gnarled wood to the bench); and, growing, also shortens the delay when a customer waits at any empty
  stall. Without `G` the persona plays byte for byte as before (the one-line table identical). The
  one-line personas keep two robots on purpose (their rows are about one line's instructions).
- **The red row was luck, and the delay's claims are restated over seeds 1-12** (an hour each, paced
  against supervisor). Every seed: without the delay the bin holds ten stalls' worth at the hour and
  climbs (78-134 planks); with it, never more than three stalls' worth in the last 20 minutes (at most
  13); the paced line spends less. Most seeds (asserted three in four): it ends richer (10/12), both
  plans whole inside the hour (10/12). The two that end poorer (6, 10) are the two the 5 s start
  starved (satisfaction 11% and 33% after the delay went in; traced). The operator's plan comes sooner
  with the delay on 7 seeds, about the same on 3, later on 1, never on 1: no timing claim is made.
  "Over twice as long" is gone, and so are seed 7's "inside 25 minutes", "without starving" and
  "it pays" (each restated over the twelve).
- **The Tip "an agent faster than demand makes waste" was not measured as told**: Info said the plans
  come "about twice as fast" (seed 7 only). Now "Pace it: ... it buys fewer logs, and most of the time it
  ends up richer. But start the wait short ...". The waste half holds on every seed.
- **Growing the factory, seven personas** (two hours, seeds 7-12, beside the paced line that never grows,
  $674-922): a second stall of the same thing never pays (-$97 to -$197; $4.00 a customer); the saw line
  (2x4s, $190) pays on 5 of 6 ($4.86-5.08 a customer); four stalls of planks and 2x4s ($660) earn the
  most a minute (14.9-17.8) but repay only between two and four hours; the one stall switched to 2x4s, a
  large plank stall, and a stall set before its robot all lock the shop (satisfaction 10-14%, the last
  selling nothing at all); everything ($965, all eight robots, sap) ends $519-732 behind. Four hours
  (seeds 7, 8, 11, printed): saw line +$567-633, all medium +$517-680. Numbers and traces in
  `.claude/taas.md` § Measured (2026-10-17).
- **Traced causes** (each a row): customers never leave an empty stall and six fill the shop (set first,
  large planks: about one log in nine is a large normal one); a stall's robot fetches one thing a trip,
  10.7 m from the saw's bin to the first stall, about 4.4 a minute against 5 customers (cut stall: 372
  stocked in 85 minutes). Persona faults found and fixed first: feeding the saw every plank (130 2x4s
  left in its bin), a slider rule reading only medium planks (the delay at 60 s behind a large plank
  stall).
- **Two Tips added** (Info and `.claude/taas.md` § Tips; not yet seen by the CD): "More agents do not
  make more demand", "An agent is only as good as what feeds it". **Four open questions** (12-15):
  should a customer give up, should a robot carry between machines, one thing a trip, the bench earns
  nothing.
- **Break lists**: the stale breaks repointed at the current code, 22 engine and 11 page, none retired
  (each still had code to break). Each suite run once on the unbroken page first (260 / 129 / 32 green).
  Engine **143 of 144** caught (the miss is the known equivalent `bubble-before-arrival`); no row catches
  more than six breaks, all related. Eval **9 of 9** (four new: `ev-one-price`, `ev-first-stall-only`,
  `ev-customers-give-up`, `ev-carver-idle`; a fifth, carvings priced, crashed the engine on load, since
  no "Only stock" wording exists for a carving, and was replaced). Page **107 of 108** (the miss the known equivalent `no-remeasure`; one new miss, `delay-ui-no-info`, traced to a row that only asked Info to mention "Wait between tasks", which the corrected Tip also does: the row now reads the sentence, and the break is caught). No row was flaky: the rows that catch the most breaks catch related ones only.
- **Suites**: rules 260 (unchanged), page 129 (the tips row rewritten for five tips and the corrected
  wording), eval 24 -> 32 GREEN, now about a minute (it was 3 s). Formal untouched: 43 / 39 / 9. `gates.sh games/taas/index.html --eval` GREEN. Frame cost with the eight-robot pose: 16.7 ms median, 0 of 149 over (only Info's text changed on the page).

### Step 5 (2026-10-17): the docs and the gates

- **`.claude/taas.md`** read whole for one stall and two robots. Added **§ Four stalls and eight robots
  (CD, 2026-10-16) - stated**: the CD's words, the four answers, what was built and a pointer to the
  measurements. The storefront's "What was built" keeps its words (it is the 2026-10-15 build) under a
  note naming what the stalls changed; the bins brief's "not built here" now points to the new
  section. **Architecture**: `SELLS`, the four `stalls`, the `stall` die, the "Only stock X" rows
  (`only`, `ONLY`), a stall's places and bubble (`buystall`, `sell:`, `stallPrice()`, `openStalls()`),
  the shop's three rows (`SHOP`, `walkTo()`), the robots' jobs and posts (`jobKind()`, `homeOf()`,
  `SPOT.fetch`, `srcOf()`, `go()`, `release()`), `stocker()` per stall, `miller()` and `setCut()`,
  `carver()`, the new events, `drawPlate(i)`, the robot bake (`robotSprite()`, 12 MB), `inked()` and
  `stallUnder()` in the hit test, `robotBake()` on the test hook (each name read in the code).
  **How to change it**: "a new stall" (it pointed at the plan) became "another thing on sale" (a price
  and a floor put it in `SELLS`; it needs an `ONLY_TEXT` wording, since the "Only stock" rows are built
  from `SELLS` as the engine loads, a `srcOf()` bin, a name) and "a fifth stall"; a slot robot's job.
  **Open questions** 4 and 5 updated (5 has its first answer, "nothing yet", built), 11's "planned
  next" marked inferred. Header counts (260 / 129 / 32, ~4,800 lines), two assumed rows (the stall's
  six, the interim stocker row marked superseded), the break lists' old counts labelled as before the
  stalls, and a History entry for 2026-10-17.
- **`.claude/tests/README.md`**: the three factory rows (rules ~5 s / 260 with sections 14-15; page
  ~2 min / 129 with sections 19-21 and five Tips; eval about a minute / 32 with the twelve seeds,
  growing, `EVAL_SEEDS` / `EVAL_GROW_SEEDS`); break lists 144 / 143, 108 / 107, 9 / 9. Two stale
  phrases gone ("only medium planks sell", "the two jobs a robot can have").
- **`CLAUDE.md`**: the games/taas bullet (up to four stalls, up to eight robots, logs ten for $10, it
  said $1 a log) and the TAAS row (the stalls and their four answers in place of "planned", five Tips).
  **`games/CLAUDE.md`**: the TAAS entry (~4,800 lines, the stalls, eight robots, robots baked by pose;
  "every log costs $1 at the planer" gone, stale since the bins brief).
- **Gates**: `gates.sh games/taas/index.html --eval` GREEN (3 min 14 s); `check-inline-js` GREEN;
  formal 43 / 39 / 9; factory 260 / 129 / 32. The page is unchanged since step 4, so the frame cost and
  the break lists stand as measured there. No code changed in this step.
