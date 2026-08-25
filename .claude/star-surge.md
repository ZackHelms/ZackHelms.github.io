# Star Surge (`games/star-surge/index.html`) — architecture notes

Vertical shmup: drag-steer (relative 1.2× finger delta, clamped vertically
to `[safeTop+55, H-safeBot-30]` — the ship can fly almost to the top of the
screen, not just the lower 65%, so short-range weapons (flame/EMP) can
actually reach shooters/spinners that hold high up), fires only while the
finger/mouse is down (`fireT` only decrements inside `if (drag)`; `onDown`
zeroes `fireT` so the first shot on a fresh press is instant — this is also
the game's core skill knob: tapping fast fires faster than holding
(cooldown-gated), while holding auto-fires at a steady pace, so the player
trades "stay put and tap" against "dodge and hold"). A **sector** is `MAX_STAGE` (5) stages, each with
its own mini-boss, capped by one extra, harder/longer **sector boss**.
`MAX_SECTOR` is `11`, difficulty-scaled by `campaignDifficulty()` (below) —
raised from the original single sector once the save/XP/weapon/armor
progression system (also below) existed to give matching power growth.
Numbers there are a first pass, not playtested end-to-end; expect balance
requests once someone's actually run all 11.

## Save / pilots (`starSurge.saves`, 3 slots)

The game opens on `showPilotSelect()` (`state='pilots'`) and picking a slot
goes **straight to that pilot's station** — there is no menu screen at all
(see § Routing). `saves` is a 3-element array (`null` or a character) loaded from
`localStorage['starSurge.saves']`. Picking an empty slot calls
`newCharacter(name)` and writes it; picking a filled one loads it into the
module-level `save` alias (`activeSlot` tracks which index). **Every run
reads/writes through `save`**, never through bare globals — there is no
"current progress" outside of a picked character. `persistSave()` writes
`saves[activeSlot] = save` back to localStorage; call it after any change
to `save.*` that should survive a reload (shipyard purchases, sector
checkpoint advances, best score, end-of-run XP).

Character shape (`newCharacter`): `{ name, xp, sector, best, weapons:
{blaster:1}, equippedWeapon:'blaster', armors:{}, equippedArmor:null,
hpTier:0 }`. `weapons`/`armors` are `id -> tier` maps — **presence is
ownership**, so `save.weapons[id] != null` is the owned-check everywhere
(shipyard rows, `weaponCooldown`, `fireWeapon`). `save.sector` is the
**only** checkpoint: dying always restarts stage 1 of `save.sector` (see
§ Checkpoint semantics) — there is no finer-grained mid-sector resume
point anymore, unlike the pre-progression-system version of this file.

Erasing a slot (`erasePilot(i)`) nulls one without touching the others —
slots are fully independent saves for experimenting with different
weapon/armor builds, per the feature's whole point. It is reached by
**holding** the bin under a bay for `DELETE_HOLD` seconds, not by a tap and
a `confirm()`; see § Title screen. `erasePilot` also clears `activeSlot` /
`save` when you erase the pilot you were flying — the very next paint reads
`saves[i].name` for the bay caption, so a dangling handle is a crash, not a
cosmetic bug.

## Checkpoint semantics

`save.sector` only ever advances in `bossDown()`'s sector-boss branch,
immediately after `persistSave()` — i.e. **only a fully-cleared sector**
(all `MAX_STAGE` mini-bosses *and* the sector boss) moves the checkpoint.
Dying anywhere in a sector — wave 1 or mid-sector-boss-fight — ends the run
via `endRun()` with **no** checkpoint write; `save.sector` still
points at that sector's start. `startGame(save.sector)` is therefore the
entire "continue" story: the end-screen's
`RETRY · SECTOR N` calls it. XP earned during a failed run is
NOT rolled back, though — `awardXp()` writes into `save.xp` immediately
(persisted at natural boundaries: stage clear, sector clear, `endRun`),
so a death costs run progress but never costs the character's build.

## Sector boss vs. mini-boss

`boss.sector` (`true`/`false`) is the single flag threaded through combat,
HUD, and music to distinguish them — there is no separate state variable.
- **Mini-boss** (`spawnBoss()`): `hp = miniBossHp()` = `26 + stage*14 +
  campaignDifficulty()*22`.
- **Sector boss** (`spawnSectorBoss()`): `hp = (26 + MAX_STAGE*14 +
  campaignDifficulty()*22) * 2.6` — 2.6× the toughest mini-boss *at that
  sector's difficulty*, both harder *and* longer by construction. Also
  fires a wider aimed spread (`arms=2` vs `1`), faster fire/ring cadence, a
  20-bullet finale ring under 15% hp, drifts faster, and renders as a
  14-spike shape with an inner ring (mini-boss: 8-spike, no ring).
- `bossDown()` branches on `boss.sector` first: sector-boss-down either
  ends the run in victory (`sector >= MAX_SECTOR`) or advances
  `sector++/stage=1` + `persistSave()`; mini-boss-down at `stage <
  MAX_STAGE` advances the stage as before, at `stage === MAX_STAGE` it
  sets `pendingSectorBoss` instead of ending the run. The wave director
  (`update`) checks `pendingSectorBoss` before `pendingStage` so the
  sector boss starts once the "STAGE `MAX_STAGE` CLEAR" banner fades —
  same fixed-pre-test pattern as `pendingStage`, don't reintroduce a
  `setTimeout` here either.

## Difficulty scaling across sectors

`campaignDifficulty()` = `(sector-1) + (stage-1)/MAX_STAGE` — `0` at
sector 1 stage 1, `+1` per full sector, so it's a smooth ramp inside a
sector (matches "starts easy, gets harder" per sector) layered under an
overall campaign trend. It feeds: `buildWave`'s enemy count (`n = 4 + st +
floor(diff*0.8)`), **each individual enemy's hp** (`enemyHp(type) =
round(ENEMY_DEFS[type].hp * (1 + diff*0.35))`, called from `spawnEnemy` —
`ENEMY_DEFS[type].hp` is the sector-1 base, not a static value used
directly), mini/sector-boss hp (above), shooter-enemy and boss bullet
speed, shooter fire-rate, and **incoming damage to the ship**
(`incomingBulletDmg()`/`incomingRamDmg()` = base 18/26 ×
`(1 + diff*0.12)`, so mistakes cost more as sectors climb). It does **not**
touch `STAGE_HUES` — enemy color still cycles by `stage` (1‑5) only,
repeating every sector, to avoid needing 55 colors. Sanity-checked
numerically (rough hp-vs-estimated-player-dps ratios at sector 1/6/11, a
headless Playwright timing check that a fresh tier-1 pilot needs several
seconds and multiple hits per enemy rather than an instant wipe, and the
formula-level regression gate below), not played end-to-end by a human
across all 11 sectors — treat the constants in
`miniBossHp`/`spawnSectorBoss`/`buildWave`/`enemyHp` as a tuning starting
point that will likely need a further pass once someone's actually played
it.

**Regression gate:** `.claude/tests/drive-star-surge.cjs` (36 checks) pins
every weapon's pip-vs-tier formula (fire rate is pip-invariant; discrete
weapon counts, bomb turret/radius alternation, beam/flame band/lobe counts,
chain jump count, EMP radius-only growth, and the missile min-turn-radius
floor all match their formulas exactly) plus the enemy-hp/incoming-damage
difficulty ramp and the graphics-style setting (cel/toon is the default, all
three styles paint every hull, the pick persists, the cog opens/closes) — run it
after touching any weapon or difficulty formula in this file's § Weapons or
this section, or any renderer branch in § Graphics styles, the same way as
the smoke gate (see `.claude/tests/README.md`).

## XP economy + Shipyard

`awardXp(n)` adds to both `save.xp` (spendable bank) and `runXpEarned`
(this-run counter shown on the end screen). Sources: `killEnemy()` uses
each enemy's `ENEMY_DEFS[type].xp` (2/4/5/10 for drone/shooter/spinner/
tanker); mini-boss down = flat 50; sector boss down = `150 + sector*25`.

`showShipyard()` (`state='shipyard'`, reached only from the station's
UPGRADES callout, and returning there) is a
scrollable list built from `WEAPON_DEFS`/`ARMOR_DEFS` + a hull row
(`hullRowHtml`), each row rendered by `weaponRowHtml`/`armorRowHtml`:
locked → `UNLOCK <cost>xp` button; owned & under `MAX_TIER` (5) →
`+TIER <cost>xp`; owned → an `EQUIP`/`UNEQUIP` button. Every purchase path
re-checks affordability before spending (the `disabled` attribute is only
a visual hint) and calls `persistSave()` then re-renders the same screen.
**Weapon is single-equip** (`save.equippedWeapon`, exactly one build at a
time — confirmed as the intended design, not multi-slot loadouts) and so
is **armor** (`save.equippedArmor`, nullable — armor can be unequipped
entirely, weapon cannot since `blaster` is always owned and free).

## Weapons

`WEAPON_DEFS[id]` carries `name/color/unlockCost/tierCost[]/desc`; ids:
`blaster` (free starter), `beam`, `flame`, `bombs`, `missiles`, `bolas`,
`chain`, `emp`. `save.weapons[id]` is the **permanent** XP-purchased tier
(1‑5) that scales a weapon's *quality* (dmg/dps/radius/turn-agility —
never count, never fire rate); the in-run `weapon` variable (1‑4, the
P-powerup pickup) is a **temporary** per-run *quantity/area* multiplier —
more barrels/beams/lobes/jumps, or (EMP only) a bigger blast radius —
layered on top of whichever weapon is equipped. Fire rate (`weaponCooldown()`)
is a flat per-weapon constant now, untouched by both axes — the player's
own tap-fast-vs-hold-steady cadence is the only thing that controls attack
speed, which is deliberate: a pickup that also sped up firing would erode
that skill knob. Same name (`weapon`/`tier`), two deliberately separate
axes: keeping them apart is what makes a P pickup feel like a real spike
instead of just compounding the permanent-tier numbers, and it's why
"in-stage power-ups don't feel special" was fixable without touching the
XP economy at all. Dispatch lives in `update()`'s player-fire block, keyed
on `save.equippedWeapon`:

- **blaster / missiles / bolas**: share `spreadOffsets(weapon, gap)`
  (centered offsets, one bullet per pip — pip 1 = single shot, pip 4 =
  four-way spread) in `fireWeapon()`; only the per-bullet `gap` differs per
  weapon. Permanent tier still sets `dmg`/`slowDur` per bullet, unchanged
  by pip.
- **bombs**: pip alternates between "more turrets" and a bigger blast via
  `BOMB_UPGRADES[weapon]` = `{count, radiusMul}` — `1:{1,1}` `2:{2,1}`
  `3:{2,1.35}` `4:{3,1.35}` (pip 2 adds a second bomb, pip 3 grows the
  blast 35%, pip 4 adds a third bomb) — `spreadOffsets(up.count, 20)` fires
  `up.count` bombs, each `radius: (55 + tier*10) * up.radiusMul`. Permanent
  tier still sets `dmg`/`splash` per bomb. The liked "firework" impact
  effect (`applyBulletHit`'s bombs branch) now layers three `boomAt` bursts
  — amber `#ffc300`, then orange `#ff5500` and red `#ff2200` "molten
  debris" — all three counts scaled by `b.radius/65` so a bigger blast
  (from a radius pip) throws visibly more debris, not just a bigger
  invisible hitbox.
- **beam** / **flame**: continuous, not cooldown-gated — `tickBeam`/
  `tickFlame` run every frame while `drag` is truthy and apply `dps*dt`
  directly (no `bullets` entries) — pip adds parallel instances, never
  touches dps. Beam: `beamOffsets()` (`spreadOffsets(weapon, 20)`) fires
  one parallel vertical band per pip, `damageInBeam(x, dps, dt, width)`
  takes an explicit x so each offset band can be checked independently
  (draw loop mirrors the same offsets). Flame: `FLAME_LOBES[weapon]`
  (1/2/3/4 angle offsets from straight up, `±0.32 rad` half-angle each) —
  pip 1 is one cone, pip 4 is four overlapping-but-distinct cones;
  `tickFlame` checks membership in *any* lobe so a target isn't double-hit
  if two lobes overlap it. Base range bumped `90→100` alongside the ship's
  wider vertical range (below) so it can actually reach high-holding
  enemies. Permanent tier scales `dps`/`range` only.
- **chain**: hitscan, no `bullets` entry — `fireChain()` runs on the
  normal cooldown, finds the nearest target within 520px of the ship, then
  up to `count = (weapon-1)*2` more within 140px of the *previous* hit
  (never re-hitting the same target), damage decaying ×0.75 per jump. Pip
  1 is **zero jumps** (a single hit, no chain at all); each pip after that
  adds two more jumps (so up to 1/3/5/7 total enemies hit at pip 1/2/3/4,
  capped by how many targets are actually in range) — the chain-lightning
  analog of "more turrets." Draws one `lightningBolts` entry (a point-path,
  faded over 0.25s) connecting every hit in order.
- **emp**: also hitscan-on-cooldown — `fireEmp()` damages everything
  within `radius` of the ship AND deletes every `ebullets` entry in that
  same radius (`ebullets.filter(... >= radius)`), the one weapon that's
  explicitly defensive utility over dps. Pip has no natural "count" analog
  for a single burst pulse, so it's the one weapon where the pip grows
  `radius` directly (`100 + tier*20 + (weapon-1)*18`) instead of a
  projectile/beam/lobe count — `dmg = 4 + tier*2` is a pure quality-tier
  stat now, untouched by pip. Pushes an `empPulses` ring (expands to
  `maxR` over 0.4s, fades over 0.5s).
- **missiles** also carry a **minimum turn radius** so they can't just
  loop back onto anything on screen: `MISSILE_MIN_TURN_RADIUS[tier]`
  (240/220/200/180/160px for tier 1‑5) caps the effective `turnRate` at
  fire time (`turnRate: Math.min(3 + tier*0.6, spd/minRadius)`) — higher
  permanent tier buys a tighter (smaller) floor, i.e. more agile homing,
  but every tier still has a hard floor so a missile fired away from a
  target can't reliably curl a full U-turn onto it. Previously the raw
  `3 + tier*0.6` turnRate implied only a ~72‑120px radius at typical
  missile speed (~432px/s) — tight enough that, combined with a fairly
  long on-screen flight time, missiles could home onto nearly anything on
  a 390px-wide screen regardless of aim ("fill the screen with missiles
  and eventually they hit something"). The floor is deliberately close to
  half the screen width so aiming still matters.

`applyBulletHit(b, target)` is the single collision-damage entry point for
every discrete-bullet weapon (blaster/bombs/missiles/bolas) — it replaced
the old inline `e.hp--`/`boss.hp--` so bomb splash and bola slow-on-hit
didn't need duplicating between the enemy-loop and boss-loop collision
checks that used to be separate.

## Graphics styles (settings ⚙)

A ⚙ button is the third control in the top-left chrome row (`←` `🔊` `⚙`,
at `left:10/56/102px`); it toggles `#settings-panel`, a small DOM panel
holding a `<select id="gfx-select">`. The choice lives in the module-level
`gfx` string, persisted to `localStorage['starSurge.gfx']`, validated
against `GFX_STYLES` on load (an unknown/absent value falls back to
`'toon'`). `closeSettings()` is called from `onDown`, so the first touch on
the canvas dismisses the panel rather than steering blind under it.

- **`toon`** (**default**) — cel/flat shading. Every hull is laid down in a
  base tone, banded on the lit side with one flat lighter tone, then inked
  with a dark outline (`INK`). No `shadowBlur` anywhere.
- **`neon`** — the original glowing wireframes, kept byte-for-byte in
  `drawShipNeon`/`drawEnemyNeon`/`drawBossNeon`.
- **`model`** — "3D MODELS": real low-poly meshes, flat-shaded per face,
  that **bank into their turns**. (Label renamed from "3D WEATHERED"
  2026-08-25 — the CD's "weathered" meant *texture*, which this style does
  not attempt; a future style may try real texture/normal maps. The stored
  id stays `model` so persisted picks survive.) See § The 3D model kit
  below.

**Every hull is painted through the three dispatchers** `paintShip(cold)` /
`paintEnemy(e)` / `paintBoss()` — the field, the pilot bays, the station
drydock, the title word bake and the dogfight all go through them, so a
style cannot drift between screens. Adding a style means adding an id to
`GFX_STYLES`, an `<option>`, and a branch in those three functions.
Everything that is NOT a hull (bullets, ebullets, powerups, chrome,
station scenery, effects) stays a `gfx === 'toon' ? A : B` binary on
purpose: `model` deliberately lands on the neon side of all of them
(weapons fire is emissive whatever the hull is made of), which is why
three styles did **not** force the repo's past-two-styles SKINS-table
refactor — the table is for styles that restyle everything, and this one
restyles only hulls. **A skin is paint:** no simulation code reads `gfx`,
so switching mid-run can never change an outcome. The `<select>` is wired
to its `change` event and deliberately *not* through `bindTap` — that
helper `preventDefault()`s `touchend` to stop iOS double-firing, which
also stops a native picker ever opening.

**The cel kit** follows the repo recipe in
`.claude/notes/20260823-canvas-skins-and-cel-shading.md` (written by the
neon-clash session that did this first) — read that before changing any of
it. What's specific here:
- `glow(col, blur)`/`noGlow()` wrap every `shadowColor`/`shadowBlur` pair in
  the shared draw paths. `glow()` is a **no-op under toon**, so one line
  kills every bloom and an effect written later in the neon idiom is right
  in both styles automatically. Don't reintroduce a `gfx` branch at a call
  site.
- `cel(base, lit, lw, cx, cy)` acts on the *current path* — fill, clip,
  step one flat shade, ink the outline. The current path survives
  `save()`/`clip()`/`restore()` (it is not part of the canvas drawing
  state), which is why the outline strokes after the clipped band without
  rebuilding the path.
- **Each part is lit about its own centre.** `celPoly` derives `(cx, cy)`
  as the centroid of its own points, and `celCircle`/`celEllipse` translate
  first, so an offset part (wing, nacelle, engine block, blade) is sculpted
  rather than falling wholly inside or wholly outside one wedge. An earlier
  pass here shaded every part about the sprite origin and each wing came out
  uniformly lit or uniformly dark — flat.
- **`frameRot()` keeps the sun fixed in screen space.** The spinner draws
  inside `ctx.rotate(e.ang)` and the boss's gun-barrel rim inside its own
  rotation; `cel()` reads the live transform back (`atan2(m.b, m.a)`) and
  counter-rotates the shade wedge out of it. Without this the sprite drags
  its shading round as it spins. The drive suite measures this directly
  (brightest bearing on a ring inside the spinner's dome must not move as
  `e.ang` does — 0° spread with the fix, ~170° without).
- Line-like art (chain bolts, EMP rings) has no interior to clip a shade
  into, so it gets `inkStroke(w)` — the same path stroked fatter in ink
  underneath — instead of `cel()`.

**The hulls** (`drawShipToon`, `drawEnemyToon`, `drawBossToon`) — each is
meant to be nameable at a glance at ~24 px: player = steel interceptor with
a cyan canopy, green swept wings and twin exhausts; drone = bladed scout
pod with a red eye; shooter = arrowhead gunship with two underslung
barrels, pointing *down* at the player; spinner = four-blade rotorcraft
(keeps `e.ang`); tanker = armoured freighter with three rear engine blocks;
boss = a solid inked hull with a bridge dome (gold + heavier pods for a
sector boss) under a rotating rim of gun barrels, which preserves the neon
version's spinning-spikes silhouette. Enemy tones all derive from the same
stage `hue()` as before, so `STAGE_HUES` still recolors every sector.

### The 3D model kit (`model`, 2026-08-25)

Real low-poly meshes rendered with Canvas 2D — no WebGL. A mesh is
`{ p, v, f, nose }`: `p` a palette of `{h,s,l}` face colours (`hue:1` swaps
h for the live stage hue via `hueDegNow()`, so stage identity and the title
wash keep working; `e:1` marks an emissive part — full-bright, unweathered,
unstroked), `v` a flat vertex array in sprite-local units (player in px,
enemies in units of `e.r`, boss in `boss.r`), `f` faces as
`[palIdx, v0, v1, ...]`, and `nose` which way the hull points along its own
y (−1 player, +1 everything that dives). Meshes: `MESH_SHIP`,
`MESH_ENEMY.{drone,shooter,spinner,tanker}`, `MESH_BOSS_M/S` +
`MESH_RIM_M/S` (the gun rim is its own mesh so only it spins).

- **`drawMeshTop(mesh, scale, bank, spin, seed)`** is the top-view
  (gameplay) painter: spin about z, bank about y, orthographic project,
  painter-sort faces by mean depth, two-sided normals flipped to face the
  camera. **A flipped face is an underside and undersides are in shadow**
  (`lum *= 0.45`).
- **Shading is a metal's, on a HIGH ambient floor**: `mFaceCol` runs lum
  through `0.52 + 0.75·lum^1.35` with a hot specular pop past 0.93. The
  first cut floored at 0.30 and the CD's verdict was "too dark — the 3D
  and the banking don't pop": on a phone over a near-black field, a face
  at 30% of base vanishes, and with it the banking it was showing. Then
  per-face variation off `hash32(seed*131 + faceIndex)` — **a tint, not a
  darkening**: a narrow grime band (0.90–1.12) and the odd plate re-hued
  toward rust at full brightness (never a `hue:1` face: identity colour is
  not the grime's to corrode). Every non-emissive face also gets a thin
  dark panel-gap stroke, which is most of what reads as riveted plating.
- **Banking is DERIVED, off-entity.** `visBank(o, x, max)` measures the
  entity's own lateral speed between paints (`frameDt` is written at the
  top of `update()`), smooths toward a clamped target, and stores its
  state in the module `VIS` **WeakMap** — never on the entity, so the sim
  objects stay byte-identical across styles (the suite asserts both the
  90-frame sim snapshot and the object keys). A >2600 px/s jump is treated
  as a respawn/resize, not a turn. Who banks is per-hull: the player
  (max 0.85 rad) and the swaying drone bank; shooter/tanker fly straight so
  their measured lateral speed keeps them level for free; the spinner spins
  (`e.ang`) instead; bosses stay flat with only the rim turning.
- **The title dogfight skips the billboard entirely** (`dfDrawShipModel`,
  dispatched at the top of `dfDrawShip`): the sim is already fully 3D, so
  the mesh is oriented along its velocity (orthonormal frame + the same
  `s.roll`), and projected vertex-by-vertex through the same `DF_FL`
  divide. The flat-sprite degeneracies (foreshortening floor, kept-last
  screen direction) don't exist here — nose-on is just the model's nose.
  `DF_LIGHT` is `M_LIGHT` with z negated (dogfight −z faces the camera).
- Perf: measured 16.7 ms median on the title screen and on a saturated
  16-enemy + boss combat scene (frame-budget.cjs, 2026-08-25) — same as
  toon/neon.

**HUD note:** the left HUD block (`SECTOR/STAGE`, hp bar, hp label) starts
at `safeTop+48`, *below* the chrome row, and the boss hp bar sits at
`safeTop+84`. Before the ⚙ existed the block started at `x=56, safeTop+14`
and the first word was already drawn underneath the mute button; a third
38 px button made that unfixable sideways (the stage line is ~150 px wide
and the score is right-aligned), so the block moved down instead. Don't
move it back up without re-checking against all three buttons.

## Title screen (2026-08-24)

`state='pilots'` is drawn on the **canvas**, not the overlay. `showPilotSelect()`
now only empties and hides `#overlay`; `drawTitleScene()` paints the whole
screen and `pilotsDown/pilotsMove/onUp` handle its input. There is no help
text anywhere on it: a bay either holds a ship or shows a plus, and the bin
under a bay fills a ring while you hold it.

Three layers around **one plane**. Everything in the dogfight carries a `z`,
the UI sits at `DF_ZUI`, and `drawTitleScene` paints
`dfDrawLayer(false)` → word → bays → `dfDrawLayer(true)`. That single split is
the whole reason a fighter can dive between the camera and the logo: it is in
front because it is nearer, and it drops behind the moment it pulls away. No
special case, no z-index.

### The word is a swarm

`GLYPHS` is a 5×9 bitmap font (rows 0–6 cap height, 2–6 x-height, 7–8
descender) and every lit cell is one enemy hull painted by the game's own
`drawEnemyToon`/`drawEnemyNeon`. The case is the point — **Star Surge**, not
STAR SURGE — so the lowercase glyphs really are short and `g` really does hang
below the baseline. Which hull lands in which cell comes from `hash32` of
(line, char, row, col), so the formation is identical every time it is rebuilt;
a resize or a style switch must not reshuffle it.

`TITLE_R` is a **per-type** radius fraction. One shared radius does not work:
a drone is a small pod with long blades and a tanker is a solid block, so at
equal `r` they cover wildly different areas and the letters come out blotchy.
The values are tuned so all four fill about 1.3 cells — enough overlap that a
stroke reads solid, not enough to close a counter. The brand-green wash is laid
`source-atop` at the end: the enemy palette is a *stage* colour, three shades
too dark to spell a logo with, and a wash lifts every hull in one pass while
leaving the ink outlines doing their job.

The word is **baked once** into an offscreen bitmap (`buildTitleWord`, cached on
`gfx|u|dpr`). `ctx` is a `let` for exactly this: the bake swaps the module
context for the offscreen one and back, so there is one set of art. Repainting
~120 cel-shaded hulls per frame — each several `clip()`s deep, each carrying a
glow in the neon style — took the neon title screen's median frame from 16.7 ms
to 33.3 ms, to animate a per-hull wobble of about one pixel. The whole word
drifts as one instead.

### The dogfight is generated, not scripted

`dfUpdate` is a steering model: seek the nearest hull of the other side (with
0.5 s of lead), **flip the sign inside a break-off radius** so nobody welds to
a tail, plus three incommensurate sinusoids per ship for wander. Acceleration
only *turns* — `v` is rescaled to a fixed `cruise` every frame — which is what
keeps the fight readable instead of a slingshot.

Containment is a **spring measured in screen space** and divided back through
the projection (`/kk`), because the arena has a fixed size in *pixels*: a
world-space box would be a postage stamp at the far plane and the size of a
room at the near one. The outer gain *rises* with the overshoot; a flat one
loses, because pursuit (760) plus wander (520) beat a constant 5× pull at about
0.6 W. Depth gets the same treatment plus a spring toward `DF_ZMID`, without
which the fight drifts out to the far plane and plays as specks behind the
logo — the wall at `DF_ZMAX` stops it leaving, it never brings it back.
Underneath all of that are **hard walls**, so "a hull never leaves the arena"
is an invariant and not a probability; the springs do all the flying and the
clamps only catch the ~1-in-10 000 sample that leaks.

Guns: the nose cone (`dot > 0.92`) decides **whether** to shoot, and the lead
vector decides **where** the tracer goes. Firing down the nose is what a real
gun does and it is also why nothing ever died — a 23° gate is a 300-unit miss
at typical range, and a minute of flight produced 98 shots and zero kills. With
lead-aim it settles at 4–8 kills a minute, which is what makes the screen feel
like a fight.

### The 3D read, from one flat top-down sprite

`dfDir()` is the local Jacobian of the perspective divide: the screen image of
a world *direction* at a point. A direction pointing away from the camera
projects short, so a sprite scaled along it foreshortens exactly as a real hull
would. `dfDrawShip` builds a billboard whose long axis follows the projected
velocity (`s.sd`) and whose length is scaled by that foreshortening (`s.fs`),
with `cos(roll)` banking the wings — so "flying away" is a short hull pointing
off-centre and "flying across" is a full-length hull lying sideways.

`s.fs` has a **floor**. A perfectly nose-on plate has zero area, and a hull that
blinks out at the exact moment it lines up with the camera reads as a bug, not
as physics. `s.sd` is likewise *kept* rather than reset when a ship heads
straight at the lens, because at that instant it has no screen direction at all.

Everything is projected once, in `dfUpdate`, and cached on the ship (`k`, `sx`,
`sy`, `sd`, `fs`) so the painters stay pure.

### Bays

`pilotsLayout()` derives three squares and their bins from `W`/`H` — one
function, used by both the painter and the hit-tester, because two copies of
the geometry is how a button stops matching the thing it draws. Erasing is
**hold, not tap**: a pilot is the only thing on this screen that cannot be
undone, and there is no `confirm()` left to catch a misfire. The gesture teaches
itself, because a stray tap starts the ring and then visibly drains it back.

## Routing (2026-08-23)

```
pilots ──pick──▶ station ──UPGRADES──▶ shipyard ──BACK──▶ station
                    │  ▲                                     
                    │  └──────── report ◀── play ◀──COMBAT───┘
                    └──REST──▶ pilots        (tap ▶ launch ▶ station)
                       play ──died──▶ over ──▶ RETRY (play) | PILOTS
```

**There is no menu screen.** `showMenu()` is gone, and with it `NEW RUN` and
the standalone `SHIPYARD` button. The station is the single hub: everything
leaves from it and comes back to it, which is what puts the shipyard in
front of a new player before their first fight rather than behind a button
they have no reason to press.

`endRun()` is now only reachable by **dying** — a cleared sector routes to
the combat report, and clearing the last sector reports too, so there is no
"win" end screen and no `victory` state.

### A run survives being put down

REST is a real save point. `snapshotRun()` writes
`save.run = {score, xp, cr, weapon, hp, shields}` and runs at every station
arrival (`enterStation()`), after a repair, and on REST — the station being
the only point where the player is idle *and* safe. `restoreRun()` reads it
back on pilot select; `save.run === null` means the last run **ended**, and
only `endRun()` sets that. That asymmetry is the whole design: resting
resumes, dying does not, so "resume" can never become "undo my death".

Because the snapshot is taken at the station and not cleared on launch,
closing the tab mid-sector rewinds you to that station with your score
intact. That is deliberate leniency, not an oversight — the alternative
punishes a dropped connection exactly like a death.

`save.campaignDone` persists the "cleared sector 11" flag, because
`save.sector === MAX_SECTOR` alone cannot distinguish *reached* the last
sector from *beat* it — the COMBAT button reads `SECTOR 11 AGAIN` only for
the latter.

## Sector report + allied station (2026-08-23)

Clearing a sector used to set a `SECTOR n CLEAR` banner and roll on. It now
stops: **report → tap → launch → crossfade → station**, four states
(`report`, `launch`, `station` join `play`/`menu`/`shipyard`/…). The point is
pacing — eleven sectors that run together read as one endless corridor — and
onboarding: the station is the only place the player is idle *and* safe, so
it is the right place to put the shipyard in front of someone who has never
opened it. `UPGRADES` is wired by a drawn line to a garage they can see.

### The run continues through the station

`COMBAT` calls `resumeIntoSector()`, **not** `startGame()`. Score, XP,
credits, the weapon pip and the hull all carry; only the per-sector counters
reset. Reaching for `startGame()` here is the easy refactor that silently
zeroes a player's score mid-campaign, which is why the drive suite pins it.
One deliberate exception: hull plating bought at the station is added to
current hp on the way out, so a tier you just paid for is hp you fly with.

### Two currencies, deliberately unconvertible

| | earns | spends on |
|---|---|---|
| **XP** | kills, bosses | permanent build — weapons, armor, hull tiers (shipyard) |
| **CREDITS** | the same kills (`pts / CREDIT_DIVISOR`), bosses | hull repair at the station |

Both drop from the same kills, so the live choice is "bank the salvage or fly
the next sector dented", never "grind one into the other". Repair is priced
per hp (`CREDITS_PER_HP`) and **buys as much as the balance covers** rather
than being all-or-nothing, so a thin wallet still gets a patch. A sector nets
roughly 600–700 CR against a ~300 CR full repair: affordable, not free.
`loadSaves()` back-fills `credits: 0` on pilots saved before the currency
existed — without it every repair quote reads `NaN CR`.

### Per-sector stats

`sec` (`newSectorStats()`) counts kills, shots fired/hit, hits taken, shields
burned, best streak, XP, credits, score and elapsed time. **Nothing in the
simulation reads a counter** — they are report-only, so they cannot change an
outcome. Two subtleties worth keeping:

- **Accuracy is per PROJECTILE**, counted at the one `fireWeapon()` call site
  in `update()` (a pip-4 spread is four shots), and per connect in
  `applyBulletHit()` — which runs exactly once per bullet before it is
  spliced. That makes accuracy measure aim, and makes spread weapons honestly
  wasteful.
- **Beam/flame/chain/emp spawn no projectiles at all.** They leave
  `shotsFired` at 0, so the report swaps the ACCURACY row for the weapon name
  and `gradeFor()` drops the accuracy term and re-normalises the rest.
  Without that, every projectile-less build is graded as if it missed
  everything and can never exceed B.
- A burnt shield is counted but does **not** break the streak — no damage was
  taken, and rewarding the shield build is the point of running it.

### Station scene

`stationLayout()` derives every feature and every button from `W`/`H`, so the
callout lines can never drift from the art they point at, in any viewport.
`R` (hub radius) is capped at `W*0.20` because the solar array reaches
`cx ± R*1.78` — go wider and the hangar and drydock clip off the edges (they
did, on the first pass). **Left-column buttons point at left-hand features
and right at right-hand ones**, on two parallel lanes per side: that pairing
is the entire reason no line crosses the station or another line, and it is
asserted rather than eyeballed.

All three styles share one geometry through `sPanel`/`sDisc`/`sRing`/`sStrut` —
toon lays a flat plate with an ink outline, neon strokes the same outline as
a glowing wireframe over a dark fill, and model (added 2026-08-25, after the
CD flagged that the station still read as neon under it) fills the same
shapes as **lit metal**: a linear gradient running away from the 3D kit's
upper-left lamp on every plate, a radial gradient turning every disc into a
dome, plus a shaded planet limb and a molten hostile-sector orb in place of
the neon rings. Windows, callouts and buttons stay emissive in every style —
a lit thing is lit whatever the hull is made of, the same rule the ships
follow. A structural difference would deserve a
separate routine (see the shared cel-shading note); the station is scenery,
so a treatment swap is right and keeps the silhouette single-source. The
docked ship goes through `paintShip(true)` — the `cold` flag
suppresses the exhaust: a parked ship still burning its engines is the tell
that a station is a menu rather than a place.

**Station frame cost** (frame-budget.cjs, 2026-08-25): toon 16.7 ms clean;
model 16.7 median with 22/149 frames over (the gradients are fine); **neon
33.3 median — a hard 30fps, pre-existing** and unrelated to the model pass
(its per-frame `shadowBlur` strokes are the likely cost). It is a static
menu screen so nothing stutters visibly, but if the neon station is ever
touched, measure before and after.

### Things that bit

- **`enterStation()` must only crossfade on ARRIVAL.** Bound as the
  shipyard's return path it replayed the veil every time, and since
  `stationTap()` ignores input while the veil is up, a returning player found
  a dead screen for ~0.3 s. Caught by driving the flow, not by reading it.
- **The play HUD draws under the report** (the report sits over a frozen play
  scene). Left up, it captioned the sector-3 report `SECTOR 4 · STAGE 1 · W1`.
  The HUD block is now `state === 'play'` only.
- **The overlay tap is bound ONCE**, at init, scoped by a `state === 'report'`
  check. `#overlay` is a persistent element, so binding inside the report
  builder would stack one handler per sector cleared. The state check doubles
  as the debounce — `beginLaunch()` moves the state on, so the trailing click
  after a touchend is a no-op — and a >14 px finger travel is treated as a
  scroll rather than a dock.

## Armor + HP

Ship no longer has lives — `ship.hp`/`ship.maxHp` (`shipMaxHp(tier) = 100 +
tier*20`, tier from `save.hpTier`, 0‑5). `hitShip(dmg)` takes an explicit
damage amount now (enemy bullet = 18, ram = 26) instead of always costing
one life. Order of checks in `hitShip`: invuln window → `shieldCharges`
(any source) → `plating` reduction → hp loss → death. **Only one armor
equipped at a time** (`save.equippedArmor`, nullable), same single-build
philosophy as weapons:

- **plating**: flat reduction, `dmg *= 1 - tier*0.08` (up to 40% at tier 5)
  — the only armor with no extra state, just a multiplier in `hitShip`.
- **shield**: `ship.shieldCharges` (shared counter — the old one-shot `S`
  powerup pickup ALSO just increments this, regardless of equipped armor)
  recharges toward `tier` max charges via `ship.shieldRegenT` counting
  down (`max(3, 10-tier)` seconds per charge) in `update()`. A charge
  fully blocks one hit (no hp loss at all) before hp is ever touched.
- **regen**: heals `(1 + tier*1.5)*dt` hp/sec once `ship.lastHitT > 3`
  (reset to 0 on every hit in `hitShip`) — passive sustain, not a burst.

## Music

20 hand-composed **webaudio-score/v1** tracks (see zmhstudio's `zmh-synth`
score-authoring skill) drive an adaptive soundtrack: `MUSIC_TRACKS[]` holds
the score data, a pure `compileScore()` turns each into a flat time-sorted
note-event list, and a two-slot crossfading look-ahead scheduler
(`scheduleMusic`, 25 ms tick, ~0.35 s horizon) plays them through ~20
synthesized instrument recipes (`playKick`/`playAcidBass`/`playWobbleBass`/
etc. — percussion is a shared seeded-noise buffer sliced through per-voice
filter chains, melodic voices are live oscillator+filter+ADSR). `NN ·
TITLE` now-playing label lives in `#track-label` (a persistent DOM element,
not canvas-drawn, so it survives under every overlay screen).

`selectTrackId()` is a **pure function of game state** — no randomness —
and one track plays for a **whole stage** (every wave *and* that stage's
own mini-boss), not per-wave: `STAGE_BGM_IDS` (14: 4 calm/patrol + 10
combat) is indexed by `(sector-1)*MAX_STAGE + (stage-1)`, round-robining
continuously across sectors rather than resetting each one, so a longer
campaign keeps surfacing different tracks. Only `boss.sector` (the sector
boss, not the mini-boss) switches to `SECTOR_BOSS_TRACK_IDS` (5, dubstep/
hard-techno), indexed by `sector-1` — also round-robin, not reset.
Non-`'play'` state (pilots, station, shipyard, report, launch, over) → the
ambient menu track — which is why the station gets calm drift music for
free. This is also *not* enemies-on-screen-driven — see the code
comment history: that heuristic thrashed the crossfade every time
`spawnQueue` briefly drained between bursts. Stage-boundary switching
instead lines the 1 s crossfade up with the existing `stageBanner` display,
so the handoff reads as intentional. Sub-track sequences reference bar-pattern names;
percussion patterns are `x`/`X`/`.` per step, melodic patterns are
space-separated note/`+`chord/`-`tie/`.`rest tokens — see the skill doc for
the full grammar before hand-editing a track's `patterns`/`sequence`.

To refine a track (change its genre/key/instrumentation) don't hand-edit
raw pattern strings — use `.claude/scripts/star-surge-music/` (procedural
drum-grid + scale-walk generator, seeded, validated against the same
`compileScore` before output; see that folder's README) and re-embed the
regenerated track's JSON.

## Wave director

- `buildWave(stage, wave)` returns a deterministic spawn script
  `[{t, type, xf}]` (counts scale with stage and `campaignDifficulty()`;
  xf = x as width fraction). `update` drains it against `waveT`.
- Director rule: when no boss, queue empty, enemies cleared, and no banner
  showing → advance (`wave++`, wave 4 = `spawnBoss()`), unless
  `pendingSectorBoss`/`pendingStage` says otherwise (see § Sector boss).
- **Trap fixed pre-test:** the next stage/sector must start via a
  `pending*` flag (director resets state once the CLEAR banner fades),
  never a `setTimeout` — that raced the director before (double-spawned or
  skipped content).

## Entities

- Enemies (`ENEMY_DEFS` hp/r/pts/xp): **drone** (sine drift, ram only),
  **shooter** (descends to a hold-Y, aimed shots), **spinner** (crosses
  horizontally, rotating 4-way ring), **tanker** (slow, 6 hp, always drops
  a powerup). Enemy color = `STAGE_HUES[stage-1]` (green→blue→purple→gold→red,
  repeats every sector). Every enemy carries `slowT` (bolas debuff, 0 by
  default) checked in the movement/fire-rate loop regardless of whether
  bolas is even the equipped weapon this run.
- Mini-boss/sector-boss: see § Sector boss vs. mini-boss and § Difficulty
  scaling above.
- Powerups (11% drop, tanker 100%): **P** in-run weapon tier +1 (max 4,
  works with any equipped weapon — see § Weapons; ship hit drops a tier),
  **S** +1 `shieldCharges` (stacks with the `shield` armor's own regen,
  same counter), **G** SURGE (clears all enemy bullets, 3 dmg to all
  enemies, 4 to boss).
- `EBULLET_CAP` 90 bounds the bullet storm (readability + perf); `eShoot`
  and ring spawns respect it.

## Test hooks (headless)

`update(dt)` is directly callable. Top-level state: `state, sector, stage,
wave, weapon, score, runXpEarned, ship (hp/maxHp/shieldCharges/lastHitT),
bullets, ebullets, enemies (slowT), boss, powerups, lightningBolts,
empPulses, spawnQueue, pendingStage, pendingSectorBoss, saves, activeSlot,
save`, plus `startGame(sector)`, `spawnEnemy(type,x,y)`, `spawnBoss()`,
`spawnSectorBoss()`, `awardXp(n)`, `persistSave()`. Steering = TouchEvent
drag on `#cv`. A driven test must pick a pilot first (`showPilotSelect()`
is the boot state) before any station/shipyard/run function is reachable —
`saves[i] = newCharacter(...); activeSlot = i; save = saves[i];` is the
minimum to skip straight past it. Assert persisted progress against
`JSON.parse(localStorage['starSurge.saves'])[slot]`, not a bare key — the
old single-character `starSurge.stage`/`starSurge.best`/
`starSurge.sectorBossReady` keys are gone.

## Lessons learned (2026-08-22 build session)

Distilled from the session that took Star Surge from a 5-stage arcade
shooter to the sector/pilot/progression game described above, for whoever
touches this file next.

- **Never ship harder content ahead of the power-growth that's meant to
  offset it.** `MAX_SECTOR` was deliberately held at `1` for a full session
  turn (structural sector/mini-boss/sector-boss code shipped, but no
  *additional* sectors) until the XP/weapon/armor system existed to give
  the player something to spend on. Raising sector count first would have
  made the later sectors literally unbeatable against a fixed weapon-tier
  ceiling. If a future ask is "add more sectors/waves/enemy types," check
  whether the player's power curve can actually track it *before* touching
  the difficulty knobs — don't assume balance will sort itself out.
- **Balance numbers here are a first pass, not a spec.** `miniBossHp`,
  `spawnSectorBoss`'s ×2.6, `campaignDifficulty()`'s coefficients, and
  every weapon's `dmg`/cooldown formula were sized by rough hp-vs-estimated-
  dps arithmetic, not by playing all 11 sectors. Treat the *shape* (harder
  sectors, sector boss > mini-boss, XP funds power) as the durable part and
  the *constants* as disposable — a user report of "sector 6 is a wall" or
  "chain lightning does nothing to bosses" should freely override them
  without needing to justify why the old number was wrong.
- **Checkpoint granularity was tried finer, then deliberately simplified —
  don't re-add the finer version without a new explicit request.** An
  earlier pass in this same session persisted a mid-sector checkpoint
  (`starSurge.sectorBossReady` + `startGame(stage, atSectorBoss)`, letting
  CONTINUE resume exactly at a pending sector-boss fight). Once the user
  clarified failure should mean "restart the *current sector* from stage
  1," that whole mechanism was removed in favor of one `save.sector` int —
  simpler, and it directly matches the answered design question. If sector
  boss checkpointing seems desirable again later, that's a new decision to
  confirm, not a bug to fix.
- **Single-equip weapon *and* armor (one build at a time, no multi-slot
  loadouts) is a confirmed answer, not a placeholder.** It came from an
  explicit `AskUserQuestion` ("single build weapon" over multi-slot or
  base+support) precisely because it changes how much combat code exists
  per weapon. Don't refactor toward multiple simultaneous weapons/armors
  without checking first — it's a deliberate build-identity choice, and it
  roughly doubles the collision/rendering surface per weapon if reversed.
- **Adaptive music needs a coarse switching granularity, and the natural
  trigger is rarely the intuitive one.** Two heuristics were tried and
  rejected before landing on "one track per whole stage": per-wave
  switching (too fast to judge a track, the original complaint) and
  enemies-on-screen-driven switching (thrashed the crossfade every time
  `spawnQueue` briefly drained between spawn bursts — sounds obviously
  reactive but is actually noisy). The fix that stuck was tying the switch
  to a boundary that's already a deliberate pause in the game (the
  stage-clear `stageBanner`), so the 1 s crossfade has somewhere calm to
  land. If a future track-selection change is requested, look for an
  existing "beat" in the game flow to hang it on before inventing a new
  one.
- **Testing technique that paid off: drive the game via direct
  `page.evaluate()` state mutation, not simulated real-time play.** Calling
  `spawnBoss(); bossDown();` or setting `sector = 5; stage = 4;` directly
  from a headless-Chromium script reached deep game states (sector-boss
  transitions, checkpoint persistence, every weapon's collision path) in
  milliseconds instead of playing through minutes of real combat. Combined
  with a real (unmocked) `AudioContext` in headless Chromium, this was
  enough to prove the whole music engine schedules and crossfades for
  several in-game minutes with zero console errors — no need to mock
  WebAudio for an integration-level check like that; save mocking
  (`mock-run.cjs`-style, a fake `AC` object) for pure-logic unit checks
  like the score compiler, where you want to assert on the exact node
  graph built rather than "did it throw."
- **"In-run power-up doesn't feel special" was a symptom of enemies being
  paper-thin, not of the power-up itself.** The 2026-08-22 balance pass
  (drone/shooter/spinner/tanker hp roughly doubled at sector 1 and scaled
  further by `campaignDifficulty()`, ship's vertical range widened to
  reach high-holding enemies) came from realizing every enemy died in 1-2
  hits even at the *lowest* weapon tier, so a P pickup's only visible
  effect was making an already-instant kill marginally faster. The actual
  fix was two-pronged: make baseline combat take real hits-to-kill (enemy
  hp), *then* make the pickup change something qualitatively different
  (projectile/beam/lobe/jump **count**, not just more dps) so picking one
  up reads as a build change, not a dps tick. A future "X doesn't feel
  impactful" complaint is often the neighboring system being too weak/too
  strong, not the thing itself.
- **Author data-heavy content offline, validate, then hand-embed — don't
  write large generated blobs by hand or trust them unvalidated.** All 20
  music tracks were built by a throwaway Node generator
  (`.claude/scripts/star-surge-music/gen.cjs`) that runs every track
  through the same `compileScore`/`validateScore` the game uses, catching
  malformed patterns before they ever reached the shipped file. That
  generator is kept (not deleted after use) specifically so a future "redo
  track N" request has a starting point instead of hand-editing pattern
  strings from scratch.
- **A pickup that changes fire rate competes with a player-driven skill
  knob — don't let it.** The first balance pass (above) gave the pip an
  `atkSpeedMul()` that sped up cooldowns, which quietly worked against the
  tap-fast-vs-hold-steady mechanic (the whole point of which is that
  *player input*, not a pickup, controls attack speed). The very next
  request removed it: `weaponCooldown()` is now a flat per-weapon constant,
  and every pip effect is purely quantity/area (bullet/beam/lobe/jump
  count, or EMP's radius). When a pickup and an existing player-skill
  mechanic both want to control the same stat, the mechanic wins — cut the
  pickup's claim on it instead of trying to balance the two together.
- **A generous "auto-aim" stat needs an explicit floor, not just a
  tier-scaled coefficient.** Missile `turnRate` used to be a flat
  `3 + tier*0.6` with no cap — small enough per-frame that it looked
  reasonable, but combined with a multi-second on-screen flight time it
  implied only a ~72‑120px turning radius, letting missiles home onto
  nearly any target on a 390px-wide screen regardless of where they were
  aimed ("fill the screen with missiles and eventually they hit
  something"). The fix wasn't lowering the coefficient (that just delays
  the same problem) but converting it to a radius-based floor
  (`MISSILE_MIN_TURN_RADIUS[tier]`, ~half the screen width) and deriving
  the actual per-fire `turnRate` from `spd/minRadius` — a floor on the
  *geometry* the stat implies, not just a number that felt small enough in
  isolation. Any future homing/auto-aim stat should be sanity-checked the
  same way: what real-world radius/cone/duration does this coefficient
  imply at the actual speeds/lifetimes in play?
