# colonysimd — Colony Sim's campfire from zmh-vfx (`campfire.particles.embers`)

**Status:** implemented 2026-11-27 (oversee run; `dc82d26`, `a4ed6cc`, `65f581e` on
`worktree-oversee+colonysimd`, landed on `main` as one commit). Follow-up:
`colonysimd.zmh-vfx-campfire.follow-up.md`.
**Requested:** 2026-11-27 (the CD picked the asset from the zmh-vfx library: "update campfire to
zmhstudio zmh-vfx campfire.particles.flames", corrected the same minute to
"campfire.particles.embers").
**Scope:** `games/colony-sim/src/` (a new vendored `campfire-particles.js`, `render.js`),
`games/colony-sim/build.mjs`, the generated `games/colony-sim/index.html`,
`.claude/tests/drive-colony-sim.cjs`, `.claude/colony-sim.md`, `.claude/settings.json`.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) — the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

A built campfire in Colony Sim burns with the zmh-vfx library's `campfire.particles.embers`
flame: 120 soft additive camera-facing sprites that rise, narrow and cool from white-yellow to
red, plus 24 drifting, twinkling embers, drawn with the module's own reference shaders exactly
as its demo draws them. The three emissive boxes that are today's flame are gone. The stones,
the logs and the firelight on the ground and the settlers stay as they are (they are already the
library's hearth and light, number for number). The drive suite proves the sprite count, the
glow at night and that an unbuilt fire draws nothing, each row shown red under a break.

## Context

TODO.md § Colony Sim, "Campfire from zmh-vfx" (CD, 2026-11-26: "The campfire looks pretty
good"): the fire went into zmhstudio's new **zmh-vfx** plugin as its first asset, with a
library of turntable GIFs, and Colony Sim was to swap its hand-written fire for the plugin's
once the CD picked a technique. The CD has now picked **`campfire.particles.embers`**.

What the library says to do (zmhstudio `plugins/zmh-vfx/lib/registry.mjs:373-386`, entry
`CAMPFIRE_PARTICLES_EMBERS`, and the skill `plugins/zmh-vfx/skills/vfx-pipeline/SKILL.md`
§ "Drop in the particle fire"):

- Vendor-copy `lib/campfire-particles.mjs` (no imports; zmhstudio commit `c5a193a`, the only
  commit that touched it; zmhstudio HEAD is `5273af3`, pushed).
- Hearth from `campfireBoxes(t, { build, lit: false })` and firelight "exactly as the boxes fire
  does", both from `campfire-boxes.mjs`.
- Each frame `campfireParticlesInstances(campfireParticles(t, { embers: true }), out)`: 8 floats
  per particle (`x, y, z, size, r, g, b, a`), fire-local, origin at the fire's ground centre, +y
  up, `size` the quad's half-extent in metres.
- Draw with `CAMPFIRE_PARTICLES_SHADERS` and `CAMPFIRE_PARTICLES_QUAD` after the opaque pass:
  attribute 0 `aQ` (corner, per vertex), 1 `iP` (x, y, z, size) and 2 `iC` (r, g, b, a), both
  per instance; uniforms `uVP`, `uCamRight`, `uCamUp`; `enable(BLEND)`,
  `blendFuncSeparate(SRC_ALPHA, ONE, ZERO, ONE)`, `depthMask(false)`, depth test on; no sort.
  The demo (`examples/campfire-particles.template.html:226-264`) is the working reference:
  camera right = `(view[0], view[4], view[8])`, up = `(view[1], view[5], view[9])`.

**Why the hearth and the light are not vendored.** `campfire-boxes.mjs` was ported *from*
Colony Sim, and its defaults are Colony Sim's numbers: `CAMPFIRE_BOXES_DEFAULTS`
(`campfire-boxes.mjs:94-123`) has 8 stones on a 0.8 m ring at 0.32 x 0.24 x 0.32, two
1.1 x 0.16 x 0.16 logs at y 0.05 / 0.12 with yaws 0.5 / -0.6 shown above build 0.5, and a light of
colour (1, 0.55, 0.22) 0.8 m up, falloff 0.09, flicker 0.85 + 0.15 sin(13t) sin(7.3t), intensity
0.3 + 2.2 x night. Colony Sim draws exactly that: stones and logs at
`games/colony-sim/src/render.js:492-493`, the light in `LIGHT` at `render.js:33-35` with the
fire at `render.js:422-423`. Vendoring a second copy of the same hearth would add a module and a
yaw-convention difference (the boxes module is fire-local; Colony Sim yaws the site through
`local()`, `render.js:478-481`) for no visible change. Only the flame changes.

Today's flame is one line, `render.js:494`: three emissive boxes (red negated as the emissive
flag) pushed into `dyn` when the site is `done`. `FS_BOX`'s emissive branch (`render.js:60`) has
no other user; it stays (harmless, and the box program is shared).

The fire's clock is real seconds: `main.js:138` passes `now / 1000` to `G.R.frame` as `t`, so
the flame animates at its own speed whatever the game speed, and while paused, as today. The
particle maths runs in JS doubles, so a large `t` loses nothing (the skill's long-run wrap
warnings are for the flipbook, shader and volume GLSL clocks, not this technique).

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans "Task-scoping skill: none"). One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | Vendor `campfire-particles.js`, add it to the build order, wire the particle pass into `render.js`, remove the box flames, rebuild | cross-system | sonnet | high | fails haiku-viability on judgment: WebGL state ordering inside an existing multi-pass frame, the instance VAO, extracting the camera basis, and checking the result on a screenshot |
| 2 | Three drive-suite rows, the header comment, four negative tests through `negtest.sh`, the gate | tests | sonnet | high | fails haiku-viability on judgment: a pixel floor measured from a live render, Playwright under the Windows exports, reading each negative test row by row |
| 3 | `.claude/colony-sim.md` (files row, a § The campfire section, a call), enable `zmh-vfx@zmhstudio` in `.claude/settings.json` | docs | haiku | low | verbatim text and one verbatim JSON line, given below; passes the haiku-viability bar |

- **Ordering / dependencies:** 1 → 2 → 3. Nothing is parallel-safe: tasks 1 and 2 both touch
  `index.html` (task 2 restores it after its breaks), and task 3 documents what 1 built.
- **Files owned per task:** task 1: `games/colony-sim/src/campfire-particles.js` (new),
  `games/colony-sim/src/render.js`, `games/colony-sim/build.mjs`, `games/colony-sim/index.html`;
  task 2: `.claude/tests/drive-colony-sim.cjs` (and, during negative tests only, temporary breaks
  of `src/render.js` and `index.html`, all restored by `negtest.sh`); task 3:
  `.claude/colony-sim.md`, `.claude/settings.json`.
- **Validation per task:** task 1: `node games/colony-sim/build.mjs` prints `wrote index.html`;
  `node games/colony-sim/tools/test-sim.mjs` ends `SIM-TESTS: GREEN` (unchanged count: nothing
  in the sim moves); `node .claude/scripts/smoke-mobile.cjs games/colony-sim/index.html` ends
  `SMOKE: GREEN` (with the Windows exports); and a night close-up screenshot of a built fire
  shows the sprite flame and embers (see step 1). Task 2: the suite ends `DRIVE: GREEN` with
  exactly 3 more rows than its baseline, each negative test turns exactly the rows named below
  red, and `negtest.sh scan` is clean. Task 3: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`
  exits 0. Final gate: `bash .claude/scripts/gates.sh games/colony-sim/index.html` →
  `GATES: GREEN`, and `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- **Tier audit (required):** task 3 is haiku: every line is given verbatim. Tasks 1 and 2 are
  sonnet because each fails the checklist on judgment (named in the table). Neither needs opus:
  the GL recipe is fully specified by the module's own demo, which this plan cites line by line.
- **Decision defaults:**
  - **Embers on** (`campfireParticles(t, { embers: true })`, the module's default). The CD's
    corrected pick is the `embers` asset; the `flames` asset is the same call with `false`.
  - **Parameters as the library ships them.** No `params` override, no `loopPeriod` (the skill:
    "Do not pass `loopPeriod` in a game"). The CD picked the look in the GIF.
  - **Reference shaders unmodified**: no fog, no gamma encode added (the reference fragment
    writes display-space colour, as the GIF and demo show it). Do not "fix" either.
  - **Keep Colony Sim's own hearth (`render.js:492-493`) and `LIGHT` (`render.js:33-35`)**,
    for the reason in § Context. Do not vendor `campfire-boxes.mjs`.
  - **Keep `FS_BOX`'s emissive branch** (`render.js:60`), unused after this change. Removing it
    is out of scope.
  - **Draw all 144 particles every frame for every built campfire**, including any with `a` 0
    (they add nothing; a constant count is what row R1 checks). Do not filter.
  - **One particle fire per `done` campfire site**, iterating `sim.sites` (not
    `sites.find(...)`, which is the light's choice and stays as it is at `render.js:422`).
  - **The clock is the frame's `t`** (real seconds), as the old flame used.
  - **Site placement:** add `(x.x, heightAt(isl, x.x, x.z), x.z)` to each particle's x, y, z.
    No yaw: the particles are rotationally symmetric about the fire's axis.
  - **Name of the vendored file:** `games/colony-sim/src/campfire-particles.js` (the build's
    `ORDER` lists `.js` names; the browser dev path imports it as an ES module too).
  - **Day look:** no day-specific change. Additive sprites over a sunlit ground read paler than
    the old opaque boxes; that is a playtest question for the CD, not a call to make here.
- **Embedded-content QA (required):** done for this draft.
  - Particle count: 120 flames + 24 embers = 144 (`CAMPFIRE_PARTICLES_DEFAULTS`,
    `campfire-particles.mjs:97-107`); 144 x 8 = 1152 floats per fire.
  - The VAO shape is the disc pass's (`render.js:285`, `mkInst(quad, 8, [[1, 4], [2, 4]], [[0, 2]])`),
    and `CAMPFIRE_PARTICLES_QUAD` is 12 numbers = 6 two-float vertices, so `mkInst` computes
    `verts = 6`.
  - Camera basis: `lookAt` (`render.js:154-159`) returns
    `[xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, ...]` (column-major), so right =
    `(V[0], V[4], V[8])` = `(xx, xy, xz)` and up = `(V[1], V[5], V[9])` = `(yx, yy, yz)`, the
    demo's own indices (`campfire-particles.template.html:257-258`).
  - Suite count: the file has 27 `check(...)` rows that run (re-derived: the test-sim row counts
    once across its two call sites at lines 36-37, then 26 page rows, lines 52-322). This plan
    adds exactly 3. State the invariant "the suite grows by exactly 3" and confirm the baseline by
    running the suite before task 2's edits.
- **Escalation triggers:** stop only if the drive suite is red on the unmodified baseline (a
  pre-existing break, not this plan's), or if the vendored module fails the build's own checks
  (`build.mjs:38-42`), which would mean the upstream file changed shape since `c5a193a`.
- **Playtest:** yes. At night, zoom in on the built fire and orbit it: a soft rising flame that
  narrows and cools to red, with sparks drifting up and twinkling; the stones and logs show
  through the flame's base; the ground and nearby settlers are lit as before. By day, whether
  the additive flame still reads well enough over sunlit sand (if not, the knob is the module's
  `flames.alpha`, a follow-up). At 16x, the flame keeps its own pace. On the phone, that the
  frame rate holds near the fire.
- **Publish:** default. Player-facing change: the overseer publishes in its wrap-up (a push to
  `main` is the deploy) and verifies the Pages run per `.claude/zmh/producer.md` § Publish. The
  report quotes the badge read back from `games/colony-sim/index.html`.
- **Commit strategy:** one conventional commit per step, scope `colony-sim`, on branch
  `colony-sim-vfx-campfire`. Land the branch as one commit with
  `.claude/scripts/land-on-main.sh` (dry run first), per § Integration.

## Steps

1. **Vendor the module and draw the particle fire (task 1).**
   - Copy `D:\gitrepos\zmhstudio\plugins\zmh-vfx\lib\campfire-particles.mjs` byte for byte to
     `games/colony-sim/src/campfire-particles.js` (in a remote session: the newest zmhstudio
     plugin cache's `zmh-vfx/lib/campfire-particles.mjs`; if neither exists, clone
     `ZackHelms/zmhstudio` into the scratchpad). Then prepend one comment block, above the
     module's own:
     ```
     /*
      * VENDORED from zmhstudio plugins/zmh-vfx/lib/campfire-particles.mjs at commit c5a193a
      * (zmh-vfx library asset campfire.particles.embers). Do not edit here: change it upstream,
      * then copy it again and put the new commit in this line. Only the flame comes from it;
      * the hearth and the firelight are Colony Sim's own (render.js), which are the numbers
      * campfire-boxes.mjs was ported from.
      */
     ```
     Before trusting the hash, confirm it: `git -C <zmhstudio> log -1 --format=%h -- plugins/zmh-vfx/lib/campfire-particles.mjs`;
     if it is not `c5a193a`, write the hash it prints and say so in the report.
   - `games/colony-sim/build.mjs:16`: insert `'campfire-particles.js'` into `ORDER` immediately
     before `'render.js'` (after `'sky.js'`).
   - `games/colony-sim/src/render.js`:
     - After the `sky.js` import (line 9) add
       `import { campfireParticles, campfireParticlesInstances, CAMPFIRE_PARTICLES_SHADERS, CAMPFIRE_PARTICLES_QUAD } from './campfire-particles.js';`
     - Line 192, the program table `P`: add
       `fire: prog(CAMPFIRE_PARTICLES_SHADERS.vertex, CAMPFIRE_PARTICLES_SHADERS.fragment)`.
     - After `discI` (line 285) add
       `const fireI = mkInst(CAMPFIRE_PARTICLES_QUAD, 8, [[1, 4], [2, 4]], [[0, 2]]);   // zmh-vfx particle fire: aQ corner; iP x, y, z, size; iC r, g, b, a`
       (`mkInst` takes any array; it wraps it in a `Float32Array`).
     - Line 398: add a scratch array, e.g. `const fireBuf = [];` beside `dyn, caps, discs`.
     - Line 414: keep the view matrix: `const V = lookAt(eye, [cam.tx, cam.ty, cam.tz]);
       VP = mmul(persp(0.9, vw / vh, 0.25, 4000), V);` (same values as today).
     - Line 494: delete the old flame line (the `if (x.done) for (let i = 0; i < 3; i++) { ... [-1.0, 0.45 + i * 0.15, 0.08]); }`).
       Keep lines 492-493 (stones, logs) and the `continue;` on line 495.
     - After the disc draw (line 469) and before `gl.depthMask(true); gl.disable(gl.BLEND);`
       (line 470), add the particle pass:
       - `fireBuf.length = 0;` then for each `x` of `sim.sites` with `x.type === 'campfire' && x.done`:
         `const n0 = fireBuf.length; campfireParticlesInstances(campfireParticles(t, { embers: true }), fireBuf);`
         then add `x.x`, `heightAt(isl, x.x, x.z)`, `x.z` to elements `0, 1, 2` of each 8-float
         record from `n0` on.
       - If `fireBuf.length > 0`: `gl.useProgram(P.fire.p)`; `uVP` = `VP`; `uCamRight` =
         `[V[0], V[4], V[8]]`; `uCamUp` = `[V[1], V[5], V[9]]`; upload `fireBuf` to `fireI.ib`
         (`DYNAMIC_DRAW`); `gl.enable(gl.BLEND)`;
         `gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE)`; `gl.depthMask(false)`
         (already false here, set it anyway); depth test stays on with `LESS`;
         `gl.bindVertexArray(fireI.vao)`; `gl.drawArraysInstanced(gl.TRIANGLES, 0, fireI.verts, fireBuf.length / 8)`.
       - Line 470 then restores depth writes and disables blending, as it does today. The water
         pass sets its own `blendFunc` every frame (line 460), so nothing else needs restoring.
     - Line 471: return the test stats with the rest:
       `return { night, light, flames: fireBuf.length / 8, emissiveBoxes };` where
       `emissiveBoxes` counts the instances in `dyn` with a negative red
       (`for (let i = 7; i < dyn.length; i += 11) if (dyn[i] < 0) emissiveBoxes++;`, counted after
       `buildDynamic`). `main.js:138` keeps reading `out.night` / `out.light` as before.
   - Run `node games/colony-sim/build.mjs`, then `node games/colony-sim/tools/test-sim.mjs`
     (must end `SIM-TESTS: GREEN`), then the smoke gate on the page with the Windows exports.
   - **Look at it.** With the suite's sky harness approach (or a scratch Playwright script in the
     scratchpad): push a done campfire site if none exists, set the clock to day 1 23:00, aim the
     camera at the fire (`tx, tz` the site, `ty` ground + 0.6, `dist` 6, `pitch` 0.35), call
     `G.R.frame` and copy the canvas in the same task; save it as
     `<scratchpad>/colony-campfire-night.png`, and one at 12:00 as `colony-campfire-day.png`.
     Read both images: a soft rising sprite flame with embers above the logs, no boxes in it.
     Send the CD the night one in the report.
   - Commit `src/campfire-particles.js`, `src/render.js`, `build.mjs`, `index.html` by explicit
     path: `feat(colony-sim): the campfire burns with zmh-vfx's particle fire and embers`.
   - Done when the build, sim tests and smoke are green, the screenshot shows the new flame, and
     `git diff --stat HEAD~1` lists only those four files.

2. **Prove it in the drive suite (task 2).**
   - First run the unmodified suite (after step 1's commit) and record the baseline line,
     expected `DRIVE: GREEN (27 passed)`. Anything red there is a pre-existing break and an
     escalation trigger.
   - In `.claude/tests/drive-colony-sim.cjs`, after the ⓘ credit row (the check named "the ⓘ panel credits the star data...", about line 171) and before
     the `// follow each settler` comment, add one block that reuses the sky harness
     (`window.__skyT`, defined at lines 69-85: `run` puts back the clock, speed, following and
     camera; `draw(t, cam)` returns `G.R.frame`'s result; `px()` copies the canvas in the same
     task). Inside each `sky(...)` call, find the first campfire site in `G.sim.sites`; if there
     is none, push one at `G.sim.lay.slots.campfire` in the shape of test-sim's `forceBuilt`
     (`games/colony-sim/tools/test-sim.mjs:313-317`: `id: sim.nextId++`, `type: 'campfire'`,
     `goal: 'campfire'`, `x`, `z`, `yaw: 0`, `need`/`have` the cost, `prog = hours`,
     `done: true`, `doneT: sim.t`; the cost and hours are `wood: 4, stone: 9` and `1.5`,
     `games/colony-sim/src/data.js:81`). Record what you changed and **undo it in a `finally`**
     (splice out a pushed site; put back an existing site's `done` and `prog`), so the rows below
     see the island they saw before. Then:
     - **R1:** with the site done, `T.draw(23 * 3600, cam)` returns `flames === 144` and
       `emissiveBoxes === 0`:
       `'a built campfire draws 144 particle sprites (120 flames, 24 embers) and no box flames'`.
     - **R2:** the glow. Camera as in step 1 (night, 23:00, aimed at the fire). Project
       `(site.x, ground + 0.6, site.z)` with `G.R.project` and scale by
       `cv.width / cv.clientWidth` as the sunrise row does (lines 103-104); count pixels within
       60 css px of it that are warm and bright (`r >= 200 && r > g && g > b`). Draw once with
       the site done and once with it not done (`done = false`, `prog = hours * 0.99`: the logs
       stay, the flame and the light go). Require `doneHot - undoneHot >= FIRE_FLOOR`, where
       `FIRE_FLOOR` is a constant you set from the measured value: run it, then set the floor at
       under half of what you measured and write the measured value in a comment, as
       `HOT_FLOOR` and `STAR_FLOOR` are (line 86):
       `'the fire glows at night (warm pixels over the hearth, built vs unbuilt)'`.
     - **R3:** with the site not done (as in R2's second draw), `flames === 0` and
       `emissiveBoxes === 0`: `'an unbuilt campfire draws no flame'`.
     - With `--shots`, also write R2's done frame to `colony-campfire.png` in the shots folder
       (the canvas as a data URL from inside the same task, decoded in Node).
   - Add a line to the header comment (lines 7-19) naming the three rows.
   - Run the suite: `DRIVE: GREEN (30 passed)` (baseline + 3).
   - **Negative tests**, each through `.claude/scripts/negtest.sh`: save, break with a
     `/* @negtest */` comment on the broken line, `node games/colony-sim/build.mjs`, run the
     suite, restore, confirm `RESTORED`. Each saves and restores both
     `games/colony-sim/src/render.js` and `games/colony-sim/index.html`.
     - **N1, nothing drawn:** pass `0` as the instance count to the particle
       `drawArraysInstanced` (the returned `flames` stays 144). Expected red: R2 only.
     - **N2, the flames asset instead:** `campfireParticles(t, { embers: false })`. Expected
       red: R1 only (120). R2 may stay green: say which in the report.
     - **N3, the old flame back:** restore the deleted line 494 verbatim. Expected red: R1
       (`emissiveBoxes` 3).
     - **N4, burning before it is built:** drop the `&& x.done` from the particle loop.
       Expected red: R3 (and R2, whose unbuilt frame now glows).
   - After the restores, `bash .claude/scripts/negtest.sh scan` must be clean and
     `git status --short games/colony-sim` must show nothing.
   - Commit the suite by explicit path:
     `test(colony-sim): particle campfire rows, negative-tested`.

3. **Document it and enable the plugin (task 3).**
   - `.claude/colony-sim.md` § As built, § Files table: after the `src/sky.js` row (line 438)
     add the row
     `| \`src/campfire-particles.js\` | **vendored, do not edit**: zmh-vfx's particle fire (\`campfire.particles.embers\`), copied byte for byte from zmhstudio \`plugins/zmh-vfx/lib/campfire-particles.mjs\` with a header naming the commit. To update: copy it again, change the commit in the header, rebuild |`
   - After § The sky's last bullet (the one beginning "The drive suite's seven sky rows",
     line 490) and before `## Measured`, add:
     ```
     ### The campfire

     - The flame is zmh-vfx's `campfire.particles.embers` (the CD's pick from the library, 2026-11-27):
       120 additive camera-facing sprites that rise, narrow and cool from white-yellow to red, plus 24
       drifting embers, from the vendored `src/campfire-particles.js`. `render.js` draws them after the
       disc pass with the module's own reference shaders, unmodified: additive
       (`blendFuncSeparate(SRC_ALPHA, ONE, ZERO, ONE)`), no depth writes, depth test on, no sort, no
       fog, no gamma encode. Camera right and up are rows of the view matrix (`V[0], V[4], V[8]` and
       `V[1], V[5], V[9]`).
     - One particle fire per built campfire, 144 sprites each, at the site's ground point; the clock
       is the frame's real seconds, so the flame keeps its pace at any game speed and while paused.
     - The stones, the logs and the firelight are still Colony Sim's own code. They are not vendored
       because zmh-vfx's `campfire-boxes.mjs` was ported from them and has the same numbers.
     - `frame()` also returns `flames` (sprites drawn) and `emissiveBoxes` (box instances with the
       emissive flag) for the drive suite's three campfire rows.
     ```
   - § Calls made while building: append the bullet
     `- The campfire (plan colonysimd, 2026-11-27): zmh-vfx's particle fire with embers, as the library ships it (no parameter changes, no fog); Colony Sim keeps its own hearth and firelight. By day the additive flame reads paler than the old boxes did; the knob is the module's \`flames.alpha\`.`
   - `.claude/settings.json`: in `enabledPlugins` (lines 14-20), after
     `"zmh-pixart@zmhstudio": true` add a comma and the line `"zmh-vfx@zmhstudio": true`, so the
     zmh-vfx skill loads in this repo's sessions as zmh-sky's does. Check the file still parses.
   - Commit by explicit path:
     `docs(colony-sim): the zmh-vfx particle campfire; enable zmh-vfx`.

## Gotchas / bindings

- **`index.html` is generated.** Never edit it by hand: edit `src/`, then
  `node games/colony-sim/build.mjs`. The build restamps the badge (`build.mjs:53-54`). Read the
  badge back from the file for the report:
  `grep -o 'id="build-badge"[^>]*>[^<]*' games/colony-sim/index.html | sed 's/.*>//'`.
- **The build's module checks.** `build.mjs` strips `import ... from` lines, rewrites
  `export function` / `export const` into outer bindings, throws if two modules export one name,
  and throws if a line starting `import ... from` or `export` survives, or if the text contains
  a closing script tag (`build.mjs:25-42`). The upstream module is written for exactly this
  bundler (the skill's § Bundler rules). **Your header comment must not start a line with the
  word `import` or `export`.**
- **Put the module before `render.js` in `ORDER`.** Each module is its own block and exported
  names are assigned when the block runs; `render.js` reads `CAMPFIRE_PARTICLES_QUAD` only inside
  `makeRenderer`, but anything read at load time must come from an earlier block.
- **Do not touch the vendored body.** Only the header comment is ours. A later re-copy must be a
  plain overwrite plus the header.
- **Additive state must not leak.** The particle pass runs last in `frame()`; line 470 turns
  blending off and depth writes on, and the water pass sets `blendFunc` itself each frame. If you
  move the pass anywhere else, restore `blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)` yourself.
- **The disc pass leaves `depthMask(false)`** (set at line 454 / 460); the particles want it
  false too. Don't turn it on between the discs and the particles.
- **Sprites are in fire-local metres; the world is island metres.** Add the site's ground point
  to x, y, z only. `size` stays as it is (it is already metres).
- **The light is unchanged.** `fire` at `render.js:422-423` still picks the first built campfire
  and its `+ 0.8` height is the library's `light.heightAbove`. Leave it.
- **The CD's Windows box:** gates and Playwright need the three exports in the same Bash call
  (`.claude/zmh/producer.md` § Environment):
  - `PYTHONUTF8=1`;
  - `NODE_PATH=/c/Users/zmhel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules`;
  - `SMOKE_CHROMIUM=C:/Users/zmhel/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe`.

  Both paths were present on 2026-11-27. Re-find them if they moved:
  `ls ~/AppData/Local/npm-cache/_npx/*/node_modules/playwright-core` and
  `ls -d ~/AppData/Local/ms-playwright/chromium-*`. The suite launches with
  `--use-angle=swiftshader --enable-unsafe-swiftshader` (`drive-colony-sim.cjs:42`).
- **Read pixels in the task that drew them.** The canvas has no `preserveDrawingBuffer`; the sky
  harness draws and copies in one `evaluate`. A Playwright screenshot taken afterwards shows the
  page's own next frame (its own clock and camera), not yours.
- **Wait in frames, not milliseconds** (the suite's `frames(n)`, line 48), and never
  `waitForTimeout` (games/CLAUDE.md, "A check that can skip").
- **A check that can skip.** If the site cannot be found or pushed, or `G.R.project` returns
  null, the row fails with a reason; it never skips.
- **Run `gates.sh` alone:** no other Chromium suite or scratch copy at the same time (§ Environment:
  timing rows go red when two share the box).
- **Line endings:** edit with the Edit tool or an LF-preserving write. Copy the vendored file with
  `cp` (byte for byte), never through Python text mode. Run `bash .claude/scripts/eol-guard.sh`
  before landing; it must say `EOL: GREEN`.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. The primary checkout has an
  untracked `.claude/worktrees/` (and a locked `oversee+dsweather` worktree); neither belongs to
  this plan.
- **Branch before the first commit** (§ Integration: commits on local `main` before branching
  are left behind by the landing). After landing, check `git log --oneline origin/main..main` in
  the primary checkout.
- **Windows worktree folder:** if `git worktree remove` leaves the folder ("Permission denied"),
  delete it once any background job started inside it has ended.
- **Render-side only:** do not touch `sim.js`, `brain.js`, `data.js` or the save format.
  `test-sim.mjs` must stay at its current count.
- **Settings edit:** `.claude/settings.json` is shared with the CD's other sessions. Add the one
  line only; keep its formatting; check it parses.

## Validation

- `node games/colony-sim/tools/test-sim.mjs` → `SIM-TESTS: GREEN`.
- `bash .claude/scripts/gates.sh games/colony-sim/index.html` with the three exports →
  `GATES: GREEN`. It smokes the page at iPhone 13, runs `drive-colony-sim.cjs`
  (`DRIVE: GREEN (30 passed)`), `GAMES-SYNC: GREEN` and the negtest scan.
- `bash .claude/scripts/eol-guard.sh` → `EOL: GREEN`.
- Negative tests N1-N4 turned exactly the expected rows red; record each result line.
- The night screenshot from step 1 shows the sprite flame and embers; send it to the CD.
- Badge read back from the file; Pages run for the landed SHA concludes `success`.
- Manual playtest: see Playtest above.

## Follow-ups

- If the flame reads too pale by day: a `params: { flames: { alpha } }` override (deep partial;
  an unknown key throws), or a day-dependent alpha. The CD's call after playtesting.
- `FS_BOX`'s emissive branch is unused after this; remove it whenever `render.js` is next
  reworked.
- Smoke, soft-particle depth fade: not in the zmh-vfx particle technique yet (skill § Drop in the
  particle fire). Upstream first, then re-copy.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/colonysimd.zmh-vfx-campfire.md
```
