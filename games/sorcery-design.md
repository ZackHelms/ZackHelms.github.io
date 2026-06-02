# Sorcery — Design Document

## Concept

Mobile-friendly tower defense played on a vertical canvas. The player casts spells
by tapping (ray) or holding 1 second (wall). A base line at the bottom takes damage
when enemies reach it. Waves escalate indefinitely; the goal is to survive as long
as possible.

**Core loop:** Kill enemies → earn XP → level up → pick upgrade or new spell → repeat.

---

## Difficulty Curve

### Scaling Formula
`diffScale(wave) = 1 + wave * 0.14`

Wave 1: ×1.14 &nbsp;|&nbsp; Wave 5: ×1.70 &nbsp;|&nbsp; Wave 10: ×2.40 &nbsp;|&nbsp; Wave 20: ×3.80

All enemy HP and DMG are multiplied by this value on spawn. Speed and range are **not** scaled — enemy speed is a design knob, not an automatic escalator.

### Wave Structure
- Enemies per wave: `6 + wave * 1.6` (wave 1 = ~8, wave 10 = ~22)
- Spawn interval: starts at 2.2 s, decreases by 0.07 s/wave, floors at 0.75 s
- 5% chance of a pure Golem wave once wave ≥ 10
- Next wave begins 2 s after the last enemy of the previous wave dies

### XP Scaling
`xpNeeded(level) = 10 + (level - 1) * 8`
Level 1→2: 10 XP &nbsp;|&nbsp; Level 5→6: 42 XP &nbsp;|&nbsp; Level 10→11: 82 XP

Enemy XP = `def.xp + floor(wave * 0.25)`, so XP per kill scales with wave.

---

## Spells

### Ray Spells (tap to fire)

| Spell | Unlock | Speed | DMG | AOE | DOT | Notes |
|-------|--------|-------|-----|-----|-----|-------|
| Magic Missile | Start | 900 | 25 | — | — | Reliable single-target |
| Fireball | Level-up pick | 420 | 15 | r55 | 3/s 5s | Slower but AOE + burn |
| Laser Beam | Level-up pick | Instant | 12 | — | 2/s 5s | Pierce-all line; no SPEED upgrade |

Rays fire from the base center (`CW/2, BASE_Y`) toward the tap point. Splits fan
out perpendicular to the aim direction, spaced 20 px apart.

### Wall Spells (hold 1 s to cast)

| Spell | Unlock | HP | Duration | Effect |
|-------|--------|----|----------|--------|
| Force Field | Level-up pick | 100 | ∞ until destroyed | Blocks enemy movement; enemies attack it |
| Fire Wall | Level-up pick | ∞ | 20 s | 5 dmg per 333 ms contact + 5 s burn DOT refresh |
| Slow Wall | Level-up pick | ∞ | 20 s | 80% speed reduction while inside |

Only one wall per spell id can exist at a time (timed walls replace previous on cast).
Wall y-position is clamped to `[80, BASE_Y - 80]`.

---

## Upgrades

All upgrades are **multiplicative** and have **no stack limit**. Players can take
the same upgrade as many times as it appears in level-up offers.

| Upgrade | Per Stack | Notes |
|---------|-----------|-------|
| SPLIT | rays × 1.5 (rounds up, min 2) | Geometric ray count growth |
| SPEED | speed × 1.33 | Unavailable for Laser Beam (instant) |
| POWER | dmg × 1.20 | Applies to impact damage only |
| IGNITE | dot × 1.66 (starts at 2 if zero) | DOT fires every 1 s via tickFx |
| REINFORCE | baseHp × 1.50 | Force Field only; unavailable for ∞-hp walls |

**Upgrade math examples (starting from base):**

SPLIT on Magic Missile: 1 → 2 → 3 → 5 → 8 → 12 → 18 rays

POWER on Magic Missile (dmg 25): 25 → 30 → 36 → 43 → 52 → 62 → 75

IGNITE on Magic Missile (dot 0): 0 → 2 → 3 → 5 → 8 → 14 → 23 /s

REINFORCE on Force Field (hp 100): 100 → 150 → 225 → 338 → 506 → 759 HP

---

## Enemies

| Enemy | Wave | Base HP | Base DMG | Speed | Range | Rate | XP | Boss |
|-------|------|---------|----------|-------|-------|------|----|------|
| IMP | 1 | 30 | 8 | 60 | 40 | 1.5/s | 1 | |
| ORC | 3 | 80 | 18 | 40 | 45 | 1.0/s | 2 | |
| GHOST | 4 | 50 | 12 | 75 | 45 | 2.0/s | 3 | |
| TROLL | 6 | 200 | 30 | 28 | 50 | 0.7/s | 5 | |
| GOLEM | 10 | 600 | 50 | 22 | 55 | 0.5/s | 20 | ✓ |

**Enemy FX:**
- `burning` — applied by IGNITE upgrades or fire wall. Fires every 1 s (`tickFx`).
  Fire wall also applies a 5 s burn DOT (refreshes each 333 ms contact tick).
- `slowed` — applied by Slow Wall. Reduces speed by `fac` (0.8 = 80% reduction) for 1.5 s; refreshes each frame while inside.

**Boss enemies** (`boss:true`) display their name above their head and have a larger glow radius.

---

## Design Decisions & Rationale

**Why multiplicative upgrades?**
Multiplicative stacking creates exponential power growth that feels rewarding at
high levels. Flat additions become meaningless quickly at scale; ×multipliers stay
proportionally impactful.

**Why no stack limit?**
With exponential growth, extreme stacking becomes self-limiting — a player who puts
10× SPLIT into Magic Missile now has ~57 rays but the Fireball offers more total
damage for fewer picks. Natural trade-offs emerge without hard caps.

**Why 333 ms fire wall ticks?**
Enemies cross the 12 px wall in ~200 ms at typical speeds. A 1 s tick misses fast
enemies entirely. 333 ms ensures at least 1 hit on a quick pass and meaningful
multi-hit on slow enemies.

**Why `BASE_Y = CH - 90`?**
In landscape mode the canvas is short. Placing the base too close to the bottom
clips it in the viewport and makes the bottom enemy zone hard to tap. 90 px margin
gives tap room and keeps the base visible.

**Why hold-to-cast walls (1 s threshold)?**
Walls are high-impact and permanent. The 1 s hold prevents accidental casts when
the player is tapping to fire rays, and gives a visual progress arc for feedback.

---

## Balance Observations (from playtesting)

- SPLIT is the strongest early upgrade — multiple rays hit multiple enemies per cast.
- IGNITE on Fireball stacks synergistically (base DOT 3/s amplified quickly).
- Force Field + REINFORCE creates a near-permanent wall early; breaks down mid-waves.
- Ghost is a pressure enemy — high speed, decent DPS, arrives wave 4 before players
  have many upgrades.
- Golem arrival at wave 10 acts as a soft difficulty wall. Most runs end or transform
  here (players who survive develop clear skill advantages).

---

## Potential Future Features

### Enemies
- **Shaman** — periodically heals nearby enemies; priority target
- **Wraith** — passes through force fields; countered only by ray spells
- **Siege Golem** — ignores fire wall damage; targets walls first

### Spells
- **Chain Lightning** (ray) — arcs to up to N nearby enemies
- **Frost Nova** (ray) — AOE slow at impact point
- **Arcane Barrier** (wall) — reflects projectiles, limited casts

### Upgrades
- **MULTICAST** — chance to fire twice per tap
- **CRITICAL** — chance to deal ×3 damage
- **HASTE** — reduce wall cast hold time

### Mechanics
- **Gold economy** — some enemies already drop gold; add a shop between waves
  where gold buys permanent stat boosts or consumables
- **Base upgrades** — spend gold to increase base max HP or repair base HP
- **Combo system** — hitting the same enemy with multiple spell types in a window
  multiplies damage briefly

### QoL
- Per-spell visual differentiation in the spell bar (show stat deltas from upgrades)
- Wave preview (show which enemies are in the next wave before it starts)
- Kill streaks with brief stat bonuses
