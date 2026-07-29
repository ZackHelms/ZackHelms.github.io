# zmhstudio · 3D model viewer

A tiny static viewer for comparing GLB meshes on a phone — drag to rotate any
direction, pinch to zoom. It hosts outputs from the `zmh-3d` **scan** (video →
3D) pipeline. It began as the **subject-isolation** sweep for one boulder
capture (models differing only in the `--isolate` cull), and now also carries
whole scans of other subjects as they come out of the pipeline.

Live: `https://tythos.com/zmhstudio/3d-model-viewer/`
(also `https://zackhelms.github.io/zmhstudio/3d-model-viewer/`)

## What's loaded

### Edward Everett statue — first outdoor landmark scan (2026-07-28)

34 hand-held iPhone-13 stills, one ground-level orbit of a dark-bronze statue
in the Boston Public Garden, shot upward from below. A new subject class for
this pipeline: a landmark you cannot get close to, so the subject is a
*minority* of its own scene. Five frames were hand-cropped to different widths
before upload; measured against their neighbours they cost nothing
(`CameraMode.AUTO` gives each its own intrinsics).

- `statue34 (zmh3dv shipped defaults)` — **good, best statue (2026-07-29)**.
  Both subject-scale bugs are shipped fixes now (zmhstudio zmh3dv):
  `--sgbm-partner-gate auto` picks stereo partners by vergence angle at the
  subject centre (engaged at orbit residual 0.021, chose ±1/±2) and
  `--fuse-norm auto` normalizes the TSDF frame on the isolate cull sphere
  (**512 voxels across the subject** vs the bbox path's 26). This run used
  **zero override flags**: mean coverage 37.5%, worst view 18.7%, 1.60M
  high-mesh triangles → one component. The porous-skin residual stands
  (105,196 boundary edges — sgbm's ceiling on dark specular bronze).
- `statue34 (zmh3dv, poisson fuse)` — **ok — closed, but wears scene junk**.
  Same run re-fused `--fuse-backend poisson` (screened Poisson depth 9, 2%
  density trim): boundary edges 105,196 → **4,330 (24× fewer)**, one dominant
  component at 99.3%. But low-support scraps TSDF discarded as fragments get
  welded onto the closed surface and bake sky/foliage — shreds draped on the
  coat. **Boundary-edge count joins the poor-proxy list** (it measured 24×
  better on the visually worse mesh). Default stays `tsdf`; follow-up is
  junk suppression before the solve, not more closure.
- `statue34 (adjacent-pair stereo + hull)` — **superseded 2026-07-29** by the
  zmh3dv-defaults entry (its runtime override is now the shipped behaviour);
  kept as the discovery record. A Fable-5
  consult found a *second* instance of the same background-inflation defect,
  in stereo partner selection. `_choose_partners` (`depth_sgbm.py:133`) tries
  `PARTNER_OFFSETS = (-2, 2, -4, 4)` first and reaches the fallback list
  holding ±1 only if those yield *zero* partners — never, here. And ±1 would
  fail the gate regardless: `BASELINE_RANGE`'s floor is
  `0.02 × 42.963 = 0.859` units against a **0.724** median adjacent baseline.
  Confirmed in the run data: all 116 pairs at ±2/±4, **zero at ±1**, so every
  match was attempted at **≥22° vergence** on glossy bronze. Allowing ±1 took
  mean coverage **18.7%→37.7%** and the worst view **2.0%→18.8% (9.4×)**.
  The result has *fewer* triangles than the entry below (409,562 vs 577,258)
  and is clearly better — albedo **85.0%→95.7%**, because more of the mesh is
  observed rather than hull-guessed. **Triangle count is not quality.** The
  shipped offsets are right for *video* (1–7°/step); this capture steps 11.1°.
  The durable fix is a vergence-angle gate — scale-free, and it reproduces
  today's video behaviour automatically.
- `statue34 (q sgbm + hull, ±2/±4)` — **ok**, superseded; kept as the A/B for
  the partner-offset bug. SfM was never the
  problem (34/34 registered, 0.635 px). The quality preset's default
  `tsdf_voxel_divisor=512` nonetheless produced **3,417 triangles in 226
  fragments**. **Traced cause:** `fuse.py:125-132` normalizes the TSDF grid
  from the *sparse SfM cloud's* robust bbox, and only **28.2%** of sparse
  points lie on this subject — bbox diagonal 66.42 units vs a 3.37-unit
  subject, so the statue got **26 voxels across** where the pumpkin got 277.
  Divisor 5460 restores parity (**3,417→265,394 tris from identical depth
  maps**); `--complete hull` then reaches **577,258**. Residual defect: porous
  skin, 11,602 components, because sgbm coverage is 18.7% on dark specular
  bronze.
- `statue34 (q sgbm, no hull)` — **ok**, the A/B reference isolating hull's
  contribution: 265,394 tris / 14,168 components, albedo 98.1%.
- `statue34 (q ml + hull)` — **bad**. The ml-vs-sgbm verdict reproduces on a
  second independent capture: hull rejected **6.44M** real px as untrustworthy
  vs sgbm's 1.88M, and the result does not read as a statue. Its albedo figure
  (95.7%) is *higher* than the good entry's 85.0% and means nothing — a
  smaller mesh has less unobserved hull fill to bake onto. Albedo coverage is
  not a quality proxy.

**Standing lesson:** the normalization bug fails *silently*, emitting a
plausible small mesh rather than an error, and it will hit any subject that
isn't most of its own scene. The durable fix (normalize on the isolate sphere
when isolation is active, rather than hand-tuning `--tsdf-voxel-divisor` per
capture) is on the zmhstudio backlog.

### Symmetry prior — hull v3 revolve / radial:8 — zmh3dr stage 2 (2026-07-26)

- `pumpkin80 (hull v3, revolve)` and `… radial:8` — **bad (REJECTED by the CD
  2026-07-26; kept for the record)**. Verdict: *"I dont like how v3 has
  flattened the gold leaves, also v3 has visible 'latitude' rings. I prefer
  v2 over v3."* `pumpkin80 (q60 sgbm + hull v2)` remains canonical, and the
  `--prior` flag stays `off` by default, so the shipped pipeline never had
  these defects.

  What they were: the v2 pipeline plus the `--prior` axis. An axis and a
  folded radial profile are fitted from 1.31M trusted textured-depth points
  plus the carve's own boundary, and the hull *canvas* is rebuilt from the
  fit, so shape observed in one sector propagates into sectors no silhouette
  could ever groove. Real depth more than 2 voxels *behind* the fitted
  surface is then demoted to it. Demoted real px: 2.99M (v2) → **11.23M**
  (revolve, 9.01M from the behind gate) / **10.56M** (radial:8, 8.28M
  behind); components 4,082 → **1,314** / **1,397** — the least fragmented
  pumpkins yet, and a good reminder that component count is a weak proxy for
  scan quality. Fold count was measured, not guessed: an angular FFT of v2's
  mesh puts the strongest lobe-band mode at N=8 (~1.6% radius modulation —
  faint, which is exactly why v2 reads lobeless).

  **Why they failed** (both traced to code after the verdict; the 9.98° axis
  tilt originally blamed turned out to be a third-order contributor):
  1. *Flattened gold* — the behind gate is one-sided, which protects
     **convex** relief, but the gold crown's detail is the **concave** gaps
     between the leaves. Those gaps are genuinely observed and sit far behind
     the smooth envelope, so they were demoted and refilled, merging the
     leaves. Most of those 9.01M "behind" pixels were real surface, not the
     welt noise they were taken for.
  2. *Latitude rings* — the profile is resolved by floor bin index with no
     interpolation, so the rebuilt canvas is a stack of 96 constant-radius
     shells. The rings are that terracing.

  Candidate stage 2b (not started, needs CD go-ahead): exempt textured pixels
  from the behind gate, and bilinearly interpolate the profile lookup.

### Texture-threshold experiment — v2 at MERGE_TEXTURE_MIN 8 / 10 (2026-07-22)

- `pumpkin80 (hull v2, texture-min 8)` and `… texture-min 10` — **ok
  (resolved 2026-07-25; kept for the record)**: the v2 pipeline rerun with
  the texture gate's threshold raised from the shipped 6.0 via a runtime
  override (the default in `hull.py` is unchanged). Demoted real px:
  2.99M (v2) → 4.09M (t8) → 5.33M (t10); components 4,082 → 3,959 → 3,900.
  **CD three-way verdict: 6 / 8 / 10 "all look effectively the same", all
  better than v1** — matching the overseer's A/B (the residual criss-cross
  sits in regions that read as textured even at 10). The threshold path is
  closed; v2 at the shipped 6.0 stays the canonical stage-1b model, and the
  white-body endgame is stage 2's revolve prior.

- `pumpkin80 (q60 sgbm + hull v2)` — **good**: same capture, hull completion
  with texture-arbitrated merge + Taubin-faired hull. The CD's 6-angle
  verdict on v1 (shelf strata + criss-cross welts on the white body) traced
  to "real always wins" merge semantics baking noisy sgbm depth on the
  textureless white into the TSDF; now real depth keeps its win only where
  the image has local texture (2.99M px demoted across 33 views), and the
  hull canvas is smoothed before raycasting. Components 5,394→4,082; hull
  stage 1,936s→527s (silhouettes extract at ≤720 px). A/B vs v1: deep
  quilting → shallow surface creasing — markedly smoother, not yet perfect;
  the residual white-body gap and the absent soft lobes are stage 2's
  revolve prior.

### Pumpkin80 hull completion — zmh3dq stage 1 (2026-07-21)

- `pumpkin80 (q60 sgbm + hull)` — **ok (retagged from good 2026-07-22 after
  the CD's 6-angle verdict; superseded by hull v2)**: the q60 sgbm run
  re-fused with `--complete hull` (silhouette visual-hull completion, the
  new scan stage). GrabCut silhouettes on 60/60 views fill synthetic depth
  only where real depth never landed: fuse 33→60 integrated views,
  158K→347K verts, components 8,021→5,394 — coverage doubled and
  fragmentation down together. Closure and silhouette passed the CD bar,
  but the white body carried layered shelf strata + criss-cross welts (the
  merge kept noisy textureless stereo depth); texture is real photo albedo.

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
- `pumpkin80 (q20 ml island)` — **bad (retagged 2026-07-21 after CD
  eyeball)**: sequential matching (built for video) registered only a
  20-still island — a self-consistent cluster that produced ml's first
  coherent body on this subject (20/20 fits, 0 interpolated). But the CD's
  shape verdict: the white sides pull in with the wrong curvature — cluster
  consistency ≠ shape fidelity. ml shreds across inconsistent view
  clusters, not with view count per se.
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
