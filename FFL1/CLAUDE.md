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

## game.html current state (v002)

- 160×144 canvas, CSS `transform:scale()` to fit shell screen area
- Renders `img/title_screen.png` on load; fallback is solid DMG color #9BBC0F
- Game Boy shell layout: `#screen-area` at `top:7.5%; left:1.5%; width:97%; height:43%`
- Touch zones for all 8 buttons; debug mode via `?debug` param or DBG button
- No game logic yet — title screen display only

## emulator.html

- EmulatorJS wrapper using gambatte core
- Requires ROM at `rom/ffl1.gb` (gitignored); shows a notice if absent
- Same shell layout and touch zones as game.html
- Select button: `data-key="ShiftLeft"` (gambatte binding, differs from game.html's `Escape`)
