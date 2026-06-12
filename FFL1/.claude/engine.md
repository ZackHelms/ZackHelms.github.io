# FFL1 Game Engine Architecture

## Files
```
FFL1/
  game.html          ← Main entry point; loads all modules
  js/
    data.js          ← JSON loader; caches all data/  files
    characters.js    ← Human, Mutant, Monster class logic
    party.js         ← Party management, save/load (localStorage)
    battle.js        ← Turn-based combat engine
    world.js         ← Tile-map navigation, encounter triggering
    ui.js            ← Menu system, dialogs, HUD
    renderer.js      ← Canvas 2D helpers (tiles, sprites, text)
    engine.js        ← Main game loop; state machine
```

## State Machine
States (enum in engine.js):
- `LOADING` — initial data fetch
- `TITLE` — title screen
- `CHAR_CREATE` — create 4-character party
- `WORLD` — overworld tile navigation
- `DUNGEON` — dungeon tile navigation
- `BATTLE` — combat screen
- `MENU` — in-game party menu (stats, inventory, equip)
- `SHOP` — shopping interface
- `DIALOG` — NPC / story text display
- `GAME_OVER`
- `VICTORY`

## Canvas Layout
- Canvas: 640 × 480 (2× GB resolution)
- Map area: 320 × 240 (top-left, 20×15 tiles of 16px each)
- UI panel: 320 × 240 (right side) or full-screen overlay in battle

## Data Flow
1. `data.js` fetches all JSON once on startup, stores in `GameData` object
2. `party.js` holds the live party state (current HP, inventory, etc.)
3. `engine.js` runs `requestAnimationFrame` loop; routes input + rendering to current state handler

## Adding/Modifying Game Content
- **Monsters**: edit `data/monsters.json`
- **Items/weapons**: edit `data/items.json`
- **World layout**: edit `data/world.json`
- **Shop stock**: edit `data/shops.json`
- **Encounters**: edit `data/encounters.json`
- **Dialogue**: edit `data/dialogue.json`
- **Transformation table**: edit `data/transformation.json`

## Character Data Schema (runtime, in party.js)
```js
{
  name: "Hero",
  class: "human" | "mutant" | "monster",
  hp: 120, maxHp: 120,
  str: 15, def: 12, agi: 10, mana: 5,
  equipment: [],        // array of ability IDs (max 8 human, 4 mutant)
  abilities: [],        // mutant only: array of ability IDs (max 4)
  meatSlots: [],        // monster only: array of {monster_id, level} (max 4)
  monsterFamily: 0,     // monster only: current family index
  monsterTier: 1,       // monster only: tier within family (1-6)
  statItems: {},        // human only: {str: n, agi: n, ...} from consumables
  gold: 0,
  alive: true
}
```

## Battle Flow (battle.js)
1. `initBattle(enemies)` — build combatant list, set state
2. Each frame: handle input (select action) or animate
3. `resolveTurn()` — sort by AGI, execute actions in order
4. Check win/lose condition after each action
5. On win: `postBattle(party, enemies)` — award EXP (not used), trigger mutant gains, check meat drops
6. On lose: transition to GAME_OVER

## Tile Rendering (renderer.js)
Tiles are 16×16 drawn via `fillRect` with color + simple pixel decorations.
Tile type → color map defined in renderer.js TILE_COLORS constant.

## Save System (party.js)
- `saveGame()` → `localStorage.setItem('ffl1_save', JSON.stringify(state))`
- `loadGame()` → parse and restore
- Auto-save on: entering a town, after a battle
