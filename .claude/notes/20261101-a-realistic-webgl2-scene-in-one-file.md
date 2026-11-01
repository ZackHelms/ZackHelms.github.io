# A realistic WebGL2 scene in one file: Driving Simulator's lessons (2026-11-01)

Driving Simulator (`games/driving-simulator/`) is the second hand-written WebGL2
game after Wayfinder: an endless road, a lofted car with a cockpit, traffic, a
mirror camera, shadows and a 2.4-minute day. These are the things that cost time
and transfer to any 3D page here. Game-specific architecture lives in
`.claude/driving-simulator.md`; the earlier experiments' WebGL traps (GLSL
syntax, card orientation, blending, hash fields) are in
`20260815-experiments-webgl-gotchas.md` and are not repeated.

## Precision on an endless world

Float32 at 100 km has ~1 cm steps, which shimmers in a cockpit. Store every mesh
relative to its own anchor and draw it with `translate(anchor - eye)` against a
view matrix at the origin (camera-relative rendering; the subtraction happens in
JS doubles). Shader noise then needs world coordinates it no longer has: pass
`uCamWrap = eye mod 4096` and make the hash itself periodic in 4096
(`mod(p, 4096.0)` before hashing), so `noise(vW + uCamWrap)` is the true world
noise and never jumps when the wrap rolls over. Dashed road markings use
`s - floor(s0 / period) * period` per chunk for the same reason.

## A second camera's picture is already tonemapped

The rear-view mirror renders the scene into an FBO through the same shaders, so
its texels are tonemapped, gamma-encoded colour. Sampling them as emissive in the
main pass tonemapped them again with the night exposure (2.4 then), and the
mirror showed a daylit road at midnight. Pass such a texture straight to
`frag` and return before lighting. Any picture-in-picture (a screen in the
scene, a security monitor) has the same trap.

## Building parts onto a lofted body

The road kit gives a car as profile stations (bottom, belt, top, half widths).
Three host-side rules came out of screenshots:

- **Place a part where the surface is at the part's height.** Walk in from the
  end cap and intersect the top or bottom line between stations. Taking "the
  first station tall enough" put every head- and tail-lamp inside the hood and
  the trunk, invisible, while every lamp check that counted mesh vertices passed.
- **Glazing**: the side band is glass only where both neighbouring stations are
  glazed (otherwise it is a C-pillar); a steep top segment is a windscreen only
  if the higher station is glazed (otherwise a box truck's cargo-box front
  became glass).
- **Crease angle**: smoothing normals across 56 degrees turned the car into a
  blob; 37 degrees (dot 0.8) keeps the beltline and shoulder.

A cockpit built from the same profile is framed by proportions, not by the FOV
alone: the eye must sit 0.3-0.9 m behind the windscreen header or the camera
looks into the roof liner (the kit's first draft had 0.1 m; the zmh-3d validator
now enforces the gap). Thin layered parts (gauge face, its housing, a visor)
must be built so the faced quad is in front of every housing face; a face tilted
back by 2 cm slid half behind its housing and showed only the tops of the dials.
Portrait wants a smaller vertical FOV than you expect (1.2 rad, not 1.55; the
larger one was a third headliner and a third dashboard).

## An unbounded loop shows up as "Target crashed", not as an error

`ensureSigns()` extended the section list by one and then consumed one per pass,
with an exit condition comparing the two counts, so it never ended. In Playwright
the page simply died (`page.evaluate: Target crashed`, an out-of-memory) with no
page error and no console line. It only fired when the test teleported far down
the road. Bisected by teleporting to increasing distances until one crashed,
then reading every `while` that grows a lazily-generated list. Rule: extend to
a bound first (`sectionAt(sMax + 3000)`), then loop only over what exists.

## Making a real-time 3D page testable

- Split the frame loop into `tick(dt)` (clock, input, physics, traffic, world
  streaming) and the render, expose `setPaused(true)` and `tick`, and step the
  simulation from the suite. Every physics and traffic number is then
  deterministic and fast; nothing waits on software rendering.
- Expose `teleport(s)` that rebuilds the world and traffic anywhere, so one page
  load can tour every road class for screenshots and checks.
- SwiftShader runs this scene at 300-800 ms a frame. Wait in rendered frames
  (`requestAnimationFrame` counts), never milliseconds; and never read a frame
  time from it as a phone's.
- Write each physics bound from a real-world figure before tuning (0-60 mph a
  sedan's 6-11 s, 60-0 in 30-50 m, sunset near 7:45 pm in a US summer). The
  first draft launched at 0.95 g (0-60 in 5.2 s) and set the sun at 6:35 pm;
  both were caught only because the bound existed first. Front drive puts about
  55% of the weight on the driven wheels: that is the traction limit.
- A pixel row for night ("midnight mean luminance < 0.45x noon") caught an auto
  exposure that made a moonlit forest look like dusk.
- Audio measured off analyser probes (`SND.rms(bus)`): the radio came out 15x
  quieter than the engine, inaudible, and nothing else would have said so.

## The plugin feedback loop

Building the consumer in the same session as zmh-3d's road kit found two kit data
errors (driver's eye under the header, steering wheel over the gauges) and two
validator ranges tighter than the generator's own variation. Each went back into
the kit as data plus a validator rule, not into a host-side workaround, so the
next consumer inherits the fix. When a session both writes a generator and
consumes it, look at the consumer's first screenshots as tests of the kit.
