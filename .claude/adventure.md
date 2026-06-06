# Adventure — Design Context

Single-file RPG at `games/adventure.html`. Inspired by Final Fantasy Legend (1989 Game Boy) for character systems and Galaxiga for path-progression UX.

**Always read this file when working on `games/adventure.html`.**

---

## Design decisions (locked)

| Topic | Decision |
|---|---|
| Robot class | Playable from the start; parts system is stubbed "Coming Soon" |
| 0 HP | Character is unconscious for the rest of battle, wakes at 1 HP |
| Full party KO | Respawn at home town inn at full HP; no penalty beyond lost time |
| Inn | Heals full HP, costs 10 gold |
| Turn order | Round-based, player acts first; all party then all enemies |
| Monster evolution | 2-level transformation tree (hardcoded); meat drops from enemies |
| Mutant mutation | 20% chance after each fight/RP; player chooses slot or declines |
| Save system | localStorage key `adventure_saves`, JSON array, max 10 saves |
| Gender | Male / Female — cosmetic only for now |

---

## Character types

### Human
- Stats scale cleanly per level. Melee (STR) or ranged (DEX) weapon.
- Starting: HP 30, STR 5, DEX 5, DEF 3. Per level: +5 HP, +1 STR, +1 DEX, +0.5 DEF.

### Mutant
- 4 ability slots; random abilities from pool; 20% post-encounter mutation chance.
- Starting: HP 25, STR 4, DEX 6, DEF 2. Per level: +4 HP, +0.8 STR/DEX, +0.4 DEF.
- Level-up also triggers a guaranteed mutation offer.

### Monster
- Form-based stats. Starts as DOG. No weapon slots — uses natural attack.
- Transformation tree (eat meat to transform):
  ```
  DOG → wolf_meat → WOLF → bear_meat → BEAR
  DOG → cat_meat  → CAT  → panther_meat → PANTHER
  DOG → boar_meat → BOAR → troll_meat → TROLL
  ```
- HP scales +4/level for XP tracking; form stats are fixed.
- Prompt player to eat eligible meat between battles if in inventory.

### Robot
- Stats scale per level. Melee weapon. Built-in Iron Fist at start.
- Starting: HP 35, STR 6, DEX 4, DEF 5. Per level: +4 HP, +1 STR, +0.5 DEX, +0.8 DEF.
- Parts system: TODO (show "Coming Soon" in party status).

---

## Combat formula

- **Hit %**: `clamp(75 + (attackerStat - defenderDEF) * 2, 15, 95)`
  - attackerStat = STR (melee), DEX (ranged), ATK (monster form)
- **Damage**: `rand(dmgMin, dmgMax) + floor(attackerStat / 3)`
- **XP threshold**: `level * 20` — level up when xp >= threshold

---

## Adventure flow

- Vertical scrollable timeline; party icon at current node
- Pre-scripted tutorial nodes (IDs 0–6), then procedural generation
- Locations: `town` | `forest` | `road` — each has its own encounter pool
- Decision forks shown as branching paths on the timeline

### Tutorial sequence
```
0 → combat  → Ambushed by stray dogs (2x stray_dog)
1 → decision → Head to Town OR Head into Wilds
2 → rp      → Father's Warning (if town)   → 4
3 → rp      → Wounded Traveler (if wilds)  → 4
4 → decision → Visit Inn OR Enter Holt Forest
5 → rp      → Inn Rest                     → 7
6 → combat  → Forest Patrol (wolf + cat)   → 7
7+→ procedural
```

---

## Enemy definitions

| ID | Name | HP | ATK | DEF | XP | Notable loot |
|---|---|---|---|---|---|---|
| stray_dog | Stray Dog | 12 | 3 | 1 | 8 | wolf_meat 20% |
| wild_wolf | Wild Wolf | 20 | 5 | 2 | 14 | wolf_meat 40% |
| forest_cat | Forest Cat | 15 | 4 | 2 | 11 | cat_meat 35% |
| boar | Wild Boar | 28 | 7 | 3 | 18 | boar_meat 30% |
| bandit | Bandit | 25 | 6 | 3 | 20 | potion 25% |
| forest_troll | Forest Troll | 50 | 10 | 5 | 40 | troll_meat 25% |
| dark_knight | Dark Knight | 40 | 9 | 6 | 35 | iron_sword 15% |

---

## Gold

- Shared party pool, starts at 0
- Gold per enemy killed: rand(2, 8)
- Spent at inn (10 gold) and shops (RP encounters)

---

## TODO

- [ ] Shop RP encounter (buy weapons, armor, potions)
- [ ] Quest system (tracked quests, bonus XP from quest completion)
- [ ] Road zone encounters (bandits, merchant)
- [ ] More enemy variety (skeleton, dark mage, goblin)
- [ ] Robot parts system
- [ ] Random name lists expansion
- [ ] Sound effects (Web Audio API, no external files)
- [ ] Difficulty modes (Casual / Normal / Hardcore permadeath)

## LATER

- Random monster evolution flowchart generated per new game
- Persistent world state (killed nobles, cleared bandit camps affect future encounters)
- More RP scripts: merchant, quest givers, mysterious stranger
- Ranged weapon enemy type
- Status effects: burn, freeze, stun, bleed
- Party formation / back row mechanics

## DONE

- [x] Core design decisions locked (2026-06-06)
- [x] Character creation: all 4 types, gender, random names
- [x] Combat system: round-based, hit/damage formula, flee
- [x] Mutant ability system with 4 slots and mutation offers
- [x] Monster transformation tree (2-level)
- [x] Adventure flow: tutorial nodes + procedural generation
- [x] Save / load / delete system (localStorage)
- [x] RP encounter engine (dialog tree, branching, effects)
- [x] Party status screen
- [x] Gold system
- [x] Inn rest mechanic
- [x] Level-up system with stat scaling
