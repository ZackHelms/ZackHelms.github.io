# Colony Sim — Phase 1 First Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable first draft of Colony Sim's phase 1: four settlers land on a generated island, keep themselves alive, learn from mistakes, build a camp to the phase 1 finish line, while the CD watches, follows, reorders goals and tasks; headless runs prove phase 1 always finishes.

**Architecture:** ES modules in `games/colony-sim/src/`; the simulation modules are DOM-free and importable by Node; `build.mjs` strips import/export and wraps everything in one IIFE inside `src/page.html` to produce the published single-file `index.html`. The sim runs on a fixed tick with seeded RNG streams; the renderer (hand-written WebGL2, blocky "Minecraft for now" look) and the rig (copied Animation Rigs skeleton + IK + planted feet) only read sim state.

**Tech Stack:** Vanilla JS (ES2020 modules), WebGL2, WebAudio, Node 20+ for build/tests, playwright-core (already used by `.claude/scripts/smoke-mobile.cjs`) for the browser smoke.

**Spec:** `.claude/colony-sim.md` (read it first; every **CD** line there is binding).

## Global Constraints

- Published page: `games/colony-sim/index.html`, **generated**, never hand-edited; `node games/colony-sim/build.mjs` writes it.
- No external JS libraries; Google Fonts the only external resource.
- Sim modules (`rng.js island.js nav.js data.js sim.js`) never touch `window`, `document`, `performance` or `Math.random`.
- Same seed + same input log ⇒ identical state hash at every game hour.
- Game clock: **1 game day = 30 real minutes at 1x** (48 game seconds per real second); speeds pause/1/2/4/8/16; while all settlers sleep the clock runs at 16x if the chosen speed is lower.
- Walk 1.6 m/s real at 1x (= 1/30 m per game second, 120 m per game hour); run 3.5 m/s real; rocky terrain x0.35; forest x0.8.
- Island ~1000 m x 700 m; landing site flat on a sandy beach with trees and loose rock within ~60 m; waterfall + pond ~450 m inland; cliffs impassable.
- Meter scale (CD): 0 = non-functioning; effectiveness `eff(v)` = v/50 below 50, 1.0 for 50-80, 1 + 0.2*(v-80)/20 above 80.
- The four founders are immortal with perseverance; ocean bath caps cleanliness at 70; 2 pees + 1 poo a day; at 0% bladder/bowel an accident (cleanliness -40, mood -15, meter to 100), never a collapse.
- Phase 1 finish line: campfire, shelter for 5, 5 beds, food store, storage, latrine, tool bench all built; stored food ≥ 3 days for 5 people (30 meal-units); no settler below 50 on health/energy/hunger/mood/cleanliness for 48 consecutive game hours.
- Chrome per `games/CLAUDE.md`: `#build-badge` right after `<body>` with a real timestamp; `#back-btn` (`../index.html`) left-most top-left, mute button right of it, chrome z-index 80 over overlays 70; dt clamped to [0, 0.1] s; no uninvited helper text on the play surface (ⓘ panel holds explanation).
- Licence: MIT `LICENSE` copied from an open game directory.
- PC screen first (CD); must still load without errors at the iPhone 13 viewport (the repo smoke gate).

## Review Focus

1. **A run left alone for 30+ game days at 16x** — expect no NaN positions, no settler stuck forever on a task (any task running > 12 game hours is abandoned and replanned), no memory growth from logs (bubbles/event log capped).
2. **The CD reorders a settler's list to starve a need** (e.g. moves "Sleep" to the bottom while energy is 10) — before the lesson the settler obeys and gets worse; after it, they refuse with a bubble; the run still reaches the finish line.
3. **Loading a save from an older build / a corrupt save** — expect a fresh game offered, never a crash or a half-loaded world.
4. **Following a settler who enters the far forest or stands behind a tree** — camera keeps them centred; clicking empty terrain deselects without moving the camera wildly.
5. **The tab hidden for minutes then shown** — expect no catch-up burst of thousands of ticks (cap ticks per frame) and no giant dt into the rig.

Each line's test is pinned in the owning task (Tasks 4, 5, 7, 8, 9).

---

### Task 1: Scaffold, build pipeline, seeded RNG

**Files:**
- Create: `games/colony-sim/build.mjs`, `games/colony-sim/src/page.html`, `games/colony-sim/src/style.css`, `games/colony-sim/src/rng.js`, `games/colony-sim/src/main.js` (stub), `games/colony-sim/LICENSE`, `games/colony-sim/tools/test-sim.mjs`

**Interfaces:**
- Produces: `makeRng(seed:number) -> {next():number in [0,1), int(a,b):int, pick(arr), stream(name:string) -> same shape}` — `stream` derives an independent generator from seed + FNV-1a hash of name (sfc32 core). `hashState(obj) -> string` (FNV-1a over JSON) for determinism checks.
- `build.mjs`: module order list `['rng.js','island.js','nav.js','data.js','sim.js','rig.js','render.js','ui.js','audio.js','main.js']`; same strip rules and `</script` guard as `games/interlock/build.mjs`; inlines `style.css`; replaces `>build PENDING<` with a UTC stamp. Missing modules in the list are skipped only while scaffolding (Task 1); from Task 9 on every listed file must exist.
- `tools/test-sim.mjs`: tiny `check(name, cond, detail)` harness, prints `SIM-TESTS: GREEN|RED`, exit 0/1; later tasks append sections.

- [ ] Step 1: tests — `rng determinism` (two `makeRng(42)` give the same 1000 values), `streams independent` (`stream('a')` and `stream('b')` sequences differ; drawing from one does not shift the other), `range` (all `next()` in [0,1)).
- [ ] Step 2: run `node games/colony-sim/tools/test-sim.mjs` → RED (module missing).
- [ ] Step 3: implement `rng.js`, `build.mjs`, page skeleton (canvas, badge, back + mute buttons, empty panels), `main.js` stub that draws a clear colour.
- [ ] Step 4: tests GREEN; `node games/colony-sim/build.mjs` writes `index.html`; `node .claude/scripts/smoke-mobile.cjs games/colony-sim/index.html` → `SMOKE: GREEN`.
- [ ] Step 5: commit `feat(colony-sim): scaffold, build pipeline, seeded rng`.

### Task 2: Island generator

**Files:** Create `games/colony-sim/src/island.js`; extend `tools/test-sim.mjs`.

**Interfaces:**
- Produces: `genIsland(seed) -> Island` with `CELL=2` (m), `W=500`, `H=350` cells, `h: Float32Array` (metres, sea level 0), `cover: Uint8Array` using `COVER = {SEA:0, SAND:1, ROCKY:2, GRASS:3, FOREST:4, CLIFF:5, POND:6, RIVER:7}`, `trees:[{x,z,h,kind}]`, `rocks:[{x,z,s}]` (loose rocks, pickable), `bushes:[{x,z,berries}]`, `landing:{x,z}`, `camp:{x,z,r}` (flat build area), `falls:{top:{x,z,y}, bottom:{x,z,y}}`, `pond:{x,z,r}`.
- `heightAt(isl,x,z)` bilinear; `coverAt(isl,x,z)`; `slopeAt(isl,x,z)`; `walkCost(isl,x,z) -> number|Infinity` (SEA/CLIFF/deep POND = Infinity, ROCKY 1/0.35, FOREST 1/0.8, else 1; slope > 0.9 = Infinity).

Approach: fractal value noise × radial island mask (elliptical), a ridge raised inland on the side away from the landing; the landing site flattened (smoothstep blend to a constant 1.5 m over radius 45 m) on the south shore; a cliff band = cells where slope after a terraced step exceeds the threshold; the waterfall placed at a cliff edge ~450 m from landing with the pond carved at its foot (flat, r ≈ 14 m, h just below a local water level) and a short river cell path from pond to sea; rocky shore stretches where shore noise > threshold; trees by forest density noise (none on sand within 8 m of sea, none in camp radius except a ring 25-60 m out); loose rocks clustered 20-60 m from camp and on rocky shores; berry bushes in forest edges, denser 40-150 m from camp than near it.

- [ ] Step 1: tests — for seeds 1..20: `landing flat` (h within ±0.3 m over camp radius 30 m); `trees near camp` (≥ 40 trees within 60 m of camp centre); `rocks near camp` (≥ 25 loose rocks within 60 m); `falls distance` (pond 350-550 m from landing); `falls drop` (falls.top.y - falls.bottom.y ≥ 12 m); `cliffs exist` (≥ 1% of land cells CLIFF); `rocky shore exists`; `pond reachable` (filled in Task 3's nav test).
- [ ] Step 2: RED. Step 3: implement. Step 4: GREEN, and generation < 1.5 s in Node.
- [ ] Step 5: commit `feat(colony-sim): seeded island generator`.

### Task 3: Navigation

**Files:** Create `games/colony-sim/src/nav.js`; extend tests.

**Interfaces:**
- Produces: `makeNav(isl) -> Nav` (4 m nav grid = 250 x 175, cost per cell from `walkCost` sampled at cell centre, max of 4 sub-samples for impassable); `findPath(nav, from:{x,z}, to:{x,z}) -> [{x,z}]|null` (A* 8-neighbour, binary heap, then string-pulled by line-of-sight over passable cells); `pathTime(nav, path) -> game seconds` at walk speed with terrain multipliers; `nearestPassable(nav,{x,z})`.
- [ ] Step 1: tests — seeds 1..20: path landing→pond exists and its time is 3-6 game hours; path never crosses a CLIFF or SEA cell (sample every 1 m); path landing→a point across a cliff band longer than straight distance; `findPath` to a sea point returns path to `nearestPassable`; 200 random paths < 2 s total.
- [ ] Step 2-4: RED → implement → GREEN. Tune island generator if pond time misses the window.
- [ ] Step 5: commit `feat(colony-sim): A* navigation over the island`.

### Task 4: Simulation core — settlers, meters, needs, jobs

**Files:** Create `games/colony-sim/src/data.js`, `games/colony-sim/src/sim.js`; extend tests.

**Interfaces:**
- `data.js` exports: `TUNE` (all rates; per game hour), `FOUNDERS` (4 profiles: `{id,name,role:'leader'|'gatherer'|'hunter'|'architect', attrs:{STR,DEX,CON,INT,WIS,CHA}, prefs:[], goals:[], fears:[], strengths:[], weaknesses:[], look:{skin,hair,hairStyle,shirt,pants,boots,hat,build}}`), `ITEMS` (`wood, stone, berries, meat, fish, meal, dried`), `JOBS` (table keyed by kind: `{who:[roles], meters:[...], tool?:'axe'|'pick'|'hammer'|'knife'|'spear', minutes, yields}`), `BUILDINGS`, `GOALS`, `LESSONS` (Task 5 fills).
- `sim.js` exports: `TICK = 10` (game seconds), `createSim(seed, opts?) -> Sim`, `step(sim)` (advance one tick), `runFor(sim, gameSeconds)`, `applyInput(sim, input)` (records `{tick, ...input}` in `sim.inputs` and applies it), `snapshot(sim) -> plain JSON`, `restore(json) -> Sim`, `simHash(sim)`, `clockOf(sim) -> {day, hour, minute}`, `eff(v)`.
- Settler runtime fields: `x,z,yaw,speed,act` (`'walk'|'run'|'chop'|'mine'|'pick'|'carry'|'build'|'cook'|'eat'|'sleep'|'sit'|'talk'|'bathe'|'forage'|'trap'|'fish'|'squat'|'collapsed'|'idle'`), `carry:{item,n}|null`, `m:{health,energy,hunger,mood,bladder,bowel,clean}`, `task` (current), `plan:[Task]`, `log:[]` (cap 50), `bubble:{text,until}|null`, `lessons:{}`, `rel:{id:number}`, `sleepDebt`, `slot` (bed/shelter id).
- Task shape: `{id, kind, label, target?, steps:[{do, ...}], i, owner:'self'|'leader'|'player', need?:meterName}`; steps `go`, `work` (minutes, act, effect), `pickup`, `drop`, `wait`.
- Planner per settler (`think(sim,s)` when `task` finishes or every game 15 min): (1) needs below their personal threshold become need tasks at the front (threshold from lessons, Task 5); (2) otherwise take the head of `plan`; (3) if `plan` is empty ask the leader's assignment (`assign(sim,s)`, from the goal list's next open requirement matched to role, else role default work: gatherer chop/mine, hunter forage/trap/fish, architect build/plan, leader cook/tidy/cheer/rest).
- Needs: energy drains `TUNE.energyWork` (6/h) working, 3/h idle; sleep regains 12/h in a bed (cap 100), 9/h in a lean-to (cap 90), 6/h on the ground (cap 50, CD); hunger drains 4/h, a meal +40, raw berries +15, raw meat refused unless hunger < 15; bladder 6/h (pee when < 40 ⇒ ~2/day), bowel 3.5/h (poo when < 35 ⇒ ~1/day); clean 1.3/h, ocean bath to min(70, +60), pond to 100 once discovered; mood target = 70 + 10*(shelter) + 5*(meal today) + social - 15*(any meter < 25), moves 4/h toward target, leader's `cheer` +12 to the listener.
- Work speed = base × `eff` of each meter in the job's `meters` (product) × tool effectiveness (Task 6) × attribute factor `0.75 + 0.05*(attr-10)` for the job's key attribute.
- Collapse: founder at 0 in health/energy/hunger → `perseverance`: walks home at 0.5 speed, then rests; at 0 energy → sleeps on the spot (cap 50, CD). Injuries: chance per hour of chop/mine/trap scaled by `(1-eff(energy))`; damage 10-30 health.
- Day/night: sunrise 06:00, sunset 19:30; darkness slows outdoor work x0.6 and raises injury chance.
- [ ] Step 1: tests — `eff` exact at 0, 25, 50, 65, 80, 90, 100 → 0, 0.5, 1, 1, 1, 1.1, 1.2; `determinism` (seed 7, run 3 game days twice, `simHash` equal every game hour); `restore round-trip` (snapshot at day 1, restore, run both to day 2, hashes equal); `no NaN` (seed 1-5, 10 days, every settler x,z,meters finite); `bathroom cadence` (over days 2-6 each settler pees 1.5-2.5/day, poos 0.7-1.3/day); `ocean cap` (after an ocean bath clean ≤ 70); `exhaustion sleep cap` (force energy 0 in the forest: wakes ≤ 50); `no endless task` (no task active > 12 game hours over 10 days at seeds 1-5).
- [ ] Step 2-4: RED → implement → GREEN.
- [ ] Step 5: commit `feat(colony-sim): settlers, meters, needs and jobs`.

### Task 5: Minds — lessons, refusals, relationships, goals board model

**Files:** modify `src/data.js` (`LESSONS`, `GOALS`), `src/sim.js`; extend tests.

**Interfaces:**
- `LESSONS` catalogue (spec § Lessons: written types, numbers learned): `overwork` (param `stopEnergy`, start 12, learned toward 35), `lateNight` (param `bedHour`, start 23.5, learned toward 21.5), `skipMeal` (param `eatHunger`, start 15, toward 40), `hygiene` (param `bathDays`, start 4, toward 2.5), `farAtDusk` (param `returnHour`, start 19.5, toward 17.5; hunter/gatherer), `dullTools` (leader; raises the tool bench goal's priority). Each: `{trigger(event)->bool, learnChance(s) = clamp(0.15 + 0.04*((INT+WIS)/2 - 10), 0.1, 0.6), apply(s) moves param 60% of the way toward target}`; learned when chance succeeds on a triggering event; `s.lessons[key] = {param, times, day}`.
- Refusal: `applyInput(sim, {type:'reorder', settler, taskId, to})` and `{type:'doNow'}`: if moving a task ahead of an active need that a learned lesson covers, refuse: bubble text from `REFUSALS[lessonKey]` (e.g. "I'm running on empty. Last time I pushed on like this I cut myself. Sleep first."), need task moved to the top, event logged.
- Relationships: `rel[a][b]` 0-100 starting 40-60 seeded; +0.5 per game hour working within 15 m, +3 per shared meal, +5 per cheer; mood social term = avg of top-2 friends/20.
- Goals board model: `sim.goals = [goalId]` ordered; `GOALS` phase 1: `campfire, leanto, storage, foodstore, latrine, hut1, hut2, beds5, toolbench, dryrack`; `{type:'goalMove', id, to}`, `{type:'goalAdd', id}`, `{type:'goalRemove', id}`; leader delegation reads the first unmet goal whose prereqs are met, splits it into material-gather and build tasks, assigns by role and availability; leader re-plans every game hour and logs "assigned X to Y".
- [ ] Step 1: tests — `lesson learns` (seed 3: force 5 overwork injuries on the gatherer; `lessons.overwork` set and `stopEnergy` > 12); `INT/WIS speed` (over 200 sim trials of `learnChance`, a WIS 16 settler's mean learns-per-trigger > a WIS 8's); `refusal` (learned overwork, energy 20, player `doNow` a chop task ⇒ bubble set, sleep task first, input logged as refused); `obey before learning` (same without lesson ⇒ chop task first); `goal order respected` (move `toolbench` to first ⇒ first build started is the tool bench, once materials allow); `replay with inputs` (record 20 random reorders over 3 days, replay from seed + `inputs`, identical hash).
- [ ] Step 2-4: RED → implement → GREEN.
- [ ] Step 5: commit `feat(colony-sim): lessons, refusals, relationships, goals`.

### Task 6: Building, food chain, tools, finish line + headless runner and tuning

**Files:** modify `src/data.js`, `src/sim.js`; create `games/colony-sim/tools/run.mjs`; extend tests.

**Interfaces:**
- `BUILDINGS`: `{id, label, cost:{wood,stone}, hours, size:{w,d,h}, stages:4, provides}` for campfire(cook, mood), leanto(sleep cap 90 for 4), storage(holds materials), foodstore(holds food, meals spoil after 2 days outside it, 5 days inside), latrine(bathroom without mood cost), hut(sleep for 3, needs beds for cap 100), bed(cap 100, 1 person), toolbench(maintain), dryrack(meat/fish → dried, keeps 10 days). Sites from `campLayout(isl)` → fixed slots around `isl.camp`, deterministic.
- Construction: a `site` with `need` materials, `have`, `progress` hours; architect builds at 1.0, others help at 0.6; stage = floor(progress/hours*4).
- Food: forage berries from bushes (bush regrows 3 days); traps (hunter sets up to 4 traps in forest, checked daily, catch chance 0.35/day per trap, rabbits deplete by distance band); fish from shore 0.8/h with spear; leader cooks meat/fish/berries → meals (1 meat = 2 meals, 1 fish = 1.5, 3 berries = 1) at the campfire.
- Tools (CD): `sim.tools = {axe, pick, hammer, knife, spear}` each `cond` 100 → floor 50, wear 1.2 per work hour; effectiveness = cond/100; maintenance at the tool bench restores 25/h.
- Discovery: once the food store holds ≥ 2 days of food, the hunter (else the gatherer) makes one scouting day trip toward the unexplored interior; reaching within 40 m of the pond logs `discovered:pond` (a celebration bubble) and the pond becomes the bath that reaches 100% cleanliness. `sim.seen` (a coarse 16 m grid) records what any settler has been within 40 m of.
- Phase 1 finish line (Global Constraints) → `sim.phase1 = {done:true, day, hour}` and an event.
- `tools/run.mjs --seeds N --days D [--from S] [--bad]` prints a table per seed (finish day, lowest meter + who, collapses, injuries, lessons learned with day, refusals) and the aggregate (finished n/N, median and range of finish day) and exits 1 if any seed fails to finish within D; `--bad` applies scripted bad-player inputs (move sleep/eat to bottom for all at day 1, move toolbench to last, doNow chop at 23:00 each night for 3 days).
- [ ] Step 1: tests — `build stages` (lean-to completes and provides sleep); `tool wear floor` (300 work hours never below 50); `bench restores`; `food spoils outside store`; `finish line recognised` (state forced to meet it ⇒ `phase1.done`).
- [ ] Step 2-4: RED → implement → GREEN.
- [ ] Step 5: **tune** with `node games/colony-sim/tools/run.mjs --seeds 30 --days 30` until: 30/30 finish; median finish day 10-15; ≥ 1 settler < 30 on some meter in ≥ 80% of runs; ≥ 2 lessons learned per run on median; then `--bad` 30/30 finish (later is fine). Record the final table in `.claude/colony-sim.md` § Measured.
- [ ] Step 6: commit `feat(colony-sim): building, food, tools, phase 1 finish line, tuned`.

### Task 7: Rig — skeleton, flesh, animations on terrain

**Files:** Create `games/colony-sim/src/rig.js`.

**Interfaces:**
- Consumes: `heightAt`, settler runtime fields (`x,z,yaw,speed,act,carry,look`).
- Produces: `makeRig(settler) -> Rig`, `updateRig(rig, settler, dtAnim, isl)` (dtAnim = real dt × speed, clamped 0.1), `rigCapsules(rig) -> Float32Array` of `[ax,ay,az, bx,by,bz, r0,r1, colorIndex]` per capsule (~24 per settler), `rigHead(rig) -> {x,y,z}`.
- Port from `games/animation-rigs/index.html`: `ik2`, `buildPose` (A002 form: softIK + sagPoles on), the planted-feet idea of `locoParams2` simplified for a heightfield (`footY = heightAt`), no stairs/ladder code. Activity poses as parameter blocks: chop (two-hand overhead swing toward a target), mine (same, lower), pick (bend + reach to ground), carry (arms forward, load box at chest), build (hammer swing at waist height), cook/forage (crouch), eat/sit (sitting pelvis, hands to mouth), sleep/collapsed (lying, pelvis at ground + 0.12), talk (gesture), bathe (waist-deep stand / scrub), squat. State changes blend joint positions over 0.35 s (Animation Rigs' `setState` idea).
- Flesh (CD: capsule body parts, varied clothing colours): capsules per bone with radii (thigh 0.075, shin 0.055, upper arm 0.05, forearm 0.042, torso 0.13-0.15, pelvis 0.13, neck 0.045, head sphere 0.11), colours from `look`: shirt on torso+upper arms, pants on pelvis+thighs+shins, boots on feet, skin on forearms/hands/neck/head, hair cap + optional ponytail/beard capsule, hat optional.
- [ ] Step 1: test (Node) — `bone lengths exact` (100 random poses per activity: IK bones within 1e-6 of their lengths); `feet on ground` (walking 60 s over slope seed 1: planted ankle y - heightAt within 0.1 m); `finite` (all capsules finite at dtAnim 0 and 0.1).
- [ ] Step 2-4: RED → implement → GREEN.
- [ ] Step 5: commit `feat(colony-sim): settler rig with fleshed capsule bodies`.

### Task 8: Renderer and camera

**Files:** Create `games/colony-sim/src/render.js`.

**Interfaces:**
- Produces: `makeRenderer(canvas, isl) -> R`, `R.frame(sim, rigs, cam, tReal)`, `R.project(x,y,z) -> {sx,sy,depth}|null`, camera `{tx,ty,tz, yaw, pitch, dist}` with `orbit(dx,dy)`, `pan(dx,dy)`, `zoom(f)`, `flyTo(x,y,z,dist)`.
- Blocky look (CD): terrain as one static mesh of 2 m flat-shaded cells (per-cell colour by cover with ±6% seeded jitter, sand/grass/forest floor/rock/cliff grey), cliffs as vertical faces where neighbour height differs > 1.5 m; sea plane with a slow colour wave; pond and river surfaces; the waterfall as a scrolling-stripe quad strip with a foam ring; instanced boxes for tree trunks, cube canopies (palms near the shore: thin trunk + flat cross), bushes (with red berry dots while they have berries), loose rocks, buildings (from site stages: floor slab, posts, walls, roof boxes), items (logs, stones, meals in store); instanced capsules for settlers (Combat Simulator's `VS_LIMB` approach: capsule from A, B, r0, r1 built in the vertex shader); blob shadows under settlers; sun direction + colour from the clock (simple arc, warm at dawn/dusk, moonlit blue at night), Lambert + ambient + distance fog.
- Camera (PC): left-drag orbit, right-drag or shift-drag pan, wheel zoom (3 m – 900 m), WASD/arrows pan; following: target = settler pelvis led 0.25 s ahead, orbit stays allowed, a pan stops following; touch: one-finger orbit, two-finger pan/pinch (only so the phone smoke and casual phone use work).
- [ ] Step 1: browser check (in Task 9's drive script): canvas non-blank after 2 frames (≥ 3 distinct colours sampled), `project` of a settler's pelvis lands inside the viewport after `flyTo`.
- [ ] Step 2: implement; build; open in Playwright; screenshot overview + a close follow shot to `scratchpad`; look at them.
- [ ] Step 3: commit `feat(colony-sim): WebGL2 blocky island renderer and camera`.

### Task 9: UI, audio, save — the playable page

**Files:** Create `games/colony-sim/src/ui.js`, `games/colony-sim/src/audio.js`, finish `games/colony-sim/src/main.js`, `src/page.html`, `src/style.css`; create `.claude/tests/colony-sim-drive.cjs`.

**Interfaces:**
- Top bar: clock `Day 3 · 07:40`, speed buttons ⏸ 1× 2× 4× 8× 16× (keys Space, 1-6), follow `<select>` (`follow: none` + four names; native `change`, never bindTap), ⓘ, ⚙ (new game with seed, sound volume).
- Left: **Goals** board (control A) — ordered list with ▲▼ and ✕ per goal, a `+` select for goals not on the board, each goal showing status (waiting / gathering 12/20 wood / building 40% / done ✓).
- Right: **settler panel** when selected — name, role, portrait colours swatch, attributes, meters as bars with the 50/80 marks, strengths/weaknesses/preferences/fears/goals, lessons (with the number learned, e.g. "stops work at energy 31%"), friends (top 3), **Now** (task + its step list with the current step marked) and **Next** list with ▲ and "Do now" per item (control B). Refusals show as the bubble plus a line in the panel's log.
- Speech bubbles: DOM divs positioned at `R.project(rigHead)`, shown for 8 real seconds, max 4 at once.
- Phase-1-complete overlay (z 70) once `sim.phase1.done`: day reached, a few stats, "Inviting settler 5 arrives in a later draft" and Continue watching.
- Main loop: fixed-step accumulator `acc += dtReal*48*speed` (night boost per constraint), `while(acc>=TICK && n<400) step()`; leftover clamp so a hidden tab never bursts; render with interpolation between previous and current settler positions.
- Save: autosave to `localStorage['colonySim.v1']` every game hour as `{v:1, seed, inputs, tick}` (replayed on load by re-running the sim headless from the seed and inputs to `tick`; show "Loading day N…" while it runs); unknown `v` or parse error ⇒ ignore, start fresh, keep the bad blob under `colonySim.bad`. Continue / New island on load.
- Audio (house rule: WebAudio synthesized, lazy context on first gesture, mute persisted): surf noise near the shore scaled by camera distance, birds by day, crickets at night, chop/mine thunks when the camera is near the worker.
- `.claude/tests/colony-sim-drive.cjs` (playwright-core, like other drive suites): page loads with no console errors; canvas non-blank; selecting each follow option shows that settler's panel and moves the camera; 16× for 20 s advances the clock ≥ 4 game hours with no errors; reorder via ▲ changes the settler's Next order; goal ▲ reorders the board; reload → Continue restores the same day/hour; corrupt save blob → fresh game, no error; `document.hidden` simulation (stop rAF 60 s via clock jump) → ticks per frame capped.
- [ ] Step 1: write the drive suite; run → RED.
- [ ] Step 2: implement; build.
- [ ] Step 3: drive suite GREEN; `smoke-mobile.cjs` GREEN; screenshots looked at.
- [ ] Step 4: commit `feat(colony-sim): playable page: panels, goals, follow, speech, save, audio`.

### Task 10: Hub, docs, ship

**Files:** Modify `games/index.html` (card + `GAMES[]` entry), `.claude/games-index.md` (row), `CLAUDE.md` (project structure line: generated index.html, build command; context table row), `.claude/colony-sim.md` (§ As built, § Measured, how to add a job / lesson / building), `TODO.md` (phase 1 draft entry → Needs Zack "play the first draft"), `DONE.md`.
- [ ] Step 1: `node .claude/scripts/check-games-sync.cjs` → `GAMES-SYNC: GREEN`.
- [ ] Step 2: rebuild, stamp badge, read it back; all gates: `test-sim.mjs`, `run.mjs --seeds 30 --days 30`, `run.mjs --seeds 30 --days 40 --bad`, drive suite, smoke.
- [ ] Step 3: commit; `git fetch origin main`, re-check `rev-list --count HEAD..origin/main` immediately before push (CLAUDE.md § Git workflow); push; verify the Pages run for the SHA.
