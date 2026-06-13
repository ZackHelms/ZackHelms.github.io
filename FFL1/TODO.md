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

**Key observation:** Bosses (189+) all have upper nibble = 0. Regular monsters vary. The FFLRandomizer's `WriteCharacterGoldTableIndex` uses `|=` (not direct assignment), deliberately preserving the upper nibble — so it contains real data the randomizer didn't want to overwrite.

**Hunches:**
- Meat type / drop category: the FFLRandomizer source says byte 0 contains "Race/Meat/NumAbils" so some meat info may also live in byte 6 upper nibble. Bosses can't be eaten, hence 0.
- Number of abilities (alternative to byte 0): the upper nibble could be a secondary count or flag for available actions.
- Encounter tier/rank: could label which dungeon level this monster appears in.

**How to investigate:** Check FFLRandomizer for any function that reads the upper nibble of byte 6. Alternatively, use BGB to set a read breakpoint on `0x1AAEE` (monster 0, byte 6) and watch what code accesses it.

---

### Mystery 2: Stat table bytes 7–8 — unknown fields
**Location:** `0x1AAE8 + idx*9 + 7` (byte 7) and `0x1AAE8 + idx*9 + 8` (byte 8).

**Observed values:**
| Monster | id | byte7 | byte8 |
|---------|-----|-------|-------|
| fly | 0 | 0x21 (33) | 0x73 (115) |
| drgonfly | 1 | 0x24 (36) | 0x73 (115) |
| hornet | 2 | 0x28 (40) | 0x73 (115) |
| mosquito | 3 | 0x2D (45) | 0x73 (115) |
| cicada | 4 | 0x33 (51) | 0x73 (115) |
| mantis | 5 | 0x39 (57) | 0x73 (115) |
| barracud | 6 | 0x41 (65) | 0x73 (115) |
| gen-bu | 189 | 0x9F (159) | 0x76 (118) |
| sei-ryu | 190 | varies | varies |

**Key observations:**
- Byte 8 = 0x73 is constant for the first ~180 regular monsters; boss entries differ (0x76, etc.)
- Byte 7 increases roughly monotonically across monster IDs for regular monsters (0x21, 0x24, 0x28, 0x2D…), suggesting sequential index or offset values rather than per-monster stats
- Bytes 7–8 little-endian → e.g., fly = 0x7321. In bank 6 CPU address space (0x4000–0x7FFF), 0x7321 is a valid address → file offset 0x18000 + (0x7321 − 0x4000) = 0x1B321. This is deep in bank 6 data (HP table is at 0x1B254, gold table at 0x1B2A4). **Strong hunch: bytes 7–8 are a bank-6–relative CPU address pointing to each monster's ability/action list.**
- Byte 8 = 0x73 → all regular monster ability lists start in the 0x73xx CPU address range (file 0x1B300–0x1B3FF range)
- The monotonically increasing byte 7 supports this: each monster's action list starts after the previous one in a sequential ability block

**How to investigate:** 
1. Dump 16–32 bytes starting at file offset 0x1B321 (fly's putative ability pointer) and check if the data there looks like an action list (small integers or name indices).
2. In FFLRandomizer, search for any function that reads bytes at offset +7 or +8 of the stat entry, or that references addresses in the 0x7300–0x7FFF range in bank 6.
3. BGB: Set a read breakpoint on 0x7321 in bank 6; the PC at the breakpoint is the code that processes fly's action list.

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

### Mystery 4: Item GP cost table format (0x17E10)
**Location:** `0x17E10`, claimed 3-byte-per-item format by FFLRandomizer.

**Problem:** 3-byte little-endian interpretation gives incoherent prices (e.g., multi-million GP for a Potion). The BCD format used by the gold reward table at `0x1B2A4` might also apply here, or the stride may differ.

**Hunch:** The item cost table likely uses the same 4-digit BCD encoding (2 bytes, not 3) as the gold table. Alternatively, if 3 bytes: the first 2 bytes are BCD and the 3rd byte is a shop availability flag or item category byte.

**How to investigate:** 
1. Try reading 0x17E10 as 2-byte BCD: do the first few items decode to plausible shop prices (Potion ~100–300 GP, etc.)?
2. Cross-reference with GameFAQs or wiki shop price lists to validate candidate interpretations.
3. FFLRandomizer: search for `ReadItemCost` or `ReadItemPrice` — the exact decoding function will reveal the format.

---

## Data Re-Extraction Needed (correctness bugs)

- **Verify item GP cost table** — address `0x17E10` from FFLRandomizer source, but
  3-byte LE interpretation gives incoherent prices. See Mystery 4 in ROM Mysteries section for
  investigation approach. Correct format → `rom-map.md` + update items.html.

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
