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
