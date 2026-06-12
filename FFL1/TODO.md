# FFL1 Webapp — TODO

## Stubs (no-ops in current build)

- **CONTINUE** — selecting "CONTINUE" on the title screen and pressing A does nothing.
  Requires: save-file format extracted from ROM (not yet done); in-game save mechanic
  (crystal ball / game-over flow) also not yet extracted.

## Near-term

- **Walking animation** — overworld character has 2-frame walk cycle (front/side/back views).
  Screenshots 6 & 7 show the alternating sprite. Requires: extracting the 2-frame sprite pair
  from Bank 2 tile data for each class/direction combination.

- **Guild NPC** — initial party is 1 character; walk to guild to fill slots 2–4.
  Requires: guild NPC dialog extracted from ROM (DTE-compressed; decode not yet implemented).

- **Overworld tilemap** — tower-base world area needs real tiles from Bank 2 + tilemap layout.
  Currently rendered as a placeholder. Tilemap is built dynamically at runtime (like title screen);
  static map search in ROM is a dead end.

## Future / Not Started

- Combat system (damage formulas not yet extracted from ROM)
- Stat gain / mutation trigger (not yet extracted)
- Meat / transformation system (not yet extracted)
- Town interiors and NPC dialog
- Save / load (CONTINUE) functionality
- SRAM / localStorage persistence
