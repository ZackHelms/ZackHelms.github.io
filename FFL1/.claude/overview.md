# FFL1 Project Overview

## What is this?
A web port and mechanics wiki for **Final Fantasy Legend 1** (Game Boy, 1989), also known as SaGa 1 (Makai Toushi Sa·Ga) in Japan.

## Directory Structure
```
FFL1/
  .claude/          ← Context files for Claude (you are here)
  data/             ← All game data as editable JSON files
    monsters.json   ← 200 monsters: name, HP, STR, DEF, AGI, MANA (from ROM)
    abilities.json  ← 252 abilities/items/weapons (from ROM)
    items.json      ← Weapons, armor, spells, usable items (categorized)
    transformation.json ← Monster family system and transformation table
    world.json      ← World structure: 5 worlds, locations, bosses
    shops.json      ← Shop inventories per location
    encounters.json ← Random encounter tables per area
    dialogue.json   ← Story text and NPC dialogue
  js/               ← Game engine JavaScript modules
  css/              ← Shared styles
  index.html        ← Hub page (tythos.com/FFL1/)
  general.html      ← General mechanics wiki
  monsters.html     ← Monster mechanics wiki (meat system, families)
  mutants.html      ← Mutant character class wiki
  humans.html       ← Human character class wiki
  items.html        ← Items, weapons, armor, spells wiki
  game.html         ← Playable JS port
```

## Key Design Decisions
- **Data-first**: All game data lives in `data/*.json` — edit those to mod the game
- **Performance**: JS modules load data once; no re-fetching; Canvas 2D rendering
- **Style**: Matches site palette — dark background (#06060e), neon accents (see css/style.css)
- **Domain**: Hosted at tythos.com/FFL1/ (GitHub Pages with custom domain)

## Working on This
- Read the relevant context file before editing game systems
- monsters.json and abilities.json are ROM-extracted; mark edits with a comment
- For new wiki content, see `wiki-structure.md`
- For game engine changes, see `engine.md`
