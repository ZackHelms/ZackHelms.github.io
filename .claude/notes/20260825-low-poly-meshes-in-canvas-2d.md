# Low-poly 3D meshes in Canvas 2D — the recipe, and what only shipping it taught

From the 2026-08-25 Star Surge "3D MODELS" style (`2e89f88` → `088011f`): every
hull becomes a real mesh, flat-shaded per face, banking into its turns — no
WebGL, no libraries. This note is the transferable half; the game-specific
half (mesh tables, who banks, the dispatchers) is `.claude/star-surge.md`
§ The 3D model kit. It extends, and in one place **corrects**,
`20260824-canvas-pseudo-3d-and-measuring-canvas-cost.md`.

## The renderer is ~60 lines and three ideas

A mesh is `{ p, v, f, nose }` — a palette of `{h,s,l}` face colours (flags:
`hue:1` = swap h for the live game hue, `e:1` = emissive, full-bright,
unshaded), a flat vertex array in sprite-local units, faces as
`[palIdx, v0, v1, ...]`, and which way the hull points along its own y.

1. **Transform + project.** Top view (gameplay): spin about z, bank about y,
   orthographic. Full 3D (the title dogfight): orient along the velocity via
   an orthonormal frame, roll about it, perspective-divide per vertex.
2. **Painter-sort faces by mean depth.** No z-buffer, no clipping. Stable
   under bank because coplanar stacks (a deck stripe 0.02 above the deck)
   keep their depth offset through the rotation.
3. **Two-sided normals, flipped to face the camera — and a flipped face is
   an underside, so dim it** (`lum *= 0.45`). Without the dim, a banked
   hull's falling edge lights like its rising one. Backface culling is the
   textbook answer but wrong here: wings and rotor blades are genuine
   two-sided plates, and the dim gives them a correct shadowed underside
   for free.

Per face: `fillStyle` from lum via a metal curve, then a thin
near-black stroke (~0.6px, `rgba(8,10,16,.55)`) on every non-emissive face —
the panel-gap strokes are most of what reads as riveted plating.

## The correction to the 2026-08-24 note

That note records "a full 3D orthonormal frame is more correct and looks
*worse*" — **that verdict is about flat sprites only.** A top-down plate seen
edge-on vanishes; a mesh seen nose-on is just the model's nose. With real
meshes the orthonormal frame is exactly right, and the two degeneracy
patches the billboard needed (the foreshortening floor, the kept-last screen
direction) simply don't exist on that path. Same sim, same roll term, same
projection constant — only the last step (state → pixels) branches per style.

## Lessons that cost a CD round-trip or a broken check

- **Ambient floor ≥ ~0.5 on a dark field.** The first shading curve
  (`0.30 + 0.90·lum^1.55`) was physically tasteful and the CD's verdict was
  "too dark — the 3D and the banking don't pop". Over a near-black
  background on a phone, a face at 30% of base is invisible; the banking it
  was showing goes with it. Shipped curve: `0.52 + 0.75·lum^1.35` plus a
  specular pop past 0.93. Contrast still reads because the *ratio* between
  flanks survives a higher floor.
- **"Weathered" as a palette treatment means TINT, not darkening.** A
  0.80–1.18 per-face grime band plus extra-dark rust plates read as "the
  ships are dark", not "the ships are worn". Shipped: 0.90–1.12 band, rust
  as a hue/sat shift at full brightness. (The CD's "weathered" actually
  meant *texture* — out of scope for this style; a texture-mapped style is a
  possible future one. The one-function seam for it is the per-face colour
  resolver: swap it for a UV lookup and nothing else changes.)
- **Derive motion-driven visuals painter-side; store the state in a
  WeakMap.** Bank follows each hull's own measured lateral speed between
  paints (a module `frameDt` written once per `update()`), smoothed, with a
  teleport guard (>2600 px/s is a respawn, not a turn). Keeping the tracker
  state off the entity (`VIS = new WeakMap()`) is what lets the suite assert
  skin-is-paint at the strongest level: after 90 driven frames under every
  style, both the sim numbers AND `Object.keys(entity)` are byte-identical.
- **A style that only restyles one thing can skip the SKINS-table rule.**
  The repo convention says "past two styles, make the skin a table". The
  third style here deliberately lands on the *neon* side of every existing
  `toon ? A : B` branch — weapons fire, glows and chrome are emissive
  whatever the hull is made of — so the only 3-way dispatch is the three
  hull entry points (`paintShip`/`paintEnemy`/`paintBoss`). The table is for
  styles that restyle *everything*. Route every hull through those
  dispatchers (field, bays, station dock, title bake, dogfight) or screens
  drift.
- **Scenery converts at its primitives, not its scenes.** The station read
  as neon under the new style until its shared shape kit
  (`sPanel`/`sDisc`/`sRing` — "one geometry, a treatment per style") gained
  a third treatment: linear gradient away from the same screen-fixed lamp on
  every plate, radial gradient turning every disc into a dome. One seam,
  whole screen converted, layout signature untouched.

## Check-craft: green for the wrong reason, twice in one day

Both new pixel checks shipped wrong the first time, in the same way — the
scene behind the subject mimicked the subject:

- "Dogfight projects real hulls" passed with the painter **completely dead**:
  a flat 4-lit-pixels bar was cleared by stray starfield pixels. Bar became a
  fill *fraction* of the sample box (5%).
- "Banking changes the lighting" (left vs right flank in one frame) passed
  with the lighting **broken outright**: the per-face grime difference
  between the two side skirts supplied the asymmetry. And its second form
  ("the rising flank is lit") had the geometry backwards — the *deck*, the
  biggest face, dominates any half-hull measurement and brightens when
  banked TOWARD the light. Final form: same half, opposite bank signs (same
  faces, same grime — only the light can move the number), negative-control
  = constant lum.

The general rules, now also in `.claude/tests/README.md`: a pixel check's
bar must clear what the scene can mimic, and **negative controls go stale
when the art moves** — the grime-asymmetry hole was *opened by the
brightness retune hours after the control had legitimately passed*. Re-fire
the controls after any visual retune of the thing they guard.

## The second style on the same kit (animlight, same day)

`3D ANIMLIGHT` reused the whole renderer and changed three things. What
transfers:

- **Give a style FAMILY a predicate, not a name.** The moment a second style
  shared the mesh renderer, every `gfx === 'model'` test in scenery became a
  lie waiting to happen. `meshGfx()` replaced them, and the fourth style then
  needed *no* scenery edits at all — the station, the planet limb and the
  dogfight path all came along free.
- **Animated lights belong in the mesh's OWN local space.** Author a rig of
  points, flatten it into one array at attach time, and transform it in the
  *same loop* that transforms vertices (appended after them in the scratch
  arrays). A light then rides the bank, the rotor spin and the dogfight's full
  3D frame for free, and cannot drift off its hull. Dim each light by how
  squarely it faces the camera (the mesh's own bounding radius is the
  yardstick) so one that rotates to the far side does not shine through.
- **Glow with three stacked passes under `globalCompositeOperation =
  'lighter'`** — wide faint halo, mid body, hot core — never `shadowBlur`.
  Two calibrations were load-bearing and neither was guessable: the hot core
  must keep the light's **own hue** (at near-white the three passes stack and
  every light comes out the same colour), and a conduit must be **thin** (at
  double the width two parallel veins' halos merged into one blown-out stripe
  down the fuselage).
- **Vivid means SATURATED, not lighter.** Pushing lightness instead turned the
  player's steel fuselage near-white, which left the blue veins nothing to
  shine against — the exact thing the style existed for. Cap lightness, push
  saturation, and the lights have a surface again.
- **A style may legitimately resize the art, and it is still paint** (no hitbox
  moved). Two consequences: make the scale **context-aware** via a `portrait`
  flag through the sprite dispatchers, because fixed art boxes — a
  character-select bay, a drydock, a logo baked out of hulls — overflow or lose
  legibility at 3x while the field is exactly where the oversize belongs; and
  grow the **chrome that rings a hull** (shield bubbles, status halos) by the
  same factor or it vanishes inside the art.
- **Effects are skinned last and are worth skinning.** Hulls got four
  treatments before the shield and the pickups did, and the screen read
  half-converted until they followed. Pick one style as the **baseline the
  others depart from** (here: neon keeps its original art) so the work is
  bounded.

### A transparent shell, honestly

For a shield bubble that should read as a 3D spherical shell: a thin shell
presents its thickness edge-on at the limb and almost none of it head-on, so
the alpha profile is `1/sqrt(1 - t^2)` — approximate it with radial-gradient
stops and it reads as a real bubble rather than a disc. For a band of light
crossing it, the honest primitive is a **vertical strip**, because a band at
fixed x on a sphere projects to exactly that; travel it as `-cos` so it eases
at both limbs, which is what a point circling at constant angular speed looks
like head-on.

## Numbers worth keeping

- Frame cost (frame-budget.cjs, 390×844 dpr3): 16.7 ms median everywhere —
  title dogfight, saturated 16-enemy + boss combat, the gradient station.
  ~15 meshes × ~15 faces of hsl-string fills per frame is nowhere near the
  budget.
- Pre-existing finding, recorded while comparing: the **neon** station sits
  at a hard 33.3 ms (its per-frame `shadowBlur` strokes), untouched by this
  work — see `.claude/star-surge.md` § station frame cost before touching it.
- The animlight rigs are free at that resolution: a 16-enemy + boss + 60-bullet
  field, the title screen and the station all held 16.7 ms median with every
  hull running lights. What was *not* free was the shield's two live
  radial-gradient discs at 3x scale — 13 frames in 169 over budget, fixed by
  baking (below).
