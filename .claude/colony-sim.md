# Colony Sim — design and context

`games/colony-sim/`. CD commission 2026-11-26, designed in a brainstorm the same
day. **Status: first draft of phase 1 built 2026-11-26 (see § As built); awaiting the CD's play.**

**The CD's go-ahead (2026-11-26), verbatim in substance:** "Use your best judgment to
proceed with a first draft of the game. Make any decisions on your own without
consulting me. Figure out something for phase one that works, and I will review it
later." Also:
- **Graphics can be rudimentary, "like Minecraft for now".** Blocky terrain and
  props are fine; realism is a later pass.
- **Bodies: Combat Simulator's capsule body parts are fine for now**; vary clothing
  colours so people are easy to tell apart.
- **Tuning is Claude's job for now** (through data files and the headless runner).
  The CD may later want in-game controls for tuning specific things.
- **Everything after phase 1 is on the back burner** and undecided: how many
  settlers, which technology and buildings unlock and why (bigger settlements,
  faster travel across the island, safer hunting of dangerous animals, a tech tree).
  Steps CS-4 to CS-7 below are placeholders, not decisions. Do not build toward a
  particular phase 2 beyond keeping the code open to it.
- Phase 2 settler count is undecided; build the rig and sim so ~10 settlers are
  cheap, and do not pay for 100 now.

Everything below marked **CD** is the CD's own decision, in or near their words.
Everything marked **call** is a proposal made during the brainstorm that the CD did
not object to, or a builder's call made while writing this up; the CD can overrule
any of them.

## What it is, and why

An island colony the CD mostly **watches**. Four settlers, picked by the group
funding their expedition for a well-rounded set of skills, land on an island and
work together to survive and then thrive: a camp, buildings, tools, food, and later
new settlers, special materials from caves, electricity and power tools.

**The point (CD):** "primarily a simulation where we fine tune the behaviors,
attributes, equipment, etc of the settlers in order to meet their objectives with
some struggle (not too easy and not too hard for phase 1 so it is actually
interesting)." The fun is watching emergent, believable behaviour; the work is the
CD and Claude tuning it. So the simulation must be **measurable**: it runs headless,
many seeds at a time, and reports numbers (see § Testing and tuning).

### Goals
- Watchable, believable settlers: real-looking people on the Animation Rigs
  skeleton, doing visible work (chopping, carrying, cooking, building, sleeping).
- Settlers with individual minds: preferences, goals, fears, strengths,
  weaknesses, D&D-style attributes, and **lessons learned from experience** that
  change what they do next.
- Observability: free camera, follow-a-settler, and a settler panel listing their
  traits, meters, current task with subtasks, and what they plan next.
- Light control that can help or hurt: colony goals, task reordering, and later
  direct orders.
- A long arc in phases (below), each a struggle that is tunable and measured.

### Non-goals (for now)
- Not a city builder: no free-form building placement by the player; the
  architect settler decides where things go (the CD may later get control C over
  this, see § Controls).
- No combat game: attacks exist (fauna later) but the player never fights.
- No multiplayer, no phone-first layout (CD: "Build for pc view").

### Anti-goals (would make it a failure even if it works)
- Settlers that teleport, slide, or snap: the Animation Rigs motion quality is the
  reason to zoom in.
- Phase 1 that can fail on its own, or that is a foregone stroll (CD: always
  succeeds, with struggle; number of days varies).
- A run that cannot be replayed: same seed, no input, must play out identically.
- Helper text on the play surface (repo rule, `games/CLAUDE.md` § Discovery over
  instruction): explanation lives behind ⓘ / ⚙ panels.

## The settlers

### The first four (CD)
1. **The leader.** Project manager; sees the big picture and keeps everyone on the
   critical path. Stays in the safety of camp: cooking and cleaning up after meals,
   moving loose items to storage, cleaning, discussing issues with others, cheering
   people up, resting to keep their own mood at its peak so they can support
   others, and **assigning and adjusting everyone's tasks** as things progress. Owns
   the colony goals (§ Controls A).
2. **The gatherer.** Strong, high endurance: chops trees, mines rock and ore,
   hauls materials.
3. **The hunter.** Hunting, trapping, fishing, foraging: the food supply.
4. **The architect.** Designs, plans and builds.

They are **immortal** (CD) and carry a **perseverance** skill: at 0% in any meter
they walk themselves, slowly, back to camp. They have above-average INT and WIS
(CD), accumulate the most lessons, and later **teach** them to newcomers (CD).

**call:** names, appearance, and each one's preferences, goals, fears, strengths
and weaknesses are proposed by the builder in step 1 and shown to the CD at that
step's playtest. Draft direction: fears that matter on this island (deep water,
heights, the dark, being alone), preferences that tug against the plan (a
favourite job, a favourite food, a sleeping spot), and a weakness each that makes
one task slower or riskier.

### Attributes (CD: "d&d style")
STR, DEX, CON, INT, WIS, CHA on a 3-18 scale (**call**: 10 is average; the four
start 12-16 in their role's stats). **INT and WIS set how fast a settler learns
lessons** (CD). **call:** STR drives carry load and chop/mine speed, DEX craft and
trap speed, CON endurance (how fast energy drains under work) and injury
resistance, CHA how much the leader's cheering and teaching lifts others.

### Meters (CD)
Health (physical injury), energy, hunger, mood, bladder/bowel, cleanliness.
**Mood** consolidates The Sims' social, comfort and fun (CD).

| Level | Meaning (CD) |
|---|---|
| 0% | non-functioning; needs rescue (see § Collapse, rescue and death) |
| below 50% | effectiveness in related activities drops |
| 50-80% | normal range, standard effectiveness; achievable with standard things |
| 100% | +20% productivity; needs special items, skills or circumstances |

Mood 10% reads "depressed", 80% normal, 100% very happy (CD). Default for every
meter (CD: "lets make this the default for now").

**call:** effectiveness is linear within each band: 0% at 0, 100% at 50 (so 25%
gives about half speed), flat 100% from 50 to 80, rising linearly to 120% at 100.
Each activity reads the meters related to it (chopping: energy, health, hunger;
teaching: mood, energy) and takes the product or the minimum (builder's call,
measured).

**Bathroom (CD):** two pees and one poo a day. **call:** before a latrine exists
they go off into the bushes out of view, at a small mood cost; the latrine is an
early architect project. At 0% bladder/bowel they **have an accident**: a big
cleanliness and mood drop, the meter resets; never a collapse (CD agreed).

**Cleanliness (CD):** at least one bath every 3 days; bathing in the ocean reaches
at most 70%. **call:** higher needs the waterfall pond (once discovered) or later a
bathhouse. At 0% cleanliness mood falls faster and illness becomes more likely;
never a collapse (CD agreed).

**Energy (CD):** recovers with a good night's sleep, caffeine, rest/relaxing or a
nap. A settler who collapses from exhaustion **sleeps where they are** and wakes at
no more than 50% (CD: "not a great night's sleep, but better than nothing").

### Lessons learned (CD)
Settlers learn what is optimal **by trial and error**. CD's example: pushing too
hard costs sleep, which spoils the next day, and eventually they learn not to.
Another: the hunter ranges too far as food near camp thins, comes back injured,
learns from it, and next time forms a **hunting party** with several settlers and
the gear they now know they need.

- **call, the data model:** a **written catalogue of lesson types** (trigger,
  remembered cause, effect on planning), as the CD's examples suggest, with the
  **numbers inside each lesson learned from the settler's own outcomes** (how late is
  too late to keep working, how far is too far to hunt alone, how much food a trip
  needs). So what can be learned is authored and tunable, while what each settler
  concludes, and when, comes from their own run. Lessons nobody wrote are out of
  scope.
- A lesson is a remembered cause and effect ("I worked past exhaustion and got
  hurt"; "hunting boar alone near the cliffs went badly"). Once learned, it changes
  how the settler plans and what they will accept.
- **Learning speed comes from INT and WIS** (CD). **call:** each relevant bad
  outcome is a chance to learn, with a probability set by INT/WIS; a lesson may
  need the same mistake two or three times for a low scorer.
- **Refusal (CD):** a settler who has learned a lesson refuses an order that
  repeats the mistake: a **speech bubble / chat box** shares how they feel, and
  they reorder their own list to put the need (sleep, food, mood, bathroom...) at
  the top. Before they have learned it, they obey, and that is how they learn.
- **Teaching (CD):** the four accumulate the most lessons and can share them with
  newcomers. **call:** teaching is a job the leader assigns; CHA of the teacher and
  INT/WIS of the learner set how long it takes.
- Lessons are listed in the settler panel.

### Relationships (call, implied by the CD's rescue rule)
"If they have more friends they are more likely to be found faster" (CD) means a
friendship graph: pairs that work, eat and talk together grow closer; it feeds
mood and how soon and how hard others search for a missing settler. Shown in the
settler panel.

## Collapse, rescue and death (CD)

- **Settler 5 and later** at 0% in a non-functioning meter sit where they are and
  wait for help for **up to one game day**, then die (they disappear) and **every
  remaining settler's mood drops 20%** (never below 10%).
- Someone usually **notices they are missing** at meal time or bed time; more
  friends means they are found faster.
- Health to 0% from an attacker: the attacker leaves them alone, but later in the
  sim it may be dangerous to go and rescue them.
- Someone far from camp may die because others noticed too late to go out, patch
  them up or cheer them up or fix their issue, and bring them back.
- **Carrying** a 0% settler back to camp takes **two** settlers; with a way of
  helping them (a lesson or an item; **call:** first aid learned, later a stretcher
  or crutch the architect builds) **one** settler can patch them up and walk them
  back. May require lessons (CD).
- The **first four** never die: perseverance walks them home (above).
- Exhaustion is the exception: they sleep where they fall (above).

## Controls (CD)

- **A. Goals board** (colony level): you add and reorder high-level goals ("Shelter
  for all", "3 days of food", "Tool bench"). **The leader** turns them into tasks
  and delegates them, adjusting as things progress.
- **B. A settler's list**: their current task with subtasks and progress, then what
  they plan next. You can reorder it ("do this now"); a settler who has learned a
  lesson may refuse (above).
- **C. Direct orders** (select a settler, tap a thing: chop this, go here):
  **unlocked later**, when the leader gains a **micromanage** skill (CD).
- A and B are enabled from the start of phase 1 (CD).
- **The CD's own role:** inviting new settlers and requesting special gear that
  cannot be made on the island. Both are **unlocked by goals** (CD's example:
  complete the phase 1 goals, including 5 beds, and you can invite settler 5).
  **call:** ordered gear and new settlers arrive by **supply boat** at the landing
  beach a few days after the order, an event to watch.

```
A. Goals board (colony)        B. Settler's list
┌──────────────────────┐   ┌──────────────────────┐
│ GOALS          [+]   │   │ <name> · Architect   │
│ 1 Shelter for all ≡  │   │ now  Frame hut  ▓▓░  │
│ 2 3 days of food  ≡  │   │  └ carry logs (2/6)  │
│ 3 Tool bench      ≡  │   │ next Fetch stone  ≡  │
│                      │   │ then Eat          ≡  │
└──────────────────────┘   │ [Do this now]        │
                           └──────────────────────┘
```

## Observability (CD)

- Move the camera anywhere on the island: orbit, zoom, pan, as in Animation Rigs.
- **Follow a settler** from a dropdown in the control panel: flies the camera to
  them and selects them (the Animation Rigs follow menu, `.claude/animation-rigs.md`).
- **Settler panel** when one is selected: strengths, weaknesses, preferences,
  goals, fears, attributes, meters, lessons, friendships, current task and
  subtasks, then what they plan next (reorderable, control B).
- **call:** a game clock and a **speed control, 1x to 16x** (CD chose this pacing,
  option B), plus a pause. While everyone is asleep the clock runs ahead fast so
  nights don't drag (call).

## Time and space (CD handed the scale to Claude: "Scale Island size and day length appropriately")

The constraint: real-looking walking (about 1.4 m per real second) against a
compressed clock means distance costs a lot of game time. Every colony game picks
a side of this; the CD's resolution is **temporary camps** for long journeys,
learned as the colony progresses (CD: "realistic enough").

- **call (corrected at the builder check):** a game day is **30 real minutes at 1x**
  (one game hour = 75 s). The first draft said 15 minutes and ~130 m per game hour;
  that arithmetic was wrong (1.4 m/s x 37.5 s = 52 m), which would have made the
  waterfall a 10-hour walk each way. Walking pace is a natural brisk **1.6 m/s**, so
  a walk covers **~120 m per game hour**; running (3.5 m/s) is for hurry and danger.
- **call:** the island is about **1 km x 0.7 km**.
  - trees and loose rock within ~60 m of the landing site (about half an hour);
  - the waterfall about 450 m inland (~4 hours each way: a full day trip);
  - the far coast and the caves are expeditions that need temporary camps.
- **call:** phase 1 lasts about 10-15 game days: 5-7.5 hours at 1x, about 1.5 hours
  at 4x. The speed control (1x-16x) and the night skip are how it is watched.

## The island (CD)

- Fairly large (scaled as above), with realistic terrain, flora and fauna.
- Shores: sandy; sometimes with rocks; sometimes lots of rocks, which is
  **difficult terrain** where settlers move slowly and carefully.
- Steep rock **cliffs** that are impassable.
- At least one **tall waterfall falling into a pond** where it is safe to swim,
  which they have to **discover**, and which may need them to be secure enough
  first to explore that far out.
- The **landing site** is a nice flat area for the first camp, with plenty of
  trees nearby to cut and plenty of loose rocks to pick up.
- Caves with special materials (phase 2).

**call:** the island is generated from a seed (heightfield + land-cover grid, the
Wayfinder approach, `.claude/wayfinder.md` § Terrain), with fixed constraints the
generator must satisfy (a flat landing site on a sandy beach, trees and loose rock
near it, a waterfall and pond inland behind a reachable route, cliffs, rocky shore
stretches, cave mouths). **call:** a warm-temperate island: palms and scrub at the
shore, broadleaf and conifer forest inland, berries, roots and mushrooms to
forage; rabbits, birds, crabs and fish early; goats on the cliffs and wild boar
(the first animal that can hurt a hunter) further out. **call:** what a settler has
not seen is unexplored (fogged on any map / overview), and discovery is a
simulated event.

## Tools, buildings and power (CD)

- They bring **one set of indestructible tools** whose effectiveness **degrades
  from 100% to 50%** over use, so eventually they need a **hand tool maintenance
  bench**.
- Buildings benefit survival and growth; phase 1 includes shelter and **beds (5
  for settler 5's unlock)**.
- Later, once far enough along, they can **order electric tools** (table saw, chop
  saw, other power tools), but first they must build **electricity generation**:
  hydroelectric, thermal, solar...
- **call:** the phase 1 building set: campfire, lean-to then hut(s), beds, food
  store, storage area for materials, latrine, tool maintenance bench, drying rack.
  The architect places them (control C may later let the CD direct this).

## Phases of the game (CD)

- **Phase 1, settlement.** Easy-ish: hunger, damage, tiredness are a manageable
  threat the four handle unless the CD micromanages and messes things up. **Always
  succeeds; the number of days varies.**
  - **call, the finish line:** the camp is self-sufficient enough to invite
    settler 5: shelter and a bed for 5, fire, a food store holding about 3 days of
    food, the tool maintenance bench, and **no settler below 50% (the bottom of the
    CD's normal range) on health, energy, hunger, mood or cleanliness at any point
    for 2 days running**. Bladder and bowel are left out because they cycle. (The
    first draft said "everyone at or above 80% for 2 days", which daily drain makes
    impossible.)
  - **call, what "always succeeds" covers:** a run with **no player input** always
    reaches the finish line (tested on every seed). With input, the CD can make it
    slow and miserable but not stall it for good: the founders can't die,
    perseverance brings them home, and lessons make them refuse the orders that
    hurt them. The headless runner includes **bad-player scenarios** (skip sleep,
    starve the food job, reorder everyone onto one task) and they must still finish,
    later.
- **Phase 2, growth.** The CD invites new settlers to keep expanding and help with
  maintenance. Difficulty rises naturally: they venture further out and into caves
  for special materials needed to build and maintain special buildings and
  equipment; food near camp is small, so more settlers means the hunter ranges
  further, gets hurt, learns, and forms hunting parties with specific gear. New
  settlers can die.
- **Later:** electricity, ordered power tools, and whatever the CD adds.

## How it is built

### Approaches considered
1. **One hand-written single file** (house pattern, like Wayfinder / Combat
   Simulator / Driving Simulator): fits convention and reuses their WebGL2 code,
   but would pass 10,000 lines by phase 2 across simulation, island, bodies,
   rendering, UI and test hooks.
2. **Source modules built into one page, hand-written WebGL2** (the Interlock
   pattern, `.claude/interlock.md`): `src/` modules, `build.mjs` generates the
   published single-file `index.html`. **Chosen (CD, 2026-11-26).**
3. **As 2, with vendored Three.js**: faster shadows/instancing/terrain early, but a
   second third-party exception and none of the repo's own 3D work reused.

Why 2: tuning is the main activity, and a simulation that is its own module can be
loaded directly by Node and run headless across many seeds; each phase adds
modules instead of growing one file.

### Architecture (call, unless marked CD)
- **`src/` modules, `build.mjs` → `games/colony-sim/index.html`** (generated, never
  hand-edited; document it in CLAUDE.md's project structure like Interlock).
- **The simulation is DOM-free and render-free** (`sim/` modules): world state,
  settlers, needs, jobs, lessons, relationships, goals. Fixed tick (e.g. 10 per
  game minute or a fixed real-time step; builder's call, measured), **seeded RNG**
  with named streams so a test can force an outcome. It knows positions, speeds and
  what each settler is doing; it does **not** know joints.
- **Determinism (CD):** same seed, no player input, replays identically. Player
  actions are recorded with the tick they happened on, so a run with input also
  replays (call). The render loop never feeds back into the sim.
- **Bodies are presentation.** The Animation Rigs skeleton, IK and locomotion are
  **copied** (not shared: Animation Rigs' versions are frozen) and adapted to walk
  on a heightfield; the rig reads the sim's position, speed and activity and
  animates. Work animations are new: chop, mine, pick up, carry, set down, build,
  cook, eat, sit, sleep, crouch (bathroom, out of view), bathe/swim, forage, aim and
  throw (hunt), talk (gesture), stumble/collapse, walk-carried-by-two.
- **Flesh (CD: legs, torso, arms, head, hair, varied clothing and colours, "more
  realistic similar to a human"):** call: Combat Simulator's instanced tapered
  capsules over the bones (`.claude/combat-simulator.md`), with clothing as
  per-segment colour/material (shirt, trousers, shorts, boots, hat), hair as its
  own shapes, skin tones and builds varied per settler.
- **Island and sky:** the Wayfinder terrain/water/vegetation approach; sun, moon
  and day/night from the zmh-sky kit (call; latitude and date a builder's call).
- **Rendering:** hand-written WebGL2 (the repo's three 3D games are the
  precedent for setting aside "Canvas 2D for all game rendering"); PC screen first
  (CD).
- **UI:** DOM panels over the canvas (control panel with follow dropdown, speed,
  goals board, settler panel). Style: **call**, a look of its own fitting a
  realistic island (not Neon Arcade inside the 3D view, as with the experiments'
  dioramas); the hub card keeps site styling.
- **Save/load** in localStorage, versioned (call).
- **Licence:** open, MIT `LICENSE` in `games/colony-sim/` (call: the repo default;
  the CD can mark it protected).
- Hub card in `games/index.html` + `GAMES[]` entry, row in `.claude/games-index.md`.

### Testing and tuning (CD: "Phase 1 always succeeds, number of days varies")
- A headless runner (`node games/colony-sim/tools/run.mjs --seeds 50 --days 30`,
  call) loads the sim modules and reports per seed and in aggregate: days to the
  phase 1 finish line, the lowest point of each meter and who hit it, collapses,
  lessons learned and when, refusals, idle time, critical-path stalls.
- **Phase 1 targets (call, to be confirmed with the CD on the first numbers):** 50
  of 50 seeds finish; median about 12 days, range about 9-16; at least one
  "struggle" moment per run (a settler under 30% on some meter) and at least two
  lessons learned.
- A determinism check: the same seed run twice gives identical state hashes every
  game hour.
- A browser drive suite in `.claude/tests/` for the rendered page (camera, follow,
  panel, reorder, speed), following the repo's test conventions.

## Build steps (the roadmap; mirrored in TODO.md § Colony Sim)

Each step ends with a playable page the CD plays, and (from step 2) a headless
report. Steps are drafts: the CD reorders them.

1. **CS-1 Landing (first playable).** The build pipeline; island v1 (terrain,
   sandy/rocky shores, cliffs, forest, loose rock, the waterfall and pond present
   but unexplored); sky and day/night; four fleshed-out settlers walking on
   terrain; camera orbit/zoom/pan, follow dropdown, settler panel (read-only list);
   the sim with all meters, sleep, eat, bathroom, ocean bath, forage, chop, gather
   rock, campfire and lean-to; the leader cooking and tidying; speed control and
   pause; seeded determinism and the headless runner's first report.
2. **CS-2 Minds and control.** Attributes, preferences, fears, goals; lessons
   learned by trial and error with INT/WIS learning speed; refusals with speech
   bubbles; relationships; leader delegation from the **goals board (A)**;
   **reordering (B)**.
3. **CS-3 Building and tools.** The architect: designs, sites and builds in stages
   (hut, beds, food store, storage, latrine, drying rack, tool maintenance bench);
   tool wear 100% → 50% and maintenance; the **phase 1 finish line**, and the first
   tuning pass to the targets above.
4. **CS-4 The wild island.** Hunting, trapping, fishing; fauna including the first
   animal that can hurt; difficult rocky terrain; exploration and discovery (the
   waterfall pond for swimming and bathing); temporary camps for long journeys.
5. **CS-5 Phase 2: newcomers.** Unlocks; inviting settlers and the supply boat;
   ordering gear; mortal newcomers; noticing missing settlers, rescue by two, by
   one with aid; death and its mood cost; teaching lessons; food pressure and
   hunting parties.
6. **CS-6 Caves and special buildings.** Cave exploration, special materials,
   special buildings and equipment and their maintenance; the leader's micromanage
   skill unlocks **direct orders (C)**.
7. **CS-7 Power.** Electricity generation (hydro at the waterfall, solar, thermal),
   ordering power tools, what they change.

## Left to the builder
Tick rate and sim step; the effectiveness combination rule per activity; the
lesson data model; job/task planner design (utility scoring, GOAP or hand-written
planners); exact terrain generator; capsule counts and clothing shapes; UI layout;
save format; numbers in every tuning table (set by headless measurement, never
guessed). Each is recorded in this file when decided.

## As built (first draft, 2026-11-26)

Plan: `.claude/plans/colonysim.phase1-draft.md`. Everything the plan or this file left open was
decided by Claude on the CD's instruction ("Make any decisions on your own"); the calls are
listed under § Calls made while building.

### Files
| File | What it holds |
|---|---|
| `src/rng.js` | sfc32 named streams with saveable state; `hashState` |
| `src/island.js` | `genIsland(seed)`: heightfield + cover grid (2 m cells, 500 x 350), the camp flattened on the south shore, a 20 m scarp ~420 m inland with two 80 m ramps, the pond and falls at its foot, a river to the west coast, rocky shores and scree; trees, loose rocks, berry bushes. `heightAt`, `coverAt`, `slopeAt`, `walkCost` |
| `src/nav.js` | 4 m A* grid (cost = slowest ground in the cell), connected regions (`comp`/`main`), string-pulling, `pathTime`; `WALK` = 1/30 m per game second |
| `src/data.js` | every number (`TUNE`), the founders, buildings (cost, hours, slot), goals, lessons, refusal and learned lines |
| `src/brain.js` | decisions: `needOf` (urgent vs soft needs), `think`, `checkInterrupts`, the leader (`ensureSites`, `nextWork` by role), `makeTask` (every job as steps), lessons (`learnEvent`, `learnChance`), the player's inputs (`applyPlayerInput`) |
| `src/sim.js` | the engine: clock, `drain` (needs, accidents, collapse, perseverance), movement, step execution and effects (`FX`), food batches and spoilage, buildings, tools, nightly review, discovery, the phase 1 check, `step`/`runFor`/`replay`, `snapshot`/`restore` |
| `src/rig.js` | `ik2` + `buildPose` copied from Animation Rigs (A002 form); planted feet on the heightfield; work poses (chop, mine, build, crouch jobs, sit/eat, lie, bathe, fish, look, talk); `rigCapsules` (body, hair styles, beard, hat, the tool in hand) |
| `src/sky.js` | **generated, do not edit**: zmh-sky's drop-in as an ES module (`emit --format esm --mag 5 --parts stars,planets,glsl,webgl`; the command is its first line). Regenerate from the zmhstudio checkout or the plugin cache, then rebuild |
| `src/render.js` | WebGL2: terrain mesh, sea/pond/river/falls, instanced boxes (scenery, buildings by stage, piles, loads), instanced capsules, zmh-sky's sky pass (`createSky`) lighting the scene from its sun, moon and ambient, firelight, blob shadows and the selection ring; orbit/pan/zoom/flyTo, `project`, `pickGround` |
| `src/ui.js` | top bar, goals board (A), settler panel with Now/Next (B), speech bubbles, info/settings/phase 1/continue overlays; panels rebuilt by part from signatures |
| `src/audio.js` | surf, birds, crickets, axe thunks; mute persisted |
| `src/main.js` | boot, fixed-step accumulator (48 game seconds per real second at 1x, at most 400 ticks a frame), interpolation, input, follow, autosave every game hour |
| `build.mjs` | each module becomes its own `{ }` block; exported names are declared once outside (the build fails if two modules export one name); imports are dropped |
| `tools/test-sim.mjs` | 70 headless checks (rng, island, nav, sim, minds, review fixes, economy, rig) |
| `tools/run.mjs` | the tuning runner: `--seeds N --from S --days D [--bad]` |

### Architecture notes
- **A tick is 10 game seconds.** The page runs `48 x speed` game seconds per real second
  (a 30-minute day at 1x) and interpolates positions between ticks; at 16x a frame may run
  about 8 ticks, and any backlog over 400 ticks in one frame is dropped (a hidden tab never bursts).
- **Needs: urgent vs soft.** Urgent ones (bladder, bowel, energy below the learned stop point,
  hunger below the learned eat point) interrupt work every 5 game minutes. Soft ones
  (bedtime, mealtimes, washing, rest) wait for the current task to end, except that mealtimes
  and bedtime also interrupt a long job.
- **A player's order is "pinned"**: it suppresses every need until done (that is how the CD
  can make things worse: accidents, collapses), unless the settler has learned a lesson
  that covers any of their current needs (`learnedNeed`, which looks past a more urgent
  need and past a "Later" still running), in which case they refuse with a bubble and put the need first; the
  order then waits behind it.
- **The plan list** keeps the player's items and any paused task, and refills the leader's
  forecast (two items) every time the settler picks a new task. "Later" puts off sleep, a
  meal or a wash by an hour.
- **Lessons**: a lesson's number moves 60% of the way to its target each time it is learned;
  the chance to learn is `0.15 + 0.04 x ((INT + WIS)/2 - 10)` (0.1-0.6), multiplied by
  `1 + 0.3 x (times the mistake was made - 1)`, at most 0.9. Triggers: a collapse, an injury
  while exhausted or in the dark, a bad night after a late one, and a **nightly review** at
  21:00 in which any of energy, hunger, cleanliness or health that fell below 50 that day is
  a chance to learn its habit (lateNight, skipMeal, hygiene, overwork). When the leader learns
  "keep tools sharp" they move the tool bench to the top of the goals board.
- **Food**: batches with expiry (meals 2 days, 5 in the food store; dried 10-14). Three
  mealtimes; someone heading out after breakfast packs a lunch if the store can spare it; a
  forager or fisher far from camp eats from the basket. An empty larder sends a hungry
  settler to a berry bush.
- **One set of tools**: a job that needs the axe or the spear waits for it; the hammer and
  knife are optional (without them the work is 0.6x).
- **Determinism**: every random draw comes from a named stream in `sim.R`; inputs are stored
  with the tick they arrived on; `replay(seed, inputs, tick)` reproduces a game, and the save
  is a `snapshot` (streams included).

### The sky

- `src/sky.js` is zmh-sky's drop-in, generated: `node <zmhstudio>/plugins/zmh-sky/cli/zmh-sky.mjs emit --format esm --mag 5 --parts stars,planets,glsl,webgl --out games/colony-sim/src/sky.js` (or the newest plugin cache's `cli/zmh-sky.mjs`), then `node games/colony-sim/build.mjs`. Never `--keep-comments`; after regenerating, check it has exactly four `export const`, no `import` and no `</script`. `LICENSE-d3-celestial.txt` ships beside the page (stored LF) and the ⓘ panel's Sky section carries the attribution.
- `render.js` is the only place a date exists (`SKY_START`, `SKY_OBSERVER`, `SKY_FRAME`). The sim, the saves and `test-sim.mjs` never see it: `frame()` turns `sim.t` into a day index and an hour and asks `ZMH_SKY.gameClockToJd` for the instant.
- `frame()` calls `sky.update(jdUT)` first, so this frame's sun and moon light the opaque pass, then draws: clear to black, terrain, boxes and settlers, then `sky.draw`, then the water, then the discs. The sky goes **before** the water because the water writes no depth: drawn after it, the sky would paint over open sea.
- The sky pass is scissored to the rows where sky can show (`skyRows()`): SwiftShader shades a full-screen pass in full even where depth rejects it, and unscissored it nearly doubled the frame (210 to 400 ms) and starved the 16x clock. `sky.draw` is still called every frame, so the kit's handedness check runs even when no sky is in view.
- Fog is never sampled from the sky pass (the kit's "discs in the fog" trap): it is the mean of `ZMH_SKY.skyRadiance` over 8 azimuths at 2° altitude, display-mapped like the pass, plus the night airglow, recomputed once per game minute.
- `night` keeps its old meaning (from the sun's altitude), so the fire, the shadows and the crickets behave as before. `frame()` returns `{ night, light }`.
- Known kit trait: at nautical twilight (sun about −8°) the glow ends in a hard edge on the side away from the sun, because zmh-sky's `skyRadiance` is single scattering with a geometric Earth shadow. It is in the kit, not this page; logged upstream.
- The drive suite's six sky rows (frame, sunrise in the east north of east, camera-independence, stars, the moon's phase over the calendar, the ⓘ credit) were each shown red under a deliberate break.

## Measured (2026-11-26, `node games/colony-sim/tools/run.mjs`)
| Set | Finished | Median day | Range | A struggle (< 30 on a meter) | Median lessons |
|---|---|---|---|---|---|
| seeds 1-30 (tuned on) | 30/30 | 12.4 | 9-19.7 | 21/30 | 11 |
| seeds 31-60 (held out) | 30/30 | 12.9 | 9-16.4 | 24/30 | 11 |
| seeds 31-60, bad player (`--bad`) | 30/30 | 12.4 | 10-15.3 | 30/30 | 11 |

The bad player orders everyone to keep working at 22:30 and puts off sleep for three nights,
and moves the tool bench to last. It makes runs more miserable (7 collapses and 2 accidents
over 30 runs, a struggle in every run) without slowing them: the median and range barely
move, and earlier tuning runs put it anywhere from a day slower to a day faster. A bad player
hurts the founders more than the schedule. It doesn't stall them. Typical
shape: the camp is built by day 6-9; the rest is the founders learning to keep every meter
above 50 for two days (washing and bedtime are the usual last lessons).

## How to add
- **A job**: a `case` in `makeTask` (`brain.js`) made of `go`/`work` steps; any effect as an
  `FX` entry in `sim.js`; a label in `LABEL`; a pose in `workPose` (`rig.js`) if it needs one;
  then let a role pick it in `nextWork`.
- **A lesson**: a row in `LESSONS` (param, start, target, fmt) plus lines in `REFUSALS` and
  `LEARNED`; read it with `lessonParam(s, key)` where it matters; call
  `learnEvent(sim, s, key)` where the mistake shows (or map a meter to it in `REVIEW`).
- **A building**: a row in `BUILDINGS` (cost, hours, f/r slot, size, sleeps), a goal in
  `GOALS` (+ `DEFAULT_GOALS` if it should be on the board), and its parts in
  `buildDynamic` (`render.js`). Add it to `PHASE1_BUILDS` only if the finish line needs it.
- After any balance change: `node games/colony-sim/tools/run.mjs --seeds 30 --from 31` and
  the `--bad` run; update the table above.

## Calls made while building (the CD's to overrule)
- 30-minute days (the 15 first proposed would have made the waterfall a 10-hour walk).
- Phase 1's finish line excludes bladder and bowel; the drying rack is on the board but not
  required.
- The nightly review and the experience-weighted learning chance (without them the
  48-hour window almost never closed).
- Three mealtimes, packed lunches, eating from the basket.
- Building costs and hours (x1.5 and x1.6 over the first numbers, so the camp is the main arc).
- The hunter scouts inland once two days of food are stored; finding the pond gives a swim and
  a mood lift. The pond is about four hours away, so it is not a regular bath yet.
- Buildings do not block walking. Their walls have door gaps drawn, but the nav grid ignores them.
- The sky (plan colonysimc, 2026-11-26): 15°S 150°W, day 1 = 5 July 2027 (two days after a new moon, so full around day 14-16), local mean solar time, frame +x east / +y up / −z north (the island's own compass), no constellation lines, a night ambient floor so settlers stay readable on a moonless night (tuned SUN_GAIN 1.8, AMB_GAIN 1.4, NIGHT_FLOOR [0.035, 0.042, 0.075] in render.js, against screenshots of the old build), fog coloured from the disc-free sky radiance at the horizon.
- Speech bubbles last 8 real seconds, one per settler, four at most.
- Horizontal drag rotation was inverted at the CD's request (2026-11-26, mouse and one
  finger); Q / E keep the direction they had (the CD named the drag only).

## Known limits of the draft
- Settlers walk through buildings and each other.
- No weather, seasons, visible animals (rabbits are a number in a snare) or animals that hurt
  (CS-4).
- No inviting settler 5: the phase 1 screen says so. Everything after phase 1 is undecided (CD).
- At 16x, walkers whose on-screen speed passes 6 m/s switch to a sliding gait cycle.
- Left from the final review, as minors: starting a new island does not free the old
  island's GPU buffers; the camera's fly-to runs per frame, not per second, so it is faster
  at 120 Hz; a followed settler under forest canopy can be hidden (no canopy fade).
- How this draft was tuned, and every bug the final review found with its root cause:
  `.claude/notes/20261126-colony-sim-a-watched-simulation.md`.
- Saves are kept in this browser only. A save is checked whole (`validateSnap`) and run one
  step on a copy before it is loaded; one that fails is set aside under `colonySim.bad`.
- Removing a goal removes its unfinished sites and returns their materials to storage.
