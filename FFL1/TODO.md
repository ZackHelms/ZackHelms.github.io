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

**Observed values:** upper nibble range is 0–10. Distribution: upper=0 → 31 monsters; upper=2 → 39; upper=10 → 15.

**Newly observed pattern:** Within each 6-monster family, the upper nibble DECREASES with monster strength:
- wolf (weakest canine, id=30): upper=9
- jaguar (id=31): upper=8
- sabercat (id=32): upper=6
- snowcat (id=33): upper=4
- blackcat (id=34): upper=2
- fenswolf (strongest canine, id=35): upper=2

This pattern holds for insects, canines, fish, and other families checked. Upper nibble appears to encode **encounter area tier** — weakest monsters (upper=9/10) appear in World 1/early dungeons; strongest (upper=2) appear in late-game/tower areas. Upper=0 = scripted/boss-only encounters (bosses 189+, player class stubs 173–188, and specific named NPC enemies like kingswrd/steward/hunter).

**Why upper nibble matters:** Likely used by the encounter table logic to filter which monsters can appear on a given floor/world — a monster only appears in random encounters if its upper nibble ≤ current encounter zone's "max tier." Needs BGB to confirm.

**RANDO verdict (from source audit):** No `Read*` function in the RANDO ever reads this field. `WriteMonsterData` zeros the full byte, destroying it. RANDO does not understand this field.

**How to investigate:** BGB — set a read breakpoint on CPU address `0x7AEE` in bank 6 (= file `0x1AAEE`, monster 0 byte 6). The PC at the breakpoint is the game code that uses this byte.

---

### ✅ Mystery 2 — RESOLVED: Stat table bytes 7–8 = monster ability list pointer + lists fully decoded
**Confirmed from [RANDO]:** FFLRandomizer names these fields "ability offset low byte" (+7) and "ability offset high byte" (+8). Combined as little-endian 16-bit, it is a bank-6 CPU address (0x4000–0x7FFF) pointing to that monster's ability/action list. Fly: bytes [0x21, 0x73] → CPU 0x7321 → file 0x1B321.

**List format decoded:** Packed sequential lists with no terminator. Length = next monster's pointer − this pointer. Each byte = direct ability table ID. Lists include both attack abilities and passive D/E-item defenses. All 200 monsters decoded; stored in `data/monsters.json` as `ability_ids`. Displayed on monsters.html (cyan=active, dim=passive). *(decoded this session)*

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
    - ✅ Weapon power (X field at 0x1B700) — extracted and added to abilities.json (`power` field). 60 weapons decoded. HIGH confidence.
    - ✅ Weapon element (Y field) — extracted for single-element weapons (`element` field). fire/ice/elec/poison.
    - ✅ Armor defense (X field) — extracted for 22 equippable armor items (`defense` field). HIGH confidence.
    - ✅ Armor slot (FlagsA bits) — extracted (`slot` field: helm/body/gloves/shoes/all). HIGH confidence.
    - ✅ Heal amount for potions (X=30 for potion, X=90 for xpotion) — added `heal` field. HIGH confidence.
    - ✅ Equip restrictions — confirmed NOT stored per-item in ROM. Class-level rule: humans=8 items, mutants=4, monsters=0. No per-item flags exist.
    - ✅ Item true uses count (AltUses field, byte +3 at 0x1B700) — added `uses` field to abilities.json. Notable: glass sword=1 (breaks), masamune=254 (unlimited), vampic/rune=30, SMG=25. Wiki updated to show ∞ for 254, highlighted 1.
    - Usable item effect amounts (needle, bell, hyper, etc.) → X field for status-cure items is a **bitmask** (not a number): needle=0xFD clears bit 1, antdote=0xEF clears bit 4, etc. Status bit meanings not yet confirmed from BGB. Not added to wiki. *(remainder)*
    - Armor FlagsA bit 6 (D-items: Dfire/Dice/etc.) effect/mechanics → not yet confirmed from BGB *(remainder)*
  - `data/encounters.json` — encounter rates/tables fabricated.
    *(discovered during: wiki audit)* Extract from ROM when encounter zone data is found.
  - ✅ `data/shops.json` — replaced with ROM-extracted data (see above).
  - ✅ `data/transformation.json` — replaced with ROM data. 25 monster classes × 16 weighted members (0x0B2A8); 25×29 eat transformation table with result class weights (0x0AFD3). Monster class = monster_id // 6 for IDs 0–149; monsters 150+ cannot be eaten. HIGH confidence.
  - ✅ `data/encounters.json` — replaced with ROM data. 128 encounters × 5 monster slots from 0x1A868. MEDIUM confidence for structure (which slots are active in battle not yet decoded; enc 0-5 appear to be boss encounters). **QUESTION FOR USER:** Which encounters map to which overworld zones/floors?
  - `data/world.json` — world structure "reconstructed from game knowledge" (LOW confidence).
    *(discovered during: wiki audit)* Extract from ROM when encounter zone / world structure
    is mapped.
  - ✅ `data/items.json` — deleted. Fabricated stats (base_power, stat_bonus, equip restrictions); wiki pages use abilities.json. Removed to avoid misleading future sessions.

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

- **DTE decoder implementation** — NPC dialog located. Need to build a full decoder and extract all dialog text.
  - ✅ DTE tables confirmed: DTE1 = 64 bigrams at `0x14E40` (codes `0x50–0x8F`); DTE2 = 55 bigrams at `0x14EC0` (codes `0xC0–0xF6`)
  - ✅ Dialog encoding: uses lowercase-range bytes `0xA4–0xBD` for direct chars; `0x50–0x8F` and `0xC0–0xF6` are all DTE codes; `0xBE`=apostrophe; `0x0D`=newline; `0x00`=string terminator
  - ✅ NPC dialog text location: bank 5, `0x14F3E–0x17D37` (11,770 bytes). Confirmed samples: "THERE IS A TOWN HIDDEN IN THE CLOUDS", "ANYONE WHO VISITS HIS..."
  - Full DTE1 bigram table: `__,E_,HE,_T,TH,OU,S_,T_,ER,_A,_I,RE,IN,IS,AN,D_,_W,TO,O_,YO,OR,_O,AR,AT,_Y,ST,HA,N_,_S,EA,_H,_M,R_,VE,U_,_F,HI,ON,IT,_D,LL,TE,ME,EN,ND,_B,TH,OF,ES,E-THE,LE,WE,SE,ED,AS,RO,OW,Y_,LD,I_,DE,??_,YO,WA`
  - Story intro text NOT found in bank 5; may be in bank 1/3 or use different encoding
  - ✅ Decoder written; 251 strings extracted to `data/dialog.json` (MEDIUM confidence)
  - **Next:** map dialog string offsets to in-game triggers/locations (NPC coordinates, shop interiors, etc.) — requires BGB to trace which string offset the game reads for each NPC *(blocked on: BGB session)*
  - Story intro text still not found — may need BGB text-renderer breakpoint to locate

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
- ✅ Meat / transformation system — ROM extracted to data/transformation.json (HIGH confidence). 25 monster classes × eat table at 0x0AFD3 + class members at 0x0B2A8. Webapp implementation still pending (game logic not yet built).
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

- ✅ **shops.html wiki page** — created from ROM-extracted shops.json (14 shops × 10 items, 6-digit BCD prices). Added to nav on all wiki pages and to index.html wiki grid. Shop location (world/town) assignments remain UNVERIFIED — awaiting user input.
  **QUESTION FOR USER:** Can you map shop indices 1–14 to their in-game towns/worlds? (From the price ranges, shops 1–2 look like World 1, shops 3–4 World 2, etc. — but ROM confirmation needed.)
  *(discovered during: shop price extraction)*

- ✅ **encounters.html wiki page** — created from ROM-extracted encounters.json (128 encounters × 5 slots). Added to nav on all wiki pages and to index.html wiki grid. Shows boss/scripted/random classification by monster tier. Slot usage mechanic and zone assignments remain UNVERIFIED.
  **QUESTION FOR USER:** Which encounter IDs map to which overworld zones/dungeon floors?
  *(discovered during: encounter data audit)*
