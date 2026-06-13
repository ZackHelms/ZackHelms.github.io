# FFL1 Project Overview

## What is this?
A web port and mechanics wiki for **Final Fantasy Legend 1** (Game Boy, 1989), also known as SaGa 1 (Makai Toushi Sa·Ga) in Japan.

## Directory Structure
```
FFL1/
  .claude/          ← Context files for Claude (you are here)
    overview.md     ← this file
    rom-map.md      ← PRIMARY verified ROM reference (offsets, strides, confidence levels)
    rom-data.md     ← legacy ROM notes (superseded by rom-map.md; keep for historical context)
    sources.md      ← source reliability guide + tool recommendations for ROM research
    mechanics.md    ← what has and has not been extracted from ROM
    engine.md       ← v001 JS engine architecture (archived reference)
  img/              ← ROM-extracted and authored graphics
    title_screen.png        ← 160×144 lossless PNG; editable pixel-by-pixel
    title_screen_5x.png     ← 800×720 nearest-neighbor upscale (reference)
    tile_sheet_1bpp_large.png ← 119 font tiles from ROM 0x0F100, indexed
    bank2_tile_grid.png     ← 1024 2bpp graphics tiles from Bank 2
    gameboy.png             ← Shell background image
  rom/              ← ROM binary (gitignored — place ffl1.gb here for emulator)
  data/             ← Game data files
    monsters.json   ← 200 monsters: name, HP, STR, DEF, AGI, MANA, gold — all HIGH confidence from ROM
    abilities.json  ← 252 abilities/items/weapons: name + type — FROM ROM
    dialog.md       ← story intro text; marked MEDIUM confidence (web-sourced; ROM location unknown)
    dialog.json     ← 251 NPC dialog strings DTE-decoded from ROM 0x14F3E (MEDIUM confidence)
  v001/             ← Archived first-pass JS game engine (not actively developed)
    game.html, js/, css/, data/
  index.html        ← Hub page (tythos.com/FFL1/)
  general.html      ← Mechanics wiki (ROM data only)
  monsters.html     ← Monster database (ROM data)
  mutants.html      ← Ability database (ROM data)
  humans.html       ← Armor and usable item name list (ROM data)
  items.html        ← Full item name/type database (ROM data)
  game.html         ← v002: Game Boy shell + 160×144 canvas; state machine title→class→name→story→world
  emulator.html     ← EmulatorJS wrapper (requires ffl1.gb in rom/)
  TODO.md           ← Pending features, ROM data gaps, correctness bugs
```

## ROM-Extracted Data
Data files directly sourced from the ROM binary:
- `monsters.json` — **names (HIGH)** from 0x14000; **HP (HIGH)** from 0x1B254; **STR/DEF/AGI/MANA (HIGH)** re-extracted with verified 9-byte stride at 0x1AAE8; **gold (HIGH)** from BCD table at 0x1B2A4 via lower nibble of stat byte 6; **ability_ids (HIGH)** decoded from packed ability lists at 0x1B321+; **encounter_tier (MEDIUM)** from upper nibble of stat byte 6; **num_abilities** derived from ability_ids length
- `abilities.json` — names and type bytes from 0x14640 (HIGH confidence); **power/defense/heal** from item stat table X field (HIGH); **element** from Y field (MEDIUM); **slot** from FlagsA bits (HIGH); **gp** from 0x17E10 BCD table (HIGH); **uses** from AltUses byte +3 at 0x1B700 (HIGH)
- `img/title_screen.png` — 160×144 pixel-accurate title screen (nearest-neighbor from emulator screenshot)
- `img/tile_sheet_1bpp_large.png` — 119 font tiles from ROM offset 0x0F100
- `img/bank2_tile_grid.png` — 1024 graphics tiles from ROM offset 0x08000

Everything else in `data/` (v001 data files) was generated to support the JS game engine and
should not be treated as authoritative for the original game's mechanics.
See `rom-map.md` for the primary verified ROM reference (replaces rom-data.md for new work).
See `mechanics.md` for the full list of what has and has not been extracted.
See `sources.md` for source reliability rankings and ROM research tool guidance.

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
