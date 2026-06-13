# FFL1 Webapp — TODO

## ROM Research

- **Full ROM map** — find, create, and verify a complete ROM map for the US release.
  Verified entries go in `.claude/rom-map.md`. See `.claude/sources.md` for guidance on
  which tools and sources are most reliable for Game Boy ROMs.

- **Full ROM disassembly** — no complete public disassembly of the US ROM exists.
  Options: use BGB debugger (set PC breakpoints while running the ROM to trace live code),
  Ghidra + GB CPU plugin (static analysis), or adapt the GBC colorization patch asm
  (gameboycolorizations/ffl1-color) as a structural reference. Disassembly addresses go
  in `.claude/rom-map.md` under "Code / Engine Addresses."

## Data Re-Extraction Needed (correctness bugs)

- **Re-extract monsters.json stats** — stat table at `0x1AAE8` uses **9-byte stride**
  (not 8 as originally assumed). Current STR/DEF/AGI/MANA values in `monsters.json` are
  wrong. HP values are correct (separate table at `0x1B254`, unaffected).
  Script: Python, stride=9, layout=[race, hp_idx, STR, DEF, AGI, MANA, gold_idx, ?, ?].

- **Verify item GP cost table** — address `0x17E10` from FFLRandomizer source, but
  3-byte LE interpretation gives incoherent prices. Verify actual format (may be 2-byte,
  or BCD, or differently strided). Correct format → `rom-map.md` + update items.html.

## Missing ROM Data (requires tools or deeper analysis)

- **Class select screen rendering routine** — need the ROM address(es) that render
  the WHO ARE YOU screen. Best approach: set a BGB breakpoint on VRAM writes when the
  screen first appears; the PC at that point is the render routine.

- **Character portrait sprite tile indices** — which Bank 2 tiles form the 8 character
  portraits shown on the class select screen. Approach: BGB OAM viewer during class select,
  or trace the render routine once found.

- **Cursor sprite tile index** — the circular ring icon at the left of the selected row
  on the class select screen. Same approach as above.

- **DTE decoder implementation** — story/dialog text is DTE-compressed; raw byte search
  is impossible. Need to implement a decoder using the tables at `0x14E40` (loaded to RAM
  `0xC800`) to verify `data/dialog.md` story text and extract NPC dialog.

- **WRAM address verification** — gold, character HP/stats, and other live addresses from
  GameShark codes are LOW confidence. Verify by: loading ROM in BGB, using memory viewer
  to watch values change during gameplay, cross-referencing with the code.

- **Save / SRAM layout** — `0xA000`–`0xBFFF` battery-backed SRAM; internal structure
  (character slots, inventory, flags, world state) not documented. Requires either:
  a save-file hex comparison approach (save in different states, diff the bytes), or
  tracing SRAM write instructions in the ROM.

- **Encounter zone data** — which ROM offsets define random encounter rates and monster
  tables for each world map area. Needed before implementing overworld traversal.

- **Overworld tilemap layout** — dynamically built at runtime (no static tilemap in ROM).
  Approach: BGB VRAM/tilemap viewer while standing on the world map; record tile indices
  and BG map layout, then cross-reference with Bank 2 tile grid.

- **Combat engine addresses** — where the battle loop, damage formula, and turn-order
  code live. Needed before implementing any combat. Trace from a known entry point
  (e.g., when encounter triggers, what is the next PC value?).

- **Music / SFX data** — not a near-term priority; note for completeness.

## Stubs (no-ops in current build)

- **CONTINUE** — selecting CONTINUE on the title screen does nothing.
  Requires: SRAM layout extracted; save mechanic (crystal ball / game-over) also not extracted.

## Near-term Feature Work

- **Class select screen (webapp)** — currently does not match the ROM. Issues to fix:
  1. Remove "WHO ARE YOU?" header (not present in original)
  2. Add row numbers (1–8) at left
  3. Add character portrait sprites (requires sprite tile extraction above)
  4. Fix cursor style: circular icon at row left, no full-row inversion
  5. Fix name/gender column alignment (fixed columns, not concatenated)

- **Walking animation** — 2-frame walk cycle (front/side/back views) per class.
  Requires: character sprite tile extraction from Bank 2.

- **Guild NPC** — initial party is 1; walk to guild to fill slots 2–4.
  Requires: DTE decoder (guild NPC dialog is DTE-compressed).

- **Overworld tilemap** — tower-base area currently a placeholder.
  Requires: tilemap layout extraction (see Missing ROM Data above).

## Future / Not Started

- Combat system (damage formulas not yet extracted)
- Stat gain / mutation trigger (not yet extracted)
- Meat / transformation system (table at `0x0AFD3` located but not decoded)
- Town interiors and NPC dialog (DTE decoder needed first)
- Save / load (CONTINUE) functionality
- SRAM / localStorage persistence
