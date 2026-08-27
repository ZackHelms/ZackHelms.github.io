# Neon Clash — the pre-render pipeline

The **source** for the game's `sprite` graphics style. Everything the sprite
skin draws is baked here, offline, into one atlas:

    games/neon-clash/models/     <- 3D source (this directory) -- EDIT THIS
    games/neon-clash/sprites/    <- generated atlas.png + atlas.json -- DO NOT EDIT

Re-render after any change:

```bash
cd games/neon-clash/models
node build.mjs                  # ~45 s, writes sprites/ AND inlines the manifest
node geom.test.mjs              # primitive winding + normals guard
```

`build.mjs` also rewrites the `ATLAS-MANIFEST` block inside
`games/neon-clash/index.html`. That is deliberate — see *Why the manifest is
inlined* below — and the drive suite fails if the two ever disagree.

## Why a software renderer

No Blender, no GPU, no image library, no npm dependency: `lib/` is a complete
Canvas-less renderer in plain Node — rasteriser, PBR shading, shadow map,
procedural materials and a PNG encoder. That buys the two things this pipeline
actually needs: it is **reproducible** (same source in, same bytes out, on any
machine) and it is **re-runnable by anyone** with `node` and this directory.

## Layout

| File | What it owns |
|---|---|
| `config.mjs` | Every number the atlas depends on: pixels per world unit, yaw count, frame count, canvas size |
| `build.mjs` | The CLI. Renders every sprite, crops, packs, writes `sprites/`, inlines the manifest |
| `preview.mjs` | Contact sheets for eyeballing a change — `node preview.mjs units out.png` |
| `geom.test.mjs` | Guards the primitive library (winding, normals, index range) |
| `lib/geom.mjs` | 4x4 transforms, tessellated primitives, the `Model` accumulator |
| `lib/noise.mjs` | Seeded value/ridged/cellular noise, plus tileable 2D variants |
| `lib/materials.mjs` | Every surface, as a solid texture + height field |
| `lib/render.mjs` | Projection, rasteriser, shading, shadow map, contact shadow, ground textures |
| `lib/humanoid.mjs` | The shared figure: proportions, FK posing, body construction |
| `lib/png.mjs` | PNG encoder (Node `zlib`, adaptive row filtering) |
| `models/*.mjs` | The six subjects: knight (tank), archer, rogue (fighter), fort, props, ground |

## The four ideas worth knowing before you edit anything

**1. The projection is a shear, not a camera.**
`pixel = (x, y - LEAN*z)`, `depth = LEAN*y + z`. The ground plane therefore
stays *exactly* 1:1 with the game's world coordinates — a sprite's feet land on
the collision circle, the range rings and the health bar with no fudge factor —
while height still leans up the screen the way a raised 3/4 camera would show
it. `LEAN` is 0.80 (`lib/render.mjs`). Raising it makes figures taller and more
side-on; lowering it flattens them toward true top-down.

**2. Solid textures, in the part's own space.**
There are no UVs, no unwraps and no image files. A material is a function of a
point: `tex(x,y,z)` gives albedo, `bump(x,y,z)` gives a height field whose
gradient the renderer turns into the shading normal. Coordinates are the
**part's** local space, so a plank's grain does not swim across the model as the
yaw sweep turns it.

**3. Feature size has a floor and a ceiling, both set by the game's scale.**
A sprite is drawn at about 7 device pixels per world unit. Detail finer than
~0.25 world units cannot resolve — it averages into sandpaper and eats the
lighting — and detail coarser than ~0.8 units reads as a dent in the model
rather than a texture. Every frequency in `materials.mjs` is chosen to land
between those bounds; `freq ~= 1 / feature-size-in-world-units`. This file has
been wrong in **both** directions during its first build.

**4. Timber runs along local +Z.**
Every plank is a box authored as (width, depth, height) and every tube is built
along +Z before transforming, so wood grain rings about Z. Ringing about another
axis wraps concentric arcs around a fence plank and turns sawn board into bark.

## Tuning recipes

| You want | Change |
|---|---|
| A unit bigger/smaller on the board | `scale` on its group in `build.mjs` (1.5 today). The models are at true human proportions; this is the correction to the game's collision radius |
| A different pose or a new frame | the `poses` array in `build.mjs`, and the pose parameters the model's function accepts (`walk`, `attack`, `stride`, `crouch`, `lean`, `twist`, `armL/armR`) |
| Smoother turning | `YAWS` in `config.mjs` (12 = 30-degree steps). Cost is linear in atlas size |
| Crisper sprites | `UNIT_TILE` up (PPU rises). Beyond ~7.6 px/unit is wasted — that is the game's own scale on a phone |
| Different light | `RIG` in `lib/render.mjs`: three directionals plus an analytic sky/ground/sun environment. One rig lights the whole sheet, which is what makes a tank and an archer look like they are in the same arena |
| A new material | add to `MATS` in `lib/materials.mjs` and reference it by name from a model |
| A new unit | a new `models/<name>.mjs` exporting a function that returns `Model.finalize()`, plus a `group(...)` call in `build.mjs` and an entry in the game's `SPRITE_GROUP` |

## Traps this pipeline has already fallen into

- **Winding.** `sphere()` walks its rows downward while `cyl()`, `lathe()` and
  `torus()` walk theirs upward, so copying the sphere's index pattern into them
  inverts the surface. An inverted closed shape still draws a plausible
  silhouette — you are looking at the inside of its far wall — so it survived a
  long way into the build looking merely "flat" and "cup-like". `geom.test.mjs`
  now asserts every primitive's winding against its own vertex normals.
- **Open lathes are shells.** Under this projection you look straight down into
  one: a breastplate becomes a cup, a pauldron a bowl. `lathe()` caps its ends
  by default now.
- **Metal needs an environment.** Three directional lights give a rough metal a
  narrow GGX lobe and nothing else, so every sideways-facing steel face falls
  back to a constant and reads as flat paint. `envRGB()` supplies an analytic
  sky/horizon/sun, and grazing-angle fresnel is capped at `1 - roughness` —
  without that cap an oblique projection washes whole figures in reflected
  ground colour.
- **A preview tile the size of the finished sprite clips weapons.** Render into
  `RENDER_CANVAS` and crop to alpha bounds; `build.mjs` reports any sprite that
  touched its canvas edge.

## Why the manifest is inlined into the game

The atlas image loads as an `<img>`, but the manifest does not: fetching it
would put the whole skin behind a CORS check that `file://` fails, so opening
`games/neon-clash/index.html` straight off disk — which is how it gets debugged
and how the drive suite runs it — could never show the sprite style at all. It
is a few KB, so `build.mjs` writes it between markers in the game and the suite
asserts it still matches `sprites/atlas.json`.
