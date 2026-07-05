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

### CROISSANT CLICKER (`croissant-clicker.html`, ~700 lines)
Cookie Clicker-style idle/incremental. Click to bake, buy 10 tiers of buildings,
unlock click/building upgrades and achievements, catch golden croissants for
bonuses, rebirth for permanent +1% click speed / +1% money per Golden Butter.
DOM-driven UI with a canvas overlay for click particles. Detailed context:
`.claude/croissant-clicker.md`.

### BASKETBALL CLICKER (`basketball-clicker.html`, ~1550 lines)
Cookie Clicker-style idle/incremental themed around building a basketball
program. Currency is money; click the ball to earn it. The first shop item,
Clicker, spawns an auto-clicking pointer finger every 5s and grants +5 click
power per 10 owned. Buy 29 more recruiter buildings (30 total, up to The
Basketball Singularity), plus 51 one-time upgrades across Click Upgrades,
Player Types, Assistant Coaches, and Mutations (each targets click power,
passive income, or both) and Facility (building-tier) upgrades. The UPGRADES
tab shows only the single next unpurchased upgrade per category — visible
even when locked, with its unlock requirement shown — rather than a full
list. Mutations are themed as a sequence (Gold, Radiation, Neon, Plasma,
Crystal, Inferno, ...). A Fans tab sells 5 rarity-tiered fan types
(Common → Mythic) that each add a small production %, capped by Stadium
level (leveling the stadium raises the fan cap and adds a flat production
bonus). A Mascot levels up independently for its own production bonus,
evolving through named tiers at milestones. A Totems tab mirrors Fans but
boosts click power instead, using the same Gold/Radiation/Neon/Plasma/Crystal
theme sequence, capped by a separately-levelable Totem Pole. Every 100 taps
of the ball triggers a "Team Win" bonus payout. Golden basketballs still
spawn for frenzy/lucky bonuses, and championship ascension grants permanent
prestige multipliers. DOM-driven UI with a canvas overlay for click
particles.

---

## Adding a New Game

1. Create `games/<slug>.html` as a single self-contained file
2. Add a card to `games/index.html` (copy an existing card, update icon/name/desc/href)
3. Create `.claude/<slug>.md` with architecture notes before the session gets long
4. Commit and push to `main`
