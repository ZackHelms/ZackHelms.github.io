# FFL1 — Claude Instructions

## Context files

Before working on any FFL1 task, read the relevant `.claude/` file:

| File | When to read |
|---|---|
| `.claude/overview.md` | Project structure, current state, what's ROM-extracted vs. invented |
| `.claude/rom-data.md` | ROM offsets, banking, tile/graphics data, img/ directory inventory |
| `.claude/mechanics.md` | What game mechanics have and have not been extracted from ROM |
| `.claude/engine.md` | v001 JS engine architecture (archived reference) |

---

## SOP: After any ROM exploration session

**Every time** you explore the ROM binary (tile dumps, data extraction, disassembly, image generation), do the following before ending the session:

### 1. Document findings in context files
- **New data offsets or formats** → add to `.claude/rom-data.md` under the appropriate section
- **New graphics extractions** → add a row to the `img/ Directory Contents` table in `rom-data.md`
- **Mechanics confirmed or ruled out** → update the Extracted / Not Yet Extracted lists in `.claude/mechanics.md`
- **Project structure changes** (new files, archives, new directories) → update `.claude/overview.md`

### 2. Clean up intermediate analysis files
Intermediate analysis PNGs, debug dumps, and one-off scripts created during exploration are **not committed**. Delete them before or instead of committing:
```bash
# Example: remove untracked files in FFL1/img/ that are not deliverables
git ls-files --others --exclude-standard FFL1/img/ | xargs rm -f
```
Deliverables (authoritative extracted images) **are committed**. The test: would a future session want this file, or was it just scaffolding?

### 3. Commit and push
Commit the context file updates and any new deliverable assets together in one commit with a clear message like `docs: document tile data from ROM exploration session`.

---

## ROM extraction principles

- **Never invent data** — if a mechanic, value, or layout hasn't been confirmed from the ROM binary, mark it as NOT extracted in `mechanics.md` rather than guessing
- **BG tilemaps are dynamic** — the Game Boy title screen (and likely other screens) builds its BG map at runtime; don't search for a static BG tilemap in ROM for text-based screens
- **Bank switching** — this ROM uses `RST 0x28` with A = bank number (not a standard MBC write); file offset = bank × 0x4000; CPU address is always 0x4000–0x7FFF for banks 1–7
- **1bpp font tiles** — stored as 8 bytes/tile; startup code doubles each byte to both VRAM bitplanes, yielding 2bpp color 0 or color 3 only
- **When a screenshot is available**, nearest-neighbor resize to 160×144 is the fastest accurate extraction path for screen images; always save as lossless PNG
- **Python + Pillow** is the tool of choice for ROM analysis scripts; save scripts to `/tmp/` (not the repo) unless they're a permanent extraction utility

---

## SOP: Resizing UI elements

**Always maintain aspect ratio** when resizing any visual element (game screen, canvas, containers) unless the user explicitly says otherwise.

### Resizing the game screen

The game screen (`#screen-area` in game.html, `#emulator-container` in emulator.html) uses:
- `width: W%` — controls game size; this is the only value to change for resizing
- `aspect-ratio: 160 / 144` — enforces Game Boy pixel ratio automatically
- `left: 50%; transform: translateX(-50%)` — centers horizontally always
- `top: T%` — must be recalculated when width changes to keep vertical center fixed

**Why `top` must change with `width`:** the container height is derived from width × (144/160). To keep the vertical center at the same point, recalculate `top` each time:

```
image aspect ratio:  682/316 = 2.158  (gameboy.png height/width)
screen hole center:  29% of layer height  (empirically calibrated)

element_height% = W% × (316/682) × (144/160) = W% × 0.417
top = 29% − element_height% / 2  = 29% − (W% × 0.2085)
```

| width% | element height% | top% |
|--------|----------------|------|
| 80%    | 33.4%          | 12.3% |
| 85%    | 35.4%          | 11.3% |
| 88%    | 36.7%          | 10.65% |
| 90%    | 37.5%          | 10.25% |
| 95%    | 39.6%          | 9.2%  |

**Why `height: XX%` doesn't work for resizing:** the gameboy.png "screen hole" is a dark teal body color, not transparent/black. The `background: #000` on the container made size changes invisible. Using `aspect-ratio` and a smaller `width` lets the gameboy bezel show around the game canvas, making size changes visible.

---

## game.html current state (v002)

- 160×144 canvas, CSS `transform:scale()` to fit shell screen area
- Renders `img/title_screen.png` on load; fallback is solid DMG color #9BBC0F
- Game screen: `#screen-area` at `top:10.65%; left:50%; width:88%; aspect-ratio:160/144; transform:translateX(-50%)`
- Touch zones for all 8 buttons; debug mode via `?debug` param or DBG button
- Off button (⏻, top-left): shows power-off confirm overlay; navigates to `index.html` on confirm
- Reset button (↺, top-right): redraws title screen; A+B+Select+Start combo also triggers reset
- No game logic yet — title screen display only

## emulator.html

- EmulatorJS wrapper using gambatte core
- Requires ROM at `rom/ffl1.gb` (gitignored); shows a notice if absent
- Same shell layout, touch zones, off/reset buttons as game.html
- Select button: `data-key="ShiftLeft"` (gambatte binding, differs from game.html's `Escape`)
- Screen: `#emulator-container` at same position/size as `#screen-area` in game.html
- Reset fires A+B+Select+Start key combo to EmulatorJS (100ms hold)
