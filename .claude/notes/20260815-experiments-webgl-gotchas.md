# Transferable gotchas from the experiments/ buildout (2026-08-15)

From the session that shipped `experiments/` (ARViewport, Dragon Vase, Tree
Simulator). Page-specific architecture lives in `.claude/experiments.md`,
`.claude/arviewport.md`, `.claude/tree-simulator.md`. This note keeps only
what transfers to ANY future WebGL/canvas work in this repo — companion to
`20260726-webgl-procedural-worlds.md`.

## JavaScript / GLSL language traps

- **Unary minus before `**` is a SyntaxError**: `Math.exp(-(x/k) ** 2)`
  fails to parse ("Parenthesis must be used to disambiguate"). Write
  `Math.exp(-((x/k) ** 2))`. Bit twice in one session — both times inside a
  large Write where the parse error killed the whole page script (symptom: a
  select with no options, canvas dead; nothing obviously wrong near the
  reported feature).
- Long fragment shaders accumulate name collisions silently until the GLSL
  compiler errors (`'gr': redefinition`). Grep the shader string before
  adding variables.

## Texture-card orientation (the backwards-leaf bug)

Canvas → WebGL uploads without `UNPACK_FLIP_Y_WEBGL` put **canvas row 0 at
texture v=0**. If geometry anchors its v=0 edge somewhere meaningful (leaf
stem on a twig), the texture must be painted with that feature at the canvas
TOP. Painting it at the bottom renders the card 180° flipped — and
near-symmetric art masks the bug (oval leaves looked fine for two releases;
palmate fans / needle tufts / scale sprays exposed it instantly). Rule:
decide the v-orientation contract when creating the card painter, write it
in a comment, and test with a deliberately asymmetric texture.

## Blending

- `gl.blendFunc(gl.ONE, gl.ONE)` (additive) **ignores source alpha** — a
  low-alpha "subtle" glow texture renders at full RGB strength. For decals
  used under both additive and over blending, output premultiplied color
  (`rgb * a`) in the shader and pair with `(ONE, ONE_MINUS_SRC_ALPHA)` for
  the over case.

## Procedural fields on the GPU

- **Hash-cell point fields (stars, snow, embers): always loop the 3×3
  neighbor cells.** A single-cell gaussian truncates at cell borders; wide
  kernels (blurred/fogged variants) turn into a checkerboard of glowing
  squares.
- Box-blurring a canvas by downscale/upscale: go down *and back up through
  the same intermediate sizes*. A direct tiny→full stretch turns round
  glows into soft squares (the "square moon").
- Value-noise fields need their range stretched to [0,1] after smoothing —
  box blur collapses variance toward 0.5 and threshold-based effects
  (clouds) silently stop triggering.
- Seamless-in-x procedural textures (bark, panoramas): sample 2D noise on a
  circle (`noise(cosθ·s, sinθ·s)`-style) instead of hoping the seam lands
  somewhere dark.

## Geometry / math

- Ray↔segment closest point, with `w0 = P − eye`, `b = d·U`, `c = U·U`,
  `d0 = d·w0`, `e0 = U·w0`: **`u = (b·d0 − e0)/(c − b²)`**. First attempt had
  a sign error that a 60-case node brute-force comparison caught in seconds —
  for any picking/closest-point math, write the 15-line brute-force check
  before trusting screenshots.
- Full ±90° orbit pitch: `lookAt` with fixed world-up degenerates at the
  poles; use the orbit-consistent up vector
  `[-sinYaw·sinPitch, cosPitch, -cosYaw·sinPitch]`.
- Uniform-heavy instanced cards: packing three scalars into one float
  (`frac + int·1 + bit·256`) is fine below ~2^15 — document the decode next
  to the encode.

## Process

- Scenes with terrain: compute the ground height at the subject's location
  before placing anything (`groundH(0,0)` ≈ 1.1 here — every tree shipped
  buried to the knees once).
- SwiftShader headless WebGL2 works for screenshot iteration with
  `--use-angle=swiftshader --enable-unsafe-swiftshader`; visual iteration
  via `.claude/scripts/shot-page.cjs` caught nearly every bug this session
  (the two that escaped — backwards leaves, metallic maple — were spotted by
  the CD on a real phone; screenshot review is necessary, not sufficient).
