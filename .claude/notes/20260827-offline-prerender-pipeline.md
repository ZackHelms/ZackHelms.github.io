# Baking 3D to sprites, with no 3D tools at all

From the 2026-08-27 Neon Clash session, which added a third graphics style:
the same cast **modelled, textured, normal-mapped, lit and rendered offline**
into one atlas, then blitted at runtime. Source: `games/neon-clash/models/`
(its `README.md` is the operating manual). This note is the reusable part —
what to build, in what order, and the five things that cost the most time.

**Cost, for planning another one:** ~1,900 lines of pipeline (renderer,
materials, six models, build + preview + a geometry test), ~250 lines of game
wiring, and a 1.5 MB atlas rendering in 46 s. Roughly two thirds of the effort
was *looking at renders and fixing what they showed*, not writing the renderer.

## Why a software renderer at all

The container had no Blender, no GPU, no numpy, no PIL, no image library. That
sounds like a blocker and is closer to a gift: a from-scratch rasteriser in
plain Node is **reproducible** (same source in, same bytes out, on any machine,
forever) and **re-runnable by anyone** with `node` and the directory. No asset
binary anywhere is un-regenerable. Node's `zlib` is enough to write a real PNG
in about 60 lines, including adaptive row filtering — which is itself worth
doing: it was the difference between a 3 MB atlas and a 1.5 MB one.

## The projection: use a shear, not a camera

For a top-down game, do **not** put a tilted perspective camera over the model.
Use an oblique shear:

```
pixel = (x, y - LEAN*z)          depth = LEAN*y + z      // larger is nearer
```

The ground plane then stays *exactly* 1:1 with the game's own world
coordinates, so a sprite's feet land on the collision circle, the range rings
and the health bar with no fudge factor anywhere — while height still leans up
the screen the way a raised 3/4 camera would show it. `LEAN = 0.8` reads as a
convincing 3/4; 0.58 was tried first and looked flat and top-down.

Two consequences to plan for:

- **The pivot is the ground point, not the centre.** Every sprite needs a
  recorded pivot, and the atlas manifest carries it per rect.
- **A 3/4 skin needs depth sorting.** Figures stand up off the ground, so the
  last one drawn wins the overlap; sort entities back to front by board y. A
  flat top-down skin must *not* pay for this, so it is a branch, not a change.

## Solid textures beat UVs for this

There are no UVs, no unwraps and no image files. A material is a pair of pure
functions of a point — `tex(p)` for albedo, `bump(p)` for a height field whose
gradient becomes the shading normal. That is the whole normal-mapping story: no
tangents, no unwrap, no seams. Evaluate them in the **part's own local space**,
carried per-vertex as a second position, or the grain swims across the model as
the yaw sweep rotates it.

**The one number that matters: feature size, in world units.** A sprite is
drawn at ~7 device pixels per world unit, so detail finer than ~0.25 units
cannot resolve (it averages into sandpaper and eats the lighting) and detail
coarser than ~0.8 units reads as a dent rather than a texture. Every frequency
is `~= 1 / feature-size`. This got set wrong in *both* directions in one
session — first rivets 0.7 units across (chrome bubbles), then 0.03 units
across (sandpaper) — costing several render-and-look rounds each time. Write
the bound down before authoring materials, not after.

## Lighting: the two things that make or break metal

**1. Three directional lights are not enough.** A rough metal under
directional-only lighting gets a narrow GGX lobe and nothing else, so every
sideways-facing face falls back to a constant and reads as *flat blue-grey
paint*. Metal shows its surroundings, so supply an analytic environment — a
sky/ground gradient with a brightened horizon and the key light's own disc in
it — and sample it along the reflection vector. That single addition is what
makes armour look like metal.

**2. Cap grazing-angle fresnel at `1 - roughness`.** The textbook `(1-NV)^5`
drives reflectance to 1 at grazing angles, which is right for a mirror and
badly wrong for scuffed plate — and under an *oblique* projection a huge share
of every surface sits near grazing, so unattenuated fresnel washes whole
figures in reflected ground colour. The symptom is confusing: correct blue-grey
albedo rendering as uniform warm cream.

A third, less principled but decisive lever: **do not use `metal: 1.0`**.
Diffuse is what carries form at 60 px. Metalness around 0.4 with a real albedo
gives shading that reads, plus enough specular to say "steel".

## Sample the environment toward the normal, not just the mirror direction

A vertical face's mirror direction has a view-fixed z, so an entire cylinder
wall samples one environment colour and goes flat. Blending the sample
direction toward the surface normal by roughness both approximates the widened
rough-reflection lobe and restores the variation that reads as form.

## Contact shadow, not cast shadow, on the ground

Keep the key light's shadow map for **self**-shadowing — that is most of the
form. But its cast shadow is useless on the ground: at 52 degrees of elevation
a 16-unit figure throws a 13-unit shadow, longer than the whole tile. What a
sprite needs is a contact pool: rasterise the model straight down, keep the
lowest geometry over each ground cell, darken by how close it gets to the dirt,
blur twice. Boots go black underneath, a raised arm barely registers, and the
pool never leaves the tile.

## Winding is the bug that hides

**`sphere()` walks its rows downward; `cyl()`, `lathe()` and `torus()` walk
theirs upward.** Copying the sphere's index pattern into them inverts the
surface. An inverted *closed* shape still draws a plausible silhouette — you
are looking at the inside of its far wall — so it survives review looking
merely "flat" and "cup-like", and you spend rounds tuning materials and
proportions to fix a lighting problem you do not have. It cost the better part
of a build here.

The guard is three lines and belongs in a test from the first commit: for every
triangle, the geometric normal must agree with its own stored vertex normal.
Zero front-facing triangles on a shape that "renders" is the tell.

Related: **an open lathe is a shell**, and under this projection you look
straight down into it. Cap profile ends by default.

## Ship it as a fallback, not a dependency

A style with a downloadable asset is the first thing in a
single-file game that can *fail*. Three rules made it safe:

- **Separate the style that is SELECTED from the style being PAINTED.** One
  function (`look()`) returns the fallback while loading and permanently on
  failure. Everything else reads that, never the raw setting.
- **Let the fallback's predicate stay true.** Here `toon()` was redefined as
  "the representational idiom" — the sprite skin answers yes to it and then
  overrides, one draw call at a time, only what it has art for. A half-ported
  skin still draws a complete board, and the port can land incrementally.
- **Load lazily.** Nothing is fetched until the style is actually chosen, so
  players on the other styles never pay for it.

## Inline the manifest; fetch only the image

`fetch()` fails CORS on `file://`. If the manifest is fetched, the style can
never be opened off disk — which is how the page gets debugged *and* how the
headless suite loads it, so the feature would have been untestable. An `<img>`
has no such restriction. Write the manifest into the HTML from the build
script, between markers, and have the suite assert it still matches the
generated file. Beware the related trap: a `file://` image **taints the
canvas**, so `getImageData` throws — assert the atlas is being *blitted* (a
draw counter) rather than sampling a pixel.

## What to assert

Pixels are hard to test; structure is not. The checks that earned their place:

- every primitive's winding agrees with its normals (the bug above)
- the inlined manifest equals the generated one, byte for byte
- every rect lies inside the image, with its pivot inside the rect
- every group holds exactly `yaws x frames` sprites, and indexes inside the table
- every card in the deck has art
- the atlas is blitted under the new style and **not touched** under any other
- the draw order is monotonic in y under the 3/4 style, and empty under flat ones
- an atlas that never loads still yields a playable board
- the sim is byte-identical under every style (the skin-is-paint invariant)

And one that is not an assertion: `build.mjs` reports any sprite that touched
its render canvas edge. Render into a generous canvas and crop to alpha bounds
— a preview tile the size of the finished sprite silently clips raised weapons.
