# taasstalls - TAAS robot factory: four stalls, eight robots (plan arc)

**Status:** IN PROGRESS (step 1 done 2026-10-16: the engine's stalls and customers; branch `taas-stalls`)
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

## Steps (one per session turn, then `/compact`; each ends: tick here, Results, commit to branch `taas-stalls`, push the branch)

| # | Step | Status |
|---|---|---|
| 0 | The CD's brief and four answers recorded (this file) | DONE 2026-10-16 |
| 1 | Engine: stalls (buy, set, unsold to arms), customers picking a stall, prices per stall; rules suite rows | DONE 2026-10-16 |
| 2 | Engine: eight robots, stall jobs and "Only stock X" per item, slot 02-04 jobs; rules suite rows | open |
| 3 | UI: the counter's four stalls and labels, the stall bubble, the dock of eight, the robot page's jobs, the slot robots at work; page suite rows | open |
| 4 | Eval (personas with stalls and slot robots; the economy) and both break lists | open |
| 5 | Docs final and gates | open |
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
