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

The game opens on `showPilotSelect()` (`state='pilots'`), not the title
menu — `saves` is a 3-element array (`null` or a character) loaded from
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

Pilot-select's reset button (`↺`, `confirm()`-gated) nulls one slot without
touching the others — slots are fully independent saves for experimenting
with different weapon/armor builds, per the feature's whole point.

## Checkpoint semantics

`save.sector` only ever advances in `bossDown()`'s sector-boss branch,
immediately after `persistSave()` — i.e. **only a fully-cleared sector**
(all `MAX_STAGE` mini-bosses *and* the sector boss) moves the checkpoint.
Dying anywhere in a sector — wave 1 or mid-sector-boss-fight — ends the run
via `endRun(false)` with **no** checkpoint write; `save.sector` still
points at that sector's start. `startGame(save.sector)` is therefore the
entire "continue" story: menu's `NEW RUN · SECTOR N` and end-screen's
`RETRY · SECTOR N` both just call it. XP earned during a failed run is
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
repeating every sector, to avoid needing 55 colors. Only sanity-checked
numerically (rough hp-vs-estimated-player-dps ratios at sector 1/6/11 plus
a headless Playwright timing check that a fresh tier-1 pilot needs several
seconds and multiple hits per enemy, not an instant wipe), not played
end-to-end by a human across all 11 sectors — treat the constants in
`miniBossHp`/`spawnSectorBoss`/`buildWave`/`enemyHp` as a tuning starting
point that will likely need a further pass once someone's actually played
it.

## XP economy + Shipyard

`awardXp(n)` adds to both `save.xp` (spendable bank) and `runXpEarned`
(this-run counter shown on the end screen). Sources: `killEnemy()` uses
each enemy's `ENEMY_DEFS[type].xp` (2/4/5/10 for drone/shooter/spinner/
tanker); mini-boss down = flat 50; sector boss down = `150 + sector*25`.

`showShipyard()` (`state='shipyard'`, reached from the main menu) is a
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
(1‑5) that scales a weapon's *quality* (dmg/dps/radius/turnRate — never
count); the in-run `weapon` variable (1‑4, the P-powerup pickup) is a
**temporary** per-run *quantity + speed* multiplier — more barrels/beams/
lobes/jumps, and faster cooldowns via `atkSpeedMul()` — layered on top of
whichever weapon is equipped. Same name (`weapon`/`tier`), two deliberately
separate axes: keeping them apart is what makes a P pickup feel like a
real spike instead of just compounding the permanent-tier numbers, and
it's why "in-stage power-ups don't feel special" was fixable without
touching the XP economy at all. Dispatch lives in `update()`'s player-fire
block, keyed on `save.equippedWeapon`:

- **blaster / bombs / missiles / bolas**: all four discrete-bullet weapons
  share `spreadOffsets(weapon, gap)` (centered offsets, one bullet per
  pip — pip 1 = single shot, pip 4 = four-way spread) in `fireWeapon()`;
  only the per-bullet `gap` differs per weapon. Permanent tier still sets
  `dmg`/`radius`/`splash`/`turnRate` per bullet, unchanged by pip.
- **beam** / **flame**: continuous, not cooldown-gated — `tickBeam`/
  `tickFlame` run every frame while `drag` is truthy and apply `dps*dt`
  directly (no `bullets` entries), so their "attack speed" *is* their pip
  effect already covered — instead pip adds parallel instances. Beam:
  `beamOffsets()` (`spreadOffsets(weapon, 20)`) fires one parallel
  vertical band per pip, `damageInBeam(x, dps, dt, width)` now takes an
  explicit x so each offset band can be checked independently (draw loop
  mirrors the same offsets). Flame: `FLAME_LOBES[weapon]` (1/2/3/4 angle
  offsets from straight up, `±0.32 rad` half-angle each) — pip 1 is one
  cone, pip 4 is four overlapping-but-distinct cones; `tickFlame` checks
  membership in *any* lobe so a target isn't double-hit if two lobes
  overlap it. Base range bumped `90→100` alongside the ship's wider
  vertical range (below) so it can actually reach high-holding enemies.
  Permanent tier scales `dps`/`range` only — pip no longer adds a flat dps
  bonus on either (that's now entirely the lobe/beam count's job).
- **chain**: hitscan, no `bullets` entry — `fireChain()` runs on the
  normal cooldown, finds the nearest target within 520px of the ship,
  then up to `count = 2 + floor(tier/2) + (weapon-1)` more within 140px of
  the *previous* hit (never re-hitting the same target), damage decaying
  ×0.75 per jump. Pip now adds extra jumps directly (the chain-lightning
  analog of "more turrets") instead of a flat dmg bonus. Draws one
  `lightningBolts` entry (a point-path, faded over 0.25s) connecting every
  hit in order.
- **emp**: also hitscan-on-cooldown — `fireEmp()` damages everything
  within `radius` of the ship AND deletes every `ebullets` entry in that
  same radius (`ebullets.filter(... >= radius)`), the one weapon that's
  explicitly defensive utility over dps. Pip has no natural "count" analog
  for a single burst pulse, so it's the one exception that still grows
  `radius`/`dmg` directly instead of a projectile/beam/lobe count. Pushes
  an `empPulses` ring (expands to `maxR` over 0.4s, fades over 0.5s).

`applyBulletHit(b, target)` is the single collision-damage entry point for
every discrete-bullet weapon (blaster/bombs/missiles/bolas) — it replaced
the old inline `e.hp--`/`boss.hp--` so bomb splash and bola slow-on-hit
didn't need duplicating between the enemy-loop and boss-loop collision
checks that used to be separate.

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
Non-`'play'` state (menu, pilots, shipyard, over, victory) → the ambient
menu track. This is also *not* enemies-on-screen-driven — see the code
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
is the boot state) before any menu/shipyard/run function is reachable —
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
