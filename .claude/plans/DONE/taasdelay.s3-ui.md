# taasdelay step 3 - the UI and the page suite

**Status:** IMPLEMENTED 2026-10-16 (results in the arc)
**Arc:** `.claude/plans/taasdelay.delay-arc.md`. Needs step 2's engine API (`setWait`, `r.wait`,
the `pause` state, the eval keys); read the arc's Results for their final names.
**Scope:** the factory UI in `games/taas/index.html` and `.claude/tests/drive-taas-factory-ui.cjs`.

## Build

- **The robot's page** (`renderRobot()`, ~line 3925): a slot holding the delay shows its text and,
  under it, the wait: a slider (`input type=range`, 0-60, step 1), a - and a + button either side,
  and the value as "N s". Native control rules (`games/CLAUDE.md` § Native form controls): listen
  for `input`/`change`, never through a tap helper. Changing it calls `F.setWait`, saves, and must
  not re-render the page under the finger mid-drag (`pageSig` includes `r.wait`; check a drag is
  not interrupted by the 60 fps re-render). The picker lists the delay from the start.
- **The waiting robot**: a pause sign (two bars) over it with a ring that empties over the wait,
  and a calm face; nothing over a robot that slipped (it just goes on).
- **Evals lines**: `DOING` entries for the wait and the slip.
- **Info** (the menu's Info in this mode): one or two lines on the delay among the instructions.
- The slot row must still fit at 320 px wide (the slider shrinks, the buttons keep 44 px).

## Page suite rows

- The picker offers "Wait between tasks" with no mistake seen (fresh factory, slots open).
- Put in a slot, it shows a slider at 5 s; - , + and the slider change `r.wait` in the engine,
  stop at 0 and 60, and survive a reload.
- A drag on the slider is not interrupted by the page re-rendering (value follows the drag).
- A robot in `pause` draws the pause sign (pixels over the robot differ from the same robot
  idle; hold the engine and `Math.random` as section 11 does for the saw).
- The evals show the wait line once a robot has waited.
- The slot row's layout at 320 / 390 px: the slider, buttons and value inside the panel, no
  overlap (named violations, swept like section 5).

## Done when

The page suite is GREEN with the new rows (count in the arc's Results), the rules suite still
GREEN, smoke GREEN, a screenshot of the robot page with the delay slot looked at (portrait 390 and
320). Commit to `taas-delay`, push the branch, tick the arc.

## What was built (2026-10-16)

- **The slot row** (`renderRobot()`): a slot holding a rule with `wait: true` gets the class
  `fx-waits` (its `li` wraps) and a second line, `.fx-wait`: a `-` (`data-panel="wait:-1"`), the
  slider `#fx-wait` (`type=range`, 0-60, step 1), a `+` (`data-panel="wait:1"`) and an `<output>`
  "N s". The steppers go through the panel's click delegate (`F.setWait(s, id, r.wait +/- 1)`,
  then save) and are greyed at the ends. The slider is a native control: `input` calls
  `F.setWait` and updates the figure and the steppers in place (`showWait()`), `change` saves.
  At 360 px wide and under the row drops its 24 px indent (the slider is ~115 px at 320; ~85 px
  with the indent). The slider needed `width: 0` beside `flex: 1` and the row `min-width: 0`, or
  its 129 px intrinsic width pushed the figure off the panel at 320 (found on the screenshot).
- **Never redrawn under a finger:** `pageSig` includes `r.wait`, and `renderRobot()` returns
  while `holdWait` is set (`pointerdown`/`touchstart` on the slider; cleared by `pointerup`,
  `pointercancel`, `touchend`, `touchcancel` anywhere, by `change`, and by `closePanel()`).
  Without it the page's 60 fps redraw replaces the slider whenever the wait or the evals change,
  and the drag stops. A redraw also puts the keyboard's focus back on the element that had it
  (by id or `data-panel`), so Home / End / arrows on the slider keep working.
- **The waiting robot** (`drawRobot()`): `pauseSign(x, y, u)`, a white disc with two ink bars and
  a teal (`#16b3a5`, the slot's colour) ring that empties over the wait; drawn 27 px to the right
  while the last task's mood badge is up (it is up for 2.4 s, longer than a short wait). Its face
  is `calm` (eyes shut, a downward arc) once the badge is gone. A slip draws nothing (the robot
  is just idle).
- **Evals:** `DOING.waited` "Waited between tasks" (green) and `DOING.straight` "Went straight
  on", which the '!' makes "Went straight on, against its instructions" (yellow), listed last.
- **Info:** the Instructions item says the delay is on the list from the start, suits any robot,
  is set under its slot 0-60 s (5 to begin with) and comes after each log handled and each thing
  stocked or recycled; the Green item adds "a wait between tasks, as told".
- **Page suite** `drive-taas-factory-ui.cjs` section **17. delay**, 10 rows (89 -> **99**): the
  list offers only the delay before any mistake; the row's controls at 5 s; - and + in engine,
  slider and figure; the ends by keyboard (focus kept, steppers greyed, `setWait(-1)` refused); a
  drag by real CDP touches with the robot's evals changing under it (staged), never redrawn, the
  figure following, saved on release; a reload keeps it; the evals lines and dots from a real
  day with one slip; the pause sign and its ring off pixels (engine and `Math.random` held);
  the slot row at 320 and 390 as named violations; Info.
