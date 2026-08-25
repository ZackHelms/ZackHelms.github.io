# Depth from a flat sprite, and how to measure what a canvas costs

From the 2026-08-24 Star Surge title-screen pass (`21301b6`), which put a
procedural 3D dogfight behind a logo spelled out of enemy hulls. Two things
came out of it that transfer to any Canvas 2D game in this repo. Game-specific
detail is in `.claude/star-surge.md` § Title screen.

---

## Part 1 — pseudo-3D from one flat top-down sprite

The games here draw top-down sprites: a hull authored nose-up, in its own local
pixels. The question was whether such a sprite can read as *flying in three
dimensions* without a second set of art. It can, and the whole trick is one
function.

### The Jacobian of the perspective divide

Project a point with the usual divide — `k = FL / z`, `sx = W/2 + x*k`,
`sy = cy + y*k`. What you also need is the screen image of a **direction** at
that point, which is the local Jacobian:

```js
function dfDir(p, d, k) {
  return { x: (d.x - p.x * d.z / p.z) * k, y: (d.y - p.y * d.z / p.z) * k };
}
```

That is the entire 3D effect. A direction pointing away from the camera
projects **short**; one perpendicular to the view ray projects at full length
`k`. So `|dfDir(p, v, k)| / (k * |v|)` is a foreshortening factor in `[0, 1]`,
and it is exactly what a real hull's length would do.

### The billboard

Build the sprite transform from the projected velocity:

```js
const d = s.sd;                          // unit screen direction of the nose
const sxs = s.k * Math.cos(s.roll);      // roll banks the wings
const sys = s.k * s.fs;                  // fs foreshortens the length
ctx.transform(-d.y * sxs, d.x * sxs, -d.x * sys, -d.y * sys, s.sx, s.sy);
```

The long axis follows the projected velocity, the short axis is perpendicular
to it, and the length is scaled by the foreshortening. "Flying away" comes out
as a short hull pointing off-centre; "flying across" as a full-length hull
lying sideways. Rolling scales the wing axis by `cos(roll)`, which is what
banking actually looks like from a fixed camera.

**An earlier attempt was wrong in an instructive way.** The first version built
a proper 3D orthonormal frame — forward, right, plate normal — and projected
all three. That is more correct and it looks *worse*: a top-down plate is a
flat sheet whose normal is world-up, so a hull crossing the view horizontally
is seen exactly edge-on and disappears. Real games solve that with a model.
With one flat sprite, the billboard is not a cheat you settle for; it is the
right answer.

> **2026-08-25 scope correction:** that verdict is about FLAT SPRITES only.
> Star Surge's "3D MODELS" style later gave every hull a real low-poly mesh,
> and there the orthonormal frame is exactly right — a mesh seen nose-on is
> just its nose, so this section's two degeneracy patches (the foreshortening
> floor, the kept-last direction) don't exist on that path. Do not read this
> section as "never use the full frame"; read it as "never use it on a
> plate". The mesh recipe: `20260825-low-poly-meshes-in-canvas-2d.md`.

### Two degenerate cases, both of which must be handled explicitly

- **Nose-on has zero area.** When a hull lines up with the view ray the
  foreshortening goes to 0 and the sprite vanishes. That reads as a bug, not as
  physics. Floor it (`fs = max(0.24, …)`).
- **Nose-on also has no screen direction at all.** `dfDir` returns `(0,0)`, so
  the normalized direction is undefined. *Keep the last good one* rather than
  resetting to a default — resetting snaps the hull to a fixed heading at the
  exact moment it points at you, which is the one moment you are looking at it.

### Keep the projection out of the painter

Project once per entity in the update, cache `k / sx / sy / sd / fs` on it, and
let the painter read them. Otherwise the draw pass silently becomes simulation,
and the roll term — which is derived from how fast the *screen* direction is
swinging — has nowhere honest to live.

### Depth sorting is one comparison

Give the UI a `z` and paint `far → UI → near`. That is all it takes for an
entity to pass in front of a logo and drop behind it again, with no z-index, no
layers, and no special case. Star Surge lands ~20% of ship-frames in front.

---

## Part 2 — measuring what a canvas costs

**Canvas 2D calls are queued.** Timing a loop of them measures the enqueue and
nothing else. This cost four measurement rounds on 2026-08-24, and the three
wrong ones each produced a confident, plausible, wrong number:

| Attempt | Said | Why it lied |
| --- | --- | --- |
| `for (…) { update(dt); draw(); }` timed with `performance.now()` | 1.43 ms/frame | Timed the enqueue. Nothing rasterized. |
| Same, with `ctx.getImageData(0,0,1,1)` after each iteration to force a flush | 18–20 ms | The readback did **not** flush — the empty-loop baseline came back at 0.01 ms, which is the tell. Both numbers were noise. |
| Two implementations back to back, fastest-of-two, order swapped to cancel bias | ranked A over B | Still measuring the queue. It ranked the *wrong* one first. |
| **rAF deltas on a live, presenting page** | 16.7 / 33.3 ms | Found the real regression. |

> **Rule.** The only honest measurement of Canvas 2D cost is rAF deltas on a
> page that is actually presenting. `.claude/scripts/frame-budget.cjs` does it.

Two things about reading that number:

- It is **quantized to the vsync interval**. 16.7 means "inside budget"; 33.3
  means "missing every second frame". A green median tells you nothing about
  how much headroom you have. To find that, **bisect by stubbing**:
  `window.drawFoo = () => {}` in `page.evaluate` and re-measure. (Top-level
  `function` declarations in a classic script *are* `window` properties, so
  this works; top-level `let`/`const` are not, though they are reachable by
  name inside `page.evaluate`.) On the title screen, removing *any one* of the
  word, the dogfight, the bays, or all glows brought a 33.3 back to 16.7 —
  which is itself the finding: the scene was marginally over, not one thing
  being catastrophic.
- **Do not copy the screenshot tools' launch flags.** `shot-page.cjs` and
  `shot-strip.cjs` pass `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  which they need so a WebGL page renders at all — and which drags the 2D
  canvas onto software rasterization too. Same page, same measurement, with the
  flags: **50.0 ms**. Without: **16.7 ms**. A perf tool that inherits those
  flags reports a page as three times over budget for no reason.

### Bake, or paint live?

The title's word is ~116 cel-shaded hulls. Painting them per frame took the
neon title screen's median from 16.7 ms to 33.3 ms — a hard 30fps — to animate
a per-hull bob of about one pixel. Baking the whole word once into an offscreen
bitmap fixed it and deleted code.

**The negative result is the useful part.** The first idea was a *sprite atlas*:
four cells, one per hull type, blitted 116 times a frame with per-dot rotation
so the swarm could still shimmer. Measured, that was **slower** than painting
live in software raster — a rotated, filtered blit of a glow-padded cell is a
lot of blended pixels, and 116 of them is more work than the polygons were. The
lesson is not "atlases are bad"; it is that the intuition (fewer draw calls =
faster) was worth exactly nothing until measured, and the answer differed from
the guess.

Reach for **bake the whole thing** when the content is static between
parameter changes, and pay for per-element animation only when it is visible.

### A baked bitmap needs a cache key that moves

The failure a cache invites is silent: bake once, never re-bake, and a graphics
style switch serves the old bitmap forever while every other part of the screen
changes. Key the cache on everything the bake reads — `gfx`, the derived size,
`dpr` — and **assert that the key differs across styles**, which is a two-line
check that catches the whole class.

### Rendering game painters into an offscreen canvas

These games paint through one module-level `ctx`. To reuse those painters for a
bake, make `ctx` a `let` and swap it:

```js
const prevCtx = ctx, prevHue = hueOverride;
ctx = offscreenCtx;
try { drawEnemyToon(e); } finally { ctx = prevCtx; hueOverride = prevHue; }
```

One set of art, no duplicate draw code, and the cel helper's screen-fixed sun
still works because `frameRot()` reads the rotation off whatever transform is
live. Restore in a `finally` — a throw mid-bake that leaves `ctx` pointing at a
discarded canvas kills the game silently.

A companion pattern for colour: a module-level `hueOverride` that only painters
set and restore, letting one `hue()` serve the stage palette, a logo hue and a
per-entity hue without the simulation knowing any of it exists.
