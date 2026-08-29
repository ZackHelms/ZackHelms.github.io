# Games — Shared Context

Each game is a **single self-contained HTML file** (inline CSS + JS, no external
libraries). Work on each game happens in a **dedicated Claude Code session**.
Detailed context for individual games lives in `.claude/<game>.md` at the repo root.

**Documented exception — baked assets.** A game in its own subdirectory may ship
*generated* binary assets beside its HTML when the alternative is worse: Neon
Clash's `sprite` graphics style is a 1.5 MB pre-rendered atlas
(`games/neon-clash/sprites/`, built from 3D source in
`games/neon-clash/models/`), which base64-inlining would bloat the HTML by ~2 MB
for every visitor including the ones who never pick that style. The bar for
doing this: the asset is **generated from source that lives in the repo** by a
committed, dependency-free build script; it loads **lazily**, only when the
feature that needs it is selected; and the game **degrades to a working style**
if it never arrives. Piano Tiles' `.mp3` files are the older, hand-authored
precedent.

---

## Shared Conventions

| Convention | Detail |
|-----------|--------|
| Fonts | `'Black Ops One'` (headings) + `'Share Tech Mono'` (body/mono) via Google Fonts |
| Palette | `--bg:#06060e` `--panel:#0b0b16` `--border:#1a1a30` `--green:#39ff14` `--gold:#ffc300` `--blue:#4488ff` `--red:#ff2244` `--white:#dde3ff` `--dim:#8899bb` `--purple:#b44fff` |
| Rendering | Canvas 2D, `requestAnimationFrame` loop, delta-time capped at ~100 ms. **Documented exception:** `wayfinder/` renders with hand-written **WebGL2 + GLSL** — real 3D terrain is not achievable in Canvas 2D and Three.js would break the no-external-libraries rule. All its assets are still generated procedurally in-file, it keeps a 2D canvas over the top for the HUD, and it degrades gracefully (simulation, map and compass all still run) when WebGL2 is unavailable. Reach for WebGL only when a game genuinely cannot exist without it |
| Input | Touch + mouse events, `user-select:none`, `touch-action:manipulation` |
| No dependencies | Zero external JS libs; Google Fonts is the only external resource |
| Responsive | Portrait/landscape via `@media (orientation:landscape)` or `100dvh` layout; a canvas inside a flex column needs `min-height:0` or its intrinsic 300:150 ratio overflows landscape |
| Canvas sizing | A fullscreen canvas needs explicit CSS `width:100%;height:100%` — `position:absolute;inset:0` alone does NOT stretch a replaced element, it renders at its intrinsic (dpr-scaled) attribute size and the page looks 2–3× zoomed. A layout that rescales stored positions by a relative factor (newCell/oldCell) must floor the derived scale above zero AND make repeated calls strict no-ops: a transient degenerate viewport once drove phasic's cell size negative, and a `oldCell>0` guard then silently dropped every healing rescale — the squish became permanent until reload (2026-07-31 rotation bug). **Lay out in the space pointer events resolve in.** Sizing the backing store from `window.innerWidth/innerHeight` while reading taps off `getBoundingClientRect()` uses two coordinate spaces that iOS makes disagree: after rotating into landscape, Safari's chrome can leave the canvas box *shorter* than `innerHeight`, CSS squashes the taller backing store into it, and every sprite is drawn higher than it is hit-tested — by an offset that **grows with y**, so it reads as "the thing low on the screen stopped answering taps" while the top of the scene looks fine (2026-08-28: fire-clicker's campfire answered only taps at the bottom of its drawn circle and below). A game needs exactly one of two cures: **measure the element** — one `viewBox()` helper wrapping `getBoundingClientRect()` that every layout number comes from (fire-clicker) — or **pin the CSS size** to the numbers you sized the backing store with (`cv.style.width = W + 'px'`, turret-builder). What you cannot do is size from `inner*` and leave the box to `width:100%`. Rotation compounds it: iOS can hand every rotation event a stale box and then never fire again, so pair either cure with phasic's `reflow()` (three passes across `resize`/`orientationchange`/`visualViewport`) plus a cheap re-measure in the frame loop — all strict no-ops once the box settles, provided the layout function is idempotent for a given box. **A guard written as `innerWidth !== W` cannot fire**, because both sides of it are the wrong space; that is how fire-clicker shipped the bug twice in one day. Diagnose any page with `.claude/scripts/check-canvas-space.cjs` |
| Canvas-drawn UI | Buttons/cards drawn on the canvas keep their hitbox arrays (`cardRects`-style) in JS — any branch that hides the widgets MUST clear the arrays too, or invisible stale hitboxes swallow taps (2026-07-24 grid-defense bug). Canvas has **no layout engine**: nothing clips, nothing reflows, nothing reports a collision, so assert what a layout engine would — every button rect inside the viewport, no two overlapping, and every off-button thing a widget points at fully on-screen. Derive the geometry from `W`/`H` in **one** layout function that the renderer and the hit-tester both call; two copies is how a button stops matching what it draws. Assert the layout's own structural invariant too, whatever it is — star-surge's station pairs left-column buttons with left-hand features so no connector line crosses the scene, and re-pairing one still looks "fine" to a screenshot reviewer who does not know the rule (2026-08-23). **Sweep those assertions across viewports, don't run them at one** — with no reflow, a widget sized off a content count and a row sized off a viewport fraction can collide at one aspect ratio and be fine at every other. Six or seven sizes including a landscape and a very narrow one, `page.setViewportSize` between each, **a real `draw()` at every one** (a layout that computes fine still throws in a painter), and collect violations as named strings rather than a boolean so a red tells you which rule broke at which size (2026-08-24) |
| Adding a screen (new state) | Three traps, all from the shared shape (one `state` string, one `update()` that early-returns off `'play'`, one persistent `#overlay`). **(1)** Any *countdown-driven visual* freezes wherever its timer stops ticking: star-surge's `stageBanner` decrements only in update()'s play branch but drew whenever `> 0`, so a gold `STAGE 1 · WAVE 1` sat behind the SHIP DOWN overlay. Scope the draw to the states that tick it — one guard beats auditing the ticker — and assert it by counting pixels **of that element's hue** in its band (a brightness threshold catches the starfield and passes for the wrong reason). **(2)** A handler bound to `#overlay` *inside a screen builder* stacks one listener per time that screen is shown. Bind overlay-level taps **once at init**, scoped by `state === '<screen>'`; the state check doubles as the debounce, since the action moves the state on before the trailing synthetic click. Treat >14 px of finger travel as a scroll, not a tap — `#overlay` scrolls. **(3)** Inserting a new terminal state *orphans the old one*: routing a cleared sector to a report made `endRun(true)` unreachable, dead but maintained-looking. Grep the old terminal for call sites before you finish. Where a screen is also a **save point**, the rule that keeps "resume" from becoming "undo my death" is an asymmetry — write the snapshot wherever the player is idle *and* safe, and clear it on exactly one event, the run ending. **(4)** A screen that bakes something expensive into an offscreen bitmap must key that cache on **everything the bake read** — miss `gfx` and a style switch repaints the whole screen around a logo still in the old style, forever, with no error anywhere; assert the key *differs* between styles, which is two lines and catches the class (2026-08-24). Full write-up incl. what screenshots catch vs. what only driving the flow catches: `.claude/notes/20260823-adding-a-screen-to-a-canvas-game.md` |
| Depth in Canvas 2D (optional) | A top-down sprite can read as flying in **three dimensions** with no second set of art. Project the usual way (`k = FL/z`), then take the screen image of a *direction* — the local Jacobian of the perspective divide, `(d.x - p.x*d.z/p.z) * k` — which is short for a direction pointing away from the camera and full-length for one across it. Build the sprite transform as a **billboard**: long axis along the projected velocity, scaled by that foreshortening, short axis perpendicular, `cos(roll)` banking the wings. A full 3D orthonormal frame is more correct and looks *worse* — a top-down plate's normal is world-up, so a hull crossing the view is exactly edge-on and vanishes. Two degenerate cases must be handled by hand: **floor the foreshortening** (a nose-on plate has zero area, and a sprite that blinks out exactly when it lines up with the camera reads as a bug) and **keep the last good screen direction** rather than resetting (nose-on has no screen direction at all, and resetting snaps the hull to a fixed heading at the one moment you are looking at it). Project once per entity in `update()` and cache it, so the painter stays pure. Give the UI a `z` and paint far → UI → near: that one comparison is the whole reason an entity can pass in front of a logo and drop behind it, with no z-index and no special case. **The upgrade path is real low-poly meshes** (~60 lines: transform, painter-sort faces by mean depth, two-sided normals flipped to face the camera with flipped faces dimmed as undersides, per-face flat shade + a thin panel-gap stroke) — and under meshes the full orthonormal frame IS right, the billboard's degeneracy patches vanish, and hulls genuinely bank (derive bank painter-side from measured motion, state in a WeakMap so the sim objects stay byte-identical). Shade on a HIGH ambient floor (~0.5): over a near-black field a face at 30% of base is invisible on a phone, and the banking it shows goes with it (CD-flagged 2026-08-25). Scenery converts at its shared shape primitives, not per scene — one gradient treatment in the kit relit star-surge's whole station. **Animated lights on a mesh belong in the mesh's own local space**: author them as a rig of points, flatten them into one array at attach time, and transform them in the SAME loop that transforms vertices (appended after them in the scratch arrays) — then a light rides the bank, the spin and the full 3D frame for free and can never drift off its hull. Glow them with three stacked passes under `globalCompositeOperation = 'lighter'` (wide halo, body, hot core), never `shadowBlur`; keep the hot core at the light's OWN hue around 74% lightness, because at near-white the passes stack and every light comes out the same colour. Dim a light by how squarely it faces the camera so one that rotates to the far side of a banking hull does not shine through it. Reference: `star-surge/` (`dfDir`, `dfDrawShip`, `DF_ZUI`; meshes: `MESH_SHIP`, `paintMeshFaces`, `dfDrawShipModel`); derivations `.claude/notes/20260824-canvas-pseudo-3d-and-measuring-canvas-cost.md` + `.claude/notes/20260825-low-poly-meshes-in-canvas-2d.md` |
| Editing a large single-file game | These are 600-4000-line single files, so the standard edit is a **span replacement between two anchors** (a python/`sed` block swap, or a large Edit). That silently deletes anything that happened to sit *between* the anchors: on 2026-08-25 a `drawPowerup` defined between `SHIELD_SWEEP` and `drawShip` was swallowed twice by two different rewrites of the code around it, each time surfacing only as a `ReferenceError` from inside `draw()` on the next test run. Before replacing a span, **list what is inside it** (`grep -n '^function\\|^const' <file> | awk` over the line range, or just read the tail of the region), and after any block rewrite re-run the smoke gate rather than trusting the diff to look right. Prefer anchoring on the *start and end of one function* over "from this declaration to that unrelated one" |
| Reading pixels back (checks) | `getImageData` returns **unpremultiplied** RGB, so a nearly-transparent fill over a *cleared* canvas reads as its full colour — a 1.6%-alpha shell profiled that way came back flat and bright, and the check that depended on it was meaningless. When a check paints its subject in isolation, **fill the real backdrop first** (`ctx.fillStyle = '#06060e'; fillRect(...)`) so brightness reports what an eye would see. Painting the subject alone is otherwise the right move: star-surge's first shield check measured a box whose radius differed per style, so the sample moved between styles and could land on the hull — it passed with every style's branch collapsed into one. Calling the painter directly onto a blank backdrop removes both confounds at once (2026-08-25) |
| Measuring frame cost | **Canvas 2D calls are queued**, so timing a loop of `update()`/`draw()` measures the enqueue and nothing else — it reported 1.43 ms/frame for a scene that was really at 33.3 (2026-08-24), and `getImageData` does not reliably force the flush either. The only honest measurement is **rAF deltas on a live, presenting page**: `.claude/scripts/frame-budget.cjs`. The result is quantized to vsync (16.7 = inside budget, 33.3 = missing every second frame), so it says whether you are over, never how much headroom you have — for that, bisect by stubbing pieces out (`window.drawFoo = () => {}`) and see which removal brings a red page back under. And never copy the screenshot tools' launch flags into a perf tool: `--use-angle=swiftshader` (which they need so WebGL pages render at all) drags the 2D canvas onto software rasterization too, and takes the same page from 16.7 ms to 50.0 ms |
| Audio | WebAudio-synthesized only (no audio files): lazy AudioContext on first gesture (iOS), `sfxGain`/`musicGain` masters, oscillator/noise SFX + lookahead-sequencer music loop, persisted 🔊/🔇 mute top-left, suspend on `visibilitychange` (SFX+music standard for **every** game — retrofitted repo-wide 2026-07-24). Shared buffers (noise etc.) are created in `audioInit`, never lazily inside one SFX (another consumer stays silent); overlay/menu tap handlers call `audioInit()` too — the first iOS gesture is usually a DOM button, not the canvas |
| Back button | Every game has a top-left ← link back to the games hub, left-most control, mute button immediately to its right — see § Hub Back Button |
| Third chrome button | A game adding a **third** top-left control (a ⚙ settings cogwheel, typically) pushes the row out to ~x=140. Any canvas-drawn HUD sitting at x<140 in the top ~42 px is then *behind* it — opaque `var(--panel)` buttons, so the text simply disappears. The two fixes are *beside* the chrome or *below* it, and which one applies is arithmetic, not a rule of thumb. **Beside** works when the left block is genuinely short and the right block is right-aligned with room to spare: Ember Depths draws `DEPTH n` / `◈ gold` from x=148 (~75 px wide at 13 px Black Ops One) against an HP bar whose left edge is at 238 on a 390 px screen. So measure it — `measureText` the left block's widest state against the right block's left edge — and make the right block **shrink itself** (`bw = Math.min(150, W - 250)`) so the gap survives a narrow screen; a fixed-width right block just moves the collision to the small viewport instead of removing it. **Below** is the fallback for when they cannot both fit: Star Surge's stage/score line is ~150 px and right-aligned, so there is no beside to move it to. Star Surge had been drawing "SECTOR" under the mute button since before the cogwheel existed, unnoticed — check the collision when you add the button, not after a report |
| Scrolling overlays | A full-screen `#overlay` that is a **centred flex column and also scrolls** (`justify-content:center` + `overflow-y:auto`) **clips its own overflow at the top**: content taller than the viewport begins *above* the scroll origin and cannot be reached at any scroll position. No scrollbar hint, no error, no console warning — the rows are simply gone, and the ones that go first are the ones at the top (a heading, a character's name, the first row of a list). Nearly every game here uses exactly that shape, so assume it applies until swept. The fix is **structural**, not a class each tall screen opts into — ember-depths shipped the opt-in version first and the screen that was actually clipping turned out to be the **title** screen in landscape, with `EMBER DEPTHS` 9-24 px out of reach on every phone size tested (2026-08-27). Three lines, no opt-in: `#overlay{justify-content:flex-start}` + `#overlay>:first-child{margin-top:auto}` + `#overlay>:last-child{margin-bottom:auto}`. Auto margins absorb the slack, so short content still centres exactly as it did before; once there is no slack they collapse to zero, so tall content pins to the top with every row reachable. Assert it rather than eyeballing it: for each overlay screen, at several viewports **portrait and landscape**, set `overlay.scrollTop = -9999` and require `first.getBoundingClientRect().top - overlay.getBoundingClientRect().top >= 0`. Both orientations, because they clip different screens — the long ones (a camp, a shop, a stats list) overflow in portrait, the short ones only in landscape. Reference: `ember-depths/`, swept by `.claude/tests/drive-ember-depths.cjs` |
| Assists that delete the system | An automatic convenience that also removes the **decision** removes the mechanic it was helping with. Ember Depths' tap-to-move auto-path treated any visible trap as a wall, so every hazard on the board was routed around for free — traps could only ever catch a player who walked onto one on purpose, and six trap types, a status system and a whole skill node were paying rent on a mechanic that cost nothing to ignore (2026-08-27: made blind to traps, and avoiding one is the player's work again). The tell is that the assist fires on the same input as the ordinary action, so the player never chooses it and never knows it happened. Ask of any auto-aim, snap, magnetism or pathing assist: **what decision does this take away, and is that decision the game?** Keep the assist where the removed decision is busywork (a path around a *wall* is not a choice); drop it where the decision was the point. And when you drop one, give the newly-possible failure an interrupt — springing a trap now clears `pathQueue`, because five of the six do no damage and would otherwise not stop the walk at all |
| Simulated agents: role flags | **When an entity's role flag can change at runtime, the state machine must release it from any role-exclusive state.** Fire-clicker's `syncVillagers()` re-flags `v.keeper = i >= popCap()`, so buying a RECRUIT demotes the villager at the old boundary from keeper to worker — and left it standing in `keeperWait`, a state nothing but a keeper can exit. **Every recruit bought after a firekeeper permanently retired one villager** (8 of 13 idle by day 30, 2026-08-28). Nothing on screen showed it: the villagers stood around the fire, which is exactly where a keeper belongs, and no rule test caught it because no rule was broken. The only signal was an aggregate that did not match arithmetic — a measured work cycle 32% longer than the model predicted. Release on the transition (`if (k !== v.keeper) { v.keeper = k; vRelease(v); v.state = 'idle'; }`), and assert the invariant directly rather than trusting that it is obvious |
| Rewarding skill (idle/incremental) | Whether skilled play actually pays is **measurable, and usually worse than it feels**: fire-clicker's optimal and naive personas arrived within **6% of each other** after thirteen simulated hours, which is the shape of a game where nothing the player does matters and is invisible from inside a single playthrough. Two personas measured against each other are a better instrument than either alone (`.claude/tests/eval-<slug>.cjs`). The fix that generalises: give the active player a bonus **the automation structurally cannot earn** — not a rule that says "no bonus for idlers", but two numbers that cannot both be satisfied. Fire-clicker's ROARING FIRE pays a camp-wide speed bonus above 75% of the fuel bank while the auto-stoker only tops up below 35%, so an auto-tended fire never crosses the line (measured: 100% vs 0.4% of the run). Then **assert the gap** — a balance property nobody asserts regresses silently. Method: `.claude/notes/20260828-pacing-a-real-time-game-in-wall-clock-hours.md` |
| Chrome above overlays | The ← and 🔊 buttons must sit at a **higher z-index than any full-screen overlay** (menu / game-over / win). Give the chrome `z-index:80` and overlays `70`. Otherwise the overlay swallows both, and since music is usually playing *behind* a menu or win screen, the player cannot mute exactly when they most want to (2026-07-25: shipped that way in locksport, caught by a drive test that could not tap `#mute-btn` after a reload) |
| Portrait lock (optional) | A game whose layout only works in portrait can lock itself in software rather than reflowing: size the app shell to `innerHeight x innerWidth` and `transform: rotate(-screen.orientation.angle)` when a **touch** device goes landscape (leave a desktop window alone — clamp it to a centred portrait column instead). Two gotchas: `position:fixed` overlays must be nested *inside* the transformed shell or they stay landscape, and every pointer handler must un-rotate `clientX/clientY` about the element centre (a +-90 deg rotation keeps the bounding box centred on it) — `getBoundingClientRect().left` alone is wrong under a transform. `clientWidth/clientHeight` are layout sizes and stay correct. Reference: `neon-clash/` `applyView()` + `localPt()` |
| Native form controls | A `<select>` (or any native picker) must **not** be wired through a `bindTap`-style helper. Those helpers bind `touchend` with `preventDefault()` to stop iOS double-firing, and that stops the native picker ever opening. Listen for `change` and leave the tap helper off it (2026-08-23, neon-clash's style dropdown) |
| Graphics styles (optional) | A game may offer more than one art direction. The invariant is **a skin is paint**: nothing in the sim knows a skin exists, so a mid-match switch cannot change an outcome — assert that directly (same stats, costs, ranges and a real deploy's landing coordinates, byte-identical under both). In a game with no gameplay RNG the strongest form is cheap: run **one deterministic scenario per style, drawing real frames between ticks**, and require every gameplay number to come out byte-identical (turret-builder does this across five styles). Drawing between the ticks is the point — stepping the sim alone cannot see a draw function that writes to an entity, caches onto a tile, or moves the board geometry, which is exactly what a large skin system invites. Keep **identity counters out of the snapshot**: an entity id from a page-lifetime sequence differs between styles for bookkeeping reasons alone, and turret-builder's first version failed on four of five styles for that and nothing else. Two mechanics carry most of it: make `glow()` a **no-op** under a skin with no bloom rather than branching at its thirty-odd call sites (an effect written later in the neon idiom is then automatically right in both), and dispatch at the one shared sprite entry point so cards and drag ghosts can never drift from the thing they deploy. Chrome differs only by palette → a `THEME[skin]` table; the world differs structurally → alternate draw routines. **Past two styles, make the skin a TABLE, not a branch**: `SKINS[id] = {pal, turret?, creep?, module?, ...}`, one base palette that the others override key-by-key, and a live `SK`/palette pair reassigned on switch rather than looked up per call (the cel helper alone runs hundreds of times a frame). **Exception**: a style that only restyles ONE class of thing and deliberately shares an existing style's treatment for everything else needs no table — star-surge's 3D MODELS style changes hulls only, lands on the neon side of every existing binary branch on purpose (weapons fire is emissive whatever the hull is made of), and its whole dispatch is three `paintShip`/`paintEnemy`/`paintBoss` entry points; the table is for styles that restyle everything. When a **second** style joins that family, give the family a predicate (`meshGfx()`) and ask *that* everywhere scenery branches, rather than naming a style — star-surge's fourth style then needed no scenery edits at all. **A style may legitimately resize the art, and that is still paint**: star-surge flies the player at 3x and ordinary enemies at 2x with no hitbox moved, so a ship genuinely overhangs the box it is hit on. Two things follow. Make the scale **context-aware** — pass a `portrait` flag through the sprite dispatchers, because fixed art boxes (a character-select bay, a drydock, a logo baked out of hulls) will overflow or lose their legibility at 3x while the field is exactly where the oversize belongs. And grow the **chrome that rings a hull** (shield bubbles, status halos) by the same factor, or it disappears inside the art. Both are assertable off a painted bounding box — but assert them as **field vs framed within one style**, not style-vs-style: that resize began as one style's trait and the CD then asked for it in all five (2026-08-27), at which point the style-vs-style ratio read 1.00 and would have passed with the scale-up deleted from the file. Sweep every style even so, because one factor arrives by **three different mechanisms** — a geometry/mesh scale where hairline strokes must not thicken, a `ctx.scale` around a hand-drawn painter where the ink outline must, and a re-BAKE at the final size for a pre-rendered style (blitting a small bake bigger just ships a blurry hull, and a baked sheet's bytes go as the square of the scale, so the cache budget moves with it). Note `shadowBlur` ignores the CTM, so a glowing style's measured ratio lands a little under the factor (2.95 for 3) — band accordingly. Each override draws in the **local space its wrapper set up** — origin placed, contact shadow laid, HP bars and other rules readouts still the wrapper's — so a skin can change how a thing looks and cannot change where it is or what it reports. Two things are never a skin's to change: the **type colour** (it is how the board answers "what is that") and the **type silhouette** (hang furniture around the shared path; rotate the furniture to the heading and leave the identity shape unrotated). Turret-builder runs four cel skins that way (`toon`/`mech`/`steampunk`/`stoneage`). Scenery gets baked once from a seeded PRNG, never re-rolled per frame. And **counter-rotate the cel highlight out of the sprite's own frame** (`frameRot()` reads the rotation back off the live transform): a sprite drawn inside `ctx.rotate(...)` otherwise drags its light source round with it and reads as a flat shape, not a lit one. That one has now been missed by **both** independent re-derivations (star-surge's spinner, turret-builder's tracking turret — 90 deg of drift, fixed 2026-08-23), and it is assertable, not a matter of taste: paint the sprite at several rotations, walk a pixel ring inside a solid part, and require the brightest sample's bearing to hold still. Two follow-ups from turret-builder's four-skin pass: that sprite measurement **only bites where the skin swings a large lit body** (a thin cannon past a fixed boiler samples geometry that never rotates and passes whatever `frameRot()` returns), so also expose a hook that paints one **disc** through the cel helper inside a rotated frame — a disc is rotation-invariant, so the bright bearing can only move if the light does, and that tests the mechanism every skin shares; and prove a skin is actually wired by fingerprinting the **silhouette** with a minimum pairwise distance, because a skin whose shape override was never registered still hashes differently on colour alone, and a silhouette hash alone can differ by a single antialiased sample. A style with a **loadable asset** adds one more rule: separate the style that is *selected* from the style being *painted* (`look()`), so it can fall back to a complete style while loading and permanently on failure — and let the fallback style's predicate stay true for everything the new style has not overridden, so a half-ported skin still draws. A **3/4** style also needs depth sorting (back to front by board y) that flat top-down styles must not pay for. Full recipes: `.claude/notes/20260823-canvas-skins-and-cel-shading.md` (cel shading) and `.claude/notes/20260827-offline-prerender-pipeline.md` (baking 3D to sprites) — both deferring to the **`zmh-3d:sprite-prerender`** skill, which owns the runtime half and the rule that a sprite must be baked at the size it is blitted. Reference: `neon-clash/` |
| Pre-rendered art (optional) | When the art a style wants costs more per frame than the game can pay — low-poly meshes, multi-pass glow, heavy `clip()` stacks — but the set of distinct appearances is *enumerable* (N facings × M variants), bake it once into offscreen canvases and blit, the Clash Royale technique. The pipeline is a **loaded skill, not a copy in this repo**: invoke `zmh-3d:sprite-prerender` (zmhstudio plugin, enabled in `.claude/settings.json`) — it carries the cache-key rules, the LRU byte budget, symmetry-aware frame counts, what must stay live, the recorded-transform-track half for flattening a whole animated scene, and the test checks that keep a bake honest. Two headlines worth having before you open it: **the cache key must carry everything the bake read** (a hue-blind key serves last stage's palette forever, with no error anywhere), and **bake at the size you blit** (bytes go as the square of the art scale, so an art-scale change moves the budget too). Reference implementation: `star-surge/`'s SPRITESHEETS style; architecture in `.claude/star-surge.md` § The spritesheet kit. **Two variants now ship here and they are not interchangeable.** Star-surge bakes its own *live 2D painter* into offscreen canvases at load time — no asset, no build step, and the skill's cache/LRU/key rules are the whole story. Neon Clash bakes *actual 3D models* offline into a PNG atlas committed to the repo (`games/neon-clash/models/` → `sprites/`), which is what you want when the art could never be painted live at any price and when the CD wants to re-tune and re-render it later. Choose offline only if you accept its three costs: a shipped binary (so the single-file rule needs the baked-asset exception above), a style that can now *fail to load* (so it needs the `look()` fallback in the row above), and a build script someone must keep runnable. Everything else — bake at the size you blit, budget as the square of art scale, what stays live — is identical, and the skill is the authority. Offline-specific recipe: `.claude/notes/20260827-offline-prerender-pipeline.md`. If the plugin skill will not resolve in a fresh container, see `.claude/notes/20260822-zmh-plugin-bootstrap.md` — an installed plugin is pinned to the marketplace commit it came from, and a directory-source marketplace clone is never fetched at all, so `ls` of its skills is not evidence |
| Placement affordance (optional) | A grid game where the legal cells for the held piece are not obvious should say so **while you hold it** — armed by tap *or* mid-drag, both. Scrim every illegal cell and strike it with a red X, above the tiles (an occupied cell is an illegal cell, and marking only the legal ones answers "can I build on my own tower?" with an absence). Mark the legal cells **only when they are scarce** — turret-builder gates on <=22% of the board: eight legal cells need to glow, a hundred turn the whole map into a highlight and bury the terrain, and there the absence of an X is already the message. Caption the board with the rule in a few words while the piece is held. And where a placement rule and a wiring/adjacency rule both exist, **make them one function** — otherwise the board sells hardware that connects to nothing. Two rules about the art underneath it, both learned the same way: **if the rules are per-cell, every repeating rhythm drawn on the board must be per-cell too.** Turret-builder's road struck its paving joints every 0.72 cell measured *along the path* — a handsome road that silently taught the wrong grid, because a wall occupies one whole cell and the joints never lined up with one. Take the joints off the ordered list of cells the path passes through so each one is a real cell boundary, and delete any second rhythm (centre-line dashes, wear marks) that is spaced by distance rather than by cell. And **where things enter and leave, say so on the board**: an arrow on the first and last path cell, painted from the *path's own* palette so it reads as part of the road rather than as HUD — placed, ideally, on cells the placement rule already refuses, so the marking never competes with the affordance. Reference: `turret-builder/` (`hostFor()`, `placeMask()`, `drawPlaceOverlay()`, `pathOrder`, `drawPathEnds()`) |
| Build badge | Every game has a `<div id="build-badge">` right after `<body>` — see below |

---

## Build Timestamp Badge (SOP — required for every game)

Every game file (and `games/index.html`, the hub) has a small fixed-position
badge in the top-right corner showing when it was last built, so the page's
live version can be visually checked against what a session just shipped:

```html
<div id="build-badge" style="position:fixed;top:2px;right:6px;z-index:2147483647;font-family:'Courier New',monospace;font-size:9px;color:#888;opacity:0.55;pointer-events:none;letter-spacing:0.5px;user-select:none;">build YYYY-MM-DD HH:MM UTC</div>
```

It goes immediately after the `<body>` tag. `pointer-events:none` and the max
z-index keep it purely a visual watermark — it never intercepts clicks or
sits behind other UI.

**Whenever you create or edit any game file, as the last step before
committing:**
1. Get the current UTC timestamp: `date -u '+%Y-%m-%d %H:%M UTC'`.
2. Update that file's `#build-badge` text to the new timestamp (add the badge
   if the file doesn't have one yet).
3. **Read the badge back out of the file** and quote *that* string in your
   reply, so the user can compare it against what renders live once deployed.
   Read the artifact, never the stamper's own stdout: `stamp-badge.sh` printed
   `STAMPED` for two months while silently doing nothing to any badge whose
   text was not already timestamp-shaped, and Neon Clash shipped twice reading
   `build PENDING` behind that false green (2026-08-22, now fixed and
   self-verifying). A tool that reports success without checking its own effect
   is not evidence.

   ```
   grep -o 'id="build-badge"[^>]*>[^<]*' <file> | sed 's/.*>//'
   ```

   Corollary for **new** games: write the badge with a real timestamp from the
   start rather than a `PENDING`-style placeholder.

Excluded: frozen checkpoint files (e.g. `stick-commander-3d.v001.html`) —
they're intentionally never modified, so they don't get a badge.

---

## Hub Back Button (SOP — required for every game)

Every game page has a small left-arrow link back to the games hub as the
**left-most top-left control** (iOS-style back affordance); the 🔊/🔇 mute
button sits immediately to its right:

```html
<a id="back-btn" href="../index.html" aria-label="Back to games">←</a>
```

Root-level `games/<slug>.html` pages use `href="index.html"`; games in their
own subdirectory use `href="../index.html"`. Style it like the game's mute
button — a small fixed/absolute panel button (~38×30,
`background:var(--panel); border:1px solid var(--border); border-radius:8px`),
safe-area-aware offsets, `text-decoration:none`, and it must not overlap the
game's HUD or swallow gameplay input at the iPhone 13 viewport (390×844).

Games that predate this SOP (Basketball/Croissant Clicker, Horse Race, Piano
Tiles) carry a `#back-link` "← GAMES" text link instead — both forms satisfy
the rule; new games use the `#back-btn` form.

Excluded: externally-published games (`zed-shooter/`, `qntmchmst/` — their
source repos own their UI) and frozen checkpoint files.

---

## Games Inventory

### STICK WARS (`stick-wars.html`, ~1500 lines)
Wave-based brawler. Player character vs 10 waves of stick enemies. Collect coins,
unlock upgrades between waves. Canvas 2D, side-scrolling combat. ~60 functions.

### TOWN BUILDER (`town-game-1.html`, ~1000 lines)
Isometric town-building sim. Place buildings, grow settlement, manage resources.
Isometric grid projection, click-to-place mechanics. Lighter codebase (~6 functions).
Synth SFX + pastoral music loop.

### HORSE RACE (`horse-race.html`, ~735 lines)
Tap to drop carrots; four horses race to claim them. Tap-driven speed mechanic.
~16 functions; simpler state machine. Synth SFX + galloping shuffle music loop.

### PIANO TILES (`piano-tiles.html`, ~1515 lines)
Falling-tile rhythm game. Two songs (`kpopsong1`, `boss_fight_parade`) with `.md`
notation files and `.mp3` audio. Three difficulty levels. ~33 functions.
Audio files sit alongside the HTML in `games/`.

### SORCERY (`sorcery.html`, ~1200 lines)
Tower-defense with spells. Tap to fire ray spells, hold 1 s to place wall spells.
Wave-based enemy spawning, XP leveling, multiplicative upgrade system.
Detailed context: `.claude/sorcery.md`. Audit slash command: `/sorcery-audit`.

### STICK COMMANDER 3D (`stick-commander-3d.html`, ~2167 lines)
Top-down RTS-lite. Command stick-figure army across 50 waves. Recruit troops,
use abilities, defeat bosses including a Final Overlord. Largest game by line count.
~54 functions. Synth SFX + martial-march music loop. `stick-commander-3d.v001.html`
is a saved checkpoint.

### CROISSANT CLICKER (`croissant-clicker.html`, ~960 lines)
Cookie Clicker-style idle/incremental. Click to bake, buy 20 tiers of
buildings (Rolling Pin through The Eternal Oven), unlock click/building
upgrades and achievements, catch golden
croissants for bonuses. A Boosts tab has 3 independent repeatable purchases
(Money %, Speed %, flat Click Power). A dedicated Medals tab has unlimited
permanent Medals (Bronze through Diamond, then "Medal #6", "#7", ...) each
adding to both money and click power — +30/50/100/500/1000% for the first 5,
doubling forever after — gated by a separately-purchasable Medal Capacity
(starts at 5 slots); medals and capacity never reset, not even by Rebirth.
Rebirth grants Golden Butter (+30% click speed / +30% money each) based on
production since your last rebirth, and genuinely stacks across repeated
rebirths. A much deeper Big Rebirth (requires 10,000+ Golden Butter) converts
it into Chicken Croissants, each worth +900% money, compounding — i.e. each
Chicken Croissant is worth 10x a normal croissant's money contribution.
DOM-driven UI with a canvas overlay for click particles.
Detailed context: `.claude/croissant-clicker.md`.

### BASKETBALL CLICKER (`basketball-clicker.html`, ~2400 lines)
Cookie Clicker-style idle/incremental themed around building a basketball
program. Currency is money; click the ball to earn it. The RECRUITING tab has
a x1/x10/x100 bulk-buy toggle and 30 recruiter buildings (Clicker's auto-click
special item through The Basketball Singularity). 51 one-time upgrades span
Click Upgrades, Player Types, Assistant Coaches, and Mutations (each targets
click power, passive income, or both) plus Facility (building-tier) upgrades.
The UPGRADES tab shows only the single next unpurchased upgrade per
category — visible even when locked, with its unlock requirement shown —
rather than a full list. Mutations are themed as a sequence (Gold, Radiation,
Neon, Plasma, Crystal, Inferno, ...). A Fans tab sells 5 rarity-tiered fan
types capped by Stadium level; a Mascot levels up independently through named
tiers; a Totems tab mirrors Fans but boosts click power, capped by a
separately-levelable Totem Pole. Every 100 taps triggers a "Team Win" bonus.

The game is architected around a `SPORTS` registry so the entire content set
(buildings/upgrades/fans/mascot/totems/achievements) can be re-themed and
re-priced per sport: `applySport(key)` reassigns a set of `let`-bound "active
def" pointers (`BUILDING_DEFS`, `CLICK_UPGRADE_DEFS`, etc.) that every other
function already reads by name, so no other code needs to know which sport is
active. An ASCENSIONS tab (leftmost tab) lets a player who reaches 10
decillion ($1e34) lifetime earned in Basketball ascend into three full
parallel sports — Soccer, Baseball, and Football — all unlocked at that same
threshold. Each is the same mechanics with sport-flavored content, at 5x
basketball's costs/unlock thresholds (`EXTRA_SPORT_COST_MULT`). Every
unlocked, touched sport keeps its own state object in a `sportStates` cache
and earns passive income *simultaneously* and continuously — not just while
its tab is open — via `computeCpsForSport(st, sportKey)` and
`tickBackgroundSports()`, a parallel set of "For"-suffixed functions that
mirror `getCps()`/`getBaseClickPower()` etc. but take an explicit state+sport
pair instead of reading the mutable active-sport globals. `state` is always
an alias for `sportStates[currentSport]`. Switching sports plays a portal
warp transition (`playPortalTransition()`) and swaps in the target sport's
already-ticking cached state (or loads/creates it on first visit) rather than
re-reading localStorage, so in-memory background progress is never lost.
`save()` persists every cached sport, not just the active one. A global team
name (shared across all sports) lives on the Ascensions tab; naming it
"All-Stars" reveals an admin cheat panel (+100 of everything, x100 money,
unlock all upgrades, +10 levels, instant win, +1 decillion). Golden balls,
frenzy, and lucky-bonus text adapt to the active sport's theme. DOM-driven UI
with a canvas overlay for click particles.

### MERGE DROP (`merge-drop/index.html`, ~590 lines)
Suika-style one-thumb physics merge puzzler. Drag to aim, release to drop;
same-tier orbs merge and grow through 11 tiers, chained merges multiply
points, overflow past the danger line ends the run. Fixed-substep circle
physics with per-tier pre-rendered orb sprites. First game in its own
subdirectory. Synth SFX + mellow lo-fi music loop.
Detailed context: `.claude/merge-drop.md`.

### NEON GOLF (`neon-golf/index.html`, ~660 lines)
9-hole drag-back-and-release mini-golf. Holes are data entries in a fixed
100×160 unit space; hazards: walls, over-unity bumpers, sand, water
(+1 stroke), boost pads, oscillating mover walls. Par scoring, scorecard,
best-round persistence. Synth SFX + clubhouse-lounge music loop.
Detailed context: `.claude/neon-golf.md`.

### NEON PINBALL (`neon-pinball/index.html`, ~800 lines)
Portrait pinball. Two-thumb flippers (screen halves), hold-to-charge plunger,
segment/capsule physics at 240 Hz substeps, one-way lane gate, bumpers,
slingshots, 3-target drop bank, rollover lanes, ball save, end-of-ball bonus
with multiplier, multiball. Detailed context: `.claude/neon-pinball.md`.

### GRAVITY RUNNER (`gravity-runner/index.html`, ~600 lines)
One-thumb endless runner: tap to flip gravity between floor and ceiling,
dodge spike/gate/block patterns (procedural, always survivable), collect
orbs, speed ramps forever. Distance+orbs scoring, best persistence.
Detailed context: `.claude/gravity-runner.md`.

### BRICK BREAKER (`brick-breaker/index.html`, ~700 lines)
Arkanoid-style. Drag-anywhere paddle, tap to launch; 8 ASCII-map levels that
loop with rising speed; normal/armored/steel/explosive/power-up bricks;
falling power-ups (wide, multiball, laser, slow-mo, extra life). 3 lives,
best-score persistence. Detailed context: `.claude/brick-breaker.md`.

### NEON SNAKE ARENA (`snake-arena/index.html`, ~600 lines)
Smooth analog snake: hold+drag virtual joystick steering, breadcrumb-path
body, combo-multiplier orb eating, timed gold orbs, telegraphed mine
hazards, wall/self death. Best-score persistence.
Detailed context: `.claude/snake-arena.md`.

### GATE BREAKER (`gate-breaker/index.html`, ~2500 lines)
Dungeon-crawler RPG: character progression, combat, gear systems, boss
battles, six save slots. No dedicated `.claude/` context file yet.

### NEON SLICE (`neon-slice/index.html`, ~730 lines)
Fruit-Ninja-style swipe slicer. Gems arc up in volleys; fast swipes slice
(blade-speed threshold), one-swipe chains bank combo bonuses with slow-mo,
bombs cost a life, dropped gems cost a life (3 hearts), frenzy volleys.
Detailed context: `.claude/neon-slice.md`.

### BUBBLE BLASTER (`bubble-blaster/index.html`, ~870 lines)
Endless hex-grid bubble shooter. Drag-aim with one-bounce dotted guide +
snap-cell ghost, 3+ pops, detached clusters fall for 2x, streak multiplier
x1–x5, board drops a row every 6 shots, color unlocks at score milestones,
colorblind glyphs baked into sprites. Detailed context: `.claude/bubble-blaster.md`.

### BLOCK FIT (`block-fit/index.html`, ~750 lines)
1010!-style drag-and-place puzzle. 9×9 board, 3-slot tray, 19-shape piece
set, dragged piece floats 90 px above the finger with green/red snap ghost,
row+column clears with streak bonuses, no-dead-deal dealing, out-of-moves
game over. Detailed context: `.claude/block-fit.md`.

### SKY HOPPER (`sky-hopper/index.html`, ~790 lines)
Doodle-Jump-style vertical bouncer. Auto-bounce, hold+drag relative
steering with screen wrap, static/moving/crumble platforms + springs,
gold orbs and comets, upward-only camera, reachability-guaranteed
generator, milestone hue shifts. Detailed context: `.claude/sky-hopper.md`.

### NEON STACK (`neon-stack/index.html`, ~715 lines)
Tap-timing tower stacker. A slab slides above the tower; tap to drop,
overhang slices off as debris, perfect drops (±2.5 u window) chain combos
and every 3rd regrows width. Speed ramps to a hard cap; zero overlap ends
the run. Synth SFX + synthwave music loop. Detailed context: `.claude/neon-stack.md`.

### BLADE SPIN (`blade-spin/index.html`, ~950 lines)
Knife-Hit-style timing thrower. Tap to hurl blades into a spinning disc;
hitting stuck blades/spikes ends the run, gems are bonus pickups. Four
deterministic rotation patterns, seeded per-level layouts, boss discs every
5th level; every boss level is a persisted checkpoint (die → restart from
checkpoint or start; start screen offers any reached checkpoint). Synth SFX
+ percussive music loop. Detailed context: `.claude/blade-spin.md`.

### NEON CROSSING (`neon-crossing/index.html`, ~1080 lines)
Crossy-Road-style endless lane hopper. Tap/swipe hops across grass, roads,
log rivers, and rail lines; auto-scroll camera with idle pressure; fairness-
guaranteed row generator (car gaps, log cadence, rail warnings). Synth SFX +
chiptune music loop. Detailed context: `.claude/neon-crossing.md`.

### NEON AIR HOCKEY (`air-hockey/index.html`, ~900 lines)
Vs-AI air hockey on a portrait neon table. Drag mallet, 240 Hz substepped
puck physics with rounded corners + goal posts, three AI difficulties
(speed/reaction/aim-error table), first to 7; per-difficulty W-L record.
Top-HUD toggle for local 2-player mode (multi-touch, second finger owns the
top mallet; AI + records off). Synth SFX + arena music loop. Detailed
context: `.claude/air-hockey.md`.

### TURRET BUILDER (`turret-builder/index.html`, ~4000 lines)
A tower defense in which **the turret is the smallest part**. A turret is a
plain gray triangle — 10 kinetic damage, once a second, 100% hit chance, and
it never changes; it tracks its target continuously and snaps to the next the
instant that one dies or leaves range. Everything dangerous is a tile bolted
around it. **A shot builds one payload and copies it outwards:** AMP
multiplies its kinetic damage, FIRE adds a 5-second burn, ICE adds chill
(movement *and* attack speed, no damage at all), ELEC copies the payload onto
the next enemy, BLAST copies it over a radius. **Damage decays as it is
copied; effects land at full potency** — which is why ICE, dealing nothing
itself, is worth a slot. Stack curves are super-linear, so going all-in on one
type is genuinely stronger and variety buys coverage instead of throughput.
The one structural rule: **a module feeds every turret AND wall it touches**,
so one tile between two turrets pays both. **Diagonal boosters** (TWIN, PRISM,
RELAY, CLOCK) lift a turret from the corners the modules cannot reach. Fill
all four sides in the right pattern and you get a **named combo** — fifteen
of them, rotation-invariant, from INCENDIARY GRENADE LAUNCHER to TESLA COIL —
announced with a banner, marked by a pulsing outline, and kept in a codex that
persists across runs and never lists what you have not built. **Walls** go on
the road; creeps stop and hit them, and a road cell's two free sides take
modules too, plus wall-only ARMOR and REGEN. Counter-play: flat armour eats
kinetic and **scales with the campaign floor**, percentage resist eats
elemental and does not. Two currencies (per-level cash, persistent cores for a
ten-track LAB whose GRID tiers buy turret slots), a three-tab build bar for
thirteen placeable kinds, eight levels of eight waves at ~8 minutes each, then
endless. **No gameplay randomness at all.** A ⚙ in the top-left chrome picks
one of **five graphics styles**: four cel skins — TOON (the default),
MECH (autocannons on tracks, armoured vehicles and walkers), STEAMPUNK (brass
boilers, cog boosters, clanking automata) and STONE AGE (cavemen hurling rocks
dipped in cauldrons of fire, ice and lightning, so the shot carries the colour
of the module the turret carries most of) — plus NEON, the original wireframe
board. The ground is **grass and nothing else**; the only thing on the field
that is not grass is a boulder, which is the only thing you cannot build on.
The road is paved with a **joint on every grid line it crosses**, so one road
cell reads as the one wall slot it is, and an **arrow on its first and last
cell** says which way the creeps come in. **Placement is taught, not guessed**: a
module must sit orthogonally beside a turret or wall and a booster diagonally
beside a turret — the board refuses anything that would feed nothing — and
while a card is armed or dragged, every illegal cell is scrimmed and struck
with a red X under a caption naming the rule. Detailed context:
`.claude/turret-builder.md`. Suites: `.claude/tests/drive-turret-builder.cjs`
(206 rules checks, the spec asserted to the decimal off a damage ledger, all
five renderers driven through real frames, the cel sun measured off pixels
both on a tracking turret and on a bare probe disc, and the road, its arrows
and its grass measured off pixels too) and
`.claude/tests/eval-turret-builder.cjs` (22 balance claims via personas).

### GRID DEFENSE (`grid-defense/index.html`, ~2300 lines)
A **ten-level tower-defense campaign**, then endless. A level is one map and
ten escalating waves ending in a WARDEN — 100 waves in all — and the board
persists across a level's waves, so upgrading a placed tower is worth doing.
**Nothing waits on a tap**: grace → wave → gap → level clear runs on timers,
with transparent canvas toasts for feedback. Turrets place two ways — **drag** a card
onto a tile, or **tap** the card to arm it and tap the tile — with spec'd
silhouettes: green triangle PULSE, red circle NOVA, blue snowflake FROST,
purple spike RAIL, introduced one per wave across waves 1-4. **One of each may
stand on the field to begin with**; every armory tier buys one more slot and
the COMMAND tree buys slots across the board, so which turret and where is the
whole game. ENGINEERING's POWER GRID makes orthogonal neighbours (never
diagonals) boost each other — same type share stats, different types trade
traits. Three currencies:
per-level cash for placing and upgrading, persistent **cores** for the armory
(8 permanent tiers per turret), and persistent **skill points** for three
branching trees (OFFENSE / ENGINEERING / COMMAND, the last granting active
abilities); both open at wave 5 and are reachable from the HUD any time.
Lives refill each level and running out replays the level as often as needed —
but the failed attempt is rolled back whole and banks nothing, so the top-ten
board ranks score and shows retries. Endless has no retries. Wave HP is a sawtooth (steep across a
level, boss spike, next level opens easier on a higher floor) calibrated
against strategy personas — including one per skill tree, since **any single
tree must be able to clear the campaign alone**. Detailed context: `.claude/grid-defense.md`. Suites:
`.claude/tests/drive-grid-defense.cjs` (rules) and
`.claude/tests/eval-grid-defense.cjs` (balance).

### STAR SURGE (`star-surge/index.html`, ~3630 lines)
Vertical shmup with a full build-your-ship progression layer. 3 save-slot
**pilots** (`starSurge.saves`), each with its own XP bank, unlocked
weapon/armor, and sector checkpoint — pick a slot to try a different build.
The **title screen** is canvas, not overlay HTML: the word is spelled in enemy
hulls from a 5×9 bitmap font, a procedural 3D dogfight runs behind (and
sometimes in front of) it, and three bays on the bottom edge are the pilot
slots, each erased by holding the bin beneath it. **Five graphics styles**
behind the ⚙: 3D ANIMLIGHT (**the default** — meshes in a vivid
palette, every hull running a rig of animated lights), 3D MODELS (the same
meshes, worn metal, no lights), SPRITESHEETS (that art pre-rendered to sprite
frames), cel/toon, and neon. **Every** style flies the field hulls oversized —
player 3x, ordinary enemies 2x, dropped crates 1.5x, bosses and framed hulls
untouched, and no hitbox or pickup reach moved with any of it. The shield and the
powerups are skinned per style too, with neon as the baseline the other three
depart from; shields cap at 2 charges. **There is no menu screen**:
picking a pilot opens its station, and UPGRADES / COMBAT / REST all leave from
and return to it
(REST goes back to pilot select and banks the run, which resumes exactly
where it was left; only dying ends a run). A **sector** is 5 stages × 3 waves, each stage ending in a
mini-boss, the whole sector capped by one harder, longer **sector boss**
(2.6× the toughest mini-boss's hp, wider spread, denser rings); 11 sectors,
difficulty-scaled by `campaignDifficulty()`. Dying always restarts the
*current* sector from stage 1 — XP and shipyard purchases are never lost,
only run progress. Clearing a sector does **not** roll straight into the
next: it stops for a **combat report** (grade, kills, accuracy, hits taken,
streak, time, XP, salvage, sector and total score), a tap-to-dock **launch**
animation, and an **allied station** — a canvas scene with four callout
buttons wired by line to the thing they do (UPGRADES→garage, COMBAT→the
hostile sector in the distance, REST→barracks, REPAIR→drydock). The station
is where a new player is first shown the shipyard, and it carries the game's
second currency: **credits** buy hull repair, **XP** buys permanent build. Ship has hp (no more lives, enemy hp/incoming damage both scale with
`campaignDifficulty()`) plus one equipped **armor** (regenerative /
recharging shield / flat damage-reduction plating) and one equipped
**weapon build** — blaster (free), beam, flamethrower, bombs, missiles,
bolas, chain lightning, or EMP, each a genuinely different playstyle
(piercing line, close-range cone, AoE splash, homing, slow-on-hit,
multi-target arcs, anti-bullet pulse) — unlocked and tiered up via XP
earned from kills/bosses in the in-game **Shipyard**. The permanent XP tier
sets a weapon's quality (dmg/dps/radius/turn-agility); the in-run P powerup
is a separate quantity/area axis — more barrels/beams/cones/chain-jumps, or
EMP's blast radius — with fire rate held constant so the player's own
tap-fast-vs-hold-steady cadence stays the only attack-speed knob. Bombs
alternate the pip bonus between an extra bomb and a bigger blast (with a
layered amber/orange/red "molten debris" particle burst that scales with
blast radius); chain lightning starts at zero jumps and gains two more per
pip; missiles have a per-tier minimum turn radius so they can't loop onto
any target regardless of aim. Ship can fly almost to the top of the screen
(not just the lower 65%), so short-range weapons can reach high-holding
enemies. The four styles behind the ⚙ (roster above) each carry the whole
screen, not just the hulls. **CEL / TOON** flat-shades in a base tone, bands
the lit side once and inks an outline, giving each craft a nameable silhouette
— steel interceptor, bladed scout drone, arrowhead gunship, four-blade
rotorcraft, armoured freighter, capital-ship boss under a rotating rim of gun
barrels. **NEON** is the original wireframe look, kept intact, and is the
baseline the other three depart from. The **mesh family** (`meshGfx()` —
3D MODELS and 3D ANIMLIGHT) renders every hull as a real low-poly mesh banking
into its turns (bank derived painter-side from each hull's own motion, stored
in a WeakMap so the sim stays byte-identical), gives the station's shared shape
primitives a lit-metal treatment, and swaps the title dogfight's billboard for
true per-vertex perspective; **ANIMLIGHT** adds a vivid palette and a rig of
animated lights on every hull (it also introduced the 3x/2x field hulls, which
went universal 2026-08-27). The choice persists per browser. Drones/shooters/spinners/tankers, P/S/G powerups (in-run
weapon-tier boost, shield charge, surge bomb), stage-hued enemies.
20-track adaptive soundtrack
(webaudio-score/v1 data + compiler + look-ahead scheduler): one track plays
per whole stage (through its mini-boss), the sector boss gets its own
more-intense track, both pools round-robin across sectors, `NN · TITLE`
now-playing label — see `.claude/scripts/star-surge-music/` to refine a
track. Detailed context: `.claude/star-surge.md`.

### NEON TACTICS (`neon-tactics/index.html`, ~700 lines)
Turn-based squad tactics, 7×9 grid: 2 strikers, sniper (Bresenham LOS,
walls block), tank, medic vs a mirrored squad. Move+act per unit, seeded
mirrored wall layouts, destroy the enemy core (8 HP) or wipe the squad.
Greedy scored AI with exposure penalty; 2P pass-and-play with handoff
screens; vs-AI W-L record. Detailed context: `.claude/neon-tactics.md`.

### WORD CIRCUIT (`word-circuit/index.html`, ~660 lines + 31 KB dictionary)
Drag-connect word hunt on a 5×5 Big-Boggle grid. Seeded DAILY board (same
for everyone, UTC-dated) + free play; 90 s rounds; solver-computed
found/total; backtrack undo; missed-gems reveal. Embedded curated ~5.3k-word
dictionary. Detailed context: `.claude/word-circuit.md`.

### NEON TRIPEAKS (`tri-peaks/index.html`, ~620 lines)
Classic 28-card tri-peaks solitaire. Tap uncovered cards one rank up/down
from the waste (K↔A wraps); streak bonuses, peak-clear bonuses, leftover
stock pays out on a win. Fairness-checked deterministic deals; seeded
DAILY DEAL + free play. Synth SFX + swung lounge music loop. Detailed
context: `.claude/tri-peaks.md`.

### SHADOW CIRCUIT (`shadow-circuit/index.html`, ~700 lines)
Top-down stealth-maze. Tap-to-move BFS pathfinding through procedural
mazes; guards patrol with LOS vision cones (patrol → chase → returning
state machine), shadow tiles hide a still player. Collect all cores, reach
the exit; ghost bonus for alarm-free floors; 3-life runs, endless floors.
Synth SFX + tense pulse music (hats surge while chased). Detailed context:
`.claude/shadow-circuit.md`.

### NEON RECALL (`neon-recall/index.html`, ~640 lines)
Pair-matching memory board. Solo: round campaign on a mistake budget
("scans"), streak scoring, growing grids, one hidden power pair per round
(peek / +2 scans / bomb). Versus: 9-pair pass-and-play hot-seat — match
keeps the turn, odd pair count means no draws. 15 canvas-drawn vector
glyphs. Synth SFX + marimba-ping music loop. Detailed context:
`.claude/neon-recall.md`.

### NEON DRIFT (`neon-drift/index.html`, ~700 lines)
Top-down drift time-trialer. Hold left/right screen halves to steer an
auto-accelerating car through 3 Catmull-Rom circuits (sequential unlocks);
grip-lag drift physics, mud-slow rough, anti-cut lap tracking, per-track
best time + ghost replay, engine-pitch oscillator + synthwave loop.
Detailed context: `.claude/neon-drift.md`.

### ALPINE ASCENT (`alpine-ascent/index.html`, ~900 lines)
Charge-jump mountain platformer (Jump-King-like). Hold to charge, drag to
aim (dotted preview arc), release to leap; one fixed seeded mountain, 6
camp checkpoints to the summit; ice slides, crumble ledges respawn, wind
above the cloud line bends jumps. Falls cost altitude only. Realistic
rendering: altitude-graded skies, parallax ridges, god rays, cloud-band
fog, snow, textured ledges. Camps + summit persisted.
Detailed context: `.claude/alpine-ascent.md`.

### VAULT BREAKER (`vault-breaker/index.html`, ~900 lines)
Pinch-rotate safecracking. Two-finger twist (or one-finger drag-around)
turns the mechanism through three phases per vault: directional tumbler
pins with steady-hold sweet spots and Geiger proximity ticks, ring-gap
alignment to the keyway (later rings drift), then a 270° handle spin —
all against an alarm timer. Seeded deterministic vaults, star ratings,
level unlocks persisted. Realistic rendering: brushed-steel door with
rivets, anisotropic machined dial, sparks, gold-vault door-open payoff.
Detailed context: `.claude/vault-breaker.md`.

### GOLDEN REEL (`golden-reel/index.html`, ~980 lines)
Dusk-lake fishing. Hold-charge cast (line gear caps range), tap-twitch,
0.9 s hook-set window, then a reel/release tension fight (runs take line,
calm reels it back; snap vs land). 8 species in distance zones with
lure-gated rares; coins buy rod/reel/line/lure upgrades; persistent
catch log (count + best weight). Realistic rendering: layered sunset,
sun-glitter water, ripple rings, silhouette fish, rim-lit angler.
Detailed context: `.claude/golden-reel.md`.

### EMBER DEPTHS (`ember-depths/index.html`, ~1030 lines)
Turn-based torchlit roguelike. Tap-to-move BFS pathing on an 11×16 grid,
bump combat, permadeath; drunkard-walk floors, depth-scaled enemies
(slime/bat/archer/brute/wraith), relic-build chests, stairs-down runs.
Realistic rendering: pre-rendered stone textures, half-res light map with
flicker + ember particles, memory fog. Best depth/gold persisted.
Detailed context: `.claude/ember-depths.md`.

### METEOR DEFENSE (`meteor-defense/index.html`, ~1130 lines)
Missile-Command-style tap interceptor. Blast rings chain through meteors
(splitters, comets, UFOs) falling on six neon buildings; per-wave ammo
budgets, intermission bonuses, mercy rebuild every 5th wave. Synth SFX +
tense sequencer music. Detailed context: `.claude/meteor-defense.md`.

### WAYFINDER (`wayfinder/index.html`, ~1150 lines)
First-person 3D orienteering sim, and the repo's only WebGL page. A 1 km valley
— forest, marsh, a meandering river with a beck, tracks, a stone wall and a
148 m climbable Beacon Hill — under a 24-minute day/night cycle. You navigate
with an ISOM-style map generated from the same heightfield the world is built
from, and **there is no "you are here" dot**: you keep your place by dragging a
thumb marker. Baseplate compass with real magnetic declination, "red in the
shed" alignment, and pace counting. Nine lessons teach real technique in club
order (orient the map → handrail → thumbing → bearing → pacing → aiming off →
contours → attack point → night relocation). **Each lesson requires its
technique** — arriving at the control without following the handrail, holding
the bearing, counting the paces, aiming off or using the attack point is refused
with coaching, so lessons cannot be passed by luck. A coach names a technique
(never your position) when you stall, and you can pencil marks on the map and rub
them out. Then the valley opens for free roam. Terrain and land type
are baked into grids at boot so rendering, collision and the map can never
disagree. Detailed context: `.claude/wayfinder.md`.

### BALLPARK (`ballpark/index.html`, ~640 lines)
Estimation trivia — no multiple choice. Every question has a numeric answer
and a log or linear dial; drag anywhere in the thumb band to move the needle,
LOCK IN, and score by how close you landed (distance along the dial, not
relative error). 100+ questions across 8 categories, 10 per run, streak
multiplier to x3, +500 bullseye. Seeded DAILY TEN (same for everyone, UTC
date) + free play; personal best and daily results persisted. Synth SFX +
game-show shuffle loop. Detailed context: `.claude/ballpark.md`.

### TILT LABYRINTH (`tilt-labyrinth/index.html`, ~640 lines)
The wooden hole-maze. Tip the phone (`deviceorientation`, iOS permission
requested on ROLL, auto-levelled to however you hold it) or drag anywhere as
a fallback — both write one tilt vector. A steel ball rolls on a 100×140 oak
board past holes into a brass cup; slow balls drop in from a rim, fast ones
skim it, dead centre always swallows. 10 hand-authored boards (first roll →
spiral → gauntlet), star ratings by time and falls, sequential unlocks +
board picker. Realistic rendering: grained oak, raised walls with tilt-thrown
shadows, specular steel ball, spirit-level bubble. Detailed context:
`.claude/tilt-labyrinth.md`.

### LOCKSPORT (`locksport/index.html`, ~640 lines)
Realistic side-view single-pin-picking sim. Tension is auto-applied (a
left-thumb tension pad appears from the spool levels on); drag a hook/rake in
the probe zone to feel the binding pin, ratchet it up under friction, and set
it at the shear line — overlift jams it, RESET drops every pin. Spool drivers
false-set with a plug over-rotation you beat by easing tension into a green
band (counter-rotation); serrated drivers give deceptive mini-clicks. 12-lock
practice path (1 pin → 6-pin all-security OLD IRON), zen + 3-star rating,
level-select dropdown, seeded generator with an auto-solver fairness gate.
Realistic rendering: cutaway brass lock on a textured workbench, compressing
springs, steel/brass pins, machined dial, golden open payoff. Detailed
context: `.claude/locksport.md`.

### SKY LANTERN (`sky-lantern/index.html`, ~830 lines)
The repo's first **microphone** game. Blow into the phone to fire a paper
lantern's burner and climb a festival night sky to the wish line; heat lags
breath both ways, so you breathe early and coast. Thumb-drag steers; hold-
anywhere is the automatic fallback when the mic is denied. 6 seeded ascents,
bamboo poles / temple eaves / kites / bird flocks / gust bands, ember refuels,
3 tears and it burns through. Three generator fairness gates: corridors exist,
corridors are *reachable* (solved from the real equation of motion), and moving
hazards never seal the sky. Detailed context: `.claude/sky-lantern.md`.

### PHASIC (`phasic/index.html`, ~2460 lines)
Phase-change block sort, and the repo's first soft-body simulation — also the
web-first prototype of a planned iOS title. Casual-first: most levels are
"bring order to chaos" tidying, with occasional clever ones. Gems are
clusters of beveled squares (8 colors, 1–5 cells, fixed shapes, **no
rotation**); the level clears when every gem rests SOLID in its matching
socket (gems are never locked — anything can be dragged out or re-melted).
**Reversion model: phase = flame count** — flames melt solid→liquid→gas one
latched step at a time, and tapping a gem takes a flame back and cools it
one step (liquid needs room to crystallize or the flame stays); frost is a
thrown quench that removes a flame without being consumed. The gravity well
lives in a middle GRAV bucket — docked means plain down, on the ring it is
a point source (liquid falls toward it and can be LIFTED over walls; gas
flees it along a reachable-height guidance field — how it finds flues).
**Curriculum: one new idea every 8 levels** — drag, flames, gravity+gas,
liquid base state, gas base state, then obstacles (black hole consumes and
forces a retry; bushes stop stone and drink liquid but pass vapor; fans
blow only gas) — 24 authored tutorials/set-pieces, every other level
generated with that block's factor set and a formalized complexity score
on three board templates (drawer, two-shelf, gas attic) with hazards woven
into the solution path in the obstacle blocks,
endless past 64, each generated level beaten by the in-game solver before
it is served. STUCK (settings) replays the solver script as a visible ghost; a WIKI button beside it opens the searchable in-game wiki (games/phasic/wiki.html, 12-tactic registry). 10 seeded generative
songs (titled; dim `NN · Title` now-playing line at the very bottom),
separate music/SFX volume + mutes. Settled puddles get a footprint-scaled
freeze reach (resting-gated, ≤2.6 cells — the flat 1.9 cap structurally
refused every settled 3-tall gem); layout self-heals against
degenerate-viewport squish (CELL≥1 floor + relayout on rotation/
visualViewport events); landscape puts the buckets in a right-side column;
buckets ride half a height above the iOS swipe-up edge. **games/phasic/ is
proprietary** — its own LICENSE (settings-cogwheel link, wiki footer); the
root-LICENSE scope-exception era ended 2026-08-28 when licensing went
per-directory (root CLAUDE.md § Licensing). Drive suite (289 checks
incl. the generated-content replay gate, the in-path weave gates, the
complexity-ramp assert, rotation/landscape geometry checks and the
settled-freeze regressions):
`.claude/tests/drive-phasic.cjs`. Detailed context: `.claude/phasic.md`
(includes the maintained tactics registry).

### FIRE CLICKER (`fire-clicker/index.html`, ~1600 lines)
A snowy-village fire-keeping sim, CD-commissioned 2026-08-28 and explicitly
NOT built on the croissant/basketball shop-list template. One rendered scene:
stylized-cartoon snowfield, two straw houses, an unlit central campfire ringed
by log seats. Tapping the fire raises a mote of light from the tap point and
banks burn seconds (1 s/tap, 5 s cap, both upgradable) that count down from
the moment they land. Pacing is measured rather than guessed — a day is 5 real
minutes, and `.claude/tests/eval-fire-clicker.cjs` plays two scripted personas
through the shipped simulation to price every milestone in hours (village at 20 min
optimal / 55 min naive). Skilled play is deliberately rewarded: a fire held above
75% of its bank makes the whole camp work faster — a bonus the auto-stoker can
never earn — and MICROMANAGEMENT lets a player aim every villager at one
resource, together holding optimal play ~2.2x ahead of naive play. Villagers are simulated agents — while the fire burns
they haul wood/stone/food from work sites to the stockpile; cold, they huddle
on the seats (shivering, breath puffs) or hide indoors (windows glow, chimney
smoke). A 5-minute day/night cycle drives keyframed sky palettes and a
punch-hole darkness layer, so the fire realistically lights its surroundings
at night. Cel-shaded: flat colour bands + ink outlines on every building,
prop and villager. Upgrades (fire pit, tinder, windbreak, tools, recruits,
firekeeper auto-stoker that spends stockpiled wood) are paid in gathered
resources, from a toggleable bottom-right panel with its own scroll
container. Houses sleep 5 villagers each; BUILD HOUSE fills slots (5 at
CAMP), then FOUND VILLAGE shrinks the architecture to timber cabins (up to
10) with trodden paths and unlocks the tavern (+walk speed), general store
(+yield) and sawbones hut (+work speed). Town/city/metropolis, building
upgrade chains and ascension: `games/fire-clicker/TODO.md`. Drive suite:
`.claude/tests/drive-fire-clicker.cjs` (60 checks); pacing/balance eval:
`.claude/tests/eval-fire-clicker.cjs`. **Proprietary — no permissive license
in this directory** (one of the five protected games). Detailed context:
`.claude/fire-clicker.md`.

### SIGNAL HUNT (`signal-hunt/index.html`, ~790 lines)
The repo's first **async-versus** game. Eight rogue signals hide among ~350
decoys on a 1100×1900 circuit grid; each target is an exact shape+colour pair
and every decoy shares one attribute but never both (a conjunction search).
Drag to pan, pinch to zoom, tap to lock; decoy taps cost 4 s, empty grid is
free. 90-second rounds as DAILY GRID, FREE HUNT, or a duel: an 11-char
checksummed code carries seed + score, so a friend replays your exact grid and
the game reports the head-to-head. LABELS assist stamps a unique letter per
colour for a colour-free hunt. Detailed context: `.claude/signal-hunt.md`.

### NEON CLASH (`neon-clash/index.html`, ~2970 lines + `models/` + `sprites/`)
The repo's first **real-time card battler**, and its first **simultaneous**
local-2p game. One board split into halves; energy refills at 1/sec up to 20
on both sides; drag a tank (4), fighter (3), archer (3) or bunker (8) out of
your tray onto your own half — **or tap the card to arm it and tap the board**
— and it walks at the enemy base on its own. Aiming past the halfway line does
not refuse the card: it lands on your own side of the line at the same x, so a
bad aim costs position and never the card (only a release off the board
cancels). The same principle covers **footprint**: a building aimed where it
cannot stand — over the emplacement, onto another bunker, into an edge — slides
to the nearest legal ground rather than being refused, which matters most for
the 8-cost card in the deck. Each base mounts a **turret**: two archers' damage a shot, on an
archer's clock and at an archer's reach, measured from the base's rim so an
archer sieging it cannot sit outside the answer. A lone unit walked up to a
base now loses to the base — which is the counterweight to the siege lock
below, otherwise purely defender-favourable.
A bunker is a building holding two units — they stop moving, become
untargetable (the building eats the damage), fire through the slits at a
minimum range of 15, and are **ejected alive** when it falls.

A unit that lands its first blow on a **building** commits to it until the
building falls (`u.lock`, shown as a dashed tether) and will not turn on
defenders meanwhile — that siege lock is what makes an arrived push answerable
at all. A unit merely *marching* at a base has committed to nothing and still
diverts.

Cards are **typed** — `unit`, `building`, `spell` — and every rule branches on
the type, never on a card's name, because the deck is meant to grow. **Every spell is lobbed**: it leaves your own base, arcs up out of the screen
and lands **two seconds later** (`SPELL_FLIGHT`, the contract for every spell
added later, which is why it sits in `tryDeploy` and not in `castSpell`). That
delay is a real balance lever — a fighter covers nearly two blast radii in two
seconds, so a spell only lands on a mover if you lead it, and what it reliably
catches is a push the **siege lock** has already frozen in place.

Sudden death is a **ramp**: +1 energy/sec at 3:00 and another +1 every minute
after, topping out at 8/sec, with a 10:00 wall that awards the match on base
HP. A decided match plays a 3-second **finale** — losing base razed, winners
bobbing, fireworks — before the result screen; winner and reported HP are both
snapshotted on entry, so it is safe to skip with a tap. Five music tracks, one
per match, and the tempo scales with the energy rate.

The fifth
card is the first spell: **fireball** (5), an airburst on your own half whose
damage and knockback both halve from centre to rim, so it pays against a massed
push and barely dents a lone unit. It cannot touch a base, cannot hurt your own
line, and cannot reach a garrison through the bunker sheltering it.

The distinctive part is the second player: lay the phone flat on a table and
the far tray is drawn rotated 180° (`trayFlipped()`), so the player opposite
reads their own hand the right way up and deploys **at the same time you do** —
touches are routed by the tray they started in, so both drags run
independently. In vs-AI mode that tray deliberately stays upright, as the
opponent's readable roster. Three AI grades differ in think interval, an idle
chance, how reliably they counter, whether they build and man bunkers, and an
energy reserve they hold back.

It ships **three graphics styles**, picked from a dropdown behind a cogwheel in
the top-left HUD cluster: `neon` (the original glowing wireframe board), the
default `toon` — a cel-shaded cartoon arena of dirt and grass inside a poorly
maintained plank fence, with actual characters (a shield-and-sword knight, a
green-hatted archer, a twin-dagger rogue in dark red, a log-walled fort) — and
`sprite`, the same cast **modelled, textured, normal-mapped, lit and baked
offline** into one atlas by a dependency-free software renderer that lives in
the repo (`games/neon-clash/models/`, `node build.mjs`, ~45 s; output in
`sprites/`, generated, never hand-edited). The rule that
keeps all this cheap is that **a skin is paint**: nothing in `step()` knows one
exists, so switching mid-match cannot change an outcome, and the suite asserts
stats, costs, ranges and a real deploy come out identical under all three. Cel
shading is enforced as two rules — flat colour steps and one ink outline,
via `cel()` — and `glow()` simply becomes a no-op under a skin with no bloom,
which is what stops a stray halo leaking in from untouched code. The sprite
style is the only one with an external asset, so it loads **lazily** and paints
as toon until the atlas arrives (and permanently if it never does); it is also
the only one that **depth-sorts**, back to front by board y, because its
figures stand up off the ground. Under both representational styles a
silhouette no longer says whose it is, so team colour moves to a thin ground
ring under each unit. Scenery is baked once from a seeded PRNG rather than
re-rolled per frame, or the arena boils — and both styles paint the *same*
baked scene, so they can never disagree about where the dirt ends. Opening the
panel pauses the sim.

It is **portrait-locked in software**: on a touch device turned sideways
`applyView()` counter-rotates the whole `#app` shell by `-screen.orientation.angle`
rather than letting the layout reflow, and `localPt()` un-rotates every pointer
so touch still lands correctly (a wide desktop window instead gets a centred
portrait column). The overlays sit *inside* `#app` on purpose — a transformed
ancestor is the containing block for `position:fixed` children, which is the
only reason they turn with the game. Drive suite (132 checks, incl. the garrison
protection invariant, the two-finger duel, the rotated-view touch map, the
skin-is-paint invariant across all three styles, and the atlas guards — inline
manifest matches the generated file, every rect lies inside the image, and an
atlas that never loads falls back to toon instead of an empty board):
`.claude/tests/drive-neon-clash.cjs` (132 checks). Detailed context:
`.claude/neon-clash.md`; the pre-render pipeline has its own manual at
`games/neon-clash/models/README.md`.

---

## Adding a New Game

1. Create `games/<slug>.html` — or `games/<slug>/index.html` (own
   subdirectory; used by Merge Drop and Neon Golf) — as a single
   self-contained file either way
2. Add a card to `games/index.html` (copy an existing card, update
   icon/name/desc/href) — pick an icon emoji **not already used** by another
   card (e.g. Sorcery already owns 🔮), keep the description to **two
   sentences AND 24 words at most** (the hub is a scan-and-pick list;
   `check-games-sync.cjs` fails the build over either, and both apply when a
   game gains a feature worth boasting about — rewrite, don't append. The word
   cap is the one that holds the line: two long sentences clear the sentence
   cap comfortably, which is how cards reached 68 and 40 words before the
   2026-08-25 rewrite, and how two had drifted back over 24 by 2026-08-27,
   caught the hour the check was added) — **and add the
   game's entry to the hub's `GAMES` facet dataset** (same file, § coverage heuristics script;
   it mirrors the games-index row and feeds the 📊 COVERAGE HEURISTICS
   dashboard — a drive test asserts cards ↔ dataset stay in sync)
3. Add the standard hub back button (see § Hub Back Button) — ← top-left,
   mute button to its right — and the WebAudio SFX + music stack per the
   Audio convention row
4. Add the build-timestamp badge (see above) with the current UTC timestamp
5. Create `.claude/<slug>.md` with architecture notes before the session gets long
6. Copy the standard MIT `LICENSE` from any open game directory into the new
   game's directory — unless the CD marks the game protected/proprietary
   (root `CLAUDE.md` § Licensing lists the five protected games)
7. Add the game's row to `.claude/games-index.md` **and refresh its coverage
   summary** (facet vocabulary: `templates/design/game-facets.md` in the
   zmhstudio repo) — when *choosing* what game to build, read that index's
   coverage summary first
8. Run both gates:
   - `node .claude/scripts/smoke-mobile.cjs <pages...>` — every changed page
   - `node .claude/scripts/check-games-sync.cjs` — proves the hub card, the
     hub `GAMES[]` entry and the games-index row you just wrote actually agree
     (and that the count line adds up). No Chromium needed.
   (see `.claude/scripts/README.md`)
9. Commit and push to `main`, stating the badge timestamp in your reply
10. Verify the "pages build and deployment" workflow for the pushed SHA goes
   green — `git push` ≠ live; a failed Pages build silently keeps serving
   the previous deploy
