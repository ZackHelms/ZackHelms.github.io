# Mitochondria Simulator — context

`games/mitochondria/index.html` (~2,970 lines, single self-contained file).
Icon 🔬. Hub card sits directly under Zed Shooter, by request.

**This is not a scored game.** It is an explorable instrument: a biophysical
model of oxidative phosphorylation with a WebGL2 human mitochondrion wrapped
around it. Everything on screen — every particle, every gauge — is driven by
the flux equations, so the picture is a readout rather than an animation.
There is no win state, no score, no persistence beyond the mute flag and the
first-run marker.

Repo's **second WebGL2 page** (after `wayfinder/`), for the same documented
reason: real 3D with translucent membranes is not achievable in Canvas 2D and
Three.js would break the no-external-libraries rule. All geometry, textures
and audio are generated in-file. A 2D canvas overlays it for labels and the
scale bar; if WebGL2 is unavailable the simulation, gauges and DATA tab still
run and an overlay says so.

---

## The simulation (`K`, `P`, `S`, `simStep`)

Coarse-grained but honest. Fluxes are normalised "electron pairs per second";
the proton-motive force `S.dp` is in millivolts. **Textbook stoichiometry is
the input, not the output** — 4/4/2 H⁺ pumped by Complexes I/III/IV, 8 H⁺ per
3 ATP through the c₈ ring, ~1 H⁺ more for ANT+PiC export (`K.H_ATP = 3.67`) —
so the P/O ratio, the efficiency penalty on fat and the inhibitor signatures
all *emerge*. Do not hard-code any of those; if a number looks wrong, fix the
constant that produces it.

- `P` — parameters the world imposes (fuel, supply, demand, o2, per-complex
  capacity, leak, ucp, caCyt, scav). Scenarios and dials write here.
- `S` — organelle state (nadh, fadh2, qh2, cytc, dp, adp, caM, ros, mptp,
  cytcRel, swell).
- `F` — the flux bundle recomputed every substep; everything downstream reads it.

Notable modelled behaviours, all load-bearing for the teaching:

| Behaviour | Where |
|---|---|
| Respiratory control (ADP is the throttle) | `fwd` term of `JATP`, `Jdem` |
| **Reverse ATP synthase** — hydrolyses ATP to hold ΔΨ when the chain is poisoned | `rev` term; `F.reverse` flags it in DATA and the inspector |
| Proton leak dominating at rest (coupling ~48%) | `Jleak`, exponential in `dp`, capped at 6 to stay numerically stable |
| Reverse electron transport ROS at high ΔΨ + reduced Q | `ret` term |
| Antimycin's semiquinone ROS burst | `qo` term |
| Ca²⁺ activating three dehydrogenases | `caAct` multiplying `Jsub` |
| MPTP → swelling → cytochrome c release | `risk`/`S.mptp`/`S.cytcRel`/`S.swell` |
| Glycolytic overflow → lactate when oxidative capacity is exceeded | `Jgly`, `oxCap`, `lact` |

**Stiffness:** `dp` equilibrates fast. The loop integrates in fixed 0.005 s
substeps (max 40/frame). Do not switch to a single variable-dt step.

**Calibrated steady states** (`REST_REF` is the resting reference the gauges
divide by). Verified by a standalone harness during the build:

| Scenario | ΔΨm | P/O | Coupling | Signature |
|---|---|---|---|---|
| Rest (state 4) | 185 mV | 1.2 | 48% | leak-dominated |
| Walk | 166 mV | 2.06 | 84% | ADP opens the synthase |
| Sprint | 158 mV | 2.34 | 93% | lactate overflow |
| Endurance (fat) | 162 mV | 2.11 | 89% | P/O falls — FADH₂ skips CI |
| Fed + idle | 195 mV | 1.12 | 45% | highest physiological ROS |
| Cold / UCP1 | 162 mV | 0.56 | 24% | O₂ use ~3× rest, all heat |
| Rotenone | 99 mV | — | — | NADH up, **Q pool empty** |
| Antimycin A | 103 mV | — | — | Q full, **cyt c oxidised**, ROS 0.61 |
| Cyanide | 99 mV | — | — | everything upstream pinned reduced |
| Oligomycin | 203 mV | — | 9% | ΔΨ maxes, O₂ falls to leak only |
| FCCP | 118 mV | — | — | maximal O₂, zero ATP |

Those crossover patterns (which pool is reduced vs oxidised under each drug)
are the classic diagnostics and are the thing most worth protecting in a
retune. The **O₂ dial is deliberately more sensitive than a real Complex IV**
(`K.KM_O2 = 0.10`) so hypoxia is visible in seconds; that trade is stated in
the ⓘ guide.

---

## Geometry (`GEO`, `buildProteinMeshes`, `placeProteins`)

Everything procedural, seeded, identical every visit.

- Body: bent rod, half-length 2.35, radius 0.74 world units (1 unit ≈ 0.5 µm).
- Two shells from `shellMesh(shrink)`: outer 1.00, inner 0.87.
- **Cristae** are flattened *sacs*, not discs: two leaflets sealed at a rounded
  rim (`cristaPt`), cut over one arc so the matrix stays continuous and the
  lumen is visible. 11 of them, tilted, sized to the local radius.
- `SITES[]` (539) is the single source of truth shared by the renderer, the
  tap-picker and the particle system. Each site carries its membrane frame plus
  `pM`/`pI` — the matrix-side and IMS-side anchors a proton is pumped between.
  On a crista the "IMS side" is the *inside of the sac*, which is correct.
- Placement follows real biology: **respirasome clusters** (I + III₂ + IV) on
  the leaflet faces, **ATP synthase in dimer rows along the curved rims**,
  carriers (ANT/PiC/MPC/MCU/UCP1) on the inner boundary membrane, VDAC/TOM on
  the outer. UCP1 instances are hidden unless `P.ucp > 0.05`.
- Complex meshes are built from primitives in a local frame where **+z is the
  matrix side and z=0 is the middle of the bilayer**. Keep that convention.
  Vertices flagged `1` spin with the ATP-synthase rotor (c-ring + γ shaft); the
  α₃β₃ head and the stator are static, which is the accurate depiction.

---

## Renderer

Passes, in order, into an HDR FBO: background → opaque instanced proteins →
additive glow particles → translucent membranes back-to-front (cristae, inner,
outer; each drawn front-cull then back-cull) → bright-pass → separable blur ×2
→ ACES composite.

**Gotcha that cost an hour:** `glClear` honours the depth write mask. The
particle pass leaves `depthMask(false)`, so `render()` must call
`gl.depthMask(true)` *before* `gl.clear` or the depth buffer is never cleared
after frame 1 — geometry then vanishes and the membranes show black holes
where stale depth rejects them.

**Triangle winding (fixed 2026-08-16).** `grid()`, `prim('sphere')`,
`prim('cyl')`'s side wall and `tube()` all originally emitted `tri(a,c,b);
tri(b,c,d)`, which winds the face normal *inward*. `cullFace(BACK)` was
therefore discarding the outward faces and leaving the far interior wall
visible — every cylinder read as an open pipe and surfaces vanished when
viewed from underneath. They now emit `tri(a,b,c); tri(b,d,c)`. `prim('box')`
and the cylinder caps were always correct; don't "fix" those. If you add a new
generator, check it against a lone cylinder viewed from outside.

**Solids are drawn two-sided** (`gl.disable(gl.CULL_FACE)` for the protein
pass, plus `if (dot(N,V) < 0.0) N = -N;` in `solF`). Correct winding alone is
not enough: the camera can get inside a complex or under a crista, and a
component must still have a lit surface there rather than a hole. The crista
leaflet grids also start at `rho = 0` now so each sac is closed at its centre.

**Membrane look** is glass, not milk: low body alpha (outer 0.09, inner 0.12,
cristae 0.22) with a sharp fresnel (`pow(..., 4.5)`) carrying the rim. Five
shells stack, so raising body alpha turns the whole organelle opaque fast.

**Viewport fit.** A 2.4:1 rod does not fit a portrait phone. `camUpdate`
computes the rectangle the chrome leaves free (`CAM.cov`), scales the
projection to it (`proj[0]`, `proj[5]`) and lens-shifts into it (`proj[8]`,
`proj[9]`). Portrait frames the rod diagonally (`CAM.home`); landscape uses the
three-quarter view and accounts for the side dock. Labels read the same
`CAM.cov` rect, so anything that changes chrome size must go through it.

**Deformation.** Fission/fusion/swelling are a vertex-shader deformation
(`SH.deform`) with a CPU twin (`DEFORM()`) applied to protein and particle
positions. **The two must stay identical.** Fission pinches a waist to a thread
then separates the halves; fusion runs it backwards; mitophagy sweeps a clip
plane across an enclosing phagophore sphere.

---

## Content

- **30 scenarios** in three groups (everyday physiology, stress & damage,
  classic experiments). `dyn(t)` lets one evolve — the breath-hold ramps O₂
  down over 55 s, and the **Seahorse assay auto-runs** the real four-stage
  protocol on a 100 s loop with the stage named in the title bar.
- **12 actions**, most with a teaching toast (ADP bolus, Ca²⁺ pulse, cut/restore
  O₂ — restoring O₂ adds a ROS spike, which is reperfusion injury).
- **9 walkthroughs** (~50 steps) in `LESSONS`. A step can move the camera (`f`),
  highlight protein types (`hi`), override layers (`lay`), push parameters
  (`set`) and fire a dynamic (`act`). A step with `hi` automatically fades the
  membranes so the highlighted machine reads.
- **16 layer toggles**, a cutaway clip plane, slow motion, auto-spin.
- Tap-to-inspect any protein: `PROTEIN[]` carries the prose, the facts table
  and a live-flux readout per type.

## Highlighting

One slow breath — `0.5 + 0.5*sin(uTime*1.7)`, a ~3.7 s cycle — drives
everything, so a marked structure reads as alive rather than as a static tint.
Keep the two consumers on that same clock; two highlights breathing at
different rates looks broken.

`iMisc.z` (`vHi`) carries the mode: **0** plain, **1** lesson-highlighted (the
type is in `hiSet`), **2** tapped-and-selected (`selSite`). `iMisc.w` carries
dimming — anything not highlighted while a lesson is running falls to a
desaturated silhouette at 0.22. The selected instance additionally gets a cool
fresnel rim, a breathing ring of glow sprites in `packParticles`, and a 2D
reticle plus name in `drawOverlay`.

`selSite` is cleared by: tapping empty space, closing the inspector, turning
off its layer, and starting or stepping a lesson (the lesson owns highlighting
from then on). The inspector card flips to `.low` when the selection projects
into the top half of the viewport, so the card never covers the structure it
is describing.

## Watch out for

- `hideNarr` from a toast timer must not wipe an open lesson panel (guarded).
- Lesson focus distance is 3.4 — closer than that and a single complex fills a
  phone with no context.
- `parts` is capped at `MAXP` 1500; spawn rates scale with flux, so a
  max-flux scenario is the density to check.
- Scenario changes reset chemistry only if the pore has opened, so a run is not
  silently rolled back mid-experiment.

## Roadmap

Phase 2 zooms out to the cell (cell types, mitochondrial density, ER contacts,
the network); phase 3 to organ systems. The background shader already fades in
neighbouring organelles as you zoom out, and `CAM.home`/`LAY.cytosol` are the
hooks. The ⓘ guide states this so the scope is visible to a player.
