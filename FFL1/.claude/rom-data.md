# ROM Data Reference

## ROM File
- **Title**: SAGA (internal), "The Final Fantasy Legend" (US box)
- **Platform**: Game Boy (DMG)
- **Size**: 131,072 bytes (128 KB)
- **Cartridge type**: MBC2 (8 switchable 16 KB banks)
- **File**: `Final Fantasy Legend, The (USA).gb`

## Memory Banking
| Bank | File offset | GB CPU address | Notes |
|---|---|---|---|
| 0 | 0x00000–0x03FFF | 0x0000–0x3FFF | Fixed (always mapped) |
| 1 | 0x04000–0x07FFF | 0x4000–0x7FFF | Switchable |
| 2 | 0x08000–0x0BFFF | 0x4000–0x7FFF | Tile/map data |
| 3 | 0x0C000–0x0FFFF | 0x4000–0x7FFF | |
| 4 | 0x10000–0x13FFF | 0x4000–0x7FFF | |
| 5 | 0x14000–0x17FFF | 0x4000–0x7FFF | **Name + ability tables** |
| 6 | 0x18000–0x1BFFF | 0x4000–0x7FFF | **Code + stat tables** |
| 7 | 0x1C000–0x1FFFF | 0x4000–0x7FFF | **Code + HP table** |

## Data Tables (File Offsets)

### Character/Monster Names
- **Offset**: `0x14000`
- **Format**: 200 entries × 8 bytes; each entry is 0xFF-terminated text
- **Total**: 200 entries (indices 0–199)
- **Character encoding**: 0x8A='a', 0x8B='b', … 0xA3='z'; 0x40='A'–0x59='Z'; 0x32=' '; 0xF2='-'; 0x82='+'

### Ability/Item Names
- **Offset**: `0x14640`
- **Format**: 252 entries × 8 bytes; last byte is the item/ability type code
- **Type codes (byte 7)**:
  - `0x01`, `0x03` = usable item
  - `0x05`, `0x0A`, `0x0B`, `0x0F` = ability (mutant/monster use)
  - `0x14`, `0x1E` = gun/ranged weapon
  - `0x32` = sword/blade
  - `0xFE`, `0xFD` = armor
- **Prefix bytes (byte 0)**:
  - `0xEC` = sword (displays as `'` prefix in-game)
  - `0xEF` = elemental spell (fire/ice/elec/etc.)
  - `0xE9` = helmet
  - `0xED` = chest armor
  - `0xE8` = gloves
  - `0xEA`, `0xEB` = shoes

### Monster Stat Table
- **Offset**: `0x1AAE8`
- **Format**: 200 entries × 8 bytes
- **Layout per entry**: `[type, flags, STR, DEF, AGI, MANA, drop_byte, extra]`
- **Note**: Internal stats can exceed 99 (display cap); 255 is true max for STR/DEF/AGI/MANA

### Monster HP Table
- **Offset**: `0x1B254`
- **Format**: 200 entries × 2 bytes, little-endian unsigned 16-bit
- **Range**: 20–9999 for standard monsters; bosses have 5000–25690

## Graphics & Tile Data

### DMG Color Palette
| Index | GB color | Hex (RGB) | Name |
|---|---|---|---|
| 0 | lightest | #9BBC0F | Off-white/green |
| 1 | light | #8BAC0F | Light green |
| 2 | dark | #306230 | Dark green |
| 3 | darkest | #0F380F | Near-black green |

### Font / Text Tiles (1bpp)
- **File offset**: `0x0F100` — `0x0F4B7` (Bank 3, CPU address 0x7100 when bank 3 selected)
- **Count**: 119 tiles × 8 bytes = 0x3B8 bytes
- **Format**: 1 byte per row (8 rows), bit 7 = leftmost pixel; 1=dark (color 3), 0=light (color 0)
- **VRAM destination**: 0x9000 (tile area 2, signed-index mode)
- **Startup copy**: Bank0+0x0305 — `LD A,3; RST 28h; LD DE,0x7100; LD HL,0x9000; LD BC,0x03B8; CALL 0x043D`
  - Copy routine doubles each byte to both VRAM bitplanes (1bpp → 2bpp), yielding color 0 or color 3 only
- **Tile index → character mapping**:
  - `0–9` = digits 0–9
  - `10–35` = letters A–Z (A=10, B=11, … Z=35)
  - `36–63` = lowercase a–z
  - `64–103` = blank/space tiles
  - `104–118` = special characters (punctuation, symbols)
- **Reference image**: `FFL1/img/tile_sheet_1bpp_large.png` — 119 tiles at 6× scale with index labels

### Bank 2 Graphics Tiles (2bpp)
- **File offset**: `0x08000` — `0x0BFFF`
- **Format**: Standard GB 2bpp tiles, 16 bytes each (2 bytes/row: lo bitplane, hi bitplane)
- **Count**: 1024 tiles
- **Content**: World map tiles, sprites, UI graphics, dungeon tiles
- **Reference image**: `FFL1/img/bank2_tile_grid.png` — all 1024 tiles, 32 per row

### Bank Switch Mechanism
- **Instruction**: `RST 0x28` (not a standard MBC register write)
- **Usage**: Load bank number into A, then `RST 0x28`
- **Example**: Bank 3 → `LD A, 3; RST 0x28`

### Title Screen
- **BG tilemap**: **Dynamically built at runtime** — no static tilemap stored in ROM.
  Text positions are written to VRAM by the text renderer; searching ROM for static BG maps
  for the title screen is a dead end.
- **Authoritative pixel source**: `FFL1/img/title_screen.png`
  - 160×144 lossless PNG cropped from emulator screenshot (nearest-neighbor resize)
  - Edit individual pixels directly in this file
- **5× upscale**: `FFL1/img/title_screen_5x.png` (800×720, nearest-neighbor, for reference)

### img/ Directory Contents
| File | Source | Size | Notes |
|---|---|---|---|
| `title_screen.png` | Emulator screenshot → nearest-neighbor resize | 160×144 | Editable pixel-by-pixel |
| `title_screen_5x.png` | `title_screen.png` upscaled | 800×720 | Reference only |
| `tile_sheet_1bpp_large.png` | ROM 0x0F100, 119 tiles | varies | 6× scale, indexed labels |
| `bank2_tile_grid.png` | ROM 0x08000–0x0BFFF, 1024 tiles | varies | 32 tiles/row, 2bpp |
| `gameboy.png` | Hand-authored asset | — | Shell background image |

## Character Encoding Table
```
0x8A=a  0x8B=b  0x8C=c  0x8D=d  0x8E=e  0x8F=f
0x90=g  0x91=h  0x92=i  0x93=j  0x94=k  0x95=l
0x96=m  0x97=n  0x98=o  0x99=p  0x9A=q  0x9B=r
0x9C=s  0x9D=t  0x9E=u  0x9F=v  0xA0=w  0xA1=x
0xA2=y  0xA3=z
0x40=A  0x41=B  … 0x59=Z
0xA4=0  0xA5=1  … 0xAD=9
0x32=' '  0xF2='-'  0x82='+'  0xEC="'"
0xFF = string terminator
```

## DTE (Double Tile Encoding) Text Compression

FFL1 uses DTE compression for UI and story text. Two lookup tables map single bytes to character pairs:

- **DTE1**: bytes `$50`–`$8F` → 64 pairs (128 bytes) — most frequent bigrams
- **DTE2**: bytes `$C0`–`$F6` → 55 pairs (110 bytes) — secondary bigrams

### DTE Table Location
- **ROM offset**: `0x14E40` (bank 5, CPU address `0x4E40`) — loaded into RAM at startup
- **Load destination**: RAM `$C800` (DTE1, 128 bytes) and `$C860` (DTE2, 110 bytes)
- **Load code**: bank 0 at `0x02DD`; copies 256 bytes from ROM bank 5 `$4E40` → RAM `$C800`

### Text Decoder Routines (Bank 0)
| Address | Purpose |
|---|---|
| `0x0918` | Main text decoder (menu/stat display); uses DTE tables |
| `0x0F36` | Secondary text decoder (story/UI text) |
| `0x0000` | RST $00 helper: adds A to HL (indexed table lookup) |

### DTE Encoding Note
The DTE tables at `0x14E40` encode number/stat display characters, NOT story text letters directly. Story text uses the same tables but encodes all letter bigrams — even 4-letter sequences like "been", "said", "tower" have every bigram DTE-compressed, making raw-byte searching for English words impossible without decoding.

### Starting Character Table
- **Offset**: `0x17F90` (bank 5)
- **Format**: 8 bytes — monster/class indices for initial character creation screen
- **Values**: `B1 B2 B3 B4 12 24 48 78` → decimal `[177, 178, 179, 180, 18, 36, 72, 120]`
- **Meaning**: human-m, human-f, mutant-m, mutant-f, CLIPPER(18), REDBULL(36), WERERAT(72), ZOMBIE(120)
- **Confidence**: HIGH (directly read from ROM)

### Player Class Stubs (Bank 5)
- **Offset**: `0x14568` (bank 5)
- **Format**: same as monster name table (8 bytes per entry)
- **Indices 173–188**: All labeled "human" or "mutant" with gender byte at position 7
  - `0x96` ('m') = male, `0x8F` ('f') = female
- 16 total entries for human/mutant variants (guild NPC characters)

### Bank 3 UI Text (confirmed)
- **Offset**: `0x0ECC8` (bank 3)
- **Strings found**: `start`, `continue`, `fight`, `run`, `item` (using normalbase encoding)
- These are dynamically rendered to VRAM by the text engine at runtime

## Monster Index Ranges
| Range | Family/Type |
|---|---|
| 0–5 | Insect (fly, dragonfly, hornet, mosquito, cicada, mantis) |
| 6–11 | Fish (barracuda, piranha, shark, gunfish, elec, leviathan) |
| 12–17 | Plant (cactus, p-flower, garlic, thorn, f-flower, darkrose) |
| 18–23 | Crustacean (clipper, beetle, ant, atom, scorpion, scarab) |
| 24–29 | Shellfish (shrimp, atomcrab, crab, icecrab, kingcrab, dagon) |
| 30–35 | Canine (wolf, jaguar, sabercat, snowcat, blackcat, fenswolf) |
| 36–39 | Bovine (redbull, rhino, triceras, behemoth) |
| 40–41 | Pachyderm (baku, ganesha) |
| 42–47 | Bird (condor, raven, harpy, ten-gu, garuda, nike) |
| 48–53 | Snake (snake, serpent, anaconda, hydra, ko-run, jorgandr) |
| 54–59 | Mollusk (octopus, clam, amoeba, ammonite, squid, kraken) |
| 60–65 | Worm (worm, p-worm, crawler, lavaworm, sandworm, gigaworm) |
| 66–71 | Lizard (lizard, p-frog, gecko, dinosaur, salamand, basilisk) |
| 72–77 | Werebeast (wererat, werewolf, catwoman, minotaur, rakshasa, anubis) |
| 78–83 | Goblinoid (goblin, oni, ogre, giant, titan, susano-o) |
| 84–89 | Mythical (griffin, mantcore, chimera, nue, sphinx, ki-rin) |
| 90–95 | Eye (big, gazer, seeker, watcher, evil eye, beholder) |
| 96–101 | Skeleton (skeleton, red, dokuro, warrior, boneking, lich) |
| 102–107 | Slime (slime, jelly, tororo, gummy, pudding, hi-slime) |
| 108–113 | Demon (gargoyle, imp, demon, demolord, demoking, athtalot) |
| 114–119 | Siren (medusa, siren, lamia, naga, scylla, lilith) |
| 120–131 | Undead/Spirit (zombie, ghoul, …, ghost) |
| 132–137 | Elemental (woodman, clayman, stoneman, ironman, fireman, mazin) |
| 138–143 | Bird2 (albatros, eagle, thunder, cocatris, rock, phoenix) |
| 144–149 | Dragon (dragon×5, tiamat) |
| 150–164 | Human warriors (karateka, pirate, wrestler, …, wizard) |
| 165–172 | Vampire/Machine (vampire, steward, guard, hunter, robot, trooper, armor, machine) |
| 173–188 | Player class stubs (human/mutant variants) |
| 189–199 | Bosses (gen-bu, sei-ryu, byak-ko, su-zaku, + forms, ashura, creator) |
