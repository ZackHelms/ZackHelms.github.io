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

### CROISSANT CLICKER (`croissant-clicker.html`, ~850 lines)
Cookie Clicker-style idle/incremental. Click to bake, buy 10 tiers of
buildings, unlock click/building upgrades and achievements, catch golden
croissants for bonuses. A Boosts tab has 3 independent repeatable purchases
(Money %, Speed %, flat Click Power). 5 sequential permanent Medals (Bronze
through Diamond) each add +30/50/100/500/1000% to both money and click power,
escalating in cost, and never reset (not even by Rebirth). Rebirth grants
Golden Butter (+1% click speed / +1% money each) based on production since
your last rebirth, and genuinely stacks across repeated rebirths; a deeper
Big Rebirth converts Golden Butter into Chicken Croissants (+400% money each,
compounding). DOM-driven UI with a canvas overlay for click particles.
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

---

## Adding a New Game

1. Create `games/<slug>.html` as a single self-contained file
2. Add a card to `games/index.html` (copy an existing card, update icon/name/desc/href)
3. Add the build-timestamp badge (see above) with the current UTC timestamp
4. Create `.claude/<slug>.md` with architecture notes before the session gets long
5. Commit and push to `main`, stating the badge timestamp in your reply
