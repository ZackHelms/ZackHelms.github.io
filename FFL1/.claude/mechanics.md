# FFL1 Mechanics Reference

## What Has (and Has Not) Been Extracted from the ROM

### Extracted
- Monster names — name table at 0x14000 (200 × 8 bytes) — HIGH confidence
- Monster HP — HP table at 0x1B254; indexed via byte 1 of stat entry (NOT directly by monster ID); indices 0–21 = regular HP curve, 22+ = boss HP values — HIGH confidence
- Monster gold — gold table at 0x1B2A4 (4-digit packed BCD, 16 entries); index = lower nibble of stat byte 6; verified against FFLRandomizer source — HIGH confidence
- Monster ability list pointer — stat bytes 7–8 = little-endian bank-6 CPU address to each monster's action list (e.g., fly → 0x7321 → file 0x1B321); confirmed from FFLRandomizer — MEDIUM confidence (pointer confirmed; list format not yet verified)
- Character portrait index tables — SPic (small) at 0x0B438 (upper nibble = portrait group, lower = meat level); LPic (large) at 0x0B900; from FFLRandomizer — MEDIUM confidence
- Encounter table location — 0x1A868, 5 bytes per entry, 128 entries; from FFLRandomizer — MEDIUM confidence (address confirmed; entry format not yet decoded)
- Shop inventory tables — 14 shops at 0x17D38–0x17E00 range; from FFLRandomizer — MEDIUM confidence
- Chest contents table — 44 chests at various bank-2 and bank-5 addresses; from FFLRandomizer — MEDIUM confidence
- Tower exit pairs — 0x92D0 (bank 2, 3 bytes per exit pair); from FFLRandomizer — LOW confidence (not yet verified)
- Ability names — ability table at 0x14640 (252 × 8 bytes) — HIGH confidence
- Ability type classification — type byte (byte 7) and prefix byte (byte 0) of each ability record — HIGH confidence
- Character encoding — 0x8A='a'…0xA3='z', 0x40='A'…0x59='Z', 0xA4='0'…0xAD='9' — HIGH confidence
- Starting character table — ROM 0x17F90 (8 bytes): [177,178,179,180,18,36,72,120] = human-m/f, mutant-m/f, clipper, redbull, wererat, zombie — HIGH confidence
- Player class stubs — ROM 0x14568 (bank 5); indices 173–188 — MEDIUM confidence
- Bank 3 UI text — ROM 0x0ECC8: "start", "continue", "fight", "run", "item" — HIGH confidence
- Font tiles — 1bpp, 119 tiles × 8 bytes at ROM 0x0F100; tile 0–9=digits, 10–35=A–Z, 36–61=a–z — HIGH confidence
- DTE table location — ROM 0x14E40 (bank 5) → loaded to RAM $C800 at startup — HIGH confidence
- Stat table location — ROM 0x1AAE8, **9-byte stride** (corrected from earlier 8-byte assumption) — HIGH confidence for stride; field layout MEDIUM confidence; byte 0 format partially decoded: `0x7B + (num_abils × 8)` for race=Monster/meat_drop=3
- Mutant growth rate thresholds — ROM 0x1BF00 (8 threshold bytes + 5 amount bytes) — MEDIUM confidence
- Item GP cost table — ROM 0x17E10, 3 bytes per item, **6-digit packed BCD** (each nibble = one decimal digit); confirmed from FFLRandomizer `ReadGPCost` — HIGH confidence. All 252 prices extracted to `data/abilities.json` (gp field) and `data/item_prices.json`.
- Item stat table — ROM 0x1B700, 8 bytes per item: FlagsA, FlagsB, Type, AltUses, X, Y, GFX, (GroupFlag bit7 + SFX bits6-0) — MEDIUM confidence
- Item uses count — stored as byte 7 of the ability name table entry (ROM 0x14647 + item_id×8), NOT in the stat table — HIGH confidence (from RANDO `ReadItemUses`)
- Shop inventories — 14 shops at ROM 0x17D38–0x17E0F; 10 item IDs per shop; extracted to `data/shops.json` — HIGH confidence for item IDs and prices; UNVERIFIED for world/location assignments
- Character name encoding — corrected: 0x80–0x89='0'–'9', 0x8A–0xA3='A'–'Z', 0xA4–0xBD='a'–'z', 0xFF=' ', 0xF2='-'. Previous table (Data Crystal) had wrong ranges — HIGH confidence (RANDO source + full 200-name decode verified)
- Meat transformation — 25 monster classes (class = monster_id // 6 for IDs 0–149); eat table at 0x0AFD3 (29 entries × 25 eater classes); class member lists at 0x0B2A8 (16 entries × 25 classes). All values are class indices, not monster IDs. Extracted to data/transformation.json — HIGH confidence
- Encounter table — 128 encounters × 5 monster IDs at 0x1A868. Extracted to data/encounters.json. Encounter 0–5 = boss fights. Which 5 slots are active in battle is NOT YET decoded — MEDIUM confidence

### Previously Unverified — Now Resolved
- **monsters.json STR/DEF/AGI/MANA** — re-extracted with correct 9-byte stride at 0x1AAE8; values now HIGH confidence. monsters.json updated.
- **Monster gold** — gold table BCD encoding and lower-nibble indexing confirmed from FFLRandomizer source; monsters.json updated.

### UNVERIFIED (still needs checking)
- **Stat byte 6 upper nibble** — contains some per-monster data (varies); lower nibble is gold index. Upper nibble purpose not yet identified.
- **Stat bytes 7–8** — unknown; many regular monsters share constant values (e.g., byte8=0x73). Not yet identified. Possibly ability list pointer or encounter data.
- **Monster drop byte** — original "byte 6 of 8-byte entry" note was wrong stride era; current byte 6 = gold+unknown packed field. Actual item-drop mechanic not yet located in ROM.

### Not Yet Extracted
The following mechanics have NOT been extracted from the ROM binary. Do not present
these as facts in wiki pages or context files:

- Damage formulas (physical, magic, gun)
- Turn order logic
- Status effect mechanics (trigger conditions, cure rules, duration)
- Elemental weakness/resistance system
- Flee success calculation
- Equipment slot counts for each class (8/4/0)
- Stat display cap enforcement (99 display vs. internal)
- HP cap value
- Mutant stat gain trigger conditions and probabilities
- Transformation rules (eat count, trigger conditions, target selection)
- Meat system rules (slot count, overflow behavior)
- Stat item effect amounts
- Armor stat bonus values
- World structure (which bosses appear where, crystal ball requirements)
- Story / intro text — DTE-compressed in ROM; no raw bytes searchable without full DTE decode; web-sourced version stored in data/dialog.md (MEDIUM confidence)
- Name-entry UI layout — row/column counts, cell sizes, END/DEL positions not confirmed from ROM
- CONTINUE save-file format — not yet extracted

---

## Boss Stats (from ROM)

All 11 entries at indices 189–199 of the monster table. HP from 0x1B254,
stats from 0x1AAE8. Values shown are raw stored integers; 99 is a display
cap in-game, not a storage cap.

| ROM ID | Name     |   HP  | STR | DEF | AGI | MANA |
|--------|----------|-------|-----|-----|-----|------|
| 189    | gen-bu   | 1280  |   6 |  18 |  32 |   12 |
| 190    | sei-ryu  | 3850  | 163 |  11 |  37 |   61 |
| 191    | byak-ko  | 6420  |     |     |     |      |
| 192    | su-zaku  | 8990  |     |     |     |      |
| 193–199| (additional boss forms, ashura, creator) | varies | | | | |

Note: stat values for indices 191+ should be re-read from monsters.json
rather than approximated here.

---

## Monster Family Groupings (from ROM index ranges)

Boundaries inferred from monster names in the name table. Family names are
descriptive labels assigned by index analysis, not stored as text in the ROM.

| Range   | Inferred family      |
|---------|----------------------|
| 0–5     | Insect               |
| 6–11    | Fish / Aquatic       |
| 12–17   | Plant                |
| 18–23   | Crustacean           |
| 24–29   | Shellfish            |
| 30–35   | Canine               |
| 36–39   | Bovine               |
| 40–41   | Pachyderm            |
| 42–47   | Bird                 |
| 48–53   | Snake                |
| 54–59   | Mollusk              |
| 60–65   | Worm                 |
| 66–71   | Lizard               |
| 72–77   | Werebeast            |
| 78–83   | Goblinoid            |
| 84–89   | Mythical             |
| 90–95   | Eye                  |
| 96–101  | Skeleton             |
| 102–107 | Slime                |
| 108–113 | Demon                |
| 114–119 | Siren                |
| 120–131 | Undead / Spirit      |
| 132–137 | Elemental            |
| 138–143 | Bird 2               |
| 144–149 | Dragon               |
| 150–164 | Human warriors       |
| 165–172 | Vampire / Machine    |
| 173–188 | Player class stubs   |
| 189–199 | Bosses               |

---

## Ability Type Codes (from ROM)

Byte 7 (type) and byte 0 (prefix) of each ability record at 0x14640:

| Value(s)                    | Position | Classification       |
|-----------------------------|----------|----------------------|
| 0x01, 0x03                  | byte 7   | Usable item          |
| 0x05, 0x0A, 0x0B, 0x0F      | byte 7   | Ability              |
| 0x14, 0x1E                  | byte 7   | Weapon (gun/ranged)  |
| 0x32                        | byte 7   | Sword / blade        |
| 0xFE, 0xFD                  | byte 7   | Armor                |
| 0xEC                        | byte 0   | Sword prefix (')     |
| 0xEF                        | byte 0   | Elemental spell      |
| 0xE9                        | byte 0   | Helmet               |
| 0xED                        | byte 0   | Chest armor          |
| 0xE8                        | byte 0   | Gloves               |
| 0xEA, 0xEB                  | byte 0   | Shoes                |
