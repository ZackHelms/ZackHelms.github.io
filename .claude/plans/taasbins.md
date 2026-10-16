# taasbins - TAAS robot factory: the picker that jumps, bins you can take from, a planer bin of bought logs

**Status:** IN PROGRESS (branch `taas-bins`)
**Requested:** 2026-10-16, the CD, after playing the delay build (quotes verbatim):

- "Fix this bug where I am scrolling in the list of instructions to select one and it unexpectedly
  (frequently) moves back to the top of the list. This is disruptive/annoying because I have to keep
  scrolling the list back down to see the items at the bottom and can lead to me clicking the wrong
  instruction."
- "Enable removing items from the input bins. For example i might put a plank in the table saw input
  bins but then my mind and decide to sell it."
- "Allow adding/removing logs to/from the planer input bin. This way i can add logs output by the SAP
  extractor. Start new game with 10 logs in the slot01 input bin. When i run out, auto restock it with
  10 more that cost me $10. No limit to how many items are in any bin."
- "Update The interface for adding or removing items from the bins (namely recycle bin which is
  currently my safety net bin that holds everything 'left over' or 'not yet allocated') so that the:
  top half of the white list area shows items i hold but could put in the bin; lower half lists items
  i could move from the bin into my inventory; the horizontal line dividing top from bottom should not
  move as items are moved between my inventory and bin; the listed items on the top should settle into
  the lower left corner of the top section (so that i could repeatedly tap that lower left item tile
  spot to move everything from me to the bin); items on the bottom should settle into the upper left
  corner of the bottom section so that I can repeatedly tap that same top left item tile spot to move
  everything from the bin into my inventory"

## The CD's three answers (asked 2026-10-16, before any code)

| Question | CD's answer |
|---|---|
| Logs now cost $1 each when bought (10 for $10): does the planer still charge $1 a press? | **Keep both**: $1 to buy each log, $1 more each time the planer processes one |
| Which logs can go in the planer's input bin? | **Any log** (sap and gnarled too); the planer treats them as now |
| When does the restock happen? | **When the planer needs a log** and the bin is empty; emptying it by hand costs nothing until then |

## The CD's second answer (2026-10-16, after the measurement) - a new brief

Asked whether to keep both log costs once measured (a good medium plank cost ~$3.05 to make, sold
for $4; an instructed line lost ~$1 a minute), the CD answered instead (verbatim):

> "Reduce machine operating cost from $1/input to $0.10/input. This represents electricity and general
> wear and tear. Ensure minimum sale price of any item never decreases below the material+labor cost
> (i think this would be $1.10 min sale price for any plank, $1.20 for two 2"x4", ...) where sale price
> decreases as customer satisfaction decreases. This should ensure i can always recover my operating
> costs and slowly restore customer satisfaction given enough time (and ability to sell all finished
> products... go ahead and add a way to purchase additional sales stalls (up to 4 total), and allow me
> to specify what is sold at each by tapping on it to set its item; any unsold items automatically go
> into my inventory when i change what is sold in a stall. Each additional stall costs $50, $100, $150.
> One robot per stall, so add 3 more robots i can order. These robots will travel to specific bin to
> fetch an item and put it in the stall. Each gets same base prompt and my instructions ensure they
> stock correctly. Add 3 more robots i can buy so i can staff them to the other slots 2,3,4."

Four answers on the stalls and robots (asked the same day):

| Question | CD's answer |
|---|---|
| With up to four stalls, what does each customer come in for? | **A stall, at random**: each customer picks one of the stalls that has an item set, all equally likely, and waits there if it is empty; arrivals stay one every 8-16 s |
| What can the robots on slots 02-04 get wrong? | **Nothing yet**: each works its machine on whatever is in its input bin; the saw robot makes the cut chosen on its page |
| What do the six new robots cost? | **+$20 each**: $20, $40, $60, $80, $100, $120, $140, $160 |
| How do the stall robots' instructions keep them right? | **Rules per item**: an "Only stock X" for each item a stall can sell, joining the list as each mistake is seen |

**Split (assumed):** part 1 ships first (the jump, the bins, the planer's bin of bought logs, $0.10 a
machine input, the price floor); part 2 (four stalls, eight robots) is a plan arc of its own,
`taasstalls`.

## The jump, traced

`renderRobot()` rebuilds the whole robot page (`dyn.innerHTML`) whenever its signature changes, and
the signature holds `r.record` (every action the robot finishes), whether a slot is affordable (money)
and the minutes since the evals were reset. The picker's list `.fx-rules` is its own scroller
(`max-height: 42vh; overflow-y: auto`), so each rebuild is a new list at scrollTop 0, and a rebuild
between a finger going down and coming up swaps the button under it.

## Design (assumed, not decided; record each in `.claude/taas.md`)

- **The page in three parts** (slots, picker, evals), each rebuilt only when its own signature
  changes; a rebuild keeps the scroll of every scroller in it; no part is rebuilt while a finger is
  down in it.
- **The planer's input bin is the rack** (`s.rack`, the key kept for saves): any log goes in; a new
  game puts 10 logs in it (drawn as logs off the old pile are; the first log on the in-feed is a
  normal medium one as before, and is not one of the 10); when the planer needs its next log and the
  bin is empty, 10 more arrive for $10 (`CFG.restock`, cost `bought`, event `'restock'`).
- **Logs you put in yourself** still roll in first and are still pressed by you if normal (any size):
  `s.rackMine` counts them, always a prefix of `s.rack`.
- **Every bin you put things in can be emptied by hand**: the bubble's `take:` works on the rack, the
  saw's, extractor's and bench's input bins and the recycle bin. One tap moves every one of a kind.
- **No bin has a limit** (none had in the engine; the stall's six is a stall, not a bin).
- **The bin bubble** (rack, three input bins, recycle bin): two halves of equal, fixed height, a line
  between them; yours on top, settled into the lower left; the bin's below, settled into the upper
  left. The halves are sized when the bubble opens to hold every kind in both, and only grow.
- **The rack shows its logs**: the baked decorative pile goes; up to six of the bin's logs are drawn.
- Saves: no version bump. A save without `rackMine` (made before this) keeps its rack as yours and
  gets the 10 starting logs behind them.

- **$0.10 a machine input** (planer, table saw, sap extractor; the bench is by hand). Money is kept to
  the cent (rounded at every change) and shown with cents.
- **The price floor**: what a customer pays is the list price times customer satisfaction, to the
  cent, never below what the thing cost to make (`CFG.floor`): a log $1, any plank $1.10 (a log and a
  press), any cut $1.20 (and a saw), sap $0.10 (one extractor run; the log comes back clean), a carving
  $1 (a gnarled log, by hand). Prices are now to the cent (they were whole dollars).

## Steps

1. Engine + rules suite rows
2. UI: robot page in parts; the bin bubble; the rack's logs; restock float; Info text; page suite rows
3. Eval re-run; break lists (engine, page) for the new rows
4. Docs (`.claude/taas.md`, tests README, CLAUDE.md row, games/CLAUDE.md if a lesson), gates, frame budget
5. Ship: badge, one commit, fast-forward `main`, push, Pages, report

## Results
- **Step 1 (2026-10-16), the engine:** `CFG.startLogs` 10, `CFG.restock` {n 10, cost $10}, `buyLogs()`,
  `restock()` (event `'restock'` {n, cost, logs}; cost key `bought`), `nextLog()` restocks only when the
  planer pulls from an empty bin; `s.rackMine` (yours, a prefix of `s.rack`); `ACCEPTS.rack` any log;
  `options()` gives every put-in bin its puts and its takes (no greyed `none` any more: the page draws
  empty halves); `take:` from any of them (event `'took'` gains `at`); `F.SAMPLE` exported. Money to the
  cent: `cents()`, `spend()` rounds; `logCost`/`sawCost`/`extractCost` $0.10; `CFG.floor` and
  `floorOf()`; `paid(s, item)` = max(floor, cents(list x satisfaction)). `load()`: `rackMine` clamped, a
  save without it keeps its rack as yours and gets 10 free logs behind; money/spent/earned/costs to the
  cent. Rules suite **194** (180 + 1 floor row + 13 in section 13; 13 rows rewritten for the bin;
  helper `feed()`; `staffed()` feeds `force.log` into the bin). Formal 43 GREEN.
- **The economy, measured (eval, seed 7):** with $1 logs + $1 presses an attentive line lost money; at
  $0.10 a press the person gets $20 at 1.6 min and robot 2 at 7.7 min (was 4.7), but an instructed
  operator handles ~18 logs a minute against 5 customers, so a line without the delay buys logs it
  never sells: the supervisor's plan of four comes at 50 min (op) / 45 min (stock); with the delay put
  in at the operator's hire (the new optimal path) at 23 / 17 min, money $+ and 11.5 $/min at the end.
  Eval reworked: every persona an hour; a person presses only while < 8 medium planks wait; the paced
  persona puts the delay in first; robot 2 inside 9 min (was 7); the plan inside 25 min on the optimal
  path; a new row (without the delay it takes over twice as long); plan-clears-floor and evals rows on
  the paced persona; operator-first "loses money" summed; stocker-only's satisfaction rider replaced by
  "pays for every jam"; money compared to the cent. **24** GREEN.
