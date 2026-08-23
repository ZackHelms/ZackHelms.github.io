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
  feature, not per session.
