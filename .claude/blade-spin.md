# Blade Spin — Context (`games/blade-spin/index.html`)

Knife-Hit-style timing thrower, portrait-first. A blade waits at the bottom
pointing up; tap anywhere hurls it into a spinning disc overhead. It sticks
at the impact angle and rotates with the disc — unless something already
occupies that arc, in which case it clatters off and the run ends. Stick all
K blades to burst the disc and drop in the next one. Every 5th disc is a
named boss. Single self-contained file.

## Unit space & core geometry

- **Unit space**: fixed 100×178, y grows **down** (screen-like), letterboxed
  + centered (`scale = min(cw/W, ch/H)`, offsets `ox/oy`; `px()`/`py()` map).
- Disc center `(50, 52)` (`DISC_CY`; `discY` animates during drop-in), radius
  24 normal / 28 boss. Contact point is always the **disc bottom = world
  angle 90°** (y-down atan2 convention).
- Blade tip waits at `readyTipY() = DISC_CY + r + FLIGHT_DIST` — FLIGHT_DIST
  74u at `THROW_SPEED` 600 u/s ⇒ **flight time constant ~123 ms on every
  level, normal and boss** (the ready position shifts down for the bigger
  boss disc so timing skill transfers).
- Impact resolution: `impactLocal = norm(90 − disc.rot)`. Stuck blades and
  spikes are stored as **local angles**; obstacle world angle = local +
  rot. Collision iff `angDist(obstacle, impactLocal) < MIN_GAP` (**11°**),
  spikes checked before blades. Stick pushes `impactLocal` into `stuck[]`.
- Gems collect on a successful stick when `angDist ≤ GEM_WIN` (**8°**) —
  gems are never obstacles (pure bonus, checked after the collision test).

## Levels, generator + fairness rules

`genLevel(n)` is **deterministic per level** — a mulberry32 PRNG seeded from
`n` — so every player sees the same level n (and tests can assert on it).

- Blades: `K = min(5 + floor((N−1)/2), 9)`; shown as pip column at x=7.
- Spikes (obstacles): none before level 3; then 1–3, ramping via
  `maxS = min(3, 1 + floor((n−3)/5))`; bosses get `min(3, maxS+1)`.
- Gems: none before level 2; then 1–2, placed ≥ `MIN_GAP+GEM_WIN+2` = 21°
  from any spike (a gem grab is never forced into a collision) and ≥26°
  apart.
- **Fairness invariants (asserted by the headless drive):**
  - spikes pairwise ≥ `2·MIN_GAP + 4` = **26°** apart;
  - capacity: `(spikes + K) · 2·MIN_GAP ≤ 330°` (worst case 12·22 = 264°),
    so a legal slot always exists regardless of landing order — n points fit
    on a circle with pairwise gap g whenever n·g ≤ 360;
  - `|ω| ≤ OMEGA_CAP` **200°/s** from every pattern (belt-and-suspenders
    clamp inside `discOmega`);
  - constant flight time (above).

### Rotation patterns

`pat = (n−1) % 4` for normal levels, bosses use pattern 4. `discOmega(t)`
(t = `levelT`, seconds since 'play' began) is a pure function of the disc
config — sample it directly in tests:

| pat | behavior | formula sketch |
|---|---|---|
| 0 | constant | `dir·base` |
| 1 | direction-reversing | sign flips every `revT` (1.2–2.0 s) |
| 2 | sinusoidal ease | `dir·base·|sin(πt/period)|` — **momentarily stops** each `period` (2.0–3.2 s): the snipe window |
| 3 | pulse | first 30% of `pulseCy` at `min(base·1.7, 200)`, rest at `base·0.35` |
| 4 | boss erratic | sign flip every `0.75·revT` × surge `0.45+0.55·|sin(2.1t)|` × `min(base·1.25, 200)` |

`base = min(55 + (n−1)·8, 168)`. Bosses: r 28, red rim, purple hub, cycling
neon name banner (`BOSS_NAMES`, 4 names, cycled by boss index), extra music
percussion, +50 clear bonus.

## Scoring & persistence

+1 per stick · +25 per gem · +10 level clear · +50 extra on boss clear
(boss total 61 with the last stick). localStorage (all try/catch via
`lsGet/lsSet`): `blade-spin-best`, `blade-spin-bestlvl` (both written on
game over), `blade-spin-gems` (lifetime, written on collect — HUD shows
lifetime), `blade-spin-ckpt` (see Checkpoints), `blade-spin-mute`.

## Checkpoints (every 5 levels)

- Every multiple-of-5 level (= every boss) is a checkpoint, unlocked the
  moment `applyLevel(n)` runs for it — not on clear — with a
  `CHECKPOINT ✓` float text + `sndCkpt` chime. `ckpt` (top-level let)
  holds the highest unlocked level; persisted to `blade-spin-ckpt` only
  when it grows. Back-compat at boot:
  `ckpt = max(stored ckpt, floor(bestLvl/5)*5)` so pre-checkpoint players
  keep their earned progress.
- `startRun(fromLevel)` starts a fresh run (score 0, gemsRun 0) at any
  level; `beginRun(lv)` is the overlay-facing wrapper (hides both
  overlays). Starting *from* a checkpoint can't inflate `ckpt` (only a
  strictly higher multiple of 5 raises it); `best` can't be farmed either
  — a later start skips all earlier levels' points.
- **Death overlay:** `deadCkpt = floor(level/5)*5` at death. If > 0 the
  overlay shows two `mkBtn` buttons — `CHECKPOINT · LV n` / `FROM START` —
  and **tap-anywhere retry is disabled** (uiTap checks `deadCkpt === 0`);
  if 0, the classic TAP TO RETRY tap-anywhere path is unchanged.
- **Start overlay:** `refreshStartRow()` builds `#start-row` (`LV 1` +
  one button per unlocked checkpoint) inside `#start-ck`, hidden while
  `ckpt < 5`. Rebuilt at boot and whenever ckpt grows.
- `mkBtn` buttons debounce via the shared `lastTap` and `stopPropagation`
  so a button tap never doubles into the overlay's tap-anywhere handler.

## State machine & architecture

`state`: `title → drop → play → (clear → drop → play …) | over`. Tests use
any other string (e.g. `'paused'`) to freeze — `frame()` only calls
`step(dt)` for play/clear/drop. `step` branches: drop (0.55 s ease-out
cubic, disc falls from y=−40), clear (1.15 s pause then
`applyLevel(level+1)`), play (integrate `disc.rot` by `discOmega(levelT)`,
advance `flying.tipY`, resolve on edge crossing).

Key top-level lets (all reachable from `page.evaluate`): `state score level
K bladesLeft disc discY stuck spikes gems flying freeBlades shards particles
texts hitFlash best bestLvl gemsLife ckpt deadCkpt muted ac musicTimer`.

Functions: `genLevel`/`discOmega`/`readyTipY` (generator) ·
`applyLevel`/`startRun`/`levelClear`/`doCollision` (flow) ·
`throwBlade`/`resolveImpact` (core; resolveImpact returns
`'stick'|'hit'|'clear'` for tests) · `step` (sim) · `drawKnife`/`drawSpike`/
`drawGem`/`drawDisc`/`drawShard`/`drawPips`/`render` (draw) · `frame`
(rAF, dt cap 0.1 s, dpr cap 2). Collision: clattering blade joins
`freeBlades` (gravity + spin), hit obstacle red-flashes via `hitFlash`,
overlay after 950 ms. Clear: disc bursts into 12 wedge `shards`, stuck
blades fly off as `freeBlades`.

## Audio

Lazy `audio()` on first gesture builds `ac` → `masterGain` (mute sets gain
0) ← `sfxGain` 0.9 + `musicGain` 0.5. Music: 16-step 16th-note sequencer @
**120 BPM** (`MUSIC_STEP` 0.125 s), lookahead scheduler (`setInterval` 100 ms
scheduling 0.3 s ahead) — A-minor triangle bass + square pluck lead (pattern
B every 4th bar) + noise hats + kick on steps 0/10; **boss discs add a
16th-hat layer + metallic offbeat tick** (checked live from `disc.boss`).
SFX: throw whoosh (bandpass noise sweep), stick thunk+ring, gem arpeggio
(880/1175/1568), collision clang+buzz, clear fanfare, boss riser, game-over
fall. `visibilitychange` suspends/resumes (resume skipped while muted).
Mute button top-left (DOM, `stopPropagation`, 400 ms debounce), persists.

## Tuning knobs

`MIN_GAP` (difficulty core — raising it needs a capacity re-check),
`GEM_WIN`, `FLIGHT_DIST`/`THROW_SPEED` (reaction window), `base` ramp + 168
cap and `OMEGA_CAP` (spin difficulty), K formula, spike `maxS` ramp,
drop/clear pause timings (0.55/1.15 s), `PEN` 6 (blade embed depth, visual).

## § headless test recipe

`.claude/scripts/smoke-mobile.cjs` gates load; full drive:
scratchpad `blade-spin/blade-drive.cjs` (playwright-core, iPhone 13 profile,
`file://`, font/net console noise filtered; 30 assertions). Patterns:

- Freeze with `state='paused'`, then drive resolution directly: set
  `disc.rot`, `stuck`, `spikes`, `gems`, `flying={tipY:discY+disc.r}` and
  call `resolveImpact()` — its return value + `stuck`/`state` give exact
  stick-angle, MIN_GAP-boundary (10° hits, 12° sticks), wraparound-arc and
  gem-window cases deterministically.
- Level-clear transition: set `bladesLeft=1`, resolve, then call
  `step(1/60)` in a loop (~160 iterations) to walk clear → drop → play.
- Generator/ω sweeps: `genLevel(n)` is pure; `applyLevel(n)` then sample
  `discOmega(t)` (t 0→20 step 0.01) — remember to re-freeze (`applyLevel`
  sets `state='drop'`).
- Start via `page.touchscreen.tap` (trusted gesture ⇒ `ac.state==='running'`
  headless); assert `musicTimer != null`. Mute via dispatched `MouseEvent`
  (`cancelable:true` — handler calls preventDefault).

**Traps hit:**
- **Flex canvas overflow in landscape**: `#game { flex:1 }` without
  `min-height:0` let the canvas's *transferred intrinsic ratio* (default
  300×150 ⇒ height = width/2 = 422px > the 337px flex slot) overflow the
  100dvh column — world drew below the fold, ready blade off-screen. Fix:
  `min-height:0; min-width:0` on the canvas. Portrait never showed it
  (390/2 = 195 < 791). Assert `canvas.getBoundingClientRect().bottom ≤
  window.innerHeight` in both orientations.
- `applyLevel()` (and collision paths) fire banners/`setTimeout` overlays —
  hide `#ov-dead` / ignore banners when scripting past them, and reset
  `state='paused'` after any call that mutates it.
- `resolveImpact()` collision path needs no `flying` object, but stick math
  assumes the tip is at the disc edge — always set `flying` before calling.
- Checkpoint drive (scratchpad `blade-spin/ckpt-drive.cjs`, 24 assertions):
  death-overlay buttons appear ~950 ms after the collision — wait ≥1.2 s
  before querying `#dead-row`. Reset `lastTap = 0` before each scripted
  tap/click or the shared 400 ms debounce eats it. Buttons are activated
  with a dispatched `MouseEvent` (`cancelable:true`); tap-anywhere-disabled
  is asserted by tapping the overlay and checking `state === 'over'` holds.

## Gotchas / follow-up ideas

- `disc` is *reassigned* per level (`applyLevel`), so never cache a
  reference to it across levels; `discOmega` reads the current binding.
- Boss music layer keys off `disc.boss` at schedule time — the last bar
  scheduled before a boss dies may still carry the extra hats (~0.3 s,
  inaudible in practice).
- Ideas: combo bonus for consecutive near-miss sticks (within 15° of an
  obstacle), a rare golden gem worth 100, disc skins unlocked by lifetime
  gems, daily-seed run (generator is already seeded per level), haptics via
  `navigator.vibrate` on stick/collision.
