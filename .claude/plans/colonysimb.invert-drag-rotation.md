# colonysimb — invert Colony Sim's horizontal drag rotation

**Status:** DRAFT
**Requested:** 2026-11-26.
**Scope:** `games/colony-sim/src/render.js`, `games/colony-sim/src/main.js`, the generated
`games/colony-sim/index.html`, `.claude/tests/drive-colony-sim.cjs`, `.claude/colony-sim.md`.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) — the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

Dragging left or right on Colony Sim's view turns the camera the opposite way to today, with
the mouse and with one finger. Vertical tilt, panning, zoom and the Q / E keys behave exactly as
they do now. The drive suite proves the new direction for the mouse and touch, proves that Q / E
did not change, and each new row is shown to fail when its behaviour is broken on purpose.

## Context

The CD's first feedback on the phase 1 draft (TODO.md § Colony Sim, "Invert horizontal camera
rotation"): "Invert horizontal (left/right) rotation from what it currently is". Every drag
rotation goes through one function: `orbit(dx, dy)` in `games/colony-sim/src/render.js:465`,
`cam.yaw -= dx * 0.006`. It has three callers:

- the left-button mouse drag, `games/colony-sim/src/main.js:67` (in the `mousemove` handler,
  lines 64-68; `mousedown` is line 63, on the canvas);
- the one-finger touch drag, `main.js:88` (in the `touchmove` handler, lines 86-91);
- the Q / E keys, `main.js:118`: `if (keys.has('KeyQ')) G.R.orbit(-200 * dt, 0); if (keys.has('KeyE')) G.R.orbit(200 * dt, 0);`.

Flipping the sign inside `orbit()` flips all three. The CD named drag rotation only, so the
backlog entry already records the call that **Q / E keep their direction** (Q still turns the view
left). The keys' arguments are therefore swapped in the same change, so their net effect is
unchanged.

The camera is render-side only. `orbit` never reaches `sim.inputs`, so determinism, saves and
`tools/test-sim.mjs` are untouched.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans "Task-scoping skill: none"). One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Flip the sign in `orbit()`, swap the Q / E arguments, rebuild `index.html`, add the call to `.claude/colony-sim.md` | mechanical-edit | haiku | medium | two verbatim one-line edits, one build command and one verbatim doc bullet, all given below; passes the haiku-viability bar |
| 2 | Three drive-suite rows (mouse drag, one-finger drag, Q / E unchanged), the header comment, two negative tests through `negtest.sh`, the gate | tests | sonnet | high | fails haiku-viability on judgment: synthetic touch events in Chromium, focus and hit-target traps, running Playwright under the Windows exports, and reading a negative test's rows one by one |

- **Ordering / dependencies:** 1 → 2. Nothing is parallel-safe; both touch `index.html` (task 2
  restores it after its breaks).
- **Files owned per task:** task 1: `games/colony-sim/src/render.js`,
  `games/colony-sim/src/main.js`, `games/colony-sim/index.html`, `.claude/colony-sim.md`;
  task 2: `.claude/tests/drive-colony-sim.cjs` (and, during its negative tests only, temporary
  breaks of the two `src` files and `index.html`, all restored by `negtest.sh`).
- **Validation per task:** task 1: `node games/colony-sim/build.mjs` prints `wrote index.html`,
  and `node games/colony-sim/tools/test-sim.mjs` ends `SIM-TESTS: GREEN`. Task 2: the suite ends
  `DRIVE: GREEN`, each negative test turns exactly the rows named below red, and
  `negtest.sh scan` is clean. The final gate is
  `bash .claude/scripts/gates.sh games/colony-sim/index.html` → `GATES: GREEN`, plus
  `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- **Tier audit (required):** task 1 is haiku: every edit is given verbatim and nothing needs
  judgment. Task 2 is above haiku because it fails the checklist on judgment: picking a drag
  point that really hits the canvas, a focus trap that silently disables the keys, and whether
  `new Touch()` is available in this Chromium, with CDP as the fallback.
- **Decision defaults:**
  - **Q / E keep today's direction.** That is the recorded call, so don't ask. If the CD later
    wants them flipped, that is a one-line follow-up.
  - **Touch inverts with the mouse.** One-finger drag goes through the same `orbit()`, and the
    CD asked for horizontal rotation without naming an input. Don't special-case touch.
  - **Leave `pan()` alone** (`render.js:466-470`). It reads `cam.yaw` to drag the ground under
    the cursor, and that is independent of the direction the orbit turns.
  - **Don't change the ⓘ panel's camera text** (`src/ui.js:158`, "Drag to orbit ... Q / E to
    turn"). It names no direction.
  - **Synthetic touch:** prefer `new Touch({...})` plus `new TouchEvent(...)` dispatched on the
    canvas. If `typeof Touch !== 'function'` in this Chromium, drive one finger through CDP
    instead (`page.context().newCDPSession(page)`, then `Input.dispatchTouchEvent` with
    `touchStart` / `touchMove` / `touchEnd`). Never skip the row.
  - **Number of new rows:** three (mouse, one finger, Q / E in one row).
- **Embedded-content QA (required):** done for this draft.
  - The two verbatim edits were checked against the current lines (`render.js:465`,
    `main.js:118`).
  - Sign arithmetic: today Q passes `-200*dt`, and `yaw -= (-200*dt)*0.006` gives
    `yaw += 1.2*dt`. After the flip, Q must pass `+200*dt`, giving `yaw += 1.2*dt`, the same
    as today.
  - A 120 px rightward drag after the flip gives `yaw += 120*0.006 = +0.72` rad (today -0.72).
  - Suite count: the baseline is 18 `check(...)` rows that run (re-derived from the file: one
    test-sim row, then 17 page rows, lines 45-166). This plan adds exactly 3, so 21. State the
    invariant "the suite grows by exactly 3" and confirm the baseline by running the suite
    before task 2.
- **Escalation triggers:** none expected. Stop only if the drive suite is red on the unmodified
  baseline (that is a pre-existing break, not this plan's), or if neither synthetic touch path
  works in this Chromium.
- **Playtest:** yes, briefly. On the PC: left-drag left and right and confirm the turn is the
  reverse of before; Q / E turn as before; right-drag or shift-drag still pans the same way; the
  wheel still zooms. On a phone: one-finger drag turns the same way as the mouse.
- **Publish:** default. This is a player-facing change, so the overseer publishes in its wrap-up
  (a push to `main` is the deploy) and verifies the Pages run per `.claude/zmh/producer.md`
  § Publish. The report quotes the badge read back from `games/colony-sim/index.html`.
- **Commit strategy:** one conventional commit per step, scope `colony-sim`, on branch
  `colony-sim-invert-orbit`. Land the branch as one commit with
  `.claude/scripts/land-on-main.sh` (dry run first), per § Integration.

## Steps

1. **Invert the drag; keep Q / E (task 1).**
   - `games/colony-sim/src/render.js:465`: change
     `orbit(dx, dy) { cam.yaw -= dx * 0.006; ...` to
     `orbit(dx, dy) { cam.yaw += dx * 0.006; ...`. Leave the pitch half of the line as it is.
   - `games/colony-sim/src/main.js:118`: replace the line with
     `  if (keys.has('KeyQ')) G.R.orbit(200 * dt, 0); if (keys.has('KeyE')) G.R.orbit(-200 * dt, 0); // Q / E keep their direction after the drag was inverted (CD, 2026-11-26)`.
   - `.claude/colony-sim.md` § Calls made while building (line 507): append the bullet
     `- Horizontal drag rotation was inverted at the CD's request (2026-11-26, mouse and one
     finger); Q / E keep the direction they had (the CD named the drag only).`
   - Run `node games/colony-sim/build.mjs`, then `node games/colony-sim/tools/test-sim.mjs`
     (must end `SIM-TESTS: GREEN`).
   - Commit `src/render.js`, `src/main.js`, `index.html` and `.claude/colony-sim.md` by explicit
     path: `fix(colony-sim): invert horizontal drag rotation, keep Q / E`.
   - Done when the build and the sim tests are green and `git diff` shows only those four files.

2. **Prove it in the drive suite (task 2).**
   - First run the unmodified suite (before your edits, after step 1's commit) and record the
     baseline line. It should read `DRIVE: GREEN (18 passed)`: no existing row tests rotation,
     so anything else is a pre-existing break to report (an escalation trigger above).
   - In `.claude/tests/drive-colony-sim.cjs`, after the follow rows (the
     `colony-follow.png` screenshot line, 72), add one block. It:
     - blurs the focused element (`document.activeElement.blur()`): the follow rows leave focus
       on `#follow-sel`, and `main.js:96` ignores every key while a SELECT has focus;
     - sets `window.__CS.G.following = false` and `G.speedIdx = 0` (paused, so nothing else
       moves the view);
     - picks a point on `#view` at 30% of its width and 55% of its height, and **asserts**
       `document.elementFromPoint(x, y).id === 'view'` (a failure names the element; it never
       skips: the settler panel and the bubbles sit over the canvas).
   - **Row 1, mouse:** read `G.R.cam.yaw`; `page.mouse.move(x, y)`, `down()`,
     `move(x + 120, y, { steps: 6 })`, `up()`; `frames(2)`; read yaw again. Require a delta
     between 0.6 and 0.85: `'a rightward mouse drag turns the camera the new way (yaw +0.72)'`.
     The drag moves more than 5 px, so it is not a click (`main.js:71`).
   - **Row 2, one finger:** dispatch on the canvas a `touchstart` at (x, y), six `touchmove`s
     stepping +20 px in x, and a `touchend` with an empty `touches`. Use the decision default
     for how. Require a delta between 0.6 and 0.85:
     `'a rightward one-finger drag turns the same way as the mouse'`. The drag moves more than
     8 px, so it is not a tap (`main.js:92`).
   - **Row 3, keys:** `page.keyboard.down('q')`, `frames(20)`, `up('q')`, then read the
     delta; then the same for `'e'`. Require the Q delta > 0 and the E delta < 0:
     `'Q / E still turn the way they did (Q yaw up, E yaw down)'`.
   - Add a line to the header comment (lines 7-13) naming the three rows.
   - Run the suite: `DRIVE: GREEN (21 passed)` (baseline + 3).
   - **Negative tests**, each through `.claude/scripts/negtest.sh`. Save, then break with a
     `/* @negtest */` comment on the broken line, rebuild, run the suite, restore, and confirm
     `RESTORED`:
     - **N1, the old orbit sign:** save `games/colony-sim/src/render.js` and
       `games/colony-sim/index.html`; set `cam.yaw -= dx * 0.006`; rebuild. Expected red rows
       1, 2 and 3 (Q / E now turn backwards); every other row green. Restore both files.
     - **N2, the keys left unswapped:** save `games/colony-sim/src/main.js` and
       `games/colony-sim/index.html`; put back
       `G.R.orbit(-200 * dt, 0)` for Q and `G.R.orbit(200 * dt, 0)` for E; rebuild. Expected red
       row 3 only. Restore both files.
   - After the restores, `bash .claude/scripts/negtest.sh scan` must be clean, and
     `git status --short games/colony-sim` must show nothing (restore puts back the step-1
     `index.html`, badge included).
   - Commit the suite by explicit path:
     `test(colony-sim): drag and key rotation rows, negative-tested`.

## Gotchas / bindings

- **`index.html` is generated.** Never edit it by hand: edit `src/`, then
  `node games/colony-sim/build.mjs`. The build restamps the badge (`build.mjs:53-56`). Read the
  badge back from the file for the report:
  `grep -o 'id="build-badge"[^>]*>[^<]*' games/colony-sim/index.html | sed 's/.*>//'`.
- **The CD's Windows box:** gates and Playwright need the three exports in the same Bash call
  (`.claude/zmh/producer.md` § Environment):
  - `PYTHONUTF8=1`;
  - `NODE_PATH=/c/Users/zmhel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules`;
  - `SMOKE_CHROMIUM=C:/Users/zmhel/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe`.

  Re-find the paths if these have moved:
  `ls ~/AppData/Local/npm-cache/_npx/*/node_modules/playwright-core` and
  `ls -d ~/AppData/Local/ms-playwright/chromium-*`. The suite already launches with
  `--use-angle=swiftshader --enable-unsafe-swiftshader` (`drive-colony-sim.cjs:34`).
- **Line endings:** edit with the Edit tool or an LF-preserving write. Never open files in
  Python text mode on Windows (`newline=''` if you must). Run `bash .claude/scripts/eol-guard.sh`
  before landing; it must say `EOL: GREEN`.
- **Q / E must not change.** Swap the literal signs at `main.js:118`. Leaving them is exactly
  break N2, and row 3 exists to catch it.
- **Focus trap:** keydown is ignored while an INPUT, SELECT or TEXTAREA has focus
  (`main.js:96`). Without the blur, row 3 fails for a reason unrelated to the code.
- **Hit target:** `.side` panels and speech bubbles sit over the canvas. A drag that starts on
  them never reaches the canvas's `mousedown` (`main.js:63`). Assert the target; never skip
  (games/CLAUDE.md "A check that can skip").
- **Wait in frames, not milliseconds:** use the suite's `frames(n)` helper (line 41), never
  `waitForTimeout` (games/CLAUDE.md, "A check that can skip", the rendering-pass shapes).
- **Run `gates.sh` alone:** no other Chromium suite or scratch copy at the same time (timing
  rows go red when two share the box, § Environment).
- **Commit hygiene:** explicit pathspecs, never `git add -A`. The primary checkout has an
  uncommitted `.claude/settings.json` (the CD's plugin installs) and an untracked
  `.claude/worktrees/`. Neither belongs to this plan, so never stage them.
- **Branch before the first commit** (§ Integration: commits on local `main` before branching
  are left behind by the landing). After landing, check
  `git log --oneline origin/main..main` in the primary checkout.
- **Windows worktree folder:** if `git worktree remove` leaves the folder ("Permission
  denied"), delete it once any background job started inside it has ended.
- **Render-side only:** do not touch `sim.js`, `brain.js` or the save format. `test-sim.mjs`
  must stay at its current count.

## Validation

- `node games/colony-sim/tools/test-sim.mjs` → `SIM-TESTS: GREEN`.
- `bash .claude/scripts/gates.sh games/colony-sim/index.html` with the three exports →
  `GATES: GREEN`. It smokes the page at iPhone 13, runs `drive-colony-sim.cjs`
  (`DRIVE: GREEN (21 passed)`), `GAMES-SYNC: GREEN` and the negtest scan.
- `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- Negative tests N1 and N2 turned exactly the expected rows red; record both result lines in
  the report.
- Badge read back from the file; Pages run for the landed SHA concludes `success`.
- Manual playtest: see Playtest above.

## Follow-ups

- If the CD wants Q / E inverted too: swap `main.js:118` back and flip row 3's expectation.
- The real sky (TODO.md § Colony Sim, "A real sky from zmh-sky") is blocked on zmhstudio's
  drop-in sky and is not part of this plan.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/colonysimb.invert-drag-rotation.md
```
