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
| Rendering | Canvas 2D, `requestAnimationFrame` loop, delta-time capped at ~100 ms |
| Input | Touch + mouse events, `user-select:none`, `touch-action:manipulation` |
| No dependencies | Zero external JS libs; Google Fonts is the only external resource |
| Responsive | Portrait/landscape via `@media (orientation:landscape)` or `100dvh` layout |
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

## Games Inventory

### STICK WARS (`stick-wars.html`, ~1500 lines)
Wave-based brawler. Player character vs 10 waves of stick enemies. Collect coins,
unlock upgrades between waves. Canvas 2D, side-scrolling combat. ~60 functions.

### TOWN BUILDER (`town-game-1.html`, ~1000 lines)
Isometric town-building sim. Place buildings, grow settlement, manage resources.
Isometric grid projection, click-to-place mechanics. Lighter codebase (~6 functions).

### HORSE RACE (`horse-race.html`, ~735 lines)
Tap to drop carrots; four horses race to claim them. Tap-driven speed mechanic.
~16 functions; simpler state machine.

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
~54 functions. `stick-commander-3d.v001.html` is a saved checkpoint.

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
subdirectory. Detailed context: `.claude/merge-drop.md`.

### NEON GOLF (`neon-golf/index.html`, ~660 lines)
9-hole drag-back-and-release mini-golf. Holes are data entries in a fixed
100×160 unit space; hazards: walls, over-unity bumpers, sand, water
(+1 stroke), boost pads, oscillating mover walls. Par scoring, scorecard,
best-round persistence. Detailed context: `.claude/neon-golf.md`.

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

---

## Adding a New Game

1. Create `games/<slug>.html` — or `games/<slug>/index.html` (own
   subdirectory; used by Merge Drop and Neon Golf) — as a single
   self-contained file either way
2. Add a card to `games/index.html` (copy an existing card, update
   icon/name/desc/href) — pick an icon emoji **not already used** by another
   card (e.g. Sorcery already owns 🔮)
3. Add the build-timestamp badge (see above) with the current UTC timestamp
4. Create `.claude/<slug>.md` with architecture notes before the session gets long
5. Run the smoke gate on every changed page:
   `node .claude/scripts/smoke-mobile.cjs <pages...>` (see `.claude/scripts/README.md`)
6. Commit and push to `main`, stating the badge timestamp in your reply
7. Verify the "pages build and deployment" workflow for the pushed SHA goes
   green — `git push` ≠ live; a failed Pages build silently keeps serving
   the previous deploy
