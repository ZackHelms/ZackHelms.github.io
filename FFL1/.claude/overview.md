# FFL1 Project Overview

## What is this?
A web port and mechanics wiki for **Final Fantasy Legend 1** (Game Boy, 1989), also known as SaGa 1 (Makai Toushi Sa·Ga) in Japan.

## Directory Structure
```
FFL1/
  .claude/          ← Context files for Claude (you are here)
  data/             ← Game data files
    monsters.json   ← 200 monsters: name, HP, STR, DEF, AGI, MANA — FROM ROM
    abilities.json  ← 252 abilities/items/weapons: name + type — FROM ROM
    items.json      ← Weapons, armor, spells, usable items (categorized from abilities.json)
                       NOTE: stat_bonus, base_power, uses, stat_used, element fields are
                       INFERRED, not extracted from ROM. Do not use as a mechanics reference.
    transformation.json ← Monster family system — family names from ROM index analysis;
                          transformation rules (eat count, trigger) NOT from ROM
    world.json      ← World structure — NOT from ROM; designed for game engine use
    shops.json      ← Shop inventories — NOT from ROM
    encounters.json ← Random encounter tables — NOT from ROM
    dialogue.json   ← Story text and NPC dialogue — NOT from ROM
  js/               ← Game engine JavaScript modules
  css/              ← Shared styles
  index.html        ← Hub page (tythos.com/FFL1/)
  general.html      ← Mechanics wiki (ROM data only)
  monsters.html     ← Monster database (ROM data)
  mutants.html      ← Ability database (ROM data)
  humans.html       ← Armor and usable item name list (ROM data)
  items.html        ← Full item name/type database (ROM data)
  game.html         ← Playable JS port
```

## ROM-Extracted Data
Only two data files are directly sourced from the ROM binary:
- `monsters.json` — names from 0x14000, HP from 0x1B254, stats from 0x1AAE8
- `abilities.json` — names and type bytes from 0x14640

Everything else in `data/` was generated to support the JS game engine and
should not be treated as authoritative for the original game's mechanics.
See `mechanics.md` for the full list of what has and has not been extracted.

## Key Design Decisions
- **Data-first**: All game data lives in `data/*.json` — edit those to mod the game
- **Performance**: JS modules load data once; no re-fetching; Canvas 2D rendering
- **Style**: Matches site palette — dark background (#06060e), neon accents (see css/style.css)
- **Domain**: Hosted at tythos.com/FFL1/ (GitHub Pages with custom domain)

## Working on This
- Read the relevant context file before editing game systems
- `monsters.json` and `abilities.json` are ROM-extracted; all other data files are not
- For game engine changes, see `engine.md`
- For ROM data reference (offsets, encoding, byte layouts), see `rom-data.md`
- For mechanics reference (what is and isn't extracted), see `mechanics.md`
