# Two art styles over one sim — and how to cel-shade in Canvas 2D

From the 2026-08-23 Neon Clash session, which added a second, cel-shaded
`toon` skin alongside the original `neon` wireframe look (commit `4ea154f`,
default flipped to `toon` in `9c732c6`). It is the repo's first
player-selectable art direction — hence the new `art-styles` facet in
`.claude/games-index.md`. Game-specific detail lives in
`.claude/neon-clash.md` § Graphics styles; this note is the reusable part.

Cost, for planning a second one: ~700 lines added to a ~1,700-line game, about
half of it sprite geometry. The architecture below is maybe 40 of those lines.
The rest is drawing, and drawing is the part that needs eyes on a screenshot.

## The invariant: a skin is paint

Nothing in the simulation may know a skin exists. A skin decides only how an
entity is *painted*. That single rule is what makes a mid-match switch safe,
makes the feature untestable-by-accident impossible, and is the thing to assert
first:

```js
// same board, both skins, byte-identical
JSON.stringify(paint.neon) === JSON.stringify(paint.toon)
```

covering stats, costs, ranges, energy spent and an actual deploy's landing
coordinates. If a skin ever needs a number, that number belongs in the sim.

## Three mechanisms, in order of leverage

**1. `glow()` becomes a no-op — do not branch at the call sites.**
The single highest-leverage line. A neon codebase calls `glow(col, blur)` /
`noGlow()` in thirty-odd places. Rather than guard each:

```js
function glow(col, blur) { if (!TH().glow) return; ctx.shadowColor = col; ctx.shadowBlur = blur; }
```

Every bloom in the game dies at once, *and* an effect written later in the neon
idiom is automatically correct in both skins. Branching per call site would have
been thirty chances to leak a halo into a cel-shaded scene, forever.

**2. A theme table for chrome, dispatch functions for the world.**
Trays and cards differ only by palette → they read `THEME[skin]`
(`pageBg`, `tray`, `cardFill`, `cardTxt`, `costOn`…). The board, sprites and
base differ structurally → the draw function branches once at the top and calls
a whole alternate routine. Do not let chrome grow a second copy of its layout
code, and do not try to palette-swap a structural difference.

**3. Dispatch at the single shared entry point.**
`drawUnitShape(key, r, col, accent, t, flash, plain)` already served the board
unit, the card art and the drag ghost. Branching *there* meant cards and ghosts
got the new skin for free and can never drift from the thing they deploy. Find
that shared function before writing any sprite.

## The cel-shading recipe

Cel shading here means exactly two things and nothing else: **flat colour steps
(never a gradient) and one heavy ink outline per shape.** Made callable:

```js
function cel(path, fill, shade, lw, cx, cy) {
  ctx.beginPath(); path();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (shade) {                      // one hard-edged half-plane through (cx,cy)
    ctx.save(); ctx.clip();
    ctx.translate(cx || 0, cy || 0);
    ctx.rotate(-frameRot());
    ctx.fillStyle = shade; ctx.fillRect(-400, 0, 800, 800);
    ctx.restore();
  }
  if (lw) { ctx.beginPath(); path(); ctx.strokeStyle = INK; ctx.lineWidth = lw;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
```

- `(cx, cy)` is the *part's own* centre, so each part is lit about itself. Shade
  every part about the sprite origin instead and a raised shield either catches
  no light at all or is shaded entirely, depending which side of origin it sits.
- The shade colour is the same hue stepped down, **never** a black overlay —
  that is the difference between "painted" and "dimmed".
- Strokes have no interior to clip a shade into, so line-like parts (a bow limb,
  an arrow shaft, a bowstring) get their outline the cheap way instead: the same
  path stroked fatter in ink underneath, then again in colour on top
  (`inkStroke()`).

### `frameRot()` — read the rotation back off the live transform

The sun must be fixed in **screen** space. Sprites are drawn inside their own
rotated frames, so the shade wedge has to be counter-rotated out. Rather than
thread a rotation argument through every call site (`drawUnitShape` is called
from the board, the tray and the drag ghost, each with a different rotation):

```js
function frameRot() {
  if (!ctx.getTransform) return 0;
  const m = ctx.getTransform();
  return Math.atan2(m.b, m.a);      // uniform scale and dpr cancel out
}
```

A sprite that drags its own shadow round as it turns to face a target is the
single tell that reads as *flat shapes* rather than *lit shapes*. `getTransform`
is iOS Safari 15.4+; guard it and fall back to 0.

### `rr()` needs a `beginPath`-free twin

Any compound path — an even-odd fill, a ring, a shape with a hole — breaks if a
helper calls `beginPath()` internally. Split it:

```js
function rr(x, y, w, h, r) { ctx.beginPath(); rrSub(x, y, w, h, r); }
function rrSub(x, y, w, h, r) { /* arcTo chain, no beginPath */ }
```

Neon Clash's grass verge is the board rect with a ragged polygon punched out of
it via `ctx.fill('evenodd')`, which is impossible without the twin.

## Scenery: bake it once from a seed

Dirt patches, pebbles, the ragged grass boundary, grass blades, and every fence
plank with its tilt, its knot and whether it is missing — all generated **once**
at load from a fixed seed (`mulberry32`), never per frame. Re-rolling per frame
makes the arena boil (it reads as static noise, not ground), costs frame time,
and makes every property of the scene unassertable. Baked, "some planks are
missing" becomes a property of the place that a test can check.

Give the generator obligations the game actually needs — Neon Clash's fence
leaves a **gateway** where each base stands, because otherwise a fort grows out
through solid timber.

## Legibility findings (all four cost a screenshot round)

- **Team colour has to move.** Under a representational skin the silhouette says
  *what* a unit is and no longer *whose* — a knight is a knight in both colours,
  and Neon Clash's rogue is dark red on the green team too. Team identity moved
  to a thin ringed disc under the feet: the one mark that survives every facing,
  the white hit flash, and being read at arm's length. It is drawn
  counter-rotated so it lies on the ground rather than on the sprite.
- **Size that ring carefully, and kill it on cards.** The first pass was thick
  and fully saturated; four units in a scrum became one puddle of team colour
  with limbs. Cards suppress it entirely (`plain`) — a card already says whose
  it is via its border and its tray.
- **A rounded box with seam lines reads as a metal drum, not a fort.** The
  crenellations were what fixed it. Silhouette first; texture never rescues a
  wrong silhouette.
- **A projectile that scales toward the camera will cover its own landing
  zone.** Let the *rise* carry the "coming at you" read (lift 23 world units)
  and keep the growth modest (1.0×), not the other way round.

## Traps

- **The working directory persists between Bash calls.** An early `cd` into the
  game directory, then a later `cd` to the repo root, meant a patch script
  written as `p = 'index.html'` silently targeted the *repo root's*
  `index.html`. It failed its anchor assertion before writing, so nothing was
  damaged — because the script asserted every anchor before the single write at
  the end. **Write patch scripts with absolute paths, and assert every anchor
  matches exactly once before writing anything.** That discipline is what turned
  a wrong-file edit into a no-op.
- **`bindTap()`-style handlers swallow native form controls.** The repo's
  iOS-double-fire helper binds `touchend` with `preventDefault()`. Bound to a
  `<select>`, that stops the native picker ever opening. Wire a dropdown to its
  `change` event and leave `bindTap` off it.
- Screenshot review found three of the four legibility bugs above. None would
  have failed a test. Budget a round of `shot-page.cjs eval=…` per visual
  feature, not per session. (One class of them *can* now fail a test — see the
  fixed-sun assertion below.)

## Validated by a second adopter (star-surge, same day)

Star Surge added its own `toon` skin from scratch **without** this note (the
sessions were concurrent), then rebased onto it. Comparing the independent
implementation against the recipe is a useful signal about which parts are
obvious and which are not: the silhouette work, the flat-step-plus-ink
shading, the `<select>`/`bindTap` trap and "a skin is paint" were all arrived
at independently. **The two mechanisms that were missed are exactly the two
this note ranks highest**, and both were live defects:

1. **No `glow()` indirection** — the skin branched at each draw entry point
   instead, so chain lightning, EMP rings and the stage banner kept their
   bloom under the cel skin. Precisely the "thirty chances to leak a halo"
   failure, at ~15 call sites.
2. **No `frameRot()`** — the spinner enemy draws inside `ctx.rotate(e.ang)`,
   so its whole sprite dragged its shading round as it spun.

If you are reviewing a skin someone re-derived, check those two first.

### The fixed sun IS assertable — don't leave it to a screenshot

`frameRot()`'s effect looks like a subjective "reads as lit, not flat", but it
measures cleanly. Draw a rotating sprite at several rotation angles, walk a
ring of pixels inside its body, and record the **bearing of the brightest
sample**. With the counter-rotation the bearing does not move; without it, it
tracks the sprite:

```js
// spread across e.ang of [0, 0.8, 1.6, 2.4, 3.9]
// with frameRot():     [75, 75, 75, 75, 75]  -> 0 deg
// with frameRot()->0:  [75,125,170,  0,  0]  -> ~170 deg
check('sun stays fixed in screen space while a sprite spins',
      Math.max(...bearings) - Math.min(...bearings) <= 10);
```

Sample a ring *inside a solid part* (star-surge uses the spinner's central
dome at r*0.45), not at the sprite's bounding radius — a diagonal sample
between two blades reads background and the measurement goes to zero for
every angle, which looks like a pass. Reference:
`.claude/tests/drive-star-surge.cjs`.

### Derive the part centre rather than passing it

The `cel(..., cx, cy)` signature above wants each part lit about its own
centre. Rather than hand-thread a centre through every call site (which is a
chance to forget, and forgetting is silent), have the polygon helper compute
the centroid of its own points:

```js
function celPoly(pts, base, lit, lw) {
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
  const n = pts.length / 2;
  poly(pts); cel(base, lit, lw, cx / n, cy / n);
}
```

Circle/ellipse helpers translate to their centre first, so theirs is free.
Star Surge's first pass shaded every part about the sprite origin and each
wing came out uniformly lit or uniformly dark — the exact failure this note
predicts, visible in a screenshot the moment the two are compared.

## A third adopter (turret-builder, same day) — and what it says about the ranking

Turret Builder added its own `toon` skin from scratch the same day, also
without this note (three concurrent sessions). Its independent re-derivation
narrows the earlier reading:

- **Mechanism 1 (`glow()` indirection) did not apply.** Turret Builder's neon
  look never used canvas bloom at all — zero `shadowBlur` in the file; its
  "neon" is bright strokes and alpha over a dark board. So the lesson is
  sharper than "always add a `glow()` indirection": *if the neon style leans on
  `ctx.shadowBlur`, funnel it through one helper before adding a second skin.*
  If it doesn't, there is nothing to funnel.
- **Mechanism 2 (`frameRot()`) was missed again, and again it was a live
  defect.** `celShape()` painted its rim-light wedge in the current transform,
  and a turret's hull and barrel are drawn inside `ctx.rotate(aim)` because a
  turret turns to face what it is shooting. Measured bearing of the brightest
  sample across five aim angles: `[0, 0, 0, 5, 90]` — 90 deg of drift. With the
  counter-rotation: `[140, 140, 140, 140, 140]`, spread 0.

**Two for two.** Every re-derivation so far has produced the fixed-sun bug, and
neither author noticed it by eye — both times it took the measurement. Treat
`frameRot()` as the single thing to check first on any cel skin in this repo,
and add the assertion at the same time as the skin, not after someone reads
this note.

Two implementation details specific to a wedge (rather than star-surge's
half-plane fill):

- The snug triangle `(-s,-s) (s,-s) (-s,s)` that covers a shape at rotation 0
  does **not** cover it once counter-rotated. Scale the same triangle up
  (turret-builder uses `s * 6`) so the hypotenuse is the same line and the
  visual is unchanged at rotation 0, but the fill still reaches the clip at
  any angle.
- `ctx.rotate(-frameRot())` turns about the *current local origin*, which is
  fine where every part's path is drawn about that origin (turret-builder's
  pad, hull and barrel all are). Where parts are offset, derive the centroid —
  see "Derive the part centre rather than passing it" above.

## Scaling past two styles (turret-builder, four cel skins, 2026-08-23)

The CD then asked for three more skins — MECH, STEAMPUNK, STONE AGE — on top
of TOON, all sharing the cel recipe. Going from a boolean to a family is where
the shape of the thing has to change, and three decisions carried it.

**1. `cel()` is the family test, not `toon()`.** The old predicate was
`GFX === 'toon'`; it becomes `GFX !== 'neon'`, and every cel style then goes
down the same path and reads its skin from there. Renaming it was worth the
mechanical churn: `if (toon())` guarding STONE AGE's caveman would have been
a lie in the source that a later reader would eventually act on.

**2. The skin is a TABLE, and the wrapper keeps the parts a skin must not
touch.** `SKINS[id] = {pal, turret?, creep?, module?, booster?, wall?, shot?}`,
with one base palette (`PAL_TOON`) that the others override key-by-key so a
new palette key reaches every style at once, and a live `SK`/palette pair
**reassigned on switch** rather than looked up per call — `celShape()` alone
runs a few hundred times a frame. Each part's public entry point stayed put
and became a wrapper: it lays the contact shadow, translates to the tile
centre, calls `SK.part || partBodyToon`, and then draws anything that is a
**rules readout** — the wall HP bar, the elite ring. A skin that could restyle
those would be a skin changing what the board *says*, which is a different
thing from changing how it looks.

**3. Two things are never a skin's to change.** The **type colour** (a module
is drawn in `M.col`, a creep in `c.def.col`, in every style) because that
colour is how the board answers "what is that"; and the **type silhouette** —
creeps keep the shared `creepPath()` and skins hang furniture *around* it.
The furniture rotates to the creep's heading, the identity polygon does not.
That is what lets STONE AGE draw a horned beast and still let you pick the
HULK out of a wave at a glance.

The one place paint reaches into the sim is deliberately one-way and
one-field: `dominantModCol(t)` rides along on the shot as `mcol` so STONE AGE
can paint the hurled rock in the colour of the cauldron it was dipped in.
Combat never reads it.

### Testing four skins found two ways the obvious test lies

- **A distinctness test needs a DISTANCE, not an inequality.** "All four skins
  fingerprint differently" passed with one skin's `turret:` override
  deliberately deleted — the palette still went through, so the same shape in
  a different colour hashed differently. Fingerprinting the **silhouette**
  instead, it then passed on a *single* antialiased sample. What works is a
  minimum pairwise Hamming distance: the closest honest pair was 7.9%, a
  fallen-through skin 0.1%, bar set at 3%.
- **The fixed-sun sprite measurement only bites where the skin swings a large
  lit body.** TOON and MECH rotate whole hulls; STEAMPUNK swings a thin cannon
  past a fixed boiler and STONE AGE a thin arm past a fixed man, so a ring
  through *their* cores samples geometry that never rotates and passes
  whatever `frameRot()` returns — measured, not assumed: with `frameRot()`
  stubbed to 0 those two skins' spreads stayed at 0. The fix is to test the
  **mechanism** rather than the sprite: a hook that paints one **disc**
  through `celShape()` inside a rotated frame. A disc is rotation-invariant,
  so its bright bearing can only move if the light moves — spread 0 with the
  counter-rotation, ~200 deg without. Keep the sprite check too (it proves the
  real turret routes through the helper); add the probe so the other skins are
  not silently unasserted.
- **Any pixel measurement of the BOARD has to clear the chrome first.** Three
  new checks — grass, paving joints, arrows — all failed on their first run,
  and none of them failed for the reason they were testing: they were reading
  a `LEVEL 1 · SUBSTATION` toast painted over the board. A `clearToasts()`
  hook is the cheapest fix and it belongs next to `forceDraw()`.
