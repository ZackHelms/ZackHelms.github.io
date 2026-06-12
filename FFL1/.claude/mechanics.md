# FFL1 Game Mechanics Reference

## Character Classes

### Human
- **Equipment slots**: 8 (weapons + armor)
- **Stat growth**: Only through consumable stat items (Strong, Agility, etc.); permanent +1 per use
- **Stat cap display**: 99; internal max 255; HP max 999
- **Armor**: Can equip helmet, chest, gloves, shoes (each +DEF or other bonus)
- **Note**: Losing class (switching) erases all stat-item gains

### Mutant
- **Equipment slots**: 4 (weapons/items only — no armor slots for mutants)
- **Ability slots**: 4 (separate from equipment; auto-filled randomly after battles)
- **Stat growth**: Random increases after each battle based on actions taken:
  - Attacked with STR weapon → STR may increase
  - Used AGI weapon (rapier, gun) → AGI may increase
  - Cast spells / used MANA ability → MANA increases most
  - HP increases from surviving/killing
- **Ability overflow**: When a 5th ability would be learned, a random existing ability is deleted silently
- **Stat cap display**: 99; internal up to 255; HP max 999
- **Best practice**: Save before each battle to keep desired abilities

### Monster
- **Equipment slots**: 0 (cannot equip weapons or armor)
- **Meat slots**: 4 (holds meat items; eating transforms the monster)
- **Stat growth**: Transformation only — eating 4 matching meats changes form; new form's base stats apply
- **Meat system**:
  1. Monsters drop meat when defeated (same family as the defeated monster)
  2. Meat has a hidden "level" value (1–20) indicating which tier of the family
  3. Eating 4 meats of the same family transforms you into that family at the meat's level
  4. Higher-level meat → more powerful form (better stats)
  5. The transformation table (25 families × 25 families) governs results when mixing meat families

## Battle System

### Turn order
- Each character and enemy takes 1 action per turn
- Order determined by AGI stat (higher AGI acts first)
- Ties broken randomly

### Damage formula (approximate)
```
Physical: damage = rand(attacker.str * 2, attacker.str * 3) - defender.def
          min damage = 1
Magic:     damage = rand(caster.mana * 2, caster.mana * 3) - (effect dependent)
Gun:       damage = weapon.base_power * rand(0.8, 1.2)  [largely ignores stats]
```

### Status effects
| Status | Effect | Cure |
|---|---|---|
| Poison | Lose HP each turn | Antdote |
| Sleep | Skip turns | Bell / taking damage |
| Stone | Petrified, cannot act | Needle / Eyedrop |
| Blind | Attacks often miss | Eyedrop |
| Death | Character KO'd | Revive |

### Elemental weaknesses
- Fire spells effective vs. Plant, Ice monsters
- Ice spells effective vs. Fire, Dragon (some)
- Elec spells effective vs. Water, Machine types
- Silver weapons effective vs. Undead
- Dragon sword effective vs. Dragon

### Flee
- Flee chance = (party average AGI) vs. (enemy average AGI)
- Higher party AGI → higher flee rate

## Stat Caps
| Stat | Display max | Internal max | Notes |
|---|---|---|---|
| HP | 999 | 999 | |
| STR | 99 | 255 | Display shows min(val, 99) |
| DEF | 99 | 255 | |
| AGI | 99 | 255 | |
| MANA | 99 | 255+ | Mutants can grow beyond 99 internally |

## Weapons
| Type | Stat used | Notes |
|---|---|---|
| Sword (`'`) | STR | Most common; limited uses |
| Axe, Hammer | STR | Higher power, fewer uses |
| Whip | STR | Hits all enemies |
| Bow | STR | Ranged |
| Rapier | AGI | Weaker but scales with AGI |
| Claw | AGI | |
| Gun (pistol/SMG/etc.) | Fixed | Ignores DEF; consistent damage |
| Spell book | MANA | Elemental spells; limited uses |
| Rod/Wand/Staff | MANA | Magic weapons |

## World Structure
1. **World 1** (medieval) → 4 Crystal Balls → gate to World 2
2. **World 2** (mystical) → 4 Crystal Balls → gate to World 3
3. **World 3** (high-tech) → 4 Crystal Balls → gate to World 4
4. **World 4** (dark) → enter Tower of God
5. **Tower of God** → 20 floors → fight Divine Beasts (2nd forms) → Ashura → Creator

## Boss Stats (from ROM)
| Monster ID | Name | HP | STR | DEF | AGI | MANA |
|---|---|---|---|---|---|---|
| 189 | gen-bu | 1280 | 6 | 18 | 32 | 12 |
| 190 | sei-ryu | 3850 | 163 | 11 | 37 | 61 |
| 191 | byak-ko | 6420 | ~high | ~high | ~high | ~high |
| 192 | su-zaku | 8990 | ~high | ~high | ~high | ~high |
| 198 | ashura | ~20000+ | very high | very high | very high | very high |
| 199 | creator | ~25690 | max | max | max | max |
