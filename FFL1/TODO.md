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

### ✅ Mystery 3 — RESOLVED: 0xF2 = '-', 0x82 = '2'
**Confirmed from [RANDO]:** `FFLNameTextToASCII` explicitly maps `0xF2 → '-'` (hyphen) and `0x82` falls in range `0x80–0x89` which decodes to digits `chr(b - 0x50)`, so `0x82 - 0x50 = 0x32 = '2'`. Verified by decoding all 200 monster names from ROM: GEN-BU, SEI-RYU, BYAK-KO, SU-ZAKU all decode correctly, and GEN-BU2 (id 193) decodes as "GEN-BU2". Character encoding table in rom-map.md corrected (previous table had uppercase/lowercase/digit ranges wrong). *(Also discovered: correct digit range is 0x80–0x89, not 0xA4–0xAD as previously noted)*

---

### ✅ Mystery 4 — RESOLVED: Item GP cost table = 6-digit packed BCD
**Confirmed from [RANDO]:** `ReadGPCost` at address `0x17E10 + item_id * 3`. Format: 3 bytes, each nibble = one decimal digit (6 digits total → 000000–999999 GP). Examples: 6789 GP = `[0x00, 0x67, 0x89]`; 10480 GP = `[0x01, 0x04, 0x80]`. Prior "incoherent" readings were 3-byte LE integer misinterpretation. Documented in rom-map.md.

---

## Data Re-Extraction Needed (correctness bugs)

- ✅ **Extract item GP costs and shop inventories from ROM** — shops.json fully replaced with ROM data (14 shops × 10 items each, prices as 6-digit BCD from 0x17E10). abilities.json updated with `gp` field for all 252 items. item_prices.json created as standalone lookup. **QUESTION FOR USER:** Shop location assignments (world/town) are not known — can you map shop indices 1–14 to their in-game locations? (see shops.json)

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
  - ✅ `data/shops.json` — replaced with ROM-extracted data (see above).
  - `data/transformation.json` — transformation table "based on FFLMonsterCalc community
    documentation" (LOW confidence). *(discovered during: wiki audit)* Eat table at `0x0AFD3`
    (29 bytes × 25 monster classes); result lists at `0x0B2A8` (16 bytes × 25 classes).
    Addresses confirmed from RANDO; byte layout not yet decoded. Next step: extract and decode.
  - `data/world.json` — world structure "reconstructed from game knowledge" (LOW confidence).
    *(discovered during: wiki audit)* Extract from ROM when encounter zone / world structure
    is mapped.

## BGB Session — Breakpoints to Set

**Setup:** Download BGB (Windows emulator with built-in debugger). Load `rom/ffl1.gb`. Use `Debugger → Breakpoints` to add read/write/execute breakpoints. After each fires, record the **PC** (program counter), **bank** (shown in CPU state panel), and nearby disassembly.

---

### BGB Task 1 — Stat table byte 6 upper nibble (Mystery 1)
1. `Debugger → Breakpoints → Add`: address `7AEE`, type **Read**, bank **6**.
2. Walk into any encounter. When it fires, note: PC, bank, and what instruction ran (look for `AND F0` or `SRL A` in the disassembly pane — those would extract the upper nibble).
3. **Report back:** PC, bank, and 2–3 instructions after the read.

**Unlocks:** Identifies what the upper nibble of monster stat byte 6 controls (likely meat category).

---

### BGB Task 2 — Character portrait sprites (class select screen)
1. Reach the class select "WHO ARE YOU?" screen.
2. Open `Debugger → OAM Viewer`. Screenshot or copy out all 8 sprite entries (Y, X, tile#, flags).
3. Open `Debugger → VRAM Viewer` → OBJ tiles. Note what each tile index from step 2 looks like.
4. **Report back:** Table of sprite slot → tile_index for each of the 8 class rows.

**Unlocks:** Character portraits on the class select screen (currently blocked).

---

### BGB Task 3 — Cursor sprite tile (class select screen)
1. On class select screen, in the OAM Viewer, find the ring cursor sprite (leftmost column).
2. Note its tile index and palette byte.
3. **Report back:** OAM slot, tile_index, palette.

**Unlocks:** Cursor sprite rendering.

---

### BGB Task 4 — WRAM gold and stat address verification
1. Start a new game. Note your starting GP.
2. `Debugger → Memory Viewer` → go to `CC8D`. Note the 3 bytes at CC8D–CC8F (should encode your GP).
3. Spend some GP or use cheat to change it. Note updated bytes.
4. Also check `CC06` (first character's current HP).
5. **Report back:** 3 bytes at CC8D and 1 byte at CC06, and whether they match your in-game values.

**Unlocks:** Confirmed WRAM addresses for live GP and HP display in the webapp.

---

### BGB Task 5 — Combat engine entry point
1. Walk the overworld until a random encounter triggers.
2. The instant the battle screen appears, press **Esc** to pause BGB.
3. Note the **PC** and **bank** shown in the CPU state panel. Step forward 5–10 instructions and screenshot the disassembly.
4. **Report back:** PC, bank, and the first few instructions.

**Unlocks:** Entry point for the battle loop; needed before implementing combat.

---

### BGB Task 6 — Overworld tilemap
1. Start a game, exit the tower base building, stand on the world map.
2. Open `Debugger → VRAM Viewer` → BG Map (Map 0, address 9800). Take a screenshot.
3. Open VRAM Viewer → BG Tiles. Take a screenshot.
4. Note the tile indices for: water, ground path, tower entrance, and any landmark tile.
5. **Report back:** Both screenshots + tile index list.

**Unlocks:** Overworld tilemap layout for the webapp's world map rendering.

---

## Missing ROM Data (requires tools or deeper analysis)

- **Class select screen rendering routine** — need the ROM address(es) that render
  the WHO ARE YOU screen. *(covered by BGB Task 2)*

- **Character portrait sprite tile indices** — which tile indices form the 8 class portraits.
  *(covered by BGB Task 2)*

- **Cursor sprite tile index** — the ring cursor at the left of the selected row.
  *(covered by BGB Task 3)*

- **DTE decoder implementation** — story/dialog text is DTE-compressed; raw byte search
  is impossible. Need to implement a decoder using the tables at `0x14E40` (loaded to RAM
  `0xC800`) to verify `data/dialog.md` story text and extract NPC dialog.

- **WRAM address verification** — gold, character HP/stats. *(covered by BGB Task 4)*

- **Save / SRAM layout** — `0xA000`–`0xBFFF` battery-backed SRAM; internal structure
  (character slots, inventory, flags, world state) not documented. Requires save-file
  hex comparison approach (save in different states, diff the bytes).

- **Encounter zone data** — which ROM offsets define random encounter rates and monster
  tables for each world map area. Needed before implementing overworld traversal.

- **Overworld tilemap layout** — dynamically built at runtime. *(covered by BGB Task 6)*

- **Combat engine addresses** — battle loop, damage formula, turn-order code.
  *(covered by BGB Task 5)*

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
