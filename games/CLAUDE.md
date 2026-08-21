# Games — Shared Context

Each game is a **single self-contained HTML file** (inline CSS + JS, no external
libraries). Work on each game happens in a **dedicated Claude Code session**.
Detailed context for individual games lives in `.claude/<game>.md` at the repo root.

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
| Canvas sizing | A fullscreen canvas needs explicit CSS `width:100%;height:100%` — `position:absolute;inset:0` alone does NOT stretch a replaced element, it renders at its intrinsic (dpr-scaled) attribute size and the page looks 2–3× zoomed. A layout that rescales stored positions by a relative factor (newCell/oldCell) must floor the derived scale above zero AND make repeated calls strict no-ops: a transient degenerate viewport once drove phasic's cell size negative, and a `oldCell>0` guard then silently dropped every healing rescale — the squish became permanent until reload (2026-07-31 rotation bug) |
| Canvas-drawn UI | Buttons/cards drawn on the canvas keep their hitbox arrays (`cardRects`-style) in JS — any branch that hides the widgets MUST clear the arrays too, or invisible stale hitboxes swallow taps (2026-07-24 grid-defense bug) |
| Audio | WebAudio-synthesized only (no audio files): lazy AudioContext on first gesture (iOS), `sfxGain`/`musicGain` masters, oscillator/noise SFX + lookahead-sequencer music loop, persisted 🔊/🔇 mute top-left, suspend on `visibilitychange` (SFX+music standard for **every** game — retrofitted repo-wide 2026-07-24). Shared buffers (noise etc.) are created in `audioInit`, never lazily inside one SFX (another consumer stays silent); overlay/menu tap handlers call `audioInit()` too — the first iOS gesture is usually a DOM button, not the canvas |
| Back button | Every game has a top-left ← link back to the games hub, left-most control, mute button immediately to its right — see § Hub Back Button |
| Chrome above overlays | The ← and 🔊 buttons must sit at a **higher z-index than any full-screen overlay** (menu / game-over / win). Give the chrome `z-index:80` and overlays `70`. Otherwise the overlay swallows both, and since music is usually playing *behind* a menu or win screen, the player cannot mute exactly when they most want to (2026-07-25: shipped that way in locksport, caught by a drive test that could not tap `#mute-btn` after a reload) |
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
3. State that exact timestamp string in your reply when you report the
   update as complete, so the user can compare it against what renders live
   once deployed.

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

### TURRET BUILDER (`turret-builder/index.html`, ~2300 lines)
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
endless. **No gameplay randomness at all.** Detailed context:
`.claude/turret-builder.md`. Suites: `.claude/tests/drive-turret-builder.cjs`
(146 rules checks, the spec asserted to the decimal off a damage ledger) and
`.claude/tests/eval-turret-builder.cjs` (21 balance claims via personas).

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

### STAR SURGE (`star-surge/index.html`, ~1060 lines)
Vertical shmup: drag-steer, hold-to-fire, 5 stages × 3 waves + boss (bosses
are persisted checkpoints). Drones/shooters/spinners/tankers, aimed and
ring bullet patterns under a 90-bullet cap, P/S/G powerups (weapon tiers,
shield, surge bomb), stage-hued enemies. 20-track adaptive soundtrack
(webaudio-score/v1 data + compiler + look-ahead scheduler, escalating
calm → combat → boss per wave, `NN · TITLE` now-playing label) — see
`.claude/scripts/star-surge-music/` to refine a track. Detailed context:
`.claude/star-surge.md`.

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
proprietary** — its own LICENSE + a scope-exception preamble in the root
LICENSE.txt (settings-cogwheel link, wiki footer). Drive suite (289 checks
incl. the generated-content replay gate, the in-path weave gates, the
complexity-ramp assert, rotation/landscape geometry checks and the
settled-freeze regressions):
`.claude/tests/drive-phasic.cjs`. Detailed context: `.claude/phasic.md`
(includes the maintained tactics registry).

### SIGNAL HUNT (`signal-hunt/index.html`, ~790 lines)
The repo's first **async-versus** game. Eight rogue signals hide among ~350
decoys on a 1100×1900 circuit grid; each target is an exact shape+colour pair
and every decoy shares one attribute but never both (a conjunction search).
Drag to pan, pinch to zoom, tap to lock; decoy taps cost 4 s, empty grid is
free. 90-second rounds as DAILY GRID, FREE HUNT, or a duel: an 11-char
checksummed code carries seed + score, so a friend replays your exact grid and
the game reports the head-to-head. LABELS assist stamps a unique letter per
colour for a colour-free hunt. Detailed context: `.claude/signal-hunt.md`.

---

## Adding a New Game

1. Create `games/<slug>.html` — or `games/<slug>/index.html` (own
   subdirectory; used by Merge Drop and Neon Golf) — as a single
   self-contained file either way
2. Add a card to `games/index.html` (copy an existing card, update
   icon/name/desc/href) — pick an icon emoji **not already used** by another
   card (e.g. Sorcery already owns 🔮) — **and add the game's entry to the
   hub's `GAMES` facet dataset** (same file, § coverage heuristics script;
   it mirrors the games-index row and feeds the 📊 COVERAGE HEURISTICS
   dashboard — a drive test asserts cards ↔ dataset stay in sync)
3. Add the standard hub back button (see § Hub Back Button) — ← top-left,
   mute button to its right — and the WebAudio SFX + music stack per the
   Audio convention row
4. Add the build-timestamp badge (see above) with the current UTC timestamp
5. Create `.claude/<slug>.md` with architecture notes before the session gets long
6. Add the game's row to `.claude/games-index.md` **and refresh its coverage
   summary** (facet vocabulary: `templates/design/game-facets.md` in the
   zmhstudio repo) — when *choosing* what game to build, read that index's
   coverage summary first
7. Run both gates:
   - `node .claude/scripts/smoke-mobile.cjs <pages...>` — every changed page
   - `node .claude/scripts/check-games-sync.cjs` — proves the hub card, the
     hub `GAMES[]` entry and the games-index row you just wrote actually agree
     (and that the count line adds up). No Chromium needed.
   (see `.claude/scripts/README.md`)
8. Commit and push to `main`, stating the badge timestamp in your reply
9. Verify the "pages build and deployment" workflow for the pushed SHA goes
   green — `git push` ≠ live; a failed Pages build silently keeps serving
   the previous deploy
