# Fire Clicker — context

`games/fire-clicker/index.html` (~640 lines, single file). Idle clicker, the
repo's third (after croissant/basketball) and a **direct CD commission**
(2026-08-28) despite the saturated shelf — deliberately lighter than the other
two, with one differentiating mechanic: **heat**.

**Licensing: this directory is one of the five protected games** (with phasic,
mitochondria, qntmchmst, turret-builder) — it carries a proprietary LICENSE,
never an Apache/MIT one. The CD may develop it into a real app one day.

## Core loop
- Tap the canvas fire → `stoke()`: +`clickPow()` embers, +heat, spark burst,
  floating `+N`.
- **Heat** (0–100): +2.4/tap (×1.5 with HEAVY BELLOWS), decays 4.8/s after a
  0.9 s idle grace (halved by FIREBRICK LINING). `heatMult = 1 + heat/100`
  (span ×2 with WHITE HEAT → up to ×3) and multiplies **both** tap power and
  embers/sec — that's the twist: active stoking boosts the idle engine, unlike
  the other two clickers where clicking and passive income are separate lanes.
- 10 buildings (`BDEFS`, TINDER PINCH → SOLAR MIRROR), cost × 1.15^owned.
- Upgrades (`UDEFS`): 3 ×2 tiers per building (at 10/25/50 owned), 5 ×2 click
  upgrades at lifetime thresholds, CINDER SIPHON (tap gains +2% of eps), 3 heat
  specials. Shop shows only available+unpurchased, cheapest 6.
- **Fire stages** by `totalAll` (never resets): SPARK → CAMPFIRE → BONFIRE →
  BLAZE → INFERNO → FIRESTORM → SOLAR FLARE (hue goes blue-white). Stage drives
  particle size/rate/hue in `drawFire()`.
- **Rekindle** (prestige): needs 1e6 embers this fire;
  `ash = floor(sqrt(total/1e6))`, each ash +10% everything, forever. Resets
  embers/buildings/upgrades/heat; keeps `totalAll`, ash, rekindles, mute.
- Offline: on load, min(8 h) × eps × 50%, toast if ≥1 ember and >60 s away.

## Architecture
- State `S`, save key `fireClicker.v1`, autosave 5 s + `visibilitychange`;
  `load()` rebuilds field-by-field, never trusts the blob shape.
- DOM shop (like the other clickers) + canvas fire: `#app` flex column
  (`#main-col` head+canvas / `#shop` 42dvh scroll); landscape flips to a row
  with a 320 px shop. Chrome (`#back-btn`, `#mute-btn`) z-80 above the modal
  (z-70).
- Canvas: dpr-capped-at-2, particles pooled (`MAXP` 260), additive `lighter`
  flames + tap sparks, radial glow, two crossed logs. All geometry derives
  from `fireBase()` (center, `H*0.82`, radius from stage size).
- Audio: standard stack — lazy `audioInit()` on first gesture, `sfxGain`/
  `musicGain`, mute persisted, suspend on hidden. Music = low triangle drone +
  lookahead-scheduled pentatonic plucks + looping filtered-noise crackle bed.
  SFX: tap = bandpass noise burst, buy/upgrade blips, stage arpeggio,
  rekindle whoosh.

## Balance notes
- Building eps/cost ratios roughly follow the croissant curve (payback grows
  ~×2 per tier); first rekindle lands ~30–45 min of active play.
- `fmt()` suffixes K→No; numbers stay finite (no BigInt) — fine to ~1e33.

## Gotchas
- `#main-col` must stay `display:flex` in **both** orientations or the canvas
  collapses (bitten during build).
- `refreshShop()` runs at 4 Hz; `rebuildShop()` only on purchase/unlock
  (`dirtyShop`) — don't rebuild chips per frame, it kills tap targets
  mid-press.
- Stage-change toast/sfx fire off `lastStageName` diff in `refreshShop()`;
  boot seeds `lastStageName` first so loading a big save is silent.
