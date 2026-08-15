# experiments/ — shared context

The `experiments/` section (2026-08-15 session) holds **interactive dioramas**
probing web rendering/sensor tech. Realism is the design goal — the neon games
aesthetic applies only to the hub page (`experiments/index.html`, which follows
the games-hub card style with a cyan accent). Every diorama is a single
self-contained file, no libraries, all assets procedural, with an ⓘ info
overlay that must stay accurate: it documents render passes, simulation
models, and an honest approximations-&-limitations list. **When you change a
scene, update its ⓘ panel in the same commit.**

Dedicated context files (read before touching the page):

| Page | Title | Context file |
|---|---|---|
| `experiments/lone-tree/` | Tree Simulator | `.claude/tree-simulator.md` |
| `experiments/rain-on-glass/` | ARViewport | `.claude/arviewport.md` |
| `experiments/red-vase/` | The Dragon Vase | (below — small enough to live here) |

Directory names are historical; page titles were renamed 2026-08-15
(lone tree → Tree Simulator, rain on glass → ARViewport). Keep the URLs.

## Shared diorama conventions

- Chrome: `←` back button top-left (`href="../"`), ⓘ info top-right, optional
  tool/mute buttons stacked under the back button, all `.chrome-btn`
  translucent circles; hint toast bottom-center; build badge per repo SOP.
- WebGL2 required; each page shows a `#nogl` message when unavailable.
- Selectors (species/scene/etc.) persist via `localStorage`, wrapped in
  try/catch.
- Camera fit is computed from viewport aspect (`computeFit()` pattern) —
  never a fixed distance; portrait phones need much larger distances than
  landscape desktops for the same subject.
- Audio, where present, is synthesized WebAudio behind a lazy
  `AudioContext` + mute toggle (games audio SOP applies).
- Testing: iterate with headless screenshots
  (`.claude/scripts/shot-page.cjs`), then run the smoke gate on every changed
  page. Headless Chromium renders WebGL via SwiftShader with the flags
  `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## The Dragon Vase (`experiments/red-vase/index.html`, ~950 lines)

Multi-pass WebGL2 glass renderer:
1. **Room pass** → FBO: backdrop gradient quad, wood table (per-pixel
   painted 1024² canvas; alpha channel carries grain gloss for the sheen
   term; table UV spans exactly one texture period — REPEAT tiling of a
   non-tileable texture shows seams), contact-shadow + ruby-caustic decals.
2. **Back-face pass** → FBO storing `vec4(normal.xy*0.5+0.5, uv)` + a
   DEPTH_COMPONENT24 texture (sampled + linearized for glass thickness).
3. **Composite**: room re-drawn to screen, then vase front faces with the
   full glass model — `refract()` at entry (IOR 1.5), march to stored back
   depth, second refract at stored back normal (TIR → reflect), sample the
   room FBO at the exit-projected UV; Beer–Lambert `exp(-σ·d)` with σ small
   in red for ruby; Schlick Fresnel × painted equirect env map; two analytic
   speculars.
- The gold dragon is a 2048×1024 canvas texture (Catmull-Rom spine winding
  once around u; drawn 3× at x, x±w for the wrap seam). **The shader must use
  the emblem RGB as albedo** — early version used only alpha and the dragon
  became a flat gold blob. Emboss = normal perturbation from screen-space
  `dFdx/dFdy` of emblem alpha.
- Decal shader outputs **premultiplied** color; additive decals (caustic)
  MUST multiply rgb by alpha in-shader because `blendFunc(ONE, ONE)` ignores
  alpha entirely (shipping bug: caustic rendered ~5× too bright as a lava
  disc).
- Gestures: 1-finger drag = vase yaw (inertia) + camera pitch; pinch/wheel
  zoom clamped to `fitDist*[0.6,1.7]`; idle auto-spin after 5 s.
