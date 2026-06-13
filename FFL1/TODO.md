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

## ROM Mysteries (unknown data — investigate when tools are available)

Items in this section have been identified in the ROM but their meaning is not yet understood.
Once resolved, move findings to `.claude/rom-map.md` and collapse this entry to a one-liner.

---

### Mystery 1: Stat table byte 6 — upper nibble
**Location:** `0x1AAE8 + idx*9 + 6` — upper nibble only (bits 4–7). Lower nibble is confirmed as gold table index.

**Observed values (upper nibble):**
| Monster | id | byte6 raw | upper nibble |
|---------|-----|-----------|--------------|
| fly | 0 | 0xA1 | 0xA = 10 |
| drgonfly | 1 | 0x83 | 0x8 = 8 |
| hornet | 2 | 0x74 | 0x7 = 7 |
| mosquito | 3 | 0x74 | 0x7 = 7 |
| cicada | 4 | 0x29 | 0x2 = 2 |
| mantis | 5 | 0x29 | 0x2 = 2 |
| barracud | 6 | 0x92 | 0x9 = 9 |
| gen-bu | 189 | 0x06 | 0x0 = 0 |
| sei-ryu | 190 | 0x0C | 0x0 = 0 |

**Key observation:** Bosses (189+) all have upper nibble = 0. Regular monsters vary. The RANDO code (`WriteCharacterGoldTableIndex`) sometimes uses `|=` to preserve the upper nibble, but `WriteMonsterData` zeros the entire byte first — so the RANDO is inconsistent and likely doesn't know what the upper nibble means.

**RANDO verdict (from source audit):** No `Read*` function ever accesses the upper nibble of byte 6. `AdjustMonsterGoldOffset` accidentally destroys it. Given the RANDO comment "All monsters are Monster race, meat drop 3" and the observation that bosses = 0 (bosses can't be eaten), the upper nibble most likely encodes **meat category / drop tier**.

**How to investigate:** BGB — set a read breakpoint on CPU address `0x7AEE` in bank 6 (= file `0x1AAEE`, monster 0 byte 6). The PC at the breakpoint is the game code that uses this byte.

---

### ✅ Mystery 2 — RESOLVED: Stat table bytes 7–8 = monster ability list pointer
**Confirmed from [RANDO]:** FFLRandomizer names these fields "ability offset low byte" (+7) and "ability offset high byte" (+8). Combined as little-endian 16-bit, it is a bank-6 CPU address (0x4000–0x7FFF) pointing to that monster's ability/action list. Fly: bytes [0x21, 0x73] → CPU 0x7321 → file 0x1B321. The constant byte8=0x73 for regular monsters means all regular monster action lists cluster around file 0x1B321–0x1B3FF. Documented in rom-map.md under "Monster Ability List Table".

---

### Mystery 3: Character encoding bytes 0xF2 and 0x82 in monster names
**Location:** Name table at `0x14000`, 200 × 8 bytes, same encoding as the general character table.

**Observed:**
- `0xF2` appears in boss names: gen-bu (id 189) = `[gen, 0xF2, bu]`, sei-ryu = `[sei, 0xF2, ryu]`, byak-ko = `[byak, 0xF2, ko]`, su-zaku = `[su, 0xF2, zaku]`, p-flower (id 13) = `[p, 0xF2, flower]`
- `0x82` appears at the end of strong boss forms: "gen-bu II" form (id 193) name bytes end with `0x82`, "sei-ryu II" (id 194) similarly; likely represents the "2" or "II" suffix used for the powered-up boss variants in the 3rd and 4th worlds

**Current decoder treatment:** `0xF2` mapped to `'-'` (hyphen/dash) based on context. `0x82` mapped to `'2'` tentatively. These are guesses.

**Confirmed encoding range** (from rom-map.md): `0x8A`–`0xA3` = a–z, `0x40`–`0x59` = A–Z, `0xA4`–`0xAD` = 0–9. `0xF2` and `0x82` fall outside the known alphanumeric ranges and may be:
- Special punctuation (hyphen, period, apostrophe)
- DTE pair codes that happen to also appear in the name table (unlikely — DTE is for story text only)
- Extended characters from the full font tile sheet

**How to investigate:** Look at font tile sheet `img/tile_sheet_1bpp_large.png` — tile index encodes the glyph. The character byte value maps to a tile index by some formula; check which tile 0xF2 and 0x82 render in the game's BG tile decoder. Alternatively, look up those tile indices in the BGB VRAM viewer while a boss name is displayed on screen.

---

### ✅ Mystery 4 — RESOLVED: Item GP cost table = 6-digit packed BCD
**Confirmed from [RANDO]:** `ReadGPCost` at address `0x17E10 + item_id * 3`. Format: 3 bytes, each nibble = one decimal digit (6 digits total → 000000–999999 GP). Examples: 6789 GP = `[0x00, 0x67, 0x89]`; 10480 GP = `[0x01, 0x04, 0x80]`. Prior "incoherent" readings were 3-byte LE integer misinterpretation. Documented in rom-map.md.

---

## Data Re-Extraction Needed (correctness bugs)

- **Extract item GP costs from ROM** — format now confirmed (6-digit packed BCD, `0x17E10 + item_id*3`, Mystery 4 resolved). Re-extract `data/shops.json` prices from ROM binary using this formula.

- **Replace v001 data files with ROM-verified data** — the following files in `FFL1/data/`
  are from the v001 game engine era and contain fabricated or web-sourced values not from
  ROM. They are no longer used by any wiki page (as of this cleanup), but they exist in the
  repo and could mislead future sessions. Extract correct values from ROM and replace each:
  - `data/items.json` — contains `base_power`, `uses`, `stat_bonus`, `heal_amount`, `equip`
    restrictions — all fabricated. *(discovered during: wiki audit)*
    - Weapon stats (power, uses, element) → needs ROM extraction (ability table bytes + item
      stat table; address not yet found)
    - Armor stat bonuses → needs ROM extraction (address not yet found)
    - Usable item effects (heal amount, stat boost) → needs ROM extraction (not yet found)
    - Equip restrictions (human/mutant/monster) → needs ROM extraction (not yet found)
  - `data/encounters.json` — encounter rates/tables fabricated.
    *(discovered during: wiki audit)* Extract from ROM when encounter zone data is found.
  - `data/shops.json` — shop prices "approximate from FAQ sources" (LOW confidence).
    *(discovered during: wiki audit)* Extract from ROM (item GP cost table at `0x17E10`
    once format is verified; shop inventory lists address not yet found).
  - `data/transformation.json` — transformation table "based on FFLMonsterCalc community
    documentation" (LOW confidence). *(discovered during: wiki audit)* Extract from ROM
    (transformation table noted at `0x0AFD3` in old data; needs verification).
  - `data/world.json` — world structure "reconstructed from game knowledge" (LOW confidence).
    *(discovered during: wiki audit)* Extract from ROM when encounter zone / world structure
    is mapped.

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

- **Class select screen (webapp)** — partially complete; one item blocked on BGB session.
  1. ✅ Remove "WHO ARE YOU?" header (not present in original)
  2. ✅ Add row numbers (1–8) at left
  3. Add character portrait sprites — *(blocked on: BGB OAM viewer to identify Bank 2 sprite tile indices; see Missing ROM Data above)*
  4. ✅ Fix cursor style: circular ring at row left, no full-row inversion
  5. ✅ Fix name/gender column alignment (fixed columns: name x=44, gender x=112)

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

## Done

- ✅ **Re-extract monsters.json stats with 9-byte stride** — STR/DEF/AGI/MANA corrected at
  `0x1AAE8`; gold added via BCD gold table at `0x1B2A4` (lower nibble of stat byte 6).
  Key discovery: gold table uses 4-digit packed BCD, not plain integers; index is 4-bit (0–15).
  *(was: Data Re-Extraction Needed — monsters.json stats)*

- ✅ **Wiki page audit and cleanup** — fixed all wiki pages to use ROM-verified data sources:
  monsters.html: removed broken MEAT LV column (fields no longer in monsters.json), added gold
  column; general.html: corrected MONSTER card text, fixed boss HP note; items.html and
  humans.html: both switched from fabricated items.json to ROM-verified abilities.json.
  Remaining v001 data files documented in Data Re-Extraction Needed section.
  *(user requested)*

- ✅ **Class select screen layout (4 of 5 sub-items)** — removed WHO ARE YOU? header; added
  row numbers 1–8; fixed cursor to circular ring with no row inversion; fixed name/gender to
  fixed columns. Portrait sprites (sub-item 3) remain blocked on BGB session.
  *(was: Near-term Feature Work — class select screen)*
