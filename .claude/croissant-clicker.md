# Croissant Clicker — Context

Idle/incremental clicker (Cookie Clicker-style) themed around baking croissants.
Single file: `games/croissant-clicker.html`, ~700 lines. DOM-driven UI with a
canvas overlay for click particles/floating numbers.

## Core loop

- Click the croissant for `getClickPower()` croissants; buildings passively
  generate `getCps()` per second via a `requestAnimationFrame` loop.
- `state` is one global object (croissants, totalBakedAllTime, buildings,
  purchased upgrades, achievements, prestige currency). All derived numbers
  (`getCps`, `getClickPower`, `getBuildingCost`) are recomputed on demand,
  never cached — keeps upgrade/achievement/prestige stacking correct without
  invalidation bugs.

## Systems

- **Buildings** (`BUILDING_DEFS`): 10 tiers, cost scales `baseCost * 1.15^count`.
  A buy-quantity bar (1/10/100/Max, `state.buyQuantity`) sits above the list;
  `getBulkCost(i, qty)` sums the geometric series in closed form (no loop),
  and `getMaxAffordable(i)` solves the inverse via `log`/`log(1.15)` then
  nudges ±1 to correct for floating-point edge cases at the boundary.
- **Building upgrades** (`BUILDING_UPGRADES`, generated from `TIER_CONFIG`):
  each building gets 3 auto-generated upgrades (own 10/25/50) that each double
  that building's output.
- **Click upgrades** (`CLICK_UPGRADE_DEFS`): 6 hand-authored, unlock by lifetime
  baked thresholds, mix of flat add / multiplier / "% of CPS" effects.
- **Achievements** (`ACHIEVEMENT_DEFS`): 22 milestone-based, each unlocked one
  grants +0.25% to `achievementMultiplier()` (global production).
- **Store Upgrade**: a standalone repeatable purchase (`state.storeLevel`,
  separate from `BUILDING_DEFS`/`BUILDING_UPGRADES` since it doesn't produce
  CPS directly — it multiplies it). Cost is `10000 * 8^level`
  (`getStoreUpgradeCost()`); each level compounds money (CPS only, not click
  power) by another 30% via `storeUpgradeMultiplier() = 1.3^level`. Rendered
  as a highlighted row pinned above the buy-quantity bar in the Buildings tab.
  Resets to 0 on rebirth, same as building/click upgrades.
- **Golden croissant**: spawns every 45–90s at a random point in the click
  area, expires after 13s unclicked. 50/50 Frenzy (7x production, 30s) or
  Lucky (instant croissant bonus).
- **Rebirth**: `computeGoldenButterGain()` = `floor(cbrt(totalBakedAllTime / 1e9))`.
  Rebirthing sets `goldenButter = max(goldenButter, gain)` (never decreases).
  Each point of Golden Butter is two independent permanent +1% multipliers —
  `rebirthSpeedMultiplier()` (click power) and `rebirthMoneyMultiplier()` (CPS)
  — rather than one shared multiplier, so click speed and passive income can
  be balanced/tuned separately later. Resets croissants/buildings/upgrades but
  NOT `totalBakedAllTime`, `goldenButter`, or achievements.
- **Big Rebirth**: a deeper second prestige tier, gated on `state.goldenButter`
  itself (`computeChickenCroissantGain()` = `floor(cbrt(goldenButter / 50))`,
  so it only becomes possible — and the header button only appears via its
  `.ready` class — once Golden Butter reaches 50). Confirming it does
  everything a normal Rebirth does PLUS resets `goldenButter` to 0, and grants
  Chicken Croissants (`chickenCroissants = max(chickenCroissants, gain)`,
  banked the same way as Golden Butter). Each Chicken Croissant is a
  standalone +400%-compounding (`bigRebirthMoneyMultiplier() = 5^n`) money-only
  multiplier stacked into `getCps()` alongside the others — intentionally far
  stronger than a Golden Butter point, to justify sacrificing the Golden
  Butter stockpile. `totalBakedAllTime` is untouched, so a normal Rebirth is
  usually immediately available again right after a Big Rebirth.

## Save/offline

- Autosaves to `localStorage` every 15s, on `visibilitychange` (hidden), and
  `beforeunload`.
- On load, if the gap since `lastSave` exceeds 30s (capped at 4h), grants
  50%-efficiency offline earnings and shows a modal.
- Hard reset (header button) wipes `localStorage` entirely, including
  Golden Butter — distinct from rebirth, which is a soft/partial reset.

## Testing notes

Playwright wasn't preinstalled in this environment; `playwright-core` was
installed ad hoc into the scratchpad dir to smoke-test clicking, purchases,
golden-croissant clicks, rebirth, save/offline-earnings, and hard reset —
all verified working. Note: Playwright's actionability check treats the
golden croissant as "unstable" because of its CSS pulse/spin animation;
real pointer clicks are unaffected, but automated tests against it should
dispatch `PointerEvent` directly rather than using `locator.click()`.

Also note: this sandbox's network proxy resets the Google Fonts request
(`net::ERR_CONNECTION_RESET`), and the pre-installed headless Chromium build
here hangs on same-page client-initiated navigation (`location.replace`/
`reload`/`href=`) while that request is pending/failed. Mock the font request
to succeed (`page.route('**://fonts.googleapis.com/**', ...)`) when testing
the reload button in this environment — it works fine both with the mock and
on the real deployed site.
