# FFL1 Project Overview

## What is this?
A web port and mechanics wiki for **Final Fantasy Legend 1** (Game Boy, 1989), also known as SaGa 1 (Makai Toushi Sa·Ga) in Japan.

## Directory Structure
```
FFL1/
  .claude/          ← Context files for Claude (you are here)
  img/              ← ROM-extracted and authored graphics
    title_screen.png        ← 160×144 lossless PNG; editable pixel-by-pixel
    title_screen_5x.png     ← 800×720 nearest-neighbor upscale (reference)
    tile_sheet_1bpp_large.png ← 119 font tiles from ROM 0x0F100, indexed
    bank2_tile_grid.png     ← 1024 2bpp graphics tiles from Bank 2
    gameboy.png             ← Shell background image
  rom/              ← ROM binary (gitignored — place ffl1.gb here for emulator)
  data/             ← Game data files
    monsters.json   ← 200 monsters: name, HP, STR, DEF, AGI, MANA — FROM ROM
    abilities.json  ← 252 abilities/items/weapons: name + type — FROM ROM
  v001/             ← Archived first-pass JS game engine (not actively developed)
    game.html, js/, css/, data/
  index.html        ← Hub page (tythos.com/FFL1/)
  general.html      ← Mechanics wiki (ROM data only)
  monsters.html     ← Monster database (ROM data)
  mutants.html      ← Ability database (ROM data)
  humans.html       ← Armor and usable item name list (ROM data)
  items.html        ← Full item name/type database (ROM data)
  game.html         ← v002: Game Boy shell + 160×144 canvas; shows title_screen.png
  emulator.html     ← EmulatorJS wrapper (requires ffl1.gb in rom/)
```

## ROM-Extracted Data
Data files directly sourced from the ROM binary:
- `monsters.json` — names from 0x14000, HP from 0x1B254, stats from 0x1AAE8
- `abilities.json` — names and type bytes from 0x14640
- `img/title_screen.png` — 160×144 pixel-accurate title screen (nearest-neighbor from emulator screenshot)
- `img/tile_sheet_1bpp_large.png` — 119 font tiles from ROM offset 0x0F100
- `img/bank2_tile_grid.png` — 1024 graphics tiles from ROM offset 0x08000

Everything else in `data/` (v001 data files) was generated to support the JS game engine and
should not be treated as authoritative for the original game's mechanics.
See `mechanics.md` for the full list of what has and has not been extracted.
See `rom-data.md` for tile/graphics offsets and the img/ directory inventory.

## Key Design Decisions
- **Data-first**: All game data lives in `data/*.json` — edit those to mod the game
- **Performance**: JS modules load data once; no re-fetching; Canvas 2D rendering
- **Style**: Matches site palette — dark background (#06060e), neon accents (see css/style.css)
- **Domain**: Hosted at tythos.com/FFL1/ (GitHub Pages with custom domain)

## Working on This
- Read the relevant context file before editing game systems
- `monsters.json` and `abilities.json` are ROM-extracted; v001 data files are not
- For ROM data reference (offsets, encoding, byte layouts, tile/graphics data), see `rom-data.md`
- For mechanics reference (what is and isn't extracted from ROM), see `mechanics.md`
- For v001 engine architecture reference (archived), see `engine.md`
- **SOP**: See `FFL1/CLAUDE.md` for the standing procedure after any ROM exploration work
