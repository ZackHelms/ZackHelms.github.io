# FFL1 ROM Map

Verified entries for `The Final Fantasy Legend (USA).gb` — 128 KB, MBC2.

Confidence levels:
- **HIGH** — verified by direct byte read from this ROM binary
- **MEDIUM** — strongly inferred from ROM structure / consistent web sources; needs deeper verification
- **LOW** — web-sourced only; not yet verified against ROM binary

Sources: [DC] Data Crystal wiki, [RANDO] eclipseyy/FFLRandomizer source (directly fetched), [GS] GameShark codes, [GF] GameFAQs save-state guide, [TAS] TASVideos game resources.

---

## Memory Banking

**Confidence: HIGH** — confirmed from standard MBC2 cartridge spec + bank switch RST verified in previous sessions.

| Bank | File offset range | CPU address (when active) | Notes |
|---|---|---|---|
| 0 | `0x00000`–`0x03FFF` | `0x0000`–`0x3FFF` | Fixed (always mapped) |
| 1 | `0x04000`–`0x07FFF` | `0x4000`–`0x7FFF` | Switchable |
| 2 | `0x08000`–`0x0BFFF` | `0x4000`–`0x7FFF` | Tile/graphics data |
| 3 | `0x0C000`–`0x0FFFF` | `0x4000`–`0x7FFF` | Font tiles, UI strings |
| 4 | `0x10000`–`0x13FFF` | `0x4000`–`0x7FFF` | |
| 5 | `0x14000`–`0x17FFF` | `0x4000`–`0x7FFF` | Name/ability tables, guild data, DTE tables |
| 6 | `0x18000`–`0x1BFFF` | `0x4000`–`0x7FFF` | Stat tables, HP table, item data |
| 7 | `0x1C000`–`0x1FFFF` | `0x4000`–`0x7FFF` | |

**Bank switch mechanism:** `RST 0x28` with A = bank number (not a standard MBC register write).
File offset formula: bank N starts at `N × 0x4000`.
CPU address when switched: `file_offset_within_bank + 0x4000`.

---

## Data Tables

### Monster / Character Name Table
**Confidence: HIGH** — verified by reading all 200 entries and decoding; match expected names.

| Field | Value |
|---|---|
| File offset | `0x14000` |
| Entry count | 200 |
| Entry size | 8 bytes |
| Format | Text bytes, `0xFF`-terminated |
| Encoding | See Character Encoding section below |
| Source | [DC], verified |

### Monster Stat Table
**Confidence: HIGH (stride, bytes 0–6); LOW (bytes 7–8 — not yet verified)**

| Field | Value |
|---|---|
| File offset | `0x1AAE8` |
| Entry count | 200 |
| Entry size | **9 bytes** (not 8 — see verification note below) |
| Source | [RANDO], stride and field layout verified against source code |

**Field layout per entry (9 bytes):**
| Byte | Field | Notes |
|---|---|---|
| 0 | Race / Meat drop / NumAbils | RANDO formula: `byte = 0x7B + (num_abils × 8)` where `0x7B` = base for race=Monster, meat_drop=3. So `num_abils = (byte − race_meat_base) / 8`. Bits 0–2 likely encode race; bits 3–6 encode num_abils count. Full bit layout not confirmed. |
| 1 | HP table index | Index into HP table at `0x1B254` (see HP Table below) |
| 2 | STR | Raw stat; display capped at 99, internal max 255 |
| 3 | DEF | |
| 4 | AGI | |
| 5 | MANA | |
| 6 | Gold + encounter tier | **Lower nibble** = gold table index (0–15) into BCD gold table at `0x1B2A4`; **upper nibble = encounter area tier** — within each family, weakest monsters have upper=9 or 10, strongest have upper=2 or 1. Upper=0 = scripted/boss-only (bosses 189+, player stubs 173–188, named NPC enemies kingswrd/steward/hunter). Pattern: fly upper=10, drgonfly=8, hornet=7, mosquito=7, cicada=2, mantis=2. Likely used to filter which monsters appear in a given encounter zone. RANDO never reads this field and accidentally destroys it with `WriteMonsterData`. Needs BGB read breakpoint at CPU `0x7AEE` bank 6 to confirm usage. |
| 7 | Ability offset lo | Low byte of bank-6 CPU address pointing to monster's ability list |
| 8 | Ability offset hi | High byte; combined `(byte8 << 8) | byte7` = CPU address (e.g., fly → 0x7321 → file 0x1B321) |

**Stride verification:** With 9-byte stride, boss entries 189–199 yield byte-1 values 22, 23, 24, 25, 26, 27, 28, 29, 31, 30, 31 — a clean sequential walk through the boss HP sub-table (HP: 250, 600, 1000, 1500, 1500, 1750, 2000, 2500, 2000, 5000, 5000). With 8-byte stride, the same byte-1 values decode to incoherent HP values (295, 36, 36312, 514, 20…). 9-byte stride is correct.

**Gold table key verified:** `ReadCharacterGoldTableIndex` in FFLRandomizer source reads `filebytes[0x1AAEE + idx*9] & 0x0F` — confirming lower nibble of byte 6 is the gold index. Gold table uses 4-digit packed BCD encoding (see Gold Reward Table).

**Ability offset confirmed:** FFLRandomizer names bytes +7 and +8 "ability offset low byte" and "ability offset high byte" respectively. Combined as little-endian 16-bit value, this is a bank-6 CPU address (range 0x4000–0x7FFF) pointing to the monster's action/ability list. Bank 6 CPU → file offset: `0x18000 + (cpu_addr − 0x4000)`. Example: fly has bytes [0x21, 0x73] → CPU 0x7321 → file 0x1B321 (within bank 6 data region, past HP and gold tables).

### Monster HP Table
**Confidence: HIGH** — verified; values match expected game HP for all tested indices.

| Field | Value |
|---|---|
| File offset | `0x1B254` |
| Entry count | **32** (confirmed from [RANDO] source) |
| Entry size | 2 bytes, little-endian unsigned 16-bit |
| Indexing | Via HP table index byte in stat entry (byte 1), NOT directly by monster ID |
| Source | [DC], [RANDO], verified |

**HP table structure:**
| Index range | Contents |
|---|---|
| 0–21 | Monotonically increasing regular monster HP curve: 20, 40, 60, 82, 103, 126, 150, 175, 202, 231, 262, 295, 330, 368, 409, 454, 501, 551, 606, 666, 729, 795 |
| 22+ | Explicit HP values for bosses and strong monsters (250, 600, 1000, 1500, 1500, 1750, 2000, 2500, 2000, 5000, 5000 for boss indices 189–199) |

### Monster Type Table
**Confidence: MEDIUM** — address from [RANDO]; byte read confirms plausible values (0x00 and 0x11 pattern matches insect/fish family groupings).

| Field | Value |
|---|---|
| File offset | `0x1B1F0` |
| Format | 2 types packed per byte (lo nibble = even index, hi nibble = odd index) |
| Source | [RANDO] |

### Gold Reward Table
**Confidence: HIGH** — address, stride, and BCD encoding verified against FFLRandomizer source (`ReadGoldTableValue`).

| Field | Value |
|---|---|
| File offset | `0x1B2A4` |
| Entry size | 2 bytes, **4-digit packed BCD** |
| Entry count | 16 (indices 0–15; fit in lower nibble of stat byte 6) |
| Source | [RANDO], code-verified |

**BCD decode:** byte0 = `(thousands<<4)|hundreds`, byte1 = `(tens<<4)|units`. Example: `[0x09, 0x00]` = 900 GP.

**Table values:**
| Index | Bytes (hex) | GP | Used by |
|-------|-------------|-----|---------|
| 0 | 00 00 | 0 | many (no reward) |
| 1 | 00 40 | 40 | fly, barracud tier |
| 2 | 01 20 | 120 | |
| 3 | 02 40 | 240 | drgonfly tier |
| 4 | 04 00 | 400 | hornet/mosquito/shark tier |
| 5 | 06 00 | 600 | garlic tier |
| 6 | 09 00 | 900 | gen-bu |
| 7 | 12 00 | 1200 | gunfish tier |
| 8 | 16 00 | 1600 | |
| 9 | 20 00 | 2000 | cicada/mantis tier |
| 10 | 24 00 | 2400 | |
| 11 | 40 00 | 4000 | |
| 12 | 48 00 | 4800 | sei-ryu |
| 13 | 55 00 | 5500 | byak-ko |
| 14 | 65 00 | 6500 | su-zaku |
| 15 | 99 99 | 9999 | ashura |

### Ability / Item Name Table
**Confidence: HIGH** — verified; matches ability names decoded from ROM in previous sessions.

| Field | Value |
|---|---|
| File offset | `0x14640` |
| Entry count | 252 |
| Entry size | 8 bytes |
| Byte 0 | Prefix code (`0xEC`=sword, `0xEF`=elemental spell, `0xE9`=helmet, `0xED`=chest, `0xE8`=gloves, `0xEA`/`0xEB`=shoes) |
| Bytes 1–6 | Name text, `0xFF`-padded |
| Byte 7 | **Uses count** — FFLRandomizer calls this field "item uses". The value also serves as a type discriminator by range: `0x01`/`0x03`=usable item; `0x05`,`0x0A`,`0x0B`,`0x0F`=ability (spell); `0x14`/`0x1E`=gun (20/30 shots); `0x32`=sword (50 uses); `0xFE`/`0xFD`=armor (unlimited). |
| Source | [DC], [RANDO], verified |

### Item GP Cost Table
**Confidence: HIGH** — address and format confirmed from [RANDO] source (`ReadGPCost` / `ReadItemCost`).

| Field | Value |
|---|---|
| File offset | `0x17E10` |
| Entry size | 3 bytes per item |
| Entry count | 252 (same as ability name table) |
| Format | **6-digit packed BCD** — each nibble = one decimal digit; supports 0–999,999 GP |

**BCD decode:** `byte0 = (100000s<<4)|10000s`, `byte1 = (1000s<<4)|100s`, `byte2 = (10s<<4)|1s`. Examples: 6,789 GP → `[0x00, 0x67, 0x89]`; 10,480 GP → `[0x01, 0x04, 0x80]`. Prior "incoherent" readings were caused by incorrect 3-byte LE integer interpretation.

`ReadItemCost(filebytes, item_id)` = `ReadGPCost(filebytes, 0x17E10 + 3 * item_id)`

### Item Full Stat Table
**Confidence: MEDIUM** — address and field names from [RANDO]; stride confirmed (8 bytes/item, same as ability name table).

| Field | Value |
|---|---|
| File offset | `0x1B700` |
| Entry count | 252 (same as ability name table) |
| Entry size | 8 bytes |

**Field layout per entry (8 bytes):**
| Byte offset | Field | Notes |
|---|---|---|
| +0 | Flags A | Bitmask: 0x01=weapon/attack, 0x02=consumable, 0x04=helm slot, 0x08=body slot, 0x10=gloves slot, 0x20=shoes slot, 0x40=elemental defense passive (D-items) |
| +1 | Flags B | Combat behavior: 0xA0=strike weapon, 0x80=projectile/gun, 0xC0=area spell, etc. |
| +2 | Item type code | 0x00=armor, 0x06-0x0C=strike variants, 0x11=gun, 0x12=bow, 0x13=whip, 0x14=ordnance, 0x1A=attack spell, 0x22=area spell, 0x18=healing usable, 0x19=status-cure usable |
| +3 | Alt uses | **True per-item uses count.** For most items matches type_byte from name table, but differs for legendary weapons: glass sword=1 (one-hit breaks), masamune=254 (unlimited), 'xclbr=254, 'vampic=30, 'rune=30. SMG=25 (type_byte=20). Stored in `abilities.json` `uses` field. |
| +4 | X value | **Weapon power** for swords/weapons; **DEF stat** for equippable armor; **heal amount** for potions (potion=30, xpotion=90 confirmed) |
| +5 | Y value | **Element**: 1=fire, 2=ice, 4=elec, 8=poison, 15/255=all; bitmask — for D-items (FlagsA=0x40) expands to include 16=stone, 32=para, 64=weapon, 128=quake |
| +6 | GFX index | Sprite tile used for this item |
| +7 | Group flag + SFX | Bit 7 = group flag (`ReadItemGroupFlag`); bits 6–0 = SFX index (`ReadItemSFX`) |

**Per-item equip restrictions (human/mutant/monster):** These are **NOT stored per-item** in the ROM. Equipment capacity is a class-level engine rule: humans can hold 8 items, mutants 4, monsters cannot use items.

**Armor prefix byte** (name table byte 0) correct mapping (confirmed against FlagsA bits):
- 0xEC = sword, 0xED = helm, 0xE8 = body, 0xEA = gloves, 0xEB = shoes, 0xEF = magic/spell, 0xE9 = shield, 0xEE = gun

**Decoded data in abilities.json:**
- `defense`: X value for 22 equippable armor items (FlagsA slot bits set, type=0x00)
- `slot`: "helm"/"body"/"gloves"/"shoes"/"all" from FlagsA bits
- `power`: X value for 60 weapons (type='sword' or 'weapon' in abilities.json)
- `element`: Y value decoded for weapons/armor where Y in {1,2,4,8,15,255}
- `heal`: X value for potion (id=0) and xpotion (id=1)
- `uses`: AltUses (byte +3) for all swords/weapons/spells/abilities/usable items. Equals type_byte for most items; differs for glass sword (1), masamune/xclbr (254=unlimited), vampic/rune (30), SMG (25)

**Status-cure items (X field):** For usable items with Typ=0x19 (status cure), the X field is a bitmask of status bits to CLEAR: needle=0xFD (clears bit 1), symbol=0xFB (bit 2), eyedrop=0xF7 (bit 3), antdote=0xEF (bit 4), shocker=0xBF (bit 6), pan=0xDF (bit 5), bell=0x7F (bit 7). Status bit meanings not yet confirmed from BGB.

### Monster Ability List Table
**Confidence: HIGH** — pointers confirmed from [RANDO]; list format decoded by inter-pointer length analysis.

| Field | Value |
|---|---|
| Location | Bank 6, beginning at file `0x1B321` (fly = first monster) |
| Pointer | Little-endian 16-bit CPU address in stat entry bytes 7–8; bank 6 CPU `0x4000`–`0x7FFF` → file `0x18000 + (cpu − 0x4000)` |
| Format | **Packed sequential lists, no terminator.** Each monster's list starts at its pointer; length = next monster's pointer − this monster's pointer. All 200 monsters' lists extracted. |
| Entry size | 1–8 bytes per monster (1 byte per ability ID) |
| Encoding | Direct ability table ID (same index space as ability name table at `0x14640`). `0xFE` = placeholder slot (mutant class stubs use these). `0xFF` = special (creator boss). |
| Source | [RANDO] (pointers), direct decode (list format) |

**List structure:** Each byte is a direct ability ID (0–251). Lists include both active abilities (type=sword/weapon/ability/spell) and passive defenses (type=armor, i.e., D-items and E-items). The passive entries give the monster's inherent resistances when a Monster-class player transforms. Ability IDs stored in `monsters.json` `ability_ids` field.

**Examples:**
- fly (id=0): [149, 216, 225] = nail · Dquake · Eice
- wolf (id=30): [140] = bite
- creator (id=199): [255, 28, 126, 127, 29, 201, 131, 222] = ?FF · light · left · right · repent · flare · revive · Dall

### Encounter Table
**Confidence: MEDIUM** — address and stride from [RANDO]; not yet byte-verified for content.

| Field | Value |
|---|---|
| File offset | `0x1A868` |
| Entry count | 128 |
| Entry size | 5 bytes |
| Source | [RANDO] |

Format of each 5-byte encounter entry not yet documented. Contains monster IDs for each encounter slot.

### Equipment Shop Tables
**Confidence: MEDIUM** — addresses from [RANDO]; not yet byte-verified.

14 shop inventory tables at file offsets (each stores a list of item IDs):

| # | File offset |
|---|---|
| 1 | `0x17D38` |
| 2 | `0x17D4C` |
| 3 | `0x17D60` |
| 4 | `0x17D74` |
| 5 | `0x17D88` |
| 6 | `0x17D9C` |
| 7 | `0x17DB0` |
| 8 | `0x17DC4` |
| 9 | `0x17DD8` |
| 10 | `0x17DEC` |
| 11 | `0x17E00` |
| 12 | `0x17D7E` |
| 13 | `0x17DBA` |
| 14 | `0x17DE2` |

Item GP prices for shop items: see Item GP Cost Table at `0x17E10`.

### Chest Contents Table
**Confidence: MEDIUM** — addresses from [RANDO]; not yet byte-verified.

44 chest locations; each stores a single item ID byte. Addresses span Bank 2 (`0x0A404`–`0x0AB32`), Bank 5 (`0x16322`–`0x168B6`), and Bank 5 (`0x17710`). Full address list in [RANDO] source.

### Meat Transformation Tables
**Confidence: MEDIUM** — addresses from [RANDO]; description plausible given known 25-family system.

| Table | File offset | Format |
|---|---|---|
| Eat transformation | `0x0AFD3` (Bank 2, CPU `0x6FD3`) | 29 bytes × 25 rows (25 eater families × 29 result slots) |
| Meat result lists | `0x0B2A8` | 16 bytes × 25 monster classes |

### Character Portrait Tables (SPic / LPic)
**Confidence: MEDIUM** — addresses from [RANDO]; confirmed as sprite/portrait index storage.

| Field | File offset | Format | Notes |
|---|---|---|---|
| SPic + meat level | `0x0B438` | 1 byte per monster (200 entries): upper nibble = small portrait index, lower nibble = meat level | In bank 2, CPU `0x7438` |
| LPic (large portrait) | `0x0B900` | 1 byte per monster (200 entries): portrait index | In bank 2, CPU `0x7900` |

**Note:** The upper nibble of byte at `0x0B438 + idx` is the small portrait (SPic) tile group index. This table may be the key to resolving the `can_drop_meat` / meat level data that was previously extracted (incorrectly) from the stat table.

### Tower Exit Pairs
**Confidence: LOW** — address from [RANDO]; format not yet verified.

| Field | Value |
|---|---|
| File offset | `0x92D0` (Bank 2, CPU `0x52D0`) |
| Entry size | 3 bytes per exit pair |
| Source | [RANDO] |

### Starting Character / Guild Table
**Confidence: HIGH** — verified by direct byte read.

| Field | Value |
|---|---|
| File offset | `0x17F90` |
| Format | 8 bytes per guild slot |
| Source | [RANDO], verified |

**Verified bytes at `0x17F90`:**
```
B1 B2 B3 B4 12 24 48 78  ← starting character options (slot 1)
AD AE AF B0 42 60 8A 4E  ← guild templates or slot 2 options
B1 B2 B3 B4 06 30 3C 1E  ← additional entries...
```

Decoded starting characters (indices `[177, 178, 179, 180, 18, 36, 72, 120]`):
HUMAN(M), HUMAN(F), MUTANT(M), MUTANT(F), CLIPPER, REDBULL, WERERAT, ZOMBIE

### Mutant Growth Rate Table
**Confidence: MEDIUM** — address from [RANDO]; byte read shows plausible graduated values; field labels from [RANDO].

| File offset | Field |
|---|---|
| `0x1BF00` | Learn ability rate threshold |
| `0x1BF01` | Gain HP rate threshold |
| `0x1BF02` | Gain MANA rate threshold |
| `0x1BF03` | Gain AGI rate threshold |
| `0x1BF04` | Gain STR rate threshold |
| `0x1BF05` | Gain DEF rate threshold |
| `0x1BF06` | Alter uses rate threshold |
| `0x1BF0A` | HP gain amount |
| `0x1BF0B` | STR gain amount |
| `0x1BF0C` | DEF gain amount |
| `0x1BF0D` | AGI gain amount |
| `0x1BF0E` | MANA gain amount |
| `0x1BF0F` | Mutant learnable ability list | 2 bytes per ability, 31 abilities (62 bytes total) |

**Verified raw bytes at `0x1BF00`:** `23 45 63 75 87 8F 93 FF FF FF AF 15 13 15 15 F0`

### Meat Transformation Table
**Confidence: MEDIUM** — address from [RANDO]; byte read shows `0xFF` sentinel + item indices.

| Field | Value |
|---|---|
| File offset | `0x0AFD3` (Bank 2, CPU `0x6FD3`) |
| Format | 29 bytes per row, 25 rows (25 monster families × 25 result slots) |
| Source | [RANDO] |

### Equipment Shop Addresses
**Confidence: LOW** — addresses from [RANDO]; not yet byte-verified.

14 shops at (file offsets): `0x17D38`, `0x17D4C`, `0x17D60`, `0x17D74`, `0x17D88`, `0x17D9C`, `0x17DB0`, `0x17DC4`, `0x17DD8`, `0x17DEC`, `0x17E00`, `0x17D7E`, `0x17DBA`, `0x17DE2`

### Chest Contents Addresses
**Confidence: LOW** — addresses from [RANDO]; not yet byte-verified. Note: addresses like `0x0A404` are file offsets (Bank 2), not CPU SRAM addresses.

45 chests across all worlds. See source for full list.

---

## Graphics and Tile Data

### Font / Text Tiles (1bpp)
**Confidence: HIGH** — verified; tiles extracted and rendered in `img/tile_sheet_1bpp_large.png`.

| Field | Value |
|---|---|
| File offset | `0x0F100`–`0x0F4B7` (Bank 3, CPU `0x7100` when Bank 3 active) |
| Count | 119 tiles × 8 bytes = `0x3B8` bytes |
| Format | 1 byte per row, bit 7 = leftmost pixel; 1=dark (color 3), 0=light (color 0) |
| VRAM dest | `0x9000` (tile area 2, signed-index mode) |
| Startup copy | Bank 0 at `0x0305`: doubles each byte to both bitplanes (1bpp → 2bpp) |

**Tile index mapping:**
| Range | Characters |
|---|---|
| 0–9 | Digits 0–9 |
| 10–35 | Letters A–Z |
| 36–61 | Letters a–z |
| 62–103 | Blank / space tiles |
| 104–118 | Special characters |

### Bank 2 Graphics Tiles (2bpp)
**Confidence: HIGH** — verified; all 1024 tiles exported to `img/bank2_tile_grid.png`.

| Field | Value |
|---|---|
| File offset | `0x08000`–`0x0BFFF` |
| Format | Standard GB 2bpp, 16 bytes/tile (2 bytes/row: lo bitplane, hi bitplane) |
| Count | 1024 tiles |
| Content | World map tiles, character sprites, UI graphics, dungeon tiles |

---

## Text Encoding

### Character Encoding Table (Name Text)
**Confidence: HIGH** — verified by decoding all 200 monster names and 252 ability names from ROM using RANDO `FFLNameTextToASCII`; all names match expected values.

**NOTE:** Previous table (from Data Crystal) had uppercase/lowercase/digit ranges WRONG. RANDO source is authoritative.

```
Digits:    0x80='0'  0x81='1'  0x82='2'  …  0x89='9'   (byte - 0x50)
Uppercase: 0x8A='A'  0x8B='B'  0x8C='C'  …  0xA3='Z'   (byte - 0x49)
Lowercase: 0xA4='a'  0xA5='b'  0xA6='c'  …  0xBD='z'   (byte - 0x43)

Special / symbol bytes:
  0xFF = ' ' (space / name padding)
  0xF2 = '-' (hyphen — used in "GEN-BU", "SEI-RYU", etc.)
  0xF0 = '.' (period)
  0x42 = ♥  (HP item icon)
  0x40 = stat-up symbol (appears in stat-boost items before digit)
  0x43 = '>' (resist — prefix on elemental armor e.g. ">FIRE")
  0x44 = '<' (weakness — prefix on some items)
  0x45 = '/' (slash)

Item type prefix bytes (byte 0 of ability name entry):
  0xEC = sword  0xED = helm  0xE8 = body armor
  0xEA = gloves  0xEB = shoes  0xEF = book/magic
  0xEE = gun  0xE9 = shield
```

**Note on 0x40–0x59 range:** Previous table claimed these were A–Z (uppercase). RANDO does NOT map this range to letters; 0x40 appears in ability names as a stat symbol. These bytes may encode symbols or special UI characters. Do not use as A–Z.

**Separate encoding for story/DTE text:** The DTE compression table (at 0x14E40) uses a different byte-to-character mapping for dialog and story text. Do not apply the name-text encoding to dialog bytes.

### DTE (Double Tile Encoding) Compression
**Confidence: HIGH** — table location verified by direct byte read in previous sessions.

| Field | Value |
|---|---|
| DTE1 table | Bytes `0x50`–`0x8F` → 64 bigram pairs (128 bytes) |
| DTE2 table | Bytes `0xC0`–`0xF6` → 55 bigram pairs (110 bytes) |
| ROM location | `0x14E40` (Bank 5) |
| RAM load dest | `0xC800` (DTE1) and `0xC860` (DTE2) |
| Load code | Bank 0 at `0x02DD` |
| Note | DTE is recursive; ALL dialog text is DTE-compressed; raw byte search for English words is impossible |
| Dialog text range | `0x14F3E`–`0x17D37` (Bank 5, 11,770 bytes, immediately after DTE tables) |
| Dialog encoding | Direct chars use **lowercase range** `0xA4`–`0xBD` (display as uppercase). ALL of `0x50`–`0x8F` are DTE1 codes (no overlap with A–F letters). `0xBE`=apostrophe, `0x0D`=newline, `0x00`=string terminator. |
| Extracted strings | 251 strings decoded to `data/dialog.json` (MEDIUM confidence; control code semantics partially unknown) |
| Confirmed dialog | "THERE IS A TOWN HIDDEN IN THE CLOUDS" ~`0x173E0`; "IF YOU WANT TO DRINK HERE" ~`0x15281`; character names "JEANNE", "SAYAKA" at `0x15039`–`0x1504B` |
| Story intro | NOT FOUND in bank 5; likely in bank 1 or 3 with game startup code |

### Bank 3 UI Strings (confirmed)
**Confidence: HIGH** — verified by byte read at `0x0ECC8`.

Strings found at `0x0ECC8`: `start`, `continue`, `fight`, `run`, `item` (normalbase encoding, written to VRAM at runtime).

---

## Code / Engine Addresses

**Confidence: MEDIUM** — from [DC]; not yet independently verified by tracing execution.

| File offset | CPU addr (Bank 6) | Description |
|---|---|---|
| `0x1A008` | `0x6008` | Text copy: `0xDE00` → `0xC600` |
| `0x1A3DE` | `0x63DE` | Text tile routine: `0xC600` → VRAM `0x9900` |
| `0x193BF` | `0x79BF` | Post-battle mutation dispatch loop |

### Placeholder: Routines Not Yet Found

The following rendering/logic routines are needed but not yet located.
**How to find them**: Load ROM in BGB debugger; set write breakpoint on VRAM `0x9800`–`0x9BFF`
(BG tilemap) or `0xFF46` (OAM DMA); trigger the relevant screen; PC at the breakpoint is
in the render routine. See `.claude/sources.md` for the full approach.

| Routine | Status | Notes |
|---|---|---|
| Title screen renderer | NOT FOUND | BG tilemap built dynamically; trace from VRAM write breakpoint |
| Class select renderer | NOT FOUND | Shows 8 character entries + sprites; sets up OAM |
| Class select OAM setup | NOT FOUND | Positions the 8 character portrait sprites |
| Name entry renderer | NOT FOUND | Letter grid + name display |
| Story text renderer | NOT FOUND | Uses DTE decoder at `0x0F36` (bank 0) |
| Battle initialization | NOT FOUND | Called when encounter triggers |
| Damage formula | NOT FOUND | Physical, magic, gun damage calculations |
| Overworld tilemap builder | NOT FOUND | Writes tile indices to BG map at runtime |
| Save (crystal ball) handler | NOT FOUND | Writes character/world state to SRAM |
| Load (CONTINUE) handler | NOT FOUND | Reads SRAM and restores state |

---

## WRAM (RAM) Addresses

**Confidence: LOW** — from [GS] GameShark codes and [TAS]; not verified against this ROM binary.

### RNG Table
| Address | Description |
|---|---|
| `0xC300`–`0xC37F` | 128-byte RNG seed table; each byte dedicated to one event type |
| `0xC30B` | Mutant growth RNG (increments by 1 each use) |

### Gold
| Address | Description |
|---|---|
| `0xCC8D`–`0xCC8F` | Gold, 3 bytes (exact encoding unverified) |

### Character Block (25-byte stride)
Each character occupies 25 (`0x19`) bytes starting at:
| Character | Base WRAM |
|---|---|
| 1 | `0xCC06` |
| 2 | `0xCC1F` |
| 3 | `0xCC38` |
| 4 | `0xCC51` |

### Race / Sex Byte (WRAM encoding)
| Byte | Meaning |
|---|---|
| `0xAD` | Human Male |
| `0xAE` | Human Female |
| `0xB3` | Mutant Male |
| `0xB4` | Mutant Female |
| (other) | Monster (family-specific) |

---

## SRAM Save Structure

**Confidence: LOW** — MBC2 hardware standard for window address; internal layout not publicly documented.

| Field | Value |
|---|---|
| SRAM window | CPU `0xA000`–`0xBFFF` (MBC2 battery-backed) |
| Internal layout | NOT yet extracted from this ROM binary |

### Placeholder: SRAM Fields Not Yet Mapped

**How to find them**: Make two saves in different states → hex-diff the SRAM bytes →
differing bytes correspond to the changed value. Repeat for each field (HP, gold, inventory, world flags).

| SRAM field | Status |
|---|---|
| Save slot count / layout | NOT FOUND |
| Character name storage | NOT FOUND |
| Character class / race byte | NOT FOUND |
| Current HP per character | NOT FOUND |
| Max HP per character | NOT FOUND |
| STR / DEF / AGI / MANA per character | NOT FOUND |
| Item inventory (4 chars × slots) | NOT FOUND |
| Mutant ability slots | NOT FOUND |
| Gold amount | NOT FOUND |
| Current world / floor | NOT FOUND |
| Crystal ball save point flags | NOT FOUND |
| Boss defeated flags | NOT FOUND |

---

## Placeholder: Sprite / Asset Data Not Yet Located

| Asset | Status | Notes |
|---|---|---|
| Class select character portrait tiles | NOT FOUND | 8 portraits; in Bank 2; need OAM trace |
| Class select cursor sprite tile | NOT FOUND | Circular ring icon; in Bank 2 or Bank 0 |
| Overworld character walk sprites | NOT FOUND | 2-frame per direction per class; Bank 2 |
| Town / dungeon tiles | NOT FOUND | Bank 2; tile indices for world map rendering |
| Battle background tiles | NOT FOUND | Bank 2 |
| Boss sprites | NOT FOUND | Bank 2; likely large (multi-tile) |

---

## Known Discrepancies and Correction Log

1. **monsters.json stat values** — extracted assuming 8-byte stride; correct stride is 9. HP values are unaffected (HP table is separate). Re-extraction needed.
2. **Item GP cost table** — address `0x17E10` from [RANDO] but 3-byte LE gives incoherent prices. Format or stride needs verification.
3. **Class select screen rendering** — dynamically rendered at runtime; exact routine address not yet found. Use BGB VRAM write breakpoint.
4. **Class select sprite tile indices** — not yet identified. Use BGB OAM viewer while class select is displayed.
5. **Full ROM disassembly** — no complete US ROM disassembly publicly available. See TODO.md and sources.md.
6. **REDBULL vs REDHORN** — ROM byte-reads at index 36 decode to `redbull`. Emulator screenshot showed `REDHORN` — likely a different ROM version or patch. Our ROM is authoritative: `redbull`.
