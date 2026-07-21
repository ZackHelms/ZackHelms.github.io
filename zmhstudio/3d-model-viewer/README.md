# zmhstudio · 3D model viewer

A tiny static viewer for comparing GLB meshes on a phone — drag to rotate any
direction, pinch to zoom. It hosts outputs from the `zmh-3d` **scan** (video →
3D) pipeline. It began as the **subject-isolation** sweep for one boulder
capture (models differing only in the `--isolate` cull), and now also carries
whole scans of other subjects as they come out of the pipeline.

Live: `https://tythos.com/zmhstudio/3d-model-viewer/`
(also `https://zackhelms.github.io/zmhstudio/3d-model-viewer/`)

## What's loaded

### Pumpkin80 — the 80-photo stills recapture (2026-07-21)

Seven models from one capture: 80 iPhone-13 stills (3024², eye-level orbit +
top-down pass, black marble counter at night) of the same white-and-gold
pumpkin, run through the scan pipeline as the real-capture A/B for
`--ml-harmonize` (zmh3dp) plus an sgbm comparison.

- `pumpkin80 (q60 sgbm)` — **good, best pumpkin yet**: quality preset capped
  to the 60 sharpest stills so matching stays exhaustive (all 60 registered,
  0.62 px); solid body, detailed gold-leaf crown, holes on the white sides.
- `pumpkin80 (draft sgbm)` — **good**: sharp well-lit stills nearly doubled
  sgbm's coverage vs the video capture; 746 components, coherent draft body.
- `pumpkin80 (q20 ml island)` — **ok, the finding**: sequential matching
  (built for video) registered only a 20-still island — and that
  self-consistent cluster produced ml's first coherent body on this subject
  (20/20 fits, 0 interpolated). ml shreds across inconsistent view clusters,
  not with view count per se.
- The four `harmonize ON/OFF` A/B entries (q60 + draft) — **bad**: on this
  capture the per-view fits swing ~80–120× (one whole ring degenerate at 0
  inliers; reflective marble + night windows), which is beyond what
  trajectory smoothing can absorb. ON beats OFF on every stat and both
  confetti — the real-capture verdict on harmonization as shipped.

### Pumpkin (quality) — many-view ML-depth shred

`pumpkin (quality)` — the same capture at `--preset quality` (295 frames @
1920&nbsp;px, all registered): **worse, not better**. DA-V2 monocular depth is
affine-fitted per frame, so 219 views at slightly inconsistent scales
contradict each other during TSDF fusion and the shell fragments (17,484
components before cleanup; a coarser-voxel re-fuse confetti'd too, so it's the
view-count scale inconsistency, not voxel size). With `--depth ml` the draft
frame budget is currently the sweet spot. Kept (tagged **bad**) as the
documented failure; ~30&nbsp;MB, slow first load.

### Pumpkin (draft) — sgbm vs ml depth pair

A matte-white decorative pumpkin with gold-leaf accents, draft scan from a
~53&nbsp;s phone orbit (two clips stitched). Same capture, same SfM (36/48
frames, 0.36&nbsp;px reproj) — only the depth backend differs:

- `pumpkin (ml)` — `--depth ml` (Depth Anything V2 monocular depth; weights
  committed to zmhstudio 2026-07-20): coverage ~63%, 33/36 views fused, the
  full body recovered — by the stats. Retagged **bad** 2026-07-21 after the
  CD's eyeball verdict: squished/warped, silhouette lost, leaves scrambled —
  the stats masked a global warp.
- `pumpkin (sgbm)` — the before-shot (**bad**): the textureless white body
  gives block-matching stereo nothing to lock onto — coverage ~13% (median
  0%), 9 views fused, a torn shell of mostly the gold-leaf cluster. A
  *different* failure from the firepit's see-through mesh.

### Firepit (draft)

`firepit` — a mesh-lidded metal firepit, draft scan from a 43&nbsp;s phone
orbit. Solid lattice body + legs; the see-through wire-mesh dome reconstructs as
a torn shell (photogrammetry can't resolve see-through mesh). `--isolate-ground`
at sphere ×1.0 stripped most of the patio. A *different capture* from the
boulder set below.

### Boulder isolation sweep

The five below are the **same source video**, same SfM + depth — only the
isolate cull differs. Triangle counts are the raw fused-mesh counts.

| model | `--isolate` settings | tri | verdict |
|---|---|---|---|
| **grnd_r090** | `auto` · sphere ×0.90 · `--isolate-ground` | 9,389 | tightest clean — recommended for a prop |
| **grnd** | `auto` · sphere ×1.15 · `--isolate-ground` | 16,255 | safest fidelity — full boulder, disc removed |
| **baseline** | `auto` · sphere ×1.15 (current default) | 19,822 | keeps a turf halo |
| **r090** | `auto` · sphere ×0.90 | 10,705 | intact, thin base sliver |
| **r075** | `auto` · sphere ×0.75 | 5,868 | too tight — clips the boulder |

`sphere ×N` = `--isolate-radius N` (keep-sphere multiplier). `--isolate-ground`
also cuts below the estimated ground plane.

## Tech

Google's [`<model-viewer>`](https://modelviewer.dev/) web component,
**vendored** locally (`model-viewer.min.js`, `@google/model-viewer@4.0.0`) — no
CDN, no build step, no external runtime dependency. The whole tool is this
`index.html`, the one `.js` bundle, and `models/*.glb`. The viewing angle is
preserved when you switch models so the comparison stays apples-to-apples; each
mesh auto-fits the frame (they differ in scale). Default view is `180° 82°` —
the boulder's well-captured face (scan meshes are open underneath, where no
camera ever saw).

To bump the vendored bundle: `npm pack @google/model-viewer@<ver>` and replace
`model-viewer.min.js` with `dist/model-viewer.min.js` from the tarball.

## Inspector (normal-map lighting)

`inspector.html` is a companion page for judging how the baked **normal map**
reads under a moving light — something the comparison page's soft image-based
lighting deliberately can't show. It's a small **three.js** scene with a dark
background, very low ambient, and one movable `DirectionalLight` key:

- **Light pad** (bottom-left): drag the handle to move the key light around the
  frame; the edge of the pad is a grazing angle — maximum normal-map relief.
- **🔒 Lock light**: freeze the light in view space, then orbit the object to
  rake the surface under a static light (the CD's "move light, then rotate the
  object" mode).
- **Normal map ON / OFF**: A/B the identical view with the baked normal map
  toggled (`material.normalMap = saved | null`).
- **Normal strength**: exaggerate or verify the bake (`material.normalScale`).
- **Light intensity**, **Graze** preset, and **Reset**.
- **Model picker**: the same five models; the light + camera are kept when you
  switch. Each model is auto-centred and scaled to a common size, and the
  default view faces the well-captured side.

three.js is **vendored** locally under `vendor/` (no CDN, no build step),
pinned to **three@0.169.0**: `build/three.module.js` at `vendor/three.module.js`
plus the `GLTFLoader`, `OrbitControls`, and `BufferGeometryUtils` addons under
`vendor/jsm/…`, wired through an HTML import map (`three` +
`three/addons/`). Color management is left to GLTFLoader (albedo sRGB, normal
map linear) with `renderer.outputColorSpace = SRGBColorSpace`.

To bump three: `npm pack three@<ver>` and copy from the tarball —
`build/three.module.js` → `vendor/three.module.js`, and the
`examples/jsm/loaders/GLTFLoader.js`, `examples/jsm/controls/OrbitControls.js`,
`examples/jsm/utils/BufferGeometryUtils.js` files into the matching
`vendor/jsm/…` paths (keep the `jsm/` layout — GLTFLoader imports
`../utils/BufferGeometryUtils.js`). Update the pin comment next to the import
map in `inspector.html`.

## Adding more models

1. Drop a `.glb` into `models/`.
2. Add one entry to the `MODELS` array in `index.html` (`file`, `label`, `tri`,
   `cfg`, `tag` = good|ok|default|bad, `note`).
3. Add a matching entry to the `MODELS` array in `inspector.html` (`file`,
   `label`) so the model is also viewable under the normal-map light.

New scans go at the **top** of each array (newest-first — the first entry is the
default each page loads). That's the whole contract — no other file to touch.

## Provenance

Meshes are generated by the `zmh-3d` scan pipeline (photogrammetry: frames →
SfM → depth → isolate → fuse → texture → GLB), draft preset. GLBs are
self-contained (embedded 2048² albedo). Source pipeline lives in the
`zmhstudio` marketplace repo, `plugins/zmh-3d/scan/`.
