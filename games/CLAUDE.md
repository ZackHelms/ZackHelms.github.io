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
bonuses, ascend for permanent prestige multipliers. DOM-driven UI with a canvas
overlay for click particles. Detailed context: `.claude/croissant-clicker.md`.

---

## Adding a New Game

1. Create `games/<slug>.html` as a single self-contained file
2. Add a card to `games/index.html` (copy an existing card, update icon/name/desc/href)
3. Create `.claude/<slug>.md` with architecture notes before the session gets long
4. Commit and push to `main`
