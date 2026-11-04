# csparry - Combat Simulator: a parry only counts before the blade lands (CS-3), and quick and heavy strikes (CS-4) (plan arc)

**Status:** DRAFT
**Requested:** 2026-11-03. The CD, verbatim: "fix the parry timing so that I (or enemy) can only parry
prior to the opponents Sword making contact and dealing damage. Currently, I can parry successfully
during a small time Window after opponent Sword makes contact and deals damage. This needs to be
implemented in a way that will work for future attacks i might add that have different attack
telegraph timing; for example, a quick strike or heavy strike could be added to my current "normal"
strike, where quick strike does lower damage but has much shorter telegraph Window like a jab in
boxing, and heavy strike deals more damage, but has a longer telegraph window. For testing purposes it
makes sense to go ahead and add this (quick and heavy strike buttons) to the backlog either as a
sibling feature or together with the parry timing debug & fix item." Specified as backlog items
**CS-3** and **CS-4** in `.claude/combat-simulator.md` section "Backlog (parry timing and strike kinds),
specified for plan-gen". This plan **bundles both TODO entries** (`[combat-sim]` CS-3 and CS-4, top of
`TODO.md` section Now): CS-4 depends on CS-3 and shares every file with it. **CS-3 lands on `main` on
its own at step 2**, so the fix is live even if CS-4 stalls.
**The CD's three answers at plan time (2026-11-03):** the parry window **scales with the telegraph**
per strike kind; quick and heavy strikes **mix into the five-cut chain** (each counts as the chain's
next cut and keeps the 3rd/5th-hit energy); **both you and the opponent** throw them.
**Scope:** `games/combat-simulator/index.html` (the `ENGINE` block; and from step 4 the help text,
`poseOf()`, `onEvents()`, `layout()`, `KEYMAP`, `playerIntent()`, `update()`'s first-tick clear,
`icon()`, `drawHUD()`'s button loop, `SND.tell()`), `.claude/tests/drive-combat-simulator.cjs`,
`.claude/tests/negtests/combat-simulator.json`, `.claude/combat-simulator.md`,
`.claude/tests/README.md`, `games/CLAUDE.md` (the inventory paragraph), `CLAUDE.md` (the context-file
row), `TODO.md`, `DONE.md`. **Out of scope:** the shaders, `render()`, the style select, `STYLES`,
`.claude/tests/negtests/combat-simulator-styles.json` (all owned by the paused csstyles arc).

## Goal

A parry turns a cut aside only if it was raised **before that cut's contact** and within the parry
window **of that cut's own attack row**; a parry pressed while reeling from a hit (flinch) or while
staggered does nothing, for you and for the opponent alike. Every attack's timing, damage and parry
rule comes from one table, `ATTACKS`, so a new kind of strike is a row and adds no parry code. On top of
it, two new strikes: a **quick** strike (a jab: less damage, half the telegraph, a parry window half as
long) and a **heavy** strike (more damage, twice the telegraph, a longer window), each with its own
button and key, each usable as any cut of the five-cut chain, thrown by the opponent too.

## Context

Traced 2026-11-03 (the engine lifted into node, the opponent chaining cuts at the player at ranks 1, 5
and 10, the player pressing parry 0.03-0.25 s after the first cut's `hit` event): the cut that hurt
you is never parried (`tryHit()` resolves each swing once, `a.resolved`). What happens is that the
parry **succeeds against the next cut of the chain**, in every case but one (rank 10 at 0.25 s):

- a hit flinches the defender for 0.22 s (`RULES.flinch`, `index.html:120`), and a parry pressed then is
  **buffered** for 0.22 s (`RULES.buffer`, `:121`; the input loop at `:267`), so it fires the moment
  the flinch ends (`:316`), with nothing on screen to say so;
- a queued chain cut skips its recovery (`:296`), so the next cut swings about 0.10 s after the last
  one's contact and lands 0.25-0.37 s after it (0.25 at rank 10, 0.37 at rank 1);
- the parry window, 0.24 s (`RULES.parry.win`, `:124`), opens when the parry starts, so a parry
  started at the end of the flinch covers that next contact (`tryHit()`, `:238`).

Inferred, not confirmed by the CD: this is the "small window after contact". The probe also showed the
fix must not take away a parry pressed **after** the flinch: it still catches the next cut, legitimately
(it is raised before that cut's contact).

Not traced, measured in step 1: `tryHit()` runs on the first in-reach tick of the active window
(`:290`), when the pose is at the **start** of the sweep (`poseOf()`, `:1087`), so damage may show
before the blade visibly reaches the body.

Baseline (HEAD `3c26a0a`): the suite has 74 checks, 32 in part 1 (node) and 42 in part 2 (Chromium);
part 1's ladder line reads `masher rank 1 1, rank 10 0; counter rank 5 1, rank 10 0.875`.

## The design (decided here; a choice the steps leave open goes into `.claude/combat-simulator.md` as an assumed row, never silently)

### One attack table (step 1)

- After `RULES` (`:117-136`), build `ATTACKS` once. A row is
  `{ name, kind, idx, dmg, wind, act, rec, reach, arc, lunge, parry, parryWin }`.
  `ATTACKS.normal = RULES.chain.map((c, i) => ...)`: **today's numbers exactly**, `kind: 'normal'`,
  `parry: true`, `parryWin: RULES.parry.win`. `ATTACKS.power` = `RULES.power`'s numbers with
  `kind: 'power'`, `parry: false`, `parryWin: 0`. `RULES.chain` and `RULES.power` stay as the source:
  page code reads `RULES.power` (the power ring, `:1605`) and `RULES.chain.length` (`:296`, `:300`, the
  AI).
- Fighters gain `kind: 'normal'` (`makeFighter()`, `:173-181`). `startHit(F, f, idx, kind)` (`:198-202`)
  sets `f.kind = kind || 'normal'` and puts `kind` on the `swing` event.
- `specOf(f)` (`:189`) becomes `f.st === 'power' ? ATTACKS.power : ATTACKS[f.kind][f.chain]`. Everything
  that reads timing goes through it already (`phasesOf()`, `:190`; the AI; `poseOf()`; the swish in
  `stepEffects()`, `:1343`), so it all follows the row.

### The parry rule (step 1)

- In `tryHit()` (`:238`) the test becomes `H.parry && d.st === 'parry' && d.t < H.parryWin`, where `H` is
  the attacker's row (already passed in). `power` stays a parameter (the damage and event paths use
  it). The `hit` and `parry` events gain `atk: a.atkId`.
- **A parry pressed while flinching or staggered is dropped**: in `stepFighter()`'s input loop (`:267`),
  if the action found is `parry` and `f.st` is `flinch` or `stagger`, it is not buffered (attack, dodge
  and power still are, as today). **A parry already buffered is cleared** when its fighter is flinched
  (`tryHit()`'s flinch branch, `:259`) or staggered (the parry branch's `setSt(a, 'stagger')`, `:239`):
  `if (x.buf === 'parry') x.buf = null`. One rule in the engine, so it holds for the opponent too (the
  opponent's scheduled parry, `aiIntent()` `:361`, arrives as input and meets the same drop).
- The opponent's mind times its parry from the row: the lead `0.10` at `:361` becomes
  `Math.min(0.10, 0.8 * H.parryWin)` with `H = specOf(foe)` (unchanged for normal rows: `0.8 * 0.24 >
  0.10`).

### Quick and heavy strikes (step 3: engine)

- `RULES.kinds = { quick: { wind: 0.5, rec: 0.8, dmg: 0.6 }, heavy: { wind: 2.0, rec: 1.3, dmg: 1.6 } }`.
  `ATTACKS.quick` and `ATTACKS.heavy` are `RULES.chain` with `wind`, `rec` and `dmg` multiplied by the
  kind's factors; `act`, `reach`, `arc` and `lunge` as the chain row's; `parry: true`.
- **The window scales with the telegraph (the CD's answer):** `parryWin = Math.min(RULES.parry.win *
  K.wind, RULES.parry.total - 0.10)`: quick **0.12 s**, heavy **0.40 s** (0.48 capped, so a parry
  always ends with 0.10 s open). The factor is the kind's, not the rank's `windMul`: the normal chain's
  window stays 0.24 s at every rank as shipped and measured (decided reading of "scale with telegraph").
- **Mixed into the chain (the CD's answer):** `ACTIONS` (`:137`) becomes
  `['power', 'dodge', 'parry', 'heavy', 'quick', 'atk']`, and
  `const STRIKE = { atk: 'normal', quick: 'quick', heavy: 'heavy' }`. `begin()` (`:204-208`): any strike
  action takes the next chain index by today's grace rule and its own kind. The queue: `:284` queues any
  strike, storing its kind (`f.queued = STRIKE[f.buf]`, a string, truthy); `:296` starts the next cut
  with `f.queued` as its kind; `:297`'s `f.buf !== 'atk'` becomes `!STRIKE[f.buf]`; `:302` puts the
  queued strike's own action back in the buffer. Combo energy (`comboEnergyAt`) is unchanged: every
  landed cut counts, whatever its kind.
- **The opponent throws them too (the CD's answer):** `rankParams()` (`:156-171`) gains
  `quickP: lerp(0.05, 0.30, t)` and `heavyP: lerp(0.25, 0.15, t)` (low ranks lean on readable heavies,
  high ranks on jabs; assumed). Each cut the AI starts (`:385`) or chains (`:380`) picks its kind from a
  **second random stream**, `F.krng = mulberry32((((seed >>> 0) || 1) ^ 0x5bd1e995) >>> 0)` made in
  `newFight()`, so the kind rolls never shift `F.rng`'s draws. The stagger punish (`:373`) keeps normal
  cuts.

### The page (step 4)

- **Buttons:** `layout()` (`:1359-1373`) adds `quick: { x: ax - 3.4 * R * cos(22.5 deg), y: ay - 3.4 * R *
  sin(22.5 deg), r: 0.6 * R }` and `heavy` the same at **67.5 deg**; the four existing buttons do not move.
  Checked during planning by replicating `layout()` and the suite's layout rules (`:294-312`: inside the
  viewport, no overlap with the power ring at 1.3 r, clear of the stick by 8 px, below the bars + 40) at
  all seven sizes with zero safe insets: it passes; 3.2 R does not (overlaps power). Quick sits low, by
  the thumb's rest; heavy high.
- **Keys:** `KEYMAP` (`:1413`) adds `KeyU: 'quick'`, `KeyO: 'heavy'`. `playerIntent()` (`:1424-1435`) passes
  `quick` and `heavy`; `update()`'s first-tick clear (`:1453`) clears them too.
- **Icons** (`icon()`, `:1666`): quick, a short straight blade with three speed lines; heavy, a katana
  under a thick double arc. `drawHUD()`'s loop (`:1769`) draws all six.
- **The telegraph you can see:** `poseOf()` (`:1086`): during the wind-up, quick uses
  `mixKey(POSE.guard, C.wind, 0.55)` (a short backswing) and heavy `mixKey(POSE.guard, C.wind, 1.25)` with
  `drop` 0.14 (a big one); sweep and follow-through unchanged. Timing already follows the row.
- **The telegraph you can hear:** `SND.tell(kind)` (`:1860`): quick shorter and higher, heavy longer and
  lower; `onEvents()` (`:1289`) passes `ev.kind`.
- **Help** (the settings' HOW TO FIGHT, `:92-96`): a paragraph for quick and heavy strikes (less or more
  damage, a shorter or longer wind-up and parry window, both work as any cut of the chain), one sentence
  under Parry ("a parry pressed while you reel from a hit does nothing"), and `U quick strike, O heavy
  strike` on the Keyboard line. Opt-in text, so `games/CLAUDE.md` section Discovery over instruction allows it.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md` section
Plans). One task per arc step; each is one session's work and one commit on the branch `cs-parry`.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | CS-3 engine: `ATTACKS`, `specOf` through it, the parry judged by row, the drop and clear, the AI's lead, events carry `atk`; 7 rows; breaks; the one-off blade-at-contact measurement | cross-system | opus | high | timing semantics across the input buffer, the state machine and the AI at once; rows that must reproduce the traced bug and bite; a ladder re-measure to read |
| 2 | CS-3 docs, badge, **land CS-3 on `main`**, verify Pages | docs | sonnet | high | mechanical but every count and name read from the code; the landing is the documented procedure |
| 3 | CS-4 engine: kinds, chain mix, the AI's kinds on a second stream, `rankParams`; 5 rows (+1 restated, the persona restated); breaks | cross-system | opus | high | the queue's boolean becomes a kind; balance re-measured with a persona change; the second-stream reasoning |
| 4 | CS-4 page: buttons, keys, icons, poses, tells, help; 3 rows (+2 restated); breaks | ui | sonnet | high | the geometry is given; canvas icon drawing and CDP rows need care, not design |
| 5 | Docs final, the break list in full, badge, land on `main`, Pages, report | docs | sonnet | high | mechanical, but runs ~30 breaks and must trace any MISSED rather than delete it |

- **Ordering / dependencies:** strictly 1 -> 2 -> 3 -> 4 -> 5 (one file; each step builds on the last).
  Parallel-safe: none.
- **Files owned per task:** 1 and 3: the `ENGINE` block (`index.html:102-392`, between
  `/*ENGINE:BEGIN*/` and `/*ENGINE:END*/`), the suite's part 1, `negtests/combat-simulator.json`; 4: the
  page code named in Scope outside the engine, the suite's part 2, the same break list; 2 and 5: the docs
  named in Scope, the badge line, `TODO.md` / `DONE.md`, this plan.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/combat-simulator/index.html`
  after every edit; the suite green with its new rows; `.claude/scripts/gates.sh
  games/combat-simulator/index.html` GREEN at the end of every step; the step's new breaks all caught;
  both break lists still **apply** (every `old` found exactly once).
- **Suite counts** (re-derive each time as baseline + added - removed, and state it in Results):
  74 today (32 part 1 + 42 part 2) -> step 1 adds 7 (81) -> step 3 adds 5 (86) -> step 4 adds 3 (89).
  If a step needs another row, add it and say so; never remove one to go green.
- **Tier audit (required):** no step passes a haiku checklist. 1 and 3 change the fight's rules and must
  read a re-measured ladder (opus, high: no verbatim spec for the row bodies). 4's geometry and numbers
  are given, but canvas icons and CDP touch rows are not verbatim (sonnet, high). 2 and 5 must read every
  count and name out of the code and run the landing and Pages procedure exactly (sonnet, high).
- **Decision defaults:** everything under "The design". Beyond it:
  - a number not given here (a sound's pitch, an icon's strokes) is picked, recorded as an assumed row
    in `.claude/combat-simulator.md`, and the run moves on: the CD playtests it;
  - a suite row the new code contradicts is **restated** (same claim, new detail), named in Results,
    never deleted;
  - if the blade-at-contact measurement (step 1) shows the blade more than 0.25 m from the defender's
    body at the `hit` tick, **do not move contact in this arc**: write the numbers in Results and a
    follow-up for the CD (moving contact changes every timing the ladder was measured on);
  - if a ladder row goes red in step 3, first restate the `counter` persona as specified there; then tune
    only the **new** numbers (`RULES.kinds` factors, `quickP`, `heavyP`); never a shipped `rankParams`
    field or a `RULES` timing.
- **Embedded-content QA:** the line numbers here were read on `3c26a0a`; re-read before editing, since
  every step moves lines (and if csstyles' resume lands first, everything outside the engine moves). The
  GLSL-free snippets in "The design" are shapes to follow, not code to paste unread. The 3.4 R layout was
  checked by a replica of `layout()` with zero safe insets, the way the suite runs; the suite row is the
  proof. Counts above are the invariant.
- **Escalation triggers** (stop and report to the CD): the ladder rows cannot be kept green without
  changing a shipped `rankParams` field or `RULES` timing; the paint row ("a skin is paint") fails and the
  cause is in the engine; any change would need the shaders, `render()` or the styles break list.
- **Playtest** (after step 2): get hit by a chained cut and press parry while reeling: nothing happens (no
  PARRY, no stagger); press it once you have recovered and before the next cut lands: it still parries.
  Watch the opponent too: it no longer parries your next cut straight out of a flinch. (After step 5):
  the two new buttons and U / O; mix them into the chain; the opponent's jab (hard to parry: a short
  backswing, a high tell, a 0.12 s window) against its heavy (a big backswing, a low tell, 0.40 s); are
  the damage numbers and telegraphs right? Every number is in the assumed rows.
- **Publish:** default (the overseer lands and verifies Pages at steps 2 and 5).
- **Commit strategy:** one conventional commit per step on `cs-parry`, scope `combat-simulator`; landed on
  `main` by `.claude/scripts/land-on-main.sh` at steps 2 and 5 (producer config section Integration).

## Steps (one per session, then `/compact`; each ends: tick here, Results, commit to `cs-parry`, push the branch)

| Step | What | Status |
|---|---|---|
| 1 | CS-3 engine, rows, breaks, the blade-at-contact measurement | done |
| 2 | CS-3 docs, land, Pages | done (docs and badge; the overseer lands) |
| 3 | CS-4 engine | done |
| 4 | CS-4 page | done |
| 5 | Docs final, break list, land, Pages | done (docs, break run and badge; the overseer lands) |

### Step 1 - CS-3: one attack table, the parry judged against it, no parry from a flinch

Build "One attack table" and "The parry rule". Keep the word "style" out of the engine (a row checks
`!/style/i.test(ENG)`, `drive-combat-simulator.cjs:49`).

Rows (part 1; 74 -> 81). Helpers to add beside `incoming()` (`:81-86`): a scripted chain thrower (the
opponent taps a strike whenever it is free or wound past the queue point, as the probe did) and a
recorder of `hit` / `parry` / `parryStart` events by time.
1. **The CD's case:** at ranks 1, 5 and 10, the opponent chains at the player; the player presses parry
   once, at the first `hit` + 0.03, 0.06, ... 0.21 s (inside the flinch): no player `parryStart` and no
   player `parry` in the following 1.0 s, in every case.
2. **A parry after the flinch still works:** the same chains; the player presses parry on the first tick
   after the flinch ends: the next chained cut is parried, at ranks 1, 5 and 10.
3. **A parry buffered before a hit is cleared by it:** the player starts a cut and presses parry during
   its own wind-up (buffered); the opponent's cut, already swinging, lands first: no player `parryStart`
   after the flinch.
4. **The same for the opponent:** rows 1 and 2 with the roles reversed (the player chains at an
   opponent whose inputs are scripted, `aiIntent` not called). Do not test at a one-tick boundary:
   `stepFight()` steps the player first (`:331-335`), so a same-tick parry and contact resolve one tick
   differently for each side.
5. **Each row's own window:** for every row of `ATTACKS` with `parry: true` (iterate the table, so step 3's
   rows join without editing this one), the opponent throws that row at a player in reach; a parry
   started `parryWin` minus 2 ticks before contact turns it aside, one started `parryWin` plus 2 ticks
   before it does not. Contact is the first tick of the active window with the fighters 1.2 m apart
   (as `dummy()`, `:43`).
6. **No swing that dealt damage is ever parried:** AI-vs-`counter` duels at ranks 1, 5 and 10, four seeds
   each, every event kept: no `atk` id appears in both a `hit` and a `parry` event.
7. **The normal rows are today's numbers:** `ATTACKS.normal` matches a literal copy of today's chain
   (`dmg`, `wind`, `act`, `rec`, `reach`, `arc`, `lunge`), each with `parry: true`, `parryWin: 0.24`;
   `ATTACKS.power.parry === false`.

The ladder rows (`:195-207`) are re-measured, not edited: write the `masher` / `counter` line in Results
beside the baseline (`1, 0; 1, 0.875`).

Breaks (append to `.claude/tests/negtests/combat-simulator.json`; each caught by its own row):
`parry-buffered-through-flinch` (the drop removed: rows 1, 4), `flinch-keeps-buffered-parry` (the clear
removed: row 3), `drop-only-player` (the drop gated on `f.id === 'p'`: row 4), `parry-window-wide`
(`parryWin` of the normal rows + 0.1: rows 5, 7), `swing-resolves-twice` (`a.resolved = true` removed in
`tryHit()`: row 6). **Re-point** `power-parryable` (its `old`, the line at `:238`, is rewritten): break
`ATTACKS.power` to `parry: true, parryWin: RULES.parry.win` instead (both: `parry: true` alone leaves a
window of 0, which no parry can meet, and the break would go uncaught); the existing "a power attack
cannot be parried" row still catches it. Then dry-apply both break lists (every `old` found exactly once).

**The blade-at-contact measurement** (one-off, in Results, not a row): in the page, for each of the five
chain cuts at rank 1 and at rank 10 (the opponent cutting the player, set up as `incoming()` does), step
one tick at a time; on the tick the player's `hp` drops, `__CS.draw()` and measure the distance from the
opponent's blade segment (`VIS.e.blade.hilt` to `.tip`) to the player's body axis (a segment from
`(p.x, 0.9, p.z)` to `(p.x, 1.6, p.z)`), minus `RULES.body`. Ten numbers. Over 0.25 m: a follow-up, per the
decision default.

### Step 2 - CS-3 docs, land CS-3, verify Pages

- `.claude/combat-simulator.md`: CS-3 marked shipped (date, commit) with the traced cause; Architecture
  says `tryHit()` judges a parry by the attacker's `ATTACKS` row and names the drop and clear; Assumed
  rows for anything picked in step 1; Tests section count and rows; the blade measurement's numbers.
- The help text's Parry sentence ("a parry pressed while you reel from a hit does nothing"), here rather
  than in step 4 so the shipped fix explains itself.
- `.claude/tests/README.md` row for `drive-combat-simulator.cjs` (`:309`): the count and the parry rows.
- `TODO.md`: the entry stays (CS-4 is still open) but says CS-3 shipped with the badge; `DONE.md`: a CS-3
  line.
- Stamp the badge (`.claude/scripts/stamp-badge.sh games/combat-simulator/index.html`), run `gates.sh`,
  commit (step 2), push the branch, then land: `.claude/scripts/land-on-main.sh cs-parry <msg> --dry-run`,
  then for real; if it reports `behind`, merge `origin/main` into `cs-parry`, re-run the gates, land again.
  Verify the Pages run for the landed SHA (producer config section Publish). Quote the badge read back
  from the file.

### Step 3 - CS-4 engine: quick and heavy strikes

Build "Quick and heavy strikes". The page needs nothing yet to stay green: the player's intent has no
`quick` or `heavy` until step 4 (undefined reads false), and `poseOf()` already times any row.

Rows (part 1; 81 -> 86):
1. **The kind rows:** `ATTACKS.quick` / `.heavy` are the chain with `wind`, `rec` and `dmg` scaled by
   0.5 / 0.8 / 0.6 and 2.0 / 1.3 / 1.6, other fields equal, `parryWin` 0.12 and 0.40.
2. **Each strike starts its kind:** at a dummy (`:43`), `quick`, `heavy` and `atk` each start a cut whose
   `swing` event carries its kind; landed on the same chain index, damage is 0.6x and 1.6x normal's.
3. **Mixed into the chain:** taps `atk`, `quick`, `heavy`, `atk`, `quick`, each as the last cut is half
   wound: chain indices 0-4 with those kinds, and the combo pays `combo3` and `combo5`.
4. **The opponent throws all three:** AI-vs-`counter` duels, four seeds, 60 s each: at rank 5 every kind
   is swung at least once; the quick share at rank 10 is above rank 1's and the heavy share at rank 1
   above rank 10's.
5. **A telegraph matters to the opponent's mind:** at rank 5, the player throws 40 heavies and 40 quicks,
   each a first cut from `free` at a dummy in reach with the AI's mind on: the opponent parries a larger
   share of the heavies than of the quicks.

Restated: step 1's row 5 now covers 15 rows (its detail must list the kinds). The `counter` persona
(`:177-187`) answers from the row: `until <= Math.min(0.13, 0.9 * E.specOf(e).parryWin)` in place of
`until <= 0.13` (a player who reads the telegraph). Re-measure the ladder and write the line in Results.

Breaks: `parry-window-global` (`tryHit()` reads `RULES.parry.win` again: step 1's row 5 on the quick rows),
`quick-not-quick` (quick's `wind` factor 1: rows 1, 2), `kinds-break-chain` (a quick or heavy always
starts at index 0: row 3), `ai-never-quick` (`quickP` 0: row 4). **Re-point** `chain-of-three` (its `old`,
the line at `:296`, is rewritten) to the new line, same break. Dry-apply both lists.

### Step 4 - CS-4 page: buttons, keys, icons, the telegraph you can see and hear

Build "The page" (the help text's Parry sentence is already in from step 2).

Rows (part 2; 86 -> 89):
1. **The quick button quick-strikes and the heavy button heavy-strikes:** CDP touch on each, as the
   dodge / parry loop does (`:253-259`): `F.p.st === 'atk'` and `F.p.kind` is the button's kind.
2. **U and O do the same** (`page.keyboard.press('KeyU')`, `'KeyO'`, one tick each).
3. **The wind-up shows the kind:** `__CS.poseOf()` at half the wind-up of the same chain index: the hand
   key's distance from `POSE.guard` is smallest for quick and largest for heavy (expose `POSE` on `__CS`
   if needed; it is page code, not engine).

Restated: the layout row (`:293-314`) iterates `LAY.btn`, so it now checks six buttons (its detail must
name them); the paint scenario (`duelUnder`, `:384-397`) presses `quick` and `heavy` too (at
`i % 90 === 30` and `i % 90 === 60`, beside `atk` every 30), so new swings are on screen while it proves
the fighters byte-identical under every style.

Breaks: `quick-button-missing` (no `quick` in `LAY.btn`: row 1), `keys-no-heavy` (no `KeyO`: row 2),
`heavy-overlaps-power` (heavy at 45 deg: the layout row), `kind-pose-ignored` (`poseOf()` ignores the kind:
row 3).

### Step 5 - docs final, the break list, land, Pages

- `.claude/combat-simulator.md`: CS-4 shipped; the CD's three answers in its section (already recorded at
  plan time) marked built; Assumed rows for every number (`RULES.kinds`, `quickP`, `heavyP`, the 0.10 s
  cap, the keys, 3.4 R and the angles, the pose blends, the tells); Architecture: `ATTACKS` and `STRIKE`;
  How to add: "an attack kind is one `RULES.kinds` entry, a button, a key and an icon"; Tests.
- `.claude/tests/README.md` row; `games/CLAUDE.md` Combat Simulator inventory paragraph (quick and heavy
  strikes, the parry rule); `CLAUDE.md` context-file row (one clause: the attack table and the parry
  judged by row).
- Run the whole of `.claude/tests/negtests/combat-simulator.json` through
  `python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/combat-simulator.json --page-env CS_PAGE
  --jobs 2 -- node .claude/tests/drive-combat-simulator.cjs` (with `NODE_PATH` as in Gotchas); every
  break caught; a MISSED one is traced and the row fixed, never deleted. Also prove the styles list still
  applies (dry-apply; running it is not needed, nothing it targets changed).
- `.claude/plans/csstyles.selector-toon-neon.md` Status: one sentence that the suite counts it quotes
  moved by this arc's rows (re-derive from the current baseline on resume).
- `TODO.md`: the entry moves to `DONE.md` (a CS-4 line).
- Badge, `gates.sh`, commit, push, land, Pages, quote the badge.

## Gotchas / bindings

- **The engine stays DOM-free and never says "style"** (`drive-combat-simulator.cjs:48-49`): no comment
  like "jab-style" inside `/*ENGINE:BEGIN*/ ... /*ENGINE:END*/`.
- **`f.queued` becomes a kind string** in step 3. Every use is a truthiness test today (`:284`, `:296`,
  `:300-302`, `aiIntent()`, the suite's `masher` and chain helpers); keep it that way and never compare it
  `=== true`. `startHit()` resets it to `false`.
- **Break `old` strings must occur exactly once.** Do not copy a line that a break targets (for example
  `  stagger: 1.5, flinch: 0.22,`) into new code; re-point any break whose line a step rewrites
  (`power-parryable` in step 1, `chain-of-three` in step 3), keeping its intent. `negtest-copies.py` refuses
  a list whose `old` is missing or doubled.
- **`node` alone cannot load the page half of the suite**: plain `node .claude/tests/drive-combat-simulator.cjs`
  fails part 2 with "playwright-core not resolvable". Run it through `gates.sh`, or with
  `NODE_PATH=/opt/node-tools/node_modules` (the path varies by container: `.claude/scripts/README.md`
  section smoke-mobile).
- **SwiftShader frames are slow**: wait on `__CS.APP.frames` or draw synchronously, never on wall time
  (`.claude/tests/README.md`, the row for this suite). `negtest-copies.py --jobs 2`, no more.
- **One tick of asymmetry**: `stepFight()` steps the player, then the opponent, so in the same tick a
  player's parry beats an opponent's contact and an opponent's parry loses to a player's. 8 ms; leave it,
  and keep the mirror rows away from the boundary.
- **`RULES.chain` and `RULES.power` stay**: page code reads them (`:1605`). `ATTACKS` is built from them,
  never the other way round.
- **The second random stream**: `F.rng` must be drawn exactly as before for the same decisions; the kind
  roll uses `F.krng` only. The paint snapshot (`:394`) reads `F.rng()` and `F.ai`; it does not need
  `F.krng`, since every style runs the same seed.
- **The csstyles arc is paused mid step 4**, its WIP on the remote branch `cs-styles-step4-wip`
  (`85bf3c2`), not on `main`. This arc does not touch the shaders, `render()`, `STYLES` or the styles break
  list. When csstyles resumes after this lands, its cherry-pick may conflict in
  `drive-combat-simulator.cjs`: keep both sides.
- Commit with explicit pathspecs, never `git add -A`. Stamp the badge with `stamp-badge.sh` and read it
  back from the file. Land with `land-on-main.sh`, never a merge commit on `main` (CLAUDE.md section Git
  workflow: another session may push to `main` while this runs).

## Validation

Per step: `check-inline-js.cjs` after edits; `gates.sh games/combat-simulator/index.html` GREEN; the
step's breaks caught. At steps 2 and 5: the Pages run for the landed SHA concludes `success` (producer
config section Publish). The CD's playtest is in Implementation guidance.

## Follow-ups

- If the blade-at-contact numbers are large: the CD decides whether contact should move later in the
  sweep (a change to every timing). **Measured in step 1: yes for three of ten** (yoko at rank 1 0.255 m,
  shomen 0.290 m at rank 1 and 0.327 m at rank 10; table in Results, Step 1). Contact left where it is.
- More strike kinds (the CD's "future attacks"): one `RULES.kinds` entry each, plus a button, a key and an
  icon; the six-button cluster has no room for a seventh at 360 x 640 without a new layout.

## Results (append, do not rewrite)

### Step 1 (2026-11-03)

**What changed** (`games/combat-simulator/index.html`, the `ENGINE` block only):
- `ATTACKS` built once after `RULES` from `RULES.chain` / `RULES.power` (`RULES` untouched): `normal` is
  today's chain with `kind: 'normal', idx: i, parry: true, parryWin: RULES.parry.win`; `power` is
  `RULES.power` with `kind: 'power', idx: -1, parry: false, parryWin: 0`.
- `makeFighter()`: `kind: 'normal'`. `startHit(F, f, idx, kind)`: sets `f.kind = kind || 'normal'`, the
  `swing` event carries `kind`. `specOf(f)`: `ATTACKS.power` or `ATTACKS[f.kind][f.chain]`.
- `tryHit()`: the parry test is `H.parry && d.st === 'parry' && d.t < H.parryWin` (H, the attacker's row;
  `power` stays a parameter for the damage and event paths); `hit` and `parry` events carry `atk: a.atkId`;
  a parry already buffered is cleared when its fighter is flinched (`d.buf`) or staggered (`a.buf`).
- `stepFighter()`'s input loop: a `parry` found while `f.st` is `flinch` or `stagger` is dropped, not
  buffered (attack, dodge and power still are).
- `aiIntent()`: the parry lead is `Math.min(0.10, 0.8 * H.parryWin)` (0.10 for every row today).

**Rows** (`.claude/tests/drive-combat-simulator.cjs`, part 1, section "a parry only counts before the blade
lands"; helpers `chainTap`, `stepT` (stamps each event with its time), `chainAt`, `attackRows` beside
`incoming()`; the engine handle now also returns `ATTACKS` and `startHit`):
1. a parry pressed while reeling from a hit does nothing: no parry starts and no cut is turned in the next 1.0 s (ranks 1, 5, 10; pressed 0.03-0.21 s after the hit)
2. a parry pressed on the first free tick after the flinch turns the next chained cut aside (ranks 1, 5, 10)
3. a parry held in the buffer is cleared by the hit that flinches its fighter: none starts after the flinch, even when the buffer outlasts it
4. the opponent too: its parry while reeling is dropped (0.03-0.18 s after the hit), its parry once free meets the next cut (ranks 1, 5, 10)
5. every parryable row is judged by its own window: a parry raised parryWin - 2 ticks before contact turns it, parryWin + 2 does not (normal kesa, gyaku, yoko, tsuki, shomen)
6. no swing both hurts and is parried, or lands twice: each attack id meets one hit or one parry at most (AI v counter, ranks 1, 5, 10, four seeds)
7. the normal attack rows are today's chain exactly, each parryable for 0.24 s; the power row is not parryable

**Suite:** 74 -> **81** passed, 0 failed (part 1 32 -> 39, part 2 42 unchanged); `gates.sh
games/combat-simulator/index.html` GREEN. No row restated or removed.

**Ladder, re-measured** (rows unedited, all green):
`masher rank 1 1, rank 10 0; counter rank 5 1, rank 10 1` against the baseline
`masher rank 1 1, rank 10 0; counter rank 5 1, rank 10 0.875`. The counter persona's rank-10 rate rose
because the opponent can no longer parry the persona's stagger punish straight out of a flinch.

**Breaks** (`negtests/combat-simulator.json`, 19 -> 24 entries; run with `negtest-copies.py --jobs 2
--only ...`):
- `parry-buffered-through-flinch` (the drop removed): **caught** by rows 1 and 4.
- `flinch-keeps-buffered-parry` (the flinch clear removed): **caught** by row 3.
- `drop-only-player` (the drop gated on `f.id === 'p'`): **caught** by row 4.
- `parry-window-wide` (normal rows' `parryWin` + 0.1): **caught** by row 7 only. Row 5 does not catch it,
  by design: it measures each row against that row's own `parryWin`, so a wider value moves both the
  window and the measurement (row 5 is the one that will catch step 3's `parry-window-global`).
- `swing-resolves-twice` (`a.resolved = true` removed in `tryHit()`): **caught** by row 6 (and by row 2,
  "a full five-cut chain fits inside one stagger" and four dodge / armour / ladder rows).
- `power-parryable`, **re-pointed** to `ATTACKS.power` (`parry: true, parryWin: RULES.parry.win`):
  **caught** by "a power attack cannot be parried" (and by row 7).
- All 6 caught (`NEGCOPIES: GREEN`). Both lists dry-apply, every `old` found exactly once:
  `combat-simulator.json` 24, `combat-simulator-styles.json` 14.

**Blade at contact** (one-off; `__CS.draw()` on the tick the player's `hp` drops, opponent cutting from
1.2 m as `incoming()` does; distance from the opponent's blade segment `VIS.e.blade.hilt`-`.tip` to the
player's body axis `(p.x, 0.9..1.6, p.z)`, minus `RULES.body` 0.32; negative = the blade is already inside
the body's radius):

| cut | rank 1 | rank 10 |
|---|---|---|
| 1 kesa | -0.105 m | -0.113 m |
| 2 gyaku | 0.193 m | 0.170 m |
| 3 yoko | **0.255 m** | 0.226 m |
| 4 tsuki | -0.243 m | -0.241 m |
| 5 shomen | **0.290 m** | **0.327 m** |

Three of the ten are over 0.25 m (yoko at rank 1, shomen at both ranks: shomen's tip is still overhead,
y 2.34-2.38 m, when it does damage). Per the decision default, **contact was not moved**; it is a
follow-up for the CD (see Follow-ups).

**Assumed choices (step 1):**
- `ATTACKS.power.idx` is `-1` (a power attack's `f.chain`).
- The clear of a buffered parry on stagger (`a.buf`) is in, beside the flinch clear the break targets;
  no break of its own (a 1.5 s stagger outlasts the 0.22 s buffer, so it cannot show in play today).
- Row 3 asserts the state (`F.p.buf` null on the hit tick) and repeats the scenario with `RULES.buffer`
  raised to 0.6 s (restored after): with today's numbers a buffered parry always times out before the
  flinch ends (both 0.22 s), so the observable half alone could not fail.
- Row 4 presses 0.03-0.18 s after the hit, not to 0.21: the opponent steps second, so at 0.21 s it is on
  its last reeling tick, one tick from a legitimate parry (the one-tick boundary the plan says to avoid).
- Row 5 throws a `power` row the way a fighter does (10 energy, the power input) rather than through
  `startHit`, so the row survives `power-parryable` (which makes the power row parryable) and leaves that
  break to the power row it belongs to.
- Row 6 also counts a swing that lands twice (the same claim, every swing resolves once), which is how it
  catches `swing-resolves-twice`: with `a.resolved` gone a hit flinches the defender, so a later parry of
  the same swing cannot happen, but more hits can.

### Step 2 (2026-11-03)

Docs only, plus one help sentence and the badge. Not landed (the overseer lands it).

- `.claude/combat-simulator.md`: CS-3 marked shipped with the traced cause; Architecture names `ATTACKS`, the parry test against the attacker's row, the drop and the clear; five Assumed rows (parry rows, the drop, the clear, the AI's parry lead, contact left where it is); Tests now 81 (39 + 42), the seven rows listed and the 24 breaks named; the ladder re-measure (counter rank 10 0.875 -> 1, the opponent can no longer parry out of a flinch); the blade-at-contact table and the follow-up for the CD (three cuts over 0.25 m, contact not moved) under "CS-3 as built".
- `games/combat-simulator/index.html`: one sentence under Parry in HOW TO FIGHT ("A parry pressed while you reel from a hit does nothing."), plus the badge. It touches no break's `old` string.
- `.claude/tests/README.md`: the `drive-combat-simulator.cjs` row (81 checks, the style rows 13 of 81, the seven parry rows, 24 breaks).
- `TODO.md`: the CS-3/CS-4 entry stays, with CS-3 shipped and the badge. `DONE.md`: a CS-3 line.
- Badge stamped: `build 2026-11-03 20:43 UTC`.

### Step 3 (2026-11-03)

**What changed** (`games/combat-simulator/index.html`, the `ENGINE` block only; the page needs nothing yet):
- `RULES.kinds = { quick: { wind: 0.5, rec: 0.8, dmg: 0.6 }, heavy: { wind: 2.0, rec: 1.3, dmg: 1.6 } }`. `ATTACKS.quick` and
  `ATTACKS.heavy` are built from `RULES.chain` by a loop over `RULES.kinds` (so a new kind is one entry): `wind`, `rec`, `dmg`
  scaled, every other field the chain row's, `kind`, `idx`, `parry: true`, `parryWin = Math.min(RULES.parry.win * K.wind,
  RULES.parry.total - 0.10)`, i.e. 0.12 s and 0.40 s.
- `ACTIONS = ['power', 'dodge', 'parry', 'heavy', 'quick', 'atk']`; `STRIKE = { atk: 'normal', quick: 'quick', heavy: 'heavy' }`.
- `begin()`: any `STRIKE` action takes the next chain index by the grace rule and starts its own kind.
- `stepFighter()`: the queue stores the kind (`f.queued = STRIKE[f.buf]`, a truthy string; `startHit()` still resets it to
  `false`), a chained cut starts with `f.queued` as its kind, the non-strike branch tests `!STRIKE[f.buf]`, and a queue left at
  the end of recovery goes back in the buffer as its own action (`'atk'` for normal, else the kind).
- `rankParams()` gains `quickP: lerp(0.05, 0.30, t)` and `heavyP: lerp(0.25, 0.15, t)`.
- `newFight()` makes `F.krng = mulberry32((((seed >>> 0) || 1) ^ 0x5bd1e995) >>> 0)`. A new `aiStrike(F)` rolls `F.krng` once per
  cut and returns `'quick'`, `'heavy'` or `'atk'`; `aiIntent()` uses it for the cut it starts and the cut it chains. `F.rng` is
  drawn exactly as before. The stagger punish still presses `atk` (normal cuts).
- The word "style" is still absent from the engine; it stays DOM-free.

**Rows** (`.claude/tests/drive-combat-simulator.cjs`, part 1, section "quick and heavy strikes"):
1. the quick and heavy rows are the chain with wind-up, recovery and damage x0.5/0.8/0.6 and x2.0/1.3/1.6, parryable for 0.12 s and 0.40 s
2. attack, quick and heavy each start a cut whose swing carries its kind; on the same cut quick does 0.6x and heavy 1.6x normal's damage, quick winds up in half the time
3. quick and heavy strikes mix into the chain: atk, quick, heavy, atk, quick are cuts 1-5 of one chain, and the combo pays at 3 and 5
4. the opponent throws all three kinds (rank 5), quick more often at rank 10 than at rank 1 and heavy more often at rank 1 than at rank 10 (AI v counter, four seeds, 60 s)
5. a telegraph matters to the opponent: at rank 5 it parries more of 40 heavies than of 40 quicks, each a first cut from free

**Restated** (same claim, new detail; none removed):
- Step 1's row 5 ("every parryable row is judged by its own window") now iterates 15 rows and names them
  (`15 rows: normal, quick, heavy x kesa, gyaku, yoko, tsuki, shomen`); it requires at least 15 rows and all three kinds.
- The `counter` persona answers a cut at `until <= Math.min(0.13, 0.9 * E.specOf(e).parryWin)` (a player who reads the
  telegraph); a power attack is still dodged at 0.13 as before.

**Suite:** 81 -> **86** passed, 0 failed (part 1 39 -> 44, part 2 42 unchanged, the paint row "a skin is paint" green);
`gates.sh games/combat-simulator/index.html` GREEN.

**Ladder, re-measured** (rows unedited, all green): `masher rank 1 1, rank 10 0; counter rank 5 1, rank 10 1`, the same as
step 1's `masher rank 1 1, rank 10 0; counter rank 5 1, rank 10 1`. No tuning was needed.

**Measured kind shares** (row 4's scenario, the opponent's swings): rank 1 quick 0.054 / heavy 0.214 (56 swings), rank 5
0.225 / 0.188 (80), rank 10 0.104 / 0.041 (193). Rank 10's quick share is below `quickP` (0.30) because about half its swings
there are the stagger punish, which stays normal. Row 5's split at rank 5: heavies parried 10 of 40, quicks 0 of 40 (a quick
winds up before a rank-5 mind can answer).

**Breaks** (`negtests/combat-simulator.json`, 24 -> 28 entries; run with `negtest-copies.py --jobs 2 --only ...`):
- `parry-window-global` (`tryHit()` reads `RULES.parry.win` again): **caught** by step 1's row 5 (restated).
- `quick-not-quick` (quick's `wind` factor 1): **caught** by rows 1 and 2.
- `kinds-break-chain` (a quick or heavy always starts at index 0): **caught** by row 3.
- `ai-never-quick` (`quickP` 0): **caught** by row 4.
- `chain-of-three`, **re-pointed** (its line now passes `f.queued` to `startHit`; same break, `f.chain < 2`): **caught** by "a
  whiffed cut breaks the combo count" and "a full five-cut chain fits inside one stagger".
- All 5 caught. Both lists dry-apply, every `old` found exactly once: `combat-simulator.json` 28,
  `combat-simulator-styles.json` 14. No other break needed re-pointing.

**Assumed choices (step 3):**
- `ATTACKS.quick` / `.heavy` are built by a loop over `RULES.kinds`, not two literal rows, so a new kind is one `RULES.kinds` entry.
- A queue left at the end of recovery goes back in the buffer as `'atk'` for a normal cut and as the kind's own action otherwise.
- The AI's kind roll is a helper, `aiStrike(F)`, one `F.krng()` draw per cut started or chained.
- The `counter` persona keeps 0.13 for a power attack (it dodges those; a power row has `parryWin` 0).
- Row 4 seeds are `s * 104729 + rank` with both fighters' hp set to 1e6 so every duel runs the full 60 s; row 5 seeds are
  `7000 + s`, and a trial ends at the first hit, parry, dodge or player whiff.

### Step 4 (2026-11-03)

**What changed** (`games/combat-simulator/index.html`, page code only; the `ENGINE` block, shaders, `render()`, `STYLES` and the styles break list untouched):
- `layout()` adds `quick` at 3.4 R / 22.5 deg and `heavy` at 3.4 R / 67.5 deg, `r: 0.6 * R`; the four existing buttons did not move.
- `KEYMAP` adds `KeyU: 'quick'`, `KeyO: 'heavy'`; `playerIntent()` passes `quick` and `heavy`; `update()`'s first-tick clear zeroes them too
  (the `INPUT.press = {}` clears already cover them). `drawHUD()` draws all six buttons.
- `icon()`: quick is a short straight blade with a hilt stroke and three speed lines; heavy is the katana under a thick double arc.
- `poseOf()`: the wind-up key is `mixKey(POSE.guard, C.wind, 0.55)` for quick and `mixKey(POSE.guard, C.wind, 1.25)` for heavy (pelvis `drop` 0.14),
  the normal cut's `C.wind` as before; sweep and follow-through unchanged. `POSE` is exposed on `__CS`.
- `SND.tell(kind)`: quick a 0.06 s noise burst sweeping 1500 to 800 Hz, heavy a 0.22 s burst sweeping 500 to 200 Hz at a slightly higher level,
  anything else the old 0.1 s, 900 to 400 Hz. `onEvents()` passes `ev.kind`.
- Help (HOW TO FIGHT): a Quick and heavy strikes paragraph before Dodge (less or more damage, shorter or longer wind-up and parry window, either one is any
  cut of the chain, the opponent throws them too) and `U quick strike, O heavy strike` on the Keyboard line. Plain ASCII, opt-in.

**Rows** (`.claude/tests/drive-combat-simulator.cjs`, part 2, 86 -> **89**):
1. a CDP touch on the quick button and on the heavy button each gives `F.p.st === 'atk'` and `F.p.kind` of the button (one row, both buttons).
2. `KeyU` and `KeyO`, one tick each, do the same (one row, both keys).
3. half way through the same cut's wind-up, the hand key's distance from `POSE.guard` is smallest for quick, then normal, then heavy, on all five chain indices.

**Restated** (none removed): the layout row now checks six buttons at the seven sizes and its label and detail name them
(`the six controls (atk, dodge, parry, power, quick, heavy) fit ...`, requiring six names); the paint scenario `duelUnder` presses `quick` at
`i % 90 === 30` and `heavy` at `i % 90 === 60` beside `atk` every 30, and still proves the fighters byte-identical under every style (15 cuts landed).

**Suite:** 86 -> **89** passed, 0 failed; `gates.sh games/combat-simulator/index.html` GREEN.

**Breaks** (`negtests/combat-simulator.json`, 28 -> 32; styles list untouched at 14; both dry-apply, every `old` found exactly once; no existing break was re-pointed):
- `quick-button-missing` (no `quick` in `LAY.btn`): **caught** by row 1 (and the suite crashed in `drawHUD`, a second catch).
- `keys-no-heavy` (no `KeyO`): **caught** by row 2.
- `heavy-overlaps-power` (heavy at 45 deg): **caught** by the layout row at 390x844 and 844x390, and by the power ring row (8 fails).
- `kind-pose-ignored` (`poseOf()` ignores the kind): **caught** by row 3.

**Assumed choices (step 4):** the tells' pitches and lengths above; the icon strokes (quick: 4.5 blade, 6 hilt, three 2.6 speed lines fading, the middle one longer;
heavy: 4.5 blade and two 4.5 arcs of radius 24 and 33 at 100% and 60% alpha, all in units of r/46); the help paragraph's wording; the layout row's label now
names the six buttons at each size; rows 1 and 2 each cover both buttons or keys in one row, to hit the plan's count of 3.

### Step 5 (2026-11-03, resumed 2026-11-04)

Docs, the whole break run and the badge. Not landed (the overseer lands it and verifies Pages). The run was paused once at 16 of 32 (the CD, before the usage limit) and resumed from a restarted container; the 16 already caught were not re-run (HEAD only moved by a plan-only commit, nothing they target changed).

**Break run** (`negtest-copies.py --jobs 2 --only <2 names>`, foreground chunks of 2, about 6.5 min each; `NODE_PATH=/opt/node-tools/node_modules`): **32 of 32 caught, 0 missed**, each `NEGCOPIES: GREEN caught=2/2`.
- Every one of the 32 breaks in `negtests/combat-simulator.json`, including the pre-step-1 nineteen (stagger-bonus, no-iframes, power-parryable, combo-energy-3-only, power-at-9, no-energy-cap, chain-of-three, stagger-can-act, stagger-short, no-hyper-armour, parry-no-energy, dodge-no-energy, ring-never-closes, ring-no-flash, menu-no-pause, buttons-crowded, ladder-no-advance, ai-slower-at-top, multitouch-one-role), the five CS-3 breaks, the four step 3 breaks and the four step 4 breaks. Failing rows per break ranged from 1 to 17 (`swing-resolves-twice` 17, `buttons-crowded` and `heavy-overlaps-power` 8).
- Dry-apply, every `old` found exactly once: `combat-simulator.json` 32, `combat-simulator-styles.json` 14 (not run; nothing it targets changed).

**Docs changed:**
- `.claude/combat-simulator.md`: CS-4 marked shipped and the CD's three answers marked built; 13 new Assumed rows (the `RULES.kinds` factors, the parry window per kind, `quickP` / `heavyP`, `F.krng`, the 0.10 s cap, the `counter` persona, the queued kind, keys U / O, 3.4 R at 22.5 / 67.5 deg, the pose blends 0.55 / 1.25 with drop 0.14, the tell pitches and lengths, the icons, the help wording); Architecture for `ATTACKS` (with the kinds loop), `STRIKE`, `f.kind`, `f.queued` as a kind string, `F.krng` with `aiStrike()`, the six buttons and `POSE` on `__CS`; the ladder line after step 3 and the opponent's measured kind shares; Tests (89 = 44 + 45, the eight new rows, 32 breaks); How to add "an attack kind" with the note that the six-button cluster has no room for a seventh at 360 x 640 without a new layout; the summary lines at the top.
- `.claude/tests/README.md` (the `drive-combat-simulator.cjs` row: 89 checks, 13 of the 89, the quick / heavy rows, 32 breaks), `games/CLAUDE.md` (the Combat Simulator paragraph: quick and heavy strikes and the parry rule, 89 checks, 32 + 14), `CLAUDE.md` (one clause in the Combat Simulator row), `.claude/plans/csstyles.selector-toon-neon.md` (Status: csparry landed, re-derive counts).
- `TODO.md`: the CS-3/CS-4 entry removed from Now. `DONE.md`: a CS-4 line.

**Badge stamped:** `build 2026-11-04 06:25 UTC` (read back from the file).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/csparry.parry-timing-strike-kinds.md
```
