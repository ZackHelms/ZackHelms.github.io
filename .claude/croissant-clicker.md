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
- **Building upgrades** (`BUILDING_UPGRADES`, generated from `TIER_CONFIG`):
  each building gets 3 auto-generated upgrades (own 10/25/50) that each double
  that building's output.
- **Click upgrades** (`CLICK_UPGRADE_DEFS`): 6 hand-authored, unlock by lifetime
  baked thresholds, mix of flat add / multiplier / "% of CPS" effects.
- **Achievements** (`ACHIEVEMENT_DEFS`): 21 milestone-based, each unlocked one
  grants +0.25% to `achievementMultiplier()` (global production).
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
