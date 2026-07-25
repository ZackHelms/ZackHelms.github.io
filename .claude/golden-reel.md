# Golden Reel — game context

`games/golden-reel/index.html` — dusk-lake fishing. Hold-charge cast,
tap-twitch lure, tap-the-bite hook set, hold-to-reel/release-the-runs
fight; coins → tackle shop; persistent catch log. Single self-contained
file.

## Architecture

- **State machine** (`state`): `menu | idle | casting | flight | wait |
  bite | fight | caught | snap`. One input pair drives everything:
  `pressStart` (cast-charge / hook-set / reel-hold / twitch by state) and
  `pressEnd` (cast release / reel release). `update(dt)` advances the
  active phase — manually steppable for tests.
- **World distance** d 0..100 m along the water; `surfPt(d)` maps to a
  perspective surface point (far → horizon, small via `scl(d)`).
- **Cast:** charge 0..1 (0.9 s), `castD = 8 + power·maxCast(line)`;
  flight is a 0.7 s bezier; landing seeds `biteT` from a clamped
  exponential around `biteDelay(lure)`. Twitch (0.8 s cooldown) shortens
  `biteT` by 1.1 s.
- **Species** (`SPECIES`): zone-gated by castD (near: bluegill/perch,
  mid: bass/catfish, far: trout/pike). Rares roll first: GOLDEN KOI
  (lure 1+), OLD GOLDSCALE (far water, lure 3+ only). `pickSpecies()`
  is the single spawn point.
- **Bite:** 0.9 s `biteWin`; tap → `setHook()` builds
  `fight {sp, w, stam, mode calm|run, modeT, tension, dist}`; miss →
  fish flees, new bite timer.
- **Fight loop** (`fightTick`): run mode adds tension (much faster if
  reeling — ×60 vs ×26, scaled by `sp.fight` and weight) and takes line;
  calm decays tension (faster when NOT reeling) and reeling pulls
  `dist` down at `reelSpd(reel)`. Stamina drains each phase; spent fish
  stays calm forever (`modeT += 999`). `tension ≥ rodMaxT(rod)` →
  `lineSnap` (state-guarded); `dist ≤ 0` → `landCatch` (state-guarded,
  pays value scaled by weight, updates `log[key] {n, best}`, saves).
- **Gear** (`gear` rod/reel/line/lure, lvl 0–4; `gearCost` 40/120/340/
  900): rod = max tension, reel = reel speed, line = cast range (far
  species need it), lure = bite rate + rare odds. `buyGear` refuses when
  broke and re-renders the shop.
- **Persistence:** `goldenReel.coins` / `.gear` / `.log` (JSON), mute
  `golden-reel-mute`.

## Rendering (the realistic-graphics stack)

- Layered sunset gradient + twinkling stars + sun with bloom disc;
  clouds lit from beneath (dark tops → warm underbellies); two
  silhouette shore bands.
- **Water:** mirrored dusk gradient, animated **sun-glitter path**
  (additive flickering dashes widening toward the viewer), 12 rolling
  sinusoidal ripple bands, mist gradient over far water, expanding
  elliptical ripple rings on splash/twitch/bite.
- Ambient fish as depth-faded silhouettes with tail wiggle; hooked fish
  thrashes under the bobber (fast in runs). Bobber: gradient-shaded
  red/white with water reflection, plunges during bites.
- Pier planks/posts with reflections; rim-lit angler silhouette that
  leans into the fight; rod bends with tension (`rodTip()`); sagging
  line via quadratic curve. Fireflies (additive) near shore.

## Audio

Standard stack (`golden-reel-mute`, lazy `audioInit` incl. bindTap
handlers, shared `noiseBuf`, visibilitychange suspend). Continuous:
lapping-water noise bed w/ slow LFO, charge whir (pitch follows charge),
tension **creak** (bandpassed saw, gain rises above 70% tension). Music:
4-chord dusk pad + sparse plucks + randomized cricket chirps. SFX: cast
whoosh, splash, twitch, double-thump bite, hook chime, reel ticks
(while reeling calm), sharp snap, catch fanfare (longer for rares).

## Test hooks / traps

- Everything top-level; run each scenario inside one `page.evaluate`
  with manual `update(1/60)` stepping. `beginCast/releaseCast/
  twitchLure/triggerBite/setHook/buyGear` all callable directly.
- Staging a fight: build the `fight` object by hand; remember run-mode
  tension climbs even unreeled (~19/s for a pike) — stage tension well
  below max or it snaps during any real-time wait (screenshot trap,
  2026-07-25).
- `modeT: 999` freezes a phase for deterministic reel/snap scenarios.
- Drive: `scratchpad/drive-reel.cjs` (29 checks: cast curve + clamp,
  zone/rarity gating, hook window both ways, catch → coins/log/persist,
  snap + survive-the-run, shop purchase/refusal, 80-cycle fuzz, mute +
  save reload).
