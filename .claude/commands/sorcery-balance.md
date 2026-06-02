Simulate Sorcery upgrade stacking math and report a balance snapshot.

Read games/sorcery.html and games/sorcery-design.md for current values, then:

1. **Upgrade progression tables** — for each upgrade, show the stat value after 1–8 stacks starting from the base spell value. Use the actual multipliers from UPGRADE_DEFS. Format as a compact table per upgrade.

   Spells to simulate:
   - SPLIT on Magic Missile (base _split: 1)
   - SPEED on Magic Missile (base speed: 900)
   - POWER on Magic Missile (base dmg: 25) and Fireball (base dmg: 15)
   - IGNITE on Magic Missile (base dot: 0) and Fireball (base dot: 3)
   - REINFORCE on Force Field (base hp: 100)

2. **Time-to-kill estimates** — at each POWER stack level, how many Magic Missile hits does it take to kill a wave-10 IMP, ORC, TROLL, and GOLEM? (Use diffScale(10) for HP.)

3. **Fire wall DPS analysis** — at 333 ms tick interval with base dotDmg 5, how much total damage does a slow enemy (speed 22, GOLEM) take while crossing a 12 px wall? How many ticks? Compare to a fast enemy (speed 75, GHOST).

4. **Level-up rate estimate** — given xpNeeded(lvl) = 10 + (lvl-1)*8 and that an IMP gives ~3.5 XP at wave 5 (base 1 + floor(5*0.25)=2, plus variance), roughly how many kills does it take to reach each of levels 2–10?

5. **Balance verdict** — flag any upgrade that looks obviously overpowered (reaches one-shot territory early) or underpowered (negligible effect even at 5+ stacks). Keep it to 2–3 bullet points.

Report in compact tables and short paragraphs. Do the arithmetic yourself — do not approximate.
