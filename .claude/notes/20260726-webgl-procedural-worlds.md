# Building a WebGL procedural world in a single file

From the 2026-07-26 session that shipped **Wayfinder** — the repo's first (and
so far only) WebGL page. Game-specific detail lives in `.claude/wayfinder.md`;
this note is the part that transfers to any future 3D or procedural-world game
here.

## The convention exception, and its price

House rendering is Canvas 2D with no external libraries. Real 3D terrain cannot
be done convincingly in Canvas 2D, and Three.js would break the no-libraries
rule, so Wayfinder uses hand-written WebGL2 + GLSL with every asset generated
in-file. The exception is recorded in `games/CLAUDE.md` § Rendering with the
standing rule: **reach for WebGL only when a game genuinely cannot exist
without it.**

The price, so it is priced honestly next time: ~1150 lines instead of ~700, a
whole class of headless-testing friction (see the testing note), and a hard
requirement to degrade gracefully — if `getContext('webgl2')` returns null the
page must still run, not throw.

## Bake the authored world into grids, once

The single most important structural decision, and it solved three problems at
the same time.

The authored terrain function (`rawHeight`) is expensive — fbm plus five hill
bumps plus distance-to-polyline queries for a river, a beck, two tracks and a
carved gully. Calling it per vertex, per map pixel and per movement step made
boot ~16× more expensive than it needed to be and, worse, let the three
consumers disagree.

Instead: evaluate it **once per grid node at boot** into a `Float32Array`
(257×257 at 4 m spacing over 1 km), and have `heightAt()` bilinearly sample
that. Do the same for land type into a `Uint8Array`. Then:

1. **Performance** — real build work drops to ~0.5 s.
2. **Consistency** — the mesh you see, the ground you collide with, the
   contours on the map and the movement model all read one array. They cannot
   disagree about the shape of the ground, which is otherwise a rich source of
   "the map is lying" bugs.
3. **Testability** — the grids are plain typed arrays reachable from
   `page.evaluate`, so terrain assertions need no GPU.

Also cache polyline segment lengths (`prepPoly`) before any bulk query.
Recomputing a polyline's total length inside a function called millions of
times was the largest single cost in the first build.

## The honesty invariant for a world with a map

If a game shows the player a map, make the map a **projection of the same data
the world is built from**, and enforce both directions:

- everything drawn on the map exists in the world, and
- nothing is drawn in the world that is not on the map.

Wayfinder's only 3D landmarks are the four mapped ones plus the control flag;
the one deliberate exception is scree above the treeline, which is ground
texture rather than something anyone would navigate by. Unmapped landmarks are
worse than missing ones — they teach the player to distrust the map.

## Cheap techniques that carried most of the look

- **One static draw call** for the whole kilometre of terrain (131k triangles).
  No LOD, no chunking. Modest for a modern mobile GPU and far simpler than a
  clipmap; fog hides the far edge.
- **Micro-relief in the fragment shader.** A 4 m mesh reads as billiard felt
  under flat lighting. Perturbing the normal with two octaves of value noise
  costs nothing and does more for realism than extra geometry would.
- **Instanced billboards** for vegetation, with a small procedural atlas
  (conifer / broadleaf / rock / objective marker) and a **per-instance tint plus
  base darkening**. A wood of identical sprites is the giveaway; varying tint
  and darkening the trunk end fixes most of it.
- **Sky as a fullscreen triangle**, ray direction reconstructed from the inverse
  view-projection, everything (gradient, sun disc, glow, stars) a function of
  sun elevation. One uniform drives the whole day/night look, including fog
  colour and ambient level.
- Vegetation on the 2D map: draw land at cell resolution into a small canvas,
  then scale it up **smoothed** before stroking contours at full resolution.
  Soft vegetation boundaries, crisp contour lines, one cheap trick.

## Placing authored objectives in generated terrain

Hand-placing objectives in noise-derived terrain is where the bugs were. Two
rules earned the hard way:

- **If a lesson or quest names a feature, carve the feature explicitly.** The
  contour lesson pointed at a reentrant the noise had not produced; the fix was
  an authored gully deep enough to bend three 5 m contour lines. A 2 m dimple
  is invisible on the map and the lesson is unreadable.
- **Verify placements with the movement code, not by eye.** Searching
  candidate positions programmatically — slope under a threshold, off the
  handrails, and *greedily walkable from where the player will come from* —
  found good sites in seconds after two hand-picked ones turned out to be
  behind a cliff and inside a stream.
