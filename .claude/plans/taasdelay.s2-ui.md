# taasdelay step 2 - the UI and the page suite

**Status:** open
**Arc:** `.claude/plans/taasdelay.delay-arc.md`. Needs step 1's engine API (`setWait`, `r.wait`,
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
