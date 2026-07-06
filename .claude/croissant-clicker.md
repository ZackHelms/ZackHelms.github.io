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
- **Achievements** (`ACHIEVEMENT_DEFS`): 26 milestone-based, each unlocked one
  grants +0.25% to `achievementMultiplier()` (global production).
- **Medals** (`state.medalLevel`, rendered as a single row at the top of the
  Upgrades tab): unlimited — there is no fixed list. `getMedalPercent(n)` /
  `getMedalCost(n)` / `getMedalName(n)` / `getMedalIcon(n)` are pure functions
  of the medal number `n`, not a static array. The first 5 are fixed/named
  (`MEDAL_BASE_PERCENTS = [30,50,100,500,1000]`, cost `1e6 * 100^(n-1)` —
  1M/100M/10B/1T/100T); beyond n=5 the name falls back to `Medal #n`, the icon
  to 🎖️, the percent keeps doubling (`1000 * 2^(n-5)`), and cost keeps the
  same x100-per-tier scaling. `medalMultiplier()` sums `getMedalPercent(n)`
  for `n` from 1 to `state.medalLevel` into one `1 + total/100` multiplier
  applied to BOTH `getCps()` and `getClickPower()` (unlike the Boosts/Rebirth
  systems, which keep money and speed as separate tracks — medals are
  deliberately "of everything"). The row always displays medal
  `state.medalLevel + 1` (the next one to buy); buying it just increments
  `medalLevel` — no per-medal purchased-state bookkeeping needed since it's a
  single always-increasing counter. Medals are permanent: NOT reset by
  Rebirth or Big Rebirth, only wiped by a full hard reset — closer in spirit
  to achievements than to the Boosts tab. "Decorated" achievement fires at
  `medalLevel >= 5`.
- **Boosts tab** (3rd tab, `initBoostRows()`/`updateBoostRows()`): three
  independent repeatable purchases, each built from the same generic
  `initBoostRow(container, opts)` / `updateBoostRow(ref)` helpers so they
  share row markup/afford-check logic but read/write distinct state:
  - **Money Boost** (`state.storeLevel`, formerly "Store Upgrade") — cost
    `10000 * 8^level`, each level compounds money (CPS only) by +30% via
    `storeUpgradeMultiplier() = 1.3^level`.
  - **Speed Boost** (`state.speedBoostLevel`) — same cost/compounding shape
    (`10000 * 8^level`, `speedBoostMultiplier() = 1.3^level`) but multiplies
    click power instead of CPS.
  - **Click Power** (`state.clickPowerBoostLevel`) — cheaper linear track
    (cost `25 * 4^level`), each level adds a flat `+1` to click power's
    additive base (`clickPowerBoostBonus()`), for early-game impact before
    the percentage tracks compound meaningfully.
  All three reset to 0 on both Rebirth and Big Rebirth.
- **Golden croissant**: spawns every 45–90s at a random point in the click
  area, expires after 13s unclicked. 50/50 Frenzy (7x production, 30s) or
  Lucky (instant croissant bonus).
- **Rebirth**: gain is INCREMENTAL, not lifetime-cumulative — `totalBakedAllTime`
  never resets, so gain is computed off `totalBakedAllTime` minus a baseline
  snapshot (`state.totalBakedAtLastRebirth`, updated to the current
  `totalBakedAllTime` every time you rebirth): `computeGoldenButterGain() =
  floor(cbrt((totalBakedAllTime - totalBakedAtLastRebirth) / 1e9))`.
  Rebirthing does `goldenButter += gain` — genuinely STACKS across repeated
  rebirths — rather than the old `max(goldenButter, gain)`. The incremental
  baseline is what prevents that from being a free-infinite-rebirth exploit:
  spamming rebirth with no new production in between always yields gain 0.
  Each point of Golden Butter is two independent permanent +1% multipliers —
  `rebirthSpeedMultiplier()` (click power) and `rebirthMoneyMultiplier()` (CPS)
  — rather than one shared multiplier. Resets croissants/buildings/upgrades/
  boosts but NOT `totalBakedAllTime`, `totalBakedAtLastRebirth`, `goldenButter`,
  or achievements.
- **Big Rebirth**: same incremental-stacking pattern one layer up — gated on
  `state.goldenButter` minus a `state.goldenButterAtLastBigRebirth` baseline:
  `computeChickenCroissantGain() = floor(cbrt((goldenButter -
  goldenButterAtLastBigRebirth) / 50))`. The header button's `.ready` class
  lights up once that's > 0 (i.e. 50+ Golden Butter earned since the last Big
  Rebirth). Confirming it does everything a normal Rebirth does PLUS
  `chickenCroissants += gain` (stacks) and resets both `goldenButter` and
  `goldenButterAtLastBigRebirth` to 0 — deliberately does NOT touch
  `totalBakedAtLastRebirth`, so any unclaimed progress toward the next normal
  Rebirth's Golden Butter gain survives a Big Rebirth. Each Chicken Croissant
  is a standalone +400%-compounding (`bigRebirthMoneyMultiplier() = 5^n`)
  money-only multiplier stacked into `getCps()` alongside the others.

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
