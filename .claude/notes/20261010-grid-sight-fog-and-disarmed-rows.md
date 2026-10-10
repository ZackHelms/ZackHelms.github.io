# Grid sight, live fog, and the old rows a new refusal disarms

From CYOA2 step 2 (2026-10-10): line of sight and fog of war on a board whose walls sit
on the EDGES between squares, a party, and rounds. Full detail is in `.claude/cyoa2.md`;
this note keeps what generalises.

## A feature that adds a refusal disarms older rows. Re-run the old breaks.
Fog made a tap on unseen ground walk nobody. Every older row whose proof was "and nobody
walked" could now pass for that reason instead of its own: "the last finger of a pinch
is not a tap" went GREEN with its fix deliberately removed, because the stray tap landed
in the dark. A layout change did the same to a geometry row: a new bar made the board
56 px shorter, the furthest tappable square came closer to the middle, and a tap at that
square's MIDDLE forgave a 7% error in the tap mapping.

Neither showed in the suite, which was green throughout. Both showed the moment the
PREVIOUS feature's negative tests were run again. So: when a change adds a way to refuse,
or moves the geometry a row depends on, re-run the old break list, not only the new one.
Keep the lists; they cost nothing to keep and an hour to rebuild.

Two cures worth reusing:
- **Aim near the edge, not at the middle.** A tap at a square's centre tolerates half a
  square of error. A tap a tenth of a square inside the far corner (and, on another
  turn, the near corner) tolerates a tenth, in both directions.
- **Lift the new rule where the row is about something else**, through the game's own
  setting, and say why in a comment.

## Judge a geometric algorithm with a second, dumber one
The sight code is a ray march over typed arrays with an exact-corner special case: fast,
and the kind of code where an index slip is invisible. The suite judges it with a line
walked in fiftieths of a square that shares no code with it, asking two questions:
*sound* (every square shown has SOME clear line to it) and *complete* (every square
plainly in view, five lines clear, is shown). It found a real artifact at once: a line
through an exact corner was let on if EITHER way round the corner was clear, so sight
slipped along the diagonal crack where two roofs touch corner to corner. The rule is now
BOTH, and the lines either side of the exact one reach whatever is truly visible.

The judge then flagged 35 more squares that were its own fault: its sample points were
too coarse near a square's edge, so a square visible only by a thin sliver had no sample
in the sliver. **Before believing an oracle, look at what it flags.** Samples at 0.02
and 0.98 fixed it.

## Fog belongs over the bitmap, not in it
The still map is baked into a bitmap. Baking fog into it would mean a repaint on every
step. Painted live instead (one path of blank strips over the unseen, one half wash over
the remembered, then the boundary walls inked again on top) it cost nothing measurable.
The thing to remember is the last part: a cover laid over a square hides half of every
line drawn on that square's edge, so the edges of what is KNOWN have to be redrawn over
the cover or every room loses half the thickness of its outer wall.

## Stretching a big bitmap: 'high' smoothing is five frames in six
`drawImage` of a 4 MP canvas, upscaled, with `imageSmoothingQuality = 'high'`, held a
walking party at 83 ms a frame at dpr 3 in headless Chromium; `'low'` held 16.7. Use the
cheap stretch while the camera moves and the fine picture (here a sharp repaint of just
the visible part) when it rests. Measured as rAF deltas on a presenting page, per
`.claude/scripts/frame-budget.cjs`; headless is software-rendered, so treat the absolute
numbers as a proxy and the ratio as the finding.

## An ease toward a target must end when it stops moving, not only when it arrives
The camera eased toward the acting piece and ended "when close enough". A camera clamped
to the board can be held short of its target for ever, so it never ended: it redrew every
frame, kept refreshing the "last moved" time, and the sharp repaint that waits for rest
never came. End an ease when the thing being eased did not move this frame.

## A row that waits for its sharp case is not a row
Two rows passed over a deliberate break because the case they exist for had not
happened to occur: a bandit who could see nothing the party had not, a bench that was
never seen in part. Both now make the case (set the bandit down on unseen ground; search
every square of an inn for a part-seen bench and fail if there is none, 35 found).
Print the count in the row's message, so a reader can see it was not zero.

## Enter on a focused button
A suite that taps a button and then presses Enter is testing the browser: the tap left
the button focused, and Enter presses a focused button whatever the page's key handler
does. Blur first, or the row cannot fail.
