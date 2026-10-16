# taasdelay - TAAS robot factory: a delay between a robot's tasks (plan arc)

**Status:** IN PROGRESS (steps 1-5 open)
**Requested:** 2026-10-16, the CD's answer to the storefront's open question 2 (overproduction):
"Add an instruction that lets me add a delay between iterations of its task. Let the delay be a
configurable value, a positive integer 0,1,2,...,60 seconds."
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
- **UI** (step 2): the filled slot shows the wait with a slider (0-60, step 1) and - / + buttons;
  a waiting robot shows a pause sign with a ring that empties.

## How to use this arc

One step per session turn, then `/compact`. Each step has its own plan file with everything
needed to resume from disk alone. To run the next step after a compact:

> Run the next open step of `.claude/plans/taasdelay.delay-arc.md`.

At the end of each step: tick it below, write what it found under **Results** (numbers the
later steps need), commit to the branch `taas-delay` and push the branch (never `main` before
step 5).

## Arc

| # | Step | Plan file | Status |
|---|---|---|---|
| 0 | The CD's three answers recorded, the demand item in `TODO.md`, this arc | (this session) | DONE - on `main` |
| 1 | Engine: the delay instruction, `r.wait`, the `pause` state, evals, save/load; rules suite rows | `taasdelay.s1-engine.md` | open |
| 2 | UI: the slot's slider and steppers, the waiting robot's sign, Info text; page suite rows | `taasdelay.s2-ui.md` | open |
| 3 | Eval (does a delay end overproduction?) and both break lists | `taasdelay.s3-eval-negtests.md` | open |
| 4 | Docs final and gates | `taasdelay.s4-docs-gates.md` | open |
| 5 | Ship: badge, one clean commit, fast-forward `main`, push, Pages deploy, report to the CD | `taasdelay.s5-ship.md` | open |

## Results (shared memory between steps; append, do not rewrite)

- **Baseline (2026-10-16, `main` after the storefront):** rules `drive-taas-factory.cjs` 156
  checks; page `drive-taas-factory-ui.cjs` 86; eval `eval-taas-factory.cjs` 19 (8 personas);
  engine break list 100 of 101 caught; page break list 49 of 50. Formal 43 / 39 / 9.
