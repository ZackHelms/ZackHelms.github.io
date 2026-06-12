# FFL1 Mechanics Reference

## What Has (and Has Not) Been Extracted from the ROM

### Extracted
- Monster names — name table at 0x14000 (200 × 8 bytes)
- Monster stats — stat table at 0x1AAE8 (200 × 8 bytes, bytes 2–5 = STR/DEF/AGI/MANA)
- Monster HP — HP table at 0x1B254 (200 × 2 bytes, little-endian)
- Monster drop byte — byte 6 of each stat record; yields can_drop_meat + meat_level
- Ability names — ability table at 0x14640 (252 × 8 bytes)
- Ability type classification — type byte (byte 7) and prefix byte (byte 0) of each ability record
- Character encoding — 0x8A='a'…0xA3='z', 0x40='A'…0x59='Z', 0xA4='0'…0xAD='9'

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
