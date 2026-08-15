# Tree Simulator (`experiments/lone-tree/index.html`, ~2000 lines)

Six-species procedural tree diorama with a saw tool. Read
`.claude/experiments.md` first for shared conventions.

## The one structural fact that matters

The tree is **data first, mesh second**: `growBranch()` writes a *skeleton
registry* — `branches[] = {id, parentId, attachSeg, depth, phase, segs[]}`
with per-segment `{p,q,r0,r1,f0,f1,v0,v1,sides}`, and `leaves[]` records
carrying `{bid, seg}` (which branch + segment each leaf's stem is anchored
on). Meshes are *emitted* from the records (`emitAttached()`, and per-piece
emission in `severBranch()`). Everything the saw does — picking, truncation,
partitioning a fallen subtree, stump caps — depends on this registry. Never
add geometry that bypasses it, or the saw won't know the geometry exists.

- A cut is `cuts.set(bid, {seg, t})` (branch truncated) + `detached` set
  (subtree ids that fell). A child's `attachSeg` decides which side of a cut
  it lands on. Pieces are emitted in local coords (origin = cut point) so a
  single model matrix animates them.
- Leaf ownership across a cut: leaves on the cut segment ride the piece
  (`leafAttachedNow`: attached iff `seg < cut.seg`). Piece leaves are computed
  as `wasAttached && !attachedNow` snapshots around the cut — don't try to
  enumerate them structurally.

## Species presets ↔ zmhstudio knowledge base

`SPECIES` presets (oak/birch/willow/cypress/maple/pine) mirror the
generator-parameter tables in **zmhstudio `templates/design/trees/species/`**
(maintained by zmhstudio's `tree-expert` agent). When a preset value changes
for look reasons, the KB table should be updated in a zmhstudio session —
and new species get a KB article *before* a preset here. Habit flags beyond
the numbers: `lowLimb` (oak/maple), `alongTrunk`+`upperOnly` (cypress column,
pine's bare trunk), `weepDepth/weepLen/weepSegs/weepPull` (willow curtains).

## Texture recipes (all height-field → Sobel → normal map)

- `makeLeafRecipe(shape,...)`: parametric blades (oval/pointed/lobed/
  lanceolate/palmate via `widthProfile`/`palmateR`) painted per-pixel;
  stroke-drawn cards for `scale` (cypress spray) and `needle` (pine tuft)
  with height taken from drawn alpha. **Stem must be painted at canvas TOP**:
  leaf cards anchor their `v=0` edge on the twig and canvas row 0 is texture
  v=0 (no UNPACK_FLIP). Painting stem-at-bottom shipped all asymmetric
  leaves 180° backwards (fans converging outward) — near-symmetric ovals
  masked it for two releases.
- Palmate uses a per-lobe cross coordinate (`xn` = signed offset across the
  nearest lobe) so the shared dome/vein/band shading works per finger; deep
  sinuses (`palmateR` min 0.15) are what make it read as five fingers.
- `makeBarkRecipe(style,...)`: `ridged` (freq param), `birch`
  (white + lenticel dashes + blotches), `plates` (pine cellular flakes),
  `smooth`. Branch tubes carry girth-scaled UV repeats (`round(r0*22)`) and a
  ring tangent for TBN; adjacent tubes may mismatch by one repeat (accepted,
  in the ⓘ limitations).
- `makeRingsRecipe(wood, bark)`: end-grain caps — warped concentric rings in
  the species `wood` palette, bark rim, radial drying checks, saw-scratch
  noise. Caps are emitted with **bark-shader-compatible attributes** (uv =
  disc coords, tangent = disc u basis, wind attrs) so `progBranch` renders
  them by just rebinding the ring textures — no cap shader exists.

## Saw tool pipeline

pick → scrub → sever → rigid body:
- `pickBranch()` = ray/segment closest point over all attached segments;
  formula `u = (b·d0 − e0)/(c − b²)` with `w0 = p − eye` — **verified against
  brute force numerically** (first attempt had a sign error; when touching
  this math, rerun the node brute-force check from the 2026-08-15 session).
- Cut cost `dpix / (1000 + 170000·r²)` — trunk ≈ 6× a twig. Kerf = thin dark
  cylinder via `progSolid`, height grows with progress.
- `severBranch()` returns a piece with `pos/R/v/w`, contact points (segment
  joints in local coords), and hinge-initialized angular velocity. Physics:
  scaled gravity 3.8 u/s², deepest-contact ground resolve, restitution 0.28,
  tumble impulses per hit, `resting` freeze at low energy. Toy-level on
  purpose (ⓘ says so): no piece-vs-piece or piece-vs-stump collision.
- Sawdust particles land into `piles` (dome meshes via `progSolid`); a piece
  impact within 1.3 u puffs the pile (`amt *= 0.8` + burst).
- Sounds: band-passed noise strokes, crack chord, pitch-drop thud + rustle.
- Saw mode disables 1-finger orbit; pinch still zooms; a second finger
  cancels an engaged cut.

## Other landmines

- Trees plant at `BASE_Y = groundH(0,0) − 0.06`. The hill rises ~1.1 u at
  the origin — planting at y=0 buries a third of the trunk (shipped that way
  briefly; the "squat oak" was this).
- Branch/leaf shaders take `uModel` + `uWindOn`; fallen pieces draw with
  their model matrix and wind off. Wind lean weight uses
  `(y − uBaseY)/treeH`.
- Camera: full ±90° pitch needs the pitch-aware orbit up-vector
  (`[-sinYaw·sinPitch, cosPitch, -cosYaw·sinPitch]`); fixed world-up
  degenerates at the poles. Ground draws back-face culled so under-hill
  views see the tree, not the terrain underside. Zoom floor 0.45 u.
- Species switch calls `buildTree()` which resets cuts/pieces/piles —
  by design (replant).
