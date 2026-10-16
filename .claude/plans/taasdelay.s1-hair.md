# taasdelay step 1 - people keep their hair when they face the camera

**Status:** DONE 2026-10-16 (see What was built; the fix differs from the plan's cap, and why)
**Arc:** `.claude/plans/taasdelay.delay-arc.md`.
**Requested:** 2026-10-16, the CD, with four phone screenshots: "customers appear to go bald when
they turn to face towards me (down). Also i think my player character does too but it is less
noticeable because of the hard hat i wear... still it does look odd when my character transitions
from facing any direction then faces down."
**Scope:** the 3D kit and the people in `games/taas/index.html` (`AV`, `custParts()`,
`drawPerson()`, `personSprite()`), `.claude/tests/drive-taas-factory-ui.cjs`.

## The cause (traced to code, 2026-10-16)

- `drawPerson()` pushes the head and the hair as two whole parts
  (`{ p: P.head, M: headM }, { p: P.hair, M: headM, bias: -0.004 }`), and `drawParts()` draws
  parts back to front by their centre's depth, `d = y * CE + z * SE + bias` (`CE` = cos 50 =
  0.643, `SE` = sin 50 = 0.766, `ELEV` ~line 2375).
- The hair (`AV.hair`, and each customer's in `custParts()`) is an ellipsoid nearly the head's
  size, centred **0.04 m behind and 0.03 m above** the head's centre.
- Facing the camera (down the screen), the hair's `d` minus the head's is
  -0.04 x 0.643 + 0.03 x 0.766 - 0.004 = **-0.0067**: the hair is drawn first and the whole skin
  ellipsoid over it, so only a rim shows round the crown (the CD's screenshots). Facing away it is
  +0.045 and sideways +0.019, so the hair covers the head as meant. It flips within about 42
  degrees of facing straight down, which is the "transition" the CD sees on the avatar.
- Drawing the hair last does not fix it: its front is 0.18 m from the centre against the head's
  0.22, so laid over the head facing down it would hide everything but the chin (projected on
  screen, the hair spans -0.262 to +0.162 m around the head's centre, the head -0.216 to +0.216).

## Fix

- Build the hair as **a cap**: the hair ellipsoid's faces whose centre lies outside the head's
  ellipsoid, the rest dropped. The open rim gets ink by itself (`edgesOf()` marks an open edge
  with -1 and `drawPrim()` inks an edge between a shown face and a missing one), which reads as a
  hairline. Check the facet count still looks like hair at the customers' 8 x 5 facets.
- **Sort it with the head**: give the cap the head's centre (`cx/cy/cz` = the head's) and a small
  positive bias, so it always draws just after the head and still before the hat and brim (the
  avatar) and the bun's ordering is unchanged. Re-check what a raised hand carrying something
  does in front of the face.
- Both the avatar and every customer; `personSprite()` bakes waiting customers through
  `drawPerson()`, so the bake picks it up (its cache is keyed by look and facing, cleared per
  `VW.gen`; a reload is enough).

## Checks

- Screenshots at 390 px of one customer and the avatar facing down, up, left and right (stub
  `Math.random`, hold the engine): hair on the crown in all four, the face showing facing down.
- Page suite row: a customer drawn alone on a plain backdrop facing down has hair-coloured pixels
  on its crown (the band above the head's centre), as many as facing up give or take, and skin
  in its lower half (the face). Same for the avatar's hair under the hat brim. Verify the row
  can fail: put the old hair back in a copy (`negtest-copies.py`) and see it go red.

## Done when

The page suite GREEN with the new row(s) (count in the arc's Results), the rules suite GREEN at
156, smoke GREEN, the screenshots looked at. Commit to `taas-delay`, push the branch, tick the
arc.

## What was built (2026-10-16)

- **Not the cap.** Built first as planned (keep the hair facets whose centre lies outside the head),
  it fixed the face-on view but left a **bald patch on the crown seen from behind**: traced, at the
  customers' 8 x 5 facets the two top-fan facets nearest the front have centres at
  (0.034, +-0.034, 0.205), a hair's width inside the head (z limit 0.205 there), so they were dropped,
  and they face the camera from behind. It also turned the old helmet of hair into short hair at the
  sides and back, a change the CD did not ask for.
- **Built instead: an explicit hairline.** `hairOver(p, zh)` keeps every hair facet except those whose
  centre is in front of the head's centre (x > 0) and below the hairline (z < 0.1 m), so the face
  shows through and the back and sides are the hair they always were. It returns the head's centre
  (0, 0, 0) as its sort centre, and `drawPerson()` pushes it with bias +0.001 (was -0.004), so it is
  always drawn just after the head and still before the hat (>= 0.075 ahead) and brim. The open edge
  is inked by `drawPrim()` and reads as the fringe. `hairCap(nu, nv, col)` builds it for `AV` (10 x 6)
  and every customer (8 x 5). The bun is untouched.
- **Test hook:** `bakePerson(id, P, face, o)` split out of `personSprite()` (same bake, now also
  returning the head's centre in its canvas), and `TAAS_FACTORY.person(who, face)`: one person alone,
  standing, arms down ('avatar' or a customer's id).
- **Measured** (390 px, dpr 2, S 59.7; hair / skin pixels by shading band in boxes round the head's
  centre): a customer facing down had 158 hair pixels on the crown against 472 facing away, and now
  728; skin on the crown 471 -> 0; face skin below 505 -> 324 (the fringe). Facing away unchanged
  (472 / 0 / 0). Over 40 degrees either side of facing down the old hair is bald throughout and the new
  holds (687-752). The avatar's hair either side of the head under the hat: 26-58 -> 92-163 (of 200
  facing away).
- **Looked at:** each person at four facings, the avatar in all seven poses (stand, press, clean,
  toss, pick, carve, carrying two) facing down, up and left, old vs new: no hand or held thing drawn
  wrongly against the hair; facing away identical. In the live scene, the customer at the counter
  (the CD's case) has hair, and so does the avatar under its hat.
- **Seen, not fixed (pre-existing, outside this ask):** `drawFace()` blinks off `clock`, and
  `personSprite()` caches the first bake per look and facing until the next layout, so a look baked
  mid-blink (about 1 bake in 18) keeps its eyes shut for as long as it waits. Traced in code; a
  one-line fix (no blink in a bake) if the CD wants it.
